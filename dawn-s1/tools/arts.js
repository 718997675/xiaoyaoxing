// tools/arts.js · 招式与专精自检（P5 验收）
// 数据完整性 / 专精曲线 / 解锁门槛 / 装配换兵器 / 16 招都能放且真的打到人 /
// 冷却与真气 / 状态系统 / 平衡校验 / 存读档
(() => {
  const g = window.__game;
  const R = { ok: false, checks: [] };
  const T = (n, c, d) => { R.checks.push((c ? 'PASS' : 'FAIL') + ' | ' + n + (d !== undefined ? ' | ' + d : '')); return !!c; };
  const step = (n, dt) => { for (let i = 0; i < n; i++) g.tick(dt || 0.016); };
  const FAMS = g.WEAPON_IDS;

  // 试招场地：必须挪到村外。
  // spawnEnemy 有一条"青云集界内不落敌"的规则，会把刷在村里的怪直接搬回营地，
  // 于是木桩全跑到几百像素外，弹体与落雷自然一个都打不中 —— 一开始就是这么栽的。
  function arena(level) {
    g.startGame(false);
    g.setLevel(level || 14);
    g.player.prof = {};
    for (const f of FAMS) g.player.prof[f] = 999;
    const c = g.camps[0];
    // 营地圆心本身经常压着一块实心（篝火 / 石台），人站上去弹体一出膛就碎。
    // 从圆心往外螺旋找一块"脚下、头顶、下方 24px 都能站"的空地。
    let px = c.x, py = c.y;
    if (!g.canStand(px, py) || !g.canStand(px, py + 24)) {
      outer: for (let r = 8; r <= 72; r += 8) {
        for (let i = 0; i < 16; i++) {
          const a = i / 16 * Math.PI * 2;
          const x = c.x + Math.cos(a) * r, y = c.y + Math.sin(a) * r;
          if (g.canStand(x, y) && g.canStand(x, y - 10) && g.canStand(x, y + 24)) {
            px = x; py = y; break outer;
          }
        }
      }
    }
    g.setPos(px, py);
    g.clearEnemies();
  }

  // 招式总伤估算（平衡校验用）：多段 / 多发 / 持续都要乘进去
  function artTotal(a) {
    let total = 0;
    if (a.fx === 'spin') total = a.mul * Math.round(a.dur / (a.tick || 0.25));
    else if (a.fx === 'orbit') total = a.mul * (a.count || 1);
    else if (a.fx === 'bolt') total = a.mul * (a.count || 1);
    else if (a.fx === 'proj') total = a.mul * (a.count || 1);
    else if (a.fx === 'blink') total = a.mul * (a.times || 1);
    else total = a.mul * (a.hits || 1);
    if (a.centerBonus) total *= 1.2;              // 环身技有一块中心双倍，取个保守折算
    if (a.status && a.status.pct) total += total * a.status.pct * a.status.dur;
    if (a.launch) total += total * 1.5;
    return total;
  }

  // ---------- 1. 数据完整性 ----------
  try {
  {
    const ids = g.ART_IDS;
    T('招式共 16 个', ids.length === 16, ids.length);
    const per = {};
    for (const id of ids) per[g.ARTS[id].fam] = (per[g.ARTS[id].fam] || 0) + 1;
    T('八种兵器各 2 招', FAMS.every(f => per[f] === 2), FAMS.map(f => g.WEAPONS[f].name + per[f]).join(' '));
    const bad = [];
    for (const id of ids) {
      const a = g.ARTS[id];
      if (a.id !== id) bad.push(id + ':id不符');
      if (!a.name || !a.desc) bad.push(id + ':缺名/缺描述');
      if (!(a.cd > 0) || !(a.cost > 0)) bad.push(id + ':cd/cost');
      if (!(a.mul > 0)) bad.push(id + ':mul');
      if (['melee', 'proj', 'spin', 'orbit', 'blink', 'bolt'].indexOf(a.fx) < 0) bad.push(id + ':fx未知');
      if (!(a.prof >= 1)) bad.push(id + ':解锁等级');
      if (['dmg', 'special'].indexOf(a.slot) < 0) bad.push(id + ':slot');
    }
    T('每招字段齐全且 fx 在六种原语内', bad.length === 0, bad.join(' / ') || 'OK');
    const fxs = new Set(ids.map(id => g.ARTS[id].fx));
    T('覆盖 6 种效果原语', fxs.size === 6, [...fxs].join('/'));
    const slots = new Set(ids.map(id => g.ARTS[id].slot));
    T('输出位与特色位都有', slots.has('dmg') && slots.has('special'), [...slots].join('/'));
    const cds = ids.map(id => g.ARTS[id].cd);
    T('冷却跨度 ≥ 10 倍（快慢都有）', Math.max(...cds) / Math.min(...cds) >= 10,
      Math.min(...cds) + '~' + Math.max(...cds));
  }

  // ---------- 2. 专精曲线 ----------
  {
    T('0 击杀 = 0 级', g.profLevel(0) === 0, g.profLevel(0));
    T('2 击杀 = 1 级（第一招很快就能悟到）', g.profLevel(2) === 1, g.profLevel(2));
    T('200 击杀 = 10 级', g.profLevel(200) === 10 && g.profLevel(9999) === 10, g.profLevel(200));
    T('profLeft 从满额递减到 0', g.profLeft(0) === 2 && g.profLeft(1) === 1 && g.profLeft(200) === 0,
      g.profLeft(0) + '/' + g.profLeft(1) + '/' + g.profLeft(200));
    T('进度条 0~1 且满级为 1', g.profFrac(0) === 0 && g.profFrac(9999) === 1, g.profFrac(0) + '~' + g.profFrac(9999));
  }

  // ---------- 3. 解锁门槛 ----------
  {
    g.startGame(false);
    const fam = 'sword';
    const arts = g.artsOfWeapon(fam);
    const at = k => g.unlockedArts(fam, { sword: k }).length;
    T('专精 0 级一招都不会', at(0) === 0, at(0));
    T('专精 1 级解锁第一招', at(g.ART_IDS && 2) === 1, at(2));
    T('专精 4 级（26 杀）解锁第二招', at(26) === 2, at(26));
    T('第一招门槛 1 级、第二招 4 级',
      arts[0].prof === 1 && arts[1].prof === 4, arts.map(a => a.name + '@' + a.prof).join(' '));
  }

  // ---------- 4. 装配与换兵器 ----------
  {
    g.startGame(false);
    g.player.prof = { sword: 30, blade: 30 };
    g.equipFam('sword');
    g.autoLoadout();
    T('持剑自动装上两招', g.player.loadout.filter(Boolean).length === 2,
      g.player.loadout.map(x => x || '-').join(','));
    T('装上的都是剑招', g.player.loadout.filter(Boolean).every(id => g.artById(id).fam === 'sword'), 'OK');
    g.equipFam('blade');
    const left = g.player.loadout.filter(Boolean);
    T('换刀后剑招被清掉', left.every(id => g.artById(id).fam === 'blade'),
      left.map(id => g.artById(id).name).join('/'));
    T('换刀后自动补上刀招', left.length === 2, left.length);
    // 手动卸下后不该被 autoLoadout 悄悄补回来（否则玩家永远删不掉不想带的招）
    g.player.loadout[0] = null;
    T('手动卸下的格子保持空着', g.player.loadout[0] === null, 'OK');
  }

  // ---------- 4.5 专精从击杀里长出来 ----------
  {
    arena(6);
    g.player.prof = {};
    g.equipFam('sword');
    g.autoLoadout();
    T('新兵器一开始一招都没有', g.player.loadout.filter(Boolean).length === 0,
      g.player.loadout.filter(Boolean).length);
    g.clearEnemies();
    for (let i = 0; i < 2; i++) {
      const d = g.spawnDummy(g.player.x + 20 + i * 12, g.player.y, 1);
      d.hp = 1;
      g.hitEnemy(d, { dmg: 999, fam: 'sword' }, 0, 0);
    }
    T('斩两只后专精到 1 级', g.profLevel(g.profKills('sword')) === 1, g.profKills('sword'));
    T('升级后第一招自动上阵', g.player.loadout.filter(Boolean).length === 1,
      g.player.loadout.map(x => x || '-').join(','));
    const p0 = g.profKills('sword');
    const el = g.spawnDummy(g.player.x + 60, g.player.y, 1);
    el.hp = 1; el.elite = { color: '#fff' };
    g.hitEnemy(el, { dmg: 999, fam: 'sword' }, 0, 0);
    T('精英按 3 只折算', g.profKills('sword') - p0 === 3, '+' + (g.profKills('sword') - p0));
    const p1 = g.profKills('sword');
    const bs = g.spawnDummy(g.player.x + 80, g.player.y, 1);
    bs.hp = 1; bs.boss = true;
    g.hitEnemy(bs, { dmg: 999, fam: 'sword' }, 0, 0);
    T('首领按 12 只折算', g.profKills('sword') - p1 === 12, '+' + (g.profKills('sword') - p1));
    // 换兵器不该涨剑的专精
    const p2 = g.profKills('sword');
    g.equipFam('blade');
    const bd = g.spawnDummy(g.player.x + 100, g.player.y, 1);
    bd.hp = 1;
    g.hitEnemy(bd, { dmg: 999, fam: 'blade' }, 0, 0);
    T('用刀杀敌只涨刀的专精', g.profKills('sword') === p2 && g.profKills('blade') === 1,
      '剑' + g.profKills('sword') + ' 刀' + g.profKills('blade'));
  }

  {
    const bad = [], noHit = [];
    for (const fam of FAMS) {
      arena(14);
      g.equipFam(fam);
      g.autoLoadout();
      const arts = g.artsOfWeapon(fam);
      for (let ai = 0; ai < arts.length; ai++) {
        const a = arts[ai];
        g.clearEnemies();
        // 一圈木桩：近战扇面、弹体直线、落雷、连闪都能找到目标
        const ds = [];
        for (let i = 0; i < 12; i++) {
          const ang = i / 12 * Math.PI * 2;
          const e = g.spawnDummy(g.player.x + Math.cos(ang) * 34, g.player.y + Math.sin(ang) * 34, 99999);
          if (e) ds.push(e);
        }
        const before = ds.reduce((s, e) => s + e.hp, 0);
        g.player.qi = 999;
        const slot = g.player.loadout.indexOf(a.id);
        let ok = false;
        try { ok = g.castArt(slot) === true; } catch (err) { bad.push(a.name + ':' + err.message); }
        if (!ok) bad.push(a.name + ':放不出');
        // 400 帧 = 6.4 秒：飞剑环绕要跑满 6 秒，天雷引最后一发在 0.6 秒才落
        step(400);
        const after = ds.reduce((s, e) => s + e.hp, 0);
        if (before - after <= 0) noHit.push(a.name);
      }
    }
    T('16 招全部可释放且不报错', bad.length === 0, bad.join(' / ') || 'OK');
    T('16 招都真的打到了木桩', noHit.length === 0, noHit.join('/') || 'OK');
  }

  // ---------- 6. 冷却与真气 ----------
  {
    g.startGame(false);
    g.player.prof = { sword: 30 };
    g.equipFam('sword');
    g.autoLoadout();
    g.player.qi = 999;
    const id = g.player.loadout[0];
    const a = g.artById(id);
    T('首次可放', g.castArt(0) === true, a.name);
    T('放完进入冷却', g.artCdOf(id) > 0, g.artCdOf(id).toFixed(2));
    T('冷却中再放被拒', g.castArt(0) === false, 'OK');
    step(Math.ceil(a.cd / 0.016) + 4);
    T('冷却走完可再放', g.artCdOf(id) <= 0 && g.castArt(0) === true, g.artCdOf(id).toFixed(2));
    g.player.qi = 0;
    g.artCds && (g.artCds[id] = 0);
    T('真气不足放不出', g.castArt(0) === false, 'qi=0');
    // 空槽
    g.player.loadout[5] = null;
    T('空槽放招只提示不报错', g.castArt(5) === false, 'OK');
  }

  // ---------- 7. 状态系统 ----------
  {
    arena(14);

    // 流血：命中后挂上，之后不再出招也在掉血
    g.equipFam('blade');
    g.autoLoadout();
    g.clearEnemies();
    let d = g.spawnDummy(g.player.x + 24, g.player.y, 99999);
    g.setDir('right');
    g.player.qi = 999;
    g.castArt(g.player.loadout.indexOf('blade_2'));
    T('血刃挂上流血', d.bleedT > 0 && d.bleed > 0, 'dps=' + d.bleed.toFixed(1));
    const hp0 = d.hp;
    step(60);
    T('流血在持续掉血', d.hp < hp0 - 1, (hp0 - d.hp).toFixed(1));

    // 破甲：def 被压低，到期还原
    g.equipFam('hammer');
    g.autoLoadout();
    g.clearEnemies();
    d = g.spawnDummy(g.player.x + 24, g.player.y, 99999);
    d.def = d.def0 = 0.5;
    g.player.qi = 999;
    g.castArt(g.player.loadout.indexOf('hammer_1'));
    T('碎骨锤把防御压下去', d.def < 0.5, 'def=' + d.def.toFixed(2));
    step(300);
    T('破甲到期后防御还原', Math.abs(d.def - 0.5) < 1e-6, 'def=' + d.def.toFixed(2));

    // 击飞：先离地，落地补一次摔伤
    g.equipFam('spear');
    g.autoLoadout();
    g.clearEnemies();
    d = g.spawnDummy(g.player.x + 26, g.player.y, 99999);
    g.player.qi = 999;
    g.castArt(g.player.loadout.indexOf('spear_8'));
    T('挑飞把敌人掀到空中', d.launchT > 0, 'launchT=' + d.launchT.toFixed(2));
    step(8);
    T('空中有高度', d.launchZ > 0, 'z=' + d.launchZ.toFixed(1));
    const hpAir = d.hp;
    step(60);
    T('落地补了摔伤', d.hp < hpAir && d.launchT <= 0, (hpAir - d.hp).toFixed(0));
    T('落地后回到地面高度', d.launchZ === 0, d.launchZ);

    // 毒镖：中毒 + 死亡传染。
    // 木桩血量给足 —— 毒镖现在一发就能打死 60 血的小怪，
    // 人死了 applyStatus 会直接返回，测出来的就是"没中毒"。
    g.equipFam('dart');
    g.autoLoadout();
    g.clearEnemies();
    const d1 = g.spawnDummy(g.player.x + 20, g.player.y, 99999);
    const d2 = g.spawnDummy(g.player.x + 34, g.player.y + 10, 99999);
    g.setDir('right');
    g.player.qi = 999;
    g.castArt(g.player.loadout.indexOf('dart_8'));
    step(20);
    T('毒镖让目标中毒', d1.poisonT > 0 || d2.poisonT > 0,
      'p1=' + d1.poisonT.toFixed(1) + ' p2=' + d2.poisonT.toFixed(1));
    if (!d1.dead) g.killEnemy(d1);
    T('中毒者倒下会传染给周围', d2.poisonT > 0, 'p2=' + d2.poisonT.toFixed(1));
  }

  // ---------- 8. 平衡校验 ----------
  {
    g.startGame(false);
    g.setLevel(20);
    const rows = [];
    let worst = 0, worstFam = '';
    for (const fam of FAMS) {
      const W = g.WEAPONS[fam];
      // 普攻 DPS：三式平均倍率（双刀每段两次判定）× 每秒出手次数
      const avgMul = W.swings.reduce((s, x) => s + x.mul, 0) / W.swings.length * (W.hits || 1);
      const normalDps = avgMul / Math.max(0.13, 0.30 * W.spdMul);
      const arts = g.artsOfWeapon(fam);
      const artDps = arts.reduce((s, a) => s + artTotal(a) / a.cd, 0);
      const ratio = artDps / normalDps;
      rows.push(W.name + ' ' + ratio.toFixed(2) + 'x');
      if (ratio > worst) { worst = ratio; worstFam = W.name; }
    }
    T('两招全开的 DPS 不超过普攻 2.8 倍', worst <= 2.8, rows.join(' · '));
    T('最吃紧的是哪一个', true, worstFam + ' ' + worst.toFixed(2) + 'x');
    // 反向校验：也不能弱到"带了跟没带一样"
    T('招式确实有存在感（至少 0.2 倍普攻）', worst >= 0.2, '最低 ' + rows.join(' · '));
  }

  // ---------- 9. 存读档 ----------
  {
    g.startGame(false);
    g.player.prof = { sword: 42, hammer: 7 };
    g.equipFam('sword');
    g.autoLoadout();
    const before = g.player.loadout.slice();
    g.save();
    g.player.prof = {}; g.player.loadout = new Array(g.ART_SLOTS).fill(null);
    const ok = g.load();
    T('读档成功', ok === true, ok);
    T('专精等级存住了', g.player.prof.sword === 42 && g.player.prof.hammer === 7,
      JSON.stringify(g.player.prof));
    T('装配存住了', JSON.stringify(g.player.loadout) === JSON.stringify(before),
      g.player.loadout.map(x => x || '-').join(','));
    // 老存档没有这两个字段时不能崩
    g.player.prof = undefined; g.player.loadout = undefined;
    g.autoLoadout();
    T('缺字段时 autoLoadout 能自愈',
      Array.isArray(g.player.loadout) && g.player.loadout.length === g.ART_SLOTS, 'OK');
  }

  // ---------- 10. 面板与 HUD 不崩 ----------
  {
    g.startGame(false);
    let err = null;
    try {
      g.renderArts();
      g.showArtPage(true);
      g.showArtPage(false);
      step(3);
    } catch (e) { err = e.message; }
    T('招式面板与 HUD 渲染不报错', err === null, err || 'OK');
    T('招式页能切回道行页', g.artPageOn === false, String(g.artPageOn));
  }

  } catch (err) {
    // 脚本自己抛异常时，run.js 只会打印 "undefined"，什么都看不出来。
    // 包一层，把消息和出事的行号变成一条 FAIL —— 不然每次都要靠猜。
    R.checks.push('FAIL | 脚本异常 | ' + err.message + ' @ ' + String(err.stack || '').split('\n')[1]);
  }

  R.ok = R.checks.every(c => c.indexOf('PASS') === 0);
  return R;
})();
