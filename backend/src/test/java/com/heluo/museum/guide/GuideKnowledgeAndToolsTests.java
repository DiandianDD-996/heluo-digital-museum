package com.heluo.museum.guide;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.heluo.museum.guide.GuideEvidenceReader.Claim;
import com.heluo.museum.guide.GuideEvidenceReader.Evidence;
import com.heluo.museum.guide.GuideEvidenceVisibility.Card;
import com.heluo.museum.guide.GuideEvidenceVisibility.Status;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.HexFormat;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class GuideKnowledgeAndToolsTests {

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private ObjectMapper objectMapper;

    private Clock fixedClock;
    private long adminId;
    private long bronzeCategoryId;
    private long disabledCategoryId;

    @BeforeEach
    void setUp() {
        fixedClock = Clock.fixed(Instant.parse("2026-11-23T02:00:00Z"), ZoneId.of("Asia/Shanghai")); // 10:00 CST

        jdbc.update("insert into users(username,password_hash,nickname,status) values('guide_test_admin','hash','Admin','ACTIVE')");
        adminId = jdbc.queryForObject("select id from users where username='guide_test_admin'", Long.class);

        jdbc.update("insert into categories(code,name,description,sort_order,enabled) values('TEST_BRONZE','青铜测试','desc',1,1)");
        bronzeCategoryId = jdbc.queryForObject("select id from categories where code='TEST_BRONZE'", Long.class);

        jdbc.update("insert into categories(code,name,description,sort_order,enabled) values('TEST_DISABLED','停用分类','desc',2,0)");
        disabledCategoryId = jdbc.queryForObject("select id from categories where code='TEST_DISABLED'", Long.class);

        // Published artifact + 3D exhibit
        jdbc.update("""
                insert into artifacts(category_id,title,title_en,slug,period,material,summary,summary_en,content,status,published_at,created_by,updated_by)
                values(?,?,?,?,?,?,?,?,?,'PUBLISHED',current_timestamp(3),?,?)
                """, bronzeCategoryId, "河洛青铜鼎（数字重制）", "Heluo Bronze Ding", "test-bronze-ding",
                "商代安阳时期", "青铜", "三足青铜鼎摘要", "Bronze tripod summary", "完整青铜鼎策展正文内容", adminId, adminId);
        long dingId = jdbc.queryForObject("select id from artifacts where slug='test-bronze-ding'", Long.class);

        jdbc.update("""
                insert into exhibits_3d(artifact_id,title,slug,summary,description,model_url,model_format,model_size_bytes,model_source_ref,
                    display_no,source_credit,source_url,license_label,collection_location,status,published_at,created_by,updated_by)
                values(?,?,?,?,?,?, 'GLB', 1024, 'MOD-TEST-DING', 'HL-3D-001', 'Cleveland Museum of Art', 'https://www.clevelandart.org/art/1962.281',
                    'CC0', 'Digital Hall', 'PUBLISHED', current_timestamp(3), ?, ?)
                """, dingId, "河洛青铜鼎 3D", "test-bronze-ding-3d", "3D 展项摘要", "3D 展项说明", "/media/test.glb", adminId, adminId);

        // Draft artifact (must stay invisible)
        jdbc.update("""
                insert into artifacts(category_id,title,slug,summary,content,status,created_by,updated_by)
                values(?,?,?, ?, ?, 'DRAFT', ?, ?)
                """, bronzeCategoryId, "草稿器物", "test-draft-item", "草稿摘要", "草稿正文", adminId, adminId);

        // Soft-deleted artifact (must stay invisible)
        jdbc.update("""
                insert into artifacts(category_id,title,slug,summary,content,status,published_at,deleted_at,created_by,updated_by)
                values(?,?,?, ?, ?, 'PUBLISHED', current_timestamp(3), current_timestamp(3), ?, ?)
                """, bronzeCategoryId, "已删器物", "test-deleted-item", "已删摘要", "已删正文", adminId, adminId);

        // Disabled category artifact (must stay invisible)
        jdbc.update("""
                insert into artifacts(category_id,title,slug,summary,content,status,published_at,created_by,updated_by)
                values(?,?,?, ?, ?, 'PUBLISHED', current_timestamp(3), ?, ?)
                """, disabledCategoryId, "停用分类器物", "test-disabled-cat-item", "摘要", "正文", adminId, adminId);

        // Published article
        jdbc.update("""
                insert into articles(category_id,title,title_en,slug,summary,summary_en,content,author_display,status,published_at,created_by,updated_by)
                values(?,?,?,?,?,?,?,?, 'PUBLISHED', current_timestamp(3), ?, ?)
                """, bronzeCategoryId, "河洛水纹专题", "Heluo Water Motif Study", "test-water-article",
                "水纹文化摘要", "Water motif summary", "水纹专题完整正文", "河洛策展组", adminId, adminId);

        // Published product
        jdbc.update("""
                insert into products(sku,name,slug,summary,description,price,stock_quantity,locked_stock,status,published_at,created_by,updated_by)
                values('SKU-TEST-01','青铜鼎书签','test-ding-bookmark','黄铜书签摘要','书签详情',58.00,20,3,'PUBLISHED',current_timestamp(3),?,?)
                """, adminId, adminId);

        // Appointment slots relative to 2026-11-23 10:00 CST
        LocalDate today = LocalDate.of(2026, 11, 23);
        jdbc.update("insert into appointment_slots(visit_date,start_time,end_time,capacity,reserved_people,status,created_by,updated_by) values(?,?,?,?,?,'OPEN',?,?)",
                today, LocalTime.of(9, 0), LocalTime.of(10, 0), 30, 5, adminId, adminId); // expired today
        jdbc.update("insert into appointment_slots(visit_date,start_time,end_time,capacity,reserved_people,status,created_by,updated_by) values(?,?,?,?,?,'OPEN',?,?)",
                today, LocalTime.of(14, 0), LocalTime.of(16, 0), 30, 20, adminId, adminId); // 10 remaining
        jdbc.update("insert into appointment_slots(visit_date,start_time,end_time,capacity,reserved_people,status,created_by,updated_by) values(?,?,?,?,?,'OPEN',?,?)",
                today.plusDays(1), LocalTime.of(10, 0), LocalTime.of(12, 0), 30, 30, adminId, adminId); // full
        jdbc.update("insert into appointment_slots(visit_date,start_time,end_time,capacity,reserved_people,status,created_by,updated_by) values(?,?,?,?,?,'OPEN',?,?)",
                today.plusDays(1), LocalTime.of(14, 0), LocalTime.of(16, 0), 40, 15, adminId, adminId); // 25 remaining
        jdbc.update("insert into appointment_slots(visit_date,start_time,end_time,capacity,reserved_people,status,created_by,updated_by) values(?,?,?,?,?,'OPEN',?,?)",
                today.plusDays(13), LocalTime.of(10, 0), LocalTime.of(12, 0), 30, 0, adminId, adminId); // last valid day
    }

    @Test
    void knowledgeServiceExposesOnlyPublishedEnabledContentAndCachesCleanly() {
        var service = new GuideKnowledgeService(jdbc, fixedClock, (GuideEvidenceReader) null);

        assertThat(service.findArtifact("test-bronze-ding")).isPresent();
        assertThat(service.findArtifact("test-bronze-ding").orElseThrow().exhibitSlug()).isEqualTo("test-bronze-ding-3d");
        assertThat(service.findArtifact("test-draft-item")).isEmpty();
        assertThat(service.findArtifact("test-deleted-item")).isEmpty();
        assertThat(service.findArtifact("test-disabled-cat-item")).isEmpty();
        assertThat(service.findArticle("test-water-article")).isPresent();
        assertThat(service.findProduct("test-ding-bookmark")).isPresent();
        assertThat(service.findProduct("test-ding-bookmark").orElseThrow().availableStock()).isEqualTo(17);

        var hits = service.searchCatalog("水纹");
        assertThat(hits).extracting(GuideKnowledgeService.SearchHit::slug).contains("test-water-article");
        assertThat(hits).extracting(GuideKnowledgeService.SearchHit::slug)
                .doesNotContain("test-draft-item", "test-deleted-item", "test-disabled-cat-item");
    }

    @Test
    void evidencePackEnforcesSha256MinimumVersionAndConflictBlocking(@TempDir Path tempDir) throws Exception {
        String validPack = """
                {
                  "formatVersion": 2,
                  "releaseVersion": 5,
                  "cards": [
                    {
                      "id": "LS-TEST-1",
                      "revision": 1,
                      "exhibitSlug": "test-bronze-ding-3d",
                      "artifactSlug": "test-bronze-ding",
                      "locale": "zh-CN",
                      "status": "PUBLISHED",
                      "spoken": ["第一张卡口语正文。"],
                      "boundary": ["边界说明。"],
                      "aliases": ["测试"],
                      "publicSource": "https://www.clevelandart.org/art/1962.281",
                      "publishedAt": "2026-11-22T00:00:00Z"
                    }
                  ]
                }
                """;
        Path packFile = tempDir.resolve("pack.json");
        Path minVerFile = tempDir.resolve("min.txt");
        Path digestFile = tempDir.resolve("pack.sha256");
        Files.writeString(packFile, validPack, StandardCharsets.UTF_8);
        Files.writeString(minVerFile, "5\n", StandardCharsets.US_ASCII);
        String sha = HexFormat.of().formatHex(
                MessageDigest.getInstance("SHA-256").digest(validPack.getBytes(StandardCharsets.UTF_8)));
        Files.writeString(digestFile, sha + "\n", StandardCharsets.US_ASCII);

        GuideProperties props = new GuideProperties();
        props.setPackPath(packFile.toString());
        props.setMinimumVersionPath(minVerFile.toString());
        props.setApprovedDigestPath(digestFile.toString());

        var service = new GuideKnowledgeService(jdbc, fixedClock, props);
        assertThat(service.evidenceCards("test-bronze-ding-3d")).hasSize(1);

        // Anti-rollback: bump min version above pack releaseVersion -> fails closed
        Files.writeString(minVerFile, "6\n", StandardCharsets.US_ASCII);
        assertThat(service.evidenceCards("test-bronze-ding-3d")).isEmpty();

        // Restore min version, tamper pack bytes -> SHA-256 mismatch fails closed
        Files.writeString(minVerFile, "5\n", StandardCharsets.US_ASCII);
        Files.writeString(packFile, validPack + " ", StandardCharsets.UTF_8);
        assertThat(service.evidenceCards("test-bronze-ding-3d")).isEmpty();

        // ADR-006 conflict blocking: two cards sharing claim.key with different values are excluded
        var visibility = new GuideEvidenceVisibility(jdbc, fixedClock);
        var conflictReader = new GuideEvidenceReader((exhibit, locale) -> List.of(
                new Evidence(new Card("C1", 1, "test-bronze-ding-3d", "test-bronze-ding", "zh-CN",
                        Status.PUBLISHED, Instant.parse("2026-11-22T00:00:00Z"), null),
                        "年代甲", List.of("年代"), null, new Claim("period", "商代")),
                new Evidence(new Card("C2", 1, "test-bronze-ding-3d", "test-bronze-ding", "zh-CN",
                        Status.PUBLISHED, Instant.parse("2026-11-22T00:00:00Z"), null),
                        "年代乙", List.of("年代"), null, new Claim("period", "周代")),
                new Evidence(new Card("C3", 1, "test-bronze-ding-3d", "test-bronze-ding", "zh-CN",
                        Status.PUBLISHED, Instant.parse("2026-11-22T00:00:00Z"), null),
                        "材质说明", List.of("材质"), null, new Claim("material", "青铜"))
        ), visibility);
        var conflictService = new GuideKnowledgeService(jdbc, fixedClock, conflictReader);
        assertThat(conflictService.evidenceCards("test-bronze-ding-3d"))
                .extracting(e -> e.card().id())
                .containsExactly("C3");
    }

    @Test
    void toolsEnforceAppointmentWindowPeopleLimitsAndAuditSources() throws Exception {
        var knowledge = new GuideKnowledgeService(jdbc, fixedClock, (GuideEvidenceReader) null);
        var executor = new GuideToolExecutor(knowledge, jdbc, fixedClock, objectMapper);
        var audit = new GuideToolExecutor.ToolAuditContext();

        // 1. get_museum_item_detail for published artifact
        JsonNode detail = objectMapper.readTree(
                executor.execute("get_museum_item_detail", "{\"type\":\"artifact\",\"slug\":\"test-bronze-ding\"}", audit));
        assertThat(detail.get("ok").asBoolean()).isTrue();
        assertThat(detail.get("content").asText()).contains("完整青铜鼎策展正文内容");
        assertThat(audit.allowedCitations()).containsKey("ARTIFACT:test-bronze-ding");

        // Unpublished item rejected
        JsonNode draft = objectMapper.readTree(
                executor.execute("get_museum_item_detail", "{\"type\":\"artifact\",\"slug\":\"test-draft-item\"}", audit));
        assertThat(draft.get("ok").asBoolean()).isFalse();

        // 2. query_appointment_slots today filters expired 09:00 slot and returns 14:00 slot
        JsonNode todaySlots = objectMapper.readTree(
                executor.execute("query_appointment_slots", "{\"date\":\"2026-11-23\",\"people\":5}", audit));
        assertThat(todaySlots.get("ok").asBoolean()).isTrue();
        assertThat(todaySlots.get("count").asInt()).isEqualTo(1);
        assertThat(todaySlots.get("slots").get(0).get("startTime").asText()).isEqualTo("14:00");

        // Day 14 (today + 13 = 2026-12-06) is valid
        JsonNode edgeValid = objectMapper.readTree(
                executor.execute("query_appointment_slots", "{\"date\":\"2026-12-06\"}", audit));
        assertThat(edgeValid.get("ok").asBoolean()).isTrue();
        assertThat(edgeValid.get("count").asInt()).isEqualTo(1);

        // Day 15 (today + 14 = 2026-12-07) is rejected as OUT_OF_OPEN_WINDOW
        JsonNode edgeInvalid = objectMapper.readTree(
                executor.execute("query_appointment_slots", "{\"date\":\"2026-12-07\"}", audit));
        assertThat(edgeInvalid.get("ok").asBoolean()).isFalse();
        assertThat(edgeInvalid.get("error").asText()).isEqualTo("OUT_OF_OPEN_WINDOW");

        // People > 30 rejected
        JsonNode tooMany = objectMapper.readTree(
                executor.execute("query_appointment_slots", "{\"date\":\"2026-11-24\",\"people\":35}", audit));
        assertThat(tooMany.get("ok").asBoolean()).isFalse();
        assertThat(tooMany.get("error").asText()).isEqualTo("PEOPLE_OUT_OF_RANGE");

        // People = 0 rejected
        JsonNode zeroPeople = objectMapper.readTree(
                executor.execute("query_appointment_slots", "{\"date\":\"2026-11-24\",\"people\":0}", audit));
        assertThat(zeroPeople.get("ok").asBoolean()).isFalse();
        assertThat(zeroPeople.get("error").asText()).isEqualTo("PEOPLE_OUT_OF_RANGE");

        // 3. search_museum_catalog
        JsonNode search = objectMapper.readTree(
                executor.execute("search_museum_catalog", "{\"keyword\":\"书签\"}", audit));
        assertThat(search.get("ok").asBoolean()).isTrue();
        assertThat(search.get("count").asInt()).isEqualTo(1);
        assertThat(audit.allowedCitations()).containsKey("PRODUCT:test-ding-bookmark");

        // 4. get_museum_item_detail supports product
        JsonNode productDetail = objectMapper.readTree(
                executor.execute("get_museum_item_detail", "{\"type\":\"product\",\"slug\":\"test-ding-bookmark\"}", audit));
        assertThat(productDetail.get("ok").asBoolean()).isTrue();
        assertThat(productDetail.get("sku").asText()).isEqualTo("SKU-TEST-01");
        assertThat(productDetail.get("availableStock").asInt()).isEqualTo(17);

        // 5. query_appointment_slots provides nextAvailableSlots when requested date has zero matching slots
        JsonNode emptyDay = objectMapper.readTree(
                executor.execute("query_appointment_slots", "{\"date\":\"2026-11-25\",\"people\":2}", audit));
        assertThat(emptyDay.get("ok").asBoolean()).isTrue();
        assertThat(emptyDay.get("count").asInt()).isEqualTo(0);
        assertThat(emptyDay.get("nextAvailableSlots").size()).isGreaterThan(0);
    }

    @Test
    void rateLimiterIsStatelessAndDeduplicatesRequestIds() {
        var mutableNow = new Instant[]{Instant.parse("2026-11-23T02:00:00Z")};
        Clock movingClock = new Clock() {
            @Override public ZoneId getZone() { return ZoneId.of("UTC"); }
            @Override public Clock withZone(ZoneId zone) { return this; }
            @Override public Instant instant() { return mutableNow[0]; }
        };

        var limiter = new GuideRateLimiter(movingClock, 3);
        assertThat(limiter.tryAcquire("127.0.0.1")).isTrue();
        assertThat(limiter.tryAcquire("127.0.0.1")).isTrue();
        assertThat(limiter.tryAcquire("127.0.0.1")).isTrue();
        assertThat(limiter.tryAcquire("127.0.0.1")).isFalse();
        assertThat(limiter.tryAcquire("10.0.0.2")).isTrue();

        // Advance past 60s window
        mutableNow[0] = mutableNow[0].plusSeconds(61);
        assertThat(limiter.tryAcquire("127.0.0.1")).isTrue();

        assertThat(limiter.markRequestIdIfNew("req-1")).isTrue();
        assertThat(limiter.markRequestIdIfNew("req-1")).isFalse();
        assertThat(limiter.markRequestIdIfNew("req-2")).isTrue();
    }
}
