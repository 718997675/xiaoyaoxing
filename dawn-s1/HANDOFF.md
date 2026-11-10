# 交接说明（换账号 / 换机器 从这里开始）

> 最后更新：2026-11-10
> 这份文档的唯一目的：**任何人（包括一周后的你自己）打开这个仓库，能在五分钟内知道
> 现在做到哪了、下一步做什么、怎么验证没写坏。**

---

## 1. 这是什么

一个浏览器里跑的**俯视角像素武侠 ARPG**。纯前端，无构建，ES module 直接跑。

- 入口：`index.html`（游戏本体）、`逍遥行.html`（单文件打包版，`build.js` 生成）
- 引擎：three.js（正交相机，2D 精灵贴图）+ 一块 2D canvas 做 overlay（HUD / 菜单）
- 逻辑分辨率 `480×270`，实际按视口铺满 + HiDPI backing store，所以文字是矢量锐利的

**跑起来**：

```bash
cd dawn-s1
npx serve .        # 或 python -m http.server
# 打开 http://localhost:3000/index.html
```

---

## 2. 五分钟验证（改完东西必跑）

仓库自带一个无头浏览器跑测的脚本，不需要装 puppeteer：

```bash
cd dawn-s1
node tools/run.js devtest        # 全量断言，当前基线 137 pass / 0 fail
node tools/run.js eval tools/weapons.js   # 八兵器 / 触屏专项，当前 32 pass / 0 fail
node tools/run.js eval tools/map.js       # 大地图连通性与地貌，当前 12 pass / 0 fail
node tools/run.js eval tools/camps.js     # 营地生态（巡逻/吹哨/食物链/作息），当前 17 pass / 0 fail
node tools/run.js eval tools/bosses.js    # 首领（招式表/巢穴/危险区/首杀专属），当前 23 pass / 0 fail
node tools/run.js eval tools/quests.js    # 任务（10 条全通/三物门禁/存档），当前 29 pass / 0 fail
node tools/run.js eval tools/arts.js      # 招式（16 招/专精/状态/平衡/存档），当前 53 pass / 0 fail
node tools/run.js eval tools/mantras.js   # 心法（22 条/互斥/12 个机制/200 组 DPS 分布），当前 72 pass / 0 fail
node tools/run.js shot out.png 1440 900   # 截图
```

**改完记得验一次单文件版**（`逍遥行.html` 走的是另一套代码路径：`build.js` 把 ESM
拆成 `__M.xxx`，module 版绿了不代表它能跑）：

```bash
node build.js
PAGE="逍遥行.html" QS=x=1 node tools/run.js eval tools/arts.js
PAGE="逍遥行.html" QS=x=1 node tools/run.js eval tools/mantras.js   # 应该和 module 版一样全绿
```

截图想拍"某一瞬间"（毒雾正在炸、Boss 正在抬手）用环境变量：

```bash
QS="dev=0" POS=760,352 CLOCK=0.35 \
  SETUP="const d=g.enemies.find(e=>e.type==='huoya');d.aggro=true;d.skillCds=null;d.skillGap=0;\
d.skill={fx:'rain',r:30,count:6,spreadR:96,delay:0.9,dmg:1};d.skillT=0.01;\
for(let i=0;i<25;i++)g.tick(0.016)" \
  node tools/run.js shot docs-boss-skill.png
```

- `POS=x,y` 先把角色挪过去再截
- `CLOCK=t` 设时辰（0=卯 / 0.35=午 / 0.85=子）
- `SETUP="..."` 在 POS 之后、截图之前跑一段页面代码
- `QS=` 换成 `dev=0` 就不会盖住那个 devtest 面板

> 已知：`shot` 加了 `Emulation.setDeviceMetricsOverride` 之后，画布右侧偶尔会留一条
> 没重绘的旧帧残影。是截图工具的 resize 竞态，不是游戏本身的问题；多截一张就正常。

`tools/run.js` 自己起 http server、自己拉 headless Chromium（路径在文件顶部 `CHROME` 常量，
换机器要改）。**不要用 `nohup ... &` 起服务** —— shell 一退就被回收，表现为莫名其妙的 502。

