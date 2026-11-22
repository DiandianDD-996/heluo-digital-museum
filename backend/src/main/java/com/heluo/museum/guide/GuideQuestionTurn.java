package com.heluo.museum.guide;

import com.heluo.museum.guide.GuideAnswerDelivery.Draft;
import com.heluo.museum.guide.GuideAnswerReplay.Answer;
import com.heluo.museum.guide.GuideEvidenceVisibility.Reference;
import java.time.Duration;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/** Internal question flow; the caller supplies an explicitly selected generator. */
final class GuideQuestionTurn {
    record EvidenceExcerpt(Reference reference, String text, List<String> spoken, List<String> boundary) {
        EvidenceExcerpt(Reference reference, String text) {
            this(reference, text, text == null || text.isBlank() ? List.of() : List.of(text), List.of());
        }
        EvidenceExcerpt {
            spoken = spoken == null || spoken.isEmpty()
                    ? (text == null || text.isBlank() ? List.of() : List.of(text))
                    : List.copyOf(spoken);
            boundary = boundary == null ? List.of() : List.copyOf(boundary);
        }
        String spokenText() {
            return spoken.isEmpty() ? text : String.join("", spoken);
        }
        String boundaryText() {
            return String.join("", boundary);
        }
    }
    record Input(String question, String locale, List<EvidenceExcerpt> evidence, java.util.Set<String> allowedStops) {
        Input(String question, String locale, List<EvidenceExcerpt> evidence) {
            this(question, locale, evidence, java.util.Set.of());
        }
    }
    enum ReplyKind { EVIDENCE, CLARIFY, INSUFFICIENT_EVIDENCE, DISPUTED_EVIDENCE, FIND_SPOT_UNKNOWN,
        PERIOD, REFERENCE_FACTS, PLATE_PROVENANCE, LOOKPOINT_SOURCE, PLATE_OBSERVATION,
        GENERATION_UNAVAILABLE, GENERATION_TIMEOUT, GENERATION_BUSY, GENERATION_LIMIT_REACHED,
        SESSION_RATE_LIMITED, QUESTIONING_DISABLED }
    record Reply(ReplyKind kind, Answer answer, Reference topic) {
        Reply(ReplyKind kind, Answer answer) { this(kind, answer, null); }
    }
    private record Generation(Draft draft, ReplyKind failure) {
        static Generation unavailable(ReplyKind kind) { return new Generation(null, kind); }
    }

    @FunctionalInterface
    interface Generator {
        // An adapter reports timeout or service unavailability as empty; this flow never retries.
        Optional<Draft> generate(Input input);
    }

    private final GuideAnswerDelivery delivery;
    private final Generator generator;
    private final Semaphore generationSlots;
    private final ExecutorService generationPool;
    private final long generationTimeoutNanos;
    private final GuideDailyGenerationLimit dailyLimit;
    private final boolean modelEnabled;
    private boolean questioningEnabled = true;
    private long questioningVersion;

    GuideQuestionTurn(GuideEvidenceReader reader, Generator generator, int maxConcurrentGenerations,
            Duration generationTimeout, GuideDailyGenerationLimit dailyLimit) {
        this(reader, generator, maxConcurrentGenerations, generationTimeout, dailyLimit, GuideVoice.packaged(), true);
    }

    GuideQuestionTurn(GuideEvidenceReader reader, Generator generator, int maxConcurrentGenerations,
            Duration generationTimeout, GuideDailyGenerationLimit dailyLimit, GuideVoice voice) {
        this(reader, generator, maxConcurrentGenerations, generationTimeout, dailyLimit, voice, true);
    }

    GuideQuestionTurn(GuideEvidenceReader reader, Generator generator, int maxConcurrentGenerations,
            Duration generationTimeout, GuideDailyGenerationLimit dailyLimit, GuideVoice voice, boolean modelEnabled) {
        if (maxConcurrentGenerations < 1) throw new IllegalArgumentException("Invalid generation limit");
        generationTimeoutNanos = generationTimeout.toNanos();
        if (generationTimeoutNanos <= 0) throw new IllegalArgumentException("Invalid generation timeout");
        delivery = new GuideAnswerDelivery(reader, voice);
        this.generator = generator;
        this.dailyLimit = Objects.requireNonNull(dailyLimit);
        this.modelEnabled = modelEnabled;
        generationSlots = new Semaphore(maxConcurrentGenerations);
        generationPool = Executors.newFixedThreadPool(maxConcurrentGenerations, runnable -> {
            Thread thread = new Thread(runnable, "luosheng-generation");
            thread.setDaemon(true);
            return thread;
        });
    }

