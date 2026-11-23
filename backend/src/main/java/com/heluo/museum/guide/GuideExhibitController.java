package com.heluo.museum.guide;

import com.heluo.museum.common.api.ApiResponse;
import com.heluo.museum.common.error.ResourceNotFoundException;
import java.net.URI;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Read-only exhibit preset endpoint for static lookpoint plate cards (D3).
 */
@RestController
@ConditionalOnProperty(name = "museum.guide.enabled", havingValue = "true")
class GuideExhibitController {
    private final GuideKnowledgeService knowledge;

    GuideExhibitController(GuideKnowledgeService knowledge) {
        this.knowledge = knowledge;
    }

    @GetMapping("/api/v1/guide/exhibits/{slug}")
    ResponseEntity<ApiResponse<Preset>> detail(@PathVariable String slug,
                                               @RequestParam(defaultValue = "zh-CN") String locale) {
        if (!locale.matches("[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8}){0,3}")) {
            throw new IllegalArgumentException("Invalid guide locale");
        }
        knowledge.invalidateCache();
        if (knowledge.findExhibit(slug).isEmpty()) {
            throw new ResourceNotFoundException("Guide exhibit unavailable");
        }
        String targetLocale = locale.toLowerCase().startsWith("en") ? "en-US" : "zh-CN";
        List<Entry> entries = knowledge.evidenceCards(slug, targetLocale).stream()
                .map(row -> new Entry(row.card().id(), row.card().revision(), row.spokenText(), row.publicSource()))
                .toList();
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(ApiResponse.ok(new Preset(slug, targetLocale, !entries.isEmpty(), entries), "guide exhibit"));
    }

    record Preset(String exhibitSlug, String locale, boolean available, List<Entry> entries) {}
    record Entry(String cardId, int revision, String text, URI publicSource) {}
}