---

## 3. 当前进度

### 已完成

| 项 | 状态 |
|---|---|
| 八类兵器 + 五系三段重设计 | ✅ |
| 触屏手感（摇杆、右下键误触、双击缩放） | ✅ |
| 手持显示（待机缩小贴手 / 出招显形） | ✅ |
| 掉落稀有外观、装备数值对比 tooltip | ✅ |
| 首领血条脱战消失（`combatT`） | ✅ |
| 行囊容量系统（20→60，银两扩充，满包不捡不吸附） | ✅ |
| 全屏 / 无黑边 / HiDPI 高分渲染 | ✅ |
| 飞镖削弱（撞墙即碎、射程 228→157px） | ✅ |
| 双刀三段镜像动作 | ✅ |
| **P1 大地图 144×104 + 四区地貌 + 12 营地 + 路网** | ✅ 2026-11-10 |
| **P2 营地生态：巡逻 / 吹哨 / 食物链 / 作息 / 营地道具 / 3 个营地首领** | ✅ 2026-11-10 |
| **P3 首领 3→8：招式表引擎 + 4 个巢穴 + 地面危险区 + 5 件首杀专属装备** | ✅ 2026-11-10 |
| **P4 任务系统：`quests.js` 10 条 + 面板 + 追踪条 + 三物门禁 + 4 个新 NPC** | ✅ 2026-11-10 |
| **P5 招式系统：`arts.js` 16 招 + 六种效果原语 + 兵器专精 0→10 + 状态系统 + 招式页** | ✅ 2026-11-10 |
| **P5.5 心法系统：`mantras.js` 22 条 + 一主二辅互斥 + 五个机制钩子 + 心法页 + 游方道人** | ✅ 2026-11-10 |
| 双渠道发布（GitHub Pages + workbuddy） | ✅ |

### 未完成（按顺序）

| 批次 | 内容 | 文档 |
|---|---|---|
| **P6** | 补齐剩余 48 个技能 + 装配 UI | `SKILLS-STORY-PLAN.md` §二 |
| **P7~P9** | 剧情框架 + 三幕 + 终章 | `SKILLS-STORY-PLAN.md` §四 |

---

## 4. 文档索引

| 文档 | 讲什么 |
|---|---|
| `HANDOFF.md` | 就是这份。现状 + 怎么跑 + 下一步 |
| `CHAPTER-1-EXPANSION.md` | 第一章地图/营地/首领/NPC 扩容的施工图，含 P1~P4 施工单和技术坑 |
| `SKILLS-STORY-PLAN.md` | 武器技能 64 个 + 心法 22 条 + 剧情三幕的完整设计 |
| `README.md`（仓库根） | 项目简介与进度 |

**两份设计文档都是自包含的**：里面有需求原话、结论、数值表、数据结构、验收标准。
换账号之后只看文档就能接着写，不需要翻聊天记录。

---

## 5. 代码地图

```
dawn-s1/
├── game.js        ~4400 行，主逻辑。世界生成 / 战斗 / 掉落 / 存档 / HUD / 输入
├── weapons.js     八类兵器的挥砍参数（a0→a1 角度、hitArc、reach、lunge、弹道）
├── monsters.js    怪物与首领
├── items.js       装备生成与词条
├── skills.js      被动树（NODES）+ 气/舞/雷三个通用主动
├── arts.js        兵器招式（16 个，数据层）+ 专精曲线
├── mantras.js     心法（12 主 + 10 辅）+ 一主二辅装配 + 数值汇总，纯数据层
├── quests.js      任务定义表（10 条）+ 信物 + 纯函数
├── village.js     青云集：建筑、NPC、摆件、店铺（坐标都是村内绝对像素）
├── dungeon.js     青云古洞（占地图上一块矩形，进洞时重写该块的 tiles）
├── pixel.js       调色板 C 与精灵工具
├── time.js        时辰与昼夜
├── index.html     页面骨架 + 全部 DOM 面板
├── devtest.js     ?dev=1 时加载的全量断言
└── tools/
    ├── run.js     无头浏览器跑测器（devtest / eval / shot / expr）
    ├── map.js     大地图连通性自检
    ├── mapview.js 把整张地图画成一张 png，肉眼检查地貌
    ├── weapons.js 兵器与触屏专项自检
    ├── bosses.js  首领与危险区自检
    ├── quests.js  任务线自检
    ├── arts.js    招式与专精自检
    ├── mantras.js 心法与 200 组组合的 DPS 分布
    └── play.js / shot.js / touch.js  交互与截图工具
```

