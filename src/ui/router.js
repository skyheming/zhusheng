// src/ui/router.js — hash 路由
// 路由表：#/、#/design/:token、#/design/:token/edit、#/cart、#/about
// 支持浏览器前进/后退、滚动复位、404（route 未匹配）、可选 ?lang=en 查询参数。

/**
 * @typedef {Object} RouteInfo
 * @property {string} name
 * @property {Record<string,string>} params
 * @property {URLSearchParams} query
 * @property {string} path
 * @property {string} hash
 * @property {boolean} isInitial
 * @property {string|null} section
 */

export const ROUTES = [
  { name: 'home', pattern: '/' },
  { name: 'editor', pattern: '/design/:token/edit' },
  { name: 'design', pattern: '/design/:token' },
  { name: 'cart', pattern: '/cart' },
  { name: 'about', pattern: '/about' },
];

/** 规范化成以 / 开头的路径，允许传入 '#/x'、'/x'、'x' */
export function normalizePath(input = '/') {
  let raw = String(input || '/').trim();
  if (raw.startsWith('#')) raw = raw.slice(1);
  if (!raw.startsWith('/')) raw = `/${raw}`;
  raw = raw.replace(/\/{2,}/g, '/');
  if (raw.length > 1) raw = raw.replace(/\/+$/, '');
  return raw || '/';
}

/** 解析 location.hash -> {path, query, hash} */
export function parseHash(hash = '') {
  const rawHash = String(hash || '').replace(/^#/, '');
  const [rawPath, ...rest] = rawHash.split('?');
  const path = normalizePath(rawPath || '/');
  const queryString = rest.join('?');
  let query;
  try {
    query = new URLSearchParams(queryString);
  } catch {
    query = new URLSearchParams();
  }
  return { path, query, hash: rawHash };
}

/** 匹配路径与路由表；返回 {route, params} 或 null（含非法百分号编码时安全返回 null） */
export function matchRoute(path, routes = ROUTES) {
  const segments = normalizePath(path).split('/').filter(Boolean);
  for (const route of routes) {
    const patternSegments = route.pattern.split('/').filter(Boolean);
    if (patternSegments.length !== segments.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < patternSegments.length; i++) {
      const part = patternSegments[i];
      if (part.startsWith(':')) {
        try {
          params[part.slice(1)] = decodeURIComponent(segments[i]);
        } catch {
          // 非法百分号编码：保留原始片段交给视图做友好错误态（如设计链接不完整）
          params[part.slice(1)] = segments[i];
        }
      } else if (part !== segments[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return { route, params };
  }
  return null;
}

/** 构造 hash 路径字符串（不带 #） */
export function buildPath(path, query) {
  let result = normalizePath(path);
  if (query) {
    const qs = query instanceof URLSearchParams ? query.toString() : String(query);
    if (qs) result += `?${qs}`;
  }
  return result;
}

/**
 * 创建路由器。
 * @param {Object} options
 * @param {(path:string)=>string} options.basePath 返回页面基础路径（默认 pathname）
 * @param {(info:RouteInfo)=>void} options.onRoute 路由变化回调
 * @param {()=>void} [options.onBeforeRoute]
 */
export function createRouter({ basePath, onRoute, onBeforeRoute } = {}) {
  let started = false;
  let pendingSection = null;
  let previousPath = null;
  let touching = false;

  function setHash(path, { replace = false } = {}) {
    const base = basePath ? basePath() : window.location.pathname;
    const url = `${base}${window.location.search}#${path}`;
    if (replace) {
      window.history.replaceState(null, '', url);
      handle({ force: true, fromReplace: true });
    } else if (window.location.hash !== `#${path}`) {
      window.location.hash = path;
    }
  }

  function navigate(path, options = {}) {
    const { replace = false, section = null } = options;
    const next = buildPath(path, options.query);
    if (section) pendingSection = section;

    const current = parseHash(window.location.hash);
    if (!replace && current.path === normalizePath(next) && !options.query) {
      // 同页：只做滚动 / 段位定位
      if (section) scrollToSection(section);
      return;
    }
    setHash(next, { replace });
  }

  function replace(path, options = {}) {
    navigate(path, { ...options, replace: true });
  }

  function scrollToTop() {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    } catch {
      window.scrollTo(0, 0);
    }
  }

  function scrollToSection(section) {
    if (!section) return;
    const target = document.getElementById(section);
    if (target) {
      target.scrollIntoView({ behavior: 'auto', block: 'start' });
    }
  }

  function currentInfo({ isInitial = false, section = null } = {}) {
    const { path, query } = parseHash(window.location.hash);
    const matched = matchRoute(path);
    return {
      name: matched ? matched.route.name : 'notfound',
      params: matched ? matched.params : { path },
      query,
      path,
      hash: window.location.hash,
      isInitial,
      section,
      matched: !!matched,
    };
  }

  function handle({ force = false, fromReplace = false, isInitial = false } = {}) {
    if (!started) return;
    if (touching && !force) return;
    touching = true;
    try {
      const info = currentInfo({ isInitial: isInitial && previousPath === null, section: pendingSection });
      pendingSection = null;
      const pathChanged = previousPath !== info.path;
      previousPath = info.path;
      if (typeof onBeforeRoute === 'function') onBeforeRoute(info);
      try {
        onRoute(info);
      } catch (error) {
        // 任何视图/路由渲染异常都退化为 404 兜底页，避免白屏
        console.error('[router] route handler failed', error);
        try {
          onRoute({
            name: 'notfound',
            params: { path: info.path },
            query: info.query,
            path: info.path,
            hash: info.hash,
            isInitial: info.isInitial,
            section: null,
            matched: false,
          });
        } catch (fallbackError) {
          console.error('[router] fallback route handler failed', fallbackError);
        }
      }
      // 滚动：首次进入 / 路径变化复位；仅查询参数变化或 replace 保存不算换页
      const sameRouteReplaced = fromReplace && !pathChanged;
      if (info.section) {
        window.requestAnimationFrame(() => scrollToSection(info.section));
      } else if (pathChanged && !sameRouteReplaced) {
        scrollToTop();
      }
    } finally {
      touching = false;
    }
  }

  function onHashChange() {
    try {
      handle();
    } catch (error) {
      console.error('[router] hashchange failed', error);
    }
  }

  function start() {
    if (started) return;
    started = true;
    if (!window.location.hash) {
      const base = basePath ? basePath() : window.location.pathname;
      window.history.replaceState(null, '', `${base}${window.location.search}#/`);
    }
    window.addEventListener('hashchange', onHashChange);
    handle({ force: true, isInitial: true });
  }

  function stop() {
    started = false;
    window.removeEventListener('hashchange', onHashChange);
  }

  return {
    routes: ROUTES,
    navigate,
    replace,
    start,
    stop,
    refresh() {
      handle({ force: true });
    },
    getCurrent() {
      return currentInfo();
    },
    scrollToTop,
    scrollToSection,
    get previousPath() { return previousPath; },
  };
}
