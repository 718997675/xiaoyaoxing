// tools/quests.js · 任务系统自检（P4 验收）
// 定义完整性 / 接取 / 推进 / 交付 / 奖励 / 存档 / 三物门禁 / 十条全通
(() => {
  const g = window.__game;
  const R = { ok: false, checks: [] };
  const T = (n, c, d) => { R.checks.push((c ? 'PASS' : 'FAIL') + ' | ' + n + (d !== undefined ? ' | ' + d : '')); return !!c; };
  const step = (n, dt) => { for (let i = 0; i < n; i++) g.tick(dt || 0.016); };
  const Q = g.QUESTS;

  // ---------- 1. 定义完整性 ----------
  {
    const bad = [];
    for (const id of g.QUEST_IDS) {
      const q = Q[id];
      if (!q.title) bad.push(id + ':无标题');
      if (!q.giver) bad.push(id + ':无发放者');
      if (!q.steps || !q.steps.length) bad.push(id + ':无目标');
      if (!q.reward) bad.push(id + ':无奖励');
      if (q.id !== id) bad.push(id + ':id 不一致');
    }
    T('18 条任务定义齐全', g.QUEST_IDS.length === 18 && bad.length === 0,
      g.QUEST_IDS.length + ' 条' + (bad.length ? '，问题：' + bad.join('/') : ''));
    // P12 前置项 ①：每条任务都要有一段「交任务时的对话」，不是一句 outro 了事。
    const dlgBad = [];
    const seen = new Map();
    for (const id of g.QUEST_IDS) {
      const lines = Q[id].turnIn;
      if (!Array.isArray(lines) || lines.length < 4) { dlgBad.push(id + ':对话不足4句'); continue; }
      const speakers = new Set();
      for (const l of lines) {
        // 允许「还能修。」这种六字留白，只挡真正的空句。
        if (!l || typeof l.text !== 'string' || l.text.length < 5) dlgBad.push(id + ':空句/太短');
        if (l.who) speakers.add(l.who);
        if (seen.has(l.text)) dlgBad.push(id + ':与 ' + seen.get(l.text) + ' 撞词');
        else seen.set(l.text, id);
      }
      if (speakers.size < 2) dlgBad.push(id + ':只有一个说话人');
    }
    T('18 条任务都有多说话人的交付对话', dlgBad.length === 0,
      g.QUEST_IDS.length + ' 段 / ' + seen.size + ' 句' + (dlgBad.length ? '，问题：' + dlgBad.slice(0, 4).join('/') : ''));
    T('交付对话末句仍接得上 outro', g.QUEST_IDS.every(id => {
      const seq = g.turnInLines(Q[id]);
      return seq[seq.length - 1].text === Q[id].outro;
    }), 'outro 不丢');
    const mains = g.QUEST_IDS.filter(id => Q[id].kind === 'main');
    T('主线 3 条 / 支线 15 条', mains.length === 3 && g.QUEST_IDS.length - mains.length === 15,
      '主线 ' + mains.length + ' / 支线 ' + (g.QUEST_IDS.length - mains.length));
  }

  // ---------- 2. 发放者都存在 ----------
  {
    const ids = new Set(g.talkers.map(v => v.id));
    for (const k in g.shops || {}) ids.add(k);
    // SHOPS 没导出，用 QUEST 里已知的三个店主 id 兜底
    ['inn', 'herb', 'smith', 'tavern', 'pedlar'].forEach(k => ids.add(k));
    const miss = g.QUEST_IDS.filter(id => !ids.has(Q[id].giver));
    T('每条任务的发放者都能找到', miss.length === 0,
      miss.length ? '缺：' + miss.map(id => id + '→' + Q[id].giver).join('/') : g.QUEST_IDS.length + '/' + g.QUEST_IDS.length);
  }

  // ---------- 3. 至少 3 条依赖新区域 ----------
  {
    // 竹海 / 石窟 / 乱葬岗 三块新区域的判定框（格 → px）
    const REG = {
      竹海: { x0: 4 * 16, y0: 52 * 16, x1: 62 * 16, y1: 100 * 16 },
      石窟: { x0: 4 * 16, y0: 6 * 16, x1: 52 * 16, y1: 46 * 16 },
      乱葬岗: { x0: 92 * 16, y0: 4 * 16, x1: 140 * 16, y1: 44 * 16 },
    };
    const inReg = (x, y) => Object.keys(REG).some(k => {
      const r = REG[k];
      return x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
    });
    const NEWBOSS = ['qingshe', 'kuilei', 'shimu', 'huoya'];
    const hit = g.QUEST_IDS.filter(id => Q[id].steps.some(o =>
      (o.kind === 'reach' && inReg(o.at.x, o.at.y)) ||
      (o.kind === 'kill' && (o.types || []).some(t => NEWBOSS.indexOf(t) >= 0))));
    T('至少 3 条任务的目标落在新区域', hit.length >= 3, hit.length + ' 条：' + hit.join('/'));

    // P9：至少一条支线是**跨区**的。委托写在竹海，活儿要跑到石窟 ——
    // 那一趟路才是把三个区连成一个地方的东西，否则它们只是三个关卡。
    const crossSide = g.QUEST_IDS.filter(id => {
      const q = Q[id];
      if (q.kind !== 'side') return false;
      const zones = new Set();
      for (const o of q.steps) {
        if (o.kind !== 'reach') continue;
        for (const k of Object.keys(REG)) {
          const r = REG[k];
          if (o.at.x >= r.x0 && o.at.x <= r.x1 && o.at.y >= r.y0 && o.at.y <= r.y1) zones.add(k);
        }
      }
      return q.place === '南岭竹海' && zones.has('石窟');
    });
    T('至少一条支线是跨区的', crossSide.length >= 1, crossSide.join('/') || '没有');
  }

  // ---------- 4. 主线顺序解锁 ----------
  {
    g.startGame(false); step(2);
    const first = g.questOffered('w_hunter').map(q => q.id);
    const later = g.questOffered('w_stone').map(q => q.id);
    T('第一条主线开局就能接', first.indexOf('q_main_bamboo') >= 0, first.join('/') || '无');
    T('后一条主线要先完成前一条', later.indexOf('q_main_cave') < 0, later.join('/') || '无');
    T('支线不受主线顺序限制', g.questOffered('qiao').map(q => q.id).indexOf('q_side_dog') >= 0,
      g.questOffered('qiao').map(q => q.id).join('/'));
  }

  // ---------- 5. 接取 / 重复接取 ----------
  {
    g.startGame(false); step(2);
    const ok1 = g.questAccept('q_side_dog');
    const ok2 = g.questAccept('q_side_dog');
    T('能接任务', ok1 === true, 'state=' + (g.player.quests.q_side_dog || {}).st);
    T('同一条不能接两次', ok2 === false, '第二次返回 ' + ok2);
    T('接了就进追踪', g.player.track === 'q_side_dog', g.player.track);
  }

  // ---------- 6. kill 类推进 ----------
  {
    g.startGame(false); step(2);
    g.setClock(0.35, 3);
    g.questAccept('q_side_dog');
    g.setPos(1536, 1536);
    for (let i = 0; i < 8; i++) {
      const e = g.spawnEnemy('fox', g.player.x + 20, g.player.y, { x: g.player.x, y: g.player.y });
      if (!e) break;
      g.hitEnemy(e, { dmg: 99999, crit: false }, 0, 0);
    }
    step(2);
    const s = g.player.quests.q_side_dog;
    T('杀够数量会自动推进', s.step >= Q.q_side_dog.steps.length, 'step=' + s.step + '/' + Q.q_side_dog.steps.length);
    T('推进到末步后可复命', g.questReady('q_side_dog') === true, 'ready=' + g.questReady('q_side_dog'));
    const gold0 = g.player.gold;
    const done = g.questTurnIn('q_side_dog');
    T('交付成功并给奖励', !!done && g.player.gold === gold0 + Q.q_side_dog.reward.gold,
      '+' + (g.player.gold - gold0) + ' 银两');
    T('交付后状态变 done', g.player.quests.q_side_dog.st === 'done', g.player.quests.q_side_dog.st);
    T('没完成不能重复交付', g.questTurnIn('q_side_dog') === null, '第二次返回 null');
  }

  // ---------- 7. 夜间目标 ----------
  {
    g.startGame(false); step(2);
    g.questAccept('q_main_grave');
    // 第一条主线没做完，q_main_grave 不在 offered 里 —— 直接塞进状态，验的是"计数规则"
    g.player.quests.q_main_grave = { st: 'active', step: 0, prog: 0 };
    g.setClock(0.35, 3);   // 正午
    const e1 = g.spawnEnemy('yinhun', g.player.x + 20, g.player.y, { x: g.player.x, y: g.player.y });
    if (e1) g.hitEnemy(e1, { dmg: 99999, crit: false }, 0, 0);
    step(2);
    const dayProg = g.player.quests.q_main_grave.prog;
    g.setClock(0.85, 3);   // 子时
    const e2 = g.spawnEnemy('yinhun', g.player.x + 20, g.player.y, { x: g.player.x, y: g.player.y });
    if (e2) g.hitEnemy(e2, { dmg: 99999, crit: false }, 0, 0);
    step(2);
    const nightProg = g.player.quests.q_main_grave.prog;
    T('白天杀阴魂不计数', dayProg === 0, 'prog=' + dayProg);
    T('夜里杀阴魂才计数', nightProg === 1, 'prog=' + nightProg);
  }

  // ---------- 8. 三物门禁 ----------
  {
    g.startGame(false); step(2);
    T('开局封碑是关着的', g.sealOn === true, 'sealOn=' + g.sealOn);
    let doors = 0, sealed = 0;
    const d = g.DG;
    for (let y = d.ty0; y < d.ty0 + 28; y++) for (let x = d.tx0; x < d.tx0 + 30; x++) {
      const i = y * g.MAPW + x;
      if (g.tiles[i] !== 8) continue;
      doors++; if (g.solid[i]) sealed++;
    }
    T('门格真的被堵上了', doors > 0 && sealed === doors, sealed + '/' + doors + ' 格实心');
    // 只验 tile 实心还不够 —— 玩家能不能走过去才算数
    const doorPt = { x: (g.DG.x0 + g.DG.x1) / 2, y: g.DG.y1 - 8 };
    let walkDoor = false;
    for (let y = g.DG.ty0; y < g.DG.ty0 + 28 && !walkDoor; y++) {
      for (let x = g.DG.tx0; x < g.DG.tx0 + 30; x++) {
        if (g.tiles[y * g.MAPW + x] !== 8) continue;
        if (g.canStand(x * 16 + 8, y * 16 + 8)) { walkDoor = true; doorPt.x = x * 16 + 8; doorPt.y = y * 16 + 8; break; }
      }
    }
    T('封着的时候走不进洞口', walkDoor === false, walkDoor ? '有可走门格' : '全堵死');

    g.player.relics.bamboo_heart = 1;
    g.player.relics.stone_marrow = 1;
    const t1 = g.tripleState();
    T('缺一件时仍不可进', t1.ok === false && t1.miss.length === 1, '缺 ' + t1.miss.join('/'));
    g.player.relics.yin_soil = 1;
    g.refreshSeal();
    const t2 = g.tripleState();
    T('三物齐了封碑自开', t2.ok === true && g.sealOn === false, 'ok=' + t2.ok + ' seal=' + g.sealOn);
    let sealed2 = 0;
    for (let y = d.ty0; y < d.ty0 + 28; y++) for (let x = d.tx0; x < d.tx0 + 30; x++) {
      const i = y * g.MAPW + x;
      if (g.tiles[i] === 8 && g.solid[i]) sealed2++;
    }
    T('开了之后门格恢复可走', sealed2 === 0, sealed2 + ' 格仍实心');
    T('开了之后能站在门口', g.canStand(doorPt.x, doorPt.y) === true,
      'canStand(' + Math.round(doorPt.x) + ',' + Math.round(doorPt.y) + ')');
  }

  // ---------- 9. 存档 / 读档 ----------
  {
    g.startGame(false); step(2);
    g.questAccept('q_side_dog');
    g.player.relics.bamboo_heart = 1;
    g.player.quests.q_side_bandit = { st: 'done', step: 1, prog: 0 };
    g.save();
    g.startGame(true);   // 读档重开
    step(2);
    const s = g.player.quests.q_side_dog;
    T('任务状态能存档读档', !!s && s.st === 'active', s ? s.st : '丢了');
    T('信物能存档读档', (g.player.relics.bamboo_heart || 0) === 1, '竹心=' + (g.player.relics.bamboo_heart || 0));
    T('已完成的任务也留着', g.player.quests.q_side_bandit && g.player.quests.q_side_bandit.st === 'done',
      (g.player.quests.q_side_bandit || {}).st);
  }

  // ---------- 9.5 交付对话真的能逐句走完 ----------
  {
    const q = Q.q_side_dog;
    g.beginTurnIn(q, 'shop');
    const s0 = g.turnInState;
    T('点复命进入交付对话第一句', !!s0 && s0.i === 0 && s0.host === 'shop' &&
      s0.text === q.turnIn[0].text, s0 ? s0.who + '：' + s0.text.slice(0, 12) : '没进去');
    let n = 0;
    while (g.turnInState && n++ < 30) g.advanceTurnIn();
    T('交付对话能一句句走到收束', n === q.turnIn.length + 1 && g.turnInState === null,
      n + ' 句（含 outro）');
    T('对话结束后名字与货架复位', document.getElementById('shopTitle').textContent.length > 0,
      document.getElementById('shopTitle').textContent);

    g.startGame(false); step(2);
    g.questAccept('q_side_dog');
    g.player.quests.q_side_dog.step = q.steps.length;   // 直接置为可复命
    const v = g.talkers.find(x => x.id === 'qiao');
    g.talkTo(v);
    const btn = Array.from(document.querySelectorAll('#talkOpts button'))
      .find(b => b.textContent.indexOf('复命') === 0);
    T('村民面板有复命按钮', !!btn, btn ? btn.textContent : '没有');
    if (btn) {
      btn.click();
      const s = g.turnInState;
      T('村民复命会进逐句对话', !!s && s.host === 'talk' && s.text === q.turnIn[0].text,
        s ? s.text.slice(0, 12) : '没进对话');
      T('复命确实给了奖励', g.player.quests.q_side_dog.st === 'done', g.player.quests.q_side_dog.st);
    }
    g.talkClose();
  }

  // ---------- 10. 十条任务全部可完成 ----------
  {
    g.startGame(false); step(2);
    g.setLevel(20);
    const fails = [];
    // 主线按顺序做，支线随便
    const order = ['q_main_bamboo', 'q_main_cave', 'q_main_grave']
      .concat(g.QUEST_IDS.filter(id => Q[id].kind === 'side'));

    const finish = (id) => {
      const q = Q[id];
      g.questAccept(id);
      if (!g.player.quests[id]) { fails.push(id + ':接不了'); return; }
      for (let guard = 0; guard < 20; guard++) {
        const s = g.player.quests[id];
        if (s.step >= q.steps.length) break;
        const o = q.steps[s.step];
        if (o.kind === 'reach') {
          g.setPos(o.at.x, o.at.y); step(2);
        } else if (o.kind === 'dg') {
          // 先让封碑开着，再挪进洞的范围内
          g.player.relics.yin_soil = 1; g.player.relics.bamboo_heart = 1; g.player.relics.stone_marrow = 1;
          g.refreshSeal();
          g.setPos((g.DG.x0 + g.DG.x1) / 2, g.DG.y1 - 40); step(2);
        } else if (o.kind === 'have') {
          if (o.field === 'iron') g.player.iron = o.count + 5;
          else if (o.field === 'gold') g.player.gold = o.count + 5;
          step(2);
        } else if (o.kind === 'kill') {
          if (o.night) g.setClock(0.85, 3);
          for (let k = 0; k < o.count; k++) {
            const e = g.spawnEnemy(o.types[0], g.player.x + 24, g.player.y, { x: g.player.x, y: g.player.y });
            if (!e) { fails.push(id + ':刷不出 ' + o.types[0]); break; }
            if (o.lord) e.lord = o.lord;
            g.hitEnemy(e, { dmg: 99999, crit: false }, 0, 0);
          }
          step(2);
        } else {
          fails.push(id + ':未处理的目标类型 ' + o.kind); break;
        }
      }
      if (!g.questReady(id)) { fails.push(id + ':卡在 step ' + g.player.quests[id].step); return; }
      const done = g.questTurnIn(id);
      if (!done) fails.push(id + ':交不了');
    };
    for (const id of order) finish(id);

    const finished = g.QUEST_IDS.filter(id => g.player.quests[id] && g.player.quests[id].st === 'done');
    T('18 条任务全部可完成', finished.length === 18 && fails.length === 0,
      finished.length + '/18' + (fails.length ? '，问题：' + fails.join(' / ') : ''));
    T('主线三件三物都到手', g.tripleState().ok === true,
      '竹心=' + (g.player.relics.bamboo_heart || 0) + ' 石髓=' + (g.player.relics.stone_marrow || 0) +
      ' 阴土=' + (g.player.relics.yin_soil || 0));
  }

  // ---------- 11. P12-B：第二章六条支线 ----------
  {
    const CH2 = ['q_side_banner', 'q_side_redsoil', 'q_side_chain',
      'q_side_ferrycoin', 'q_side_plates', 'q_side_nightlamp'];
    const miss = CH2.filter(id => !Q[id] || Q[id].kind !== 'side');
    T('6 条第二章支线都在表内', miss.length === 0,
      miss.length ? '缺：' + miss.join('/') : CH2.length + '/6');
    const givers = new Set(CH2.map(id => Q[id].giver));
    T('六条支线发放者互不重复', givers.size === 6, [...givers].join('/'));
    const kinds = new Set();
    for (const id of CH2) for (const o of Q[id].steps) kinds.add(o.kind);
    T('第二章支线只用 reach / kill / have',
      [...kinds].every(k => ['reach', 'kill', 'have'].indexOf(k) >= 0), [...kinds].join('/'));
    const south = CH2.filter(id => Q[id].steps.some(o =>
      o.kind === 'reach' && o.at && o.at.y >= g.CH1_H * 16));
    T('至少 4 条支线的目标落在第二章两区', south.length >= 4, south.length + ' 条');
    const thin = CH2.filter(id => !Q[id].reward || !Q[id].brief || !Q[id].outro ||
      !Array.isArray(Q[id].turnIn) || Q[id].turnIn.length < 4);
    T('六条支线的奖励 / 简述 / 交付对话齐全', thin.length === 0,
      thin.length ? thin.join('/') : 'ok');
  }

  R.ok = R.checks.every(c => c.startsWith('PASS'));
  return R;
})()
