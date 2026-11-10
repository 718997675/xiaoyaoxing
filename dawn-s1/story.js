// story.js · 剧情数据层
// 纯数据 + 纯函数，无 DOM / 无 three.js 依赖，可单测。
//
// 为什么单独一个模块：
// 剧情要引用地图坐标、NPC、怪物、信物、时辰 —— 和 quests.js 一样是**跨系统**的。
// 塞进 village.js 会让 village 知道怪物，塞进 game.js 会让运行时被文案淹没。
// 只被 game.js 单向引用，谁都不脏。
//
// ---------- 触发器只有六种 ----------
//   boot   开局第一次（序章专用：玩家一睁眼就在土地庙里，没有"走进去"这回事）
//   enter  走进某个地标（POI 圆形范围）
//   kill   击杀某类怪 / 某个首领
//   item   持有某件信物
//   time   到某个时辰（可叠加前置 flag）
//   triple 三物齐（阴土 + 竹心 + 石髓）
//
// 为什么不做 talk 触发器：
// 对话触发的剧情会和"接任务 / 复命"抢同一个点击位 —— 玩家点一下，要么接任务
// 要么播剧情，永远猜不到是哪个。剧情统一走"条件满足就自动播"，
// 对话里只放任务与打听。**一个点击位只做一件事。**
//
// ---------- 节点结构 ----------
// {
//   id, act, title,
//   trigger: { type, ... },
//   need: ['flag'],         // 全部满足才播（可省）
//   minFame: n,             // 侠名门槛（可省）
//   lines: [{ who, name, text }],   // who=null 旁白 / 'narrator' 旁白 / NPC id
//   onEnd: { flag, clue, fame, msg },
// }
//
// 已读记录在 player.readLog（存进存档）。once 默认 true —— 剧情节点播一次就该过去，
// 能反复播的"节点"其实是系统提示，不该放在这张表里。

// ============ 地标 ============
// 坐标一律用世界像素（一格 16px），和 quests.js 的 reach / camps / dens 同一套。
// r 是触发半径：宁可给大一点，玩家不该为了"踩准某个点"来回蹭。
export const POI = {
  temple:     { x: 1896, y: 1544, r: 60,  name: '土地庙' },
  village:    { x: 1900, y: 1330, r: 150, name: '青云集' },
  seal:       { x: 1152, y: 640,  r: 90,  name: '封碑' },
  graveEdge:  { x: 1600, y: 192,  r: 160, name: '北坡乱葬岗' },
  graveHut:   { x: 1952, y: 512,  r: 90,  name: '守墓人小屋' },
  bambooEdge: { x: 700,  y: 900,  r: 130, name: '南岭竹海' },
  hunterHut:  { x: 256,  y: 1120, r: 90,  name: '猎户棚' },
  qinglin:    { x: 288,  y: 1408, r: 110, name: '青鳞潭' },
  workshop:   { x: 864,  y: 1216, r: 100, name: '废弃机坊' },
  caveMouth:  { x: 192,  y: 320,  r: 120, name: '矿口' },
  collapse:   { x: 576,  y: 544,  r: 110, name: '塌方矿道' },
  shimu:      { x: 144,  y: 544,  r: 110, name: '石母洞' },
  huoya:      { x: 640,  y: 320,  r: 110, name: '火鸦绝壁' },
};

// ============ 幕 ============
// 幕只用来分组与排序，不参与任何判定 —— 判定一律看节点自己的 trigger。
export const ACTS = [
  { id: 'prologue', name: '序章 · 破庙',       place: '青云集' },
  { id: 'act1',     name: '第一幕 · 北坡',     place: '北坡乱葬岗' },
  { id: 'act2',     name: '第二幕 · 竹海',     place: '南岭竹海' },
  { id: 'act3',     name: '第三幕 · 石窟',     place: '西荒石窟' },
  { id: 'final',    name: '终章 · 古洞',       place: '青云古洞' },
];

