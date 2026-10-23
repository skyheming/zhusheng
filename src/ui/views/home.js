// src/ui/views/home.js — 首页：Hero + 生成器 + 三步 + 五行 + 工艺 + 买家故事 + FAQ
// 已接入 src/core/index.js（mock.js 保留为离线兜底，不再被视图引用）。

import { t, getLang, pick, UI_GENDERS, UI_WISHES, UI_ELEMENTS } from '../i18n.js';
import { STORY_PHOTOS } from '../../data/story-photos.js';
import { generateDesign, encodeDesign } from '../../core/index.js';

const MIN_DATE = '1900-01-01';
const pad2 = (n) => String(n).padStart(2, '0');

// 首页主视觉使用的示例设计（与 docs/sample-design.json 同一生辰）
const SAMPLE_INPUT = {
  date: '1990-05-15',
  time: '12:00',
  gender: 'f',
  wish: ['love'],
  options: { wrist: 15.5, beadDiameter: 8, metal: 'silver', charm: 'none', spacerInterval: 0 },
};
let SAMPLE_DESIGN = null;
function sampleDesign() {
  if (!SAMPLE_DESIGN) SAMPLE_DESIGN = generateDesign(SAMPLE_INPUT);
  return SAMPLE_DESIGN;
}

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

const ICONS = {
  gem: '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M9 6h14l4 7-11 14L5 13l4-7Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="M5 13h22M12.5 6 9 13l7 14 7-14-3.5-7" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>',
  silver: '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><circle cx="16" cy="16" r="9.5" stroke="currentColor" stroke-width="1.2"/><circle cx="16" cy="16" r="4.5" stroke="currentColor" stroke-width="1.2"/><path d="M16 2.5v4M16 25.5v4M2.5 16h4M25.5 16h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
  thread: '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M4 22c6-2 7-12 14-12s7 10 10 8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><circle cx="11" cy="22" r="2.4" stroke="currentColor" stroke-width="1.2"/><circle cx="20" cy="12" r="2.4" stroke="currentColor" stroke-width="1.2"/><circle cx="26" cy="20" r="2.4" stroke="currentColor" stroke-width="1.2"/></svg>',
  card: '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><rect x="6" y="5" width="20" height="22" stroke="currentColor" stroke-width="1.2"/><path d="M10.5 11h11M10.5 15h7M10.5 22h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M24 5v5h-5" stroke="currentColor" stroke-width="1.2"/></svg>',
};

/* ============================== DOM 小工具 ============================== */

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

function sectionHead({ kicker, title, lead, id, align = '' }) {
  const head = h('header', `section-head${align ? ` section-head--${align}` : ''}`);
  const eyebrow = h('p', 'eyebrow');
  const line = h('span', 'eyebrow__line');
  line.setAttribute('aria-hidden', 'true');
  eyebrow.append(line, h('span', 'eyebrow__text', kicker));
  const h2 = h('h2', 'section-title', title);
  if (id) h2.id = id;
  add(head, eyebrow, h2);
  if (lead) head.appendChild(h('p', 'section-lead', lead));
  return head;
}

function langPick(obj, base) {
  return getLang() === 'en' ? obj[`${base}En`] : obj[`${base}Zh`];
}

function initReveal(root) {
  const nodes = [...root.querySelectorAll('[data-reveal]')];
  if (!nodes.length) return () => {};
  let prefersReduced = false;
  try { prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* ignore */ }
  if (prefersReduced || !('IntersectionObserver' in window)) {
    nodes.forEach((node) => node.classList.add('is-visible'));
    return () => {};
  }
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    }
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
  nodes.forEach((node) => {
    node.classList.add('reveal');
    io.observe(node);
  });
  return () => io.disconnect();
}

/* ============================== 页面 ============================== */

/**
 * @param {{navigate:(path:string)=>void, toast:Function, route:object}} ctx
 */
