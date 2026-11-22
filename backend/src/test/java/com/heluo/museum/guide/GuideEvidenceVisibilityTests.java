package com.heluo.museum.guide;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.springframework.dao.DataAccessResourceFailureException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:guide-visibility;MODE=MySQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "museum.bootstrap.enabled=true",
        "museum.bootstrap.admin-username=guide_test_admin",
        "museum.bootstrap.admin-password=GuideTestOnlyPassword123",
        "museum.bootstrap.admin-email=guide@example.test"
})
@ActiveProfiles("test")
@Transactional
class GuideEvidenceVisibilityTests {
    private static final String EXHIBIT = "heluo-bronze-ding-3d";
    private static final String ARTIFACT = "heluo-bronze-ding";
    private static final String LOCALE = "zh-CN";
    private static final Instant NOW = Instant.parse("2026-11-19T00:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
    private static final GuideEvidenceVisibility.Reference REF = new GuideEvidenceVisibility.Reference("TEST-CARD", 1);

    @Test
    void sessionQuestionLimitUsesRollingWindowWithoutLosingLookpoint() {
        var clock = mock(Clock.class);
        when(clock.instant()).thenReturn(NOW);
        var retrieval = mock(GuideFollowUpRetrieval.class);
        var session = new GuideRetrievalSession(retrieval, clock, Duration.ofMinutes(5));
        session.enter(EXHIBIT, LOCALE);
        var accepted = new GuideFollowUpRetrieval.Result(GuideFollowUpRetrieval.Kind.CLARIFY, List.of());
        String question = "另一只呢？";
        when(retrieval.retrieve(EXHIBIT, LOCALE, question, null, null)).thenReturn(accepted);
        var first = UUID.randomUUID();
        assertEquals(accepted, session.retrieve(question, first).orElseThrow().result());
        when(clock.instant()).thenReturn(NOW.plusSeconds(1));
        assertTrue(session.retrieve(question, first).isEmpty());
        for (int i = 0; i < 5; i++) {
            assertEquals(accepted, session.retrieve(question, UUID.randomUUID()).orElseThrow().result());
        }
        session.leave();
        session.enter(EXHIBIT, LOCALE);
        var lookpoint = new GuideFollowUpRetrieval.ConfirmedLookpoint(EXHIBIT, LOCALE, REF);
        assertTrue(session.confirm(lookpoint));
        when(retrieval.retrieve(EXHIBIT, LOCALE, question, lookpoint, null)).thenReturn(accepted);
        org.mockito.Mockito.clearInvocations(retrieval);
        var next = UUID.randomUUID();
        assertEquals(GuideFollowUpRetrieval.Kind.SESSION_RATE_LIMITED, session.retrieve(question, next).orElseThrow().result().kind());
        when(clock.instant()).thenReturn(NOW.plusSeconds(59));
        assertEquals(GuideFollowUpRetrieval.Kind.SESSION_RATE_LIMITED, session.retrieve(question, next).orElseThrow().result().kind());
        verifyNoInteractions(retrieval);
        when(clock.instant()).thenReturn(NOW.plusSeconds(60));
        assertEquals(accepted, session.retrieve(question, next).orElseThrow().result());
        assertEquals(GuideFollowUpRetrieval.Kind.SESSION_RATE_LIMITED,
                session.retrieve(question, UUID.randomUUID()).orElseThrow().result().kind());
        var other = new GuideRetrievalSession(retrieval, clock, Duration.ofMinutes(5));
        other.enter(EXHIBIT, LOCALE);
        assertEquals(accepted, other.retrieve(question, first).orElseThrow().result());
    }

    @Autowired
    JdbcTemplate jdbc;

    @Test
    void verifiesCardBeforeUsingOrReplayingCitation() {
        var visibility = new GuideEvidenceVisibility(jdbc, CLOCK);
        var approved = card(GuideEvidenceVisibility.Status.PUBLISHED, NOW, null);
        assertTrue(visibility.allows(EXHIBIT, LOCALE, REF, approved));
        assertFalse(visibility.allows(EXHIBIT, LOCALE, REF, null));
        assertFalse(visibility.allows(EXHIBIT, "en-US", REF, approved));
        assertFalse(visibility.allows("other-exhibit", LOCALE, REF, approved));
        assertFalse(visibility.allows(EXHIBIT, LOCALE, new GuideEvidenceVisibility.Reference("TEST-CARD", 2), approved));
        assertFalse(visibility.allows(EXHIBIT, LOCALE, new GuideEvidenceVisibility.Reference("OTHER-CARD", 1), approved));
        assertFalse(visibility.allows(EXHIBIT, LOCALE, REF, card(GuideEvidenceVisibility.Status.DRAFT, NOW, null)));
        assertFalse(visibility.allows(EXHIBIT, LOCALE, REF, card(GuideEvidenceVisibility.Status.WITHDRAWN, NOW, null)));
        assertFalse(visibility.allows(EXHIBIT, LOCALE, REF, card(GuideEvidenceVisibility.Status.PUBLISHED, NOW.plusSeconds(1), null)));
        assertFalse(visibility.allows(EXHIBIT, LOCALE, REF, card(GuideEvidenceVisibility.Status.PUBLISHED, NOW.minusSeconds(1), NOW)));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "update exhibits_3d set status='WITHDRAWN' where slug='heluo-bronze-ding-3d'",
            "update exhibits_3d set deleted_at=current_timestamp where slug='heluo-bronze-ding-3d'",
            "update artifacts set status='WITHDRAWN' where slug='heluo-bronze-ding'",
            "update artifacts set deleted_at=current_timestamp where slug='heluo-bronze-ding'",
            "update categories set enabled=0 where code='BRONZE'"
    })
    void rejectsPreviouslyVisibleCitationAfterContentChanges(String update) {
        var visibility = new GuideEvidenceVisibility(jdbc, CLOCK);
        var approved = card(GuideEvidenceVisibility.Status.PUBLISHED, NOW, null);
        var source = evidence("TEST-CARD", 1, GuideEvidenceVisibility.Status.PUBLISHED, "ding");
        var replay = new GuideAnswerReplay(new GuideEvidenceReader((slug, locale) -> List.of(source), visibility));
        var stored = new GuideAnswerReplay.StoredAnswer(EXHIBIT, LOCALE, "Previously shown", List.of(REF));
        assertTrue(visibility.allows(EXHIBIT, LOCALE, REF, approved));
        assertTrue(replay.replay(EXHIBIT, LOCALE, stored).isPresent());
        jdbc.update(update);
        assertFalse(visibility.allows(EXHIBIT, LOCALE, REF, approved));
        assertTrue(replay.replay(EXHIBIT, LOCALE, stored).isEmpty());
    }

