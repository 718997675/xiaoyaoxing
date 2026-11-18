/* art-motion-preview.html 的逐招演出自检。
 * 跑法：env PAGE=art-motion-preview.html node tools/run.js eval tools/art-motion.js
 * 口径（2026-11-12 用户定案）：80 招全部要做，4 个一批送审；不做机制归类、不写通用包、不复制演出。
 * 覆盖：批次结构 / 20 招组件名全表零重名 / 全帧纯函数 / 判定帧锚点 / 组件开关 / 覆盖表协议
 *      + 第 1 批 / 第 2 批 / 第 3 批 / 第 4 批 / 第 5 批各四招专属断言。
 * 第 3 批按用户口径放宽：狂怒是无伤害增益，用 statusEvents 代替 hitEvents，不硬套判定帧。
 * 注意：只验「画面状态是帧号纯函数」，不改游戏本体，也不写覆盖表。 */
(() => {
  const P = window.__preview, C = [];
  const ok = (b, m) => C.push((b ? 'PASS ' : 'FAIL ') + m);
  const idsAll = P.allClips;

  /* ⓪ 批次结构：五个批次各 4 招，当前停在第 5 批 */
  ok(P.batches.length === 5 && P.batches[0] === 'b1' &&
     P.batches[1] === 'b2' && P.batches[2] === 'b3' && P.batches[3] === 'b4' &&
     P.batches[4] === 'b5',
    '五个批次 b1 / b2 / b3 / b4 / b5（打开时停在 ' + P.batch + '）');
  P.setBatch('b1');
  ok(P.batch === 'b1' && P.clips.length === 4 && P.clips[0] === 'sword_1',
    '切到第 1 批：' + P.clips.join(' / '));
  P.setBatch('b2');
  ok(P.batch === 'b2' && P.clips.length === 4 && P.clips[0] === 'blade_1',
    '切到第 2 批：' + P.clips.join(' / '));
  P.setBatch('b3');
  ok(P.batch === 'b3' && P.clips.length === 4 && P.clips[0] === 'blade_5',
    '切到第 3 批：' + P.clips.join(' / '));
  P.setBatch('b4');
  ok(P.batch === 'b4' && P.clips.length === 4 && P.clips[0] === 'spear_1',
    '切到第 4 批：' + P.clips.join(' / '));
  P.setBatch('b5');
  ok(P.batch === 'b5' && P.clips.length === 4 && P.clips[0] === 'spear_5',
    '切到第 5 批：' + P.clips.join(' / '));
  ok(idsAll.length === 20, '已逐招做完 20 / 80：' + idsAll.join(' / '));

  /* ① 全 20 招组件名两两零交集 —— 直接证伪「复制效应」 */
  const names = {};
  idsAll.forEach(id => { P.setClip(id); names[id] = Object.keys(P.fx); });
  let overlap = [];
  for (let i = 0; i < idsAll.length; i++) for (let j = i + 1; j < idsAll.length; j++) {
    const dup = names[idsAll[i]].filter(k => names[idsAll[j]].indexOf(k) >= 0);
    if (dup.length) overlap.push(idsAll[i] + '∩' + idsAll[j] + ':' + dup.join(','));
  }
  ok(overlap.length === 0, '20 招组件名全表零重名（共 ' +
    idsAll.reduce((n, id) => n + names[id].length, 0) + ' 个）' +
    (overlap.length ? ' | ' + overlap.join(' ') : ''));

  /* ② 全 20 招全帧纯函数不抛异常、无 NaN */
  idsAll.forEach(id => {
    P.setClip(id);
    const total = P.cfg.total;
    let bad = [];
    for (let f = 0; f <= total; f++) {
      try {
        const s = P.snapNew(f), o = P.snapOld(f);
        if (!s || !o) { bad.push('f' + f + ':null'); continue; }
        const nums = [s.pos.x, s.pos.y, s.ang, s.enemyHp, s.flash];
        if (nums.some(v => typeof v !== 'number' || !isFinite(v))) bad.push('f' + f + ':NaN');
      } catch (e) { bad.push('f' + f + ':' + e.message); }
    }
    ok(bad.length === 0, id + ' 全 ' + (total + 1) + ' 帧无异常 / 无 NaN' +
      (bad.length ? ' | ' + bad.slice(0, 3).join(', ') : ''));
  });

  /* ③ 每个组件开关单独关掉，页面仍能渲染（开关是真的，不是摆设） */
  idsAll.forEach(id => {
    P.setClip(id);
    const keys = Object.keys(P.fx), total = P.cfg.total;
    let bad = [];
    keys.forEach(k => {
      const old = P.fx[k]; P.fx[k] = false;
      try {
        [0, Math.floor(total / 2), P.cfg.hit, total].forEach(f => P.snapNew(f));
      } catch (e) { bad.push(k + ':' + e.message); }
      P.fx[k] = old;
    });
    ok(bad.length === 0, id + ' ' + keys.length + ' 个组件开关逐个关闭仍可渲染' +
      (bad.length ? ' | ' + bad.slice(0, 2).join(', ') : ''));
  });

  /* ④ 协议字段必须落在覆盖表白名单内。
   * 顶层是「协议说明」（timeline / components / hitEvents / motion 等），
   * 真正要导出成覆盖表的是 protocol.override，白名单只约束它。 */
  const SAFE = ['name', 'desc', 'cd', 'cost', 'mul', 'reach', 'arc', 'radius', 'len', 'width',
    'kb', 'pierceDef', 'status', 'fx', 'color', 'shape', 'shv', 'pose', 'snd', 'hitSnd',
    'fxDelay', 'fxLife', 'timeline', 'frames', 'frameScale', 'frameRotate'];
  let protoBad = [], compBad = [], kindBad = [], noteBad = [];
  const kinds = [], totals = [], hits = [];
  idsAll.forEach(id => {
    P.setClip(id);
    const p = P.protocol, ov = p.override || {};
    Object.keys(ov).forEach(k => {
      if (k !== 'id' && SAFE.indexOf(k) < 0) protoBad.push(id + '.override.' + k);
    });
    if (!Array.isArray(p.components) || !p.components.length ||
        p.components.length !== Object.keys(P.fx).filter(k => P.fx[k]).length) compBad.push(id);
    /* 无伤害招按机制放宽：空 hitEvents 合法，但必须自己声明 damage:false + statusEvents */
    if (!Array.isArray(p.hitEvents)) compBad.push(id + '.hitEvents');
    else if (p.hitEvents.length === 0){
      const nodmg = p.cast && p.cast.damage === false &&
        Array.isArray(p.statusEvents) && p.statusEvents.length > 0;
      if (!nodmg) compBad.push(id + '.hitEvents(空但未声明无伤害 statusEvents)');
    }
    if (p.pack !== undefined) protoBad.push(id + '.pack（通用包字段已废弃）');
    kinds.push(p.kind); totals.push(P.cfg.total); hits.push(P.cfg.hit);
    if (idsAll.indexOf(id) >= 4 && (!p.note || p.note.indexOf('逐招独立设计') < 0)) noteBad.push(id);
  });
  ok(protoBad.length === 0, '20 招 override 字段均在 OVERRIDE_SAFE 白名单内、无通用包字段' +
    (protoBad.length ? ' | ' + protoBad.join(', ') : ''));
  ok(compBad.length === 0, '20 招协议都带 components / 命中或状态事件清单（狂怒 / 枪势走 statusEvents）' +
    (compBad.length ? ' | ' + compBad.join(', ') : ''));
  ok(new Set(kinds).size === 20, '20 招协议 kind 各不相同：' + kinds.join(' / '));
  ok(noteBad.length === 0, '第 2 / 3 / 4 / 5 批 16 招协议都写明「逐招独立设计」' +
    (noteBad.length ? ' | ' + noteBad.join(', ') : ''));
  ok(new Set(totals).size >= 17 && new Set(hits).size >= 18,
    '20 招时间轴长度 / 判定帧不是复制同一条：' + totals.join(',') + ' | f' + hits.join(',f'));

  /* ⑤ 第 1 批（你已确认没问题）：四招各自的判定锚点 */
  P.setBatch('b1');
  P.setClip('sword_1');
  const sw = P.snapNew(P.cfg.hit);
  ok(!!sw.cut && sw.cut.x > 0, '剑 f' + P.cfg.hit + ' 剑身与怪物躯干有交点（不是人贴上去）');

  P.setClip('dart_1');
  const da = P.snapNew(P.cfg.hit);
  const enemyX = da.proj ? da.proj.x : NaN;
  ok(!!da.proj && isFinite(enemyX), '暗器 f' + P.cfg.hit + ' 镖体抵达远处怪物，人物未前冲');
  const daBefore = P.snapNew(P.cfg.release);
  ok(!!daBefore.proj && Math.abs(daBefore.proj.x - enemyX) > 30,
    '暗器 出手帧 f' + P.cfg.release + ' ≠ 判定帧 f' + P.cfg.hit + '（飞行段真的存在）');
  ok(da.pos.x <= P.snapNew(0).pos.x, '暗器命中帧人物无前冲（远程不贴身）');

  P.setClip('mage_8');
  const m1 = P.snapNew(P.cfg.hit), m2 = P.snapNew(P.cfg.hit + 2);
  const landed = m1.bolts.length === 5 && m1.bolts.every((b, i) =>
    b.len > 0 && m2.bolts[i] && Math.abs(b.len - m2.bolts[i].len) < 0.01);
  ok(landed, '法杖 f' + P.cfg.hit + ' 五道雷全部落地，没有一道还悬在半空');
  ok(m1.pos.x === P.snapNew(0).pos.x, '法杖全程人物 0 位移（人不动，世界动）');

  P.setClip('fan_3');
  const fa = P.snapNew(P.cfg.hit);
  ok(Math.abs(fa.waveX - enemyX) < 0.01,
    '扇 f' + P.cfg.hit + ' 波前弧顶 x 正好落在怪物身上（' + Math.round(fa.waveX) + ' vs ' + Math.round(enemyX) + '）');
  const faBefore = P.snapNew(P.cfg.waveStart);
  ok(faBefore.waveX < fa.waveX - 20,
    '扇 波前出发 f' + P.cfg.waveStart + ' → 抵达 f' + P.cfg.hit + ' 是推进而不是原地放大');
  ok(fa.pos.x === P.snapNew(0).pos.x, '扇全程人物 0 位移（人不动，气浪动）');

  /* ⑥ 第 1 批两条用户口径：飞蝗直线 + 散开；天雷引弧雷 + 阵法 */
  P.setClip('dart_1');
  const dc = P.cfg;
  const d0 = P.snapNew(dc.release);
  const dm = P.snapNew(Math.round((dc.release + dc.hit) / 2));
  const dh = P.snapNew(dc.hit);
  const k1 = (dm.proj.y - d0.proj.y) / (dm.proj.x - d0.proj.x);
  const k2 = (dh.proj.y - dm.proj.y) / (dh.proj.x - dm.proj.x);
  ok(dc.arc === undefined && Math.abs(k1 - k2) < 1e-9,
    '暗器弹道是直线（无 arc 抬升，两段斜率一致）');
  ok(P.protocol.motion.projectile.trajectory === 'straight', '暗器协议写明 trajectory: straight');
  const rad = s => Math.max.apply(null, s.shards.map(p => Math.sqrt(p.dx * p.dx + p.dy * p.dy)));
  ok(dh.rays.length >= 10 && dh.shards.length >= 10 && rad(dh) > 0,
    '暗器判定帧已有放射光束 + 碎片散开（不是原地闪一下）');
  ok(rad(P.snapNew(dc.hit + 3)) > rad(dh) + 3, '暗器散开随帧继续向外推开');

  P.setClip('mage_8');
  const mc = P.cfg, mg = P.snapNew(mc.hit);
  ok(mg.bolts.length === 5 && mg.bolts.every(b =>
      typeof b.srcX === 'number' && typeof b.bend === 'number') &&
      mg.bolts.some(b => Math.abs(b.srcX - b.x) > 5),
    '法杖五道雷都有阵心起点 + 弧度量（不是垂直光柱）');
  ok(mc.bend > 0 && P.fx.sigilArc === true && P.fx.sigilEye === true && mg.eyeA > 0.99,
    '法杖有可调雷弧 + 大阵弧环 / 五阵眼，判定帧阵眼全亮');
  ok(P.protocol.cast.trajectory === 'arc-from-sigil', '法杖协议写明 trajectory: arc-from-sigil');

  /* ⑦ 第 2 批（本次送审）：四招各自独立，互不复制 */
  P.setBatch('b2');
  P.setClip('blade_1');
  const O = P.snapNew(0).pos;                 // 人物原点 (76,106)
  const EY = O.y - 4;                         // 怪物脚底 y
  const b1 = P.snapNew(P.cfg.hit);
  ok(!!b1.tip && Math.abs(b1.tip.x - enemyX) < 8 && b1.tip.y > EY - 21 && b1.tip.y < EY + 2,
    '力劈 f' + P.cfg.hit + ' 刀尖真的砸进怪物躯干（' +
      (b1.tip ? Math.round(b1.tip.x) + ',' + Math.round(b1.tip.y) : 'null') +
      ' vs 怪物 ' + Math.round(enemyX) + ',' + EY + '）');
  ok(b1.trail.length >= 4 && b1.cracks.length >= 5 && !!b1.shock && b1.dust.length >= 5,
    '力劈判定帧是竖向轨迹 + 地面裂纹 / 冲击环 / 尘柱，不是剑的横向切线扇');
  ok(b1.frozen === true && P.protocol.cast.trajectory === 'vertical-arc',
    '力劈有 2 帧 hitstop，协议写明 vertical-arc（过顶重劈）');

  P.setClip('blade_2');
  const b2h = P.snapNew(P.cfg.hit), b2m = P.snapNew(P.cfg.hit + 10);
  const b2e = P.snapNew(P.cfg.bleedEnd + 1);
  ok(!!b2h.wound && !!b2m.wound && b2m.wound.len > b2h.wound.len,
    '血刃判定后留下一道会变长的细长裂口（不是一次性爆点）');
  ok(b2m.drips.length >= 2 && !!b2m.pool && b2m.pool.r > 0 && b2m.mist.length > 0,
    '血刃 f' + (P.cfg.hit + 10) + ' 持续渗血：血珠下坠 / 地面积血 / 淡血雾');
  ok(!!b2e.wound && b2e.wound.a < 1 && b2e.wound.a > 0,
    '血刃流血结束后伤口才淡去（21 帧状态有头有尾）');
  ok(P.protocol.hitEvents[0].status &&
     P.protocol.hitEvents[0].status.kind === 'bleed' &&
     P.protocol.hitEvents[0].status.frames === P.cfg.bleedEnd - P.cfg.hit,
    '血刃协议把 bleed 5s / 12% 写成命中后 ' + (P.cfg.bleedEnd - P.cfg.hit) + ' 帧持续状态');
  ok(b2h.flash === 0 && P.protocol.kind === 'bleed-cut',
    '血刃没有力劈的白闪 / 砸地语言（割伤 ≠ 砸伤）');

  /* ⑦-3 横扫千军（用户口径）：单手 / 原地 / 360° / 大范围 / 贴地平面 / 挥完停顿 */
  P.setClip('blade_3');
  const b3c = P.cfg, b3 = P.snapNew(b3c.hit), b3end = P.snapNew(b3c.sweepEnd);
  const ringTarget = enemyX - O.x;
  ok(Math.abs(b3.ringR - ringTarget) < 0.01 && Math.abs(b3.ang) < 0.05,
    '横扫千军 f' + b3c.hit + ' 平面环前缘正好抵达怪物、刀锋指向怪物方位（环R ' +
      Math.round(b3.ringR) + ' / ' + ringTarget + '，角 ' + b3.ang.toFixed(3) + 'rad）');
  ok(b3.oneHand === true && b3.twin === false && P.heroKind === 'blade' &&
     P.protocol.cast.hand === 'single',
    '横扫千军单手一把刀（不是双手双刃）');
  let b3Move = 0;
  for (let f = 0; f <= b3c.total; f++) if (P.snapNew(f).pos.x !== O.x) b3Move++;
  ok(b3Move === 0, '横扫千军全程 ' + (b3c.total + 1) + ' 帧 0 位移（原地挥摆）');
  const sweepDeg = (b3end.ang - P.snapNew(b3c.sweepStart).ang) * 180 / Math.PI;
  ok(P.art.arc === 6.28 && Math.abs(sweepDeg - 360) < 2 && b3end.sweepP === 1,
    '横扫千军实打实挥满 360°（' + sweepDeg.toFixed(1) + '°），不是扇形');
  ok(b3c.ringMax >= ringTarget * 2 && Math.abs(b3end.ringR - b3c.ringMax) < 0.01,
    '横扫千军范围够大：判定帧 ' + ringTarget + 'px → 扫满 ' + b3c.ringMax + 'px（≥ 2 倍）');
  ok(b3.flat === true && b3.flatSwing === true && b3.squash < 0.5 &&
     P.protocol.cast.plane === 'ground' && P.protocol.cast.trajectory === 'ground-plane-360',
    '横扫千军是贴地平面椭圆（压扁 ' + b3.squash + '），从地图上看是平的，不是立起来的圆环');
  /* 停顿：只有 pauseLen 帧 frozen，且这 6 帧整幅画面（含伤害数字）逐像素定住 */
  const frozen = [];
  for (let f = 0; f <= b3c.total; f++) if (P.snapNew(f).frozen) frozen.push(f);
  ok(frozen.length === b3c.pauseLen && frozen[0] === b3c.pause &&
     frozen[frozen.length - 1] === b3c.pause + b3c.pauseLen - 1,
    '横扫千军挥完有 ' + b3c.pauseLen + ' 帧收势停顿（f' + b3c.pause + '~f' +
      (b3c.pause + b3c.pauseLen - 1) + '），其余帧不停');
  const vis = s => JSON.stringify({ pos:s.pos, ang:s.ang, ringR:s.ringR, squash:s.squash,
    segs:s.segs, wind:s.wind, dust:s.dust, push:s.push, shake:s.shake,
    kick:s.enemyKick, flash:s.flash, popAge:s.popAge, pose:s.pose, bladeTip:s.bladeTip });
  const still = frozen.every(f => vis(P.snapNew(f)) === vis(P.snapNew(frozen[0])));
  ok(still, '停顿段整幅画面定住：刀不转 / 环凝固 / 尘不落 / 伤害数字不飘（6 帧状态完全一致）');
  ok(P.protocol.cast.pause && P.protocol.cast.pause.frames === b3c.pauseLen,
    '横扫千军协议写明收势停顿帧数');

  /* ⑦-4 旋风斩（用户口径）：双手 / 边走边转 / 3~5s / 周边刀刃旋风；且与横扫千军彻底不近似 */
  P.setClip('blade_4');
  const b4c = P.cfg;
  ok(b4c.total / b4c.fps >= 3 && b4c.total / b4c.fps <= 5 &&
     P.snapNew(0).seconds === +(b4c.total / b4c.fps).toFixed(2),
    '旋风斩整招 ' + (b4c.total / b4c.fps).toFixed(2) + 's，落在用户要求的 3~5s 内');
  ok((b4c.spinEnd - b4c.spinStart) / b4c.fps >= 3 &&
     Math.abs(P.protocol.cast.spinSeconds - (b4c.spinEnd - b4c.spinStart) / b4c.fps) < 0.01,
    '旋风斩连续旋身 ' + ((b4c.spinEnd - b4c.spinStart) / b4c.fps).toFixed(2) + 's（不是转一下就收）');
  ok(P.heroKind === 'twinBlade' && P.snapNew(60).twin === true &&
     P.snapNew(60).oneHand === false && P.protocol.cast.hand === 'twin',
    '旋风斩双手各持一刀（drawHero 走 twinBlade 分支，两把刃一起转）');
  /* 2026-11-12 用户两条口径，缺一不可：
   *   ①「旋风斩是手拿着武器挥动，不是武器在中间，看不到手」
   *   ②「旋风斩是平面的，挥舞动作跟地面平行，不是垂直于地面」
   * 绘制与自检共用 twinRig() 这一份几何。平面版字段是
   * hx/hy(手) px/py(柄) gx/gy(护手) tx/ty(刀尖) ex/ey(肘) a/ea/far/fy，
   * 全部满足 x=cos(a)*R、y=cy+sin(a)*R*fy，没有任何抬离地面的分量。
   * 「手在体外」必须用椭圆空间半径 r()（除以 fy 还原压扁），不能再用屏幕欧氏距离：
   * 贴地后 sin(a)=±1 时手离中心只有 9.6px，那不是手缩回去了，是地面透视压扁。 */
  const s60 = P.snapNew(60);
  const hs = s60.hands || [];
  const r = (h, x, y) => Math.hypot(x - h.cx, (y - h.cy) / h.fy);
  const onEll = (h, x, y, R, ang) =>
    Math.abs(x - Math.cos(ang) * R) < 0.02 &&
    Math.abs((y - h.cy) - Math.sin(ang) * R * h.fy) < 0.02;
  const rigPts = h => [
    ['肩', h.sx, h.sy, 5.5, h.a], ['肘', h.ex, h.ey, h.ER, h.ea],
    ['手', h.hx, h.hy, h.HR, h.a], ['柄', h.px, h.py, h.HR - 4, h.a],
    ['护手', h.gx, h.gy, h.HR + 4, h.a], ['刀尖', h.tx, h.ty, h.HT, h.a]
  ];
  const planeBad = [];
  hs.forEach(h => rigPts(h).forEach(p => {
    if (!onEll(h, p[1], p[2], p[3], p[4])) planeBad.push(p[0]);
  }));
  ok(hs.length === 2 && planeBad.length === 0,
    '肩 / 肘 / 手 / 柄 / 护手 / 刀尖 共 12 个点全落在同一条贴地椭圆上' +
      '（x=cos(a)R, y=cy+sin(a)R*fy）' +
      (planeBad.length ? ' | 脱离：' + planeBad.join(',') : ''));
  ok(hs.length === 2 && hs.every(h => h.fy === 0.32) && s60.squash === 0.32 &&
     hs.every(h => Math.abs(h.hy - h.cy) <= h.HR * 0.32 + 0.01 &&
                   Math.abs(h.ty - h.cy) <= h.HT * 0.32 + 0.01),
    '压扁系数就是 T.squash=0.32：手最高只离中心 ' +
      (hs[0] ? (hs[0].HR * 0.32).toFixed(1) : '?') + 'px、刀尖 ' +
      (hs[0] ? (hs[0].HT * 0.32).toFixed(1) : '?') + 'px，没有抬离地面的分量（不是竖直抡刀）');
  ok(hs.length === 2 && hs.every(h => r(h, h.hx, h.hy) >= 20),
    '两只手仍伸到身体外：平面半径 ' + hs.map(h => r(h, h.hx, h.hy).toFixed(1)).join(' / ') + 'px');
  ok(hs.length === 2 && hs.every(h => r(h, h.gx, h.gy) - r(h, h.hx, h.hy) <= 6 &&
                                    r(h, h.gx, h.gy) > r(h, h.hx, h.hy)),
    '护手贴在手心外 4px（手掌压在刀柄上，看得见「握」）');
  ok(hs.length === 2 && hs.every(h => r(h, h.tx, h.ty) > r(h, h.hx, h.hy) + 20) &&
     hs.every(h => (h.tx - h.cx) * Math.cos(h.a) +
                   ((h.ty - h.cy) / h.fy) * Math.sin(h.a) > 0),
    '刀身只朝体外延伸、不穿过身体中心（刀尖平面半径 ' +
      (hs[0] ? r(hs[0], hs[0].tx, hs[0].ty).toFixed(1) : '?') + 'px）');
  const gapRad = hs.length === 2 ? Math.abs(hs[0].a - hs[1].a) : 0;
  ok(hs.length === 2 && Math.abs(gapRad - Math.PI) > 0.3 &&
     hs.every(h => h.far === (Math.sin(h.a) < 0)),
    '椭圆空间：两把刀错开 ' + (gapRad * 180 / Math.PI).toFixed(0) +
      '°（≠180°），far/near 严格按 sin(a) 分层（靠前后遮挡让手可见）');
  /* 第二层：投影后也不能读成直线。
   * 贴地椭圆 fy=0.32 会把椭圆空间的 150° 拉成屏幕上约 170°，
   * 数学上不共线、视觉上却是一根斜杆穿过身体 —— 这是上一版的盲区。
   * 用屏幕方向角 atan2(sin(a)*fy, cos(a)) 把旋身全程扫一遍。 */
  const fy = 0.32;
  const screenAng = a => Math.atan2(Math.sin(a) * fy, Math.cos(a));
  const angDiff = (x, y) => { const d = Math.abs(x - y); return Math.min(d, 2 * Math.PI - d); };
  let worstScreen = 0, worstAt = 0;
  for (let f = 10; f <= 106; f++){
    const hh = P.snapNew(f).hands || [];
    if (hh.length !== 2) continue;
    const dv = angDiff(screenAng(hh[0].a), screenAng(hh[1].a)) * 180 / Math.PI;
    if (dv > worstScreen){ worstScreen = dv; worstAt = f; }
  }
  ok(worstScreen > 0 && worstScreen < 155,
    '屏幕投影空间：旋身 97 帧里两刀方向差最大 ' + worstScreen.toFixed(1) + '°（f' + worstAt +
      '）< 155°，不读成穿胸斜杆 —— 椭圆空间 + 视觉空间双层都卡');
  const layerSeen = { far:0, near:0 };
  for (let f = 20; f <= 100; f += 2){
    (P.snapNew(f).hands || []).forEach(h => layerSeen[h.far ? 'far' : 'near']++);
  }
  ok(layerSeen.far > 0 && layerSeen.near > 0,
    '旋身全程远近两层都出现过（远侧 ' + layerSeen.far + ' 次 / 近侧 ' + layerSeen.near +
      ' 次），遮挡层次真的在动');
  const h20 = P.snapNew(20).hands || [];
  ok(h20.length === 2 && hs.length === 2 &&
     Math.abs(h20[0].hx - hs[0].hx) + Math.abs(h20[0].hy - hs[0].hy) > 5,
    '手与刀每帧跟着旋身一起动（是「人握着刀挥」，不是静止的武器）');
  const handReach = hs.length ? Math.max.apply(null, hs.map(h => r(h, h.tx, h.ty))) : 0;
  const outerBlades = s60.blades || [];
  ok(outerBlades.length === 18 && outerBlades.every(b => b.outer > handReach + 8),
    '周边 18 片刀刃全退到手持刀之外（' +
      (outerBlades[0] ? outerBlades[0].outer.toFixed(1) : '?') + 'px > ' +
      handReach.toFixed(1) + 'px），不压人物');
  let b4AngMono = true, prevAng = -Infinity;
  for (let f = b4c.spinStart; f <= b4c.spinEnd; f++) {
    const a = P.snapNew(f).ang;
    if (!(a > prevAng)) { b4AngMono = false; break; }
    prevAng = a;
  }
  const turns = (P.snapNew(b4c.spinEnd).ang - P.snapNew(b4c.spinStart).ang) / (2 * Math.PI);
  ok(b4AngMono && turns >= 6 && P.protocol.cast.trajectory === 'continuous-spin',
    '旋风斩旋身期间每帧都在转、无停顿，共约 ' + turns.toFixed(1) + ' 圈');
  const b60 = P.snapNew(60);
  ok(b60.bladesCount === 0 || b60.bladesCount === b4c.bladeN, '旋风斩周边刀刃数量随帧到位');
  ok(P.snapNew(0).bladesCount === 0 && b60.bladesCount === b4c.bladeN &&
     b60.blades.length === b4c.bladeN && b60.vortex.length === b4c.vortexN &&
     P.protocol.cast.blades === b4c.bladeN,
    '旋风斩周边形成 ' + b4c.bladeN + ' 片刀刃 + ' + b4c.vortexN + ' 条贴地螺旋风纹');
  /* 用户口径：旋风斩跟横扫千军一样是平面的，不是垂直的 */
  const maxBy = Math.max.apply(null, b60.blades.map(b => Math.abs(b.by)));
  const maxBx = Math.max.apply(null, b60.blades.map(b => Math.abs(Math.cos(b.a) * b.r)));
  const maxR = Math.max.apply(null, b60.blades.map(b => b.r));
  ok(b60.flat === true && b60.squash < 0.5 && P.protocol.cast.plane === 'ground-plane-whirl' &&
     maxBy <= b60.squash * maxR + 0.01 && maxBy < maxBx * 0.5,
    '旋风斩也是平面（跟横扫千军一样）：刀刃离地最高 ' + maxBy.toFixed(1) +
      'px、横向铺开 ' + maxBx.toFixed(1) + 'px，压扁 ' + b60.squash + ' —— 不是竖直风柱');
  const vortexFlat = b60.vortex.every(pts =>
    pts.every(p => Math.abs(p.y) <= b4c.radius * b4c.squash + 0.01));
  const vx = Math.max.apply(null, b60.vortex[0].map(p => Math.abs(p.x)));
  const vy = Math.max.apply(null, b60.vortex[0].map(p => Math.abs(p.y)));
  ok(vortexFlat && vy < vx * 0.5,
    '旋风斩的风纹整条压在地面平面上（纵向 ' + vy.toFixed(1) + 'px vs 横向 ' +
      vx.toFixed(1) + 'px，不往上卷）');
  let b4Mono = true, prevX = -Infinity;
  for (let f = 0; f <= b4c.total; f++) {
    const x = P.snapNew(f).pos.x;
    if (x < prevX - 1e-9) { b4Mono = false; break; }
    prevX = x;
  }
  const b4Step = P.snapNew(b4c.total).pos.x - O.x;
  ok(b4Mono && b4Step > 20,
    '旋风斩边走边斩：全程单调推进 ' + Math.round(b4Step) + 'px（横扫千军是 0 位移）');
  ok(Array.isArray(b4c.hits) && b4c.hits.length === 4 &&
     P.protocol.hitEvents.length === 4 && P.protocol.cast.ticks === 4,
    '旋风斩仍是四段判定：' + b4c.hits.map(f => 'f' + f).join(' / '));
  ok(P.snapNew(0).hitCount === 0 && P.snapNew(50).hitCount === 2 &&
     P.snapNew(80).hitCount === 3 && P.snapNew(102).hitCount === 4,
    '旋风斩四段随帧逐段结算，不是第 0 帧一次打完');
  ok(P.snapNew(80).enemyHp === 200 - b4c.perTick * 3 &&
     P.snapNew(102).enemyHp === 200 - b4c.perTick * 4 &&
     P.snapNew(102).dmgShown === b4c.perTick * 4,
    '旋风斩累计伤害按段走：f80 = ' + b4c.perTick * 3 + '，f102 才到全额 ' + b4c.perTick * 4);
  /* 两招「不再近似过头」的硬证据：都是平面，但六个维度两两不同 */
  ok(b3.flat === true && b3.squash < 0.5 && b3.oneHand === true && b3Move === 0 &&
     frozen.length === b3c.pauseLen && P.snapNew(60).flat === true &&
     P.snapNew(60).twin === true && P.snapNew(60).frozen === undefined &&
     b4Step > 20 && P.protocol.cast.plane === 'ground-plane-whirl' &&
     P.protocol.cast.trajectory === 'continuous-spin',
    '两招同为平面但彻底分开：横扫=单手/原地/扫一圈就停/有停顿；旋风=双手/移动/连转 3.2s/无停顿');


  /* ⑧ 第 3 批（返修复审）：四招各自独立，遵守「双手刀 / 单手刀 + 3~5s」；
   * 疾风步三段瞬移 / 断筋「断」字打击感 / 血战八方贴地四残影 均为 2026-11-13 用户返修口径；
   * 同日追加「动作幅度太小看不出是技能」→ ⑧-5 幅度下限（后续每批沿用这把尺子） */
  P.setBatch('b3');
  const b3ids = P.clips.slice();
  const durations = b3ids.map(id => { P.setClip(id); return P.cfg.total / P.cfg.fps; });
  ok(durations.every(d => d >= 3 && d <= 5),
    '第 3 批四招演出时长 ' + durations.map(d => d.toFixed(2) + 's').join(' / ') + ' 全部落在 3~5s');
  const grip = {}, heroK = {};
  b3ids.forEach(id => {
    P.setClip(id);
    grip[id] = P.snapNew(P.cfg.hit).grip;
    heroK[id] = P.heroKind;
  });
  ok(grip.blade_5 === 'single' && grip.blade_6 === 'single' &&
     grip.blade_7 === 'two-hand-one-blade' && grip.blade_8 === 'single' &&
     heroK.blade_7 === 'twoHandBlade' &&
     heroK.blade_5 === 'blade' && heroK.blade_6 === 'blade' && heroK.blade_8 === 'blade',
    '持械口径逐招写死：疾风步 / 断筋 / 血战八方单手刀，狂怒双手合握一把刀（走 twoHandBlade 分支）' +
      '：' + b3ids.map(id => id + '=' + grip[id]).join(' / '));

  /* ⑧-1 疾风步（返修 + 放大）：三段化影瞬移，单段 46px、路径 138px、54px 大弧横斩 */
  P.setClip('blade_5');
  const c5 = P.cfg, s50 = P.snapNew(0);
  const s5b = P.snapNew(c5.seg0 + 2);
  const s5h = c5.hits.map(h => P.snapNew(h));
  const O5 = s50.pos.x;
  ok(c5.blinkDist === 46 && P.protocol.cast.blinks === 3 &&
     P.protocol.cast.blinkDist === 46 && P.protocol.cast.pathDist === 138 &&
     P.protocol.kind === 'three-blink-strike' &&
     P.protocol.cast.trajectory === 'three-step-blink-zigzag',
    '疾风步改成三段独立瞬移：单段 46px（旧版化影 14px 的 3.3 倍）、走位路径 138px，' +
      '才有位移流 build 的取舍');
  ok(Math.round(s5h[0].pos.x - O5) === 46 &&
     Math.round(s5h[1].pos.x - O5) === 92 &&
     Math.round(s5h[2].pos.x - O5) === 46,
    '三段落点 +46 / +92 / +46px（第 3 段回身回切，不是一路单调滑到底）');
  ok(P.protocol.hitEvents.length === 3 &&
     P.protocol.hitEvents.map(e => e.f).join('/') === c5.hits.join('/') &&
     P.protocol.cast.critOn === 3 && P.protocol.hitEvents[2].crit === true &&
     P.protocol.cast.forceCrit === true,
    'f' + c5.hits.join(' / f') + ' 三段各自结算，第 3 段回身斩 forceCrit 必暴');
  ok(s5b.blinking === true && s5b.heroAlpha < 0.5 &&
     s5b.ghosts.length === c5.ghostN && s5b.lines.length > 0 && !!s5b.chain,
    '每段瞬移窗口本体淡到 ' + s5b.heroAlpha.toFixed(2) + ' + ' + s5b.ghosts.length +
      ' 道水平残影 + 速度线 + 三段折线路径（iframe 0.22s 看得见）');
  ok(s5h.every(q => !!q.slash) && s5h.every(q => q.slash.y1 - q.slash.y0 > 8) &&
     s5h[2].slash.crit === true,
    '三段各有一道 54px 大弧形横斩，不是全场唯一一刀，也不是同一帧三道叠在一起');
  ok(s5h.every(q => q.twin === false && q.oneHand === true && q.flatSwing === false) &&
     P.heroKind === 'blade' && P.protocol.cast.plane === 'horizontal-line',
    '仍是单手一把刀、水平直线折返，不是贴地椭圆、不是竖直抡刀、不复用旋风斩旋身');
  ok(P.snapNew(c5.total).pos.x === s5h[2].pos.x &&
     P.snapNew(c5.hits[0]).popAge === -1 &&
     P.protocol.components.every(k => k.indexOf('gale') === 0),
    '收招站定在 +46px；关掉全局累计数字只留每段 -' + c5.perTick +
      '；组件名整招换新为 gale*，与旧版一刀流不混');

  /* ⑧-2 断筋（返修）：命中大「断」字 + 顿帧 + 冲击环 + 震屏后仰 + 数字，仍零血 */
  P.setClip('blade_6');
  const c6 = P.cfg, s6p = P.snapNew(c6.pick - 2), s6h = P.snapNew(c6.hit),
        s6s = P.snapNew(c6.hit + 8);
  ok(!!s6h.glyph && P.protocol.cast.breakGlyph === '断' &&
     P.protocol.hitEvents[0].glyph === '断' &&
     P.protocol.kind === 'tendon-break-glyph',
    '用户要的「断」字落进画面与协议：命中帧砸出一个大号判定字');
  ok(!!s6h.glyph && s6h.glyph.size === c6.glyphSize && s6h.glyph.a > 0.9 &&
     s6h.glyph.scale > 1 && !!s6s.glyph && s6s.glyph.a < s6h.glyph.a,
    '「断」字 ' + c6.glyphSize + 'px、实心描边 + 方框、带缩放回弹，随后渐淡而不是一闪就没');
  ok(c6.hold === 2 && P.protocol.cast.hitstop === 2 && s6h.frozen === true &&
     P.snapNew(c6.hit + 1).frozen === true && P.snapNew(c6.hit + 2).frozen === false &&
     P.snapNew(c6.hit).ang === P.snapNew(c6.hit + 1).ang &&
     P.snapNew(c6.hit).pos.x === P.snapNew(c6.hit + 1).pos.x,
    'f' + c6.hit + '~f' + (c6.hit + 1) + ' 恰好 2 帧顿帧，人与怪物同帧定住（旧版完全没有）');
  ok(!!s6h.impact && s6h.burst.length === 14 &&
     P.protocol.cast.impactRing === 'local-gray' &&
     P.protocol.cast.fullScreenFlash === false,
    '灰白大冲击环（52px）+ 14 道长迸裂线：有打击反馈但不做全屏白闪、不借血刃的红色液体');
  ok(c6.shake === 6 && P.protocol.cast.shake === 6 &&
     s6h.enemyTilt > 0.1 && P.protocol.cast.recoilTilt === true,
    '命中震屏（' + c6.shake + '）与怪物后仰 ' + s6h.enemyTilt.toFixed(2) + 'rad，旧版只有 1 帧微颤');
  ok(!!s6h.damageNum && s6h.damageNum.txt === '-108' && s6h.dmgShown === 108 &&
     s6h.popAge === -1,
    '金色 -108 伤害数字，且关掉全局累计数字避免同帧叠字');
  ok(!!s6p.pick && s6p.pick.len === 52 && !s6s.pick &&
     !!s6s.tendon && s6s.tendon.len === c6.tendonLen && s6s.tendon.gap > 0 &&
     s6s.rings.length === 3 && s6s.drags.length === 3,
    '招式身份不变：52px 大幅上挑、膝侧竖向断线两截错开、3 圈大灰环、3 道拖慢拖影');
  ok(s6s.drips === undefined && s6s.pool === undefined &&
     s6s.wound === undefined && s6s.mist === undefined && s6s.flash === 0 &&
     P.protocol.cast.bloodless === true,
    '仍然零血珠 / 零积血 / 零裂口 / 零全屏白闪，与血刃的红色液体语言彻底分开');
  let belowShoulder = true;
  for (let f = 0; f <= c6.total; f++) if (P.snapNew(f).ang < -0.8) belowShoulder = false;
  ok(belowShoulder, '断筋全程刀不过肩（与力劈双手举刀过顶相反）');
  ok(P.protocol.hitEvents[0].status.kind === 'slow' &&
     P.protocol.hitEvents[0].status.frames === c6.slowEnd - c6.hit,
    '协议把 slow 60% / 3s 写成命中后 ' + (c6.slowEnd - c6.hit) + ' 帧持续状态（打击感在前、状态在后）');

  /* ⑧-3 狂怒：无伤害招按机制放宽，不硬套判定帧 / 命中锚点 */
  P.setClip('blade_7');
  const c7 = P.cfg, origin7 = P.snapNew(0).pos.x;
  let hp7 = true, hit7 = false, still7 = true, dmg7 = false;
  for (let f = 0; f <= c7.total; f++){
    const q = P.snapNew(f);
    if (q.enemyHp !== 200) hp7 = false;
    if (q.hitDone) hit7 = true;
    if (q.pos.x !== origin7) still7 = false;
    if (typeof q.dmgShown === 'number') dmg7 = true;
  }
  ok(hp7 && !hit7 && !dmg7,
    '狂怒全 ' + (c7.total + 1) + ' 帧怪物血量恒 200、无 hitDone、无伤害数字（放宽生效）');
  ok(still7 && P.protocol.cast.trajectory === 'none' &&
     P.protocol.cast.damage === false && P.protocol.cast.anchor === null &&
     P.protocol.cast.hitFrame === null && P.protocol.hitEvents.length === 0,
    '0 位移 + 无命中锚点 + 无 hitEvents：按机制自行匹配，不硬塞一个假判定帧');
  ok(P.protocol.statusEvents.length === 1 &&
     P.protocol.statusEvents[0].f === c7.buffStart &&
     P.protocol.statusEvents[0].atkPct === 30 &&
     P.protocol.statusEvents[0].hurtPct === 15 &&
     P.protocol.statusEvents[0].dur === 10,
    'f' + c7.buffStart + ' buff 生效帧写进 statusEvents：攻 +30% / 伤 +15% / 10s');
  const s7a = P.snapNew(c7.buffStart - 6), s7b = P.snapNew(c7.buffStart + 9),
        s7hit = P.snapNew(c7.buffStart), s7c = P.snapNew(c7.total);
  ok(s7a.infuse > 0 && s7a.infuse < 1 && s7a.veins.length > 0 &&
     s7b.ringR > 0 && s7c.ringR > 0 && s7c.effected === true,
    '血气自刀尖倒灌回刀柄 → 红环张开 → 收尾红环不消失（常驻细描边，buff 10s 还没走完）');
  ok(s7hit.ringR > 0 && !!s7hit.burst && s7hit.burst.a > 0.9,
    'f' + c7.buffStart + ' 生效帧当帧就有红环 + 爆发亮环（不是半径 0 的空帧）');
  let horizontalHold = true;
  for (let f = 0; f <= c7.total; f++){
    if (Math.abs(P.snapNew(f).ang) > 0.35) horizontalHold = false;
  }
  ok(horizontalHold, '刀全程横于身前（|角度| ≤ 20°，不朝下插地、不穿身、不举过顶）');

  /* ⑧-4 血战八方（整招重做 + 放大）：贴地平面四残影 + 54px 大扇面 / 攻 60% / 2.0s / 防 +20% / 回主身 */
  P.setClip('blade_8');
  const c8 = P.cfg, o8 = P.snapNew(0).pos.x;
  const ec = P.protocol.echo;
  ok(P.protocol.kind === 'ground-plane-four-echo' &&
     ec.count === 4 && ec.atkInherit === 0.6 && ec.atkPct === 60 &&
     ec.durationFrames === 60 && ec.durationSec === 2 &&
     ec.defBonus === 0.2 && ec.defPct === 20 &&
     ec.returnTo === 'self' && ec.returnFrame === c8.returnEnd &&
     ec.plane === 'ground-parallel',
    '用户口径逐条写进协议：四周 4 残影 / 攻继承 60% / 持续 2.0s（60 帧）/ 防 +20% / 回到主身');
  ok(c8.echoEnd - c8.echoStart === 60 && c8.returnEnd > c8.echoEnd &&
     P.protocol.cast.plane === 'ground-plane-echo' &&
     P.protocol.cast.squash === 0.32 && P.protocol.cast.spin === false &&
     P.protocol.cast.displacement === 0 &&
     P.snapNew(50).flatSwing === true && P.snapNew(50).squash < 0.5,
    '贴地椭圆平面 fy 0.32（与地面平行，不是竖直立圆）：残影 / 刀光 / 护环全在同一平面，' +
      '主身站定 0 位移、不连续旋身');
  const e50 = P.snapNew(50).echoes;
  const spanX = Math.max.apply(null, e50.map(e => e.x)) - Math.min.apply(null, e50.map(e => e.x));
  const spanY = Math.max.apply(null, e50.map(e => e.y)) - Math.min.apply(null, e50.map(e => e.y));
  ok(e50.length === 4 && spanY / spanX < 0.4 &&
     e50.every(e => Math.abs(Math.hypot(e.x - 79, (e.y - 105) / c8.squash) - c8.radius) < 0.01) &&
     e50.filter(e => e.far).length === 2,
    '四个残影落在压扁椭圆（y/x 跨度 ' + (spanY / spanX).toFixed(2) +
      '）的四斜角上，远侧 2 个暗小 / 近侧 2 个亮大，不靠把手抬起来读层次');
  ok(c8.hits.length === 12 && P.protocol.hitEvents.length === 12 &&
     P.protocol.hitEvents.every(e => e.inherit === 0.6) &&
     P.snapNew(0).hitCount === 0 && P.snapNew(c8.lastHit).hitCount === 12 &&
     P.snapNew(c8.lastHit).enemyHp === 200 - c8.perTick * 12,
    '4 残影 × 3 波 = 12 段判定，每刀都带 60% 继承，逐段结算而不是第 0 帧打完');
  ok(P.snapNew(50).defRing !== null && P.snapNew(10).defRing === null &&
     P.snapNew(110).defRing === null &&
     P.protocol.statusEvents.length === 1 &&
     P.protocol.statusEvents[0].defPct === 20 &&
     P.protocol.statusEvents[0].frames === 60,
    '防 +20% 的贴地护环只在 2.0s 持续期出现，并写进 statusEvents（60 帧）');
  ok(P.snapNew(c8.echoEnd).echoes.length === 4 &&
     P.snapNew(c8.returnEnd).echoes.length === 0 &&
     P.snapNew(c8.returnEnd - 2).trails.length > 0 &&
     P.snapNew(c8.returnEnd + 1).trails.length === 0,
    'f' + c8.echoEnd + ' 攻击满 2s 后四残影沿椭圆半径收回主身（R→0），回收段有拖尾、合体后清空');
  let still8 = true, fanFree = true;
  for (let f = 0; f <= c8.total; f++){
    const q = P.snapNew(f);
    if (q.pos.x !== o8) still8 = false;
    if (q.spin !== false) still8 = false;
    if (q.fan || q.dirA !== undefined) fanFree = false;
  }
  ok(still8 && fanFree, '血战八方全 ' + (c8.total + 1) +
    ' 帧站定 0 位移，旧的「8 方位离散短扇形 / 角度跳变」已彻底作废');
  ok(names.blade_8.every(k => names.blade_4.indexOf(k) < 0) &&
     P.protocol.components.every(k => k.indexOf('echo') === 0) &&
     P.snapNew(60).vortex === undefined && P.snapNew(60).hands === undefined &&
     P.snapNew(60).blades === undefined,
    '组件名整招换成 echo*，与旋风斩的外圈刃 / 螺旋风纹 / 双手持握骨架零交集');
  ok(P.snapNew(c8.hits[0]).slashes.length > 0 &&
     P.snapNew(c8.hits[0]).slashes[0].fy === c8.squash &&
     P.snapNew(c8.hits[0]).popAge === -1,
    '刀光是 54px 贴地椭圆大扇面（y 乘 fy），关掉全局累计数字只留四个残影各自的 -' + c8.perTick);

  /* ⑧-5 动作幅度下限（2026-11-13 用户定案，后续每批沿用这把尺子）：
   * 「动作幅度太小根本看不出是技能」——位移 / 挥刀行程 / 刀光半径 / 特效覆盖都要够大。 */
  P.setClip('blade_5');
  const a5 = P.cfg, b5 = P.snapNew(a5.hit);
  ok(a5.blinkDist >= 44 && a5.slashR >= 50 && a5.slashArc >= 1.4 &&
     a5.ghostN >= 7 && !!b5.slash && b5.slash.r >= 50,
    '疾风步幅度达标：单段瞬移 ' + a5.blinkDist + 'px、大弧刀光半径 ' + a5.slashR +
      'px / 张角 ' + a5.slashArc + 'rad、' + a5.ghostN + ' 道放大残影');
  let swing5 = 0;
  for (let f = a5.seg0; f <= a5.hits[0] + 10; f++){
    swing5 = Math.max(swing5, Math.abs(P.snapNew(f).ang - P.snapNew(a5.seg0).ang));
  }
  ok(swing5 >= 1.6, '疾风步单段挥刀行程 ' + (swing5 * 180 / Math.PI).toFixed(0) +
    '° ≥ 90°，不是手腕抖一下');
  P.setClip('blade_6');
  const a6 = P.cfg, b6 = P.snapNew(a6.hit + 5);
  ok(a6.pickLen >= 45 && a6.dash >= 40 && a6.glyphSize >= 30 &&
     a6.impactMax >= 45 && a6.burstN >= 12 &&
     !!b6.impact && b6.impact.r >= 25,
    '断筋幅度达标：上挑刀光 ' + a6.pickLen + 'px、前冲 ' + Math.round(a6.dash / 2) +
      'px、「断」字 ' + a6.glyphSize + 'px、冲击环最大 ' + a6.impactMax + 'px');
  let swing6 = -Infinity, lo6 = Infinity;
  for (let f = 0; f <= a6.total; f++){
    const v = P.snapNew(f).ang; swing6 = Math.max(swing6, v); lo6 = Math.min(lo6, v);
  }
  ok(swing6 - lo6 >= 1.5, '断筋挥刀总行程 ' + ((swing6 - lo6) * 180 / Math.PI).toFixed(0) +
    '° ≥ 86°，一眼看出是挥了一刀而不是挂状态');
  P.setClip('blade_8');
  const a8 = P.cfg, e8 = P.snapNew(50);
  ok(a8.radius >= 60 && a8.arcR >= 50 && a8.defR >= 24 &&
     e8.echoes.length === 4 && e8.echoes.every(e => e.scale >= 1.15) &&
     !!e8.defRing && e8.defRing.r >= 24 &&
     P.snapNew(a8.hits[0]).slashes[0].r >= 50,
    '血战八方幅度达标：四残影椭圆 ' + a8.radius + 'px、放大 ' +
      e8.echoes[0].scale.toFixed(2) + ' 倍、大扇面 ' + a8.arcR +
      'px、护环 ' + a8.defR + 'px');

  /* ⑨ 第 4 批（本次送审）：枪族四招，统一「双手一杆枪 + 红缨」人设，
   * 但时间轴 / 判定结构 / 空间语言 / 组件名逐招独立，没有一招是另一招换皮。 */
  P.setBatch('b4');
  const s4ids = P.clips.slice();
  ok(s4ids.length === 4 && s4ids.join('/') === 'spear_1/spear_2/spear_3/spear_4',
    '第 4 批按 arts.js 原序取枪族前 4 招：' + s4ids.join(' / '));
  const d4 = s4ids.map(id => { P.setClip(id); return P.cfg.total / P.cfg.fps; });
  ok(d4.every(d => d >= 3 && d <= 5),
    '第 4 批四招演出时长 ' + d4.map(d => d.toFixed(2) + 's').join(' / ') + ' 全部落在 3~5s');
  const traj4 = [], kind4 = [], grip4 = {}, hero4 = {};
  s4ids.forEach(id => {
    P.setClip(id);
    traj4.push(P.protocol.cast.trajectory);
    kind4.push(P.protocol.kind);
    grip4[id] = P.snapNew(P.cfg.hit).grip;
    hero4[id] = P.heroKind;
  });
  ok(s4ids.every(id => grip4[id] === 'two-hand-one-spear' && hero4[id] === 'spear'),
    '四招统一双手一杆枪（drawHero 走 spear 分支：手 / 杆 / 缨 / 尖可见），不是刀的宽刃也不是剑的细直刃');
  ok(new Set(traj4).size === 4 && new Set(kind4).size === 4,
    '四招轨迹 / 协议 kind 各不相同：' + traj4.join(' / '));
  ok(new Set(s4ids.map(id => { P.setClip(id); return P.cfg.total; })).size === 4 &&
     new Set(s4ids.map(id => { P.setClip(id); return P.cfg.hit; })).size === 4,
    '四招总帧数 / 主判定帧两两不同，时间轴不是复制同一条');

  /* ⑨-1 贯甲刺：站定 0 位移、60px 水平直线、三点破甲依次结算、2 帧顿帧、枪身不压扁 */
  P.setClip('spear_1');
  const c1 = P.cfg, o1 = P.snapNew(0).pos.x;
  ok(Math.round(P.snapNew(c1.thrustEnd).pos.x - o1) === c1.pushPx &&
     Math.round(P.snapNew(c1.total).pos.x - o1) === 0 && c1.pushPx >= 18,
    '贯甲刺推杆时整个人前压 ' + c1.pushPx + 'px（f' + c1.thrustEnd +
    ' 到顶），收杆后回到原点 —— 动作幅度看得见，但仍然是推杆不是冲人');
  const q1h = P.snapNew(c1.hit), q1full = P.snapNew(c1.thrustEnd);
  ok(!!q1full.line && Math.abs(q1full.line.x1 - q1full.line.x0 - c1.len / 2) < 0.01 &&
     Math.abs(q1full.line.y - P.snapNew(c1.thrustStart).line.y) < 0.01,
    'f' + c1.thrustEnd + ' 枪尖沿水平直线推满 ' + Math.round(c1.len / 2) +
    'px（len 120 ÷ SCALE 2），y 恒定不抬不落');
  ok(q1h.dots.length === 3 && q1h.dots[0].f === 29 && q1h.dots[1].f === 33 && q1h.dots[2].f === 37 &&
     P.snapNew(28).litCount === 0 && P.snapNew(29).litCount === 1 &&
     P.snapNew(33).litCount === 2 && P.snapNew(37).litCount === 3,
    '沿途 3 个破甲点 f29 / f33 / f37 依次亮起，不是同帧一次全亮');
  ok(P.snapNew(28).enemyHp === 200 && P.snapNew(29).enemyHp === 155 &&
     P.snapNew(33).enemyHp === 110 && P.snapNew(37).enemyHp === 65 &&
     P.snapNew(37).dmgShown === 135 && P.protocol.hitEvents.length === 3,
    '三段逐段结算 45 → 90 → 135，各飘一次数字（不是第 0 帧一次打完）');
  const fz1 = [];
  for (let f = 0; f <= c1.total; f++) if (P.snapNew(f).frozen) fz1.push(f);
  ok(fz1.length === c1.hold && fz1[0] === c1.hit,
    'f' + c1.hit + '~f' + (c1.hit + c1.hold - 1) + ' 共 ' + c1.hold + ' 帧顿帧，其余帧不停');
  ok(q1h.plane === 'upright-shaft' && q1h.squash === undefined &&
     P.protocol.cast.plane === 'upright-shaft' && P.protocol.cast.pierceDef === 0.4 &&
     P.protocol.kind === 'pierce-line-thrust',
    '枪身是立体细杆不压扁（只有地面尘环贴地），协议写明 pierceDef 0.4 / horizontal-pierce-line');
  ok(P.snapNew(c1.thrustEnd).enemyKick > 0, '怪物沿枪线被击退（kb 10）');
  /* 2026-11-13 用户：光线太粗，要细 + 改红色，更有贯穿感 */
  ok(!!q1full.line && q1full.line.h <= 8 && q1full.line.h >= 5 &&
     q1full.line.c === '#ff4a34',
    '贯穿枪线是 ' + q1full.line.h + 'px 细红光线（' + q1full.line.c +
    '），不是原来 20px 的青白亮带');
  ok(P.snapNew(c1.thrustEnd + 6).line === null ||
     P.snapNew(c1.thrustEnd + 6).line.x1 > q1full.line.x1 - 1,
    '箭头钉在枪线末端（x1 处），推杆推到哪里箭头跟到哪里');


  /* ⑨-2 枪阵：三个离散落点左中右、末记由下反挑、三段结算、斜上击退 */
  P.setClip('spear_2');
  const c2 = P.cfg;
  ok(c2.hits.length === 3 && P.protocol.hitEvents.length === 3 &&
     P.protocol.hitEvents[2].uppercut === true && P.protocol.hitEvents[2].kb === 10 &&
     P.protocol.cast.hits === 3 && P.protocol.kind === 'three-stab-uppercut',
    '三连点刺 f' + c2.hits.join(' / f') + '，末记 uppercut / kbLast 10 写进协议');
  const stabX = c2.hits.map(h => P.snapNew(h).stabs[0].x);
  ok(stabX.length === 3 && stabX[0] < stabX[1] && stabX[1] < stabX[2] &&
     Math.abs(stabX[1] - stabX[0]) === c2.stabSpread &&
     Math.abs(stabX[2] - stabX[1]) === c2.stabSpread && c2.stabSpread >= 24,
    '三记枪尖落点依次在怪物左 / 中 / 右（' + stabX.join(' / ') + '），横移 ' +
    (c2.stabSpread * 2) + 'px，不是同一处放三遍');
  ok(P.snapNew(c2.hits[2]).stabs[0].last === true &&
     P.snapNew(c2.hits[2] + 7).ang < P.snapNew(c2.hits[2]).ang &&
     P.snapNew(c2.hits[2] + 7).lift > 0 &&
     P.snapNew(c2.hits[2] + 7).enemyTilt < 0 &&
     !!P.snapNew(c2.hits[2] + 7).kickArc,
    '末记由下往上反挑：枪角上翻 + 怪物后仰 + 斜上挑开（kbLast 10）');
  ok(P.snapNew(28).hitCount === 0 && P.snapNew(29).hitCount === 1 &&
     P.snapNew(47).hitCount === 2 && P.snapNew(65).hitCount === 3 &&
     P.snapNew(65).enemyHp === 200 - c2.perTick * 3,
    '三段逐段结算：f65 才到 ' + c2.perTick * 3 + '，不是第 0 帧一次打完');
  ok(P.snapNew(c2.hits[2]).tassels.length >= c2.tasselN &&
     P.protocol.cast.trajectory === 'left-mid-right-uppercut',
    '红缨甩出 ' + c2.tasselN + ' 道短残影，协议写明左中右 + 末记反挑');
  ok(!('line' in P.snapNew(c2.hit)) && !('dots' in P.snapNew(c2.hit)),
    '零复用贯甲刺：枪阵状态里没有贯穿枪线、没有破甲点');
  /* 2026-11-13 用户：三记都要「从后往前」的突刺；末记挑飞敌人 + 伤害 + 击退 */
  const w2a = P.snapNew(c2.hits[0] - c2.windFrames), w2b = P.snapNew(c2.hits[0]);
  ok(c2.pullBack >= 30 && w2a.stabs.length > 0 && w2b.stabs.length > 0 &&
     Math.round(w2b.stabs[0].x - w2a.stabs[0].x) === c2.pullBack &&
     w2a.stabs[0].reachP === 0 && w2b.stabs[0].reachP === 1,
    '三记都是「从后往前」：判定前 ' + c2.windFrames + ' 帧枪尖还在身后 ' +
    c2.pullBack + 'px，判定帧一瞬间推到落点（不是凭空亮一下）');
  const hx2 = P.snapNew(c2.hits[0] - 8).pos.x, hx2b = P.snapNew(c2.hits[0]).pos.x;
  ok(hx2b > hx2 + 10,
    '人物也跟着枪后坐 → 前送（' + Math.round(hx2) + ' → ' + Math.round(hx2b) +
    '），不是站着不动');
  const lift2 = P.snapNew(c2.hits[2] + 20);
  ok(lift2.enemyLift >= 34 && lift2.enemyKick >= 24 && lift2.enemyTilt <= -1.5 &&
     Math.round(P.snapNew(c2.hits[2] + 34).enemyLift) === 0,
    '末记把敌人整只挑离地面 ' + Math.round(lift2.enemyLift) + 'px、翻转 ' +
    Math.abs(lift2.enemyTilt).toFixed(1) + 'rad、击退 ' + Math.round(lift2.enemyKick) +
    'px，' + (c2.hits[2] + 34 - c2.hits[2]) + ' 帧后落地');
  /* 末记怪物被击退 24px 的同时人也整段追上去，否则枪尖竖在头顶、读成「人枪脱节」 */
  const fl2 = P.snapNew(c2.hits[2] + 20), o2 = P.snapNew(0).pos.x;
  const fl2end = P.snapNew(c2.hits[2] + 46).pos.x;
  ok(c2.followLunge >= 34 && fl2.pos.x - o2 >= c2.followLunge - 4 &&
     Math.abs(fl2.ang) <= 1.05 && Math.round(fl2end - o2) <= 4,
    '末记挑飞时人整段追压 ' + Math.round(fl2.pos.x - o2) + 'px、枪角 ' +
    Math.round(Math.abs(fl2.ang) * 57.3) + '°（不是竖在头顶戳空气），怪落地后退回原位');


  /* ⑨-3 回马枪：背身虚走半步 → 拧腰 180° → 反侧单发背袭 ×1.4，镜头不转 */
  P.setClip('spear_3');
  const c3 = P.cfg, o3 = P.snapNew(0).pos.x;
  ok(P.snapNew(0).facing === -1 && P.snapNew(c3.coil).facing === -1 &&
     P.snapNew(c3.turn - 1).facing === -1 && P.snapNew(c3.turn).facing === 1 &&
     P.snapNew(c3.hit).facing === 1,
    '开局背对怪物（facing -1），f' + c3.turn + ' 拧腰 180° 翻成 facing +1，镜头不转');
  ok(Math.round(P.snapNew(c3.halfStep).pos.x - o3) === -c3.halfStepPx &&
     Math.round(P.snapNew(c3.total).pos.x - o3) === 0,
    '朝「前」虚走半步 ' + c3.halfStepPx + 'px，回身后退回原点（骗步不是真位移）');
  ok(P.snapNew(0).trail.length === 0 && P.snapNew(c3.turn).trail.length >= c3.trailN,
    '金色回身拖尾只在拧腰段出现（' + c3.trailN + ' 段），方向靠人物 + 拖尾读出来');
  const ba = P.snapNew(c3.hit).backAnchor;
  ok(!!ba && ba.side === 'reverse-of-initial-facing' && ba.x > o1 + 40 &&
     P.protocol.cast.initialFacing === -1 && P.protocol.cast.camera === 'fixed' &&
     P.protocol.cast.trajectory === 'reverse-of-initial-facing',
    '判定锚点在初始朝向反侧（右侧怪物 x138），协议写明 initialFacing -1 / camera fixed');
  ok(P.protocol.hitEvents.length === 1 && P.protocol.hitEvents[0].backBonus === 1.4 &&
     P.snapNew(c3.hit).hudNote.indexOf('背袭 ×1.4') >= 0 &&
     P.snapNew(c3.hit + 5).enemyKick > 0,
    '全场唯一一记反刺：飘「背袭 ×1.4」、怪物沿反方向被顶退');
  ok(P.protocol.kind === 'reverse-backstab' && !('hits' in P.cfg),
    '回马枪是单发方向反转，不是枪阵那种三段判定');
  /* 2026-11-13 用户：枪出去的时候，人和枪一起往前位移一小段刺出 */
  const t3p = P.snapNew(c3.turn), h3p = P.snapNew(c3.hit);
  ok(c3.lunge >= 18 && Math.round(h3p.lunge) === c3.lunge &&
     h3p.pos.x - t3p.pos.x >= c3.lunge - c3.halfStepPx &&
     Math.round(P.snapNew(c3.hit + c3.lungeHold + c3.lungeBack).lunge) === 0,
    '回身反刺时人枪一起前送 ' + c3.lunge + 'px（f' + (c3.hit - c3.lungeWind) +
    ' 起送、f' + (c3.hit + c3.lungeHold) + ' 到位、再 ' + c3.lungeBack +
    ' 帧退回），不是站在原地伸手');


  /* ⑨-4 天狼啸月（2026-11-13 用户返修）：枪尖贴着地面画整圆 → 贴地月轮 →
   *      落枪引爆全周冲击波，把四周 3 名敌人一起冲开 + 造成伤害 + 恐惧。
   *      旧口径「仰天画纵向整圆 + 自上而下贯地」已被推翻，别再回来。 */
  P.setClip('spear_4');
  const c4 = P.cfg;
  ok(c4.arc === undefined && P.art.arc === 6.28 && c4.ringMax === 78 &&
     P.protocol.cast.arc === 6.28 && P.protocol.cast.reach === 90,
    '协议口径来自 arts.js：arc 6.28 / reach 90；抽检台把冲击波放大到 ' + c4.ringMax + 'px');

  /* ① 圆必须是贴地的：画圆轨迹每一个点的纵向偏移都不能超过 半径 × fy */
  const a4 = P.snapNew(c4.drawEnd).arc;
  let onGround = a4.length > 2, maxDy = 0;
  a4.forEach(function(p){
    const dy = Math.abs(p.y - c4.cy);
    if (dy > c4.moonR * c4.squash + 1.5) onGround = false;
    if (dy > maxDy) maxDy = dy;
  });
  ok(onGround && a4.length >= c4.arcN && c4.squash === 0.32 &&
     P.protocol.cast.plane === 'ground-parallel' && P.protocol.cast.squash === 0.32,
    '圆是贴着地面画的：' + a4.length + ' 个点全部落在 fy 0.32 的椭圆上（纵向最大 ' +
    maxDy.toFixed(1) + 'px = 半径 ' + c4.moonR + ' × 0.32），不是悬在头顶的竖直圆');

  /* ② 月轮本体也是贴地椭圆 */
  const m4 = P.snapNew(c4.moonEnd).moon;
  ok(!!m4 && m4.rx === c4.moonR && Math.abs(m4.ry - m4.rx * c4.squash) < 0.01,
    '月轮本体是贴地椭圆：rx ' + (m4 ? m4.rx : '?') + 'px / ry ' +
    (m4 ? m4.ry.toFixed(1) : '?') + 'px（= rx × 0.32）');

  /* ③ 冲击波扫到才推：判定当帧还没动，20 帧后全部被冲开 + 受伤 + 恐惧 */
  const e4a = P.snapNew(c4.hit + 1), e4b = P.snapNew(c4.hit + 20);
  ok(e4a.foes.length === 3 && e4a.foes.every(function(f){ return f.pushed === 0; }) &&
     e4b.foes.length === 3 &&
     e4b.foes.every(function(f){ return f.pushed >= Math.round(c4.pushDist * 0.85); }) &&
     e4b.foes.every(function(f){ return f.dmg === 198 && f.fear >= 0.9; }),
    '冲击波扫到才推：f' + (c4.hit + 1) + ' 三名敌人还没动，f' + (c4.hit + 20) +
    ' 全部被冲开 ' + Math.min.apply(null, e4b.foes.map(function(f){ return f.pushed; })) +
    '~' + Math.max.apply(null, e4b.foes.map(function(f){ return f.pushed; })) +
    'px（近满远衰）、各 -198、恐惧满值');

  /* ④ 一次落枪结算 4 个目标 */
  ok(P.protocol.hitEvents.length === 4 &&
     P.protocol.hitEvents[0].target === 'main' && P.protocol.hitEvents[0].mul === 33 &&
     P.protocol.hitEvents.slice(1).every(function(h){ return h.dmg === 198 && h.fear === true; }) &&
     P.protocol.kind === 'ground-moon-pulse',
    '一次落枪结算 4 个目标：主目标 ×33 + 三个周围敌人各 -198（全部带恐惧）');

  ok(P.protocol.cast.foeN === 3 && P.protocol.cast.pushDist === 34 &&
     P.protocol.cast.fear.tag === '惧' && P.protocol.cast.fear.frames === c4.fearEnd - c4.hit,
    '协议口径：冲开 3 名敌人 / ' + P.protocol.cast.pushDist + 'px / 恐惧 ' +
    P.protocol.cast.fear.sec + 's（头顶「惧」+ 发抖 + 后仰）');

  let noFlash4 = true, glowSeen4 = false;
  for (let f = 0; f <= c4.total; f++){
    const q = P.snapNew(f);
    if (q.flash !== 0) noFlash4 = false;
    if (q.glow > 0) glowSeen4 = true;
  }
  ok(noFlash4 && glowSeen4 && P.protocol.cast.fullScreenFlash === false,
    '全 ' + (c4.total + 1) + ' 帧 flash 恒 0，只有贴地月华（不做全屏白闪）');

  const fz4 = [];
  for (let f = 0; f <= c4.total; f++) if (P.snapNew(f).frozen) fz4.push(f);
  ok(fz4.length === c4.hold && fz4[0] === c4.hit,
    'f' + c4.hit + '~f' + (c4.hit + c4.hold - 1) + ' 共 ' + c4.hold + ' 帧顿帧');

  const o4 = P.snapNew(0).pos.x;
  let still4 = true;
  for (let f = 0; f <= c4.total; f++) if (P.snapNew(f).pos.x !== o4) still4 = false;
  ok(still4 && P.protocol.cast.displacement === 0,
    '全招 ' + (c4.total + 1) + ' 帧站定 0 位移（只旋身画圆，不走位）');

  /* 四招互不复制的总证据：判定结构、持械人设、平面口径 */
  ok(P.heroKind === 'spear' && c1.pierceN === 3 && c2.hits.length === 3 &&
     c3.turn === 40 && c4.moonR === 46 && c4.squash === 0.32,
    '四招骨架互不相同：三点破甲 / 三段离散点刺 / 转身单发 / 贴地月轮 + 冲击波冲开四周');

  /* ⑨-5 第 4 批动作幅度下限（沿用 ⑧-5 的尺子；2026-11-13 用户
   * 「按照我刚才说的技能范围、效果要更明显，更大」——枪族四招整体放大后再卡一遍） */
  P.setClip('spear_1');
  const A1 = P.cfg, S1 = P.snapNew(A1.hit + 5);
  ok(A1.len / 2 >= 95 && A1.spearLen >= 60 && A1.pushPx >= 18 &&
     !!S1.burst && S1.burst.r >= 20 && S1.rays.length >= 10 && S1.dots[0].r >= 10,
    '贯甲刺幅度达标：枪线 ' + (A1.len / 2) + 'px、枪身 ' + A1.spearLen +
    'px、前压 ' + A1.pushPx + 'px、贯穿爆点 ' + Math.round(S1.burst.r) +
    'px + ' + S1.rays.length + ' 条放射线、破甲点 ' + S1.dots[0].r.toFixed(1) + 'px');
  P.setClip('spear_2');
  const A2 = P.cfg, S2 = P.snapNew(A2.hits[2] + 8), S2a = P.snapNew(A2.hits[2] + 16);
  ok(A2.stabSpread >= 24 && A2.arcR >= 50 && A2.tipR >= 20 &&
     !!S2a.upArc && Math.abs(S2a.upArc.a1 - S2a.upArc.a0) >= 2.0 && S2.sparks.length >= 9,
    '枪阵幅度达标：落点横移 ' + (A2.stabSpread * 2) + 'px、末记金弧 ' + A2.arcR +
    'px / ' + (Math.abs(S2a.upArc.a1 - S2a.upArc.a0) * 180 / Math.PI).toFixed(0) +
    '°、' + S2.sparks.length + ' 条火花');
  P.setClip('spear_3');
  const A3 = P.cfg, S3t = P.snapNew(A3.turn - 4), S3h = P.snapNew(A3.hit + 6);
  ok(A3.halfStepPx >= 14 && A3.trailN >= 14 && A3.arcR >= 40 &&
     S3t.turnArc.length >= 10 && !!S3h.burst && S3h.burst.r >= 20 && S3h.rays.length >= 10,
    '回马枪幅度达标：虚走 ' + A3.halfStepPx + 'px、' + A3.trailN +
    ' 段金尾、转身金弧 ' + A3.arcR + 'px（' + S3t.turnArc.length +
    ' 点）、命中爆点 ' + Math.round(S3h.burst.r) + 'px');
  P.setClip('spear_4');
  const A4 = P.cfg, S4 = P.snapNew(A4.hit + 20);
  ok(A4.moonR >= 40 && A4.ringMax >= 74 && A4.arcN >= 48 && A4.pushDist >= 30 &&
     S4.cracks.length >= 14 && S4.ringR >= 74 && S4.kbWave.length >= 8 &&
     S4.moonHalo.length === 3 &&
     S4.foes.every(function(f){ return f.pushed >= 28; }),
    '天狼啸月幅度达标：贴地月轮 rx ' + A4.moonR + 'px（3 道月晕）、冲击波 ' +
    A4.ringMax + 'px、' + S4.cracks.length + ' 条地裂、' + S4.kbWave.length +
    ' 波外扩、3 敌被冲开 ' + Math.min.apply(null, S4.foes.map(function(f){ return f.pushed; })) +
    '~' + Math.max.apply(null, S4.foes.map(function(f){ return f.pushed; })) + 'px');

  /* ⑩ 第 5 批（本次送审）：枪族后四招 —— 位移 / 持续区 / 增益 / 单段上撩。
   * 四招机制彼此不相邻（走 / 钉 / 挂 / 撩），演出骨架也各自独立，没有一招是另一招换皮。 */
  P.setBatch('b5');
  const s5ids = P.clips.slice();
  ok(s5ids.length === 4 && s5ids.join('/') === 'spear_5/spear_6/spear_7/spear_8',
    '第 5 批按 arts.js 原序取枪族后 4 招：' + s5ids.join(' / '));
  const d5 = s5ids.map(id => { P.setClip(id); return P.cfg.total / P.cfg.fps; });
  ok(d5.every(d => d >= 3 && d <= 5),
    '第 5 批四招演出时长 ' + d5.map(d => d.toFixed(2) + 's').join(' / ') + ' 全部落在 3~5s');
  const traj5 = [], kind5 = [], grip5 = {}, hero5 = {}, disp5 = {};
  s5ids.forEach(id => {
    P.setClip(id);
    traj5.push(P.protocol.cast.trajectory);
    kind5.push(P.protocol.kind);
    grip5[id] = P.snapNew(P.cfg.hit).grip;
    hero5[id] = P.heroKind;
    disp5[id] = P.protocol.cast.displacement || { dx: 0, dy: 0, dist: 0, returnsToOrigin: true };
  });
  ok(s5ids.every(id => grip5[id] === 'two-hand-one-spear' && hero5[id] === 'spear'),
    '四招统一双手一杆枪（枪身不压扁，手 / 杆 / 缨 / 尖都看得见），不是刀的宽刃也不是剑的细直刃');
  ok(new Set(traj5).size === 4 && new Set(kind5).size === 4,
    '四招轨迹 / 协议 kind 各不相同：' + traj5.join(' / '));
  ok(new Set(s5ids.map(id => { P.setClip(id); return P.cfg.total; })).size === 4 &&
     new Set(s5ids.map(id => { P.setClip(id); return P.cfg.hit; })).size === 4,
    '四招总帧数 / 主判定帧两两不同，时间轴不是复制同一条');

  /* ⑩-1 游龙步：唯一的斜向位移招 —— 位移要读得出来，且不许回位 */
  P.setClip('spear_5');
  const E5 = P.cfg, S5o = P.snapNew(0), S5s = P.snapNew(E5.slideEnd), S5e = P.snapNew(E5.total);
  const s5dist = Math.hypot(S5s.slideDx, S5s.slideDy);
  ok(E5.dx >= 30 && E5.dy >= 12 && s5dist >= 34 &&
     Math.abs((S5s.pos.x - S5o.pos.x) - E5.dx) < 0.6 &&
     Math.abs((S5s.pos.y - S5o.pos.y) - E5.dy) < 0.6 &&
     Math.abs(S5e.pos.x - S5s.pos.x) < 0.6 && Math.abs(S5e.pos.y - S5s.pos.y) < 0.6 &&
     disp5.spear_5.returnsToOrigin === false,
    '游龙步是斜向位移：x +' + E5.dx + ' / y +' + E5.dy + 'px（合成 ' +
    Math.round(s5dist) + 'px），滑到位后停在原地不回位');
  ok(!!S5s.drag && S5s.drag.x1 - S5s.drag.x0 >= 40 && S5s.drag.y1 - S5s.drag.y0 >= 8 &&
     S5s.ghosts.length === E5.trailN && S5s.ghosts.length >= 4 &&
     S5s.dust.length === E5.dustN && S5s.dust.length >= 7,
    '地面拖痕斜着走（dx ' + Math.round(S5s.drag.x1 - S5s.drag.x0) + ' / dy ' +
    Math.round(S5s.drag.y1 - S5s.drag.y0) + 'px，斜率就是位移方向）+ ' +
    S5s.ghosts.length + ' 段侧向残影 + ' + S5s.dust.length + ' 团刮起的土');
  /* 拖痕终点必须落在枪尖上 —— 踩过坑：按「走了多远 + 15」估，枪尖在 (159,159)、
   * 拖痕停在 (129,123)，画面读成两条各走各的线。 */
  const tip5x = S5s.pos.x + 3 + S5s.pose.lean + Math.cos(S5s.ang) * S5s.spearLen;
  const tip5y = S5s.pos.y - 22 + S5s.pose.crouch + Math.sin(S5s.ang) * S5s.spearLen;
  ok(!!S5s.drag && Math.abs(S5s.drag.x1 - tip5x) < 1 && Math.abs(S5s.drag.y1 - tip5y) < 1,
    '拖痕终点就是枪尖（' + tip5x.toFixed(1) + ',' + tip5y.toFixed(1) + '），' +
    '不是按「人走了多远 + 15」估出来的第二条线');
  ok(S5s.ang >= 0.80 && S5s.ang <= 1.10,
    '滑行段枪尖压在土里（枪角 ' + (S5s.ang * 57.3).toFixed(0) + '°，几乎垂直向下），不是端着枪平移');

  /* ⑩-2 定军：持续区招 —— 圈要铺满、要真的分段结算、要真的减速 */
  P.setClip('spear_6');
  const E6 = P.cfg, S6p = P.snapNew(E6.press + 6), S6e = P.snapNew(E6.pull - 1);
  ok(E6.radius >= 56 && E6.squash > 0.28 && E6.squash < 0.36 &&
     Math.abs(S6p.zoneR - E6.radius) < 1.2 &&
     S6p.mud.length === 3 && S6p.cracks.length === E6.crackN && E6.crackN >= 10,
    '定军压制圈半径 ' + E6.radius + 'px（贴地 fy ' + E6.squash + ' 压扁椭圆）+ 3 层泥沼 + ' +
    S6p.cracks.length + ' 条地裂');
  ok(S6e.ticks.length === E6.ticks && E6.ticks >= 4 && E6.tickGap >= 12 &&
     S6e.dmgShown === E6.ticks * E6.tickDmg && S6e.inZone === true && S6e.slowTag === 1,
    '持续结算分 ' + E6.ticks + ' 次（每 ' + E6.tickGap + ' 帧 -' + E6.tickDmg +
    '，合计 -' + (E6.ticks * E6.tickDmg) + '），圈内减速 50% 挂「缓」');
  ok(P.snapNew(0).pos.x === S6e.pos.x && P.snapNew(E6.total).pos.x === S6e.pos.x,
    '定军全程 0 位移：枪钉在地上、圈不跟人走');
  /* 枪尖必须落在圈里 —— 这一条是踩过坑加的：枪握在柄尾，枪角越陡、枪尖越往下掉，
   * 压到 1.20（近垂直）时枪尖掉到圈外 100px，画面读成「圈和枪各画各的」。 */
  const S6t = P.snapNew(E6.press + 10);
  const hx6 = S6t.pos.x + 3 + S6t.pose.lean, hy6 = S6t.pos.y - 22 + S6t.pose.crouch;
  const tip6x = hx6 + Math.cos(S6t.ang) * S6t.spearLen;
  const tip6y = hy6 + Math.sin(S6t.ang) * S6t.spearLen;
  const ell6 = Math.pow((tip6x - E6.cx) / E6.radius, 2) +
    Math.pow((tip6y - E6.cy) / (E6.radius * E6.squash), 2);
  ok(ell6 <= 0.85,
    '枪尖插地点落在压制圈内（圈心 ' + E6.cx + ',' + E6.cy + ' / 枪尖 ' +
    tip6x.toFixed(1) + ',' + tip6y.toFixed(1) + ' / 椭圆归一化距离² ' +
    ell6.toFixed(2) + ' ≤ 0.85），不是圈在怪物脚下、枪尖掉到圈外 100px');

  /* ⑩-3 枪势：增益招 —— 无伤害走 statusEvents，气的推进必须是单向前推 */
  P.setClip('spear_7');
  const E7 = P.cfg, pr7 = P.protocol;
  const S7a = P.snapNew(E7.fillStart), S7m = P.snapNew((E7.fillStart + E7.fillEnd) / 2),
        S7b = P.snapNew(E7.fillEnd), S7c = P.snapNew(E7.fillEnd + 8);
  ok(pr7.cast.damage === false && pr7.hitEvents.length === 0 &&
     pr7.statusEvents.length === 1 && pr7.statusEvents[0].kind === 'buff',
    '枪势无伤害：hitEvents 空 + statusEvents 挂 1 条 buff（' +
    pr7.statusEvents[0].dur + 's / 射程 +' + pr7.statusEvents[0].reachPct +
    '% / 多穿 ' + pr7.statusEvents[0].pierce + ' 人）');
  ok(S7a.qiP < 0.05 && Math.abs(S7m.qiP - 0.5) < 0.06 && S7b.qiP > 0.95 &&
     S7a.tipGlow === 0 && S7b.tipGlow > 0.9 &&
     !!S7c.reachGhost && Math.abs(S7c.reachGhost.len - (E7.reachBuff - E7.reachBase)) < 1,
    '气沿杆单向前推：f' + E7.fillStart + ' 起 → f' + E7.fillEnd + ' 贯到枪尖（' +
    Math.round(S7m.qiP * 100) + '% 中点），枪尖亮起后才多探出 ' +
    Math.round(S7c.reachGhost.len) + 'px 射程虚影');
  ok(P.snapNew(0).pos.x === P.snapNew(E7.total).pos.x,
    '枪势全程 0 位移（增益招站定，不靠走位）');

  /* ⑩-4 挑飞：整招一记 —— 枪角要跨 120°、敌人要真的离地 55px */
  P.setClip('spear_8');
  const E8 = P.cfg;
  const S8d = P.snapNew(E8.dragEnd), S8h = P.snapNew(E8.hit),
        S8a = P.snapNew(E8.hit + 20), S8l = P.snapNew(E8.land + 6);
  const span8 = S8d.ang - S8h.ang;
  ok(span8 >= 2.0 && S8d.ang > 0.6 && S8h.ang < -1.0,
    '挑飞枪角由下往上跨 ' + (span8 * 57.3).toFixed(0) + '°（' +
    (S8d.ang * 57.3).toFixed(0) + '° 戳地 → ' + (S8h.ang * 57.3).toFixed(0) + '° 斜上）');
  ok(Math.abs(S8a.enemyLift - E8.liftMax) < 1.5 && E8.liftMax >= 50 &&
     Math.abs(S8a.enemyTilt) >= 1.5 &&
     S8h.liftArc !== null && S8h.liftArc !== undefined &&
     Math.abs(S8h.liftArc.a1 - S8h.ang) < 0.05,
    '敌人被撩离地面 ' + Math.round(S8a.enemyLift) + 'px + 翻转 ' +
    Math.abs(S8a.enemyTilt).toFixed(2) + 'rad，上撩金弧终点角绑当前枪角（不是画死的弧）');
  ok(Math.abs((S8h.pos.x - P.snapNew(0).pos.x) - E8.lunge) < 1.5 &&
     Math.abs(S8l.pos.x - P.snapNew(0).pos.x) < 1.5 && E8.lunge >= 12,
    '撩起时人跟着前压 ' + E8.lunge + 'px（人枪不脱节），敌人落地后退回原位');

  /* ⑩-5 第 5 批动作幅度下限（沿用 ⑧-5 / ⑨-5 的尺子，2026-11-13 用户
   * 「动作幅度太小了，根本看不出来是技能」——四招都不许交「几条细线 + 数字」） */
  P.setClip('spear_5');
  const A5 = P.cfg, G5 = P.snapNew(A5.slideEnd);
  ok(Math.hypot(A5.dx, A5.dy) >= 34 && G5.ghosts.length >= 4 && A5.spearLen >= 58 &&
     (G5.drag ? Math.hypot(G5.drag.x1 - G5.drag.x0, G5.drag.y1 - G5.drag.y0) : 0) >= 42,
    '游龙步幅度达标：合成位移 ' + Math.round(Math.hypot(A5.dx, A5.dy)) + 'px、拖痕 ' +
    (G5.drag ? Math.round(Math.hypot(G5.drag.x1 - G5.drag.x0, G5.drag.y1 - G5.drag.y0)) : 0) +
    'px、枪身 ' + A5.spearLen + 'px、' + G5.ghosts.length + ' 段残影');
  P.setClip('spear_6');
  const A6 = P.cfg, G6 = P.snapNew(A6.press + 10);
  ok(A6.radius >= 56 && G6.cracks.length >= 10 && G6.mud.length === 3 &&
     A6.spearLen >= 46 && G6.zoneA > 0.9,
    '定军幅度达标：压制圈 ' + A6.radius + 'px、' + G6.cracks.length + ' 条地裂、' +
    G6.mud.length + ' 层泥沼、枪身 ' + A6.spearLen + 'px');
  P.setClip('spear_7');
  const A7 = P.cfg, G7 = P.snapNew(A7.fillEnd);
  ok(A7.spearLen >= 60 && Math.abs((A7.reachBuff - A7.reachBase) - 18) < 0.5 &&
     G7.tipGlow > 0.9 && G7.qiA > 0.9,
    '枪势幅度达标：气线贯满 ' + A7.spearLen + 'px 枪身、射程虚影 +' +
    (A7.reachBuff - A7.reachBase) + 'px、枪尖亮点满亮');
  P.setClip('spear_8');
  const A8 = P.cfg, G8 = P.snapNew(A8.land + 6);
  ok(A8.liftMax >= 50 && A8.tiltMax >= 1.7 && A8.spearLen >= 62 &&
     G8.landDust.length >= 7 &&
     Math.abs(G8.enemyTilt) >= 1.5,
    '挑飞幅度达标：敌人离地 ' + A8.liftMax + 'px、翻转 ' + A8.tiltMax +
    'rad、枪身 ' + A8.spearLen + 'px、落地 ' + G8.landDust.length + ' 团扬尘');

  /* ⑪ 协议面板中文化（2026-11-13 用户「能不能输出中文？」）
   * 尺子：20 招的 protocol 里，除 override 子树（导出契约，键名必须保留英文）
   * 和招式 id / 文件路径之外，每一个键都要有中文标签、每一个字符串取值都要有中文映射；
   * 渲染出来的面板正文里不许再出现 true / false / null。 */
  {
    const M = window.__protoMap;
    const missKey = {}, missVal = {}, boolLeft = [];
    const ID_RE = /^[a-z]+_[0-9]+$/;          /* sword_1 这类招式 id，原样保留 */
    const PATH_RE = /^dawn-s1\//;             /* 数据来源路径，原样保留 */
    const CN_RE = /[\u4e00-\u9fa5]/;          /* 本来就是中文的说明 / 锚点，不用再映射 */
    const NUM_RE = /^-?[\d.]+$/;              /* 纯数字字符串，不用映射 */

    P.allClips.forEach(id => {
      P.setClip(id);
      const p = P.protocol;
      (function walk(o, path) {
        Object.keys(o).forEach(k => {
          if (path === 'override') return;
          const full = path ? path + '.' + k : k;
          if (M.P[full] === undefined && M.L[k] === undefined) {
            (missKey[k] = missKey[k] || []).push(id);
          }
          const v = o[k];
          if (v && typeof v === 'object' && !Array.isArray(v)) { walk(v, full); return; }
          if (Array.isArray(v)) return;
          if (typeof v === 'string' && M.V[v] === undefined &&
              !ID_RE.test(v) && !PATH_RE.test(v) && !CN_RE.test(v) && !NUM_RE.test(v)) {
            (missVal[v] = missVal[v] || []).push(id + '.' + k);
          }
        });
      })(p, '');

      /* 面板正文不许出现裸 true / false / null */
      const txt = document.getElementById('proto').innerText;
      const body = txt.split('原始 JSON')[0];       /* 原始 JSON 是技术导出，允许英文 */
      ['true', 'false', 'null'].forEach(w => {
        if (new RegExp('\\b' + w + '\\b').test(body)) boolLeft.push(id + ':' + w);
      });
    });

    const mk = Object.keys(missKey), mv = Object.keys(missVal);
    ok(mk.length === 0,
      '协议面板 20 招的字段名全部有中文标签' +
      (mk.length ? '（缺：' + mk.slice(0, 6).join(' / ') + '）' : '（' + P.allClips.length + ' 招零缺漏）'));
    ok(mv.length === 0,
      '协议面板 20 招的枚举取值全部有中文映射' +
      (mv.length ? '（缺：' + mv.slice(0, 6).join(' / ') + '）' : '（招式 id / 文件路径按契约保留原样）'));
    ok(boolLeft.length === 0,
      '布尔值与空值渲染成中文（是 / 否 / —（无）），面板正文不再出现 true / false / null' +
      (boolLeft.length ? '（残留：' + boolLeft.slice(0, 6).join(' / ') + '）' : ''));
    ok(document.getElementById('progBadge').innerText.indexOf('/ 80') > 0,
      '页头进度徽章按 BATCHES 实时算：' + document.getElementById('progBadge').innerText);
  }

  /* 复位到本次送审批次的第一招判定帧 */
  P.setBatch('b5');
  P.setClip('spear_5');
  return { ok: C.every(x => x.indexOf('PASS ') === 0), checks: C };
})()
