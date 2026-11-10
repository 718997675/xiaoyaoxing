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
node tools/run.js shot out.png 1440 900   # 截图
```

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
| 双渠道发布（GitHub Pages + workbuddy） | ✅ |

### 未完成（按顺序）

| 批次 | 内容 | 文档 |
|---|---|---|
| **P2** | 营地生态：巡逻 / 吹哨警戒 / 食物链 / 昼夜阵容 | `CHAPTER-1-EXPANSION.md` §4 · P2 |
| **P3** | 首领 3 → 8（青鳞蟒 / 机关傀儡 / 石母 / 火鸦王 / 无面剑客） | 同上 |
| **P4** | NPC 与任务：店主 5→9、街面 8→16、任务系统从零建、10 条任务 | 同上 |
| **P5** | 技能框架 + 兵器专精 + 16 个技能 | `SKILLS-STORY-PLAN.md` §二 |
| **P5.5** | 心法系统（22 条 + 一主二辅 + 心法页 UI） | `SKILLS-STORY-PLAN.md` §三 |
| **P6** | 补齐剩余 48 个技能 + 装配 UI | 同上 |
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
├── skills.js      被动树（NODES）
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

---

## 7. 下次开工的第一件事

按 `CHAPTER-1-EXPANSION.md` §4 的 **P2 营地生态** 往下做。P1 已经把地基铺好了：

- 12 个营地已经在 `game.js` 的 `camps` 数组里，带 `name` / `tier` / `types`
- 每个营地脚下都是空的、可达的（`tools/map.js` 已验证）
- 营地空地在地面图上已经画好了踩秃的土圈

P2 要加的是"活起来"的部分：巡逻路线、发现玩家后吹哨叫援、怪之间的食物链、昼夜换阵容。
具体施工单在 `CHAPTER-1-EXPANSION.md` §4 · P2。
