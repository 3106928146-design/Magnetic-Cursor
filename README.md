# Magnetic Cursor / 磁吸光标

> 一个轻量的油猴脚本。鼠标在网页文字上移动时，光标会自动吸附到最近的字符位置；按住按键或右键拖动即可快速选中文字，无需精确对准。

## 主要功能

- **磁吸定位**：鼠标靠近文字时，蓝色光标自动吸附到最近的字符插入点。
- **两种选字模式**：
  - **右键拖动**（默认）：右键按住拖动，选区跟随光标吸附位置；松开后右键菜单直接复制。
  - **按键选字**（可选）：按住 F / G / H + 移动鼠标选字，松开按键即完成。适合不想和右键菜单冲突的场景。
- **精密模式**：当检测到字号 < 阈值（默认 13px）时，光标只走鼠标位移的一半，大幅提高小字场景的精准度。按住 Shift 触发减速（Shift 角色可在 CONFIG 中反转）。
- **平滑移动**：JS `requestAnimationFrame` + lerp 逐帧插值，不依赖 CSS transition，网页 CSS 无法覆盖。
- **Shadow DOM 穿透**：递归穿透 open Shadow DOM，Bilibili 评论区、Lit 组件等场景均可吸附。
- **高度可配置**：颜色、高度、发光、动画速度、闪烁、涟漪、精密模式阈值等全部集中到脚本顶部。
- **尊重无障碍**：支持 `prefers-reduced-motion`，系统开启"减少动态效果"时自动关闭闪烁和涟漪。

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
| 右键按住拖动 | （默认）选中文字，松开右键菜单直接复制 |
| 按住 `F` + 移动鼠标 | （按键模式）选中文字 |
| 按住 `Shift` + 移动鼠标 | （精密模式）光标减速，精确定位小字 |
| 左键 | 保持浏览器原生行为，不干预 |

> 右键 / 按键两种选字模式由 `selectionMode` 控制；精密模式触发键可在 CONFIG 中反转。

## 自定义配置

打开脚本最上方的 `CONFIG` 区域，修改对应数值后保存刷新即可。

### 外观

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `caretWidth` | 光标宽度（px） | `2` |
| `caretHeightMultiplier` | 高度 = 行高 × 此倍数 | `2` |
| `caretMinHeight` | 最小高度（px） | `16` |
| `caretColor` | 颜色（HEX） | `#4AA3FF` |
| `caretOpacity` | 常态不透明度 | `0.9` |
| `glowEnabled` | 是否发光 | `true` |
| `glowRadius` / `glowSpread` / `glowAlpha` | 发光半径、扩散、透明度 | `6` / `1` / `0.55` |

### 动画 & 性能

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `smoothFactor` | 移动平滑因子，越大越跟手 | `0.28` |
| `maxFps` | 帧率上限，`0` 为不限制 | `0` |
| `blinkEnabled` | 是否闪烁 | `true` |
| `rippleEnabled` | 是否显示移动涟漪 | `true` |

### 选字模式

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `selectionMode` | `'rightClick'`（右键）或 `'key'`（按键） | `'rightClick'` |
| `selectionKey` | 按键模式下绑定的键，可选 `'F'` / `'G'` / `'H'` | `'F'` |

### 精密模式

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `precisionModeEnabled` | 是否启用小字减速 | `true` |
| `precisionFontThreshold` | 字号阈值（px），小于此值触发 | `13` |
| `precisionSlowFactor` | 减速系数（0~1），`0.5` = 半速 | `0.5` |

## 兼容性

- Chrome / Edge / Firefox 等主流浏览器
- 适配 Shadow DOM（如 Bilibili 评论区、Lit / Web Components）
- 适配普通文本、输入框、contenteditable 编辑区

## 许可证

MIT
