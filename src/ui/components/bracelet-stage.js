// src/ui/components/bracelet-stage.js — 手串预览挂载层
// 真实渲染器（src/render/bracelet.js）就绪前，用纯 CSS/HTML 珠子环占位：
// 每颗珠子按 design.composition.layout 逐个绘制，颜色/隔珠/挂坠都来自设计数据，
// 支持 circle / flat / wrist 三视图、拖动旋转、悬停识珠。
// 渲染器就绪后（main.js 动态 import 成功）自动切换到真实 SVG 渲染。

import { getLang, elementLabel, ELEMENT_NAMES, ELEMENT_HEX } from '../i18n.js';

// 预览只保留 WebGL 3D。SVG 渲染器（src/render/bracelet.js）仅用于离线渲染测试，
// 不再在本组件中加载；无 WebGL 时回退到 CSS 占位珠子。


function isZh() {
  return getLang() !== 'en';
}

function beadName(item) {
  if (!item) return '';
  if (item.kind === 'spacer') return isZh() ? '隔珠' : 'Spacer';
  if (item.kind === 'charm') return isZh() ? item.zh : item.en || item.zh;
  return isZh() ? item.zh : item.en || item.zh;
}

function beadElement(item) {
  const key = ELEMENT_NAMES[item?.element];
  return key ? elementLabel(key) : '';
}

function stageAriaLabel(design) {
  if (!design) return isZh() ? '手串预览' : 'Bracelet preview';
  const comp = design.composition || {};
  const beads = (comp.layout || []).filter((x) => x.kind === 'bead');
  const groups = new Map();
  for (const bead of beads) {
    const key = bead.role || 'bead';
    if (!groups.has(key)) groups.set(key, bead);
  }
  const main = groups.get('main') || beads[0];
  const support = groups.get('support');
  const accent = groups.get('accent');
  const name = design.copy?.headline || design.theme?.name || '';
  if (!isZh()) {
    const parts = [main, support, accent].filter(Boolean).map((b) => `${beadName(b)} (${b.role})`);
    return `Bracelet “${name}”: ${parts.join(', ')}, ${comp.beadCount || beads.length} beads, ${comp.beadDiameter || 8} mm.`;
  }
  const parts = [];
  if (main) parts.push(`${beadName(main)}主珠`);
  if (support) parts.push(`${beadName(support)}辅珠`);
  if (accent) parts.push(`${beadName(accent)}点缀`);
  return `手串「${name}」：${parts.join('、')}，共 ${comp.beadCount || beads.length} 颗，珠径 ${comp.beadDiameter || 8} 毫米。`;
}

/**
 * 创建预览挂载点。
 * @param {Object} options
 * @param {object} options.design
 * @param {'circle'|'flat'|'wrist'} [options.view]
 * @param {boolean} [options.interactive]
 * @param {(bead:object|null)=>void} [options.onBeadHover]
 * @param {(bead:object)=>void} [options.onBeadClick]
 * @param {boolean} [options.animate]
 */
