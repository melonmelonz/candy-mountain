#!/usr/bin/env python3
"""Assemble a candy-mountain drifter sprite sheet from PixelLab frames.

Layout matches the original drifter.png: 7 columns x 4 rows of 88px cells.
  rows  : south(down)=0, east(right)=1, north(up)=2, west(left)=3
  cols  : 0 = idle/rotation pose, 1..6 = walking-6-frames frames 0..5
Output: 616 x 352 RGBA PNG.

Usage:
  assemble_sheet.py <frames_dir> <out.png>

<frames_dir> must contain, for each dir in {south,east,north,west}:
  rotation_<dir>.png
  walk_<dir>_0.png .. walk_<dir>_5.png
Any source frame is center-fitted into an 88px cell (no upscaling beyond 1x).
"""
import sys
from PIL import Image

CELL = 88
COLS = 7
ROWS = 4
DIRS = ["south", "east", "north", "west"]  # -> rows 0..3


def fit_cell(img: Image.Image) -> Image.Image:
    """Center an image inside an 88x88 transparent cell, downscaling if larger."""
    img = img.convert("RGBA")
    if img.width > CELL or img.height > CELL:
        # LANCZOS gives a cleaner reduction of these detailed crystalline sprites
        # than NEAREST (which would drop pixels unevenly at non-integer ratios).
        scale = min(CELL / img.width, CELL / img.height)
        img = img.resize((max(1, round(img.width * scale)), max(1, round(img.height * scale))), Image.LANCZOS)
    cell = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    cell.paste(img, ((CELL - img.width) // 2, (CELL - img.height) // 2), img)
    return cell


def main() -> None:
    frames_dir, out_path = sys.argv[1], sys.argv[2]
    sheet = Image.new("RGBA", (CELL * COLS, CELL * ROWS), (0, 0, 0, 0))
    for row, d in enumerate(DIRS):
        cells = [f"{frames_dir}/rotation_{d}.png"] + [f"{frames_dir}/walk_{d}_{i}.png" for i in range(6)]
        for col, path in enumerate(cells):
            cell = fit_cell(Image.open(path))
            sheet.paste(cell, (col * CELL, row * CELL), cell)
    sheet.save(out_path)
    print(f"wrote {out_path} ({sheet.width}x{sheet.height})")


if __name__ == "__main__":
    main()
