/**
 * ZHUSHENG / 珠生 — bracelet preview shell.
 *
 * Wraps `renderBracelet` with the product-preview chrome:
 *   - circle / flat / wrist view switch
 *   - hover tooltip (name · element · role · size)
 *   - drag-to-rotate hint + reduced-motion aware presentation
 *   - container measurement (ResizeObserver) for compact layouts
 *
 *   import { renderBraceletPreview } from './render/bracelet-preview.js';
 *   const preview = renderBraceletPreview({
 *     container, design, view: 'circle',
 *     onBeadHover(info|null) {}, onBeadClick(info) {},
 *   });
 *   preview.update(design); preview.setView('wrist'); preview.destroy();
 *
 * Everything still goes through the public `renderBracelet` API — UI code that
 * does not want the chrome can keep importing `renderBracelet` directly.
 */

import { renderBracelet } from './bracelet.js';

const VIEW_DEFS = [
  { id: 'circle', zh: '环视', en: 'Ring', hint: '拖动旋转 · Tab 逐颗浏览 · Enter 查看' },
  { id: 'flat', zh: '平铺', en: 'Flat', hint: '按串制顺序平铺' },
  { id: 'wrist', zh: '佩戴', en: 'Wrist', hint: '按手腕尺寸示意比例' },
];

const ROLE_ZH = { main: '主珠', support: '辅珠', accent: '点缀' };
const METAL_ZH = { silver: '银', gold: '古金' };

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/**
 * @param {object} options
 * @param {HTMLElement} options.container
 * @param {object} options.design
 * @param {'circle'|'flat'|'wrist'} [options.view]
 * @param {boolean} [options.interactive]
 * @param {boolean} [options.showSwitch]
 * @param {boolean} [options.showHint]
 * @param {(info:object|null)=>void} [options.onBeadHover]
 * @param {(info:object)=>void} [options.onBeadClick]
 * @param {(view:string)=>void} [options.onViewChange]
 */
