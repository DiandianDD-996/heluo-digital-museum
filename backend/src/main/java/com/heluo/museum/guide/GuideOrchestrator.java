package com.heluo.museum.guide;

import com.heluo.museum.guide.GuideModels.ChatRequest;
import com.heluo.museum.guide.GuideModels.ChatResponse;
import com.heluo.museum.guide.GuideToolExecutor.ToolAuditContext;
import jakarta.annotation.PreDestroy;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Semaphore;
import java.util.concurrent.atomic.AtomicInteger;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Central orchestrator for Luosheng v2 driving both SSE streaming and JSON fallback endpoints.
 * Enforces pause file, daily generation limit, bounded concurrency semaphore, LLM + tool execution,
 * Layer-2 validation, and Layer-3 deterministic fallback / atomic `replace`.
 */
@Service
public class GuideOrchestrator {
    private static final Logger LOG = LoggerFactory.getLogger(GuideOrchestrator.class);

    public interface StreamListener {
        void onStatus(String phase);
        void onDelta(String text);
        void onReplace(String text);
        void onDone(ChatResponse response);
    }

    private final GuideProperties properties;
    private final GuidePromptBuilder promptBuilder;
    private final GuideLlmClient llmClient;
    private final GuideResponseValidator validator;
    private final GuideDeterministicFallback fallback;
    private final GuideDailyGenerationLimit dailyLimit;
    private final Semaphore concurrencyPermits;
    private final ExecutorService asyncExecutor;

    public GuideOrchestrator(
            GuideProperties properties,
            GuidePromptBuilder promptBuilder,
            GuideLlmClient llmClient,
            GuideResponseValidator validator,
            GuideDeterministicFallback fallback) {
        this.properties = properties;
        this.promptBuilder = promptBuilder;
        this.llmClient = llmClient;
        this.validator = validator;
        this.fallback = fallback;
        int daily = Math.max(0, properties.getDailyTurnLimit());
        int maxConc = Math.max(1, properties.getMaxConcurrentGenerations());
        this.dailyLimit = new GuideDailyGenerationLimit(Clock.system(ZoneId.of("Asia/Shanghai")), daily);
        this.concurrencyPermits = new Semaphore(maxConc);
        AtomicInteger seq = new AtomicInteger(1);
        this.asyncExecutor = Executors.newFixedThreadPool(Math.max(4, maxConc * 2), r -> {
            Thread t = new Thread(r, "guide-stream-" + seq.getAndIncrement());
            t.setDaemon(true);
            return t;
        });
    }

    public ExecutorService asyncExecutor() {
        return asyncExecutor;
    }

    @PreDestroy
    void shutdown() {
        asyncExecutor.shutdownNow();
    }

    public ChatResponse handleSync(String requestId, ChatRequest request) {
        ChatResponse[] holder = new ChatResponse[1];
        handle(requestId, request, new StreamListener() {
            @Override public void onStatus(String phase) {}
            @Override public void onDelta(String text) {}
            @Override public void onReplace(String text) {}
            @Override public void onDone(ChatResponse response) { holder[0] = response; }
        });
        return holder[0];
    }

    public void handle(String requestId, ChatRequest request, StreamListener listener) {
        // 1. Operational pause file check
        if (isPaused()) {
            ChatResponse resp = fallback.paused(requestId, request.locale());
            listener.onDelta(resp.text());
            listener.onDone(resp);
            return;
        }

        // 2. If model is disabled intentionally or unconfigured -> deterministic direct mode
        if (!properties.isModelEnabled()) {
            ChatResponse resp = fallback.respond(requestId, request, false);
            listener.onDelta(resp.text());
            listener.onDone(resp);
            return;
        }

        if (!llmClient.isConfigured()) {
            LOG.warn("Guide model enabled but missing valid endpoint/model/key; falling back to deterministic mode");
            ChatResponse resp = fallback.respond(requestId, request, true);
            listener.onDelta(resp.text());
            listener.onDone(resp);
            return;
        }

        // 3. Concurrency & daily budget admission
        if (!concurrencyPermits.tryAcquire()) {
            LOG.warn("Guide concurrency limit reached; degrading gracefully");
            ChatResponse resp = fallback.respond(requestId, request, true);
            listener.onDelta(resp.text());
            listener.onDone(resp);
            return;
        }

        boolean deltaEmitted = false;
        try {
            if (!dailyLimit.tryStart()) {
                LOG.warn("Guide daily turn limit reached; degrading gracefully");
                ChatResponse resp = fallback.respond(requestId, request, true);
                listener.onDelta(resp.text());
                listener.onDone(resp);
                return;
            }

            ToolAuditContext audit = new ToolAuditContext();
            List<Map<String, Object>> messages = promptBuilder.buildMessages(request, audit);

            boolean[] streamed = {false};
            GuideLlmClient.StreamOutcome outcome = llmClient.complete(
                    messages,
                    audit,
                    listener::onStatus,
                    delta -> {
                        streamed[0] = true;
                        listener.onDelta(delta);
                    });
            deltaEmitted = streamed[0] || outcome.emittedDelta();

            GuideResponseValidator.ValidationResult validated = validator.validate(
                    request, outcome.body(), outcome.rawMeta(), audit);

            if (!validated.accepted()) {
                LOG.warn("Guide response rejected by validator reason={}; replacing with deterministic fallback",
                        validated.rejectionReason());
                ChatResponse safe = fallback.respond(requestId, request, true);
                if (deltaEmitted) {
                    listener.onReplace(safe.text());
                } else {
                    listener.onDelta(safe.text());
                }
                listener.onDone(safe);
                return;
            }

            // If bare URLs were stripped from the streamed body, atomically sync cleaned text
            if (deltaEmitted && !validated.text().equals(outcome.body().strip())) {
                listener.onReplace(validated.text());
            } else if (!deltaEmitted) {
                listener.onDelta(validated.text());
            }

            ChatResponse finalResp = new ChatResponse(
                    requestId,
                    validated.text(),
                    validated.citations(),
                    validated.actions(),
                    validated.followUps(),
                    validated.boundaryNote(),
                    "ai",
                    false);
            listener.onDone(finalResp);
        } catch (Exception ex) {
            LOG.warn("Guide LLM generation failed ({}): {}; falling back to deterministic mode",
                    ex.getClass().getSimpleName(), ex.getMessage());
            ChatResponse safe = fallback.respond(requestId, request, true);
            if (deltaEmitted) {
                listener.onReplace(safe.text());
            } else {
                listener.onDelta(safe.text());
            }
            listener.onDone(safe);
        } finally {
            concurrencyPermits.release();
        }
    }

    private boolean isPaused() {
        Optional<Path> path = properties.pauseFile();
        return path.isPresent() && Files.exists(path.get());
    }
}
