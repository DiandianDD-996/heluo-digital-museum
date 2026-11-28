package com.heluo.museum.appointment;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.heluo.museum.auth.JwtService;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.profiles.active=test",
        "spring.datasource.url=jdbc:h2:mem:museum-admin-phase2;MODE=MySQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE"
})
@Import(AdminAppointmentPhase2Tests.FixedShanghaiClock.class)
class AdminAppointmentPhase2Tests {
    // 2030-06-10 10:00:00 Asia/Shanghai (Monday)
    private static final LocalDate TODAY = LocalDate.of(2030, 6, 10);

    @Autowired private TestRestTemplate client;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private JwtService jwt;
    @Autowired private ObjectMapper mapper;

    @Test
    void forbidsNonAdminUsersFromPhase2SchedulingAndCheckInEndpoints() {
        var user = account(false);
        assertThat(client.exchange("/api/v1/admin/appointment-slots/calendar?month=2030-06",
                HttpMethod.GET, new HttpEntity<>(user.headers()), String.class).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(client.postForEntity("/api/v1/admin/appointment-slots/batch-generate",
                new HttpEntity<>(Map.of("dateFrom", "2030-06-11", "dateTo", "2030-06-12", "skipMondays", true, "capacity", 30), user.headers()),
                String.class).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(client.postForEntity("/api/v1/admin/appointment-slots/batch-status",
                new HttpEntity<>(Map.of("dateFrom", "2030-06-11", "dateTo", "2030-06-12", "status", "CLOSED"), user.headers()),
                String.class).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(client.exchange("/api/v1/admin/appointments/lookup?code=A1B2C3D4E5",
                HttpMethod.GET, new HttpEntity<>(user.headers()), String.class).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(client.postForEntity("/api/v1/admin/appointments/check-in-by-code",
                new HttpEntity<>(Map.of("verificationCode", "A1B2C3D4E5"), user.headers()), String.class).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(client.exchange("/api/v1/admin/appointments/export",
                HttpMethod.GET, new HttpEntity<>(user.headers()), String.class).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void batchGeneratesCalendarAndGuardsCapacityAndCancellationOnUpdate() throws Exception {
        var admin = account(true);
        var visitor = account(false);

        // Batch generate 2030-07-08 (Mon) through 2030-07-14 (Sun) -> skips Mon, creates 6 * 4 = 24 slots
        var genBody = Map.of(
                "dateFrom", "2030-07-08",
                "dateTo", "2030-07-14",
                "skipMondays", true,
                "capacity", 35
        );
        var genResp = client.postForEntity("/api/v1/admin/appointment-slots/batch-generate",
                new HttpEntity<>(genBody, admin.headers()), String.class);
        assertThat(genResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode genData = mapper.readTree(genResp.getBody()).path("data");
        assertThat(genData.path("createdCount").asInt()).isEqualTo(24);
        assertThat(genData.path("skippedMondayCount").asInt()).isEqualTo(1);
        assertThat(genData.path("skippedExistingCount").asInt()).isZero();

        // Idempotent second call skips all 24 existing slots
        var secondGen = client.postForEntity("/api/v1/admin/appointment-slots/batch-generate",
                new HttpEntity<>(genBody, admin.headers()), String.class);
        JsonNode secondData = mapper.readTree(secondGen.getBody()).path("data");
        assertThat(secondData.path("createdCount").asInt()).isZero();
        assertThat(secondData.path("skippedExistingCount").asInt()).isEqualTo(24);

        // Calendar view for 2030-07
        var calResp = client.exchange("/api/v1/admin/appointment-slots/calendar?month=2030-07",
                HttpMethod.GET, new HttpEntity<>(admin.headers()), String.class);
        assertThat(calResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode calData = mapper.readTree(calResp.getBody()).path("data");
        assertThat(calData.path("month").asText()).isEqualTo("2030-07");
        assertThat(calData.path("days").size()).isEqualTo(31);
        assertThat(calData.path("openDays").asInt()).isEqualTo(6);
        assertThat(calData.path("totalSlots").asInt()).isEqualTo(24);
        assertThat(calData.path("totalCapacity").asInt()).isEqualTo(840);

        // Book 2 visitors on 2030-07-09 09:00-10:30
        long tuesdayMorningSlotId = jdbc.queryForObject(
                "select id from appointment_slots where visit_date=? and start_time=?",
                Long.class, LocalDate.of(2030, 7, 9), LocalTime.of(9, 0));
        var bookingResp = client.postForEntity("/api/v1/appointments",
                new HttpEntity<>(Map.of(
                        "slotId", tuesdayMorningSlotId,
                        "visitorCount", 2,
                        "contactName", "林致远",
                        "contactPhone", "13811112222",
                        "contactEmail", "lin@example.test"), visitor.headers()),
                String.class);
        assertThat(bookingResp.getStatusCode()).isEqualTo(HttpStatus.OK);

        // PATCH capacity below reserved (1 < 2) -> 409
        var shrinkResp = client.exchange("/api/v1/admin/appointment-slots/" + tuesdayMorningSlotId,
                HttpMethod.PATCH,
                new HttpEntity<>(Map.of("visitDate", "2030-07-09", "startTime", "09:00:00", "endTime", "10:30:00",
                        "capacity", 1, "status", "OPEN"), admin.headers()),
                String.class);
        assertThat(shrinkResp.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);

        // PATCH status=CANCELLED with reservedPeople > 0 -> 409
        var cancelSlotResp = client.exchange("/api/v1/admin/appointment-slots/" + tuesdayMorningSlotId,
                HttpMethod.PATCH,
                new HttpEntity<>(Map.of("visitDate", "2030-07-09", "startTime", "09:00:00", "endTime", "10:30:00",
                        "capacity", 35, "status", "CANCELLED"), admin.headers()),
                String.class);
        assertThat(cancelSlotResp.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);

        // Batch status with capacity=1 skips the booked slot (reserved=2) and closes the other 3 slots
        var batchCapResp = client.postForEntity("/api/v1/admin/appointment-slots/batch-status",
                new HttpEntity<>(Map.of("dateFrom", "2030-07-09", "dateTo", "2030-07-09",
                        "status", "CLOSED", "capacity", 1), admin.headers()),
                String.class);
        assertThat(batchCapResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode batchCapData = mapper.readTree(batchCapResp.getBody()).path("data");
        assertThat(batchCapData.path("updatedCount").asInt()).isEqualTo(3);
        assertThat(batchCapData.path("skippedCapacityConflictCount").asInt()).isEqualTo(1);

        // Batch close without capacity closes all 4 slots and reports affectedReservedPeople = 2
        var batchCloseAll = client.postForEntity("/api/v1/admin/appointment-slots/batch-status",
                new HttpEntity<>(Map.of("dateFrom", "2030-07-09", "dateTo", "2030-07-09", "status", "CLOSED"),
                        admin.headers()),
                String.class);
        assertThat(batchCloseAll.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode closeData = mapper.readTree(batchCloseAll.getBody()).path("data");
        assertThat(closeData.path("updatedCount").asInt()).isEqualTo(4);
        assertThat(closeData.path("affectedReservedPeople").asInt()).isEqualTo(2);
    }

    @Test
    void filtersAppointmentsQuickChecksInByCodeAndExportsFormulaSafeBomCsv() throws Exception {
        var admin = account(true);
        var visitor = account(false);

        // Insert active slot for TODAY (2030-06-10 09:30-11:00; clock is 10:00:00 so it is in check-in window)
        jdbc.update("insert into appointment_slots(visit_date,start_time,end_time,capacity,status,created_by,updated_by) "
                        + "values(?,?,?,20,'OPEN',?,?)",
                TODAY, LocalTime.of(9, 30), LocalTime.of(11, 0), admin.id(), admin.id());
        long todaySlotId = jdbc.queryForObject(
                "select id from appointment_slots where visit_date=? and start_time=?",
                Long.class, TODAY, LocalTime.of(9, 30));

        // Insert a confirmed appointment directly for TODAY (booking endpoint requires startAt > now)
        String activeApptNo = "AP20300610CHECK1";
        jdbc.update("insert into appointments(appointment_no,user_id,slot_id,visitor_count,contact_name,contact_phone,"
                        + "contact_email,notes,status,creation_idempotency_key) values(?,?,?,?,?,?,?,?,'CONFIRMED',?)",
                activeApptNo, visitor.id(), todaySlotId, 2, "=CMD('calc')", "13900008888",
                "check@example.test", "携带轮椅", UUID.randomUUID().toString());
        jdbc.update("update appointment_slots set reserved_people=reserved_people+2 where id=?", todaySlotId);

        // Also insert another day's appointment for filter isolation
        LocalDate tomorrow = TODAY.plusDays(1);
        jdbc.update("insert into appointment_slots(visit_date,start_time,end_time,capacity,status,created_by,updated_by) "
                        + "values(?,?,?,20,'OPEN',?,?)",
                tomorrow, LocalTime.of(10, 30), LocalTime.of(12, 0), admin.id(), admin.id());
        long tomorrowSlotId = jdbc.queryForObject(
                "select id from appointment_slots where visit_date=? and start_time=?",
                Long.class, tomorrow, LocalTime.of(10, 30));
        jdbc.update("insert into appointments(appointment_no,user_id,slot_id,visitor_count,contact_name,contact_phone,"
                        + "contact_email,status,creation_idempotency_key) values(?,?,?,?,?,?,?,'PENDING',?)",
                "AP20300611OTHER2", visitor.id(), tomorrowSlotId, 1, "王砚冰", "13799990000",
                "wang@example.test", UUID.randomUUID().toString());

        // Filter by keyword + visitDate
        var searchResp = client.exchange(
                "/api/v1/admin/appointments?visitDate=2030-06-10&keyword=13900008888&status=CONFIRMED",
                HttpMethod.GET, new HttpEntity<>(admin.headers()), String.class);
        assertThat(searchResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode searchData = mapper.readTree(searchResp.getBody()).path("data");
        assertThat(searchData.path("total").asInt()).isEqualTo(1);
        String verificationCode = searchData.path("items").get(0).path("verificationCode").asText();
        assertThat(verificationCode).matches("^[0-9A-F]{10}$");

        // Lookup by verification code -> canCheckInNow = true
        var lookupResp = client.exchange(
                "/api/v1/admin/appointments/lookup?code=" + verificationCode.toLowerCase(),
                HttpMethod.GET, new HttpEntity<>(admin.headers()), String.class);
        assertThat(lookupResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode lookupData = mapper.readTree(lookupResp.getBody()).path("data");
        assertThat(lookupData.path("canCheckInNow").asBoolean()).isTrue();
        assertThat(lookupData.path("appointment").path("appointmentNo").asText()).isEqualTo(activeApptNo);

        // Export CSV with BOM and CSV-formula escaping before check-in
        var exportResp = client.exchange(
                "/api/v1/admin/appointments/export?visitDate=2030-06-10",
                HttpMethod.GET, new HttpEntity<>(admin.headers()), byte[].class);
        assertThat(exportResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(exportResp.getHeaders().getContentType().toString()).contains("text/csv");
        byte[] bytes = exportResp.getBody();
        assertThat(bytes).isNotNull();
        // UTF-8 BOM EF BB BF
        assertThat(bytes[0]).isEqualTo((byte) 0xEF);
        assertThat(bytes[1]).isEqualTo((byte) 0xBB);
        assertThat(bytes[2]).isEqualTo((byte) 0xBF);
        String csvText = new String(bytes, java.nio.charset.StandardCharsets.UTF_8);
        assertThat(csvText).contains(activeApptNo);
        assertThat(csvText).contains("\"'=CMD('calc')\"");
        assertThat(csvText).doesNotContain("AP20300611OTHER2");

        // Quick check-in by code -> COMPLETED
        var quickCheckInResp = client.postForEntity("/api/v1/admin/appointments/check-in-by-code",
                new HttpEntity<>(Map.of("verificationCode", verificationCode), admin.headers()), String.class);
        assertThat(quickCheckInResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(mapper.readTree(quickCheckInResp.getBody()).path("data").path("status").asText())
                .isEqualTo("COMPLETED");

        // Repeat quick check-in -> 409 CONFLICT
        var duplicateCheckIn = client.postForEntity("/api/v1/admin/appointments/check-in-by-code",
                new HttpEntity<>(Map.of("verificationCode", verificationCode), admin.headers()), String.class);
        assertThat(duplicateCheckIn.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);

        // Lookup invalid format -> 422, non-existent code -> 404
        assertThat(client.exchange("/api/v1/admin/appointments/lookup?code=BAD",
                HttpMethod.GET, new HttpEntity<>(admin.headers()), String.class).getStatusCode())
                .isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(client.exchange("/api/v1/admin/appointments/lookup?code=FFFFFFFFFF",
                HttpMethod.GET, new HttpEntity<>(admin.headers()), String.class).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
    }

    private Account account(boolean admin) {
        String name = "p2_" + UUID.randomUUID().toString().replace("-", "").substring(0, 14);
        jdbc.update("insert into users(username,password_hash,nickname) values(?,'unused-test-hash','Phase2')", name);
        long id = jdbc.queryForObject("select id from users where username=?", Long.class, name);
        jdbc.update("insert into user_roles(user_id,role_id) select ?,id from roles where code=?", id, admin ? "ADMIN" : "USER");
        var token = jwt.issue(id);
        jdbc.update("insert into auth_sessions(id,user_id,expires_at) values(?,?,?)", token.id(), id, Timestamp.from(token.expiresAt()));
        var headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(token.value());
        return new Account(id, headers);
    }

    private record Account(long id, HttpHeaders headers) {}

    @TestConfiguration
    static class FixedShanghaiClock {
        @Bean
        @Primary
        Clock fixedPhase2Clock() {
            return Clock.fixed(Instant.parse("2030-06-10T02:00:00Z"), ZoneId.of("Asia/Shanghai"));
        }
    }
}
