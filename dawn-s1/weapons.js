// weapons.js · 八种兵器的造型、招式与刀光表现
// 走位规则：角度 0 = 角色朝向，+π/2 = 屏幕向下（y 轴向下）
// 每种兵器有自己的「招式表」：挥砍弧度、速度、判定形状、刀光颜色、收招位移。
// mode: swing 弧斩 / thrust 直刺 / ring 抡圆 / cast 远程（proj 描述弹体，不做近战判定）。

import { C, spriteCanvas, outlined, rgba } from './pixel.js';
import { ART } from './art.js';

const WPAL = {
  w: C.white, W: C.paper3, s: C.jade3, S: C.jade2,
  g: C.gold1, G: C.gold2, h: C.ink2, k: C.ink3, K: C.ink1,
  r: C.red2, R: C.red3, p: C.pur3, P: C.pur2, b: C.paper1, e: C.ink1,
};

const shaft = (n) => Array(n).fill('...h...');

// ---------- 兵器点阵（竖直，刃在上，柄在下） ----------
const ROWS = {
  // 剑：细长双刃，玉色寒光（白刃 + 玉脊 两阶明暗，纯浅色在青绿地上会糊成一团）
  sword: [
    '...w...',
    '..wWS..',
    '..wWS..',
    '..wWS..',
    '..wWS..',
    '..wWS..',
    '..wWS..',
    '..wWS..',
    '..wWS..',
    '...W...',
    '..gGg..',
    '...h...',
    '...h...',
    '..gGg..',
  ],
  // 刀：厚背阔刃，刀尖上挑
  // 之前画成 7px 宽的通体奶白锥形，远看像羽毛/勺子；改成"亮刃左 / 暗刀背右"的短刃阔背，
  // 刃身最宽处放在中段，刃尖与护手两端收窄，轮廓才读得出是把刀。
  blade: [
    '....w..',
    '....wW.',
    '...wwWb',
    '...wWWb',
    '...wWWb',
    '...wWWb',
    '....wWb',
    '....wWb',
    '....wbb',
    '...gGg.',
    '....h..',
    '....h..',
    '...gGg.',
    '....h..',
  ],
  // 枪：短杆化，枪头束红缨（原先 30 行太长，拿在手里像根旗杆）
  spear: ['...w...', '..wWS..', '..wWS..', '...W...',
    '..rRr..', '..gGg..', ...shaft(11), '..gGg..', '...h...', '..gGg..'],
  // 棍：齐眉乌木棍，两端铜箍
  staff: ['..gGg..', '...h...', ...shaft(13), '...h...', '..gGg..', '...h...', '..gGg..'],
  // 双刃：短匕，成对使用
  dual: ['..w..', '..W..', '.sWs.', '.sWs.', '.sWs.', '..W..', '.gGg.', '..h..', '..h..', '.gGg.'],
  // 锤：鎏金重锤，短柄
  hammer: [
    '..kkkkk..',
    '.kKKKKKk.',
    'kKKGKGGKk',
    'kKGGGGGKk',
    '.kKKKKKk.',
    '..kkkkk..',
    '...ghg...',
    '...ghg...',
    '...ghg...',
    '..gGgGg..',
  ],
  // 法杖：短柄托灵珠，挥动时放气弹
  mage: [
    '...p...',
    '..pPp..',
    '.pPWPp.',
    '.pPWPp.',
    '..pPp..',
    '...p...',
    '..gGg..',
    '...h...',
    '...h...',
    '...h...',
    '...h...',
    '..gGg..',
    '...h...',
  ],
  // 暗器：四棱飞镖，掌心大小
  dart: [
    'w..w..w',
    '..wPw..',
    '.wwPww.',
    'wwPWPww',
    '.wwPww.',
    '..wPw..',
    'w..w..w',
  ],
};