    @Test
    void readerRechecksTrustedSnapshotForSearchAndAllOrNothingResolution() {
        var original = evidence("TEST-CARD", 1, GuideEvidenceVisibility.Status.PUBLISHED, "鼎耳");
        var draft = evidence("DRAFT-CARD", 1, GuideEvidenceVisibility.Status.DRAFT, "青铜鼎耳");
        var unrelated = evidence("OTHER-CARD", 1, GuideEvidenceVisibility.Status.PUBLISHED, "三足");
        var current = new AtomicReference<>(List.of(original, draft, unrelated));
        var reader = new GuideEvidenceReader((slug, locale) -> current.get(), new GuideEvidenceVisibility(jdbc, CLOCK));
        var refs = List.of(REF, new GuideEvidenceVisibility.Reference("OTHER-CARD", 1));
        assertEquals(List.of(original), reader.search(EXHIBIT, LOCALE, "青铜鼎耳在哪里？"));
        assertEquals(List.of(original, unrelated), reader.resolve(EXHIBIT, LOCALE, refs).orElseThrow());
        assertTrue(reader.search(EXHIBIT, LOCALE, "年代").isEmpty());
        current.set(List.of(evidence("TEST-CARD", 1, GuideEvidenceVisibility.Status.WITHDRAWN, "鼎耳"), draft, unrelated));
        assertTrue(reader.search(EXHIBIT, LOCALE, "鼎耳").isEmpty());
        assertTrue(reader.resolve(EXHIBIT, LOCALE, refs).isEmpty());
        var replacement = evidence("TEST-CARD", 2, GuideEvidenceVisibility.Status.PUBLISHED, "鼎耳");
        current.set(List.of(replacement, draft, unrelated));
        assertEquals(List.of(replacement), reader.search(EXHIBIT, LOCALE, "鼎耳"));
        assertTrue(reader.resolve(EXHIBIT, LOCALE, refs).isEmpty());
        jdbc.update("update categories set enabled=0 where code='BRONZE'");
        assertTrue(reader.search(EXHIBIT, LOCALE, "鼎耳").isEmpty());
        assertTrue(reader.resolve(EXHIBIT, LOCALE, List.of(new GuideEvidenceVisibility.Reference("TEST-CARD", 2))).isEmpty());
    }

    @Test
    void followUpUsesOnlyCurrentVerifiedContextAndPrefersExplicitEvidence() {
        var ear = evidence("EAR", 1, GuideEvidenceVisibility.Status.PUBLISHED, "鼎耳");
        var feet = evidence("FEET", 1, GuideEvidenceVisibility.Status.PUBLISHED, "三足");
        var current = new AtomicReference<>(List.of(ear, feet));
        var followUp = new GuideFollowUpRetrieval(new GuideEvidenceReader(
                (slug, locale) -> current.get(), new GuideEvidenceVisibility(jdbc, CLOCK)));
        var earContext = new GuideFollowUpRetrieval.ConfirmedLookpoint(EXHIBIT, LOCALE,
                new GuideEvidenceVisibility.Reference("EAR", 1));
        var feetContext = new GuideFollowUpRetrieval.ConfirmedLookpoint(EXHIBIT, LOCALE,
                new GuideEvidenceVisibility.Reference("FEET", 1));
        var clarify = new GuideFollowUpRetrieval.Result(GuideFollowUpRetrieval.Kind.CLARIFY, List.of());
        var insufficient = new GuideFollowUpRetrieval.Result(
                GuideFollowUpRetrieval.Kind.INSUFFICIENT_EVIDENCE, List.of());

        assertEquals(new GuideFollowUpRetrieval.Result(GuideFollowUpRetrieval.Kind.EVIDENCE, List.of(ear)),
                followUp.retrieve(EXHIBIT, LOCALE, "另一只呢？", earContext));
        assertEquals(List.of(feet), followUp.retrieve(EXHIBIT, LOCALE, "另一只呢？", feetContext).evidence());
        assertEquals(List.of(feet), followUp.retrieve(EXHIBIT, LOCALE, "还是没看清。", feetContext).evidence());
        assertEquals(List.of(ear), followUp.retrieve(EXHIBIT, LOCALE, "那另一边在哪儿？", earContext).evidence());
        assertEquals(clarify, followUp.retrieve(EXHIBIT, LOCALE, "另一只呢？", null));
        assertEquals(clarify, followUp.retrieve("other-exhibit", LOCALE, "另一只呢？", earContext));
        assertEquals(insufficient, followUp.retrieve(EXHIBIT, "en-US", "另一只呢？", earContext));
        assertEquals(List.of(ear), followUp.retrieve(EXHIBIT, LOCALE, "鼎耳在哪里？", feetContext).evidence());
        assertEquals(new GuideFollowUpRetrieval.Result(GuideFollowUpRetrieval.Kind.FIND_SPOT_UNKNOWN, List.of()),
                followUp.retrieve(EXHIBIT, LOCALE, "另一只呢？是在洛阳出土吗？", feetContext));

        current.set(List.of(ear, evidence("FEET", 1, GuideEvidenceVisibility.Status.WITHDRAWN, "三足")));
        assertEquals(insufficient, followUp.retrieve(EXHIBIT, LOCALE, "另一只呢？", feetContext));
        current.set(List.of(ear, evidence("FEET", 2, GuideEvidenceVisibility.Status.PUBLISHED, "三足")));
        assertEquals(insufficient, followUp.retrieve(EXHIBIT, LOCALE, "另一只呢？", feetContext));
        jdbc.update("update exhibits_3d set status='WITHDRAWN' where slug=?", EXHIBIT);
        assertEquals(insufficient, followUp.retrieve(EXHIBIT, LOCALE, "另一只呢？", earContext));
    }

