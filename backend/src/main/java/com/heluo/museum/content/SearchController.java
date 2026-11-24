package com.heluo.museum.content;

import com.heluo.museum.common.api.ApiResponse;
import com.heluo.museum.common.error.ContentPage;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/search")
public class SearchController {
    private static final Set<String> TYPES = Set.of("all", "museum", "artifact", "article", "exhibit", "product");
    private final JdbcTemplate jdbc;

    SearchController(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @GetMapping
    public ApiResponse<ContentPage<Result>> search(@RequestParam String keyword,
            @RequestParam(defaultValue = "all") String type, @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        if (!TYPES.contains(type)) throw new IllegalArgumentException("不支持的搜索类型");
        var paging = ArtifactController.PageRequest.of(page, size);
        var query = ContentSearch.query(keyword);
        List<Scored> results = new ArrayList<>();
        if (type.equals("all") || type.equals("museum") || type.equals("artifact")) {
            add(results, query, "artifact", "/artifacts/", """
                select a.slug,a.title,a.summary,a.title_en,a.summary_en,a.cover_image_url,c.name category_name,
                       a.content body,a.content_en body_en,a.period,a.period_en,a.material,a.material_en,null price
                from artifacts a join categories c on c.id=a.category_id
                where a.status='PUBLISHED' and a.deleted_at is null and c.enabled=1
                order by a.published_at desc,a.id desc
                """);
        }
        if (type.equals("all") || type.equals("museum") || type.equals("article")) {
            add(results, query, "article", "/articles/", """
                select a.slug,a.title,a.summary,a.title_en,a.summary_en,a.cover_image_url,c.name category_name,
                       a.content body,a.content_en body_en,null period,null period_en,null material,null material_en,null price
                from articles a join categories c on c.id=a.category_id
                where a.status='PUBLISHED' and a.deleted_at is null and c.enabled=1
                order by a.published_at desc,a.id desc
                """);
        }
        if (type.equals("museum") || type.equals("exhibit")) {
            add(results, query, "exhibit", "/exhibits/", """
                select e.slug,e.title,e.summary,e.title_en,e.summary_en,e.cover_image_url,c.name category_name,
                       e.description body,e.description_en body_en,a.period,a.period_en,a.material,a.material_en,null price
                from exhibits_3d e join artifacts a on a.id=e.artifact_id join categories c on c.id=a.category_id
                where e.status='PUBLISHED' and e.deleted_at is null and a.status='PUBLISHED' and a.deleted_at is null and c.enabled=1
                order by e.published_at desc,e.id desc
                """);
        }
        if (type.equals("museum") || type.equals("product")) {
            add(results, query, "product", "/shop", """
                select slug,name title,summary,name_en title_en,summary_en,cover_image_url,category_code category_name,
                       description body,description_en body_en,null period,null period_en,null material,null material_en,price
                from products where status='PUBLISHED' and deleted_at is null order by published_at desc,id desc
                """);
        }
        results.sort(Comparator.comparingInt(Scored::score).reversed());
        int from = Math.min(paging.offset(), results.size());
        int to = from + Math.min(paging.size(), results.size() - from);
        var items = results.subList(from, to).stream().map(Scored::result).toList();
        return ApiResponse.ok(ContentPage.of(items, paging.page(), paging.size(), results.size()), "search");
    }

    private void add(List<Scored> results, ContentSearch.Query query, String type, String path, String sql) {
        jdbc.query(sql, rs -> {
            String title = rs.getString("title"), titleEn = rs.getString("title_en");
            String summary = rs.getString("summary"), summaryEn = rs.getString("summary_en");
            int score = query.score(title, titleEn, summary, summaryEn, rs.getString("body"), rs.getString("body_en"),
                    rs.getString("period"), rs.getString("period_en"), rs.getString("material"), rs.getString("material_en"));
            if (score == 0) return;
            String slug = rs.getString("slug");
            var price = rs.getBigDecimal("price");
            results.add(new Scored(score, new Result(type, slug, title, empty(summary), empty(rs.getString("cover_image_url")),
                    rs.getString("category_name"), titleEn, summaryEn, path.endsWith("/") ? path + slug : path,
                    price == null ? null : price.toPlainString())));
        });
    }

    private static String empty(String value) { return value == null ? "" : value; }
    private record Scored(int score, Result result) {}
    public record Result(String type, String slug, String title, String summary, String coverImageUrl,
                         String categoryName, String titleEn, String summaryEn, String path, String price) {}
}
