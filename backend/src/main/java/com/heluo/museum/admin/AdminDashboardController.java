package com.heluo.museum.admin;

import com.heluo.museum.analytics.SiteAnalyticsService;
import com.heluo.museum.common.api.ApiResponse;
import com.heluo.museum.common.audit.OperationLogService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.IntStream;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/dashboard")
public class AdminDashboardController {
    private static final Set<Integer> ALLOWED_RANGE_DAYS = Set.of(7, 30, 90);
    private static final ZoneId MUSEUM_ZONE = ZoneId.of("Asia/Shanghai");
    private static final DateTimeFormatter TIME_LABEL_FORMAT = DateTimeFormatter.ofPattern("HH:mm");

    private final JdbcTemplate jdbc;
    private final Clock clock;
    private final SiteAnalyticsService analyticsService;
    private final OperationLogService operationLogService;

    public AdminDashboardController(
            JdbcTemplate jdbc,
            Clock clock,
            SiteAnalyticsService analyticsService,
            OperationLogService operationLogService) {
        this.jdbc = jdbc;
        this.clock = clock;
        this.analyticsService = analyticsService;
        this.operationLogService = operationLogService;
    }

    @GetMapping("/summary")
    public ApiResponse<Map<String, Object>> summary() {
        long users = count("select count(*) from users where deleted_at is null");
        long appointments = count("select count(*) from appointments");
        long orders = count("select count(*) from orders");
        BigDecimal sales = jdbc.queryForObject(
                "select coalesce(sum(payable_amount),0) from orders where status in ('PAID','COMPLETED')",
                BigDecimal.class);
        LocalDate today = LocalDate.now(clock);
        long pending = count("select count(*) from appointments where status='PENDING'");
        long checkedIn = jdbc.queryForObject(
                "select count(*) from appointments where checked_in_at>=? and checked_in_at<?",
                Long.class, today.atStartOfDay(), today.plusDays(1).atStartOfDay());
        List<LowStockProduct> lowStock = loadLowStockProducts(100);
        Map<LocalDate, DaySlots> slots = new LinkedHashMap<>();
        jdbc.query("""
                select visit_date,sum(capacity) capacity,sum(reserved_people) reserved_people
                from appointment_slots where visit_date>=? and visit_date<? and status='OPEN' group by visit_date
                """, rs -> {
            LocalDate date = rs.getObject("visit_date", LocalDate.class);
            slots.put(date, new DaySlots(date, rs.getLong("capacity"), rs.getLong("reserved_people")));
        }, today, today.plusDays(7));
        List<DaySlots> upcoming = IntStream.range(0, 7).mapToObj(today::plusDays)
                .map(date -> slots.getOrDefault(date, new DaySlots(date, 0, 0))).toList();
        Map<String, Long> statuses = loadOrderStatusCounts();
        TodoCounts todoCounts = loadTodoCounts(pending, statuses.getOrDefault("PAID", 0L), lowStock.size());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("userCount", users);
        result.put("appointmentCount", appointments);
        result.put("orderCount", orders);
        result.put("salesAmount", (sales == null ? BigDecimal.ZERO : sales).toPlainString());
        result.put("pendingAppointmentCount", pending);
        result.put("checkedInTodayCount", checkedIn);
        result.put("lowStockProducts", lowStock);
        result.put("upcoming7dSlots", upcoming);
        result.put("orderStatusCounts", statuses);
        result.put("todoCounts", todoCounts);
        return ApiResponse.ok(result, "admin-dashboard-summary");
    }

