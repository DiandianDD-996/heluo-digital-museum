package com.heluo.museum.guide;

import com.fasterxml.jackson.core.StreamReadFeature;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.json.JsonMapper;
import java.io.IOException;
import java.io.InputStream;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

/** Reviewed non-factual copy. Examples and editorial notes are never read by the renderer. */
@Component
@Lazy(false)
final class GuideVoice {
    private static final JsonMapper JSON = JsonMapper.builder()
            .enable(StreamReadFeature.STRICT_DUPLICATE_DETECTION)
            .enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS).build();
    private static final Pattern PLACEHOLDER = Pattern.compile("\\{([a-zA-Z]+)}");
    private static final Set<String> MISSING = Set.of("PERIOD", "SIZE", "DETAIL_SIZE", "MODEL_SIZE", "FIND_SPOT",
            "MEANING", "CRAFT", "COLOR", "CONDITION");
    private static final Set<String> SECTIONS = Set.of("version", "locale", "persona", "limits", "openers", "transitions",
            "insufficient", "clarify", "actionTemplates", "systemBehavior", "degradation", "bannedPhrases", "examples", "notes");
    record Stop(String stop, String label) {}

    private final JsonNode voice;
    private final Map<String, String> labels;
    private final Map<String, String> points;
    private final String noSourceLink;
    private final String partialSourceLinks;
    private final List<String> banned;
    private final List<String> transitions;
    private final Map<String, String> actionTemplates;
    private final int maxChars;
    private final int maxSentenceChars;
    private final int maxSentences;

    GuideVoice() {
        this(GuideVoice.class.getResourceAsStream("/guide/voice.zh-CN.json"),
                GuideVoice.class.getResourceAsStream("/guide/ui.zh-CN.json"));
    }

    static GuideVoice packaged() { return Packaged.INSTANCE; }
    private static class Packaged { private static final GuideVoice INSTANCE = new GuideVoice(); }

    GuideVoice(InputStream voiceBytes, InputStream uiBytes) {
        JsonNode ui;
        try (voiceBytes; uiBytes) {
            require(voiceBytes != null && uiBytes != null, "missing resource");
            voice = JSON.readTree(voiceBytes);
            ui = JSON.readTree(uiBytes);
        } catch (IOException invalid) {
            throw new IllegalArgumentException("Invalid guide voice: malformed or unreadable JSON", invalid);
        }
        validateHeader(voice);
        validateHeader(ui);
        fields(voice, SECTIONS);
        var limits = voice.path("limits");
        fields(limits, Set.of("maxSentences", "maxChars", "maxSentenceChars", "maxSuggestions", "maxFollowUps"));
        // The optional fourth row is a connector, not one of the three main voice rows.
        maxSentences = limit(limits, "maxSentences", 3);
        maxChars = limit(limits, "maxChars", 300);
        maxSentenceChars = limit(limits, "maxSentenceChars", 120);
        int suggestions = limit(limits, "maxSuggestions", 3);
        require(limit(limits, "maxFollowUps", 2) <= suggestions && maxSentenceChars <= maxChars, "inconsistent limits");
        banned = array(voice.path("bannedPhrases"), List.of());
        require(banned.stream().allMatch(word -> word.equals(normalize(word))) && new HashSet<>(banned).size() == banned.size(),
                "invalid or repeated banned phrase");
        transitions = array(voice.path("transitions"), banned);
        require(new HashSet<>(transitions).size() == transitions.size(), "repeated transition");
        var actions = voice.path("actionTemplates");
        fields(actions, Set.of("plate", "source", "appointment", "return"));
        actionTemplates = Map.of("plate", template(actions.path("plate"), Set.of("label"), banned),
                "source", template(actions.path("source"), Set.of(), banned),
                "appointment", template(actions.path("appointment"), Set.of(), banned),
                "return", template(actions.path("return"), Set.of("point"), banned));
        var insufficient = voice.path("insufficient");
        fields(insufficient, Set.of("generic", "missing", "template", "next"));
        template(insufficient.path("generic"), Set.of(), banned);
        template(insufficient.path("template"), Set.of("missing"), banned);
        array(insufficient.path("next"), banned);
        fields(insufficient.path("missing"), MISSING);
        for (String kind : MISSING) {
            String phrase = template(insufficient.path("missing").path(kind), Set.of(), banned);
            require(!Pattern.compile("[。！？；：，\\p{Cntrl}]|没有|不能|不足|无法|未填写|不存在").matcher(phrase).find(),
                    "missing evidence must be named by a phrase");
            require(length(missing(kind)) <= maxSentenceChars, "missing evidence rendering exceeds length");
        }
        var clarify = voice.path("clarify");
        fields(clarify, Set.of("lookpoint", "discovery", "date", "people", "repeat"));
        clarify.fields().forEachRemaining(entry -> template(entry.getValue(), switch (entry.getKey()) {
            case "lookpoint" -> Set.of("options");
            case "repeat" -> Set.of("choice");
            default -> Set.of();
        }, banned));
        var openers = voice.path("openers");
        fields(openers, Set.of("artifact", "plate", "return", "appointment"));
        openers.fields().forEachRemaining(entry -> {
            require(entry.getValue().isArray() && !entry.getValue().isEmpty(), "empty openers");
            entry.getValue().forEach(node -> template(node, entry.getKey().equals("return") ? Set.of("point") : Set.of(), banned));
        });
        var behavior = voice.path("systemBehavior");
        fields(behavior, Set.of("noAction"));
        template(behavior.path("noAction"), Set.of(), banned);
        var degradation = voice.path("degradation");
        fields(degradation, Set.of("generationUnavailable", "generationTimeout", "generationBusy", "limitReached", "paused", "network", "search"));
        degradation.forEach(node -> template(node, Set.of(), banned));
        var persona = voice.path("persona");
        fields(persona, Set.of("name", "role", "tone"));
        template(persona.path("name"), Set.of(), banned);
        template(persona.path("role"), Set.of(), banned);
        array(persona.path("tone"), banned);
        labels = labels(ui.path("plateViewLabels"));
        points = labels(ui.path("site").path("pointNames"));
        var links = ui.path("site").path("citationLinks");
        fields(links, Set.of("none", "partial"));
        noSourceLink = template(links.path("none"), Set.of(), banned);
        partialSourceLinks = template(links.path("partial"), Set.of(), banned);
        require(labels.keySet().equals(points.keySet()), "plate labels lack matching point names");
        for (String stop : labels.keySet()) {
            require(length(renderAction("plate", stop, stops(Set.of(stop)))) <= maxSentenceChars
                    && length(renderAction("return", stop, stops(Set.of(stop)))) <= maxSentenceChars,
                    "rendered action exceeds length");
        }
    }

    int maxChars() { return maxChars; }
    int maxSentenceChars() { return maxSentenceChars; }
    int maxSentences() { return maxSentences; }
    List<String> transitions() { return transitions; }
    Map<String, String> actionTemplates() { return actionTemplates; }
    List<Stop> stops(Set<String> allowed) {
        return allowed.stream().filter(labels::containsKey).sorted().map(stop -> new Stop(stop, labels.get(stop))).toList();
    }
    String missing(String kind) {
        var missing = voice.path("insufficient");
        return missing.path("template").textValue().replace("{missing}", missing.path("missing").path(kind).textValue());
    }
    String sourceAction() { return actionTemplates.get("source"); }
    String sourceLinkStatus(long linked, int total) {
        return linked == total ? sourceAction() : linked == 0 ? noSourceLink : partialSourceLinks;
    }
    boolean hasBannedPhrase(String text) { return banned.stream().anyMatch(normalize(text)::contains); }

    String renderAction(String id, String stop, List<Stop> allowed) {
        String value = actionTemplates.get(id);
        if (value == null) return null;
        if (!id.equals("plate") && !id.equals("return")) return stop == null ? value : null;
        if (stop == null || allowed.stream().noneMatch(item -> item.stop().equals(stop))) return null;
        return id.equals("plate") ? value.replace("{label}", labels.get(stop)) : value.replace("{point}", points.get(stop));
    }

    private Map<String, String> labels(JsonNode node) {
        require(node.isObject() && !node.isEmpty(), "missing plate labels");
        var values = new LinkedHashMap<String, String>();
        node.fields().forEachRemaining(entry -> {
            require(entry.getKey().matches("[a-z][a-z0-9-]*"), "invalid stop label key");
            values.put(entry.getKey(), template(entry.getValue(), Set.of(), banned));
        });
        return Map.copyOf(values);
    }

    private static void validateHeader(JsonNode node) {
        require(node != null && node.isObject() && node.path("version").isInt() && node.path("version").intValue() == 1
                && "zh-CN".equals(node.path("locale").textValue()), "unsupported version or locale");
    }
    private static void fields(JsonNode node, Set<String> expected) {
        var names = new HashSet<String>();
        node.fieldNames().forEachRemaining(names::add);
        require(node.isObject() && names.equals(expected), "invalid fields");
    }
    private static int limit(JsonNode root, String name, int ceiling) {
        var node = root.path(name);
        require(node.isInt() && node.intValue() > 0 && node.intValue() <= ceiling, "invalid length limit: " + name);
        return node.intValue();
    }
    private List<String> array(JsonNode node, List<String> forbidden) {
        require(node.isArray() && !node.isEmpty(), "empty copy list");
        var values = new ArrayList<String>();
        node.forEach(entry -> values.add(template(entry, Set.of(), forbidden)));
        return List.copyOf(values);
    }
    private String template(JsonNode node, Set<String> expected, List<String> forbidden) {
        String value = node.textValue();
        require(value != null && !value.isBlank() && value.equals(value.strip()) && !value.contains("\n")
                && !value.contains("\r") && length(value) <= maxSentenceChars
                && forbidden.stream().noneMatch(normalize(value)::contains), "invalid copy or length");
        var matches = PLACEHOLDER.matcher(value);
        var names = new HashSet<String>();
        while (matches.find()) require(names.add(matches.group(1)), "duplicate placeholder");
        require(names.equals(expected) && !PLACEHOLDER.matcher(value).replaceAll("").matches(".*[{}].*"), "invalid placeholders");
        return value;
    }
    private static String normalize(String value) { return Normalizer.normalize(value, Normalizer.Form.NFKC); }
    private static int length(String value) { return value.codePointCount(0, value.length()); }
    private static void require(boolean valid, String message) {
        if (!valid) throw new IllegalArgumentException("Invalid guide voice: " + message);
    }
}
