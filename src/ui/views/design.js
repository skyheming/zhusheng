// src/ui/views/design.js — 设计结果页（同时也是分享页）
// 已接入 src/core/index.js（mock.js 保留为离线兜底，不再被视图引用）。

import {
  t, getLang, elementLabel, ELEMENT_NAMES,
} from '../i18n.js';
import {
  rebuildDesign, applyEdit, encodeDesign, generateVariation, designShortId, generateDesign,
} from '../../core/index.js';
import { createBraceletStage } from '../components/bracelet-stage.js';
import { createPriceBlock } from '../components/price.js';
import { createElementBar, createPillars, createDayMaster, elementHex } from '../components/element-bar.js';
import { createShareCard, copyShareLink } from '../components/share-card.js';
import { addToCart } from '../state.js';

const DIAMETERS = [6, 8, 10];

// #/design/sample 深链：用同一生辰即时生成示例（core 支持确定性生成）
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

const PROMISE_ICONS = [
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3.5 19 8v8l-7 4.5L5 16V8l7-4.5Z" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/><path d="M12 3.5V20.5M5 8l7 4.5L19 8" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.1"/><path d="M12 7v5.3l3.4 2" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4.5 8.5h15M6.5 8.5v9a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-9" stroke="currentColor" stroke-width="1.1"/><path d="M9 8.5V6.8a3 3 0 0 1 6 0v1.7" stroke="currentColor" stroke-width="1.1"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5" y="4" width="14" height="16" stroke="currentColor" stroke-width="1.1"/><path d="M8.5 8.5h7M8.5 12h4" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>',
];

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

function sectionHead(kicker, title, id) {
  const head = h('header', 'section-head');
  const eyebrow = h('p', 'eyebrow');
  const line = h('span', 'eyebrow__line');
  line.setAttribute('aria-hidden', 'true');
  eyebrow.append(line, h('span', 'eyebrow__text', kicker));
  const titleEl = h('h2', 'section-title', title);
  if (id) titleEl.id = id;
  add(head, eyebrow, titleEl);
  return head;
}

function initReveal(root) {
  const nodes = [...root.querySelectorAll('[data-reveal]')];
  if (!nodes.length) return () => {};
  let reduced = false;
  try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* ignore */ }
  if (reduced || !('IntersectionObserver' in window)) {
    nodes.forEach((node) => node.classList.add('is-visible'));
    return () => {};
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });
  nodes.forEach((node) => { node.classList.add('reveal'); io.observe(node); });
  return () => io.disconnect();
}

function findBeadByRole(design, role) {
  const layout = design?.composition?.layout || [];
  return layout.find((item) => item.kind === 'bead' && item.role === role)
    || layout.find((item) => item.kind === 'bead');
}

function beadDisplayName(bead) {
  if (!bead) return '';
  return getLang() === 'en' ? bead.en || bead.zh : bead.zh;
}

/** 来自分享页的判断：显式 ?ref=share 一定显示；?mine=1 或站内跳转进入则不显示 */
function comesFromShare(query) {
  if (query?.get('ref') === 'share' || query?.get('from') === 'share') return true;
  if (query?.get('mine') === '1') return false;
  try {
    return !sessionStorage.getItem('zs.internal.v1');
  } catch {
    return false;
  }
}

/**
 * @param {{navigate:(path:string)=>void, replace:(path:string)=>void, toast:Function, route:object, params:object}} ctx
 */
