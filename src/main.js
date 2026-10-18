// src/main.js — 应用入口
// 职责：语言初始化、渲染器挂载、全局导航/页脚、hash 路由与视图生命周期。
// 渲染器（src/render/bracelet.js）动态 import，成功后由 bracelet-stage 切换为真实 SVG；
// 若渲染器缺失/加载失败，自动回退到 CSS 珠子占位，首屏不阻塞。

import { applyDocumentLang, getLang, setLang, t } from './ui/i18n.js';
import { createRouter } from './ui/router.js';
import { toast } from './ui/components/toast.js';
import { createNav } from './ui/components/nav.js';
import { createFooter } from './ui/components/footer.js';

import * as homeView from './ui/views/home.js';
import * as designView from './ui/views/design.js';
import * as editorView from './ui/views/editor.js';
import * as cartView from './ui/views/cart.js';
import * as aboutView from './ui/views/about.js';
import * as notfoundView from './ui/views/notfound.js';

const VIEWS = {
  home: homeView,
  design: designView,
  editor: editorView,
  cart: cartView,
  about: aboutView,
  notfound: notfoundView,
};

const INTERNAL_NAV_KEY = 'zs.internal.v1';

const el = {
  header: document.getElementById('site-header'),
  main: document.getElementById('main'),
  footer: document.getElementById('site-footer'),
};

let currentView = null;
let nav = null;
let footer = null;
let router = null;

function ctxFor(info) {
  return {
    route: info,
    params: info.params || {},
    query: info.query,
    navigate: router.navigate,
    replace: router.replace,
    toast,
  };
}

function updateTitle(info) {
  const zh = getLang() !== 'en';
  const suffix = zh ? '珠生 ZHUSHENG' : 'ZHUSHENG';
  let page = '';
  switch (info.name) {
    case 'home': page = zh ? '以生辰为序，串五行为珠' : 'Ordered by birth, strung by element'; break;
    case 'design': page = zh ? '你的设计' : 'Your design'; break;
    case 'editor': page = t('editor.title'); break;
    case 'cart': page = t('cart.title'); break;
    case 'about': page = zh ? '理念' : 'Philosophy'; break;
    default: page = zh ? '页面未找到' : 'Not found';
  }
  document.title = `${page} · ${suffix}`;
}

function mountChrome() {
  if (nav) nav.destroy();
  if (footer) footer.destroy();
  nav = createNav({
    router,
    onToggleLang: handleLangToggle,
    currentRoute: 'home',
  });
  footer = createFooter({ router });
  el.header.replaceChildren(nav.el);
  el.footer.replaceChildren(footer.el);
}

function handleLangToggle() {
  const next = getLang() === 'zh' ? 'en' : 'zh';
  setLang(next);
  mountChrome();
  router.refresh();
  updateTitle(router.getCurrent());
  toast(t('toast.langSwitched'));
  el.main.focus({ preventScroll: true });
}

function markInternalNavigation(info) {
  try {
    // 站内跳转打上标记；刷新同一标签页时保留（仅新标签页/外部打开视为分享进入）
    if (!info.isInitial) sessionStorage.setItem(INTERNAL_NAV_KEY, '1');
  } catch { /* ignore */ }
}

function onRoute(info) {
  markInternalNavigation(info);

  // 销毁上一个视图
  if (currentView?.destroy) {
    try { currentView.destroy(); } catch (err) { console.error('[main] destroy failed', err); }
  }
  currentView = null;

  const module = VIEWS[info.name] || VIEWS.notfound;
  let view = null;
  try {
    view = module.render(ctxFor(info));
  } catch (err) {
    console.error('[main] view render failed', err);
    try {
      view = notfoundView.renderError(ctxFor(info));
    } catch (fallbackError) {
      console.error('[main] fallback view failed', fallbackError);
      view = null;
    }
  }

  el.main.replaceChildren();
  if (view?.el) {
    el.main.appendChild(view.el);
    currentView = view;
  }

  document.body.dataset.route = info.name;
  document.documentElement.dataset.route = info.name;
  nav?.setRoute(info.name);
  nav?.closeMenu();
  updateTitle(info);

  // 无障碍：路由切换后把焦点交给主区域
  window.requestAnimationFrame(() => {
    try { el.main.focus({ preventScroll: true }); } catch { /* ignore */ }
  });

  if (!info.matched) {
    console.info('[router] 404 for', info.hash);
  }
}

function setupSkipLink() {
  const link = document.querySelector('.skip-link');
  if (!link) return;
  link.addEventListener('click', (event) => {
    event.preventDefault();
    el.main.focus({ preventScroll: true });
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  });
}

async function boot() {
  applyDocumentLang();
  setupSkipLink();

  router = createRouter({
    onRoute,
    onBeforeRoute() {
      // 语言切换触发的刷新不改变路径，无需滚动处理
    },
  });
  mountChrome();
  router.start();

  // 首次进入后把焦点放在主区域，方便键盘用户
  document.body.classList.add('is-ready');
}

boot().catch((err) => {
  console.error('[main] boot failed', err);
});
