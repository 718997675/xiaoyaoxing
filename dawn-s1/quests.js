// quests.js · 任务系统数据层
// 纯数据 + 纯函数，无 DOM / 无 three.js 依赖，可单测。
//
// 为什么任务不塞进 items.js 或 village.js：
// 任务是**跨系统**的 —— 它要引用地图坐标、怪物类型、NPC、装备、银两。
// 放进任何一个现有模块都会造成反向依赖（items 不该知道地图坐标）。
// 单独一个模块，只被 game.js 单向引用，谁都不脏。
//
// 目标（objective）只有五种，够用且不会失控：
//   reach  走到某处（含"进古洞第 N 层"）
//   kill   击杀 N 只某类怪
//   item   持有 N 件某信物（信物在 player.relics，不占行囊）
//   have   持有 N 单位某种资源（精铁 / 银两 / 等级）
//   talk   与某个 NPC 说过话
//
// 刻意不做"收集 10 个狼牙"这种掉落物任务：那需要给行囊加一类不可分解、
// 不可装备、不可卖的新物件，会把已经稳定的行囊 UI 再撬开一次。
// 需要"带东西回来"的地方一律走 relics（信物），它在任务面板里显示，不进背包。

export const QUEST_ITEMS = {
  bamboo_heart: { name: '竹心', note: '青鳞蟒腹中取出的竹节，剖开是空的，风过会响。' },
  stone_marrow: { name: '石髓', note: '石母胎里凝的一滴，凉的，握着却烫手。' },
  yin_soil:     { name: '阴土', note: '坟头三尺下的土，捏在手里是湿的，闻着是干的。' },
  hunter_knife: { name: '猎刀', note: '刀柄缠着麻绳，绳上有一道很深的牙印。' },
  snake_gall:   { name: '蛇胆', note: '药童要的，说能镇惊。' },
  well_stone:   { name: '井底石', note: '一面有凿痕，像是被人从里面凿过。' },
};

// 三物：齐了才开古洞封碑
export const RELICS_TRIPLE = ['yin_soil', 'bamboo_heart', 'stone_marrow'];