// ============ 剧情节点 ============
// 语气约定：句子短，能不说就不说。这个世界的 NPC 不会为主角解释自己。
export const STORY = {
  // ---------------- 序章（3）----------------
  s_pro_wake: {
    id: 's_pro_wake', act: 'prologue', title: '香灰还是温的',
    trigger: { type: 'boot' },
    lines: [
      { who: null, text: '……' },
      { who: 'narrator', text: '你在一座破庙里醒来。香灰还是温的。' },
      { who: 'narrator', text: '身上的伤结了痂，痂下面还是热的。你不记得怎么来的。' },
      { who: 'narrator', text: '手里的刀还在。刀鞘上有三道刻纹，磨得快平了 —— 那是你自己磨的。' },
      { who: 'narrator', text: '供桌上立着一块碑，碑上的字被人凿掉了。凿痕是新的。' },
      { who: 'narrator', text: '庙外有风。风里有人走动的声音，不急，也不躲。' },
      { who: null, text: '（往南是青云集。按 E 与人说话。）' },
    ],
    onEnd: { flag: 'woke' },
  },
  s_pro_liu: {
    id: 's_pro_liu', act: 'prologue', title: '命真硬',
    trigger: { type: 'enter', at: 'village' },
    need: ['woke'],
    lines: [
      { who: 'inn', text: '醒了？命真硬。' },
      { who: 'narrator', text: '她没问你叫什么。' },
      { who: 'inn', text: '庙里那摊血，我拿草木灰盖了三回。' },
      { who: 'inn', text: '你这身伤，不像山贼打的。' },
      { who: 'narrator', text: '灶上的水开了。她背过身去下面，没再说话。' },
      { who: 'inn', text: '住下吧。房钱先记着，等你砍得动东西了再说。' },
      { who: 'narrator', text: '楼上最里那间，窗对着北。她说那间空着，一直空着。' },
    ],
    onEnd: { flag: 'met_liu', fame: 1 },
  },
  s_pro_mark: {
    id: 's_pro_mark', act: 'prologue', title: '墙上的记号',
    trigger: { type: 'time', phase: 'zi' },
    need: ['met_liu'],
    lines: [
      { who: 'narrator', text: '子时。村口墙上有个记号，白灰画的，像半截剑。' },
      { who: 'narrator', text: '你回头看了一眼来路，再转回来时，记号淡了一半。' },
      { who: 'narrator', text: '街上没有人。更夫的灯笼在巷子那头，晃了一下就不见了。' },
      { who: null, text: '（第二天再去看，墙上什么也没有。灰是新的。）' },
    ],
    onEnd: { flag: 'saw_mark' },
  },

  // ---------------- 三物线索（7）----------------
  // 线索系统的设计：三件东西不是"顺路打怪掉的"，每拿一件，木牌上就多一道纹，
  // 多出来的那道纹指出下一件在哪。玩家不需要看任务列表也知道该往哪走。
  s_clue_dig: {
    id: 's_clue_dig', act: 'act1', title: '他们挖的不是陪葬',
    trigger: { type: 'enter', at: 'graveEdge' },
    lines: [
      { who: 'narrator', text: '坟地里的土是新翻的。' },
      { who: 'narrator', text: '几十个坑，挖到棺木就停手。坑边的土堆得整整齐齐 —— 他们不是来偷陪葬的。' },
      { who: 'narrator', text: '有个山贼直起腰，往坑底看了一会儿，又低头接着挖。' },
      { who: 'narrator', text: '他挖得很慢。像是在挖什么会动的东西。' },
      { who: null, text: '（挖的是坟底三尺的土。）' },
    ],
    onEnd: { flag: 'saw_dig', clue: 'dig' },
  },
  s_clue_hut: {
    id: 's_clue_hut', act: 'act1', title: '碑，别碰',
    trigger: { type: 'enter', at: 'graveHut' },
    need: ['saw_dig'],
    lines: [
      { who: 'narrator', text: '守墓人的小屋，门是虚掩的。' },
      { who: 'narrator', text: '屋里没有灯。屋后立着一块矮碑，碑前压着三枚铜钱。' },
      { who: 'narrator', text: '有人在碑后站着。你看不清他的脸 —— 他背对着月光。' },
      { who: 'w_stone', text: '土你拿去。' },
      { who: 'w_stone', text: '碑，别碰。' },
      { who: 'narrator', text: '他说话的时候没有回头。等你再看，碑后已经没人了。' },
    ],
    onEnd: { flag: 'met_gravekeeper' },
  },
  s_clue_soil: {
    id: 's_clue_soil', act: 'act1', title: '木牌',
    trigger: { type: 'item', relic: 'yin_soil' },
    lines: [
      { who: 'narrator', text: '阴土捏在手里是湿的，闻着却是干的。' },
      { who: 'narrator', text: '土里裹着一枚木牌，无字。翻过来，牌背刻着三道纹。' },
      { who: 'narrator', text: '三道。不是一道。' },
      { who: 'narrator', text: '第一道纹是新的，刻痕里还有木屑。另外两道是旧的，旧得发黑。' },
      { who: null, text: '（第一道纹指向西南 —— 南岭竹海。）' },
    ],
    onEnd: { flag: 'mark1', clue: 'mark1' },
  },
  s_clue_bamboo: {
    id: 's_clue_bamboo', act: 'act2', title: '风里有哭声',
    trigger: { type: 'enter', at: 'bambooEdge' },
    need: ['mark1'],
    lines: [
      { who: 'narrator', text: '竹海。风穿过竹节，声音像有人在里面哭。' },
      { who: 'narrator', text: '木牌上第一道纹的走向，和脚下这条溪涧一样。' },
      { who: 'narrator', text: '顺着水走，走到水声听不见的地方。' },
      { who: 'narrator', text: '林子里有脚印，不是野兽的。三拨人，三个方向。' },
    ],
    onEnd: { flag: 'saw_bamboo' },
  },
  s_clue_workshop: {
    id: 's_clue_workshop', act: 'act2', title: '不该有的工坊',
    trigger: { type: 'enter', at: 'workshop' },
    need: ['mark1'],
    lines: [
      { who: 'narrator', text: '竹子最密的地方，立着一座工坊。' },
      { who: 'narrator', text: '梁是新的，榫头对得极准，地上没有一根刨花 —— 它不是造出来的，是拼出来的。' },
      { who: 'narrator', text: '墙上钉着一张图。图上是碑：碑座、碑身、碑顶，还有碑后的三道槽。' },
      { who: 'narrator', text: '图角有落款，被人磨掉了。磨得很仔细，连笔画沟都填了。' },
      { who: null, text: '（画的是封碑的结构。有人比你先到过这里。）' },
    ],
    onEnd: { flag: 'saw_blueprint', clue: 'blueprint' },
  },
  s_clue_bamboo_heart: {
    id: 's_clue_bamboo_heart', act: 'act2', title: '第二道纹',
    trigger: { type: 'item', relic: 'bamboo_heart' },
    lines: [
      { who: 'narrator', text: '竹心剖开是空的。风过会响。' },
      { who: 'narrator', text: '木牌上的第二道纹亮了，纹路朝西北。' },
      { who: 'narrator', text: '亮过的那一道，摸上去是温的。' },
      { who: 'narrator', text: '第三道纹还是死的。它要等第三件东西。' },
      { who: null, text: '（第二道纹指向西北 —— 西荒石窟。）' },
    ],
    onEnd: { flag: 'mark2', clue: 'mark2' },
  },
  s_clue_mine: {
    id: 's_clue_mine', act: 'act3', title: '钉在梁上的剑痕',
    trigger: { type: 'enter', at: 'caveMouth' },
    need: ['mark2'],
    lines: [
      { who: 'narrator', text: '矿道往下走，越走越黑。' },
      { who: 'narrator', text: '壁上有一道剑痕，钉在木梁上 —— 不是砍的，是钉进去的。' },
      { who: 'narrator', text: '木梁还在渗水。剑痕是新的。' },
      { who: 'narrator', text: '再往里，有火光。有人在下面活着。' },
    ],
    onEnd: { flag: 'saw_mine' },
  },
  s_clue_collapse: {
    id: 's_clue_collapse', act: 'act3', title: '只差三尺',
    trigger: { type: 'enter', at: 'collapse' },
    need: ['mark2'],
    lines: [
      { who: 'narrator', text: '塌方区。石头堆了半人高，石头后面有声音。' },
      { who: 'narrator', text: '有人在敲。三下，停一停，再三下。' },
      { who: 'narrator', text: '石堆尽头是一道岩壁，壁上有一道细缝。缝里透出来的风是暖的。' },
      { who: 'narrator', text: '缝那边有光。是火把的光。' },
      { who: null, text: '（他们挖了三年，只差最后三尺。）' },
    ],
    onEnd: { flag: 'saw_gap', clue: 'gap' },
  },
  s_clue_marrow: {
    id: 's_clue_marrow', act: 'act3', title: '三道纹齐了',
    trigger: { type: 'item', relic: 'stone_marrow' },
    lines: [
      { who: 'narrator', text: '石髓是凉的，握着却烫手。' },
      { who: 'narrator', text: '木牌上的第三道纹亮起来，三道并排，排成一个方向。' },
      { who: 'narrator', text: '正北。' },
      { who: 'narrator', text: '三道纹同时发烫，木牌在手里震了一下，像什么东西应了。' },
      { who: null, text: '（三道纹皆指正北 —— 青云古洞。）' },
    ],
    onEnd: { flag: 'mark3', clue: 'mark3' },
  },
  s_clue_seal: {
    id: 's_clue_seal', act: 'final', title: '封碑',
    trigger: { type: 'triple' },
    lines: [
      { who: 'narrator', text: '封碑上的凿痕，和土地庙那块一模一样。' },
      { who: 'narrator', text: '碑脚有三个槽，槽的形状和木牌上的三道纹对得上。' },
      { who: 'narrator', text: '三件东西放上去，碑面裂开一道缝，往里吸气。' },
      { who: 'narrator', text: '缝里有风。风是暖的。' },
      { who: 'narrator', text: '碑后站着一个人。他没有脸，手里握着和你一样的兵器。' },
      { who: null, text: '（碑后有路。往下。）' },
    ],
    onEnd: { flag: 'seal_open' },
  },
};

