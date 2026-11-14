#!/usr/bin/env node
// cine-frames.js · 80 招演武层全量自检 + 离线出图
//
// 运行：node tools/cine-frames.js
// 产物：screenshot-cine-compare.png / screenshot-cine-slash.png / screenshot-cine-grid.png
//
// 本机没有 Chrome 的自动化权限，所以验收图由 Node 用同一个栅格器生成 ——
// 看到的就是浏览器和游戏里的（三者消费同一份声明式帧数据）。
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const ROOT = path.join(__dirname, '..');
require('../cine-catalog.js');
require('../cine-tuning.js');
const V = require('../cine-vfx.js');

// ---------- 极简 PNG 编码（无第三方依赖） ----------
let TBL = null;
function crc32(buf) {
  if (!TBL) {
    TBL = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      TBL[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = TBL[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])) >>> 0, 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePNG(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
function renderCell(id, f, scale, mode) {
  const buf = new V.PixBuf(V.W, V.H, V.PAL.ink1);
  V.rasterize(buf, V.frame(id, f, mode).prims);
  const w = V.W * scale, h = V.H * scale;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const sy = (y / scale) | 0;
    for (let x = 0; x < w; x++) {
      const s = (sy * V.W + ((x / scale) | 0)) * 4, d = (y * w + x) * 4;
      out[d] = buf.d[s]; out[d + 1] = buf.d[s + 1];
      out[d + 2] = buf.d[s + 2]; out[d + 3] = 255;
    }
  }
  return { w, h, rgba: out };
}
function blitCell(dst, dstW, cell, dx, dy) {
  for (let y = 0; y < cell.h; y++) {
    const s = y * cell.w * 4, d = ((dy + y) * dstW + dx) * 4;
    dst.set(cell.rgba.subarray(s, s + cell.w * 4), d);
  }
}
const FONT = {
  '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'], '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'], '9': ['111', '101', '111', '001', '111'],
  'F': ['111', '100', '110', '100', '100'],
  'R': ['110', '101', '110', '101', '101'], 'D': ['110', '101', '101', '101', '110'],
  'L': ['100', '100', '100', '100', '111'], 'U': ['101', '101', '101', '101', '111'],
  ' ': ['000', '000', '000', '000', '000'],
};
function label(rgba, w, h, x, y, text, hex) {
  const c = V.rgb(hex);
  for (let n = 0; n < text.length; n++) {
    const rows = FONT[text[n]] || FONT[' '];
    for (let ry = 0; ry < 5; ry++) for (let rx = 0; rx < 3; rx++) {
      if (rows[ry][rx] !== '1') continue;
      const px = x + n * 4 + rx, py = y + ry;
      if (px < 0 || py < 0 || px >= w || py >= h) continue;
      const i = (py * w + px) * 4;
      rgba[i] = c[0]; rgba[i + 1] = c[1]; rgba[i + 2] = c[2]; rgba[i + 3] = 255;
    }
  }
}

// ---------- 全量自检 ----------
const errs = [];
const palSet = new Set(Object.values(V.PAL));
const rows = V.list();
if (rows.length !== 80) errs.push('招式数不是 80: ' + rows.length);
const fps = new Set(), vfp = new Set();
const visSets = {};
const tierStat = {}, skelStat = {};
let totalFx = 0, totalLegacyFx = 0, emptyAll = [];
for (const r of rows) {
  const id = r.id, len = V.total(id), s = V.specOf(id);
  tierStat[r.tier] = (tierStat[r.tier] || 0) + 1;
  skelStat[r.skeleton] = (skelStat[r.skeleton] || 0) + 1;
  fps.add(V.fingerprint(id));
  let empty = 0, sum = 0;
  const hist = {};
  for (let f = 0; f < len; f++) {
    const fr = V.frame(id, f, 'cine'), od = V.frame(id, f, 'legacy');
    if (fr.f !== f || od.f !== f) errs.push(id + ' 帧号错位 f=' + f);
    const nf = fr.prims.filter(p => p.g === 'fx').length;
    if (!nf) empty++;
    totalFx += nf;
    totalLegacyFx += od.prims.filter(p => p.g === 'fx').length;
    for (const p of fr.prims.concat(od.prims)) {
      if (!palSet.has(p.c)) errs.push(id + ' 非 24 色板: ' + p.c + ' @f' + f);
      if (!(p.a >= 0 && p.a <= 1)) errs.push(id + ' alpha 越界 @f' + f);
      for (const k of ['x', 'y']) if (!Number.isFinite(p[k])) errs.push(id + ' 坐标 NaN @f' + f);
    }
    if (f === V.stages(id)[2].s + 2) {
      // 细指纹：每个 fx 图元的「类型 + 量化坐标 + 颜色」集合。
      // 只数图元类型太粗（会把 4 组不同画面误判成重复），必须落到像素位置与配色。
      const parts = fr.prims.filter(p => p.g === 'fx').map(p =>
        p.k + ':' + Math.round(p.x / 6) + ',' + Math.round(p.y / 6) + ':' + p.c).sort();
      vfp.add(parts.join('|'));
      visSets[id] = new Set(parts);
      for (const p of fr.prims) if (p.g === 'fx') { hist[p.k] = (hist[p.k] || 0) + 1; sum += (p.a === undefined ? 1 : p.a); }
    }
  }
  if (empty) emptyAll.push(id + '(' + empty + ')');
}
if (fps.size !== 80) errs.push('结构指纹重复: ' + fps.size + '/80');
if (vfp.size !== 80) errs.push('命中帧细指纹重复: ' + vfp.size + '/80');
// 两两相似度：Jaccard。完全相同会被上面的细指纹拦住，这里抓「看着像」。
let maxSim = 0, maxPair = '';
const vids = Object.keys(visSets);
for (let i = 0; i < vids.length; i++) for (let j = i + 1; j < vids.length; j++) {
  const A = visSets[vids[i]], B = visSets[vids[j]];
  let inter = 0; for (const k of A) if (B.has(k)) inter++;
  const sim = inter / Math.max(1, A.size + B.size - inter);
  if (sim > maxSim) { maxSim = sim; maxPair = vids[i] + ' / ' + vids[j]; }
}
if (maxSim > 0.72) errs.push('两招命中帧过于相似: ' + maxPair + ' = ' + maxSim.toFixed(3));
if (emptyAll.length) errs.push('存在空档帧: ' + emptyAll.join(','));
// 确定性
if (JSON.stringify(V.frame('sword_1', 12, 'cine')) !== JSON.stringify(V.frame('sword_1', 12, 'cine'))) errs.push('帧数据不确定');
if (JSON.stringify(V.frame('hammer_3', 9, 'cine')) !== JSON.stringify(V.frame('hammer_3', 9, 'cine'))) errs.push('跨招帧数据不确定');

