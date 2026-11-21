package com.heluo.museum.guide;

import com.heluo.museum.guide.GuideAnswerReplay.Answer;
import com.heluo.museum.guide.GuideAnswerReplay.StoredAnswer;
import com.heluo.museum.guide.GuideEvidenceReader.Evidence;
import com.heluo.museum.guide.GuideEvidenceVisibility.Reference;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;

final class GuideAnswerDelivery {
    record Draft(String text, List<Reference> references) {}

    private final GuideAnswerReplay replay;
    private final GuideVoice voice;

    GuideAnswerDelivery(GuideEvidenceReader reader) {
        this(reader, GuideVoice.packaged());
    }

    GuideAnswerDelivery(GuideEvidenceReader reader, GuideVoice voice) {
        replay = new GuideAnswerReplay(reader);
        this.voice = voice;
    }

    Optional<Answer> deliverFindSpot(GuideRetrievalSession session, GuideRetrievalSession.Selection selection) {
        if (!session.isCurrent(selection) || selection.result().kind() != GuideFollowUpRetrieval.Kind.FIND_SPOT_UNKNOWN) {
            return Optional.empty();
        }
        String missing = voice.missing("FIND_SPOT");
        var answer = linkedProvenance(selection, missing + "\n" + voice.sourceAction())
                .orElseGet(() -> new Answer(missing, List.of()));
        return session.isCurrent(selection) ? Optional.of(answer) : Optional.empty();
    }

    Optional<Answer> deliverPlateProvenance(GuideRetrievalSession session, GuideRetrievalSession.Selection selection) {
        if (!session.isCurrent(selection) || selection.result().kind() != GuideFollowUpRetrieval.Kind.PLATE_PROVENANCE
                || selection.result().evidence().isEmpty()) {
            return Optional.empty();
        }
        var answer = linkedProvenance(selection, selection.result().evidence().get(0).text());
        return session.isCurrent(selection) ? answer : Optional.empty();
    }

    Optional<Answer> deliverPeriod(GuideRetrievalSession session, GuideRetrievalSession.Selection selection) {
        if (!session.isCurrent(selection)) return Optional.empty();
        var answer = switch (selection.result().kind()) {
            case PERIOD -> linkedProvenance(selection, selection.result().evidence().get(0).text());
            case PERIOD_REFERENCE -> linkedProvenance(selection, voice.missing("PERIOD") + "\n" + voice.sourceAction());
            default -> Optional.<Answer>empty();
        };
        return session.isCurrent(selection) ? answer : Optional.empty();
    }

    Optional<Answer> deliverReferenceFacts(GuideRetrievalSession session, GuideRetrievalSession.Selection selection) {
        if (!session.isCurrent(selection)) return Optional.empty();
        var sentences = new ArrayList<String>();
        var references = new LinkedHashSet<Reference>();
        for (var part : selection.result().facts()) {
            var cards = part.evidence();
            String unsupported = voice.missing(part.fact().name());
            if (cards.isEmpty()) {
                sentences.add(unsupported);
                continue;
            }
            String text = part.fact() == GuideFollowUpRetrieval.Fact.FIND_SPOT
                    ? unsupported + "\n" + voice.sourceAction()
                    : cards.get(0).text();
            var answer = linkedProvenance(selection, text, cards);
            sentences.add(answer.map(Answer::text).orElse(unsupported));
            answer.ifPresent(value -> value.citations().forEach(citation -> references.add(citation.reference())));
        }
        if (!session.isCurrent(selection)) return Optional.empty();
        String text = String.join("\n", sentences);
        if (references.isEmpty()) return Optional.of(new Answer(text, List.of()));
        // Validate the combined citations against the same current evidence snapshot.
        var answer = replay.replay(selection.exhibit(), selection.locale(),
                new StoredAnswer(selection.exhibit(), selection.locale(), text, List.copyOf(references)));
        return session.isCurrent(selection) ? answer : Optional.empty();
    }

    Optional<Answer> deliverLookpointSource(GuideRetrievalSession session, GuideRetrievalSession.Selection selection) {
        if (!session.isCurrent(selection) || selection.result().kind() != GuideFollowUpRetrieval.Kind.LOOKPOINT_SOURCE) {
            return Optional.empty();
        }
        var answer = verifiedProvenance(selection, voice.sourceAction())
                .map(value -> {
                    long linked = value.citations().stream().filter(citation -> citation.publicSource() != null).count();
                    return new Answer(voice.sourceLinkStatus(linked, value.citations().size()), value.citations());
                });
        return session.isCurrent(selection) ? answer : Optional.empty();
    }

    Optional<Answer> deliverPlateObservation(GuideRetrievalSession session, GuideRetrievalSession.Selection selection) {
        if (!session.isCurrent(selection) || selection.result().kind() != GuideFollowUpRetrieval.Kind.PLATE_OBSERVATION) {
            return Optional.empty();
        }
        var answer = verifiedProvenance(selection, selection.result().evidence().get(0).text());
        return session.isCurrent(selection) ? answer : Optional.empty();
    }

    private Optional<Answer> linkedProvenance(GuideRetrievalSession.Selection selection, String text) {
        return linkedProvenance(selection, text, selection.result().evidence());
    }

    private Optional<Answer> linkedProvenance(GuideRetrievalSession.Selection selection, String text, List<Evidence> cards) {
        return verifiedProvenance(selection, text, cards)
                .flatMap(value -> {
                    var withLinks = value.citations().stream().filter(citation -> citation.publicSource() != null).toList();
                    return withLinks.isEmpty() ? Optional.empty() : Optional.of(new Answer(value.text(), withLinks));
                });
    }

    private Optional<Answer> verifiedProvenance(GuideRetrievalSession.Selection selection, String text) {
        return verifiedProvenance(selection, text, selection.result().evidence());
    }

    private Optional<Answer> verifiedProvenance(GuideRetrievalSession.Selection selection, String text, List<Evidence> cards) {
        var references = cards.stream()
                .map(evidence -> new Reference(evidence.card().id(), evidence.card().revision())).toList();
        return replay.replay(selection.exhibit(), selection.locale(),
                new StoredAnswer(selection.exhibit(), selection.locale(), text, references));
    }

    Optional<Answer> deliver(GuideRetrievalSession session, GuideRetrievalSession.Selection selection, Draft draft) {
        if (!session.isCurrent(selection) || selection.result().kind() != GuideFollowUpRetrieval.Kind.EVIDENCE
                || draft == null || draft.text() == null || draft.references() == null) return Optional.empty();
        String text = draft.text().strip();
        if (text.isBlank() || text.codePointCount(0, text.length()) > voice.maxChars()
                || draft.references().isEmpty() || draft.references().size() > 3) return Optional.empty();

        var offered = new HashSet<Reference>();
        for (var evidence : selection.result().evidence()) {
            offered.add(new Reference(evidence.card().id(), evidence.card().revision()));
        }
        var references = new ArrayList<>(draft.references());
        if (references.contains(null) || references.size() != new HashSet<>(references).size()
                || !offered.containsAll(references)) return Optional.empty();

        var answer = replay.replay(selection.exhibit(), selection.locale(),
                new StoredAnswer(selection.exhibit(), selection.locale(), text, references));
        return session.isCurrent(selection) ? answer : Optional.empty();
    }
}
