package com.heluo.museum.guide;

import com.heluo.museum.guide.GuideKnowledgeService.ArticleItem;
import com.heluo.museum.guide.GuideKnowledgeService.ArtifactItem;
import com.heluo.museum.guide.GuideKnowledgeService.CatalogSnapshot;
import com.heluo.museum.guide.GuideKnowledgeService.ExhibitItem;
import com.heluo.museum.guide.GuideKnowledgeService.ProductItem;
import com.heluo.museum.guide.GuideKnowledgeService.SearchHit;
import com.heluo.museum.guide.GuideModels.Action;
import com.heluo.museum.guide.GuideModels.ChatRequest;
import com.heluo.museum.guide.GuideModels.ChatResponse;
import com.heluo.museum.guide.GuideModels.Citation;
import com.heluo.museum.guide.GuideModels.PageContext;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/**
 * Layer-3 deterministic fallback engine.
 * Never throws away retrieved museum data to emit an empty error; always responds with
 * readable grounded museum summaries, verified actions, and honest `mode="deterministic"`.
 */
@Component
public class GuideDeterministicFallback {
    private static final Pattern APPOINTMENT_HINT = Pattern.compile(
            "预约|时段|名额|明天|后天|哪天|几个人|开放时间|入馆|book|slot|appointment|visit|ticket|available",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern SHOP_HINT = Pattern.compile(
            "文创|商品|周边|丝巾|茶杯|笔记本|商城|买|购买|库存|shop|merch|souvenir|product|store",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern PEOPLE_NUM = Pattern.compile("(\\d{1,3})\\s*(?:个人|位|人|visitors?|people)");
    private static final Pattern ISO_DATE = Pattern.compile("\\b(20\\d{2}-\\d{2}-\\d{2})\\b");

    private final GuideKnowledgeService knowledge;
    private final GuideToolExecutor toolExecutor;

    public GuideDeterministicFallback(GuideKnowledgeService knowledge, GuideToolExecutor toolExecutor) {
        this.knowledge = knowledge;
        this.toolExecutor = toolExecutor;
    }

    public ChatResponse paused(String requestId, String locale) {
        boolean english = GuidePromptBuilder.isEnglish(locale);
        String text = english
                ? "Luosheng AI guidance is temporarily paused for maintenance. You can still browse all exhibits, 3D showcases, appointments, and shop items directly."
                : "洛笙 AI 讲解目前处于运维暂停状态，馆内藏品、3D 展厅、预约与文创浏览均不受影响。";
        List<Action> actions = List.of(
                Action.navigate("/explore", null, english ? "Explore Collection" : "浏览全部馆藏"),
                Action.navigate("/exhibits", null, english ? "Open 3D Hall" : "前往 3D 展厅"));
        return new ChatResponse(requestId, text, List.of(), actions, List.of(),
                english ? "Paused by museum operations." : "由运维暂停文件临时关闭。", "deterministic", true);
    }

    public ChatResponse respond(String requestId, ChatRequest request, boolean degraded) {
        boolean english = GuidePromptBuilder.isEnglish(request.locale());
        String msg = request.message() == null ? "" : request.message().trim();
        PageContext ctx = request.context();

        // 1. Appointment intent
        if (APPOINTMENT_HINT.matcher(msg).find() || (ctx != null && "appointment".equalsIgnoreCase(ctx.route()))) {
            return buildAppointmentFallback(requestId, msg, english, degraded);
        }

        // 2. Shop intent
        if (SHOP_HINT.matcher(msg).find() || (ctx != null && "shop".equalsIgnoreCase(ctx.route()))) {
            return buildShopFallback(requestId, english, degraded);
        }

        // 3. Ding exhibit / artifact context (Tier-1 evidence cards first)
        if (isDingContext(ctx, msg)) {
            return buildDingFallback(requestId, msg, english, degraded);
        }

        // 4. Other artifact detail context
        if (ctx != null && ctx.artifactSlug() != null && !ctx.artifactSlug().isBlank()) {
            var opt = knowledge.findArtifact(ctx.artifactSlug());
            if (opt.isPresent()) {
                return buildArtifactFallback(requestId, opt.get(), english, degraded);
            }
        }

        // 5. Article detail context
        if (ctx != null && ctx.articleSlug() != null && !ctx.articleSlug().isBlank()) {
            var opt = knowledge.findArticle(ctx.articleSlug());
            if (opt.isPresent()) {
                return buildArticleFallback(requestId, opt.get(), english, degraded);
            }
        }

        // 6. Keyword search across museum catalog
        List<SearchHit> hits = knowledge.searchCatalog(extractKeyword(msg));
        if (!hits.isEmpty()) {
            return buildSearchFallback(requestId, hits, english, degraded);
        }

        // 7. Museum overview fallback
        return buildOverviewFallback(requestId, english, degraded);
    }

    private ChatResponse buildAppointmentFallback(String requestId, String msg, boolean english, boolean degraded) {
        LocalDate today = toolExecutor.today();
        LocalDate windowEnd = toolExecutor.openWindowEnd(today);
        List<Citation> citations = List.of(new Citation(
                "APPOINTMENT:PUBLIC_SLOTS",
                english ? "Heluo Museum Public Appointment Slots (Live)" : "河洛数字博物馆公开预约时段（实时）",
                "live", "/appointment", null,
                english ? "Open window is 365 days from today; 1-30 visitors per booking."
                        : "开放今天起未来 365 天内的公开时段（周一闭馆），单笔预约限 1 至 30 人。"));

        Matcher pm = PEOPLE_NUM.matcher(msg);
        if (pm.find()) {
            int count = Integer.parseInt(pm.group(1));
            if (count < 1 || count > 30) {
                String text = english
                        ? "Public online appointments support 1 to 30 visitors per booking. For larger groups (" + count + " visitors), please split into multiple bookings or contact the museum."
                        : "单笔公开预约人数仅支持 1 至 30 人；" + count + " 人团队请分笔预约或联系馆方安排团体接待。";
                return new ChatResponse(requestId, text, citations,
                        List.of(Action.navigate("/appointment", null, english ? "Go to Appointments" : "前往预约页面")),
                        List.of(), citations.get(0).boundaryNote(), "deterministic", degraded);
            }
        }

        LocalDate target = null;
        Matcher dm = ISO_DATE.matcher(msg);
        if (dm.find()) {
            try {
                target = LocalDate.parse(dm.group(1));
            } catch (Exception ignored) {}
        } else if (msg.contains("明天") || msg.toLowerCase(Locale.ROOT).contains("tomorrow")) {
            target = today.plusDays(1);
        } else if (msg.contains("后天")) {
            target = today.plusDays(2);
        }

        if (target != null && (target.isBefore(today) || target.isAfter(windowEnd))) {
            String text = english
                    ? "Public appointments are only open for the next 365 days (" + today + " to " + windowEnd + "). " + target + " is currently outside the open booking window."
                    : "公开预约目前仅开放今天起未来 365 天（" + today + " 至 " + windowEnd + "），" + target + " 暂未进入开放窗口。";
            return new ChatResponse(requestId, text, citations,
                    List.of(Action.navigate("/appointment", null, english ? "View Open Dates" : "查看可约日期")),
                    List.of(), citations.get(0).boundaryNote(), "deterministic", degraded);
        }

        LocalDate from = target != null ? target : today;
        LocalDate to = target != null ? target : today.plusDays(2);
        List<GuideToolExecutor.PublicSlot> slots = toolExecutor.queryPublicSlots(from, to);

        StringBuilder sb = new StringBuilder();
        if (slots.isEmpty()) {
            sb.append(english
                    ? "No open appointment slots with remaining capacity were found between " + from + " and " + to + ". You can check other dates within the 365-day window on the appointment page."
                    : from + " 至 " + to + " 暂未查到有余量的公开时段，你可以前往预约页查看未来 365 天内其他日期。");
        } else {
            sb.append(english ? "Here are the live open appointment slots (" + from + " to " + to + "):\n"
                    : "为你查到 " + from + " 至 " + to + " 的实时可约时段：\n");
            int limit = Math.min(slots.size(), 5);
            for (int i = 0; i < limit; i++) {
                var s = slots.get(i);
                sb.append("• ").append(s.visitDate()).append(' ')
                        .append(s.startTime().toString().substring(0, 5)).append('-')
                        .append(s.endTime().toString().substring(0, 5))
                        .append(english ? " (" + s.remainingPeople() + " spots left)\n"
                                : "（余 " + s.remainingPeople() + " 人）\n");
            }
            sb.append(english ? "Click below to submit your reservation directly."
                    : "洛笙不代为提交预约，请点击下方按钮前往预约页自行确认。");
        }
        Map<String, String> q = target != null ? Map.of("date", target.toString()) : null;
        return new ChatResponse(requestId, sb.toString().strip(), citations,
                List.of(Action.navigate("/appointment", q, english ? "Go to Appointments" : "前往预约页面")),
                english ? List.of("What artifacts are in the 3D hall?", "Show museum shop items")
                        : List.of("3D 展厅有哪些展品？", "看看河洛文创有什么商品"),
                citations.get(0).boundaryNote(), "deterministic", degraded);
    }

    private ChatResponse buildShopFallback(String requestId, boolean english, boolean degraded) {
        CatalogSnapshot catalog = knowledge.catalog();
        List<ProductItem> products = catalog.products();
        StringBuilder sb = new StringBuilder();
        List<Citation> citations = new ArrayList<>();
        if (products.isEmpty()) {
            sb.append(english ? "There are currently no published products in the museum shop."
                    : "文创商城目前暂无在售商品。");
        } else {
            sb.append(english ? "Published items currently in the Heluo Museum Shop:\n"
                    : "河洛文创商城当前在售商品如下：\n");
            for (ProductItem p : products) {
                String name = english && !p.nameEn().isBlank() ? p.nameEn() : p.name();
                String summary = english && !p.summaryEn().isBlank() ? p.summaryEn() : p.summary();
                sb.append("• ").append(name).append("（¥").append(p.price())
                        .append(english ? ", stock " : "，可售库存 ").append(p.availableStock()).append("）：")
                        .append(summary).append('\n');
                citations.add(new Citation("PRODUCT:" + p.slug(), name, "live", "/shop", null, ""));
            }
        }
        return new ChatResponse(requestId, sb.toString().strip(), citations,
                List.of(Action.navigate("/shop", null, english ? "Open Museum Shop" : "前往河洛文创")),
                english ? List.of("Check upcoming appointment slots", "Tell me about the Bronze Ding")
                        : List.of("查一下近期预约时段", "介绍一下河洛青铜鼎"),
                english ? "Orders must be placed directly by visitors in the shop." : "洛笙不代为下单支付，请前往文创页面自行选购。",
                "deterministic", degraded);
    }

    private ChatResponse buildDingFallback(String requestId, String msg, boolean english, boolean degraded) {
        String exhibitSlug = GuideKnowledgeService.DING_EXHIBIT_SLUG;
        String targetLocale = english ? "en-US" : "zh-CN";
        GuideEvidenceReader.SearchResult search = knowledge.searchEvidence(exhibitSlug, targetLocale, msg);
        List<GuideEvidenceReader.Evidence> cards = search.evidence();
        if (search.disputed()) {
            String text = english
                    ? "Existing verified evidence cards contain conflicting claims for this fact. Following museum editorial rules, I will not guess or pick a side."
                    : "现有证据卡中该项事实存在冲突记录，按馆内审校原则暂不替你下结论，建议查阅原始馆藏档案。";
            return new ChatResponse(requestId, text, List.of(), List.of(), List.of(),
                    "ADR-006 conflict guard.", "deterministic", degraded);
        }
        if (cards.isEmpty()) {
            List<GuideEvidenceReader.Evidence> all = knowledge.evidenceCards(exhibitSlug, targetLocale);
            String lowerMsg = msg.toLowerCase(Locale.ROOT);
            if (lowerMsg.contains("武丁") || lowerMsg.contains("时期") || lowerMsg.contains("朝代") || lowerMsg.contains("年代") || lowerMsg.contains("铸造")
                    || lowerMsg.contains("dynasty") || lowerMsg.contains("period") || lowerMsg.contains("wu ding")) {
                cards = all.stream().filter(c -> "LS-DING-PERIOD".equals(c.card().id()) || "LS-DING-SOURCE".equals(c.card().id())).toList();
            }
            if (cards.isEmpty()) {
                cards = all.stream().limit(2).toList();
            }
        }

        List<Citation> citations = new ArrayList<>();
        List<Action> actions = new ArrayList<>();
        StringBuilder sb = new StringBuilder();
        String boundary = "";

        if (!cards.isEmpty()) {
            for (GuideEvidenceReader.Evidence e : cards) {
                if (!sb.isEmpty()) sb.append("\n\n");
                sb.append(e.spokenText());
                if (boundary.isBlank() && !e.boundaryText().isBlank()) {
                    boundary = e.boundaryText();
                }
                String url = e.publicSource() == null ? null : e.publicSource().toString();
                citations.add(new Citation(e.card().id(),
                        (english ? "Verified Card · " : "已签核证据 · ") + e.card().id(),
                        "v" + e.card().revision(), "/exhibits/" + exhibitSlug, url, e.boundaryText()));
                if (url != null && actions.stream().noneMatch(a -> "open_source".equals(a.type()))) {
                    actions.add(Action.openSource(url, english ? "View Cleveland Art Record" : "查看克利夫兰馆藏档案"));
                }
            }
        } else {
            knowledge.findArtifact(GuideKnowledgeService.DING_ARTIFACT_SLUG).ifPresent(a -> {
                sb.append(english && !a.summaryEn().isBlank() ? a.summaryEn() : a.summary());
                citations.add(new Citation("ARTIFACT:" + a.slug(), english && !a.titleEn().isBlank() ? a.titleEn() : a.title(),
                        "live", "/artifacts/" + a.slug(), null, ""));
            });
        }

        if (knowledge.findExhibit(exhibitSlug).isPresent()) {
            String lower = msg.toLowerCase(Locale.ROOT);
            if (lower.contains("足") || lower.contains("腿") || lower.contains("feet") || lower.contains("leg")) {
                actions.add(0, Action.viewerFocus(exhibitSlug, "feet", "back", "solid",
                        english ? "Inspect 3 legs in 3D (Back View)" : "在 3D 展柜切到背面看三足"));
            } else if (lower.contains("耳") || lower.contains("把手") || lower.contains("ear") || lower.contains("handle")) {
                actions.add(0, Action.viewerFocus(exhibitSlug, "ear", "top", "solid",
                        english ? "Inspect ears in 3D (Top View)" : "在 3D 展柜俯视看双耳"));
            } else if (lower.contains("点云") || lower.contains("point")) {
                actions.add(0, Action.viewerMode(exhibitSlug, "points",
                        english ? "Switch to Point Cloud Mode" : "切换 3D 点云模式"));
            } else {
                actions.add(0, Action.viewerFocus(exhibitSlug, "motif", "front", "solid",
                        english ? "Inspect Ding Motif in 3D" : "在 3D 展柜细看器腹纹样"));
            }
        }

        if (sb.isEmpty()) {
            sb.append(english
                    ? "The Heluo Bronze Ding is a digital reproduction based on Cleveland Museum of Art 1962.281 (CC0)."
                    : "河洛青铜鼎为项目数字重制展品，基础网格参考克利夫兰艺术博物馆 1962.281 CC0 模型。");
        }

        return new ChatResponse(requestId, sb.toString().strip(), citations, actions,
                english ? List.of("Why are only two legs visible from the side?", "Can the top handles be used for lifting?")
                        : List.of("侧面看为什么只有两条腿？", "顶上那对立耳能用来提吗？"),
                boundary, "deterministic", degraded);
    }

    private ChatResponse buildArtifactFallback(String requestId, ArtifactItem a, boolean english, boolean degraded) {
        String title = english && !a.titleEn().isBlank() ? a.titleEn() : a.title();
        String summary = english && !a.summaryEn().isBlank() ? a.summaryEn() : a.summary();
        String categoryLabel = english ? englishCategory(a.categoryCode(), a.categoryName()) : a.categoryName();
        String excerpt = a.content().length() > 260 ? a.content().substring(0, 260) + "…" : a.content();
        String text = english
                ? title + " (" + categoryLabel + "): " + summary
                : title + "（" + categoryLabel + "）：" + summary + "\n\n" + excerpt;
        List<Citation> citations = List.of(new Citation("ARTIFACT:" + a.slug(), title, "live", "/artifacts/" + a.slug(), null, ""));
        List<Action> actions = new ArrayList<>();
        if (a.exhibitSlug() != null) {
            actions.add(Action.viewerFocus(a.exhibitSlug(), "motif", "front", "solid",
                    english ? "Open in 3D Showcase" : "前往 3D 展柜观察"));
        }
        actions.add(Action.navigate("/explore", null, english ? "Browse More Artifacts" : "浏览更多馆藏"));
        return new ChatResponse(requestId, text, citations, actions,
                english ? List.of("Compare with the Bronze Ding", "Check appointment slots")
                        : List.of("和河洛青铜鼎有什么不同？", "查看近期预约时段"),
                english ? "Direct excerpt from live museum archive." : "以上内容直接摘自馆藏公开档案。",
                "deterministic", degraded);
    }

    private ChatResponse buildArticleFallback(String requestId, ArticleItem a, boolean english, boolean degraded) {
        String title = english && !a.titleEn().isBlank() ? a.titleEn() : a.title();
        String summary = english && !a.summaryEn().isBlank() ? a.summaryEn() : a.summary();
        String text = title + "：" + summary;
        List<Citation> citations = List.of(new Citation("ARTICLE:" + a.slug(), title, "live", "/articles/" + a.slug(), null, ""));
        return new ChatResponse(requestId, text, citations,
                List.of(Action.navigate("/explore", null, english ? "Explore Collection" : "浏览全部馆藏")),
                List.of(), "", "deterministic", degraded);
    }

    private ChatResponse buildSearchFallback(String requestId, List<SearchHit> hits, boolean english, boolean degraded) {
        StringBuilder sb = new StringBuilder();
        sb.append(english ? "I found these matching museum entries:\n" : "在馆内公开资料中为你找到以下相关内容：\n");
        List<Citation> citations = new ArrayList<>();
        List<Action> actions = new ArrayList<>();
        int limit = Math.min(hits.size(), 3);
        for (int i = 0; i < limit; i++) {
            SearchHit h = hits.get(i);
            String title = english && !h.titleEn().isBlank() ? h.titleEn() : h.title();
            String summary = english && !h.summaryEn().isBlank() ? h.summaryEn() : h.summary();
            sb.append("• ").append(title).append("：").append(summary).append('\n');
            citations.add(new Citation(h.type().toUpperCase(Locale.ROOT) + ":" + h.slug(), title, "live", h.path(), null, ""));
            actions.add(Action.navigate(h.path(), null, (english ? "View " : "查看") + title));
        }
        return new ChatResponse(requestId, sb.toString().strip(), citations, actions, List.of(), "", "deterministic", degraded);
    }

    private ChatResponse buildOverviewFallback(String requestId, boolean english, boolean degraded) {
        CatalogSnapshot catalog = knowledge.catalog();
        String text = english
                ? "Welcome to Heluo Digital Museum! Currently published: " + catalog.artifacts().size()
                + " artifacts, " + catalog.articles().size() + " cultural articles, "
                + catalog.exhibits().size() + " 3D showcase exhibit, and " + catalog.products().size()
                + " shop items. Ask me about any exhibit, 3D observation details, or upcoming appointment slots."
                : "欢迎来到河洛数字博物馆！当前馆内公开呈现 " + catalog.artifacts().size() + " 件藏品、"
                + catalog.articles().size() + " 篇文化专题、" + catalog.exhibits().size() + " 件 3D 展项与 "
                + catalog.products().size() + " 件河洛文创。你可以向我询问任意展品细节、3D 观察方法或未来 365 天预约时段。";
        List<Action> actions = List.of(
                Action.navigate("/exhibits/" + GuideKnowledgeService.DING_EXHIBIT_SLUG, null,
                        english ? "Open Bronze Ding 3D" : "进入青铜鼎 3D 展柜"),
                Action.navigate("/explore", null, english ? "Explore Collection" : "探索全部馆藏"),
                Action.navigate("/appointment", null, english ? "Book a Visit" : "预约入馆"));
        return new ChatResponse(requestId, text, List.of(), actions,
                english ? List.of("Tell me about the Bronze Ding", "Are there appointment slots tomorrow?")
                        : List.of("带我看看河洛青铜鼎", "明天有哪些可约时段？"),
                "", "deterministic", degraded);
    }

    private static boolean isDingContext(PageContext ctx, String msg) {
        if (ctx != null && (GuideKnowledgeService.DING_ARTIFACT_SLUG.equals(ctx.artifactSlug())
                || GuideKnowledgeService.DING_EXHIBIT_SLUG.equals(ctx.exhibitSlug()))) {
            return true;
        }
        String lower = msg.toLowerCase(Locale.ROOT);
        return lower.contains("青铜鼎") || lower.contains("鼎耳") || lower.contains("三足")
                || lower.contains("两条腿") || lower.contains("bronze ding") || lower.contains("tripod");
    }

    private static String englishCategory(String code, String fallback) {
        if (code == null) return fallback;
        return switch (code.toUpperCase(Locale.ROOT)) {
            case "BRONZE" -> "Bronze Ritual Vessels";
            case "JADE" -> "Jade Imagery";
            case "RIVER" -> "Heluo Stories";
            default -> fallback;
        };
    }

    private static String extractKeyword(String msg) {
        String cleaned = msg.replaceAll("[？?！!。，,、\\s]+", " ").trim();
        for (String term : List.of("玉璧", "青铜爵", "彩陶", "水纹", "石板", "水鸟", "青铜鼎", "河图", "丝巾", "茶杯", "笔记本", "导览",
                "jade", "jue", "pottery", "stone", "bird", "ding", "scarf", "teacup", "notebook")) {
            if (cleaned.toLowerCase(Locale.ROOT).contains(term)) {
                return term;
            }
        }
        return cleaned.length() > 12 ? cleaned.substring(0, 12) : cleaned;
    }
}
