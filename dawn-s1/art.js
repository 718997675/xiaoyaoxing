// art.js · 外部美术资源装载（可选）
// 约定：把 atlas-tool.html 导出的 atlas.json 放进 ./assets/ 即可覆盖程序化点阵。
// 缺失或加载失败时静默回退到程序化像素，游戏永远可玩。

export const ART = {
  version: 0,
  loaded: false,
  weapons: {},   // fam -> canvas（柄端在底部中点，整幅高=素材高）
  icons: {},     // kind -> canvas 20x20
  monsters: {},  // type -> { frames:[canvas], w, h }
};

function toCanvas(img) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(img, 0, 0);
  c._w = c.width; c._h = c.height;
  return c;
}

function loadImg(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = src;
  });
}

export async function loadArt(url) {
  // file:// 下 fetch 本地 json 必被 CORS 拦，直接跳过，省得控制台刷一片红
  if (typeof location !== 'undefined' && location.protocol === 'file:') return false;
  try {
    const r = await fetch(url || './assets/atlas.json', { cache: 'no-cache' });
    if (!r.ok) return false;
    const data = await r.json();
    for (const [fam, src] of Object.entries(data.weapons || {})) {
      try { ART.weapons[fam] = toCanvas(await loadImg(src)); } catch (e) { }
    }
    for (const [kind, src] of Object.entries(data.icons || {})) {
      try { ART.icons[kind] = toCanvas(await loadImg(src)); } catch (e) { }
    }
    for (const [type, sheet] of Object.entries(data.monsters || {})) {
      try {
        const frames = [];
        for (const src of sheet.frames || []) frames.push(toCanvas(await loadImg(src)));
        if (frames.length) ART.monsters[type] = { frames, w: sheet.w, h: sheet.h };
      } catch (e) { }
    }
    ART.loaded = true;
    ART.version++;
    return true;
  } catch (e) {
    return false;
  }
}