    @Test
    void naturalLookpointCorrectionsOverrideThePriorTopicAndRespectWithdrawal() {
        var ear = evidence("EAR", 1, GuideEvidenceVisibility.Status.PUBLISHED, "鼎耳");
        var feet = evidence("FEET", 1, GuideEvidenceVisibility.Status.PUBLISHED, "三足");
        var cards = new AtomicReference<>(List.of(ear, feet));
        var retrieval = new GuideFollowUpRetrieval(new GuideEvidenceReader(
                (slug, locale) -> cards.get(), new GuideEvidenceVisibility(jdbc, CLOCK)), null, true);
        var earContext = new GuideFollowUpRetrieval.ConfirmedLookpoint(EXHIBIT, LOCALE,
                new GuideEvidenceVisibility.Reference("EAR", 1));
        assertEquals(List.of(feet), retrieval.retrieve(EXHIBIT, LOCALE, "脚", null).evidence());
        assertEquals(List.of(feet), retrieval.retrieve(EXHIBIT, LOCALE, "我说的是脚", earContext).evidence());
        assertEquals(List.of(feet), retrieval.retrieve(EXHIBIT, LOCALE, "我只数出两条腿，缺了一条吗？", earContext).evidence());
        cards.set(List.of(ear));
        var unavailable = retrieval.retrieve(EXHIBIT, LOCALE, "我说的是脚", earContext);
        assertEquals(GuideFollowUpRetrieval.Kind.INSUFFICIENT_EVIDENCE, unavailable.kind());
        assertTrue(unavailable.evidence().isEmpty());
    }

    @Test
    void conversationalFollowUpsCannotBeClaimedByGenericCardAliases() {
        var original = evidence("EAR", 1, GuideEvidenceVisibility.Status.PUBLISHED, "鼎耳");
        var ear = new GuideEvidenceReader.Evidence(original.card(), original.text(),
                List.of("鼎耳", "另一只", "看不太清楚", "剩下那只"), original.publicSource());
        var feet = evidence("FEET", 1, GuideEvidenceVisibility.Status.PUBLISHED, "三足");
        var retrieval = new GuideFollowUpRetrieval(new GuideEvidenceReader(
                (slug, locale) -> List.of(ear, feet), new GuideEvidenceVisibility(jdbc, CLOCK)));
        var context = new GuideFollowUpRetrieval.ConfirmedLookpoint(EXHIBIT, LOCALE,
                new GuideEvidenceVisibility.Reference("FEET", 1));
        for (String question : List.of("另一只呢？", "刚才，那只在哪里呀？", "我还是看不太清楚。",
                "那，剩下那只在哪儿？", "还有一只呢？", "被挡住的那只呢？",
                "那另外一只在哪呢？", "另外一只在哪个位置？", "再指一下可以吗？", "能给我再指一下吗？")) {
            assertEquals(List.of(feet), retrieval.retrieve(EXHIBIT, LOCALE, question, context).evidence());
            assertEquals(GuideFollowUpRetrieval.Kind.CLARIFY, retrieval.retrieve(EXHIBIT, LOCALE, question, null).kind());
        }
        assertEquals(List.of(ear), retrieval.retrieve(EXHIBIT, LOCALE, "鼎耳我还是看不太清楚。", context).evidence());
        assertEquals(List.of(ear), retrieval.retrieve(EXHIBIT, LOCALE, "被挡住的那只鼎耳在哪儿？", context).evidence());
        assertEquals(GuideFollowUpRetrieval.Kind.FIND_SPOT_UNKNOWN,
                retrieval.retrieve(EXHIBIT, LOCALE, "还有一只呢？它是从哪里出土的？", context).kind());
        assertEquals(List.of(ear), retrieval.retrieve(EXHIBIT, LOCALE, "鼎耳能再指一下吗？", context).evidence());
        for (String question : List.of("还是没听清。", "那只在哪里呀？有材质检测吗？", "再指一下可以吗？有材质检测吗？")) {
            assertEquals(GuideFollowUpRetrieval.Kind.INSUFFICIENT_EVIDENCE,
                    retrieval.retrieve(EXHIBIT, LOCALE, question, context).kind());
        }
    }

    @Test
    void findSpotUsesFixedTextAndDropsReferenceWithdrawnBeforeDelivery() {
        var source = evidence("SOURCE", 1, GuideEvidenceVisibility.Status.PUBLISHED, "参考记录");
        var current = new AtomicReference<>(List.of(source));
        var reader = new GuideEvidenceReader((slug, locale) -> current.get(), new GuideEvidenceVisibility(jdbc, CLOCK));
        var reference = new GuideEvidenceVisibility.Reference("SOURCE", 1);
        var session = new GuideRetrievalSession(new GuideFollowUpRetrieval(reader, reference), CLOCK, Duration.ofMinutes(5));
        session.enter(EXHIBIT, LOCALE);
        var turn = session.retrieve("这是哪里发现的？").orElseThrow();
        var delivery = new GuideAnswerDelivery(reader);
        assertTrue(delivery.deliver(session, turn,
                new GuideAnswerDelivery.Draft("确定在洛阳出土", List.of(reference))).isEmpty());
        var answered = delivery.deliverFindSpot(session, turn).orElseThrow();
        assertEquals("缺的是：出土地记录。\n下方有可点开的公开资料，可以核对来源。", answered.text());
        assertEquals(reference, answered.citations().get(0).reference());
        current.set(List.of(evidence("SOURCE", 1, GuideEvidenceVisibility.Status.WITHDRAWN, "参考记录")));
        var withdrawn = delivery.deliverFindSpot(session, turn).orElseThrow();
        assertEquals("缺的是：出土地记录。", withdrawn.text());
        assertTrue(withdrawn.citations().isEmpty());
        session.leave();
        assertTrue(delivery.deliverFindSpot(session, turn).isEmpty());
    }