// 每种兵器的定位：攻击倍率 / 攻击间隔 / 基础攻击距离 / 判定弧度 / 掉落权重
// 五系招式重设计（攻距与判定弧度整体收小，挥舞不再扫半个屏幕）：
//   刀 = 三式半圆（左右开阖 + 末段力劈）；剑 = 向前递剑两式 + 末段直刺；
//   枪 = 试探刺 → 横扫 → 贯甲刺；法杖 / 暗器 = 远程弹体，不做近战判定。
export const WEAPONS = {
  sword: {
    id: 'sword', name: '剑', kindLabel: '长剑', atkMul: 1.00, spdMul: 1.00, reach: 28, dropW: 18,
    trail: [C.jade3, C.jade2], fx: 'crescent', desc: '向前递剑两式，末段一记直刺',
    swings: [
      { mode: 'swing', a0: -0.72, a1: 0.72, dur: 0.18, mul: 0.95, kb: 5, lunge: 3, hitArc: 1.5, reach: 28 },
      { mode: 'swing', a0: 0.72, a1: -0.72, dur: 0.18, mul: 1.10, kb: 6, lunge: 4, hitArc: 1.5, reach: 29 },
      { mode: 'thrust', dur: 0.24, mul: 1.70, kb: 12, lunge: 10, reach: 36, hitArc: 0.9 },
    ],
  },
  blade: {
    id: 'blade', name: '刀', kindLabel: '长刀', atkMul: 1.16, spdMul: 1.18, reach: 30, dropW: 17,
    trail: [C.red3, C.red2], fx: 'crescent', desc: '三式皆半圆，左右开阖、末段力劈',
    swings: [
      { mode: 'swing', a0: -1.57, a1: 1.57, dur: 0.24, mul: 1.10, kb: 8, lunge: 3, hitArc: 3.14, reach: 30 },
      { mode: 'swing', a0: 1.57, a1: -1.57, dur: 0.24, mul: 1.22, kb: 10, lunge: 3, hitArc: 3.14, reach: 30 },
      { mode: 'swing', a0: -1.75, a1: 1.75, dur: 0.30, mul: 1.58, kb: 14, lunge: 4, hitArc: 3.5, reach: 32 },
    ],
  },
  spear: {
    id: 'spear', name: '枪', kindLabel: '长枪', atkMul: 1.08, spdMul: 0.94, reach: 40, dropW: 13,
    trail: [C.paper3, C.gold2], fx: 'thrust', desc: '一试探、二横扫、三贯甲',
    swings: [
      { mode: 'thrust', dur: 0.18, mul: 1.00, kb: 7, lunge: 7, reach: 38, hitArc: 0.8 },
      { mode: 'swing', a0: -1.0, a1: 1.0, dur: 0.22, mul: 1.18, kb: 9, lunge: 3, hitArc: 2.0, reach: 34 },
      { mode: 'thrust', dur: 0.28, mul: 1.85, kb: 15, lunge: 12, reach: 50, hitArc: 0.85 },
    ],
  },
  staff: {
    id: 'staff', name: '棍', kindLabel: '长棍', atkMul: 0.94, spdMul: 0.92, reach: 34, dropW: 11,
    trail: [C.gold3, C.gold2], fx: 'crescent', desc: '横扫千军，末段抡圆',
    swings: [
      { mode: 'swing', a0: -1.7, a1: 1.7, dur: 0.24, mul: 0.95, kb: 8, lunge: 2, hitArc: 3.8, reach: 34 },
      { mode: 'swing', a0: 1.7, a1: -1.7, dur: 0.24, mul: 1.05, kb: 9, lunge: 2, hitArc: 3.8, reach: 34 },
      { mode: 'ring', dur: 0.34, mul: 1.40, kb: 13, lunge: 0, hitArc: 6.28, reach: 32 },
    ],
  },
  dual: {
    id: 'dual', name: '双刃', kindLabel: '双刀', atkMul: 0.80, spdMul: 0.74, reach: 24, dropW: 10,
    trail: [C.pur3, C.pur2], fx: 'cross', desc: '左劈、右劈、双刀合击（每段两次判定）', hits: 2,
    // 双刀的动作靠"两只手"表达：主手走 a0→a1，副手在 game.js 里取镜像并滞后 dualDelay。
    //   一段左劈：主手右→左，副手左→右（错开 0.30，看得出先后）
    //   二段右劈：方向反过来
    //   三段合击：dualDelay 0 = 双手同时抡圆，两刀一起交叉收拢
    swings: [
      { mode: 'swing', a0: -1.15, a1: 0.95, dur: 0.17, mul: 0.62, kb: 4, lunge: 3, hitArc: 2.5, reach: 24, dualDelay: 0.30 },
      { mode: 'swing', a0: 1.15, a1: -0.95, dur: 0.17, mul: 0.66, kb: 4, lunge: 3, hitArc: 2.5, reach: 24, dualDelay: 0.30 },
      { mode: 'swing', a0: -1.55, a1: 1.55, dur: 0.24, mul: 1.00, kb: 8, lunge: 3, hitArc: 3.4, reach: 26, dualDelay: 0 },
    ],
  },
  hammer: {
    id: 'hammer', name: '锤', kindLabel: '重锤', atkMul: 1.42, spdMul: 1.30, reach: 29, dropW: 9,
    trail: [C.gold3, C.red2], fx: 'shock', desc: '开山一击，落点起冲击波',
    swings: [
      { mode: 'swing', a0: -1.85, a1: 1.25, dur: 0.36, mul: 1.45, kb: 15, lunge: 3, hitArc: 3.7, reach: 29 },
      { mode: 'swing', a0: 1.25, a1: -1.85, dur: 0.36, mul: 1.55, kb: 16, lunge: 3, hitArc: 3.7, reach: 29 },
      { mode: 'swing', a0: -0.55, a1: 1.35, dur: 0.42, mul: 2.10, kb: 22, lunge: 5, hitArc: 4.0, reach: 30, shock: true },
    ],
  },
  mage: {
    id: 'mage', name: '法杖', kindLabel: '灵杖', atkMul: 0.88, spdMul: 1.05, reach: 26, dropW: 12,
    ranged: true, trail: [C.pur3, C.pur2], fx: 'orb', desc: '一珠、二珠分袭、三珠连爆',
    swings: [
      { mode: 'cast', dur: 0.20, mul: 0.90, kb: 5, lunge: 0, hitArc: 0,
        proj: { kind: 'orb', count: 1, speed: 205, size: 9, life: 0.95, dmgMul: 1.00, pierce: 1 } },
      { mode: 'cast', dur: 0.22, mul: 0.82, kb: 5, lunge: 0, hitArc: 0,
        proj: { kind: 'orb', count: 2, spread: 0.34, speed: 215, size: 8, life: 0.95, dmgMul: 0.82, pierce: 1 } },
      { mode: 'cast', dur: 0.28, mul: 1.05, kb: 9, lunge: 0, hitArc: 0,
        proj: { kind: 'orb', count: 3, spread: 0.62, speed: 230, size: 11, life: 1.10, dmgMul: 0.90, pierce: 2 } },
    ],
  },
  dart: {
    id: 'dart', name: '暗器', kindLabel: '飞镖', atkMul: 0.62, spdMul: 0.80, reach: 24, dropW: 10,
    ranged: true, trail: [C.paper3, C.gold3], fx: 'dart', desc: '一镖、三镖扇射、五镖漫天',
    // 五镖齐发且每发独立结算命中，理论总伤是单手兵器的两倍多 —— 单发倍率压到比剑还低，
    // 射程也砍三成（life 0.55~0.60 × speed ≈ 160~180px，原来能飞 230~275px）。
    // 另外弹体现在撞墙即碎（game.js 的 projectiles 更新里加了 canStand 判定），
    // 以前能隔着墙磨 boss，这才是它"变态"的主因。
    swings: [
      { mode: 'cast', dur: 0.16, mul: 0.85, kb: 4, lunge: 0, hitArc: 0,
        proj: { kind: 'dart', count: 1, speed: 285, size: 7, life: 0.55, dmgMul: 0.90, pierce: 1 } },
      { mode: 'cast', dur: 0.18, mul: 0.72, kb: 4, lunge: 0, hitArc: 0,
        proj: { kind: 'dart', count: 3, spread: 0.46, speed: 290, size: 6, life: 0.55, dmgMul: 0.62, pierce: 1 } },
      { mode: 'cast', dur: 0.24, mul: 0.68, kb: 6, lunge: 0, hitArc: 0,
        proj: { kind: 'dart', count: 5, spread: 0.92, speed: 305, size: 6, life: 0.60, dmgMul: 0.52, pierce: 1 } },
    ],
  },
};

