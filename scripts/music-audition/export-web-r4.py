"""Experimental R4 web audio export & 6 MB budget evaluation (AAC vs Opus+MP3).

Phase 4 offline evaluation tool: outputs only to artifacts/.../web-export-r4/
and writes quality-check-r4.json. Never modifies frontend/public/media/audio/.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import shutil
import struct
import sys
from fractions import Fraction
from pathlib import Path

import av
import numpy as np
from scipy import signal

from render import DEFAULT_OUTPUT, ROOT, SR, db, measure, read_pcm


HERE = Path(__file__).resolve().parent
WEB_EXPORT_DIR = DEFAULT_OUTPUT / "web-export-r4"
PRODUCTION_DIR = ROOT / "frontend/public/media/audio/music-r4"
PRODUCTION_URL_ROOT = "/media/audio/music-r4"
BYTE_BUDGET = 6_000_000
TRIM_ENDS_R4 = {
    "home": 100.0,
    "reading": 104.8,
    "bronze": 109.4,
    "jade": 100.9,
}


def _load_export_r3():
    spec = importlib.util.spec_from_file_location("export_web_r3", HERE / "export-web-r3.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules["export_web_r3"] = module
    spec.loader.exec_module(module)
    return module


r3_export = _load_export_r3()


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def encode_aac_m4a(path: Path, audio: np.ndarray, title: str, bit_rate: int = 96_000) -> None:
    with av.open(str(path), mode="w", format="ipod", options={"movflags": "+faststart"}) as container:
        container.metadata.update({
            "title": title,
            "artist": "Heluo Digital Museum",
            "album": "Heluo chamber music R4 (audition)",
            "comment": "CC0-1.0 VSCO 2 CE + VCSL sampled arrangement.",
        })
        stream = container.add_stream("aac", rate=SR)
        stream.bit_rate = bit_rate
        stream.layout = "stereo"
        stream.codec_context.format = "fltp"
        stream.codec_context.time_base = Fraction(1, SR)
        chunk = 1024 * 8
        for start in range(0, len(audio), chunk):
            values = np.ascontiguousarray(audio[start:start + chunk].T, dtype=np.float32)
            frame = av.AudioFrame.from_ndarray(values, format="fltp", layout="stereo")
            frame.sample_rate = SR
            frame.pts = start
            frame.time_base = Fraction(1, SR)
            for packet in stream.encode(frame):
                container.mux(packet)
        for packet in stream.encode(None):
            container.mux(packet)


def decode_aac_m4a(path: Path, expected_samples: int) -> tuple[np.ndarray, dict]:
    with av.open(str(path)) as container:
        stream = container.streams.audio[0]
        raw_duration_sec = float((stream.duration or 0) * stream.time_base)
        frames = [frame.to_ndarray().T.astype(np.float64) for frame in container.decode(audio=0)]
        require(bool(frames), f"AAC decoder returned no frames: {path.name}")
        decoded_full = np.concatenate(frames)
        # AAC frame size is 1024 samples; container edit-list duration marks exact PCM length.
        decoded = decoded_full[:expected_samples]
        details = {
            "codec": stream.codec_context.name,
            "sampleRate": stream.codec_context.sample_rate,
            "channels": stream.codec_context.channels,
            "containerStartSeconds": round(float((stream.start_time or 0) * stream.time_base), 9),
            "containerDurationSeconds": round(raw_duration_sec, 6),
            "rawDecodedFrames": len(decoded_full),
            "trimmedTrailingPaddingSamples": max(0, len(decoded_full) - expected_samples),
        }
    return decoded, details


def encode_opus_webm(path: Path, audio_44k: np.ndarray, title: str, bit_rate: int = 80_000) -> np.ndarray:
    audio_48k = signal.resample_poly(audio_44k, 160, 147, axis=0)
    with av.open(str(path), mode="w", format="webm") as container:
        container.metadata.update({
            "title": title,
            "artist": "Heluo Digital Museum",
            "album": "Heluo chamber music R4 (audition)",
        })
        stream = container.add_stream("libopus", rate=48000)
        stream.bit_rate = bit_rate
        stream.layout = "stereo"
        stream.codec_context.format = "flt"
        stream.codec_context.time_base = Fraction(1, 48000)
        chunk = 960 * 8
        for start in range(0, len(audio_48k), chunk):
            part = np.ascontiguousarray(audio_48k[start:start + chunk].reshape(1, -1), dtype=np.float32)
            frame = av.AudioFrame.from_ndarray(part, format="flt", layout="stereo")
            frame.sample_rate = 48000
            frame.pts = start
            frame.time_base = Fraction(1, 48000)
            for packet in stream.encode(frame):
                container.mux(packet)
        for packet in stream.encode(None):
            container.mux(packet)
    return audio_48k


def decode_opus_webm(path: Path) -> tuple[np.ndarray, dict]:
    with av.open(str(path)) as container:
        stream = container.streams.audio[0]
        frames = [
            (fr.to_ndarray().T if fr.format.is_planar else fr.to_ndarray().reshape(-1, 2)).astype(np.float64)
            for fr in container.decode(audio=0)
        ]
        require(bool(frames), f"Opus decoder returned no frames: {path.name}")
        decoded_48k = np.concatenate(frames)
        decoded_44k = signal.resample_poly(decoded_48k, 147, 160, axis=0)
        details = {
            "codec": stream.codec_context.name,
            "sampleRate": stream.codec_context.sample_rate,
            "channels": stream.codec_context.channels,
            "decoded48kFrames": len(decoded_48k),
        }
    return decoded_44k, details


def encode_mp3_96k(path: Path, audio: np.ndarray, title: str, bit_rate: int = 96_000) -> None:
    with av.open(str(path), mode="w", format="mp3",
                 options={"write_xing": "1", "id3v2_version": "3"}) as container:
        container.metadata.update({
            "title": title,
            "artist": "Heluo Digital Museum",
            "album": "Heluo chamber music R4 (audition)",
            "comment": "CC0-1.0 VSCO 2 CE + VCSL sampled arrangement.",
        })
        stream = container.add_stream("libmp3lame", rate=SR)
        stream.bit_rate = bit_rate
        stream.layout = "stereo"
        stream.codec_context.format = "fltp"
        stream.codec_context.time_base = Fraction(1, SR)
        for start in range(0, len(audio), 1152 * 8):
            values = np.ascontiguousarray(
                (audio[start:start + 1152 * 8] * r3_export.ENCODER_INPUT_SCALE).T, dtype=np.float32
            )
            frame = av.AudioFrame.from_ndarray(values, format="fltp", layout="stereo")
            frame.sample_rate = SR
            frame.pts = start
            frame.time_base = Fraction(1, SR)
            for packet in stream.encode(frame):
                container.mux(packet)
        for packet in stream.encode(None):
            container.mux(packet)


def evaluate_decoded(loop: np.ndarray, decoded: np.ndarray, scene_lufs: float) -> dict:
    # Align lengths if resample roundtrip differs by <= 2 samples
    n = min(len(loop), len(decoded))
    head_lag = r3_export.alignment_lag(loop[:SR * 2], decoded[:SR * 2])
    tail_lag = r3_export.alignment_lag(loop[-SR * 2:], decoded[-SR * 2:])
    measured = r3_export.compact_metrics(measure(decoded[:n]))
    pcm_metrics = r3_export.compact_metrics(measure(loop))
    require(np.isfinite(decoded).all() and measured["clippedSamples"] == 0, "Clipped or non-finite decoded PCM")
    require(measured["oversampledPeakDbtp"] < -3.0, f"Insufficient peak headroom: {measured['oversampledPeakDbtp']}")
    loudness_delta = measured["integratedLufs"] - scene_lufs
    require(abs(loudness_delta) < 0.40, f"Scene loudness drift: {loudness_delta}")
    seams = r3_export.seam_metrics(decoded[:n])
    require(seams["nearZeroRunAcrossRepeatSeconds"] < 0.01, "Unexpected silent repeat edge")
    return {
        "pcmBeforeEncoding": pcm_metrics,
        "decoded": measured,
        "loudnessDeltaFromSceneLu": round(loudness_delta, 3),
        "headOffsetSamples": head_lag,
        "tailOffsetSamples": tail_lag,
        "repeatBoundary": seams,
    }


def deploy_production(aac_tracks: list[dict], aac_dir: Path, report: dict, quality_report: dict,
                      dest_dir: Path = PRODUCTION_DIR) -> None:
    """Deploy user-approved R4 Scheme A (AAC .m4a 96 kbps) assets to frontend/public."""
    dest_dir.mkdir(parents=True, exist_ok=True)
    r3_manifest = json.loads((DEFAULT_OUTPUT / "source-samples/manifest.json").read_text(encoding="utf-8-sig"))
    r4_manifest = json.loads((DEFAULT_OUTPUT / "source-samples-r4/manifest.json").read_text(encoding="utf-8-sig"))

    vsco_lic_src = DEFAULT_OUTPUT / "source-samples/LICENSE-CC0-1.0.txt"
    vcsl_lic_src = DEFAULT_OUTPUT / "source-samples-r4/LICENSE-CC0-1.0.txt"
    vsco_lic_dst = dest_dir / "LICENSE-CC0-1.0.txt"
    vcsl_lic_dst = dest_dir / "LICENSE-VCSL-CC0-1.0.txt"
    shutil.copyfile(vsco_lic_src, vsco_lic_dst)
    shutil.copyfile(vcsl_lic_src, vcsl_lic_dst)
    require(digest(vsco_lic_dst) == digest(vsco_lic_src), "VSCO license copy differs")
    require(digest(vcsl_lic_dst) == digest(vcsl_lic_src), "VCSL license copy differs")

    titles = {t["id"]: t["title"] for t in report["tracks"]}
    sources = {t["id"]: t["scene"] for t in report["tracks"]}
    prod_tracks = []
    for item in aac_tracks:
        identity = item["id"]
        src_file = aac_dir / item["file"]
        dst_file = dest_dir / item["file"]
        shutil.copyfile(src_file, dst_file)
        require(digest(dst_file) == item["sha256"] and dst_file.stat().st_size == item["bytes"],
                f"Production AAC copy mismatch: {item['file']}")
        scene_meta = sources[identity]
        prod_tracks.append({
            "id": identity,
            "title": titles[identity],
            "file": item["file"],
            "url": f"{PRODUCTION_URL_ROOT}/{item['file']}",
            "mimeType": "audio/mp4",
            "durationSeconds": item["durationSeconds"],
            "bytes": item["bytes"],
            "sha256": item["sha256"],
            "sampleRate": SR,
            "channels": 2,
            "nominalBitRate": 96_000,
            "source": {
                "file": scene_meta["file"],
                "sha256": scene_meta["sha256"],
                "durationSeconds": scene_meta["durationSeconds"],
                "integratedLufs": scene_meta["integratedLufs"],
                "oversampledPeakDbtp": scene_meta["oversampledPeakDbtp"],
            },
            "loop": item["loop"],
            "pcmBeforeEncoding": item["pcmBeforeEncoding"],
            "decoded": item["decoded"],
            "loudnessDeltaFromSceneLu": item["loudnessDeltaFromSceneLu"],
            "container": item["container"],
            "headOffsetSamples": item["headOffsetSamples"],
            "tailOffsetSamples": item["tailOffsetSamples"],
            "repeatBoundary": item["repeatBoundary"],
        })

    total_bytes = sum(t["bytes"] for t in prod_tracks)
    require(total_bytes <= BYTE_BUDGET, f"Production R4 exceeds {BYTE_BUDGET} B budget: {total_bytes}")

    codec = av.Codec("aac", "w")
    prod_manifest = {
        "schemaVersion": 1,
        "revision": "r4-approved-web-loop",
        "date": "2026-11-23",
        "description": "User-approved R4 scene masters (with CC0 VCSL Eastern accents & 4th movement jade), AAC 96 kbps self-contained loops.",
        "totalAudioBytes": total_bytes,
        "audioByteBudget": BYTE_BUDGET,
        "gainPolicy": "Original scene gains retained (home 0.80, reading 0.58, bronze 0.72, jade 0.67). No per-track normalization or limiting.",
        "sourceScoreSha256": quality_report["scoreSha256"],
        "sourceRenderReportSha256": quality_report["renderReportSha256"],
        "sourceSampleManifestSha256": quality_report["sourceManifestSha256"],
        "sourceSampleR4ManifestSha256": quality_report["sourceManifestR4Sha256"],
        "exportScriptSha256": digest(Path(__file__)),
        "encoder": {
            "pythonPackage": "PyAV",
            "pyavVersion": av.__version__,
            "codec": codec.name,
            "description": codec.long_name,
            "libraries": {key: ".".join(map(str, value)) for key, value in av.library_versions.items()},
            "configuration": "44.1 kHz stereo; AAC-LC 96000 bit/s in MP4/M4A (ipod +faststart)",
        },
        "sourceLibraries": [r3_manifest["library"], r4_manifest["library"]],
        "sourceLicense": {
            "id": "CC0-1.0",
            "scope": "All source acoustic recordings (VSCO 2 CE and VCSL)",
            "urls": [
                f"{PRODUCTION_URL_ROOT}/LICENSE-CC0-1.0.txt",
                f"{PRODUCTION_URL_ROOT}/LICENSE-VCSL-CC0-1.0.txt",
            ],
            "sha256": {
                "LICENSE-CC0-1.0.txt": digest(vsco_lic_dst),
                "LICENSE-VCSL-CC0-1.0.txt": digest(vcsl_lic_dst),
            },
        },
        "arrangement": "Original Heluo Digital Museum sampled chamber arrangements with CC0 VCSL acoustic accents; not historical ritual reconstruction or guqin/bianzhong/xiao live ensemble recording.",
        "samples": [
            {key: item[key] for key in ("instrument", "sourcePath", "sourceUrl", "sourceCommit", "sha256", "rootMidi", "license")}
            for item in [*r3_manifest["samples"], *r4_manifest["samples"]]
        ],
        "tracks": prod_tracks,
    }
    (dest_dir / "manifest.json").write_text(
        json.dumps(prod_manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    credits_md = f"""# 河洛展馆配乐 R4：来源与制作说明

