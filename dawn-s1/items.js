// items.js · 装备系统（兵器 / 衣甲 / 项链 / 法宝 四槽位）
// 稀有度 · 词缀 · 掉落权重 · 分解 · 强化 —— 刷装备闭环的数据层
// 纯数据 + 纯函数，无 DOM / 无 three.js 依赖，可单测。

import { WEAPONS, WEAPON_IDS } from './weapons.js';

export const RARITY = [
  { id: 0, name: '凡品', color: '#E8DFC8', mult: 0.75, affixes: 0 },
  { id: 1, name: '精品', color: '#5FA8A0', mult: 0.95, affixes: 1 },
  { id: 2, name: '灵品', color: '#8A6FC4', mult: 1.25, affixes: 2 },
  { id: 3, name: '仙品', color: '#C8453B', mult: 1.60, affixes: 3 },
  { id: 4, name: '传世', color: '#D9A441', mult: 2.05, affixes: 4 },
];
export const RARITY_NAME = RARITY.map(r => r.name);

export const SLOTS = ['weapon', 'armor', 'necklace', 'artifact'];
export const SLOT_LABEL = { weapon: '兵器', armor: '衣甲', necklace: '项链', artifact: '法宝' };

// 词缀：lo/hi 为 1 级基准区间，实际值随品阶与稀有度缩放
export const AFFIXES = [
  { id: 'atk', name: '锋锐', stat: 'atk', w: 1.00, lo: 2, hi: 5, slots: ['weapon'] },
  { id: 'def', name: '厚重', stat: 'def', w: 1.00, lo: 1, hi: 3, slots: ['armor'] },
  { id: 'hp', name: '固元', stat: 'hp', w: 1.00, lo: 8, hi: 18, slots: ['weapon', 'armor', 'necklace'] },
  { id: 'crit', name: '锐目', stat: 'crit', w: 0.75, lo: 1, hi: 3, slots: ['weapon', 'armor', 'necklace', 'artifact'] },
  { id: 'critDmg', name: '裂魂', stat: 'critDmg', w: 0.60, lo: 8, hi: 16, slots: ['weapon', 'armor', 'necklace', 'artifact'] },
  { id: 'spd', name: '踏云', stat: 'spd', w: 0.50, lo: 1, hi: 3, slots: ['armor'] },
  { id: 'cdr', name: '归元', stat: 'cdr', w: 0.55, lo: 2, hi: 5, slots: ['armor', 'artifact'] },
  { id: 'lifesteal', name: '饮血', stat: 'lifesteal', w: 0.40, lo: 1, hi: 2, slots: ['weapon', 'artifact'] },
  { id: 'luck', name: '寻珍', stat: 'luck', w: 0.50, lo: 2, hi: 6, slots: ['armor', 'necklace', 'artifact'] },
  { id: 'atkSpd', name: '迅捷', stat: 'atkSpd', w: 0.55, lo: 2, hi: 5, slots: ['weapon', 'necklace'] },
  { id: 'qiMax', name: '蕴灵', stat: 'qiMax', w: 0.85, lo: 4, hi: 10, slots: ['armor', 'necklace', 'artifact'] },
  { id: 'qiRegen', name: '吐纳', stat: 'qiRegen', w: 0.60, lo: 1, hi: 3, slots: ['necklace', 'artifact'] },
  { id: 'skillDmg', name: '通玄', stat: 'skillDmg', w: 0.65, lo: 4, hi: 9, slots: ['weapon', 'artifact'] },
  { id: 'comboPct', name: '连绵', stat: 'comboPct', w: 0.45, lo: 3, hi: 7, slots: ['armor', 'necklace'] },
  { id: 'qiOnHit', name: '凝神', stat: 'qiOnHit', w: 0.40, lo: 1, hi: 2, slots: ['necklace', 'artifact'] },
];

