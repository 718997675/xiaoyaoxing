// arts.js · 兵器招式（技能框架的数据层）
//
// 为什么叫 arts 而不是 skills：
//   skills.js 里已经有一棵"道行树"（三支被动 + 气/舞/雷三个主动），那是境界带来的
//   通用手段，跟手里拿什么兵器无关。这一层是"兵器招式"—— 换刀就没有剑招，
//   两者是不同的轴，硬塞进同一个名字里，读代码的人会一直猜。
//
// 纯数据 + 纯函数，无 DOM / 无 three.js 依赖，可单测。
// 唯一的外部依赖是 pixel.js 的 24 色调色板 —— 那也是一个纯常量表。
import { C } from './pixel.js';
//
// P6 说明：八兵器 × 八招 = 64 招。装配槽只有 6 个，所以 8 招是"全部可学、
// 挑 6 招上阵"，不是同时开 8 个。新增的 48 招按功能位铺满：
//   输出 ×2 / 清场 ×2 / 位移 ×1 / 控制 ×1 / 增益 ×1 / 特色 ×1
//
// P12-C：表尾追加 chain / fan 两类各 8 招，共 80 招。
// P12-D：全表零重复 —— 每招 shape@shv / pose 全参数 / color 对 / snd 对
// 在 80 招里各自都是 80 个不同值，tools/arts.js §1.4 永久卡死。前 64 招与前 8 类兵器
// 一个字节未改，四个池（14 原语 / 19 形 / 20 式 / 17 音）也不扩容。
// 解锁等级错开成 1/2/3/4/5/6/8/10 —— 前六级每级都有新东西，
// 后面两级各再给一招（7、9 级空手是留给"专精满前的取舍"的，
// 8 级和 10 级各压轴一招，不至于让最后两级只是数字上涨）。

// ============ 专精 ============
// 专精靠"拿这件兵器杀敌"涨，不花道行点 —— 道行点是境界给的，属于"修为"；
// 专精是"手上功夫"，练出来的。两套成长曲线刻意分开，否则点数永远不够分。
export const PROF_MAX = 10;
// 累计击杀达到 PROF_NEED[n-1] 即第 n 级。1 级只要 2 只 —— 玩家第一次换兵器
// 打两只怪就能看见"招式解锁"的提示，不然这套系统在前期完全不存在。
export const PROF_NEED = [2, 6, 14, 26, 42, 62, 88, 118, 156, 200];
// 精英与首领按倍数折算，省得刷小怪刷到吐
export const PROF_WEIGHT = { normal: 1, elite: 3, boss: 12 };

export function profLevel(kills) {
  const k = kills || 0;
  let lv = 0;
  for (let i = 0; i < PROF_NEED.length; i++) if (k >= PROF_NEED[i]) lv = i + 1;
  return lv;
}
// 距离下一级还差几只（已满级返回 0）
export function profLeft(kills) {
  const k = kills || 0;
  for (let i = 0; i < PROF_NEED.length; i++) if (k < PROF_NEED[i]) return PROF_NEED[i] - k;
  return 0;
}
// 当前等级内的进度 0~1，给进度条用
export function profFrac(kills) {
  const k = kills || 0;
  const lv = profLevel(k);
  if (lv >= PROF_MAX) return 1;
  const lo = lv === 0 ? 0 : PROF_NEED[lv - 1];
  const hi = PROF_NEED[lv];
  return Math.max(0, Math.min(1, (k - lo) / Math.max(1, hi - lo)));
}

