#!/usr/bin/env python3
"""
Heluo Digital Museum — One-Click Media Importer & Responsive WebP Generator.

Usage:
  1. Put your newly generated or CC0 museum images (.jpg / .png / .webp) into
     `media-inbox/` (or pass `--source <folder>`).
  2. Run:
     python scripts/import-museum-media.py
  3. Supported filenames (without extension):
     Artifacts (CC0 / archival 4:3 or 1:1):
       - water-bird-bronze
       - heluo-bronze-jue
       - river-map-jade-bi
       - painted-pottery-water-jar
       - river-map-pattern-stone
       - heluo-bronze-ding
     Architecture & Spaces (16:9):
       - home-corridor-light
       - home-corridor-dark
       - museum-exterior
     Museum Store Products (4:5):
       - river-line-teacup-set
       - heluo-silk-scarf
       - river-map-notebook
"""

from __future__ import annotations

import argparse
from pathlib import Path
from PIL import Image, ImageOps

REPO_ROOT = Path(__file__).resolve().parent.parent
PUBLIC_MEDIA = REPO_ROOT / "frontend" / "public" / "media"
ASSETS_DIR = REPO_ROOT / "frontend" / "src" / "assets"

SUPPORTED_EXTS = (".png", ".jpg", ".jpeg", ".webp")


def save_webp(img: Image.Image, target: Path, max_width: int | None = None, quality: int = 86) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    out = img.copy()
    if max_width and out.width > max_width:
        ratio = max_width / out.width
        out = out.resize((max_width, max(1, round(out.height * ratio))), Image.Resampling.LANCZOS)
    if out.mode not in ("RGB", "RGBA"):
        out = out.convert("RGB")
    out.save(target, format="WEBP", quality=quality, method=6)


def save_portrait_crop(img: Image.Image, target: Path, width: int = 483, height: int = 858, quality: int = 84) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    cropped = ImageOps.fit(img.convert("RGB"), (width, height), method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))
    cropped.save(target, format="WEBP", quality=quality, method=6)


def save_responsive_set(img: Image.Image, stem: str, widths: tuple[int, ...] = (320, 640, 960)) -> None:
    for w in widths:
        save_webp(img, PUBLIC_MEDIA / "responsive" / f"{stem}-{w}w.webp", max_width=w, quality=84)


ARTIFACT_TARGETS: dict[str, tuple[str, str]] = {
    "water-bird-bronze": ("explore-water-bird-bronze-user-v2", "water-bird-bronze-cover"),
    "heluo-bronze-jue": ("explore-bronze-jue-user-v2", "bronze-jue-cover"),
    "river-map-jade-bi": ("explore-jade-bi-user-v2", "jade-bi-cover"),
    "painted-pottery-water-jar": ("explore-painted-pottery-jar-user-v2", "painted-pottery-jar-cover"),
    "river-map-pattern-stone": ("explore-river-map-stone-user-v2", "river-map-stone-cover"),
    "heluo-bronze-ding": ("explore-bronze-ding-user-v2", "heluo-bronze-ding-v5.4-cover"),
}

PRODUCT_TARGETS = ("river-line-teacup-set", "heluo-silk-scarf", "river-map-notebook")


def find_source(source_dir: Path, slug: str) -> Path | None:
    for ext in SUPPORTED_EXTS:
        candidate = source_dir / f"{slug}{ext}"
        if candidate.is_file():
            return candidate
    return None


def import_all(source_dir: Path) -> int:
    processed = 0

    for slug, (editorial_stem, exhibit_stem) in ARTIFACT_TARGETS.items():
        src = find_source(source_dir, slug)
        if not src:
            continue
        with Image.open(src) as raw:
            img = ImageOps.exif_transpose(raw).convert("RGB")
            save_webp(img, PUBLIC_MEDIA / "editorial" / f"{editorial_stem}.webp", max_width=1400)
            save_webp(img, PUBLIC_MEDIA / "exhibits" / f"{exhibit_stem}.webp", max_width=1400)
            save_responsive_set(img, editorial_stem)
            save_responsive_set(img, exhibit_stem)
            if slug == "river-map-pattern-stone":
                for w in (192, 384, 640):
                    save_webp(img, PUBLIC_MEDIA / "editorial" / f"heluo-river-map-home-{w}w-v1.webp", max_width=w)
            print(f"[artifact] {slug} <- {src.name}")
            processed += 1

    for theme_key in ("light", "dark"):
        slug = f"home-corridor-{theme_key}"
        src = find_source(source_dir, slug)
        if not src:
            continue
        with Image.open(src) as raw:
            img = ImageOps.exif_transpose(raw).convert("RGB")
            base = f"home-corridor-{theme_key}-user-v2"
            save_webp(img, PUBLIC_MEDIA / "editorial" / f"{base}.webp", max_width=1672)
            save_webp(img, PUBLIC_MEDIA / "editorial" / f"{base}-1280w.webp", max_width=1280)
            save_webp(img, PUBLIC_MEDIA / "editorial" / f"{base}-640w.webp", max_width=640)
            save_portrait_crop(img, PUBLIC_MEDIA / "editorial" / f"{base}-portrait.webp")
            print(f"[hero]     {slug} <- {src.name}")
            processed += 1

    ext_src = find_source(source_dir, "museum-exterior")
    if ext_src:
        with Image.open(ext_src) as raw:
            img = ImageOps.exif_transpose(raw).convert("RGB")
            save_webp(img, ASSETS_DIR / "museum-exterior-watercolor.webp", max_width=1400)
            print(f"[exterior] museum-exterior <- {ext_src.name}")
            processed += 1

    for slug in PRODUCT_TARGETS:
        src = find_source(source_dir, slug)
        if not src:
            continue
        with Image.open(src) as raw:
            img = ImageOps.exif_transpose(raw).convert("RGB")
            save_webp(img, PUBLIC_MEDIA / "products" / f"{slug}.webp", max_width=1200)
            save_responsive_set(img, slug)
            print(f"[product]  {slug} <- {src.name}")
            processed += 1

    return processed


def main() -> None:
    parser = argparse.ArgumentParser(description="Import and convert Heluo museum media into responsive WebP sets.")
    parser.add_argument("--source", default=str(REPO_ROOT / "media-inbox"), help="Folder containing source images")
    args = parser.parse_args()
    source_dir = Path(args.source).resolve()
    if not source_dir.exists():
        source_dir.mkdir(parents=True, exist_ok=True)
        print(f"Created empty inbox folder: {source_dir}")
        print("Drop your images there and re-run this script.")
        return
    count = import_all(source_dir)
    print(f"Done. Imported {count} master image(s).")


if __name__ == "__main__":
    main()
