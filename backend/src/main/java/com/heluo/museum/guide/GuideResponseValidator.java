package com.heluo.museum.guide;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.heluo.museum.guide.GuideKnowledgeService.CatalogSnapshot;
import com.heluo.museum.guide.GuideModels.Action;
import com.heluo.museum.guide.GuideModels.ChatRequest;
import com.heluo.museum.guide.GuideModels.Citation;
import com.heluo.museum.guide.GuideModels.PageContext;
import com.heluo.museum.guide.GuideToolExecutor.CitationMeta;
import com.heluo.museum.guide.GuideToolExecutor.ToolAuditContext;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/**
 * Layer-2 server-side guardrail validator:
 * 1. Tolerant META JSON extraction
 * 2. Citation allowlist enrichment
 * 3. 5-type structured Action allowlist enforcement (zero fake/air buttons)
 * 4. High-risk factual redline interception (allows normal question words like 尺寸/重量/出土;
 *    only blocks affirmative hallucinated provenance, king reigns, appraisals, or fake booking confirmations)
 * 5. Bare URL stripping from prose body
 */
@Component
public class GuideResponseValidator {
    private static final Set<String> VALID_VIEWS = Set.of("front", "left", "right", "back", "top");
    private static final Set<String> VALID_PARTS = Set.of("ear", "feet", "motif");
    private static final Set<String> VALID_MODES = Set.of("solid", "points");
    private static final Set<String> STATIC_ROUTES = Set.of("/explore", "/exhibits", "/appointment", "/shop");

    private static final Pattern BARE_URL = Pattern.compile("(?:https?://|www\\.)[^\\s。！？）)\\]】\"'<>]*", Pattern.CASE_INSENSITIVE);
    static final Pattern SENTENCE_END = Pattern.compile("[。！？\\r\\n]|[.!?](?=\\s)");
    private static final Pattern ISO_DATE = Pattern.compile("^\\d{4}-\\d{2}-\\d{2}$");

    // High-risk affirmative hallucination patterns (checked per sentence, skipped if sentence contains explicit negation)
    private static final Pattern NEGATION_MARKER = Pattern.compile(
            "不能确认|无法确认|不能断定|无法断定|不能排除|不支持|无从判断|难下定论|不等于|未填写|没有填写|未记载|未记录|并无|并非|不是|不属于|是不是|是否|无从确认|尚无|不可据此|不能据此|不代表|不提供|不会|无法替|不能替|不能为您|不会为您|cannot confirm|not recorded|unrecorded|cannot determine|do not|cannot book|cannot place|not an authentic|concept|whether",
            Pattern.CASE_INSENSITIVE);

    private static final Pattern REDLINE_PROVENANCE = Pattern.compile(
            "(出土于|发掘于|出土自|发掘自|发现于)[^。！？\\n]{0,8}(洛阳|二里头|殷墟|安阳|河南|偃师)|(洛阳|二里头|殷墟)出土(的|之)?(商代|青铜)?鼎|excavated (in|at|from) (Luoyang|Erlitou|Yinxu|Anyang)",
            Pattern.CASE_INSENSITIVE);

    private static final Pattern REDLINE_KING_REIGN = Pattern.compile(
            "(铸造于|铸于|制于|属于|作于)[^。！？\\n]{0,6}(武丁|盘庚|帝辛|纣王|商王)|(武丁|盘庚|帝辛)时期(铸造|制作|所铸)|cast during (King )?Wu Ding",
            Pattern.CASE_INSENSITIVE);

    private static final Pattern REDLINE_APPRAISAL = Pattern.compile(
            "(市场估价|拍卖估价|参考估价|估值|价值约?)[^。！？\\n]{0,8}(\\d+\\s*[万亿元美元]|数百万|上千万|人民币\\s*\\d+)|estimated (market )?value[^.\\n]{0,12}\\$\\d+",
            Pattern.CASE_INSENSITIVE);

    private static final Pattern REDLINE_FAKE_WRITE = Pattern.compile(
            "(已为您|已经为您|已帮你|已经帮你)[^。！？\\n]{0,6}(完成|提交|成功|预约|下单|预订|购买|支付)|预约已(经)?(为您)?成功提交|订单已(经)?为您创建|I have (booked|reserved|placed the order|completed the booking)",
            Pattern.CASE_INSENSITIVE);