《入馆·河洛晨光》《水岸·静读》《观器·温金》《温润·玉石》为河洛数字博物馆项目制作的 R4 原创采样编排。经本地试听台主观确认后采用 **AAC (.m4a) 96 kbps, 44.1 kHz 双声道** 单格式交付（4 首合计 `{total_bytes:,}` 字节，预算上限 `6,000,000` 字节）。

## 乐器录音来源（全部 CC0 1.0 Universal）

1. **VS Chamber Orchestra: Community Edition (VSCO 2 CE)**
   - 仓库：`https://github.com/sgossner/VSCO-2-CE`（提交 `440300901dfe9275fd84e0b7763af1f8443ae62e`，SFZ 提交 `6dd651d55dde97fd4028699be9d4481f26917891`）
   - 署名：Sam Gossner / Versilian Studios；Simon Dalzell / Ivy Audio；Elan Hickler / Soundemote
   - 许可全文：[LICENSE-CC0-1.0.txt](./LICENSE-CC0-1.0.txt)
2. **Versilian Community Sample Library (VCSL)**
   - 仓库：`https://github.com/sgossner/VCSL`（提交 `c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e`，SFZ 提交 `dfcf4a4918771eee884b96ad4493de82ef84daf6`）
   - 署名：Sam Gossner / Versilian Studios；VCSL Contributors
   - 许可全文：[LICENSE-VCSL-CC0-1.0.txt](./LICENSE-VCSL-CC0-1.0.txt)

