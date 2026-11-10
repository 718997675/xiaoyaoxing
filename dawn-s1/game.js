import * as THREE from './lib/three.module.js';
import { AUDIO } from './audio.js';
import { C, spriteCanvas, outlined, mirror, hexRgb, rgba } from './pixel.js';
import {
  RARITY, SLOTS, SLOT_LABEL, makeGear, gearStats, itemScore, rollRarity, randomFam,
  salvageValue, enhanceCost, rerollCost, rerollAffixes, MAX_ENH, STAT_LABEL,
} from './items.js';
import {
  WEAPONS, WEAPON_IDS, weaponCanvas, weaponIcon, drawWeaponAt, drawArcFx, drawThrustFx, drawRingFx, drawShockFx,
  drawRareAura, HELD_SCALE, SWING_SCALE, skinOf,
} from './weapons.js';
import { MONSTERS } from './monsters.js';
import { BRANCHES, NODES, NODE_BY_ID, computeSkillStats, nodeLevel, canLearn, ACTIVES } from './skills.js';
import { ART, loadArt } from './art.js';
import { Clock, PHASES, PHASE_EDGES } from './time.js';
import { VILLAGE, inVillage, villageArt, BUILDINGS, PROPS, NPCS, VILLAGERS, SHOPS } from './village.js';
import {
  DG, DGT, DG_FLOORS, FLOOR_MOBS, inDungeon, genFloor, paintDungeon, dungeonArt,
} from './dungeon.js';

const LW = 480, LH = 270, TILE = 16, MAPW = 144, MAPH = 104;
const SAVE_KEY = 'xiaoyao-save-v5';
const LEGACY_KEYS = ['xiaoyao-save-v4', 'xiaoyao-save-v3', 'xiaoyao-save-v2', 'xiaoyao-ch1-v1'];
// 当前画布缩放倍率（resize 里算），面板自适应要用
let viewScale = 1;
// 需要跟随画布缩放的面板（开始菜单 / 侠陨 / 通关）
const PANEL_SEL = ['#menu', '#dead', '#clear'];

// ============ 点阵素材 ============
function tex(c) {
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
  // 正交相机 top=0/bottom=LH 使世界 +Y 朝屏幕下方；关掉 flipY 才能让画布顶部朝上
  t.flipY = false;
  t.needsUpdate = true;
  return t;
}

// 主角：束发佩剑侠客
const PPAL = { h: C.ink1, s: C.paper2, e: C.ink1, r: C.ink3, g: C.gold2, l: C.ink2, o: C.ink1, c: C.red2, w: C.paper3 };
const P_DOWN0 = [
  '......hh......', '.....hhhh.....', '....hssssh....', '....sesses....', '.....ssss.....',
  '...rrrrrrrr...', '..rrrrrrrrrr..', '..rrrggggrrr..', '..ssrggggrss..', '..rrrrrrrrrrc.',
  '...rrrrrrrrc..', '...rrrrrrrc...', '..rrrrrrrrrr..', '...ll....ll...', '...ll....ll...', '...oo....oo...'];
const P_DOWN1 = P_DOWN0.slice(0, 13).concat(['..ll......ll..', '..ll......ll..', '..oo......oo..']);
const P_UP0 = P_DOWN0.slice(0, 2).concat(['....hhhhhh....', '....hhhhhh....', '.....hhhh.....'], P_DOWN0.slice(5));
const P_UP1 = P_UP0.slice(0, 13).concat(['..ll......ll..', '..ll......ll..', '..oo......oo..']);
const P_RIGHT0 = [
  '......hh......', '.....hhhh.....', '....hssss.....', '....hsess.....', '.....ssss.....',
  '...rrrrrrrr...', '..rrrrrrrrrr..', '..rrrggggrrr..', '..ssrggggrss..', '..rrrrrrrrrrc.',
  '...rrrrrrrrc..', '...rrrrrrrc...', '..rrrrrrrrrr..', '....llll......', '....ll.ll.....', '....oo.oo.....'];
const P_RIGHT1 = P_RIGHT0.slice(0, 13).concat(['...ll.ll......', '...ll..ll.....', '...oo..oo.....']);
const playerTex = {
  down: [tex(outlined(spriteCanvas(P_DOWN0, PPAL))), tex(outlined(spriteCanvas(P_DOWN1, PPAL)))],
  up: [tex(outlined(spriteCanvas(P_UP0, PPAL))), tex(outlined(spriteCanvas(P_UP1, PPAL)))],
  right: [tex(outlined(spriteCanvas(P_RIGHT0, PPAL))), tex(outlined(spriteCanvas(P_RIGHT1, PPAL)))],
};
playerTex.left = [tex(mirror(outlined(spriteCanvas(P_RIGHT0, PPAL)))), tex(mirror(outlined(spriteCanvas(P_RIGHT1, PPAL))))];

// 敌手贴图（可由外部图集覆盖）
const monTex = {};
function buildMonTex() {
  for (const [id, m] of Object.entries(MONSTERS)) {
    const ext = ART.monsters[id];
    if (ext) {
      monTex[id] = { frames: ext.frames.map(c => tex(c)), size: [ext.w || m.size[0], ext.h || m.size[1]] };
    } else {
      const a = outlined(spriteCanvas(m.rows, m.pal));
      const b = outlined(spriteCanvas(m.rows2 || m.rows, m.pal));
      monTex[id] = { frames: [tex(a), tex(b)], size: m.size };
    }
  }
}

// 影子：给所有单位一个落脚点，画面立刻"落地"
const SHADOW_C = (() => {
  const c = document.createElement('canvas'); c.width = 24; c.height = 10;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(12, 5, 0, 12, 5, 11);
  grad.addColorStop(0, 'rgba(10,20,24,0.55)');
  grad.addColorStop(0.6, 'rgba(10,20,24,0.28)');
  grad.addColorStop(1, 'rgba(10,20,24,0)');
  g.save(); g.translate(12, 5); g.scale(1, 0.42); g.translate(-12, -5);
  g.fillStyle = grad; g.beginPath(); g.arc(12, 5, 11, 0, 6.28); g.fill(); g.restore();
  return c;
})();
const SHADOW_TEX = tex(SHADOW_C);

const PROJ_TEX = tex(spriteCanvas(['.LL.', 'LPPL', 'LPPL', '.LL.'], { L: C.pur3, P: C.pur2 }));
const ORB_TEX = tex(spriteCanvas(['..uu..', '.uUUu.', 'uULLUu', 'uULLUu', '.uUUu.', '..uu..'], { u: C.pur2, U: C.pur1, L: C.pur3 }));
const ARROW_TEX = tex(spriteCanvas(['.L..', 'LP..', '.P..', '.P..'], { L: C.paper3, P: C.ink2 }));
const FIRE_TEX = tex(spriteCanvas(['.oo.', 'oOOo', 'oOOo', '.oo.'], { o: C.gold2, O: C.red2 }));
const QI_C = spriteCanvas(['..jj..', '.jJJj.', 'jJLLJj', 'jJLLJj', '.jJJj.', '..jj..'], { j: C.jade1, J: C.jade2, L: C.jade3 });
const QI_TEX = tex(QI_C);
// 法杖气弹 / 暗器飞镖：与「剑气」共用投射物系统，但贴图、速度和散射都独立
const DART_C = spriteCanvas(['..w..', '.wWw.', 'wWgWw', '.wWw.', '..w..'], { w: C.paper3, W: C.white, g: C.gold2 });
const DART_TEX = tex(DART_C);
const WU_C = spriteCanvas(['..gggg..', '.g....g.', 'g..yy..g', 'g.y..y.g', 'g.y..y.g', 'g..yy..g', '.g....g.', '..gggg..'], { g: C.gold2, y: C.gold3 });
const THUNDER_C = spriteCanvas([
  '......gg', '.....g..', '....g...', '...ggg..', '.....g..', '....g...', '...g....', '..g.....', '.g......',
], { g: C.gold3 });
const SHEN_C = spriteCanvas(['........', '.jjjj...', '....jj..', '.jjjj...', '....jj..', '.jjjj...', '........', '........'], { j: C.jade3 });
const SPARK_C = spriteCanvas(['.w.', 'www', '.w.'], { w: C.white });
const RING_C = spriteCanvas([
  '..jjjj..', '.jj....jj.', '.j......j.', '.j......j.', 'j........j', 'j........j', '.j......j.', '.j......j.', '.jj....jj.', '..jjjj..',
], { j: C.pur2 });

// 图标
const ICON_PAL = { j: C.jade1, J: C.jade2, L: C.jade3, g: C.gold1, Y: C.gold2, W: C.gold3, s: C.jade3, b: C.ink2, r: C.paper3, q: C.jade2, u: C.pur2, U: C.pur3 };const ICONS = {
  coin: spriteCanvas(['p......p', 'pp....pp', '.pPPPPp.', '.PPWWPP.', 'pPPPPPPp', '.pppppp.', '........', '........'], { p: C.paper1, P: C.paper2, W: C.paper3 }),
  potion: spriteCanvas(['..gggg..', '.gYYYYg.', 'gYYWWYYg', 'gYWWWWYg', 'gYWWWWYg', 'gYYWWYYg', '.gYYYYg.', '..gggg..'], ICON_PAL),
  armor: spriteCanvas(['.rrrrrr.', 'rrrrrrrr', 'rrqrrqrr', '.rrqqrr.', '.rrrrrr.', '..rrrr..', '........', '........'], ICON_PAL),
  necklace: spriteCanvas(['.g....g.', '.g....g.', '..gggg..', '...LL...', '..LWWL..', '...LL...', '...bb...', '........'], ICON_PAL),
  artifact: spriteCanvas(['...gg...', '..gYYg..', '.gYWWYg.', 'gYWLLWYg', '.gYWWYg.', '..gYYg..', '...gg...', '........'], ICON_PAL),
  iron: spriteCanvas(['..jjj..', '.jLLLj.', 'jLLLLLj', 'jLLLLLj', 'jLLLLLj', '.jjjjj.', '..jjj..', '........'], ICON_PAL),
};
const iconURL = {};
for (const k in ICONS) iconURL[k] = ICONS[k].toDataURL();
const wepIconURL = {};
function iconFor(it) {
  if (!it) return '';
  if (it.kind === 'weapon') {
    // 图标也跟着稀有造型走：包里两把「剑」不该长得一模一样
    const key = (it.fam || 'sword') + '@' + (it.r | 0) + '@' + skinOf(it.skin);
    if (!wepIconURL[key]) {
      wepIconURL[key] = weaponIcon(it.fam || 'sword', it.r | 0, it.skin, RARITY[it.r | 0].color).toDataURL();
    }
    return wepIconURL[key];
  }
  return iconURL[it.kind] || iconURL.armor;
}
// 地面掉落用的小图标（canvas 版，给 three 贴图）
function dropIconCanvas(it) {
  if (it.kind === 'weapon') {
    return weaponIcon(it.fam || 'sword', it.r | 0, it.skin, RARITY[it.r | 0].color);
  }
  return ICONS[it.kind] || ICONS.armor;
}

// 风物
// 竹丛：三竿细竹 + 疏叶，远看有"竹林"的疏影感
const BAMBOO = spriteCanvas([
  '....j...j...j...',
  '....j...j...j...',
  '...lJk..j..kJl..',
  '....j..kJk..j...',
  '....j...j...j...',
  '...kJl..j..lJk..',
  '....j...j...j...',
  '....j...j...j...',
  '....j..lJl..j...',
  '...lJk..j..kJl..',
  '....j...j...j...',
  '....j...j...j...',
  '...kJl..j..lJk..',
  '....j...j...j...',
  '....j...j...j...',
  '....j...j...j...',
  '...lJl..j..lJl..',
  '....j...j...j...',
  '...jjj.jjj.jjj..',
  '....b...b...b...',
], { j: '#3F8C82', J: '#74C0B4', k: '#2C6560', l: '#8FD0C4', b: C.ink2 });
// 桃树：深青树冠 + 朱砂花，树干三像素
const PEACH = spriteCanvas([
  '.....hhhhhh.....', '...hhttttttth...', '..httttttttttth.', '.htttftttttfttth',
  '.tttttttttttttt.', 'htttttttttttttth', '.ttfttttttftttt.', '..tttttttttttt..',
  '...tttftttttt...', '....tttttttt....', '......bb........', '......bb........',
  '.....bbbb.......', '....bbb.bbb.....',
], { h: '#2C6A63', t: '#3E8B7E', f: C.red3, b: C.ink2 });
const LANTERN = spriteCanvas([
  '...ssss...', '..ssssss..', '..syyyys..', '..ssssss..', '...ssss...', '....ss....', '....ss....', '...ssss...'], { s: C.ink3, y: C.gold2 });
const SHRINE = spriteCanvas([
  '.iiiiiiiiiiiiii.', '..iiiiiiiiiiii..', '...pppppppppp...', '...prppppprp....',
  '...prppggpprp...', '...prppggpprp...', '...pppppppppp...', '..ssssssssssss..'], { i: C.ink1, p: C.paper3, r: C.red2, g: C.gold2, s: C.ink3 });
const STONE = spriteCanvas([
  '...kkkkkk...', '..kkkkkkkk..', '..kKKKKKKk..', '..kKxxxxKk..', '..kKKKKKKk..', '..kkkkkkkk..', '...kkkkkk...'], { k: C.ink3, K: C.ink2, x: C.paper1 });
// 坟头：矮碑 + 一抔土。碑面留一块浅色"刻字"，远看就知道是坟不是石头
const GRAVE = spriteCanvas([
  '...kkkkkk...',
  '..kKKKKKKk..',
  '.kKKKKKKKKk.',
  '.kKKxxKKKKk.',
  '.kKxxxxKKKk.',
  '.kKKxxKKKKk.',
  '.kKKKKKKKKk.',
  '.kKKKKKKKKk.',
  'kkkkkkkkkkkk',
  '.bbbbbbbbbb.',
], { k: C.ink3, K: C.ink2, x: C.paper1, b: '#3E3A30' });
// 枯树：只有枝、没有叶。乱葬岗靠它和竹海拉开气质
const DEADTREE = spriteCanvas([
  '................',
  '.......k........',
  '....k..k..k.....',
  '.....k.k.k......',
  '..k...kkk...k...',
  '...k..kkk..k....',
  '....k.kbk.k.....',
  '.....kkbkk......',
  '......kbk.......',
  '......kbk.......',
  '......kbk.......',
  '.....kkbkk......',
  '......kbk.......',
  '......kbk.......',
  '......kbk.......',
  '.....kkbkk......',
  '....kk...kk.....',
  '...kk.....kk....',
], { k: '#57503F', b: C.ink2 });
// 石笋：石窟里的立石，比地面上的 stone 更尖、更高
const STALAG = spriteCanvas([
  '....kk....',
  '...kKKk...',
  '...kKKk...',
  '..kKKKKk..',
  '..kKKKKk..',
  '..kKKxKk..',
  '.kKKKKKKk.',
  '.kKKKKKKk.',
  '.kKKxKKKk.',
  'kKKKKKKKKk',
  'kKKKKKKKKk',
  'kkkkkkkkkk',
  '.kkkkkkkk.',
  '..kkkkkk..',
], { k: C.ink3, K: C.ink2, x: C.paper1 });
// 火把：矿道里唯一的光。夜里也是个小灯
const TORCH = spriteCanvas([
  '...y....',
  '..yry...',
  '..rrr...',
  '...r....',
  '...s....',
  '...s....',
  '...s....',
  '...s....',
  '...s....',
  '...s....',
  '...s....',
  '..sss...',
], { y: C.gold2, r: C.red2, s: C.ink3 });

// ============ three.js ============
const glCanvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(LW, LH, false);
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(0, LW, 0, LH, -10, 10);
camera.position.z = 5;
function quad(texture, w, h) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide }));
  scene.add(m);
  return m;
}
function solidQuad(w, h, color) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ color, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide }));
  scene.add(m);
  return m;
}
function beamTexture(hex) {
  const c = document.createElement('canvas');
  c.width = 3; c.height = 40;
  const g = c.getContext('2d');
  const [r, gg, b] = hexRgb(hex);
  const grad = g.createLinearGradient(0, 40, 0, 0);
  grad.addColorStop(0, `rgba(${r},${gg},${b},0.75)`);
  grad.addColorStop(0.18, `rgba(${r},${gg},${b},0.42)`);
  grad.addColorStop(0.55, `rgba(${r},${gg},${b},0.16)`);
  grad.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  g.fillStyle = grad; g.fillRect(0, 0, 3, 40);
  g.fillStyle = `rgba(255,255,255,0.55)`;
  g.fillRect(1, 0, 1, 18);
  return tex(c);
}

// ============ 世界：青云野 96×72 ============
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rng = mulberry32(20261109);
const tiles = new Uint8Array(MAPW * MAPH);
const solid = new Uint8Array(MAPW * MAPH);
const objects = [];
// ============ 大地图：村庄整体位移 ============
// 96×72 → 144×104 之后，青云集要留在东南角（新图往北、往西各扩了一圈）。
// village.js 里 NPC / 建筑 / 摆件 / 店铺全是村庄内的绝对像素坐标，一个个改容易漏，
// 这里统一加一个位移 —— 改一处就全动了，而且不用碰 village.js 里的任何美术数据。
const V_SHIFT_X = 1120, V_SHIFT_Y = 512;
VILLAGE.x0 += V_SHIFT_X; VILLAGE.x1 += V_SHIFT_X;
VILLAGE.y0 += V_SHIFT_Y; VILLAGE.y1 += V_SHIFT_Y;
VILLAGE.gateX += V_SHIFT_X;
for (const arr of [BUILDINGS, NPCS, VILLAGERS, PROPS]) {
  for (const o of arr) { if (o.x !== undefined) o.x += V_SHIFT_X; if (o.y !== undefined) o.y += V_SHIFT_Y; }
}
for (const id in SHOPS) { SHOPS[id].x += V_SHIFT_X; SHOPS[id].y += V_SHIFT_Y; }

const SPAWN = { x: 1896, y: 1544 };
const ALTAR = { x: 1152, y: 96 };
const TREANT_POS = { x: 2000, y: 320 };

// —— 四区地貌（tile 坐标，左闭右开）——
// 竹海西南、石窟西北、乱葬岗东北，青云集东南，古洞正北。
const REGION = {
  cave:   { x0: 4,  y0: 6,  x1: 52,  y1: 46,  label: '西荒石窟' },
  grave:  { x0: 92, y0: 4,  x1: 140, y1: 44,  label: '北坡乱葬岗' },
  bamboo: { x0: 4,  y0: 52, x1: 62,  y1: 100, label: '南岭竹海' },
};

const camps = [
  // —— 青云集周边 ——
  { x: 96 * TILE, y: 96 * TILE, tier: 1, types: ['zhiren', 'zhiren', 'fox', 'snake'], name: '山贼哨营' },
  { x: 78 * TILE, y: 92 * TILE, tier: 1, types: ['zhiren', 'ghost', 'fukui'], name: '黑风前哨' },
  { x: 90 * TILE, y: 74 * TILE, tier: 2, types: ['brute', 'shadow', 'shigan'], name: '演武场' },
  // —— 南岭竹海 ——
  { x: 30 * TILE, y: 58 * TILE, tier: 1, types: ['fox', 'snake', 'shanxiao'], name: '妖兽巢穴' },
  { x: 16 * TILE, y: 70 * TILE, tier: 1, types: ['shanxiao', 'fox', 'snake'], name: '猎户棚' },
  { x: 46 * TILE, y: 86 * TILE, tier: 2, types: ['snake', 'snake', 'brute'], name: '蛇窟' },
  { x: 56 * TILE, y: 96 * TILE, tier: 2, types: ['shigan', 'brute', 'shadow'], name: '机关工坊' },
  // —— 西荒石窟 ——
  { x: 12 * TILE, y: 20 * TILE, tier: 1, types: ['zhiren', 'brute', 'ghost'], name: '矿口哨卡' },
  { x: 36 * TILE, y: 34 * TILE, tier: 2, types: ['shigan', 'shadow', 'brute'], name: '塌方矿道' },
  { x: 22 * TILE, y: 10 * TILE, tier: 2, types: ['crow', 'crow', 'fukui'], name: '火鸦巢' },
  // —— 北坡乱葬岗 ——
  { x: 100 * TILE, y: 12 * TILE, tier: 1, types: ['crow', 'fukui', 'yinhun'], name: '乱葬岗' },
  { x: 122 * TILE, y: 32 * TILE, tier: 2, types: ['yinhun', 'shadow', 'yinhun'], name: '守墓人小屋' },
];
for (let y = 0; y < MAPH; y++) for (let x = 0; x < MAPW; x++) {
  const i = y * MAPW + x;
  tiles[i] = rng() < 0.22 ? 1 : 0;
  if (x < 2 || y < 2 || x >= MAPW - 2 || y >= MAPH - 2) { tiles[i] = 4; solid[i] = 1; }
}
// 荒地斑块与野花：数量按面积比放大（96×72 → 144×104 约 2.17 倍），
// 照旧数量撒的话大图会稀得像没画完。
for (let p = 0; p < 195; p++) {
  const cx = 3 + (rng() * (MAPW - 6)) | 0, cy = 3 + (rng() * (MAPH - 6)) | 0, r = 1 + (rng() * 2) | 0;
  for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
    if (x > 2 && y > 2 && x < MAPW - 3 && y < MAPH - 3 && (x - cx) ** 2 + (y - cy) ** 2 <= r * r) tiles[y * MAPW + x] = 2;
  }
}
for (let f = 0; f < 700; f++) {
  const x = 3 + (rng() * (MAPW - 6)) | 0, y = 3 + (rng() * (MAPH - 6)) | 0;
  if (tiles[y * MAPW + x] === 0) tiles[y * MAPW + x] = 3;
}

// ============ 四区地貌 ============
// 用一条抖动过的矩形边把整块地刷成该区底材。不做噪声地形 ——
// 玩家看小地图要能一眼分出"这片是竹林、那片是坟地"，噪声会把它们糊成一团。
function regionFloor(r, id) {
  for (let y = r.y0; y < r.y1; y++) for (let x = r.x0; x < r.x1; x++) {
    const i = y * MAPW + x;
    if (tiles[i] === 4) continue;
    const n = Math.sin(x * 0.17 + y * 0.11) * 3.1 + Math.sin(y * 0.29 - x * 0.06) * 2.2;
    if (x < r.x0 + 4 + n || x > r.x1 - 4 - n) continue;
    if (y < r.y0 + 4 + n || y > r.y1 - 4 - n) continue;
    tiles[i] = id;
  }
}
regionFloor(REGION.bamboo, 6);
regionFloor(REGION.cave, 7);
regionFloor(REGION.grave, 8);

// 石窟的岩层：整片实心会变成迷宫，只撒几十块小岩体，通路靠后面的路去打通
for (let c = 0; c < 46; c++) {
  const cx = REGION.cave.x0 + 5 + (rng() * (REGION.cave.x1 - REGION.cave.x0 - 10)) | 0;
  const cy = REGION.cave.y0 + 5 + (rng() * (REGION.cave.y1 - REGION.cave.y0 - 10)) | 0;
  const r = 1 + (rng() * 2) | 0;
  for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
    if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) continue;
    if (x < 3 || y < 3 || x >= MAPW - 3 || y >= MAPH - 3) continue;
    // 营地所在的地面不能被岩层吃掉，否则刷怪会直接卡在石头里
    if (camps.some(c2 => Math.hypot(x * TILE + 8 - c2.x, y * TILE + 8 - c2.y) < 66)) continue;
    solid[y * MAPW + x] = 1;
  }
}

// 竹海的溪涧：从北缘蜿蜒到南缘。水是实心的，只在三处架竹桥 ——
// 桥不铺满整条溪，玩家得自己找过河的地方，竹海才有点"迷"的意思。
let wx = 38;
for (let y = REGION.bamboo.y0 + 6; y < REGION.bamboo.y1 - 4; y++) {
  wx += Math.round(Math.sin(y * 0.23) * 1.1);
  if (wx < REGION.bamboo.x0 + 7) wx = REGION.bamboo.x0 + 7;
  if (wx > REGION.bamboo.x1 - 11) wx = REGION.bamboo.x1 - 11;
  for (let k = 0; k < 3; k++) {
    const i = y * MAPW + (wx + k);
    if (tiles[i] === 4) continue;
    tiles[i] = 10; solid[i] = 1;
  }
}
for (const by of [62, 76, 90]) {
  for (let x = 0; x < MAPW; x++) {
    if (tiles[by * MAPW + x] !== 10) continue;
    for (const yy of [by, by + 1]) {
      const i = yy * MAPW + x;
      if (tiles[i] === 10) { tiles[i] = 9; solid[i] = 0; }
    }
  }
}

// 路网。先在 tile 空间里走，主方向多走、次方向偶尔拐 ——
// 这样出来的是"人踩出来的路"，不是尺子画出来的 45° 斜线。
function carveRoad(tx0, ty0, tx1, ty1, halfW) {
  let x = tx0, y = ty0, guard = 0;
  while ((x !== tx1 || y !== ty1) && guard++ < 8000) {
    const dx = Math.sign(tx1 - x), dy = Math.sign(ty1 - y);
    if (Math.abs(tx1 - x) >= Math.abs(ty1 - y)) {
      if (rng() < 0.82 || !dy) x += dx; else y += dy;
    } else {
      if (rng() < 0.82 || !dx) y += dy; else x += dx;
    }
    for (let oy = -halfW; oy <= halfW; oy++) for (let ox = -halfW; ox <= halfW; ox++) {
      const px = x + ox, py = y + oy;
      if (px < 2 || py < 2 || px >= MAPW - 2 || py >= MAPH - 2) continue;
      if (inDungeon(px * TILE + 8, py * TILE + 8, 10)) continue;
      const i = py * MAPW + px;
      if (tiles[i] === 4) continue;
      tiles[i] = 2; solid[i] = 0;
    }
  }
}
const HUB = { x: 84, y: 60 };
carveRoad(119, 91, HUB.x, HUB.y, 1);   // 村口 → 三岔口
carveRoad(119, 91, 96, 96, 1);         // 村口 → 山贼哨营
carveRoad(90, 74, 119, 91, 1);         // 演武场 → 村口
carveRoad(HUB.x, HUB.y, 100, 12, 1);   // 三岔口 → 乱葬岗
carveRoad(HUB.x, HUB.y, 72, 40, 1);    // 三岔口 → 古洞前
carveRoad(72, 40, 12, 20, 1);          // 古洞前 → 石窟矿口
carveRoad(HUB.x, HUB.y, 30, 58, 1);    // 三岔口 → 竹海
carveRoad(30, 58, 46, 86, 1);          // 竹海 → 蛇窟
carveRoad(46, 86, 56, 96, 1);          // 蛇窟 → 机关工坊
carveRoad(30, 58, 16, 70, 1);          // 竹海 → 猎户棚
carveRoad(100, 12, 122, 32, 1);        // 乱葬岗 → 守墓人小屋
carveRoad(12, 20, 22, 10, 1);          // 矿口 → 火鸦巢
carveRoad(12, 20, 36, 34, 1);          // 矿口 → 塌方矿道

// —— 青云集：先把村址从野地里"清"出来 ——
// 顺序很关键：必须在 nearClear / 物件生成之前改地块，否则竹子会照常长在街上。
// 5 号地块 = 石板街（新加的类型，不参与土路的"啃碎边缘"那一步）。
const V_T0 = (VILLAGE.x0 / TILE) | 0, V_T1 = (VILLAGE.x1 / TILE) | 0;
const V_TY0 = (VILLAGE.y0 / TILE) | 0, V_TY1 = (VILLAGE.y1 / TILE) | 0;
for (let y = V_TY0; y < V_TY1; y++) for (let x = V_T0; x < V_T1; x++) {
  const i = y * MAPW + x;
  tiles[i] = 5; solid[i] = 0;
}
// 围墙：村址边框标成实心，南墙留出牌坊口
for (let x = V_T0; x < V_T1; x++) solid[V_TY0 * MAPW + x] = 1;
for (let y = V_TY0; y < V_TY1; y++) { solid[y * MAPW + V_T0] = 1; solid[y * MAPW + V_T1 - 1] = 1; }
for (let x = V_T0; x < V_T1; x++) {
  if (Math.abs((x * TILE + 8) - VILLAGE.gateX) < VILLAGE.gateHalf) continue;
  solid[(V_TY1 - 1) * MAPW + x] = 1;
}
// 官道：从牌坊一路铺到土地庙，玩家一出门就能看见村口
const GATE_T = (VILLAGE.gateX / TILE) | 0;
for (let y = V_TY1; y <= ((SPAWN.y / TILE) | 0) + 1; y++) {
  for (let x = GATE_T - 2; x <= GATE_T + 2; x++) {
    const i = y * MAPW + x;
    if (i > 0 && i < tiles.length) { tiles[i] = 2; solid[i] = 0; }
  }
}
function nearClear(x, y) {
  // 古洞的岩层里不能长竹子 —— 洞是后挖的、树是先长的，顺序反了就会出现"房间里长树"
  if (inDungeon(x, y, 40)) return true;
  if (inVillage(x, y, 26)) return true;
  if (Math.hypot(x - SPAWN.x, y - SPAWN.y) < 60) return true;
  if (Math.hypot(x - ALTAR.x, y - ALTAR.y) < 68) return true;
  if (Math.hypot(x - TREANT_POS.x, y - TREANT_POS.y) < 60) return true;
  return camps.some(c => Math.hypot(x - c.x, y - c.y) < 58);
}
// —— 分区撒风物 ——
// 每个区只在自己那片地上长东西：竹海是密竹、石窟是石笋与火把、乱葬岗是坟与枯树。
// 通用草地仍然撒桃树和竹子，保留"野地"的底子。
function scatterOn(id, r, count, kinds) {
  const w = r.x1 - r.x0, h = r.y1 - r.y0;
  for (let c = 0; c < count; c++) {
    const x = r.x0 + 2 + ((rng() * (w - 4)) | 0), y = r.y0 + 2 + ((rng() * (h - 4)) | 0);
    const i = y * MAPW + x;
    if (tiles[i] !== id || solid[i]) continue;
    if (nearClear(x * TILE + 8, y * TILE + 16)) continue;
    solid[i] = 1;
    objects.push({ kind: kinds[(rng() * kinds.length) | 0], x: x * TILE + 8, y: y * TILE + 16 });
  }
}
scatterOn(6, REGION.bamboo, 420, ['bamboo', 'bamboo', 'bamboo', 'peach']);
scatterOn(7, REGION.cave, 150, ['stalag', 'stalag', 'stone', 'torch']);
scatterOn(8, REGION.grave, 260, ['grave', 'grave', 'grave', 'deadtree']);

