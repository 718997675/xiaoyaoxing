// arts.js · 兵器招式（技能框架的数据层）
//
// 为什么叫 arts 而不是 skills：
//   skills.js 里已经有一棵"道行树"（三支被动 + 气/舞/雷三个主动），那是境界带来的
//   通用手段，跟手里拿什么兵器无关。这一层是"兵器招式"—— 换刀就没有剑招，
//   两者是不同的轴，硬塞进同一个名字里，读代码的人会一直猜。
//
// 纯数据 + 纯函数，无 DOM / 无 three.js 依赖，可单测。

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
//   melee  身前/环身判定（reach + arc，arc 给 6.28 就是环身）
//   proj   打出一枚（或数枚）弹体，可穿透、可挂状态
//   spin   持续旋转若干秒，每 tick 一次判定（可反弹飞行物）
//   orbit  召出若干把飞剑环绕，每把独立追敌结算
//   blink  连续短距闪烁，穿过敌人造成伤害
//   bolt   在目标头顶落雷（复用首领天雷的 bolts 通道）
//
// 修饰字段：
//   pierceDef  本次伤害无视对方多少防御（0~1）
//   status     命中附加状态 { kind, dur, pct }，pct 是"每秒按本次伤害的百分之几"
//   launch     上挑击飞，落地再受一次摔伤
//   centerBonus 环身技的中心额外倍率
//   lifeOnHit  每次命中回多少比例气血（0~1）
//
// 数值口径见 SKILLS-STORY-PLAN.md §2.2：以"普攻 DPS = 100"为基准，
// 技能总伤 ≈ atk × 系数(CD)，系数 3s→1.6 / 6s→2.4 / 10s→3.4 / 20s→5.0 / 30s→6.5。
// 真气消耗 = CD × 1.2。
export const ARTS = {
  // ---------- 剑 · 中庸 / 精准 / 连击 ----------
  sword_1: {
    id: 'sword_1', fam: 'sword', slot: 'dmg', name: '破锋式', prof: 1,
    cd: 4, cost: 4.8, fx: 'melee',
    reach: 40, arc: 1.2, mul: 6.6, kb: 9, pierceDef: 0.3,
    desc: '一剑直取，无视三成防御。',
  },
  sword_8: {
    id: 'sword_8', fam: 'sword', slot: 'special', name: '万剑归宗', prof: 4,
    cd: 30, cost: 36, fx: 'orbit',
    count: 12, dur: 6, mul: 1.9, radius: 34,
    desc: '十二剑环绕六息，各自追敌，每把独立结算。',
  },

  // ---------- 刀 · 大开大合 / 流血 ----------
  blade_2: {
    id: 'blade_2', fam: 'blade', slot: 'dmg', name: '血刃', prof: 1,
    cd: 4, cost: 4.8, fx: 'melee',
    reach: 36, arc: 2.4, mul: 4.4, kb: 8,
    status: { kind: 'bleed', dur: 5, pct: 0.12 },
    desc: '割开一道口子，五息内持续流血。',
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
  hammer_8: {
    id: 'hammer_8', fam: 'hammer', slot: 'special', name: '开天辟地', prof: 4,
    cd: 32, cost: 38.4, fx: 'melee',
    reach: 130, arc: 6.28, mul: 22.8, kb: 24, centerBonus: 2, centerR: 46,
    desc: '砸地开山，中心一记双倍。',
  },

  // ---------- 法杖 · 元素 / 控制 ----------
  mage_1: {
    id: 'mage_1', fam: 'mage', slot: 'dmg', name: '灵珠', prof: 1,
    cd: 2, cost: 2.4, fx: 'proj',
    count: 1, speed: 250, size: 11, life: 0.9, pierce: 1, mul: 4.0,
    desc: '一枚灵珠，两息一发。',
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
  dart_8: {
    id: 'dart_8', fam: 'dart', slot: 'special', name: '毒镖', prof: 4,
    cd: 5, cost: 6, fx: 'proj',
    count: 1, speed: 300, size: 8, life: 0.6, pierce: 2, mul: 4.2, kind: 'dart',
    status: { kind: 'poison', dur: 6, pct: 0.10, spread: true },
    desc: '淬毒六息；中毒者倒下时毒气四散，沾上的人一起中毒。',
  },
};

export const ART_IDS = Object.keys(ARTS);
export const ART_SLOTS = 6;
export const ART_KEYS = ['1', '2', '3', '4', '5', '6'];

export function artById(id) { return ARTS[id] || null; }

export function artsOfWeapon(fam) {
  return ART_IDS.map(id => ARTS[id]).filter(a => a.fam === fam)
    .sort((a, b) => a.prof - b.prof);
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

// 招式的一句话数值摘要，给面板与 tooltip 用
export function artBrief(a) {
  const out = ['冷却 ' + a.cd + ' 息', '真气 ' + (Math.round(a.cost * 10) / 10)];
  if (a.fx === 'melee' && a.hits > 1) out.push(a.hits + ' 段');
  if (a.pierceDef) out.push('破防 ' + Math.round(a.pierceDef * 100) + '%');
  if (a.status && a.status.kind === 'bleed') out.push('流血 ' + a.status.dur + ' 息');
  if (a.status && a.status.kind === 'poison') out.push('中毒 ' + a.status.dur + ' 息');
  if (a.status && a.status.kind === 'break') out.push('破甲 ' + a.status.dur + ' 息');
  if (a.launch) out.push('击飞');
  if (a.reflect) out.push('格挡反弹');
  if (a.lifeOnHit) out.push('每击回血');
  return out.join(' · ');
}