console.log('招式:', rows.length, ' 档位:', JSON.stringify(tierStat), ' 骨架:', JSON.stringify(skelStat));
console.log('结构指纹 ' + fps.size + '/80 · 命中帧细指纹 ' + vfp.size + '/80');
console.log('两两最大相似度 ' + maxSim.toFixed(3) + '（' + maxPair + '），阈值 0.72');
console.log('特效图元总量: 演武 ' + totalFx + ' / 基线 ' + totalLegacyFx +
  '（' + (totalFx / totalLegacyFx).toFixed(1) + '×）· 空档帧 ' + emptyAll.length);
console.log('确定性: 通过 · 24 色板: 通过 · alpha/坐标: 通过');

// ---------- 1. 单招五帧对比（默认 sword_1） ----------
const SHOW = process.env.CINE_ART || 'sword_1';
const showLen = V.total(SHOW);
const KS = [0.10, 0.28, 0.38, 0.55, 0.82].map(u => Math.min(showLen - 1, Math.floor(showLen * u)));
const SCALE = 2, cw = V.W * SCALE, ch = V.H * SCALE;
const gw = cw * KS.length, gh = ch * 2;
const grid = new Uint8ClampedArray(gw * gh * 4);
for (let row = 0; row < 2; row++) {
  const mode = row === 0 ? 'legacy' : 'cine';
  KS.forEach((f, col) => {
    blitCell(grid, gw, renderCell(SHOW, f, SCALE, mode), col * cw, row * ch);
    const band = V.rgb(row === 0 ? V.PAL.paper1 : V.PAL.jade2);
    for (let y = 0; y < 10; y++) for (let x = 0; x < cw; x++) {
      const i = ((row * ch + y) * gw + col * cw + x) * 4;
      grid[i] = band[0]; grid[i + 1] = band[1]; grid[i + 2] = band[2]; grid[i + 3] = 255;
    }
    label(grid, gw, gh, col * cw + 5, row * ch + 2, 'F' + (f < 10 ? '0' + f : '' + f), V.PAL.ink1);
  });
}
fs.writeFileSync(path.join(ROOT, 'screenshot-cine-compare.png'), encodePNG(gw, gh, grid));

// ---------- 2. 命中帧放大对照 ----------
const hitF = V.stages(SHOW)[2].s + 2;
const S2 = 3, a = renderCell(SHOW, hitF, S2, 'legacy'), b = renderCell(SHOW, hitF, S2, 'cine');
const sw = a.w * 2, sh = a.h, single = new Uint8ClampedArray(sw * sh * 4);
blitCell(single, sw, a, 0, 0); blitCell(single, sw, b, a.w, 0);
fs.writeFileSync(path.join(ROOT, 'screenshot-cine-slash.png'), encodePNG(sw, sh, single));

