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
  QUESTS, QUEST_IDS, QUEST_ITEMS, RELICS_TRIPLE, MAIN_ORDER,
  questById, objDone, objText, tripleReady, tripleMissing, relicName, questsOfGiver,
} from './quests.js';
import {
  DG, DGT, DG_FLOORS, FLOOR_MOBS, inDungeon, genFloor, paintDungeon, dungeonArt,
} from './dungeon.js';
import {
  ARTS, ART_IDS, ART_SLOTS, ART_KEYS, ART_SLOT_LABEL, ART_FX, PROF_MAX, PROF_WEIGHT,
  artById, artsOfWeapon, artUnlocked, unlockedArts, profLevel, profLeft, profFrac, artBrief, artPower,
  artShape, artPose, artColor, ART_SHAPES, ART_POSES, ART_SNDS,
} from './arts.js';
import {
  MAIN, SUB, MANTRAS, MAIN_IDS, SUB_IDS, MANTRA_IDS, MANTRA_MAX_LV, SUB_SLOTS,
  mantraById, isMain, emptyMod, mantraMod, mainOf, install as mantraInstall,
  uninstall as mantraUninstall, sanitize as mantraSanitize, lvOf, mantraBrief,
} from './mantras.js';
import {
  POI, ACTS, STORY, STORY_IDS, CLUES, CLUE_IDS, ENV_TEXTS, ENV_IDS,
  NPC_LAYERS, NPC_LINES, storyByAct, npcLayer, npcLines, storyReady, storyHint,
} from './story.js';
import {
  applyArtOverrides, artFrames, artTiming, OVERRIDE_KEY,
  importOverrides, clearOverrides, overrideCount, readOverrides, exportOverrides,
} from './artoverrides.js';

// 招式工作台覆盖表：原地改 ARTS 的字段，所有持有 ARTS 引用的地方自动生效。
// 默认覆盖表是空的，64 招行为一字不变 —— 回归自检靠这一点保证。
applyArtOverrides(ARTS);

const LW = 480, LH = 270, TILE = 16, MAPW = 144, MAPH = 144;
// 第二章只往南加行、不动 MAPW —— tiles 索引是 y*MAPW+x，stride 不变，
// 第一章每个格子的下标、坐标、存档位置就都还是原样。
const CH1_H = 104;
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
// 营地道具三件套：篝火 / 帐篷 / 哨塔。
// 它们不是装饰 —— 玩家从远处一眼认出"那片地方有人住"，才知道该绕路还是该打。
const CAMPFIRE = spriteCanvas([
  '............',
  '.....yy.....',
  '....yrry....',
  '...yrrrry...',
  '...rrrrrr...',
  '....rrrr....',
  '.....rr.....',
  '..k..k..k...',
  '...k.k.k....',
], { y: C.gold2, r: C.red2, k: C.ink3 });
const TENT = spriteCanvas([
  '................',
  '.......kk.......',
  '......kKKk......',
  '.....kKKKKk.....',
  '....kKKKKKKk....',
  '...kKKKKKKKKk...',
  '..kKKKKKKKKKKk..',
  '.kKKKKKKKKKKKKk.',
  'kKKKKKKKKKKKKKKk',
  'kkkkkkkkkkkkkkkk',
  '.k............k.',
  '................',
], { k: C.ink2, K: '#9C8663' });
const TOWER = spriteCanvas([
  '..kkkkkkkkkk..',
  '.kKKKKKKKKKKk.',
  '.kKKKKKKKKKKk.',
  '..kkkkkkkkkk..',
  '...k......k...',
  '...k......k...',
  '..k........k..',
  '..k........k..',
  '...k......k...',
  '...k......k...',
  '..k........k..',
  '..k........k..',
  '...k......k...',
  '...k......k...',
  '..k........k..',
  '..k........k..',
  '...k......k...',
  '..kkk....kkk..',
], { k: C.ink2, K: '#8A7551' });

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
// 新区独立随机源：改 MAPH 之后，第一章所有 rng() 调用的次数与顺序必须一字不改，
// 否则斑块 / 风物 / 路网会整片重排，旧存档和既有回归都得重校。
const rng2 = mulberry32(20261111);
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
  // —— 第二章 P12-A：只落在 CH1_H 以南，绝不碰上面三区 ——
  south:  { x0: 4,  y0: 106, x1: 64,  y1: 140, label: '南疆瘴林' },
  river:  { x0: 80, y0: 106, x1: 140, y1: 140, label: '江岸渡口' },
};

// ============ 营地 ============
// 一个营地要"像个活的地方"，光有一堆怪站着是不够的。这里给每个营地配四样东西：
//   patrol  巡逻路线。数字 = 自动生成 n 点环形；数组 = 手写 [dx,dy] 格偏移
//   alert   吹哨半径。一只发现你，这个半径内的同伴一起上（"哨营"就该比"巢穴"吹得远）
//   night   夜里额外冒出来的东西。它们是"夜行"的，白天在睡觉 —— 可以摸过去偷袭
//   lord    营地首领。精英，打死额外掉宝，是这批怪的"为什么聚在这"
const camps = [
  // —— 青云集周边：山贼，有纪律，吹哨传得远 ——
  { x: 96 * TILE, y: 96 * TILE, tier: 1, name: '山贼哨营',
    types: ['zhiren', 'zhiren', 'fox', 'snake'], night: ['ghost'],
    alert: 165, patrol: [[-3, 2], [2, 3], [4, -1], [1, -3], [-3, -1]] },
  { x: 78 * TILE, y: 92 * TILE, tier: 1, name: '黑风前哨',
    types: ['zhiren', 'ghost', 'fukui'], night: ['ghost', 'fukui'],
    alert: 205, patrol: 4 },
  { x: 90 * TILE, y: 74 * TILE, tier: 2, name: '演武场',
    types: ['brute', 'shadow', 'shigan'], night: ['shadow'],
    alert: 125, patrol: 3, lord: { type: 'brute', name: '教头' } },
  // —— 南岭竹海：野兽的地盘，食物链在这里最明显 ——
  { x: 30 * TILE, y: 58 * TILE, tier: 1, name: '妖兽巢穴',
    types: ['fox', 'snake', 'shanxiao'], alert: 105, patrol: 5 },
  { x: 16 * TILE, y: 70 * TILE, tier: 1, name: '猎户棚',
    types: ['shanxiao', 'fox', 'snake'], alert: 90, patrol: 3 },
  { x: 46 * TILE, y: 86 * TILE, tier: 2, name: '蛇窟',
    types: ['snake', 'snake', 'brute'], night: ['snake'],
    alert: 140, patrol: 4, lord: { type: 'shigan', name: '蛇母' } },
  { x: 56 * TILE, y: 96 * TILE, tier: 2, name: '机关工坊',
    types: ['shigan', 'brute', 'shadow'], alert: 130, patrol: 4 },
  // —— 西荒石窟：矿道里，视线短，靠火把 ——
  { x: 12 * TILE, y: 20 * TILE, tier: 1, name: '矿口哨卡',
    types: ['zhiren', 'brute', 'ghost'], night: ['ghost'], alert: 180, patrol: 4 },
  { x: 36 * TILE, y: 34 * TILE, tier: 2, name: '塌方矿道',
    types: ['shigan', 'shadow', 'brute'], alert: 120, patrol: 3 },
  { x: 22 * TILE, y: 10 * TILE, tier: 2, name: '火鸦巢',
    types: ['crow', 'crow', 'fukui'], night: ['crow'], alert: 110, patrol: 4 },
  // —— 北坡乱葬岗：白天只剩几个守墓的，夜里全是阴物 ——
  { x: 100 * TILE, y: 12 * TILE, tier: 1, name: '乱葬岗',
    types: ['crow', 'fukui', 'yinhun'], night: ['yinhun', 'yinhun', 'fukui'],
    alert: 120, patrol: 5 },
  { x: 122 * TILE, y: 32 * TILE, tier: 2, name: '守墓人小屋',
    types: ['yinhun', 'shadow', 'yinhun'], night: ['yinhun'],
    alert: 150, patrol: 3, lord: { type: 'yinhun', name: '守墓人' } },
  // —— 第二章 P12-A：南疆与江岸。复用现有怪种与 AI，不新增行为代码 ——
  { x: 22 * TILE, y: 116 * TILE, tier: 1, name: '瘴林蛊寨',
    types: ['snake', 'fox', 'shanxiao', 'fukui'], night: ['ghost'], alert: 120, patrol: 4 },
  { x: 48 * TILE, y: 132 * TILE, tier: 2, name: '赤土墟',
    types: ['brute', 'shigan', 'shadow'], night: ['yinhun'], alert: 145, patrol: 3,
    lord: { type: 'brute', name: '墟主' } },
  { x: 92 * TILE, y: 114 * TILE, tier: 1, name: '渡口棚',
    types: ['zhiren', 'fox', 'ghost'], night: ['ghost'], alert: 130, patrol: 4 },
  { x: 124 * TILE, y: 134 * TILE, tier: 2, name: '江匪坞',
    types: ['zhiren', 'brute', 'shadow'], night: ['fukui'], alert: 160, patrol: 5,
    lord: { type: 'shadow', name: '坞主' } },
];

// 夜行的：白天在睡，可以摸过去偷袭
const NOCTURNAL = { ghost: 1, fukui: 1, yinhun: 1, shadow: 1, crow: 1 };
// 昼行的：子时在睡，夜里营地就变成阴物的地盘
const DIURNAL = { zhiren: 1, brute: 1, shigan: 1, fox: 1, snake: 1, shanxiao: 1 };
// 食物链：谁追谁。做成"追与逃"而不是真的互相残杀 ——
// 真打起来营地会被自己吃空，玩家回来只看到一地尸体，反而更没生气。
const PREY_OF = { shanxiao: ['fox', 'snake'], brute: ['fox', 'snake'], treant: [] };

// ============ 首领巢穴 ============
// 首领不放进营地：营地里塞一只 500 血的家伙，玩家连清小怪的余地都没有。
// 单独给一块空场，四周留出跑位空间，进门就能看出"这里不一样"。
// 无面剑客不在这张表里 —— 它是古洞第三层岩魈倒下后才出现的。
const dens = [
  { type: 'qingshe', x: 18 * TILE, y: 88 * TILE, name: '青鳞潭', r: 3 },
  { type: 'kuilei',  x: 54 * TILE, y: 76 * TILE, name: '废弃机坊', r: 3 },
  { type: 'shimu',   x: 9 * TILE,  y: 34 * TILE, name: '石母洞', r: 3 },
  { type: 'huoya',   x: 40 * TILE, y: 20 * TILE, name: '火鸦绝壁', r: 3 },
];
// 巢穴的空场：把半径内的实心块清掉，再把底材换成踩秃的土。
// 不做这一步的话，青鳞蟒会刷在岩层里 —— 它血厚，卡住之后玩家只能隔着石头打。
function carveDen(d) {
  const cx = (d.x / TILE) | 0, cy = (d.y / TILE) | 0;
  for (let y = cy - d.r; y <= cy + d.r; y++) for (let x = cx - d.r; x <= cx + d.r; x++) {
    if (x < 3 || y < 3 || x >= MAPW - 3 || y >= MAPH - 3) continue;
    const dd = Math.hypot(x - cx, y - cy);
    if (dd > d.r + 0.4) continue;
    const i = y * MAPW + x;
    if (tiles[i] === 4) continue;
    if (inDungeon(x * TILE + 8, y * TILE + 8, 10)) continue;
    solid[i] = 0;
    if (dd < d.r - 0.6) tiles[i] = 2;
  }
}

