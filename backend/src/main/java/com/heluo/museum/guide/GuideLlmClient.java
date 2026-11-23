package com.heluo.museum.guide;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.heluo.museum.guide.GuideToolExecutor.ToolAuditContext;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.function.Consumer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Zero-dependency OpenAI Chat Completions compatible client built on JDK 17 HttpClient.
 * Supports true SSE streaming + up to 2 read-only tool-calling rounds.
 */
@Component
public class GuideLlmClient {
    private static final Logger LOG = LoggerFactory.getLogger(GuideLlmClient.class);
    static final int MAX_TOOL_ROUNDS = 2;

    private final GuideProperties properties;
    private final GuideToolExecutor toolExecutor;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public GuideLlmClient(GuideProperties properties, GuideToolExecutor toolExecutor, ObjectMapper objectMapper) {
        this.properties = properties;
        this.toolExecutor = toolExecutor;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
    }

    public boolean isConfigured() {
        if (!properties.isModelEnabled()) {
            return false;
        }
        String endpoint = properties.getModelEndpoint();
        String model = properties.getModelName();
        String key = properties.effectiveModelKey();
        return !endpoint.isBlank() && !model.isBlank() && !key.isBlank() && isAllowedEndpoint(endpoint);
    }

    public StreamOutcome complete(
            List<Map<String, Object>> initialMessages,
            ToolAuditContext audit,
            Consumer<String> onStatus,
            Consumer<String> onBodyDelta) throws IOException, InterruptedException {

        URI uri = URI.create(properties.getModelEndpoint());
        if (!isAllowedEndpoint(properties.getModelEndpoint())) {
            throw new IllegalStateException("Disallowed model endpoint scheme: " + uri.getScheme());
        }

        List<Map<String, Object>> conversation = new ArrayList<>(initialMessages);
        List<Map<String, Object>> tools = toolExecutor.toolDefinitions();
        Duration timeout = Duration.ofSeconds(Math.max(3, properties.getRequestTimeoutSeconds()));

        for (int round = 0; round <= MAX_TOOL_ROUNDS; round++) {
            boolean allowTools = round < MAX_TOOL_ROUNDS;
            GuideStreamParser parser = new GuideStreamParser();
            boolean[] emittedDelta = {false};

            RoundResult result = executeStreamingRound(uri, conversation, allowTools ? tools : List.of(), timeout, chunk -> {
                parser.feed(chunk, delta -> {
                    emittedDelta[0] = true;
                    if (onBodyDelta != null) {
                        onBodyDelta.accept(delta);
                    }
                });
            });

            if (result.toolCalls() != null && !result.toolCalls().isEmpty() && allowTools) {
                // Append assistant tool_calls message
                Map<String, Object> assistantMsg = new LinkedHashMap<>();
                assistantMsg.put("role", "assistant");
                assistantMsg.put("content", result.rawContent().isEmpty() ? null : result.rawContent());
                List<Map<String, Object>> tcPayload = new ArrayList<>();
                for (AccumulatedToolCall tc : result.toolCalls()) {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("id", tc.id());
                    item.put("type", "function");
                    item.put("function", Map.of("name", tc.name(), "arguments", tc.arguments()));
                    tcPayload.add(item);
                }
                assistantMsg.put("tool_calls", tcPayload);
                conversation.add(assistantMsg);

                // Execute each read-only tool and append tool result messages
                for (AccumulatedToolCall tc : result.toolCalls()) {
                    audit.recordToolCall(tc.name());
                    if (onStatus != null) {
                        onStatus.accept(statusPhaseForTool(tc.name()));
                    }
                    String toolOutput = toolExecutor.execute(tc.name(), tc.arguments(), audit);
                    Map<String, Object> toolMsg = new LinkedHashMap<>();
                    toolMsg.put("role", "tool");
                    toolMsg.put("tool_call_id", tc.id());
                    toolMsg.put("content", toolOutput);
                    conversation.add(toolMsg);
                }
                continue;
            }

            GuideStreamParser.ParseResult parsed = parser.finish(delta -> {
                emittedDelta[0] = true;
                if (onBodyDelta != null) {
                    onBodyDelta.accept(delta);
                }
            });
            return new StreamOutcome(parsed.body(), parsed.rawMeta(), parsed.delimiterFound(), emittedDelta[0]);
        }

        throw new IOException("Exceeded maximum tool rounds without final response");
    }

