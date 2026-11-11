// tools/art-unique.js · 全表 80 招零重复诊断
//
// 跑法：node tools/run.js eval tools/art-unique.js
//       URL=https://718997675.github.io/xiaoyaoxing/ node tools/run.js eval tools/art-unique.js
//       PAGE=dist/index.html QS=x=1 node tools/run.js eval tools/art-unique.js
//
// 为什么单独留一个诊断脚本：tools/arts.js §1.4 是「断言」，红了只知道哪条没过；
// 这个脚本是「体检报告」，把每个维度有多少个不同值、还剩哪些共享基础形、
// 跨兵器有没有撞车一次列全。用户问「所有武器招数有没有重复」时跑它。
//
// 口径（2026-11-11 用户定案）：四个感知签名在 80 招里各自 80 个不同值。
// 19 形 / 20 式 / 17 音是渲染与合成的「基础原型」，允许共享；重复的是原型，
// 不是招式长相 —— 每招靠 shv 几何变体 / 动作全参数 / 独立配色 / 独立声音对区分。
(() => {
  const g = window.__game;
  const A = g.ART_IDS.map(id => g.ARTS[id]);
  const trail = a => g.WEAPONS[a.fam].trail;
  const out = { ok: false, total: A.length, weapons: g.WEAPON_IDS.length,
    signatures: {}, composites: {}, primitiveCombos: {}, sharedPrimitives: {}, collisions: [], swings: {} };

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

  // ---- 四条表现实例：必须各自 80/80 ----
  out.signatures['形状实例 shape@shv'] = count(a => g.artShapeSig(a));
  out.signatures['动作全参数'] = count(a => g.artMotionSig(a));
  out.signatures['色彩对'] = count(a => g.artColorSig(a, trail(a)));
  out.signatures['声音对 snd/hitSnd'] = count(a => g.artSoundSig(a));

  // ---- 共享原型组合：刻意不要求唯一，列出来只是让人看清「重复的是原型」----
  // 两招都叫 thrust/lunge 不算撞车：形状实例靠 shv 拉开几何，动作靠全参数
  // 拉开曲线，再加上互不相干的配色与声音对。
  out.primitiveCombos['基础形'] = count(a => g.artShape(a));
  out.primitiveCombos['动作原型 pose.mode'] = count(a => g.artPose(a));
  out.primitiveCombos['基础形+动作原型'] = count(a => g.artShape(a) + '|' + g.artPose(a));

  // ---- 任意组合也不许撞（含基础形，不加 shv）----
  out.composites['基础形+动作+色彩'] = count(a =>
    [g.artShape(a), g.artPose(a), g.artColorSig(a, trail(a))].join('|'));
  out.composites['基础形+动作+色彩+起手音'] = count(a =>
    [g.artShape(a), g.artPose(a), g.artColorSig(a, trail(a)), a.snd].join('|'));
  out.composites['完整五签名'] = count(a =>
    [g.artShapeSig(a), g.artMotionSig(a), g.artColorSig(a, trail(a)), a.snd, a.hitSnd].join('|'));
  out.composites['招式名 / 描述'] = count(a => a.name + '｜' + a.desc);
  out.composites['机制全字段'] = count(a => Object.keys(a)
    .filter(k => ['id', 'fam', 'name', 'desc', 'pose', 'shape', 'shv', 'color', 'snd', 'hitSnd', 'slot', 'prof'].indexOf(k) < 0)
    .sort().map(k => k + '=' + JSON.stringify(a[k])).join(';'));

  // ---- 仍共享的基础原型（刻意保留，列出来方便复核）----
  out.sharedPrimitives['刀光基础形 ART_SHAPES'] = { pool: g.ART_SHAPES.length,
    inUse: count(a => g.artShape(a)).distinct, variantsUsed: A.filter(a => a.shv > 1).length };
  out.sharedPrimitives['动作原型 ART_POSES'] = { pool: g.ART_POSES.length,
    inUse: count(a => g.artPose(a)).distinct };
  out.sharedPrimitives['音色原型 ART_SNDS'] = { pool: g.ART_SNDS.length,
    inUse: count(a => a.snd).distinct, hitInUse: count(a => a.hitSnd).distinct };
  out.sharedPrimitives['原语 fx / 功能位 slot / 专精 prof'] = {
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
    && Object.values(out.signatures).every(x => x.distinct === 80)
    && Object.values(out.composites).every(x => x.distinct === 80)
    && out.collisions.length === 0
    && out.swings.distinct === out.swings.total
    && A.filter(a => a.shv > 1).length >= 60;
  return out;
})()