for (let y = 0; y < MAPH; y++) for (let x = 0; x < MAPW; x++) {
  const i = y * MAPW + x;
  // 前 CH1_H 行沿用 rng、新区用 rng2：第一章逐格不变，新区不插队。
  tiles[i] = (y < CH1_H ? rng() : rng2()) < 0.22 ? 1 : 0;
  if (x < 2 || y < 2 || x >= MAPW - 2 || y >= MAPH - 2) { tiles[i] = 4; solid[i] = 1; }
}
// 第一章原底边（y=102/103）本来是实心边界，MAPH 变大后边界判定会把它放开。
// 整行放开会变成 140 格宽的大马路，所以先原样封回去，再只凿两个关口 ——
// 和第一章「每区至少两条通道」的规矩一致，也从这里接第二章的官道。
for (let y = CH1_H - 2; y < CH1_H; y++) for (let x = 0; x < MAPW; x++) {
  const i = y * MAPW + x;
  tiles[i] = 4; solid[i] = 1;
}
for (const gx of [34, 119]) {
  for (let y = CH1_H - 2; y < CH1_H; y++) for (let x = gx - 2; x <= gx + 2; x++) {
    const i = y * MAPW + x;
    tiles[i] = 2; solid[i] = 0;
  }
}
// 荒地斑块与野花：数量按面积比放大（96×72 → 144×104 约 2.17 倍），
// 照旧数量撒的话大图会稀得像没画完。
for (let p = 0; p < 195; p++) {
  const cx = 3 + (rng() * (MAPW - 6)) | 0, cy = 3 + (rng() * (CH1_H - 6)) | 0, r = 1 + (rng() * 2) | 0;
  for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
    if (x > 2 && y > 2 && x < MAPW - 3 && y < CH1_H - 3 && (x - cx) ** 2 + (y - cy) ** 2 <= r * r) tiles[y * MAPW + x] = 2;
  }
}
for (let f = 0; f < 700; f++) {
  const x = 3 + (rng() * (MAPW - 6)) | 0, y = 3 + (rng() * (CH1_H - 6)) | 0;
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
    // 营地 / 巢穴所在的地面不能被岩层吃掉，否则刷怪会直接卡在石头里
    if (camps.some(c2 => Math.hypot(x * TILE + 8 - c2.x, y * TILE + 8 - c2.y) < 66)) continue;
    if (dens.some(d2 => Math.hypot(x * TILE + 8 - d2.x, y * TILE + 8 - d2.y) < d2.r * TILE + 24)) continue;
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

// 首领空场：放在溪涧之后 —— 溪水是实心的，巢穴正落在水上就会变成"打不到的 Boss"。
for (const d of dens) carveDen(d);

// 路网。先在 tile 空间里走，主方向多走、次方向偶尔拐 ——
// 这样出来的是"人踩出来的路"，不是尺子画出来的 45° 斜线。
function carveRoad(tx0, ty0, tx1, ty1, halfW, rand) {
  const R = rand || rng;
  let x = tx0, y = ty0, guard = 0;
  while ((x !== tx1 || y !== ty1) && guard++ < 8000) {
    const dx = Math.sign(tx1 - x), dy = Math.sign(ty1 - y);
    if (Math.abs(tx1 - x) >= Math.abs(ty1 - y)) {
      if (R() < 0.82 || !dy) x += dx; else y += dy;
    } else {
      if (R() < 0.82 || !dx) y += dy; else x += dx;
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
// 首领巢穴各接一条小路：能看见路，就知道那头有东西
carveRoad(16, 70, 18, 88, 1);          // 猎户棚 → 青鳞潭
carveRoad(84, 60, 54, 76, 1);          // 三岔口 → 废弃机坊
carveRoad(12, 20, 9, 34, 1);           // 矿口 → 石母洞
carveRoad(22, 10, 40, 20, 1);          // 火鸦巢 → 火鸦绝壁

// ============ 第二章 P12-A：南疆 / 江岸 ============
// 顺序要紧：先铺两区底材，再挖江，最后开路；路穿过江的那几格回头换成桥面。
regionFloor(REGION.south, 11);
regionFloor(REGION.river, 12);

// 江水：斜贯江岸，7 格宽，实心。玩家过江只能走桥。
const RIVER_MID = x => 124 + Math.round(Math.sin(x * 0.11) * 2.2);
for (let x = REGION.river.x0 + 2; x < REGION.river.x1 - 2; x++) {
  const mid = RIVER_MID(x);
  for (let y = mid - 3; y <= mid + 3; y++) {
    const i = y * MAPW + x;
    if (tiles[i] === 4) continue;
    tiles[i] = 13; solid[i] = 1;
  }
}

// 官道南延。两条岔路各从一个关口下来，中间再用一条横向小路串起来 ——
// 不用绕回青云集，这也是第一章就定下的连通规矩。
const chRoad = (x0, y0, x1, y1) => carveRoad(x0, y0, x1, y1, 1, rng2);
chRoad(34, 104, 34, 116);          // 南疆关口 → 蛊寨岔口
chRoad(34, 116, 22, 116);         // → 瘴林蛊寨
chRoad(34, 116, 48, 132);         // → 赤土墟
chRoad(119, 104, 119, 108);       // 江岸关口 → 分岔
chRoad(119, 108, 100, 116);       // → 江北渡口
chRoad(100, 116, 92, 114);        // → 渡口棚
chRoad(100, 116, 100, 134);       // 跨江（桥）
chRoad(100, 134, 124, 134);       // → 江匪坞
chRoad(119, 108, 64, 108);        // 两区之间的捷径，不必绕回青云集
chRoad(64, 108, 34, 116);

// 桥面：江带里被路啃开的格子换成木板，别让石桥看着像土路插进水里。
for (let x = REGION.river.x0 + 2; x < REGION.river.x1 - 2; x++) {
  const mid = RIVER_MID(x);
  for (let y = mid - 3; y <= mid + 3; y++) {
    const i = y * MAPW + x;
    if (tiles[i] === 2) { tiles[i] = 9; solid[i] = 0; }
  }
}

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
function scatterOn(id, r, count, kinds, rand) {
  const R = rand || rng;
  const w = r.x1 - r.x0, h = r.y1 - r.y0;
  for (let c = 0; c < count; c++) {
    const x = r.x0 + 2 + ((R() * (w - 4)) | 0), y = r.y0 + 2 + ((R() * (h - 4)) | 0);
    const i = y * MAPW + x;
    if (tiles[i] !== id || solid[i]) continue;
    if (nearClear(x * TILE + 8, y * TILE + 16)) continue;
    solid[i] = 1;
    objects.push({ kind: kinds[(R() * kinds.length) | 0], x: x * TILE + 8, y: y * TILE + 16 });
  }
}
scatterOn(6, REGION.bamboo, 420, ['bamboo', 'bamboo', 'bamboo', 'peach']);
scatterOn(7, REGION.cave, 150, ['stalag', 'stalag', 'stone', 'torch']);
scatterOn(8, REGION.grave, 260, ['grave', 'grave', 'grave', 'deadtree']);
// 第二章两区复用现有点阵：辨识度先靠底材与地名，专属贴图留到 P12-B。
scatterOn(11, REGION.south, 260, ['bamboo', 'deadtree', 'peach'], rng2);
scatterOn(12, REGION.river, 190, ['stone', 'lantern', 'peach'], rng2);

for (let c = 0; c < 300; c++) {
  const cx = 4 + (rng() * (MAPW - 8)) | 0, cy = 4 + (rng() * (CH1_H - 8)) | 0;
  const n = 2 + (rng() * 4) | 0;
  for (let k = 0; k < n; k++) {
    const x = cx + ((rng() * 5) | 0) - 2, y = cy + ((rng() * 5) | 0) - 2;
    const i = y * MAPW + x;
    if (x > 2 && y > 2 && x < MAPW - 3 && y < CH1_H - 3 && tiles[i] < 2 && !solid[i] && !nearClear(x * TILE + 8, y * TILE + 16)) {
      solid[i] = 1; objects.push({ kind: rng() < 0.5 ? 'bamboo' : 'peach', x: x * TILE + 8, y: y * TILE + 16 });
    }
  }
}
for (let r = 0; r < 87; r++) {
  const x = 3 + (rng() * (MAPW - 6)) | 0, y = 3 + (rng() * (CH1_H - 6)) | 0, i = y * MAPW + x;
  if (tiles[i] < 2 && !solid[i] && !nearClear(x * TILE + 8, y * TILE + 12)) {
    solid[i] = 1; objects.push({ kind: 'lantern', x: x * TILE + 8, y: y * TILE + 12 });
  }
}
for (let r = 0; r < 39; r++) {
  const x = 4 + (rng() * (MAPW - 8)) | 0, y = 4 + (rng() * (CH1_H - 8)) | 0, i = y * MAPW + x;
  if (tiles[i] < 2 && !solid[i] && !nearClear(x * TILE + 8, y * TILE + 12)) {
    solid[i] = 1; objects.push({ kind: 'stone', x: x * TILE + 8, y: y * TILE + 10 });
  }
}
// —— 营地道具 ——
// 篝火在正中（怪围着它站），帐篷与哨塔放在外圈。位置如果已经被树占了就跳过，
// 宁可少一件道具，也不要把帐篷插进竹林里。
for (const c of camps) {
  const spots = [['campfire', 0, 0], ['tent', -58, 34], ['tower', 64, -30]];
  for (const sp of spots) {
    const kind = sp[0], px = c.x + sp[1], py = c.y + sp[2];
    const tx = (px / TILE) | 0, ty = (py / TILE) | 0;
    if (tx < 3 || ty < 3 || tx >= MAPW - 3 || ty >= MAPH - 3) continue;
    const i = ty * MAPW + tx;
    if (tiles[i] === 4 || solid[i]) continue;
    solid[i] = 1;
    objects.push({ kind, x: px, y: py });
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
  //       11 南疆赤土 12 江岸沙地 13 江水
  const cols = [C.jade1, C.jade1, C.paper1, C.jade1, C.ink1, '#8A8268',
    '#2A5B54', '#3B3C3D', '#59523F', '#6B4B2E', '#1D4A56',
    '#6A3B32', '#8A7C58', '#163B52'];
  for (let y = 0; y < MAPH; y++) for (let x = 0; x < MAPW; x++) {
    const PR = y < CH1_H ? rng : rng2;
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
      for (let k = 0; k < 5; k++) g.fillRect(x * TILE + ((PR() * 16) | 0), y * TILE + ((PR() * 16) | 0), 1, 1);
    }
    if (t === 2) {
      // 土路：碎石 / 车辙 / 深浅斑。只铺 3 个亮点会让大片路面平得像一块色块
      const bx = x * TILE, by = y * TILE;
      if (PR() < 0.6) { g.fillStyle = '#79725A'; g.fillRect(bx + ((PR() * 12) | 0), by + ((PR() * 13) | 0), 3, 2); }
      g.fillStyle = C.paper2;
      for (let k = 0; k < 4; k++) g.fillRect(bx + ((PR() * 15) | 0), by + ((PR() * 15) | 0), 2, 1);
      g.fillStyle = '#5F5A46';
      for (let k = 0; k < 2; k++) g.fillRect(bx + ((PR() * 15) | 0), by + ((PR() * 15) | 0), 1, 1);
    }
    if (t === 3) { g.fillStyle = PR() < 0.5 ? C.red3 : C.gold3; g.fillRect(x * TILE + 6 + ((PR() * 5) | 0), y * TILE + 5 + ((PR() * 6) | 0), 2, 2); }
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
      if (PR() < 0.16) {
        g.fillStyle = '#3F6E63';
        g.fillRect(bx + ((PR() * 14) | 0), by + ((PR() * 14) | 0), 2, 1);
      }
      if (PR() < 0.1) {
        g.fillStyle = '#8A8268';
        g.fillRect(bx + ((PR() * 14) | 0), by + ((PR() * 14) | 0), 1, 1);
      }
    }
    if (t === 4) { g.fillStyle = C.jade2; g.fillRect(x * TILE + 2, y * TILE + 4 + ((PR() * 8) | 0), 6, 1); g.fillRect(x * TILE + 9, y * TILE + 2 + ((PR() * 10) | 0), 5, 1); }
    if (t === 6) {
      // 竹海：湿、暗、落叶多。不铺满，留 40% 干净的底，否则整片像地毯
      const bx = x * TILE, by = y * TILE;
      g.fillStyle = '#35706A';
      for (let k = 0; k < 4; k++) g.fillRect(bx + ((PR() * 15) | 0), by + ((PR() * 15) | 0), 1, 2);
      if (PR() < 0.45) {
        g.fillStyle = '#8A7A3C';
        g.fillRect(bx + ((PR() * 13) | 0), by + ((PR() * 13) | 0), 2, 1);
      }
      if (PR() < 0.18) {
        g.fillStyle = '#244F49';
        g.fillRect(bx + ((PR() * 12) | 0), by + ((PR() * 12) | 0), 4, 3);
      }
    }
    if (t === 7) {
      // 石窟：碎岩 + 一道裂缝。岩面比外面冷，靠裂纹读"石头"而不是靠颜色
      const bx = x * TILE, by = y * TILE;
      g.fillStyle = '#4A4B4C';
      for (let k = 0; k < 3; k++) g.fillRect(bx + ((PR() * 14) | 0), by + ((PR() * 14) | 0), 2, 1);
      if (PR() < 0.3) {
        g.fillStyle = '#2A2B2C';
        let cx2 = bx + ((PR() * 10) | 0) + 3, cy2 = by + ((PR() * 6) | 0) + 2;
        for (let k = 0; k < 5; k++) { g.fillRect(cx2, cy2, 1, 1); cx2 += ((PR() * 3) | 0) - 1; cy2 += 1; }
      }
    }
    if (t === 8) {
      // 乱葬岗：干裂的土 + 零星白骨。刻意压低饱和，和竹海的湿绿正好相反
      const bx = x * TILE, by = y * TILE;
      g.fillStyle = '#6A6250';
      for (let k = 0; k < 3; k++) g.fillRect(bx + ((PR() * 14) | 0), by + ((PR() * 14) | 0), 3, 1);
      if (PR() < 0.12) {
        g.fillStyle = C.paper1;
        g.fillRect(bx + ((PR() * 13) | 0), by + ((PR() * 13) | 0), 2, 1);
      }
      if (PR() < 0.06) {
        g.fillStyle = '#3A3529';
        g.fillRect(bx + ((PR() * 10) | 0), by + ((PR() * 12) | 0), 1, 4);
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
      if (PR() < 0.22) { g.fillStyle = '#5FA6AE'; g.fillRect(bx + ((PR() * 11) | 0), by + ((PR() * 14) | 0), 3, 1); }
    }
    if (t === 11) {
      // 南疆赤土：干裂的红岩 + 几点瘴斑。和竹海的湿绿正好反着来
      const bx = x * TILE, by = y * TILE;
      g.fillStyle = '#7C4638';
      for (let k = 0; k < 3; k++) g.fillRect(bx + ((PR() * 14) | 0), by + ((PR() * 14) | 0), 3, 1);
      if (PR() < 0.16) { g.fillStyle = '#3B5A3E'; g.fillRect(bx + ((PR() * 12) | 0), by + ((PR() * 12) | 0), 3, 2); }
    }
    if (t === 12) {
      // 江岸沙地：浅色横纹 + 零星贝壳点
      const bx = x * TILE, by = y * TILE;
      g.fillStyle = '#9C8E68';
      for (let k = 0; k < 2; k++) g.fillRect(bx + ((PR() * 12) | 0), by + ((PR() * 14) | 0), 4, 1);
      if (PR() < 0.14) { g.fillStyle = C.paper1; g.fillRect(bx + ((PR() * 13) | 0), by + ((PR() * 13) | 0), 2, 1); }
    }
    if (t === 13) {
      // 江水：比溪水深、纹更密。静态水面在俯视角下够用
      const bx = x * TILE, by = y * TILE;
      g.fillStyle = '#245A70';
      g.fillRect(bx, by + 2, 16, 1);
      g.fillRect(bx + 3, by + 8, 11, 1);
      g.fillRect(bx, by + 13, 16, 1);
      if (PR() < 0.2) { g.fillStyle = '#6BB0BC'; g.fillRect(bx + ((PR() * 11) | 0), by + ((PR() * 14) | 0), 3, 1); }
    }
  }
  // 大尺度明暗斑块：打散"一格一格"的棋盘感
  for (let i = 0; i < 900; i++) {
    const cx = rng() * groundC.width, cy = rng() * CH1_H * TILE;
    const r = 40 + rng() * 110;
    g.save();
    g.globalAlpha = 0.05;
    g.fillStyle = rng() < 0.5 ? '#12352F' : '#7FB7A8';
    g.beginPath(); g.ellipse(cx, cy, r, r * (0.5 + rng() * 0.6), rng() * 3, 0, 6.28); g.fill();
    g.restore();
  }
  // 新区另补一层大尺度明暗，免得新地图平得像一张色卡。同样只用 rng2。
  for (let i = 0; i < 260; i++) {
    const cx = rng2() * groundC.width, cy = (CH1_H + rng2() * (MAPH - CH1_H)) * TILE;
    const r = 40 + rng2() * 110;
    g.save();
    g.globalAlpha = 0.05;
    g.fillStyle = rng2() < 0.5 ? '#12352F' : '#7FB7A8';
    g.beginPath(); g.ellipse(cx, cy, r, r * (0.5 + rng2() * 0.6), rng2() * 3, 0, 6.28); g.fill();
    g.restore();
  }
  // 土路边缘打散：先铺一圈中间色（草地→中间色→路面，三阶过渡），再把直角阶梯啃成碎边
  for (let y = 0; y < MAPH; y++) for (let x = 0; x < MAPW; x++) {
    const PR = y < CH1_H ? rng : rng2;
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
    for (let k = 0; k < (up ? 0 : 3); k++) g.fillRect(bx + ((PR() * 16) | 0), by + ((PR() * 3) | 0), 2, 2);
    for (let k = 0; k < (dn ? 0 : 3); k++) g.fillRect(bx + ((PR() * 16) | 0), by + 13 + ((PR() * 3) | 0), 2, 2);
    for (let k = 0; k < (lf ? 0 : 3); k++) g.fillRect(bx + ((PR() * 3) | 0), by + ((PR() * 16) | 0), 2, 2);
    for (let k = 0; k < (rt ? 0 : 3); k++) g.fillRect(bx + 13 + ((PR() * 3) | 0), by + ((PR() * 16) | 0), 2, 2);
    // 边上的杂草：路面和草地咬合更自然
    g.fillStyle = '#4A8C85';
    for (let k = 0; k < 2; k++) g.fillRect(bx + ((PR() * 16) | 0), by + ((PR() * 16) | 0), 1, 1);
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
    // 篝火余烬：一圈焦土 + 中间一层暖色。
    // 光靠帐篷和哨塔，"这是个营地"要靠玩家凑近了才看得出；
    // 地上这块暖色从半个屏幕外就能认出来，而且夜里正好和 campfire 的光源对齐。
    g.globalAlpha = 0.42;
    g.fillStyle = '#8A6A44';
    g.beginPath(); g.ellipse(c.x, c.y + 2, 13, 9, 0, 0, 6.28); g.fill();
    g.globalAlpha = 0.5;
    g.fillStyle = '#C88A4A';
    g.beginPath(); g.ellipse(c.x, c.y + 1, 6, 4, 0, 0, 6.28); g.fill();
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
  campfire: tex(CAMPFIRE), tent: tex(TENT), tower: tex(TOWER),
};
const objSize = {
  bamboo: [16, 20], peach: [16, 14], lantern: [10, 8], shrine: [16, 8], stone: [12, 7],
  grave: [12, 10], deadtree: [16, 18], stalag: [10, 14], torch: [8, 12],
  campfire: [12, 9], tent: [16, 12], tower: [14, 18],
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

// ============ 野外的三个人 ============
// 他们不在青云集，各自站在自己的地头上：猎户在竹海边上，守碑人在古洞前，
// 船夫在溪涧桥头。坐标是世界坐标，不走 V_SHIFT_X/Y ——
// village.js 那份表存的是"村庄内相对位置"，混进来会让平移逻辑变脏。
// 复用现有村民点阵：这三个人的辨识度靠名字与台词，不靠像素。
const WANDERERS = [
  {
    id: 'w_hunter', art: 'npcQiao', name: '吴老六', role: '猎户',
    x: 300, y: 1150, phases: 'always',
    greet: ['别过来，风里血腥味重，会惊着东西。', '这林子从前不这样。', '我兄弟的刀，你见着了吗？'],
    ask: '青鳞潭在林子最南头。那条蛇吃人，也吃它自己人。',
  },
  {
    id: 'w_stone', art: 'npcDao', name: '碑奴', role: '守碑人',
    x: 1152, y: 656, phases: 'always',
    greet: ['碑不能看，只能摸。', '你身上有土气，进过坟地了。', '洞里那位，不是你能问的。'],
    ask: '封碑要三物：阴土、竹心、石髓。少一件，碑就是块石头。',
  },
  {
    id: 'w_boat', art: 'npcGeng', name: '陈九', role: '渡口船夫',
    x: 600, y: 1240, phases: 'always',
    greet: ['水浅了，船撑不动。', '过河么？铜钱就不必了。', '竹海那头，最近总有人哭。'],
    ask: '水底下有根铁链，我撑了二十年船，从没见它到底。',
  },
  // 第四个是 P9 加的。西荒石窟原本一个人都没有 —— 整幕只有旁白，
  // 玩家在那儿待二十分钟听不到一句人话。老矿工站在营地火边，
  // 他既是那一幕唯一的活口，也是"石髓在哪"这件事在世界上的人证。
  {
    id: 'w_miner', art: 'npcQiao', name: '老矿工', role: '矿工',
    x: 352, y: 752, phases: 'always',
    greet: ['你从上面下来的？', '……上面现在什么时辰。', '别站在门口，风里有味道。'],
    ask: '洞里别点火把。点了，它们就来。',
  },
  // 第二章：新区不能只有怪。一个认路、一个摆渡，玩家南下先听见人话。
  {
    id: 'w_gu', art: 'npcYu', name: '蛊婆', role: '南疆药婆',
    x: 34 * TILE + 24, y: 116 * TILE + 16, phases: 'always',
    greet: ['往北走，别往南。', '这土是红的，不是染的。', '你听见虫子叫了吗？'],
    ask: '瘴气夜里最重。白天来，我还能替你认路。',
  },
  {
    id: 'w_ferry', art: 'npcGeng', name: '周摆渡', role: '江岸渡子',
    x: 100 * TILE - 32, y: 116 * TILE + 16, phases: 'always',
    greet: ['桥是去年才架的。', '水底下有东西，别往下看。', '过江往东，是江匪的地界。'],
    ask: '铁链还在水底。上游冲下来的东西，都挂在链子上。',
  },
];
for (const w of WANDERERS) {
  const o = vobj(w.art, w.x, w.y, { villager: w.id, baseY: w.y, wild: true });
  o.data = w;
  o.spoke = 0;
  vilObjs.push(o);
}
const ALL_TALKERS = VILLAGERS.concat(WANDERERS);
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
// 洞里的火是会烧完的：玩家手上一支、每间屋一盏，各自计油。
// 火把灭了不是全黑 —— 留 26px 的「贴身可见」，否则玩家连墙都摸不到。
const TORCH_FUEL = 100;                       // 秒
const BRAZIER_FUEL = () => 110 + Math.random() * 70;
const BRAZIER_OUT = 0x555a66;                 // 灭掉的火盆压暗
let dgGustT = 40;                             // 下一阵穿堂风

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
  if (kind === 'brazier') { o.lit = true; o.fuel = BRAZIER_FUEL(); }
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
  // 每下一层都是一支新火把、一层重新点过的火盆。
  player.torch = { lit: true, fuel: TORCH_FUEL, outs: 0 };
  dgGustT = 40;
  // 换层 / 重排时把上一层的地面危险区收掉 —— 否则一层留下的毒雾会飘到下一层，
  // 玩家刚落地就掉血，还找不到来源。飞剑环绕同理。
  clearHazards();
  clearArts();
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
  refreshSeal();
}

// 封碑：三物未齐时，古洞门口那两格是实心的。
// 不做"对话框拦一道"—— 弹窗只是通知，把门真的堵上，玩家才会回去找碑奴问缺什么。
// 每层重排都要重新上一次封，因为 dgBuild 会把整块地重写。
let sealOn = false;
function refreshSeal() {
  if (!dgData) return;
  const miss = tripleMissing(player.relics);
  sealOn = miss.length > 0;
  const W = dgData.W, H = dgData.H;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (dgData.t[y * W + x] !== DGT.DOOR) continue;
    const gx = DG.tx0 + x, gy = DG.ty0 + y;
    if (gx < 0 || gy < 0 || gx >= MAPW || gy >= MAPH) continue;
    solid[gy * MAPW + gx] = sealOn ? 1 : 0;
  }
}
function nearSeal() {
  if (!sealOn || !dgData) return false;
  return Math.hypot(player.x - dgData.doorX, player.y - DG.y1) < 44;
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
  torch: { lit: true, fuel: TORCH_FUEL, outs: 0 },
  dashT: 0, dashCd: 0, flash: 0, iframe: 0, shield: 0, hurtFlash: 0,
  poison: 0, poisonT: 0, poisonImmuneT: 0, rootT: 0,
  bossKills: {},
  // 任务：quests 只存"走到第几步、这一步攒了多少"，条件判定每次现算 ——
  // 把判定结果也存下来，改一个数值就得写迁移，不值。
  quests: {}, relics: {}, track: null,
  drunkT: 0, drunk: 0, rested: false,
  inv: [], invMax: 20, equip: { weapon: null, armor: null, necklace: null, artifact: null },
  windCd: 0, skillPts: 0, skillLv: {}, kills: 0,
  // 兵器专精：fam → 累计击杀。跟道行点刻意分开 —— 道行是境界给的"修为"，
  // 专精是拿这件兵器实打实砍出来的"手上功夫"，两套曲线互不占用。
  prof: {},
  // 招式槽 6 格，存 art id。换兵器时只清掉"不属于当前兵器"的格子，
  // 同一件兵器内部的手动编排保留。
  loadout: new Array(ART_SLOTS).fill(null),
  // 玩家是否手动排过装配格：手动过就不再被 autoLoadout 自动补位
  loadoutManual: false,
  // 招式的临时状态：增益列表 / 下一击必暴 / 下一击增伤。
  // 全是"这一趟"的东西，不进存档 —— 读档时带一身 buff 会比存档强一截。
  artBuffs: [], forceCrit: 0, nextDmg: 0,
  // 焚心：每一次普攻挥击的编号。mFxPaid 记着"哪一次挥击已经收过气"，
  // 一次挥击命中三只怪也只收一次 —— 代价按"出一次招"算，不按命中次数算。
  mFxSeq: 0, mFxPaid: 0,
  // 心法：一主二辅。主心法互斥（装第二条顶掉第一条），这是整个系统成立的关键 ——
  // 允许叠两条的话，玩家一定会去找"哪两条乘起来最爆"，最后收敛成一个答案。
  mantras: { main: null, sub: [null, null] },
  mantrasOwned: {},   // { pojun: 1 } 已学 + 注解等级（1~3）
  // 剧情：flags 是"玩家知道 / 发生过什么"，readLog 是已播节点，clues 是三条线索。
  // 三者都进存档 —— 读档后剧情不该重播一遍，那会把"一次性的事"变成循环。
  flags: {}, readLog: {}, clues: {},
  // 终章选过哪一条：「{ s_fin_choice: 'remember' }」。单独存一份而不是只落 flag，
  // 是因为旧事页要显示"你当时选了什么" —— 从 flag 反推要写一串 if，改文案就得改代码。
  choices: {},
  // 按怪 type 记击杀数。任务只看"当前这一步攒了多少"，剧情要看"这辈子杀过几只某类"，
  // 两者口径不同，不能共用 —— 任务进度会随步骤重置，累计击杀不会。
  typeKills: {},
};
const pMesh = quad(playerTex.down[0], 16, 18);
pMesh.visible = false;
const pShadow = quad(SHADOW_TEX, 13, 4.5);
pShadow.visible = false;
let enemies = [], drops = [], projectiles = [], dmgNums = [], messages = [];
let particles = [], sparks = [], ghosts = [], slashGhosts = [], bolts = [];
// 招式留下的地面区域（火雨 / 地裂 / 定军 / 千刃 / 铁蒺藜）。
// 跟首领的 hazards 分开：hazards 是敌人放的，zones 是玩家放的，结算与配色都不同。
let zones = [];
// 抛出去还没回来的兵器（回旋锤）。它不是 projectiles —— 弹体是一去不回，
// 这个是**要回手**的，轨迹、判定次数、结束条件都不一样。
let boomerangs = [];
// 有扩散速度的冲击波（震地）。也不是 zones：zones 是按 tick 结算一片，
// waves 是一个波前在移动，按"距离到达"结算一次。
let waves = [];
// 侧身位移左右交替：连放两次「游龙步」不会每次都往同一边倒
let dashSide = 1;
let state = 'menu', shakeX = 0, shakeY = 0, time = 0, saveT = 0, cleared = false;
let hitstop = 0, combo = 0, comboT = 0, comboPulse = 0, eliteT = 22, spawnT = 8;
const keys = {};
// 失焦 / 切模式时清干净方向键，避免「keyup 没送到 → 人朝一个方向一直走」
function clearKeys() { for (const k in keys) keys[k] = false; }
const skills = { qi: { cd: 0, max: 2.2 }, wu: { cd: 0, max: 6 }, thunder: { cd: 0, max: 5 } };
// 招式冷却按 art id 记，不按槽位 —— 同一个招式被挪到别的格子，冷却不该跟着归零。
const artCds = {};
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
  + 'Shift 身法 · Q 回春丹 · T 道行 · B 任务 · Tab 行囊 · E 铁匠台 · R 御风';
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
  { id: 'quest', label: '事', x: 296, y: 104, r: 13, size: 11, run: () => toggleQuests(true), cd: () => [0, 0] },
  // 招式键：底部中间那块（x 150~295 / y 166~262）在触屏上一直是空的 ——
  // 左边是摇杆热区、右边是动作键，正好塞下 3×2。只画"装了招式的格子"，
  // 空格子不出现，否则手机上会多出四五个点了没反应的圈。
  // 间距 42：容错圈半径是 r+PAD=20，两圈相切就要 40，留 2px 余量。
  ...Array.from({ length: ART_SLOTS }, (_, i) => ({
    id: 'art' + i, art: i, label: '',
    x: 180 + (i % 3) * 42, y: 196 + ((i / 3) | 0) * 42, r: 14, size: 11,
    run: () => castArt(i),
    labelFn: () => { const id = player.loadout[i]; const a = id ? artById(id) : null; return a ? a.name[0] : ''; },
    cd: () => {
      const id = player.loadout[i];
      const a = id ? artById(id) : null;
      return [id ? artCdOf(id) : 0, a ? artMaxOf(a) : 1];
    },
  })),
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
  // 招式键只在装了招式的格子上出现
  if (b.art !== undefined) {
    const id = player.loadout && player.loadout[b.art];
    if (!id) return false;
    const a = artById(id);
    return !!a && a.fam === weaponFam() && artUnlocked(profKills(a.fam), a);
  }
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
    const t = player.torch;
    const lit = !t || t.lit;
    // 快烧完时先自己暗下去，给玩家一个「该找火盆了」的信号。
    const dim = lit ? 0.72 + 0.28 * Math.min(1, (t ? t.fuel : TORCH_FUEL) / 25) : 0;
    lightSources[0].r = lit ? 112 * dim : 26;
    lightSources[0].k = lit ? 1 : 0.55;
    lightSources[0].warm = 1;
    for (const o of dgObjs) {
      if (o.kind === 'brazier') {
        if (o.lit === false) continue;
        const f = Math.max(0.42, Math.min(1, (o.fuel || 0) / 25));
        lightSources.push({ x: o.x, y: o.y - 12, r: 70 * f, k: 0.86 * f, warm: 1 });
      }
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

// ---- 洞里的火：会烧完、会被吹灭、能借火重燃 ----
// 第三幕正文写「火把灭了三次。第一次是被风。第二次是被翅膀。第三次，你干脆不点了。」
// 以前 DG_DARK 只是个常数，这句话纯属叙述；现在风、翅膀、油量都是机制。
function douseBrazier(o, why) {
  if (!o || o.kind !== 'brazier' || o.lit === false) return false;
  o.lit = false; o.fuel = 0;
  o.mesh.material.color.set(BRAZIER_OUT);
  burst(o.x, o.y - 12, C.ink3, 8, 36);
  if (Math.hypot(player.x - o.x, player.y - o.y) < 180) msg(why + ' · 一盏火盆灭了', C.paper1);
  return true;
}
function douseBraziersNear(x, y, r, why) {
  let best = null, bd = r;
  for (const o of dgObjs) {
    if (o.kind !== 'brazier' || o.lit === false) continue;
    const d = Math.hypot(o.x - x, o.y - y);
    if (d < bd) { bd = d; best = o; }
  }
  return best ? douseBrazier(best, why) : false;
}
function nearBrazier() {
  let best = null, bd = 36;
  for (const o of dgObjs) {
    if (o.kind !== 'brazier') continue;
    const d = Math.hypot(player.x - o.x, player.y - o.y);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}
function dgRelight(o) {
  const wasOut = o && o.lit === false;
  if (wasOut) {
    o.lit = true; o.fuel = BRAZIER_FUEL();
    o.mesh.material.color.set(0xffffff);
    burst(o.x, o.y - 12, C.gold3, 12, 60);
  }
  // 火盆是「火的补给点」：走近按 E，火把重新点满，不用新增火折子这类道具。
  player.torch.lit = true; player.torch.fuel = TORCH_FUEL;
  AUDIO.play('pickup');
  msg(wasOut ? '火盆重新点上了 · 火把也亮了' : '借了个火 · 火把又满了', C.jade3);
  return true;
}
function updateDgFire(dt) {
  if (!dgIn(player.x, player.y)) return;
  const t = player.torch;
  if (t && t.lit) {
    t.fuel -= dt;
    if (t.fuel <= 0) {
      t.lit = false; t.fuel = 0; t.outs = (t.outs || 0) + 1;
      burst(player.x, player.y - 12, C.paper2, 8, 40);
      msg(t.outs >= 3 ? '第三回了。这回你没急着点。' : '风一灌，火把灭了', C.red3);
    }
  }
  // 第一次灭是被风：每隔三四十秒吹掉一盏；身边没有就吹远处任意一盏。
  dgGustT -= dt;
  if (dgGustT <= 0) {
    dgGustT = 38 + Math.random() * 30;
    if (!douseBraziersNear(player.x, player.y, 220, '一阵穿堂风')) {
      const lit = dgObjs.filter(o => o.kind === 'brazier' && o.lit !== false);
      if (lit.length) douseBrazier(lit[(Math.random() * lit.length) | 0], '不知哪儿来的风');
    }
  }
  for (const o of dgObjs) {
    if (o.kind !== 'brazier' || o.lit === false) continue;
    o.fuel -= dt;
    if (o.fuel <= 0) douseBrazier(o, '油烧干了');
  }
}

// 时辰光罩。a=0 的白天直接在函数开头返回，零开销。
function drawDayNight(camX, camY) {
  // 洞里不看天时。白天进洞、夜里进洞，看到的是同一片黑 ——
  // 否则玩家会拿"外面的光"当路标，地宫的空间感立刻散掉。
  const inDg = dgIn(player.x, player.y);
  const L = inDg ? DG_DARK : clock.light;
  const totalA = inDg
    ? Math.min(0.94, DG_DARK.a + (player.torch && !player.torch.lit ? 0.08 : 0))
    : Math.min(0.74, L.a);
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
  // 心法：全部走加法区。和道行树的加成先加再乘一次，绝不出现"乘算叠乘算"。
  const mm = mantraMod(player.mantras, player.mantrasOwned);
  const s = {
    atk: player.atkBase, def: 0, hp: player.maxHpBase,
    crit: 5, critDmg: 150, spd: 0, cdr: 0, lifesteal: 0, luck: 0,
    atkSpd: 0, qiMax: 60, qiRegen: 4, skillDmg: 0, comboPct: 0, qiOnHit: 0, dmgReduce: 0,
    // 心法专用字段：pierce 破防 / goldMul 银两 / dropMul 掉落 / iframeMul 受击无敌
    pierce: 0, goldMul: 0, dropMul: 0, iframeMul: 0,
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
  s.atk = Math.round(s.atk * (1 + (sk.atkPct + mm.atkPct) / 100));
  s.hp = Math.round(s.hp * (1 + (sk.hpPct + mm.hpPct) / 100));
  s.crit += sk.crit; s.critDmg += sk.critDmg; s.spd += sk.spd; s.atkSpd += sk.atkSpd;
  s.lifesteal += sk.lifesteal; s.luck += sk.luck; s.qiMax += sk.qiMax * 4;
  s.qiRegen += sk.qiRegen; s.skillDmg += sk.skillDmg; s.comboPct += sk.comboPct;
  s.qiOnHit += sk.qiOnHit; s.dmgReduce += sk.dmgReduce;
  // 心法加法区
  s.crit += mm.crit; s.critDmg += mm.critDmg; s.spd += mm.spd; s.cdr += mm.cdr;
  s.lifesteal += mm.lifesteal; s.skillDmg += mm.skillDmgPct; s.dmgReduce += mm.dmgReduce;
  s.pierce += mm.pierce; s.goldMul += mm.goldMul; s.dropMul += mm.dropMul;
  s.iframeMul += mm.iframeMul;
  // 真气上限/回复是"百分比放大"，放在最后乘一次 —— 否则装备给的 +真气 会被算漏
  if (mm.qiMaxPct) s.qiMax = Math.round(s.qiMax * (1 + mm.qiMaxPct / 100));
  if (mm.qiRegenPct) s.qiRegen = Math.round(s.qiRegen * (1 + mm.qiRegenPct / 100) * 10) / 10;
  return s;
}
// 当前主心法 id（没装返回 null）。钩子里到处要用，包一层省得到处解构。
function mantraMain() { return mainOf(player.mantras); }
function mantraParam(k) {
  const a = MAIN[mantraMain()];
  return a && a.params ? a.params[k] : undefined;
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
  return Math.max(0.13, 0.30 * W.spdMul /
    (1 + Math.min(70, stats().atkSpd + artBuff('atkSpd')) / 100));
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
  // 巡逻路线：手写的用 [dx,dy] 格偏移，数字的自动摊一个椭圆环。
  // 环用 54×42 而不是正圆 —— 正圆一眼就看得出是"程序画的"。
  let route = null;
  if (camp && camp.patrol) {
    if (Array.isArray(camp.patrol)) {
      route = camp.patrol.map(p => ({ x: camp.x + p[0] * TILE, y: camp.y + p[1] * TILE }));
    } else {
      const n = camp.patrol | 0, a0 = (camps.indexOf(camp) + 1) * 0.9;
      route = [];
      for (let k = 0; k < n; k++) {
        const a = k / n * Math.PI * 2 + a0;
        route.push({ x: camp.x + Math.cos(a) * 54, y: camp.y + Math.sin(a) * 42 });
      }
    }
  }
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
    // —— 生态字段 ——
    route: route, ri: route ? (Math.random() * route.length) | 0 : 0, pauseT: 0,
    sleep: false, alertT: 0, hunt: null, panicT: 0, huntCd: 0, wakeT: 0,
    // —— 首领字段 ——
    // e.boss 是统一标记：血条、免疫击退、掉落档位、小地图标记全看它，
    // 不再按 type 一个个判断（以前加一个首领要改七八处）。
    boss: (MONSTERS[type] || {}).behavior === 'boss',
    skillCds: null, skillGap: 1.2, skill: null, skillT: 0,
    // —— 状态 ——
    // 灼烧 / 流血 / 中毒是三种 DoT（伤害来源不同、颜色不同，但结算方式一样），
    // 冻结与眩晕都"不动不出手"，区别是冻结期间受伤加成；减速只改速度。
    // 破甲改的是 def，所以单独记一个原值，到期还原 —— 直接改 def 不复位，
    // 挨一次碎骨锤这只怪就永远软了。
    bleed: 0, bleedT: 0, burn: 0, burnT: 0, poison: 0, poisonT: 0,
    freezeT: 0, stunT: 0, slowT: 0, slowPct: 0, breakT: 0, breakPct: 0, def0: def,
    launchT: 0, launchZ: 0, landDmg: 0, poisonSpread: false,
    lastFam: null,
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
    // 夜行的那批一起生成，白天只是"睡着"。
    // 不做"到点重新刷一批"—— 那会出现打到一半怪凭空消失的情况。
    if (c.night) {
      for (let i = 0; i < c.night.length; i++) {
        const a = i / c.night.length * Math.PI * 2 + 0.7;
        spawnEnemy(c.night[i], c.x + Math.cos(a) * 62, c.y + Math.sin(a) * 48, c);
      }
    }
    if (c.lord) {
      const lord = spawnEnemy(c.lord.type, c.x, c.y - 22, c, {
        name: c.lord.name, hp: 2.4, dmg: 1.3, cd: 0.8, color: C.gold3, lord: true,
      });
      if (lord) lord.lord = c.lord.name;
    }
  }
  spawnEnemy('treant', TREANT_POS.x, TREANT_POS.y, { x: TREANT_POS.x, y: TREANT_POS.y });
  // 巢穴首领：不进营地，各自独占一块空场。alert 给 0 —— 它们不吹哨，
  // 也没有同伴可叫，玩家打不过就跑，跑出 190px 它自己会回去。
  for (const d of dens) {
    const b = spawnEnemy(d.type, d.x, d.y, { x: d.x, y: d.y, alert: 0 });
    if (b) {
      b.combatT = 0;
      b.ring = quad(tex(RING_C), MONSTERS[d.type].size[0] + 14, MONSTERS[d.type].size[1] + 12);
      b.ring.material.color.set(C.red2);
      b.ring.material.opacity = 0.7;
      b.ring.renderOrder = 990;
      b.den = d.name;
    }
  }
  if (!cleared) spawnEnemy('boss', ALTAR.x, ALTAR.y, ALTAR);
}
function msg(txt, color) { messages.push({ txt, color: color || C.paper3, t: 2.4 }); if (messages.length > 3) messages.shift(); }
// 吹哨：一只发现你，同营地、alert 半径内的同伴一起上。
// 只传一层 —— 被叫醒的不再继续叫，否则整片野地会连锁反应，玩家永远在打一个营。
function shout(e) {
  const c = e.camp;
  if (!c || !c.alert) return;
  let n = 0;
  for (const o of enemies) {
    if (o === e || o.dead || o.aggro || o.sleep) continue;
    if (o.camp !== c) continue;
    if (Math.hypot(o.x - e.x, o.y - e.y) > c.alert) continue;
    o.aggro = true; o.pauseT = 0; o.hunt = null; o.wakeT = 20;
    n++;
  }
  if (n > 0) {
    e.alertT = 0.6;
    burst(e.x, e.y - 16, C.gold2, 7, 34);
    dmgNum(e.x, e.y - 26, '！', C.gold3, false);
    AUDIO.play('windup');
  }
}
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
  // 招式增益的暴击 / 暴伤：走加法区，跟心法一样不叠乘算。
  // forceCrit 不走 Math.min(80, ...) —— 被截到 80 就不是"必暴"了。
  const critAdd = ((opt && opt.critAdd) || 0) + artBuff('crit');
  const crit = player.forceCrit > 0 || (opt && opt.forceCrit) ||
    Math.random() * 100 < Math.min(80, s.crit + comboCrit + critAdd);
  let dmg = s.atk * (0.9 + Math.random() * 0.2) * mul * comboMult();
  // 酒不是回血道具，是"敢不敢现在出门"的赌注：伤害上去了，判断力没上去
  if (player.drunkT > 0 && player.drunk) dmg *= 1 + player.drunk;
  if (opt && opt.skill) dmg *= 1 + s.skillDmg / 100 + ((opt.skillDmg) || 0);
  dmg *= 1 + artBuff('atkPct') / 100;
  if (crit) dmg *= (s.critDmg + artBuff('critDmg')) / 100;
  return { dmg: Math.max(1, Math.round(dmg)), crit };
}
// ============ 心法运行时 ============
// 心法**不新写一套战斗逻辑**：五个机制钩子全部折进已有的三条路径 ——
//   hitEnemy（伤害乘区 / 命中后效果）、hurtPlayer（受击）、update（时间累积）
// 改数值只动 mantras.js 的 params，这里不用碰。
function mantraResetCombat() {
  player.mChainE = null; player.mChainN = 0; player.mChainT = 0;
  player.mCang = 0; player.mCangT = 0; player.mCangBonus = 0;
  player.mTieyiN = 0; player.mTieyiT = 0;
  player.mJiFengT = 0; player.mIdleT = 0;
  player.mFxSeq = 0; player.mFxPaid = 0;
}

// 乘区：破军 / 追命 / 寒潭 / 藏锋 / 疾风。
// 全部**乘**在这里一次，不往 stats() 里塞 —— 那些是"站着不动就生效"的常驻值，
// 这几个是"这一下打出去才算"的瞬时值，混在一起会让面板数字说谎。
function mantraDmgMul(e) {
  const id = mantraMain();
  let m = 1;
  if (id === 'pojun') {
    const p = MAIN.pojun.params;
    const r = e.maxHp ? e.hp / e.maxHp : 1;
    if (r >= 0.999) m *= 1 + p.up;
    else if (r <= 0.5) m *= 1 + p.down;
  } else if (id === 'zhuiming') {
    const p = MAIN.zhuiming.params;
    m *= 1 + Math.min(p.cap, (player.mChainN || 0) * p.per);
  } else if (id === 'hantan') {
    if (e.slowT > 0) m *= 1 + MAIN.hantan.params.bonus;
  }
  // 藏锋 / 疾风是"一次性增益"，谁先打中谁吃掉 —— 见 mantraOnHit
  if (player.mCangBonus) m *= 1 + player.mCangBonus;
  if (player.mJiFengT > 0) m *= 1 + MAIN.jifeng.params.mul;
  return m;
}

// 出招时结算藏锋：把攒的层数换成这一击的加成。
// 在 attack() / castArt() 里调，不在 hitEnemy 里 —— 一记横扫打三只怪，
// 加成只该给第一只，剩下的靠 mCangBonus 清零来保证。
function mantraOnCast() {
  // 出招就是"出招"—— 普攻与招式都算，否则蓄力流会变成"边打边蓄"
  player.lastAtkT = time;
  if (mantraMain() !== 'cangfeng') return;
  const n = player.mCang || 0;
  if (n <= 0) return;
  player.mCangBonus = n * MAIN.cangfeng.params.per;
  player.mCang = 0; player.mCangT = 0;
}

// 无常：让一个技能的剩余冷却减半。
// 优先挑"剩得最久"的那个 —— 玩家体感上那才叫"终于能再放一次"。
// 是减半不是清零：清零能让 30 秒的大招变成几秒一发，一条心法就顶掉了整个构筑的差异。
function resetOneCd() {
  let best = null, bestT = 0.5;
  for (const k in artCds) if (artCds[k] > bestT) { best = k; bestT = artCds[k]; }
  if (best) {
    artCds[best] = artCds[best] / 2;
    msg('无常 · 「' + (ARTS[best] ? ARTS[best].name : '招式') + '」冷却减半', C.gold3);
    return true;
  }
  for (const k of ['thunder', 'wu', 'qi']) {
    if (skills[k].cd > 0.5) {
      skills[k].cd = skills[k].cd / 2;
      msg('无常 · 冷却减半', C.gold3);
      return true;
    }
  }
  return false;
}

function mantraOnHit(e, dmg, info) {
  const id = mantraMain();
  // 一次性增益：无论装的是哪条主心法，打中了就得吃掉（换心法前的残留不该留着）
  if (player.mCangBonus) player.mCangBonus = 0;
  if (player.mJiFengT > 0) player.mJiFengT = 0;
  player.mIdleT = 0;
  if (!id) return;
  if (id === 'zhuiming') {
    // 递增从第二击开始：第一击只是"咬住了"，不加成
    if (player.mChainE === e) player.mChainN = Math.min(9, (player.mChainN || 0) + 1);
    else { player.mChainE = e; player.mChainN = 0; }
    player.mChainT = MAIN.zhuiming.params.window;
  } else if (id === 'fenxin') {
    const p = MAIN.fenxin.params;
    // 代价只从"普攻"里出，而且一次挥击只收一次（info.basic 是这一次挥击的编号）。
    // P6 之前按命中收气没问题：那时候只有两招，命中次数少。
    // 六招同开之后，招式的多段命中把按命中收的气放大到把整池真气抽干 ——
    // 实测焚心 + 六招满配的 DPS 只有裸装的 33%（招式放不出来，只剩普攻在砍）。
    // 改成按挥击收气：代价还是"吃真气"（命中回 3，净 -2），但不会跟招式抢气。
    // 真气不够就点不着 —— 这就是"焚心"的代价，不是 bug
    if (info && info.basic && info.basic !== player.mFxPaid
      && player.qi >= p.qi) {
      player.mFxPaid = info.basic;
      player.qi -= p.qi;
      const dps = Math.max(1, stats().atk * p.pct);
      // 复用已有的 burn 状态机（dotTick 里结算），不新增状态
      if ((e.burn || 0) < dps) e.burn = dps;
      e.burnT = Math.max(e.burnT || 0, p.dur);
    }
  } else if (id === 'hantan') {
    const p = MAIN.hantan.params;
    if (Math.random() < p.chance) {
      e.slowT = Math.max(e.slowT || 0, p.dur);
      e.slowPct = Math.max(e.slowPct || 0, p.pct);
    }
  } else if (id === 'wuchang') {
    if (info && info.crit && Math.random() < MAIN.wuchang.params.chance) resetOneCd();
  }
}

// 铁衣：按当前层数减伤。**先算这一下，再叠层** —— 第一下永远白挨，
// 那正是这条心法的代价。
function mantraHurtMul() {
  if (mantraMain() !== 'tieyi') return 1;
  const p = MAIN.tieyi.params;
  return 1 - p.pct * Math.min(p.max, player.mTieyiN || 0);
}
function mantraOnHurt(real) {
  player.mIdleT = 0;
  // 卸力：转气放在护盾结算之前 —— 罡气挡下来的那部分也是"受力"
  if (mantraMain() === 'xieli') {
    const gain = Math.round(real * MAIN.xieli.params.pct);
    if (gain > 0) player.qi = Math.min(maxQi(), player.qi + gain);
  }
}
function mantraAfterHurt() {
  if (mantraMain() !== 'tieyi') return;
  const p = MAIN.tieyi.params;
  player.mTieyiN = Math.min(p.max, (player.mTieyiN || 0) + 1);
  player.mTieyiT = p.dur;
}
// 闪避成功（不是格挡、不是硬吃）
function mantraOnDodge() {
  player.mIdleT = 0;
  if (mantraMain() === 'jifeng') player.mJiFengT = MAIN.jifeng.params.dur;
}

function updateMantras(dt) {
  const id = mantraMain();
  // 脱战计时：所有主心法共用，命中/受击/闪避都会清零
  player.mIdleT = (player.mIdleT || 0) + dt;

  if (id === 'cangfeng') {
    const p = MAIN.cangfeng.params;
    // 「不出招」的判定用 lastAtkT：手一直在挥的时候不该攒层，
    // 否则藏锋就变成一条"白给 +40%"的心法，代价凭空消失。
    if ((player.mCang || 0) < p.max && time - player.lastAtkT > 0.6) {
      player.mCangT = (player.mCangT || 0) + dt;
      if (player.mCangT >= 1) {
        player.mCang = Math.min(p.max, (player.mCang || 0) + 1);
        player.mCangT -= 1;
      }
    }
  } else { player.mCang = 0; player.mCangT = 0; }

  if (player.mChainT > 0) {
    player.mChainT -= dt;
    if (player.mChainT <= 0) { player.mChainE = null; player.mChainN = 0; }
  }
  if (player.mTieyiT > 0) {
    player.mTieyiT -= dt;
    if (player.mTieyiT <= 0) player.mTieyiN = 0;
  }
  if (player.mJiFengT > 0) player.mJiFengT -= dt;

  // 归元：脱战满 3 秒后持续回血。不做飘字，否则站着不动满屏 +N 数字
  if (id === 'guiyuan' && player.mIdleT >= MAIN.guiyuan.params.delay && player.hp > 0 && player.hp < maxHp()) {
    player.hp = Math.min(maxHp(), player.hp + maxHp() * MAIN.guiyuan.params.pct / 100 * dt);
  }
}

// ============ 心法习得 ============
// 主心法**不能全靠买**。它是构筑的核心，必须让玩家觉得"这条是我打下来的"。
// 所以 8 条挂在首领首杀，4 条挂在已有里程碑上（主线做出来之后由 P7 改挂剧情节点）。
function mantraCondMet(f) {
  if (!f) return false;
  if (f.kind === 'boss') return ((player.bossKills || {})[f.id] || 0) > 0;
  if (f.kind === 'bosses') return Object.keys(player.bossKills || {}).length >= f.n;
  if (f.kind === 'kills') return (player.kills || 0) >= f.n;
  if (f.kind === 'fame') return (player.fame || 0) >= f.n;
  if (f.kind === 'level') return player.level >= f.n;
  // 剧情标记：P7 起心法可以挂在"你经历过什么"上，而不是只挂在数值上。
  // 这是心法与剧情之间唯一的一根线 —— 不再加第二种挂钩方式，
  // 否则以后每加一条心法都要先想"它该挂在哪个系统上"。
  if (f.kind === 'flag') return !!(player.flags && player.flags[f.id]);
  return false;
}

function learnMantra(id, silent) {
  const a = MANTRAS[id];
  if (!a || player.mantrasOwned[id]) return false;
  player.mantrasOwned[id] = 1;
  // 辅心法学会就顺手装上（有空槽时）。空槽不用白不用，
  // 让玩家学会之后还要跑去面板点一次，只会让人以为没生效。
  if (a.kind === 'sub' && player.mantras.sub.indexOf(null) >= 0) mantraInstall(player.mantras, id);
  invalidateStats();
  if (!silent) msg('悟得心法「' + a.name + '」', C.gold3);
  renderMantras();
  return true;
}

// 判定只有这一份，调用点分散在杀敌 / 侠名 / 升级三处。
// 分散写判定会出现"某条心法永远学不到"—— 归元那次就是这么漏的。
function checkMantraUnlocks() {
  for (const id of MAIN_IDS) {
    if (player.mantrasOwned[id]) continue;
    const f = MAIN[id].from;
    if (!mantraCondMet(f)) continue;
    learnMantra(id, true);
    msg('心法现世 · 「' + MAIN[id].name + '」（' + (f.text || '') + '）', C.gold3);
    AUDIO.play('rare');
  }
}

// 藏经阁残卷「注解」：+1 级，上限 3 级。只放大好处，不放大代价。
function upgradeMantra(id) {
  if (!player.mantrasOwned[id] || player.mantrasOwned[id] >= MANTRA_MAX_LV) return false;
  player.mantrasOwned[id]++;
  invalidateStats();
  renderMantras();
  return true;
}

function hitEnemy(e, info, ang, kb) {
  const s = stats();
  // 「下一击」的一次性标记在这里消费，而不是在 castArt / rollDamage 里 ——
  // 一记横扫扫三只怪，只有第一只吃到加成，这才叫"下一击"而不是"这一整招"。
  if (player.nextDmg) { info.dmg *= 1 + player.nextDmg; player.nextDmg = 0; }
  if (player.forceCrit) player.forceCrit = 0;
  // 破防 / 贯甲：招式可以按比例无视防御。放在这里而不是各自算一遍，
  // 是为了让"普攻 / 弹体 / 落雷 / 持续伤害"四条路径共用同一套减伤规则。
  // 锐金（辅心法）的破防也折进同一项，不另开一条减伤公式。
  const def = Math.min(0.7, e.def || 0) * (1 - Math.min(0.9, (info.pierceDef || 0) + (s.pierce || 0) / 100));
  // 冻结期间受伤 +20%（冰封的代价就是"解冻前那一顿打"）
  const frozen = e.freezeT > 0 ? 1.2 : 1;
  // 晨雾偷袭 / 摸睡：还没察觉你的怪，第一下 ×1.5 —— 卯时与深夜清营地最划算
  const sneak = (clock.isDawn || e.sleep) && !e.aggro;
  const mul = sneak ? dawnStrike() : 1;
  const dmg = Math.max(1, Math.round(info.dmg * mul * (1 - def) * frozen * mantraDmgMul(e)));
  e.hp -= dmg;
  // 记下"这一下是谁打的" —— 专精按最后命中的兵器算，杀敌时结算。
  // 不记的话，用剑把怪磨到一丝血、切锤补最后一刀，锤就白赚了全部专精。
  e.lastFam = info.fam || player.lastHitFam || weaponFam();
  // 打醒：睡着了挨一下必然醒，而且立刻叫人
  if (e.sleep) { e.sleep = false; e.wakeT = 25; e.aggro = true; shout(e); }
  e.combatT = 4;   // 挨了打就算在交战，首领血条要亮着
  e.flash = 0.16; e.hitJit = 0.2; e.stagger = Math.max(e.stagger, info.crit ? 0.16 : 0.09);
  const kbm = (e.elite ? 0.55 : 1) * (e.boss ? (e.type === 'treant' ? 0.25 : 0.1) : 1) * (e.type === 'shigan' ? 0.25 : 1);
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
  // 心法的"命中后"效果（焚心灼烧 / 寒潭减速 / 追命递增 / 无常重置 CD）
  // 放在死亡判定之前：这一下打死人也该把状态挂上去（毒镖传染就是这么做的）
  mantraOnHit(e, dmg, info);
  // 淬毒：增益期间每一击都带毒，普攻 / 招式 / 弹体一视同仁（都汇到 hitEnemy）。
  if (artBuff('poisonOnHit') > 0) applyStatus(e, { kind: 'poison', dur: 4, pct: 0.06 }, dmg);
  if (e.hp <= 0) killEnemy(e);
  return dmg;   // 返回实际伤害：自动化测试要拿它验证偷袭/减伤，运行时不依赖
}
function hurtPlayer(d) {
  if (player.dashT > 0 || player.iframe > 0) {
    dmgNum(player.x, player.y - 16, '闪避', C.jade3);
    // 疾风：闪避成功才给那 1.5 秒窗口。格挡与硬吃不触发 —— 否则"站桩扛"也能吃到
    mantraOnDodge();
    return;
  }
  const s = stats();
  let real = d * 22 / (22 + s.def);
  // 铁布衫的减伤与狂怒的"受伤 +15%"都走加法区，跟装备 / 道行 / 心法同一个口径
  real *= 1 - Math.min(60, s.dmgReduce + artBuff('dmgReduce')) / 100;
  real *= mantraHurtMul();   // 铁衣：按**当前**层数减伤，这一下不算新层
  real *= 1 + artBuff('hurtPct') / 100;
  real = Math.max(1, Math.round(real));
  // 卸力：转气放在护盾之前 —— 罡气挡下来的那部分也是"受力"
  mantraOnHurt(real);
  if (player.shield > 0) {
    const ab = Math.min(player.shield, real);
    player.shield -= ab; real -= ab;
    dmgNum(player.x, player.y - 20, '罡气 -' + ab, C.jade3);
    if (real <= 0) { AUDIO.play('shield'); mantraAfterHurt(); return; }
  }
  player.hp -= real; player.flash = 0.24;
  // 沉肩（辅心法）：受击后的无敌帧拉长。0.62 是普攻节奏的下限，
  // 再短玩家会觉得"刚站起来又挨一下"。
  player.iframe = 0.62 * (1 + (s.iframeMul || 0) / 100);
  shakeX += (Math.random() - 0.5) * 4; shakeY += 2.5;
  player.hurtFlash = 0.18;
  dmgNum(player.x, player.y - 16, '-' + real, C.red3, true);
  burst(player.x, player.y - 8, C.red2, 8, 70);
  AUDIO.play('hurt');
  mantraAfterHurt();
  // 铁壁：近身来打的还三成回去。走 dealDot，别再走一遍 hitEnemy ——
  // 挨一次打触发一次顿帧 + 火花就够了，反弹那下不该把屏幕再抖一次。
  const rf = artBuff('hurtReflect');
  if (rf > 0) {
    let best = null, bd = 64;
    for (const e of enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - player.x, e.y - player.y);
      if (d < bd) { bd = d; best = e; }
    }
    if (best) dealDot(best, real * rf / 100, C.gold3);
  }
  if (player.hp <= 0) { player.hp = 0; showDead(); }
}
// 法杖 / 暗器的普攻：把弹体塞进现有 projectiles，命中、飞行、穿怪都复用同一套。
// 不消耗真气（那是「剑气」技能的定位），伤害走普攻倍率与连击加成。
function fireWeaponProj(fam, cfg, sw, fxTok) {
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
      basic: fxTok,   // 普攻弹体：焚心按挥击收气，这一梭命中几个都算同一次挥击
    });
  }
  burst(player.x + fx * 12, player.y - 8 + fy * 12, W.trail[0], n > 1 ? 6 : 3, 45);
}

function attack() {
  if (state !== 'play') return;
  if (player.atkCd > 0) { player.atkBuf = 0.26; return; }
  const fam = weaponFam(), W = WEAPONS[fam];
  player.lastHitFam = fam;
  const list = W.swings;
  if (time - player.lastAtkT < 0.85) player.atkStep = (player.atkStep + 1) % list.length;
  else player.atkStep = 0;
  const sw = list[player.atkStep];
  player.lastAtkT = time;
  // 这一次挥击的编号：焚心按挥击收气（一次挥击只收一次），招式不带这个编号
  const fxTok = ++player.mFxSeq;
  mantraOnCast();   // 藏锋：把攒的层换成这一击的加成（顺手刷新出招计时）
  player.atkCd = attackInterval();
  player.atkBuf = 0;
  player.atkT = sw.dur; player.lunge = sw.lunge;
  const base = DIRA[player.dir];
  player.swing = { fam, step: player.atkStep, base, sw, t: sw.dur, dur: sw.dur };
  AUDIO.play('slash', fam);

  if (W.ranged && sw.proj) { fireWeaponProj(fam, sw.proj, sw, fxTok); return; }

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
    // basic = 这一次挥击的编号：焚心按挥击收气（一次挥击只收一次），
    // 招式命中不带这个字段，所以招式不参与焚心的真气结算。
    for (let k = 0; k < hits; k++) {
      const r = rollDamage(sw.mul);
      r.basic = fxTok;
      hitEnemy(e, r, Math.atan2(dy, dx), sw.kb);
    }
  }
  if (sw.shock) {
    shakeX += 2; shakeY += 3;
    burst(player.x + Math.cos(base) * 18, player.y - 4 + Math.sin(base) * 10, C.gold2, 14, 90);
  }
}
// ============ 首领专属掉落 ============
// 每个首领首杀必掉一件唯一装备：名字写死、词缀里挂一条专属的。
// 不做随机生成 —— 「从谁身上掉的」要能被记住，随机名字记不住。
const UNIQUES = {
  qingshe: { name: '青鳞缚', kind: 'armor',    tag: '缠身', stat: 'hp',       val: 30, note: '气血 +30，被缠时受伤减半' },
  kuilei:  { name: '机关心', kind: 'artifact', tag: '布陷', stat: 'skillDmg', val: 14, note: '术法 +14%，傀儡陷阱伤害同享' },
  shimu:   { name: '石母胎', kind: 'armor',    tag: '厚土', stat: 'def',      val: 11, note: '防御 +11，受击时 20% 概率再减半' },
  huoya:   { name: '火鸦翎', kind: 'necklace', tag: '灼翼', stat: 'critDmg',  val: 36, note: '暴伤 +36，暴击附带灼烧' },
  wumian:  { name: '无面刃', kind: 'weapon',   tag: '拔刀', stat: 'atk',      val: 24, fam: 'blade', note: '攻击 +24，拔刀斩伤害 +40%' },
};
function makeUnique(type, ilvl) {
  const u = UNIQUES[type];
  if (!u) return null;
  const it = makeGear(u.kind, 4, Math.max(6, ilvl), Math.random, u.fam);
  it.name = u.name;
  it.unique = true;
  it.note = u.note;
  // 专属词缀放最前，重铸时由 items.js 保下来
  it.affixes.unshift({ id: 'uniq', name: u.tag, stat: u.stat, val: u.val, uniq: true });
  return it;
}

