// tools/art-overrides.js · 招式覆盖层自检（模块版 + 单文件版都要跑）
// 跑法：node tools/run.js eval tools/art-overrides.js
//       PAGE=逍遥行.html QS=x=1 node tools/run.js eval tools/art-overrides.js
//       PAGE=dist/index.html QS=x=1 node tools/run.js eval tools/art-overrides.js
//
// 验的是"工作台导出的东西进游戏真的生效"，不是只看文件里有没有这些函数名：
// 白名单 / 原地改 / 30fps 时间轴落到 slashGhosts / PNG 序列帧 ghost / 图片绘制分支 / UI。
(async () => {
  const g = window.__game;
  const R = { ok: false, checks: [] };
  const T = (n, c, d) => { R.checks.push((c ? 'PASS' : 'FAIL') + ' | ' + n + (d !== undefined ? ' | ' + d : '')); return !!c; };
  const ov = g && g.artOverrides;
  try {
    T('__game.artOverrides 接口齐备', !!ov &&
      ['apply', 'importText', 'clear', 'count', 'read', 'dump', 'key'].every(k => typeof ov[k] === 'function' || typeof ov[k] === 'string'));
    T('试玩覆盖的 localStorage key 正确', ov.key === 'xy_art_overrides_v1', ov.key);
    ov.clear();
    T('仓库基线是空覆盖表', ov.count() === 0 && Object.keys(ov.read()).length === 0, ov.count());

    const a = g.ARTS.sword_1;
    const snap = {};
    ['name', 'desc', 'cd', 'cost', 'mul', 'reach', 'arc', 'shape', 'pose', 'color', 'snd', 'hitSnd',
      'id', 'fam', 'slot', 'prof'].forEach(k => { snap[k] = a[k]; });

    T('导入非法 JSON 会报错而不是静默吞掉', (() => {
      try { ov.importText('{ 不是 json'); return false; } catch (e) { return true; }
    })());
    T('导入缺 arts 的对象会报错', (() => {
      try { ov.importText('{"version":1}'); return false; } catch (e) { return true; }
    })());

    // 结构字段（id/fam/slot/prof）必须在 cleanPack 这一层就被剥掉，
    // 否则会破坏专精解锁、装配页和存档。
    const pack = {
      version: 1, arts: {
        sword_1: {
          id: 'hacked', fam: 'hacked', slot: 'hacked', prof: 999,
          name: '试招·破锋', mul: 9.9, cd: 7, shape: 'ring',
          color: ['#FFFFFF', '#000000'], snd: 'bell', hitSnd: 'crit',
          fxDelay: 0.2, fxLife: 0.3,
          timeline: { fps: 30, total: 30, fxStart: 6, fxLen: 9 },
        },
      },
    };
    T('importText 返回覆盖招数', ov.importText(JSON.stringify(pack)) === 1);
    T('count / read 读得到这一招', ov.count() === 1 && !!ov.read().sword_1);
    T('read 里没有结构字段', ['id', 'fam', 'slot', 'prof'].every(k => !(k in ov.read().sword_1)));
    T('dump 是合法 JSON', (() => { try { return !!JSON.parse(ov.dump()).arts.sword_1; } catch (e) { return false; } })());
    T('apply 返回覆盖招数', ov.apply(g.ARTS) === 1);
    T('表现层 / 数值层字段已生效',
      a.name === '试招·破锋' && a.mul === 9.9 && a.cd === 7 && a.shape === 'ring' &&
      a.color[0] === '#FFFFFF' && a.snd === 'bell');
    T('结构字段没被覆盖',
      a.id === 'sword_1' && a.fam === 'sword' && a.slot === 'dmg' && a.prof === snap.prof,
      [a.id, a.fam, a.slot, a.prof].join('/'));
    T('ARTS 是原地改，引用没被换掉', g.ARTS.sword_1 === a && g.artById('sword_1') === a);

    // apply 是"只加不减"（正式用法靠刷新页面回到基线），所以下面量基线刀光之前，
    // 得先把刚才那次覆盖手工还原，否则第一发就带着 0.2s 延迟了。
    ov.clear();
    for (const k of Object.keys(snap)) a[k] = snap[k];
    ['frames', 'frameScale', 'frameRotate', 'timeline', 'fxDelay', 'fxLife'].forEach(k => { delete a[k]; });

    // ---------- 真放一招：时间轴要落到 slashGhosts 上 ----------
    g.startGame(false);
    g.equipFam('sword');
    g.player.prof = {};
    for (const f of g.WEAPON_IDS) g.player.prof[f] = 999;
    g.player.qi = 999;

    function arm(text) {
      ov.clear();
      if (text !== null) ov.importText(text);
      ov.apply(g.ARTS);
      g.clearArts();                 // 顺手清冷却，不然第二发 castArt 直接 false
      g.slashGhosts.length = 0;
      g.player.qi = 999;
      g.setLoadout(['sword_1']);
      return g.castArt(0);
    }

    // 基线：没有 timeline / fxDelay 的招式，delay 与 life 必须完全不变
    const noOv = JSON.stringify({ version: 1, arts: {} });
    T('基线招式能放出来', arm(noOv) === true);
    T('基线刀光没有额外延迟', g.slashGhosts.length > 0 &&
      g.slashGhosts.every(x => !x.delay || x.delay <= 0), g.slashGhosts.length + ' 个 ghost');
    const baseMax = g.slashGhosts.map(x => x.max);

    // 只给 timeline（帧数），不写 fxDelay / fxLife —— 走 fps 换算那条路
    const tlOnly = JSON.stringify({
      version: 1, arts: { sword_1: { shape: 'ring', timeline: { fps: 30, total: 30, fxStart: 6, fxLen: 9 } } },
    });
    T('带时间轴的招式能放出来', arm(tlOnly) === true);
    T('30fps 帧数 → 刀光起手延后 0.2s',
      g.slashGhosts.length > 0 && g.slashGhosts.some(x => Math.abs((x.delay || 0) - 0.2) < 1e-6),
      g.slashGhosts.map(x => (x.delay || 0).toFixed(2)).join('/'));
    T('30fps 帧数 → 刀光存活 0.3s',
      g.slashGhosts.length > 0 && g.slashGhosts.some(x => Math.abs((x.max || 0) - 0.3) < 1e-6),
      g.slashGhosts.map(x => (x.max || 0).toFixed(2)).join('/'));
    T('时间轴确实改变了基线刀光的存活时长', baseMax.some(m => Math.abs(m - 0.3) > 1e-6));

    // fxDelay / fxLife 是工作台导出里的显式秒数，优先级高于 timeline
    const explicit = JSON.stringify({
      version: 1, arts: { sword_1: { shape: 'ring', fxDelay: 0.1, fxLife: 0.5, timeline: { fps: 30, fxStart: 6, fxLen: 9 } } },
    });
    T('显式秒数优先级高于帧数', arm(explicit) === true &&
      g.slashGhosts.some(x => Math.abs((x.delay || 0) - 0.1) < 1e-6) &&
      g.slashGhosts.some(x => Math.abs((x.max || 0) - 0.5) < 1e-6));

    // PNG 序列帧：dataURL 数组应当变成一个带 frames 的 ghost
    const c1 = document.createElement('canvas'); c1.width = 1; c1.height = 1;
    const cx = c1.getContext('2d'); cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, 1, 1);
    const png = c1.toDataURL('image/png');
    const framesPack = JSON.stringify({
      version: 1, arts: { sword_1: { shape: 'ring', frames: [png, png], frameScale: 1.5, frameRotate: true } },
    });
    T('带 PNG 序列帧的招式能放出来', arm(framesPack) === true);
    const fg = g.slashGhosts.filter(x => Array.isArray(x.frames));
    T('artFrames 把 dataURL 变成了图片帧 ghost', fg.length === 1 && fg[0].frames.length === 2,
      fg.length + ' 个 / ' + (fg[0] ? fg[0].frames.length : 0) + ' 帧');
    T('frameScale / frameRotate 带进 ghost',
      fg.length === 1 && fg[0].scale === 1.5 && fg[0].rotate === true);

    // ---------- 源码级的接线检查（模块版 fetch game.js，单文件版直接读内联 HTML） ----------
    let src = document.documentElement.outerHTML;
    const need = /artFrames\(a\)|artTiming\(a\)|g\.frames/;
    if (!need.test(src)) {
      try { src = await (await fetch('game.js')).text(); } catch (e) { }
    }
    T('artSwingFx 接了 artTiming / artFrames',
      /artTiming\(a\)/.test(src) && /artFrames\(a\)/.test(src));
    T('刀光绘制循环有图片序列帧分支', /if\s*\(\s*g\.frames\s*\)/.test(src));
    T('覆盖层在启动时就合并进 ARTS', /applyArtOverrides\(ARTS\)/.test(src));
    let hasData = /__ART_OVERRIDES_FILE__/.test(document.documentElement.outerHTML);
    if (!hasData) {
      try { hasData = /__ART_OVERRIDES_FILE__/.test(await (await fetch('art-overrides.data.js')).text()); } catch (e) { }
    }
    T('覆盖数据文件已接入页面', hasData);

    // ---------- 招式页 UI ----------
    T('招式页有工作台入口 / 导入 / 清除按钮和信息条',
      !!document.getElementById('lnkArtWb') && !!document.getElementById('btnArtOv') &&
      !!document.getElementById('btnArtOvClear') && !!document.getElementById('artOvInfo') &&
      !!document.getElementById('artOvFile'));

    // ---------- 还原：覆盖层是"只加不减"，测试必须自己把基线写回去 ----------
    ov.clear();
    for (const k of Object.keys(snap)) a[k] = snap[k];
    ['frames', 'frameScale', 'frameRotate', 'timeline', 'fxDelay', 'fxLife'].forEach(k => { delete a[k]; });
    g.clearArts();
    T('清掉试玩覆盖后回到基线', ov.count() === 0 && a.name === snap.name && a.mul === snap.mul && a.shape === snap.shape);
  } catch (err) {
    R.checks.push('FAIL | 脚本异常 | ' + err.message + ' @ ' + String(err.stack || '').split('\n')[1]);
    try { if (ov) ov.clear(); } catch (e) { }
  }
  R.ok = R.checks.every(c => c.indexOf('PASS') === 0);
  return R;
})();