// ============ 招式 ============
// fx 是"效果原语"，game.js 里只有 execArt 一个分派器 —— 加一招不改运行时。
// P5 的六种：
//   melee  身前/环身判定（reach + arc，arc 给 6.28 就是环身）
//   proj   打出一枚（或数枚）弹体，可穿透、可挂状态
//   spin   持续旋转若干秒，每 tick 一次判定（可反弹飞行物）
//   orbit  召出若干把飞剑环绕，每把独立追敌结算
//   blink  连续短距闪烁，穿过敌人造成伤害
//   bolt   在目标头顶落雷（复用首领天雷的 bolts 通道）
// P6 补的四种（设计表里"位移 / 增益 / 地面区域 / 拉拽"四类，硬塞进原六种会变成换皮）：
//   dash   一次定向位移，路径上的敌人吃一段伤害；可带无敌 / 必暴 / 脱战
//   buff   给自己挂一段限时增益；伤害与代价都写在 buff 对象里
//   zone   在地面留一片持续区域，每 tick 结算伤害 / 状态；陷阱是 once 的 zone
//   pull   把范围内最近的敌人拽到身前，顺手打一下
//
// P10 补的四种（ARTS-DESIGN.md §5.3）—— 都是"锤的一招需要，但别的兵器也会要"：
//   boomerang 抛出去、飞回来，去回各判一次（回旋锤；将来飞刀 / 回旋镖）
//   shockwave 环形但**有扩散速度**，波前到达才结算（震地；将来棍的落地技）
//   charge    直线位移，**撞到第一个就停**（冲锋锤；将来枪的突刺）
//   cleave    正前方长条，沿路径全中（开天辟地；将来枪的贯甲、剑的一闪）
//
// 表现层字段（P10 新增，不写就退回旧行为）：
//   pose    { mode, a0, a1, dur, ease } —— 这一招的**身体与武器怎么动**
//           mode: swing / thrust / ring / cast（既有四种）
//                 overhead / overheadBig / slam / slamLow / sideSwing / throw / plant / charge
//           ease: 'out'（默认，快起慢收）/ 'in'（慢蓄猛落）/ 'both'
//   shape   这一招的**刀光几何**：point / overheadArc / shockwave / crack / cleave /
//           boomerang / sideArc / chargeLine / plant；不写则按 arc 推回旧的三形
//   color   这一招自己的刀光色 [亮, 暗]；不写则用兵器家族色
//
// 这三条是"招式不能千篇一律"的机制保证：形状 / 动作 / 色彩 / 声音各一个签名，
// 同兵器内不许重复，tools/arts.js 会自动断言。
//
// 修饰字段：
//   pierceDef / status / launch / centerBonus / centerR / lifeOnHit / reflect / kb / hits
//   ramp        melee 多段每击递增（连环刺）
//   critAdd     本次判定的额外暴击率（割喉）
//   critLast    melee 最后一段必暴（十字斩）
//   kbLast      melee 最后一段额外击退（枪阵）
//   back        朝身后出招（回马枪），配合 backBonus 反打加成
//   randomTargets melee 从范围内随机挑目标，逐段打（乱舞）
//   ring        proj 环形 360° 齐射（万箭穿心）
//   splash      proj 命中后小范围溅射（三珠连爆）
//   chain       bolt 逐跳链式衰减，落点跟着敌人走（雷链）
//   dash        { dir:'face'|'back'|'side'|'target', dist, iframe, forceCrit,
//                 nextDmg, stealth, shieldPct, kb }
//   buff        { dur, crit, critDmg, atkPct, atkSpd, spd, dmgReduce, hurtPct,
//                 reachPct, pierce, shieldPct, hurtReflect, poisonOnHit }
//   zone        { dur, tick, radius, count, once, shape:'circle'|'line', status }
//   power       buff / 陷阱这类"不直接造成伤害"的招式，给平衡校验的等效总倍率
//
// 数值口径见 SKILLS-STORY-PLAN.md §2.2：真气消耗 = CD × 1.2。
// 八招的等效 DPS 总和按普攻 DPS 的 2.8 倍封顶，法杖 / 暗器普攻 DPS 低，
// 整体乘了 0.75，否则这两把兵器会变成"等 CD"游戏。artPower() 是唯一口径。
export const ARTS = {
  // ---------- 剑 · 中庸 / 精准 / 连击 ----------
  sword_1: {
    id: 'sword_1', fam: 'sword', slot: 'dmg', name: '破锋式', prof: 1,
    cd: 4, cost: 4.8, fx: 'melee',
    reach: 40, arc: 1.2, mul: 6.6, kb: 9, pierceDef: 0.3,
    pose: { mode: 'lunge', a0: -2.45, a1: -0.95, dur: 0.28, ease: 'out' },
    shape: 'arc', color: [C.paper3, C.paper2],
    shv: 1,
    snd: 'slash1', hitSnd: 'hit1',
    desc: '一剑直取，无视三成防御。',
  },
  sword_2: {
    id: 'sword_2', fam: 'sword', slot: 'dmg', name: '连环刺', prof: 2,
    cd: 3, cost: 3.6, fx: 'melee',
    reach: 38, arc: 1.0, mul: 1.45, hits: 3, ramp: 0.10, kb: 5,
    pose: { mode: 'thrust', a0: -1.95, a1: -0.65, dur: 0.22, ease: 'out' },
    shape: 'thrust', color: [C.jade3, C.jade2],
    shv: 1,
    snd: 'slash2', hitSnd: 'hit2',
    desc: '三连突刺，一刺比一刺沉。',
  },
  sword_3: {
    id: 'sword_3', fam: 'sword', slot: 'aoe', name: '剑气斩', prof: 3,
    cd: 6, cost: 7.2, fx: 'proj',
    count: 1, speed: 330, size: 10, life: 0.62, pierce: 3, mul: 7.2,
    pose: { mode: 'swing', a0: -1.06, a1: -0.25, dur: 0.30, ease: 'out' },
    shape: 'ring', color: [C.white, C.jade2],
    shv: 1,
    snd: 'slash3', hitSnd: 'hit3',
    desc: '一道剑气直贯，沿途三人俱伤。',
  },
  sword_4: {
    id: 'sword_4', fam: 'sword', slot: 'aoe', name: '剑雨', prof: 5,
    cd: 10, cost: 12, fx: 'bolt',
    count: 8, mul: 1.4, radius: 26, range: 170,
    pose: { mode: 'lungeHigh', a0: -0.28, a1: 0.30, dur: 0.44, ease: 'in' },
    shape: 'lanceLong', color: [C.pur3, C.pur2],
    shv: 1,
    snd: 'slash4', hitSnd: 'hit4',
    desc: '八道剑光自天落，各寻各的目标。',
  },
  sword_5: {
    id: 'sword_5', fam: 'sword', slot: 'move', name: '御剑突进', prof: 6,
    cd: 8, cost: 9.6, fx: 'dash', mul: 3.6, radius: 26, kb: 6,
    dash: { dir: 'face', dist: 60, iframe: 0.3 },
    pose: { mode: 'lungeLow', a0: 0.10, a1: 0.10, dur: 0.26, ease: 'out' },
    shape: 'lanceShort', color: [C.gold3, C.gold2],
    shv: 1,
    snd: 'slash5', hitSnd: 'hit5',
    desc: '踏剑前冲六步，路径留伤，半息不伤。',
  },
  sword_6: {
    id: 'sword_6', fam: 'sword', slot: 'ctrl', name: '定身剑', prof: 8,
    cd: 12, cost: 14.4, fx: 'melee',
    reach: 40, arc: 1.2, mul: 5.4, kb: 4,
    status: { kind: 'stun', dur: 1.5 },
    pose: { mode: 'thrustLong', a0: 0.60, a1: 1.10, dur: 0.32, ease: 'out' },
    shape: 'lanceWide', color: [C.jade2, C.jade1],
    shv: 1,
    snd: 'qi1', hitSnd: 'crit1',
    desc: '剑尖点穴，中者一息半动弹不得。',
  },
  sword_7: {
    id: 'sword_7', fam: 'sword', slot: 'buff', name: '剑心通明', prof: 10,
    cd: 20, cost: 24, fx: 'buff', power: 10,
    buff: { dur: 8, crit: 25, critDmg: 30 },
    pose: { mode: 'thrustShort', a0: 1.15, a1: 1.50, dur: 0.40, ease: 'in' },
    shape: 'arcUp', color: [C.gold2, C.gold1],
    shv: 1,
    snd: 'qi2', hitSnd: 'crit2',
    desc: '敛神八息，会心与剑意俱锐。',
  },
  sword_8: {
    id: 'sword_8', fam: 'sword', slot: 'special', name: '万剑归宗', prof: 4,
    cd: 30, cost: 36, fx: 'orbit',
    count: 12, dur: 6, mul: 1.9, radius: 34,
    pose: { mode: 'sweepHigh', a0: -0.95, a1: 0.40, dur: 0.62, ease: 'in' },
    shape: 'arcDown', color: [C.red3, C.red2],
    shv: 1,
    snd: 'qi3', hitSnd: 'crit3',
    desc: '十二剑环绕六息，各自追敌，每把独立结算。',
  },

  // ---------- 刀 · 大开大合 / 流血 ----------
  // P5 的输出位选了设计表 #2 血刃（id 就叫 blade_2），#1 力劈在 P6 补上。
  // 所以这一族的两招输出位 prof 是 1/2，跟别族顺序相反，但 ID 与存档必须保持不动。
  blade_1: {
    id: 'blade_1', fam: 'blade', slot: 'dmg', name: '力劈', prof: 2,
    cd: 5, cost: 6, fx: 'melee',
    reach: 36, arc: 1.8, mul: 8.0, kb: 12,
    pose: { mode: 'overhead', a0: -1.90, a1: -0.30, dur: 0.34, ease: 'in' },
    shape: 'overheadArc', color: [C.white, C.ink1],
    shv: 1,
    snd: 'qi4', hitSnd: 'crit4',
    desc: '一刀劈落，把人震开一丈。',
  },
  blade_2: {
    id: 'blade_2', fam: 'blade', slot: 'dmg', name: '血刃', prof: 1,
    cd: 4, cost: 4.8, fx: 'melee',
    reach: 36, arc: 2.4, mul: 4.4, kb: 8,
    status: { kind: 'bleed', dur: 5, pct: 0.12 },
    pose: { mode: 'sideSwing', a0: -2.45, a1: -0.85, dur: 0.26, ease: 'out' },
    shape: 'cleave', color: [C.red2, C.red1],
    shv: 1,
    snd: 'qi5', hitSnd: 'crit5',
    desc: '割开一道口子，五息内持续流血。',
  },
  blade_3: {
    id: 'blade_3', fam: 'blade', slot: 'aoe', name: '横扫千军', prof: 3,
    cd: 6, cost: 7.2, fx: 'melee',
    reach: 44, arc: 6.28, mul: 7.2, kb: 10,
    pose: { mode: 'reverse', a0: -1.45, a1: 0.10, dur: 0.30, ease: 'out' },
    shape: 'sideArc', color: [C.white, C.ink2],
    shv: 2,
    snd: 'wu1', hitSnd: 'forge1',
    desc: '周身一匝横扫，近者皆退。',
  },
  blade_4: {
    id: 'blade_4', fam: 'blade', slot: 'aoe', name: '旋风斩', prof: 5,
    cd: 10, cost: 12, fx: 'spin',
    dur: 1.5, tick: 0.25, mul: 1.83, radius: 50, kb: 7,
    pose: { mode: 'overheadSlow', a0: -0.56, a1: 0.80, dur: 0.36, ease: 'both' },
    shape: 'cleaveTwin', color: [C.white, C.ink3],
    shv: 1,
    snd: 'wu2', hitSnd: 'forge2',
    desc: '旋身一息半，边走边斩，多段见血。',
  },
  blade_5: {
    id: 'blade_5', fam: 'blade', slot: 'move', name: '疾风步', prof: 6,
    cd: 9, cost: 10.8, fx: 'dash', mul: 4.05, radius: 24, kb: 6,
    dash: { dir: 'face', dist: 52, iframe: 0.22, forceCrit: true },
    pose: { mode: 'overheadFast', a0: 0.05, a1: 0.93, dur: 0.24, ease: 'out' },
    shape: 'cleaveThin', color: [C.white, C.paper2],
    shv: 2,
    snd: 'wu3', hitSnd: 'forge3',
    desc: '掠步前欺，下一击必取要害。',
  },
  blade_6: {
    id: 'blade_6', fam: 'blade', slot: 'ctrl', name: '断筋', prof: 8,
    cd: 12, cost: 14.4, fx: 'melee',
    reach: 38, arc: 2.0, mul: 5.4, kb: 8,
    status: { kind: 'slow', dur: 3, pct: 0.6 },
    pose: { mode: 'sideHigh', a0: 0.60, a1: 1.46, dur: 0.20, ease: 'out' },
    shape: 'cleaveWide', color: [C.white, C.paper1],
    shv: 1,
    snd: 'wu4', hitSnd: 'forge4',
    desc: '刀锋挑筋，三息内寸步难行。',
  },
  blade_7: {
    id: 'blade_7', fam: 'blade', slot: 'buff', name: '狂怒', prof: 10,
    cd: 24, cost: 28.8, fx: 'buff', power: 12,
    buff: { dur: 10, atkPct: 30, hurtPct: 15 },
    pose: { mode: 'sideLow', a0: 1.23, a1: 1.70, dur: 0.44, ease: 'in' },
    shape: 'arcThin', color: [C.red3, C.red1],
    shv: 2,
    snd: 'wu5', hitSnd: 'forge5',
    desc: '十息内刀势更狠，皮肉也更薄。',
  },
  blade_8: {
    id: 'blade_8', fam: 'blade', slot: 'special', name: '血战八方', prof: 4,
    cd: 28, cost: 33.6, fx: 'spin',
    dur: 2.0, tick: 0.25, mul: 2.2, kb: 7, radius: 52, lifeOnHit: 0.02,
    pose: { mode: 'reverseHigh', a0: -0.95, a1: 0.40, dur: 0.42, ease: 'in' },
    shape: 'arcTall', color: [C.gold2, C.red2],
    shv: 1,
    snd: 'windup1', hitSnd: 'quake1',
    desc: '八段环斩，每一段命中都回两分气血。',
  },

  // ---------- 枪 · 距离 / 穿刺 ----------
  spear_1: {
    id: 'spear_1', fam: 'spear', slot: 'dmg', name: '贯甲刺', prof: 1,
    cd: 5, cost: 6, fx: 'cleave',
    len: 120, width: 30, mul: 7.5, pierceDef: 0.4, kb: 10,
    pose: { mode: 'flick', a0: -2.40, a1: -0.90, dur: 0.30, ease: 'out' },
    shape: 'point', color: [C.white, C.jade1],
    shv: 2,
    snd: 'windup2', hitSnd: 'quake2',
    desc: '一枪贯穿，沿途所有敌手俱伤，无视四成防御。',
  },
  spear_2: {
    id: 'spear_2', fam: 'spear', slot: 'dmg', name: '枪阵', prof: 2,
    cd: 6, cost: 7.2, fx: 'melee',
    reach: 46, arc: 1.0, mul: 3.2, hits: 3, kb: 6, kbLast: 10,
    pose: { mode: 'charge', a0: -1.95, a1: -0.83, dur: 0.22, ease: 'out' },
    shape: 'rain', color: [C.white, C.red1],
    shv: 2,
    snd: 'windup3', hitSnd: 'quake3',
    desc: '三刺连出，末一记把人挑开。',
  },
  spear_3: {
    id: 'spear_3', fam: 'spear', slot: 'aoe', name: '回马枪', prof: 3,
    cd: 4, cost: 4.8, fx: 'melee',
    reach: 44, arc: 1.6, mul: 3.4, back: true, backBonus: 1.4, kb: 9,
    pose: { mode: 'cast', a0: -1.45, a1: -0.35, dur: 0.26, ease: 'both' },
    shape: 'trail', color: [C.white, C.gold1],
    shv: 2,
    snd: 'windup4', hitSnd: 'quake4',
    desc: '反手向身后一记突刺，回身反打格外狠。',
  },
  spear_4: {
    id: 'spear_4', fam: 'spear', slot: 'aoe', name: '天狼啸月', prof: 5,
    cd: 30, cost: 36, fx: 'melee',
    reach: 90, arc: 6.28, mul: 33, kb: 18,
    pose: { mode: 'thrustUp', a0: -0.45, a1: 0.70, dur: 0.50, ease: 'in' },
    shape: 'lanceTwin', color: [C.white, C.gold3],
    shv: 3,
    snd: 'windup5', hitSnd: 'quake5',
    desc: '枪尖画圆，九步之内尽在其下。',
  },
  spear_5: {
    id: 'spear_5', fam: 'spear', slot: 'move', name: '游龙步', prof: 6,
    cd: 10, cost: 12, fx: 'dash', mul: 4.5, radius: 26, kb: 6,
    dash: { dir: 'side', dist: 70, iframe: 0.5 },
    pose: { mode: 'thrustDown', a0: 0.05, a1: 1.00, dur: 0.28, ease: 'out' },
    shape: 'lanceSpin', color: [C.white, C.pur1],
    shv: 3,
    snd: 'dash1', hitSnd: 'slash1',
    desc: '侧身游走七步，全程不沾片叶。',
  },
  spear_6: {
    id: 'spear_6', fam: 'spear', slot: 'ctrl', name: '定军', prof: 8,
    cd: 14, cost: 16.8, fx: 'zone', mul: 0.8,
    zone: { dur: 4, tick: 0.5, radius: 70, shape: 'circle' },
    status: { kind: 'slow', dur: 1, pct: 0.5 },
    pose: { mode: 'lungeFar', a0: 0.55, a1: 1.20, dur: 0.32, ease: 'in' },
    shape: 'arcWide', color: [C.paper2, C.paper1],
    shv: 3,
    snd: 'dash2', hitSnd: 'slash2',
    desc: '长枪插地，四息内方圆七步皆成泥沼。',
  },
  spear_7: {
    id: 'spear_7', fam: 'spear', slot: 'buff', name: '枪势', prof: 10,
    cd: 18, cost: 21.6, fx: 'buff', power: 9,
    buff: { dur: 8, reachPct: 40, pierce: 1 },
    pose: { mode: 'lungeSpin', a0: 1.10, a1: 1.60, dur: 0.40, ease: 'out' },
    shape: 'rainSparse', color: [C.white, C.black],
    shv: 2,
    snd: 'dash3', hitSnd: 'slash3',
    desc: '枪意铺开八息，够得更远、也穿得更透。',
  },
  spear_8: {
    id: 'spear_8', fam: 'spear', slot: 'special', name: '挑飞', prof: 4,
    cd: 8, cost: 9.6, fx: 'melee',
    reach: 44, arc: 1.6, mul: 5.6, kb: 4, launch: true,
    pose: { mode: 'sweepThin', a0: -0.86, a1: 0.20, dur: 0.34, ease: 'in' },
    shape: 'trailThin', color: [C.white, C.red2],
    shv: 2,
    snd: 'dash4', hitSnd: 'slash4',
    desc: '上挑掀飞，落地再受一记摔伤。',
  },

  // ---------- 棍 · 范围 / 格挡 ----------
  staff_1: {
    id: 'staff_1', fam: 'staff', slot: 'dmg', name: '扫棍', prof: 1,
    cd: 3, cost: 3.6, fx: 'melee',
    reach: 42, arc: 3.4, mul: 5.6, kb: 9,
    pose: { mode: 'channel', a0: -2.45, a1: -0.75, dur: 0.24, ease: 'out' },
    shape: 'sigil', color: [C.white, C.gold2],
    shv: 3,
    snd: 'dash5', hitSnd: 'slash5',
    desc: '半圆横扫，冷却最短的棍法。',
  },
  staff_2: {
    id: 'staff_2', fam: 'staff', slot: 'dmg', name: '崩棍', prof: 2,
    cd: 5, cost: 6, fx: 'melee',
    reach: 40, arc: 1.3, mul: 8.0, kb: 18,
    pose: { mode: 'spin', a0: -1.95, a1: -0.61, dur: 0.20, ease: 'out' },
    shape: 'spiral', color: [C.white, C.pur2],
    shv: 2,
    snd: 'thunder1', hitSnd: 'thunder1',
    desc: '棍尾一崩，只打一人，打得最远。',
  },
  staff_3: {
    id: 'staff_3', fam: 'staff', slot: 'aoe', name: '捅棍', prof: 3,
    cd: 4, cost: 4.8, fx: 'proj',
    count: 1, speed: 300, size: 11, life: 0.55, pierce: 4, mul: 4.8,
    pose: { mode: 'ring', a0: -1.45, a1: -0.15, dur: 0.28, ease: 'out' },
    shape: 'chargeLine', color: [C.white, C.jade3],
    shv: 3,
    snd: 'thunder2', hitSnd: 'thunder2',
    desc: '一棍直捅，连人带影穿成串。',
  },
  staff_4: {
    id: 'staff_4', fam: 'staff', slot: 'aoe', name: '跃棍', prof: 5,
    cd: 9, cost: 10.8, fx: 'shockwave',
    radius: 56, speed: 260, dur: 0.5, mul: 8.2, kb: 12, centerBonus: 1.5, centerR: 24,
    pose: { mode: 'castHigh', a0: -0.29, a1: 0.70, dur: 0.42, ease: 'in' },
    shape: 'sigilHex', color: [C.white, C.pur3],
    shv: 1,
    snd: 'thunder3', hitSnd: 'thunder3',
    desc: '跃起砸地，落点正中尤其沉重。',
  },
  staff_5: {
    id: 'staff_5', fam: 'staff', slot: 'move', name: '疾风棍', prof: 6,
    cd: 8, cost: 9.6, fx: 'dash', mul: 3.6, radius: 26, kb: 8,
    dash: { dir: 'face', dist: 58, iframe: 0.2, shieldPct: 8 },
    pose: { mode: 'castLow', a0: 0.10, a1: 0.12, dur: 0.26, ease: 'out' },
    shape: 'sigilRune', color: [C.white, C.red3],
    shv: 2,
    snd: 'forge1', hitSnd: 'thunder4',
    desc: '棍影护身前冲，路上顺手砸开一条道。',
  },
  staff_6: {
    id: 'staff_6', fam: 'staff', slot: 'ctrl', name: '缠棍', prof: 8,
    cd: 12, cost: 14.4, fx: 'pull', mul: 5.4, radius: 80, kb: 4,
    pose: { mode: 'castSpin', a0: 0.60, a1: 1.20, dur: 0.30, ease: 'out' },
    shape: 'sigilStar', color: [C.white, C.paper3],
    shv: 3,
    snd: 'forge2', hitSnd: 'windup1',
    desc: '棍梢一卷，把八步内最近的敌手拽到面前。',
  },
  staff_7: {
    id: 'staff_7', fam: 'staff', slot: 'buff', name: '铁布衫', prof: 10,
    cd: 20, cost: 24, fx: 'buff', power: 10,
    buff: { dur: 5, dmgReduce: 50, shieldPct: 10 },
    pose: { mode: 'channelHigh', a0: 1.15, a1: 1.60, dur: 0.34, ease: 'in' },
    shape: 'spiralTight', color: [C.paper3, C.ink1],
    shv: 4,
    snd: 'forge3', hitSnd: 'windup2',
    desc: '五息横练，挨打只剩一半疼。',
  },
  staff_8: {
    id: 'staff_8', fam: 'staff', slot: 'special', name: '舞棍', prof: 4,
    cd: 10, cost: 12, fx: 'spin',
    dur: 2.0, tick: 0.25, mul: 1.5, kb: 6, radius: 44, reflect: true,
    pose: { mode: 'channelLong', a0: -0.95, a1: 0.40, dur: 0.36, ease: 'both' },
    shape: 'spiralWide', color: [C.paper3, C.ink2],
    shv: 2,
    snd: 'forge4', hitSnd: 'windup3',
    desc: '舞棍两息，格开并反弹所有飞来之物。',
  },

  // ---------- 双刀 · 多段 / 位移 ----------
  dual_1: {
    id: 'dual_1', fam: 'dual', slot: 'dmg', name: '双牙', prof: 1,
    cd: 2.5, cost: 3, fx: 'melee',
    reach: 32, arc: 1.8, mul: 2.5, hits: 2, kb: 4,
    pose: { mode: 'slam', a0: -2.45, a1: -1.05, dur: 0.20, ease: 'out' },
    shape: 'fan', color: [C.paper3, C.ink3],
    shv: 4,
    snd: 'forge5', hitSnd: 'windup4',
    desc: '极快两连，最短冷却。',
  },
  dual_2: {
    id: 'dual_2', fam: 'dual', slot: 'dmg', name: '十字斩', prof: 2,
    cd: 5, cost: 6, fx: 'melee',
    reach: 34, arc: 2.2, mul: 4.0, hits: 2, kb: 5, critLast: true,
    pose: { mode: 'slamLow', a0: -1.95, a1: -0.55, dur: 0.28, ease: 'out' },
    shape: 'cross', color: [C.paper3, C.paper1],
    shv: 2,
    snd: 'boomerang1', hitSnd: 'windup5',
    desc: '两刀交叉，后一刀专取破绽。',
  },
  dual_3: {
    id: 'dual_3', fam: 'dual', slot: 'aoe', name: '乱舞', prof: 3,
    cd: 10, cost: 12, fx: 'melee',
    reach: 56, arc: 6.28, mul: 2.0, hits: 6, randomTargets: 6, kb: 4,
    pose: { mode: 'throw', a0: -0.95, a1: 0.30, dur: 0.34, ease: 'both' },
    shape: 'hook', color: [C.paper3, C.jade1],
    shv: 3,
    snd: 'boomerang2', hitSnd: 'qi1',
    desc: '六段乱斩，刀刀换个方向。',
  },
  dual_4: {
    id: 'dual_4', fam: 'dual', slot: 'aoe', name: '千刃', prof: 5,
    cd: 30, cost: 36, fx: 'zone', mul: 3.3,
    zone: { dur: 3, tick: 0.3, radius: 100, shape: 'circle' },
    pose: { mode: 'flickHigh', a0: -0.53, a1: 0.40, dur: 0.46, ease: 'in' },
    shape: 'fanNarrow', color: [C.paper3, C.red1],
    shv: 5,
    snd: 'boomerang3', hitSnd: 'qi2',
    desc: '刀刃成风，三息内十步方圆无人能立。',
  },
  dual_5: {
    id: 'dual_5', fam: 'dual', slot: 'move', name: '影袭', prof: 6,
    cd: 8, cost: 9.6, fx: 'dash', mul: 3.6, radius: 26, kb: 5,
    dash: { dir: 'target', dist: 48, iframe: 0.18, nextDmg: 0.5 },
    pose: { mode: 'flickLow', a0: 0.05, a1: 0.90, dur: 0.26, ease: 'out' },
    shape: 'fanWide', color: [C.paper3, C.gold1],
    shv: 3,
    snd: 'boomerang4', hitSnd: 'qi3',
    desc: '闪到敌手背后，紧接着那一刀更狠。',
  },
  dual_6: {
    id: 'dual_6', fam: 'dual', slot: 'ctrl', name: '割喉', prof: 8,
    cd: 12, cost: 14.4, fx: 'melee',
    reach: 32, arc: 1.0, mul: 5.4, kb: 4, critAdd: 60,
    status: { kind: 'slow', dur: 3, pct: 0.4 },
    pose: { mode: 'flickTurn', a0: 0.26, a1: 1.20, dur: 0.30, ease: 'out' },
    shape: 'fanArc', color: [C.paper3, C.pur1],
    shv: 4,
    snd: 'boomerang5', hitSnd: 'qi4',
    desc: '贴身一记，几乎必取要害，中者气息滞涩。',
  },
  dual_7: {
    id: 'dual_7', fam: 'dual', slot: 'buff', name: '杀意', prof: 10,
    cd: 22, cost: 26.4, fx: 'buff', power: 11,
    buff: { dur: 8, critDmg: 50, spd: 15 },
    pose: { mode: 'sideWide', a0: 1.23, a1: 1.70, dur: 0.40, ease: 'in' },
    shape: 'crossThin', color: [C.pur2, C.pur1],
    shv: 4,
    snd: 'crit1', hitSnd: 'qi5',
    desc: '八息杀意翻涌，会心更重、脚下更快。',
  },
  dual_8: {
    id: 'dual_8', fam: 'dual', slot: 'special', name: '疾影', prof: 4,
    cd: 9, cost: 10.8, fx: 'blink',
    times: 3, dist: 52, mul: 3.5, radius: 26,
    pose: { mode: 'spinTight', a0: -1.45, a1: -0.17, dur: 0.24, ease: 'out' },
    shape: 'crossThick', color: [C.paper3, C.black],
    shv: 3,
    snd: 'crit2', hitSnd: 'wu1',
    desc: '三次短距闪烁，每次穿过敌手都留下一刀。',
  },

  // ---------- 锤 · 重量与时机 ----------
  // 性格：一个动作，一个结果，中间没有第二下。
  // 没有连段、没有多段命中、没有持续旋转 —— 对手感受到的是"被砸中一次就完了"。
  // 起手要长（看得见），收招要空（打得掉），落点要实（砸下去就有东西碎）。
  // 八招八种形状 / 八种动作 / 八种颜色，见 ARTS-DESIGN.md §4。
  hammer_1: {
    id: 'hammer_1', fam: 'hammer', slot: 'dmg', name: '碎骨锤', prof: 1,
    cd: 6, cost: 7.2, fx: 'melee',
    // 一个点：极窄扇 + 短 reach。打中的往往只有一个人。
    reach: 34, arc: 0.55, mul: 8.4, kb: 16,
    status: { kind: 'break', dur: 4, pct: 0 },
    pose: { mode: 'overheadBig', a0: -1.90, a1: 0.45, dur: 0.34, ease: 'in' },
    shape: 'shockwave', color: [C.paper3, C.jade2],
    shv: 4,
    snd: 'quake1', hitSnd: 'wu2',
    desc: '一锤碎骨，四息内对方防御减四成。',
  },
  hammer_2: {
    id: 'hammer_2', fam: 'hammer', slot: 'dmg', name: '回旋锤', prof: 2,
    cd: 5, cost: 6, fx: 'boomerang',
    // 锤脱手飞出去，转一圈，回到手上。飞出去那半秒人是空的。
    dist: 200, flight: 0.66, bulge: 16, mul: 8.0, kb: 14,
    pose: { mode: 'plant', a0: -1.20, a1: 0.90, dur: 0.22, ease: 'out' },
    shape: 'crack', color: [C.paper3, C.red2],
    shv: 1,
    snd: 'quake2', hitSnd: 'wu3',
    desc: '锤脱手而出，走一圈再回手里，去回各伤一次。',
  },
  hammer_3: {
    id: 'hammer_3', fam: 'hammer', slot: 'aoe', name: '震地', prof: 3,
    cd: 8, cost: 9.6, fx: 'shockwave',
    // 一圈冲击波从脚下往外扩 —— 远处的人晚半拍才飞。
    radius: 84, speed: 240, mul: 9.6, kb: 18, dur: 0.6,
    pose: { mode: 'guard', a0: -2.60, a1: 1.00, dur: 0.42, ease: 'in' },
    shape: 'plant', color: [C.paper3, C.gold2],
    shv: 2,
    snd: 'quake3', hitSnd: 'wu4',
    desc: '锤落地面，一圈震波往外推开，八步内一并震起。',
  },
  hammer_4: {
    id: 'hammer_4', fam: 'hammer', slot: 'aoe', name: '地裂', prof: 5,
    cd: 12, cost: 14.4, fx: 'zone', mul: 1.65,
    // 四段向前的线，但**依次**裂开（stagger）—— 一起亮出来就只是一块红斑
    zone: { dur: 4, tick: 0.5, radius: 34, shape: 'line', count: 4, stagger: 0.08 },
    status: { kind: 'burn', dur: 2, pct: 0.06 },
    pose: { mode: 'leap', a0: -1.50, a1: 0.80, dur: 0.30, ease: 'in', hold: 0.40 },
    shape: 'boomerang', color: [C.paper3, C.pur2],
    shv: 1,
    snd: 'quake4', hitSnd: 'wu5',
    desc: '一道裂地向前铺开，四息内踩着就伤。',
  },
  hammer_5: {
    id: 'hammer_5', fam: 'hammer', slot: 'move', name: '冲锋锤', prof: 6,
    cd: 9, cost: 10.8, fx: 'charge', mul: 4.05, kb: 16,
    // 直线冲 84px，撞到第一个就停 —— "会停"才是冲锋有重量的原因
    dist: 84, iframe: 0.18,
    pose: { mode: 'sweepLow', a0: 0, a1: 0.00, dur: 0.26, ease: 'out' },
    shape: 'shockThin', color: [C.paper3, C.jade3],
    shv: 4,
    snd: 'quake5', hitSnd: 'dash1',
    desc: '低头撞出去八步，撞上第一个就停。',
  },
  hammer_6: {
    id: 'hammer_6', fam: 'hammer', slot: 'ctrl', name: '眩晕击', prof: 8,
    cd: 16, cost: 19.2, fx: 'melee',
    // 横抡：从侧后抡到正前，砸在太阳穴上。只打一个人。
    reach: 36, arc: 1.0, mul: 7.2, kb: 12, nearestOnly: true,
    status: { kind: 'stun', dur: 2 },
    pose: { mode: 'slamSlow', a0: -2.20, a1: 0.25, dur: 0.30, ease: 'in' },
    shape: 'shockThick', color: [C.paper3, C.gold3],
    shv: 1,
    snd: 'levelup1', hitSnd: 'dash2',
    desc: '一记闷锤，两息不知东西。',
  },
  hammer_7: {
    id: 'hammer_7', fam: 'hammer', slot: 'buff', name: '铁壁', prof: 10,
    cd: 20, cost: 24, fx: 'buff', power: 10,
    buff: { dur: 8, shieldPct: 20, hurtReflect: 30 },
    // 锤往地上一插，人半蹲在锤后面八息 —— 增益类招式的样板表现
    pose: { mode: 'slamFast', a0: -0.90, a1: 0.10, dur: 0.28, ease: 'in', hold: 8 },
    shape: 'shockDouble', color: [C.paper3, C.pur3],
    shv: 1,
    snd: 'levelup2', hitSnd: 'dash3',
    desc: '锤插地上，八息罡气护体，近身来打的都要还三成。',
  },
  hammer_8: {
    id: 'hammer_8', fam: 'hammer', slot: 'special', name: '开天辟地', prof: 4,
    cd: 32, cost: 38.4, fx: 'cleave',
    // 一条线，不是一个圆。举锤蓄力半息，然后一记纵向巨劈。
    len: 132, width: 58, mul: 22.8, kb: 24, centerBonus: 1.5, centerR: 46,
    pose: { mode: 'slamWide', a0: -2.70, a1: 1.20, dur: 0.62, ease: 'in' },
    shape: 'crackBranch', color: [C.paper3, C.red3],
    shv: 3,
    snd: 'levelup3', hitSnd: 'dash4',
    desc: '举锤过顶，一记纵向巨劈，前方一条直线尽数裂开。',
  },

  // ---------- 法杖 · 元素 / 控制 ----------
  // 法杖与暗器普攻 DPS 最低，整组倍率乘 0.75，否则六招一开会变成"等 CD"游戏。
  mage_1: {
    id: 'mage_1', fam: 'mage', slot: 'dmg', name: '灵珠', prof: 1,
    cd: 2, cost: 2.4, fx: 'proj',
    count: 1, speed: 250, size: 11, life: 0.9, pierce: 1, mul: 4.0,
    pose: { mode: 'ringHalf', a0: -2.45, a1: -1.60, dur: 0.22, ease: 'out' },
    shape: 'sigilWheel', color: [C.jade3, C.ink1],
    shv: 5,
    snd: 'levelup4', hitSnd: 'dash5',
    desc: '一枚灵珠，两息一发。',
  },
  mage_2: {
    id: 'mage_2', fam: 'mage', slot: 'dmg', name: '三珠连爆', prof: 2,
    cd: 5, cost: 6, fx: 'proj',
    count: 3, spread: 0.42, speed: 250, size: 10, life: 0.9, pierce: 1,
    mul: 2.0, splash: 24,
    pose: { mode: 'ringFull', a0: -1.95, a1: -0.95, dur: 0.30, ease: 'out' },
    shape: 'sigilNotch', color: [C.jade3, C.ink2],
    shv: 1,
    snd: 'levelup5', hitSnd: 'boomerang1',
    desc: '三珠分袭，触地各炸一小片。',
  },
  mage_3: {
    id: 'mage_3', fam: 'mage', slot: 'aoe', name: '火雨', prof: 3,
    cd: 12, cost: 14.4, fx: 'zone', mul: 1.08,
    zone: { dur: 4, tick: 0.4, radius: 56, shape: 'circle' },
    status: { kind: 'burn', dur: 2, pct: 0.18 },
    pose: { mode: 'ringWide', a0: -1.45, a1: -0.45, dur: 0.42, ease: 'in' },
    shape: 'rainDense', color: [C.jade3, C.ink3],
    shv: 2,
    snd: 'bell1', hitSnd: 'boomerang2',
    desc: '一片火云落定，四息不熄，沾着就灼。',
  },
  mage_4: {
    id: 'mage_4', fam: 'mage', slot: 'aoe', name: '雷链', prof: 5,
    cd: 10, cost: 12, fx: 'bolt',
    count: 3, chain: 3, fall: 0.2, mul: 2.75, radius: 26, range: 190,
    pose: { mode: 'ringTight', a0: -0.45, a1: 0.20, dur: 0.26, ease: 'out' },
    shape: 'rainAngle', color: [C.jade3, C.paper1],
    shv: 5,
    snd: 'bell2', hitSnd: 'boomerang3',
    desc: '一道雷串三人，每跳弱两成。',
  },
  mage_5: {
    id: 'mage_5', fam: 'mage', slot: 'move', name: '瞬闪', prof: 6,
    cd: 8, cost: 9.6, fx: 'dash', mul: 2.7, radius: 24, kb: 4,
    dash: { dir: 'face', dist: 90, iframe: 0.3 },
    pose: { mode: 'channelSpin', a0: 0.05, a1: 0.88, dur: 0.24, ease: 'out' },
    shape: 'ringThin', color: [C.jade3, C.jade1],
    shv: 6,
    snd: 'bell3', hitSnd: 'boomerang4',
    desc: '身影一晃已在九步外，原地只留残影。',
  },
  mage_6: {
    id: 'mage_6', fam: 'mage', slot: 'ctrl', name: '冰封', prof: 8,
    cd: 10, cost: 12, fx: 'melee',
    reach: 44, arc: 1.6, mul: 3.4, kb: 3,
    status: { kind: 'freeze', dur: 2 },
    pose: { mode: 'sweepRise', a0: 0.51, a1: 1.10, dur: 0.34, ease: 'in' },
    shape: 'ringThick', color: [C.jade3, C.red1],
    shv: 5,
    snd: 'bell4', hitSnd: 'boomerang5',
    desc: '寒气凝住两息，冻着的时候更禁打。',
  },
  mage_7: {
    id: 'mage_7', fam: 'mage', slot: 'buff', name: '灵护', prof: 10,
    cd: 18, cost: 21.6, fx: 'buff', power: 6.8,
    buff: { dur: 10, shieldPct: 25 },
    pose: { mode: 'sweepFall', a0: 1.15, a1: 1.60, dur: 0.40, ease: 'out' },
    shape: 'ringDouble', color: [C.jade3, C.gold1],
    shv: 2,
    snd: 'bell5', hitSnd: 'bell1',
    desc: '灵光覆身十息，替你挡下四分之一气血的伤。',
  },
  mage_8: {
    id: 'mage_8', fam: 'mage', slot: 'special', name: '天雷引', prof: 4,
    cd: 30, cost: 36, fx: 'bolt',
    count: 5, mul: 4.6, radius: 30, range: 200,
    pose: { mode: 'sweepTurn', a0: -0.95, a1: 0.30, dur: 0.62, ease: 'in' },
    shape: 'ringSpiral', color: [C.jade3, C.pur1],
    shv: 2,
    snd: 'shield1', hitSnd: 'bell2',
    desc: '五道天雷随机落下，各算各的。',
  },

  // ---------- 暗器 · 毒 / 陷阱 ----------
  dart_1: {
    id: 'dart_1', fam: 'dart', slot: 'dmg', name: '飞蝗', prof: 1,
    cd: 1.8, cost: 2.16, fx: 'proj',
    count: 1, speed: 320, size: 7, life: 0.55, pierce: 1, mul: 3.5, kind: 'dart',
    pose: { mode: 'sweepBack', a0: -2.45, a1: -1.25, dur: 0.20, ease: 'out' },
    shape: 'pointStar', color: [C.jade3, C.black],
    shv: 4,
    snd: 'shield2', hitSnd: 'bell3',
    desc: '一镖出手，全武器最短冷却。',
  },
  dart_2: {
    id: 'dart_2', fam: 'dart', slot: 'dmg', name: '三叠浪', prof: 2,
    cd: 4, cost: 4.8, fx: 'proj',
    count: 3, spread: 0.12, speed: 320, size: 7, life: 0.6, pierce: 1,
    mul: 1.6, kind: 'dart',
    pose: { mode: 'sweepWide', a0: -1.95, a1: -0.85, dur: 0.24, ease: 'out' },
    shape: 'pointBurst', color: [C.jade3, C.paper2],
    shv: 6,
    snd: 'shield3', hitSnd: 'bell4',
    desc: '三镖几乎同路，全中一处才见威力。',
  },
  dart_3: {
    id: 'dart_3', fam: 'dart', slot: 'aoe', name: '满天花雨', prof: 3,
    cd: 10, cost: 12, fx: 'proj',
    count: 12, spread: 1.4, speed: 300, size: 7, life: 0.65, pierce: 1,
    mul: 0.75, kind: 'dart',
    pose: { mode: 'sweepPush', a0: -0.54, a1: 0.10, dur: 0.28, ease: 'out' },
    shape: 'pointCross', color: [C.jade3, C.red2],
    shv: 2,
    snd: 'shield4', hitSnd: 'bell5',
    desc: '十二枚扇面齐撒，近处密远处疏。',
  },
  dart_4: {
    id: 'dart_4', fam: 'dart', slot: 'aoe', name: '万箭穿心', prof: 5,
    cd: 30, cost: 36, fx: 'proj',
    count: 24, ring: true, speed: 280, size: 7, life: 0.7, pierce: 1,
    mul: 1.0, kind: 'dart',
    pose: { mode: 'spinWide', a0: -0.53, a1: 0.60, dur: 0.44, ease: 'in' },
    shape: 'fanStar', color: [C.jade3, C.gold2],
    shv: 6,
    snd: 'shield5', hitSnd: 'levelup1',
    desc: '周身二十四镖一齐泼出去，四面皆到。',
  },
  dart_5: {
    id: 'dart_5', fam: 'dart', slot: 'move', name: '缩地', prof: 6,
    cd: 12, cost: 14.4, fx: 'dash', mul: 4.05, radius: 24, kb: 4,
    dash: { dir: 'back', dist: 70, iframe: 0.35, stealth: true },
    pose: { mode: 'spinReverse', a0: 0.05, a1: 0.80, dur: 0.26, ease: 'out' },
    shape: 'fanSplit', color: [C.jade3, C.pur2],
    shv: 7,
    snd: 'boss1', hitSnd: 'levelup2',
    desc: '向后一纵七步，追兵一时失了你的踪迹。',
  },
  dart_6: {
    id: 'dart_6', fam: 'dart', slot: 'ctrl', name: '铁蒺藜', prof: 8,
    cd: 8, cost: 9.6, fx: 'zone', mul: 0.54, power: 4.3,
    zone: { dur: 6, tick: 0.2, radius: 12, shape: 'circle', count: 5, once: true },
    status: { kind: 'stun', dur: 1 },
    pose: { mode: 'sideTurn', a0: 0.60, a1: 1.20, dur: 0.32, ease: 'out' },
    shape: 'trailThick', color: [C.jade3, C.pur3],
    shv: 3,
    snd: 'boss2', hitSnd: 'levelup3',
    desc: '脚下撒五枚蒺藜，踩中定住一息。',
  },
  dart_7: {
    id: 'dart_7', fam: 'dart', slot: 'buff', name: '淬毒', prof: 10,
    cd: 20, cost: 24, fx: 'buff', power: 7.5,
    buff: { dur: 8, poisonOnHit: true },
    pose: { mode: 'sidePush', a0: 1.15, a1: 1.70, dur: 0.40, ease: 'in' },
    shape: 'trailArc', color: [C.jade3, C.red3],
    shv: 3,
    snd: 'boss3', hitSnd: 'levelup4',
    desc: '八息内出手皆带毒，刀镖拳脚一视同仁。',
  },
  dart_8: {
    id: 'dart_8', fam: 'dart', slot: 'special', name: '毒镖', prof: 4,
    cd: 5, cost: 6, fx: 'proj',
    count: 1, speed: 300, size: 8, life: 0.6, pierce: 2, mul: 4.2, kind: 'dart',
    status: { kind: 'poison', dur: 6, pct: 0.10, spread: true },
    pose: { mode: 'plantDeep', a0: -1.45, a1: -0.60, dur: 0.30, ease: 'out' },
    shape: 'trailZig', color: [C.gold3, C.ink1],
    shv: 6,
    snd: 'boss4', hitSnd: 'levelup5',
    desc: '淬毒六息；中毒者倒下时毒气四散，沾上的人一起中毒。',
  },

  // ---------- 链 · 软长 / 缠拽（P12-C 追加，接第二章「守链人」暗线） ----------
  chain_1: {
    id: 'chain_1', fam: 'chain', slot: 'dmg', name: '锁喉', prof: 1,
    cd: 4, cost: 4.8, fx: 'melee',
    reach: 46, arc: 1.0, mul: 6.2, kb: 8, pierceDef: 0.3,
    pose: { mode: 'plantWide', a0: -2.45, a1: -0.93, dur: 0.28, ease: 'out' },
    shape: 'trailDot', color: [C.gold3, C.ink2],
    shv: 5,
    snd: 'boss5', hitSnd: 'shield1',
    desc: '链梢直取咽喉，无视三成防御。',
  },
  chain_2: {
    id: 'chain_2', fam: 'chain', slot: 'dmg', name: '缠身', prof: 2,
    cd: 3, cost: 3.6, fx: 'melee',
    reach: 42, arc: 1.4, mul: 2.0, hits: 3, ramp: 0.10, kb: 5,
    pose: { mode: 'plantTurn', a0: -1.95, a1: -0.65, dur: 0.20, ease: 'out' },
    shape: 'hookUp', color: [C.gold3, C.ink3],
    shv: 7,
    snd: 'rare1', hitSnd: 'shield2',
    desc: '三节链环依次缠上，一节比一节紧。',
  },
  chain_3: {
    id: 'chain_3', fam: 'chain', slot: 'aoe', name: '扫链', prof: 3,
    cd: 6, cost: 7.2, fx: 'melee',
    reach: 50, arc: 6.28, mul: 7.0, kb: 10,
    pose: { mode: 'guardHigh', a0: -2.80, a1: -0.80, dur: 0.36, ease: 'both' },
    shape: 'hookDown', color: [C.gold3, C.paper1],
    shv: 7,
    snd: 'rare2', hitSnd: 'shield3',
    desc: '抡链一匝，周身五步内无人能近。',
  },
  chain_4: {
    id: 'chain_4', fam: 'chain', slot: 'aoe', name: '回旋索', prof: 5,
    cd: 5, cost: 6, fx: 'boomerang',
    dist: 190, flight: 0.66, bulge: 18, mul: 7.6, kb: 12,
    pose: { mode: 'guardLow', a0: -1.20, a1: 0.92, dur: 0.22, ease: 'out' },
    shape: 'hookLong', color: [C.gold3, C.jade1],
    shv: 2,
    snd: 'rare3', hitSnd: 'shield4',
    desc: '整条链脱手盘旋一圈，去回各伤一次。',
  },
  chain_5: {
    id: 'chain_5', fam: 'chain', slot: 'move', name: '曳影', prof: 6,
    cd: 8, cost: 9.6, fx: 'dash', mul: 3.8, radius: 26, kb: 6,
    dash: { dir: 'target', dist: 56, iframe: 0.25, nextDmg: 0.4 },
    pose: { mode: 'guardTurn', a0: 0.10, a1: 0.14, dur: 0.26, ease: 'out' },
    shape: 'spiralDouble', color: [C.gold3, C.red1],
    shv: 5,
    snd: 'rare4', hitSnd: 'shield5',
    desc: '链挂住敌手一拽，人已贴到身后，下一击更沉。',
  },
  chain_6: {
    id: 'chain_6', fam: 'chain', slot: 'ctrl', name: '缚龙', prof: 8,
    cd: 14, cost: 16.8, fx: 'pull', mul: 5.2, radius: 88, kb: 4,
    status: { kind: 'stun', dur: 1.2 },
    pose: { mode: 'leapHigh', a0: -1.45, a1: -0.35, dur: 0.30, ease: 'in' },
    shape: 'spiralReverse', color: [C.gold3, C.gold1],
    shv: 5,
    snd: 'rare5', hitSnd: 'rare1',
    desc: '反手甩链卷回最远那人，一时动弹不得。',
  },
  chain_7: {
    id: 'chain_7', fam: 'chain', slot: 'buff', name: '链势', prof: 10,
    cd: 20, cost: 24, fx: 'buff', power: 10,
    buff: { dur: 8, reachPct: 30, atkSpd: 12 },
    pose: { mode: 'leapFar', a0: 1.15, a1: 1.80, dur: 0.34, ease: 'in' },
    shape: 'ringDash', color: [C.gold3, C.pur1],
    shv: 8,
    snd: 'hit1', hitSnd: 'rare2',
    desc: '链垂于地八息，够得更远、出手更快。',
  },
  chain_8: {
    id: 'chain_8', fam: 'chain', slot: 'special', name: '万链归墟', prof: 4,
    cd: 30, cost: 36, fx: 'orbit',
    count: 10, dur: 5, mul: 1.7, radius: 36,
    pose: { mode: 'throwHigh', a0: -2.70, a1: 1.22, dur: 0.62, ease: 'in' },
    shape: 'ringWide', color: [C.gold3, C.black],
    shv: 4,
    snd: 'hit2', hitSnd: 'rare3',
    desc: '十节链环离身盘旋五息，各自追敌结算。',
  },

  // ---------- 扇 · 风符 / 控场（P12-C 追加，不靠弹体打中远距） ----------
  fan_1: {
    id: 'fan_1', fam: 'fan', slot: 'dmg', name: '点穴', prof: 1,
    cd: 3, cost: 3.6, fx: 'melee',
    reach: 32, arc: 0.9, mul: 5.6, kb: 5, critAdd: 40,
    pose: { mode: 'overheadWide', a0: -2.45, a1: -1.15, dur: 0.20, ease: 'out' },
    shape: 'crossStar', color: [C.gold3, C.paper2],
    shv: 7,
    snd: 'hit3', hitSnd: 'rare4',
    desc: '收扇以扇骨一点，专取要害。',
  },
  fan_2: {
    id: 'fan_2', fam: 'fan', slot: 'dmg', name: '折影', prof: 2,
    cd: 5, cost: 6, fx: 'melee',
    reach: 34, arc: 1.6, mul: 2.6, hits: 2, critLast: true, kb: 5,
    pose: { mode: 'overheadLeft', a0: -1.95, a1: 0.25, dur: 0.28, ease: 'in' },
    shape: 'crossSplit', color: [C.gold3, C.jade2],
    shv: 4,
    snd: 'hit4', hitSnd: 'rare5',
    desc: '一开一合两记，合扇那下必取破绽。',
  },
  fan_3: {
    id: 'fan_3', fam: 'fan', slot: 'aoe', name: '扇风', prof: 3,
    cd: 9, cost: 10.8, fx: 'shockwave',
    radius: 72, speed: 250, dur: 0.5, mul: 7.4, kb: 12, centerBonus: 1.3, centerR: 22,
    pose: { mode: 'throwFar', a0: -2.20, a1: -0.80, dur: 0.30, ease: 'in' },
    shape: 'boomerangFlat', color: [C.gold3, C.red2],
    shv: 3,
    snd: 'hit5', hitSnd: 'boss1',
    desc: '展扇推出一圈气浪，波前所过尽退，正中尤其沉重。',
  },
  fan_4: {
    id: 'fan_4', fam: 'fan', slot: 'aoe', name: '落符', prof: 5,
    cd: 10, cost: 12, fx: 'bolt',
    count: 6, mul: 1.2, radius: 24, range: 160,
    pose: { mode: 'chargeHigh', a0: -0.71, a1: 0.59, dur: 0.42, ease: 'in' },
    shape: 'boomerangHigh', color: [C.gold3, C.pur2],
    shv: 3,
    snd: 'crit3', hitSnd: 'boss2',
    desc: '六道符纸自扇面散落，各寻各的目标。',
  },
  fan_5: {
    id: 'fan_5', fam: 'fan', slot: 'move', name: '随风', prof: 6,
    cd: 8, cost: 9.6, fx: 'dash', mul: 3.2, radius: 24, kb: 4,
    dash: { dir: 'side', dist: 62, iframe: 0.4 },
    pose: { mode: 'chargeLong', a0: -0.90, a1: 0.00, dur: 0.24, ease: 'out' },
    shape: 'chargeWide', color: [C.gold3, C.jade3],
    shv: 8,
    snd: 'crit4', hitSnd: 'boss3',
    desc: '借风侧掠六步，一路扇骨扫开追兵。',
  },
  fan_6: {
    id: 'fan_6', fam: 'fan', slot: 'ctrl', name: '引风', prof: 8,
    cd: 12, cost: 14.4, fx: 'zone', mul: 0.9,
    zone: { dur: 4, tick: 0.5, radius: 60, shape: 'circle' },
    status: { kind: 'slow', dur: 1.5, pct: 0.5 },
    pose: { mode: 'chargeTurn', a0: 0.29, a1: 0.99, dur: 0.32, ease: 'in' },
    shape: 'chargeDust', color: [C.gold3, C.pur3],
    shv: 9,
    snd: 'crit5', hitSnd: 'boss4',
    desc: '身周起四息旋风，踏入者步履滞涩。',
  },
  fan_7: {
    id: 'fan_7', fam: 'fan', slot: 'buff', name: '凝神', prof: 10,
    cd: 20, cost: 24, fx: 'buff', power: 9,
    buff: { dur: 8, pierce: 1, atkPct: 15 },
    pose: { mode: 'reverseTurn', a0: 0.84, a1: 1.44, dur: 0.40, ease: 'in' },
    shape: 'crackStraight', color: [C.gold3, C.red3],
    shv: 3,
    snd: 'thunder4', hitSnd: 'boss5',
    desc: '敛息八息，出手更锐，也穿得更透。',
  },
  fan_8: {
    id: 'fan_8', fam: 'fan', slot: 'special', name: '风雷引', prof: 4,
    cd: 30, cost: 36, fx: 'cleave',
    len: 110, width: 40, mul: 14, kb: 14, centerBonus: 1.4, centerR: 30,
    pose: { mode: 'spinStar', a0: -2.73, a1: 1.17, dur: 0.62, ease: 'in' },
    shape: 'crackWide', color: [C.pur3, C.ink1],
    shv: 4,
    snd: 'thunder5', hitSnd: 'thunder5',
    desc: '双扇尽展，一记风雷沿正前方直贯百步。',
  },
};

