"""Render the museum audition scores with attributed acoustic samples.

Offline design tool only; it neither imports nor changes the site's audio engine.
Requires NumPy and SciPy. Generated media and measurements live in artifacts/.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from collections import Counter
from fractions import Fraction
from pathlib import Path

import numpy as np
from scipy import signal
from scipy.io import wavfile


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT = ROOT / "artifacts/music-audition-2026-09-27"
SR = 44100
TARGET_LUFS = -24.0
TRUE_PEAK_CEILING = -3.0
CALIBRATION = {
    "harp": dict(gain=0.12, attack=0.014, release=1.25, cutoff=6200),
    "piano": dict(gain=0.105, attack=0.017, release=1.05, cutoff=4700),
    "flute": dict(gain=0.067, attack=0.13, release=0.28, cutoff=4900),
    "cello": dict(gain=0.071, attack=0.20, release=0.62, cutoff=4200),
    "viola": dict(gain=0.056, attack=0.23, release=0.58, cutoff=4600),
    "felt_pluck": dict(gain=0.080, attack=0.022, release=1.20, cutoff=4500),
}
ROLE_GAIN = {"melody": 1.0, "response": 0.70, "harmony": 0.48, "bass": 0.45}
ROOMS = {
    "home": dict(decay=1.15, wet=0.17, width=0.68),
    "reading": dict(decay=1.05, wet=0.135, width=0.48),
    "bronze": dict(decay=1.48, wet=0.20, width=0.72),
}


def db(value: float) -> float:
    return float(20 * np.log10(max(value, 1e-12)))


def read_pcm(path: Path) -> tuple[int, np.ndarray]:
    rate, audio = wavfile.read(path)
    if np.issubdtype(audio.dtype, np.integer):
        if audio.dtype == np.uint8:
            audio = (audio.astype(np.float64) - 128) / 128
        else:
            audio = audio.astype(np.float64) / -float(np.iinfo(audio.dtype).min)
    else:
        audio = audio.astype(np.float64)
    if audio.ndim == 1:
        audio = audio[:, None]
    if audio.shape[1] > 2:
        raise ValueError(f"Unexpected channel count: {path}")
    if not np.isfinite(audio).all() or len(audio) < rate // 10:
        raise ValueError(f"Invalid or too short source: {path}")
    return int(rate), audio


def cosine_ramp(count: int) -> np.ndarray:
    return 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, max(2, count)))


def harmony_relief(audio: np.ndarray) -> np.ndarray:
    # A broad 1.2 dB cut gives the melodic body space without dulling the mix.
    amplitude = 10 ** (-1.2 / 40)
    omega = 2 * np.pi * 330 / SR
    alpha = np.sin(omega) / (2 * 0.7)
    b = [1 + alpha * amplitude, -2 * np.cos(omega), 1 - alpha * amplitude]
    a = [1 + alpha / amplitude, -2 * np.cos(omega), 1 - alpha / amplitude]
    return signal.lfilter(b, a, audio, axis=0)


def k_weight(audio: np.ndarray) -> np.ndarray:
    # ITU-R BS.1770 pre-filter and RLB high-pass, De Man coefficient form.
    k = np.tan(np.pi * 1681.974450955533 / SR)
    q = 0.7071752369554196
    vh = 10 ** (3.999843853973347 / 20)
    vb = vh ** 0.4996667741545416
    norm = 1 + k / q + k * k
    b = [(vh + vb * k / q + k * k) / norm,
         2 * (k * k - vh) / norm,
         (vh - vb * k / q + k * k) / norm]
    a = [1, 2 * (k * k - 1) / norm, (1 - k / q + k * k) / norm]
    weighted = signal.lfilter(b, a, audio, axis=0)
    k = np.tan(np.pi * 38.13547087602444 / SR)
    q = 0.5003270373238773
    norm = 1 + k / q + k * k
    a = [1, 2 * (k * k - 1) / norm, (1 - k / q + k * k) / norm]
    return signal.lfilter([1, -2, 1], a, weighted, axis=0)


def integrated_loudness(audio: np.ndarray) -> float:
    weighted = k_weight(audio)
    window, hop = round(0.4 * SR), round(0.1 * SR)
    energies = np.array([
        np.sum(np.mean(weighted[i:i + window] ** 2, axis=0))
        for i in range(0, len(audio) - window + 1, hop)
    ])
    levels = -0.691 + 10 * np.log10(np.maximum(energies, 1e-20))
    absolute = energies[levels > -70]
    if not len(absolute):
        return -120.0
    relative_gate = -0.691 + 10 * np.log10(absolute.mean()) - 10
    included = energies[(levels > -70) & (levels > relative_gate)]
    return float(-0.691 + 10 * np.log10(included.mean()))


def true_peak(audio: np.ndarray) -> float:
    return float(np.max(np.abs(signal.resample_poly(audio, 4, 1, axis=0))))


def measure(audio: np.ndarray) -> dict:
    mono = audio.mean(axis=1)
    frequencies, power = signal.welch(mono, fs=SR, nperseg=8192)
    total = max(float(power.sum()), 1e-20)
    # These metrics identify technical outliers; they do not rate musical taste.
    bands = {}
    for name, low, high in [("below80", 0, 80), ("80to250", 80, 250),
                            ("250to2000", 250, 2000), ("2000to5000", 2000, 5000),
                            ("above5000", 5000, SR / 2 + 1)]:
        bands[name] = round(float(power[(frequencies >= low) & (frequencies < high)].sum()) / total * 100, 4)
    short_levels = []
    weighted = k_weight(audio)
    for i in range(0, len(audio) - SR * 3 + 1, SR):
        energy = np.sum(np.mean(weighted[i:i + SR * 3] ** 2, axis=0))
        short_levels.append(float(-0.691 + 10 * np.log10(max(energy, 1e-20))))
    return {
        "durationSeconds": round(len(audio) / SR, 5),
        "sampleRate": SR,
        "channels": int(audio.shape[1]),
        "integratedLufs": round(integrated_loudness(audio), 3),
        "samplePeakDbfs": round(db(float(np.abs(audio).max())), 3),
        "oversampledPeakDbtp": round(db(true_peak(audio)), 3),
        "rmsDbfs": round(db(float(np.sqrt(np.mean(audio ** 2)))), 3),
        "clippedSamples": int(np.count_nonzero(np.abs(audio) >= 1)),
        "maximumAdjacentStep": round(float(np.abs(np.diff(audio, axis=0)).max()), 7),
        "first20msPeak": round(float(np.abs(audio[:round(SR * 0.02)]).max()), 8),
        "last20msPeak": round(float(np.abs(audio[-round(SR * 0.02):]).max()), 8),
        "dcOffset": round(float(np.abs(audio.mean(axis=0)).max()), 8),
        "monoCorrelation": round(float(np.corrcoef(audio.T)[0, 1]), 4),
        "spectralEnergyPercent": bands,
        "shortTermLufs": [round(x, 2) for x in short_levels],
    }


class Sampler:
    def __init__(self, directory: Path, *, strict_tails: bool = False):
        self.directory = directory
        self.strict_tails = strict_tails
        self.manifest = json.loads((directory / "manifest.json").read_text(encoding="utf-8-sig"))
        self.samples = self.manifest["samples"]
        self.cache: dict[tuple[str, int, str], np.ndarray] = {}
        self.used: dict[str, dict] = {}

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
        sample_path = (self.directory / selected["relativePath"]).resolve()
        if not sample_path.is_relative_to(self.directory.resolve()):
            raise ValueError("Sample path escapes its directory")
        expected = selected.get("sha256")
        if expected and hashlib.sha256(sample_path.read_bytes()).hexdigest().lower() != expected.lower():
            raise ValueError(f"Sample hash mismatch: {sample_path.name}")
        source_rate, stereo = read_pcm(sample_path)
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
        fraction = Fraction(SR / (source_rate * pitch_ratio)).limit_denominator(512)
        result = signal.resample_poly(source, fraction.numerator, fraction.denominator)
        cutoff = CALIBRATION[instrument]["cutoff"]
        result = signal.sosfilt(signal.butter(2, [65, cutoff], btype="bandpass", fs=SR, output="sos"), result)
        connected_offset = 0
        if articulation == "connected":
            # These samples have uneven swell lengths. Align a joined note with
            # its audible bowed body, then retain a short natural approach.
            # This is sample crossfading, not a recorded legato articulation.
            window, hop = round(0.020 * SR), round(0.010 * SR)
            positions = np.arange(0, min(len(result), 3 * SR) - window + 1, hop)
            rms_windows = np.array([np.sqrt(np.mean(result[i:i + window] ** 2)) for i in positions])
            body_reference = float(np.percentile(rms_windows[positions >= round(0.5 * SR)], 80))
            stable = rms_windows >= body_reference * 10 ** (-6 / 20)
            consecutive = np.convolve(stable.astype(int), np.ones(5, dtype=int), mode="valid")
            candidates = np.flatnonzero(consecutive == 5)
            if not len(candidates) or body_reference < 1e-8:
                raise ValueError(f"No stable bowed entry: {sample_path.name} MIDI {midi}")
            connected_offset = max(0, int(positions[candidates[0]]) - round(0.080 * SR))
            if connected_offset > 2 * SR:
                raise ValueError(f"Bowed entry is too late: {sample_path.name} MIDI {midi}")
            result = result[connected_offset:]
        # Calibrate source loudness over the played body, retaining its transient.
        body = result[round(SR * 0.08):min(len(result), round(SR * 1.15))]
        rms = float(np.sqrt(np.mean(body ** 2)))
        result /= max(rms, float(np.max(np.abs(result))) / 4.0, 1e-8)
        self.used[f"{selected['relativePath']}:{midi}:{articulation}"] = {
            "instrument": instrument, "rootMidi": selected["rootMidi"],
            "renderedMidi": midi, "articulation": articulation,
            "source": selected["relativePath"], "sha256": expected,
            "sourceRate": source_rate, "trimmedLeadingSeconds": round(onset / source_rate, 5),
            "connectedEntrySeconds": round(connected_offset / SR, 5),
        }
        self.cache[key] = result
        return result

    def render_note(self, event: dict, rng: np.random.Generator) -> np.ndarray:
        instrument = event["instrument"]
        articulation = event.get("articulation", "natural")
        if articulation not in {"natural", "connected"} or (
            articulation == "connected" and instrument not in {"cello", "viola"}
        ):
            raise ValueError(f"Invalid articulation for {instrument}: {articulation}")
        config = dict(CALIBRATION[instrument])
        if articulation == "connected":
            config.update(attack=0.12, release=0.32)
        for parameter, lower, upper in (("attack", 0.008, 0.6), ("release", 0.12, 1.8)):
            if parameter in event:
                value = float(event[parameter])
                if not np.isfinite(value) or not lower <= value <= upper:
                    raise ValueError(f"Invalid {parameter}: {value}")
                config[parameter] = value
        duration = float(event["d"])
        if not np.isfinite(duration) or duration < 0.08:
            raise ValueError(f"Invalid note duration: {duration}")
        count = round((duration + config["release"]) * SR)
        if instrument == "felt_pluck":
            # An explicitly synthetic supporting voice, never labeled as qin.
            t = np.arange(count) / SR
            frequency = 440 * 2 ** ((event["midi"] - 69) / 12)
            voice = np.zeros(count)
            for harmonic in range(1, 11):
                amplitude = 1 / harmonic ** 1.8
                decay = np.exp(-t * (0.7 + 0.21 * harmonic))
                voice += amplitude * decay * np.sin(2 * np.pi * frequency * harmonic * t + rng.uniform(-0.12, 0.12))
            voice *= 1.3
        else:
            source = self.note_source(instrument, int(event["midi"]), articulation)
            needs_full_tail = articulation == "connected" or (
                self.strict_tails and instrument in {"flute", "cello", "viola"}
            )
            if needs_full_tail and len(source) < count:
                raise ValueError(f"Sustain plus release is too long: {instrument} MIDI {event['midi']}")
            voice = np.zeros(count)
            copied = min(len(source), count)
            voice[:copied] = source[:copied]
            if len(source) < round(duration * SR) and instrument in {"flute", "cello", "viola"}:
                raise ValueError(f"Sustain sample too short: {instrument} MIDI {event['midi']} needs {duration}s")
        attack = min(round(config["attack"] * SR), count // 4)
        voice[:attack] *= cosine_ramp(attack)
        off = min(round(duration * SR), count - 2)
        voice[off:] *= cosine_ramp(count - off)[::-1]
        if "expression" in event:
            # Three authored levels shape a phrase gently, without imposing
            # periodic tremolo or claiming a recorded legato articulation.
            expression = np.asarray(event["expression"], dtype=np.float64)
            if expression.shape != (3,) or not np.isfinite(expression).all() or (
                np.any(expression < 0.5) or np.any(expression > 1.25)
            ):
                raise ValueError(f"Invalid expression envelope: {event['expression']}")
            apex = max(2, round(off * 0.48))
            shape = np.empty(count)
            shape[:apex] = expression[0] + (expression[1] - expression[0]) * cosine_ramp(apex)
            shape[apex:off] = expression[1] + (expression[2] - expression[1]) * cosine_ramp(off - apex)
            shape[off:] = expression[2]
            voice *= shape
        voice[-min(220, count):] *= np.linspace(1, 0, min(220, count))
        velocity = float(event["velocity"])
        gain = config["gain"] * velocity ** 1.25 * ROLE_GAIN[event["role"]]
        voice *= gain
        pan = max(-0.8, min(0.8, float(event.get("pan", 0))))
        theta = (pan + 1) * np.pi / 4
        return np.column_stack([voice * np.cos(theta), voice * np.sin(theta)])


def room_response(decay: float, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    length = round((decay * 1.8 + 0.10) * SR)
    t = np.arange(length) / SR
    impulse = rng.normal(0, 1, (length, 2))
    impulse = signal.sosfilt(signal.butter(2, [220, 4200], btype="bandpass", fs=SR, output="sos"), impulse, axis=0)
    impulse *= (np.exp(-6.9078 * t / decay) * np.minimum(t / 0.055, 1))[:, None]
    impulse[:round(0.036 * SR)] = 0
    impulse /= np.sqrt(np.sum(impulse ** 2, axis=0))[None, :]
    for delay, gain, side in [(0.022, 0.46, 0), (0.031, 0.43, 1), (0.047, 0.31, 1),
                              (0.064, 0.29, 0), (0.083, 0.21, 0), (0.099, 0.19, 1)]:
        impulse[round(delay * SR), side] += gain
    return impulse


def render_track(track: dict, sampler: Sampler, seed: int, *, chamber_mix: bool = False) -> tuple[np.ndarray, dict]:
    duration = float(track["duration"])
    total = round(duration * SR)
    if not 45 <= duration <= 180:
        raise ValueError("Audition must be 45–180 seconds")
    audio = np.zeros((total, 2), dtype=np.float64)
    sends = np.zeros_like(audio)
    harmony = np.zeros_like(audio) if chamber_mix else None
    rng = np.random.default_rng(seed)
    events = sorted(track["events"], key=lambda event: event["t"])
    for event in events:
        if not (0 <= event["t"] < duration and event["d"] > 0 and 0 < event["velocity"] <= 1):
            raise ValueError(f"Invalid event: {event}")
        if event["t"] + event["d"] > duration - 2.0:
            raise ValueError("Score leaves insufficient tail")
        note = sampler.render_note(event, rng)
        # Human timing stays deterministic, small, and independent of melody order.
        timing = float(rng.normal(0, 0.010)) if event["role"] != "bass" else 0
        start = max(0, round((float(event["t"]) + timing) * SR))
        count = min(len(note), total - start)
        audio[start:start + count] += note[:count]
        if chamber_mix:
            send = {"melody": 0.75, "response": 0.85, "harmony": 1.0, "bass": 0.65}[event["role"]]
            if event["role"] == "harmony":
                harmony[start:start + count] += note[:count]
        else:
            send = 0.78 if event["role"] == "bass" else 1.0
        sends[start:start + count] += note[:count] * send
    if harmony is not None:
        correction = harmony_relief(harmony) - harmony
        audio += correction
        sends += correction
    config = dict(ROOMS[track["id"]])
    if "room" in track:
        for parameter, lower, upper in (("decay", 0.6, 2.0), ("wet", 0.08, 0.24), ("width", 0.35, 0.85)):
            if parameter in track["room"]:
                value = float(track["room"][parameter])
                if not np.isfinite(value) or not lower <= value <= upper:
                    raise ValueError(f"Invalid room {parameter}: {value}")
                config[parameter] = value
    impulse = room_response(config["decay"], seed + 500)
    wet = np.column_stack([
        signal.fftconvolve(sends[:, 0] * 0.76 + sends[:, 1] * 0.24, impulse[:, 0])[:total],
        signal.fftconvolve(sends[:, 1] * 0.76 + sends[:, 0] * 0.24, impulse[:, 1])[:total],
    ])
    dry_rms = np.sqrt(np.mean(audio ** 2))
    wet_rms = np.sqrt(np.mean(wet ** 2))
    audio += wet * (config["wet"] * dry_rms / max(wet_rms, 1e-12))
    mid = audio.mean(axis=1)
    side = (audio[:, 0] - audio[:, 1]) * 0.5 * config["width"]
    audio = np.column_stack([mid + side, mid - side])
    audio = signal.sosfilt(signal.butter(2, 52, btype="highpass", fs=SR, output="sos"), audio, axis=0)
    # Opening/ending fades make the independent audition files click-free.
    audio[:round(0.30 * SR)] *= cosine_ramp(round(0.30 * SR))[:, None]
    audio[-round(2.2 * SR):] *= cosine_ramp(round(2.2 * SR))[::-1, None]
    counts = Counter(event["instrument"] for event in events)
    return audio, {"events": len(events), "instruments": dict(counts), "room": config,
                   "mixProfile": "chamber" if chamber_mix else "original",
                   "expressiveEvents": sum("expression" in event for event in events),
                   "lastNoteOff": round(max(x["t"] + x["d"] for x in events), 3)}


def write_wave(path: Path, audio: np.ndarray, seed: int) -> dict:
    if not np.isfinite(audio).all() or float(np.abs(audio).max()) >= 1:
        raise ValueError("Invalid or clipped floating-point mix")
    # Deterministic TPDF dither before 16-bit delivery, exactly silent endpoints.
    rng = np.random.default_rng(seed)
    dither = (rng.random(audio.shape) - rng.random(audio.shape)) / 65536
    quantized = np.round(np.clip(audio + dither, -0.999969, 0.999969) * 32767).astype(np.int16)
    quantized[0] = 0
    quantized[-1] = 0
    wavfile.write(path, SR, quantized)
    rate, decoded = read_pcm(path)
    if rate != SR or decoded.shape != audio.shape:
        raise ValueError("WAV roundtrip mismatch")
    result = measure(decoded)
    result["bytes"] = path.stat().st_size
    result["sha256"] = hashlib.sha256(path.read_bytes()).hexdigest()
    return result


def self_check() -> None:
    # A numerical calibration signal is more meaningful than checking constants.
    t = np.arange(SR * 4) / SR
    reference = np.column_stack([0.1 * np.sin(2 * np.pi * 1000 * t)] * 2)
    loudness = integrated_loudness(reference)
    if not -20.15 < loudness < -19.75:
        raise ValueError(f"K-weighting calibration failed: {loudness}")
    silence = integrated_loudness(np.zeros((SR, 2)))
    if silence != -120:
        raise ValueError("Silence calibration failed")
    print(f"Loudness calibration: 1kHz stereo sine {loudness:.3f} LUFS; silence OK", flush=True)


def write_preview(output: Path, report: dict) -> None:
    template = Path(__file__).with_name("listening.html").read_text(encoding="utf-8")
    revision = report.get("revision", "r1")
    labels = {"r3": "R3 · 乐章新作", "r2": "R2 · 连贯修订", "r1": "R1 · 原稿"}
    revisions = [{"id": revision, "label": labels[revision], "tracks": report["tracks"]}]
    for previous in ("r2", "r1"):
        if previous >= revision:
            continue
        baseline = output / ("render-report.json" if previous == "r1" else f"render-report-{previous}.json")
        if baseline.exists():
            original = json.loads(baseline.read_text(encoding="utf-8"))
            revisions.append({"id": previous, "label": labels[previous], "tracks": original["tracks"]})
    data = json.dumps({"tracks": report["tracks"], "revisions": revisions,
                       "defaultRevision": revision,
                       "defaultTrack": "bronze" if revision in {"r2", "r3"} else "home"},
                      ensure_ascii=False).replace("</", "<\\/")
    (output / "index.html").write_text(template.replace("__REPORT__", data), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--score", type=Path)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--revision", choices=("r1", "r2", "r3"), default="r1")
    parser.add_argument("--preview-only", action="store_true")
    args = parser.parse_args()
    args.score = args.score or Path(__file__).with_name("score.json" if args.revision == "r1" else f"score-{args.revision}.json")
    report_path = args.output / ("render-report.json" if args.revision == "r1" else f"render-report-{args.revision}.json")
    if args.preview_only:
        report = json.loads(report_path.read_text(encoding="utf-8"))
        write_preview(args.output, report)
        return
    self_check()
    score = json.loads(args.score.read_text(encoding="utf-8-sig"))
    if [x["id"] for x in score["tracks"]] != ["home", "reading", "bronze"]:
        raise ValueError("Expected the three agreed scene IDs")
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    sampler = Sampler(output / "source-samples", strict_tails=args.revision == "r3")
    rendered = []
    common_target = TARGET_LUFS
    for index, track in enumerate(score["tracks"]):
        print(f"Rendering {track['id']} ...", flush=True)
        audio, arrangement = render_track(track, sampler, 20260927 + index,
                                          chamber_mix=args.revision == "r3")
        loudness = integrated_loudness(audio)
        peak_db = db(true_peak(audio))
        common_target = min(common_target, loudness + TRUE_PEAK_CEILING - peak_db)
        rendered.append((track, audio, arrangement, loudness))
    report = {
        "version": f"audition-{args.revision}", "revision": args.revision, "sampleRate": SR,
        "commonTargetLufs": round(common_target, 3),
        "measurement": "BS.1770 K-weighting, 400ms gates / 100ms hop; 4x oversampled peak estimate",
        "scoreSha256": hashlib.sha256(args.score.read_bytes()).hexdigest(),
        "rendererSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "sourceManifestSha256": hashlib.sha256((sampler.directory / 'manifest.json').read_bytes()).hexdigest(),
        "tracks": [], "usedSamples": list(sampler.used.values()),
        "subjectiveListening": "pending user review; metrics do not establish aesthetic approval",
    }
    for index, (track, audio, arrangement, loudness) in enumerate(rendered):
        audio *= 10 ** ((common_target - loudness) / 20)
        filename = f"{index + 1:02d}-{track['id']}-audition-{args.revision}.wav"
        metrics = write_wave(output / filename, audio, 101 + index)
        scene_gain = float(track["sceneGain"])
        scene_name = f"{index + 1:02d}-{track['id']}-scene-{args.revision}.wav"
        scene_metrics = write_wave(output / scene_name, audio * scene_gain, 301 + index)
        if metrics["clippedSamples"] or metrics["oversampledPeakDbtp"] > TRUE_PEAK_CEILING + 0.03:
            raise ValueError(f"Headroom verification failed: {filename}")
        if abs(metrics["integratedLufs"] - common_target) > 0.12:
            raise ValueError(f"Loudness matching failed: {filename}")
        if metrics["first20msPeak"] > 0.002 or metrics["last20msPeak"] > 0.002:
            raise ValueError(f"Audition boundary verification failed: {filename}")
        report["tracks"].append({
            "id": track["id"], "title": track["title"], "description": track["description"],
            "tempo": track["tempo"], "sections": track["sections"], "arrangement": arrangement,
            "audition": {"file": filename, **metrics},
            "scene": {"file": scene_name, "gain": scene_gain, **scene_metrics},
        })
        print(f"Verified {filename}: {metrics['integratedLufs']} LUFS, {metrics['oversampledPeakDbtp']} dBTP", flush=True)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_preview(output, report)
    print(f"All six WAV files rendered and validated in {output}", flush=True)


if __name__ == "__main__":
    main()