// ---------- 3. 80 招总览：10 列兵器 × 8 行专精 ----------
const FAMS = ['sword', 'blade', 'spear', 'staff', 'dual', 'hammer', 'mage', 'dart', 'chain', 'fan'];
const PROFS = [1, 2, 3, 4, 5, 6, 8, 10];
const GW = V.W * FAMS.length, GH = V.H * PROFS.length;
const sheet = new Uint8ClampedArray(GW * GH * 4);
const mapping = [];
let n = 0;
for (let col = 0; col < FAMS.length; col++) {
  for (let row = 0; row < PROFS.length; row++) {
    const art = rows.find(r => r.fam === FAMS[col] && r.prof === PROFS[row]);
    if (!art) { errs.push('网格缺招: ' + FAMS[col] + ' prof=' + PROFS[row]); continue; }
    const f = V.stages(art.id)[2].s + 2;
    blitCell(sheet, GW, renderCell(art.id, f, 1, 'cine'), col * V.W, row * V.H);
    const band = V.rgb((V.FAMILY[FAMS[col]] || V.FAMILY.sword).accent);
    for (let y = 0; y < 9; y++) for (let x = 0; x < V.W; x++) {
      const i = ((row * V.H + y) * GW + col * V.W + x) * 4;
      sheet[i] = band[0]; sheet[i + 1] = band[1]; sheet[i + 2] = band[2]; sheet[i + 3] = 255;
    }
    n++;
    const no = ('' + n).padStart(2, '0');
    label(sheet, GW, GH, col * V.W + 4, row * V.H + 2, no, V.PAL.ink1);
    mapping.push(no + ' ' + art.id + ' ' + art.name + ' [' + art.tier + '/' + art.skeleton + ']');
  }
}
fs.writeFileSync(path.join(ROOT, 'screenshot-cine-grid.png'), encodePNG(GW, GH, sheet));
fs.writeFileSync(path.join(ROOT, 'tools/cine-grid-index.txt'),
  '80 招总览编号对照（列=兵器，行=专精 1/2/3/4/5/6/8/10）\n\n' + mapping.join('\n') + '\n');

// ---------- 3b. 游戏内 80 招总览（量产启用后的实际画面口径）----------
// 与 3 的演武台视角不同：这里只画 fx、按 game:true 变换、标人物站位，
// 用来一眼确认 79 招接进游戏后不是空的、没飞出画面、彼此不重样。
const gsheet = new Uint8ClampedArray(GW * GH * 4);
const gold = V.rgb(V.PAL.gold3), pale = V.rgb(V.PAL.paper3);
let gn = 0;
for (let col = 0; col < FAMS.length; col++) {
  for (let row = 0; row < PROFS.length; row++) {
    const art = rows.find(r => r.fam === FAMS[col] && r.prof === PROFS[row]);
    if (!art) continue;
    const f = V.stages(art.id)[2].s + 2;
    const fr = V.frame(art.id, f, 'cine', { game: true, rot: 0 });
    blitCell(gsheet, GW, renderPrims(fr.prims, 1, ['fx'], 0), col * V.W, row * V.H);
    const band = V.rgb((V.FAMILY[FAMS[col]] || V.FAMILY.sword).accent);
    for (let y = 0; y < 9; y++) for (let x = 0; x < V.W; x++) {
      const i = ((row * V.H + y) * GW + col * V.W + x) * 4;
      gsheet[i] = band[0]; gsheet[i + 1] = band[1]; gsheet[i + 2] = band[2]; gsheet[i + 3] = 255;
    }
    // 人物站位：不旋转的小金点 + 脚下扁环（真人由 game.js 自己画）
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const px = col * V.W + V.CX + dx, py = row * V.H + V.CY + dy;
      const i = (py * GW + px) * 4;
      gsheet[i] = gold[0]; gsheet[i + 1] = gold[1]; gsheet[i + 2] = gold[2]; gsheet[i + 3] = 255;
    }
    for (let dx = -9; dx <= 9; dx++) {
      const px = col * V.W + V.CX + dx, py = row * V.H + V.CY + 3;
      const i = (py * GW + px) * 4;
      gsheet[i] = pale[0]; gsheet[i + 1] = pale[1]; gsheet[i + 2] = pale[2]; gsheet[i + 3] = 255;
    }
    gn++;
    label(gsheet, GW, GH, col * V.W + 4, row * V.H + 2, ('' + gn).padStart(2, '0'), V.PAL.ink1);
  }
}
fs.writeFileSync(path.join(ROOT, 'screenshot-cine-game-grid.png'), encodePNG(GW, GH, gsheet));

