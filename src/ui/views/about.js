// src/ui/views/about.js — 理念页：品牌、五行、养护
import { t, getLang, UI_ELEMENTS } from '../i18n.js';

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

function langPick(obj, base) {
  return getLang() === 'en' ? obj[`${base}En`] : obj[`${base}Zh`];
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
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); io.unobserve(entry.target); }
    });
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });
  nodes.forEach((node) => { node.classList.add('reveal'); io.observe(node); });
  return () => io.disconnect();
}

/**
 * @param {{navigate:(path:string, opts?:object)=>void}} ctx
 */
export function render(ctx) {
  const root = h('div', 'view view--about');
  const cleanups = [];

  root.appendChild(buildHero());
  root.appendChild(buildStory());
  root.appendChild(buildElements());
  root.appendChild(buildCare());
  root.appendChild(buildCta());

  cleanups.push(initReveal(root));

  function buildHero() {
    const section = h('section', 'about-hero');
    section.setAttribute('aria-labelledby', 'about-title');
    const rail = h('aside', 'about-hero__rail');
    rail.setAttribute('aria-hidden', 'true');
    rail.append(h('span', 'about-hero__vertical', '以生辰为序 · 串五行为珠'), h('span', 'about-hero__rail-line'));

    const copy = h('div', 'about-hero__copy');
    copy.append(h('p', 'eyebrow__text', t('about.kicker')));
    const title = h('h1', 'about-hero__title', t('about.title'));
    title.id = 'about-title';
    const lead = h('p', 'about-hero__lead', t('about.lead'));
    copy.append(title, lead);

    const mark = h('div', 'about-hero__mark');
    mark.setAttribute('aria-hidden', 'true');
    mark.append(
      h('span', 'about-hero__mark-zh', '珠生'),
      h('span', 'about-hero__mark-en', 'BORN OF THE ELEMENTS'),
    );

    add(section, rail, copy, mark);
    return section;
  }

  function buildStory() {
    const section = h('section', 'about-story');
    section.setAttribute('aria-labelledby', 'story-title');
    const wrap = h('div', 'section-wrap about-story__grid');

    const aside = h('div', 'about-story__aside');
    aside.dataset.reveal = 'true';
    aside.append(
      h('p', 'eyebrow__text', t('about.story.kicker')),
      h('h2', 'about-story__title', t('about.story.title')),
      h('p', 'about-story__quote', '“一个人第一次认真看自己的五行，往往不是在算命。”'),
    );
    aside.querySelector('.about-story__title').id = 'story-title';

    const body = h('div', 'about-story__body');
    body.dataset.reveal = 'true';
    body.append(
      h('p', 'about-story__p', t('about.story.p1')),
      h('p', 'about-story__p', t('about.story.p2')),
      h('p', 'about-story__sign', '—— 珠生，二〇二六'),
    );

    add(wrap, aside, body);
    section.appendChild(wrap);
    return section;
  }

  function buildElements() {
    const section = h('section', 'about-elements');
    section.setAttribute('aria-labelledby', 'about-elements-title');
    const wrap = h('div', 'section-wrap');

    const head = h('header', 'section-head');
    const eyebrow = h('p', 'eyebrow');
    const line = h('span', 'eyebrow__line');
    line.setAttribute('aria-hidden', 'true');
    eyebrow.append(line, h('span', 'eyebrow__text', t('about.elements.kicker')));
    const title = h('h2', 'section-title', t('about.elements.title'));
    title.id = 'about-elements-title';
    add(head, eyebrow, title);
    wrap.appendChild(head);

    const list = h('ul', 'about-elements__list');
    UI_ELEMENTS.forEach((element) => {
      const li = h('li', 'about-element');
      li.dataset.reveal = 'true';
      li.style.setProperty('--el', element.hex);
      const dot = h('span', 'about-element__dot');
      dot.setAttribute('aria-hidden', 'true');
      const name = h('div', 'about-element__name');
      name.append(
        h('b', '', getLang() === 'en' ? element.en : element.zh),
        h('em', '', getLang() === 'en' ? element.zh : element.en),
      );
      const meta = h('span', 'about-element__meta', `${langPick(element, 'season')} · ${langPick(element, 'trait')}`);
      const lineText = h('p', 'about-element__line', t(element.lineKey));
      add(li, dot, name, meta, lineText);
      list.appendChild(li);
    });
    wrap.appendChild(list);
    section.appendChild(wrap);
    return section;
  }

  function buildCare() {
    const section = h('section', 'about-care');
    section.setAttribute('aria-labelledby', 'about-care-title');
    const wrap = h('div', 'section-wrap about-care__grid');

    const head = h('div', 'about-care__head');
    head.dataset.reveal = 'true';
    head.append(
      h('p', 'eyebrow__text', t('about.care.kicker')),
      h('h2', 'about-care__title', t('about.care.title')),
    );
    head.querySelector('.about-care__title').id = 'about-care-title';

    const list = h('ul', 'care-list about-care__list');
    [1, 2, 3, 4].forEach((n) => {
      list.appendChild(h('li', 'care-list__item', t(`design.care.${n}`)));
    });

    add(wrap, head, list);
    section.appendChild(wrap);
    return section;
  }

  function buildCta() {
    const section = h('section', 'about-cta');
    const inner = h('div', 'section-wrap about-cta__inner');
    const title = h('h2', 'about-cta__title', t('about.cta.title'));
    const lead = h('p', 'about-cta__lead', t('about.cta.lead'));
    const btn = h('button', 'zs-btn zs-btn--primary', t('cta.generate'));
    btn.type = 'button';
    btn.addEventListener('click', () => ctx.navigate('/', { section: 'generator' }));
    const copy = h('div', '');
    add(copy, title, lead);
    add(inner, copy, btn);
    section.appendChild(inner);
    return section;
  }

  function destroy() {
    cleanups.forEach((fn) => fn?.());
    root.remove();
  }

  return { el: root, destroy };
}
