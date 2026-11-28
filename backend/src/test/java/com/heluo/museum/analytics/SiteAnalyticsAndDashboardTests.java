package com.heluo.museum.analytics;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.profiles.active=test",
        "spring.datasource.url=jdbc:h2:mem:museum-analytics;MODE=MySQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE"
})
class SiteAnalyticsAndDashboardTests {
    @Autowired private TestRestTemplate restTemplate;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ObjectMapper mapper;

    @Test
    void pageViewDeduplicatesDailyUniqueVisitorsAndRejectsUnknownRouteType() throws Exception {
        String visitorA = "v-a-" + UUID.randomUUID();
        String visitorB = "v-b-" + UUID.randomUUID();
        String slug = "bronze-ding-" + UUID.randomUUID().toString().substring(0, 8);

        var first = restTemplate.postForEntity("/api/v1/analytics/page-view",
                Map.of("routeType", "ARTIFACT", "targetSlug", slug, "targetTitle", "河洛青铜鼎", "visitorId", visitorA),
                String.class);
        assertThat(first.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(first.getBody()).contains("\"recorded\":true");

        var duplicateVisitor = restTemplate.postForEntity("/api/v1/analytics/page-view",
                Map.of("routeType", "ARTIFACT", "targetSlug", slug, "targetTitle", "河洛青铜鼎", "visitorId", visitorA),
                String.class);
        assertThat(duplicateVisitor.getStatusCode()).isEqualTo(HttpStatus.OK);

        var secondVisitor = restTemplate.postForEntity("/api/v1/analytics/page-view",
                Map.of("routeType", "ARTIFACT", "targetSlug", slug, "targetTitle", "河洛青铜鼎", "visitorId", visitorB),
                String.class);
        assertThat(secondVisitor.getStatusCode()).isEqualTo(HttpStatus.OK);

        var row = jdbc.queryForMap(
                "select pv_count, uv_count from site_page_daily_stats where route_type='ARTIFACT' and target_slug=? and is_demo=0",
                slug);
        assertThat(((Number) row.get("pv_count")).intValue()).isEqualTo(3);
        assertThat(((Number) row.get("uv_count")).intValue()).isEqualTo(2);

        var invalid = restTemplate.postForEntity("/api/v1/analytics/page-view",
                Map.of("routeType", "UNKNOWN_PAGE", "targetSlug", slug),
                String.class);
        assertThat(invalid.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
    }

    @Test
    void analyticsDashboardRequiresAdminAndIsolatesDemoFromRealData() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String userToken = registerAndLogin("viewer_" + suffix);
        String adminToken = createAdminToken("analyst_" + suffix);

        HttpHeaders userHeaders = authHeaders(userToken);
        HttpHeaders adminHeaders = authHeaders(adminToken);

        assertThat(restTemplate.exchange("/api/v1/admin/dashboard/analytics?days=30",
                HttpMethod.GET, new HttpEntity<>(userHeaders), String.class).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(restTemplate.postForEntity("/api/v1/admin/dashboard/demo-analytics/seed",
                new HttpEntity<>(userHeaders), String.class).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(restTemplate.exchange("/api/v1/admin/dashboard/demo-analytics",
                HttpMethod.DELETE, new HttpEntity<>(userHeaders), String.class).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);

        var invalidRange = restTemplate.exchange("/api/v1/admin/dashboard/analytics?days=15",
                HttpMethod.GET, new HttpEntity<>(adminHeaders), String.class);
        assertThat(invalidRange.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);

        // Record one real view before seeding demo traffic
        String realSlug = "real-jade-" + suffix;
        restTemplate.postForEntity("/api/v1/analytics/page-view",
                Map.of("routeType", "ARTIFACT", "targetSlug", realSlug, "targetTitle", "真实玉璧", "visitorId", "real-v-" + suffix),
                String.class);

        var seedResp = restTemplate.postForEntity("/api/v1/admin/dashboard/demo-analytics/seed",
                new HttpEntity<>(adminHeaders), String.class);
        assertThat(seedResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(seedResp.getBody()).contains("\"seeded\":true");

        var demoView = restTemplate.exchange("/api/v1/admin/dashboard/analytics?days=7&includeDemo=true",
                HttpMethod.GET, new HttpEntity<>(adminHeaders), String.class);
        assertThat(demoView.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode demoData = mapper.readTree(demoView.getBody()).path("data");
        assertThat(demoData.path("rangeDays").asInt()).isEqualTo(7);
        assertThat(demoData.path("usingDemoTraffic").asBoolean()).isTrue();
        assertThat(demoData.path("trafficSeries").size()).isEqualTo(7);
        assertThat(demoData.path("appointmentSeries").size()).isEqualTo(7);
        assertThat(demoData.path("upcomingSlots").size()).isEqualTo(14);
        assertThat(demoData.path("salesSeries").size()).isEqualTo(7);
        assertThat(demoData.path("kpis").path("periodPv").asLong()).isGreaterThan(100L);
        assertThat(demoData.path("topContent").size()).isGreaterThan(0);

        var realView = restTemplate.exchange("/api/v1/admin/dashboard/analytics?days=30&includeDemo=false",
                HttpMethod.GET, new HttpEntity<>(adminHeaders), String.class);
        assertThat(realView.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode realData = mapper.readTree(realView.getBody()).path("data");
        assertThat(realData.path("usingDemoTraffic").asBoolean()).isFalse();
        assertThat(realData.path("hasRealTraffic").asBoolean()).isTrue();
        assertThat(realData.path("hasDemoTraffic").asBoolean()).isTrue();
        assertThat(realData.path("trafficSeries").size()).isEqualTo(30);
        assertThat(realData.path("topContent").toString()).contains(realSlug);

        var clearResp = restTemplate.exchange("/api/v1/admin/dashboard/demo-analytics",
                HttpMethod.DELETE, new HttpEntity<>(adminHeaders), String.class);
        assertThat(clearResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(clearResp.getBody()).contains("\"cleared\":true");

        assertThat(jdbc.queryForObject("select count(*) from site_page_daily_stats where is_demo=1", Integer.class))
                .isZero();
        assertThat(jdbc.queryForObject(
                "select count(*) from site_page_daily_stats where is_demo=0 and target_slug=?",
                Integer.class, realSlug)).isEqualTo(1);
    }

    private String registerAndLogin(String username) {
        HttpHeaders json = new HttpHeaders();
        json.setContentType(MediaType.APPLICATION_JSON);
        var reg = restTemplate.postForEntity("/api/v1/auth/register",
                new HttpEntity<>("{\"username\":\"" + username + "\",\"password\":\"SafePassword123\",\"nickname\":\"访客\"}", json),
                String.class);
        assertThat(reg.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        var login = restTemplate.postForEntity("/api/v1/auth/login",
                new HttpEntity<>("{\"username\":\"" + username + "\",\"password\":\"SafePassword123\"}", json),
                String.class);
        assertThat(login.getStatusCode()).isEqualTo(HttpStatus.OK);
        return login.getBody().replaceAll(".*\"accessToken\":\"([^\"]+)\".*", "$1");
    }

    private String createAdminToken(String username) {
        String password = "SafePassword123";
        jdbc.update("insert into users(username,password_hash,nickname,status) values(?,?,?,'ACTIVE')",
                username, new BCryptPasswordEncoder().encode(password), "数据管理员");
        long adminId = jdbc.queryForObject("select id from users where username=?", Long.class, username);
        jdbc.update("insert into user_roles(user_id,role_id,assigned_by) values(?,(select id from roles where code='ADMIN'),?)",
                adminId, adminId);
        HttpHeaders json = new HttpHeaders();
        json.setContentType(MediaType.APPLICATION_JSON);
        var login = restTemplate.postForEntity("/api/v1/auth/login",
                new HttpEntity<>("{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}", json),
                String.class);
        assertThat(login.getStatusCode()).isEqualTo(HttpStatus.OK);
        return login.getBody().replaceAll(".*\"accessToken\":\"([^\"]+)\".*", "$1");
    }

    private static HttpHeaders authHeaders(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }
}
