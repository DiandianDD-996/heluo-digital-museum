package com.heluo.museum.guide;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.json.JsonMapper;
import com.heluo.museum.guide.GuideAnswerDelivery.Draft;
import com.heluo.museum.guide.GuideEvidenceVisibility.Reference;
import com.heluo.museum.guide.GuideQuestionTurn.EvidenceExcerpt;
import com.heluo.museum.guide.GuideQuestionTurn.Input;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;

@ExtendWith(OutputCaptureExtension.class)
class GuideGroundedDraftTests {
    private static final JsonMapper JSON = new JsonMapper();
    private static final EvidenceExcerpt EAR = new EvidenceExcerpt(new Reference("EAR", 1),
            "俯视图里，鼎口两侧各有一只鼎耳。仅凭外形不能判断鼎耳用途。");
    private static final EvidenceExcerpt FEET = new EvidenceExcerpt(new Reference("FEET", 2),
            "背视图的中间和两侧各可辨一足。不能据此判断原器缺损。");
    private static final EvidenceExcerpt SOURCE = new EvidenceExcerpt(new Reference("SOURCE", 3),
            "参考藏品编号为 ＡＢＣ　１２３。馆藏记录没有填写出土地。");
    private static final Input INPUT = new Input("怎么观察和核对？", "zh-CN", List.of(EAR, FEET, SOURCE));
    private static final String EAR_VIEW = "俯视图里，鼎口两侧各有一只鼎耳。";
    private static final String FEET_VIEW = "背视图的中间和两侧各可辨一足。";

    @Test
    void acceptsScopedQuotesDeduplicatesReferencesAndNormalizesCompatibilityCharacters() throws Exception {
        String sourceText = "参考藏品编号为 ABC 123。";
        var answer = generate(draft(List.of(
                sentence(EAR_VIEW, 1, "鼎口两侧各有一只鼎耳"),
                sentence(sourceText, 3, "ＡＢＣ\t１２３")), List.of(3, 1, 3)));
        assertEquals(List.of(SOURCE.reference(), EAR.reference()), answer.references());
        assertTrue(answer.text().contains(sourceText));
    }

    @Test
    void rejectsTaintedDraftAtomically() throws Exception {
        var good = sentence(EAR_VIEW, 1, "鼎口两侧各有一只鼎耳");
        var rewrites = sentence(FEET_VIEW, 2, "从后方可以看见三足");
        var wrongCard = sentence(EAR_VIEW, 2, "鼎口两侧各有一只鼎耳");
        var fabricated = sentence("这件鼎在洛阳出土。", 1, "鼎口两侧各有一只鼎耳");
        var clippedQualifier = sentence("判断鼎耳用途。", 1, "判断鼎耳用途。");
        var invalid = List.of(
                draft(List.of(good, rewrites), List.of(1, 2)),
                draft(List.of(wrongCard), List.of(2)),
                draft(List.of(Map.of("text", EAR_VIEW, "slot", 1)), List.of(1)),
                draft(List.of(good, sentence(FEET_VIEW, 2, FEET_VIEW), fabricated), List.of(1, 2)),
                draft(List.of(clippedQualifier), List.of(1)),
                draft(List.of(sentence(EAR_VIEW, 1, "鼎口")), List.of(1)),
                draft(List.of(good), List.of(1, 2)),
                draft(List.of(good), List.of(2)),
                draft(List.of(good), List.of(1, 4)),
                draft(List.of(good), List.of("1")),
                draft(List.of(sentence(EAR_VIEW, 0, EAR_VIEW)), List.of(1)),
                draft(List.of(), List.of(1)),
                draft(java.util.Collections.nCopies(7, good), List.of(1)),
                draft(List.of(good), List.of(1)) + " {}",
                "{\"sentences\":[{\"text\":\"ignored\",\"text\":\"dup\",\"slot\":1,\"quote\":\"abcdef\"}],\"references\":[1]}");
        for (String reply : invalid) {
            assertTrue(new GuideStructuredGenerator(prompt -> reply).generate(INPUT).isEmpty(), reply);
        }
    }

