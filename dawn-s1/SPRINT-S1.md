# S1 Sprint 文档 · 破晓试炼（9th Dawn-like 垂直切片）

日期：2026-11-09 · 状态：已交付（实现 + 浏览器实测 + 文档闭环）

## 1. 目标与范围
验证"砍杀刷宝"核心乐趣的最小可玩闭环：
- 64×48 tile 野外地图（草地/土路/水涯/树/ rock/营火），种子固定可复现
- 移动（WASD/方向键）、冲刺（Shift，含闪避无敌帧）、近战扇形攻击（空格/J）
- 3 种敌人 AI：史莱姆（慢速近战）、狼（快速近战）、萨满（远程弹丸+保持距离）；营地巡逻/仇恨/脱战 leash
- 掉落（金币/药水/武器/护甲，三档稀有度）、自动拾取、20 格背包、点击装备/使用
- 血量/经验/升级（+血+攻）、死亡回营火扣 20% 金币
- localStorage 存档：12s 自动 + 关闭页面时保存；主菜单"继续存档"
- 营地每 18s 补怪，保证持续刷宝流

不在 S1：昼夜/天气、任务/NPC、技能树、驯服、制作、触控/手柄、多地图。

## 2. 运行方式
纯静态、零构建、three.js 已本地化（lib/three.module.js，r160，离线可玩）：
```
node server.js        # 或任意静态服务器（ES module 需 http 协议）
# 浏览器打开 http://127.0.0.1:8124/
```
操作：WASD/方向键移动 · Shift 冲刺 · 空格/J 攻击 · Q 药水 · Tab/I 背包 · Esc 关闭背包。

## 3. 架构要点
- 文件：index.html（DOM 菜单/背包/死亡面板）、game.js（全部逻辑与程序化像素美术）、server.js（静态+截图存盘）、lib/three.module.js
- 渲染：逻辑分辨率 480×270 → CSS 整数倍放大 + image-rendering:pixelated；贴图全部 NearestFilter、无 mipmap；像素锐利无抗锯齿
- 世界：three.js 正交相机（top=0/bottom=270 实现 y 向下）；地面单张 1024×768 CanvasTexture；物件/实体为透明 quad，renderOrder 按 y 排序实现遮挡
- 美术：全部字符画点阵程序生成（player 4 向×2 帧、3 敌人×2 帧、图标、树/石/营火），无外部素材
- HUD/伤害数字/消息：同尺寸 2D overlay canvas，随整数倍放大
- 存档：localStorage `dawn-s1-save-v1`（位置/属性/背包/装备）
- 测试钩子：window.__game（state/player/enemies/drops/spawnEnemy/giveItem/setPos/save/load/tick/capture/debug）；tick(dt) 用于隐藏页环境下确定性步进测试

## 4. 实测结果（browser-use CDP 真操作）
| 用例 | 结果 |
|---|---|
| 开始游戏 | state=play，12 敌人 seeded |
| 移动 | 1s 位移 70px（520→590），符合速度设定 |
| 战斗 | 史莱姆 20hp 被击杀，+8xp，掉 2 件 loot |
| 拾取 | 金币+5、药水入包，地面清空 |
| 装备 | 背包点击装备钢剑，equip.weapon 生效 |
| 药水 | hp 50→90 |
| 存档/读档 | 刷新后继续存档：gold/level/位置/背包/装备与快照完全一致 |
| 渲染 | 截图确认地图/敌人/HUD/伤害数字正常；中心像素非空 |
| Console | 全程无错误/警告 |

截图：screenshot.png（480×270 逻辑帧，营地处战斗画面）。

## 5. 本轮发现并修复的问题
1. **正交 y 翻转导致背面剔除**：top=0/bottom=270 使投影翻转 Y、三角形绕序反转，FrontSide 全部被 culled（draw call 有、光栅化零）。修复：quad 材质 DoubleSide。
2. 隐藏浏览器页 RAF 暂停：加 __game.tick(dt) 确定性步进供自动化测试；真实可见浏览器走正常 RAF。
3. WebGL 截图空缓冲：renderer 开 preserveDrawingBuffer，capture() 同帧合成 gl+overlay 存盘。

## 6. 已知限制
- 数值平衡粗糙（敌人伤害/掉落率未调优）；背包满时掉落留地面
- 无触控/手柄；移动端需 S2 加虚拟摇杆
- 敌人补怪 18s 固定；无营地难度梯度
- 存档无版本迁移（v1 校验，坏档回新游戏）

## 7. S2 计划（建议）
1. 装备词缀 + 掉落表权重调优 + 稀有度光柱
2. 技能槽（重击/旋风/闪现）与冷却 HUD
3. 第二地图 + 地下城入口 + 任务 NPC（对话/杀怪计数/交付）
4. 触控虚拟摇杆 + 攻击键（移动 H5 可玩）
5. 昼夜色调 + 营地商店（金币消耗出口）