export function render(ctx) {
  const tokenParam = ctx.params?.token || '';
  let design = decodeToken(tokenParam);
  let currentToken = tokenParam;

  if (!design) {
    const invalid = buildInvalid();
    return { el: invalid, destroy() { invalid.remove(); } };
  }

  // sample 深链：分享/编辑都使用真实编码 token
  if (tokenParam === 'sample' || !tokenParam) currentToken = encodeDesign(design);

  const root = h('div', 'view view--design');
  const cleanups = [];
  let stage = null;
  let priceBlock = null;
  let statusEl = null;
  let wristSelectEl = null;
  let specTable = null;

  let barPrice = null;

  const shared = comesFromShare(ctx.route?.query);
  const defaultReadout = () => {
    const comp = design.composition;
    return `${design.copy?.headline || design.theme?.name} · ${t('design.value.pieces', { count: comp.beadCount })} · ${t('design.value.mm', { value: comp.beadDiameter })}`;
  };

  root.appendChild(buildTopBar());

  const main = h('div', 'design__main section-wrap');
  const layout = h('div', 'design__layout');
  const previewCol = buildPreview();
  const buyCol = buildBuyPanel();
  add(layout, previewCol, buyCol);
  main.appendChild(layout);
  root.appendChild(main);
  root.appendChild(buildBuyBar());

  root.appendChild(buildBazi());
  root.appendChild(buildPicks());
  root.appendChild(buildSpec());
  root.appendChild(buildCareFaq());
  root.appendChild(buildVariation());
  if (shared) root.appendChild(buildCreateMine());

  cleanups.push(initReveal(root));

  // ---------- 顶部 ----------
  function buildTopBar() {
    const bar = h('div', 'design-topbar');
    const inner = h('div', 'design-topbar__inner section-wrap');

    const back = h('a', 'design-topbar__back');
    back.href = '#/';
    back.innerHTML = `<span aria-hidden="true">←</span><span>${t('design.back')}</span>`;

    const id = h('span', 'design-topbar__id');
    id.append(
      h('span', 'design-topbar__id-label', t('home.hero.cardLabel')),
      h('strong', 'design-topbar__id-value', design.id || designShortId(currentToken)),
    );

    const actions = h('div', 'design-topbar__actions');
    const shareBtn = h('button', 'zs-btn zs-btn--text design-topbar__share');
    shareBtn.type = 'button';
    shareBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 10.5V2m0 0L5 5m3-3 3 3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 8.5v3.8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg><span>${t('cta.share')}</span>`;
    shareBtn.addEventListener('click', () => copyShareLink(currentToken));
    const editLink = h('a', 'zs-btn zs-btn--ghost design-topbar__edit');
    editLink.href = `#/design/${currentToken}/edit`;
    editLink.textContent = t('cta.edit');
    add(actions, shareBtn, editLink);

    add(inner, back, id, actions);
    bar.appendChild(inner);

    if (shared) {
      const banner = h('div', 'shared-banner');
      const bannerInner = h('div', 'shared-banner__inner section-wrap');
      const text = h('p', 'shared-banner__text', t('design.shared.title'));
      const cta = h('a', 'shared-banner__cta', t('design.shared.cta'));
      cta.href = '#/';
      add(bannerInner, text, cta);
      banner.appendChild(bannerInner);
      bar.appendChild(banner);
    }

    return bar;
  }

  // ---------- 左：预览 ----------
  function buildPreview() {
    const col = h('div', 'design__preview');

    const stagePanel = h('div', 'design__stage-panel');
    stage = createBraceletStage({
      design,
      view: '3d',
      interactive: true,
      onBeadHover: (item) => updateReadout(item),
    });

    const hint = h('p', 'design__drag-hint', t('design.dragHint3d'));
    const readout = h('div', 'design__readout');
    readout.setAttribute('aria-live', 'polite');
    statusEl = h('span', 'design__readout-default', defaultReadout());
    readout.appendChild(statusEl);

    add(stagePanel, stage.el, hint, readout);
    const visual = h('div', 'design__visual');
    visual.appendChild(stagePanel);
    const visualCaption = h('p', 'design__visual-caption');
    visualCaption.append(
      h('span', 'design__visual-num', design.id || designShortId(currentToken)),
      h('span', '', `${t('home.hero.cardLabel')} · ${design.theme?.name || ''}`),
    );
    visual.appendChild(visualCaption);
    col.appendChild(visual);

    return col;
  }

  function updateReadout(item) {
    if (!statusEl) return;
    if (!item) {
      statusEl.textContent = defaultReadout();
      return;
    }
    if (item.kind === 'bead') {
      const elementKey = ELEMENT_NAMES[item.element];
      const elementText = elementKey ? elementLabel(elementKey) : '';
      statusEl.textContent = `${beadDisplayName(item)} · ${elementText} · ${t(`design.picks.${item.role || 'main'}`)}`;
    } else if (item.kind === 'spacer') {
      statusEl.textContent = `${getLang() === 'en' ? 'Silver spacer' : '银隔珠'} · ${design.composition.metal === 'gold' ? '古金' : 'S925'}`;
    } else {
      statusEl.textContent = `${beadDisplayName(item)} · ${t('design.spec.charm')}`;
    }
  }

  // ---------- 右：购买栏 ----------
  function buildBuyPanel() {
    const aside = h('aside', 'design__buy');
    aside.setAttribute('aria-label', t('design.eyebrow'));

    const inner = h('div', 'design__buy-inner');
    inner.append(h('p', 'design__eyebrow', t('design.eyebrow')));

    const name = h('h1', 'design__name', design.copy?.headline || design.theme?.name);
    const tagline = h('p', 'design__tagline', design.copy?.tagline || '');
    inner.append(name, tagline);

    priceBlock = createPriceBlock({
      retail: design.pricing.retail,
      compareAt: design.pricing.compareAt,
      size: 'lg',
    });
    const priceMeta = h('p', 'design__price-meta', t('design.tax'));
    inner.append(priceBlock.el, priceMeta);

    // 尺寸
    const options = h('div', 'design__options');

    const wristGroup = h('div', 'option-group');
    const wristLabel = h('span', 'option-group__label');
    wristLabel.innerHTML = `<span>${t('design.wrist')}</span><em>WRIST</em>`;
    const wristSelect = h('select', 'field__input field__select design__select');
    wristSelect.setAttribute('aria-label', t('design.wrist'));
    const currentWrist = Number(design.composition.wrist);
    const wristValues = [];
    for (let value = 14; value <= 20; value += 0.5) wristValues.push(value);
    if (!wristValues.includes(currentWrist)) {
      wristValues.push(currentWrist);
      wristValues.sort((a, b) => a - b);
    }
    for (const value of wristValues) {
      const option = h('option', '', t('design.value.cm', { value: value.toFixed(1) }));
      option.value = String(value);
      option.selected = value === currentWrist;
      wristSelect.appendChild(option);
    }
    wristSelect.addEventListener('change', () => {
      applyOption({ wrist: Number(wristSelect.value) });
    });
    wristSelectEl = wristSelect;
    add(wristGroup, wristLabel, wristSelect);

    const diaGroup = h('div', 'option-group');
    const diaLabel = h('span', 'option-group__label');
    diaLabel.innerHTML = `<span>${t('design.diameter')}</span><em>BEAD</em>`;
    const diaChips = h('div', 'chips chips--tight');
    const diaButtons = [];
    for (const value of DIAMETERS) {
      const btn = h('button', 'chip chip--size', `${value}mm`);
      btn.type = 'button';
      btn.setAttribute('aria-pressed', String(Number(design.composition.beadDiameter) === value));
      btn.dataset.value = String(value);
      btn.addEventListener('click', () => {
        if (Number(design.composition.beadDiameter) === value) return;
        applyOption({ beadDiameter: value });
        diaButtons.forEach((b) => b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'));
      });
      diaButtons.push(btn);
      diaChips.appendChild(btn);
    }
    add(diaGroup, diaLabel, diaChips);

    add(options, wristGroup, diaGroup);
    inner.appendChild(options);

    // 操作
    const actions = h('div', 'design__actions');
    const addBtn = h('button', 'zs-btn zs-btn--primary design__add');
    addBtn.type = 'button';
    addBtn.innerHTML = `<span>${t('cta.addToCart')}</span><span class="zs-btn__arrow" aria-hidden="true">＋</span>`;
    addBtn.addEventListener('click', () => {
      addToCart(design, { token: currentToken });
      ctx.toast?.(t('design.added'));
    });
    const editLink = h('a', 'zs-btn zs-btn--ghost design__edit', t('cta.edit'));
    editLink.href = `#/design/${currentToken}/edit`;
    add(actions, addBtn, editLink);
    inner.appendChild(actions);

    // 承诺
    const promises = h('ul', 'design__promises');
    [1, 2, 3, 4].forEach((n, index) => {
      const li = h('li', 'design__promise');
      const icon = h('span', 'design__promise-icon');
      icon.innerHTML = PROMISE_ICONS[index];
      icon.setAttribute('aria-hidden', 'true');
      li.append(icon, h('span', '', t(`design.promise${n}`)));
      promises.appendChild(li);
    });
    inner.appendChild(promises);

    // 分享卡
    const share = createShareCard({ token: currentToken, designId: design.id || designShortId(currentToken) });
    inner.appendChild(share);

    aside.appendChild(inner);
    return aside;
  }

  // 移动端固定购买条（<1024 显示；桌面隐藏）
  function buildBuyBar() {
    const bar = h('div', 'design-bar');
    const inner = h('div', 'design-bar__inner');

    const priceWrap = h('div', 'design-bar__price');
    priceWrap.appendChild(h('span', 'design-bar__label', design.copy?.headline || design.theme?.name || ''));
    barPrice = createPriceBlock({
      retail: design.pricing.retail,
      compareAt: design.pricing.compareAt,
      size: 'sm',
      showReference: false,
    });
    priceWrap.appendChild(barPrice.el);

    const addBtn = h('button', 'zs-btn zs-btn--primary design-bar__add');
    addBtn.type = 'button';
    addBtn.innerHTML = `<span>${t('cta.addToCart')}</span><span class="zs-btn__arrow" aria-hidden="true">＋</span>`;
    addBtn.addEventListener('click', () => {
      addToCart(design, { token: currentToken });
      ctx.toast?.(t('design.added'));
    });

    add(inner, priceWrap, addBtn);
    bar.appendChild(inner);
    return bar;
  }

  function applyOption(patch) {
    const next = applyEdit(design, patch);
    if (!next) return;
    design = next;
    const nextToken = encodeDesign(design);
    currentToken = nextToken;
    // 同步 URL（不新增历史、不重渲染）；保留 mine 标记，避免刷新后误显示分享横幅
    try {
      const isMine = ctx.route?.query?.get('mine') === '1';
      const url = `${window.location.pathname}${window.location.search}#/design/${nextToken}${isMine ? '?mine=1' : ''}`;
      window.history.replaceState(null, '', url);
    } catch { /* ignore */ }
    // 更新编辑链接与分享链接
    root.querySelectorAll('.design__edit, .design-topbar__edit').forEach((link) => {
      link.href = `#/design/${nextToken}/edit`;
    });
    stage?.update(design);
    priceBlock?.set(design.pricing, true);
    barPrice?.set(design.pricing, false);
    renderSpecRows();
    if (wristSelectEl) wristSelectEl.value = String(design.composition.wrist);
    if (statusEl) statusEl.textContent = defaultReadout();
    const meta = root.querySelector('.design__visual-caption');
    if (meta) {
      meta.replaceChildren(
        h('span', 'design__visual-num', design.id || designShortId(currentToken)),
        h('span', '', `${t('home.hero.cardLabel')} · ${design.theme?.name || ''}`),
      );
    }
    // 替换分享卡（token 变了）
    const shareHost = root.querySelector('.zs-share');
    if (shareHost) {
      const fresh = createShareCard({ token: currentToken, designId: design.id || designShortId(currentToken) });
      shareHost.replaceWith(fresh);
    }
  }

  // ---------- 八字 ----------
  function buildBazi() {
    const section = h('section', 'design-section design-bazi');
    section.setAttribute('aria-labelledby', 'bazi-title');
    const wrap = h('div', 'section-wrap');
    wrap.appendChild(sectionHead(t('design.bazi.kicker'), t('design.bazi.title'), 'bazi-title'));

    const grid = h('div', 'design-bazi__grid');
    const pillarsCard = h('div', 'design-bazi__pillars');
    pillarsCard.dataset.reveal = 'true';
    const pillars = createPillars(design.bazi);
    const dayMaster = createDayMaster(design.bazi);
    add(pillarsCard, pillars, dayMaster);

    const balance = h('div', 'design-bazi__balance');
    balance.dataset.reveal = 'true';
    const bar = createElementBar(design.bazi.elements, {
      favorable: { ...design.bazi.favorable, missing: design.bazi.missing },
    });
    balance.appendChild(bar);

    const conclusion = h('p', 'design-bazi__conclusion');
    const primary = design.bazi.favorable?.primary;
    const secondary = design.bazi.favorable?.secondary;
    const max = Object.keys(design.bazi.elements || {}).sort((a, b) => design.bazi.elements[b] - design.bazi.elements[a])[0];
    conclusion.textContent = design.bazi.favorable?.reason || t('design.bazi.conclusion', {
      primary: elementLabel(primary),
      secondary: elementLabel(secondary),
      max: elementLabel(max),
    });
    balance.appendChild(conclusion);

    const narrative = h('p', 'design-bazi__reading', design.copy?.reading || '');
    balance.appendChild(narrative);

    add(grid, pillarsCard, balance);
    wrap.appendChild(grid);
    section.appendChild(wrap);
    return section;
  }

  // ---------- 三珠故事 ----------
  function buildPicks() {
    const section = h('section', 'design-section design-picks');
    section.setAttribute('aria-labelledby', 'picks-title');
    const wrap = h('div', 'section-wrap');
    wrap.appendChild(sectionHead(t('design.picks.kicker'), t('design.picks.title'), 'picks-title'));

    const grid = h('dl', 'picks__grid');
    const roles = ['main', 'support', 'accent'];
    roles.forEach((role) => {
      const pickData = (design.picks || []).find((p) => p.role === role) || {};
      const bead = findBeadByRole(design, role) || {};
      const card = h('div', `pick pick--${role}`);
      card.dataset.reveal = 'true';

      const swatch = h('div', 'pick__swatch');
      swatch.setAttribute('aria-hidden', 'true');
      swatch.style.setProperty('--hex', bead.hex || '#ddd');
      swatch.style.setProperty('--hex2', bead.hex2 || '#fff');
      swatch.style.setProperty('--hex3', bead.hex3 || '#999');
      swatch.style.setProperty('--texture', bead.texture || 'none');

      const head = h('div', 'pick__head');
      const roleTag = h('span', 'pick__role', t(`design.picks.${role}`));
      const elementKey = ELEMENT_NAMES[bead.element];
      const elementTag = h('span', 'pick__element');
      elementTag.style.setProperty('--c', elementHex(elementKey));
      elementTag.textContent = elementKey ? elementLabel(elementKey) : '';
      add(head, roleTag, elementTag);

      const name = h('h3', 'pick__name', beadDisplayName(bead) || pickData.crystalId || '');
      const nameEn = h('p', 'pick__name-en', bead.en || '');
      const reasons = h('ul', 'pick__reasons');
      (pickData.reasons || []).slice(0, 3).forEach((reason) => {
        reasons.appendChild(h('li', '', reason));
      });

      add(card, swatch, head, name, nameEn, reasons);
      grid.appendChild(card);
    });

    wrap.appendChild(grid);
    section.appendChild(wrap);
    return section;
  }

  // ---------- 规格 ----------
  function renderSpecRows() {
    if (!specTable) return;
    const comp = design.composition;
    const spacerCount = (comp.layout || []).filter((item) => item.kind === 'spacer').length;
    const charm = comp.charm?.id && comp.charm.id !== 'none' ? t(`editor.charm.${comp.charm.id}`) : t('editor.charm.none');
    const rows = [
      [t('design.spec.beadCount'), t('design.value.pieces', { count: comp.beadCount || 0 })],
      [t('design.spec.beadDiameter'), t('design.value.mm', { value: comp.beadDiameter || 8 })],
      [t('design.spec.wrist'), t('design.value.cm', { value: comp.wrist || '' })],
      [t('design.spec.metal'), comp.metal === 'gold' ? t('design.spec.metal.gold') : t('design.spec.metal.silver')],
      [t('design.spec.spacer'), spacerCount
        ? t('design.spec.spacerValue', { count: spacerCount, every: comp.spacerInterval || 5 })
        : t('design.spec.none')],
      [t('design.spec.charm'), charm],
      [t('design.spec.total'), t('design.value.total', { count: (comp.layout || []).length })],
    ];
    specTable.replaceChildren();
    rows.forEach(([label, value]) => {
      const row = h('div', 'spec-table__row');
      row.append(h('dt', 'spec-table__key', label), h('dd', 'spec-table__value', value));
      specTable.appendChild(row);
    });
  }

  function buildSpec() {
    const section = h('section', 'design-section design-spec');
    section.setAttribute('aria-labelledby', 'spec-title');
    const wrap = h('div', 'section-wrap');
    wrap.appendChild(sectionHead(t('design.spec.kicker'), t('design.spec.title'), 'spec-title'));

    const layoutBox = h('div', 'design-spec__layout');
    const table = h('dl', 'spec-table');
    specTable = table;
    renderSpecRows();

    const story = h('div', 'design-spec__story');
    story.dataset.reveal = 'true';
    story.append(
      h('h3', 'design-spec__story-title', t('design.spec.storyTitle')),
      h('p', 'design-spec__story-body', design.copy?.designStory || ''),
      h('p', 'design-spec__story-seal', design.id || designShortId(currentToken)),
    );

    add(layoutBox, table, story);
    wrap.appendChild(layoutBox);
    section.appendChild(wrap);
    return section;
  }

  // ---------- 养护 + FAQ ----------
  function buildCareFaq() {
    const section = h('section', 'design-section design-care');
    section.setAttribute('aria-labelledby', 'care-title');
    const wrap = h('div', 'section-wrap');
    const grid = h('div', 'design-care__grid');

    const care = h('div', 'design-care__care');
    care.dataset.reveal = 'true';
    care.appendChild(sectionHead(t('design.care.kicker'), t('design.care.title'), 'care-title'));
    const list = h('ul', 'care-list');
    [1, 2, 3, 4].forEach((n) => {
      list.appendChild(h('li', 'care-list__item', t(`design.care.${n}`)));
    });
    care.appendChild(list);

    const faq = h('div', 'design-care__faq');
    faq.dataset.reveal = 'true';
    const faqTitle = h('h2', 'section-title design-care__faq-title', t('design.faq.title'));
    faq.appendChild(faqTitle);
    [1, 2, 3].forEach((n, index) => {
      const details = h('details', 'faq__item');
      if (index === 0) details.open = true;
      const summary = h('summary', 'faq__summary');
      const sign = h('span', 'faq__sign', '+');
      sign.setAttribute('aria-hidden', 'true');
      summary.append(h('span', 'faq__q', t(`home.faq.${n}.q`)), sign);
      const body = h('div', 'faq__body');
      body.appendChild(h('p', '', t(`home.faq.${n}.a`)));
      add(details, summary, body);
      faq.appendChild(details);
    });

    add(grid, care, faq);
    wrap.appendChild(grid);
    section.appendChild(wrap);
    return section;
  }

  // ---------- 换一批 ----------
  function buildVariation() {
    const section = h('section', 'design-variation');
    section.setAttribute('aria-labelledby', 'variation-title');
    const inner = h('div', 'design-variation__inner section-wrap');
    const copy = h('div', 'design-variation__copy');
    const eyebrow = h('p', 'eyebrow');
    const line = h('span', 'eyebrow__line');
    line.setAttribute('aria-hidden', 'true');
    eyebrow.append(line, h('span', 'eyebrow__text', 'ANOTHER ROUND'));
    const title = h('h2', 'design-variation__title', t('design.variation.title'));
    title.id = 'variation-title';
    copy.append(eyebrow, title, h('p', 'design-variation__lead', t('design.variation.lead')));

    const btn = h('button', 'zs-btn zs-btn--ghost design-variation__btn');
    btn.type = 'button';
    btn.innerHTML = `<span>${t('cta.variation')}</span><span class="zs-btn__arrow" aria-hidden="true">↻</span>`;
    btn.addEventListener('click', () => {
      btn.disabled = true;
      const next = generateVariation(design);
      if (!next) { btn.disabled = false; return; }
      const nextToken = encodeDesign(next);
      ctx.navigate(`/design/${nextToken}?mine=1`);
    });

    add(inner, copy, btn);
    section.appendChild(inner);
    return section;
  }

  function buildCreateMine() {
    const section = h('section', 'design-create');
    const inner = h('div', 'design-create__inner section-wrap');
    const copy = h('div', 'design-create__copy');
    copy.append(
      h('h2', 'design-create__title', t('design.createMine.title')),
      h('p', 'design-create__lead', t('design.createMine.lead')),
    );
    const btn = h('a', 'zs-btn zs-btn--primary', t('cta.generateMine'));
    btn.href = '#/';
    add(inner, copy, btn);
    section.appendChild(inner);
    return section;
  }

  // ---------- 清理 ----------
  function destroy() {
    cleanups.forEach((fn) => fn?.());
    stage?.destroy();
    root.remove();
  }

  return { el: root, destroy };
}

function buildInvalid() {
  const wrap = h('div', 'view view--notfound view--invalid section-wrap');
  const seal = h('span', 'notfound__seal');
  seal.setAttribute('aria-hidden', 'true');
  seal.textContent = '断';
  const kicker = h('p', 'eyebrow__text', 'INCOMPLETE');
  const title = h('h1', 'notfound__title', t('design.invalid.title'));
  const lead = h('p', 'notfound__lead', t('design.invalid.body'));
  const actions = h('div', 'notfound__actions');
  const home = h('a', 'zs-btn zs-btn--primary', t('design.invalid.cta'));
  home.href = '#/';
  const cart = h('a', 'zs-btn zs-btn--ghost', t('cta.viewBag'));
  cart.href = '#/cart';
  add(actions, home, cart);
  add(wrap, seal, kicker, title, lead, actions);
  return wrap;
}