export const STORY_IDS = Object.keys(STORY);

// 按幕分组，给剧情日志页用
export function storyByAct() {
  const out = [];
  for (const a of ACTS) {
    const ids = STORY_IDS.filter(id => STORY[id].act === a.id);
    if (ids.length) out.push({ act: a, ids });
  }
  return out;
}

// ============ 三物线索 ============
// 线索不是任务：任务有"完成/未完成"，线索只有"知道/不知道"。
// 玩家漏掉一条线索不该被卡住 —— 所以线索只影响木牌上有没有那道纹，
// 不影响能不能打、能不能开门（开门看三物本身）。
export const CLUES = {
  dig:   { name: '坟底三尺', text: '山贼不偷陪葬，只挖坟底三尺的土。土是湿的，闻着是干的。' },
  mark1: { name: '木牌 · 第一道纹', text: '无字木牌，牌背三道纹。第一道朝西南。' },
  blueprint: { name: '封碑图', text: '竹海工坊里的图纸：碑座、碑身、碑顶，碑后三道槽。落款被磨掉了。' },
  mark2: { name: '木牌 · 第二道纹', text: '第二道朝西北。亮过的那道摸上去是温的。' },
  gap:   { name: '只差三尺', text: '矿道最深处与另一侧只隔一道岩壁。缝里有暖风，也有火把的光。' },
  mark3: { name: '木牌 · 第三道纹', text: '三道并排，皆指正北。' },
};
export const CLUE_IDS = Object.keys(CLUES);