export function createBraceletStage({
  design,
  view = 'circle',
  interactive = true,
  onBeadHover,
  onBeadClick,
  onViewFallback,
  animate = false,
} = {}) {
  const el = document.createElement('div');
  el.className = 'zs-stage';
  el.dataset.view = view;
  el.setAttribute('role', 'group');
  el.setAttribute('aria-label', stageAriaLabel(design));

  let currentDesign = design;
  let currentView = '3d';
  let rotation = 0;
  let nodes = [];
  let destroyed = false;
  let rafId = 0;
  let baseSize = 520;
  let hovering = null;
  let webgl = null;
  let webglModule = null;
  let webglLoading = false;
  let webglFailed = false;
  let real = null;

  // ---- 结构 ----
  const canvas = document.createElement('div');
  canvas.className = 'zs-stage__canvas';

  const tip = document.createElement('div');
  tip.className = 'zs-stage__tip';
  tip.hidden = true;
  tip.setAttribute('aria-live', 'polite');

  const srList = document.createElement('ul');
  srList.className = 'sr-only';

  el.append(canvas, tip, srList);

  // ---- 尺寸基准 ----
  let ro = null;
  function observeSize() {
    const measure = () => {
      const width = canvas.clientWidth || el.clientWidth || 520;
      baseSize = width;
      el.style.setProperty('--stage-w', `${width}px`);
    };
    measure();
    if ('ResizeObserver' in window) {
      ro = new ResizeObserver(measure);
      ro.observe(el);
    } else {
      window.addEventListener('resize', measure);
    }
  }

  function clearPlaceholder() {
    canvas.replaceChildren();
    nodes = [];
    tip.hidden = true;
  }

  function destroyReal() {
    if (real?.destroy) {
      try { real.destroy(); } catch { /* ignore */ }
    }
    real = null;
  }

  // ---------- 占位渲染：真实渲染器未就绪时 ----------
  function buildPlaceholder() {
    clearPlaceholder();
    const composition = currentDesign?.composition || {};
    const layout = Array.isArray(composition.layout) ? composition.layout : [];
    if (!layout.length) return;

    el.dataset.view = currentView;

    if (currentView === 'wrist') {
      const arm = document.createElement('div');
      arm.className = 'zs-stage__wrist-arm';
      arm.setAttribute('aria-hidden', 'true');
      canvas.appendChild(arm);
    }

    if (currentView === 'flat') {
      const thread = document.createElement('span');
      thread.className = 'zs-stage__thread';
      thread.setAttribute('aria-hidden', 'true');
      canvas.appendChild(thread);
    }

    layout.forEach((item, index) => {
      const node = document.createElement('span');
      node.className = 'zs-stage__item';
      node.dataset.kind = item.kind || 'bead';
      node.dataset.texture = item.texture || 'none';
      node.dataset.role = item.role || '';
      node.dataset.index = String(index);
      node.setAttribute('aria-hidden', 'true');
      if (item.kind === 'bead') node.style.setProperty('--hex', item.hex || '#ddd');
      if (item.kind === 'bead') node.style.setProperty('--hex2', item.hex2 || '#fff');
      if (item.kind === 'bead') node.style.setProperty('--hex3', item.hex3 || '#999');
      if (item.kind === 'spacer') node.dataset.metal = item.metal || 'silver';
      if (item.kind === 'charm') node.dataset.charm = item.charmId || 'lotus';

      const glint = document.createElement('i');
      glint.className = 'zs-stage__glint';
      node.appendChild(glint);
      if (item.kind === 'charm') {
        const glyph = document.createElement('span');
        glyph.className = 'zs-stage__charm-glyph';
        glyph.textContent = charmGlyph(item.charmId);
        node.appendChild(glyph);
      }

      attachNodeEvents(node, item);
      canvas.appendChild(node);
      nodes.push({ node, item });
    });

    positionNodes();
    fillSrList(layout);
    if (animate) playEntrance();
  }

  function charmGlyph(id) {
    const map = { lotus: '莲', peace: '安', pixiu: '貔' };
    return map[id] || '安';
  }

  function attachNodeEvents(node, item) {
    if (!interactive) return;
    node.addEventListener('mouseenter', () => {
      hovering = item;
      showTip(item);
      onBeadHover?.(item);
    });
    node.addEventListener('mouseleave', () => {
      hovering = null;
      hideTip();
      onBeadHover?.(null);
    });
    node.addEventListener('click', () => {
      showTip(item, true);
      onBeadClick?.(item);
    });
  }

  function fillSrList(layout) {
    srList.replaceChildren();
    const seen = new Set();
    for (const item of layout) {
      if (item.kind !== 'bead') continue;
      const key = `${item.crystalId}|${item.role}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const li = document.createElement('li');
      li.textContent = `${beadName(item)} · ${beadElement(item)} · ${item.role === 'main' ? '主珠' : item.role === 'support' ? '辅珠' : '点缀'}`;
      srList.appendChild(li);
    }
  }

  function bounds() {
    return currentView === 'wrist'
      ? { rx: 30, ry: 24, cx: 50, cy: 52 }
      : { rx: 40, ry: 37, cx: 50, cy: 50 };
  }

  function positionNodes() {
    if (!nodes.length) return;
    const { rx, ry, cx, cy } = bounds();
    if (currentView === 'flat') {
      const n = nodes.length;
      const startX = 7;
      const endX = 93;
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0.5 : i / (n - 1);
        const x = startX + t * (endX - startX);
        const y = 54 - Math.sin(t * Math.PI) * 7;
        const depth = 0.7 + Math.sin(t * Math.PI) * 0.3;
        applyNodePos(nodes[i], x, y, depth, i);
      }
      return;
    }
    const n = nodes.length;
    const tilt = currentView === 'wrist' ? -18 : 0;
    for (let i = 0; i < n; i++) {
      const angle = ((-90 + tilt + (i * 360) / n + rotation) * Math.PI) / 180;
      const sin = Math.sin(angle);
      const depth = (sin + 1) / 2;
      const x = cx + Math.cos(angle) * rx;
      const y = cy + sin * ry;
      applyNodePos(nodes[i], x, y, depth, i);
    }
  }

  function applyNodePos(entry, x, y, depth, index) {
    const { node } = entry;
    const scale = currentView === 'flat' ? 0.92 + depth * 0.1 : 0.88 + depth * 0.2;
    node.style.left = `${x}%`;
    node.style.top = `${y}%`;
    node.style.setProperty('--scale', scale.toFixed(3));
    node.style.setProperty('--dim', (1 - (1 - depth) * 0.16).toFixed(3));
    node.style.zIndex = String(10 + Math.round(depth * 40));
    entry._pos = { x, y, depth };
    node.style.setProperty('--i', String(index));
    node.style.setProperty('--bf', beadFactor(entry.item, depth));
    if (currentView === 'flat') node.style.setProperty('--spin', `${(node.dataset.index % 2 === 0 ? -8 : 8)}deg`);
  }

  function beadFactor(item, depth) {
    if (currentView === 'flat') {
      if (item.kind === 'spacer') return '0.034';
      return '0.048';
    }
    if (item.kind === 'spacer') return '0.03';
    if (item.kind === 'charm') return '0.058';
    const dia = currentDesign?.composition?.beadDiameter || 8;
    return String(0.06 * (dia / 8));
  }

  function showTip(item, sticky = false) {
    if (!item) return;
    tip.replaceChildren();
    const dot = document.createElement('i');
    dot.className = 'zs-stage__tip-dot';
    const elKey = ELEMENT_NAMES[item.element];
    dot.style.setProperty('--c', elKey ? ELEMENT_HEX[elKey] : 'var(--gold)');
    const text = document.createElement('span');
    text.className = 'zs-stage__tip-text';
    if (item.kind === 'bead') {
      text.innerHTML = '';
      const zh = document.createElement('b');
      zh.textContent = isZh() ? item.zh : item.en || item.zh;
      const meta = document.createElement('em');
      meta.textContent = `${beadElement(item)}${item.role === 'main' ? ' · 主珠' : item.role === 'support' ? ' · 辅珠' : ' · 点缀'}`;
      text.append(zh, meta);
    } else if (item.kind === 'spacer') {
      const zh = document.createElement('b');
      zh.textContent = isZh() ? '银隔珠' : 'Silver spacer';
      text.append(zh);
    } else {
      const zh = document.createElement('b');
      zh.textContent = beadName(item);
      text.append(zh);
    }
    tip.append(dot, text);
    tip.hidden = false;
    tip.classList.toggle('is-sticky', sticky);

    const entry = nodes.find((n) => n.item === item);
    if (entry?._pos) {
      tip.style.left = `${entry._pos.x}%`;
      tip.style.top = `${entry._pos.y}%`;
    }
  }

  function hideTip() {
    tip.hidden = true;
  }

  function playEntrance() {
    nodes.forEach(({ node }, index) => {
      node.style.transitionDelay = `${Math.min(index * 28, 760)}ms`;
      node.classList.add('is-entering');
    });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        nodes.forEach(({ node }) => node.classList.add('is-in'));
      });
    });
  }

  // ---------- 拖动旋转 ----------
  // 真实 SVG 渲染器自己处理拖动（interactive:true）；仅 CSS 占位态用这里的实现，
  // 避免同一手势被两套 rotate 逻辑重复消费导致跳动。
  let drag = null;
  function onPointerDown(event) {
    if (real) return;
    if (!interactive || currentView !== 'circle' || event.button > 0) return;
    drag = { x: event.clientX, startRotation: rotation, id: event.pointerId };
    el.classList.add('is-dragging');
    try { canvas.setPointerCapture(event.pointerId); } catch { /* ignore */ }
  }
  function onPointerMove(event) {
    if (real) return;
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x;
    const next = drag.startRotation + dx * 0.5;
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      rotation = next;
      if (real?.rotateTo) real.rotateTo(rotation);
      else positionNodes();
      if (hovering) showTip(hovering, true);
    });
  }
  function onPointerUp(event) {
    if (!drag) return;
    drag = null;
    el.classList.remove('is-dragging');
    try { canvas.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
  }
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);

  // ---------- 渲染入口 ----------
  function destroyWebGL() {
    if (webgl?.destroy) {
      try { webgl.destroy(); } catch { /* ignore */ }
    }
    webgl = null;
  }

  async function renderWebGL() {
    if (destroyed) return;
    destroyReal();
    destroyWebGL();
    canvas.replaceChildren();
    nodes = [];
    tip.hidden = true;
    const host = document.createElement('canvas');
    host.className = 'zs-stage__webgl';
    host.setAttribute('aria-label', stageAriaLabel(currentDesign));
    canvas.appendChild(host);
    el.classList.add('is-webgl-loading');
    webglLoading = true;
    try {
      if (!webglModule) webglModule = await import('../../render/webgl-beads.js');
      if (destroyed || currentView !== '3d') return;
      webgl = await webglModule.mountBracelet(host, currentDesign, {
        interactive,
        onBeadHover: (item) => onBeadHover?.(item),
        onBeadClick: (item) => onBeadClick?.(item),
      });
    } catch (err) {
      console.warn('[stage] WebGL preview unavailable', err);
      webglFailed = true;
      buildPlaceholder();
    } finally {
      webglLoading = false;
      el.classList.remove('is-webgl-loading');
    }
  }

  function render({ entrance = false } = {}) {
    if (destroyed) return;
    el.setAttribute('aria-label', stageAriaLabel(currentDesign));
    if (webglFailed) {
      buildPlaceholder();
      return;
    }
    renderWebGL();
  }

  function update(nextDesign, options = {}) {
    currentDesign = nextDesign;
    el.setAttribute('aria-label', stageAriaLabel(currentDesign));
    if (webgl) {
      webgl.update(nextDesign);
      return;
    }
    if (webglFailed) buildPlaceholder();
  }

  function setView() {
    // 视图已统一为 3D；保留空实现以兼容旧调用。
  }

  function destroy() {
    destroyed = true;
    if (rafId) cancelAnimationFrame(rafId);
    ro?.disconnect();
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerUp);
    destroyReal();
    destroyWebGL();
    el.remove();
  }

  observeSize();
  render();

  return {
    el,
    get view() { return '3d'; },
    update,
    setView,
    rotateTo(deg) {
      rotation = deg;
      if (real?.rotateTo) real.rotateTo(deg);
      else positionNodes();
    },
    destroy,
  };
}
