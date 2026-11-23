package com.heluo.museum.guide;

import java.util.List;
import java.util.Map;

/**
 * Shared v2 request/response DTOs for Luosheng AI Guide.
 */
public final class GuideModels {
    private GuideModels() {}

    public record ChatRequest(
            String conversationId,
            String requestId,
            String message,
            String locale,
            PageContext context,
            List<HistoryTurn> history) {}

    public record PageContext(
            String route,
            String artifactSlug,
            String exhibitSlug,
            String articleSlug,
            ViewerState viewerState) {}

    public record ViewerState(
            boolean active,
            String mode,
            String view) {}

    public record HistoryTurn(
            String role,
            String content) {}

    public record ChatResponse(
            String requestId,
            String text,
            List<Citation> citations,
            List<Action> actions,
            List<String> followUps,
            String boundaryNote,
            String mode,
            boolean degraded) {}

    public record Citation(
            String id,
            String title,
            String revision,
            String internalPath,
            String publicSourceUrl,
            String boundaryNote) {}

    public record Action(
            String type,
            String label,
            String exhibitSlug,
            String part,
            String view,
            String mode,
            String path,
            Map<String, String> query,
            String stop,
            Boolean compare,
            String url) {

        public static Action viewerFocus(String exhibitSlug, String part, String view, String mode, String label) {
            return new Action("viewer_focus", label, exhibitSlug, part, view, mode, null, null, null, null, null);
        }

        public static Action viewerMode(String exhibitSlug, String mode, String label) {
            return new Action("viewer_mode", label, exhibitSlug, null, null, mode, null, null, null, null, null);
        }

        public static Action navigate(String path, Map<String, String> query, String label) {
            return new Action("navigate", label, null, null, null, null, path, query, null, null, null);
        }

        public static Action openPlate(String stop, Boolean compare, String label) {
            return new Action("open_plate", label, null, null, null, null, null, null, stop, compare, null);
        }

        public static Action openSource(String url, String label) {
            return new Action("open_source", label, null, null, null, null, null, null, null, null, url);
        }
    }
}