// 任务表。坐标一律用世界像素（一格 16px），和 game.js 里的 camps / dens 同一套。
export const QUESTS = {
  // ============ 主线三条：一区一件「三物」 ============
  q_main_bamboo: {
    id: 'q_main_bamboo', kind: 'main', place: '南岭竹海',
    title: '竹海的哭声',
    giver: 'w_hunter',
    brief: '猎户吴老六的兄弟进了竹海，再没出来。',
    steps: [
      { text: '去青鳞潭看看', kind: 'reach', at: { x: 288, y: 1408, r: 70 } },
      { text: '斩了那条青鳞蟒', kind: 'kill', types: ['qingshe'], count: 1 },
    ],
    reward: { relic: 'bamboo_heart', gold: 400, fame: 5, xp: 120 },
    outro: '吴老六接过刀，看了很久那道牙印，没说话。',
  },
  q_main_cave: {
    id: 'q_main_cave', kind: 'main', place: '西荒石窟',
    title: '塌方的矿道',
    giver: 'w_stone',
    brief: '守碑人说，石髓在矿道最深处，可那地方塌了三十年。',
    steps: [
      { text: '走到塌方矿道', kind: 'reach', at: { x: 576, y: 544, r: 90 } },
      { text: '凿开石母', kind: 'kill', types: ['shimu'], count: 1 },
    ],
    reward: { relic: 'stone_marrow', gold: 500, fame: 5, xp: 160 },
    outro: '碑奴用指甲刮了刮石髓，说：“还是热的。它在等人。”',
  },
  q_main_grave: {
    id: 'q_main_grave', kind: 'main', place: '北坡乱葬岗',
    title: '北坡不葬人',
    giver: 'dao',
    brief: '玄阳子说，阴土只在夜里长，且得问过守墓人。',
    steps: [
      { text: '夜里清六只阴魂', kind: 'kill', types: ['yinhun', 'fukui'], count: 6, night: true },
      { text: '问过守墓人', kind: 'kill', types: ['yinhun'], count: 1, lord: '守墓人' },
    ],
    reward: { relic: 'yin_soil', gold: 600, fame: 8, xp: 200 },
    outro: '“土你拿去。”守墓人背过身，“碑，别碰。”',
  },

  // ============ 支线七条 ============
  q_side_dog: {
    id: 'q_side_dog', kind: 'side', place: '青云集',
    title: '恶犬成群',
    giver: 'qiao',
    brief: '石大的腿是山魈啃的，可他说最近咬人的是狗。',
    steps: [{ text: '打八只恶犬', kind: 'kill', types: ['fox'], count: 8 }],
    reward: { gold: 180, fame: 2, xp: 60 },
    outro: '“狗比人实在。”他把柴刀往肩上一扛，“至少它咬你之前会叫。”',
  },
  q_side_bandit: {
    id: 'q_side_bandit', kind: 'side', place: '青云集',
    title: '账要清',
    giver: 'inn',
    brief: '柳三娘的账本上，黑风寨欠了三年房钱。',
    steps: [{ text: '清六名山贼', kind: 'kill', types: ['zhiren'], count: 6 }],
    reward: { gold: 250, fame: 3, xp: 80 },
    outro: '“死了就死了。”她把账页撕下来，扔进灶膛，“账清了。”',
  },
  q_side_herb: {
    id: 'q_side_herb', kind: 'side', place: '南岭竹海',
    title: '蛇胆',
    giver: 'w_herbboy',
    brief: '药童小满要五枚蛇胆，说镇惊用。',
    steps: [{ text: '取五枚蛇胆', kind: 'kill', types: ['snake'], count: 5 }],
    reward: { gold: 120, fame: 1, xp: 50, potion: 2 },
    outro: '“师父说蛇胆苦。”他把药罐抱在怀里，“苦才镇得住。”',
  },
  q_side_forge: {
    id: 'q_side_forge', kind: 'side', place: '青云集',
    title: '炉子饿了',
    giver: 'smith',
    brief: '张五的炉子要十五块精铁才烧得起来。',
    steps: [{ text: '交十五块精铁', kind: 'have', field: 'iron', count: 15, spend: true }],
    reward: { gear: { r: 2, kind: 'weapon' }, gold: 100, xp: 90 },
    outro: '“铁留下，东西拿走。”他连头都没抬。',
  },
  q_side_wine: {
    id: 'q_side_wine', kind: 'side', place: '北坡乱葬岗',
    title: '一坛酒',
    giver: 'tavern',
    brief: '阿七说，守墓人每月十五会来打酒，这个月没来。',
    steps: [{ text: '把酒送到守墓人小屋', kind: 'reach', at: { x: 1952, y: 512, r: 90 } }],
    reward: { gold: 200, fame: 2, xp: 70 },
    outro: '酒坛放在门口。第二天再去看，坛子空了，坛口压着一枚铜钱。',
  },
  q_side_well: {
    id: 'q_side_well', kind: 'side', place: '青云古洞',
    title: '井底那块石',
    giver: 'zui',
    brief: '王二说井通地底。你不信，但他说得像个真事。',
    steps: [{ text: '下到古洞第一层', kind: 'dg', floor: 1 }],
    reward: { relic: 'well_stone', gold: 300, fame: 3, xp: 100 },
    outro: '石头上真有凿痕，从里往外凿的。',
  },
  q_side_tale: {
    id: 'q_side_tale', kind: 'side', place: '青云古洞',
    title: '说书人缺个结尾',
    giver: 'shuo',
    brief: '柳先生讲了三十年的故事，缺一个真结局。',
    steps: [{ text: '斩了无面剑客', kind: 'kill', types: ['wumian'], count: 1 }],
    reward: { gold: 800, fame: 10, xp: 400, gear: { r: 3, kind: 'weapon' } },
    outro: '“成了。”他把醒木一拍，“从明日起，讲你。”',
  },
};

export const QUEST_IDS = Object.keys(QUESTS);

// 主线按区域顺序解锁：后一条要先拿到前一条的三物之一。
// 不做硬性前置锁 —— 玩家想先去石窟就去，只是主线任务得按顺序接。
export const MAIN_ORDER = ['q_main_bamboo', 'q_main_cave', 'q_main_grave'];

export function questById(id) { return QUESTS[id] || null; }

// 目标是否已达成（只判"当前这一步"，进度由 game.js 维护）
export function objDone(o, prog) {
  return (prog || 0) >= (o.count || 1);
}

// 目标的一句话说明。HUD 追踪条与任务面板共用，避免两处文案不一致。
export function objText(o, prog) {
  const p = prog || 0;
  switch (o.kind) {
    case 'kill': return o.text + '（' + Math.min(p, o.count) + '/' + o.count + '）';
    case 'item': return o.text + '（' + Math.min(p, o.count || 1) + '/' + (o.count || 1) + '）';
    case 'have': return o.text + '（' + Math.min(p, o.count) + '/' + o.count + '）';
    default: return o.text;
  }
}

// 三物齐了没有
export function tripleReady(relics) {
  return RELICS_TRIPLE.every(id => (relics && relics[id]) > 0);
}
export function tripleMissing(relics) {
  return RELICS_TRIPLE.filter(id => !(relics && relics[id] > 0));
}
export function relicName(id) { return (QUEST_ITEMS[id] || {}).name || id; }

// 某个 NPC 能接 / 能交的任务
export function questsOfGiver(npcId) {
  return QUEST_IDS.map(id => QUESTS[id]).filter(q => q.giver === npcId);
}
