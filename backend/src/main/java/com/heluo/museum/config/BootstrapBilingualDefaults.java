package com.heluo.museum.config;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.Map;
import org.springframework.core.io.ClassPathResource;

/** Fresh demo installs insert rows after Flyway; V28 is the historical upgrade snapshot. */
final class BootstrapBilingualDefaults {
    private static final Map<String, Copy> COPY = load();

    static Copy get(String slug) {
        return COPY.getOrDefault(slug, new Copy(null, null, null, null, null, null));
    }

    private static Map<String, Copy> load() {
        try (var stream = new ClassPathResource("content/bootstrap-bilingual-defaults.json").getInputStream()) {
            return new ObjectMapper().readValue(stream, new TypeReference<>() {});
        } catch (IOException ex) {
            throw new IllegalStateException("无法读取初始化英文馆藏文案", ex);
        }
    }

    record Copy(String contentEn, String periodEn, String materialEn, String descriptionEn,
                String categoryCode, String inspirationArtifactSlug) {}
}