export const STAT_LABEL = {
  atk: '攻击', def: '防御', hp: '气血', crit: '暴击', critDmg: '暴伤',
  spd: '移速', cdr: '冷却', lifesteal: '吸血', luck: '幸运',
  atkSpd: '攻速', qiMax: '真气', qiRegen: '回气', skillDmg: '术法',
  comboPct: '连击', qiOnHit: '凝气',
};

// 各槽位基础名池（按稀有度分层）
const BASES = {
  weapon: {
    sword: [['木剑', '铁剑'], ['铁剑', '青锋剑'], ['青锋剑', '龙泉剑'], ['龙泉剑', '湛卢'], ['龙渊剑', '太阿']],
    blade: [['柴刀', '铁刀'], ['环首刀', '柳叶刀'], ['雁翎刀', '苗刀'], ['斩马刀', '陌刀'], ['赤霄', '问天']],
    spear: [['木枪', '白蜡枪'], ['白蜡枪', '铁枪'], ['虎头枪', '游龙枪'], ['涯角枪', '破军枪'], ['天狼枪', '龙胆']],
    staff: [['竹棍', '木棍'], ['齐眉棍', '镔铁棍'], ['镔铁棍', '盘龙棍'], ['降魔杵', '伏魔杵'], ['定海神针', '混元杵']],
    dual: [['匕首', '短刀'], ['双股剑', '柳叶双刀'], ['鸳鸯钺', '双龙刃'], ['雌雄双股剑', '分水双刃'], ['干将莫邪', '日月双轮']],
    hammer: [['木锤', '石锤'], ['铁锤', '流星锤'], ['狼牙棒', '蒺藜锤'], ['混元锤', '震天锤'], ['开山钺', '番天印']],
    mage: [['桃木杖', '竹节杖'], ['乌木杖', '引气杖'], ['太乙杖', '星纹杖'], ['紫霄杖', '九曜灵杖'], ['通天法杖', '太虚造化杖']],
    dart: [['铁蒺藜', '竹镖'], ['柳叶镖', '袖箭'], ['透骨钉', '追魂镖'], ['子午梅花镖', '无影飞芒'], ['天罗星', '修罗七杀镖']],
    chain: [['麻绳链', '铁索'], ['铁索', '九节链'], ['乌龙链', '盘龙索'],
            ['缚龙链', '锁云索'], ['沉江链', '天罡锁']],
    fan: [['纸扇', '竹扇'], ['折扇', '绢扇'], ['清风扇', '玉骨扇'],
          ['流云扇', '阴阳扇'], ['五明扇', '太虚羽扇']],
  },
  armor: [['短褐', '布衣'], ['劲装', '皮甲'], ['软猬甲', '锁子甲'], ['玄铁甲', '云锦袍'], ['锦麟袍', '明光铠']],
  necklace: [['木珠串', '平安符'], ['长命锁', '铜铃铛'], ['紫玉坠', '璎珞'], ['太虚链', '九曜珠'], ['昆仑佩', '周天星斗']],
  artifact: [['铜铃', '朱砂符'], ['八卦镜', '雷击木'], ['引魂幡', '乾坤袋'], ['太乙珠', '照妖镜'], ['山河扇', '混天绫']],
};

let uid = 1;
export function nextUid() { return uid++; }

// 权重直接读 WEAPONS[*].dropW，新增兵器不用再手工同步权重数组的长度/顺序。
// 法杖与暗器各占约 1 成，普通小怪身上也刷得出来，不至于只在 Boss 掉落里见到。
export function randomFam(rng = Math.random) {
  const total = WEAPON_IDS.reduce((s, id) => s + (WEAPONS[id].dropW || 10), 0);
  let r = rng() * total, acc = 0;
  for (let i = 0; i < WEAPON_IDS.length; i++) {
    acc += WEAPONS[WEAPON_IDS[i]].dropW || 10;
    if (r <= acc) return WEAPON_IDS[i];
  }
  return WEAPON_IDS[0];
}

