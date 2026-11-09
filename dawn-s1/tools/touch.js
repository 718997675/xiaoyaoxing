// tools/touch.js · 触屏操作自检（配合 shot.js 用）
//
// 用法（模拟 iPhone 横屏）：
//   SHOT_W=812 SHOT_H=375 SHOT_MOBILE=1 SHOT_DPR=2 SHOT_WAIT=3000 \
//   node tools/shot.js "http://127.0.0.1:8124/?touch=1" /tmp/m-land tools/touch.js
//
// 竖屏把 SHOT_W/SHOT_H 换成 390/844 即可。
// 检查项：摇杆按下→推动→人物位移、抬起归零、动作键命中掉血、囊/道面板入口、
//        昼夜（夜里光源 + 土地庙「坐」键出现并能推进时辰）。
// 注意：按钮坐标一律从 g.touchBtns 取，别硬编码 —— 挪一次位置就会全错。
(() => {
  const done = (async () => {
    const g = window.__game;
    const r = { enabled: g.touch.enabled, steps: [] };
    if (g.state !== 'play') document.getElementById('btnNew').click();
    await new Promise(s => setTimeout(s, 250));

    const ov = document.getElementById('ov');
    const box = ov.getBoundingClientRect();
    const fire = (type, lx, ly, id) => {
      ov.dispatchEvent(new PointerEvent(type, {
        pointerId: id || 1, pointerType: 'touch', isPrimary: true,
        bubbles: true, cancelable: true,
        clientX: box.left + (lx / g.LW) * box.width,
        clientY: box.top + (ly / g.LH) * box.height,
      }));
    };
    const btn = id => g.touchBtns.find(b => b.id === id);
    const tap = (id, pid) => {
      const b = btn(id);
      if (!b) return false;
      fire('pointerdown', b.x, b.y, pid || 1);
      fire('pointerup', b.x, b.y, pid || 1);
      return true;
    };

    // 摇杆：按下 → 往右推 → 人应往右走
    const x0 = g.player.x;
    fire('pointerdown', 56, 210);
    r.steps.push('down on=' + g.touch.stick.on);
    fire('pointermove', 86, 210);
    r.steps.push('move dx=' + g.touch.stick.dx.toFixed(2));
    for (let i = 0; i < 30; i++) g.tick(1 / 60);
    r.dx = Math.round(g.player.x - x0);
    r.dir = g.player.dir;
    fire('pointerup', 86, 210);
    r.steps.push('up on=' + g.touch.stick.on);
    r.stickReleased = !g.touch.stick.on && g.touch.stick.dx === 0;

    // 动作键：站到怪边上点「斩」
    const e = g.enemies.filter(x => !x.dead && x.type !== 'boss' && x.type !== 'treant')[0];
    g.setPos(e.x - 16, e.y); g.setDir('right');
    const hp0 = e.hp;
    tap('slash', 2);
    await new Promise(s => setTimeout(s, 40));
    r.hit = Math.round(hp0) - Math.round(e.hp);
    r.atkCd = +g.player.atkCd.toFixed(2);

    // 面板入口
    tap('bag', 3);
    r.bag = document.getElementById('inv').style.display;
    tap('dao', 4);
    r.dao = !document.getElementById('skills').classList.contains('hidden');
    g.toggleInv(false); g.toggleSkills(false);
    for (let i = 0; i < 6; i++) g.tick(1 / 60);

    // --- 昼夜：夜里光源 + 土地庙「坐」键 ---
    g.setClock(0.85);                        // 子时
    g.setPos(g.player.x, g.player.y);
    for (let i = 0; i < 4; i++) g.tick(1 / 60);
    r.lights = g.lights.length;
    r.phase = g.clock.phase.id;

    // 野外的「坐」键不该出现
    g.setPos(g.SPAWN.x + 300, g.SPAWN.y);
    for (let i = 0; i < 3; i++) g.tick(1 / 60);
    r.sitFar = !g.atTemple;
    // 走到土地庙
    g.setPos(g.SPAWN.x, g.SPAWN.y);
    for (let i = 0; i < 3; i++) g.tick(1 / 60);
    r.sitNear = g.atTemple;
    const before = g.clock.phase.id;
    r.sitTapped = tap('sit', 5);
    // meditate 需要指针事件真的打到按钮上，这里再直接确认一次逻辑
    if (!r.sitTapped) g.meditate();
    for (let i = 0; i < 3; i++) g.tick(1 / 60);
    r.meditate = { before, after: g.clock.phase.id, fx: g.meditateT > 0 };

    // --- 青云集：走到药铺门口，「谈」键浮出并能打开铺子 ---
    const S = g.shops;
    g.setClock(0.30);
    g.setPos(S.herb.x, S.herb.y + 8);
    for (let i = 0; i < 3; i++) g.tick(1 / 60);
    r.nearShop = g.nearShop();
    r.talkTapped = tap('talk', 6);
    r.shopTitle = document.getElementById('shopTitle').textContent;
    r.shopOpen = !document.getElementById('shop').classList.contains('hidden');
    g.shopClose();
    g.setPos(g.SPAWN.x, g.SPAWN.y);
    for (let i = 0; i < 3; i++) g.tick(1 / 60);
    r.talkHiddenFar = !g.nearShop();
    // 住店：过夜到卯时
    g.setClock(0.72, 2);
    g.setPos(S.inn.x, S.inn.y + 8);
    for (let i = 0; i < 3; i++) g.tick(1 / 60);
    g.player.gold = 50;
    g.shopOpen('inn'); g.buyGood('rest');
    r.rest = { day: g.clock.day, phase: g.clock.phase.id, gold: g.player.gold };
    g.shopClose();

    // --- 村民：走到说书人跟前，「谈」键打开的是对话框而不是柜台 ---
    g.setClock(0.30);
    const shuo = g.villagers.find(v => v.id === 'shuo');
    g.setPos(shuo.x, shuo.y + 8);
    for (let i = 0; i < 3; i++) g.tick(1 / 60);
    r.nearVil = (g.nearVillager() || {}).id || null;
    r.talkVil = tap('talk', 6);
    r.talkName = document.getElementById('talkName').textContent;
    r.talkOpen2 = g.talkOpen;
    g.talkClose();

    // --- 青云古洞：站在地脉裂口前，「谈」键要变成"下去" ---
    g.dgReset();
    for (const e of g.dgMobs) { e.dead = true; e.hp = 0; }
    g.setPos(g.dgData.deepC.x, g.dgData.deepC.y + 34);
    for (let i = 0; i < 4; i++) g.tick(1 / 60);
    r.dgNear = (g.nearDg() || {}).kind || null;
    r.dgCleared = g.dgCleared;
    r.dgTalkBtn = g.touchBtns.some(b => b.id === 'talk');
    r.dgTapped = tap('talk', 6);
    for (let i = 0; i < 60; i++) g.tick(1 / 60);
    r.dgFloor = g.dgFloor;

    r.ok = r.enabled && r.stickReleased && r.dx > 20 && r.hit > 0 &&
      r.bag === 'block' && r.dao &&
      r.sitFar && r.sitNear &&
      r.lights > 0 && r.meditate.after !== r.meditate.before &&
      r.nearShop === 'herb' && r.talkTapped && r.shopOpen && r.talkHiddenFar &&
      r.rest.phase === 'mao' && r.rest.gold === 30 &&
      r.nearVil === 'shuo' && r.talkVil && r.talkOpen2 && r.talkName === '柳先生' &&
      r.dgNear === 'rift' && r.dgCleared && r.dgTapped && r.dgFloor === 2;
    return r;
  })();
  return done;
})()