// ============ 环境文本 ============
// 碑文 / 木牌 / 刻字。不占对话，走近按 E 读，读完记进日志。
// 单独一张表而不是塞进 STORY：这些可以反复读，STORY 的节点只播一次。
export const ENV_TEXTS = {
  e_temple_stone: {
    // 故意放在土地庙南侧 80 多像素外：庙门口（SPAWN 56px 内）是"打坐 / 铁匠台"的
    // 交互位，同一块地不能既开面板又读碑 —— 一个点击位只做一件事。
    at: { x: 1830, y: 1600, r: 32 }, name: '庙中残碑',
    text: '碑上原本刻着一个名字，被人用凿子从中间劈开，凿到石心。'
      + '凿痕的边还是白的 —— 石头要几十年才会旧成那样。这是这几年的事。'
      + '碑座下压着半截香，还是新的。有人比你早来，也比你早走。',
  },
  e_grave_stone: {
    at: { x: 1952, y: 486, r: 34 }, name: '守墓人的碑',
    text: '一块矮碑，没有名字，只刻了四个字：'
      + '「勿启勿视」。字是倒着刻的 —— 刻碑的人不想让躺着的人看见。'
      + '碑背有更小的一行：「我在下面等了三百年，够了。」',
  },
  e_bamboo_stone: {
    at: { x: 262, y: 1096, r: 34 }, name: '竹海残碑',
    text: '半截石碑倒在竹根里。能认出的只有一行：'
      + '「竹有节，人有骨，节断则竹死」。后半句被磨平了。'
      + '磨口是圆的，不是凿的 —— 是有人日复一日用手掌擦掉的。',
  },
  e_mine_sign: {
    at: { x: 200, y: 296, r: 34 }, name: '矿道木牌',
    text: '木牌上写着「戌时收工，不得深入」。'
      + '下面被人用炭补了一行小字：「第三层别去。去了回不来。」炭迹被水冲淡了。'
      + '木牌背后钉着七枚牌位，每枚只有巴掌大。',
  },
  e_workshop_plate: {
    at: { x: 872, y: 1196, r: 34 }, name: '工坊铭牌',
    text: '铜牌上铸着「青云古洞 · 封碑制式 · 其三」。'
      + '落款处本该有个名字，被人磨平了，磨得很仔细，连笔画沟都填了。'
      + '铜牌的边沿还留着铸模的毛刺 —— 它是新铸的，却装在一座旧梁上。',
  },
  e_qinglin: {
    at: { x: 296, y: 1382, r: 34 }, name: '潭边刻字',
    text: '潭边石头上刻着一行字，被水泡得发黑：'
      + '「此水通北」。往北看，只有竹子和雾。'
      + '字下面还有一道深深的划痕，像是有人想把这行字划掉，划到一半停了。',
  },
};
export const ENV_IDS = Object.keys(ENV_TEXTS);

