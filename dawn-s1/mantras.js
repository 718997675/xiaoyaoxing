// 心法 —— 一主二辅，12 主 + 10 辅 = 540 种组合。
//
// 为什么不叫 skills.js：那个文件是"道行树"（境界给的通用被动，人人都会点满）。
// 心法是**互斥选择**：一局只能带一条主心法，逼玩家在"这一趟要什么"上做取舍。
// 为什么也不叫 arts.js：那个已经被 P5 的兵器招式占了（换刀就没有剑招）。
//
// 本文件只有数据 + 纯函数，不碰 DOM、不碰 three —— 心法的运行时钩子全在 game.js，
// 因为那些钩子要读写战斗状态（连击、受击、蓄力），放在这里会把纯数据层弄脏。

export const MANTRA_MAX_LV = 3;     // 藏经阁残卷「注解」最高 3 级
export const MANTRA_LV_STEP = 0.30; // 每级注解 +30% 效果
export const SUB_SLOTS = 2;

// 强化只放大**好处**，不放大代价。
// 血河 -15% 气血如果跟着等级走，练到 3 级反而更脆，玩家会觉得越练越亏。
function lvMul(lv) { return 1 + MANTRA_LV_STEP * (Math.max(1, Math.min(MANTRA_MAX_LV, lv)) - 1); }

// ---------------------------------------------------------------- 12 条主心法
// 设计硬约束（写在这里，改数值前先读一遍）：
//   1. 每条都必须有代价。没有代价的那条会变成所有人的默认答案。
//   2. 伤害加成走同一加法区，单一来源上限 40%。所以追命 / 藏锋都压在 40% 顶格。
//   3. 不能只对某一类兵器有效 —— 那就变回职业系统了。
export const MAIN = {
  pojun: {
    id: 'pojun', kind: 'main', name: '破军', school: '刚',
    mech: 'fullHpBonus', params: { up: 0.25, down: -0.10 },
    desc: '对满血之敌伤害 +25%；对半血以下之敌 -10%。',
    flaw: '收尾最难受 —— 越打越软，残血目标得靠普攻磨。',
    from: { kind: 'boss', id: 'qingshe', text: '击败「青鳞蟒」（首杀）' },
  },
  guiyuan: {
    id: 'guiyuan', kind: 'main', name: '归元', school: '生',
    mech: 'idleRegen', params: { delay: 3, pct: 4 },
    desc: '脱战 3 秒后，每秒回复 4% 最大气血。',
    flaw: '开打就断。硬碰硬的场合等于没带。',
    from: { kind: 'boss', id: 'treant', text: '击败「千年树妖」（首杀）' },
  },
  zhuiming: {
    id: 'zhuiming', kind: 'main', name: '追命', school: '杀',
    // 上限从 +40% 压到 +32%：P95/P50 实测 1.39，超了 1.35 的线。
    // 中位数组合里有一半是防御类主心法（归元 / 铁衣 / 卸力），DPS 等于裸装，
    // 所以"最强的那条"能加多少，直接就是分布的比值。
    mech: 'chainBonus', params: { per: 0.04, cap: 0.32, window: 3 },
    desc: '连续命中同一目标，每击递增 +4%，最多 +32%。换目标或停手 3 秒清零。',
    flaw: '只咬一个。被围住时加成全废。',
    from: { kind: 'kills', n: 300, text: '累计斩敌 300' },
  },
  xuehe: {
    id: 'xuehe', kind: 'main', name: '血河', school: '杀',
    mech: null, mods: { lifesteal: 8, hpPct: -15 },
    desc: '造成伤害的 8% 转为气血；最大气血 -15%。',
    flaw: '血薄。一刀换一刀的打法，遇到高爆发就亏。',
    from: { kind: 'boss', id: 'boss', text: '击败「黑风寨主」（首杀）' },
  },
  tieyi: {
    id: 'tieyi', kind: 'main', name: '铁衣', school: '守',
    mech: 'hitReduce', params: { pct: 0.30, dur: 2, max: 2 },
    desc: '受击后 2 秒内减伤 30%，可叠 2 层。',
    flaw: '第一下永远白挨。怕的是"很久才打你一下"的对手。',
    from: { kind: 'boss', id: 'shimu', text: '击败「石母」（首杀）' },
  },
  jifeng: {
    id: 'jifeng', kind: 'main', name: '疾风', school: '速',
    mech: 'dashBurst', mods: { spd: 12 }, params: { dur: 1.5, mul: 0.40 },
    desc: '移速 +12%；闪避成功后 1.5 秒内，下一击伤害 +40%。',
    flaw: '得先挨到闪避那一下。站桩输出完全吃不到。',
    from: { kind: 'boss', id: 'wumian', text: '击败「无面剑客」（首杀）' },
  },
  fenxin: {
    id: 'fenxin', kind: 'main', name: '焚心', school: '烈',
    // 注意 qi 是 5 不是 2：命中本身会回 3 点真气，写成 2 的话"净 +1"，
    // 这条心法的代价就凭空消失了 —— 实测时才发现，账面 -2 实际在回气。
    mech: 'burnOnHit', params: { pct: 0.30, dur: 3, qi: 5 },
    desc: '攻击附带灼烧 3 秒（每秒 30% 攻击力）；每次命中额外耗 5 真气。',
    flaw: '吃真气。真气见底时就是一条白板心法。',
    from: { kind: 'boss', id: 'huoya', text: '击败「火鸦王」（首杀）' },
  },
  hantan: {
    id: 'hantan', kind: 'main', name: '寒潭', school: '阴',
    // 原来写 15% / 2 秒，实测减速几乎常驻（攻速够快时 2 秒窗口叠得上），
    // "靠概率"这个代价根本不存在，等于一条常驻 +20%。压到 10% / 1.5 秒才有真实空窗。
    mech: 'slowOnHit', params: { chance: 0.10, pct: 0.40, dur: 1.5, bonus: 0.18 },
    desc: '命中时 10% 概率减速 40%/1.5 秒；对被减速的目标伤害 +18%。',
    flaw: '全靠概率。脸黑的时候就是没有。',
    from: { kind: 'boss', id: 'yaowang', text: '击败「岩魈 · 洞主」（首杀）' },
  },
  kongming: {
    id: 'kongming', kind: 'main', name: '空明', school: '虚',
    mech: null, mods: { qiMaxPct: 40, qiRegenPct: 50, skillDmgPct: -10 },
    desc: '真气上限 +40%、回复 +50%；术法伤害 -10%。',
    flaw: '普攻流派带了纯亏，只有靠招式的人才吃得下。',
    from: { kind: 'boss', id: 'kuilei', text: '击败「机关傀儡」（首杀）' },
  },
  cangfeng: {
    id: 'cangfeng', kind: 'main', name: '藏锋', school: '刚',
    mech: 'idleStack', params: { max: 5, per: 0.08 },
    desc: '不出招时每秒蓄 1 层「锋」（上限 5 层）；出招时每层 +8% 伤害并清空。',
    flaw: '蓄力就是不打。打快了等于没蓄。',
    from: { kind: 'level', n: 18, text: '境界达 18 级' },
  },
  xieli: {
    id: 'xieli', kind: 'main', name: '卸力', school: '柔',
    mech: 'qiOnHurt', params: { pct: 0.20 },
    desc: '受击时，所受伤害的 20% 转为真气。',
    flaw: '要挨打才回气。血线压不住的时候，回的那点气救不了命。',
    from: { kind: 'fame', n: 40, text: '侠名达 40' },
  },
  wuchang: {
    id: 'wuchang', kind: 'main', name: '无常', school: '机',
    mech: 'critResetCd', mods: { crit: 15, critDmg: -30 }, params: { chance: 0.20 },
    // 冷却**减半**而不是清零。清零那版实测能把 30 秒的大招变成几秒一发，
    // 最强组合的 DPS 冲到中位数的 2.3 倍 —— 一条心法顶掉整个构筑的差异。
    desc: '暴击率 +15%、暴击伤害 -30%；暴击时 20% 概率让一个技能的剩余冷却减半。',
    flaw: '暴伤砍掉三成。不暴击的时候，这条心法什么都没做。',
    from: { kind: 'bosses', n: 3, text: '斩落 3 位不同的首领' },
  },
};

