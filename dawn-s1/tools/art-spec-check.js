/* art-spec-table.html 的自检（Node 直跑，不经浏览器）：
 *   node tools/art-spec-check.js
 *
 * 验的是「规范表本身靠不靠得住」，不是游戏：
 *   ① 剩余 64 招不重不漏，跟 arts.js 对得上；
 *   ② 每招 10 个规格字段都填了，不许留空；
 *   ③ 数值（cd / cost / 倍率 / reach / arc / kb / 段数）与 arts.js 一致，不许我瞎写；
 *   ④ 空间语言 / 画面语言 / 与相邻招差异 三段文字 64 招两两不重复 —— 防「一推广就复制」；
 *   ⑤ 同族内平面不能全一样（一族 8 招全贴地 = 偷懒）；
 *   ⑥ 时长落在 3.0~5.0s；位移招必须真写了位移；无伤害招必须走 statusEvents。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'art-spec-table.html'), 'utf8');

const m = html.match(/const FAMS = (\[[\s\S]*?\n\]);\n\nconst SLOT/);
if (!m) { console.error('FATAL 找不到 FAMS 数据块'); process.exit(1); }
const FAMS = new Function('return (' + m[1] + ');')();

const C = [];
const ok = (b, msg) => C.push((b ? 'PASS ' : 'FAIL ') + msg);

const arts = [];
FAMS.forEach(f => f.arts.forEach(x => arts.push(Object.assign({ fam: f.id }, x))));

/* ① 不重不漏 */
const DONE = ['sword_1','dart_1','mage_8','fan_3',
  'blade_1','blade_2','blade_3','blade_4','blade_5','blade_6','blade_7','blade_8',
  'spear_1','spear_2','spear_3','spear_4'];
const ALL = ['sword','blade','spear','staff','hammer','dual','chain','dart','mage','fan']
  .reduce((a, fam) => a.concat(Array.from({ length: 8 }, (_, i) => fam + '_' + (i + 1))), []);
const SHOULD = ALL.filter(id => DONE.indexOf(id) < 0);
const got = arts.map(x => x.a);
const miss = SHOULD.filter(id => got.indexOf(id) < 0);
const extra = got.filter(id => SHOULD.indexOf(id) < 0);
const dup = got.filter((id, i) => got.indexOf(id) !== i);

ok(arts.length === 64 && miss.length === 0 && extra.length === 0 && dup.length === 0,
  '剩余 64 招不重不漏（应有 64，实有 ' + arts.length +
  (miss.length ? ' · 缺 ' + miss.join(',') : '') +
  (extra.length ? ' · 多 ' + extra.join(',') : '') +
  (dup.length ? ' · 重复 ' + dup.join(',') : '') + '）');

/* ② 字段齐全 */
const FIELDS = ['n','sp','g','mv','an','vs','lk','pl','gh','st','du','cd','c','mul','nums'];
let empty = [];
arts.forEach(x => FIELDS.forEach(k => {
  if (x[k] === undefined || x[k] === null || String(x[k]).trim() === '') empty.push(x.a + '.' + k);
}));
ok(empty.length === 0, '每招 ' + FIELDS.length + ' 个字段全部填了' +
  (empty.length ? '（空：' + empty.slice(0, 8).join(',') + '）' : '（共 ' + arts.length * FIELDS.length + ' 格）'));

/* ③ 数值与 arts.js 对得上 */
const src = fs.readFileSync(path.join(ROOT, 'arts.js'), 'utf8');
/* 必须按「招块」取值：之前用 split 取到的是该招之后 700 字，
 * buff 招没有 mul 字段时会串到下一招的 mul 上（sword_7 读成 1.9）。 */
function block(id) {
  const i = src.indexOf('\n  ' + id + ': {');
  if (i < 0) return '';
  const j = src.indexOf('\n  },', i);
  return src.slice(i, j < 0 ? i + 900 : j);
}
function pick(id, key) {
  const b = block(id);
  if (!b) return null;
  const mm = b.match(new RegExp('\\b' + key + ': *([-0-9.]+)'));
  return mm ? +mm[1] : null;
}
let bad = [];
arts.forEach(x => {
  const cd = pick(x.a, 'cd'), cost = pick(x.a, 'cost');
  if (cd === null) bad.push(x.a + ' 在 arts.js 里找不到 cd');
  else if (cd !== x.cd) bad.push(x.a + ' cd ' + x.cd + '≠' + cd);
  if (cost === null) bad.push(x.a + ' 在 arts.js 里找不到 cost');
  else if (Math.abs(cost - x.c) > 1e-9) bad.push(x.a + ' cost ' + x.c + '≠' + cost);
  /* 倍率只在写了「×N」时核对；buff 招写的是「无伤害 · power N」，不参与 */
  const mm = String(x.mul).match(/×([0-9.]+)/);
  if (mm) {
    const mul = pick(x.a, 'mul');
    if (mul === null) bad.push(x.a + ' 标了倍率但 arts.js 没有 mul');
    else if (Math.abs(parseFloat(mm[1]) - mul) > 1e-9) bad.push(x.a + ' mul ' + mm[1] + '≠' + mul);
  }
});
ok(bad.length === 0, 'CD / 真气 / 倍率与 arts.js 逐招一致' +
  (bad.length ? '（' + bad.slice(0, 6).join(' · ') + '）' : '（64 招全对）'));

