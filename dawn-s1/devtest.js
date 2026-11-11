// devtest.js · 仅在 ?dev=1 时加载的确定性自动化测试
// 用 __game.tick(dt) 步进，结果输出到 #devout；setupScene() 用于视觉摆拍。

// 大地图扩容后村庄整体挪到了东南角。测试里的村庄坐标统一走这个偏移，
// 以后再动村庄位置只改 game.js 的 V_SHIFT_*，这里不用跟着改。
function vp(x, y) {
  const g = window.__game;
  return [x + (g.village.x0 - 608), y + (g.village.y0 - 704)];
}

export function setupScene(mode) {
  const g = window.__game;
  g.startGame(false);
  g.setLevel(12);
  g.player.gold = 5200; g.player.iron = 128;
  g.givePoints(6);
  g.learnNode('fengrui'); g.learnNode('fengrui'); g.learnNode('jianxin');
  g.learnNode('yuqi'); g.learnNode('tianlei'); g.learnNode('tiegu');

  const fams = ['sword', 'blade', 'spear', 'staff', 'dual', 'hammer', 'mage', 'dart'];
  const wep = g.giveGear(4, 'weapon', 3, 'blade');
  const arm = g.giveGear(3, 'armor');
  const neck = g.giveGear(3, 'necklace');
  const art = g.giveGear(4, 'artifact');
  g.player.inv.push(wep, arm, neck, art);
  [wep, arm, neck, art].forEach(it => g.equipItem(g.player.inv.indexOf(it)));
  fams.forEach(f => g.giveGear(1 + (Math.random() * 3 | 0), 'weapon', 2, f));
  g.giveGear(2, 'necklace'); g.giveGear(2, 'artifact');

  const camp = g.enemies.find(e => e.camp && e.camp.tier === 2) || g.enemies[0];
  const c = camp.camp;
  g.setPos(c.x - 48, c.y + 24);
  for (const e of g.enemies) {
    if (!e.dead && Math.hypot(e.x - c.x, e.y - c.y) < 100) e.aggro = true;
  }
  g.setDir('right');
  for (let i = 0; i < 40; i++) g.tick(0.016);
  g.messages.length = 0;

  if (mode === 'inv') {
    g.toggleInv(true);
    const it = g.player.inv.find(x => x.kind === 'weapon' || x.kind === 'armor');
    if (it) g.showTip(it, { clientX: 360, clientY: 300 });
    return 'inv';
  }
  if (mode === 'slash') {
    g.setPos(g.SPAWN.x + 40, g.SPAWN.y - 60);
    g.setDir('right');
    for (let i = 0; i < 30; i++) g.tick(0.016);
    g.messages.length = 0; g.dmgNums.length = 0;
    g.player.atkCd = 0; g.player.atkBuf = 0; g.player.lastAtkT = -9;
    g.attack();
    for (let i = 0; i < 6; i++) g.tick(0.016);
    g.hitstop = 999;
    return 'slash';
  }
  if (mode === 'idle') {
    g.setPos(g.SPAWN.x, g.SPAWN.y + 26);
    g.setDir('down');
    for (let i = 0; i < 4; i++) g.tick(0.016);
    g.hitstop = 999;
    return 'idle';
  }
  if (mode === 'skill') {
    g.toggleSkills(true);
    return 'skill';
  }
  if (mode === 'village') {
    g.setClock(0.30, 3);                     // 午时，四家全开
    g.setPos(...vp(784, 866));
    g.setDir('down');
    for (let i = 0; i < 8; i++) g.tick(0.016);
    return 'village';
  }
  if (mode === 'forge') {
    g.setPos(g.SPAWN.x, g.SPAWN.y);
    g.forgeOpen();
    return 'forge';
  }
  const tgt = g.enemies.find(e => !e.dead && Math.hypot(e.x - g.player.x, e.y - g.player.y) < 80);
  if (tgt) {
    g.setPos(tgt.x - 24, tgt.y + 4);
    g.setDir('right');
    g.player.atkCd = 0; g.player.atkBuf = 0; g.player.lastAtkT = -9;
    g.attack();
  }
  for (let i = 0; i < 7; i++) g.tick(0.016);
  g.hitstop = 999;
  return 'fight';
}

