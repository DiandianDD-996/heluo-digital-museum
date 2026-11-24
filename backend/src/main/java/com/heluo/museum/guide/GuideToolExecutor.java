package com.heluo.museum.guide;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Executes the 3 read-only museum tools exposed to the LLM:
 * 1. get_museum_item_detail(type, slug)
 * 2. search_museum_catalog(keyword)
 * 3. query_appointment_slots(date?, days?, people?)
 */
@Service
public class GuideToolExecutor {
    static final int OPEN_BOOKING_WINDOW_DAYS = 14;
    static final int MIN_PEOPLE = 1;
    static final int MAX_PEOPLE = 30;

    private final GuideKnowledgeService knowledge;
    private final JdbcTemplate jdbc;
    private final Clock clock;
    private final ObjectMapper objectMapper;

    public GuideToolExecutor(GuideKnowledgeService knowledge, JdbcTemplate jdbc, Clock clock, ObjectMapper objectMapper) {
        this.knowledge = knowledge;
        this.jdbc = jdbc;
        this.clock = clock;
        this.objectMapper = objectMapper;
    }

    public List<Map<String, Object>> toolDefinitions() {
        return List.of(
                functionTool(
                        "get_museum_item_detail",
                        "Fetch full curated description and metadata of a published museum artifact, cultural article, 3D exhibit, or shop product by type and slug. Use when the visitor asks about another item, compares items, or wants deep curatorial/product context.",
                        Map.of(
                                "type", Map.of("type", "string", "enum", List.of("artifact", "article", "exhibit", "product"),
                                        "description", "Item category"),
                                "slug", Map.of("type", "string", "description", "Exact slug from the museum catalog")),
                        List.of("type", "slug")),
                functionTool(
                        "search_museum_catalog",
                        "Search published artifacts, cultural articles, 3D exhibits, and museum shop products by keyword.",
                        Map.of("keyword", Map.of("type", "string", "description", "Search keyword in Chinese or English")),
                        List.of("keyword")),
                functionTool(
                        "query_appointment_slots",
                        "Query real-time open museum visit appointment slots within the next 14 days (read-only, never books). Always call this when asked about visit times, dates, or remaining spots.",
                        Map.of(
                                "date", Map.of("type", "string", "description", "Optional target date in YYYY-MM-DD format"),
                                "days", Map.of("type", "integer", "description", "Optional number of days from today (1-14, default 7) when date is omitted"),
                                "people", Map.of("type", "integer", "description", "Optional visitor count (1-30) to check remaining capacity")),
                        List.of()));
    }

    public String execute(String toolName, String rawArgumentsJson, ToolAuditContext audit) {
        JsonNode args;
        try {
            args = (rawArgumentsJson == null || rawArgumentsJson.isBlank())
                    ? objectMapper.createObjectNode()
                    : objectMapper.readTree(rawArgumentsJson);
        } catch (JsonProcessingException ex) {
            return toJson(Map.of("ok", false, "error", "INVALID_ARGUMENTS", "message", "Malformed JSON arguments"));
        }

        Map<String, Object> result = switch (toolName == null ? "" : toolName.trim()) {
            case "get_museum_item_detail" -> executeGetDetail(args, audit);
            case "search_museum_catalog" -> executeSearch(args, audit);
            case "query_appointment_slots" -> executeQuerySlots(args, audit);
            default -> Map.of("ok", false, "error", "UNKNOWN_TOOL", "message", "Unsupported read-only tool");
        };
        return toJson(result);
    }

    public List<PublicSlot> queryPublicSlots(LocalDate from, LocalDate to) {
        LocalDateTime current = LocalDateTime.now(clock);
        LocalDate today = current.toLocalDate();
        LocalTime now = current.toLocalTime();
        return jdbc.query("""
                select id, visit_date, start_time, end_time, capacity, reserved_people
                from appointment_slots
                where visit_date between ? and ?
                  and status = 'OPEN'
                  and reserved_people < capacity
                  and (visit_date > ? or (visit_date = ? and start_time > ?))
                order by visit_date, start_time
                """, (rs, rowNum) -> new PublicSlot(
                rs.getLong("id"),
                rs.getDate("visit_date").toLocalDate(),
                rs.getTime("start_time").toLocalTime(),
                rs.getTime("end_time").toLocalTime(),
                Math.max(0, rs.getInt("capacity") - rs.getInt("reserved_people"))),
                from, to, today, today, now);
    }

