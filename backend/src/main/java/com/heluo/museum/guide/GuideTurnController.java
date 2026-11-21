package com.heluo.museum.guide;

import com.heluo.museum.common.api.ApiResponse;
import com.heluo.museum.common.error.ResourceNotFoundException;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Duration;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@ConditionalOnProperty(name = "museum.guide.turns-enabled", havingValue = "true")
class GuideTurnController {
    private static final Logger LOG = LoggerFactory.getLogger(GuideTurnController.class);
    private static final String VISITS = GuideTurnController.class.getName() + ".visits";
    private static final Duration LIFETIME = Duration.ofMinutes(15);
    private static final Map<String, String> JOURNEY_EVENTS = Map.of(
            "plate-attempted", "plate.attempted", "plate-arrived", "plate.arrived",
            "return-attempted", "return.attempted", "return-arrived", "return.arrived",
            "clarification-single", "clarification.single", "clarification-repeated", "clarification.repeated");

    private final Clock clock = Clock.system(ZoneId.of("Asia/Shanghai"));
    private final GuideEvidenceVisibility visibility;
    private final GuideEvidenceReader reader;
    private final GuideProfile profiles;
    private final GuideFollowUpRetrieval retrieval;
    private final GuideQuestionTurn flow;
    private final Path pauseFile;
    private final MeterRegistry metrics;

    GuideTurnController(JdbcTemplate jdbc, MeterRegistry metrics,
            @Value("${museum.guide.pack-path}") String pack,
            @Value("${museum.guide.minimum-version-path}") String minimum,
            @Value("${museum.guide.approved-digest-path}") String digest,
            @Value("${museum.guide.profile-path:}") String profilePath,
            @Value("${museum.guide.model-endpoint}") URI endpoint,
            @Value("${museum.guide.model-name}") String model,
            @Value("${museum.guide.model-key}") String key,
            @Value("${museum.guide.daily-turn-limit}") int dailyLimit,
            @Value("${museum.guide.pause-path}") String pausePath) {
        if (pack.isBlank() || minimum.isBlank() || digest.isBlank()
                || !"https".equals(endpoint.getScheme()) || dailyLimit < 1) {
            throw new IllegalArgumentException("Missing guide evidence or approved model configuration");
        }
        visibility = new GuideEvidenceVisibility(jdbc, clock);
        this.metrics = metrics;
        reader = new GuideEvidenceReader(new GuideEvidenceFileSource(
                Path.of(pack), Path.of(minimum), Path.of(digest)), visibility);
        profiles = GuideProfile.load(profilePath);
        retrieval = new GuideFollowUpRetrieval(reader, profiles);
        var generationRejections = metrics.counter("museum.guide.generation.rejected");
        var generator = new GuideStructuredGenerator(new GuideChatCompletionModel(endpoint, model, key),
                generationRejections::increment);
        pauseFile = pausePath.isBlank() ? null : Path.of(pausePath);
        var generationStarts = metrics.counter("museum.guide.generation.started");
        flow = new GuideQuestionTurn(reader, input -> {
            generationStarts.increment();
            LOG.info("event=guide_generation_started");
            return generator.generate(input);
        }, 1, Duration.ofSeconds(8),
                new GuideDailyGenerationLimit(clock, dailyLimit));
    }

