package com.maintenex.health;

import java.util.Objects;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;

@WebMvcTest(HealthController.class)
@Import(com.maintenex.config.SecurityConfig.class)
class HealthControllerTest {
    @Autowired
    MockMvc mockMvc;

    @Test
    void returnsHealthStatus() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    void rejectsAuthenticatedStateChangingRequestWithoutCsrfToken() throws Exception {
        mockMvc.perform(post("/api/health").with(Objects.requireNonNull(user("test-user"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void acceptsCsrfTokenBeforeRoutingStateChangingRequest() throws Exception {
        mockMvc.perform(post("/api/health")
                        .with(Objects.requireNonNull(user("test-user")))
                        .with(Objects.requireNonNull(csrf())))
                .andExpect(status().isMethodNotAllowed());
    }
} 
