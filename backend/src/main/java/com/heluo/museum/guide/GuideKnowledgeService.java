package com.heluo.museum.guide;

import java.nio.file.Path;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Unified museum knowledge provider combining:
 * - Tier-1 signed & verified evidence cards (SHA-256 + min-version + ADR-006 conflict blocking)
 * - Tier-2 live public museum database content (artifacts, articles, 3D exhibits, products) with 60s TTL cache
 */
@Service
public class GuideKnowledgeService {
    static final String DING_ARTIFACT_SLUG = "heluo-bronze-ding";
    static final String DING_EXHIBIT_SLUG = "heluo-bronze-ding-3d";
    private static final Duration CACHE_TTL = Duration.ofSeconds(60);

    private final JdbcTemplate jdbc;
    private final Clock clock;
    private final GuideEvidenceVisibility visibility;
    private final GuideEvidenceReader evidenceReader;
    private final GuideEvidenceReader englishEvidenceReader;

    private volatile CachedCatalog cachedCatalog;

    @Autowired
    public GuideKnowledgeService(JdbcTemplate jdbc, Clock clock, GuideProperties properties) {
        this.jdbc = jdbc;
        this.clock = clock;
        this.visibility = new GuideEvidenceVisibility(jdbc, clock);
        if (properties.hasEvidencePackConfig()) {
            Path packPath = Path.of(properties.getPackPath());
            Path minVerPath = Path.of(properties.getMinimumVersionPath());
            Path digestPath = Path.of(properties.getApprovedDigestPath());
            this.evidenceReader = new GuideEvidenceReader(
                    new GuideEvidenceFileSource(packPath, minVerPath, digestPath),
                    visibility);
            this.englishEvidenceReader = resolveCompanionEnglishReader(packPath, minVerPath, digestPath, visibility);
        } else {
            this.evidenceReader = null;
            this.englishEvidenceReader = null;
        }
    }

    // Package-private constructor for unit tests with custom EvidenceReader
    GuideKnowledgeService(JdbcTemplate jdbc, Clock clock, GuideEvidenceReader evidenceReader) {
        this.jdbc = jdbc;
        this.clock = clock;
        this.visibility = new GuideEvidenceVisibility(jdbc, clock);
        this.evidenceReader = evidenceReader;
        this.englishEvidenceReader = null;
    }

    private static GuideEvidenceReader resolveCompanionEnglishReader(
            Path zhPackPath, Path minVerPath, Path zhDigestPath, GuideEvidenceVisibility visibility) {
        String packFileName = zhPackPath.getFileName() == null ? "" : zhPackPath.getFileName().toString();
        String digestFileName = zhDigestPath.getFileName() == null ? "" : zhDigestPath.getFileName().toString();
        if (!packFileName.endsWith(".zh-CN.json") || !digestFileName.endsWith(".zh-CN.sha256")) {
            return null;
        }
        Path enPack = zhPackPath.resolveSibling(packFileName.replace(".zh-CN.json", ".en-US.json"));
        Path enDigest = zhDigestPath.resolveSibling(digestFileName.replace(".zh-CN.sha256", ".en-US.sha256"));
        if (!java.nio.file.Files.isRegularFile(enPack) || !java.nio.file.Files.isRegularFile(enDigest)) {
            return null;
        }
        return new GuideEvidenceReader(new GuideEvidenceFileSource(enPack, minVerPath, enDigest), visibility);
    }

    public CatalogSnapshot catalog() {
        Instant now = clock.instant();
        CachedCatalog current = cachedCatalog;
        if (current != null && now.isBefore(current.expiresAt())) {
            return current.snapshot();
        }
        synchronized (this) {
            current = cachedCatalog;
            if (current != null && now.isBefore(current.expiresAt())) {
                return current.snapshot();
            }
            CatalogSnapshot fresh = loadFromDatabase();
            cachedCatalog = new CachedCatalog(fresh, now.plus(CACHE_TTL));
            return fresh;
        }
    }

    public void invalidateCache() {
        cachedCatalog = null;
    }

    public Optional<ArtifactItem> findArtifact(String slug) {
        if (slug == null || slug.isBlank()) return Optional.empty();
        return Optional.ofNullable(catalog().artifactsBySlug().get(slug.trim()));
    }

    public Optional<ArticleItem> findArticle(String slug) {
        if (slug == null || slug.isBlank()) return Optional.empty();
        return Optional.ofNullable(catalog().articlesBySlug().get(slug.trim()));
    }

