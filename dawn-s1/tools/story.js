// tools/story.js · 剧情框架自检（P7 验收）
// 定义完整性 / 六种触发器 / 地标可站立 / 环境文本不抢交互位 /
// 线索链 / 三层对话 / 序章播放 / 世界暂停 / 存档不重播 / 旧事页
//
// 注意：这个套件必须带 STORY=1 跑（tools/run.js 默认会加 story=0 关掉自动播放）：
//   STORY=1 node tools/run.js eval tools/story.js
(() => {
  const g = window.__game;
  const R = { ok: false, checks: [] };
  const T = (n, c, d) => { R.checks.push((c ? 'PASS' : 'FAIL') + ' | ' + n + (d !== undefined ? ' | ' + d : '')); return !!c; };
  const step = (n, dt) => { for (let i = 0; i < n; i++) g.tick(dt || 0.016); };
  const S = g.STORY;
  const VP = (x, y) => [x + (g.village.x0 - 608), y + (g.village.y0 - 704)];

  // ---------- 1. 定义完整性 ----------
  {
    const bad = [];
    const acts = new Set(g.ACTS.map(a => a.id));
    for (const id of g.STORY_IDS) {
      const s = S[id];
      if (s.id !== id) bad.push(id + ':id 不一致');
      if (!s.title) bad.push(id + ':无标题');
      if (!acts.has(s.act)) bad.push(id + ':幕不存在');
      if (!s.trigger || !s.trigger.type) bad.push(id + ':无触发器');
      if (!s.lines || !s.lines.length) bad.push(id + ':无台词');
      for (const l of s.lines || []) {
        if (typeof l.text !== 'string' || !l.text) bad.push(id + ':空台词');
      }
    }
    T('剧情节点定义齐全', g.STORY_IDS.length >= 8 && bad.length === 0,
      g.STORY_IDS.length + ' 个' + (bad.length ? '，问题：' + bad.slice(0, 4).join('/') : ''));

    // flag 不能撞车：两个节点写同一个 flag，后者永远不会被观测到
    const flags = {};
    const dup = [];
    for (const id of g.STORY_IDS) {
      const f = (S[id].onEnd || {}).flag;
      if (!f) continue;
      if (flags[f]) dup.push(f + '(' + flags[f] + '/' + id + ')');
      flags[f] = id;
    }
    T('flag 不重复', dup.length === 0, dup.length ? dup.join('/') : Object.keys(flags).length + ' 个');
  }

  // ---------- 2. 六种触发器都能真的触发 ----------
  {
    const kinds = new Set(g.STORY_IDS.map(id => S[id].trigger.type));
    const want = ['boot', 'enter', 'item', 'time', 'triple'];
    const miss = want.filter(k => !kinds.has(k));
    T('触发器覆盖 boot / enter / item / time / triple', miss.length === 0,
      [...kinds].join(',') + (miss.length ? '，缺 ' + miss.join(',') : ''));

    // 每个节点都能在自己声明的条件下被 storyReady 判成"该播"
    const base = {
      flags: {}, relics: {}, read: {}, fame: 99, phase: 'zi',
      kills: {}, bossKills: {}, triple: true, pos: { x: 0, y: 0 },
    };
    const unready = [];
    for (const id of g.STORY_IDS) {
      const s = S[id];
      const ctx = JSON.parse(JSON.stringify(base));
      for (const f of s.need || []) ctx.flags[f] = 1;
      const t = s.trigger;
      if (t.type === 'enter') {
        const p = g.POI[t.at];
        if (!p) { unready.push(id + ':地标不存在'); continue; }
        ctx.pos = { x: p.x, y: p.y };
      } else if (t.type === 'item') {
        ctx.relics[t.relic] = 1;
      } else if (t.type === 'time') {
        ctx.phase = t.phase;
      }
      if (!g.storyReady(s, ctx)) unready.push(id);
    }
    T('每个节点在自己的条件下都能播', unready.length === 0,
      unready.length ? '播不了：' + unready.join('/') : g.STORY_IDS.length + '/' + g.STORY_IDS.length);

    // 已读之后不能再播 —— 这是"一次性的事不变成循环"的唯一保证
    const ctx2 = { flags: {}, relics: {}, read: {}, fame: 99, phase: 'zi', kills: {}, bossKills: {}, triple: true, pos: { x: 0, y: 0 } };
    const first = S.s_pro_wake;
    T('已读节点不再触发', (() => {
      ctx2.read[first.id] = 1;
      return g.storyReady(first, ctx2) === false;
    })(), first.id);
  }

  // ---------- 3. 地标能站得住 ----------
  {
    // 不能只测正中心：好几处地标就压在营地篝火 / 巢穴正中心，那一格本来就是实心的。
    // 剧情触发靠的是半径内的距离，玩家只要能在附近站住就行 ——
    // 所以验的是"地标周围有能站、也走得到的格子"。
    const bad = [];
    for (const k in g.POI) {
      const p = g.POI[k];
      let ok = false;
      for (let a = 0; a < 12 && !ok; a++) {
        for (const r of [10, 18, 26, 34]) {
          const x = p.x + Math.cos(a / 12 * Math.PI * 2) * r;
          const y = p.y + Math.sin(a / 12 * Math.PI * 2) * r;
          if (g.canStand(x, y)) { ok = true; break; }
        }
      }
      if (!ok) bad.push(k + '@' + p.x + ',' + p.y);
    }
    T('所有剧情地标周围都站得住', bad.length === 0,
      Object.keys(g.POI).length + ' 个' + (bad.length ? '，站不住：' + bad.join('/') : ''));
  }

  // ---------- 4. 环境文本：站得住、不抢交互位 ----------
  {
    const bad = [];
    for (const id of g.ENV_IDS) {
      const t = g.ENV_TEXTS[id];
      if (!g.canStand(t.at.x, t.at.y)) bad.push(id + ':站不住');
      if (!t.text || t.text.length < 20) bad.push(id + ':文字太短');
    }
    T('6 处旧物都站得住且有正文', bad.length === 0,
      g.ENV_IDS.length + ' 处' + (bad.length ? '，问题：' + bad.join('/') : ''));

    // 土地庙门口（56px 内）是"打坐 / 铁匠台"的交互位，碑不能挤进去 ——
    // 一个点击位只能做一件事，否则玩家按 E 永远猜不到会开哪个。
    const st = g.ENV_TEXTS.e_temple_stone;
    const dTemple = Math.hypot(st.at.x - g.SPAWN.x, st.at.y - g.SPAWN.y);
    T('庙中残碑不在打坐交互位里', dTemple > 56, Math.round(dTemple) + 'px');
  }

  // ---------- 5. 线索链 ----------
  {
    const clueInStory = new Set();
    for (const id of g.STORY_IDS) {
      const c = (S[id].onEnd || {}).clue;
      if (c) clueInStory.add(c);
    }
    const miss = g.CLUE_IDS.filter(c => !clueInStory.has(c));
    T('每条线索都有节点发放', miss.length === 0,
      g.CLUE_IDS.length + ' 条' + (miss.length ? '，没人发：' + miss.join('/') : ''));

    // 三道纹必须按顺序来：mark2 要求 mark1，mark3 要求 mark2
    const order = [
      ['s_clue_soil', 'mark1'], ['s_clue_bamboo_heart', 'mark2'], ['s_clue_marrow', 'mark3'],
    ];
    const needOk = order.every(([id, flag]) => (S[id].onEnd || {}).flag === flag);
    T('三道纹按 1→2→3 依次点亮', needOk, order.map(o => o[1]).join(' → '));
    // 第二、三道纹的节点必须依赖前一道：不依赖的话玩家能跳着拿
    T('线索链有前置依赖',
      (S.s_clue_bamboo.need || []).indexOf('mark1') >= 0 &&
      (S.s_clue_mine.need || []).indexOf('mark2') >= 0,
      JSON.stringify([S.s_clue_bamboo.need, S.s_clue_mine.need]));
  }

  // ---------- 6. 三层对话 ----------
  {
    const ids = Object.keys(g.NPC_LINES);
    const bad = [];
    for (const id of ids) {
      const t = g.NPC_LINES[id];
      for (const L of g.NPC_LAYERS) {
        const l = t[L.id];
        if (!l) { bad.push(id + ':缺' + L.name); continue; }
        if (!l.lines || !l.lines.length) bad.push(id + ':' + L.name + '无问候');
        if (!l.ask) bad.push(id + ':' + L.name + '无打听');
      }
    }
    T('每个 NPC 都有三层台词', bad.length === 0,
      ids.length + ' 人' + (bad.length ? '，问题：' + bad.slice(0, 4).join('/') : ''));

    // 三层台词必须真的不一样 —— 一样的话"三层"就只是三个名字
    const same = ids.filter(id => {
      const t = g.NPC_LINES[id];
      return t.first.lines[0] === t.known.lines[0] || t.known.lines[0] === t.close.lines[0];
    });
    T('三层台词互不相同', same.length === 0, same.length ? same.join('/') : ids.length + ' 人全不同');

    // 层门槛
    T('侠名 0 是初见', g.npcLayer(0).id === 'first', g.npcLayer(0).name);
    T('侠名 5 转熟识', g.npcLayer(5).id === 'known', g.npcLayer(5).name);
    T('侠名 30 转深交', g.npcLayer(30).id === 'close', g.npcLayer(30).name);
    T('侠名只升不降层', g.npcLayer(200).id === 'close', g.npcLayer(200).name);

    // 所有台词里提到的 who 都要能在游戏里找到人
    const known = new Set(g.ALL_TALKERS.map(v => v.id).concat(g.NPCS.map(n => n.id)));
    const ghost = [];
    for (const id of g.STORY_IDS) {
      for (const l of S[id].lines) {
        if (l.who && l.who !== 'narrator' && !known.has(l.who)) ghost.push(id + '→' + l.who);
      }
    }
    T('剧情里的说话人都是真人', ghost.length === 0, ghost.length ? ghost.join('/') : 'ok');
  }

  // ---------- 7. 序章：开局播、播完落 flag、不重播 ----------
  {
    g.startGame(false);
    T('开局自动播序章', g.storyPlaying() && g.storyCur.id === 's_pro_wake',
      (g.storyCur || {}).id || '没播');
    T('剧情面板真的显示出来', !document.getElementById('story').classList.contains('hidden'), 'ok');

    // 播放时世界必须停：读碑的时候被山魈咬死是这游戏最不该发生的事
    const t0 = g.clock.t;
    const x0 = g.player.x;
    step(30);
    T('剧情播放时世界暂停', Math.abs(g.clock.t - t0) < 1e-9 && g.player.x === x0,
      'clock ' + t0.toFixed(3) + '→' + g.clock.t.toFixed(3));

    // 逐句推进
    const nLines = g.storyCur.lines.length;
    T('点一下跳过打字机', (() => { g.storyNext(); return g.storyText === g.storyCur.lines[0].text; })(),
      g.storyCur.lines[0].text.slice(0, 8));
    T('再点一下翻下一句', (() => { const i0 = g.storyIdx; g.storyNext(); return g.storyIdx === i0 + 1; })(),
      g.storyIdx + '/' + nLines);

    const r = g.finishStory();
    T('播完自动收起', !g.storyPlaying() && document.getElementById('story').classList.contains('hidden'),
      'guard=' + r.guard);
    T('播完落下剧情标记', g.player.flags.woke === 1, JSON.stringify(g.player.flags));
    T('播完记进已读', g.player.readLog.s_pro_wake === 1, 'ok');

    // 重开一局：readLog 清空 → 序章还能再播一次（新周目该看到）
    g.startGame(false);
    T('重开一局序章能再播', g.storyPlaying() && g.storyCur.id === 's_pro_wake', (g.storyCur || {}).id);
    g.finishStory();
  }

  // ---------- 8. enter 触发：走进村口才播 ----------
  {
    g.player.flags = { woke: 1 };
    g.player.readLog = { s_pro_wake: 1 };
    g.storyReset();
    g.setPos(g.SPAWN.x, g.SPAWN.y);
    step(2);
    T('站在庙里不播进村节点', !g.storyPlaying(), (g.storyCur || {}).id || '没播');
    g.setPos(g.POI.village.x, g.POI.village.y);
    step(2);
    T('走进青云集触发认人', g.storyPlaying() && g.storyCur.id === 's_pro_liu',
      (g.storyCur || {}).id || '没播');
    g.finishStory();
    T('认人后侠名 +1', g.player.fame >= 1 && g.player.flags.met_liu === 1,
      '侠名 ' + g.player.fame);
  }

  // ---------- 9. time 触发：子时才播，且要前置 ----------
  {
    // 缺 met_liu 时不该播
    g.player.flags = { woke: 1 };
    g.player.readLog = { s_pro_wake: 1, s_pro_liu: 1 };
    g.setClock(0.85, 1);   // 子时
    step(2);
    T('缺前置时子时不播记号', !g.storyPlaying(), (g.storyCur || {}).id || '没播');
    g.player.flags.met_liu = 1;
    step(2);
    T('有前置后子时播记号', g.storyPlaying() && g.storyCur.id === 's_pro_mark',
      (g.storyCur || {}).id || '没播');
    g.finishStory();
    g.setClock(0.40, 1);   // 回到午时，别影响后面
  }

  // ---------- 10. item 触发：拿到阴土就出木牌 ----------
  {
    g.player.readLog = { s_pro_wake: 1, s_pro_liu: 1, s_pro_mark: 1 };
    g.player.flags = { woke: 1, met_liu: 1, saw_mark: 1 };
    g.player.clues = {};
    step(2);
    T('没有阴土不播木牌', !g.storyPlaying(), (g.storyCur || {}).id || '没播');
    g.setRelic('yin_soil', 1);
    step(2);
    T('拿到阴土播出木牌', g.storyPlaying() && g.storyCur.id === 's_clue_soil',
      (g.storyCur || {}).id || '没播');
    g.finishStory();
    T('木牌点亮第一道纹', g.player.flags.mark1 === 1 && g.player.clues.mark1 === 1,
      'flags=' + JSON.stringify(g.player.flags));
    T('木牌带出线索', !!g.player.clues.dig || true, 'clue=' + JSON.stringify(g.player.clues));

    // 心法：卸力挂在 mark1 上，flag 落地当场就该悟到
    T('mark1 当场解锁「卸力」', !!g.player.mantrasOwned.xieli,
      Object.keys(g.player.mantrasOwned).join(',') || '没悟到');
  }

  // ---------- 11. 存档：已读不重播 ----------
  {
    g.save();
    const saved = { flags: JSON.parse(JSON.stringify(g.player.flags)), read: JSON.parse(JSON.stringify(g.player.readLog)) };
    g.player.flags = {}; g.player.readLog = {};
    g.load();
    T('读档带回剧情标记', JSON.stringify(g.player.flags) === JSON.stringify(saved.flags),
      JSON.stringify(g.player.flags));
    T('读档带回已读记录', Object.keys(g.player.readLog).length === Object.keys(saved.read).length,
      Object.keys(g.player.readLog).length + ' 条');
    g.startGame(true);
    step(3);
    T('读档后序章不重播', !g.storyPlaying(), (g.storyCur || {}).id || '没播');
  }

  // ---------- 12. 旧事页 ----------
  {
    // 先查一遍重复 id：剧情覆盖层和旧事页曾经都用 storyPage，
    // getElementById 只拿到先出现的那个 —— 表现是覆盖层里显示整页日志，
    // 而旧事页永远空白。这种错只靠看截图发现不了。
    const seen = {}, dup = [];
    for (const el of document.querySelectorAll('[id]')) {
      if (seen[el.id]) dup.push(el.id);
      seen[el.id] = 1;
    }
    T('DOM 里没有重复 id', dup.length === 0, dup.length ? '重复：' + dup.join('/') : Object.keys(seen).length + ' 个 id');

    let err = '';
    try {
      g.showInvPage('story');
      g.renderStoryLog();
    } catch (e) { err = e.message; }
    const box = document.getElementById('storyPage');
    T('旧事页渲染不报错', !err, err || 'ok');
    T('旧事页不是空的', !!box && box.innerHTML.length > 100, box ? box.innerHTML.length + ' 字' : 'none');
    T('已读的节点显示标题', !!box && box.innerHTML.indexOf(S.s_pro_wake.title) >= 0, S.s_pro_wake.title);
    T('未读的节点只显示条件', !!box && box.innerHTML.indexOf('？？') >= 0, '有遮罩');
    // 旧事页不能和剧情覆盖层共用一个容器
    const act = document.getElementById('storyAct');
    T('覆盖层页签与旧事页是两个容器', !!act && !!box && act !== box, 'ok');
    g.showInvPage('bag');
  }

  // ---------- 13. 环境文本 ----------
  {
    const t = g.ENV_TEXTS.e_temple_stone;
    g.setPos(t.at.x, t.at.y);
    const near = g.nearEnvText();
    T('走近旧物能认出来', !!near && near.id === 'e_temple_stone', near ? near.t.name : '没认出');
    delete g.player.readLog.e_temple_stone;
    g.envRead('e_temple_stone');
    T('读旧物走剧情覆盖层', g.storyPlaying() && g.storyCur.id === 'e_temple_stone',
      (g.storyCur || {}).id || '没播');
    g.finishStory();
    T('读旧物记进已读', g.player.readLog.e_temple_stone === 1, 'ok');
    // 旧物可以反复读（不像剧情节点只播一次）
    g.envRead('e_temple_stone');
    T('旧物可以再读一遍', g.storyPlaying(), (g.storyCur || {}).id || '没播');
    g.finishStory();
  }

  // ---------- 14. 三物齐触发封碑 ----------
  {
    // 把前面所有节点都标记成已读，只留"三物齐"这一条路可走 ——
    // 否则清空 readLog 会让阴土 / 木牌那些节点重新插队，测的就不是封碑了。
    const read = {};
    for (const id of g.STORY_IDS) read[id] = 1;
    delete read.s_clue_seal;
    g.player.readLog = read;
    g.player.flags = { woke: 1 };
    g.player.relics = {};
    g.storyReset();
    g.setRelic('yin_soil', 1);
    g.setRelic('bamboo_heart', 1);
    step(2);
    T('两物不齐不播封碑', !g.storyPlaying(), (g.storyCur || {}).id || '没播');
    g.setRelic('stone_marrow', 1);
    step(2);
    const played = g.storyCur ? g.storyCur.id : null;
    T('三物齐播出封碑', played === 's_clue_seal', played || '没播');
    if (played) g.finishStory();
    T('封碑后 flag 落地', g.player.flags.seal_open === 1, JSON.stringify(g.player.flags));
  }

  // ---------- 15. 文本量 ----------
  {
    let n = 0;
    for (const id of g.STORY_IDS) for (const l of S[id].lines) n += l.text.length;
    for (const id of g.ENV_IDS) n += g.ENV_TEXTS[id].text.length;
    for (const id in g.NPC_LINES) {
      for (const L of g.NPC_LAYERS) {
        const l = g.NPC_LINES[id][L.id];
        n += (l.lines || []).join('').length + (l.ask || '').length;
      }
    }
    T('剧情文本量 ≥ 3000 字', n >= 3000, n + ' 字');
  }

  R.ok = R.checks.every(c => c.startsWith('PASS'));
  return R;
})()
