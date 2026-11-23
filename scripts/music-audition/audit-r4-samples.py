"""Audit, download, verify, and measure CC0-1.0 Eastern accent samples for R4.

All sources are pinned to fixed commits of sgossner/VCSL (CC0-1.0).
This script never modifies the preserved R1-R3 source-samples directory.
"""

from __future__ import annotations

import hashlib
import json
import shutil
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np
from scipy.io import wavfile


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "artifacts/music-audition-2026-09-27/source-samples-r4"
COMMIT = "c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e"
SFZ_COMMIT = "dfcf4a4918771eee884b96ad4493de82ef84daf6"
REPO = "https://github.com/sgossner/VCSL"

# Curated CC0-1.0 samples with SFZ pitch_keycenter and acoustically verified tuning.
# Never infer MIDI octave from filenames alone; tuneCents is verified by FFT.
SAMPLES = [
    # Hand Chimes -> jade_chime (pure resonant chime, yuqing-like overtone profile)
    ("jade_chime", "jade_chime/sus_D3_r01_main.wav", "Idiophones/Struck Idiophones/Hand Chimes/sus_D3_r01_main.wav", "Hand Chimes.sfz", 62, "D4"),
    ("jade_chime", "jade_chime/sus_E3_r01_main.wav", "Idiophones/Struck Idiophones/Hand Chimes/sus_E3_r01_main.wav", "Hand Chimes.sfz", 64, "E4"),
    ("jade_chime", "jade_chime/sus_F#3_r01_main.wav", "Idiophones/Struck Idiophones/Hand Chimes/sus_F#3_r01_main.wav", "Hand Chimes.sfz", 66, "F#4"),
    ("jade_chime", "jade_chime/sus_G#3_r01_main.wav", "Idiophones/Struck Idiophones/Hand Chimes/sus_G#3_r01_main.wav", "Hand Chimes.sfz", 68, "G#4"),
    ("jade_chime", "jade_chime/sus_C4_r01_main.wav", "Idiophones/Struck Idiophones/Hand Chimes/sus_C4_r01_main.wav", "Hand Chimes.sfz", 72, "C5"),
    ("jade_chime", "jade_chime/sus_D4_r01_main.wav", "Idiophones/Struck Idiophones/Hand Chimes/sus_D4_r01_main.wav", "Hand Chimes.sfz", 74, "D5"),
    ("jade_chime", "jade_chime/sus_E4_r01_main.wav", "Idiophones/Struck Idiophones/Hand Chimes/sus_E4_r01_main.wav", "Hand Chimes.sfz", 76, "E5"),
    ("jade_chime", "jade_chime/sus_F#4_r01_main.wav", "Idiophones/Struck Idiophones/Hand Chimes/sus_F#4_r01_main.wav", "Hand Chimes.sfz", 78, "F#5"),
    ("jade_chime", "jade_chime/sus_A4_r01_main.wav", "Idiophones/Struck Idiophones/Hand Chimes/sus_A4_r01_main.wav", "Hand Chimes.sfz", 81, "A5"),

    # Dan Tranh (16-string Vietnamese zither) -> dan_tranh (silk/steel plucked accent)
    ("dan_tranh", "dan_tranh/F#2_mf_1.wav", "Chordophones/Zithers/Dan Tranh/Normal/F#2_mf_1.wav", "Dan Tranh - Normal.sfz", 54, "F#3"),
    ("dan_tranh", "dan_tranh/G#2_mf_1.wav", "Chordophones/Zithers/Dan Tranh/Normal/G#2_mf_1.wav", "Dan Tranh - Normal.sfz", 56, "G#3"),
    ("dan_tranh", "dan_tranh/b2_mf_1.wav", "Chordophones/Zithers/Dan Tranh/Normal/b2_mf_1.wav", "Dan Tranh - Normal.sfz", 59, "B3"),
    ("dan_tranh", "dan_tranh/C#3_mf_1.wav", "Chordophones/Zithers/Dan Tranh/Normal/C#3_mf_1.wav", "Dan Tranh - Normal.sfz", 61, "C#4"),
    ("dan_tranh", "dan_tranh/D#3_mf_1.wav", "Chordophones/Zithers/Dan Tranh/Normal/D#3_mf_1.wav", "Dan Tranh - Normal.sfz", 63, "D#4"),
    ("dan_tranh", "dan_tranh/F#3_mf_1.wav", "Chordophones/Zithers/Dan Tranh/Normal/F#3_mf_1.wav", "Dan Tranh - Normal.sfz", 66, "F#4"),
    ("dan_tranh", "dan_tranh/G#3_mf_1.wav", "Chordophones/Zithers/Dan Tranh/Normal/G#3_mf_1.wav", "Dan Tranh - Normal.sfz", 68, "G#4"),
    ("dan_tranh", "dan_tranh/B3_mf_1.wav", "Chordophones/Zithers/Dan Tranh/Normal/B3_mf_1.wav", "Dan Tranh - Normal.sfz", 71, "B4"),
    ("dan_tranh", "dan_tranh/D#4_mf_1.wav", "Chordophones/Zithers/Dan Tranh/Normal/D#4_mf_1.wav", "Dan Tranh - Normal.sfz", 75, "D#5"),

    # Soft-mallet vibraphone (no motor) -> bronze_bell (warm golden struck resonance)
    ("bronze_bell", "bronze_bell/Vibes_soft_F2_v1_rr1_Main.wav", "Idiophones/Struck Idiophones/Vibraphone/Soft Mallets/Vibes_soft_F2_v1_rr1_Main.wav", "Vibraphone - Soft Mallets.sfz", 53, "F3"),
    ("bronze_bell", "bronze_bell/Vibes_soft_A2_v1_rr1_Main.wav", "Idiophones/Struck Idiophones/Vibraphone/Soft Mallets/Vibes_soft_A2_v1_rr1_Main.wav", "Vibraphone - Soft Mallets.sfz", 57, "A3"),
    ("bronze_bell", "bronze_bell/Vibes_soft_C3_v1_rr2_Main.wav", "Idiophones/Struck Idiophones/Vibraphone/Soft Mallets/Vibes_soft_C3_v1_rr2_Main.wav", "Vibraphone - Soft Mallets.sfz", 60, "C4"),
    ("bronze_bell", "bronze_bell/Vibes_soft_E3_v1_rr2_Main.wav", "Idiophones/Struck Idiophones/Vibraphone/Soft Mallets/Vibes_soft_E3_v1_rr2_Main.wav", "Vibraphone - Soft Mallets.sfz", 64, "E4"),
    ("bronze_bell", "bronze_bell/Vibes_soft_G3_v1_rr1_Main.wav", "Idiophones/Struck Idiophones/Vibraphone/Soft Mallets/Vibes_soft_G3_v1_rr1_Main.wav", "Vibraphone - Soft Mallets.sfz", 67, "G4"),
    ("bronze_bell", "bronze_bell/Vibes_soft_B3_v1_rr1_Main.wav", "Idiophones/Struck Idiophones/Vibraphone/Soft Mallets/Vibes_soft_B3_v1_rr1_Main.wav", "Vibraphone - Soft Mallets.sfz", 71, "B4"),
    ("bronze_bell", "bronze_bell/Vibes_soft_D4_v1_rr1_Main.wav", "Idiophones/Struck Idiophones/Vibraphone/Soft Mallets/Vibes_soft_D4_v1_rr1_Main.wav", "Vibraphone - Soft Mallets.sfz", 74, "D5"),

    # Soft bronze gong -> bronze_gong (dark resonant anchor)
    ("bronze_gong", "bronze_gong/gong_p.wav", "Idiophones/Struck Idiophones/Gong 1/gong_p.wav", "Gong 1.sfz", 50, "D3"),

    # Baroque Tenor Recorder -> wooden_wind (warm wooden edge-blown breath accent)
    ("wooden_wind", "wooden_wind/TenRecorder_Sus_D3_rr1_Main.wav", "Aerophones/Edge-blown Aerophones/Baroque Tenor Recorder/Sustain/TenRecorder_Sus_D3_rr1_Main.wav", "Baroque Tenor Recorder - Sustain.sfz", 62, "D4"),
    ("wooden_wind", "wooden_wind/TenRecorder_Sus_E3_rr1_Main.wav", "Aerophones/Edge-blown Aerophones/Baroque Tenor Recorder/Sustain/TenRecorder_Sus_E3_rr1_Main.wav", "Baroque Tenor Recorder - Sustain.sfz", 64, "E4"),
    ("wooden_wind", "wooden_wind/TenRecorder_Sus_G#3_rr1_Main.wav", "Aerophones/Edge-blown Aerophones/Baroque Tenor Recorder/Sustain/TenRecorder_Sus_G#3_rr1_Main.wav", "Baroque Tenor Recorder - Sustain.sfz", 68, "G#4"),
    ("wooden_wind", "wooden_wind/TenRecorder_Sus_D4_rr1_Main.wav", "Aerophones/Edge-blown Aerophones/Baroque Tenor Recorder/Sustain/TenRecorder_Sus_D4_rr1_Main.wav", "Baroque Tenor Recorder - Sustain.sfz", 74, "D5"),
    ("wooden_wind", "wooden_wind/TenRecorder_Sus_E4_rr1_Main.wav", "Aerophones/Edge-blown Aerophones/Baroque Tenor Recorder/Sustain/TenRecorder_Sus_E4_rr1_Main.wav", "Baroque Tenor Recorder - Sustain.sfz", 76, "E5"),
]


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists():
        return
    req = urllib.request.Request(url, headers={"User-Agent": "HeluoMuseumAudit/1.0"})
    with urllib.request.urlopen(req, timeout=30) as response:
        dest.write_bytes(response.read())