export const WEAPON_IDS = Object.keys(WEAPONS);

const baseCanvas = {};
for (const id of WEAPON_IDS) {
  const c = outlined(spriteCanvas(ROWS[id], WPAL));
  c._w = c.width - 2; c._h = c.height - 2;
  baseCanvas[id] = c;
}

// ---------- 稀有造型：同一类兵器也不该长一个样 ----------
// 品阶 2 起换剪影（护手镶珠、刃侧开锋、传世冠顶），再叠加 skin 决定的宝石配色。
// 所以「剑」这一族至少能读出 凡/精 → 灵 → 仙 → 传世 × 3 种宝石纹样，而不是只染个色。
const VARIANT_GEM = [
  { core: 'P', edge: 'p' },   // 紫晶
  { core: 'R', edge: 'r' },   // 赤玉
  { core: 'G', edge: 'g' },   // 鎏金
];
export function skinOf(seed) { return ((seed | 0) % VARIANT_GEM.length + VARIANT_GEM.length) % VARIANT_GEM.length; }

function variantRows(fam, r, skin) {
  const src = ROWS[fam] || ROWS.sword;
  if (r < 2) return src;
  const pad = 2, w = src[0].length + pad * 2;
  const rows = src.map(row => {
    const a = Array(w).fill('.');
    for (let i = 0; i < row.length; i++) a[i + pad] = row[i];
    return a;
  });
  const G = VARIANT_GEM[skinOf(skin)];
  const mid = w >> 1;
  // 护手镶珠
  const guard = rows.findIndex(a => a.indexOf('g') >= 0);
  if (guard >= 0) {
    for (let x = 0; x < w; x++) if (rows[guard][x] !== '.') rows[guard][x] = G.edge;
    rows[guard][mid] = G.core;
  }
  // 刃侧开锋：仙品起向外探出侧刃，传世再多半寸
  if (r >= 3) {
    const n = r >= 4 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const y = 1 + i;
      if (y >= rows.length) break;
      rows[y][pad - 1] = G.edge;
      rows[y][w - pad] = G.edge;
      rows[y][mid] = G.core;
    }
  }
  // 传世冠顶：多两行宝石尖冠，远远就能看出不是凡兵
  if (r >= 4) {
    const c0 = Array(w).fill('.'), c1 = Array(w).fill('.');
    c0[mid] = 'w';
    c1[mid - 1] = G.edge; c1[mid] = G.core; c1[mid + 1] = G.edge;
    rows.unshift(c0, c1);
  }
  return rows.map(a => a.join(''));
}