// ---------------------------------------------------------------- 10 条辅心法
// 纯数值、无代价。刻意留了贪狼 / 拾遗两条"不打架"的 ——
// 有些玩家就是喜欢刷，不该逼他全点战斗。
export const SUB = {
  mingmu: { id: 'mingmu', kind: 'sub', name: '明目', mods: { crit: 8 },
    desc: '暴击率 +8%。', price: 1200 },
  chenjian: { id: 'chenjian', kind: 'sub', name: '沉肩', mods: { iframeMul: 18 },
    desc: '受击后的无敌时间 +18%。', price: 900 },
  changxi: { id: 'changxi', kind: 'sub', name: '长息', mods: { qiRegenPct: 25 },
    desc: '真气回复 +25%。', price: 1000 },
  mofeng: { id: 'mofeng', kind: 'sub', name: '磨锋', mods: { atkPct: 6 },
    desc: '攻击力 +6%。', price: 800 },
  qingshen: { id: 'qingshen', kind: 'sub', name: '轻身', mods: { spd: 8 },
    desc: '移速 +8%。', price: 700 },
  houtu: { id: 'houtu', kind: 'sub', name: '厚土', mods: { hpPct: 15 },
    desc: '最大气血 +15%。', price: 1100 },
  ruijin: { id: 'ruijin', kind: 'sub', name: '锐金', mods: { pierce: 10 },
    desc: '破防 +10%（无视目标一成防御）。', price: 1400 },
  jingshui: { id: 'jingshui', kind: 'sub', name: '静水', mods: { cdr: 10 },
    desc: '技能冷却 -10%。', price: 1500 },
  tanlang: { id: 'tanlang', kind: 'sub', name: '贪狼', mods: { goldMul: 20 },
    desc: '银两掉落 +20%。', price: 600 },
  shiyi: { id: 'shiyi', kind: 'sub', name: '拾遗', mods: { dropMul: 8 },
    desc: '装备掉落率 +8%。', price: 1000 },
};

