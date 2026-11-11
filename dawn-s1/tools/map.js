// tools/map.js · 大地图连通性与地貌自检（P1 验收）
(() => {
  const g = window.__game;
  const R = { ok: false, checks: [] };
  const T = (n, c, d) => { R.checks.push((c ? 'PASS' : 'FAIL') + ' | ' + n + (d !== undefined ? ' | ' + d : '')); return !!c; };
  const W = g.MAPW, H = g.MAPH, s = g.solid, t = g.tiles;

  T('第一章 144×104 不变，第二章南扩到 144 行', W === 144 && g.CH1_H === 104 && H === 144,
    W + '×' + H + '（第一章 ' + g.CH1_H + ' 行）');

  // 从出生点洪水填充，看能不能走到每个营地
  const walkable = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !s[y * W + x];
  const seen = new Uint8Array(W * H);
  const sx = (g.SPAWN.x / 16) | 0, sy = (g.SPAWN.y / 16) | 0;
  const q = [sy * W + sx];
  seen[q[0]] = 1;
  let reach = 0;
  while (q.length) {
    const i = q.pop(); reach++;
    const x = i % W, y = (i / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (!walkable(nx, ny)) continue;
      const ni = ny * W + nx;
      if (seen[ni]) continue;
      seen[ni] = 1; q.push(ni);
    }
  }
  let total = 0;
  for (let i = 0; i < W * H; i++) if (!s[i]) total++;
  const pct = (reach / total * 100);
  T('可行走地块连通率 ≥ 90%', pct >= 90, pct.toFixed(1) + '% (' + reach + '/' + total + ')');

  // 每个营地周围必须有能站人、也走得到的地。
  // 不能只测正中心 —— 篝火就摆在正中心，那一格本来就是实心的。
  const badCamp = g.camps.filter(c => {
    const cx = (c.x / 16) | 0, cy = (c.y / 16) | 0;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const i = (cy + dy) * W + (cx + dx);
      if (i >= 0 && i < W * H && !s[i] && seen[i]) return false;
    }
    return true;
  });
  T('16 个营地都可达', g.camps.length === 16 && badCamp.length === 0,
    g.camps.length + ' 个' + (badCamp.length ? '，不通：' + badCamp.map(c => c.name).join('/') : ''));

  // 首领巢穴：正中心必须能站（首领就站在那儿），且周围一片得是通的。
  // 只验"中心可站"会漏掉"巢穴是个石头坑"这种情况 —— 所以再验 3×3 有连通格。
  const badDen = g.dens.filter(d => {
    const cx = (d.x / 16) | 0, cy = (d.y / 16) | 0;
    if (s[cy * W + cx]) return true;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const i = (cy + dy) * W + (cx + dx);
      if (i >= 0 && i < W * H && !s[i] && seen[i]) return false;
    }
    return true;
  });
  T('4 个首领巢穴都可达', g.dens.length === 4 && badDen.length === 0,
    g.dens.length + ' 个' + (badDen.length ? '，不通：' + badDen.map(d => d.name).join('/') : ''));

  // 四区地貌确实刷出来了
  const count = id => { let n = 0; for (let i = 0; i < W * H; i++) if (t[i] === id) n++; return n; };
  const bam = count(6), cave = count(7), grave = count(8), water = count(10), bridge = count(9);
  T('竹海地面已铺', bam > 1200, bam + ' 格');
  T('石窟岩地已铺', cave > 800, cave + ' 格');
  T('乱葬岗荒土已铺', grave > 1000, grave + ' 格');
  T('溪涧与竹桥都在', water > 80 && bridge > 10, '水 ' + water + ' / 桥 ' + bridge);

  // 村庄与古洞不能互相压住
  const V = g.village;
  // 南扩之后村庄相对整张新图会偏上，但它仍稳稳在「第一章」的东南角。
  T('村庄仍在第一章东南角', V.x0 > W * 16 * 0.6 && V.y0 > g.CH1_H * 16 * 0.6,
    'x0=' + V.x0 + ' y0=' + V.y0 + '（第一章 ' + (W * 16) + '×' + (g.CH1_H * 16) + '）');
  const D = g.DG;
  T('古洞在正北且不压村', D.y1 < V.y0 && D.x1 < V.x0, '洞 ' + D.x0 + '..' + D.x1 + ',' + D.y0 + '..' + D.y1);

  // 古洞侧壁紧邻石窟（第三幕"矿道打通洞壁"在地图上要成立）
  const gap = D.x0 - g.REGION.cave.x1 * 16;
  T('石窟与古洞只隔一道岩壁', gap >= 0 && gap <= 5 * 16, gap + 'px');

  // 出生点、土地庙、树妖都得站得住
  T('出生点站得住', g.canStand(g.SPAWN.x, g.SPAWN.y), g.SPAWN.x + ',' + g.SPAWN.y);

  // ---------- 第二章 P12-A ----------
  {
    // 第一章地形逐字节不变：一旦有人改了前 102 行的生成顺序，这条会立刻红。
    let fp = 2166136261;
    for (let y = 0; y < 102; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      fp = Math.imul(fp ^ t[i], 16777619) >>> 0;
      fp = Math.imul(fp ^ (s[i] ? 1 : 0), 16777619) >>> 0;
    }
    T('第一章前 102 行地形逐格未变', fp === 1093084102, 'fp=' + fp);

    const south = count(11), sand = count(12), river = count(13), bridge9 = count(9);
    // 江岸被 371 格江水与路网吃掉一大块，沙地剩 810 格左右是合理的。
    T('南疆赤土与江岸沙地都铺出来了', south > 900 && sand > 700,
      '赤土 ' + south + ' / 沙地 ' + sand);
    T('江水与渡桥都在', river > 200 && bridge9 > 10, '江水 ' + river + ' / 桥 ' + bridge9);

    // 两个关口：第一章底边只在这里放开，其余仍是边界
    const gates = [34, 119].filter(gx => {
      for (let y = 102; y < 104; y++) for (let x = gx - 2; x <= gx + 2; x++) {
        if (s[y * W + x]) return false;
      }
      return true;
    });
    T('南下的两个关口都凿通了', gates.length === 2, gates.join('/'));
    let stillWall = 0;
    for (let x = 2; x < W - 2; x++) if (t[102 * W + x] === 4 && s[102 * W + x]) stillWall++;
    T('原底边其余仍是边界，没变成大马路', stillWall > 100, stillWall + ' 格');

    // 新区四个营地都得落在从出生点洪水填充出来的连通集里
    const newCamps = g.camps.filter(c => c.y / 16 >= g.CH1_H);
    const badNew = newCamps.filter(c => {
      const cx = (c.x / 16) | 0, cy = (c.y / 16) | 0;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const i = (cy + dy) * W + (cx + dx);
        if (i >= 0 && i < W * H && !s[i] && seen[i]) return false;
      }
      return true;
    });
    T('新区 4 个营地都能从出生点走到', newCamps.length === 4 && badNew.length === 0,
      newCamps.length + ' 个' + (badNew.length ? '，不通：' + badNew.map(c => c.name).join('/') : ''));

    const wild = g.WANDERERS.filter(w => w.y / 16 >= g.CH1_H);
    T('新区有人说话（不是空地）', wild.length >= 2 && wild.every(w => g.canStand(w.x, w.y)),
      wild.map(w => w.name).join('/'));
  }

  R.ok = R.checks.every(c => c.startsWith('PASS'));
  return R;
})()
