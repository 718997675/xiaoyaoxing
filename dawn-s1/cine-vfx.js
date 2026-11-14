/* cine-vfx.js · 招式「演武层」v2 —— 80 招模板驱动
 *
 * v1 是给 sword_1 手写的 34 帧样板；v2 把那套五段节奏抽成模板，
 * 由每招「已有的唯一签名」驱动，量产出 80 招互不重样的演出。
 *
 * 三层不重样保障：
 *   1) 骨架 skeleton：按 fx 归四类（slash / pierce / aura / step），结构完全不同
 *   2) 家族 fam：10 类兵器各有主形、辅形、色偏，不是只换颜色
 *   3) 专属签名层：每招的 shapeSpec 原子（17 类 + 参数）单独画一层，模板不共用
 * 档位 tier：prof 1-4 克制 / 5-8 标准 / 10 爆发，避免 80 招全屏白闪。
 *
 * 三种运行方式共用同一份帧数据：
 *   浏览器经典脚本 / game.js 空导入 / Node require
 * 数据来自 cine-catalog.js（自动生成）与 cine-tuning.js（单招手调覆盖层）。
 * 本文件不写 import/export，所以三种环境都不会炸。
 */
(function () {
  'use strict';

  // ---- 24 色锁定板（与 pixel.js 的 C 逐字一致） ----
  var PAL = {
    ink1: '#12161F', ink2: '#2A3140', ink3: '#4A5568',
    paper1: '#8A8268', paper2: '#C9BFA3', paper3: '#E8DFC8',
    jade1: '#2F6E6A', jade2: '#5FA8A0', jade3: '#9BD4CC',
    red1: '#7A2420', red2: '#C8453B', red3: '#E8806F',
    gold1: '#8A6520', gold2: '#D9A441', gold3: '#F2D089',
    pur1: '#4A3A6B', pur2: '#8A6FC4', pur3: '#C0A8E0',
    black: '#000000', white: '#FFFFFF',
  };

  var W = 320, H = 180, FPS = 30;
  var CX = 104, CY = 138, GY = CY;
  var TX = CX + 78, TY = CY - 30;
  var DEFAULT_ART = 'sword_1';

  // ---- 游戏内贴合参数（「人物跟招式分离」的真正根因在这里）----
  // 演武层是 320×180 的舞台：小人约 50px 高，手在脚上方 28px，突进 70px。
  // 游戏真人是 pMesh = quad(..., 16, 18)，中心在 (player.x, player.y-8)，
  // 手在「中心 + (4,2)」，也就是脚上方 6px；招式 reach 只有 40。
  // 早期直接 1:1 贴上去 → 刀光从人头顶约 20px 处发出、飞出去 78px，
  // 看起来当然像「人和招式是两套东西」。这里做一次相似变换统一尺度与锚点。
  var GAME_SCALE = 0.48;             // 70px 演武突进 → 34px，略小于 reach 40
  var GAME_RAY_KEEP = 0.55;          // 1px 放射速度线只留 55%，避免整屏飞白线
  var GAME_RAY_MIN = 24;             // 短于 24px 的线是主刃/碎屑，不裁
  var HX = CX + 8, HY = CY - 28;     // 演武层 forward=0 时的手部锚点
  var GAME_HAND = [4, 2];            // 游戏真人：手相对精灵中心的偏移（朝右基准）
  var GAME_Y_OFF = 0;                // 垂直补偿已并入 gamePrims，drawOverlay 不再额外平移

  // ---- 十类兵器的视觉语言：主形 / 辅形 / 色偏 ----
  // ang = 出手基准角偏移：锤下劈、杖上引、枪平推，构图先分家再谈配色
  var FAMILY = {
    sword:  { motif: 'lance', dim: PAL.jade2,  accent: PAL.gold3, arcs: 2, trails: 3, ang: -0.10, sub: '直刃三叠' },
    blade:  { motif: 'arc',   dim: PAL.gold1,  accent: PAL.red3,  arcs: 3, trails: 1, ang: -0.28, sub: '大弧重斩' },
    spear:  { motif: 'lance', dim: PAL.paper1, accent: PAL.white, arcs: 0, trails: 2, ang:  0.18, sub: '一线突贯' },
    staff:  { motif: 'sigil', dim: PAL.pur1,   accent: PAL.pur3,  arcs: 2, trails: 0, ang: -0.80, sub: '法阵光柱' },
    dual:   { motif: 'cross', dim: PAL.jade1,  accent: PAL.jade3, arcs: 2, trails: 2, ang: -0.44, sub: '双刃交叉' },
    hammer: { motif: 'shock', dim: PAL.gold1,  accent: PAL.red2,  arcs: 0, trails: 0, ang:  0.46, sub: '地裂冲击' },
    mage:   { motif: 'sigil', dim: PAL.pur1,   accent: PAL.pur3,  arcs: 2, trails: 0, ang: -0.66, sub: '符箓星芒' },
    dart:   { motif: 'fan',   dim: PAL.paper1, accent: PAL.white, arcs: 0, trails: 4, ang:  0.10, sub: '扇面飞针' },
    chain:  { motif: 'hook',  dim: PAL.jade1,  accent: PAL.jade2, arcs: 1, trails: 2, ang: -0.60, sub: '钩折锁链' },
    fan:    { motif: 'fan',   dim: PAL.gold1,  accent: PAL.gold3, arcs: 2, trails: 2, ang: -0.18, sub: '扇面风刃' },
  };
  var PALETTES = {
    auto: null,
    gold:  { bright: PAL.gold3, mid: PAL.gold2, dim: PAL.gold1, accent: PAL.gold3 },
    jade:  { bright: PAL.paper3, mid: PAL.jade3, dim: PAL.jade2, accent: PAL.jade3 },
    purple:{ bright: PAL.pur3, mid: PAL.pur2, dim: PAL.pur1, accent: PAL.pur3 },
    red:   { bright: PAL.red3, mid: PAL.red2, dim: PAL.red1, accent: PAL.red3 },
    ice:   { bright: PAL.white, mid: PAL.paper3, dim: PAL.jade2, accent: PAL.jade3 },
    earth: { bright: PAL.gold2, mid: PAL.paper1, dim: PAL.ink3, accent: PAL.red2 },
  };

  // 档位：普通招克制、压轴招爆发。len 即总帧数。
  var TIER = {
    calm:     { len: 26, layers: 3, ghost: 2, dust: 4, trails: 1, sparks: 8,  cross: false, wave: false, alpha: 0.82, boost: 0.85, name: '克制' },
    standard: { len: 30, layers: 4, ghost: 3, dust: 5, trails: 2, sparks: 11, cross: true,  wave: false, alpha: 0.92, boost: 0.95, name: '标准' },
    burst:    { len: 34, layers: 5, ghost: 3, dust: 6, trails: 3, sparks: 14, cross: true,  wave: true,  alpha: 1.00, boost: 1.00, name: '爆发' },
  };
  // 五段比例按 34 帧样板反推，缩放后 burst 档与 v1 逐帧一致
  var STAGE_RATIO = [5 / 34, 10 / 34, 14 / 34, 22 / 34, 1];
  var STAGE_META = [
    { id: 'wind',    name: '起手', note: '沉肩后引 · 气点内收' },
    { id: 'charge',   name: '蓄势', note: '签名凝形 · 地纹开裂' },
    { id: 'slash',    name: '发力', note: '突进残影 · 五阶亮芯' },
    { id: 'chase',    name: '追击', note: '专属签名层 · 碎屑飞散' },
    { id: 'recover',  name: '收势', note: '余辉渐隐 · 可续招窗口' },
  ];

  var DIFF = [
    { pain: '重复度高', old: '单一 arc 原语，80 招共享 17 类原子', now: '四骨架 × 十家族签名 × 每招独立 shapeSpec 专属层' },
    { pain: '效果不明显', old: '两阶米白，一道 3px 线，7 帧淡出', now: '白芯→亮→中→暗→墨边五阶，最厚 13px + 光晕' },
    { pain: '人物动作不帅', old: '静态剪影，只有武器角度插值', now: '五段姿态 + 披风 + 残影 + 位移 + 1px 轮廓光' },
    { pain: '技能不够连贯', old: '1~8 帧有刀光，其余二十多帧静止', now: '26~34 帧无空档：气点→蓄形→发力→追击→余辉' },
  ];

  // ---- 图元构造 ----
  function q(g, k, o) { o.g = g; o.k = k; if (o.a === undefined) o.a = 1; return o; }
  var R = function (g, x, y, w, h, c, a) { return q(g, 'rect', { x: x, y: y, w: w, h: h, c: c, a: a }); };
  var L = function (g, x, y, x2, y2, w, c, a) { return q(g, 'line', { x: x, y: y, x2: x2, y2: y2, w: w, c: c, a: a }); };
  var A = function (g, x, y, r, a0, a1, w, c, a) { return q(g, 'arc', { x: x, y: y, r: r, a0: a0, a1: a1, w: w, c: c, a: a }); };
  var D = function (g, x, y, r, c, a) { return q(g, 'disc', { x: x, y: y, r: r, c: c, a: a }); };
  var O = function (g, x, y, r, w, c, a) { return q(g, 'ring', { x: x, y: y, r: r, w: w, c: c, a: a }); };
  var G = function (g, x, y, r, c, a) { return q(g, 'glow', { x: x, y: y, r: r, c: c, a: a }); };

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function mix(a, b, t) { return a + (b - a) * t; }
  function seg(f, s, e) { return clamp((f - s) / Math.max(1, e - s), 0, 1); }
  // 覆盖层里写了数字就用覆盖层的，否则走模板推导
  function ovNum(s, key, def) { return typeof s[key] === 'number' ? s[key] : def; }
  function rnd(i, salt, seed) {
    var v = Math.sin((i + 1) * 12.9898 + (salt || 0) * 78.233 + (seed || 0) * 0.000137) * 43758.5453;
    return v - Math.floor(v);
  }
  var rgbCache = {};
  function rgb(hex) {
    if (rgbCache[hex]) return rgbCache[hex];
    var n = parseInt(hex.slice(1), 16);
    return (rgbCache[hex] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]);
  }
  // ---- 目录 / 覆盖层 ----
  function catalog() { return (typeof globalThis !== 'undefined' && globalThis.CINE_CATALOG) || null; }
  function tuning() { return (typeof globalThis !== 'undefined' && globalThis.CINE_TUNING) || null; }
  // rhythm 为 5 段权重：每招节奏不同，起手/蓄势/发力/追击/收势的长短不再共用一套。
  function stagesFor(len, rhythm) {
    var out = [], s = 0, acc = 0, i, ratios = [];
    if (rhythm) { for (i = 0; i < 5; i++) { acc += rhythm[i]; ratios.push(acc); } }
    else ratios = STAGE_RATIO;
    for (i = 0; i < STAGE_META.length; i++) {
      var e = i === STAGE_META.length - 1 ? len - 1
        : clamp(Math.max(s, Math.round(len * ratios[i]) - 1), s, len - 2);
      out.push({ id: STAGE_META[i].id, name: STAGE_META[i].name, note: STAGE_META[i].note, s: s, e: e });
      s = e + 1;
    }
    return out;
  }
  function paletteOf(s) {
    var p = (s.palette && PALETTES[s.palette]) || (typeof s.palette === 'object' ? s.palette : null);
    var f = FAMILY[s.fam] || FAMILY.sword;
    if (p) return { core: PAL.white, bright: p.bright, mid: p.mid, dim: p.dim, accent: p.accent, rim: PAL.ink3 };
    // 严格用 24 色板：bright/mid 直接用招式自带的两个色（80 组全不同），
    // 不自己插值出新色 —— 白芯 + 家族 accent 已经足够把暗系招式点亮。
    return {
      core: PAL.white,
      bright: s.color[0],
      mid: s.color[1],
      dim: f.dim,
      accent: f.accent,
      rim: PAL.ink3,
    };
  }
  var specCache = {};
  function invalidate() { specCache = {}; }
  function specOf(id) {
    var cat = catalog(), base = cat && cat.arts && cat.arts[id];
    if (!base) return null;
    var tu = tuning(), ov = tu && tu.arts && tu.arts[id];
    if (!ov && specCache[id]) return specCache[id];
    var s = {}, k;
    for (k in base) s[k] = base[k];
    if (ov) for (k in ov) s[k] = ov[k];
    s.pal = paletteOf(s);
    // 复制一份档位参数：单招调 len / glow 时不能改到共享的 TIER 表
    s.t = Object.assign({}, TIER[s.tier] || TIER.calm);
    if (typeof s.len === 'number') s.t.len = clamp(s.len | 0, 12, 60);
    if (typeof s.glow === 'number') s.t.alpha = clamp(s.glow, 0.2, 1.4);
    s.famDef = FAMILY[s.fam] || FAMILY.sword;
    // 每招独立的招式基因：主刃拓扑 / 命中字形 / 五段节奏 / 动作曲线。
    // 颜色只负责上色，不再承担「区分招式」的职责。
    s.dna = dnaOf(s);
    s.stages = stagesFor(s.t.len, s.dna.rhythm);
    // 每招独立构图：主刃起点 / 角度 / 长度 / 弧半径 / 命中点全部按种子偏移。
    // 只换形状不换位置的话，同家族两招的命中帧会有八成图元重合（实测 spear_1/spear_3 0.818）。
    s.jit = {
      ox: (rnd(1, 41, s.seed) - 0.5) * 12,
      oy: (rnd(2, 43, s.seed) - 0.5) * 10,
      ang: (rnd(3, 47, s.seed) - 0.5) * 0.46,
      len: (rnd(4, 53, s.seed) - 0.5) * 20,
      arcR: (rnd(7, 67, s.seed) - 0.5) * 16,
      hitX: (rnd(5, 59, s.seed) - 0.5) * 26,
      hitY: (rnd(6, 61, s.seed) - 0.5) * 18,
    };
    s.tx = TX + s.jit.hitX;
    s.ty = TY + s.jit.hitY;
    if (!ov) specCache[id] = s;
    return s;
  }
  // 单招开关：cine-tuning.js 里写 { "某招": { enabled:false } } 就退回游戏原本的刀光。
  // game.js 只认这一个入口，避免每个调用点都去翻目录表。
  function enabled(id) {
    var tu = tuning(), ov = tu && tu.arts && tu.arts[id];
    if (ov && ov.enabled === false) return false;
    return !!specOf(id);
  }
  function list() {
    var cat = catalog(); if (!cat) return [];
    return Object.keys(cat.arts).map(function (id) {
      var s = specOf(id);
      return { id: id, name: s.name, fam: s.fam, fx: s.fx, slot: s.slot, prof: s.prof,
               tier: s.tier, skeleton: s.skeleton, shapeK: s.shapeK, len: s.t.len };
    });
  }
  function total(id) { var s = specOf(id); return s ? s.t.len : 34; }
  function stages(id) { var s = specOf(id); return s ? s.stages : stagesFor(34); }
  function stageOf(s, f) {
    for (var i = 0; i < s.stages.length; i++) if (f >= s.stages[i].s && f <= s.stages[i].e) return s.stages[i];
    return s.stages[s.stages.length - 1];
  }

  // ---- 背景（两版共用） ----
  function bg() {
    var p = [];
    p.push(R('bg', 0, 0, W, H, PAL.ink1));
    p.push(R('bg', 0, GY - 42, 62, 42, PAL.ink2, 0.45));
    p.push(R('bg', 52, GY - 30, 74, 30, PAL.ink2, 0.32));
    p.push(R('bg', 196, GY - 36, 68, 36, PAL.ink2, 0.45));
    p.push(R('bg', 258, GY - 26, 62, 26, PAL.ink2, 0.32));
    p.push(R('bg', 0, GY, W, H - GY, PAL.ink2));
    p.push(R('bg', 0, GY, W, 1, PAL.ink3, 0.75));
    for (var x = 0; x < W; x += 32) p.push(R('bg', x, GY + 1, 1, H - GY, PAL.ink3, 0.42));
    for (var y = GY + 10; y < H; y += 12) p.push(R('bg', 0, y, W, 1, PAL.ink3, 0.24));
    return p;
  }

  // ---- 旧版忠实复刻：静态矩形剪影 + 一道 3px 弧 + 6~8 帧淡出 ----
  function legacyHero(p, ang, col) {
    var base = CY - 10;
    p.push(R('hero', CX - 7, base - 34, 14, 30, PAL.ink3));
    p.push(R('hero', CX - 6, base - 50, 12, 12, PAL.paper2));
    p.push(R('hero', CX - 9, base - 4, 7, 14, PAL.ink2));
    p.push(R('hero', CX + 2, base - 4, 7, 14, PAL.ink2));
    var hx = CX, hy = base - 24, len = 46;
    p.push(L('hero', hx, hy, hx + Math.cos(ang) * len, hy + Math.sin(ang) * len, 4, col));
    p.push(R('hero', hx + Math.cos(ang) * len - 3, hy + Math.sin(ang) * len - 3, 6, 6, PAL.paper2));
  }
  function legacyFrame(s, f) {
    var p = bg();
    var po = s.pose || { a0: -2.45, a1: -0.95, dur: 0.28, ease: 'out' };
    var n = Math.max(2, Math.round((po.dur || 0.28) * FPS));
    var t = seg(f, 0, n);
    var e = po.ease === 'in' ? Math.pow(t, 2.4)
      : po.ease === 'both' ? (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
        : 1 - Math.pow(1 - t, 2.2);
    var ang = mix(po.a0 || 0, po.a1 || 0, e);
    legacyHero(p, ang, s.color[0]);
    // 基线：artSwingFx 的 ghost 寿命 0.2~0.26 秒 ≈ 7 帧，没有 timeline 时从第 1 帧起
    if (f >= 1 && f <= 8) {
      var k = (f - 1) / 7, alpha = 1 - k * 0.75;
      var sx = CX + Math.cos(ang) * 22, sy = CY - 34 + Math.sin(ang) * 22;
      p.push(A('fx', sx, sy, Math.min(96, Math.max(24, (s.reach || 40) * 1.1)),
        ang - 0.8, ang + 0.8, 3, s.color[0], alpha));
      p.push(G('fx', sx, sy, 18, s.color[1], alpha * 0.22));
    }
    return { f: f, stage: stageOf(s, Math.min(f, s.t.len - 1)), prims: p };
  }

  // ---- 角色：每招 5 段姿态曲线 + 6 种步法，全由 DNA 派生 ----
  // 旧版只有 4 条骨架分支，同骨架的招动作完全相同（实测两两 mask 相似度 1.000）。
  var STEP_MAX = [8, -6, 2, 6, 0, 16];   // 前冲 / 后撤 / 跃起 / 旋身 / 原地 / 滑步
  function poseOf(s, f) {
    var st = stageOf(s, f), id = st.id, si = 0, q;
    for (q = 0; q < s.stages.length; q++) if (s.stages[q].id === id) si = q;
    var d = s.dna, cur = d.pose[si], nxt = d.pose[Math.min(4, si + 1)];
    var w = seg(f, st.s, st.e), stepMax = STEP_MAX[d.step];
    var p = {
      lean: mix(cur.lean, nxt.lean, w),
      crouch: mix(cur.crouch, nxt.crouch, w),
      step: mix(cur.step, nxt.step, w),
      cape: mix(cur.cape, nxt.cape, w),
      ang: mix(cur.ang, nxt.ang, w),
      forward: (id === 'slash' || id === 'chase') ? mix(1, stepMax, w) : (id === 'recover' ? stepMax * 0.3 * (1 - w) : 0),
      dust: id === 'slash' ? 1 : id === 'wind' ? w : 0.3,
      ghost: (id === 'slash' || id === 'chase') ? w : undefined,
      rise: (id === 'wind' || id === 'charge') ? d.rise * w : (id === 'slash' ? d.rise * 0.6 : 0),
      spin: d.step === 3 ? w : 0,
      weapon: d.weapon, ghostN: d.ghostN, capeLen: d.capeLen,
      stepKind: d.step, stage: id,
    };
    // 家族出手角在演武台上拉开十类兵器的构图差异；游戏内必须贴着真人朝向。
    // 法杖 -0.80 / 符箓 -0.66 / 锁链 -0.60 这类上引型招式会让方向质心停在人头顶，
    // game 模式夹到 ±0.25；sword 家族 -0.10 不受影响。
    var fa = s.famDef.ang || 0;
    p.ang += s.game ? clamp(fa, -0.25, 0.25) : fa;
    // 游戏里玩家本人不放位移，演武层若还带着前冲，特效就会画到「假人」位置。
    // 演武 hero 只是离线验收替身，game 模式把倾斜/下蹲也收住，避免身体中心飘离真人。
    if (s.game) {
      p.forward = 0; p.lean *= 0.3; p.step *= 0.45;
      p.crouch *= 0.5; p.rise *= 0.35;
    } else {
      p.forward += d.heroShift;   // 每招站位不同，动作轨迹不再叠成同一个小人
    }
    return p;
  }
  function heroSilhouette(p, x, foot, po, col, a) {
    var ln = po.lean, cr = po.crouch, st = po.step, cp = po.cape;
    var bodyTop = foot - 34 + cr;
    for (var i = 0; i < 11; i++) {
      var yy = bodyTop + 1 + i;
      var off = Math.round(ln * (1 - i / 11)) + Math.round(cp * (i / 11));
      p.push(R('hero', x - 9 + off, yy, 3 + (i > 7 ? 1 : 0), 1, col, a));
    }
    p.push(R('hero', x - 8 + Math.round(ln), bodyTop + 12, 7, 2, col, a));
    p.push(R('hero', x + 1 + Math.round(st), bodyTop + 12, 6, 2, col, a));
    for (var j = 0; j < 11; j++) {
      var by = bodyTop + j;
      p.push(R('hero', x - 5 + Math.round(ln * (1 - j / 11)), by, 10, 1, col, a));
    }
    var hy = bodyTop - 15;
    p.push(R('hero', x - 4 + Math.round(ln * 1.2), hy, 9, 8, col, a));
    p.push(R('hero', x - 2 + Math.round(ln * 1.2), hy - 3, 4, 3, col, a));
  }
  function hero(p, s, f, po) {
    var x = CX + po.forward, foot = CY - (po.rise || 0), gl = po.capeLen || 10;
    var ln = po.lean, cr = po.crouch, st = po.step, cp = po.cape, col = s.pal;
    // 影子留在地面，跃起时人才离地 —— 这是「动作不同」最直观的一层
    p.push(R('hero', x - 11, CY, Math.max(10, 22 - (po.rise || 0) * 0.7), 2, PAL.black, 0.38));
    p.push(R('hero', x - 8, CY + 2, 16, 1, PAL.black, 0.20));
    if (po.ghost !== undefined) {
      // 残影数量 / 方向 / 高低按每招步法基因变化：后撤往前留影、跃起向上留影、旋身环绕
      var gn = ovNum(s, 'ghostLen', po.ghostN || 2);
      var gdx = po.stepKind === 1 ? 7 : po.stepKind === 3 ? 4 : 6;
      for (var gi = gn; gi >= 1; gi--) {
        var ga = (0.42 - gi * 0.05) * s.t.alpha;
        if (ga <= 0.02) continue;
        var gx = x + (po.stepKind === 1 ? gi * gdx : -gi * gdx);
        var gy = foot - (po.stepKind === 2 ? gi * 2 : 0);
        heroSilhouette(p, gx, gy, po, gi === gn ? col.dim : col.accent, ga);
      }
      if (po.stepKind === 3)
        p.push(A('fx', x, foot - 18, 22, 0, Math.PI * 1.6, 2, col.accent, 0.35 * s.t.alpha));
      // 大范围柔光会让所有招都糊成一团同形状，只在旋身步法留一小圈
      if (po.stepKind === 3) p.push(G('fx', x - 2, foot - 18, 10, col.accent, 0.14 * s.t.alpha));
    }
    // 6 种互斥身体骨架：高矮胖瘦 + 部件不同，不再所有招都套同一个剪影
    var bd = s.dna.body, bh = 10 + (bd % 4) * 2, bw = 7 + (bd % 5);
    var bodyTop = foot - 22 - bh + cr;
    for (var i = 0; i < bh; i++) {
      var yy = bodyTop + i;
      var off = Math.round(ln * (1 - i / bh)) + Math.round(cp * (i / bh));
      p.push(R('hero', x - Math.round(bw / 2) - 1 + off, yy, 3 + (i > bh - 4 ? 1 : 0), 1, PAL.ink3));
      p.push(R('hero', x - Math.round(bw / 2) + off, yy, 1, 1, col.dim, 0.85));
    }
    p.push(R('hero', x - 6 + Math.round(st * 0.25), bodyTop + 12, 4, 3, PAL.ink2));
    p.push(R('hero', x + 1 + Math.round(st), bodyTop + 12, 4, 3, PAL.ink2));
    p.push(R('hero', x - 7 + Math.round(st * 0.25), bodyTop + 14, 5, 2, PAL.ink1));
    p.push(R('hero', x + 1 + Math.round(st), bodyTop + 14, 6, 2, PAL.ink1));
    for (var b = 0; b < bh; b++) {
      var by = bodyTop + b, bx = x - Math.round(bw / 2) + Math.round(ln * (1 - b / bh));
      p.push(R('hero', bx, by, bw, 1, b < 3 ? col.dim : PAL.ink3));
      p.push(R('hero', bx + 3, by, 2, 1, PAL.paper1, 0.75));
      p.push(R('hero', bx, by, 1, 1, PAL.ink1));
      p.push(R('hero', bx + bw - 1, by, 1, 1, PAL.ink1));
    }
    // 骨架专属部件：肩甲 / 双影 / 长披风 / 冠 / 展臂，六选一
    var bpart = bd % 6;
    if (bpart === 1) {
      p.push(R('hero', x - Math.round(bw / 2) - 3, bodyTop + 2, 3, 4, col.dim, 0.9));
      p.push(R('hero', x + Math.round(bw / 2), bodyTop + 2, 3, 4, col.dim, 0.9));
    } else if (bpart === 2) {
      heroSilhouette(p, x + 7, foot + 2, po, col.dim, 0.3 * s.t.alpha);
    } else if (bpart === 3) {
      p.push(R('hero', x - Math.round(bw / 2) - 4, bodyTop + 3, 2, gl + 8, col.dim, 0.55));
      p.push(R('hero', x - Math.round(bw / 2) - 6, bodyTop + 5, 2, gl + 4, col.accent, 0.3));
    } else if (bpart === 4) {
      p.push(R('hero', x - 4, bodyTop - 19, 9, 3, PAL.gold2, 0.9));
      p.push(R('hero', x - 2, bodyTop - 22, 5, 3, PAL.gold3, 0.8));
    } else if (bpart === 5) {
      p.push(L('hero', x - 2, bodyTop + 4, x - 12, bodyTop - 2, 2, col.mid, 0.8));
      p.push(L('hero', x + 2, bodyTop + 4, x + 13, bodyTop - 4, 2, col.mid, 0.8));
    }
    p.push(R('hero', x - 5 + Math.round(ln * 0.6), bodyTop + 8, 10, 1, PAL.gold2));
    var hy = bodyTop - 15, hx = x - 4 + Math.round(ln * 1.25);
    p.push(R('hero', hx, hy, 9, 8, PAL.paper2));
    p.push(R('hero', hx, hy, 9, 1, PAL.ink1));
    p.push(R('hero', hx, hy, 1, 8, PAL.ink1));
    p.push(R('hero', hx + 8, hy, 1, 8, PAL.ink1));
    p.push(R('hero', hx + 2, hy - 3, 4, 3, PAL.ink1));
    p.push(R('hero', hx + 3, hy - 4, 2, 1, PAL.gold2));
    p.push(R('hero', hx + 6, hy + 3, 1, 1, PAL.ink1));
    p.push(R('hero', hx + 1, hy + 5, 3, 1, PAL.paper3, 0.75));
    p.push(R('hero', hx + 8, hy + 1, 1, 6, PAL.paper3, 0.55));
    p.push(R('hero', hx + 1, hy, 7, 1, PAL.paper3, 0.40));
    p.push(R('hero', x + 5 + Math.round(ln * 0.7), bodyTop + 1, 1, 9, col.accent, 0.42));
    p.push(R('hero', x - 10 + Math.round(cp), bodyTop + 3, 1, gl, col.dim, 0.32));
    p.push(R('hero', x - 11 + Math.round(cp * 1.4), bodyTop + 3, 1, gl * 0.7, col.dim, 0.18));
    var shx = x + 2 + Math.round(ln * 0.7), shy = bodyTop + 3;
    var hdx = x + 8, hdy = bodyTop + 6;
    p.push(L('hero', shx, shy, hdx, hdy, 3, PAL.ink3));
    p.push(L('hero', shx, shy, hdx, hdy, 1, PAL.paper2, 0.9));
    return { hx: hdx, hy: hdy, x: x, foot: foot };
  }
  // 四种持械形态：长刃 / 短刃 / 双刃 / 链，剪影与武器轨迹都不一样
  function sword(p, s, hand, ang, bright) {
    var col = s.pal, wp = s.dna.weapon, len = wp === 1 ? 24 : wp === 2 ? 34 : 44;
    var ex = hand.hx + Math.cos(ang) * len, ey = hand.hy + Math.sin(ang) * len, i;
    if (wp === 3) {   // 链：一串分离方块，没有连续刃
      for (i = 1; i <= 7; i++) {
        var u = i / 7, cx2 = hand.hx + Math.cos(ang) * len * u,
            cy2 = hand.hy + Math.sin(ang) * len * u + Math.sin(u * 6) * 2;
        p.push(R('hero', cx2 - 2, cy2 - 2, 4, 4, i % 2 ? col.mid : col.dim, 0.9));
      }
      p.push(D('fx', ex, ey, 4, col.accent, 0.5 + bright * 0.3));
    } else {
      p.push(L('hero', hand.hx, hand.hy, ex, ey, 5, col.dim, 0.30 + bright * 0.30));
      p.push(L('hero', hand.hx, hand.hy, ex, ey, 3, col.mid));
      p.push(L('hero', hand.hx, hand.hy, ex, ey, 1, col.core, 0.85 + bright * 0.15));
      if (wp === 2) {  // 双刃：反手第二把，明显改变上半身剪影
        var a2 = ang - 0.85, bx = hand.hx + Math.cos(a2) * len * 0.8, by = hand.hy + Math.sin(a2) * len * 0.8;
        p.push(L('hero', hand.hx, hand.hy, bx, by, 3, col.mid, 0.9));
        p.push(L('hero', hand.hx, hand.hy, bx, by, 1, col.core, 0.9));
      }
      if (wp === 1)    // 短刃：宽护手
        p.push(R('hero', hand.hx + Math.cos(ang) * 6 - 2, hand.hy + Math.sin(ang) * 6 - 3, 4, 7, PAL.gold2));
      var gx = hand.hx + Math.cos(ang) * 5, gy = hand.hy + Math.sin(ang) * 5;
      p.push(L('hero', gx - Math.sin(ang) * 3, gy + Math.cos(ang) * 3,
               gx + Math.sin(ang) * 3, gy - Math.cos(ang) * 3, 2, PAL.gold2));
      if (wp === 0) p.push(G('fx', ex, ey, 6 + bright * 4, col.accent, (0.2 + bright * 0.3) * s.t.alpha));
    }
    return { ex: ex, ey: ey };
  }
  function crack(p, s, f, alpha) {
    var n = clamp(Math.floor((f - s.stages[1].s) * 1.15), 0, 13);
    for (var i = 0; i < n; i++) {
      var x0 = CX + 2 + i * 6, y0 = GY + 2 + (i % 2 ? 1 : 0);
      var jit = (rnd(i, 3, s.seed) - 0.5) * 4;
      p.push(L('fx', x0, y0, x0 + 6, y0 + jit, 1, s.pal.dim, alpha * (1 - i / 15)));
      p.push(L('fx', x0 + 2, y0 + jit * 0.5, x0 + 4, y0 + jit * 0.5 - 3, 1, PAL.ink3, alpha * 0.8));
    }
  }

  // ---- 专属签名层：把每招的 shapeSpec 原子画出来，模板不共用这一层 ----
  function motif(p, s, f, ox, oy, ang, R0, alpha) {
    var sp = s.shapeSpec || { k: 'legacy', name: s.shape };
    var c = s.pal, k = sp.k, a = alpha * s.t.alpha, i, u, n;
    var line = function (x, y, aa, len, w, col, al) {
      p.push(L('fx', x, y, x + Math.cos(aa) * len, y + Math.sin(aa) * len, w, col, al === undefined ? a : al));
    };
    var dot = function (x, y, r, col, al) { p.push(D('fx', x, y, r, col, al === undefined ? a : al)); };
    var num = function (v, d) { return v === undefined ? d : v; };
    var jit = (rnd(1, 9, s.seed) - 0.5) * 0.30;   // 同原子不同招也有细微偏角
    ang += jit;
    if (k === 'arc') {
      var wide = num(sp.wide, 1), tilt = num(sp.tilt, 0);
      p.push(A('fx', ox, oy, R0 * num(sp.r, 1), ang - wide * 0.9 + tilt, ang + wide * 0.9 + tilt, 2, c.accent, a));
      for (i = 0; i < num(sp.rays, 3); i++) line(ox, oy, ang + (i - 1) * 0.35, R0 * 0.5, 1, c.mid, a * 0.7);
    } else if (k === 'ring') {
      for (i = 0; i < num(sp.count, 1); i++) p.push(O('fx', ox, oy, R0 * 0.9 * (1 + i * 0.17), 2, c.accent, a));
      if (sp.dash) for (i = 0; i < 12; i++) line(ox, oy, ang + i / 12 * Math.PI * 2, R0 * 0.3, 1, c.mid, a * 0.8);
    } else if (k === 'lance') {
      var ln = R0 * 1.2 * num(sp.len, 1);
      line(ox, oy, ang, ln, num(sp.w, 2.2), c.core, a);
      if (sp.twin) { line(ox, oy, ang - 0.17, ln * 0.92, 2, c.mid, a * 0.8); line(ox, oy, ang + 0.17, ln * 0.92, 2, c.mid, a * 0.8); }
      dot(ox + Math.cos(ang) * ln, oy + Math.sin(ang) * ln, 4, c.accent, a);
    } else if (k === 'fan') {
      n = num(sp.n, 5); var spread = num(sp.spread, 0.9);
      for (i = 0; i < n; i++) {
        u = n === 1 ? 0.5 : i / (n - 1);
        line(ox, oy, ang + (u - 0.5) * spread * 2, R0 * num(sp.len, 1) * (0.6 + 0.4 * (1 - Math.abs(u - 0.5) * 2)), 2, c.mid, a);
      }
    } else if (k === 'cross') {
      n = num(sp.n, 2); var cs = num(sp.spread, 0.55);
      for (i = 0; i < n; i++) line(ox, oy, ang + (i - (n - 1) / 2) * cs, R0 * num(sp.len, 1), num(sp.w, 1.7), c.accent, a);
      dot(ox, oy, 4.5, c.core, a);
    } else if (k === 'sigil') {
      var sr = R0 * num(sp.r, 1) * 0.62, layers = num(sp.layers, 2), spokes = num(sp.spokes, 6);
      for (i = 0; i < layers; i++) p.push(O('fx', ox, oy, sr * (1 - i * 0.26), 1, c.accent, a));
      for (i = 0; i < spokes; i++) line(ox, oy, ang + i / spokes * Math.PI * 2, sr * 0.5, 1, c.mid, a * 0.8);
      if (sp.star) for (i = 0; i < 5; i++) line(ox, oy, ang - Math.PI / 2 + i / 5 * Math.PI * 2, sr * 0.95, 1, c.core, a);
    } else if (k === 'trail') {
      n = num(sp.n, 5);
      for (i = 0; i < n; i++) {
        u = (i + 1) / n;
        var tx = ox + Math.cos(ang) * R0 * 0.55 * u, ty = oy + Math.sin(ang) * R0 * 0.55 * u;
        line(tx, ty, ang + (i % 2 ? num(sp.spread, 0.14) : -num(sp.spread, 0.14)),
             R0 * 0.5 * num(sp.len, 1), num(sp.w, 1.2), c.mid, a);
      }
    } else if (k === 'spiral') {
      var sr2 = R0 * num(sp.r, 1) * 0.7;
      p.push(O('fx', ox, oy, sr2, 2, c.accent, a));
      p.push(A('fx', ox, oy, sr2 * num(sp.wide, 1), ang, ang + Math.PI * 2 * Math.min(num(sp.turns, 2), 3) * 0.6, 2, c.mid, a));
    } else if (k === 'rain') {
      n = num(sp.n, 4);
      for (i = 0; i < n; i++) {
        var aa = ang + i / n * Math.PI * 2, dd = R0 * 0.42 + num(sp.spacing, 20) * 0.6;
        line(ox + Math.cos(aa) * dd, oy + Math.sin(aa) * dd - 16, Math.PI / 2 + num(sp.angle, 0), num(sp.len, 22), 1.6, c.mid, a);
      }
    } else if (k === 'point') {
      var px = ox + Math.cos(ang) * R0 * 0.95, py = oy + Math.sin(ang) * R0 * 0.95;
      dot(px, py, 6, c.core, a);
      for (i = 0; i < num(sp.n, 6); i++) line(px, py, ang + i / num(sp.n, 6) * Math.PI * 2, num(sp.r, 16), 1.2, c.accent, a);
    } else if (k === 'hook') {
      var hl = R0 * num(sp.len, 1);
      line(ox, oy, ang, hl, 1.5, c.mid, a);
      line(ox + Math.cos(ang) * hl, oy + Math.sin(ang) * hl, ang + num(sp.turn, 1.95), hl * 0.42, 1.5, c.accent, a);
    } else if (k === 'crack') {
      n = num(sp.n, 4); var step = R0 * 0.42 * num(sp.step, 0.9);
      for (i = 0; i < n; i++) {
        var cx2 = ox + Math.cos(ang) * step * (i + 1), cy2 = oy + Math.sin(ang) * step * (i + 1);
        line(cx2, cy2, ang + (i % 2 ? 0.55 : -0.55), step * 0.7, 1.6, c.accent, a);
        dot(cx2, cy2, 3, c.mid, a);
      }
    } else if (k === 'shock') {
      var shR = R0 * num(sp.r, 1) * 0.85;
      p.push(O('fx', ox, oy, shR, 2, c.accent, a));
      for (i = 0; i < num(sp.count, 8); i++) line(ox, oy, ang + i / num(sp.count, 8) * Math.PI * 2, shR * 0.52, num(sp.w, 1.2), c.mid, a * 0.8);
    } else if (k === 'cleave') {
      var cl = R0 * 1.15 * num(sp.len, 1);
      line(ox, oy, ang, cl, num(sp.w, 3), c.core, a);
      for (i = 1; i <= 3; i++) {
        var qx = ox + Math.cos(ang) * cl * i / 3, qy = oy + Math.sin(ang) * cl * i / 3;
        line(qx, qy, ang + Math.PI / 2, cl * 0.16, 1.4, c.mid, a * 0.8);
      }
    } else if (k === 'boom') {
      p.push(A('fx', ox, oy, R0 * 0.92, ang - 0.55 * num(sp.wide, 1), ang + 0.55 * num(sp.wide, 1), 2, c.accent, a));
      for (i = 1; i <= 5; i++) dot(ox + Math.cos(ang) * R0 * 0.9 * i / 5, oy + Math.sin(ang) * R0 * 0.9 * i / 5, 3 - i * 0.4, c.mid, a);
    } else if (k === 'charge') {
      var chl = R0 * 1.3 * num(sp.len, 1);
      line(ox, oy, ang, chl, num(sp.w, 1.2), c.core, a);
      for (i = 1; i <= 5; i++) dot(ox + Math.cos(ang) * chl * i / 5, oy + Math.sin(ang) * chl * i / 5, 3, c.accent, a);
    } else {
      // 19 种老画法没有 spec：用 shape 名的 hash 选一种，仍保证每招不同
      var pick = s.seed % 4;   // seed 含 shape 名，保证同类里不同招拿到不同形状
      if (pick === 0) p.push(A('fx', ox, oy, R0 * 0.8, ang - 0.8, ang + 0.8, 2, c.accent, a));
      else if (pick === 1) { for (i = 0; i < 5; i++) line(ox, oy, ang + (i - 2) * 0.22, R0, 2, c.mid, a); }
      else if (pick === 2) p.push(O('fx', ox, oy, R0 * 0.7, 2, c.accent, a));
      else line(ox, oy, ang, R0 * 1.2, 3, c.core, a);
    }
  }

  // ---- 每招独立的「招式基因」v3 ----
  // 旧版 fxBurst 让 80 招共用「一条直线 + 同心弧 + 命中圈 + 大光晕」，只换颜色和微调角度；
  // 忽略颜色后两两形状相似度中位 0.707 / 最高 0.964，视觉上就是一个效果。
  // v3 从每招 seed 派生真正不同的几何拓扑：12 类主刃路径 × 每招独有控制点、
  // 10 类命中字形 × 每招独有分支/旋转/半径、5 段各自独立的动作曲线与 6 种步法。
  // 颜色从此只负责上色，不承担「区分招式」的职责。
  function h32(i, salt, seed) {
    var v = ((seed >>> 0) ^ Math.imul(i + 1, 0x9E3779B9) ^ Math.imul(salt + 1, 0x85EBCA6B)) >>> 0;
    v = Math.imul(v ^ (v >>> 16), 0x7FEB352D) >>> 0;
    v = Math.imul(v ^ (v >>> 15), 0x846CA68B) >>> 0;
    return ((v ^ (v >>> 16)) >>> 0) / 4294967296;
  }
  var PATH_N = 12, GLYPH_N = 10, STEP_N = 6;
  // 全局唯一分配：只用 seed 随机会让 6~7 招撞上同一种主刃拓扑、连命中字形也撞，
  // 实测最像的一对仍有 0.739。这里按 seed 排序后给 80 招分配两两不同的
  // 「主刃拓扑 × 命中字形」组合（12×10=120 种，够用），并让步法/持械也均匀铺开。
  var assignCache = null;
  function assignOf() {
    if (assignCache) return assignCache;
    var cat = catalog(); if (!cat) return null;
    var ids = Object.keys(cat.arts).sort(function (a, b) {
      return (cat.arts[a].seed >>> 0) - (cat.arts[b].seed >>> 0);
    });
    var map = {}, used = {}, i, k, p, g, key;
    for (i = 0; i < ids.length; i++) {
      for (k = 0; k < 240; k++) {
        p = (i + k * 5) % PATH_N;
        g = (Math.floor(i / 12) * 3 + i * 7 + k * 3) % GLYPH_N;
        key = p + ':' + g;
        if (!used[key]) { used[key] = 1; break; }
      }
      map[ids[i]] = { path: p, glyph: g, rank: i };
    }
    return (assignCache = map);
  }
  function dnaOf(s) {
    // dnaTweak 是离线去撞留下的单招旋钮：改它会重排该招的构图/姿态/主刃材质，
    // 但不碰全局唯一的 (path,glyph,segs) 分配。tools/tune-dna.js 负责选值。
    var tw = (s.dnaTweak | 0) & 15;
    var sd = (s.seed ^ Math.imul(tw + 1, 0x9E3779B9)) >>> 0;
    var H = function (i, salt) { return h32(i, salt, sd); };
    var d = {}, i, w = [], tw = 0, v;
    var A = (assignOf() || {})[s.id];
    d.path = A ? A.path : Math.floor(H(0, 11) * PATH_N);
    d.segN = 4 + Math.floor(H(1, 13) * 3);
    d.bend = (0.18 + H(2, 17) * 0.62) * (H(3, 19) < 0.5 ? -1 : 1);
    d.fanN = 3 + Math.floor(H(4, 23) * 4);
    d.spread = 0.34 + H(5, 29) * 0.92;
    d.turns = 0.7 + H(6, 31) * 1.6;
    d.waveAmp = 3 + H(7, 37) * 9;
    d.twinA = 0.24 + H(8, 41) * 0.46;
    d.hookBack = 0.45 + H(9, 43) * 0.5;
    d.glyph = A ? A.glyph : Math.floor(H(10, 47) * GLYPH_N);
    d.gArms = 3 + Math.floor(H(11, 53) * 7);
    d.gSpin = H(12, 59) * Math.PI * 2;
    d.gR = 14 + H(13, 61) * 16;
    d.step = A ? (A.rank % STEP_N) : Math.floor(H(14, 67) * STEP_N);
    d.weapon = A ? (Math.floor(A.rank / 3) % 4) : Math.floor(H(15, 71) * 4);
    d.ghostN = 1 + Math.floor(H(16, 73) * 4);
    d.capeLen = 6 + Math.floor(H(17, 79) * 12);
    d.rise = H(18, 83) * 9;
    d.leanAmp = 2 + H(19, 89) * 7;
    d.crouchAmp = 1 + H(20, 97) * 6;
    d.glowOn = H(21, 103) > 0.62;
    // 五段编排：rank 的 base-8 两位就能唯一确定一招，因此 (segs[0],segs[1]) 唯一
    // → 80 招的整段组合两两不同，不存在「所有招都跑同一套五段模板」。
    var A0 = A ? A.rank : 0, a8 = A0 % 8, b8 = Math.floor(A0 / 8) % 10;
    d.segs = [a8, b8, (a8 * 3 + b8 * 5 + 1) % 10,
              (a8 * 7 + b8 * 3 + 2) % 10, (a8 * 2 + b8 * 11 + 4) % 10];
    d.body = (A0 * 5 + 3) % 12;              // 12 种互斥骨架，避免动作剪影扎堆
    d.primacy = (A0 + tw * 3) % 6;           // 6 种主导图元类型，命中帧的主体不再全是线
    // 演武台站位错开：同骨架的两招也不能叠在同一处（游戏内 hero 不画，不影响锚点）
    d.heroShift = (H(95, 173) - 0.5) * 34;
    // 构图偏移：即便两招的段编排撞上，整体位置/尺度/每段起手点也错开，
    // 避免整招形状轨迹仍长得很像。game 模式按 0.35 收敛，不能把方向带偏。
    d.layout = {
      ox: (H(90, 149) - 0.5) * 34,
      oy: (H(91, 151) - 0.5) * 22,
      rot: (H(92, 157) - 0.5) * 0.7,
      scale: 0.78 + H(93, 163) * 0.5,
      seg: [0, 1, 2, 3, 4].map(function (k2) { return (H(94 + k2, 167) - 0.5) * 16; }),
    };
    d.rhythm = [];
    for (i = 0; i < 5; i++) { v = 0.65 + H(30 + i, 107) * 0.9; w.push(v); tw += v; }
    for (i = 0; i < 5; i++) d.rhythm.push(w[i] / tw);
    // 五段姿态各自独立：不再是「所有招共用一条 lunge 曲线」
    d.pose = [];
    for (i = 0; i < 5; i++) d.pose.push({
      lean: (H(40 + i, 109) - 0.5) * d.leanAmp * 2,
      crouch: H(50 + i, 113) * d.crouchAmp,
      step: (H(60 + i, 127) - 0.5) * 14,
      cape: (H(70 + i, 131) - 0.5) * 14,
      ang: -2.6 + H(80 + i, 137) * 3.0,
    });
    return d;
  }

  // 主刃路径：12 种拓扑，每招的段数/弯度/分支/旋转全由 DNA 决定。
  // 返回从手出发的点列，主刃沿它分段画，不再是「一条直线」。
  function bladePath(s, ox, oy, ang, L, b) {
    var d = s.dna, N = d.segN, i, u, x = ox, y = oy, step = L / N, dirs = [], pts = [[x, y]];
    for (i = 0; i < N; i++) {
      u = i / Math.max(1, N - 1);
      switch (d.path) {
        case 0:  dirs.push(0); break;                                       // 直刃
        case 1:  dirs.push(d.bend * (u - 0.15)); break;                       // 弯弧
        case 2:  dirs.push((i % 2 ? 1 : -1) * d.bend * 0.85); break;           // 锯齿折线
        case 3:  dirs.push(Math.sin(u * Math.PI * 1.7) * d.bend); break;         // S 形
        case 4:  dirs.push((u < 0.55 ? -1 : 1) * d.twinA); break;              // 分叉
        case 5:  dirs.push(0); break;                                        // 断续刺
        case 6:  dirs.push(u * Math.PI * d.turns * 0.58); break;                // 螺旋
        case 7:  dirs.push(u * Math.PI * 1.2); break;                          // 绕身环
        case 8:  dirs.push((u - 0.5) * d.spread * 0.5); break;                 // 扇形
        case 9:  dirs.push(Math.PI / 2 - ang + d.bend * 0.16); break;           // 下劈竖柱
        case 10: dirs.push(Math.sin(u * Math.PI * 3) * d.waveAmp / 20); break;   // 波浪
        default: dirs.push(u < 0.62 ? 0 : d.hookBack * Math.PI);                // 回旋镖
      }
    }
    for (i = 0; i < N; i++) {
      var a = ang + dirs[i], q = step * (1 + b * 0.12);
      x += Math.cos(a) * q; y += Math.sin(a) * q;
      pts.push([x, y]);
    }
    return pts;
  }

  // 主刃绘制：沿路径五阶亮芯 + 每招专属附加几何（这一层才是形状差异的主体）
  function drawBlade(p, s, pts, col, alpha, b) {
    var d = s.dna, i, j, o = pts[0], h = pts[pts.length - 1];
    var Ls = [[1, col.core, 1], [3, col.bright, 0.95], [6, col.mid, 0.58],
              [9, col.dim, 0.30], [13, col.dim, 0.16]];
    var layers = Math.min(s.t.layers, Ls.length);
    // 主刃材质按每招 primacy 分派：不能 80 招都拿线段当主体，
    // 否则「不单是线条」这一条永远过不了，视觉上也永远像同一个斜划。
    if (d.path !== 5) {
      for (i = 0; i < pts.length - 1; i++) {
        var A0 = pts[i], B0 = pts[i + 1];
        var mx = (A0[0] + B0[0]) / 2, my = (A0[1] + B0[1]) / 2;
        var sa = Math.atan2(B0[1] - A0[1], B0[0] - A0[0]);
        var sl = Math.hypot(B0[0] - A0[0], B0[1] - A0[1]);
        if (d.primacy === 0) {                     // 线刃：五阶亮芯
          for (j = 0; j < layers; j++)
            p.push(L('fx', A0[0], A0[1], B0[0], B0[1], Ls[j][0], Ls[j][1], Ls[j][2] * alpha));
        } else if (d.primacy === 1) {              // 弧刃：每段一枚弧
          p.push(A('fx', A0[0], A0[1], sl * 1.1, sa - 0.4, sa + 0.4, 3, col.mid, alpha));
          p.push(A('fx', A0[0], A0[1], sl * 1.1, sa - 0.4, sa + 0.4, 1, col.core, alpha));
        } else if (d.primacy === 2) {              // 环刃：一串同心环
          p.push(O('fx', mx, my, 4 + i * 1.6, 2, i % 2 ? col.accent : col.mid, alpha * 0.9));
          p.push(O('fx', mx, my, 2 + i * 0.8, 1, col.core, alpha));
        } else if (d.primacy === 3) {              // 点刃：光珠串
          p.push(D('fx', B0[0], B0[1], 4 - i * 0.35, i % 2 ? col.core : col.bright, alpha));
          p.push(D('fx', mx, my, 2, col.accent, alpha * 0.7));
        } else if (d.primacy === 4) {              // 方刃：像素晶格
          p.push(R('fx', B0[0] - 3, B0[1] - 3, 6, 6, col.mid, alpha));
          p.push(R('fx', B0[0] - 1, B0[1] - 1, 2, 2, col.core, alpha));
        } else {                                   // 光柱刃：柔光团 + 细芯
          p.push(G('fx', mx, my, 9 + i, col.accent, alpha * 0.5));
          p.push(L('fx', A0[0], A0[1], B0[0], B0[1], 2, col.core, alpha));
        }
      }
    }
    var ang = Math.atan2(h[1] - o[1], h[0] - o[0]);
    switch (d.path) {
      case 0: // 刀尖横刃
        p.push(L('fx', h[0] - Math.sin(ang) * 9, h[1] + Math.cos(ang) * 9,
                     h[0] + Math.sin(ang) * 9, h[1] - Math.cos(ang) * 9, 2, col.accent, alpha));
        break;
      case 1: // 弦：直线 + 弧同时存在
        p.push(L('fx', o[0], o[1], h[0], h[1], 1, col.accent, alpha * 0.8));
        p.push(A('fx', o[0], o[1], LEN(pts), ang - 0.1, ang + 0.9 * d.bend, 2, col.mid, alpha * 0.7));
        break;
      case 2: // 每个折点一枚方晶
        for (i = 1; i < pts.length - 1; i++)
          p.push(R('fx', pts[i][0] - 2, pts[i][1] - 2, 4, 4, col.accent, alpha * 0.85));
        break;
      case 3: // 双平行虚线
        for (i = 1; i < pts.length - 1; i += 2)
          p.push(L('fx', pts[i][0], pts[i][1] - 7, pts[i + 1][0], pts[i + 1][1] - 7, 1, col.dim, alpha * 0.7));
        break;
      case 4: // Y 形分叉
        for (i = -1; i <= 1; i += 2) {
          var q = pts[Math.floor(pts.length * 0.55)], aa = ang + i * d.twinA * 1.6;
          p.push(L('fx', q[0], q[1], q[0] + Math.cos(aa) * 26, q[1] + Math.sin(aa) * 26, 3, col.mid, alpha * 0.9));
          p.push(L('fx', q[0], q[1], q[0] + Math.cos(aa) * 26, q[1] + Math.sin(aa) * 26, 1, col.core, alpha));
        }
        break;
      case 5: // 断续刺：一串由大到小的菱形点，没有连续刃
        for (i = 1; i <= d.segN + 2; i++) {
          var u2 = i / (d.segN + 3), px = o[0] + Math.cos(ang) * LEN(pts) * u2, py = o[1] + Math.sin(ang) * LEN(pts) * u2;
          p.push(D('fx', px, py, 5 - u2 * 2.5, i % 2 ? col.core : col.bright, alpha));
          if (i % 2 === 0) p.push(L('fx', px - 4, py, px + 4, py, 1, col.accent, alpha * 0.7));
        }
        break;
      case 6: // 螺旋：两层同心弧 + 尾点
        p.push(A('fx', o[0], o[1], 20 + b * 8, ang, ang + Math.PI * d.turns, 2, col.accent, alpha * 0.8));
        p.push(O('fx', o[0], o[1], 12 + b * 5, 2, col.mid, alpha * 0.7));
        break;
      case 7: // 绕身环：以人物为中心的两圈
        p.push(A('fx', CX, CY - 16, 26 + b * 10, ang - 1.2, ang + 2.0, 3, col.mid, alpha * 0.8));
        p.push(O('fx', CX, CY - 16, 17, 2, col.accent, alpha * 0.7));
        break;
      case 8: // 扇形多刃
        for (i = 0; i < d.fanN; i++) {
          var fa = ang + (i / (d.fanN - 1) - 0.5) * d.spread * 2;
          var fl = LEN(pts) * (0.62 + 0.38 * (1 - Math.abs(i / (d.fanN - 1) - 0.5) * 2));
          p.push(L('fx', o[0], o[1], o[0] + Math.cos(fa) * fl, o[1] + Math.sin(fa) * fl, 2, col.mid, alpha * 0.85));
        }
        break;
      case 9: // 下砸竖柱 + 地裂
        p.push(L('fx', h[0], h[1] - 34, h[0], h[1] + 4, 4, col.core, alpha));
        for (i = 0; i < 5; i++)
          p.push(L('fx', h[0], CY, h[0] + (i - 2) * 9, CY + 4 + (i % 2) * 3, 2, col.dim, alpha * 0.75));
        break;
      case 10: // 波浪余纹
        for (i = 1; i < pts.length; i++)
          p.push(L('fx', pts[i][0], pts[i][1] - 6, pts[i][0], pts[i][1] + 6, 1, col.accent, alpha * 0.6));
        break;
      default: // 回旋镖：一条返回线
        p.push(L('fx', h[0], h[1], o[0] + Math.cos(ang + d.hookBack) * 22, o[1] + Math.sin(ang + d.hookBack) * 22,
                 2, col.accent, alpha * 0.75));
        p.push(A('fx', h[0], h[1], 12, ang, ang + Math.PI * 1.3, 2, col.mid, alpha * 0.7));
        break;
    }
  }
  function LEN(pts) {
    var L = 0;
    for (var i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i-1][0], pts[i][1] - pts[i-1][1]);
    return L;
  }

  // 命中字形：10 类拓扑，替代所有招共用的「同心圈 + 破甲十字」
  function drawGlyph(p, s, cx, cy, alpha, hk) {
    var d = s.dna, col = s.pal, i, a, R0 = d.gR, arms = d.gArms, sp = d.gSpin;
    switch (d.glyph) {
      case 0: // 环 + 辐条
        p.push(O('fx', cx, cy, R0, 3, col.dim, alpha * 0.6));
        p.push(O('fx', cx, cy, R0 * 0.72, 1, col.bright, alpha * 0.9));
        for (i = 0; i < arms; i++) { a = sp + i / arms * Math.PI * 2;
          p.push(L('fx', cx + Math.cos(a) * R0 * 0.3, cy + Math.sin(a) * R0 * 0.3,
                       cx + Math.cos(a) * R0 * 1.15, cy + Math.sin(a) * R0 * 1.15, 1, col.accent, alpha * 0.8)); }
        break;
      case 1: // 破甲十字
        for (i = 0; i < 2; i++) { a = sp + i * Math.PI / 2;
          p.push(L('fx', cx - Math.cos(a) * R0, cy - Math.sin(a) * R0,
                       cx + Math.cos(a) * R0, cy + Math.sin(a) * R0, 4, PAL.red2, alpha * 0.85));
          p.push(L('fx', cx - Math.cos(a) * R0, cy - Math.sin(a) * R0,
                       cx + Math.cos(a) * R0, cy + Math.sin(a) * R0, 1, col.core, alpha)); }
        break;
      case 2: // 星芒
        for (i = 0; i < arms; i++) { a = sp + i / arms * Math.PI * 2;
          p.push(L('fx', cx, cy, cx + Math.cos(a) * R0 * 1.4, cy + Math.sin(a) * R0 * 1.4, 2, col.mid, alpha * 0.85));
          p.push(D('fx', cx + Math.cos(a) * R0 * 1.4, cy + Math.sin(a) * R0 * 1.4, 2, col.core, alpha)); }
        break;
      case 3: // 碎裂三角
        for (i = 0; i < 3; i++) { a = sp + i / 3 * Math.PI * 2;
          var qx = cx + Math.cos(a) * R0, qy = cy + Math.sin(a) * R0;
          p.push(L('fx', cx, cy, qx, qy, 2, col.accent, alpha * 0.9));
          p.push(L('fx', qx, qy, cx + Math.cos(a + 0.6) * R0 * 0.7, cy + Math.sin(a + 0.6) * R0 * 0.7, 1, col.mid, alpha));
          p.push(R('fx', qx - 2, qy - 2, 4, 4, col.bright, alpha)); }
        break;
      case 4: // 同心方框
        for (i = 0; i < 3; i++) { var r = R0 * (1 - i * 0.28);
          p.push(R('fx', cx - r, cy - r, r * 2, 1, col.accent, alpha * 0.8));
          p.push(R('fx', cx - r, cy + r, r * 2, 1, col.accent, alpha * 0.8));
          p.push(R('fx', cx - r, cy - r, 1, r * 2, col.mid, alpha * 0.8));
          p.push(R('fx', cx + r, cy - r, 1, r * 2, col.mid, alpha * 0.8)); }
        break;
      case 5: // 螺旋扇
        for (i = 0; i < 3; i++)
          p.push(A('fx', cx, cy, R0 * (0.5 + i * 0.32), sp + i * 1.1, sp + i * 1.1 + Math.PI * 1.5, 2, i % 2 ? col.accent : col.mid, alpha * 0.85));
        break;
      case 6: // 光柱
        p.push(L('fx', cx, cy - R0 * 1.6, cx, cy + R0 * 1.1, 5, col.core, alpha));
        for (i = -2; i <= 2; i++) p.push(R('fx', cx + i * 7 - 2, cy - R0 * 1.2, 3, 3, col.accent, alpha * 0.8));
        break;
      case 7: // 落雨
        for (i = 0; i < arms + 2; i++) {
          var rx = cx + (i - (arms + 2) / 2) * 6, ry = cy - R0 + (i % 3) * 5;
          p.push(L('fx', rx, ry, rx + 4, ry + 14, 2, col.mid, alpha * 0.85));
          p.push(D('fx', rx + 4, ry + 14, 1.5, col.core, alpha)); }
        break;
      case 8: // 双环错位
        p.push(O('fx', cx - R0 * 0.32, cy, R0 * 0.8, 2, col.accent, alpha * 0.85));
        p.push(O('fx', cx + R0 * 0.32, cy, R0 * 0.8, 2, col.mid, alpha * 0.85));
        p.push(L('fx', cx - R0, cy, cx + R0, cy, 1, col.dim, alpha * 0.6));
        break;
      default: // 花瓣
        for (i = 0; i < arms; i++) { a = sp + i / arms * Math.PI * 2;
          p.push(A('fx', cx + Math.cos(a) * R0 * 0.55, cy + Math.sin(a) * R0 * 0.55,
                   R0 * 0.5, a - 1.0, a + 1.0, 2, i % 2 ? col.mid : col.accent, alpha * 0.85)); }
        break;
    }
  }

  // ---- 五段编排：每段 10 种互斥画法，每招 5 段组合全局唯一 ----
  // 旧版 fxWind→fxCharge→fxBurst→fxChase→fxFade 是 80 招共用的固定流水线，
  // 每个函数里还有「所有招都画」的固定前缀（气点、蓄势环、主刃、残影、余辉）——
  // 这就是「换颜色而已」的根源。现在整段按 segs[段号] 分派，没有跨招公共层：
  // 相邻两招可以有同一段同画法，但整招的 5 段编排、主刃拓扑、命中字形、
  // 身体骨架、动作曲线都不重合。
  function segDraw(p, s, f, st, si, hand, tip, po) {
    var d = s.dna, col = s.pal, J = s.jit, u = seg(f, st.s, st.e);
    var LAY = d.layout, gk = s.game ? 0.35 : 1;
    var ox = hand.hx + 8 + J.ox + LAY.ox * gk;
    var oy = hand.hy - 2 + J.oy + LAY.oy * gk + LAY.seg[si] * gk;
    // po.ang 是「武器指哪」的持械角（每招 -2.6~0.4 都不同），不能当出招方向：
    // 拿它画主刃会让刀光朝任意方向乱飞。game 模式统一以正右为基准，
    // 由 dirXform 负责四方向旋转；演武台才用持械角做构图差异。
    var ang = (s.game ? 0 : po.ang) + J.ang * (s.game ? 0.35 : 1) + LAY.rot * (s.game ? 0.2 : 1);
    var R0 = (14 + d.gR * (si === 2 ? 0.9 + u * 0.5 : si === 4 ? 1.1 - u * 0.6 : 0.4 + u * 0.7)) * LAY.scale;
    var a = s.t.alpha * (si === 4 ? 0.62 - u * 0.4 : si === 0 ? 0.35 + u * 0.5 : 0.82);
    var style = d.segs[si], i, aa, px, py, q, n;

    // 发力段：主刃沿该招独有轨迹画，命中字形按该招独有拓扑画。
    // 这两层在所有招里都不共用，是「不重样」的主体。
    if (si === 2) {
      var pts = bladePath(s, ox, oy, ang,
        (mix(46, 68, u) + J.len) * (s.skeleton === 'pierce' ? 1.12 : 1), u);
      drawBlade(p, s, pts, col, s.t.alpha, u);
      var hitF = st.s + 2;
      if (f >= hitF && f <= hitF + 4) {
        var hk = seg(f, hitF, hitF + 4);
        drawGlyph(p, s, s.tx, s.ty, (1 - hk * 0.8) * s.t.alpha, hk);
      }
      // 轻量收尾标记：主导形态已由 drawBlade 按 primacy 决定，这里每种只留 1 枚，
      // 免得又把「所有招都有一堆线」的公共层加回来。
      q = d.primacy;
      if (q === 0) p.push(L('fx', s.tx - 6, s.ty, s.tx + 6, s.ty, 1, col.core, a));
      else if (q === 1) p.push(A('fx', s.tx, s.ty, R0 * 0.6, ang - 1, ang + 1, 1, col.accent, a));
      else if (q === 2) p.push(O('fx', s.tx, s.ty, R0 * 0.5, 2, col.mid, a));
      else if (q === 3) p.push(D('fx', s.tx, s.ty, 4, col.core, a));
      else if (q === 4) p.push(R('fx', s.tx - 3, s.ty - 3, 6, 6, col.accent, a));
      else p.push(G('fx', s.tx, s.ty, R0 * 0.5, col.accent, a * 0.5));
    }

    switch (style) {
      case 0: // 放射刃群
        n = 4 + d.gArms % 4;
        for (i = 0; i < n; i++) {
          aa = ang + (i / (n - 1) - 0.5) * d.spread * 1.6;
          var ll = R0 * (0.5 + u * 0.7) * (si === 3 ? 1.6 : 1);
          px = ox + Math.cos(aa) * ll; py = oy + Math.sin(aa) * ll;
          p.push(L('fx', ox, oy, px, py, i === 0 ? 3 : 1, i === 0 ? col.core : col.mid, a));
        }
        break;
      case 1: // 同心环扩散
        for (i = 0; i < 3; i++)
          p.push(O('fx', ox + Math.cos(ang) * R0 * 0.35, oy + Math.sin(ang) * R0 * 0.35,
            R0 * (0.5 + i * 0.35 + u * 0.3), 1 + (i === 0 ? 1 : 0),
            i % 2 ? col.accent : col.dim, a * (1 - i * 0.22)));
        break;
      case 2: // 粒子爆
        for (i = 0; i < 9; i++) {
          aa = d.gSpin + i / 9 * Math.PI * 2;
          px = ox + Math.cos(aa) * R0 * (0.4 + u * 1.1);
          py = oy + Math.sin(aa) * R0 * (0.4 + u * 1.1) * 0.8;
          p.push(D('fx', px, py, 2.6 - u, i % 3 ? col.mid : col.core, a));
        }
        break;
      case 3: // 方块阵
        for (i = 0; i < 6; i++)
          p.push(R('fx', ox + Math.cos(ang) * R0 * (0.3 + i * 0.22) - 2,
            oy + Math.sin(ang) * R0 * (0.3 + i * 0.22) - 2 + (i % 2 ? 5 : -5),
            4, 4, i % 2 ? col.accent : col.dim, a * (1 - i * 0.1)));
        break;
      case 4: // 光柱
        p.push(L('fx', ox + Math.cos(ang) * R0 * 0.7, oy - R0 * 1.6,
          ox + Math.cos(ang) * R0 * 0.7, oy + R0 * 0.9, 4, col.core, a));
        for (i = -2; i <= 2; i++)
          p.push(R('fx', ox + Math.cos(ang) * R0 * 0.7 + i * 6 - 1, oy - R0 * 1.2, 3, 3, col.accent, a * 0.8));
        break;
      case 5: // 螺旋弧
        for (i = 0; i < 3; i++)
          p.push(A('fx', ox, oy, R0 * (0.6 + i * 0.28), ang + i * 1.1 + u,
            ang + i * 1.1 + u + Math.PI * d.turns, 2, i % 2 ? col.mid : col.accent, a * 0.85));
        break;
      case 6: // 星芒
        for (i = 0; i < d.gArms; i++) {
          aa = d.gSpin + i / d.gArms * Math.PI * 2;
          px = ox + Math.cos(aa) * R0 * 1.3; py = oy + Math.sin(aa) * R0 * 1.3;
          p.push(L('fx', ox, oy, px, py, 2, col.mid, a));
          p.push(D('fx', px, py, 2, col.core, a));
        }
        break;
      case 7: // 花瓣环
        for (i = 0; i < d.gArms; i++) {
          aa = d.gSpin + i / d.gArms * Math.PI * 2;
          p.push(A('fx', ox + Math.cos(aa) * R0 * 0.6, oy + Math.sin(aa) * R0 * 0.6,
            R0 * 0.45, aa - 1, aa + 1, 2, i % 2 ? col.mid : col.accent, a * 0.85));
        }
        break;
      case 8: // 波纹扩散
        for (i = 0; i < 4; i++)
          p.push(A('fx', s.tx, s.ty, R0 * (0.4 + i * 0.3 + u * 0.4), -1.1, 1.1,
            1 + (i === 0 ? 1 : 0), i % 2 ? col.dim : col.bright, a * (1 - i * 0.18)));
        break;
      default: // 折线链
        for (i = 0; i < 5; i++) {
          q = i / 5;
          px = ox + Math.cos(ang) * R0 * 1.3 * q;
          py = oy + Math.sin(ang) * R0 * 1.3 * q + (i % 2 ? 6 : -6);
          p.push(L('fx', px, py, px + 8, py + (i % 2 ? -3 : 3), 2, col.accent, a));
          p.push(R('fx', px + 7, py - 1, 3, 3, col.mid, a));
        }
        break;
    }
  }

  // ---- 五段特效 ----
  function fxWind(p, s, f, st, hand) {
    var t = seg(f, st.s - 1, s.stages[1].e), rad = mix(30, 9, t), ac = mix(0.25, 0.95, t) * s.t.alpha;
    var n = 3 + s.t.layers;
    for (var i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2 + t * 1.6;
      var px = hand.hx + Math.cos(a) * rad, py = hand.hy + Math.sin(a) * rad * 0.72;
      p.push(D('fx', px, py, 2 - t * 0.7, i % 2 ? s.pal.accent : PAL.gold3, ac));
      if (i % 2 === 0) p.push(G('fx', px, py, 6, s.pal.dim, ac * 0.30));
    }
    for (var d = 0; d < s.t.dust; d++) {
      var dx = (rnd(d, 7, s.seed) - 0.5) * 22, dy = -rnd(d, 11, s.seed) * 5 - 1;
      p.push(R('fx', hand.x - 8 + dx, CY + dy, 2, 2, PAL.paper1, 0.28 * s.t.alpha));
    }
  }
  function fxCharge(p, s, f, st, hand, tip) {
    var c = seg(f, st.s, st.e);
    p.push(O('fx', hand.hx, hand.hy, mix(20, 8, c), 1, s.pal.accent, (0.32 + c * 0.4) * s.t.alpha));
    if (s.skeleton === 'slash' || s.skeleton === 'step') crack(p, s, f, 0.8);
    if (s.skeleton === 'aura') {
      for (var i = 0; i < 3; i++) p.push(O('fx', hand.x, CY - 16, 12 + i * 9 + c * 8, 1, i % 2 ? s.pal.dim : s.pal.accent, (0.5 - i * 0.12) * s.t.alpha));
      p.push(L('fx', hand.x, CY - 2, hand.x, CY - 46 - c * 8, 2, s.pal.mid, 0.5 * s.t.alpha));
    }
    if (s.skeleton === 'pierce') {
      p.push(L('fx', tip.ex, tip.ey, tip.ex + 40, tip.ey - 12, 1, s.pal.accent, (0.25 + c * 0.4) * s.t.alpha));
    }
    // 蓄势段就把专属签名层淡淡铺一层：每招从起手就长得不一样
    if (c > 0.35) motif(p, s, f, hand.hx + 14, hand.hy - 6, -0.6, 20 + c * 8, (c - 0.35) * 0.5);
  }
  function fxBurst(p, s, f, st, hand, tip, po) {
    var b = seg(f, st.s, st.e), col = s.pal, d = s.dna;
    var TX = s.tx, TY = s.ty, J = s.jit;
    var ang = po.ang + J.ang;
    var ox = hand.hx + 8 + J.ox, oy = hand.hy - 2 + J.oy;
    var len = (mix(46, 68, b) + J.len) * (s.skeleton === 'pierce' ? 1.12 : 1);

    // 主刃：每招一条独立拓扑的轨迹，不再共用「一条直线 + 同心弧」
    var pts = bladePath(s, ox, oy, ang, len, b);
    drawBlade(p, s, pts, col, s.t.alpha, b);

    // 同心弧 / 大光晕改成按招式基因决定有无：招招都画会让人一眼看出是同一套模板
    var arcN = ovNum(s, 'arcs',
      (d.path === 1 || d.path === 7) ? 1 + (s.seed % 2) : (d.glowOn ? 1 : 0));
    for (var j = 0; j < arcN; j++) {
      var rr = 30 + d.gR * 0.8 + j * 7 + J.arcR * 0.4, a0 = ang - 1.0 + j * 0.2;
      p.push(A('fx', ox, oy, rr, a0, ang + 0.3, 2, col.mid, 0.5 * s.t.alpha));
    }
    if (d.glowOn) p.push(G('fx', ox + Math.cos(ang) * 12, oy + Math.sin(ang) * 12,
                           8 + d.gR * 0.28, col.accent, 0.18 * s.t.alpha));

    // 专属签名层：shapeSpec 原子。位置/角度/半径随每招 DNA 走，且不是每招都有，
    // 否则「招招都挂一层同样的东西」会重新把形状拉回同一个模子。
    if (d.glyph % 3 !== 0)
      motif(p, s, f, ox + Math.cos(ang + d.gSpin) * 6, oy + Math.sin(ang + d.gSpin) * 6,
            ang + d.bend * 0.4, 18 + d.gR * 0.7 + J.arcR * 0.35, 0.8 * s.t.alpha);

    // 骨架差异按步法基因启用，避免四骨架各自内部又长成一个样
    if (d.step === 2 || d.step === 3) {   // 跃起 / 旋身：环身光带
      for (var k = 0; k < 2; k++)
        p.push(O('fx', hand.x, CY - 16 - d.rise, 14 + k * 13 + b * 16, 2,
          k % 2 ? col.accent : col.mid, (0.62 - k * 0.18) * s.t.alpha));
    }
    if (d.step === 4 || d.step === 5) {   // 踏地 / 滑步：地面碎纹
      for (var m = 0; m < 4; m++) {
        var sx = CX - 6 + m * 8, sy = CY - 3 - rnd(m, 13, s.seed) * 5;
        p.push(L('fx', sx, sy, sx + 9, sy - 2, 1, col.dim, 0.5 * s.t.alpha));
      }
    }
    if (s.skeleton === 'pierce' && d.path % 2 === 0) {
      var u = b, fx = ox + Math.cos(ang) * (26 + u * 60), fy = oy + Math.sin(ang) * (26 + u * 60);
      p.push(L('fx', fx - Math.cos(ang) * 18, fy - Math.sin(ang) * 18, fx, fy, 3, col.mid, 0.55 * s.t.alpha));
      p.push(D('fx', fx, fy, 3, col.core, s.t.alpha));
    }

    // 命中定帧：字形由每招独有，不再是共用「同心圈 + 十字」
    var hitF = st.s + 2;
    if (f >= hitF && f <= hitF + 4) {
      var hk = seg(f, hitF, hitF + 4), ha = (1 - hk * 0.8) * s.t.alpha;
      if (f === hitF && s.t.wave && d.glyph % 2 === 0) {
        for (var sl = 0; sl < 8; sl++) {
          var sa = sl / 8 * Math.PI * 2 + d.gSpin;
          p.push(L('fx', TX + Math.cos(sa) * 14, TY + Math.sin(sa) * 14,
                   TX + Math.cos(sa) * 40, TY + Math.sin(sa) * 40, 1, col.core, 0.5));
        }
      }
      drawGlyph(p, s, TX, TY, ha, hk);
      p.push(D('fx', TX, TY, mix(6, 2, hk), col.core, ha));
    }
  }
  function fxChase(p, s, f, st, hand) {
    var col = s.pal, TX = s.tx, TY = s.ty, J = s.jit;
    // 同档同家族里，专精奇偶再差一道剑气密度，避免两招只差颜色
    var trails = clamp(ovNum(s, 'trails',
      Math.min(5, Math.min(s.t.trails, s.famDef.trails + 1) + (s.prof % 2))), 0, 7);
    var ang = -0.30;
    for (var k = 0; k < trails; k++) {
      var t0 = st.s + k * 2;
      if (f < t0) continue;
      var u = seg(f, t0, t0 + 6);
      var aa = ang + (k - (trails - 1) / 2) * 0.26;
      var adv = CX + 34 + u * 76 + k * 6 + J.hitX * 0.5;
      var sx = adv, sy = TY + (k - 1) * 13 - u * 5;
      var ex = sx + Math.cos(aa) * (52 - u * 16), ey = sy + Math.sin(aa) * (52 - u * 16);
      var la = (1 - u * 0.75) * s.t.alpha;
      p.push(L('fx', sx, sy, ex, ey, 7, col.dim, la * 0.22));
      p.push(L('fx', sx, sy, ex, ey, 3, col.mid, la * 0.65));
      p.push(L('fx', sx, sy, ex, ey, 1, col.core, la));
      p.push(D('fx', ex, ey, 3 - u * 2, col.bright, la));
    }
    if (s.t.wave) {
      var rr = 22 + (f - st.s) * 5;
      p.push(O('fx', TX, TY, rr, 1, col.dim, Math.max(0, 0.42 - (f - st.s) * 0.05)));
    }
    if (s.skeleton === 'aura') {
      var a2 = (f - st.s) * 0.35;
      for (var i = 0; i < 5; i++) {
        var aa2 = a2 + i / 5 * Math.PI * 2;
        p.push(D('fx', hand.x + Math.cos(aa2) * 24, CY - 18 + Math.sin(aa2) * 12, 2, col.accent, 0.7 * s.t.alpha));
      }
      p.push(O('fx', hand.x, CY - 18, 24 + (f - st.s) * 2, 1, col.mid, 0.35 * s.t.alpha));
    }
    // 碎屑
    var hitF = s.stages[2].s + 2;
    for (var q2 = 0; q2 < s.t.sparks; q2++) {
      var age = f - hitF - Math.floor(q2 / 5);
      if (age < 0 || age > 12) continue;
      var vx = (rnd(q2, 17, s.seed) - 0.15) * 5.2;
      var vy = -(rnd(q2, 23, s.seed) * 3.4) + age * 0.42;
      var px2 = TX + vx * age * 0.55, py2 = TY + vy * age * 0.55;
      var pa = Math.max(0, 1 - age / 12);
      p.push(R('fx', px2, py2, q2 % 3 === 0 ? 2 : 1, 2, q2 % 4 === 0 ? col.accent : col.bright, pa * 0.85));
    }
  }
  function fxFade(p, s, f, st, hand, tip) {
    var ra = 1 - seg(f, st.s, st.s + (st.e - st.s) * 0.75);
    if (ra > 0) {
      var a0 = -0.30, col = s.pal;
      p.push(L('fx', tip.ex, tip.ey, tip.ex + Math.cos(a0) * 62, tip.ey + Math.sin(a0) * 62, 3, col.mid, ra * 0.30 * s.t.alpha));
      p.push(A('fx', tip.ex, tip.ey, 52, a0 - 1.0, a0 + 0.3, 1, col.bright, ra * 0.28 * s.t.alpha));
      if (s.skeleton === 'aura') p.push(O('fx', hand.x, CY - 18, 26 + (1 - ra) * 14, 1, col.dim, ra * 0.35));
    }
  }

  function buildFrame(s, f) {
    var p = bg(), st = stageOf(s, f), po = poseOf(s, f), id = st.id, si = 0, k;
    for (k = 0; k < s.stages.length; k++) if (s.stages[k].id === id) si = k;
    var hand = hero(p, s, f, po);
    var tip = sword(p, s, hand, po.ang, po.dust || 0);
    // 整段按该招独有的段编排分派；旧 fx* 五个函数保留但不参与渲染，
    // 避免任何「80 招都跑同一条流水线」的公共模板层。
    segDraw(p, s, f, st, si, hand, tip, po);
    // 可续招窗口（UI 组，游戏里不画）
    if (f >= st.s && id === 'recover') {
      var ua = f < st.s + 2 ? (f - st.s) * 0.5 : 1 - seg(f, st.s + 5, st.e) * 0.7;
      p.push(R('ui', W - 76, 20, 58, 18, PAL.ink2, 0.85 * ua));
      p.push(R('ui', W - 76, 20, 58, 1, PAL.gold2, 0.9 * ua));
      p.push(L('ui', W - 70, 29, W - 64, 25, 2, PAL.gold3, ua));
      p.push(L('ui', W - 70, 29, W - 64, 33, 2, PAL.gold3, ua));
      p.push(L('ui', W - 70, 29, W - 62, 29, 2, PAL.gold3, ua));
    }
    return { f: f, stage: st, prims: p };
  }

  // 渲染层级：地形 → 特效 → 角色 → UI
  var GORD = { bg: 0, fx: 1, hero: 2, ui: 3 };
  function ordered(prims) {
    return prims.map(function (p, i) { return { p: p, i: i }; })
      .sort(function (a, b) { return (GORD[a.p.g] - GORD[b.p.g]) || (a.i - b.i); })
      .map(function (z) { return z.p; });
  }
  // ---- 游戏内变换：数据层旋转 + 收紧构图抖动 ----
  // 演武帧一律按「朝右」画。游戏里 DIRA(right)=0，所以直接把 aim 当旋转角，
  // 绕角色脚底 (CX,CY) 转：朝左 π、朝上 -π/2、朝下 π/2，整招跟着人物转。
  // 放在数据层而不是 canvas transform，是为了让离线验收 PNG 与游戏用同一份变换。
  function rotatePrims(prims, rot) {
    if (!rot) return prims;
    var cs = Math.cos(rot), sn = Math.sin(rot);
    function rp(x, y) {
      var dx = x - CX, dy = y - CY;
      return [CX + dx * cs - dy * sn, CY + dx * sn + dy * cs];
    }
    return prims.map(function (o) {
      // hero 组只用于离线验收图里当「游戏真人替身」，游戏内 filter 不会画它；
      // 一起转才不会在验收图里出现「人朝右举剑、特效朝下」的假分离。
      if (o.g !== 'fx' && o.g !== 'hero') return o;
      var n = {}, k;
      for (k in o) n[k] = o[k];
      if (o.k === 'line') {
        var a = rp(o.x, o.y), b = rp(o.x2, o.y2);
        n.x = a[0]; n.y = a[1]; n.x2 = b[0]; n.y2 = b[1];
      } else if (o.k === 'rect') {
        // 1~2px 碎屑只转中心、保持轴对齐：像素风里转斜了会糊成一团
        var c = rp(o.x + o.w / 2, o.y + o.h / 2);
        n.x = c[0] - o.w / 2; n.y = c[1] - o.h / 2;
      } else {
        var d = rp(o.x, o.y);
        n.x = d[0]; n.y = d[1];
        if (o.k === 'arc') { n.a0 = o.a0 + rot; n.a1 = o.a1 + rot; }
      }
      return n;
    });
  }
  // ---- 游戏内四方向正交变换 ----
  // 演武帧只画「朝右」一次挥砍。以前把整招刚性旋转 180° 到朝左，
  // 于是「从上往下劈」被一起翻成「从下往上挑」；而游戏原本 artSwingFx
  // 是以 aim 为轴重绘扇形，四个方向的挥砍旋向都该贴着人物走。
  // 所以：朝左用 x 镜像（y 分量原样保留），朝上/朝下用 ∓90° 旋转。
  // 每项 [m11,m12,m21,m22, 角度符号, 角度偏移]，作用在相对「演武的手」的向量上。
  var DIR_XFORM = [
    [1, 0, 0, 1, 1, 0],                    // R 恒等
    [0, -1, 1, 0, 1, Math.PI / 2],         // D +90°（屏幕 y 向下）
    [-1, 0, 0, 1, -1, Math.PI],            // L x 镜像：角度 π-a
    [0, 1, -1, 0, 1, -Math.PI / 2],        // U -90°
  ];
  function dirXform(rot) {
    var q = ((Math.round(rot / (Math.PI / 2)) % 4) + 4) % 4;
    return DIR_XFORM[q] || DIR_XFORM[0];
  }
  // 游戏专用相似变换：按朝向做正交变换，再整体缩到 16×18 真人的尺度，
  // 最后把「演武的手」对齐到「游戏真人的手」。全部在数据层做完，
  // 所以离线验收 PNG 与游戏画面消费的是同一份图元。
  function gamePrims(prims, rot, s) {
    var X = dirXform(rot);
    var m11 = X[0], m12 = X[1], m21 = X[2], m22 = X[3], as = X[4], ao = X[5];
    var k = (s && typeof s.gameScale === 'number') ? clamp(s.gameScale, 0.25, 1) : GAME_SCALE;
    var ray = (s && typeof s.gameRay === 'number') ? clamp(s.gameRay, 0.2, 1) : GAME_RAY_KEEP;
    var ax = GAME_HAND[0] * m11 + GAME_HAND[1] * m12;
    var ay = GAME_HAND[0] * m21 + GAME_HAND[1] * m22;
    function mp(x, y) {
      var dx = x - HX, dy = y - HY;
      return [CX + ax + k * (dx * m11 + dy * m12),
              CY - 8 + ay + k * (dx * m21 + dy * m22)];
    }
    function ma(a) { return as * a + ao; }
    return prims.map(function (o) {
      if (o.g !== 'fx') return o;      // hero/bg/ui 游戏里都不画，留给离线验收
      var n = {}, p;
      for (p in o) n[p] = o[p];
      if (o.k === 'line') {
        var ex = o.x2, ey = o.y2;
        // 只裁「细长放射线」：主刃（w≥3）与短碎屑原样保留，否则刀光会变秃
        if (o.w <= 1.2) {
          var dx = ex - o.x, dy = ey - o.y, L = Math.sqrt(dx * dx + dy * dy);
          if (L > GAME_RAY_MIN) { ex = o.x + dx * ray; ey = o.y + dy * ray; }
        }
        var a = mp(o.x, o.y), b = mp(ex, ey);
        n.x = a[0]; n.y = a[1]; n.x2 = b[0]; n.y2 = b[1];
        n.w = Math.max(1, o.w * k);
      } else if (o.k === 'rect') {
        // 1~2px 碎屑只转中心、保持轴对齐，像素风里斜着会糊
        var c = mp(o.x + o.w / 2, o.y + o.h / 2);
        n.w = Math.max(1, o.w * k); n.h = Math.max(1, o.h * k);
        n.x = c[0] - n.w / 2; n.y = c[1] - n.h / 2;
      } else {
        var d = mp(o.x, o.y);
        n.x = d[0]; n.y = d[1];
        if (o.r !== undefined) n.r = Math.max(1, o.r * k);
        if (o.w !== undefined) n.w = Math.max(1, o.w * k);
        if (o.k === 'arc') {
          // 镜像会让区间反序，交换回来保证 a0 <= a1，栅格化才不会画空
          var b0 = ma(o.a0), b1 = ma(o.a1);
          n.a0 = Math.min(b0, b1); n.a1 = Math.max(b0, b1);
        }
      }
      return n;
    });
  }
  function gameSpec(s0) {
    var s = {}, k;
    for (k in s0) s[k] = s0[k];
    // 构图抖动在预览里用来区分 80 招，游戏里贴着真人要收窄，否则特效飘离角色
    var j = {};
    for (k in s0.jit) j[k] = s0.jit[k] * 0.35;
    s.jit = j; s.tx = TX + j.hitX; s.ty = TY + j.hitY;
    s.game = true;
    return s;
  }
  function frame(id, f, mode, opts) {
    if (id === 'legacy' || id === 'cine') id = DEFAULT_ART;   // 兼容 v1 调用
    var s = specOf(id);
    if (!s) return { f: f, stage: STAGE_META[0], prims: bg() };
    if (opts && opts.game) s = gameSpec(s);
    var len = s.t.len;
    f = clamp(f | 0, 0, len - 1);
    var fr = (mode === 'legacy') ? legacyFrame(s, f) : buildFrame(s, f);
    fr.prims = ordered(fr.prims);
    // game 模式无论 rot 是否为 0 都要跑一次：缩放与手部对齐不是「转方向」附带的，
    // 少了它即使朝右，刀光也会从人头顶发出去。
    if (opts && opts.game) fr.prims = gamePrims(fr.prims, opts.rot || 0, s);
    else if (opts && opts.rot && mode !== 'legacy') fr.prims = rotatePrims(fr.prims, opts.rot);
    return fr;
  }
  // 结构指纹：骨架 + 家族 + 档位 + shape 原子及参数 + pose 模式
  function fingerprint(id) {
    var s = specOf(id); if (!s) return '';
    return [s.skeleton, s.fam, s.tier, s.shapeK, JSON.stringify(s.shapeSpec || s.shape),
            s.poseK, JSON.stringify(s.poseSpec || {}), s.color.join(''), s.seed].join('|');
  }

  // ---- 栅格器 / canvas 渲染器（与 v1 相同） ----
  function PixBuf(w, h, bgHex) {
    this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4);
    var c = rgb(bgHex || PAL.ink1);
    for (var i = 0; i < w * h; i++) {
      this.d[i * 4] = c[0]; this.d[i * 4 + 1] = c[1]; this.d[i * 4 + 2] = c[2]; this.d[i * 4 + 3] = 255;
    }
  }
  PixBuf.prototype.set = function (x, y, hex, a) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || a <= 0) return;
    var c = rgb(hex), i = (y * this.w + x) * 4, d = this.d;
    a = a > 1 ? 1 : a;
    d[i] = d[i] + (c[0] - d[i]) * a;
    d[i + 1] = d[i + 1] + (c[1] - d[i + 1]) * a;
    d[i + 2] = d[i + 2] + (c[2] - d[i + 2]) * a;
  };
  function rasterize(buf, prims, filter) {
    for (var n = 0; n < prims.length; n++) {
      var o = prims[n];
      if (filter && filter.indexOf(o.g) < 0) continue;
      var c = o.c, a = o.a === undefined ? 1 : o.a, x, y;
      if (o.k === 'rect') {
        for (y = 0; y < o.h; y++) for (x = 0; x < o.w; x++) buf.set(o.x + x, o.y + y, c, a);
      } else if (o.k === 'line') {
        var dx = o.x2 - o.x, dy = o.y2 - o.y, len2 = dx * dx + dy * dy;
        var rad = o.w / 2, pad = Math.ceil(rad) + 1;
        var minx = Math.floor(Math.min(o.x, o.x2) - pad), maxx = Math.ceil(Math.max(o.x, o.x2) + pad);
        var miny = Math.floor(Math.min(o.y, o.y2) - pad), maxy = Math.ceil(Math.max(o.y, o.y2) + pad);
        for (y = miny; y <= maxy; y++) for (x = minx; x <= maxx; x++) {
          var t = len2 ? ((x - o.x) * dx + (y - o.y) * dy) / len2 : 0;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          var px = o.x + t * dx, py = o.y + t * dy;
          if ((x - px) * (x - px) + (y - py) * (y - py) <= rad * rad) buf.set(x, y, c, a);
        }
      } else {
        var r = o.r, half = o.k === 'disc' ? r : (o.w || 1) / 2;
        var lo = Math.floor(o.x - r - 2), hi = Math.ceil(o.x + r + 2);
        var lo2 = Math.floor(o.y - r - 2), hi2 = Math.ceil(o.y + r + 2);
        for (y = lo2; y <= hi2; y++) for (x = lo; x <= hi; x++) {
          var ddx = x - o.x, ddy = y - o.y, dist = Math.sqrt(ddx * ddx + ddy * ddy);
          if (o.k === 'glow') { if (dist <= r) buf.set(x, y, c, a * (1 - dist / r) * (1 - dist / r)); }
          else if (o.k === 'disc') { if (dist <= r) buf.set(x, y, c, a); }
          else if (Math.abs(dist - r) <= half) {
            if (o.k === 'ring') buf.set(x, y, c, a);
            else {
              var ang2 = Math.atan2(ddy, ddx), aa = o.a0;
              while (ang2 < aa) ang2 += Math.PI * 2;
              if (ang2 <= o.a1) buf.set(x, y, c, a);
            }
          }
        }
      }
    }
    return buf;
  }
  function renderCanvas(ctx, prims, ox, oy, scale, filter) {
    ox = ox || 0; oy = oy || 0; scale = scale || 1;
    ctx.save(); ctx.translate(ox, oy);
    if (scale !== 1) ctx.scale(scale, scale);
    ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
    for (var i = 0; i < prims.length; i++) {
      var o = prims[i];
      if (filter && filter.indexOf(o.g) < 0) continue;
      var a = o.a === undefined ? 1 : o.a;
      if (a <= 0) continue;
      ctx.globalAlpha = a > 1 ? 1 : a;
      if (o.k === 'rect') { ctx.fillStyle = o.c; ctx.fillRect(o.x, o.y, o.w, o.h); }
      else if (o.k === 'line') {
        ctx.strokeStyle = o.c; ctx.lineWidth = o.w;
        ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(o.x2, o.y2); ctx.stroke();
      } else if (o.k === 'arc') {
        ctx.strokeStyle = o.c; ctx.lineWidth = o.w || 1;
        ctx.beginPath(); ctx.arc(o.x, o.y, o.r, o.a0, o.a1); ctx.stroke();
      } else if (o.k === 'ring') {
        ctx.strokeStyle = o.c; ctx.lineWidth = o.w || 1;
        ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2); ctx.stroke();
      } else if (o.k === 'disc') {
        ctx.fillStyle = o.c; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2); ctx.fill();
      } else if (o.k === 'glow') {
        var gr = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
        var c = rgb(o.c);
        gr.addColorStop(0, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')');
        gr.addColorStop(1, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0)');
        ctx.globalAlpha = 1; ctx.fillStyle = gr;
        ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore(); return ctx;
  }

  var API = {
    PAL: PAL, W: W, H: H, FPS: FPS, TOTAL: 34, CX: CX, CY: CY,
    // 垂直补偿已并入 gamePrims（它把演武的手对齐到游戏真人的手），这里保持 0。
    GAME_Y_OFF: GAME_Y_OFF, GAME_SCALE: GAME_SCALE, GAME_HAND: GAME_HAND,
    GAME_RAY_KEEP: GAME_RAY_KEEP, gamePrims: gamePrims,
    STAGES: STAGE_META, DIFF: DIFF, DEFAULT_ART: DEFAULT_ART, GAME_CINE_ID: DEFAULT_ART,
    FAMILY: FAMILY, TIER: TIER, PALETTES: PALETTES,
    frame: frame, specOf: specOf, enabled: enabled, list: list, total: total, stages: stages,
    fingerprint: fingerprint, paletteOf: paletteOf, invalidate: invalidate,
    dnaOf: dnaOf, poseOf: poseOf,
    // 游戏内动作接口：把该招该帧的姿态交给 game.js 驱动真人精灵，
    // 否则演武 hero 不上屏，「动作不一样」在玩家画面里根本看不见。
    poseAt: function (id, f) {
      var s = specOf(id); if (!s) return null;
      var p = poseOf(s, clamp(f | 0, 0, s.t.len - 1));
      return {
        lean: p.lean, crouch: p.crouch, step: p.step, cape: p.cape,
        rise: p.rise, spin: p.spin, forward: p.forward, ang: p.ang,
        weapon: p.weapon, body: s.dna.body, primacy: s.dna.primacy,
        stepKind: p.stepKind, stage: p.stage,
      };
    },
    rasterize: rasterize, renderCanvas: renderCanvas, PixBuf: PixBuf, rgb: rgb,
  };
  if (typeof window !== 'undefined') window.CineVFX = API;
  if (typeof globalThis !== 'undefined') globalThis.CineVFX = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
