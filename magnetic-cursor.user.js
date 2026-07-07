// ==UserScript==
// @name         Magnetic Cursor
// @name:zh-CN   磁吸光标
// @namespace    https://github.com/<your-handle>/magnetic-cursor
// @version      0.2.2
// @description  Magnetic cursor that snaps to nearest text position 
// @description:zh-CN  鼠标在文本上移动时自动吸附到最近的文字插入位置
// @author       you
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @license      MIT
// @run-at       document-idle
// ==/UserScript==
/*!
 * Magnetic Cursor v0.2.2
 * https://github.com/<your-handle>/magnetic-cursor
 * MIT License
 */

(function () {
  'use strict';

  // ==========================================================================
  // 用户自定义配置区
  // 修改下方数值即可调整光标外观、动画和性能，无需深入代码。
  // 所有颜色请使用 HEX 格式，例如 '#FF0000'。
  // ==========================================================================

  const CONFIG = {
    // --- 光标外观 ---
    caretWidth: 2,              // 光标宽度（像素）
    caretHeightMultiplier: 2,   // 光标高度 = 文字行高 × 此倍数。普通网页 16px 行高会变成 32px
    caretMinHeight: 16,         // 光标最小高度（像素），防止小字号时看不见
    caretColor: '#4AA3FF',      // 光标颜色（蓝色）
    caretOpacity: 0.9,          // 常态不透明度（0 ~ 1）

    // --- 发光效果 ---
    glowEnabled: true,          // 是否开启光晕
    glowRadius: 6,              // 光晕模糊半径（像素）
    glowSpread: 1,              // 光晕扩散大小（像素）
    glowAlpha: 0.55,            // 光晕透明度（0 ~ 1）

    // --- 移动动画 ---
    // 平滑因子：越大越跟手，越小越丝滑。推荐 0.15 ~ 0.45
    smoothFactor: 0.28,
    // 帧率上限：0 表示不限制，跟随显示器刷新率。60/120 可限制为固定帧率
    maxFps: 0,
    // 死区：鼠标移动小于此像素时，不重新触发涟漪，减少抖动
    deadZonePx: 10,

    // --- 闪烁动画 ---
    blinkEnabled: true,         // 是否闪烁
    blinkDuration: 1.05,        // 一次闪烁周期（秒）
    blinkMaxOpacity: 0.9,       // 闪烁最亮时的不透明度
    blinkMinOpacity: 0.3,       // 闪烁最暗时的不透明度

    // --- 移动涟漪 ---
    rippleEnabled: true,        // 是否显示移动涟漪
    rippleDuration: 220,        // 涟漪持续时间（毫秒）
    rippleThrottle: 80,         // 涟漪最小触发间隔（毫秒），避免连续创建 DOM
    rippleScale: 2.5,           // 涟漪扩散倍数：从 1 倍放大到 1 + 此值
    rippleOpacity: 0.8,         // 涟漪初始不透明度
    rippleGlowStart: 8,         // 涟漪初始光晕半径（像素）
    rippleGlowEnd: 24,          // 涟漪结束光晕半径（像素）

    // --- 功能开关 ---
    enabled: true,              // 插件默认是否启用
  };

  // 持久化默认值（从 CONFIG 读取，不需要手动修改）
  const DEFAULTS = Object.freeze({ ...CONFIG });

  const KEY_PREFIX = 'mc_';

  // 运行时状态
  let settings = {};
  let enabled = true;
  let rafQueued = false;
  let pending = null;
  let menuId = null;
  let rightMouseDown = false;
  let rightDragStarted = false;
  let rightStartX = 0;
  let rightStartY = 0;
  let lastFrameTime = 0;       // 帧率限制用

  // JS 平滑插值状态
  let smoothRafId = null;
  let currentX = 0;
  let currentY = 0;
  let currentHeight = 20;
  let targetX = 0;
  let targetY = 0;
  let targetHeight = 20;
  let lastTargetX = -999;
  let lastTargetY = -999;

  // ==========================================================================
  // 颜色工具
  // ==========================================================================

  function parseHexColor(hex) {
    if (!hex || hex.length < 7) return { r: 74, g: 163, b: 255 };
    return {
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16),
    };
  }

  function buildGlow(color, radius, spread, alpha) {
    const { r, g, b } = parseHexColor(color);
    return `0 0 ${radius}px ${spread}px rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // ==========================================================================
  // 模块 2: CSS 注入
  // ==========================================================================

  function injectStyles() {
    if (document.getElementById('magnetic-caret-styles')) return;
    const color = CONFIG.caretColor;
    const glow = buildGlow(color, CONFIG.glowRadius, CONFIG.glowSpread, CONFIG.glowAlpha);
    const style = document.createElement('style');
    style.id = 'magnetic-caret-styles';
    style.textContent = `
      .magnetic-caret {
        position: fixed !important;
        width: ${CONFIG.caretWidth}px !important;
        height: ${CONFIG.caretMinHeight}px !important;
        background: ${color} !important;
        border-radius: 1px !important;
        pointer-events: none !important;
        z-index: 2147483647 !important;
        opacity: 0 !important;
        top: 0 !important;
        left: 0 !important;
        box-shadow: ${glow} !important;
        will-change: transform, opacity !important;
      }

      @keyframes mc-blink {
        0%, 100% { opacity: ${CONFIG.blinkMaxOpacity} !important; }
        50% { opacity: ${CONFIG.blinkMinOpacity} !important; }
      }

      .magnetic-caret.mc-blinking {
        animation: mc-blink ${CONFIG.blinkDuration}s step-end infinite !important;
      }

      .magnetic-caret-ripple {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        border-radius: 1px !important;
        pointer-events: none !important;
        z-index: 2147483646 !important;
      }

      @media (prefers-reduced-motion: reduce) {
        .magnetic-caret {
          animation: none !important;
        }
        .magnetic-caret-ripple {
          display: none !important;
        }
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  // ==========================================================================
  // 模块 3: DOM 工具函数
  // ==========================================================================

  function isElementVisible(el) {
    if (!el || !el.nodeType) return false;
    const style = getComputedStyle(el);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      parseFloat(style.opacity) === 0
    ) {
      return false;
    }
    if ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && el.disabled) {
      return false;
    }
    return true;
  }

  const NON_TEXT_TAGS = new Set([
    'img', 'video', 'audio', 'canvas', 'svg', 'iframe', 'object',
    'embed', 'button', 'select', 'option', 'map', 'area', 'input',
    'textarea', 'br', 'hr', 'meta', 'link', 'script', 'style', 'noscript',
  ]);

  function isTextOrEditable(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
    if (el.isContentEditable) return true;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return true;
    const tag = el.tagName.toLowerCase();
    if (NON_TEXT_TAGS.has(tag)) return false;
    if (el.textContent && el.textContent.trim().length > 0) return true;
    return false;
  }

  function getTextPosition(x, y) {
    try {
      if (document.caretRangeFromPoint) {
        return document.caretRangeFromPoint(x, y);
      }
      if (document.caretPositionFromPoint) {
        const pos = document.caretPositionFromPoint(x, y);
        if (!pos) return null;
        const range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
        range.collapse(true);
        return range;
      }
    } catch (_) {}
    return null;
  }

  function getCaretRect(range) {
    if (!range) return null;
    try {
      const rects = range.getClientRects();
      if (rects && rects.length > 0 && rects[0].height > 0) {
        return rects[0];
      }
      const rect = range.getBoundingClientRect();
      if (rect && rect.height > 0) {
        return rect;
      }
    } catch (_) {}
    return null;
  }

  // ==========================================================================
  // 模块 4: JS 平滑插值引擎（替代 CSS transition）
  // ==========================================================================

  function smoothLoop() {
    smoothRafId = null;

    const lerp = settings.smoothFactor;

    const dx = targetX - currentX;
    const dy = targetY - currentY;
    const dh = targetHeight - currentHeight;

    currentX += dx * lerp;
    currentY += dy * lerp;
    currentHeight += dh * lerp;

    if (caret.el) {
      caret.el.style.transform = `translate(${currentX.toFixed(2)}px, ${currentY.toFixed(2)}px)`;
      caret.el.style.setProperty('height', `${currentHeight.toFixed(1)}px`, 'important');
    }

    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5 || Math.abs(dh) > 0.5) {
      smoothRafId = requestAnimationFrame(smoothLoop);
    } else {
      currentX = targetX;
      currentY = targetY;
      currentHeight = targetHeight;
      if (caret.el) {
        caret.el.style.transform = `translate(${targetX}px, ${targetY}px)`;
        caret.el.style.setProperty('height', `${targetHeight}px`, 'important');
      }
    }
  }

  function kickSmoothLoop() {
    if (smoothRafId === null) {
      smoothRafId = requestAnimationFrame(smoothLoop);
    }
  }

  function stopSmoothLoop() {
    if (smoothRafId !== null) {
      cancelAnimationFrame(smoothRafId);
      smoothRafId = null;
    }
  }

  // ==========================================================================
  // 模块 5: 幽灵光标管理
  // ==========================================================================

  const caret = {
    el: null,
    visible: false,

    create() {
      if (this.el) return;
      this.el = document.createElement('div');
      this.el.className = 'magnetic-caret';
      this.el.setAttribute('aria-hidden', 'true');
      // 关键样式用 inline style + !important，防止被站内 CSS 覆盖
      this.el.style.setProperty('position', 'fixed', 'important');
      this.el.style.setProperty('width', `${CONFIG.caretWidth}px`, 'important');
      this.el.style.setProperty('height', `${CONFIG.caretMinHeight}px`, 'important');
      this.el.style.setProperty('background', CONFIG.caretColor, 'important');
      this.el.style.setProperty('border-radius', '1px', 'important');
      this.el.style.setProperty('pointer-events', 'none', 'important');
      this.el.style.setProperty('z-index', '2147483647', 'important');
      this.el.style.setProperty('opacity', '0', 'important');
      this.el.style.setProperty('top', '0', 'important');
      this.el.style.setProperty('left', '0', 'important');
      this.el.style.setProperty('box-shadow', buildGlow(CONFIG.caretColor, CONFIG.glowRadius, CONFIG.glowSpread, CONFIG.glowAlpha), 'important');
      this.el.style.setProperty('will-change', 'transform, opacity', 'important');
      document.body.appendChild(this.el);

      if (settings.blinkEnabled !== false) {
        this.el.classList.add('mc-blinking');
      }
    },

    destroy() {
      stopSmoothLoop();
      if (this.el && this.el.parentNode) {
        this.el.parentNode.removeChild(this.el);
      }
      this.el = null;
      this.visible = false;
    },

    show() {
      if (!this.el) return;
      this.el.style.setProperty('opacity', String(CONFIG.caretOpacity), 'important');
      this.visible = true;
    },

    hide() {
      if (!this.el) return;
      this.el.style.setProperty('opacity', '0', 'important');
      this.visible = false;
      stopSmoothLoop();
    },

    snap(x, y, height) {
      if (!this.el) return;

      const moved = Math.abs(x - lastTargetX) + Math.abs(y - lastTargetY);
      lastTargetX = x;
      lastTargetY = y;

      targetX = x;
      targetY = y;
      targetHeight = height;

      if (!this.visible || currentX === 0 && currentY === 0) {
        currentX = x;
        currentY = y;
        currentHeight = height;
        this.el.style.transform = `translate(${x}px, ${y}px)`;
        this.el.style.setProperty('height', `${height}px`, 'important');
        return;
      }

      if (CONFIG.rippleEnabled && moved > CONFIG.deadZonePx && this.visible) {
        spawnRipple(x, y, height);
      }

      kickSmoothLoop();
    },

    updateColor(hex) {
      if (!this.el) return;
      this.el.style.setProperty('background', hex, 'important');
      if (CONFIG.glowEnabled) {
        this.el.style.setProperty('box-shadow', buildGlow(hex, CONFIG.glowRadius, CONFIG.glowSpread, CONFIG.glowAlpha), 'important');
      }
    },

    updateWidth(px) {
      if (!this.el) return;
      this.el.style.setProperty('width', `${px}px`, 'important');
    },

    setBlink(on) {
      if (!this.el) return;
      if (on) {
        this.el.classList.add('mc-blinking');
      } else {
        this.el.classList.remove('mc-blinking');
      }
    },
  };

  // ==========================================================================
  // 模块 6: 涟漪效果
  // ==========================================================================

  let lastRippleTime = 0;

  function spawnRipple(x, y, height) {
    const now = Date.now();
    if (now - lastRippleTime < CONFIG.rippleThrottle) return;
    lastRippleTime = now;

    const ripple = document.createElement('div');
    ripple.className = 'magnetic-caret-ripple';
    const color = caret.el && caret.el.style.background ? caret.el.style.background : CONFIG.caretColor;
    const { r, g, b } = parseHexColor(color);

    ripple.style.setProperty('position', 'fixed', 'important');
    ripple.style.setProperty('top', '0', 'important');
    ripple.style.setProperty('left', '0', 'important');
    ripple.style.setProperty('width', `${CONFIG.caretWidth}px`, 'important');
    ripple.style.setProperty('height', `${height}px`, 'important');
    ripple.style.setProperty('background', `rgba(${r}, ${g}, ${b}, ${CONFIG.rippleOpacity})`, 'important');
    ripple.style.setProperty('border-radius', '1px', 'important');
    ripple.style.setProperty('pointer-events', 'none', 'important');
    ripple.style.setProperty('z-index', '2147483646', 'important');
    ripple.style.setProperty('opacity', String(CONFIG.rippleOpacity), 'important');
    ripple.style.setProperty('transform', `translate(${x}px, ${y}px) scale(1)`, 'important');
    ripple.style.setProperty('box-shadow', `0 0 ${CONFIG.rippleGlowStart}px ${CONFIG.rippleGlowStart/4}px rgba(${r}, ${g}, ${b}, ${CONFIG.rippleOpacity})`, 'important');
    ripple.style.setProperty('will-change', 'transform, opacity', 'important');
    document.body.appendChild(ripple);

    void ripple.offsetWidth;

    const startTime = performance.now();
    const duration = CONFIG.rippleDuration;

    function animateRipple() {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);

      const scale = 1 + ease * CONFIG.rippleScale;
      const opacity = CONFIG.rippleOpacity * (1 - ease);
      const glowSize = CONFIG.rippleGlowStart + ease * (CONFIG.rippleGlowEnd - CONFIG.rippleGlowStart);
      const glowAlpha = CONFIG.rippleOpacity * (1 - ease);

      ripple.style.setProperty('transform', `translate(${x}px, ${y}px) scale(${scale})`, 'important');
      ripple.style.setProperty('opacity', String(opacity), 'important');
      ripple.style.setProperty('box-shadow', `0 0 ${glowSize}px ${glowSize/4}px rgba(${r}, ${g}, ${b}, ${glowAlpha})`, 'important');

      if (t < 1) {
        requestAnimationFrame(animateRipple);
      } else {
        if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
      }
    }
    requestAnimationFrame(animateRipple);
  }

  // ==========================================================================
  // 模块 7: 核心循环
  // ==========================================================================

  function processFrame(timestamp) {
    rafQueued = false;

    // 帧率限制：如果离上一帧太近，则跳过并重新排队
    if (CONFIG.maxFps > 0) {
      const minInterval = 1000 / CONFIG.maxFps;
      if (timestamp - lastFrameTime < minInterval) {
        rafQueued = true;
        requestAnimationFrame(processFrame);
        return;
      }
      lastFrameTime = timestamp;
    }

    if (!enabled) {
      caret.hide();
      return;
    }

    if (!pending) {
      caret.hide();
      return;
    }

    const { x, y } = pending;
    pending = null;

    let el;
    try {
      el = document.elementFromPoint(x, y);
    } catch (_) {
      caret.hide();
      return;
    }

    if (!el || !isElementVisible(el) || !isTextOrEditable(el)) {
      caret.hide();
      return;
    }

    const range = getTextPosition(x, y);
    if (!range) {
      caret.hide();
      return;
    }

    const rect = getCaretRect(range);
    if (!rect) {
      caret.hide();
      return;
    }

    if (rect.left < 0 || rect.top < 0 ||
        rect.left > window.innerWidth || rect.top > window.innerHeight) {
      caret.hide();
      return;
    }

    const h = Math.max(rect.height * CONFIG.caretHeightMultiplier, CONFIG.caretMinHeight);
    // 垂直居中：光标中心对齐到文字行的中心线
    const top = rect.top + (rect.height - h) / 2;
    caret.show();
    caret.snap(rect.left, top, h);
  }

  function onMouseMove(e) {
    if (!enabled) return;

    if (rightMouseDown && (e.buttons & 2)) {
      const range = getTextPosition(e.clientX, e.clientY);
      if (range) {
        const selection = window.getSelection();
        if (selection.anchorNode) {
          selection.extend(range.startContainer, range.startOffset);
        }
      }
      const dx = e.clientX - rightStartX;
      const dy = e.clientY - rightStartY;
      if (Math.sqrt(dx * dx + dy * dy) > 4) {
        rightDragStarted = true;
      }
    }

    pending = { x: e.clientX, y: e.clientY };

    if (!rafQueued) {
      rafQueued = true;
      requestAnimationFrame(processFrame);
    }
  }

  // ==========================================================================
  // 模块 8: 事件绑定
  // ==========================================================================

  function onMouseDown(e) {
    if (!enabled) return;

    if (e.button === 2) {
      const range = getTextPosition(e.clientX, e.clientY);
      if (!range) return;

      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);

      rightMouseDown = true;
      rightStartX = e.clientX;
      rightStartY = e.clientY;
      rightDragStarted = false;
    }
  }

  function onMouseUp(e) {
    if (e.button === 2) {
      rightMouseDown = false;
    }
  }

  function onScroll() {
    caret.hide();
    pending = null;
  }

  function onResize() {
    caret.hide();
    pending = null;
  }

  function onKeyDown(e) {
    if (e.altKey && e.code === 'KeyC' && !e.repeat) {
      e.preventDefault();
      enabled = !enabled;
      GM_setValue(KEY_PREFIX + 'enabled', enabled);
      if (!enabled) {
        caret.hide();
      }
      updateMenuLabel();
    }
  }

  function onVisibilityChange() {
    if (document.hidden) {
      caret.hide();
      pending = null;
      rafQueued = false;
    }
  }

  function setupEvents() {
    document.addEventListener('mousemove', onMouseMove, { passive: true });
    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('mouseup', onMouseUp, { passive: true });
    document.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('visibilitychange', onVisibilityChange);
  }

  // ==========================================================================
  // 模块 9: 设置系统
  // ==========================================================================

  function loadSettings() {
    settings = {};
    for (const [key, defaultValue] of Object.entries(DEFAULTS)) {
      const stored = GM_getValue(KEY_PREFIX + key, defaultValue);
      settings[key] = stored;
    }
    enabled = settings.enabled;
  }

  function toggleEnabled() {
    enabled = !enabled;
    GM_setValue(KEY_PREFIX + 'enabled', enabled);
    if (!enabled) {
      caret.hide();
    }
    updateMenuLabel();
  }

  function updateMenuLabel() {
    if (menuId !== null) {
      GM_unregisterMenuCommand(menuId);
    }
    menuId = GM_registerMenuCommand(
      enabled ? 'Disable Magnetic Cursor' : 'Enable Magnetic Cursor',
      toggleEnabled
    );
  }

  function setupMenu() {
    updateMenuLabel();
  }

  // ==========================================================================
  // 模块 10: 初始化入口
  // ==========================================================================

  function init() {
    loadSettings();
    injectStyles();
    caret.create();

    if (settings.caretColor !== DEFAULTS.caretColor) {
      caret.updateColor(settings.caretColor);
    }
    if (settings.caretWidth !== DEFAULTS.caretWidth) {
      caret.updateWidth(settings.caretWidth);
    }
    if (!settings.blinkEnabled) {
      caret.setBlink(false);
    }

    setupEvents();
    setupMenu();

    console.log('%c[Magnetic Cursor] v0.2.2 loaded — Alt+C toggle | Right-click-drag to select text', 'color: #4AA3FF; font-weight: bold');

    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    currentX = cx;
    currentY = cy;
    targetX = cx;
    targetY = cy;
    caret.el.style.transform = `translate(${cx}px, ${cy}px)`;
    caret.el.style.setProperty('height', '24px', 'important');
    caret.show();
    setTimeout(() => { caret.hide(); }, 1000);

    if (!enabled) {
      caret.hide();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