// 十种效果原语。自检拿它验"每一招都落在分派器认得的类型里"，
// game.js 的 execArt 分支也照这个清单对齐 —— 加原语时两处一起改。
export const ART_FX = ['melee', 'proj', 'spin', 'orbit', 'blink', 'bolt', 'dash', 'buff', 'zone', 'pull',
  'boomerang', 'shockwave', 'charge', 'cleave'];

// ============ 签名推导（运行时与自检共用一把尺子） ============
// 这三条是 ARTS-DESIGN.md §1 的四条硬规矩里，能自动断言的那三条。
// 关键：推导只写一份。运行时按它画，自检按它查重 —— 两边各写一份，
// 迟早在"某招到底算 ring 还是 arc"上漂开（artPower 当初就是这么吃过亏的）。
// P11：七件兵器各自八种形状 / 八种动作，新补七形八式（都是通用画法，不为某一招专造）。
// ============ P12-E：字面零重复的四个池 ============
// 用户要求「字段本身不许复用」—— 这里不再有「基础原型 + 变体」这种复合签名。
//   · ART_SHAPES 80 个：19 种老画法 + 61 种新画法（ART_SHAPE_SPECS 给参数）
//   · ART_POSES  80 个：20 种老动作 + 60 种新动作（ART_POSE_SPECS 给参数）
//   · ART_SNDS   80 个：16 个音色原型 × 5 档（档位换音高与时长）
// 全表 80 招的 shape / pose.mode / snd / hitSnd 四个字段各自用满 80 个不同值。
export const ART_SHAPES = [
  'point', 'overheadArc', 'shockwave', 'crack', 'cleave', 'boomerang',
  'sideArc', 'chargeLine', 'plant', 'arc', 'ring', 'thrust',
  'fan', 'cross', 'rain', 'sigil', 'trail', 'spiral',
  'hook', 'arcUp', 'arcDown', 'arcWide', 'arcThin', 'arcTall',
  'ringThin', 'ringThick', 'ringDouble', 'ringSpiral', 'ringDash', 'ringWide',
  'lanceLong', 'lanceShort', 'lanceWide', 'lanceTwin', 'lanceSpin', 'fanNarrow',
  'fanWide', 'fanArc', 'fanStar', 'fanSplit', 'crossThin', 'crossThick',
  'crossStar', 'crossSplit', 'sigilHex', 'sigilRune', 'sigilStar', 'sigilWheel',
  'sigilNotch', 'trailThin', 'trailThick', 'trailArc', 'trailZig', 'trailDot',
  'spiralTight', 'spiralWide', 'spiralDouble', 'spiralReverse', 'rainSparse', 'rainDense',
  'rainAngle', 'pointStar', 'pointBurst', 'pointCross', 'hookUp', 'hookDown',
  'hookLong', 'crackBranch', 'crackStraight', 'crackWide', 'shockThin', 'shockThick',
  'shockDouble', 'cleaveTwin', 'cleaveThin', 'cleaveWide', 'boomerangFlat', 'boomerangHigh',
  'chargeWide', 'chargeDust',
];

