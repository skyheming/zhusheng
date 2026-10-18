// src/ui/views/notfound.js — 404 / 加载错误
import { t } from '../i18n.js';

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

/** @param {{navigate:Function, route?:{path?:string}}} ctx */
export function render(ctx) {
  return build({
    kicker: t('notfound.kicker'),
    seal: '断',
    title: t('notfound.title'),
    lead: t('notfound.lead'),
    primary: { label: t('notfound.cta'), href: '#/' },
    secondary: { label: t('cta.viewBag'), href: '#/cart' },
  });
}

/** 渲染失败兜底 */
export function renderError(ctx) {
  const view = build({
    kicker: 'ERROR',
    seal: '候',
    title: t('error.title'),
    lead: t('error.lead'),
    primary: { label: t('error.retry'), onClick: () => window.location.reload() },
    secondary: { label: t('cta.backHome'), href: '#/' },
  });
  return view;
}

function build({ kicker, seal, title, lead, primary, secondary }) {
  const root = h('div', 'view view--notfound');
  const wrap = h('div', 'section-wrap notfound');

  const sealEl = h('span', 'notfound__seal');
  sealEl.setAttribute('aria-hidden', 'true');
  sealEl.textContent = seal;

  const eyebrow = h('p', 'eyebrow');
  const line = h('span', 'eyebrow__line');
  line.setAttribute('aria-hidden', 'true');
  eyebrow.append(line, h('span', 'eyebrow__text', kicker));

  const titleEl = h('h1', 'notfound__title', title);
  const leadEl = h('p', 'notfound__lead', lead);
  const actions = h('div', 'notfound__actions');

  function makeAction(config, variant) {
    if (config.onClick) {
      const btn = h('button', `zs-btn zs-btn--${variant}`, config.label);
      btn.type = 'button';
      btn.addEventListener('click', config.onClick);
      return btn;
    }
    const link = h('a', `zs-btn zs-btn--${variant}`, config.label);
    link.href = config.href || '#/';
    return link;
  }

  add(actions, makeAction(primary, 'primary'), secondary ? makeAction(secondary, 'ghost') : null);
  add(wrap, sealEl, eyebrow, titleEl, leadEl, actions);
  root.appendChild(wrap);

  return { el: root, destroy() { root.remove(); } };
}
