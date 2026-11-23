"""Check rendered R4 chapters and verify R1/R2/R3 preservation; do not score aesthetics."""

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
        result.append({
            "label": section["label"],
            "start": section["start"],
            "end": section["end"],
            "ungatedLufs": round(-0.691 + 10 * np.log10(max(energy, 1e-20)), 2),
        })
    return result


def main() -> None:
    source = Path(__file__).parent
    score = json.loads((source / "score-r4.json").read_text(encoding="utf-8"))
    report = json.loads((DEFAULT_OUTPUT / "render-report-r4.json").read_text(encoding="utf-8"))

    require(report["scoreSha256"] == digest(source / "score-r4.json"), "R4 score changed after rendering")
    require(report["rendererSha256"] == digest(source / "render-r4.py"), "R4 renderer changed after rendering")
    require(report["r3RendererSha256"] == digest(source / "render.py"), "R3 renderer changed")
    require(report["sourceManifestSha256"] == digest(DEFAULT_OUTPUT / "source-samples/manifest.json"),
            "R1-R3 source manifest changed")
    require(report["sourceManifestR4Sha256"] == digest(DEFAULT_OUTPUT / "source-samples-r4/manifest.json"),
            "R4 source manifest changed")
    require(score.get("metadata", {}).get("composerSourceSha256") == digest(source / "compose-r4.py"),
            "R4 composer changed after score generation")

    previous = {}
    preserved_files = 0
    for revision, report_name in (
        ("r1", "render-report.json"),
        ("r2", "render-report-r2.json"),
        ("r3", "render-report-r3.json"),
    ):
        previous[revision] = json.loads((DEFAULT_OUTPUT / report_name).read_text(encoding="utf-8"))
        for track in previous[revision]["tracks"]:
            for mode in ("scene", "audition"):
                require(digest(DEFAULT_OUTPUT / track[mode]["file"]) == track[mode]["sha256"],
                        f"Preserved {revision} audio changed: {track[mode]['file']}")
                preserved_files += 1

    require([track["id"] for track in score["tracks"]] == ["home", "reading", "bronze", "jade"],
            "Unexpected R4 scene IDs")
    require(len(report["tracks"]) == 4, "R4 report missing scenes")

    results = []
    for composition, track in zip(score["tracks"], report["tracks"], strict=True):
        require(composition["id"] == track["id"], "Track ordering differs")
        require(95 <= composition["duration"] <= 120, f"Chapter outside planned length: {track['id']}")
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
                "integratedLufs", "oversampledPeakDbtp", "clippedSamples",
                "monoCorrelation", "maximumAdjacentStep", "spectralEnergyPercent",
            )}
            if mode == "audition":
                result["sections"] = phrase_levels(audio, sections)
                r3_baseline = previous["r3"]["tracks"][0]
                delta = measured["integratedLufs"] - r3_baseline["audition"]["integratedLufs"]
                require(abs(delta) <= 0.15, f"R4 audition loudness not matched to R3: {delta}")
                result["loudnessDeltaFromR3"] = round(delta, 3)

        expected_delta = 20 * np.log10(composition["sceneGain"])
        measured_delta = result["modes"]["scene"]["integratedLufs"] - result["modes"]["audition"]["integratedLufs"]
        require(abs(measured_delta - expected_delta) < 0.06, "Scene volume relationship differs")
        if track["id"] == "jade":
            jade_scene_lufs = result["modes"]["scene"]["integratedLufs"]
            require(-28.2 <= jade_scene_lufs <= -26.8,
                    f"Jade scene loudness outside ~ -27.5 LUFS target: {jade_scene_lufs}")
        results.append(result)

    output = {
        "revision": "r4",
        "preservedAudioFiles": preserved_files,
        "checkedNewAudioFiles": 8,
        "tracks": results,
        "limit": "PCM, source, loudness and timeline checks; awaits subjective user listening at 127.0.0.1:4197/?revision=r4.",
    }
    (DEFAULT_OUTPUT / "render-check-r4.json").write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps({
        "passed": True,
        "preserved": preserved_files,
        "newFiles": 8,
        "tracks": [{
            "id": item["id"],
            "duration": item["duration"],
            "auditionLufs": item["modes"]["audition"]["integratedLufs"],
            "sceneLufs": item["modes"]["scene"]["integratedLufs"],
            "peakDbtp": item["modes"]["audition"]["oversampledPeakDbtp"],
        } for item in results],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
