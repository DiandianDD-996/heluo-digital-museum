package com.heluo.museum.store;

import com.heluo.museum.common.api.ApiResponse;
import com.heluo.museum.common.audit.OperationLogService;
import com.heluo.museum.common.error.ConflictException;
import com.heluo.museum.common.error.ContentPage;
import com.heluo.museum.common.error.ResourceNotFoundException;
import com.heluo.museum.guide.GuideKnowledgeService;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin")
public class AdminStoreController {
    private static final ZoneId SHANGHAI_ZONE = ZoneId.of("Asia/Shanghai");
    private static final MediaType TEXT_CSV_UTF8 = MediaType.parseMediaType("text/csv; charset=UTF-8");
    private static final Set<String> VALID_PRODUCT_STATUSES = Set.of("DRAFT", "PUBLISHED", "WITHDRAWN");
    private static final Set<String> VALID_ORDER_STATUSES = Set.of("PENDING_PAYMENT", "PAID", "CANCELLED", "COMPLETED");

    private final JdbcTemplate jdbc;
    private final OperationLogService audit;
    private final GuideKnowledgeService guideKnowledge;

    public AdminStoreController(JdbcTemplate jdbc, OperationLogService audit, GuideKnowledgeService guideKnowledge) {
        this.guideKnowledge = guideKnowledge;
        this.jdbc = jdbc;
        this.audit = audit;
    }