// ============ 三层对话 ============
// 「初见 / 熟识 / 深交」不是三段不同的台词，是**同一个人对同一个人**的态度变化。
// 门槛用侠名（5 / 30），因为侠名是这个世界里唯一"别人怎么看你"的度量。
//
// 称呼是最便宜的信号：从「这位少侠」到「你」，一句话就能让人感觉被记住了。
// 深交层不再称呼 —— 熟人之间不称呼。
export const NPC_LAYERS = [
  { id: 'first', at: 0,  name: '初见' },
  { id: 'known', at: 5,  name: '熟识' },
  { id: 'close', at: 30, name: '深交' },
];

// 每个 NPC 三层。lines 是问候（轮着抽），ask 是「打听」。
// 没有列在这里的 NPC 走 village.js 原有的 greet / ask，不强制迁移。
export const NPC_LINES = {
  geng: {
    first: {
      lines: ['三更了，还不歇？', '这条街我走了四十年，闭着眼都不会撞墙。'],
      ask: '野地里的东西，子时最凶，卯时最蠢。要打，趁天亮前后去。',
    },
    known: {
      lines: ['又是你。夜里的村子，就我们俩醒着。', '灯笼我换过三回了，这条街还是这么黑。'],
      ask: '坟地方向近来不太平。山贼不去抢粮，倒往坟里钻 —— 你说怪不怪。',
    },
    close: {
      lines: ['来了。', '今晚风大，早些回。'],
      ask: '你身上那股气，跟三十年前那个背刀的一个味儿。他没回来。',
    },
  },
  hai: {
    first: {
      lines: ['你那把刀，真能砍妖怪吗？', '我娘不让我出村，说出村会被叼走。'],
      ask: '井里有一次捞上来一把生锈的剑，村正说那是"有灵性的"，后来就不见了。',
    },
    known: {
      lines: ['我给你看我藏的石头——只有三块，不给你。', '你砍过几只了？我数到七。'],
      ask: '我跟你说，夜里村口墙上会多出个记号。我看了两回，第三回就没了。',
    },
    close: {
      lines: ['你回来啦。', '我娘说你不是坏人。她很少说人好话。'],
      ask: '我长大了也要拿刀。你别死啊，等我。',
    },
  },
  yu: {
    first: {
      lines: ['灶上温着汤，你走这一趟，脸都白了。', '年轻人总以为自己不会死。'],
      ask: '往东那片坟地，白昼也有东西在游。别一个人去。',
    },
    known: {
      lines: ['坐会儿吧，不急这一时。', '汤还热。喝完了再走。'],
      ask: '我这把年纪，见过的死人比活人多。坟地那帮人挖土的样子，不像贼。',
    },
    close: {
      lines: ['回来了就好。', '……手怎么这么凉。'],
      ask: '你要真想去北边那个洞，先去庙里看看那块碑。字是被人凿掉的，不是磨掉的。',
    },
  },
  qiao: {
    first: {
      lines: ['柴越来越难砍了。', '这条腿是去年被山魈啃的，你别学我。'],
      ask: '山里那窝山魈，就在西北坡上。它们怕火，不怕刀。',
    },
    known: {
      lines: ['后山的树，去年还是好好的。', '你砍柴不？我教你，三刀一棵。'],
      ask: '竹海那边的竹子，砍了会流红水。老辈人不让砍，说里面有东西。',
    },
    close: {
      lines: ['你来得正好，帮我抬一下。', '这条腿废了，可眼睛还认得路。'],
      ask: '我爷爷说过，北边那个洞里有块碑，碑开了就有人要死。他讲这话时在发抖。',
    },
  },
  shuo: {
    first: {
      lines: ['坐下听一段？不收钱，收个脸熟。', '江湖上的人来来去去，只有故事留得住。'],
      ask: '你身上这股气，不像久居此地的人。外头的事，我知道一些。',
    },
    known: {
      lines: ['今日讲的是黑风寨，明日许就讲你。', '你来晚了，刚讲完一段。'],
      ask: '三十年前有个背刀的从东边进村，往北去了。我那会儿还年轻，记得他刀鞘上有三道纹。',
    },
    close: {
      lines: ['今天不讲别人的事。', '你坐。我说个没跟人讲过的。'],
      ask: '我讲了三千年故事，只有一个不敢讲完 —— 那个背刀的，是我放进去的。',
    },
  },
  dao: {
    first: {
      lines: ['此地阴气自地底上来，子时莫在野外停留。', '你这面相，是要走远路的。'],
      ask: '阴物惧清心。带一包清心散，胜过带十把刀。',
    },
    known: {
      lines: ['道不远人，人自远道。', '又见面了。今日不画符，只说话。'],
      ask: '阴土、竹心、石髓 —— 这三样东西凑齐，北边那个洞才开得。你信不信，我不劝。',
    },
    close: {
      lines: ['你来了。', '贫道等你很久了。'],
      ask: '你身上那三道纹，不是纹。是疤。',
    },
  },
  zui: {
    first: {
      lines: ['……嗝。', '别、别扶我，我自己能站。'],
      ask: '我告诉你个秘密——那口井，通到地底下去。他们不信，你信不信？',
    },
    known: {
      lines: ['你也知道那口井底下……算了，不说了。', '来，喝一口。就一口。'],
      ask: '井底那块石头，我摸过。凉的。上面有凿痕，从里往外凿的 —— 有人想出来。',
    },
    close: {
      lines: ['……你还没走啊。', '（他把酒碗推过来，没说话。）'],
      ask: '我不醉。我装醉。装醉的人说什么都没人当真，所以我什么都敢看。',
    },
  },
  w_herbboy: {
    first: {
      lines: ['师父出诊去了，药我自己会抓。', '别站门口，挡光。'],
      ask: '蛇胆要现取的才镇得住惊。你身上那股血腥味，是刚杀过吧？',
    },
    known: {
      lines: ['你要蛇胆吗？我攒了两枚，不够。', '师父说我抓错药，其实我没抓错。'],
      ask: '竹海的竹子，节里是空的。空的才响。人也一样。',
    },
    close: {
      lines: ['你来了。药我给你留了。', '别谢。谢了我还得再留。'],
      ask: '我数过：进竹海的人，十个回来三个。回来的三个，有两个不说话。',
    },
  },
};