    public LocalDate today() {
        return LocalDateTime.now(clock).toLocalDate();
    }

    public LocalDate openWindowEnd(LocalDate today) {
        return today.plusDays(OPEN_BOOKING_WINDOW_DAYS - 1L);
    }

    private Map<String, Object> executeGetDetail(JsonNode args, ToolAuditContext audit) {
        String type = text(args, "type");
        String slug = text(args, "slug");
        if (type.isBlank() || slug.isBlank()) {
            return Map.of("ok", false, "error", "MISSING_PARAM", "message", "Both type and slug are required");
        }
        return switch (type) {
            case "artifact" -> knowledge.findArtifact(slug).<Map<String, Object>>map(a -> {
                audit.recordArtifact(a);
                Map<String, Object> payload = new LinkedHashMap<>();
                payload.put("ok", true);
                payload.put("type", "artifact");
                payload.put("citationId", "ARTIFACT:" + a.slug());
                payload.put("slug", a.slug());
                payload.put("title", a.title());
                payload.put("titleEn", a.titleEn());
                payload.put("category", a.categoryName());
                payload.put("period", a.period());
                payload.put("material", a.material());
                payload.put("dimensions", a.dimensions());
                payload.put("collectionLocation", a.collectionLocation());
                payload.put("summary", a.summary());
                payload.put("summaryEn", a.summaryEn());
                payload.put("content", a.content());
                payload.put("path", "/artifacts/" + a.slug());
                if (a.exhibitSlug() != null) {
                    payload.put("exhibitSlug", a.exhibitSlug());
                    knowledge.findExhibit(a.exhibitSlug()).ifPresent(audit::recordExhibit);
                    List<GuideEvidenceReader.Evidence> cards = knowledge.evidenceCards(a.exhibitSlug());
                    if (!cards.isEmpty()) {
                        cards.forEach(audit::recordEvidence);
                        payload.put("verifiedEvidenceCards", cards.stream().map(this::evidenceView).toList());
                    }
                }
                return payload;
            }).orElseGet(() -> Map.of("ok", false, "error", "NOT_FOUND", "message", "No published artifact found for slug: " + slug));

            case "article" -> knowledge.findArticle(slug).<Map<String, Object>>map(a -> {
                audit.recordArticle(a);
                Map<String, Object> payload = new LinkedHashMap<>();
                payload.put("ok", true);
                payload.put("type", "article");
                payload.put("citationId", "ARTICLE:" + a.slug());
                payload.put("slug", a.slug());
                payload.put("title", a.title());
                payload.put("titleEn", a.titleEn());
                payload.put("category", a.categoryName());
                payload.put("author", a.authorDisplay());
                payload.put("summary", a.summary());
                payload.put("summaryEn", a.summaryEn());
                payload.put("content", a.content());
                payload.put("path", "/articles/" + a.slug());
                return payload;
            }).orElseGet(() -> Map.of("ok", false, "error", "NOT_FOUND", "message", "No published article found for slug: " + slug));

            case "exhibit" -> knowledge.findExhibit(slug).<Map<String, Object>>map(e -> {
                audit.recordExhibit(e);
                Map<String, Object> payload = new LinkedHashMap<>();
                payload.put("ok", true);
                payload.put("type", "exhibit");
                payload.put("citationId", "EXHIBIT:" + e.slug());
                payload.put("slug", e.slug());
                payload.put("title", e.title());
                payload.put("displayNo", e.displayNo());
                payload.put("summary", e.summary());
                payload.put("description", e.description());
                payload.put("sourceCredit", e.sourceCredit());
                payload.put("sourceUrl", e.sourceUrl());
                payload.put("licenseLabel", e.licenseLabel());
                payload.put("collectionLocation", e.collectionLocation());
                payload.put("artifactSlug", e.artifactSlug());
                payload.put("path", "/exhibits/" + e.slug());
                knowledge.findArtifact(e.artifactSlug()).ifPresent(a -> {
                    audit.recordArtifact(a);
                    payload.put("artifactContent", a.content());
                });
                List<GuideEvidenceReader.Evidence> cards = knowledge.evidenceCards(e.slug());
                if (!cards.isEmpty()) {
                    cards.forEach(audit::recordEvidence);
                    payload.put("verifiedEvidenceCards", cards.stream().map(this::evidenceView).toList());
                }
                return payload;
            }).orElseGet(() -> Map.of("ok", false, "error", "NOT_FOUND", "message", "No published 3D exhibit found for slug: " + slug));

            case "product" -> knowledge.findProduct(slug).<Map<String, Object>>map(p -> {
                audit.recordProduct(p);
                Map<String, Object> payload = new LinkedHashMap<>();
                payload.put("ok", true);
                payload.put("type", "product");
                payload.put("citationId", "PRODUCT:" + p.slug());
                payload.put("slug", p.slug());
                payload.put("sku", p.sku());
                payload.put("name", p.name());
                payload.put("nameEn", p.nameEn());
                payload.put("price", p.price());
                payload.put("availableStock", p.availableStock());
                payload.put("summary", p.summary());
                payload.put("summaryEn", p.summaryEn());
                payload.put("description", p.description());
                payload.put("path", "/shop");
                return payload;
            }).orElseGet(() -> Map.of("ok", false, "error", "NOT_FOUND", "message", "No active shop product found for slug: " + slug));

            default -> Map.of("ok", false, "error", "INVALID_TYPE", "message", "type must be artifact, article, exhibit, or product");
        };
    }

