package com.heluo.museum.guide;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.heluo.museum.common.api.ApiResponse;
import com.heluo.museum.common.error.ConflictException;
import com.heluo.museum.common.web.SlidingWindowLimiter;
import com.heluo.museum.common.web.SlidingWindowLimiter.Quota;
import com.heluo.museum.common.web.TrustedClientIpResolver;
import com.heluo.museum.guide.GuideModels.ChatRequest;
import com.heluo.museum.guide.GuideModels.ChatResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Iterator;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@ConditionalOnProperty(name = "museum.guide.enabled", havingValue = "true")
public class GuideChatController {
    private static final Logger LOG = LoggerFactory.getLogger(GuideChatController.class);
    private static final Set<String> ALLOWED_LOCALES = Set.of("zh-CN", "en-US");
    private static final int MAX_MESSAGE_CODE_POINTS = 500;
    private static final int MAX_IDEMPOTENCY_CACHE = 512;
    private static final Duration IDEMPOTENCY_TTL = Duration.ofMinutes(2);

    private final GuideOrchestrator orchestrator;
    private final SlidingWindowLimiter rateLimiter;
    private final int requestsPerMinute;
    private final TrustedClientIpResolver clientIps;
    private final ObjectMapper mapper;
    private final Clock clock;
    private final Map<CacheKey, CachedReply> idempotencyCache = new LinkedHashMap<>();

    public GuideChatController(GuideOrchestrator orchestrator, GuideProperties properties, Clock clock,
                               TrustedClientIpResolver clientIps, ObjectMapper mapper) {
        this.orchestrator = orchestrator;
        this.clock = clock;
        this.rateLimiter = new SlidingWindowLimiter(clock);
        this.requestsPerMinute = Math.max(1, properties.getRateLimitPerMinute());
        this.clientIps = clientIps;
        this.mapper = mapper;
    }

