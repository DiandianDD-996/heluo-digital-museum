package com.heluo.museum.config;

import java.time.Clock;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Creates only local development data when explicitly enabled through environment variables.
 * No password is embedded in source code, migrations, or image layers.
 * Editorial copy is loaded from the single source of truth {@code content/seed-editorial-copy.json}.
 */
@Component
@ConditionalOnProperty(name = "museum.bootstrap.enabled", havingValue = "true")
public class BootstrapDataInitializer implements CommandLineRunner {
    private final JdbcTemplate jdbc;
    private final String username;
    private final String password;
    private final String email;
    private final Clock clock;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    BootstrapDataInitializer(JdbcTemplate jdbc, Clock clock,
                             @Value("${museum.bootstrap.admin-username:}") String username,
                             @Value("${museum.bootstrap.admin-password:}") String password,
                             @Value("${museum.bootstrap.admin-email:}") String email) {
        this.jdbc = jdbc;
        this.clock = clock;
        this.username = username;
        this.password = password;
        this.email = email;
    }

    @Override
    @Transactional
    public void run(String... args) {
        if (username.isBlank() || password.isBlank()) {
            throw new IllegalStateException("启用 MUSEUM_BOOTSTRAP_ENABLED 时必须设置管理员用户名和密码");
        }
        long adminId = createOrLocateAdmin();
        createCategories();
        createArtifacts(adminId);
        createExhibit(adminId);
        createArticles(adminId);
        createAppointmentSlots(adminId);
        createProducts(adminId);
    }

    private long createOrLocateAdmin() {
        Long existingId = jdbc.query("select id from users where username=?", (rs, rowNum) -> rs.getLong(1), username)
                .stream().findFirst().orElse(null);
        long adminId;
        if (existingId == null) {
            jdbc.update("insert into users(username,password_hash,nickname,email,status) values(?,?,?,?, 'ACTIVE')",
                    username, passwordEncoder.encode(password), "博物馆管理员", email.isBlank() ? null : email.trim());
            adminId = jdbc.queryForObject("select id from users where username=?", Long.class, username);
        } else {
            adminId = existingId;
        }
        long adminRoleId = jdbc.queryForObject("select id from roles where code='ADMIN'", Long.class);
        Integer hasRole = jdbc.queryForObject("select count(*) from user_roles where user_id=? and role_id=?", Integer.class,
                adminId, adminRoleId);
        if (hasRole != null && hasRole == 0) {
            jdbc.update("insert into user_roles(user_id,role_id) values(?,?)", adminId, adminRoleId);
        }
        return adminId;
    }

    private void createCategories() {
        insertCategory("BRONZE", "青铜礼器", "从器形、纹样与礼制故事认识河洛文化中的青铜意象。", 10,
                "Ritual Bronzes", "Read ritual vessels through silhouette, ornament, and the craft of casting.");
        insertCategory("JADE", "玉石意象", "用轻量故事化内容了解玉礼、符号与古人的精神表达。", 20,
                "Jade and Ritual", "Explore symmetry, light, and ritual imagination through jade forms.");
        insertCategory("RIVER", "河洛故事", "从河流、图纹和生活器物出发，连接传统文化与今天。", 30,
                "Stories of the Heluo Rivers", "Follow water, vessels, and patterns through the landscapes and stories of Heluo.");
    }

    private void insertCategory(String code, String name, String description, int sortOrder, String nameEn, String descriptionEn) {
        if (count("select count(*) from categories where code=?", code) == 0) {
            jdbc.update("insert into categories(code,name,description,sort_order,enabled,name_en,description_zh,description_en) values(?,?,?,?,1,?,?,?)",
                    code, name, description, sortOrder, nameEn, description, descriptionEn);
        }
    }

