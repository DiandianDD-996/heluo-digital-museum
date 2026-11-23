"""Compose R4 chamber movements with CC0 Eastern accents and the 4th 'jade' movement.

Preserves compose-r3.py and score-r3.json untouched by loading R3 helpers dynamically.
Emits score-r4.json deterministically; no audio rendering or network access happens here.
"""

from __future__ import annotations

import hashlib
import importlib.util
import json
import sys
from collections import Counter
from pathlib import Path


HERE = Path(__file__).resolve().parent


def _load_r3():
    spec = importlib.util.spec_from_file_location("compose_r3", HERE / "compose-r3.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules["compose_r3"] = module
    spec.loader.exec_module(module)
    return module


r3 = _load_r3()

# R4 extends R3 roots/pans/releases with CC0-1.0 VCSL Eastern & resonant accents.
R4_ROOTS = {
    **r3.ROOTS,
    "jade_chime": (62, 64, 66, 68, 72, 74, 76, 78, 81),
    "dan_tranh": (54, 56, 59, 61, 63, 66, 68, 71, 75),
    "bronze_bell": (53, 57, 60, 64, 67, 71, 74),
    "bronze_gong": (50,),
    "wooden_wind": (62, 64, 68, 74, 76),
}

R4_RELEASE = {
    **r3.RELEASE,
    "jade_chime": 1.50,
    "dan_tranh": 1.25,
    "bronze_bell": 1.65,
    "bronze_gong": 1.75,
    "wooden_wind": 0.42,
}

R4_PANS = {
    **r3.PANS,
    "jade_chime": 0.15,
    "dan_tranh": -0.16,
    "bronze_bell": -0.14,
    "bronze_gong": 0.06,
    "wooden_wind": 0.12,
}

# Add D major / Lydian harmonies for the jade movement alongside R3's G-centered palette.
R4_HARMONIES = {
    **r3.HARMONIES,
    "D6": ("D3", ("F#3", "A3", "B3")),
    "Dmaj9": ("D3", ("A3", "E4", "F#4")),
    "D/F#4": ("F#3", ("A3", "D4", "E4")),
    "A/C#": ("C#3", ("E3", "A3", "E4")),
    "Asus4": ("A3", ("D4", "E4", "A3")),
    "Bm7": ("B3", ("D4", "F#4", "A4")),
    "Bm/F#": ("F#3", ("B3", "D4", "F#4")),
    "F#m7": ("F#3", ("A3", "C#4", "E4")),
    "Gmaj7": ("G3", ("B3", "D4", "F#4")),
    "G6/B": ("B3", ("D4", "E4", "G4")),
}


class MovementR4(r3.Movement):
    def note(self, beat: float, pitch: str, beats: float, velocity: float,
             instrument: str, role: str, *, gap: float = 0.055,
             expression: list[float] | None = None,
             pan: float | None = None, release: float | None = None) -> None:
        duration = round(beats * self.spb - gap, 3)
        event = {
            "t": round(0.12 + beat * self.spb, 3),
            "d": duration,
            "midi": r3.midi(pitch),
            "velocity": round(velocity, 3),
            "instrument": instrument,
            "pan": R4_PANS[instrument] if pan is None else pan,
            "role": role,
        }
        if instrument in {"cello", "viola"}:
            event["articulation"] = "connected"
            if expression is None and duration >= 1.0:
                expression = [0.84, 1.06, 0.86]
        if expression is not None:
            event["expression"] = expression
        if release is not None:
            event["release"] = release
        self.data["events"].append(event)

    def accompaniment(self, rows: list[tuple[str, str, str, float]],
                      bass_instrument: str) -> None:
        orig = r3.HARMONIES
        r3.HARMONIES = R4_HARMONIES
        try:
            super().accompaniment(rows, bass_instrument)
        finally:
            r3.HARMONIES = orig


def _add_accent(track: dict, tempo: int, beat: float, pitch: str, beats: float,
                velocity: float, instrument: str, *,
                expression: list[float] | None = None,
                release: float | None = None) -> None:
    spb = 60.0 / tempo
    event = {
        "t": round(0.12 + beat * spb, 3),
        "d": round(beats * spb - 0.055, 3),
        "midi": r3.midi(pitch),
        "velocity": round(velocity, 3),
        "instrument": instrument,
        "pan": R4_PANS[instrument],
        "role": "response",
    }
    if expression is not None:
        event["expression"] = expression
    if release is not None:
        event["release"] = release
    track["events"].append(event)


def home_r4() -> dict:
    track = r3.home()
    track["title"] = "入馆·河洛晨光"
    track["description"] = (
        "保留 R3 舒展迎宾主题与室内乐主轴；段落开合处缀以弱吹木管气韵与轻击玉磬泛音，"
        "每十二至十六秒一处呼吸点，衬出晨光入馆的清雅东方气度。"
    )
    tempo = track["tempo"]
    # Restraint: 10 sparse breath points across 106 seconds (~1 per 10-16s).
    accents = [
        (0.50, "D4", 2.40, 0.24, "wooden_wind", [0.68, 1.02, 0.72], 0.42),
        (6.60, "D5", 1.80, 0.25, "jade_chime", None, 1.45),
        (23.50, "B4", 1.70, 0.23, "jade_chime", None, 1.45),
        (39.20, "G4", 1.80, 0.22, "jade_chime", None, 1.45),
        (48.10, "A4", 2.10, 0.23, "wooden_wind", [0.66, 1.00, 0.70], 0.42),
        (56.00, "E5", 1.70, 0.22, "jade_chime", None, 1.45),
        (71.20, "D5", 1.90, 0.25, "jade_chime", None, 1.50),
        (87.50, "B4", 1.70, 0.22, "jade_chime", None, 1.45),
        (103.50, "D5", 1.80, 0.21, "jade_chime", None, 1.50),
        (116.50, "G4", 2.20, 0.19, "jade_chime", None, 1.60),
    ]
    for beat, pitch, beats, vel, inst, expr, rel in accents:
        _add_accent(track, tempo, beat, pitch, beats, vel, inst, expression=expr, release=rel)
    track["events"].sort(key=lambda e: (e["t"], e["midi"]))
    return track


def reading_r4() -> dict:
    track = r3.reading()
    track["title"] = "水岸·静读"
    track["description"] = (
        "延续 R3 近景阅读的安静呼吸；在长句换气间隙嵌入稀疏的丝弦弹拨点缀与极轻玉磬回响，"
        "以留白衬托水纹与纸墨相伴的静谧。"
    )
    tempo = track["tempo"]
    # 9 sparse zither/chime breath accents across 110 seconds (~1 per 12-16s).
    accents = [
        (6.50, "D4", 1.60, 0.25, "dan_tranh", None, 1.25),
        (7.40, "A4", 1.80, 0.22, "dan_tranh", None, 1.25),
        (23.20, "E4", 1.70, 0.24, "dan_tranh", None, 1.25),
        (39.00, "D5", 1.80, 0.23, "dan_tranh", None, 1.25),
        (39.50, "G4", 1.60, 0.17, "jade_chime", None, 1.45),
        (55.40, "A4", 1.70, 0.22, "dan_tranh", None, 1.25),
        (63.10, "B4", 1.80, 0.24, "dan_tranh", None, 1.25),
        (79.20, "E5", 1.70, 0.22, "dan_tranh", None, 1.25),
        (95.20, "D5", 1.80, 0.21, "dan_tranh", None, 1.25),
        (102.80, "G4", 2.00, 0.19, "dan_tranh", None, 1.35),
    ]
    for beat, pitch, beats, vel, inst, expr, rel in accents:
        _add_accent(track, tempo, beat, pitch, beats, vel, inst, expression=expr, release=rel)
    track["events"].sort(key=lambda e: (e["t"], e["midi"]))
    return track


def bronze_r4() -> dict:
    track = r3.bronze()
    track["title"] = "观器·温金"
    track["description"] = (
        "保留大提琴温暖厚重的器形主题；在结构转折与再现部回归前融入柔和的低音金属钟磬与弱铜鸣承接，"
        "强化礼器的庄重感而不压迫听觉。"
    )
    tempo = track["tempo"]
    # 9 restrained bronze chime/gong anchors across 115 seconds.
    accents = [
        (1.00, "G3", 2.60, 0.24, "bronze_bell", None, 1.65),
        (23.40, "D4", 2.20, 0.23, "bronze_bell", None, 1.60),
        (39.50, "E4", 2.20, 0.22, "bronze_bell", None, 1.60),
        (55.40, "B3", 2.20, 0.21, "bronze_bell", None, 1.60),
        # Soft bronze gong + low bell resonance carrying into the A' cello return at beat 72.
        (69.80, "D3", 3.40, 0.26, "bronze_gong", None, 1.75),
        (71.00, "G3", 2.60, 0.27, "bronze_bell", None, 1.65),
        (87.40, "D4", 2.20, 0.23, "bronze_bell", None, 1.60),
        (103.50, "G3", 2.50, 0.24, "bronze_bell", None, 1.65),
        (114.00, "D3", 3.00, 0.20, "bronze_gong", None, 1.75),
        (114.60, "G3", 2.80, 0.20, "bronze_bell", None, 1.70),
    ]
    for beat, pitch, beats, vel, inst, expr, rel in accents:
        _add_accent(track, tempo, beat, pitch, beats, vel, inst, expression=expr, release=rel)
    track["events"].sort(key=lambda e: (e["t"], e["midi"]))
    return track


def jade_r4() -> dict:
    """4th movement: 温润·玉石 (104s, 58 BPM, target scene loudness ~ -27.5 LUFS)."""
    m = MovementR4(
        "jade",
        "温润·玉石",
        "近场竖琴与稀疏高音钢琴泛音勾勒清透玉质纹理，极轻中提琴长音托住温润底色，"
        "玉磬清音与丝弦点缀留出充足呼吸，适配玉璧、玉猪龙、河图石与彩陶展品。",
        58,
        104,
        0.67,
        {"decay": 1.22, "wet": 0.165, "width": 0.64},
    )
    m.lead(0, [
        # Intro (bars 0-1): gentle open fifths & breathing space
        ("harp", .35, "D4:1.5 A4:1.5 _:1"),
        ("piano", .34, "F#4:1.5 E4:1.5 D4:1"),
        # A (bars 2-7): translucent D pentatonic-inflected chamber melody
        ("harp", .43, "D4:1 E4:0.5 F#4:1.5 A4:1"),
        ("harp", .42, "B4:1.5 A4:0.5 F#4:1 E4:1"),
        ("harp", .44, "F#4:1 A4:1 B4:1 D5:1"),
        ("harp", .40, "A4:2 F#4:1 _:1"),
        ("harp", .43, "G4:1 A4:1 B4:1 D5:1"),
        ("harp", .41, "A4:1.5 F#4:0.5 E4:1 D4:1"),
        # B (bars 8-13): intimate high piano harmonics & wooden wind breath
        ("piano", .38, "F#4:1.5 A4:0.5 B4:2" if False else "F#4:1.5 A4:0.5 A4:2"),
        ("piano", .37, "E4:1 F#4:1 A4:1 _:1"),
        ("piano", .39, "D4:1 F#4:1 A4:1.5 G4:0.5"),
        ("piano", .36, "F#4:2 E4:1 _:1"),
        ("harp", .41, "E4:1 F#4:1 A4:1 B4:1"),
        ("piano", .37, "A4:1.5 F#4:0.5 E4:2"),
        # A' (bars 14-19): luminous return with higher arch and gentle spacing
        ("harp", .44, "D4:1 F#4:0.5 A4:1.5 D5:1"),
        ("harp", .42, "B4:1 A4:1 F#4:1 E4:1"),
        ("harp", .45, "G4:1 A4:1 B4:1 D5:1"),
        ("harp", .41, "A4:1.5 F#4:0.5 E4:1 D4:1"),
        ("harp", .42, "E4:1 F#4:1 A4:1 B4:1"),
        ("harp", .39, "A4:2 D4:1 _:1"),
        # Coda (bars 20-23): sparse dialogue settling into pure chime resonance
        ("piano", .36, "A4:1 F#4:1 E4:2"),
        ("harp", .37, "D4:1 E4:1 F#4:2"),
        ("piano", .33, "A4:1.5 F#4:1.5 _:1"),
        ("harp", .31, "D4:3 _:1"),
    ])
    # Fix bar 8 piano melody to stay <= A4 (MIDI 69) while sounding singing & luminous:
    # Let's inspect bar 8 above: `F#4:1.5 A4:0.5 A4:2` repeats A4; let's refine bar 8 directly below via clean list.
    m.data["events"].clear()
    m.lead(0, [
        # Intro (bars 0-1)
        ("harp", .35, "D4:1.5 A4:1.5 _:1"),
        ("piano", .34, "F#4:1.5 E4:1.5 D4:1"),
        # A (bars 2-7)
        ("harp", .43, "D4:1 E4:0.5 F#4:1.5 A4:1"),
        ("harp", .42, "B4:1.5 A4:0.5 F#4:1 E4:1"),
        ("harp", .44, "F#4:1 A4:1 B4:1 D5:1"),
        ("harp", .40, "A4:2 F#4:1 _:1"),
        ("harp", .43, "G4:1 A4:1 B4:1 D5:1"),
        ("harp", .41, "A4:1.5 F#4:0.5 E4:1 D4:1"),
        # B (bars 8-13)
        ("piano", .38, "E4:1 F#4:1 A4:2"),
        ("piano", .37, "G4:1 F#4:1 E4:1 _:1"),
        ("piano", .39, "D4:1 F#4:1 A4:1.5 G4:0.5"),
        ("piano", .36, "F#4:2 E4:1 _:1"),
        ("harp", .41, "E4:1 F#4:1 A4:1 B4:1"),
        ("piano", .37, "A4:1.5 F#4:0.5 E4:2"),
        # A' (bars 14-19)
        ("harp", .44, "D4:1 F#4:0.5 A4:1.5 D5:1"),
        ("harp", .42, "B4:1 A4:1 F#4:1 E4:1"),
        ("harp", .45, "G4:1 A4:1 B4:1 D5:1"),
        ("harp", .41, "A4:1.5 F#4:0.5 E4:1 D4:1"),
        ("harp", .42, "E4:1 F#4:1 A4:1 B4:1"),
        ("harp", .39, "A4:2 D4:1 _:1"),
        # Coda (bars 20-23)
        ("piano", .36, "A4:1 F#4:1 E4:2"),
        ("harp", .37, "D4:1 E4:1 F#4:2"),
        ("piano", .33, "A4:1.5 F#4:1.5 _:1"),
        ("harp", .31, "D4:3 _:1"),
    ])
    m.accompaniment([
        ("Dmaj9", "open", "piano", .18), ("A/C#", "answer", "piano", .17),
        ("D6", "open", "piano", .20), ("A/C#", "answer", "piano", .19),
        ("Bm7", "suspension", "piano", .20), ("D/F#4", "answer", "piano", .18),
        ("Gmaj7", "open", "piano", .20), ("Asus4", "answer", "piano", .18),
        ("G6/B", "flow", "harp", .20), ("D/F#4", "answer", "harp", .19),
        ("F#m7", "open", "harp", .19), ("Asus4", "suspension", "harp", .18),
        ("Bm7", "open", "harp", .20), ("Gmaj7", "answer", "harp", .19),
        ("D6", "open", "piano", .21), ("Bm7", "answer", "piano", .19),
        ("Gmaj7", "flow", "piano", .20), ("D/F#4", "suspension", "piano", .19),
        ("Em7", "open", "piano", .19), ("Asus4", "arrival", "piano", .18),
        ("Dmaj9", "open", "harp", .18), ("Gmaj7", "answer", "piano", .17),
        ("D6", "open", "piano", .16), ("D6", "arrival", "piano", .14),
    ], "cello")
    # Delicate viola long tones (inner warmth) + jade_chime / dan_tranh / wooden_wind luminous accents
    m.inner([
        (14.50, "A3", 1.80, .20, "viola"),
        (22.60, "D4", 1.90, .22, "viola"),
        (30.60, "F#4", 1.75, .20, "viola"),
        (38.60, "D4", 1.95, .21, "viola"),
        (54.50, "E4", 1.85, .20, "viola"),
        (62.50, "F#4", 1.90, .22, "viola"),
        (78.50, "D4", 1.85, .20, "viola"),
        (90.50, "A3", 2.00, .18, "viola"),
    ])
    jade_accents = [
        (1.20, "A4", 2.00, 0.25, "jade_chime", None, 1.50),
        (7.20, "E5", 1.90, 0.24, "jade_chime", None, 1.50),
        (23.10, "A4", 1.70, 0.23, "dan_tranh", None, 1.25),
        (31.20, "D5", 2.00, 0.25, "jade_chime", None, 1.55),
        (43.20, "D5", 2.40, 0.22, "wooden_wind", [0.68, 1.00, 0.72], 0.42),
        (47.20, "F#5", 1.90, 0.23, "jade_chime", None, 1.50),
        (55.10, "A4", 1.80, 0.22, "dan_tranh", None, 1.25),
        (63.20, "E5", 2.00, 0.25, "jade_chime", None, 1.55),
        (79.10, "D5", 1.80, 0.23, "dan_tranh", None, 1.25),
        (87.20, "A5", 2.00, 0.22, "jade_chime", None, 1.55),
        (93.80, "D5", 2.30, 0.21, "jade_chime", None, 1.65),
    ]
    for beat, pitch, beats, vel, inst, expr, rel in jade_accents:
        _add_accent(m.data, 58, beat, pitch, beats, vel, inst, expression=expr, release=rel)
    m.sections([
        (0, 8, "引子：璞石微光"),
        (8, 32, "A：温润的玉纹主题"),
        (32, 56, "B：清透的器壁呼吸"),
        (56, 80, "A′：光影流转的回望"),
        (80, 96, "尾奏：玉磬余韵归静"),
    ])
    return m.finish()


def validate_r4(track: dict) -> dict:
    instrument_counts = Counter()
    points = []
    release_points = []
    for e in track["events"]:
        instrument = e["instrument"]
        if instrument not in {*R4_ROOTS, "felt_pluck"}:
            raise ValueError(f"Unknown instrument {instrument}")
        if not (0 <= e["t"] < track["duration"] and 0 < e["d"] <= 4):
            raise ValueError(f"Invalid event timing: {e}")
        if e["t"] + e["d"] > track["duration"] - 4:
            raise ValueError(f"Insufficient ending space: {e}")
        if not 0 < e["velocity"] <= 1:
            raise ValueError(f"Invalid velocity: {e}")
        if e["pan"] != R4_PANS[instrument]:
            raise ValueError(f"Instrument position must stay fixed: {e}")
        if instrument in R4_ROOTS and min(abs(e["midi"] - x) for x in R4_ROOTS[instrument]) > 5:
            raise ValueError(f"Missing close acoustic source: {e}")
        if instrument in {"cello", "viola"} and e.get("articulation") != "connected":
            raise ValueError(f"Short bowed parts require a connected entry: {e}")
        if "expression" in e and (
            len(e["expression"]) != 3 or
            any(not .55 <= x <= 1.2 for x in e["expression"])
        ):
            raise ValueError(f"Invalid expression: {e}")
        instrument_counts[instrument] += 1
        points.extend([(e["t"], 1), (e["t"] + e["d"], -1)])
        release_points.extend([
            (e["t"], 1), (e["t"] + e["d"] + e.get("release", R4_RELEASE[instrument]), -1),
        ])

    def peak(items: list[tuple[float, int]]) -> int:
        active = maximum = 0
        for _, change in sorted(items):
            active += change
            maximum = max(maximum, active)
        return maximum

    sections = track["sections"]
    if sections[0]["start"] != 0 or sections[-1]["end"] != track["duration"]:
        raise ValueError("Incomplete sections")
    for previous, next_section in zip(sections, sections[1:]):
        if abs(previous["end"] - next_section["start"]) > .001:
            raise ValueError("Non-contiguous sections")
    return {
        "id": track["id"],
        "duration": track["duration"],
        "events": len(track["events"]),
        "instruments": dict(instrument_counts),
        "midiRange": [min(e["midi"] for e in track["events"]),
                      max(e["midi"] for e in track["events"])],
        "longestNoteSeconds": max(e["d"] for e in track["events"]),
        "lastNoteOffSeconds": round(max(e["t"] + e["d"] for e in track["events"]), 3),
        "scoredPeakVoices": peak(points),
        "peakVoicesIncludingNominalRelease": peak(release_points),
        "connectedEvents": sum(e.get("articulation") == "connected" for e in track["events"]),
        "expressiveEvents": sum("expression" in e for e in track["events"]),
    }


def serialize_r4(score: dict) -> str:
    tracks = []
    for track in score["tracks"]:
        header = {k: v for k, v in track.items() if k != "events"}
        head = json.dumps(header, ensure_ascii=False, indent=2).rstrip()[:-1].rstrip()
        event_lines = ",\n".join(
            "    " + json.dumps(event, ensure_ascii=False, separators=(",", ":"))
            for event in track["events"]
        )
        tracks.append(head + ',\n  "events": [\n' + event_lines + "\n  ]\n}")
    body = ",\n".join("\n".join("    " + line for line in track.splitlines()) for track in tracks)
    metadata = json.dumps(score["metadata"], ensure_ascii=False)
    return ('{\n  "version": 4,\n  "metadata": ' + metadata +
            ',\n  "tracks": [\n' + body + "\n  ]\n}\n")


def main() -> None:
    score = {
        "version": 4,
        "metadata": {
            "composerSourceSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
            "r3ComposerSourceSha256": hashlib.sha256((HERE / "compose-r3.py").read_bytes()).hexdigest(),
            "composition": "R4 chamber score with restrained CC0 VCSL Eastern accents and 4th movement jade.",
        },
        "tracks": [home_r4(), reading_r4(), bronze_r4(), jade_r4()],
    }
    stats = [validate_r4(track) for track in score["tracks"]]
    output = serialize_r4(score)
    if json.loads(output) != score:
        raise ValueError("Score serialization mismatch")
    (HERE / "score-r4.json").write_text(output, encoding="utf-8")
    print(json.dumps(stats, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