    @PostMapping(path = "/api/v1/guide/chat", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<ChatResponse>> chat(
            @RequestBody ChatRequest input,
            HttpServletRequest servletRequest) {
        ChatRequest normalized = validateAndNormalize(input, servletRequest);
        String requestId = normalized.requestId();

        CacheKey key = key(servletRequest, normalized);
        Reservation reservation = reserve(key, fingerprint(normalized));
        if (reservation.owner()) {
            try {
                finish(reservation.reply(), orchestrator.handleSync(requestId, normalized));
            } catch (RuntimeException ex) {
                fail(key, reservation.reply(), ex);
                throw ex;
            }
        }
        ChatResponse response = reservation.reply().response.join();

        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(ApiResponse.ok(response, "guide chat"));
    }

    @PostMapping(path = "/api/v1/guide/chat/stream", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter chatStream(
            @RequestBody ChatRequest input,
            HttpServletRequest servletRequest,
            HttpServletResponse servletResponse) {
        ChatRequest normalized = validateAndNormalize(input, servletRequest);
        String requestId = normalized.requestId();

        servletResponse.setHeader("X-Accel-Buffering", "no");
        servletResponse.setHeader("Cache-Control", "no-store");

        CacheKey key = key(servletRequest, normalized);
        Reservation reservation = reserve(key, fingerprint(normalized));
        SseEmitter emitter = new SseEmitter(60_000L);
        if (!reservation.owner()) {
            reservation.reply().response.whenComplete((cached, failure) -> {
                if (failure != null) {
                    emitter.completeWithError(failure);
                    return;
                }
                sendQuietly(emitter, "replace", Map.of("text", cached.text()));
                sendQuietly(emitter, "done", cached);
                emitter.complete();
            });
            return emitter;
        }

        try {
            orchestrator.asyncExecutor().submit(() -> {
            try {
                orchestrator.handle(requestId, normalized, new GuideOrchestrator.StreamListener() {
                    @Override
                    public void onStatus(String phase) {
                        sendQuietly(emitter, "status", Map.of("phase", phase));
                    }

                    @Override
                    public void onDelta(String text) {
                        sendQuietly(emitter, "delta", Map.of("text", text));
                    }

                    @Override
                    public void onReplace(String text) {
                        sendQuietly(emitter, "replace", Map.of("text", text));
                    }

                    @Override
                    public void onDone(ChatResponse response) {
                        finish(reservation.reply(), response);
                        sendQuietly(emitter, "done", response);
                        emitter.complete();
                    }
                });
            } catch (Exception ex) {
                fail(key, reservation.reply(), ex);
                LOG.warn("Guide SSE stream terminated unexpectedly: {}", ex.getMessage());
                emitter.completeWithError(ex);
            }
            });
        } catch (RuntimeException ex) {
            fail(key, reservation.reply(), ex);
            throw ex;
        }

        return emitter;
    }

    private ChatRequest validateAndNormalize(ChatRequest input, HttpServletRequest request) {
        if (!"same-origin".equals(request.getHeader("Sec-Fetch-Site"))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cross-site guide requests are not allowed");
        }
        if (input == null || input.message() == null || input.message().isBlank()) {
            throw new IllegalArgumentException("消息内容不能为空");
        }
        String trimmed = input.message().trim();
        int cpCount = trimmed.codePointCount(0, trimmed.length());
        if (cpCount < 1 || cpCount > MAX_MESSAGE_CODE_POINTS) {
            throw new IllegalArgumentException("消息长度需在 1 到 500 字符之间");
        }
        String locale = (input.locale() == null || input.locale().isBlank()) ? "zh-CN" : input.locale().trim();
        if (!ALLOWED_LOCALES.contains(locale)) {
            throw new IllegalArgumentException("不支持的语言标识：" + locale);
        }
        String requestId = input.requestId() == null
                ? UUID.randomUUID().toString()
                : input.requestId();
        if (!requestId.matches("[A-Za-z0-9_-]{8,64}")) {
            throw new IllegalArgumentException("requestId 格式无效");
        }
        String conversationId = (input.conversationId() == null || input.conversationId().isBlank())
                ? UUID.randomUUID().toString()
                : input.conversationId().trim();
        if (conversationId.length() > 128) throw new IllegalArgumentException("conversationId 过长");
        return new ChatRequest(conversationId, requestId, trimmed, locale, input.context(),
                input.history() == null ? java.util.List.of() : input.history());
    }

    private CacheKey key(HttpServletRequest request, ChatRequest input) {
        return new CacheKey(clientIps.resolve(request), input.conversationId(), input.requestId());
    }

    private String fingerprint(ChatRequest input) {
        try {
            var data = new ChatRequest(null, null, input.message(), input.locale(), input.context(), input.history());
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(mapper.writeValueAsBytes(data)));
        } catch (JsonProcessingException | NoSuchAlgorithmException ex) {
            throw new IllegalStateException("无法生成请求指纹", ex);
        }
    }

    private synchronized Reservation reserve(CacheKey key, String fingerprint) {
        Instant now = clock.instant();
        idempotencyCache.values().removeIf(reply -> reply.expiresAt != null && !reply.expiresAt.isAfter(now));
        CachedReply cached = idempotencyCache.get(key);
        GuideOrchestrator.Policy policy = orchestrator.policy();
        if (cached != null) {
            if (!cached.fingerprint.equals(fingerprint)) throw new ConflictException("requestId 已用于不同的请求");
            if (cached.policy.equals(policy)) return new Reservation(cached, false);
            // Neither a mode change nor a live pause file may replay a stale answer.
            idempotencyCache.remove(key);
        }
        Duration window = Duration.ofMinutes(1);
        if (!rateLimiter.tryAcquire(new Quota("ip", key.ip(), window, requestsPerMinute),
                new Quota("conversation", key.ip() + "|" + key.conversationId(), window, requestsPerMinute))) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "提问频率稍快，请稍后再试");
        }
        if (idempotencyCache.size() >= MAX_IDEMPOTENCY_CACHE) {
            Iterator<CachedReply> it = idempotencyCache.values().iterator();
            while (it.hasNext()) {
                if (it.next().expiresAt != null) {
                    it.remove();
                    break;
                }
            }
            if (idempotencyCache.size() >= MAX_IDEMPOTENCY_CACHE) {
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "提问繁忙，请稍后再试");
            }
        }
        CachedReply pending = new CachedReply(fingerprint, policy);
        idempotencyCache.put(key, pending);
        return new Reservation(pending, true);
    }

    private void finish(CachedReply reply, ChatResponse response) {
        reply.expiresAt = clock.instant().plus(IDEMPOTENCY_TTL);
        reply.response.complete(response);
    }

    private void fail(CacheKey key, CachedReply reply, Exception failure) {
        synchronized (this) { idempotencyCache.remove(key, reply); }
        reply.response.completeExceptionally(failure);
    }

    private static void sendQuietly(SseEmitter emitter, String eventName, Object data) {
        try {
            emitter.send(SseEmitter.event().name(eventName).data(data));
        } catch (IOException | IllegalStateException ex) {
            LOG.debug("Client disconnected during SSE send ({}): {}", eventName, ex.getMessage());
        }
    }

    private record CacheKey(String ip, String conversationId, String requestId) {}
    private record Reservation(CachedReply reply, boolean owner) {}
    private static final class CachedReply {
        private final String fingerprint;
        private final GuideOrchestrator.Policy policy;
        private final CompletableFuture<ChatResponse> response = new CompletableFuture<>();
        private volatile Instant expiresAt;
        private CachedReply(String fingerprint, GuideOrchestrator.Policy policy) {
            this.fingerprint = fingerprint;
            this.policy = policy;
        }
    }
}
