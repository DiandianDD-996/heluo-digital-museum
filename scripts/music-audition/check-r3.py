"""Check rendered chapters and preserved auditions; do not score aesthetics."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np

from render import DEFAULT_OUTPUT, SR, k_weight, measure, read_pcm


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def phrase_levels(audio: np.ndarray, sections: list[dict]) -> list[dict]:
    weighted = k_weight(audio)
    result = []
    for section in sections:
        start, end = round(section["start"] * SR), round(section["end"] * SR)
        part = weighted[start:end]
        energy = float(np.sum(np.mean(part ** 2, axis=0)))
        result.append({"label": section["label"], "start": section["start"], "end": section["end"],
                       "ungatedLufs": round(-0.691 + 10 * np.log10(max(energy, 1e-20)), 2)})
    return result


def main() -> None:
    source = Path(__file__).parent
    score = json.loads((source / "score-r3.json").read_text(encoding="utf-8"))
    report = json.loads((DEFAULT_OUTPUT / "render-report-r3.json").read_text(encoding="utf-8"))
    require(report["scoreSha256"] == digest(source / "score-r3.json"), "R3 score changed after rendering")
    require(report["rendererSha256"] == digest(source / "render.py"), "Renderer changed after rendering")
    require(report["sourceManifestSha256"] == digest(DEFAULT_OUTPUT / "source-samples/manifest.json"),
            "Source manifest changed")
    require(score.get("metadata", {}).get("composerSourceSha256") == digest(source / "compose-r3.py"),
            "Composer changed after the score was generated")

    previous = {}
    preserved_files = 0
    for revision, score_name, report_name in (("r1", "score.json", "render-report.json"),
                                              ("r2", "score-r2.json", "render-report-r2.json")):
        snapshot = DEFAULT_OUTPUT / f"{revision}-source"
        require(digest(snapshot / score_name) == digest(source / score_name), f"{revision} score changed")
        require(digest(snapshot / report_name) == digest(DEFAULT_OUTPUT / report_name),
                f"{revision} report changed")
        previous[revision] = json.loads((DEFAULT_OUTPUT / report_name).read_text(encoding="utf-8"))
        for track in previous[revision]["tracks"]:
            for mode in ("scene", "audition"):
                require(digest(DEFAULT_OUTPUT / track[mode]["file"]) == track[mode]["sha256"],
                        f"Preserved audio changed: {track[mode]['file']}")
                preserved_files += 1

    require([track["id"] for track in score["tracks"]] == ["home", "reading", "bronze"], "Scene IDs changed")
    require(len(report["tracks"]) == len(score["tracks"]), "Report missing a scene")
    results = []
    for composition, track in zip(score["tracks"], report["tracks"], strict=True):
        require(composition["id"] == track["id"], "Track ordering differs")
        require(90 <= composition["duration"] <= 180, "Chapter is outside planned length")
        sections = track["sections"]
        require(sections[0]["start"] == 0 and sections[-1]["end"] == composition["duration"],
                "Timeline misses a boundary")
        for i, section in enumerate(sections):
            require(section["end"] > section["start"], "Invalid section")
            if i:
                require(abs(sections[i - 1]["end"] - section["start"]) < 0.02, "Timeline has a gap")
        result = {"id": track["id"], "duration": composition["duration"], "modes": {}}
        for mode in ("scene", "audition"):
            asset = track[mode]
            path = DEFAULT_OUTPUT / asset["file"]
            require(digest(path) == asset["sha256"] and path.stat().st_size == asset["bytes"],
                    f"File differs from report: {path.name}")
            rate, audio = read_pcm(path)
            require(rate == SR and audio.shape == (round(composition["duration"] * SR), 2),
                    f"Audio format/duration mismatch: {path.name}")
            require(np.isfinite(audio).all() and np.all(audio[[0, -1]] == 0), f"Invalid boundary: {path.name}")
            measured = measure(audio)
            require(measured["clippedSamples"] == 0 and measured["oversampledPeakDbtp"] <= -2.97,
                    f"Insufficient headroom: {path.name}")
            require(measured["first20msPeak"] < 0.002 and measured["last20msPeak"] < 0.002,
                    f"Unsettled edge: {path.name}")
            require(measured["dcOffset"] < 0.00005, f"Excess DC offset: {path.name}")
            require(abs(measured["integratedLufs"] - asset["integratedLufs"]) < 0.01,
                    f"Reported loudness differs: {path.name}")
            result["modes"][mode] = {key: measured[key] for key in (
                "integratedLufs", "oversampledPeakDbtp", "clippedSamples", "monoCorrelation",
                "maximumAdjacentStep", "spectralEnergyPercent")}
            if mode == "audition":
                result["sections"] = phrase_levels(audio, sections)
                baseline = next(item for item in previous["r2"]["tracks"] if item["id"] == track["id"])
                delta = measured["integratedLufs"] - baseline[mode]["integratedLufs"]
                require(abs(delta) <= 0.12, "R2/R3 audition loudness is not matched")
                result["loudnessDeltaFromR2"] = round(delta, 3)
        expected_delta = 20 * np.log10(composition["sceneGain"])
        measured_delta = result["modes"]["scene"]["integratedLufs"] - result["modes"]["audition"]["integratedLufs"]
        require(abs(measured_delta - expected_delta) < 0.06, "Scene volume relationship differs")
        results.append(result)

    result = {"revision": "r3", "preservedAudioFiles": preserved_files,
              "checkedNewAudioFiles": 6, "tracks": results,
              "limit": "PCM, source, loudness and timeline checks; no aesthetic, real-device or seamless-loop approval."}
    (DEFAULT_OUTPUT / "quality-check-r3.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"passed": True, "preserved": preserved_files,
                      "newFiles": 6, "tracks": [{"id": item["id"], "duration": item["duration"],
                          "loudnessDeltaFromR2": item["loudnessDeltaFromR2"]} for item in results]},
                     ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
