// arts.js · 兵器招式（技能框架的数据层）
//
// 为什么叫 arts 而不是 skills：
//   skills.js 里已经有一棵"道行树"（三支被动 + 气/舞/雷三个主动），那是境界带来的
//   通用手段，跟手里拿什么兵器无关。这一层是"兵器招式"—— 换刀就没有剑招，
//   两者是不同的轴，硬塞进同一个名字里，读代码的人会一直猜。
//
// 纯数据 + 纯函数，无 DOM / 无 three.js 依赖，可单测。
//
// P6 说明：八兵器 × 八招 = 64 招。装配槽只有 6 个，所以 8 招是"全部可学、
// 挑 6 招上阵"，不是同时开 8 个。新增的 48 招按功能位铺满：
//   输出 ×2 / 清场 ×2 / 位移 ×1 / 控制 ×1 / 增益 ×1 / 特色 ×1
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
    desc: '一剑直取，无视三成防御。',
  },
  sword_2: {
    id: 'sword_2', fam: 'sword', slot: 'dmg', name: '连环刺', prof: 2,
    cd: 3, cost: 3.6, fx: 'melee',
    reach: 38, arc: 1.0, mul: 1.45, hits: 3, ramp: 0.10, kb: 5,
    desc: '三连突刺，一刺比一刺沉。',
  },
  sword_3: {
    id: 'sword_3', fam: 'sword', slot: 'aoe', name: '剑气斩', prof: 3,
    cd: 6, cost: 7.2, fx: 'proj',
    count: 1, speed: 330, size: 10, life: 0.62, pierce: 3, mul: 7.2,
    desc: '一道剑气直贯，沿途三人俱伤。',
  },
  sword_4: {
    id: 'sword_4', fam: 'sword', slot: 'aoe', name: '剑雨', prof: 5,
    cd: 10, cost: 12, fx: 'bolt',
    count: 8, mul: 1.4, radius: 26, range: 170,
    desc: '八道剑光自天落，各寻各的目标。',
  },
  sword_5: {
    id: 'sword_5', fam: 'sword', slot: 'move', name: '御剑突进', prof: 6,
    cd: 8, cost: 9.6, fx: 'dash', mul: 3.6, radius: 26, kb: 6,
    dash: { dir: 'face', dist: 60, iframe: 0.3 },
    desc: '踏剑前冲六步，路径留伤，半息不伤。',
  },
  sword_6: {
    id: 'sword_6', fam: 'sword', slot: 'ctrl', name: '定身剑', prof: 8,
    cd: 12, cost: 14.4, fx: 'melee',
    reach: 40, arc: 1.2, mul: 5.4, kb: 4,
    status: { kind: 'stun', dur: 1.5 },
    desc: '剑尖点穴，中者一息半动弹不得。',
  },
  sword_7: {
    id: 'sword_7', fam: 'sword', slot: 'buff', name: '剑心通明', prof: 10,
    cd: 20, cost: 24, fx: 'buff', power: 10,
    buff: { dur: 8, crit: 25, critDmg: 30 },
    desc: '敛神八息，会心与剑意俱锐。',
  },
  sword_8: {
    id: 'sword_8', fam: 'sword', slot: 'special', name: '万剑归宗', prof: 4,
    cd: 30, cost: 36, fx: 'orbit',
    count: 12, dur: 6, mul: 1.9, radius: 34,
    desc: '十二剑环绕六息，各自追敌，每把独立结算。',
  },

  // ---------- 刀 · 大开大合 / 流血 ----------
  // P5 的输出位选了设计表 #2 血刃（id 就叫 blade_2），#1 力劈在 P6 补上。
  // 所以这一族的两招输出位 prof 是 1/2，跟别族顺序相反，但 ID 与存档必须保持不动。
  blade_1: {
    id: 'blade_1', fam: 'blade', slot: 'dmg', name: '力劈', prof: 2,
    cd: 5, cost: 6, fx: 'melee',
    reach: 36, arc: 1.8, mul: 8.0, kb: 12,
    desc: '一刀劈落，把人震开一丈。',
  },
  blade_2: {
    id: 'blade_2', fam: 'blade', slot: 'dmg', name: '血刃', prof: 1,
    cd: 4, cost: 4.8, fx: 'melee',
    reach: 36, arc: 2.4, mul: 4.4, kb: 8,
    status: { kind: 'bleed', dur: 5, pct: 0.12 },
    desc: '割开一道口子，五息内持续流血。',
  },
  blade_3: {
    id: 'blade_3', fam: 'blade', slot: 'aoe', name: '横扫千军', prof: 3,
    cd: 6, cost: 7.2, fx: 'melee',
    reach: 44, arc: 6.28, mul: 7.2, kb: 10,
    desc: '周身一匝横扫，近者皆退。',
  },
  blade_4: {
    id: 'blade_4', fam: 'blade', slot: 'aoe', name: '旋风斩', prof: 5,
    cd: 10, cost: 12, fx: 'spin',
    dur: 1.5, tick: 0.25, mul: 1.83, radius: 50, kb: 7,
    desc: '旋身一息半，边走边斩，多段见血。',
  },
  blade_5: {
    id: 'blade_5', fam: 'blade', slot: 'move', name: '疾风步', prof: 6,
    cd: 9, cost: 10.8, fx: 'dash', mul: 4.05, radius: 24, kb: 6,
    dash: { dir: 'face', dist: 52, iframe: 0.22, forceCrit: true },
    desc: '掠步前欺，下一击必取要害。',
  },
  blade_6: {
    id: 'blade_6', fam: 'blade', slot: 'ctrl', name: '断筋', prof: 8,
    cd: 12, cost: 14.4, fx: 'melee',
    reach: 38, arc: 2.0, mul: 5.4, kb: 8,
    status: { kind: 'slow', dur: 3, pct: 0.6 },
    desc: '刀锋挑筋，三息内寸步难行。',
  },
  blade_7: {
    id: 'blade_7', fam: 'blade', slot: 'buff', name: '狂怒', prof: 10,
    cd: 24, cost: 28.8, fx: 'buff', power: 12,
    buff: { dur: 10, atkPct: 30, hurtPct: 15 },
    desc: '十息内刀势更狠，皮肉也更薄。',
  },
  blade_8: {
    id: 'blade_8', fam: 'blade', slot: 'special', name: '血战八方', prof: 4,
    cd: 28, cost: 33.6, fx: 'spin',
    dur: 2.0, tick: 0.25, mul: 2.2, kb: 7, radius: 52, lifeOnHit: 0.02,
    desc: '八段环斩，每一段命中都回两分气血。',
  },

  // ---------- 枪 · 距离 / 穿刺 ----------
  spear_1: {
    id: 'spear_1', fam: 'spear', slot: 'dmg', name: '贯甲刺', prof: 1,
    cd: 5, cost: 6, fx: 'proj',
    count: 1, speed: 340, size: 10, life: 0.42, pierce: 5, mul: 7.5, pierceDef: 0.4,
    desc: '一枪贯穿，沿途所有敌手俱伤，无视四成防御。',
  },
  spear_2: {
    id: 'spear_2', fam: 'spear', slot: 'dmg', name: '枪阵', prof: 2,
    cd: 6, cost: 7.2, fx: 'melee',
    reach: 46, arc: 1.0, mul: 3.2, hits: 3, kb: 6, kbLast: 10,
    desc: '三刺连出，末一记把人挑开。',
  },
  spear_3: {
    id: 'spear_3', fam: 'spear', slot: 'aoe', name: '回马枪', prof: 3,
    cd: 4, cost: 4.8, fx: 'melee',
    reach: 44, arc: 1.6, mul: 3.4, back: true, backBonus: 1.4, kb: 9,
    desc: '反手向身后一记突刺，回身反打格外狠。',
  },
  spear_4: {
    id: 'spear_4', fam: 'spear', slot: 'aoe', name: '天狼啸月', prof: 5,
    cd: 30, cost: 36, fx: 'melee',
    reach: 90, arc: 6.28, mul: 33, kb: 18,
    desc: '枪尖画圆，九步之内尽在其下。',
  },
  spear_5: {
    id: 'spear_5', fam: 'spear', slot: 'move', name: '游龙步', prof: 6,
    cd: 10, cost: 12, fx: 'dash', mul: 4.5, radius: 26, kb: 6,
    dash: { dir: 'side', dist: 70, iframe: 0.5 },
    desc: '侧身游走七步，全程不沾片叶。',
  },
  spear_6: {
    id: 'spear_6', fam: 'spear', slot: 'ctrl', name: '定军', prof: 8,
    cd: 14, cost: 16.8, fx: 'zone', mul: 0.8,
    zone: { dur: 4, tick: 0.5, radius: 70, shape: 'circle' },
    status: { kind: 'slow', dur: 1, pct: 0.5 },
    desc: '长枪插地，四息内方圆七步皆成泥沼。',
  },
  spear_7: {
    id: 'spear_7', fam: 'spear', slot: 'buff', name: '枪势', prof: 10,
    cd: 18, cost: 21.6, fx: 'buff', power: 9,
    buff: { dur: 8, reachPct: 40, pierce: 1 },
    desc: '枪意铺开八息，够得更远、也穿得更透。',
  },
  spear_8: {
    id: 'spear_8', fam: 'spear', slot: 'special', name: '挑飞', prof: 4,
    cd: 8, cost: 9.6, fx: 'melee',
    reach: 44, arc: 1.6, mul: 5.6, kb: 4, launch: true,
    desc: '上挑掀飞，落地再受一记摔伤。',
  },

  // ---------- 棍 · 范围 / 格挡 ----------
  staff_1: {
    id: 'staff_1', fam: 'staff', slot: 'dmg', name: '扫棍', prof: 1,
    cd: 3, cost: 3.6, fx: 'melee',
    reach: 42, arc: 3.4, mul: 5.6, kb: 9,
    desc: '半圆横扫，冷却最短的棍法。',
  },
  staff_2: {
    id: 'staff_2', fam: 'staff', slot: 'dmg', name: '崩棍', prof: 2,
    cd: 5, cost: 6, fx: 'melee',
    reach: 40, arc: 1.3, mul: 8.0, kb: 18,
    desc: '棍尾一崩，只打一人，打得最远。',
  },
  staff_3: {
    id: 'staff_3', fam: 'staff', slot: 'aoe', name: '捅棍', prof: 3,
    cd: 4, cost: 4.8, fx: 'proj',
    count: 1, speed: 300, size: 11, life: 0.55, pierce: 4, mul: 4.8,
    desc: '一棍直捅，连人带影穿成串。',
  },
  staff_4: {
    id: 'staff_4', fam: 'staff', slot: 'aoe', name: '跃棍', prof: 5,
    cd: 9, cost: 10.8, fx: 'melee',
    reach: 52, arc: 6.28, mul: 8.2, kb: 12, centerBonus: 1.5, centerR: 24,
    desc: '跃起砸地，落点正中尤其沉重。',
  },
  staff_5: {
    id: 'staff_5', fam: 'staff', slot: 'move', name: '疾风棍', prof: 6,
    cd: 8, cost: 9.6, fx: 'dash', mul: 3.6, radius: 26, kb: 8,
    dash: { dir: 'face', dist: 58, iframe: 0.2, shieldPct: 8 },
    desc: '棍影护身前冲，路上顺手砸开一条道。',
  },
  staff_6: {
    id: 'staff_6', fam: 'staff', slot: 'ctrl', name: '缠棍', prof: 8,
    cd: 12, cost: 14.4, fx: 'pull', mul: 5.4, radius: 80, kb: 4,
    desc: '棍梢一卷，把八步内最近的敌手拽到面前。',
  },
  staff_7: {
    id: 'staff_7', fam: 'staff', slot: 'buff', name: '铁布衫', prof: 10,
    cd: 20, cost: 24, fx: 'buff', power: 10,
    buff: { dur: 5, dmgReduce: 50, shieldPct: 10 },
    desc: '五息横练，挨打只剩一半疼。',
  },
  staff_8: {
    id: 'staff_8', fam: 'staff', slot: 'special', name: '舞棍', prof: 4,
    cd: 10, cost: 12, fx: 'spin',
    dur: 2.0, tick: 0.25, mul: 1.5, kb: 6, radius: 44, reflect: true,
    desc: '舞棍两息，格开并反弹所有飞来之物。',
  },

  // ---------- 双刀 · 多段 / 位移 ----------
  dual_1: {
    id: 'dual_1', fam: 'dual', slot: 'dmg', name: '双牙', prof: 1,
    cd: 2.5, cost: 3, fx: 'melee',
    reach: 32, arc: 1.8, mul: 2.5, hits: 2, kb: 4,
    desc: '极快两连，最短冷却。',
  },
  dual_2: {
    id: 'dual_2', fam: 'dual', slot: 'dmg', name: '十字斩', prof: 2,
    cd: 5, cost: 6, fx: 'melee',
    reach: 34, arc: 2.2, mul: 4.0, hits: 2, kb: 5, critLast: true,
    desc: '两刀交叉，后一刀专取破绽。',
  },
  dual_3: {
    id: 'dual_3', fam: 'dual', slot: 'aoe', name: '乱舞', prof: 3,
    cd: 10, cost: 12, fx: 'melee',
    reach: 56, arc: 6.28, mul: 2.0, hits: 6, randomTargets: 6, kb: 4,
    desc: '六段乱斩，刀刀换个方向。',
  },
  dual_4: {
    id: 'dual_4', fam: 'dual', slot: 'aoe', name: '千刃', prof: 5,
    cd: 30, cost: 36, fx: 'zone', mul: 3.3,
    zone: { dur: 3, tick: 0.3, radius: 100, shape: 'circle' },
    desc: '刀刃成风，三息内十步方圆无人能立。',
  },
  dual_5: {
    id: 'dual_5', fam: 'dual', slot: 'move', name: '影袭', prof: 6,
    cd: 8, cost: 9.6, fx: 'dash', mul: 3.6, radius: 26, kb: 5,
    dash: { dir: 'target', dist: 48, iframe: 0.18, nextDmg: 0.5 },
    desc: '闪到敌手背后，紧接着那一刀更狠。',
  },
  dual_6: {
    id: 'dual_6', fam: 'dual', slot: 'ctrl', name: '割喉', prof: 8,
    cd: 12, cost: 14.4, fx: 'melee',
    reach: 32, arc: 1.0, mul: 5.4, kb: 4, critAdd: 60,
    status: { kind: 'slow', dur: 3, pct: 0.4 },
    desc: '贴身一记，几乎必取要害，中者气息滞涩。',
  },
  dual_7: {
    id: 'dual_7', fam: 'dual', slot: 'buff', name: '杀意', prof: 10,
    cd: 22, cost: 26.4, fx: 'buff', power: 11,
    buff: { dur: 8, critDmg: 50, spd: 15 },
    desc: '八息杀意翻涌，会心更重、脚下更快。',
  },
  dual_8: {
    id: 'dual_8', fam: 'dual', slot: 'special', name: '疾影', prof: 4,
    cd: 9, cost: 10.8, fx: 'blink',
    times: 3, dist: 52, mul: 3.5, radius: 26,
    desc: '三次短距闪烁，每次穿过敌手都留下一刀。',
  },

  // ---------- 锤 · 破防 / 震地 ----------
  hammer_1: {
    id: 'hammer_1', fam: 'hammer', slot: 'dmg', name: '碎骨锤', prof: 1,
    cd: 6, cost: 7.2, fx: 'melee',
    reach: 36, arc: 1.4, mul: 8.4, kb: 16,
    status: { kind: 'break', dur: 4, pct: 0 },
    desc: '一锤碎骨，四息内对方防御减四成。',
  },
  hammer_2: {
    id: 'hammer_2', fam: 'hammer', slot: 'dmg', name: '回旋锤', prof: 2,
    cd: 5, cost: 6, fx: 'melee',
    reach: 40, arc: 6.28, mul: 8.0, kb: 14,
    desc: '抡锤绕身一圈，四面都不留空。',
  },
  hammer_3: {
    id: 'hammer_3', fam: 'hammer', slot: 'aoe', name: '震地', prof: 3,
    cd: 8, cost: 9.6, fx: 'melee',
    reach: 80, arc: 6.28, mul: 9.6, kb: 18,
    desc: '锤落地面，八步内一并震起。',
  },
  hammer_4: {
    id: 'hammer_4', fam: 'hammer', slot: 'aoe', name: '地裂', prof: 5,
    cd: 12, cost: 14.4, fx: 'zone', mul: 1.65,
    zone: { dur: 4, tick: 0.5, radius: 34, shape: 'line', count: 4 },
    status: { kind: 'burn', dur: 2, pct: 0.06 },
    desc: '一道裂地向前铺开，四息内踩着就伤。',
  },
  hammer_5: {
    id: 'hammer_5', fam: 'hammer', slot: 'move', name: '冲锋锤', prof: 6,
    cd: 9, cost: 10.8, fx: 'dash', mul: 4.05, radius: 30, kb: 16,
    dash: { dir: 'face', dist: 80, iframe: 0.22 },
    desc: '低头撞出去八步，撞上就飞。',
  },
  hammer_6: {
    id: 'hammer_6', fam: 'hammer', slot: 'ctrl', name: '眩晕击', prof: 8,
    cd: 16, cost: 19.2, fx: 'melee',
    reach: 36, arc: 1.4, mul: 7.2, kb: 12,
    status: { kind: 'stun', dur: 2 },
    desc: '一记闷锤，两息不知东西。',
  },
  hammer_7: {
    id: 'hammer_7', fam: 'hammer', slot: 'buff', name: '铁壁', prof: 10,
    cd: 20, cost: 24, fx: 'buff', power: 10,
    buff: { dur: 8, shieldPct: 20, hurtReflect: 30 },
    desc: '八息罡气护体，近身来打的都要还三成。',
  },
  hammer_8: {
    id: 'hammer_8', fam: 'hammer', slot: 'special', name: '开天辟地', prof: 4,
    cd: 32, cost: 38.4, fx: 'melee',
    reach: 130, arc: 6.28, mul: 22.8, kb: 24, centerBonus: 2, centerR: 46,
    desc: '砸地开山，中心一记双倍。',
  },

  // ---------- 法杖 · 元素 / 控制 ----------
  // 法杖与暗器普攻 DPS 最低，整组倍率乘 0.75，否则六招一开会变成"等 CD"游戏。
  mage_1: {
    id: 'mage_1', fam: 'mage', slot: 'dmg', name: '灵珠', prof: 1,
    cd: 2, cost: 2.4, fx: 'proj',
    count: 1, speed: 250, size: 11, life: 0.9, pierce: 1, mul: 4.0,
    desc: '一枚灵珠，两息一发。',
  },
  mage_2: {
    id: 'mage_2', fam: 'mage', slot: 'dmg', name: '三珠连爆', prof: 2,
    cd: 5, cost: 6, fx: 'proj',
    count: 3, spread: 0.42, speed: 250, size: 10, life: 0.9, pierce: 1,
    mul: 2.0, splash: 24,
    desc: '三珠分袭，触地各炸一小片。',
  },
  mage_3: {
    id: 'mage_3', fam: 'mage', slot: 'aoe', name: '火雨', prof: 3,
    cd: 12, cost: 14.4, fx: 'zone', mul: 1.08,
    zone: { dur: 4, tick: 0.4, radius: 56, shape: 'circle' },
    status: { kind: 'burn', dur: 2, pct: 0.18 },
    desc: '一片火云落定，四息不熄，沾着就灼。',
  },
  mage_4: {
    id: 'mage_4', fam: 'mage', slot: 'aoe', name: '雷链', prof: 5,
    cd: 10, cost: 12, fx: 'bolt',
    count: 3, chain: 3, fall: 0.2, mul: 2.75, radius: 26, range: 190,
    desc: '一道雷串三人，每跳弱两成。',
  },
  mage_5: {
    id: 'mage_5', fam: 'mage', slot: 'move', name: '瞬闪', prof: 6,
    cd: 8, cost: 9.6, fx: 'dash', mul: 2.7, radius: 24, kb: 4,
    dash: { dir: 'face', dist: 90, iframe: 0.3 },
    desc: '身影一晃已在九步外，原地只留残影。',
  },
  mage_6: {
    id: 'mage_6', fam: 'mage', slot: 'ctrl', name: '冰封', prof: 8,
    cd: 10, cost: 12, fx: 'melee',
    reach: 44, arc: 1.6, mul: 3.4, kb: 3,
    status: { kind: 'freeze', dur: 2 },
    desc: '寒气凝住两息，冻着的时候更禁打。',
  },
  mage_7: {
    id: 'mage_7', fam: 'mage', slot: 'buff', name: '灵护', prof: 10,
    cd: 18, cost: 21.6, fx: 'buff', power: 6.8,
    buff: { dur: 10, shieldPct: 25 },
    desc: '灵光覆身十息，替你挡下四分之一气血的伤。',
  },
  mage_8: {
    id: 'mage_8', fam: 'mage', slot: 'special', name: '天雷引', prof: 4,
    cd: 30, cost: 36, fx: 'bolt',
    count: 5, mul: 4.6, radius: 30, range: 200,
    desc: '五道天雷随机落下，各算各的。',
  },

  // ---------- 暗器 · 毒 / 陷阱 ----------
  dart_1: {
    id: 'dart_1', fam: 'dart', slot: 'dmg', name: '飞蝗', prof: 1,
    cd: 1.8, cost: 2.16, fx: 'proj',
    count: 1, speed: 320, size: 7, life: 0.55, pierce: 1, mul: 3.5, kind: 'dart',
    desc: '一镖出手，全武器最短冷却。',
  },
  dart_2: {
    id: 'dart_2', fam: 'dart', slot: 'dmg', name: '三叠浪', prof: 2,
    cd: 4, cost: 4.8, fx: 'proj',
    count: 3, spread: 0.12, speed: 320, size: 7, life: 0.6, pierce: 1,
    mul: 1.6, kind: 'dart',
    desc: '三镖几乎同路，全中一处才见威力。',
  },
  dart_3: {
    id: 'dart_3', fam: 'dart', slot: 'aoe', name: '满天花雨', prof: 3,
    cd: 10, cost: 12, fx: 'proj',
    count: 12, spread: 1.4, speed: 300, size: 7, life: 0.65, pierce: 1,
    mul: 0.75, kind: 'dart',
    desc: '十二枚扇面齐撒，近处密远处疏。',
  },
  dart_4: {
    id: 'dart_4', fam: 'dart', slot: 'aoe', name: '万箭穿心', prof: 5,
    cd: 30, cost: 36, fx: 'proj',
    count: 24, ring: true, speed: 280, size: 7, life: 0.7, pierce: 1,
    mul: 1.0, kind: 'dart',
    desc: '周身二十四镖一齐泼出去，四面皆到。',
  },
  dart_5: {
    id: 'dart_5', fam: 'dart', slot: 'move', name: '缩地', prof: 6,
    cd: 12, cost: 14.4, fx: 'dash', mul: 4.05, radius: 24, kb: 4,
    dash: { dir: 'back', dist: 70, iframe: 0.35, stealth: true },
    desc: '向后一纵七步，追兵一时失了你的踪迹。',
  },
  dart_6: {
    id: 'dart_6', fam: 'dart', slot: 'ctrl', name: '铁蒺藜', prof: 8,
    cd: 8, cost: 9.6, fx: 'zone', mul: 0.54, power: 4.3,
    zone: { dur: 6, tick: 0.2, radius: 12, shape: 'circle', count: 5, once: true },
    status: { kind: 'stun', dur: 1 },
    desc: '脚下撒五枚蒺藜，踩中定住一息。',
  },
  dart_7: {
    id: 'dart_7', fam: 'dart', slot: 'buff', name: '淬毒', prof: 10,
    cd: 20, cost: 24, fx: 'buff', power: 7.5,
    buff: { dur: 8, poisonOnHit: true },
    desc: '八息内出手皆带毒，刀镖拳脚一视同仁。',
  },
  dart_8: {
    id: 'dart_8', fam: 'dart', slot: 'special', name: '毒镖', prof: 4,
    cd: 5, cost: 6, fx: 'proj',
    count: 1, speed: 300, size: 8, life: 0.6, pierce: 2, mul: 4.2, kind: 'dart',
    status: { kind: 'poison', dur: 6, pct: 0.10, spread: true },
    desc: '淬毒六息；中毒者倒下时毒气四散，沾上的人一起中毒。',
  },
};

// 十种效果原语。自检拿它验"每一招都落在分派器认得的类型里"，
// game.js 的 execArt 分支也照这个清单对齐 —— 加原语时两处一起改。
export const ART_FX = ['melee', 'proj', 'spin', 'orbit', 'blink', 'bolt', 'dash', 'buff', 'zone', 'pull'];
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