export const ART_POSES = [
  'swing', 'thrust', 'ring', 'cast', 'overhead', 'overheadBig',
  'slam', 'slamLow', 'sideSwing', 'throw', 'plant', 'charge',
  'lunge', 'flick', 'sweepLow', 'reverse', 'guard', 'channel',
  'leap', 'spin', 'sweepHigh', 'sweepThin', 'sweepRise', 'sweepFall',
  'sweepTurn', 'sweepBack', 'sweepWide', 'sweepPush', 'lungeHigh', 'lungeLow',
  'lungeFar', 'lungeSpin', 'thrustLong', 'thrustShort', 'thrustUp', 'thrustDown',
  'ringHalf', 'ringFull', 'ringWide', 'ringTight', 'castHigh', 'castLow',
  'castSpin', 'overheadSlow', 'overheadFast', 'overheadWide', 'overheadLeft', 'slamSlow',
  'slamFast', 'slamWide', 'sideHigh', 'sideLow', 'sideWide', 'sideTurn',
  'sidePush', 'throwHigh', 'throwFar', 'plantDeep', 'plantWide', 'plantTurn',
  'chargeHigh', 'chargeLong', 'chargeTurn', 'flickHigh', 'flickLow', 'flickTurn',
  'guardHigh', 'guardLow', 'guardTurn', 'channelHigh', 'channelLong', 'channelSpin',
  'leapHigh', 'leapFar', 'reverseHigh', 'reverseTurn', 'spinTight', 'spinWide',
  'spinReverse', 'spinStar',
];

