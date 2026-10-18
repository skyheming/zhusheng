// src/ui/views/editor.js — 编辑模式：左 sticky 预览 + 右面板，实时改价
// 已接入 src/core/index.js（mock.js 保留为离线兜底，不再被视图引用）。

import { t, getLang, pick, UI_WISHES } from '../i18n.js';
import { rebuildDesign, applyEdit, encodeDesign, optionsFor, generateDesign } from '../../core/index.js';
import { createBraceletStage } from '../components/bracelet-stage.js';
import { createPriceBlock } from '../components/price.js';
import { confirmModal } from '../components/modal.js';
import { addToCart } from '../state.js';

const LAYOUTS = [
  { id: 'symmetry', key: 'editor.layout.symmetry' },
  { id: 'gradient', key: 'editor.layout.gradient' },
  { id: 'interval', key: 'editor.layout.interval' },
];
// 隔珠密度在 core 中以间隔颗数表示：0（无）/ 6 颗一颗（少）/ 5（标准）/ 4（多）
const SPACERS = [
  { id: 0, key: 'editor.spacer.none' },
  { id: 6, key: 'editor.spacer.sparse' },
  { id: 5, key: 'editor.spacer.standard' },
  { id: 4, key: 'editor.spacer.dense' },
];
const METALS = [
  { id: 'silver', key: 'editor.metal.silver' },
  { id: 'gold', key: 'editor.metal.gold' },
];
const CHARMS = ['none', 'lotus', 'peace', 'pixiu'];
const DIAMETERS = [6, 8, 10];
const ROLES = ['main', 'support', 'accent'];
const WRIST_MIN = 14;
const WRIST_MAX = 20;
const MAX_CANDIDATES = 8;

const SAMPLE_INPUT = {
  date: '1990-05-15',
  time: '12:00',
  gender: 'f',
  wish: ['love'],
  options: { wrist: 15.5, beadDiameter: 8, metal: 'silver', charm: 'none', spacerInterval: 0 },
};

function decodeToken(token) {
  if (!token || token === 'sample') {
    try { return generateDesign(SAMPLE_INPUT); } catch { return null; }
  }
  return rebuildDesign(token);
}

