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
    T('每招字段齐全且 fx 在十四种原语内', bad.length === 0, bad.join(' / ') || 'OK');

    const fxs = new Set(ids.map(id => g.ARTS[id].fx));
    T('覆盖 14 种效果原语', fxs.size === 14, [...fxs].join('/'));
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

  // ---------- 1.1 招式签名：形状 / 动作 / 色彩，同兵器内不许重复 ----------
  // ARTS-DESIGN.md §1 的四条硬规矩里，能自动断言的三条都在这里。
  // 这一节是"64 招千篇一律"那个问题的验收线：以后加招、改招，
  // 只要和同兵器的另一招撞了签名，这里就直接红，不用等玩家来说"怎么都一样"。
  // 第四条（声音）目前没有可查的表，靠 ARTS-DESIGN.md 逐条对。
  {
    const dup = [], badShape = [], badPose = [], noColor = [];
    for (const f of FAMS) {
      const seen = {};
      for (const a of g.artsOfWeapon(f)) {
        const sh = g.artShape(a), po = g.artPose(a);
        const col = g.artColor(a, g.WEAPONS[f].trail);
        if (g.ART_SHAPES.indexOf(sh) < 0) badShape.push(a.name + ':' + sh);
        if (g.ART_POSES.indexOf(po) < 0) badPose.push(a.name + ':' + po);
        if (!Array.isArray(col) || !col[0]) noColor.push(a.name);
        const sig = sh + '|' + po + '|' + (Array.isArray(col) ? col[0] : col);
        if (seen[sig]) dup.push(g.WEAPONS[f].name + ' ' + seen[sig] + '≈' + a.name + '(' + sig + ')');
        else seen[sig] = a.name;
      }
    }
    T('形状/动作都登记在 ART_SHAPES / ART_POSES 里',
      badShape.length === 0 && badPose.length === 0,
      badShape.concat(badPose).join(' ') || 'OK');
    T('每招都拿得到刀光色', noColor.length === 0, noColor.join('/') || 'OK');
    // 锤是 P10 的试点：八招八种形状、八种动作、八种颜色，一格都不许重
    const dupHammer = dup.filter(s => s.indexOf('锤') === 0);
    T('锤的八招签名互不相同', dupHammer.length === 0, dupHammer.join(' / ') || 'OK');
    // 其余七件还没重做，这是"欠账数"。每做完一件就把 7 减一，最后必须到 0。
    const dupFams = [...new Set(dup.map(s => s.split(' ')[0]))];
    T('签名撞车的兵器只剩 7 件（每重做一件就把这个数减一）',
      dupFams.length <= 7, dupFams.length + ' 件：' + (dupFams.join('/') || '无'));
  }

  // ---------- 1.2 八张连拍：武器角度必须各不相同 ----------
  // ARTS-DESIGN.md §6 第 4 条。以前 64 招的 a0/a1 全是 0，连拍八张会是八张一样的图，
  // 这一条就是拿来卡住那件事的 —— 用数字卡，不靠人眼。
  // 取"施法后固定 0.15 息"而不是进度百分比：起手长的招那时才刚抬起来，
  // 按百分比量的话「震地」和「开天辟地」会算出几乎同一个角度。
  {
    const rows = [];
    for (const a of g.artsOfWeapon('hammer')) {
      const sw = a.pose
        ? { mode: a.pose.mode, a0: a.pose.a0 || 0, a1: a.pose.a1 || 0, dur: a.pose.dur || 0.22, ease: a.pose.ease }
        : { mode: a.fx === 'proj' ? 'thrust' : 'swing', a0: 0, a1: 0, dur: 0.22 };
      const p = Math.min(1, 0.15 / sw.dur);
      rows.push({ n: a.name, ang: g.swingAng(sw, 0, p).ang });
    }
    let minGap = 9, pair = '';
    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        const gap = Math.abs(rows[i].ang - rows[j].ang);
        if (gap < minGap) { minGap = gap; pair = rows[i].n + '↔' + rows[j].n; }
      }
    }
    T('锤的八招在 0.15 息时武器角度各不相同（最近一对也差 ≥ 7°）', minGap >= 0.12,
      rows.map(r => r.n + (r.ang * 57.3).toFixed(0) + '°').join(' ')
      + ' · 最近一对 ' + pair + ' 差 ' + (minGap * 57.3).toFixed(1) + '°');
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
  // P9 重做了装配页（剑匣 + 招式库 + 拖拽），"先选中一格"这个中间态没有了。
  // 三个动作各验一条：拖到指定格 / 拖到已占格（互换）/ 点格子（卸下）。
  {
    g.startGame(false);
    g.player.prof = { sword: 999 };
    g.equipFam('sword');
    g.setLoadout(['sword_1', 'sword_2', 'sword_3', 'sword_4', 'sword_5', 'sword_6']);
    // 满槽时点一招没装上的：不能悄悄顶掉第 0 格
    const before = g.player.loadout.slice();
    const put = g.artPlace('sword_7');
    T('满槽且未指定格时装不上', put === false, 'loadout=' + g.player.loadout.join(','));
    T('满槽时不该被悄悄顶掉第 0 格', JSON.stringify(g.player.loadout) === JSON.stringify(before), 'OK');

    // 拖到指定格：直接落进那一格
    const ok = g.artPlace('sword_7', 3);
    T('拖到第 4 格就装进第 4 格', ok === true && g.player.loadout[3] === 'sword_7',
      g.player.loadout.map(x => x || '-').join(','));
    // 拖到已占的格：两格互换，原来那招不能被挤没
    const a0 = g.player.loadout[0];
    g.artPlace('sword_7', 0);
    T('拖到已占格是互换不是顶掉',
      g.player.loadout[0] === 'sword_7' && g.player.loadout[3] === a0,
      g.player.loadout.map(x => x || '-').join(','));
    // 点格子 = 直接卸下（不需要先选中）
    g.artSlotClick(0);
    T('点格子直接卸下', g.player.loadout[0] === null, g.player.loadout.map(x => x || '-').join(','));
    // 点招式卡 = 装进第一个空格
    g.artPlace('sword_7');
    T('点招式卡装进第一个空格', g.player.loadout[0] === 'sword_7',
      g.player.loadout.map(x => x || '-').join(','));
    // 再点一次 = 卸下
    g.artPlace('sword_7');
    T('再点一次能卸下', g.player.loadout[0] === null, g.player.loadout.map(x => x || '-').join(','));
    // 手动排过之后，autoLoadout 不再偷偷补位
    g.player.loadout[1] = null;
    g.autoLoadout();
    T('手动卸下的格子不会被自动补回', g.player.loadout[1] === null,
      g.player.loadout.map(x => x || '-').join(','));
  }

  // ---------- 4.2 装配页 DOM：剑匣六格 + 招式按功能位分组 ----------
  // 这几条是防"渲染挂了但逻辑还对"：renderArts 抛错时装配逻辑照样能跑，
  // 玩家看到的却是一个空面板。
  {
    const box = document.getElementById('skills');
    box.classList.remove('hidden');
    g.showArtPage(true);
    const slots = document.querySelectorAll('#artQuiver .artSlot');
    T('剑匣渲染出六格', slots.length === 6, slots.length);
    T('招式页切宽版', box.classList.contains('wide'), box.className);
    const cards = document.querySelectorAll('#artLib .artCard');
    T('招式卡都渲染出来', cards.length >= 8, cards.length);
    const grps = document.querySelectorAll('#artLib .artGrp');
    T('招式卡按功能位分组', grps.length >= 2, grps.length + ' 组');
    // 已上阵的卡要有 armed 标记，否则"我带了哪几招"在右栏看不出来
    const armed = document.querySelectorAll('#artLib .artCard.armed');
    T('已上阵的卡有 armed 标记', armed.length === g.player.loadout.filter(Boolean).length,
      armed.length + '/' + g.player.loadout.filter(Boolean).length);
    // 剑匣格子上要带功能位色（--gc），否则左栏认不出是哪一类
    const tinted = document.querySelectorAll('#artQuiver .artSlot.on[style*="--gc"]');
    T('剑匣格子带功能位色', tinted.length === g.player.loadout.filter(Boolean).length,
      tinted.length + ' 格');
    g.showArtPage(false);
    box.classList.add('hidden');
  }

  // ---------- 4.3 拖拽真的能装上 ----------
  // 拖拽是手写 pointer 事件，只验 artPlace() 等于没验 —— 断的往往是事件那一层。
  // 这里按真实链路派发 pointerdown → pointermove → pointerup，
  // 坐标取真实 getBoundingClientRect，落点靠 elementFromPoint 认。
  {
    const box = document.getElementById('skills');
    box.classList.remove('hidden');
    g.player.prof = { sword: 999 };
    g.equipFam('sword');
    g.setLoadout(['sword_1']);
    g.showArtPage(true);
    // 面板刚从 hidden 恢复时量坐标可能是 0（样式还没落定），
    // 那样拖拽会落在 (0,0)、elementFromPoint 什么也找不到 —— 表现为随机 FAIL。
    // 读一次 offsetHeight 强制同步重排。
    void box.offsetHeight;

    const card = document.querySelector('#artLib .artCard[data-art="sword_5"]');
    const slot = document.querySelector('#artQuiver .artSlot[data-slot="3"]');
    T('拖拽前找得到卡片与目标格', !!card && !!slot, !!card + '/' + !!slot);
    if (card && slot) {
      const cr = card.getBoundingClientRect();
      const sr = slot.getBoundingClientRect();
      const base = {
        bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse',
        isPrimary: true, button: 0,
      };
      const at = (x, y, extra) => new PointerEvent('pointermove', Object.assign({}, base, { clientX: x, clientY: y }, extra));
      card.dispatchEvent(new PointerEvent('pointerdown', Object.assign({}, base, {
        clientX: cr.left + 12, clientY: cr.top + 12, buttons: 1,
      })));
      // 先走一小步越过 7px 阈值，再走到格子上 —— 不越过阈值会被当成"点击"
      card.dispatchEvent(at(cr.left + 12, cr.top + 26, { buttons: 1 }));
      card.dispatchEvent(at(sr.left + sr.width / 2, sr.top + sr.height / 2, { buttons: 1 }));
      T('拖拽中目标格高亮', slot.classList.contains('over'), slot.className);
      card.dispatchEvent(new PointerEvent('pointerup', Object.assign({}, base, {
        clientX: sr.left + sr.width / 2, clientY: sr.top + sr.height / 2, buttons: 0,
      })));
      T('拖到第 4 格后招式真的进了第 4 格', g.player.loadout[3] === 'sword_5',
        g.player.loadout.map(x => x || '-').join(','));
      T('拖拽结束后高亮被清掉',
        !document.querySelector('#artQuiver .artSlot.over'), 'ok');
      T('拖拽幽灵被回收', !document.getElementById('artGhost'), 'ok');
    }
    g.showArtPage(false);
    box.classList.add('hidden');
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

  // ---------- 6.1 四种新原语（P10 · 锤的试点带出来的） ----------
  // 这四条验的不是"伤害有没有生效"，是**这一招的形状对不对**：
  // 回旋锤的锤要离手再回来；震地要有波前；冲锋要会停；开天辟地要是一条线。
  {
    // 回旋锤：锤真的脱手、去程回程都打到人、最后回到手上
    arena(14);
    g.equipFam('hammer');
    g.setLoadout(['hammer_2']);
    g.setDir('down');
    g.player.qi = 999;
    const near = g.spawnDummy(g.player.x, g.player.y + 40, 99999);
    const far = g.spawnDummy(g.player.x, g.player.y + 150, 99999);
    g.castArt(0);
    T('回旋锤：锤真的脱手了', g.boomerangs.length === 1, g.boomerangs.length);
    T('回旋锤：脱手那会儿手上是空的', g.player.throwHide > 0, (g.player.throwHide || 0).toFixed(2));
    const n0 = near.hp, f0 = far.hp;
    step(40);
    T('回旋锤：去程打到近处的人', near.hp < n0, (n0 - near.hp).toFixed(0));
    T('回旋锤：去程也打到远处的人', far.hp < f0, (f0 - far.hp).toFixed(0));
    step(80);
    T('回旋锤：锤回到手上（通道清空）', g.boomerangs.length === 0, g.boomerangs.length);

    // 震地：波前有速度 —— 近处先挨，远处晚半拍
    arena(14);
    g.equipFam('hammer');
    g.setLoadout(['hammer_3']);
    g.player.qi = 999;
    const e1 = g.spawnDummy(g.player.x + 30, g.player.y, 99999);
    const e2 = g.spawnDummy(g.player.x + 70, g.player.y, 99999);
    g.castArt(0);
    T('震地：场上出现了扩散中的波', g.waves.length === 1, g.waves.length);
    const h1 = e1.hp, h2 = e2.hp;
    step(14);
    T('震地：近处先被扫到', e1.hp < h1, (h1 - e1.hp).toFixed(0));
    T('震地：远处还没轮到（波前没到）', e2.hp === h2,
      'r=' + (g.waves[0] ? g.waves[0].r.toFixed(0) : '已走完'));
    step(60);
    T('震地：波扩到远处，远处也挨了', e2.hp < h2, (h2 - e2.hp).toFixed(0));
    T('震地：波走完就消失', g.waves.length === 0, g.waves.length);

    // 冲锋锤：撞上第一个就停，不穿过去
    arena(14);
    g.equipFam('hammer');
    g.setLoadout(['hammer_5']);
    g.player.qi = 999;
    // 营地圆心常压着篝火 / 石台，朝右 7px 就是实心 —— 冲锋会在第一步被地形卡住。
    // 所以先挑一个"身前 20px 和 84px 都站得住"的方向，再照着这个方向摆木桩。
    const DIRV = { right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1] };
    let cdir = 'right';
    for (const d of ['right', 'left', 'down', 'up']) {
      const [vx, vy] = DIRV[d];
      if (g.canStand(g.player.x + vx * 20, g.player.y + vy * 20) &&
          g.canStand(g.player.x + vx * 84, g.player.y + vy * 84)) { cdir = d; break; }
    }
    g.setDir(cdir);
    const [cvx, cvy] = DIRV[cdir];
    const cx = g.player.x, cy = g.player.y;
    const c1 = g.spawnDummy(cx + cvx * 30, cy + cvy * 30, 99999);
    const c2 = g.spawnDummy(cx + cvx * 70, cy + cvy * 70, 99999);
    g.castArt(0);
    const moved = Math.hypot(g.player.x - cx, g.player.y - cy);
    T('冲锋锤：人确实冲出去了', moved > 10, cdir + ' ' + moved.toFixed(1) + 'px');
    T('冲锋锤：撞上就停，没冲满 84', moved < 80, moved.toFixed(1) + 'px');
    T('冲锋锤：第一个目标挨了打', c1.hp < c1.maxHp, (c1.maxHp - c1.hp).toFixed(0));
    T('冲锋锤：后面那个没被穿过去', c2.hp === c2.maxHp, (c2.maxHp - c2.hp).toFixed(0));

    // 开天辟地：一条线，不是一个圆
    arena(14);
    g.equipFam('hammer');
    g.setLoadout(['hammer_8']);
    g.setDir('down');
    g.player.qi = 999;
    const front = g.spawnDummy(g.player.x, g.player.y + 90, 99999);
    const behind = g.spawnDummy(g.player.x, g.player.y - 90, 99999);
    const side = g.spawnDummy(g.player.x + 120, g.player.y, 99999);
    g.castArt(0);
    T('开天辟地：正前方 90px 的人挨了', front.hp < front.maxHp, (front.maxHp - front.hp).toFixed(0));
    T('开天辟地：身后的人没被圈到', behind.hp === behind.maxHp, (behind.maxHp - behind.hp).toFixed(0));
    T('开天辟地：正侧面 120px 的人没被圈到', side.hp === side.maxHp, (side.maxHp - side.hp).toFixed(0));
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