const canvasCache = new Map();
// rarityColor / r / skin 都由调用方给；不传就退回「凡品基础造型」，保持旧调用兼容。
export function weaponCanvas(fam, rarityColor, r, skin) {
  const ext = ART.weapons && ART.weapons[fam];
  if (ext) return ext;
  const tier = Math.max(0, Math.min(4, r | 0));
  const look = tier >= 2 ? skinOf(skin) : 0;
  const key = fam + '|' + (rarityColor || '') + '|' + tier + '|' + look;
  if (canvasCache.has(key)) return canvasCache.get(key);
  let c = baseCanvas[fam] || baseCanvas.sword;
  if (tier >= 2) c = outlined(spriteCanvas(variantRows(fam, tier, look), WPAL));
  if (rarityColor) {
    const o = document.createElement('canvas');
    o.width = c.width; o.height = c.height;
    const g = o.getContext('2d');
    g.drawImage(c, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = rarityColor;
    g.globalAlpha = 0.14 + tier * 0.03;
    g.fillRect(0, 0, o.width, o.height);
    // 刃口高光条：品阶越高越宽
    g.globalAlpha = 0.5;
    g.fillRect(Math.round(o.width / 2) - 1, 2, tier >= 3 ? 2 : 1, Math.round(o.height * 0.45));
    c = o;
  }
  canvasCache.set(key, c);
  return c;
}

// 行囊 / 装备栏图标：把兵器斜置 45° 装进 20×20
const iconCache = {};
export function weaponIcon(fam, r, skin, rarityColor) {
  const base = fam || 'sword';
  const tier = r | 0, look = skinOf(skin);
  const key = base + '@' + tier + '@' + look + '@' + (rarityColor || '') + '@' + ART.version;
  if (iconCache[key]) return iconCache[key];
  const src = weaponCanvas(base, rarityColor || null, tier, look);
  const c = document.createElement('canvas');
  c.width = 20; c.height = 20;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  const sc = Math.min(1, 17 / src.height);
  g.save();
  g.translate(10, 10);
  g.rotate(-Math.PI / 4);
  g.drawImage(src, -Math.round(src.width * sc) / 2, -Math.round(src.height * sc) + 3,
    Math.round(src.width * sc), Math.round(src.height * sc));
  g.restore();
  iconCache[key] = c;
  return c;
}

// ---------- 绘制：手中兵器 ----------
// 兵器整体缩到「掌中尺寸」：主角贴图才 16×18，原先 1:1 的兵器几乎和人一样高，
// 柄端又落在身体正中，看起来就像从身上长出来的。
export const HELD_SCALE = 0.56;
export const SWING_SCALE = 0.68;

// 把 canvas 以「柄端」为轴心旋转绘制
export function drawWeaponAt(ctx, cv, x, y, ang, alpha, scale) {
  const s = scale === undefined ? HELD_SCALE : scale;
  const w = cv.width * s;
  const h = cv.height * s;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.rotate(ang + Math.PI / 2);
  ctx.globalAlpha = alpha === undefined ? 1 : alpha;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(cv, -Math.round(w / 2), -Math.round(h - s), w, h);
  ctx.restore();
}

// 仙品 / 传世兵器：刃身周围的品阶辉光，传世再绕三粒游走的星点
export function drawRareAura(ctx, x, y, rad, color, alpha, t, tier) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const gr = ctx.createRadialGradient(x, y, 0, x, y, rad);
  gr.addColorStop(0, rgba(color, 0.40 * alpha));
  gr.addColorStop(0.55, rgba(color, 0.13 * alpha));
  gr.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = gr;
  ctx.beginPath(); ctx.arc(x, y, rad, 0, 6.28); ctx.fill();
  if (tier >= 4) {
    for (let i = 0; i < 3; i++) {
      const a = t * 2.6 + i * 2.09, rr = rad * 0.75;
      ctx.fillStyle = rgba(C.white, (0.5 + 0.4 * Math.sin(t * 5 + i)) * alpha);
      ctx.fillRect(Math.round(x + Math.cos(a) * rr), Math.round(y + Math.sin(a) * rr), 1, 1);
    }
  }
  ctx.restore();
}