    Optional<Reply> ask(GuideRetrievalSession session, String question, UUID requestId) {
        return ask(session, question, requestId, null);
    }

    Optional<Reply> ask(GuideRetrievalSession session, String question, UUID requestId, Long contextVersion) {
        Objects.requireNonNull(requestId);
        long version;
        synchronized (this) {
            if (!questioningEnabled) return Optional.of(disabled());
            version = questioningVersion;
        }
        return session.retrieve(question, requestId, contextVersion).flatMap(selection -> {
            if (!session.isCurrent(selection)) return Optional.empty();
            var result = selection.result();
            var resultReply = switch (result.kind()) {
                case FIND_SPOT_UNKNOWN -> delivery.deliverFindSpot(session, selection)
                        .map(answer -> new Reply(ReplyKind.FIND_SPOT_UNKNOWN, answer));
                case PERIOD, PERIOD_REFERENCE -> delivery.deliverPeriod(session, selection)
                        .map(answer -> new Reply(ReplyKind.PERIOD, answer))
                        .or(() -> current(session, selection, new Reply(ReplyKind.INSUFFICIENT_EVIDENCE, null)));
                case REFERENCE_FACTS -> delivery.deliverReferenceFacts(session, selection)
                        .map(answer -> new Reply(ReplyKind.REFERENCE_FACTS, answer))
                        .or(() -> current(session, selection, new Reply(ReplyKind.INSUFFICIENT_EVIDENCE, null)));
                case PLATE_PROVENANCE -> delivery.deliverPlateProvenance(session, selection)
                        .map(answer -> new Reply(ReplyKind.PLATE_PROVENANCE, answer))
                        .or(() -> current(session, selection, new Reply(ReplyKind.INSUFFICIENT_EVIDENCE, null)));
                case LOOKPOINT_SOURCE -> delivery.deliverLookpointSource(session, selection)
                        .map(answer -> new Reply(ReplyKind.LOOKPOINT_SOURCE, answer))
                        .or(() -> current(session, selection, new Reply(ReplyKind.INSUFFICIENT_EVIDENCE, null)));
                case PLATE_OBSERVATION -> delivery.deliverPlateObservation(session, selection)
                        .map(answer -> new Reply(ReplyKind.PLATE_OBSERVATION, answer,
                                answer.citations().get(0).reference()))
                        .or(() -> current(session, selection, new Reply(ReplyKind.INSUFFICIENT_EVIDENCE, null)));
                case CLARIFY -> current(session, selection, new Reply(ReplyKind.CLARIFY, null));
                case DISPUTED_EVIDENCE -> current(session, selection, new Reply(ReplyKind.DISPUTED_EVIDENCE, null));
                case INSUFFICIENT_EVIDENCE -> current(session, selection,
                        new Reply(ReplyKind.INSUFFICIENT_EVIDENCE, null));
                case SESSION_RATE_LIMITED -> current(session, selection, new Reply(ReplyKind.SESSION_RATE_LIMITED, null));
                case EVIDENCE -> generate(session, selection, question, version);
            };
            // Generated answers commit their context under the version gate inside generate().
            if (resultReply.isEmpty() || resultReply.get().kind() == ReplyKind.EVIDENCE) return resultReply;
            synchronized (this) {
                if (!validVersion(version)) return Optional.of(disabled());
                var ready = resultReply.get();
                // Record the delivered turn, including an empty set when it had no sources.
                // This must not clear the separate visual lookpoint.
                var sources = ready.answer() == null ? List.<Reference>of() : references(ready.answer());
                boolean remembered = ready.topic() == null
                        ? session.rememberAnswerReferences(selection, sources)
                        : session.rememberAnsweredTopic(selection, ready.topic(), sources);
                return remembered
                        ? resultReply : Optional.<Reply>empty();
            }
        });
    }

    synchronized void setQuestioningEnabled(boolean enabled) {
        if (questioningEnabled == enabled) return;
        questioningEnabled = enabled;
        questioningVersion++;
    }

