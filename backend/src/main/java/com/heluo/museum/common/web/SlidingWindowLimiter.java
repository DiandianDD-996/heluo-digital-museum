package com.heluo.museum.common.web;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.HashMap;
import java.util.Map;

/** Bounded, process-local quotas; rejected multi-bucket requests consume neither quota. */
public final class SlidingWindowLimiter {
    private static final int MAX_BUCKETS = 4096;
    private final Clock clock;
    private final Map<BucketKey, ArrayDeque<Instant>> buckets = new HashMap<>();

    public SlidingWindowLimiter(Clock clock) {
        this.clock = clock;
    }

    public record Quota(String scope, String key, Duration window, int limit) {
        private BucketKey bucket() {
            return new BucketKey(scope, key, window);
        }
    }

    public synchronized boolean tryAcquire(Quota... quotas) {
        Instant now = clock.instant();
        if (buckets.size() + quotas.length > MAX_BUCKETS) {
            buckets.entrySet().removeIf(e -> e.getValue().isEmpty()
                    || !e.getValue().getLast().isAfter(now.minus(e.getKey().window())));
        }
        int missing = 0;
        for (Quota quota : quotas) {
            var entries = buckets.get(quota.bucket());
            if (entries == null) {
                missing++;
            } else {
                Instant cutoff = now.minus(quota.window());
                while (!entries.isEmpty() && !entries.getFirst().isAfter(cutoff)) entries.removeFirst();
                if (entries.size() >= quota.limit()) return false;
            }
        }
        if (buckets.size() + missing > MAX_BUCKETS) return false;
        for (Quota quota : quotas) buckets.computeIfAbsent(quota.bucket(), k -> new ArrayDeque<>()).addLast(now);
        return true;
    }

    private record BucketKey(String scope, String key, Duration window) {}
}
