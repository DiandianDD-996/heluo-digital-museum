package com.heluo.museum.guide;

import com.heluo.museum.guide.GuideEvidenceReader.Evidence;
import com.heluo.museum.guide.GuideEvidenceVisibility.Reference;
import com.heluo.museum.guide.GuideProfile.FactSource;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

final class GuideFollowUpRetrieval {
    private static final Pattern OTHER_PART = Pattern.compile(
            "(?:刚才[，,]?\\s*)?(?:那[，,]?\\s*)?(?:(?:另(?:外)?一?|那)(?:只|个|处|边)|对面(?:那(?:只|个|处))?"
                    + "|(?:剩下|被挡住)的?那(?:只|个|处)|还有(?:一|那)(?:只|个|处))"
                    + "(?:(?:又|是)?在(?:哪(?:里|儿|个位置)?|什么位置))?(?:呢|呀|啊)?");
    private static final Pattern ELLIPTICAL_QUESTION = Pattern.compile(
            "(?:我)?(?:还是|还)?(?:没(?:有)?看清(?:楚)?(?:了)?|看不(?:太)?清(?:楚)?)(?:呢|呀|啊)?"
                    + "|(?:(?:能|可以)(?:给我)?再指一下(?:吗)?|再指一下[，,]?\\s*(?:可以|行)吗)");
    private static final Pattern FIND_SPOT = Pattern.compile(
            "出土|发掘|哪里发现|哪儿发现|什么地方发现");
    private static final Pattern PERIOD = Pattern.compile(
            "(?:什么|哪(?:个|一))年代|(?:什么|哪个|哪一)朝代|什么时候(?:做|造|铸)"
                    + "|(?:哪年|何时)(?:做|造|铸)|多少年(?:的)?历史|年代(?:是|大约|多早)|断代");
    private static final Pattern OVERALL_SIZE = Pattern.compile(
            "(?:(?:它|这件(?:鼎|展品)?|这个鼎|青铜鼎|参考(?:实物|藏品)|原器)(?:整体|的)?\\s*)?"
                    + "(?:有多大|多大|(?:整体)?尺寸(?:是)?(?:多大|多少|是多少)?|长宽多少)(?:呢|啊|呀|吗)?");
    private static final Pattern DETAIL_SIZE = Pattern.compile(
            "(?:鼎耳|耳朵|鼎足|三足|这只脚)(?:的)?(?:有多大|多大|多长|多宽|多高|尺寸多少)(?:呢|啊|呀|吗)?");
    private static final Pattern MODEL_SIZE = Pattern.compile(
            "(?:数字|3[Dd]|这个|这个数字)?模型(?:的)?(?:整体)?(?:有多大|多大|多长|多宽|多高|尺寸(?:是)?多少)(?:呢|啊|呀|吗)?");
    private static final Pattern FACT_SEPARATOR = Pattern.compile("[、，,。；;！？!?]+|以及|另外|还有|并且");
    private static final Pattern PLATE_PROVENANCE = Pattern.compile(
            "(?:这(?:张图|张照片|幅图)?|图版)(?:就)?是(?:实物|原器|原物)(?:拍的照片|照片|拍的)吗"
                    + "|这(?:张图|幅图)?(?:就)?是(?:原器|原物|实物)(?:的)?(?:真实)?颜色(?:吗|吧)");

    private static final Pattern SOURCE_QUESTION = Pattern.compile(
            "(?:你)?(?:是)?(?:怎么|怎样)(?:知道|判断|看出来)的(?:呢|呀|啊)?"
                    + "|(?:有(?:什么|没有)?依据(?:吗)?|(?:这(?:个|处)看点的)?依据是什么|(?:这(?:个|条))?出处(?:是哪里|在哪(?:里|儿)?|呢)|来源是什么)");
    private static final Pattern FOOT_CORRECTION = Pattern.compile(
            "(?:(?:我说的是|我是指|我想问的是)\\s*)?(?:鼎足|三足|脚|腿)");
    private static final Pattern EAR_CORRECTION = Pattern.compile(
            "(?:(?:我说的是|我是指|我想问的是)\\s*)?(?:鼎耳|耳朵|耳)");
    private static final Pattern CORRECTION_PREFIX = Pattern.compile("^(?:我说的是|我是指|我想问的是)\\s*");
    private static final Pattern FOOT_COUNT = Pattern.compile("(?:两|二|三|[23])(?:条腿|只脚|只足)");

