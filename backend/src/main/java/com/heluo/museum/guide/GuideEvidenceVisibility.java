package com.heluo.museum.guide;

import java.time.Clock;
import java.time.Instant;
import java.util.Objects;
import java.util.Optional;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;

final class GuideEvidenceVisibility {
    enum Status { DRAFT, PUBLISHED, WITHDRAWN }

    record Reference(String cardId, int revision) {}

    record Card(String id, int revision, String exhibitSlug, String artifactSlug, String locale,
                Status status, Instant publishedAt, Instant expiresAt) {}

    private final JdbcTemplate jdbc;
    private final Clock clock;

    GuideEvidenceVisibility(JdbcTemplate jdbc, Clock clock) {
        this.jdbc = jdbc;
        this.clock = clock;
    }

    // The caller must resolve the current card from the authoritative store on every check.
    boolean allows(String exhibitSlug, String locale, Reference reference, Card current) {
        Instant now = clock.instant();
        if (current == null || reference == null || exhibitSlug == null || locale == null
                || current.id() == null || current.artifactSlug() == null
                || current.revision() < 1 || current.revision() != reference.revision()
                || !Objects.equals(current.id(), reference.cardId())
                || !exhibitSlug.equals(current.exhibitSlug()) || !locale.equals(current.locale())
                || current.status() != Status.PUBLISHED || current.publishedAt() == null
                || current.publishedAt().isAfter(now)
                || (current.expiresAt() != null && !current.expiresAt().isAfter(now))) {
            return false;
        }
        try {
            return publicArtifactSlug(exhibitSlug).filter(current.artifactSlug()::equals).isPresent();
        } catch (DataAccessException unavailable) {
            return false;
        }
    }

    Optional<String> publicArtifactSlug(String exhibitSlug) {
        return jdbc.queryForList("""
                select a.slug from exhibits_3d e
                join artifacts a on a.id = e.artifact_id
                join categories c on c.id = a.category_id
                where e.slug = ? and e.status = 'PUBLISHED' and e.deleted_at is null
                  and a.status = 'PUBLISHED' and a.deleted_at is null and c.enabled = 1
                """, String.class, exhibitSlug).stream().findFirst();
    }
}