---

## 6. 已知的坑（都踩过，别再踩一遍）

### 地图与坐标

- **`MAPW` 是所有索引的基**：`y * MAPW + x`。改地图尺寸时，除了常量，还要检查
  散点数量（写死的 90 / 320 / 150 要按面积比放大）、小地图比例、相机 clamp。
- **村庄整体位移**：`game.js` 顶部有 `V_SHIFT_X / V_SHIFT_Y`，一次性把 `VILLAGE`、
  `BUILDINGS`、`NPCS`、`VILLAGERS`、`PROPS`、`SHOPS` 全部平移。
  **不要**去 `village.js` 里一个个改坐标。
- **旧存档会落在墙里**：`load()` 里有兜底 —— 站不住就送回 `SPAWN`。
- **`dungeon.js` 的 `DG` 用 getter**（`get x0()`），因为它要跟着 `tx0/ty0` 变。
  别改回字面量。

### 渲染

- **改 `canvas.width` 会重置全部 2D 状态**（transform / imageSmoothingEnabled）。
  `applyHiDPI()` 每次都要重设。
- **canvas 2D 状态是跨函数共享的全局状态**：`textBaseline` / `textAlign` / `font`
  改了必须恢复，否则下游绘制错位（曾经把快捷栏按键字母裁掉半截）。
- **整数倍缩放会留黑边**：1366×768 上 `Math.floor(2.844) = 2`，画面只占 49%。
  现在的策略是"几乎正好整数才取整，否则按实际比例铺满"。

### 逻辑

- **背包容量必须走 `invFull()` 统一入口**。曾经容量 20 散落写死，拾取挡但卸下/买药不挡，
  溢出装备塞进数组却渲染不出来。
- **掉落物先磁吸再判断能否拾取**会导致满包时光柱黏着人跑。现在满包不吸附。
- **弹体要判墙体**（`canStand`）。以前没有，能隔墙磨 boss。
- **`player.invMax` 读档要兼容老档**：按实际件数把容量抬上去，别让玩家一进游戏看到 `25/20`。

### 测试

- `devtest.js` 里的村庄坐标走 `vp(x, y)` 偏移函数，**别写死**。地图一动就全废。
- 加墙体判定后，"飞弹能命中敌人"这类测试会 flaky（隔树打不到）。
  修法是**逐个换目标重试**，不是放宽断言。

### 网络（发布时）

- 本机访问要 `--no-proxy-server --proxy-bypass-list=*`；
  访问**线上**不能加，会绕过网关会话 → 403。
- `github.com:443` 偶尔完全不通。应急可以走 Git Data API
  （`POST /git/blobs` → `/git/trees` → `/git/commits` → `PATCH /git/refs/heads/main`）。

### 打包（最坑的一条）

- **`build.js` 的 `ORDER` 是手写清单，漏一个模块不会报错**。module 版照样能跑，
  单文件版会在运行时 `Cannot destructure property 'X' of undefined` 直接白屏。
  `quests.js`（P4）和 `arts.js`（P5）都漏过，线上 `dist/index.html` 因此坏了两轮。
  现在 `build.js` 开头有 `verifyOrder()`：拿源码里的 `import ... from './x.js'`
  反查 ORDER，漏了直接 build 失败。
- **发布后一定要真的打开一次线上页面**，不能只 `grep` 关键字 —— 打包版白屏时，
  HTML 里的文案照样在，grep 全都能命中。