    private void createArtifacts(long adminId) {
        insertArtifact(adminId, "BRONZE", "河洛青铜鼎（数字重制）", "heluo-bronze-ding",
                "原件年代见来源馆藏记录", "青铜意象（数字材质）",
                "/media/exhibits/heluo-bronze-ding-v5.4-cover.webp", "IMG-MODEL-HELUO-BRONZE-DING-V5-4",
                "从三足、器腹与器表纹样近观一件鼎。基于 Cleveland Museum of Art 1962.281 的 CC0 模型进行项目数字重制。");
        insertArtifact(adminId, "BRONZE", "河洛纹青铜爵（概念展品）", "heluo-bronze-jue",
                "青铜时代意象", "青铜", "/media/exhibits/bronze-jue-cover.webp", "IMG-EXHIBIT-BRONZE-JUE",
                "一件以河洛纹样为灵感的原创概念器物，用轻量的故事入口带你观察器形与纹样。");
        insertArtifact(adminId, "JADE", "河图玉璧（概念展品）", "river-map-jade-bi",
                "传统玉礼意象", "玉石", "/media/exhibits/jade-bi-cover.webp", "IMG-EXHIBIT-JADE-BI",
                "圆形与中孔构成克制的视觉秩序，邀请你从“礼”和“象征”理解玉的文化表达。");
        insertArtifact(adminId, "RIVER", "彩陶水纹罐（概念展品）", "painted-pottery-water-jar",
                "史前生活意象", "陶", "/media/exhibits/painted-pottery-jar-cover.webp", "IMG-EXHIBIT-POTTERY-JAR",
                "水纹与器形结合，让日常容器成为记录生活节奏的一页。");
        insertArtifact(adminId, "RIVER", "河洛图纹石板（概念展品）", "river-map-pattern-stone",
                "河洛符号意象", "石", "/media/exhibits/river-map-stone-cover.webp", "IMG-EXHIBIT-RIVER-STONE",
                "抽象图纹把河流、方位与秩序的想象浓缩在一块可近观的石板上。");
        insertArtifact(adminId, "BRONZE", "水鸟青铜雕塑（概念展品）", "water-bird-bronze",
                "动物纹样意象", "青铜", "/media/exhibits/water-bird-bronze-cover.webp", "IMG-EXHIBIT-WATER-BIRD",
                "以水鸟姿态连接自然观察与古代器物的想象。");
    }

    private void insertArtifact(long adminId, String categoryCode, String title, String slug, String period, String material,
                                String coverUrl, String assetRef, String summary) {
        if (count("select count(*) from artifacts where slug=?", slug) > 0) {
            return;
        }
        long categoryId = jdbc.queryForObject("select id from categories where code=?", Long.class, categoryCode);
        var seed = SeedEditorialContent.artifact(slug);
        jdbc.update("insert into artifacts(category_id,title,slug,period,material,dimensions,collection_location,cover_image_url,cover_asset_ref,summary,content,"
                        + "status,published_at,created_by,updated_by,title_en,summary_en) values(?,?,?,?,?,?,?,?,?,?,?,'PUBLISHED',current_timestamp(3),?,?,?,?)",
                categoryId, title, slug, period, material, seed.dimensions(), seed.collectionLocation(),
                coverUrl, assetRef, summary, seed.content(), adminId, adminId,
                SeedContentEnglish.forSlug(slug).title(), SeedContentEnglish.forSlug(slug).summary());
        var copy = BootstrapBilingualDefaults.get(slug);
        jdbc.update("update artifacts set content_en=?,period_en=?,material_en=? where slug=?",
                copy.contentEn(), copy.periodEn(), copy.materialEn(), slug);
    }

    private void createArticles(long adminId) {
        insertArticle(adminId, "BRONZE", "第一次看青铜器，可以从哪三个问题开始？", "how-to-read-bronze",
                "/media/exhibits/bronze-jue-cover.webp", "IMG-EXHIBIT-BRONZE-JUE",
                "不用先背年代和术语：从器形、纹样和使用场景三个问题，建立自己的观察路径。",
                "河洛数字博物馆");
        insertArticle(adminId, "RIVER", "把河流看成一条时间线：河洛文化的年轻化阅读", "river-as-timeline",
                "/media/exhibits/river-map-stone-cover.webp", "IMG-EXHIBIT-RIVER-STONE",
                "从水、聚落和纹样的联系出发，让传统文化不再只是书本上的名词。",
                "河洛数字博物馆");
        insertArticle(adminId, "JADE", "为什么“留白”让一件展品更容易被看见？", "why-negative-space-matters",
                "/media/exhibits/jade-bi-cover.webp", "IMG-EXHIBIT-JADE-BI",
                "数字展览不靠信息堆叠，而让器物、文字与视线之间保留呼吸感。",
                "河洛数字博物馆");
        insertArticle(adminId, "RIVER", "参观与数字导览须知：规划你的河洛博物馆之旅", "visit-and-digital-guide",
                "/media/exhibits/painted-pottery-jar-cover.webp", "IMG-EXHIBIT-POTTERY-JAR",
                "一文了解未来 365 天预约查询窗口、单笔 1–30 人规则、3D 展厅操作与推荐游览动线。",
                "河洛数字博物馆");
    }

