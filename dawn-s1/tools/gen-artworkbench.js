#!/usr/bin/env node
// gen-artworkbench.js · 从 arts.js / pixel.js 生成工作台内嵌的基线数据
//
// 工作台是双击即开的单文件 HTML，不能直接 import ESM（file:// 会 CORS）。
// 所以每次 arts.js 改了招式，跑一次这个脚本，把 64 招的精简字段重新内联进去。
// 用法：node tools/gen-artworkbench.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const artsSrc = fs.readFileSync(path.join(ROOT, 'arts.js'), 'utf8').replace(/\r\n/g, '\n');
const pixelSrc = fs.readFileSync(path.join(ROOT, 'pixel.js'), 'utf8').replace(/\r\n/g, '\n');

// 1. 调色板：C.xxx -> #RRGGBB
const colors = {};
const cBlock = /export const C = \{([\s\S]*?)\n\};/.exec(pixelSrc);
if (!cBlock) throw new Error('pixel.js 里找不到 export const C');
for (const m of cBlock[1].matchAll(/(\w+)\s*:\s*['"](#[0-9a-fA-F]{6})['"]/g)) colors[m[1]] = m[2];
if (Object.keys(colors).length < 10) throw new Error('调色板解析不到 10 个颜色，实际 ' + Object.keys(colors).length);

// 2. 常量表
function strArray(name) {
  const re = new RegExp('export const ' + name + ' = \\[([\\s\\S]*?)\\];');
  const m = re.exec(artsSrc);
  if (!m) throw new Error('arts.js 里找不到 ' + name);
  return [...m[1].matchAll(/['"]([\w]+)['"]/g)].map(x => x[1]);
}
const shapes = strArray('ART_SHAPES');
const poses = strArray('ART_POSES');
const snds = strArray('ART_SNDS');
const fx = strArray('ART_FX');

// 3. 64 招：按 "  id: { ... \n  }," 切块（招式结束行的缩进恰好两个空格）
const lines = artsSrc.split('\n');
const arts = {};
let cur = null, buf = [];
for (const line of lines) {
  if (!cur) {
    const m = /^  ([a-z]+_\d+): \{/.exec(line);
    if (m) { cur = m[1]; buf = [line]; }
  } else {
    buf.push(line);
    if (line === '  },') {
      const src = buf.join('\n');
      const get = (re) => { const x = re.exec(src); return x ? x[1] : null; };
      const num = (k, d) => {
        const v = get(new RegExp('\\b' + k + ':\\s*(-?[\\d.]+)'));
        return v === null ? d : Number(v);
      };
      // shape / color 必须从「招式顶层那一行」一起取：
      //     shape: 'sigil', color: [C.paper2, C.paper1],
      // 踩过一次：zone: { ..., shape: 'circle' } 里的地面几何也叫 shape，
      // 用宽泛的 /\bshape:/ 会把 spear_6 等 5 招解析成 circle/line ——
      // 这两个名字根本不在 ART_SHAPES 里，工作台下拉框会显示成空值。
      const sigLine = /^ {4}shape:\s*['"](\w+)['"],\s*color:\s*\[([^\]]+)\]/m.exec(src);
      const shapeVal = sigLine ? sigLine[1] : 'arc';
      const colorPair = sigLine ? sigLine[2] : null;
      const col = colorPair
        ? colorPair.split(',').map(s => {
          const t = s.trim();
          const cm = /C\.(\w+)/.exec(t);
          return cm ? (colors[cm[1]] || '#E8DFC8') : (/^['"]#/.test(t) ? t.replace(/['"]/g, '') : '#E8DFC8');
        })
        : ['#E8DFC8', '#B9C6D8'];
      const poseBlock = get(/pose:\s*\{([^}]*)\}/);
      const pose = { mode: get(/\bmode:\s*['"](\w+)['"]/) || 'swing', a0: num('a0', -1.2), a1: num('a1', 1.2), dur: num('dur', 0.3), ease: get(/\bease:\s*['"](\w+)['"]/) || 'out' };
      if (poseBlock) {
        const pm = /mode:\s*['"](\w+)['"]/.exec(poseBlock); if (pm) pose.mode = pm[1];
        const pa = /a0:\s*(-?[\d.]+)/.exec(poseBlock); if (pa) pose.a0 = Number(pa[1]);
        const pb = /a1:\s*(-?[\d.]+)/.exec(poseBlock); if (pb) pose.a1 = Number(pb[1]);
        const pd = /dur:\s*(-?[\d.]+)/.exec(poseBlock); if (pd) pose.dur = Number(pd[1]);
        const pe = /ease:\s*['"](\w+)['"]/.exec(poseBlock); if (pe) pose.ease = pe[1];
      }
      arts[cur] = {
        id: cur,
        fam: get(/\bfam:\s*['"](\w+)['"]/) || '',
        name: get(/\bname:\s*['"]([^'"]+)['"]/) || cur,
        desc: get(/\bdesc:\s*['"]([^'"]+)['"]/) || '',
        slot: get(/\bslot:\s*['"](\w+)['"]/) || '',
        fx: get(/\bfx:\s*['"](\w+)['"]/) || 'melee',
        cd: num('cd', 4), cost: num('cost', 5), mul: num('mul', 6),
        reach: num('reach', 44), arc: num('arc', 1.6),
        pose,
        shape: shapeVal,
        color: col,
        snd: get(/\bsnd:\s*['"](\w+)['"]/) || 'slash',
        hitSnd: get(/\bhitSnd:\s*['"](\w+)['"]/) || 'hit',
      };
      cur = null; buf = [];
    }
  }
}
if (Object.keys(arts).length !== 64) throw new Error('只解析到 ' + Object.keys(arts).length + ' 招（应为 64）');

// 解析结果逐项对照 arts.js 自己的登记表。只要字段被嵌套对象污染 / 写错名字，
// 这里立刻炸，不会等用户打开工作台看见一个空下拉框才发现。
const FAM_IDS = ['sword', 'blade', 'spear', 'staff', 'dual', 'hammer', 'mage', 'dart'];
const pools = { shape: shapes, 'pose.mode': poses, snd: snds, hitSnd: snds, fx, fam: FAM_IDS };
const stray = [];
for (const a of Object.values(arts)) {
  const vals = { shape: a.shape, 'pose.mode': a.pose.mode, snd: a.snd, hitSnd: a.hitSnd, fx: a.fx, fam: a.fam };
  for (const k of Object.keys(pools)) {
    if (pools[k].indexOf(vals[k]) < 0) stray.push(a.id + '.' + k + '=' + vals[k]);
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(a.color[0]) || !/^#[0-9a-fA-F]{6}$/.test(a.color[1] || ''))
    stray.push(a.id + '.color=' + a.color.join('/'));
  if (!(a.mul > 0) || !(a.cd > 0) || !(a.reach > 0)) stray.push(a.id + ' 数值异常');
}
for (const f of FAM_IDS) {
  const n = Object.values(arts).filter(a => a.fam === f).length;
  if (n !== 8) stray.push('兵器 ' + f + ' 只解析到 ' + n + ' 招');
}
if (stray.length) throw new Error('基线解析结果不在登记池里（多半是匹配到了嵌套字段）：\n  ' + stray.join('\n  '));

const data = {
  version: 1,
  shapes, poses, snds, fx,
  palette: Object.entries(colors).map(([k, v]) => ({ name: k, hex: v })),
  fams: FAM_IDS,
  famLabel: { sword: '剑', blade: '刀', spear: '枪', staff: '棍', mage: '法杖', dual: '双刃', hammer: '锤', dart: '暗器' },
  arts,
};

// 4. 内联进工作台 HTML（可重复执行）
const p = path.join(ROOT, 'art-workbench.html');
const raw = fs.readFileSync(p, 'utf8');
const CRLF = raw.indexOf('\r\n') >= 0;
const html = CRLF ? raw.replace(/\r\n/g, '\n') : raw;
const re = /<script id="wbBase" type="application\/json">[\s\S]*?<\/script>/;
if (!re.test(html)) throw new Error('art-workbench.html 里找不到 <script id="wbBase">');
const json = JSON.stringify(data);
const out = html.replace(re, () => '<script id="wbBase" type="application/json">' + json + '</script>');
fs.writeFileSync(p, CRLF ? out.replace(/\n/g, '\r\n') : out, 'utf8');
console.log('工作台基线数据已内联：64 招 / ' + shapes.length + ' 形 / ' + poses.length + ' 式 / '
  + snds.length + ' 音 / ' + Object.keys(colors).length + ' 色，' + (json.length / 1024).toFixed(1) + ' KB');