export function render(ctx) {
  const root = h('div', 'view view--home');
  const cleanups = [];
  const timers = [];

  root.appendChild(buildHero());
  root.appendChild(buildGenerator());
  root.appendChild(buildSteps());
  root.appendChild(buildElements());
  root.appendChild(buildCraft());
  root.appendChild(buildStories());
  root.appendChild(buildFaq());
  root.appendChild(buildClosing());
  root.appendChild(buildMobileBar());

  cleanups.push(initReveal(root));
  initMobileBar();

  // ---- Hero 主视觉 ----
  function buildHero() {
    const hero = h('section', 'hero');
    hero.setAttribute('aria-labelledby', 'hero-title');

    const grid = h('div', 'hero__grid');

    // 竖排装饰（品牌中文句固定，作为东方编辑感点缀）
    const rail = h('div', 'hero__rail');
    rail.setAttribute('aria-hidden', 'true');
    const vertical = h('span', 'hero__vertical', '以生辰为序 · 串五行为珠');
    const railLine = h('span', 'hero__rail-line');
    const scrollCue = h('span', 'hero__scroll');
    scrollCue.innerHTML = `<span class="hero__scroll-text">${t('home.hero.scroll')}</span><span class="hero__scroll-line"></span>`;
    add(rail, vertical, railLine, scrollCue);

    // 文案
    const copy = h('div', 'hero__copy');
    const eyebrow = h('p', 'eyebrow');
    const ebLine = h('span', 'eyebrow__line');
    ebLine.setAttribute('aria-hidden', 'true');
    eyebrow.append(ebLine, h('span', 'eyebrow__text', t('brand.taglineEn')));

    const title = h('h1', 'hero__title');
    title.id = 'hero-title';
    const lineA = h('span', 'hero__title-line', t('home.hero.titleA'));
    const lineB = h('span', 'hero__title-line hero__title-line--accent');
    lineB.textContent = t('home.hero.titleB');
    const seal = h('span', 'hero__seal');
    seal.setAttribute('aria-hidden', 'true');
    seal.textContent = '珠';
    lineB.appendChild(seal);
    add(title, lineA, lineB);

    const lead = h('p', 'hero__lead', t('home.hero.lead'));

    const actions = h('div', 'hero__actions');
    const startBtn = h('button', 'zs-btn zs-btn--primary hero__start');
    startBtn.type = 'button';
    startBtn.innerHTML = `<span>${t('cta.start')}</span><span class="zs-btn__arrow" aria-hidden="true">→</span>`;
    startBtn.addEventListener('click', () => {
      goToGenerator();
    });
    const storiesBtn = h('button', 'zs-btn zs-btn--text hero__stories');
    storiesBtn.type = 'button';
    storiesBtn.textContent = t('cta.stories');
    storiesBtn.addEventListener('click', () => scrollToSection('stories'));
    add(actions, startBtn, storiesBtn);

    const stats = h('ul', 'hero__stats');
    for (const key of ['home.hero.stat1', 'home.hero.stat2', 'home.hero.stat3']) {
      const li = h('li', 'hero__stat');
      li.appendChild(h('span', 'hero__stat-mark'));
      li.appendChild(h('span', 'hero__stat-label', t(key)));
      stats.appendChild(li);
    }

    add(copy, eyebrow, title, lead, actions, stats);

    // 视觉
    const visual = h('div', 'hero__visual');
    const ring = h('div', 'hero__ring');
    const sample = sampleDesign();
    const stageHost = h('div', 'hero__stage');
    const poster = h('img', 'hero__poster');
    poster.src = './assets/img/hero-webgl.png';
    poster.alt = getLang() === 'en'
      ? 'Sample 3D bracelet: silver obsidian, garnet and morganite'
      : '示例 3D 手串：银曜石、石榴石与摩根石';
    poster.width = 640;
    poster.height = 640;
    poster.decoding = 'async';
    stageHost.appendChild(poster);
    const halo = h('span', 'hero__halo');
    halo.setAttribute('aria-hidden', 'true');
    add(ring, halo, stageHost);

    const card = h('figure', 'hero__card');
    const cardTop = h('div', 'hero__card-top');
    cardTop.append(h('span', 'hero__card-label', t('home.hero.cardLabel')));
    cardTop.append(h('span', 'hero__card-kind', t('home.hero.cardKind')));
    const cardId = h('span', 'hero__card-id', sample.id || 'ZS-7K2F');
    const cardMeta = h('figcaption', 'hero__card-meta', sample.copy?.headline || '丁火 · 月白');
    add(card, cardTop, cardId, cardMeta);

    const caption = h('p', 'hero__caption', heroCaption(sample));
    const captionNote = h(
      'p',
      'hero__caption-note',
      getLang() === 'en'
        ? `Sample birth ${SAMPLE_INPUT.date} ${SAMPLE_INPUT.time} — not your input`
        : `示例生辰 ${SAMPLE_INPUT.date} ${SAMPLE_INPUT.time} · 不是你的输入`,
    );
    add(visual, ring, card, caption, captionNote);

    add(grid, rail, copy, visual);
    hero.appendChild(grid);
    return hero;
  }

  function heroCaption(design) {
    const pillars = design?.bazi?.pillars || {};
    return ['year', 'month', 'day', 'hour']
      .map((key) => pillars[key])
      .filter(Boolean)
      .map((pillar) => `${pillar.stem}${pillar.branch}`)
      .join(' · ');
  }

  // ---- 生成器 ----
  function buildGenerator() {
    const section = h('section', 'generator');
    section.id = 'generator';
    section.setAttribute('aria-labelledby', 'generator-title');

    const head = sectionHead({
      kicker: t('home.gen.kicker'),
      title: t('home.gen.title'),
      lead: t('home.gen.lead'),
      id: 'generator-title',
    });

    const body = h('div', 'generator__body');

    const form = h('form', 'gen-form');
    form.noValidate = true;
    form.setAttribute('aria-describedby', 'gen-note');

    const rowTop = h('div', 'gen-form__row');

    // 生日
    const dateField = h('div', 'field field--date');
    const dateLabel = h('label', 'field__label');
    dateLabel.htmlFor = 'gen-birthday';
    dateLabel.innerHTML = `<span>${t('home.gen.birthday')}</span><em>DATE OF BIRTH</em>`;
    const dateInput = h('input', 'field__input');
    dateInput.type = 'date';
    dateInput.id = 'gen-birthday';
    dateInput.name = 'birthday';
    dateInput.required = true;
    dateInput.min = MIN_DATE;
    dateInput.max = todayIso();
    dateInput.setAttribute('aria-describedby', 'gen-birthday-hint gen-error-date');
    const dateHint = h('p', 'field__hint', t('home.gen.birthdayHint'));
    dateHint.id = 'gen-birthday-hint';
    const dateError = h('p', 'field__error');
    dateError.id = 'gen-error-date';
    dateError.hidden = true;
    dateError.setAttribute('aria-live', 'polite');
    add(dateField, dateLabel, dateInput, dateHint, dateError);

    // 性别
    const genderField = h('fieldset', 'field field--choices');
    const genderLegend = h('legend', 'field__label');
    genderLegend.innerHTML = `<span>${t('home.gen.gender')}</span><em>GENDER</em>`;
    const genderChips = h('div', 'chips');
    UI_GENDERS.forEach((gender, index) => {
      const label = h('label', 'chip');
      const input = h('input', 'sr-only');
      input.type = 'radio';
      input.name = 'gender';
      input.value = gender.id;
      if (index === 0) input.checked = false;
      const span = h('span', 'chip__label', pick(gender));
      add(label, input, span);
      genderChips.appendChild(label);
    });
    const genderError = h('p', 'field__error');
    genderError.hidden = true;
    genderError.setAttribute('aria-live', 'polite');
    add(genderField, genderLegend, genderChips, genderError);

    add(rowTop, dateField, genderField);

    // 心愿
    const wishField = h('fieldset', 'field field--wish');
    const wishLegend = h('legend', 'field__label');
    wishLegend.innerHTML = `<span>${t('home.gen.wish')} <em class="field__optional">${t('home.gen.wishHint')}</em></span><em>INTENTION</em>`;
    const wishChips = h('div', 'chips');
    UI_WISHES.forEach((wish) => {
      const label = h('label', 'chip chip--soft');
      const input = h('input', 'sr-only');
      input.type = 'checkbox';
      input.name = 'wish';
      input.value = wish.id;
      const span = h('span', 'chip__label', pick(wish));
      add(label, input, span);
      wishChips.appendChild(label);
    });
    add(wishField, wishLegend, wishChips);

    // 手围 + 提交
    const rowBottom = h('div', 'gen-form__row gen-form__row--bottom');
    const wristField = h('div', 'field field--wrist');
    const wristLabel = h('label', 'field__label');
    wristLabel.htmlFor = 'gen-wrist';
    wristLabel.innerHTML = `<span>${t('home.gen.wrist')} <em class="field__optional">${t('home.gen.wristHint')}</em></span><em>WRIST</em>`;
    const wristSelect = h('select', 'field__input field__select');
    wristSelect.id = 'gen-wrist';
    wristSelect.name = 'wrist';
    const wristDefault = h('option', '', t('home.gen.wristOpt'));
    wristDefault.value = '';
    wristSelect.appendChild(wristDefault);
    for (let v = 14; v <= 20; v += 0.5) {
      const option = h('option', '', `${v.toFixed(1)} cm`);
      option.value = String(v);
      wristSelect.appendChild(option);
    }
    add(wristField, wristLabel, wristSelect);

    const submitWrap = h('div', 'gen-form__submit');
    const submit = h('button', 'zs-btn zs-btn--primary gen-submit');
    submit.type = 'submit';
    submit.innerHTML = `<span>${t('cta.generate')}</span><span class="zs-btn__arrow" aria-hidden="true">→</span>`;
    const note = h('p', 'gen-form__note', t('home.gen.note'));
    note.id = 'gen-note';
    add(submitWrap, submit, note);

    add(rowBottom, wristField, submitWrap);
    add(form, rowTop, wishField, rowBottom);

    // 生成中动画
    const anim = h('div', 'gen-anim');
    anim.hidden = true;
    const beads = h('div', 'gen-anim__beads');
    beads.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 18; i++) {
      const bead = h('span', 'gen-anim__bead');
      bead.style.setProperty('--i', String(i));
      beads.appendChild(bead);
    }
    const status = h('div', 'gen-anim__status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    const phase = h('span', 'gen-anim__phase', t('home.gen.phase1'));
    const dots = h('span', 'gen-anim__dots');
    dots.setAttribute('aria-hidden', 'true');
    dots.textContent = '· · ·';
    status.append(phase, dots);
    const animFoot = h('p', 'gen-anim__foot', t('home.gen.footnote'));
    add(anim, beads, status, animFoot);

    add(body, form, anim);

    // 校验
    function setFieldError(input, node, key) {
      node.textContent = key ? t(key) : '';
      node.hidden = !key;
      if (input) input.setAttribute('aria-invalid', key ? 'true' : 'false');
    }

    function clearErrors() {
      setFieldError(dateInput, dateError, null);
      setFieldError(null, genderError, null);
      genderChips.querySelectorAll('.chip').forEach((chip) => chip.classList.remove('is-invalid'));
    }

    dateInput.addEventListener('input', () => setFieldError(dateInput, dateError, null));
    genderChips.addEventListener('change', () => {
      setFieldError(null, genderError, null);
      genderChips.querySelectorAll('.chip').forEach((chip) => chip.classList.remove('is-invalid'));
    });

    function validate() {
      clearErrors();
      const dateValue = dateInput.value;
      let firstInvalid = null;

      if (!dateValue) {
        setFieldError(dateInput, dateError, 'home.gen.error.required');
        firstInvalid = dateInput;
      } else {
        const parsed = new Date(`${dateValue}T00:00:00`);
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        if (Number.isNaN(parsed.getTime()) || dateValue < MIN_DATE) {
          setFieldError(dateInput, dateError, 'home.gen.error.range');
          firstInvalid = dateInput;
        } else if (parsed > today) {
          setFieldError(dateInput, dateError, 'home.gen.error.future');
          firstInvalid = dateInput;
        }
      }

      const genderInput = form.querySelector('input[name="gender"]:checked');
      if (!genderInput) {
        setFieldError(null, genderError, 'home.gen.error.gender');
        genderChips.querySelectorAll('.chip').forEach((chip) => chip.classList.add('is-invalid'));
        if (!firstInvalid) firstInvalid = genderChips.querySelector('input');
      }

      if (firstInvalid) {
        firstInvalid.focus({ preventScroll: false });
        return null;
      }

      const wish = [...form.querySelectorAll('input[name="wish"]:checked')].map((input) => input.value);
      return {
        date: dateValue,
        gender: genderInput.value,
        wish,
        wrist: wristSelect.value ? Number(wristSelect.value) : undefined,
      };
    }

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (section.classList.contains('is-generating')) return;
      const value = validate();
      if (!value) return;
      startGenerating(value);
    });

    function startGenerating(value) {
      section.classList.add('is-generating');
      form.hidden = true;
      anim.hidden = false;
      // 触发 CSS 珠粒依次亮起
      requestAnimationFrame(() => anim.classList.add('is-active'));

      const phases = ['home.gen.phase1', 'home.gen.phase2', 'home.gen.phase3'];
      phases.forEach((key, index) => {
        timers.push(window.setTimeout(() => { phase.textContent = t(key); }, index * 500));
      });
      timers.push(window.setTimeout(() => {
        phase.textContent = t('home.gen.done');
      }, 1350));

      timers.push(window.setTimeout(() => {
        try {
          const input = {
            date: value.date,
            gender: value.gender,
            wish: value.wish,
            locale: getLang() === 'en' ? 'en' : 'zh',
          };
          if (value.wrist) input.options = { wrist: value.wrist };
          const design = generateDesign(input);
          const token = encodeDesign(design);
          ctx.navigate(`/design/${token}?mine=1`);
        } catch (error) {
          console.error('[home] generate failed', error);
          section.classList.remove('is-generating');
          form.hidden = false;
          anim.hidden = true;
          anim.classList.remove('is-active');
          ctx.toast?.(t('error.lead'), { tone: 'danger' });
        }
      }, 1580));
    }

    // 组装
    const layout = h('div', 'generator__layout');
    layout.append(head, body);
    section.appendChild(layout);
    return section;
  }

  function buildSteps() {
    const section = h('section', 'steps');
    section.setAttribute('aria-labelledby', 'steps-title');
    const wrap = h('div', 'section-wrap');
    wrap.appendChild(sectionHead({
      kicker: t('home.steps.kicker'),
      title: t('home.steps.title'),
      id: 'steps-title',
    }));

    const list = h('ol', 'steps__list');
    [
      ['01', 'home.steps.1.title', 'home.steps.1.body'],
      ['02', 'home.steps.2.title', 'home.steps.2.body'],
      ['03', 'home.steps.3.title', 'home.steps.3.body'],
    ].forEach(([num, titleKey, bodyKey]) => {
      const li = h('li', 'step');
      li.dataset.reveal = 'true';
      const index = h('span', 'step__num', num);
      const content = h('div', 'step__content');
      content.append(h('h3', 'step__title', t(titleKey)), h('p', 'step__body', t(bodyKey)));
      add(li, index, content);
      list.appendChild(li);
    });
    wrap.appendChild(list);
    section.appendChild(wrap);
    return section;
  }

  function buildElements() {
    const section = h('section', 'elements');
    section.id = 'elements';
    section.setAttribute('aria-labelledby', 'elements-title');

    const quote = h('div', 'elements__quote');
    quote.dataset.reveal = 'true';
    quote.append(
      h('p', 'eyebrow__text elements__kicker', t('home.elements.kicker')),
      h('h2', 'elements__title', t('home.elements.title')),
      h('p', 'elements__lead', t('home.elements.lead')),
      h('p', 'elements__note', t('home.elements.note')),
    );
    quote.querySelector('.elements__title').id = 'elements-title';

    const list = h('ul', 'elements__list');
    UI_ELEMENTS.forEach((element, index) => {
      const li = h('li', 'element-row');
      li.dataset.reveal = 'true';
      li.style.setProperty('--el', element.hex);
      li.style.setProperty('--i', String(index));
      const mark = h('span', 'element-row__mark');
      mark.setAttribute('aria-hidden', 'true');
      const name = h('span', 'element-row__name');
      const primary = h('b', '', getLang() === 'en' ? element.en : element.zh);
      const secondary = h('em', '', getLang() === 'en' ? element.zh : element.en);
      add(name, primary, secondary);
      const meta = h('span', 'element-row__meta', `${langPick(element, 'season')} · ${langPick(element, 'trait')}`);
      const line = h('span', 'element-row__line', t(element.lineKey));
      add(li, mark, name, meta, line);
      list.appendChild(li);
    });

    add(section, quote, list);
    return section;
  }

  function buildCraft() {
    const section = h('section', 'craft');
    section.setAttribute('aria-labelledby', 'craft-title');
    const wrap = h('div', 'section-wrap');
    wrap.appendChild(sectionHead({
      kicker: t('home.craft.kicker'),
      title: t('home.craft.title'),
      id: 'craft-title',
    }));
    const grid = h('div', 'craft__grid');
    const icons = [ICONS.gem, ICONS.silver, ICONS.thread, ICONS.card];
    [1, 2, 3, 4].forEach((n, index) => {
      const item = h('article', 'craft__item');
      item.dataset.reveal = 'true';
      const icon = h('span', 'craft__icon');
      icon.innerHTML = icons[index];
      icon.setAttribute('aria-hidden', 'true');
      const num = h('span', 'craft__num', `0${n}`);
      const title = h('h3', 'craft__title', t(`home.craft.${n}.title`));
      const body = h('p', 'craft__body', t(`home.craft.${n}.body`));
      add(item, icon, num, title, body);
      grid.appendChild(item);
    });
    wrap.appendChild(grid);
    section.appendChild(wrap);
    return section;
  }

  function buildStories() {
    const section = h('section', 'stories');
    section.id = 'stories';
    section.setAttribute('aria-labelledby', 'stories-title');
    const wrap = h('div', 'section-wrap');
    wrap.appendChild(sectionHead({
      kicker: t('home.stories.kicker'),
      title: t('home.stories.title'),
      id: 'stories-title',
    }));

    const list = h('ul', 'stories__list');
    [1, 2, 3].forEach((n) => {
      const li = h('li', 'story');
      li.dataset.reveal = 'true';
      const photo = STORY_PHOTOS[n - 1];
      if (photo) {
        const media = h('figure', 'story__media');
        const img = h('img', 'story__img');
        img.src = photo.src;
        img.alt = photo.alt?.[getLang() === 'en' ? 'en' : 'zh'] || '';
        img.width = 900;
        img.height = 1125;
        img.loading = 'lazy';
        img.decoding = 'async';
        const tag = h('figcaption', 'story__tag', t('home.stories.photoTag'));
        add(media, img, tag);
        li.appendChild(media);
      }
      const quote = h('blockquote', 'story__quote');
      quote.append(h('span', 'story__mark', '“'), h('p', '', t(`home.stories.${n}.quote`)));
      const foot = h('footer', 'story__foot');
      const seal = h('span', 'story__seal');
      seal.textContent = t(`home.stories.${n}.name`).slice(0, 1);
      seal.setAttribute('aria-hidden', 'true');
      const meta = h('span', 'story__meta');
      meta.append(
        h('b', '', t(`home.stories.${n}.name`)),
        h('em', '', t(`home.stories.${n}.id`)),
      );
      add(foot, seal, meta);
      add(li, quote, foot);
      list.appendChild(li);
    });
    const note = h('p', 'stories__note', t('home.stories.photoNote'));
    wrap.append(list, note);
    section.appendChild(wrap);
    return section;
  }

  function buildFaq() {
    const section = h('section', 'faq');
    section.setAttribute('aria-labelledby', 'faq-title');
    const wrap = h('div', 'faq__layout');
    const head = sectionHead({
      kicker: t('home.faq.kicker'),
      title: t('home.faq.title'),
      id: 'faq-title',
    });
    head.dataset.reveal = 'true';
    const list = h('div', 'faq__list');
    [1, 2, 3, 4].forEach((n, index) => {
      const details = h('details', 'faq__item');
      details.dataset.reveal = 'true';
      if (index === 0) details.open = true;
      const summary = h('summary', 'faq__summary');
      const sign = h('span', 'faq__sign', '+');
      sign.setAttribute('aria-hidden', 'true');
      summary.append(
        h('span', 'faq__q', t(`home.faq.${n}.q`)),
        sign,
      );
      const body = h('div', 'faq__body');
      body.appendChild(h('p', '', t(`home.faq.${n}.a`)));
      add(details, summary, body);
      list.appendChild(details);
    });
    add(wrap, head, list);
    section.appendChild(wrap);
    return section;
  }

  function buildClosing() {
    const section = h('section', 'home-closing');
    section.setAttribute('aria-labelledby', 'closing-title');
    const seal = h('span', 'home-closing__seal');
    seal.setAttribute('aria-hidden', 'true');
    seal.textContent = '珠生';
    const kicker = h('p', 'eyebrow__text home-closing__kicker', t('home.cta.kicker'));
    const title = h('h2', 'home-closing__title', t('home.cta.title'));
    title.id = 'closing-title';
    const lead = h('p', 'home-closing__lead', t('home.cta.lead'));
    const btn = h('button', 'zs-btn zs-btn--primary home-closing__cta');
    btn.type = 'button';
    btn.innerHTML = `<span>${t('home.cta.button')}</span><span class="zs-btn__arrow" aria-hidden="true">→</span>`;
    btn.addEventListener('click', () => goToGenerator());
    add(section, seal, kicker, title, lead, btn);
    return section;
  }

  /* ---- 移动端常驻 CTA（hero 离开视口后出现） ---- */
  function buildMobileBar() {
    const bar = h('div', 'home-bar');
    const copy = h('div', 'home-bar__copy');
    const note = h('span', 'home-bar__label', t('home.gen.note'));
    const sub = h('span', 'home-bar__sub', t('home.bar.sub'));
    add(copy, note, sub);
    const cta = h('button', 'zs-btn zs-btn--primary home-bar__cta');
    cta.type = 'button';
    cta.innerHTML = `<span>${t('home.bar.cta')}</span><span class="zs-btn__arrow" aria-hidden="true">→</span>`;
    cta.addEventListener('click', () => goToGenerator());
    add(bar, copy, cta);
    return bar;
  }

  function initMobileBar() {
    const bar = root.querySelector('.home-bar');
    const hero = root.querySelector('.hero');
    if (!bar || !hero) return;
    if (!('IntersectionObserver' in window)) {
      bar.classList.add('is-visible');
      return;
    }
    const io = new IntersectionObserver((entries) => {
      const entry = entries[0];
      bar.classList.toggle('is-visible', !entry.isIntersecting);
    }, { threshold: 0.04 });
    io.observe(hero);
    cleanups.push(() => io.disconnect());
  }

  /* ---- 页内导航 ---- */
  function goToGenerator() {
    scrollToSection('generator');
    timers.push(window.setTimeout(() => {
      const input = root.querySelector('#gen-birthday');
      input?.focus({ preventScroll: true });
    }, 420));
  }

  function scrollToSection(id) {
    const target = document.getElementById(id);
    if (target) target.scrollIntoView({ behavior: 'auto', block: 'start' });
  }

  function destroy() {
    timers.forEach((id) => window.clearTimeout(id));
    cleanups.forEach((fn) => fn?.());
    root.remove();
  }

  return { el: root, destroy };
}
