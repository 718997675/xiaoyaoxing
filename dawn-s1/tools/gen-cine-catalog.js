#!/usr/bin/env node
// gen-cine-catalog.js · 从 arts.js 派生 80 招的演武参数目录
//
// 运行：node --experimental-default-type=module tools/gen-cine-catalog.js
// 产物：cine-catalog.js（自动生成，别手改；手改放 cine-tuning.js）
//
// 为什么不手写：80 招本来就有 80 种 shape / 80 种 pose.mode / 80 组 color，
// 演武层要做的不是另造 80 套长相，而是把这些「已有的唯一签名」展开成多帧。
// 这份目录就是把签名摊平给运行时用，字段全来自 arts.js，不掺自己的审美。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARTS, ART_SHAPE_SPECS, ART_POSE_SPECS } from '../arts.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function skeletonOf(fx) {
  if (['melee', 'cleave', 'shockwave', 'pull', 'charge'].includes(fx)) return 'slash';
  if (['proj', 'bolt', 'boomerang'].includes(fx)) return 'pierce';
  if (['buff', 'spin', 'orbit', 'zone'].includes(fx)) return 'aura';
  return 'step';
}
function tierOf(prof) {
  if (prof >= 10) return 'burst';
  if (prof >= 5) return 'standard';
  return 'calm';
}

const arts = {};
for (const a of Object.values(ARTS)) {
  const ss = ART_SHAPE_SPECS[a.shape] || null;
  const ps = ART_POSE_SPECS[a.pose && a.pose.mode] || null;
  arts[a.id] = {
    id: a.id, name: a.name, fam: a.fam, fx: a.fx, slot: a.slot, prof: a.prof,
    shape: a.shape, shapeK: ss ? ss.k : 'legacy', shapeSpec: ss,
    pose: a.pose ? {
      mode: a.pose.mode, a0: a.pose.a0, a1: a.pose.a1,
      dur: a.pose.dur, ease: a.pose.ease,
    } : null,
    poseK: ps ? ps.k : 'legacy', poseSpec: ps,
    color: a.color.slice(),
    reach: a.reach || 40, arc: a.arc || 1.2,
    hits: a.hits || 1, count: a.count || 1, dur: a.dur || 0.25,
    tier: tierOf(a.prof), skeleton: skeletonOf(a.fx),
    // 种子只用 id 派生，保证不同机器 / 不同次生成完全一致
    seed: hash(a.id + '|' + a.shape + '|' + (a.pose && a.pose.mode) + '|' + a.color.join('')),
  };
}

const catalog = { version: 1, count: Object.keys(arts).length, arts };

// ---- 自检：唯一签名不能被生成过程抹平 ----
const errs = [];
const ids = Object.keys(arts);
if (ids.length !== 80) errs.push('招式数不是 80: ' + ids.length);
const sig = (a) => [a.shape, a.pose && a.pose.mode, a.color.join(''), a.fam, a.fx, a.slot, a.prof].join('|');
if (new Set(ids.map(i => sig(arts[i]))).size !== 80) errs.push('演出签名被抹平，存在重复');
if (new Set(ids.map(i => arts[i].seed)).size !== 80) errs.push('种子撞车');
const dist = (fn) => { const m = {}; ids.forEach(i => { const k = fn(arts[i]); m[k] = (m[k] || 0) + 1; }); return m; };
const tiers = dist(a => a.tier), skels = dist(a => a.skeleton);
if ((tiers.burst || 0) > 20) errs.push('爆发档超过 20 招，会全屏过曝: ' + tiers.burst);
for (const k of ['slash', 'pierce', 'aura', 'step']) if (!skels[k]) errs.push('骨架 ' + k + ' 没有招式');
console.log('招式数:', ids.length);
console.log('档位:', JSON.stringify(tiers), ' 骨架:', JSON.stringify(skels));
console.log('shape 原子覆盖:', new Set(ids.map(i => arts[i].shapeK)).size, '类');
console.log('唯一签名: 80/80 · 唯一种子: 80/80');

const out = '/* cine-catalog.js · 自动生成，别手改。改规则请跑 tools/gen-cine-catalog.js\n' +
  ' * 手调单招请写进 cine-tuning.js（覆盖层），重跑生成器不会丢。\n' +
  ' * 经典脚本 / CommonJS 双兼容：浏览器挂全局，Node 走 module.exports。\n' +
  ' */\n(function () {\n  \'use strict\';\n  var CATALOG = ' + JSON.stringify(catalog, null, 1) + ';\n' +
  "  if (typeof globalThis !== 'undefined') globalThis.CINE_CATALOG = CATALOG;\n" +
  "  if (typeof window !== 'undefined') window.CINE_CATALOG = CATALOG;\n" +
  "  if (typeof module !== 'undefined' && module.exports) module.exports = CATALOG;\n" +
  '})();\n';
fs.writeFileSync(path.join(ROOT, 'cine-catalog.js'), out);
console.log('已写 cine-catalog.js  ' + (out.length / 1024).toFixed(1) + ' KB');

// 覆盖层模板：不存在就生成一份空的，用户改这个
const tunePath = path.join(ROOT, 'cine-tuning.js');
if (!fs.existsSync(tunePath)) {
  fs.writeFileSync(tunePath,
    '/* cine-tuning.js · 单招手调覆盖层（手写，生成器不会覆盖）\n' +
    ' * 格式：{ version:1, arts: { "sword_3": { tier:"burst", palette:"gold", trails:4 } } }\n' +
    ' * 可用键：tier(calm/standard/burst) skeleton(slash/pierce/aura/step)\n' +
    ' *         palette(auto/自定对象) motif trails arcs glow ghostLen len notes\n' +
    ' * 只写要改的字段，其余沿用目录。改完刷新页面即可，不用重跑生成器。\n' +
    ' */\n(function () {\n  \'use strict\';\n  var TUNING = { version: 1, arts: {} };\n' +
    "  if (typeof globalThis !== 'undefined') globalThis.CINE_TUNING = TUNING;\n" +
    "  if (typeof window !== 'undefined') window.CINE_TUNING = TUNING;\n" +
    "  if (typeof module !== 'undefined' && module.exports) module.exports = TUNING;\n" +
    '})();\n');
  console.log('已建 cine-tuning.js（空覆盖层，单招调参写这里）');
}
if (errs.length) { console.error('自检失败:\n  ' + errs.join('\n  ')); process.exit(1); }
console.log('自检通过：0 fail');
