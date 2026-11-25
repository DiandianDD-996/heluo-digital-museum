package com.heluo.museum.admin;

import com.heluo.museum.common.api.ApiResponse;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/dashboard")
public class AdminDashboardController {
    private final JdbcTemplate jdbc;
    private final Clock clock;
    public AdminDashboardController(JdbcTemplate jdbc, Clock clock) { this.jdbc = jdbc; this.clock = clock; }
    @GetMapping("/summary")
    public ApiResponse<Map<String, Object>> summary() {
        long users = jdbc.queryForObject("select count(*) from users where deleted_at is null", Long.class);
        long appointments = jdbc.queryForObject("select count(*) from appointments", Long.class);
        long orders = jdbc.queryForObject("select count(*) from orders", Long.class);
        BigDecimal sales = jdbc.queryForObject("select coalesce(sum(payable_amount),0) from orders where status in ('PAID','COMPLETED')", BigDecimal.class);
        LocalDate today = LocalDate.now(clock);
        long pending = jdbc.queryForObject("select count(*) from appointments where status='PENDING'", Long.class);
        long checkedIn = jdbc.queryForObject("select count(*) from appointments where checked_in_at>=? and checked_in_at<?",
                Long.class, today.atStartOfDay(), today.plusDays(1).atStartOfDay());
        List<LowStockProduct> lowStock = jdbc.query("""
                select id,sku,slug,name,stock_quantity,locked_stock from products
                where status='PUBLISHED' and deleted_at is null and stock_quantity-locked_stock<=5
                order by stock_quantity-locked_stock, id
                """, (rs, n) -> new LowStockProduct(rs.getLong("id"), rs.getString("sku"), rs.getString("slug"),
                rs.getString("name"), rs.getInt("stock_quantity"), Math.max(0, rs.getInt("stock_quantity") - rs.getInt("locked_stock"))));
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
        Map<String, Long> statuses = new LinkedHashMap<>();
        List.of("PENDING_PAYMENT", "PAID", "CANCELLED", "COMPLETED").forEach(status -> statuses.put(status, 0L));
        jdbc.query("select status,count(*) total from orders group by status", rs -> {
            statuses.put(rs.getString("status"), rs.getLong("total"));
        });
        return ApiResponse.ok(Map.of("userCount", users, "appointmentCount", appointments, "orderCount", orders,
                "salesAmount", sales.toPlainString(), "pendingAppointmentCount", pending, "checkedInTodayCount", checkedIn,
                "lowStockProducts", lowStock, "upcoming7dSlots", upcoming, "orderStatusCounts", statuses), "admin-dashboard-summary");
    }
    public record LowStockProduct(long id, String sku, String slug, String name, int stockQuantity, int availableStock) {}
    public record DaySlots(LocalDate visitDate, long capacity, long reservedPeople) {}
}