export const ART_SNDS = [
  'slash1', 'slash2', 'slash3', 'slash4', 'slash5', 'qi1',
  'qi2', 'qi3', 'qi4', 'qi5', 'wu1', 'wu2',
  'wu3', 'wu4', 'wu5', 'dash1', 'dash2', 'dash3',
  'dash4', 'dash5', 'windup1', 'windup2', 'windup3', 'windup4',
  'windup5', 'thunder1', 'thunder2', 'thunder3', 'thunder4', 'thunder5',
  'forge1', 'forge2', 'forge3', 'forge4', 'forge5', 'quake1',
  'quake2', 'quake3', 'quake4', 'quake5', 'boomerang1', 'boomerang2',
  'boomerang3', 'boomerang4', 'boomerang5', 'levelup1', 'levelup2', 'levelup3',
  'levelup4', 'levelup5', 'bell1', 'bell2', 'bell3', 'bell4',
  'bell5', 'shield1', 'shield2', 'shield3', 'shield4', 'shield5',
  'boss1', 'boss2', 'boss3', 'boss4', 'boss5', 'rare1',
  'rare2', 'rare3', 'rare4', 'rare5', 'hit1', 'hit2',
  'hit3', 'hit4', 'hit5', 'crit1', 'crit2', 'crit3',
  'crit4', 'crit5',
];

