package com.heluo.museum.guide;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.ActiveProfiles;

@EnabledIfEnvironmentVariable(named = "LUOSHENG_RUN_PRODUCTION_BROWSER", matches = "1")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "server.address=127.0.0.1",
        "spring.datasource.url=jdbc:h2:mem:guide-production;MODE=MySQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "museum.bootstrap.enabled=true",
        "museum.bootstrap.admin-username=guide_production_test",
        "museum.bootstrap.admin-password=GuideProductionFixtureOnly123",
        "museum.bootstrap.admin-email=guide-production@example.test"
})
@ActiveProfiles("test")
class GuideProductionBrowserTests {
    @LocalServerPort int port;

    @Test
    void productionNavigationWorksWithoutGuide() throws Exception {
        var builder = new ProcessBuilder("node", "scripts/luosheng-production-check.mjs")
                .directory(Path.of("..", "frontend").toFile()).redirectErrorStream(true);
        builder.environment().put("MUSEUM_DEV_API_URL", "http://127.0.0.1:" + port);
        var process = builder.start();
        try (var output = process.inputReader(StandardCharsets.UTF_8)) {
            var captured = CompletableFuture.supplyAsync(() -> String.join("\n", output.lines().toList()));
            assertTrue(process.waitFor(50, TimeUnit.SECONDS), "Production browser test timed out");
            String log = captured.get(5, TimeUnit.SECONDS);
            assertEquals(0, process.exitValue(), log);
            assertTrue(log.contains("returned artifact and booking slots passed without guide UI or requests"), log);
            assertTrue(log.contains("preset and turn routes both returned 404"), log);
            System.out.println(log);
        } finally {
            if (process.isAlive()) process.destroyForcibly();
        }
    }
}