for (let c = 0; c < 300; c++) {
  const cx = 4 + (rng() * (MAPW - 8)) | 0, cy = 4 + (rng() * (MAPH - 8)) | 0;
  const n = 2 + (rng() * 4) | 0;
  for (let k = 0; k < n; k++) {
    const x = cx + ((rng() * 5) | 0) - 2, y = cy + ((rng() * 5) | 0) - 2;
    const i = y * MAPW + x;
    if (x > 2 && y > 2 && x < MAPW - 3 && y < MAPH - 3 && tiles[i] < 2 && !solid[i] && !nearClear(x * TILE + 8, y * TILE + 16)) {
      solid[i] = 1; objects.push({ kind: rng() < 0.5 ? 'bamboo' : 'peach', x: x * TILE + 8, y: y * TILE + 16 });
    }
  }
}
for (let r = 0; r < 87; r++) {
  const x = 3 + (rng() * (MAPW - 6)) | 0, y = 3 + (rng() * (MAPH - 6)) | 0, i = y * MAPW + x;
  if (tiles[i] < 2 && !solid[i] && !nearClear(x * TILE + 8, y * TILE + 12)) {
    solid[i] = 1; objects.push({ kind: 'lantern', x: x * TILE + 8, y: y * TILE + 12 });
  }
}
for (let r = 0; r < 39; r++) {
  const x = 4 + (rng() * (MAPW - 8)) | 0, y = 4 + (rng() * (MAPH - 8)) | 0, i = y * MAPW + x;
  if (tiles[i] < 2 && !solid[i] && !nearClear(x * TILE + 8, y * TILE + 12)) {
    solid[i] = 1; objects.push({ kind: 'stone', x: x * TILE + 8, y: y * TILE + 10 });
  }
}
objects.push({ kind: 'shrine', x: SPAWN.x, y: SPAWN.y - 16 });
objects.push({ kind: 'lantern', x: ALTAR.x - 26, y: ALTAR.y + 10 });
objects.push({ kind: 'lantern', x: ALTAR.x + 26, y: ALTAR.y + 10 });

const groundC = document.createElement('canvas');
groundC.width = MAPW * TILE; groundC.height = MAPH * TILE;
{
  const g = groundC.getContext('2d');
  // 索引：0/1 草 2 土路 3 野花 4 边界 5 石板街 6 竹海 7 石窟 8 荒土 9 竹桥 10 溪水
  const cols = [C.jade1, C.jade1, C.paper1, C.jade1, C.ink1, '#8A8268',
    '#2A5B54', '#3B3C3D', '#59523F', '#6B4B2E', '#1D4A56'];
  for (let y = 0; y < MAPH; y++) for (let x = 0; x < MAPW; x++) {
    const t = tiles[y * MAPW + x];
    // 草地做低频色块：同一片草不必一个颜色，远看有起伏
    let base = cols[t];
    if (t <= 1) {
      const wave = Math.sin(x * 0.31 + Math.sin(y * 0.21) * 2.1) * 0.5 + Math.sin(y * 0.17 - x * 0.09) * 0.5;
      base = wave > 0.62 ? '#2E6B67' : (wave < -0.75 ? '#30716D' : C.jade1);
    }
    g.fillStyle = base; g.fillRect(x * TILE, y * TILE, TILE, TILE);
    if (t <= 1) {
      g.fillStyle = grassN(x, y) > 0 ? C.jade2 : '#4A8C85';
      for (let k = 0; k < 5; k++) g.fillRect(x * TILE + ((rng() * 16) | 0), y * TILE + ((rng() * 16) | 0), 1, 1);
    }
    if (t === 2) {
      // 土路：碎石 / 车辙 / 深浅斑。只铺 3 个亮点会让大片路面平得像一块色块
      const bx = x * TILE, by = y * TILE;
      if (rng() < 0.6) { g.fillStyle = '#79725A'; g.fillRect(bx + ((rng() * 12) | 0), by + ((rng() * 13) | 0), 3, 2); }
      g.fillStyle = C.paper2;
      for (let k = 0; k < 4; k++) g.fillRect(bx + ((rng() * 15) | 0), by + ((rng() * 15) | 0), 2, 1);
      g.fillStyle = '#5F5A46';
      for (let k = 0; k < 2; k++) g.fillRect(bx + ((rng() * 15) | 0), by + ((rng() * 15) | 0), 1, 1);
    }
    if (t === 3) { g.fillStyle = rng() < 0.5 ? C.red3 : C.gold3; g.fillRect(x * TILE + 6 + ((rng() * 5) | 0), y * TILE + 5 + ((rng() * 6) | 0), 2, 2); }
    if (t === 5) {
      // 石板街。三个要点：
      // ① 比外面的土路冷、比它暗，才一进村就知道"这是铺过的地"；
      // ② 隔行错缝（错 4px），否则 8px 方块会连成一张棋盘格；
      // ③ 块面之间只留 1px 缝，靠缝读"石板"，不靠高对比。
      const bx = x * TILE, by = y * TILE;
      g.fillStyle = '#4C4A3C';
      g.fillRect(bx, by, 16, 16);
      g.save();
      g.beginPath(); g.rect(bx, by, 16, 16); g.clip();
      for (let sy = 0; sy < 2; sy++) {
        const row = y * 2 + sy;
        const off = (row % 2) * 4;
        for (let sx = -1; sx < 3; sx++) {
          const n = ((x * 2 + sx + (row % 2)) * 11 + row * 7) % 6;
          g.fillStyle = n === 0 ? '#75725F' : n === 1 ? '#636050' : (n === 2 ? '#6E6B58' : '#6A6755');
          g.fillRect(bx + sx * 8 - off, by + sy * 8, 7, 7);
        }
      }
      g.restore();
      // 缝隙里的苔与土
      if (rng() < 0.16) {
        g.fillStyle = '#3F6E63';
        g.fillRect(bx + ((rng() * 14) | 0), by + ((rng() * 14) | 0), 2, 1);
      }
      if (rng() < 0.1) {
        g.fillStyle = '#8A8268';
        g.fillRect(bx + ((rng() * 14) | 0), by + ((rng() * 14) | 0), 1, 1);
      }
    }
    if (t === 4) { g.fillStyle = C.jade2; g.fillRect(x * TILE + 2, y * TILE + 4 + ((rng() * 8) | 0), 6, 1); g.fillRect(x * TILE + 9, y * TILE + 2 + ((rng() * 10) | 0), 5, 1); }
    if (t === 6) {
      // 竹海：湿、暗、落叶多。不铺满，留 40% 干净的底，否则整片像地毯
      const bx = x * TILE, by = y * TILE;
      g.fillStyle = '#35706A';
      for (let k = 0; k < 4; k++) g.fillRect(bx + ((rng() * 15) | 0), by + ((rng() * 15) | 0), 1, 2);
      if (rng() < 0.45) {
        g.fillStyle = '#8A7A3C';
        g.fillRect(bx + ((rng() * 13) | 0), by + ((rng() * 13) | 0), 2, 1);
      }
      if (rng() < 0.18) {
        g.fillStyle = '#244F49';
        g.fillRect(bx + ((rng() * 12) | 0), by + ((rng() * 12) | 0), 4, 3);
      }
    }
    if (t === 7) {
      // 石窟：碎岩 + 一道裂缝。岩面比外面冷，靠裂纹读"石头"而不是靠颜色
      const bx = x * TILE, by = y * TILE;
      g.fillStyle = '#4A4B4C';
      for (let k = 0; k < 3; k++) g.fillRect(bx + ((rng() * 14) | 0), by + ((rng() * 14) | 0), 2, 1);
      if (rng() < 0.3) {
        g.fillStyle = '#2A2B2C';
        let cx2 = bx + ((rng() * 10) | 0) + 3, cy2 = by + ((rng() * 6) | 0) + 2;
        for (let k = 0; k < 5; k++) { g.fillRect(cx2, cy2, 1, 1); cx2 += ((rng() * 3) | 0) - 1; cy2 += 1; }
      }
    }
    if (t === 8) {
      // 乱葬岗：干裂的土 + 零星白骨。刻意压低饱和，和竹海的湿绿正好相反
      const bx = x * TILE, by = y * TILE;
      g.fillStyle = '#6A6250';
      for (let k = 0; k < 3; k++) g.fillRect(bx + ((rng() * 14) | 0), by + ((rng() * 14) | 0), 3, 1);
      if (rng() < 0.12) {
        g.fillStyle = C.paper1;
        g.fillRect(bx + ((rng() * 13) | 0), by + ((rng() * 13) | 0), 2, 1);
      }
      if (rng() < 0.06) {
        g.fillStyle = '#3A3529';
        g.fillRect(bx + ((rng() * 10) | 0), by + ((rng() * 12) | 0), 1, 4);
      }
    }
    if (t === 9) {
      // 竹桥：横向铺板，两端各留一条暗边当"桥沿"
      const bx = x * TILE, by = y * TILE;
      g.fillStyle = '#7C5836';
      for (let k = 0; k < 2; k++) g.fillRect(bx, by + k * 8 + 1, 16, 6);
      g.fillStyle = '#4E3620';
      g.fillRect(bx, by, 16, 1); g.fillRect(bx, by + 15, 16, 1);
      g.fillRect(bx + 7, by, 1, 16);
    }
    if (t === 10) {
      // 溪水：两道横纹 + 一处反光。不做动画，静态水面在俯视角下也够用
      const bx = x * TILE, by = y * TILE;
      g.fillStyle = '#2C6A78';
      g.fillRect(bx, by + 3, 16, 1);
      g.fillRect(bx + 2, by + 10, 12, 1);
      if (rng() < 0.22) { g.fillStyle = '#5FA6AE'; g.fillRect(bx + ((rng() * 11) | 0), by + ((rng() * 14) | 0), 3, 1); }
    }
  }
  // 大尺度明暗斑块：打散"一格一格"的棋盘感
  for (let i = 0; i < 900; i++) {
    const cx = rng() * groundC.width, cy = rng() * groundC.height;
    const r = 40 + rng() * 110;
    g.save();
    g.globalAlpha = 0.05;
    g.fillStyle = rng() < 0.5 ? '#12352F' : '#7FB7A8';
    g.beginPath(); g.ellipse(cx, cy, r, r * (0.5 + rng() * 0.6), rng() * 3, 0, 6.28); g.fill();
    g.restore();
  }
  // 土路边缘打散：先铺一圈中间色（草地→中间色→路面，三阶过渡），再把直角阶梯啃成碎边
  for (let y = 0; y < MAPH; y++) for (let x = 0; x < MAPW; x++) {
    if (tiles[y * MAPW + x] !== 2) continue;
    const up = y > 0 && tiles[(y - 1) * MAPW + x] === 2;
    const dn = y < MAPH - 1 && tiles[(y + 1) * MAPW + x] === 2;
    const lf = x > 0 && tiles[y * MAPW + x - 1] === 2;
    const rt = x < MAPW - 1 && tiles[y * MAPW + x + 1] === 2;
    const bx = x * TILE, by = y * TILE;
    // 中间色环：避免 paper1 直接贴 jade1 的硬跳色
    g.fillStyle = '#6F7A5F';
    if (!up) g.fillRect(bx, by, TILE, 2);
    if (!dn) g.fillRect(bx, by + TILE - 2, TILE, 2);
    if (!lf) g.fillRect(bx, by, 2, TILE);
    if (!rt) g.fillRect(bx + TILE - 2, by, 2, TILE);
    // 碎边
    g.fillStyle = C.jade1;
    for (let k = 0; k < (up ? 0 : 3); k++) g.fillRect(bx + ((rng() * 16) | 0), by + ((rng() * 3) | 0), 2, 2);
    for (let k = 0; k < (dn ? 0 : 3); k++) g.fillRect(bx + ((rng() * 16) | 0), by + 13 + ((rng() * 3) | 0), 2, 2);
    for (let k = 0; k < (lf ? 0 : 3); k++) g.fillRect(bx + ((rng() * 3) | 0), by + ((rng() * 16) | 0), 2, 2);
    for (let k = 0; k < (rt ? 0 : 3); k++) g.fillRect(bx + 13 + ((rng() * 3) | 0), by + ((rng() * 16) | 0), 2, 2);
    // 边上的杂草：路面和草地咬合更自然
    g.fillStyle = '#4A8C85';
    for (let k = 0; k < 2; k++) g.fillRect(bx + ((rng() * 16) | 0), by + ((rng() * 16) | 0), 1, 1);
  }
  // 营地：一小片被踩秃的空地 + 一圈柴火痕，别做成一整块大土斑
  for (const c of camps) {
    g.save();
    g.globalAlpha = 0.55;
    g.fillStyle = '#7E7658';
    g.beginPath(); g.ellipse(c.x, c.y, 26, 20, 0, 0, 6.28); g.fill();
    g.globalAlpha = 0.30;
    g.fillStyle = C.paper1;
    g.beginPath(); g.ellipse(c.x, c.y, 15, 11, 0, 0, 6.28); g.fill();
    g.globalAlpha = 0.5;
    g.strokeStyle = C.ink2; g.lineWidth = 1;
    g.beginPath(); g.arc(c.x, c.y, 11, 0, 6.28); g.stroke();
    g.restore();
  }
  // 土地庙 / 树妖 前的空地也给一点人气
  const clearings = [SPAWN, ALTAR, TREANT_POS];
  for (const p of clearings) {
    g.save(); g.globalAlpha = 0.32; g.fillStyle = C.paper2;
    g.beginPath(); g.ellipse(p.x, p.y + 6, 26, 18, 0, 0, 6.28); g.fill(); g.restore();
  }
}
function grassN(x, y) { return Math.sin(x * 0.7 + y * 0.4) + Math.cos(y * 0.55 - x * 0.2); }
const ground = quad(tex(groundC), MAPW * TILE, MAPH * TILE);
ground.position.set(MAPW * TILE / 2, MAPH * TILE / 2, 0);
ground.renderOrder = 0;
const objTex = {
  bamboo: tex(BAMBOO), peach: tex(PEACH), lantern: tex(LANTERN), shrine: tex(SHRINE), stone: tex(STONE),
  grave: tex(GRAVE), deadtree: tex(DEADTREE), stalag: tex(STALAG), torch: tex(TORCH),
};
const objSize = {
  bamboo: [16, 20], peach: [16, 14], lantern: [10, 8], shrine: [16, 8], stone: [12, 7],
  grave: [12, 10], deadtree: [16, 18], stalag: [10, 14], torch: [8, 12],
};
for (const o of objects) {
  const [w, h] = objSize[o.kind];
  o.mesh = quad(objTex[o.kind], w, h);
  o.mesh.position.set(o.x, o.y - h / 2, 0);
  o.mesh.renderOrder = 1000 + Math.round(o.y);
}

// ============ 青云集 ============
const VART = villageArt();
const vTex = {};
for (const k in VART) vTex[k] = tex(VART[k]);
function markSolid(x0, y0, x1, y1) {
  const t0 = Math.max(0, Math.floor(x0 / TILE)), t1 = Math.min(MAPW - 1, Math.floor((x1 - 1) / TILE));
  const r0 = Math.max(0, Math.floor(y0 / TILE)), r1 = Math.min(MAPH - 1, Math.floor((y1 - 1) / TILE));
  for (let y = r0; y <= r1; y++) for (let x = t0; x <= t1; x++) solid[y * MAPW + x] = 1;
}
function vobj(art, x, y, extra) {
  const c = VART[art];
  const o = Object.assign({ kind: 'village', art, x, y, w: c.width, h: c.height, tex: vTex[art] }, extra || {});
  objects.push(o);
  o.mesh = quad(o.tex, o.w, o.h);
  o.mesh.position.set(o.x, o.y - o.h / 2, 0);
  // under：牌坊这类"可以从底下走过去"的东西。它 58px 高，按脚线排序会把刚从下面
  // 走过的玩家整个盖住；压到所有角色之下，就没有这个尴尬，视觉上也不违和。
  o.mesh.renderOrder = o.under ? 900 : 1000 + Math.round(o.y + (o.sortY || 0));
  return o;
}
// 村里也长几棵树：全石板 + 全房子会像模型沙盘，一点绿才像有人住
function addTree(kind, x, y) {
  const o = { kind, x, y };
  objects.push(o);
  const [w, h] = objSize[kind];
  o.mesh = quad(objTex[kind], w, h);
  o.mesh.position.set(o.x, o.y - h / 2, 0);
  o.mesh.renderOrder = 1000 + Math.round(o.y);
  markSolid(x - 5, y - 4, x + 5, y);
  return o;
}
for (const [k, x, y] of [
  ['peach', 700, 912], ['peach', 902, 918], ['bamboo', 638, 762], ['bamboo', 936, 764],
]) addTree(k, x, y);
// 建筑：只有"墙脚"两格是实心的。屋身让玩家绕到背后，靠 y 排序遮挡 ——
// 把整栋都设成实心会让村子变成四个大方块，走位全被卡住。
for (const b of BUILDINGS) {
  const c = VART[b.id];
  vobj(b.id, b.x, b.y);
  markSolid(b.x - c.width / 2 + 3, b.y - 20, b.x + c.width / 2 - 3, b.y);
}
// 落地影：base 线下方一圈软影。少了这一圈，房子像贴纸浮在石板上。
{
  const g = groundC.getContext('2d');
  for (const b of BUILDINGS) {
    const hw = VART[b.id].width / 2 - 5;
    g.save();
    g.fillStyle = 'rgba(14,18,24,0.20)';
    g.beginPath(); g.ellipse(b.x, b.y + 2, hw, 8, 0, 0, 6.28); g.fill();
    g.fillStyle = 'rgba(14,18,24,0.11)';
    g.beginPath(); g.ellipse(b.x, b.y + 5, hw - 8, 5, 0, 0, 6.28); g.fill();
    g.restore();
  }
  ground.material.map.needsUpdate = true;
}
// 围墙：一段 16px，接缝对齐所以看不出是拼的
for (let x = VILLAGE.x0; x < VILLAGE.x1; x += TILE) {
  vobj('wall', x + 8, VILLAGE.y0 + TILE, { sortY: -8 });
  if (Math.abs(x + 8 - VILLAGE.gateX) >= VILLAGE.gateHalf) vobj('wall', x + 8, VILLAGE.y1, { sortY: -8 });
}
for (let y = VILLAGE.y0 + TILE; y < VILLAGE.y1; y += TILE) {
  vobj('wallSide', VILLAGE.x0 + 8, y + 8, { sortY: -8 });
  vobj('wallSide', VILLAGE.x1 - 8, y + 8, { sortY: -8 });
}
let PF = null;   // 牌坊：玩家从底下走过时要淡出，否则整个人被门楼盖住
for (const p of PROPS) {
  if (p.id === 'paifang') { PF = vobj('paifang', p.x, p.y); continue; }
  vobj(p.id, p.x, p.y);
  if (p.id === 'well') markSolid(p.x - 11, p.y - 10, p.x + 11, p.y);
  if (p.id === 'notice') markSolid(p.x - 7, p.y - 8, p.x + 7, p.y);
}
// 掌柜：站在自家门边。打烊就回屋（隐藏）—— 隔着半条街看一眼门口有没有人，
// 就知道这家开没开，比在招牌上写"营业中"省事得多。
const npcObjs = [];
for (const n of NPCS) {
  const o = vobj(n.art, n.x, n.y, { npc: n.id, baseY: n.y });
  o.talking = false;
  npcObjs.push(o);
}
// 街面上的村民：作息不是"装饰性动画"，是真的按 phase 出现/消失。
// 子时街上只剩更夫与醉汉，酉时酒馆门口挤四个人 —— 不看日晷也知道几点了。
const vilObjs = [];
for (const v of VILLAGERS) {
  const o = vobj(v.art, v.x, v.y, { villager: v.id, baseY: v.y });
  o.data = v;
  o.spoke = 0;
  vilObjs.push(o);
}
// 村口牌坊两侧各挂一盏灯：夜里从野外望过去，那是"这里有人"的唯一信号
for (const dx of [-34, 34]) {
  const o = { kind: 'lantern', x: VILLAGE.gateX + dx, y: VILLAGE.y1 - 20 };
  objects.push(o);
  o.mesh = quad(objTex.lantern, 10, 8);
  o.mesh.position.set(o.x, o.y - 4, 0);
  o.mesh.renderOrder = 1000 + Math.round(o.y);
}
// ============ 青云古洞 ============
// 世界地图西南角的山体空腔。进洞不是换场景，是"走进另一块地" ——
// 所以相机、碰撞、小地图、掉落、光照全都不用动。
const DART = dungeonArt();
const dgTex = {};
for (const k in DART) dgTex[k] = tex(DART[k]);

// 洞里恒暗，不随昼夜。这是地宫唯一"作弊"的地方，也是它成立的原因：
// 可视半径 96px，玩家永远只能看见一间屋，于是"每次重排"这件事被藏住了。
const DG_DARK = { a: 0.84, r: 7, g: 8, b: 15 };

let dgData = null, dgFloor = 1;
let dgObjs = [], dgMobs = [], dgCleared = false;
let dgDipT = 0, dgDipAct = null;

function dgRoomC(r) {
  return { x: (DG.tx0 + r.x + r.w / 2) * TILE, y: (DG.ty0 + r.y + r.h / 2) * TILE };
}
function dgEntry() {
  return {
    x: dgData.doorX,
    y: (DG.ty0 + dgData.entry.y + dgData.entry.h - 1.5) * TILE,
  };
}

function dgAdd(kind, x, y, extra) {
  const c = DART[kind];
  const o = Object.assign({ kind, x, y, w: c.width, h: c.height }, extra || {});
  o.mesh = quad(dgTex[kind], o.w, o.h);
  o.mesh.position.set(x, y - o.h / 2, 0);
  o.mesh.renderOrder = 1000 + Math.round(y);
  dgObjs.push(o);
  // 箱子挡路，火盆不挡 —— 火盆只有 18px，走过去跨一下就过去了，
  // 设成实心反而会在窄走廊里把人卡死。
  if (kind === 'chest') markSolid(x - 10, y - 8, x + 10, y);
  return o;
}

function dgWipe() {
  for (const o of dgObjs) scene.remove(o.mesh);
  dgObjs = [];
  const gone = new Set(dgMobs);
  for (const e of dgMobs) {
    scene.remove(e.mesh);
    if (e.shadow) scene.remove(e.shadow);
    if (e.ring) scene.remove(e.ring);
  }
  if (gone.size) enemies = enemies.filter(e => !gone.has(e));
  dgMobs = [];
  // 上一层丢在地上的东西不该掉在新一层的地板上
  drops = drops.filter(d => {
    if (!dgIn(d.x, d.y)) return true;
    if (d.mesh) scene.remove(d.mesh);
    if (d.beam) scene.remove(d.beam);
    return false;
  });
}
function dgIn(x, y) { return inDungeon(x, y, 0); }

function dgPlace() {
  dgWipe();
  const rooms = dgData.rooms;
  const deep = dgData.deepRoom;

  // 火盆：每间屋一盏。洞里的光只有火盆和玩家手上的火把 ——
  // 这两样就是"看得见"和"看不见"的全部区别。
  for (let i = 1; i < rooms.length; i++) {
    const r = rooms[i];
    const k = (Math.random() * 4) | 0;
    const cx = DG.tx0 + (k % 2 ? r.x + 1 : r.x + r.w - 2) + 0.5;
    const cy = DG.ty0 + (k < 2 ? r.y + 1 : r.y + r.h - 2) + 0.5;
    dgAdd('brazier', cx * TILE, cy * TILE);
  }
  // 入口房也点一盏：刚从大太阳底下走进来那一眼，不能是纯黑
  const e0 = rooms[0];
  dgAdd('brazier', (DG.tx0 + e0.x + e0.w - 1.5) * TILE, (DG.ty0 + e0.y + 1.5) * TILE);

  // 洞口两根石柱。只在第 1 层 —— 上面几层的洞口是封死的，立柱子等于告诉玩家
  // "这里出不去"，反而添乱。
  if (dgFloor === 1) {
    for (const dx of [-24, 24]) dgAdd('gatePost', dgData.doorX + dx, DG.y1 + 6);
  }

  if (dgFloor < DG_FLOORS) {
    // 1、2 层：最深那间放地脉裂口（清完才通），另挑一间放箱子
    const others = rooms.filter((r, i) => i !== 0 && r !== deep);
    if (others.length) {
      const r = others[(Math.random() * others.length) | 0];
      const c = dgRoomC(r);
      const x = c.x + (Math.random() * 40 - 20), y = c.y + (Math.random() * 30 - 15);
      dgAdd('chest', canStand(x, y) ? x : c.x, canStand(x, y) ? y : c.y, { locked: true });
    }
    dgAdd('rift', dgData.deepC.x, dgData.deepC.y, { locked: true, down: true });
  } else {
    // 第 3 层：最深房是洞主的地盘，箱子在它身后
    // 箱子摆在洞主身侧，不摆正后方：正后方会被首领的贴图整个盖住，
    // 打完了也找不到箱子在哪。
    dgAdd('chest', dgData.deepC.x + 40, dgData.deepC.y + 26, { locked: true, big: true });
    const c = dgEntry();
    dgAdd('rift', c.x, c.y - 8, { home: true });
  }

  // 怪：每间屋（入口除外）按层数放 2~3 只。
  // 只用该层的池子 —— 第 3 层不该再冒出杂兵，深处的威胁要来自"更强"。
  const pool = FLOOR_MOBS[Math.min(dgFloor, DG_FLOORS) - 1];
  const boost = 1 + (dgFloor - 1) * 0.45;
  for (let i = 1; i < rooms.length; i++) {
    const r = rooms[i];
    const c = dgRoomC(r);
    // 宽房多放一只。不按层数堆数量 —— 深处的威胁要来自"更强"，
    // 25 只怪挤在黑暗里，玩家感受到的是烦，不是难。
    const n = r.w >= 7 ? 3 : 2;
    for (let k = 0; k < n; k++) {
      const t = pool[(Math.random() * pool.length) | 0];
      const a = Math.random() * 6.28, d = 8 + Math.random() * (r.w * 7);
      let px = c.x + Math.cos(a) * d, py = c.y + Math.sin(a) * d * 0.85;
      if (!canStand(px, py)) { px = c.x; py = c.y; }
      const e = spawnEnemy(t, px, py, { x: c.x, y: c.y });
      if (!e) continue;
      e.dg = true;
      e.maxHp = e.hp = Math.round(e.hp * boost);
      e.dmg *= boost;
      dgMobs.push(e);
    }
  }
  if (dgFloor >= DG_FLOORS) {
    const b = spawnEnemy('yaowang', dgData.deepC.x, dgData.deepC.y - 16, { x: dgData.deepC.x, y: dgData.deepC.y });
    if (b) {
      b.dg = true; b.aggro = true;
      // 紫环。洞主的点阵在暗处只剩两只角和一对红眼，先给一圈光晕，
      // 玩家才能在"看清它"之前先读懂"这是首领"。
      b.ring = quad(tex(RING_C), 30, 34);
      b.ring.material.color.set(C.pur2);
      b.ring.material.opacity = 0.8;
      dgMobs.push(b);
    }
  }
}

function dgBuild(floor, seed) {
  dgFloor = floor;
  dgData = genFloor(seed, floor);
  dgCleared = false;
  const W = dgData.W, H = dgData.H;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const gx = DG.tx0 + x, gy = DG.ty0 + y;
      if (gx < 0 || gy < 0 || gx >= MAPW || gy >= MAPH) continue;
      const gi = gy * MAPW + gx;
      const v = dgData.t[y * W + x];
      tiles[gi] = v;
      solid[gi] = v === DGT.WALL ? 1 : 0;
    }
  }
  // 洞口外侧清障：野地里万一有石头长在门口，玩家会以为这洞进不去
  for (let y = DG.ty0 + H; y <= DG.ty0 + H + 1 && y < MAPH; y++) {
    for (let x = DG.tx0 + dgData.entry.x; x < DG.tx0 + dgData.entry.x + dgData.entry.w && x < MAPW; x++) {
      solid[y * MAPW + x] = 0;
    }
  }
  paintDungeon(groundC.getContext('2d'), dgData);
  ground.material.map.needsUpdate = true;
  dgPlace();
}

function dgReset() { dgBuild(1, (Math.random() * 1e9) | 0); }

// 黑幕转场：0→0.34s 渐黑，中途换场，0.34→0.68s 渐亮。
// 不做这层黑，玩家会看见地面"啪"地重排一遍。
function dgDipTo(fn) { dgDipT = 0.001; dgDipAct = fn; }

function dgDescend() {
  if (dgFloor >= DG_FLOORS) { msg('已到地脉最深处', C.paper1); return; }
  if (!dgCleared) { msg('妖物未清，地脉不通', C.red3); return; }
  dgDipTo(() => {
    const f = dgFloor + 1;
    dgBuild(f, (Math.random() * 1e9) | 0);
    const c = dgEntry();
    player.x = c.x; player.y = c.y;
    msg('深入地脉 · 第 ' + f + ' 层', C.pur3);
    AUDIO.play('levelup');
  });
}
function dgHome() {
  dgDipTo(() => {
    const at = { x: dgData.doorX, y: DG.y1 + 26 };
    dgReset();
    player.x = at.x; player.y = at.y;
    msg('回到地面', C.jade3);
  });
}

function dgCheckClear() {
  if (dgCleared || !dgMobs.length) return;
  if (!dgIn(player.x, player.y)) return;
  if (!dgMobs.every(e => e.dead)) return;
  dgCleared = true;
  for (const o of dgObjs) o.locked = false;
  if (dgFloor >= DG_FLOORS) {
    msg('洞主伏诛 · 宝箱开了', C.gold3);
    AUDIO.play('rare');
  } else {
    msg('层中妖物已清 · 地脉裂口开了', C.pur3);
    AUDIO.play('levelup');
  }
}