    @Test
    void enforcesUnicodeCodePointLimitsOnIndividualAndCombinedText() throws Exception {
        String one = "𠮷".repeat(119) + "。";
        String two = "𠮵".repeat(119) + "。";
        String three = "𠮶".repeat(63) + "。";
        String over = "𠮸".repeat(121);
        var input = new Input("观察？", "zh-CN", List.of(new EvidenceExcerpt(EAR.reference(),
                String.join("", one, two, three, over))));
        for (var rows : List.of(List.of(sentence(over, 1, over)),
                List.of(sentence(one, 1, one), sentence(two, 1, two), sentence(three, 1, three)))) {
            assertTrue(new GuideStructuredGenerator(prompt -> draft(rows, List.of(1))).generate(input).isEmpty());
        }
        // Two newline separators are included in the final displayed 300-code-point budget.
        String tail = "𠮶".repeat(58);
        var exact = List.of(sentence(one, 1, one), sentence(two, 1, two), sentence(tail, 1, tail));
        var boundary = new Input(input.question(), input.locale(), List.of(new EvidenceExcerpt(EAR.reference(),
                String.join("", one, two, tail))));
        var answer = new GuideStructuredGenerator(prompt -> draft(exact, List.of(1))).generate(boundary).orElseThrow();
        assertEquals(300, answer.text().codePointCount(0, answer.text().length()));
    }

    @Test
    void countsInvalidRepliesButDoesNotLogTheirContents(CapturedOutput output) {
        var registry = new SimpleMeterRegistry();
        try {
            var rejected = registry.counter("museum.guide.generation.rejected");
            String sensitive = "fixture-private-body-do-not-log";
            var bad = new GuideStructuredGenerator(prompt -> sensitive, rejected::increment);
            var abstain = new GuideStructuredGenerator(prompt -> "{\"text\":null,\"references\":[]}", rejected::increment);
            var offline = new GuideStructuredGenerator(prompt -> null, rejected::increment);
            assertTrue(bad.generate(INPUT).isEmpty());
            assertEquals(new Draft("", List.of()), abstain.generate(INPUT).orElseThrow());
            assertTrue(offline.generate(INPUT).isEmpty());
            assertEquals(1, rejected.count());
            assertTrue(output.getOut().contains("event=guide_generation_rejected"));
            assertFalse(output.getAll().contains(sensitive));
            assertFalse(output.getAll().contains(INPUT.question()));
            assertFalse(output.getAll().contains(EAR.text()));
        } finally {
            registry.close();
        }
    }

    @Test
    void fixedOfflineCorpusComparesV4AndV5AgainstTheSameEvidence() throws Exception {
        record Sample(String text, int slot, String quote, boolean supported) {}
        var cases = List.of(
                new Sample(EAR_VIEW, 1, "鼎口两侧各有一只鼎耳", true),
                new Sample("仅凭外形不能判断鼎耳用途。", 1, "不能判断鼎耳用途", true),
                new Sample(FEET_VIEW, 2, "中间和两侧各可辨一足", true),
                new Sample("不能据此判断原器缺损。", 2, "不能据此判断原器缺损", true),
                new Sample("参考藏品编号为 ABC 123。", 3, "ＡＢＣ　１２３", true),
                new Sample("馆藏记录没有填写出土地。", 3, "没有填写出土地", true),
                new Sample(EAR.text(), 1, "一只鼎耳。仅凭外形", true),
                new Sample("该鼎肯定在洛阳出土。", 3, "没有填写出土地", false),
                new Sample(FEET_VIEW, 1, FEET_VIEW, false),
                new Sample("判断原器缺损。", 2, "判断原器缺损。", false));
        int accepted = 0;
        int falsePositives = 0;
        for (Sample sample : cases) {
            var adapter = new GuideStructuredGenerator(prompt -> "luosheng-structured-v4".equals(prompt.version())
                    ? JSON.writeValueAsString(Map.of("text", sample.text(), "references", List.of(sample.slot())))
                    : draft(List.of(sentence(sample.text(), sample.slot(), sample.quote())), List.of(sample.slot())));
            if (adapter.generate(INPUT).isPresent()) {
                accepted++;
                if (!sample.supported()) falsePositives++;
            }
        }
        System.out.printf("offline-grounding version=%s accepted=%d rejected=%d falsePositives=%d unsupported=3 total=%d%n",
                GuideStructuredGenerator.PROMPT_VERSION, accepted, cases.size() - accepted, falsePositives, cases.size());
        assertTrue(accepted * 100 >= cases.size() * 60, "acceptance below 60%");
        assertEquals(0, falsePositives);
        assertEquals(7, accepted, "all supported examples should pass");
    }

    private static Draft generate(String reply) {
        return new GuideStructuredGenerator(prompt -> reply).generate(INPUT).orElseThrow();
    }

    private static Map<String, Object> sentence(String text, int slot, String quote) {
        return Map.of("text", text, "slot", slot, "quote", quote);
    }

    private static String draft(List<? extends Map<String, ?>> sentences, List<?> references)
            throws com.fasterxml.jackson.core.JsonProcessingException {
        return JSON.writeValueAsString(Map.of("sentences", sentences, "references", references));
    }
}