function affixRollVal(a, r, ilvl, rng) {
  const rm = [0.80, 0.95, 1.15, 1.35, 1.70][r];
  const base = a.lo + rng() * (a.hi - a.lo);
  return Math.max(1, Math.round(base * (1 + (ilvl - 1) * 0.16) * rm));
}

// 生成一件装备
export function makeGear(kind, r, ilvl, rng = Math.random, fam) {
  const t = RARITY[r];
  const rm = t.mult;
  const slot = kind || 'weapon';
  const b = { atk: 0, def: 0, hp: 0, qiMax: 0, skillDmg: 0 };
  let family = null;

  if (slot === 'weapon') {
    family = fam && WEAPONS[fam] ? fam : randomFam(rng);
    const W = WEAPONS[family];
    b.atk = Math.round((2 + ilvl * 1.7) * rm * W.atkMul);
  } else if (slot === 'armor') {
    b.def = Math.round((1.2 + ilvl * 1.2) * rm);
    b.hp = Math.round((6 + ilvl * 4) * rm);
  } else if (slot === 'necklace') {
    b.hp = Math.round((5 + ilvl * 3) * rm);
  } else if (slot === 'artifact') {
    b.qiMax = Math.round((4 + ilvl * 1.4) * rm);
    b.skillDmg = Math.round((2 + ilvl * 0.7) * rm);
  }

  const affixes = [];
  const pool = AFFIXES.filter(a => a.slots.indexOf(slot) >= 0);
  const used = new Set();
  for (let i = 0; i < t.affixes; i++) {
    const cand = pool.filter(a => !used.has(a.id));
    if (!cand.length) break;
    const total = cand.reduce((s, a) => s + a.w, 0);
    let roll = rng() * total, pick = cand[cand.length - 1];
    for (const a of cand) { roll -= a.w; if (roll <= 0) { pick = a; break; } }
    used.add(pick.id);
    affixes.push({ id: pick.id, name: pick.name, stat: pick.stat, val: affixRollVal(pick, r, ilvl, rng) });
  }

  const pool2 = slot === 'weapon' ? (BASES.weapon[family] || BASES.weapon.sword)[r] : BASES[slot][r];
  let name = pool2[Math.floor(rng() * pool2.length)];
  if (r >= 2 && affixes.length) name = affixes[0].name + '·' + name;
  if (r >= 4) name = '传世·' + name;

  const id = nextUid();
  // skin 决定宝石纹样：同类同品阶的兵器也会长得不一样，且随存档固定不变
  const gear = { uid: id, kind: slot, fam: family, name, r, ilvl, b, affixes, enh: 0 };
  if (slot === 'weapon') gear.skin = (id + r * 7) % 3;
  return gear;
}

// 装备最终属性（含强化加成）
export function gearStats(it) {
  const m = 1 + (it.enh || 0) * 0.14;
  const s = {
    atk: 0, def: 0, hp: 0, crit: 0, critDmg: 0, spd: 0, cdr: 0, lifesteal: 0, luck: 0,
    atkSpd: 0, qiMax: 0, qiRegen: 0, skillDmg: 0, comboPct: 0, qiOnHit: 0,
  };
  const e = it.enh || 0;
  s.atk = Math.round(it.b.atk * m) + e;
  s.def = Math.round(it.b.def * m) + e;
  s.hp = Math.round(it.b.hp * m) + e * 4;
  s.qiMax = Math.round((it.b.qiMax || 0) * m) + e;
  s.skillDmg = Math.round((it.b.skillDmg || 0) * m);
  for (const a of it.affixes) s[a.stat] = (s[a.stat] || 0) + a.val;
  return s;
}

