package com.heluo.museum.common.web;

import static org.assertj.core.api.Assertions.assertThat;
import java.time.Clock;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

class TrustedClientIpResolverTests {
    private final TrustedClientIpResolver resolver = new TrustedClientIpResolver("127.0.0.1/32,::1/128,172.30.88.10/32");

    @Test void evaluatesOnlyTheTrustedSuffixAndNormalizesNumericAddresses() {
        assertThat(resolve("203.0.113.1", "192.0.2.1")).isEqualTo("203.0.113.1");
        assertThat(resolve("172.30.88.10", "192.0.2.1, 203.0.113.1, 127.0.0.1")).isEqualTo("203.0.113.1");
        assertThat(resolve("::ffff:127.0.0.1", "172.30.88.10, 127.0.0.1")).isEqualTo("172.30.88.10");
        assertThat(resolve("::1", "2001:db8::1")).isEqualTo("2001:db8:0:0:0:0:0:1");
        assertThat(resolve("172.30.88.10", "192.0.2.1, invalid")).isEqualTo("172.30.88.10");
        assertThat(resolve("127.0.0.1", null)).isEqualTo("127.0.0.1");
    }

    @Test void rejectedAccountQuotaDoesNotConsumeIpQuota() {
        var limiter = new SlidingWindowLimiter(Clock.systemUTC());
        var ip = new SlidingWindowLimiter.Quota("ip", "test", Duration.ofMinutes(1), 2);
        var user = new SlidingWindowLimiter.Quota("account", "one", Duration.ofMinutes(10), 1);
        var other = new SlidingWindowLimiter.Quota("account", "two", Duration.ofMinutes(10), 1);
        assertThat(limiter.tryAcquire(ip, user)).isTrue();
        assertThat(limiter.tryAcquire(ip, user)).isFalse();
        assertThat(limiter.tryAcquire(ip, other)).isTrue();
        assertThat(limiter.tryAcquire(ip)).isFalse();
    }

    private String resolve(String peer, String chain) {
        var request = new MockHttpServletRequest();
        request.setRemoteAddr(peer);
        request.addHeader("X-Real-IP", "198.51.100.1");
        if (chain != null) request.addHeader("X-Forwarded-For", chain);
        return resolver.resolve(request);
    }
}
