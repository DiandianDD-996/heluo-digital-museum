package com.heluo.museum.guide;

import java.time.Clock;
import java.time.LocalDate;
import java.util.Objects;

/** In-process admission limit shared by visits using the same generator. */
final class GuideDailyGenerationLimit {
    private final Clock clock;
    private final int maxAttempts;
    private LocalDate day;
    private int used;

    GuideDailyGenerationLimit(Clock clock, int maxAttempts) {
        this.clock = Objects.requireNonNull(clock);
        if (maxAttempts < 0) throw new IllegalArgumentException("Invalid daily generation limit");
        this.maxAttempts = maxAttempts;
    }

    synchronized boolean tryStart() {
        LocalDate today = LocalDate.now(clock);
        if (day == null || today.isAfter(day)) {
            day = today;
            used = 0;
        }
        if (used >= maxAttempts) return false;
        used++;
        return true;
    }
}
