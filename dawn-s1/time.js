// time.js · 昼夜循环（S3 批次 A）
// 一日 = 14 分钟真实时间。四段：卯（晨雾）/ 午（白昼）/ 酉（黄昏）/ 子（夜）。
// 只做三件事：给光影一个来源、给玩法一个开关、给玩家一个能看见的钟。
//
// 设计约定：
// - 所有颜色都是「压在画面上的一层色罩」，不是给美术换皮。这样白天零开销、夜间也不改任何贴图。
// - 光照强度 a 在 0~1 之间连续插值，两个时辰交界处不会硬切。
// - 时辰边界是玩法开关（夜里换怪、晨间偷袭），所以边界必须和视觉上"天真的黑了"对得上。

export const SECONDS_PER_DAY = 840; // 14 分钟
export const DAY_MINUTES = 14;

// 四段的分钟长度：2 / 6 / 2 / 4
export const PHASES = [
  { id: 'mao', name: '卯时', sub: '晨雾', min: 2, color: '#9BD4CC', hint: '晨雾未散，营地里的贼还在睡' },
  { id: 'wu', name: '午时', sub: '白昼', min: 6, color: '#F2D089', hint: '日头正盛' },
  { id: 'you', name: '酉时', sub: '黄昏', min: 2, color: '#E8806F', hint: '日薄西山，野兽开始成群' },
  { id: 'zi', name: '子时', sub: '黑夜', min: 4, color: '#8A6FC4', hint: '夜色深沉，阴物出没' },
];

// 累积边界（0~1）
const BOUNDS = (() => {
  let acc = 0;
  return PHASES.map(p => { const s = acc; acc += p.min / DAY_MINUTES; return { s, e: acc, p }; });
})();

// 四段的分界点（不含首尾），给日晷画刻度用
export const PHASE_EDGES = BOUNDS.map(b => b.e).slice(0, -1);
export const PHASE_STARTS = BOUNDS.map(b => b.s);

// 光色关键帧：(t, rgb, alpha)。
// 这里的 alpha 是「氛围混合比」——不是透明度滤镜，而是把画面按比例推向这个颜色。
// 因为底色是青绿水墨，低 alpha 的暖色只会把画面搅成脏灰，所以黄昏/夜晚必须给到 0.3~0.7
// 才压得住；白昼保持 a=0，完全零开销、也保证"白天就是原画"。
const KEYS = [
  { t: 0.000, c: [150, 172, 178], a: 0.30 },  // 卯·晨雾最浓：整体提亮偏青灰，对比度压低
  { t: 0.075, c: [152, 174, 180], a: 0.22 },
  { t: 0.130, c: [200, 214, 214], a: 0.07 },  // 雾散
  { t: 0.170, c: [255, 255, 255], a: 0.00 },  // 午·白昼：原画
  { t: 0.500, c: [255, 246, 226], a: 0.00 },
  { t: 0.575, c: [134, 62, 30], a: 0.20 },    // 酉·黄昏起：橘红压上来
  { t: 0.645, c: [122, 46, 20], a: 0.40 },
  { t: 0.700, c: [96, 36, 18], a: 0.52 },     // 日落最后一刻，暖褐最深
  { t: 0.716, c: [18, 22, 52], a: 0.56 },     // 入夜
  { t: 0.790, c: [14, 18, 44], a: 0.70 },     // 子·最深的夜
  { t: 0.930, c: [14, 18, 44], a: 0.68 },
  { t: 0.975, c: [56, 66, 92], a: 0.44 },     // 天将亮
  { t: 1.000, c: [150, 172, 178], a: 0.30 },  // 回到卯·晨雾（首尾必须同值，否则临门一脚会闪白）
];

function lerp(a, b, k) { return a + (b - a) * k; }

// t∈[0,1) → {r,g,b,a}
export function lightAt(t) {
  t = ((t % 1) + 1) % 1;
  for (let i = 0; i < KEYS.length - 1; i++) {
    const k0 = KEYS[i], k1 = KEYS[i + 1];
    if (t >= k0.t && t <= k1.t) {
      const k = (t - k0.t) / Math.max(1e-6, k1.t - k0.t);
      return {
        r: Math.round(lerp(k0.c[0], k1.c[0], k)),
        g: Math.round(lerp(k0.c[1], k1.c[1], k)),
        b: Math.round(lerp(k0.c[2], k1.c[2], k)),
        a: +lerp(k0.a, k1.a, k).toFixed(3),
      };
    }
  }
  return { r: 255, g: 255, b: 255, a: 0 };
}

// t∈[0,1) → {index, id, name, sub, color, start, end, progress}
export function phaseInfo(t) {
  t = ((t % 1) + 1) % 1;
  for (let i = 0; i < BOUNDS.length; i++) {
    const b = BOUNDS[i];
    if (t >= b.s && t < b.e) {
      return {
        index: i, id: b.p.id, name: b.p.name, sub: b.p.sub, color: b.p.color, hint: b.p.hint,
        start: b.s, end: b.e, progress: (t - b.s) / (b.e - b.s),
      };
    }
  }
  const b = BOUNDS[0];
  return { index: 0, id: b.p.id, name: b.p.name, sub: b.p.sub, color: b.p.color, hint: b.p.hint, start: 0, end: b.e, progress: 0 };
}

export class Clock {
  constructor(t = 0.20, day = 1) {
    this.t = t;      // 日进度 0~1
    this.day = day;  // 第几日
    this.changed = 0; // 刚刚跨过时辰时置 1，供上层播钟声
  }
  advance(dt) {
    if (dt <= 0) return;
    const before = this.phase.index;
    this.t += dt / SECONDS_PER_DAY;
    while (this.t >= 1) { this.t -= 1; this.day++; }
    if (this.phase.index !== before) this.changed = 1;
  }
  get phase() { return phaseInfo(this.t); }
  get light() { return lightAt(this.t); }
  get isNight() { return this.phase.id === 'zi'; }
  get isDawn() { return this.phase.id === 'mao'; }
  get isDusk() { return this.phase.id === 'you'; }
  // 夜里最黑的那段时间（用于"阴物活跃"的判定，比整段夜更硬核）
  get deepNight() { return this.t > 0.72 && this.t < 0.94; }
  // 距下一时辰还有多少"游戏内分钟"
  get minutesToNext() { return Math.round((this.phase.end - this.t) * DAY_MINUTES * 10) / 10; }
  label() { const p = this.phase; return p.name + '·' + p.sub; }
  // 打坐：推进到下一个时辰的起点
  skipToNext() {
    const p = this.phase;
    this.t = p.end >= 0.999 ? 0 : p.end;
    if (p.end >= 0.999) this.day++;
    this.changed = 1;
    return this.phase;
  }
  // 住店过夜：直接跳到卯时
  sleepToDawn() {
    this.day++;
    this.t = 0.005;
    this.changed = 1;
    return this.phase;
  }
  serialize() { return { t: +this.t.toFixed(5), day: this.day }; }
  restore(o) {
    if (!o) return;
    if (typeof o.t === 'number' && isFinite(o.t)) this.t = ((o.t % 1) + 1) % 1;
    if (typeof o.day === 'number' && o.day > 0) this.day = Math.floor(o.day);
  }
}
