package com.heluo.museum.guide;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:guide-v2-e2e;MODE=MySQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "museum.guide.enabled=true",
        "museum.guide.model-enabled=true",
        "museum.guide.model-name=mock-deepseek-chat",
        "museum.guide.model-key=test-key-only",
        "museum.guide.daily-turn-limit=200",
        "museum.guide.max-concurrent-generations=4",
        "museum.guide.rate-limit-per-minute=60",
        "museum.guide.request-timeout-seconds=5",
        "museum.bootstrap.enabled=true",
        "museum.bootstrap.admin-username=guide_v2_admin",
        "museum.bootstrap.admin-password=GuideV2TestPassword123",
        "museum.bootstrap.admin-email=guide-v2@example.test"
})
@AutoConfigureMockMvc
@ActiveProfiles("test")
class GuideV2IntegrationTests {

    private static HttpServer mockLlmServer;
    private static int mockPort;
    private static final AtomicReference<MockHandler> CURRENT_HANDLER = new AtomicReference<>();

    @TempDir
    static Path tempDir;

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired GuideProperties properties;
    @Autowired GuideKnowledgeService knowledge;

    @FunctionalInterface
    interface MockHandler {
        void handle(JsonNode requestBody, HttpExchange exchange) throws IOException;
    }

    @BeforeAll
    static void startMockOpenAiServer() throws IOException {
        mockLlmServer = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        mockPort = mockLlmServer.getAddress().getPort();
        mockLlmServer.createContext("/chat/completions", exchange -> {
            byte[] bodyBytes = exchange.getRequestBody().readAllBytes();
            JsonNode req = new ObjectMapper().readTree(bodyBytes);
            MockHandler handler = CURRENT_HANDLER.get();
            if (handler == null) {
                exchange.sendResponseHeaders(500, -1);
                exchange.close();
                return;
            }
            handler.handle(req, exchange);
        });
        mockLlmServer.start();
    }

    @AfterAll
    static void stopMockOpenAiServer() {
        if (mockLlmServer != null) {
            mockLlmServer.stop(0);
        }
    }

    @DynamicPropertySource
    static void dynamicProps(DynamicPropertyRegistry registry) {
        Path repoContent = Path.of("..", "content", "luosheng").toAbsolutePath().normalize();
        registry.add("museum.guide.model-endpoint", () -> "http://127.0.0.1:" + mockPort + "/chat/completions");
        registry.add("museum.guide.pack-path", () -> repoContent.resolve("ding.zh-CN.json").toString());
        registry.add("museum.guide.minimum-version-path", () -> repoContent.resolve("minimum-release-version.txt").toString());
        registry.add("museum.guide.approved-digest-path", () -> repoContent.resolve("ding.zh-CN.sha256").toString());
        registry.add("museum.guide.pause-path", () -> tempDir.resolve("guide-paused").toString());
    }

    @BeforeEach
    void resetState() throws IOException {
        properties.setModelEnabled(true);
        Files.deleteIfExists(tempDir.resolve("guide-paused"));
        knowledge.invalidateCache();
    }

