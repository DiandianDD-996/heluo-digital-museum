package com.heluo.museum.guide;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.heluo.museum.guide.GuideEvidenceReader.Claim;
import com.heluo.museum.guide.GuideEvidenceReader.Evidence;
import com.heluo.museum.guide.GuideEvidenceVisibility.Card;
import com.heluo.museum.guide.GuideEvidenceVisibility.Reference;
import com.heluo.museum.guide.GuideEvidenceVisibility.Status;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
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

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:guide-visibility;MODE=MySQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "museum.bootstrap.enabled=true",
        "museum.bootstrap.admin-username=vis_admin",
        "museum.bootstrap.admin-password=VisAdminPassword123",
        "museum.bootstrap.admin-email=vis@example.test"
})
@ActiveProfiles("test")
@Transactional
class GuideEvidenceVisibilityTests {

    private static final Instant NOW = Instant.parse("2026-11-23T00:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);

    @Autowired
    private JdbcTemplate jdbc;

    private GuideEvidenceVisibility visibility;

    @BeforeEach
    void setUp() {
        visibility = new GuideEvidenceVisibility(jdbc, CLOCK);
    }

    @Test
    void visibilityAllowsOnlyPublishedCurrentNonExpiredCardsForPublicExhibits() {
        Card valid = new Card("C-1", 2, "heluo-bronze-ding-3d", "heluo-bronze-ding", "zh-CN",
                Status.PUBLISHED, NOW.minusSeconds(60), NOW.plusSeconds(60));
        assertThat(visibility.allows("heluo-bronze-ding-3d", "zh-CN", new Reference("C-1", 2), valid)).isTrue();

        // Revision mismatch
        assertThat(visibility.allows("heluo-bronze-ding-3d", "zh-CN", new Reference("C-1", 1), valid)).isFalse();
        // Draft / Withdrawn
        Card draft = new Card("C-1", 2, "heluo-bronze-ding-3d", "heluo-bronze-ding", "zh-CN",
                Status.DRAFT, NOW.minusSeconds(60), null);
        Card withdrawn = new Card("C-1", 2, "heluo-bronze-ding-3d", "heluo-bronze-ding", "zh-CN",
                Status.WITHDRAWN, NOW.minusSeconds(60), null);
        assertThat(visibility.allows("heluo-bronze-ding-3d", "zh-CN", new Reference("C-1", 2), draft)).isFalse();
        assertThat(visibility.allows("heluo-bronze-ding-3d", "zh-CN", new Reference("C-1", 2), withdrawn)).isFalse();

        // Future publishedAt or expired
        Card future = new Card("C-1", 2, "heluo-bronze-ding-3d", "heluo-bronze-ding", "zh-CN",
                Status.PUBLISHED, NOW.plusSeconds(60), null);
        Card expired = new Card("C-1", 2, "heluo-bronze-ding-3d", "heluo-bronze-ding", "zh-CN",
                Status.PUBLISHED, NOW.minusSeconds(120), NOW);
        assertThat(visibility.allows("heluo-bronze-ding-3d", "zh-CN", new Reference("C-1", 2), future)).isFalse();
        assertThat(visibility.allows("heluo-bronze-ding-3d", "zh-CN", new Reference("C-1", 2), expired)).isFalse();

        // Withdrawing exhibit in DB hides the card immediately
        jdbc.update("update exhibits_3d set status='WITHDRAWN' where slug='heluo-bronze-ding-3d'");
        assertThat(visibility.allows("heluo-bronze-ding-3d", "zh-CN", new Reference("C-1", 2), valid)).isFalse();
    }

    @Test
    void readerBlocksConflictingClaimsPerAdr006WhileAllowingNonConflictingCards() {
        var reader = new GuideEvidenceReader((exhibit, locale) -> List.of(
                new Evidence(new Card("LS-A", 1, exhibit, "heluo-bronze-ding", locale,
                        Status.PUBLISHED, NOW.minusSeconds(10), null),
                        "说法甲", List.of("年代"), null, new Claim("period", "商代")),
                new Evidence(new Card("LS-B", 1, exhibit, "heluo-bronze-ding", locale,
                        Status.PUBLISHED, NOW.minusSeconds(10), null),
                        "说法乙", List.of("年代"), null, new Claim("period", "西周")),
                new Evidence(new Card("LS-C", 1, exhibit, "heluo-bronze-ding", locale,
                        Status.PUBLISHED, NOW.minusSeconds(10), null),
                        "三足观察", List.of("三足"), null, new Claim("feet", "三只"))
        ), visibility);

        assertThat(reader.listPublished("heluo-bronze-ding-3d", "zh-CN"))
                .extracting(e -> e.card().id())
                .containsExactly("LS-C");

        var disputedSearch = reader.searchCandidates("heluo-bronze-ding-3d", "zh-CN", "什么年代");
        assertThat(disputedSearch.disputed()).isTrue();
        assertThat(disputedSearch.evidence()).isEmpty();

        var safeSearch = reader.searchCandidates("heluo-bronze-ding-3d", "zh-CN", "三足");
        assertThat(safeSearch.disputed()).isFalse();
        assertThat(safeSearch.evidence()).extracting(e -> e.card().id()).containsExactly("LS-C");

        assertThat(reader.resolve("heluo-bronze-ding-3d", "zh-CN", List.of(new Reference("LS-A", 1)))).isEmpty();
        assertThat(reader.resolve("heluo-bronze-ding-3d", "zh-CN", List.of(new Reference("LS-C", 1)))).isPresent();
    }

    @Test
    void fileSourceValidatesRepoSignedDingPackAndRejectsTamperingOrRollback(@TempDir Path tempDir) throws Exception {
        Path repoContent = Path.of("..", "content", "luosheng").toAbsolutePath().normalize();
        var repoSource = new GuideEvidenceFileSource(
                repoContent.resolve("ding.zh-CN.json"),
                repoContent.resolve("minimum-release-version.txt"),
                repoContent.resolve("ding.zh-CN.sha256"));
        var repoReader = new GuideEvidenceReader(repoSource, visibility);
        var zhCards = repoReader.listPublished("heluo-bronze-ding-3d", "zh-CN");
        assertThat(zhCards).hasSize(9);
        assertThat(zhCards).filteredOn(c -> c.claim() != null).hasSize(4);

        var enRepoSource = new GuideEvidenceFileSource(
                repoContent.resolve("ding.en-US.json"),
                repoContent.resolve("minimum-release-version.txt"),
                repoContent.resolve("ding.en-US.sha256"));
        var enRepoReader = new GuideEvidenceReader(enRepoSource, visibility);
        assertThat(enRepoReader.listPublished("heluo-bronze-ding-3d", "en-US")).hasSize(9);

        // Copy to tempDir and verify tampering / rollback rejection
        byte[] bytes = Files.readAllBytes(repoContent.resolve("ding.zh-CN.json"));
        Path pack = tempDir.resolve("ding.json");
        Path minVer = tempDir.resolve("min.txt");
        Path digest = tempDir.resolve("ding.sha256");
        Files.write(pack, bytes);
        Files.writeString(minVer, "6\n", StandardCharsets.US_ASCII);
        Files.writeString(digest, HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)) + "\n",
                StandardCharsets.US_ASCII);

        var tempSource = new GuideEvidenceFileSource(pack, minVer, digest);
        assertThat(tempSource.current("heluo-bronze-ding-3d", "zh-CN")).hasSize(9);

        // Rollback check
        Files.writeString(minVer, "99\n", StandardCharsets.US_ASCII);
        assertThatThrownBy(() -> tempSource.current("heluo-bronze-ding-3d", "zh-CN"))
                .hasMessageContaining("Guide evidence pack unavailable");

        // Tamper check
        Files.writeString(minVer, "5\n", StandardCharsets.US_ASCII);
        Files.writeString(pack, new String(bytes, StandardCharsets.UTF_8) + "\n", StandardCharsets.UTF_8);
        assertThatThrownBy(() -> tempSource.current("heluo-bronze-ding-3d", "zh-CN"))
                .hasMessageContaining("Guide evidence pack unavailable");
    }
}
