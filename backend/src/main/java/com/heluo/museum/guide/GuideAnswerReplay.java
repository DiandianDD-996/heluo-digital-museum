package com.heluo.museum.guide;

import com.heluo.museum.guide.GuideEvidenceVisibility.Reference;
import java.net.URI;
import java.util.List;
import java.util.Optional;

final class GuideAnswerReplay {
    // Created server-side after answer validation; not accepted as a client request.
    record StoredAnswer(String exhibitSlug, String locale, String text, List<Reference> references) {
        StoredAnswer {
            references = List.copyOf(references);
        }
    }

    record Citation(Reference reference, URI publicSource) {}
    record Answer(String text, List<Citation> citations) {}

    private final GuideEvidenceReader evidence;

    GuideAnswerReplay(GuideEvidenceReader evidence) {
        this.evidence = evidence;
    }

    Optional<Answer> replay(String exhibitSlug, String locale, StoredAnswer stored) {
        if (stored == null || exhibitSlug == null || locale == null
                || !exhibitSlug.equals(stored.exhibitSlug()) || !locale.equals(stored.locale())
                || stored.text() == null || stored.text().isBlank()) {
            return Optional.empty();
        }
        return evidence.resolve(exhibitSlug, locale, stored.references())
                .map(cards -> new Answer(stored.text(), cards.stream()
                        .map(card -> new Citation(new Reference(card.card().id(), card.card().revision()),
                                httpsSource(card.publicSource())))
                        .toList()));
    }

    private static URI httpsSource(URI source) {
        return source != null && "https".equalsIgnoreCase(source.getScheme())
                && source.getHost() != null && source.getUserInfo() == null ? source : null;
    }
}