// 互动目标
function nearDg() {
  let best = null, bd = 44;
  for (const o of dgObjs) {
    if (o.kind !== 'chest' && o.kind !== 'rift') continue;
    const d = Math.hypot(player.x - o.x, player.y - o.y);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

function canStand(x, y) {
  for (const [dx, dy] of [[-4, -3], [4, -3], [-4, 0], [4, 0]]) {
    const tx = ((x + dx) / TILE) | 0, ty = ((y + dy) / TILE) | 0;
    if (tx < 0 || ty < 0 || tx >= MAPW || ty >= MAPH || solid[ty * MAPW + tx]) return false;
  }
  return true;
}

// ============ 状态 ============
const player = {
  x: SPAWN.x, y: SPAWN.y, hp: 100, qi: 60, maxHpBase: 100, xp: 0, level: 1, gold: 0, iron: 0,
  atkBase: 8, dir: 'down', moving: false,
  atkCd: 0, atkT: 0, atkBuf: 0, atkStep: 0, lastAtkT: -9, swing: null, lunge: 0,
  dashT: 0, dashCd: 0, flash: 0, iframe: 0, shield: 0, hurtFlash: 0,
  poison: 0, poisonT: 0, poisonImmuneT: 0,
  drunkT: 0, drunk: 0, rested: false,
  inv: [], invMax: 20, equip: { weapon: null, armor: null, necklace: null, artifact: null },
  windCd: 0, skillPts: 0, skillLv: {}, kills: 0,
};
const pMesh = quad(playerTex.down[0], 16, 18);
pMesh.visible = false;
const pShadow = quad(SHADOW_TEX, 13, 4.5);
pShadow.visible = false;
let enemies = [], drops = [], projectiles = [], dmgNums = [], messages = [];
let particles = [], sparks = [], ghosts = [], slashGhosts = [], bolts = [];
let state = 'menu', shakeX = 0, shakeY = 0, time = 0, saveT = 0, cleared = false;
let hitstop = 0, combo = 0, comboT = 0, comboPulse = 0, eliteT = 22, spawnT = 8;
const keys = {};
// 失焦 / 切模式时清干净方向键，避免「keyup 没送到 → 人朝一个方向一直走」
function clearKeys() { for (const k in keys) keys[k] = false; }
const skills = { qi: { cd: 0, max: 2.2 }, wu: { cd: 0, max: 6 }, thunder: { cd: 0, max: 5 } };
let wuT = 0;
const DIRV = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };
const DIRA = { down: Math.PI / 2, up: -Math.PI / 2, left: Math.PI, right: 0 };

const ELITE_MODS = [
  { name: '狂暴', hp: 1.5, dmg: 1.35, cd: 0.7, color: C.red2 },
  { name: '铁壁', hp: 1.7, dmg: 0.9, cd: 1.0, def: 0.5, color: C.ink3 },
  { name: '饮血', hp: 1.25, dmg: 1.1, cd: 0.9, ls: 0.25, color: C.red1 },
  { name: '疾风', hp: 1.15, dmg: 1.05, cd: 0.85, spdMul: 1.5, color: C.jade2 },
];
const TITLES = ['初出茅庐', '三流好手', '二流高手', '一流高手', '顶尖高手', '一代宗师', '陆地神仙'];
function realm() { return TITLES[Math.min(player.level - 1, TITLES.length - 1)]; }

// ============ 触屏操作（虚拟摇杆 + 动作键）============
// 判定标准是「这台设备当下主要用手指还是键鼠」，不是「它是否具备触摸能力」：
// 桌面 Chrome、Windows 触屏本上 'ontouchstart' in window / maxTouchPoints > 0 都可能成立，
// 但主输入仍是鼠标键盘，硬塞一个摇杆反而挡住画面、吃掉带键位的技能栏。
// 所以：只有主指针是粗指针（手指）的手机 / 平板才默认出摇杆，PC 一律走键盘。
// 调试与分享：?touch=1 强制触屏、?touch=0 强制键鼠；菜单里也可手动切并记住选择。
const TOUCH_ARG = (location.search.match(/[?&]touch=([^&]+)/) || [])[1];
const TOUCH_FORCE = TOUCH_ARG === '1' ? '1' : TOUCH_ARG === '0' ? '0' : null;
const INPUT_KEY = 'xy_input_mode';
const mq = q => { try { return matchMedia(q).matches; } catch (e) { return false; } };
function isTouchFirstDevice() {
  const ua = navigator.userAgent || '';
  const mobileUA = /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle|Windows Phone|HarmonyOS|BlackBerry|Opera Mini/i.test(ua);
  const canTouch = (navigator.maxTouchPoints || 0) > 0 || ('ontouchstart' in window);
  if (!canTouch) return false;
  // 主指针是手指（含 iPadOS 伪装成 Mac 的情况）
  if (mq('(pointer: coarse)')) return true;
  // 少数浏览器只报 hover / 不报 pointer，用移动端 UA 兜底
  return mobileUA && (mq('(hover: none)') || !mq('(pointer: fine)'));
}
let savedMode = null;
if (TOUCH_ARG === 'auto') {                 // ?touch=auto 抹掉手动偏好，回到自动识别
  try { localStorage.removeItem(INPUT_KEY); } catch (e) { }
} else {
  try { savedMode = localStorage.getItem(INPUT_KEY); } catch (e) { }
}
// URL 强制或用户手动选过之后，就不再被「最后一次输入」来回切
let inputLocked = TOUCH_FORCE === '1' || TOUCH_FORCE === '0'
  || savedMode === 'touch' || savedMode === 'keyboard';
const touch = {
  enabled: TOUCH_FORCE === '1' ? true
    : TOUCH_FORCE === '0' ? false
      : savedMode === 'touch' ? true
        : savedMode === 'keyboard' ? false
          : isTouchFirstDevice(),
  // 摇杆以「按下的位置」为圆心（不是死板固定在角落），手指落在左下热区任意处都能起杆
  stick: { on: false, id: -1, cx: 56, cy: 210, dx: 0, dy: 0, r: 30 },
};

const KEY_HINT = '天地任逍遥 · 第一章 青云野<br>'
  + 'WASD/方向键 移动 · J/空格 斩击 · K 剑气 · L 剑舞 · H 天雷<br>'
  + 'Shift 身法 · Q 回春丹 · T 道行 · Tab 行囊 · E 铁匠台 · R 御风';
const TOUCH_HINT = '天地任逍遥 · 第一章 青云野<br>'
  + '建议横屏 · 左下按住即出摇杆走位<br>'
  + '右侧「斩/气/舞/雷」出招 · 「闪」身法 · 「丹」回春<br>'
  + '「囊」「道」开面板 · 「谈」交互 · 「坐」打坐';
function refreshInputUI() {
  const hint = document.getElementById('ctrlHint');
  if (hint) hint.innerHTML = touch.enabled ? TOUCH_HINT : KEY_HINT;
  const sw = document.getElementById('btnCtrl');
  if (sw) sw.textContent = touch.enabled
    ? '当前：触屏摇杆 · 点此改用键鼠'
    : '当前：键盘鼠标 · 点此改用触屏摇杆';
  document.documentElement.classList.toggle('touch-mode', touch.enabled);
  fitPanels();   // 键鼠/触屏两套提示文案行数不同，面板高度会变，得重新适配
}
function setInputMode(mode, manual) {
  const next = mode === 'touch';
  if (manual) {
    inputLocked = true;
    try { localStorage.setItem(INPUT_KEY, next ? 'touch' : 'keyboard'); } catch (e) { }
  }
  if (touch.enabled === next) return;
  touch.enabled = next;
  if (!next) stickEnd();               // 收杆，免得切完人还在自己跑
  else clearKeys();                    // 切到摇杆时别留着没松开的键盘方向键
  refreshInputUI();
  resize();                           // 缩放策略 / 竖屏提示跟着换
}
function autoInput(kind) {
  if (inputLocked) return;
  setInputMode(kind === 'touch' ? 'touch' : 'keyboard', false);
}
// 混合设备兜底：最后用的是什么就切什么。
// 触屏本接上键盘 → 回键鼠；PC 触屏上真伸手点屏 → 出摇杆。
// capture 阶段先于画布的 pointerdown，所以「切模式的那一下」本身也能正常命中摇杆。
document.addEventListener('pointerdown', e => {
  if (e.target && e.target.id === 'btnCtrl') return;   // 手动切换按钮不参与自动判定
  if (e.pointerType === 'touch') autoInput('touch');
  else if (e.pointerType === 'mouse') autoInput('keyboard');
}, { capture: true, passive: true });
addEventListener('keydown', e => {
  if (e.isTrusted && !e.repeat) autoInput('keyboard');
}, { capture: true, passive: true });
// 设备形态变化（平板插鼠标 / 切桌面模式）时重新评估自动判定
try {
  const pm = matchMedia('(pointer: coarse)');
  const onPointerChange = () => { if (!inputLocked) setInputMode(isTouchFirstDevice() ? 'touch' : 'keyboard', false); };
  if (pm.addEventListener) pm.addEventListener('change', onPointerChange);
  else if (pm.addListener) pm.addListener(onPointerChange);
} catch (e) { }
refreshInputUI();
const STICK_HOT = { x0: 0, y0: 166, x1: 148, y1: 270 };

// 右侧动作键。位置按 480×270 逻辑坐标排，避开底部技能栏与右上小地图。
// 右下原先六个键挤在 380~462 / 158~238 的 82×80 方块里：按「半径 + 7 容错」算，
// 斩/气、气/舞、舞/雷、斩/丹、斩/雷 的命中圈互相盖住，手指落在交界处必然点串。
// 现在改成以「斩」为圆心的错落扇面：任意两键的容错圈都不相交（最小余量 4px），
// 且所有键都留在底部 HUD 条（y≥262）之上，不会被底板压掉半截。
const BTN_PAD = 6;
const TOUCH_BTNS = [
  { id: 'slash', label: '斩', x: 432, y: 196, r: 23, size: 14, run: () => attack(), cd: () => [player.atkCd, attackInterval()] },
  { id: 'qi', label: '气', x: 376, y: 168, r: 15, size: 12, run: () => castQi(), cd: () => [skills.qi.cd, skills.qi.max] },
  { id: 'wu', label: '舞', x: 372, y: 216, r: 15, size: 12, run: () => castWu(), cd: () => [skills.wu.cd, skills.wu.max] },
  { id: 'dash', label: '闪', x: 466, y: 146, r: 13, size: 11, run: () => dash(), cd: () => [player.dashCd, ACTIVES.dash.cd] },
  { id: 'pot', label: '丹', x: 466, y: 238, r: 13, size: 11, run: () => usePotion(), cd: () => [0, 0] },
  { id: 'thunder', label: '雷', x: 406, y: 244, r: 13, size: 11, run: () => castThunder(), cd: () => [skills.thunder.cd, skills.thunder.max] },
  // 上排面板键拉开到 40px 间距（容错圈 19+19=38），不再四连贴
  { id: 'talk', label: '谈', x: 336, y: 104, r: 13, size: 11, run: () => interact(), cd: () => [0, 0] },
  { id: 'sit', label: '坐', x: 376, y: 104, r: 13, size: 11, run: () => meditate(), cd: () => [meditateT, 0.9] },
  { id: 'bag', label: '囊', x: 416, y: 104, r: 13, size: 11, run: () => toggleInv(true), cd: () => [0, 0] },
  { id: 'dao', label: '道', x: 456, y: 104, r: 13, size: 11, run: () => toggleSkills(true), cd: () => [0, 0] },
];
function touchHit(p) {
  // 取「离圆心最近」的键，而不是数组里第一个：即使容错圈偶然相交，
  // 手指落在哪边就打哪边，主攻键不再把邻近小键全吃掉。
  let best = null, bestPen = Infinity;
  for (const b of TOUCH_BTNS) {
    if (!touchBtnVisible(b)) continue;
    const d = Math.hypot(p.x - b.x, p.y - b.y);
    const pad = b.id === 'slash' ? BTN_PAD + 2 : BTN_PAD;
    const pen = d - b.r;
    if (d <= b.r + pad && pen < bestPen) { best = b; bestPen = pen; }
  }
  return best;
}
// 土地庙（神龛）旁才能打坐，所以「坐」键平时不出现，走近才浮出来
function nearTemple() { return Math.hypot(player.x - SPAWN.x, player.y - SPAWN.y) < 56; }
function touchBtnVisible(b) {
  if (b.id === 'sit') return nearTemple();
  if (b.id === 'talk') return !!nearVillager() || !!nearShop() || nearNotice() || !!nearDg();
  return true;
}

// ============ 昼夜（S3 批次 A）============
// 开局定在午后偏晚（午时走了 2/3）。一日 14 分钟：约 2.4 分钟后黄昏、4.5 分钟后入夜，
// 玩家第一局不用等太久就能看见天色变化，也不至于刚出门就天黑。
const clock = new Clock(0.40, 1);
// 夜行怪：子时营地补怪优先出这些（阴物/飞禽/刺客），白天不出
const NIGHT_POOL = ['yinhun', 'crow', 'shadow', 'fukui'];
// 夜里的光源：{x,y,r,k,warm} 由营地/石灯/神龛/玩家动态收集
let lightSources = [];
function nightLuck() { return clock.isNight ? 40 : 0; }   // 夜间稀有率 +40%（作为 luck 百分比）
function dawnStrike() { return clock.isDawn ? 1.5 : 1; }  // 晨雾偷袭伤害倍率
let meditateT = 0;   // 打坐过场计时（>0 时压一层黑幕，同时也是"别重复报时辰"的标记）

// 光晕贴图：中心白 → 边缘全透明。
// 用 destination-out 从色罩上"挖"出光圈，比每帧新建 createRadialGradient 省得多。
const GLOW_C = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0.00, 'rgba(255,255,255,1)');
  gr.addColorStop(0.16, 'rgba(255,255,255,0.98)');
  gr.addColorStop(0.36, 'rgba(255,255,255,0.86)');
  gr.addColorStop(0.56, 'rgba(255,255,255,0.62)');
  gr.addColorStop(0.74, 'rgba(255,255,255,0.32)');
  gr.addColorStop(0.90, 'rgba(255,255,255,0.09)');
  gr.addColorStop(1.00, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return c;
})();
// 暖色灯光（叠在色罩之上，读作"灯是亮着的"）
const WARM_C = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0.00, 'rgba(255,214,150,1)');
  gr.addColorStop(0.35, 'rgba(255,168,88,0.55)');
  gr.addColorStop(0.70, 'rgba(226,108,48,0.16)');
  gr.addColorStop(1.00, 'rgba(180,70,30,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return c;
})();

// 色罩离屏层：整屏铺夜色 → 挖灯洞 → 一次性贴到「世界之上、HUD 之下」
const lightC = document.createElement('canvas');
lightC.width = LW; lightC.height = LH;
const lctx = lightC.getContext('2d');

function collectLights() {
  lightSources.length = 0;
  // 玩家自带一盏：这就是"夜间可视半径"，也是敢不敢夜里出门的底气
  lightSources.push({ x: player.x, y: player.y - 8, r: 82, k: 1, warm: 0 });
  // 洞里：只有火把和火盆。营地的篝火、村里的窗灯、铺子的招幌全在洞外，
  // 但把它们排掉不只是省几次 drawImage —— 它保证洞里没有"远处的光"可看。
  if (dgIn(player.x, player.y)) {
    lightSources[0].r = 112; lightSources[0].warm = 1;
    for (const o of dgObjs) {
      if (o.kind === 'brazier') lightSources.push({ x: o.x, y: o.y - 12, r: 70, k: 0.86, warm: 1 });
      else if (o.kind === 'rift') lightSources.push({ x: o.x, y: o.y - 8, r: 46, k: 0.55, warm: 0 });
    }
    return;
  }
  for (const c of camps) lightSources.push({ x: c.x, y: c.y, r: 64, k: 0.95, warm: 1 });
  for (const o of objects) {
    if (o.kind === 'lantern') lightSources.push({ x: o.x, y: o.y - 8, r: 42, k: 0.72, warm: 1 });
    else if (o.kind === 'shrine') lightSources.push({ x: o.x, y: o.y - 10, r: 58, k: 0.8, warm: 1 });
  }
  // 铺子的窗灯 = 营业信号。打烊就没灯，玩家在街口一望便知今晚哪家还开着。
  for (const id in SHOPS) {
    if (!shopOpenNow(id)) continue;
    const s = SHOPS[id];
    lightSources.push({ x: s.x, y: s.y - 12, r: 56, k: 0.88, warm: 1 });
  }
}

// 时辰光罩。a=0 的白天直接在函数开头返回，零开销。
function drawDayNight(camX, camY) {
  // 洞里不看天时。白天进洞、夜里进洞，看到的是同一片黑 ——
  // 否则玩家会拿"外面的光"当路标，地宫的空间感立刻散掉。
  const inDg = dgIn(player.x, player.y);
  const L = inDg ? DG_DARK : clock.light;
  const totalA = inDg ? DG_DARK.a : Math.min(0.74, L.a);
  if (totalA < 0.006) return;

  lctx.setTransform(1, 0, 0, 1, 0, 0);
  lctx.globalCompositeOperation = 'source-over';
  lctx.globalAlpha = 1;
  lctx.clearRect(0, 0, LW, LH);
  lctx.fillStyle = 'rgba(' + L.r + ',' + L.g + ',' + L.b + ',' + totalA.toFixed(3) + ')';
  lctx.fillRect(0, 0, LW, LH);

  // 只有真暗下来才挖灯洞 —— 白天挖会显得画面脏
  const lit = Math.max(0, Math.min(1, (L.a - 0.16) / 0.34));
  if (lit > 0.01) {
    collectLights();
    lctx.globalCompositeOperation = 'destination-out';
    for (const s of lightSources) {
      const sx = s.x - camX, sy = s.y - camY;
      if (sx < -s.r * 2 || sy < -s.r * 2 || sx > LW + s.r * 2 || sy > LH + s.r * 2) continue;
      // 火苗呼吸：两个不同频率叠加，看起来才不是死循环的正弦
      const flick = 0.90 + Math.sin(time * 2.6 + s.x * 0.07) * 0.07 + Math.sin(time * 7.1 + s.y * 0.05) * 0.035;
      const rr = s.r * flick;
      lctx.globalAlpha = Math.max(0, Math.min(1, s.k * lit * 0.98));
      lctx.drawImage(GLOW_C, sx - rr, sy - rr, rr * 2, rr * 2);
    }
    lctx.globalCompositeOperation = 'source-over';
    lctx.globalAlpha = 1;
  }
  octx.drawImage(lightC, 0, 0);

  // 暖色灯光本身：叠在色罩之上，否则灯只会"透"不会"亮"
  if (lit > 0.02) {
    octx.save();
    octx.globalCompositeOperation = 'lighter';
    for (const s of lightSources) {
      if (!s.warm) continue;
      const sx = s.x - camX, sy = s.y - camY;
      const rr = s.r * 1.15;
      if (sx < -rr || sy < -rr || sx > LW + rr || sy > LH + rr) continue;
      octx.globalAlpha = 0.17 * lit * s.k;
      octx.drawImage(WARM_C, sx - rr, sy - rr, rr * 2, rr * 2);
    }
    octx.restore();
  }

  // 晨雾的纵深：均匀色罩只会让画面变灰，真正读作"雾"的是"近处清楚、远处糊"。
  // 一层中心透明、四周偏白的径向渐变，慢慢起伏，就够了。
  if (clock.isDawn) {
    const breathe = 0.72 + Math.sin(time * 0.35) * 0.16 + Math.sin(time * 0.13) * 0.12;
    const fa = 0.30 * breathe;
    const cx = LW / 2, cy = LH / 2;
    const gr = octx.createRadialGradient(cx, cy, LH * 0.22, cx, cy, LW * 0.74);
    gr.addColorStop(0, 'rgba(206,224,228,0)');
    gr.addColorStop(0.55, 'rgba(198,216,222,' + (fa * 0.42).toFixed(3) + ')');
    gr.addColorStop(1, 'rgba(190,210,218,' + fa.toFixed(3) + ')');
    octx.fillStyle = gr;
    octx.fillRect(0, 0, LW, LH);
  }
}

// 打坐：土地庙前调息，把时间推到下一时辰。
// 它是这轮昼夜系统的"节奏器"—— 天黑打不过，就地打坐熬过去；想占晨雾的便宜，也靠它跳到卯时。
function meditate() {
  if (state !== 'play') return;
  if (meditateT > 0) return;
  if (Math.hypot(player.x - SPAWN.x, player.y - SPAWN.y) > 56) {
    msg('须在土地庙前打坐', C.paper1);
    return;
  }
  const before = clock.phase;
  const p = clock.skipToNext();
  clock.changed = 0;          // 自己已经报过，别让 update 再播一次钟
  meditateT = 0.9;
  player.qi = maxQi();
  player.hp = Math.min(maxHp(), player.hp + maxHp() * 0.25);
  msg('打坐 · ' + before.name + ' → ' + p.name + '·' + p.sub, p.color);
  AUDIO.play('bell', p.id);
}

// ============ 属性 ============
let _stats = null;
function computeStats() {
  const sk = computeSkillStats(player.skillLv);
  const s = {
    atk: player.atkBase, def: 0, hp: player.maxHpBase,
    crit: 5, critDmg: 150, spd: 0, cdr: 0, lifesteal: 0, luck: 0,
    atkSpd: 0, qiMax: 60, qiRegen: 4, skillDmg: 0, comboPct: 0, qiOnHit: 0, dmgReduce: 0,
  };
  for (const slot of SLOTS) {
    const it = player.equip[slot];
    if (!it) continue;
    const g = gearStats(it);
    s.atk += g.atk; s.def += g.def; s.hp += g.hp;
    s.crit += g.crit; s.critDmg += g.critDmg; s.spd += g.spd; s.cdr += g.cdr;
    s.lifesteal += g.lifesteal; s.luck += g.luck; s.atkSpd += g.atkSpd;
    s.qiMax += g.qiMax; s.qiRegen += g.qiRegen; s.skillDmg += g.skillDmg;
    s.comboPct += g.comboPct; s.qiOnHit += g.qiOnHit;
  }
  s.atk = Math.round(s.atk * (1 + sk.atkPct / 100));
  s.hp = Math.round(s.hp * (1 + sk.hpPct / 100));
  s.crit += sk.crit; s.critDmg += sk.critDmg; s.spd += sk.spd; s.atkSpd += sk.atkSpd;
  s.lifesteal += sk.lifesteal; s.luck += sk.luck; s.qiMax += sk.qiMax * 4;
  s.qiRegen += sk.qiRegen; s.skillDmg += sk.skillDmg; s.comboPct += sk.comboPct;
  s.qiOnHit += sk.qiOnHit; s.dmgReduce += sk.dmgReduce;
  return s;
}
function stats() { if (!_stats) _stats = computeStats(); return _stats; }
function invalidateStats() { _stats = null; }
function maxHp() { return stats().hp; }
function maxQi() { return stats().qiMax; }
function comboMult() {
  const s = stats();
  return 1 + Math.min(combo, 120) * 0.0065 * (1 + Math.max(0, s.comboPct) / 100);
}
function comboRank() {
  if (combo >= 80) return { name: '无双', color: C.gold3 };
  if (combo >= 50) return { name: '杀意', color: C.red3 };
  if (combo >= 25) return { name: '凌厉', color: C.jade3 };
  if (combo >= 10) return { name: '锋芒', color: C.paper3 };
  return null;
}
function weaponFam() {
  const w = player.equip.weapon;
  return w && w.fam && WEAPONS[w.fam] ? w.fam : 'sword';
}
function attackInterval() {
  const W = WEAPONS[weaponFam()];
  return Math.max(0.13, 0.30 * W.spdMul / (1 + Math.min(70, stats().atkSpd) / 100));
}

// ============ 敌手 ============
function spawnEnemy(type, x, y, camp, eliteMod) {
  // 青云集界内不落敌
  if (inVillage(x, y, 24)) {
    const cx = camp ? camp.x : SPAWN.x, cy = camp ? camp.y : SPAWN.y;
    x = cx + (Math.random() * 40 - 20); y = cy + (Math.random() * 40 - 20);
    if (inVillage(x, y, 24)) return null;
  }
  const s = MONSTERS[type] || MONSTERS.zhiren;
  const scale = 1 + 0.2 * (player.level - 1);
  let hp = s.hp * scale, dmg = s.dmg * scale, cd = s.cd, def = s.def || 0, ls = s.lifesteal || 0, spd = s.speed;
  if (eliteMod) {
    hp *= eliteMod.hp; dmg *= eliteMod.dmg; cd *= eliteMod.cd;
    def = Math.min(0.6, def + (eliteMod.def || 0)); ls = eliteMod.ls || ls;
    spd *= eliteMod.spdMul || 1;
  }
  const art = monTex[type] || monTex.zhiren;
  const e = {
    type, x, y, hp, maxHp: hp, dmg, def, ls, cd, cdMax: cd, speed: spd,
    flash: 0, aggro: false, wanderT: 0, wx: 0, wy: 0, camp, dead: false,
    // 交战计时：受击/出手时刷新，用来判断「首领血条该不该还挂着」。
    // 以前血条条件是 aggro || hp<maxHp —— aggro 一旦为真就再不复位（洞里的怪
    // 压根没有"退回营地"这条分支），hp<maxHp 更是永远成立，于是打死一波之后
    // 血条就长在屏幕上了。改成按"最近有没有交过手"来判断。
    combatT: 0,
    anim: Math.random() * 2, windup: 0, strike: false, elite: eliteMod || null,
    blinkCd: 1 + Math.random() * 2, spinCd: 6, spinWind: 0, phase2: false, hitJit: 0,
    stagger: 0, kvx: 0, kvy: 0, charge: 0, chx: 0, chy: 0, h: art.size[1],
  };
  e.mesh = quad(art.frames[0], art.size[0], art.size[1]);
  e.shadow = quad(SHADOW_TEX, art.size[0] * 0.95, art.size[1] * 0.3);
  e.shadow.renderOrder = 990;
  if (eliteMod) {
    e.ring = quad(tex(RING_C), art.size[0] + 10, art.size[1] + 10);
    e.ring.material.color.set(eliteMod.color);
    e.ring.material.opacity = 0.75;
  }
  enemies.push(e);
  return e;
}
function seedCamps() {
  for (const c of camps) {
    const n = 4 + (c.tier - 1);
    for (let i = 0; i < n; i++) {
      const t = c.types[i % c.types.length];
      const a = i / n * Math.PI * 2;
      spawnEnemy(t, c.x + Math.cos(a) * 36, c.y + Math.sin(a) * 36, c);
    }
  }
  spawnEnemy('treant', TREANT_POS.x, TREANT_POS.y, { x: TREANT_POS.x, y: TREANT_POS.y });
  if (!cleared) spawnEnemy('boss', ALTAR.x, ALTAR.y, ALTAR);
}
function msg(txt, color) { messages.push({ txt, color: color || C.paper3, t: 2.4 }); if (messages.length > 3) messages.shift(); }
function dmgNum(x, y, txt, color, big) {
  dmgNums.push({ x, y, txt, color, t: big ? 0.95 : 0.72, max: big ? 0.95 : 0.72, big: !!big, vx: (Math.random() - 0.5) * 14 });
}

// ============ 打击感特效 ============
function burst(x, y, color, n, spd) {
  for (let i = 0; i < n; i++) {
    if (particles.length > 220) break;
    const a = Math.random() * Math.PI * 2;
    const v = spd * (0.35 + Math.random() * 0.9);
    particles.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 18,
      t: 0.34 + Math.random() * 0.3, max: 0.64, color, size: 2 + ((Math.random() * 3) | 0), mesh: null,
    });
  }
}
function bloodBurst(x, y, ang, n) {
  for (let i = 0; i < n; i++) {
    if (particles.length > 220) break;
    const a = ang + (Math.random() - 0.5) * 1.1;
    const v = 70 + Math.random() * 90;
    particles.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 24,
      t: 0.26 + Math.random() * 0.22, max: 0.48,
      color: Math.random() < 0.6 ? C.red2 : C.red1, size: 2 + ((Math.random() * 2) | 0), mesh: null,
    });
  }
}
function spark(x, y, crit) {
  const m = quad(tex(SPARK_C), crit ? 20 : 12, crit ? 20 : 12);
  m.material.color.set(crit ? C.gold3 : C.white);
  sparks.push({ x, y, t: crit ? 0.26 : 0.16, max: crit ? 0.26 : 0.16, mesh: m, crit });
}
function afterimage(x, y, texRef, w, h) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: texRef, transparent: true, opacity: 0.42, depthTest: false, depthWrite: false, side: THREE.DoubleSide }));
  scene.add(m);
  m.position.set(x, y, 0);
  ghosts.push({ x, y, t: 0.22, mesh: m });
}

// ============ 战斗 ============
function rollDamage(mul, opt) {
  const s = stats();
  const comboCrit = Math.min(14, combo * 0.14);
  const crit = Math.random() * 100 < Math.min(80, s.crit + comboCrit + ((opt && opt.critAdd) || 0));
  let dmg = s.atk * (0.9 + Math.random() * 0.2) * mul * comboMult();
  // 酒不是回血道具，是"敢不敢现在出门"的赌注：伤害上去了，判断力没上去
  if (player.drunkT > 0 && player.drunk) dmg *= 1 + player.drunk;
  if (opt && opt.skill) dmg *= 1 + s.skillDmg / 100 + ((opt.skillDmg) || 0);
  if (crit) dmg *= s.critDmg / 100;
  return { dmg: Math.max(1, Math.round(dmg)), crit };
}
function hitEnemy(e, info, ang, kb) {
  const s = stats();
  const def = Math.min(0.7, e.def || 0);
  // 晨雾偷袭：还没察觉你的怪，第一下 ×1.5 —— 卯时是清营地最划算的时候
  const sneak = clock.isDawn && !e.aggro;
  const mul = sneak ? dawnStrike() : 1;
  const dmg = Math.max(1, Math.round(info.dmg * mul * (1 - def)));
  e.hp -= dmg;
  e.combatT = 4;   // 挨了打就算在交战，首领血条要亮着
  e.flash = 0.16; e.hitJit = 0.2; e.stagger = Math.max(e.stagger, info.crit ? 0.16 : 0.09);
  const kbm = (e.elite ? 0.55 : 1) * (e.type === 'boss' ? 0.1 : e.type === 'treant' ? 0.25 : 1) * (e.type === 'shigan' ? 0.25 : 1);
  e.kvx += Math.cos(ang) * kb * kbm * 4;
  e.kvy += Math.sin(ang) * kb * kbm * 4;
  hitstop = Math.max(hitstop, info.crit ? 0.1 : Math.min(0.075, 0.028 + dmg * 0.0006));
  shakeX += Math.cos(ang) * (info.crit ? 2.4 : 1.1);
  shakeY += Math.sin(ang) * (info.crit ? 2.4 : 1.1);
  if (info.crit) player.hurtFlash = Math.max(player.hurtFlash, 0.06);
  combo++; comboT = 2.2; comboPulse = 1;
  dmgNum(e.x, e.y - e.h * 0.95,
    (sneak ? '偷袭 ' : info.crit ? '会心 ' : '') + dmg,
    sneak ? C.jade3 : info.crit ? C.gold3 : C.paper3,
    info.crit || sneak);
  const hx = e.x + Math.cos(ang) * 5, hy = e.y - e.h / 2 + Math.sin(ang) * 3;
  spark(hx, hy, info.crit);
  burst(hx, hy, info.crit ? C.gold3 : C.paper3, info.crit ? 10 : 4, info.crit ? 100 : 55);
  bloodBurst(hx, hy, ang, info.crit ? 8 : 4);
  AUDIO.play(info.crit ? 'crit' : 'hit', dmg);
  player.qi = Math.min(maxQi(), player.qi + 3 + s.qiOnHit);
  if (s.lifesteal > 0) {
    const heal = Math.max(1, Math.round(dmg * s.lifesteal / 100));
    player.hp = Math.min(maxHp(), player.hp + heal);
    dmgNum(player.x + (Math.random() * 8 - 4), player.y - 18, '+' + heal, C.jade3);
  }
  if (e.hp <= 0) killEnemy(e);
  return dmg;   // 返回实际伤害：自动化测试要拿它验证偷袭/减伤，运行时不依赖
}
function hurtPlayer(d) {
  if (player.dashT > 0 || player.iframe > 0) { dmgNum(player.x, player.y - 16, '闪避', C.jade3); return; }
  const s = stats();
  let real = d * 22 / (22 + s.def);
  real *= 1 - Math.min(60, s.dmgReduce) / 100;
  real = Math.max(1, Math.round(real));
  if (player.shield > 0) {
    const ab = Math.min(player.shield, real);
    player.shield -= ab; real -= ab;
    dmgNum(player.x, player.y - 20, '罡气 -' + ab, C.jade3);
    if (real <= 0) { AUDIO.play('shield'); return; }
  }
  player.hp -= real; player.flash = 0.24; player.iframe = 0.62;
  shakeX += (Math.random() - 0.5) * 4; shakeY += 2.5;
  player.hurtFlash = 0.18;
  dmgNum(player.x, player.y - 16, '-' + real, C.red3, true);
  burst(player.x, player.y - 8, C.red2, 8, 70);
  AUDIO.play('hurt');
  if (player.hp <= 0) { player.hp = 0; showDead(); }
}
// 法杖 / 暗器的普攻：把弹体塞进现有 projectiles，命中、飞行、穿怪都复用同一套。
// 不消耗真气（那是「剑气」技能的定位），伤害走普攻倍率与连击加成。
function fireWeaponProj(fam, cfg, sw) {
  const W = WEAPONS[fam];
  const [fx, fy] = DIRV[player.dir];
  const a0 = Math.atan2(fy, fx);
  const n = cfg.count || 1;
  const baseDmg = rollDamage(sw.mul * (cfg.dmgMul || 1));
  for (let i = 0; i < n; i++) {
    const ang = a0 + (n === 1 ? 0 : (i / (n - 1) - 0.5) * (cfg.spread || 0));
    const mesh = quad(cfg.kind === 'dart' ? DART_TEX : QI_TEX, cfg.size || 8, cfg.size || 8);
    mesh.material.color.set(W.trail[0]);
    if (cfg.kind !== 'dart') mesh.material.blending = THREE.AdditiveBlending;
    projectiles.push({
      x: player.x + Math.cos(ang) * 10, y: player.y - 8 + Math.sin(ang) * 10,
      vx: Math.cos(ang) * (cfg.speed || 220), vy: Math.sin(ang) * (cfg.speed || 220),
      t: cfg.life || 0.85, friendly: true,
      dmg: baseDmg.dmg, crit: baseDmg.crit,
      pierce: cfg.pierce || 1, mesh, hitSet: new Set(),
      spin: cfg.kind === 'dart' ? 14 : 0,
    });
  }
  burst(player.x + fx * 12, player.y - 8 + fy * 12, W.trail[0], n > 1 ? 6 : 3, 45);
}