- `PAGE="逍遥行.html"` 可以换入口页跑自检（`tools/run.js`）。传中文文件名要传**原文**，
  它内部会 `encodeURIComponent`，自己先编码一次会变成 `%25E9...` → 404。

### 招式 / 状态（P5 踩的）

- **刀光不能在 `update()` 里画**。`drawOverlay()` 开头就 `clearRect`，update 阶段画的东西
  下一帧就没了；而且那里拿不到 overlay 的 ctx。正确做法是往 `slashGhosts` 里 push
  一条 `{x,y,a0,a1,R,colors,t,max}`（或 `{ring:true}` / `{thrust:ang,len}`），
  它自己按世界坐标画、自己淡出。
- **`drawArcFx / drawRingFx / drawThrustFx` 第一个参数是 ctx**，颜色是**数组**不是单色。
  签名不对时表现为 `ctx.save is not a function`，一眼能看出来，但很容易写错。
- **`.panel button` 是 `width:100%` 的整行按钮**。往 flex 卡片里塞按钮必须显式写
  `display:inline-block;width:auto;flex:0 0 auto`，否则按钮吃掉整行，
  左边的名字和描述会被挤成一列单字。
- **`spawnEnemy` 会把刷在青云集界内的怪搬回营地**（`inVillage(x,y,24)`）。
  写自检时如果站在村里放木桩，木桩会全跑到几百像素外，弹体与落雷自然一个都打不中。
  试招场地要挪到村外，而且**营地圆心经常压着一块实心**（篝火/石台），
  人站上去弹体一出膛就 `!canStand` 碎掉 —— 要往外螺旋找一块空地。
- **落雷的命中判定原来写的是 `e.y - b.h / 2`**，而 bolt 对象从来没有 `h` 字段，
  于是 `NaN < r` 恒为 false —— 天雷诀从 S1 起一发都没打中过人。这个 bug 一直没人发现，
  因为没人给它写过"真的打到人"的断言。**加新系统时顺手给老系统补一条实测断言，很值。**
- **`applyStatus` 在 `hitEnemy` 之后调用**，目标当场被打死时状态会被跳过。
  测"中毒"这类效果要给木桩留足血量，否则测出来的是"没中毒"。
- **`items.js` 已经导出了 `SLOT_LABEL`**（兵器/衣甲/项链/法宝）。`arts.js` 里的
  同名导出改名 `ART_SLOT_LABEL` —— 同一个文件 import 两个同名符号，后者静默覆盖前者，
  那种 bug 查起来极费劲。
- **触屏按钮的容错圈半径是 `r + BTN_PAD(6)`**，两个键的圆心距必须 ≥ `2*(r+6)`。
  3×2 的招式键阵用 42px 间距（r=14），余量 2px。

### 心法 / 平衡（P5.5 踩的）

- **命中本身回 3 点真气**。焚心写"每次攻击 -2 真气"时，净效果是 **+1** —— 代价凭空消失。
  写成 -5 才是净 -2。任何"每次攻击消耗 X"的设计，都要先减掉命中回复再定 X。
- **寒潭的"靠概率"在实战里不成立**：攻速够快时 2 秒减速窗口首尾相接，等于常驻 +20%。
  概率型代价必须让窗口短于攻击间隔，否则就是白给。
- **`hitstop` 会让 `update()` 整帧提前返回**（`if (hitstop > 0) { hitstop -= dt; tickSwing(dt); return; }`），
  连 `player.atkCd` 都不扣。于是"这一刀停多久"直接决定八秒里能挥几刀 ——
  同一组心法组合实测能差 **55%**。做 DPS 测量必须先 `g.hitstop = 0`。
- **`player.atkBase` 会被升级累积**（每升一级 +2）。自检里杀过怪之后再测数值，
  基线就被悄悄抬高了，同一组组合能高出七成。`clean()` 必须显式钉死 `atkBase` / `maxHpBase`。
- **野怪会一直刷**。200 组组合 × 8 秒 = 26 分钟游戏时间，AOE 打死刷出来的野怪 →
  升级 → 攻击力一路上涨，后半个循环的数据比前半段高七成。`resetCombat()` 要把
  `spawnT` / `eliteT` 推到 9999。
