#!/usr/bin/env node
// tune-dna.js · 80 招「整招形状去撞」离线调优
//
// 手段：给每招挑一个 dnaTweak（0..11），它会重排该招的构图偏移、姿态曲线、
// 主刃材质，但不碰全局唯一的 (path, glyph, segs) 分配。目标是把「游戏内实际
// 可见的 6 帧特效形状轨迹」两两 Jaccard 的最大值压到严格阈值以下。
//
// 口径与 tools/cine-frames.js 的严格验收完全一致（忽略颜色 / 只看 fx / game:true）。
// 运行：node tools/tune-dna.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
require('../cine-catalog.js');
require('../cine-tuning.js');
const V = require('../cine-vfx.js');
const T = globalThis.CINE_TUNING;
if (!T || !T.arts) throw new Error('CINE_TUNING 未加载');

const ids = V.list().map(x => x.id);
const bg = V.rgb(V.PAL.ink1);
const RX0 = 30, RY0 = 55, RW = 190, RH = 125, DS = 2;
const CW = Math.ceil(RW / DS), CH = Math.ceil(RH / DS), N = CW * CH;

function maskOf(fr) {
  const buf = new V.PixBuf(V.W, V.H, V.PAL.ink1);
  V.rasterize(buf, fr.prims.filter(p => p.g === 'fx'));
  const out = new Uint8Array(N), d = buf.d;
  for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) {
    const i = ((RY0 + y) * V.W + RX0 + x) * 4;
    if (d[i] === bg[0] && d[i + 1] === bg[1] && d[i + 2] === bg[2]) continue;
    out[((y / DS) | 0) * CW + ((x / DS) | 0)] = 1;
  }
  return out;
}
function keyFrames(id) {
  const sts = V.stages(id), out = [];
  for (const st of sts) out.push(Math.min(V.total(id) - 1, Math.round((st.s + st.e) / 2)));
  const sl = sts.find(s => s.id === 'slash') || sts[2];
  out.push(Math.min(V.total(id) - 1, sl.s + 2));
  return out;
}
function trajOf(id) {
  const parts = keyFrames(id).map(f => maskOf(V.frame(id, f, 'cine', { game: true, rot: 0 })));
  const all = new Uint8Array(parts.length * N);
  parts.forEach((p, i) => all.set(p, i * N));
  return all;
}
function jac(a, b) {
  let i = 0, u = 0;
  for (let k = 0; k < a.length; k++) { if (a[k] && b[k]) i++; if (a[k] || b[k]) u++; }
  return u ? i / u : 0;
}
function setTweak(id, tw) {
  T.arts[id] = Object.assign({}, T.arts[id] || {}, { dnaTweak: tw });
  V.invalidate();
}
function report(trajs) {
  let mx = 0, pair = '', over = 0, sum = 0, n = 0;
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const s = jac(trajs[ids[i]], trajs[ids[j]]);
    sum += s; n++;
    if (s > 0.30) over++;
    if (s > mx) { mx = s; pair = ids[i] + '/' + ids[j]; }
  }
  return { mx, pair, over, avg: sum / n };
}

// 初始：全部 tweak=0
const best = {};
for (const id of ids) { best[id] = 0; setTweak(id, 0); }
const trajs = {};
for (const id of ids) trajs[id] = trajOf(id);
console.log('初始:', JSON.stringify(report(trajs)));

// 贪心：逐招挑让「自己与其余 79 招的最大相似度」最小的 tweak
for (let round = 1; round <= 2; round++) {
  let changed = 0;
  for (const id of ids) {
    let pick = best[id], pickScore = Infinity;
    for (let tw = 0; tw < 12; tw++) {
      setTweak(id, tw);
      const t = trajOf(id);
      let mx = 0, sum = 0;
      for (const other of ids) {
        if (other === id) continue;
        const s = jac(t, trajs[other]);
        if (s > mx) mx = s;
        sum += s;
      }
      // 先压最大相似度，再用平均相似度打破平局
      const score = mx * 1000 + sum / (ids.length - 1);
      if (score < pickScore) { pickScore = score; pick = tw; }
    }
    if (pick !== best[id]) changed++;
    best[id] = pick;
    setTweak(id, pick);
    trajs[id] = trajOf(id);
  }
  const r = report(trajs);
  console.log('第 ' + round + ' 轮: 最大 ' + r.mx.toFixed(3) + ' (' + r.pair + ') · 均值 ' +
    r.avg.toFixed(3) + ' · >0.30 共 ' + r.over + ' 对 · 调整 ' + changed + ' 招');
  if (!changed) break;
}

// 写回 cine-tuning.js（保留原有字段与文件头注释）
const file = path.join(ROOT, 'cine-tuning.js');
let src = fs.readFileSync(file, 'utf8');
const arts = {};
for (const id of ids) {
  const o = Object.assign({}, T.arts[id] || {});
  for (const k of Object.keys(o)) if (k === 'dnaTweak' && o[k] === 0) delete o[k];
  if (Object.keys(o).length) arts[id] = o;
}
const body = 'var TUNING = { version: 1, arts: ' + JSON.stringify(arts, null, 2) + ' };\n';
if (/var TUNING = \{[\s\S]*?\};/.test(src)) {
  src = src.replace(/var TUNING = \{[\s\S]*?\};/, body.trim());
  fs.writeFileSync(file, src, 'utf8');
  console.log('已写回 ' + file + '（' + Object.keys(arts).length + ' 招带覆盖）');
} else {
  console.error('找不到 var TUNING 声明，未写文件。请把下面这段手工贴进去：\n' + body);
}
const fin = report(trajs);
console.log('最终: 最大 ' + fin.mx.toFixed(3) + ' · 均值 ' + fin.avg.toFixed(3) +
  ' · >0.30 共 ' + fin.over + ' 对');
