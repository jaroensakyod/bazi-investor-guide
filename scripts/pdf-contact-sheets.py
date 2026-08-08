from __future__ import annotations

import argparse
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def page_number(path: Path) -> int:
    return int(path.stem.rsplit("-", 1)[-1])


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input_dir", type=Path)
    parser.add_argument("output_dir", type=Path)
    parser.add_argument("--name", required=True)
    parser.add_argument("--per-sheet", type=int, default=8)
    args = parser.parse_args()

    pages = sorted(args.input_dir.glob("page-*.png"), key=page_number)
    if not pages:
        raise SystemExit(f"No page PNGs found in {args.input_dir}")
    args.output_dir.mkdir(parents=True, exist_ok=True)
    font = ImageFont.load_default()

    columns = 4
    thumb_width = 360
    gutter = 24
    label_height = 30
    for sheet_index in range(math.ceil(len(pages) / args.per_sheet)):
        selected = pages[sheet_index * args.per_sheet : (sheet_index + 1) * args.per_sheet]
        rows = math.ceil(len(selected) / columns)
        with Image.open(selected[0]) as first:
            ratio = first.height / first.width
        thumb_height = round(thumb_width * ratio)
        canvas = Image.new(
            "RGB",
            (
                columns * thumb_width + (columns + 1) * gutter,
                rows * (thumb_height + label_height) + (rows + 1) * gutter,
            ),
            "#d7d2c9",
        )
        draw = ImageDraw.Draw(canvas)
        for index, page_path in enumerate(selected):
            col = index % columns
            row = index // columns
            x = gutter + col * (thumb_width + gutter)
            y = gutter + row * (thumb_height + label_height + gutter)
            with Image.open(page_path) as page:
                thumb = page.convert("RGB").resize((thumb_width, thumb_height), Image.Resampling.LANCZOS)
            canvas.paste(thumb, (x, y + label_height))
            draw.text((x, y + 7), f"{args.name}  page {page_number(page_path):02d}", fill="#29252b", font=font)
        output = args.output_dir / f"{args.name}-sheet-{sheet_index + 1:02d}.jpg"
        canvas.save(output, quality=90, optimize=True)


if __name__ == "__main__":
    main()
