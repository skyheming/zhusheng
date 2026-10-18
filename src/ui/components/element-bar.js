// src/ui/components/element-bar.js — 五行分布（自绘，不引图表库）+ 四柱卡
import { t, getLang, elementLabel, ELEMENT_HEX, ELEMENT_ZH, ELEMENT_EN, ELEMENT_NAMES } from '../i18n.js';

const STEM_ELEMENT = {
  甲: 'wood', 乙: 'wood', 丙: 'fire', 丁: 'fire', 戊: 'earth',
  己: 'earth', 庚: 'metal', 辛: 'metal', 壬: 'water', 癸: 'water',
};
const BRANCH_ELEMENT = {
  子: 'water', 丑: 'earth', 寅: 'wood', 卯: 'wood', 辰: 'earth', 巳: 'fire',
  午: 'fire', 未: 'earth', 申: 'metal', 酉: 'metal', 戌: 'earth', 亥: 'water',
};

const ORDER = ['wood', 'fire', 'earth', 'metal', 'water'];

export function elementHex(key) {
  return ELEMENT_HEX[key] || 'var(--ink-muted)';
}

function elementKeyOf(value) {
  if (!value) return null;
  if (ELEMENT_HEX[value]) return value;
  return ELEMENT_NAMES[value] || null;
}

function elementName(key) {
  if (!key) return '';
  return getLang() === 'en' ? ELEMENT_EN[key] || key : ELEMENT_ZH[key] || key;
}

/**
 * 五行分布条。
 * @param {Record<string,number>} elements 归一化数值（合计 100）
 * @param {{favorable?:{primary?:string,secondary?:string,avoid?:string[]},title?:string,showValues?:boolean}} options
 */
export function createElementBar(elements = {}, { favorable = {}, showValues = true } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'zs-elbar';

  const values = ORDER.map((key) => ({ key, value: Number(elements[key]) || 0 }));
  const max = Math.max(...values.map((v) => v.value), 1);

  const head = document.createElement('div');
  head.className = 'zs-elbar__head';
  const title = document.createElement('span');
  title.className = 'zs-elbar__title';
  title.textContent = t('design.bazi.elements');
  head.appendChild(title);
  if (favorable.primary) {
    const badge = document.createElement('span');
    badge.className = 'zs-elbar__badge';
    badge.textContent = `${t('design.bazi.favorable')} · ${elementName(favorable.primary)}`;
    head.appendChild(badge);
  }
  wrap.appendChild(head);

  const rows = document.createElement('div');
  rows.className = 'zs-elbar__rows';
  const summary = values
    .map(({ key, value }) => `${elementName(key)} ${value}`)
    .join('，');
  rows.setAttribute('role', 'img');
  rows.setAttribute('aria-label', `${t('design.bazi.elements')}：${summary}`);

  for (const { key, value } of values) {
    const row = document.createElement('div');
    row.className = 'zs-elbar__row';
    if (favorable.primary === key) row.classList.add('is-favorable');
    if ((favorable.avoid || []).includes(key)) row.classList.add('is-avoid');
    row.dataset.element = key;

    const name = document.createElement('span');
    name.className = 'zs-elbar__name';
    const nameZh = getLang() === 'en' ? ELEMENT_EN[key] : ELEMENT_ZH[key];
    const nameAlt = getLang() === 'en' ? ELEMENT_ZH[key] : ELEMENT_EN[key];
    name.innerHTML = '';
    const strong = document.createElement('b');
    strong.textContent = nameZh;
    const em = document.createElement('em');
    em.textContent = nameAlt;
    name.append(strong, em);

    const track = document.createElement('span');
    track.className = 'zs-elbar__track';
    const fill = document.createElement('span');
    fill.className = 'zs-elbar__fill';
    fill.style.setProperty('--c', elementHex(key));
    fill.style.width = `${Math.max(2, (value / max) * 100)}%`;
    track.appendChild(fill);

    const val = document.createElement('span');
    val.className = 'zs-elbar__value';
    val.textContent = showValues ? String(value) : '';

    row.append(name, track, val);
    rows.appendChild(row);
  }
  wrap.appendChild(rows);

  const footer = document.createElement('div');
  footer.className = 'zs-elbar__foot';
  if (favorable.missing && favorable.missing.length) {
    const missing = document.createElement('span');
    missing.className = 'zs-elbar__note';
    missing.textContent = `${t('design.bazi.missing')} ${favorable.missing.map(elementName).join('、')}`;
    footer.appendChild(missing);
  }
  if (favorable.avoid && favorable.avoid.length) {
    const avoid = document.createElement('span');
    avoid.className = 'zs-elbar__note';
    avoid.textContent = `${t('design.bazi.avoid')} ${favorable.avoid.map(elementName).join('、')}`;
    footer.appendChild(avoid);
  }
  if (footer.children.length) wrap.appendChild(footer);

  return wrap;
}