    enum Kind { EVIDENCE, CLARIFY, INSUFFICIENT_EVIDENCE, DISPUTED_EVIDENCE, FIND_SPOT_UNKNOWN,
        PERIOD, PERIOD_REFERENCE, REFERENCE_FACTS, PLATE_PROVENANCE, LOOKPOINT_SOURCE, PLATE_OBSERVATION,
        SESSION_RATE_LIMITED }

    // Only pass a previously confirmed lookpoint from the current server-side session.
    record ConfirmedLookpoint(String exhibitSlug, String locale, Reference reference) {}

    enum Fact { SIZE, DETAIL_SIZE, MODEL_SIZE, PERIOD, FIND_SPOT }
    record FactSelection(Fact fact, List<Evidence> evidence) {}
    record Result(Kind kind, List<Evidence> evidence, List<FactSelection> facts) {
        Result(Kind kind, List<Evidence> evidence) { this(kind, evidence, List.of()); }
    }

    private final GuideEvidenceReader reader;
    private final Reference provenanceSource;
    private final boolean naturalQuestions;
    private final Reference periodSource;
    private final Reference sizeSource;
    private final GuideProfile profiles;

    GuideFollowUpRetrieval(GuideEvidenceReader reader) {
        this(reader, null, false);
    }

    GuideFollowUpRetrieval(GuideEvidenceReader reader, Reference provenanceSource) {
        this(reader, provenanceSource, false);
    }

    GuideFollowUpRetrieval(GuideEvidenceReader reader, Reference provenanceSource, boolean naturalQuestions) {
        this(reader, provenanceSource, naturalQuestions, null, null);
    }

    GuideFollowUpRetrieval(GuideEvidenceReader reader, Reference provenanceSource, boolean naturalQuestions,
            Reference periodSource, Reference sizeSource) {
        this(reader, provenanceSource, naturalQuestions, periodSource, sizeSource, null);
    }

    GuideFollowUpRetrieval(GuideEvidenceReader reader, GuideProfile profiles) {
        this(reader, null, true, null, null, profiles);
    }

    private GuideFollowUpRetrieval(GuideEvidenceReader reader, Reference provenanceSource, boolean naturalQuestions,
            Reference periodSource, Reference sizeSource, GuideProfile profiles) {
        this.reader = reader;
        this.provenanceSource = provenanceSource;
        this.naturalQuestions = naturalQuestions;
        this.periodSource = periodSource;
        this.sizeSource = sizeSource;
        this.profiles = profiles;
    }

    boolean allowsTopicFromSingleCitation() { return naturalQuestions; }

    boolean supportsTopic(String exhibit, String locale, Reference reference) {
        if (profiles == null) return true;
        var profile = profiles.find(exhibit, locale);
        return profile != null && profile.plate(reference) != null && profile.topicCardIds().contains(reference.cardId());
    }

    java.util.Set<String> allowedStops(String exhibit, String locale) {
        var profile = profiles == null ? null : profiles.find(exhibit, locale);
        return profile == null ? java.util.Set.of() : profile.plates().stream().map(GuideProfile.Plate::stop)
                .collect(java.util.stream.Collectors.toUnmodifiableSet());
    }

    Result retrieve(String exhibitSlug, String locale, String question, ConfirmedLookpoint recent) {
        return retrieve(exhibitSlug, locale, question, recent, null);
    }