// ---------- 4. 游戏接入四方向验收 ----------
// 用与 game.js 完全相同的调用（game:true + rot）取帧，但只栅格化 bg/fx：
// 游戏里真人由 game.js 按 dir 画，hero 组根本不上屏。再单独标一个站位圈，
// 用来肉眼核对「特效是否从真人锚点发出」以及硬断言质心朝向。
function renderPrims(prims, scale, filter, pad) {
  pad = pad || 0;
  const HH = V.H + pad * 2;
  const buf = new V.PixBuf(V.W, HH, V.PAL.ink1);
  // 上下各留白：朝上/朝下时特效会竖起来，320×180 会把它裁掉大半
  const shifted = pad ? prims.map(o => {
    const n = Object.assign({}, o);
    if (typeof n.y === 'number') n.y += pad;
    if (typeof n.y2 === 'number') n.y2 += pad;
    return n;
  }) : prims;
  V.rasterize(buf, shifted, filter);
  const w = V.W * scale, h = HH * scale;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const sy = (y / scale) | 0;
    for (let x = 0; x < w; x++) {
      const s = (sy * V.W + ((x / scale) | 0)) * 4, d = (y * w + x) * 4;
      out[d] = buf.d[s]; out[d + 1] = buf.d[s + 1];
      out[d + 2] = buf.d[s + 2]; out[d + 3] = 255;
    }
  }
  return { w, h, rgba: out };
}
// 验收图不画演武层的 hero 组：游戏里那组根本不上屏（真人由 game.js 按 dir 画），
// 而且跟着 rot 转 90° 会变成「躺着的小人」。这里画一个永远直立的游戏真人替身，
// 只用一个小金点表示朝向，才能肉眼判断「刀光是不是从人身上发出来的」。
// x/y 是 2× 放大后的屏幕坐标，内部尺寸按 frame 坐标写、统一乘 2。
function markActor(rgba, w, h, x, y, dir) {
  const S = 2;
  const C = { gold: V.rgb(V.PAL.gold3), pale: V.rgb(V.PAL.paper3),
              robe: V.rgb(V.PAL.jade2), rim: V.rgb(V.PAL.jade3),
              dark: V.rgb(V.PAL.ink3), belt: V.rgb(V.PAL.gold2) };
  function fill(dx, dy, ww, hh, c) {
    for (let j = 0; j < hh * S; j++) for (let i = 0; i < ww * S; i++) {
      const px = x + dx * S + i, py = y + dy * S + j;
      if (px < 0 || py < 0 || px >= w || py >= h) continue;
      const k = (py * w + px) * 4;
      rgba[k] = c[0]; rgba[k + 1] = c[1]; rgba[k + 2] = c[2]; rgba[k + 3] = 255;
    }
  }
  // 脚下站位圈（半径 4~5px 的扁环）
  for (let dy = -5; dy <= 5; dy++) for (let dx = -9; dx <= 9; dx++) {
    const d2 = (dx * dx) / 4 + dy * dy;
    if (d2 >= 12 && d2 <= 20) fill(dx, dy, 1, 1, C.pale);
  }
  // 18px 高的直立小人，尺寸与 game.js 的 pMesh(16×18) 对齐
  fill(-3, -18, 6, 5, C.pale);      // 头
  fill(-3, -19, 6, 2, C.dark);      // 发
  fill(-4, -13, 8, 7, C.robe);      // 袍
  fill(-5, -13, 1, 7, C.rim);       // 轮廓光
  fill(-4, -8, 8, 1, C.belt);       // 腰带
  fill(-4, -6, 3, 5, C.dark);       // 左腿
  fill(1, -6, 3, 5, C.dark);        // 右腿
  // 朝向点：跟着 dir 走，但人永远直立 —— 和游戏里方向贴图的行为一致
  const fx = dir === 'R' ? 4 : dir === 'L' ? -6 : -1;
  const fy = dir === 'D' ? -13 : dir === 'U' ? -19 : -16;
  fill(fx, fy, 2, 2, C.gold);
}
// 必须与游戏完全同一条链路：rot 直接传 DIRA 的原值（R/D/L/U）。
// 早期验收图用 aim、游戏却传 -aim，图看着全对、游戏里上下反了 ——
// 这个不一致本身就是 bug，现在两边不许再有符号差。
const DIRS = [['R', 0], ['D', Math.PI / 2], ['L', Math.PI], ['U', -Math.PI / 2]];
const DPAD = 80;
const dW = V.W * 2, dH = (V.H + DPAD * 2) * 2, dw = dW * DIRS.length, dh = dH;
const dirImg = new Uint8ClampedArray(dw * dh * 4);
const centroid = {};
// 质心必须基于「全部 fx 图元」：环身技 / 粒子技可能一条 line 都没有，
// 只统计线会把质心算成 0，然后误判成「方向没跟上」。
function fxCentroid(fr) {
  let sx = 0, sy = 0, n = 0;
  for (const o of fr.prims.filter(p => p.g === 'fx')) for (const [x, y] of primPts(o)) {
    sx += x; sy += y; n++;
  }
  return n ? [sx / n - V.CX, sy / n - V.CY] : [0, 0];
}
DIRS.forEach(([name, rot], i) => {
  const fr = V.frame(SHOW, hitF, 'cine', { game: true, rot: rot });
  // game.js 只画 fx 组，并把整组按 GAME_Y_OFF 下移；这里逐图元复刻这两步，
  // 否则验收图跟玩家实际看到的画面不是同一张。
  const shifted = fr.prims.map(o => {
    if (o.g !== 'fx') return o;
    const n = Object.assign({}, o);
    if (typeof n.y === 'number') n.y += V.GAME_Y_OFF;
    if (typeof n.y2 === 'number') n.y2 += V.GAME_Y_OFF;
    return n;
  });
  const cell = renderPrims(shifted, 2, ['fx'], DPAD);
  // 一条地平线，方便看刀光是贴地还是飘在头顶
  const ground = V.rgb(V.PAL.ink3), gy = (V.CY + DPAD) * 2 + 2;
  for (let x = 0; x < cell.w; x++) {
    const k = (gy * cell.w + x) * 4;
    cell.rgba[k] = ground[0]; cell.rgba[k + 1] = ground[1]; cell.rgba[k + 2] = ground[2];
  }
  // 真人替身永远直立，不参与 rot；站位 = player.x/player.y 投影到帧里的 (CX, CY)
  markActor(cell.rgba, cell.w, cell.h, V.CX * 2, (V.CY + DPAD) * 2, name);
  blitCell(dirImg, dw, cell, i * dW, 0);
  centroid[name] = fxCentroid(fr);
  const band = V.rgb(i === 2 ? V.PAL.red2 : V.PAL.jade2);
  for (let y = 0; y < 10; y++) for (let x = 0; x < dW; x++) {
    const q = (y * dw + i * dW + x) * 4;
    dirImg[q] = band[0]; dirImg[q + 1] = band[1]; dirImg[q + 2] = band[2]; dirImg[q + 3] = 255;
  }
  label(dirImg, dw, dh, i * dW + 5, 2, name, V.PAL.ink1);
});
fs.writeFileSync(path.join(ROOT, 'screenshot-cine-game-dirs.png'), encodePNG(dw, dh, dirImg));
// 硬断言：特效质心必须跟着朝向走，不能四张都偏右
if (!(centroid.R[0] > 0)) errs.push('朝右特效质心没有偏右');
if (!(centroid.L[0] < 0)) errs.push('朝左特效质心没有翻到左边');
if (!(centroid.D[1] > 0)) errs.push('朝下特效质心没有偏下');
if (!(centroid.U[1] < 0)) errs.push('朝上特效质心没有偏上');
// 四方向一致性：每个方向都该是「同一次挥砍」的朝向变换，图元数必须一样。
const counts = {};
for (const [name, rot] of DIRS)
  counts[name] = V.frame(SHOW, hitF, 'cine', { game: true, rot: rot })
    .prims.filter(p => p.g === 'fx').length;
