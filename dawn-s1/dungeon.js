// dungeon.js · 青云古洞
// ------------------------------------------------------------------
// 一块挖在世界地图西南角的山体空腔。
//
// 为什么不做"独立场景"：
//   换场景要备份 tiles / solid / 整张地面 canvas，还要把树、石头、房屋的 mesh
//   全部藏掉再放回来 —— 代价远大于收益，而且以后每加一个场景都要再写一遍。
//   地宫直接占用世界地图上的一块矩形（格 4..34 × 39..67），把这块地的 tiles
//   重写一遍就行：相机、碰撞、小地图、光照、掉落全部复用，一行都不用改。
//
//   玩家在洞里之所以看不到"外面被重排"，是因为洞里是黑的：可视半径 96px，
//   连隔壁房间都照不到。这不是取巧，是地宫本来就该有的观感。
// ------------------------------------------------------------------

import { C } from './pixel.js';

export const DT = 16;   // 与世界 TILE 一致

export const DG = {
  tx0: 4, ty0: 39, tw: 30, th: 28,
  x0: 4 * 16, y0: 39 * 16,
  x1: 34 * 16, y1: 67 * 16,
};

export const DGT = { FLOOR: 6, WALL: 7, DOOR: 8 };

export const DG_FLOORS = 3;   // 三层深入地脉

export function inDungeon(x, y, pad) {
  const p = pad || 0;
  return x > DG.x0 - p && x < DG.x1 + p && y > DG.y0 - p && y < DG.y1 + p;
}