// 新刀光的参数表：名字 → 用哪种原子画法 + 参数。
// 渲染在 game.js 的 artShapeSpec()，与 19 种老画法共用同一套 ghost 原子。
export const ART_SHAPE_SPECS = {
  arcUp: { k: 'arc', tilt: -0.55, wide: 0.95, r: 1.0, rays: 3 },
  arcDown: { k: 'arc', tilt: 0.55, wide: 0.95, r: 1.0, rays: 3 },
  arcWide: { k: 'arc', tilt: 0.0, wide: 1.55, r: 0.92, rays: 4 },
  arcThin: { k: 'arc', tilt: 0.0, wide: 0.42, r: 1.12, rays: 2 },
  arcTall: { k: 'arc', tilt: -0.25, wide: 0.7, r: 1.3, rays: 5 },
  ringThin: { k: 'ring', r: 1.0, count: 1, w: 0.8 },
  ringThick: { k: 'ring', r: 0.86, count: 1, w: 2.2 },
  ringDouble: { k: 'ring', r: 1.05, count: 2, w: 1.0 },
  ringSpiral: { k: 'ring', r: 0.95, count: 2, w: 1.0, spiral: 1 },
  ringDash: { k: 'ring', r: 1.0, count: 3, w: 1.0, dash: 1 },
  ringWide: { k: 'ring', r: 1.3, count: 2, w: 1.2 },
  lanceLong: { k: 'lance', len: 1.35, w: 2.4 },
  lanceShort: { k: 'lance', len: 0.7, w: 2.0 },
  lanceWide: { k: 'lance', len: 1.0, w: 3.4 },
  lanceTwin: { k: 'lance', len: 1.05, w: 2.0, twin: 1 },
  lanceSpin: { k: 'lance', len: 1.0, w: 2.2, spin: 1 },
  fanNarrow: { k: 'fan', n: 3, spread: 0.16, len: 0.85 },
  fanWide: { k: 'fan', n: 7, spread: 0.26, len: 0.95 },
  fanArc: { k: 'fan', n: 5, spread: 0.22, len: 1.05, arc: 1 },
  fanStar: { k: 'fan', n: 8, spread: 0.4, len: 0.8, star: 1 },
  fanSplit: { k: 'fan', n: 6, spread: 0.3, len: 0.9, split: 1 },
  crossThin: { k: 'cross', n: 2, spread: 0.55, len: 0.95, w: 1.6 },
  crossThick: { k: 'cross', n: 2, spread: 0.55, len: 0.95, w: 3.2 },
  crossStar: { k: 'cross', n: 3, spread: 0.42, len: 0.9, w: 1.8 },
  crossSplit: { k: 'cross', n: 2, spread: 0.8, len: 0.85, w: 2.0, split: 1 },
  sigilHex: { k: 'sigil', r: 0.85, spokes: 6, layers: 2, hex: 1 },
  sigilRune: { k: 'sigil', r: 0.95, spokes: 4, layers: 3 },
  sigilStar: { k: 'sigil', r: 0.9, spokes: 8, layers: 2, star: 1 },
  sigilWheel: { k: 'sigil', r: 1.05, spokes: 12, layers: 3, wheel: 1 },
  sigilNotch: { k: 'sigil', r: 0.8, spokes: 5, layers: 2, notch: 1 },
  trailThin: { k: 'trail', n: 5, len: 0.8, spread: 0.1 },
  trailThick: { k: 'trail', n: 4, len: 0.95, spread: 0.14, w: 2.6 },
  trailArc: { k: 'trail', n: 6, len: 0.9, spread: 0.18, arc: 1 },
  trailZig: { k: 'trail', n: 7, len: 0.7, spread: 0.22, zig: 1 },
  trailDot: { k: 'trail', n: 6, len: 0.85, spread: 0.16, dot: 1 },
  spiralTight: { k: 'spiral', r: 0.7, turns: 2.2, wide: 0.8 },
  spiralWide: { k: 'spiral', r: 1.2, turns: 1.4, wide: 1.2 },
  spiralDouble: { k: 'spiral', r: 0.9, turns: 2.6, wide: 0.9, double: 1 },
  spiralReverse: { k: 'spiral', r: 1.0, turns: 1.8, wide: 1.0, reverse: 1 },
  rainSparse: { k: 'rain', n: 4, spacing: 26, len: 22 },
  rainDense: { k: 'rain', n: 9, spacing: 15, len: 26 },
  rainAngle: { k: 'rain', n: 6, spacing: 19, len: 30, angle: 0.45 },
  pointStar: { k: 'point', n: 6, r: 16, star: 1 },
  pointBurst: { k: 'point', n: 10, r: 22 },
  pointCross: { k: 'point', n: 4, r: 18, cross: 1 },
  hookUp: { k: 'hook', len: 0.95, turn: 1.95, up: 1 },
  hookDown: { k: 'hook', len: 0.95, turn: -1.95 },
  hookLong: { k: 'hook', len: 1.35, turn: 1.95 },
  crackBranch: { k: 'crack', n: 4, step: 0.8, branch: 1 },
  crackStraight: { k: 'crack', n: 5, step: 0.9, straight: 1 },
  crackWide: { k: 'crack', n: 3, step: 1.1, wide: 1 },
  shockThin: { k: 'shock', r: 0.95, count: 8, w: 1.0 },
  shockThick: { k: 'shock', r: 0.85, count: 8, w: 2.6 },
  shockDouble: { k: 'shock', r: 1.15, count: 12, w: 1.2, double: 1 },
  cleaveTwin: { k: 'cleave', len: 1.25, w: 4.0, twin: 1 },
  cleaveThin: { k: 'cleave', len: 1.35, w: 1.6 },
  cleaveWide: { k: 'cleave', len: 1.1, w: 6.0 },
  boomerangFlat: { k: 'boom', flat: 1, wide: 1.0 },
  boomerangHigh: { k: 'boom', high: 1, wide: 0.7 },
  chargeWide: { k: 'charge', len: 1.25, w: 1.8 },
  chargeDust: { k: 'charge', len: 1.0, w: 1.2, dust: 8 },
};

