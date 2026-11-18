#!/usr/bin/env python3
"""传奇式位图 sprite 流水线：抠背景 + 去水印 → 缩到画布尺度 → 传奇化调色 → 相似度指标。

用途：把 AI 生成的特效原图加工成可直接进游戏的 sprite，并量化「像不像传奇」。
依赖：python -m pip install --target .pylibs pillow（用完可删 .pylibs）

用法：
    PYTHONPATH=.pylibs python tools/sprite-pipeline.py            # 全量重跑
    PYTHONPATH=.pylibs python tools/sprite-pipeline.py seal       # 只重跑某一套

设计约束（2026-11-18 定案，见 LEGEND-VFX-HANDOFF-2026-11-18.md）：
  · 观感高度相似、画面完全原创 —— 这里只做「观感参数对齐」，不做画面搬运
  · 白芯占比 hotPct 必须落在 0.05~0.12（真实传奇素材基准 .095 / .051 / .093）
  · 贴地平面一律 fy=0.32 压扁；素材尺寸按 320x180 画布重新定（传奇原素材是 800x600 俯视场景）
"""
"""传奇化调色：把 AI 原创 sprite 的明度/高光分布调到真实传奇素材的区间。
不复制画面，只对齐「观感参数」—— 这是「高度相似但不抄」里可量化的那部分。"""
import os, sys, json, glob
import colorsys
sys.path.insert(0, '.pylibs')
from PIL import Image

SPR = 'legend-ref/sprites'
REF = 'legend-ref/ref'


