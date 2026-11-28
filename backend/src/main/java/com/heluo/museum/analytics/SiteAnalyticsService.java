package com.heluo.museum.analytics;

import com.heluo.museum.common.web.SlidingWindowLimiter;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Lightweight, privacy-preserving site traffic analytics service.
 * Stores daily PV/UV rollups and daily hashed visitor uniqueness keys without persisting raw IP addresses.
 */
@Service
public class SiteAnalyticsService {
    public static final String ROUTE_SITE_TOTAL = "SITE_TOTAL";
    public static final String SLUG_SITE_TOTAL = "__all__";
    private static final Set<String> ALLOWED_ROUTE_TYPES = Set.of(
            "HOME", "EXPLORE", "ARTIFACT", "ARTICLE", "EXHIBITS", "EXHIBIT", "APPOINTMENT", "SHOP", "OTHER"
    );

    private final JdbcTemplate jdbc;
    private final Clock clock;
    private final SlidingWindowLimiter limiter;
    private final boolean enabled;
    private final String visitorSalt;

    public SiteAnalyticsService(
            JdbcTemplate jdbc,
            Clock clock,
            @Value("${museum.analytics.enabled:true}") boolean enabled,
            @Value("${museum.analytics.visitor-salt:heluo-museum-analytics-v1}") String visitorSalt) {
        this.jdbc = jdbc;
        this.clock = clock;
        this.limiter = new SlidingWindowLimiter(clock);
        this.enabled = enabled;
        this.visitorSalt = visitorSalt == null ? "" : visitorSalt;
    }

    @Transactional
    public boolean recordPageView(String rawRouteType, String rawTargetSlug, String rawTargetTitle,
                                  String rawVisitorId, String clientIp) {
        if (!enabled) return false;
        String ipKey = (clientIp == null || clientIp.isBlank()) ? "unknown" : clientIp.trim();
        if (!limiter.tryAcquire(new SlidingWindowLimiter.Quota("analytics:pv", ipKey, Duration.ofMinutes(1), 60))) {
            return false;
        }
        String routeType = normalizeRouteType(rawRouteType);
        String slug = normalizeSlug(rawTargetSlug);
        String title = normalizeTitle(rawTargetTitle, routeType, slug);
        String visitorSeed = (rawVisitorId != null && !rawVisitorId.isBlank()) ? rawVisitorId.trim() : ("ip:" + ipKey);
        if (visitorSeed.length() > 120) visitorSeed = visitorSeed.substring(0, 120);

        LocalDate today = LocalDate.now(clock);
        String visitorHash = sha256Hex(today + "|" + visitorSalt + "|" + visitorSeed);

        String pageScope = routeType + ":" + (slug.isEmpty() ? "-" : slug);
        boolean isNewPageVisitor = markUniqueVisitor(today, pageScope, visitorHash);
        upsertDailyStat(today, routeType, slug, title, 1, isNewPageVisitor ? 1 : 0, 0);

        boolean isNewSiteVisitor = markUniqueVisitor(today, "__SITE__", visitorHash);
        upsertDailyStat(today, ROUTE_SITE_TOTAL, SLUG_SITE_TOTAL, "全站访问总览", 1, isNewSiteVisitor ? 1 : 0, 0);
        return true;
    }