    public Optional<ExhibitItem> findExhibit(String slug) {
        if (slug == null || slug.isBlank()) return Optional.empty();
        return Optional.ofNullable(catalog().exhibitsBySlug().get(slug.trim()));
    }

    public Optional<ProductItem> findProduct(String slug) {
        if (slug == null || slug.isBlank()) return Optional.empty();
        return Optional.ofNullable(catalog().productsBySlug().get(slug.trim()));
    }

    public Optional<ExhibitItem> findExhibitByArtifact(String artifactSlug) {
        if (artifactSlug == null || artifactSlug.isBlank()) return Optional.empty();
        return catalog().exhibits().stream()
                .filter(item -> artifactSlug.trim().equals(item.artifactSlug()))
                .findFirst();
    }

    /**
     * Tier-1 evidence cards are read fresh on every call so SHA-256 verification,
     * release version anti-rollback, withdrawal, and ADR-006 conflict checks take immediate effect.
     */
    public List<GuideEvidenceReader.Evidence> evidenceCards(String exhibitSlug) {
        return evidenceCards(exhibitSlug, "zh-CN");
    }

    public List<GuideEvidenceReader.Evidence> evidenceCards(String exhibitSlug, String locale) {
        if (exhibitSlug == null || exhibitSlug.isBlank()) {
            return List.of();
        }
        boolean english = locale != null && locale.toLowerCase(Locale.ROOT).startsWith("en");
        if (english && englishEvidenceReader != null) {
            return englishEvidenceReader.listPublished(exhibitSlug.trim(), "en-US");
        }
        if (evidenceReader == null) {
            return List.of();
        }
        return evidenceReader.listPublished(exhibitSlug.trim(), "zh-CN");
    }

    public GuideEvidenceReader.SearchResult searchEvidence(String exhibitSlug, String query) {
        return searchEvidence(exhibitSlug, "zh-CN", query);
    }

    public GuideEvidenceReader.SearchResult searchEvidence(String exhibitSlug, String locale, String query) {
        if (exhibitSlug == null || exhibitSlug.isBlank() || query == null || query.isBlank()) {
            return new GuideEvidenceReader.SearchResult(List.of(), false);
        }
        boolean english = locale != null && locale.toLowerCase(Locale.ROOT).startsWith("en");
        if (english && englishEvidenceReader != null) {
            return englishEvidenceReader.searchCandidates(exhibitSlug.trim(), "en-US", query);
        }
        if (evidenceReader == null) {
            return new GuideEvidenceReader.SearchResult(List.of(), false);
        }
        return evidenceReader.searchCandidates(exhibitSlug.trim(), "zh-CN", query);
    }

    public List<SearchHit> searchCatalog(String keyword) {
        if (keyword == null || keyword.isBlank()) {
            return List.of();
        }
        String query = keyword.trim().toLowerCase(Locale.ROOT);
        List<String> tokens = splitTokens(query);
        CatalogSnapshot snap = catalog();
        List<ScoredHit> hits = new ArrayList<>();

        for (ArtifactItem a : snap.artifacts()) {
            int score = matchScore(query, tokens, a.title(), a.titleEn(), a.summary(), a.summaryEn(),
                    a.categoryName(), a.period(), a.material(), a.content());
            if (score > 0) {
                hits.add(new ScoredHit(new SearchHit("artifact", a.slug(), a.title(), a.titleEn(),
                        a.summary(), a.summaryEn(), "/artifacts/" + a.slug(), a.exhibitSlug()), score));
            }
        }
        for (ArticleItem a : snap.articles()) {
            int score = matchScore(query, tokens, a.title(), a.titleEn(), a.summary(), a.summaryEn(),
                    a.categoryName(), a.authorDisplay(), a.content());
            if (score > 0) {
                hits.add(new ScoredHit(new SearchHit("article", a.slug(), a.title(), a.titleEn(),
                        a.summary(), a.summaryEn(), "/articles/" + a.slug(), null), score));
            }
        }
        for (ExhibitItem e : snap.exhibits()) {
            int score = matchScore(query, tokens, e.title(), e.titleEn(), e.summary(), e.summaryEn(), e.description(),
                    e.artifactTitle(), e.displayNo());
            if (score > 0) {
                hits.add(new ScoredHit(new SearchHit("exhibit", e.slug(), e.title(), e.titleEn(),
                        e.summary(), e.summaryEn(), "/exhibits/" + e.slug(), e.slug()), score));
            }
        }
        for (ProductItem p : snap.products()) {
            int score = matchScore(query, tokens, p.name(), p.nameEn(), p.summary(), p.summaryEn(), p.description(), p.sku());
            if (score > 0) {
                hits.add(new ScoredHit(new SearchHit("product", p.slug(), p.name(), p.nameEn(),
                        p.summary(), p.summaryEn(), "/shop", null), score));
            }
        }
        return hits.stream()
                .sorted(Comparator.comparingInt(ScoredHit::score).reversed()
                        .thenComparing(h -> h.hit().slug()))
                .limit(8)
                .map(ScoredHit::hit)
                .toList();
    }

