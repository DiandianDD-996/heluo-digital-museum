package com.heluo.museum.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.util.Map;

/**
 * Single source of truth for initial museum editorial copy and bilingual metadata,
 * loaded from classpath resource {@code content/seed-editorial-copy.json}.
 */
final class SeedEditorialContent {
    private static final String RESOURCE_PATH = "content/seed-editorial-copy.json";
    private static final SeedBundle BUNDLE = load();

    private SeedEditorialContent() {}

    static ArtifactSeed artifact(String slug) {
        return BUNDLE.artifacts().getOrDefault(slug, ArtifactSeed.EMPTY);
    }

    static ArticleSeed article(String slug) {
        return BUNDLE.articles().getOrDefault(slug, ArticleSeed.EMPTY);
    }

    static ExhibitSeed exhibit(String slug) {
        return BUNDLE.exhibits().getOrDefault(slug, ExhibitSeed.EMPTY);
    }

    static ProductSeed product(String slug) {
        return BUNDLE.products().getOrDefault(slug, ProductSeed.EMPTY);
    }

    private static SeedBundle load() {
        try (InputStream stream = SeedEditorialContent.class.getClassLoader().getResourceAsStream(RESOURCE_PATH)) {
            if (stream == null) {
                throw new IllegalStateException("Missing seed editorial resource: " + RESOURCE_PATH);
            }
            return new ObjectMapper().readValue(stream, SeedBundle.class);
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to load seed editorial copy: " + RESOURCE_PATH, ex);
        }
    }

    record SeedBundle(
            Map<String, ArtifactSeed> artifacts,
            Map<String, ArticleSeed> articles,
            Map<String, ExhibitSeed> exhibits,
            Map<String, ProductSeed> products) {}

    record ArtifactSeed(String titleEn, String summaryEn, String dimensions, String collectionLocation, String content) {
        static final ArtifactSeed EMPTY = new ArtifactSeed(null, null, null, null, null);
    }

    record ArticleSeed(String titleEn, String summaryEn, String content) {
        static final ArticleSeed EMPTY = new ArticleSeed(null, null, null);
    }

    record ExhibitSeed(String title, String titleEn, String displayNo, String summary, String summaryEn, String description) {
        static final ExhibitSeed EMPTY = new ExhibitSeed(null, null, null, null, null, null);
    }

    record ProductSeed(String nameEn, String summaryEn, String description) {
        static final ProductSeed EMPTY = new ProductSeed(null, null, null);
    }
}