    @Test
    void deliveryAcceptsOnlyCurrentOfferedReferencesAndChecksTextBounds() {
        var ear = evidence("EAR", 1, GuideEvidenceVisibility.Status.PUBLISHED, "鼎耳");
        var feet = evidence("FEET", 1, GuideEvidenceVisibility.Status.PUBLISHED, "三足");
        var reader = new GuideEvidenceReader((slug, locale) -> List.of(ear, feet),
                new GuideEvidenceVisibility(jdbc, CLOCK));
        var retrieval = new GuideFollowUpRetrieval(reader);
        var delivery = new GuideAnswerDelivery(reader);
        var session = new GuideRetrievalSession(retrieval, CLOCK, Duration.ofMinutes(5));
        session.enter(EXHIBIT, LOCALE);
        var turn = session.retrieve("鼎耳在哪？").orElseThrow();
        var ref = lookpoint("EAR").reference();
        var draft = new GuideAnswerDelivery.Draft("  Observation  ", List.of(ref));
        var answer = delivery.deliver(session, turn, draft).orElseThrow();
        assertEquals("Observation", answer.text());
        assertEquals(ref, answer.citations().get(0).reference());
        assertEquals(ear.publicSource(), answer.citations().get(0).publicSource());

        for (var bad : List.of(
                new GuideAnswerDelivery.Draft("Evidence", List.of(lookpoint("FEET").reference())),
                new GuideAnswerDelivery.Draft("Evidence", List.of(new GuideEvidenceVisibility.Reference("EAR", 2))),
                new GuideAnswerDelivery.Draft("Evidence", List.of(ref, ref)),
                new GuideAnswerDelivery.Draft("Evidence", List.of()),
                new GuideAnswerDelivery.Draft("Evidence", java.util.Collections.singletonList(null)),
                new GuideAnswerDelivery.Draft(" ", List.of(ref)),
                new GuideAnswerDelivery.Draft("字".repeat(301), List.of(ref)))) {
            assertTrue(delivery.deliver(session, turn, bad).isEmpty());
        }
        var other = new GuideRetrievalSession(retrieval, CLOCK, Duration.ofMinutes(5));
        other.enter(EXHIBIT, LOCALE);
        var otherTurn = other.retrieve("鼎耳在哪？").orElseThrow();
        assertEquals(turn.turn(), otherTurn.turn());
        assertTrue(delivery.deliver(other, turn, draft).isEmpty());
        session.retrieve("另一只呢？").orElseThrow();
        assertTrue(delivery.deliver(session, turn, draft).isEmpty());
    }

    @Test
    void deliveryDropsResultWhenRoundChangesDuringEvidenceRecheck() {
        var ear = evidence("EAR", 1, GuideEvidenceVisibility.Status.PUBLISHED, "鼎耳");
        var onRead = new AtomicReference<Runnable>(() -> {});
        var reader = new GuideEvidenceReader((slug, locale) -> {
            onRead.get().run();
            return List.of(ear);
        }, new GuideEvidenceVisibility(jdbc, CLOCK));
        var session = new GuideRetrievalSession(new GuideFollowUpRetrieval(reader), CLOCK, Duration.ofMinutes(5));
        session.enter(EXHIBIT, LOCALE);
        var turn = session.retrieve("鼎耳在哪？").orElseThrow();
        onRead.set(session::leave);
        var draft = new GuideAnswerDelivery.Draft("Evidence", List.of(lookpoint("EAR").reference()));
        assertTrue(new GuideAnswerDelivery(reader).deliver(session, turn, draft).isEmpty());
    }

    @Test
    void multipleSourcesClearTheAnswerTopicButKeepTheSelectedPlate() {
        var ear = evidence("EAR", 1, GuideEvidenceVisibility.Status.PUBLISHED, "鼎耳");
        var feet = evidence("FEET", 1, GuideEvidenceVisibility.Status.PUBLISHED, "三足");
        var retrieval = new GuideFollowUpRetrieval(new GuideEvidenceReader(
                (slug, locale) -> List.of(ear, feet), new GuideEvidenceVisibility(jdbc, CLOCK)));
        var session = new GuideRetrievalSession(retrieval, CLOCK, Duration.ofMinutes(5));
        var earRef = lookpoint("EAR").reference();
        var feetRef = lookpoint("FEET").reference();
        session.enter(EXHIBIT, LOCALE);
        assertTrue(session.confirm(lookpoint("EAR")));
        var correction = session.retrieve("三足").orElseThrow();
        assertTrue(session.rememberAnsweredTopic(correction, feetRef, List.of(feetRef)));
        assertEquals(List.of(feet), session.retrieve("另一只呢").orElseThrow().result().evidence());
        var comparison = session.retrieve("鼎耳和三足").orElseThrow();
        assertTrue(session.rememberAnsweredTopic(comparison, null, List.of(earRef, feetRef)));
        assertEquals(List.of(ear, feet), session.retrieve("你怎么看出来的").orElseThrow().result().evidence());
        assertEquals(List.of(ear), session.retrieve("另一只呢").orElseThrow().result().evidence());
    }

    @Test
    void sessionRetainsOnlyTheCurrentConfirmedLookpoint() {
        var ear = evidence("EAR", 1, GuideEvidenceVisibility.Status.PUBLISHED, "鼎耳");
        var feet = evidence("FEET", 1, GuideEvidenceVisibility.Status.PUBLISHED, "三足");
        var retrieval = new GuideFollowUpRetrieval(new GuideEvidenceReader(
                (slug, locale) -> List.of(ear, feet), new GuideEvidenceVisibility(jdbc, CLOCK)));
        var session = new GuideRetrievalSession(retrieval, CLOCK, Duration.ofMinutes(5));
        assertTrue(session.retrieve("另一只呢？").isEmpty());
        session.enter(EXHIBIT, LOCALE);
        assertEquals(GuideFollowUpRetrieval.Kind.CLARIFY,
                session.retrieve("另一只呢？").orElseThrow().result().kind());
        assertTrue(session.confirm(lookpoint("EAR")));
        var first = session.retrieve("另一只呢？").orElseThrow();
        assertEquals(List.of(ear), first.result().evidence());
        assertTrue(session.isCurrent(first.turn()));
        assertTrue(session.confirm(lookpoint("FEET")));
        assertFalse(session.isCurrent(first.turn()));
        assertEquals(List.of(feet), session.retrieve("另一只呢？").orElseThrow().result().evidence());
        session.clearLookpoint();
        assertEquals(GuideFollowUpRetrieval.Kind.CLARIFY,
                session.retrieve("另一只呢？").orElseThrow().result().kind());
        assertTrue(session.confirm(lookpoint("EAR")));
        session.enter("other-exhibit", LOCALE);
        assertFalse(session.confirm(lookpoint("EAR")));
        assertEquals(GuideFollowUpRetrieval.Kind.CLARIFY,
                session.retrieve("另一只呢？").orElseThrow().result().kind());
        session.leave();
        assertTrue(session.retrieve("另一只呢？").isEmpty());
        session.enter(EXHIBIT, LOCALE);
        assertEquals(GuideFollowUpRetrieval.Kind.CLARIFY,
                session.retrieve("另一只呢？").orElseThrow().result().kind());
    }

