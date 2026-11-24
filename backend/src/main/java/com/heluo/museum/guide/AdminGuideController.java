package com.heluo.museum.guide;

import com.heluo.museum.common.api.ApiResponse;
import com.heluo.museum.common.audit.OperationLogService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.Map;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/guide")
public class AdminGuideController {
    private final GuideOrchestrator guide;
    private final GuideKnowledgeService knowledge;
    private final OperationLogService audit;

    AdminGuideController(GuideOrchestrator guide, GuideKnowledgeService knowledge, OperationLogService audit) {
        this.guide = guide;
        this.knowledge = knowledge;
        this.audit = audit;
    }

    @GetMapping("/overview")
    public ApiResponse<GuideOrchestrator.Overview> overview() {
        return ApiResponse.ok(guide.overview(), "admin-guide-overview");
    }

    @PostMapping("/cache/invalidate")
    public ApiResponse<Map<String, Boolean>> invalidate(Authentication actor) {
        audit.record((Long) actor.getPrincipal(), "GUIDE", "CACHE_INVALIDATE", "GUIDE", "catalog");
        knowledge.invalidateCatalog();
        return ApiResponse.ok(Map.of("invalidated", true), "admin-guide-cache-invalidate");
    }

    @PostMapping("/runtime-mode")
    public ApiResponse<GuideOrchestrator.Overview> mode(Authentication actor, @Valid @RequestBody ModeInput input) {
        guide.changeMode(input.mode(), () -> audit.record((Long) actor.getPrincipal(),
                "GUIDE", "RUNTIME_MODE", "GUIDE", input.mode().name()));
        return overview();
    }

    public record ModeInput(@NotNull GuideOrchestrator.RuntimeMode mode) {}
}
