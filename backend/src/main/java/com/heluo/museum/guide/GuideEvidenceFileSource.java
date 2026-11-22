package com.heluo.museum.guide;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.MapperFeature;
import com.fasterxml.jackson.databind.ObjectReader;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.heluo.museum.guide.GuideEvidenceReader.Evidence;
import com.heluo.museum.guide.GuideEvidenceVisibility.Card;
import com.heluo.museum.guide.GuideEvidenceVisibility.Status;
import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.DateTimeException;
import java.time.Instant;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import org.springframework.dao.DataAccessResourceFailureException;

final class GuideEvidenceFileSource implements GuideEvidenceReader.Source {
    private static final int MAX_BYTES = 256 * 1024;
    private static final ObjectReader READER = JsonMapper.builder()
            .enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION)
            .enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS)
            .enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .enable(DeserializationFeature.FAIL_ON_NUMBERS_FOR_ENUMS)
            .disable(MapperFeature.ALLOW_COERCION_OF_SCALARS)
            .disable(DeserializationFeature.ACCEPT_FLOAT_AS_INT)
            .build()
            .readerFor(Pack.class);

    private final Path file;
    private final Path minimumVersionFile;
    private final Path approvedDigestFile;

    GuideEvidenceFileSource(Path file, Path minimumVersionFile, Path approvedDigestFile) {
        this.file = file.toAbsolutePath().normalize();
        this.minimumVersionFile = minimumVersionFile.toAbsolutePath().normalize();
        this.approvedDigestFile = approvedDigestFile.toAbsolutePath().normalize();
    }

    @Override
    public List<Evidence> current(String exhibitSlug, String locale) {
        try (var stream = Files.newInputStream(file)) {
            byte[] bytes = stream.readNBytes(MAX_BYTES + 1);
            if (bytes.length > MAX_BYTES) throw new IllegalArgumentException("Oversized pack");
            if (!MessageDigest.isEqual(approvedDigest(), sha256(bytes))) {
                throw new IllegalArgumentException("Unapproved evidence pack");
            }
            Pack pack = READER.readValue(bytes);
            if (pack == null || (pack.formatVersion() != 1 && pack.formatVersion() != 2)
                    || pack.releaseVersion() < minimumReleaseVersion()
                    || pack.cards() == null) {
                throw new IllegalArgumentException("Invalid pack");
            }
            var ids = new HashSet<String>();
            return pack.cards().stream().map(row -> {
                        if (row == null) throw new IllegalArgumentException("Null evidence row");
                        return row.toEvidence(ids, pack.formatVersion());
                    })
                    .filter(evidence -> evidence.card().exhibitSlug().equals(exhibitSlug)
                            && evidence.card().locale().equals(locale))
                    .toList();
        } catch (IOException | IllegalArgumentException | DateTimeException invalid) {
            throw new DataAccessResourceFailureException("Guide evidence pack unavailable");
        }
    }

    private byte[] approvedDigest() throws IOException {
        try (var stream = Files.newInputStream(approvedDigestFile)) {
            byte[] bytes = stream.readNBytes(67);
            String digest = new String(bytes, StandardCharsets.US_ASCII);
            if (!digest.matches("[0-9a-f]{64}(?:\\r?\\n)?")) {
                throw new IllegalArgumentException("Invalid approved evidence digest");
            }
            return HexFormat.of().parseHex(digest.strip());
        }
    }

    private static byte[] sha256(byte[] bytes) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(bytes);
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("Missing SHA-256 implementation", impossible);
        }
    }

    private int minimumReleaseVersion() throws IOException {
        try (var stream = Files.newInputStream(minimumVersionFile)) {
            byte[] bytes = stream.readNBytes(17);
            String value = new String(bytes, StandardCharsets.US_ASCII).strip();
            if (bytes.length > 16 || !value.matches("[1-9][0-9]{0,9}")) {
                throw new IllegalArgumentException("Invalid minimum release version");
            }
            return Integer.parseInt(value);
        }
    }

    private record Pack(int formatVersion, int releaseVersion, List<Row> cards) {}

    private record Row(String id, int revision, String exhibitSlug, String artifactSlug, String locale,
                       Status status, String publishedAt, String expiresAt, String text,
                       List<String> aliases, String publicSource, ClaimRow claim,
                       String stop, List<String> spoken, List<String> boundary, List<String> systemConstraints) {
        Evidence toEvidence(HashSet<String> ids, int formatVersion) {
            boolean v2 = formatVersion == 2;
            List<String> spokenList = spoken == null ? List.of() : spoken;
            List<String> boundaryList = boundary == null ? List.of() : boundary;
            List<String> constraintsList = systemConstraints == null ? List.of() : systemConstraints;
            String effectiveText = !missing(text) ? text
                    : (v2 && !spokenList.isEmpty()
                            ? String.join("", spokenList) + (boundaryList.isEmpty() ? "" : String.join("", boundaryList))
                            : null);
            if (missing(id) || !ids.add(id) || revision < 1 || missing(exhibitSlug) || missing(artifactSlug)
                    || missing(locale) || status == null || aliases == null
                    || (status == Status.PUBLISHED && (missing(publishedAt) || missing(effectiveText)))
                    || (v2 && status == Status.PUBLISHED && spokenList.isEmpty())
                    || aliases.stream().anyMatch(Row::missing)
                    || spokenList.stream().anyMatch(Row::missing)
                    || boundaryList.stream().anyMatch(Row::missing)
                    || constraintsList.stream().anyMatch(Row::missing)) {
                throw new IllegalArgumentException("Invalid evidence row");
            }
            URI source = publicSource == null ? null : URI.create(publicSource);
            if (source != null && (!"https".equalsIgnoreCase(source.getScheme())
                    || source.getHost() == null || source.getUserInfo() != null)) {
                throw new IllegalArgumentException("Invalid public source");
            }
            return new Evidence(new Card(id, revision, exhibitSlug, artifactSlug, locale, status,
                    parseTime(publishedAt), parseTime(expiresAt)), effectiveText, aliases, source,
                    claim == null ? null : new GuideEvidenceReader.Claim(claim.key(), claim.value()),
                    spokenList, boundaryList, constraintsList);
        }

        private static boolean missing(String value) {
            return value == null || value.isBlank();
        }

        private static Instant parseTime(String value) {
            return value == null ? null : Instant.parse(value);
        }
    }

    private record ClaimRow(String key, String value) {}
}
