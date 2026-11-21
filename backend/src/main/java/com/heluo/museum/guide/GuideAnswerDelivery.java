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
    private static final String UNKNOWN_FIND_SPOT = "现有资料不足以判断出土地。";
    private static final String PLATE_DESCRIPTION = "洛笙的图版来自数字模型渲染，不是原器照片，也不能用来确认原器颜色。";
    record Draft(String text, List<Reference> references) {}

    private final GuideAnswerReplay replay;

    GuideAnswerDelivery(GuideEvidenceReader reader) {
        replay = new GuideAnswerReplay(reader);
    }

    Optional<Answer> deliverFindSpot(GuideRetrievalSession session, GuideRetrievalSession.Selection selection) {
        if (!session.isCurrent(selection) || selection.result().kind() != GuideFollowUpRetrieval.Kind.FIND_SPOT_UNKNOWN) {
            return Optional.empty();
        }
        var answer = linkedProvenance(selection, UNKNOWN_FIND_SPOT + "所附链接是参考记录，不是出土证明。")
                .orElseGet(() -> new Answer(UNKNOWN_FIND_SPOT, List.of()));
        return session.isCurrent(selection) ? Optional.of(answer) : Optional.empty();
    }

    Optional<Answer> deliverPlateProvenance(GuideRetrievalSession session, GuideRetrievalSession.Selection selection) {
        if (!session.isCurrent(selection) || selection.result().kind() != GuideFollowUpRetrieval.Kind.PLATE_PROVENANCE) {
            return Optional.empty();
        }
        var answer = linkedProvenance(selection, PLATE_DESCRIPTION);
        return session.isCurrent(selection) ? answer : Optional.empty();
    }

    Optional<Answer> deliverPeriod(GuideRetrievalSession session, GuideRetrievalSession.Selection selection) {
        if (!session.isCurrent(selection)) return Optional.empty();
        var answer = switch (selection.result().kind()) {
            case PERIOD -> linkedProvenance(selection, selection.result().evidence().get(0).text());
            case PERIOD_REFERENCE -> linkedProvenance(selection,
                    "当前展品是数字模型。已审展签可核对参考藏品编号 1962.281，年代请查该参考实物的馆藏记录。");
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
            String unsupported = switch (part.fact()) {
                case SIZE -> "尺寸方面，现有已审资料不足以确认参考实物的整体尺寸。";
                case DETAIL_SIZE -> "这个部位的尺寸需要专门测量，现有已审资料没有可核对的数值。";
                case MODEL_SIZE -> "现有已审资料不足以确认数字模型的尺寸，模型尺寸需要另行测量。";
                case PERIOD -> "年代方面，现有已审资料不足以确认参考实物的年代。";
                case FIND_SPOT -> UNKNOWN_FIND_SPOT;
            };
            if (cards.isEmpty()) {
                sentences.add(unsupported);
                continue;
            }
            String text = part.fact() == GuideFollowUpRetrieval.Fact.FIND_SPOT
                    ? UNKNOWN_FIND_SPOT + "所附馆藏记录供核对参考实物。"
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
        var answer = verifiedProvenance(selection, "相关参考资料在下方，你可以点开核对。")
                .map(value -> {
                    long linked = value.citations().stream().filter(citation -> citation.publicSource() != null).count();
                    if (linked == value.citations().size()) return value;
                    String text = linked == 0 ? "刚才的回答有资料依据，但没有可打开的公开链接。"
                            : "下方是可以点开核对的资料。刚才的部分依据没有可打开的公开链接。";
                    return new Answer(text, value.citations());
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
        if (text.isBlank() || text.codePointCount(0, text.length()) > 300
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
