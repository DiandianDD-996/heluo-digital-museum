package com.heluo.museum.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
@Profile("pocketbay")
public class PocketBaySpaController {
    private static final Pattern HEAD_END = Pattern.compile("(?i)</head\\s*>");
    private static final MediaType HTML = new MediaType("text", "html", StandardCharsets.UTF_8);

    private final boolean guideEnabled;
    private final String guideIndexHtml;

    public PocketBaySpaController(@Value("${museum.guide.enabled:false}") boolean guideEnabled) throws IOException {
        this.guideEnabled = guideEnabled;
        var resource = new ClassPathResource("static/index.html");
        String template = resource.exists() ? resource.getContentAsString(StandardCharsets.UTF_8) : null;
        this.guideIndexHtml = (guideEnabled && template != null)
                ? HEAD_END.matcher(template).replaceFirst(Matcher.quoteReplacement(
                        "<meta name=\"museum-guide-enabled\" content=\"true\">\n</head>"))
                : null;
    }

    static boolean isPublicPageRequest(HttpServletRequest request) {
        String method = request.getMethod();
        String path = request.getRequestURI().substring(request.getContextPath().length());
        return ("GET".equals(method) || "HEAD".equals(method))
                && path.matches("^/(?!api(?:/|$)|actuator(?:/|$)|assets(?:/|$)|media(?:/|$))[^.]+$");
    }

    @GetMapping("/{section:^(?!api$|actuator$|assets$|media$)[^.]+}/**")
    public Object unknownPage(HttpServletResponse response) {
        if (guideEnabled && guideIndexHtml != null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .contentType(HTML)
                    .cacheControl(CacheControl.noStore())
                    .body(guideIndexHtml);
        }
        response.setStatus(HttpStatus.NOT_FOUND.value());
        response.setHeader("Cache-Control", "no-cache, must-revalidate");
        return "forward:/index.html";
    }

    @GetMapping({
            "/", "/explore", "/exhibits", "/appointment", "/shop",
            "/login", "/reset-password", "/profile",
            "/admin", "/admin/operations", "/admin/content",
            "/admin/artifacts", "/admin/articles", "/admin/exhibits", "/admin/categories",
            "/admin/appointments", "/admin/slots", "/admin/products", "/admin/orders",
            "/admin/users", "/admin/guide", "/admin/logs"
    })
    public Object index(HttpServletResponse response) {
        if (guideEnabled && guideIndexHtml != null) {
            return ResponseEntity.ok()
                    .contentType(HTML)
                    .cacheControl(CacheControl.noStore())
                    .body(guideIndexHtml);
        }
        response.setHeader("Cache-Control", "no-cache, must-revalidate");
        return "forward:/index.html";
    }
}
