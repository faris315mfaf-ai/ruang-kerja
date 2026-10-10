#!/usr/bin/env python3
"""Generate simple app icons (icon.png, adaptive-icon.png) for RuangKerja.

Pure-Python PNG writer (RGBA, no dependencies). The mark is the "Arus" flow:
a white rounded tile with a teal-to-blue route (dot — diagonal — dot).
Run from apps/mobile: python3 scripts/ikon.py
"""
import os
import struct
import zlib

SIZE = 1024
TEAL = (0x0B, 0x7F, 0x86)
TEAL_BRIGHT = (0x14, 0xB8, 0xA6)
BLUE = (0x2F, 0x7B, 0xEA)
WHITE = (0xFF, 0xFF, 0xFF)


def write_png(path: str, pixels: list[list[tuple[int, int, int, int]]]) -> None:
    raw = b"".join(b"\x00" + b"".join(struct.pack("4B", *px) for px in row) for row in pixels)

    def chunk(kind: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + kind
            + data
            + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)
        )

    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", SIZE, SIZE, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as fh:
        fh.write(png)


def in_rounded_rect(x: int, y: int, x0: int, y0: int, x1: int, y1: int, r: int) -> bool:
    if x0 + r <= x <= x1 - r or y0 + r <= y <= y1 - r:
        return x0 <= x <= x1 and y0 <= y <= y1
    for cx, cy in ((x0 + r, y0 + r), (x1 - r, y0 + r), (x0 + r, y1 - r), (x1 - r, y1 - r)):
        if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
            return True
    return False


def in_disc(x: int, y: int, cx: int, cy: int, r: int) -> bool:
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r


def near_segment(x: float, y: float, ax: float, ay: float, bx: float, by: float, thick: float) -> bool:
    dx, dy = bx - ax, by - ay
    length2 = dx * dx + dy * dy
    t = max(0.0, min(1.0, ((x - ax) * dx + (y - ay) * dy) / length2))
    px, py = ax + t * dx, ay + t * dy
    return (x - px) ** 2 + (y - py) ** 2 <= thick * thick


def render(transparent_bg: bool) -> list[list[tuple[int, int, int, int]]]:
    m = SIZE // 8  # margin of the white tile
    img: list[list[tuple[int, int, int, int]]] = []
    bg = (0, 0, 0, 0) if transparent_bg else TEAL + (255,)
    # Route points inside the tile (a — b — c) in the safe zone.
    ax, ay = SIZE * 0.34, SIZE * 0.66
    bx, by = SIZE * 0.66, SIZE * 0.34
    dot_r = SIZE * 0.055
    line_thick = SIZE * 0.030
    for y in range(SIZE):
        row: list[tuple[int, int, int, int]] = []
        for x in range(SIZE):
            color = bg
            if in_rounded_rect(x, y, m, m, SIZE - m, SIZE - m, SIZE // 9):
                color = WHITE + (255,)
                if in_disc(x, y, ax, ay, dot_r):
                    color = TEAL_BRIGHT + (255,)
                elif in_disc(x, y, bx, by, dot_r):
                    color = BLUE + (255,)
                elif near_segment(x, y, ax, ay, bx, by, line_thick):
                    color = TEAL + (255,)
            row.append(color)
        img.append(row)
    return img


if __name__ == "__main__":
    write_png("assets/icon.png", render(transparent_bg=False))
    write_png("assets/adaptive-icon.png", render(transparent_bg=True))
    print("ok: assets/icon.png, assets/adaptive-icon.png")