function mulberry32(a) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ============ 一层 ============
// 房间乱放 + 最近邻连线。不追求"完美地牢"，要的是每次进去都不一样，
// 但一定连通 —— 玩家不该因为随机而卡死。
export function genFloor(seed, floor) {
  const W = DG.tw, H = DG.th;
  const rnd = mulberry32((seed >>> 0) || 1);
  const t = new Uint8Array(W * H).fill(DGT.WALL);
  const idx = (x, y) => y * W + x;
  const rooms = [];

  // 入口房固定在底边居中：玩家从洞口进来，第一眼必须是"一间屋"，
  // 而不是一条不知通向哪的走廊。
  const entW = 8, entH = 6;
  const entX = ((W - entW) / 2) | 0;
  const entY = H - entH - 1;
  rooms.push({ x: entX, y: entY, w: entW, h: entH, entry: true });

  const want = 7 + floor;   // 8 / 9 / 10 间
  // 房间间距逐级放宽：先用 2 格缝铺出层次，铺不满就退到 1 格、再退到 0 格，
  // 保证每层的房间数达标 —— 之前固定 900 次尝试铺不满就收工，
  // 有些种子只长出 6 间房，层与层的大小飘忽不定。
  for (let gap = 2; gap >= 0 && rooms.length < want; gap--) {
    for (let tries = 0; tries < 900 && rooms.length < want; tries++) {
      const w = 5 + ((rnd() * 4) | 0);
      const h = 4 + ((rnd() * 3) | 0);
      // 从 2 开始：最外两圈必须留成实心岩。只留一圈的话，玩家贴着墙站时
      // 视野会越过 16px 的岩层直接看到洞外的草地 —— 那一抹青绿会毁掉"在洞底"。
      const x = 2 + ((rnd() * Math.max(1, W - w - 4)) | 0);
      const y = 2 + ((rnd() * Math.max(1, H - h - 4)) | 0);
      // 留 2 格缝：房间贴在一起会变成一大片空地，失去"洞窟"的层次
      if (rooms.some(r => x < r.x + r.w + gap && x + w + gap > r.x && y < r.y + r.h + gap && y + h + gap > r.y)) continue;
      rooms.push({ x, y, w, h });
    }
  }

  for (const r of rooms) {
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) t[idx(x, y)] = DGT.FLOOR;
    }
  }

  const ctr = r => ({ x: (r.x + r.w / 2) | 0, y: (r.y + r.h / 2) | 0 });
  // 走廊铺 2 格宽：1 格在 16px 的格子里等于让玩家贴着墙蹭，
  // 战斗时一个后撤步就卡进死角。
  const hCorr = (x0, x1, y) => {
    const a = Math.min(x0, x1), b = Math.max(x0, x1);
    for (let x = a; x <= b; x++) {
      t[idx(x, y)] = DGT.FLOOR;
      if (y + 1 < H) t[idx(x, y + 1)] = DGT.FLOOR;
    }
  };
  const vCorr = (y0, y1, x) => {
    const a = Math.min(y0, y1), b = Math.max(y0, y1);
    for (let y = a; y <= b; y++) {
      t[idx(x, y)] = DGT.FLOOR;
      if (x + 1 < W) t[idx(x + 1, y)] = DGT.FLOOR;
    }
  };

  const used = [0];
  const rest = rooms.map((_, i) => i).slice(1);
  while (rest.length) {
    let bd = 1e9, bi = 0, bf = 0;
    for (const u of used) {
      const a = ctr(rooms[u]);
      for (let j = 0; j < rest.length; j++) {
        const b = ctr(rooms[rest[j]]);
        const d = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
        if (d < bd) { bd = d; bi = j; bf = u; }
      }
    }
    const a = ctr(rooms[bf]), b = ctr(rooms[rest[bi]]);
    if (rnd() < 0.5) { hCorr(a.x, b.x, a.y); vCorr(a.y, b.y, b.x); }
    else { vCorr(a.y, b.y, a.x); hCorr(a.x, b.x, b.y); }
    used.push(rest[bi]);
    rest.splice(bi, 1);
  }

  // 洞口：入口房底边中央开两格，接到区域外。
  // 只有第 1 层开 —— 第 2、3 层是"重排后的同一块地"，洞口要是还开着，
  // 玩家能一路从地脉深处走回野外，那三层就白做了。
  const doorX = entX + ((entW / 2) | 0) - 1;
  if (floor <= 1) {
    for (let y = entY; y < H; y++) {
      t[idx(doorX, y)] = DGT.DOOR;
      t[idx(doorX + 1, y)] = DGT.DOOR;
    }
  }

  // 最深处 = 离入口最远的房间，放地脉裂口（或 Boss）
  const e = ctr(rooms[0]);
  let deep = 1, dd = -1;
  for (let i = 1; i < rooms.length; i++) {
    const c = ctr(rooms[i]);
    const d = Math.hypot(c.x - e.x, c.y - e.y);
    if (d > dd) { dd = d; deep = i; }
  }

  return {
    seed, floor, t, W, H, rooms, entry: rooms[0], deepRoom: rooms[deep],
    // 一律输出**世界坐标**。上层拿到就能直接用 —— 让调用方自己加偏移，
    // 迟早会有某一处忘掉（第一版就是把裂口画到了地图左上角的野地里）。
    doorX: DG.x0 + (doorX + 0.5) * DT,
    doorY: DG.y0 + (H - 0.5) * DT,
    deepC: {
      x: DG.x0 + (ctr(rooms[deep]).x + 0.5) * DT,
      y: DG.y0 + (ctr(rooms[deep]).y + 0.5) * DT,
    },
  };
}

