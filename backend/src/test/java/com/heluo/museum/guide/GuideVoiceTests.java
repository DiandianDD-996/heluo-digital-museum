package com.heluo.museum.guide;

import static org.junit.jupiter.api.Assertions.*;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

class GuideVoiceTests {
    @Test
    void loadsOnlyReviewedCopyAndUsesSuppliedStops() {
        var voice = GuideVoice.packaged();
        assertEquals("缺的是：参考实物的断代资料。", voice.missing("PERIOD"));
        var stops = voice.stops(Set.of("feet", "out-of-profile"));
        assertEquals(List.of(new GuideVoice.Stop("feet", "看背视图")), stops);
        assertEquals("点「看背视图」，亲手核对一下。", voice.renderAction("plate", "feet", stops));
        assertNull(voice.renderAction("plate", "ear", stops));
        assertNull(voice.renderAction("plate", null, stops));
        assertNull(voice.renderAction("source", "feet", stops));
        assertNull(voice.renderAction("not-reviewed", null, stops));
    }

    @Test
    void missingOrMalformedVoiceFailsStartupEvenWithoutEnablingTheGuide() throws IOException {
        String valid;
        try (var stream = GuideVoice.class.getResourceAsStream("/guide/voice.zh-CN.json")) {
            valid = new String(stream.readAllBytes(), StandardCharsets.UTF_8);
        }
        for (String bad : List.of(valid.replace("\"version\": 1", "\"version\": 2"),
                valid.replace("zh-CN", "en-US"), valid.replace("{label}", "{point}"),
                valid.replace("{missing}", "{missing}{missing}"), valid.replace("\"震撼\"", "\"精美的\""),
                valid.replace("换个角度再看。", "一定是。"), valid.replace("出土地记录", "没有出土地记录。"),
                valid.replace("\"maxSentenceChars\": 120", "\"maxSentenceChars\": 121"),
                valid.replace("换个角度再看。", "看".repeat(121)), valid + "{}", "")) {
            assertNotEquals(valid, bad);
            assertThrows(IllegalArgumentException.class, () -> load(bad));
        }
        new ApplicationContextRunner().withBean(GuideVoice.class, () -> load(null)).run(context -> {
            org.assertj.core.api.Assertions.assertThat(context.getStartupFailure())
                    .hasRootCauseMessage("Invalid guide voice: missing resource");
        });
    }

    private static GuideVoice load(String voice) {
        return new GuideVoice(voice == null ? null : new ByteArrayInputStream(voice.getBytes(StandardCharsets.UTF_8)),
                GuideVoice.class.getResourceAsStream("/guide/ui.zh-CN.json"));
    }
}