export const MANTRAS = Object.assign({}, MAIN, SUB);
export const MAIN_IDS = Object.keys(MAIN);
export const SUB_IDS = Object.keys(SUB);
export const MANTRA_IDS = MAIN_IDS.concat(SUB_IDS);

export function mantraById(id) { return MANTRAS[id] || null; }
export function isMain(id) { return !!(MAIN[id]); }

// 空的 mods 模板。每个字段都是**加法**语义 —— 心法之间、心法与道行树之间
// 全部先加后乘，绝不出现"乘算叠乘算"（那会让两条 +20% 变成 +44%）。
export function emptyMod() {
  return {
    atkPct: 0, hpPct: 0, crit: 0, critDmg: 0, spd: 0, cdr: 0,
    qiMaxPct: 0, qiRegenPct: 0, lifesteal: 0, skillDmgPct: 0,
    pierce: 0, goldMul: 0, dropMul: 0, iframeMul: 0, dmgReduce: 0,
  };
}

// 把当前装配的三条心法折成一个修正对象。
// loadout = { main: id|null, sub: [id|null, id|null] }，owned = { id: lv }
export function mantraMod(loadout, owned) {
  const m = emptyMod();
  if (!loadout) return m;
  const list = [loadout.main].concat(loadout.sub || []).filter(Boolean);
  const seen = {};
  for (const id of list) {
    const a = MANTRAS[id];
    // 读档降级：id 被删过 / 手改过存档 → 直接跳过，不抛错
    if (!a || !a.mods) continue;
    // 同一条心法不能在主辅两个位置各算一遍（主心法本来就不在 SUB 里，防的是手改存档）
    if (seen[id]) continue;
    seen[id] = 1;
    const k = lvMul((owned && owned[id]) || 1);
    for (const key in a.mods) {
      if (!(key in m)) continue;      // 未知字段忽略，老存档不会炸
      m[key] += a.mods[key] * k;
    }
  }
  // 数值统一取整到 0.1，避免 8.000000000000002 这种脏数进 UI
  for (const key in m) m[key] = Math.round(m[key] * 10) / 10;
  return m;
}

// 当前生效的主心法 id（最多一条 —— 互斥规则在 install 里保证）
export function mainOf(loadout) { return (loadout && loadout.main) || null; }

// 装配：主心法互斥，装第二条自动顶掉第一条；辅心法两格满了就顶掉第一格。
// 返回 { ok, replaced } —— 让调用方能说一句"「归元」已替下「破军」"。
export function install(loadout, id) {
  const a = MANTRAS[id];
  if (!a) return { ok: false, replaced: null };
  if (a.kind === 'main') {
    const old = loadout.main;
    loadout.main = id;
    return { ok: true, replaced: old && old !== id ? old : null };
  }
  if (!Array.isArray(loadout.sub)) loadout.sub = [null, null];
  while (loadout.sub.length < SUB_SLOTS) loadout.sub.push(null);
  const at = loadout.sub.indexOf(id);
  if (at >= 0) { loadout.sub[at] = null; return { ok: true, replaced: null, removed: id }; }  // 再点一次卸下
  const empty = loadout.sub.indexOf(null);
  if (empty >= 0) { loadout.sub[empty] = id; return { ok: true, replaced: null }; }
  const old = loadout.sub[0];
  loadout.sub[0] = id;
  return { ok: true, replaced: old };
}

export function uninstall(loadout, id) {
  if (loadout.main === id) { loadout.main = null; return true; }
  const at = (loadout.sub || []).indexOf(id);
  if (at >= 0) { loadout.sub[at] = null; return true; }
  return false;
}

// 存档校验：把不认识 / 没学过的 id 清成 null，长度补到 2。
// 不这么做的话，删一条心法就会让老存档读进来后永远空着一个槽。
export function sanitize(loadout, owned) {
  const out = { main: null, sub: new Array(SUB_SLOTS).fill(null) };
  const own = owned || {};
  if (loadout && typeof loadout.main === 'string' && MAIN[loadout.main] && own[loadout.main]) out.main = loadout.main;
  const sub = (loadout && Array.isArray(loadout.sub)) ? loadout.sub : [];
  const used = {};
  for (let i = 0; i < SUB_SLOTS; i++) {
    const id = sub[i];
    if (!id || !SUB[id] || !own[id] || used[id]) continue;
    used[id] = 1;
    out.sub[i] = id;
  }
  return out;
}

// 已学等级（没学返回 0）
export function lvOf(owned, id) { return (owned && owned[id]) || 0; }

// 一句话摘要，给 HUD / tooltip 用
export function mantraBrief(a, lv) {
  const parts = [];
  if (a.desc) parts.push(a.desc);
  if (lv && lv > 1) parts.push('注解 ' + lv + ' 级（效果 ×' + lvMul(lv).toFixed(1) + '）');
  return parts.join(' · ');
}
