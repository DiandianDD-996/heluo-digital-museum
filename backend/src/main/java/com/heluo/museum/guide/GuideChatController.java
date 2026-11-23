package com.heluo.museum.guide;

import com.heluo.museum.common.api.ApiResponse;
import com.heluo.museum.guide.GuideModels.ChatRequest;
import com.heluo.museum.guide.GuideModels.ChatResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
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
    private final GuideRateLimiter rateLimiter;
    private final Clock clock;
    private final Map<String, CachedReply> idempotencyCache = new LinkedHashMap<>(64, 0.75f, false);

    public GuideChatController(GuideOrchestrator orchestrator, GuideProperties properties, Clock clock) {
        this.orchestrator = orchestrator;
        this.clock = clock;
        this.rateLimiter = new GuideRateLimiter(clock, properties.getRateLimitPerMinute());
    }

    @PostMapping(path = "/api/v1/guide/chat", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<ChatResponse>> chat(
            @RequestBody ChatRequest input,
            HttpServletRequest servletRequest) {
        ChatRequest normalized = validateAndNormalize(input, servletRequest);
        String requestId = normalized.requestId();

        ChatResponse cached = lookupIdempotent(requestId);
        if (cached != null) {
            return ResponseEntity.ok()
                    .cacheControl(CacheControl.noStore())
                    .body(ApiResponse.ok(cached, "guide chat"));
        }

        enforceRateLimit(servletRequest, normalized);
        ChatResponse response = orchestrator.handleSync(requestId, normalized);
        storeIdempotent(requestId, response);

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

        ChatResponse cached = lookupIdempotent(requestId);
        if (cached != null) {
            SseEmitter emitter = new SseEmitter(15_000L);
            orchestrator.asyncExecutor().submit(() -> {
                try {
                    emitter.send(SseEmitter.event().name("delta").data(Map.of("text", cached.text())));
                    emitter.send(SseEmitter.event().name("done").data(cached));
                    emitter.complete();
                } catch (IOException ex) {
                    emitter.completeWithError(ex);
                }
            });
            return emitter;
        }

        enforceRateLimit(servletRequest, normalized);
        SseEmitter emitter = new SseEmitter(60_000L);

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
                        storeIdempotent(requestId, response);
                        sendQuietly(emitter, "done", response);
                        emitter.complete();
                    }
                });
            } catch (Exception ex) {
                LOG.warn("Guide SSE stream terminated unexpectedly: {}", ex.getMessage());
                emitter.completeWithError(ex);
            }
        });

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
        String requestId = (input.requestId() == null || input.requestId().isBlank())
                ? UUID.randomUUID().toString()
                : input.requestId().trim();
        if (requestId.length() > 64) {
            throw new IllegalArgumentException("requestId 过长");
        }
        String conversationId = (input.conversationId() == null || input.conversationId().isBlank())
                ? UUID.randomUUID().toString()
                : input.conversationId().trim();
        return new ChatRequest(conversationId, requestId, trimmed, locale, input.context(), input.history());
    }

    private void enforceRateLimit(HttpServletRequest request, ChatRequest normalized) {
        String ip = clientIp(request);
        String key = ip + "|" + normalized.conversationId();
        if (!rateLimiter.tryAcquire(ip) || !rateLimiter.tryAcquire(key)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "提问频率稍快，请稍后再试");
        }
    }

    private static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            int comma = forwarded.indexOf(',');
            return (comma > 0 ? forwarded.substring(0, comma) : forwarded).trim();
        }
        return request.getRemoteAddr() == null ? "unknown" : request.getRemoteAddr();
    }

    private synchronized ChatResponse lookupIdempotent(String requestId) {
        evictExpiredCache();
        CachedReply cached = idempotencyCache.get(requestId);
        return cached == null ? null : cached.response();
    }

    private synchronized void storeIdempotent(String requestId, ChatResponse response) {
        evictExpiredCache();
        if (idempotencyCache.size() >= MAX_IDEMPOTENCY_CACHE) {
            Iterator<String> it = idempotencyCache.keySet().iterator();
            if (it.hasNext()) {
                it.next();
                it.remove();
            }
        }
        idempotencyCache.put(requestId, new CachedReply(response, clock.instant().plus(IDEMPOTENCY_TTL)));
    }

    private void evictExpiredCache() {
        Instant now = clock.instant();
        Iterator<Map.Entry<String, CachedReply>> it = idempotencyCache.entrySet().iterator();
        while (it.hasNext()) {
            if (!it.next().getValue().expiresAt().isAfter(now)) {
                it.remove();
            } else {
                break;
            }
        }
    }

    private static void sendQuietly(SseEmitter emitter, String eventName, Object data) {
        try {
            emitter.send(SseEmitter.event().name(eventName).data(data));
        } catch (IOException | IllegalStateException ex) {
            LOG.debug("Client disconnected during SSE send ({}): {}", eventName, ex.getMessage());
        }
    }

    private record CachedReply(ChatResponse response, Instant expiresAt) {}
}
