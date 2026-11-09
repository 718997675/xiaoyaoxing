# 逍遥行 · 素材生成提示词（批量出图 → 一键导入）

配套工具：`atlas-tool.html`（浏览器打开，本地切图，不上传）
导出目录：`dawn-s1/assets/atlas.json`

---

## 0. 三条硬规则（决定能不能一次导入成功）

1. **纯色背景**：整张图用同一块纯色底（推荐洋红 `#FF00FF` 或纯绿 `#00FF00`），不要渐变、不要阴影、不要地面。
2. **规则宫格**：一张图里排满等大的格子（3×2、4×3、4×4），每格一个物件，物件居中且不跨格。
3. **不要文字/边框/网格线**：AI 画上去的格线会污染抠图。

> 出图后如果某格切歪，不用重画——在 `atlas-tool.html` 里调「外边距 / 间距 / 列行 / 容差」即可，
> 工具会自动找每格的内容边界并居中缩放。

---

## 1. 风格锁（每次出图都带上这段）

**中文版：**
```
16-bit 中国仙侠像素艺术，俯视角 ARPG 道具素材，24 色限定调色板（墨黑 #12161F、宣纸 #E8DFC8、
青玉 #2F6E6A / #5FA8A0、朱砂 #C8453B / #E8806F、金 #D9A441 / #F2D089、紫 #8A6FC4），
纯洋红背景 #FF00FF，硬边缘、无抗锯齿、无渐变、无阴影、无描边光晕，每个物件 1 像素深色外描边，
物件之间留出足够间距，正视角略带俯视，清晰可辨的剪影。
```

**English（多数模型更吃这套）：**
```
16-bit Chinese xianxia pixel art, top-down ARPG asset sheet, strict 24-color palette
(ink black #12161F, rice paper #E8DFC8, jade #2F6E6A #5FA8A0, cinnabar #C8453B #E8806F,
gold #D9A441 #F2D089, violet #8A6FC4), flat magenta background #FF00FF,
hard pixel edges, NO anti-aliasing, NO gradients, NO drop shadows, NO glow,
1px dark outline around each object, generous spacing between objects,
orthographic top-down slightly angled view, readable silhouettes.
```

**负面提示词（Negative）：**
```
文字, 水印, 网格线, 边框, 渐变, 抗锯齿, 模糊, 写实, 3D 渲染, 阴影, 地面, 多余物件, 重叠
text, watermark, grid lines, frame, gradient, anti-aliasing, blur, photorealistic, 3D render, shadow, ground, overlapping
```

---

## 2. 兵器手持图（最重要，一次出 6 种）

**用途**：角色手中实际挥舞的武器（不是图标）。游戏以**柄端为轴心**旋转，所以必须竖直摆放。

```
一张 3 列 × 2 行、等大格子排列的像素兵器素材图，纯洋红背景 #FF00FF，24 色仙侠调色板，
每格一把【竖直放置、刀尖朝上、握柄朝下、柄端贴住格子底边中点】的兵器，占满格子高度，
1 像素深色描边，无阴影无光效，格子之间留 8 像素空隙。

第一行左起：
1) 长剑：细直双刃，玉青色寒光，金色护手，深色缠柄，剑尖一点白；
2) 长刀：厚背阔刃，刀身朱砂红带一道亮脊，刀尖上挑，金色刀镡；
3) 长枪：细长乌木枪杆，银白枪头，枪头下束一小撮红缨，杆上两道铜箍。

第二行左起：
4) 长棍：齐眉乌木棍，两端铜箍，棍身有细密竹节纹；
5) 双刃：短匕造型的柳叶双刀，刃部紫芒，握柄短，适合成对使用；
6) 重锤：鎏金锤头带铆钉，短柄，锤面有磨损刻痕，整体厚重。

a 3-column × 2-row grid sheet of pixel-art weapons on flat magenta #FF00FF background,
each weapon VERTICAL with blade tip up and grip at the bottom edge center, filling the cell height,
1px dark outline, no shadow, no glow, 8px gap between cells.
Row 1: jian straight sword (jade-white blade, gold guard), broad dao saber (cinnabar blade, gold collar),
long qiang spear (dark shaft, silver head, small red tassel, two brass bands).
Row 2: staff (dark wood, brass caps, bamboo-node texture), paired short willow-leaf blades (violet edge),
golden war hammer (riveted head, worn faces, short handle).
```

导入时类别选 **兵器**，格子顺序为：剑 / 刀 / 枪 / 棍 / 双刃 / 锤（3 列 2 行）。

---

## 3. 装备图标（4×3 = 12 件）

**用途**：行囊 / 装备栏里的 20×20 图标。这一张就够铺满四种槽位。