    @GetMapping("/products")
    public ApiResponse<ContentPage<ProductAdminView>> products(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "all") String deleted,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Boolean lowStock) {
        validatePage(page, size);
        if (!"all".equals(deleted) && !"true".equals(deleted) && !"false".equals(deleted)) {
            throw new IllegalArgumentException("deleted 参数不合法");
        }
        String normalizedStatus = null;
        if (status != null && !status.isBlank()) {
            normalizedStatus = status.trim().toUpperCase(Locale.ROOT);
            if (!VALID_PRODUCT_STATUSES.contains(normalizedStatus)) {
                throw new IllegalArgumentException("商品状态不合法");
            }
        }
        List<String> clauses = new ArrayList<>();
        List<Object> filters = new ArrayList<>();
        if (!"all".equals(deleted)) {
            clauses.add("deleted_at is " + ("true".equals(deleted) ? "not null" : "null"));
        }
        if (Boolean.TRUE.equals(lowStock)) {
            clauses.add("deleted_at is null");
            clauses.add("(stock_quantity - locked_stock) <= 5");
        }
        if (normalizedStatus != null) {
            clauses.add("status=?");
            filters.add(normalizedStatus);
        }
        if (keyword != null && !keyword.isBlank()) {
            String escaped = escapeLike(keyword.trim().toLowerCase(Locale.ROOT));
            String pattern = "%" + escaped + "%";
            clauses.add("(lower(sku) like ? escape '\\'"
                    + " or lower(name) like ? escape '\\'"
                    + " or lower(coalesce(name_en,'')) like ? escape '\\'"
                    + " or lower(slug) like ? escape '\\'"
                    + " or lower(coalesce(summary,'')) like ? escape '\\')");
            for (int i = 0; i < 5; i++) {
                filters.add(pattern);
            }
        }

        String where = clauses.isEmpty() ? "" : " where " + String.join(" and ", clauses);
        long total = jdbc.queryForObject("select count(*) from products" + where, Long.class, filters.toArray());
        List<Object> args = new ArrayList<>(filters);
        args.add(size);
        args.add((page - 1) * size);
        List<ProductAdminView> items = jdbc.query(
                "select id,sku,name,slug,summary,description,price,stock_quantity,locked_stock,cover_image_url,status,deleted_at,"
                        + "name_en,summary_en,description_en,category_code,inspiration_artifact_slug "
                        + "from products" + where + " order by updated_at desc,id desc limit ? offset ?",
                (rs, n) -> view(rs), args.toArray());
        return ApiResponse.ok(ContentPage.of(items, page, size, total), "admin-products");
    }

    @PostMapping("/products")
    @Transactional
    public ApiResponse<ProductAdminView> create(Authentication authentication, @Valid @RequestBody ProductInput body) {
        if (count("select count(*) from products where sku=? or slug=?", body.sku(), body.slug()) > 0) {
            throw new ConflictException("SKU 或 URL 标识已存在");
        }
        long actor = actorId(authentication);
        jdbc.update("insert into products(sku,name,slug,summary,description,price,stock_quantity,cover_image_url,status,created_by,updated_by) "
                        + "values(?,?,?,?,?,?,?,?, 'DRAFT',?,?)", body.sku(), body.name(), body.slug(), blank(body.summary()),
                blank(body.description()), body.price(), body.stockQuantity(), blank(body.coverImageUrl()), actor, actor);
        long id = jdbc.queryForObject("select id from products where sku=?", Long.class, body.sku());
        updateProductMetadata(id, body);
        audit.record(actor, "STORE", "PRODUCT_CREATE", "PRODUCT", String.valueOf(id));
        guideKnowledge.invalidateAfterCommit();
        return ApiResponse.ok(product(id), "admin-product-create");
    }

    @PatchMapping("/products/{id}")
    @Transactional
    public ApiResponse<ProductAdminView> update(Authentication authentication, @PathVariable long id,
                                                @Valid @RequestBody ProductInput body) {
        ProductAdminView old = product(id);
        if (old.deleted()) throw new ConflictException("已删除商品必须先恢复");
        if (count("select count(*) from products where (sku=? or slug=?) and id<>?", body.sku(), body.slug(), id) > 0) {
            throw new ConflictException("SKU 或 URL 标识已存在");
        }
        long actor = actorId(authentication);
        int changed = jdbc.update("update products set sku=?,name=?,slug=?,summary=?,description=?,price=?,stock_quantity=?,cover_image_url=?,updated_by=? "
                        + "where id=? and deleted_at is null and locked_stock<=?", body.sku(), body.name(), body.slug(), blank(body.summary()),
                blank(body.description()), body.price(), body.stockQuantity(), blank(body.coverImageUrl()), actor, id, body.stockQuantity());
        if (changed == 0) throw new ConflictException("库存不能小于已锁定库存");
        updateProductMetadata(id, body);
        audit.record(actor, "STORE", "PRODUCT_UPDATE", "PRODUCT", String.valueOf(id));
        guideKnowledge.invalidateAfterCommit();
        return ApiResponse.ok(product(id), "admin-product-update");
    }

    @PatchMapping("/products/{id}/stock")
    public ApiResponse<ProductAdminView> updateStock(Authentication authentication, @PathVariable long id,
                                                     @Valid @RequestBody StockInput body) {
        ProductAdminView old = product(id);
        if (old.deleted()) throw new ConflictException("已删除商品必须先恢复");
        long actor = actorId(authentication);
        int changed = jdbc.update("update products set stock_quantity=?,updated_by=? where id=? and deleted_at is null and locked_stock<=?",
                body.stockQuantity(), actor, id, body.stockQuantity());
        if (changed == 0) throw new ConflictException("库存不能小于已锁定库存");
        audit.record(actor, "STORE", "PRODUCT_STOCK_UPDATE", "PRODUCT", String.valueOf(id));
        guideKnowledge.invalidateAfterCommit();
        return ApiResponse.ok(product(id), "admin-product-stock-update");
    }

    @PostMapping("/products/{id}/on-shelf")
    public ApiResponse<ProductAdminView> onShelf(Authentication authentication, @PathVariable long id) {
        ProductAdminView product = product(id);
        if (product.deleted()) throw new ConflictException("已删除商品不能上架");
        jdbc.update("update products set status='PUBLISHED',published_at=current_timestamp(3),updated_by=? where id=?",
                actorId(authentication), id);
        guideKnowledge.invalidateAfterCommit();
        return ApiResponse.ok(product(id), "admin-product-on-shelf");
    }

    @PostMapping("/products/{id}/off-shelf")
    public ApiResponse<ProductAdminView> offShelf(Authentication authentication, @PathVariable long id) {
        ProductAdminView product = product(id);
        if (product.deleted()) throw new ConflictException("已删除商品不能下架");
        jdbc.update("update products set status='WITHDRAWN',updated_by=? where id=?", actorId(authentication), id);
        guideKnowledge.invalidateAfterCommit();
        return ApiResponse.ok(product(id), "admin-product-off-shelf");
    }

    @DeleteMapping("/products/{id}")
    public ApiResponse<ProductAdminView> delete(Authentication authentication, @PathVariable long id) {
        ProductAdminView product = product(id);
        if (product.deleted()) throw new ConflictException("商品已在回收站");
        long actor = actorId(authentication);
        jdbc.update("update products set deleted_at=current_timestamp(3),deleted_by=?,updated_by=? where id=?", actor, actor, id);
        audit.record(actor, "STORE", "PRODUCT_DELETE", "PRODUCT", String.valueOf(id));
        guideKnowledge.invalidateAfterCommit();
        return ApiResponse.ok(product(id), "admin-product-delete");
    }

    @PostMapping("/products/{id}/restore")
    public ApiResponse<ProductAdminView> restore(Authentication authentication, @PathVariable long id) {
        ProductAdminView product = product(id);
        if (!product.deleted()) throw new ConflictException("商品不在回收站");
        jdbc.update("update products set deleted_at=null,deleted_by=null,status='WITHDRAWN',updated_by=? where id=?", actorId(authentication), id);
        guideKnowledge.invalidateAfterCommit();
        return ApiResponse.ok(product(id), "admin-product-restore");
    }

    @GetMapping("/orders")
    public ApiResponse<ContentPage<OrderAdminView>> orders(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) LocalDate dateFrom,
            @RequestParam(required = false) LocalDate dateTo) {
        validatePage(page, size);
        OrderFilter filter = buildOrderFilter(status, keyword, dateFrom, dateTo);
        long total = jdbc.queryForObject(
                "select count(*) from orders o left join users u on u.id=o.user_id" + filter.whereClause(),
                Long.class, filter.params().toArray());
        List<Object> args = new ArrayList<>(filter.params());
        args.add(size);
        args.add((page - 1) * size);
        List<OrderAdminView> items = jdbc.query(
                "select o.id,o.order_no,o.user_id,o.status,o.payable_amount,o.notification_email,o.created_at "
                        + "from orders o left join users u on u.id=o.user_id" + filter.whereClause()
                        + " order by o.created_at desc,o.id desc limit ? offset ?",
                (rs, n) -> orderView(rs), args.toArray());
        return ApiResponse.ok(ContentPage.of(items, page, size, total), "admin-orders");
    }

    @GetMapping("/orders/{id}")
    public ApiResponse<OrderDetailView> orderDetail(@PathVariable long id) {
        List<OrderDetailView> rows = jdbc.query(
                "select o.id,o.order_no,o.user_id,u.username,u.nickname,o.status,o.payable_amount,o.notification_email,"
                        + "o.cancel_reason,o.created_at,o.expires_at,o.paid_at,o.completed_at,o.cancelled_at "
                        + "from orders o left join users u on u.id=o.user_id where o.id=?",
                (rs, rowNum) -> {
                    long orderId = rs.getLong("id");
                    return new OrderDetailView(
                            orderId,
                            rs.getString("order_no"),
                            rs.getLong("user_id"),
                            empty(rs.getString("username")),
                            empty(rs.getString("nickname")),
                            rs.getString("status"),
                            rs.getBigDecimal("payable_amount").toPlainString(),
                            empty(rs.getString("notification_email")),
                            empty(rs.getString("cancel_reason")),
                            findPaymentNo(orderId),
                            isoOrEmpty(rs.getTimestamp("created_at")),
                            isoOrEmpty(rs.getTimestamp("expires_at")),
                            isoOrEmpty(rs.getTimestamp("paid_at")),
                            isoOrEmpty(rs.getTimestamp("completed_at")),
                            isoOrEmpty(rs.getTimestamp("cancelled_at")),
                            orderItems(orderId));
                }, id);
        if (rows.isEmpty()) {
            throw new ResourceNotFoundException("订单不存在");
        }
        return ApiResponse.ok(rows.get(0), "admin-order-detail");
    }

    @GetMapping("/orders/export")
    public ResponseEntity<byte[]> exportOrdersCsv(
            Authentication authentication,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) LocalDate dateFrom,
            @RequestParam(required = false) LocalDate dateTo) {
        OrderFilter filter = buildOrderFilter(status, keyword, dateFrom, dateTo);
        List<Object> args = new ArrayList<>(filter.params());
        args.add(5000);

        List<OrderExportRow> orders = jdbc.query(
                "select o.id,o.order_no,o.created_at,o.status,o.payable_amount,u.username,u.nickname,"
                        + "o.notification_email,o.paid_at,o.completed_at,o.cancel_reason "
                        + "from orders o left join users u on u.id=o.user_id" + filter.whereClause()
                        + " order by o.created_at desc,o.id desc limit ?",
                (rs, rowNum) -> new OrderExportRow(
                        rs.getLong("id"),
                        rs.getString("order_no"),
                        isoOrEmpty(rs.getTimestamp("created_at")),
                        rs.getString("status"),
                        rs.getBigDecimal("payable_amount").toPlainString(),
                        formatUserLabel(rs.getString("nickname"), rs.getString("username")),
                        empty(rs.getString("notification_email")),
                        isoOrEmpty(rs.getTimestamp("paid_at")),
                        isoOrEmpty(rs.getTimestamp("completed_at")),
                        empty(rs.getString("cancel_reason"))),
                args.toArray());

        Map<Long, String> itemSummaries = fetchItemSummaries(orders.stream().map(OrderExportRow::id).toList());

        StringBuilder csv = new StringBuilder("\uFEFF");
        csv.append("订单编号,下单时间,状态,应付金额,下单用户,通知邮箱,商品汇总,支付时间,完成时间,取消原因\r\n");
        for (OrderExportRow row : orders) {
            csv.append(csvCell(row.orderNo())).append(',')
                    .append(csvCell(row.createdAt())).append(',')
                    .append(csvCell(orderStatusLabel(row.status()))).append(',')
                    .append(csvCell(row.payableAmount())).append(',')
                    .append(csvCell(row.userLabel())).append(',')
                    .append(csvCell(row.notificationEmail())).append(',')
                    .append(csvCell(itemSummaries.getOrDefault(row.id(), ""))).append(',')
                    .append(csvCell(row.paidAt())).append(',')
                    .append(csvCell(row.completedAt())).append(',')
                    .append(csvCell(row.cancelReason())).append("\r\n");
        }

        String suffix = (dateFrom != null && dateTo != null) ? (dateFrom + "_to_" + dateTo) : "all";
        String filename = "heluo-orders-" + suffix + ".csv";
        audit.record(actorId(authentication), "STORE", "ORDER_EXPORT_CSV", "ORDER", suffix + ":" + orders.size());

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(TEXT_CSV_UTF8);
        headers.setContentDisposition(ContentDisposition.attachment().filename(filename, StandardCharsets.UTF_8).build());
        headers.setCacheControl(CacheControl.noStore());
        return ResponseEntity.ok().headers(headers).body(csv.toString().getBytes(StandardCharsets.UTF_8));
    }

    @PostMapping("/orders/{id}/complete")
    public ApiResponse<OrderAdminView> complete(Authentication authentication, @PathVariable long id) {
        OrderAdminView order = order(id);
        if (!"PAID".equals(order.status())) throw new ConflictException("只有已支付订单可以完成");
        long actor = actorId(authentication);
        jdbc.update("update orders set status='COMPLETED',completed_at=current_timestamp(3),status_updated_by=? where id=?", actor, id);
        audit.record(actor, "STORE", "ORDER_COMPLETE", "ORDER", String.valueOf(id));
        return ApiResponse.ok(order(id), "admin-order-complete");
    }

    private OrderFilter buildOrderFilter(String status, String keyword, LocalDate dateFrom, LocalDate dateTo) {
        if (dateFrom != null && dateTo != null && dateTo.isBefore(dateFrom)) {
            throw new IllegalArgumentException("结束日期不能早于开始日期");
        }
        StringBuilder where = new StringBuilder(" where 1=1");
        List<Object> params = new ArrayList<>();
        if (status != null && !status.isBlank()) {
            String normalizedStatus = status.trim().toUpperCase(Locale.ROOT);
            if (!VALID_ORDER_STATUSES.contains(normalizedStatus)) {
                throw new IllegalArgumentException("订单状态不合法");
            }
            where.append(" and o.status=?");
            params.add(normalizedStatus);
        }
        if (dateFrom != null) {
            where.append(" and o.created_at>=?");
            params.add(Timestamp.from(dateFrom.atStartOfDay(SHANGHAI_ZONE).toInstant()));
        }
        if (dateTo != null) {
            where.append(" and o.created_at<?");
            params.add(Timestamp.from(dateTo.plusDays(1).atStartOfDay(SHANGHAI_ZONE).toInstant()));
        }
        if (keyword != null && !keyword.isBlank()) {
            String escaped = escapeLike(keyword.trim().toLowerCase(Locale.ROOT));
            String pattern = "%" + escaped + "%";
            where.append(" and (lower(o.order_no) like ? escape '\\'"
                    + " or lower(coalesce(o.notification_email,'')) like ? escape '\\'"
                    + " or lower(coalesce(u.username,'')) like ? escape '\\'"
                    + " or lower(coalesce(u.nickname,'')) like ? escape '\\')");
            for (int i = 0; i < 4; i++) {
                params.add(pattern);
            }
        }
        return new OrderFilter(where.toString(), params);
    }

    private String findPaymentNo(long orderId) {
        List<String> list = jdbc.query(
                "select payment_no from payment_transactions where order_id=? and status='SUCCEEDED' order by id desc limit 1",
                (rs, rowNum) -> rs.getString(1), orderId);
        return list.isEmpty() ? "" : empty(list.get(0));
    }

    private List<OrderItemDetail> orderItems(long orderId) {
        return jdbc.query(
                "select product_id,product_sku_snapshot,product_name_snapshot,product_cover_url_snapshot,"
                        + "unit_price,quantity,subtotal_amount from order_items where order_id=? order by id",
                (rs, rowNum) -> new OrderItemDetail(
                        rs.getLong("product_id"),
                        rs.getString("product_sku_snapshot"),
                        rs.getString("product_name_snapshot"),
                        empty(rs.getString("product_cover_url_snapshot")),
                        rs.getBigDecimal("unit_price").toPlainString(),
                        rs.getInt("quantity"),
                        rs.getBigDecimal("subtotal_amount").toPlainString()),
                orderId);
    }

    private Map<Long, String> fetchItemSummaries(List<Long> orderIds) {
        if (orderIds.isEmpty()) return Map.of();
        String marks = String.join(",", Collections.nCopies(orderIds.size(), "?"));
        Map<Long, List<String>> grouped = new HashMap<>();
        jdbc.query(
                "select order_id,product_name_snapshot,quantity from order_items where order_id in (" + marks + ") order by id",
                rs -> {
                    long oid = rs.getLong("order_id");
                    String entry = rs.getString("product_name_snapshot") + " × " + rs.getInt("quantity");
                    grouped.computeIfAbsent(oid, k -> new ArrayList<>()).add(entry);
                },
                orderIds.toArray());
        Map<Long, String> summaries = new HashMap<>();
        for (Map.Entry<Long, List<String>> e : grouped.entrySet()) {
            summaries.put(e.getKey(), String.join("；", e.getValue()));
        }
        return summaries;
    }

    private long count(String sql, Object... args) { return jdbc.queryForObject(sql, Long.class, args); }

    private ProductAdminView product(long id) {
        List<ProductAdminView> rows = jdbc.query("select id,sku,name,slug,summary,description,price,stock_quantity,locked_stock,cover_image_url,status,deleted_at,"
                        + "name_en,summary_en,description_en,category_code,inspiration_artifact_slug from products where id=?",
                (rs, n) -> view(rs), id);
        if (rows.isEmpty()) throw new ResourceNotFoundException("商品不存在");
        return rows.get(0);
    }

    private ProductAdminView view(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new ProductAdminView(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getString(4), rs.getString(5),
                rs.getString(6), rs.getBigDecimal(7).toPlainString(), rs.getInt(8), rs.getInt(9), rs.getString(10),
                rs.getString(11), rs.getTimestamp(12) != null, rs.getString(13), rs.getString(14), rs.getString(15),
                rs.getString(16), rs.getString(17));
    }

    private void updateProductMetadata(long id, ProductInput body) {
        if (body.inspirationArtifactSlug() != null && !body.inspirationArtifactSlug().isEmpty()
                && count("select count(*) from artifacts where slug=? and deleted_at is null", body.inspirationArtifactSlug()) == 0) {
            throw new ResourceNotFoundException("关联文物不存在");
        }
        jdbc.update("update products set name_en=coalesce(?,name_en),summary_en=coalesce(?,summary_en),"
                        + "description_en=coalesce(?,description_en),category_code=coalesce(?,category_code),"
                        + "inspiration_artifact_slug=coalesce(?,inspiration_artifact_slug) where id=?",
                body.nameEn(), body.summaryEn(), body.descriptionEn(), body.categoryCode(), body.inspirationArtifactSlug(), id);
    }

    private OrderAdminView order(long id) {
        List<OrderAdminView> rows = jdbc.query("select id,order_no,user_id,status,payable_amount,notification_email,created_at from orders where id=?",
                (rs, n) -> orderView(rs), id);
        if (rows.isEmpty()) throw new ResourceNotFoundException("订单不存在");
        return rows.get(0);
    }

    private static OrderAdminView orderView(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new OrderAdminView(rs.getLong(1), rs.getString(2), rs.getLong(3), rs.getString(4), rs.getBigDecimal(5).toPlainString(),
                rs.getString(6), rs.getTimestamp(7).toInstant().toString());
    }

    private static String escapeLike(String raw) {
        return raw.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    private static String csvCell(String raw) {
        String value = raw == null ? "" : raw;
        String trimmed = value.stripLeading();
        if (!trimmed.isEmpty()) {
            char first = trimmed.charAt(0);
            if (first == '=' || first == '+' || first == '-' || first == '@' || first == '\t' || first == '\r') {
                value = "'" + value;
            }
        }
        return "\"" + value.replace("\"", "\"\"") + "\"";
    }

    private static String orderStatusLabel(String status) {
        return switch (status) {
            case "PENDING_PAYMENT" -> "待支付";
            case "PAID" -> "已支付";
            case "COMPLETED" -> "已完成";
            case "CANCELLED" -> "已取消";
            default -> status;
        };
    }

    private static String formatUserLabel(String nickname, String username) {
        String nick = empty(nickname);
        String user = empty(username);
        if (nick.isEmpty()) return user;
        if (user.isEmpty()) return nick;
        return nick + " (@" + user + ")";
    }

    private static String isoOrEmpty(Timestamp ts) {
        return ts == null ? "" : ts.toInstant().toString();
    }

    private static String empty(String value) {
        return value == null ? "" : value;
    }

    private static void validatePage(int page, int size) {
        if (page < 1 || size < 1 || size > 100) throw new IllegalArgumentException("page 必须大于 0，size 必须在 1 到 100 之间");
    }

    private static long actorId(Authentication authentication) { return (Long) authentication.getPrincipal(); }
    private static String blank(String value) { return value == null || value.isBlank() ? null : value.trim(); }

    private record OrderFilter(String whereClause, List<Object> params) {}
    private record OrderExportRow(long id, String orderNo, String createdAt, String status, String payableAmount,
                                  String userLabel, String notificationEmail, String paidAt, String completedAt,
                                  String cancelReason) {}

    public record ProductAdminView(long id, String sku, String name, String slug, String summary, String description,
                                   String price, int stockQuantity, int lockedStock, String coverImageUrl, String status,
                                   boolean deleted, String nameEn, String summaryEn, String descriptionEn,
                                   String categoryCode, String inspirationArtifactSlug) {}
    public record OrderAdminView(long id, String orderNo, long userId, String status, String payableAmount,
                                 String notificationEmail, String createdAt) {}
    public record OrderItemDetail(long productId, String sku, String name, String coverImageUrl,
                                  String unitPrice, int quantity, String subtotalAmount) {}
    public record OrderDetailView(long id, String orderNo, long userId, String username, String userNickname,
                                  String status, String payableAmount, String notificationEmail, String cancelReason,
                                  String paymentNo, String createdAt, String expiresAt, String paidAt,
                                  String completedAt, String cancelledAt, List<OrderItemDetail> items) {}
    public record ProductInput(@NotBlank @Size(max = 64) String sku, @NotBlank @Size(max = 150) String name,
                               @NotBlank @Pattern(regexp = "[a-z0-9-]{3,180}") String slug, @Size(max = 500) String summary,
                               String description, @NotNull @DecimalMin("0.01") BigDecimal price, @Min(0) int stockQuantity,
                               @Size(max = 500) String coverImageUrl, @Size(max = 300) String nameEn,
                               @Size(max = 1000) String summaryEn, @Size(max = 16000) String descriptionEn,
                               @Pattern(regexp = "[A-Z0-9_]{0,40}") String categoryCode,
                               @Pattern(regexp = "[a-z0-9-]{0,120}") String inspirationArtifactSlug) {}
    public record StockInput(@Min(0) int stockQuantity) {}
}
