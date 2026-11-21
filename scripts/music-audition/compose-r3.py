"""Compose three deterministic chamber movements for the museum audition.

Only emits score-r3.json. This is an authored score expander, not an audio
renderer: pitches, rhythms, orchestration and harmonic order are explicit.
"""

from __future__ import annotations

import hashlib
import json
import math
from collections import Counter
from pathlib import Path


HERE = Path(__file__).resolve().parent
ROOTS = {
    "harp": (48, 55, 59, 62, 65, 69),
    "piano": (49, 57, 65),
    "flute": (60, 64, 69),
    "cello": (36, 43, 53, 60, 64),
    "viola": (48, 55, 62),
}
RELEASE = {
    "harp": 1.25, "piano": 1.05, "flute": 0.28,
    "cello": 0.32, "viola": 0.32, "felt_pluck": 1.20,
}
PANS = {"harp": -0.12, "piano": 0.10, "flute": 0.18,
        "cello": -0.07, "viola": 0.17, "felt_pluck": -0.18}

# The voicings use thirds, sixths and ninths, with clear bass direction.
# Each item is bass, then three selectively voiced inner notes.
HARMONIES = {
    "G6": ("G3", ("B3", "D4", "E4")),
    "G/D": ("D3", ("G3", "B3", "D4")),
    "G/B": ("B3", ("D4", "G4", "B3")),
    "G9": ("G3", ("B3", "D4", "A4")),
    "D/F#": ("F#3", ("A3", "D4", "F#4")),
    "Dsus/A": ("A3", ("D4", "G4", "A3")),
    "D7": ("D3", ("A3", "C4", "F#4")),
    "Em7": ("E3", ("B3", "D4", "G4")),
    "Em/B": ("B3", ("E4", "G4", "D4")),
    "C6": ("C3", ("G3", "A3", "E4")),
    "C/E": ("E3", ("G3", "C4", "E4")),
    "Cmaj9": ("E3", ("G3", "B3", "D4")),
    "Am7": ("A3", ("C4", "E4", "G4")),
    "Am/E": ("E3", ("A3", "C4", "E4")),
}


def midi(note: str) -> int:
    names = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
    accidental = 1 if "#" in note else -1 if "b" in note else 0
    return (int(note[-1]) + 1) * 12 + names[note[0]] + accidental


def bar(text: str) -> list[tuple[str, float]]:
    """Explicit pitch:beat pairs; '_' denotes an authored breath."""
    result = [(part.split(":")[0], float(part.split(":")[1]))
              for part in text.split()]
    if not math.isclose(sum(length for _, length in result), 4):
        raise ValueError(f"Bar must contain four beats: {text}")
    return result