    @ParameterizedTest
    @ValueSource(strings = {"lookpoint", "leave", "switch", "new-turn", "expiry"})
    void sessionDiscardsResultsThatFinishAfterContextChanges(String change) throws Exception {
        var clock = mock(Clock.class);
        when(clock.instant()).thenReturn(NOW);
        var started = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        var ear = evidence("EAR", 1, GuideEvidenceVisibility.Status.PUBLISHED, "鼎耳");
        var retrieval = new GuideFollowUpRetrieval(new GuideEvidenceReader((slug, locale) -> {
            started.countDown();
            try {
                if (!release.await(5, TimeUnit.SECONDS)) throw new AssertionError("Evidence source timed out");
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
                throw new AssertionError(interrupted);
            }
            return List.of(ear);
        }, new GuideEvidenceVisibility(jdbc, CLOCK)));
        var session = new GuideRetrievalSession(retrieval, clock, Duration.ofMinutes(5));
        session.enter(EXHIBIT, LOCALE);
        var worker = Executors.newSingleThreadExecutor();
        try {
            var delayed = worker.submit(() -> session.retrieve("鼎耳在哪？"));
            assertTrue(started.await(5, TimeUnit.SECONDS));
            switch (change) {
                case "lookpoint" -> assertTrue(session.confirm(lookpoint("FEET")));
                case "leave" -> session.leave();
                case "switch" -> session.enter("other-exhibit", LOCALE);
                case "new-turn" -> assertTrue(session.retrieve("").isPresent());
                case "expiry" -> when(clock.instant()).thenReturn(NOW.plusSeconds(300));
                default -> throw new AssertionError(change);
            }
            release.countDown();
            assertTrue(delayed.get(5, TimeUnit.SECONDS).isEmpty());
        } finally {
            release.countDown();
            worker.shutdownNow();
        }
    }

    private static GuideFollowUpRetrieval.ConfirmedLookpoint lookpoint(String id) {
        return new GuideFollowUpRetrieval.ConfirmedLookpoint(EXHIBIT, LOCALE,
                new GuideEvidenceVisibility.Reference(id, 1));
    }

    @Test
    void readerLimitsAndRanksEvidenceAndRejectsUnavailableOrAmbiguousSnapshots() {
        var shortMatch = evidence("C", 1, GuideEvidenceVisibility.Status.PUBLISHED, "3d");
        var longMatch = evidence("B", 1, GuideEvidenceVisibility.Status.PUBLISHED, "3d 模型");
        var firstTie = evidence("A", 1, GuideEvidenceVisibility.Status.PUBLISHED, "3d 模型");
        var lastTie = evidence("D", 1, GuideEvidenceVisibility.Status.PUBLISHED, "3d");
        var visibility = new GuideEvidenceVisibility(jdbc, CLOCK);
        var reader = new GuideEvidenceReader((slug, locale) -> List.of(lastTie, shortMatch, longMatch, firstTie), visibility);
        assertEquals(List.of(firstTie, longMatch, shortMatch), reader.search(EXHIBIT, LOCALE, "３Ｄ 模型"));
        var unavailable = new GuideEvidenceReader((slug, locale) -> {
            throw new DataAccessResourceFailureException("unavailable");
        }, visibility);
        assertTrue(unavailable.search(EXHIBIT, LOCALE, "3d").isEmpty());
        assertTrue(unavailable.resolve(EXHIBIT, LOCALE, List.of(REF)).isEmpty());
        var ambiguous = new GuideEvidenceReader((slug, locale) -> List.of(shortMatch, shortMatch), visibility);
        assertTrue(ambiguous.search(EXHIBIT, LOCALE, "3d").isEmpty());
    }

    private GuideEvidenceReader.Evidence evidence(String id, int revision, GuideEvidenceVisibility.Status status, String alias) {
        return new GuideEvidenceReader.Evidence(
                new GuideEvidenceVisibility.Card(id, revision, EXHIBIT, ARTIFACT, LOCALE, status, NOW, null),
                "Synthetic evidence " + id, List.of(alias), URI.create("https://museum.example.test/cards/" + id));
    }

    @Test
    void replaySuppressesTextAndAllLinksWhenAnyCitationStopsBeingCurrent() {
        var original = evidence("TEST-CARD", 1, GuideEvidenceVisibility.Status.PUBLISHED, "ding");
        var other = evidence("OTHER-CARD", 1, GuideEvidenceVisibility.Status.PUBLISHED, "feet");
        var current = new AtomicReference<>(List.of(original, other));
        var replay = new GuideAnswerReplay(new GuideEvidenceReader((slug, locale) -> current.get(),
                new GuideEvidenceVisibility(jdbc, CLOCK)));
        var otherRef = new GuideEvidenceVisibility.Reference("OTHER-CARD", 1);
        var stored = new GuideAnswerReplay.StoredAnswer(EXHIBIT, LOCALE, "Previously shown", List.of(otherRef, REF));

        var allowed = replay.replay(EXHIBIT, LOCALE, stored).orElseThrow();
        assertEquals("Previously shown", allowed.text());
        assertEquals(List.of(new GuideAnswerReplay.Citation(otherRef, other.publicSource()),
                new GuideAnswerReplay.Citation(REF, original.publicSource())), allowed.citations());
        assertTrue(replay.replay(EXHIBIT, "en-US", stored).isEmpty());
        assertTrue(replay.replay("other-exhibit", LOCALE, stored).isEmpty());
        assertTrue(replay.replay(EXHIBIT, LOCALE,
                new GuideAnswerReplay.StoredAnswer(EXHIBIT, LOCALE, "Uncited", List.of())).isEmpty());

        var expired = new GuideEvidenceReader.Evidence(
                card(GuideEvidenceVisibility.Status.PUBLISHED, NOW.minusSeconds(1), NOW),
                original.text(), original.aliases(), original.publicSource());
        for (var invalid : List.of(
                evidence("TEST-CARD", 1, GuideEvidenceVisibility.Status.WITHDRAWN, "ding"),
                evidence("TEST-CARD", 2, GuideEvidenceVisibility.Status.PUBLISHED, "ding"), expired)) {
            current.set(List.of(invalid, other));
            assertTrue(replay.replay(EXHIBIT, LOCALE, stored).isEmpty());
        }
        current.set(List.of(other));
        assertTrue(replay.replay(EXHIBIT, LOCALE, stored).isEmpty());
    }

