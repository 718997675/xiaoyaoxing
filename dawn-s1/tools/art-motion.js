/* art-motion-preview.html 的逐招演出自检。
 * 跑法：env PAGE=art-motion-preview.html node tools/run.js eval tools/art-motion.js
 * 口径（2026-11-12 用户定案）：80 招全部要做，4 个一批送审；不做机制归类、不写通用包、不复制演出。
 * 覆盖：批次结构 / 12 招组件名全表零重名 / 全帧纯函数 / 判定帧锚点 / 组件开关 / 覆盖表协议
 *      + 第 1 批 / 第 2 批 / 第 3 批各四招专属断言。
 * 第 3 批按用户口径放宽：狂怒是无伤害增益，用 statusEvents 代替 hitEvents，不硬套判定帧。
 * 注意：只验「画面状态是帧号纯函数」，不改游戏本体，也不写覆盖表。 */
(() => {
  const P = window.__preview, C = [];
  const ok = (b, m) => C.push((b ? 'PASS ' : 'FAIL ') + m);
  const idsAll = P.allClips;

  /* ⓪ 批次结构：三个批次各 4 招，当前停在第 3 批 */
  ok(P.batches.length === 3 && P.batches[0] === 'b1' &&
     P.batches[1] === 'b2' && P.batches[2] === 'b3',
    '三个批次 b1 / b2 / b3（打开时停在 ' + P.batch + '）');
  P.setBatch('b1');
  ok(P.batch === 'b1' && P.clips.length === 4 && P.clips[0] === 'sword_1',
    '切到第 1 批：' + P.clips.join(' / '));
  P.setBatch('b2');
  ok(P.batch === 'b2' && P.clips.length === 4 && P.clips[0] === 'blade_1',
    '切到第 2 批：' + P.clips.join(' / '));
  P.setBatch('b3');
  ok(P.batch === 'b3' && P.clips.length === 4 && P.clips[0] === 'blade_5',
    '切到第 3 批：' + P.clips.join(' / '));
  ok(idsAll.length === 12, '已逐招做完 12 / 80：' + idsAll.join(' / '));

  /* ① 全 12 招组件名两两零交集 —— 直接证伪「复制效应」 */
  const names = {};
  idsAll.forEach(id => { P.setClip(id); names[id] = Object.keys(P.fx); });
  let overlap = [];
  for (let i = 0; i < idsAll.length; i++) for (let j = i + 1; j < idsAll.length; j++) {
    const dup = names[idsAll[i]].filter(k => names[idsAll[j]].indexOf(k) >= 0);
    if (dup.length) overlap.push(idsAll[i] + '∩' + idsAll[j] + ':' + dup.join(','));
  }
  ok(overlap.length === 0, '12 招组件名全表零重名（共 ' +
    idsAll.reduce((n, id) => n + names[id].length, 0) + ' 个）' +
    (overlap.length ? ' | ' + overlap.join(' ') : ''));

  /* ② 全 12 招全帧纯函数不抛异常、无 NaN */
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
  ok(protoBad.length === 0, '12 招 override 字段均在 OVERRIDE_SAFE 白名单内、无通用包字段' +
    (protoBad.length ? ' | ' + protoBad.join(', ') : ''));
  ok(compBad.length === 0, '12 招协议都带 components / 命中或状态事件清单（狂怒走 statusEvents）' +
    (compBad.length ? ' | ' + compBad.join(', ') : ''));
  ok(new Set(kinds).size === 12, '12 招协议 kind 各不相同：' + kinds.join(' / '));
  ok(noteBad.length === 0, '第 2 / 3 批 8 招协议都写明「逐招独立设计」' +
    (noteBad.length ? ' | ' + noteBad.join(', ') : ''));
  ok(new Set(totals).size >= 9 && new Set(hits).size >= 9,
    '12 招时间轴长度 / 判定帧不是复制同一条：' + totals.join(',') + ' | f' + hits.join(',f'));

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


  /* ⑧ 第 3 批（本次送审）：四招各自独立，且遵守「双手刀 / 单手刀 + 3~5s」口径 */
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

  /* ⑧-1 疾风步：走 + 闪结合、单手、落点唯一一刀必暴 */
  P.setClip('blade_5');
  const c5 = P.cfg;
  const s50 = P.snapNew(0), s5w = P.snapNew(c5.stride),
        s5w0 = P.snapNew(c5.stride - 1),   /* 拖刀疾走段最后一帧，划痕还在 */
        s5b = P.snapNew(c5.blinkStart + 6), s5h = P.snapNew(c5.hit);
  ok(s5w.pos.x - s50.pos.x > 0 && s5h.pos.x - s5w.pos.x > 0 &&
     Math.round(s5h.pos.x - s50.pos.x) === 26,
    '疾风步「走 12px + 化影 14px」两段接在同一条直线上（共 ' +
      Math.round(s5h.pos.x - s50.pos.x) + 'px，不是纯瞬移也不是纯走）');
  ok(s5b.blinking === true && s5b.heroAlpha < 0.5 &&
     s5b.ghosts.length === c5.ghostN && s5b.lines.length > 0 && !!s5w0.score,
    '化影段本体淡到 ' + s5b.heroAlpha.toFixed(2) + ' + ' + s5b.ghosts.length +
      ' 道水平残影 + 速度线；疾走段刀尖在地上拖出划痕（iframe 0.22s 看得见）');
  ok(!s5h.blinking && !!s5h.crit && P.protocol.hitEvents.length === 1 &&
     P.protocol.hitEvents[0].crit === true && P.protocol.cast.forceCrit === true &&
     s5h.twin === false && s5h.oneHand === true,
    'f' + c5.hit + ' 落点实体化：单手、全场唯一一道细长斜刀光、forceCrit 必暴，无连段无旋身');
  ok(s5h.crit.y1 - s5h.crit.y0 > 8,
    '落点刀光是斜线（落差 ' + Math.round(s5h.crit.y1 - s5h.crit.y0) +
      'px），不与横持的刀身读成两根平行白条');
  ok(P.protocol.kind === 'step-blink-strike' &&
     P.protocol.cast.trajectory === 'walk-blink-land' &&
     P.protocol.cast.plane === 'horizontal-line',
    '协议写明走→闪→落点直线，不是贴地椭圆、不是竖直抡刀');
  let mono5 = true, px5 = -Infinity;
  for (let f = 0; f <= c5.total; f++){
    const x = P.snapNew(f).pos.x;
    if (x < px5 - 1e-9){ mono5 = false; break; }
    px5 = x;
  }
  ok(mono5 && P.snapNew(c5.total).pos.x === s5h.pos.x,
    '疾风步推进单调、' + (c5.hit) + ' 帧后站定不再移动（与旋风斩的边走边转分开）');

  /* ⑧-2 断筋：9px 短挑 + 竖向断线 + 拖慢灰环，全场零血 */
  P.setClip('blade_6');
  const c6 = P.cfg, s6p = P.snapNew(c6.pick - 2), s6s = P.snapNew(c6.hit + 8);
  ok(!!s6p.pick && s6p.pick.len === 9 && !s6s.pick,
    '断筋唯一的刀光是 9px 极短反挑，落地后不再有第二道');
  ok(!!s6s.tendon && s6s.tendon.len === c6.tendonLen && s6s.tendon.gap > 0 &&
     s6s.rings.length === 3 && s6s.drags.length === 3,
    '膝侧竖向断线两截错开 + 脚下 3 圈灰环 + 每 ' + c6.stepEvery +
      ' 帧才挪一次的三道拖慢拖影（slow 看得出）');
  ok(s6s.drips === undefined && s6s.pool === undefined &&
     s6s.wound === undefined && s6s.mist === undefined && s6s.flash === 0 &&
     P.protocol.cast.bloodless === true,
    '全场零血珠 / 零积血 / 零裂口 / 零白闪，与血刃的横向裂口 + 液体语言彻底分开');
  let belowShoulder = true;
  for (let f = 0; f <= c6.total; f++) if (P.snapNew(f).ang < -0.8) belowShoulder = false;
  ok(belowShoulder, '断筋全程刀不过肩（与力劈双手举刀过顶相反）');
  ok(P.protocol.hitEvents[0].status.kind === 'slow' &&
     P.protocol.hitEvents[0].status.frames === c6.slowEnd - c6.hit,
    '协议把 slow 60% / 3s 写成命中后 ' + (c6.slowEnd - c6.hit) + ' 帧持续状态');

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

  /* ⑧-4 血战八方：站定八方离散，与同为 spin 的旋风斩六维全分开 */
  P.setClip('blade_8');
  const c8 = P.cfg, o8 = P.snapNew(0).pos.x;
  ok(c8.hits.length === 8 && P.protocol.hitEvents.length === 8 &&
     P.protocol.hitEvents.every(e => e.heal === 4) &&
     P.protocol.cast.spin === false && P.protocol.cast.displacement === 0 &&
     P.protocol.kind === 'eight-direction-discrete',
    '八段离散判定、每段回血 +4、协议写明 spin:false / 0 位移');
  let still8 = true, gapFrames = 0, fanFrames = 0;
  for (let f = 0; f <= c8.total; f++){
    const q = P.snapNew(f);
    if (q.pos.x !== o8) still8 = false;
    if (q.fan) fanFrames++; else if (f >= c8.hits[0] && f < c8.lastHit) gapFrames++;
    if (q.spin !== false) still8 = false;
  }
  ok(still8, '血战八方全程 ' + (c8.total + 1) + ' 帧站定 0 位移，且状态里明确 spin:false');
  ok(fanFrames > 0 && gapFrames > 0,
    '八片短扇形之间留空：' + fanFrames + ' 帧有扇形 / ' + gapFrames +
      ' 帧空档，互不相连、不连成环');
  const dirs = c8.hits.map((h, i) => P.snapNew(c8.seg0 + i * c8.segGap).dirA);
  ok(dirs.every((d, i) => i === 0 || Math.abs(d - dirs[i - 1] - Math.PI / 4) < 1e-9),
    '角度跳到 8 个方位（每次 45°），不是连续单调打转');
  const fanDeg = (P.snapNew(c8.hit).fan.a1 - P.snapNew(c8.hit).fan.a0) * 180 / Math.PI;
  ok(fanDeg > 30 && fanDeg < 50, '单片扇形约 40°（实测 ' + fanDeg.toFixed(1) + '°），不是 360° 环');
  const noReuse = names.blade_8.every(k => names.blade_4.indexOf(k) < 0) &&
    !('blades' in P.snapNew(60)) && !('vortex' in P.snapNew(60)) &&
    !('hands' in P.snapNew(60));
  ok(noReuse, '血战八方零复用旋风斩：组件名无交集、无外圈刃 / 无螺旋风纹 / 无双手持握骨架');
  ok(P.snapNew(0).hitCount === 0 && P.snapNew(c8.hits[3] + 1).hitCount === 4 &&
     P.snapNew(c8.lastHit).hitCount === 8 &&
     P.snapNew(c8.lastHit).enemyHp === 200 - c8.perTick * 8 &&
     P.snapNew(c8.lastHit).healShown === c8.healPerTick * 8,
    '八段逐段结算：f' + c8.lastHit + ' 才到 ' + (c8.perTick * 8) +
      ' 伤害 / +' + (c8.healPerTick * 8) + ' 气血，不是第 0 帧一次打完');

  /* 复位到本次送审的第一招判定帧 */
  P.setBatch('b3');
  P.setClip('blade_5');
  return { ok: C.every(x => x.indexOf('PASS ') === 0), checks: C };
})()
