# Magnetic Cursor / 磁吸光标

> 一个轻量的油猴脚本。鼠标在网页文字上移动时，光标会自动吸附到最近的字符位置；右键按住拖动即可快速选中文字，无需精确对准。

## 主要功能

- **磁吸定位**：鼠标靠近文字时，蓝色光标自动吸附到最近的字符插入点。
- **右键拖动选字**：右键按住不放拖动，即可从起点到终点磁吸选中文字；松开后直接点右键菜单里的“复制”。
- **平滑移动**：用 JS `requestAnimationFrame` + lerp 插值实现光标平滑滑动，不依赖 CSS transition。
- **高度自由配置**：颜色、高度、发光、动画速度、闪烁、涟漪等参数全部集中到脚本顶部，打开即可改。（闪烁、涟漪暂不可用）
- **尊重无障碍**：支持 `prefers-reduced-motion`，系统开启“减少动态效果”时自动关闭闪烁和涟漪。

## 安装

1. 浏览器安装 [Tampermonkey](https://www.tampermonkey.net/)（或 Violentmonkey）。
2. 打开 Tampermonkey 面板 → **添加新脚本**。
3. 把 `magnetic-cursor.user.js` 的全部内容粘贴进去，保存（`Ctrl + S`）。
4. 打开任意网页，移动鼠标到文字上方即可看到效果。

## 使用

| 操作 | 效果 |
|------|------|
| 移动鼠标到文字附近 | 蓝色光标自动吸附到最近字符位置 |
| `Alt + C` | 切换插件开启 / 关闭 |
| 右键按住拖动 | 选中文字，松开后右键菜单直接复制 |
| 左键 | 保持浏览器原生行为，不干预 |

## 自定义配置

打开脚本最上方的 `CONFIG` 区域，修改对应数值后保存刷新即可。

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `caretWidth` | 光标宽度（px） | `2` |
| `caretHeightMultiplier` | 光标高度 = 行高 × 此倍数 | `2` |
| `caretMinHeight` | 最小高度（px） | `16` |
| `caretColor` | 光标颜色（HEX） | `#4AA3FF` |
| `caretOpacity` | 常态不透明度 | `0.9` |
| `glowEnabled` | 是否发光 | `true` |
| `glowRadius` / `glowSpread` / `glowAlpha` | 发光半径、扩散、透明度 | 6 / 1 / 0.55 |
| `smoothFactor` | 移动平滑因子，越大越跟手 | `0.28` |
| `maxFps` | 帧率上限，0 为不限制 | `0` |
| `blinkEnabled` | 是否闪烁 | `true` |
| `rippleEnabled` | 是否显示移动涟漪 | `true` |

## 兼容性

- Chrome / Edge / Firefox 等主流 Chromium / Gecko 浏览器
- 适配普通文本页面、输入框、contenteditable 编辑区
- 已知限制：Shadow DOM 内部、iframe 内文本吸附效果受限

## 许可证

MIT