    @Test
    void replayDoesNotExposeNonHttpsSourceLinks() {
        var source = new GuideEvidenceReader.Evidence(
                card(GuideEvidenceVisibility.Status.PUBLISHED, NOW, null), "Synthetic", List.of("ding"),
                URI.create("file:///private/source"));
        var replay = new GuideAnswerReplay(new GuideEvidenceReader((slug, locale) -> List.of(source),
                new GuideEvidenceVisibility(jdbc, CLOCK)));
        var stored = new GuideAnswerReplay.StoredAnswer(EXHIBIT, LOCALE, "Previously shown", List.of(REF));
        assertEquals(List.of(new GuideAnswerReplay.Citation(REF, null)),
                replay.replay(EXHIBIT, LOCALE, stored).orElseThrow().citations());
    }

    @Test
    void fileBackedSearchAndReplayObserveWithdrawalsAndUnavailablePacks(@TempDir Path directory) throws Exception {
        Path file = directory.resolve("evidence.json");
        Path minimum = directory.resolve("minimum-version");
        Files.writeString(minimum, "1\n");
        var reader = fileReader(file, minimum);
        var replay = new GuideAnswerReplay(reader);
        var stored = new GuideAnswerReplay.StoredAnswer(EXHIBIT, LOCALE, "Previously shown", List.of(REF));
        String published = publishedPack();
        assertTrue(reader.search(EXHIBIT, LOCALE, "ding").isEmpty());
        writeTestPack(file, published);
        assertEquals("Synthetic description", reader.search(EXHIBIT, LOCALE, "ding").get(0).text());
        assertEquals(URI.create("https://museum.example.test/record"),
                replay.replay(EXHIBIT, LOCALE, stored).orElseThrow().citations().get(0).publicSource());
        assertTrue(reader.search(EXHIBIT, "en-US", "ding").isEmpty());

        for (String unusable : List.of(
                published.replace("PUBLISHED", "WITHDRAWN").replace("\"releaseVersion\":1", "\"releaseVersion\":2"),
                published.replace("PUBLISHED", "DRAFT"),
                published.replace("\"formatVersion\":1", "\"formatVersion\":2"),
                published.replace("\"formatVersion\":1", "\"formatVersion\":1,\"formatVersion\":1"),
                published.replace("2026-11-18T00:00:00Z", "invalid-date"),
                published.replace("https://museum.example.test/record", "file:///private"),
                published + "{}",
                published + " ".repeat(256 * 1024),
                "{")) {
            writeTestPack(file, unusable);
            assertTrue(reader.search(EXHIBIT, LOCALE, "ding").isEmpty());
            assertTrue(replay.replay(EXHIBIT, LOCALE, stored).isEmpty());
        }
        Files.delete(file);
        assertTrue(replay.replay(EXHIBIT, LOCALE, stored).isEmpty());
    }

    @Test
    void fileBackedConflictsBlockRetrievalAndPreviouslyStoredAnswers(@TempDir Path directory) throws Exception {
        Path file = directory.resolve("evidence.json");
        Path minimum = directory.resolve("minimum-version");
        Files.writeString(minimum, "1");
        var reader = fileReader(file, minimum);
        var stored = new GuideAnswerReplay.StoredAnswer(EXHIBIT, LOCALE, "Previously shown", List.of(REF));
        var mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        var pack = mapper.readValue(publishedPack(), com.fasterxml.jackson.databind.node.ObjectNode.class);
        var cards = (com.fasterxml.jackson.databind.node.ArrayNode) pack.get("cards");
        var first = (com.fasterxml.jackson.databind.node.ObjectNode) cards.get(0);
        first.putObject("claim").put("key", "manufacture-period").put("value", "period-a");
        writeTestPack(file, mapper.writeValueAsString(pack));
        assertEquals(1, reader.search(EXHIBIT, LOCALE, "ding").size());
        assertTrue(new GuideAnswerReplay(reader).replay(EXHIBIT, LOCALE, stored).isPresent());

        var other = first.deepCopy().put("id", "DATE-B");
        other.putArray("aliases").add("chronology");
        other.putObject("claim").put("key", "manufacture-period").put("value", "period-b");
        cards.add(other);
        writeTestPack(file, mapper.writeValueAsString(pack));
        assertTrue(reader.searchCandidates(EXHIBIT, LOCALE, "ding").disputed());
        assertPackUnavailable(reader, stored);

        other.put("status", "DRAFT");
        writeTestPack(file, mapper.writeValueAsString(pack));
        assertEquals(1, reader.search(EXHIBIT, LOCALE, "ding").size());
        ((com.fasterxml.jackson.databind.node.ObjectNode) other.get("claim")).put("value", "");
        writeTestPack(file, mapper.writeValueAsString(pack));
        assertPackUnavailable(reader, stored);
    }

    @Test
    void separatelyMaintainedMinimumBlocksOldPackAfterReopening(@TempDir Path directory) throws Exception {
        Path file = directory.resolve("evidence.json");
        Path minimum = directory.resolve("minimum-version");
        var stored = new GuideAnswerReplay.StoredAnswer(EXHIBIT, LOCALE, "Previously shown", List.of(REF));
        String published = publishedPack();
        writeTestPack(file, published);
        var reader = fileReader(file, minimum);
        assertPackUnavailable(reader, stored);
        for (String malformed : List.of("", "0", "-1", "1 2", "2147483648", "1" + " ".repeat(16))) {
            Files.writeString(minimum, malformed);
            assertPackUnavailable(reader, stored);
        }
        Files.writeString(minimum, "1\n");
        assertEquals(1, reader.search(EXHIBIT, LOCALE, "ding").size());
        assertTrue(new GuideAnswerReplay(reader).replay(EXHIBIT, LOCALE, stored).isPresent());

        Files.writeString(minimum, "2\n");
        assertPackUnavailable(reader, stored);
        String versionTwo = published.replace("\"releaseVersion\":1", "\"releaseVersion\":2");
        writeTestPack(file, versionTwo.replace("PUBLISHED", "WITHDRAWN"));
        assertPackUnavailable(reader, stored);

        writeTestPack(file, published);
        assertPackUnavailable(reader, stored);
        assertPackUnavailable(fileReader(file, minimum), stored);

        writeTestPack(file, versionTwo.replace("\"releaseVersion\":2", "\"releaseVersion\":3")
                .replace("\"revision\":1", "\"revision\":2"));
        assertEquals(1, reader.search(EXHIBIT, LOCALE, "ding").size());
        assertTrue(new GuideAnswerReplay(reader).replay(EXHIBIT, LOCALE, stored).isEmpty());
    }