    private Map<String, Object> executeSearch(JsonNode args, ToolAuditContext audit) {
        String keyword = text(args, "keyword");
        if (keyword.isBlank()) {
            return Map.of("ok", false, "error", "MISSING_KEYWORD", "message", "keyword is required");
        }
        List<GuideKnowledgeService.SearchHit> hits = knowledge.searchCatalog(keyword);
        List<Map<String, Object>> items = new ArrayList<>();
        for (GuideKnowledgeService.SearchHit hit : hits) {
            switch (hit.type()) {
                case "artifact" -> knowledge.findArtifact(hit.slug()).ifPresent(audit::recordArtifact);
                case "article" -> knowledge.findArticle(hit.slug()).ifPresent(audit::recordArticle);
                case "exhibit" -> knowledge.findExhibit(hit.slug()).ifPresent(audit::recordExhibit);
                case "product" -> knowledge.findProduct(hit.slug()).ifPresent(audit::recordProduct);
                default -> {}
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("type", hit.type());
            row.put("slug", hit.slug());
            row.put("citationId", hit.type().toUpperCase() + ":" + hit.slug());
            row.put("title", hit.title());
            row.put("titleEn", hit.titleEn());
            row.put("summary", hit.summary());
            row.put("path", hit.path());
            if (hit.exhibitSlug() != null) {
                row.put("exhibitSlug", hit.exhibitSlug());
            }
            items.add(row);
        }
        return Map.of("ok", true, "keyword", keyword, "count", items.size(), "results", items);
    }

    private Map<String, Object> executeQuerySlots(JsonNode args, ToolAuditContext audit) {
        audit.markAppointmentSlotsQueried();
        LocalDate today = today();
        LocalDate windowEnd = openWindowEnd(today);

        Integer people = null;
        if (args.has("people") && !args.get("people").isNull()) {
            if (!args.get("people").canConvertToInt()) {
                return Map.of("ok", false, "error", "INVALID_PEOPLE",
                        "message", "人数必须为 1 到 30 之间的整数 (people must be an integer between 1 and 30).");
            }
            people = args.get("people").asInt();
            if (people < MIN_PEOPLE || people > MAX_PEOPLE) {
                Map<String, Object> err = new LinkedHashMap<>();
                err.put("ok", false);
                err.put("error", "PEOPLE_OUT_OF_RANGE");
                err.put("minPeople", MIN_PEOPLE);
                err.put("maxPeople", MAX_PEOPLE);
                err.put("requestedPeople", people);
                err.put("message", "单笔公开预约人数仅支持 1 至 30 人，超出人数需分笔预约或联系馆方团体接待。");
                return err;
            }
        }

        LocalDate from;
        LocalDate to;
        String dateText = text(args, "date");
        if (!dateText.isBlank()) {
            LocalDate target;
            try {
                target = LocalDate.parse(dateText);
            } catch (DateTimeParseException ex) {
                return Map.of("ok", false, "error", "INVALID_DATE",
                        "message", "日期格式需为 YYYY-MM-DD",
                        "today", today.toString(),
                        "openWindowEnd", windowEnd.toString());
            }
            if (target.isBefore(today) || target.isAfter(windowEnd)) {
                Map<String, Object> out = new LinkedHashMap<>();
                out.put("ok", false);
                out.put("error", "OUT_OF_OPEN_WINDOW");
                out.put("today", today.toString());
                out.put("openWindowEnd", windowEnd.toString());
                out.put("requestedDate", target.toString());
                out.put("message", "公开预约仅开放今天起未来 14 天（" + today + " 至 " + windowEnd + "）的时段。");
                return out;
            }
            from = target;
            to = target;
        } else {
            int days = args.has("days") && args.get("days").canConvertToInt() ? args.get("days").asInt() : 7;
            days = Math.max(1, Math.min(OPEN_BOOKING_WINDOW_DAYS, days));
            from = today;
            to = today.plusDays(days - 1L);
            if (to.isAfter(windowEnd)) {
                to = windowEnd;
            }
        }

        List<PublicSlot> slots = queryPublicSlots(from, to);
        Integer requiredPeople = people;
        List<Map<String, Object>> slotRows = toSlotRows(slots, requiredPeople);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("ok", true);
        result.put("citationId", "APPOINTMENT:PUBLIC_SLOTS");
        result.put("today", today.toString());
        result.put("openWindowEnd", windowEnd.toString());
        result.put("from", from.toString());
        result.put("to", to.toString());
        if (requiredPeople != null) {
            result.put("requestedPeople", requiredPeople);
        }
        result.put("count", slotRows.size());
        result.put("slots", slotRows);
        if (slotRows.isEmpty() && !dateText.isBlank()) {
            List<Map<String, Object>> nextAvailable = toSlotRows(queryPublicSlots(today, windowEnd), requiredPeople)
                    .stream()
                    .limit(3)
                    .toList();
            result.put("nextAvailableSlots", nextAvailable);
        }
        result.put("note", "只读查询结果，不包含预约写入；请引导游客点击「前往预约」按钮自行提交。");
        return result;
    }

    private List<Map<String, Object>> toSlotRows(List<PublicSlot> slots, Integer requiredPeople) {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (PublicSlot slot : slots) {
            if (requiredPeople != null && slot.remainingPeople() < requiredPeople) {
                continue;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("date", slot.visitDate().toString());
            row.put("startTime", slot.startTime().toString().substring(0, 5));
            row.put("endTime", slot.endTime().toString().substring(0, 5));
            row.put("remainingPeople", slot.remainingPeople());
            rows.add(row);
        }
        return rows;
    }

    private Map<String, Object> evidenceView(GuideEvidenceReader.Evidence evidence) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", evidence.card().id());
        row.put("revision", evidence.card().revision());
        row.put("spoken", evidence.spokenText());
        row.put("boundary", evidence.boundaryText());
        if (evidence.publicSource() != null) {
            row.put("publicSource", evidence.publicSource().toString());
        }
        return row;
    }

    private static Map<String, Object> functionTool(String name, String description,
                                                    Map<String, Object> properties, List<String> required) {
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("type", "object");
        params.put("properties", properties);
        params.put("required", required);
        Map<String, Object> fn = new LinkedHashMap<>();
        fn.put("name", name);
        fn.put("description", description);
        fn.put("parameters", params);
        return Map.of("type", "function", "function", fn);
    }

    private static String text(JsonNode node, String field) {
        if (node == null || !node.has(field) || node.get(field).isNull()) return "";
        return node.get(field).asText("").trim();
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            return "{\"ok\":false,\"error\":\"SERIALIZATION_ERROR\"}";
        }
    }

