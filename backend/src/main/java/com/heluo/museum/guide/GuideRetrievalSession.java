package com.heluo.museum.guide;

import com.heluo.museum.guide.GuideFollowUpRetrieval.ConfirmedLookpoint;
import com.heluo.museum.guide.GuideFollowUpRetrieval.Result;
import com.heluo.museum.guide.GuideEvidenceVisibility.Reference;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/** Internal state for a single visit. No question or answer text is retained. */
final class GuideRetrievalSession {
    private static final int MAX_REQUEST_IDS = 256;
    private static final int DEFAULT_QUESTIONS_PER_MINUTE = 6;
    record Selection(Result result, long turn, String exhibit, String locale, Object owner) {}

    private final GuideFollowUpRetrieval retrieval;
    private final Clock clock;
    private final Instant expiresAt;
    private final Object owner = new Object();
    private final Set<UUID> requestIds = new HashSet<>();
    private final ArrayDeque<Instant> recentQuestions = new ArrayDeque<>();
    private final int questionsPerMinute;
    private String exhibit;
    private String locale;
    private ConfirmedLookpoint lookpoint;
    private ConfirmedLookpoint answeredTopic;
    // Null means no answer since selecting the lookpoint; empty means the answer has no sources.
    private List<Reference> answerReferences;
    private long turn;
    private long contextVersion = -1;

    GuideRetrievalSession(GuideFollowUpRetrieval retrieval, Clock clock, Duration lifetime) {
        this(retrieval, clock, lifetime, DEFAULT_QUESTIONS_PER_MINUTE);
    }

    GuideRetrievalSession(GuideFollowUpRetrieval retrieval, Clock clock, Duration lifetime, int questionsPerMinute) {
        this.retrieval = Objects.requireNonNull(retrieval);
        this.clock = Objects.requireNonNull(clock);
        if (lifetime.isZero() || lifetime.isNegative()) throw new IllegalArgumentException("Invalid lifetime");
        if (questionsPerMinute < 1 || questionsPerMinute > MAX_REQUEST_IDS) {
            throw new IllegalArgumentException("Invalid session question limit");
        }
        this.questionsPerMinute = questionsPerMinute;
        expiresAt = clock.instant().plus(lifetime);
    }

    synchronized void enter(String exhibit, String locale) {
        if (exhibit == null || exhibit.isBlank() || locale == null || locale.isBlank()) {
            throw new IllegalArgumentException("Missing exhibit or locale");
        }
        if (expired()) return;
        turn++;
        this.exhibit = exhibit;
        this.locale = locale;
        lookpoint = null;
        answeredTopic = null;
        answerReferences = null;
    }

    // Only accept a lookpoint confirmed by the server, never a raw request-body reference.
    synchronized boolean confirm(ConfirmedLookpoint confirmed) {
        if (!active() || confirmed == null || confirmed.reference() == null
                || !exhibit.equals(confirmed.exhibitSlug()) || !locale.equals(confirmed.locale())) return false;
        turn++;
        lookpoint = confirmed;
        answeredTopic = null;
        answerReferences = null;
        return true;
    }

    synchronized void clearLookpoint() {
        turn++;
        lookpoint = null;
        answeredTopic = null;
        answerReferences = null;
    }

    synchronized void leave() {
        clearLookpoint();
        exhibit = null;
        locale = null;
    }

    Optional<Selection> retrieve(String question) {
        return retrieve(question, null);
    }

    Optional<Selection> retrieve(String question, UUID requestId) {
        return retrieve(question, requestId, null);
    }

    synchronized void version(long version) {
        contextVersion = version;
    }

    Optional<Selection> retrieve(String question, UUID requestId, Long expectedVersion) {
        String requestedExhibit;
        String requestedLocale;
        ConfirmedLookpoint context;
        List<Reference> sources;
        long requestTurn;
        synchronized (this) {
            if (!active() || (expectedVersion != null && contextVersion != expectedVersion)) return Optional.empty();
            if (requestId != null) {
                if (requestIds.size() >= MAX_REQUEST_IDS || requestIds.contains(requestId)) return Optional.empty();
                Instant now = clock.instant();
                Instant cutoff = now.minusSeconds(60);
                while (!recentQuestions.isEmpty() && !recentQuestions.getFirst().isAfter(cutoff)) {
                    recentQuestions.removeFirst();
                }
                if (recentQuestions.size() >= questionsPerMinute) {
                    return Optional.of(new Selection(new Result(GuideFollowUpRetrieval.Kind.SESSION_RATE_LIMITED,
                            List.of()), ++turn, exhibit, locale, owner));
                }
                recentQuestions.addLast(now);
                requestIds.add(requestId);
            }
            requestedExhibit = exhibit;
            requestedLocale = locale;
            context = answeredTopic == null ? lookpoint : answeredTopic;
            sources = answerReferences;
            requestTurn = ++turn;
        }
        Result result = retrieval.retrieve(requestedExhibit, requestedLocale, question, context, sources);
        return isCurrent(requestTurn)
                ? Optional.of(new Selection(result, requestTurn, requestedExhibit, requestedLocale, owner))
                : Optional.empty();
    }

    synchronized boolean isCurrent(long requestTurn) {
        return active() && requestTurn == turn;
    }

    synchronized boolean isCurrent(Selection selected) {
        return selected != null && selected.owner() == owner && isCurrent(selected.turn());
    }

    boolean allowsTopicFromSingleCitation() { return retrieval.allowsTopicFromSingleCitation(); }
    boolean supportsTopic(Reference reference) { return retrieval.supportsTopic(reference); }

    synchronized boolean rememberAnsweredTopic(Selection selected, Reference reference, List<Reference> sources) {
        if (!isCurrent(selected)) return false;
        answeredTopic = reference == null ? null : new ConfirmedLookpoint(exhibit, locale, reference);
        answerReferences = List.copyOf(sources);
        return true;
    }

    synchronized boolean rememberAnswerReferences(Selection selected, List<Reference> sources) {
        if (!isCurrent(selected)) return false;
        answerReferences = List.copyOf(sources);
        return true;
    }

    private boolean active() {
        return !expired() && exhibit != null;
    }

    private boolean expired() {
        if (clock.instant().isBefore(expiresAt)) return false;
        if (exhibit != null) leave();
        return true;
    }
}
