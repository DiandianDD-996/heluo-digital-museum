package com.heluo.museum.guide;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.MeterRegistry;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "server.address=127.0.0.1",
        "spring.datasource.url=jdbc:h2:mem:guide-preset;MODE=MySQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "museum.guide.preset-enabled=true",
        "museum.guide.turns-enabled=true",
        "museum.guide.model-endpoint=https://127.0.0.1:1/v1/chat/completions",
        "museum.guide.model-name=guide-fixture",
        "museum.guide.model-key=test-only",
        "museum.guide.daily-turn-limit=1",
        "museum.bootstrap.enabled=true",
        "museum.bootstrap.admin-username=guide_preset_test",
        "museum.bootstrap.admin-password=GuidePresetFixtureOnly123",
        "museum.bootstrap.admin-email=guide-preset@example.test"
})
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class GuideExhibitIntegrationTests {
    private static final String URL = "/api/v1/guide/exhibits/heluo-bronze-ding-3d";
    private static final Path EVAL = Path.of("..", "docs", "plans", "luosheng-eval");
    private static final Path DATED_CANDIDATE = EVAL.resolve("ding-zh-CN-0.5.0-signoff-candidate.2026-11-22.json");
    private static final String DATED_DIGEST = "1f8d3c15ab6bc7d9b694eb212205778e2d27d82f8c7017333c8521342405d1cf";
    @TempDir static Path files;
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper mapper;
    @Autowired MeterRegistry metrics;
    @LocalServerPort int port;

    @DynamicPropertySource
    static void paths(DynamicPropertyRegistry properties) {
        properties.add("museum.guide.pack-path", () -> files.resolve("evidence.json").toString());
        properties.add("museum.guide.minimum-version-path", () -> files.resolve("minimum-version").toString());
        properties.add("museum.guide.approved-digest-path", () -> files.resolve("approved.sha256").toString());
        properties.add("museum.guide.pause-path", () -> files.resolve("paused").toString());
        properties.add("museum.guide.profile-path", GuideExhibitIntegrationTests::combinedProfilePath);
    }

    private static String combinedProfilePath() {
        var json = new ObjectMapper();
        try (var ding = GuideExhibitIntegrationTests.class.getResourceAsStream("/guide/ding-profile.json");
                var jade = GuideExhibitIntegrationTests.class.getResourceAsStream("/guide/jade-profile.json")) {
            var root = json.readTree(ding);
            ((com.fasterxml.jackson.databind.node.ArrayNode) root.get("exhibits")).add(json.readTree(jade));
            return Files.writeString(files.resolve("profiles.json"), json.writeValueAsString(root)).toString();
        } catch (java.io.IOException exception) {
            throw new java.io.UncheckedIOException(exception);
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"missing-file", "missing-field", "duplicate-stop", "blank-stop", "invalid-revision"})
    void invalidProfilePreventsTurnControllerStartup(String defect) throws Exception {
        var path = files.resolve(defect + ".json");
        if (!defect.equals("missing-file")) {
            var root = (com.fasterxml.jackson.databind.node.ObjectNode)
                    mapper.readTree(Files.readString(Path.of(combinedProfilePath())));
            var exhibit = (com.fasterxml.jackson.databind.node.ObjectNode) root.get("exhibits").get(0);
            var plates = (com.fasterxml.jackson.databind.node.ArrayNode) exhibit.get("plates");
            switch (defect) {
                case "missing-field" -> exhibit.remove("artifactSlug");
                case "duplicate-stop" -> plates.add(plates.get(0).deepCopy());
                case "blank-stop" -> ((com.fasterxml.jackson.databind.node.ObjectNode) plates.get(0)).put("stop", " ear ");
                case "invalid-revision" -> ((com.fasterxml.jackson.databind.node.ObjectNode) plates.get(0)).put("revision", 0);
                default -> throw new AssertionError(defect);
            }
            Files.writeString(path, mapper.writeValueAsString(root));
        }
        new ApplicationContextRunner()
                .withUserConfiguration(GuideTurnController.class, GuideVoice.class)
                .withBean(JdbcTemplate.class, () -> jdbc)
                .withBean(MeterRegistry.class, () -> new io.micrometer.core.instrument.simple.SimpleMeterRegistry())
                .withPropertyValues("museum.guide.turns-enabled=true", "museum.guide.profile-path=" + path,
                        "museum.guide.pack-path=pack.json", "museum.guide.minimum-version-path=minimum",
                        "museum.guide.approved-digest-path=digest", "museum.guide.pause-path=",
                        "museum.guide.model-endpoint=https://127.0.0.1:1", "museum.guide.model-name=fixture",
                        "museum.guide.model-key=fixture", "museum.guide.daily-turn-limit=1")
                .run(context -> org.assertj.core.api.Assertions.assertThat(context.getStartupFailure())
                        .hasRootCauseMessage(switch (defect) {
                            case "missing-file" -> path.toString();
                            case "missing-field" -> "Invalid museum.guide.profile-path: expected exhibit slug, artifact slug and zh-CN locale";
                            case "duplicate-stop", "blank-stop" -> "Invalid museum.guide.profile-path: blank, padded or duplicate stop";
                            case "invalid-revision" -> "Invalid museum.guide.profile-path: cardId must be nonblank and revision must be positive";
                            default -> throw new AssertionError(defect);
                        }));
    }

    @Test
    void journeyRecordsOnlyAllowlistedAnonymousEventsFromTheSameOrigin() throws Exception {
        String path = "/api/v1/guide/journey";
        var count = metrics.counter("museum.guide.journey", "event", "return.attempted");
        double before = count.count();
        mvc.perform(post(path).header("Sec-Fetch-Site", "cross-site").contentType("application/json")
                .content("{\"kind\":\"return-attempted\"}")).andExpect(status().isForbidden());
        mvc.perform(post(path).header("Sec-Fetch-Site", "same-origin").contentType("application/json")
                .content("{\"kind\":\"unknown\"}")).andExpect(status().isBadRequest());
        mvc.perform(post(path).header("Sec-Fetch-Site", "same-origin").contentType("application/json")
                .content("{\"kind\":\"return-attempted\"}")).andExpect(status().isNoContent());
        assertEquals(before + 1, count.count());
        for (var category : List.of("single", "repeated")) {
            var clarification = metrics.counter("museum.guide.journey", "event", "clarification." + category);
            double initial = clarification.count();
            mvc.perform(post(path).header("Sec-Fetch-Site", "same-origin").contentType("application/json")
                    .content("{\"kind\":\"clarification-" + category + "\"}")).andExpect(status().isNoContent());
            assertEquals(initial + 1, clarification.count());
        }
    }

    @Test
    void candidateMetricsSeparateClarificationDispatchFailureAndBudgetRejection() throws Exception {
        var pack = files.resolve("evidence.json");
        Files.writeString(pack, reviewedPack());
        Files.writeString(files.resolve("minimum-version"), "2");
        approveTestPack(pack);
        var starts = metrics.counter("museum.guide.generation.started");
        double initialStarts = starts.count();
        var visitId = UUID.randomUUID();
        var session = new MockHttpSession();
        String[][] examples = {
            {"另一只呢", "CLARIFY"},
            {"鼎耳在哪？", "GENERATION_UNAVAILABLE"},
            {"鼎耳在哪？", "GENERATION_LIMIT_REACHED"}
        };
        for (int i = 0; i < examples.length; i++) {
            var example = examples[i];
            var timer = metrics.timer("museum.guide.turn.duration", "outcome", example[1]);
            long initialTurns = timer.count();
            var body = mapper.writeValueAsString(Map.of(
                    "question", example[0], "requestId", UUID.randomUUID(), "visitId", visitId,
                    "contextVersion", 1, "locale", "zh-CN",
                    "artifact", "heluo-bronze-ding", "exhibit", "heluo-bronze-ding-3d"));
            mvc.perform(post("/api/v1/guide/turns").session(session).header("Sec-Fetch-Site", "same-origin")
                    .contentType("application/json").content(body))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.data.kind").value(example[1]))
                    .andExpect(jsonPath("$.data.generated").value(false));
            assertEquals(initialTurns + 1, timer.count());
            assertEquals(initialStarts + (i == 0 ? 0 : 1), starts.count());
        }
    }

    @Test
    void candidateTurnsGateTransportContextApprovalAndVisibilityWithoutCallingAProvider() throws Exception {
        var pack = files.resolve("evidence.json");
        var approval = files.resolve("approved.sha256");
        Files.writeString(pack, reviewedPack());
        Files.writeString(files.resolve("minimum-version"), "2");
        approveTestPack(pack);
        var body = """
                {"question":"另一只呢","requestId":"35f7569e-2069-4807-8c39-74ab1c007753",
                 "visitId":"f6b90ede-81f4-4819-94f3-47201e9af798","contextVersion":1,"locale":"zh-CN",
                 "artifact":"heluo-bronze-ding","exhibit":"heluo-bronze-ding-3d","lookpoint":null}
                """;
        var session = new MockHttpSession();
        var url = "/api/v1/guide/turns";
        mvc.perform(post(url).contentType("application/json").content(body)).andExpect(status().isForbidden());
        Files.writeString(files.resolve("paused"), "paused");
        try {
            mvc.perform(post(url).session(session).header("Sec-Fetch-Site", "same-origin").contentType("application/json").content(body))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.data.kind").value("QUESTIONING_DISABLED"));
        } finally {
            Files.delete(files.resolve("paused"));
        }
        mvc.perform(post(url).session(session).header("Sec-Fetch-Site", "same-origin").contentType("application/json").content(body))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.data.kind").value("CLARIFY"));
        mvc.perform(post(url).session(session).header("Sec-Fetch-Site", "same-origin").contentType("application/json").content(body))
                .andExpect(status().isConflict());
        mvc.perform(post(url).session(session).header("Sec-Fetch-Site", "same-origin").contentType("application/json")
                .content(body.replace("\"contextVersion\":1", "\"contextVersion\":0")))
                .andExpect(status().isConflict());
        Files.delete(approval);
        mvc.perform(post(url).session(session).header("Sec-Fetch-Site", "same-origin").contentType("application/json").content(body))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.kind").value("INSUFFICIENT_EVIDENCE"));
        jdbc.update("update exhibits_3d set status='WITHDRAWN' where slug='heluo-bronze-ding-3d'");
        mvc.perform(post(url).session(session).header("Sec-Fetch-Site", "same-origin").contentType("application/json").content(body))
                .andExpect(status().isNotFound());
    }

    @Test
    void realPauseFileStopsExistingAndNewVisitsWithoutDisablingPresetsOrPublicSlots() throws Exception {
        var pack = files.resolve("evidence.json");
        Files.writeString(pack, candidatePack());
        Files.writeString(files.resolve("minimum-version"), "2");
        approveTestPack(pack);
        long owner = jdbc.queryForObject("select id from users where username='guide_preset_test'", Long.class);
        var date = LocalDate.now(ZoneId.of("Asia/Shanghai")).plusDays(2);
        jdbc.update("insert into appointment_slots(visit_date,start_time,end_time,capacity,created_by,updated_by)"
                + " values(?,?,?,?,?,?)", date, LocalTime.of(10, 0), LocalTime.of(10, 30), 6, owner, owner);
        var existing = new MockHttpSession();
        var visit = UUID.randomUUID();
        var generation = metrics.counter("museum.guide.generation.started");
        double initialCount = generation.count();
        String question = "它是什么年代的？";
        ask(existing, visit, question).andExpect(jsonPath("$.data.citations[0].reference.cardId").value("LS-DING-PERIOD"));

        var pause = files.resolve("paused");
        Files.writeString(pause, "paused");
        try {
            for (var session : List.of(existing, new MockHttpSession())) {
                ask(session, session == existing ? visit : UUID.randomUUID(), question)
                        .andExpect(jsonPath("$.data.kind").value("QUESTIONING_DISABLED"))
                        .andExpect(jsonPath("$.data.generated").value(false))
                        .andExpect(jsonPath("$.data.text").doesNotExist())
                        .andExpect(jsonPath("$.data.plate").doesNotExist())
                        .andExpect(jsonPath("$.data.citations").isEmpty());
            }
            mvc.perform(get(URL)).andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.available").value(true))
                    .andExpect(jsonPath("$.data.entries[0].cardId").value("LS-DING-EARS"))
                    .andExpect(jsonPath("$.data.entries[0].revision").value(1))
                    .andExpect(jsonPath("$.data.entries[0].text").value("Approved observation"));
            mvc.perform(get("/api/v1/appointment-slots").param("dateFrom", date.toString()).param("dateTo", date.toString()))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].remainingPeople").value(6));
        } finally {
            Files.deleteIfExists(pause);
        }
        ask(existing, visit, question).andExpect(jsonPath("$.data.kind").value("PERIOD"))
                .andExpect(jsonPath("$.data.citations[0].reference.cardId").value("LS-DING-PERIOD"));
        assertEquals(initialCount, generation.count());
    }

    @Test
    void datedTrialCandidateServesItsExactEvidenceWithoutGenerating() throws Exception {
        var bytes = datedCandidateBytes();
        var cards = new java.util.HashMap<String, String>();
        mapper.readTree(bytes).get("cards").forEach(card -> cards.put(card.get("id").asText(), card.get("text").asText()));
        Path pack = files.resolve("evidence.json");
        Path approval = files.resolve("approved.sha256");
        Files.write(pack, bytes);
        Files.writeString(files.resolve("minimum-version"), "4");
        Files.deleteIfExists(approval);
        try {
            mvc.perform(get(URL)).andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.available").value(false));
            Files.writeString(approval, DATED_DIGEST);
            mvc.perform(get(URL)).andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.available").value(true))
                    .andExpect(jsonPath("$.data.entries[?(@.cardId == 'LS-DING-EARS')].text",
                            org.hamcrest.Matchers.hasItem(cards.get("LS-DING-EARS"))));
            var generation = metrics.counter("museum.guide.generation.started");
            double before = generation.count();
            var session = new MockHttpSession();
            var visit = UUID.randomUUID();
            ask(session, visit, "它是什么年代的？").andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.kind").value("PERIOD"))
                    .andExpect(jsonPath("$.data.text").value(cards.get("LS-DING-PERIOD")))
                    .andExpect(jsonPath("$.data.generated").value(false))
                    .andExpect(jsonPath("$.data.citations[0].reference.cardId").value("LS-DING-PERIOD"));
            ask(session, visit, "在哪里出土？").andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.kind").value("FIND_SPOT_UNKNOWN"))
                    .andExpect(jsonPath("$.data.generated").value(false))
                    .andExpect(jsonPath("$.data.citations[0].reference.cardId").value("LS-DING-SOURCE"));
            ask(session, visit, "它有多大？")
                    .andExpect(jsonPath("$.data.kind").value("REFERENCE_FACTS"))
                    .andExpect(jsonPath("$.data.text").value(cards.get("LS-DING-SIZE")))
                    .andExpect(jsonPath("$.data.generated").value(false))
                    .andExpect(jsonPath("$.data.citations[0].reference.cardId").value("LS-DING-SIZE"));
            ask(session, visit, "鼎耳多高？")
                    .andExpect(jsonPath("$.data.kind").value("REFERENCE_FACTS"))
                    .andExpect(jsonPath("$.data.text").value(GuideVoice.packaged().missing("DETAIL_SIZE")))
                    .andExpect(jsonPath("$.data.generated").value(false))
                    .andExpect(jsonPath("$.data.citations").isEmpty());
            ask(session, visit, "图版是原器照片吗？")
                    .andExpect(jsonPath("$.data.kind").value("PLATE_PROVENANCE"))
                    .andExpect(jsonPath("$.data.text").value(cards.get("LS-DING-SOURCE")))
                    .andExpect(jsonPath("$.data.generated").value(false))
                    .andExpect(jsonPath("$.data.citations[0].reference.cardId").value("LS-DING-SOURCE"));
            ask(session, visit, "我说的是脚")
                    .andExpect(jsonPath("$.data.kind").value("PLATE_OBSERVATION"))
                    .andExpect(jsonPath("$.data.text").value(cards.get("LS-DING-FEET")))
                    .andExpect(jsonPath("$.data.generated").value(false))
                    .andExpect(jsonPath("$.data.citations[0].reference.cardId").value("LS-DING-FEET"));
            assertEquals(before, generation.count());
        } finally {
            Files.deleteIfExists(approval);
            Files.deleteIfExists(files.resolve("minimum-version"));
            Files.deleteIfExists(pack);
        }
    }

    @Test
    void anonymousPresetFollowsCurrentApprovalAndCatalogVisibility() throws Exception {
        String reviewed = reviewedPack();
        Path pack = files.resolve("evidence.json");
        Files.deleteIfExists(files.resolve("approved.sha256"));
        Files.writeString(pack, reviewed);
        Files.writeString(files.resolve("minimum-version"), "2");
        mvc.perform(get(URL)).andExpect(status().isOk()).andExpect(jsonPath("$.data.available").value(false));

        approveTestPack(pack);
        mvc.perform(get(URL)).andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.data.available").value(true))
                .andExpect(jsonPath("$.data.entries.length()").value(1))
                .andExpect(jsonPath("$.data.entries[0].cardId").value("VISIBLE"))
                .andExpect(jsonPath("$.data.entries[0].revision").value(3))
                .andExpect(jsonPath("$.data.entries[0].text").value("Approved observation"))
                .andExpect(jsonPath("$.data.entries[0].publicSource").value("https://museum.example.test/record"));
        mvc.perform(get(URL).param("locale", "en-US"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.available").value(false));
        mvc.perform(get(URL).param("locale", "zh CN"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

        Files.writeString(pack, reviewed.replace("Approved observation", "Replaced observation"));
        mvc.perform(get(URL)).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.available").value(false))
                .andExpect(jsonPath("$.data.entries.length()").value(0));
        Files.writeString(pack, reviewed);
        jdbc.update("update exhibits_3d set status='WITHDRAWN' where slug='heluo-bronze-ding-3d'");
        mvc.perform(get(URL)).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"));
    }

    @Test
    void periodAndFindSpotUseSeparateReviewedReferencesWithoutReplacingTheVisualLookpoint() throws Exception {
        Path pack = files.resolve("evidence.json");
        Files.writeString(files.resolve("minimum-version"), "2");
        String contents = candidatePack();
        Files.writeString(pack, contents);
        approveTestPack(pack);
        var session = new MockHttpSession();
        var visit = UUID.randomUUID();
        ask(session, visit, "这个看点的依据是什么？")
                .andExpect(jsonPath("$.data.citations[0].reference.cardId").value("LS-DING-EARS"));
        ask(session, visit, "它是什么年代的？")
                .andExpect(jsonPath("$.data.kind").value("PERIOD"))
                .andExpect(jsonPath("$.data.text").value("Synthetic period for the reference object"))
                .andExpect(jsonPath("$.data.generated").value(false))
                .andExpect(jsonPath("$.data.citations[0].reference.cardId").value("LS-DING-PERIOD"));
        ask(session, visit, "你怎么知道的？")
                .andExpect(jsonPath("$.data.citations[0].reference.cardId").value("LS-DING-PERIOD"));
        ask(session, visit, "在哪里出土？")
                .andExpect(jsonPath("$.data.kind").value("FIND_SPOT_UNKNOWN"))
                .andExpect(jsonPath("$.data.citations.length()").value(1))
                .andExpect(jsonPath("$.data.citations[0].reference.cardId").value("LS-DING-SOURCE"));
        ask(session, visit, "你怎么知道的？")
                .andExpect(jsonPath("$.data.citations[0].reference.cardId").value("LS-DING-SOURCE"));
        visit = UUID.randomUUID();
        ask(session, visit, "这是哪个朝代的？")
                .andExpect(jsonPath("$.data.citations[0].reference.cardId").value("LS-DING-PERIOD"));
        String withdrawnPeriod = contents.replace("\"LS-DING-PERIOD\",\"revision\":1", "\"LS-DING-PERIOD\",\"revision\":2")
                .replace("\"PUBLISHED\",\"text\":\"Synthetic period", "\"DRAFT\",\"text\":\"Synthetic period");
        Files.writeString(pack, withdrawnPeriod);
        approveTestPack(pack);
        ask(session, visit, "你怎么知道的？")
                .andExpect(jsonPath("$.data.kind").value("INSUFFICIENT_EVIDENCE"));
        ask(session, visit, "它是什么年代的？")
                .andExpect(jsonPath("$.data.kind").value("PERIOD"))
                .andExpect(jsonPath("$.data.citations[0].reference.cardId").value("LS-DING-SOURCE"));

        Files.writeString(pack, withdrawnPeriod.replace("\"LS-DING-SOURCE\"", "\"UNRELATED\""));
        approveTestPack(pack);
        ask(session, visit, "它是什么年代的？")
                .andExpect(jsonPath("$.data.kind").value("INSUFFICIENT_EVIDENCE"))
                .andExpect(jsonPath("$.data.citations").isEmpty());
    }

    @Test
    void mixedFactsAnswerOnlyWhatEachApprovedCardSupports() throws Exception {
        Path pack = files.resolve("evidence.json");
        String contents = candidatePack();
        Files.writeString(files.resolve("minimum-version"), "2");
        Files.writeString(pack, contents);
        approveTestPack(pack);
        var session = new MockHttpSession();
        var visit = UUID.randomUUID();
        ask(session, visit, "它多大、哪里出土？")
                .andExpect(jsonPath("$.data.kind").value("REFERENCE_FACTS"))
                .andExpect(jsonPath("$.data.text").value(org.hamcrest.Matchers.allOf(
                        org.hamcrest.Matchers.containsString("Synthetic overall size"),
                        org.hamcrest.Matchers.containsString("缺的是：出土地记录。"))))
                .andExpect(jsonPath("$.data.generated").value(false))
                .andExpect(jsonPath("$.data.plate").isEmpty())
                .andExpect(jsonPath("$.data.citations.length()").value(2))
                .andExpect(jsonPath("$.data.citations[0].reference.cardId").value("LS-DING-SIZE"))
                .andExpect(jsonPath("$.data.citations[1].reference.cardId").value("LS-DING-SOURCE"));
        ask(session, visit, "什么年代的？又在哪里出土？")
                .andExpect(jsonPath("$.data.citations[0].reference.cardId").value("LS-DING-PERIOD"))
                .andExpect(jsonPath("$.data.citations[1].reference.cardId").value("LS-DING-SOURCE"));
        ask(session, visit, "鼎耳多大、哪里出土？")
                .andExpect(jsonPath("$.data.text").value(org.hamcrest.Matchers.containsString("缺的是：这个部位的实测尺寸。")))
                .andExpect(jsonPath("$.data.citations.length()").value(1))
                .andExpect(jsonPath("$.data.citations[0].reference.cardId").value("LS-DING-SOURCE"));
        ask(session, visit, "数字模型的整体尺寸是多少？")
                .andExpect(jsonPath("$.data.text").value("缺的是：数字模型的尺寸记录。"))
                .andExpect(jsonPath("$.data.citations").isEmpty());

        Files.writeString(pack, contents.replace("\"LS-DING-SIZE\",\"revision\":1", "\"LS-DING-SIZE\",\"revision\":2"));
        approveTestPack(pack);
        ask(session, visit, "它多大、哪里出土？")
                .andExpect(jsonPath("$.data.kind").value("REFERENCE_FACTS"))
                .andExpect(jsonPath("$.data.text").value(org.hamcrest.Matchers.containsString("缺的是：参考实物的整体尺寸。")))
                .andExpect(jsonPath("$.data.citations.length()").value(1))
                .andExpect(jsonPath("$.data.citations[0].reference.cardId").value("LS-DING-SOURCE"));
    }

    private org.springframework.test.web.servlet.ResultActions ask(MockHttpSession session, UUID visit, String question)
            throws Exception {
        var body = mapper.writeValueAsString(Map.of(
                "question", question, "requestId", UUID.randomUUID(), "visitId", visit,
                "contextVersion", 1, "locale", "zh-CN", "artifact", "heluo-bronze-ding",
                "exhibit", "heluo-bronze-ding-3d", "lookpoint", "ear"));
        return mvc.perform(post("/api/v1/guide/turns").session(session).header("Sec-Fetch-Site", "same-origin")
                .contentType("application/json").content(body)).andExpect(status().isOk());
    }

    @ParameterizedTest
    @CsvSource({
        "heluo-bronze-ding, ear, 鼎耳, LS-DING-EARS",
        "river-map-jade-bi, motif, 内缘纹样, FIXTURE-JADE-RIM"
    })
    void sameReviewPathForTwoDifferentExhibits(String artifact, String stop, String correction, String card)
            throws Exception {
        seedJadeExhibit(artifact + "-unprofiled");
        seedJadeExhibit("river-map-jade-bi-3d");
        var pack = files.resolve("evidence.json");
        var payload = mapper.readTree(candidatePack());
        try (var input = getClass().getResourceAsStream("/guide/jade-evidence.json")) {
            ((com.fasterxml.jackson.databind.node.ArrayNode) payload.get("cards"))
                    .addAll((com.fasterxml.jackson.databind.node.ArrayNode) mapper.readTree(input));
        }
        Files.writeString(pack, mapper.writeValueAsString(payload));
        Files.writeString(files.resolve("minimum-version"), "2");
        approveTestPack(pack);
        var session = new MockHttpSession();
        var visit = UUID.randomUUID();
        exhibitTurn(session, visit, "river-map-jade-bi", artifact + "-unprofiled", stop, "另一只呢")
                .andExpect(status().isNotFound());
        exhibitTurn(session, visit, artifact, artifact + "-3d", stop, "另一只呢")
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.kind").value("PLATE_OBSERVATION"))
                .andExpect(jsonPath("$.data.plate").value(stop))
                .andExpect(jsonPath("$.data.citations[0].reference.cardId").value(card));
        exhibitTurn(session, visit, artifact, artifact + "-3d", stop, "我说的是" + correction)
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.kind").value("PLATE_OBSERVATION"))
                .andExpect(jsonPath("$.data.plate").value(stop))
                .andExpect(jsonPath("$.data.generated").value(false));
        exhibitTurn(session, visit, artifact, artifact + "-3d", stop, "你怎么知道的？")
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.kind").value("LOOKPOINT_SOURCE"))
                .andExpect(jsonPath("$.data.citations[0].reference.cardId").value(card));
        // Keep every other signed fixture card, but move this one to a different revision.
        for (var item : payload.get("cards")) {
            if (card.equals(item.path("id").asText())) {
                ((com.fasterxml.jackson.databind.node.ObjectNode) item).put("revision", 20);
            }
        }
        Files.writeString(pack, mapper.writeValueAsString(payload));
        approveTestPack(pack);
        exhibitTurn(session, visit, artifact, artifact + "-3d", stop, "我说的是" + correction)
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.kind").value("INSUFFICIENT_EVIDENCE"))
                .andExpect(jsonPath("$.data.citations").isEmpty());
        Files.writeString(pack, mapper.writeValueAsString(payload).replace("\"" + card + "\"", "\"UNROUTED-FIXTURE\""));
        approveTestPack(pack);
        exhibitTurn(session, visit, artifact, artifact + "-3d", stop, "我说的是" + correction)
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.kind").value("INSUFFICIENT_EVIDENCE"))
                .andExpect(jsonPath("$.data.citations").isEmpty());
    }

    private void seedJadeExhibit(String exhibit) {
        assertEquals(1, jdbc.update("""
                insert into exhibits_3d (artifact_id,title,slug,model_url,model_source_ref,model_size_bytes,
                    status,published_at,created_by,updated_by)
                select a.id,'Synthetic jade exhibit',?,'/fixture.glb',?,1,'PUBLISHED',CURRENT_TIMESTAMP,
                    e.created_by,e.updated_by
                from artifacts a cross join exhibits_3d e
                where a.slug='river-map-jade-bi' and e.slug='heluo-bronze-ding-3d'
                """, exhibit, exhibit));
    }

    private org.springframework.test.web.servlet.ResultActions exhibitTurn(MockHttpSession session, UUID visit,
            String artifact, String exhibit, String stop, String question) throws Exception {
        var body = mapper.writeValueAsString(Map.of(
                "question", question, "requestId", UUID.randomUUID(), "visitId", visit,
                "contextVersion", 1, "locale", "zh-CN", "artifact", artifact,
                "exhibit", exhibit, "lookpoint", stop));
        return mvc.perform(post("/api/v1/guide/turns").session(session).header("Sec-Fetch-Site", "same-origin")
                .contentType("application/json").content(body));
    }

    @Test
    @EnabledIfEnvironmentVariable(named = "LUOSHENG_RUN_BROWSER", matches = "1")
    void visitorReadsApprovedPresetFromCatalog() throws Exception {
        runBrowser(false);
    }

    @Test
    @EnabledIfEnvironmentVariable(named = "LUOSHENG_LOCAL_DEMO", matches = "1")
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void serveLocalCandidate() throws Exception {
        seedDemoSlots(1);
        boolean dated = "1".equals(System.getenv("LUOSHENG_LOCAL_DEMO_DATED"));
        if (dated) prepareDatedLocalDemo();
        else prepareBrowserEvidence(true);
        var builder = new ProcessBuilder("node", "scripts/luosheng-local-demo.mjs")
                .directory(Path.of("..", "frontend").toFile()).redirectErrorStream(true);
        configureBrowser(builder, true);
        builder.environment().put("LUOSHENG_LOCAL_DEMO_DATED", dated ? "1" : "0");
        builder.environment().remove("LUOSHENG_TEST_APPROVAL_FILE");
        builder.environment().remove("LUOSHENG_TEST_PAUSE_FILE");
        if (dated && "1".equals(System.getenv("LUOSHENG_LOCAL_DEMO_SMOKE"))) {
            builder.environment().put("LUOSHENG_TEST_APPROVAL_FILE", files.resolve("approved.sha256").toAbsolutePath().toString());
            builder.environment().put("LUOSHENG_TEST_PAUSE_FILE", files.resolve("paused").toAbsolutePath().toString());
        }
        var process = builder.start();
        try (var output = process.inputReader(StandardCharsets.UTF_8)) {
            var forwarding = CompletableFuture.runAsync(() -> output.lines().forEach(System.out::println));
            org.junit.jupiter.api.Assertions.assertTrue(process.waitFor(930, TimeUnit.SECONDS),
                    "Local guide demo did not stop on time");
            forwarding.get(5, TimeUnit.SECONDS);
            assertEquals(0, process.exitValue());
        } finally {
            if (process.isAlive()) process.destroyForcibly();
        }
    }

    private static byte[] datedCandidateBytes() throws Exception {
        var bytes = Files.readAllBytes(DATED_CANDIDATE);
        assertEquals(DATED_DIGEST, HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)));
        return bytes;
    }

    private void prepareDatedLocalDemo() throws Exception {
        var verifier = new ProcessBuilder("node", EVAL.resolve("ding-eight-candidate.mjs").toString(),
                DATED_CANDIDATE.toString(), "--signoffs",
                EVAL.resolve("ding-zh-CN-0.5.0-signoff-draft.2026-11-22.json").toString())
                .inheritIO().start();
        try {
            org.junit.jupiter.api.Assertions.assertTrue(verifier.waitFor(15, TimeUnit.SECONDS), "Signoff preflight timed out");
            assertEquals(0, verifier.exitValue(), "The dated local demo requires matching signoff records");
        } finally {
            if (verifier.isAlive()) verifier.destroyForcibly();
        }
        Files.write(files.resolve("evidence.json"), datedCandidateBytes());
        Files.writeString(files.resolve("minimum-version"), "4");
        Files.writeString(files.resolve("approved.sha256"), DATED_DIGEST);
        // The test context pins the model endpoint to loopback port 1; no provider credentials are used.
    }

    @Test
    @EnabledIfEnvironmentVariable(named = "LUOSHENG_RUN_BROWSER", matches = "1")
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void visitorUsesCandidateFromHomeAndReturnsToApprovedPlate() throws Exception {
        seedDemoSlots(2);
        runBrowser(true);
    }

    private void seedDemoSlots(int daysAhead) {
        // The browser's HTTP requests run on another connection to this test-only H2 database.
        long owner = jdbc.queryForObject("select id from users where username='guide_preset_test'", Long.class);
        var date = LocalDate.now(ZoneId.of("Asia/Shanghai")).plusDays(daysAhead);
        String insert = "insert into appointment_slots(visit_date,start_time,end_time,capacity,created_by,updated_by)"
                + " values(?,?,?,?,?,?)";
        jdbc.update(insert, date, LocalTime.of(9, 0), LocalTime.of(9, 30), 1, owner, owner);
        jdbc.update(insert, date, LocalTime.of(9, 30), LocalTime.of(10, 0), 6, owner, owner);
    }

    private void prepareBrowserEvidence(boolean candidate) throws Exception {
        Path pack = files.resolve("evidence.json");
        String contents = candidate ? candidatePack() : reviewedPack();
        Files.writeString(pack, contents);
        Files.writeString(files.resolve("minimum-version"), "2");
        approveTestPack(pack);
    }

    private void configureBrowser(ProcessBuilder builder, boolean candidate) {
        builder.environment().put("MUSEUM_DEV_API_URL", "http://127.0.0.1:" + port);
        builder.environment().put("VITE_GUIDE_PRESET_ENABLED", "true");
        builder.environment().put("VITE_GUIDE_SITE_ENABLED", Boolean.toString(candidate));
        builder.environment().put("VITE_GUIDE_TURNS_ENABLED", Boolean.toString(candidate));
    }

    private void runBrowser(boolean candidate) throws Exception {
        prepareBrowserEvidence(candidate);
        var builder = new ProcessBuilder("node", "scripts/luosheng-preset-check.mjs")
                .directory(Path.of("..", "frontend").toFile()).redirectErrorStream(true);
        configureBrowser(builder, candidate);
        builder.environment().put("LUOSHENG_CHECK_PUBLIC_TURNS", Boolean.toString(candidate));
        builder.environment().put("LUOSHENG_CHECK_SEEDED_SLOTS", candidate ? "1" : "0");
        if (candidate) builder.environment().put("LUOSHENG_EXPECT_SLOT_FIXTURE_PAIR", "1");
        boolean builtCandidate = candidate && System.getenv("LUOSHENG_CANDIDATE_DIST") != null;
        boolean swappedThemes = builtCandidate && "1".equals(System.getenv("LUOSHENG_CHECK_SWAPPED_THEMES"));
        boolean nativeZoom = builtCandidate && "1".equals(System.getenv("LUOSHENG_CHECK_NATIVE_ZOOM"));
        int expectedLayouts = 2 + (swappedThemes ? 2 : 0) + (nativeZoom ? 2 : 0);
        long timeoutSeconds = 65L + 25L * (expectedLayouts - 2);
        var process = builder.start();
        try (var output = process.inputReader(StandardCharsets.UTF_8)) {
            var log = CompletableFuture.supplyAsync(() -> String.join("\n", output.lines().toList()));
            org.junit.jupiter.api.Assertions.assertTrue(process.waitFor(timeoutSeconds, TimeUnit.SECONDS),
                    "Preset browser test did not complete " + expectedLayouts + " layouts in " + timeoutSeconds + " seconds");
            var outputText = log.get(5, TimeUnit.SECONDS);
            assertEquals(0, process.exitValue(), outputText);
            if (candidate) {
                var timings = outputText.lines().filter(line -> line.startsWith("Candidate guide UI timing ")).toList();
                assertEquals(expectedLayouts, timings.size(), outputText);
                for (String line : timings) {
                    var samples = mapper.readTree(line.substring("Candidate guide UI timing ".length())).path("samples");
                    long seeded = java.util.stream.StreamSupport.stream(samples.spliterator(), false)
                            .filter(sample -> sample.path("category").asText().equals("slots-seeded-api")
                                    && sample.path("durationMs").isIntegralNumber()
                                    && sample.path("durationMs").asLong() >= 0).count();
                    assertEquals(2, seeded, line);
                }
                timings.forEach(System.out::println);
            }
            if (nativeZoom) {
                for (var theme : List.of("light", "dark")) {
                    var marker = "Candidate guide passed native Chrome 200% " + theme;
                    org.junit.jupiter.api.Assertions.assertTrue(outputText.contains(marker), outputText);
                    System.out.println(marker);
                }
            }
        } finally {
            if (process.isAlive()) process.destroyForcibly();
        }
    }

    private static void approveTestPack(Path pack) throws Exception {
        String digest = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(pack)));
        Files.writeString(files.resolve("approved.sha256"), digest);
    }

    private static String candidatePack() {
        String observations = reviewedPack().replace("\"VISIBLE\"", "\"LS-DING-EARS\"")
                .replace("\"revision\":3", "\"revision\":1")
                .replace("\"PRIVATE\"", "\"LS-DING-FEET\"")
                .replace("\"status\":\"DRAFT\"", "\"status\":\"PUBLISHED\",\"publishedAt\":\"2020-01-01T00:00:00Z\"")
                .replace("Draft note", "Approved foot observation");
        return observations.substring(0, observations.lastIndexOf("]}")) + """
                    ,{"id":"LS-DING-PERIOD","revision":1,"exhibitSlug":"heluo-bronze-ding-3d",
                      "artifactSlug":"heluo-bronze-ding","locale":"zh-CN","status":"PUBLISHED","text":"Synthetic period for the reference object",
                      "publishedAt":"2020-01-01T00:00:00Z","aliases":["什么年代"],"publicSource":"https://museum.example.test/period"},
                     {"id":"LS-DING-SOURCE","revision":2,"exhibitSlug":"heluo-bronze-ding-3d",
                      "artifactSlug":"heluo-bronze-ding","locale":"zh-CN","status":"PUBLISHED","text":"Synthetic reference identity",
                      "publishedAt":"2020-01-01T00:00:00Z","aliases":["参考馆藏"],"publicSource":"https://museum.example.test/source"},
                     {"id":"LS-DING-SIZE","revision":1,"exhibitSlug":"heluo-bronze-ding-3d",
                      "artifactSlug":"heluo-bronze-ding","locale":"zh-CN","status":"PUBLISHED","text":"Synthetic overall size",
                      "publishedAt":"2020-01-01T00:00:00Z","aliases":["整体尺寸"],"publicSource":"https://museum.example.test/size"}
                    ]}
                    """;
    }

    private static String reviewedPack() {
        return """
                {"formatVersion":1,"releaseVersion":2,"cards":[
                  {"id":"VISIBLE","revision":3,"exhibitSlug":"heluo-bronze-ding-3d",
                   "artifactSlug":"heluo-bronze-ding","locale":"zh-CN","status":"PUBLISHED",
                   "publishedAt":"2020-01-01T00:00:00Z","text":"Approved observation",
                   "aliases":["鼎耳"],"publicSource":"https://museum.example.test/record"},
                  {"id":"PRIVATE","revision":1,"exhibitSlug":"heluo-bronze-ding-3d",
                   "artifactSlug":"heluo-bronze-ding","locale":"zh-CN","status":"DRAFT",
                   "text":"Draft note","aliases":["三足"]}
                ]}
                """;
    }
}
