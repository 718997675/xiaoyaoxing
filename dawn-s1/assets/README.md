# assets/ 外部素材目录

把 `atlas-tool.html` 导出的 `atlas.json` 放在这个目录里，刷新游戏即可自动替换程序化美术。
没有这个文件时，游戏使用内置的程序化像素，不会报错。

atlas.json 结构（工具会自动生成，不必手写）：

```json
{
  "version": 1,
  "weapons": { "sword": "data:image/png;base64,...", "blade": "...", "spear": "...", "staff": "...", "dual": "...", "hammer": "..." },
  "icons":   { "armor": "...", "necklace": "...", "artifact": "..." },
  "monsters": { "zhiren": { "w": 16, "h": 16, "frames": ["data:image/png;base64,..."] } }
}
```

武器贴图约定：**竖直摆放，刃在上、柄在下，柄端贴住图片底边中点**，游戏以柄端为轴心旋转挥砍。
