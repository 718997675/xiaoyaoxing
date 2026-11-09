// weapons.js · 六种兵器的造型、挥砍动作与刀光表现
// 走位规则：角度 0 = 角色朝向，+π/2 = 屏幕向下（y 轴向下）
// 每种兵器有自己的「招式表」：挥砍弧度、速度、判定形状、刀光颜色、收招位移。

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
  // 枪：长杆，枪头束红缨
  spear: ['...w...', '..wWS..', '..wWS..', '..wWS..', '...W...',
    '..rRr..', '..gGg..', ...shaft(22), '..gGg..', '...h...', '...h...', '..gGg..'],
  // 棍：齐眉乌木棍，两端铜箍
  staff: ['..gGg..', '...h...', ...shaft(24), '...h...', '..gGg..', '...h...', '..gGg..'],
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
};

// 每种兵器的定位：攻击倍率 / 攻击间隔 / 基础攻击距离 / 判定弧度
export const WEAPONS = {
  sword: {
    id: 'sword', name: '剑', kindLabel: '长剑', atkMul: 1.00, spdMul: 1.00, reach: 32,
    trail: [C.jade3, C.jade2], fx: 'crescent', desc: '轻灵三段，第三段突刺',
    swings: [
      { mode: 'swing', a0: -1.35, a1: 1.15, dur: 0.20, mul: 0.95, kb: 5, lunge: 3, hitArc: 2.7 },
      { mode: 'swing', a0: 1.35, a1: -1.25, dur: 0.20, mul: 1.10, kb: 6, lunge: 4, hitArc: 2.7 },
      { mode: 'thrust', dur: 0.24, mul: 1.70, kb: 12, lunge: 11, reach: 40, hitArc: 1.1 },
    ],
  },
  blade: {
    id: 'blade', name: '刀', kindLabel: '长刀', atkMul: 1.16, spdMul: 1.18, reach: 34,
    trail: [C.red3, C.red2], fx: 'crescent', desc: '大开大合，末段回旋斩',
    swings: [
      { mode: 'swing', a0: -1.95, a1: 1.55, dur: 0.28, mul: 1.15, kb: 9, lunge: 4, hitArc: 3.3 },
      { mode: 'swing', a0: 1.75, a1: -1.95, dur: 0.28, mul: 1.28, kb: 10, lunge: 4, hitArc: 3.3 },
      { mode: 'swing', a0: -2.9, a1: 2.1, dur: 0.34, mul: 1.60, kb: 15, lunge: 3, hitArc: 5.0 },
    ],
  },
  spear: {
    id: 'spear', name: '枪', kindLabel: '长枪', atkMul: 1.08, spdMul: 0.94, reach: 46,
    trail: [C.paper3, C.gold2], fx: 'thrust', desc: '远距直刺，第三段横扫',
    swings: [
      { mode: 'thrust', dur: 0.22, mul: 1.05, kb: 8, lunge: 9, reach: 46, hitArc: 0.9 },
      { mode: 'thrust', dur: 0.22, mul: 1.15, kb: 9, lunge: 10, reach: 48, hitArc: 0.9 },
      { mode: 'swing', a0: -2.3, a1: 2.3, dur: 0.30, mul: 1.55, kb: 14, lunge: 3, hitArc: 4.6, reach: 44 },
    ],
  },
  staff: {
    id: 'staff', name: '棍', kindLabel: '长棍', atkMul: 0.94, spdMul: 0.92, reach: 38,
    trail: [C.gold3, C.gold2], fx: 'crescent', desc: '横扫千军，末段抡圆',
    swings: [
      { mode: 'swing', a0: -1.85, a1: 1.85, dur: 0.24, mul: 0.95, kb: 8, lunge: 2, hitArc: 3.8 },
      { mode: 'swing', a0: 1.85, a1: -1.85, dur: 0.24, mul: 1.05, kb: 9, lunge: 2, hitArc: 3.8 },
      { mode: 'ring', dur: 0.34, mul: 1.40, kb: 13, lunge: 0, hitArc: 6.28, reach: 36 },
    ],
  },
  dual: {
    id: 'dual', name: '双刃', kindLabel: '双刀', atkMul: 0.80, spdMul: 0.74, reach: 26,
    trail: [C.pur3, C.pur2], fx: 'cross', desc: '双刀合击，每段两次判定', hits: 2,
    swings: [
      { mode: 'swing', a0: -1.15, a1: 1.25, dur: 0.16, mul: 0.62, kb: 4, lunge: 4, hitArc: 2.5 },
      { mode: 'swing', a0: 1.25, a1: -1.15, dur: 0.16, mul: 0.66, kb: 4, lunge: 4, hitArc: 2.5 },
      { mode: 'swing', a0: -1.7, a1: 1.7, dur: 0.22, mul: 1.00, kb: 8, lunge: 3, hitArc: 3.4 },
    ],
  },
  hammer: {
    id: 'hammer', name: '锤', kindLabel: '重锤', atkMul: 1.42, spdMul: 1.30, reach: 32,
    trail: [C.gold3, C.red2], fx: 'shock', desc: '开山一击，落点起冲击波',
    swings: [
      { mode: 'swing', a0: -2.25, a1: 1.45, dur: 0.36, mul: 1.45, kb: 15, lunge: 3, hitArc: 4.1 },
      { mode: 'swing', a0: 1.45, a1: -2.25, dur: 0.36, mul: 1.55, kb: 16, lunge: 3, hitArc: 4.1 },
      { mode: 'swing', a0: -0.55, a1: 1.45, dur: 0.42, mul: 2.10, kb: 22, lunge: 5, hitArc: 4.6, shock: true },
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

// 稀有度光晕：把柄头染成装备品阶色
const canvasCache = new Map();
export function weaponCanvas(fam, rarityColor) {
  const ext = ART.weapons && ART.weapons[fam];
  if (ext) return ext;
  const key = fam + '|' + (rarityColor || '');
  if (canvasCache.has(key)) return canvasCache.get(key);
  let c = baseCanvas[fam];
  if (!c) c = baseCanvas.sword;
  if (rarityColor) {
    const o = document.createElement('canvas');
    o.width = c.width; o.height = c.height;
    const g = o.getContext('2d');
    g.drawImage(c, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = rarityColor;
    g.globalAlpha = 0.16;
    g.fillRect(0, 0, o.width, o.height);
    // 刃口高光条
    g.globalAlpha = 0.5;
    g.fillRect(Math.round(o.width / 2) - 1, 2, 1, Math.round(o.height * 0.45));
    c = o;
  }
  canvasCache.set(key, c);
  return c;
}

// 行囊 / 装备栏图标：把兵器斜置 45° 装进 20×20
const iconCache = {};
export function weaponIcon(fam) {
  const base = fam || 'sword';
  const key = base + '@' + ART.version;
  if (iconCache[key]) return iconCache[key];
  const src = weaponCanvas(base, null);
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
// 把 canvas 以「柄端」为轴心旋转绘制
export function drawWeaponAt(ctx, cv, x, y, ang, alpha, scale) {
  const s = scale || 1;
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