    @Transactional
    public int seedDemoTraffic(long actorId) {
        jdbc.update("delete from site_page_daily_stats where is_demo=1");
        LocalDate today = LocalDate.now(clock);

        List<ContentItem> catalog = loadTopContentCandidates();
        List<Object[]> batch = new ArrayList<>(1200);

        // Deterministic 90-day museum visitor rhythm: weekend uplift, Monday lull, mild growth.
        for (int offset = 89; offset >= 0; offset--) {
            LocalDate date = today.minusDays(offset);
            int dayIndex = 89 - offset;
            double growth = 0.84 + (dayIndex / 89.0) * 0.34;
            DayOfWeek dow = date.getDayOfWeek();
            double weekdayFactor = switch (dow) {
                case MONDAY -> 0.44;
                case TUESDAY, WEDNESDAY -> 0.92;
                case THURSDAY -> 1.02;
                case FRIDAY -> 1.15;
                case SATURDAY -> 1.48;
                case SUNDAY -> 1.38;
            };
            double wave = 1.0 + 0.14 * Math.sin(dayIndex * 0.47) + 0.07 * Math.cos(dayIndex * 0.91);
            int totalPv = Math.max(48, (int) Math.round(320 * growth * weekdayFactor * wave));
            int totalUv = Math.max(24, (int) Math.round(totalPv * (0.43 + 0.03 * Math.cos(dayIndex * 0.33))));

            batch.add(new Object[] { date, ROUTE_SITE_TOTAL, SLUG_SITE_TOTAL, "全站访问总览", totalPv, totalUv, 1 });

            // Allocate channel & featured item visits proportionally so Top Content reflects realistic distribution.
            int homePv = (int) Math.round(totalPv * 0.34);
            batch.add(new Object[] { date, "HOME", "", "博物馆首页", homePv, (int) Math.round(homePv * 0.62), 1 });
            int explorePv = (int) Math.round(totalPv * 0.19);
            batch.add(new Object[] { date, "EXPLORE", "", "探索馆藏", explorePv, (int) Math.round(explorePv * 0.56), 1 });
            int exhibitsPv = (int) Math.round(totalPv * 0.12);
            batch.add(new Object[] { date, "EXHIBITS", "", "3D 数字展厅", exhibitsPv, (int) Math.round(exhibitsPv * 0.60), 1 });

            for (int i = 0; i < catalog.size(); i++) {
                ContentItem item = catalog.get(i);
                double itemJitter = 0.88 + 0.22 * Math.sin((dayIndex + 1) * (i + 2) * 0.37);
                int itemPv = Math.max(2, (int) Math.round(totalPv * item.weight() * itemJitter));
                int itemUv = Math.max(1, (int) Math.round(itemPv * 0.68));
                batch.add(new Object[] { date, item.routeType(), item.slug(), item.title(), itemPv, itemUv, 1 });
            }
        }

        jdbc.batchUpdate(
                "insert into site_page_daily_stats(stat_date,route_type,target_slug,target_title,pv_count,uv_count,is_demo) "
                        + "values(?,?,?,?,?,?,?)",
                batch);
        return batch.size();
    }

    @Transactional
    public int clearDemoTraffic() {
        return jdbc.update("delete from site_page_daily_stats where is_demo=1");
    }

    public boolean hasRealTraffic() {
        Long count = jdbc.queryForObject(
                "select count(*) from site_page_daily_stats where is_demo=0 and route_type=?",
                Long.class, ROUTE_SITE_TOTAL);
        return count != null && count > 0;
    }

    public boolean hasDemoTraffic() {
        Long count = jdbc.queryForObject(
                "select count(*) from site_page_daily_stats where is_demo=1 and route_type=?",
                Long.class, ROUTE_SITE_TOTAL);
        return count != null && count > 0;
    }

    private List<ContentItem> loadTopContentCandidates() {
        Map<String, ContentItem> ordered = new LinkedHashMap<>();
        jdbc.query("select slug,title from exhibits_3d where deleted_at is null order by id limit 4", rs -> {
            String slug = rs.getString("slug");
            double weight = "heluo-bronze-ding-3d".equals(slug) ? 0.14 : 0.085;
            ordered.put("EXHIBIT:" + slug, new ContentItem("EXHIBIT", slug, rs.getString("title"), weight));
        });
        jdbc.query("select slug,title from artifacts where deleted_at is null order by id limit 6", rs -> {
            String slug = rs.getString("slug");
            double weight = switch (slug) {
                case "heluo-bronze-ding" -> 0.105;
                case "river-map-jade-bi" -> 0.072;
                case "heluo-bronze-jue" -> 0.058;
                case "painted-pottery-water-jar" -> 0.048;
                default -> 0.04;
            };
            ordered.put("ARTIFACT:" + slug, new ContentItem("ARTIFACT", slug, rs.getString("title"), weight));
        });
        jdbc.query("select slug,title from articles where deleted_at is null order by id limit 3", rs -> {
            String slug = rs.getString("slug");
            ordered.put("ARTICLE:" + slug, new ContentItem("ARTICLE", slug, rs.getString("title"), 0.042));
        });

        if (ordered.isEmpty()) {
            ordered.put("EXHIBIT:heluo-bronze-ding-3d", new ContentItem("EXHIBIT", "heluo-bronze-ding-3d", "河洛青铜鼎 · 3D 数字重制展项", 0.14));
            ordered.put("ARTIFACT:heluo-bronze-ding", new ContentItem("ARTIFACT", "heluo-bronze-ding", "河洛青铜鼎（数字重制）", 0.105));
            ordered.put("EXHIBIT:river-map-stone-raking", new ContentItem("EXHIBIT", "river-map-stone-raking", "河洛图纹石板 · 交互斜射光检视", 0.085));
            ordered.put("ARTIFACT:river-map-jade-bi", new ContentItem("ARTIFACT", "river-map-jade-bi", "河图玉璧（概念展品）", 0.072));
            ordered.put("ARTIFACT:heluo-bronze-jue", new ContentItem("ARTIFACT", "heluo-bronze-jue", "河洛纹青铜爵（概念展品）", 0.058));
            ordered.put("ARTICLE:how-to-read-bronze", new ContentItem("ARTICLE", "how-to-read-bronze", "第一次看青铜器，可以从哪三个问题开始？", 0.042));
        }
        return new ArrayList<>(ordered.values());
    }

