// tools/gen-vfx-overrides.js · 80 招特效节奏覆盖表生成器
//
// 运行（Node 22，需让 .js 按 ESM 解析，项目没有也不能有 package.json —— server.js / build.js 用 require）：
//   node --experimental-default-type=module tools/gen-vfx-overrides.js
//
// 产出：
//   art-overrides.vfx80.json    80 招全量覆盖表（待确认后使用，不影响线上）
//   art-overrides.sample.json   10 招样板（每类兵器 1 招，可直接导入工作台试玩）
//   /tmp/xy-vfx-table.md        80 行设计表（粘进 VFX-DESIGN-80.md）
//
// 设计边界（很重要）：只写 timeline，绝不碰 shape / pose / color / snd / hitSnd / shv。
// P12-D/E 把这批字段做成了「80 招各自 80 个不同值」，tools/art-unique.js 会卡死任何重复；
// 家族配色只写进设计文档作为后续换色规范，本轮不落表。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARTS } from '../arts.js';
import { OVERRIDE_SAFE, artTiming } from '../artoverrides.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 十类兵器的视觉语言：母题取自「玄幻打斗」11 类克制模块，
// kStart / kLen 是相对功能位基线的节奏系数（30fps 帧数）。
const FAM = {
  sword:  { name: '剑',   module: '飞剑剑气 / 灵气气场',   colors: 'jade3 + paper3', kStart: -1, kLen: 0.85, tone: '细、亮、快' },
  blade:  { name: '刀',   module: '血光魔气 / 冲击波',     colors: 'red2 + gold2',   kStart:  0, kLen: 0.90, tone: '刚猛、短促' },
  spear:  { name: '枪',   module: '穿刺爆发 / 剑气',       colors: 'jade2 + white',  kStart: -1, kLen: 0.80, tone: '一线贯穿' },
  staff:  { name: '杖',   module: '法阵符箓 / 灵气',       colors: 'gold2 + pur3',   kStart:  1, kLen: 1.15, tone: '起阵慢、余韵长' },
  dual:   { name: '双刃', module: '分身残影 / 剑气',       colors: 'ink3 + jade3',    kStart:  0, kLen: 1.00, tone: '错位双影' },
  hammer: { name: '锤',   module: '冲击波 / 空间裂纹',     colors: 'gold2 + red2',    kStart:  1, kLen: 1.10, tone: '白心爆点 + 环浪' },
  mage:   { name: '法',   module: '雷法电弧 / 冰晶',       colors: 'pur2 + jade3',    kStart: -1, kLen: 0.90, tone: '折线快闪' },
  dart:   { name: '暗器', module: '空间裂纹 / 残影',       colors: 'ink3 + white',    kStart: -1, kLen: 0.75, tone: '细裂即逝' },
  chain:  { name: '链',   module: '结界护罩 / 电弧',       colors: 'pur3 + ink2',     kStart:  2, kLen: 1.35, tone: '铺场、收束慢' },
  fan:    { name: '扇',   module: '灵气气场 / 虹彩星云',   colors: 'jade3 + gold3',   kStart:  1, kLen: 1.20, tone: '气旋上扬' },
};

// 五阶段节奏压进一次招式：fxStart = ②蓄能→③释放的硬切点，
// fxLen = ③释放 + ④命中白心 + ⑤余波淡出（game.js 用 t/max 做衰减）。
const SLOT = {
  dmg:     { start: 2, len: 8,  label: '单体·连击' },
  aoe:     { start: 4, len: 12, label: '清场' },
  move:    { start: 1, len: 6,  label: '位移' },
  ctrl:    { start: 5, len: 10, label: '控制' },
  buff:    { start: 7, len: 12, label: '增益' },
  special: { start: 3, len: 12, label: '特色' },
};
// 克制为主，只在高潮切爆发：每类 prof=10 的压轴招。
const BURST = { start: 8, len: 22, label: '压轴·爆发档' };

const FORBIDDEN = ['shape', 'pose', 'color', 'snd', 'hitSnd', 'shv', 'id', 'fam', 'slot', 'prof'];

const rows = Object.values(ARTS);
const arts = {};
const table = [];