    @Test
    void sseStreamsDeltasParsesMetaAndNeverLeaksDelimiter() throws Exception {
        CURRENT_HANDLER.set((req, exchange) -> {
            List<String> chunks = List.of(
                    "侧面看只", "有两条腿，", "是因为第三只足被鼎身挡住了。\n",
                    "<<<LUO", "SHENG_META>>>\n",
                    "{\"citations\":[\"LS-DING-FEET\",\"FAKE-CARD-999\"],",
                    "\"actions\":[",
                    "{\"type\":\"viewer_focus\",\"exhibitSlug\":\"heluo-bronze-ding-3d\",\"part\":\"feet\",\"view\":\"back\",\"mode\":\"solid\",\"label\":\"切到背面看三足\"},",
                    "{\"type\":\"navigate\",\"path\":\"/artifacts/non-existent-slug\",\"label\":\"非法空气按钮\"},",
                    "{\"type\":\"open_source\",\"url\":\"https://evil.example.com\",\"label\":\"非法外链\"}",
                    "],\"followUps\":[\"顶上立耳能提吗？\"],\"boundaryNote\":\"固定视角遮挡不代表缺损。\"}");
            sendSseChunks(exchange, chunks);
        });

        String payload = mapper.writeValueAsString(Map.of(
                "conversationId", UUID.randomUUID().toString(),
                "requestId", UUID.randomUUID().toString(),
                "message", "侧面数来数去只有两条腿，是断了一条吗？",
                "locale", "zh-CN",
                "context", Map.of(
                        "route", "exhibit-detail",
                        "artifactSlug", "heluo-bronze-ding",
                        "exhibitSlug", "heluo-bronze-ding-3d",
                        "viewerState", Map.of("active", true, "mode", "solid", "view", "left"))));

        MvcResult asyncResult = mvc.perform(post("/api/v1/guide/chat/stream")
                        .header("Sec-Fetch-Site", "same-origin")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(request().asyncStarted())
                .andReturn();

        MvcResult completed = mvc.perform(asyncDispatch(asyncResult))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Accel-Buffering", "no"))
                .andExpect(header().string("Cache-Control", "no-store"))
                .andReturn();

        String sseBody = completed.getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(sseBody).contains("event:delta");
        assertThat(sseBody).contains("event:done");
        assertThat(sseBody).doesNotContain("<<<LUOSHENG_META>>>");
        // Verify hallucinated citation, fake route, and fake external URL were stripped
        assertThat(sseBody).contains("LS-DING-FEET");
        assertThat(sseBody).doesNotContain("FAKE-CARD-999");
        assertThat(sseBody).doesNotContain("非法空气按钮");
        assertThat(sseBody).doesNotContain("evil.example.com");
        assertThat(sseBody).contains("切到背面看三足");
        assertThat(sseBody).contains("\"mode\":\"ai\"");
    }

    @Test
    void toolCallingLoopExecutesCrossItemDetailAndRealTimeAppointmentSlots() throws Exception {
        // Seed a guaranteed open slot for tomorrow
        long adminId = jdbc.queryForObject("select id from users where username='guide_v2_admin'", Long.class);
        LocalDate tomorrow = LocalDate.now(ZoneId.of("Asia/Shanghai")).plusDays(1);
        jdbc.update("insert into appointment_slots(visit_date,start_time,end_time,capacity,reserved_people,status,created_by,updated_by) values(?,?,?,?,0,'OPEN',?,?)",
                tomorrow, LocalTime.of(14, 0), LocalTime.of(16, 0), 25, adminId, adminId);

        AtomicInteger round = new AtomicInteger(0);
        CURRENT_HANDLER.set((req, exchange) -> {
            int r = round.getAndIncrement();
            if (r == 0) {
                // Round 0: LLM asks to invoke query_appointment_slots + get_museum_item_detail
                sendSseToolCalls(exchange, List.of(
                        Map.of("index", 0, "id", "call_slots_1", "type", "function",
                                "function", Map.of("name", "query_appointment_slots", "arguments", "{\"date\":\"" + tomorrow + "\",\"people\":3}")),
                        Map.of("index", 1, "id", "call_item_2", "type", "function",
                                "function", Map.of("name", "get_museum_item_detail", "arguments", "{\"type\":\"artifact\",\"slug\":\"river-map-jade-bi\"}"))));
            } else {
                // Verify tool responses were fed back to LLM
                String serialized = req.toString();
                assertThat(serialized).contains("APPOINTMENT:PUBLIC_SLOTS");
                assertThat(serialized).contains("river-map-jade-bi");
                sendSseChunks(exchange, List.of(
                        "明天下午有可约时段，另外河图玉璧是项目原创概念展品。\n<<<LUOSHENG_META>>>\n",
                        "{\"citations\":[\"APPOINTMENT:PUBLIC_SLOTS\",\"ARTIFACT:river-map-jade-bi\"],",
                        "\"actions\":[{\"type\":\"navigate\",\"path\":\"/appointment\",\"query\":{\"date\":\"" + tomorrow + "\"},\"label\":\"前往预约明日时段\"}],",
                        "\"followUps\":[\"河图玉璧有什么看点？\"]}"));
            }
        });

        String payload = mapper.writeValueAsString(Map.of(
                "conversationId", UUID.randomUUID().toString(),
                "requestId", UUID.randomUUID().toString(),
                "message", "明天 3 个人能预约吗？顺便说说河图玉璧。",
                "locale", "zh-CN",
                "context", Map.of("route", "home")));

        MvcResult asyncResult = mvc.perform(post("/api/v1/guide/chat/stream")
                        .header("Sec-Fetch-Site", "same-origin")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(request().asyncStarted())
                .andReturn();

        MvcResult completed = mvc.perform(asyncDispatch(asyncResult))
                .andExpect(status().isOk())
                .andReturn();

        String sseBody = completed.getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(round.get()).isEqualTo(2);
        assertThat(sseBody).contains("event:status");
        assertThat(sseBody).contains("searching_slots");
        assertThat(sseBody).contains("reading_archive");
        assertThat(sseBody).contains("APPOINTMENT:PUBLIC_SLOTS");
        assertThat(sseBody).contains("ARTIFACT:river-map-jade-bi");
        assertThat(sseBody).contains("前往预约明日时段");
    }

    @Test
    void redlineViolationTriggersAtomicReplaceAndDeterministicDegradation() throws Exception {
        CURRENT_HANDLER.set((req, exchange) -> sendSseChunks(exchange, List.of(
                "这件青铜鼎出土于洛阳二里头遗址，", "市场估价高达 800 万元。\n",
                "<<<LUOSHENG_META>>>\n{\"citations\":[\"LS-DING-SOURCE\"]}")));

        String payload = mapper.writeValueAsString(Map.of(
                "conversationId", UUID.randomUUID().toString(),
                "requestId", UUID.randomUUID().toString(),
                "message", "它是在哪里出土的？值多少钱？",
                "locale", "zh-CN",
                "context", Map.of("route", "artifact-detail", "artifactSlug", "heluo-bronze-ding")));

        MvcResult asyncResult = mvc.perform(post("/api/v1/guide/chat/stream")
                        .header("Sec-Fetch-Site", "same-origin")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(request().asyncStarted())
                .andReturn();

        MvcResult completed = mvc.perform(asyncDispatch(asyncResult))
                .andExpect(status().isOk())
                .andReturn();

        String sseBody = completed.getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(sseBody).contains("event:replace");
        assertThat(sseBody).contains("\"mode\":\"deterministic\"");
        assertThat(sseBody).contains("\"degraded\":true");
        assertThat(sseBody).contains("克利夫兰艺术博物馆");
    }

    @Test
    void upstreamErrorModelDisabledAndPauseFileAllDegradeCleanlyViaJsonEndpoint() throws Exception {
        // 1. Upstream HTTP 500 -> degraded deterministic readable response
        CURRENT_HANDLER.set((req, exchange) -> {
            exchange.sendResponseHeaders(500, -1);
            exchange.close();
        });

        mvc.perform(post("/api/v1/guide/chat")
                        .header("Sec-Fetch-Site", "same-origin")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "requestId", UUID.randomUUID().toString(),
                                "message", "侧面看为什么只有两条腿？",
                                "locale", "zh-CN",
                                "context", Map.of("route", "exhibit-detail", "exhibitSlug", "heluo-bronze-ding-3d")))))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.data.mode").value("deterministic"))
                .andExpect(jsonPath("$.data.degraded").value(true))
                .andExpect(jsonPath("$.data.text").isNotEmpty())
                .andExpect(jsonPath("$.data.actions[0].type").value("viewer_focus"));

        // 2. modelEnabled = false -> intentional deterministic mode (degraded = false) + bilingual en-US
        properties.setModelEnabled(false);
        mvc.perform(post("/api/v1/guide/chat")
                        .header("Sec-Fetch-Site", "same-origin")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "requestId", UUID.randomUUID().toString(),
                                "message", "What is in the museum shop?",
                                "locale", "en-US",
                                "context", Map.of("route", "shop")))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.mode").value("deterministic"))
                .andExpect(jsonPath("$.data.degraded").value(false))
                .andExpect(jsonPath("$.data.actions[0].path").value("/shop"));