/** 四柱（年/月/日/时）卡片 */
export function createPillars(bazi = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'zs-pillars';
  const pillars = bazi.pillars || {};
  const dayMasterStem = bazi.dayMaster?.stem;

  for (const key of ['year', 'month', 'day', 'hour']) {
    const pillar = pillars[key];
    const card = document.createElement('article');
    card.className = 'zs-pillar';
    if (key === 'day') card.classList.add('is-daymaster');
    if (!pillar) card.classList.add('is-empty');

    const label = document.createElement('span');
    label.className = 'zs-pillar__label';
    const latin = { year: 'YEAR', month: 'MONTH', day: 'DAY', hour: 'HOUR' }[key];
    label.innerHTML = `<span>${t(`design.bazi.pillar.${key}`)}</span><em>${latin}</em>`;

    const chars = document.createElement('div');
    chars.className = 'zs-pillar__chars';

    const meta = document.createElement('div');
    meta.className = 'zs-pillar__meta';

    if (pillar) {
      const stemEl = document.createElement('span');
      stemEl.className = 'zs-pillar__char';
      stemEl.textContent = pillar.stem || '—';
      const branchEl = document.createElement('span');
      branchEl.className = 'zs-pillar__char';
      branchEl.textContent = pillar.branch || '—';
      if (dayMasterStem && pillar.stem === dayMasterStem) stemEl.classList.add('is-self');
      chars.append(stemEl, branchEl);

      for (const [char, key2] of [[pillar.stem, 'stem'], [pillar.branch, 'branch']]) {
        const dot = document.createElement('span');
        dot.className = 'zs-pillar__dot';
        const el = key2 === 'stem' ? STEM_ELEMENT[char] : BRANCH_ELEMENT[char];
        dot.style.setProperty('--c', elementHex(el));
        const text = document.createElement('span');
        text.textContent = elementName(el);
        dot.append(text);
        meta.appendChild(dot);
      }
    } else {
      const dash = document.createElement('span');
      dash.className = 'zs-pillar__char zs-pillar__char--empty';
      dash.textContent = '—';
      chars.appendChild(dash);
      const note = document.createElement('span');
      note.className = 'zs-pillar__note';
      note.textContent = t('design.bazi.hourUnknown');
      meta.appendChild(note);
    }

    card.append(label, chars, meta);
    wrap.appendChild(card);
  }

  return wrap;
}

/** 日主概述 */
export function createDayMaster(bazi = {}) {
  const el = document.createElement('div');
  el.className = 'zs-daymaster';
  const dm = bazi.dayMaster || {};
  const elementKey = elementKeyOf(dm.element) || elementKeyOf(dm.elementZh) || 'water';
  const strength = bazi.strength?.label || '';
  el.innerHTML = '';

  const label = document.createElement('span');
  label.className = 'zs-daymaster__label';
  label.textContent = t('design.bazi.dayMaster');

  const value = document.createElement('span');
  value.className = 'zs-daymaster__value';
  const stem = document.createElement('b');
  stem.textContent = dm.stem || '—';
  const elName = document.createElement('span');
  elName.textContent = elementName(elementKey);
  const dot = document.createElement('i');
  dot.className = 'zs-daymaster__dot';
  dot.style.setProperty('--c', elementHex(elementKey));
  value.append(stem, dot, elName);

  const meta = document.createElement('span');
  meta.className = 'zs-daymaster__meta';
  meta.textContent = strength;

  el.append(label, value, meta);
  return el;
}
