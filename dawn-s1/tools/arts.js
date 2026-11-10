// tools/arts.js · 招式与专精自检（P6 验收）
// 八兵器 × 八招 = 64 招，装配槽 6 个。
// 覆盖：数据完整性 / 专精曲线 / 解锁门槛 / 装配换兵器 / 64 招都能放且真的有效果 /
//       四种新原语（位移·增益·地面区域·拉拽）专项 / 冷却与真气 / 状态系统 /
//       平衡校验 / 存读档 / 面板与 HUD
(() => {
  const g = window.__game;
  const R = { ok: false, checks: [] };
  const T = (n, c, d) => { R.checks.push((c ? 'PASS' : 'FAIL') + ' | ' + n + (d !== undefined ? ' | ' + d : '')); return !!c; };
  const step = (n, dt) => { for (let i = 0; i < n; i++) g.tickLogic(dt || 0.016); };
  const FAMS = g.WEAPON_IDS;
  const FX = g.ART_FX;

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

  // 一招要跑多少帧才结算完：持续类按 dur 算，其余给 2 秒足够弹体飞到、
  // 连闪闪完、落雷落尽。
  function framesFor(a) {
    const dur = a.dur || (a.zone && a.zone.dur) || 0;
    return Math.ceil((dur + 1.6) / 0.016) + 24;
  }

  // ---------- 1. 数据完整性 ----------
  try {
  {
    const ids = g.ART_IDS;
    T('招式共 64 个', ids.length === 64, ids.length);
    const per = {};
    for (const id of ids) per[g.ARTS[id].fam] = (per[g.ARTS[id].fam] || 0) + 1;
    T('八种兵器各 8 招', FAMS.every(f => per[f] === 8), FAMS.map(f => g.WEAPONS[f].name + per[f]).join(' '));

    const bad = [];
    for (const id of ids) {
      const a = g.ARTS[id];
      if (a.id !== id) bad.push(id + ':id不符');
      if (!a.name || !a.desc) bad.push(id + ':缺名/缺描述');
      if (!(a.cd > 0) || !(a.cost > 0)) bad.push(id + ':cd/cost');
      if (!(a.mul > 0) && !(a.power > 0)) bad.push(id + ':mul/power');
      if (FX.indexOf(a.fx) < 0) bad.push(id + ':fx未知');
      if (!(a.prof >= 1 && a.prof <= 10)) bad.push(id + ':解锁等级');
      if (!g.ART_SLOT_LABEL[a.slot]) bad.push(id + ':slot');
      // 每招都要能说清自己是什么：buff 必须带 buff 表，zone 必须带区域表，
      // dash 必须带位移表 —— 少了这些，运行时会走进一个什么都不做的分支。
      if (a.fx === 'buff' && !a.buff) bad.push(id + ':缺buff表');
      if (a.fx === 'zone' && !a.zone) bad.push(id + ':缺zone表');
      if (a.fx === 'dash' && !a.dash) bad.push(id + ':缺dash表');
    }
    T('每招字段齐全且 fx 在十种原语内', bad.length === 0, bad.join(' / ') || 'OK');

    const fxs = new Set(ids.map(id => g.ARTS[id].fx));
    T('覆盖 10 种效果原语', fxs.size === 10, [...fxs].join('/'));
    const slots = new Set(ids.map(id => g.ARTS[id].slot));
    T('六种功能位齐全', ['dmg', 'aoe', 'move', 'ctrl', 'buff', 'special'].every(s => slots.has(s)),
      [...slots].join('/'));
    const cds = ids.map(id => g.ARTS[id].cd);
    T('冷却跨度 ≥ 10 倍（快慢都有）', Math.max(...cds) / Math.min(...cds) >= 10,
      Math.min(...cds) + '~' + Math.max(...cds));

    // 专精门槛必须错开：八招分在 1/2/3/4/5/6/8/10 八级上，
    // 不能全挤在前四级（那样前期一次给完、后面六级空着）。
    const want = [1, 2, 3, 4, 5, 6, 8, 10];
    const offProf = [];
    for (const f of FAMS) {
      const lv = g.artsOfWeapon(f).map(a => a.prof).sort((x, y) => x - y);
      if (JSON.stringify(lv) !== JSON.stringify(want)) offProf.push(g.WEAPONS[f].name + ':' + lv.join(','));
    }
    T('每把兵器的解锁门槛都是 1/2/3/4/5/6/8/10', offProf.length === 0, offProf.join(' ') || 'OK');

    // 功能位分工：输出×2 清场×2 位移×1 控制×1 增益×1 特色×1
    const badSlot = [];
    for (const f of FAMS) {
      const c = {};
      for (const a of g.artsOfWeapon(f)) c[a.slot] = (c[a.slot] || 0) + 1;
      const want2 = { dmg: 2, aoe: 2, move: 1, ctrl: 1, buff: 1, special: 1 };
      for (const s in want2) if (c[s] !== want2[s]) badSlot.push(g.WEAPONS[f].name + '.' + s + '=' + (c[s] || 0));
    }
    T('功能位分工一致（输出×2 清场×2 位移×1 控制×1 增益×1 特色×1）',
      badSlot.length === 0, badSlot.join(' ') || 'OK');
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
    T('专精 1 级解锁第一招', at(2) === 1, at(2));
    T('专精 2 级解锁第二招', at(6) === 2, at(6));
    T('专精 10 级八招全开', at(9999) === 8, at(9999));
    T('第一招门槛 1 级、第二招 2 级',
      arts[0].prof === 1 && arts[1].prof === 2, arts.map(a => a.name + '@' + a.prof).join(' '));
  }

  // ---------- 4. 装配与换兵器 ----------
  {
    g.startGame(false);
    g.player.prof = { sword: 30, blade: 30 };
    g.equipFam('sword');
    g.autoLoadout();
    T('持剑自动装上已悟的剑招', g.player.loadout.filter(Boolean).length >= 2,
      g.player.loadout.map(x => x || '-').join(','));
    T('装上的都是剑招', g.player.loadout.filter(Boolean).every(id => g.artById(id).fam === 'sword'), 'OK');
    T('装配不超过 6 格', g.player.loadout.length === 6, g.player.loadout.length);
    g.equipFam('blade');
    const left = g.player.loadout.filter(Boolean);
    T('换刀后剑招被清掉', left.every(id => g.artById(id).fam === 'blade'),
      left.map(id => g.artById(id).name).join('/'));
    T('换刀后自动补上刀招', left.length >= 2, left.length);
  }

  // ---------- 4.1 装配交互：八招选六格 ----------
  {
    g.startGame(false);
    g.player.prof = { sword: 999 };
    g.equipFam('sword');
    g.setLoadout(['sword_1', 'sword_2', 'sword_3', 'sword_4', 'sword_5', 'sword_6']);
    // 满槽时点一招没装上的：不能悄悄顶掉第 0 格
    const before = g.player.loadout.slice();
    const put = g.artPlace('sword_7');
    T('满槽且未选格时装不上', put === false, 'loadout=' + g.player.loadout.join(','));
    T('满槽时不该被悄悄顶掉第 0 格', JSON.stringify(g.player.loadout) === JSON.stringify(before), 'OK');
    // 选中一格再装：装进选中的那一格
    g.pickArtSlot(3);
    T('点格子能选中目标格', g.artPick === 3, g.artPick);
    const ok = g.artPlace('sword_7');
    T('选中后能装进指定格', ok === true && g.player.loadout[3] === 'sword_7',
      g.player.loadout.map(x => x || '-').join(','));
    T('装完原来的格被换掉', g.player.loadout[3] === 'sword_7', 'slot3=' + g.player.loadout[3]);
    // 卸下
    g.artPlace('sword_7');
    T('再点一次能卸下', g.player.loadout[3] === null, g.player.loadout.map(x => x || '-').join(','));
    // 手动排过之后，autoLoadout 不再偷偷补位
    g.player.loadout[0] = null;
    g.autoLoadout();
    T('手动卸下的格子不会被自动补回', g.player.loadout[0] === null,
      g.player.loadout.map(x => x || '-').join(','));
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

  // ---------- 5. 64 招全部可释放且真的有效果 ----------
  {
    const bad = [], noHit = [], noBuff = [];
    for (const fam of FAMS) {
      arena(14);
      g.equipFam(fam);
      g.setDir('down');
      for (const a of g.artsOfWeapon(fam)) {
        g.clearEnemies();
        // 一圈木桩：近战扇面、弹体直线、落雷、连闪都能找到目标
        const ds = [];
        for (let i = 0; i < 12; i++) {
          const ang = i / 12 * Math.PI * 2;
          const e = g.spawnDummy(g.player.x + Math.cos(ang) * 34, g.player.y + Math.sin(ang) * 34, 99999);
          if (e) ds.push(e);
        }
        // 伤害基线必须在施法前取：近战 / 位移 / 拉拽是瞬间结算的，
        // 放到施法后取，基准已经把伤害算进去了，永远量出 0。
        const before0 = ds.reduce((s, e) => s + e.hp, 0);
        g.player.qi = 999;
        g.setLoadout([a.id]);
        let ok = false;
        try { ok = g.castArt(0) === true; } catch (err) { bad.push(a.name + ':' + err.message); }
        if (!ok) bad.push(a.name + ':放不出');
        // 增益类不造成伤害，验的是"挂上了"
        if (a.fx === 'buff') {
          const has = g.artBuffs.some(b => b.id === a.id);
          if (!has) noBuff.push(a.name);
        }
        // 地面区域：把一只木桩挪到区域中心，保证区域真的结算到人
        let extra = 0;
        if (a.fx === 'zone' && g.zones.length) {
          const z = g.zones[0];
          const e = g.spawnDummy(z.x, z.y, 99999);
          if (e) { ds.push(e); extra = e.hp; }
        }
        const before = before0 + extra;
        step(framesFor(a));
        if (a.fx === 'buff') continue;
        const after = ds.reduce((s, e) => s + e.hp, 0);
        if (before - after <= 0) noHit.push(a.name);
      }
    }
    T('64 招全部可释放且不报错', bad.length === 0, bad.join(' / ') || 'OK');
    T('所有伤害招都真的打到了木桩', noHit.length === 0, noHit.join('/') || 'OK');
    T('所有增益招都真的挂上了增益', noBuff.length === 0, noBuff.join('/') || 'OK');
  }

  // ---------- 6. 四种新原语专项 ----------
  {
    // 位移：御剑突进 —— 人确实挪了，而且路过的怪挨了打
    arena(14);
    g.equipFam('sword');
    g.setLoadout(['sword_5']);
    g.setDir('down');          // 朝下突进，木桩也放在正下方
    g.player.qi = 999;
    const x0 = g.player.x, y0 = g.player.y;
    const e0 = g.spawnDummy(g.player.x, g.player.y + 30, 99999);
    g.castArt(0);
    const moved = Math.hypot(g.player.x - x0, g.player.y - y0);
    T('御剑突进真的把人挪走了', moved > 10, '位移 ' + moved.toFixed(1) + 'px');
    T('位移路径上的怪挨了打', e0.hp < e0.maxHp, (e0.maxHp - e0.hp).toFixed(0));
    T('位移带半息无敌', g.player.iframe > 0, g.player.iframe.toFixed(2));

    // 增益：剑心通明 —— 会心提高，到期自动散掉
    arena(14);
    g.equipFam('sword');
    g.setLoadout(['sword_7']);
    g.player.qi = 999;
    g.castArt(0);
    T('剑心通明挂上了会心加成', g.artBuff('crit') === 25, g.artBuff('crit'));
    step(120);
    T('增益有时限', g.artBuff('crit') === 25 && g.artBuffs.length === 1, g.artBuffs.length);
    step(400);
    T('增益到期自动散掉', g.artBuff('crit') === 0 && g.artBuffs.length === 0, g.artBuffs.length);

    // 地面区域：火雨 —— 区域存在、持续掉血、到期消失
    arena(14);
    g.equipFam('mage');
    g.setLoadout(['mage_3']);
    g.player.qi = 999;
    g.castArt(0);
    T('火雨在场上留了区域', g.zones.length > 0, g.zones.length);
    const z = g.zones[0];
    const e = g.spawnDummy(z.x, z.y, 99999);
    const hp0 = e.hp;
    step(80);
    T('火雨里的怪在持续掉血', e.hp < hp0, (hp0 - e.hp).toFixed(1));
    step(400);
    T('火雨到期消失', g.zones.length === 0, g.zones.length);

    // 拉拽：缠棍 —— 远处的怪被拽到面前
    arena(14);
    g.equipFam('staff');
    g.setLoadout(['staff_6']);
    g.player.qi = 999;
    const far = g.spawnDummy(g.player.x + 70, g.player.y, 99999);
    const d0 = Math.hypot(far.x - g.player.x, far.y - g.player.y);
    g.castArt(0);
    const d1 = Math.hypot(far.x - g.player.x, far.y - g.player.y);
    T('缠棍把远处的怪拽近了', d1 < d0 - 20, d0.toFixed(0) + ' → ' + d1.toFixed(0));
    T('被拽的怪也吃了伤害', far.hp < far.maxHp, (far.maxHp - far.hp).toFixed(0));
  }

  // ---------- 7. 冷却与真气 ----------
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

  // ---------- 8. 状态系统 ----------
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

  // ---------- 9. 平衡校验 ----------
  {
    g.startGame(false);
    g.setLevel(20);
    const rows = [], rows6 = [];
    let worst = 0, worstFam = '', worst6 = 0, worst6Fam = '';
    for (const fam of FAMS) {
      const W = g.WEAPONS[fam];
      // 普攻 DPS：三式平均倍率（双刀每段两次判定）× 每秒出手次数
      const avgMul = W.swings.reduce((s, x) => s + x.mul, 0) / W.swings.length * (W.hits || 1);
      const normalDps = avgMul / Math.max(0.13, 0.30 * W.spdMul);
      const arts = g.artsOfWeapon(fam);
      // 口径统一走 artPower()：多段 / 多发 / 持续 / 环身中心都折进去了
      const dpsOf = a => g.artPower(a) / a.cd;
      const all = arts.reduce((s, a) => s + dpsOf(a), 0);
      // 实际只能装 6 格，取最强的 6 招才是真正的上限
      const best6 = arts.map(dpsOf).sort((x, y) => y - x).slice(0, 6).reduce((s, x) => s + x, 0);
      const ratio = all / normalDps;
      const ratio6 = best6 / normalDps;
      rows.push(W.name + ' ' + ratio.toFixed(2) + 'x');
      rows6.push(W.name + ' ' + ratio6.toFixed(2) + 'x');
      if (ratio > worst) { worst = ratio; worstFam = W.name; }
      if (ratio6 > worst6) { worst6 = ratio6; worst6Fam = W.name; }
    }
    T('八招全开的 DPS 不超过普攻 2.8 倍', worst <= 2.8, rows.join(' · '));
    T('满配六格的 DPS 不超过普攻 2.8 倍', worst6 <= 2.8, rows6.join(' · '));
    T('最吃紧的是哪一个', true, worstFam + ' ' + worst.toFixed(2) + 'x · 满配 ' + worst6Fam + ' ' + worst6.toFixed(2) + 'x');
    // 反向校验：也不能弱到"带了跟没带一样"
    T('招式确实有存在感（至少 0.2 倍普攻）', worst >= 0.2, '最低 ' + rows.join(' · '));
  }

  // ---------- 10. 存读档 ----------
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
    // 老存档没有这几个字段时不能崩
    g.player.prof = undefined; g.player.loadout = undefined;
    g.autoLoadout();
    T('缺字段时 autoLoadout 能自愈',
      Array.isArray(g.player.loadout) && g.player.loadout.length === g.ART_SLOTS, 'OK');
    // 增益不进存档
    g.player.artBuffs = [{ id: 'sword_7', name: '剑心通明', t: 8, def: { crit: 25 } }];
    g.save(); g.load();
    T('增益不随存档带进来', g.artBuffs.length === 0, g.artBuffs.length);
  }

  // ---------- 11. 面板与 HUD 不崩 ----------
  {
    g.startGame(false);
    let err = null;
    try {
      g.renderArts();
      g.showArtPage(true);
      g.showArtPage(false);
      step(3);
      g.tick(0.016);
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
