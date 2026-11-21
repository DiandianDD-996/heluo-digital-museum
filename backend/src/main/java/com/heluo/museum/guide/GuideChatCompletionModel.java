package com.heluo.museum.guide;

import com.fasterxml.jackson.databind.json.JsonMapper;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;

final class GuideChatCompletionModel implements GuideStructuredGenerator.Model {
    private static final JsonMapper JSON = new JsonMapper();
    private final URI endpoint;
    private final String model;
    private final String key;
    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();

    GuideChatCompletionModel(URI endpoint, String model, String key) {
        boolean https = "https".equals(endpoint.getScheme());
        boolean localTest = "http".equals(endpoint.getScheme()) && "127.0.0.1".equals(endpoint.getHost())
                && "loopback-test".equals(key);
        if ((!https && !localTest) || endpoint.getHost() == null || endpoint.getRawUserInfo() != null
                || endpoint.getRawQuery() != null || endpoint.getRawFragment() != null
                || model == null || model.isBlank() || key == null || key.isBlank()) {
            throw new IllegalArgumentException("Invalid guide model configuration");
        }
        this.endpoint = endpoint;
        this.model = model;
        this.key = key.strip();
    }

    @Override
    public String complete(GuideStructuredGenerator.Prompt prompt) throws IOException, InterruptedException {
        var messages = List.of(
                Map.of("role", "system", "content", prompt.instructions()),
                Map.of("role", "user", "content", new String(prompt.payload(), StandardCharsets.UTF_8)));
        var body = JSON.writeValueAsBytes(Map.of("model", model, "messages", messages, "stream", false,
                "max_tokens", 768, "response_format", Map.of("type", "json_object")));
        var request = HttpRequest.newBuilder(endpoint).timeout(Duration.ofSeconds(11))
                .header("Authorization", "Bearer " + key)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofByteArray(body)).build();
        var response = client.send(request, HttpResponse.BodyHandlers.ofByteArray());
        if (response.statusCode() != 200 || response.body().length > 65_536) {
            throw new IOException("Guide model unavailable");
        }
        var choice = JSON.readTree(response.body()).path("choices").path(0);
        if (!"stop".equals(choice.path("finish_reason").asText())) return null;
        return choice.path("message").path("content").textValue();
    }
}
