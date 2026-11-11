// tools/art-unique.js · 全表 80 招零重复诊断
//
// 跑法：node tools/run.js eval tools/art-unique.js
//       URL=https://718997675.github.io/xiaoyaoxing/ node tools/run.js eval tools/art-unique.js
//       PAGE=dist/index.html QS=x=1 node tools/run.js eval tools/art-unique.js
//
// 为什么单独留一个诊断脚本：tools/arts.js §1.5 是「断言」，红了只知道哪条没过；
// 这个脚本是「体检报告」，把每个维度有多少个不同值、还剩哪些共享的底层原子、
// 跨兵器有没有撞车一次列全。用户问「所有武器招数有没有重复」时跑它。
//
// 口径（2026-11-11 用户定案，P12-E 升级）：
//   · 字面零重复 —— shape / pose.mode / snd / hitSnd 四个字段**本身**，
//     在 80 招里各自 80 个不同值。字段里写的字符串一个都不许复用。
//   · 表现实例零重复 —— 形状实例 shape@shv / 动作全参数 / 色彩对 / 声音对，
//     同样各自 80/80。
//   · 仍然共享的是**渲染实现**：16 个画法原子 / 16 个动作原子 / 16 个音色原型。
//     它们是实现，不是招式长相 —— 80 招各有各的参数，长相自然各不相同。
(() => {
  const g = window.__game;
  const A = g.ART_IDS.map(id => g.ARTS[id]);
  const trail = a => g.WEAPONS[a.fam].trail;
  const out = { ok: false, total: A.length, weapons: g.WEAPON_IDS.length,
    literal: {}, signatures: {}, composites: {}, atoms: {}, shared: {}, collisions: [], swings: {} };

  const count = (fn) => {
    const m = new Map();
    for (const a of A) {
      const k = String(fn(a));
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(a.id);
    }
    const dups = [...m.entries()].filter(([, v]) => v.length > 1);
    return { distinct: m.size, dupGroups: dups.length,
      samples: dups.slice(0, 5).map(([k, v]) => k + ' → ' + v.join(',')) };
  };

  // ---- P12-E 字面零重复：四个字段本身，各 80/80 ----
  out.literal['形状 shape'] = count(a => g.artShape(a));
  out.literal['动作 pose.mode'] = count(a => g.artPose(a));
  out.literal['起手音 snd'] = count(a => a.snd);
  out.literal['命中音 hitSnd'] = count(a => a.hitSnd);

  // ---- 四条表现实例：同样必须各自 80/80 ----
  out.signatures['形状实例 shape@shv'] = count(a => g.artShapeSig(a));
  out.signatures['动作全参数'] = count(a => g.artMotionSig(a));
  out.signatures['色彩对'] = count(a => g.artColorSig(a, trail(a)));
  out.signatures['声音对 snd/hitSnd'] = count(a => g.artSoundSig(a));

  // ---- 组合也不许撞（含字段本身，不加 shv）----
  out.composites['形状+动作+色彩'] = count(a =>
    [g.artShape(a), g.artPose(a), g.artColorSig(a, trail(a))].join('|'));
  out.composites['形状+动作+色彩+起手音'] = count(a =>
    [g.artShape(a), g.artPose(a), g.artColorSig(a, trail(a)), a.snd].join('|'));
  out.composites['完整五签名'] = count(a =>
    [g.artShapeSig(a), g.artMotionSig(a), g.artColorSig(a, trail(a)), a.snd, a.hitSnd].join('|'));
  out.composites['招式名 / 描述'] = count(a => a.name + '｜' + a.desc);
  out.composites['机制全字段'] = count(a => Object.keys(a)
    .filter(k => ['id', 'fam', 'name', 'desc', 'pose', 'shape', 'shv', 'color', 'snd', 'hitSnd', 'slot', 'prof'].indexOf(k) < 0)
    .sort().map(k => k + '=' + JSON.stringify(a[k])).join(';'));

  // ---- 底层原子：仍然共享的是「实现」，不是招式长相 ----
  const shapeSpec = g.ART_SHAPE_SPECS || {};
  const poseSpec = g.ART_POSE_SPECS || {};
  out.atoms['画法原子（ART_SHAPE_SPECS 的 k）'] = {
    pool: new Set(Object.keys(shapeSpec).map(k => shapeSpec[k].k)).size,
    spec: Object.keys(shapeSpec).length,
    inUse: new Set(A.map(a => shapeSpec[a.shape] && shapeSpec[a.shape].k).filter(Boolean)).size };
  out.atoms['动作原子（ART_POSE_SPECS 的 k）'] = {
    pool: new Set(Object.keys(poseSpec).map(k => poseSpec[k].k)).size,
    spec: Object.keys(poseSpec).length,
    inUse: new Set(A.map(a => poseSpec[a.pose.mode] && poseSpec[a.pose.mode].k).filter(Boolean)).size };
  out.atoms['音色原型（16 原型 × 5 档）'] = {
    pool: 16, spec: g.ART_SNDS.length,
    inUse: new Set(A.map(a => String(a.snd).replace(/[1-5]$/, ''))).size };

  // ---- 三张池：现在每张都是 80，且全部用满 ----
  out.shared['刀光形状 ART_SHAPES'] = { pool: g.ART_SHAPES.length, inUse: count(a => g.artShape(a)).distinct };
  out.shared['身体动作 ART_POSES'] = { pool: g.ART_POSES.length, inUse: count(a => g.artPose(a)).distinct };
  out.shared['招式音色 ART_SNDS'] = { pool: g.ART_SNDS.length,
    inUse: count(a => a.snd).distinct, hitInUse: count(a => a.hitSnd).distinct };
  out.shared['原语 fx / 功能位 slot / 专精 prof'] = {
    fx: count(a => a.fx).distinct, slot: count(a => a.slot).distinct, prof: count(a => a.prof).distinct };

  // ---- 跨兵器整招撞车：新族（链/扇）不能抄老八族 ----
  const OLD = A.filter(a => ['chain', 'fan'].indexOf(a.fam) < 0);
  const NEW = A.filter(a => ['chain', 'fan'].indexOf(a.fam) >= 0);
  const five = a => [g.artShape(a), g.artPose(a), g.artColorSig(a, trail(a)), a.snd, a.hitSnd].join('|');
  const oldMap = new Map();
  for (const a of OLD) { if (!oldMap.has(five(a))) oldMap.set(five(a), []); oldMap.get(five(a)).push(a.id); }
  for (const a of NEW) if (oldMap.has(five(a)))
    out.collisions.push(a.id + ' ≈ ' + oldMap.get(five(a)).join(','));

  // ---- 10 兵器 × 3 段普攻 ----
  const sw = [];
  for (const f of g.WEAPON_IDS) for (const s of g.WEAPONS[f].swings)
    sw.push([s.mode, s.a0, s.a1, s.dur, s.mul, s.kb, s.lunge, s.hitArc, s.reach].join('|'));
  out.swings = { total: sw.length, distinct: new Set(sw).size };

  out.ok = A.length === 80 && g.WEAPON_IDS.length === 10
    && Object.values(out.literal).every(x => x.distinct === 80)
    && Object.values(out.signatures).every(x => x.distinct === 80)
    && Object.values(out.composites).every(x => x.distinct === 80)
    && out.collisions.length === 0
    && out.swings.distinct === out.swings.total;
  return out;
})()