// 新动作的参数表：名字 → 哪一种运动 + 参数。
// 渲染在 game.js 的 swingAng()（老动作的分支保持原样，新动作走这张表）。
export const ART_POSE_SPECS = {
  sweepHigh: { k: 'swing', off: 3.0 },
  sweepThin: { k: 'swing', off: 0.4, arcMul: 0.6, angAdd: -0.0956 },
  sweepRise: { k: 'swing', off: 2.0, angAdd: -0.3 },
  sweepFall: { k: 'swing', off: -1.0, angAdd: 0.3 },
  sweepTurn: { k: 'swing', off: 2.2, angAdd: 0.4 },
  sweepBack: { k: 'swing', off: -1.5, arcMul: -0.6 },
  sweepWide: { k: 'swing', off: 1.5, arcMul: 1.4 },
  sweepPush: { k: 'swing', off: 4.5, angAdd: 0.0781 },
  lungeHigh: { k: 'lunge', off: 18 },
  lungeLow: { k: 'lunge', off: 8, angAdd: 0.4160 },
  lungeFar: { k: 'lunge', off: 12, arcMul: 1.3 },
  lungeSpin: { k: 'lunge', off: 14, angAdd: 0.5 },
  thrustLong: { k: 'thrust', off: 14, angAdd: 0.3440 },
  thrustShort: { k: 'thrust', off: 5, angAdd: 0.1720 },
  thrustUp: { k: 'thrust', off: 9, tilt: -0.35, angAdd: 0.1716 },
  thrustDown: { k: 'thrust', off: 9, tilt: 0.35 },
  ringHalf: { k: 'ring', t1: 0.55, t2: 1.1 },
  ringFull: { k: 'ring', t1: 1.1, t2: 2.2 },
  ringWide: { k: 'ring', t1: 0.8, t2: 1.6 },
  ringTight: { k: 'ring', t1: 1.4, t2: 2.8 },
  castHigh: { k: 'cast', tilt: -0.9, sweep: 0.6, off: 4, angAdd: 0.0748 },
  castLow: { k: 'cast', tilt: -0.3, sweep: 0.25, off: 2 },
  castSpin: { k: 'cast', tilt: -0.6, sweep: 0.9, off: 5 },
  overheadSlow: { k: 'over', up: 5, down: 9 },
  overheadFast: { k: 'over', up: 2.5, down: 5 },
  overheadWide: { k: 'over', up: 6, down: 11, arcMul: 1.2 },
  overheadLeft: { k: 'over', up: 4, down: 8, angAdd: -0.3 },
  slamSlow: { k: 'over', up: 6, down: 10 },
  slamFast: { k: 'over', up: 3, down: 6 },
  slamWide: { k: 'over', up: 7, down: 12, arcMul: 1.15 },
  sideHigh: { k: 'side', a: 4, b: -2, angAdd: -0.1007 },
  sideLow: { k: 'side', a: -3, b: 1.5, angAdd: -0.1190 },
  sideWide: { k: 'side', a: 5, b: -3, arcMul: 1.3, angAdd: 0.0361 },
  sideTurn: { k: 'side', a: 3.5, b: -1.5, angAdd: 0.35 },
  sidePush: { k: 'side', a: 2, b: -4 },
  throwHigh: { k: 'throw', off: 6 },
  throwFar: { k: 'throw', off: 3, arcMul: 1.2, angAdd: 0.1016 },
  plantDeep: { k: 'plant', off: 6 },
  plantWide: { k: 'plant', off: 3, arcMul: 1.25 },
  plantTurn: { k: 'plant', off: 4, angAdd: 0.3 },
  chargeHigh: { k: 'charge', off: 14 },
  chargeLong: { k: 'charge', off: 10, arcMul: 1.2 },
  chargeTurn: { k: 'charge', off: 12, angAdd: 0.25 },
  flickHigh: { k: 'flick', off: 5, angAdd: -0.1686 },
  flickLow: { k: 'flick', off: 0.5 },
  flickTurn: { k: 'flick', off: 3, angAdd: 0.5257 },
  guardHigh: { k: 'guard', off: -6 },
  guardLow: { k: 'guard', off: -2 },
  guardTurn: { k: 'guard', off: -4, angAdd: 0.35 },
  channelHigh: { k: 'chan', off: -8 },
  channelLong: { k: 'chan', off: -11 },
  channelSpin: { k: 'chan', off: -7, angAdd: 0.5 },
  leapHigh: { k: 'leap', off: -12 },
  leapFar: { k: 'leap', off: -6, arcMul: 1.25 },
  reverseHigh: { k: 'rev', t: 0.85, off: 4 },
  reverseTurn: { k: 'rev', t: 0.35, off: 3, angAdd: 0.3 },
  spinTight: { k: 'spin', t: 0.6 },
  spinWide: { k: 'spin', t: 1.4 },
  spinReverse: { k: 'spin', t: -0.6, angAdd: -0.0431 },
  spinStar: { k: 'spin', t: 2.0 },
};

