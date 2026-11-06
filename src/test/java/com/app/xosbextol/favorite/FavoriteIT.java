package com.app.xosbextol.favorite;

import com.app.xosbextol.model.dto.FavoriteVenueResponseDto;
import com.app.xosbextol.service.impl.FavoriteService;
import com.app.xosbextol.support.PostgresIntegrationSupport;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;

class FavoriteIT extends PostgresIntegrationSupport {
    @Autowired FavoriteService favorites;
    @Autowired JdbcTemplate jdbc;

    @Test
    void activeVenueCanBeAddedListedAndRemoved() {
        String suffix = UUID.randomUUID().toString();
        long user = jdbc.queryForObject("""
                insert into users(email,email_verified_at,role_id,status_id,preferred_lang,created_at,updated_at)
                values (?,now(),(select id from user_roles where code='CUSTOMER'),
                (select id from user_statuses where code='ACTIVE'),'az',now(),now()) returning id
                """, Long.class, "favorite-customer-" + suffix + "@example.com");
        long venue = jdbc.queryForObject("""
                insert into venues(owner_id,name,slug,address,latitude,longitude,status_id,created_at,updated_at)
                values (?,'Favorit məkan',?,'Bakı',40,49,
                (select id from venue_statuses where code='ACTIVE'),now(),now()) returning id
                """, Long.class, user, "favorite-venue-" + suffix);

        favorites.add(user, venue);
        favorites.add(user, venue);

        var page = favorites.list(user, 0, 20);
        @SuppressWarnings("unchecked")
        var content = (List<FavoriteVenueResponseDto>) page.get("content");
        assertEquals(1, content.size());
        assertEquals(venue, content.getFirst().getId());

        favorites.remove(user, venue);
        assertEquals(0L, favorites.list(user, 0, 20).get("totalElements"));
    }
}