    public record PublicSlot(long id, LocalDate visitDate, LocalTime startTime, LocalTime endTime, int remainingPeople) {}

    /**
     * Collects all authoritative sources, slugs, and public URLs touched during a single turn
     * (via pre-injection or tool execution) so GuideResponseValidator can enforce strict allowlists.
     */
    public static final class ToolAuditContext {
        private final Map<String, CitationMeta> allowedCitations = new LinkedHashMap<>();
        private final Set<String> allowedExternalUrls = new LinkedHashSet<>();
        private final List<String> invokedTools = new ArrayList<>();

        public void recordEvidence(GuideEvidenceReader.Evidence evidence) {
            String url = evidence.publicSource() == null ? null : evidence.publicSource().toString();
            if (url != null) {
                allowedExternalUrls.add(url);
            }
            allowedCitations.put(evidence.card().id(), new CitationMeta(
                    evidence.card().id(),
                    "已签核展品证据 · " + evidence.card().id(),
                    "Verified Exhibit Card · " + evidence.card().id(),
                    "v" + evidence.card().revision(),
                    "/exhibits/" + evidence.card().exhibitSlug(),
                    url,
                    evidence.boundaryText()));
        }

        public void recordArtifact(GuideKnowledgeService.ArtifactItem item) {
            String id = "ARTIFACT:" + item.slug();
            allowedCitations.putIfAbsent(id, new CitationMeta(
                    id,
                    item.title(),
                    item.titleEn().isBlank() ? item.title() : item.titleEn(),
                    "live",
                    "/artifacts/" + item.slug(),
                    null,
                    ""));
        }

