// tools/mantras.js · 心法自检（P5.5 验收）
// 数据完整性 / 数值模板 / 装配互斥 / 存档降级 / 折进 stats /
// 12 条主心法的机制逐条 / 来源与学习 / 游方道人 / 面板 UI / 200 组组合的 DPS 分布
(() => {
  const g = window.__game;
  const R = { ok: false, checks: [] };
  const T = (n, c, d) => { R.checks.push((c ? 'PASS' : 'FAIL') + ' | ' + n + (d !== undefined ? ' | ' + d : '')); return !!c; };
  const FAMS = g.WEAPON_IDS;
  const MAIN = g.MAIN, SUB = g.SUB, MANTRAS = g.MANTRAS;

  // ---------- 场地 ----------
  // 和 tools/arts.js 同一个坑：spawnEnemy 有"青云集界内不落敌"的规则，
  // 站在村里放木桩，木桩会被搬回营地，几百像素外，什么都打不中。
  function arena(level) {
    g.startGame(false);
    g.setLevel(level || 20);
    const c = g.camps[0];
    let px = c.x, py = c.y;
    if (!g.canStand(px, py) || !g.canStand(px, py + 24)) {
      outer: for (let r = 8; r <= 72; r += 8) {
        for (let i = 0; i < 16; i++) {
          const a = i / 16 * Math.PI * 2;
          const x = c.x + Math.cos(a) * r, y = c.y + Math.sin(a) * r;
          if (g.canStand(x, y) && g.canStand(x, y - 10) && g.canStand(x, y + 24)) { px = x; py = y; break outer; }
        }
      }
    }
    g.setPos(px, py);
    g.clearEnemies();
    return { x: px, y: py };
  }

  // 干净底板：不穿装备、不点道行、不装心法 —— 否则每次比对都要先减掉一堆加成
  function clean(level) {
    const p = arena(level);
    const lv = level || 20;
    // atkBase 会被升级累积（每升一级 +2）。前面几节杀过怪，基线就被悄悄抬高了，
    // 后面的平衡数据全跟着漂 —— 实测同一组组合在"跑过其他断言之后"能高出七成。
    // 这里显式钉死成"刚好升到这一级"的值，clean() 才是真的干净。
    g.player.atkBase = 8 + (lv - 1) * 2;
    g.player.maxHpBase = 100 + (lv - 1) * 15;
    g.player.equip = { weapon: null, armor: null, necklace: null, artifact: null };
    g.player.skillLv = {};
    g.player.skillPts = 0;
    g.player.prof = {};
    for (const f of FAMS) g.player.prof[f] = 999;
    g.player.mantrasOwned = {};
    g.setMantras(null, [null, null]);
    // 天雷诀点上：不然 castThunder 每帧都往消息队列里塞一句"尚未参悟"
    try { g.givePoints(40); g.learnNode('tianlei'); } catch (e) { }
    g.player.hp = g.stats.hp;
    g.player.qi = g.stats.qiMax;
    return p;
  }

  // 木桩：血量给足，def=0，不动、不还手。
  // aggro 必须是 true —— 不然卯时打木桩会被判成"偷袭"，伤害 ×1.5，
  // 破军 / 追命这些按倍数比对的断言全都对不上。
  function dummy(x, y, hp) {
    const e = g.spawnDummy(x, y, hp || 1000);
    if (!e) return null;
    e.maxHp = e.hp = hp || 1000;
    e.def = 0; e.def0 = 0; e.cd = 99999; e.aggro = true; e.speed = 0;
    return e;
  }

  try {
    // ================= 1. 数据完整性 =================
    T('心法共 22 条（12 主 + 10 辅）',
      g.MANTRA_IDS.length === 22 && g.MAIN_IDS.length === 12 && g.SUB_IDS.length === 10,
      g.MAIN_IDS.length + ' 主 / ' + g.SUB_IDS.length + ' 辅');
    T('每条都有 id / kind / name / desc',
      g.MANTRA_IDS.every(id => {
        const a = MANTRAS[id];
        return a && a.id === id && (a.kind === 'main' || a.kind === 'sub') && a.name && a.desc;
      }), 'OK');
    T('主心法都有流派字', g.MAIN_IDS.every(id => !!MAIN[id].school), 'OK');
    // 没有代价的那条会变成所有人的默认答案 —— 这是整个系统最硬的一条约束
    T('每条主心法都写了代价', g.MAIN_IDS.every(id => !!MAIN[id].flaw),
      g.MAIN_IDS.filter(id => !MAIN[id].flaw).join(',') || '12/12');
    T('每条主心法都有明确来源', g.MAIN_IDS.every(id => MAIN[id].from && MAIN[id].from.kind), 'OK');
    T('每条辅心法都有标价', g.SUB_IDS.every(id => SUB[id].price > 0), 'OK');
    T('主心法不卖（不能靠买）', g.MAIN_IDS.every(id => !MAIN[id].price), 'OK');
    const mechSet = ['fullHpBonus', 'idleRegen', 'chainBonus', 'hitReduce', 'dashBurst',
      'burnOnHit', 'slowOnHit', 'idleStack', 'qiOnHurt', 'critResetCd'];
    T('机制字段都在已知集合内',
      g.MAIN_IDS.every(id => !MAIN[id].mech || mechSet.indexOf(MAIN[id].mech) >= 0),
      g.MAIN_IDS.map(id => MAIN[id].mech || '-').join(','));

    // ================= 2. 数值模板 =================
    const MOD_KEYS = Object.keys(g.mantraMod(null, null));
    T('mods 字段全部落在统计模板里',
      g.MANTRA_IDS.every(id => Object.keys(MANTRAS[id].mods || {}).every(k => MOD_KEYS.indexOf(k) >= 0)),
      MOD_KEYS.length + ' 个字段');
    // 单一来源伤害加成上限 40%：追命 / 藏锋原本按 60% 设计，压到 40% 才守得住这条规则
    const caps = g.MAIN_IDS.map(id => (MAIN[id].params && MAIN[id].params.cap) || 0);
    T('主心法的伤害加成都不超过 40%', caps.every(v => v <= 0.4 + 1e-9), caps.join(','));
    T('辅心法攻击加成 ≤ 10%',
      g.SUB_IDS.every(id => Math.abs((SUB[id].mods || {}).atkPct || 0) <= 10), 'OK');

    // ================= 3. 装配规则 =================
    const L = { main: null, sub: [null, null] };
    g.MANTRA_IDS.forEach(id => { g.player.mantrasOwned[id] = 1; });
    g.player.mantras = L;
    g.toggleMantra('pojun');
    T('点一下能装上主心法', L.main === 'pojun', String(L.main));
    g.toggleMantra('guiyuan');
    T('主心法互斥：装第二条顶掉第一条', L.main === 'guiyuan', L.main);
    g.toggleMantra('mingmu');
    g.toggleMantra('changxi');
    T('两个辅槽能装满', L.sub[0] === 'mingmu' && L.sub[1] === 'changxi', L.sub.join(','));
    g.toggleMantra('mofeng');
    T('第三个辅心法顶掉第一格', L.sub[0] === 'mofeng' && L.sub[1] === 'changxi', L.sub.join(','));
    g.toggleMantra('mofeng');
    T('再点一次卸下', L.sub[0] === null, String(L.sub[0]));
    g.toggleMantra('guiyuan');
    T('主心法也能点掉', L.main === null, String(L.main));

    // ================= 4. 存档降级 =================
    clean(20);
    g.player.mantrasOwned = { pojun: 2, mingmu: 1 };
    g.player.mantras = { main: 'pojun', sub: ['mingmu', 'guiyuan'] };   // guiyuan 没学过
    g.save(); g.load();
    T('读档丢掉没学过的心法', g.player.mantras.main === 'pojun' && g.player.mantras.sub[0] === 'mingmu'
      && g.player.mantras.sub[1] === null, JSON.stringify(g.player.mantras));
    T('读档保住注解等级', g.player.mantrasOwned.pojun === 2, String(g.player.mantrasOwned.pojun));
    g.player.mantrasOwned = { pojun: 99 };
    g.player.mantras = { main: 'pojun', sub: [null, null] };
    g.save(); g.load();
    T('注解等级被夹在 1~3', g.player.mantrasOwned.pojun === g.MANTRA_MAX_LV,
      '99 → ' + g.player.mantrasOwned.pojun);

    // ================= 5. 折进 stats =================
    const base = (function () { clean(20); return g.stats; })();
    // 裸装攻击只有 8 点，8×1.06 四舍五入回 8 —— 测百分比必须先把攻击抬到有意义的量级
    // 兵器属性是随机的：只能发一把、量一次，不能"重开一局再发一把"来对比
    const wBase = (function () { clean(20); g.equipFam('sword', 3); return g.stats.atk; })();
    g.setMantras(null, ['mofeng', null]);
    T('磨锋：攻击 +6%', Math.abs(g.stats.atk / wBase - 1.06) < 0.02,
      wBase + ' → ' + g.stats.atk);
    clean(20); g.setMantras(null, ['houtu', null]);
    T('厚土：气血 +15%', Math.abs(g.stats.hp / base.hp - 1.15) < 0.02,
      base.hp + ' → ' + g.stats.hp);
    clean(20); g.setMantras('kongming', [null, null]);
    const km = g.stats;
    T('空明：真气上限 +40%', Math.abs(km.qiMax / base.qiMax - 1.4) < 0.03, base.qiMax + ' → ' + km.qiMax);
    T('空明：术法 -10%', Math.round(km.skillDmg) === -10, String(km.skillDmg));
    clean(20); g.setMantras('xuehe', [null, null]);
    const xh = g.stats;
    T('血河：吸血 8% / 气血 -15%',
      Math.round(xh.lifesteal) === 8 && Math.abs(xh.hp / base.hp - 0.85) < 0.02,
      '吸血 ' + xh.lifesteal + '　气血 ' + base.hp + '→' + xh.hp);
    clean(20); g.setMantras(null, ['ruijin', null]);
    T('锐金：破防 10%', Math.round(g.stats.pierce) === 10, String(g.stats.pierce));
    clean(20); g.setMantras(null, ['jingshui', null]);
    T('静水：冷却 -10%', Math.round(g.stats.cdr) === 10, String(g.stats.cdr));
    clean(20); g.setMantras(null, ['tanlang', 'shiyi']);
    const ts = g.stats;
    T('贪狼 / 拾遗：银两 +20% / 掉落 +8%',
      Math.round(ts.goldMul) === 20 && Math.round(ts.dropMul) === 8, ts.goldMul + ' / ' + ts.dropMul);
    // 加法区：同一条不能算两遍（手改存档 / 老存档可能塞进重复项）
    clean(20); g.setMantras(null, ['mofeng', 'mofeng']);
    T('同一条辅心法不会算两遍', Math.round(g.mantraMods.atkPct) === 6, String(g.mantraMods.atkPct));

    // ================= 6. 十二条主心法的机制 =================
    // --- 破军：满血 +25%，残血 -10% ---
    (function () {
      const p = clean(20); g.setMantras('pojun', [null, null]);
      const d = dummy(p.x + 24, p.y, 1000);
      const full = g.hitEnemy(d, { dmg: 100 }, 0, 0);
      d.hp = 400;   // 40%
      const low = g.hitEnemy(d, { dmg: 100 }, 0, 0);
      T('破军：满血 +25% / 残血 -10%', full === 125 && low === 90, full + ' / ' + low);
    })();

    // --- 归元：脱战 3 秒后回血 ---
    (function () {
      clean(20); g.setMantras('guiyuan', [null, null]);
      const hp0 = g.player.hp = g.stats.hp * 0.5;
      for (let i = 0; i < 60; i++) g.tickLogic(1 / 30);    // 2 秒：还在延迟里
      const early = g.player.hp;
      for (let i = 0; i < 150; i++) g.tickLogic(1 / 30);   // 再 5 秒
      T('归元：脱战 3 秒内不回血', Math.abs(early - hp0) < 1, hp0.toFixed(0) + ' → ' + early.toFixed(0));
      T('归元：之后持续回血', g.player.hp > early + 5, early.toFixed(0) + ' → ' + g.player.hp.toFixed(0));
    })();

    // --- 追命：连击递增，换目标清零 ---
    (function () {
      const p = clean(20); g.setMantras('zhuiming', [null, null]);
      const d1 = dummy(p.x + 24, p.y, 1e6);
      const d2 = dummy(p.x - 24, p.y, 1e6);
      const seq = [];
      for (let i = 0; i < 6; i++) seq.push(g.hitEnemy(d1, { dmg: 100 }, 0, 0));
      const before = seq[seq.length - 1];
      g.hitEnemy(d2, { dmg: 100 }, 0, 0);            // 换目标
      const after = g.hitEnemy(d1, { dmg: 100 }, 0, 0);
      T('追命：同一目标逐击递增', seq[0] < seq[2] && seq[2] < seq[5], seq.join('→'));
      T('追命：换目标后清零重来', after < before, before + ' → ' + after);
    })();

    // --- 铁衣：受击后 2 秒减伤 30%，叠 2 层 ---
    (function () {
      clean(20); g.setMantras('tieyi', [null, null]);
      const h0 = g.player.hp;
      g.player.iframe = 0; g.hurtPlayer(60);
      const r1 = h0 - g.player.hp;
      g.player.iframe = 0; g.hurtPlayer(60);
      const r2 = (h0 - g.player.hp) - r1;
      T('铁衣：第一下白挨，第二下减伤三成', Math.abs(r2 / r1 - 0.7) < 0.08, r1 + ' → ' + r2);
    })();

    // --- 疾风：闪避后下一击 +40% ---
    (function () {
      const p = clean(20); g.setMantras('jifeng', [null, null]);
      const d = dummy(p.x + 24, p.y, 1e6);
      const plain = g.hitEnemy(d, { dmg: 100 }, 0, 0);
      g.player.iframe = 1; g.hurtPlayer(10);          // 闪避成功
      const boosted = g.hitEnemy(d, { dmg: 100 }, 0, 0);
      T('疾风：移速 +12%', Math.round(g.stats.spd) === 12, String(g.stats.spd));
      T('疾风：闪避后下一击 +40%', boosted > plain * 1.3, plain + ' → ' + boosted);
      const again = g.hitEnemy(d, { dmg: 100 }, 0, 0);
      T('疾风：加成只给一击', again === plain, plain + ' → ' + again);
    })();

    // --- 焚心：命中挂灼烧，吃真气 ---
    (function () {
      const p = clean(20); g.setMantras('fenxin', [null, null]);
      const d = dummy(p.x + 24, p.y, 1e6);
      g.player.qi = g.stats.qiMax * 0.4;
      const q0 = g.player.qi;
      g.hitEnemy(d, { dmg: 100 }, 0, 0);
      T('焚心：命中挂灼烧', d.burnT > 0 && d.burn > 0,
        'burn ' + Math.round(d.burn) + '/s × ' + d.burnT.toFixed(1) + 's');
      // 命中本身回 3 点真气，焚心扣 5 点 —— 净 -2。
      // 这里写成 -2 而不是"扣 5"，因为玩家体感的是"打一下掉两点气"。
      T('焚心：每次命中净耗 2 真气', Math.abs((g.player.qi - q0) + 2) < 0.01,
        q0.toFixed(0) + ' → ' + g.player.qi.toFixed(0));
      // 真气见底就点不着 —— 这是代价，不是 bug
      g.player.qi = 0; d.burnT = 0;
      g.hitEnemy(d, { dmg: 100 }, 0, 0);
      T('焚心：真气不足时不触发', d.burnT === 0, String(d.burnT));
    })();

    // --- 寒潭：对被减速目标 +20% ---
    (function () {
      const p = clean(20); g.setMantras('hantan', [null, null]);
      const d = dummy(p.x + 24, p.y, 1e6);
      const plain = g.hitEnemy(d, { dmg: 100 }, 0, 0);
      d.slowT = 2; d.slowPct = 0.4;
      const slow = g.hitEnemy(d, { dmg: 100 }, 0, 0);
      T('寒潭：对被减速目标 +18%', slow === Math.round(plain * 1.18), plain + ' → ' + slow);
    })();

    // --- 藏锋：蓄层，出招消耗 ---
    (function () {
      const p = clean(20); g.setMantras('cangfeng', [null, null]);
      for (let i = 0; i < 90; i++) g.tickLogic(1 / 30);   // 3 秒不动
      const stacks = g.player.mCang;
      g.mantraOnCast();
      const bonus = g.player.mCangBonus;
      T('藏锋：不出招时蓄层', stacks >= 2 && stacks <= 5, stacks + ' 层');
      T('藏锋：出招把层换成加成', Math.abs(bonus - stacks * 0.08) < 1e-6, bonus.toFixed(2));
      T('藏锋：出招后清零', g.player.mCang === 0, String(g.player.mCang));
      const d = dummy(p.x + 24, p.y, 1e6);
      const hit = g.hitEnemy(d, { dmg: 100 }, 0, 0);
      T('藏锋：加成吃在第一击上', hit > 100, String(hit));
      T('藏锋：一击之后加成消失', g.player.mCangBonus === 0, String(g.player.mCangBonus));
    })();

    // --- 卸力：受击转真气 ---
    (function () {
      clean(20); g.setMantras('xieli', [null, null]);
      g.player.qi = 0;
      g.player.iframe = 0;
      const h0 = g.player.hp;
      g.hurtPlayer(60);
      const took = h0 - g.player.hp;
      T('卸力：受击伤害 20% 转真气',
        Math.abs(g.player.qi - took * 0.2) < 1.01, '掉血 ' + took + '　回气 ' + g.player.qi);
    })();

    // --- 无常：暴击重置冷却 ---
    (function () {
      clean(20); g.setMantras('wuchang', [null, null]);
      const s = g.stats;
      T('无常：暴击 +15% / 暴伤 -30%',
        Math.round(s.crit) === 20 && Math.round(s.critDmg) === 120, s.crit + '% / ' + s.critDmg + '%');
      // 25% 概率那一层是随机的，不该拿随机去验确定性 —— 直接验"减半"本身
      g.player.loadout[0] = 'sword_1';
      g.artCds.sword_1 = 3;
      const ok = g.resetOneCd();
      T('无常：能把一个招式的剩余冷却减半', ok === true && Math.abs((g.artCds.sword_1 || 0) - 1.5) < 1e-6,
        'sword_1 cd 3 → ' + (g.artCds.sword_1 || 0));
    })();

    // --- 血河：真吸血 ---
    (function () {
      const p = clean(20); g.setMantras('xuehe', [null, null]);
      g.player.hp = g.stats.hp * 0.5;
      const h0 = g.player.hp;
      const d = dummy(p.x + 24, p.y, 1e6);
      const dealt = g.hitEnemy(d, { dmg: 200 }, 0, 0);
      T('血河：伤害 8% 转气血', Math.abs((g.player.hp - h0) - dealt * 0.08) < 1.01,
        '打 ' + dealt + '　回 ' + (g.player.hp - h0).toFixed(0));
    })();

    // ================= 7. 来源与学习 =================
    (function () {
      clean(20);
      g.player.mantrasOwned = {};
      g.player.bossKills = {};
      // 8 个首领全打一遍 + 三条里程碑
      for (const b of ['qingshe', 'kuilei', 'shimu', 'huoya', 'wumian', 'treant', 'yaowang', 'boss']) {
        g.player.bossKills[b] = 1;
      }
      g.player.kills = 300; g.player.fame = 40; g.player.level = 18;
      g.checkMantraUnlocks();
      T('8 个首领 + 3 个里程碑能解锁全部 12 条主心法',
        g.MAIN_IDS.every(id => g.player.mantrasOwned[id]),
        Object.keys(g.player.mantrasOwned).length + '/12');
      // 首领那一格真的从 killEnemy 走一遍
      clean(20);
      g.player.mantrasOwned = {};
      g.player.bossKills = {};
      const bs = g.spawnEnemy('qingshe', g.player.x + 40, g.player.y, null);
      if (bs) { bs.hp = 1; g.hitEnemy(bs, { dmg: 99999 }, 0, 0); }
      T('斩青鳞蟒当场悟得「破军」', !!g.player.mantrasOwned.pojun, JSON.stringify(g.player.bossKills));
      const tr = g.spawnEnemy('treant', g.player.x + 40, g.player.y, null);
      if (tr) { tr.hp = 1; g.hitEnemy(tr, { dmg: 99999 }, 0, 0); }
      T('树妖走自己的分支也计入 bossKills',
        (g.player.bossKills.treant || 0) > 0 && !!g.player.mantrasOwned.guiyuan, 'treant → guiyuan');
    })();

    // ================= 8. 游方道人 =================
    (function () {
      clean(20);
      const sh = g.shops.daoshi;
      T('游方道人已挂在青云集', !!sh && !!sh.keeper, sh ? sh.keeper : 'missing');
      T('道人站位站得住', !!sh && g.canStand(sh.x, sh.y), sh ? sh.x + ',' + sh.y : '');
      T('道人通宵不关', !!sh && sh.openWhen === 'always', sh && sh.openWhen);
      g.player.mantrasOwned = {};
      g.player.gold = 999999;
      g.player.mantras = { main: null, sub: [null, null] };
      g.buyMantra('mingmu');
      T('道人处能学辅心法', !!g.player.mantrasOwned.mingmu && g.player.mantras.sub[0] === 'mingmu',
        JSON.stringify(g.player.mantras));
      const g0 = g.player.gold;
      g.buyMantra('mingmu');
      T('学过的不再重复收钱', g.player.gold === g0, '银两 ' + g.player.gold);
      g.player.gold = 0;
      g.buyMantra('houtu');
      T('银两不够买不了', !g.player.mantrasOwned.houtu, String(g.player.mantrasOwned.houtu || 0));
      T('道人只卖辅心法',
        g.SUB_IDS.every(id => SUB[id].price > 0) && g.MAIN_IDS.every(id => !MAIN[id].price), 'OK');
    })();

    // ================= 9. 面板 UI =================
    (function () {
      let err = null;
      try {
        clean(20);
        g.player.mantrasOwned = { pojun: 1, mingmu: 2 };
        g.player.mantras = { main: 'pojun', sub: ['mingmu', null] };
        g.toggleInv(true);
        g.showInvPage('mantra');
        const html = document.getElementById('mantraPage').innerHTML;
        T('心法页画出了三条槽', (html.match(/data-mslot=/g) || []).length === 3,
          (html.match(/data-mslot=/g) || []).length + ' 槽');
        T('未学的也列出来并标了来源', html.indexOf('得法：') > 0, 'OK');
        T('代价写在卡面上', html.indexOf('代价：') > 0, 'OK');
        g.showInvPage('bag');
        T('能切回行囊页', g.mantraPageOn === 'bag', g.mantraPageOn);
        g.toggleInv(false);
      } catch (e) { err = e.message; }
      T('心法面板渲染不报错', err === null, err || 'OK');
    })();

    // ================= 10. 平衡：200 组组合的 DPS 分布 =================
    // 判据 P95 / P50 ≤ 1.35 —— 最强组合不能比中位数强太多，
    // 否则"构筑"就退化成"背答案"。
    (function () {
      const SEC = 8, DT = 1 / 30;
      const N = Math.round(SEC / DT);

      // 把 Math.random 整个换成固定序列。
      // equipFam 内部是 makeGear(..., Math.random, ...)，兵器词条是**随机滚**的 ——
      // 不钉死的话每次加载页面拿到的剑都不一样，整条基线能差四成
      // （实测连跑四次 P50 = 2943 / 3856 / 4208 / 3331）。
      // 比值不受影响（同一次运行内自己比自己），但"改完数值有没有用"只能看绝对值，
      // 而绝对值在飘的时候，任何一次调参都看不出效果。
      const realRandom = Math.random;
      let rseed = 20261110;
      Math.random = () => {
        rseed = (rseed * 1664525 + 1013904223) & 0x7fffffff;
        return rseed / 0x7fffffff;
      };

      const p0 = clean(20);
      g.equipFam('sword', 3);   // 固定一把兵器：兵器差异是另一条曲线，不该混进心法的分布里

      function run() {
        g.setDir('right');
        const d = dummy(p0.x + 26, p0.y, 200000);
        if (!d) return 0;
        const hp0 = d.hp;
        let elapsed = 0;
        for (let i = 0; i < N; i++) {
          // 木桩钉住：击退会把目标推远，一会儿就打不着了
          d.x = p0.x + 26; d.y = p0.y; d.kvx = 0; d.kvy = 0;
          if (g.player.atkCd <= 0) g.attack();
          for (let k = 0; k < 6; k++) g.castArt(k);
          g.castQi(); g.castWu(); g.castThunder();
          // 关掉顿帧：hitstop 会让 update 整帧提前返回，连 atkCd 都不扣，
          // 于是"这一刀停多久"直接决定了八秒里能挥几刀 —— 实测同一组组合能差 55%。
          // 顿帧是打击感，不该参与 DPS 的测量。
          g.hitstop = 0;
          g.tickLogic(DT);
          elapsed += DT;
          if (d.hp <= 0) break;
        }
        return Math.max(0, hp0 - d.hp) / Math.max(0.5, elapsed);
      }
      function comboDps(mainId, subs) {
        g.resetCombat();          // 只清战斗状态，不重建世界 —— 200 次 startGame 太慢
        // 时辰钉在正午：200 组 × 8 秒 = 26 分钟游戏时间，足够跨过卯时与子时。
        // 晨雾偷袭 ×1.5、夜行怪的属性都跟着时辰走，不钉死的话前后样本不在同一个世界里。
        g.setClock(0.5, 1);
        g.setMantras(mainId, subs);
        return run();
      }

      // 固定随机序列：每次跑出来的分布要能对上，不然调完数值没法判断有没有用
      let seed = 20261110;
      const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
      const samples = [];
      for (let i = 0; i < 200; i++) {
        const mainId = g.MAIN_IDS[(rnd() * g.MAIN_IDS.length) | 0];
        const pool = g.SUB_IDS.slice();
        const a = pool.splice((rnd() * pool.length) | 0, 1)[0];
        const b = pool.splice((rnd() * pool.length) | 0, 1)[0];
        samples.push({ dps: comboDps(mainId, [a, b]), main: mainId, subs: [a, b] });
      }
      const dps = samples.map(s => s.dps).sort((x, y) => x - y);
      const pick = q => dps[Math.min(dps.length - 1, Math.floor(dps.length * q))];
      const p50 = pick(0.5), p95 = pick(0.95);
      const ratio = p95 / Math.max(1, p50);

      const naked = (function () {
        g.resetCombat(); g.setClock(0.5, 1); g.setMantras(null, [null, null]);
        return run();
      })();
      // 同一组组合连跑五次：分布是不是噪声，就看这个。差得多了，
      // P95 就只是运气好的一组，不说明任何事。
      const rep = [];
      for (let i = 0; i < 5; i++) {
        g.resetCombat(); g.setClock(0.5, 1);
        g.setMantras('zhuiming', ['mofeng', 'qingshen']);
        rep.push(run());
      }
      const repMin = Math.min.apply(null, rep), repMax = Math.max.apply(null, rep);
      T('同一组合连跑五次，波动 ≤ 20%', repMax / repMin <= 1.2,
        rep.map(v => v.toFixed(0)).join(' / ') + '　极差 ' + ((repMax / repMin - 1) * 100).toFixed(0) + '%');
      T('200 组组合都打出了伤害', dps[0] > 0, '最低 ' + dps[0].toFixed(0) + ' dps');
      T('DPS 分布 P95 / P50 ≤ 1.35', ratio <= 1.35,
        'P50 ' + p50.toFixed(0) + '　P95 ' + p95.toFixed(0) + '　比值 ' + ratio.toFixed(2));
      const top = samples.slice().sort((x, y) => y.dps - x.dps).slice(0, 3)
        .map(s => s.main + '+' + s.subs.join('+') + ' ' + s.dps.toFixed(0));
      const bot = samples.slice().sort((x, y) => x.dps - y.dps).slice(0, 3)
        .map(s => s.main + '+' + s.subs.join('+') + ' ' + s.dps.toFixed(0));
      T('最强三组', ratio <= 1.35, top.join('　'));
      T('最弱三组', true, bot.join('　'));
      // 不能有"带了反而更弱"的陷阱组合。防御类主心法（归元 / 铁衣 / 卸力）
      // 换的是活命不是输出，掉到裸装的八成可以接受，掉到一半就是设计错了。
      T('没有组合比裸装弱一半以上', dps[0] > naked * 0.5,
        '裸装 ' + naked.toFixed(0) + '　最弱 ' + dps[0].toFixed(0));
      R.balance = { p50: Math.round(p50), p95: Math.round(p95), ratio: +ratio.toFixed(3), naked: Math.round(naked), min: Math.round(dps[0]) };
      Math.random = realRandom;   // 还回去，别把后面要加的断言也拖进固定序列
    })();
  } catch (err) {
    // 脚本自己抛异常时，run.js 只会打印 "undefined"，什么都看不出来
    R.checks.push('FAIL | 脚本异常 | ' + err.message + ' @ ' + String(err.stack || '').split('\n')[1]);
  }

  R.ok = R.checks.every(c => c.indexOf('PASS') === 0);
  return R;
})();
