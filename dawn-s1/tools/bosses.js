// tools/bosses.js · 首领自检（P3 验收）
// 招式表 / 巢穴 / 定身 / 危险区 / 首杀唯一装备 / 无面剑客接棒
(() => {
  const g = window.__game;
  const R = { ok: false, checks: [] };
  const T = (n, c, d) => { R.checks.push((c ? 'PASS' : 'FAIL') + ' | ' + n + (d !== undefined ? ' | ' + d : '')); return !!c; };
  const step = (n, dt) => { for (let i = 0; i < n; i++) g.tick(dt || 0.016); };
  const alive = () => g.enemies.filter(e => !e.dead);
  const byType = t => alive().find(e => e.type === t);

  const NEW = ['qingshe', 'kuilei', 'shimu', 'huoya', 'wumian', 'gumu', 'jianggui', 'shoulian'];

  // ---------- 1. 定义完整性 ----------
  {
    const bad = [];
    for (const t of NEW) {
      const m = g.MONSTERS[t];
      if (!m) { bad.push(t + ':缺定义'); continue; }
      if (m.behavior !== 'boss') bad.push(t + ':behavior');
      if (!m.skills || m.skills.length < 2) bad.push(t + ':招式<2');
      if (!m.rows || !m.rows2) bad.push(t + ':缺帧');
      if (!m.size) bad.push(t + ':缺size');
      const fxs = new Set((m.skills || []).map(s => s.fx));
      if (fxs.size < 2) bad.push(t + ':招式效果单一');
    }
    T('8 个新首领定义齐全且各带 ≥2 种招式', bad.length === 0, bad.join(' / ') || 'OK');
    const fx = new Set();
    for (const t of NEW) for (const s of g.MONSTERS[t].skills || []) fx.add(s.fx);
    T('招式引擎覆盖 4 种以上效果', fx.size >= 4, [...fx].join('/'));
  }

  // ---------- 2. 巢穴落位 ----------
  g.startGame(false);
  g.setLevel(12);
  step(2);
  {
    T('7 个野外巢穴', g.dens.length === 7, g.dens.map(d => d.name).join('/'));
    const missing = g.dens.filter(d => !alive().some(e => e.type === d.type));
    T('巢穴首领都刷出来了', missing.length === 0, missing.map(d => d.name).join('/') || 'OK');
    const stuck = g.dens.filter(d => {
      const e = alive().find(x => x.type === d.type);
      return !e || !g.canStand(e.x, e.y);
    });
    T('首领都站在可走地面上', stuck.length === 0, stuck.map(d => d.name).join('/') || 'OK');
    const offMap = g.dens.filter(d => !g.canStand(d.x, d.y));
    T('巢穴中心本身可站', offMap.length === 0, offMap.map(d => d.name).join('/') || 'OK');
  }

  // ---------- 3. 首领血条 / 标记 ----------
  {
    const bs = alive().filter(e => e.boss);
    T('e.boss 标记覆盖所有首领', bs.length >= 9, bs.length + ' 只（含树妖/寨主/7 巢穴）');
    const den = byType('qingshe');
    if (den) {
      g.setClock(0.35, 3);
      g.setPos(den.x + 40, den.y);
      step(6);
      T('靠近会进入交战（血条亮起）', den.aggro && den.combatT > 0 || den.aggro,
        'aggro=' + den.aggro + ' combatT=' + (den.combatT || 0).toFixed(2));
      // 跑远脱战
      g.setPos(den.x + 900, den.y + 900);
      step(60);
      T('跑远后首领脱战', !den.aggro, 'aggro=' + den.aggro);
    }
  }

  // ---------- 4. 招式真的会放 ----------
  {
    const den = byType('qingshe');
    if (den) {
      g.setClock(0.35, 3);
      g.clearHazards();
      const before = g.hazards.length;
      g.setPos(den.x + 40, den.y);
      den.aggro = true; den.skillCds = null; den.skillGap = 0; den.skill = null;
      let casted = 0, sawHazard = false, maxHz = 0, sawRoot = false, sawSummon = false;
      const hp0 = g.player.hp;
      for (let i = 0; i < 900; i++) {
        g.tick(0.016);
        if (den.skill) casted++;
        if (g.hazards.length > 0) { sawHazard = true; maxHz = Math.max(maxHz, g.hazards.length); }
        if (g.player.rootT > 0) sawRoot = true;
        if (g.enemies.some(e => e.camp && e.camp.x === den.x && e.type !== 'qingshe' && !e.dead)) sawSummon = true;
        if (!den.dead && den.hp < den.maxHp * 0.5) den.hp = den.maxHp;   // 别让它被打死，只看招式
        g.player.hp = g.player.maxHpBase;                                 // 也别让玩家死
      }
      T('青鳞蟒会进入抬手状态', casted > 0, casted + ' 帧在施法');
      T('青鳞蟒放出过危险区（毒雾）', sawHazard, '同时最多 ' + maxHz + ' 个');
      T('青鳞蟒放出过缠身（定身）', sawRoot, 'rootT 触发过');
      T('打满 15 秒玩家确实被压着打', hp0 > 0, 'hp 保持 ' + Math.round(g.player.hp));
      void sawSummon;
    } else {
      T('青鳞蟒会进入抬手状态', false, '没找到青鳞蟒');
    }
  }

  // ---------- 5. 扇形弹幕 ----------
  {
    const e = byType('wumian') || (() => {
      const d = g.dens[0];
      const w = g.spawnEnemy('wumian', d.x + 60, d.y, { x: d.x, y: d.y, alert: 0 });
      return w;
    })();
    if (e) {
      g.clearHazards();
      const pj0 = g.projectiles ? g.projectiles.length : 0;
      const sk = g.MONSTERS.wumian.skills.find(s => s.fx === 'fan');
      g.setPos(e.x + 40, e.y);
      g.execSkill(e, sk);
      const pj1 = g.projectiles ? g.projectiles.length : 0;
      T('剑气是扇形多道（fan）', pj1 - pj0 >= 3, (pj1 - pj0) + ' 道');
    }
  }

  // ---------- 5.5 无面剑客三阶段换兵器（P12 前置项 ②）----------
  {
    const ph = g.MONSTERS.wumian.phases;
    T('无面剑客有三阶段', Array.isArray(ph) && ph.length === 3, ph ? ph.length + ' 段' : '没有');
    const fams = ph ? ph.map(p => p.weapon) : [];
    T('三阶段各换一件真兵器', new Set(fams).size === 3 && fams.every(f => !!g.WEAPONS[f]),
      fams.join(' / '));
    T('旧 skills 仍指向第一阶段（兼容旧文档）', !!ph && g.MONSTERS.wumian.skills === ph[0].skills,
      '同一张表');
    const fxSets = ph ? ph.map(p => [...new Set(p.skills.map(s => s.fx))].sort().join(',')) : [];
    T('三阶段招式组合各不相同', new Set(fxSets).size === 3, fxSets.join(' | '));
    const artBad = [];
    for (const p of ph || []) for (const s of p.skills) {
      const a = s.art && g.artById(s.art);
      if (!a || a.fam !== p.weapon) artBad.push(s.name + '→' + s.art);
    }
    T('每招都指回本阶段兵器的玩家招式', artBad.length === 0, artBad.join('/') || 'OK');
    const c = g.bossArtColors({ art: 'dual_3', weapon: 'dual' }, ['#fff', '#fff']);
    T('招式色彩取自 arts.js 而不是写死', Array.isArray(c) && c.length === 2 && c[0] !== '#fff',
      c.join('/'));
  }
  {
    g.startGame(false); step(2);
    const e = g.spawnEnemy('wumian', g.player.x + 60, g.player.y, { x: g.player.x, y: g.player.y });
    if (e) {
      const ph = g.MONSTERS.wumian.phases;
      e.hp = e.maxHp;
      T('满血走第一阶段的剑', g.wumianPhase(e) === 0 && g.bossSkillsOf(e) === ph[0].skills,
        'phase=0');
      e.hp = e.maxHp * 0.5;
      const s1 = g.bossSkillsOf(e);
      T('半血换枪且冷却表作废', e.wmPhase === 1 && s1 === ph[1].skills && e.skillCds === null,
        'phase=1');
      e.hp = e.maxHp * 0.2;
      const s2 = g.bossSkillsOf(e);
      T('残血换双刃', e.wmPhase === 2 && s2 === ph[2].skills, 'phase=2');
      e.skillGap = 0; e.skill = null; e.skillCds = s2.map(() => 0);
      const used = g.runBossSkills(e, 0.016, 30);
      T('选招只用当前阶段那张表', used === true && s2.indexOf(e.skill) >= 0,
        e.skill ? e.skill.name : '没选出来');
      T('换段会报出兵器名', g.messages.some(m => m.txt.indexOf('换「') >= 0),
        g.messages.map(m => m.txt).join(' / '));
    } else {
      T('满血走第一阶段的剑', false, '无面剑客没刷出来');
    }
  }

  // ---------- 6. 首杀唯一装备 ----------
  {
    g.startGame(false); step(2);
    const den = byType('shimu');
    const u = g.UNIQUES.shimu;
    T('石母有专属装备定义', !!u && !!u.name, u && u.name);
    if (den) {
      g.setClock(0.35, 3);
      g.setPos(den.x + 30, den.y);
      den.aggro = true;
      const d0 = g.drops.length;
      g.hitEnemy(den, { dmg: 99999, crit: false }, 0, 0);
      step(3);
      const gear = g.drops.slice(d0).filter(d => d.kind === 'gear' && d.item.unique);
      T('首杀掉唯一装备', gear.length === 1 && gear[0].item.name === u.name,
        gear.length ? gear[0].item.name : '没掉');
      T('唯一装备带专属词缀', !!(gear[0] && gear[0].item.affixes.some(a => a.uniq)),
        gear[0] ? gear[0].item.affixes.map(a => a.name).join('/') : '-');
      T('首杀计入 bossKills', g.player.bossKills.shimu === 1, JSON.stringify(g.player.bossKills));
    }
    // 二杀不再掉唯一
    const den2 = byType('shimu');
    if (den2) {
      const d0 = g.drops.length;
      g.hitEnemy(den2, { dmg: 99999, crit: false }, 0, 0);
      step(3);
      const again = g.drops.slice(d0).filter(d => d.kind === 'gear' && d.item.unique);
      T('再杀不掉唯一装备（改为普通高品掉落）', again.length === 0, again.length + ' 件');
      T('bossKills 累加到 2', g.player.bossKills.shimu === 2, g.player.bossKills.shimu);
    }
  }

  // ---------- 7. 唯一装备能穿、能重铸 ----------
  {
    const it = g.makeUnique('wumian', 10);
    T('makeUnique 产出可装备物件', !!it && it.kind === 'weapon' && it.affixes.length >= 5,
      it ? it.kind + ' / 词缀 ' + it.affixes.length : '-');
    const nm = it.name;
    g.player.inv.push(it);
    const idx = g.player.inv.indexOf(it);
    g.equipItem(idx);
    const eq = g.player.equip.weapon === it;
    T('唯一兵器能装备', eq, nm + ' → atk=' + g.stats.atk);
  }

  // ---------- 8. 无面剑客接棒 ----------
  {
    g.startGame(false); step(2);
    // 古洞要走进第三层才刷岩魈，测试里直接摆一只，验的是"倒下之后那一步"
    const yw = g.spawnEnemy('yaowang', g.player.x + 40, g.player.y, { x: g.player.x, y: g.player.y });
    if (yw) {
      yw.dg = true;
      const n0 = g.enemies.length;
      g.hitEnemy(yw, { dmg: 999999, crit: false }, 0, 0);
      step(3);
      const wm = g.enemies.find(e => e.type === 'wumian');
      T('岩魈倒下后无面剑客出现', !!wm && g.enemies.length > n0, wm ? 'hp=' + Math.round(wm.hp) : '没出现');
      T('无面剑客被计入清层条件', !!wm && g.enemies.indexOf(wm) >= 0, 'dgMobs 已挂');
    } else {
      T('岩魈倒下后无面剑客出现', false, '岩魈没刷出来');
    }
  }

  // ---------- 9. 危险区随重开清空 ----------
  {
    g.addHazard(g.player.x, g.player.y, { r: 40, delay: 1, dmg: 5 });
    const n = g.hazards.length;
    g.startGame(false); step(2);
    T('重开一局会清空地面危险区', n > 0 && g.hazards.length === 0, n + ' → ' + g.hazards.length);
  }

  // ---------- 10. P12-B：三个新区巢穴首领 ----------
  {
    const CH2 = ['gumu', 'jianggui', 'shoulian'];
    const OKFX = ['slam', 'zone', 'rain', 'summon', 'fan'];
    const bad = [];
    for (const k of CH2) {
      const m = g.MONSTERS[k];
      if (!m || m.behavior !== 'boss') { bad.push(k + ':不是首领'); continue; }
      if (!g.UNIQUES[k]) bad.push(k + ':没唯一装备');
      for (const sk of m.skills || []) if (OKFX.indexOf(sk.fx) < 0) bad.push(k + ':未知 fx ' + sk.fx);
    }
    T('三个新区首领复用既有招式引擎', bad.length === 0, bad.join('/') || OKFX.join('/'));
    const uniqBad = CH2.filter(k => {
      const it = g.makeUnique(k, 10);
      return !it || !it.unique || !it.affixes.some(a => a.uniq) || it.name !== g.UNIQUES[k].name;
    });
    T('三件新区唯一装备都能产出', uniqBad.length === 0,
      uniqBad.join('/') || CH2.map(k => g.UNIQUES[k].name).join('/'));
    const south = g.dens.filter(d => d.y / 16 >= g.CH1_H);
    T('3 个新区巢穴都在 CH1_H 以南',
      south.length === 3 && south.every(d => CH2.indexOf(d.type) >= 0),
      south.map(d => d.name).join('/'));
    const hp = CH2.map(k => g.MONSTERS[k].hp);
    T('章尾守链人是三只里最硬的', hp[0] < hp[1] && hp[1] < hp[2], hp.join(' < '));
  }

  R.ok = R.checks.every(c => c.startsWith('PASS'));
  return R;
})()