```
一张 4 列 × 3 行的像素装备图标表，纯洋红背景 #FF00FF，24 色仙侠调色板，
每格一件装备正面摆放、居中、占格 70%，1 像素深色描边，无投影。

第 1 行（兵器，横放斜置 45°）：长剑 / 长刀 / 长枪
第 2 行（兵器 + 衣甲）：重锤 / 布面短褐（粗布衣，褐色，打补丁）/ 玄铁甲（黑铁片甲，金色铆钉）
第 3 行（项链 + 法宝）：紫玉坠（细绳 + 紫玉）/ 长命锁（银锁红绳）/ 八卦镜（铜镜八卦纹）/ 朱砂符（黄符朱砂字）

4×3 grid sheet of pixel-art RPG equipment icons, flat magenta #FF00FF background, 24-color xianxia palette,
each item centered at 70% cell size, 1px dark outline, no shadow.
Row1: jian sword, dao saber, qiang spear (all rotated 45°).
Row2: war hammer, patched hemp robe, black iron lamellar armor with gold rivets.
Row3: purple jade pendant on cord, silver longevity lock with red cord, bagua bronze mirror, yellow paper talisman with cinnabar glyph.
```

> 4 列 3 行 = 12 格，但你只需要其中 10 件。工具按「从左到右、从上到下」取名，
> 多余的两格建议把最后两格留空（纯背景），工具会自动识别为空并跳过？——不会跳过，
> 所以更稳的做法是：**出 5 列 2 行 = 10 件**，或出 4×3 后手动删掉 JSON 里多余的键。

---

## 4. 怪物图（4×3 = 12 种，作为程序化像素的替换）

**用途**：把现在的字符画怪物换成更耐看的像素怪。单帧即可（游戏会自动做两帧呼吸抖动）。

```
一张 4 列 × 3 行的像素怪物图，俯视 3/4 视角，纯洋红背景 #FF00FF，24 色仙侠调色板，
每只怪物正面朝下（面向玩家）、居中、占格 80%，1 像素深色描边，脚下不要画影子。

顺序：山贼（破头巾+短刀）/ 恶犬 / 弓手（斗笠+短弓）/ 壮汉（赤膊+铁护腕）
山魈（棕毛猴面、长臂）/ 赤练蛇（盘曲红蛇）/ 符傀（黄纸人形、朱砂符纹）/ 火鸦（黑羽、翅尖燃火）
石敢当（青灰石像、苔藓、红眼）/ 阴魂（半透明青绿鬼影）/ 千年树妖（枯木人脸、根须腿）/ 黑风寨主（黑甲金纹、鬼面）

4×3 grid of pixel-art monsters, top-down 3/4 view, flat magenta #FF00FF background,
each facing down toward the viewer, 80% cell size, 1px dark outline, no ground shadow.
Order: bandit, hound, archer, brute, mountain ape, red snake, paper effigy, fire crow, stone guardian, ghost, tree demon, bandit chief.
```

---

## 5. 下一阶段（村庄生态）要用的素材

先出**建筑外观**就够搭出村子，室内可以晚一点：

```
一张 4 列 × 2 行的像素建筑立面图，中国古镇风格，纯洋红背景 #FF00FF，24 色仙侠调色板，
正立面略俯视，每格一栋建筑，底部贴齐格子底边，1 像素深色描边。

第 1 行：酒馆（两层木楼、酒旗、灯笼、门口酒坛）/ 药铺（青瓦白墙、药柜窗、门口晒药匾）
第 2 行：铁匠铺（半敞棚、炉火、铁砧）/ 客栈（三层、红漆柱、匾额）/ 民居（土墙茅顶）/ 土地庙（也可做小号）

4×2 grid of pixel-art Chinese town building facades, flat magenta background,
each building bottom-aligned to the cell bottom edge, 1px dark outline.
Row1: two-storey tavern with wine banner and lanterns, herbal pharmacy with white walls and medicine sign.
Row2: blacksmith shed with forge glow, three-storey inn with red pillars, thatched cottage, small shrine.
```

NPC 立绘（4×3，每个 NPC 3 个朝向可后续再要）：

```
4×3 grid of pixel-art NPC sprites (32px tall), Chinese ancient town villagers,
flat magenta background, facing down, 1px dark outline:
innkeeper with towel, apothecary with herb basket, blacksmith with apron, storyteller with fan,
peddler with shoulder pole, night watchman with lantern, old villager with cane, child,
cat, dog, chicken, empty.
```

---

## 6. 导入步骤（30 秒）

1. 浏览器打开 `http://127.0.0.1:8124/atlas-tool.html`
2. 拖入生成图 → 设「列数/行数」（兵器 3×2、图标 4×3、怪物 4×3）
3. 点「吸色」选背景（或直接点图上背景）
4. 「输出尺寸」兵器填 **32**，图标填 **20**
5. 点「生成预览」，检查每一格是否干净（切歪就调外边距/间距/容差）
6. 「导出 atlas.json」→ 三个类别的 JSON 手动合并成一个文件，放到 `dawn-s1/assets/atlas.json`
7. 刷新游戏，右上角会提示「外部素材已装载」

合并后的结构：

```json
{
  "version": 1,
  "weapons": { "sword": "data:image/png;base64,..." },
  "icons":   { "armor": "data:image/png;base64,..." },
  "monsters": { "zhiren": { "w": 32, "h": 32, "frames": ["data:image/png;base64,..."] } }
}
```

**没有 atlas.json 游戏也照常运行**——程序化像素是兜底，导入失败不会白屏。
