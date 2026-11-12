# 招式工作台 · 使用说明

> 一句话：**别再手改 `arts.js` 里那 600 行招式表了。**
> 在工作台里挑一招、拖帧数、换刀光形状 / 动作 / 配色 / 音效，导出一个覆盖表，
> 游戏启动时自动盖在 80 招基线上。删掉覆盖表就回到原样，回滚零成本。

---

## 1. 打开它

| 场景 | 地址 |
|---|---|
| 本机开发 | 直接双击 `dawn-s1/art-workbench.html`（零依赖、零服务，`file://` 可用） |
| 本地服务 | `http://127.0.0.1:8124/art-workbench.html` |
| 线上 | `https://718997675.github.io/xiaoyaoxing/art-workbench.html` |
| 游戏内 | 行囊 → 招式页 → 顶部「打开招式工作台」 |

工作台是独立单文件 HTML，80 招基线（十类兵器各 8 招）/ 80 个刀光形状名 /
80 个身体动作名 / 80 个音效名 / 24 色锁定板（页面里 20 色），
以及 `shapeSpecs`（61 条）/ `poseSpecs`（60 条）两张规格表全部内联，
不 import 任何 ESM，所以双击就能开。

> **P12-D 起，基线多一个「几何变体 shv」**：刀光几何靠 `shv`（1~9）拉开
> —— 半径 / 长度 / 线宽 / 扫角按级差缩放。属性面板里可以直接改，预览画布用的尺子
> 与游戏里完全一致，导出覆盖表时 `shv` 会一起带走。
>
> **P12-E 起，四个下拉框各有 80 个互不相同的值**：`shape` / `pose.mode` /
> `snd` / `hitSnd` 字段本身全表零重复。新名字不是新实现 —— 61 个新刀光共用
> 16 类画法原子（`shapeSpecs` 给参数）、60 个新动作共用 16 类运动原子
> （`poseSpecs` 给参数）、80 个音效名是 16 个音色原型 × 5 档。
> 工作台的 `drawSpec()` 与 `weaponAng()` 读的就是这两张表，`ease()` 也与
> `game.js` 同一套曲线，所以预览里看到的和游戏里放出来的是一回事，不是第二套实现。
>
> 生成器内联基线时**两种口径都当场卡死**：四条表现实例签名
> （`shape@shv` / 动作全参数 / 色彩对 / 声音对）各 80/80，
> 以及四个字段本身各 80/80。改了 `arts.js` 忘了重跑，发不了版。

---

## 2. 界面

三栏：**左** 80 招列表（按兵器分组，可搜名字或 id）、**中** 逐帧预览画布 + 时间轴、
**右** 这一招的属性面板。

顶栏按钮：

| 按钮 | 作用 |
|---|---|
| 播放 / 下一帧 / 回到第 0 帧 / 速度 | 按 30fps 播放当前招式的时间轴 |
| 导入 PNG 素材 | 选一张序列图，按「列 × 行」自动切片成帧 |
| 下载覆盖表 JSON | 导出 `{version:1, arts}` —— 给游戏招式页导入用 |
| 下载 art-overrides.data.js | 导出可直接放进仓库的赋值语句 —— 永久生效用 |
| 写入试玩 | 写同源 `localStorage`，刷新游戏页即生效 |
| 复制导入码 | 把覆盖表 JSON 复制到剪贴板 |
| 导入草稿 JSON | 把之前导出的 JSON 读回工作台，接着改 |
| 清空草稿 | 清掉浏览器里的本地草稿（已下载的文件不受影响） |

草稿自动存在 `localStorage['xy_art_workbench_draft_v1']`，关掉页面再回来还在。

---

## 3. 时间轴（30fps）

一招分六段，全部填**帧数**，不是秒：

| 字段 | 含义 |
|---|---|
| `total` | 总帧数；`pose.dur` 会跟着它走（`total / 30` 秒） |
| `windup` | 起手到第几帧 |
| `hit` | 命中判定在第几帧（预览里画红圈） |
| `fxStart` | 刀光从第几帧开始亮 |
| `fxLen` | 刀光亮几帧 |
| `recover` | 收招几帧 |

导出时会同时写 `timeline`（原始帧数）和 `fxDelay = fxStart / fps`、`fxLife = fxLen / fps`（秒）。
游戏侧 `artTiming(a)` 把秒数加给 `slashGhosts` 的 `delay` / `max`，
于是「刀光何时出现、亮多久」真的由帧数决定，而不是只写在数据里好看。

