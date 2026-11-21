"""Export the approved R3 scene masters as self-contained MP3 loops.

Uses the already installed PyAV/FFmpeg, NumPy and SciPy. It never downloads
samples, rewrites a score, renders new notes or changes the scene gain.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import struct
from fractions import Fraction
from pathlib import Path

import av
import numpy as np
from scipy import signal

from render import DEFAULT_OUTPUT, ROOT, SR, db, k_weight, measure, read_pcm


OUTPUT = ROOT / "frontend/public/media/audio/music-r3"
URL_ROOT = "/media/audio/music-r3"
OVERLAP_SECONDS = 1.8
BIT_RATE = 128_000
BYTE_BUDGET = 6_000_000
# This installed libmp3lame applies a fixed 0.95 amplitude scale. Counter only
# that codec attenuation; decoded measurements must still match each scene.
ENCODER_INPUT_SCALE = 1 / 0.95
TRIM_ENDS = {"home": 100.0, "reading": 104.1, "bronze": 109.4}
APPROVED_SCENE_HASHES = {
    "home": "1683c067e47ffe5e96b713e84973fcf7058b44a5a0efe52c2566365c05bfa346",
    "reading": "b3bee06af5d4e48b471419f70c2330d08ba63477524fe1b9a2f7d19d09eb92bb",
    "bronze": "ff84125946be92b739e9a0adf1a0d4a280a3e48ae37c29b8a9bb5586dd04553c",
}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def make_loop(source: np.ndarray, trim_end: float) -> tuple[np.ndarray, dict]:
    overlap = round(OVERLAP_SECONDS * SR)
    end = round(trim_end * SR)
    period = end - overlap
    require(overlap * 2 < end <= len(source), "Invalid loop trim/overlap")
    loop = source[:period].copy()
    fade_in = 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, overlap))
    # A complementary fade has unity summed gain. The first output sample is
    # the original sample at period, and the last prefix sample is the original
    # sample at overlap-1: both joins preserve their natural adjacent sample.
    loop[:overlap] = (
        source[period:end] * (1 - fade_in[:, None])
        + source[:overlap] * fade_in[:, None]
    )
    require(np.array_equal(loop[overlap:], source[overlap:period]), "Body changed")
    require(np.array_equal(loop[0], source[period]), "Loop head is not continuous")
    require(np.array_equal(loop[overlap - 1], source[overlap - 1]), "Prefix join changed")
    natural_step = float(np.max(np.abs(source[period] - source[period - 1])))
    seam_step = float(np.max(np.abs(loop[0] - loop[-1])))
    require(abs(natural_step - seam_step) < 1e-15, "PCM seam is not a natural source step")
    return loop, {
        "method": "tail-folded-into-head-complementary-raised-cosine",
        "nativeLoop": True,
        "loopStartSeconds": 0,
        "loopEndSeconds": round(period / SR, 6),
        "sourceTrimEndSeconds": trim_end,
        "crossfadeSeconds": OVERLAP_SECONDS,
        "sourceTailStartSeconds": round(period / SR, 6),
        "sourceTailEndSeconds": trim_end,
        "sourceTailRemovedAfterSeconds": trim_end,
        "firstPlaybackPrefixChangedSeconds": OVERLAP_SECONDS,
        "unchangedBodySourceStartSeconds": OVERLAP_SECONDS,
        "unchangedBodySourceEndSeconds": round(period / SR, 6),
        "gainAppliedToWholeTrack": 1.0,
        "pcmSeamAdjacentStep": round(seam_step, 9),
        "pcmNaturalSourceAdjacentStep": round(natural_step, 9),
        "initialPlaybackAdvice": "Fade in the player briefly; the first 1.8 seconds contain the previous tail and the original opening.",
        "formula": "prefix[i] = tail[i] * (1-w[i]) + originalHead[i] * w[i]; w[i] = (1-cos(pi*i/(N-1)))/2; body is unchanged",
    }


def encode_mp3(path: Path, audio: np.ndarray, title: str) -> None:
    with av.open(str(path), mode="w", format="mp3",
                 options={"write_xing": "1", "id3v2_version": "3"}) as container:
        container.metadata.update({
            "title": title,
            "artist": "Heluo Digital Museum",
            "album": "Heluo chamber music R3",
            "comment": "Original sampled arrangement; VSCO 2 CE source recordings are CC0-1.0.",
        })
        stream = container.add_stream("libmp3lame", rate=SR)
        stream.bit_rate = BIT_RATE
        stream.layout = "stereo"
        stream.codec_context.format = "fltp"
        stream.codec_context.time_base = Fraction(1, SR)
        for start in range(0, len(audio), 1152 * 8):
            values = np.ascontiguousarray(
                (audio[start:start + 1152 * 8] * ENCODER_INPUT_SCALE).T, dtype=np.float32)
            frame = av.AudioFrame.from_ndarray(values, format="fltp", layout="stereo")
            frame.sample_rate = SR
            frame.pts = start
            frame.time_base = Fraction(1, SR)
            for packet in stream.encode(frame):
                container.mux(packet)
        for packet in stream.encode(None):
            container.mux(packet)


def decode_mp3(path: Path) -> tuple[np.ndarray, dict]:
    with av.open(str(path)) as container:
        stream = container.streams.audio[0]
        details = {
            "codec": stream.codec_context.name,
            "sampleRate": stream.codec_context.sample_rate,
            "channels": stream.codec_context.channels,
            "containerStartSeconds": round(float((stream.start_time or 0) * stream.time_base), 9),
            "containerDurationSeconds": round(float((stream.duration or 0) * stream.time_base), 9),
        }
        require(stream.codec_context.sample_rate == SR and stream.codec_context.channels == 2,
                "Encoded format changed")
        frames = [frame.to_ndarray().T.astype(np.float64) for frame in container.decode(audio=0)]
        require(bool(frames), "MP3 decoder returned no frames")
        decoded = np.concatenate(frames)
    skip_records = []
    with av.open(str(path)) as container:
        for packet in container.demux(audio=0):
            for data in packet.iter_sidedata():
                if data.data_type == "skip_samples":
                    raw = bytes(data)
                    require(len(raw) >= 10, "Malformed gapless side data")
                    skip, discard = struct.unpack_from("<II", raw)
                    skip_records.append({"skipSamples": skip, "discardPaddingSamples": discard})
    header = path.read_bytes()[:8192]
    details["xingOrInfoHeaderPresent"] = b"Xing" in header or b"Info" in header
    details["gaplessSkipRecords"] = skip_records
    details["decodedFrames"] = len(decoded)
    require(details["xingOrInfoHeaderPresent"], "MP3 is missing its Xing/Info header")
    require(any(item["skipSamples"] > 0 for item in skip_records), "Missing MP3 encoder-delay metadata")
    return decoded, details


def alignment_lag(reference: np.ndarray, decoded: np.ndarray) -> int:
    original = reference.mean(axis=1)
    recovered = decoded.mean(axis=1)
    correlation = signal.correlate(recovered, original, mode="full", method="fft")
    lags = signal.correlation_lags(len(recovered), len(original), mode="full")
    return int(lags[np.argmax(correlation)])


def seam_metrics(audio: np.ndarray) -> dict:
    # This window is exactly what a sample-contiguous native repeat should play.
    # Browser scheduling is verified separately by the integration workflow.
    half = round(1.5 * SR)
    joined = np.concatenate([audio[-half:], audio[:half]])
    weighted = k_weight(joined)
    windows = []
    for start in np.arange(-1.2, 1.0001, 0.1):
        offset = round((1.5 + start) * SR)
        values = weighted[offset:offset + round(0.4 * SR)]
        energy = float(np.sum(np.mean(values * values, axis=0)))
        level = -0.691 + 10 * np.log10(max(energy, 1e-20))
        windows.append({"relativeStartSeconds": round(float(start), 2),
                        "ungatedLufs": round(float(level), 3)})
    midpoint = half
    quiet_threshold = 10 ** (-90 / 20)
    sample_peak = np.max(np.abs(joined), axis=1)
    left = midpoint - 1
    right = midpoint
    while left >= 0 and sample_peak[left] <= quiet_threshold:
        left -= 1
    while right < len(joined) and sample_peak[right] <= quiet_threshold:
        right += 1
    return {
        "adjacentStepAcrossRepeat": round(float(np.max(np.abs(audio[0] - audio[-1]))), 9),
        "nearZeroRunAcrossRepeatSeconds": round((right - left - 1) / SR, 9),
        "nearZeroThresholdDbfs": -90,
        "levels400ms": windows,
        "limit": "PCM repeat simulation; native browser loop scheduling still needs browser verification.",
    }


def compact_metrics(metrics: dict) -> dict:
    return {key: metrics[key] for key in (
        "durationSeconds", "integratedLufs", "oversampledPeakDbtp", "samplePeakDbfs",
        "clippedSamples", "maximumAdjacentStep", "dcOffset", "monoCorrelation",
    )}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args()
    output = args.output.resolve()
    require(output == OUTPUT.resolve(), "This export owns only the production music-r3 directory")
    source = Path(__file__).resolve().parent
    report_path = DEFAULT_OUTPUT / "render-report-r3.json"
    sample_manifest_path = DEFAULT_OUTPUT / "source-samples/manifest.json"
    report = json.loads(report_path.read_text(encoding="utf-8"))
    sample_manifest = json.loads(sample_manifest_path.read_text(encoding="utf-8-sig"))
    score = json.loads((source / "score-r3.json").read_text(encoding="utf-8"))
    require(report["scoreSha256"] == digest(source / "score-r3.json"), "Rendered score is stale")
    require(report["rendererSha256"] == digest(source / "render.py"), "Rendered engine is stale")
    require(report["sourceManifestSha256"] == digest(sample_manifest_path), "Sample manifest changed")
    require(score["metadata"]["composerSourceSha256"] == digest(source / "compose-r3.py"),
            "Composer and score differ")
    require([track["id"] for track in report["tracks"]] == list(TRIM_ENDS), "Unexpected scene list")
    codec = av.Codec("libmp3lame", "w")
    output.mkdir(parents=True, exist_ok=True)
    tracks = []
    for track in report["tracks"]:
        identity = track["id"]
        original_path = DEFAULT_OUTPUT / track["scene"]["file"]
        original_hash = digest(original_path)
        require(original_hash == track["scene"]["sha256"] == APPROVED_SCENE_HASHES[identity],
                f"Approved scene master changed: {identity}")
        rate, original = read_pcm(original_path)
        require(rate == SR and original.shape[1] == 2, "Master format differs")
        loop, loop_details = make_loop(original, TRIM_ENDS[identity])
        filename = f"{identity}-r3.mp3"
        destination = output / filename
        encode_mp3(destination, loop, track["title"])
        decoded, decode_details = decode_mp3(destination)
        require(decoded.shape == loop.shape, f"Gapless decoded frame count differs: {identity}")
        head_lag = alignment_lag(loop[:SR * 2], decoded[:SR * 2])
        tail_lag = alignment_lag(loop[-SR * 2:], decoded[-SR * 2:])
        require(head_lag == 0 and tail_lag == 0, f"MP3 adds a head/tail offset: {identity}")
        measured = compact_metrics(measure(decoded))
        pcm_metrics = compact_metrics(measure(loop))
        require(np.isfinite(decoded).all() and measured["clippedSamples"] == 0, "Invalid decoded PCM")
        require(measured["oversampledPeakDbtp"] < -3, "MP3 has insufficient peak headroom")
        loudness_delta = measured["integratedLufs"] - track["scene"]["integratedLufs"]
        require(abs(loudness_delta) < 0.35, f"Scene level changed materially: {identity}")
        codec_delta = measured["integratedLufs"] - pcm_metrics["integratedLufs"]
        require(abs(codec_delta) < 0.2, f"Codec level changed materially: {identity}")
        seams = seam_metrics(decoded)
        require(seams["nearZeroRunAcrossRepeatSeconds"] < 0.01, "Unexpected silent repeat edge")
        gain_fit = float(np.sum(loop * decoded) / max(np.sum(loop * loop), 1e-20))
        residual = decoded - loop
        rms_error_db = db(float(np.sqrt(np.mean(residual * residual))))
        entry = {
            "id": identity, "title": track["title"], "file": filename,
            "url": f"{URL_ROOT}/{filename}", "mimeType": "audio/mpeg",
            "durationSeconds": round(len(decoded) / SR, 6), "bytes": destination.stat().st_size,
            "sha256": digest(destination), "sampleRate": SR, "channels": 2,
            "nominalBitRate": BIT_RATE,
            "source": {"file": track["scene"]["file"], "sha256": original_hash,
                       "durationSeconds": track["scene"]["durationSeconds"],
                       "integratedLufs": track["scene"]["integratedLufs"],
                       "oversampledPeakDbtp": track["scene"]["oversampledPeakDbtp"]},
            "loop": loop_details,
            "pcmBeforeEncoding": pcm_metrics, "decoded": measured,
            "loudnessDeltaFromSceneLu": round(loudness_delta, 3),
            "codecLoudnessDeltaLu": round(codec_delta, 3),
            "codecLeastSquaresGainDb": round(db(abs(gain_fit)), 4),
            "codecRmsDifferenceDbfs": round(rms_error_db, 3),
            "gapless": {**decode_details, "headOffsetSamples": head_lag, "tailOffsetSamples": tail_lag},
            "repeatBoundary": seams,
        }
        tracks.append(entry)
        print(json.dumps({"id": identity, "durationSeconds": entry["durationSeconds"], "bytes": entry["bytes"],
                          "lufs": measured["integratedLufs"], "peakDbtp": measured["oversampledPeakDbtp"],
                          "headOffset": head_lag, "tailOffset": tail_lag}, ensure_ascii=False), flush=True)
    total_bytes = sum(track["bytes"] for track in tracks)
    require(total_bytes < BYTE_BUDGET, "Compressed audio exceeds the 6 MB budget")
    license_source = DEFAULT_OUTPUT / "source-samples/LICENSE-CC0-1.0.txt"
    license_output = output / "LICENSE-CC0-1.0.txt"
    shutil.copyfile(license_source, license_output)
    require(digest(license_output) == digest(license_source), "License copy differs")
    manifest = {
        "schemaVersion": 1, "revision": "r3-approved-web-loop", "date": "2026-09-27",
        "description": "User-approved R3 scene masters, boundary-only adaptation for native repeating playback.",
        "totalAudioBytes": total_bytes, "audioByteBudget": BYTE_BUDGET,
        "gainPolicy": "Original scene gains retained; fixed 1/0.95 input compensation cancels this libmp3lame codec's measured 0.95 attenuation. No per-track normalization, limiting or equalization.",
        "sourceScoreSha256": report["scoreSha256"],
        "sourceRendererSha256": report["rendererSha256"],
        "sourceRenderReportSha256": digest(report_path),
        "sourceSampleManifestSha256": digest(sample_manifest_path),
        "exportScriptSha256": digest(Path(__file__)),
        "encoder": {"pythonPackage": "PyAV", "pyavVersion": av.__version__,
                    "codec": codec.name, "description": codec.long_name,
                    "fixedInputScale": ENCODER_INPUT_SCALE,
                    "fixedInputScaleDb": round(db(ENCODER_INPUT_SCALE), 6),
                    "reason": "Cancel the installed encoder's fixed 0.95 scale; this is not loudness normalization.",
                    "libraries": {key: ".".join(map(str, value)) for key, value in av.library_versions.items()},
                    "configuration": "44.1 kHz stereo; libmp3lame 128000 bit/s; MP3 Xing/Info delay and padding metadata"},
        "measurement": "BS.1770 K-weighting, 400ms gates / 100ms hop; 4x oversampled peak estimate; decoded compressed audio measured",
        "sourceLibrary": sample_manifest["library"],
        "sourceLicense": {"id": "CC0-1.0", "scope": "The source instrument recordings",
                          "url": f"{URL_ROOT}/LICENSE-CC0-1.0.txt", "sha256": digest(license_source)},
        "arrangement": "Original Heluo Digital Museum sampled chamber arrangements; harp is not guqin, flute is not xiao; not a recording of a live ensemble or an historical reconstruction.",
        "samples": [{key: item[key] for key in (
            "instrument", "sourcePath", "sourceUrl", "sourceCommit", "sha256", "rootMidi", "license"
        )} for item in sample_manifest["samples"]],
        "tracks": tracks,
        "verificationLimits": "No new subjective-listening, real-device, long-reading or native browser scheduling claim from these file-level measurements.",
    }
    (output / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"passed": True, "output": str(output), "totalAudioBytes": total_bytes,
                      "budgetBytes": BYTE_BUDGET}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