function killEnemy(e) {
  e.dead = true; scene.remove(e.mesh); if (e.ring) scene.remove(e.ring); if (e.shadow) scene.remove(e.shadow);
  const m = MONSTERS[e.type];
  player.kills = (player.kills || 0) + 1;
  // 按 type 累计。剧情节点用它判"杀过几只某类怪"，
  // 跟任务进度（会随步骤归零）是两套账，不能混。
  if (e.type) player.typeKills[e.type] = (player.typeKills[e.type] || 0) + 1;
  player.xp += m.xp;
  // 专精：按"最后一下是谁打的"给。普通 1 / 精英 3 / 首领 12 —— 首领一次顶一轮小怪，
  // 免得玩家为了练专精一直在营地刷杂兵。
  addProf(e.lastFam || weaponFam(), e.boss ? PROF_WEIGHT.boss : e.elite ? PROF_WEIGHT.elite : PROF_WEIGHT.normal);
  // 毒镖的传染：中毒者倒下时毒气四散，周围一起中毒。
  // 不做这个，毒镖就只是一发"伤害高一点的镖"，特色位白占。
  if (e.poisonSpread) {
    burst(e.x, e.y - e.h / 2, C.jade2, 14, 90);
    for (const o of enemies) {
      if (o === e || o.dead) continue;
      if (Math.hypot(o.x - e.x, o.y - e.y) > 64) continue;
      o.poison = Math.max(o.poison, e.poison * 0.8);
      o.poisonT = Math.max(o.poisonT, 5);
      o.poisonSpread = true;
    }
  }
  // 第二次灭是被翅膀：火鸦扑棱过去，近旁的火盆就完了。
  if ((e.type === 'crow' || e.type === 'huoya') && dgIn(player.x, player.y))
    douseBraziersNear(e.x, e.y, 96, '翅膀扇过去');
  // 任务计数放在最前面：后面有通关判定会改 state，改完之后再计数容易被漏掉
  questOnKill(e);
  dmgNum(e.x, e.y - e.h - 6, '+' + m.xp + '历练', C.paper3);
  const cols = [C.paper2, C.red2, C.ink3];
  for (let i = 0; i < (e.elite ? 4 : 2); i++) burst(e.x, e.y - e.h / 2, cols[i % 3], 10, 90);
  if (e.elite) burst(e.x, e.y - e.h / 2, e.elite.color, 16, 110);
  AUDIO.play('die');
  dropLoot(e);
  // 营地首领：多掉一轮。不另做宝箱系统 —— 玩家要的是"这一下值钱"，
  // 而不是"再去点一个箱子"，多两次掉落读起来一样，还少一个交互。
  if (e.lord) {
    msg(e.lord + ' 伏诛 · 营地溃散', C.gold3);
    addFame(4);
    for (let i = 0; i < 2; i++) {
      const dx2 = i ? 18 : -18;
      addDrop('coin', 40 + ((Math.random() * 40) | 0), e.x + dx2, e.y + 4);
      const r = Math.max(2, rollRarity(stats().luck + nightLuck(), 2));
      addDrop('gear', makeGear(i ? 'armor' : 'weapon', r, Math.max(1, player.level + 2)), e.x + dx2, e.y + 10);
    }
  }
  // 侠名只用"值得说的事"来加：杀十只野狗不会让人记住你，斩一个寨主会。
  if (e.boss) addFame(8);
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
  checkMantraUnlocks();   // 「藏锋」挂在境界 18 上
  if (e.type === 'boss' && !e.dg) {
    cleared = true; state = 'clear';
    document.getElementById('clear').classList.remove('hidden');
    save();
  } else if (e.type === 'yaowang') {
    // 洞主：不通关，只在洞里兑现（清层 → 开箱）
    msg('洞主伏诛 · 石胎碎了一地', C.gold3);
    // 心法来源要记在这里：树妖 / 洞主走的是自己的分支，进不了下面那个 e.boss 分支，
    // 不补这一行，「归元」「寒潭」两条心法就永远学不到（第一次做就漏了）。
    player.bossKills[e.type] = (player.bossKills[e.type] || 0) + 1;
    // 石胎碎了，里面那道剑痕才露出来 —— 三幕里最深的一笔。
    // 无面剑客作为"真正的洞主"在岩魈倒下后接手，玩家没有喘息的机会。
    const wm = spawnEnemy('wumian', e.x, e.y - 10, { x: e.x, y: e.y });
    if (wm) {
      wm.dg = true; wm.aggro = true; wm.combatT = 6;
      wm.hp = wm.maxHp = Math.round(wm.maxHp * 1.1);
      wm.ring = quad(tex(RING_C), 34, 38);
      wm.ring.material.color.set(C.paper1);
      wm.ring.material.opacity = 0.8;
      wm.ring.renderOrder = 990;
      dgMobs.push(wm);   // 不清它，这一层的裂口不会开
      msg('石胎之中，有人持剑而立', C.paper1);
      AUDIO.play('boss');
    }
  } else if (e.type === 'treant') {
    msg('千年树妖伏诛 · 天材地宝现世', C.gold3);
    player.bossKills[e.type] = (player.bossKills[e.type] || 0) + 1;
    for (let i = 0; i < 2; i++) addDrop('gear', makeGear(SLOTS[(Math.random() * 4) | 0], 3 + ((Math.random() * 2) | 0), player.level + 2));
  } else if (e.boss) {
    // 野外首领：不算通关，只把这一带打服。
    // 首杀掉唯一装备 —— 这是"打首领"与"打一窝杂兵"唯一无法互相替代的地方。
    const first = !player.bossKills[e.type];
    player.bossKills[e.type] = (player.bossKills[e.type] || 0) + 1;
    const u = UNIQUES[e.type];
    msg(MONSTERS[e.type].name + ' 伏诛' + (first && u ? ' · 得「' + u.name + '」' : ''), C.gold3);
    AUDIO.play('rare');
    if (first) {
      const it = makeUnique(e.type, player.level + 3);
      if (it) addDrop('gear', it, e.x, e.y + 8);
    }
    for (let i = 0; i < 2; i++) {
      addDrop('coin', 50 + ((Math.random() * 40) | 0), e.x + (i ? 20 : -20), e.y + 4);
    }
    shakeX += 8; shakeY += 8;
  }
  // 心法兑现放在最后：上面几个分支都会写 bossKills，早一步查会读到旧值
  checkMantraUnlocks();
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
  const tier = e.boss || e.type === 'treant' ? 2 : (e.elite ? 1 : 0);
  const ilvl = Math.max(1, player.level + (tier === 2 ? 2 : tier === 1 ? 1 : 0) + ((Math.random() * 2) | 0));
  const coinN = tier === 2 ? 4 : e.elite ? 2 : 1;
  for (let i = 0; i < coinN; i++) {
    addDrop('coin', 3 + ((Math.random() * 7) | 0) + (e.elite ? 5 : 0) + (tier === 2 ? 34 : 0));
  }
  if (tier === 2 || Math.random() < (e.elite ? 0.85 : 0.22)) {
    addDrop('potion', { kind: 'potion', name: '回春丹', heal: 40, r: 0 });
  }
  // 拾遗（辅心法）：只加"装备"的掉落概率，药与银两不受影响 ——
  // 玩家要的是"多出装备"，不是"多出药"。
  const dropK = 1 + (stats().dropMul || 0) / 100;
  const chance = tier === 2 ? 1 : Math.min(1, (e.elite ? 0.85 : 0.17) * dropK);
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
// ============ 兵器招式（arts）============
// 跟"道行"里的气/舞/雷分开：那三个是境界带来的通用手段，换什么兵器都能放；
// 招式只看手里拿的兵器 —— 换刀就没有剑招。成长也分开：道行点是境界给的，
// 专精是拿这件兵器一刀一刀砍出来的。
//
// 运行时只有一个 execArt 分派器，按 art.fx 走六种原语（melee / proj / spin /
// orbit / blink / bolt）。加一招只要在 arts.js 写数据，这里一行都不用改 ——
// 跟首领的招式表（monsters.js 的 skills + execSkill）是同一个思路。
function profKills(fam) { return (player.prof && player.prof[fam]) || 0; }
function artCdOf(id) { return artCds[id] || 0; }
function artMaxOf(a) { return a.cd * (1 - Math.min(45, stats().cdr) / 100); }

// 增益类招式（剑心通明 / 狂怒 / 枪势 / 铁布衫 / 杀意 / 铁壁 / 灵护 / 淬毒）
// 统一从这里读。刻意不折进 stats()：_stats 是带缓存的常驻属性，限时增益塞进去
// 每帧都要 invalidate，还会让面板上的数字说谎（面板写的是装备+道行，不含临时 buff）。
// 这里按 key 求和，多个增益同时开着就叠加；同 id 重放只刷新时长，不叠第二条。
function artBuff(key) {
  if (!player.artBuffs || !player.artBuffs.length) return 0;
  let v = 0;
  for (const b of player.artBuffs) if (b.t > 0) v += (b.def[key] || 0);
  return v;
}
function artBuffActive() { return !!(player.artBuffs && player.artBuffs.length); }

// 地面区域 / 反伤走这一条，不经过 hitEnemy —— 每 0.2 秒走一次顿帧、连击、
// 火花和击退的话，站在火雨里的怪会让整块屏幕抖个不停（DoT 当初就是这么改的）。
function dealDot(e, dmg, col) {
  if (!e || e.dead || dmg <= 0) return;
  dmg = Math.max(1, Math.round(dmg));
  e.hp -= dmg;
  e.dotAcc = (e.dotAcc || 0) + dmg;
  e.dotShow = (e.dotShow || 0) - 0.016;
  if (e.dotShow <= 0 && e.dotAcc >= 1) {
    e.dotShow = 0.4;
    dmgNum(e.x + (Math.random() * 8 - 4), e.y - e.h * 0.9, '-' + Math.round(e.dotAcc), col || C.red3);
    e.dotAcc = 0;
  }
  if (e.hp <= 0 && !e.dead) killEnemy(e);
}

function addProf(fam, n) {
  if (!fam || !WEAPONS[fam] || !n) return;
  if (!player.prof) player.prof = {};
  const before = profLevel(player.prof[fam] || 0);
  player.prof[fam] = (player.prof[fam] || 0) + n;
  const after = profLevel(player.prof[fam]);
  if (after <= before) return;
  const W = WEAPONS[fam];
  msg(W.name + ' · 专精 ' + after + ' 级', C.gold3);
  AUDIO.play('levelup');
  // 升级时顺手把刚悟到的招式自动上阵 —— 否则玩家悟了招却不知道该去哪个页面装，
  // 这套系统在第一次接触时就断线了。
  const got = artsOfWeapon(fam).filter(a => a.prof > before && a.prof <= after);
  autoLoadout();   // 先用空位接住新招
  for (const a of got) {
    const put = player.loadout.indexOf(a.id) >= 0 || autoEquipNew(a);
    msg('悟得「' + a.name + '」' + (put ? ' · 已上阵' : ' · 招式页可换装'), C.gold3);
  }
  renderArts();
}

// 六格满了、刚悟到的招装不进去时：顶掉专精最低的那一格。
// 专精越高招式越强，自动往上换是玩家预期的方向；
// 但玩家手动排过装配（loadoutManual）就不再替他决定。
function autoEquipNew(a) {
  const L = player.loadout;
  if (!L || L.indexOf(a.id) >= 0) return true;
  if (player.loadoutManual) return false;
  let worst = -1, worstProf = Infinity;
  for (let i = 0; i < L.length; i++) {
    const o = artById(L[i]);
    if (!o) continue;
    if (o.prof < worstProf) { worstProf = o.prof; worst = i; }
  }
  if (worst >= 0 && worstProf < a.prof) { L[worst] = a.id; return true; }
  return false;
}

// 换兵器时：清掉不属于当前兵器的格子，再把已悟没上阵的补进空格。
// 同一件兵器内部的手动编排要保留 —— 每次换刀都重排一遍，玩家会以为界面坏了。
// loadoutManual：玩家自己动过装配格就不再自动补位 ——
// 否则"手动卸下一招"会在下一次专精升级时被悄悄塞回来。
function autoLoadout() {
  const fam = weaponFam();
  const L = player.loadout;
  if (!L || L.length !== ART_SLOTS) player.loadout = new Array(ART_SLOTS).fill(null);
  const A = player.loadout;
  for (let i = 0; i < ART_SLOTS; i++) {
    const a = A[i] ? artById(A[i]) : null;
    if (a && a.fam !== fam) { A[i] = null; player.loadoutManual = false; }
  }
  if (!player.loadoutManual) {
    const have = new Set(A.filter(Boolean));
    for (const a of unlockedArts(fam, player.prof)) {
      if (have.has(a.id)) continue;
      const i = A.indexOf(null);
      if (i < 0) break;
      A[i] = a.id; have.add(a.id);
    }
  }
}

// ---------- 状态 ----------
// 灼烧 / 流血 / 中毒是三种 DoT：来源与颜色不同，结算方式一样。
// 冻结与眩晕都"不动不出手"，区别是冻结期间受伤 +20%；减速只改速度。
function applyStatus(e, st, dealt) {
  if (!st || !e || e.dead) return;
  if (st.kind === 'bleed') { e.bleed = dealt * st.pct; e.bleedT = st.dur; }
  else if (st.kind === 'burn') { e.burn = dealt * st.pct; e.burnT = st.dur; }
  else if (st.kind === 'poison') {
    e.poison = dealt * st.pct; e.poisonT = st.dur;
    if (st.spread) e.poisonSpread = true;
  } else if (st.kind === 'freeze') { e.freezeT = Math.max(e.freezeT, st.dur); }
  else if (st.kind === 'stun') { e.stunT = Math.max(e.stunT, st.dur); }
  else if (st.kind === 'slow') { e.slowT = Math.max(e.slowT, st.dur); e.slowPct = Math.max(e.slowPct, st.pct); }
  else if (st.kind === 'break') {
    // 破甲改的是 def 本身，所以必须记下原值 —— 直接改不复位，
    // 挨一次碎骨锤这只怪就永远软了。
    e.breakT = Math.max(e.breakT, st.dur);
    e.def = e.def0 * (1 - (st.pct || 0.4));
  }
}
// DoT 结算：不经过 hitEnemy —— 那会触发顿帧、连击、火花、击退，
// 一只中了毒的怪会像被每秒砍一刀，屏幕抖个不停。
function dotTick(e, dt) {
  let dps = 0;
  if (e.bleedT > 0) { e.bleedT -= dt; dps += e.bleed; }
  if (e.burnT > 0) { e.burnT -= dt; dps += e.burn; }
  if (e.poisonT > 0) { e.poisonT -= dt; dps += e.poison; }
  if (dps <= 0) return;
  e.hp -= dps * dt;
  e.dotAcc = (e.dotAcc || 0) + dps * dt;
  e.dotShow = (e.dotShow || 0) - dt;
  if (e.dotShow <= 0 && e.dotAcc >= 1) {
    e.dotShow = 0.45;
    const col = e.burnT > 0 ? C.red3 : e.bleedT > 0 ? C.red2 : C.jade2;
    dmgNum(e.x + (Math.random() * 8 - 4), e.y - e.h * 0.9, '-' + Math.round(e.dotAcc), col);
    e.dotAcc = 0;
  }
  if (e.hp <= 0 && !e.dead) killEnemy(e);
}
function tickEnemyStatus(e, dt) {
  if (e.freezeT > 0) e.freezeT -= dt;
  if (e.stunT > 0) e.stunT -= dt;
  if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slowPct = 0; }
  if (e.breakT > 0) { e.breakT -= dt; if (e.breakT <= 0) e.def = e.def0; }
  if (e.launchT > 0) {
    const d = e.launchDur || 0.55;
    e.launchT -= dt;
    e.launchZ = Math.sin(Math.max(0, e.launchT) / d * Math.PI) * 20;
    if (e.launchT <= 0) {
      e.launchZ = 0;
      if (e.landDmg > 0) {
        const dmg = Math.round(e.landDmg); e.landDmg = 0;
        dmgNum(e.x, e.y - e.h * 0.8, '摔伤 ' + dmg, C.gold3, true);
        burst(e.x, e.y - 4, C.gold2, 10, 80);
        shakeX += 3; shakeY += 3;
        e.hp -= dmg;
        if (e.hp <= 0 && !e.dead) killEnemy(e);
      }
    }
  }
  dotTick(e, dt);
}
// 招式命中之后的附加效果（状态 / 击飞 / 吸血）
let lastArtHitSnd = 0;
function afterArtHit(e, a, dealt, ang) {
  // P11：第四条签名是声音。命中音逐招不同，但「乱舞」一息能命中十几次，
  // 用真实时间节流，免得叠成一串爆音。
  if (a.hitSnd) {
    const now = Date.now();
    if (now - lastArtHitSnd > 200) { AUDIO.play(a.hitSnd); lastArtHitSnd = now; }
  }
  if (a.status) applyStatus(e, a.status, dealt);
  if (a.launch) {
    e.launchDur = 0.55; e.launchT = 0.55;
    e.landDmg = (e.landDmg || 0) + dealt * 1.5;
    e.aggro = true; e.combatT = 4;
  }
  if (a.lifeOnHit) {
    const heal = Math.max(1, Math.round(maxHp() * a.lifeOnHit));
    player.hp = Math.min(maxHp(), player.hp + heal);
    dmgNum(player.x + (Math.random() * 8 - 4), player.y - 18, '+' + heal, C.jade3);
  }
}