    private RoundResult executeStreamingRound(
            URI uri,
            List<Map<String, Object>> messages,
            List<Map<String, Object>> tools,
            Duration timeout,
            Consumer<String> onContentChunk) throws IOException, InterruptedException {

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("model", properties.getModelName());
        payload.put("messages", messages);
        payload.put("stream", true);
        payload.put("temperature", 0.35);
        payload.put("max_tokens", 900);
        if (!tools.isEmpty()) {
            payload.put("tools", tools);
            payload.put("tool_choice", "auto");
        }

        String jsonBody = objectMapper.writeValueAsString(payload);
        HttpRequest request = HttpRequest.newBuilder(uri)
                .timeout(timeout)
                .header("Content-Type", "application/json")
                .header("Accept", "text/event-stream")
                .header("Authorization", "Bearer " + properties.effectiveModelKey())
                .POST(HttpRequest.BodyPublishers.ofString(jsonBody, StandardCharsets.UTF_8))
                .build();

        HttpResponse<InputStream> response = httpClient.send(request, HttpResponse.BodyHandlers.ofInputStream());
        int status = response.statusCode();
        if (status < 200 || status >= 300) {
            try (InputStream body = response.body()) {
                byte[] errBytes = body.readNBytes(1024);
                LOG.warn("Guide LLM upstream HTTP status={} body={}", status, new String(errBytes, StandardCharsets.UTF_8));
            }
            throw new IOException("LLM upstream returned HTTP " + status);
        }

        String contentType = response.headers().firstValue("Content-Type").orElse("").toLowerCase();
        if (contentType.contains("application/json")) {
            // Support non-streaming JSON response seamlessly (e.g., proxy or mock returning JSON)
            try (InputStream in = response.body()) {
                return parseNonStreamingJson(in, onContentChunk);
            }
        }

        StringBuilder rawContent = new StringBuilder();
        Map<Integer, ToolCallBuilder> toolCallBuilders = new TreeMap<>();

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(response.body(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (!line.startsWith("data:")) {
                    continue;
                }
                String data = line.substring(5).trim();
                if (data.isEmpty() || "[DONE]".equals(data)) {
                    if ("[DONE]".equals(data)) {
                        break;
                    }
                    continue;
                }
                JsonNode chunk = objectMapper.readTree(data);
                JsonNode choices = chunk.path("choices");
                if (!choices.isArray() || choices.isEmpty()) {
                    continue;
                }
                JsonNode delta = choices.get(0).path("delta");
                if (delta.has("content") && delta.get("content").isTextual()) {
                    String piece = delta.get("content").asText();
                    if (!piece.isEmpty()) {
                        rawContent.append(piece);
                        onContentChunk.accept(piece);
                    }
                }
                if (delta.has("tool_calls") && delta.get("tool_calls").isArray()) {
                    for (JsonNode tcDelta : delta.get("tool_calls")) {
                        int idx = tcDelta.path("index").asInt(0);
                        ToolCallBuilder builder = toolCallBuilders.computeIfAbsent(idx, k -> new ToolCallBuilder());
                        if (tcDelta.has("id") && tcDelta.get("id").isTextual()) {
                            builder.id = tcDelta.get("id").asText();
                        }
                        JsonNode fn = tcDelta.path("function");
                        if (fn.has("name") && fn.get("name").isTextual()) {
                            builder.name.append(fn.get("name").asText());
                        }
                        if (fn.has("arguments") && fn.get("arguments").isTextual()) {
                            builder.arguments.append(fn.get("arguments").asText());
                        }
                    }
                }
            }
        }

        List<AccumulatedToolCall> toolCalls = toolCallBuilders.values().stream()
                .map(ToolCallBuilder::build)
                .filter(tc -> !tc.name().isBlank())
                .toList();
        return new RoundResult(rawContent.toString(), toolCalls);
    }

    private RoundResult parseNonStreamingJson(InputStream in, Consumer<String> onContentChunk) throws IOException {
        JsonNode root = objectMapper.readTree(in);
        JsonNode message = root.path("choices").path(0).path("message");
        String content = message.has("content") && message.get("content").isTextual()
                ? message.get("content").asText() : "";
        List<AccumulatedToolCall> calls = new ArrayList<>();
        if (message.has("tool_calls") && message.get("tool_calls").isArray()) {
            int i = 0;
            for (JsonNode tc : message.get("tool_calls")) {
                String id = tc.path("id").asText("call_" + (i++));
                String name = tc.path("function").path("name").asText("");
                String args = tc.path("function").path("arguments").asText("{}");
                if (!name.isBlank()) {
                    calls.add(new AccumulatedToolCall(id, name, args));
                }
            }
        }
        if (calls.isEmpty() && !content.isEmpty()) {
            onContentChunk.accept(content);
        }
        return new RoundResult(content, calls);
    }

    private static String statusPhaseForTool(String toolName) {
        return switch (toolName) {
            case "query_appointment_slots" -> "searching_slots";
            case "get_museum_item_detail", "search_museum_catalog" -> "reading_archive";
            default -> "thinking";
        };
    }

    static boolean isAllowedEndpoint(String endpoint) {
        try {
            URI uri = URI.create(endpoint);
            if ("https".equalsIgnoreCase(uri.getScheme())) {
                return uri.getHost() != null && !uri.getHost().isBlank();
            }
            if ("http".equalsIgnoreCase(uri.getScheme())) {
                String host = uri.getHost();
                return "127.0.0.1".equals(host) || "localhost".equalsIgnoreCase(host) || "::1".equals(host) || "[::1]".equals(host);
            }
            return false;
        } catch (IllegalArgumentException ex) {
            return false;
        }
    }

    private static final class ToolCallBuilder {
        String id = "";
        final StringBuilder name = new StringBuilder();
        final StringBuilder arguments = new StringBuilder();

        AccumulatedToolCall build() {
            String effectiveId = id.isBlank() ? "call_" + Math.abs(name.toString().hashCode()) : id;
            return new AccumulatedToolCall(effectiveId, name.toString().trim(), arguments.toString());
        }
    }

    private record AccumulatedToolCall(String id, String name, String arguments) {}
    private record RoundResult(String rawContent, List<AccumulatedToolCall> toolCalls) {}

    public record StreamOutcome(String body, String rawMeta, boolean delimiterFound, boolean emittedDelta) {}
}