**基线 80 招没有 `timeline`**，`artTiming()` 算出来全是 0 —— 不导入覆盖表时，
游戏表现一个字节都不变。

---

## 4. 导入素材

### 内置库（不用导任何东西）

属性面板里直接换：刀光形状（80 个名字）、身体动作（80 式）、
起手音 / 命中音（各 80 个名字）、几何变体 `shv`、主色 / 副色（点色板或取色器）、
以及 `mul` / `cd` / `cost` / `reach` 四个数值。
这些走的是游戏里本来就有的程序化画法：19 个老形状直接画，61 个新形状经
`drawSpec()` 用 16 类原子 + `shapeSpecs` 参数画；动作同理走 `poseSpecs`。
改完立刻能在预览里看到。

> **换名字时的两条约束**：① 覆盖表只能覆盖表现层字段，四个下拉框的值必须落在
> `wbBase` 的三张池里，否则游戏侧会掉进兜底分支；② 基线 80 招的四个字段已经
> 各自用满 80 个值，若把两招改成同一个名字，生成器与 `tools/arts.js` §1.5
> 的字面零重复断言会立刻报错 —— 要换就先扩池，别从已有招里借。

### PNG 序列帧

点「导入 PNG 素材」，选一张把帧排成网格的图（例如 4 列 × 2 行 = 8 帧），
在属性面板填「切片列/行」，点「重切」。工作台按 `列 × 行` 切成 dataURL 数组，
预览和游戏都会按刀光淡出进度逐帧播放。还能调「缩放」和「跟随武器角度旋转」。

游戏侧 `artFrames(a)` 把 dataURL 转 `Image` 数组并缓存；`drawOverlay()` 的
`slashGhosts` 循环里有一条 `g.frames` 分支负责 `drawImage`，
只有 `im.complete && im.naturalWidth` 才画，图没解好就跳过，不会白屏。

> 序列图别太大：帧以 dataURL 存进 localStorage 草稿，一张几 MB 的图会顶到浏览器配额。
> 素材多的话，改完一招就「下载覆盖表 JSON」存盘，别指望草稿一直装得下。

---

## 5. 设计结果怎么进游戏

### 方式 A · 试玩（最快，要同源）

工作台点「写入试玩」→ 刷新游戏页 → 生效。

**同源要求**：`localStorage` 按源隔离。线上工作台和线上游戏都在
`https://718997675.github.io`，所以线上这条最顺；本地双击 `file://` 打开的页面
与 `http://` 起的游戏不是同一个源，这时请用方式 B。

游戏招式页有「清除试玩覆盖」，清完自动刷新回基线（仓库里的 data.js 覆盖仍然有效）。

### 方式 B · 导入文件（推荐，跨源也能用）

1. 工作台「下载覆盖表 JSON」；
2. 游戏 → 行囊 → 招式页 → 「导入工作台覆盖表」→ 选那个 `.json`；
3. 页面自动刷新，覆盖生效。

### 方式 C · 永久写进仓库

1. 工作台「下载 art-overrides.data.js」；
2. 覆盖 `dawn-s1/art-overrides.data.js`；
3. `cd dawn-s1 && node build.js`；
4. 提交 `dist/` 并推送，GitHub Pages 自动发布。

`build.js` 会把这个文件内联进 `dist/index.html`（发布目录只有整页一次请求，
留着 `<script src=...>` 就是一条 404）。

---

## 6. 覆盖表协议

```json
{
  "version": 1,
  "arts": {
    "sword_1": {
      "shape": "ring",
      "mul": 9.9,
      "timeline": { "fps": 30, "total": 30, "windup": 2, "hit": 3,
                    "fxStart": 6, "fxLen": 9, "recover": 3 },
      "fxDelay": 0.2,
      "fxLife": 0.3,
      "frames": ["data:image/png;base64,..."],
      "frameScale": 1.5,
      "frameRotate": true
    }
  }
}
```

- **按招式 id 存**，只写改过的字段。没有的字段继续用 `arts.js` 的基线值。
- **白名单硬规矩**（`artoverrides.js` 的 `OVERRIDE_SAFE`）：只能覆盖表现层与数值层
  —— `name / desc / cd / cost / mul / reach / arc / radius / len / width / kb /
  pierceDef / status / fx / color / shape / shv / pose / snd / hitSnd /
  fxDelay / fxLife / timeline / frames / frameScale / frameRotate`。
  `id / fam / slot / prof` 等结构字段**不许覆盖**，否则会破坏专精解锁、装配页和存档。
  导入时会先过 `cleanPack()` 把这些字段剥掉。