        public void recordArticle(GuideKnowledgeService.ArticleItem item) {
            String id = "ARTICLE:" + item.slug();
            allowedCitations.putIfAbsent(id, new CitationMeta(
                    id,
                    item.title(),
                    item.titleEn().isBlank() ? item.title() : item.titleEn(),
                    "live",
                    "/articles/" + item.slug(),
                    null,
                    ""));
        }

        public void recordExhibit(GuideKnowledgeService.ExhibitItem item) {
            String id = "EXHIBIT:" + item.slug();
            String url = item.sourceUrl().isBlank() ? null : item.sourceUrl();
            if (url != null) {
                allowedExternalUrls.add(url);
            }
            allowedCitations.putIfAbsent(id, new CitationMeta(
                    id,
                    item.title(),
                    item.titleEn().isBlank() ? item.title() : item.titleEn(),
                    "live",
                    "/exhibits/" + item.slug(),
                    url,
                    item.sourceCredit()));
        }

        public void recordProduct(GuideKnowledgeService.ProductItem item) {
            String id = "PRODUCT:" + item.slug();
            allowedCitations.putIfAbsent(id, new CitationMeta(
                    id,
                    item.name(),
                    item.nameEn().isBlank() ? item.name() : item.nameEn(),
                    "live",
                    "/shop",
                    null,
                    ""));
        }

        public void markAppointmentSlotsQueried() {
            allowedCitations.putIfAbsent("APPOINTMENT:PUBLIC_SLOTS", new CitationMeta(
                    "APPOINTMENT:PUBLIC_SLOTS",
                    "河洛数字博物馆公开预约时段（实时）",
                    "Heluo Museum Public Appointment Slots (Live)",
                    "live",
                    "/appointment",
                    null,
                    "仅展示今天起 14 天内开放且尚有余量的公开时段，单笔限 1-30 人。"));
        }

        public void recordToolCall(String name) {
            invokedTools.add(name);
        }

        public Map<String, CitationMeta> allowedCitations() {
            return allowedCitations;
        }

        public Set<String> allowedExternalUrls() {
            return allowedExternalUrls;
        }

        public List<String> invokedTools() {
            return invokedTools;
        }
    }

    public record CitationMeta(
            String id,
            String titleZh,
            String titleEn,
            String revision,
            String internalPath,
            String publicSourceUrl,
            String boundaryNote) {}
}
