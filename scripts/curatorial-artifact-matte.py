#!/usr/bin/env python3
"""
Heluo Digital Museum — Reproducible Museum Artifact Darkroom Soft-Matte Processor
Removes studio gray sweep backdrops from museum collection photography with
GrabCut boundary refinement, 2.5px subpixel feathering, and foreground edge
color decontamination (zero white/gray fringe on obsidian darkroom vitrines).

Usage:
  python scripts/curatorial-artifact-matte.py --preview <dir>   # inspect contact sheet first
  python scripts/curatorial-artifact-matte.py --apply           # backup v2 & write active + responsive webp
"""
from __future__ import annotations

import argparse
import shutil
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from scipy.ndimage import distance_transform_edt, gaussian_filter, gaussian_filter1d

ROOT = Path(__file__).resolve().parent.parent
EDITORIAL_DIR = ROOT / "frontend" / "public" / "media" / "editorial"
RESPONSIVE_DIR = ROOT / "frontend" / "public" / "media" / "responsive"


@dataclass(frozen=True)
class ArtifactSpec:
    filename: str
    diff_bg_thresh: float = 11.0
    diff_fg_thresh: float = 24.0
    tex_thresh: float = 4.2
    neutral_chroma_max: float = 0.0
    neutral_tex_max: float = 2.0
    neutral_grad_max: float = 7.0
    center_hole: bool = False
    strip_floor_shadow: bool = True
    shadow_y_ratio: float = 0.72
    inset_px: float = 0.85
    feather_px: float = 2.4


ARTIFACTS: list[ArtifactSpec] = [
    ArtifactSpec(
        "explore-bronze-ding-user-v2.webp",
        diff_bg_thresh=11.5,
        diff_fg_thresh=24.0,
        tex_thresh=4.0,
        neutral_chroma_max=5.2,
        neutral_tex_max=2.4,
        neutral_grad_max=8.0,
        shadow_y_ratio=0.70,
    ),
    ArtifactSpec(
        "explore-water-bird-bronze-user-v2.webp",
        diff_bg_thresh=11.0,
        diff_fg_thresh=23.0,
        tex_thresh=4.2,
        neutral_chroma_max=5.2,
        neutral_tex_max=2.4,
        neutral_grad_max=8.5,
        shadow_y_ratio=0.68,
    ),
    ArtifactSpec(
        "explore-bronze-jue-user-v2.webp",
        diff_bg_thresh=11.0,
        diff_fg_thresh=22.0,
        tex_thresh=4.0,
        neutral_chroma_max=5.2,
        neutral_tex_max=2.4,
        neutral_grad_max=8.5,
        shadow_y_ratio=0.66,
    ),
    ArtifactSpec("explore-jade-bi-user-v2.webp", diff_bg_thresh=10.5, diff_fg_thresh=22.0, tex_thresh=3.8, center_hole=True, strip_floor_shadow=False),
    ArtifactSpec(
        "explore-painted-pottery-jar-user-v2.webp",
        diff_bg_thresh=11.5,
        diff_fg_thresh=24.0,
        tex_thresh=4.2,
        neutral_chroma_max=6.0,
        neutral_tex_max=2.6,
        neutral_grad_max=9.0,
        shadow_y_ratio=0.72,
    ),
    ArtifactSpec("explore-river-map-stone-user-v2.webp", diff_bg_thresh=12.0, diff_fg_thresh=24.0, tex_thresh=4.5, strip_floor_shadow=True, shadow_y_ratio=0.76, inset_px=1.0),
]


