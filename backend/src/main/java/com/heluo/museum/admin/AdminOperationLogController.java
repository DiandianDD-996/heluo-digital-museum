package com.heluo.museum.admin;

import com.heluo.museum.common.api.ApiResponse;
import com.heluo.museum.common.error.ContentPage;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Read-only administrator audit trail. The /admin security rule is enforced centrally. */
@RestController
@RequestMapping("/api/v1/admin/operation-logs")
public class AdminOperationLogController {
    private static final ZoneId SHANGHAI_ZONE = ZoneId.of("Asia/Shanghai");

    private final JdbcTemplate jdbc;

    public AdminOperationLogController(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @GetMapping
    public ApiResponse<ContentPage<OperationLogView>> list(@RequestParam(defaultValue = "1") int page,
                                                           @RequestParam(defaultValue = "20") int size,
                                                           @RequestParam(required = false) String module,
                                                           @RequestParam(required = false) String action,
                                                           @RequestParam(required = false) String keyword,
                                                           @RequestParam(required = false) LocalDate dateFrom,
                                                           @RequestParam(required = false) LocalDate dateTo) {
        if (page < 1 || size < 1 || size > 100) throw new IllegalArgumentException("page 必须大于 0，size 必须在 1 到 100 之间");
        if (dateFrom != null && dateTo != null && dateTo.isBefore(dateFrom)) {
            throw new IllegalArgumentException("结束日期不能早于开始日期");
        }

        StringBuilder where = new StringBuilder(" where 1=1");
        List<Object> params = new ArrayList<>();
        if (module != null && !module.isBlank()) {
            where.append(" and l.module=?");
            params.add(module.trim().toUpperCase(Locale.ROOT));
        }
        if (action != null && !action.isBlank()) {
            where.append(" and l.action=?");
            params.add(action.trim().toUpperCase(Locale.ROOT));
        }
        if (dateFrom != null) {
            where.append(" and l.created_at>=?");
            params.add(Timestamp.from(dateFrom.atStartOfDay(SHANGHAI_ZONE).toInstant()));
        }
        if (dateTo != null) {
            where.append(" and l.created_at<?");
            params.add(Timestamp.from(dateTo.plusDays(1).atStartOfDay(SHANGHAI_ZONE).toInstant()));
        }
        if (keyword != null && !keyword.isBlank()) {
            String escaped = escapeLike(keyword.trim().toLowerCase(Locale.ROOT));
            String pattern = "%" + escaped + "%";
            where.append(" and (lower(coalesce(u.username,'系统')) like ? escape '\\'"
                    + " or lower(coalesce(u.nickname,'')) like ? escape '\\'"
                    + " or lower(l.module) like ? escape '\\'"
                    + " or lower(l.action) like ? escape '\\'"
                    + " or lower(l.target_type) like ? escape '\\'"
                    + " or lower(coalesce(l.target_id,'')) like ? escape '\\')");
            for (int i = 0; i < 6; i++) {
                params.add(pattern);
            }
        }

        long total = jdbc.queryForObject(
                "select count(*) from operation_logs l left join users u on u.id=l.actor_user_id" + where,
                Long.class, params.toArray());
        List<Object> args = new ArrayList<>(params);
        args.add(size);
        args.add((page - 1) * size);
        List<OperationLogView> items = jdbc.query(
                "select l.id,l.actor_user_id,l.module,l.action,l.target_type,l.target_id,l.created_at,u.username,u.nickname "
                        + "from operation_logs l left join users u on u.id=l.actor_user_id" + where
                        + " order by l.created_at desc,l.id desc limit ? offset ?",
                (rs, rowNum) -> new OperationLogView(
                        rs.getLong("id"),
                        rs.getObject("actor_user_id") == null ? null : ((Number) rs.getObject("actor_user_id")).longValue(),
                        rs.getString("username") == null ? "系统" : rs.getString("username"),
                        rs.getString("module"),
                        rs.getString("action"),
                        rs.getString("target_type"),
                        rs.getString("target_id"),
                        rs.getTimestamp("created_at").toInstant().toString()),
                args.toArray());
        return ApiResponse.ok(ContentPage.of(items, page, size, total), "admin-operation-logs");
    }

    private static String escapeLike(String raw) {
        return raw.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    public record OperationLogView(long id, Long actorUserId, String actorUsername, String module, String action,
                                   String targetType, String targetId, String createdAt) { }
}
