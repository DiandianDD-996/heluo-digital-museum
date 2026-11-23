package com.heluo.museum.guide;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Stateless in-memory sliding-window rate limiter & short-term requestId deduplication guard.
 * Zero HttpSession usage, matching Spring Security SessionCreationPolicy.STATELESS.
 */
final class GuideRateLimiter {
    private static final int MAX_BUCKETS = 4096;
    private static final int MAX_REQUEST_IDS = 2048;
    private static final Duration WINDOW = Duration.ofMinutes(1);
    private static final Duration REQUEST_ID_TTL = Duration.ofMinutes(5);

    private final Clock clock;
    private final int maxRequestsPerMinute;
    private final Map<String, Deque<Instant>> buckets = new LinkedHashMap<>(64, 0.75f, true);
    private final Map<String, Instant> seenRequestIds = new LinkedHashMap<>(64, 0.75f, false);

    GuideRateLimiter(Clock clock, int maxRequestsPerMinute) {
        this.clock = clock;
        this.maxRequestsPerMinute = Math.max(1, maxRequestsPerMinute);
    }

    synchronized boolean tryAcquire(String clientKey) {
        String key = (clientKey == null || clientKey.isBlank()) ? "anonymous" : clientKey.trim();
        Instant now = clock.instant();
        Instant cutoff = now.minus(WINDOW);

        Deque<Instant> timestamps = buckets.computeIfAbsent(key, k -> new ArrayDeque<>());
        while (!timestamps.isEmpty() && !timestamps.peekFirst().isAfter(cutoff)) {
            timestamps.pollFirst();
        }
        if (timestamps.size() >= maxRequestsPerMinute) {
            return false;
        }
        timestamps.addLast(now);
        evictBucketsIfNeeded(cutoff);
        return true;
    }

    synchronized boolean markRequestIdIfNew(String requestId) {
        if (requestId == null || requestId.isBlank()) {
            return true;
        }
        Instant now = clock.instant();
        Instant cutoff = now.minus(REQUEST_ID_TTL);
        Iterator<Map.Entry<String, Instant>> it = seenRequestIds.entrySet().iterator();
        while (it.hasNext()) {
            Map.Entry<String, Instant> entry = it.next();
            if (!entry.getValue().isAfter(cutoff)) {
                it.remove();
            } else {
                break;
            }
        }
        if (seenRequestIds.containsKey(requestId)) {
            return false;
        }
        if (seenRequestIds.size() >= MAX_REQUEST_IDS) {
            Iterator<String> oldest = seenRequestIds.keySet().iterator();
            if (oldest.hasNext()) {
                oldest.next();
                oldest.remove();
            }
        }
        seenRequestIds.put(requestId, now);
        return true;
    }

    private void evictBucketsIfNeeded(Instant cutoff) {
        if (buckets.size() <= MAX_BUCKETS) {
            return;
        }
        Iterator<Map.Entry<String, Deque<Instant>>> it = buckets.entrySet().iterator();
        while (it.hasNext() && buckets.size() > MAX_BUCKETS) {
            Map.Entry<String, Deque<Instant>> entry = it.next();
            Deque<Instant> q = entry.getValue();
            while (!q.isEmpty() && !q.peekFirst().isAfter(cutoff)) {
                q.pollFirst();
            }
            if (q.isEmpty() || buckets.size() > MAX_BUCKETS) {
                it.remove();
            }
        }
    }
}
