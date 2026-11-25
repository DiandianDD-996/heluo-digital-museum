package com.heluo.museum.common.notification;

import java.net.URI;
import java.util.Locale;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.security.web.util.matcher.IpAddressMatcher;
import org.springframework.stereotype.Component;

@Component
final class SmtpSafetyCheck {
    SmtpSafetyCheck(Environment environment, @Value("${museum.mail.public-base-url}") String publicBaseUrl,
                    @Value("${spring.mail.host:}") String host, @Value("${spring.mail.port:1025}") int port) {
        if (environment.acceptsProfiles(Profiles.of("local", "dev", "development", "test"))) return;
        URI origin = URI.create(publicBaseUrl);
        String originHost = origin.getHost();
        if (originHost == null) throw new IllegalStateException("MUSEUM_PUBLIC_BASE_URL 必须包含有效主机");
        String smtp = host.strip().toLowerCase(Locale.ROOT).replaceFirst("\\.$", "");
        if (!isLoopback(originHost) && !smtp.isEmpty()
                && (port == 1025 || smtp.equals("mailpit") || smtp.startsWith("mailpit."))) {
            throw new IllegalStateException("公网配置禁止使用 Mailpit 或 SMTP 测试端口 1025；请禁用邮件或配置正式 SMTP");
        }
    }

    private static boolean isLoopback(String host) {
        if ("localhost".equalsIgnoreCase(host)) return true;
        String ip = host.replace("[", "").replace("]", "");
        return (ip.matches("127(?:\\.[0-9]{1,3}){3}") && new IpAddressMatcher("127.0.0.0/8").matches(ip))
                || (ip.contains(":") && new IpAddressMatcher("::1/128").matches(ip));
    }
}
