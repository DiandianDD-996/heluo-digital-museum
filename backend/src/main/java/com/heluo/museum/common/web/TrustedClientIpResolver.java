package com.heluo.museum.common.web;

import jakarta.servlet.http.HttpServletRequest;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.web.util.matcher.IpAddressMatcher;
import org.springframework.stereotype.Component;

@Component
public final class TrustedClientIpResolver {
    private final List<IpAddressMatcher> trusted;

    public TrustedClientIpResolver(@Value("${museum.security.trusted-proxy-cidrs}") String cidrs) {
        trusted = Arrays.stream(cidrs.split(",")).map(String::strip).filter(s -> !s.isEmpty())
                .map(cidr -> {
                    if (normalize(cidr.split("/", -1)[0]) == null) {
                        throw new IllegalArgumentException("museum.security.trusted-proxy-cidrs 必须使用数字地址");
                    }
                    return new IpAddressMatcher(cidr);
                }).toList();
    }

    public String resolve(HttpServletRequest request) {
        String peer = normalize(request.getRemoteAddr());
        if (peer == null) return "unknown";
        if (!isTrusted(peer)) return peer;
        var headers = Collections.list(request.getHeaders("X-Forwarded-For"));
        String leftmost = peer;
        for (int h = headers.size() - 1; h >= 0; h--) {
            String[] hops = headers.get(h).split(",", -1);
            for (int i = hops.length - 1; i >= 0; i--) {
                String hop = normalize(hops[i]);
                // A malformed hop is a broken trust chain; do not cross it.
                if (hop == null) return peer;
                if (!isTrusted(hop)) return hop;
                leftmost = hop;
            }
        }
        return leftmost;
    }

    private boolean isTrusted(String address) {
        return trusted.stream().anyMatch(matcher -> matcher.matches(address));
    }

    private static String normalize(String raw) {
        if (raw == null) return null;
        String ip = raw.strip();
        if (ip.length() > 45) return null;
        if (ip.contains(":")) {
            if (!ip.matches("[0-9a-fA-F:.]+")) return null;
        } else if (!ip.matches("(?:[0-9]{1,3}\\.){3}[0-9]{1,3}")) {
            return null;
        }
        try {
            return InetAddress.getByName(ip).getHostAddress();
        } catch (UnknownHostException invalid) {
            return null;
        }
    }
}