- **两个来源，后者优先**：
  1. `window.__ART_OVERRIDES_FILE__`（`art-overrides.data.js`，仓库 / 永久）；
  2. `localStorage['xy_art_overrides_v1']`（试玩）。
- `applyArtOverrides(ARTS)` **原地改字段**，不替换 `ARTS` 对象 —— `game.js` 里
  多处持有它的引用，换对象会出现「面板显示是新值、打出去还是旧值」。

### 回滚

| 想回滚什么 | 怎么做 |
|---|---|
| 试玩覆盖 | 招式页「清除试玩覆盖」 |
| 仓库里的永久覆盖 | 把 `art-overrides.data.js` 改回 `{ version: 1, arts: {} }`，重新 `node build.js` |
| 工作台草稿 | 工作台「清空草稿」 |

---

## 7. 改了 `arts.js` 之后

工作台的基线是生成出来的，不会自动跟着 `arts.js` 变：

```bash
cd dawn-s1
node tools/gen-artworkbench.js   # 重新内联 80 招 / 三张池 / 两张规格表 / 调色板
                                 # P12-C 起 FAM_IDS / famLabel 含链 / 扇，
                                 # P12-E 起 shapeSpecs / poseSpecs 一起内联
                                 # 改了 arts.js 必须先跑它，再跑 build.js
node build.js                    # 把新工作台和覆盖数据打进 dist/
```

生成器会逐项校验解析结果落在 `ART_SHAPES / ART_POSES / ART_SNDS / ART_FX` 登记池里，
对不上就直接报错；还会**同时**校验两种零重复口径：
四个字段本身各 80/80（`shape` / `pose.mode` / `snd` / `hitSnd`），
以及 P12-D 的四条表现实例签名各 80/80（`shape@shv` / 动作全参数 / 色彩对 / 声音对）。
另会检查 61 条 `ART_SHAPE_SPECS`、60 条 `ART_POSE_SPECS` 解析齐全，
每招的形状 / 动作都有对应规格，不会掉进兜底分支。
这是有原因的：早先一版用宽泛正则匹配 `shape`，
把 `zone: { ..., shape: 'circle' }`（地面区域几何）当成了招式的刀光形状，
`spear_6` 等 5 招在工作台里显示成空下拉框。现在 `shape / color` 只从
「招式顶层那一行」取：

```js
/^ {4}shape:\s*['"](\w+)['"],\s*color:\s*\[([^\]]+)\]/m
```

---

## 8. 自检

```bash
cd dawn-s1

# 工作台页（43 条）：基线数据 / 规格表预览 / 时间轴 / 预览像素 / 导出 / 草稿闭环
PAGE=art-workbench.html node tools/run.js eval tools/art-workbench.js
PAGE=dist/art-workbench.html node tools/run.js eval tools/art-workbench.js

# 游戏侧（29 条）：白名单 / 原地改 / 30fps → slashGhosts / PNG 帧 ghost / 绘制分支 / UI
node tools/run.js eval tools/art-overrides.js
PAGE="逍遥行.html" QS=x=1 node tools/run.js eval tools/art-overrides.js
PAGE=dist/index.html QS=x=1 node tools/run.js eval tools/art-overrides.js

# 80 招零重复体检（游戏页）：literal / signatures / atoms 三段，ok=true 才算过
node tools/run.js eval tools/art-unique.js
URL="https://718997675.github.io/xiaoyaoxing/" node tools/run.js eval tools/art-unique.js
```

`tools/run.js` 的就绪等待同时认 `window.__game` 与 `window.__wbReady`，
所以同一套 CDP runner 能开工作台页；工作台页没有 `__game`。
本地默认 URL 与 `URL=` 远程都会自动补 `story=0`，只有 `tools/story.js` 要带 `STORY=1`；
线上裸地址不补会让序章暂停世界，招式自检容易成片假红。

P12-E 后的模块版基线是 **11 套 740 PASS / 0 FAIL**（工作台 43 / 覆盖层 29），
单文件版两条路径各 549 PASS / 0 FAIL；线上体检同样 `ok=true`。
唯一在线地址 https://718997675.github.io/xiaoyaoxing/ 。

> 界面上「四轨道时间轴」（判定帧 / 人物动作帧 / 运动轨 / 瞬移）的效果预估草稿
> `art-motion-preview.html` 暂缓，未提交 / 未打包 / 未发布，工作台保持现状。
