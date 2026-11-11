// story.js · 剧情数据层
// 纯数据 + 纯函数，无 DOM / 无 three.js 依赖，可单测。
//
// 为什么单独一个模块：
// 剧情要引用地图坐标、NPC、怪物、信物、时辰 —— 和 quests.js 一样是**跨系统**的。
// 塞进 village.js 会让 village 知道怪物，塞进 game.js 会让运行时被文案淹没。
// 只被 game.js 单向引用，谁都不脏。
//
// ---------- 触发器只有七种 ----------
//   boot   开局第一次（序章专用：玩家一睁眼就在土地庙里，没有"走进去"这回事）
//   enter  走进某个地标（POI 圆形范围）
//   kill   击杀某类怪 / 某个首领
//   item   持有某件信物
//   time   到某个时辰（可叠加前置 flag）
//   triple 三物齐（阴土 + 竹心 + 石髓）
//   floor  下到古洞第 N 层（P9 加的唯一一种）
//
// 为什么 P9 要加 floor：终章发生在古洞里，而古洞不是一个"地标"—— 它是三块
// 每次进去都重排的房间，玩家在里面的坐标没有叙事意义，有意义的是"第几层"。
// 硬拿 enter 去凑，只能把地标钉在洞口，那样"下到第三层"这件事就写不出来了。
// 注意 floor 是"≥ N"不是"= N"：玩家从三层回一层，二层那段字不该重播 ——
// readLog 已经挡了一次，但语义上也该是"至少下到这么深"。
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
//   onEnd: { flag, clue, fame, msg, choice },
// }
//
// choice 只有终章用得上，是 P7 以来 onEnd 第一次装不下的东西：
//   { prompt: '一句话问玩家',
//     options: [{ id, label, hint, flag, fame, clue, msg,
//                 lines: [...] }] }   // lines = 选完接着播的结局旁白
// 设计上不设对错 —— 两个分支都给 flag，都不扣任何东西，只改"后来怎样了"。
// 玩家做选择时不该算账，否则那就不是选择，是一道数学题。
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
  gravePit:   { x: 1760, y: 400,  r: 90,  name: '挖开的合葬墓' },
  graveHut:   { x: 1952, y: 512,  r: 90,  name: '守墓人小屋' },
  bambooEdge: { x: 700,  y: 900,  r: 130, name: '南岭竹海' },
  cutterGrave: { x: 520, y: 1040, r: 80,  name: '砍竹人的坟' },
  hunterHut:  { x: 256,  y: 1120, r: 90,  name: '猎户棚' },
  // 竹桥的坐标不是随手定的：竹海的溪涧是从北缘蜿蜒到南缘的一条实心水带，
  // 只在三行（tile y=62/76/90）架了桥。这里是中间那处，桥面 tile 是 9。
  // 桥削断在剧情里是"第二道剑痕"，所以它必须是一座**真的能走过去的桥**，
  // 玩家站在断口上看见下游卡着另外半截，那一刀才有分量。
  bambooBridge: { x: 680, y: 1224, r: 70, name: '断掉的竹桥' },
  qinglin:    { x: 288,  y: 1408, r: 110, name: '青鳞潭' },
  workshop:   { x: 864,  y: 1216, r: 100, name: '废弃机坊' },
  caveMouth:  { x: 192,  y: 320,  r: 120, name: '矿口' },
  collapse:   { x: 576,  y: 544,  r: 110, name: '塌方矿道' },
  shimu:      { x: 144,  y: 544,  r: 110, name: '石母洞' },
  huoya:      { x: 640,  y: 320,  r: 110, name: '火鸦绝壁' },
  // 矿工营地：探出来的点，不是画的。石窟这一片能站人的地方稀疏，
  // 这里离最近的地标（塌方矿道 / 石母洞）还有 154px，玩家不会"走过去同时满足两段字"。
  mineCamp:   { x: 352,  y: 720,  r: 95,  name: '矿工营地' },
  // 打通侧壁：石窟东缘最后一处能站人的点（tile 51,31），正对古洞西壁。
  // 古洞占 tile 57..87 × 10..38，中间那 88px 的岩层就是"最后三尺"。
  // 这个坐标是洪水填充验过连通的 —— 只是 canStand 为真还不够，中间被岩层隔断照样走不到。
  breakthrough: { x: 824, y: 496, r: 95,  name: '打通的侧壁' },
  // —— 第二章 P12-B：全部落在 CH1_H 以南 ——
  // 坐标先过 canStand 与洪水填充：每一处周围 10/18/26/34px 都有可站格，
  // 且与第一章的 20 处地标两两不重叠（最近的一对也隔着 700px 以上）。
  southGate:   { x: 544,  y: 1696, r: 90,  name: '南疆关口' },
  guHut:       { x: 544,  y: 1856, r: 100, name: '蛊婆的棚子' },
  guBanner:    { x: 352,  y: 1856, r: 95,  name: '蛊幡' },
  redSoil:     { x: 768,  y: 2112, r: 110, name: '赤土墟' },
  gumuDen:     { x: 224,  y: 2048, r: 95,  name: '蛊母巢' },
  riverGate:   { x: 1904, y: 1696, r: 90,  name: '江岸关口' },
  ferry:       { x: 1600, y: 1856, r: 100, name: '渡口' },
  riverBridge: { x: 1600, y: 1952, r: 80,  name: '渡桥' },
  jiangDock:   { x: 1984, y: 2144, r: 70,  name: '江匪坞' },
  jiangguiDen: { x: 1792, y: 2112, r: 90,  name: '水底铁链' },
  chainEnd:    { x: 2112, y: 2208, r: 95,  name: '链尽头' },
  chainPost:   { x: 1888, y: 2176, r: 80,  name: '拴链石桩' },
};

