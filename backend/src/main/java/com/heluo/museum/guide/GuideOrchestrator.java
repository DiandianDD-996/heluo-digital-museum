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
import java.util.concurrent.atomic.AtomicLong;
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
    private final int maxConcurrency;
    private final AtomicLong degradations = new AtomicLong();
    private final AtomicLong redlineBlocks = new AtomicLong();
    private volatile Policy runtimePolicy = new Policy(RuntimeMode.NORMAL, 0, false);

    record Policy(RuntimeMode mode, long revision, boolean filePaused) {
        boolean paused() { return filePaused || mode == RuntimeMode.PAUSED; }
    }

    Policy policy() {
        Policy current = runtimePolicy;
        return new Policy(current.mode(), current.revision(), isPaused());
    }

    public enum RuntimeMode { NORMAL, DETERMINISTIC, PAUSED }

    public record Overview(boolean enabled, boolean modelEnabled, int usedToday, int dailyLimit,
                           int inFlight, long degradationCount, long redlineBlockCount,
                           RuntimeMode runtimeMode, boolean paused, boolean filePaused) {}

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
        this.maxConcurrency = maxConc;
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

    public Overview overview() {
        Policy current = policy();
        return new Overview(properties.isEnabled(), properties.isModelEnabled(), dailyLimit.usedToday(),
                Math.max(0, properties.getDailyTurnLimit()), maxConcurrency - concurrencyPermits.availablePermits(),
                degradations.get(), redlineBlocks.get(), current.mode(), current.paused(), current.filePaused());
    }

    synchronized void changeMode(RuntimeMode mode, Runnable audit) {
        audit.run();
        Policy previous = runtimePolicy;
        if (mode != previous.mode()) runtimePolicy = new Policy(mode, previous.revision() + 1, false);
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
        Policy admitted = policy();
        if (admitted.paused()) {
            ChatResponse resp = fallback.paused(requestId, request.locale());
            listener.onDelta(resp.text());
            listener.onDone(resp);
            return;
        }

        // 2. If model is disabled intentionally or unconfigured -> deterministic direct mode
        if (!properties.isModelEnabled() || admitted.mode() == RuntimeMode.DETERMINISTIC) {
            ChatResponse resp = fallback.respond(requestId, request, false);
            listener.onDelta(resp.text());
            listener.onDone(resp);
            return;
        }

        if (!llmClient.isConfigured()) {
            LOG.warn("Guide model enabled but missing valid endpoint/model/key; falling back to deterministic mode");
            ChatResponse resp = degrade(requestId, request);
            listener.onDelta(resp.text());
            listener.onDone(resp);
            return;
        }

        // 3. Concurrency & daily budget admission
        if (!concurrencyPermits.tryAcquire()) {
            LOG.warn("Guide concurrency limit reached; degrading gracefully");
            ChatResponse resp = degrade(requestId, request);
            listener.onDelta(resp.text());
            listener.onDone(resp);
            return;
        }

        StringBuilder visible = new StringBuilder();
        try {
            if (!dailyLimit.tryStart()) {
                LOG.warn("Guide daily turn limit reached; degrading gracefully");
                ChatResponse resp = degrade(requestId, request);
                listener.onDelta(resp.text());
                listener.onDone(resp);
                return;
            }

            ToolAuditContext audit = new ToolAuditContext(request.locale());
            List<Map<String, Object>> messages = promptBuilder.buildMessages(request, audit);

            SentenceGuard guard = new SentenceGuard(request, listener, visible, admitted);
            GuideLlmClient.StreamOutcome outcome = llmClient.complete(
                    messages,
                    audit,
                    listener::onStatus,
                    guard::feed);
            guard.finish();

            GuideResponseValidator.ValidationResult validated = validator.validate(
                    request, outcome.body(), outcome.rawMeta(), audit);
            ensurePolicy(admitted);

            if (!validated.accepted()) {
                LOG.warn("Guide response rejected by validator reason={}; replacing with deterministic fallback",
                        validated.rejectionReason());
                if ("FACTUAL_REDLINE".equals(validated.rejectionReason())) redlineBlocks.incrementAndGet();
                ChatResponse safe = degrade(requestId, request);
                listener.onReplace(safe.text());
                listener.onDone(safe);
                return;
            }

            if (!validated.text().equals(visible.toString().strip())) {
                listener.onReplace(validated.text());
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
            LOG.warn("Guide LLM generation stopped: {}; falling back to deterministic mode", ex.getClass().getSimpleName());
            if (ex instanceof UnsafeSentence unsafe && unsafe.redline) redlineBlocks.incrementAndGet();
            Policy current = policy();
            ChatResponse safe = current.paused() ? fallback.paused(requestId, request.locale())
                    : ex instanceof PolicyChanged ? fallback.respond(requestId, request, false) : degrade(requestId, request);
            listener.onReplace(safe.text());
            listener.onDone(safe);
        } finally {
            concurrencyPermits.release();
        }
    }

    private void ensurePolicy(Policy admitted) {
        if (!policy().equals(admitted)) throw new PolicyChanged();
    }

    private static final class PolicyChanged extends RuntimeException {}

    private ChatResponse degrade(String requestId, ChatRequest request) {
        degradations.incrementAndGet();
        return fallback.respond(requestId, request, true);
    }

    private final class SentenceGuard {
        private static final int MAX_SENTENCE_CHARS = 1200;
        private final StringBuilder pending = new StringBuilder();
        private final ChatRequest request;
        private final StreamListener listener;
        private final StringBuilder visible;
        private final Policy admitted;

        private SentenceGuard(ChatRequest request, StreamListener listener, StringBuilder visible, Policy admitted) {
            this.request = request;
            this.listener = listener;
            this.visible = visible;
            this.admitted = admitted;
        }

        void feed(String text) {
            ensurePolicy(admitted);
            pending.append(text);
            var matcher = GuideResponseValidator.SENTENCE_END.matcher(pending);
            int consumed = 0;
            while (matcher.find()) {
                emit(pending.substring(consumed, matcher.end()));
                consumed = matcher.end();
            }
            pending.delete(0, consumed);
            if (pending.length() > MAX_SENTENCE_CHARS) throw new UnsafeSentence(false);
        }

        void finish() {
            if (!pending.isEmpty()) emit(pending.toString());
        }

        private void emit(String sentence) {
            String safe = validator.cleanProse(sentence, GuidePromptBuilder.isEnglish(request.locale()));
            if (sentence.length() > MAX_SENTENCE_CHARS) throw new UnsafeSentence(false);
            if (validator.violatesRedline(sentence, request.context())
                    || validator.violatesRedline(safe, request.context())) throw new UnsafeSentence(true);
            if (!safe.isEmpty()) {
                visible.append(safe);
                listener.onDelta(safe);
            }
        }
    }

    /** Escapes the upstream read loop; try-with-resources closes the model response. */
    private static final class UnsafeSentence extends RuntimeException {
        private final boolean redline;
        private UnsafeSentence(boolean redline) { this.redline = redline; }
    }

    private boolean isPaused() {
        Optional<Path> path = properties.pauseFile();
        return path.isPresent() && Files.exists(path.get());
    }
}