// ---------- 特效 ----------
// 飞剑贴图只建一次：每次放招现画十二张 canvas 太浪费，而且武器图标生成不便宜。
let _orbTex = null;
function orbTexture() {
  if (!_orbTex) _orbTex = tex(weaponIcon('sword', 3, 0, C.gold3));
  return _orbTex;
}
// 招式刀光复用 slashGhosts 这条通道（普攻刀光也在用）：
// 它已经在 drawOverlay 里按世界坐标画、并且自己淡出，直接 push 就完事。
// 千万别在这里直接调 drawRingFx(octx, ...) —— update 阶段画的东西会被
// drawOverlay 开头的 clearRect 擦掉，而且 ctx 也不对。
//
// P10：从 3 形扩到 11 形，并按招式自己的 color 上色。
// 形状由 artShape() 决定 —— 那个函数放在 arts.js 里，自检查重用的是同一份推导。
// ghost 上能带的东西：
//   ring / thrust / a0+a1+R  三种旧形
//   dot   一个爆点（半径 dot）
//   line  { ang, len, w } 一道有方向的刃光
//   grow  [r0, r1] 环从 r0 长到 r1（冲击波）
//   delay 秒数：先等这么久再开始淡出（依次裂开用）
function artSwingFx(a, base, reach, arc, ox, oy) {
  const W = WEAPONS[a.fam];
  const col = artColor(a, W.trail);
  const from = slashGhosts.length;   // 工作台覆盖层要对这一招新加的 ghost 统一后处理
  // 位移招把起点传进来：刀光要留在走过的路上，不是落点前方
  const x = ox === undefined ? player.x : ox;
  const y = oy === undefined ? player.y - 8 : oy;
  const shape = artShape(a);
  const push = (g) => { slashGhosts.push(Object.assign({ x, y, colors: col }, g)); };

  if (shape === 'point') {
    // 落点：一个爆点 + 四道放射碎屑。打的是一个点，不是一片。
    const px = x + Math.cos(base) * reach * 0.95;
    const py = y + Math.sin(base) * reach * 0.95;
    slashGhosts.push({ x: px, y: py, dot: 7, colors: col, t: 0.20, max: 0.20 });
    slashGhosts.push({ x: px, y: py, ring: true, R: reach * 0.45, colors: col, t: 0.22, max: 0.22 });
    for (let i = 0; i < 4; i++) {
      slashGhosts.push({
        x: px, y: py, line: { ang: base + (i - 1.5) * 0.44, len: 11 + (i % 2) * 5, w: 1.3 },
        colors: col, t: 0.18, max: 0.18,
      });
    }
    // 过顶下砸的"举起"那一拍：头顶到落点的一道纵向刃光
    slashGhosts.push({ x, y: y - 30, line: { ang: Math.PI / 2, len: 30, w: 2.0 }, colors: col, t: 0.22, max: 0.22 });
    for (let i = 0; i < 6; i++) burst(px, py, col[0], 2, 70);

  } else if (shape === 'overheadArc') {
    // 从头顶劈到身前：一条纵向刃光 + 一道横向余韵
    slashGhosts.push({ x, y: y - 30, line: { ang: Math.PI / 2, len: 30, w: 2.2 }, colors: col, t: 0.26, max: 0.26 });
    push({ thrust: base, len: reach * 0.95, t: 0.24, max: 0.24 });

  } else if (shape === 'shockwave') {
    // 扩散环本体由 waves 那条通道按真实半径画，这里只给中心裂纹与放射尘
    const R = a.radius || 84;
    push({ dot: 9, t: 0.24, max: 0.24 });
    for (let i = 0; i < 10; i++) {
      const ang = i / 10 * Math.PI * 2 + 0.31;
      push({ line: { ang, len: 14 + (i % 3) * 7, w: 1.2 }, t: 0.26, max: 0.26 });
    }
    for (let i = 0; i < 8; i++) burst(x, y, col[1], 2, R * 0.9);

  } else if (shape === 'crack') {
    // 地面多段线：一段一段亮起来，越远越淡
    const z = a.zone || {};
    const n = z.count || 4;
    const step = (z.radius || 30) * 0.8;
    for (let i = 0; i < n; i++) {
      const px = x + Math.cos(base) * step * (i + 1);
      const py = y + Math.sin(base) * step * (i + 1);
      const d = i * (z.stagger || 0);
      const life = 0.30 - i * 0.03;
      slashGhosts.push({ x: px, y: py, dot: 4, colors: col, t: life, max: life, delay: d });
      slashGhosts.push({
        x: px, y: py, line: { ang: base + (i % 2 ? 0.55 : -0.55), len: step * 0.8, w: 1.6 },
        colors: col, t: life, max: life, delay: d,
      });
    }

  } else if (shape === 'cleave') {
    // 长条：一条纵向巨刃光 + 沿路的地面长缝
    const len = a.len || 132, wid = a.width || 58;
    push({ line: { ang: base, len, w: wid / 11 }, t: 0.34, max: 0.34 });
    push({ thrust: base, len: len * 0.98, t: 0.30, max: 0.30 });
    for (let i = 1; i <= 4; i++) {
      push({
        x: x + Math.cos(base) * len * i / 4, y: y + Math.sin(base) * len * i / 4,
        line: { ang: base + Math.PI / 2, len: wid * 0.45, w: 1.5 }, t: 0.30, max: 0.30,
      });
    }

  } else if (shape === 'boomerang') {
    // 轨迹：一条外凸的弧线（锤本体在 boomerangs 里转着飞）
    const dist = a.dist || 200;
    for (let i = 1; i <= 5; i++) {
      const k = i / 5;
      push({
        x: x + Math.cos(base) * dist * k, y: y + Math.sin(base) * dist * k,
        dot: 3 - k, t: 0.24 - k * 0.03, max: 0.24 - k * 0.03,
      });
    }

  } else if (shape === 'sideArc') {
    // 水平粗弧 + 侧向尘：从身体的另一侧抡过来
    push({ a0: base - 1.55, a1: base + 0.30, R: reach * 1.02, t: 0.28, max: 0.28 });
    for (let i = 0; i < 5; i++) {
      push({ line: { ang: base - 1.45 + i * 0.38, len: reach * 0.8, w: 1.1 }, t: 0.20, max: 0.20 });
    }

  } else if (shape === 'chargeLine') {
    // 地面尘线：一条细长的擦痕 + 几粒扬尘。
    // 不用 thrust 锥 —— 锥形气浪读作"枪尖捅出去"，而冲锋是"人撞过去"。
    const dist = a.dist || (a.dash && a.dash.dist) || 84;
    push({ line: { ang: base, len: dist, w: 1.1 }, t: 0.30, max: 0.30 });
    for (let i = 1; i <= 5; i++) {
      push({
        x: x + Math.cos(base) * dist * i / 5, y: y + Math.sin(base) * dist * i / 5,
        dot: 3, t: 0.26, max: 0.26,
      });
    }

  } else if (shape === 'plant') {
    // 插地：脚下一小圈尘
    push({ ring: true, R: 16, t: 0.30, max: 0.30 });

  } else if (shape === 'fan') {
    // 扇面齐射：n 条放射短线，中间最长、两侧渐短
    const n = Math.min(a.count || 5, 12);
    for (let i = 0; i < n; i++) {
      const ang = base + (n === 1 ? 0 : (i / (n - 1) - 0.5) * (a.spread || 0.9));
      const k = 1 - Math.abs(i / Math.max(1, n - 1) - 0.5) * 0.9;
      push({ line: { ang, len: reach * 0.85 * k, w: 1.1 }, t: 0.26, max: 0.26 });
    }

  } else if (shape === 'cross') {
    // 两道交叉刃光 + 交点一个爆点（十字斩 / 血战八方 / 淬毒）
    push({ line: { ang: base - 0.62, len: reach, w: 1.7 }, t: 0.28, max: 0.28 });
    push({ line: { ang: base + 0.62, len: reach, w: 1.7 }, t: 0.28, max: 0.28 });
    push({ dot: 5, t: 0.24, max: 0.24 });

  } else if (shape === 'rain') {
    // 天降：若干道自上而下的短刃，按顺序点亮（剑雨 / 火雨 / 天雷引）
    const n = Math.min(a.count || (a.zone && a.zone.count) || 8, 10);
    for (let i = 0; i < n; i++) {
      const ang = i / n * Math.PI * 2;
      const dd = reach * (0.30 + (i % 3) * 0.26);
      slashGhosts.push({
        x: x + Math.cos(ang) * dd, y: y + Math.sin(ang) * dd - 16,
        line: { ang: Math.PI / 2, len: 18, w: 1.3 }, colors: col,
        t: 0.30, max: 0.30, delay: i * 0.035,
      });
    }

  } else if (shape === 'sigil') {
    // 法阵：两圈同心 + 六道放射。布场 / 增益类招式的「看得见的状态」
    push({ ring: true, R: Math.max(18, reach * 0.62), t: 0.42, max: 0.42 });
    push({ ring: true, R: Math.max(10, reach * 0.34), t: 0.36, max: 0.36 });
    for (let i = 0; i < 6; i++) {
      push({ line: { ang: base + i / 6 * Math.PI * 2, len: reach * 0.5, w: 1.0 }, t: 0.34, max: 0.34 });
    }

  } else if (shape === 'trail') {
    // 递进残影：多段 / 多发的招式，一段比一段远、一段比一段淡
    const n = Math.min(a.hits || a.times || a.count || 4, 6);
    for (let i = 0; i < n; i++) {
      const k = (i + 1) / n;
      push({
        x: x + Math.cos(base) * reach * 0.6 * k, y: y + Math.sin(base) * reach * 0.6 * k,
        line: { ang: base + (i % 2 ? 0.34 : -0.34), len: reach * 0.34, w: 1.2 },
        t: 0.28 - k * 0.08, max: 0.28 - k * 0.08,
      });
    }

  } else if (shape === 'spiral') {
    // 旋身：一圈 + 一道扫过大半圆的弧 + 四根辐条（旋风斩 / 舞棍 / 乱舞）
    push({ ring: true, R: reach * 0.72, t: 0.34, max: 0.34 });
    push({ a0: base - 1.2, a1: base + 2.6, R: reach * 0.92, t: 0.30, max: 0.30 });
    for (let i = 0; i < 4; i++) {
      push({ line: { ang: base + i * Math.PI / 2, len: reach * 0.58, w: 1.1 }, t: 0.24, max: 0.24 });
    }

  } else if (shape === 'hook') {
    // 回勾：一记直出 + 末端折回来的勾（回马枪 / 断筋 / 缠棍 / 割喉）
    push({ line: { ang: base, len: reach, w: 1.5 }, t: 0.30, max: 0.30 });
    push({ line: { ang: base + 1.95, len: reach * 0.42, w: 1.5 }, t: 0.28, max: 0.28 });
    push({ dot: 4, t: 0.24, max: 0.24 });

  } else if (shape === 'ring') {
    push({ ring: true, R: reach * 0.9, t: 0.34, max: 0.34 });
    for (let i = 0; i < 14; i++) {
      const ang = i / 14 * Math.PI * 2;
      burst(x + Math.cos(ang) * 18, y + Math.sin(ang) * 18, col[1], 2, 90);
    }

  } else if (shape === 'thrust') {
    push({ thrust: base, len: reach * 1.05, t: 0.24, max: 0.24 });

  } else {
    push({ a0: base - arc / 2, a1: base + arc / 2, R: reach * 0.85, t: 0.26, max: 0.26 });
  }

  // 工作台覆盖层：帧数时间轴换算成刀光延迟 / 寿命；自定义 PNG 序列帧
  // 追加一个图片 ghost。放在末尾统一后处理，19 个形状分支一个都不用改
  // （有些分支是直接 slashGhosts.push，没走上面的 push()）。
  const tm = artTiming(a);
  if (tm.delay || tm.life) {
    for (let i = from; i < slashGhosts.length; i++) {
      const g = slashGhosts[i];
      if (tm.delay) g.delay = (g.delay || 0) + tm.delay;
      if (tm.life) { g.t = tm.life; g.max = tm.life; }
    }
  }
  const fr = artFrames(a);
  if (fr) {
    const life = tm.life || 0.30;
    slashGhosts.push({
      x, y, frames: fr, colors: col, base, delay: tm.delay, t: life, max: life,
      scale: a.frameScale || 1, rotate: !!a.frameRotate,
    });
  }
}

// 弹体命中（或撞墙）后的溅射 —— 三珠连爆用。
// 走 hitEnemy 而不是 dealDot：溅射是"打击"，该有顿帧、连击和火花；
// dealDot 是给持续区域用的（低频伤害走顿帧会把屏幕抖个不停）。
function projSplash(p, skip) {
  const a = p.art;
  if (!a || !a.splash) return;
  burst(p.x, p.y, C.red3, 8, 70);
  for (const o of enemies) {
    if (o.dead || o === skip) continue;
    if (p.hitSet && p.hitSet.has(o)) continue;
    if (Math.hypot(o.x - p.x, o.y - o.h * 0.5 - p.y) > a.splash) continue;
    if (p.hitSet) p.hitSet.add(o);
    const ang = Math.atan2(o.y - o.h * 0.5 - p.y, o.x - p.x);
    const dealt = hitEnemy(o, {
      dmg: Math.max(1, Math.round(p.dmg * 0.4)), crit: false,
      pierceDef: a.pierceDef || 0,
    }, ang, 4);
    afterArtHit(o, a, dealt, ang);
  }
}

// ---------- 主分派 ----------
// P6 之后一共十种原语。每一支只读 arts.js 里的字段，不认招式 id ——
// 加一招仍然只要写数据。
// 角度约定：base 是面朝方向的弧度，aim 是这一招真正打出去的方向
// （回马枪这类反手招要转 180 度）。
function execArt(a) {
  const fam = a.fam;
  const W = WEAPONS[fam];
  const base = DIRA[player.dir];
  const aim = base + (a.back ? Math.PI : 0);
  const [fx, fy] = DIRV[player.dir];
  player.lastHitFam = fam;
  // 动作：招式自带 pose 就用它；没写的 56 招退回旧行为（武器定在朝向，一下都不动）。
  // 以前这里是写死的 a0:0 / a1:0 —— 64 招全是"人站着、武器不动"，
  // 比普攻（每兵器三段、各有 a0/a1/lunge）还单调。这是"用哪个招式都一样"的第一层原因。
  const ps = a.pose || null;
  const psw = ps
    ? { mode: ps.mode || 'swing', a0: ps.a0 || 0, a1: ps.a1 || 0, dur: ps.dur || 0.22, ease: ps.ease }
    : { mode: a.fx === 'proj' ? 'thrust' : 'swing', a0: 0, a1: 0, dur: 0.22 };
  player.swing = { fam, base: aim, cast: true, sw: psw, t: psw.dur, dur: psw.dur };
  // 收招后的保持（地裂：落地后前倾 0.4 息不动）—— 收招空档也是重量的一部分
  player.holdT = (ps && ps.mode !== 'plant' && ps.hold) ? ps.hold : 0;
  // P11：起手音改由招式自带（snd）；没写的退回 P10 的按原语分派
  AUDIO.play(a.snd || (a.fx === 'bolt' ? 'thunder' : a.fx === 'proj' ? 'qi' :
    a.fx === 'buff' ? 'levelup' :
    a.fx === 'dash' || a.fx === 'pull' || a.fx === 'charge' ? 'dash' :
    a.fx === 'boomerang' ? 'boomerang' :
    a.fx === 'cleave' ? 'windup' : 'slash'), fam);

  if (a.fx === 'melee') {
    const reach = (a.reach || 40) * (1 + artBuff('reachPct') / 100);
    const arc = a.arc || 1.6;
    const hits = a.hits || 1;
    artSwingFx(a, aim, reach, arc);
    // 候选只筛一次，多段判定都吃同一份名单 —— 免得同一只怪被算两遍位置
    const cand = [];
    for (const e of enemies) {
      if (e.dead) continue;
      const px = player.x, py = player.y - 8;
      const dx = e.x - px, dy = (e.y - e.h * 0.5) - py, d = Math.hypot(dx, dy);
      if (d > reach + e.h * 0.4) continue;
      const diff = Math.abs(((Math.atan2(dy, dx) - aim + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      // 半径给到 130 的环身技（开天辟地）不做角度筛；小范围扇面才筛
      if (arc < Math.PI * 1.9 && diff > arc / 2 && d > 15) continue;
      cand.push({ e, d, ang: Math.atan2(dy, dx) });
    }
    // 眩晕击：只砸最近的那一个 —— 横抡打的是太阳穴，不是扫一片
    if (a.nearestOnly && cand.length > 1) {
      cand.sort((p, q) => p.d - q.d);
      cand.length = 1;
    }
    const bb = a.backBonus || 1;   // 回身反打：反手一记格外狠
    const strike = (t, k) => {
      const ramp = a.ramp ? 1 + a.ramp * k : 1;
      const r = rollDamage(a.mul * ramp, {
        skill: true, critAdd: a.critAdd || 0,
        forceCrit: !!(a.critLast && k === hits - 1),
      });
      const cb = a.centerBonus && t.d < (a.centerR || 46) ? a.centerBonus : 1;
      const kb = (a.kb || 8) + (a.kbLast && k === hits - 1 ? a.kbLast : 0);
      const dealt = hitEnemy(t.e, {
        dmg: Math.round(r.dmg * cb * bb), crit: r.crit,
        pierceDef: a.pierceDef || 0,
      }, t.ang, kb);
      afterArtHit(t.e, a, dealt, t.ang);
    };
    if (a.randomTargets) {
      // 乱舞：每一段换一个目标，不把六段全堆在同一只怪身上
      for (let k = 0; k < hits && cand.length; k++) {
        strike(cand[(Math.random() * cand.length) | 0], k);
      }
    } else {
      for (const t of cand) for (let k = 0; k < hits; k++) strike(t, k);
    }
    if (a.centerBonus) { shakeX += 6; shakeY += 6; hitstop = Math.max(hitstop, 0.09); }

  } else if (a.fx === 'proj') {
    if (a.shape) artSwingFx(a, aim, a.reach || 44, a.arc || 1.6);
    const n = a.count || 1;
    const life = (a.life || 0.8) * (1 + artBuff('reachPct') / 100);
    for (let i = 0; i < n; i++) {
      // ring：360° 齐射（万箭穿心），否则是扇面
      const ang = a.ring ? base + i / n * Math.PI * 2
        : base + (n === 1 ? 0 : (i / (n - 1) - 0.5) * (a.spread || 0.4));
      const r = rollDamage(a.mul, { skill: true });
      const mesh = quad(a.kind === 'dart' ? DART_TEX : QI_TEX, a.size || 9, a.size || 9);
      mesh.material.color.set(W.trail[0]);
      if (a.kind !== 'dart') mesh.material.blending = THREE.AdditiveBlending;
      projectiles.push({
        x: player.x + Math.cos(ang) * 12, y: player.y - 8 + Math.sin(ang) * 12,
        vx: Math.cos(ang) * (a.speed || 260), vy: Math.sin(ang) * (a.speed || 260),
        t: life, friendly: true, dmg: r.dmg, crit: r.crit,
        pierce: (a.pierce || 1) + artBuff('pierce'),
        mesh, hitSet: new Set(),
        spin: a.kind === 'dart' ? 16 : 0,
        art: a,
      });
    }
    burst(player.x + fx * 12, player.y - 8 + fy * 12, W.trail[0], 6, 55);

  } else if (a.fx === 'boomerang') {
    // 回旋锤：锤脱手飞出去，走一条外凸弧线，再回到手上。
    // 这是锤唯一一招"武器离手" —— 它存在的意义是让玩家知道：锤也可以不砸，可以扔。
    const dist = a.dist || 200;
    const dur = a.flight || 0.66;
    const col = artColor(a, W.trail);
    artSwingFx(a, aim, dist, a.arc || 1.6);
    const mesh = quad(tex(weaponIcon('hammer', 3, 0, col[0])), 15, 15);
    boomerangs.push({
      art: a, ox: player.x, oy: player.y - 8, ang: aim,
      x: player.x, y: player.y - 8, dist, bulge: a.bulge || 26,
      p: 0, dur, col, mesh, hitSet: new Set(),
    });
    // 飞出去那半秒，手上是空的（不然锤一边在手里一边在天上）
    player.throwHide = dur + 0.08;
    AUDIO.play('boomerang');

  } else if (a.fx === 'shockwave') {
    // 震地：环形，但**有扩散速度** —— 波前到达才结算，远处的人晚半拍才飞。
    // 和「碎骨锤」的区别不是半径大小，是"一个点"对"一个正在扩大的环"。
    const R = (a.radius || 84) * (1 + artBuff('reachPct') / 100);
    artSwingFx(a, aim, R, 6.28);
    waves.push({
      art: a, x: player.x, y: player.y - 8, r: 6, max: R,
      speed: a.speed || 240, col: artColor(a, W.trail), hitSet: new Set(),
    });
    shakeX += 8; shakeY += 8;
    hitstop = Math.max(hitstop, 0.10);

  } else if (a.fx === 'charge') {
    // 冲锋锤：直线冲出去，**撞到第一个就停**。
    // 现有的 dash 全都穿过所有敌人 —— "会停"这件事才是"冲锋"有重量的原因。
    // 停的判据是"身体碰上"（12 + 目标体型），不是"进入伤害半径"：
    // 按伤害半径算的话，离着 30px 就停住了，人还没碰到对方。
    const dist = a.dist || 84;
    const col = artColor(a, W.trail);
    const ox = player.x, oy = player.y;
    const steps = 16;
    let hitOne = null, nx = ox, ny = oy;
    for (let i = 1; i <= steps; i++) {
      const sx = ox + Math.cos(aim) * dist * i / steps;
      const sy = oy + Math.sin(aim) * dist * i / steps;
      if (!canStand(sx, sy)) break;
      nx = sx; ny = sy;
      for (const e of enemies) {
        if (e.dead) continue;
        if (Math.hypot(sx - e.x, sy - (e.y - e.h * 0.5)) > 12 + e.h * 0.35) continue;
        hitOne = e; break;
      }
      if (hitOne) break;
    }
    artSwingFx(a, aim, dist, a.arc || 1.6);
    afterimage(ox, oy - 8, playerTex[player.dir][0], 16, 18);
    player.x = nx; player.y = ny;
    player.iframe = Math.max(player.iframe, a.iframe || 0.18);
    if (hitOne) {
      const r = rollDamage(a.mul, { skill: true });
      const da = Math.atan2(hitOne.y - player.y, hitOne.x - player.x);
      const dealt = hitEnemy(hitOne, {
        dmg: r.dmg, crit: r.crit, pierceDef: a.pierceDef || 0,
      }, da, a.kb || 16);
      afterArtHit(hitOne, a, dealt, da);
      shakeX += 5; shakeY += 5;
      hitstop = Math.max(hitstop, 0.07);
      burst(player.x + Math.cos(aim) * 10, player.y - 8 + Math.sin(aim) * 10, col[0], 12, 90);
    }
    AUDIO.play('dash');

  } else if (a.fx === 'cleave') {
    // 开天辟地：正前方一条长条，沿路径全中，中线更狠。
    // 以前它是 360° 圈身、半径 130 —— **开天辟地是一条线，不是一个圆。**
    const len = (a.len || 132) * (1 + artBuff('reachPct') / 100);
    const half = (a.width || 58) / 2;
    const ux = Math.cos(aim), uy = Math.sin(aim);
    const ox = player.x, oy = player.y - 8;
    artSwingFx(a, aim, len, a.arc || 1.6);
    for (const e of enemies) {
      if (e.dead) continue;
      const ex = e.x - ox, ey = (e.y - e.h * 0.5) - oy;
      const along = ex * ux + ey * uy;
      if (along < -6 || along > len) continue;
      const lat = Math.abs(-ex * uy + ey * ux);
      if (lat > half + e.h * 0.3) continue;
      const r = rollDamage(a.mul, { skill: true });
      const cb = (a.centerBonus && lat < half * 0.42) ? a.centerBonus : 1;
      const da = Math.atan2(ey, ex);
      const dealt = hitEnemy(e, {
        dmg: Math.round(r.dmg * cb), crit: r.crit, pierceDef: a.pierceDef || 0,
      }, da, a.kb || 12);
      afterArtHit(e, a, dealt, da);
    }
    shakeX += 12; shakeY += 12;
    hitstop = Math.max(hitstop, 0.14);
    AUDIO.play('quake');

  } else if (a.fx === 'spin') {
    if (a.shape) artSwingFx(a, aim, a.radius || 46, 6.28);
    player.artSpin = {
      a, t: a.dur, tick: 0,
      radius: (a.radius || 46) * (1 + artBuff('reachPct') / 100),
    };

  } else if (a.fx === 'orbit') {
    if (a.shape) artSwingFx(a, aim, a.radius || 34, 6.28);
    const n = a.count || 12;
    player.orbs = [];
    for (let i = 0; i < n; i++) {
      // 用兵器图标当飞剑贴图，而不是一颗光点 —— 十二个光点绕着人转，
      // 玩家读到的是"护体灵气"，读不出"万剑"。图标会跟着角度转，一眼就是剑。
      const mesh = quad(orbTexture(), 12, 12);
      mesh.material.blending = THREE.AdditiveBlending;
      scene.add(mesh);
      player.orbs.push({ i, mesh, cd: 0.15 + i * 0.04 });
    }
    player.orbT = a.dur;
    player.orbArt = a;
    player.orbAng = 0;

  } else if (a.fx === 'blink') {
    if (a.shape) artSwingFx(a, aim, a.dist || 52, 1.6);
    player.blinkQ = { a, n: a.times || 3, t: 0 };

  } else if (a.fx === 'bolt') {
    if (a.shape) artSwingFx(a, aim, a.range || 180, 1.6);
    const n = a.count || 5;
    const pool = enemies.filter(e => !e.dead &&
      Math.hypot(e.x - player.x, e.y - player.y) < (a.range || 200));
    for (let i = 0; i < n; i++) {
      // 雷链：每一跳弱两成，落点跟着不同的敌人走
      const decay = a.chain ? Math.pow(0.8, i) : 1;
      const r = rollDamage(a.mul * decay, { skill: true });
      let tx, ty;
      if (a.chain && pool.length) {
        const e = pool[i % pool.length];
        tx = e.x + (Math.random() * 16 - 8); ty = e.y - e.h * 0.4 + (Math.random() * 12 - 6);
      } else if (pool.length && i < pool.length) {
        // 前几道优先劈已经站在附近的，剩下的随机落 —— 全随机会让大招经常劈空地
        const e = pool[i];
        tx = e.x + (Math.random() * 20 - 10); ty = e.y - 6 + (Math.random() * 16 - 8);
      } else {
        const ang = Math.random() * Math.PI * 2, dd = 30 + Math.random() * (a.range || 200) * 0.7;
        tx = player.x + Math.cos(ang) * dd; ty = player.y + Math.sin(ang) * dd;
      }
      bolts.push({
        x: tx, y: ty, t: 0.2 + i * (a.fall || 0.1),
        dmg: r.dmg, r: a.radius || 30, done: false, art: a,
      });
    }

  } else if (a.fx === 'dash') {
    const d = a.dash || {};
    let ang = base;
    if (d.dir === 'back') ang = base + Math.PI;
    else if (d.dir === 'side') ang = base + (dashSide > 0 ? Math.PI / 2 : -Math.PI / 2);
    else if (d.dir === 'target') {
      // 影袭：闪到最近的敌手背后
      let best = null, bd = 1e9;
      for (const e of enemies) {
        if (e.dead) continue;
        const dd = Math.hypot(e.x - player.x, e.y - player.y);
        if (dd < bd) { bd = dd; best = e; }
      }
      if (best) ang = Math.atan2(best.y - player.y, best.x - player.x);
    }
    dashSide = -dashSide;   // 侧身左右交替，连放两次不会每次都往同一边
    const ox = player.x, oy = player.y;
    const dist = d.dist || 60;
    // 分小步挪：一步跨过去会穿墙，也会把走廊判定算错
    let nx = ox, ny = oy;
    for (let i = 1; i <= 8; i++) {
      const sx = ox + Math.cos(ang) * dist * i / 8;
      const sy = oy + Math.sin(ang) * dist * i / 8;
      if (!canStand(sx, sy)) break;
      nx = sx; ny = sy;
    }
    afterimage(ox, oy - 8, playerTex[player.dir][0], 16, 18);
    player.x = nx; player.y = ny;
    if (d.iframe) player.iframe = Math.max(player.iframe, d.iframe);
    if (d.shieldPct) player.shield = Math.max(player.shield, Math.round(maxHp() * d.shieldPct / 100));
    if (d.forceCrit) player.forceCrit = 1;      // 疾风步：掠步之后下一击必取要害
    if (d.nextDmg) player.nextDmg = d.nextDmg;
    if (d.stealth) {
      // 缩地：追兵一时失了你的踪迹
      for (const e of enemies) {
        if (e.dead || e.boss || e.elite) continue;
        if (Math.hypot(e.x - player.x, e.y - player.y) > 160) continue;
        e.aggro = false; e.combatT = 0; e.hunt = null;
      }
    }
    // 走廊判定用"意图终点"而不是实际落点：贴墙放招时人挪不动，
    // 但招式还是该在身前留下一道 —— 否则玩家只看到人没动、也没伤害。
    const tx = ox + Math.cos(ang) * dist, ty = oy + Math.sin(ang) * dist;
    const vx = tx - ox, vy = ty - oy;
    const len2 = vx * vx + vy * vy || 1;
    const R = a.radius || 26;
    for (const e of enemies) {
      if (e.dead) continue;
      const ex = e.x, ey = e.y - e.h * 0.4;
      let t = ((ex - ox) * vx + (ey - oy) * vy) / len2;
      t = Math.max(0, Math.min(1, t));
      const cx = ox + vx * t, cy = oy + vy * t;
      if (Math.hypot(ex - cx, ey - cy) > R + e.h * 0.3) continue;
      const r = rollDamage(a.mul, { skill: true });
      const da = Math.atan2(ey - cy, ex - cx);
      const dealt = hitEnemy(e, { dmg: r.dmg, crit: r.crit, pierceDef: a.pierceDef || 0 }, da, a.kb || 6);
      afterArtHit(e, a, dealt, da);
    }
    // P11：位移招把起点交给 artSwingFx，刀光留在走过的路上
    if (a.shape) artSwingFx(a, ang, dist, 1.6, (ox + tx) / 2, (oy + ty) / 2 - 8);
    else slashGhosts.push({
      x: (ox + tx) / 2, y: (oy + ty) / 2 - 8, thrust: ang,
      len: dist * 0.95, colors: W.trail, t: 0.3, max: 0.3,
    });
    burst(player.x, player.y - 8, W.trail[0], 8, 70);
    AUDIO.play('dash');

  } else if (a.fx === 'buff') {
    // 增益类招式：给自己挂一段限时状态。同 id 重放只刷新时长，不叠第二条
    // —— 叠两条的话"狂怒"会变成唯一答案。
    const def = a.buff || {};
    const dur = def.dur || 6;
    if (!player.artBuffs) player.artBuffs = [];
    const prev = player.artBuffs.find(b => b.id === a.id);
    if (prev) { prev.t = dur; prev.def = def; }
    else player.artBuffs.push({ id: a.id, name: a.name, t: dur, def });
    if (def.shieldPct) {
      player.shield = Math.max(player.shield, Math.round(maxHp() * def.shieldPct / 100));
    }
    // 铁壁：锤插在地上，人半蹲在它后面 —— 增益类招式以前完全没有表现，
    // 玩家看不出自己处于什么状态。这一招是这条规矩的样板。
    if (a.pose && a.pose.mode === 'plant') player.plantT = dur;
    if (a.shape) {
      artSwingFx(a, aim, 20, 1.6);
    } else {
      slashGhosts.push({
        x: player.x, y: player.y - 8, ring: true, R: 26,
        colors: W.trail, t: 0.42, max: 0.42,
      });
    }
    burst(player.x, player.y - 8, C.gold3, 14, 70);
    msg(a.name + ' · ' + dur + ' 息', C.gold3);

  } else if (a.fx === 'zone') {
    // 地面区域：火雨 / 地裂 / 定军 / 千刃 / 铁蒺藜
    const z = a.zone || {};
    // 招式自带形状的才画自己的刀光；没写的 56 招保持 P6 的样子，不擅自加东西
    if (a.shape) artSwingFx(a, aim, z.radius || 30, 1.6);
    const n = z.count || 1;
    const kind = a.status && a.status.kind;
    const col = a.color ? a.color[0]
      : kind === 'burn' || kind === 'poison' ? C.red3 : kind === 'stun' ? C.gold3 : C.jade3;
    // 一片区域的伤害要摊到每个分片上，否则"四道地裂"就是四倍伤害
    const per = z.once ? 1 : (n > 1 ? n : 1);
    for (let i = 0; i < n; i++) {
      let x = player.x, y = player.y;
      if (z.shape === 'line') {
        const step = (z.radius || 30) * 0.8;
        x += Math.cos(base) * step * (i + 1);
        y += Math.sin(base) * step * (i + 1);
      } else if (n > 1) {
        const a2 = i / n * Math.PI * 2 + Math.random() * 0.5;
        const rr = 10 + Math.random() * 16;
        x += Math.cos(a2) * rr; y += Math.sin(a2) * rr;
      } else {
        x += fx * 18; y += fy * 18;
      }
      zones.push({
        x, y, r: z.radius || 40,
        t: z.dur || 3, max: z.dur || 3,
        tick: z.tick || 0.4, tickGap: z.tick || 0.4,
        art: a, once: !!z.once, color: col,
        // 依次裂开：第 i 段晚 i×stagger 息才出现。
        // 四段一起刷出来，玩家看到的只是一块红斑，读不出"裂缝往前裂"。
        delay: i * (z.stagger || 0),
        mul: (a.mul || 1) / per,
      });
    }
    burst(player.x, player.y - 8, col, 10, 60);

  } else if (a.fx === 'pull') {
    // 缠棍：把最近的一个敌手拽到面前
    let best = null, bd = a.radius || 80;
    for (const e of enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - player.x, e.y - player.y);
      if (d < bd) { bd = d; best = e; }
    }
    if (a.shape) artSwingFx(a, aim, a.radius || 80, 6.28);
    else slashGhosts.push({
      x: player.x, y: player.y - 8, ring: true, R: (a.radius || 80) * 0.9,
      colors: W.trail, t: 0.32, max: 0.32,
    });
    if (best) {
      const tx = player.x + fx * 26, ty = player.y + fy * 26;
      if (canStand(tx, ty)) { best.x = tx; best.y = ty; }
      else {
        // 落点站不住（墙 / 地形）：把人拽到半路，别硬塞进石头里
        best.x = player.x + (best.x - player.x) * 0.35;
        best.y = player.y + (best.y - player.y) * 0.35;
      }
      best.aggro = true; best.combatT = 4;
      const r = rollDamage(a.mul, { skill: true });
      const da = Math.atan2(best.y - player.y, best.x - player.x);
      const dealt = hitEnemy(best, { dmg: r.dmg, crit: r.crit, pierceDef: a.pierceDef || 0 }, da, a.kb || 4);
      afterArtHit(best, a, dealt, da);
      burst(best.x, best.y - 6, W.trail[0], 10, 75);
    }
    AUDIO.play('dash');
  }
  return true;
}

function castArt(slot) {
  if (state !== 'play') return false;
  const id = player.loadout[slot];
  if (!id) { msg('此位未装配招式（T 开道行 · 招式页）', C.paper1); return false; }
  const a = artById(id);
  if (!a) return false;
  if (a.fam !== weaponFam()) { msg('此招须持' + WEAPONS[a.fam].name, C.paper1); return false; }
  if (!artUnlocked(profKills(a.fam), a)) { msg('专精不足，尚未悟得「' + a.name + '」', C.paper1); return false; }
  if (artCdOf(id) > 0) return false;
  if (player.qi < a.cost) { msg('真气不足', C.jade3); return false; }
  player.qi -= a.cost;
  artCds[id] = artMaxOf(a);
  mantraOnCast();   // 藏锋：招式也算"出招"
  execArt(a);
  return true;
}

// 招式的持续段（旋转 / 飞剑环绕 / 连闪）每帧走这里。
// 冷却统一在这里扣 —— 放在各处 cast 里，漏掉一处就会出现"某招永不冷却"。
function clearArts() {
  if (player.orbs) for (const o of player.orbs) scene.remove(o.mesh);
  player.orbs = null; player.orbArt = null; player.orbT = 0;
  player.artSpin = null; player.blinkQ = null;
  // 抛出去还没回来的锤 / 还在扩的冲击波：mesh 得一起收，否则换局之后
  // 天上会留着一把没人管的锤，而且它还会继续打人。
  for (const b of boomerangs) scene.remove(b.mesh);
  boomerangs.length = 0; waves.length = 0;
  player.throwHide = 0; player.plantT = 0; player.holdT = 0;
  // 地面区域、增益、一次性标记都是"这一趟"的东西：跨局残留会让玩家一进游戏
  // 就白捡一层增益，或者脚底下踩着上一局点下的火雨。
  zones.length = 0;
  player.artBuffs = []; player.forceCrit = 0; player.nextDmg = 0;
  for (const k in artCds) delete artCds[k];
}
// ---- 抛出去的兵器（回旋锤）----
// 去程 → 顶点 → 回程，回到手上才结束。同一个目标整招只吃一次，
// 但"去程打一个人、回程打另一个人"是允许的 —— 这才叫扔出去。
function updateBoomerangs(dt) {
  for (let i = boomerangs.length - 1; i >= 0; i--) {
    const b = boomerangs[i];
    b.p += dt / b.dur;
    if (b.p >= 1) {
      // 回手：手上接住的那一下
      burst(b.ox, b.oy, b.col[0], 6, 60);
      AUDIO.play('boomerang', 'back');
      scene.remove(b.mesh);
      boomerangs.splice(i, 1);
      continue;
    }
    // 外凸弧线：前一半出去，后一半回来；顶点在 0.5，侧向鼓包由 bulge 给
    const out = b.p < 0.5 ? b.p * 2 : (1 - b.p) * 2;
    const bulge = Math.sin(out * Math.PI) * b.bulge;
    const px = b.ox + Math.cos(b.ang) * b.dist * out - Math.sin(b.ang) * bulge;
    const py = b.oy + Math.sin(b.ang) * b.dist * out + Math.cos(b.ang) * bulge;
    b.x = px; b.y = py;
    b.mesh.position.set(px, py, 0);
    b.mesh.renderOrder = 1500 + Math.round(py);
    b.mesh.rotation.z += dt * 22;
    for (const e of enemies) {
      if (e.dead || b.hitSet.has(e)) continue;
      if (Math.hypot(px - e.x, py - (e.y - e.h * 0.5)) > 13 + e.h * 0.4) continue;
      b.hitSet.add(e);
      const r = rollDamage(b.art.mul, { skill: true });
      const da = Math.atan2(py - (e.y - e.h * 0.5), px - e.x);
      const dealt = hitEnemy(e, {
        dmg: r.dmg, crit: r.crit, pierceDef: b.art.pierceDef || 0,
      }, da, b.art.kb || 10);
      afterArtHit(e, b.art, dealt, da);
      burst(px, py, b.col[0], 8, 70);
    }
    if (Math.random() < dt * 26) burst(px, py, b.col[1], 1, 18);
    // 尘迹：每 40ms 在锤的位置留一个淡点。飞出去再回来这件事，
    // 光看锤本身是读不出轨迹的 —— 一条弧形的尾巴才让"回旋"成立。
    b.trailT = (b.trailT || 0) - dt;
    if (b.trailT <= 0) {
      b.trailT = 0.04;
      slashGhosts.push({ x: px, y: py, dot: 4, colors: b.col, t: 0.26, max: 0.26 });
    }
  }
}

// ---- 冲击波（震地）----
// 波前按 speed 往外走，走到谁身上才结算 —— 远处的人晚半拍才飞。
// 这一拍就是"震地"和"半径内立刻受伤"的全部区别。
function updateWaves(dt) {
  for (let i = waves.length - 1; i >= 0; i--) {
    const w = waves[i];
    w.r += w.speed * dt;
    for (const e of enemies) {
      if (e.dead || w.hitSet.has(e)) continue;
      const d = Math.hypot(e.x - w.x, (e.y - e.h * 0.5) - w.y);
      if (d > w.r + e.h * 0.3) continue;
      w.hitSet.add(e);
      const cb = (w.art.centerBonus && d < (w.art.centerR || 24)) ? w.art.centerBonus : 1;
      const r = rollDamage(w.art.mul * cb, { skill: true });
      const da = Math.atan2((e.y - e.h * 0.5) - w.y, e.x - w.x);
      const dealt = hitEnemy(e, {
        dmg: r.dmg, crit: r.crit, pierceDef: w.art.pierceDef || 0,
      }, da, w.art.kb || 12);
      afterArtHit(e, w.art, dealt, da);
      burst(e.x, e.y - 6, w.col[0], 7, 70);
    }
    if (w.r >= w.max) {
      burst(w.x, w.y, w.col[1], 10, 90);
      waves.splice(i, 1);
    }
  }
}

function updateArts(dt) {
  for (const k in artCds) if (artCds[k] > 0) artCds[k] -= dt;
  updateBoomerangs(dt);
  updateWaves(dt);

  // ---- 旋转（血战八方 / 舞棍）----
  const sp = player.artSpin;
  if (sp) {
    sp.t -= dt; sp.tick -= dt;
    if (sp.tick <= 0) {
      sp.tick = sp.a.tick || 0.25;
      const W = WEAPONS[sp.a.fam];
      slashGhosts.push({ x: player.x, y: player.y - 8, ring: true, R: sp.radius * 0.9, colors: W.trail, t: 0.26, max: 0.26 });
      for (const e of enemies) {
        if (e.dead) continue;
        const dx = e.x - player.x, dy = e.y - player.y, d = Math.hypot(dx, dy);
        if (d > sp.radius + e.h * 0.3) continue;
        const r = rollDamage(sp.a.mul, { skill: true });
        const ang = Math.atan2(dy, dx);
        const dealt = hitEnemy(e, { dmg: r.dmg, crit: r.crit, pierceDef: sp.a.pierceDef || 0 }, ang, sp.a.kb || 6);
        afterArtHit(e, sp.a, dealt, ang);
      }
      // 舞棍：把飞来的弹体反弹回去（敌方弹体 friendly=false）
      if (sp.a.reflect) {
        for (const p of projectiles) {
          if (p.friendly) continue;
          if (Math.hypot(p.x - player.x, p.y - (player.y - 8)) > sp.radius + 10) continue;
          p.friendly = true; p.hitSet = new Set();
          p.vx *= -1.6; p.vy *= -1.6; p.dmg = Math.round(p.dmg * 1.5);
          p.t = Math.max(p.t, 0.5);
          burst(p.x, p.y, C.gold3, 8, 80);
          AUDIO.play('shield');
        }
      }
    }
    if (sp.t <= 0) player.artSpin = null;
  }

  // ---- 飞剑环绕（万剑归宗）----
  if (player.orbs) {
    const a = player.orbArt;
    player.orbT -= dt; player.orbAng += dt * 2.2;
    if (player.orbT <= 0) {
      for (const o of player.orbs) scene.remove(o.mesh);
      player.orbs = null; player.orbArt = null;
    } else {
      const n = player.orbs.length;
      for (const o of player.orbs) {
        const ang = player.orbAng + o.i / n * Math.PI * 2;
        const ox = player.x + Math.cos(ang) * (a.radius || 34);
        const oy = player.y - 8 + Math.sin(ang) * (a.radius || 34) * 0.75;
        o.mesh.position.set(ox, oy, 0);
        o.mesh.renderOrder = 1500 + Math.round(oy);
        o.mesh.rotation.z = ang + Math.PI / 2;
        if (o.cd > 0) { o.cd -= dt; continue; }
        for (const e of enemies) {
          if (e.dead) continue;
          if (Math.hypot(ox - e.x, oy - (e.y - e.h / 2)) > e.h * 0.55 + 8) continue;
          const r = rollDamage(a.mul, { skill: true });
          const dmgAng = Math.atan2(e.y - e.h / 2 - oy, e.x - ox);
          const dealt = hitEnemy(e, { dmg: r.dmg, crit: r.crit }, dmgAng, 3);
          afterArtHit(e, a, dealt, dmgAng);
          o.cd = 0.42;
          break;
        }
      }
    }
  }

  // ---- 连闪（疾影）----
  const bq = player.blinkQ;
  if (bq) {
    bq.t -= dt;
    if (bq.t <= 0) {
      bq.t = 0.09;
      bq.n--;
      const a = bq.a;
      // 有敌人就朝最近的闪，没有就朝面朝方向 —— 原地乱闪会让人以为技能没生效
      let ang = DIRA[player.dir];
      let best = null, bd = 1e9;
      for (const e of enemies) {
        if (e.dead) continue;
        const d = Math.hypot(e.x - player.x, e.y - player.y);
        if (d < 150 && d < bd) { bd = d; best = e; }
      }
      if (best) ang = Math.atan2(best.y - player.y, best.x - player.x);
      const ox = player.x, oy = player.y;
      const nx = ox + Math.cos(ang) * a.dist, ny = oy + Math.sin(ang) * a.dist;
      if (canStand(nx, ny)) { player.x = nx; player.y = ny; }
      afterimage(ox, oy - 8, playerTex[player.dir][0], 16, 18);
      player.iframe = Math.max(player.iframe, 0.12);
      // 穿过的敌人受伤：判定的是"这一段的走廊"，不是落点 —— 只看落点的话
      // 贴身闪过去一次都打不到人。
      for (const e of enemies) {
        if (e.dead) continue;
        const mx = (ox + player.x) / 2, my = (oy + player.y) / 2;
        if (Math.hypot(e.x - mx, e.y - e.h / 2 - (my - 8)) > a.radius + e.h * 0.4) continue;
        const r = rollDamage(a.mul, { skill: true });
        const da = Math.atan2(e.y - e.h / 2 - (my - 8), e.x - mx);
        const dealt = hitEnemy(e, { dmg: r.dmg, crit: r.crit }, da, 5);
        afterArtHit(e, a, dealt, da);
      }
      burst(player.x, player.y - 8, C.pur3, 6, 60);
      AUDIO.play('dash');
      if (bq.n <= 0) player.blinkQ = null;
    }
  }

  // ---- 增益计时（剑心通明 / 狂怒 / 铁布衫 / 灵护 / 淬毒 …）----
  if (player.artBuffs && player.artBuffs.length) {
    for (let i = player.artBuffs.length - 1; i >= 0; i--) {
      const b = player.artBuffs[i];
      b.t -= dt;
      if (b.t <= 0) {
        player.artBuffs.splice(i, 1);
        msg(b.name + ' · 散', C.paper2);
      }
    }
  }

  // ---- 玩家留下的地面区域（火雨 / 地裂 / 定军 / 千刃 / 铁蒺藜）----
  for (let i = zones.length - 1; i >= 0; i--) {
    const z = zones[i];
    // 依次裂开的段：还没轮到它，就还没长出来（也不能开始计时）
    if (z.delay > 0) { z.delay -= dt; continue; }
    z.t -= dt;
    if (z.once) {
      // 陷阱：敌人踩进来才响，响过就没了 —— 所以它不是"持续区域"
      let hit = false;
      for (const e of enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - z.x, e.y - z.y) > z.r + e.h * 0.25) continue;
        const r = rollDamage(z.art.mul, { skill: true });
        const dmg = Math.max(1, Math.round(r.dmg));
        const ang = Math.atan2(e.y - z.y, e.x - z.x);
        const dealt = hitEnemy(e, {
          dmg, crit: r.crit, pierceDef: z.art.pierceDef || 0,
        }, ang, z.art.kb || 3);
        afterArtHit(e, z.art, dealt, ang);
        burst(z.x, z.y, z.color, 10, 80);
        shakeX += 2; shakeY += 2;
        hit = true;
      }
      if (hit || z.t <= 0) zones.splice(i, 1);
      continue;
    }
    z.tick -= dt;
    if (z.tick <= 0) {
      z.tick = z.tickGap;
      for (const e of enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - z.x, e.y - z.y) > z.r + e.h * 0.25) continue;
        const r = rollDamage(z.mul, { skill: true });
        const dmg = Math.max(1, Math.round(r.dmg));
        // 区域伤害走 dealDot，不走 hitEnemy —— 每 0.4 秒一次顿帧的话，
        // 站在火雨里的怪会让整块屏幕抖个不停（DoT 当初就是这么改的）。
        dealDot(e, dmg, z.color);
        if (z.art.status) applyStatus(e, z.art.status, dmg);
      }
      // 一点呼吸感：每 tick 在区域边缘撒两粒火星，别让整片色块是死的
      burst(z.x + (Math.random() * 2 - 1) * z.r * 0.6,
        z.y + (Math.random() * 2 - 1) * z.r * 0.6, z.color, 2, 25);
    }
    if (z.t <= 0) zones.splice(i, 1);
  }
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
    // 贪狼（辅心法）：银两加成。放在拾取这一处，不去改每一种掉落源 ——
    // 掉落源有七八处，改一处漏一处，玩家会觉得"这心法时灵时不灵"。
    const g = Math.round(d.item * (1 + (stats().goldMul || 0) / 100));
    player.gold += g;
    dmgNum(player.x, player.y - 16, '+' + g + '银两', C.gold3);
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
  // 换了兵器就换一套招式：剑招在刀上是放不出来的，留着格子只会让人点一下骂一句
  if (slot === 'weapon') autoLoadout();
  renderInv(); renderForge(); renderArts();
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
// ============ 心法面板 ============
// 行囊面板加第二页，而不是另开一个面板 —— 同一件事（"我这套东西怎么配"）
// 分成两个入口，玩家会忘记另一个的存在。
let invPageOn = 'bag';
const INV_PAGES = ['bag', 'mantra', 'story'];
function showInvPage(page) {
  invPageOn = INV_PAGES.indexOf(page) >= 0 ? page : 'bag';
  for (const p of INV_PAGES) {
    const el = document.getElementById(p === 'bag' ? 'invPage' : p + 'Page');
    if (el) el.classList.toggle('hidden', invPageOn !== p);
  }
  const tabs = document.querySelectorAll('#inv .tabs button');
  for (const b of tabs) b.classList.toggle('on', b.dataset.invpage === invPageOn);
  if (invPageOn === 'mantra') renderMantras();
  if (invPageOn === 'story') renderStoryLog();
}

