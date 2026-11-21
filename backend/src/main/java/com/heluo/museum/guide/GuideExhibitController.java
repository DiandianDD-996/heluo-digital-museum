package com.heluo.museum.guide;

import com.heluo.museum.common.api.ApiResponse;
import com.heluo.museum.common.error.ResourceNotFoundException;
import java.net.URI;
import java.nio.file.Path;
import java.time.Clock;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@ConditionalOnProperty(name = "museum.guide.preset-enabled", havingValue = "true")
class GuideExhibitController {
    private final GuideEvidenceVisibility visibility;
    private final GuideEvidenceReader reader;

    GuideExhibitController(JdbcTemplate jdbc,
                           @Value("${museum.guide.pack-path}") String pack,
                           @Value("${museum.guide.minimum-version-path}") String minimum,
                           @Value("${museum.guide.approved-digest-path}") String digest) {
        visibility = new GuideEvidenceVisibility(jdbc, Clock.systemUTC());
        reader = new GuideEvidenceReader(new GuideEvidenceFileSource(
                configuredPath(pack), configuredPath(minimum), configuredPath(digest)), visibility);
    }

    @GetMapping("/api/v1/guide/exhibits/{slug}")
    ResponseEntity<ApiResponse<Preset>> detail(@PathVariable String slug,
                                               @RequestParam(defaultValue = "zh-CN") String locale) {
        if (!locale.matches("[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8}){0,3}")) {
            throw new IllegalArgumentException("Invalid guide locale");
        }
        if (visibility.publicArtifactSlug(slug).isEmpty()) {
            throw new ResourceNotFoundException("Guide exhibit unavailable");
        }
        List<Entry> entries = reader.listPublished(slug, locale).stream()
                .map(row -> new Entry(row.card().id(), row.card().revision(), row.text(), row.publicSource()))
                .toList();
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(ApiResponse.ok(new Preset(slug, locale, !entries.isEmpty(), entries), "guide exhibit"));
    }

    private static Path configuredPath(String value) {
        if (value.isBlank()) throw new IllegalArgumentException("Missing guide evidence path");
        return Path.of(value);
    }

    record Preset(String exhibitSlug, String locale, boolean available, List<Entry> entries) {}
    record Entry(String cardId, int revision, String text, URI publicSource) {}
}