    @PostMapping(path = "/api/v1/guide/turns", consumes = "application/json")
    ResponseEntity<ApiResponse<TurnReply>> turn(@RequestBody Turn input, HttpServletRequest request) {
        long startedAt = System.nanoTime();
        if (!"same-origin".equals(request.getHeader("Sec-Fetch-Site"))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        validate(input);
        if (questioningPaused()) return paused(startedAt);
        var profile = profiles.find(input.exhibit(), input.locale());
        if (profile == null || !profile.artifactSlug().equals(input.artifact())
                || visibility.publicArtifactSlug(input.exhibit()).filter(input.artifact()::equals).isEmpty()) {
            throw new ResourceNotFoundException("Guide exhibit unavailable");
        }
        if (input.lookpoint() != null && profile.plate(input.lookpoint()) == null) {
            throw new IllegalArgumentException("Invalid guide lookpoint for exhibit");
        }
        var cards = reader.listPublished(input.exhibit(), input.locale());
        if (cards.isEmpty()) return reply(startedAt,
                new TurnReply("INSUFFICIENT_EVIDENCE", null, List.of(), null, false));
        var session = request.getSession();
        GuideRetrievalSession state;
        synchronized (session) {
            @SuppressWarnings("unchecked")
            var visits = (LinkedHashMap<UUID, Visit>) session.getAttribute(VISITS);
            if (visits == null) {
                visits = new LinkedHashMap<>();
                session.setAttribute(VISITS, visits);
            }
            var visit = visits.get(input.visitId());
            if (visit == null) {
                if (visits.size() >= 8) visits.remove(visits.keySet().iterator().next()).state.leave();
                visit = new Visit(new GuideRetrievalSession(retrieval, clock, LIFETIME));
                visits.put(input.visitId(), visit);
            }
            bind(visit, input, profile);
            state = visit.state;
        }
        var result = flow.ask(state, input.question(), input.requestId(), input.contextVersion())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT));
        if (questioningPaused()) {
            state.clearLookpoint();
            return paused(startedAt);
        }
        var answer = result.answer();
        var plate = result.topic() == null ? null : profile.plate(result.topic());
        return reply(startedAt, new TurnReply(result.kind().name(), answer == null ? null : answer.text(),
                answer == null ? List.of() : answer.citations(), plate == null ? null : plate.stop(),
                result.kind() == GuideQuestionTurn.ReplyKind.EVIDENCE));
    }

    @PostMapping(path = "/api/v1/guide/journey", consumes = "application/json")
    ResponseEntity<Void> recordJourney(@RequestBody JourneyEvent event, HttpServletRequest request) {
        if (!"same-origin".equals(request.getHeader("Sec-Fetch-Site"))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        String category = JOURNEY_EVENTS.getOrDefault(Objects.toString(event.kind(), ""), null);
        if (category == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        metrics.counter("museum.guide.journey", "event", category).increment();
        return ResponseEntity.noContent().build();
    }

    record JourneyEvent(String kind) {}

    private synchronized boolean questioningPaused() {
        boolean paused = pauseFile != null && Files.exists(pauseFile);
        flow.setQuestioningEnabled(!paused);
        return paused;
    }

    private ResponseEntity<ApiResponse<TurnReply>> paused(long startedAt) {
        return reply(startedAt, new TurnReply("QUESTIONING_DISABLED", null, List.of(), null, false));
    }

    private void bind(Visit visit, Turn input, GuideProfile.Exhibit profile) {
        boolean sameContext = Objects.equals(visit.exhibit, input.exhibit())
                && Objects.equals(visit.artifact, input.artifact())
                && Objects.equals(visit.lookpoint, input.lookpoint());
        if (input.contextVersion() < visit.version || (input.contextVersion() == visit.version && !sameContext)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT);
        }
        if (input.contextVersion() == visit.version) return;
        synchronized (visit.state) {
            visit.state.enter(input.exhibit(), input.locale());
            if (input.lookpoint() != null) {
                var reference = profile.plate(input.lookpoint()).reference();
                reader.resolve(input.exhibit(), input.locale(), List.of(reference))
                        .ifPresent(cards -> visit.state.confirm(new GuideFollowUpRetrieval.ConfirmedLookpoint(
                                input.exhibit(), input.locale(), reference)));
            }
            visit.state.version(input.contextVersion());
        }
        visit.exhibit = input.exhibit();
        visit.artifact = input.artifact();
        visit.lookpoint = input.lookpoint();
        visit.version = input.contextVersion();
    }

    private static void validate(Turn input) {
        if (input.question() == null || input.question().isBlank() || input.question().length() > 300
                || input.requestId() == null || input.visitId() == null || input.contextVersion() < 0
                || !"zh-CN".equals(input.locale()) || !GuideProfile.slug(input.artifact()) || !GuideProfile.slug(input.exhibit())) {
            throw new IllegalArgumentException("Invalid guide turn");
        }
    }

    private ResponseEntity<ApiResponse<TurnReply>> reply(long startedAt, TurnReply reply) {
        long elapsed = System.nanoTime() - startedAt;
        metrics.timer("museum.guide.turn.duration", "outcome", reply.kind()).record(elapsed, TimeUnit.NANOSECONDS);
        LOG.info("event=guide_turn outcome={} generated={} citations={} elapsedMs={}", reply.kind(),
                reply.generated(), reply.citations().size(), TimeUnit.NANOSECONDS.toMillis(elapsed));
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(ApiResponse.ok(reply, "guide turn"));
    }

    private static class Visit {
        private final GuideRetrievalSession state;
        private long version = -1;
        private String artifact;
        private String exhibit;
        private String lookpoint;
        private Visit(GuideRetrievalSession state) { this.state = state; }
    }

    record Turn(String question, UUID requestId, UUID visitId, long contextVersion,
                String locale, String artifact, String exhibit, String lookpoint) {}
    record TurnReply(String kind, String text, List<GuideAnswerReplay.Citation> citations, String plate, boolean generated) {}
}