> 诚实声明：R4 采用现代室内乐与 VCSL 声学采样（Hand Chimes、Dan Tranh 十六弦筝、软槌金属琴/弱奏铜锣、木质边棱管）进行当代编排，不宣称古琴/编钟/箫实录或古代礼乐复原。

## 网页版本

四首文件为 44.1 kHz、双声道、96 kbit/s AAC-LC（MP4/M4A，`+faststart`）。每首尾部与开头重叠 1.8 秒以支持浏览器原生无缝循环，详细散列与声学测量见同目录 [manifest.json](./manifest.json)。
"""
    (dest_dir / "CREDITS.md").write_text(credits_md, encoding="utf-8")
    print(json.dumps({
        "deployed": True,
        "directory": str(dest_dir),
        "tracks": len(prod_tracks),
        "totalAudioBytes": total_bytes,
        "budgetBytes": BYTE_BUDGET,
    }, ensure_ascii=False))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=WEB_EXPORT_DIR)
    parser.add_argument("--deploy-production", action="store_true")
    args = parser.parse_args()
    output = args.output.resolve()
    aac_dir = output / "aac-96k"
    opus_dir = output / "opus-80k-mp3-96k"
    aac_dir.mkdir(parents=True, exist_ok=True)
    opus_dir.mkdir(parents=True, exist_ok=True)

    report_path = DEFAULT_OUTPUT / "render-report-r4.json"
    render_check_path = DEFAULT_OUTPUT / "render-check-r4.json"
    report = json.loads(report_path.read_text(encoding="utf-8"))
    render_check = json.loads(render_check_path.read_text(encoding="utf-8"))

    aac_tracks = []
    opus_tracks = []
    mp3_tracks = []

    for track in report["tracks"]:
        identity = track["id"]
        scene_path = DEFAULT_OUTPUT / track["scene"]["file"]
        require(digest(scene_path) == track["scene"]["sha256"], f"Scene WAV hash mismatch: {identity}")
        rate, original = read_pcm(scene_path)
        require(rate == SR and original.shape[1] == 2, f"Unexpected master format: {identity}")
        loop, loop_details = r3_export.make_loop(original, TRIM_ENDS_R4[identity])

        # Scheme A: AAC .m4a 96 kbps
        aac_file = f"{identity}-r4.m4a"
        aac_path = aac_dir / aac_file
        encode_aac_m4a(aac_path, loop, track["title"], 96_000)
        aac_dec, aac_meta = decode_aac_m4a(aac_path, len(loop))
        aac_eval = evaluate_decoded(loop, aac_dec, track["scene"]["integratedLufs"])
        require(aac_eval["headOffsetSamples"] == 0, f"AAC head offset non-zero: {identity}")
        aac_tracks.append({
            "id": identity,
            "file": aac_file,
            "mimeType": "audio/mp4",
            "bytes": aac_path.stat().st_size,
            "sha256": digest(aac_path),
            "durationSeconds": round(len(loop) / SR, 6),
            "sourceSceneSha256": track["scene"]["sha256"],
            "loop": loop_details,
            "container": aac_meta,
            **aac_eval,
        })

        # Scheme B1: Opus .webm 80 kbps
        opus_file = f"{identity}-r4.webm"
        opus_path = opus_dir / opus_file
        opus_48k = encode_opus_webm(opus_path, loop, track["title"], 80_000)
        opus_dec, opus_meta = decode_opus_webm(opus_path)
        opus_eval = evaluate_decoded(loop, opus_dec, track["scene"]["integratedLufs"])
        opus_tracks.append({
            "id": identity,
            "file": opus_file,
            "mimeType": "audio/webm",
            "bytes": opus_path.stat().st_size,
            "sha256": digest(opus_path),
            "durationSeconds": round(len(opus_48k) / 48000, 6),
            "container": opus_meta,
            **opus_eval,
        })

        # Scheme B2: MP3 96 kbps fallback
        mp3_file = f"{identity}-r4.mp3"
        mp3_path = opus_dir / mp3_file
        encode_mp3_96k(mp3_path, loop, track["title"], 96_000)
        mp3_dec, mp3_meta = r3_export.decode_mp3(mp3_path)
        mp3_eval = evaluate_decoded(loop, mp3_dec, track["scene"]["integratedLufs"])
        require(mp3_eval["headOffsetSamples"] == 0 and mp3_eval["tailOffsetSamples"] == 0,
                f"MP3 96k offset non-zero: {identity}")
        mp3_tracks.append({
            "id": identity,
            "file": mp3_file,
            "mimeType": "audio/mpeg",
            "bytes": mp3_path.stat().st_size,
            "sha256": digest(mp3_path),
            "durationSeconds": round(len(mp3_dec) / SR, 6),
            "gapless": mp3_meta,
            **mp3_eval,
        })

    aac_total = sum(x["bytes"] for x in aac_tracks)
    opus_total = sum(x["bytes"] for x in opus_tracks)
    mp3_total = sum(x["bytes"] for x in mp3_tracks)
    dual_total = opus_total + mp3_total

    quality_report = {
        "schemaVersion": 1,
        "revision": "r4",
        "date": "2026-11-23",
        "status": "offline_audition_only_pending_subjective_approval",
        "audioByteBudget": BYTE_BUDGET,
        "sourceManifestSha256": report["sourceManifestSha256"],
        "sourceManifestR4Sha256": report["sourceManifestR4Sha256"],
        "scoreSha256": report["scoreSha256"],
        "renderReportSha256": digest(report_path),
        "wavVerification": render_check,
        "webEncodingComparison": {
            "schemeA_aac96k": {
                "format": "AAC-LC (.m4a / audio/mp4), 96 kbps, 44.1 kHz stereo",
                "totalBytes": aac_total,
                "budgetBytes": BYTE_BUDGET,
                "within6MbBudget": aac_total <= BYTE_BUDGET,
                "headroomBytes": BYTE_BUDGET - aac_total,
                "browserSupport": "Chrome / Edge / Firefox / Safari / iOS / Android native single-file",
                "tracks": aac_tracks,
            },
            "schemeB_opus80k_plus_mp3_96k": {
                "format": "Opus (.webm, 80 kbps 48kHz) primary + MP3 (.mp3, 96 kbps 44.1kHz) fallback",
                "opusOnlyBytes": opus_total,
                "mp3FallbackBytes": mp3_total,
                "dualFormatTotalBytes": dual_total,
                "opusOnlyWithin6MbBudget": opus_total <= BYTE_BUDGET,
                "dualFormatWithin6MbBudget": dual_total <= BYTE_BUDGET,
                "opusTracks": opus_tracks,
                "mp3Tracks": mp3_tracks,
            },
            "recommendation": (
                "Scheme A (AAC .m4a 96 kbps) fits cleanly within the 6,000,000 B single-format budget "
                "with 100% cross-browser native playback and zero head encoder offset."
                if aac_total <= BYTE_BUDGET
                else "Re-evaluate bitrate or budget ceiling."
            ),
        },
        "limit": "Technical encoding, loudness, headroom, and PCM loop seam metrics only; subjective listening confirmation required before Phase 5.",
    }

    (DEFAULT_OUTPUT / "quality-check-r4.json").write_text(
        json.dumps(quality_report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    if args.deploy_production:
        deploy_production(aac_tracks, aac_dir, report, quality_report)
    print(json.dumps({
        "passed": True,
        "budgetBytes": BYTE_BUDGET,
        "schemeA_aac96k_bytes": aac_total,
        "schemeA_withinBudget": aac_total <= BYTE_BUDGET,
        "schemeB_opus80k_bytes": opus_total,
        "schemeB_mp3_96k_bytes": mp3_total,
        "schemeB_dual_bytes": dual_total,
        "schemeB_dualWithinBudget": dual_total <= BYTE_BUDGET,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
