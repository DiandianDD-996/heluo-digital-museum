package com.heluo.museum.analytics;

import com.heluo.museum.common.api.ApiResponse;
import com.heluo.museum.common.web.TrustedClientIpResolver;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.Map;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Public lightweight page-view tracking endpoint for visitor traffic analytics. */
@RestController
@RequestMapping("/api/v1/analytics")
public class SiteAnalyticsController {
    private final SiteAnalyticsService analyticsService;
    private final TrustedClientIpResolver ipResolver;

    public SiteAnalyticsController(SiteAnalyticsService analyticsService, TrustedClientIpResolver ipResolver) {
        this.analyticsService = analyticsService;
        this.ipResolver = ipResolver;
    }

    @PostMapping("/page-view")
    public ApiResponse<Map<String, Boolean>> recordPageView(
            @Valid @RequestBody PageViewRequest body,
            HttpServletRequest request) {
        String ip = ipResolver.resolve(request);
        boolean recorded = analyticsService.recordPageView(
                body.routeType(),
                body.targetSlug(),
                body.targetTitle(),
                body.visitorId(),
                ip);
        return ApiResponse.ok(Map.of("recorded", recorded), "analytics-page-view");
    }

    public record PageViewRequest(
            @NotBlank @Size(max = 32) String routeType,
            @Size(max = 180) String targetSlug,
            @Size(max = 200) String targetTitle,
            @Size(max = 120) String visitorId) {}
}
