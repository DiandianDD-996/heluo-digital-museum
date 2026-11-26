package com.heluo.museum.content;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.HtmlUtils;
import org.springframework.web.util.UriUtils;

@RestController
public class DetailPageController {
    private static final Pattern TITLE = Pattern.compile("(?is)<title\\b[^>]*>.*?</title\\s*>");
    private static final Pattern META = Pattern.compile(
            "(?is)<meta\\s+[^>]*?(?:name\\s*=\\s*['\"]description['\"]|property\\s*=\\s*['\"]og:[^'\"]*['\"])[^>]*>");
    private static final Pattern HEAD_END = Pattern.compile("(?i)</head\\s*>");
    private static final MediaType HTML = new MediaType("text", "html", StandardCharsets.UTF_8);
    private static final String PUBLISHED = " a.status='PUBLISHED' and a.deleted_at is null and c.enabled=1";
    private final JdbcTemplate jdbc;
    private final String origin;
    private final String template;
    private final HttpClient frontend;
    private final HttpRequest templateRequest;
    private final boolean guideEnabled;

    DetailPageController(JdbcTemplate jdbc, String baseUrl, String templateUrl) throws IOException {
        this(jdbc, baseUrl, templateUrl, false);
    }

    @Autowired
    DetailPageController(JdbcTemplate jdbc, @Value("${museum.mail.public-base-url}") String baseUrl,
                         @Value("${museum.seo.spa-index-url:}") String templateUrl,
                         @Value("${museum.guide.enabled:false}") boolean guideEnabled) throws IOException {
        this.jdbc = jdbc;
        this.origin = SiteIndexController.publicOrigin(baseUrl);
        this.guideEnabled = guideEnabled;
        var resource = new ClassPathResource("static/index.html");
        this.template = resource.exists() ? resource.getContentAsString(StandardCharsets.UTF_8) : null;
        if (!templateUrl.isBlank()) {
            URI uri = URI.create(templateUrl);
            if (!("http".equals(uri.getScheme()) || "https".equals(uri.getScheme()))
                    || uri.getHost() == null || uri.getUserInfo() != null || uri.getQuery() != null
                    || uri.getFragment() != null || !"/index.html".equals(uri.getPath())) {
                throw new IllegalArgumentException("MUSEUM_SPA_INDEX_URL must be the configured frontend index.html");
            }
            frontend = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(1)).build();
            templateRequest = HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(2))
                    .header("Accept", "text/html").GET().build();
        } else {
            frontend = null;
            templateRequest = null;
        }
    }

    @GetMapping(value = {"/{section:artifacts|articles|exhibits}/{slug}",
                         "/{section:artifacts|articles|exhibits}/{slug}/"}, produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> detail(@PathVariable String section, @PathVariable String slug) {
        String sql = switch (section) {
            case "artifacts" -> "select a.slug,a.title,a.summary,a.cover_image_url from artifacts a join categories c on c.id=a.category_id where a.slug=? and" + PUBLISHED;
            case "articles" -> "select a.slug,a.title,a.summary,a.cover_image_url from articles a join categories c on c.id=a.category_id where a.slug=? and" + PUBLISHED;
            case "exhibits" -> "select e.slug,e.title,e.summary,e.cover_image_url from exhibits_3d e "
                    + "join artifacts a on a.id=e.artifact_id join categories c on c.id=a.category_id "
                    + "where e.slug=? and e.status='PUBLISHED' and e.deleted_at is null and" + PUBLISHED;
            default -> throw new IllegalArgumentException("未知详情类型");
        };
        var items = jdbc.query(sql, (rs, n) -> new Page(rs.getString("slug"), rs.getString("title"),
                rs.getString("summary"), rs.getString("cover_image_url")), slug);
        if (items.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).contentType(HTML).cacheControl(CacheControl.noStore())
                    .body("<!doctype html><html lang=\"zh-CN\"><meta charset=\"UTF-8\"><title>未找到内容</title><h1>未找到内容</h1><a href=\"/explore\">返回探索馆藏</a></html>");
        }
        String index = loadTemplate();
        if (index == null) return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).contentType(HTML)
                .cacheControl(CacheControl.noStore()).body("<!doctype html><meta charset=\"UTF-8\"><title>暂时无法打开</title><h1>请稍后重试</h1>");
        var page = items.get(0);
        String path = "/" + section + "/" + UriUtils.encodePathSegment(page.slug(), StandardCharsets.UTF_8);
        String tags = tags(page.title(), page.summary(), absoluteCover(page.cover()), origin + path,
                "articles".equals(section) ? "article" : "website", guideEnabled);
        String body = inject(index, page.title(), tags);
        return ResponseEntity.ok().contentType(HTML).cacheControl(CacheControl.noStore()).body(body);
    }

    private String loadTemplate() {
        if (frontend == null) return template;
        try {
            var response = frontend.send(templateRequest, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() == 200 && response.body().length() <= 65_536
                    && HEAD_END.matcher(response.body()).find()) return response.body();
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
        } catch (IOException ignored) {
            // Do not serve stale markup or assets from a different build.
        }
        return null;
    }

    String absoluteCover(String cover) {
        if (cover != null && !cover.isBlank()) {
            try {
                URI uri = URI.create(cover);
                if (cover.startsWith("/") && !cover.startsWith("//") && uri.getRawAuthority() == null) {
                    return URI.create(origin).resolve(uri).toASCIIString();
                }
                if (("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme()))
                        && uri.getHost() != null && uri.getUserInfo() == null) return uri.toASCIIString();
            } catch (IllegalArgumentException ignored) {
                // Invalid stored cover falls back to a public museum asset.
            }
        }
        return origin + "/favicon.svg";
    }

    static String inject(String template, String title, String tags) {
        String clean = TITLE.matcher(META.matcher(template).replaceAll("")).replaceAll("");
        return HEAD_END.matcher(clean).replaceFirst(Matcher.quoteReplacement(
                "<title>" + escape(title) + "</title>\n" + tags + "</head>"));
    }

    private static String tags(String title, String summary, String cover, String url, String type, boolean guideEnabled) {
        String base = "<meta name=\"description\" content=\"" + escape(summary) + "\">\n"
                + og("title", title) + og("description", summary) + og("image", cover)
                + og("url", url) + og("type", type);
        return guideEnabled ? base + "<meta name=\"museum-guide-enabled\" content=\"true\">\n" : base;
    }

    private static String og(String key, String value) {
        return "<meta property=\"og:" + key + "\" content=\"" + escape(value) + "\">\n";
    }

    private static String escape(String value) { return HtmlUtils.htmlEscape(value == null ? "" : value); }
    private record Page(String slug, String title, String summary, String cover) {}
}
