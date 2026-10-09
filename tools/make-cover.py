"""Render cover.png (800x600) with the same wireframe look as the game.

Reads LAGO_MAP straight from game.js so the cover tracks the map.
Usage: python tools/make-cover.py   (writes ./cover.png)
"""

import json
import math
import os
import re

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), "..")
SRC = open(os.path.join(ROOT, "game.js"), encoding="utf-8").read()

SS = 2  # supersampling factor for smooth lines
W, H = 800, 600
TW, TH = 44, 22
SLAB_H = 14

BG = (5, 6, 10)
BAND = (11, 13, 20)
CYAN = (0, 255, 255)
MAGENTA = (255, 0, 85)
GREEN = (0, 255, 136)
YELLOW = (255, 255, 0)
WHITE = (255, 255, 255)


def parse_map():
    block = re.search(r"const LAGO_MAP = (\[.*?\n\]);", SRC, re.S).group(1)
    return json.loads(re.sub(r",\s*\]", "]", block))


M = parse_map()
ROWS, COLS = len(M), len(M[0])
OX = W / 2 - (COLS + ROWS - 2) * TW / 4
OY = H / 2 - (ROWS - COLS) * TH / 4 + 30  # pushed down to leave room for the title


def iso(x, y):
    return (OX + (x + y) * TW / 2) * SS, (OY + (y - x) * TH / 2) * SS


def rhombus(cx, cy, hw, hh):
    return [(cx, cy - hh), (cx + hw, cy), (cx, cy + hh), (cx - hw, cy)]


def cell(x, y):
    cx, cy = iso(x, y)
    return rhombus(cx, cy, TW / 2 * SS, TH / 2 * SS)


def tile(x, y):
    return M[y][x] if 0 <= y < ROWS and 0 <= x < COLS else 1


def blend(c, a):
    return tuple(int(BG[i] + (c[i] - BG[i]) * a) for i in range(3))


img = Image.new("RGB", (W * SS, H * SS), BG)
d = ImageDraw.Draw(img)

for i in range(-1, 4):
    x = i * 260 * SS
    d.polygon([(x, H * SS), (x + 120 * SS, H * SS), (x + 420 * SS, 0), (x + 300 * SS, 0)], fill=BAND)

lw = lambda w: max(1, int(w * SS))

# Slab front faces.
edges = [(cell(0, y)[2], cell(0, y)[3]) for y in range(ROWS)]
edges += [(cell(x, ROWS - 1)[1], cell(x, ROWS - 1)[2]) for x in range(COLS)]
for a, b in edges:
    quad = [a, b, (b[0], b[1] + SLAB_H * SS), (a[0], a[1] + SLAB_H * SS)]
    d.polygon(quad, fill=BG, outline=blend(GREEN, 0.8), width=lw(1.5))

# Tiles.
for y in range(ROWS):
    for x in range(COLS):
        t = tile(x, y)
        pts = cell(x, y)
        if t == 1:
            d.polygon(pts, outline=blend(GREEN, 0.4), width=lw(1))
        elif t == 5:
            d.polygon(pts, outline=blend(CYAN, 0.2), width=lw(1))
        else:
            c = YELLOW if t == 4 else CYAN
            d.polygon(pts, fill=blend(c, 0.12 if t == 4 else 0.05), outline=blend(c, 0.5), width=lw(1))

# Shoreline.
EDGE = {(0, -1): (3, 0), (1, 0): (0, 1), (0, 1): (1, 2), (-1, 0): (2, 3)}
for y in range(ROWS):
    for x in range(COLS):
        if tile(x, y) == 1:
            continue
        pts = cell(x, y)
        for (dx, dy), (i, j) in EDGE.items():
            nx, ny = x + dx, y + dy
            if 0 <= nx < COLS and 0 <= ny < ROWS and tile(nx, ny) == 1:
                d.line([pts[i], pts[j]], fill=GREEN, width=lw(2))

# Bridge.
row = next(i for i, r in enumerate(M) if 2 in r)
xs = [x for x, t in enumerate(M[row]) if t == 2]
a, b = iso(xs[0] - 1, row), iso(xs[-1] + 1, row)
for off in (0, 3):
    d.line([(a[0], a[1] - (8 - off) * SS), (b[0], b[1] - (8 - off) * SS)], fill=WHITE, width=lw(2))