function attack() {
  if (state !== 'play') return;
  if (player.atkCd > 0) { player.atkBuf = 0.26; return; }
  const fam = weaponFam(), W = WEAPONS[fam];
  const list = W.swings;
  if (time - player.lastAtkT < 0.85) player.atkStep = (player.atkStep + 1) % list.length;
  else player.atkStep = 0;
  const sw = list[player.atkStep];
  player.lastAtkT = time;
  player.atkCd = attackInterval();
  player.atkBuf = 0;
  player.atkT = sw.dur; player.lunge = sw.lunge;
  const base = DIRA[player.dir];
  player.swing = { fam, step: player.atkStep, base, sw, t: sw.dur, dur: sw.dur };
  AUDIO.play('slash', fam);

  if (W.ranged && sw.proj) { fireWeaponProj(fam, sw.proj, sw); return; }

  const reach = (sw.reach || W.reach);
  const halfArc = sw.hitArc / 2;
  const hits = sw.hits || W.hits || 1;
  for (const e of enemies) {
    if (e.dead) continue;
    const px = player.x, py = player.y - 8;
    const dx = e.x - px, dy = (e.y - e.h * 0.5) - py, d = Math.hypot(dx, dy);
    if (d > reach + e.h * 0.4) continue;
    const diff = Math.abs(((Math.atan2(dy, dx) - base + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    if (halfArc < Math.PI - 0.05 && diff > halfArc && d > 15) continue;
    for (let k = 0; k < hits; k++) hitEnemy(e, rollDamage(sw.mul), Math.atan2(dy, dx), sw.kb);
  }
  if (sw.shock) {
    shakeX += 2; shakeY += 3;
    burst(player.x + Math.cos(base) * 18, player.y - 4 + Math.sin(base) * 10, C.gold2, 14, 90);
  }
}
function killEnemy(e) {
  e.dead = true; scene.remove(e.mesh); if (e.ring) scene.remove(e.ring); if (e.shadow) scene.remove(e.shadow);
  const m = MONSTERS[e.type];
  player.kills = (player.kills || 0) + 1;
  player.xp += m.xp;
  dmgNum(e.x, e.y - e.h - 6, '+' + m.xp + '历练', C.paper3);
  const cols = [C.paper2, C.red2, C.ink3];
  for (let i = 0; i < (e.elite ? 4 : 2); i++) burst(e.x, e.y - e.h / 2, cols[i % 3], 10, 90);
  if (e.elite) burst(e.x, e.y - e.h / 2, e.elite.color, 16, 110);
  AUDIO.play('die');
  dropLoot(e);
  // 侠名只用"值得说的事"来加：杀十只野狗不会让人记住你，斩一个寨主会。
  if (e.type === 'boss' || e.type === 'treant') addFame(8);
  else if (e.elite) addFame(2);
  while (player.xp >= player.level * 42) {
    player.xp -= player.level * 42; player.level++;
    player.maxHpBase += 15; player.atkBase += 2; player.skillPts++;
    invalidateStats();
    player.hp = maxHp(); player.qi = maxQi();
    msg('境界提升 · ' + realm() + '　（得参悟点 1，按 T 参悟）', C.gold3);
    AUDIO.play('levelup');
    renderSkills();
  }
  if (e.type === 'boss' && !e.dg) {
    cleared = true; state = 'clear';
    document.getElementById('clear').classList.remove('hidden');
    save();
  } else if (e.type === 'boss') {
    // 洞主：不通关，只在洞里兑现（清层 → 开箱）
    msg('洞主伏诛 · 石胎碎了一地', C.gold3);
  } else if (e.type === 'treant') {
    msg('千年树妖伏诛 · 天材地宝现世', C.gold3);
    for (let i = 0; i < 2; i++) addDrop('gear', makeGear(SLOTS[(Math.random() * 4) | 0], 3 + ((Math.random() * 2) | 0), player.level + 2));
  }
}

// ============ 行囊容量 ============
// 20 格起步，可花银两扩到 60。
// 以前容量 20 是散在各处写死的：拾取会挡，但卸下 / 买药 / 调试发装备这些入口没挡，
// 超出的照样 push 进数组，而 renderInv 只画前 20 格 —— 于是「满了还能捡」，
// 等消耗掉几件之后，那些看不见的装备才「冒出来」。现在统一走 invFull()。
const INV_BASE = 20, INV_STEP = 10, INV_MAX = 60;
const INV_COST = [600, 1500, 3600, 8000];   // 每扩一行（+10 格）的价钱
function invMax() { return Math.min(INV_MAX, player.invMax || INV_BASE); }
function invFull() { return player.inv.length >= invMax(); }
function expandCost() {
  const n = Math.round((invMax() - INV_BASE) / INV_STEP);
  return n < INV_COST.length ? INV_COST[n] : Infinity;
}
function expandInv() {
  if (invMax() >= INV_MAX) { msg('行囊已是最大 ' + INV_MAX + ' 格', C.paper1); return; }
  const c = expandCost();
  if (player.gold < c) { msg('银两不足 · 扩充需 ' + c, C.red3); return; }
  player.gold -= c;
  player.invMax = invMax() + INV_STEP;
  AUDIO.play('equip');
  msg('行囊扩充至 ' + player.invMax + ' 格', C.jade3);
  renderInv();
}

// ============ 掉落 ============
function addDrop(kind, item, x, y) {
  const d = {
    x: x !== undefined ? x : player.x + (Math.random() * 14 - 7),
    y: y !== undefined ? y : player.y - 6,
    kind, item, t: Math.random() * 6, mesh: null, beam: null,
  };
  if (kind === 'gear') {
    const rr = RARITY[item.r];
    d.beamColor = rr.color;
    // 仙品 / 传世兵器：地面光柱更粗更高，overlay 里再补一圈品阶光环
    d.epic = item.kind === 'weapon' && item.r >= 3;
  }
  drops.push(d);
  return d;
}
// 八类兵器后，四槽等概率会让「刷到新武器」变成稀罕事：兵器权重提到 40%。
function rollDropSlot() {
  const w = [40, 20, 20, 20];
  let r = Math.random() * 100, acc = 0;
  for (let i = 0; i < SLOTS.length; i++) { acc += w[i]; if (r <= acc) return SLOTS[i]; }
  return 'weapon';
}
function dropLoot(e) {
  const luck = stats().luck;
  const tier = e.type === 'boss' || e.type === 'treant' ? 2 : (e.elite ? 1 : 0);
  const ilvl = Math.max(1, player.level + (tier === 2 ? 2 : tier === 1 ? 1 : 0) + ((Math.random() * 2) | 0));
  const coinN = tier === 2 ? 4 : e.elite ? 2 : 1;
  for (let i = 0; i < coinN; i++) {
    addDrop('coin', 3 + ((Math.random() * 7) | 0) + (e.elite ? 5 : 0) + (tier === 2 ? 34 : 0));
  }
  if (tier === 2 || Math.random() < (e.elite ? 0.85 : 0.22)) {
    addDrop('potion', { kind: 'potion', name: '回春丹', heal: 40, r: 0 });
  }
  const chance = tier === 2 ? 1 : e.elite ? 0.85 : 0.17;
  const count = tier === 2 ? 3 : (Math.random() < chance ? 1 : 0);
  for (let i = 0; i < count; i++) {
    let r = rollRarity(luck + nightLuck(), tier);
    if (tier === 2 && i === 0) r = Math.max(2, r);
    // Boss 首件必为兵器，方便看见新的法杖 / 暗器与稀有造型
    const slot = (tier === 2 && i === 0) ? 'weapon' : rollDropSlot();
    const it = makeGear(slot, r, ilvl);
    addDrop('gear', it);
    if (r >= 3) { AUDIO.play('rare'); msg('掉落 ' + RARITY[r].name + ' · ' + it.name, RARITY[r].color); }
  }
  // 精英 / Boss 追加一件兵器：八类兵器的掉落面铺开，不至于全靠铁匠台
  if (tier >= 1 && (tier === 2 || Math.random() < 0.35)) {
    const it = makeGear('weapon', Math.max(1, rollRarity(luck + nightLuck(), tier)), ilvl);
    addDrop('gear', it, e.x + 10, e.y);
    if (it.r >= 3) msg('掉落 ' + RARITY[it.r].name + ' · ' + it.name, RARITY[it.r].color);
  }
}

// ============ 技能 ============
function skillModSum(key) { return computeSkillStats(player.skillLv)[key] || 0; }
function castQi() {
  if (state !== 'play') return;
  if (skills.qi.cd > 0) return;
  if (player.qi < ACTIVES.qi.cost) { msg('真气不足', C.jade3); return; }
  const s = stats();
  player.qi -= ACTIVES.qi.cost;
  const cdr = Math.min(45, s.cdr) / 100;
  skills.qi.max = ACTIVES.qi.cd * (1 - cdr); skills.qi.cd = skills.qi.max;
  const lv = nodeLevel(player.skillLv, 'yuqi');
  const dmg = Math.round(s.atk * 1.3 * (1 + s.skillDmg / 100 + lv * 0.22));
  const [fx, fy] = DIRV[player.dir];
  const mesh = quad(QI_TEX, 8, 8);
  mesh.material.color.set(WEAPONS[weaponFam()].trail[0]);
  projectiles.push({
    x: player.x + fx * 12, y: player.y - 8 + fy * 12, vx: fx * 210, vy: fy * 210,
    t: 0.85, friendly: true, dmg, pierce: 2 + lv, mesh, hitSet: new Set(),
  });
  player.swing = { fam: weaponFam(), base: DIRA[player.dir], sw: { mode: 'thrust', a0: 0, a1: 0, dur: 0.18 }, t: 0.18, dur: 0.18, cast: true };
  AUDIO.play('qi');
}
function castWu() {
  if (state !== 'play') return;
  if (skills.wu.cd > 0) return;
  if (player.qi < ACTIVES.wu.cost) { msg('真气不足', C.jade3); return; }
  const s = stats();
  player.qi -= ACTIVES.wu.cost;
  const cdr = Math.min(45, s.cdr) / 100;
  skills.wu.max = ACTIVES.wu.cd * (1 - cdr); skills.wu.cd = skills.wu.max;
  wuT = 0.34;
  const lvW = nodeLevel(player.skillLv, 'wanjian');
  const lvR = nodeLevel(player.skillLv, 'jianzhen');
  const radius = 38 * (1 + lvR * 0.16);
  const dmg = Math.round(s.atk * 1.6 * (1 + s.skillDmg / 100) * (1 + lvW * 0.22));
  AUDIO.play('wu');
  hitstop = Math.max(hitstop, 0.06);
  shakeX += 3; shakeY += 3;
  burst(player.x, player.y - 8, C.gold3, 18, 110);
  for (const e of enemies) {
    if (e.dead) continue;
    const dx = e.x - player.x, dy = e.y - player.y, d = Math.hypot(dx, dy);
    if (d < radius + e.h * 0.3) hitEnemy(e, { dmg, crit: Math.random() * 100 < s.crit }, Math.atan2(dy, dx), 16);
  }
}
function castThunder() {
  if (state !== 'play') return;
  if (nodeLevel(player.skillLv, 'tianlei') < 1) { msg('尚未参悟「天雷诀」（按 T 开道行）', C.paper1); return; }
  if (skills.thunder.cd > 0) return;
  if (player.qi < ACTIVES.thunder.cost) { msg('真气不足', C.jade3); return; }
  const s = stats();
  player.qi -= ACTIVES.thunder.cost;
  const cdr = Math.min(45, s.cdr) / 100;
  skills.thunder.max = ACTIVES.thunder.cd * (1 - cdr); skills.thunder.cd = skills.thunder.max;
  const lv = nodeLevel(player.skillLv, 'tianlei');
  const dmg = Math.round(s.atk * 2.1 * (1 + s.skillDmg / 100) * (1 + (lv - 1) * 0.35));
  // 优先劈最近的敌人，没有则劈身前
  const list = enemies.filter(e => !e.dead && Math.hypot(e.x - player.x, e.y - player.y) < 150)
    .sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y));
  const targets = list.slice(0, 1 + lv);
  if (!targets.length) {
    const [fx, fy] = DIRV[player.dir];
    bolts.push({ x: player.x + fx * 34, y: player.y + fy * 34 - 6, t: 0.3, dmg, r: 32, done: false });
  } else {
    targets.forEach((e, i) => bolts.push({ x: e.x, y: e.y - e.h * 0.4, t: 0.26 + i * 0.08, dmg, r: 32, done: false }));
  }
  AUDIO.play('thunder');
  msg('天雷诀 · 引', C.gold3);
}
function dash() {
  if (state !== 'play' || player.dashCd > 0) return;
  const s = stats();
  player.dashT = 0.18; player.dashCd = 0.9 * (1 - Math.min(40, s.cdr) / 100); player.iframe = 0.26;
  const gang = nodeLevel(player.skillLv, 'gangqi');
  if (gang > 0) {
    player.shield = Math.max(player.shield, Math.round(maxHp() * 0.08 * gang));
    dmgNum(player.x, player.y - 20, '罡气', C.jade3);
  }
  afterimage(player.x, player.y - 8, playerTex[player.dir][0], 16, 18);
  AUDIO.play('dash');
}
function usePotion() {
  // 药有四种：回春丹/大还丹/清心散…按"最先能起作用的"挑一颗，别让满血时白白吃掉解毒散
  let i = player.inv.findIndex(it => it.kind === 'potion' && (it.heal || 0) > 0 && player.hp < maxHp());
  if (i < 0) i = player.inv.findIndex(it => it.kind === 'potion' && it.cure && player.poisonT > 0);
  if (i < 0) i = player.inv.findIndex(it => it.kind === 'potion');
  if (i < 0) { msg('没有丹药', C.paper1); return; }
  const it = player.inv[i];
  const heal = Math.max(0, Math.min(it.heal || 45, maxHp() - player.hp) || 0);
  if (heal <= 0 && !(it.cure && player.poisonT > 0)) { msg('气血已满', C.paper1); return; }
  player.inv.splice(i, 1);
  if (heal > 0) { player.hp += heal; dmgNum(player.x, player.y - 18, '+' + heal, C.jade3); }
  if (it.cure) {
    player.poison = 0; player.poisonT = 0; player.poisonImmuneT = 30;
    msg('毒已清净', C.jade3);
  }
  AUDIO.play('pickup');
  renderInv();
}
function windStep() {
  if (state !== 'play' || player.windCd > 0) return;
  player.windCd = 3;
  burst(player.x, player.y - 6, C.jade3, 12, 70);
  player.x = SPAWN.x; player.y = SPAWN.y;
  msg('御风 · 归土地庙', C.jade3);
  AUDIO.play('dash');
}
function pickup(d) {
  if (d.kind === 'coin') {
    player.gold += d.item;
    dmgNum(player.x, player.y - 16, '+' + d.item + '银两', C.gold3);
    AUDIO.play('coin');
    return true;
  }
  if (invFull()) { msg('行囊已满 · 可花银两扩充', C.red3); return false; }
  if (d.kind === 'gear') {
    player.inv.push(d.item);
    msg('拾取 ' + RARITY[d.item.r].name + ' · ' + d.item.name, RARITY[d.item.r].color);
    AUDIO.play(d.item.r >= 2 ? 'rare' : 'pickup');
  } else {
    player.inv.push(d.item);
    msg('拾取 ' + d.item.name, C.paper3);
    AUDIO.play('pickup');
  }
  renderInv();
  return true;
}

// ============ 行囊 / 装备栏 UI ============
const invEl = document.getElementById('inv');
const tipEl = document.getElementById('tip');
let tipItem = null;
let equipDrag = null;
// 上一次指针是鼠标还是手指。触摸屏上 pointerdown 之后浏览器会补一串
// mouseenter/mouseover（模拟鼠标），光看事件类型分不出来，得自己记。
let lastPointerType = 'mouse';
addEventListener('pointerdown', e => { lastPointerType = e.pointerType || 'mouse'; }, true);
// 手指点空白处收起 tooltip（点在格子上不算，那个由格子自己处理）
addEventListener('pointerdown', e => {
  if (!tipEl || tipEl.style.display !== 'block') return;
  if (e.target && e.target.closest && e.target.closest('.slot[data-i], .eq')) return;
  hideTip();
}, true);

function statRows(it) {
  const m = 1 + (it.enh || 0) * 0.14;
  const rows = [];
  const atk = Math.round(it.b.atk * m) + (it.enh || 0);
  const def = Math.round(it.b.def * m) + (it.enh || 0);
  const hp = Math.round(it.b.hp * m) + (it.enh || 0) * 4;
  if (atk) rows.push(['攻击', atk]);
  if (def) rows.push(['防御', def]);
  if (hp) rows.push(['气血', hp]);
  if (it.b.qiMax) rows.push(['真气', Math.round(it.b.qiMax * m) + (it.enh || 0)]);
  if (it.b.skillDmg) rows.push(['术法', Math.round(it.b.skillDmg * m) + '%']);
  for (const a of it.affixes) {
    const label = STAT_LABEL[a.stat] || a.stat;
    rows.push([a.name + '·' + label, a.val + (['critDmg', 'skillDmg', 'comboPct', 'spd', 'atkSpd', 'crit', 'lifesteal', 'cdr', 'qiRegen'].indexOf(a.stat) >= 0 ? '%' : '')]);
  }
  if (it.enh) rows.push(['强化', '+' + it.enh]);
  return rows;
}
function itemTitle(it) {
  const rr = RARITY[it.r];
  const famName = it.kind === 'weapon' ? ' · ' + (WEAPONS[it.fam] ? WEAPONS[it.fam].kindLabel : '剑') : ' · ' + SLOT_LABEL[it.kind];
  return '<b style="color:' + rr.color + '">' + rr.name + ' · ' + it.name + '</b>'
    + '<span style="color:#8A8268">' + famName + '</span>';
}
// 对比时要逐项过一遍的属性（顺序 = tooltip 里的显示顺序）
const DIFF_KEYS = ['atk', 'def', 'hp', 'qiMax', 'skillDmg', 'crit', 'critDmg', 'atkSpd', 'spd', 'cdr', 'lifesteal', 'qiRegen', 'comboPct', 'qiOnHit', 'luck'];
const PCT_KEYS = ['critDmg', 'skillDmg', 'comboPct', 'spd', 'atkSpd', 'crit', 'lifesteal', 'cdr', 'qiRegen'];

// tooltip 定位：鼠标跟着光标，触摸则贴在格子旁边（手指会挡住格子，不能压在格子上）
function placeTip(x, y) {
  const w = tipEl.offsetWidth || 200, h = tipEl.offsetHeight || 190;
  tipEl.style.left = Math.round(Math.max(6, Math.min(x, innerWidth - w - 8))) + 'px';
  tipEl.style.top = Math.round(Math.max(6, Math.min(y, innerHeight - h - 8))) + 'px';
}
function showTip(it, evt, anchorEl) {
  if (!it || it.kind === 'potion') { tipEl.style.display = 'none'; return; }
  tipItem = it;
  const cur = player.equip[it.kind];
  let html = itemTitle(it) + '<br>';
  html += '<span style="color:#8A8268">品阶 ' + it.ilvl + ' · 评分 ' + itemScore(it) + '</span><br>';
  for (const [k, v] of statRows(it)) html += '<span style="color:#2A3140">' + k + ' +' + v + '</span><br>';

  if (cur && cur !== it) {
    // 逐项和身上那件比：绿=提升 红=下降，和界面其它地方的配色保持一致
    const cg = gearStats(cur), ig = gearStats(it);
    const rows = [];
    for (const k of DIFF_KEYS) {
      const d = (ig[k] || 0) - (cg[k] || 0);
      if (!d) continue;
      const pct = PCT_KEYS.indexOf(k) >= 0;
      const num = pct ? (Math.round(d * 10) / 10) : Math.round(d);
      if (!num) continue;
      rows.push('<span style="color:' + (num > 0 ? '#2F6E6A' : '#C8453B') + '">'
        + (STAT_LABEL[k] || k) + ' ' + (num > 0 ? '+' : '') + num + (pct ? '%' : '') + '</span>');
    }
    const ds = itemScore(it) - itemScore(cur);
    html += '<br><span style="color:#4A5568">对比身上：' + cur.name + '</span><br>';
    html += '<span style="color:' + (ds > 0 ? '#2F6E6A' : ds < 0 ? '#C8453B' : '#8A8268') + '"><b>综合 ' + (ds > 0 ? '+' : '') + ds + '</b></span><br>';
    html += rows.length ? rows.join('<br>') : '<span style="color:#8A8268">各项属性持平</span>';
  } else if (cur === it) {
    html += '<br><span style="color:#4A5568">当前已装备</span>';
  } else {
    html += '<br><span style="color:#8A8268">该槽位未装备，装备后属性直接生效</span>';
  }
  html += '<br><span style="color:#8A8268">左键装备 · 右键分解</span>';
  tipEl.innerHTML = html;
  tipEl.style.display = 'block';

  if (anchorEl) {
    // 触摸：贴格子右侧，右边放不下就翻到左边
    const r = anchorEl.getBoundingClientRect();
    const w = tipEl.offsetWidth || 200;
    const x = (r.right + 8 + w <= innerWidth) ? r.right + 8 : r.left - w - 8;
    placeTip(x, r.top - 24);
  } else if (evt && evt.clientX !== undefined) {
    placeTip(evt.clientX + 14, evt.clientY + 10);
  }
}
function hideTip() { tipEl.style.display = 'none'; }

function equipItem(i) {
  const it = player.inv[i];
  if (!it) return;
  if (it.kind === 'potion') { usePotion(); return; }
  const slot = it.kind;
  const old = player.equip[slot];
  player.equip[slot] = it;
  player.inv.splice(i, 1);
  if (old) player.inv.push(old);
  invalidateStats();
  player.hp = Math.min(player.hp, maxHp());
  player.qi = Math.min(player.qi, maxQi());
  msg('装备 ' + it.name, RARITY[it.r].color);
  AUDIO.play('equip');
  renderInv(); renderForge();
}
function unequip(slot) {
  const it = player.equip[slot];
  if (!it) return;
  if (invFull()) { msg('行囊已满 · 可花银两扩充', C.red3); return; }
  player.inv.push(it);
  player.equip[slot] = null;
  invalidateStats();
  player.hp = Math.min(player.hp, maxHp());
  msg('卸下 ' + it.name, C.paper1);
  AUDIO.play('equip');
  renderInv();
}
function salvageItem(i) {
  const it = player.inv[i];
  if (!it || it.kind === 'potion') { msg('此物不可分解', C.paper1); return; }
  const v = salvageValue(it);
  player.iron += v.iron; player.gold += v.gold;
  player.inv.splice(i, 1);
  msg('分解 ' + it.name + ' → 精铁+' + v.iron + ' 银两+' + v.gold, C.gold2);
  AUDIO.play('salvage');
  renderInv(); renderForge();
}
function salvageBulk(maxR) {
  let n = 0, iron = 0, gold = 0;
  for (let i = player.inv.length - 1; i >= 0; i--) {
    const it = player.inv[i];
    if (!it || it.kind === 'potion' || it.r > maxR) continue;
    const v = salvageValue(it);
    iron += v.iron; gold += v.gold; n++;
    player.inv.splice(i, 1);
  }
  if (!n) { msg('无可分解之物', C.paper1); return; }
  player.iron += iron; player.gold += gold;
  msg('分解 ' + n + ' 件 → 精铁+' + iron + ' 银两+' + gold, C.gold2);
  AUDIO.play('salvage');
  renderInv(); renderForge();
}
function renderInv() {
  if (!invEl) return;
  const s = stats();
  const eqHtml = SLOTS.map(slot => {
    const it = player.equip[slot];
    const cls = 'eq' + (it ? ' r' + it.r : ' empty');
    const inner = it
      ? '<img src="' + iconFor(it) + '" alt=""><span class="eqName">' + it.name + '</span>' +
        (it.enh ? '<span class="eqEnh">+' + it.enh + '</span>' : '')
      : '<span class="eqEmpty">' + SLOT_LABEL[slot] + '</span>';
    return '<div class="' + cls + '" data-slot="' + slot + '"><i>' + SLOT_LABEL[slot] + '</i>' + inner + '</div>';
  }).join('');

  const grid = document.getElementById('invGrid');
  const rowsHtml = [];
  for (let i = 0; i < invMax(); i++) {
    const it = player.inv[i];
    let cls = 'slot';
    if (it) {
      if (it.r !== undefined && it.kind !== 'potion') cls += ' r' + it.r;
      rowsHtml.push('<div class="' + cls + '" data-i="' + i + '"><img src="' + (it.kind === 'potion' ? iconURL.potion : iconFor(it)) + '">' +
        (it.kind !== 'potion' ? '<span class="badge r' + (it.r || 0) + (it.enh ? ' enh' : '') + '">' + (it.enh ? '+' + it.enh : RARITY[it.r].name[0]) + '</span>' : '') +
        '</div>');
    } else rowsHtml.push('<div class="slot"></div>');
  }
  grid.innerHTML = rowsHtml.join('');
  document.getElementById('eqSlots').innerHTML = eqHtml;
  document.getElementById('invStats').innerHTML =
    '<b>' + realm() + '</b> · 攻击 <b>' + s.atk + '</b> · 防御 <b>' + s.def + '</b> · 气血 <b>' + Math.round(player.hp) + '/' + Math.round(s.hp) + '</b>' +
    '<br>真气 <b>' + Math.round(player.qi) + '/' + Math.round(s.qiMax) + '</b> · 暴击 <b>' + Math.round(s.crit) + '%</b> · 术法 <b>' + Math.round(s.skillDmg) + '%</b>' +
    ' · 银两 <b>' + player.gold + '</b> · 精铁 <b>' + player.iron + '</b>' +
    '<br>侠名 <b style="color:' + fameTier().color + '">' + fameTier().name + '</b>（' + (player.fame || 0) + '）' +
    (priceMul() < 1 ? ' · 店家让价 <b>' + Math.round((1 - priceMul()) * 100) + '%</b>' : '');

  // 容量计数 + 扩充按钮
  const capEl = document.getElementById('invCap');
  if (capEl) {
    capEl.textContent = player.inv.length + '/' + invMax();
    capEl.classList.toggle('full', invFull());
  }
  const expBtn = document.getElementById('btnExpand');
  if (expBtn) {
    const maxed = invMax() >= INV_MAX;
    expBtn.textContent = maxed ? '已扩满' : '扩充 +' + INV_STEP + '（' + expandCost() + ' 两）';
    expBtn.disabled = maxed || player.gold < expandCost();
    expBtn.onclick = () => expandInv();
  }

  document.getElementById('eqSlots').querySelectorAll('.eq').forEach(el => {
    const slot = el.dataset.slot;
    const it = player.equip[slot];
    if (it) {
      el.onmouseenter = e => { if (lastPointerType === 'mouse') showTip(it, e); };
      el.onmouseleave = () => { if (lastPointerType === 'mouse') hideTip(); };
      el.oncontextmenu = e => { e.preventDefault(); unequip(slot); };
      el.onclick = e => {
        // 触摸：点一下先看属性（已装备的那件没有对比，只看数值），再点一下才卸
        if (lastPointerType !== 'mouse') {
          if (tipItem === it && tipEl.style.display === 'block') { hideTip(); unequip(slot); return; }
          showTip(it, null, el); return;
        }
        msg('右键可卸下 ' + it.name, C.paper1);
      };
    }
  });
  grid.querySelectorAll('.slot[data-i]').forEach(el => {
    const i = +el.dataset.i;
    const it = player.inv[i];
    el.onmouseenter = e => { if (lastPointerType === 'mouse') showTip(it, e); };
    el.onmouseleave = () => { if (lastPointerType === 'mouse') hideTip(); };
    el.onclick = () => {
      // 触摸屏没有 hover：第一下先把「和身上那件的差值」摆出来，
      // 确认过再点第二下才真换装。否则手指一碰就换了，根本看不到对比。
      if (lastPointerType !== 'mouse' && it) {
        if (tipItem === it && tipEl.style.display === 'block') { hideTip(); equipItem(i); return; }
        showTip(it, null, el); return;
      }
      equipItem(i);
    };
    el.oncontextmenu = e => { e.preventDefault(); salvageItem(i); };
  });
}
function toggleInv(force) {
  const show = force !== undefined ? force : invEl.style.display !== 'block';
  invEl.style.display = show ? 'block' : 'none';
  if (show) renderInv();
}

// 行囊右上角的关闭按钮
const btnInvClose = document.getElementById('btnInvClose');
if (btnInvClose) btnInvClose.onclick = () => toggleInv(false);

// 双击缩放防护：面板上双击本来是「装备/服用」，但浏览器会顺手把页面放大，
// 放大后画布只剩中间一小块，玩家就再也点不回去了。
// 浏览器对「双击缩放」的判定发生在默认手势层，CSS 的 touch-action 拦的是触摸路径，
// 桌面端还要靠 preventDefault 兜住 dblclick 的默认缩放行为。
document.addEventListener('dblclick', e => {
  const el = e.target;
  // 只在游戏面板内拦截，别影响正常网页行为
  if (el && el.closest && el.closest('.panel')) e.preventDefault();
}, { passive: false });

// ============ 铁匠台 ============
const forgeEl = document.getElementById('forge');
function forgeOpen() { forgeEl.classList.remove('hidden'); renderForge(); }
function forgeClose() { forgeEl.classList.add('hidden'); }
function renderForge() {
  if (!forgeEl || forgeEl.classList.contains('hidden')) return;
  const body = document.getElementById('forgeBody');
  if (!body) return;
  const parts = [];
  parts.push('<div class="forgeRow"><span>银两 ' + player.gold + ' · 精铁 ' + player.iron + '</span></div>');
  for (const slot of SLOTS) {
    const it = player.equip[slot];
    if (!it) { parts.push('<div class="forgeRow"><b>' + SLOT_LABEL[slot] + '</b>：未装备</div>'); continue; }
    const cost = enhanceCost(it.enh);
    const can = player.gold >= cost.gold && player.iron >= cost.iron && it.enh < MAX_ENH;
    parts.push('<div class="forgeRow"><b style="color:' + RARITY[it.r].color + '">' + SLOT_LABEL[slot] + ' · ' + it.name + (it.enh ? ' +' + it.enh : '') + '</b><br>' +
      '<span class="tip">' + statRows(it).map(r => r[0] + '+' + r[1]).join('　') + '</span><br>' +
      '<button data-act="enh" data-slot="' + slot + '"' + (can ? '' : ' disabled') + '>强化 +' + (it.enh + 1) + '（' + cost.gold + '银两/' + cost.iron + '精铁）</button> ' +
      '<button data-act="reroll" data-slot="' + slot + '">重铸词缀（' + rerollCost(it).iron + '精铁）</button></div>');
  }
  parts.push('<div class="forgeRow"><button data-act="rest">休整（回满气血真气）</button><button data-act="bulk0">分解全部凡品</button><button data-act="bulk1">分解凡品+精品</button></div>');
  body.innerHTML = parts.join('');
  body.querySelectorAll('button').forEach(b => {
    b.onclick = () => {
      const act = b.dataset.act;
      if (act === 'enh') {
        const it = player.equip[b.dataset.slot];
        if (!it) return;
        const c = enhanceCost(it.enh);
        if (player.gold < c.gold || player.iron < c.iron || it.enh >= MAX_ENH) { msg('材料不足', C.red3); return; }
        player.gold -= c.gold; player.iron -= c.iron;
        it.enh++; invalidateStats();
        player.hp = Math.min(player.hp, maxHp());
        msg(it.name + ' 强化至 +' + it.enh, C.gold3);
        AUDIO.play('forge');
        renderForge(); renderInv();
      } else if (act === 'reroll') {
        const it = player.equip[b.dataset.slot];
        if (!it) return;
        const c = rerollCost(it);
        if (player.iron < c.iron) { msg('精铁不足', C.red3); return; }
        player.iron -= c.iron;
        rerollAffixes(it);
        invalidateStats();
        msg(it.name + ' 词缀重铸', RARITY[it.r].color);
        AUDIO.play('forge');
        renderForge(); renderInv();
      } else if (act === 'rest') {
        player.hp = maxHp(); player.qi = maxQi();
        msg('气血真气尽复', C.jade3);
        AUDIO.play('pickup');
        renderForge(); renderInv();
      } else if (act === 'bulk0') salvageBulk(0);
      else if (act === 'bulk1') salvageBulk(1);
    };
  });
}

// ============ 商铺（S3 批次 B）============
// 一层壳子管所有铺子：药铺/酒馆/客栈/铁匠共用同一个面板，只换货架和台词。
// 营业时间是这套系统里最便宜、也最有效的一条"世界在运转"的证据 ——
// 天黑之后走到店门口，看见的是关门 + 灭灯，比任何文案都直接。
const shopEl = document.getElementById('shop');
let shopId = null;
let sleepT = 0, sleepNote = '';
let rumor = null;          // 酒保给的传闻：小地图上一个问号，靠近就揭开
// 进村标题：第一次踏进青云集时浮一行字。不是为了好看 ——
// 玩家得知道自己"到地方了"，否则 30 秒的步行没有回报感。
let bannerT = 0, bannerTitle = '', bannerSub = '', wasInVillage = false, wasInDg = false;
function banner(title, sub) { bannerTitle = title; bannerSub = sub; bannerT = 2.8; }

const SHOP_GOODS = {
  inn: [
    { id: 'rest', name: '住店一宿', price: 20, desc: '回满气血真气，过夜到卯时，顺手记下存档。' },
    { id: 'meal', name: '热汤面', price: 5, desc: '回 30 气血。赶路的人都吃这个。' },
  ],
  herb: [
    { id: 'potion', name: '回春丹', price: 12, desc: '即刻回复 45 气血。' },
    { id: 'bigpotion', name: '大还丹', price: 40, desc: '即刻回复 140 气血，重伤也能拉回来。' },
    { id: 'antidote', name: '清心散', price: 18, desc: '解毒，并在 30 秒内不再中毒。' },
  ],
  tavern: [
    { id: 'wine', name: '竹叶青', price: 6, desc: '回 25 气血，得「醉意」：伤害 +15%，90 秒。' },
    { id: 'liquor', name: '烧刀子', price: 14, desc: '回 40 气血，得「醉意」：伤害 +25%，120 秒。' },
    { id: 'rumor', name: '打听传闻', price: 4, desc: '酒保知道野地里的事，会在地图上给你标个方位。' },
  ],
  smith: [
    { id: 'forge', name: '借炉（开铁匠台）', price: 0, note: '不收钱', btn: '借炉', desc: '强化、重铸、分解，与土地庙那台一样。' },
    { id: 'sell0', name: '变卖凡品', price: 0, note: '当面称重', btn: '出手', desc: '包里的「凡品」全换成银两与精铁。张五不挑，称斤两。' },
    { id: 'sell1', name: '变卖凡品 · 精品', price: 0, note: '当面称重', btn: '出手', desc: '连「精品」一并出手，腾出格子给新打的东西。' },
  ],
  // 货郎没有炉子也没有药柜，卖的是"路上缺的那一件"：便宜丹药、按块卖的精铁。
  pedlar: [
    { id: 'potion', name: '回春丹', price: 11, desc: '即刻回复 45 气血。比药铺便宜一文，因为来路不明。' },
    { id: 'antidote', name: '清心散', price: 16, desc: '解毒，并在 30 秒内不再中毒。' },
    { id: 'iron', name: '精铁一块', price: 9, desc: '重铸词缀要用它。野地里捡得慢，钱在这儿换得快。' },
  ],
};

function shopOpenNow(id) {
  const s = SHOPS[id];
  if (!s) return false;
  if (s.openWhen === 'always') return true;
  if (s.openWhen.indexOf(clock.phase.id) < 0) return false;
  if (s.deepNightClosed && clock.deepNight) return false;
  return true;
}
function nearShop() {
  let best = null, bd = 1e9;
  for (const id in SHOPS) {
    const s = SHOPS[id];
    const d = Math.hypot(player.x - s.x, player.y - s.y);
    if (d < s.r && d < bd) { bd = d; best = id; }
  }
  return best;
}
function nearNotice() {
  const p = PROPS.find(q => q.id === 'notice');
  return !!p && Math.hypot(player.x - p.x, player.y - (p.y + 4)) < 30;
}
function shopOpen(id) {
  // 铁匠铺也走同一套摊位 UI：先听张五说一句话，再选「借炉」进铁匠台。
  // 从前这里是直接弹铁匠台的，看着省一步，实际上把"这铺子里有个人"这件事整个抹掉了。
  shopId = id;
  shopEl.classList.remove('hidden');
  renderShop();
}
function shopClose() { shopEl.classList.add('hidden'); shopId = null; }
function renderShop() {
  if (!shopId || shopEl.classList.contains('hidden')) return;
  const s = SHOPS[shopId];
  const open = shopOpenNow(shopId);
  document.getElementById('shopTitle').textContent = s.title;
  document.getElementById('shopSub').textContent =
    s.keeper + ' · ' + (open ? '营业中' : '已打烊') + '　｜　囊中 ' + player.gold + ' 银两';
  const rows = [];
  const line = open ? s.line
    : (s.deepNightClosed && clock.deepNight ? s.closedDeep : s.closed);
  rows.push('<div class="say">' + line + '</div>');
  if (open) {
    for (const g of SHOP_GOODS[shopId] || []) {
      const price = goodPrice(g);
      const ok = player.gold >= price;
      const shown = price !== g.price
        ? '<b>' + price + ' 银两<s style="opacity:.55;margin-left:4px">' + g.price + '</s></b>'
        : '<b>' + (g.note || (g.price ? g.price + ' 银两' : '不用钱')) + '</b>';
      rows.push('<div class="goods"><div class="gn">' + g.name + shown + '</div>' +
        '<div class="gd">' + g.desc + '</div>' +
        '<button data-buy="' + g.id + '"' + (ok ? '' : ' disabled') + '>' + (g.btn || '买下') + '</button></div>');
    }
  } else {
    rows.push('<div class="gd">' + clock.phase.name + '·' + clock.phase.sub +
      '　营业时辰：' + (s.openWhen === 'always' ? '通宵' : s.openWhen.map(x => PHASES.find(p => p.id === x).name).join(' / ')) + '</div>');
  }
  document.getElementById('shopBody').innerHTML = rows.join('');
  document.getElementById('shopBody').querySelectorAll('button[data-buy]')
    .forEach(b => { b.onclick = () => buyGood(b.dataset.buy); });
}
function buyGood(id) {
  if (!shopId) return;
  const g = (SHOP_GOODS[shopId] || []).find(x => x.id === id);
  if (!g) return;
  if (id === 'forge') { shopClose(); forgeOpen(); AUDIO.play('forge'); return; }
  if (id === 'sell0' || id === 'sell1') { salvageBulk(id === 'sell0' ? 0 : 1); renderShop(); return; }
  const price = goodPrice(g);
  if (player.gold < price) { msg('银两不够', C.red3); return; }
  let done = true;
  switch (id) {
    case 'rest': doRest(); return;
    case 'meal':
      if (player.hp >= maxHp()) { msg('不饿，气血已满', C.paper1); done = false; break; }
      player.hp = Math.min(maxHp(), player.hp + 30);
      dmgNum(player.x, player.y - 18, '+30', C.jade3);
      break;
    case 'potion': addPotion('回春丹', 45); break;
    case 'bigpotion': addPotion('大还丹', 140); break;
    case 'antidote': addPotion('清心散', 0, 1); break;
    case 'iron':
      player.iron += 1;
      msg('得精铁一块', C.paper2);
      break;
    case 'wine': drink(25, 90, 0.15, '微醺'); break;
    case 'liquor': drink(40, 120, 0.25, '醉意上涌'); break;
    case 'rumor': {
      const c = camps[(Math.random() * camps.length) | 0];
      rumor = { x: c.x, y: c.y, name: c.name, t: 240 };
      msg('酒保压低声音：「' + c.name + '，往' + dirWord(c) + '去。」', C.gold3);
      player.gold -= price;
      AUDIO.play('pickup');
      renderShop();
      return;
    }
    default: done = false;
  }
  if (done) {
    player.gold -= price;
    AUDIO.play('pickup');
    msg('买下 ' + g.name, C.paper2);
  }
  renderShop(); renderInv();
}
function addPotion(name, heal, cure) {
  player.inv.push({ kind: 'potion', name, heal: heal || 0, cure: cure || 0, r: 0 });
}
function drink(heal, secs, mul, word) {
  player.hp = Math.min(maxHp(), player.hp + heal);
  player.drunkT = Math.max(player.drunkT, secs);
  player.drunk = mul;
  dmgNum(player.x, player.y - 18, '+' + heal, C.jade3);
  msg(word + ' · 伤害 +' + Math.round(mul * 100) + '%', C.gold3);
}
function dirWord(c) {
  const dx = c.x - player.x, dy = c.y - player.y;
  const ew = Math.abs(dx) > 40 ? (dx > 0 ? '东' : '西') : '';
  const ns = Math.abs(dy) > 40 ? (dy > 0 ? '南' : '北') : '';
  return (ns + ew) || '近处';
}
function doRest() {
  if (player.gold < 20) { msg('住店要 20 银两', C.red3); return; }
  player.gold -= 20;
  player.hp = maxHp(); player.qi = maxQi();
  player.poison = 0; player.poisonT = 0;
  player.rested = true;
  clock.sleepToDawn();
  sleepT = 1.8;
  sleepNote = Math.random() < 0.10 ? '夜半有人叩门，说了些听不真切的旧事。' : '';
  save();
  msg('一夜无话 · 第 ' + clock.day + ' 日', C.gold3);
  AUDIO.play('levelup');
  shopClose();
  renderInv();
}
function interact() {
  // 洞里没有柜台也没有村民，先认箱子与地脉裂口
  const dgo = nearDg();
  if (dgo) { dgUse(dgo); return; }
  // 先认人，再认铺子。人比柜台重要 —— 站在门口的那个人才是"这地方有人"的信号。
  // 两边都在范围内时比距离，谁近听谁的（说书人和货郎的摊子只隔五十来像素）。
  const v = nearVillager();
  const id = nearShop();
  if (v && (!id || Math.hypot(player.x - v.x, player.y - v.y) <=
    Math.hypot(player.x - SHOPS[id].x, player.y - SHOPS[id].y))) { talkTo(v); return; }
  if (id) { shopOpen(id); return; }
  if (nearNotice()) { boardRead(); return; }
  if (nearTemple()) { forgeOpen(); return; }
  msg('此处无人可谈', C.paper1);
}
function boardRead() {
  msg('告示：日出开市，入夜闭户。夜行遇阴物，莫追。', C.paper3);
}

// ---- 地宫里的三件事：开箱、深入地脉、回地面 ----
function dgUse(o) {
  if (o.kind === 'rift') { o.home ? dgHome() : dgDescend(); return; }
  if (o.kind === 'chest') { dgOpenChest(o); return; }
}

function dgOpenChest(o) {
  if (o.opened) { msg('箱子空了', C.paper2); return; }
  if (o.locked) { msg(o.big ? '有什么挡着箱盖' : '箱上贴了符 · 清完这层才揭得开', C.red3); return; }
  o.opened = true;
  o.mesh.material.color.set(0x7c7c86);          // 开过的箱子压暗，不用再凑近确认
  AUDIO.play('rare');
  const n = o.big ? 3 : 1;
  const luck = stats().luck + (o.big ? 60 : 25);
  for (let i = 0; i < n; i++) {
    const r = Math.max(o.big ? 2 : 1, rollRarity(luck, o.big ? 2 : 0));
    const it = makeGear(SLOTS[(Math.random() * SLOTS.length) | 0], r, player.level + dgFloor);
    // 掉在箱子旁边而不是脚下：玩家得走过去捡，那两步是"这一层值了"的实感
    addDrop('gear', it, o.x + (Math.random() * 30 - 15), o.y + 6 + Math.random() * 8);
  }
  const g = (o.big ? 180 : 40) + ((Math.random() * 60) | 0);
  const iron = o.big ? 12 : 3;
  player.gold += g; player.iron += iron;
  msg('开箱 · 银两 +' + g + ' · 精铁 +' + iron, C.gold3);
}

// ============ 侠名（S3 批次 C）============
// 侠名不是"分数条"，它只做三件事：换一句别人怎么叫你、换说书人讲什么、
// 换店里的价。多了就变成刷数值，少了又感觉不到，三条刚好。
const FAME_TIERS = [
  { at: 0, name: '无名小卒', color: C.paper2 },
  { at: 5, name: '初露锋芒', color: C.jade3 },
  { at: 15, name: '小有名气', color: C.gold2 },
  { at: 30, name: '一方豪侠', color: C.red3 },
  { at: 60, name: '名动江湖', color: C.gold3 },
];
function fameTier() {
  let t = FAME_TIERS[0];
  for (const f of FAME_TIERS) if (player.fame >= f.at) t = f;
  return t;
}
function addFame(n, why) {
  const before = fameTier().name;
  player.fame = Math.min(200, (player.fame || 0) + n);
  const now = fameTier().name;
  if (now !== before) msg('侠名渐起 · ' + now, C.gold3);
  else if (why) msg(why, C.paper2);
}
// 名声换折扣：起步 10 点名望才有一点点让价，最多八五折。
// 定这么淡是因为"买东西便宜"会直接改写刷装备的节奏，宁可少给。
function priceMul() {
  return 1 - Math.min(0.15, Math.max(0, (player.fame || 0) - 10) * 0.0025);
}
function goodPrice(g) { return g.price ? Math.max(1, Math.round(g.price * priceMul())) : 0; }

// ============ 对话 ============
const talkEl = document.getElementById('talk');
const talkLineEl = document.getElementById('talkLine');
const talkOptsEl = document.getElementById('talkOpts');
let talkNpc = null, talkTimer = null, talkFull = '', talkShown = 0, talkAsked = false;

function phaseOn(phases) {
  if (!phases || phases === 'always') return true;
  return phases.indexOf(clock.phase.id) >= 0;
}
function nearVillager() {
  let best = null, bd = 1e9;
  for (const v of VILLAGERS) {
    if (!phaseOn(v.phases)) continue;
    const d = Math.hypot(player.x - v.x, player.y - v.y);
    if (d < 34 && d < bd) { bd = d; best = v; }
  }
  return best;
}
// 打字机：一句一句往外吐字。点一下正文就直接给全 —— 急着看结果的人不该被动画拖住。
function say(text) {
  if (talkTimer) { clearInterval(talkTimer); talkTimer = null; }
  talkFull = text; talkShown = 0;
  talkLineEl.textContent = '';
  talkTimer = setInterval(() => {
    talkShown += 2;
    talkLineEl.textContent = talkFull.slice(0, talkShown);
    if (talkShown >= talkFull.length) { clearInterval(talkTimer); talkTimer = null; }
  }, 26);
}
function sayAll() {
  if (talkTimer) { clearInterval(talkTimer); talkTimer = null; }
  talkShown = talkFull.length;
  talkLineEl.textContent = talkFull;
}
function talkTo(v) {
  talkNpc = v; talkAsked = false;
  const o = vilObjs.find(x => x.villager === v.id);
  const n = o ? o.spoke : 0;
  if (o) o.spoke = (n + 1) % v.greet.length;
  document.getElementById('talkName').textContent = v.name;
  document.getElementById('talkRole').textContent = v.role + '　·　' + clock.phase.name;
  talkEl.classList.remove('hidden');
  // 见过几面之后，台词换口气 —— 这是最便宜的"他记得你"
  renderTalk(v.greet[n % v.greet.length]);
}
function renderTalk(line) {
  say(line);
  talkOptsEl.innerHTML = '';
  const add = (label, fn) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.onclick = fn;
    talkOptsEl.appendChild(b);
  };
  if (!talkAsked) add('打听', () => { talkAsked = true; renderTalk(talkNpc.ask); });
  if (talkNpc.act) add(talkNpc.actLabel, () => {
    const r = NPC_ACT[talkNpc.act](talkNpc);
    if (r) renderTalk(r);
  });
  // 关窗只留底部那一个按钮 —— 选项行里再放一个「作别」，同屏就有两个一样的东西。
}
function talkClose() {
  if (talkTimer) { clearInterval(talkTimer); talkTimer = null; }
  talkEl.classList.add('hidden');
  talkNpc = null;
}
// 每个动作返回一句话，接在对话里 —— 不做"点完就关窗"，那样人就被当成自动售货机了。
const NPC_ACT = {
  road(v) {
    // 更夫带你找营地，樵夫只认得山魈那一窝
    let c = camps[(Math.random() * camps.length) | 0];
    if (v.id === 'qiao') c = camps.find(k => k.types.indexOf('shanxiao') >= 0) || c;
    if (!c) return '这阵子野地里干净，没什么可指给你的。';
    rumor = { x: c.x, y: c.y, name: c.name, t: 240 };
    return '“' + c.name + '，往' + dirWord(c) + '去。天黑之前赶到，天亮之前回来。”';
  },
  kid() {
    addFame(1);
    return '“等我长大了也要拿刀。”他比划了一下，差点把自己绊倒。（侠名 +1）';
  },
  give(v) {
    const i = player.inv.findIndex(x => x.kind === 'potion');
    if (i < 0) return '“没药？那就少往野地里跑。”她摇摇头，把汤碗往你面前推了推。';
    const it = player.inv[i];
    player.inv.splice(i, 1);
    renderInv();
    addFame(6);
    player.gold += 8;
    return '你把' + it.name + '搁在灶台上。她愣了愣，从柜底摸出八个铜钱塞给你。（侠名 +6）';
  },
  story(v) {
    const f = fameTier();
    const tales = {
      '无名小卒': '“今日讲个旧事：三十年前，也有个背刀的年轻人从这口子进村，再没出去。”',
      '初露锋芒': '“听闻近来野地里出了个后生，刀快。诸位若见着，替我看看是不是他。”',
      '小有名气': '“青云集有个斩妖的，一晚上清了半个山头。这话我讲了三遍，每遍都有人不信。”',
      '一方豪侠': '“黑风寨那伙人近来不敢下山了 —— 说是山下来了个不好惹的。”',
      '名动江湖': '“诸位听好：如今过青云集这条道，只要报上那位的名号，山贼都让路。”',
    };
    return tales[f.name] + '（当前：' + f.name + '）';
  },
  charm(v) {
    const cost = goodPrice({ price: 20 });
    if (player.gold < cost) return '“符不赊账。心诚也得有香火钱。”';
    player.gold -= cost;
    player.qi = maxQi();
    player.poisonImmuneT = Math.max(player.poisonImmuneT || 0, 45);
    addPotion('清心散', 0, 1);
    renderInv();
    return '他咬破指尖在黄纸上画了一道，火一燎，纸灰落进你掌心。（' + cost + ' 银两 · 真气尽复 · 45 秒不侵毒）';
  },
  drunk(v) {
    const odds = Math.random();
    if (odds < 0.34) {
      const c = camps[(Math.random() * camps.length) | 0];
      rumor = { x: c.x, y: c.y, name: c.name, t: 240 };
      return '“……井底下通着野地！”他忽然清醒了一瞬，指着' + dirWord(c) + '边，“那边，那边有东西。”（得一处方位）';
    }
    if (odds < 0.67) return '“嗝——我年轻时也是条好汉。”他说完就睡着了。';
    return '“别信道士，都是骗钱的。”他压低声音，“……不过那符是真管用。”';
  },
};

