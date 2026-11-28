package com.heluo.museum.admin;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.heluo.museum.auth.JwtService;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.profiles.active=test",
        "spring.datasource.url=jdbc:h2:mem:museum-admin-phase3;MODE=MySQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE"
})
class AdminPhase3Tests {
    @Autowired private TestRestTemplate client;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private JwtService jwt;
    @Autowired private ObjectMapper mapper;

    @Test
    void forbidsNonAdminUsersFromPhase3AdminEndpoints() {
        var user = account(false);
        assertThat(client.exchange("/api/v1/admin/exhibits?keyword=test",
                HttpMethod.GET, new HttpEntity<>(user.headers()), String.class).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(client.exchange("/api/v1/admin/products?lowStock=true",
                HttpMethod.GET, new HttpEntity<>(user.headers()), String.class).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(client.exchange("/api/v1/admin/orders/1",
                HttpMethod.GET, new HttpEntity<>(user.headers()), String.class).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(client.exchange("/api/v1/admin/orders/export",
                HttpMethod.GET, new HttpEntity<>(user.headers()), String.class).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(client.exchange("/api/v1/admin/operation-logs?keyword=STORE",
                HttpMethod.GET, new HttpEntity<>(user.headers()), String.class).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(client.exchange("/api/v1/admin/users?status=ACTIVE",
                HttpMethod.GET, new HttpEntity<>(user.headers()), String.class).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void supportsExhibitSearchBilingualUpdateProductRestockOrderDetailCsvAndLogs() throws Exception {
        var admin = account(true);
        var buyer = account(false);

        // 1. Seed a category + artifact + exhibit, verify exhibit search & PATCH
        jdbc.update("insert into categories(code,name,description,sort_order,enabled,name_en) "
                        + "values('TESTBRONZE','测试青铜','描述',90,1,'Test Bronze') "
                        + "on duplicate key update name=name");
        long categoryId = jdbc.queryForObject("select id from categories where code='TESTBRONZE'", Long.class);
        String artifactSlug = "p3-ding-" + UUID.randomUUID().toString().substring(0, 8);
        jdbc.update("insert into artifacts(category_id,title,slug,summary,content,status,published_at,created_by,updated_by) "
                        + "values(?,?,?,?,?,'PUBLISHED',current_timestamp(3),?,?)",
                categoryId, "阶段三测试青铜鼎", artifactSlug, "摘要", "正文", admin.id(), admin.id());
        long artifactId = jdbc.queryForObject("select id from artifacts where slug=?", Long.class, artifactSlug);

        String exhibitSlug = "p3-exhibit-" + UUID.randomUUID().toString().substring(0, 8);
        var exCreate = client.postForEntity("/api/v1/admin/exhibits",
                new HttpEntity<>(Map.of(
                        "artifactId", artifactId,
                        "title", "阶段三3D展项",
                        "slug", exhibitSlug,
                        "modelUrl", "/media/models/p3.glb",
                        "modelSourceRef", "REF-" + exhibitSlug,
                        "modelFormat", "GLB",
                        "modelSizeBytes", 102400), admin.headers()),
                String.class);
        assertThat(exCreate.getStatusCode()).isEqualTo(HttpStatus.OK);
        long exhibitId = mapper.readTree(exCreate.getBody()).path("data").path("id").asLong();

        var exPatch = client.exchange("/api/v1/admin/exhibits/" + exhibitId, HttpMethod.PATCH,
                new HttpEntity<>(Map.of(
                        "artifactId", artifactId,
                        "title", "阶段三3D展项",
                        "titleEn", "Phase 3 3D Exhibit",
                        "summaryEn", "English exhibit summary",
                        "slug", exhibitSlug,
                        "modelUrl", "/media/models/p3.glb",
                        "modelSourceRef", "REF-" + exhibitSlug,
                        "modelFormat", "GLB",
                        "modelSizeBytes", 102400), admin.headers()),
                String.class);
        assertThat(exPatch.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(mapper.readTree(exPatch.getBody()).path("data").path("titleEn").asText())
                .isEqualTo("Phase 3 3D Exhibit");

        var exSearch = client.exchange("/api/v1/admin/exhibits?keyword=" + exhibitSlug + "&status=DRAFT",
                HttpMethod.GET, new HttpEntity<>(admin.headers()), String.class);
        assertThat(exSearch.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(mapper.readTree(exSearch.getBody()).path("data").path("total").asInt()).isEqualTo(1);

        // 2. Product create (low stock = 3), lowStock query, bilingual metadata update, restock
        String prodSlug = "p3-prod-" + UUID.randomUUID().toString().substring(0, 8);
        String sku = "SKU-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        var prodCreate = client.postForEntity("/api/v1/admin/products",
                new HttpEntity<>(Map.of(
                        "sku", sku,
                        "name", "=公式文创礼盒",
                        "slug", prodSlug,
                        "price", "88.00",
                        "stockQuantity", 3,
                        "summary", "低库存测试商品"), admin.headers()),
                String.class);
        assertThat(prodCreate.getStatusCode()).isEqualTo(HttpStatus.OK);
        long productId = mapper.readTree(prodCreate.getBody()).path("data").path("id").asLong();

        var lowStockResp = client.exchange("/api/v1/admin/products?lowStock=true&keyword=" + sku,
                HttpMethod.GET, new HttpEntity<>(admin.headers()), String.class);
        assertThat(lowStockResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(mapper.readTree(lowStockResp.getBody()).path("data").path("total").asInt()).isEqualTo(1);

        var prodPatch = client.exchange("/api/v1/admin/products/" + productId, HttpMethod.PATCH,
                new HttpEntity<>(Map.of(
                        "sku", sku,
                        "name", "=公式文创礼盒",
                        "nameEn", "Phase 3 Gift Box",
                        "slug", prodSlug,
                        "price", "88.00",
                        "stockQuantity", 3,
                        "categoryCode", "TESTBRONZE",
                        "inspirationArtifactSlug", artifactSlug), admin.headers()),
                String.class);
        assertThat(prodPatch.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode prodData = mapper.readTree(prodPatch.getBody()).path("data");
        assertThat(prodData.path("nameEn").asText()).isEqualTo("Phase 3 Gift Box");
        assertThat(prodData.path("inspirationArtifactSlug").asText()).isEqualTo(artifactSlug);

        var restockResp = client.exchange("/api/v1/admin/products/" + productId + "/stock", HttpMethod.PATCH,
                new HttpEntity<>(Map.of("stockQuantity", 13), admin.headers()), String.class);
        assertThat(restockResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(mapper.readTree(restockResp.getBody()).path("data").path("stockQuantity").asInt()).isEqualTo(13);

        client.postForEntity("/api/v1/admin/products/" + productId + "/on-shelf",
                new HttpEntity<>(admin.headers()), String.class);

        // 3. Checkout + pay + admin complete order -> inspect order detail timeline + CSV export
        var cartAdd = client.postForEntity("/api/v1/cart/items",
                new HttpEntity<>(Map.of("productId", productId, "quantity", 2), buyer.headers()), String.class);
        assertThat(cartAdd.getStatusCode()).isEqualTo(HttpStatus.OK);
        long cartItemId = mapper.readTree(cartAdd.getBody()).path("data").get(0).path("id").asLong();

        HttpHeaders checkoutHeaders = new HttpHeaders();
        checkoutHeaders.putAll(buyer.headers());
        checkoutHeaders.set("Idempotency-Key", UUID.randomUUID().toString());
        var orderCreate = client.postForEntity("/api/v1/orders",
                new HttpEntity<>(Map.of("cartItemIds", List.of(cartItemId), "notificationEmail", "buyer@example.test"), checkoutHeaders),
                String.class);
        assertThat(orderCreate.getStatusCode()).isEqualTo(HttpStatus.OK);
        long orderId = mapper.readTree(orderCreate.getBody()).path("data").path("id").asLong();
        String orderNo = mapper.readTree(orderCreate.getBody()).path("data").path("orderNo").asText();

        HttpHeaders payHeaders = new HttpHeaders();
        payHeaders.putAll(buyer.headers());
        payHeaders.set("Idempotency-Key", UUID.randomUUID().toString());
        var payResp = client.postForEntity("/api/v1/orders/" + orderId + "/mock-payment",
                new HttpEntity<>(payHeaders), String.class);
        assertThat(payResp.getStatusCode()).isEqualTo(HttpStatus.OK);

        var completeResp = client.postForEntity("/api/v1/admin/orders/" + orderId + "/complete",
                new HttpEntity<>(admin.headers()), String.class);
        assertThat(completeResp.getStatusCode()).isEqualTo(HttpStatus.OK);

        var detailResp = client.exchange("/api/v1/admin/orders/" + orderId,
                HttpMethod.GET, new HttpEntity<>(admin.headers()), String.class);
        assertThat(detailResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode detail = mapper.readTree(detailResp.getBody()).path("data");
        assertThat(detail.path("orderNo").asText()).isEqualTo(orderNo);
        assertThat(detail.path("status").asText()).isEqualTo("COMPLETED");
        assertThat(detail.path("paymentNo").asText()).startsWith("PM");
        assertThat(detail.path("paidAt").asText()).isNotBlank();
        assertThat(detail.path("completedAt").asText()).isNotBlank();
        assertThat(detail.path("items").size()).isEqualTo(1);
        assertThat(detail.path("items").get(0).path("quantity").asInt()).isEqualTo(2);

        // Search order by keyword
        var orderSearch = client.exchange("/api/v1/admin/orders?keyword=" + orderNo + "&status=COMPLETED",
                HttpMethod.GET, new HttpEntity<>(admin.headers()), String.class);
        assertThat(orderSearch.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(mapper.readTree(orderSearch.getBody()).path("data").path("total").asInt()).isEqualTo(1);

        // Export orders CSV with BOM and formula escape
        var exportResp = client.exchange("/api/v1/admin/orders/export?keyword=" + orderNo,
                HttpMethod.GET, new HttpEntity<>(admin.headers()), byte[].class);
        assertThat(exportResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(exportResp.getHeaders().getContentType().toString()).contains("text/csv");
        byte[] csvBytes = exportResp.getBody();
        assertThat(csvBytes).isNotNull();
        assertThat(csvBytes[0]).isEqualTo((byte) 0xEF);
        assertThat(csvBytes[1]).isEqualTo((byte) 0xBB);
        assertThat(csvBytes[2]).isEqualTo((byte) 0xBF);
        String csv = new String(csvBytes, StandardCharsets.UTF_8);
        assertThat(csv).contains(orderNo);
        assertThat(csv).contains("'=公式文创礼盒 × 2");

        // 4. Operation logs keyword + module query & Users status query
        var logsResp = client.exchange("/api/v1/admin/operation-logs?module=STORE&keyword=ORDER_COMPLETE",
                HttpMethod.GET, new HttpEntity<>(admin.headers()), String.class);
        assertThat(logsResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(mapper.readTree(logsResp.getBody()).path("data").path("total").asInt()).isGreaterThanOrEqualTo(1);

        var usersResp = client.exchange("/api/v1/admin/users?status=ACTIVE&keyword=" + buyer.username(),
                HttpMethod.GET, new HttpEntity<>(admin.headers()), String.class);
        assertThat(usersResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(mapper.readTree(usersResp.getBody()).path("data").path("total").asInt()).isEqualTo(1);
    }

    private Account account(boolean admin) {
        String name = "p3_" + UUID.randomUUID().toString().replace("-", "").substring(0, 14);
        jdbc.update("insert into users(username,password_hash,nickname,email) values(?,'unused-test-hash','Phase3',?)",
                name, name + "@example.test");
        long id = jdbc.queryForObject("select id from users where username=?", Long.class, name);
        jdbc.update("insert into user_roles(user_id,role_id) select ?,id from roles where code=?", id, admin ? "ADMIN" : "USER");
        var token = jwt.issue(id);
        jdbc.update("insert into auth_sessions(id,user_id,expires_at) values(?,?,?)", token.id(), id, Timestamp.from(token.expiresAt()));
        var headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(token.value());
        return new Account(id, name, headers);
    }

    private record Account(long id, String username, HttpHeaders headers) {}
}