// 装备评分（用于对比 / 自动分解阈值）
export function itemScore(it) {
  const g = gearStats(it);
  return Math.round(
    g.atk * 3 + g.def * 2.5 + g.hp * 0.32 + g.crit * 8 + g.critDmg * 1.25 +
    g.spd * 4 + g.cdr * 4.5 + g.lifesteal * 6 + g.luck * 3 + g.atkSpd * 3.2 +
    g.qiMax * 1.6 + g.qiRegen * 6 + g.skillDmg * 2.2 + g.comboPct * 2.2 + g.qiOnHit * 5
  );
}

// 掉落稀有度权重：tier 0 普通 / 1 精英 / 2 Boss
export function rollRarity(luck, tier = 0, rng = Math.random) {
  let w;
  if (tier >= 2) w = [0, 14, 38, 32, 16];
  else if (tier === 1) w = [22, 34, 27, 13, 4];
  else w = [58, 26, 11, 4, 1];
  const lw = 1 + Math.max(0, luck) / 100;
  for (let i = 1; i < 5; i++) w[i] *= lw;
  const total = w.reduce((a, b) => a + b, 0);
  let roll = rng() * total, r = 0;
  for (let i = 0; i < 5; i++) { roll -= w[i]; if (roll <= 0) { r = i; break; } }
  return r;
}

export function salvageValue(it) {
  // 用 |0 兜底：字段缺失时算成 0，而不是把 NaN 加进玩家的银两里（再存进档就是毒数据）
  const r = it.r | 0, lv = it.ilvl | 0;
  return { iron: 1 + r * 2 + Math.floor(lv * 0.6), gold: 6 + r * 14 + lv * 3 };
}

export function enhanceCost(enh) {
  return { gold: 40 + enh * 35 + enh * enh * 8, iron: 2 + enh };
}
export const MAX_ENH = 12;

export function rerollCost(it) { return { iron: 6 + it.r * 4 }; }

// 重铸：保留稀有度，重掷词缀
export function rerollAffixes(it, rng = Math.random) {
  const t = RARITY[it.r];
  const pool = AFFIXES.filter(a => a.slots.indexOf(it.kind) >= 0);
  const used = new Set();
  const affixes = [];
  // 首领专属词缀不参与重铸 —— 它是"从谁身上掉的"唯一凭证，
  // 重铸一次就没了，等于把首杀的意义抹掉。
  const keep = (it.affixes || []).filter(a => a.uniq);
  for (const a of keep) used.add(a.id);
  for (let i = 0; i < t.affixes; i++) {
    const cand = pool.filter(a => !used.has(a.id));
    if (!cand.length) break;
    const total = cand.reduce((s, a) => s + a.w, 0);
    let roll = rng() * total, pick = cand[cand.length - 1];
    for (const a of cand) { roll -= a.w; if (roll <= 0) { pick = a; break; } }
    used.add(pick.id);
    affixes.push({ id: pick.id, name: pick.name, stat: pick.stat, val: affixRollVal(pick, it.r, it.ilvl, rng) });
  }
  it.affixes = keep.concat(affixes);
  if (!it.unique && it.r >= 2 && affixes.length) {
    const base = it.name.indexOf('·') >= 0 ? it.name.split('·').pop() : it.name.replace(/^传世·/, '');
    it.name = (it.r >= 4 ? '传世·' : '') + affixes[0].name + '·' + base;
  }
  return it;
}

export function itemDesc(it) {
  const g = gearStats(it);
  const lines = [];
  if (g.atk) lines.push(['攻击', g.atk]);
  if (g.def) lines.push(['防御', g.def]);
  if (g.hp) lines.push(['气血', g.hp]);
  if (g.qiMax) lines.push(['真气', g.qiMax]);
  if (g.skillDmg) lines.push(['术法', g.skillDmg + '%']);
  for (const a of it.affixes) lines.push([a.name + '(' + STAT_LABEL[a.stat] + ')', a.val]);
  if (it.enh) lines.push(['强化', '+' + it.enh]);
  return lines;
}
