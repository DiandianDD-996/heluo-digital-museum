package com.heluo.museum.config;

/** Initial translations for newly created demo records, backed by SeedEditorialContent. */
final class SeedContentEnglish {
    private SeedContentEnglish() {}

    record Translation(String title, String summary) {}

    static Translation forSlug(String slug) {
        var artifact = SeedEditorialContent.artifact(slug);
        if (artifact.titleEn() != null || artifact.summaryEn() != null) {
            return new Translation(artifact.titleEn(), artifact.summaryEn());
        }
        var article = SeedEditorialContent.article(slug);
        if (article.titleEn() != null || article.summaryEn() != null) {
            return new Translation(article.titleEn(), article.summaryEn());
        }
        return new Translation(null, null);
    }
}