    private void createExhibit(long adminId) {
        String slug = "heluo-bronze-ding-3d";
        if (count("select count(*) from exhibits_3d where slug=?", slug) == 0) {
            var seed = SeedEditorialContent.exhibit(slug);
            long artifactId = jdbc.queryForObject("select id from artifacts where slug='heluo-bronze-ding'", Long.class);
            jdbc.update("insert into exhibits_3d(artifact_id,title,title_en,slug,summary,summary_en,description,model_url,model_source_ref,model_format,model_size_bytes,mobile_model_url,mobile_model_size_bytes,cover_image_url,cover_asset_ref,status,published_at,created_by,updated_by) "
                            + "values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'PUBLISHED',current_timestamp(3),?,?)", artifactId,
                    seed.title(), seed.titleEn(), slug, seed.summary(), seed.summaryEn(), seed.description(),
                    "/media/models/heluo-bronze-ding-v5.5.glb", "MODEL-HELUO-BRONZE-DING-V5-5-CMA-1962-281-CC0-CENTERLINE-FIX", "GLB", 5213372L,
                    "/media/models/heluo-bronze-ding-v5.5-mobile.glb", 837720L,
                    "/media/exhibits/heluo-bronze-ding-v5.4-cover.webp", "IMG-MODEL-HELUO-BRONZE-DING-V5-4", adminId, adminId);
            jdbc.update("update exhibits_3d set display_no=?,source_credit=?,source_url=?,license_label=?,collection_location=? where slug=?",
                    seed.displayNo(), "Cleveland Museum of Art · 1962.281 CC0 reference", "https://www.clevelandart.org/art/1962.281",
                    "CC0 reference · project reconstruction", "河洛数字博物馆 · 深墨青铜厅", slug);
            jdbc.update("update exhibits_3d set description_en=? where slug=?", BootstrapBilingualDefaults.get(slug).descriptionEn(), slug);
        }

        String stoneSlug = "river-map-stone-raking";
        if (count("select count(*) from exhibits_3d where slug=?", stoneSlug) == 0
                && count("select count(*) from artifacts where slug='river-map-pattern-stone'") > 0) {
            var stoneSeed = SeedEditorialContent.exhibit(stoneSlug);
            long stoneArtifactId = jdbc.queryForObject("select id from artifacts where slug='river-map-pattern-stone'", Long.class);
            jdbc.update("insert into exhibits_3d(artifact_id,title,title_en,slug,summary,summary_en,description,model_url,model_source_ref,model_format,model_size_bytes,cover_image_url,cover_asset_ref,status,published_at,created_by,updated_by) "
                            + "values(?,?,?,?,?,?,?,?,?,?,?,?,?, 'PUBLISHED', TIMESTAMP '2026-01-01 00:00:00', ?, ?)",
                    stoneArtifactId, stoneSeed.title(), stoneSeed.titleEn(), stoneSlug,
                    stoneSeed.summary(), stoneSeed.summaryEn(), stoneSeed.description(),
                    "/media/editorial/explore-river-map-stone-user-v2.webp", "PLATE-RIVER-MAP-STONE-RAKING-V1", "GLB", 51274L,
                    "/media/editorial/explore-river-map-stone-user-v2.webp", "IMG-EDITORIAL-RIVER-MAP-STONE-V2", adminId, adminId);
            jdbc.update("update exhibits_3d set display_no=?,source_credit=?,source_url=?,license_label=?,collection_location=? where slug=?",
                    stoneSeed.displayNo(), "河洛数字博物馆 · 原创概念光学展项", "",
                    "Original curatorial concept · WebGL raking-light stage", "河洛数字博物馆 · 金石光学检视室", stoneSlug);
            jdbc.update("update exhibits_3d set description_en=? where slug=?", BootstrapBilingualDefaults.get(stoneSlug).descriptionEn(), stoneSlug);
        }
    }