class Movement:
    def __init__(self, identity: str, title: str, description: str,
                 tempo: int, duration: int, scene_gain: float, room: dict):
        self.data = {
            "id": identity, "title": title, "description": description,
            "tempo": tempo, "duration": duration, "sceneGain": scene_gain,
            "room": room, "sections": [], "events": [],
        }
        self.spb = 60 / tempo

    def note(self, beat: float, pitch: str, beats: float, velocity: float,
             instrument: str, role: str, *, gap: float = 0.055,
             expression: list[float] | None = None,
             pan: float | None = None, release: float | None = None) -> None:
        duration = round(beats * self.spb - gap, 3)
        event = {
            "t": round(0.12 + beat * self.spb, 3),
            "d": duration, "midi": midi(pitch),
            "velocity": round(velocity, 3), "instrument": instrument,
            "pan": PANS[instrument] if pan is None else pan, "role": role,
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

    def lead(self, start_bar: int, rows: list[tuple[str, float, str]]) -> None:
        for offset, (instrument, velocity, text) in enumerate(rows):
            position = (start_bar + offset) * 4.0
            phrase = bar(text)
            for index, (pitch, length) in enumerate(phrase):
                if pitch != "_":
                    # A small written stress contour, not random note selection.
                    stress = (1.0, 0.97, 1.02, 0.96, 0.94)[min(index, 4)]
                    expressive = None
                    if instrument == "flute" and length * self.spb >= 1.0:
                        expressive = [0.87, 1.03, 0.80]
                    if instrument in {"cello", "viola"} and length >= 2:
                        expressive = [0.80, 1.10, 0.84]
                    self.note(position, pitch, length, velocity * stress,
                              instrument, "melody", expression=expressive)
                position += length

    def accompaniment(self, rows: list[tuple[str, str, str, float]],
                      bass_instrument: str) -> None:
        """Four deliberately different chamber gestures, explicitly sequenced."""
        for number, (harmony, gesture, instrument, strength) in enumerate(rows):
            if harmony == "_":
                continue
            bass, tones = HARMONIES[harmony]
            first, middle, upper = tones
            start = number * 4.0
            # Short bass punctuation: no continuous low drone.
            bass_length = 1.40 if gesture != "arrival" else 2.0
            bass_velocity = strength * (0.67 if instrument == "harp" else 0.72)
            self.note(start + 0.05, bass, bass_length, bass_velocity,
                      bass_instrument, "bass")
            if gesture == "open":
                # A small spread interval, then space for the melody.
                self.note(start + 0.26, first, 1.60, strength, instrument, "harmony")
                self.note(start + 1.90, middle, 1.60, strength * 0.89,
                          instrument, "harmony")
            elif gesture == "answer":
                # The inner line answers late rather than repeating a full arpeggio.
                self.note(start + 1.45, middle, 1.15, strength * 0.93,
                          instrument, "harmony")
                self.note(start + 2.85, upper, 1.02, strength * 0.84,
                          instrument, "harmony")
            elif gesture == "flow":
                # A gentle contrary-motion figure, used only in selected bars.
                for at, pitch, length, scale in [
                    (0.72, middle, 0.95, 0.91),
                    (1.85, first, 0.98, 0.87),
                    (3.00, upper, 0.88, 0.82),
                ]:
                    self.note(start + at, pitch, length, strength * scale,
                              instrument, "harmony")
            elif gesture == "suspension":
                self.note(start + 0.40, upper, 2.15, strength * 0.88,
                          instrument, "harmony")
                self.note(start + 2.65, middle, 1.20, strength * 0.80,
                          instrument, "harmony")
            elif gesture == "arrival":
                self.note(start + 0.25, first, 2.50, strength * 0.92,
                          instrument, "harmony")
                self.note(start + 0.46, middle, 2.30, strength * 0.82,
                          instrument, "harmony")
            elif gesture != "bass_only":
                raise ValueError(f"Unknown gesture {gesture}")

    def inner(self, rows: list[tuple[float, str, float, float, str]]) -> None:
        for beat, pitch, length, velocity, instrument in rows:
            self.note(beat, pitch, length, velocity, instrument, "response",
                      expression=[0.78, 1.04, 0.82]
                      if instrument in {"cello", "viola"} else None)

    def sections(self, rows: list[tuple[float, float, str]]) -> None:
        for start, end, label in rows:
            self.data["sections"].append({
                "start": round(start * self.spb, 3),
                "end": round(end * self.spb, 3), "label": label,
            })
        last = self.data["sections"][-1]["end"]
        self.data["sections"].append({
            "start": last, "end": self.data["duration"], "label": "尾声：余韵归静",
        })

    def finish(self) -> dict:
        self.data["events"].sort(key=lambda e: (e["t"], e["midi"]))
        return self.data


def home() -> dict:
    m = Movement(
        "home", "入馆·河洛晨光",
        "从清楚的迎宾动机走向舒展主题，长笛与键盘在中段打开空间；"
        "竖琴带着节奏变化回归，以温和的室内乐尾声收束。",
        72, 106, 0.80, {"decay": 1.18, "wet": 0.16, "width": 0.66},
    )
    m.lead(0, [
        ("piano", .39, "D4:1 E4:1 G4:2"),
        ("harp", .42, "G4:1 A4:1 B4:1 _:1"),
        # A: a complete four-bar question and a more open four-bar answer.
        ("harp", .50, "D4:1 E4:0.5 G4:1.5 B4:1"),
        ("harp", .49, "A4:1.5 G4:0.5 E4:1 D4:1"),
        ("harp", .51, "E4:1 G4:1 A4:1 B4:1"),
        ("harp", .47, "A4:1 G4:1 D4:2"),
        ("harp", .52, "G4:1.5 A4:0.5 B4:1 D5:1"),
        ("harp", .50, "C5:1 B4:0.5 A4:0.5 G4:2"),
        ("harp", .47, "A4:1 G4:0.5 E4:0.5 D4:1 F#4:1"),
        ("harp", .44, "G4:2 D4:1 _:1"),
        # B: a lower, breathing wind line followed by a keyboard answer.
        ("flute", .43, "G4:1.5 E4:0.5 D4:1 _:1"),
        ("flute", .44, "E4:1 G4:1 A4:1 _:1"),
        ("flute", .45, "B4:1.5 A4:0.5 G4:1 E4:1"),
        ("flute", .40, "D4:2.5 _:1.5"),
        ("piano", .45, "C4:1 E4:1 G4:1 A4:1"),
        ("piano", .43, "G4:1 E4:1 D4:1 B3:1"),
        ("piano", .46, "D4:1 E4:1 G4:1 A4:1"),
        ("piano", .42, "F#4:1 E4:1 D4:2"),
        # A': rhythm and melodic answering change rather than looping A.
        ("harp", .52, "D4:0.5 E4:0.5 G4:2 B4:1"),
        ("harp", .49, "A4:1 G4:0.5 E4:0.5 D4:1 E4:1"),
        ("harp", .54, "G4:1 A4:1 B4:1 D5:1"),
        ("harp", .51, "C5:1 B4:1 A4:1 G4:1"),
        ("harp", .51, "E4:1 G4:0.5 A4:0.5 B4:2"),
        ("harp", .48, "A4:1 G4:1 E4:1 D4:1"),
        ("harp", .47, "E4:1 G4:1 A4:1 F#4:1"),
        ("harp", .44, "G4:2 B4:1 G4:1"),
        # Coda: the opening outline is shared by two plucked/keyed colours.
        ("harp", .42, "D4:1 E4:1 G4:2"),
        ("harp", .40, "A4:1 G4:1 E4:1 D4:1"),
        ("piano", .37, "B3:1 D4:1 G4:2"),
        ("harp", .34, "G4:3 _:1"),
    ])
    m.accompaniment([
        ("G6", "open", "piano", .21), ("Dsus/A", "answer", "piano", .20),
        ("G6", "open", "piano", .25), ("D/F#", "answer", "piano", .23),
        ("Em7", "flow", "piano", .24), ("G/D", "suspension", "piano", .22),
        ("C6", "open", "piano", .25), ("G/B", "answer", "piano", .23),
        ("D7", "flow", "piano", .23), ("G6", "arrival", "piano", .21),
        ("Em7", "open", "harp", .26), ("Am7", "answer", "harp", .24),
        ("Cmaj9", "flow", "harp", .25), ("G/D", "suspension", "harp", .22),
        ("C6", "open", "harp", .23), ("G/B", "answer", "harp", .22),
        ("Am7", "flow", "harp", .23), ("D7", "suspension", "harp", .21),
        ("G6", "open", "piano", .26), ("D/F#", "answer", "piano", .24),
        ("Em7", "flow", "piano", .25), ("C6", "open", "piano", .24),
        ("G/B", "suspension", "piano", .23), ("Am7", "answer", "piano", .22),
        ("D7", "flow", "piano", .23), ("G6", "arrival", "piano", .22),
        ("Cmaj9", "open", "piano", .20), ("Dsus/A", "answer", "piano", .19),
        ("G6", "open", "harp", .19), ("G6", "arrival", "piano", .16),
    ], "cello")
    m.inner([
        (7.00, "D4", 1.20, .27, "viola"),
        (22.70, "B3", 1.35, .23, "viola"),
        (30.40, "D4", 1.40, .23, "viola"),
        (38.80, "E4", 1.45, .29, "viola"),
        # Quiet inner voices catch only the latter half of two wind breaths.
        (43.35, "G3", .95, .20, "viola"),
        (47.35, "E4", .85, .19, "viola"),
        (51.05, "D4", 1.00, .25, "viola"),
        (54.50, "B3", 1.60, .29, "viola"),
        (70.60, "D4", 1.60, .28, "viola"),
        (86.60, "E4", 1.50, .23, "viola"),
        (102.70, "E4", 1.35, .25, "viola"),
        (114.50, "D4", 1.55, .22, "viola"),
    ])
    m.sections([
        (0, 8, "引子：晨光入室"), (8, 40, "A：舒展的迎宾主题"),
        (40, 72, "B：风与回廊的对话"), (72, 104, "A′：带着光线回归"),
        (104, 120, "尾奏：从容落定"),
    ])
    return m.finish()


def reading() -> dict:
    m = Movement(
        "reading", "水岸·静读",
        "轻微运动的和声托住有方向的旋律；键盘中段以较近的音色回应，"
        "随后回到竖琴主题，保持阅读中的稳定呼吸。",
        60, 110, 0.58, {"decay": 0.98, "wet": 0.12, "width": 0.46},
    )
    m.lead(0, [
        ("harp", .35, "D4:1 E4:1 G4:2"),
        ("harp", .36, "A4:1 G4:1 E4:1 D4:1"),
        # A: recognisable but understated three/four-note bars.
        ("harp", .41, "D4:1.5 E4:0.5 G4:2"),
        ("harp", .40, "A4:1.5 G4:0.5 E4:2"),
        ("harp", .42, "E4:1 G4:1 B4:2"),
        ("harp", .39, "A4:1 G4:1 D4:1.5 _:0.5"),
        ("harp", .41, "E4:1.5 G4:0.5 A4:2"),
        ("harp", .40, "B4:1 A4:1 G4:1 E4:1"),
        ("harp", .39, "D4:1 E4:1 F#4:1 A4:1"),
        ("harp", .37, "G4:2 D4:1 _:1"),
        # B: a close, quieter keyboard strand; no density or register jump.
        ("piano", .37, "E4:1 G4:1 A4:2"),
        ("piano", .36, "G4:1.5 E4:0.5 D4:2"),
        ("piano", .38, "C4:1 E4:1 G4:1 A4:1"),
        ("piano", .36, "F#4:1 E4:1 D4:1 _:1"),
        ("piano", .37, "E4:1 G4:1 B3:1 D4:1"),
        ("piano", .35, "F#4:1 E4:1 D4:2"),
        # A': the intervals remain familiar while the cadence changes.
        ("harp", .41, "D4:1 E4:1 G4:2"),
        ("harp", .40, "A4:1 G4:1 E4:1 D4:1"),
        ("harp", .42, "E4:1 G4:1 A4:1 B4:1"),
        ("harp", .40, "A4:1.5 G4:0.5 E4:2"),
        ("harp", .41, "G4:1 A4:1 B4:1 G4:1"),
        ("harp", .39, "E4:1 G4:1 A4:1 E4:1"),
        ("harp", .38, "D4:1 E4:1 F#4:1 D4:1"),
        ("harp", .36, "G4:2 E4:1 D4:1"),
        ("harp", .34, "E4:1 G4:1 A4:1 G4:1"),
        ("harp", .32, "D4:1 G4:2.5 _:0.5"),
    ])
    m.accompaniment([
        ("G6", "open", "felt_pluck", .22), ("D/F#", "answer", "felt_pluck", .21),
        ("G6", "open", "piano", .22), ("D/F#", "answer", "piano", .21),
        ("Em7", "suspension", "piano", .22), ("G/D", "answer", "piano", .20),
        ("Cmaj9", "open", "piano", .22), ("G/B", "flow", "piano", .20),
        ("D7", "answer", "piano", .21), ("G6", "arrival", "piano", .19),
        ("Cmaj9", "open", "harp", .22), ("G/B", "answer", "harp", .21),
        ("Am7", "flow", "harp", .22), ("D/F#", "open", "harp", .20),
        ("Em7", "answer", "harp", .21), ("D7", "suspension", "harp", .19),
        ("G6", "open", "piano", .22), ("Cmaj9", "answer", "piano", .21),
        ("Am7", "suspension", "piano", .22), ("D/F#", "answer", "piano", .20),
        ("G/B", "open", "piano", .21), ("C6", "flow", "piano", .20),
        ("D7", "answer", "piano", .20), ("G6", "arrival", "piano", .19),
        ("Cmaj9", "open", "felt_pluck", .18), ("G9", "arrival", "piano", .16),
    ], "cello")
    m.inner([
        (22.90, "D4", 1.30, .23, "viola"),
        (38.75, "E4", 1.45, .25, "viola"),
        # Carry the harmony after the keyboard sample naturally decays.
        (42.90, "B3", 1.15, .18, "viola"),
        (51.35, "E4", 1.00, .23, "viola"),
        (55.00, "D4", .95, .23, "flute"),
        (62.85, "D4", 1.30, .25, "viola"),
        (78.80, "D4", 1.25, .22, "viola"),
        (94.75, "E4", 1.35, .23, "viola"),
        (101.30, "B3", 1.65, .19, "viola"),
    ])
    m.sections([
        (0, 8, "引子：水岸微光"), (8, 40, "A：轻盈的阅读主题"),
        (40, 64, "B：近景的键盘回应"), (64, 96, "A′：水纹缓缓回转"),
        (96, 104, "尾奏：停在清处"),
    ])
    return m.finish()


def bronze() -> dict:
    m = Movement(
        "bronze", "观器·温金",
        "大提琴以可歌唱的主题描绘器形，竖琴与键盘在中段展开明亮侧面；"
        "主题带着更长呼吸回归，最后由几种音色共同落定。",
        66, 115, 0.72, {"decay": 1.30, "wet": 0.17, "width": 0.66},
    )
    m.lead(0, [
        ("piano", .38, "G3:1 B3:1 D4:2"),
        ("harp", .40, "E4:1 D4:1 B3:1 _:1"),
        # A: one singing statement, then a gently lifted answer.
        ("cello", .47, "G3:1.5 B3:0.5 D4:2"),
        ("cello", .48, "E4:1.5 D4:0.5 B3:1 A3:1"),
        ("cello", .49, "G3:1 B3:1 D4:1 E4:1"),
        ("cello", .46, "D4:2.5 B3:0.75 A3:0.75"),
        ("cello", .50, "C4:1 E4:1 G4:1 E4:1"),
        ("cello", .47, "D4:1 B3:1 A3:1 G3:1"),
        ("cello", .48, "A3:1 B3:0.5 D4:0.5 F#4:1 E4:1"),
        ("cello", .43, "D4:1 B3:1 G3:1.5 _:0.5"),
        # B: a connected harp-led development, not an isolated interlude.
        ("harp", .47, "E4:1 G4:0.5 A4:0.5 B4:2"),
        ("harp", .46, "A4:1 G4:1 E4:1 D4:1"),
        ("harp", .50, "G4:1 A4:0.5 B4:0.5 D5:1 B4:1"),
        ("harp", .46, "A4:2 G4:1 E4:1"),
        ("piano", .43, "E4:1 G4:1 A4:1 G4:1"),
        ("piano", .42, "G4:1 E4:1 D4:1 B3:1"),
        ("harp", .46, "A4:1 G4:1 F#4:1 E4:1"),
        ("harp", .43, "D4:1 E4:1 G4:1.5 _:0.5"),
        # A': thematic return with longer tones and a higher answering arch.
        ("cello", .49, "G3:1 B3:1 D4:2"),
        ("cello", .50, "E4:2.5 D4:0.75 B3:0.75"),
        ("cello", .51, "C4:1 E4:1 G4:2"),
        ("cello", .48, "F#4:1 E4:1 D4:2"),
        ("cello", .49, "E4:1 D4:1 B3:1 G3:1"),
        ("cello", .47, "A3:1 C4:1 E4:2"),
        ("cello", .46, "D4:1 E4:1 F#4:1 D4:1"),
        ("cello", .42, "B3:1 A3:1 G3:2"),
        # Coda completes the first theme across instruments.
        ("harp", .40, "D4:1 E4:1 G4:2"),
        ("piano", .38, "E4:1 D4:1 B3:1 A3:1"),
        ("cello", .39, "G3:1 B3:1 D4:2"),
        ("cello", .35, "G3:3 _:1"),
    ])
    m.accompaniment([
        ("G6", "open", "harp", .23), ("Dsus/A", "answer", "piano", .22),
        ("G6", "flow", "harp", .28), ("D/F#", "answer", "piano", .25),
        ("Em7", "open", "harp", .27), ("G/D", "suspension", "piano", .24),
        ("C6", "flow", "harp", .27), ("G/B", "answer", "piano", .24),
        ("D7", "flow", "harp", .26), ("G6", "arrival", "piano", .23),
        ("Cmaj9", "open", "piano", .25), ("G/B", "answer", "piano", .24),
        ("Em7", "flow", "piano", .25), ("Am7", "suspension", "piano", .23),
        ("C6", "open", "harp", .25), ("G/B", "answer", "harp", .23),
        ("D7", "flow", "piano", .24), ("G6", "arrival", "piano", .22),
        ("G6", "flow", "harp", .28), ("Em7", "answer", "piano", .25),
        ("C6", "open", "harp", .27), ("D/F#", "suspension", "piano", .24),
        ("G/B", "flow", "harp", .26), ("Am7", "answer", "piano", .23),
        ("D7", "flow", "harp", .25), ("G6", "arrival", "piano", .22),
        ("Cmaj9", "open", "piano", .21), ("Dsus/A", "answer", "harp", .20),
        ("G6", "open", "harp", .20), ("G6", "arrival", "piano", .17),
    ], "piano")
    m.inner([
        (6.65, "D4", 1.50, .29, "viola"),
        (22.70, "D4", 1.40, .25, "viola"),
        (38.70, "E4", 1.65, .32, "viola"),
        (46.55, "E4", 1.45, .27, "viola"),
        (54.60, "E4", 1.50, .28, "viola"),
        (62.65, "D4", 1.40, .26, "viola"),
        (70.50, "B3", 1.70, .31, "viola"),
        (86.70, "D4", 1.40, .24, "viola"),
        (102.65, "D4", 1.60, .27, "viola"),
        (110.60, "B3", 1.45, .25, "viola"),
        (114.50, "D4", 1.50, .23, "viola"),
        (116.35, "B3", 2.20, .20, "viola"),
    ])
    m.sections([
        (0, 8, "引子：器形初现"), (8, 40, "A：温金的歌唱主题"),
        (40, 72, "B：光沿纹样流动"), (72, 104, "A′：更舒展的回望"),
        (104, 120, "尾奏：器与光同归静"),
    ])
    return m.finish()


def validate(track: dict) -> dict:
    instrument_counts = Counter()
    points = []
    release_points = []
    for e in track["events"]:
        instrument = e["instrument"]
        if instrument not in {*ROOTS, "felt_pluck"}:
            raise ValueError(f"Unknown instrument {instrument}")
        if not (0 <= e["t"] < track["duration"] and 0 < e["d"] <= 4):
            raise ValueError(f"Invalid event timing: {e}")
        if e["t"] + e["d"] > track["duration"] - 4:
            raise ValueError(f"Insufficient ending space: {e}")
        if not 0 < e["velocity"] <= 1:
            raise ValueError(f"Invalid velocity: {e}")
        if e["pan"] != PANS[instrument]:
            raise ValueError(f"Instrument position must stay fixed: {e}")
        if instrument in ROOTS and min(abs(e["midi"] - x) for x in ROOTS[instrument]) > 5:
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
            (e["t"], 1), (e["t"] + e["d"] + e.get("release", RELEASE[instrument]), -1),
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
        "id": track["id"], "duration": track["duration"],
        "events": len(track["events"]), "instruments": dict(instrument_counts),
        "midiRange": [min(e["midi"] for e in track["events"]),
                      max(e["midi"] for e in track["events"])],
        "longestNoteSeconds": max(e["d"] for e in track["events"]),
        "lastNoteOffSeconds": round(max(e["t"] + e["d"] for e in track["events"]), 3),
        "scoredPeakVoices": peak(points),
        "peakVoicesIncludingNominalRelease": peak(release_points),
        "connectedEvents": sum(e.get("articulation") == "connected" for e in track["events"]),
        "expressiveEvents": sum("expression" in e for e in track["events"]),
    }