// ============ 道行（技能树） ============
const skillEl = document.getElementById('skills');
function renderSkills() {
  if (!skillEl) return;
  const tree = document.getElementById('skillTree');
  if (!tree) return;
  document.getElementById('spLeft').textContent = player.skillPts;
  tree.innerHTML = BRANCHES.map(b => {
    const nodes = NODES.filter(n => n.branch === b.id).sort((a, c) => a.tier - c.tier);
    return '<div class="branch" style="--bc:' + b.color + '">' +
      '<h4>' + b.name + '<span>' + b.motto + '</span></h4>' +
      nodes.map(n => {
        const lv = nodeLevel(player.skillLv, n.id);
        const reason = canLearn(player.skillLv, n, player.skillPts);
        const maxed = lv >= n.max;
        return '<div class="node' + (maxed ? ' maxed' : '') + (reason && !maxed ? ' locked' : '') + '" data-id="' + n.id + '">' +
          '<div class="nTop"><b>' + n.name + '</b><span>' + lv + '/' + n.max + '</span></div>' +
          '<div class="nDesc">' + n.desc(Math.max(1, lv)) + '</div>' +
          '<div class="nBar">' + Array.from({ length: n.max }, (_, i) => '<i class="' + (i < lv ? 'on' : '') + '"></i>').join('') + '</div>' +
          '<div class="nHint">' + (maxed ? '圆满' : (reason || '点击参悟（1 点）')) + '</div>' +
          '</div>';
      }).join('') + '</div>';
  }).join('');
  tree.querySelectorAll('.node').forEach(el => {
    el.onclick = () => learnNode(el.dataset.id);
  });
}
function learnNode(id) {
  const n = NODE_BY_ID[id];
  if (!n) return;
  const reason = canLearn(player.skillLv, n, player.skillPts);
  if (reason) { msg(reason, C.paper1); return; }
  player.skillPts--;
  player.skillLv[id] = nodeLevel(player.skillLv, id) + 1;
  invalidateStats();
  player.hp = Math.min(player.hp, maxHp());
  msg('参悟「' + n.name + '」' + player.skillLv[id] + '级', C.gold3);
  AUDIO.play('levelup');
  renderSkills();
}
function toggleSkills(force) {
  const show = force !== undefined ? force : skillEl.classList.contains('hidden');
  skillEl.classList.toggle('hidden', !show);
  if (show) renderSkills();
}

// ============ 存档 ============
function save() {
  if (state !== 'play' && state !== 'clear') return;
  localStorage.setItem(SAVE_KEY, JSON.stringify({
    v: 5, chapter: 1, cleared,
    x: player.x, y: player.y, hp: player.hp, qi: player.qi,
    maxHpBase: player.maxHpBase, xp: player.xp, level: player.level,
    gold: player.gold, iron: player.iron, atkBase: player.atkBase,
    inv: player.inv, invMax: player.invMax || INV_BASE, equip: player.equip,
    skillPts: player.skillPts, skillLv: player.skillLv, kills: player.kills || 0,
    rested: !!player.rested, fame: player.fame || 0,
    clock: clock.serialize(),
  }));
}
function normGear(it) {
  if (!it) return null;
  if (!it.b) it.b = { atk: it.atk || 0, def: it.def || 0, hp: 0, qiMax: 0, skillDmg: 0 };
  if (!it.affixes) it.affixes = [];
  if (it.enh === undefined) it.enh = 0;
  if (it.kind === 'weapon' && (!it.fam || !WEAPONS[it.fam])) it.fam = 'sword';
  if (SLOTS.indexOf(it.kind) < 0) it.kind = 'weapon';
  return it;
}
function migrateLegacy(s) {
  const conv = it => {
    if (!it) return null;
    const g = {
      uid: it.uid || Math.random().toString(36).slice(2), kind: it.kind || 'weapon', name: it.name || '旧物',
      r: it.r || 0, ilvl: it.ilvl || 1, enh: it.enh || 0, affixes: it.affixes || [],
      b: it.b || { atk: it.atk || 0, def: it.def || 0, hp: 0, qiMax: 0, skillDmg: 0 },
      fam: it.fam || 'sword',
    };
    return normGear(g);
  };
  return {
    v: 4, cleared: !!s.cleared, x: s.x, y: s.y, hp: s.hp, qi: s.qi || 60,
    maxHpBase: s.maxHpBase !== undefined ? s.maxHpBase : (s.maxHp || 100),
    xp: s.xp || 0, level: s.level || 1, gold: s.gold || 0, iron: s.iron || 0, atkBase: s.atkBase || 8,
    inv: (s.inv || []).map(conv), equip: {
      weapon: conv(s.equip && s.equip.weapon), armor: conv(s.equip && s.equip.armor),
      necklace: conv(s.equip && s.equip.necklace), artifact: conv(s.equip && s.equip.artifact),
    },
    skillPts: s.skillPts || 0, skillLv: s.skillLv || {}, kills: s.kills || 0,
  };
}
function load() {
  let raw = localStorage.getItem(SAVE_KEY), s = null;
  if (raw) { try { s = JSON.parse(raw); } catch (e) { s = null; } }
  if (!s) {
    for (const k of LEGACY_KEYS) {
      const r2 = localStorage.getItem(k);
      if (r2) { try { s = migrateLegacy(JSON.parse(r2)); break; } catch (e) { } }
    }
  }
  if (!s) return false;
  if (s.v !== 4 && s.v !== 5) s = migrateLegacy(s);
  cleared = !!s.cleared;
  Object.assign(player, {
    x: s.x, y: s.y, hp: s.hp, qi: s.qi || 60, maxHpBase: s.maxHpBase, xp: s.xp, level: s.level,
    gold: s.gold, iron: s.iron || 0, atkBase: s.atkBase,
    // 老存档可能已经塞了超过 20 件（以前只有拾取挡，别的入口不挡），
    // 读档时按实际件数把容量抬到能装下，别让玩家一进游戏就看到 "25/20"
    inv: (s.inv || []).map(normGear),
    invMax: Math.max(s.invMax || INV_BASE, Math.ceil(((s.inv || []).length) / INV_STEP) * INV_STEP),
    equip: {
      weapon: normGear(s.equip && s.equip.weapon), armor: normGear(s.equip && s.equip.armor),
      necklace: normGear(s.equip && s.equip.necklace), artifact: normGear(s.equip && s.equip.artifact),
    },
    skillPts: s.skillPts || 0, skillLv: s.skillLv || {}, kills: s.kills || 0,
    rested: !!s.rested, fame: s.fame || 0,
  });
  invalidateStats();
  // 地脉变动：96×72 扩到 144×104 之后，旧存档的坐标可能落在岩层里或地图外。
  // 与其让玩家一进游戏就卡在石头里，不如直接送回青云集门口。
  if (!isFinite(player.x) || !isFinite(player.y) ||
      player.x < 16 || player.y < 16 || player.x > MAPW * TILE - 16 || player.y > MAPH * TILE - 16 ||
      !canStand(player.x, player.y)) {
    player.x = SPAWN.x; player.y = SPAWN.y;
    msg('地脉变动，已送回青云集', C.jade3);
  }
  player.hp = Math.min(player.hp, maxHp());
  player.qi = Math.min(player.qi, maxQi());
  clock.restore(s.clock || { t: 0.40, day: 1 });   // 老档没有时辰字段，给回开局午后
  return true;
}
function resetWorld() {
  for (const e of enemies) { scene.remove(e.mesh); if (e.ring) scene.remove(e.ring); if (e.shadow) scene.remove(e.shadow); }
  for (const d of drops) { if (d.mesh) scene.remove(d.mesh); if (d.beam) scene.remove(d.beam); }
  for (const p of projectiles) scene.remove(p.mesh);
  for (const p of particles) if (p.mesh) scene.remove(p.mesh);
  for (const s of sparks) scene.remove(s.mesh);
  for (const g of ghosts) scene.remove(g.mesh);
  enemies = []; drops = []; projectiles = []; particles = []; sparks = []; ghosts = [];
  dmgNums = []; messages = []; slashGhosts = []; bolts = [];
  seedCamps();
}
function startGame(cont) {
  AUDIO.unlock();
  if (!cont) cleared = false;
  const loaded = cont && load();
  resetWorld();
  if (!loaded) {
    clock.restore({ t: 0.40, day: 1 });
    meditateT = 0;
    Object.assign(player, {
      x: SPAWN.x, y: SPAWN.y, hp: 100, qi: 60, maxHpBase: 100, xp: 0, level: 1, gold: 0, iron: 0,
      atkBase: 8, inv: [], invMax: INV_BASE, equip: { weapon: null, armor: null, necklace: null, artifact: null },
      skillPts: 0, skillLv: {}, kills: 0, atkStep: 0, swing: null, shield: 0, poison: 0, poisonT: 0,
      poisonImmuneT: 0, drunkT: 0, drunk: 0, rested: false, fame: 0,
    });
    invalidateStats();
  }
  document.getElementById('menu').classList.add('hidden');
  document.getElementById('dead').classList.add('hidden');
  document.getElementById('clear').classList.add('hidden');
  forgeClose(); toggleInv(false); toggleSkills(false); shopClose(); talkClose();
  rumor = null; sleepT = 0; bannerT = 0; wasInVillage = false; wasInDg = false;
  dgDipT = 0; dgDipAct = null; dgReset();
  for (const o of vilObjs) { o.spoke = 0; o.fade = undefined; }
  pMesh.visible = true;
  pShadow.visible = true;
  state = 'play';
  combo = 0; comboT = 0; hitstop = 0; shakeX = shakeY = 0;
  msg(cont ? '继续闯荡 · 第一章 青云野' : '第一章 · 青云野', C.gold3);
  renderInv(); renderSkills();
}