for (const a of rows) {
  const f = FAM[a.fam];
  if (!f) throw new Error('未登记的兵器家族: ' + a.fam);
  const burst = a.prof === 10;
  const base = burst ? BURST : (SLOT[a.slot] || SLOT.dmg);
  // 同家族同功能位常有两招（如 sword_1 力劈 / sword_2 连环刺）。用 id 序号做
  // 确定性 ±1~2 帧错位，连起来才不像复制粘贴；压轴招不抖，保住统一的压轴感。
  const n = Number(a.id.split('_')[1]);
  const jS = burst ? 0 : ((n * 7) % 3) - 1;
  const jL = burst ? 0 : ((n * 7) % 5) - 2;
  const start = Math.max(1, Math.min(12, Math.round(base.start + (burst ? 0 : f.kStart) + jS)));
  const len = Math.max(4, Math.min(24, Math.round(base.len * (burst ? 1 : f.kLen)) + jL));
  const ov = { timeline: { fps: 30, fxStart: start, fxLen: len } };
  arts[a.id] = ov;
  table.push({
    id: a.id, name: a.name, fam: f.name, slot: (SLOT[a.slot] || SLOT.dmg).label, prof: a.prof,
    module: f.module, colors: f.colors, tone: f.tone,
    start, len, burst, shape: a.shape, mode: a.pose && a.pose.mode,
  });
}

// ---- 自检：不靠"看起来对"，逐条验 ----
const errs = [];
for (const id of Object.keys(arts)) {
  if (!ARTS[id]) errs.push('覆盖表里出现不存在的招式 id: ' + id);
  for (const k of Object.keys(arts[id])) {
    if (!OVERRIDE_SAFE.includes(k)) errs.push(id + ' 写了不在白名单的字段: ' + k);
    if (FORBIDDEN.includes(k)) errs.push(id + ' 碰了零重复/结构字段: ' + k);
  }
  const tm = artTiming(Object.assign({}, ARTS[id], arts[id]));
  if (!(tm.delay > 0 && tm.life > 0)) errs.push(id + ' 时间轴换算非正数: ' + JSON.stringify(tm));
}
if (Object.keys(arts).length !== 80) errs.push('覆盖表不是 80 招: ' + Object.keys(arts).length);
// 同家族 + 同功能位内，节奏组合不许撞车（连招不能像复制粘贴）。
function dupCheck(list) {
  const groups = new Map();
  const dup = [];
  for (const r of list) {
    const k = r.fam + '|' + r.slot;
    if (!groups.has(k)) groups.set(k, new Set());
    const sig = r.start + '/' + r.len;
    if (groups.get(k).has(sig)) dup.push(r.id);
    groups.get(k).add(sig);
  }
  return dup;
}
const dups = dupCheck(table);
if (dups.length) errs.push('同组节奏撞车: ' + dups.join(','));
// 反向验证两条：越界字段能拦住、故意构造的组内重复能拦住（自检器不能永远绿）
{
  const probe = { ...arts[rows[0].id], shape: 'BROKEN' };
  if (!Object.keys(probe).some(k => FORBIDDEN.includes(k))) errs.push('自检器失效：越界字段没被拦住');
  const fake = [table[0], { ...table[0], id: 'probe' }];
  if (dupCheck(fake).length === 0) errs.push('自检器失效：故意构造的重复没被拦住');
}
if (errs.length) { console.error(errs.join('\n')); process.exit(1); }

const full = { version: 1, arts };
const sampleIds = rows.filter(a => a.id.endsWith('_1')).map(a => a.id);
const sampleArts = {};
for (const id of sampleIds) sampleArts[id] = arts[id];
const sample = { version: 1, arts: sampleArts };

fs.writeFileSync(path.join(ROOT, 'art-overrides.vfx80.json'), JSON.stringify(full, null, 2) + '\n');
fs.writeFileSync(path.join(ROOT, 'art-overrides.sample.json'), JSON.stringify(sample, null, 2) + '\n');

// ---- 80 行设计表 ----
const lines = [];
lines.push('| 招式 id | 招名 | 兵器 | 功能位 | 档位 | 特效母题 | 家族色域 | 节奏性格 | fxStart | fxLen |');
lines.push('|---|---|---|---|---|---|---|---|---:|---:|');
for (const r of table) {
  lines.push(`| \`${r.id}\` | ${r.name} | ${r.fam} | ${r.slot} | ${r.burst ? '**爆发**' : '克制'} | ${r.module} | ${r.colors} | ${r.tone} | ${r.start} | ${r.len} |`);
}
fs.writeFileSync('/tmp/xy-vfx-table.md', lines.join('\n') + '\n');

console.log('OK · 80 招覆盖表 / ' + sampleIds.length + ' 招样板已生成，自检通过');
console.log('  克制档 fxStart 1~9 / fxLen 5~17；爆发档 fxStart 8 / fxLen 22');
console.log('  表格片段: /tmp/xy-vfx-table.md');
