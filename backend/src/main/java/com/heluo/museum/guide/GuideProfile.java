package com.heluo.museum.guide;

import com.fasterxml.jackson.core.StreamReadFeature;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.heluo.museum.guide.GuideEvidenceVisibility.Reference;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/** Internal routing metadata, never a source of visitor-facing facts. */
final class GuideProfile {
    private static final Map<String, String> VIEWS = Map.of("ear", "top", "feet", "back", "motif", "relief");
    enum FactSource { PERIOD, SIZE, PROVENANCE }
    record Plate(String stop, String cardId, int revision, String view, List<String> corrections, Boolean elliptical) {
        Reference reference() { return new Reference(cardId, revision); }
    }

    record Exhibit(String exhibitSlug, String artifactSlug, String locale, List<Plate> plates,
                   Map<FactSource, Reference> factSources, List<String> topicCardIds) {
        Plate plate(String stop) {
            return plates.stream().filter(plate -> plate.stop().equals(stop)).findFirst().orElse(null);
        }
        Plate plate(Reference reference) {
            return plates.stream().filter(plate -> plate.reference().equals(reference)).findFirst().orElse(null);
        }
        Plate correction(String term) {
            return plates.stream().filter(plate -> plate.corrections().contains(term)).findFirst().orElse(null);
        }
    }

    private record Document(int version, List<Exhibit> exhibits) {}
    private record Key(String exhibit, String locale) {}
    private final Map<Key, Exhibit> exhibits;

    private GuideProfile(Map<Key, Exhibit> exhibits) { this.exhibits = Map.copyOf(exhibits); }
    Exhibit find(String exhibit, String locale) { return exhibits.get(new Key(exhibit, locale)); }
    static boolean knownStop(String stop) { return VIEWS.containsKey(stop); }

    static GuideProfile load(String path) {
        require(path != null && !path.isBlank(), "file is required for guide turns");
        Document document;
        try (var source = Files.newInputStream(Path.of(path))) {
            document = JsonMapper.builder().enable(StreamReadFeature.STRICT_DUPLICATE_DETECTION)
                    .enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS)
                    .disable(DeserializationFeature.ACCEPT_FLOAT_AS_INT)
                    .disable(com.fasterxml.jackson.databind.MapperFeature.ALLOW_COERCION_OF_SCALARS)
                    .build().readValue(source, Document.class);
        } catch (IOException | java.nio.file.InvalidPathException exception) {
            throw new IllegalArgumentException("Invalid museum.guide.profile-path: unreadable or malformed JSON", exception);
        }
        require(document != null && document.version() == 1 && document.exhibits() != null
                && !document.exhibits().isEmpty(), "expected version 1 and at least one exhibit");
        var entries = new HashMap<Key, Exhibit>();
        for (var exhibit : document.exhibits()) {
            require(exhibit != null && slug(exhibit.exhibitSlug()) && slug(exhibit.artifactSlug())
                    && "zh-CN".equals(exhibit.locale()), "expected exhibit slug, artifact slug and zh-CN locale");
            require(exhibit.plates() != null && !exhibit.plates().isEmpty(), "plates must not be empty");
            var stops = new HashSet<String>();
            var cards = new HashSet<String>();
            var corrections = new HashSet<String>();
            for (var plate : exhibit.plates()) {
                require(plate != null && plate.stop() != null && knownStop(plate.stop()) && stops.add(plate.stop()),
                        "unknown or duplicate stop");
                require(VIEWS.get(plate.stop()).equals(plate.view()), "invalid view for stop " + plate.stop());
                checkReference(plate.reference());
                require(cards.add(plate.cardId()), "duplicate plate card");
                require(plate.corrections() != null && plate.elliptical() != null, "missing correction or follow-up policy");
                for (String term : plate.corrections()) {
                    require(term != null && !term.isBlank() && term.equals(term.strip()) && corrections.add(term),
                            "invalid or duplicate correction alias");
                }
            }
            require(exhibit.factSources() != null, "missing factSources object");
            exhibit.factSources().values().forEach(GuideProfile::checkReference);
            var topics = exhibit.topicCardIds();
            require(topics != null && !topics.isEmpty() && topics.stream().noneMatch(Objects::isNull)
                    && Set.copyOf(topics).size() == topics.size() && cards.containsAll(topics),
                    "topicCardIds must be unique plate cards");
            var immutable = new Exhibit(exhibit.exhibitSlug(), exhibit.artifactSlug(), exhibit.locale(),
                    exhibit.plates().stream().map(plate -> new Plate(plate.stop(), plate.cardId(), plate.revision(),
                            plate.view(), List.copyOf(plate.corrections()), plate.elliptical())).toList(),
                    Map.copyOf(exhibit.factSources()), List.copyOf(topics));
            require(entries.putIfAbsent(new Key(exhibit.exhibitSlug(), exhibit.locale()), immutable) == null,
                    "duplicate exhibit and locale");
        }
        return new GuideProfile(entries);
    }

    static boolean slug(String value) {
        return value != null && value.length() <= 100 && value.matches("[a-z0-9]+(?:-[a-z0-9]+)*");
    }

    private static void checkReference(Reference reference) {
        require(reference != null && reference.cardId() != null && !reference.cardId().isBlank()
                && reference.cardId().equals(reference.cardId().strip()) && reference.revision() >= 1,
                "cardId must be nonblank and revision must be positive");
    }

    private static void require(boolean valid, String message) {
        if (!valid) throw new IllegalArgumentException("Invalid museum.guide.profile-path: " + message);
    }
}
