// src/ui/components/nav.js — 顶部导航（透明叠在首页 hero 上，滚动后米白底）
import { t } from '../i18n.js';
import { cartCount, subscribe } from '../state.js';

const SVG_MENU = '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true"><path d="M3 7h16M3 15h16" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';
const SVG_CLOSE = '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true"><path d="M5 5l12 12M17 5L5 17" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';
const SVG_BAG = '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M4.2 6h9.6l-.7 8.4a1 1 0 0 1-1 .9H5.9a1 1 0 0 1-1-.9L4.2 6Z" stroke="currentColor" stroke-width="1.2"/><path d="M6.4 6V4.8a2.6 2.6 0 0 1 5.2 0V6" stroke="currentColor" stroke-width="1.2"/></svg>';

/**
 * 站点导航。
 * @param {{router:object, onToggleLang:()=>void, currentRoute?:string, onLangClick?:Function}} options
 */
export function createNav({ router, onToggleLang, currentRoute = 'home' } = {}) {
  const header = document.createElement('header');
  header.className = 'site-header';
  header.setAttribute('data-route', currentRoute);

  const inner = document.createElement('div');
  inner.className = 'site-header__inner';

  // 品牌
  const brand = document.createElement('a');
  brand.className = 'site-brand';
  brand.href = '#/';
  brand.setAttribute('aria-label', '珠生 ZHUSHENG');
  brand.innerHTML = '<span class="site-brand__zh">珠生</span><span class="site-brand__en">ZHUSHENG</span>';

  // 主链接
  const nav = document.createElement('nav');
  nav.className = 'site-nav';
  nav.setAttribute('aria-label', '主导航');

  const bagLink = document.createElement('a');
  bagLink.className = 'site-nav__link site-nav__bag';
  bagLink.href = '#/cart';
  const bagLabel = document.createElement('span');
  bagLabel.className = 'site-nav__bag-label';
  bagLabel.textContent = t('nav.cart');
  const bagCountEl = document.createElement('span');
  bagCountEl.className = 'site-nav__bag-count';
  bagCountEl.setAttribute('aria-hidden', 'true');
  bagLink.append(bagLabel, bagCountEl);

  nav.append(
    makeLink('nav.philosophy', '#/about'),
    makeScrollButton('nav.custom', 'generator'),
    makeScrollButton('nav.stories', 'stories'),
    bagLink,
  );

  // 工具区
  const utils = document.createElement('div');
  utils.className = 'site-header__utils';

  const langBtn = document.createElement('button');
  langBtn.type = 'button';
  langBtn.className = 'site-lang';
  langBtn.setAttribute('aria-label', t('lang.aria'));
  langBtn.textContent = t('lang.other');
  langBtn.addEventListener('click', () => onToggleLang?.());

  const menuBtn = document.createElement('button');
  menuBtn.type = 'button';
  menuBtn.className = 'site-menu-btn';
  menuBtn.setAttribute('aria-expanded', 'false');
  menuBtn.setAttribute('aria-controls', 'site-mobile-menu');
  menuBtn.innerHTML = SVG_MENU;
  menuBtn.setAttribute('aria-label', t('nav.menu'));

  utils.append(langBtn, menuBtn);

  inner.append(brand, nav, utils);
  header.appendChild(inner);

  // 移动端菜单
  const menu = document.createElement('div');
  menu.className = 'site-mobile';
  menu.id = 'site-mobile-menu';
  menu.hidden = true;
  menu.innerHTML = '';

  const menuHead = document.createElement('div');
  menuHead.className = 'site-mobile__head';
  const menuBrand = document.createElement('span');
  menuBrand.className = 'site-mobile__brand';
  menuBrand.setAttribute('aria-hidden', 'true');
  menuBrand.innerHTML = '<span>珠生</span><em>ZHUSHENG</em>';
  const menuClose = document.createElement('button');
  menuClose.type = 'button';
  menuClose.className = 'site-menu-btn site-mobile__close';
  menuClose.innerHTML = SVG_CLOSE;
  menuClose.setAttribute('aria-label', t('nav.close'));
  menuHead.append(menuBrand, menuClose);

  const menuList = document.createElement('nav');
  menuList.className = 'site-mobile__nav';
  menuList.setAttribute('aria-label', '移动端导航');
  const menuLinks = [
    makeMenuLink('nav.philosophy', null, '#/about'),
    makeMenuLink('nav.custom', 'generator'),
    makeMenuLink('nav.stories', 'stories'),
    makeMenuLink('nav.cart', null, '#/cart', true),
  ];
  menuLinks.forEach((a) => menuList.appendChild(a));

  const menuFoot = document.createElement('div');
  menuFoot.className = 'site-mobile__foot';
  const menuLang = document.createElement('button');
  menuLang.type = 'button';
  menuLang.className = 'site-lang';
  menuLang.textContent = `${t('lang.other')} · ${t('lang.aria')}`;
  menuLang.addEventListener('click', () => onToggleLang?.());
  menuFoot.appendChild(menuLang);

  menu.append(menuHead, menuList, menuFoot);
  header.appendChild(menu);

  // ---- 交互 ----
  function closeMenu() {
    if (menu.hidden) return;
    menu.hidden = true;
    header.classList.remove('is-menu-open');
    document.documentElement.classList.remove('is-menu-open');
    menuBtn.setAttribute('aria-expanded', 'false');
    menuBtn.focus();
  }

  function openMenu() {
    menu.hidden = false;
    header.classList.add('is-menu-open');
    document.documentElement.classList.add('is-menu-open');
    menuBtn.setAttribute('aria-expanded', 'true');
    window.requestAnimationFrame(() => menuList.querySelector('a, button')?.focus());
  }

  menuBtn.addEventListener('click', () => (menu.hidden ? openMenu() : closeMenu()));
  menuClose.addEventListener('click', closeMenu);
  header.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !menu.hidden) closeMenu();
  });
  menuList.addEventListener('click', (event) => {
    if (event.target.closest('a, button')) closeMenu();
  });

  function onScroll() {
    header.classList.toggle('is-scrolled', window.scrollY > 12);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---- 购物袋数量 ----
  function renderCount() {
    const count = cartCount();
    bagCountEl.textContent = count > 0 ? String(count) : '';
    bagCountEl.hidden = count === 0;
    bagLink.setAttribute('aria-label', t('nav.bagCount', { count }));
  }
  const unsubscribe = subscribe(renderCount);
  renderCount();

  // ---- 路由态 ----
  function setRoute(name) {
    header.setAttribute('data-route', name);
    onScroll();
  }

  function go(section) {
    closeMenu();
    router.navigate('/', { section });
  }

  function makeLink(labelKey, href) {
    const a = document.createElement('a');
    a.className = 'site-nav__link';
    a.href = href;
    a.textContent = t(labelKey);
    return a;
  }

  function makeScrollButton(labelKey, section) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'site-nav__link site-nav__link--button';
    btn.textContent = t(labelKey);
    btn.addEventListener('click', () => go(section));
    return btn;
  }

  function makeMenuLink(labelKey, section, href, withBag = false) {
    let node;
    if (href) {
      node = document.createElement('a');
      node.href = href;
    } else {
      node = document.createElement('button');
      node.type = 'button';
      node.addEventListener('click', () => go(section));
    }
    node.className = 'site-mobile__link';
    const label = document.createElement('span');
    label.textContent = t(labelKey);
    node.appendChild(label);
    if (withBag) {
      const count = cartCount();
      if (count > 0) {
        const badge = document.createElement('em');
        badge.textContent = `(${count})`;
        node.appendChild(badge);
      }
      const icon = document.createElement('span');
      icon.className = 'site-mobile__icon';
      icon.innerHTML = SVG_BAG;
      node.prepend(icon);
    }
    return node;
  }

  return {
    el: header,
    setRoute,
    closeMenu,
    destroy() {
      unsubscribe();
      window.removeEventListener('scroll', onScroll);
      header.remove();
    },
  };
}