def estimate_studio_sweep(rgb: np.ndarray) -> np.ndarray:
    """Estimate smooth vertical studio gray gradient per row from left/right outer strips."""
    h, w, _ = rgb.shape
    strip = max(8, int(w * 0.03))
    margins = np.concatenate([rgb[:, :strip, :], rgb[:, w - strip :, :]], axis=1)
    row_med = np.median(margins, axis=1)  # (H, 3)
    smooth = np.stack([gaussian_filter1d(row_med[:, c], sigma=max(6, h // 45)) for c in range(3)], axis=1)
    return smooth[:, None, :].astype(np.float32)  # (H, 1, 3)


def compute_matte(rgb: np.ndarray, spec: ArtifactSpec) -> np.ndarray:
    """Return RGBA uint8 array with smooth subpixel alpha & decontaminated foreground edges."""
    h, w, _ = rgb.shape
    rgb_f = rgb.astype(np.float32)
    bg_sweep = estimate_studio_sweep(rgb)

    # Perceptual CIE Lab distance to the smooth studio sweep
    img_lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB).astype(np.float32)
    bg_img = np.broadcast_to(np.clip(bg_sweep, 0, 255).astype(np.uint8), (h, w, 3))
    bg_lab = cv2.cvtColor(bg_img, cv2.COLOR_RGB2LAB).astype(np.float32)

    dL = img_lab[:, :, 0] - bg_lab[:, :, 0]
    da = img_lab[:, :, 1] - bg_lab[:, :, 1]
    db = img_lab[:, :, 2] - bg_lab[:, :, 2]
    # Weight chroma differences higher because studio sweeps are neutral achromatic gray
    lab_dist = np.sqrt((dL * 0.85) ** 2 + (da * 1.9) ** 2 + (db * 1.9) ** 2)
    chroma = np.sqrt((img_lab[:, :, 1] - 128.0) ** 2 + (img_lab[:, :, 2] - 128.0) ** 2)

    # Local high-frequency texture magnitude & Sobel edge gradient (studio sweep is dead-smooth)
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)
    blur = cv2.GaussianBlur(gray, (5, 5), 1.2)
    local_tex = cv2.GaussianBlur(np.abs(gray - blur), (7, 7), 1.8)
    gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    grad_mag = np.hypot(gx, gy) / 4.0

    # Studio floor cast shadows are darker than bg_sweep (dL < 0), low chroma, low texture, in lower band
    ys = np.linspace(0.0, 1.0, h)[:, None]
    is_floor_shadow = (
        spec.strip_floor_shadow
        & (ys > spec.shadow_y_ratio)
        & (dL < -2.0)
        & (dL > -45.0)
        & (chroma < 8.0)
        & (local_tex < spec.tex_thresh * 0.90)
        & (grad_mag < 12.0)
    )

    # Smooth neutral-gray studio spotlight halo behind object (zero chroma, zero micro-texture, no edge)
    is_neutral_studio = (
        (spec.neutral_chroma_max > 0.0)
        & (chroma < spec.neutral_chroma_max)
        & (local_tex < spec.neutral_tex_max)
        & (grad_mag < spec.neutral_grad_max)
    )

    bg_candidate = (
        ((lab_dist < spec.diff_bg_thresh) & (local_tex < spec.tex_thresh))
        | is_floor_shadow
        | is_neutral_studio
    )

    # Keep only background components connected to the outer border (plus center hole for jade bi)
    num_labels, labels = cv2.connectedComponents(bg_candidate.astype(np.uint8), connectivity=4)
    border_labels = set(
        np.concatenate([labels[0, :], labels[-1, :], labels[:, 0], labels[:, -1]]).tolist()
    )
    if spec.center_hole:
        cy, cx = h // 2, w // 2
        if labels[cy, cx] > 0:
            border_labels.add(int(labels[cy, cx]))
    border_labels.discard(0)

    connected_bg = np.isin(labels, list(border_labels))

    # Build GrabCut trimap
    gc_mask = np.full((h, w), cv2.GC_PR_FGD, dtype=np.uint8)
    # Erode connected_bg slightly to form SURE_BG, leaving a soft PR_BGD band near the object silhouette
    k_bg = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    sure_bg = cv2.erode(connected_bg.astype(np.uint8), k_bg, iterations=1).astype(bool)
    gc_mask[connected_bg] = cv2.GC_PR_BGD
    gc_mask[sure_bg] = cv2.GC_BGD

    # Mark high-confidence artifact interior as SURE_FG
    fg_raw = (~connected_bg) & ((lab_dist > spec.diff_fg_thresh) | (local_tex > spec.tex_thresh * 1.35))
    k_fg = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    sure_fg = cv2.erode(fg_raw.astype(np.uint8), k_fg, iterations=1).astype(bool)
    gc_mask[sure_fg] = cv2.GC_FGD

    # Also ensure outer 3px frame is strictly background
    gc_mask[:3, :] = cv2.GC_BGD
    gc_mask[-3:, :] = cv2.GC_BGD
    gc_mask[:, :3] = cv2.GC_BGD
    gc_mask[:, -3:] = cv2.GC_BGD
    if spec.center_hole:
        cy, cx = h // 2, w // 2
        cv2.circle(gc_mask, (cx, cy), max(8, min(h, w) // 25), int(cv2.GC_BGD), -1)

    bgd_model = np.zeros((1, 65), np.float64)
    fgd_model = np.zeros((1, 65), np.float64)
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    cv2.grabCut(bgr, gc_mask, None, bgd_model, fgd_model, 6, cv2.GC_INIT_WITH_MASK)

    fg_bin = ((gc_mask == cv2.GC_FGD) | (gc_mask == cv2.GC_PR_FGD)).astype(np.uint8)

    # Keep largest foreground component (eliminates stray floating studio dust speckles)
    n_fg, fg_labels, stats, _ = cv2.connectedComponentsWithStats(fg_bin, connectivity=8)
    if n_fg > 1:
        areas = stats[1:, cv2.CC_STAT_AREA]
        keep = int(np.argmax(areas)) + 1
        fg_bin = (fg_labels == keep).astype(np.uint8)

    # Clean tiny interior pinholes (< 80px) while keeping real holes (jade bi center, handle loops, leg gaps)
    inv = (1 - fg_bin).astype(np.uint8)
    n_bg, bg_lbl, bg_stats, _ = cv2.connectedComponentsWithStats(inv, connectivity=4)
    for idx in range(1, n_bg):
        if bg_stats[idx, cv2.CC_STAT_AREA] < 120:
            fg_bin[bg_lbl == idx] = 1

    # Smooth subpixel alpha matte via signed distance field (2-3px natural feather, slight inset to kill fringe)
    dist_in = distance_transform_edt(fg_bin > 0)
    dist_out = distance_transform_edt(fg_bin == 0)
    signed = dist_in - dist_out  # >0 inside, <0 outside

    # Map signed distance from [inset - feather/2, inset + feather/2] -> [0, 1] with smoothstep
    half_f = spec.feather_px * 0.5
    t = np.clip((signed - (spec.inset_px - half_f)) / spec.feather_px, 0.0, 1.0)
    alpha = t * t * (3.0 - 2.0 * t)
    alpha = gaussian_filter(alpha, sigma=0.55)
    alpha = np.where(alpha < 0.015, 0.0, np.where(alpha > 0.992, 1.0, alpha))

    # Foreground edge color decontamination: replace edge RGB (< 0.98 alpha) with nearest interior FG color
    solid_fg = alpha >= 0.96
    if np.any(solid_fg):
        _, (ny, nx) = distance_transform_edt(~solid_fg, return_indices=True)
        nearest_rgb = rgb_f[ny, nx]
        # Blend decontaminated color smoothly along the feathered rim
        rim = (alpha > 0.0) & (alpha < 0.98)
        decontam_w = np.clip((0.98 - alpha) / 0.65, 0.0, 1.0)[..., None]
        out_rgb = np.where(rim[..., None], rgb_f * (1.0 - decontam_w) + nearest_rgb * decontam_w, rgb_f)
    else:
        out_rgb = rgb_f

    # Zero out RGB where alpha == 0 for cleaner WebP compression
    out_rgb = np.where((alpha > 0.0)[..., None], out_rgb, 0.0)
    rgba = np.dstack([np.clip(out_rgb, 0, 255).astype(np.uint8), np.clip(alpha * 255.0, 0, 255).astype(np.uint8)])
    return rgba


def make_contact_sheet(results: list[tuple[str, np.ndarray]], out_path: Path) -> None:
    """Composite all 6 cutouts on both Cold Obsidian (#14181F) and Crisp Paper (#F7F5F0) for visual QA."""
    cell = 360
    cols = 6
    rows = 2
    canvas = Image.new("RGB", (cols * cell, rows * cell), (20, 24, 31))
    bgs = [(20, 24, 31), (247, 245, 240)]

    for r, bg in enumerate(bgs):
        for c, (_, rgba) in enumerate(results):
            tile = Image.new("RGBA", (cell, cell), (*bg, 255))
            im = Image.fromarray(rgba, mode="RGBA")
            im.thumbnail((cell - 32, cell - 32), Image.Resampling.LANCZOS)
            ox = (cell - im.width) // 2
            oy = (cell - im.height) // 2
            tile.alpha_composite(im, (ox, oy))
            canvas.paste(tile.convert("RGB"), (c * cell, r * cell))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out_path, quality=92)


def save_responsive_webp(rgba: np.ndarray, stem: str) -> None:
    im = Image.fromarray(rgba, mode="RGBA")
    for width in (320, 640, 960):
        scale = width / im.width
        height = max(1, round(im.height * scale))
        resized = im.resize((width, height), Image.Resampling.LANCZOS)
        out = RESPONSIVE_DIR / f"{stem}-{width}w.webp"
        resized.save(out, format="WEBP", quality=88, method=6)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--preview", type=Path, help="Output path for QA contact sheet JPG/PNG")
    parser.add_argument("--apply", action="store_true", help="Backup originals and write active & responsive WebP files")
    args = parser.parse_args()

    results: list[tuple[str, np.ndarray]] = []
    for spec in ARTIFACTS:
        src = EDITORIAL_DIR / spec.filename
        backup = EDITORIAL_DIR / spec.filename.replace(".webp", "-v2-backup.webp")
        # Always read from the clean v2 backup if it already exists (idempotent re-runs!)
        read_src = backup if backup.exists() else src
        img = Image.open(read_src).convert("RGB")
        rgba = compute_matte(np.array(img), spec)
        results.append((spec.filename, rgba))

        if args.apply:
            if not backup.exists():
                shutil.copy2(src, backup)
            Image.fromarray(rgba, mode="RGBA").save(src, format="WEBP", quality=90, method=6)
            save_responsive_webp(rgba, Path(spec.filename).stem)
            print(f"[applied] {spec.filename} (+ 320w/640w/960w, backup={backup.name})")

    if args.preview:
        make_contact_sheet(results, args.preview)
        print(f"[preview] {args.preview}")


if __name__ == "__main__":
    main()