// ============ 旧事（剧情日志） ============
// 两个作用：一是让玩家回看读过的字，二是让"还没发生的事"有一个形状 ——
// 未解锁的节点只显示条件、不显示内容，玩家知道还有东西在前面，但不会被剧透。
function renderStoryLog() {
  const box = document.getElementById('storyPage');
  if (!box) return;
  const read = player.readLog || {};
  const rows = [];

  // 线索：四列网格，得到一条亮一条。用网格不用横排 —— 11 条横排每条只剩
  // 不到 60px，「木牌 · 第一道纹」会被压成竖排。
  const cl = player.clues || {};
  const nClue = CLUE_IDS.filter(id => cl[id]).length;
  rows.push('<div class="sSec">线 索 ' + nClue + '/' + CLUE_IDS.length + '</div>');
  rows.push('<div class="sClue">' + CLUE_IDS.map(id => {
    const on = !!cl[id];
    return '<div class="' + (on ? 'on' : '') + '"><b>' +
      (on ? CLUES[id].name : '？') + '</b><span>' +
      (on ? '已知' : '未得') + '</span></div>';
  }).join('') + '</div>');
  for (const id of CLUE_IDS) {
    if (cl[id]) rows.push('<div class="sItem"><div class="q">' + CLUES[id].text + '</div></div>');
  }

  // 剧情：按幕分组。已读显示标题，未读显示条件
  for (const g of storyByAct()) {
    const got = g.ids.filter(id => read[id]).length;
    rows.push('<div class="sSec">' + g.act.name + '　' + got + '/' + g.ids.length + '</div>');
    for (const id of g.ids) {
      const s = STORY[id];
      if (read[id]) {
        // 摘要取最长的那一句，而不是第一句 —— 序章第一句是「……」，
        // 拿它当摘要等于每条都写着省略号。
        let best = s.lines[0].text;
        for (const l of s.lines) if (l.text.length > best.length) best = l.text;
        // 做过分岔的节点要留一个"你当时选了哪条"。结局不是唯一的，
        // 旧事页如果只显示正文，玩家第二次看会觉得这段没写完。
        const picked = (player.choices || {})[id];
        const ch = (s.onEnd || {}).choice;
        const opt = picked && ch ? (ch.options || []).find(o => o.id === picked) : null;
        rows.push('<div class="sItem"><div class="t">' + s.title + '</div>' +
          '<div class="q">' + best + '</div>' +
          (opt ? '<div class="pick">你选了「' + opt.label + '」</div>' : '') + '</div>');
      } else {
        rows.push('<div class="sItem locked"><div class="t">？？</div>' +
          '<div class="lock">' + storyHint(s) + '</div></div>');
      }
    }
  }

  // 旧物：碑文一类，可反复读
  const envGot = ENV_IDS.filter(id => read[id]);
  rows.push('<div class="sSec">旧 物 ' + envGot.length + '/' + ENV_IDS.length + '</div>');
  if (!envGot.length) {
    rows.push('<div class="sItem locked"><div class="lock">走近碑石，按 E 读。</div></div>');
  } else {
    for (const id of envGot) {
      rows.push('<div class="sItem"><div class="t">' + ENV_TEXTS[id].name + '</div>' +
        '<div class="q">' + ENV_TEXTS[id].text + '</div></div>');
    }
  }
  box.innerHTML = rows.join('');
}

function mSlotHtml(slot, id, label) {
  const a = id ? MANTRAS[id] : null;
  const cls = 'ms ' + (slot === 'main' ? 'main ' : '') + (a ? '' : 'empty');
  return '<div class="' + cls + '" data-mslot="' + slot + '" data-mid="' + (id || '') + '">' +
    '<div class="k">' + label + '</div>' +
    '<div class="n">' + (a ? a.name : '空') + '</div>' +
    '<div class="lv">' + (a ? '注解 ' + lvOf(player.mantrasOwned, id) : '—') + '</div></div>';
}

function mCardHtml(id, learned) {
  const a = MANTRAS[id];
  const on = a.kind === 'main'
    ? player.mantras.main === id
    : (player.mantras.sub || []).indexOf(id) >= 0;
  const lv = lvOf(player.mantrasOwned, id);
  let html = '<div class="mCard' + (on ? ' on' : '') + (learned ? '' : ' off') + '"><div class="l">';
  html += '<div class="t">' + a.name +
    '<em class="' + (a.kind === 'main' ? 'm' : '') + '">' +
    (a.kind === 'main' ? '主 · ' + a.school : '辅') + '</em>' +
    (learned && lv > 1 ? '<em>注解 ' + lv + '</em>' : '') + '</div>';
  html += '<div class="d">' + a.desc + '</div>';
  // 代价必须写在卡面上，不能藏在 tooltip 里 —— 玩家是看着代价做选择的
  if (a.flaw) html += '<div class="f">代价：' + a.flaw + '</div>';
  if (!learned) {
    const src = a.price ? '游方道人处购得（' + a.price + ' 两）' : (a.from ? a.from.text : '未知');
    html += '<div class="src">得法：' + src + '</div>';
  }
  html += '</div>';
  html += learned
    ? '<button data-mtoggle="' + id + '"' + (on ? ' class="off"' : '') + '>' + (on ? '卸下' : '装配') + '</button>'
    : '<button disabled>未得</button>';
  return html + '</div>';
}

function renderMantras() {
  const mp = document.getElementById('mantraPage');
  if (!mp) return;
  const L = player.mantras || { main: null, sub: [null, null] };
  const own = player.mantrasOwned || {};
  const slots = [mSlotHtml('main', L.main, '主')];
  for (let i = 0; i < SUB_SLOTS; i++) slots.push(mSlotHtml('sub' + i, (L.sub || [])[i] || null, '辅'));

  const rows = [];
  rows.push('<div id="mantraSlots">' + slots.join('') + '</div>');
  const nOwn = MANTRA_IDS.filter(id => own[id]).length;
  rows.push('<div class="sp">一主二辅 · 主心法互斥，装第二条会顶掉第一条 · 已得 ' +
    nOwn + '/' + MANTRA_IDS.length + ' 条</div>');

  rows.push('<div class="msec">已 学</div>');
  const learned = MANTRA_IDS.filter(id => own[id]);
  if (!learned.length) {
    rows.push('<div class="d" style="font:11px SimSun;color:#4A5568;padding:4px 2px">' +
      '还没学过心法。斩首领可得意境，游方道人（青云集街西）处可买辅心法。</div>');
  }
  for (const id of learned) rows.push(mCardHtml(id, true));

  const locked = MANTRA_IDS.filter(id => !own[id]);
  if (locked.length) {
    rows.push('<div class="msec">未 得</div>');
    for (const id of locked) rows.push(mCardHtml(id, false));
  }
  mp.innerHTML = rows.join('');

  mp.querySelectorAll('button[data-mtoggle]').forEach(b => {
    b.onclick = () => toggleMantra(b.dataset.mtoggle);
  });
  // 点槽位也能卸下：装了之后"怎么拿下来"是最容易漏掉的交互
  mp.querySelectorAll('[data-mslot]').forEach(el => {
    el.onclick = () => { if (el.dataset.mid) toggleMantra(el.dataset.mid); };
  });
}

function toggleMantra(id) {
  const a = MANTRAS[id];
  if (!a || !player.mantrasOwned[id]) return;
  const on = a.kind === 'main'
    ? player.mantras.main === id
    : (player.mantras.sub || []).indexOf(id) >= 0;
  if (on) {
    mantraUninstall(player.mantras, id);
    msg('已卸下「' + a.name + '」', C.paper1);
  } else {
    const r = mantraInstall(player.mantras, id);
    if (r.replaced && MANTRAS[r.replaced]) msg('「' + MANTRAS[r.replaced].name + '」已替下', C.paper1);
    else msg('装配「' + a.name + '」', C.jade3);
  }
  invalidateStats();
  // 上限被心法改过（血河 -15% / 空明 +40%）：装完当场夹一次，
  // 否则血条会停在"比上限还长"的位置，看起来像血溢出。
  player.hp = Math.min(player.hp, maxHp());
  player.qi = Math.min(player.qi, maxQi());
  renderMantras(); renderInv();
}

function toggleInv(force) {
  const show = force !== undefined ? force : invEl.style.display !== 'block';
  invEl.style.display = show ? 'block' : 'none';
  if (show) { renderInv(); showInvPage(invPageOn); }
}

