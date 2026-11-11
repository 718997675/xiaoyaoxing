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
    turnIn: [
      { who: '你', text: '潭底那条青鳞蟒剖开了。腹里没有骨头，只有一节竹子，风一过会响。' },
      { who: '吴老六', text: '他把竹节搁在膝上，没去碰，也没往耳边凑。' },
      { who: '吴老六', text: '「我不听。听了就得信他还在里头。」' },
      { who: '你', text: '潭边还插着一把刀，刀柄缠着麻绳。' },
      { who: '吴老六', text: '「……拿过来。」声音比刚才低了半截，「拿过来我看看。」' },
      { who: null, text: '你把刀递过去。麻绳上有一道很深的牙印，像是咬了很久才松口。' },
    ],
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
    turnIn: [
      { who: '你', text: '矿道最深处那块石母凿开了，里头是一滴凉水似的东西，握着却烫手。' },
      { who: '碑奴', text: '他伸手要接，又缩回去，在裤腿上擦了两下手。' },
      { who: '碑奴', text: '「三十年前塌的时候，下去十一个。上来三个。」' },
      { who: '碑奴', text: '「上来的三个，都说底下有人接着往下凿。」' },
      { who: '你', text: '「接着凿的是谁？」' },
      { who: '碑奴', text: '「没人问。问了就得再下去一趟。」他把石髓拢进袖子，袖口立刻鼓了一小块。' },
    ],
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
    turnIn: [
      { who: '玄阳子', text: '「土拿到了？别摊开给我看。」他背着手，眼睛看着碑。' },
      { who: '你', text: '「夜里长的，湿的。守墓人说，碑别碰。」' },
      { who: '玄阳子', text: '「他每回都这句。」道士笑了一下，「三十年前我头一回来，他也是这么说的。」' },
      { who: '玄阳子', text: '「北坡不葬人。葬的是那些还没死透、又不能放回去的。」' },
      { who: '你', text: '「那你为什么每年都来？」' },
      { who: '玄阳子', text: '「数数。」他用拂尘指了指碑脚，「少一块，我就少记一年。」' },
    ],
    outro: '“土你拿去。”守墓人背过身，“碑，别碰。”',
  },

  // ============ 支线九条 ============
  q_side_dog: {
    id: 'q_side_dog', kind: 'side', place: '青云集',
    title: '恶犬成群',
    giver: 'qiao',
    brief: '石大的腿是山魈啃的，可他说最近咬人的是狗。',
    steps: [{ text: '打八只恶犬', kind: 'kill', types: ['fox'], count: 8 }],
    reward: { gold: 180, fame: 2, xp: 60 },
    turnIn: [
      { who: '你', text: '八只都清了。腿上带牙印的那种，不像是山魈。' },
      { who: '石大', text: '「我说过是狗。」他把柴刀往地上一顿，「他们非要说是山魈，说是山魈我这条腿就值二两药钱。」' },
      { who: '你', text: '「狗是谁家的？」' },
      { who: '石大', text: '「没家。」他顿了顿，「以前有。」' },
      { who: null, text: '他弯腰去捡地上那截绳，捡了两回才捡起来。手一直在抖，不是怕。' },
      { who: '石大', text: '「你别跟人讲我谢你。讲了他们又该来问腿了。」' },
    ],
    outro: '“狗比人实在。”他把柴刀往肩上一扛，“至少它咬你之前会叫。”',
  },
  q_side_bandit: {
    id: 'q_side_bandit', kind: 'side', place: '青云集',
    title: '账要清',
    giver: 'inn',
    brief: '柳三娘的账本上，黑风寨欠了三年房钱。',
    steps: [{ text: '清六名山贼', kind: 'kill', types: ['zhiren'], count: 6 }],
    reward: { gold: 250, fame: 3, xp: 80 },
    turnIn: [
      { who: '柳三娘', text: '「清了？」她没抬头，算盘珠子还在响。' },
      { who: '你', text: '「六个。账本上欠的是三年零两个月。」' },
      { who: '柳三娘', text: '「是三年零两个月零九天。」算盘停了，「头一年他们带过娘子来，住的是东间，要了两壶热的。」' },
      { who: '你', text: '「账还要不要？」' },
      { who: '柳三娘', text: '「要。」她把那一页撕下来，捏在手里看了一会儿，「记着就得有人还。人没了，账也不能跟着没。」' },
      { who: null, text: '纸角在灶口卷了一下，就黑了。她这才抬眼看你，眼里没什么。' },
    ],
    outro: '“死了就死了。”她把账页撕下来，扔进灶膛，“账清了。”',
  },
  q_side_herb: {
    id: 'q_side_herb', kind: 'side', place: '南岭竹海',
    title: '蛇胆',
    giver: 'w_herbboy',
    brief: '药童小满要五枚蛇胆，说镇惊用。',
    steps: [{ text: '取五枚蛇胆', kind: 'kill', types: ['snake'], count: 5 }],
    reward: { gold: 120, fame: 1, xp: 50, potion: 2 },
    turnIn: [
      { who: '小满', text: '「五枚？」他把药罐抱得更紧了些，「师父说三枚就够。」' },
      { who: '你', text: '「多两枚，留着。」' },
      { who: '小满', text: '「留着会苦。」他掰着指头算，「苦一次镇一天，五枚能镇五天。可第五天要是还惊，就没了。」' },
      { who: '你', text: '「那第六天呢？」' },
      { who: '小满', text: '「第六天师父就该换方子了。」他很认真地把罐子放到柜上，「换方子我就不怕了。换方子说明他还想办法。」' },
      { who: null, text: '罐底在木头上磕了一声，很轻。他没敢再挪。' },
    ],
    outro: '“师父说蛇胆苦。”他把药罐抱在怀里，“苦才镇得住。”',
  },
  q_side_forge: {
    id: 'q_side_forge', kind: 'side', place: '青云集',
    title: '炉子饿了',
    giver: 'smith',
    brief: '张五的炉子要十五块精铁才烧得起来。',
    steps: [{ text: '交十五块精铁', kind: 'have', field: 'iron', count: 15, spend: true }],
    reward: { gear: { r: 2, kind: 'weapon' }, gold: 100, xp: 90 },
    turnIn: [
      { who: '你', text: '十五块精铁，按你说的码在炉边了。' },
      { who: '张五', text: '他拿钳子拨了拨，数也没数，先把最上头那块翻了个面。' },
      { who: '张五', text: '「这批铁是北边来的吧。」' },
      { who: '你', text: '「乱葬岗捡的。」' },
      { who: '张五', text: '「怪不得。」他把钳子搁下，「北边的铁硬，可不吃火。得先饿炉子一宿，明早才打得动。」' },
      { who: '张五', text: '「东西在门后头，自己拿。别谢我，谢这批铁扛得住。」' },
    ],
    outro: '“铁留下，东西拿走。”他连头都没抬。',
  },
  q_side_wine: {
    id: 'q_side_wine', kind: 'side', place: '北坡乱葬岗',
    title: '一坛酒',
    giver: 'tavern',
    brief: '阿七说，守墓人每月十五会来打酒，这个月没来。',
    steps: [{ text: '把酒送到守墓人小屋', kind: 'reach', at: { x: 1952, y: 512, r: 90 } }],
    reward: { gold: 200, fame: 2, xp: 70 },
    turnIn: [
      { who: '阿七', text: '「送到了？」她把酒坛的封泥又按了一遍，「门口有人应没有？」' },
      { who: '你', text: '「没有。屋里有灯，没开门。」' },
      { who: '阿七', text: '「那就是他。」她松了手，「他每回都这样。人站在门里头，等你走了才拿。」' },
      { who: '你', text: '「这个月他没来打酒。」' },
      { who: '阿七', text: '「我知道。」她把坛子挪到柜台最里头，「所以我才托你送。我去了，他就得开门。」' },
      { who: null, text: '柜台后头还有一只空坛，封泥是新的，摆得端端正正。' },
    ],
    outro: '酒坛放在门口。第二天再去看，坛子空了，坛口压着一枚铜钱。',
  },
  q_side_well: {
    id: 'q_side_well', kind: 'side', place: '青云古洞',
    title: '井底那块石',
    giver: 'zui',
    brief: '王二说井通地底。你不信，但他说得像个真事。',
    steps: [{ text: '下到古洞第一层', kind: 'dg', floor: 1 }],
    reward: { relic: 'well_stone', gold: 300, fame: 3, xp: 100 },
    turnIn: [
      { who: '王二', text: '「下去了？」他鼻子动了动，「身上带土腥。」' },
      { who: '你', text: '「第一层。井底有块石头，一面有凿痕。」' },
      { who: '王二', text: '「从哪面凿的？」他忽然坐直了。' },
      { who: '你', text: '「从里往外。」' },
      { who: '王二', text: '他愣了很久，才把碗里剩的酒晃了晃，没喝。' },
      { who: '王二', text: '「我说井通地底，他们笑了十年。」他小声说，「原来笑错方向了。」' },
    ],
    outro: '石头上真有凿痕，从里往外凿的。',
  },
  q_side_tale: {
    id: 'q_side_tale', kind: 'side', place: '青云古洞',
    title: '说书人缺个结尾',
    giver: 'shuo',
    brief: '柳先生讲了三十年的故事，缺一个真结局。',
    steps: [{ text: '斩了无面剑客', kind: 'kill', types: ['wumian'], count: 1 }],
    reward: { gold: 800, fame: 10, xp: 400, gear: { r: 3, kind: 'weapon' } },
    turnIn: [
      { who: '柳先生', text: '「了了？」醒木搁在桌上，他没拍。' },
      { who: '你', text: '「第三层。没有脸。」' },
      { who: '柳先生', text: '「三十年，我给这故事编过七个结尾。」他一根一根数手指，「状元及第、卸甲归田、死在雪里……都挺好的，就是没人信。」' },
      { who: '你', text: '「这个就有人信？」' },
      { who: '柳先生', text: '「这个最没人信。」他把醒木拿起来，又放下，「可它是真的。真东西不用人信，它自己搁在那儿。」' },
      { who: null, text: '桌角压着一沓纸，头一页写了半行，墨还没干透。' },
    ],
    outro: '“成了。”他把醒木一拍，“从明日起，讲你。”',
  },

  // ============ P9 补的两条支线（7 → 9） ============
  // 第一条是**跨区**的：委托在竹海，活儿在石窟。设计文档要求至少一条跨区，
  // 理由是"玩家得为一件小事跑一趟别的区"，那趟路会把三个区连成一个地方，
  // 而不是三个互不相干的关卡。
  q_side_oar: {
    id: 'q_side_oar', kind: 'side', place: '南岭竹海',
    title: '沉在暗河的桨',
    giver: 'w_boat',
    brief: '陈九兄弟的船顺流漂到了北边，桨卡在石窟的暗河里。',
    steps: [
      // 火鸦把桨叼去做巢了 —— 所以先得清火鸦，才敢下去捞。
      { text: '清八只火鸦', kind: 'kill', types: ['crow'], count: 8 },
      { text: '走到石窟矿口', kind: 'reach', at: { x: 192, y: 320, r: 90 } },
    ],
    reward: { gold: 300, fame: 4, xp: 120 },
    turnIn: [
      { who: '陈九', text: '「桨呢？」他先往你身后看了一眼。' },
      { who: '你', text: '「找着了。断了一截，火鸦拿去垫巢了。」' },
      { who: '陈九', text: '他接过去，用掌心从断口那头一路摸到桨叶，摸得很慢。' },
      { who: '陈九', text: '「我兄弟划的是右手。这截断的，正好是右手够不着的地方。」' },
      { who: '你', text: '「还能修。」' },
      { who: '陈九', text: '「不修。」他把桨插到船头，插得笔直，「这样船就走不快了。走不快，就还来得及回头。」' },
    ],
    outro: '桨找回来了，断了一截。陈九把它插在船头，说这样船就走不快了。',
  },
  // 第二条接在第三幕的人身上：老矿工要一盏能烧到他们出去那天的灯。
  // 它同时也是给玩家的一条"该带精铁"的提示 —— 石窟那一片怪硬，装备得跟上。
  q_side_lamp: {
    id: 'q_side_lamp', kind: 'side', place: '西荒石窟',
    title: '烧到出去那天',
    giver: 'w_miner',
    brief: '老矿工说火把一灭，洞里就有人不见。他要十二块精铁打灯盏。',
    steps: [
      { text: '交十二块精铁', kind: 'have', field: 'iron', count: 12, spend: true },
      { text: '清五只符傀', kind: 'kill', types: ['fukui'], count: 5 },
    ],
    reward: { gold: 320, fame: 3, xp: 130, potion: 2 },
    turnIn: [
      { who: '老矿工', text: '「十二块？」他没接，先数了数你手上的口子。' },
      { who: '你', text: '「符傀也清了。矿口那五只。」' },
      { who: '老矿工', text: '「那五只不是守矿的。」他把铁块一块块码进灯盏的模子里，「是等灯的。灯一灭，它们就往有人的地方走。」' },
      { who: '你', text: '「你等了多久？」' },
      { who: '老矿工', text: '「三年。」他敲了一下模子，声音很脆，「壁根上刻着日子。刻到第三百多道，我就不刻了 —— 怕刻满了还没出去。」' },
      { who: null, text: '灯盏挂上营口的时候，风从矿道里出来，火苗歪了一下，没灭。' },
    ],
    outro: '灯盏打好了。他把它挂在营口，说这盏灯能烧三年 —— 正好烧到他出去那天。',
  },
  // ============ P12-B 第二章支线（9 → 15） ============
  // 目标只走 reach / kill / have 三种既有类型：tools/quests.js 的「全通」脚本
  // 只认这几种，不给它加分支，也不给自己加一套只有线上才跑得通的判定。
  // 发放者分散在新区两人与村里四人，六条各不重样；交付对话逐句不撞词。
  q_side_banner: {
    id: 'q_side_banner', kind: 'side', place: '南疆瘴林',
    title: '蛊幡上的名字',
    giver: 'w_gu',
    brief: '寨外那面幡上，同一个姓被划掉又抄了七回。',
    steps: [
      { text: '去看寨外那面幡', kind: 'reach', at: { x: 352, y: 1856, r: 95 } },
      { text: '清六只瘴里的符傀', kind: 'kill', types: ['fukui'], count: 6 },
    ],
    reward: { gold: 420, fame: 5, xp: 180 },
    turnIn: [
      { who: '蛊婆', text: '幡你去看过了。' },
      { who: '你', text: '抄了七回，都是同一个姓。第四十行空着。' },
      { who: '蛊婆', text: '她把炭条搁下，指腹在膝盖上蹭了两下，没有抬眼。' },
      { who: '蛊婆', text: '「抄的人不是想记住。是怕自己忘了该轮到谁。」' },
      { who: '你', text: '「那一行为什么留着？」' },
      { who: null, text: '棚外的幡被风翻过来，背面一个字也没有。' },
    ],
    outro: '她到底没说那行该填谁，只把炭条收进了袖子。',
  },
  q_side_redsoil: {
    id: 'q_side_redsoil', kind: 'side', place: '南疆瘴林',
    title: '赤土不是染的',
    giver: 'yu',
    brief: '崔婆婆说赤土墟的土早年不是红的，要一根探条才肯信。',
    steps: [
      { text: '到赤土墟取土', kind: 'reach', at: { x: 768, y: 2112, r: 110 } },
      { text: '交十块精铁打探条', kind: 'have', field: 'iron', count: 10, spend: true },
    ],
    reward: { gold: 360, fame: 4, xp: 160, potion: 1 },
    turnIn: [
      { who: '崔婆婆', text: '探条带回来了？土呢。' },
      { who: '你', text: '没敢带。挖到两尺就是骨，一截一截码得整齐。' },
      { who: '崔婆婆', text: '她把探条在围裙上擦了三遍，擦完还捏着不放。' },
      { who: '崔婆婆', text: '「我小时候，那边的土是黄的。」' },
      { who: '你', text: '「什么时候红的？」' },
      { who: null, text: '灶上的水开了，她没去提，也没把手松开。' },
    ],
    outro: '她说等水凉了再讲，后来那壶水凉了一整夜，她也没讲。',
  },
  q_side_chain: {
    id: 'q_side_chain', kind: 'side', place: '江岸渡口',
    title: '水底的铁链',
    giver: 'qiao',
    brief: '石大说桥墩那圈铁链的磨痕不对劲，想让人替他下去看一眼。',
    steps: [
      { text: '走到渡桥中段', kind: 'reach', at: { x: 1600, y: 1952, r: 80 } },
      { text: '顺着链子走到水底铁链', kind: 'reach', at: { x: 1792, y: 2112, r: 90 } },
    ],
    reward: { gold: 400, fame: 5, xp: 170 },
    turnIn: [
      { who: '石大', text: '桥底下那圈东西，你摸着了？' },
      { who: '你', text: '摸着了。环内侧磨出一道沟，都偏向东。' },
      { who: '石大', text: '他把柴捆往地上一顿，蹲下去比划那道沟的斜劲。' },
      { who: '石大', text: '「柴顺水漂，也偏一头。可这东西不漂。」' },
      { who: '你', text: '「那是谁在拉？」' },
      { who: null, text: '他没答，把柴捆重新扛起来，绳头在肩上勒出一道白印。' },
    ],
    outro: '走的时候他绕开了桥，宁可多趟半里水，也没从板子上过。',
  },
  q_side_ferrycoin: {
    id: 'q_side_ferrycoin', kind: 'side', place: '江岸渡口',
    title: '过江钱',
    giver: 'w_ferry',
    brief: '渡口价目牌上的三文被划掉了，可还是有人替没上岸的人给钱。',
    steps: [
      { text: '清五只江匪', kind: 'kill', types: ['zhiren'], count: 5 },
      { text: '交九文过江钱', kind: 'have', field: 'gold', count: 9, spend: true },
    ],
    reward: { gold: 500, fame: 4, xp: 175 },
    turnIn: [
      { who: '周摆渡', text: '钱搁着吧，别递过来。' },
      { who: '你', text: '牌子上写着三文，我数了九文。' },
      { who: '周摆渡', text: '他把铜钱一枚一枚推回你这边，推到最后一枚停了手。' },
      { who: '周摆渡', text: '「三文是给活人算的。多出来的，是替没上岸的人给的。」' },
      { who: '你', text: '「那你为什么不收？」' },
      { who: null, text: '江面上有东西浮起来又沉下去，他没有转头去看。' },
    ],
    outro: '那九文最后还搁在牌子上，谁也没动，风把最上面一枚吹得翻了个面。',
  },
  q_side_plates: {
    id: 'q_side_plates', kind: 'side', place: '链尽头',
    title: '挂在链上的木牌',
    giver: 'shuo',
    brief: '柳先生要一个真结局，可那串木牌上四十一个人都没有名字。',
    steps: [
      { text: '斩了挂满木牌的江鬼', kind: 'kill', types: ['jianggui'], count: 1 },
      { text: '走到链尽头', kind: 'reach', at: { x: 2112, y: 2208, r: 95 } },
    ],
    reward: { gold: 620, fame: 8, xp: 260, gear: { r: 3, kind: 'artifact' } },
    turnIn: [
      { who: '柳先生', text: '听说你翻过那一串牌。' },
      { who: '你', text: '四十一块，名字全凿了，第四十一块连纹都没有。' },
      { who: '柳先生', text: '醒木在手里转了两圈，一下也没往桌上落。' },
      { who: '柳先生', text: '「说书的最怕这个。有头有尾，中间四十个人没名字。」' },
      { who: '你', text: '「那怎么讲？」' },
      { who: null, text: '他把醒木放回原处，摆得和原先那一道印子严丝合缝。' },
    ],
    outro: '那天他没开书，只跟听客说了一句：今儿这回，得等名字齐了再讲。',
  },
  q_side_nightlamp: {
    id: 'q_side_nightlamp', kind: 'side', place: '江岸渡口',
    title: '渡口夜灯',
    giver: 'geng',
    brief: '老周打了四十年更，说渡口该有一盏不归他管也得亮着的灯。',
    steps: [
      { text: '交十四块精铁铸灯', kind: 'have', field: 'iron', count: 14, spend: true },
      { text: '把灯挂到渡口', kind: 'reach', at: { x: 1600, y: 1856, r: 100 } },
    ],
    reward: { gold: 340, fame: 4, xp: 150, potion: 2 },
    turnIn: [
      { who: '老周', text: '灯挂上了？' },
      { who: '你', text: '挂在棚檐底下，风从江上来，火苗歪了歪，没灭。' },
      { who: '老周', text: '他把灯笼从手里放下，敲了敲更梆，敲得比平时轻。' },
      { who: '老周', text: '「我打更四十年，村口那盏从来不用人管。」' },
      { who: '你', text: '「渡口这盏得管？」' },
      { who: null, text: '他往南看了一眼，把更梆夹在腋下，没再敲第二下。' },
    ],
    outro: '后来渡口那盏灯每夜都亮着，添油的是谁，村里没人说得上来。',
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