// ============ 输入 ============
addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
  keys[e.code] = true;
  if (e.repeat) return;
  if (state === 'menu') {
    if (e.code === 'Enter' || e.code === 'NumpadEnter') {
      const has = !!(localStorage.getItem(SAVE_KEY) || LEGACY_KEYS.some(k => localStorage.getItem(k)));
      startGame(has);
    }
    return;
  }
  if (e.code === 'Space' || e.code === 'KeyJ') attack();
  if (e.code === 'KeyK') castQi();
  if (e.code === 'KeyL') castWu();
  if (e.code === 'KeyH') castThunder();
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') dash();
  if (e.code === 'KeyR') windStep();
  if (e.code === 'KeyQ') usePotion();
  if (e.code === 'KeyT') toggleSkills();
  if (e.code === 'KeyF') meditate();
  if (e.code === 'KeyE') interact();
  if (e.code === 'Tab' || e.code === 'KeyI') { if (state === 'play') toggleInv(); }
  if (e.code === 'Escape') { toggleInv(false); forgeClose(); toggleSkills(false); shopClose(); talkClose(); }
  if (e.code === 'KeyM') { AUDIO.enabled = !AUDIO.enabled; msg(AUDIO.enabled ? '音效开' : '音效关', C.paper2); }
  if (e.code === 'F11' || (e.code === 'KeyF' && e.ctrlKey)) { e.preventDefault(); toggleFullscreen(); }
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('beforeunload', save);
document.getElementById('btnNew').onclick = () => startGame(false);
document.getElementById('btnCont').onclick = () => startGame(true);
const btnCtrl = document.getElementById('btnCtrl');
if (btnCtrl) {
  btnCtrl.title = 'PC 默认用键鼠，手机默认出摇杆；点此手动切换（会记住选择，?touch=auto 可恢复自动）';
  btnCtrl.onclick = () => setInputMode(touch.enabled ? 'keyboard' : 'touch', true);
}
function showDead() {
  state = 'dead';
  const el = document.getElementById('dead');
  const inner = el.querySelector('p');
  if (player.rested) {
    inner.innerHTML = '损失 20% 银两，被客栈伙计背回了青云集';
    document.getElementById('btnRespawn').textContent = '在客栈醒来';
  } else {
    inner.innerHTML = '损失 20% 银两，被救回土地庙';
    document.getElementById('btnRespawn').textContent = '回到土地庙';
  }
  el.classList.remove('hidden');
}
function respawn() {
  player.gold = Math.floor(player.gold * 0.8);
  player.hp = maxHp(); player.qi = maxQi();
  // 住过店的人，"家"就变成客栈了 —— 存档点不该只是一个功能，得是你在世界里的落脚处
  if (player.rested) { player.x = SHOPS.inn.x; player.y = SHOPS.inn.y + 20; }
  else { player.x = SPAWN.x; player.y = SPAWN.y; }
  player.poison = 0; player.poisonT = 0;
  player.drunkT = 0; player.drunk = 0;
  // 死在洞里 = 这一趟白跑。下一趟下去是新的一层，别指望回来捡尸。
  dgReset(); wasInDg = false; dgDipT = 0; dgDipAct = null;
  document.getElementById('dead').classList.add('hidden');
  state = 'play';
}
document.getElementById('btnRespawn').onclick = respawn;
document.getElementById('btnRoam').onclick = () => {
  document.getElementById('clear').classList.add('hidden');
  state = 'play';
};
document.getElementById('btnForgeClose').onclick = forgeClose;
document.getElementById('btnShopClose').onclick = shopClose;
document.getElementById('btnTalkClose').onclick = talkClose;
document.getElementById('talkLine').onclick = sayAll;   // 点正文 = 跳过打字机
document.getElementById('btnSkillClose').onclick = () => toggleSkills(false);
document.getElementById('btnCont').disabled = !(localStorage.getItem(SAVE_KEY) || localStorage.getItem(LEGACY_KEYS[0]));

// 技能栏点击（画布上直接点技能格）
let skillRects = [];
function logicalPos(e) {
  const c = document.getElementById('ov');
  const r = c.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * LW, y: (e.clientY - r.top) / r.height * LH };
}
const ovEl = document.getElementById('ov');

// ---- 触屏：摇杆 + 动作键 ----
// 用 pointer 事件（同时覆盖触摸/鼠标/触控笔）；摇杆按 pointerId 跟踪，
// 这样左手推杆的同时右手还能连点攻击。
function stickStart(p, id) {
  const st = touch.stick;
  if (st.on && st.id !== id) return;             // 第二根手指落进左半屏，不许抢走摇杆
  st.on = true; st.id = id; st.cx = p.x; st.cy = p.y; st.dx = 0; st.dy = 0;
  st.cap = false;
}
function stickMove(p) {
  const st = touch.stick;
  if (!st.on) return;
  let dx = p.x - st.cx, dy = p.y - st.cy;
  const d = Math.hypot(dx, dy);
  const dead = 6;                                   // 死区：手指微抖不出杆
  if (d <= dead) { st.dx = 0; st.dy = 0; return; }
  const k = Math.min(1, (d - dead) / (st.r - dead));
  st.dx = dx / d * k; st.dy = dy / d * k;
}
function stickEnd() {
  const st = touch.stick;
  st.on = false; st.id = -1; st.dx = 0; st.dy = 0; st.cap = false;
}

ovEl.addEventListener('pointerdown', e => {
  if (state !== 'play') { stickEnd(); return; }
  const p = logicalPos(e);
  if (touch.enabled) {
    const b = touchHit(p);
    if (b) { b.run(); e.preventDefault(); return; }
    if (p.x >= STICK_HOT.x0 && p.x <= STICK_HOT.x1 && p.y >= STICK_HOT.y0 && p.y <= STICK_HOT.y1) {
      const st = touch.stick;
      // 只有「起杆的那根手指」才配拿捕获；第二根手指误落左半屏不能改写 st.cap
      if (!st.on || st.id === e.pointerId) {
        stickStart(p, e.pointerId);
        // 捕获成功后记一笔：后面用它做「浏览器把捕获弄丢了」的自检
        try {
          ovEl.setPointerCapture(e.pointerId);
          st.cap = !!(ovEl.hasPointerCapture && ovEl.hasPointerCapture(e.pointerId));
        } catch (err) { st.cap = false; }
      }
      e.preventDefault();
      return;
    }
  }
  for (const r of skillRects) {
    if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
      if (r.id === 'slash') attack();
      else if (r.id === 'qi') castQi();
      else if (r.id === 'wu') castWu();
      else if (r.id === 'thunder') castThunder();
      else if (r.id === 'dash') dash();
      else if (r.id === 'potion') usePotion();
      return;
    }
  }
});

ovEl.addEventListener('pointermove', e => {
  const st = touch.stick;
  if (!st.on || e.pointerId !== st.id) return;
  stickMove(logicalPos(e));
  e.preventDefault();
});
// 关键修复：up / cancel 挂在 window 的 capture 阶段。
// 手指滑出画布、被系统手势打断、或浏览器把 pointercancel 投给别的元素时，
// 只监听 ovEl 会漏掉这一次抬起 —— 摇杆的 dx/dy 就永远停在最后一个方向，
// 人物便会「不听使唤」地一直走。pointerleave 也一并去掉：带捕获时它在
// 手指擦过画布边缘就会误触发，反而是另一种「突然不动」。
for (const evt of ['pointerup', 'pointercancel']) {
  window.addEventListener(evt, e => {
    if (e.pointerId === touch.stick.id) stickEnd();
  }, { capture: true, passive: true });
}
ovEl.addEventListener('lostpointercapture', e => {
  if (e.pointerId === touch.stick.id && touch.stick.on) stickEnd();
});
// 页面切走 / 失焦时收杆 + 清空键盘方向键
function releaseAllInput() { stickEnd(); clearKeys(); }
addEventListener('blur', releaseAllInput);
document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAllInput(); });

// ============ 敌手行为 ============
function enemyStrike(e) {
  const m = MONSTERS[e.type];
  const dx = player.x - e.x, dy = player.y - e.y, d = Math.hypot(dx, dy);
  if (d < m.range + 15) {
    hurtPlayer(e.dmg);
    if (m.poison && player.poisonImmuneT <= 0) {
      // 已经中了就不再报一遍：三条"中毒"叠在一起，玩家会以为叠了三层毒
      const was = player.poison > 0;
      player.poison = Math.max(player.poison, m.poison); player.poisonT = Math.max(player.poisonT, 3);
      if (!was) msg('中毒', C.jade2);
    }
  }
  burst(e.x + (dx / (d || 1)) * 10, e.y - 6 + (dy / (d || 1)) * 6, C.paper2, 4, 45);
}
function bossSpin(e) {
  const dx = player.x - e.x, dy = player.y - e.y, d = Math.hypot(dx, dy);
  shakeX += 4; shakeY += 4;
  AUDIO.play('boss');
  burst(e.x, e.y - 10, C.red2, 24, 130);
  if (d < 68) hurtPlayer(e.dmg * 1.3);
}
function bossSlam(e) {
  const m = MONSTERS[e.type];
  const d = Math.hypot(player.x - e.x, player.y - e.y);
  shakeX += 5; shakeY += 5;
  AUDIO.play('boss');
  burst(e.x + 20, e.y, C.paper1, 20, 120);
  if (d < 40) hurtPlayer(e.dmg * 1.2);
}

// ============ 主循环 ============
// 挥砍推进 + 收招留刀光
function tickSwing(dt) {
  if (!player.swing) return;
  const sw = player.swing;
  sw.t -= dt;
  if (sw.t > 0) return;
  const base = sw.base;
  if (!sw.cast) {
    const W = WEAPONS[sw.fam];
    if (sw.sw.mode === 'swing') {
      const a0 = base + sw.sw.a0, a1 = base + sw.sw.a1;
      slashGhosts.push({ x: player.x, y: player.y - 8, a0, a1, R: (sw.sw.reach || W.reach) * 0.82, colors: W.trail, t: 0.26, max: 0.26 });
    } else if (sw.sw.mode === 'ring') {
      slashGhosts.push({ x: player.x, y: player.y - 8, ring: true, R: 40, colors: W.trail, t: 0.3, max: 0.3 });
    } else if (sw.sw.mode === 'thrust') {
      slashGhosts.push({ x: player.x, y: player.y - 8, thrust: base, len: (sw.sw.reach || W.reach) * 1.05, colors: W.trail, t: 0.2, max: 0.2 });
    } else if (sw.sw.mode === 'cast') {
      // 法杖 / 暗器没有刀光，用一小圈灵气收招；段位越高圈越大
      slashGhosts.push({ x: player.x, y: player.y - 8, ring: true, R: 9 + (sw.step || 0) * 3, colors: W.trail, t: 0.18, max: 0.18 });
    }
  }
  player.swing = null;
}

function update(dt) {
  time += dt;
  if (state !== 'play') return;

  // 时辰推进。顿帧时也照走 —— 天色与钟声不该被一次砍击的停顿卡住。
  clock.advance(dt);
  if (clock.changed) {
    clock.changed = 0;
    if (meditateT <= 0) {  // 打坐自己已经报过时辰，别重复
      const p = clock.phase;
      msg('钟声 · ' + p.name + '·' + p.sub, p.color);
      AUDIO.play('bell', p.id);
      if (p.id === 'zi') msg('夜色深沉，阴物出没 · 稀有掉落 +40%', C.pur3);
      else if (p.id === 'you') msg('日薄西山，野兽开始成群', C.red3);
    }
  }
  if (meditateT > 0) meditateT = Math.max(0, meditateT - dt);
  if (sleepT > 0) sleepT = Math.max(0, sleepT - dt);
  if (rumor) {
    rumor.t -= dt;
    const arrived = Math.hypot(player.x - rumor.x, player.y - rumor.y) < 52;
    if (arrived) {
      // 循着话找到地头，本身就是一件"值得说的事" —— 传闻才算闭环，
      // 否则它永远只是一张地图上的问号。
      msg('寻到' + rumor.name + ' · 侠名 +3', C.gold3);
      addFame(3);
      AUDIO.play('pickup');
    }
    if (rumor.t <= 0 || arrived) rumor = null;
  }
  if (bannerT > 0) bannerT = Math.max(0, bannerT - dt);
  {
    // 只在"跨进来"的那一刻报一次：站在村里来回挪不该反复弹
    const iv = inVillage(player.x, player.y, -16);
    if (iv && !wasInVillage) {
      banner('青云集', clock.isNight ? '夜深了，只剩客栈还亮着灯' : '青云野 · 有人烟处');
    }
    wasInVillage = iv;
  }
  // 地宫：清层结算 / 深入地脉的黑幕
  dgCheckClear();
  if (dgDipT > 0) {
    dgDipT += dt;
    if (dgDipAct && dgDipT >= 0.34) { const f = dgDipAct; dgDipAct = null; f(); }
    if (dgDipT > 0.74) dgDipT = 0;
  }
  {
    const iv = dgIn(player.x, player.y);
    if (iv && !wasInDg) banner('青云古洞', '第 ' + dgFloor + ' 层 · 火把之外都是黑的');
    wasInDg = iv;
  }

  if (hitstop > 0) { hitstop -= dt; tickSwing(dt); return; }

  player.atkCd -= dt; player.atkT -= dt; player.dashT -= dt;
  player.dashCd -= dt; player.flash -= dt; player.iframe -= dt; player.windCd -= dt;
  player.hurtFlash = Math.max(0, player.hurtFlash - dt);
  comboPulse = Math.max(0, comboPulse - dt * 4);
  if (player.atkCd <= 0) player.atkBuf -= dt;
  skills.qi.cd -= dt; skills.wu.cd -= dt; skills.thunder.cd -= dt; wuT -= dt;
  shakeX *= Math.pow(0.0025, dt); shakeY *= Math.pow(0.0025, dt);
  if (Math.abs(shakeX) < 0.05) shakeX = 0;
  if (Math.abs(shakeY) < 0.05) shakeY = 0;
  if (comboT > 0) { comboT -= dt; if (comboT <= 0) combo = 0; }

  // 真气回复
  player.qi = Math.min(maxQi(), player.qi + stats().qiRegen * dt);
  // 中毒
  if (player.poisonT > 0) {
    player.poisonT -= dt;
    player.hp -= player.poison * dt;
    if (Math.random() < dt * 4) dmgNum(player.x + (Math.random() * 8 - 4), player.y - 14, '-' + player.poison, C.jade2);
    if (player.hp <= 0) { player.hp = 0; showDead(); }
  }
  if (player.poisonImmuneT > 0) player.poisonImmuneT = Math.max(0, player.poisonImmuneT - dt);
  if (player.drunkT > 0) {
    player.drunkT = Math.max(0, player.drunkT - dt);
    if (player.drunkT === 0) { player.drunk = 0; msg('酒意散了', C.paper1); }
  }

  if (player.atkBuf > 0 && player.atkCd <= 0) attack();

  // 挥砍推进（顿帧时也推进，让"世界的顿"与"刀的动"分开，砍击才有分量）
  tickSwing(dt);

  // 移动（键盘与摇杆共用一套；摇杆在推，就用摇杆的向量）
  let mx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  let my = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
  let stickAmp = 1;
  // 兜底：浏览器若在没派发 pointerup / pointercancel 的情况下悄悄收回了指针捕获，
  // 摇杆的 dx/dy 会永远停在最后一个方向。每帧核一次捕获状态即可自愈。
  if (touch.stick.on && touch.stick.cap && ovEl.hasPointerCapture && !ovEl.hasPointerCapture(touch.stick.id)) stickEnd();
  if (touch.enabled && touch.stick.on) {
    mx = touch.stick.dx; my = touch.stick.dy;
    stickAmp = Math.min(1, Math.hypot(mx, my) * 1.5); // 轻推慢走，推到底全速
  }
  player.moving = !!(mx || my);
  if (player.moving) {
    if (Math.abs(mx) >= Math.abs(my)) player.dir = mx > 0 ? 'right' : 'left';
    else player.dir = my > 0 ? 'down' : 'up';
    const len = Math.hypot(mx, my); mx /= len; my /= len;
    const sp = 76 * (1 + Math.min(40, stats().spd) / 100) * (player.dashT > 0 ? 2.7 : 1) * stickAmp;
    const nx = player.x + mx * sp * dt, ny = player.y + my * sp * dt;
    if (canStand(nx, player.y)) player.x = nx;
    if (canStand(player.x, ny)) player.y = ny;
    if (player.dashT > 0) afterimage(player.x, player.y - 8, playerTex[player.dir][0], 16, 18);
  }
  pMesh.material.map = playerTex[player.dir][player.moving ? (time * 8 | 0) % 2 : 0];
  const fl = player.flash > 0;
  pMesh.material.color.setRGB(fl ? 1.9 : 1, fl ? 0.55 : 1, fl ? 0.55 : 1);
  const lunge = player.atkT > 0 ? (player.atkT / 0.24) * (player.lunge || 0) : 0;
  const [lfx, lfy] = DIRV[player.dir];
  pMesh.position.set(player.x + lfx * lunge, player.y - 8 + lfy * lunge, 0);
  pMesh.renderOrder = 1000 + Math.round(player.y) + 0.5;
  // 牌坊淡出：门楼有 58px 高，玩家从底下过时正好被匾额挡住，
  // 与其让它盖住人，不如让它自己"让开"——这是等距游戏里最省事的遮挡解法。
  if (PF) {
    const nearGate = Math.abs(player.x - VILLAGE.gateX) < 46 &&
      player.y > VILLAGE.y1 - 66 && player.y < VILLAGE.y1 + 10;
    const target = nearGate ? 0.32 : 1;
    PF.mesh.material.opacity += (target - PF.mesh.material.opacity) * Math.min(1, dt * 9);
  }
  // 掌柜值守：开店才站在门口，打烊就回屋。
  // 站着的人也不能是根柱子 —— 1px 的呼吸起伏，配合灯影就活了。
  for (const o of npcObjs) {
    const open = shopOpenNow(o.npc);
    o.mesh.visible = open;
    if (!open) continue;
    const bob = Math.sin(time * 1.7 + o.x * 0.1) * 0.8;
    o.mesh.position.set(o.x, o.y - o.h / 2 + bob, 0);
    o.mesh.renderOrder = 1000 + Math.round(o.y);
  }
  // 村民：按作息上下街。切换时不留突兀 —— 人不是"刷"出来的，
  // 淡入淡出各 0.4 秒，看着像从门后走出来 / 走进巷子里。
  for (const o of vilObjs) {
    const on = phaseOn(o.data.phases);
    o.fade = (o.fade === undefined ? (on ? 1 : 0) : o.fade) + ((on ? 1 : 0) - (o.fade || 0)) * Math.min(1, dt * 3.2);
    if (o.fade < 0.02) { o.mesh.visible = false; continue; }
    o.mesh.visible = true;
    o.mesh.material.opacity = Math.min(1, o.fade);
    const bob = Math.sin(time * 1.9 + o.x * 0.13) * 0.9;
    o.mesh.position.set(o.x, o.y - o.h / 2 + bob, 0);
    o.mesh.renderOrder = 1000 + Math.round(o.y);
  }
  pShadow.position.set(player.x, player.y - 0.5, 0);
  pShadow.renderOrder = 997 + Math.round(player.y);
  pShadow.visible = true;

  // 补怪 & 精英
  spawnT -= dt;
  if (spawnT <= 0) {
    spawnT = 11;
    for (const c of camps) {
      const alive = enemies.filter(e => !e.dead && e.camp === c).length;
      const cap = 4 + (c.tier - 1);
      if (alive < cap) {
        // 子时营地会出阴物 —— 白天见不到的东西，晚上成群往外冒
        const nightPick = clock.isNight && Math.random() < 0.7;
        const pool = nightPick ? NIGHT_POOL : c.types;
        const t = pool[(Math.random() * pool.length) | 0];
        spawnEnemy(t, c.x + Math.random() * 60 - 30, c.y + Math.random() * 60 - 30, c);
      }
    }
  }
  eliteT -= dt;
  if (eliteT <= 0) {
    eliteT = 26;
    if (!enemies.some(e => !e.dead && e.elite)) {
      const c = camps[(Math.random() * camps.length) | 0];
      const t = c.types[(Math.random() * c.types.length) | 0];
      const mod = ELITE_MODS[(Math.random() * ELITE_MODS.length) | 0];
      spawnEnemy(t, c.x + 40, c.y + 40, c, mod);
      msg('精英来袭 · ' + mod.name + '·' + MONSTERS[t].name, mod.color);
      AUDIO.play('boss');
    }
  }

  // ---- 敌手 ----
  const playerSafe = inVillage(player.x, player.y, 6);
  const eFree = (x, y) => canStand(x, y) && !inVillage(x, y, 0);
  for (const e of enemies) {
    if (e.dead) continue;
    const m = MONSTERS[e.type];
    e.cd -= dt; e.flash -= dt; e.anim += dt; e.hitJit -= dt; e.stagger -= dt;
    if (e.combatT > 0) e.combatT -= dt;
    // 击退惯性
    if (Math.abs(e.kvx) > 1 || Math.abs(e.kvy) > 1) {
      const kx = e.kvx * dt, ky = e.kvy * dt;
      if (eFree(e.x + kx, e.y)) e.x += kx;
      if (eFree(e.x, e.y + ky)) e.y += ky;
      e.kvx *= Math.pow(0.0015, dt); e.kvy *= Math.pow(0.0015, dt);
    } else { e.kvx = 0; e.kvy = 0; }

    const dx = player.x - e.x, dy = player.y - e.y, d = Math.hypot(dx, dy);
    const campPos = e.camp || { x: SPAWN.x, y: SPAWN.y };
    const dc = Math.hypot(e.x - campPos.x, e.y - campPos.y);
    // 青云集是安全区：踏进城墙便不再被盯上，追到墙根的也会散去
    if (playerSafe) e.aggro = false;
    else if (d < m.aggro) e.aggro = true;
    if (dc > 190 && !e.dg) e.aggro = false;   // 洞里的怪没有后方可退
    // 万一有东西已经落在村里（老存档／瞬移残留），送回它的营地
    if (inVillage(e.x, e.y, 0)) {
      burst(e.x, e.y - 6, C.pur2, 12, 80);
      e.x = campPos.x; e.y = campPos.y; e.aggro = false;
    }
    if (e.stagger > 0) {
      // 受击僵直：不移动不出手
      e.mesh.material.map = monTex[e.type].frames[0];
      e.mesh.position.set(e.x, e.y - e.h / 2, 0);
      continue;
    }
    let vx = 0, vy = 0, speed = m.speed * (e.aggro ? 1 : 0.45);

    // 首领阶段
    if (e.type === 'boss') {
      if (!e.phase2 && e.hp < e.maxHp * 0.5) {
        e.phase2 = true; msg(MONSTERS[e.type].name + ' · 怒', C.red3); AUDIO.play('boss');
        burst(e.x, e.y - 12, C.red2, 20, 110);
      }
      if (e.phase2) {
        e.spinCd -= dt;
        if (e.spinWind > 0) { e.spinWind -= dt; if (e.spinWind <= 0) bossSpin(e); }
        else if (e.spinCd <= 0) { e.spinCd = 8; e.spinWind = 1.0; msg('旋风将至！', C.red3); }
      }
    }
    if (e.type === 'treant') {
      e.spinCd -= dt;
      if (e.spinWind > 0) { e.spinWind -= dt; if (e.spinWind <= 0) bossSlam(e); }
      else if (e.spinCd <= 0 && d < 80) { e.spinCd = 5; e.spinWind = 0.9; msg('树妖 · 根须绞杀', C.jade3); }
    }

    if (!e.aggro) {
      e.wanderT -= dt;
      if (e.wanderT <= 0) {
        e.wanderT = 1 + Math.random() * 1.5;
        const a = Math.random() * Math.PI * 2;
        e.wx = Math.cos(a); e.wy = Math.sin(a);
        if (Math.random() < 0.4) { e.wx = 0; e.wy = 0; }
      }
      vx = e.wx * 0.4; vy = e.wy * 0.4;
      if (dc > 52) { vx = (campPos.x - e.x) / dc; vy = (campPos.y - e.y) / dc; }
    } else if (m.behavior === 'archer') {
      if (e.windup > 0) {
        e.windup -= dt;
        if (e.windup <= 0) {
          const mesh = quad(ARROW_TEX, 8, 3);
          const a = Math.atan2(player.y - e.y, player.x - e.x);
          projectiles.push({ x: e.x, y: e.y - 6, vx: Math.cos(a) * 130, vy: Math.sin(a) * 130, t: 2.2, mesh, dmg: e.dmg });
          AUDIO.play('windup');
        }
      } else if (d > m.range) { vx = dx / d; vy = dy / d; }
      else if (d < 38) { vx = -dx / d * 0.8; vy = -dy / d * 0.8; }
      else if (e.cd <= 0) { e.cd = e.cdMax; e.windup = m.windup; AUDIO.play('windup'); }
    } else if (m.behavior === 'caster') {
      if (e.windup > 0) {
        e.windup -= dt;
        if (e.windup <= 0) {
          const mesh = quad(ORB_TEX, 8, 8);
          const a = Math.atan2(player.y - e.y, player.x - e.x);
          projectiles.push({ x: e.x, y: e.y - 6, vx: Math.cos(a) * 62, vy: Math.sin(a) * 62, t: 4, mesh, dmg: e.dmg, homing: 0.9 });
          AUDIO.play('windup');
        }
      } else if (d < 60) { vx = -dx / d * 0.9; vy = -dy / d * 0.9; }
      else if (d > 96) { vx = dx / d * 0.7; vy = dy / d * 0.7; }
      else if (e.cd <= 0) { e.cd = e.cdMax; e.windup = m.windup; AUDIO.play('windup'); }
    } else if (m.behavior === 'flyer') {
      if (e.windup > 0) {
        e.windup -= dt;
        if (e.windup <= 0) {
          const mesh = quad(FIRE_TEX, 7, 7);
          const a = Math.atan2(player.y - e.y, player.x - e.x);
          projectiles.push({ x: e.x, y: e.y - 6, vx: Math.cos(a) * 118, vy: Math.sin(a) * 118, t: 2.4, mesh, dmg: e.dmg });
          AUDIO.play('windup');
        }
      } else if (d < 52) { vx = -dx / d; vy = -dy / d; }
      else if (d > 92) { vx = dx / d; vy = dy / d; }
      else { vx = Math.cos(time * 2 + e.x) * 0.9; vy = Math.sin(time * 2 + e.x) * 0.9; if (e.cd <= 0) { e.cd = e.cdMax; e.windup = m.windup; } }
    } else if (m.behavior === 'charger') {
      if (e.charge > 0) {
        e.charge -= dt;
        const nx = e.x + e.chx * speed * 3.6 * dt, ny = e.y + e.chy * speed * 3.6 * dt;
        if (eFree(nx, ny)) { e.x = nx; e.y = ny; }
        if (Math.random() < dt * 20) afterimage(e.x, e.y - e.h / 2, monTex[e.type].frames[0], e.h, e.h);
        if (d < 20) { hurtPlayer(e.dmg * 1.15); e.charge = 0; e.stagger = 0.3; burst(e.x, e.y - 6, C.paper2, 10, 80); }
      } else if (e.windup > 0) {
        e.windup -= dt;
        if (e.windup <= 0) {
          const a = Math.atan2(player.y - e.y, player.x - e.x);
          e.chx = Math.cos(a); e.chy = Math.sin(a); e.charge = 0.34;
          AUDIO.play('windup');
        }
      } else if (d < 108 && e.cd <= 0) { e.cd = e.cdMax; e.windup = m.windup; }
      else if (d > m.range) { vx = dx / d; vy = dy / d; }
    } else if (m.behavior === 'tank') {
      if (e.windup > 0) {
        e.windup -= dt;
        if (e.windup <= 0) {
          shakeX += 4; shakeY += 4;
          burst(e.x, e.y - 4, C.paper1, 16, 100);
          AUDIO.play('boss');
          if (Math.hypot(player.x - e.x, player.y - e.y) < 36) hurtPlayer(e.dmg);
        }
      } else if (d > m.range) { vx = dx / d * 0.6; vy = dy / d * 0.6; }
      else if (e.cd <= 0) { e.cd = e.cdMax; e.windup = m.windup; AUDIO.play('windup'); }
    } else if (m.behavior === 'blinker') {
      e.blinkCd -= dt;
      if (e.windup > 0) {
        e.windup -= dt;
        if (e.windup <= 0) enemyStrike(e);
      } else if (d > 92 && e.blinkCd <= 0) {
        e.blinkCd = 3.6;
        const a = Math.atan2(player.y - e.y, player.x - e.x);
        const tx = player.x - Math.cos(a) * 34, ty = player.y - Math.sin(a) * 34;
        // 不闪进村子，也不闪进墙里 —— 落点不合法就留在原地
        if (!inVillage(tx, ty, 0) && canStand(tx, ty)) {
          burst(e.x, e.y - 6, C.pur2, 10, 70);
          e.x = tx; e.y = ty;
          burst(e.x, e.y - 6, C.pur2, 10, 70);
        }
      } else if (d > m.range) { vx = dx / d; vy = dy / d; }
      else if (e.cd <= 0) { e.cd = e.cdMax; e.windup = m.windup; AUDIO.play('windup'); }
    } else {
      if (e.windup > 0) {
        e.windup -= dt;
        e.flash = Math.max(e.flash, 0.05);
        if (e.windup <= 0) enemyStrike(e);
      } else if (d > m.range) { vx = dx / d; vy = dy / d; }
      else if (e.cd <= 0) { e.cd = e.cdMax; e.windup = m.windup; AUDIO.play('windup'); }
    }

    const nx = e.x + vx * speed * dt, ny = e.y + vy * speed * dt;
    if (eFree(nx, e.y)) e.x = nx;
    if (eFree(e.x, ny)) e.y = ny;

    e.mesh.material.map = monTex[e.type].frames[(e.anim * (m.behavior === 'flyer' ? 10 : 4) | 0) % 2];
    if (e.flash > 0) e.mesh.material.color.setRGB(2.1, 1.7, 1.7);
    else e.mesh.material.color.setRGB(1, 1, 1);
    const jit = e.hitJit > 0 ? Math.sin(e.hitJit * 70) * 2 : 0;
    e.mesh.position.set(e.x + jit, e.y - e.h / 2, 0);
    e.mesh.renderOrder = 1000 + Math.round(e.y);
    if (e.shadow) {
      e.shadow.position.set(e.x, e.y - 0.5, 0);
      e.shadow.renderOrder = 999 + Math.round(e.y) - 2;
    }
    if (e.ring) {
      e.ring.position.set(e.x, e.y - e.h / 2, 0);
      e.ring.renderOrder = 999 + Math.round(e.y);
      e.ring.material.opacity = 0.45 + Math.sin(time * 6) * 0.25;
    }
  }

  // ---- 投射物 ----
  for (const p of projectiles) {
    p.t -= dt;
    if (p.homing) {
      const a = Math.atan2(player.y - 8 - p.y, player.x - p.x);
      const sp = Math.hypot(p.vx, p.vy) || 1;
      p.vx += (Math.cos(a) * sp - p.vx) * p.homing * dt;
      p.vy += (Math.sin(a) * sp - p.vy) * p.homing * dt;
      const ns = Math.hypot(p.vx, p.vy); p.vx = p.vx / ns * sp; p.vy = p.vy / ns * sp;
    }
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.spin) p.mesh.rotation.z += p.spin * dt;
    // 弹体撞墙就碎。以前压根没做墙体判定，飞镖 / 法球能直接穿墙打人，
    // 隔着一堵墙也能磨死 boss —— 远程兵器因此强得离谱。
    if (!canStand(p.x, p.y)) {
      burst(p.x, p.y, p.friendly ? C.paper3 : C.red3, 5, 45);
      p.t = 0;
      continue;
    }
    // 村外射进来的东西在城墙处就被挡下
    if (!p.friendly && inVillage(p.x, p.y, 0)) {
      burst(p.x, p.y, C.jade3, 7, 60);
      p.t = 0;
    }
    p.mesh.position.set(p.x, p.y, 0);
    p.mesh.renderOrder = 1500 + Math.round(p.y);
    if (p.friendly) {
      for (const e of enemies) {
        if (e.dead || p.hitSet.has(e)) continue;
        if (Math.hypot(p.x - e.x, p.y - (e.y - e.h / 2)) < (e.h * 0.6 + 4)) {
          p.hitSet.add(e);
          const ang = Math.atan2(p.vy, p.vx);
          const crit = p.crit === undefined ? Math.random() * 100 < stats().crit : p.crit;
          hitEnemy(e, { dmg: p.dmg, crit }, ang, 8);
          if (--p.pierce <= 0) { p.t = 0; break; }
        }
      }
    } else if (Math.hypot(p.x - player.x, p.y - (player.y - 8)) < 9) {
      hurtPlayer(p.dmg); p.t = 0;
      burst(p.x, p.y, C.red3, 6, 60);
    }
  }
  projectiles = projectiles.filter(p => { if (p.t <= 0) { scene.remove(p.mesh); return false; } return true; });

  // ---- 天雷结算 ----
  for (const b of bolts) {
    b.t -= dt;
    if (!b.done && b.t <= 0) {
      b.done = true;
      shakeX += 3; shakeY += 3;
      hitstop = Math.max(hitstop, 0.05);
      burst(b.x, b.y, C.gold3, 16, 120);
      for (const e of enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - b.x, e.y - b.h / 2 - b.y) < b.r + e.h * 0.3) {
          hitEnemy(e, { dmg: b.dmg, crit: Math.random() * 100 < stats().crit }, Math.PI / 2, 10);
        }
      }
      AUDIO.play('thunder2');
      spawnBoltFx(b.x, b.y);
    }
  }
  bolts = bolts.filter(b => b.t > -0.5);

  // ---- 掉落 ----
  for (const d of drops) {
    d.t += dt;
    if (!d.mesh) {
      const cv = d.kind === 'gear' ? dropIconCanvas(d.item) : (ICONS[d.kind] || ICONS.coin);
      const sz = d.kind === 'gear' ? 11 : 8;
      d.mesh = quad(tex(cv), sz, sz * (cv.height / cv.width));
    }
    if (d.kind === 'gear' && !d.beam && d.item.r >= 2) {
      d.beam = quad(beamTexture(RARITY[d.item.r].color), d.epic ? 6 : 3, d.epic ? 56 : 40);
      d.beam.material.opacity = 0.9;
      if (d.epic) d.beam.material.blending = THREE.AdditiveBlending;
    }
    d.mesh.position.set(d.x, d.y - 4 + Math.sin(d.t * 4) * 1.5, 0);
    d.mesh.renderOrder = 500 + Math.round(d.y);
    const dd = Math.hypot(d.x - player.x, d.y - player.y);
    // 背包满时不要吸附。以前是先无条件吸到脚下、再判断能不能捡，
    // 捡不起来时光柱就黏在人物身上跟着跑 —— 看着像掉在地上，其实永远拿不走。
    const full = d.kind !== 'coin' && invFull();
    if (!full && dd < 26 && dd > 8) {
      const sp = 150 * dt;
      d.x += (player.x - d.x) / dd * sp; d.y += (player.y - d.y) / dd * sp;
    }
    if (dd < 9 && pickup(d)) d.taken = true;
    // 满包又凑近了，提示一下（带冷却，否则每帧刷屏）
    if (full && dd < 30) {
      d.warnT = (d.warnT || 0) - dt;
      if (d.warnT <= 0) { d.warnT = 2.5; msg('行囊已满 · Tab 整理，或花银两扩充', C.red3); }
    }
  }
  drops = drops.filter(d => {
    if (d.taken) { scene.remove(d.mesh); if (d.beam) scene.remove(d.beam); return false; }
    if (d.beam) {
      d.beam.position.set(d.x, d.y + (d.epic ? 24 : 16), 0);
      d.beam.material.opacity = 0.55 + Math.sin(time * 5 + d.x) * 0.3;
      if (d.epic) d.beam.material.opacity += 0.18;
    }
    return true;
  });

  // ---- 粒子 / 火花 / 残影 ----
  for (const p of particles) {
    p.t -= dt;
    p.vy += 150 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= Math.pow(0.15, dt);
    if (!p.mesh) { p.mesh = solidQuad(p.size, p.size, p.color); p.mesh.renderOrder = 1200; }
    p.mesh.position.set(p.x, p.y, 0);
    p.mesh.material.opacity = Math.max(0, p.t / p.max);
    p.mesh.scale.setScalar(Math.max(0.25, p.t / p.max));
  }
  particles = particles.filter(p => { if (p.t <= 0) { scene.remove(p.mesh); return false; } return true; });

  for (const s of sparks) {
    s.t -= dt;
    const k = 1 - s.t / s.max;
    s.mesh.position.set(s.x, s.y, 0);
    s.mesh.scale.setScalar(0.5 + k * 1.6);
    s.mesh.material.opacity = Math.max(0, 1 - k);
  }
  sparks = sparks.filter(s => { if (s.t <= 0) { scene.remove(s.mesh); return false; } return true; });

  for (const g of ghosts) { g.t -= dt; g.mesh.material.opacity = Math.max(0, g.t / 0.22) * 0.42; }
  ghosts = ghosts.filter(g => { if (g.t <= 0) { scene.remove(g.mesh); return false; } return true; });

  for (const g of slashGhosts) g.t -= dt;
  slashGhosts = slashGhosts.filter(g => g.t > 0);

  for (const n of dmgNums) { n.t -= dt; n.y -= dt * 26; n.x += n.vx * dt; }
  dmgNums = dmgNums.filter(n => n.t > 0);
  for (const m of messages) m.t -= dt;
  messages = messages.filter(m => m.t > 0);
  saveT += dt;
  if (saveT > 12) { saveT = 0; save(); msg('已保存', C.paper1); }
}