        // 3. Operational pause file -> honest paused message
        Files.writeString(tempDir.resolve("guide-paused"), "maintenance");
        mvc.perform(post("/api/v1/guide/chat")
                        .header("Sec-Fetch-Site", "same-origin")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "requestId", UUID.randomUUID().toString(),
                                "message", "你好",
                                "locale", "zh-CN"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.mode").value("deterministic"))
                .andExpect(jsonPath("$.data.degraded").value(true))
                .andExpect(jsonPath("$.data.text").value(org.hamcrest.Matchers.containsString("运维暂停")));
    }

    @Test
    void securityOriginValidationIdempotencyAndExhibitPresetWork() throws Exception {
        // Cross-site rejected with 403
        mvc.perform(post("/api/v1/guide/chat")
                        .header("Sec-Fetch-Site", "cross-site")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"message\":\"hello\",\"locale\":\"zh-CN\"}"))
                .andExpect(status().isForbidden());

        // Blank message rejected
        mvc.perform(post("/api/v1/guide/chat")
                        .header("Sec-Fetch-Site", "same-origin")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"message\":\"   \",\"locale\":\"zh-CN\"}"))
                .andExpect(status().isUnprocessableEntity());

        // Idempotent requestId returns identical response without calling LLM twice
        AtomicInteger llmCalls = new AtomicInteger(0);
        CURRENT_HANDLER.set((req, exchange) -> {
            llmCalls.incrementAndGet();
            sendSseChunks(exchange, List.of("河洛青铜鼎是一件数字重制展品。\n<<<LUOSHENG_META>>>\n{\"citations\":[\"LS-DING-SOURCE\"]}"));
        });
        String fixedReqId = UUID.randomUUID().toString();
        String body = mapper.writeValueAsString(Map.of(
                "requestId", fixedReqId,
                "message", "介绍一下河洛青铜鼎",
                "locale", "zh-CN",
                "context", Map.of("route", "artifact-detail", "artifactSlug", "heluo-bronze-ding")));

        mvc.perform(post("/api/v1/guide/chat").header("Sec-Fetch-Site", "same-origin")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.requestId").value(fixedReqId));

        mvc.perform(post("/api/v1/guide/chat").header("Sec-Fetch-Site", "same-origin")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.requestId").value(fixedReqId));
        assertThat(llmCalls.get()).isEqualTo(1);

        // Read-only exhibit preset endpoint serves verified Tier-1 cards
        mvc.perform(get("/api/v1/guide/exhibits/heluo-bronze-ding-3d"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.data.available").value(true))
                .andExpect(jsonPath("$.data.entries.length()").value(8));
    }

    private void sendSseChunks(HttpExchange exchange, List<String> chunks) throws IOException {
        exchange.getResponseHeaders().set("Content-Type", "text/event-stream; charset=utf-8");
        exchange.sendResponseHeaders(200, 0);
        try (OutputStream out = exchange.getResponseBody()) {
            for (String chunk : chunks) {
                String json = mapper.writeValueAsString(Map.of(
                        "choices", List.of(Map.of("index", 0, "delta", Map.of("content", chunk)))));
                out.write(("data: " + json + "\n\n").getBytes(StandardCharsets.UTF_8));
                out.flush();
            }
            out.write("data: [DONE]\n\n".getBytes(StandardCharsets.UTF_8));
            out.flush();
        }
    }

    private void sendSseToolCalls(HttpExchange exchange, List<Map<String, Object>> toolCalls) throws IOException {
        exchange.getResponseHeaders().set("Content-Type", "text/event-stream; charset=utf-8");
        exchange.sendResponseHeaders(200, 0);
        try (OutputStream out = exchange.getResponseBody()) {
            String json = mapper.writeValueAsString(Map.of(
                    "choices", List.of(Map.of("index", 0, "delta", Map.of("tool_calls", toolCalls)))));
            out.write(("data: " + json + "\n\n").getBytes(StandardCharsets.UTF_8));
            out.write("data: [DONE]\n\n".getBytes(StandardCharsets.UTF_8));
            out.flush();
        }
    }
}
