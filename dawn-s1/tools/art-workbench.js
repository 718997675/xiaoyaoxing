// tools/art-workbench.js · 招式工作台自检
// 跑法：PAGE=art-workbench.html node tools/run.js eval tools/art-workbench.js
//
// 工作台页没有 window.__game，run.js 的就绪等待认 __wbReady。
// 这里验的不是"HTML 里有这些字"，而是：基线数据对不对、能不能编辑、
// 导出的覆盖表能不能被游戏读回去、导出的 JSON 能不能再导回来接着改。
(() => {
  const w = window.__wb;
  const R = { ok: false, checks: [] };
  const T = (n, c, d) => { R.checks.push((c ? 'PASS' : 'FAIL') + ' | ' + n + (d !== undefined ? ' | ' + d : '')); return !!c; };
  try {
    T('工作台就绪（__wbReady / __wb）', window.__wbReady === true && !!w);
    const B = w.base;
    T('基线 80 招', Object.keys(B.arts).length === 80, Object.keys(B.arts).length);
    T('形状池 19 / 动作池 20 / 声音池 17 / 原语 14 / 兵器 10 / 色板 20',
      B.shapes.length === 19 && B.poses.length === 20 && B.snds.length === 17 &&
      B.fx.length === 14 && B.fams.length === 10 && B.palette.length === 20,
      [B.shapes.length, B.poses.length, B.snds.length, B.fx.length, B.fams.length, B.palette.length].join('/'));

    // 重点回归：zone.shape（circle / line）曾经被当成招式的 shape 解析进来，
    // 导致 5 招的下拉框是空值。解析脚本现在锚定顶层行，这里再兜一道。
    const bad = [];
    for (const id of Object.keys(B.arts)) {
      const a = B.arts[id];
      if (B.shapes.indexOf(a.shape) < 0) bad.push(id + '.shape=' + a.shape);
      if (B.poses.indexOf(a.pose.mode) < 0) bad.push(id + '.pose=' + a.pose.mode);
      if (B.snds.indexOf(a.snd) < 0) bad.push(id + '.snd=' + a.snd);
      if (B.snds.indexOf(a.hitSnd) < 0) bad.push(id + '.hitSnd=' + a.hitSnd);
      if (B.fx.indexOf(a.fx) < 0) bad.push(id + '.fx=' + a.fx);
      if (B.fams.indexOf(a.fam) < 0) bad.push(id + '.fam=' + a.fam);
      if (!/^#[0-9a-fA-F]{6}$/.test(a.color[0]) || !/^#[0-9a-fA-F]{6}$/.test(a.color[1] || ''))
        bad.push(id + '.color=' + a.color.join('/'));
      if (!(a.mul > 0) || !(a.cd > 0) || !(a.reach > 0)) bad.push(id + '.数值');
    }
    T('80 招字段全部落在登记池里（含 zone.shape 污染回归）', bad.length === 0, bad.slice(0, 6).join(' ') || 'OK');
    for (const f of B.fams) {
      T('兵器 ' + (B.famLabel[f] || f) + ' 恰好 8 招',
        Object.keys(B.arts).filter(id => B.arts[id].fam === f).length === 8);
    }

    T('工作台基线含链 / 扇各 8 招',
      ['chain', 'fan'].every(f => B.fams.indexOf(f) >= 0
        && Object.keys(B.arts).filter(id => B.arts[id].fam === f).length === 8),
      B.fams.join('/'));
    T('链 / 扇有中文标签', B.famLabel.chain === '链' && B.famLabel.fan === '扇',
      (B.famLabel.chain || '?') + '/' + (B.famLabel.fan || '?'));

    // 时间轴：默认 30fps，刀光区间必须落在总帧内
    w.select('sword_1');
    const t0 = w.cur().timeline;
    T('默认 30fps 时间轴', t0.fps === 30 && t0.total >= 6, t0.total + ' 帧');
    T('默认时间轴字段齐备', ['total', 'windup', 'hit', 'fxStart', 'fxLen', 'recover']
      .every(k => typeof t0[k] === 'number'));
    const tlBad = [];
    for (const id of Object.keys(B.arts)) {
      w.select(id);
      const t = w.cur().timeline;
      if (t.fxStart + t.fxLen > t.total) tlBad.push(id);
    }
    T('80 招的默认刀光区间都不越界', tlBad.length === 0, tlBad.join(' ') || 'OK');

    // 预览画布真的画了东西（不是一块纯黑背景）
    w.select('sword_1'); w.setFrame(4);
    const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
    const px = ctx.getImageData(0, 0, 260, 60).data;
    let lit = false;
    for (let i = 0; i < px.length; i += 4) if (px[i] > 150 && px[i + 1] > 140) { lit = true; break; }
    T('预览画布真的画出了像素', lit);

    // 按钮齐备
    const btns = ['btnPlay', 'btnStep', 'btnReset', 'btnPng', 'btnJson', 'btnData',
      'btnTry', 'btnCopy', 'btnImport', 'btnClear'];
    T('顶栏 10 个操作按钮齐备（含导入草稿）',
      btns.every(id => !!document.getElementById(id)),
      btns.filter(id => !document.getElementById(id)).join(' ') || 'OK');

    // 未编辑 → 空覆盖表，不许把 80 招全量写进覆盖表
    w.clear();
    T('清空草稿可用', Object.keys(w.draft).length === 0);
    let p = w.buildPack();
    T('未编辑时导出空覆盖表', p.version === 1 && Object.keys(p.arts).length === 0,
      Object.keys(p.arts).length + ' 招');

    // 编辑一招：形状 / 倍率 / 时间轴
    w.select('sword_1');
    w.setField('shape', 'ring');
    w.setField('mul', 9.9);
    w.setTl('total', 30); w.setTl('fxStart', 6); w.setTl('fxLen', 9);
    p = JSON.parse(w.packText());
    T('只导出改过的那一招', Object.keys(p.arts).length === 1 && !!p.arts.sword_1,
      Object.keys(p.arts).join(','));
    const row = p.arts.sword_1 || {};
    T('差异字段写进覆盖表', row.shape === 'ring' && row.mul === 9.9, row.shape + '/' + row.mul);
    T('没改的字段不写进覆盖表', row.cd === undefined && row.cost === undefined && row.reach === undefined);
    T('结构字段绝不进覆盖表', ['id', 'fam', 'slot', 'prof'].every(k => !(k in row)));
    T('30fps 帧数换成秒', Math.abs(row.fxDelay - 0.2) < 1e-9 && Math.abs(row.fxLife - 0.3) < 1e-9,
      row.fxDelay + 's / ' + row.fxLife + 's');
    T('pose.dur 跟着总帧走', Math.abs(row.pose.dur - 1) < 1e-9, row.pose && row.pose.dur);
    T('timeline 原样带出', row.timeline && row.timeline.total === 30 && row.timeline.fps === 30);
    const dt = w.dataText();
    T('dataText 是可直接放进仓库的赋值语句',
      dt.indexOf('// 由招式工作台导出') === 0 && /window\.__ART_OVERRIDES_FILE__ = /.test(dt) && /;\s*$/.test(dt));
    const jsonPart = dt.slice(dt.indexOf(' = ') + 3).trim().replace(/;$/, '');
    let dtObj = null;
    try { dtObj = JSON.parse(jsonPart); } catch (e) { }
    T('dataText 里的覆盖表是合法 JSON', !!dtObj && Object.keys(dtObj.arts).length === 1);

    // 闭环：导出 JSON → 清空 → 导回 → 再导出，结果一致
    const txt = w.packText();
    w.clear(); w.importPack(txt);
    T('导回草稿后恢复了那一招', Object.keys(w.draft).length === 1 && !!w.draft.sword_1);
    const p2 = JSON.parse(w.packText()).arts.sword_1;
    T('导回再导出，关键字段不丢',
      p2.shape === row.shape && p2.mul === row.mul && p2.timeline.total === 30 &&
      Math.abs(p2.fxDelay - 0.2) < 1e-9 && Math.abs(p2.fxLife - 0.3) < 1e-9);
    w.importPack(JSON.stringify({ version: 1, arts: { not_an_art: { shape: 'ring' } } }));
    T('不认识的招式 id 被忽略', !w.draft.not_an_art);

    // 收尾：别把测试草稿留在浏览器里
    w.clear();
    T('收尾清空草稿', Object.keys(w.draft).length === 0);
  } catch (err) {
    R.checks.push('FAIL | 脚本异常 | ' + err.message + ' @ ' + String(err.stack || '').split('\n')[1]);
  }
  R.ok = R.checks.every(c => c.indexOf('PASS') === 0);
  return R;
})();