- **时辰也会漂**。晨雾偷袭 ×1.5、夜行怪属性都跟时辰走，26 分钟足够跨过卯时与子时。
  平衡脚本要 `g.setClock(0.5, 1)` 钉在正午，否则前后样本根本不在同一个世界里。
- **木桩血量要够**。血量不够时 `dps = 总伤害 / 击杀耗时`，秒变"击杀速度"排名，
  P95 会被 TTK 取整放大。20 万血、8 秒窗口，确保没人打得死。
- **主心法互斥要靠 `install()` 保证，不能靠 UI 保证**。手改存档 / 老存档都可能塞进两条主心法，
  `sanitize()` 在读档时按"已学"过滤一遍，顺序反了会把槽一起清掉。
- **追命 / 藏锋这类"递增"必须压到 40% 以内**。中位数组合里有一半是防御类主心法
  （DPS 等于裸装），所以"最强那条能加多少"直接就是 P95/P50 的比值。
- **`equipFam()` 是随机滚词条的**（`makeGear(..., Math.random, ...)`），
  每次加载页面拿到的剑都不一样，整条基线能差四成（连跑四次 P50 = 2943 / 3856 / 4208 / 3331）。
  **比值不受影响**（同一次运行内自己比自己），但"改完数值有没有用"只能看绝对值，
  绝对值在飘的时候任何一次调参都看不出效果。平衡段要把 `Math.random` 整个换成固定序列，
  跑完再还回去。凡是要跨次比较的测量，先把所有随机源钉死。

---

## 7. 下次开工的第一件事

按 `SKILLS-STORY-PLAN.md` 的 **P6 · 补齐剩余 48 个技能** 往下做。

P1~P5.5 已经把第一章的骨架、战斗的构筑层、以及"一主二辅"的心法全部铺完了：

- 地图 144×104，四区地貌，12 营地 + 4 巢穴，路网与溪涧竹桥
- 怪会巡逻、吹哨叫援、追猎物、按时辰睡觉；8 个首领各有一套招式表
- 10 条任务（3 主线 + 7 支线）全部可完成，三物齐了才开古洞封碑
- **16 个兵器招式**：八兵器各 2 个（输出 + 特色），六种效果原语，专精 0→10 解锁
- **状态系统**：流血 / 灼烧 / 中毒 / 冻结 / 眩晕 / 减速 / 破甲 / 击飞，DoT 不走 `hitEnemy`
- **22 条心法**：12 主 + 10 辅，一主二辅互斥，540 种组合，P95/P50 实测 1.24
- **五个机制钩子**：`fullHpBonus` / `chainBonus` / `idleStack` / `qiOnHurt` / `critResetCd`，
  全部折进 `hitEnemy` / `hurtPlayer` / `update` 三条路径，没有另起一套战斗逻辑

**P6 怎么接**：`arts.js` 现在只有 16 条（八兵器 × [输出 + 特色]）。剩下的 48 条按
`SKILLS-STORY-PLAN.md` §二 的表补进同一个 `ARTS` 对象即可 —— `execArt()` 是分派器，
六种效果原语已经齐了，**加一招只写数据不改运行时**。唯一要注意的是每把兵器的
`prof` 门槛要错开，别让 6 个技能全挤在 1~4 级。

**动手前先读**：
- `SKILLS-STORY-PLAN.md` §二（64 个技能的效果表与分段规则）
- `SKILLS-STORY-PLAN.md` §2.6（P5 实施记录：16 招清单、平衡实测、与原计划的 5 处差异）

**三个命名提醒**：
- `game.js` 里 `skills` 已经被"气/舞/雷"三个通用主动占用了。
- 兵器招式叫 `arts`（`arts.js` / `player.loadout` / `artCds`）。
- 心法叫 `mantra`（`mantras.js` / `player.mantras` / `player.mantrasOwned`）。
  三层成长刻意分了三套命名，别再往 `skills` 上叠第四个。
