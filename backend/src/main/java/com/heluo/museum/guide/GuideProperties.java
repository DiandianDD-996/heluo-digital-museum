package com.heluo.museum.guide;

import java.nio.file.Path;
import java.util.Optional;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "museum.guide")
public class GuideProperties {
    private boolean enabled = false;
    private boolean modelEnabled = true;
    private String packPath = "";
    private String minimumVersionPath = "";
    private String approvedDigestPath = "";
    private String modelEndpoint = "https://api.deepseek.com/chat/completions";
    private String modelName = "deepseek-chat";
    private String modelKey = "";
    private int dailyTurnLimit = 200;
    private int maxConcurrentGenerations = 4;
    private int rateLimitPerMinute = 12;
    private int requestTimeoutSeconds = 30;
    private double temperature = 0.65;
    private int maxTokens = 1600;
    private String pausePath = "";

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public boolean isModelEnabled() {
        return modelEnabled;
    }

    public void setModelEnabled(boolean modelEnabled) {
        this.modelEnabled = modelEnabled;
    }

    public String getPackPath() {
        return packPath;
    }

    public void setPackPath(String packPath) {
        this.packPath = packPath == null ? "" : packPath.trim();
    }

    public String getMinimumVersionPath() {
        return minimumVersionPath;
    }

    public void setMinimumVersionPath(String minimumVersionPath) {
        this.minimumVersionPath = minimumVersionPath == null ? "" : minimumVersionPath.trim();
    }

    public String getApprovedDigestPath() {
        return approvedDigestPath;
    }

    public void setApprovedDigestPath(String approvedDigestPath) {
        this.approvedDigestPath = approvedDigestPath == null ? "" : approvedDigestPath.trim();
    }

    public String getModelEndpoint() {
        return modelEndpoint;
    }

    public void setModelEndpoint(String modelEndpoint) {
        this.modelEndpoint = modelEndpoint == null ? "" : modelEndpoint.trim();
    }

    public String getModelName() {
        return modelName;
    }

    public void setModelName(String modelName) {
        this.modelName = modelName == null ? "" : modelName.trim();
    }

    public String getModelKey() {
        return modelKey;
    }

    public void setModelKey(String modelKey) {
        this.modelKey = modelKey == null ? "" : modelKey.trim();
    }

    public String effectiveModelKey() {
        if (modelKey != null && !modelKey.isBlank()) {
            return modelKey.trim();
        }
        String fallback = System.getenv("DEEPSEEK_API_KEY");
        return fallback == null ? "" : fallback.trim();
    }

    public int getDailyTurnLimit() {
        return dailyTurnLimit;
    }

    public void setDailyTurnLimit(int dailyTurnLimit) {
        this.dailyTurnLimit = dailyTurnLimit;
    }

    public int getMaxConcurrentGenerations() {
        return maxConcurrentGenerations;
    }

    public void setMaxConcurrentGenerations(int maxConcurrentGenerations) {
        this.maxConcurrentGenerations = maxConcurrentGenerations;
    }

    public int getRateLimitPerMinute() {
        return rateLimitPerMinute;
    }

    public void setRateLimitPerMinute(int rateLimitPerMinute) {
        this.rateLimitPerMinute = rateLimitPerMinute;
    }

    public int getRequestTimeoutSeconds() {
        return requestTimeoutSeconds;
    }

    public void setRequestTimeoutSeconds(int requestTimeoutSeconds) {
        this.requestTimeoutSeconds = requestTimeoutSeconds;
    }

    public double getTemperature() {
        return temperature;
    }

    public void setTemperature(double temperature) {
        this.temperature = temperature;
    }

    public int getMaxTokens() {
        return maxTokens;
    }

    public void setMaxTokens(int maxTokens) {
        this.maxTokens = maxTokens;
    }

    public String getPausePath() {
        return pausePath;
    }

    public void setPausePath(String pausePath) {
        this.pausePath = pausePath == null ? "" : pausePath.trim();
    }

    public Optional<Path> pauseFile() {
        return pausePath == null || pausePath.isBlank() ? Optional.empty() : Optional.of(Path.of(pausePath));
    }

    public boolean hasEvidencePackConfig() {
        return !packPath.isBlank() && !minimumVersionPath.isBlank() && !approvedDigestPath.isBlank();
    }
}