// 形状签名：招式自带的 shape；没写的按 arc 推回 P6 的三形
export function artShape(a) {
  if (a.shape) return a.shape;
  const arc = a.arc || 1.6;
  if (arc >= Math.PI * 1.9) return 'ring';
  if (a.arc && a.arc < 1.8) return 'thrust';
  return 'arc';
}
// 动作签名：招式自带的 pose.mode；没写的按原语退回旧行为
export function artPose(a) {
  if (a.pose && a.pose.mode) return a.pose.mode;
  return a.fx === 'proj' ? 'thrust' : 'swing';
}
// 色彩签名：招式自带色，否则兵器家族色（trail 由调用方给）
export function artColor(a, trail) {
  return a.color || trail;
}

// ---- P12-D 全表零重复：四条「表现实例」的唯一尺子 ----
// 旧口径只查「同一把兵器内 8 招」，80 招之间照样能撞脸。现在四条签名各自
// 都必须在全表 80 招里拿到 80 个不同值，tools/arts.js §1.4 逐条卡死。
//   · 形状：19 种基础画法仍共享（那是渲染分支），但 shape@shv 是每招独占的
//     几何实例 —— shv 会在 artSwingFx 末尾真实缩放刀光半径 / 长度 / 线宽。
//   · 动作：不只看 pose.mode，a0/a1/dur/ease 五个参数全算进去。
//   · 色彩 / 声音：按「主副色对」「起手音+命中音对」计，都是 80 组独立值。
export function artShapeSig(a) {
  return artShape(a) + '@' + (a.shv || 1);
}
export function artMotionSig(a) {
  const p = a.pose || {};
  return [artPose(a), p.a0, p.a1, p.dur, p.ease].join('|');
}
export function artColorSig(a, trail) {
  return artColor(a, trail).join('|');
}
export function artSoundSig(a) {
  return a.snd + '/' + a.hitSnd;
}

export const ART_IDS = Object.keys(ARTS);
export const ART_SLOTS = 6;
export const ART_KEYS = ['1', '2', '3', '4', '5', '6'];

export function artById(id) { return ARTS[id] || null; }

export function artsOfWeapon(fam) {
  return ART_IDS.map(id => ARTS[id]).filter(a => a.fam === fam)
    .sort((a, b) => a.prof - b.prof || a.id.localeCompare(b.id));
}

export function artUnlocked(kills, art) {
  return profLevel(kills) >= (art.prof || 1);
}

// 当前兵器下"已悟"的招式
export function unlockedArts(fam, profMap) {
  const k = (profMap && profMap[fam]) || 0;
  return artsOfWeapon(fam).filter(a => artUnlocked(k, a));
}

// 注意：名字带 ART_ 前缀 —— items.js 已经导出了一个 SLOT_LABEL（兵器/衣甲/项链/法宝），
// 同一个文件里再 import 一个同名的会把前一个覆盖掉，那种 bug 查起来极费劲。
export const ART_SLOT_LABEL = { dmg: '输出', aoe: '清场', move: '位移', ctrl: '控制', buff: '增益', special: '特色' };

// 等效总倍率：平衡校验的唯一口径。多段 / 多发 / 持续 / 环身中心都要折进去。
// 放在数据层而不是自检脚本里，是为了让"文档里的 2.8 倍"和"测试里的 2.8 倍"
// 永远用同一把尺子 —— 两边各写一份，迟早会漂。
// 只有 DoT（流血 / 灼烧 / 中毒）的 pct 是"每秒掉多少血"，能折进总倍率；
// 减速 / 定身 / 破甲的 pct 分别是降速比例、时长、破防比例，折进去会算出假账。
const DOT_STATUS = { bleed: 1, burn: 1, poison: 1 };
export function artPower(a) {
  if (a.power) return a.power;   // buff / 陷阱：不直接造成伤害，用等效折算
  let total = 0;
  if (a.fx === 'spin' || a.fx === 'zone') {
    const ticks = Math.round((a.dur || (a.zone && a.zone.dur) || 1) /
      (a.tick || (a.zone && a.zone.tick) || 0.25));
    total = a.mul * Math.max(1, ticks);
  } else if (a.fx === 'orbit' || a.fx === 'bolt' || a.fx === 'proj') {
    total = a.mul * (a.count || 1);
  } else if (a.fx === 'blink') {
    total = a.mul * (a.times || 1);
  } else {
    total = a.mul * (a.hits || 1);
  }
  if (a.ramp) total *= 1 + a.ramp * ((a.hits || 1) - 1) / 2;
  if (a.backBonus) total *= a.backBonus;
  if (a.centerBonus) total *= 1.2;               // 环身技中心双倍，保守折算
  if (a.status && DOT_STATUS[a.status.kind] && a.status.pct) {
    total += total * a.status.pct * a.status.dur;
  }
  if (a.launch) total += total * 1.5;
  return total;
}

// 招式的一句话数值摘要，给面板与 tooltip 用
const STATUS_LABEL = {
  bleed: '流血', burn: '灼烧', poison: '中毒', freeze: '冻结',
  stun: '定身', slow: '减速', break: '破甲',
};
export function artBrief(a) {
  const out = ['冷却 ' + a.cd + ' 息', '真气 ' + (Math.round(a.cost * 10) / 10)];
  if (a.fx === 'melee' && a.hits > 1) out.push(a.hits + ' 段');
  if (a.fx === 'proj' && a.count > 1) out.push(a.count + ' 发');
  if (a.fx === 'spin' || a.fx === 'zone') out.push('持续 ' + (a.dur || (a.zone && a.zone.dur)) + ' 息');
  if (a.fx === 'orbit') out.push(a.count + ' 剑');
  if (a.fx === 'blink') out.push(a.times + ' 闪');
  if (a.fx === 'dash') out.push('位移 ' + a.dash.dist + ' 步');
  if (a.fx === 'buff') out.push('增益 ' + a.buff.dur + ' 息');
  if (a.pierceDef) out.push('破防 ' + Math.round(a.pierceDef * 100) + '%');
  if (a.status && STATUS_LABEL[a.status.kind]) {
    out.push(STATUS_LABEL[a.status.kind] + ' ' + a.status.dur + ' 息');
  }
  if (a.launch) out.push('击飞');
  if (a.reflect) out.push('格挡反弹');
  if (a.lifeOnHit) out.push('每击回血');
  if (a.buff && a.buff.shieldPct) out.push('护盾 ' + a.buff.shieldPct + '%');
  if (a.buff && a.buff.hurtPct) out.push('受伤 +' + a.buff.hurtPct + '%');
  return out.join(' · ');
}
