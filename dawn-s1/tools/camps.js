// tools/camps.js · 营地生态自检（P2 验收）
// 巡逻 / 吹哨 / 食物链 / 作息 / 道具 / 首领
(() => {
  const g = window.__game;
  const R = { ok: false, checks: [] };
  const T = (n, c, d) => { R.checks.push((c ? 'PASS' : 'FAIL') + ' | ' + n + (d !== undefined ? ' | ' + d : '')); return !!c; };
  const step = (n, dt) => { for (let i = 0; i < n; i++) g.tick(dt || 0.016); };
  const alive = () => g.enemies.filter(e => !e.dead);
  const inCamp = c => alive().filter(e => e.camp === c);

  g.startGame(false);
  g.setLevel(12);
  step(2);

  // ---------- 1. 营地道具 ----------
  const noFire = g.camps.filter(c => !g.objects.some(o => o.kind === 'campfire'
    && Math.hypot(o.x - c.x, o.y - c.y) < 20));
  T('16 个营地都有篝火', g.camps.length === 16 && noFire.length === 0,
    g.camps.length + ' 个' + (noFire.length ? '，缺：' + noFire.map(c => c.name).join('/') : ''));
  const tents = g.objects.filter(o => o.kind === 'tent').length;
  const towers = g.objects.filter(o => o.kind === 'tower').length;
  T('帐篷与哨塔都摆出来了', tents >= 8 && towers >= 8, '帐篷 ' + tents + ' / 哨塔 ' + towers);

  // ---------- 2. 巡逻 ----------
  // 站在营地 300px 外，怪不该被惊动，但应该在动
  {
    const c = g.camps.find(x => x.name === '山贼哨营');
    g.setClock(0.35, 3);                       // 正午，山贼醒着
    g.setPos(c.x + 300, c.y + 300);
    step(4);
    const mine = inCamp(c);
    const before = mine.map(e => ({ e, x: e.x, y: e.y }));
    step(180);                                  // 约 3 秒
    const moved = before.filter(b => Math.hypot(b.e.x - b.x, b.e.y - b.y) > 4).length;
    T('营地外的怪在巡逻（不是站着不动）', moved >= 2, moved + '/' + mine.length + ' 只在动');
    T('站远处不会被惊动', mine.every(e => !e.aggro), mine.filter(e => e.aggro).length + ' 只 aggro');
  }

  // ---------- 3. 吹哨 ----------
  {
    const c = g.camps.find(x => x.name === '山贼哨营');
    const mine = inCamp(c).filter(e => !e.sleep);
    const one = mine[0];
    g.setPos(one.x + 18, one.y);
    step(60);
    const woke = mine.filter(e => e.aggro).length;
    T('打一只，附近同伴一起上', woke >= 2, woke + '/' + mine.length + ' 只被叫醒');
  }

  // ---------- 4. 脱离后回营 ----------
  {
    const c = g.camps.find(x => x.name === '山贼哨营');
    g.setPos(c.x + 600, c.y + 600);
    step(120);
    const back = inCamp(c).filter(e => !e.aggro).length;
    T('跑远之后会脱战', back >= 2, back + ' 只已脱战');
  }

  // ---------- 5. 食物链 ----------
  {
    const c = g.camps.find(x => x.name === '妖兽巢穴');
    const mine = inCamp(c);
    const pred = mine.find(e => e.type === 'shanxiao' || e.type === 'brute');
    const prey = mine.find(e => e.type === 'fox' || e.type === 'snake');
    if (pred && prey) {
      g.setClock(0.35, 3);
      g.setPos(c.x + 700, c.y + 700);          // 玩家别插手
      pred.hunt = null; pred.huntCd = 0; pred.aggro = false;
      prey.aggro = false; prey.sleep = false;
      pred.x = c.x; pred.y = c.y;
      prey.x = c.x + 50; prey.y = c.y;
      step(20);
      T('掠食者会盯上猎物', !!pred.hunt && pred.hunt.type === prey.type,
        pred.type + ' → ' + (pred.hunt ? pred.hunt.type : '无'));
      T('猎物被追会逃', prey.panicT > 0 || Math.hypot(prey.x - pred.x, prey.y - pred.y) > 52,
        'panicT=' + prey.panicT.toFixed(2));
    } else {
      T('掠食者会盯上猎物', false, '妖兽巢穴里没找到食肉/食草组合');
    }
  }

  // ---------- 6. 作息 ----------
  {
    const c = g.camps.find(x => x.name === '乱葬岗');
    g.setPos(c.x + 700, c.y + 700);
    g.setClock(0.35, 3); step(4);              // 正午
    const noon = inCamp(c);
    const noonGhosts = noon.filter(e => e.type === 'yinhun' || e.type === 'fukui');
    const noonBandit = noon.filter(e => e.type === 'zhiren' || e.type === 'brute');
    T('正午阴物在睡', noonGhosts.length > 0 && noonGhosts.every(e => e.sleep),
      noonGhosts.length + ' 只阴物，' + noonGhosts.filter(e => e.sleep).length + ' 只在睡');

    g.setClock(0.85, 3); step(4);              // 子时
    const night = inCamp(c);
    const nightGhosts = night.filter(e => e.type === 'yinhun' || e.type === 'fukui');
    T('子时阴物醒了', nightGhosts.length > 0 && nightGhosts.every(e => !e.sleep),
      nightGhosts.length + ' 只阴物，' + nightGhosts.filter(e => !e.sleep).length + ' 只醒着');
    // 昼行的在子时该睡：拿山贼哨营验，乱葬岗里全是夜行种，验不出来
    const c2 = g.camps.find(x => x.name === '山贼哨营');
    g.setPos(c2.x + 700, c2.y + 700);
    const bandits = inCamp(c2).filter(e => e.type === 'zhiren' || e.type === 'brute');
    // 前面吹哨测试刚把这几个叫醒过，wakeT 还没走完 —— 清掉再验作息
    for (const e of bandits) { e.wakeT = 0; e.aggro = false; }
    step(4);
    T('子时山贼在睡（昼行）', bandits.length > 0 && bandits.every(e => e.sleep),
      bandits.length + ' 个贼，' + bandits.filter(e => e.sleep).length + ' 个在睡');
  }

  // ---------- 7. 偷袭 ----------
  {
    g.setClock(0.35, 3); step(4);
    const c = g.camps.find(x => x.name === '守墓人小屋');
    g.setPos(c.x + 700, c.y + 700);
    step(4);
    const sleeper = inCamp(c).find(e => e.sleep);
    if (sleeper) {
      const hp0 = sleeper.hp;
      g.setPos(sleeper.x - 12, sleeper.y);
      g.setDir('right');
      g.player.atkCd = 0; g.player.atkBuf = 0;
      g.attack();
      step(6);
      T('打睡着的算偷袭，并且会醒', sleeper.hp < hp0 && !sleeper.sleep,
        '掉血 ' + Math.round(hp0 - sleeper.hp) + '，醒来=' + !sleeper.sleep);
    } else {
      T('打睡着的算偷袭，并且会醒', false, '正午没找到睡着的怪');
    }
  }

  // ---------- 8. 营地首领 ----------
  {
    const lords = g.enemies.filter(e => e.lord);
    // 第一章 3 个（教头 / 蛇母 / 守墓人）+ 第二章 2 个（墟主 / 坞主）
    T('五个营地首领都在', lords.length === 5 &&
      ['教头', '蛇母', '守墓人', '墟主', '坞主'].every(n => lords.some(e => e.lord === n)),
      lords.map(e => e.lord).join('/'));
    T('首领比普通怪硬', lords.every(e => e.elite && e.elite.hp > 2), lords.map(e => e.elite && e.elite.hp).join('/'));
    const lord = lords[0];
    if (lord) {
      lord.hp = 1;
      g.setPos(lord.x - 12, lord.y);
      g.setDir('right'); g.player.atkCd = 0; g.player.atkBuf = 0;
      const drops0 = g.drops.length;
      g.attack(); step(4);
      T('首领倒下有额外掉落', g.drops.length >= drops0 + 2, (g.drops.length - drops0) + ' 件');
    }
  }

  // ---------- 9. 营地阵容规模 ----------
  {
    g.startGame(false); step(2);
    const perCamp = g.camps.map(c => alive().filter(e => e.camp === c).length);
    T('每个营地 4~8 只（含夜行与首领）', perCamp.every(n => n >= 4 && n <= 8), perCamp.join('/'));
    // 16 营地后基线约 110 只 + 4 个巢穴首领 + 偶尔的精英。上限放到 130，
    // 下限守住 55 —— 掉到 55 以下说明有营地没刷满。
    T('怪总数在合理范围', alive().length >= 55 && alive().length <= 130, alive().length + ' 只');
  }

  R.ok = R.checks.every(c => c.startsWith('PASS'));
  return R;
})()
