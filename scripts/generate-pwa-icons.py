"""Generate Northbound's dependency-free PNG installation icons.

The motif mirrors the existing north-pointing brand mark. Keeping this tiny generator
in the repository makes the binary assets reproducible without a design toolchain.
"""

from __future__ import annotations

import math
import struct
import zlib
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ICON_DIRECTORY = ROOT / "icons"

BACKGROUND = (21, 61, 59)
DISC = (31, 81, 78)
CREAM = (244, 239, 218)
ACCENT = (214, 174, 91)


def point_in_polygon(x: float, y: float, points: tuple[tuple[float, float], ...]) -> bool:
    inside = False
    previous = points[-1]
    for current in points:
        x1, y1 = previous
        x2, y2 = current
        if (y1 > y) != (y2 > y):
            boundary_x = (x2 - x1) * (y - y1) / (y2 - y1) + x1
            if x < boundary_x:
                inside = not inside
        previous = current
    return inside


def icon_colour(x: float, y: float, motif_scale: float) -> tuple[int, int, int]:
    centre = 0.5
    local_x = (x - centre) / motif_scale + centre
    local_y = (y - centre) / motif_scale + centre

    colour = BACKGROUND
    if math.hypot(local_x - centre, local_y - centre) <= 0.37:
        colour = DISC

    arrow = ((0.5, 0.19), (0.72, 0.76), (0.5, 0.66), (0.28, 0.76))
    accent = ((0.5, 0.19), (0.54, 0.59), (0.5, 0.66), (0.46, 0.59))
    if point_in_polygon(local_x, local_y, arrow):
        colour = CREAM
    if point_in_polygon(local_x, local_y, accent):
        colour = ACCENT
    return colour


def png_chunk(chunk_type: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + chunk_type
        + data
        + struct.pack(">I", zlib.crc32(chunk_type + data) & 0xFFFFFFFF)
    )


def render_icon(size: int, motif_scale: float) -> bytes:
    rows = bytearray()
    samples = 2
    for pixel_y in range(size):
        rows.append(0)
        for pixel_x in range(size):
            totals = [0, 0, 0]
            for sample_y in range(samples):
                for sample_x in range(samples):
                    x = (pixel_x + (sample_x + 0.5) / samples) / size
                    y = (pixel_y + (sample_y + 0.5) / samples) / size
                    colour = icon_colour(x, y, motif_scale)
                    for channel, value in enumerate(colour):
                        totals[channel] += value
            divisor = samples * samples
            rows.extend(round(total / divisor) for total in totals)
            rows.append(255)

    header = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + png_chunk(b"IHDR", header)
        + png_chunk(b"IDAT", zlib.compress(bytes(rows), level=9))
        + png_chunk(b"IEND", b"")
    )


def main() -> None:
    ICON_DIRECTORY.mkdir(exist_ok=True)
    icon_specs = (
        ("icon-192.png", 192, 1.0),
        ("icon-512.png", 512, 1.0),
        ("icon-maskable-512.png", 512, 0.82),
    )
    for filename, size, motif_scale in icon_specs:
        (ICON_DIRECTORY / filename).write_bytes(render_icon(size, motif_scale))


if __name__ == "__main__":
    main()