// ============ 画到地面 canvas ============
// 只画这一块。整张 groundC 别处不动 —— 所以小地图、光照、碰撞全都自动对上。
export function paintDungeon(ctx, data) {
  const T = DT, OX = DG.x0, OY = DG.y0;
  const W = data.W, H = data.H;
  const rnd = mulberry32((data.seed ^ 0x5bd1e995) >>> 0 || 7);
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? DGT.WALL : data.t[y * W + x];

  // 整块先铺实心岩
  ctx.fillStyle = '#0E0F14';
  ctx.fillRect(OX, OY, W * T, H * T);

  // —— 地面 ——
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = at(x, y);
      if (v === DGT.WALL) continue;
      const bx = OX + x * T, by = OY + y * T;
      const door = v === DGT.DOOR && y >= H - 2;
      // 洞口那一块用偏暖的深石色，不用黄土 —— 一块方正黄泥铺在石板中间，
      // 读起来像进门处放了块地毯。
      ctx.fillStyle = door ? '#3E3A32' : '#383844';
      ctx.fillRect(bx, by, T, T);
      // 碎石：三层色阶，越多越像"被踩碎的石地"
      const n = 6 + ((rnd() * 5) | 0);
      for (let k = 0; k < n; k++) {
        const px = bx + ((rnd() * 15) | 0), py = by + ((rnd() * 15) | 0);
        const q = rnd();
        ctx.fillStyle = q < 0.34 ? '#464654' : q < 0.7 ? '#2E2E38' : '#53525F';
        ctx.fillRect(px, py, q < 0.2 ? 2 : 1, 1);
      }
      // 靠墙一圈暗：光到不了的地方。没有这圈，地板会像一块发光的塑料
      if (at(x, y - 1) === DGT.WALL) { ctx.fillStyle = 'rgba(8,9,13,0.55)'; ctx.fillRect(bx, by, T, 3); }
      if (at(x - 1, y) === DGT.WALL) { ctx.fillStyle = 'rgba(8,9,13,0.38)'; ctx.fillRect(bx, by, 2, T); }
      if (at(x + 1, y) === DGT.WALL) { ctx.fillStyle = 'rgba(8,9,13,0.38)'; ctx.fillRect(bx + T - 2, by, 2, T); }
      // 南面也要收一圈暗：四面都收，地才像"凹下去的坑"，而不是一块浮在暗处的板
      if (at(x, y + 1) === DGT.WALL) { ctx.fillStyle = 'rgba(8,9,13,0.42)'; ctx.fillRect(bx, by + T - 3, T, 3); }
      // 墙根苔藓：地下也长东西，只是颜色发青
      if (at(x, y - 1) === DGT.WALL && rnd() < 0.42) {
        ctx.fillStyle = '#2C4438';
        for (let k = 0; k < 3; k++) ctx.fillRect(bx + ((rnd() * 14) | 0), by + 2 + ((rnd() * 3) | 0), 2, 1);
      }
      // 偶尔一摊积水：洞里唯一会反光的东西
      if (!door && rnd() < 0.07) {
        const px = bx + 3 + ((rnd() * 7) | 0), py = by + 4 + ((rnd() * 7) | 0);
        ctx.fillStyle = '#1E3440'; ctx.fillRect(px, py, 5, 3);
        ctx.fillStyle = '#2E4C58'; ctx.fillRect(px + 1, py, 3, 1);
      }
    }
  }

  // —— 岩壁立面 ——
  // 正交俯视看不出"高度"，唯一能表达"这是墙"的办法：朝南那一面画一道亮起来的立面。
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (at(x, y) !== DGT.WALL) continue;
      const bx = OX + x * T, by = OY + y * T;
      // 墙身不能全黑：只剩墙脚一条亮边时，读起来像悬空的横梁
      ctx.fillStyle = '#1E1F29';
      ctx.fillRect(bx, by, T, T);
      // 岩石纹：斜向的劈裂
      if (rnd() < 0.5) {
        ctx.fillStyle = '#1C1D26';
        ctx.fillRect(bx + 2 + ((rnd() * 9) | 0), by + 2 + ((rnd() * 10) | 0), 5, 1);
      }
      if (at(x, y + 1) !== DGT.WALL) {
        // 朝向玩家的立面：上暗下亮，底部 1px 高光收边
        ctx.fillStyle = '#2E2F3C'; ctx.fillRect(bx, by + T - 8, T, 8);
        ctx.fillStyle = '#3C3D4C'; ctx.fillRect(bx, by + T - 5, T, 5);
        ctx.fillStyle = '#4E4F62'; ctx.fillRect(bx, by + T - 1, T, 1);
        // 立面下沿的影，把墙和地板"焊"在一起
        ctx.fillStyle = 'rgba(6,7,10,0.5)'; ctx.fillRect(bx, by + T, T, 2);
      }
    }
  }

  // 山体影：区域**之外**上、左、右三面压一圈黑。洞里往外看是山岩，不是草地。
  // 洞口那一面（下）不压 —— 那是玩家走进来的路，压黑了会像"洞口被封了"。
  const B = 60;
  const fade = (x, y, w, h, x0, y0, x1, y1) => {
    const gr = ctx.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, 'rgba(8,9,13,0)');
    gr.addColorStop(1, 'rgba(8,9,13,0.93)');
    ctx.fillStyle = gr;
    ctx.fillRect(x, y, w, h);
  };
  fade(OX - B, OY - B, W * T + B * 2, B, OX, OY - B, OX, OY);          // 上
  fade(OX - B, OY, B, H * T, OX - B, OY, OX, OY);                      // 左
  fade(OX + W * T, OY, B, H * T, OX + W * T, OY, OX + W * T + B, OY);  // 右
  return data;
}