/* ③-b 卡片上写的 reach / arc / kb 也不许瞎写 */
let numBad = [];
arts.forEach(x => {
  [['reach', /reach ([0-9.]+)/], ['arc', /arc ([0-9.]+)/], ['kb', /kb ([0-9.]+)/]]
    .forEach(([key, re]) => {
      const mm = String(x.nums).match(re);
      if (!mm) return;
      const v = pick(x.a, key);
      if (v === null) numBad.push(x.a + ' 标了 ' + key + ' 但 arts.js 没有这个字段');
      else if (Math.abs(parseFloat(mm[1]) - v) > 1e-9) numBad.push(x.a + ' ' + key + ' ' + mm[1] + '≠' + v);
    });
});
ok(numBad.length === 0, '卡片上的 reach / arc / kb 与 arts.js 一致' +
  (numBad.length ? '（' + numBad.slice(0, 6).join(' · ') + '）' : ''));

/* ④ 三段文字两两不重复 */
function uniq(key, label) {
  const seen = {}, d = [];
  arts.forEach(x => {
    const v = String(x[key]);
    if (seen[v]) d.push(x.a + '∩' + seen[v]); else seen[v] = x.a;
  });
  ok(d.length === 0, label + ' 64 招两两不重复' + (d.length ? '（' + d.slice(0, 4).join(' · ') + '）' : ''));
}
function uniqFilter(key, label, pred) {
  const seen = {}, d = [], list = arts.filter(pred);
  list.forEach(x => {
    const v = String(x[key]);
    if (seen[v]) d.push(x.a + '∩' + seen[v]); else seen[v] = x.a;
  });
  ok(d.length === 0, label + '（' + list.length + ' 招）两两不重复' +
    (d.length ? '（' + d.slice(0, 4).join(' · ') + '）' : ''));
}
uniq('sp', '空间语言');
uniq('lk', '画面语言');
uniq('vs', '与相邻招差异');
uniqFilter('an', '判定锚点', x => x.s !== 'buff');
uniqFilter('mv', '位移招的人物位移写法', x => x.s === 'move');

/* ⑤ 同族平面不全一样 */
const lazy = [];
FAMS.forEach(f => {
  const pls = new Set(f.arts.map(x => x.pl));
  if (pls.size < 3) lazy.push(f.id + ' 只有 ' + pls.size + ' 种平面');
});
ok(lazy.length === 0, '每族内部平面写法至少 3 种，不是一族一个平面套到底' +
  (lazy.length ? '（' + lazy.join(' · ') + '）' : ''));

/* ⑥ 时长 / 位移招 / 无伤害招 */
let durBad = [], mvBad = [], bufBad = [];
arts.forEach(x => {
  const s = parseFloat(x.du);
  if (!(s >= 3.0 && s <= 5.0)) durBad.push(x.a + ' ' + x.du);
  if (x.s === 'move' && !/(突进|侧移|后撤|位移|瞬移|冲锋|闪)/.test(x.mv)) mvBad.push(x.a);
  if (x.s === 'buff' && !/statusEvents/.test(x.an)) bufBad.push(x.a);
});
ok(durBad.length === 0, '演出时长全部落在 3.0~5.0s（用户口径）' +
  (durBad.length ? '（' + durBad.join(' · ') + '）' : ''));
ok(mvBad.length === 0, '位移招都真写了位移（不是「站定」）' +
  (mvBad.length ? '（' + mvBad.join(' · ') + '）' : ''));
ok(bufBad.length === 0, '增益招都走 statusEvents、不硬套 hitEvents' +
  (bufBad.length ? '（' + bufBad.join(' · ') + '）' : ''));

/* ⑦ 每族 8 招齐（本表只列未做的部分） */
const famLine = FAMS.map(f => f.id + ' ' + f.arts.length + '/' + (8 - f.done)).join(' · ');
ok(FAMS.every(f => f.arts.length === 8 - f.done), '每族列出的招数 = 8 − 已做数（' + famLine + '）');

console.log(C.join('\n'));
console.log('ok=' + (C.every(x => x.indexOf('PASS') === 0)));
process.exitCode = C.every(x => x.indexOf('PASS') === 0) ? 0 : 1;