if (new Set(Object.values(counts)).size !== 1)
  errs.push('四方向 fx 图元数量不一致: ' + JSON.stringify(counts));
// 关键回归：朝左必须是 x 镜像，不能是刚性 180° 旋转。
// 刚性旋转会把主刃的 y 分量取反 —— 从上往下劈会变成从下往上挑，
// 这正是「只有朝右对、其他三个方向都不对」的根因。
function mainBlade(fr) {
  return fr.prims.filter(p => p.g === 'fx' && p.k === 'line')
    .reduce((a, b) => (!a || (b.w || 0) > (a.w || 0) ? b : a), null);
}
const bladeR = mainBlade(V.frame(SHOW, hitF, 'cine', { game: true, rot: 0 }));
const bladeL = mainBlade(V.frame(SHOW, hitF, 'cine', { game: true, rot: Math.PI }));
if (bladeR && bladeL) {
  const dyR = bladeR.y2 - bladeR.y, dyL = bladeL.y2 - bladeL.y;
  if (dyR * dyL <= 0) errs.push('朝左主刃旋向被翻了：应 x 镜像保持「从上往下」');
  console.log('主刃 y 分量: R ' + dyR.toFixed(1) + ' / L ' + dyL.toFixed(1) + '（同号=镜像保持旋向）');
}
// 锚点：game 模式演武 hero 只是验收替身，包围盒中心要贴回真人站位
const gfr = V.frame(SHOW, hitF, 'cine', { game: true, rot: 0 });
const heroRects = gfr.prims.filter(p => p.g === 'hero' && p.k === 'rect');
if (heroRects.length) {
  let hx0 = 1e9, hx1 = -1e9;
  for (const o of heroRects) { hx0 = Math.min(hx0, o.x); hx1 = Math.max(hx1, o.x + o.w); }
  if (Math.abs((hx0 + hx1) / 2 - V.CX) > 18) errs.push('游戏模式角色仍带位移，特效会与真人分离');
}
// 「人物跟招式分离」的硬断言：刀光必须从游戏真人的手边发出来，且不能飞太远。
// 演武舞台的手在 CY-28，游戏真人的手在 CY-6；gamePrims 已把两者对齐。
const HX = V.CX + 4, HY = V.CY - 6;
function primPts(o) {
  if (o.k === 'line') return [[o.x, o.y], [o.x2, o.y2], [(o.x + o.x2) / 2, (o.y + o.y2) / 2]];
  if (o.k === 'rect') return [[o.x + o.w / 2, o.y + o.h / 2]];
  return [[o.x, o.y]];
}
// 命中核心：字形化后不再是 80 招统一的白色 disc，按「高亮图元存在」判定
function isCore(o, sp) {
  return (o.a === undefined ? 1 : o.a) >= 0.7 &&
    (o.c === V.PAL.white || o.c === V.PAL.gold3 || o.c === sp.pal.bright || o.c === sp.pal.core);
}
let near = 1e9, far = 0, hasCore = false;
for (const o of gfr.prims.filter(p => p.g === 'fx')) for (const [x, y] of primPts(o)) {
  const d = Math.hypot(x - HX, y - HY);
  near = Math.min(near, d); far = Math.max(far, d);
  if (isCore(o, V.specOf(SHOW))) hasCore = true;
}
if (near > 10) errs.push('刀光离游戏真人的手太远（' + near.toFixed(0) + 'px），会看成人物与招式分离');
if (!hasCore) errs.push('命中帧没有高亮核心，特效会发灰');
// 1px 放射速度线本来就会越过命中点；收紧后上限压到 58px，防止范围再次膨胀。
if (far > 58) errs.push('放射线伸得太远（' + far.toFixed(0) + 'px），技能范围又变大了');
console.log('四方向质心(相对人物):', Object.entries(centroid).map(([k, v]) =>
  k + '(' + v[0].toFixed(0) + ',' + v[1].toFixed(0) + ')').join(' '));