def metrics(im):
    W, H = im.size
    px = im.load()
    hues = {}; hot = 0; opq = 0; sats = []; vals = []
    for y in range(H):
        for x in range(W):
            r, g, b, a = px[x, y]
            if a < 40:
                continue
            opq += 1
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            sats.append(s); vals.append(v)
            if v > 0.86 and s < 0.42:
                hot += 1
            if s > 0.12:
                hues[int(h * 12) % 12] = hues.get(int(h * 12) % 12, 0) + 1
    if opq == 0:
        return None
    tot = sum(hues.values()) or 1
    top = max(hues.items(), key=lambda kv: kv[1])
    sats.sort(); vals.sort()
    return {'size': [W, H], 'mainHue': top[0] * 30,
            'huePurity': round(top[1] / tot, 3),
            'hueSpread': len([1 for v in hues.values() if v / tot > 0.03]),
            'hotPct': round(hot / opq, 3),
            'satMed': round(sats[len(sats) // 2], 3),
            'valMed': round(vals[len(vals) // 2], 3),
            'alphaFill': round(opq / float(W * H), 3)}


def main_hue(im):
    m = metrics(im)
    return m['mainHue'] / 360.0 if m else 0.0


def legend_grade(im, gamma=1.10, hot_fix=True, shell=True, hot_pct=0.10):
    """把明度分布压下来 + 暗部染主色 + 压高光 + 边缘暗壳。"""
    im = im.convert('RGBA')
    W, H = im.size
    px = im.load()
    mh = main_hue(im)
    mr, mg, mb = colorsys.hsv_to_rgb(mh, 0.85, 0.55)
    # 白芯占比按分位控制：最亮的那 hot_pct 保留成白芯，其余亮像素往主色相拉。
    # 真实传奇素材的白芯占比是 5~10%（实测 blade .095 / fire .051 / seal .093），
    # AI 生成的月牙白芯高达 37% —— 那就变成「一团白」而不是「厚刀光」。
    vlist = []
    for y in range(H):
        for x in range(W):
            r, g, b, a = px[x, y]
            if a >= 40:
                vlist.append(colorsys.rgb_to_hsv(r/255, g/255, b/255)[2])
    vlist.sort()
    thr = vlist[int(len(vlist) * (1 - hot_pct))] if vlist else 1.0
    for y in range(H):
        for x in range(W):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            v2 = v ** gamma
            # 暗部往主色偏（传奇特效是「有暗壳的实体」，不是纯发光贴纸）
            if v < 0.52:
                t = (0.52 - v) / 0.52 * 0.28
                r = r * (1 - t) + mr * 255 * t
                g = g * (1 - t) + mg * 255 * t
                b = b * (1 - t) + mb * 255 * t
            # 暗部染色之后要重算 h/s/v，再做高光分流
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            # 高光分流：过阈值 → 留作白芯（降饱和、略降明度）；
            # 没到阈值但偏亮 → 染回主色相（提高饱和、压掉纯白感）
            if hot_fix and v >= thr:
                s = min(0.34, s)          # 白芯保留但别太纯白
                v = min(v, 0.985)
            elif hot_fix and v > thr * 0.58:
                s = min(1.0, s + 0.16)
                h = mh
                v = min(v, thr * 0.985)
            r2, g2, b2 = colorsys.hsv_to_rgb(h, s, v)
            rr = int(min(255, max(0, r2 * 255)))
            gg = int(min(255, max(0, g2 * 255)))
            bb = int(min(255, max(0, b2 * 255)))
            # 边缘暗壳：alpha 越低越暗，模拟素材的深色描边
            if shell and a < 250:
                k = 0.74 + 0.26 * (a / 255.0)
                rr = int(rr * k); gg = int(gg * k); bb = int(bb * k)
            px[x, y] = (rr, gg, bb, a)
    return im


# ---- 重建 sprite：先抠图，再缩放，再调色 ----
import subprocess
from collections import deque


def key_out(path):
    im = Image.open(path).convert('RGB')
    W, H = im.size
    px = im.load()
    bg = px[2, 2]
    # 水印区：先在 RGBA 上直接置透明。涂成背景色是不行的 ——
    # 那块是孤立的矩形、不与画布边缘连通，flood fill 吃不到，会留一块灰底。
    def close(c, t, tol=46):
        return abs(c[0]-t[0]) < tol and abs(c[1]-t[1]) < tol and abs(c[2]-t[2]) < tol
    vis = [[False]*W for _ in range(H)]
    q = deque()
    for x in range(W):
        for y in (0, H-1):
            if close(px[x,y], bg) and not vis[y][x]: vis[y][x]=True; q.append((x,y))
    for y in range(H):
        for x in (0, W-1):
            if close(px[x,y], bg) and not vis[y][x]: vis[y][x]=True; q.append((x,y))
    while q:
        x,y = q.popleft()
        for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
            nx,ny = x+dx, y+dy
            if 0<=nx<W and 0<=ny<H and not vis[ny][nx] and close(px[nx,ny], bg):
                vis[ny][nx]=True; q.append((nx,ny))
    out = Image.new('RGBA',(W,H),(0,0,0,0)); op = out.load()
    for y in range(H):
        for x in range(W):
            if vis[y][x]: op[x,y]=(0,0,0,0)
            else: op[x,y]=(px[x,y][0],px[x,y][1],px[x,y][2],255)
    # 水印矩形：强制透明（它不与边缘连通，flood fill 清不掉）
    for y in range(int(H*0.86), H):
        for x in range(int(W*0.76), W):
            op[x,y] = (0,0,0,0)
    # ---- 净化 alpha 边缘 ----
    # 抠图后边缘留下半透明像素，颜色还是原背景（灰褐，低饱和高明度），
    # 会被「白芯占比」误判成大片高光。做法：半透明处的颜色换成最近实心邻居的颜色。
    from PIL import ImageFilter
    alpha = out.getchannel('A')
    solid = alpha.point(lambda v: 255 if v >= 200 else 0)
    near = solid.filter(ImageFilter.MaxFilter(9))      # 9x9 邻域内有实心像素
    black = Image.new('RGB', out.size, (0, 0, 0))
    clean_rgb = Image.composite(out.convert('RGB'), black, near)
    a2 = alpha.point(lambda v: 0 if v < 24 else v)
    out = Image.merge('RGBA', (*clean_rgb.split(), a2))
    bb = out.getbbox()
    return out.crop(bb) if bb else out


new = {}
for f in sorted(glob.glob('../generated-images/*.png')):
    b = os.path.basename(f)
    if 'huge_thick_crescent' in b:
        new['blade_b'] = f
    elif 'thick_crescent' in b:
        new['blade_a'] = f
    elif 'lightning_pi' in b:
        new['thunder'] = f
    elif 'ground_magic' in b:
        new['seal'] = f
    elif 'round_fireball' in b:
        new['fireball'] = f

# 小弯月牙直接从已抠好的帧序列取
if os.path.exists('legend-ref/frames/ai/00.png'):
    new['blade_a'] = 'legend-ref/frames/ai/00.png'

TARGET = {'blade_a': 150, 'blade_b': 340, 'thunder': 120, 'seal': 300, 'fireball': 130}
report = {}
for tag, path in new.items():
    src = key_out(path) if path.endswith('.png') else Image.open(path).convert('RGBA')
    w, h = src.size
    s = TARGET[tag] / float(w)
    src = src.resize((TARGET[tag], max(1, int(h * s))), Image.LANCZOS)
    before = metrics(src)
    graded = legend_grade(src)
    out = os.path.join(SPR, tag + '.png')
    graded.save(out)
    report['ai_' + tag] = {'before': before, 'after': metrics(graded)}
    print(tag, 'val', before['valMed'], '->', report['ai_' + tag]['after']['valMed'],
          '| hot', before['hotPct'], '->', report['ai_' + tag]['after']['hotPct'])

json.dump(report, open('legend-ref/similarity.json', 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)
print('ok')