    private static final Pattern REDLINE_CONCEPT_AS_REAL = Pattern.compile(
            "真实考古|真实出土|馆藏真品|考古发掘出土|(?:出土|发掘|发现)(?:于|自)|遗址出土|"
                    + "excavated\\b|unearthed\\b|(?:authentic|genuine|real)\\s+(?:archaeological|museum|artifact|artefact|relic|antiquity)",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern CONCEPT_NAME = Pattern.compile(
            "玉璧|青铜爵|彩陶水纹罐|图纹石板|水鸟青铜雕塑|heluo-bronze-jue|river-map-jade-bi|"
                    + "painted-pottery-water-jar|river-map-pattern-stone|water-bird-bronze|"
                    + "jade bi|bronze jue|painted pottery (?:water|jar)|pattern(?:ed)? stone|(?:bronze water bird|water bird bronze)",
            Pattern.CASE_INSENSITIVE);

    private final GuideKnowledgeService knowledge;
    private final ObjectMapper objectMapper;

    public GuideResponseValidator(GuideKnowledgeService knowledge, ObjectMapper objectMapper) {
        this.knowledge = knowledge;
        this.objectMapper = objectMapper;
    }

    public ValidationResult validate(ChatRequest request, String rawBody, String rawMeta, ToolAuditContext audit) {
        boolean english = GuidePromptBuilder.isEnglish(request.locale());
        String cleanedBody = cleanProse(rawBody == null ? "" : rawBody, english).strip();

        if (cleanedBody.isBlank()) {
            return ValidationResult.rejected("EMPTY_BODY");
        }

        if (violatesRedline(rawBody, request.context()) || violatesRedline(cleanedBody, request.context())) {
            return ValidationResult.rejected("FACTUAL_REDLINE");
        }

        JsonNode metaNode = parseTolerantJson(rawMeta);
        List<Action> actions = extractValidActions(metaNode, audit, request.context());
        List<Citation> citations = extractValidCitations(metaNode, audit, request.context(), actions, english);
        List<String> followUps = extractFollowUps(metaNode);
        String boundaryNote = extractBoundaryNote(metaNode, citations);

        return new ValidationResult(true, null, cleanedBody, citations, actions, followUps, boundaryNote);
    }

    boolean violatesRedline(String body, PageContext context) {
        boolean isConceptContext = context != null && context.artifactSlug() != null
                && CONCEPT_NAME.matcher(context.artifactSlug()).find();
        String[] sentences = SENTENCE_END.split(body);
        for (String sentence : sentences) {
            String s = sentence.strip();
            if (s.isEmpty()) continue;
            if (REDLINE_FAKE_WRITE.matcher(s).find() && !NEGATION_MARKER.matcher(s).find()) {
                return true;
            }
            if (REDLINE_APPRAISAL.matcher(s).find() && !NEGATION_MARKER.matcher(s).find()) {
                return true;
            }
            if (REDLINE_PROVENANCE.matcher(s).find() && !NEGATION_MARKER.matcher(s).find()) {
                return true;
            }
            if (REDLINE_KING_REIGN.matcher(s).find() && !NEGATION_MARKER.matcher(s).find()) {
                return true;
            }
            if ((isConceptContext || CONCEPT_NAME.matcher(s).find())
                    && REDLINE_CONCEPT_AS_REAL.matcher(s).find() && !isNegated(s)) {
                return true;
            }
        }
        return false;
    }

    String stripBareUrls(String text) {
        return BARE_URL.matcher(text).replaceAll("").replaceAll("[ \\t]{2,}", " ");
    }

    private static boolean isNegated(String sentence) {
        return NEGATION_MARKER.matcher(sentence.replaceAll("(?i)\\bconcept\\b", "")).find()
                || Pattern.compile("(?i)\\bnot (?:an? )?(?:excavated|real|genuine)|虚构|编造").matcher(sentence).find();
    }

    String cleanProse(String text, boolean english) {
        String cleaned = stripBareUrls(text).replaceAll("(?i)<{0,3}LUOSHENG_META>{0,3}", "");
        if (knowledge == null) return cleaned;
        var catalog = knowledge.catalog();
        Map<String, String> labels = new LinkedHashMap<>();
        catalog.artifacts().forEach(a -> labels.put(a.slug(), english && !a.titleEn().isBlank() ? a.titleEn() : a.title()));
        catalog.articles().forEach(a -> labels.put(a.slug(), english && !a.titleEn().isBlank() ? a.titleEn() : a.title()));
        catalog.exhibits().forEach(a -> labels.put(a.slug(), english && !a.titleEn().isBlank() ? a.titleEn() : a.title()));
        catalog.products().forEach(a -> labels.put(a.slug(), english && !a.nameEn().isBlank() ? a.nameEn() : a.name()));
        String backtick = Character.toString(96);
        for (String slug : labels.keySet().stream().sorted(java.util.Comparator.comparingInt(String::length).reversed()).toList()) {
            cleaned = cleaned.replaceAll("(?i)" + backtick + "*" + Pattern.quote(slug) + backtick + "*",
                    Matcher.quoteReplacement(labels.get(slug)));
        }
        return cleaned;
    }

    private JsonNode parseTolerantJson(String rawMeta) {
        if (rawMeta == null || rawMeta.isBlank()) {
            return null;
        }
        String candidate = extractFirstJsonObject(rawMeta);
        if (candidate == null) {
            return null;
        }
        try {
            JsonNode node = objectMapper.readTree(candidate);
            return node != null && node.isObject() ? node : null;
        } catch (Exception ignored) {
            return null;
        }
    }

    private static String extractFirstJsonObject(String raw) {
        int start = raw.indexOf('{');
        if (start < 0) return null;
        int depth = 0;
        boolean inString = false;
        boolean escaped = false;
        for (int i = start; i < raw.length(); i++) {
            char c = raw.charAt(i);
            if (inString) {
                if (escaped) {
                    escaped = false;
                } else if (c == '\\') {
                    escaped = true;
                } else if (c == '"') {
                    inString = false;
                }
            } else {
                if (c == '"') {
                    inString = true;
                } else if (c == '{') {
                    depth++;
                } else if (c == '}') {
                    depth--;
                    if (depth == 0) {
                        return raw.substring(start, i + 1);
                    }
                }
            }
        }
        return null;
    }

    private List<Citation> extractValidCitations(JsonNode meta, ToolAuditContext audit,
                                                 PageContext context, List<Action> actions, boolean english) {
        Map<String, CitationMeta> allowed = audit.allowedCitations();
        Set<String> seen = new LinkedHashSet<>();
        List<Citation> result = new ArrayList<>();

        if (meta != null && meta.has("citations") && meta.get("citations").isArray()) {
            for (JsonNode item : meta.get("citations")) {
                if (!item.isTextual()) continue;
                String id = item.asText("").trim();
                CitationMeta cm = allowed.get(id);
                if (cm != null && seen.add(id)) {
                    result.add(toCitation(cm, english));
                }
            }
        }

        // Backfill primary page/tool/action source if model omitted citations
        if (result.isEmpty()) {
            if ((audit.invokedTools().contains("query_appointment_slots")
                    || (context != null && "appointment".equalsIgnoreCase(context.route())))
                    && allowed.containsKey("APPOINTMENT:PUBLIC_SLOTS")) {
                CitationMeta cm = allowed.get("APPOINTMENT:PUBLIC_SLOTS");
                if (seen.add(cm.id())) result.add(toCitation(cm, english));
            }
            if (result.isEmpty() && context != null) {
                List<String> candidates = new ArrayList<>();
                if (context.exhibitSlug() != null && !context.exhibitSlug().isBlank()) {
                    candidates.add("EXHIBIT:" + context.exhibitSlug());
                }
                if (context.artifactSlug() != null && !context.artifactSlug().isBlank()) {
                    candidates.add("ARTIFACT:" + context.artifactSlug());
                }
                if (context.articleSlug() != null && !context.articleSlug().isBlank()) {
                    candidates.add("ARTICLE:" + context.articleSlug());
                }
                for (String candidate : candidates) {
                    CitationMeta cm = allowed.get(candidate);
                    if (cm != null && seen.add(candidate)) {
                        result.add(toCitation(cm, english));
                        break;
                    }
                }
                if (result.isEmpty() && "shop".equalsIgnoreCase(context.route())) {
                    for (CitationMeta cm : allowed.values()) {
                        if (cm.id().startsWith("PRODUCT:") && seen.add(cm.id())) {
                            result.add(toCitation(cm, english));
                            if (result.size() >= 3) break;
                        }
                    }
                }
            }
            if (result.isEmpty() && actions != null) {
                for (Action a : actions) {
                    String candidate = null;
                    if (a.exhibitSlug() != null) candidate = "EXHIBIT:" + a.exhibitSlug();
                    else if (a.path() != null && a.path().startsWith("/artifacts/")) candidate = "ARTIFACT:" + a.path().substring("/artifacts/".length());
                    else if (a.path() != null && a.path().startsWith("/articles/")) candidate = "ARTICLE:" + a.path().substring("/articles/".length());
                    else if (a.path() != null && a.path().startsWith("/exhibits/")) candidate = "EXHIBIT:" + a.path().substring("/exhibits/".length());
                    if (candidate != null && allowed.containsKey(candidate) && seen.add(candidate)) {
                        result.add(toCitation(allowed.get(candidate), english));
                    }
                }
            }
        }
        return result;
    }

    private List<Action> extractValidActions(JsonNode meta, ToolAuditContext audit, PageContext context) {
        if (meta == null || !meta.has("actions") || !meta.get("actions").isArray()) {
            return List.of();
        }
        CatalogSnapshot catalog = knowledge.catalog();
        List<Action> actions = new ArrayList<>();
        Set<String> dedupe = new LinkedHashSet<>();

        for (JsonNode node : meta.get("actions")) {
            if (!node.isObject() || actions.size() >= 4) continue;
            String type = text(node, "type");
            String label = text(node, "label");
            if (label.isBlank() || label.length() > 60) continue;

            Action validated = switch (type) {
                case "viewer_focus" -> validateViewerFocus(node, label, catalog);
                case "viewer_mode" -> validateViewerMode(node, label, catalog);
                case "viewer_tour" -> validateViewerTour(node, label, catalog);
                case "navigate" -> validateNavigate(node, label, catalog);
                case "open_plate" -> validateOpenPlate(node, label, context);
                case "open_source" -> validateOpenSource(node, label, audit);
                default -> null;
            };
            if (validated != null && dedupe.add(actionKey(validated))) {
                actions.add(validated);
            }
        }
        return actions;
    }

    private Action validateViewerFocus(JsonNode node, String label, CatalogSnapshot catalog) {
        String exhibitSlug = text(node, "exhibitSlug");
        if (exhibitSlug.isBlank() || !catalog.exhibitsBySlug().containsKey(exhibitSlug)) {
            return null;
        }
        String part = nullableEnum(text(node, "part"), VALID_PARTS);
        String view = nullableEnum(text(node, "view"), VALID_VIEWS);
        if (view == null && part != null) {
            view = switch (part) {
                case "ear" -> "top";
                case "feet" -> "back";
                case "motif" -> "front";
                default -> "front";
            };
        }
        if (view == null) {
            return null;
        }
        String mode = nullableEnum(text(node, "mode"), VALID_MODES);
        return Action.viewerFocus(exhibitSlug, part, view, mode, label);
    }

    private Action validateViewerMode(JsonNode node, String label, CatalogSnapshot catalog) {
        String exhibitSlug = text(node, "exhibitSlug");
        String mode = nullableEnum(text(node, "mode"), VALID_MODES);
        if (exhibitSlug.isBlank() || !catalog.exhibitsBySlug().containsKey(exhibitSlug) || mode == null) {
            return null;
        }
        return Action.viewerMode(exhibitSlug, mode, label);
    }

    private Action validateViewerTour(JsonNode node, String label, CatalogSnapshot catalog) {
        String exhibitSlug = text(node, "exhibitSlug");
        if (exhibitSlug.isBlank() || !catalog.exhibitsBySlug().containsKey(exhibitSlug)) {
            return null;
        }
        return Action.viewerTour(exhibitSlug, label);
    }

    private Action validateNavigate(JsonNode node, String label, CatalogSnapshot catalog) {
        String path = text(node, "path");
        if (path.isBlank() || !isAllowedPath(path, catalog)) {
            return null;
        }
        Map<String, String> cleanQuery = null;
        if (node.has("query") && node.get("query").isObject()) {
            Map<String, String> q = new LinkedHashMap<>();
            JsonNode qNode = node.get("query");
            if (qNode.has("date") && qNode.get("date").isTextual()) {
                String d = qNode.get("date").asText("").trim();
                if (ISO_DATE.matcher(d).matches()) q.put("date", d);
            }
            if (qNode.has("people")) {
                int p = qNode.get("people").canConvertToInt()
                        ? qNode.get("people").asInt()
                        : parseSafeInt(qNode.get("people").asText(""));
                if (p >= GuideToolExecutor.MIN_PEOPLE && p <= GuideToolExecutor.MAX_PEOPLE) {
                    q.put("people", String.valueOf(p));
                }
            }
            if (qNode.has("q") && qNode.get("q").isTextual()) {
                String kw = qNode.get("q").asText("").trim();
                if (!kw.isBlank() && kw.length() <= 60) q.put("q", kw);
            }
            if ("/explore".equals(path) && qNode.has("category") && qNode.get("category").isTextual()) {
                String cat = qNode.get("category").asText("").trim();
                String code = categoryCode(cat);
                if (code != null) q.put("category", code);
            }
            if (!q.isEmpty()) cleanQuery = q;
        }
        return Action.navigate(path, cleanQuery, label);
    }

    private String categoryCode(String category) {
        String alias = switch (category.toLowerCase(Locale.ROOT)) {
            case "青铜", "青铜礼器", "bronze", "bronze ritual vessels" -> "BRONZE";
            case "玉", "玉礼意象", "jade" -> "JADE";
            case "河洛", "河洛故事", "彩陶", "石刻", "river" -> "RIVER";
            default -> category;
        };
        return knowledge.enabledCategories().entrySet().stream()
                .filter(e -> e.getKey().equalsIgnoreCase(alias) || e.getValue().equalsIgnoreCase(category))
                .map(Map.Entry::getKey).findFirst().orElse(null);
    }

    private static int parseSafeInt(String text) {
        try {
            return Integer.parseInt(text.trim());
        } catch (NumberFormatException ex) {
            return -1;
        }
    }

    private Action validateOpenPlate(JsonNode node, String label, PageContext context) {
        String stop = nullableEnum(text(node, "stop"), VALID_PARTS);
        if (stop == null) return null;
        // Only allowed for Bronze Ding context or when Ding exists in catalog
        if (!knowledge.findExhibit(GuideKnowledgeService.DING_EXHIBIT_SLUG).isPresent()
                && !knowledge.findArtifact(GuideKnowledgeService.DING_ARTIFACT_SLUG).isPresent()) {
            return null;
        }
        Boolean compare = node.has("compare") && node.get("compare").isBoolean()
                ? node.get("compare").asBoolean() : null;
        return Action.openPlate(stop, compare, label);
    }

    private Action validateOpenSource(JsonNode node, String label, ToolAuditContext audit) {
        String url = text(node, "url");
        if (url.isBlank() || !audit.allowedExternalUrls().contains(url)) {
            return null;
        }
        return Action.openSource(url, label);
    }

    private boolean isAllowedPath(String path, CatalogSnapshot catalog) {
        if (STATIC_ROUTES.contains(path)) {
            return true;
        }
        if (path.startsWith("/artifacts/")) {
            return catalog.artifactsBySlug().containsKey(path.substring("/artifacts/".length()));
        }
        if (path.startsWith("/articles/")) {
            return catalog.articlesBySlug().containsKey(path.substring("/articles/".length()));
        }
        if (path.startsWith("/exhibits/")) {
            return catalog.exhibitsBySlug().containsKey(path.substring("/exhibits/".length()));
        }
        return false;
    }

    private static List<String> extractFollowUps(JsonNode meta) {
        if (meta == null || !meta.has("followUps") || !meta.get("followUps").isArray()) {
            return List.of();
        }
        List<String> list = new ArrayList<>();
        for (JsonNode n : meta.get("followUps")) {
            if (!n.isTextual() || list.size() >= 3) continue;
            String q = n.asText("").trim();
            if (!q.isBlank() && q.length() <= 80 && !list.contains(q)) {
                list.add(q);
            }
        }
        return list;
    }

    private static String extractBoundaryNote(JsonNode meta, List<Citation> citations) {
        if (meta != null && meta.has("boundaryNote") && meta.get("boundaryNote").isTextual()) {
            String note = meta.get("boundaryNote").asText("").trim();
            if (!note.isBlank()) {
                return note.length() > 260 ? note.substring(0, 260) : note;
            }
        }
        for (Citation c : citations) {
            if (c.boundaryNote() != null && !c.boundaryNote().isBlank()) {
                return c.boundaryNote();
            }
        }
        return "";
    }

    private static Citation toCitation(CitationMeta cm, boolean english) {
        return new Citation(
                cm.id(),
                english ? cm.titleEn() : cm.titleZh(),
                cm.revision(),
                cm.internalPath(),
                cm.publicSourceUrl(),
                cm.boundaryNote());
    }

    private static String actionKey(Action a) {
        return String.join("|",
                String.valueOf(a.type()),
                String.valueOf(a.exhibitSlug()),
                String.valueOf(a.part()),
                String.valueOf(a.view()),
                String.valueOf(a.mode()),
                String.valueOf(a.path()),
                String.valueOf(a.stop()),
                String.valueOf(a.url()));
    }

    private static String nullableEnum(String val, Set<String> allowed) {
        if (val == null || val.isBlank()) return null;
        String lower = val.toLowerCase();
        return allowed.contains(lower) ? lower : null;
    }

    private static String text(JsonNode node, String field) {
        if (node == null || !node.has(field) || node.get(field).isNull()) return "";
        return node.get(field).asText("").trim();
    }

    public record ValidationResult(
            boolean accepted,
            String rejectionReason,
            String text,
            List<Citation> citations,
            List<Action> actions,
            List<String> followUps,
            String boundaryNote) {
        static ValidationResult rejected(String reason) {
            return new ValidationResult(false, reason, "", List.of(), List.of(), List.of(), "");
        }
    }
}