export function renderBraceletPreview(options = {}) {
  const container = options.container;
  if (!container || typeof container.appendChild !== 'function') {
    throw new Error('renderBraceletPreview: a container element is required');
  }

  const interactive = options.interactive !== false;
  const showSwitch = options.showSwitch !== false;
  const showHint = options.showHint !== false;
  const userHover = typeof options.onBeadHover === 'function' ? options.onBeadHover : () => {};
  const userClick = typeof options.onBeadClick === 'function' ? options.onBeadClick : () => {};
  const onViewChange = typeof options.onViewChange === 'function' ? options.onViewChange : () => {};
  const availableViews = VIEW_DEFS.filter((view) => view.id !== 'wrist' || options.wrist !== false);

  let view = VIEW_DEFS.some((v) => v.id === options.view) ? options.view : 'circle';
  let destroyed = false;
  const ac = new AbortController();
  const signal = ac.signal;

  const root = el('div', 'bz-preview');
  root.setAttribute('data-view', view);
  const viewport = el('div', 'bz-viewport');
  const bar = el('div', 'bz-bar');
  const switchWrap = el('div', 'bz-switch');
  switchWrap.setAttribute('role', 'tablist');
  switchWrap.setAttribute('aria-label', '切换手串视图');

  const tabs = new Map();
  if (showSwitch) {
    availableViews.forEach((def) => {
      const tab = el('button', 'bz-tab', def.zh);
      tab.type = 'button';
      tab.setAttribute('role', 'tab');
      tab.setAttribute('data-view', def.id);
      tab.setAttribute('aria-selected', String(def.id === view));
      tab.setAttribute('title', def.en);
      tab.addEventListener(
        'click',
        () => {
          setView(def.id);
        },
        { signal },
      );
      tabs.set(def.id, tab);
      switchWrap.appendChild(tab);
    });
    bar.appendChild(switchWrap);
  }

  const hint = el('p', 'bz-hint', (VIEW_DEFS.find((v) => v.id === view) || VIEW_DEFS[0]).hint);
  if (showHint) bar.appendChild(hint);

  const tooltip = el('div', 'bz-tooltip');
  tooltip.setAttribute('role', 'status');
  tooltip.setAttribute('aria-live', 'polite');
  tooltip.hidden = true;
  const dot = el('span', 'bz-tt-dot');
  const ttBody = el('span', 'bz-tt-body');
  const ttName = el('span', 'bz-tt-name');
  const ttMeta = el('span', 'bz-tt-meta');
  ttBody.appendChild(ttName);
  ttBody.appendChild(ttMeta);
  tooltip.appendChild(dot);
  tooltip.appendChild(ttBody);

  root.appendChild(viewport);
  if (showSwitch || showHint) root.appendChild(bar);
  root.appendChild(tooltip);

  while (container.firstChild) container.removeChild(container.firstChild);
  container.appendChild(root);

  const bracelet = renderBracelet({
    container: viewport,
    design: options.design,
    view,
    interactive,
    onBeadHover: (info) => {
      if (info) showTooltip(info);
      else hideTooltip();
      userHover(info);
    },
    onBeadClick: (info) => {
      userClick(info);
    },
  });

  if (!showSwitch && !showHint) root.classList.add('bz-preview--bare');
  if (!interactive) root.classList.add('bz-preview--static');

  let ro = null;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      const width = entry.contentRect ? entry.contentRect.width : root.clientWidth;
      root.classList.toggle('is-compact', width > 0 && width < 460);
    });
    ro.observe(root);
  }

  function metaFor(info) {
    if (info.kind === 'bead') {
      const bits = [];
      if (info.element) bits.push(info.element);
      if (ROLE_ZH[info.role]) bits.push(ROLE_ZH[info.role]);
      if (info.size) bits.push(`${info.size}mm`);
      return bits.join(' · ');
    }
    if (info.kind === 'spacer') return `${METAL_ZH[info.metal] || '金属'}隔珠 · ${info.size}mm`;
    if (info.kind === 'charm') return '银饰挂件';
    return '';
  }

  function showTooltip(info) {
    if (!info || !info.el || !root.isConnected) return;
    tooltip.hidden = false;
    dot.style.background = info.kind === 'bead' ? info.hex || 'var(--line-strong)' : 'var(--gold-soft)';
    ttName.textContent = info.kind === 'bead' ? info.zh : info.label;
    ttMeta.textContent = metaFor(info);
    positionTooltip(info);
  }

  function positionTooltip(info) {
    const wrapRect = root.getBoundingClientRect();
    const rect = info.el.getBoundingClientRect();
    if (!wrapRect.width || !rect.width) return;
    const cx = rect.left + rect.width / 2 - wrapRect.left;
    const top = rect.top - wrapRect.top;
    const bottom = rect.bottom - wrapRect.top;
    const width = tooltip.offsetWidth || 140;
    const height = tooltip.offsetHeight || 44;
    const x = clamp(cx, width / 2 + 8, Math.max(width / 2 + 8, wrapRect.width - width / 2 - 8));
    let y = top - 10;
    const below = y - height < 4;
    y = below ? bottom + 10 : y;
    tooltip.classList.toggle('is-below', below);
    tooltip.style.left = `${Math.round(x)}px`;
    tooltip.style.top = `${Math.round(y)}px`;
  }

  function hideTooltip() {
    tooltip.hidden = true;
    tooltip.classList.remove('is-below');
  }

  function syncChrome() {
    root.setAttribute('data-view', view);
    const def = VIEW_DEFS.find((v) => v.id === view) || VIEW_DEFS[0];
    hint.textContent = def.hint;
    tabs.forEach((tab, id) => {
      const active = id === view;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    hideTooltip();
  }

  function setView(next, notify = true) {
    if (destroyed) return api;
    if (!VIEW_DEFS.some((def) => def.id === next)) return api;
    view = next;
    bracelet.setView(next);
    syncChrome();
    if (notify) onViewChange(view);
    return api;
  }

  function update(design) {
    if (destroyed) return api;
    bracelet.update(design);
    hideTooltip();
    return api;
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    ac.abort();
    if (ro) ro.disconnect();
    bracelet.destroy();
    if (root.parentNode) root.parentNode.removeChild(root);
  }

  if (showSwitch) {
    switchWrap.addEventListener(
      'keydown',
      (event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        const ids = availableViews.map((def) => def.id);
        const index = ids.indexOf(view);
        const delta = event.key === 'ArrowRight' ? 1 : -1;
        const next = ids[(index + delta + ids.length) % ids.length];
        event.preventDefault();
        setView(next);
        const tab = tabs.get(next);
        if (tab) tab.focus();
      },
      { signal },
    );
  }

  syncChrome();

  const api = {
    el: root,
    viewport,
    bracelet,
    update,
    setView,
    destroy,
    rotateTo(deg) {
      bracelet.rotateTo(deg);
      return api;
    },
    get view() {
      return view;
    },
    get nodeCount() {
      return bracelet.nodeCount;
    },
  };

  return api;
}

export default renderBraceletPreview;
