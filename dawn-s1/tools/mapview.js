// tools/mapview.js · 把整张世界地图画成一张图（4px/格），用于肉眼检查地貌
(() => {
  const g = window.__game;
  const W = g.MAPW, H = g.MAPH, P = 4;
  const c = document.createElement('canvas');
  c.width = W * P; c.height = H * P;
  const x = c.getContext('2d');
  const col = {
    0: '#2F6F6A', 1: '#2A6661', 2: '#B0A78A', 3: '#2F6F6A', 4: '#141A22', 5: '#8A8268',
    6: '#1F5B4E', 7: '#4A4B4D', 8: '#6A6250', 9: '#8A6038', 10: '#1D4A66',
  };
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
    const i = ty * W + tx;
    x.fillStyle = col[g.tiles[i]] || '#000';
    if (g.solid[i]) x.fillStyle = g.tiles[i] === 4 ? '#141A22' : '#1B2422';
    x.fillRect(tx * P, ty * P, P, P);
  }
  // 营地
  for (const cm of g.camps) {
    x.fillStyle = cm.tier === 2 ? '#E24B4A' : '#F5C4B3';
    x.fillRect(cm.x / 16 * P - 3, cm.y / 16 * P - 3, 6, 6);
  }
  // 村庄 / 古洞
  const V = g.village, D = g.DG;
  x.strokeStyle = '#D9A441'; x.lineWidth = 2;
  x.strokeRect(V.x0 / 16 * P, V.y0 / 16 * P, (V.x1 - V.x0) / 16 * P, (V.y1 - V.y0) / 16 * P);
  x.strokeStyle = '#8A6FC4';
  x.strokeRect(D.x0 / 16 * P, D.y0 / 16 * P, (D.x1 - D.x0) / 16 * P, (D.y1 - D.y0) / 16 * P);
  // 出生点
  x.fillStyle = '#FFF'; x.fillRect(g.SPAWN.x / 16 * P - 2, g.SPAWN.y / 16 * P - 2, 4, 4);
  return c.toDataURL('image/png');
})()
