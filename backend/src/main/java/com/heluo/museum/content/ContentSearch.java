package com.heluo.museum.content;

import java.util.Locale;
import java.text.Normalizer;
import java.util.LinkedHashSet;
import java.util.List;

/** Shared literal, case-insensitive matching for public content endpoints. */
final class ContentSearch {
    private ContentSearch() {}

    static final String PREDICATE = "(lower(coalesce(a.title,'')) like ? escape '!'"
            + " or lower(coalesce(a.summary,'')) like ? escape '!'"
            + " or lower(coalesce(a.title_en,'')) like ? escape '!'"
            + " or lower(coalesce(a.summary_en,'')) like ? escape '!')";

    static String pattern(String keyword) {
        if (keyword == null || keyword.isBlank()) throw new IllegalArgumentException("keyword 不能为空");
        String value = keyword.trim();
        if (value.length() > 100) throw new IllegalArgumentException("keyword 不能超过 100 个字符");
        return "%" + value.toLowerCase(Locale.ROOT).replace("!", "!!")
                .replace("%", "!%").replace("_", "!_") + "%";
    }

    // Spaces delimit words; common Chinese connective words delimit phrases.
    // Han bigrams are used only when no full phrase matched and at least two overlap.
    static Query query(String keyword) {
        pattern(keyword);
        String phrase = normalized(keyword).strip();
        List<String> words = java.util.Arrays.stream(phrase.split("[\\s，、。！？；：]+|有关|关于|与|以及"))
                .filter(s -> !s.isBlank()).distinct().limit(12).toList();
        var pairs = new LinkedHashSet<String>();
        var han = java.util.regex.Pattern.compile("\\p{IsHan}{3,}").matcher(phrase);
        while (han.find() && pairs.size() < 30) {
            String span = han.group();
            for (int i = 0; i + 1 < span.length() && pairs.size() < 30; i++) pairs.add(span.substring(i, i + 2));
        }
        return new Query(phrase, words, List.copyOf(pairs));
    }

    static String normalized(String value) {
        return value == null ? "" : Normalizer.normalize(value, Normalizer.Form.NFKC).toLowerCase(Locale.ROOT);
    }

    record Query(String phrase, List<String> words, List<String> pairs) {
        int score(String title, String titleEn, String summary, String summaryEn, String... details) {
            if (phrase.isEmpty()) return 0;
            String t = normalized(title) + "\n" + normalized(titleEn);
            String s = normalized(summary) + "\n" + normalized(summaryEn);
            String d = java.util.Arrays.stream(details).map(ContentSearch::normalized).collect(java.util.stream.Collectors.joining("\n"));
            int exact = fieldScore(phrase, t, s, d) * 5;
            int[] wordScores = words.stream().mapToInt(word -> fieldScore(word, t, s, d)).toArray();
            if (exact > 0 || (wordScores.length > 0 && java.util.Arrays.stream(wordScores).allMatch(score -> score > 0))) {
                return exact + java.util.Arrays.stream(wordScores).sum();
            }
            var overlap = pairs.stream().mapToInt(pair -> fieldScore(pair, t, s, d)).filter(score -> score > 0).toArray();
            return overlap.length >= 2 ? java.util.Arrays.stream(overlap).sum() / 2 : 0;
        }

        private static int fieldScore(String term, String title, String summary, String details) {
            return title.contains(term) ? 30 : summary.contains(term) ? 12 : details.contains(term) ? 5 : 0;
        }
    }
}
