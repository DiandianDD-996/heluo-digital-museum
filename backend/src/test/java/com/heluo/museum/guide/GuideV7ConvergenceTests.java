package com.heluo.museum.guide;

import static org.junit.jupiter.api.Assertions.*;

import com.heluo.museum.guide.GuideAnswerDelivery.Draft;
import com.heluo.museum.guide.GuideEvidenceVisibility.Reference;
import com.heluo.museum.guide.GuideQuestionTurn.EvidenceExcerpt;
import com.heluo.museum.guide.GuideQuestionTurn.Input;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:guide-v7;MODE=MySQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "museum.bootstrap.enabled=true",
        "museum.bootstrap.admin-username=guide_v7_admin",
        "museum.bootstrap.admin-password=GuideV7TestPassword123",
        "museum.bootstrap.admin-email=guide-v7@example.test"
})
@ActiveProfiles("test")
class GuideV7ConvergenceTests {
    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void loadsSchemaV3PackWithSpokenAndBoundaryFields() {
        Path root = Path.of("..", "content", "luosheng");
        var source = new GuideEvidenceFileSource(
                root.resolve("ding.zh-CN.json"),
                root.resolve("minimum-release-version.txt"),
                root.resolve("ding.zh-CN.sha256"));
        var visibility = new GuideEvidenceVisibility(jdbc,
                Clock.fixed(Instant.parse("2026-11-22T12:00:00Z"), ZoneOffset.UTC));
        var reader = new GuideEvidenceReader(source, visibility);
        var cards = reader.listPublished("heluo-bronze-ding-3d", "zh-CN");
        assertEquals(8, cards.size());
        var feet = cards.stream().filter(c -> "LS-DING-FEET".equals(c.card().id())).findFirst().orElseThrow();
        assertEquals(2, feet.spoken().size());
        assertEquals(1, feet.boundary().size());
        assertTrue(feet.systemConstraints().contains("camera-is-not-gaze"));
        assertFalse(feet.spokenText().contains("固定视角当成游客当前的镜头"));
    }

    @Test
    void v7AssemblesProgrammaticSpokenTextAndRejectsFactualLeads() {
        var feet = new EvidenceExcerpt(new Reference("LS-DING-FEET", 2),
                "侧面看只有两条腿。",
                List.of("侧面看只有两条腿，是因为第三只足正好被鼎身挡住了。"),
                List.of("两张图的差别只是固定视角下的遮挡，不能据此判断原器缺损。"));
        var input = new Input("只有两条腿吗？", "zh-CN", List.of(feet), Set.of("feet"));

        var valid = new GuideStructuredGenerator(prompt -> """
                {"lead":"你数得很仔细。","cards":["LS-DING-FEET"],"boundary":true,"action":"plate:feet"}
                """).generate(input).orElseThrow();
        assertTrue(valid.text().startsWith("你数得很仔细。\n侧面看只有两条腿"));
        assertTrue(valid.text().contains("不能据此判断原器缺损"));
        assertTrue(valid.text().contains("看背视图"));
        assertEquals(List.of(feet.reference()), valid.references());

        // Fact-bearing leads must be rejected.
        for (String badLead : List.of("这是商代安阳时期的器物。", "高24.5厘米呢。", "它是在洛阳出土的。", "a".repeat(25))) {
            String reply = "{\"lead\":\"" + badLead + "\",\"cards\":[\"LS-DING-FEET\"],\"boundary\":false,\"action\":null}";
            assertTrue(new GuideStructuredGenerator(prompt -> reply).generate(input).isEmpty(), badLead);
        }

        // Abstention
        var abstain = new GuideStructuredGenerator(prompt -> """
                {"lead":null,"cards":[],"boundary":false,"action":null}
                """).generate(input).orElseThrow();
        assertEquals(new Draft("", List.of()), abstain);
    }

    @Test
    void supportsConcurrentFourGenerationsWithoutBusyRejection() throws Exception {
        Path root = Path.of("..", "content", "luosheng");
        var source = new GuideEvidenceFileSource(
                root.resolve("ding.zh-CN.json"),
                root.resolve("minimum-release-version.txt"),
                root.resolve("ding.zh-CN.sha256"));
        var clock = Clock.fixed(Instant.parse("2026-11-22T12:00:00Z"), ZoneOffset.UTC);
        var reader = new GuideEvidenceReader(source, new GuideEvidenceVisibility(jdbc, clock));
        var retrieval = new GuideFollowUpRetrieval(reader, null, true);

        var allStarted = new CountDownLatch(4);
        var release = new CountDownLatch(1);
        var active = new AtomicInteger();
        var maxActive = new AtomicInteger();

        GuideQuestionTurn.Generator slowGenerator = input -> {
            int cur = active.incrementAndGet();
            maxActive.accumulateAndGet(cur, Math::max);
            allStarted.countDown();
            try {
                release.await(3, TimeUnit.SECONDS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } finally {
                active.decrementAndGet();
            }
            var first = input.evidence().get(0);
            return java.util.Optional.of(new Draft(first.spokenText(), List.of(first.reference())));
        };

        var flow = new GuideQuestionTurn(reader, slowGenerator, 4, Duration.ofSeconds(5),
                new GuideDailyGenerationLimit(clock, 200), GuideVoice.packaged(), true);

        var pool = Executors.newFixedThreadPool(4);
        try {
            var futures = new java.util.ArrayList<java.util.concurrent.Future<GuideQuestionTurn.Reply>>();
            for (int i = 0; i < 4; i++) {
                futures.add(pool.submit(() -> {
                    var session = new GuideRetrievalSession(retrieval, clock, Duration.ofMinutes(15));
                    session.enter("heluo-bronze-ding-3d", "zh-CN");
                    return flow.ask(session, "为什么只有两条腿", UUID.randomUUID()).orElseThrow();
                }));
            }
            assertTrue(allStarted.await(3, TimeUnit.SECONDS), "4 concurrent generations should run in parallel");
            assertEquals(4, maxActive.get());
            release.countDown();
            for (var f : futures) {
                assertEquals(GuideQuestionTurn.ReplyKind.EVIDENCE, f.get(3, TimeUnit.SECONDS).kind());
            }
        } finally {
            pool.shutdownNow();
        }
    }
}
