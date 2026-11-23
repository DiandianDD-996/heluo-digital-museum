package com.heluo.museum.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class BilingualMigrationTests {
    @Test void v27OnlyReplacesExactHistoricalValuesIndependently() {
        var source = new DriverManagerDataSource("jdbc:h2:mem:v27-" + UUID.randomUUID()
            + ";MODE=MySQL;DB_CLOSE_DELAY=-1", "sa", "");
        Flyway.configure().dataSource(source).target("14").load().migrate();
        var db = new JdbcTemplate(source);
        db.update("insert into users(id,username,password_hash,nickname) values(1,'fixture','unused','fixture')");
        db.update("insert into categories(id,code,name) values(1,'BRONZE','fixture')");
        for (String slug : new String[]{"water-bird-bronze", "heluo-bronze-jue"}) {
            db.update("insert into artifacts(category_id,title,slug,summary,content,created_by,updated_by) values(1,?,?,'summary','initial',1,1)", slug, slug);
        }
        db.update("insert into exhibits_3d(artifact_id,title,slug,model_url,model_source_ref,model_size_bytes,created_by,updated_by) values(1,'fixture','heluo-bronze-ding-3d','/m','fixture',1,1,1)");
        Flyway.configure().dataSource(source).target("26").load().migrate();
        String oldBird = db.queryForObject("select content from artifacts where slug='water-bird-bronze'", String.class);
        assertThat(oldBird).startsWith("观察入口｜先看姿态");
        String edited = oldBird + " 馆员补记 ";
        db.update("update artifacts set content=? where slug='water-bird-bronze'", edited);
        db.update("update exhibits_3d set summary=' 馆员摘要 '");
        Flyway.configure().dataSource(source).load().migrate();
        assertThat(db.queryForObject("select summary from exhibits_3d", String.class)).isEqualTo(" 馆员摘要 ");
        assertThat(db.queryForObject("select description from exhibits_3d", String.class)).contains("该版本为项目数字重制");
        assertThat(db.queryForObject("select content from artifacts where slug='water-bird-bronze'", String.class)).isEqualTo(edited);
        assertThat(db.queryForObject("select content from artifacts where slug='heluo-bronze-jue'", String.class))
            .contains("观察入口｜从轮廓读懂上张下稳");
    }

    @Test void upgradesOldSchemaAndPreservesExistingTranslationsAndChineseContent() {
        String password = System.getenv("HELUO_MIGRATION_MYSQL_PASSWORD");
        String id = UUID.randomUUID().toString().replace("-", "");
        var source = password == null
            ? new DriverManagerDataSource("jdbc:h2:mem:bilingual-migration-" + id + ";MODE=MySQL;DB_CLOSE_DELAY=-1", "sa", "")
            : new DriverManagerDataSource("jdbc:mysql://127.0.0.1:13306/museum_translation_test_" + id
                + "?createDatabaseIfNotExist=true&useUnicode=true&characterEncoding=utf8&serverTimezone=UTC&useSSL=false&allowPublicKeyRetrieval=true", "root", password);
        Flyway.configure().dataSource(source).target("24").load().migrate();
        var jdbc = new JdbcTemplate(source);
        jdbc.update("insert into users(id,username,password_hash,nickname) values(1,'fixture','not-a-login-hash','fixture')");
        jdbc.update("insert into categories(id,code,name) values(1,'BRONZE','青铜礼器')");
        jdbc.update("insert into artifacts(category_id,title,slug,summary,content,status,created_by,updated_by) values(1,'旧中文标题','heluo-bronze-ding','旧中文摘要','保留正文','PUBLISHED',1,1)");
        jdbc.update("insert into articles(category_id,title,slug,summary,content,status,created_by,updated_by) values(1,'旧文章','how-to-read-bronze','旧摘要','旧正文','DRAFT',1,1)");
        Flyway.configure().dataSource(source).target("25").load().migrate();
        jdbc.update("update artifacts set title_en='Editor title',summary_en=' '");
        jdbc.update("update articles set summary_en='Editor summary'");
        Flyway.configure().dataSource(source).load().migrate();
        var artifact = jdbc.queryForMap("select title,summary,content,status,title_en,summary_en from artifacts");
        assertThat(artifact.get("title")).isEqualTo("旧中文标题");
        assertThat(artifact.get("summary")).isEqualTo("旧中文摘要");
        assertThat(artifact.get("content")).isEqualTo("保留正文");
        assertThat(artifact.get("status")).isEqualTo("PUBLISHED");
        assertThat(artifact.get("title_en")).isEqualTo("Editor title");
        assertThat((String) artifact.get("summary_en")).contains("bronze ding");
        assertThat(jdbc.queryForObject("select summary_en from articles", String.class)).isEqualTo("Editor summary");
        assertThat(jdbc.queryForObject("select title_en from articles", String.class)).contains("bronze");
        // Old application projections still work; repeated startup cannot reapply seed translations.
        jdbc.update("update artifacts set title_en=null,summary_en=null");
        Flyway.configure().dataSource(source).load().migrate();
        assertThat(jdbc.queryForObject("select title_en from artifacts", String.class)).isNull();
        assertThat(jdbc.queryForObject("select title from artifacts", String.class)).isEqualTo("旧中文标题");
    }
}