    Result retrieve(String exhibitSlug, String locale, String question, ConfirmedLookpoint recent,
            List<Reference> answerReferences) {
        if (question == null || question.isBlank()) return new Result(Kind.INSUFFICIENT_EVIDENCE, List.of());
        String normalized = Normalizer.normalize(question, Normalizer.Form.NFKC)
                .strip().replaceFirst("[?!.。！？]+$", "").strip();
        var profile = profiles == null ? null : profiles.find(exhibitSlug, locale);
        if (profiles != null && profile == null) return new Result(Kind.INSUFFICIENT_EVIDENCE, List.of());
        var size = profile == null ? sizeSource : profile.factSources().get(FactSource.SIZE);
        var periodReference = profile == null ? periodSource : profile.factSources().get(FactSource.PERIOD);
        var source = profile == null ? provenanceSource : profile.factSources().get(FactSource.PROVENANCE);
        if ((size != null || profile != null) && "zh-CN".equals(locale)) {
            var facts = referenceFacts(exhibitSlug, locale, normalized, size, periodReference, source);
            if (facts != null) return facts;
        }
        if ("zh-CN".equals(locale) && FIND_SPOT.matcher(normalized).find()) {
            return provenance(Kind.FIND_SPOT_UNKNOWN, exhibitSlug, locale, source);
        }
        if ((periodReference != null || profile != null) && "zh-CN".equals(locale) && PERIOD.matcher(normalized).find()) {
            var period = resolveSource(exhibitSlug, locale, periodReference, Kind.PERIOD);
            if (period.evidence().stream().anyMatch(card -> card.publicSource() != null)) return period;
            return provenance(Kind.PERIOD_REFERENCE, exhibitSlug, locale, source);
        }
        if ("zh-CN".equals(locale) && PLATE_PROVENANCE.matcher(normalized).matches()) {
            return provenance(Kind.PLATE_PROVENANCE, exhibitSlug, locale, source);
        }
        // A generic card alias must not choose the referent of an otherwise elliptical turn.
        boolean sourceQuestion = "zh-CN".equals(locale) && SOURCE_QUESTION.matcher(normalized).matches();
        if (sourceQuestion && answerReferences != null) {
            return answerReferences.isEmpty() ? new Result(Kind.INSUFFICIENT_EVIDENCE, List.of())
                    : resolve(exhibitSlug, locale, answerReferences, Kind.LOOKPOINT_SOURCE);
        }
        boolean otherPart = "zh-CN".equals(locale) && OTHER_PART.matcher(normalized).matches();
        if (sourceQuestion || otherPart || ("zh-CN".equals(locale) && ELLIPTICAL_QUESTION.matcher(normalized).matches())) {
            if (recent == null || recent.reference() == null || exhibitSlug == null
                    || !exhibitSlug.equals(recent.exhibitSlug()) || !locale.equals(recent.locale())) {
                return new Result(Kind.CLARIFY, List.of());
            }
            if (profile != null && otherPart) {
                var plate = profile.plate(recent.reference());
                return plate != null && plate.elliptical()
                        ? resolve(exhibitSlug, locale, List.of(plate.reference()), Kind.PLATE_OBSERVATION)
                        : new Result(Kind.CLARIFY, List.of());
            }
            return resolve(exhibitSlug, locale, List.of(recent.reference()),
                    sourceQuestion ? Kind.LOOKPOINT_SOURCE : Kind.EVIDENCE);
        }
        String searchQuestion = question;
        if (profile != null) {
            var correction = CORRECTION_PREFIX.matcher(normalized);
            String term = correction.replaceFirst("");
            var plate = profile.correction(term);
            if (plate != null) return resolve(exhibitSlug, locale, List.of(plate.reference()), Kind.PLATE_OBSERVATION);
            if (!term.equals(normalized)) return new Result(Kind.INSUFFICIENT_EVIDENCE, List.of());
            if (profile.correction("三足") != null && FOOT_COUNT.matcher(normalized).find()) searchQuestion += " 三足";
        } else if (naturalQuestions && "zh-CN".equals(locale)) {
            if (FOOT_CORRECTION.matcher(normalized).matches()) {
                searchQuestion = "三足";
            } else if (EAR_CORRECTION.matcher(normalized).matches()) {
                searchQuestion = "鼎耳";
            } else if (FOOT_COUNT.matcher(normalized).find()) searchQuestion += " 三足";
        }
        var matches = reader.searchCandidates(exhibitSlug, locale, searchQuestion);
        if (matches.disputed()) return new Result(Kind.DISPUTED_EVIDENCE, List.of());
        if (!matches.evidence().isEmpty()) return new Result(Kind.EVIDENCE, matches.evidence());
        if (!searchQuestion.equals(question)) return new Result(Kind.INSUFFICIENT_EVIDENCE, List.of());
        if (naturalQuestions) {
            if (recent != null && recent.exhibitSlug().equals(exhibitSlug) && recent.locale().equals(locale)) {
                return resolve(exhibitSlug, locale, List.of(recent.reference()), Kind.EVIDENCE);
            }
            var allVisible = reader.listPublished(exhibitSlug, locale).stream()
                    .limit(8).toList();
            if (!allVisible.isEmpty()) return new Result(Kind.EVIDENCE, allVisible);
        }
        return new Result(Kind.INSUFFICIENT_EVIDENCE, List.of());
    }