// 页签绑定
for (const b of document.querySelectorAll('#inv .tabs button')) {
  b.onclick = () => showInvPage(b.dataset.invpage);
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
  // 交付对话没说完时别把货架刷回来，否则「继续」按钮会被商品冲掉。
  if (turnInSeq && turnInHost === 'shop') { drawTurnIn(); return; }
  const s = SHOPS[shopId];
  const open = shopOpenNow(shopId);
  document.getElementById('shopTitle').textContent = s.title;
  document.getElementById('shopSub').textContent =
    s.keeper + ' · ' + (open ? '营业中' : '已打烊') + '　｜　囊中 ' + player.gold + ' 银两';
  const rows = [];
  const line = open ? s.line
    : (s.deepNightClosed && clock.deepNight ? s.closedDeep : s.closed);
  rows.push('<div class="say">' + line + '</div>');
  // 店主的"事"：买卖之外还得能问出点东西来，否则柜台只是一台自动售货机。
  // 能复命的排在能接的前面 —— 先把这一趟收掉，再接新的，顺序反了会让人以为自己没做完。
  for (const q of questTurnInAt(shopId)) {
    rows.push('<div class="goods qrow"><div class="gn">复命 · ' + q.title +
      '<b>可交付</b></div><div class="gd">' +
      (q.turnIn && q.turnIn.length ? q.turnIn[0].text : (q.outro || '')) + '</div>' +
      '<button data-quest="' + q.id + '" data-act="turnin">复命</button></div>');
  }
  for (const q of questOffered(shopId)) {
    rows.push('<div class="goods qrow"><div class="gn">问事 · ' + q.title +
      '<b>' + q.place + '</b></div><div class="gd">' + q.brief + '</div>' +
      '<button data-quest="' + q.id + '" data-act="take">接下</button></div>');
  }
  if (open) {
    // 游方道人卖的是心法，不是货架上的东西 —— 单独一段，不塞进 SHOP_GOODS。
    // 只卖辅心法：主心法是构筑的核心，得靠打，不能靠买。
    if (shopId === 'daoshi') {
      let left = 0;
      for (const id of SUB_IDS) {
        if (player.mantrasOwned[id]) continue;
        left++;
        const a = SUB[id];
        const price = Math.max(1, Math.round(a.price * priceMul()));
        const ok = player.gold >= price;
        rows.push('<div class="goods"><div class="gn">' + a.name +
          '<b>' + price + ' 银两</b></div>' +
          '<div class="gd">' + a.desc + '</div>' +
          '<button data-mantra="' + id + '"' + (ok ? '' : ' disabled') + '>学下</button></div>');
      }
      if (!left) rows.push('<div class="gd">“这一褡裢你都学全了。剩下的路，得自己走。”</div>');
    }
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
  document.getElementById('shopBody').querySelectorAll('button[data-mantra]')
    .forEach(b => { b.onclick = () => buyMantra(b.dataset.mantra); });
  document.getElementById('shopBody').querySelectorAll('button[data-quest]')
    .forEach(b => {
      b.onclick = () => {
        const id = b.dataset.quest;
        if (b.dataset.act === 'take') questAccept(id);
        else {
          const done = questTurnIn(id);
          // 店主走店铺面板，没有对话面板，所以同一段对话在货架区里演。
          if (done && done.turnIn && done.turnIn.length) { beginTurnIn(done, 'shop'); return; }
        }
        renderShop();
      };
    });
}
// 游方道人处学辅心法。学一次永久拥有，之后随便装 —— 不做"再买一遍"。
function buyMantra(id) {
  const a = SUB[id];
  if (!a || player.mantrasOwned[id]) return;
  const price = Math.max(1, Math.round(a.price * priceMul()));
  if (player.gold < price) { msg('银两不够', C.red3); return; }
  player.gold -= price;
  learnMantra(id, true);
  msg('学得心法「' + a.name + '」　-' + price + ' 两', C.gold3);
  AUDIO.play('rare');
  renderShop();
}
function buyGood(id) {  if (!shopId) return;
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
  // 剧情正在播的时候，E 只用来翻页 —— 否则玩家一边读一边把面板开出来
  if (storyPlaying()) { storyNext(); return; }
  // 洞里没有柜台也没有村民，先认箱子与地脉裂口
  const dgo = nearDg();
  if (dgo) { dgUse(dgo); return; }
  // 箱子 / 裂口优先，其次才是火盆：站在裂口边上按 E 不该被借火抢走。
  const bz = nearBrazier();
  if (bz) { dgRelight(bz); return; }
  // 先认人，再认铺子。人比柜台重要 —— 站在门口的那个人才是"这地方有人"的信号。
  // 两边都在范围内时比距离，谁近听谁的（说书人和货郎的摊子只隔五十来像素）。
  const v = nearVillager();
  const id = nearShop();
  if (v && (!id || Math.hypot(player.x - v.x, player.y - v.y) <=
    Math.hypot(player.x - SHOPS[id].x, player.y - SHOPS[id].y))) { talkTo(v); return; }
  if (id) { shopOpen(id); return; }
  // 环境文本排在告示牌之前：碑文是定点物，告示牌在村里，
  // 两者不可能同时进范围，但"定点物优先"这条规则更好记。
  const env = nearEnvText();
  if (env) { envRead(env.id); return; }
  if (nearNotice()) { boardRead(); return; }
  if (nearSeal()) {
    const miss = tripleMissing(player.relics).map(relicName).join('、');
    msg('封碑未启 · 还缺 ' + miss, C.red3);
    return;
  }
  if (nearTemple()) { forgeOpen(); return; }
  msg('此处无人可谈', C.paper1);
}
function boardRead() {
  msg('告示：日出开市，入夜闭户。夜行遇阴物，莫追。', C.paper3);
}

// ============ 任务系统 ============
// 状态只存两样：走到第几步（step）、这一步攒了多少（prog）。
// 其余全部现算 —— 存"是否完成"会让数值一改就要写存档迁移。
function qState(id) { const s = player.quests[id]; return s ? s.st : 'none'; }
function qRec(id) { return player.quests[id] || null; }
function qCurStep(id) {
  const q = QUESTS[id], s = player.quests[id];
  if (!q || !s) return null;
  return q.steps[s.step] || null;
}
// 当前这一步是否已经满足 —— 满足就可以回去交
function qStepDone(id) {
  const q = QUESTS[id], s = player.quests[id];
  if (!q || !s) return false;
  return s.step >= q.steps.length;
}
function questAccept(id) {
  const q = QUESTS[id];
  if (!q || player.quests[id]) return false;
  player.quests[id] = { st: 'active', step: 0, prog: 0 };
  player.track = id;
  AUDIO.play('levelup');
  msg('接下「' + q.title + '」', C.gold3);
  renderQuests();
  return true;
}
// 推进到下一步。走完最后一步时给一次提示，但奖励要回去找委托人领 ——
// 自动结算会让"回去一趟"这件事失去意义，而那一趟才是任务的收尾。
function qAdvance(id) {
  const q = QUESTS[id], s = player.quests[id];
  if (!q || !s) return;
  s.step++; s.prog = 0;
  if (s.step >= q.steps.length) {
    msg('「' + q.title + '」· 可回去复命了', C.jade3);
    AUDIO.play('rare');
  } else {
    msg('「' + q.title + '」· ' + q.steps[s.step].text, C.paper1);
  }
  renderQuests();
}
function questTick(dt) {
  for (const id of QUEST_IDS) {
    const s = player.quests[id];
    if (!s || s.st !== 'active') continue;
    const o = qCurStep(id);
    if (!o) continue;
    if (o.kind === 'reach') {
      if (Math.hypot(player.x - o.at.x, player.y - o.at.y) <= (o.at.r || 40)) qAdvance(id);
    } else if (o.kind === 'dg') {
      if (dgIn(player.x, player.y) && dgFloor >= (o.floor || 1)) qAdvance(id);
    } else if (o.kind === 'item') {
      const n = (player.relics[o.item] || 0);
      s.prog = Math.min(n, o.count || 1);
      if (objDone(o, s.prog)) qAdvance(id);
    } else if (o.kind === 'have') {
      const n = o.field === 'iron' ? (player.iron || 0)
        : o.field === 'gold' ? (player.gold || 0) : (player.level || 1);
      s.prog = Math.min(n, o.count);
      if (objDone(o, s.prog)) qAdvance(id);
    }
  }
}
function questOnKill(e) {
  if (!e || !e.type) return;
  for (const id of QUEST_IDS) {
    const s = player.quests[id];
    if (!s || s.st !== 'active') continue;
    const o = qCurStep(id);
    if (!o || o.kind !== 'kill') continue;
    if (o.types.indexOf(e.type) < 0) continue;
    // 「守墓人」和普通阴魂是同一个 type，只能靠 lord 字段区分
    if (o.lord && e.lord !== o.lord) continue;
    // 夜里才作数的目标：白天杀的不算，否则"夜探乱葬岗"就白写了
    if (o.night && !clock.isNight) {
      if (!s.warned) { s.warned = true; msg('这类东西得夜里才有', C.paper1); }
      continue;
    }
    s.prog = (s.prog || 0) + 1;
    if (objDone(o, s.prog)) qAdvance(id);
    else renderQuests();
  }
}
function questOnTalk(npcId) {
  for (const id of QUEST_IDS) {
    const s = player.quests[id];
    if (!s || s.st !== 'active') continue;
    const o = qCurStep(id);
    if (!o || o.kind !== 'talk' || o.npc !== npcId) continue;
    qAdvance(id);
  }
}
function questReady(id) {
  const q = QUESTS[id], s = player.quests[id];
  return !!(q && s && s.st === 'active' && s.step >= q.steps.length);
}
function questTurnIn(id) {
  const q = QUESTS[id];
  if (!q || !questReady(id)) return null;
  const s = player.quests[id];
  s.st = 'done';
  // 消耗型目标（交精铁）在交付时才扣，接任务时就扣会让玩家没法先看要求
  for (const o of q.steps) {
    if (o.kind === 'have' && o.spend) {
      if (o.field === 'iron') player.iron = Math.max(0, (player.iron || 0) - o.count);
      else if (o.field === 'gold') player.gold = Math.max(0, player.gold - o.count);
    }
  }
  const r = q.reward || {};
  if (r.relic) {
    player.relics[r.relic] = (player.relics[r.relic] || 0) + 1;
    msg('得「' + relicName(r.relic) + '」', C.gold3);
  }
  if (r.gold) { player.gold += r.gold; }
  if (r.fame) addFame(r.fame);
  if (r.xp) { player.xp += r.xp; }
  if (r.potion) { for (let i = 0; i < r.potion; i++) addPotion('回春丹', 40, 0); }
  if (r.gear) {
    const it = makeGear(r.gear.kind, r.gear.r, Math.max(1, player.level + 1));
    if (invFull()) addDrop('gear', it, player.x, player.y);
    else { player.inv.push(it); }
  }
  invalidateStats();
  while (player.xp >= player.level * 42) {
    player.xp -= player.level * 42; player.level++;
    player.maxHpBase += 15; player.atkBase += 2; player.skillPts++;
    invalidateStats(); player.hp = maxHp(); player.qi = maxQi();
    msg('境界提升 · ' + realm() + '　（得参悟点 1，按 T 参悟）', C.gold3);
    AUDIO.play('levelup');
    renderSkills();
  }
  checkMantraUnlocks();   // 交任务升级也会跨境界门槛
  player.track = QUEST_IDS.find(k => player.quests[k] && player.quests[k].st === 'active') || null;
  refreshSeal();   // 拿到第三件三物时，封碑当场就该开
  AUDIO.play('rare');
  msg('「' + q.title + '」已了', C.gold3);
  renderInv(); renderQuests();
  return q;
}
// 可接的任务：没接过、且（主线要按顺序）前置已了
function questOffered(npcId) {
  return questsOfGiver(npcId).filter(q => {
    if (player.quests[q.id]) return false;
    if (q.kind !== 'main') return true;
    const i = MAIN_ORDER.indexOf(q.id);
    if (i <= 0) return true;
    const prev = player.quests[MAIN_ORDER[i - 1]];
    return !!(prev && prev.st === 'done');
  });
}
function questTurnInAt(npcId) {
  return questsOfGiver(npcId).filter(q => questReady(q.id));
}
// 三物：齐了才能下古洞
function tripleState() { return { ok: tripleReady(player.relics), miss: tripleMissing(player.relics) }; }

// ============ 剧情 ============
// 与任务的边界：任务是"别人让你做的事"，剧情是"你身上发生的事"。
// 任务要玩家去接、去交；剧情条件满足就自己播，玩家不点也不会错过。
//
// 播放模型刻意做成"覆盖层 + 一行一句"而不是复用对话面板：
// 对话面板有选项按钮（接任务 / 打听 / 作别），剧情不能有 —— 一旦有按钮，
// 玩家就会去点，而剧情里最值钱的是"读完这一句"这件事本身。
const storyEl = document.getElementById('story');
const storyNameEl = document.getElementById('storyName');
const storyLineEl = document.getElementById('storyLine');
// 注意 id 是 storyAct 不是 storyPage —— storyPage 是行囊里的「旧事」页容器。
// 两个都用 storyPage 的话，getElementById 只会拿到先出现的那个，
// 表现是覆盖层里显示出整页剧情日志、而旧事页永远是空的。
const storyPageEl = document.getElementById('storyAct');
const storyDotsEl = document.getElementById('storyDots');
// 终章的选择：整章唯一一处按钮。平时 hidden，连占位都不留。
const storyChoiceEl = document.getElementById('storyChoice');
const storyHintEl = document.getElementById('storyHint');
// ?story=0 关掉剧情的"自动播放"。
// 为什么要这个开关：无头回归里有 8 个套件靠 tick() 手动步进世界，
// 而剧情一播世界就暂停 —— 表现是"某个断言莫名失败"，这是最难查的一类问题。
// 只关自动触发，storyPlay() 仍然可用，所以 tools/story.js 能直接点名播。
const STORY_OFF = /[?&]story=0/.test(location.search);
let storyCur = null;        // 正在播的节点
let storyIdx = 0;           // 第几行
let storyTimer = null, storyFull = '', storyShown = 0;
let storyPending = [];      // 同一帧触发的多个节点，排队播
// 正在等玩家做选择的那一屏。非空时 storyNext() 一律不响应 ——
// 玩家点一下屏幕就跳过一个"没有对错的选择"，那这个选择等于不存在。
let storyChoice = null;
// 选完之后那 220ms 的压印停顿里，待执行的转场函数。自检用 storyPickGo() 直接跳过它。
let storyChoiceNext = null;
// 这一屏已经选了哪条。**不能存在 storyChoice.picked 上** —— storyChoice 指向的是
// STORY 表里的那个对象本身，往上面写一个字段，等于把"选过了"永久刻进剧情数据：
// 第二周目再播到这一屏，两个按钮都是死的。这个 bug 只在跑第二遍时才现形。
let storyChoicePicked = null;

function storyCtx() {
  return {
    flags: player.flags || {}, relics: player.relics || {},
    read: player.readLog || {}, fame: player.fame || 0,
    phase: clock.phase.id, kills: player.typeKills || {},
    bossKills: player.bossKills || {},
    triple: tripleReady(player.relics),
    pos: { x: player.x, y: player.y },
    // 古洞第几层。终章靠它 —— 洞里每次重排坐标都没意义，有意义的是"下到多深"。
    floor: dgIn(player.x, player.y) ? dgFloor : 0,
  };
}
function storyPlaying() { return !!storyCur; }

// 台词里的 who 决定显示什么名字：null / narrator 是旁白（不显示名字条），
// 其余按 NPC id 去两张表里找 —— 街面村民 + 野外游荡者，都是 ALL_TALKERS。
function whoName(who) {
  if (!who || who === 'narrator') return '';
  const v = ALL_TALKERS.find(t => t.id === who);
  if (v) return v.name;
  const n = NPCS.find(t => t.id === who);
  return n ? n.name : who;
}

function storyPlay(id) {
  const s = STORY[id];
  if (!s || player.readLog[id]) return false;
  storyShow({
    id: s.id,
    page: (ACTS.find(a => a.id === s.act) || {}).name || '',
    lines: s.lines,
    onEnd: s.onEnd,
  });
  return true;
}
// 真正的播放器。单独拆出来是为了让环境文本（碑文）也能用同一个覆盖层 ——
// 碑文用飘字显示两秒根本读不完，而"读一段字"这件事本来就该有它自己的界面。
function storyShow(node) {
  storyCur = node; storyIdx = 0;
  storyChoice = null;
  storyChoicePicked = null;
  if (storyChoiceEl) { storyChoiceEl.classList.add('hidden'); storyChoiceEl.innerHTML = ''; }
  if (storyHintEl) storyHintEl.classList.remove('hidden');
  storyEl.classList.remove('hidden');
  storyPageEl.textContent = node.page || '';
  // 圆点：这一节有几句。玩家能看见"还有两下就完了"，才会愿意读完。
  storyDotsEl.innerHTML = node.lines.map(() => '<i></i>').join('');
  storyLine(node.lines[0]);
}
function storyLine(l) {
  if (!l) { storyEnd(); return; }
  const n = whoName(l.who);
  storyNameEl.textContent = n;
  storyNameEl.classList.toggle('hidden', !n);
  storyFull = l.text; storyShown = 0;
  if (storyTimer) { clearInterval(storyTimer); storyTimer = null; }
  storyLineEl.textContent = '';
  // 打字机比对话面板快一点：剧情是"读"的，不是"听"的，等太久会烦。
  storyTimer = setInterval(() => {
    storyShown += 3;
    storyLineEl.textContent = storyFull.slice(0, storyShown);
    if (storyShown >= storyFull.length) { clearInterval(storyTimer); storyTimer = null; }
  }, 22);
  const dots = storyDotsEl.children;
  for (let i = 0; i < dots.length; i++) dots[i].className = i === storyIdx ? 'on' : '';
}
// 点一下：没吐完就直接给全（急着看的人不该被动画拖住），吐完了就翻下一句。
function storyNext() {
  if (!storyCur) return false;
  // 等选择的时候，点屏幕没有任何作用 —— 这一屏必须点按钮才能过。
  if (storyChoice) return true;
  if (storyShown < storyFull.length) {
    if (storyTimer) { clearInterval(storyTimer); storyTimer = null; }
    storyShown = storyFull.length; storyLineEl.textContent = storyFull;
    return true;
  }
  storyIdx++;
  if (storyIdx >= storyCur.lines.length) { storyEnd(); return true; }
  storyLine(storyCur.lines[storyIdx]);
  return true;
}
function storyEnd() {
  const s = storyCur;
  if (!s) return;
  if (storyTimer) { clearInterval(storyTimer); storyTimer = null; }
  const e = s.onEnd || {};
  // 终章的选择：播到这儿不关窗，先把两个分支摆出来。
  // 这里**不写 readLog** —— 玩家还没选，这一段就还没算完。
  if (e.choice && !storyChoice) { storyAskChoice(e.choice); return; }
  storyEl.classList.add('hidden');
  storyCur = null;
  player.readLog[s.id] = 1;
  storyApply(e);
}
// onEnd 的结算。拆出来是因为选择分支也要走同一套（flag / 线索 / 侠名 / 心法解锁），
// 复制一份迟早会漏掉 checkMantraUnlocks 这种"不补就得等下次升级"的东西。
function storyApply(e) {
  if (e.flag) player.flags[e.flag] = 1;
  if (e.clue && CLUES[e.clue]) {
    player.clues[e.clue] = 1;
    msg('线索 · ' + CLUES[e.clue].name, C.pur3);
  }
  if (e.fame) addFame(e.fame);
  if (e.msg) msg(e.msg, C.gold3);
  AUDIO.play('rare');
  // flag 可能正好是某条心法的解锁条件（卸力挂在 mark1 上）——
  // 不在这里补一次，玩家得等到下次升级才会"突然"悟到。
  if (e.flag) checkMantraUnlocks();
  // 剧情会改 flag / 线索 / 侠名，而这三样都能满足别的节点的条件 —— 播完再扫一遍。
  storyScan();
}
// 把两个分支摆出来。整章只有这一处有按钮，所以它值得为它单独写一屏：
// 圆点清掉（这里没有"还有几句"）、名字条收起（没有人在说话）、
// 底部那行"点击继续"也收起（这时候点屏幕没用，写着就是骗人）。
function storyAskChoice(ch) {
  storyChoice = ch;
  storyChoicePicked = null;
  if (storyTimer) { clearInterval(storyTimer); storyTimer = null; }
  storyDotsEl.innerHTML = '';
  storyNameEl.classList.add('hidden');
  storyFull = ch.prompt || ''; storyShown = storyFull.length;
  storyLineEl.textContent = storyFull;
  if (storyHintEl) storyHintEl.classList.add('hidden');
  storyChoiceEl.innerHTML = '';
  for (const o of ch.options || []) {
    const b = document.createElement('button');
    b.dataset.opt = o.id;
    b.innerHTML = o.label + (o.hint ? '<i>' + o.hint + '</i>' : '');
    b.onclick = ev => { if (ev) ev.stopPropagation(); storyChoose(o.id); };
    storyChoiceEl.appendChild(b);
  }
  storyChoiceEl.classList.remove('hidden');
}
// 选了一个。压印 220ms 再走 —— 直接换屏的话玩家会怀疑自己到底按没按到。
function storyChoose(optId) {
  const s = storyCur, ch = storyChoice;
  if (!s || !ch) return false;
  if (storyChoicePicked) return false;     // 连点两下不许连选两次
  const o = (ch.options || []).find(x => x.id === optId);
  if (!o) return false;
  storyChoicePicked = optId;
  const btn = storyChoiceEl.querySelector('button[data-opt="' + optId + '"]');
  if (btn) btn.classList.add('picked');
  // 记下"选过哪个"：存档要带，旧事页要显示，读档后也不该再问一次。
  player.choices = player.choices || {};
  player.choices[s.id] = o.id;
  player.readLog[s.id] = 1;
  storyApply(o);
  const finish = () => {
    storyChoiceNext = null;
    storyChoice = null;
    if (o.lines && o.lines.length) {
      // 选择是"你做了什么"，结局旁白是"后来怎样了"。两段必须分开播，
      // 挤在同一屏里的话，玩家会以为那只是选择的说明文字。
      storyShow({ id: s.id, page: '终章 · 古洞', lines: o.lines, onEnd: { msg: '第一章 · 终' } });
    } else {
      storyEl.classList.add('hidden');
      storyCur = null;
      storyScan();
    }
  };
  // 220ms 的压印停顿。存下这个待执行的转场，是为了让自检能同步跑完 ——
  // 不然每一处验终章的用例都得真等 220ms，一条套件就多出好几秒。
  storyChoiceNext = finish;
  setTimeout(() => { if (storyChoiceNext === finish) finish(); }, 220);
  return true;
}
// 立刻执行待转场（自检用；正常游玩走 220ms 的定时器）
function storyPickGo() {
  if (storyChoiceNext) storyChoiceNext();
  return !storyChoiceNext;
}
function storyClose() { storyEnd(); }

// 每帧扫一次"有没有该播的节点"。节点总数是十几个，全表扫比维护事件订阅简单得多，
// 也不会出现"某个钩子忘了调用导致某条剧情永远不播"这种最难查的 bug。
// boot 节点单独处理：它只在"这一局刚开始"成立，不能每帧都成立。
let storyBootDone = false;
function storyScan() {
  if (STORY_OFF) return false;
  if (storyPlaying() || state !== 'play') return false;
  const ctx = storyCtx();
  for (const id of STORY_IDS) {
    const s = STORY[id];
    if (s.trigger.type === 'boot' && !storyBootDone) continue;
    if (storyReady(s, ctx)) { storyPlay(id); return true; }
  }
  return false;
}
// 开局第一个 tick 才允许播 boot —— 进游戏和读档都走这里，
// 但读档时 readLog 里已经有它，storyReady 会挡掉。
function storyOnBoot() {
  storyBootDone = true;
  if (STORY_OFF) return;
  const ctx = storyCtx();
  const s = STORY_IDS.map(id => STORY[id]).find(n => n.trigger.type === 'boot' && storyReady(n, ctx));
  if (s) storyPlay(s.id);
}
// 重开一局：把播放器与 boot 闸门归零。不清的话第二周目再也看不到序章。
function storyReset() {
  if (storyTimer) { clearInterval(storyTimer); storyTimer = null; }
  storyCur = null; storyIdx = 0; storyFull = ''; storyShown = 0;
  storyChoice = null;
  storyChoicePicked = null;
  storyChoiceNext = null;
  if (storyChoiceEl) { storyChoiceEl.classList.add('hidden'); storyChoiceEl.innerHTML = ''; }
  if (storyHintEl) storyHintEl.classList.remove('hidden');
  storyBootDone = false;
  if (storyEl) storyEl.classList.add('hidden');
}

// 环境文本：走近按 E 读。可反复读，读完记进日志（readLog 用 e_ 前缀区分）。
function nearEnvText() {
  let best = null, bd = 1e9;
  for (const id of ENV_IDS) {
    const t = ENV_TEXTS[id];
    const d = Math.hypot(player.x - t.at.x, player.y - t.at.y);
    if (d <= t.at.r && d < bd) { bd = d; best = { id, t }; }
  }
  return best;
}
function envRead(id) {
  const t = ENV_TEXTS[id];
  if (!t) return;
  player.readLog[id] = 1;
  // 碑文走剧情覆盖层，不走飘字 —— 飘字两秒就没了，而碑文是要停下来读的。
  storyShow({
    id,
    page: '旧 物',
    lines: [
      { who: null, text: t.name },
      { who: 'narrator', text: t.text },
    ],
    onEnd: {},
  });
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
  // 「卸力」挂在侠名 40 上 —— 主线还没做出来之前，先用已有的里程碑兜住，
  // 免得 22 条心法里有 4 条永远学不到（P7 会改挂剧情节点）。
  checkMantraUnlocks();
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
// 当前这一层的台词。三层对话（初见 / 熟识 / 深交）按侠名挑，
// 挑中的这一层在这次对话里固定住 —— 中途升级换口吻会让玩家以为点错了人。
let talkLayer = null;

function phaseOn(phases) {
  if (!phases || phases === 'always') return true;
  return phases.indexOf(clock.phase.id) >= 0;
}
function nearVillager() {
  let best = null, bd = 1e9;
  for (const v of ALL_TALKERS) {
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
  questOnTalk(v.id);
  const o = vilObjs.find(x => x.villager === v.id);
  // 三层对话：story.js 里写了就用它，没写的（店主等）继续走 village.js 的老台词。
  // 强制迁移所有 NPC 会让店主那句"营业 / 打烊"两个状态丢掉，不值得。
  talkLayer = npcLines(v.id, player.fame || 0);
  const n = o ? o.spoke : 0;
  const lines = talkLayer ? talkLayer.lines : v.greet;
  if (o) o.spoke = (n + 1) % lines.length;
  document.getElementById('talkName').textContent = v.name;
  // 把层名挂在这一行上：玩家能看见"这个人现在怎么看你"，
  // 而不用去猜为什么台词变了。
  document.getElementById('talkRole').textContent = v.role + '　·　' + clock.phase.name +
    (talkLayer ? '　·　' + npcLayer(player.fame || 0).name : '');
  talkEl.classList.remove('hidden');
  // 见过几面之后，台词换口气 —— 这是最便宜的"他记得你"
  renderTalk(lines[n % lines.length]);
}
function renderTalk(line) {
  say(line);
  renderTalkOptions();
}
function renderTalkOptions() {
  talkOptsEl.innerHTML = '';
  const add = (label, fn) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.onclick = fn;
    talkOptsEl.appendChild(b);
  };
  if (!talkNpc) return;
  if (!talkAsked) add('打听', () => {
    talkAsked = true;
    renderTalk((talkLayer && talkLayer.ask) || talkNpc.ask);
  });
  // 任务：先复命，再接新。店主走的是店铺面板，村民走这里。
  for (const q of questTurnInAt(talkNpc.id)) {
    add('复命 · ' + q.title, () => {
      const done = questTurnIn(q.id);
      if (!done) return;
      // 有交付对话就一行一行演；没写的老任务仍按原来一句 outro 收。
      if (done.turnIn && done.turnIn.length) beginTurnIn(done, 'talk');
      else renderTalk(done.outro || '……');
    });
  }
  for (const q of questOffered(talkNpc.id)) {
    add('接下 · ' + q.title, () => {
      questAccept(q.id);
      renderTalk(q.brief);
    });
  }
  if (talkNpc.act) add(talkNpc.actLabel, () => {
    const r = NPC_ACT[talkNpc.act](talkNpc);
    if (r) renderTalk(r);
  });
  // 关窗只留底部那一个按钮 —— 选项行里再放一个「作别」，同屏就有两个一样的东西。
}

// ============ 交付对话 ============
// 以前点「复命」只弹一句 outro，人像个自动售货机。现在每条任务带一段
// turnIn（一行一句、带说话人），点「继续」往下走，最后一句仍是 outro。
// 对话期间不给「打听 / 接下」，免得玩家点着点着把自己点出对话。
// 村里走对话面板，店主走店铺面板 —— 两条入口共用同一段序列状态。
let turnInSeq = null, turnInI = 0, turnInHost = 'talk', turnInName = '';
function turnInLines(q) {
  const lines = (q.turnIn || []).slice();
  if (q.outro) lines.push({ who: null, text: q.outro });
  return lines.length ? lines : [{ who: null, text: '……' }];
}
function dlgEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function beginTurnIn(q, host) {
  turnInSeq = turnInLines(q);
  turnInI = 0;
  turnInHost = host || 'talk';
  turnInName = document.getElementById(turnInHost === 'shop' ? 'shopTitle' : 'talkName').textContent;
  drawTurnIn();
}
function drawTurnIn() {
  if (!turnInSeq) return;
  const it = turnInSeq[turnInI];
  const last = turnInI + 1 >= turnInSeq.length;
  const label = last ? '说完了' : '继续';
  if (turnInHost === 'shop') {
    const body = document.getElementById('shopBody');
    body.innerHTML = '<div class="say">' + dlgEsc(it.text) + '</div>' +
      '<div class="goods qrow"><button data-turnin="1">' + label + '</button></div>';
    const b = body.querySelector('[data-turnin]');
    if (b) b.onclick = advanceTurnIn;
    document.getElementById('shopTitle').textContent = it.who || turnInName;
    return;
  }
  say(it.text);
  document.getElementById('talkName').textContent = it.who || turnInName;
  talkOptsEl.innerHTML = '';
  const b = document.createElement('button');
  b.textContent = label;
  b.onclick = advanceTurnIn;
  talkOptsEl.appendChild(b);
}
function advanceTurnIn() {
  if (!turnInSeq) return;
  if (turnInI + 1 < turnInSeq.length) { turnInI++; drawTurnIn(); return; }
  endTurnIn();
}
function endTurnIn() {
  const host = turnInHost;
  turnInSeq = null; turnInI = 0;
  // 店铺标题由 renderShop 自己写回去，这里不用手补。
  if (host === 'shop') { renderShop(); return; }
  document.getElementById('talkName').textContent = turnInName;
  renderTalkOptions();
}
function talkClose() {
  if (turnInSeq && turnInHost === 'talk') {
    document.getElementById('talkName').textContent = turnInName;
    turnInSeq = null; turnInI = 0;
  }
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
  if (show) { renderSkills(); if (artPageOn) renderArts(); }
}

// ============ 招式面板 ============
// 道行与招式合成一个面板的两页：都是"我这套东西怎么配"，分成两个入口
// 玩家会忘记另一个的存在。
const artPageEl = document.getElementById('artPage');

// 招式页里的「导入工作台覆盖表」：file:// 下单文件、http 模块版、线上打包版都走同一条路。
// 选 .json 文件 → 写游戏自己的 localStorage → 刷新生效，不依赖工作台与游戏同源。
function initArtOverrideUI() {
  const file = document.getElementById('artOvFile');
  const btn = document.getElementById('btnArtOv');
  const clr = document.getElementById('btnArtOvClear');
  const info = document.getElementById('artOvInfo');
  const refresh = () => { if (info) info.textContent = '已覆盖 ' + overrideCount() + ' 招'; };
  if (btn && file) {
    btn.onclick = () => file.click();
    file.onchange = () => {
      const f = file.files && file.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const n = importOverrides(String(r.result));
          alert('已导入 ' + n + ' 招，刷新后生效。');
          location.reload();
        } catch (e) { alert('覆盖表格式不对：' + e.message); }
      };
      r.readAsText(f);
    };
  }
  if (clr) clr.onclick = () => {
    clearOverrides();
    alert('已清除试玩覆盖，刷新后回到基线（仓库里的 data.js 覆盖仍有效）。');
    location.reload();
  };
  refresh();
}
initArtOverrideUI();
const daoPageEl = document.getElementById('daoPage');
const skillTitleEl = document.getElementById('skillTitle');
let artPageOn = false;
function showArtPage(show) {
  artPageOn = !!show;
  if (daoPageEl) daoPageEl.classList.toggle('hidden', artPageOn);
  if (artPageEl) artPageEl.classList.toggle('hidden', !artPageOn);
  if (skillTitleEl) skillTitleEl.textContent = artPageOn ? '招式' : '道行';
  // 招式页是两栏（剑匣 + 招式库），道行页是三列树 —— 宽度得跟着切
  const box = document.getElementById('skills');
  if (box) box.classList.toggle('wide', artPageOn);
  document.querySelectorAll('#skills .tabs button').forEach(b => {
    b.classList.toggle('on', (b.dataset.page === 'art') === artPageOn);
  });
  if (artPageOn) renderArts();
}
document.querySelectorAll('#skills .tabs button').forEach(b => {
  b.onclick = () => showArtPage(b.dataset.page === 'art');
});

// 装配交互：八招只能上阵六招。
// 三个动作都是一步到位，**没有"先选中一格"这种中间态** ——
// 那个中间态是旧版的痛点：点招式之前必须先去上面点一格，忘了点就只装进第 0 格，
// 装完还得回头看自己刚才点的是哪一格。
//   拖招式卡到某一格 = 装到那格（格里有招就互换，不会把它挤没）
//   点招式卡        = 装进第一个空格 / 已装则卸下
//   点格子          = 直接卸下
// 早期版本是"槽满就顶掉第 0 格"，玩家排好的顺序会被无声打乱 —— 所以有 loadoutManual。
const ART_ORD = ['壹', '贰', '叁', '肆', '伍', '陆'];
// 功能位配色。招式卡左侧色条、剑匣格子的左边线、分组标题共用同一条颜色 ——
// 玩家不看字也能认出"这条是清场 / 那条是位移"。
const ART_FN_COLOR = {
  dmg: '#C8453B', aoe: '#A8622C', move: '#2F6E6A',
  ctrl: '#3A5A8C', buff: '#B8892B', special: '#6B4A6E',
};
const ART_FN_ORDER = ['dmg', 'aoe', 'move', 'ctrl', 'buff', 'special'];
function artFnColor(a) { return ART_FN_COLOR[a && a.slot] || '#8A6520'; }

// slot 省略 = 自己找位置（第一个空格）；给了 slot = 拖拽落点
function artPlace(id, slot) {
  const a = artById(id);
  if (!a) return false;
  player.loadoutManual = true;   // 玩家动过装配，之后不再自动补位
  const cur = player.loadout.indexOf(id);
  let tgt = (slot === undefined || slot === null || slot < 0) ? -1 : slot;

  if (cur >= 0) {
    // 已上阵：拖到别的格 = 换位（两格互换，谁也不会消失）；不带格 = 卸下
    if (tgt >= 0 && tgt !== cur) {
      const other = player.loadout[tgt];
      player.loadout[tgt] = id;
      player.loadout[cur] = other || null;
    } else {
      player.loadout[cur] = null;
    }
    renderArts();
    return true;
  }
  if (tgt < 0) tgt = player.loadout.indexOf(null);
  if (tgt < 0) {
    msg('六格已满 · 把招式拖到想替换的那一格上', C.paper1);
    return false;
  }
  player.loadout[tgt] = id;
  renderArts();
  return true;
}

// 点格子 = 卸下。没有"选中"状态要清，所以这里不需要第二次点击
function artSlotClick(i) {
  if (!player.loadout[i]) return false;
  player.loadoutManual = true;
  player.loadout[i] = null;
  renderArts();
  return true;
}

// 拖拽用 pointer 事件自己实现，不引库：
//   · 桌面与触屏同一套代码（pointerType 只用来挡右键）
//   · 移动超过 7px 才算拖，否则算点 —— 这样"点一下装上"和"拖过去"能共存
//   · 用 elementFromPoint 找落点，而不是给每个格子绑 enter/leave：
//     格子只有六个，一次遍历比维护六个悬停状态便宜得多，也不会漏清高亮
let artDrag = null;
function artSlotAt(x, y) {
  // 先按元素命中：指针在格子里时这是最准的（格子内部的子元素也能就近取到父格）
  const el = document.elementFromPoint(x, y);
  const hit = el && el.closest ? el.closest('#artQuiver .artSlot') : null;
  if (hit) return hit;
  // 兜底按矩形自己算一次。两个真实场景需要它：
  //   ① 指针正好压在格子边框上，elementFromPoint 可能返回相邻的兄弟格
  //   ② 面板刚显示、布局还没落定，elementFromPoint 会返回 null
  // 格子只有六个，遍历一遍比调试"为什么这次拖不进去"便宜得多。
  for (const s of document.querySelectorAll('#artQuiver .artSlot')) {
    const r = s.getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return s;
  }
  return null;
}
function artDragEnd(cancel) {
  if (!artDrag) return;
  const d = artDrag;
  artDrag = null;
  if (d.timer) clearTimeout(d.timer);
  if (d.ghost) d.ghost.remove();
  if (d.card) d.card.classList.remove('dragging');
  document.querySelectorAll('#artQuiver .artSlot').forEach(s => s.classList.remove('over'));
  if (cancel) return;
  if (!d.moved) { artPlace(d.id); return; }     // 没移动 = 一次点击
  if (d.hit) artPlace(d.id, +d.hit.dataset.slot);
}
function artBindDrag(card, id) {
  card.addEventListener('pointerdown', ev => {
    if (card.classList.contains('locked')) return;
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    artDrag = {
      id, card, pid: ev.pointerId,
      x0: ev.clientX, y0: ev.clientY, moved: false, ghost: null, hit: null,
      // 触屏要长按 150ms 才进入拖拽：手指落在卡片上往下划，本意是滚招式库，
      // 一按下就抢走手势的话，列表在手机上根本滚不动。
      // 鼠标没有这个歧义，按下即可拖。
      armed: ev.pointerType !== 'touch',
      timer: null,
    };
    if (!artDrag.armed) {
      artDrag.timer = setTimeout(() => {
        if (!artDrag || artDrag.id !== id) return;
        artDrag.armed = true;
        try { card.setPointerCapture(artDrag.pid); } catch (e) { }
      }, 150);
    } else {
      try { card.setPointerCapture(ev.pointerId); } catch (e) { }
    }
    // 这里**不能** preventDefault：一 preventDefault 浏览器就不滚了
  });
  card.addEventListener('pointermove', ev => {
    if (!artDrag || artDrag.pid !== ev.pointerId || artDrag.id !== id) return;
    if (!artDrag.armed) return;   // 触屏还在等长按，先让列表滚
    if (!artDrag.moved) {
      if (Math.hypot(ev.clientX - artDrag.x0, ev.clientY - artDrag.y0) < 7) return;
      artDrag.moved = true;
      const a = artById(id);
      const gh = document.createElement('div');
      gh.id = 'artGhost';
      gh.textContent = a ? a.name : id;
      gh.style.borderLeftColor = artFnColor(a);
      document.body.appendChild(gh);
      artDrag.ghost = gh;
      card.classList.add('dragging');
    }
    ev.preventDefault();
    artDrag.ghost.style.left = (ev.clientX + 12) + 'px';
    artDrag.ghost.style.top = (ev.clientY - 16) + 'px';
    const hit = artSlotAt(ev.clientX, ev.clientY);
    artDrag.hit = hit;
    document.querySelectorAll('#artQuiver .artSlot').forEach(s => s.classList.toggle('over', s === hit));
  });
  card.addEventListener('pointerup', ev => {
    if (!artDrag || artDrag.pid !== ev.pointerId || artDrag.id !== id) return;
    // 松手位置可能和最后一次 move 不同，这里要重算一次落点
    if (artDrag.moved) artDrag.hit = artSlotAt(ev.clientX, ev.clientY);
    artDragEnd(false);
  });
  card.addEventListener('pointercancel', () => {
    if (!artDrag || artDrag.id !== id) return;
    artDragEnd(true);
  });
}

