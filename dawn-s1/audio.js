// audio.js · 逍遥行 程序化音效
// 零素材：全部用 WebAudio 振荡器 + 噪声实时合成。
// 打击感的一半来自声音，这层不引入任何外部文件。

let ctx = null, master = null, noiseBuf = null, enabled = true;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { return null; }
    master = ctx.createGain();
    master.gain.value = 0.32;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function noise(c) {
  if (!noiseBuf) {
    const len = Math.floor(c.sampleRate * 0.6);
    noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = c.createBufferSource();
  s.buffer = noiseBuf;
  return s;
}

function env(c, node, t0, peak, dec, dest) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dec);
  node.connect(g); g.connect(dest || master);
  return g;
}

// P12-E：招式音色有 80 个（16 个原型 × 5 档），pitchMul / durMul 由 play()
// 按名字后缀临时设定。放在模块级而不是传参 —— 十几个预设分支都直接调
// tone()/hiss()，改一处比给每个分支加参数省事得多。
let pitchMul = 1, durMul = 1;

function tone(c, type, f0, f1, dur, peak, dest) {
  const o = c.createOscillator();
  o.type = type;
  const t0 = c.currentTime;
  const a0 = f0 * pitchMul, a1 = f1 * pitchMul;
  const d = dur * durMul;
  o.frequency.setValueAtTime(a0, t0);
  if (a1 !== a0) o.frequency.exponentialRampToValueAtTime(Math.max(1, a1), t0 + d);
  env(c, o, t0, peak, d, dest);
  o.start(t0); o.stop(t0 + d + 0.02);
  return o;
}

function hiss(c, type, f0, f1, dur, peak, q) {
  const s = noise(c);
  const f = c.createBiquadFilter();
  f.type = type; f.Q.value = q || 1;
  const t0 = c.currentTime;
  f.frequency.setValueAtTime(f0, t0);
  if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
  s.connect(f);
  env(c, f, t0, peak, dur);
  s.start(t0); s.stop(t0 + dur + 0.02);
}

// P12-E：招式音色名 = 原型 + 档位（slash1..slash5 / qi1..qi5 ……）。
// 16 个原型 × 5 档 = 80 个，全表 80 招的 snd / hitSnd 各自用满 80 个不同值。
// 档位换算成音高与时长：1 档最低最长，5 档最高最短，中间 3 档是原音。
const SND_BASES = ['slash', 'qi', 'wu', 'dash', 'windup', 'thunder', 'forge', 'quake',
  'boomerang', 'levelup', 'bell', 'shield', 'boss', 'rare', 'hit', 'crit'];
const SND_RE = new RegExp('^(' + SND_BASES.join('|') + ')([1-5])$');
// 档位 → 音高倍率（半音）与时长倍率
const SND_PITCH = [0.794, 0.891, 1, 1.122, 1.26];
const SND_DUR = [1.18, 1.09, 1, 0.92, 0.85];

export function sndVariant(name) {
  const m = SND_RE.exec(name || '');
  if (!m) return null;
  const v = Number(m[2]) - 1;
  return { base: m[1], v, pitch: SND_PITCH[v], dur: SND_DUR[v] };
}

