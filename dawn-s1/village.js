// village.js · 青云集（S3 批次 B）
// 一座 22×14 格的小集子：牌坊、围墙、一条石板街、四间铺子、一口井、一块告示牌。
//
// 为什么单开一个模块：
//   建筑是"大件"，用字符画手敲 112×78 的点阵不现实，也不一致。
//   这里全部改成程序化绘制（梯形瓦顶 + 木构墙 + 门窗构件），
//   四间铺子共用 `roof()` / `wallBox()` / `door()` / `signBoard()`，
//   只在装饰上分家（客栈挂幌、药铺晾药、铁匠铺敞着炉火、酒馆插酒旗），
//   这样一条街看过去是"同一批匠人盖的"，而不是四张不同风格的素材拼起来。

import { C } from './pixel.js';

const P = (g, x, y, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// 木色 / 瓦色：锁定板之外只补这几种土色，避免一条街跳出四五种木纹
const WD = { d: '#3E2A1C', m: '#6B4A32', l: '#8A6544' };
const TL = { d: '#1A2030', m: '#2A3140', l: '#46536B' };

// 村址（世界像素）。改这里就够了，地块、围墙、路面、碰撞全部由它推出来。
export const VILLAGE = {
  x0: 608, y0: 704, x1: 960, y1: 928,
  gateX: 784,        // 南口牌坊的位置
  gateHalf: 40,      // 南墙开口半宽
};

export function inVillage(x, y, pad) {
  const p = pad || 0;
  return x > VILLAGE.x0 - p && x < VILLAGE.x1 + p && y > VILLAGE.y0 - p && y < VILLAGE.y1 + p;
}

// ---------- 构件 ----------

// 瓦顶：上窄下宽的梯形 + 瓦楞 + 翘角 + 鸱吻
function roof(g, w, y, h, opt) {
  const o = opt || {};
  const inset = Math.max(4, Math.round(w * 0.09));
  const col = o.col || TL;
  g.save();
  g.beginPath();
  g.moveTo(inset, y); g.lineTo(w - inset, y);
  g.lineTo(w, y + h - 1); g.lineTo(0, y + h - 1);
  g.closePath();
  g.clip();
  P(g, 0, y, w, h, col.m);
  for (let x = 2; x < w; x += 6) P(g, x, y, 1, h, col.d);
  for (let yy = y + 5; yy < y + h - 1; yy += 5) P(g, 0, yy, w, 1, '#232A38');
  P(g, 0, y, w, 3, col.l);         // 正脊受光
  P(g, 0, y + 3, w, 1, col.d);
  g.restore();
  P(g, 0, y + h - 1, w, 2, '#12161F');               // 檐板
  P(g, 0, y + h - 4, 2, 3, '#12161F');               // 翘角
  P(g, w - 2, y + h - 4, 2, 3, '#12161F');
  P(g, inset - 3, y - 1, 4, 4, '#12161F');           // 鸱吻
  P(g, w - inset - 1, y - 1, 4, 4, '#12161F');
  P(g, inset - 2, y, 2, 1, C.gold2);
  P(g, w - inset, y, 2, 1, C.gold2);
}

// 墙体：白灰墙 + 墙基 + 角柱 + 上枋
function wallBox(g, x, y, w, h, opt) {
  const o = opt || {};
  P(g, x, y, w, h, o.base || C.paper3);
  P(g, x, y + h - 7, w, 7, o.baseD || C.paper1);
  // 墙面的斑驳：只两三笔，多了像脏
  P(g, x + 6, y + 8, 3, 1, '#D8CFB6');
  P(g, x + w - 14, y + 15, 4, 1, '#D8CFB6');
  P(g, x, y, 3, h, WD.d);
  P(g, x + w - 3, y, 3, h, WD.d);
  P(g, x, y, w, 3, WD.m);
  P(g, x, y + 3, w, 1, WD.d);
}

function windowBox(g, x, y, w, h) {
  P(g, x - 1, y - 1, w + 2, h + 2, WD.d);
  P(g, x, y, w, h, '#161B26');
  g.fillStyle = C.gold1;
  for (let i = 2; i < w; i += 3) g.fillRect(x + i, y, 1, h);
  for (let j = 2; j < h; j += 3) g.fillRect(x, y + j, w, 1);
  P(g, x, y, w, 1, C.gold2);
}

function doorBox(g, x, y, w, h) {
  P(g, x - 2, y - 3, w + 4, h + 3, WD.d);
  P(g, x, y, w, h, '#161B26');
  P(g, x + 2, y + 2, w - 4, h - 4, '#241A13');
  P(g, x + 2, y + 2, ((w - 4) / 2) | 0, h - 4, '#2C2018');
  g.fillStyle = C.gold2;
  g.fillRect(x + (w >> 1) - 3, y + ((h * 0.55) | 0), 2, 2);
  g.fillRect(x + (w >> 1) + 1, y + ((h * 0.55) | 0), 2, 2);
  P(g, x - 4, y + h, w + 8, 3, C.paper2);           // 门槛石
  P(g, x - 4, y + h + 2, w + 8, 1, C.paper1);
}

// 匾：不写汉字（4px 的字谁也读不出来），用三块金印的间距表达"这是块招牌"
function signBoard(g, cx, y, w) {
  P(g, cx - (w >> 1) - 1, y - 1, w + 2, 11, WD.d);
  P(g, cx - (w >> 1), y, w, 9, '#231A12');
  P(g, cx - (w >> 1) + 1, y + 1, w - 2, 1, C.gold1);
  P(g, cx - (w >> 1) + 1, y + 7, w - 2, 1, C.gold1);
  const gw = 5, gap = (w - gw * 3) / 4;
  for (let i = 0; i < 3; i++) {
    const gx = cx - (w >> 1) + gap * (i + 1) + gw * i;
    P(g, gx, y + 2, gw, 5, C.gold2);
    P(g, gx + 1, y + 3, gw - 2, 3, '#231A12');
  }
}

function lantern(g, x, y) {
  P(g, x, y - 2, 1, 2, WD.d);
  P(g, x - 2, y, 6, 1, C.ink1);
  P(g, x - 3, y + 1, 7, 6, C.red2);
  P(g, x - 1, y + 2, 3, 3, C.red3);
  P(g, x - 2, y + 7, 5, 1, C.ink1);
  P(g, x, y + 8, 1, 3, C.gold2);
}

// ---------- 四间铺子 ----------

function makeInn() {
  const w = 112, h = 78, c = cv(w, h), g = c.getContext('2d');
  P(g, 6, h - 4, w - 12, 4, 'rgba(0,0,0,0.20)');
  roof(g, w, 2, 24);
  wallBox(g, 4, 26, w - 8, 52);
  // 两层之间的腰枋
  P(g, 4, 43, w - 8, 2, WD.d, 1);
  P(g, 4, 43, w - 8, 1, WD.l);
  // 二层三窗
  for (const wx of [24, 50, 76]) windowBox(g, wx, 30, 12, 9);
  // 一层：匾 + 门 + 灯笼
  signBoard(g, 56, 46, 34);
  doorBox(g, 46, 58, 20, 20);
  lantern(g, 38, 49);
  lantern(g, 74, 49);
  // 招幌：右侧垂下来的布帘，"住店"的视觉信号
  P(g, 92, 24, 1, 30, WD.d);
  P(g, 88, 32, 9, 22, C.red1);
  P(g, 89, 33, 7, 20, C.red2);
  P(g, 91, 36, 3, 3, C.gold2);
  P(g, 91, 41, 3, 3, C.gold2);
  P(g, 91, 46, 3, 3, C.gold2);
  P(g, 88, 53, 9, 1, C.ink1);
  return c;
}

function makeHerb() {
  const w = 84, h = 68, c = cv(w, h), g = c.getContext('2d');
  P(g, 5, h - 4, w - 10, 4, 'rgba(0,0,0,0.20)');
  roof(g, w, 2, 22, { col: { d: '#16302E', m: '#1F4440', l: '#2F6E6A' } });
  wallBox(g, 4, 24, w - 8, 44);
  windowBox(g, 14, 32, 12, 9);
  windowBox(g, 58, 32, 12, 9);
  signBoard(g, 42, 30, 30);
  doorBox(g, 32, 48, 20, 18);
  // 檐下晾着的药草：三束，让"药铺"不用写字也认得出
  for (const [hx, hh] of [[9, 6], [18, 8], [66, 7], [74, 9]]) {
    P(g, hx + 2, 24, 1, 3, WD.d);
    P(g, hx, 27, 5, hh, C.jade1);
    P(g, hx + 1, 27, 3, hh - 1, C.jade2);
    P(g, hx + 2, 27 + hh - 1, 1, 1, C.gold2);
  }
  // 门口的捣药臼
  P(g, 56, 62, 6, 4, C.paper1);
  P(g, 57, 61, 4, 1, C.paper2);
  return c;
}

function makeSmith() {
  const w = 84, h = 64, c = cv(w, h), g = c.getContext('2d');
  P(g, 5, h - 4, w - 10, 4, 'rgba(0,0,0,0.22)');
  roof(g, w, 2, 20, { col: { d: '#231A18', m: '#3A2A26', l: '#5A4038' } });
  // 土坯墙：比白灰墙更黄更糙
  wallBox(g, 4, 22, w - 8, 42, { base: C.paper2, baseD: '#8A7A5E' });
  // 敞开的炉膛
  P(g, 26, 34, 32, 30, WD.d);
  P(g, 28, 36, 28, 28, '#120E0C');
  // 炉火：底部最亮，往上收暗
  P(g, 30, 54, 24, 10, '#7A2420');
  P(g, 32, 58, 20, 6, '#C8453B');
  P(g, 36, 60, 12, 4, C.gold2);
  P(g, 39, 62, 6, 2, C.gold3);
  // 铁砧
  P(g, 20, 58, 6, 4, C.ink2);
  P(g, 22, 56, 4, 2, C.ink3);
  P(g, 21, 62, 5, 2, C.ink1);
  // 挂在墙上的钳与锤
  P(g, 66, 30, 1, 8, WD.d);
  P(g, 65, 38, 4, 2, C.ink3);
  P(g, 72, 32, 2, 7, WD.d);
  P(g, 70, 39, 6, 3, C.ink3);
  // 屋顶飘一缕烟
  P(g, 58, 0, 3, 2, 'rgba(200,190,170,0.45)');
  P(g, 60, 3, 3, 2, 'rgba(200,190,170,0.28)');
  return c;
}

function makeTavern() {
  const w = 96, h = 70, c = cv(w, h), g = c.getContext('2d');
  P(g, 7, h - 4, w - 14, 4, 'rgba(0,0,0,0.20)');
  roof(g, w, 2, 22, { col: { d: '#2A1616', m: '#432020', l: '#6B3030' } });
  wallBox(g, 4, 24, w - 8, 46);
  windowBox(g, 14, 32, 11, 9);
  windowBox(g, 62, 32, 11, 9);
  signBoard(g, 44, 29, 30);
  doorBox(g, 34, 46, 20, 22);
  lantern(g, 26, 44);
  lantern(g, 63, 44);
  // 酒旗：竖幅，从檐下挂到近地
  P(g, 84, 24, 1, 40, WD.d);
  P(g, 82, 28, 7, 26, C.red1);
  P(g, 83, 29, 5, 24, C.red2);
  P(g, 84, 33, 3, 3, C.paper3);
  P(g, 84, 38, 3, 3, C.paper3);
  P(g, 84, 43, 3, 3, C.paper3);
  // 门口的酒坛
  for (const [jx, jy] of [[8, 62], [14, 63], [11, 58]]) {
    P(g, jx, jy, 6, 5, '#5C4A38');
    P(g, jx + 1, jy + 1, 4, 3, '#7A6350');
    P(g, jx + 1, jy - 1, 4, 1, C.paper1);
  }
  return c;
}

function makeWell() {
  const w = 26, h = 24, c = cv(w, h), g = c.getContext('2d');
  P(g, 2, h - 3, w - 4, 3, 'rgba(0,0,0,0.20)');
  // 井台
  P(g, 3, 14, 20, 7, C.paper1);
  P(g, 4, 13, 18, 5, C.paper2);
  P(g, 6, 15, 14, 3, '#1A2230');       // 井口
  P(g, 8, 16, 10, 1, '#28394F');       // 井水反光
  // 立柱 + 小顶
  P(g, 4, 4, 2, 10, WD.d);
  P(g, 20, 4, 2, 10, WD.d);
  P(g, 0, 2, 26, 3, TL.m);
  P(g, 0, 5, 26, 1, '#12161F');
  P(g, 2, 1, 22, 1, TL.l);
  P(g, 12, 5, 2, 4, WD.m);             // 辘轳绳
  return c;
}

function makePaifang() {
  const w = 76, h = 58, c = cv(w, h), g = c.getContext('2d');
  // 两根石柱
  P(g, 8, 12, 7, 46, C.paper1);
  P(g, 9, 12, 5, 46, C.paper2);
  P(g, 61, 12, 7, 46, C.paper1);
  P(g, 62, 12, 5, 46, C.paper2);
  P(g, 6, 56, 11, 2, C.ink3);
  P(g, 59, 56, 11, 2, C.ink3);
  // 额枋
  P(g, 4, 22, 68, 7, WD.d);
  P(g, 5, 23, 66, 4, WD.m);
  // 匾额
  P(g, 24, 20, 28, 12, C.ink1);
  P(g, 25, 21, 26, 10, '#231A12');
  P(g, 26, 22, 24, 1, C.gold1);
  for (let i = 0; i < 2; i++) {
    P(g, 31 + i * 12, 24, 7, 6, C.gold2);
    P(g, 33 + i * 12, 26, 3, 2, '#231A12');
  }
  // 雀替
  P(g, 15, 29, 4, 4, WD.l);
  P(g, 57, 29, 4, 4, WD.l);
  // 顶：小瓦顶
  roof(g, w, 6, 12);
  return c;
}

function makeWall() {
  const w = 16, h = 14, c = cv(w, h), g = c.getContext('2d');
  P(g, 0, 0, w, 2, TL.m);              // 瓦压顶
  P(g, 0, 2, w, 1, '#12161F');
  P(g, 0, 3, w, 8, C.paper2);          // 砖墙
  P(g, 0, 11, w, 3, C.paper1);         // 基座
  g.fillStyle = '#A99F86';
  g.fillRect(0, 6, w, 1);
  g.fillRect(7, 3, 1, 8);
  g.fillStyle = 'rgba(0,0,0,0.12)';
  g.fillRect(0, 12, w, 2);
  return c;
}

// 南北走向的墙：正交、无俯角的相机里画不出"侧面"，硬套正立墙会变成一截梯子。
// 改成一条 8px 的窄带：左边瓦顶受光、右边暗面，竖着接起来就是"墙在往远处走"。
function makeWallSide() {
  const w = 8, h = 16, c = cv(w, h), g = c.getContext('2d');
  P(g, 0, 0, w, h, C.paper2);
  P(g, 4, 0, 4, h, C.paper1);
  P(g, 0, 0, w, 1, TL.m);
  P(g, 0, 0, 1, h, '#12161F');
  P(g, 7, 0, 1, h, '#12161F');
  return c;
}

function makeNotice() {
  const w = 18, h = 22, c = cv(w, h), g = c.getContext('2d');
  P(g, 0, 20, w, 2, C.paper1);
  P(g, 1, 12, 2, 9, WD.d);
  P(g, 15, 12, 2, 9, WD.d);
  P(g, 0, 2, w, 11, WD.d);
  P(g, 1, 3, w - 2, 9, C.paper3);
  P(g, 2, 5, 4, 1, C.ink3);
  P(g, 2, 7, 9, 1, C.ink3);
  P(g, 2, 9, 6, 1, C.ink3);
  P(g, 11, 3, 1, 9, '#B6AB8F');
  return c;
}

function makeBarrel() {
  const w = 9, h = 11, c = cv(w, h), g = c.getContext('2d');
  P(g, 1, 1, 7, 9, '#5C4A38');
  P(g, 2, 2, 5, 7, '#7A6350');
  P(g, 1, 3, 7, 1, C.ink2);
  P(g, 1, 7, 7, 1, C.ink2);
  P(g, 2, 0, 5, 1, C.paper1);
  return c;
}

function makeWoodpile() {
  const w = 16, h = 10, c = cv(w, h), g = c.getContext('2d');
  for (let i = 0; i < 3; i++) {
    P(g, 1 + i * 5, 4, 5, 5, '#6B4A32');
    P(g, 2 + i * 5, 5, 3, 3, '#8A6544');
  }
  P(g, 1, 1, 5, 3, '#5C4A32');
  P(g, 6, 1, 5, 3, '#5C4A32');
  return c;
}

// ---------- 人 ----------
// 四间铺子的掌柜 + 街上七个人。玩家 16×18，这里画 14×19 —— 矮一点、圆一点，
// 站在一起就是"村民"而不是"另一个玩家"。
//
// 分人的办法不是加颜色，是剪影：先分头（发髻 / 斗笠 / 方巾 / 道冠 / 歪帽 / 光头巾），
// 再分手上的家伙（灯笼 / 柴捆 / 折扇 / 拂尘 / 酒葫芦 / 担子 / 拐杖）。
// 远看一团墨也能认出这是谁 —— 这比同一个人换七种衣服有用得多。
function makeNpc(o) {
  const w = 14, h = 19, c = cv(w, h), g = c.getContext('2d');
  const skin = o.skin || '#E3C49B';
  const robe = o.robe, robeL = o.robeL || robe, robeD = o.robeD || '#241C14';
  const hair = o.hair || '#241C18';
  const st = o.style || '';

  P(g, 2, h - 1, 10, 1, 'rgba(0,0,0,0.28)');   // 脚下影
  P(g, 4, 17, 2, 2, '#241C14');                // 鞋
  P(g, 8, 17, 2, 2, '#241C14');

  // 长袍下摆
  P(g, 3, 13, 8, 5, robe);
  P(g, 3, 13, 8, 1, robeL);
  P(g, 3, 17, 8, 1, robeD);
  // 上身
  P(g, 3, 8, 8, 6, robe);
  P(g, 3, 8, 8, 1, robeL);
  // 腰带
  P(g, 3, 11, 8, 1, o.belt || C.gold2);
  // 两臂
  P(g, 2, 8, 1, 5, robe);
  P(g, 11, 8, 1, 5, robe);
  P(g, 2, 12, 1, 1, skin);                     // 手
  P(g, 11, 12, 1, 1, skin);
  // 交领
  P(g, 6, 8, 2, 2, robeD);

  // 头
  P(g, 4, 2, 6, 6, skin);
  if (!o.hat) P(g, 4, 1, 6, 2, hair);          // 有帽子的不画发顶，省得从帽檐下漏出来
  P(g, 3, 2, 1, 4, hair);                      // 鬓
  P(g, 10, 2, 1, 4, hair);
  P(g, 5, 4, 1, 1, '#241C18');                 // 眼
  P(g, 8, 4, 1, 1, '#241C18');
  P(g, 6, 6, 2, 1, '#B5795C');                 // 口

  if (st === 'bun') {                          // 妇人发髻
    P(g, 6, 0, 3, 2, hair);
    P(g, 7, 0, 1, 1, C.gold2);
    P(g, 4, 3, 6, 1, hair);
    P(g, 4, 5, 1, 1, '#241C18'); P(g, 9, 5, 1, 1, '#241C18');
  } else if (st === 'elder') {                 // 白须老者
    P(g, 4, 1, 6, 1, '#CFC8B4');
    P(g, 4, 6, 6, 2, '#DFD8C6');
    P(g, 6, 8, 2, 1, '#DFD8C6');
    P(g, 3, 6, 1, 1, '#DFD8C6'); P(g, 10, 6, 1, 1, '#DFD8C6');
  } else if (st === 'smith') {                 // 头巾 + 赤膊
    P(g, 3, 0, 8, 2, '#8C3A2E');
    P(g, 3, 2, 8, 1, '#6B2A22');
    P(g, 4, 8, 6, 3, skin);                    // 露出的胸膛
    P(g, 4, 9, 6, 1, '#C9A87E');
    P(g, 4, 11, 6, 5, '#5B4630');              // 皮护裙
    P(g, 4, 12, 6, 1, '#6E563C');
    P(g, 5, 14, 4, 1, '#3C2E20');
  } else if (st === 'youth') {                 // 小伙：方巾、短打
    P(g, 3, 0, 8, 2, '#3E5B6B');
    P(g, 3, 2, 8, 1, '#2C4250');
    P(g, 4, 3, 6, 1, hair);
    P(g, 3, 13, 8, 3, robe);
    P(g, 4, 16, 2, 1, skin); P(g, 8, 16, 2, 1, skin);   // 露腿
  } else if (st === 'crone') {                 // 老妪：灰髻、披肩、拐杖
    P(g, 4, 1, 6, 2, '#B6B0A0');
    P(g, 6, 0, 3, 1, '#B6B0A0');
    P(g, 4, 3, 6, 1, '#B6B0A0');
    P(g, 4, 8, 6, 2, '#8A7A5E');               // 披肩
    P(g, 4, 7, 6, 1, '#9C8C6E');
    P(g, 12, 9, 1, 9, '#5C4A38');              // 拐杖
    P(g, 11, 8, 2, 1, '#5C4A38');
  } else if (st === 'watch') {                 // 更夫：斗笠、灯笼
    P(g, 0, 1, 14, 2, '#C9A85E');              // 竹笠宽檐
    P(g, 0, 3, 14, 1, '#8A6B2E');
    P(g, 4, 0, 6, 1, '#D8BC78');               // 笠顶
    P(g, 12, 12, 1, 2, '#241C14');             // 提梁
    P(g, 11, 13, 3, 4, C.red2);                // 灯笼
    P(g, 12, 14, 1, 2, C.gold2);
    P(g, 11, 17, 3, 1, C.ink1);
  } else if (st === 'wood') {                  // 樵夫：头巾、背上柴捆
    P(g, 3, 0, 8, 2, '#4A5B3E');
    P(g, 3, 2, 8, 1, '#33412B');
    P(g, 4, 3, 6, 1, hair);
    for (let i = 0; i < 3; i++) {              // 从肩后探出的柴枝
      P(g, 0, 7 + i * 2, 3, 1, i === 1 ? '#8A6544' : '#6B4A32');
    }
    P(g, 2, 6, 1, 8, '#3C2E20');                // 系柴的绳
  } else if (st === 'story') {                 // 说书人：方巾、折扇
    P(g, 3, 0, 8, 2, C.paper3);
    P(g, 3, 2, 8, 1, '#B6AB8F');
    P(g, 4, 3, 6, 1, hair);
    P(g, 11, 9, 3, 4, C.paper3);               // 摊开的扇面
    P(g, 12, 9, 1, 4, C.gold1);
    P(g, 11, 13, 3, 1, '#8A6520');             // 扇骨
    P(g, 11, 8, 1, 2, '#241C14');              // 手
  } else if (st === 'taoist') {                // 道士：道冠、拂尘
    P(g, 4, 0, 6, 2, '#3A4A5B');
    P(g, 6, 0, 2, 1, C.gold2);
    P(g, 3, 1, 8, 1, '#8A6520');               // 簪
    P(g, 1, 12, 1, 4, '#8A6520');              // 拂尘柄
    P(g, 0, 15, 3, 3, '#E8DFC8');              // 尘尾
    P(g, 1, 18, 1, 1, '#CFC8B4');
  } else if (st === 'drunk') {                 // 醉汉：歪帽、酒葫芦
    P(g, 4, 0, 7, 1, C.ink2);
    P(g, 3, 1, 9, 1, C.ink1);                  // 压得很低的帽檐
    P(g, 11, 13, 2, 3, '#C9A85E');             // 葫芦
    P(g, 12, 12, 1, 1, '#8A6B2E');
    P(g, 3, 11, 8, 1, '#6B4A32');              // 腰带松了
  } else if (st === 'pedlar') {                // 货郎：斗笠、挑担
    P(g, 0, 1, 14, 2, '#C9A85E');
    P(g, 0, 3, 14, 1, '#8A6B2E');
    P(g, 0, 9, 14, 1, '#6B4A32');              // 扁担
    P(g, 1, 10, 3, 4, '#5C4A38');              // 左筐
    P(g, 1, 10, 3, 1, '#7A6350');
    P(g, 10, 10, 3, 4, '#5C4A38');             // 右筐
    P(g, 10, 10, 3, 1, '#7A6350');
  }

  if (o.apron) {                               // 围裙
    P(g, 4, 12, 6, 6, o.apron);
    P(g, 4, 12, 6, 1, 'rgba(255,255,255,0.12)');
    P(g, 6, 10, 2, 2, o.apron);
  }
  return c;
}

// 小孩单独画：14×19 的骨架压不出"矮"，硬压只会变成寿星。
// 11×15、头占一半，站在同一条脚线上就自然矮一截。
function makeKid(o) {
  const w = 11, h = 15, c = cv(w, h), g = c.getContext('2d');
  const skin = '#E9CBA6', robe = o.robe, robeL = o.robeL || robe;
  P(g, 1, h - 1, 9, 1, 'rgba(0,0,0,0.28)');
  P(g, 3, 13, 2, 2, '#241C14');
  P(g, 6, 13, 2, 2, '#241C14');
  P(g, 2, 10, 7, 4, robe);
  P(g, 2, 10, 7, 1, robeL);
  P(g, 2, 13, 7, 1, '#2E2418');
  P(g, 3, 10, 1, 3, skin);                     // 手
  P(g, 7, 10, 1, 3, skin);
  P(g, 3, 4, 5, 6, skin);                      // 头
  P(g, 2, 4, 1, 4, '#241C18');                 // 鬓
  P(g, 8, 4, 1, 4, '#241C18');
  P(g, 4, 6, 1, 1, '#241C18');                 // 眼
  P(g, 6, 6, 1, 1, '#241C18');
  P(g, 5, 8, 1, 1, '#B5795C');
  P(g, 3, 2, 5, 2, '#241C18');                 // 双髻
  P(g, 3, 1, 2, 1, '#241C18');
  P(g, 6, 1, 2, 1, '#241C18');
  return c;
}

export function villageArt() {
  return {
    inn: makeInn(), herb: makeHerb(), smith: makeSmith(), tavern: makeTavern(),
    well: makeWell(), paifang: makePaifang(), wall: makeWall(), wallSide: makeWallSide(),
    notice: makeNotice(),
    barrel: makeBarrel(), woodpile: makeWoodpile(),
    npcLiu: makeNpc({ style: 'bun', robe: C.jade1, robeL: C.jade2, robeD: '#1B3A2E',
      hair: '#241C18', belt: C.gold2, apron: '#D9CBA8' }),
    npcSun: makeNpc({ style: 'elder', robe: '#7A6A4E', robeL: '#9C8A68', robeD: '#4A3E2C',
      hair: '#8E8578', belt: '#5C4A38' }),
    npcZhang: makeNpc({ style: 'smith', robe: '#4E4A44', robeL: '#66605A', robeD: '#2E2A26',
      hair: '#241C18', belt: '#2E2A26' }),
    npcQi: makeNpc({ style: 'youth', robe: '#8C5A3C', robeL: '#A8714E', robeD: '#5E3A26',
      hair: '#241C18', belt: '#D9CBA8' }),
    // 街面上七个人
    npcGeng: makeNpc({ style: 'watch', hat: true, robe: '#2E3A46', robeL: '#3E4C5A',
      robeD: '#1A2228', hair: '#3A3028', belt: '#8A3A30' }),
    npcHai: makeKid({ robe: '#B5563C', robeL: '#C96A4C' }),
    npcYu: makeNpc({ style: 'crone', robe: '#5A4636', robeL: '#6E5844', robeD: '#33281E',
      hair: '#B6B0A0', belt: '#7A6A4E' }),
    npcQiao: makeNpc({ style: 'wood', robe: '#4E5A3E', robeL: '#62704E', robeD: '#2E3626',
      hair: '#241C18', belt: '#6B4A32' }),
    npcShuo: makeNpc({ style: 'story', robe: '#3E4A5B', robeL: '#526074', robeD: '#26303C',
      hair: '#241C18', belt: C.paper3 }),
    npcDao: makeNpc({ style: 'taoist', robe: '#4A5B6B', robeL: '#5E7284', robeD: '#2A3642',
      hair: '#2A2620', belt: '#8A6520' }),
    npcZui: makeNpc({ style: 'drunk', robe: '#6B5A48', robeL: '#7E6C58', robeD: '#3E3428',
      hair: '#241C18', belt: '#8A6520' }),
    npcHuo: makeNpc({ style: 'pedlar', hat: true, robe: '#7A5A3C', robeL: '#8E6C4A',
      robeD: '#4A3626', hair: '#241C18', belt: '#5C4A38' }),
  };
}

// ---------- 布局 ----------
// (x, y) 是"脚线中点"，和树的锚点一致；y 用于和玩家排序。
export const BUILDINGS = [
  { id: 'inn', x: 712, y: 790 },
  { id: 'herb', x: 876, y: 786 },
  { id: 'smith', x: 668, y: 880 },
  { id: 'tavern', x: 876, y: 882 },
];
// 掌柜站位：都藏在门边一臂之外，既看得见人，又不挡住进出的道。
export const NPCS = [
  { id: 'inn', art: 'npcLiu', x: 730, y: 800, name: '柳三娘' },
  { id: 'herb', art: 'npcSun', x: 858, y: 796, name: '孙伯' },
  { id: 'smith', art: 'npcZhang', x: 694, y: 890, name: '张五' },
  { id: 'tavern', art: 'npcQi', x: 898, y: 892, name: '阿七' },
  { id: 'pedlar', art: 'npcHuo', x: 800, y: 888, name: '赵四' },
  // 云松：坐在街东的墙根下，褡裢摊在膝头。
  // 不放街心 —— 街心那块地要给玩家走，而且井沿、客栈门口都挤满了人。
  // 和午时才出现的玄阳子也不是一个人：那位在村里替人画符，这位是真正在路上走的。
  { id: 'daoshi', art: 'npcDao', x: 938, y: 804, name: '云松' },
];

// 街面上的人。作息用 phases 表示 —— 到点出现、到点消失。
// 这不是装饰：子时街上只剩更夫和醉汉，酉时酒馆门口挤着四个人，
// 玩家不用看表，看一眼街面就知道几点了。
export const VILLAGERS = [
  {
    id: 'geng', art: 'npcGeng', name: '老周', role: '更夫',
    x: 784, y: 906, phases: ['zi'], act: 'road', actLabel: '问路',
    greet: ['三更了，还不歇？', '这条街我走了四十年，闭着眼都不会撞墙。', '嗐，又是你。夜里的村子，就我们俩醒着。'],
    ask: '野地里的东西，子时最凶，卯时最蠢。要打，趁天亮前后去。',
  },
  {
    id: 'hai', art: 'npcHai', name: '阿宝', role: '村童',
    x: 756, y: 866, phases: ['mao', 'wu', 'you'], act: 'kid', actLabel: '逗他',
    greet: ['你那把刀，真能砍妖怪吗？', '我娘不让我出村，说出村会被叼走。', '我给你看我藏的石头——只有三块，不给你。'],
    ask: '井里有一次捞上来一把生锈的剑，村正说那是"有灵性的"，后来就不见了。',
  },
  {
    id: 'yu', art: 'npcYu', name: '崔婆婆', role: '村中老妪',
    x: 630, y: 830, phases: ['mao', 'wu'], act: 'give', actLabel: '送药',
    greet: ['灶上温着汤，你走这一趟，脸都白了。', '年轻人总以为自己不会死。', '坐会儿吧，不急这一时。'],
    ask: '往东那片坟地，白昼也有东西在游。别一个人去。',
  },
  {
    id: 'qiao', art: 'npcQiao', name: '石大', role: '樵夫',
    x: 648, y: 898, phases: ['you', 'zi'], act: 'road', actLabel: '问山',
    greet: ['柴越来越难砍了。', '后山的树，去年还是好好的。', '这条腿是去年被山魈啃的，你别学我。'],
    ask: '山里那窝山魈，就在西北坡上。它们怕火，不怕刀。',
  },
  {
    id: 'shuo', art: 'npcShuo', name: '柳先生', role: '说书人',
    x: 852, y: 900, phases: ['wu', 'you'], act: 'story', actLabel: '听一段',
    greet: ['坐下听一段？不收钱，收个脸熟。', '今日讲的是黑风寨，明日许就讲你。', '江湖上的人来来去去，只有故事留得住。'],
    ask: '你身上这股气，不像久居此地的人。外头的事，我知道一些。',
  },
  {
    id: 'dao', art: 'npcDao', name: '玄阳子', role: '游方道士',
    x: 768, y: 916, phases: ['wu'], act: 'charm', actLabel: '求符',
    greet: ['此地阴气自地底上来，子时莫在野外停留。', '道不远人，人自远道。', '你这面相，是要走远路的。'],
    ask: '阴物惧清心。带一包清心散，胜过带十把刀。',
  },
  {
    id: 'zui', art: 'npcZui', name: '王二', role: '醉汉',
    x: 926, y: 898, phases: ['you', 'zi'], act: 'drunk', actLabel: '搭话',
    greet: ['……嗝。', '别、别扶我，我自己能站。', '你也知道那口井底下……算了，不说了。'],
    ask: '我告诉你个秘密——那口井，通到地底下去。他们不信，你信不信？',
  },
  {
    // 药童站在济世堂门口，替孙伯看摊。他是第一个"小孩给你派活"的人 ——
    // 江湖里最容易被忽略的就是这种人，可他们提的要求往往最具体。
    id: 'w_herbboy', art: 'npcHai', name: '小满', role: '药童',
    x: 848, y: 828, phases: ['mao', 'wu', 'you'],
    greet: ['师父出诊去了，药我自己会抓。', '你要蛇胆吗？我攒了两枚，不够。', '别站门口，挡光。'],
    ask: '蛇胆要现取的才镇得住惊。你身上那股血腥味，是刚杀过吧？',
  },
];

export const PROPS = [
  // 井不摆在街心：石板街从牌坊直通客栈，正中间放口井等于在门口堵一块石头
  { id: 'well', x: 742, y: 852 },
  { id: 'paifang', x: VILLAGE.gateX, y: VILLAGE.y1 },
  { id: 'notice', x: 724, y: 920 },
  { id: 'barrel', x: 826, y: 852 },
  { id: 'barrel', x: 836, y: 858 },
  { id: 'barrel', x: 660, y: 806 },
  { id: 'woodpile', x: 646, y: 812 },
  { id: 'woodpile', x: 900, y: 830 },
];

// ---------- 铺子 ----------
// openWhen: 哪几个时辰营业。'always' = 通宵。
// 这条不是装饰 —— "天黑了店会关"是玩家第一次意识到世界有时间的方式。
export const SHOPS = {
  inn: {
    title: '云来客栈', keeper: '掌柜 · 柳三娘',
    x: 712, y: 806, r: 48,
    openWhen: 'always',
    line: '“客官，打尖还是住店？”',
    closed: '“夜深了，灶上还温着水。要住店么？”',
  },
  herb: {
    title: '济世堂', keeper: '郎中 · 孙伯',
    x: 876, y: 802, r: 46,
    openWhen: ['mao', 'wu', 'you'],
    line: '“伤在皮肉，痛在骨头。药要趁早敷。”',
    closed: '“入夜了，药柜上了锁。明日请早。”',
  },
  tavern: {
    title: '醉仙楼', keeper: '酒保 · 阿七',
    x: 876, y: 898, r: 46,
    openWhen: ['wu', 'you', 'zi'],
    line: '“一碗解乏，两碗壮胆。第三碗我可不管。”',
    closed: '“大清早的，酒还没温上。午后再来。”',
    deepNightClosed: true,
    closedDeep: '“三更了，都散了吧。明日晚些再来。”',
  },
  smith: {
    title: '张家铁铺', keeper: '铁匠 · 张五',
    x: 668, y: 896, r: 46,
    openWhen: ['mao', 'wu', 'you'],
    line: '“炉子还热着，兵器拿来。”',
    closed: '“炉熄了。夜里敲铁，招贼。”',
  },
  // 货郎没铺子，只有一副担子 —— 但交易流程和别家一样，所以照样挂在 SHOPS 里。
  // 午时在街东摆开，酉时收一半，子时收摊。
  pedlar: {
    title: '赵四的担子', keeper: '货郎 · 赵四',
    x: 800, y: 888, r: 40,
    openWhen: ['wu', 'you'],
    line: '“针头线脑，铜钱换命。看看？”',
    closed: '“担子收进客栈了，明儿赶早。”',
  },
  // 游方道人：不是坐商，是路过的人。他把褡裢摊在井沿上，
  // 卖的东西别处买不到 —— 十条辅心法全在他这儿。
  // 主心法**不卖**：构筑的核心得是打下来的，不是买来的。
  daoshi: {
    title: '墙根下的褡裢', keeper: '游方道人 · 云松',
    x: 938, y: 804, r: 42,
    openWhen: 'always',
    line: '“心法不在多，在合。你带三条，我这儿有十条可挑。”',
    closed: '“……”',
  },
};