function renderArts() {
  const sub = document.getElementById('artSub');
  if (!sub) return;
  const fam = weaponFam(), W = WEAPONS[fam];
  const k = profKills(fam), lv = profLevel(k), left = profLeft(k);
  sub.innerHTML = '当前持 <b>' + W.name + '</b> · 专精 <b>' + lv + '/' + PROF_MAX + '</b>'
    + (left ? ' · 再斩 <em>' + left + '</em> 名可至 ' + (lv + 1) + ' 级' : ' · 已至圆满');

  // 剑匣：六格竖排。装上招的格子透出暖光 + 左侧功能位色条，
  // 空位是虚线「虚位」—— 数一眼就知道还差几格，比写"已装 3/6"直接
  const qv = document.getElementById('artQuiver');
  if (qv) {
    const used = player.loadout.filter(Boolean).length;
    qv.innerHTML = '<div class="qh">剑匣</div>' + player.loadout.map((id, i) => {
      const a = id ? artById(id) : null;
      return '<div class="artSlot' + (a ? ' on' : '') + '" data-slot="' + i + '"'
        + (a ? ' style="--gc:' + artFnColor(a) + '"' : '')
        + ' title="' + (a ? a.name + ' · 点一下卸下' : '空位 · 把招式拖到这里') + '">'
        + '<span class="ord">' + ART_ORD[i] + '</span>'
        + '<span class="txt"><span class="nm">' + (a ? a.name : '虚位') + '</span>'
        + '<span class="fn">' + (a ? (ART_SLOT_LABEL[a.slot] || '') : '空') + '</span></span>'
        + '</div>';
    }).join('') + '<div class="qf">已装 ' + used + ' / ' + ART_SLOTS + '</div>';
    qv.querySelectorAll('.artSlot').forEach(el => {
      el.onclick = () => artSlotClick(+el.dataset.slot);
    });
  }

  // 招式库：按功能位分组，不是一条平铺的长列表 ——
  // "我缺一个位移"这种念头是按功能位想的，不是按招式名想的
  const lib = document.getElementById('artLib');
  if (!lib) return;
  let html = '';
  for (const slot of ART_FN_ORDER) {
    const list = artsOfWeapon(fam).filter(a => a.slot === slot);
    if (!list.length) continue;
    const gc = ART_FN_COLOR[slot] || '#8A6520';
    html += '<div class="artGrp" style="--gc:' + gc + '"><b>'
      + (ART_SLOT_LABEL[slot] || slot) + '</b><i></i></div>'
      + '<div class="artGrid' + (list.length === 1 ? ' single' : '') + '">';
    for (const a of list) {
      const un = artUnlocked(k, a);
      const at = player.loadout.indexOf(a.id);
      html += '<div class="artCard' + (un ? '' : ' locked') + (at >= 0 ? ' armed' : '')
        + '" data-art="' + a.id + '" style="--gc:' + gc + '">'
        + '<div class="l"><div class="t">' + a.name + '</div>'
        + '<div class="d">' + a.desc + '</div>'
        + '<div class="m">' + artBrief(a) + (un ? '' : ' · 需专精 ' + a.prof + ' 级') + '</div></div>'
        + '<div class="st">' + (at >= 0 ? ART_ORD[at] : (un ? '＋' : '锁')) + '</div>'
        + '</div>';
    }
    html += '</div>';
  }
  html += '<div class="profTitle">各兵器专精</div>';
  for (const f of WEAPON_IDS) {
    const kk = profKills(f), ll = profLevel(kk);
    html += '<div class="profRow' + (f === fam ? ' cur' : '') + '"><b>' + WEAPONS[f].name + '</b>' +
      '<div class="pb"><i style="width:' + Math.round(profFrac(kk) * 100) + '%"></i></div>' +
      '<span>' + ll + '/' + PROF_MAX + (ll >= PROF_MAX ? ' 满' : ' ·' + profLeft(kk)) + '</span></div>';
  }
  html += '<div class="foot">专精只长手上这件兵器 · 招式也只能用对应兵器放</div>';
  lib.innerHTML = html;
  lib.querySelectorAll('.artCard[data-art]').forEach(card => {
    artBindDrag(card, card.dataset.art);
  });
}

// ============ 任务面板 ============
const questEl = document.getElementById('quest');
function qRewardText(r) {
  const out = [];
  if (r.relic) out.push('「' + relicName(r.relic) + '」');
  if (r.gold) out.push('银两 ' + r.gold);
  if (r.fame) out.push('侠名 +' + r.fame);
  if (r.xp) out.push('历练 ' + r.xp);
  if (r.potion) out.push('回春丹 ×' + r.potion);
  if (r.gear) out.push(RARITY[r.gear.r].name + SLOT_LABEL[r.gear.kind] + ' ×1');
  return out.join(' · ');
}
function renderQuests() {
  if (!questEl) return;
  const body = document.getElementById('questBody');
  if (!body) return;

  // 三物进度：这是整章唯一的"主线看得见"的进度条
  const t = tripleState();
  document.getElementById('questRelics').innerHTML = RELICS_TRIPLE.map(id => {
    const got = (player.relics[id] || 0) > 0;
    return '<div class="' + (got ? 'on' : '') + '"><b>' + relicName(id) + '</b>' +
      '<span>' + (got ? '已得' : '未得') + '</span></div>';
  }).join('');
  document.getElementById('questSub').textContent = t.ok
    ? '三物已齐 · 古洞封碑可启'
    : '三物齐，封碑自开（缺 ' + t.miss.map(relicName).join('、') + '）';

  const card = (q, st) => {
    const s = player.quests[q.id];
    const stepIdx = s ? s.step : -1;
    const done = s && s.st === 'done';
    const ready = questReady(q.id);
    const steps = q.steps.map((o, i) => {
      const cls = done || i < stepIdx ? 'ok' : (i === stepIdx ? 'cur' : '');
      const txt = i === stepIdx && s ? objText(o, s.prog) : o.text;
      return '<div class="qStep ' + cls + '">' + (cls === 'ok' ? '✓ ' : (cls === 'cur' ? '▸ ' : '· ')) + txt + '</div>';
    }).join('');
    return '<div class="qcard' + (done ? ' done' : ready ? ' ready' : '') + '">' +
      '<div class="qTop"><b>' + q.title + '</b><i>' +
      (done ? '已了' : ready ? '可复命' : '进行中') + '</i></div>' +
      '<div class="qWhere">' + q.place + ' · ' + (q.kind === 'main' ? '主线' : '支线') + '</div>' +
      steps +
      '<div class="qRew">酬：' + qRewardText(q.reward || {}) + '</div>' +
      '</div>';
  };

  const act = QUEST_IDS.filter(id => player.quests[id] && player.quests[id].st === 'active');
  const fin = QUEST_IDS.filter(id => player.quests[id] && player.quests[id].st === 'done');
  let html = '';
  if (act.length) {
    html += '<div class="qsec">进行中 ' + act.length + '</div>' + act.map(id => card(QUESTS[id])).join('');
  } else {
    html += '<div class="qsec">进行中</div><div class="qStep">还没有接任务。村里、野外、古洞前都有人在等你。</div>';
  }
  if (fin.length) html += '<div class="qsec">已了 ' + fin.length + '</div>' + fin.map(id => card(QUESTS[id])).join('');
  const relics = Object.keys(player.relics || {}).filter(k => player.relics[k] > 0);
  if (relics.length) {
    html += '<div class="qsec">信物</div>' + relics.map(k =>
      '<div class="qStep">· ' + relicName(k) + '　<span style="color:#8A8268">' +
      ((QUEST_ITEMS[k] || {}).note || '') + '</span></div>').join('');
  }
  body.innerHTML = html;
}
function toggleQuests(force) {
  const show = force !== undefined ? force : questEl.classList.contains('hidden');
  questEl.classList.toggle('hidden', !show);
  if (show) renderQuests();
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
    bossKills: player.bossKills || {},
    quests: player.quests, relics: player.relics, track: player.track,
    prof: player.prof || {}, loadout: player.loadout || [],
    // 玩家手动排过装配格：读档后别再被 autoLoadout 自动补位
    loadoutManual: !!player.loadoutManual,
    mantras: player.mantras, mantrasOwned: player.mantrasOwned || {},
    // 剧情：flags / 已读节点 / 线索 / 按 type 的累计击杀。
    // 已读节点必须存 —— 不存的话读档会把"一次性的事"变成循环，
    // 玩家每次读档都要重看一遍序章。
    flags: player.flags || {}, readLog: player.readLog || {},
    clues: player.clues || {}, choices: player.choices || {},
    typeKills: player.typeKills || {},
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
    bossKills: s.bossKills || {},
    quests: s.quests || {}, relics: s.relics || {}, track: s.track || null,
    prof: s.prof || {},
    // 老存档没有 loadout：给空数组，startGame 末尾的 autoLoadout 会补满。
    // 不能直接 undefined —— 后面 castArt 会读 player.loadout[slot]。
    loadout: Array.isArray(s.loadout) && s.loadout.length === ART_SLOTS
      ? s.loadout : new Array(ART_SLOTS).fill(null),
    loadoutManual: !!s.loadoutManual,
    // 招式的临时状态不进存档：读档时带着一身增益，等于白送一段超模时间。
    artBuffs: [], forceCrit: 0, nextDmg: 0,
    // 心法：先按"已学"过滤一遍再校验装配 —— 顺序反了的话，
    // 存档里装着的某条心法只要在 ARTS 里被删过，sanitize 会连槽一起清掉。
    mantrasOwned: (() => {
      const own = {};
      const src = s.mantrasOwned || {};
      for (const id in src) {
        if (!MANTRAS[id]) continue;            // 删过的心法：静默丢弃，不抛错
        const lv = Math.max(1, Math.min(MANTRA_MAX_LV, src[id] | 0 || 1));
        own[id] = lv;
      }
      return own;
    })(),
    // 剧情：老存档没有这几样，给空对象。空 readLog 意味着序章会在读档后补播一次 ——
    // 这是好事（P7 之前的档也该看到序章），而且只播一次。
    flags: s.flags || {}, readLog: s.readLog || {},
    clues: s.clues || {}, choices: s.choices || {}, typeKills: s.typeKills || {},
  });
  player.mantras = mantraSanitize(s.mantras, player.mantrasOwned);
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
  clearHazards();   // 地面危险区不属于上面任何一类，忘了清就会跨局残留
  clearArts();      // 飞剑环绕的 mesh 也不属于上面任何一类
  mantraResetCombat();   // 追命连击 / 藏锋层数 / 铁衣层数：跨局残留会让玩家一出生就带着 +40%
  storyReset();          // 剧情播放器状态 + boot 闸门：重开一局序章要能再播
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
      rootT: 0, bossKills: {}, quests: {}, relics: {}, track: null,
      prof: {}, loadout: new Array(ART_SLOTS).fill(null),
      loadoutManual: false,
      artBuffs: [], forceCrit: 0, nextDmg: 0,
      mantras: { main: null, sub: [null, null] }, mantrasOwned: {},
      flags: {}, readLog: {}, clues: {}, choices: {}, typeKills: {},
    });
    invalidateStats();
  }
  autoLoadout();
  checkMantraUnlocks();   // 老存档读进来时补发：这条心法的条件可能早就满足了
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
  renderInv(); renderSkills(); renderQuests(); renderArts();
  // 序章：玩家一睁眼就在土地庙里，没有"走进去"这回事 —— 只能在这里手动放一次。
  // 读档时 readLog 里已经有它，storyReady 会挡掉，所以不会每局都重播。
  storyOnBoot();
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
  // 剧情播放中：只认"翻页"。其余键一律吞掉 ——
  // 否则玩家一边读一边往前走、一边放招，回来发现自己已经死了。
  if (storyPlaying()) {
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter' ||
      e.code === 'KeyE' || e.code === 'Escape') storyNext();
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
  if (e.code === 'KeyB') toggleQuests();   // 任务簿。L 已经被剑舞占了
  if (e.code === 'KeyF') meditate();
  if (e.code === 'KeyE') interact();
  if (e.code === 'Tab' || e.code === 'KeyI') { if (state === 'play') toggleInv(); }
  if (e.code === 'Escape') { toggleInv(false); forgeClose(); toggleSkills(false); toggleQuests(false); shopClose(); talkClose(); }
  if (e.code === 'KeyM') { AUDIO.enabled = !AUDIO.enabled; msg(AUDIO.enabled ? '音效开' : '音效关', C.paper2); }
  // 招式：数字键 1~6。刻意不用 J/K/L/H —— 那四个是"人人都有"的动作，
  // 招式是跟着兵器走的，混在同一片键区会让人以为换兵器它们也会变。
  const num = /^Digit([1-6])$/.exec(e.code);
  if (num) castArt(+num[1] - 1);
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
  // 死的时候如果正放着万剑归宗，飞剑的 mesh 会留在场上 —— update 在非 play 状态
  // 不再跑 updateArts，它们就永远停在那儿不消失。
  clearArts();
  mantraResetCombat();
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
document.getElementById('btnQuestClose').onclick = () => toggleQuests(false);
// 剧情覆盖层整块都能点：读的人手指落在哪都行，不该逼他去瞄准一个"继续"按钮。
const storyBox = document.getElementById('story');
if (storyBox) storyBox.onclick = () => storyNext();
document.getElementById('btnCont').disabled = !(localStorage.getItem(SAVE_KEY) || localStorage.getItem(LEGACY_KEYS[0]));

// 技能栏点击（画布上直接点技能格）
let skillRects = [];
// 招式栏的命中矩形，点击用
let artRects = [];
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
  for (const r of artRects) {
    if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
      castArt(r.i);
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

// ============ 首领招式引擎 ============
// 五个新首领不各写一套 if/else，而是共用"招式表（monsters.js 的 skills）+ 效果分派"。
// 以后加一个首领，只要在 monsters.js 里写 skills，这里一行都不用动。
//
// 六种效果覆盖了所有需要：
//   slam   以自身为圆心的范围重击（断竹横扫 / 灼翼 / 拔刀斩）
//   zone   在玩家脚下放一片危险区（毒雾 / 陷阱 / 地裂）
//   rain   在玩家周围撒一片危险区（落石 / 火雨）
//   summon 召唤小怪（唤傀 / 唤石 / 分身 / 镜像）
//   bind   定身（缠身）
//   fan    扇形弹幕（弩箭齐射 / 剑气）

const hazards = [];   // 地面危险区：预警圈 → 引爆 / 持续伤害

function addHazard(x, y, o) {
  const h = {
    x, y, r: o.r || 34, delay: o.delay || 0, life: o.life || 0,
    dmg: o.dmg || 8, tick: o.tick || 0.8,
    t: 0, hitT: 0, fired: false, didHit: false, dead: false,
    color: o.color || C.red2,
  };
  // 不用精灵贴图：RING_C 是 12px 的点阵，放大到 60px 就散成一圈碎方块，
  // 玩家读不出"这是范围"。改成在 overlay 上用 arc 画，边缘干净，缩放也随意。
  hazards.push(h);
  return h;
}
function clearHazards() {
  hazards.length = 0;
}
function updateHazards(dt) {
  for (let i = hazards.length - 1; i >= 0; i--) {
    const h = hazards[i];
    h.t += dt;
    const inside = () => Math.hypot(player.x - h.x, player.y - h.y) < h.r;
    if (h.life > 0) {
      // 持续区（毒雾 / 火海）
      if (!h.fired) {
        if (h.t < h.delay) continue;
        h.fired = true; h.hitT = 0.2;
        burst(h.x, h.y, h.color, 10, 70);
      }
      h.hitT -= dt;
      if (h.hitT <= 0) { if (inside()) hurtPlayer(h.dmg * 0.55); h.hitT = h.tick; }
      if (h.t > h.delay + h.life) h.dead = true;
    } else {
      // 一次性（落石 / 地裂 / 陷阱）
      if (!h.fired) {
        if (h.t < h.delay) continue;
        h.fired = true;
        burst(h.x, h.y, h.color, 14, 95);
        shakeX += 2; shakeY += 2;
        if (inside()) hurtPlayer(h.dmg);
      }
      if (h.t > h.delay + 0.3) h.dead = true;
    }
    if (h.dead) hazards.splice(i, 1);
  }
}

function execSkill(e, sk) {
  const dx = player.x - e.x, dy = player.y - e.y, d = Math.hypot(dx, dy) || 1;
  const base = e.dmg * (sk.dmg || 1);
  // 没挂 art / weapon 的旧首领招式，走原来的白+红，行为一字不变。
  const cols = bossArtColors(sk, [C.paper1, C.red2]);
  switch (sk.fx) {
    case 'slam': {
      shakeX += 6; shakeY += 6;
      burst(e.x, e.y - 8, cols[0], 20, 130);
      burst(e.x, e.y - 8, cols[1] || C.red2, 12, 100);
      slashGhosts.push({
        x: e.x, y: e.y - 8, a0: 0, a1: Math.PI * 2,
        R: (sk.r || 70) * 0.9, colors: cols, t: 0.3, max: 0.3,
      });
      if (Math.hypot(player.x - e.x, player.y - e.y) < (sk.r || 70)) hurtPlayer(base);
      break;
    }
    case 'zone': {
      const n = sk.count || 1;
      for (let i = 0; i < n; i++) {
        const a = n === 1 ? 0 : (i / n) * Math.PI * 2 + Math.random();
        const rr = n === 1 ? 0 : 42 + Math.random() * 26;
        addHazard(player.x + Math.cos(a) * rr, player.y + Math.sin(a) * rr, {
          r: sk.r, delay: sk.delay || 0.8, life: sk.life || 0, dmg: base, color: sk.color,
        });
      }
      break;
    }
    case 'rain': {
      const n = sk.count || 3;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, rr = Math.random() * (sk.spreadR || 92);
        addHazard(player.x + Math.cos(a) * rr, player.y + Math.sin(a) * rr, {
          r: sk.r, delay: (sk.delay || 0.8) + i * 0.09, dmg: base, color: sk.color,
        });
      }
      break;
    }
    case 'summon': {
      const n = sk.count || 1;
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2 + Math.random();
        const ex = e.x + Math.cos(a) * 38, ey = e.y + Math.sin(a) * 28;
        if (!canStand(ex, ey)) continue;
        const s = spawnEnemy(sk.kind, ex, ey, e.camp || { x: e.x, y: e.y });
        if (s) { s.aggro = true; s.combatT = 4; burst(ex, ey - 6, C.pur2, 9, 60); }
      }
      break;
    }
    case 'bind': {
      if (d < (sk.range || 120)) {
        player.rootT = Math.max(player.rootT, sk.bind || 1.2);
        hurtPlayer(base);
        msg('被缠住了！', C.jade3);
      }
      break;
    }
    case 'fan': {
      const n = sk.count || 3, spread = sk.spread || 0.4;
      const a0 = Math.atan2(dy, dx);
      for (let i = 0; i < n; i++) {
        const a = a0 + (i - (n - 1) / 2) * spread;
        const mesh = quad(FIRE_TEX, 7, 7);
        if (sk.art || sk.weapon) mesh.material.color.set(cols[0]);
        projectiles.push({
          x: e.x, y: e.y - 6, vx: Math.cos(a) * (sk.speed || 150), vy: Math.sin(a) * (sk.speed || 150),
          t: 2.2, mesh, dmg: base,
        });
      }
      break;
    }
  }
}

// 无面剑客：血量三段，每段换一件兵器。
// 设计文档要的是「每阶段换一种兵器」，不是新写一套 AI —— runBossSkills 只认
// 「当前这张招式表」，换段就是把表换掉并重置各自的冷却。
// 刻意不直接调 execArt()：那是玩家侧逻辑，读 player.x/y、player.qi、
// player.loadout，打到的是 enemies。让首领调它等于用玩家的属性打玩家自己。
// 复用的是 arts.js 的「招式身份」：sk.art 指回玩家招式并取色彩签名来染色，
// 终章那句「招式和你一模一样」因此有数据依据，不只是台词。
function wumianPhase(e) {
  const r = e.hp / (e.maxHp || 1);
  if (r <= 0.34) return 2;
  if (r <= 0.67) return 1;
  return 0;
}
function bossSkillsOf(e) {
  const m = MONSTERS[e.type];
  if (!m) return null;
  const ph = m.phases;
  if (!ph) return m.skills || null;
  const i = wumianPhase(e);
  if (e.wmPhase !== i) {
    const first = e.wmPhase === undefined;
    e.wmPhase = i;
    e.skillCds = null;      // 表换了，旧冷却的下标就作废
    e.skill = null;         // 抬手抬到一半也作废，别把上一阶段的招放出来
    e.skillGap = 0.8;      // 换兵器那一瞬给玩家半口气
    if (!first) {
      const p = ph[i];
      const W = WEAPONS[p.weapon];
      msg(m.name + ' · ' + p.name + '　换「' + p.label + '」', C.red3);
      AUDIO.play('boss');
      burst(e.x, e.y - 10, W && W.trail ? W.trail[0] : C.red2, 22, 130);
    }
  }
  return ph[e.wmPhase].skills;
}
// 色彩签名：优先招式自带色，其次兵器家族色，最后退回调用方给的旧色。
function bossArtColors(sk, fallback) {
  const W = sk.weapon && WEAPONS[sk.weapon];
  const trail = W && W.trail ? W.trail : fallback;
  const a = sk.art ? artById(sk.art) : null;
  return (a ? artColor(a, trail) : trail) || fallback;
}

function runBossSkills(e, dt, d) {
  const m = MONSTERS[e.type];
  const skills = bossSkillsOf(e);
  if (!skills) return false;
  if (e.skill) {
    // 抬手：站在原地震一下，给玩家反应时间。手抬完了才真正放。
    e.skillT -= dt;
    if (e.skillT <= 0) { execSkill(e, e.skill); e.skill = null; }
    return true;
  }
  // 每个招式各自计冷却。
  // 以前只有一个全局 skillCd，而挑选逻辑是"遍历到第一个条件成立的"——
  // 结果青鳞蟒永远只放排在最前面的缠身，毒雾与横扫一次都见不到。
  // 分开计时 + 在可放的里面随机挑，招式表才真的是一张表。
  if (!e.skillCds) e.skillCds = skills.map(() => 1.6 + Math.random() * 1.6);
  for (let i = 0; i < e.skillCds.length; i++) if (e.skillCds[i] > 0) e.skillCds[i] -= dt;
  if (e.skillGap > 0) { e.skillGap -= dt; return false; }

  const hpR = e.hp / e.maxHp;
  const ready = [];
  for (let i = 0; i < skills.length; i++) {
    const sk = skills[i];
    if ((e.skillCds[i] || 0) > 0) continue;
    if (sk.range && d > sk.range) continue;
    if (sk.hpBelow && hpR > sk.hpBelow) continue;
    ready.push(i);
  }
  if (!ready.length) return false;
  const i = ready[(Math.random() * ready.length) | 0];
  const sk = skills[i];
  e.skill = sk; e.skillT = sk.windup;
  e.skillCds[i] = sk.cd * (0.85 + Math.random() * 0.3);
  e.skillGap = 0.7 + Math.random() * 0.5;
  msg(m.name + ' · ' + sk.name, C.red3);
  AUDIO.play('boss');
  return true;
}