    @Test
    void editorialDraftParsesButCannotBeRetrievedOrReplayed(@TempDir Path directory) throws Exception {
        Path file = Path.of("..", "docs", "plans", "luosheng-eval", "ding-zh-CN-0.3.0-draft.json");
        Path minimum = directory.resolve("minimum-version");
        Files.writeString(minimum, "1");
        Path digest = directory.resolve("draft.sha256");
        Files.writeString(digest, "85b865db77d6d52b1ae9348ff88de77c0a31703d98f0fa462d5f69d102878e51");
        var source = new GuideEvidenceFileSource(file, minimum, digest);
        var drafts = source.current(EXHIBIT, LOCALE);
        var expected = List.of(
                new GuideEvidenceVisibility.Reference("LS-DING-EARS", 1),
                new GuideEvidenceVisibility.Reference("LS-DING-FEET", 1),
                new GuideEvidenceVisibility.Reference("LS-DING-MOTIF", 2),
                new GuideEvidenceVisibility.Reference("LS-DING-SOURCE", 2));
        assertEquals(expected, drafts.stream()
                .map(row -> new GuideEvidenceVisibility.Reference(row.card().id(), row.card().revision())).toList());
        var reader = new GuideEvidenceReader(source, new GuideEvidenceVisibility(jdbc, CLOCK));
        for (int index = 0; index < drafts.size(); index++) {
            var row = drafts.get(index);
            assertEquals(GuideEvidenceVisibility.Status.DRAFT, row.card().status());
            assertEquals(null, row.card().publishedAt());
            assertEquals(ARTIFACT, row.card().artifactSlug());
            assertFalse(row.text().isBlank());
            assertTrue(reader.search(EXHIBIT, LOCALE, row.aliases().get(0)).isEmpty());
            var stored = new GuideAnswerReplay.StoredAnswer(EXHIBIT, LOCALE, row.text(), List.of(expected.get(index)));
            assertTrue(new GuideAnswerReplay(reader).replay(EXHIBIT, LOCALE, stored).isEmpty());
        }
        assertTrue(drafts.subList(0, 3).stream().allMatch(row -> row.publicSource() == null));
        assertEquals(URI.create("https://www.clevelandart.org/art/1962.281"), drafts.get(3).publicSource());
    }

    @Test
    void releaseCandidatePreservesReviewedCardsAndRespectsEffectiveTime(@TempDir Path directory) throws Exception {
        Path packs = Path.of("..", "docs", "plans", "luosheng-eval");
        Path minimum = directory.resolve("minimum-version");
        Files.writeString(minimum, "2");
        Path snapshotDigest = directory.resolve("snapshot.sha256");
        Path candidateDigest = directory.resolve("candidate.sha256");
        Files.writeString(snapshotDigest, "b598d6a1be09f8afa088fbb0150c945ad458e553773f1c8c523f59984f5232d8");
        Files.writeString(candidateDigest, "15a509ba0f56c7cd8abaaaedaa89fb53e85a4269ad11fb56555e9fe725ac71ef");
        var snapshot = new GuideEvidenceFileSource(
                packs.resolve("ding-zh-CN-0.3.0-review-candidate.json"), minimum, snapshotDigest);
        var candidate = new GuideEvidenceFileSource(
                packs.resolve("ding-zh-CN-0.3.0-release-candidate.json"), minimum, candidateDigest);
        var reviewed = snapshot.current(EXHIBIT, LOCALE);
        var cards = candidate.current(EXHIBIT, LOCALE);
        assertEquals(4, reviewed.size());
        assertEquals(reviewed.size(), cards.size());

        var effectiveAt = Instant.parse("2026-11-20T04:45:05Z");
        var before = new GuideEvidenceReader(candidate,
                new GuideEvidenceVisibility(jdbc, Clock.fixed(effectiveAt.minusSeconds(1), ZoneOffset.UTC)));
        var at = new GuideEvidenceReader(candidate,
                new GuideEvidenceVisibility(jdbc, Clock.fixed(effectiveAt, ZoneOffset.UTC)));
        for (int i = 0; i < cards.size(); i++) {
            var draft = reviewed.get(i);
            var row = cards.get(i);
            var ref = new GuideEvidenceVisibility.Reference(draft.card().id(), draft.card().revision());
            assertEquals(draft.text(), row.text());
            assertEquals(draft.aliases(), row.aliases());
            assertEquals(draft.publicSource(), row.publicSource());
            assertEquals(draft.card().artifactSlug(), row.card().artifactSlug());
            assertEquals(GuideEvidenceVisibility.Status.PUBLISHED, row.card().status());
            assertEquals(effectiveAt, row.card().publishedAt());
            assertTrue(before.search(EXHIBIT, LOCALE, row.aliases().get(0)).isEmpty());
            assertTrue(before.resolve(EXHIBIT, LOCALE, List.of(ref)).isEmpty());
            assertTrue(at.search(EXHIBIT, LOCALE, row.aliases().get(0)).contains(row));
            assertEquals(List.of(row), at.resolve(EXHIBIT, LOCALE, List.of(ref)).orElseThrow());
        }
    }

    @Test
    void frozenEightCardReviewSnapshotCannotBeRetrievedOrReplayed(@TempDir Path directory) throws Exception {
        Path snapshot = Path.of("..", "docs", "plans", "luosheng-eval", "ding-zh-CN-0.5.0-review-candidate.json");
        Path minimum = directory.resolve("minimum-version");
        Path fixtureDigest = directory.resolve("snapshot.sha256");
        Files.writeString(minimum, "4");
        Files.writeString(fixtureDigest, "5f8c1c89e7ffdc2e1e84e42ae8f9925ec6fb9248ed74def0c33b3a930e9b7a79");
        var source = new GuideEvidenceFileSource(snapshot, minimum, fixtureDigest);
        var reader = new GuideEvidenceReader(source, new GuideEvidenceVisibility(jdbc, Clock.systemUTC()));
        var rows = source.current(EXHIBIT, LOCALE);
        assertEquals(List.of("LS-DING-SOURCE", "LS-DING-EARS", "LS-DING-FEET", "LS-DING-MOTIF",
                "LS-DING-RECORD-02", "LS-DING-MODEL-02", "LS-DING-PERIOD", "LS-DING-SIZE"),
                rows.stream().map(row -> row.card().id()).toList());
        for (var row : rows) {
            assertEquals(GuideEvidenceVisibility.Status.DRAFT, row.card().status());
            assertEquals(null, row.card().publishedAt());
            assertTrue(reader.search(EXHIBIT, LOCALE, row.aliases().get(0)).isEmpty());
            var ref = new GuideEvidenceVisibility.Reference(row.card().id(), row.card().revision());
            var saved = new GuideAnswerReplay.StoredAnswer(EXHIBIT, LOCALE, row.text(), List.of(ref));
            assertTrue(new GuideAnswerReplay(reader).replay(EXHIBIT, LOCALE, saved).isEmpty());
        }
    }