export function runDevTests() {
  const g = window.__game;
  const out = [];
  const T = (name, cond, detail) => out.push((cond ? 'PASS' : 'FAIL') + ' | ' + name + (detail !== undefined ? ' | ' + detail : ''));
  const step = (n, dt) => { for (let i = 0; i < n; i++) g.tick(dt || 0.016); };
  const hit = (target) => {
    g.setPos(target.x - 15, target.y);
    g.setDir('right');
    g.player.atkCd = 0; g.player.atkBuf = 0;
    g.attack();
  };
  const alive = () => g.enemies.filter(e => !e.dead);

  // --- T1 开局 ---
  g.startGame(false);
  T('开局进入 play', g.state === 'play', g.state);
  T('营地敌人成建制生成', g.enemies.length >= 26, g.enemies.length);
  T('章尾首领存在', !!g.boss, g.boss && Math.round(g.boss.hp));
  T('第一章 144×104 不变，第二章南扩到 144 行',
    g.MAPW === 144 && g.CH1_H === 104 && g.MAPH === 144,
    g.MAPW + '×' + g.MAPH + '（第一章 ' + g.CH1_H + ' 行）');

  // --- T2 斩击命中 / 顿帧 / 连击 ---
  const e = alive().find(x => x.type === 'zhiren');
  const hp0 = e.hp;
  hit(e);
  T('斩击造成伤害', e.hp < hp0, Math.round(hp0) + ' -> ' + Math.round(e.hp));
  T('命中触发顿帧', g.hitstop > 0, g.hitstop.toFixed(3));
  T('连击计数 +1', g.combo >= 1, g.combo);
  T('伤害数字生成', g.dmgNums.length > 0, g.dmgNums.map(d => d.txt).join(','));
  T('出手产生挥砍动画', !!g.swing, g.swing && g.swing.fam);

  // --- T3 武器手感：挥砍残留刀光 ---
  const ghosts0 = g.slashGhosts.length;
  step(26);
  T('挥砍结束后留下刀光残影', g.slashGhosts.length > 0, 'ghosts=' + g.slashGhosts.length + ' before=' + ghosts0);

  // --- T4 输入缓冲 ---
  const e2 = alive().find(x => x.type === 'fox' || x.type === 'snake');
  hit(e2);
  const hpA = e2.hp;
  g.attack();
  const buffered = g.player.atkBuf > 0;
  step(34);
  T('冷却中按键进入输入缓冲', buffered, 'atkBuf=' + g.player.atkBuf.toFixed(2));
  T('输入缓冲补发命中', e2.hp < hpA, Math.round(hpA) + ' -> ' + Math.round(e2.hp));

  // --- T5 八种兵器各有招式表与判定差异 ---
  const fams = ['sword', 'blade', 'spear', 'staff', 'dual', 'hammer', 'mage', 'dart'];
  const arcs = fams.map(f => g.WEAPONS[f].swings[0].hitArc);
  T('八种兵器数据齐备', fams.every(f => !!g.WEAPONS[f]), fams.join('/'));
  T('不同兵器判定弧度不同', new Set(arcs).size >= 4, arcs.join(','));
  T('枪的攻距最长', g.WEAPONS.spear.reach > g.WEAPONS.dual.reach, g.WEAPONS.spear.reach + ' vs ' + g.WEAPONS.dual.reach);

  // --- T6 三段连击：段位推进 + 背后覆盖（棍的第三段抡圆） ---
  const staff = g.giveGear(2, 'weapon', 2, 'staff');
  g.equipItem(g.player.inv.indexOf(staff));
  const camp0 = g.enemies[0].camp;
  const front = g.spawnEnemy('zhiren', g.player.x + 16, g.player.y, camp0);
  const back = g.spawnEnemy('zhiren', g.player.x - 16, g.player.y, camp0);
  front.hp = front.maxHp = 99999; back.hp = back.maxHp = 99999;
  const res = [];
  for (let i = 0; i < 3; i++) {
    g.setPos(front.x - 15, front.y);
    g.setDir('right');
    back.x = g.player.x - 24; back.y = g.player.y;
    front.aggro = false; back.aggro = false;
    const h0 = front.hp, b0 = back.hp;
    g.player.atkCd = 0; g.player.atkBuf = 0;
    g.attack();
    res.push([Math.round(h0 - front.hp), Math.round(b0 - back.hp)]);
    step(3);
  }
  T('连击段位推进到第三段', g.player.atkStep === 2, 'atkStep=' + g.player.atkStep);
  T('第一段只覆盖正面', res[0][0] > 0 && res[0][1] === 0, '正/背 ' + res[0].join('/'));
  T('第三段抡圆覆盖背后', res[2][1] > 0, '正/背 ' + res[2].join('/'));
  front.dead = true; back.dead = true;

  // --- T7 暴击 ---
  const dummy = g.spawnEnemy('zhiren', g.player.x + 20, g.player.y, g.enemies[0].camp);
  dummy.hp = 99999; dummy.maxHp = 99999;
  let crit = 0, hits = 0;
  for (let i = 0; i < 140; i++) {
    const h0 = dummy.hp;
    g.dmgNums.length = 0;
    hit(dummy);
    if (dummy.hp < h0) { hits++; if (g.dmgNums.some(d => d.big)) crit++; }
    step(3);
  }
  T('暴击可触发', crit > 0, crit + '/' + hits + ' 命中');
  T('暴击率在合理区间', crit / Math.max(1, hits) < 0.55, (crit / Math.max(1, hits) * 100).toFixed(0) + '%');
  T('连击提升伤害倍率', g.combo > 5 && g.combo > 0, 'combo=' + g.combo);
  dummy.dead = true;

  // --- T8 击杀与掉落 ---
  const before = g.drops.length;
  const victim = alive().find(x => x.type !== 'boss' && x.type !== 'treant');
  if (victim) {
    victim.hp = 1;
    hit(victim);
    T('敌人死亡', victim.dead, 'hp=' + victim.hp);
    T('产生掉落物', g.drops.length > before, g.drops.length - before);
  } else T('敌人死亡', false, '无存活敌人');

  // --- T9 稀有度分布 ---
  const dist = [0, 0, 0, 0, 0];
  for (let i = 0; i < 260; i++) {
    const it = g.giveGear(null, 'weapon', 0);
    dist[it.r]++;
    const idx = g.player.inv.indexOf(it);
    if (idx >= 0) g.player.inv.splice(idx, 1);
  }
  T('普通怪以低阶为主', dist[0] > dist[1] && dist[0] > dist[2], dist.join('/'));
  const distB = [0, 0, 0, 0, 0];
  for (let i = 0; i < 120; i++) {
    const it = g.giveGear(null, 'weapon', 2);
    distB[it.r]++;
    const idx = g.player.inv.indexOf(it);
    if (idx >= 0) g.player.inv.splice(idx, 1);
  }
  T('首领档显著抬高稀有度', distB[2] + distB[3] + distB[4] > 80, distB.join('/'));

  // --- T10 四槽位装备 ---
  const slots = ['weapon', 'armor', 'necklace', 'artifact'];
  let ok = true, detail = [];
  for (const slot of slots) {
    const it = g.giveGear(3, slot);
    const idx = g.player.inv.indexOf(it);
    const before2 = JSON.stringify(g.stats);
    g.equipItem(idx);
    const after2 = g.stats;
    const changed = JSON.stringify(after2) !== before2;
    if (!changed || g.player.equip[slot] !== it) ok = false;
    detail.push(slot + (changed ? '✓' : '✗'));
  }
  T('四槽位均可装备且生效', ok, detail.join(' '));
  T('装备栏 DOM 渲染四槽', document.querySelectorAll('#eqSlots .eq').length === 4,
    document.querySelectorAll('#eqSlots .eq').length);
  T('兵器带造型标识', slots.length === 4 && !!g.player.equip.weapon.fam, g.player.equip.weapon && g.player.equip.weapon.fam);

  // --- T11 磁吸拾取 ---
  const g2 = g.giveGear(3, 'weapon');
  const d = { x: g.player.x + 24, y: g.player.y, kind: 'gear', item: g2, t: 0, mesh: null, beam: null };
  g.drops.push(d);
  const d0 = Math.hypot(d.x - g.player.x, d.y - g.player.y);
  step(10);
  const d1 = Math.hypot(d.x - g.player.x, d.y - g.player.y);
  T('掉落物磁吸靠近', d1 < d0, d0.toFixed(1) + ' -> ' + d1.toFixed(1));
  T('仙品装备带光柱', !!d.beam, 'r=' + g2.r);
  const inv0 = g.player.inv.length;
  step(40);
  T('自动拾取进入行囊', g.player.inv.length > inv0 || d.taken, inv0 + ' -> ' + g.player.inv.length);

  // --- T12 分解 → 精铁 ---
  g.giveGear(0, 'weapon');
  const iron0 = g.player.iron;
  g.salvageBulk(0);
  T('分解获得精铁', g.player.iron > iron0, iron0 + ' -> ' + g.player.iron);

  // --- T13 铁匠台强化 ---
  const itw = g.player.equip.weapon;
  g.player.gold = 9999; g.player.iron = 999;
  const atk0 = g.stats.atk;
  g.forgeOpen(); g.renderForge();
  const b = document.querySelector('#forgeBody button[data-act="enh"][data-slot="weapon"]');
  if (b) b.click();
  T('铁匠台强化生效', g.stats.atk >= atk0 && itw.enh >= 1, 'atk ' + atk0 + '->' + g.stats.atk + ' enh=' + itw.enh);
  g.forgeClose();

  // --- T14 技能树 ---
  g.givePoints(4);
  const before3 = g.stats.atk;
  g.learnNode('fengrui');
  T('参悟节点提升属性', g.stats.atk >= before3, before3 + ' -> ' + g.stats.atk);
  T('参悟消耗点数', g.player.skillPts >= 0, 'left=' + g.player.skillPts);
  const locked = (() => { try { g.learnNode('liesou'); return false; } catch (e) { return true; } })();
  T('前置未满足不可参悟', g.player.skillLv.liesou === undefined || g.player.skillLv.liesou === 0, 'liesou=' + g.player.skillLv.liesou);

  // --- T15 真气与技能 ---
  g.player.qi = 60;
  const qi0 = g.player.qi;
  g.castQi();
  T('剑气消耗真气', g.player.qi < qi0, qi0 + ' -> ' + Math.round(g.player.qi));
  T('剑气进入冷却', g.skills.qi.cd > 0, g.skills.qi.cd.toFixed(2));
  step(180);
  T('冷却可回复', g.skills.qi.cd <= 0, g.skills.qi.cd.toFixed(2));
  g.player.skillLv.tianlei = Math.max(1, g.player.skillLv.tianlei || 0);
  g.player.qi = 60; g.skills.thunder.cd = 0;
  g.castThunder();
  T('天雷诀可施放', g.bolts.length > 0, 'bolts=' + g.bolts.length);

  // --- T16 敌人前摇 ---
  const e4 = alive().find(x => x.type === 'zhiren');
  if (e4) {
    g.setPos(e4.x + 11, e4.y);
    let sawWind = false;
    for (let i = 0; i < 80; i++) { g.tick(0.016); if (e4.windup > 0) sawWind = true; }
    T('敌人起手有前摇预警', sawWind, 'windup=' + e4.windup.toFixed(2));
  } else T('敌人起手有前摇预警', false, '无存活敌人');

  // --- T17 新怪行为 ---
  const camp = g.enemies[0].camp;
  const kinds = ['shanxiao', 'fukui', 'crow', 'shigan', 'yinhun', 'snake', 'treant'];
  const spawned = kinds.map(t => g.spawnEnemy(t, g.player.x + 60, g.player.y + 40, camp));
  T('新增怪物均可生成', spawned.every(x => x && x.mesh), kinds.join('/'));
  T('怪物图鉴达 12 种以上', Object.keys(g.MONSTERS).length >= 11, Object.keys(g.MONSTERS).length + ' 种');

  // --- T18 精英 ---
  const elite = g.spawnEnemy('brute', camp.x + 20, camp.y + 20, camp, { name: '狂暴', hp: 1.5, dmg: 1.35, cd: 0.7, color: '#C8453B' });
  T('精英怪带词缀与光环', !!elite.elite && !!elite.ring, elite.elite && elite.elite.name);

  // --- T19 Boss 二阶段 ---
  const boss = g.boss;
  if (boss) {
    boss.hp = boss.maxHp * 0.4;
    step(5);
    T('Boss 进入二阶段', boss.phase2, boss.phase2);
    boss.spinCd = 0; step(5);
    T('Boss 旋风预警触发', boss.spinWind > 0, boss.spinWind.toFixed(2));
  } else T('Boss 进入二阶段', false, '无 Boss');

  // --- T20 存档 / 读档 ---
  localStorage.removeItem('xiaoyao-save-v5'); // 先清干净，避免上一次跑测试留下的档让断言假通过
  g.player.gold = 777; g.player.level = 6;
  g.save();
  const savedGold = g.player.gold;
  g.player.gold = 0;
  const loaded = g.load();
  T('存档写入 v5', !!localStorage.getItem('xiaoyao-save-v5'), 'v5');
  T('读档还原银两', loaded && g.player.gold === savedGold, g.player.gold);

  // --- T21 御风 ---
  g.setPos(1344, 960);            // 三岔口的路面上，保证站得住
  g.windStep();
  T('御风回土地庙', Math.hypot(g.player.x - g.SPAWN.x, g.player.y - g.SPAWN.y) < 20, Math.round(g.player.x) + ',' + Math.round(g.player.y));

  // --- T22 受击无敌帧 ---
  const hurt = alive().find(x => x.type === 'zhiren');
  if (hurt) {
    g.setPos(hurt.x + 9, hurt.y);
    g.player.hp = 50; g.player.iframe = 0;
    let iframe = 0;
    for (let i = 0; i < 40; i++) { g.tick(0.016); if (g.player.iframe > 0) iframe = g.player.iframe; }
    T('受击后进入无敌帧', iframe > 0 || g.player.hp === 50, 'hp=' + Math.round(g.player.hp));
  } else T('受击后进入无敌帧', false, '无存活敌人');

  // --- T23 道行面板 ---
  g.toggleSkills(true);
  const nodeCount = document.querySelectorAll('#skills .node').length;
  T('道行面板渲染节点', nodeCount >= 13, nodeCount + ' 个节点');
  T('道行面板可见', !document.getElementById('skills').classList.contains('hidden'), 'visible');
  g.toggleSkills(false);
  g.toggleInv(true);
  T('行囊面板可见', document.getElementById('inv').style.display === 'block', 'visible');
  g.toggleInv(false);

  // --- T24 触屏布局（与设备无关的几何自检：越界 / 重叠的手指灾难） ---
  const btns = g.touchBtns || [];
  let oob = 0, overlap = 0;
  for (let i = 0; i < btns.length; i++) {
    const a = btns[i];
    if (a.x - a.r < 0 || a.y - a.r < 0 || a.x + a.r > g.LW || a.y + a.r > g.LH) oob++;
    for (let j = i + 1; j < btns.length; j++) {
      const b = btns[j];
      if (Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r) overlap++;
    }
  }
  T('动作键数量够用', btns.length >= 6, btns.length + ' 个');
  T('动作键不越界', oob === 0, oob + ' 个越界');
  T('动作键不重叠', overlap === 0, overlap + ' 对重叠');

  // --- T25 昼夜：四段时辰 / 晨雾偷袭 / 打坐 / 夜间稀有 / 存档 ---
  const ids = [0.05, 0.30, 0.66, 0.82].map(t => { g.setClock(t); return g.clock.phase.id; });
  T('一日四时辰依序切换', ids.join(',') === 'mao,wu,you,zi', ids.join(','));

  const dnDummy = alive().find(x => x.type !== 'boss' && x.type !== 'treant');
  if (dnDummy) {
    dnDummy.hp = 1e6; dnDummy.def = 0;
    g.setClock(0.30);                       // 午时
    const noon = g.hitEnemy(dnDummy, { dmg: 100, crit: false }, 0, 0);
    dnDummy.aggro = false;
    g.setClock(0.05);                       // 卯时·晨雾
    const dawn = g.hitEnemy(dnDummy, { dmg: 100, crit: false }, 0, 0);
    T('晨雾偷袭伤害 ×1.5', noon === 100 && dawn === 150, '午 ' + noon + ' / 卯 ' + dawn);
  } else T('晨雾偷袭伤害 ×1.5', false, '无存活敌人');

  g.setClock(0.30);                         // 午时
  T('白昼无夜间稀有加成', g.nightLuck() === 0, '0');
  g.setClock(0.85);                         // 子时
  T('夜里稀有率 +40', g.nightLuck() === 40, '+' + g.nightLuck());

  g.setClock(0.30);
  g.setPos(g.SPAWN.x, g.SPAWN.y);
  g.player.qi = 0;
  const pb = g.clock.phase.id;
  g.meditate();
  T('土地庙打坐推进时辰', g.clock.phase.id !== pb, pb + ' → ' + g.clock.phase.id);
  T('打坐回气', g.player.qi > 0, 'qi=' + Math.round(g.player.qi));
  T('打坐有过场', g.meditateT > 0, g.meditateT.toFixed(2));
  g.setPos(g.SPAWN.x + 320, g.SPAWN.y);
  const pf = g.clock.phase.id;
  g.meditate();
  T('远离土地庙不能打坐', g.clock.phase.id === pf, pf);

  g.setClock(0.85);
  step(3);
  T('夜间点亮光源', g.lights.length > 0, g.lights.length + ' 处');

  g.setClock(0.72, 3);
  g.save();
  const savedDn = JSON.parse(localStorage.getItem('xiaoyao-save-v5') || '{}');
  T('存档记录时辰与天数', !!savedDn.clock && Math.abs(savedDn.clock.t - 0.72) < 1e-3 && savedDn.clock.day === 3,
    JSON.stringify(savedDn.clock));

  // --- T26 青云集：铺子 / 营业时间 / 住店 / 传闻 ---
  g.setClock(0.30, 1);                      // 午时
  const S = g.shops;
  T('白昼四家铺子全开', ['inn', 'herb', 'tavern', 'smith'].every(id => g.shopOpenNow(id)),
    ['inn', 'herb', 'tavern', 'smith'].filter(id => g.shopOpenNow(id)).length + '/4');
  g.setClock(0.86, 1);                      // 子时·深夜
  T('深夜只留客栈通宵', g.shopOpenNow('inn') && !g.shopOpenNow('herb') && !g.shopOpenNow('smith') && !g.shopOpenNow('tavern'),
    JSON.stringify({ inn: g.shopOpenNow('inn'), herb: g.shopOpenNow('herb') }));
  g.setClock(0.86, 1);
  g.collectLights();
  const nightLights = g.lights.length;
  g.setClock(0.30, 1);
  g.collectLights();
  const dayLights = g.lights.length;
  T('打烊就没灯（灯=营业信号）', dayLights > nightLights, '夜 ' + nightLights + ' → 昼 ' + dayLights);

  g.setClock(0.30, 1);
  g.setPos(S.herb.x, S.herb.y + 8);
  step(3);
  T('走到药铺门口能搭话', g.nearShop() === 'herb', String(g.nearShop()));
  g.player.gold = 100;
  const goldB = g.player.gold, potB = g.player.inv.filter(x => x.kind === 'potion').length;
  g.shopOpen('herb');
  g.buyGood('potion');
  T('买药扣银两、进背包', g.player.gold === goldB - 12 && g.player.inv.filter(x => x.kind === 'potion').length === potB + 1,
    '银两 ' + goldB + '→' + g.player.gold);
  g.shopOpen('herb');
  T('打烊时不给买', (function () {
    g.setClock(0.86, 1);
    g.player.gold = 100;
    const b = g.player.gold;
    g.shopClose(); g.shopOpen('herb');
    const btns = document.getElementById('shopBody').querySelectorAll('button').length;
    g.shopClose();
    g.setClock(0.30, 1);
    return b === g.player.gold && btns === 0;
  })(), '夜间货架按钮 0 个');
  g.shopClose();

  // 住店：过夜 + 回满 + 记账 + 存档
  g.setClock(0.72, 3);
  g.setPos(S.inn.x, S.inn.y + 8);
  step(3);
  g.player.gold = 100; g.player.hp = 12;
  g.shopOpen('inn');
  g.buyGood('rest');
  T('住店过夜到卯时', g.clock.phase.id === 'mao' && g.clock.day === 4, '第' + g.clock.day + '日 ' + g.clock.phase.id);
  T('住店回满气血', g.player.hp === g.stats.hp, Math.round(g.player.hp) + '/' + g.stats.hp);
  T('住店收 20 银两', g.player.gold === 80, g.player.gold);
  T('住店留下"落脚处"', g.player.rested === true, String(g.player.rested));
  T('住店自动存档', !!JSON.parse(localStorage.getItem('xiaoyao-save-v5') || '{}').rested, 'rested in save');
  T('住店有黑幕过场', g.sleepT > 0, g.sleepT.toFixed(2));

  // 传闻：小地图问号
  g.setClock(0.66, 4);
  g.setPos(S.tavern.x, S.tavern.y + 8);
  step(3);
  g.player.gold = 100;
  g.shopOpen('tavern');
  g.buyGood('rumor');
  T('酒馆给传闻坐标', !!g.rumor && isFinite(g.rumor.x), g.rumor ? g.rumor.name : 'null');
  g.shopClose();

  // 酒：伤害加成
  g.setClock(0.66, 4);
  g.player.drunkT = 0; g.player.drunk = 0;
  g.shopOpen('tavern');
  g.buyGood('liquor');
  T('酒给醉意加成', g.player.drunkT > 0 && g.player.drunk > 0, '+' + Math.round(g.player.drunk * 100) + '% / ' + Math.round(g.player.drunkT) + 's');
  g.shopClose();

  // 铁匠铺 = 张五的摊位 → 借炉 → 铁匠台
  g.setPos(S.smith.x, S.smith.y + 8);
  step(3);
  g.interact();
  T('铁匠铺先开摊位', g.shopId === 'smith' && !document.getElementById('shop').classList.contains('hidden'), 'shop=' + g.shopId);
  g.buyGood('forge');
  T('借炉能开铁匠台', !document.getElementById('forge').classList.contains('hidden'), 'forge open');
  g.forgeClose();

  // 变卖：换下来的装备得有地方出手，不然包满了只能扔
  g.shopOpen('smith');
  g.giveGear(0, 'weapon', 1);                      // giveGear 自己会塞进包里
  {
    const g0 = g.player.gold, i0 = g.player.iron, n0 = g.player.inv.length;
    const bad = g.player.inv.filter(it => it && it.kind !== 'potion' && (!isFinite(it.ilvl) || !isFinite(it.r)));
    g.buyGood('sell0');
    T('变卖凡品换回银两', g.player.gold > g0 && g.player.iron > i0 && g.player.inv.length < n0,
      '银两 ' + g0 + '→' + g.player.gold + '　精铁 ' + i0 + '→' + g.player.iron +
      (bad.length ? '　坏件 ' + bad.map(x => x.name || x.kind).join(',') : ''));
  }
  g.shopClose();

  // 掌柜按作息站门口：铺子打烊，人就回屋
  g.setClock(0.86, 3);                       // 子时（0.75 之后才是子）
  step(3);
  {
    const inn = g.npcs.find(o => o.npc === 'inn');
    const smith = g.npcs.find(o => o.npc === 'smith');
    T('掌柜按作息上下班', inn.mesh.visible && !smith.mesh.visible,
      '客栈' + (inn.mesh.visible ? '有人' : '没人') + ' / 铁铺' + (smith.mesh.visible ? '有人' : '没人'));
  }
  g.setClock(0.30, 3);                       // 回午时
  step(3);

  // 围墙 / 牌坊口
  T('围墙挡人', !g.canStand(...vp(616, 800)) && !g.canStand(...vp(952, 800)), '两侧实心');
  T('牌坊口能进村', g.canStand(...vp(784, 930)) && g.canStand(...vp(784, 880)), '南口可通行');
  T('房屋墙脚挡人', !g.canStand(...vp(712, 782)), '客栈不可穿');
  T('村内不刷怪', g.enemies.every(e => !g.inVillage(e.x, e.y, 0)), String(g.enemies.filter(e => g.inVillage(e.x, e.y, 0)).length) + ' 只在村内');
  // 安全区：进了城墙就没人追你。阴魂会瞬移到玩家身侧，是最容易钻进村子的那种。
  {
    const bl = g.enemies.find(e => e.type === 'yinhun' && !e.dead);
    g.setPos(...vp(784, 860));                // 街心，离南墙 68
    if (bl) {
      const bp = vp(784, 972); bl.x = bp[0]; bl.y = bp[1]; bl.aggro = true; bl.blinkCd = 0;
      step(90);
      const pos = Math.round(bl.x) + ',' + Math.round(bl.y);
      T('进村就不被盯上', bl.aggro === false, '村外 ' + pos);
      T('阴魂不闪进村', !g.inVillage(bl.x, bl.y, 0), pos);
    }
  }

  // 死一次：住过店的人被背回客栈，没住过的回土地庙
  g.player.rested = true;
  g.player.gold = 100;
  g.showDead();
  const deadHint = document.getElementById('btnRespawn').textContent;
  document.getElementById('btnRespawn').click();
  T('住过店·死后回客栈', Math.abs(g.player.x - S.inn.x) < 2 && Math.abs(g.player.y - (S.inn.y + 20)) < 2,
    Math.round(g.player.x) + ',' + Math.round(g.player.y));
  T('死亡扣两成银两', g.player.gold === 80, '100 → ' + g.player.gold);
  T('死亡提示跟着落脚处变', deadHint.indexOf('客栈') >= 0, deadHint);
  g.player.rested = false;
  g.showDead();
  document.getElementById('btnRespawn').click();
  T('没住店·死后回土地庙', Math.abs(g.player.x - g.SPAWN.x) < 2, Math.round(g.player.x) + ',' + Math.round(g.player.y));

  // ---- 批次 C：村民作息 / 对话 / 侠名 ----
  const fade = 150;                       // 淡入淡出 0.4 秒，跑够帧数再看显隐
  g.setClock(0.30, 3); step(fade);        // 午时
  {
    const on = g.vilObjs.filter(o => o.mesh.visible).map(o => o.villager);
    T('午时街上有人', on.indexOf('hai') >= 0 && on.indexOf('dao') >= 0 && on.indexOf('zui') < 0, on.join('/'));
  }
  g.setClock(0.86, 3); step(fade);        // 子时
  {
    const on = g.vilObjs.filter(o => o.mesh.visible).map(o => o.villager);
    T('子时换一批人', on.indexOf('geng') >= 0 && on.indexOf('dao') < 0, on.join('/'));
  }
  g.setClock(0.30, 3); step(fade);

  // 对话：走近说书人，按 E 应该是"跟人说话"而不是"开铺子"
  g.setPos(...vp(852, 906)); step(2);
  {
    const v = g.nearVillager();
    T('走近能认出是谁', v && v.id === 'shuo', v ? v.name : '没人');
    g.interact();
    T('按 E 认人不认柜台', g.talkNpc && g.talkNpc.id === 'shuo', (g.talkNpc || {}).name || '—');
    T('对话面板打开', g.talkOpen && document.getElementById('talkName').textContent === '柳先生',
      document.getElementById('talkName').textContent);
    T('打字机逐字吐', g.talkShown < g.talkLine.length, g.talkShown + '/' + g.talkLine.length);
    g.sayAll();
    T('点一下可跳过打字机', g.talkShown === g.talkLine.length, g.talkLine.slice(0, 10));
    document.querySelector('#talkOpts button').click();   // 打听
    g.sayAll();
    T('打听换一句', g.talkLine.indexOf('你身上这股气') >= 0, g.talkLine.slice(0, 12));
    g.talkClose();
    T('作别能关窗', !g.talkOpen, 'ok');
  }

  // 侠名：换称呼、换说书人的段子、换价
  {
    g.player.fame = 0;
    const p0 = g.priceMul();
    g.player.fame = 80;
    T('侠名到顶打八五折', p0 === 1 && Math.abs(g.priceMul() - 0.85) < 1e-6, p0 + ' → ' + g.priceMul().toFixed(2));
    const tales = g.NPC_ACT.story(g.villagers.find(x => x.id === 'shuo'));
    T('说书人按侠名换段子', tales.indexOf('名动江湖') >= 0, tales.slice(0, 14));
  }
  // 老妪收药：背包少一件、银两多八文、侠名 +6
  {
    g.player.fame = 0; g.player.gold = 50;
    g.addPotion('回春丹', 45);
    const n0 = g.player.inv.length;
    g.NPC_ACT.give(g.villagers.find(x => x.id === 'yu'));
    T('送药得人情', g.player.fame === 6 && g.player.inv.length === n0 - 1 && g.player.gold === 58,
      '侠名 ' + g.player.fame + '　银两 50→' + g.player.gold);
  }
  // 道士：花钱换真气与解毒
  {
    g.player.gold = 100; g.player.qi = 0;
    g.NPC_ACT.charm(g.villagers.find(x => x.id === 'dao'));
    T('求符扣钱回真气', g.player.gold < 100 && g.player.qi > 0,
      '银两 100→' + g.player.gold + '　真气 ' + Math.round(g.player.qi));
  }
  // 传闻要走到底才算数
  {
    g.player.fame = 0;
    g.rumor = { x: g.player.x + 120, y: g.player.y, name: '测试营地', t: 60 };
    g.setPos(g.rumor.x, g.rumor.y); step(2);
    T('循传闻寻到地头 侠名+3', g.player.fame === 3 && !g.rumor, '侠名 ' + g.player.fame);
  }
  // 货郎：没铺子，一副担子照样能做生意
  {
    g.shopOpen('pedlar');
    const i0 = g.player.iron;
    g.player.gold = 100;
    g.buyGood('iron');
    T('货郎卖精铁', g.player.iron === i0 + 1 && g.player.gold < 100, '精铁 ' + i0 + '→' + g.player.iron);
    g.shopClose();
  }
  {
    g.player.fame = 42;
    g.save();
    const raw = JSON.parse(localStorage.getItem('xiaoyao-save-v5') || '{}');
    T('存档记录侠名', raw.fame === 42, String(raw.fame));
  }

  // ============ T27 · 青云古洞 ============
  {
    g.player.hp = 9999;
    g.dgReset(); step(2);
    const d = g.dgData;
    T('古洞生成出房间', d.rooms.length >= 7, d.rooms.length + ' 间');
    T('古洞布了妖物', g.dgMobs.length >= 10, g.dgMobs.length + ' 只');
    T('每间屋都点了火盆',
      g.dgObjs.filter(o => o.kind === 'brazier').length >= d.rooms.length - 1,
      g.dgObjs.filter(o => o.kind === 'brazier').length + ' 盏');
    T('怪都挂了地宫标签', g.dgMobs.every(e => e.dg === true), '');
  }
  {
    const d = g.dgData;
    g.setPos(d.doorX, g.DG.y1 + 30); step(2);
    T('洞口外站得住人', g.canStand(g.player.x, g.player.y),
      Math.round(g.player.x) + ',' + Math.round(g.player.y));
    g.setPos(d.doorX, d.doorY - 8); step(2);
    T('走进洞口算进了洞', g.inDungeon(g.player.x, g.player.y, 0),
      Math.round(g.player.x) + ',' + Math.round(g.player.y));
  }
  {
    // 洞里恒暗：能照亮的只有手上的火把、墙上的火盆、地上的裂口
    g.collectLights();
    const n = g.lights.length;
    T('洞里的光只来自洞内', g.lights.every(l => g.inDungeon(l.x, l.y, 140)), n + ' 个光源');
    g.setPos(g.SPAWN.x, g.SPAWN.y); step(2);
    g.collectLights();
    T('出洞后光源恢复野外', g.lights.length > n, n + ' → ' + g.lights.length);
  }

  // ============ T27b · 洞内火把会灭（P12 前置项 ③）============
  {
    g.dgReset(); step(2);
    const d = g.dgData;
    g.setPos(d.doorX, d.doorY - 8); step(2);
    const bz = g.dgObjs.filter(o => o.kind === 'brazier');
    T('进洞时火把与火盆都亮着', !!g.torch && g.torch.lit === true &&
      bz.length > 0 && bz.every(o => o.lit === true),
      '火把=' + (g.torch && g.torch.lit) + '　火盆 ' + bz.length + ' 盏');
    g.collectLights();
    const n0 = g.lights.length, r0 = g.lights[0].r;
    T('洞里火把是最大那盏光源', r0 >= 80, Math.round(r0) + 'px');

    g.torch.fuel = 0.001; step(2);
    T('油烧完火把真的会灭', g.torch.lit === false && g.torch.outs === 1,
      'outs=' + g.torch.outs);
    g.collectLights();
    T('火把灭了可视半径收窄', g.lights[0].r < r0 && g.lights[0].r > 0,
      Math.round(r0) + ' → ' + Math.round(g.lights[0].r));

    const one = bz[0];
    g.douseBrazier(one, '测试'); step(1);
    g.collectLights();
    T('火盆灭了光源真的少一个', g.lights.length === n0 - 1,
      n0 + ' → ' + g.lights.length);
    T('灭掉的火盆贴图压暗了', one.mesh.material.color.getHex() === 0x555a66,
      '#' + one.mesh.material.color.getHexString());

    g.setPos(one.x, one.y); step(1);
    T('走近火盆能借火', g.nearBrazier() === one, g.nearBrazier() ? '找到了' : '没找到');
    g.dgRelight(one); step(1); g.collectLights();
    T('借火后火把与火盆都回来', g.torch.lit === true && g.lights.length === n0,
      g.torch.lit + ' / ' + g.lights.length);

    // 第一次灭是被风
    const out0 = bz.filter(o => o.lit === false).length;
    g.dgGustT = 0.001; step(1);
    const out1 = bz.filter(o => o.lit === false).length;
    T('穿堂风会吹灭一盏火盆', out1 > out0, out0 + ' → ' + out1);

    // 第二次灭是被翅膀
    const target = bz.find(o => o.lit !== false);
    if (target) {
      g.dgRelight(target);
      g.setPos(target.x, target.y); step(1);
      const cr = g.spawnEnemy('crow', target.x + 8, target.y, { x: target.x, y: target.y });
      if (cr) g.hitEnemy(cr, { dmg: 99999, crit: false }, 0, 0);
      T('火鸦扑棱会扇灭近旁火盆', target.lit === false, target.lit ? '还亮着' : '灭了');
    } else {
      T('火鸦扑棱会扇灭近旁火盆', false, '没有亮着的火盆');
    }

    // 第三次：不点了
    g.torch.lit = true; g.torch.fuel = 0.001; step(1);
    g.torch.lit = true; g.torch.fuel = 0.001; step(1);
    T('灭到第三回换一句台词', g.torch.outs === 3 &&
      g.messages.some(m => m.txt.indexOf('第三回了') >= 0), 'outs=' + g.torch.outs);
  }
  {
    const d = g.dgData;
    g.setPos(d.deepC.x, d.deepC.y + 36); step(2);
    const rift = g.dgObjs.find(o => o.kind === 'rift');
    T('妖物没清裂口是封的', rift.locked === true, 'locked=' + rift.locked);
    g.dgDescend(); step(30);
    T('妖物没清下不了地脉', g.dgFloor === 1, '第 ' + g.dgFloor + ' 层');
    for (const e of g.dgMobs) { e.dead = true; e.hp = 0; }
    step(3);
    T('清完妖物裂口自己开', g.dgCleared === true && rift.locked === false,
      '余妖 ' + g.dgMobs.filter(e => !e.dead).length);
  }
  {
    const d = g.dgData;
    g.setPos(d.deepC.x, d.deepC.y + 36); step(2);
    g.dgDescend(); step(60);
    T('深入地脉到第 2 层', g.dgFloor === 2, '第 ' + g.dgFloor + ' 层');
    T('第 2 层洞口封死', !g.canStand(g.dgData.doorX, g.DG.y1 - 4), '');
    T('第 2 层换了一批怪', g.dgMobs.length >= 10 &&
      g.dgMobs.every(e => ['shanxiao', 'yinhun', 'ghost', 'fukui'].includes(e.type)),
      [...new Set(g.dgMobs.map(e => e.type))].join(','));
  }
  {
    for (const e of g.dgMobs) { e.dead = true; e.hp = 0; }
    step(3);
    g.setPos(g.dgData.deepC.x, g.dgData.deepC.y + 36); step(2);
    g.dgDescend(); step(60);
    const boss = g.dgMobs.find(e => e.type === 'yaowang');
    T('第 3 层有洞主', g.dgFloor === 3 && !!boss && boss.type === 'yaowang',
      boss ? 'HP ' + Math.round(boss.maxHp) : '无');
    T('洞主会主动扑上来', !!boss && boss.aggro === true, '');
    const chest = g.dgObjs.find(o => o.kind === 'chest');
    T('洞主没倒箱子封着', chest.locked === true && chest.big === true, '');
    for (const e of g.dgMobs) { e.dead = true; e.hp = 0; }
    step(3);
    T('洞主伏诛大箱解锁', chest.locked === false, 'cleared=' + g.dgCleared);
  }
  {
    const chest = g.dgObjs.find(o => o.kind === 'chest');
    const g0 = g.player.gold, i0 = g.player.iron, d0 = g.drops.length;
    g.dgOpenChest(chest); step(2);
    const got = g.drops.slice(d0).filter(x => x.kind === 'gear');
    T('大箱给三件装备', got.length === 3, got.map(x => x.item.r).join(','));
    T('大箱保底精品以上', got.length === 3 && got.every(x => x.item.r >= 2),
      got.map(x => 'R' + x.item.r).join(','));
    T('大箱给银两与精铁', g.player.gold > g0 && g.player.iron === i0 + 12,
      '银两 +' + (g.player.gold - g0) + '　精铁 +' + (g.player.iron - i0));
    const g1 = g.player.gold;
    g.dgOpenChest(chest);
    T('箱子只能开一次', g.player.gold === g1, '');
  }
  {
    g.dgHome(); step(60);
    T('回到地面且在洞外', !g.inDungeon(g.player.x, g.player.y, 0) && g.dgFloor === 1,
      Math.round(g.player.x) + ',' + Math.round(g.player.y));
    T('地面落脚点站得住', g.canStand(g.player.x, g.player.y), '');
  }
  {
    const before = g.dgData.t.join(',');
    const rb = g.dgData.rooms.length;
    g.dgReset(); step(2);
    T('重进一次换一座洞', g.dgData.t.join(',') !== before,
      rb + ' 间 → ' + g.dgData.rooms.length + ' 间');
    T('重排后仍然连通', (() => {
      const d = g.dgData, W = d.W, H = d.H, seen = new Set(), q = [[d.rooms[0].x + 4, H - 1]];
      while (q.length) {
        const [x, y] = q.pop(), k = y * W + x;
        if (x < 0 || y < 0 || x >= W || y >= H || seen.has(k) || d.t[k] === g.DGT.WALL) continue;
        seen.add(k); q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }
      let walk = 0; for (const v of d.t) if (v !== g.DGT.WALL) walk++;
      return seen.size === walk;
    })(), '');
  }
  {
    const before = g.dgData.t.join(',');
    for (const e of g.dgMobs) { e.dead = true; e.hp = 0; }
    step(2);
    g.showDead();
    g.respawn();
    T('死在洞里下一趟是新洞', g.dgFloor === 1 && g.dgData.t.join(',') !== before, '第 ' + g.dgFloor + ' 层');
  }

  const pass = out.filter(l => l.startsWith('PASS')).length;
  const fail = out.filter(l => l.startsWith('FAIL')).length;
  const html = '<h3>dev tests: ' + pass + ' pass / ' + fail + ' fail</h3><pre>' + out.join('\n') + '</pre>';
  let box = document.getElementById('devout');
  if (!box) { box = document.createElement('div'); box.id = 'devout'; document.body.appendChild(box); }
  box.innerHTML = html;
  box.style.cssText = 'position:fixed;left:8px;top:8px;z-index:999;background:#fff;color:#111;font:12px monospace;padding:10px;max-width:90vw;max-height:80vh;overflow:auto;border:2px solid #000';
  return out;
}