// 雷击特效：一道纵向折线 + 落点光
let boltFx = [];
function spawnBoltFx(x, y) {
  boltFx.push({ x, y, t: 0.22, max: 0.22 });
}

// ============ overlay ============
const ov = document.getElementById('ov');
ov.width = LW; ov.height = LH;
const octx = ov.getContext('2d');

// 待机是否显示兵器：默认「小手拿」；?weapon=attack 切成「只有出招时才显形」。
// 两种方案都保留，玩家按自己偏好选。
const SHOW_IDLE_WEAPON = (location.search.match(/[?&]weapon=([^&]+)/) || [])[1] !== 'attack';

// 手部锚点（相对 16×18 主角贴图中心）：让兵器从「手」上长出去，不是从胸口
const HAND_OFF = { right: [4, 2], left: [-4, 2], up: [-3, 1], down: [3, 1] };

// 挥砍角度曲线：主手用真实进度，副手用滞后进度 + 绕朝向镜像，
// 这样两把刀一正一反、有先有后，才看得出是"双刀交替劈"。
function swingAng(sw, base, p) {
  const e = 1 - Math.pow(1 - Math.max(0, Math.min(1, p)), 2.2);
  if (sw.mode === 'ring') return { ang: base - Math.PI * 1.1 + e * Math.PI * 2.2, off: 0, cast: false };
  if (sw.mode === 'thrust') return { ang: base, off: e * 9, cast: false };
  if (sw.mode === 'cast') return { ang: base - 0.62 + e * 0.42, off: e * 3, cast: true };
  return { ang: base + sw.a0 + (sw.a1 - sw.a0) * e, off: 0, cast: false };
}

function drawWeaponHeld(camX, camY) {
  const fam = weaponFam();
  const W = WEAPONS[fam];
  const it = player.equip.weapon;
  const r = it ? (it.r | 0) : 0;
  const color = it ? RARITY[r].color : null;
  const cv = weaponCanvas(fam, color, r, it ? it.skin : 0);
  const px = player.x - camX, py = player.y - 8 - camY;
  const base = DIRA[player.dir];
  const dual = fam === 'dual';
  let ang = 0, alpha = 1, off = 0, casting = false;
  let dualAng = 0, dualP = 0, hasDual = false;

  if (player.swing) {
    const sw = player.swing.sw;
    const p = 1 - player.swing.t / player.swing.dur;
    const s1 = swingAng(sw, base, p);
    ang = s1.ang; off = s1.off; casting = s1.cast;
    alpha = p > 0.88 ? 1 - (p - 0.88) / 0.12 * 0.4 : 1;
    if (dual) {
      // 副手晚 dualDelay 个进度、角度绕朝向镜像：主手从左劈到右，副手正好从右劈到左。
      // 以前副手写死成 ang+0.55，是个不随动作变化的固定偏移，两把刀永远平行，
      // 看着就像一把刀在挥 —— 这才是"双刀不像双刀"的根因。
      const delay = sw.dualDelay === undefined ? 0.26 : sw.dualDelay;
      dualP = Math.max(0, p - delay);
      dualAng = base * 2 - swingAng(sw, base, dualP).ang;
      hasDual = true;
    }
  } else {
    // 待机：贴着手斜垂，缩小到掌中尺寸
    if (player.dir === 'left') ang = Math.PI - 1.05;
    else if (player.dir === 'up') ang = -Math.PI + 1.25;
    else if (player.dir === 'right') ang = 1.05;
    else ang = Math.PI * 0.78;
    // 待机时两把刀张开成 V 形，一眼能看出是双持
    if (dual) { dualAng = ang - 0.72; hasDual = true; }
  }
  const [hox, hoy] = HAND_OFF[player.dir] || HAND_OFF.down;
  // 双持时两只手要分得更开，否则两把刀挤在角色胸口那一小片
  const handK = dual ? 1.75 : 1;
  const hx = px + hox * handK + Math.cos(ang) * (1 + off) * 0.4;
  const hy = py + hoy + Math.sin(ang) * (1 + off) * 0.4;
  const sc = player.swing ? SWING_SCALE : HELD_SCALE;
  // 双刀精灵只有 5×10，按通用缩放画出来不足 4px 宽，两把叠在角色身上完全看不出是两把。
  // 双持单独放大一档（出招更明显），这是"能看出在挥双刀"的前提。
  const scDual = sc * (player.swing ? 1.5 : 1.32);
  const tipLen = cv.height * (dual ? scDual : sc) * 0.85;

  // 挥砍刀光（攻距已整体收小，弧半径跟着缩）
  if (player.swing && !casting) {
    const sw = player.swing.sw;
    const p = 1 - player.swing.t / player.swing.dur;
    if (sw.mode === 'swing') {
      const a0 = base + sw.a0;
      const cur = base + sw.a0 + (sw.a1 - sw.a0) * (1 - Math.pow(1 - p, 2.2));
      drawArcFx(octx, px, py, a0, cur, (sw.reach || W.reach) * 0.78, W.trail, 0.6 + p * 0.4, 0.9);
      // 双刀：副手也带一道镜像刀光，两道弧交叉才叫"双刀合击"
      if (hasDual) {
        const cur2 = base * 2 - (base + sw.a0 + (sw.a1 - sw.a0) * (1 - Math.pow(1 - dualP, 2.2)));
        drawArcFx(octx, px, py, base * 2 - a0, cur2, (sw.reach || W.reach) * 0.74, W.trail, 0.45 + dualP * 0.4, 0.7);
      }
    } else if (sw.mode === 'ring') {
      drawRingFx(octx, px, py, (sw.reach || W.reach) * 0.70, W.trail, 0.55, 0.9);
    } else if (sw.mode === 'thrust') {
      drawThrustFx(octx, px, py, base, (sw.reach || W.reach) * (0.35 + p * 0.75), W.trail, 0.55, 0.9);
    }
  }

  // 仙品 / 传世：刃身品阶辉光；法杖 / 暗器出招时杖尖 / 腕间也亮一下
  if ((r >= 3 && SHOW_IDLE_WEAPON) || (r >= 3 && player.swing) || casting) {
    const tx = hx + Math.cos(ang) * tipLen, ty = hy + Math.sin(ang) * tipLen;
    if (r >= 3) drawRareAura(octx, tx, ty, r >= 4 ? 9 : 7, color, 0.9, time, r);
    if (casting) drawRareAura(octx, tx, ty, 6, W.trail[0], 0.7, time, 0);
  }

  if (!player.swing && !SHOW_IDLE_WEAPON) return;   // 方案二：平时不显示兵器
  drawWeaponAt(octx, cv, hx, hy, ang, alpha, dual ? scDual : sc);
  if (hasDual) {
    // 副手：另一只手出发，角度与主手镜像，尺寸略小（左手非惯用手）。
    // 锚点放在另一侧、但只偏出八成，刀身贴着身体斜过去 —— 再往外就横穿角色，
    // 完全放中线又和主手叠成一团，两种都看不出是两把刀。
    const hx2 = px - hox * handK * 0.85 + Math.cos(dualAng) * 3;
    const hy2 = py + hoy + Math.sin(dualAng) * 3;
    drawWeaponAt(octx, cv, hx2, hy2, dualAng, alpha * 0.95, scDual * 0.9);
  }
}

function drawSkillBar() {
  // 触屏用右侧动作键，底部技能栏让位给摇杆
  if (touch.enabled) { skillRects = []; return; }
  octx.imageSmoothingEnabled = false;
  const weaponIconC = it => iconFor(it);
  const eqW = player.equip.weapon;
  const slots = [
    { id: 'slash', key: 'J', icon: eqW ? weaponIcon(eqW.fam, eqW.r | 0, eqW.skin, RARITY[eqW.r | 0].color) : weaponIcon('sword'), cd: player.atkCd, max: attackInterval(), cost: 0 },
    { id: 'qi', key: 'K', icon: QI_C, cd: skills.qi.cd, max: skills.qi.max, cost: ACTIVES.qi.cost },
    { id: 'wu', key: 'L', icon: WU_C, cd: skills.wu.cd, max: skills.wu.max, cost: ACTIVES.wu.cost },
    {
      id: 'thunder', key: 'H', icon: THUNDER_C, cd: skills.thunder.cd, max: skills.thunder.max, cost: ACTIVES.thunder.cost,
      locked: nodeLevel(player.skillLv, 'tianlei') < 1,
    },
    { id: 'dash', key: '⇧', icon: SHEN_C, cd: player.dashCd, max: 0.9, cost: 0 },
    { id: 'potion', key: 'Q', icon: ICONS.potion, cd: 0, max: 1, cost: 0 },
  ];
  const size = 22, gap = 3;
  // 底栏高 44（LH-44 起）。格子原来放 LH-34，格子底正好压在 258，
  // 下面的按键字母只分到 12px，再叠上 textBaseline='top' 的偏移，
  // 字母下半截直接被画布底边切掉。整条上移 2px，字母留出 4px 余量。
  const x0 = LW / 2 - (slots.length * (size + gap) - gap) / 2, y0 = LH - 36;
  skillRects = [];
  slots.forEach((s, i) => {
    const x = Math.round(x0 + i * (size + gap)), y = y0;
    skillRects.push({ id: s.id, x, y, w: size, h: size });
    octx.fillStyle = C.black; octx.fillRect(x, y, size, size);
    octx.fillStyle = C.ink2; octx.fillRect(x + 1, y + 1, size - 2, size - 2);
    octx.strokeStyle = s.locked ? C.ink3 : C.gold1; octx.lineWidth = 1;
    octx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
    const k = Math.min(18 / s.icon.width, 18 / s.icon.height);
    const iw = s.icon.width * k, ih = s.icon.height * k;
    octx.globalAlpha = s.locked ? 0.35 : 1;
    octx.drawImage(s.icon, x + (size - iw) / 2, y + (size - ih) / 2, iw, ih);
    octx.globalAlpha = 1;
    const cd = Math.max(0, s.cd);
    if (cd > 0) {
      octx.globalAlpha = 0.7; octx.fillStyle = C.ink1;
      octx.fillRect(x + 1, y + 1, size - 2, Math.round((size - 2) * Math.min(1, cd / Math.max(0.01, s.max))));
      octx.globalAlpha = 1;
      if (cd >= 0.15) {
        octx.font = 'bold 9px monospace'; octx.fillStyle = C.paper3;
        octx.fillText(cd.toFixed(1), x + 4, y + 9);
      }
    }
    // 注意：drawOverlay 前面为了左上角数值把 textBaseline 设成了 'top' 且没恢复，
    // 这里必须显式声明，否则 y 会被当成字形顶部往下画，字母下半截出画。
    octx.font = 'bold 8px monospace'; octx.fillStyle = C.gold3; octx.textBaseline = 'top';
    octx.fillText(s.key, x + (size - octx.measureText(s.key).width) / 2, y + size + 2);
  });
}

function drawMinimap() {
  const mw = 80, mh = 58, mx = LW - mw - 8, my = 8;
  octx.fillStyle = 'rgba(18,22,31,0.72)';
  octx.fillRect(mx - 2, my - 2, mw + 4, mh + 4);
  octx.strokeStyle = C.gold1; octx.lineWidth = 1;
  octx.strokeRect(mx - 1.5, my - 1.5, mw + 3, mh + 3);
  // 缩略地形：把地面图直接压进去，玩家一眼能认出自己在哪片地
  octx.imageSmoothingEnabled = true;
  octx.globalAlpha = 0.72;
  octx.drawImage(groundC, mx, my, mw, mh);
  octx.globalAlpha = 1;
  octx.imageSmoothingEnabled = false;
  const sx = mw / (MAPW * TILE), sy = mh / (MAPH * TILE);
  // 青云集：小地图上给一块"有屋顶的地方"。只描边 + 淡淡一层，
  // 压太实会把底下已经画好的石板街盖掉，反而看不出这是村子。
  octx.fillStyle = 'rgba(232,223,200,0.16)';
  octx.fillRect(mx + VILLAGE.x0 * sx, my + VILLAGE.y0 * sy,
    (VILLAGE.x1 - VILLAGE.x0) * sx, (VILLAGE.y1 - VILLAGE.y0) * sy);
  octx.strokeStyle = 'rgba(217,164,65,0.75)';
  octx.lineWidth = 1;
  octx.strokeRect(mx + VILLAGE.x0 * sx + 0.5, my + VILLAGE.y0 * sy + 0.5,
    (VILLAGE.x1 - VILLAGE.x0) * sx - 1, (VILLAGE.y1 - VILLAGE.y0) * sy - 1);
  // 铺子：营业中是金点，打烊是暗点
  for (const id in SHOPS) {
    const s = SHOPS[id];
    octx.fillStyle = shopOpenNow(id) ? C.gold2 : C.ink3;
    octx.fillRect(mx + s.x * sx - 1, my + s.y * sy - 1, 2, 2);
  }
  // 青云古洞：紫框 + 一个会闪的点。地图上那块"黑洞"本身说明不了任何事，
  // 不标注的话玩家会以为那是没画完的地方。
  octx.strokeStyle = dgIn(player.x, player.y) ? C.pur3 : 'rgba(138,111,196,0.7)';
  octx.lineWidth = 1;
  octx.strokeRect(mx + DG.x0 * sx + 0.5, my + DG.y0 * sy + 0.5,
    (DG.x1 - DG.x0) * sx - 1, (DG.y1 - DG.y0) * sy - 1);
  if (dgData && ((time * 1.6 | 0) % 2 === 0 || dgIn(player.x, player.y))) {
    octx.fillStyle = C.pur3;
    octx.fillRect(mx + dgData.doorX * sx - 1, my + DG.y1 * sy - 1, 3, 2);
  }
  // 营地
  for (const c of camps) {
    octx.fillStyle = c.tier === 2 ? C.red2 : C.paper1;
    octx.fillRect(mx + c.x * sx - 1, my + c.y * sy - 1, 3, 3);
  }
  // 精英 / 首领
  for (const e of enemies) {
    if (e.dead) continue;
    if (e.type === 'boss' || e.type === 'treant') {
      octx.fillStyle = C.red3;
      octx.fillRect(mx + e.x * sx - 2, my + e.y * sy - 2, 4, 4);
    } else if (e.elite) {
      octx.fillStyle = C.pur3;
      octx.fillRect(mx + e.x * sx - 1, my + e.y * sy - 1, 3, 3);
    }
  }
  // 稀有掉落
  for (const d of drops) {
    if (d.kind !== 'gear' || d.item.r < 3) continue;
    octx.fillStyle = C.gold3;
    octx.fillRect(mx + d.x * sx - 1, my + d.y * sy - 1, 2, 2);
  }
  // 传闻：酒保给的方位，靠近才揭开。问号本身就是"出门的理由"
  if (rumor) {
    const rx = mx + rumor.x * sx, ry = my + rumor.y * sy;
    octx.font = 'bold 9px monospace';
    octx.textAlign = 'center';
    octx.fillStyle = C.black; octx.fillText('?', rx + 1, ry + 4);
    octx.fillStyle = (time * 2 | 0) % 2 ? C.gold3 : C.gold2;
    octx.fillText('?', rx, ry + 3);
    octx.textAlign = 'left';
  }
  // 玩家
  const blink = (time * 3 | 0) % 2;
  octx.fillStyle = blink ? C.white : C.jade3;
  octx.fillRect(mx + player.x * sx - 2, my + player.y * sy - 2, 3, 3);
}

// 日晷：挂在 ::小地图正下方。玩家抬一次眼就能知道「还剩多久天黑」。
function drawSundial() {
  const p = clock.phase;
  const w = 78, h = 22, x = LW - w - 8, y = 70;
  octx.fillStyle = 'rgba(18,22,31,0.72)';
  octx.fillRect(x - 2, y - 2, w + 4, h + 4);
  octx.strokeStyle = C.gold1; octx.lineWidth = 1;
  octx.strokeRect(x - 1.5, y - 1.5, w + 3, h + 3);

  octx.save();
  octx.font = 'bold 9px monospace';
  octx.textBaseline = 'top';
  octx.textAlign = 'left';
  octx.fillStyle = p.color;
  octx.fillText(p.name, x + 4, y + 3);
  const nw = octx.measureText(p.name).width;
  octx.fillStyle = C.paper2;
  octx.fillText('·' + p.sub, x + 4 + nw, y + 3);
  octx.textAlign = 'right';
  octx.fillStyle = C.paper1;
  octx.fillText('第' + clock.day + '日', x + w - 4, y + 3);
  octx.restore();

  // 时辰进度条：底槽 + 当前段填充 + 段界刻度（一眼看出今天走到哪了）
  const bx = x + 4, bw = w - 8, by = y + 14;
  octx.fillStyle = 'rgba(201,191,163,0.20)';
  octx.fillRect(bx, by, bw, 3);
  octx.fillStyle = p.color;
  octx.fillRect(bx, by, Math.max(1, Math.round(bw * p.progress)), 3);
  octx.fillStyle = 'rgba(18,22,31,0.9)';
  for (const e of PHASE_EDGES) octx.fillRect(Math.round(bx + bw * e), by, 1, 3);

  // 夜深了给个「阴物活跃」的红点，提示这是刷宝的窗口
  if (clock.deepNight) {
    const on = (time * 2 | 0) % 2;
    if (on) {
      octx.fillStyle = C.pur3;
      octx.fillRect(x + w - 4, y + 12, 3, 3);
    }
  }
}