def serialize(score: dict) -> str:
    tracks = []
    for track in score["tracks"]:
        header = {k: v for k, v in track.items() if k != "events"}
        head = json.dumps(header, ensure_ascii=False, indent=2).rstrip()[:-1].rstrip()
        event_lines = ",\n".join(
            "    " + json.dumps(event, ensure_ascii=False, separators=(",", ":"))
            for event in track["events"]
        )
        tracks.append(head + ',\n  "events": [\n' + event_lines + "\n  ]\n}")
    # Keep one event per line so future composition diffs remain reviewable.
    body = ",\n".join("\n".join("    " + line for line in track.splitlines()) for track in tracks)
    metadata = json.dumps(score["metadata"], ensure_ascii=False)
    return ('{\n  "version": 3,\n  "metadata": ' + metadata +
            ',\n  "tracks": [\n' + body + "\n  ]\n}\n")


def main() -> None:
    score = {
        "version": 3,
        "metadata": {
            "composerSourceSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
            "composition": "Authored themes, harmonic progressions and chamber gestures; deterministic expansion.",
        },
        "tracks": [home(), reading(), bronze()],
    }
    stats = [validate(track) for track in score["tracks"]]
    output = serialize(score)
    if json.loads(output) != score:
        raise ValueError("Score serialization mismatch")
    (HERE / "score-r3.json").write_text(output, encoding="utf-8")
    print(json.dumps(stats, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