// ---------- 绘制：刀光弧 ----------
// a0..a1 为屏幕角度；alpha 控制整体透明度；wMul 控制厚度倍率
// 关键：这不是"一整圈均匀的光"，而是"刃扫过去"——尾细淡、头粗亮。
// 做法：把弧切 14 段逐段描，每段的粗细与亮度沿进度 p 递增（pow(p,1.3)），
// 头部才点白芯。均匀描边会读成橡皮圈，是之前"看不见/像甜甜圈"的根源。
export function drawArcFx(ctx, x, y, a0, a1, R, colors, alpha, wMul) {
  if (!isFinite(a0) || !isFinite(a1)) return;
  const span = a1 - a0;
  if (Math.abs(span) < 0.02) return;
  const w = wMul || 1;
  const rev = span < 0;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'butt';

  // 扇面余韵：从圆心向外渐亮的径向渐变，读作"被劈开的空气"，而不是一块土斑
  const fan = ctx.createRadialGradient(0, 0, R * 0.55, 0, 0, R + 4 * w);
  fan.addColorStop(0, rgba(colors[1] || colors[0], 0));
  fan.addColorStop(0.6, rgba(colors[1] || colors[0], 0.03 * alpha));
  fan.addColorStop(1, rgba(colors[1] || colors[0], 0.085 * alpha));
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, R + 4 * w, a0, a1, rev);
  ctx.closePath();
  ctx.fillStyle = fan;
  ctx.fill();

  const N = 14;
  const over = rev ? -0.02 : 0.02; // 段间轻微重叠，避免圆弧接缝
  for (let i = 0; i < N; i++) {
    const t0 = i / N, t1 = (i + 1) / N;
    const k = Math.pow((t0 + t1) * 0.5, 1.3); // 0→1，重量压向头部
    const s0 = a0 + span * t0, s1 = a0 + span * t1 + over;
    // 外层柔光
    ctx.strokeStyle = rgba(colors[1] || colors[0], (0.06 + 0.38 * k) * alpha);
    ctx.lineWidth = (1.6 + 8.4 * k) * w;
    ctx.beginPath(); ctx.arc(0, 0, R, s0, s1, rev); ctx.stroke();
    // 主体
    ctx.strokeStyle = rgba(colors[0], (0.12 + 0.78 * k) * alpha);
    ctx.lineWidth = (1.0 + 4.4 * k) * w;
    ctx.beginPath(); ctx.arc(0, 0, R, s0, s1, rev); ctx.stroke();
    // 白芯只出现在后半段（刃口最亮处）
    if (k > 0.42) {
      ctx.strokeStyle = rgba(C.white, ((k - 0.42) / 0.58) * 0.92 * alpha);
      ctx.lineWidth = (0.7 + 1.9 * k) * w;
      ctx.beginPath(); ctx.arc(0, 0, R - 1, s0, s1, rev); ctx.stroke();
    }
  }
  // 内侧余韵：一条细淡弧，暗示刀势未尽
  ctx.strokeStyle = rgba(colors[0], 0.20 * alpha);
  ctx.lineWidth = 1.4 * w;
  ctx.beginPath(); ctx.arc(0, 0, R - 7 * w, a0 + span * 0.25, a1, rev); ctx.stroke();
  ctx.restore();
}

