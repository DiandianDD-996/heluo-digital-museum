package com.heluo.museum.guide;

import com.heluo.museum.guide.GuideEvidenceVisibility.Card;
import com.heluo.museum.guide.GuideEvidenceVisibility.Reference;
import java.net.URI;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.springframework.dao.DataAccessException;

final class GuideEvidenceReader {
    record Claim(String key, String value) {
        Claim {
            if (key == null || value == null || key.isBlank() || value.isBlank()) {
                throw new IllegalArgumentException("Invalid evidence claim");
            }
            key = normalize(key);
            value = normalize(value);
        }
    }

    record Evidence(Card card, String text, List<String> aliases, URI publicSource, Claim claim) {
        Evidence(Card card, String text, List<String> aliases, URI publicSource) {
            this(card, text, aliases, publicSource, null);
        }
        Evidence {
            aliases = List.copyOf(aliases);
        }
    }

    @FunctionalInterface
    interface Source {
        // Return current metadata and text together, not historical revisions or cached answers.
        List<Evidence> current(String exhibitSlug, String locale);
    }

    private final Source source;
    private final GuideEvidenceVisibility visibility;

    GuideEvidenceReader(Source source, GuideEvidenceVisibility visibility) {
        this.source = source;
        this.visibility = visibility;
    }

    List<Evidence> search(String exhibitSlug, String locale, String question) {
        return searchCandidates(exhibitSlug, locale, question).evidence();
    }

    record SearchResult(List<Evidence> evidence, boolean disputed) {}

    List<Evidence> listPublished(String exhibitSlug, String locale) {
        Map<String, Evidence> visible = visibleSnapshot(exhibitSlug, locale);
        Set<ClaimScope> conflicts = conflictingClaims(visible);
        return visible.values().stream()
                .filter(evidence -> !isDisputed(evidence, conflicts))
                .sorted(Comparator.comparing(evidence -> evidence.card().id()))
                .toList();
    }

    SearchResult searchCandidates(String exhibitSlug, String locale, String question) {
        if (question == null || question.isBlank()) return new SearchResult(List.of(), false);
        String normalized = normalize(question);
        Map<String, Evidence> visible = visibleSnapshot(exhibitSlug, locale);
        Set<ClaimScope> conflicts = conflictingClaims(visible);
        var matches = visible.values().stream()
                .map(evidence -> new Match(evidence, relevance(evidence, normalized)))
                .filter(match -> match.score() > 0)
                .toList();
        if (matches.stream().anyMatch(match -> isDisputed(match.evidence(), conflicts))) {
            return new SearchResult(List.of(), true);
        }
        return new SearchResult(matches.stream()
                .sorted(Comparator.comparingInt(Match::score).reversed()
                        .thenComparing(match -> match.evidence().card().id()))
                .map(Match::evidence)
                .limit(3)
                .toList(), false);
    }

    Optional<List<Evidence>> resolve(String exhibitSlug, String locale, List<Reference> references) {
        if (references == null || references.isEmpty() || references.size() > 3) return Optional.empty();
        Map<String, Evidence> current = visibleSnapshot(exhibitSlug, locale);
        Set<ClaimScope> conflicts = conflictingClaims(current);
        var verified = new ArrayList<Evidence>();
        for (Reference reference : references) {
            if (reference == null) return Optional.empty();
            Evidence evidence = current.get(reference.cardId());
            if (evidence == null || reference.revision() != evidence.card().revision()
                    || isDisputed(evidence, conflicts)) {
                return Optional.empty();
            }
            verified.add(evidence);
        }
        return Optional.of(List.copyOf(verified));
    }

    private Map<String, Evidence> visibleSnapshot(String exhibitSlug, String locale) {
        var visible = snapshot(exhibitSlug, locale);
        var result = new HashMap<String, Evidence>();
        visible.forEach((id, evidence) -> {
            if (visibility.allows(exhibitSlug, locale, new Reference(id, evidence.card().revision()), evidence.card())) {
                result.put(id, evidence);
            }
        });
        return result;
    }

    private static Set<ClaimScope> conflictingClaims(Map<String, Evidence> visible) {
        var values = new HashMap<ClaimScope, String>();
        var conflicts = new HashSet<ClaimScope>();
        for (Evidence evidence : visible.values()) {
            if (evidence.claim() == null) continue;
            ClaimScope scope = claimScope(evidence);
            String previous = values.putIfAbsent(scope, evidence.claim().value());
            if (previous != null && !previous.equals(evidence.claim().value())) conflicts.add(scope);
        }
        return conflicts;
    }

    private static boolean isDisputed(Evidence evidence, Set<ClaimScope> conflicts) {
        return evidence.claim() != null && conflicts.contains(claimScope(evidence));
    }

    private static ClaimScope claimScope(Evidence evidence) {
        return new ClaimScope(evidence.card().artifactSlug(), evidence.claim().key());
    }

    private record ClaimScope(String artifactSlug, String key) {}

    private Map<String, Evidence> snapshot(String exhibitSlug, String locale) {
        if (exhibitSlug == null || exhibitSlug.isBlank() || locale == null || locale.isBlank()) return Map.of();
        Map<String, Evidence> current = new HashMap<>();
        try {
            List<Evidence> loaded = source.current(exhibitSlug, locale);
            if (loaded == null) return Map.of();
            for (Evidence evidence : loaded) {
                if (evidence == null || evidence.card() == null || evidence.card().id() == null
                        || current.putIfAbsent(evidence.card().id(), evidence) != null) {
                    return Map.of();
                }
            }
            return current;
        } catch (DataAccessException unavailable) {
            return Map.of();
        }
    }

    private static int relevance(Evidence evidence, String question) {
        return evidence.aliases().stream().map(GuideEvidenceReader::normalize)
                .filter(alias -> !alias.isBlank() && question.contains(alias))
                .mapToInt(String::length).max().orElse(0);
    }

    private static String normalize(String value) {
        return Normalizer.normalize(value, Normalizer.Form.NFKC).strip().toLowerCase(Locale.ROOT);
    }

    private record Match(Evidence evidence, int score) {}
}