function drawOverlay(camX, camY) {
  octx.clearRect(0, 0, LW, LH);
  octx.imageSmoothingEnabled = false;
  const s = stats();

  // ---- 世界层特效 ----
  for (const g of slashGhosts) {
    const a = Math.max(0, g.t / g.max);
    if (g.ring) drawRingFx(octx, g.x - camX, g.y - camY, g.R * (1.4 - a * 0.4), g.colors, a, 1);
    else if (g.thrust) drawThrustFx(octx, g.x - camX, g.y - camY, g.thrust, g.len, g.colors, a * 0.9, 1);
    else drawArcFx(octx, g.x - camX, g.y - camY, g.a0, g.a1, g.R, g.colors, a * 0.9, 1);
  }
  for (const b of boltFx) {
    const a = b.t / b.max;
    octx.save();
    octx.globalCompositeOperation = 'lighter';
    octx.strokeStyle = rgba(C.gold3, a);
    octx.lineWidth = 3;
    octx.beginPath();
    let bx = b.x - camX, by = 0;
    octx.moveTo(bx, by);
    const steps = 6;
    for (let i = 1; i <= steps; i++) {
      by = (b.y - camY) * (i / steps);
      bx = b.x - camX + (Math.random() - 0.5) * 7;
      octx.lineTo(bx, by);
    }
    octx.stroke();
    octx.strokeStyle = rgba(C.white, a * 0.9); octx.lineWidth = 1; octx.stroke();
    octx.restore();
    b.t -= 0.016;
  }
  boltFx = boltFx.filter(b => b.t > 0);

  // 剑舞金环
  if (wuT > 0) {
    const a = wuT / 0.34;
    const r = 38 * (1 - a) + 6;
    drawRingFx(octx, player.x - camX, player.y - 8 - camY, r, [C.gold3, C.gold2], a, 1.2);
  }
  // 天雷预警
  for (const b of bolts) {
    if (b.done) continue;
    const rr = b.r;
    octx.save();
    octx.globalAlpha = 0.4 + Math.sin(time * 40) * 0.25;
    octx.strokeStyle = C.gold3; octx.lineWidth = 1;
    octx.beginPath(); octx.arc(b.x - camX, b.y - camY, rr, 0, 6.28); octx.stroke();
    octx.beginPath(); octx.moveTo(b.x - camX, b.y - camY - rr); octx.lineTo(b.x - camX, b.y - camY - rr * 2.2); octx.stroke();
    octx.restore();
  }
  // 敌手起手预警
  for (const e of enemies) {
    if (e.dead) continue;
    const m = MONSTERS[e.type];
    if (e.windup > 0) {
      const ex = Math.round(e.x - camX), ey = Math.round(e.y - e.h / 2 - camY);
      const a = Math.atan2(player.y - e.y, player.x - e.x);
      octx.globalAlpha = 0.35 + Math.sin(time * 30) * 0.25;
      octx.strokeStyle = m.behavior === 'charger' ? C.gold3 : C.red3;
      octx.lineWidth = 2;
      octx.beginPath();
      octx.moveTo(ex + Math.cos(a) * 6, ey + Math.sin(a) * 6);
      octx.lineTo(ex + Math.cos(a) * (m.range + (m.behavior === 'charger' ? 40 : 10)), ey + Math.sin(a) * (m.range + 10));
      octx.stroke();
      octx.globalAlpha = 1;
    }
    if (e.type === 'tank' && e.windup > 0) {
      const p = 1 - e.windup / m.windup;
      octx.save();
      octx.globalAlpha = 0.25 + p * 0.45;
      octx.strokeStyle = C.paper1; octx.lineWidth = 2;
      octx.beginPath(); octx.arc(e.x - camX, e.y - camY, 36, 0, 6.28); octx.stroke();
      octx.restore();
    }
  }
  // 首领预警圈
  for (const e of enemies) {
    if (e.dead || e.spinWind <= 0) continue;
    const ex = Math.round(e.x - camX), ey = Math.round(e.y - e.h / 2 - camY);
    const p = 1 - e.spinWind / 1.0;
    octx.globalAlpha = 0.25 + p * 0.45;
    octx.strokeStyle = C.red2; octx.lineWidth = 2;
    octx.beginPath(); octx.arc(ex, ey, e.type === 'treant' ? 42 : 68, 0, Math.PI * 2); octx.stroke();
    octx.globalAlpha = 1;
  }

  // 仙品 / 传世兵器掉在地上：品阶辉光 + 脚下光环，远远就能认出来
  for (const d of drops) {
    if (d.taken || !d.epic || !d.mesh) continue;
    const dx = d.x - camX, dy = d.y - 6 - camY;
    const col = RARITY[d.item.r].color;
    drawRareAura(octx, dx, dy, 13, col, 0.8, time, d.item.r);
    octx.save();
    octx.globalCompositeOperation = 'lighter';
    octx.strokeStyle = rgba(col, 0.55); octx.lineWidth = 1;
    octx.beginPath();
    octx.ellipse(dx, dy + 5, 7 + Math.sin(time * 3 + d.x) * 1.5, 3.4, 0, 0, 6.28);
    octx.stroke();
    octx.restore();
  }

  // 手中兵器
  if (state === 'play' || state === 'clear') drawWeaponHeld(camX, camY);

  // ---- 时辰光罩（压在世界之上、HUD 之下：HUD 永远是亮的，能看清数值）----
  if (state === 'play' || state === 'clear') drawDayNight(camX, camY);

  // ---- HUD ----
  const hpr = player.hp / Math.max(1, s.hp);
  if (hpr < 0.35) {
    const pulse = (0.35 - hpr) / 0.35 * (0.55 + Math.sin(time * 7) * 0.2);
    octx.globalAlpha = Math.min(0.5, pulse);
    octx.fillStyle = C.red1;
    octx.fillRect(0, 0, LW, 8); octx.fillRect(0, LH - 8, LW, 8);
    octx.fillRect(0, 0, 8, LH); octx.fillRect(LW - 8, 0, 8, LH);
    octx.globalAlpha = 1;
  }
  // 血 / 真气 / 经验
  octx.fillStyle = C.black; octx.fillRect(7, 7, 96, 22);
  octx.fillStyle = C.ink2; octx.fillRect(8, 8, 94, 20);
  octx.fillStyle = C.red1; octx.fillRect(9, 9, 92, 8);
  octx.fillStyle = C.red2; octx.fillRect(9, 9, Math.max(0, Math.round(92 * hpr)), 8);
  if (player.shield > 0) {
    octx.fillStyle = 'rgba(155,212,204,0.85)';
    octx.fillRect(9, 9, Math.min(92, 92 * player.shield / Math.max(1, s.hp)), 8);
  }
  octx.fillStyle = C.ink1; octx.fillRect(9, 18, 92, 4);
  octx.fillStyle = C.jade2; octx.fillRect(9, 18, Math.round(92 * Math.min(1, player.qi / Math.max(1, s.qiMax))), 4);
  octx.fillStyle = C.gold1; octx.fillRect(9, 23, 92, 3);
  octx.fillStyle = C.gold2; octx.fillRect(9, 23, Math.round(92 * Math.min(1, player.xp / (player.level * 42))), 3);
  octx.font = 'bold 9px monospace'; octx.textBaseline = 'top';
  octx.fillStyle = C.paper3;
  octx.fillText(realm() + ' ' + Math.round(player.hp) + '/' + Math.round(s.hp), 110, 8);
  octx.fillStyle = C.jade3;
  octx.fillText('真气 ' + Math.round(player.qi) + '/' + Math.round(s.qiMax), 110, 18);
  octx.fillStyle = C.gold3;
  octx.fillText('银两 ' + player.gold + ' · 精铁 ' + player.iron, 110, 28);

  // 连击
  if (combo > 1) {
    const rank = comboRank();
    const cx = LW / 2, cy = 22;
    const sc = 1 + comboPulse * 0.25;
    octx.save();
    octx.translate(cx, cy);
    octx.scale(sc, sc);
    octx.font = 'bold 15px monospace';
    octx.textAlign = 'center';
    octx.fillStyle = C.black;
    octx.fillText(combo + '', 1, 1);
    octx.fillStyle = rank ? rank.color : C.paper3;
    octx.fillText(combo + '', 0, 0);
    octx.font = 'bold 8px monospace';
    octx.fillStyle = C.paper3;
    octx.fillText('连击 ×' + comboMult().toFixed(2), 0, 12);
    if (rank) { octx.fillStyle = rank.color; octx.fillText(rank.name, 0, 22); }
    octx.restore();
    octx.textAlign = 'left';
    octx.fillStyle = C.ink2; octx.fillRect(cx - 34, 44, 68, 2);
    octx.fillStyle = rank ? rank.color : C.gold2;
    octx.fillRect(cx - 34, 44, Math.round(68 * Math.min(1, comboT / 2.2)), 2);
  }

  // 底部底板（触屏时收窄成一条：摇杆与动作键占了这一带，留太多会挡视线）
  const barH = touch.enabled ? 8 : 44;
  octx.fillStyle = 'rgba(18,22,31,0.8)';
  octx.fillRect(0, LH - barH, LW, barH);
  octx.fillStyle = C.gold1;
  octx.fillRect(0, LH - barH, LW, 1);
  drawSkillBar();

  const nearForge = nearTemple();
  const sid = nearShop();
  if (!touch.enabled) {
    const potions = player.inv.filter(i => i.kind === 'potion').length;
    octx.font = 'bold 9px monospace';
    octx.fillStyle = C.jade3; octx.fillText('丹药×' + potions, 8, LH - 14);
    // 走近谁就说谁的事：一条提示轮着写"E 铁匠台 / E 云来客栈 / R 御风"，
    // 比堆三行固定文案更像"脚下有东西等着你按"。
    let hint = 'R 御风', hot = false, sub = 'T 道行  Tab 行囊';
    // 提示必须和 interact() 挑的是同一个对象，否则会出现"提示说找老周、按 E 却开了铺子"
    const dgo = nearDg();
    if (dgo) {
      hint = dgo.kind === 'chest'
        ? (dgo.opened ? '箱已空' : dgo.locked ? 'E 宝箱（封着）' : 'E 开箱')
        : (dgo.home ? 'E 回到地面' : (dgCleared ? 'E 深入地脉 · 第 ' + (dgFloor + 1) + ' 层' : '地脉裂口（清完妖物）'));
      hot = !dgo.locked || dgo.kind === 'rift' || dgo.opened;
      // 洞里没有村庄提示可给，就把"还有几只没杀"顶上来 —— 刷装备的人最需要这个数
      sub = '第 ' + dgFloor + ' / ' + DG_FLOORS + ' 层 · 余妖 ' + dgMobs.filter(e => !e.dead).length;
    } else {
      const vv = nearVillager();
      const dv = vv ? Math.hypot(player.x - vv.x, player.y - vv.y) : 1e9;
      const ds = sid ? Math.hypot(player.x - SHOPS[sid].x, player.y - SHOPS[sid].y) : 1e9;
      if (vv && dv <= ds) { hint = 'E 与 ' + vv.name + ' 说话'; hot = true; }
      else if (sid) { hint = 'E ' + SHOPS[sid].title + (shopOpenNow(sid) ? '' : '（已打烊）'); hot = true; }
      else if (nearNotice()) { hint = 'E 告示牌'; hot = true; }
      else if (nearForge) { hint = 'E 铁匠台  F 打坐'; hot = true; }
    }
    octx.fillStyle = hot ? C.gold3 : C.paper1;
    octx.fillText(hint, 8, LH - 26);
    octx.fillStyle = C.paper1;
    octx.fillText(sub, 8, LH - 38);
  }

  // 首领血条
  // 条件改成「最近交过手」或「它还盯着你且就在附近」：
  // 原来写的是 aggro || hp<maxHp，两个条件都只会变真、不会变假，
  // 于是 boss 一被惊动血条就永远挂在屏幕顶上了。
  const boss = enemies.find(e => {
    if (e.dead || (e.type !== 'boss' && e.type !== 'treant')) return false;
    if (e.combatT > 0) return true;
    if (!e.aggro) return false;
    return Math.hypot(player.x - e.x, player.y - e.y) < 240;
  });
  if (boss) {
    const bw = 140;
    octx.fillStyle = C.black; octx.fillRect(LW / 2 - bw / 2 - 1, 54, bw + 2, 10);
    octx.fillStyle = C.red1; octx.fillRect(LW / 2 - bw / 2, 55, bw, 8);
    octx.fillStyle = boss.type === 'treant' ? C.jade2 : C.red2;
    octx.fillRect(LW / 2 - bw / 2, 55, Math.round(bw * boss.hp / boss.maxHp), 8);
    octx.font = 'bold 9px monospace'; octx.textAlign = 'center';
    octx.fillStyle = C.gold3;
    octx.fillText(MONSTERS[boss.type].name + (boss.phase2 ? ' · 怒' : ''), LW / 2, 68);
    octx.textAlign = 'left';
  }

  drawMinimap();
  drawSundial();

  // 伤害数字
  const placed = [];
  octx.textAlign = 'center'; // 居中后数字才落在怪身上，否则长文本（会心 257）会从怪身上向左/右飘出去
  for (const n of dmgNums) {
    let x = Math.round(n.x - camX), y = Math.round(n.y - camY);
    octx.font = n.big ? 'bold 14px monospace' : 'bold 9px monospace';
    // 用实测字宽做避让：之前固定 22px 阈值，中文 3~4 字（27px+）会叠在一起
    const tw = octx.measureText(n.txt).width;
    for (let k = 0; k < 8; k++) {
      const hit = placed.find(p => Math.abs(p.x - x) < (p.w + tw) / 2 + 3 && Math.abs(p.y - y) < 12);
      if (!hit) break;
      y -= 12;
    }
    placed.push({ x, y, w: tw });
    const k = n.t / n.max;
    const sc = n.big ? 1 + (1 - k) * 0.35 : 1;
    octx.save();
    octx.translate(x, y);
    octx.scale(sc, sc);
    octx.font = n.big ? 'bold 14px monospace' : 'bold 9px monospace';
    octx.fillStyle = C.black; octx.fillText(n.txt, 1, 1);
    octx.fillStyle = n.color; octx.fillText(n.txt, 0, 0);
    octx.restore();
  }
  octx.textAlign = 'left';
  // 消息
  messages.forEach((m, i) => {
    octx.font = 'bold 9px monospace';
    const mw = octx.measureText(m.txt).width;
    octx.fillStyle = C.black; octx.fillText(m.txt, LW / 2 - mw / 2 + 1, LH - 58 - i * 12 + 1);
    octx.fillStyle = m.color; octx.fillText(m.txt, LW / 2 - mw / 2, LH - 58 - i * 12);
  });

  // 受击/暴击白闪
  if (player.hurtFlash > 0) {
    octx.globalAlpha = Math.min(0.35, player.hurtFlash * 1.6);
    octx.fillStyle = C.white;
    octx.fillRect(0, 0, LW, LH);
    octx.globalAlpha = 1;
  }

  // 触屏操作层（画在最上面，别被白闪/血条压住）
  drawTouchUI();

  // 进村标题：压在世界之上、面板之下
  drawBanner();

  // 打坐过场：压在所有层之上，一呼一吸之间换一个时辰
  drawMeditate();
  drawSleep();
  drawDgDip();
}

// 深入地脉的黑幕。不做这一层，玩家会亲眼看见地面"啪"地重排一遍。
function drawDgDip() {
  if (dgDipT <= 0) return;
  const k = dgDipT < 0.34 ? dgDipT / 0.34 : 1 - (dgDipT - 0.34) / 0.40;
  octx.fillStyle = 'rgba(0,0,0,' + (Math.max(0, Math.min(1, k)) * 0.99).toFixed(3) + ')';
  octx.fillRect(0, 0, LW, LH);
}

// 进村标题：两行字 + 上下金线，淡入淡出各 0.4 秒
function drawBanner() {
  if (bannerT <= 0) return;
  const p = 1 - bannerT / 2.8;
  const a = Math.max(0, Math.min(1, Math.min(p / 0.14, (1 - p) / 0.26)));
  if (a <= 0.01) return;
  const cy = 74;
  octx.save();
  octx.globalAlpha = a;
  octx.textAlign = 'center';
  octx.textBaseline = 'middle';
  // 底衬：横过来的墨色渐变，两端化开。硬边矩形会像贴了一张纸条在房子上。
  const grad = octx.createLinearGradient(LW / 2 - 118, 0, LW / 2 + 118, 0);
  grad.addColorStop(0, 'rgba(10,13,20,0)');
  grad.addColorStop(0.42, 'rgba(10,13,20,0.52)');
  grad.addColorStop(0.58, 'rgba(10,13,20,0.52)');
  grad.addColorStop(1, 'rgba(10,13,20,0)');
  octx.fillStyle = grad;
  octx.fillRect(LW / 2 - 118, cy - 20, 236, 46);
  octx.fillStyle = C.gold1;
  octx.fillRect(LW / 2 - 30, cy - 16, 60, 1);
  octx.fillRect(LW / 2 - 30, cy + 21, 60, 1);
  octx.font = 'bold 17px SimSun, serif';
  octx.fillStyle = C.black;
  octx.fillText(bannerTitle, LW / 2 + 1, cy + 1);
  octx.fillStyle = C.paper3;
  octx.fillText(bannerTitle, LW / 2, cy - 1);
  octx.font = '9px monospace';
  octx.fillStyle = C.black;
  octx.fillText(bannerSub, LW / 2 + 1, cy + 15);
  octx.fillStyle = C.paper2;
  octx.fillText(bannerSub, LW / 2, cy + 14);
  octx.restore();
  octx.textAlign = 'left';
  octx.textBaseline = 'alphabetic';
}

// 住店过夜：比打坐更长的黑幕，中间写一句夜话（十次里有一次）
function drawSleep() {
  if (sleepT <= 0) return;
  const k = 1 - sleepT / 1.8;
  const a = Math.min(1, Math.sin(Math.min(1, k * 1.18) * Math.PI) * 1.05);
  octx.fillStyle = 'rgba(6,7,12,' + a.toFixed(3) + ')';
  octx.fillRect(0, 0, LW, LH);
  const ta = Math.min(1, Math.sin(k * Math.PI) * 2.2);
  if (ta <= 0.02) return;
  octx.save();
  octx.globalAlpha = ta;
  octx.textAlign = 'center';
  octx.textBaseline = 'middle';
  octx.font = 'bold 12px monospace';
  octx.fillStyle = C.paper3;
  octx.fillText('一 夜 无 话', LW / 2, LH / 2 - 14);
  octx.font = 'bold 9px monospace';
  octx.fillStyle = clock.phase.color;
  octx.fillText('第 ' + clock.day + ' 日 · ' + clock.phase.name + '·' + clock.phase.sub, LW / 2, LH / 2 + 4);
  if (sleepNote) {
    octx.font = '9px monospace';
    octx.fillStyle = C.paper1;
    octx.fillText(sleepNote, LW / 2, LH / 2 + 20);
  }
  octx.restore();
}

// 打坐黑幕：sin 曲线让"暗下去—亮起来"是一口气，而不是硬切
function drawMeditate() {
  if (meditateT <= 0) return;
  const k = 1 - meditateT / 0.9;             // 0 → 1
  const a = Math.sin(k * Math.PI) * 0.94;
  octx.fillStyle = 'rgba(8,10,16,' + a.toFixed(3) + ')';
  octx.fillRect(0, 0, LW, LH);
  const ta = Math.min(1, Math.sin(k * Math.PI) * 1.6);
  if (ta <= 0.02) return;
  octx.save();
  octx.globalAlpha = ta;
  octx.textAlign = 'center';
  octx.textBaseline = 'middle';
  octx.font = 'bold 13px monospace';
  octx.fillStyle = C.paper3;
  octx.fillText('打 坐', LW / 2, LH / 2 - 12);
  octx.font = 'bold 9px monospace';
  octx.fillStyle = clock.phase.color;
  octx.fillText(clock.phase.name + '·' + clock.phase.sub, LW / 2, LH / 2 + 8);
  octx.restore();
}

// ---- 触屏 UI：虚拟摇杆 + 动作键 ----
function drawTouchUI() {
  if (!touch.enabled) return;
  const st = touch.stick;
  const cx = st.on ? st.cx : 56, cy = st.on ? st.cy : 210;
  octx.save();
  octx.textAlign = 'center';
  octx.textBaseline = 'middle';

  // 摇杆底盘
  octx.globalAlpha = st.on ? 0.50 : 0.26;
  octx.fillStyle = C.ink1;
  octx.beginPath(); octx.arc(cx, cy, st.r + 7, 0, 6.28); octx.fill();
  octx.globalAlpha = st.on ? 0.75 : 0.42;
  octx.strokeStyle = C.paper2; octx.lineWidth = 2;
  octx.beginPath(); octx.arc(cx, cy, st.r + 7, 0, 6.28); octx.stroke();
  // 十字刻度：一眼看出这是方向杆
  octx.globalAlpha = st.on ? 0.32 : 0.20;
  octx.strokeStyle = C.paper1; octx.lineWidth = 1;
  octx.beginPath();
  octx.moveTo(cx - st.r + 3, cy); octx.lineTo(cx + st.r - 3, cy);
  octx.moveTo(cx, cy - st.r + 3); octx.lineTo(cx, cy + st.r - 3);
  octx.stroke();
  // 杆头
  const hx = cx + st.dx * st.r * 0.7, hy = cy + st.dy * st.r * 0.7;
  octx.globalAlpha = st.on ? 0.92 : 0.52;
  octx.fillStyle = C.paper3;
  octx.beginPath(); octx.arc(hx, hy, 12, 0, 6.28); octx.fill();
  octx.globalAlpha = 1;
  octx.strokeStyle = C.gold1; octx.lineWidth = 2;
  octx.beginPath(); octx.arc(hx, hy, 12, 0, 6.28); octx.stroke();

  // 动作键
  for (const b of TOUCH_BTNS) {
    if (!touchBtnVisible(b)) continue;
    const pair = b.cd ? b.cd() : [0, 0];
    const cd = pair[0], max = pair[1];
    const locked = b.id === 'thunder' && nodeLevel(player.skillLv, 'tianlei') < 1;
    const ready = !(cd > 0) && !locked;
    octx.globalAlpha = ready ? 0.86 : 0.46;
    octx.fillStyle = C.ink1;
    octx.beginPath(); octx.arc(b.x, b.y, b.r, 0, 6.28); octx.fill();
    // 冷却扇形先盖，再写字，字才不被压暗
    if (cd > 0.12 && max > 0) {
      octx.globalAlpha = 0.40;
      octx.fillStyle = C.black;
      octx.beginPath();
      octx.moveTo(b.x, b.y);
      octx.arc(b.x, b.y, b.r - 1, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, cd / max));
      octx.closePath(); octx.fill();
    }
    octx.globalAlpha = ready ? 0.95 : 0.55;
    octx.strokeStyle = b.id === 'slash' ? C.gold2 : (locked ? C.ink3 : C.paper1);
    octx.lineWidth = 2;
    octx.beginPath(); octx.arc(b.x, b.y, b.r, 0, 6.28); octx.stroke();
    octx.globalAlpha = 1;
    octx.fillStyle = ready ? C.paper3 : C.ink3;
    octx.font = 'bold ' + b.size + 'px monospace';
    octx.fillText(b.label, b.x, b.y + 1);
  }
  octx.restore();
}

// ============ 全屏 ============
// 桌面端浏览器 F11 全屏时，页面本身就有大片黑边（浏览器 UI 占掉一截），
// 加上游戏自己的取整缩放留边，屏幕上真正能看的区域就更少了。
// 用 Fullscreen API 让游戏占满整块屏幕，缩放策略再配合铺满，两层黑边一起消掉。
function toggleFullscreen() {
  const el = document.documentElement;
  if (document.fullscreenElement || document.webkitFullscreenElement) {
    (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  } else {
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (req) {
      const p = req.call(el);
      if (p && p.catch) p.catch(() => msg('全屏被浏览器拒绝，可按 F11', C.paper2));
    } else {
      msg('此浏览器不支持全屏，请按 F11', C.paper2);
    }
  }
}
document.addEventListener('fullscreenchange', () => { resize(); refreshFullscreenBtn(); });
document.addEventListener('webkitfullscreenchange', () => { resize(); refreshFullscreenBtn(); });
function refreshFullscreenBtn() {
  const b = document.getElementById('btnFull');
  if (!b) return;
  const on = !!(document.fullscreenElement || document.webkitFullscreenElement);
  b.textContent = on ? '退出全屏（F11）' : '全屏（F11）';
}
const btnFull = document.getElementById('btnFull');
if (btnFull) btnFull.onclick = toggleFullscreen;
refreshFullscreenBtn();   // 初始状态同步一次（万一页面本身就在全屏里）

// ============ 尺寸 / 主循环 ============
const wrap = document.getElementById('wrap');
function resize() {
  const raw = Math.min(innerWidth / LW, innerHeight / LH);
  // 桌面：像素游戏优先整数倍（最锐利），但**不能为了锐利留大片黑边**——
  // 以前一律 Math.floor(raw)，1366×768 的笔记本上 2.844 被砍成 2，
  // 画布只剩 960×540，画面占屏不到一半。
  // 现在：缩放比几乎正好是整数时才取整（保持完美像素），
  // 否则按实际比例铺满整个窗口，只剩宽高比本身带来的那条窄边。
  // 触屏以前额外压了个 2.4 倍上限，大屏平板上等于自己给自己加黑边，去掉。
  const fl = Math.floor(raw);
  const s = (fl >= 1 && raw - fl < 0.005) ? fl : raw;
  viewScale = s;
  // 画布尺寸取整到设备像素，避免浏览器再做一次小数缩放（会糊）
  const cw = Math.round(LW * s), ch = Math.round(LH * s);
  wrap.style.width = cw + 'px'; wrap.style.height = ch + 'px';
  for (const c of [glCanvas, ov]) { c.style.width = cw + 'px'; c.style.height = ch + 'px'; }
  applyHiDPI(cw, ch);
  fitPanels();
  checkRotateHint();
}

// ---- 高分辨率渲染 ----
// 画布的 backing store 原来固定 480×270，全靠 CSS 放大到屏幕尺寸。
// 1366 的屏上那是 2.844 倍的非整数拉伸：像素块大小在 2px / 3px 之间跳，
// HUD 那点 8~9px 的字更是被拉成一团糊。
//
// 现在按「设备像素」渲染：backing store = CSS 尺寸 × devicePixelRatio，
// CSS 再 1:1 铺满，等于一个 backing 像素对应一个屏幕像素。
// 绘制代码一行没动 —— overlay 依旧按 480×270 的逻辑坐标写，靠 setTransform 放大，
// 所以 fillText 会以真实的 22~24px 字号光栅化，文字是清楚的矢量边缘，不再是放大出来的马赛克。
// WebGL 那边正交相机仍是 0..LW / 0..LH，改的是 viewport 尺寸，
// 纹理早就设了 NearestFilter，放大后是干净的像素方块而不是双线性糊边。
let renderDpr = 1;
function applyHiDPI(cw, ch) {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const bw = Math.round(cw * dpr), bh = Math.round(ch * dpr);
  // 改 canvas.width/height 会清掉全部 2D 状态（transform、smoothing），
  // 所以每次都要重新设一遍；尺寸没变时也设，代价可忽略。
  if (ov.width !== bw || ov.height !== bh) { ov.width = bw; ov.height = bh; }
  octx.setTransform(bw / LW, 0, 0, bh / LH, 0, 0);
  octx.imageSmoothingEnabled = false;
  renderer.setPixelRatio(dpr);
  renderer.setSize(cw, ch, false);
  renderDpr = dpr;
}

// ---- 面板自适应（开始菜单 / 侠陨 / 通关）----
// 这三个面板是 DOM 覆盖层，画布会按 s 倍缩放，面板却不会 —— 于是小屏上
// 固定像素的面板会糊住整个画面（竖屏时甚至溢出画布）。
// 这里按「画布实际尺寸」反推面板宽度与字号：
//   宽度取画布宽度的 42%（夹在 200~420px），字号随宽度等比缩（10~15px），
// 保证面板在任何屏幕上都占画布的固定比例，且文字是实打实渲染的（不靠 transform 拉）。
// 画布永远居中于视口（wrap 是 margin:auto + top:50% + translateY(-50%），
// 所以竖屏时画布只有中间一条，面板可以溢出到上下黑边里，仍在视口内 —— 宁可溢出也不要缩到看不清。
function fitPanels() {
  const cw = LW * viewScale;              // 画布 CSS 宽度
  let pw = Math.round(Math.max(200, Math.min(420, cw * 0.42)));
  let pf = Math.round(Math.max(10, Math.min(15, pw * 13 / 340)) * 10) / 10;
  const apply = () => {
    for (const sel of PANEL_SEL) {
      const el = document.querySelector(sel);
      if (!el) continue;
      el.style.setProperty('--pw', pw + 'px');
      el.style.setProperty('--pf', pf + 'px');
    }
  };
  apply();
  // 纵向：只在「画布够高」时才收缩，且字号不跌破 10px（宁可溢出也别看不清）。
  // 竖屏时画布只有 211px 高，但视口有 800+px，面板溢出画布落在黑边里反而更协调。
  const maxH = LH * viewScale * 0.94;
  const menu = document.getElementById('menu');
  if (menu && !menu.classList.contains('hidden')) {
    const h = menu.offsetHeight;          // 真实布局高度（不受 transform 影响）
    if (h > maxH && h > 0) {
      const k = Math.max(maxH / h, 10 / pf);   // 收缩比，但不把字号压到 10px 以下
      pw = Math.round(pw * k);
      pf = Math.round(pf * k * 10) / 10;
      apply();
    }
  }
}
// 竖屏时游戏画面只有中间一条，给个一句话提示（横过来自动消失，不用手动关）
function checkRotateHint() {
  const el = document.getElementById('rot');
  if (!el) return;
  const show = touch.enabled && innerHeight > innerWidth;
  el.style.display = show ? 'block' : 'none';
  if (!show) return;
  // 贴在画面正下方，而不是屏幕底部 —— 竖屏时两者差得很远，玩家会看不见
  const r = wrap.getBoundingClientRect();
  el.style.bottom = 'auto';
  el.style.top = Math.round(Math.min(innerHeight - 46, r.bottom + 12)) + 'px';
}
addEventListener('resize', resize);
resize();

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  update(dt);
  const camX = Math.max(0, Math.min(MAPW * TILE - LW, player.x - LW / 2)) + shakeX + (shakeX ? Math.random() * 2 - 1 : 0);
  const camY = Math.max(0, Math.min(MAPH * TILE - LH, player.y - LH / 2)) + shakeY + (shakeY ? Math.random() * 2 - 1 : 0);
  camera.position.x = camX; camera.position.y = camY;
  renderer.render(scene, camera);
  drawOverlay(camX, camY);
  requestAnimationFrame(loop);
}
buildMonTex();
requestAnimationFrame(loop);

// 外部素材热加载：有 assets/atlas.json 就覆盖程序化美术
loadArt().then(ok => {
  if (!ok) return;
  buildMonTex();
  for (const e of enemies) {
    const art = monTex[e.type];
    if (!art) continue;
    e.mesh.material.map = art.frames[0];
    e.mesh.geometry.dispose();
    e.mesh.geometry = new THREE.PlaneGeometry(art.size[0], art.size[1]);
    e.h = art.size[1];
  }
  msg('外部素材已装载', C.jade3);
});

// ============ 测试钩子 ============
window.__game = {
  get state() { return state; },
  get touch() { return touch; },
  get inputMode() { return touch.enabled ? 'touch' : 'keyboard'; },
  get inputLocked() { return inputLocked; },
  setInputMode, isTouchFirstDevice,
  get skillRects() { return skillRects; },
  get touchBtns() { return TOUCH_BTNS; },
  touchHit, BTN_PAD, stickStart, stickMove, stickEnd,
  get showIdleWeapon() { return SHOW_IDLE_WEAPON; },
  WEAPON_IDS, weaponCanvas, weaponIcon, randomFam, makeGear, HELD_SCALE, SWING_SCALE,
  get projectiles() { return projectiles; },
  LW, LH,
  clock,
  setClock(t, day) { clock.restore({ t, day: day === undefined ? clock.day : day }); clock.changed = 0; },
  meditate,
  get lights() { return lightSources; },
  get meditateT() { return meditateT; },
  get tiles() { return tiles; },
  get viewScale() { return viewScale; },
  fitPanels,
  get village() { return VILLAGE; },
  get shops() { return SHOPS; },
  shopOpenNow, nearShop, shopOpen, shopClose, interact, buyGood,
  canStand, inVillage, showDead, respawn, collectLights, banner,
  // 青云古洞
  DG, DGT, inDungeon, dgBuild, dgReset, dgDescend, dgHome, dgOpenChest, dgUse, dgCheckClear,
  get dgFloor() { return dgFloor; },
  get dgData() { return dgData; },
  get dgObjs() { return dgObjs; },
  get dgMobs() { return dgMobs; },
  get dgCleared() { return dgCleared; },
  get dgWipe() { return dgWipe; },
  nearDg,
  get dgDipT() { return dgDipT; },
  get npcs() { return npcObjs; },
  get villagers() { return VILLAGERS; },
  get vilObjs() { return vilObjs; },
  talkTo, talkClose, nearVillager, phaseOn, sayAll, NPC_ACT, addFame,
  fameTier, priceMul, goodPrice, addPotion, save,
  get talkNpc() { return talkNpc; },
  get talkLine() { return talkFull; },
  get talkShown() { return talkShown; },
  get talkOpen() { return !talkEl.classList.contains('hidden'); },
  get bannerT() { return bannerT; },
  get shopId() { return shopId; },
  get sleepT() { return sleepT; },
  get rumor() { return rumor; },
  set rumor(v) { rumor = v; },
  hitEnemy, nightLuck, dawnStrike,
  get phase() { return clock.phase; },
  get atTemple() { return nearTemple(); },
  get cleared() { return cleared; },
  debug: { renderer, scene, camera, ground, pMesh, objects },
  player, get enemies() { return enemies; }, get drops() { return drops; },
  get boss() { return enemies.find(e => e.type === 'boss'); },
  get treant() { return enemies.find(e => e.type === 'treant'); },
  get combo() { return combo; },
  get hitstop() { return hitstop; },
  set hitstop(v) { hitstop = v; },
  get stats() { return stats(); },
  get skills() { return skills; },
  get dmgNums() { return dmgNums; },
  get particles() { return particles; },
  get messages() { return messages; },
  get bolts() { return bolts; },
  get slashGhosts() { return slashGhosts; },
  get swing() { return player.swing; },
  debugArc(a0, a1, R) {
    drawArcFx(octx, 240, 135, a0 === undefined ? -2 : a0, a1 === undefined ? 1 : a1, R || 40, [C.red3, C.red2], 1, 1.5);
  },
  MAPW, MAPH, SPAWN, camps, WEAPONS, MONSTERS, NODES, SLOTS,
  get solid() { return solid; }, REGION,
  spawnEnemy, save, load, startGame, attack, castQi, castWu, castThunder, dash, windStep,
  salvageBulk, equipItem, unequip, usePotion, renderInv, renderForge, forgeOpen, forgeClose,
  renderSkills, learnNode, toggleSkills,
  showTip, hideTip, toggleInv,
  giveItem(kind) {
    const it = kind === 'potion' ? { kind: 'potion', name: '回春丹', heal: 40, r: 0 }
      : makeGear(kind || 'weapon', 2, Math.max(1, player.level));
    player.inv.push(it); renderInv(); return it;
  },
  giveGear(r, kind, tier, fam) {
    const rr = (r === undefined) ? 3 : (r === null ? rollRarity(stats().luck, tier || 0) : r);
    const slot = kind || SLOTS[(Math.random() * SLOTS.length) | 0];
    const it = makeGear(slot, rr, Math.max(1, player.level), Math.random, fam);
    player.inv.push(it); renderInv(); return it;
  },
  giveGearToGround(r, kind, tier) {
    const rr = (r === undefined) ? 3 : (r === null ? rollRarity(stats().luck, tier || 0) : r);
    return addDrop('gear', makeGear(kind || 'weapon', rr, Math.max(1, player.level)));
  },
  givePoints(n) { player.skillPts += n; renderSkills(); },
  setPos(x, y) { player.x = x; player.y = y; },
  setLevel(n) {
    const gain = Math.max(0, n - player.level);
    player.level = n; player.maxHpBase = 100 + (n - 1) * 15; player.skillPts += gain;
    invalidateStats(); player.hp = maxHp(); player.qi = maxQi(); renderSkills();
  },
  setDir(d) { player.dir = d; },
  tick(dt) {
    update(dt);
    const cx = Math.max(0, Math.min(MAPW * TILE - LW, player.x - LW / 2));
    const cy = Math.max(0, Math.min(MAPH * TILE - LH, player.y - LH / 2));
    camera.position.x = cx; camera.position.y = cy;
    renderer.render(scene, camera);
    drawOverlay(cx, cy);
  },
  capture() {
    renderer.render(scene, camera);
    const c = document.createElement('canvas');
    c.width = LW; c.height = LH;
    const g = c.getContext('2d');
    // glCanvas / ov 的 backing store 现在是设备像素级（cw*dpr），
    // 截图要的是 480×270 的逻辑图，必须显式给目标尺寸，否则会被裁掉大半
    g.drawImage(glCanvas, 0, 0, LW, LH); g.drawImage(ov, 0, 0, LW, LH);
    return c.toDataURL('image/png');
  },
};