    @Test
    void eightCardSignoffCandidateCannotBeUsedBeforeItsPlaceholderDate(@TempDir Path directory) throws Exception {
        Path pack = Path.of("..", "docs", "plans", "luosheng-eval", "ding-zh-CN-0.5.0-signoff-candidate.json");
        Path minimum = directory.resolve("minimum-version");
        Path fixtureDigest = directory.resolve("candidate.sha256");
        Files.writeString(minimum, "4");
        Files.writeString(fixtureDigest, "5d82f52922a706af27783571cbb0966b75ff63e0388308953e73161f464a798f");
        var source = new GuideEvidenceFileSource(pack, minimum, fixtureDigest);
        var effectiveAt = Instant.parse("2099-01-01T00:00:00Z");
        var visibilityBefore = new GuideEvidenceVisibility(jdbc, Clock.fixed(effectiveAt.minusSeconds(1), ZoneOffset.UTC));
        var visibilityAt = new GuideEvidenceVisibility(jdbc, Clock.fixed(effectiveAt, ZoneOffset.UTC));
        var before = new GuideEvidenceReader(source, visibilityBefore);
        var at = new GuideEvidenceReader(source, visibilityAt);
        var rows = source.current(EXHIBIT, LOCALE);
        assertEquals(8, rows.size());
        for (var row : rows) {
            var ref = new GuideEvidenceVisibility.Reference(row.card().id(), row.card().revision());
            var saved = new GuideAnswerReplay.StoredAnswer(EXHIBIT, LOCALE, row.text(), List.of(ref));
            assertTrue(before.search(EXHIBIT, LOCALE, row.aliases().get(0)).isEmpty());
            assertTrue(new GuideAnswerReplay(before).replay(EXHIBIT, LOCALE, saved).isEmpty());
            assertEquals(List.of(row), at.resolve(EXHIBIT, LOCALE, List.of(ref)).orElseThrow());
        }
    }

    @Test
    void rejectsByteChangesAndMissingApprovalForSameVersion(@TempDir Path directory) throws Exception {
        Path file = directory.resolve("evidence.json");
        Path minimum = directory.resolve("minimum-version");
        Path digest = testDigestPath(file);
        String original = publishedPack();
        var reader = fileReader(file, minimum);
        var stored = new GuideAnswerReplay.StoredAnswer(EXHIBIT, LOCALE, "Previously shown", List.of(REF));
        Files.writeString(minimum, "1");
        Files.writeString(file, original);
        assertPackUnavailable(reader, stored);
        writeTestPack(file, original);
        String approved = Files.readString(digest);
        assertEquals(1, reader.search(EXHIBIT, LOCALE, "ding").size());
        assertTrue(new GuideAnswerReplay(reader).replay(EXHIBIT, LOCALE, stored).isPresent());
        Files.writeString(file, original.replace("Synthetic description", "Changed description"));
        assertPackUnavailable(reader, stored);
        assertPackUnavailable(fileReader(file, minimum), stored);
        Files.writeString(file, original);
        for (String invalid : List.of("", "0".repeat(64), approved + "\n\n", approved + " ".repeat(67))) {
            Files.writeString(digest, invalid);
            assertPackUnavailable(reader, stored);
        }
        Files.writeString(digest, approved + "\r\n");
        assertEquals(1, reader.search(EXHIBIT, LOCALE, "ding").size());
        assertTrue(new GuideAnswerReplay(reader).replay(EXHIBIT, LOCALE, stored).isPresent());
        Files.delete(digest);
        assertPackUnavailable(reader, stored);
    }

    private static String publishedPack() {
        return """
                {"formatVersion":1,"releaseVersion":1,"cards":[{
                  "id":"TEST-CARD","revision":1,"exhibitSlug":"heluo-bronze-ding-3d",
                  "artifactSlug":"heluo-bronze-ding","locale":"zh-CN","status":"PUBLISHED",
                  "publishedAt":"2026-11-18T00:00:00Z","text":"Synthetic description",
                  "aliases":["ding"],"publicSource":"https://museum.example.test/record"
                }]}
                """;
    }

    private GuideEvidenceReader fileReader(Path file, Path minimum) {
        return new GuideEvidenceReader(new GuideEvidenceFileSource(file, minimum, testDigestPath(file)),
                new GuideEvidenceVisibility(jdbc, CLOCK));
    }

    private static Path testDigestPath(Path file) {
        return file.resolveSibling(file.getFileName() + ".sha256");
    }

    private static void writeTestPack(Path file, String content) throws Exception {
        Files.writeString(file, content);
        byte[] hash = MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(file));
        Files.writeString(testDigestPath(file), HexFormat.of().formatHex(hash));
    }

    private static void assertPackUnavailable(GuideEvidenceReader reader, GuideAnswerReplay.StoredAnswer stored) {
        assertTrue(reader.search(EXHIBIT, LOCALE, "ding").isEmpty());
        assertTrue(new GuideAnswerReplay(reader).replay(EXHIBIT, LOCALE, stored).isEmpty());
    }

    @Test
    void databaseFailureAndMismatchedArtifactFailClosed() {
        var missingSchema = new DriverManagerDataSource("jdbc:h2:mem:guide-no-schema", "sa", "");
        assertFalse(new GuideEvidenceVisibility(new JdbcTemplate(missingSchema), CLOCK)
                .allows(EXHIBIT, LOCALE, REF, card(GuideEvidenceVisibility.Status.PUBLISHED, NOW, null)));
        var mismatch = new GuideEvidenceVisibility.Card("TEST-CARD", 1, EXHIBIT, "heluo-bronze-jue", LOCALE,
                GuideEvidenceVisibility.Status.PUBLISHED, NOW, null);
        assertFalse(new GuideEvidenceVisibility(jdbc, CLOCK).allows(EXHIBIT, LOCALE, REF, mismatch));
    }

    private GuideEvidenceVisibility.Card card(GuideEvidenceVisibility.Status status, Instant published, Instant expires) {
        return new GuideEvidenceVisibility.Card("TEST-CARD", 1, EXHIBIT, ARTIFACT, LOCALE, status, published, expires);
    }
}