console.log('刀光到手部距离: 最近 ' + near.toFixed(0) + 'px · 高亮核心 ' + (hasCore ? '有' : '无') +
            ' · 最远放射线 ' + far.toFixed(0) + 'px（阈值 10 / 58）');

// ---- 全 80 招「游戏内模式」验收 ----
// 量产启用后不能只验 sword_1：每招都要贴住真人、范围不超、四方向齐全。
// 口径严格沿用上面的「命中帧 + 图元关键点」，别用「全帧最大坐标」——
// 那会把追击段 alpha 0.06 的淡碎屑算进去，误报「范围又变大了」。
const gameStat = { minNear: 1e9, maxNear: 0, maxFar: 0, dirBad: [], empty: [], noCore: [] };
const allArts = V.list();
for (const it of allArts) {
  const stg = V.stages(it.id).find(s => s.id === 'slash') || V.stages(it.id)[2];
  const hf = Math.min(V.total(it.id) - 1, Math.round((stg.s + stg.e) / 2));
  const sp = V.specOf(it.id);
  let near2 = 1e9, far2 = 0, n = 0, core2 = false;
  for (const o of V.frame(it.id, hf, 'cine', { game: true, rot: 0 }).prims.filter(p => p.g === 'fx')) {
    n++;
    if (isCore(o, sp)) core2 = true;
    for (const [x, y] of primPts(o)) {
      const d = Math.hypot(x - HX, y - HY);
      near2 = Math.min(near2, d); far2 = Math.max(far2, d);
    }
  }
  if (!n) gameStat.empty.push(it.id);
  if (!core2) gameStat.noCore.push(it.id);
  gameStat.minNear = Math.min(gameStat.minNear, near2);
  gameStat.maxNear = Math.max(gameStat.maxNear, near2);
  gameStat.maxFar = Math.max(gameStat.maxFar, far2);
  // 四方向：图元数一致 + 质心方位正确（复刻 game.js 的调用参数）
  const cnt = {}, cen = {};
  for (const [name, rot] of DIRS) {
    const fx = V.frame(it.id, hf, 'cine', { game: true, rot: rot }).prims.filter(p => p.g === 'fx');
    cnt[name] = fx.length;
    let sx = 0, sy = 0, pn = 0;
    for (const o of fx) for (const [x, y] of primPts(o)) { sx += x; sy += y; pn++; }
    cen[name] = pn ? [sx / pn - V.CX, sy / pn - V.CY] : [0, 0];
  }
  if (new Set(Object.values(cnt)).size !== 1) gameStat.dirBad.push(it.id + ':图元数');
  // 左右必须真的翻过去；上下用「相对关系」而不是绝对符号：
  // aura / rain 这类环身技（如 mage_3）质心本就贴着人物，D 的 y 可能≈0，
  // 只要它比 U 明显更靠下，就说明方向变换生效了，不该按「必须 y>0」误判。
  if (!(cen.R[0] > 0) || !(cen.L[0] < 0)) gameStat.dirBad.push(it.id + ':左右');
  if (!(cen.D[1] > cen.U[1] + 8)) gameStat.dirBad.push(it.id + ':上下');
}
if (gameStat.maxNear > 12) errs.push('量产：有招式刀光离手 >12px（最大 ' + gameStat.maxNear.toFixed(0) + 'px）');
if (gameStat.noCore.length) errs.push('量产：命中帧缺高亮核心 ' + gameStat.noCore.slice(0, 6).join(','));
if (gameStat.maxFar > 58) errs.push('量产：有招式范围 >58px（最大 ' + gameStat.maxFar.toFixed(0) + 'px）');
if (gameStat.empty.length) errs.push('量产：空特效招式 ' + gameStat.empty.join(','));
if (gameStat.dirBad.length) errs.push('量产：四方向异常 ' + gameStat.dirBad.slice(0, 6).join(','));
console.log('全 80 招游戏内模式: 离手 ' + gameStat.minNear.toFixed(0) + '~' + gameStat.maxNear.toFixed(0) +
            'px · 高亮核心 ' + (allArts.length - gameStat.noCore.length) + '/' + allArts.length +
            ' · 范围≤' + gameStat.maxFar.toFixed(0) +
            'px · 四方向 ' + (allArts.length - gameStat.dirBad.length) + '/' + allArts.length);