    private boolean markUniqueVisitor(LocalDate statDate, String scopeKey, String visitorHash) {
        try {
            jdbc.update("insert into site_visitor_daily_uniques(stat_date,scope_key,visitor_hash) values(?,?,?)",
                    statDate, scopeKey, visitorHash);
            return true;
        } catch (DataIntegrityViolationException duplicate) {
            return false;
        }
    }

    private void upsertDailyStat(LocalDate statDate, String routeType, String slug, String title,
                                 int pvDelta, int uvDelta, int isDemo) {
        int updated = jdbc.update(
                "update site_page_daily_stats set pv_count=pv_count+?,uv_count=uv_count+?,target_title=coalesce(?,target_title) "
                        + "where stat_date=? and route_type=? and target_slug=? and is_demo=?",
                pvDelta, uvDelta, title, statDate, routeType, slug, isDemo);
        if (updated > 0) return;
        try {
            jdbc.update(
                    "insert into site_page_daily_stats(stat_date,route_type,target_slug,target_title,pv_count,uv_count,is_demo) "
                            + "values(?,?,?,?,?,?,?)",
                    statDate, routeType, slug, title, pvDelta, uvDelta, isDemo);
        } catch (DataIntegrityViolationException concurrentInsert) {
            jdbc.update(
                    "update site_page_daily_stats set pv_count=pv_count+?,uv_count=uv_count+?,target_title=coalesce(?,target_title) "
                            + "where stat_date=? and route_type=? and target_slug=? and is_demo=?",
                    pvDelta, uvDelta, title, statDate, routeType, slug, isDemo);
        }
    }

    private static String normalizeRouteType(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new IllegalArgumentException("routeType 不能为空");
        }
        String upper = raw.trim().toUpperCase(Locale.ROOT);
        if (!ALLOWED_ROUTE_TYPES.contains(upper)) {
            throw new IllegalArgumentException("不支持的页面类型: " + upper);
        }
        return upper;
    }

    private static String normalizeSlug(String raw) {
        if (raw == null || raw.isBlank()) return "";
        String cleaned = raw.trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9-]", "");
        return cleaned.length() > 180 ? cleaned.substring(0, 180) : cleaned;
    }

    private static String normalizeTitle(String raw, String routeType, String slug) {
        if (raw != null && !raw.isBlank()) {
            String trimmed = raw.trim();
            return trimmed.length() > 200 ? trimmed.substring(0, 200) : trimmed;
        }
        if (!slug.isEmpty()) return slug;
        return switch (routeType) {
            case "HOME" -> "博物馆首页";
            case "EXPLORE" -> "探索馆藏";
            case "EXHIBITS" -> "3D 数字展厅";
            case "APPOINTMENT" -> "预约参观";
            case "SHOP" -> "河洛文创";
            default -> routeType;
        };
    }

    private static String sha256Hex(String input) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception ex) {
            throw new IllegalStateException("无法计算访问统计哈希", ex);
        }
    }

    private record ContentItem(String routeType, String slug, String title, double weight) {}
}
