"""Render the R4 museum audition scores (4 movements) reusing render.py's DSP engine.

Keeps render.py, compose-r3.py, and all R1/R2/R3 artifacts byte-for-byte untouched.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from fractions import Fraction
from pathlib import Path

import numpy as np
from scipy import signal

import render as r3_render


HERE = Path(__file__).resolve().parent
R4_CALIBRATION = {
    "jade_chime": dict(gain=0.082, attack=0.010, release=1.50, cutoff=5200),
    "dan_tranh": dict(gain=0.095, attack=0.012, release=1.25, cutoff=5400),
    "bronze_bell": dict(gain=0.092, attack=0.014, release=1.65, cutoff=3600),
    "bronze_gong": dict(gain=0.075, attack=0.080, release=1.75, cutoff=2100),
    "wooden_wind": dict(gain=0.062, attack=0.140, release=0.42, cutoff=4200),
}
R4_ROOMS = {
    "jade": dict(decay=1.22, wet=0.165, width=0.64),
}


class R4Sampler(r3_render.Sampler):
    """Loads both the preserved R1-R3 manifest and the audited R4 CC0 manifest."""

    def __init__(self, base_directory: Path, r4_directory: Path, *, strict_tails: bool = True):
        self.base_directory = base_directory
        self.r4_directory = r4_directory
        super().__init__(base_directory, strict_tails=strict_tails)
        for item in self.samples:
            item["_dir"] = base_directory
        self.r4_manifest = json.loads((r4_directory / "manifest.json").read_text(encoding="utf-8-sig"))
        for item in self.r4_manifest["samples"]:
            copy = dict(item)
            copy["_dir"] = r4_directory
            self.samples.append(copy)

    def note_source(self, instrument: str, midi: int, articulation: str = "natural") -> np.ndarray:
        if articulation not in {"natural", "connected"}:
            raise ValueError(f"Unknown articulation: {articulation}")
        if articulation == "connected" and instrument not in {"cello", "viola"}:
            raise ValueError("Connected entry is supported only for bowed samples")
        key = (instrument, midi, articulation)
        if key in self.cache:
            return self.cache[key]
        candidates = [x for x in self.samples if x["instrument"] == instrument]
        if not candidates:
            raise ValueError(f"No verified sample for {instrument}")
        selected = min(candidates, key=lambda x: abs(x["rootMidi"] - midi))
        if abs(selected["rootMidi"] - midi) > 5:
            raise ValueError(f"A closer acoustic sample is required for {instrument} MIDI {midi}")
        sample_dir = Path(selected["_dir"])
        sample_path = (sample_dir / selected["relativePath"]).resolve()
        if not sample_path.is_relative_to(sample_dir.resolve()):
            raise ValueError("Sample path escapes its directory")
        expected = selected.get("sha256")
        if expected and hashlib.sha256(sample_path.read_bytes()).hexdigest().lower() != expected.lower():
            raise ValueError(f"Sample hash mismatch: {sample_path.name}")
        source_rate, stereo = r3_render.read_pcm(sample_path)
        source = stereo.mean(axis=1)
        peak = float(np.max(np.abs(source)))
        active = np.flatnonzero(np.abs(source) > max(peak * 0.008, 1e-6))
        if not len(active):
            raise ValueError(f"Silent source: {sample_path.name}")
        onset = max(0, int(active[0]) - round(source_rate * 0.012))
        source = source[onset:]
        source -= source.mean()
        cents = float(selected.get("tuneCents", 0))
        pitch_ratio = 2 ** ((midi - selected["rootMidi"] - cents / 100) / 12)
        fraction = Fraction(r3_render.SR / (source_rate * pitch_ratio)).limit_denominator(512)
        result = signal.resample_poly(source, fraction.numerator, fraction.denominator)
        cutoff = r3_render.CALIBRATION[instrument]["cutoff"]
        result = signal.sosfilt(signal.butter(2, [65, cutoff], btype="bandpass", fs=r3_render.SR, output="sos"), result)
        connected_offset = 0
        if articulation == "connected":
            window, hop = round(0.020 * r3_render.SR), round(0.010 * r3_render.SR)
            positions = np.arange(0, min(len(result), 3 * r3_render.SR) - window + 1, hop)
            rms_windows = np.array([np.sqrt(np.mean(result[i:i + window] ** 2)) for i in positions])
            body_reference = float(np.percentile(rms_windows[positions >= round(0.5 * r3_render.SR)], 80))
            stable = rms_windows >= body_reference * 10 ** (-6 / 20)
            consecutive = np.convolve(stable.astype(int), np.ones(5, dtype=int), mode="valid")
            found = np.flatnonzero(consecutive == 5)
            if not len(found) or body_reference < 1e-8:
                raise ValueError(f"No stable bowed entry: {sample_path.name} MIDI {midi}")
            connected_offset = max(0, int(positions[found[0]]) - round(0.080 * r3_render.SR))
            if connected_offset > 2 * r3_render.SR:
                raise ValueError(f"Bowed entry is too late: {sample_path.name} MIDI {midi}")
            result = result[connected_offset:]
        body = result[round(r3_render.SR * 0.08):min(len(result), round(r3_render.SR * 1.15))]
        rms = float(np.sqrt(np.mean(body ** 2)))
        result /= max(rms, float(np.max(np.abs(result))) / 4.0, 1e-8)
        self.used[f"{selected['relativePath']}:{midi}:{articulation}"] = {
            "instrument": instrument,
            "rootMidi": selected["rootMidi"],
            "tuneCents": cents,
            "renderedMidi": midi,
            "articulation": articulation,
            "source": selected["relativePath"],
            "sha256": expected,
            "sourceRate": source_rate,
            "trimmedLeadingSeconds": round(onset / source_rate, 5),
            "connectedEntrySeconds": round(connected_offset / r3_render.SR, 5),
        }
        self.cache[key] = result
        return result


def write_preview_r4(output: Path, report: dict) -> None:
    template = (HERE / "listening.html").read_text(encoding="utf-8")
    labels = {
        "r4": "R4 · 东方点缀与玉石",
        "r3": "R3 · 乐章新作",
        "r2": "R2 · 连贯修订",
        "r1": "R1 · 原稿",
    }
    revisions = [{"id": "r4", "label": labels["r4"], "tracks": report["tracks"]}]
    for previous in ("r3", "r2", "r1"):
        baseline = output / ("render-report.json" if previous == "r1" else f"render-report-{previous}.json")
        if baseline.exists():
            original = json.loads(baseline.read_text(encoding="utf-8"))
            revisions.append({"id": previous, "label": labels[previous], "tracks": original["tracks"]})
    data = json.dumps({
        "tracks": report["tracks"],
        "revisions": revisions,
        "defaultRevision": "r4",
        "defaultTrack": "jade",
    }, ensure_ascii=False).replace("</", "<\\/")
    (output / "index.html").write_text(template.replace("__REPORT__", data), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--score", type=Path, default=HERE / "score-r4.json")
    parser.add_argument("--output", type=Path, default=r3_render.DEFAULT_OUTPUT)
    parser.add_argument("--preview-only", action="store_true")
    args = parser.parse_args()

    output = args.output.resolve()
    report_path = output / "render-report-r4.json"
    if args.preview_only:
        report = json.loads(report_path.read_text(encoding="utf-8"))
        write_preview_r4(output, report)
        return

    r3_render.CALIBRATION.update(R4_CALIBRATION)
    r3_render.ROOMS.update(R4_ROOMS)
    r3_render.self_check()

    score = json.loads(args.score.read_text(encoding="utf-8-sig"))
    if [x["id"] for x in score["tracks"]] != ["home", "reading", "bronze", "jade"]:
        raise ValueError("Expected the four R4 scene IDs: home, reading, bronze, jade")

    output.mkdir(parents=True, exist_ok=True)
    sampler = R4Sampler(output / "source-samples", output / "source-samples-r4", strict_tails=True)
    rendered = []
    common_target = r3_render.TARGET_LUFS
    for index, track in enumerate(score["tracks"]):
        print(f"Rendering R4 {track['id']} ...", flush=True)
        audio, arrangement = r3_render.render_track(track, sampler, 20261123 + index, chamber_mix=True)
        loudness = r3_render.integrated_loudness(audio)
        peak_db = r3_render.db(r3_render.true_peak(audio))
        common_target = min(common_target, loudness + r3_render.TRUE_PEAK_CEILING - peak_db)
        rendered.append((track, audio, arrangement, loudness))

    report = {
        "version": "audition-r4",
        "revision": "r4",
        "sampleRate": r3_render.SR,
        "commonTargetLufs": round(common_target, 3),
        "measurement": "BS.1770 K-weighting, 400ms gates / 100ms hop; 4x oversampled peak estimate",
        "scoreSha256": hashlib.sha256(args.score.read_bytes()).hexdigest(),
        "rendererSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "r3RendererSha256": hashlib.sha256((HERE / "render.py").read_bytes()).hexdigest(),
        "sourceManifestSha256": hashlib.sha256((output / "source-samples/manifest.json").read_bytes()).hexdigest(),
        "sourceManifestR4Sha256": hashlib.sha256((output / "source-samples-r4/manifest.json").read_bytes()).hexdigest(),
        "tracks": [],
        "usedSamples": list(sampler.used.values()),
        "subjectiveListening": "pending user review at http://127.0.0.1:4197/?revision=r4; metrics do not establish aesthetic approval",
    }

    for index, (track, audio, arrangement, loudness) in enumerate(rendered):
        audio *= 10 ** ((common_target - loudness) / 20)
        filename = f"{index + 1:02d}-{track['id']}-audition-r4.wav"
        metrics = r3_render.write_wave(output / filename, audio, 401 + index)
        scene_gain = float(track["sceneGain"])
        scene_name = f"{index + 1:02d}-{track['id']}-scene-r4.wav"
        scene_metrics = r3_render.write_wave(output / scene_name, audio * scene_gain, 501 + index)
        if metrics["clippedSamples"] or metrics["oversampledPeakDbtp"] > r3_render.TRUE_PEAK_CEILING + 0.03:
            raise ValueError(f"Headroom verification failed: {filename}")
        if abs(metrics["integratedLufs"] - common_target) > 0.12:
            raise ValueError(f"Loudness matching failed: {filename}")
        if metrics["first20msPeak"] > 0.002 or metrics["last20msPeak"] > 0.002:
            raise ValueError(f"Audition boundary verification failed: {filename}")
        report["tracks"].append({
            "id": track["id"],
            "title": track["title"],
            "description": track["description"],
            "tempo": track["tempo"],
            "sections": track["sections"],
            "arrangement": arrangement,
            "audition": {"file": filename, **metrics},
            "scene": {"file": scene_name, "gain": scene_gain, **scene_metrics},
        })
        print(
            f"Verified {filename}: {metrics['integratedLufs']} LUFS (scene {scene_metrics['integratedLufs']} LUFS), "
            f"{metrics['oversampledPeakDbtp']} dBTP",
            flush=True,
        )

    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_preview_r4(output, report)
    print(f"All eight R4 WAV files rendered and validated in {output}", flush=True)


if __name__ == "__main__":
    main()
