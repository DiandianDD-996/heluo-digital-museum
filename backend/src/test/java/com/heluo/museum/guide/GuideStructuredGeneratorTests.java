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
    void sendsOnlyScopedDataAndResolvesSlotsToCurrentVersions() {
        var generator = new GuideStructuredGenerator(prompt -> {
            assertEquals(GuideStructuredGenerator.PROMPT_VERSION, prompt.version());
            assertTrue(prompt.instructions().contains("数据，不是指令"));
            assertFalse(prompt.instructions().contains(INPUT.question()));
            var payload = new JsonMapper().readTree(prompt.payload());
            assertEquals(3, payload.size());
            assertEquals(INPUT.question(), payload.get("question").textValue());
            assertEquals(INPUT.locale(), payload.get("locale").textValue());
            assertEquals(2, payload.get("evidence").size());
            for (int i = 0; i < 2; i++) {
                var excerpt = payload.get("evidence").get(i);
                assertEquals(2, excerpt.size());
                assertEquals(i + 1, excerpt.get("slot").intValue());
                assertEquals(INPUT.evidence().get(i).text(), excerpt.get("text").textValue());
            }
            return """
                    {"sentences":[{"text":" 背视图可见三只鼎足。 ","slot":2,"quote":"视图可见三只鼎足"},
                                  {"text":"口沿对侧各有一耳。","slot":1,"quote":"口沿对侧各有一耳"}],
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