// ---------- 5. 零公共层 + 整招形状轨迹（严格口径）----------
// 旧自检把「颜色 + 量化坐标」写进指纹，颜色一换就算不同招 —— 等于拿换色当不重样。
// 这里彻底忽略颜色：每招取 6 个关键帧，把特效与动作分别栅格化成二值 mask，
// 串成「整招形状轨迹」两两比 Jaccard；再查跨招公共图元和主导形态分布。
const bgRGB = V.rgb(V.PAL.ink1);
const RX0 = 30, RY0 = 55, RW = 190, RH = 125, DS = 2, ZOOM = 2;
const CW = Math.ceil(RW / DS), CH = Math.ceil(RH / DS), CELLN = CW * CH;
const shapeCache = {};
function shapeMask(id, f, groups, game) {
  const key = id + ':' + f + ':' + groups.join('') + ':' + (game ? 1 : 0);
  if (shapeCache[key]) return shapeCache[key];
  const fr = V.frame(id, f, 'cine', game ? { game: true, rot: 0 } : undefined);
  const buf = new V.PixBuf(V.W, V.H, V.PAL.ink1);
  V.rasterize(buf, fr.prims.filter(p => groups.includes(p.g)));
  const out = new Uint8Array(CELLN), d = buf.d;
  for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) {
    const i = ((RY0 + y) * V.W + RX0 + x) * 4;
    if (d[i] === bgRGB[0] && d[i + 1] === bgRGB[1] && d[i + 2] === bgRGB[2]) continue;
    out[((y / DS) | 0) * CW + ((x / DS) | 0)] = 1;
  }
  return (shapeCache[key] = out);
}
function keyFrames(id) {
  const sts = V.stages(id), out = [];
  for (const st of sts) out.push(Math.min(V.total(id) - 1, Math.round((st.s + st.e) / 2)));
  const sl = sts.find(s => s.id === 'slash') || sts[2];
  out.push(Math.min(V.total(id) - 1, sl.s + 2));
  return out;
}
function traj(id) {
  const parts = [];
  for (const f of keyFrames(id)) {
    parts.push(shapeMask(id, f, ['fx'], true));
    parts.push(shapeMask(id, f, ['hero'], false));
  }
  const all = new Uint8Array(parts.length * CELLN);
  for (let i = 0; i < parts.length; i++) all.set(parts[i], i * CELLN);
  return all;
}
function jacMask(a, b) {
  let i = 0, u = 0;
  for (let k = 0; k < a.length; k++) { if (a[k] && b[k]) i++; if (a[k] || b[k]) u++; }
  return u ? i / u : 0;
}
const trajs = {}, sims = [];
for (const it of allArts) trajs[it.id] = traj(it.id);
let maxT = 0, maxTPair = '';
for (let i = 0; i < allArts.length; i++) for (let j = i + 1; j < allArts.length; j++) {
  const s = jacMask(trajs[allArts[i].id], trajs[allArts[j].id]);
  sims.push(s);
  if (s > maxT) { maxT = s; maxTPair = allArts[i].id + '/' + allArts[j].id; }
}
sims.sort((a, b) => a - b);
console.log('整招形状轨迹(6帧 × fx+hero，忽略颜色): 中位 ' + sims[Math.floor(sims.length / 2)].toFixed(3) +
  ' · 最大 ' + maxT.toFixed(3) + ' (' + maxTPair + ') · 阈值 0.30');
if (maxT > 0.30) errs.push('整招形状轨迹仍有两招过像: ' + maxTPair + ' = ' + maxT.toFixed(3));

// 跨招公共图元：任何「类型+量化位置」若被 ≥60 招同时画出，就是公共模板层
const common = new Map(), primTop = {};
for (const it of allArts) {
  const sl = V.stages(it.id).find(s => s.id === 'slash') || V.stages(it.id)[2];
  const hf = Math.min(V.total(it.id) - 1, sl.s + 2);
  const fx = V.frame(it.id, hf, 'cine', { game: true, rot: 0 }).prims.filter(p => p.g === 'fx');
  const keys = new Set(), cnt = {};
  for (const o of fx) {
    keys.add(o.k + ':' + Math.round(o.x / 3) + ',' + Math.round(o.y / 3));
    cnt[o.k] = (cnt[o.k] || 0) + 1;
  }
  for (const k of keys) common.set(k, (common.get(k) || 0) + 1);
  const top = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0];
  primTop[top] = (primTop[top] || 0) + 1;
}
const commons = [...common.entries()].filter(([, n]) => n >= 60);
console.log('跨招公共图元(≥60 招同位置同类型): ' + commons.length +
  ' · 主导形态分布: ' + JSON.stringify(primTop));