    private void createAppointmentSlots(long adminId) {
        LocalDate today = LocalDate.now(clock);
        LocalDate end = today.plusDays(364L);
        Set<String> existingKeys = new HashSet<>(jdbc.query(
                "select visit_date,start_time,end_time from appointment_slots where visit_date between ? and ?",
                (rs, rowNum) -> rs.getDate(1).toLocalDate() + "|"
                        + rs.getTime(2).toLocalTime() + "|"
                        + rs.getTime(3).toLocalTime(),
                today, end));

        record SessionWindow(LocalTime start, LocalTime end, int capacity) {}
        List<SessionWindow> sessions = List.of(
                new SessionWindow(LocalTime.of(9, 0), LocalTime.of(10, 30), 40),
                new SessionWindow(LocalTime.of(10, 30), LocalTime.of(12, 0), 40),
                new SessionWindow(LocalTime.of(13, 30), LocalTime.of(15, 0), 40),
                new SessionWindow(LocalTime.of(15, 15), LocalTime.of(16, 45), 40));

        List<Object[]> batchRows = new ArrayList<>(1260);
        for (int offset = 0; offset < 365; offset++) {
            LocalDate date = today.plusDays(offset);
            if (date.getDayOfWeek() == DayOfWeek.MONDAY) {
                continue;
            }
            for (SessionWindow session : sessions) {
                String key = date + "|" + session.start() + "|" + session.end();
                if (!existingKeys.contains(key)) {
                    batchRows.add(new Object[] {
                            date, session.start(), session.end(), session.capacity(), adminId, adminId
                    });
                }
            }
        }
        if (!batchRows.isEmpty()) {
            jdbc.batchUpdate(
                    "insert into appointment_slots(visit_date,start_time,end_time,capacity,status,created_by,updated_by) "
                            + "values(?,?,?,?, 'OPEN',?,?)",
                    batchRows);
        }
    }

    private void createProducts(long adminId) {
        insertProduct(adminId, "HL-NOTEBOOK-01", "河图纹笔记本", "river-map-notebook",
                "把河洛图纹带进每天的记录与灵感。", "39.00", 30, "/media/products/river-map-notebook.webp", "IMG-PRODUCT-NOTEBOOK");
        insertProduct(adminId, "HL-SCARF-01", "河洛水系丝巾", "heluo-silk-scarf",
                "以河流的流线和深墨绿为灵感的原创概念丝巾。", "129.00", 20, "/media/products/heluo-silk-scarf.webp", "IMG-PRODUCT-SCARF");
        insertProduct(adminId, "HL-CUP-01", "河流纹茶杯套装", "river-line-teacup-set",
                "让日常饮茶也保留一段关于河流的想象。", "89.00", 15, "/media/products/river-line-teacup-set.webp", "IMG-PRODUCT-CUP");
    }

    private void insertProduct(long adminId, String sku, String name, String slug, String summary, String price, int stock, String coverUrl, String assetRef) {
        if (count("select count(*) from products where slug=?", slug) > 0) return;
        var seed = SeedEditorialContent.product(slug);
        jdbc.update("insert into products(sku,name,name_en,slug,summary,summary_en,description,price,stock_quantity,cover_image_url,cover_asset_ref,status,published_at,created_by,updated_by) values(?,?,?,?,?,?,?,?,?,?,?,'PUBLISHED',current_timestamp(3),?,?)",
                sku, name, seed.nameEn(), slug, summary, seed.summaryEn(), seed.description(),
                new java.math.BigDecimal(price), stock, coverUrl, assetRef, adminId, adminId);
        var copy = BootstrapBilingualDefaults.get(slug);
        jdbc.update("update products set description_en=?,category_code=?,inspiration_artifact_slug=? where slug=?",
                copy.descriptionEn(), copy.categoryCode(), copy.inspirationArtifactSlug(), slug);
    }

    private void insertArticle(long adminId, String categoryCode, String title, String slug, String coverUrl, String assetRef,
                               String summary, String author) {
        if (count("select count(*) from articles where slug=?", slug) > 0) {
            return;
        }
        long categoryId = jdbc.queryForObject("select id from categories where code=?", Long.class, categoryCode);
        var seed = SeedEditorialContent.article(slug);
        jdbc.update("insert into articles(category_id,title,slug,cover_image_url,cover_asset_ref,summary,content,author_display,"
                        + "status,published_at,created_by,updated_by,title_en,summary_en) values(?,?,?,?,?,?,?,?, 'PUBLISHED',current_timestamp(3),?,?,?,?)",
                categoryId, title, slug, coverUrl, assetRef, summary, seed.content(), author, adminId, adminId,
                SeedContentEnglish.forSlug(slug).title(), SeedContentEnglish.forSlug(slug).summary());
        jdbc.update("update articles set content_en=? where slug=?", BootstrapBilingualDefaults.get(slug).contentEn(), slug);
    }

    private long count(String sql, Object... values) {
        return jdbc.queryForObject(sql, Long.class, values);
    }
}
