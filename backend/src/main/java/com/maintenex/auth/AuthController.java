package com.maintenex.auth;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private static final Duration RESEND_COOLDOWN = Duration.ofSeconds(60);
    private static final Duration RESEND_WINDOW = Duration.ofHours(1);
    private static final int MAX_RESENDS = 3;

    private final RestClient auth;
    private final String supabaseUrl;
    private final String passwordRecoveryUrl;
    private final Map<String, ResendState> resendStates = new ConcurrentHashMap<>();

    public AuthController(
            RestClient.Builder builder,
            @Value("${maintenex.supabase.url}") String supabaseUrl,
            @Value("${maintenex.supabase.publishable-key}") String publishableKey,
            @Value("${maintenex.site-url}") String siteUrl) {
        this.supabaseUrl = supabaseUrl.replaceAll("/+$", "");
        this.passwordRecoveryUrl = siteUrl.replaceAll("/+$", "") + "/redefinir-senha";
        this.auth = builder
                .baseUrl(this.supabaseUrl + "/auth/v1")
                .defaultHeader("apikey", publishableKey)
                .defaultHeader("Authorization", "Bearer " + publishableKey)
                .build();
    }

    @PostMapping("/signup")
    ResponseEntity<JsonNode> signup(@Valid @RequestBody SignupRequest request) {
        ensureConfigured();
        var data = Map.of(
                "nome", request.nome().trim(),
                "telefone", normalizePhone(request.telefone()),
                "empresa_nome", request.empresa() == null ? "" : request.empresa().trim());
        JsonNode response = auth.post().uri("/signup")
                .body(Map.of("email", request.email().trim().toLowerCase(), "password", request.senha(), "data", data))
                .retrieve().body(JsonNode.class);
        if (response != null && response.path("identities").isArray() && response.path("identities").isEmpty()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Este e-mail já está cadastrado.");
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/verify")
    JsonNode verify(@Valid @RequestBody VerifyRequest request) {
        ensureConfigured();
        return auth.post().uri("/verify")
                .body(Map.of("email", request.email().trim().toLowerCase(), "token", request.codigo(), "type", "signup"))
                .retrieve().body(JsonNode.class);
    }

    @PostMapping("/resend")
    ResponseEntity<Void> resend(@Valid @RequestBody EmailRequest request) {
        ensureConfigured();
        String email = request.email().trim().toLowerCase();
        enforceResendLimit(email);
        auth.post().uri("/resend").body(Map.of("email", email, "type", "signup")).retrieve().toBodilessEntity();
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/recover")
    ResponseEntity<Void> recover(@Valid @RequestBody RecoverRequest request) {
        ensureConfigured();
        URI uri = URI.create(supabaseUrl + "/auth/v1/recover?redirect_to=" +
                java.net.URLEncoder.encode(passwordRecoveryUrl, java.nio.charset.StandardCharsets.UTF_8));
        auth.post().uri(uri).body(Map.of("email", request.email().trim().toLowerCase()))
                .retrieve().toBodilessEntity();
        return ResponseEntity.noContent().build();
    }

    private void ensureConfigured() {
        if (supabaseUrl.isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Supabase não configurado no backend.");
        }
    }

    private void enforceResendLimit(String email) {
        Instant now = Instant.now();
        resendStates.compute(email, (key, old) -> {
            ResendState state = old == null || old.windowStart().plus(RESEND_WINDOW).isBefore(now)
                    ? new ResendState(now, Instant.EPOCH, 0) : old;
            if (state.lastSent().plus(RESEND_COOLDOWN).isAfter(now)) {
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Aguarde 60 segundos antes de reenviar.");
            }
            if (state.attempts() >= MAX_RESENDS) {
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Limite de 3 reenvios por hora atingido.");
            }
            return new ResendState(state.windowStart(), now, state.attempts() + 1);
        });
    }

    private static String normalizePhone(String value) {
        String digits = value.replaceAll("\\D", "");
        if (value.trim().startsWith("+") && digits.length() >= 10 && digits.length() <= 15) return "+" + digits;
        if (digits.length() == 10 || digits.length() == 11) return "+55" + digits;
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Telefone inválido.");
    }

    @ExceptionHandler(RestClientResponseException.class)
    ResponseEntity<String> upstreamError(RestClientResponseException error) {
        HttpStatus status = error.getStatusCode().is4xxClientError()
                ? HttpStatus.valueOf(error.getStatusCode().value())
                : HttpStatus.BAD_GATEWAY;
        return ResponseEntity.status(status).body("Não foi possível concluir a solicitação de autenticação.");
    }

    record SignupRequest(
            @NotBlank String nome,
            @NotBlank @Email String email,
            @NotBlank @Pattern(regexp = "^[+()0-9 .-]{10,22}$") String telefone,
            @NotBlank @Size(min = 8, max = 72)
            @Pattern(regexp = "^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,72}$") String senha,
            String empresa) {}

    record VerifyRequest(@NotBlank @Email String email, @NotBlank @Pattern(regexp = "^\\d{6,8}$") String codigo) {}
    record EmailRequest(@NotBlank @Email String email) {}
    record RecoverRequest(@NotBlank @Email String email) {}
    record ResendState(Instant windowStart, Instant lastSent, int attempts) {}
}