export function drawThrustFx(ctx, x, y, ang, len, colors, alpha, wMul) {
  const w = wMul || 1;
  const ex = Math.cos(ang), ey = Math.sin(ang);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(Math.round(x), Math.round(y));
  ctx.rotate(ang);
  // 枪出如龙：锥形气浪 + 白芯
  const grad = ctx.createLinearGradient(0, 0, len, 0);
  grad.addColorStop(0, rgba(colors[0], 0.10 * alpha));
  grad.addColorStop(0.65, rgba(colors[0], 0.55 * alpha));
  grad.addColorStop(1, rgba(C.white, 0.85 * alpha));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, -5 * w);
  ctx.lineTo(len * 0.72, -9 * w);
  ctx.lineTo(len, 0);
  ctx.lineTo(len * 0.72, 9 * w);
  ctx.lineTo(0, 5 * w);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = rgba(C.white, 0.9 * alpha);
  ctx.fillRect(2, -1.5 * w, len, 3 * w);
  ctx.strokeStyle = rgba(colors[0], 0.8 * alpha);
  ctx.lineWidth = 1.5 * w;
  ctx.beginPath(); ctx.moveTo(0, -5 * w); ctx.lineTo(len * 0.75, -10 * w); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, 5 * w); ctx.lineTo(len * 0.75, 10 * w); ctx.stroke();
  ctx.restore();
  // 枪尖爆点
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = rgba(C.white, 0.85 * alpha);
  ctx.beginPath();
  ctx.arc(Math.round(x + ex * len), Math.round(y + ey * len), 5 * w, 0, 6.28);
  ctx.fill();
  ctx.strokeStyle = rgba(colors[0], 0.7 * alpha);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(Math.round(x + ex * len), Math.round(y + ey * len), 9 * w, 0, 6.28);
  ctx.stroke();
  ctx.restore();
}

export function drawRingFx(ctx, x, y, R, colors, alpha, wMul) {
  const w = wMul || 1;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgba(colors[0], 0.55 * alpha);
  ctx.lineWidth = 6 * w;
  ctx.beginPath(); ctx.arc(Math.round(x), Math.round(y), R, 0, 6.28); ctx.stroke();
  ctx.strokeStyle = rgba(C.white, 0.7 * alpha);
  ctx.lineWidth = 2 * w;
  ctx.beginPath(); ctx.arc(Math.round(x), Math.round(y), R + 3, 0, 6.28); ctx.stroke();
  ctx.restore();
}

// 冲击波：地面裂纹式的扩散环（锤落地用）
export function drawShockFx(ctx, x, y, R, alpha) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgba(C.gold3, 0.55 * alpha);
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(Math.round(x), Math.round(y), R, 0, 6.28); ctx.stroke();
  ctx.strokeStyle = rgba(C.white, 0.35 * alpha);
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(Math.round(x), Math.round(y), R * 0.72, 0, 6.28); ctx.stroke();
  ctx.restore();
}

// 双刃的第二把（镜像绘制，角度错开）
export function drawOffhand(ctx, cv, x, y, ang, alpha, scale) {
  ctx.save();
  ctx.scale(1, 1);
  drawWeaponAt(ctx, cv, x, y, ang + 0.42, alpha * 0.95, scale);
  ctx.restore();
}