for x in (xs[0], xs[-1]):
    tx, ty = iso(x, row)
    deck, top = ty - 8 * SS, ty - 72 * SS
    d.line([(tx - 4 * SS, ty), (tx, top)], fill=WHITE, width=lw(2))
    d.line([(tx + 4 * SS, ty), (tx, top)], fill=WHITE, width=lw(2))
    for k in range(1, 5):
        o = k * TW / 5 * SS
        d.line([(tx, top + 6 * SS), (tx - o, deck + o / 2)], fill=blend(WHITE, 0.55), width=lw(1))
        d.line([(tx, top + 6 * SS), (tx + o, deck - o / 2)], fill=blend(WHITE, 0.55), width=lw(1))

DIRS = {"N": (0, -1), "E": (1, 0), "S": (0, 1), "W": (-1, 0)}


def mecha(gx, gy, facing, color, scale=1.0):
    cx, cy = iso(gx, gy)
    dx, dy = DIRS[facing]
    vx, vy = (dx + dy) * TW / 2 * SS, (dy - dx) * TH / 2 * SS
    n = math.hypot(vx, vy)
    fx, fy = vx / n, vy / n
    tip = (cx + vx * 0.48, cy + vy * 0.48)
    base = (cx + vx * 0.22, cy + vy * 0.22)
    d.polygon([tip, (base[0] - fy * 7 * SS, base[1] + fx * 7 * SS), (base[0] + fy * 7 * SS, base[1] - fx * 7 * SS)], fill=color)
    s = SS * scale
    torso = [(cx - 8 * s, cy - 13 * s), (cx + 8 * s, cy - 13 * s), (cx + 11 * s, cy - 28 * s), (cx - 11 * s, cy - 28 * s)]
    d.polygon(torso, fill=blend(color, 0.15), outline=color, width=lw(1.5))
    d.line([(cx - 6 * s, cy - 1 * s), (cx - 4 * s, cy - 13 * s)], fill=color, width=lw(1.5))
    d.line([(cx + 6 * s, cy - 1 * s), (cx + 4 * s, cy - 13 * s)], fill=color, width=lw(1.5))
    d.rectangle([cx - 17 * s, cy - 30 * s, cx - 11 * s, cy - 22 * s], outline=color, width=lw(1.5))
    d.rectangle([cx + 11 * s, cy - 30 * s, cx + 17 * s, cy - 22 * s], outline=color, width=lw(1.5))
    d.polygon(rhombus(cx, cy - 34 * s, 5 * s, 5 * s), outline=color, width=lw(1.5))
    d.line([(cx + fx * 9 * s, cy - 20 * s), (cx + fx * 26 * s, cy - 20 * s + fy * 13 * s)], fill=color, width=lw(2))


# Pose them face to face mid-lake for the cover.
# Back-to-front: the CPU (smaller screen y) first.
mecha(8, 11, "W", MAGENTA, 2.0)
mecha(5, 11, "E", CYAN, 2.0)
mx, my = iso(6.5, 11)
bolt = [(mx + 60 * SS, 140 * SS)]
for i in range(1, 9):
    t = i / 9
    bolt.append((bolt[0][0] + (mx - bolt[0][0]) * t + ((i * 37) % 23 - 11) * 2 * SS, bolt[0][1] + (my - 50 * SS - bolt[0][1]) * t))
bolt.append((mx, my - 50 * SS))
d.line(bolt, fill=YELLOW, width=lw(4))
d.line(bolt, fill=WHITE, width=lw(1.5))

# Title slabs (Persona style).
def slab(x, y, w, h, fill, outline):
    k = 12 * SS
    x, y, w, h = x * SS, y * SS, w * SS, h * SS
    pts = [(x + k, y), (x + w + k, y), (x + w, y + h), (x, y + h)]
    d.polygon([(px + 5 * SS, py + 5 * SS) for px, py in pts], fill=(0, 0, 0))
    d.polygon(pts, fill=fill, outline=outline, width=lw(2))


def font(size):
    for f in ("consolab.ttf", "arialbd.ttf", "DejaVuSansMono-Bold.ttf"):
        try:
            return ImageFont.truetype(f, size * SS)
        except OSError:
            pass
    return ImageFont.load_default()


slab(150, 28, 500, 64, CYAN, WHITE)
d.text((W / 2 * SS, 60 * SS), "CATATUMBO PROTOCOL", fill=(0, 0, 0), font=font(38), anchor="mm")
slab(250, 102, 300, 30, (0, 0, 0), MAGENTA)
d.text((W / 2 * SS, 117 * SS), "MECHA SIMULTACTICS", fill=WHITE, font=font(18), anchor="mm")

img = img.resize((W, H), Image.LANCZOS)
out = os.path.join(ROOT, "cover.png")
img.save(out, optimize=True)
print("wrote", out, os.path.getsize(out), "bytes")
