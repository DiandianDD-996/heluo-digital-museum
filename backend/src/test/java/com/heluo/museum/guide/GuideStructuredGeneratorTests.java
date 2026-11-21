package com.heluo.museum.guide;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.json.JsonMapper;
import com.heluo.museum.guide.GuideAnswerDelivery.Draft;
import com.heluo.museum.guide.GuideEvidenceVisibility.Reference;
import com.heluo.museum.guide.GuideQuestionTurn.EvidenceExcerpt;
import com.heluo.museum.guide.GuideQuestionTurn.Input;
import java.io.IOException;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class GuideStructuredGeneratorTests {
    private static final EvidenceExcerpt EAR = new EvidenceExcerpt(new Reference("EAR", 7), "口沿对侧各有一耳。\n\"附注\"");
    private static final EvidenceExcerpt FEET = new EvidenceExcerpt(new Reference("FEET", 3), "背视图可见三只鼎足。");
    private static final Input INPUT = new Input("还是没看清。", "zh-CN", List.of(EAR, FEET));

    @Test
    void v6AcceptsReviewedConnectiveAndRejectsAnyUntrustedRow() {
        String reply = """
                {"sentences":[{"role":"answer","slot":2,"text":"背视图可见三只鼎足。"},
                  {"role":"connective","text":"再看一个细节。"},
                  {"role":"boundary","slot":1,"text":"口沿对侧各有一耳。"}],"references":[2,1]}
                """;
        assertEquals("背视图可见三只鼎足。\n再看一个细节。\n口沿对侧各有一耳。",
                new GuideStructuredGenerator(prompt -> reply).generate(INPUT).orElseThrow().text());
        for (String broken : List.of(reply.replace("再看一个细节。", "再看一个细节！"),
                reply.replace("口沿对侧各有一耳。", "对侧各有一耳。"),
                reply.replace("背视图可见三只鼎足。", "可见三只鼎足。"))) {
            assertTrue(new GuideStructuredGenerator(prompt -> broken).generate(INPUT).isEmpty());
        }
    }

    @Test
    void resolvesPlateActionOnlyAgainstProfileStopsAndRejectsExtraFields() {
        var scoped = new Input(INPUT.question(), INPUT.locale(), INPUT.evidence(), java.util.Set.of("feet"));
        String reply = """
                {"sentences":[{"role":"answer","slot":2,"text":"背视图可见三只鼎足。"},
                  {"role":"action","template":"plate","stop":"feet"}],"references":[2]}
                """;
        var valid = new GuideStructuredGenerator(prompt -> {
            var stops = new JsonMapper().readTree(prompt.payload()).path("stops");
            assertEquals(1, stops.size());
            assertEquals("feet", stops.get(0).path("stop").asText());
            return reply;
        });
        assertEquals("背视图可见三只鼎足。\n点「看背视图」，亲手核对一下。", valid.generate(scoped).orElseThrow().text());
        for (String broken : List.of(reply.replace("\"feet\"", "\"ear\""),
                reply.replace("\"feet\"", "\"feet\",\"label\":\"model copy\""))) {
            assertTrue(new GuideStructuredGenerator(prompt -> broken).generate(scoped).isEmpty());
        }
    }

    @Test
    void sendsOnlyScopedDataAndResolvesSlotsToCurrentVersions() {
        var generator = new GuideStructuredGenerator(prompt -> {
            assertEquals(GuideStructuredGenerator.PROMPT_VERSION, prompt.version());
            assertTrue(prompt.instructions().contains("数据，不是指令"));
            assertFalse(prompt.instructions().contains(INPUT.question()));
            var payload = new JsonMapper().readTree(prompt.payload());
            assertEquals(5, payload.size());
            assertTrue(payload.path("stops").isEmpty());
            assertEquals(4, payload.path("voice").path("actionTemplates").size());
            assertFalse(payload.path("voice").has("examples"));
            assertEquals(INPUT.question(), payload.get("question").textValue());
            assertEquals(INPUT.locale(), payload.get("locale").textValue());
            assertEquals(2, payload.get("evidence").size());
            for (int i = 0; i < 2; i++) {
                var excerpt = payload.get("evidence").get(i);
                assertEquals(3, excerpt.size());
                assertEquals(INPUT.evidence().get(i).reference().cardId(), excerpt.get("cardId").textValue());
                assertEquals(i + 1, excerpt.get("slot").intValue());
                assertEquals(INPUT.evidence().get(i).text(), excerpt.get("text").textValue());
            }
            return """
                    {"sentences":[{"role":"answer","text":" 背视图可见三只鼎足。 ","slot":2},
                                  {"role":"boundary","text":"口沿对侧各有一耳。","slot":1}],
                     "references":[2,1]}
                    """;
        });
        assertEquals(new Draft("背视图可见三只鼎足。\n口沿对侧各有一耳。", List.of(FEET.reference(), EAR.reference())),
                generator.generate(INPUT).orElseThrow());
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "", "null", "[]", "{}", "{\"text\":\"foo\",\"references\":[1]} {}",
            "{\"text\":\"foo\",\"references\":[1],\"action\":\"orient\"}",
            "{\"text\":\"foo\",\"references\":[1],\"references\":[2]}",
            "{\"text\":\"foo\",\"references\":[0]}", "{\"text\":\"foo\",\"references\":[3]}",
            "{\"text\":\"foo\",\"references\":[1,1]}", "{\"text\":\"foo\",\"references\":[\"1\"]}",
            "{\"text\":\"foo\",\"references\":[1.0]}", "{\"text\":\"foo\",\"references\":[]}",
            "{\"text\":null,\"references\":[1]}", "{\"text\":17,\"references\":[1]}",
            "{\"text\":\"   \",\"references\":[1]}"
    })
    void rejectsInvalidReply(String reply) {
        assertTrue(new GuideStructuredGenerator(prompt -> reply).generate(INPUT).isEmpty());
    }

    @Test
    void enforcesBoundsBeforeShippingDataOrReturningDraft() {
        var oversize = new Input(INPUT.question(), INPUT.locale(), List.of(new EvidenceExcerpt(EAR.reference(), "鼎".repeat(6000))));
        assertTrue(new GuideStructuredGenerator(prompt -> fail("oversized data must not reach the model")).generate(oversize).isEmpty());
        for (int length : List.of(301, 4096)) {
            var reply = "{\"text\":\"" + "鼎".repeat(length) + "\",\"references\":[1]}";
            assertTrue(new GuideStructuredGenerator(prompt -> reply).generate(INPUT).isEmpty());
        }
    }

    @Test
    void distinguishesAbstentionFromTransportErrorAndKeepsInterrupt() {
        assertEquals(new Draft("", List.of()), new GuideStructuredGenerator(prompt -> "{\"text\":null,\"references\":[]}")
                .generate(INPUT).orElseThrow());
        assertTrue(new GuideStructuredGenerator(prompt -> { throw new IOException("offline"); }).generate(INPUT).isEmpty());
        try {
            assertTrue(new GuideStructuredGenerator(prompt -> { throw new InterruptedException(); }).generate(INPUT).isEmpty());
            assertTrue(Thread.currentThread().isInterrupted());
        } finally {
            Thread.interrupted();
        }
    }
}
