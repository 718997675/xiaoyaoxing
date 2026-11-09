// skills.js · 仙侠道行树（三支：剑道 / 术法 / 心境）
// 每级境界得 1 点参悟；节点按 tier 逐层解锁，前面的节点至少要投入 1 点。

export const BRANCHES = [
  { id: 'sword', name: '剑道', color: '#C8453B', motto: '一剑破万法' },
  { id: 'spell', name: '术法', color: '#8A6FC4', motto: '御剑引雷' },
  { id: 'body', name: '心境', color: '#2F6E6A', motto: '气随意转' },
];

// mod 为「每级」加成；desc(v) 生成描述
export const NODES = [
  // ---- 剑道 ----
  {
    id: 'fengrui', name: '锋锐', branch: 'sword', tier: 0, max: 5, mod: { atkPct: 6 },
    desc: v => '攻击 +' + (v * 6) + '%',
  },
  {
    id: 'lianmian', name: '连绵剑势', branch: 'sword', tier: 1, max: 3, req: ['fengrui', 1], mod: { atkSpd: 8 },
    desc: v => '出招速度 +' + (v * 8) + '%',
  },
  {
    id: 'jianxin', name: '剑心通明', branch: 'sword', tier: 1, max: 5, req: ['fengrui', 2], mod: { crit: 4 },
    desc: v => '暴击 +' + (v * 4) + '%',
  },
  {
    id: 'liesou', name: '裂魂', branch: 'sword', tier: 2, max: 3, req: ['jianxin', 1], mod: { critDmg: 18 },
    desc: v => '暴击伤害 +' + (v * 18) + '%',
  },
  {
    id: 'wanjian', name: '万剑归宗', branch: 'sword', tier: 2, max: 3, req: ['jianxin', 2], mod: { wuDmg: 0.22, skillDmg: 4 },
    desc: v => '剑舞伤害 +' + (v * 22) + '% · 术法 +' + (v * 4) + '%',
  },
  // ---- 术法 ----
  {
    id: 'yuqi', name: '御剑术', branch: 'spell', tier: 0, max: 3, mod: { qiDmg: 0.22, qiPierce: 1 },
    desc: v => '剑气伤害 +' + (v * 22) + '% · 穿透 +' + v,
  },
  {
    id: 'tianlei', name: '天雷诀', branch: 'spell', tier: 1, max: 3, req: ['yuqi', 1], mod: { thunderDmg: 0.35 },
    active: true, desc: v => '解锁 H 天雷诀 · 伤害 +' + (v * 35) + '%',
  },
  {
    id: 'jianzhen', name: '剑阵', branch: 'spell', tier: 1, max: 3, req: ['yuqi', 2], mod: { wuRadius: 0.16 },
    desc: v => '剑舞范围 +' + (v * 16) + '%',
  },
  {
    id: 'gangqi', name: '剑罡护体', branch: 'spell', tier: 2, max: 3, req: ['tianlei', 1], mod: { dmgReduce: 5, shield: 1 },
    desc: v => '减伤 +' + (v * 5) + '% · 冲刺后得护体罡气',
  },
  // ---- 心境 ----
  {
    id: 'tiegu', name: '铁骨', branch: 'body', tier: 0, max: 5, mod: { hpPct: 8 },
    desc: v => '气血上限 +' + (v * 8) + '%',
  },
  {
    id: 'guiyuan', name: '归元', branch: 'body', tier: 1, max: 4, req: ['tiegu', 1], mod: { qiRegen: 1.4 },
    desc: v => '真气回复 +' + (v * 1.4).toFixed(1) + '/秒',
  },
  {
    id: 'xunfeng', name: '迅风', branch: 'body', tier: 1, max: 3, req: ['tiegu', 2], mod: { spd: 6 },
    desc: v => '移速 +' + (v * 6) + '%',
  },
  {
    id: 'yinxi', name: '饮血', branch: 'body', tier: 2, max: 3, req: ['guiyuan', 1], mod: { lifesteal: 1.2 },
    desc: v => '吸血 +' + (v * 1.2).toFixed(1) + '%',
  },
  {
    id: 'xunzhen', name: '寻珍', branch: 'body', tier: 2, max: 3, req: ['xunfeng', 1], mod: { luck: 9 },
    desc: v => '幸运 +' + (v * 9) + '（提高稀有掉落）',
  },
];

export const NODE_BY_ID = {};
for (const n of NODES) NODE_BY_ID[n.id] = n;

export function nodeLevel(levels, id) { return (levels && levels[id]) || 0; }

// 汇总加成
export function computeSkillStats(levels) {
  const s = {
    atkPct: 0, atkSpd: 0, crit: 0, critDmg: 0, hpPct: 0, dmgReduce: 0,
    qiMax: 0, qiRegen: 0, comboPct: 0, skillDmg: 0, luck: 0, lifesteal: 0,
    qiOnHit: 0, spd: 0, qiDmg: 0, qiPierce: 0, wuDmg: 0, wuRadius: 0, thunderDmg: 0, shield: 0,
  };
  for (const n of NODES) {
    const lv = nodeLevel(levels, n.id);
    if (!lv) continue;
    for (const [k, v] of Object.entries(n.mod)) s[k] = (s[k] || 0) + v * lv;
  }
  return s;
}

export function canLearn(levels, node, points) {
  if (nodeLevel(levels, node.id) >= node.max) return '已至圆满';
  if (points <= 0) return '无参悟点';
  if (node.req) {
    const [id, need] = node.req;
    if (nodeLevel(levels, id) < need) return '需「' + NODE_BY_ID[id].name + '」' + need + '级';
  }
  return null;
}

// 主动技定义（真气消耗 / 冷却）
export const ACTIVES = {
  slash: { key: 'J', name: '斩击', cost: 0, cd: 0 },
  qi: { key: 'K', name: '剑气', cost: 12, cd: 2.2 },
  wu: { key: 'L', name: '剑舞', cost: 22, cd: 6.0 },
  thunder: { key: 'H', name: '天雷诀', cost: 30, cd: 5.0, need: 'tianlei' },
  dash: { key: 'Shift', name: '身法', cost: 0, cd: 0.9 },
  potion: { key: 'Q', name: '回春丹', cost: 0, cd: 0 },
};