    private CatalogSnapshot loadFromDatabase() {
        List<ExhibitItem> exhibits = jdbc.query("""
                select e.slug, e.title, e.title_en, e.summary, e.summary_en, e.description, e.display_no,
                       e.source_credit, e.source_url, e.license_label, e.collection_location,
                       a.slug as artifact_slug, a.title as artifact_title
                from exhibits_3d e
                join artifacts a on a.id = e.artifact_id
                join categories c on c.id = a.category_id
                where e.status = 'PUBLISHED' and e.deleted_at is null
                  and a.status = 'PUBLISHED' and a.deleted_at is null
                  and c.enabled = 1
                order by e.published_at desc, e.id desc
                """, (rs, rowNum) -> new ExhibitItem(
                rs.getString("slug"),
                rs.getString("title"),
                empty(rs.getString("title_en")),
                empty(rs.getString("summary")),
                empty(rs.getString("summary_en")),
                empty(rs.getString("description")),
                empty(rs.getString("display_no")),
                empty(rs.getString("source_credit")),
                empty(rs.getString("source_url")),
                empty(rs.getString("license_label")),
                empty(rs.getString("collection_location")),
                rs.getString("artifact_slug"),
                rs.getString("artifact_title")));

        Map<String, String> exhibitByArtifact = new HashMap<>();
        for (ExhibitItem exhibit : exhibits) {
            exhibitByArtifact.putIfAbsent(exhibit.artifactSlug(), exhibit.slug());
        }

        List<ArtifactItem> artifacts = jdbc.query("""
                select a.slug, a.title, a.title_en, a.summary, a.summary_en, a.content,
                       a.period, a.material, a.dimensions, a.collection_location,
                       c.code as category_code, c.name as category_name
                from artifacts a
                join categories c on c.id = a.category_id
                where a.status = 'PUBLISHED' and a.deleted_at is null and c.enabled = 1
                order by a.published_at desc, a.id desc
                """, (rs, rowNum) -> {
            String slug = rs.getString("slug");
            return new ArtifactItem(
                    slug,
                    rs.getString("title"),
                    empty(rs.getString("title_en")),
                    rs.getString("category_code"),
                    rs.getString("category_name"),
                    empty(rs.getString("period")),
                    empty(rs.getString("material")),
                    empty(rs.getString("dimensions")),
                    empty(rs.getString("collection_location")),
                    empty(rs.getString("summary")),
                    empty(rs.getString("summary_en")),
                    empty(rs.getString("content")),
                    exhibitByArtifact.get(slug));
        });

        List<ArticleItem> articles = jdbc.query("""
                select a.slug, a.title, a.title_en, a.summary, a.summary_en, a.content, a.author_display,
                       c.code as category_code, c.name as category_name
                from articles a
                join categories c on c.id = a.category_id
                where a.status = 'PUBLISHED' and a.deleted_at is null and c.enabled = 1
                order by a.published_at desc, a.id desc
                """, (rs, rowNum) -> new ArticleItem(
                rs.getString("slug"),
                rs.getString("title"),
                empty(rs.getString("title_en")),
                rs.getString("category_code"),
                rs.getString("category_name"),
                empty(rs.getString("summary")),
                empty(rs.getString("summary_en")),
                empty(rs.getString("content")),
                empty(rs.getString("author_display"))));

        List<ProductItem> products = jdbc.query("""
                select sku, slug, name, name_en, summary, summary_en, description, price, stock_quantity, locked_stock
                from products
                where status = 'PUBLISHED' and deleted_at is null
                order by published_at desc, id desc
                """, (rs, rowNum) -> new ProductItem(
                rs.getString("sku"),
                rs.getString("slug"),
                rs.getString("name"),
                empty(rs.getString("name_en")),
                empty(rs.getString("summary")),
                empty(rs.getString("summary_en")),
                empty(rs.getString("description")),
                rs.getBigDecimal("price").toPlainString(),
                Math.max(0, rs.getInt("stock_quantity") - rs.getInt("locked_stock"))));

        return CatalogSnapshot.of(artifacts, articles, exhibits, products);
    }

