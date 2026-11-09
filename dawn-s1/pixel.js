// pixel.js · 像素绘制基元与 24 色锁定板
// 所有美术均为程序化点阵；外部图集（assets/atlas.json）存在时由 art.js 覆盖。

export const C = {
  ink1:'#12161F', ink2:'#2A3140', ink3:'#4A5568',
  paper1:'#8A8268', paper2:'#C9BFA3', paper3:'#E8DFC8',
  jade1:'#2F6E6A', jade2:'#5FA8A0', jade3:'#9BD4CC',
  red1:'#7A2420', red2:'#C8453B', red3:'#E8806F',
  gold1:'#8A6520', gold2:'#D9A441', gold3:'#F2D089',
  pur1:'#4A3A6B', pur2:'#8A6FC4', pur3:'#C0A8E0',
  black:'#000000', white:'#FFFFFF',
};

// 字符画 → canvas
export function spriteCanvas(rows, pal) {
  const c = document.createElement('canvas');
  c.width = rows[0].length; c.height = rows.length;
  const g = c.getContext('2d');
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch !== '.' && pal[ch]) { g.fillStyle = pal[ch]; g.fillRect(x, y, 1, 1); }
    }
  });
  return c;
}

export function mirror(c) {
  const m = document.createElement('canvas');
  m.width = c.width; m.height = c.height;
  const g = m.getContext('2d');
  g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(c, 0, 0);
  return m;
}

// 1px 硬描边（贴图四周各扩 1px）
export function outlined(c, color) {
  const o = document.createElement('canvas');
  o.width = c.width + 2; o.height = c.height + 2;
  const g = o.getContext('2d');
  const src = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const has = (x, y) => x >= 0 && y >= 0 && x < c.width && y < c.height && src[(y * c.width + x) * 4 + 3] > 0;
  g.drawImage(c, 1, 1);
  g.fillStyle = color || C.black;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    if (!has(x, y)) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!has(x + dx, y + dy)) g.fillRect(1 + x + dx, 1 + y + dy, 1, 1);
    }
  }
  return o;
}

// 颜色提亮 / 压暗（用于受击白闪、稀有度染色）
export function tintHex(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) * k) | 0;
  const g = Math.min(255, ((n >> 8) & 255) * k) | 0;
  const b = Math.min(255, (n & 255) * k) | 0;
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

export function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(hex, a) {
  const [r, g, b] = hexRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

// 画一张点阵到已有 ctx（整数缩放，保持锐利）
export function blit(g, src, x, y, scale) {
  const s = scale || 1;
  g.imageSmoothingEnabled = false;
  g.drawImage(src, Math.round(x), Math.round(y), src.width * s, src.height * s);
}