    @GetMapping("/analytics")
    public ApiResponse<Map<String, Object>> analytics(
            @RequestParam(defaultValue = "30") int days,
            @RequestParam(defaultValue = "false") boolean includeDemo) {
        if (!ALLOWED_RANGE_DAYS.contains(days)) {
            throw new IllegalArgumentException("days 仅支持 7、30 或 90");
        }

        LocalDate today = LocalDate.now(clock);
        LocalDate start = today.minusDays(days - 1L);
        LocalDate prevStart = start.minusDays(days);
        LocalDate prevEnd = start.minusDays(1L);

        boolean hasRealTraffic = analyticsService.hasRealTraffic();
        boolean hasDemoTraffic = analyticsService.hasDemoTraffic();
        boolean usingDemoTraffic = includeDemo && hasDemoTraffic;
        int demoFlag = usingDemoTraffic ? 1 : 0;

        // 1. Traffic time series (current + previous comparison window)
        Map<LocalDate, long[]> trafficMap = new LinkedHashMap<>();
        jdbc.query("""
                select stat_date, pv_count, uv_count from site_page_daily_stats
                where route_type=? and target_slug=? and is_demo=? and stat_date>=? and stat_date<=?
                """, rs -> {
            LocalDate date = rs.getObject("stat_date", LocalDate.class);
            trafficMap.put(date, new long[] { rs.getLong("pv_count"), rs.getLong("uv_count") });
        }, SiteAnalyticsService.ROUTE_SITE_TOTAL, SiteAnalyticsService.SLUG_SITE_TOTAL, demoFlag, prevStart, today);

        long periodPv = 0;
        long periodUv = 0;
        long prevPeriodPv = 0;
        long prevPeriodUv = 0;
        List<TrafficPoint> trafficSeries = new ArrayList<>(days);
        for (int i = 0; i < days; i++) {
            LocalDate prevDate = prevStart.plusDays(i);
            long[] prevVals = trafficMap.get(prevDate);
            if (prevVals != null) {
                prevPeriodPv += prevVals[0];
                prevPeriodUv += prevVals[1];
            }
            LocalDate date = start.plusDays(i);
            long[] curVals = trafficMap.getOrDefault(date, new long[] { 0L, 0L });
            periodPv += curVals[0];
            periodUv += curVals[1];
            trafficSeries.add(new TrafficPoint(date, curVals[0], curVals[1]));
        }

        // 2. Appointments time series & slot time-of-day distribution
        Map<LocalDate, long[]> apptBuckets = new LinkedHashMap<>();
        Map<String, Long> timeDistBuckets = new LinkedHashMap<>();
        long[] periodApptTotals = new long[] { 0L, 0L, 0L, 0L }; // count, prevCount, visitors, checkedInVisitors

        jdbc.query("""
                select s.visit_date, s.start_time, a.visitor_count, a.status
                from appointments a
                join appointment_slots s on s.id = a.slot_id
                where s.visit_date >= ? and s.visit_date <= ?
                """, rs -> {
            LocalDate visitDate = rs.getObject("visit_date", LocalDate.class);
            LocalTime startTime = rs.getTime("start_time").toLocalTime();
            int visitors = rs.getInt("visitor_count");
            String status = rs.getString("status");

            if (!visitDate.isBefore(start) && !visitDate.isAfter(today)) {
                long[] bucket = apptBuckets.computeIfAbsent(visitDate, k -> new long[4]);
                bucket[3] += 1; // bookingCount
                periodApptTotals[0] += 1;
                if ("CANCELLED".equals(status)) {
                    bucket[2] += visitors;
                } else {
                    bucket[0] += visitors;
                    periodApptTotals[2] += visitors;
                    if ("COMPLETED".equals(status)) {
                        bucket[1] += visitors;
                        periodApptTotals[3] += visitors;
                    }
                    String timeLabel = startTime.format(TIME_LABEL_FORMAT);
                    timeDistBuckets.merge(timeLabel, (long) visitors, Long::sum);
                }
            } else if (!visitDate.isBefore(prevStart) && !visitDate.isAfter(prevEnd)) {
                periodApptTotals[1] += 1;
            }
        }, prevStart, today);

        List<AppointmentPoint> appointmentSeries = new ArrayList<>(days);
        for (int i = 0; i < days; i++) {
            LocalDate date = start.plusDays(i);
            long[] b = apptBuckets.getOrDefault(date, new long[] { 0L, 0L, 0L, 0L });
            appointmentSeries.add(new AppointmentPoint(date, b[0], b[1], b[2], b[3]));
        }

        long distTotal = timeDistBuckets.values().stream().mapToLong(Long::longValue).sum();
        List<SlotTimeDist> slotTimeDistribution = timeDistBuckets.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(entry -> new SlotTimeDist(
                        entry.getKey(),
                        entry.getValue(),
                        distTotal > 0 ? roundRate(entry.getValue(), distTotal) : 0.0))
                .toList();

        // 3. Upcoming 14 days slot horizon
        Map<LocalDate, long[]> upcomingMap = new LinkedHashMap<>();
        jdbc.query("""
                select visit_date, sum(capacity) cap_sum, sum(reserved_people) res_sum, count(*) slot_cnt
                from appointment_slots
                where visit_date >= ? and visit_date <= ? and status = 'OPEN'
                group by visit_date
                """, rs -> {
            LocalDate date = rs.getObject("visit_date", LocalDate.class);
            upcomingMap.put(date, new long[] { rs.getLong("cap_sum"), rs.getLong("res_sum"), rs.getLong("slot_cnt") });
        }, today, today.plusDays(13));

        List<UpcomingDaySlot> upcomingSlots = IntStream.range(0, 14)
                .mapToObj(today::plusDays)
                .map(date -> {
                    long[] vals = upcomingMap.getOrDefault(date, new long[] { 0L, 0L, 0L });
                    double rate = vals[0] > 0 ? roundRate(vals[1], vals[0]) : 0.0;
                    return new UpcomingDaySlot(
                            date,
                            weekdayZh(date.getDayOfWeek()),
                            date.getDayOfWeek() == DayOfWeek.MONDAY,
                            vals[0],
                            vals[1],
                            (int) vals[2],
                            rate);
                })
                .toList();

        // 4. Sales time series (Java bucket by Asia/Shanghai LocalDate)
        Map<LocalDate, BigDecimal> salesAmountBuckets = new LinkedHashMap<>();
        Map<LocalDate, Long> salesOrderCountBuckets = new LinkedHashMap<>();
        final BigDecimal[] periodSalesSum = new BigDecimal[] { BigDecimal.ZERO, BigDecimal.ZERO };
        final long[] periodPaidOrders = new long[] { 0L };

        jdbc.query("""
                select payable_amount, coalesce(paid_at, created_at) as effective_at
                from orders
                where status in ('PAID', 'COMPLETED') and coalesce(paid_at, created_at) >= ? and coalesce(paid_at, created_at) < ?
                """, rs -> {
            Timestamp ts = rs.getTimestamp("effective_at");
            if (ts == null) return;
            LocalDate date = ts.toInstant().atZone(MUSEUM_ZONE).toLocalDate();
            BigDecimal amount = rs.getBigDecimal("payable_amount");
            if (amount == null) amount = BigDecimal.ZERO;
            if (!date.isBefore(start) && !date.isAfter(today)) {
                salesAmountBuckets.merge(date, amount, BigDecimal::add);
                salesOrderCountBuckets.merge(date, 1L, Long::sum);
                periodSalesSum[0] = periodSalesSum[0].add(amount);
                periodPaidOrders[0] += 1;
            } else if (!date.isBefore(prevStart) && !date.isAfter(prevEnd)) {
                periodSalesSum[1] = periodSalesSum[1].add(amount);
            }
        }, Timestamp.from(prevStart.atStartOfDay(MUSEUM_ZONE).toInstant()),
                Timestamp.from(today.plusDays(1).atStartOfDay(MUSEUM_ZONE).toInstant()));

        List<SalesPoint> salesSeries = new ArrayList<>(days);
        for (int i = 0; i < days; i++) {
            LocalDate date = start.plusDays(i);
            BigDecimal amount = salesAmountBuckets.getOrDefault(date, BigDecimal.ZERO);
            long count = salesOrderCountBuckets.getOrDefault(date, 0L);
            salesSeries.add(new SalesPoint(date, amount.setScale(2, RoundingMode.HALF_UP).toPlainString(), count));
        }

        // 5. New users in current vs previous window
        final long[] newUsers = new long[] { 0L, 0L };
        jdbc.query("""
                select created_at from users where deleted_at is null and created_at >= ? and created_at < ?
                """, rs -> {
            Timestamp ts = rs.getTimestamp("created_at");
            if (ts == null) return;
            LocalDate date = ts.toInstant().atZone(MUSEUM_ZONE).toLocalDate();
            if (!date.isBefore(start) && !date.isAfter(today)) newUsers[0] += 1;
            else if (!date.isBefore(prevStart) && !date.isAfter(prevEnd)) newUsers[1] += 1;
        }, Timestamp.from(prevStart.atStartOfDay(MUSEUM_ZONE).toInstant()),
                Timestamp.from(today.plusDays(1).atStartOfDay(MUSEUM_ZONE).toInstant()));

        // 6. Top content ranking
        List<TopContentItem> topContent = jdbc.query("""
                select route_type, target_slug, max(target_title) as title, sum(pv_count) as pv_sum, sum(uv_count) as uv_sum
                from site_page_daily_stats
                where stat_date >= ? and stat_date <= ? and is_demo = ?
                  and route_type in ('ARTIFACT', 'ARTICLE', 'EXHIBIT')
                group by route_type, target_slug
                order by pv_sum desc, uv_sum desc
                limit 6
                """, (rs, rowNum) -> {
            String slug = rs.getString("target_slug");
            String title = rs.getString("title");
            return new TopContentItem(
                    rs.getString("route_type"),
                    slug,
                    (title == null || title.isBlank()) ? slug : title,
                    rs.getLong("pv_sum"),
                    rs.getLong("uv_sum"));
        }, start, today, demoFlag);

        // 7. Global counts & todos
        long totalUsers = count("select count(*) from users where deleted_at is null");
        long publishedArtifacts = count("select count(*) from artifacts where deleted_at is null and status='PUBLISHED'");
        long publishedArticles = count("select count(*) from articles where deleted_at is null and status='PUBLISHED'");
        long publishedExhibits = count("select count(*) from exhibits_3d where deleted_at is null and status='PUBLISHED'");
        long pendingAppointments = count("select count(*) from appointments where status='PENDING'");
        Map<String, Long> orderStatusCounts = loadOrderStatusCounts();
        List<LowStockProduct> lowStockProducts = loadLowStockProducts(6);
        TodoCounts todoCounts = loadTodoCounts(
                pendingAppointments,
                orderStatusCounts.getOrDefault("PAID", 0L),
                loadLowStockProducts(100).size());

        double checkInRate = periodApptTotals[2] > 0 ? roundRate(periodApptTotals[3], periodApptTotals[2]) : 0.0;
        DashboardKpis kpis = new DashboardKpis(
                periodPv,
                prevPeriodPv,
                periodUv,
                prevPeriodUv,
                periodApptTotals[0],
                periodApptTotals[1],
                periodApptTotals[2],
                periodApptTotals[3],
                checkInRate,
                periodSalesSum[0].setScale(2, RoundingMode.HALF_UP).toPlainString(),
                periodSalesSum[1].setScale(2, RoundingMode.HALF_UP).toPlainString(),
                periodPaidOrders[0],
                newUsers[0],
                newUsers[1],
                totalUsers,
                publishedArtifacts,
                publishedArticles,
                publishedExhibits);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("rangeDays", days);
        result.put("hasRealTraffic", hasRealTraffic);
        result.put("hasDemoTraffic", hasDemoTraffic);
        result.put("usingDemoTraffic", usingDemoTraffic);
        result.put("kpis", kpis);
        result.put("trafficSeries", trafficSeries);
        result.put("appointmentSeries", appointmentSeries);
        result.put("upcomingSlots", upcomingSlots);
        result.put("salesSeries", salesSeries);
        result.put("orderStatusCounts", orderStatusCounts);
        result.put("topContent", topContent);
        result.put("slotTimeDistribution", slotTimeDistribution);
        result.put("todoCounts", todoCounts);
        result.put("lowStockProducts", lowStockProducts);
        return ApiResponse.ok(result, "admin-dashboard-analytics");
    }

