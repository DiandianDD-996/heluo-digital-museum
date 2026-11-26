package com.heluo.museum.config;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = {
        "spring.profiles.active=test,pocketbay",
        "spring.datasource.url=jdbc:h2:mem:museum-guide-meta;MODE=MySQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "museum.guide.enabled=true",
        "museum.guide.model-enabled=false",
        "museum.bootstrap.enabled=true",
        "museum.bootstrap.admin-username=guide-meta-admin",
        "museum.bootstrap.admin-password=only-for-guide-meta-tests"
})
@AutoConfigureMockMvc
class PocketBayGuideMetaInjectionTests {
    @Autowired
    MockMvc mvc;

    @Test
    void injectsGuideEnabledMetaIntoPocketBaySpaAndDetailHtmlWhenEnabled() throws Exception {
        mvc.perform(get("/"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(content().string(containsString("<meta name=\"museum-guide-enabled\" content=\"true\">")));

        mvc.perform(get("/exhibits/heluo-bronze-ding-3d"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(content().string(containsString("<meta name=\"museum-guide-enabled\" content=\"true\">")));

        mvc.perform(get("/unknown/page"))
                .andExpect(status().isNotFound())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(content().string(containsString("<meta name=\"museum-guide-enabled\" content=\"true\">")));
    }
}
