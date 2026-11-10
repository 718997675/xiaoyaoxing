// tools/weapons.js · 八类兵器 / 稀有造型 / 触屏几何 / 摇杆归零 专项自检
//
// 用法（配合 CDP evaluate，或 ?dev=1 页面里手动跑）：
//   const r = await (async()=>{ /* 本文件内容 */ })();
// 返回一个结果对象：ok 为总判定，其余字段是各分组的实测值。
// 设计原则：只读数据 + 复用 __game 钩子，不硬编码按钮坐标、不依赖渲染帧率。
(() => {
  const g = window.__game;
  const R = { ok: false, checks: [] };
  const T = (name, cond, detail) => { R.checks.push((cond ? 'PASS' : 'FAIL') + ' | ' + name + (detail !== undefined ? ' | ' + detail : '')); return !!cond; };
  const px = (cv) => {
    const c = document.createElement('canvas');
    c.width = cv.width; c.height = cv.height;
    const x = c.getContext('2d'); x.drawImage(cv, 0, 0);
    return x.getImageData(0, 0, c.width, c.height).data.join(',');
  };

  // ---------- 1. 兵器数据 ----------
  const W = g.WEAPONS, IDS = g.WEAPON_IDS;
  T('八类兵器齐备', IDS.length === 8 && IDS.includes('mage') && IDS.includes('dart'), IDS.join('/'));
  T('法杖与暗器是远程', W.mage.ranged === true && W.dart.ranged === true);
  T('每类兵器都是三段', IDS.every(f => W[f].swings.length === 3));

  const bsw = W.blade.swings;
  T('刀：三式皆半圆弧斩', bsw.every(s => s.mode === 'swing' && Math.abs(s.a1 - s.a0) >= 3.0 && Math.abs(s.a1 - s.a0) <= 3.6),
    bsw.map(s => Math.abs(s.a1 - s.a0).toFixed(2)).join('/'));
  T('刀：判定也是半圆', bsw.every(s => s.hitArc >= 3.0 && s.hitArc <= 3.6), bsw.map(s => s.hitArc).join('/'));

  const ssw = W.sword.swings;
  T('剑：前两段向前窄挥（非半圆）', ssw[0].mode === 'swing' && ssw[1].mode === 'swing'
    && ssw.slice(0, 2).every(s => s.hitArc < 2.0), ssw.slice(0, 2).map(s => s.hitArc).join('/'));
  T('剑：末段向前直刺', ssw[2].mode === 'thrust' && ssw[2].lunge > 8, ssw[2].reach);

  const psw = W.spear.swings;
  T('枪：刺 → 扫 → 贯甲刺 三段重设计',
    psw[0].mode === 'thrust' && psw[1].mode === 'swing' && psw[2].mode === 'thrust'
    && psw[2].reach > psw[0].reach, psw.map(s => s.mode).join('→'));

  T('法杖：气弹 1/2/3 粒递增', W.mage.swings.every(s => s.mode === 'cast' && s.proj.kind === 'orb')
    && W.mage.swings.map(s => s.proj.count).join(',') === '1,2,3');
  T('暗器：飞镖 1/3/5 枚扇射', W.dart.swings.every(s => s.mode === 'cast' && s.proj.kind === 'dart')
    && W.dart.swings.map(s => s.proj.count).join(',') === '1,3,5');

  const melee = IDS.filter(f => !W[f].ranged);
  const maxReach = Math.max(...melee.map(f => Math.max(W[f].reach, ...W[f].swings.map(s => s.reach || 0))));
  const maxArc = Math.max(...IDS.flatMap(f => W[f].swings.map(s => s.hitArc || 0)));
  T('挥舞范围整体收小（最远攻距 ≤50）', maxReach <= 50, maxReach);
  T('不再有 >6.3 的超大判定弧', maxArc <= 6.3, maxArc);

  // ---------- 2. 同类不同造型 / 稀有外观 ----------
  const base = g.weaponCanvas('sword', null, 0, 0);
  const epic = g.weaponCanvas('sword', null, 4, 0);
  const epicB = g.weaponCanvas('sword', null, 4, 1);
  T('仙品/传世换剪影（不只是染色）', epic.width !== base.width || epic.height !== base.height,
    base.width + '×' + base.height + ' → ' + epic.width + '×' + epic.height);
  T('同族同品阶也有不同宝石纹样', px(epic) !== px(epicB));
  const icon4 = g.weaponIcon('sword', 4, 0, null), icon0 = g.weaponIcon('sword', 0, 0, null);
  T('行囊图标跟着换造型', px(icon4) !== px(icon0));
  const it = g.makeGear('weapon', 3, 6, Math.random, 'mage');
  T('掉落物带稳定造型种子', typeof it.skin === 'number' && it.skin >= 0 && it.skin < 3, it.skin + ' / ' + it.fam);
  const famHits = new Set();
  for (let i = 0; i < 600; i++) famHits.add(g.randomFam(Math.random));
  T('八类兵器都进掉落池', famHits.size === 8, [...famHits].join('/'));
  T('新兵器名称池齐备', g.makeGear('weapon', 4, 8, Math.random, 'dart').name.length > 0
    && g.makeGear('weapon', 4, 8, Math.random, 'mage').name.length > 0);

  // ---------- 3. 远程普攻真能发出弹体 ----------
  if (g.state !== 'play') document.getElementById('btnNew').click();
  g.setInputMode('keyboard', false);
  const fire = (fam) => {
    const eq = g.giveGear(2, 'weapon', 2, fam);
    g.equipItem(g.player.inv.indexOf(eq));
    const counts = [];
    g.player.lastAtkT = -9;
    for (let i = 0; i < 3; i++) {
      const n0 = g.projectiles.filter(p => p.friendly).length;
      g.player.atkCd = 0; g.player.atkBuf = 0;
      g.attack();
      counts.push(g.projectiles.filter(p => p.friendly).length - n0);
    }
    return counts;
  };
  const mageN = fire('mage'), dartN = fire('dart');
  T('法杖三段射出 1/2/3 粒气弹', mageN.join(',') === '1,2,3', mageN.join(','));
  T('暗器三段射出 1/3/5 枚飞镖', dartN.join(',') === '1,3,5', dartN.join(','));
  g.slashGhosts.length = 0;
  g.player.atkCd = 0; g.player.lastAtkT = -9;
  g.attack();                                   // 暗器 / 法杖 cast 收招
  for (let i = 0; i < 14; i++) g.tick(1 / 60);
  T('远程普攻只留灵气圈、不画近战刀光', g.slashGhosts.every(x => x.ring), g.slashGhosts.length);
  // 弹体现在撞墙即碎，随机挑到的敌人若隔着树/竹，这一发必然打在障碍物上 ——
  // 所以逐个换目标重试，别让「随机站位」变成假失败。
  let hit = 0, tried = 0, target = null;
  const cands = g.enemies.filter(x => !x.dead && x.type !== 'boss' && x.type !== 'treant');
  for (const e of cands) {
    if (tried >= 8) break;
    tried++;
    g.setPos(e.x - 40, e.y); g.setDir('right');
    e.aggro = false; e.hp = e.maxHp = 99999;
    const hp0 = e.hp;
    g.player.atkCd = 0; g.player.lastAtkT = -9;
    g.attack();
    for (let i = 0; i < 25; i++) g.tick(1 / 60);
    hit = hp0 - e.hp;
    target = e;
    if (hit > 0) break;
  }
  T('飞弹能命中敌人', hit > 0, hit + '（试了 ' + tried + ' 个目标）');

  // ---------- 4. 史诗/传说地面特效 ----------
  const d = g.giveGearToGround(4, 'weapon');
  T('传世兵器掉落带专属特效标记', d.epic === true, d.item.name);
  g.tick(1 / 60);
  T('传世兵器掉落生成加强光柱', !!d.beam);

  // ---------- 5. 触屏按钮几何（容错圈不再互相盖住） ----------
  const b = g.touchBtns;
  let overlaps = 0, minGap = Infinity;
  for (let i = 0; i < b.length; i++) {
    for (let j = i + 1; j < b.length; j++) {
      const gap = Math.hypot(b[i].x - b[j].x, b[i].y - b[j].y)
        - (b[i].r + g.BTN_PAD) - (b[j].r + g.BTN_PAD);
      if (gap < 0) overlaps++;
      minGap = Math.min(minGap, gap);
    }
  }
  T('动作键容错圈零重叠', overlaps === 0, overlaps + ' 对 / 最小余量 ' + minGap.toFixed(1));
  // 坐 / 谈 / 招式键 是条件显示键，圆心命中只对常驻键有意义
  T('点每个常驻键的圆心都命中自己',
    b.filter(x => x.id !== 'sit' && x.id !== 'talk' && x.art === undefined).every(x => { const h = g.touchHit({ x: x.x, y: x.y }); return h && h.id === x.id; }));
  // 交界处取最近圆心，主攻键不再越界吃掉小键
  const qi = b.find(x => x.id === 'qi'), slash = b.find(x => x.id === 'slash');
  const mid = { x: (qi.x + slash.x) / 2, y: (qi.y + slash.y) / 2 };
  T('交界处按最近圆心判定', !!g.touchHit(mid) === false || ['qi', 'slash'].includes(g.touchHit(mid).id));

  // ---------- 6. 摇杆「朝一个方向一直走」的回归 ----------
  g.setInputMode('touch', false);
  const ov = document.getElementById('ov');
  const box = ov.getBoundingClientRect();
  const evt = (type, lx, ly, pid) => ov.dispatchEvent(new PointerEvent(type, {
    pointerId: pid || 7, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true,
    clientX: box.left + (lx / g.LW) * box.width, clientY: box.top + (ly / g.LH) * box.height,
  }));
  evt('pointerdown', 56, 210, 7);
  evt('pointermove', 92, 210, 7);
  const pushed = g.touch.stick.dx > 0.5;
  // pointercancel 只派给 window（手指滑出画布的常见情形）
  window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 7, pointerType: 'touch', bubbles: true }));
  T('window 级 pointercancel 能收杆', pushed && !g.touch.stick.on && g.touch.stick.dx === 0,
    'pushed=' + pushed + ' dx=' + g.touch.stick.dx);
  evt('pointerdown', 56, 210, 8);
  evt('pointermove', 92, 210, 8);
  evt('pointerdown', 40, 200, 9);      // 第二根手指落进左半屏
  T('第二根手指不抢占摇杆 id', g.touch.stick.id === 8, g.touch.stick.id);
  g.stickEnd();
  // 失焦时方向键一起清空
  window.dispatchEvent(new Event('blur'));
  T('失焦收杆', !g.touch.stick.on && g.touch.stick.dx === 0);
  T('待机显示小手拿兵器（默认）', g.showIdleWeapon === true);
  T('手持缩小到 <0.7 倍', g.HELD_SCALE < 0.7 && g.SWING_SCALE < 0.8,
    g.HELD_SCALE + '/' + g.SWING_SCALE);

  R.failCount = R.checks.filter(l => l.indexOf('FAIL') === 0).length;
  R.fails = R.checks.filter(l => l.indexOf('FAIL') === 0);
  R.ok = R.failCount === 0;
  return R;
})()
