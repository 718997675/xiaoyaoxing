// monsters.js · 敌手图鉴：点阵、数值与行为标签
// behavior: melee 近战 / archer 远射 / charger 冲锋 / caster 符法 / tank 重甲 / blinker 鬼魅 / boss 首领

import { C } from './pixel.js';

const P = {
  // 共用
  k: C.ink3, K: C.ink2, d: C.ink1, e: C.paper3, r: C.red2, R: C.red1, g: C.gold2,
  p: C.paper2, P: C.paper3, s: C.paper1, S: C.ink2, y: C.gold3, o: C.red3,
  b: '#5A4632', B: '#3A2E22', w: '#EDE4CE', G: '#4E8F6A', L: '#8FD6B0',
  c: '#6B3B32', u: '#8A6FC4', U: '#4A3A6B',
};

export const MONSTERS = {
  zhiren: {
    name: '山贼', behavior: 'melee', tier: 0,
    hp: 22, speed: 24, dmg: 6, xp: 9, range: 13, cd: 1.0, windup: 0.42, kb: 1.0, aggro: 74,
    size: [12, 12],
    pal: { p: C.ink3, e: C.paper3, r: C.red2 },
    rows: [
      '....pppp....', '...pppppp...', '...peppep...', '...pppppp...', '..pppppppp..',
      '..ppprrppp..', '.pppprrpppp.', '.pppprrpppp.', '.pppprrpppp.', '..ppprrppp..',
      '..pp.pp.pp..', '..pp.pp.pp..',
    ],
    rows2: [
      '....pppp....', '...pppppp...', '...peppep...', '...pppppp...', '..pppppppp..',
      '..ppprrppp..', '.pppprrpppp.', '.pppprrpppp.', '.pppprrpppp.', '..ppprrppp..',
      '.pp..pp..pp.', '.pp..pp..pp.',
    ],
  },
  fox: {
    name: '恶犬', behavior: 'melee', tier: 0,
    hp: 30, speed: 48, dmg: 9, xp: 14, range: 14, cd: 0.85, windup: 0.30, kb: 1.2, aggro: 82,
    size: [16, 11],
    pal: { r: C.ink3, R: C.paper1, e: C.red2, w: C.paper2, d: C.ink2 },
    rows: [
      '.rr...........', '.rrr..........', '.rrrrrrrrrr...', 'rreRrrrrrrrr..', '.rrrrrrrrrrrw.',
      '..rrrrrrrrrww.', '..rr.rr.rr.rw.', '..rr.rr.rr....', '..dd.dd.dd....',
    ],
    rows2: [
      '.rr...........', '.rrr..........', '.rrrrrrrrrr...', 'rreRrrrrrrrr..', '.rrrrrrrrrrrw.',
      '..rrrrrrrrrww.', '..rrr.rr.rrr..', '...rr.rr.rr...', '...dd.dd.dd...',
    ],
  },
  ghost: {
    name: '弓手', behavior: 'archer', tier: 0,
    hp: 26, speed: 27, dmg: 7, xp: 16, range: 74, cd: 1.6, windup: 0.55, kb: 0.6, aggro: 104,
    size: [12, 12],
    pal: { p: C.ink1, P: C.ink2, L: C.jade3, g: C.red2 },
    rows: [
      '....gggg....', '...pppppp...', '..ppPPPPpp..', '..pPPPPPPp..', '..pPPLLPp...',
      '..pPPPPPPp..', '..ppPPPPpp..', '...pppppp...', '....gggg....', '.....gg.....', '.....gg.....',
    ],
    rows2: [
      '....gggg....', '...pppppp...', '..ppPPPPpp..', '..pPPPPPPp..', '..pPPLLPp...',
      '..pPPPPPPp..', '..ppPPPPpp..', '...pppppp...', '....gggg....', '....gg......', '....gg......',
    ],
  },
  brute: {
    name: '壮汉', behavior: 'melee', tier: 0,
    hp: 62, speed: 30, dmg: 13, xp: 27, range: 16, cd: 1.6, windup: 0.62, kb: 0.3, aggro: 70,
    size: [14, 15],
    pal: { k: C.ink2, K: C.ink3, e: C.gold2, r: C.red1, s: C.paper1, m: C.ink1 },
    rows: [
      '...kkkkkk...', '..kkkkkkkk..', '..keekeekk..', '..kkkkkkkk..', '.kkkkkkkkkk.',
      'kkssssssskkk', 'kkssssssskkk', 'kss.kss.kssk', 'kss.kss.kssk', 'kkssssssskkk',
      '.kksssssskk.', '.kksssssskk.', '..k..kk..k..', '..k......k..', '..m......m..',
    ],
    rows2: [
      '...kkkkkk...', '..kkkkkkkk..', '..keekeekk..', '..kkkkkkkk..', '.kkkkkkkkkk.',
      'kkssssssskkk', 'kkssssssskkk', 'kss.kss.kssk', 'kss.kss.kssk', 'kkssssssskkk',
      '.kksssssskk.', '.kksssssskk.', '..k..kk..k..', '.k........k.', '.m........m.',
    ],
  },
  shadow: {
    name: '影刺客', behavior: 'blinker', tier: 1,
    hp: 30, speed: 60, dmg: 11, xp: 24, range: 14, cd: 1.0, windup: 0.34, kb: 1.1, aggro: 96,
    size: [14, 12],
    pal: { d: C.ink1, D: C.ink2, b: C.paper2, r: C.red2 },
    rows: [
      '..ddddddddd..', '.ddddddddddd.', '..dbbbbbbbd..', '...ddddddd...', '....ddddd....',
      '...ddbdbdd...', '..ddbdbdbdd..', '..dddbbdbddd.', '..rdddddddr..', '...ddddddd...',
      '....dd.dd....', '....d...d....',
    ],
    rows2: [
      '..ddddddddd..', '.ddddddddddd.', '..dbbbbbbbd..', '...ddddddd...', '....ddddd....',
      '...ddbdbdd...', '..ddbdbdbdd..', '..dddbbdbddd.', '..rdddddddr..', '...ddddddd...',
      '....d...d....', '....d...d....',
    ],
  },
  // ---------- 新增 ----------
  shanxiao: {
    name: '山魈', behavior: 'charger', tier: 1,
    hp: 46, speed: 44, dmg: 12, xp: 22, range: 16, cd: 1.4, windup: 0.5, kb: 1.6, aggro: 96,
    size: [14, 13],
    pal: { b: P.b, B: P.B, w: P.w, e: C.red3, r: C.red2 },
    rows: [
      '..bb......bb..', '..bbb....bbb..', '...bbbbbbbb...', '..bwwbbbbwwb..', '..bwebbbbewb..',
      '..bwwbbbbwwb..', '...bbbbbbbb...', '..bbbbrrbbbb..', '.bbbbbbbbbbbb.', '.bb.bbbbbb.bb.',
      '...bb..bb.....', '...bb....bb...', '...bb....bb...',
    ],
    rows2: [
      '..bb......bb..', '..bbb....bbb..', '...bbbbbbbb...', '..bwwbbbbwwb..', '..bwebbbbewb..',
      '..bwwbbbbwwb..', '...bbbbbbbb...', '..bbbbrrbbbb..', '.bbbbbbbbbbbb.', '.bb.bbbbbb.bb.',
      '..bb....bb....', '..bb......bb..', '..bb......bb..',
    ],
  },
  snake: {
    name: '赤练蛇', behavior: 'poison', tier: 0,
    hp: 28, speed: 54, dmg: 6, xp: 18, range: 14, cd: 0.9, windup: 0.28, kb: 0.8, aggro: 88,
    size: [16, 8], poison: 3,
    pal: { r: C.red2, R: C.red1, e: C.gold3, d: C.ink1 },
    rows: [
      '..............rr', '.............rRr', '..rrrrrrrrrrrr..', '.rRRRRRRRRRRr...',
      'rRreRRRRRRRr....', '.rr..rrrrrr.....', '.....rr.........', '................',
    ],
    rows2: [
      '.............rr.', '............rRr.', '..rrrrrrrrrrr...', '.rRRRRRRRRRRr...',
      'rRreRRRRRRRr....', '..rr.rrrrrr.....', '....rr..........', '................',
    ],
  },
  fukui: {
    name: '符傀', behavior: 'caster', tier: 1,
    hp: 38, speed: 18, dmg: 11, xp: 22, range: 86, cd: 2.0, windup: 0.7, kb: 0.4, aggro: 100,
    size: [12, 14],
    pal: { p: C.paper3, e: C.ink1, r: C.red2, y: C.gold2 },
    rows: [
      '....pppp....', '...pppppp...', '...peppep...', '...pppppp...', '....rrrr....',
      '...pppppp...', '..pppppppp..', '..p.pppp.p..', '..p.pppp.p..', '...pppppp...',
      '...pp..pp...', '...pp..pp...', '...pp..pp...', '...yy..yy...',
    ],
    rows2: [
      '....pppp....', '...pppppp...', '...peppep...', '...pppppp...', '....rrrr....',
      '...pppppp...', '..pppppppp..', '..p.pppp.p..', '..p.pppp.p..', '...pppppp...',
      '..pp....pp..', '..pp....pp..', '...pp..pp...', '...yy..yy...',
    ],
  },
  crow: {
    name: '火鸦', behavior: 'flyer', tier: 1,
    hp: 24, speed: 66, dmg: 9, xp: 20, range: 70, cd: 1.5, windup: 0.45, kb: 0.5, aggro: 112,
    size: [14, 10],
    pal: { k: C.ink1, e: C.red3, o: C.gold2, O: C.red2 },
    rows: [
      '..............', '....kkkk......', '...kkkkkk.....', '..kkeekkkk....', '.kkkkkkkkkk...',
      'kkkkkkkkkkkk..', '.kk.kkkk.kkk..', '...o.kk.o.....', '....o..o......', '..............',
    ],
    rows2: [
      '..............', '....kkkk......', '...kkkkkk.....', '..kkeekkkk....', '.kkkkkkkkkk...',
      '.kkkkkkkkkkk..', '..kk.kk.kkk...', '..o...kk...o..', '...o......o...', '..............',
    ],
  },
  shigan: {
    name: '石敢当', behavior: 'tank', tier: 1,
    hp: 110, speed: 15, dmg: 18, xp: 38, range: 20, cd: 2.1, windup: 0.85, kb: 0.05, aggro: 86,
    size: [14, 15], def: 0.35,
    pal: { s: C.paper1, S: C.ink2, y: C.gold2, e: C.red3 },
    rows: [
      '...ssssss.....', '..sSSSSSSs....', '.sSSyyyySSs...', '.sSSyssSSss...', '.sSSyyyySSs...',
      '.sSSSSSSSSs...', '..sSSSSSSs....', '..sSSSSSSs....', '.ssSSSSSSss...', 'sssSSSSSSsss..',
      '.ssSSSSSSss...', '..sSSSSSSs....', '..ss....ss....', '..ss....ss....', '..ss....ss....',
    ],
    rows2: [
      '...ssssss.....', '..sSSSSSSs....', '.sSSyyyySSs...', '.sSSyssSSss...', '.sSSyyyySSs...',
      '.sSSSSSSSSs...', '..sSSSSSSs....', '..sSSSSSSs....', '.ssSSSSSSss...', 'sssSSSSSSsss..',
      '.ssSSSSSSss...', '..sSSSSSSs....', '..ss....ss....', '..ss....ss....', '..ss....ss....',
    ],
  },
  yinhun: {
    name: '阴魂', behavior: 'blinker', tier: 1,
    hp: 34, speed: 50, dmg: 13, xp: 26, range: 15, cd: 1.1, windup: 0.36, kb: 0.9, aggro: 100,
    size: [12, 13], lifesteal: 0.4,
    pal: { g: '#3E5E4A', G: '#6FA98A', e: C.red3 },
    rows: [
      '....gggg....', '...gGGGGg...', '..gGeeeGGg..', '..gGGGGGGg..', '..gGGGGGGg..',
      '..gGGGGGGg..', '..gGGGGGg...', '..gGGGGGGg..', '...gGGGGg...', '...gg..gg...',
      '..g..gg..g..', '...g....g...', '............',
    ],
    rows2: [
      '....gggg....', '...gGGGGg...', '..gGeeeGGg..', '..gGGGGGGg..', '..gGGGGGGg..',
      '..gGGGGGGg..', '..gGGGGGg...', '..gGGGGGGg..', '...gGGGGg...', '...gg..gg...',
      '...g.gg.g...', '....g..g....', '............',
    ],
  },
  treant: {
    name: '千年树妖', behavior: 'boss', tier: 2, mini: true,
    hp: 420, speed: 24, dmg: 20, xp: 140, range: 30, cd: 2.0, windup: 0.9, kb: 0, aggro: 118,
    size: [18, 20], def: 0.12,
    pal: { b: '#4A3A28', B: '#2E2418', r: C.red2, R: C.red3, G: '#4E8F6A' },
    rows: [
      '.....bbbbbbbb.....', '....bbbbbbbbbb....', '...bbbbbbbbbbbb...', '..bbbbbbbbbbbbbb..',
      '..bbbrrbbbbrrbbb..', '..bbbbrbbbbbrbbb..', '..bbbbbbbbbbbbbb..', '...bbbbbbbbbbbb...',
      '....bbbbbbbbbb....', '...bbbbbbbbbbbb...', '..bbbbbbbbbbbbbb..', '..bb.bbbbbbbb.bb..',
      '..bb.bbbbbbbb.bb..', '.....bbbbbbbb.....', '.....bbbbbbbb.....', '.....bbb..bbb.....',
      '.....bbb..bbb.....', '.....bbb..bbb.....', '....bbbb..bbbb....', '....bbbb..bbbb....',
    ],
    rows2: [
      '.....bbbbbbbb.....', '....bbbbbbbbbb....', '...bbbbbbbbbbbb...', '..bbbbbbbbbbbbbb..',
      '..bbbrrbbbbrrbbb..', '..bbbbrbbbbbrbbb..', '..bbbbbbbbbbbbbb..', '...bbbbbbbbbbbb...',
      '....bbbbbbbbbb....', '...bbbbbbbbbbbb...', '..bbbbbbbbbbbbbb..', '.bbb.bbbbbbbb.bbb.',
      '.bbb.bbbbbbbb.bbb.', '.....bbbbbbbb.....', '.....bbbbbbbb.....', '.....bbb..bbb.....',
      '....bbbb..bbbb....', '....bbbb..bbbb....', '...bbbb....bbbb...', '...bbbb....bbbb...',
    ],
  },
  // 青云古洞的洞主。石胎成精，身上裂开发紫的光 ——
  // 它不该长得像"人"，洞里的人形怪物已经够多了。
  yaowang: {
    name: '岩魈 · 洞主', behavior: 'boss', tier: 2,
    hp: 460, speed: 40, dmg: 16, xp: 200, range: 26, cd: 1.1, windup: 0.55, kb: 0, aggro: 150,
    size: [18, 20], def: 0.14,
    pal: { s: '#5E6370', S: '#3A3F4A', p: '#878D9C', r: C.red2, u: C.pur3, U: C.pur2 },
    rows: [
      '..p............p..', '..pp..........pp..', '...pp........pp...', '....ssssssssss....',
      '...ssssssssssss...', '...srrssssssrrs...', '...ssssssssssss...', '....ssssssssss....',
      '...ssssssssssss...', '..ssssuussuussds..', '.ss.ssssssssss.ss.', '.ss.ssssssssss.ss.',
      '.sS.ssssssssss.Ss.', '.sS.ssssssssss.Ss.', '....ssssssssss....', '....sss.sss.sss...',
      '....sss.sss.sss...', '....ss..ss..ss....', '....ss..ss..ss....', '...sss..ss..sss...',
    ],
    rows2: [
      '..p............p..', '..pp..........pp..', '...pp........pp...', '....ssssssssss....',
      '...ssssssssssss...', '...srrssssssrrs...', '...ssssssssssss...', '....ssssssssss....',
      '...ssssssssssss...', '..ssssUussUussds..', '.ss.ssssssssss.ss.', '.ss.ssssssssss.ss.',
      '.sS.ssssssssss.Ss.', '.sS.ssssssssss.Ss.', '....ssssssssss....', '...ssss.sss.ssss..',
      '...ssss.sss.ssss..', '....ss..ss..ss....', '....ss..ss..ss....', '...sss..ss..sss...',
    ],
  },
  boss: {
    name: '黑风寨主', behavior: 'boss', tier: 2,
    hp: 520, speed: 52, dmg: 14, xp: 180, range: 18, cd: 0.9, windup: 0.5, kb: 0, aggro: 130,
    size: [16, 20],
    pal: { p: C.ink1, P: C.ink2, e: C.red3, r: C.red2, g: C.gold2, s: C.paper2 },
    rows: [
      '...gggggggg...', '..pppppppppp..', '..peppppeppp..', '..pppppppppp..', '.pppppppppppp.',
      'pppprrrrrrpppp', 'ppprrrrrrrrppp', 'pprrggggggrrpp', 'pprggggggggrpp', 'pprrggggggrrpp',
      'ppprrrrrrrrppp', '.pprrrrrrrrpp.', '.pprrrrrrrrpp.', '..pppppppppp..', '..pp.pp.pp....',
      '..pp.pp.pp....', '..ss.pp.pp....', '..ss.pp.pp....',
    ],
    rows2: [
      '...gggggggg...', '..pppppppppp..', '..peppppeppp..', '..pppppppppp..', '.pppppppppppp.',
      'pppprrrrrrpppp', 'ppprrrrrrrrppp', 'pprrggggggrrpp', 'pprggggggggrpp', 'pprrggggggrrpp',
      'ppprrrrrrrrppp', '.pprrrrrrrrpp.', '.pprrrrrrrrpp.', '..pppppppppp..', '..ppp.pp.pp...',
      '..ppp.pp.pp...', '..sss.pp.pp...', '..sss.pp.pp...',
    ],
  },
};

export const MONSTER_IDS = Object.keys(MONSTERS);