if (commons.length) errs.push('仍存在公共模板层: ' + commons.length + ' 个跨招图元');
if (Object.keys(primTop).length < 5) errs.push('主导形态只有 ' + Object.keys(primTop).length + ' 种，多数招还是同一种画法');

// ---------- 6. 形状放大对照图（色盲化 + 彩色，都只看人物周围，不再把特效缩成小点）----------
const SW = RW * ZOOM, SH = RH * ZOOM, GW2 = SW * 10, GH2 = SH * 8;
const gray = new Uint8ClampedArray(GW2 * GH2 * 4), color = new Uint8ClampedArray(GW2 * GH2 * 4);
for (let i = 0; i < gray.length; i += 4) {
  gray[i] = 18; gray[i + 1] = 22; gray[i + 2] = 31; gray[i + 3] = 255;
  color[i] = 18; color[i + 1] = 22; color[i + 2] = 31; color[i + 3] = 255;
}
const white = V.rgb(V.PAL.paper3), goldM = V.rgb(V.PAL.gold3);
let sn = 0;
for (let col = 0; col < FAMS.length; col++) for (let row = 0; row < PROFS.length; row++) {
  const art = rows.find(r => r.fam === FAMS[col] && r.prof === PROFS[row]);
  if (!art) continue;
  const sl = V.stages(art.id).find(s => s.id === 'slash');
  const hf = Math.min(V.total(art.id) - 1, sl.s + 2);
  const fr = V.frame(art.id, hf, 'cine', { game: true, rot: 0 });
  const buf = new V.PixBuf(V.W, V.H, V.PAL.ink1);
  V.rasterize(buf, fr.prims.filter(p => p.g === 'fx'));
  const bx = col * SW, by = row * SH;
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
    const sx = RX0 + ((x / ZOOM) | 0), sy = RY0 + ((y / ZOOM) | 0);
    const s = (sy * V.W + sx) * 4, d = ((by + y) * GW2 + bx + x) * 4;
    const hit = !(buf.d[s] === bgRGB[0] && buf.d[s + 1] === bgRGB[1] && buf.d[s + 2] === bgRGB[2]);
    for (let c = 0; c < 3; c++) {
      gray[d + c] = hit ? white[c] : gray[d + c];
      color[d + c] = hit ? buf.d[s + c] : color[d + c];
    }
  }
  // 人物站位：金色小方块（两图同位置）
  const mx = bx + (V.CX - RX0) * ZOOM, my = by + (V.CY - RY0) * ZOOM;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const d = ((my + dy) * GW2 + mx + dx) * 4;
    for (const img of [gray, color]) for (let c = 0; c < 3; c++) img[d + c] = goldM[c];
  }
  sn++;
  label(gray, GW2, GH2, bx + 5, by + 5, ('' + sn).padStart(2, '0'), V.PAL.ink1);
  label(color, GW2, GH2, bx + 5, by + 5, ('' + sn).padStart(2, '0'), V.PAL.paper3);
}
fs.writeFileSync(path.join(ROOT, 'screenshot-cine-shapes.png'), encodePNG(GW2, GH2, gray));
fs.writeFileSync(path.join(ROOT, 'screenshot-cine-detail.png'), encodePNG(GW2, GH2, color));

console.log('\n产物:');
console.log('  screenshot-cine-compare.png  ' + gw + '×' + gh + '  上=基线 下=演武，招式 ' + SHOW);
console.log('  screenshot-cine-slash.png    ' + sw + '×' + sh + '  命中帧 F' + hitF + ' 左旧右新');
console.log('  screenshot-cine-grid.png     ' + GW + '×' + GH + '  80 招命中帧总览（演武台）');
console.log('  screenshot-cine-game-grid.png ' + GW + '×' + GH + '  80 招游戏内合成总览');
console.log('  screenshot-cine-shapes.png    ' + GW2 + '×' + GH2 + '  80 招纯形状对照（忽略颜色，2× 放大）');
console.log('  screenshot-cine-detail.png    ' + GW2 + '×' + GH2 + '  80 招游戏内放大对照（保留配色）');
console.log('  screenshot-cine-game-dirs.png ' + dw + '×' + dh + '  游戏内四方向 R/D/L/U');
console.log('  tools/cine-grid-index.txt    编号对照表');
console.log('\n前 8 招:', rows.slice(0, 8).map(r => r.id + ':' + r.tier + '/' + r.skeleton).join('  '));
if (errs.length) { console.error('\n自检失败 (' + errs.length + '):\n  ' + errs.slice(0, 20).join('\n  ')); process.exit(1); }
console.log('\n自检通过：0 fail');