    private Result resolveSource(String exhibitSlug, String locale, Reference reference, Kind kind) {
        return reference == null ? new Result(kind, List.of()) : resolve(exhibitSlug, locale, List.of(reference), kind);
    }

    private Result referenceFacts(String exhibitSlug, String locale, String question, Reference sizeReference,
            Reference periodReference, Reference provenanceReference) {
        boolean findSpot = FIND_SPOT.matcher(question).find();
        // Ask about the whole object explicitly. A detail such as a foot or ear has no measured size here.
        var clauses = FACT_SEPARATOR.splitAsStream(question).map(String::strip).toList();
        boolean size = clauses.stream().anyMatch(part -> OVERALL_SIZE.matcher(part).matches());
        boolean detailSize = clauses.stream().anyMatch(part -> DETAIL_SIZE.matcher(part).matches());
        boolean modelSize = clauses.stream().anyMatch(part -> MODEL_SIZE.matcher(part).matches());
        boolean period = PERIOD.matcher(question).find();
        if (!size && !detailSize && !modelSize && !(period && findSpot)) return null;

        var facts = new ArrayList<FactSelection>(3);
        var source = findSpot
                ? provenance(Kind.REFERENCE_FACTS, exhibitSlug, locale, provenanceReference).evidence() : List.<Evidence>of();
        if (size) {
            facts.add(new FactSelection(Fact.SIZE,
                    resolveSource(exhibitSlug, locale, sizeReference, Kind.REFERENCE_FACTS).evidence()));
        }
        if (detailSize) facts.add(new FactSelection(Fact.DETAIL_SIZE, List.of()));
        if (modelSize) facts.add(new FactSelection(Fact.MODEL_SIZE, List.of()));
        if (period && periodReference != null) {
            var cards = resolveSource(exhibitSlug, locale, periodReference, Kind.PERIOD).evidence();
            facts.add(new FactSelection(Fact.PERIOD, cards));
        }
        if (findSpot) facts.add(new FactSelection(Fact.FIND_SPOT, source));
        return new Result(Kind.REFERENCE_FACTS, List.of(), List.copyOf(facts));
    }

    private Result resolve(String exhibitSlug, String locale, List<Reference> references, Kind kind) {
        return reader.resolve(exhibitSlug, locale, references)
                .map(cards -> new Result(kind, cards))
                .orElseGet(() -> new Result(Kind.INSUFFICIENT_EVIDENCE, List.of()));
    }

    private Result provenance(Kind kind, String exhibitSlug, String locale, Reference reference) {
        var cards = reference == null ? List.<Evidence>of()
                : reader.resolve(exhibitSlug, locale, List.of(reference)).orElseGet(List::of);
        return new Result(kind, cards);
    }
}
