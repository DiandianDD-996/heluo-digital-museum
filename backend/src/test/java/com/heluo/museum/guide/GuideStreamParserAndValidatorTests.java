package com.heluo.museum.guide;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.heluo.museum.guide.GuideModels.ChatRequest;
import com.heluo.museum.guide.GuideModels.PageContext;
import org.junit.jupiter.api.Test;

class GuideStreamParserAndValidatorTests {

    @Test
    void streamParserNeverLeaksDelimiterAcrossArbitraryChunkSplits() {
        String full = "侧面看只有两条腿，是因为第三只足正好被鼎身挡住了。\n<<<LUOSHENG_META>>>\n{\"citations\":[\"LS-DING-FEET\"],\"actions\":[]}";

        // Test 1-character chunks (worst-case split)
        var parser = new GuideStreamParser();
        StringBuilder emitted = new StringBuilder();
        for (int i = 0; i < full.length(); i++) {
            parser.feed(String.valueOf(full.charAt(i)), piece -> {
                assertThat(piece).doesNotContain("<<<");
                assertThat(piece).doesNotContain("LUOSHENG_META");
                emitted.append(piece);
            });
        }
        var result = parser.finish(emitted::append);

        assertThat(result.delimiterFound()).isTrue();
        assertThat(emitted.toString().strip()).isEqualTo("侧面看只有两条腿，是因为第三只足正好被鼎身挡住了。");
        assertThat(result.body()).isEqualTo("侧面看只有两条腿，是因为第三只足正好被鼎身挡住了。");
        assertThat(result.rawMeta()).isEqualTo("{\"citations\":[\"LS-DING-FEET\"],\"actions\":[]}");
    }

    @Test
    void streamParserHandlesMissingDelimiterGracefully() {
        var parser = new GuideStreamParser();
        StringBuilder emitted = new StringBuilder();
        parser.feed("这是一段没有分隔符的纯文本讲解。", emitted::append);
        var result = parser.finish(emitted::append);

        assertThat(result.delimiterFound()).isFalse();
        assertThat(result.body()).isEqualTo("这是一段没有分隔符的纯文本讲解。");
        assertThat(result.rawMeta()).isEmpty();
        assertThat(emitted.toString()).isEqualTo("这是一段没有分隔符的纯文本讲解。");
    }

    @Test
    void redlineValidatorAllowsNormalMuseumWordsAndBlocksAffirmativeHallucinations() {
        var validator = new GuideResponseValidator(null, new ObjectMapper());
        var dingCtx = new PageContext("exhibit-detail", "heluo-bronze-ding", "heluo-bronze-ding-3d", null, null);
        var conceptCtx = new PageContext("artifact-detail", "river-map-jade-bi", null, null, null);

        // Normal museum prose mentioning 尺寸, 重量, 出土, 青铜 with honest boundaries MUST PASS!
        assertThat(validator.violatesRedline(
                "参考实物的整体尺寸是 24.5 × 20 厘米，重量与内壁铭文未在公开资料中记载。馆方公开档案未填写出土地，因此不能确认是否洛阳出土。",
                dingCtx)).isFalse();
        assertThat(validator.violatesRedline(
                "现有资料不支持断定它是否铸于武丁时期，也不能估算市场估价，且洛笙无法替您完成预约或下单。",
                dingCtx)).isFalse();

        // Affirmative hallucinations MUST BE BLOCKED!
        assertThat(validator.violatesRedline("这件青铜鼎出土于洛阳二里头遗址，工艺精湛。", dingCtx)).isTrue();
        assertThat(validator.violatesRedline("该青铜鼎铸造于商王武丁时期，距今三千多年。", dingCtx)).isTrue();
        assertThat(validator.violatesRedline("目前这件青铜鼎的市场估价约 500 万元。", dingCtx)).isTrue();
        assertThat(validator.violatesRedline("已为您完成预约，请明天上午准时入馆。", dingCtx)).isTrue();
        assertThat(validator.violatesRedline("这件玉璧是真实出土文物，极具考古价值。", conceptCtx)).isTrue();
    }

    @Test
    void bareUrlsAreStrippedFromProse() {
        var validator = new GuideResponseValidator(null, new ObjectMapper());
        String stripped = validator.stripBareUrls("请参考 https://evil.example.com/fake 页面或 http://foo.bar/test 查看。");
        assertThat(stripped).doesNotContain("http://").doesNotContain("https://");
        assertThat(stripped).contains("请参考").contains("查看。");
    }

    @Test
    void historySanitizerCapsLengthStripsDelimiterAndControlChars() {
        var longText = "a".repeat(500) + GuideStreamParser.DELIMITER + "\u0007";
        var cleaned = GuidePromptBuilder.sanitizeText(longText, 400);
        assertThat(cleaned).doesNotContain(GuideStreamParser.DELIMITER);
        assertThat(cleaned).doesNotContain("\u0007");
        assertThat(cleaned.codePointCount(0, cleaned.length())).isLessThanOrEqualTo(400);
    }

    @Test
    void validatorAllowsViewerTourAndNavigateWithPeopleAndCategory() {
        var knowledge = org.mockito.Mockito.mock(GuideKnowledgeService.class);
        var exhibit = new GuideKnowledgeService.ExhibitItem(
                "heluo-bronze-ding-3d", "河洛青铜鼎 3D", "Heluo Bronze Ding 3D",
                "摘要", "Summary", "说明", "01", "CMA", "https://www.clevelandart.org/art/1962.281", "CC0",
                "Digital Hall", "heluo-bronze-ding", "河洛青铜鼎");
        var snapshot = new GuideKnowledgeService.CatalogSnapshot(
                java.util.List.of(), java.util.List.of(), java.util.List.of(exhibit), java.util.List.of(),
                java.util.Map.of(), java.util.Map.of(), java.util.Map.of(exhibit.slug(), exhibit), java.util.Map.of());
        org.mockito.Mockito.when(knowledge.catalog()).thenReturn(snapshot);

        var validator = new GuideResponseValidator(knowledge, new com.fasterxml.jackson.databind.ObjectMapper());
        var req = new GuideModels.ChatRequest("c1", "r1", "带我看3D并预约", "zh-CN",
                new GuideModels.PageContext("home", null, null, null, null), java.util.List.of());
        String meta = """
                {
                  "citations": [],
                  "actions": [
                    {"type":"viewer_tour","exhibitSlug":"heluo-bronze-ding-3d","label":"开启 3D 三步导览"},
                    {"type":"navigate","path":"/appointment","query":{"date":"2026-11-25","people":"4"},"label":"前往预约 4 人"},
                    {"type":"navigate","path":"/explore","query":{"category":"bronze"},"label":"看青铜器"}
                  ],
                  "followUps": []
                }
                """;
        var res = validator.validate(req, "为你准备好了导览与预约入口。", meta, new GuideToolExecutor.ToolAuditContext());
        assertThat(res.accepted()).isTrue();
        assertThat(res.actions()).hasSize(3);
        assertThat(res.actions().get(0).type()).isEqualTo("viewer_tour");
        assertThat(res.actions().get(1).query()).containsEntry("people", "4").containsEntry("date", "2026-11-25");
        assertThat(res.actions().get(2).query()).containsEntry("category", "bronze");
    }
}
