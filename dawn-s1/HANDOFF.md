# 交接说明（换账号 / 换机器 从这里开始）

> 最后更新：2026-11-11
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
node tools/run.js devtest        # 全量断言，当前基线 148 pass / 0 fail
node tools/run.js eval tools/weapons.js   # 八兵器 / 触屏专项，当前 32 pass / 0 fail
node tools/run.js eval tools/map.js       # 大地图连通性与地貌，当前 12 pass / 0 fail
node tools/run.js eval tools/camps.js     # 营地生态（巡逻/吹哨/食物链/作息），当前 17 pass / 0 fail
node tools/run.js eval tools/bosses.js    # 首领（招式表/三阶段换兵器/巢穴/危险区/首杀专属），当前 34 pass / 0 fail
node tools/run.js eval tools/quests.js    # 任务（12 条全通/交付对话逐句播放/三物门禁/存档），当前 38 pass / 0 fail
node tools/run.js eval tools/arts.js      # 招式（64 招/十四种原语/专精/装配拖拽/签名查重/平衡/存档），当前 131 pass / 0 fail
node tools/run.js eval tools/mantras.js   # 心法（22 条/互斥/12 个机制/200 组 DPS 分布），当前 75 pass / 0 fail
STORY=1 QS=x=1 node tools/run.js eval tools/story.js   # 剧情（28 节点/七种触发/终章选择/旧事页/存档），当前 96 pass / 0 fail
PAGE=art-workbench.html node tools/run.js eval tools/art-workbench.js   # 工作台页，当前 32 pass / 0 fail
node tools/run.js eval tools/art-overrides.js                            # 游戏侧覆盖层，当前 29 pass / 0 fail
node tools/run.js shot out.png 1440 900   # 截图
```

> 工作台页没有 `window.__game`，`tools/run.js` 的就绪等待同时认
> `!!(window.__game || window.__wbReady)`，所以同一套 runner 能开它。
> 两套新自检都要在**模块版 / `逍遥行.html` / `dist/index.html`** 三处跑：
> 覆盖层自检尤其要验单文件版（`build.js` 把 ESM 拆成 `__M.artoverrides`）。

> **`STORY=1` 不能省。** `tools/run.js` 默认给 URL 加 `story=0`，
> 关掉剧情的自动播放 —— 剧情一播世界就暂停，而所有回归套件都靠 `tick()` 手动步进世界。
> 不关的话失败现象是"某个断言莫名失败"，最难查的一类。只有剧情自检要打开它。

**改完记得验一次单文件版**（`逍遥行.html` 走的是另一套代码路径：`build.js` 把 ESM
拆成 `__M.xxx`，module 版绿了不代表它能跑）：

```bash
node build.js
PAGE="逍遥行.html" QS=x=1 node tools/run.js eval tools/arts.js
PAGE="逍遥行.html" QS=x=1 node tools/run.js eval tools/mantras.js   # 应该和 module 版一样全绿
```

> **`PAGE=逍遥行.html node tools/run.js devtest` 一定会超时，别当成回归失败**：
> `devtest.js` 只在 `?dev=1` 时由 `index.html` 动态 `import()`，它不在 `build.js`
> 的 `ORDER` 里，单文件版根本没打进去。单文件版用 `eval tools/*.js` 验。

**发布后必须验线上**（`URL=` 直接打远程地址，会等 `__game` 就绪、查心法数 / 道人 /
画布是否真的画出了像素 / 控制台有没有报错）：

```bash
PAGE=dist/index.html node tools/run.js online                        # 本地先验打包产物
URL="https://718997675.github.io/xiaoyaoxing/" node tools/run.js online   # 再验线上
URL="https://718997675.github.io/xiaoyaoxing/" node tools/run.js shot /tmp/online.png 1280 720
```

**只 grep 关键字不算验过**。打包版白屏时 HTML 里的文案照样在，grep 全都能命中 ——
P4 / P5 连着两轮就是这么把坏掉的 `dist` 发上线的。要真的把页面打开、等 `__game` 出现、
确认画布上有像素。

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
| **P6 招式系统补齐：`arts.js` 16 → 64 招 + 十种效果原语 + 六槽装配 UI + 平衡口径统一** | ✅ 2026-11-10 |
| **P7 剧情框架：`story.js` 10 节点 + 六种触发器 + 剧情覆盖层 + 旧事页 + 三层对话 + 三物线索** | ✅ 2026-11-10 |
| **P8 第一幕 + 第二幕正文：`story.js` 10 → 20 节点 + 3 个地标 + 3 处旧物 + 5 条线索 + 3 个野外 NPC 三层** | ✅ 2026-11-10 |
| **招式装配页重做：「剑匣 + 招式谱」两栏 · 拖拽装配 · 去掉了"先选格再选招"** | ✅ 2026-11-10 |
| **P9 第三幕 + 终章：`story.js` 20 → 28 节点 · `floor` 触发器 · 终章「选择」分支 · 支线 7 → 9 · 第 4 个野外 NPC** | ✅ 2026-11-10 |
| **P10 招式重做（锤试点）：`pose` 字段 + 12 种动作 · 刀光 3 → 11 形 · 四种新原语（boomerang/shockwave/charge/cleave）· 锤 8 招按名字重写 · 签名查重断言** | ✅ 2026-11-11 |
| **P11 招式收口（其余七件）：56 招补齐四条签名 · 19 形 / 20 式 / 17 音 · 八兵器连拍 · 贯甲刺 → `cleave` · 跃棍 → `shockwave` · 欠账 7 → 0（arts.js 131 条）** | ✅ 2026-11-11 |
| **招式工作台**：单文件 HTML 编辑 64 招 · 30fps 时间轴 · PNG 序列帧 · 覆盖表白名单合并 · 试玩 / 导入 / 永久三通道 | ✅ 2026-11-11 |
| **单一分发地址**：`https://718997675.github.io/xiaoyaoxing/`（2026-11-11 起，workbuddy 旧分享链接弃用） | ✅ |
| **P12 前置 ①**：12 条任务补逐句交付对话（72 句 / 1739 字，村民 / 店铺双入口） | ✅ 2026-11-11 |
| **P12 前置 ②**：无面剑客三阶段换兵器（剑 / 枪 / 双刃，招式取 `arts.js` 色彩签名） | ✅ 2026-11-11 |
| **P12 前置 ③**：洞内火把会灭（油量 / 穿堂风 / 火鸦扇灭 / E 借火 / 灭后视距收窄） | ✅ 2026-11-11 |
| **P12-A 第二章地图南扩**：`MAPH` 104→144（南疆 / 江岸）、江水渡桥、4 营地 + 2 野外 NPC、第一章指纹不变 | ✅ 2026-11-11 |

### 招式工作台（2026-11-11）

完整使用说明在 `ART-WORKBENCH.md`。这里只留交接要点：

- **架构**：工作台 → `{version:1, arts}` 覆盖表 → `artoverrides.js` 启动时**原地**合并进
  `ARTS` → `game.js` 照常画。`arts.js` 一行没改，删掉覆盖表即回滚。
- **三个入口**：双击 `art-workbench.html` / 线上 `/art-workbench.html` / 游戏招式页
  「打开招式工作台」。`build.js` 会把工作台一起拷进 `dist/`，这样线上与游戏同源，
  「写入试玩」的 localStorage 才真能被游戏读到。
- **白名单**：`OVERRIDE_SAFE` 只放表现层与数值层；`id / fam / slot / prof` 在
  `cleanPack()` 就被剥掉，防止破坏专精解锁 / 装配页 / 存档。
- **改了 `arts.js` 必须重跑** `node tools/gen-artworkbench.js` 再 `node build.js`。
  生成器现在锚定招式顶层行取 `shape / color`，并用登记池逐项校验 ——
  早先一版把 `zone: { shape: 'circle' }` 当成招式形状，害 5 招下拉框空白。
- **基线不变**：默认覆盖表为空，`artTiming()` 对 64 招算出 0，既有 553 条回归一条没动。

### P11 发布验证（2026-11-11）

- **分发约定（用户 2026-11-11 定）**：只维护 GitHub Pages 一个地址；旧的 workbuddy
  分享链接不再更新、不再验证、不再修。README 的「在线试玩」已指向 Pages。
- commit `547bfde`（11 个文件）。远端 / 本地 SHA 一致：`547bfde6789996c27243791bacd873b65c4f89e8`。
- 线上 `dist/index.html` 与本地打包产物 **md5 一致**（`57f13fa9…`，1,987,692 字节）。
- `URL="https://718997675.github.io/xiaoyaoxing/" node tools/run.js online`：`ok=true`，
  22 条心法 / 12 主 / 10 辅、游方道人、`#ov` 1326×746 真有像素、控制台无错。
- 线上页面直接跑 `URL=... node tools/run.js eval tools/arts.js`：**131 条 `ok=true`**，
  法杖 2.41x / 满配 2.18x —— 说明线上确是 P11 版本，不是旧缓存。
- **坑：Pages 的 CDN 有缓存**。push 完立刻 `curl` 拿到的是 1,906,715 字节的旧包
  （`ART_SNDS` / `hitSnd` 都是 0 次），带 `?cb=<时间戳>` 再取才拿到新包。
  判断「线上是不是这一版」不能只看探针通过，要比对 **md5 或跑一遍带 P11 断言的自检**。

### 招式工作台发布验证（2026-11-11）

- commit `51504e9`（18 个文件）。GitHub Actions `Deploy to GitHub Pages` 跑完后，
  线上 `dist/index.html` 与本地 **md5 一致**（`d5a2109e…`，1,997,856 字节），
  线上 `art-workbench.html` 与本地一致（`b8b61794…`，53,843 字节）。
- `URL=... node tools/run.js online`：`ok=true`，`#ov` 1326×746 真有像素、控制台无错。
- 线上直接跑四套自检全绿：`tools/arts.js` 131 条、`tools/art-overrides.js` 29 条、
  `tools/art-workbench.js` 32 条、`tools/story.js` 96 条（`STORY=1`）。
- **坑：push 完 Pages 是排队的**。第一次 curl 拿到旧版（1,987,692 字节）且工作台页 404；
  查 `api.github.com/repos/718997675/xiaoyaoxing/actions/runs` 看到 `queued → in_progress →
  completed/success` 后再取才是新版。别在排队期间下"发布失败"的结论。

### P12 前置三项（2026-11-11）

按 §7 原清单收口三件小事。按用户要求，**招式工作台与「四轨道」保持现状不动**；
`art-motion-preview.html` 只是本地效果预估草稿，未提交 / 未打包 / 未发布。

1. **交付对话**：`quests.js` 12 条任务（3 主线 + 9 支线）每条新增 `turnIn: [{who, text}]`，
   共 72 句 / 1739 字；`outro` 不删，作为对话序列末句收束。`game.js` 新增
   `turnInLines()` / `beginTurnIn()` / `drawTurnIn()` / `advanceTurnIn()` / `endTurnIn()`，
   村民对话面板与店铺面板两处都能逐句播放；中途关窗清状态并恢复 NPC 名字；
   没写 `turnIn` 的老任务仍按原来一句 `outro` 收，向后兼容。
2. **无面剑客三阶段**：`monsters.js` 的 `wumian.skills` 拆成 `phases`（剑 / 枪 / 双刃
   三张招式表）；`wumianPhase()` 按 `hp/maxHp` 得 0/1/2，`bossSkillsOf()` 换表并作废
   旧冷却，`runBossSkills()` 改读当前表。每个 `sk.art` 指回 `arts.js` 的玩家招式，
   `bossArtColors()` 用 `artColor()` 给 `slam` / `fan` 染色 —— 终章「招式和你一模一样」
   从此有数据依据。旧 `skills === phases[0].skills`，兼容旧文档与旧自检。
   **没让首领调 `execArt()`**：那是玩家侧逻辑，会用玩家属性打玩家自己。
3. **洞内火把会灭**：`player.torch` 与每个火盆各有 `lit` / `fuel`；穿堂风（`dgGustT`）、
   油烧干、火鸦扑棱都会灭火；靠近火盆按 E 借火重燃；`collectLights()` 只收亮着的
   火盆，火把灭后可视半径从 112px 收窄到 26px 且整片洞更黑。第三幕「火把灭了三次」
   三次各有来源，第三次熄灭换一句台词。

**验收**：模块版 11 套 **644 PASS / 0 FAIL**；`devtest` 137→**148**（+11 洞火）、
`quests` 30→**38**（+8 交付对话）、`bosses` 23→**34**（+11 三阶段），其余 8 套条数不变，
既有 9 套 553→**583**。`逍遥行.html` / `dist/index.html` 两条单文件路径各跑
`quests` / `bosses` / `arts` / `art-overrides` 全绿，本地 `online` 探针 `ok=true`；
`expr` 确认 `torch` / `dgRelight` / `turnInLines` / `bossSkillsOf` / `phases=3` 都进了
bundle。重新打包后 `dist/index.html` md5 `472546a0…`（2,018,389 字节），
工作台页 md5 未变（`b8b61794…`）。

**发布验证（2026-11-11）**：
- commit `575fbbb`（12 个文件）。原生 `git push` 又被 `github.com:443` 挡住
  （`Recv failure: Connection was reset`），改走 `node dawn-s1/tools/push-api.js`，
  远端 / 本地 SHA 一致 `575fbbb6`。
- Actions `Deploy to GitHub Pages` 先 `waiting` 再 `completed/success`；排队期间 curl
  拿到的是上一版 `d5a2109e…`（1,997,856 字节）。部署完带 `?cb=` 重取：线上入口页
  md5 `472546a0…` / 2,018,389 字节，与本地 `dist/index.html` 逐字节一致；线上
  `art-workbench.html` md5 `b8b61794…` 与本地一致（工作台没被动过）。
- `URL=... node tools/run.js online`：`ok=true`，22 条心法 / 游方道人 /
  `#ov` 1326×746 真有像素、控制台无错。
- 线上直接跑六套自检全绿：`quests` 38、`bosses` 34、`arts` 131、
  `art-overrides` 29、`art-workbench` 32、`story` 96（`STORY=1`），全部 `ok=true`。
- 线上 `expr` 探针确认 `torch` / `dgRelight` / `turnInLines` / `bossSkillsOf` 都在，
  `phases=3`、12 条任务齐全 —— 三件新功能确是这一版，不是旧缓存。

### P12-A 第二章地图南扩（2026-11-11 完成）

**第二章此前没有施工图**：`CHAPTER-1-EXPANSION.md` §7 是第一章三区定案（方案 A），
`CHAPTER-1.md` §7 那份「第二章候选」是八兵器之前的旧稿。已在 `CHAPTER-1-EXPANSION.md`
补 §9 施工图并把第二章拆成 P12-A / B / C 三批，每批独立发布。

- **只加高不加宽**：`MAPW` 保持 144、`MAPH` 104→144，新增 `CH1_H = 104`。
  `tiles` 的 stride 不变，第一章所有格子下标、绝对坐标、存档 `x/y` 全部照旧，
  `SAVE_KEY` 不用升版本。改动前记录前 102 行 `tiles+solid` 指纹 `1093084102`，
  写成 `tools/map.js` 硬断言 —— 实测仍是 `1093084102`，逐格未变。
- **新区独立随机源 `rng2`**：第一章所有随机 y 范围锁回 `CH1_H`（数值与原来等价），
  `carveRoad` / `scatterOn` 加可选 `rand`，两个按 y 遍历的绘制循环用
  `PR = y < CH1_H ? rng : rng2`。第一章 `rng()` 次数与顺序一个没改。
- **底边与连通**：`y=102/103` 原样封回实心，只凿 x=34 / x=119 两个 5 格关口；
  两区各接一条官道 + 一条横向捷径，江水 7 格宽斜贯江岸，路穿江处换 tile 9 桥面。
  洪水填充连通率 **100%**（17440/17447）。
- **新区不是空地**：南疆瘴林（tile 11 赤土）/ 江岸渡口（tile 12 沙地 / tile 13 江水），
  4 个新营地（瘴林蛊寨 / 赤土墟 / 渡口棚 / 江匪坞，复用现有怪种与 AI）、
  2 个营地首领、2 位野外 NPC（蛊婆 / 周摆渡）。首领巢穴仍是 4 个，新区 Boss 留 P12-B。
- **断言口径**：`tools/map.js` 12→**19 条**（尺寸 / 指纹 / 两区底材 / 江水渡桥 /
  两个关口 / 原底边仍是边界 / 新区 4 营地可达 / 新区有人说话）；
  `tools/camps.js` 营地 12→16、首领 3→5、怪总数上限 100→130；
  「村庄在东南角」改按 `CH1_H` 判定（相对整张新图村庄会显得偏上，语义会错）。

**验收**：模块版 11 套 **651 PASS / 0 FAIL**（`map` 12→19，其余条数不变）；
`逍遥行.html` / `dist/index.html` 两条单文件路径共 11 套 eval 全绿；
重新打包后 `dist/index.html` md5 `ebc6e8d6…` / 2,025,300 字节，工作台页 md5 未变。
**发布验证**：待回填（提交 SHA / 线上 md5 / 线上自检条数）。

### 未完成（按顺序）

| 批次 | 内容 | 文档 |
|---|---|---|
| **P12-B** | 三幕新剧情 + 支线 9→15 + 新区首领与章尾 Boss（P12-A 地图已完成） | `CHAPTER-1-EXPANSION.md` §9 |
| **P12-C** | 兵器第 9/10 类（16 招）+ 逐招四签名 + 平衡复校；「8 类 / 64 招」硬编码回归面最大 | `CHAPTER-1-EXPANSION.md` §9 |
| — | 支线 9→15 与文本量加厚都并入 **P12-B**，不单独立批 | `SKILLS-STORY-PLAN.md` §4.2 |
| — | 文本量还差一截：设计目标 3~5 万字，剧情自检实测 **6259 字**（旧记 6108 已过时）；另新增任务交付对话 1739 字 / 72 句，不计入该统计口径 | — |

---

## 4. 文档索引

| 文档 | 讲什么 |
|---|---|
| `HANDOFF.md` | 就是这份。现状 + 怎么跑 + 下一步 |
| `CHAPTER-1-EXPANSION.md` | 第一章地图/营地/首领/NPC 扩容的施工图，含 P1~P4 施工单和技术坑 |
| `SKILLS-STORY-PLAN.md` | 武器技能 64 个 + 心法 22 条 + 剧情三幕的完整设计 |
| `ART-WORKBENCH.md` | 招式工作台：覆盖表协议、30fps 帧数、PNG 切片、三种导入方式与自检 |
| `ARTS-DESIGN.md` | 招式重做设计总纲（P10 锤试点 + P11 七件收口） |
| `README.md`（仓库根） | 项目简介与进度 |

**两份设计文档都是自包含的**：里面有需求原话、结论、数值表、数据结构、验收标准。
换账号之后只看文档就能接着写，不需要翻聊天记录。

---

## 5. 代码地图

```
dawn-s1/
├── game.js        ~7000 行，主逻辑。世界生成 / 战斗 / 掉落 / 存档 / HUD / 输入
├── weapons.js     八类兵器的挥砍参数（a0→a1 角度、hitArc、reach、lunge、弹道）
├── monsters.js    怪物与首领
├── items.js       装备生成与词条
├── skills.js      被动树（NODES）+ 气/舞/雷三个通用主动
├── arts.js        兵器招式（64 个，数据层）+ 专精曲线 + 平衡口径 artPower()
│                  + 签名推导 artShape()/artPose()/artColor()（运行时与自检共用）
├── mantras.js     心法（12 主 + 10 辅）+ 一主二辅装配 + 数值汇总，纯数据层
├── quests.js      任务定义表（12 条：3 主线 + 9 支线）+ 信物 + 纯函数
├── story.js       剧情节点（28 个）+ 地标（18）+ 线索（17）+ 旧物（10）+ 三层对话，纯数据层
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
    ├── camps.js   营地生态专项自检（巡逻 / 吹哨 / 食物链 / 作息）
    ├── bosses.js  首领与危险区自检
    ├── quests.js  任务线自检
    ├── arts.js    招式与专精自检
    ├── mantras.js 心法与 200 组组合的 DPS 分布
    ├── story.js   剧情（七种触发器 / 终章选择 / 三层对话 / 旧事页 / 存档不重播）
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
- **`PAGE=逍遥行.html node tools/run.js devtest` 会超时，不是回归失败。**
  `devtest.js` 是 `index.html` 在 `?dev=1` 时动态 `import('./devtest.js')` 加载的，
  它不在 `build.js` 的 `ORDER` 里 —— 单文件版没有这个模块，自然等不到 `#devout`。
  单文件版要用 `PAGE=... QS=x=1 node tools/run.js eval tools/xxx.js`。
- **`URL=` 打远程时也要补 `story=0`**（`tools/run.js` 已自动补）。线上裸地址会播序章，
  播放期间世界暂停，`URL=... eval tools/arts.js` 会出现 25 条伤害 / 持续类断言成片假红，
  而本地永远全绿 —— 因为本地 URL 一直自带这个参数。曾误判成"线上代码坏了"。

### 网络（发布时）

- 本机访问要 `--no-proxy-server --proxy-bypass-list=*`；
  访问**线上**不能加，会绕过网关会话 → 403。
- **`github.com:443` 会被干扰，`api.github.com` 却是通的**。表现是 `git push` 直接
  `Connection reset` / `Failed to connect to github.com:443`，但
  `curl https://api.github.com/rate_limit` 正常返回。这时候别反复重试，走 API：
  ```bash
  node dawn-s1/tools/push-api.js          # 把 HEAD 推到 origin，SHA 与本地逐字节一致
  node dawn-s1/tools/push-api.js --dry    # 只看要传什么
  node dawn-s1/tools/pull-api.js --dry    # 反向：远端比本地新时，看差了几个提交
  node dawn-s1/tools/pull-api.js          # 走 API 重建对象并 fast-forward（历史一条不丢）
  ```
  原理是 blob → tree → commit → ref 四步。**关键是 author / committer（含时区）
  和原始消息必须逐字节还原**，否则 GitHub 生成的是另一个提交：内容一样、SHA 不同，
  本地就多出一次 `reset --hard origin/main`。工具会把两个 SHA 打出来对比。
- **`git fetch` 会被同一处网络挡住**（`expected flush after ref listing` / 代理 502）。
  `pull-api.js` 是 `push-api.js` 的反向：沿父链找共同祖先，递归下载 blob / tree，
  用目标 SHA 反推原始提交字节（时区与消息尾部换行都要试），最后 `update-ref` + `reset --hard`。
  P11 用它把远端 7 个提交（P6~P10）拉回来，git log 历史完整。
  它只拒绝**已跟踪文件**的未提交改动，未跟踪的新工具不会误判成脏工作区。
- **2026-11-11 更新**：原生 `git push` 已恢复，P11 的 `547bfde` 是直接推成功的
  （`fa2dbb2..547bfde`）。上面这套 API 流程留作备用：先试 `git push`，不通再上 API。
- 注意 `~/.gitconfig` 里 `http.proxy` / `https.proxy` 是**空值**（显式置空，
  会盖掉环境变量里的代理），所以 git 一直是直连。直连不通时也别指望环境变量能救。
- `ssh.github.com:443` 的 TCP 是通的（能完成密钥交换，只是没配公钥）。
  真要长期解决，配一把 SSH key 走 443 比 API 稳。

### 打包（最坑的一条）

- **`build.js` 的 `ORDER` 是手写清单，漏一个模块不会报错**。module 版照样能跑，
  单文件版会在运行时 `Cannot destructure property 'X' of undefined` 直接白屏。
  `quests.js`（P4）和 `arts.js`（P5）都漏过，线上 `dist/index.html` 因此坏了两轮。
  现在 `build.js` 开头有 `verifyOrder()`：拿源码里的 `import ... from './x.js'`
  反查 ORDER，漏了直接 build 失败。
- **发布后一定要真的打开一次线上页面**，不能只 `grep` 关键字 —— 打包版白屏时，
  HTML 里的文案照样在，grep 全都能命中。
  现在有 `node tools/run.js online`（配 `URL=` 打远程），它会等 `__game` 就绪、
  查心法数 / 道人 / 画布有没有真的画出像素 / 控制台有没有报错。
- **验页面时别对 `#gl` 试 `getContext('2d')`**。页面有两块画布：`#gl` 是 webgl2
  （地面光照），`#ov` 才是 2d 覆盖层。对 `#gl` 请求 2d 会把它占成 2d 类型，
  three.js 随后报 `Canvas has an existing context of a different type` ——
  一条本来不存在的报错就这么被探针造出来，然后你会去查一个不存在的 bug。
  检查像素只读 `#ov`。
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

### 招式 P6 踩的

- **"加一招只写数据不改运行时"这句话在 P6 就不成立了**。设计表里的位移 / 增益 /
  地面区域 / 拉拽四类，硬塞进原来的六种原语只能变成换皮，于是新增了
  `dash` / `buff` / `zone` / `pull` 四种原语，`ART_FX` 变成 10 种。
  原语清单是**数据层与运行时的共同契约**：加原语时 `arts.js` 的 `ART_FX`
  与 `game.js` 的 `execArt()` 分支要一起改，只改一处的话自检会直接报"fx 未知"。
- **平衡口径必须只有一份**。文档里写"八招全开不超过普攻 2.8 倍"，自检脚本里
  再写一份公式，迟早会漂。现在口径是 `arts.js` 的 `artPower(a)`，
  文档与 `tools/arts.js` 都调它。
- **`status.pct` 只有 DoT（流血 / 灼烧 / 中毒）能折进总倍率**。减速的 pct 是降速比例、
  定身的 pct 是时长、破甲的 pct 是破防比例 —— 折进去会算出假账
  （断筋一度被算成 15 倍伤害）。
- **地面区域 / 陷阱的伤害走 `dealDot`，不走 `hitEnemy`**。每 0.4 秒走一次顿帧、连击、
  火花、击退，站在火雨里的怪会让整块屏幕抖个不停（DoT 当初就是这么改的）。
- **多分片区域的伤害要摊到每个分片上**。地裂是 4 片，不摊开就是 4 倍伤害；
  摊开之后总伤才等于 `mul × tick 数`。
- **装配槽 6 个、可学的招 8 个** —— 槽满时不能"悄悄顶掉第 0 格"。
  现在的模型是"先点上方格子选中它（红框），再点下方招式装进去"；
  没选格子且六格全满时给出提示而不是替玩家做决定。
- **`autoLoadout()` 会把玩家手动卸下的招补回来**。专精升级会调它，于是
  "手动卸下一招"在下一级又被塞回去。用 `player.loadoutManual` 标记玩家动过装配格，
  动过之后就不再自动补位（这个标记要跟着存档走）。
- **自检里取伤害基线必须在施法之前**。近战 / 位移 / 拉拽是瞬间结算的，
  基线放到施法后取，量出来永远是 0（"这一招没打中人"）。

### 招式 P10 踩的（重做锤那八招）

- **"招式千篇一律"不是数值问题，是三层表现被依次抹掉了。** 诊断见
  `ARTS-DESIGN.md` §0：64 招 → 12 种原语 → **3 种刀光形状** → **2 种身体动作**。
  最后那层是 `execArt()` 里写死的一句 `sw: { a0: 0, a1: 0 }` —— `ang` 恒等于 `base`，
  54 招的武器**全程一动不动**，比普攻（每兵器三段、各有 a0/a1/lunge）还单调。
  实测 17 招与同兵器另一招的视觉签名完全一致。
- **签名必须能自动断言，否则下一个 64 招还会退回同一个坑。** 现在
  `tools/arts.js` §1.1 把 `(shape, pose.mode, color)` 拼成字符串查重，
  §1.2 再按"施法后 0.15 息的武器角度"查一遍。两条都是**在数据层判**，
  不靠人眼看截图。撞车的兵器数写成了欠账数（P10 做完锤时是 7，P11 七件收口后是 **0**）。
  P11 又把 §1.1 从三签名查重扩到五字段（形状 / 动作 / 色彩 / 起手音 / 命中音）八招八样，
  §1.2 从「只查锤」扩到八件兵器；56 招一次推完，没有再留欠账。
- **推导函数只写一份。** `artShape()` / `artPose()` / `artColor()` 放在 `arts.js`，
  `game.js` 的 `artSwingFx()` 和 `tools/arts.js` 都调它。和 `artPower()` 同一个道理：
  两边各写一份，迟早在"某招到底算 ring 还是 arc"上漂开。
- **角度要按"固定时刻"量，不能按"进度百分比"量。** 按百分比量的话，
  「震地」（0.42 息）和「开天辟地」（0.62 息）在 50% 处会算出几乎同一个角度
  （−1.916 vs −1.959），而它们在画面上明明是"砸一下"和"蓄半息再劈"。
  按 0.15 息量就分开了：−132° vs −147°，起手慢的那招那时才刚抬起来。
- **`charge` 停下来的判据是"身体碰上"（12 + 目标体型），不是"进入伤害半径"。**
  按伤害半径 30 算的话，离着 30px 就停了，人还没碰到对方 —— 自检里量出来
  位移只有 7px。改成接触判据之后是 15.8px。
- **`charge` 的自检不能写死"朝右冲"。** 营地圆心常压着篝火 / 石台，
  朝右 7px 就是实心，冲锋第一步就被地形卡住、位移 0。
  自检要先探一个"身前 20px 和 84px 都站得住"的方向再摆木桩。
- **`zone` / `buff` 分支原来根本不调 `artSwingFx()`。** 于是给地裂配的
  `shape: 'crack'` 一条裂缝都不画（自检全绿，因为刀光本来就不参与判定）。
  **凡是给某类原语新加了表现字段，都要回头确认那个分支真的去画了。**
- **`hitstop` 期间 `update()` 提前返回，`updateArts()` 也不跑。**
  震地施法时给 0.10 息顿帧，冲击波就晚 0.1 息才开始扩 ——
  自检里"近处先挨、远处晚半拍"的时序要按这个补偿（`step(14)` 而不是 `step(7)`）。
- **飞出去的东西在 WebGL 层，不在 2D 覆盖层。** 截图对照表只截 `#ov` 的话，
  回旋锤那格会是空的（锤是 `quad()` 加到 three.js 场景里的）。
  想要"看得见锤在飞"，要么截整页，要么在覆盖层上补一条轨迹 ——
  现在 `updateBoomerangs()` 每 40ms 留一个尘点，就是为了这个。

### 心法 / 平衡（P5.5 踩的，P6 又调了一条）

- **命中本身回 3 点真气**。焚心写"每次攻击 -2 真气"时，净效果是 **+1** —— 代价凭空消失。
  写成 -5 才是净 -2。任何"每次攻击消耗 X"的设计，都要先减掉命中回复再定 X。
- **P6 改了焚心的收气口径：从"按命中"改成"按挥击"**。六招同开之后，招式的多段命中
  把按命中收的气放大到把整池真气抽干 —— 实测"焚心 + 六招满配"的 DPS 只有裸装的
  **33%**（招式根本放不出来，只剩普攻在砍），心法自检里"没有组合比裸装弱一半以上"
  直接挂掉。现在一次普攻挥击只收一次气（挥击编号 `player.mFxSeq`，
  招式命中不带这个编号），代价仍是"吃真气"（命中回 3、净 -2），
  但不再跟招式抢气：焚心 + 六招满配的 DPS 回到裸装的 **97%**。
  **教训：按次数收的代价，要先确认"次数"是被玩家选择的还是被构筑放大的。**
  P5 的时候命中次数少，按命中收没问题；P6 的多段招式把命中次数放大了三倍。
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

### 剧情 P7 踩的

- **剧情一播世界就暂停，而所有回归套件都靠 `tick()` 手动步进世界。**
  第一次接进去，`devtest` 直接超时 —— `#devout` 是 `runDevTests()` 最后一行才创建的，
  测试在中途就抛了，于是连结果框都没有。失败现象是"测试没跑"，不是"某条断言失败"。
  解法是 `?story=0` 关掉自动播放，`tools/run.js` 默认给每个 URL 都加上，
  只有 `tools/story.js` 用 `STORY=1` 打开。**凡是有"全局暂停"的机制，都要给测试留一个开关。**
- **两个元素用了同一个 `id="storyPage"`**：剧情覆盖层的章节小字和行囊里的「旧事」页容器。
  `getElementById` 只返回先出现的那个，表现是覆盖层里显示整页剧情日志、旧事页永远空白，
  而 `#story .sPage` 的样式一条都没生效（id 选择器命中了另一个元素）。
  `tools/story.js` 现在有一条断言遍历所有 `[id]` 查重 —— 这类错看截图发现不了。
- **剧情触发别做成 `talk`。** 对话面板那一个点击位已经给了"接任务 / 复命 / 打听 / 作别"，
  再塞剧情进去，玩家点一下永远猜不到会发生什么。剧情统一走"条件满足自动播"，
  **一个点击位只做一件事**。
- **环境文本不能用飘字。** `msg()` 只有 2.4 秒，碑文两行还没读完就没了。
  碑文走同一个剧情覆盖层（`storyShow()` 直接吃一个临时节点），
  所以"读一段字"这件事只有一套界面。
- **旧事页的条目摘要要取最长那句，不能取第一句。** 序章第一句是「……」，
  拿它当摘要等于每条都写着省略号。
- **`build.js` 的 `ORDER` 必须加 `story.js`。** 这个漏加过一次（P4 的 `quests.js`），
  表现是 module 版全绿、单文件版白屏。`verifyOrder()` 现在会拿 import 反查并直接让 build 失败。

### 剧情 P8 踩的

- **`kill` 触发器的 `lord` 键不是显示名，是 `e.type`。** `bossKills` 的键由
  `killEnemy()` 写死成 `e.type`（守墓人是 `yinhun`），所以 `{type:'kill', lord:'守墓人'}`
  永远判不成真。写 `lord:'yinhun'` 能命中，但日志页会写着「斩「yinhun」」——
  那是给代码看的字。现在 `trigger` 多一个 `label`，`storyHint()` 优先用它。
- **`kill` 节点必须有 `need`。** 没有前置的 kill 节点会在玩家第一次撞见那只怪时就播，
  那时他还没见过坟、没看过图纸，整段字白写。`tools/story.js` 现在有断言盯着这条。
- **自检里"每个节点都能播"这条断言原来没有 `kill` 分支。** P7 的节点表里一个 kill 都没有，
  那条分支从来没跑过 —— 一加节点立刻三条 FAIL。**给框架补能力时，顺手把自检的
  分支也补齐**，否则"覆盖了六种触发器"只是名义上的。
- **同一个 `enter` 地标不能挂两个节点。** 玩家站着不动，第一帧播完第一个，下一帧
  第二个也满足，于是连着播两段。要分段就用不同的地标，或者挂到 `kill` / `item` 上。
- **线索从 6 条涨到 11 条之后，`flex` 横排会把每格压到 60px 以下**，
  「木牌 · 第一道纹」直接变成竖排。改成 `grid-template-columns:repeat(4,1fr)`。
  **凡是"横排 N 格"的布局，都要先问一句 N 会不会涨。**
- **地标坐标不能只看"叙事上在哪"，要先探地形。** 坟地/竹海的可站点是稀疏的，
  凭感觉写十个坐标有六个站不住。探法是 `expr` 扫一片区域收 `canStand` 为真的点，
  再按"离已有 POI 最远"排序挑（`tools/run.js expr` 一行就能跑）。
  竹桥那三个点更特殊 —— 桥面是 `tile===9`，扫一遍 `tiles` 里值为 9 的格子才是真桥。

### 剧情 P9 踩的

- **`storyChoice` 指向的是 `STORY` 表里那个对象本身。** 往它上面写一个 `picked` 字段
  记"已经选过了"，等于把这件事永久刻进剧情数据 —— 第二周目再播到这一屏，
  两个按钮都是死的，点哪个都没反应。而且**第一次跑永远是绿的**，只有跑第二遍才现形
  （`tools/story.js` 里"两条分支都走一遍"的写法当场把它逮住了）。
  现在这个状态放在模块级变量 `storyChoicePicked` 上。
  **凡是"从数据表里取出来的对象"，都不能往上写运行时状态。**
- **`storyEnd()` 原来无条件关窗 + 写 `readLog`。** 加选择必须岔在写 `readLog` 之前，
  否则"还没选就算读过了"，读档回来这一屏永远不会再出现 —— 玩家的第一章就这么没了结尾。
  现在是：有 `choice` 且还没问过 → 先 `storyAskChoice()` 并 `return`，不关窗、不记账。
- **选择屏要同时收掉圆点和"点击 / 空格 · 继续"。** 留着提示但点不动，
  玩家会以为卡住了；留着圆点，他会以为还有下一句在等。这一屏只有一个正确的操作。
- **220ms 的压印停顿会让自检被迫真等。** 每验一次终章就多 220ms，一条套件里
  有好几处。解法是把待执行的转场存成 `storyChoiceNext`，另导出 `storyPickGo()`
  让自检同步跳过它。**凡是给玩家看的"停顿"，都要留一条给测试直接跨过去的路。**
- **`floor` 触发器必须是 `≥ N`，而且"不在洞里时算 0"。** `dgFloor` 是全局变量，
  离开古洞不会归零 —— 直接用 `ctx.floor = dgFloor` 的话，玩家回到村里，
  终章那两节仍会在村口播。`storyCtx()` 里是
  `floor: dgIn(player.x, player.y) ? dgFloor : 0`。
  另外用 `≥` 而不是 `=`：从三层回一层，二层那段不该重播。
- **新地标光验 `canStand` 不够，要洪水填充验连通。** 石窟那片岩体撒得密，
  探出来"站得住"的点有一半被岩层隔在外面，走过去根本到不了（`reach` 目标会永远完不成）。
  正确顺序是：`canStand` 筛一遍 → 从矿口做一次 BFS → 只在连通集里挑。
  「打通的侧壁」那个点（824,496）就是这么定下来的，它正对古洞西壁（x 912）。
- **一整幕没有活人说话，玩家是察觉得到的。** 第三幕原本 7 个节点全是旁白 ——
  设计上说得通（洞里没人），玩起来是"在石窟待二十分钟，没有一个人跟我说话"。
  补了 `w_miner`（老矿工，站在营地火边）之后这一幕才有"人"。
  `tools/story.js` 现在有断言盯着"每一幕至少有一个有名有姓的说话人"。
- **新 NPC 的站位要落在同一段剧情的 POI 半径里。** 他离营地圆心 32px、营地 r=95：
  玩家走到营地自动播剧情，播完原地按 E 就能跟他说话。
  放到半径外面的话，玩家得先看完剧情、再走一段、再按 E —— 中间那几步会把人劝退。

### 招式装配页重做（同一批，踩的）

- **`elementFromPoint` 在布局没落定时会返回 null。** 拖拽落点一开始只靠它，
  自检里就变成了"有时能拖进去、有时不能"的随机 FAIL —— 面板刚从 `hidden` 恢复、
  样式还没算完的那一帧，它什么也找不到。现在 `artSlotAt()` 先按元素命中，
  再按矩形兜底扫一遍六个格子。**凡是用 `elementFromPoint` 的地方都要想一遍
  "布局脏的时候它返回什么"。**
- **`pointerdown` 里不能 `preventDefault()`。** 一 preventDefault 浏览器就不滚了，
  招式库在手机上直接滚不动。触屏还要再叠一条：长按 150ms 才进入拖拽，
  否则手指落在卡片上往下划，本意是滚列表，却被当成拖拽。鼠标没这个歧义，按下即可拖。
- **自检里测拖拽必须派发真的 pointer 事件**，只验 `artPlace()` 等于没验 ——
  断的往往就是事件那一层（阈值、capture、落点判定）。用真实
  `getBoundingClientRect()` 取坐标，按 `pointerdown → move → move → up` 走一遍，
  顺带断言"拖拽中高亮""结束后高亮清掉""幽灵被回收"。
- **状态标记要按"格号"显示，不要按布尔。** 已装的招式在右栏显示"壹/贰/叁"，
  玩家能立刻对上左栏；只显示一个"已装"的话，想知道它在第几格还得回头数。
- **两列网格里，只有一个条目的分组要占满整行**（`.artGrid.single`），
  否则右半行空着，像少画了一张卡。
- **面板标题和页签写同一件事就该删掉一个。** `#skills` 的 `h1` 原来写着"道行 / 招式"，
  页签也写着"道行 / 招式"，招式页里还有一枚朱红印章 —— 三层重复。
  现在 `h1` 整个去掉，省下的高度给了招式库。

---

## 7. 下次开工的第一件事

**第一章的故事讲完了。** P1~P9 之后，从破庙醒来到碑前做选择，整条线是通的：

- 地图 144×104，四区地貌，12 营地 + 4 巢穴，路网与溪涧竹桥
- 怪会巡逻、吹哨叫援、追猎物、按时辰睡觉；8 个首领各有一套招式表
- **12 条任务**（3 主线 + 9 支线，其中 1 条跨区）全部可完成，三物齐了才开古洞封碑
- **64 个兵器招式**：八兵器各 8 个，**十四种效果原语**，专精 0→10 解锁（1/2/3/4/5/6/8/10）
- **每招有自己的形状 / 动作 / 颜色 / 声音**（P10 起，P11 收口）：64 招全带 `pose`
  （20 种动作）+ 19 形刀光 + 逐招配色 + 逐招起手音 / 命中音，同兵器内五个字段八招八样，
  声音对也不重复，自检自动查；八兵器同位置连拍最紧的一对也差 8.5°
- **六槽装配**：八招可学、六招上阵，装配页是「剑匣 + 招式谱」两栏 + 拖拽，一步到位
- **状态系统**：流血 / 灼烧 / 中毒 / 冻结 / 眩晕 / 减速 / 破甲 / 击飞，DoT 不走 `hitEnemy`
- **22 条心法**：12 主 + 10 辅，一主二辅互斥，540 种组合，P95/P50 实测 1.24
- **五个机制钩子**：`fullHpBonus` / `chainBonus` / `idleStack` / `qiOnHurt` / `critResetCd`，
  全部折进 `hitEnemy` / `hurtPlayer` / `update` 三条路径，没有另起一套战斗逻辑
- **28 个剧情节点**：序章 3 + 第一幕 6 + 第二幕 7 + 第三幕 7 + 终章 5，**七种触发器**，
  剧情覆盖层 + 旧事页 + 三层对话 + 终章两分支
- **三物线索链**：17 条线索，木牌三道纹依次点亮，每道纹指出下一件在哪，不靠任务列表导航
- **三幕正文**：坟地（新土 → 空棺 → 没有脸的守墓人 → 树心）、竹海（别应 / 七个土包 /
  削断的桥）、石窟（外面天亮没有 / 它没站起来过 / 它撞的是火 / 从对面凿过来），
  三处剑痕 + 一条凿痕的暗线全部收口
- **终章**：无面剑客（招式和你一模一样）→ 记忆碎片 → 「记起来 / 放下」，
  两条结局各有一段旁白，旧事页会记下你选了哪条

**P9 做完后的现状**：`tools/story.js` 96 pass / 0 fail（P8 是 62）。
**终章的选择是 P7 以来第一次真的动了运行时** —— `onEnd.choice`、`storyAskChoice()`、
`storyChoose()`、`storyPickGo()`，以及第 7 种触发器 `floor`。

**P10 做完了锤这一件**：`tools/arts.js` 89 → 111 pass / 0 fail。
`execArt()` 不再写死 `a0: 0, a1: 0`，而是读招式自己的 `pose`；刀光从 3 形扩到 11 形；
新增 `boomerang` / `shockwave` / `charge` / `cleave` 四种原语和 `quake` / `boomerang` 两个音效。
锤的八招现在是八种形状、八种动作、八种颜色（`ARTS-DESIGN.md` §4 那张表）。
**P11 把剩下七件一次推完了**：56 招补齐四条签名，19 种刀光 / 20 种动作 / 17 个音效，
`tools/arts.js` 111 → 131 条断言，签名撞车欠账数 7 → **0**，八兵器连拍最紧的一对也差 8.5°。
两条名实不符的招换了原语：「贯甲刺」用 `cleave`（真贯穿）、「跃棍」用 `shockwave`
（有波前 + 落点中心 1.5 倍）。`mul` / `cd` / `cost` 一个没动，平衡仍是法杖 2.41x ≤ 2.8。
逐招画面与四个坑见 `ARTS-DESIGN.md` §7 / §8。

**下一步（P12）**：第二章施工图见 `CHAPTER-1-EXPANSION.md` **§9**（旧版指向的
第 7 节其实是第一章三区定案，已修正）。三件前置项与 **P12-A 地图南扩**都已在
2026-11-11 收口，见 §3。剩下 **P12-B**（三幕新剧情 / 支线 9→15 / 新区首领）
与 **P12-C**（兵器第 9/10 类 / 平衡复校），按 §9 的分批顺序推进，每批独立发版。

> 用户 2026-11-11 定：招式工作台的「四轨道」（判定帧 / 人物动作帧 / 运动轨 / 瞬移）
> 暂缓，工作台保持现状；`art-motion-preview.html` 只是本地效果预估草稿，
> 未提交 / 未打包 / 未发布。要做时先看那份草稿与成本量化，别直接动 `artoverrides.js`。

**动手前先读**：
- `CHAPTER-1-EXPANSION.md` §9（第二章施工图：分批 / 兼容策略 / 成本量化）
- `ARTS-DESIGN.md`（招式重做总纲：四条硬规矩 / 锤八招 / 七件兵器逐招画面 §7 / P11 验收与坑 §8）
- `SKILLS-STORY-PLAN.md` §四（三幕结构与每幕的交付物）、§4.7（P7）、§4.8（P8）、§4.9（P9）
- `SKILLS-STORY-PLAN.md` §2.6（P5）、§2.7（P6：64 招清单与平衡实测）

**四个命名提醒**：
- `game.js` 里 `skills` 已经被"气/舞/雷"三个通用主动占用了。
- 兵器招式叫 `arts`（`arts.js` / `player.loadout` / `artCds`）。
- 心法叫 `mantra`（`mantras.js` / `player.mantras` / `player.mantrasOwned`）。
  三层成长刻意分了三套命名，别再往 `skills` 上叠第四个。
- 剧情叫 `story`（`story.js` / `player.flags` / `player.readLog` / `player.clues` /
  `player.choices`）。**`flags` 是"玩家经历过什么"，不是任务进度** ——
  别拿它当 quests 的第二份状态；`choices` 也只记"分岔选了哪条"，不参与任何判定。

**还有一个已知的小噪音**：`STORY=1` 跑 `tools/story.js` 时，页面加载阶段的
`devtest` 会抛一条 `Cannot read properties of null (reading 'click')` ——
因为序章自动播了，世界暂停，`devtest` 里"走近说书人按 E"那一步开不了对话。
**这条不影响剧情自检本身**（96 条全绿），默认的 `node tools/run.js devtest` 也照旧
137 pass。它只是两个套件不能同时开着跑。