    @PostMapping("/demo-analytics/seed")
    public ApiResponse<Map<String, Object>> seedDemoAnalytics(Authentication authentication) {
        long actorId = (Long) authentication.getPrincipal();
        int rows = analyticsService.seedDemoTraffic(actorId);
        operationLogService.record(actorId, "ANALYTICS", "DEMO_SEED", "ANALYTICS", String.valueOf(rows));
        return ApiResponse.ok(Map.of("seeded", true, "rows", rows), "admin-dashboard-demo-seed");
    }

    @DeleteMapping("/demo-analytics")
    public ApiResponse<Map<String, Object>> clearDemoAnalytics(Authentication authentication) {
        long actorId = (Long) authentication.getPrincipal();
        int removed = analyticsService.clearDemoTraffic();
        operationLogService.record(actorId, "ANALYTICS", "DEMO_CLEAR", "ANALYTICS", String.valueOf(removed));
        return ApiResponse.ok(Map.of("cleared", true, "removedRows", removed), "admin-dashboard-demo-clear");
    }

    private List<LowStockProduct> loadLowStockProducts(int limit) {
        return jdbc.query("""
                select id,sku,slug,name,stock_quantity,locked_stock from products
                where status='PUBLISHED' and deleted_at is null and stock_quantity-locked_stock<=5
                order by stock_quantity-locked_stock, id
                limit ?
                """, (rs, n) -> new LowStockProduct(
                rs.getLong("id"), rs.getString("sku"), rs.getString("slug"),
                rs.getString("name"), rs.getInt("stock_quantity"),
                Math.max(0, rs.getInt("stock_quantity") - rs.getInt("locked_stock"))), limit);
    }