function h(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function add(parent, ...children) {
  for (const child of children) if (child) parent.appendChild(child);
  return parent;
}

function findBeadByRole(design, role) {
  const layout = design?.composition?.layout || [];
  return layout.find((item) => item.kind === 'bead' && item.role === role) || layout.find((item) => item.kind === 'bead');
}

function beadName(bead) {
  if (!bead) return '';
  return getLang() === 'en' ? bead.en || bead.zh : bead.zh;
}

/**
 * @param {{navigate:Function, replace:Function, toast:Function, params:object, route:object}} ctx
 */
export function render(ctx) {
  const initialToken = ctx.params?.token || '';
  const initialDesign = decodeToken(initialToken);
  if (!initialDesign) {
    const wrap = h('div', 'view section-wrap');
    const title = h('h1', 'notfound__title', t('design.invalid.title'));
    const body = h('p', 'notfound__lead', t('design.invalid.body'));
    const link = h('a', 'zs-btn zs-btn--primary', t('design.invalid.cta'));
    link.href = '#/';
    wrap.append(title, body, link);
    return { el: wrap, destroy() { wrap.remove(); } };
  }

  let design = initialDesign;
  let token = encodeDesign(design);
  let dirty = false;
  let openRole = null;

  const root = h('div', 'view view--editor');
  let stage = null;
  let priceBlock = null;
  let priceInline = null;
  let statusEl = null;

  // ---------------- 顶部（桌面 sticky 操作区） ----------------
  const top = h('div', 'editor-top');
  const topInner = h('div', 'editor-top__inner section-wrap');
  const back = h('a', 'editor-top__back');
  back.href = `#/design/${token}`;
  back.innerHTML = `<span aria-hidden="true">←</span><span>${t('cta.back')}</span>`;
  const heading = h('div', 'editor-top__heading');
  const kicker = h('p', 'eyebrow__text', t('editor.kicker'));
  const title = h('h1', 'editor-top__title', t('editor.title'));
  add(heading, kicker, title);

  const right = h('div', 'editor-top__right');
  const editId = h('span', 'editor-top__id', design.id || '');
  const topActions = h('div', 'editor-top__actions');
  const resetBtn = h('button', 'zs-btn zs-btn--text editor-top__reset', t('cta.reset'));
  resetBtn.type = 'button';
  resetBtn.addEventListener('click', () => resetDesign());
  const stateEl = h('span', 'editor-top__state');
  statusEl = stateEl;
  const saveBtn = h('button', 'zs-btn zs-btn--primary editor-top__save', t('cta.save'));
  saveBtn.type = 'button';
  saveBtn.addEventListener('click', () => saveDesign());
  add(topActions, resetBtn, stateEl, saveBtn);
  add(right, editId, topActions);
  add(topInner, back, heading, right);
  top.appendChild(topInner);
  root.appendChild(top);

  // ---------------- 主布局 ----------------
  const layout = h('div', 'editor__layout section-wrap');
  const previewCol = h('div', 'editor__preview');
  const stagePanel = h('div', 'editor__stage-panel');
  stage = createBraceletStage({ design, view: 'circle', interactive: true });
  add(stagePanel, stage.el);

  const previewMeta = h('div', 'editor__preview-meta');
  const previewName = h('p', 'editor__preview-name', design.copy?.headline || '');
  const previewTag = h('p', 'editor__preview-tagline', design.copy?.tagline || '');
  const previewPrice = h('div', 'editor__preview-price');
  priceBlock = createPriceBlock({ retail: design.pricing.retail, compareAt: design.pricing.compareAt, size: 'md' });
  add(previewPrice, priceBlock.el);
  const liveNote = h('p', 'editor__live-note', t('editor.liveNote'));
  add(previewMeta, previewName, previewTag, previewPrice, liveNote);
  add(previewCol, stagePanel, previewMeta);

  const panel = h('div', 'editor__panel');
  add(layout, previewCol, panel);
  root.appendChild(layout);

  // ---------------- 面板 ----------------
  const sections = {};

  function panelSection(num, titleKey, body) {
    const section = h('section', 'panel-section');
    const head = h('header', 'panel-section__head');
    const numEl = h('span', 'panel-section__num', num);
    const titleEl = h('h2', 'panel-section__title', t(titleKey));
    add(head, numEl, titleEl);
    section.append(head, body);
    panel.appendChild(section);
    return section;
  }

  // 01 尺寸与材质
  const sizeBody = h('div', 'panel-section__body');

  const wristField = h('div', 'panel-field');
  const wristLabelRow = h('div', 'panel-field__row');
  const wristLabel = h('label', 'panel-field__label', t('editor.wrist'));
  wristLabel.htmlFor = 'editor-wrist';
  const wristOutput = h('output', 'panel-field__output');
  wristOutput.htmlFor = 'editor-wrist';
  wristOutput.textContent = t('editor.wristValue', { value: design.composition.wrist });
  add(wristLabelRow, wristLabel, wristOutput);
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.id = 'editor-wrist';
  slider.className = 'zs-range';
  slider.min = String(WRIST_MIN);
  slider.max = String(WRIST_MAX);
  slider.step = '0.5';
  slider.value = String(design.composition.wrist);

  function syncSliderPct() {
    const min = Number(slider.min);
    const max = Number(slider.max);
    const pct = ((Number(slider.value) - min) / (max - min)) * 100;
    slider.style.setProperty('--pct', `${Math.max(0, Math.min(100, pct))}%`);
  }
  syncSliderPct();

  slider.addEventListener('input', () => {
    const value = Number(slider.value);
    wristOutput.textContent = t('editor.wristValue', { value });
    syncSliderPct();
    apply({ wrist: value });
  });
  add(wristField, wristLabelRow, slider);

  const diaField = segmentedField('editor.diameter', 'bead', DIAMETERS.map((v) => ({ id: v, label: `${v}mm` })), design.options?.beadDiameter ?? design.composition.beadDiameter, (value) => {
    apply({ beadDiameter: Number(value) });
  });

  const metalField = segmentedField('editor.metal', 'metal', METALS.map((m) => ({ id: m.id, label: t(m.key) })), design.options?.metal ?? design.composition.metal, (value) => {
    apply({ metal: value });
  });

  add(sizeBody, wristField, diaField.el, metalField.el);
  panelSection('01', 'editor.section.size', sizeBody);

  // 02 三颗主珠
  const stonesBody = h('div', 'panel-section__body');
  const stonesIntro = h('p', 'panel-section__note', t('editor.wishNote'));
  stonesBody.appendChild(stonesIntro);
  const rolesWrap = h('div', 'role-list');
  stonesBody.appendChild(rolesWrap);
  panelSection('02', 'editor.section.stones', stonesBody);

  // 03 结构
  const structureBody = h('div', 'panel-section__body');
  const layoutField = segmentedField('editor.layout', 'layout', LAYOUTS.map((l) => ({ id: l.id, label: t(l.key) })), design.options?.layout ?? design.composition.layoutStyle ?? 'symmetry', (value) => {
    apply({ layout: value });
  });
  const spacerField = segmentedField('editor.spacer', 'spacer', SPACERS.map((s) => ({ id: s.id, label: t(s.key) })), design.options?.spacerInterval ?? design.composition.spacerInterval ?? 0, (value) => {
    apply({ spacerInterval: Number(value) });
  });
  const charmField = segmentedField('editor.charm', 'charm', CHARMS.map((id) => ({ id, label: t(`editor.charm.${id}`) })), design.options?.charm ?? design.composition.charm?.id ?? 'none', (value) => {
    apply({ charm: value });
  });
  add(structureBody, layoutField.el, spacerField.el, charmField.el);
  panelSection('03', 'editor.section.structure', structureBody);

  // 04 心愿
  const wishBody = h('div', 'panel-section__body');
  const wishChips = h('div', 'chips chips--tight');
  const wishInputs = new Map();
  UI_WISHES.forEach((wish) => {
    const label = h('label', 'chip chip--soft');
    const input = h('input', 'sr-only');
    input.type = 'checkbox';
    input.value = wish.id;
    input.checked = (design.input.wish || []).includes(wish.id);
    input.addEventListener('change', () => {
      const values = [...wishInputs.entries()].filter(([, node]) => node.checked).map(([id]) => id);
      apply({ wish: values }, { wish: true });
    });
    wishInputs.set(wish.id, input);
    add(label, input, h('span', 'chip__label', pick(wish)));
    wishChips.appendChild(label);
  });
  const wishNote = h('p', 'panel-section__note', t('editor.wishNote'));
  add(wishBody, wishChips, wishNote);
  panelSection('04', 'editor.section.wish', wishBody);

  // ---------------- 移动端底部条 ----------------
  const bar = h('div', 'editor-bar');
  const barInner = h('div', 'editor-bar__inner');
  const barPriceWrap = h('div', 'editor-bar__price');
  priceInline = createPriceBlock({ retail: design.pricing.retail, compareAt: design.pricing.compareAt, size: 'sm', showReference: false });
  barPriceWrap.append(h('span', 'editor-bar__label', t('editor.barPrice')), priceInline.el);
  const barActions = h('div', 'editor-bar__actions');
  const barAdd = h('button', 'zs-btn zs-btn--ghost editor-bar__add', t('cta.addToCart'));
  barAdd.type = 'button';
  barAdd.addEventListener('click', addCurrentToCart);
  const barSave = h('button', 'zs-btn zs-btn--primary editor-bar__save', t('cta.save'));
  barSave.type = 'button';
  barSave.addEventListener('click', saveDesign);
  add(barActions, barAdd, barSave);
  add(barInner, barPriceWrap, barActions);
  bar.appendChild(barInner);
  root.appendChild(bar);

  updateStatus();
  renderRoles();

  // ---------------- 分段控件 ----------------
  function segmentedField(labelKey, name, items, current, onSelect) {
    const field = h('div', 'panel-field');
    const label = h('span', 'panel-field__label', t(labelKey));
    const group = h('div', 'segmented');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', t(labelKey));
    const buttons = [];
    for (const item of items) {
      const btn = h('button', 'segmented__btn', item.label);
      btn.type = 'button';
      btn.dataset.value = String(item.id);
      btn.setAttribute('aria-pressed', String(current === item.id));
      btn.addEventListener('click', () => {
        buttons.forEach((b) => b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'));
        onSelect(item.id);
      });
      buttons.push(btn);
      group.appendChild(btn);
    }
    add(field, label, group);
    const api = { el: field, set(value) { buttons.forEach((b) => b.setAttribute('aria-pressed', b.dataset.value === String(value) ? 'true' : 'false')); } };
    if (name === 'bead') sections.dia = api;
    else sections[name] = api;
    return api;
  }

  // ---------------- 三珠卡 ----------------
  function renderRoles() {
    rolesWrap.replaceChildren();
    for (const role of ROLES) {
      const bead = findBeadByRole(design, role);
      const pickData = (design.picks || []).find((p) => p.role === role) || {};
      const card = h('div', `role-card role-card--${role}`);

      const head = h('div', 'role-card__head');
      const swatch = h('span', 'role-card__swatch');
      swatch.style.setProperty('--hex', bead?.hex || '#ddd');
      swatch.style.setProperty('--hex2', bead?.hex2 || '#fff');
      swatch.style.setProperty('--hex3', bead?.hex3 || '#999');
      swatch.setAttribute('aria-hidden', 'true');

      const names = h('div', 'role-card__names');
      names.append(
        h('span', 'role-card__role', t(`editor.role.${role}`)),
        h('strong', 'role-card__name', beadName(bead)),
        h('span', 'role-card__en', bead?.en || ''),
      );

      const replaceBtn = h('button', 'role-card__replace');
      replaceBtn.type = 'button';
      replaceBtn.setAttribute('aria-expanded', String(openRole === role));
      replaceBtn.textContent = openRole === role ? t('editor.collapse') : t('editor.replace');
      replaceBtn.addEventListener('click', () => {
        openRole = openRole === role ? null : role;
        renderRoles();
      });

      add(head, swatch, names, replaceBtn);
      card.appendChild(head);

      if (openRole === role) {
        const candidates = optionsFor(role, design.bazi, {
          wish: design.input.wish || [],
          gender: design.input.gender,
          picked: (design.picks || []).map((entry) => entry.crystalId),
        }).slice(0, MAX_CANDIDATES);
        const list = h('div', 'candidate-list');
        list.setAttribute('role', 'group');
        list.setAttribute('aria-label', `${t(`editor.role.${role}`)} · ${t('editor.replace')}`);
        for (const crystal of candidates) {
          const isCurrent = crystal.id === pickData.crystalId;
          const item = h('button', `candidate${isCurrent ? ' is-current' : ''}`);
          item.type = 'button';
          item.setAttribute('aria-pressed', String(isCurrent));
          const dot = h('span', 'candidate__dot');
          dot.style.setProperty('--hex', crystal.hex);
          dot.style.setProperty('--hex2', crystal.hex2);
          dot.setAttribute('aria-hidden', 'true');
          const text = h('span', 'candidate__text');
          text.append(
            h('b', '', getLang() === 'en' ? crystal.en : crystal.zh),
            h('em', '', crystal.en),
          );
          const cost = h('span', 'candidate__cost', t('editor.unitCost', { price: crystal.unitCost }));
          add(item, dot, text, cost);
          item.title = crystal.why || '';
          item.addEventListener('click', () => {
            openRole = null;
            apply({ replace: { [role]: crystal.id } });
            renderRoles();
          });
          list.appendChild(item);
        }
        card.appendChild(list);
      }

      rolesWrap.appendChild(card);
    }
  }

  // ---------------- 应用改动 ----------------
  function apply(patch, { wish = false } = {}) {
    let next = null;
    try {
      next = applyEdit(design, patch);
    } catch (error) {
      console.warn('[editor] applyEdit rejected', error);
      ctx.toast?.(t('editor.applyFailed'), { tone: 'danger' });
      return;
    }
    if (!next) return;
    design = next;
    token = encodeDesign(design);
    dirty = true;
    stage?.update(design);
    priceBlock?.set(design.pricing, true);
    priceInline?.set(design.pricing, false);
    previewName.textContent = design.copy?.headline || '';
    previewTag.textContent = design.copy?.tagline || '';
    slider.value = String(design.composition.wrist);
    wristOutput.textContent = t('editor.wristValue', { value: design.composition.wrist });
    syncSliderPct();
    sections.dia?.set(design.options?.beadDiameter ?? design.composition.beadDiameter);
    sections.metal?.set(design.options?.metal ?? design.composition.metal);
    sections.layout?.set(design.options?.layout ?? design.composition.layoutStyle);
    sections.spacer?.set(design.options?.spacerInterval ?? design.composition.spacerInterval);
    sections.charm?.set(design.options?.charm ?? design.composition.charm?.id ?? 'none');
    // 重置按钮/保存状态
    updateStatus();
    renderRoles();
    if (wish) ctx.toast?.(t('editor.wishNote'));
  }

  function updateStatus() {
    if (!statusEl) return;
    statusEl.textContent = dirty ? t('editor.unsaved') : t('editor.savedState');
    statusEl.classList.toggle('is-dirty', dirty);
    saveBtn?.classList.toggle('is-dirty', dirty);
  }

  function saveDesign() {
    dirty = false;
    updateStatus();
    const targetToken = token;
    ctx.replace(`/design/${targetToken}?mine=1`);
    ctx.toast?.(t('editor.saved'));
  }

  function addCurrentToCart() {
    addToCart(design, { token });
    ctx.toast?.(t('design.added'));
  }

  async function resetDesign() {
    const ok = await confirmModal({
      title: t('editor.resetTitle'),
      description: t('editor.resetBody'),
      confirmLabel: t('cta.reset'),
      cancelLabel: t('cta.cancel'),
    });
    if (!ok) return;
    design = decodeToken(initialToken) || initialDesign;
    token = encodeDesign(design);
    dirty = false;
    openRole = null;
    stage?.update(design);
    priceBlock?.set(design.pricing, false);
    priceInline?.set(design.pricing, false);
    previewName.textContent = design.copy?.headline || '';
    previewTag.textContent = design.copy?.tagline || '';
    slider.value = String(design.composition.wrist);
    wristOutput.textContent = t('editor.wristValue', { value: design.composition.wrist });
    syncSliderPct();
    sections.dia?.set(design.options?.beadDiameter ?? design.composition.beadDiameter);
    sections.metal?.set(design.options?.metal ?? design.composition.metal);
    sections.layout?.set(design.options?.layout ?? design.composition.layoutStyle);
    sections.spacer?.set(design.options?.spacerInterval ?? design.composition.spacerInterval);
    sections.charm?.set(design.options?.charm ?? design.composition.charm?.id ?? 'none');
    wishInputs.forEach((input, id) => { input.checked = (design.input.wish || []).includes(id); });
    updateStatus();
    renderRoles();
    ctx.toast?.(t('editor.resetDone'));
  }

  // 初始状态
  sections.dia?.set(design.options?.beadDiameter ?? design.composition.beadDiameter);

  function destroy() {
    stage?.destroy();
    root.remove();
  }

  return { el: root, destroy };
}