export const AUDIO = {
  get enabled() { return enabled; },
  set enabled(v) { enabled = !!v; },
  unlock() { ac(); },

  play(name, arg) {
    if (!enabled) return;
    const c = ac();
    if (!c) return;
    // P12-E：带档位的招式音色（slash3 / qi5 ……）先解出原型与变体参数，
    // 落到原型分支上执行，只是音高与时长被改过。普通音效（hurt / ui / die…）
    // 不带数字后缀，原样走老路。
    const sv = sndVariant(name);
    const nm = sv ? sv.base : name;
    pitchMul = sv ? sv.pitch : 1;
    durMul = sv ? sv.dur : 1;
    switch (nm) {
      case 'slash': {  // 挥剑破风：不同兵器不同音色
        const f = { sword: 2600, blade: 2100, spear: 3200, staff: 1500, dual: 3000, hammer: 1100 }[arg] || 2400;
        hiss(c, 'bandpass', f, f * 0.28, arg === 'hammer' ? 0.18 : 0.11, arg === 'hammer' ? 0.22 : 0.16, 1.2);
        if (arg === 'hammer') tone(c, 'sine', 110, 55, 0.14, 0.1);
        break;
      }
      case 'thunder':  // 引雷起手
        hiss(c, 'highpass', 5200, 1400, 0.28, 0.14, 1);
        tone(c, 'sawtooth', 320, 180, 0.3, 0.08);
        break;
      case 'thunderHit': // 落雷命中（不参与招式音色池，老 boss 落雷专用）
        tone(c, 'square', 1600, 220, 0.18, 0.16);
        hiss(c, 'lowpass', 5200, 400, 0.34, 0.2, 0.8);
        tone(c, 'sine', 90, 40, 0.3, 0.14);
        break;
      case 'shield':   // 罡气挡伤
        tone(c, 'triangle', 620, 900, 0.1, 0.09);
        hiss(c, 'bandpass', 1800, 2600, 0.12, 0.07, 2);
        break;
      case 'hit': {   // 命中
        // P12-E：第二个参数有两种来法 —— 命中音按伤害值传，起手音按兵器名传。
        // 这里只认数字，字符串一律按 10 算，别让 'chain'/60 变成 NaN 把整个放招打断。
        const dmg = typeof arg === 'number' && isFinite(arg) ? arg : 10;
        const p = 1 - Math.min(0.6, dmg / 60);
        tone(c, 'square', 240 * (1 + p), 120, 0.07, 0.13);
        hiss(c, 'highpass', 1600, 900, 0.05, 0.1, 1);
        break;
      }
      case 'crit':    // 暴击
        tone(c, 'square', 880, 660, 0.10, 0.16);
        tone(c, 'sawtooth', 1320, 990, 0.16, 0.09);
        hiss(c, 'bandpass', 4200, 1400, 0.14, 0.16, 2);
        break;
      case 'hurt':    // 玩家受击
        tone(c, 'sawtooth', 190, 60, 0.22, 0.18);
        hiss(c, 'lowpass', 900, 300, 0.16, 0.12, 1);
        break;
      case 'die':     // 敌人倒下
        hiss(c, 'lowpass', 1800, 200, 0.26, 0.16, 1);
        tone(c, 'triangle', 320, 90, 0.22, 0.1);
        break;
      case 'pickup':
        tone(c, 'triangle', 720, 980, 0.09, 0.11);
        break;
      case 'coin':
        tone(c, 'square', 1250, 1250, 0.05, 0.08);
        tone(c, 'square', 1750, 1750, 0.06, 0.06);
        break;
      case 'equip':
        tone(c, 'square', 520, 780, 0.08, 0.1);
        break;
      case 'levelup':
        [523, 659, 784, 1047].forEach((f, i) => {
          const t0 = c.currentTime + i * 0.075;
          const o = c.createOscillator(); o.type = 'triangle';
          o.frequency.setValueAtTime(f, t0);
          env(c, o, t0, 0.11, 0.16);
          o.start(t0); o.stop(t0 + 0.2);
        });
        break;
      case 'qi':       // 剑气
        hiss(c, 'bandpass', 700, 2600, 0.20, 0.12, 3);
        tone(c, 'sine', 900, 1500, 0.14, 0.06);
        break;
      case 'wu':       // 剑舞
        hiss(c, 'bandpass', 1800, 300, 0.30, 0.16, 1.5);
        tone(c, 'sine', 160, 60, 0.30, 0.13);
        break;
      case 'dash':     // 身法
        hiss(c, 'bandpass', 1400, 3400, 0.13, 0.1, 2);
        break;
      case 'windup':   // 敌人起手预警
        tone(c, 'triangle', 420, 620, 0.16, 0.07);
        break;
      case 'boss':
        tone(c, 'sawtooth', 120, 70, 0.7, 0.16);
        hiss(c, 'lowpass', 700, 120, 0.7, 0.14, 1);
        break;
      case 'forge':    // 铁匠锤击
        tone(c, 'square', 1400, 900, 0.07, 0.11);
        hiss(c, 'bandpass', 3600, 1800, 0.09, 0.11, 2);
        break;
      case 'quake':    // 落地：低频震动 + 一层土（震地 / 地裂 / 开天辟地）
        tone(c, 'sine', 72, 30, 0.42, 0.22);
        tone(c, 'sine', 116, 44, 0.26, 0.10);
        hiss(c, 'lowpass', 880, 110, 0.40, 0.20, 1);
        break;
      case 'boomerang': {  // 回旋：去程升调、回程降调（多普勒）
        const back = arg === 'back';
        hiss(c, 'bandpass', back ? 2200 : 900, back ? 700 : 2600, 0.18, 0.10, 3);
        tone(c, 'triangle', back ? 880 : 560, back ? 420 : 980, 0.16, 0.06);
        break;
      }
      case 'salvage':
        hiss(c, 'bandpass', 2400, 900, 0.12, 0.1, 1.5);
        break;
      case 'ui':
        tone(c, 'square', 900, 900, 0.035, 0.06);
        break;
      case 'rare':     // 高稀有度掉落
        tone(c, 'triangle', 880, 1320, 0.16, 0.12);
        tone(c, 'sine', 1320, 1760, 0.22, 0.08);
        break;
      case 'bell': {   // 时辰钟声：不同时辰不同基频，夜里更低更长
        const f = { mao: 520, wu: 780, you: 620, zi: 330 }[arg] || 600;
        const dur = arg === 'zi' ? 2.4 : 1.8;
        // 钟体：基频 + 五度 + 八度，正弦叠加成"金属余韵"
        tone(c, 'sine', f, f * 0.996, dur, 0.20);
        tone(c, 'sine', f * 1.5, f * 1.49, dur * 0.7, 0.09);
        tone(c, 'sine', f * 2.02, f * 2.0, dur * 0.5, 0.05);
        // 撞木一击的木质感与空气
        hiss(c, 'lowpass', 1200, 260, 0.16, 0.09, 1);
        break;
      }
      default: break;
    }
    pitchMul = 1; durMul = 1;
  },
};