// HUD 追踪条：只显示一条当前目标。
// 显示两条以上就没人看了 —— 玩家在野外只想知道"我现在该去哪"。
function drawQuestTracker() {
  const id = player.track && player.quests[player.track] && player.quests[player.track].st === 'active'
    ? player.track
    : QUEST_IDS.find(k => player.quests[k] && player.quests[k].st === 'active');
  if (!id) return;
  const q = QUESTS[id], s = player.quests[id];
  const o = q.steps[s.step];
  if (!o) return;
  const ready = s.step >= q.steps.length;
  const x = 110, y = 42;
  const line2 = ready ? '回去复命' : objText(o, s.prog);
  // 底衬：HUD 左上是压在野地上的，纯文字在浅色草地上根本读不出来
  octx.font = 'bold 9px monospace';
  const w = Math.max(octx.measureText('▸ ' + q.title).width, octx.measureText(line2).width);
  octx.fillStyle = 'rgba(10,12,18,0.46)';
  octx.fillRect(x - 4, y - 3, w + 8, 23);
  octx.textAlign = 'left';
  octx.fillStyle = C.black;
  octx.fillText('▸ ' + q.title, x + 1, y + 1);
  octx.fillStyle = ready ? C.jade3 : C.paper2;
  octx.fillText('▸ ' + q.title, x, y);
  octx.font = '9px monospace';
  octx.fillStyle = C.black;
  octx.fillText(line2, x + 1, y + 11);
  octx.fillStyle = ready ? C.gold3 : C.paper1;
  octx.fillText(line2, x, y + 10);
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
  // 剧情播放时整个世界暂停。读碑的时候被山魈咬死，是这游戏最不该发生的事；
  // 而且剧情里有"回头看了一眼来路"这种叙述，人还在走就对不上了。
  if (storyPlaying()) return;

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
  // 火在顿帧时也照烧 —— 打起来不该把「火要灭了」这件事暂停掉。
  updateDgFire(dt);
  // 任务：reach / dg / item / have 四种目标每帧现算，kill 与 talk 走事件
  questTick(dt);
  // 剧情：同样每帧扫全表。节点只有十几个，全表扫比维护事件订阅简单得多，
  // 也不会出现"某个钩子忘了调用导致某条剧情永远不播"这种最难查的 bug。
  storyScan();

  if (hitstop > 0) { hitstop -= dt; tickSwing(dt); return; }

  player.atkCd -= dt; player.atkT -= dt; player.dashT -= dt;
  player.dashCd -= dt; player.flash -= dt; player.iframe -= dt; player.windCd -= dt;
  player.hurtFlash = Math.max(0, player.hurtFlash - dt);
  // P10 的三个"动作余韵"计时：锤离手 / 锤插地 / 收招前倾
  player.throwHide = Math.max(0, (player.throwHide || 0) - dt);
  player.plantT = Math.max(0, (player.plantT || 0) - dt);
  player.holdT = Math.max(0, (player.holdT || 0) - dt);
  comboPulse = Math.max(0, comboPulse - dt * 4);
  if (player.atkCd <= 0) player.atkBuf -= dt;
  skills.qi.cd -= dt; skills.wu.cd -= dt; skills.thunder.cd -= dt; wuT -= dt;
  // 招式冷却 + 持续段（旋转 / 飞剑 / 连闪）统一在这里走
  updateArts(dt);
  // 心法的时间累积段：藏锋蓄层 / 追命窗口 / 铁衣过期 / 归元回血
  updateMantras(dt);
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
  // 缠身：被青鳞蟒缠住时动不了。只锁位移，不锁出招 —— 全锁会让人以为卡了。
  if (player.rootT > 0) { player.rootT -= dt; player.moving = false; mx = 0; my = 0; }
  if (player.moving) {
    if (Math.abs(mx) >= Math.abs(my)) player.dir = mx > 0 ? 'right' : 'left';
    else player.dir = my > 0 ? 'down' : 'up';
    const len = Math.hypot(mx, my); mx /= len; my /= len;
    const sp = 76 * (1 + Math.min(40, stats().spd + artBuff('spd')) / 100) *
      (player.dashT > 0 ? 2.7 : 1) * stickAmp;
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

  // 地面危险区：预警圈要先于敌人结算，玩家才能"看着圈躲"，而不是挨完打才看见圈
  updateHazards(dt);

  // ---- 敌手 ----
  const playerSafe = inVillage(player.x, player.y, 6);
  const eFree = (x, y) => canStand(x, y) && !inVillage(x, y, 0);
  for (const e of enemies) {
    if (e.dead) continue;
    const m = MONSTERS[e.type];
    e.cd -= dt; e.flash -= dt; e.anim += dt; e.hitJit -= dt; e.stagger -= dt;
    if (e.combatT > 0) e.combatT -= dt;
    // 状态先结算：中毒 / 流血可能在上一帧就把这只怪耗死了，
    // 接着往下跑会看到"尸体还在追人"。
    tickEnemyStatus(e, dt);
    if (e.dead) continue;
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
    // —— 作息 ——
    // 夜行的正午睡（一天里只有"白昼"这一档算白天），昼行的子时睡。
    // 睡着的不动、不主动咬人，但打它算偷袭（×1.5）—— 玩家可以专门挑时辰摸营。
    const phaseId = clock.phase.id;
    let asleep = NOCTURNAL[e.type] ? (phaseId === 'wu')
      : (DIURNAL[e.type] ? (phaseId === 'zi') : false);
    // 被打醒之后要清醒一阵子 —— 否则下一帧按时辰又睡回去，
    // 玩家会看到"刚砍了一刀，它倒头又睡了"，偷袭变成无限连。
    if (e.wakeT > 0) { e.wakeT -= dt; asleep = false; }
    if (asleep !== e.sleep) {
      e.sleep = asleep;
      if (!asleep) e.pauseT = 0.3 + Math.random() * 0.5;
    }
    // 青云集是安全区：踏进城墙便不再被盯上，追到墙根的也会散去
    if (playerSafe) e.aggro = false;
    else if (!e.sleep && d < m.aggro && !e.aggro) { e.aggro = true; shout(e); }
    // 追丢了就回营：以前只有"离营地 190px"一个条件，被吹哨叫醒的怪会永远挂着 aggro，
    // 玩家跑出半张地图它还站在原地待机，等他一回来立刻又扑上来。
    if (!e.dg && d > 200) e.aggro = false;
    if (dc > 190 && !e.dg) e.aggro = false;   // 洞里的怪没有后方可退
    // 万一有东西已经落在村里（老存档／瞬移残留），送回它的营地
    if (inVillage(e.x, e.y, 0)) {
      burst(e.x, e.y - 6, C.pur2, 12, 80);
      e.x = campPos.x; e.y = campPos.y; e.aggro = false;
    }
    if (e.stagger > 0 || e.sleep || e.freezeT > 0 || e.stunT > 0 || e.launchT > 0) {
      // 受击僵直 / 睡着 / 冻结 / 眩晕 / 被挑在空中：不移动不出手，但呼吸还是要有的
      e.mesh.material.map = monTex[e.type].frames[e.sleep ? 0 : 0];
      e.mesh.position.set(e.x, e.y - e.h / 2 - (e.launchZ || 0), 0);
      // 颜色按"最先能看出区别的"给：冻结偏青、眩晕偏金，睡着压暗
      if (e.freezeT > 0) e.mesh.material.color.setRGB(0.55, 0.85, 1);
      else if (e.stunT > 0) e.mesh.material.color.setRGB(1, 0.92, 0.45);
      else if (e.sleep) e.mesh.material.color.setRGB(0.62, 0.66, 0.78);
      else e.mesh.material.color.setRGB(1, 1, 1);
      continue;
    }
    let vx = 0, vy = 0;
    // 减速：只改速度，不改"要不要追" —— 减速的怪会继续追，只是追不上
    let speed = m.speed * (e.aggro ? 1 : 0.45) * (1 - (e.slowPct || 0));

    // 首领招式：施法中不走位，但血条、贴图、影子照常更新。
    // 洞里也要能放招 —— 无面剑客是第三层真正的洞主，只会平砍就白瞎了。
    const casting = (e.boss && e.aggro) ? runBossSkills(e, dt, d) : false;

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

    if (casting) { vx = 0; vy = 0; }
    else if (!e.aggro) {
      if (e.huntCd > 0) e.huntCd -= dt;
      // —— 食物链 ——
      // 掠食者去追猎物，猎物掉头就跑。只在"没在打架"的时候演这一段 ——
      // 玩家一插手，它们就各自归位。做成追逃而不是真的互相残杀：
      // 真打起来营地会被自己吃空，玩家回来只看到一地尸体，反而更没生气。
      let acted = false;
      if (PREY_OF[e.type]) {
        if (e.hunt && (e.hunt.dead || Math.hypot(e.hunt.x - e.x, e.hunt.y - e.y) > 130)) e.hunt = null;
        if (!e.hunt && e.huntCd <= 0) {
          for (const o of enemies) {
            if (o.dead || o === e || o.aggro || o.sleep) continue;
            if (PREY_OF[e.type].indexOf(o.type) < 0) continue;
            if (Math.hypot(o.x - e.x, o.y - e.y) > 88) continue;
            e.hunt = o; o.panicT = 1.8; e.huntCd = 7 + Math.random() * 5;
            break;
          }
        }
        if (e.hunt) {
          const hx = e.hunt.x - e.x, hy = e.hunt.y - e.y, hd = Math.hypot(hx, hy) || 1;
          if (hd > 15) { vx = hx / hd * 0.8; vy = hy / hd * 0.8; }
          acted = true;
        }
      }
      if (!acted && e.panicT > 0) {
        e.panicT -= dt;
        const ax = e.x - campPos.x, ay = e.y - campPos.y, ad = Math.hypot(ax, ay) || 1;
        vx = ax / ad * 0.95; vy = ay / ad * 0.95;
        acted = true;
      }
      if (!acted) {
        if (e.route && e.route.length) {
          // 巡逻：走到点 → 停一下 → 下一个点。停的那一下很关键，
          // 不停的话整队怪会像传送带一样匀速绕圈，一眼假。
          const tgt = e.route[e.ri];
          const rx = tgt.x - e.x, ry = tgt.y - e.y, rd = Math.hypot(rx, ry) || 1;
          if (rd < 9) { e.ri = (e.ri + 1) % e.route.length; e.pauseT = 0.5 + Math.random() * 1.5; }
          if (e.pauseT > 0) e.pauseT -= dt;
          else { vx = rx / rd * 0.62; vy = ry / rd * 0.62; }
        } else {
          e.wanderT -= dt;
          if (e.wanderT <= 0) {
            e.wanderT = 1 + Math.random() * 1.5;
            const a = Math.random() * Math.PI * 2;
            e.wx = Math.cos(a); e.wy = Math.sin(a);
            if (Math.random() < 0.4) { e.wx = 0; e.wy = 0; }
          }
          vx = e.wx * 0.4; vy = e.wy * 0.4;
        }
        if (dc > 130) { vx = (campPos.x - e.x) / dc; vy = (campPos.y - e.y) / dc; }
      }
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
      // 撞墙也炸：三珠连爆的"触地各炸一小片"含这一种
      if (p.friendly) projSplash(p, null);
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
          const dealt = hitEnemy(e, {
            dmg: p.dmg, crit, pierceDef: (p.art && p.art.pierceDef) || 0,
            basic: p.basic,   // 普攻弹体带挥击编号；招式弹体没有
          }, ang, 8);
          // 弹体挂的状态（毒镖）在命中那一刻才生效 —— 不能一出手就撒毒，
          // 那样打空也中毒，读不出"这一镖中了"。
          if (p.art) afterArtHit(e, p.art, dealt, ang);
          // 溅射：命中点周围炸一小片（次要目标不再重复吃主目标的伤害）
          if (p.art && p.art.splash) projSplash(p, e);
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
        // 这里原来写的是 e.y - b.h / 2 —— bolt 对象根本没有 h 字段，
        // 于是 e.y - undefined/2 = NaN，NaN < r 恒为 false，天雷诀一发都打不中人。
        // 这个 bug 从 S1 就存在，直到 P5 给天雷引写自检才被抓出来。
        if (Math.hypot(e.x - b.x, e.y - e.h / 2 - b.y) < b.r + e.h * 0.3) {
          const ang = Math.atan2(e.y - e.h / 2 - b.y, e.x - b.x);
          const dealt = hitEnemy(e, {
            dmg: b.dmg, crit: Math.random() * 100 < stats().crit,
            pierceDef: (b.art && b.art.pierceDef) || 0,
          }, ang, 10);
          // 招式落雷挂状态 / 击飞（雷链、剑雨这类）
          if (b.art) afterArtHit(e, b.art, dealt, ang);
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

  // delay：还没轮到它出现（地裂的四段依次裂开）。等的时候不扣寿命，
  // 否则"晚出来的那一段"一出生就只剩半条命。
  for (const g of slashGhosts) { if (g.delay > 0) { g.delay -= dt; continue; } g.t -= dt; }
  slashGhosts = slashGhosts.filter(g => g.t > 0 || g.delay > 0);

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
//
// P10：加 ease 与六种新动作。ease 不写就是原来的 out 曲线 ——
// 普攻和另外 56 招一个像素都不动，这是"只加不改"的前提。
function swingAng(sw, base, p) {
  const q = Math.max(0, Math.min(1, p));
  let e;
  if (sw.ease === 'in') e = Math.pow(q, 2.4);                    // 慢蓄猛落
  else if (sw.ease === 'both') e = q < 0.5 ? 2 * q * q : 1 - Math.pow(-2 * q + 2, 2) / 2;
  else e = 1 - Math.pow(1 - q, 2.2);                             // 快起慢收（原样）
  if (sw.mode === 'ring') return { ang: base - Math.PI * 1.1 + e * Math.PI * 2.2, off: 0, cast: false };
  if (sw.mode === 'thrust') return { ang: base, off: e * 9, cast: false };
  if (sw.mode === 'cast') return { ang: base - 0.62 + e * 0.42, off: e * 3, cast: true };
  const sweep = { ang: base + sw.a0 + (sw.a1 - sw.a0) * e };
  // 过顶下砸 / 砸地：从身后上方扫到身前，同时**先回拉再前送** ——
  // "举起"和"落下"两拍都在，才看得出这一锤有重量。
  if (sw.mode === 'overhead' || sw.mode === 'overheadBig' || sw.mode === 'slam' || sw.mode === 'slamLow') {
    const big = sw.mode === 'overheadBig' ? 1.6 : 1;
    return { ang: sweep.ang, off: -3.5 * big * (1 - e) + 7 * big * e * e, cast: false };
  }
  // 横抡：起手在身体的**另一侧**（a0 为正，落在下方），扫回正前。
  // 方向轴是左右，不是上下 —— 这是它和「碎骨锤」唯一但足够清楚的区别。
  if (sw.mode === 'sideSwing') return { ang: sweep.ang, off: 2.5 * e - 1.5, cast: false };
  // 抛出：手臂前甩一下，锤就离手了（锤的贴图在 boomerangs 那条通道里画）
  if (sw.mode === 'throw') return { ang: sweep.ang, off: e * 4, cast: false };
  // 插地：锤往下沉，之后不跟手（立在地上的那把单独画）
  if (sw.mode === 'plant') return { ang: sweep.ang, off: -e * 3, cast: false };
  // 冲锋：锤端在正前方不动，动的是人
  if (sw.mode === 'charge') return { ang: base + sw.a0, off: e * 10, cast: false };
  // P11：七件兵器的八种新动作。角度仍走 sweep，差的是武器位移与身体姿态 ——
  // 起手慢的招在 0.15 息时刚抬起来，跟快招自然错开，连拍八张不会重样。
  if (sw.mode === 'lunge') return { ang: sweep.ang, off: e * 12, cast: false };
  if (sw.mode === 'flick') return { ang: sweep.ang, off: e * 2.5, cast: false };
  if (sw.mode === 'sweepLow') return { ang: sweep.ang, off: -2 + e * 3, cast: false };
  if (sw.mode === 'reverse') return { ang: sweep.ang + Math.PI * 0.55, off: -e * 2, cast: false };
  if (sw.mode === 'guard') return { ang: sweep.ang, off: -e * 4, cast: true };
  if (sw.mode === 'channel') return { ang: sweep.ang, off: -e * 6, cast: true };
  if (sw.mode === 'leap') return { ang: sweep.ang, off: -e * 9, cast: false };
  if (sw.mode === 'spin') return { ang: sweep.ang + e * Math.PI, off: 0, cast: false };
  return { ang: sweep.ang, off: 0, cast: false };
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

  // P10：锤离手时手上是空的；锤插地时它立在脚边、不跟手。
  // 这两种状态以前不存在 —— 因为此前没有任何一招会让武器离开手。
  if (player.throwHide > 0 || player.plantT > 0) {
    if (player.plantT > 0) {
      // 插在地上的锤：锤头朝上、微微后仰；护体时锤面有一层薄光
      drawWeaponAt(octx, cv, px + 8, py + 7, -Math.PI / 2 - 0.10, 1, HELD_SCALE * 1.15);
      drawRareAura(octx, px + 8, py - 7, 6, W.trail[0], 0.40 + Math.sin(time * 6) * 0.18, time, 0);
    }
    return;
  }

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
  } else if (player.holdT > 0) {
    // 收招保持（地裂落地后的前倾）：人不动，武器停在落点上 —— 收招空档也是重量
    ang = base + 0.80;
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

// 招式增益条：名字 + 剩余息数。
// 限时增益不写出来，玩家会以为"没生效"—— 尤其「淬毒」「铁壁」这种
// 改变的是"手感"的，玩家更难察觉少了它。
function drawBuffHud() {
  if (touch.enabled) return;
  if (!player.artBuffs || !player.artBuffs.length) return;
  octx.font = 'bold 9px SimSun';
  octx.textAlign = 'right';
  octx.textBaseline = 'top';
  let y = LH - 82;
  for (const b of player.artBuffs) {
    const txt = b.name + ' ' + Math.ceil(b.t);
    octx.fillStyle = 'rgba(10,12,18,0.5)';
    octx.fillRect(LW - 6 - octx.measureText(txt).width - 3, y - 1, octx.measureText(txt).width + 6, 11);
    octx.fillStyle = C.gold3;
    octx.fillText(txt, LW - 6, y);
    y += 11;
  }
  octx.textAlign = 'left';
}

// 招式栏：独立一排，画在主技能栏上方。
// 不塞进主栏的原因 —— 主栏是"人人都有的动作"（普攻/气/舞/雷/闪/丹），
// 招式是"跟着兵器走的"，混在一排会让玩家以为换个兵器那几个键也会跟着变。
function drawArtBar() {
  if (touch.enabled) { artRects = []; return; }
  const size = 20, gap = 3;
  const x0 = Math.round(LW / 2 - (ART_SLOTS * (size + gap) - gap) / 2);
  const y0 = LH - 44 - size - 6;
  artRects = [];
  for (let i = 0; i < ART_SLOTS; i++) {
    const x = x0 + i * (size + gap), y = y0;
    const id = player.loadout[i];
    const a = id ? artById(id) : null;
    const ready = a && a.fam === weaponFam() && artUnlocked(profKills(a.fam), a);
    artRects.push({ i, x, y, w: size, h: size });
    octx.fillStyle = C.black; octx.fillRect(x, y, size, size);
    octx.fillStyle = a ? (ready ? C.ink2 : C.ink1) : 'rgba(20,24,34,0.55)';
    octx.fillRect(x + 1, y + 1, size - 2, size - 2);
    octx.strokeStyle = a ? (ready ? C.gold1 : C.ink3) : 'rgba(120,110,90,0.5)';
    octx.lineWidth = 1;
    octx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
    if (a) {
      octx.globalAlpha = ready ? 1 : 0.35;
      octx.font = 'bold 11px monospace';
      octx.textBaseline = 'middle'; octx.textAlign = 'center';
      octx.fillStyle = a.slot === 'special' ? C.gold3 : C.paper3;
      octx.fillText(a.name[0], x + size / 2, y + size / 2 + 1);
      octx.textAlign = 'left'; octx.textBaseline = 'top';
      octx.globalAlpha = 1;
      const cd = Math.max(0, artCdOf(id));
      if (cd > 0) {
        const max = Math.max(0.01, artMaxOf(a));
        octx.globalAlpha = 0.72; octx.fillStyle = C.ink1;
        octx.fillRect(x + 1, y + 1, size - 2, Math.round((size - 2) * Math.min(1, cd / max)));
        octx.globalAlpha = 1;
        if (cd >= 0.15) {
          octx.font = 'bold 8px monospace'; octx.fillStyle = C.paper3;
          octx.textAlign = 'center';
          octx.fillText(cd.toFixed(0), x + size / 2, y + size / 2 - 3);
          octx.textAlign = 'left';
        }
      }
    }
    // 键位画在格子上方 —— 下方是主技能栏，字母会被压掉
    octx.font = 'bold 8px monospace'; octx.fillStyle = a ? C.gold3 : C.ink3;
    octx.fillText(ART_KEYS[i], x + (size - octx.measureText(ART_KEYS[i]).width) / 2, y - 9);
  }
}

// 藏锋的层数 / 追命的连击数必须看得见 —— 看不见的层数等于没有层数。
// 只画这两个：其余主心法都是"打出去就知道生效"的，HUD 上再加东西只会更挤。
function drawMantraHud() {
  if (touch.enabled) return;
  const id = mantraMain();
  let n = 0, max = 0, col = C.gold3, label = '';
  if (id === 'cangfeng') { n = player.mCang || 0; max = MAIN.cangfeng.params.max; label = '锋'; }
  else if (id === 'zhuiming' && (player.mChainN || 0) > 0) { n = player.mChainN; max = 9; col = C.red3; label = '追'; }
  else return;
  const size = 20, gap = 3;
  const x0 = Math.round(LW / 2 - (ART_SLOTS * (size + gap) - gap) / 2);
  const y = LH - 44 - size - 6 - 15;
  octx.font = 'bold 9px monospace';
  octx.fillStyle = col;
  octx.fillText(label, x0 - 13, y + 1);
  for (let i = 0; i < max; i++) {
    octx.fillStyle = i < n ? col : 'rgba(120,110,90,0.42)';
    octx.fillRect(x0 + i * 9, y + 2, 7, 6);
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
    octx.fillStyle = c.lord ? C.gold3 : (c.tier === 2 ? C.red2 : C.paper1);
    octx.fillRect(mx + c.x * sx - 1, my + c.y * sy - 1, 3, 3);
  }
  // 精英 / 首领
  for (const e of enemies) {
    if (e.dead) continue;
    if (e.boss) {
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

// 爆点：一击落在一个点上的表现（碎骨锤 / 震地中心 / 裂缝节点）。
// 径向渐变 + 白芯，读作"砸出来的坑"，而不是一块色斑。
function drawDotFx(ctx, x, y, R, colors, alpha) {
  const r = Math.max(1, R);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.9);
  g.addColorStop(0, rgba(C.white, 0.85 * alpha));
  g.addColorStop(0.35, rgba(colors[0], 0.60 * alpha));
  g.addColorStop(1, rgba(colors[0], 0));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r * 1.9, 0, 6.28); ctx.fill();
  ctx.restore();
}

// 一道有方向的刃光（纵向巨劈 / 裂缝 / 尘线）：中段最亮、两端收细。
function drawLineFx(ctx, x, y, ln, colors, alpha) {
  const len = ln.len || 20, w = ln.w || 1.5;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(Math.round(x), Math.round(y));
  ctx.rotate(ln.ang || 0);
  const g = ctx.createLinearGradient(0, 0, len, 0);
  g.addColorStop(0, rgba(colors[0], 0.12 * alpha));
  g.addColorStop(0.5, rgba(colors[0], 0.70 * alpha));
  g.addColorStop(1, rgba(C.white, 0.85 * alpha));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, -w * 0.7);
  ctx.lineTo(len * 0.80, -w * 2.0);
  ctx.lineTo(len, 0);
  ctx.lineTo(len * 0.80, w * 2.0);
  ctx.lineTo(0, w * 0.7);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = rgba(C.white, 0.72 * alpha);
  ctx.fillRect(len * 0.15, -w * 0.35, len * 0.85, w * 0.7);
  ctx.restore();
}

function drawOverlay(camX, camY) {
  octx.clearRect(0, 0, LW, LH);
  octx.imageSmoothingEnabled = false;
  const s = stats();

  // ---- 世界层特效 ----
  for (const g of slashGhosts) {
    if (g.delay > 0) continue;
    const a = Math.max(0, g.t / g.max);
    if (g.frames) {
      // 序列帧按 ghost 的淡出进度推进：t/max 从 1 走到 0，帧号从 0 走到最后一帧。
      const k = Math.min(g.frames.length - 1,
        Math.max(0, Math.floor((1 - a) * g.frames.length)));
      const im = g.frames[k];
      if (im && im.complete && im.naturalWidth) {
        const w = im.naturalWidth * (g.scale || 1), h = im.naturalHeight * (g.scale || 1);
        octx.save();
        octx.globalAlpha = Math.min(1, a * 1.6);
        octx.translate(g.x - camX, g.y - camY);
        if (g.rotate) octx.rotate(g.base || 0);
        octx.drawImage(im, -w / 2, -h / 2, w, h);
        octx.restore();
      }
      continue;
    }
    if (g.ring) {
      // grow：从 r0 长到 r1（冲击波 / 扩散环）；否则是原来"由外收拢"的收势
      const R = g.grow ? g.grow[0] + (g.grow[1] - g.grow[0]) * (1 - a) : g.R * (1.4 - a * 0.4);
      drawRingFx(octx, g.x - camX, g.y - camY, R, g.colors, a, 1);
    }
    else if (g.thrust) drawThrustFx(octx, g.x - camX, g.y - camY, g.thrust, g.len, g.colors, a * 0.9, 1);
    else if (g.dot) drawDotFx(octx, g.x - camX, g.y - camY, g.dot * (0.5 + a * 0.8), g.colors, a);
    else if (g.line) drawLineFx(octx, g.x - camX, g.y - camY, g.line, g.colors, a);
    else drawArcFx(octx, g.x - camX, g.y - camY, g.a0, g.a1, g.R, g.colors, a * 0.9, 1);
  }
  // 冲击波的波前：按**真实半径**画，所以看得见它往外走
  for (const w of waves) {
    const a = Math.max(0, 1 - w.r / w.max);
    drawRingFx(octx, w.x - camX, w.y - camY, w.r, w.col, a * 0.9, 1);
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

  // 地面危险区：外圈往内收 = 快炸了，收完那一下就是伤害落点。
  // 持续区（毒雾）引爆后留一团脉动的色块，玩家能看出"这块地还在伤人"。
  for (const h of hazards) {
    const x = Math.round(h.x - camX), y = Math.round(h.y - camY);
    const k = h.fired ? 1 : Math.min(1, h.t / Math.max(0.01, h.delay));
    octx.save();
    if (!h.fired) {
      const rr = h.r * (1 + (1 - k) * 0.45);
      octx.globalAlpha = 0.30 + k * 0.55;
      octx.strokeStyle = h.color; octx.lineWidth = 2;
      octx.beginPath(); octx.arc(x, y, rr, 0, Math.PI * 2); octx.stroke();
      octx.globalAlpha = 0.10 + k * 0.20;
      octx.fillStyle = h.color;
      octx.beginPath(); octx.arc(x, y, h.r, 0, Math.PI * 2); octx.fill();
    } else {
      octx.globalAlpha = h.life > 0 ? 0.30 + Math.sin(time * 9) * 0.10 : 0.55;
      octx.fillStyle = h.color;
      octx.beginPath(); octx.arc(x, y, h.r, 0, Math.PI * 2); octx.fill();
      octx.globalAlpha = 0.85;
      octx.strokeStyle = h.color; octx.lineWidth = 2;
      octx.beginPath(); octx.arc(x, y, h.r, 0, Math.PI * 2); octx.stroke();
    }
    octx.restore();
  }

  // 玩家招式留下的地面区域：青玉 / 金色，和首领的红色预警圈一眼分得开。
  // 收圈 = 快结束了；陷阱（once）画成一圈小三角钉。
  for (const z of zones) {
    const x = Math.round(z.x - camX), y = Math.round(z.y - camY);
    const k = Math.min(1, z.t / Math.max(0.1, z.max));
    octx.save();
    if (z.once) {
      octx.globalAlpha = 0.45 + Math.sin(time * 10) * 0.25;
      octx.strokeStyle = z.color; octx.lineWidth = 1;
      octx.beginPath(); octx.arc(x, y, z.r, 0, Math.PI * 2); octx.stroke();
      octx.globalAlpha = 0.55;
      octx.fillStyle = z.color;
      octx.fillRect(x - 1, y - 1, 2, 2);
    } else {
      octx.globalAlpha = 0.13 + Math.sin(time * 7) * 0.04;
      octx.fillStyle = z.color;
      octx.beginPath(); octx.arc(x, y, z.r, 0, Math.PI * 2); octx.fill();
      octx.globalAlpha = 0.40 + k * 0.35;
      octx.strokeStyle = z.color; octx.lineWidth = 1.5;
      octx.beginPath(); octx.arc(x, y, z.r * (0.72 + 0.28 * k), 0, Math.PI * 2); octx.stroke();
    }
    octx.restore();
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
  drawQuestTracker();

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
  drawArtBar();
  drawBuffHud();
  drawMantraHud();
  drawSkillBar();

  const nearForge = nearTemple();
  const sid = nearShop();
  if (!touch.enabled) {
    const potions = player.inv.filter(i => i.kind === 'potion').length;
    octx.font = 'bold 9px monospace';
    octx.fillStyle = C.jade3; octx.fillText('丹药×' + potions, 8, LH - 14);
    // 走近谁就说谁的事：一条提示轮着写"E 铁匠台 / E 云来客栈 / R 御风"，
    // 比堆三行固定文案更像"脚下有东西等着你按"。
    let hint = 'R 御风', hot = false, sub = 'T 道行  B 任务  Tab 行囊';
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
      else if (nearEnvText()) { hint = 'E 读' + nearEnvText().t.name; hot = true; }
      else if (nearNotice()) { hint = 'E 告示牌'; hot = true; }
      else if (nearSeal()) { hint = 'E 封碑（未启）'; hot = true; }
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
    if (e.dead || !e.boss) return false;
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
    octx.fillText(b.labelFn ? b.labelFn() : b.label, b.x, b.y + 1);
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
  artOverrides: {
    apply: applyArtOverrides, importText: importOverrides, clear: clearOverrides,
    count: overrideCount, read: readOverrides, dump: exportOverrides, key: OVERRIDE_KEY,
  },
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
  get torch() { return player.torch; },
  get dgGustT() { return dgGustT; }, set dgGustT(v) { dgGustT = v; },
  TORCH_FUEL, BRAZIER_FUEL,
  nearBrazier, dgRelight, douseBrazier, douseBraziersNear, updateDgFire,
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
  MAPW, MAPH, CH1_H, SPAWN, camps, dens, WEAPONS, WEAPON_IDS, MONSTERS, NODES, SLOTS,
  get solid() { return solid; }, REGION,
  get objects() { return objects; },
  get hazards() { return hazards; }, addHazard, clearHazards, UNIQUES, makeUnique,
  killEnemy, execSkill, runBossSkills, bossSkillsOf, wumianPhase, bossArtColors,
  QUESTS, QUEST_IDS, QUEST_ITEMS, WANDERERS, ALL_TALKERS, NPCS,
  questAccept, questTurnIn, questReady, questOffered, questTurnInAt, questOnKill, questOnTalk,
  turnInLines, beginTurnIn, advanceTurnIn, endTurnIn,
  get turnInState() {
    return turnInSeq ? {
      i: turnInI, n: turnInSeq.length, host: turnInHost,
      who: turnInSeq[turnInI].who, text: turnInSeq[turnInI].text,
    } : null;
  },
  refreshSeal, tripleState, relicName, renderQuests, toggleQuests,
  get sealOn() { return sealOn; },
  get talkers() { return ALL_TALKERS; },
  // 招式 / 专精
  ARTS, ART_IDS, ART_SLOTS, ART_KEYS, ART_FX, ART_SLOT_LABEL, PROF_MAX,
  artById, artsOfWeapon, artUnlocked, unlockedArts, profLevel, profLeft, profFrac, artBrief, artPower,
  artShape, artPose, artColor, ART_SHAPES, ART_POSES, ART_SNDS, swingAng,
  castArt, execArt, updateArts, clearArts, autoLoadout, addProf, applyStatus, afterArtHit,
  renderArts, showArtPage, artMaxOf, artCdOf,
  get artCds() { return artCds; },
  get artPageOn() { return artPageOn; },
  // 装配不再有"选中的格子"这个状态，所以也不再导出 artPick。
  // artSlotClick 是"点格子 = 卸下"，artPlace 的第二个参数是拖拽落点。
  artSlotClick, artPlace,
  profKills,
  // 增益 / 地面区域：自检要能直接看状态，P6 的十种原语全靠它们
  artBuff, artBuffActive, dealDot,
  get artBuffs() { return player.artBuffs; },
  get zones() { return zones; },
  // P10 的两条新通道：抛出去还没回来的兵器 / 还在往外扩的冲击波
  get boomerangs() { return boomerangs; },
  get waves() { return waves; },
  setLoadout(ids) {
    player.loadout = new Array(ART_SLOTS).fill(null);
    (ids || []).slice(0, ART_SLOTS).forEach((id, i) => { player.loadout[i] = id; });
    player.loadoutManual = true;
    return player.loadout.slice();
  },
  // 心法
  MAIN, SUB, MANTRAS, MAIN_IDS, SUB_IDS, MANTRA_IDS, MANTRA_MAX_LV, SUB_SLOTS,
  mantraById, isMain, mantraMod, mainOf, lvOf, mantraBrief, mantraCondMet,
  learnMantra, checkMantraUnlocks, upgradeMantra, toggleMantra, renderMantras,
  showInvPage, buyMantra, mantraMain, mantraParam, mantraDmgMul, mantraResetCombat,
  updateMantras, resetOneCd, mantraOnCast, mantraOnHit, mantraHurtMul, mantraOnDodge,
  hitEnemy, hurtPlayer, rollDamage, attackInterval,
  get mantraPageOn() { return invPageOn; },
  // 剧情
  STORY, STORY_IDS, POI, ACTS, CLUES, CLUE_IDS, ENV_TEXTS, ENV_IDS,
  NPC_LAYERS, NPC_LINES, storyByAct, npcLayer, npcLines, storyReady, storyHint,
  storyPlay, storyNext, storyPlaying, storyScan, storyReset, renderStoryLog,
  storyChoose, storyPickGo,
  nearEnvText, envRead,
  get storyCur() { return storyCur; },
  get storyIdx() { return storyIdx; },
  // 正在等选择的那一屏（没有选择时为 null）。自检要能看见"它确实拦住了点屏幕"。
  get storyChoice() { return storyChoice; },
  // 当前这一句的完整文本（打字机还没吐完时也拿得到全句）
  get storyText() { return storyFull; },
  // 测试用：直接把剧情播完（不用等打字机）
  finishStory() {
    let guard = 0;
    // 停在选择那一屏 —— 这一屏必须点名选一条，不能替玩家选。
    // 自动选等于给"结局"设了个默认值，而这段设计的全部意义是没有默认值。
    while (storyCur && !storyChoice && guard++ < 200) {
      if (storyShown < storyFull.length) { storyShown = storyFull.length; storyLineEl.textContent = storyFull; }
      else storyNext();
    }
    return { playing: !!storyCur, guard, choice: storyChoice ? storyChoice.prompt : null };
  },
  setFlag(id, v) { player.flags[id] = v === false ? 0 : 1; return player.flags; },
  setRelic(id, n) { player.relics[id] = n || 1; return player.relics; },
  get mantraMods() { return mantraMod(player.mantras, player.mantrasOwned); },
  // 测试用：直接设定装配 / 已学，绕过 UI
  setMantras(main, subs) {
    player.mantras = { main: main || null, sub: (subs || [null, null]).slice(0, SUB_SLOTS) };
    while (player.mantras.sub.length < SUB_SLOTS) player.mantras.sub.push(null);
    for (const id of [main].concat(player.mantras.sub)) {
      if (id && MANTRAS[id]) player.mantrasOwned[id] = player.mantrasOwned[id] || 1;
    }
    invalidateStats();
    player.hp = Math.min(player.hp, maxHp());
    player.qi = Math.min(player.qi, maxQi());
    return player.mantras;
  },
  // 平衡脚本用：只清战斗状态，不重建世界。
  // 每组组合都 startGame 一次的话要重铺全图 90 只怪，200 组跑下来光重建就十几秒。
  resetCombat() {
    combo = 0; comboT = 0; comboPulse = 0; hitstop = 0; shakeX = 0; shakeY = 0;
    player.atkCd = 0; player.atkT = 0; player.swing = null; player.dashT = 0;
    player.iframe = 0; player.shield = 0; player.drunkT = 0; player.drunk = 0;
    player.hp = maxHp(); player.qi = maxQi();
    for (const e of enemies) { scene.remove(e.mesh); if (e.ring) scene.remove(e.ring); if (e.shadow) scene.remove(e.shadow); }
    enemies.length = 0;
    for (const p of projectiles) scene.remove(p.mesh);
    projectiles.length = 0; drops.length = 0; dmgNums.length = 0;
    particles.length = 0; sparks.length = 0; ghosts.length = 0;
    slashGhosts.length = 0; bolts.length = 0; messages.length = 0;
    zones.length = 0;
    clearArts(); mantraResetCombat();
    for (const k in skills) skills[k].cd = 0;
    // 把野怪刷新推远：平衡脚本一组要跑 8 秒，200 组就是 26 分钟的游戏时间，
    // 野怪会源源不断刷出来被 AOE 打死 → 升级 → atkBase 一路涨，
    // 后半个循环的数据比前半段高出七成，分布根本不能用。
    spawnT = 9999; eliteT = 9999;
    return true;
  },
  addStatusTo(e, st, dmg) { applyStatus(e, st, dmg); },
  // 测试用：清场 / 放木桩 / 直接换兵器
  clearEnemies() {
    for (const e of enemies) { scene.remove(e.mesh); if (e.ring) scene.remove(e.ring); if (e.shadow) scene.remove(e.shadow); }
    enemies.length = 0;
  },
  spawnDummy(x, y, hp) {
    const e = spawnEnemy('zhiren', x, y, null);
    if (!e) return null;
    e.maxHp = e.hp = hp || 99999;
    e.cd = 9999; e.aggro = false; e.wakeT = 9999; e.def = 0; e.def0 = 0;
    return e;
  },
  equipFam(fam, r) {
    const it = makeGear('weapon', r === undefined ? 3 : r, Math.max(1, player.level), Math.random, fam);
    player.equip.weapon = it;
    invalidateStats(); autoLoadout(); renderArts();
    return it;
  },
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
  // 平衡脚本用：只推进逻辑，不渲染。tick() 每次都带一遍 WebGL + overlay 绘制，
  // 200 组组合 × 6 秒会把测试拖到好几分钟。
  tickLogic(dt) { update(dt); },
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