    private Map<String, Long> loadOrderStatusCounts() {
        Map<String, Long> statuses = new LinkedHashMap<>();
        List.of("PENDING_PAYMENT", "PAID", "CANCELLED", "COMPLETED").forEach(status -> statuses.put(status, 0L));
        jdbc.query("select status,count(*) total from orders group by status", rs -> {
            statuses.put(rs.getString("status"), rs.getLong("total"));
        });
        return statuses;
    }

    private TodoCounts loadTodoCounts(long pendingAppointments, long paidOrders, long lowStockProducts) {
        long drafts = count("select count(*) from artifacts where deleted_at is null and status='DRAFT'")
                + count("select count(*) from articles where deleted_at is null and status='DRAFT'")
                + count("select count(*) from exhibits_3d where deleted_at is null and status='DRAFT'");
        long missingEn = count("select count(*) from artifacts where deleted_at is null and (title_en is null or trim(title_en)='' or summary_en is null or trim(summary_en)='')")
                + count("select count(*) from articles where deleted_at is null and (title_en is null or trim(title_en)='' or summary_en is null or trim(summary_en)='')");
        return new TodoCounts(pendingAppointments, paidOrders, lowStockProducts, drafts, missingEn);
    }

    private long count(String sql) {
        Long value = jdbc.queryForObject(sql, Long.class);
        return value == null ? 0L : value;
    }