    private static List<String> splitTokens(String query) {
        String[] raw = query.split("[\\s,，、；;？?！!。]+");
        List<String> tokens = new ArrayList<>();
        for (String t : raw) {
            if (!t.isBlank()) tokens.add(t);
        }
        if (tokens.size() == 1 && tokens.get(0).length() >= 4) {
            String[] clauses = tokens.get(0).split("[的了吗呢和与及跟或有在里中看查找帮我请一下什么哪些有关关于]+");
            for (String c : clauses) {
                if (c.length() >= 2 && !tokens.contains(c)) {
                    tokens.add(c);
                }
            }
        }
        return tokens;
    }

    private static int matchScore(String fullQuery, List<String> tokens, String title, String titleEn,
                                  String summary, String summaryEn, String... extra) {
        String t1 = lower(title);
        String t2 = lower(titleEn);
        String s1 = lower(summary);
        String s2 = lower(summaryEn);
        StringBuilder body = new StringBuilder();
        for (String e : extra) {
            if (e != null && !e.isBlank()) {
                body.append(' ').append(e.toLowerCase(Locale.ROOT));
            }
        }
        String rest = body.toString();

        int score = 0;
        if (t1.contains(fullQuery) || t2.contains(fullQuery)) score += 100;
        if (s1.contains(fullQuery) || s2.contains(fullQuery)) score += 45;
        if (rest.contains(fullQuery)) score += 20;

        if (score == 0 && tokens.size() > 1) {
            for (String token : tokens) {
                if (token.length() < 2) continue;
                if (t1.contains(token) || t2.contains(token)) score += 30;
                else if (s1.contains(token) || s2.contains(token)) score += 15;
                else if (rest.contains(token)) score += 8;
            }
        }
        return score;
    }

    private static String lower(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT);
    }

    private static String empty(String value) {
        return value == null ? "" : value;
    }

    private record CachedCatalog(CatalogSnapshot snapshot, Instant expiresAt) {}

    private record ScoredHit(SearchHit hit, int score) {}

    public record CatalogSnapshot(
            List<ArtifactItem> artifacts,
            List<ArticleItem> articles,
            List<ExhibitItem> exhibits,
            List<ProductItem> products,
            Map<String, ArtifactItem> artifactsBySlug,
            Map<String, ArticleItem> articlesBySlug,
            Map<String, ExhibitItem> exhibitsBySlug,
            Map<String, ProductItem> productsBySlug) {
        static CatalogSnapshot of(List<ArtifactItem> artifacts, List<ArticleItem> articles,
                                  List<ExhibitItem> exhibits, List<ProductItem> products) {
            Map<String, ArtifactItem> artifactMap = new HashMap<>();
            artifacts.forEach(item -> artifactMap.put(item.slug(), item));
            Map<String, ArticleItem> articleMap = new HashMap<>();
            articles.forEach(item -> articleMap.put(item.slug(), item));
            Map<String, ExhibitItem> exhibitMap = new HashMap<>();
            exhibits.forEach(item -> exhibitMap.put(item.slug(), item));
            Map<String, ProductItem> productMap = new HashMap<>();
            products.forEach(item -> productMap.put(item.slug(), item));
            return new CatalogSnapshot(
                    List.copyOf(artifacts),
                    List.copyOf(articles),
                    List.copyOf(exhibits),
                    List.copyOf(products),
                    Map.copyOf(artifactMap),
                    Map.copyOf(articleMap),
                    Map.copyOf(exhibitMap),
                    Map.copyOf(productMap));
        }
    }

    public record ArtifactItem(
            String slug, String title, String titleEn, String categoryCode, String categoryName,
            String period, String material, String dimensions, String collectionLocation,
            String summary, String summaryEn, String content, String exhibitSlug) {}

    public record ArticleItem(
            String slug, String title, String titleEn, String categoryCode, String categoryName,
            String summary, String summaryEn, String content, String authorDisplay) {}

    public record ExhibitItem(
            String slug, String title, String titleEn, String summary, String summaryEn,
            String description, String displayNo, String sourceCredit, String sourceUrl,
            String licenseLabel, String collectionLocation, String artifactSlug, String artifactTitle) {}

    public record ProductItem(
            String sku, String slug, String name, String nameEn, String summary, String summaryEn,
            String description, String price, int availableStock) {}

    public record SearchHit(
            String type, String slug, String title, String titleEn, String summary, String summaryEn,
            String path, String exhibitSlug) {}
}