// ============ 洞里的家伙什 ============
function cv(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function makeChest() {
  const c = cv(26, 20), g = c.getContext('2d');
  const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  R(2, 9, 22, 10, '#503822');            // 箱体
  R(2, 9, 22, 1, '#6E4C2E');
  R(2, 17, 22, 2, '#33220F');
  R(2, 4, 22, 6, '#6B4A2A');             // 盖
  R(2, 4, 22, 1, '#8A6440');
  R(2, 9, 22, 1, '#2A1A0C');
  R(2, 4, 3, 15, '#B8912F');             // 包角
  R(21, 4, 3, 15, '#B8912F');
  R(2, 4, 3, 1, '#EFD07A'); R(21, 4, 3, 1, '#EFD07A');
  R(4, 12, 18, 1, '#8A6520');            // 箍
  R(11, 9, 4, 5, '#E8C86E');             // 锁
  R(12, 11, 2, 2, '#3A2818');
  R(1, 3, 24, 1, '#14161D');             // 上沿一道黑，压住箱子
  return c;
}

function makeBrazier() {
  const c = cv(14, 18), g = c.getContext('2d');
  const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  R(3, 14, 2, 4, '#2B2C36'); R(10, 14, 2, 4, '#2B2C36'); R(6, 15, 2, 3, '#2B2C36');
  R(2, 8, 10, 7, '#4A4B58');             // 盆
  R(2, 8, 10, 1, '#6B6C7A');
  R(2, 14, 10, 1, '#2A2B35');
  R(4, 10, 6, 3, '#7A3A20');             // 盆里的炭
  R(5, 5, 4, 5, '#C8453B');              // 火
  R(6, 2, 2, 4, '#E8806F');
  R(6, 4, 2, 4, '#F2D089');
  R(7, 1, 1, 2, '#F2D089');
  return c;
}

// 地脉裂口：向下走的入口。石板台阶 + 缝里透出来的紫光。
function makeRift() {
  const c = cv(40, 30), g = c.getContext('2d');
  const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  // 石砌围边：先有一圈"人工凿出来的框"，才像入口而不是地上的一条缝
  R(0, 2, 40, 27, '#464158');
  R(0, 2, 40, 2, '#5C5674');
  R(2, 4, 36, 24, '#12101A');
  // 三级台阶，越往下越暗。每级上沿留一道亮线 —— 这是俯视图里唯一能表达
  // "往下走" 的办法：靠亮度顺序，不靠透视。
  R(5, 6, 30, 6, '#4A4560');
  R(5, 6, 30, 2, '#615B7A');
  R(5, 11, 30, 1, '#2A2638');
  R(7, 12, 26, 6, '#38334A');
  R(7, 12, 26, 2, '#4C4762');
  R(7, 17, 26, 1, '#211E2E');
  R(9, 18, 22, 6, '#221F30');
  R(9, 18, 22, 2, '#342F46');
  // 缝里透上来的紫光：地脉就在底下
  R(12, 22, 16, 3, '#2E2648');
  R(13, 23, 14, 2, '#4A3A6B');
  R(15, 24, 10, 1, '#8A6FC4');
  R(17, 25, 6, 1, '#C0A8E0');
  return c;
}

// 石敢当门柱：洞口两侧各一根，让"这是入口"一眼可读
function makeGatePost() {
  const c = cv(14, 30), g = c.getContext('2d');
  const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  R(2, 2, 10, 28, '#33343F');
  R(2, 2, 10, 2, '#4A4B58');
  R(2, 2, 2, 28, '#3F404C');
  R(2, 28, 10, 2, '#22232C');
  R(4, 6, 6, 3, '#5A5B6A');   // 刻痕，读作"上面写过字"
  R(4, 11, 6, 1, '#4A4B58');
  R(4, 14, 4, 1, '#4A4B58');
  return c;
}

export function dungeonArt() {
  return { chest: makeChest(), brazier: makeBrazier(), rift: makeRift(), gatePost: makeGatePost() };
}

// ============ 每层的伙伴 ============
// 越深越硬的怪。第 3 层只留最狠的几种，凑数的一律不出现 ——
// 深处的威胁应该来自"更强"，不是"更多"。
export const FLOOR_MOBS = [
  ['zhiren', 'fox', 'snake', 'crow'],
  ['shanxiao', 'yinhun', 'ghost', 'fukui'],
  ['brute', 'shigan', 'shadow', 'yinhun'],
];