    private static double roundRate(long part, long total) {
        if (total <= 0) return 0.0;
        return Math.round((part * 1000.0) / total) / 10.0;
    }

    private static String weekdayZh(DayOfWeek dow) {
        return switch (dow) {
            case MONDAY -> "周一";
            case TUESDAY -> "周二";
            case WEDNESDAY -> "周三";
            case THURSDAY -> "周四";
            case FRIDAY -> "周五";
            case SATURDAY -> "周六";
            case SUNDAY -> "周日";
        };
    }

    public record LowStockProduct(long id, String sku, String slug, String name, int stockQuantity, int availableStock) {}
    public record DaySlots(LocalDate visitDate, long capacity, long reservedPeople) {}
    public record TrafficPoint(LocalDate date, long pv, long uv) {}
    public record AppointmentPoint(LocalDate date, long bookedPeople, long checkedInPeople, long cancelledPeople, long bookingCount) {}
    public record UpcomingDaySlot(LocalDate visitDate, String weekdayLabel, boolean isClosedMonday, long capacity, long reservedPeople, int slotCount, double utilizationRate) {}
    public record SalesPoint(LocalDate date, String salesAmount, long orderCount) {}
    public record TopContentItem(String routeType, String slug, String title, long pv, long uv) {}
    public record SlotTimeDist(String timeLabel, long visitors, double share) {}
    public record TodoCounts(long pendingAppointments, long paidOrders, long lowStockProducts, long draftContents, long missingEnContents) {}
    public record DashboardKpis(
            long periodPv,
            long prevPeriodPv,
            long periodUv,
            long prevPeriodUv,
            long periodAppointments,
            long prevPeriodAppointments,
            long periodVisitors,
            long periodCheckedInVisitors,
            double checkInRate,
            String periodSalesAmount,
            String prevPeriodSalesAmount,
            long periodPaidOrders,
            long newUsersCount,
            long prevNewUsersCount,
            long totalUsers,
            long totalPublishedArtifacts,
            long totalPublishedArticles,
            long totalPublishedExhibits) {}
}
