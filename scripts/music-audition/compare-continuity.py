"""Compare delivered revisions without treating continuity metrics as taste."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np

from render import DEFAULT_OUTPUT, SR, k_weight, read_pcm


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def momentary(path: Path) -> tuple[np.ndarray, np.ndarray]:
    rate, audio = read_pcm(path)
    if rate != SR or audio.shape[1] != 2:
        raise ValueError(f"Unexpected audio format: {path}")
    weighted = k_weight(audio)
    window, hop = round(0.4 * SR), round(0.1 * SR)
    starts = np.arange(0, len(audio) - window + 1, hop)
    energy = np.array([np.sum(np.mean(weighted[i:i + window] ** 2, axis=0)) for i in starts])
    return starts / SR + 0.2, -0.691 + 10 * np.log10(np.maximum(energy, 1e-20))


def low_runs(times: np.ndarray, levels: np.ndarray) -> list[dict]:
    selected = (times >= 1) & (times <= 51) & (levels < -40)
    changes = np.diff(np.concatenate(([False], selected, [False])).astype(int))
    result = []
    for start, end in zip(np.flatnonzero(changes == 1), np.flatnonzero(changes == -1)):
        if end - start >= 3:
            result.append({"firstWindowCenter": round(float(times[start]), 2),
                           "lastWindowCenter": round(float(times[end - 1]), 2),
                           "windowCount": int(end - start),
                           "minimumLufs": round(float(levels[start:end].min()), 2)})
    return result


def main() -> None:
    original = json.loads((DEFAULT_OUTPUT / "render-report.json").read_text(encoding="utf-8"))
    revision = json.loads((DEFAULT_OUTPUT / "render-report-r2.json").read_text(encoding="utf-8"))
    snapshot = DEFAULT_OUTPUT / "r1-source"
    if sha256(snapshot / "render-report.json") != sha256(DEFAULT_OUTPUT / "render-report.json"):
        raise ValueError("Original render report was changed")
    if sha256(snapshot / "score.json") != sha256(Path(__file__).with_name("score.json")):
        raise ValueError("Original score was changed")
    result = {
        "method": "400ms BS.1770 K-weighted ungated windows, 100ms hop; centers restricted to 1–51s",
        "limit": "Low windows are diagnostic, not silence or proof of musical continuity. No subjective listening.",
        "originalPreserved": True,
        "tracks": [],
    }
    for before, after in zip(original["tracks"], revision["tracks"], strict=True):
        if before["id"] != after["id"]:
            raise ValueError("Scene ordering differs")
        for item in (before, after):
            for mode in ("audition", "scene"):
                asset = item[mode]
                if sha256(DEFAULT_OUTPUT / asset["file"]) != asset["sha256"]:
                    raise ValueError(f"Output hash differs: {asset['file']}")
        delta = after["audition"]["integratedLufs"] - before["audition"]["integratedLufs"]
        if abs(delta) > 0.12:
            raise ValueError("Versions are not loudness matched")
        comparison = {"id": before["id"], "loudnessDeltaLu": round(delta, 3)}
        for name, track in (("r1", before), ("r2", after)):
            times, levels = momentary(DEFAULT_OUTPUT / track["audition"]["file"])
            interior = (times >= 1) & (times <= 51)
            measurement = {"lowWindowsBelowMinus40": int(np.count_nonzero(levels[interior] < -40)),
                           "lowRuns": low_runs(times, levels)}
            if track["id"] == "bronze":
                measurement["handoffs"] = [{
                    "seconds": [start, end],
                    "minimumLufs": round(float(levels[(times >= start) & (times <= end)].min()), 2),
                } for start, end in ((16.8, 18.2), (37.5, 38.2))]
            comparison[name] = measurement
        result["tracks"].append(comparison)
    (DEFAULT_OUTPUT / "continuity-comparison-r2.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
