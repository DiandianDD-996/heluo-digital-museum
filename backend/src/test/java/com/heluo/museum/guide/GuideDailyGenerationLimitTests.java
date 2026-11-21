package com.heluo.museum.guide;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

class GuideDailyGenerationLimitTests {
    @Test
    void concurrentAttemptsCannotExceedTheSharedLimit() {
        var limit = new GuideDailyGenerationLimit(Clock.systemUTC(), 6);
        assertEquals(6, IntStream.range(0, 100).parallel().filter(i -> limit.tryStart()).count());
        assertFalse(limit.tryStart());
    }

    @Test
    void midnightResetsTheLimitButClockRollbackDoesNot() {
        var clock = mock(Clock.class);
        when(clock.getZone()).thenReturn(ZoneId.of("Asia/Shanghai"));
        when(clock.instant()).thenReturn(Instant.parse("2026-11-19T15:59:59Z"));
        var limit = new GuideDailyGenerationLimit(clock, 1);
        assertTrue(limit.tryStart());
        assertFalse(limit.tryStart());
        when(clock.instant()).thenReturn(Instant.parse("2026-11-19T16:00:00Z"));
        assertTrue(limit.tryStart());
        when(clock.instant()).thenReturn(Instant.parse("2026-11-19T15:59:59Z"));
        assertFalse(limit.tryStart());
        assertFalse(new GuideDailyGenerationLimit(clock, 0).tryStart());
    }
}
