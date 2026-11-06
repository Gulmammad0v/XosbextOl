package com.app.xosbextol.config;

import com.app.xosbextol.service.UserAccess;
import org.springframework.context.annotation.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.server.resource.authentication.*;
import org.springframework.security.oauth2.core.*;
import org.springframework.security.crypto.password.*;

import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {
    @Bean
    JwtDecoder jwtDecoder(@Value("${app.jwt.secret}") String secret, UserAccess users) {
        if (secret.getBytes(StandardCharsets.UTF_8).length < 32)
            throw new IllegalArgumentException("JWT_SECRET must contain at least 32 bytes");
        var decoder = NimbusJwtDecoder.withSecretKey(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"))
                .macAlgorithm(MacAlgorithm.HS256).build();
        var validator = new DelegatingOAuth2TokenValidator<Jwt>(JwtValidators.createDefaultWithIssuer("xosbextOl"),
                jwt -> users.activeRole(Long.parseLong(jwt.getSubject())).filter(role -> role.equals(jwt.getClaimAsString("role"))).isPresent()
                        ? OAuth2TokenValidatorResult.success()
                        : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "User inactive or role changed", null)));
        decoder.setJwtValidator(validator);
        return decoder;
    }

    @Bean
    JwtEncoder jwtEncoder(@Value("${app.jwt.secret}") String secret) {
        return new NimbusJwtEncoder(new com.nimbusds.jose.jwk.source.ImmutableSecret<>(secret.getBytes(StandardCharsets.UTF_8)));
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return Pbkdf2PasswordEncoder.defaultsForSpringSecurity_v5_8();
    }

    @Bean
    SecurityFilterChain security(HttpSecurity http) throws Exception {
        var converter = new JwtAuthenticationConverter();
        var authorities = new JwtGrantedAuthoritiesConverter();
        authorities.setAuthoritiesClaimName("role");
        authorities.setAuthorityPrefix("ROLE_");
        converter.setJwtGrantedAuthoritiesConverter(authorities);
        return http.csrf(c -> c.disable()).sessionManagement(c -> c.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(a -> a
                        .requestMatchers("/api/auth/**", "/api/payments/webhook", "/actuator/health", "/actuator/health/**",
                                "/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html", "/admin/index.html", "/map-picker.html").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/venues/**", "/api/halls/**", "/api/catalog/**", "/api/reviews/venue/**", "/api/media/**").permitAll()
                        .requestMatchers("/actuator/**", "/api/admin/**").hasRole("ADMIN")
                        .requestMatchers("/api/partner/**").hasAnyRole("VENUE_OWNER", "ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/reviews").hasRole("CUSTOMER")
                        .requestMatchers(HttpMethod.PUT, "/api/reviews/**").hasRole("CUSTOMER")
                        .requestMatchers(HttpMethod.GET, "/api/reviews/booking/**").hasRole("CUSTOMER")
                        .requestMatchers(HttpMethod.GET, "/api/reviews/eligibility/venue/**").hasRole("CUSTOMER")
                        .requestMatchers("/api/bookings/**", "/api/payments/**", "/api/favorites/**").hasRole("CUSTOMER")
                        .anyRequest().authenticated())
                .oauth2ResourceServer(o -> o.jwt(j -> j.jwtAuthenticationConverter(converter))).build();
    }

    @Bean
    java.time.Clock clock() {
        return java.time.Clock.systemUTC();
    }
}
