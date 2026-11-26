package com.heluo.museum.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class VisitGuideBookingWindowMigrationTests {
    private static final String GUIDE = "visit-and-digital-guide";
    private static final String OLD_ENGLISH = "Plan your visit with our 14-day booking window, 1–30 visitor rules, 3D hall controls, and recommended routes.";
    private static final String OLD_PARAGRAPH = "河洛数字博物馆的公开入馆预约窗口为“今天起未来 14 天”，系统仅展示状态为开放且仍有余量的时段；";
    private static final String NEW_PARAGRAPH = "公开预约可查询今天起未来 365 天内的时段，系统仅展示状态为开放且仍有余量的时段；";

    private DriverManagerDataSource source;
    private JdbcTemplate db;

    @BeforeEach void prepareV30() {
        String id = UUID.randomUUID().toString().replace("-", "");
        String password = System.getenv("HELUO_MIGRATION_MYSQL_PASSWORD");
        source = password == null
            ? new DriverManagerDataSource("jdbc:h2:mem:visit-guide-" + id + ";MODE=MySQL;DB_CLOSE_DELAY=-1", "sa", "")
            : new DriverManagerDataSource("jdbc:mysql://127.0.0.1:13306/museum_visit_guide_test_" + id
                + "?createDatabaseIfNotExist=true&characterEncoding=utf8&serverTimezone=UTC&useSSL=false&allowPublicKeyRetrieval=true", "root", password);
        migrateTo("26");
        db = new JdbcTemplate(source);
        db.update("insert into users(id,username,password_hash,nickname) values(1,'fixture','unused','fixture')");
        db.update("insert into categories(id,code,name) values(1,'RIVER','fixture')");
        migrateTo("30");
    }

    @Test void updatesOnlyObsoleteCopyWithoutChangingBookingRecords() {
        String oldContent = db.queryForObject("select content from articles where slug=?", String.class, GUIDE);
        assertThat(oldContent).contains(OLD_PARAGRAPH);
        String editorNote = "\n\n馆员补记：本段须完整保留。";
        db.update("update articles set content=? where slug=?", oldContent + editorNote, GUIDE);
        db.update("""
                insert into appointment_slots(id,visit_date,start_time,end_time,capacity,reserved_people,status,created_by,updated_by)
                values(1,'2026-12-04','09:00:00','10:30:00',17,3,'CLOSED',1,1)
                """);
        db.update("""
                insert into appointments(id,appointment_no,user_id,slot_id,visitor_count,contact_name,contact_phone,contact_email,status)
                values(1,'FIXTURE-1',1,1,3,'Fixture','00000000000','fixture@example.test','CONFIRMED')
                """);
        var slots = db.queryForList("select * from appointment_slots");
        var bookings = db.queryForList("select * from appointments");

        migrateTo("31");

        var guide = db.queryForMap("select summary,summary_en,content from articles where slug=?", GUIDE);
        assertThat((String) guide.get("summary")).contains("未来 365 天").doesNotContain("未来 14 天");
        assertThat((String) guide.get("summary_en")).contains("365-day booking search window");
        assertThat(guide.get("content")).isEqualTo(oldContent.replace(OLD_PARAGRAPH, NEW_PARAGRAPH) + editorNote);
        assertThat(db.queryForList("select * from appointment_slots")).isEqualTo(slots);
        assertThat(db.queryForList("select * from appointments")).isEqualTo(bookings);
    }

    @Test void preservesEditorCopyIncludingCaseOnlyChanges() {
        assertThat(db.queryForObject("select summary_en from articles where slug=?", String.class, GUIDE))
            .isEqualTo(OLD_ENGLISH);
        db.update("update articles set summary=?,summary_en=?,content=? where slug=?", "馆员摘要",
            "plan" + OLD_ENGLISH.substring(4), "馆员正文", GUIDE);
        var before = db.queryForMap("select * from articles where slug=?", GUIDE);

        migrateTo("31");

        assertThat(db.queryForMap("select * from articles where slug=?", GUIDE)).isEqualTo(before);
    }

    private void migrateTo(String version) {
        Flyway.configure().dataSource(source).target(version).load().migrate();
    }
}