// ============ 幕 ============
// 幕只用来分组与排序，不参与任何判定 —— 判定一律看节点自己的 trigger。
export const ACTS = [
  { id: 'prologue', name: '序章 · 破庙',       place: '青云集' },
  { id: 'act1',     name: '第一幕 · 北坡',     place: '北坡乱葬岗' },
  { id: 'act2',     name: '第二幕 · 竹海',     place: '南岭竹海' },
  { id: 'act3',     name: '第三幕 · 石窟',     place: '西荒石窟' },
  { id: 'final',    name: '终章 · 古洞',       place: '青云古洞' },
  // —— 第二章 P12-B：追加三幕，第一章五幕的 id / 顺序一字不改 ——
  { id: 'ch2a',     name: '第二章一幕 · 南疆瘴林', place: '南疆瘴林' },
  { id: 'ch2b',     name: '第二章二幕 · 江岸渡口', place: '江岸渡口' },
  { id: 'ch2c',     name: '第二章三幕 · 链尽头',   place: '链尽头' },
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
  // P8 · 第一幕正文
  // 这一幕要回答的问题是"他们到底在挖什么"。答案不能一次给完：
  // 坟外围只看到土是新的（s_clue_dig）→ 挖开的那座墓里没有尸骨（这里）→
  // 守墓人不是人（s_a1_keeper_kill）→ 树妖肚子里全是同门的兵器（s_a1_treant）。
  // 四步一步比一步往里，玩家自己会把"守"这个字拼出来。
  s_a1_pit: {
    id: 's_a1_pit', act: 'act1', title: '合葬墓',
    trigger: { type: 'enter', at: 'gravePit' },
    need: ['saw_dig'],
    lines: [
      { who: 'narrator', text: '坟地中间有一座被挖开的合葬墓。棺盖推到一边，搁在土坡上。' },
      { who: 'narrator', text: '棺里没有尸骨。' },
      { who: 'narrator', text: '只有一层白灰，铺得平平整整，像谁特意抹过。' },
      { who: 'narrator', text: '灰上有一个人形的印子。躺着压出来的那种。' },
      { who: 'narrator', text: '印子比活人长。两头都多出一截。' },
      { who: 'narrator', text: '棺盖内侧有一道痕，从上往下劈到底 —— 一刀，劈穿了整块木头。' },
      { who: 'narrator', text: '断口很新。木头的茬还是白的。' },
      { who: null, text: '（有人比山贼更早来过这里。他劈开棺盖，看了一眼，又走了。）' },
    ],
    onEnd: { flag: 'saw_pit', clue: 'pit' },
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
  // 夜里的守墓人。任务里他就是那只「守墓人」，白天在小屋背对着人说话的是同一个影子。
  // lord 分支的 key 只能是 bossKills 的键 —— 那是 e.type（yinhun），不是显示名，
  // 所以 label 单独给一个，日志页才不会写着「斩「yinhun」」。
  s_a1_keeper_kill: {
    id: 's_a1_keeper_kill', act: 'act1', title: '他没有脸',
    trigger: { type: 'kill', lord: 'yinhun', label: '守墓人' },
    need: ['met_gravekeeper'],
    lines: [
      { who: 'narrator', text: '守墓人倒下的时候没有出声。' },
      { who: 'narrator', text: '他的脸是一团白灰。灰散开了，底下还是灰。' },
      { who: 'narrator', text: '他手里攥着半截香。香是点着的，一直没灭。' },
      { who: 'narrator', text: '风把灰吹起来，绕着小屋转了半圈，落回碑前。' },
      { who: 'narrator', text: '地上只剩一件衣服。衣服下面是空的。' },
      { who: 'narrator', text: '你想起他那句话。他说的是"土你拿去"，不是"我把它给你"。' },
      { who: null, text: '（他不是人。他是那块碑的影子。）' },
      { who: null, text: '（碑还在，他还会回来。）' },
    ],
    onEnd: { flag: 'killed_keeper' },
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
  // 第一幕的收束。不写"寨主遗言"—— 寨主是别处的营地首领，玩家未必打得到，
  // 把主线收在一个玩家可能跳过的人身上，等于把这一幕的结尾交给运气。
  // 收在树妖身上：它就在坟地尽头，而且是"收了三十年东西"的那一个。
  // 最关键的是它吐出来的东西能反打主角自己：同制式的刀、同样的三道刻纹。
  s_a1_treant: {
    id: 's_a1_treant', act: 'act1', title: '树心是空的',
    trigger: { type: 'kill', types: ['treant'], label: '千年树妖' },
    need: ['saw_dig'],
    lines: [
      { who: 'narrator', text: '树妖倒下去的时候，根须还在地里抓着。' },
      { who: 'narrator', text: '它的树心是空的。' },
      { who: 'narrator', text: '空心里塞着东西：几把刀，一堆铜钱，两副护腕。' },
      { who: 'narrator', text: '刀都是同一制式。刀鞘上三道刻纹，磨得快平了。' },
      { who: 'narrator', text: '和你手里这把，一模一样。' },
      { who: 'narrator', text: '铜钱串在一起，绳子烂了，铜锈结成一块。' },
      { who: 'narrator', text: '最底下压着一张纸。纸上写着一个名字，被水浸烂了。' },
      { who: 'narrator', text: '能认出的只有最后一个字：守。' },
      { who: null, text: '（树妖不是吃人。它是在替谁收东西。）' },
    ],
    onEnd: { flag: 'killed_treant', clue: 'treant_hoard' },
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
  // ---------------- 第二幕正文（P8）----------------
  // 这一幕的主题是"声音"。猎户说别应，砍竹人的账本写着"他们都听见了"，
  // 竹海的残碑刻着"节断则竹死"。风穿过竹节像哭 —— 整幕都在讲"有人在里面喊你"。
  // 真正的危险不是喊声，是你应了之后，声音就换成了你自己的嗓子。
  s_a2_hut: {
    id: 's_a2_hut', act: 'act2', title: '别应',
    trigger: { type: 'enter', at: 'hunterHut' },
    need: ['mark1'],
    lines: [
      { who: 'narrator', text: '猎户棚。吴老六蹲在门口补网。' },
      { who: 'narrator', text: '网破得很厉害。破口是圆的 —— 不是鱼咬的，也不是刀割的。' },
      { who: 'w_hunter', text: '往南走，听见有人喊你名字，别应。' },
      { who: 'narrator', text: '他说这话的时候没抬头。' },
      { who: 'w_hunter', text: '我兄弟应了。' },
      { who: 'narrator', text: '针在网眼里停了一下，又接着走。' },
      { who: 'w_hunter', text: '他应完，那声音就换成了他自己的嗓子。' },
      { who: 'w_hunter', text: '后半夜我在林子里听见他喊我。喊了一整夜。' },
      { who: 'narrator', text: '他把补好的网折起来，压在膝上。' },
      { who: 'w_hunter', text: '天亮了我才敢进去看。人还在。就是不肯出来。' },
    ],
    onEnd: { flag: 'met_hunter' },
  },
  s_a2_cutter: {
    id: 's_a2_cutter', act: 'act2', title: '七个土包',
    trigger: { type: 'enter', at: 'cutterGrave' },
    need: ['saw_bamboo'],
    lines: [
      { who: 'narrator', text: '竹林里有一小块空地，堆着七个土包。' },
      { who: 'narrator', text: '没有碑。每个土包前插着一根竹节。' },
      { who: 'narrator', text: '竹节是空的。风过的时候会响。' },
      { who: 'narrator', text: '七个，七个声音不一样高。' },
      { who: 'narrator', text: '最边上一个土包是新的。插的竹节还是青的。' },
      { who: 'narrator', text: '竹节里塞着一张纸，卷成细条。' },
      { who: 'narrator', text: '纸上写着名字。写了一半，笔停了。' },
      { who: 'narrator', text: '停笔的地方洇开一团墨。像是写着写着，手被人按住了。' },
      { who: null, text: '（砍竹的人，一个也没出去。）' },
    ],
    onEnd: { flag: 'saw_cutter_grave', clue: 'cutter' },
  },
  s_a2_bridge: {
    id: 's_a2_bridge', act: 'act2', title: '桥是被人削断的',
    trigger: { type: 'enter', at: 'bambooBridge' },
    need: ['saw_bamboo'],
    lines: [
      { who: 'narrator', text: '竹桥断了一半。' },
      { who: 'narrator', text: '断口是斜的，一刀削到底。不是踩塌的，也不是水冲的。' },
      { who: 'narrator', text: '断茬还是青的。' },
      { who: 'narrator', text: '断掉的那半截被水冲到下游，卡在两块石头中间。' },
      { who: 'narrator', text: '溪水从它上面翻过去，翻出一道白线。' },
      { who: 'narrator', text: '有人在前面走。走过去之后，把桥削了。' },
      { who: 'narrator', text: '他不想让人跟。' },
      { who: null, text: '（这是第二道。第一道在坟地，劈开的是棺盖。）' },
    ],
    onEnd: { flag: 'saw_broken_bridge', clue: 'bridge' },
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
  // 第二幕的收束。傀儡倒下去露出的东西要能改掉玩家对"工坊"的整个理解：
  // 不是"有人在这里造傀儡"，是"傀儡先在这里，房子是后来照着它盖的"。
  // 这条和第三幕的矿道木梁是同一件事的两头 —— 有人比所有人更早，一直在守着。
  s_a2_puppet: {
    id: 's_a2_puppet', act: 'act2', title: '它守的不是工坊',
    trigger: { type: 'kill', types: ['kuilei'], label: '机关傀儡' },
    need: ['saw_blueprint'],
    lines: [
      { who: 'narrator', text: '傀儡散架了。齿轮还在转，转到最后一格，卡住。' },
      { who: 'narrator', text: '它的胸腔是空的。' },
      { who: 'narrator', text: '里面立着一块碑。巴掌大，碑面朝里。' },
      { who: 'narrator', text: '碑上刻着字。笔法和封碑上的一样，一样被凿掉一半。' },
      { who: 'narrator', text: '凿痕在碑面上，从里往外。' },
      { who: 'narrator', text: '它不是守工坊的。' },
      { who: 'narrator', text: '它是被派来守这块碑的。工坊是后来才盖在它外面的。' },
      { who: 'narrator', text: '梁上的榫头对得那么准，是因为它已经在这儿站了很多年。' },
      { who: null, text: '（有人在照着它的位置，盖了一座房子。）' },
    ],
    onEnd: { flag: 'killed_puppet', clue: 'puppet_stone' },
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
  // 第三幕的主题是"黑"。第一幕是恨（谁在挖坟），第二幕是怕（有人在喊你），
  // 第三幕该轮到"认"了 —— 玩家在这一幕里第一次看见别人和他一样在数日子。
  // 矿工营地是这一幕唯一有人说话的地方，所以它必须早出现：先看见人，
  // 后面石母、火鸦王那些"不是人的东西"才有分量。
  s_a3_camp: {
    id: 's_a3_camp', act: 'act3', title: '外面天亮没有',
    trigger: { type: 'enter', at: 'mineCamp' },
    need: ['saw_mine'],
    lines: [
      { who: 'narrator', text: '营地是半塌的。塌下来的那一半用坑木撑着，撑得歪。' },
      { who: 'narrator', text: '有人在。六七个，都蹲在火边，没一个人在干活。' },
      { who: 'w_miner', text: '外面……天亮没有？' },
      { who: 'narrator', text: '他问得很小心，像怕听见答案。' },
      { who: 'narrator', text: '你说天亮了。' },
      { who: 'narrator', text: '他们互相看了看，谁也没高兴。' },
      { who: 'w_miner', text: '我们数到三百二十七。' },
      { who: 'narrator', text: '壁根上刻着一排道子，一道一天。刻到三百多就乱了，后面开始重复。' },
      { who: 'narrator', text: '锅里有东西在煮。是蛋。蛋壳比拳头大，壳上有褐斑。' },
      { who: 'w_miner', text: '往东走，能出去。' },
      { who: 'narrator', text: '说到一半他停了，改口。' },
      { who: 'w_miner', text: '往东走，得先过石母那一段。' },
      { who: 'narrator', text: '你问下面还有几个人。他伸出三个指头，又收回去一个。' },
      { who: null, text: '（他们不说"三年"。他们只说"从那年冬天起"。）' },
    ],
    onEnd: { flag: 'met_miners', clue: 'miners' },
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
  // 石母不是"守关的怪"，是"在生的东西"。这一节要改掉玩家对它的整个理解：
  // 矿工以为在跟石头较劲，其实是在跟一个一直长的东西较劲 —— 挖开第二天又长回去。
  // 它也不打你，它拉塌顶。所以这一节的写法是"它没动过"，而不是"它出招了"。
  s_a3_shimu: {
    id: 's_a3_shimu', act: 'act3', title: '它没站起来过',
    trigger: { type: 'kill', types: ['shimu'], label: '石母' },
    need: ['saw_gap'],
    lines: [
      { who: 'narrator', text: '石母趴着，肚子贴着地。' },
      { who: 'narrator', text: '它从头到尾没站起来过。' },
      { who: 'narrator', text: '它不动。可顶上的石头一直在掉。' },
      { who: 'narrator', text: '它不是在打你。它是要把你压在这儿 —— 压住了，就不必打了。' },
      { who: 'narrator', text: '你砍到第七刀，它肚子里有东西动了一下。' },
      { who: 'narrator', text: '石皮裂开，里面是一汪凝住的石，像冻住的奶。' },
      { who: 'narrator', text: '那滴东西是凉的。握在手里，掌心发烫。' },
      { who: 'narrator', text: '矿工说这一段挖不动。挖开了，第二天又长回去。' },
      { who: 'narrator', text: '他们以为是在跟石头较劲。' },
      { who: null, text: '（它不是在挡路。它是在生。）' },
    ],
    onEnd: { flag: 'killed_shimu', clue: 'shimu_womb' },
  },
  // 火鸦王这一节要和营地那口锅对上。玩家先看见有人在煮蛋，再看见蛋壳里是手指骨 ——
  // 两件事之间隔了二十分钟游戏时间，自己拼出来的那一下比直接告诉他狠得多。
  // 所以这一节从头到尾不提"人"，只提骨头。
  s_a3_huoya: {
    id: 's_a3_huoya', act: 'act3', title: '它撞的是火',
    trigger: { type: 'kill', types: ['huoya'], label: '火鸦王' },
    need: ['saw_gap'],
    lines: [
      { who: 'narrator', text: '火把灭了三次。' },
      { who: 'narrator', text: '第一次是被风。第二次是被翅膀。第三次，你干脆不点了。' },
      { who: 'narrator', text: '黑暗里有一双翅膀，在数你的脚步。' },
      { who: 'narrator', text: '它撞的从来不是你。它撞的是火。' },
      { who: 'narrator', text: '它知道人怕黑。它比人更早知道。' },
      { who: 'narrator', text: '巢在绝壁上。用骨头搭的，搭得很整齐，一根一根码着。' },
      { who: 'narrator', text: '巢里有蛋。蛋壳是空的，壳里不是雏。' },
      { who: 'narrator', text: '是手指骨。很细的那种。' },
      { who: null, text: '（营地里那口锅，煮的就是这个。）' },
    ],
    onEnd: { flag: 'killed_huoya', clue: 'crow_nest' },
  },
  // 第三幕的收束，也是全章最狠的一下：不是矿工挖到了古洞，是古洞在往外挖。
  // 这一下必须放在"只差三尺"之后 —— 先让玩家替矿工憋三年，再告诉他这三年
  // 从头到尾都不是他在挖。三处剑痕的暗线也在这里收口：剑痕是"有人走过"，
  // 凿痕是"有人挖了很久"，前者是一个人的痕迹，后者是一代人的。
  s_a3_break: {
    id: 's_a3_break', act: 'act3', title: '从对面凿过来',
    trigger: { type: 'enter', at: 'breakthrough' },
    need: ['killed_huoya', 'killed_shimu'],
    lines: [
      { who: 'narrator', text: '最后三尺是空的。' },
      { who: 'narrator', text: '不是被凿开的 —— 是本来就已经透了，只差一层石皮。' },
      { who: 'narrator', text: '石壁上有凿痕。密密麻麻，一层压一层。' },
      { who: 'narrator', text: '凿痕的走向不对。' },
      { who: 'narrator', text: '从这边看，凿子是往外凿的。' },
      { who: 'narrator', text: '可凿痕的斜坡在另一面 —— 对面有人在往这边凿。' },
      { who: 'narrator', text: '他们挖了三年。' },
      { who: 'narrator', text: '对面挖得更久。凿痕的层数，比三年多得多。' },
      { who: 'narrator', text: '风从那边过来。是暖的。' },
      { who: null, text: '（不是他们挖到了古洞。是古洞在往外挖。）' },
    ],
    onEnd: { flag: 'saw_break', clue: 'breakthrough' },
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
      // 原来这里写的是"碑后站着一个人，他没有脸" —— 那样等于把终章的底牌
      // 提前亮在门口，可无面剑客物理上只在第三层出现。改成脚印：
      // 玩家看见的是"有人刚刚站在这儿"，比直接看见人更难受，也不和后面的对不上。
      { who: 'narrator', text: '碑后的地上有一双脚印，朝着洞口。' },
      { who: 'narrator', text: '印子是新的。脚比你的大一点。' },
      { who: null, text: '（碑后有路。往下。）' },
    ],
    onEnd: { flag: 'seal_open' },
  },
  // ---------------- 终章（5）----------------
  // 终章的写法：一路往下，一路只做一件事 —— 数。
  // 一层数到三十七，三层地上刻着"第四十次"，无面剑客的牌上写着"第四十"。
  // 三个数字不是随手写的：玩家在矿道里已经见过矿工壁根上的三百多道日子，
  // 那时候他在看别人数；到了这里，数字变成在数他自己。
  s_fin_descend: {
    id: 's_fin_descend', act: 'final', title: '数到三十七',
    trigger: { type: 'floor', n: 1 },
    need: ['seal_open'],
    lines: [
      { who: 'narrator', text: '第一层。火把只照到一丈，一丈之外是黑的。' },
      { who: 'narrator', text: '壁上有刻痕。不是凿的，是指甲划的。' },
      { who: 'narrator', text: '一道，两道……数到三十七，停了。' },
      { who: 'narrator', text: '停的地方有一小片深色。是干掉的血。' },
      { who: 'narrator', text: '一间屋里摆着三只碗。碗沿磨得很薄，洗得干净。' },
      { who: 'narrator', text: '有人在这里住过。住的时间不短。' },
      { who: null, text: '（他也在数日子。）' },
    ],
    onEnd: { flag: 'saw_stair' },
  },
  s_fin_deep: {
    id: 's_fin_deep', act: 'final', title: '第四十次',
    trigger: { type: 'floor', n: 3 },
    need: ['saw_stair'],
    lines: [
      { who: 'narrator', text: '第三层。这里的黑和上面不一样 —— 上面的黑是空的，这里的黑是满的。' },
      { who: 'narrator', text: '最深那间屋的地上，有一把刀。' },
      { who: 'narrator', text: '刀鞘三道刻纹。和你手里这把一模一样。' },
      { who: 'narrator', text: '刀是断的。断口很新。' },
      { who: 'narrator', text: '刀旁边的地上刻着一行字。' },
      { who: 'narrator', text: '「第四十次」' },
      { who: 'narrator', text: '刻痕边上还有更小的字，被磨掉了，磨到只剩一个起笔。' },
      { who: null, text: '（有人在数。数的是你。）' },
    ],
    onEnd: { flag: 'saw_deep', clue: 'forty' },
  },
  // 无面剑客：招式一模一样，是因为他本来就是主角。
  // 这里不能写成"他摘下面具，原来是某某" —— 那样是廉价的反转。
  // 写成"他没有脸"，然后让玩家自己去摸自己的脸，那一下才是玩家自己完成的。
  s_fin_wumian: {
    id: 's_fin_wumian', act: 'final', title: '没有脸的那个',
    trigger: { type: 'kill', types: ['wumian'], label: '无面剑客' },
    need: ['saw_deep'],
    lines: [
      { who: 'narrator', text: '他不说话。' },
      { who: 'narrator', text: '起手的角度一样。收刀的位置一样。连招第三下会顿半拍 —— 也一样。' },
      { who: 'narrator', text: '你打他，像在打自己的影子。影子比你熟。' },
      { who: 'narrator', text: '他倒下的时候，脸是空的。' },
      { who: 'narrator', text: '不是没有五官。是那一块本来就是平的，像被人抹过。' },
      { who: 'narrator', text: '你伸手摸自己的脸。还在。' },
      { who: 'narrator', text: '他腰间挂着一块木牌。和你那块一样，三道纹。' },
      { who: 'narrator', text: '牌背刻着字：「守碑人 · 第四十」。' },
      { who: 'narrator', text: '你想起一场火。火是从碑后烧起来的。' },
      { who: 'narrator', text: '点火的人背对着你站着，刀鞘上有三道纹。' },
      { who: 'narrator', text: '他转过身来 ——' },
      { who: null, text: '（那是你。）' },
    ],
    onEnd: { flag: 'killed_wumian', clue: 'wumian_face' },
  },
  // 终章的选择。这是 P7 以来第一次 onEnd 装不下的东西 —— 见文件头对 choice 的说明。
  // 两个分支都不设对错，也都不扣东西：给 flag、给结局旁白，只改"后来怎样了"。
  // 「记起来」给侠名 +12，但那不是奖励 —— 它是"村里人开始怕你"的代价，
  // 侠名越高，NPC 的三层对话越深，可柳三娘那一层的门是关着的。
  s_fin_choice: {
    id: 's_fin_choice', act: 'final', title: '刻回去，还是烧了',
    trigger: { type: 'kill', types: ['wumian'], label: '无面剑客' },
    need: ['killed_wumian'],
    lines: [
      { who: 'narrator', text: '你记起来了。' },
      { who: 'narrator', text: '你不记得的是：为什么。' },
      { who: 'narrator', text: '碑还在。三道槽空着。木牌在你手里，还有余温。' },
      { who: 'narrator', text: '你可以把名字刻回去。' },
      { who: 'narrator', text: '也可以把它烧了。' },
    ],
    onEnd: {
      choice: {
        prompt: '这件事没有对错。',
        options: [
          {
            id: 'remember', label: '记起来', hint: '把名字刻回碑上',
            flag: 'chose_remember', fame: 12, msg: '你把名字刻回了碑上',
            lines: [
              { who: 'narrator', text: '你把名字刻回碑上。刻到最后一笔，手很稳。' },
              { who: 'narrator', text: '下山的时候，天刚亮。' },
              { who: 'narrator', text: '村口没有人。' },
              { who: 'narrator', text: '柳三娘站在门口，看了你很久。' },
              { who: 'narrator', text: '她把门关上了。门上换了新的门神。' },
              { who: 'narrator', text: '那天晚上，你睡在庙里。' },
              { who: 'narrator', text: '香灰是凉的。' },
              { who: null, text: '（第一章 · 终）' },
            ],
          },
          {
            id: 'letgo', label: '放下', hint: '把木牌烧了',
            flag: 'chose_letgo', msg: '你把木牌扔进了火里',
            lines: [
              { who: 'narrator', text: '你把木牌扔进火里。' },
              { who: 'narrator', text: '木头烧起来有响声，像有人在里面说话。' },
              { who: 'narrator', text: '说到一半，断了。' },
              { who: 'narrator', text: '柳三娘给你留了门。灶上温着一碗面。' },
              { who: 'narrator', text: '你没说你记起了什么。' },
              { who: 'narrator', text: '她也没问。' },
              { who: 'narrator', text: '第二天，你照常去后山砍柴。' },
              { who: null, text: '（第一章 · 终）' },
            ],
          },
        ],
      },
    },
  },
  // ================= 第二章 P12-B：表尾追加 21 个节点 =================
  // 为什么一律追加在表尾：storyScan() 按 STORY_IDS 顺序扫，遇到第一个满足的就播。
  // 放在表尾 + need 至少含 killed_wumian，第一章 28 个节点的判定、台词、选择、
  // 存档逐字节不变 —— killed_wumian 是终章「无面剑客」落下的 flag，两条结局都必经。
  // 于是老存档打完第一章南下，第二章自然开放，SAVE_KEY 不用升版本。
  //
  // 两幕的入口分别挂在南疆关口与江岸关口，先后随意；三幕再收口。
  // 暗线：第一章「守碑人 · 第四十」→「守链人 · 第四十一」；
  // 陈九那句「铁链是往上拴的」，在链尽头给出拴链的人。
  // ---------------- 第二章一幕 · 南疆瘴林（7）----------------
  s_c2a_gate: {
    id: 's_c2a_gate', act: 'ch2a', title: '南边的口子',
    trigger: { type: 'enter', at: 'southGate' },
    need: ['killed_wumian'],
    lines: [
      { who: 'narrator', text: '你往南走。走了一天，路开始变窄。' },
      { who: 'narrator', text: '两边的树不往高长，往横里长，枝子交在一起，把天封住。' },
      { who: 'narrator', text: '风从林子里出来，是热的，带着一股甜。' },
      { who: 'narrator', text: '旧底边塌了一段，砖茬上长着一层白毛。有人把塌的地方清过，清得很干净。' },
      { who: 'narrator', text: '清出来的口子只有五格宽。刚好一个人过。' },
      { who: null, text: '（南疆瘴林。袖子里那块木牌还是凉的。）' },
    ],
    onEnd: { flag: 'c2a_gate', clue: 'c2a_gate' },
  },
  s_c2a_gu: {
    id: 's_c2a_gu', act: 'ch2a', title: '她不抬头',
    trigger: { type: 'enter', at: 'guHut' },
    need: ['killed_wumian', 'c2a_gate'],
    lines: [
      { who: 'narrator', text: '林子边上一间棚子，四面挂着草把。' },
      { who: 'w_gu', text: '往北走。' },
      { who: 'narrator', text: '她坐在矮凳上捣药，没抬头。' },
      { who: 'w_gu', text: '这土是红的，不是染的。' },
      { who: 'narrator', text: '石臼里的东西是黑的，捣一下，白毛似的东西从缝里翻出来。' },
      { who: 'w_gu', text: '你听见虫子叫了吗？' },
      { who: 'narrator', text: '你听了一会儿。不是虫。是有人在数数，数得很慢。' },
      { who: null, text: '（她始终没抬头。）' },
    ],
    onEnd: { flag: 'c2a_gu', clue: 'c2a_gu' },
  },
  s_c2a_banner: {
    id: 's_c2a_banner', act: 'ch2a', title: '幡上的名字',
    trigger: { type: 'enter', at: 'guBanner' },
    need: ['killed_wumian', 'c2a_gu'],
    lines: [
      { who: 'narrator', text: '寨子外挑着一面幡，布已经烂了，字还在。' },
      { who: 'narrator', text: '幡上一个名字，被人用炭划掉，又在底下重抄了一遍。' },
      { who: 'narrator', text: '抄了七回。七回都是同一个姓：守。' },
      { who: 'narrator', text: '名字后面跟着数目，从三十三排到三十九。' },
      { who: 'narrator', text: '第四十那一行空着，只剩一个墨点，笔尖顿在那里没往下写。' },
      { who: 'narrator', text: '幡脚钉着一枚木牌，三道纹，和你袖子里那块一样。' },
      { who: null, text: '（钉子是从背面钉进去的。）' },
    ],
    onEnd: { flag: 'c2a_banner', clue: 'c2a_banner' },
  },
  s_c2a_red: {
    id: 's_c2a_red', act: 'ch2a', title: '赤土不是染的',
    trigger: { type: 'enter', at: 'redSoil' },
    need: ['killed_wumian', 'c2a_banner'],
    lines: [
      { who: 'narrator', text: '墟子里的土是红的，红到发黑。' },
      { who: 'narrator', text: '你蹲下去捻了一点。指腹上留下一层细沙，沙里有更小的白粒。' },
      { who: 'narrator', text: '不是矿，不是朱砂。' },
      { who: 'narrator', text: '往下挖一尺，土还是红的。挖到两尺，铲子碰到一个硬东西。' },
      { who: 'narrator', text: '是一截指骨，摆得很正，旁边还有一截，再旁边还有。' },
      { who: 'narrator', text: '一层一层码下去，像谁在底下砌墙。' },
      { who: null, text: '（蛊婆说得对。这土不是染的。）' },
    ],
    onEnd: { flag: 'c2a_red', clue: 'c2a_red' },
  },
  s_c2a_gumu: {
    id: 's_c2a_gumu', act: 'ch2a', title: '数到一半',
    trigger: { type: 'kill', lord: 'gumu', label: '蛊母' },
    need: ['killed_wumian', 'c2a_red'],
    lines: [
      { who: 'narrator', text: '蛊母从土里翻出来的时候，身上还带着一层白毛。' },
      { who: 'narrator', text: '它不动的时候像一堆土。动起来，土底下全是手。' },
      { who: 'narrator', text: '你把它劈开，里面没有脏腑，只有一窝小石头，每块石头上刻着一道。' },
      { who: 'narrator', text: '数了数，四十道。' },
      { who: 'narrator', text: '最后一道刻到一半，石头从中间裂了。' },
      { who: 'narrator', text: '土合上的时候，数数声停了一下，又从一重新开始。' },
      { who: null, text: '（有人在底下接着数。）' },
    ],
    onEnd: { flag: 'c2a_gumu', clue: 'c2a_gumu' },
  },
  s_c2a_midnight: {
    id: 's_c2a_midnight', act: 'ch2a', title: '子时的数数声',
    trigger: { type: 'time', phase: 'zi' },
    need: ['killed_wumian', 'c2a_banner'],
    lines: [
      { who: 'narrator', text: '子时。瘴气贴着地皮走，白得像一层水。' },
      { who: 'narrator', text: '数数声又起来了。' },
      { who: 'narrator', text: '一，二，三……数得不快，每一声之间隔着一次呼吸。' },
      { who: 'narrator', text: '你顺着声音走，走到赤土墟边上，声音又从身后过来。' },
      { who: 'narrator', text: '数到四十，停了。' },
      { who: 'narrator', text: '隔了很久，有一个很轻的声音说：四十一。' },
      { who: 'narrator', text: '然后就没有了。' },
      { who: null, text: '（那个声音不是从土里来的。是从更南边。）' },
    ],
    onEnd: { flag: 'c2a_midnight', clue: 'c2a_count' },
  },
  s_c2a_fourth: {
    id: 's_c2a_fourth', act: 'ch2a', title: '第四道纹',
    trigger: { type: 'enter', at: 'guBanner' },
    need: ['killed_wumian', 'c2a_gumu', 'c2a_midnight'],
    lines: [
      { who: 'narrator', text: '你回到幡底下。' },
      { who: 'narrator', text: '袖子里的木牌发烫。' },
      { who: 'narrator', text: '三道纹旁边多了一道。新的，刻痕里还是木头的白茬。' },
      { who: 'narrator', text: '前三道都指北。第四道指南，偏东。' },
      { who: 'narrator', text: '你用手摸那道新纹，摸到一点水。' },
      { who: 'narrator', text: '天没下雨。' },
      { who: null, text: '（往南，再往东。那边有水。）' },
    ],
    onEnd: { flag: 'c2a_fourth' },
  },

  // ---------------- 第二章二幕 · 江岸渡口（7）----------------
  s_c2b_gate: {
    id: 's_c2b_gate', act: 'ch2b', title: '东边的口子',
    trigger: { type: 'enter', at: 'riverGate' },
    need: ['killed_wumian'],
    lines: [
      { who: 'narrator', text: '东边也塌了一段。这一段比南边宽，砖被码在两侧，码得齐齐整整。' },
      { who: 'narrator', text: '有人修过。不是修墙，是修路。' },
      { who: 'narrator', text: '过了口子，风里的甜味没了，换成一股铁腥。' },
      { who: 'narrator', text: '再走半里，听见水。' },
      { who: 'narrator', text: '水声很闷，像隔着一层什么东西。' },
      { who: null, text: '（江岸渡口。）' },
    ],
    onEnd: { flag: 'c2b_gate', clue: 'c2b_gate' },
  },
  s_c2b_ferry: {
    id: 's_c2b_ferry', act: 'ch2b', title: '桥是去年才架的',
    trigger: { type: 'enter', at: 'ferry' },
    need: ['killed_wumian', 'c2b_gate'],
    lines: [
      { who: 'narrator', text: '渡口的棚子是新盖的，柱子上还没有裂。' },
      { who: 'w_ferry', text: '过江？往东走，别下水。' },
      { who: 'narrator', text: '他手里的桨搁在膝上，桨叶是干的。' },
      { who: 'w_ferry', text: '桥是去年才架的。架之前，这一段的船一年翻三回。' },
      { who: 'w_ferry', text: '架之后不翻了。可水底下的东西还在。' },
      { who: 'narrator', text: '你往水面看了一眼。水不深，能看见底下横着一道黑线，从这岸一直拉到那岸。' },
      { who: 'w_ferry', text: '别往下看。' },
    ],
    onEnd: { flag: 'c2b_ferry', clue: 'c2b_ferry' },
  },
  s_c2b_bridge: {
    id: 's_c2b_bridge', act: 'ch2b', title: '桥不是给活人走的',
    trigger: { type: 'enter', at: 'riverBridge' },
    need: ['killed_wumian', 'c2b_ferry'],
    lines: [
      { who: 'narrator', text: '桥面是新的，木板还没被踩出槽。' },
      { who: 'narrator', text: '走到中间，桥往下沉了一寸。' },
      { who: 'narrator', text: '不是板子软，是下面有东西拽了一下。' },
      { who: 'narrator', text: '桥墩上缠着铁链，一圈一圈，缠得极紧。链子从桥底下去，往东。' },
      { who: 'narrator', text: '链环有巴掌大，每一环内侧都磨出一道亮痕。' },
      { who: 'narrator', text: '亮痕在同一侧。链子长期被往一个方向拉。' },
      { who: null, text: '（陈九说过，铁链是往上拴的。）' },
    ],
    onEnd: { flag: 'c2b_bridge', clue: 'c2b_bridge' },
  },
  s_c2b_dock: {
    id: 's_c2b_dock', act: 'ch2b', title: '坞里的账',
    trigger: { type: 'enter', at: 'jiangDock' },
    need: ['killed_wumian', 'c2b_bridge'],
    lines: [
      { who: 'narrator', text: '江匪坞里没有人。' },
      { who: 'narrator', text: '桌上摊着一本账，记的不是货，是日子。' },
      { who: 'narrator', text: '「初一，捞上一块牌。初二，两块。初三，没有。」' },
      { who: 'narrator', text: '往后每一页都写着「没有」，写了二十几页，笔迹一天比一天轻。' },
      { who: 'narrator', text: '最后一页只写了一句：「链子今天又往上走了一寸。」' },
      { who: 'narrator', text: '账本底下压着一枚铜钱，穿了孔，孔里穿着一截铁丝。' },
      { who: null, text: '（渡口的规矩：过江钱不收铜钱，收牌子。）' },
    ],
    onEnd: { flag: 'c2b_dock', clue: 'c2b_dock' },
  },
  s_c2b_jianggui: {
    id: 's_c2b_jianggui', act: 'ch2b', title: '挂在链上的',
    trigger: { type: 'kill', lord: 'jianggui', label: '江鬼' },
    need: ['killed_wumian', 'c2b_dock'],
    lines: [
      { who: 'narrator', text: '江鬼从水里立起来的时候，身上淌下来的不是水。' },
      { who: 'narrator', text: '是一串木牌，用铁丝穿着，从脖子上一直挂到膝盖。' },
      { who: 'narrator', text: '它每动一下，牌子就互相敲，敲出那个数数的节拍。' },
      { who: 'narrator', text: '你把牌子拨开。最上面一块写着「守碑人 · 第三十九」。' },
      { who: 'narrator', text: '下面一块是第四十，再下面一块是空的。' },
      { who: 'narrator', text: '它倒下去的时候没有沉。链子把它拽住了，往东拖。' },
      { who: null, text: '（水底下有东西在收链。）' },
    ],
    onEnd: { flag: 'c2b_jianggui', clue: 'c2b_jianggui' },
  },
  s_c2b_midnight: {
    id: 's_c2b_midnight', act: 'ch2b', title: '水底的敲击',
    trigger: { type: 'time', phase: 'zi' },
    need: ['killed_wumian', 'c2b_dock'],
    lines: [
      { who: 'narrator', text: '子时。江水不响，桥也不响。' },
      { who: 'narrator', text: '底下敲了一下。' },
      { who: 'narrator', text: '隔一会儿，又敲一下。间隔和瘴林里那个数数声一样。' },
      { who: 'narrator', text: '你趴在桥板上往下看，黑线上有一处亮了，接着往东移了一格。' },
      { who: 'narrator', text: '再亮，再移一格。' },
      { who: 'narrator', text: '链子在走。不是被水冲的，是被拽的。' },
      { who: null, text: '（一下，一格。有人在收。）' },
    ],
    onEnd: { flag: 'c2b_midnight', clue: 'c2b_knock' },
  },
  s_c2b_chain: {
    id: 's_c2b_chain', act: 'ch2b', title: '链不是往下坠的',
    trigger: { type: 'enter', at: 'jiangguiDen' },
    need: ['killed_wumian', 'c2b_jianggui', 'c2b_midnight'],
    lines: [
      { who: 'narrator', text: '水退了一截，链子露出来。' },
      { who: 'narrator', text: '你顺着链子往东走。它不往下沉，一直贴着地面往高处去。' },
      { who: 'narrator', text: '每隔十步有一根石桩，链子从桩上的铁环里穿过去。' },
      { who: 'narrator', text: '桩子是后加的，比链子新得多。有人怕它沉，一路给它垫了桩。' },
      { who: 'narrator', text: '最远的那根桩上刻着一行字：「别让它回头」。' },
      { who: 'narrator', text: '链子尽头看不见。东边的地势还在往上。' },
      { who: null, text: '（陈九撑了二十年船，从没见它到底。因为它根本没有底。）' },
    ],
    onEnd: { flag: 'c2b_chain' },
  },

  // ---------------- 第二章三幕 · 链尽头（7）----------------
  s_c2c_count: {
    id: 's_c2c_count', act: 'ch2c', title: '第几个了',
    trigger: { type: 'enter', at: 'chainPost' },
    need: ['killed_wumian', 'c2a_fourth', 'c2b_chain'],
    lines: [
      { who: 'narrator', text: '石桩到了尽头。' },
      { who: 'narrator', text: '最后一根桩比别的高，桩顶磨出一个圆窝，链子在窝里卡住，不再往前。' },
      { who: 'narrator', text: '窝边刻着一道道的短横，刻满了整圈。' },
      { who: 'narrator', text: '你数了一遍。四十一道。' },
      { who: 'narrator', text: '最后一道比别的新，刻痕里还是石粉。' },
      { who: 'narrator', text: '石粉没被风吹走。刻的人刚走不久。' },
      { who: null, text: '（第四十一个。碑上那个是第四十个。）' },
    ],
    onEnd: { flag: 'c2c_count', clue: 'c2c_count' },
  },
  s_c2c_plates: {
    id: 's_c2c_plates', act: 'ch2c', title: '四十一块牌',
    trigger: { type: 'enter', at: 'chainEnd' },
    need: ['killed_wumian', 'c2c_count'],
    lines: [
      { who: 'narrator', text: '链子末端的环上挂着木牌，一串，用铁丝穿着。' },
      { who: 'narrator', text: '一块一块翻过去。守碑人 · 第一，守碑人 · 第二……' },
      { who: 'narrator', text: '名字都被凿掉了，只剩数目。' },
      { who: 'narrator', text: '翻到第四十块，背面刻着「此名自刻」。' },
      { who: 'narrator', text: '第四十一块是空的，一个字也没有，连三道纹都还没刻。' },
      { who: 'narrator', text: '你摸了摸袖子。你那块还在。' },
      { who: null, text: '（原来那块空牌不是给你的。是还没轮到。）' },
    ],
    onEnd: { flag: 'c2c_plates', clue: 'c2c_plates' },
  },
  s_c2c_gu: {
    id: 's_c2c_gu', act: 'ch2c', title: '蛊婆没走',
    trigger: { type: 'enter', at: 'guHut' },
    need: ['killed_wumian', 'c2c_plates'],
    lines: [
      { who: 'narrator', text: '你回了一趟瘴林。棚子还在，草把换了新的。' },
      { who: 'w_gu', text: '你数到四十一了。' },
      { who: 'narrator', text: '她这次抬头了。' },
      { who: 'w_gu', text: '我娘数到三十九。我数到四十。' },
      { who: 'w_gu', text: '数的人不换，链子就一直往上走。' },
      { who: 'narrator', text: '她把石臼推到一边，底下压着一块木牌，三道纹，磨得发亮。' },
      { who: 'w_gu', text: '我没敢挂。挂上去，就该我往东走了。' },
      { who: null, text: '（她把木牌又压回去了。）' },
    ],
    onEnd: { flag: 'c2c_gu', clue: 'c2c_gu' },
  },
  s_c2c_ferry: {
    id: 's_c2c_ferry', act: 'ch2c', title: '周摆渡收桨',
    trigger: { type: 'time', phase: 'mao' },
    need: ['killed_wumian', 'c2c_plates'],
    lines: [
      { who: 'narrator', text: '卯时。天还没全亮，渡口有人收桨。' },
      { who: 'w_ferry', text: '你要往东。' },
      { who: 'narrator', text: '他把桨扛进棚子，横搁在梁上，桨叶朝里。' },
      { who: 'w_ferry', text: '我爹撑到第四十一年，把船留给我，自己往东去了。' },
      { who: 'w_ferry', text: '他说链子得有人收。收慢一点，下面的人就能多歇一晚。' },
      { who: 'narrator', text: '他从怀里摸出一枚木牌，放在桨边上，没给你。' },
      { who: 'w_ferry', text: '这块我先替他收着。' },
      { who: null, text: '（他把棚门带上了，没锁。）' },
    ],
    onEnd: { flag: 'c2c_ferry', clue: 'c2c_ferry' },
  },
  s_c2c_shoulian: {
    id: 's_c2c_shoulian', act: 'ch2c', title: '拴链的人',
    trigger: { type: 'kill', lord: 'shoulian', label: '守链人' },
    need: ['killed_wumian', 'c2c_count'],
    lines: [
      { who: 'narrator', text: '链尽头站着一个人。' },
      { who: 'narrator', text: '他背对着你，两只手握着链子，往上提。' },
      { who: 'narrator', text: '提一寸，歇一会儿，再提一寸。' },
      { who: 'narrator', text: '你走过去，他没回头。你叫了一声，他还是没回头。' },
      { who: 'narrator', text: '他腰上挂着木牌，牌背刻着「守链人 · 第四十一」。' },
      { who: 'narrator', text: '你出手的时候，他没有招架。他先把链子挂回桩上，才转过身。' },
      { who: 'narrator', text: '他倒下之后，链子没有松。' },
      { who: null, text: '（他不是拦路的。他是接班的。）' },
    ],
    onEnd: { flag: 'c2c_shoulian', clue: 'c2c_shoulian' },
  },
  // 第二章的选择。复用终章那套机制：storyChoose() 的页签改成取 storyCur.page，
  // 第一章仍是「终章 · 古洞」，第二章自然落「第二章三幕 · 链尽头」。
  // options 里的 endMsg 是给结局旁白收尾用的，第一章没写，回落到「第一章 · 终」。
  s_c2c_choice: {
    id: 's_c2c_choice', act: 'ch2c', title: '挂回去，还是砍断',
    trigger: { type: 'kill', lord: 'shoulian', label: '守链人' },
    need: ['killed_wumian', 'c2c_shoulian'],
    lines: [
      { who: 'narrator', text: '桩顶的空环还在晃。' },
      { who: 'narrator', text: '第四十一块牌是空的。你袖子里那块也是空的。' },
      { who: 'narrator', text: '链子还绷着，绷得很紧，一直往东，看不见那一头。' },
      { who: 'narrator', text: '你可以把牌子挂上去，接住这一寸。' },
      { who: 'narrator', text: '也可以把链子砍了。' },
      { who: 'narrator', text: '砍了，下面的人就不用再数了。' },
    ],
    onEnd: {
      choice: {
        prompt: '这件事也没有对错。',
        options: [
          {
            id: 'hang', label: '挂回去', hint: '把木牌扣进空环',
            flag: 'chose_hang', fame: 12, msg: '你把木牌挂回了链上', endMsg: '第二章 · 终',
            lines: [
              { who: 'narrator', text: '你把木牌扣进空环。' },
              { who: 'narrator', text: '扣上的一瞬间，链子沉了半寸，又绷回去。' },
              { who: 'narrator', text: '你握住链子，往上提。' },
              { who: 'narrator', text: '提一寸，歇一会儿，再提一寸。' },
              { who: 'narrator', text: '东边还是看不见那一头。' },
              { who: 'narrator', text: '瘴林那边，数数声停了。' },
              { who: 'narrator', text: '过了很久，有人从一重新开始数。' },
              { who: null, text: '（第二章 · 终）' },
            ],
          },
          {
            id: 'cut', label: '砍断', hint: '一刀削在最后的链环上',
            flag: 'chose_cut', msg: '你把链子砍断了', endMsg: '第二章 · 终',
            lines: [
              { who: 'narrator', text: '你一刀削在最后的链环上。' },
              { who: 'narrator', text: '断口是斜的，和竹桥那道一样。' },
              { who: 'narrator', text: '链子往两头缩。东边那一截收得很快，像有人在那头拽。' },
              { who: 'narrator', text: '水底的敲击声一下没了。' },
              { who: 'narrator', text: '四十一块木牌落在地上，没有响。' },
              { who: 'narrator', text: '你把袖子里那块也放上去，和它们摆成一排。' },
              { who: 'narrator', text: '天亮了。江面上没有链子的影子。' },
              { who: null, text: '（第二章 · 终）' },
            ],
          },
        ],
      },
    },
  },
  // 最后一节不依赖位置：和上面两节一样挂在「守链人已倒」上，
  // 排在 choice 之后，玩家选完、结局旁白播完才轮到它。
  s_c2c_coda: {
    id: 's_c2c_coda', act: 'ch2c', title: '数到哪儿',
    trigger: { type: 'kill', lord: 'shoulian', label: '守链人' },
    need: ['killed_wumian', 'c2c_shoulian'],
    lines: [
      { who: 'narrator', text: '后来村里没人提过链子。' },
      { who: 'narrator', text: '渡口的桥还在，桥墩上那圈铁链被人拆走了，木头上的印子还在。' },
      { who: 'narrator', text: '南边的口子慢慢长满了枝子。' },
      { who: 'narrator', text: '你偶尔会听见有人数数，数到某个数就停。' },
      { who: 'narrator', text: '停在哪里，看那天风往哪边吹。' },
      { who: null, text: '（数到哪儿，就到哪儿。）' },
    ],
    onEnd: { flag: 'c2c_end', clue: 'c2c_coda' },
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
//
// 顺序 = 旧事页里的横排顺序，按幕排，不按 id 字母排：
// 玩家回想事情的时候是按"我先看见什么、后看见什么"想，不是按字典序想。
export const CLUES = {
  dig:   { name: '坟底三尺', text: '山贼不偷陪葬，只挖坟底三尺的土。土是湿的，闻着是干的。' },
  pit:   { name: '空棺', text: '合葬墓被挖开，棺里没有尸骨，只有一层抹平的白灰。灰上的人形印子比活人长。' },
  mark1: { name: '木牌 · 第一道纹', text: '无字木牌，牌背三道纹。第一道朝西南。' },
  treant_hoard: { name: '树心', text: '树妖的树心是空的，塞满同制式的刀。刀鞘上三道刻纹。纸上的名字只剩一个「守」。' },
  cutter: { name: '七个土包', text: '竹海空地七个土包，七根竹节，风过七个音。新坟里的纸上名字写了一半。' },
  bridge: { name: '削断的桥', text: '竹桥断口是斜的，一刀削到底，断茬还青。走过的人把桥削了，不想让人跟。' },
  blueprint: { name: '封碑图', text: '竹海工坊里的图纸：碑座、碑身、碑顶，碑后三道槽。落款被磨掉了。' },
  puppet_stone: { name: '傀儡里的碑', text: '机关傀儡胸腔里立着一块巴掌大的碑，凿痕从里往外。工坊是后来盖在它外面的。' },
  mark2: { name: '木牌 · 第二道纹', text: '第二道朝西北。亮过的那道摸上去是温的。' },
  gap:   { name: '只差三尺', text: '矿道最深处与另一侧只隔一道岩壁。缝里有暖风，也有火把的光。' },
  mark3: { name: '木牌 · 第三道纹', text: '三道并排，皆指正北。三道同时发烫，木牌在手里震了一下。' },
  // P9 · 第三幕与终章
  miners: { name: '矿工营地', text: '半塌的营地里还有六七个活人。他们不问来路，先问外面天亮没有。壁根刻着三百多道日子。' },
  shimu_womb: { name: '石母的胎', text: '石母从头到尾没站起来过。它不是挡路，是在生。挖开第二天又长回去。' },
  crow_nest: { name: '骨巢', text: '火鸦王的巢用骨头搭成，一根一根码得极整齐。蛋壳里不是雏，是手指骨。' },
  breakthrough: { name: '从对面凿过来', text: '打通的那面石壁，凿痕的斜坡朝着这边 —— 对面有人在往这边凿，比三年久得多。' },
  forty: { name: '第四十次', text: '古洞第三层地上有一把断刀，刀鞘三道刻纹。旁边刻着「第四十次」。' },
  wumian_face: { name: '无面的牌', text: '无面剑客腰间那块木牌和主角的一样，三道纹。牌背刻着「守碑人 · 第四十」。' },
  // —— 第二章 P12-B：18 条，每条都由一个第二章节点发放 ——
  c2a_gate:   { name: '南下的口子', text: '旧底边只塌了五格宽，砖茬上的白毛被人清过一遍 —— 有人一直在这儿进出。' },
  c2a_gu:     { name: '她不抬头', text: '蛊婆捣的药里翻出白毛。她说听见虫叫，可那声音有间隔，是在数数。' },
  c2a_banner: { name: '幡上的数目', text: '同一个姓被炭划掉又抄了七回，数目从三十三排到三十九，第四十那行空着。' },
  c2a_red:    { name: '赤土', text: '红土挖到两尺就是码得整齐的指骨，一层压一层，像有人在底下砌墙。' },
  c2a_gumu:   { name: '四十道', text: '蛊母腹中是一窝刻着横道的小石头，数到四十，最后一道刻到一半石头就裂了。' },
  c2a_count:  { name: '子时数数', text: '子时的数数声数到四十会停，隔很久才有一个更轻的声音说「四十一」，从更南边来。' },
  c2b_gate:   { name: '修路的人', text: '东边塌口的砖被码在两侧，齐齐整整 —— 不是修墙，是有人把这里当路在养。' },
  c2b_ferry:  { name: '桥是去年架的', text: '架桥之前这段江一年翻三回船，架完之后不翻了，可水底的东西一样还在。' },
  c2b_bridge: { name: '磨亮的一侧', text: '桥墩铁链每一环内侧都有磨痕，且都在同一侧 —— 链子长期被往一个方向拉。' },
  c2b_dock:   { name: '坞里的账', text: '江匪坞的账不记货，只记捞上来的木牌。最后一页写着「链子今天又往上走了一寸」。' },
  c2b_jianggui: { name: '挂在链上的', text: '江鬼身上挂满木牌，最上面是第三十九，下面第四十，再下面那块是空的。' },
  c2b_knock:  { name: '一下一格', text: '子时水底每敲一下，链上就有一处亮起并往东移一格。链子在被人收。' },
  c2c_count:  { name: '四十一道', text: '链尽头最后一根石桩的圆窝边刻满短横，四十一道，最后一道的石粉还没被吹走。' },
  c2c_plates: { name: '空着的第四十一', text: '链上四十一块木牌名字全被凿掉，只留数目；第四十一块连三道纹都还没刻。' },
  c2c_gu:     { name: '没敢挂', text: '蛊婆的娘数到三十九，她数到四十。她说数的人不换，链子就一直往上走。' },
  c2c_ferry:  { name: '收桨', text: '周摆渡的爹撑到第四十一年就往东去了，说链子得有人收，收慢些下面的人能多歇一晚。' },
  c2c_shoulian: { name: '守链人 · 第四十一', text: '链尽头那人不是在拦路，是在接班。他倒下前先把链子挂回桩上，链子始终没松。' },
  c2c_coda:   { name: '数到哪儿', text: '后来村里没人再提链子，桥墩上的印子还在；偶尔有人数数，停在哪里看那天风往哪边吹。' },
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
  e_grave_pit: {
    // 放在合葬墓 POI（r=90）的南沿 60px：剧情是走进去自动播，碑要主动按 E。
    // 两者叠在同一块地上没关系 —— 播的时候按 E 是翻页，播完了按 E 才是读碑。
    at: { x: 1760, y: 460, r: 34 }, name: '棺盖内侧',
    text: '棺盖内侧刻着一行小字，是刻的，不是写的：「此处不葬人，只葬名」。'
      + '下面还有一行更小的：「名葬尽了，就该轮到人了」。'
      + '刻字的手很稳，最后一笔却拖出去很长 —— 像是刻到一半被人打断了。'
      + '木茬是新的。有人刻完这些字，没多久又劈了一刀。',
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
  e_bamboo_bridge: {
    // 桥东岸。桥面本身是 tile 9（可走），碑要立在岸上，不能立在桥上 ——
    // 站在桥上读碑的时候，怪会从水里那一侧绕过来。
    at: { x: 720, y: 1224, r: 34 }, name: '桥头木牌',
    text: '桥头钉着一块木牌：「过桥者，回头看一眼」。'
      + '木牌背面钉着七枚竹片，每片刻着一个名字。'
      + '最上面一片是新的，名字刻到一半，刀口停了。'
      + '木牌的钉子是从背面钉进去的 —— 挂这块牌的人，不想让人看见自己的字。',
  },
  e_cutter_pole: {
    at: { x: 560, y: 1064, r: 34 }, name: '竹节里的账',
    text: '一根竹节被剖开，里面塞着一卷纸。'
      + '纸上是工钱账：「初一，三人。初二，两人。初三，一人」。'
      + '后面没有初四。'
      + '账的最下面写着一行：「他们都听见了。我让他们别应。」'
      + '墨迹到这里就断了，笔尖在纸上戳出一个洞。',
  },
  e_mine_names: {
    // 放在矿工营地（352,720）北侧 30px 的壁根上 —— 营地半径 95 覆盖得到，
    // 和合葬墓那处一样：走过去自动播剧情，想读碑得自己按 E。
    at: { x: 352, y: 690, r: 34 }, name: '壁根上的道子',
    text: '壁根上刻着一排竖道，一道一天。刻得很浅，是拿石片划的。'
      + '前三百道还算齐，之后开始歪，同一个位置反复划，划出一道沟。'
      + '沟的尽头换了个人接着划 —— 笔迹比前面细，划得更慢。'
      + '最下面有一行字：「数到这儿，就不数了。反正天也不亮。」'
      + '字底下压着六枚铜钱，摆成一排。像是给谁留的船钱。',
  },
  // —— 第二章 P12-B：10 处旧物，全部落在 CH1_H 以南 ——
  // 坐标逐个过 canStand()：中心格必须能站（碑要走近按 E 读，站不住就是死物）。
  // 两处渡口旧物特意离周摆渡 34px 对话圈远一些 —— 一个点击位只做一件事。
  e_c2_south_gate: {
    at: { x: 552, y: 1720, r: 34 }, name: '关口砖额',
    text: '塌口的砖额上原本有字，被凿掉了，只剩三个字的下半截。'
      + '能认出中间那个是「南」。砖缝里塞着几十枚木屑，都削成小牌子的形状，'
      + '每一枚正面光滑，背面朝墙 —— 塞的人不想让人看见背面写了什么。'
      + '最上面一枚是新的，木茬还白。',
  },
  e_c2_banner: {
    at: { x: 360, y: 1880, r: 34 }, name: '幡脚木牌',
    text: '幡脚那枚木牌拆下来看，三道纹，一道朝西南，一道朝西北，一道正北。'
      + '牌背用刀尖划了一行极小的字：「抄一遍，就少一个人往东」。'
      + '划痕里嵌着炭，和幡上划名字的是同一块炭。牌角有一个穿绳的孔，孔壁磨得很圆 ——'
      + '它被人挂过很久，不是钉上去就没动过。',
  },
  e_c2_red_soil: {
    at: { x: 760, y: 2120, r: 34 }, name: '赤土界石',
    text: '界石半埋在红土里，只露头。上刻「下三尺，勿再下」。'
      + '「再」字被后来的人改过，原先刻的是「勿下」，改的时候把旧笔画填了土再刻，'
      + '填的土和这里的红土不是一个颜色。石根压着一排白粒，摆得很匀，'
      + '数了数，四十粒。最后一粒只有半颗。',
  },
  e_c2_gumu: {
    at: { x: 232, y: 2040, r: 34 }, name: '巢口的石堆',
    text: '蛊母巢口垒着一圈小石头，每块一道横刻。'
      + '石头不是随便堆的：大的在下，小的在上，最上面那块刻到一半就裂了，'
      + '裂缝里长出白毛。圈的缺口朝东南，缺口处多摆了两块空石，一道也没刻。'
      + '像是给还没数到的两个先留了位置。',
  },
  e_c2_river_gate: {
    at: { x: 1912, y: 1720, r: 34 }, name: '东口界碑',
    text: '碑上只有一行：「往东者，自记其数」。'
      + '碑侧密密麻麻全是短横，一层压一层，后来的人刻在先人的刻痕上，'
      + '已经数不清。最底下一层是深的，最上面一层浅得几乎看不见。'
      + '碑脚搁着一把凿子，刃口卷了，木柄被手汗浸成深色。凿子还在等人用。',
  },
  e_c2_ferry: {
    at: { x: 1608, y: 1800, r: 34 }, name: '渡口价目牌',
    text: '木牌上写着「过江：铜钱三文，木牌一面」。'
      + '「铜钱三文」被人划掉了，划得很轻，还看得清；「木牌一面」四个字反倒描过好几遍，'
      + '墨堆起来，摸上去是凸的。牌子背面钉着一只小布袋，袋里没有钱，'
      + '只有一截铁丝，弯成环，环口没收。',
  },
  e_c2_bridge: {
    at: { x: 1608, y: 1960, r: 34 }, name: '桥墩铁环',
    text: '桥墩上那只铁环比链子旧得多，环座是砌进石头里的。'
      + '环内侧磨出一道深沟，沟偏向东。环座四周有八个凿眼，'
      + '眼里的木楔只剩三个 —— 有人想把环撬走，撬到一半停了。'
      + '停手的地方刻了两个字，刻得歪：「别撬」。',
  },
  e_c2_dock: {
    at: { x: 2024, y: 2152, r: 34 }, name: '坞里账本',
    text: '账本最后一页除了那句「链子今天又往上走了一寸」，背面还有一行铅笔似的淡字：'
      + '「我今天没敢数。没数，是不是就不算过了一天」。'
      + '再往后是十几页空白，每页右下角都有一个指印，同一只手，'
      + '一天一个，越到后面按得越轻。最后一页没有指印。',
  },
  e_c2_chain_post: {
    at: { x: 1896, y: 2184, r: 34 }, name: '拴链石桩',
    text: '桩身四面都刻着字，四面说的是同一件事，写法各不一样。'
      + '东面「别让它回头」，南面「别松手」，西面「还没到」，北面只剩半句「等我」。'
      + '四面的笔迹是四个人的。北面那半句刻得最浅，也最新，'
      + '最后一笔拖出去很长，像刻的人被什么拽了一下。',
  },
  e_c2_chain_end: {
    at: { x: 2120, y: 2216, r: 34 }, name: '链尽头的牌堆',
    text: '链环下面积了一层木屑，是历年刻牌落下来的，踩上去软。'
      + '木屑里混着几十个磨秃的刻刀头，都朝着东边倒。'
      + '最底下一层木屑已经发黑，捏起来是湿的；最上面一层还白。'
      + '有人在这儿刻了很久，久到换过好几把刀，也久到没换过站的地方。',
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
  // P8 补的三个是**野外**NPC（WANDERERS），不是村里的。
  // 他们原来只有 village.js 里的 greet / ask 一档，走到哪说到哪；
  // 有了三层之后，"吴老六" 这个人会随着你走的路慢慢变 ——
  // 初见时他只顾补网，深交之后他才肯说他兄弟还在林子里。
  w_hunter: {
    first: {
      lines: ['别过来，风里血腥味重，会惊着东西。', '这林子从前不这样。'],
      ask: '青鳞潭在林子最南头。那条蛇吃人，也吃它自己人。',
    },
    known: {
      lines: ['你身上没血腥味了。进来坐。', '我兄弟的刀，你见着了吗？'],
      ask: '听见喊你名字的，别应。应了，声音就会换成你自己的嗓子。',
    },
    close: {
      lines: ['……坐。', '网补好了。我不去了。'],
      ask: '我在林子里活了四十年。这三年，林子开始听人说话。',
    },
  },
  w_stone: {
    first: {
      lines: ['碑不能看，只能摸。', '你身上有土气，进过坟地了。'],
      ask: '封碑要三物：阴土、竹心、石髓。少一件，碑就是块石头。',
    },
    known: {
      lines: ['你又来了。', '碑没动。它一直没动。'],
      ask: '我不是守碑的。我是被碑留下的。这两件事不一样。',
    },
    close: {
      lines: ['……', '（他没有回头。）'],
      ask: '你摸过碑心了吧。凉的，对不对。凉的东西才守得住。',
    },
  },
  w_boat: {
    first: {
      lines: ['水浅了，船撑不动。', '过河么？铜钱就不必了。'],
      ask: '水底下有根铁链，我撑了二十年船，从没见它到底。',
    },
    known: {
      lines: ['今天不摆渡。', '竹海那头，哭声又起来了。'],
      ask: '铁链是往上拴的，不是往下坠的。有人把它拴在岸上。',
    },
    close: {
      lines: ['上船吧。', '不用钱。你下去过一次，我知道。'],
      ask: '我撑船送过一个人往北去。他刀鞘上有三道纹。他没回来，铁链也没松。',
    },
  },
  // P9：西荒石窟唯一的活口。三层不是"他态度变好"，是"他越来越不想让你下去"——
  // 初见时他还在问外面，深交之后他劝你别去。那才是他知道的东西的分量。
  w_miner: {
    first: {
      lines: ['你从上面下来的？', '……上面现在什么时辰。'],
      ask: '洞里别点火把。点了，它们就来。',
    },
    known: {
      lines: ['我们数到三百二十七就不数了。', '数下去也没什么用。'],
      ask: '石母那一段挖不动。挖开了，第二天又长回去。',
    },
    close: {
      lines: ['你要是出去了，别跟人说我们在下面。', '说了，也没人来。'],
      ask: '往东凿，能到古洞的侧壁。这话我憋了三年 —— 你别去。',
    },
  },
  // —— 第二章 P12-B：两位新区 NPC 的三层 ——
  // 和第一章野外四人一样：不是"态度变好"，是"越来越不想瞒"。
  // 蛊婆从「往北走」到交出自己没敢挂的牌；周摆渡从「桥是去年架的」到说出他爹的去向。
  w_gu: {
    first: {
      lines: ['往北走，别往南。', '这土是红的，不是染的。', '你听见虫子叫了吗？'],
      ask: '瘴气夜里最重。白天来，我还能替你认路。',
    },
    known: {
      lines: ['你又往南去了。', '幡上的字，别抄。', '抄一遍，就少一个人往东。'],
      ask: '幡上数到三十九就停了。第四十那行是我留的空 —— 留了十一年，没敢填。',
    },
    close: {
      lines: ['……你也听见了。', '（她把石臼往你这边推了推。）', '数到四十，就该换人了。'],
      ask: '我娘数到三十九，我数到四十。这块牌我压在臼底下，没敢挂。挂上去，就该我往东走了。',
    },
  },
  w_ferry: {
    first: {
      lines: ['桥是去年才架的。', '水底下有东西，别往下看。', '过江往东，是江匪的地界。'],
      ask: '铁链还在水底。上游冲下来的东西，都挂在链子上。',
    },
    known: {
      lines: ['今天不摆渡。', '桨叶还没干，昨天就没人过江。', '链子又紧了一寸。'],
      ask: '陈九撑了二十年船，说链子往上拴。我原先当他讲胡话，后来自己收过一夜的链。',
    },
    close: {
      lines: ['上船吧。', '不用钱，牌子也别给。', '（他把桨横搁在梁上。）'],
      ask: '我爹撑到第四十一年，把船留给我，自己往东去了。他说收慢一点，下面的人能多歇一晚。这块牌我替他收着。',
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
    case 'floor': return (ctx.floor || 0) >= (t.n || 1);
    default: return false;
  }
}

// 一句话说明"这个节点在等什么"，给日志页显示未解锁的节点用。
// 不写会剧透的细节 —— 只写条件，不写内容。
//
// label 是给 kill 用的显示名。不加这个的话，日志页会写着「斩「yinhun」」——
// bossKills 的键是怪物 type，那是给代码看的，不是给人看的。
export function storyHint(s) {
  const t = (s && s.trigger) || {};
  const need = (s && s.need || []).length ? '（需前情）' : '';
  switch (t.type) {
    case 'boot': return '开局';
    case 'enter': return '去' + ((POI[t.at] || {}).name || t.at) + need;
    case 'kill': {
      const who = t.label || t.lord || null;
      return who ? '斩「' + who + '」' + need : '杀敌' + need;
    }
    case 'item': return '得信物' + need;
    case 'time': return '夜半' + need;
    case 'triple': return '三物齐' + need;
    case 'floor': return '下到古洞第 ' + (t.n || 1) + ' 层' + need;
    default: return '未知';
  }
}