// 按侠名挑一层。纯函数 —— 自检要能在不碰 game.js 的情况下验它。
export function npcLayer(fame) {
  let out = NPC_LAYERS[0];
  for (const l of NPC_LAYERS) if ((fame || 0) >= l.at) out = l;
  return out;
}
export function npcLines(npcId, fame) {
  const t = NPC_LINES[npcId];
  if (!t) return null;
  return t[npcLayer(fame).id] || null;
}

// ============ 纯判定 ============
// ctx 是运行时快照，只带判定要用的字段。这样自检可以随手造一个 ctx 跑遍所有节点，
// 不用起游戏、不用等时辰。
//   { flags, relics, read, fame, phase, kills, bossKills, triple }
export function storyReady(s, ctx) {
  if (!s || !ctx) return false;
  if (ctx.read && ctx.read[s.id]) return false;
  if (s.need && !s.need.every(f => ctx.flags && ctx.flags[f])) return false;
  if (s.minFame && (ctx.fame || 0) < s.minFame) return false;
  const t = s.trigger || {};
  switch (t.type) {
    case 'boot': return true;
    case 'enter': {
      const p = POI[t.at];
      if (!p || !ctx.pos) return false;
      return Math.hypot(ctx.pos.x - p.x, ctx.pos.y - p.y) <= p.r;
    }
    case 'kill': {
      if (t.lord) return !!(ctx.bossKills && ctx.bossKills[t.lord]);
      if (!t.types) return false;
      const k = ctx.kills || {};
      return t.types.some(ty => (k[ty] || 0) >= (t.count || 1));
    }
    case 'item': return !!(ctx.relics && ctx.relics[t.relic] > 0);
    case 'time': return ctx.phase === t.phase;
    case 'triple': return !!ctx.triple;
    default: return false;
  }
}

// 一句话说明"这个节点在等什么"，给日志页显示未解锁的节点用。
// 不写会剧透的细节 —— 只写条件，不写内容。
export function storyHint(s) {
  const t = (s && s.trigger) || {};
  const need = (s && s.need || []).length ? '（需前情）' : '';
  switch (t.type) {
    case 'boot': return '开局';
    case 'enter': return '去' + ((POI[t.at] || {}).name || t.at) + need;
    case 'kill': return t.lord ? '斩「' + t.lord + '」' + need : '杀敌' + need;
    case 'item': return '得信物' + need;
    case 'time': return '夜半' + need;
    case 'triple': return '三物齐' + need;
    default: return '未知';
  }
}
