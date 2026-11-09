#!/usr/bin/env python3
"""Composite per-character 4x6 frame sheets into one 24x8 transparent SRPG sheet."""
import numpy as np
from PIL import Image
from scipy import ndimage

SRC = '/Users/niekai/Documents/ai-game/xiaoyaoxing/vibe_images/'
OUT = '/Users/niekai/Documents/ai-game/shanhaice-strategy/assets/units-spritesheet-24x8-v1.png'
PREVIEW = SRC + 'sheet-preview-dark.png'

SHEETS = [
    ('yunce',   'unit-frames-yunce_1794242269207_78ec3fda.png'),
    ('yankui',  'unit-frames-yankui-v2_1794242676817_fd78f754.png'),
    ('luming',  'unit-frames-luming_1794242309572_4ea3339f.png'),
    ('qingluo', 'unit-frames-qingluo-v2_1794242703875_e8d6437a.png'),
    ('bailu',   'unit-frames-bailu-v3_1794243183295_ad35ce96.png',),
    ('xuanyi',  'unit-frames-xuanyi-v2_1794242751000_5918abfb.png'),
    ('moya',    'unit-frames-moya-v3_1794243209777_a146ddef.png'),
    ('chisang', 'unit-frames-chisang-v3_1794243228386_eb029bf6.png'),
]

CELL_W, CELL_H = 85, 128
BASELINE = 112
TARGET_H = 40
MAX_W = 78
OUTLINE = (26, 22, 30)


def extract_cells(path):
    a = np.asarray(Image.open(path).convert('RGB'))
    g = a.mean(axis=2)
    bg = a.min(axis=2) >= 240
    lab, n = ndimage.label(bg)
    border = set(lab[0, :]) | set(lab[-1, :]) | set(lab[:, 0]) | set(lab[:, -1])
    border.discard(0)
    sprite = ~np.isin(lab, list(border))
    # enclosed white loops (arm/bow/axe holes) are background, white cloth is not:
    # holes are bounded by the dark inner outline, cloth highlights by mid shading
    for i in range(1, n + 1):
        if i in border:
            continue
        m = lab == i
        if m.sum() < 10:
            continue
        px = a[m]
        if px.mean() < 249 or px.std() > 4:
            continue
        ring = ndimage.binary_dilation(m, np.ones((5, 5), bool)) & ~m
        if (g[ring] < 120).mean() >= 0.35:
            sprite[m] = False
    cells = []
    for r in range(4):
        for c in range(6):
            m = sprite[r * 256:(r + 1) * 256, c * 256:(c + 1) * 256].copy()
            ys, xs = np.where(m)
            if len(ys) == 0:
                raise RuntimeError(f'empty cell {r},{c} in {path}')
            y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
            bw, bh = x1 - x0 + 1, y1 - y0 + 1
            widths = m[:, x0:x1 + 1].sum(axis=1)
            y = y1
            while y >= y1 - bh // 5:
                if widths[y] > 0.8 * bw:
                    y2 = y
                    while y2 >= y0 and widths[y2] > 0.8 * bw:
                        y2 -= 1
                    if y - y2 <= 5:
                        m[y2 + 1:y + 1, :] = False
                    y = y2
                else:
                    y -= 1
            # second pass: neutral-gray line rows merged with a wide hem
            sub = a[r * 256:(r + 1) * 256, c * 256:(c + 1) * 256]
            spread = sub.max(axis=2).astype(int) - sub.min(axis=2)
            val = sub.mean(axis=2)
            neutral = (spread <= 12) & (val >= 40) & (val <= 230)
            marked = np.zeros(256, bool)
            for yy in range(y1, max(y0, y1 - bh // 4) - 1, -1):
                rowm = m[yy, x0:x1 + 1]
                if rowm.sum() > 0.6 * bw and neutral[yy, x0:x1 + 1][rowm].mean() >= 0.7:
                    marked[yy] = True
            yy = y1
            while yy >= y0:
                if marked[yy]:
                    y2 = yy
                    while y2 >= y0 and marked[y2]:
                        y2 -= 1
                    if yy - y2 <= 6:
                        m[y2 + 1:yy + 1, :] = False
                    yy = y2
                else:
                    yy -= 1
            lab2, n2 = ndimage.label(m)
            sizes = ndimage.sum(m, lab2, range(1, n2 + 1))
            m = lab2 == (int(np.argmax(sizes)) + 1)
            ys, xs = np.where(m)
            y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
            rgba = np.zeros((y1 - y0 + 1, x1 - x0 + 1, 4), np.uint8)
            rgba[..., :3] = a[r * 256 + y0:r * 256 + y1 + 1, c * 256 + x0:c * 256 + x1 + 1]
            rgba[..., 3] = m[y0:y1 + 1, x0:x1 + 1] * 255
            cells.append(rgba)
    return cells


def normalize(rgba):
    h, w = rgba.shape[:2]
    s = TARGET_H / h
    nw, nh = max(1, round(w * s)), TARGET_H
    if nw > MAX_W:
        s2 = MAX_W / nw
        nw, nh = MAX_W, max(1, round(nh * s2))
    im = Image.fromarray(rgba).resize((nw, nh), Image.NEAREST)
    return np.asarray(im)


def row_palette(sprites):
    pix = np.concatenate([s[..., :3][s[..., 3] > 0][::3] for s in sprites])
    sample = Image.fromarray(pix.reshape(1, -1, 3).astype(np.uint8))
    q = sample.quantize(colors=24, method=Image.Quantize.MEDIANCUT)
    return np.asarray(q.getpalette()[:72], np.int32).reshape(24, 3)


def quantize(rgba, pal):
    out = rgba.copy()
    m = rgba[..., 3] > 0
    px = rgba[..., :3][m].astype(np.int32)
    d = ((px[:, None, :] - pal[None, :, :]) ** 2).sum(-1)
    out[..., :3][m] = pal[d.argmin(1)].astype(np.uint8)
    return out


def main():
    rows = []
    for name, fn in SHEETS:
        cells = [normalize(c) for c in extract_cells(SRC + fn)]
        pal = row_palette(cells)
        row = np.zeros((CELL_H, CELL_W * 24, 4), np.uint8)
        for i, sp in enumerate(cells):
            sp = quantize(sp, pal)
            h, w = sp.shape[:2]
            x = i * CELL_W + (CELL_W - w) // 2
            y = BASELINE - h
            cell = row[:, i * CELL_W:(i + 1) * CELL_W]
            cell[y:y + h, x - i * CELL_W:x - i * CELL_W + w] = sp
            sil = cell[..., 3] > 0
            ring = ndimage.binary_dilation(sil, np.ones((3, 3), bool)) & ~sil
            cell[ring] = (*OUTLINE, 255)
        rows.append(row)
        print(name, 'ok', [ (s.shape[1], s.shape[0]) for s in cells ][:6])
    sheet = np.concatenate(rows, axis=0)
    Image.fromarray(sheet).save(OUT)
    prev = np.zeros_like(sheet)
    prev[..., :3] = (42, 46, 53)
    al = sheet[..., 3:4] / 255.0
    prev[..., :3] = (sheet[..., :3] * al + prev[..., :3] * (1 - al)).astype(np.uint8)
    prev[..., 3] = 255
    Image.fromarray(prev).save(PREVIEW)
    a = sheet[..., 3]
    print('sheet', sheet.shape, 'transparent px:', int((a == 0).sum()), 'opaque:', int((a == 255).sum()))


if __name__ == '__main__':
    main()