    private boolean validVersion(long version) {
        return questioningEnabled && questioningVersion == version;
    }

    private static Reply disabled() {
        return new Reply(ReplyKind.QUESTIONING_DISABLED, null);
    }

    private Optional<Reply> generate(GuideRetrievalSession session, GuideRetrievalSession.Selection selection,
            String question, long version) {
        var evidence = selection.result().evidence().stream().map(item -> new EvidenceExcerpt(
                new Reference(item.card().id(), item.card().revision()), item.text(), item.spoken(), item.boundary())).toList();
        if (!session.isCurrent(selection)) return Optional.empty();
        Draft draft;
        if (!modelEnabled) {
            if (evidence.isEmpty()) return current(session, selection, new Reply(ReplyKind.INSUFFICIENT_EVIDENCE, null));
            var primary = evidence.get(0);
            draft = new Draft(primary.spokenText(), List.of(primary.reference()));
        } else {
            var generated = awaitDraft(session, selection, new Input(question, selection.locale(), evidence, session.allowedStops()), version);
            if (generated.failure() != null) {
                return current(session, selection, new Reply(generated.failure(), null));
            }
            draft = generated.draft();
        }
        var answer = delivery.deliver(session, selection, draft);
        if (answer.isEmpty()) return current(session, selection, new Reply(ReplyKind.INSUFFICIENT_EVIDENCE, null));
        var verified = answer.get();
        var topic = verified.citations().size() == 1
                && session.supportsTopic(verified.citations().get(0).reference())
                && (evidence.size() == 1 || session.allowsTopicFromSingleCitation())
                ? verified.citations().get(0).reference() : null;
        synchronized (this) {
            if (!validVersion(version)) return current(session, selection, disabled());
            return session.rememberAnsweredTopic(selection, topic, references(verified))
                    ? Optional.of(new Reply(ReplyKind.EVIDENCE, verified, topic)) : Optional.empty();
        }
    }

    private static List<Reference> references(Answer answer) {
        return answer.citations().stream().map(GuideAnswerReplay.Citation::reference).toList();
    }

    private Generation awaitDraft(GuideRetrievalSession session, GuideRetrievalSession.Selection selection,
            Input input, long version) {
        if (!generationSlots.tryAcquire()) return Generation.unavailable(ReplyKind.GENERATION_BUSY);
        var result = new CompletableFuture<Generation>();
        Future<?> task;
        try {
            task = generationPool.submit(() -> {
                var generated = Generation.unavailable(ReplyKind.GENERATION_UNAVAILABLE);
                try {
                    if (session.isCurrent(selection) && !Thread.currentThread().isInterrupted()) {
                        var blocked = generationBlock(version);
                        if (blocked == null) {
                            var draft = generator.generate(input);
                            if (draft.isPresent()) generated = new Generation(draft.get(), null);
                        } else {
                            generated = Generation.unavailable(blocked);
                        }
                    }
                } catch (RuntimeException unavailable) {
                    // Keep adapter errors out of visitor responses.
                } finally {
                    // A timed-out caller never releases a slot still occupied by its worker.
                    generationSlots.release();
                    result.complete(generated);
                }
            });
        } catch (RuntimeException | Error startupFailure) {
            generationSlots.release();
            throw startupFailure;
        }
        try {
            return result.get(generationTimeoutNanos, TimeUnit.NANOSECONDS);
        } catch (TimeoutException expired) {
            task.cancel(true);
            return Generation.unavailable(ReplyKind.GENERATION_TIMEOUT);
        } catch (InterruptedException interrupted) {
            task.cancel(true);
            Thread.currentThread().interrupt();
            return Generation.unavailable(ReplyKind.GENERATION_UNAVAILABLE);
        } catch (ExecutionException unavailable) {
            return Generation.unavailable(ReplyKind.GENERATION_UNAVAILABLE);
        }
    }

    private synchronized ReplyKind generationBlock(long version) {
        if (!validVersion(version)) return ReplyKind.QUESTIONING_DISABLED;
        return dailyLimit.tryStart() ? null : ReplyKind.GENERATION_LIMIT_REACHED;
    }

    private static Optional<Reply> current(GuideRetrievalSession session,
            GuideRetrievalSession.Selection selection, Reply reply) {
        return session.isCurrent(selection) ? Optional.of(reply) : Optional.empty();
    }
}