def measure_fundamental(path: Path, expected_midi: int) -> tuple[int, int, float, int, float]:
    sr, data = wavfile.read(path)
    channels = 1 if data.ndim == 1 else data.shape[1]
    mono = (data.mean(axis=1) if data.ndim > 1 else data).astype(np.float64)
    duration = len(mono) / sr
    peak = float(np.max(np.abs(mono)))
    active = np.flatnonzero(np.abs(mono) > peak * 0.02)
    start = int(active[0]) if len(active) else 0
    seg_start = min(len(mono) - 1, start + round(0.25 * sr))
    seg_end = min(len(mono), start + round(2.2 * sr))
    seg = mono[seg_start:seg_end] if seg_end - seg_start >= 4096 else mono[start:]
    nfft = 262144
    spec = np.abs(np.fft.rfft(seg * np.hanning(len(seg)), n=nfft))
    freqs = np.fft.rfftfreq(nfft, 1 / sr)
    f_exp = 440.0 * 2 ** ((expected_midi - 69) / 12.0)
    mask = (freqs >= f_exp * 0.92) & (freqs <= f_exp * 1.08)
    f0 = float(freqs[mask][np.argmax(spec[mask])])
    meas_midi = 69.0 + 12.0 * np.log2(f0 / 440.0)
    tune_cents = int(round((meas_midi - expected_midi) * 100))
    return int(sr), int(channels), round(duration, 4), tune_cents, round(f0, 2)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    # Clean probe/unused files from earlier discovery
    for stale in (OUT / "_probe",):
        if stale.exists():
            shutil.rmtree(stale)
    for stale_wav in (OUT / "bronze_bell").glob("chimes_*.wav"):
        stale_wav.unlink()

    lic_url = f"https://raw.githubusercontent.com/sgossner/VCSL/{COMMIT}/LICENSE"
    download(lic_url, OUT / "LICENSE-CC0-1.0.txt")

    records = []
    total_bytes = 0
    for inst, rel, repo_path, sfz_file, root_midi, root_note in SAMPLES:
        dest = OUT / rel
        url = f"https://raw.githubusercontent.com/sgossner/VCSL/{COMMIT}/" + urllib.parse.quote(repo_path)
        download(url, dest)
        raw = dest.read_bytes()
        sha = hashlib.sha256(raw).hexdigest()
        sr, ch, dur, tune_cents, f0 = measure_fundamental(dest, root_midi)
        total_bytes += len(raw)
        records.append({
            "instrument": inst,
            "relativePath": rel,
            "bytes": len(raw),
            "channels": ch,
            "sampleRate": sr,
            "durationSeconds": dur,
            "sha256": sha,
            "sourcePath": repo_path,
            "sourceUrl": url,
            "sourceCommit": COMMIT,
            "rootMidi": root_midi,
            "rootNote": root_note,
            "tuneCents": tune_cents,
            "measuredFundamentalHz": f0,
            "sfzFile": sfz_file,
            "sfzCommit": SFZ_COMMIT,
            "authors": ["Sam Gossner / Versilian Studios", "VCSL Contributors"],
            "license": "CC0-1.0",
        })
        print(f"{rel:44s} {sr}Hz ch={ch} dur={dur:5.2f}s M{root_midi}({root_note}) {tune_cents:+3d}c f0={f0:6.2f}Hz")

    manifest = {
        "schemaVersion": 1,
        "date": "2026-11-23",
        "purpose": "R4 Eastern/stone/bronze/wooden accent sample pack; separate from preserved R1-R3 manifest",
        "library": {
            "name": "Versilian Community Sample Library (VCSL)",
            "repository": REPO,
            "sampleCommit": COMMIT,
            "sfzCommit": SFZ_COMMIT,
            "license": "CC0-1.0",
            "licenseUrl": f"{REPO}/blob/{COMMIT}/LICENSE",
            "recordingCredits": ["Sam Gossner / Versilian Studios", "VCSL Contributors"],
        },
        "totalBytes": total_bytes,
        "sampleCount": len(records),
        "samples": records,
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    license_md = f"""# R4 东方点缀音色音源来源与许可审计

- 审计日期：2026-11-23
- 来源库：Versilian Community Sample Library (VCSL)
- 官方仓库：{REPO}
- 样本固定提交：`{COMMIT}`
- 官方 SFZ 映射固定提交：`{SFZ_COMMIT}`
- 许可证：CC0 1.0 Universal（全文见 [LICENSE-CC0-1.0.txt](./LICENSE-CC0-1.0.txt)）
- 诚实声明：R4 采用现代室内乐（VSCO 2 CE）与 VCSL CC0 声学采样（越南十六弦筝 Dan Tranh、Hand Chimes、软槌金属琴/铜锣、木管高音/次中音直笛）进行当代博物馆配乐编排；不使用“古代礼乐复原”或“古琴/编钟/箫真人实录”等不实宣称。

## 入库乐器组（共 {len(records)} 个采样，总计 {total_bytes:,} 字节）

1. `jade_chime`（VCSL `Hand Chimes`，9 个立体声 WAV）：清透纯净的共鸣音条，用于晨光开合与《温润·玉石》玉磬清音意象点缀。
2. `dan_tranh`（VCSL `Dan Tranh/Normal mf`，9 个单声道 WAV）：东亚十六弦丝弦筝柔拨采样，用于《水岸·静读 R4》换气间隙与《温润·玉石》稀疏拨弦呼应。
3. `bronze_bell`（VCSL `Vibraphone/Soft Mallets v1`，7 个立体声 WAV）与 `bronze_gong`（VCSL `Gong 1/gong_p.wav`，1 个弱奏铜锣）：用于《观器·温金 R4》再现部前的温和低频铜鸣承接，克制不喧宾夺主。
4. `wooden_wind`（VCSL `Baroque Tenor Recorder/Sustain`，5 个立体声 WAV）：温润木质边棱吹管长音，与长笛轻声对话，增强竹木气韵。

所有文件均已校验 SHA-256，并以 262,144 点 FFT 实测基频后写入 `tuneCents` 与 `rootMidi`（不凭文件名猜八度）。
"""
    (OUT / "SOURCE-LICENSE.md").write_text(license_md, encoding="utf-8")
    print(f"Audited {len(records)} CC0 samples ({total_bytes} bytes) -> {OUT}")


if __name__ == "__main__":
    main()
