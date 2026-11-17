#!/usr/bin/env node
// tune-dna.js · 80 招「整招形状去撞」离线调优
//
// 手段：给每招挑一个 dnaTweak（0..11），它会重排该招的骨架(body)、主导图元(primacy)、
// 构图偏移、姿态曲线、主刃材质，但不碰全局唯一的 (path,glyph,segs) 分配。
//
// 口径与 tools/cine-frames.js 的严格验收【完全一致】：
//   每招取 6 个关键帧，fx(game:true) 与 hero(cine) 分别栅格化成二值 mask，交替拼成
//   「整招形状轨迹」，两两比 Jaccard。忽略颜色。旧的只优化 fx 的版本会漏掉人物剪影，
//   这正是 dual_5/mage_2 之前 fx 压得很低、整招仍 0.473 的原因。
//
// 运行：
//   node tools/tune-dna.js                全 80 招全局调优
//   node tools/tune-dna.js dual_5 mage_2  只重调指定招（局部，保留其余 tweak 不动）
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

// 与 cine-frames.js shapeMask 完全一致：按 groups 过滤图元后栅格化成二值 mask。
function maskOf(fr, groups) {
  const buf = new V.PixBuf(V.W, V.H, V.PAL.ink1);
  V.rasterize(buf, fr.prims.filter(p => groups.includes(p.g)));
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
// 分层口径：
//   优化目标 = FX 层整招轨迹（6 帧 game:true 二值 mask 拼接）两两 Jaccard。
//   硬约束   = 不允许任何两招「FX 与 HERO 都像」（各>阈值），即每招至少在一个维度明显不同。
// 动作层(hero)不参与优化目标：80 招共用同一个 16×18 像素角色模型，剪影天然相似，
// 要求它两两<0.30 在物理上做不到；真正贴合「不重样」的是特效互异 + 不存在双重雷同。
function trajOf(id) {
  const parts = [];
  for (const f of keyFrames(id))
    parts.push(maskOf(V.frame(id, f, 'cine', { game: true, rot: 0 }), ['fx']));
  const all = new Uint8Array(parts.length * N);
  parts.forEach((p, i) => all.set(p, i * N));
  return all;
}
function heroOf(id) {
  const parts = [];
  for (const f of keyFrames(id)) parts.push(maskOf(V.frame(id, f, 'cine'), ['hero']));
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
function report(trajs, subset) {
  const list = subset || ids;
  let mx = 0, pair = '', over = 0, sum = 0, n = 0;
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const s = jac(trajs[list[i]], trajs[list[j]]);
    sum += s; n++;
    if (s > 0.30) over++;
    if (s > mx) { mx = s; pair = list[i] + '/' + list[j]; }
  }
  return { mx, pair, over, avg: sum / n };
}

const local = process.argv.slice(2).filter(a => ids.includes(a));
const targets = local.length ? local : ids;
console.log('模式:', local.length ? '局部 ' + targets.join(',') : '全局 80 招');

const trajs = {};
for (const id of ids) trajs[id] = trajOf(id);
console.log('初始(全局): ', JSON.stringify(report(trajs)));

// 双硬约束计数：FX>0.30 的对数；以及「FX>0.40 且 HERO>0.45」双重雷同的对数。
let heroes = {};
function initHeroes() { for (const id of ids) heroes[id] = heroOf(id); }
initHeroes();
function hardScore(t, h, self) {
  let doubleLike = 0;
  for (const other of ids) {
    if (other === self) continue;
    const f = jac(t, trajs[other]);
    if (f > 0.40 && jac(h, heroes[other]) > 0.45) doubleLike++;
  }
  return doubleLike;
}
// 先报初始双重雷同
let dbl0 = 0;
for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++)
  if (jac(trajs[ids[i]], trajs[ids[j]]) > 0.40 && jac(heroes[ids[i]], heroes[ids[j]]) > 0.45) dbl0++;
console.log('初始双重雷同(FX>0.40 & HERO>0.45):', dbl0, '对');

// 贪心：逐招挑让「自己与其余 79 招的最大 FX 相似度」最小的 tweak，
// 且不允许产生「FX 与 HERO 双重雷同」。局部模式只动 targets。
for (let round = 1; round <= 3; round++) {
  let changed = 0;
  for (const id of targets) {
    const cur = (T.arts[id] && T.arts[id].dnaTweak) || 0;
    let pick = cur, pickScore = Infinity;
    for (let tw = 0; tw < 12; tw++) {
      setTweak(id, tw);
      const t = trajOf(id), h = heroOf(id);
      let mx = 0, sum = 0;
      for (const other of ids) {
        if (other === id) continue;
        const s = jac(t, trajs[other]);
        if (s > mx) mx = s;
        sum += s;
      }
      const dbl = hardScore(t, h, id);
      // 主键：双重雷同数(必须0)；次键：最大FX相似度；再次：均值；极小 tie-break 偏向 0
      const score = dbl * 1e6 + mx * 1000 + sum / (ids.length - 1) + tw * 1e-6;
      if (score < pickScore) { pickScore = score; pick = tw; }
    }
    if (pick !== cur) changed++;
    setTweak(id, pick);
    trajs[id] = trajOf(id);
    heroes[id] = heroOf(id);
  }
  const r = report(trajs);
  let dbl = 0;
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++)
    if (jac(trajs[ids[i]], trajs[ids[j]]) > 0.40 && jac(heroes[ids[i]], heroes[ids[j]]) > 0.45) dbl++;
  console.log('第 ' + round + ' 轮: FX最大 ' + r.mx.toFixed(3) + ' (' + r.pair + ') · 均值 ' +
    r.avg.toFixed(3) + ' · FX>0.30 共 ' + r.over + ' 对 · 双重雷同 ' + dbl + ' · 调整 ' + changed + ' 招');
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
console.log('最终: 最大 ' + fin.mx.toFixed(3) + ' (' + fin.pair + ') · 均值 ' + fin.avg.toFixed(3) +
  ' · >0.30 共 ' + fin.over + ' 对');
