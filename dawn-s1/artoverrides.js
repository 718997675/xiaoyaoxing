// artoverrides.js · 招式工作台的覆盖层
//
// 为什么需要它：arts.js 里 64 招是「基线」，工作台设计出来的招式不能每次都去改
// 600 行数据表。这里按招式 id 存一份覆盖表，启动时原地改 ARTS 的字段 ——
// 所有持有 ARTS 引用的地方自动生效，删掉覆盖表就回到基线，回滚零成本。
//
// 两个来源，后面的优先：
//   1. art-overrides.data.js 写入的 window.__ART_OVERRIDES_FILE__（放进仓库 / build 内联）
//   2. localStorage 的 xy_art_overrides_v1（工作台一键试玩，模块版和单文件版都支持）
//
// 白名单是硬规矩：id / fam / slot / prof 这些结构字段不许覆盖，
// 否则会破坏专精解锁、装配页和存档。能改的只有表现层与数值层。

export const OVERRIDE_KEY = 'xy_art_overrides_v1';
export const OVERRIDE_SAFE = [
  'name', 'desc', 'cd', 'cost', 'mul', 'reach', 'arc', 'radius', 'len', 'width',
  'kb', 'pierceDef', 'status', 'fx',
  'color', 'shape', 'pose', 'snd', 'hitSnd',
  'fxDelay', 'fxLife', 'timeline',
  'frames', 'frameScale', 'frameRotate',
];

function fileArts() {
  const f = typeof window !== 'undefined' ? window.__ART_OVERRIDES_FILE__ : null;
  if (!f || typeof f !== 'object') return {};
  const a = f.arts || f;
  return (a && typeof a === 'object') ? a : {};
}

function localArts() {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(OVERRIDE_KEY);
    if (!raw) return {};
    const j = JSON.parse(raw);
    const a = j && (j.arts || j);
    return (a && typeof a === 'object') ? a : {};
  } catch (e) { return {}; }
}

export function readOverrides() {
  return Object.assign({}, fileArts(), localArts());
}

export function overrideCount() {
  return Object.keys(readOverrides()).length;
}

// 原地改 ARTS：注意不能换成新对象，game.js 里很多地方缓存了 ARTS 的引用。
export function applyArtOverrides(ARTS) {
  const ov = readOverrides();
  let n = 0;
  for (const id of Object.keys(ov)) {
    const dst = ARTS[id];
    const src = ov[id];
    if (!dst || !src || typeof src !== 'object') continue;
    for (const k of OVERRIDE_SAFE) {
      if (Object.prototype.hasOwnProperty.call(src, k)) dst[k] = src[k];
    }
    n++;
  }
  return n;
}

function cleanPack(j) {
  if (!j || typeof j !== 'object' || Array.isArray(j)) throw new Error('不是覆盖表对象');
  // 认两种形状：工作台导出的 {version, arts}，以及直接按招式 id 写的裸表。
  // 不能像早先那样 `j.arts || j` 兜底 —— 用户选错文件（比如 {"version":1}）
  // 会被当成一张空覆盖表静默吞掉，界面还提示"已导入 0 招"，很难查。
  let src;
  if (j.arts && typeof j.arts === 'object' && !Array.isArray(j.arts)) src = j.arts;
  else if (Object.keys(j).some(k => /^[a-z]+_\d+$/.test(k))) src = j;
  else throw new Error('缺少 arts 表（不是工作台导出的覆盖表）');
  const out = {};
  for (const id of Object.keys(src)) {
    const row = src[id];
    if (!row || typeof row !== 'object') continue;
    const o = {};
    for (const k of OVERRIDE_SAFE) if (row[k] !== undefined) o[k] = row[k];
    out[id] = o;
  }
  return out;
}

export function importOverrides(text) {
  const arts = cleanPack(typeof text === 'string' ? JSON.parse(text) : text);
  if (typeof localStorage === 'undefined') throw new Error('这个环境没有 localStorage');
  localStorage.setItem(OVERRIDE_KEY, JSON.stringify({ version: 1, arts }));
  return Object.keys(arts).length;
}

export function clearOverrides() {
  try { if (typeof localStorage !== 'undefined') localStorage.removeItem(OVERRIDE_KEY); } catch (e) { }
}

export function exportOverrides() {
  return JSON.stringify({ version: 1, arts: readOverrides() }, null, 2);
}

// 时间轴（30fps 帧数）→ 秒。工作台只写 fxStart / fxLen，这里换算成
// slashGhosts 认识的 delay / t。基线 64 招没有 timeline，算出来全是 0，
// 所以默认行为一个字节都不变。
export function artTiming(a) {
  const t = a && a.timeline;
  const fps = (t && t.fps) || 30;
  const delay = (a && a.fxDelay !== undefined) ? a.fxDelay
    : (t && t.fxStart !== undefined) ? t.fxStart / fps
      : (t && t.windup !== undefined) ? t.windup / fps : 0;
  const life = (a && a.fxLife !== undefined) ? a.fxLife
    : (t && t.fxLen !== undefined) ? t.fxLen / fps : 0;
  return { delay: Math.max(0, delay || 0), life: Math.max(0, life || 0), fps };
}

// PNG 序列帧（dataURL 数组）→ Image 数组，按 id + 首帧指纹缓存。
// Image 的 src 赋值是异步的，绘制循环里要判 complete / naturalWidth，没解好就跳过。
const frameCache = new Map();
export function artFrames(a) {
  const src = a && a.frames;
  if (!src || !src.length || typeof Image === 'undefined') return null;
  const key = (a.id || '?') + '|' + src.length + '|' + String(src[0]).slice(-32);
  if (frameCache.has(key)) return frameCache.get(key);
  const arr = src.map(s => { const im = new Image(); im.src = s; return im; });
  frameCache.set(key, arr);
  return arr;
}
