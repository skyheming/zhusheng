// src/ui/state.js — 购物袋状态（localStorage 持久化，key: zs.cart.v1）
// 只关心「买了什么」，不关心设计细节；设计本体由 token 还原。
// 结构：
//   cart.v1 = { version: 1, items: [ { key, token, id, name, tagline, retail, compareAt,
//                quantity, palette, beadCount, wrist, beadDiameter, metal, charm, addedAt } ] }

export const CART_KEY = 'zs.cart.v1';
export const FREE_SHIPPING_THRESHOLD = 399;
export const SHIPPING_FEE = 12;
const MAX_QUANTITY = 99;

const listeners = new Set();
let state = load();

/* ============================== 存储 ============================== */

function emptyState() {
  return { version: 1, items: [] };
}

function sanitizeItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.token !== 'string' || !raw.token) return null;
  const quantity = Math.min(MAX_QUANTITY, Math.max(1, Math.round(Number(raw.quantity) || 1)));
  return {
    key: String(raw.key || makeKey(raw)),
    token: raw.token,
    id: String(raw.id || 'ZS-0000'),
    name: String(raw.name || ''),
    tagline: String(raw.tagline || ''),
    retail: Math.max(0, Number(raw.retail) || 0),
    compareAt: Math.max(0, Number(raw.compareAt) || 0),
    quantity,
    palette: Array.isArray(raw.palette) ? raw.palette.slice(0, 6).map(String) : [],
    beadCount: Math.max(0, Number(raw.beadCount) || 0),
    wrist: Number(raw.wrist) || 0,
    beadDiameter: Number(raw.beadDiameter) || 0,
    metal: raw.metal === 'gold' ? 'gold' : 'silver',
    charm: String(raw.charm || 'none'),
    addedAt: String(raw.addedAt || new Date().toISOString()),
  };
}

function load() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.items)) return emptyState();
    const items = parsed.items.map(sanitizeItem).filter(Boolean);
    return { version: 1, items };
  } catch (err) {
    console.warn('[state] read cart failed, starting empty', err);
    return emptyState();
  }
}

function persist() {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('[state] persist cart failed', err);
  }
}

function snapshot() {
  const items = state.items.map((item) => ({ ...item }));
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.retail * item.quantity, 0);
  const freeShipping = subtotal >= FREE_SHIPPING_THRESHOLD;
  const shipping = items.length === 0 ? 0 : freeShipping ? 0 : SHIPPING_FEE;
  return {
    items,
    count,
    subtotal,
    shipping,
    total: subtotal + shipping,
    freeShipping,
    freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
    shippingFee: SHIPPING_FEE,
    isEmpty: items.length === 0,
    remainingForFreeShipping: Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal),
  };
}

function notify() {
  const snap = snapshot();
  for (const fn of listeners) {
    try { fn(snap); } catch (err) { console.error('[state] subscriber failed', err); }
  }
}

/* ============================== 对外 API ============================== */

/** 购物袋快照（只读副本） */
export function getCart() {
  return snapshot();
}

export function cartCount() {
  return state.items.reduce((sum, item) => sum + item.quantity, 0);
}

/** 订阅购物袋变化；返回取消订阅函数 */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function makeKey(seed) {
  return [
    seed.token || 'token',
    seed.wrist || '',
    seed.beadDiameter || '',
    seed.metal || '',
    seed.charm || '',
  ].join('|');
}

/**
 * 加入购物袋。
 * @param {object} design 设计对象
 * @param {{token:string, quantity?:number}} options
 */
export function addToCart(design, { token, quantity = 1 } = {}) {
  if (!design || !token) {
    console.warn('[state] addToCart requires a design and token');
    return null;
  }
  const composition = design.composition || {};
  const qty = Math.min(MAX_QUANTITY, Math.max(1, Math.round(Number(quantity) || 1)));
  const draft = {
    token,
    id: design.id || 'ZS-0000',
    name: design.copy?.headline || design.theme?.name || '',
    tagline: design.copy?.tagline || '',
    retail: design.pricing?.retail || 0,
    compareAt: design.pricing?.compareAt || 0,
    quantity: qty,
    palette: Array.isArray(design.theme?.palette) ? design.theme.palette : [],
    beadCount: composition.beadCount || 0,
    wrist: composition.wrist || 0,
    beadDiameter: composition.beadDiameter || 0,
    metal: composition.metal || 'silver',
    charm: composition.charm?.id || 'none',
    addedAt: new Date().toISOString(),
  };
  draft.key = makeKey(draft);

  const existing = state.items.find((item) => item.key === draft.key);
  if (existing) {
    existing.quantity = Math.min(MAX_QUANTITY, existing.quantity + qty);
    existing.addedAt = draft.addedAt;
  } else {
    state.items.push(draft);
  }
  persist();
  notify();
  return draft;
}

/** 修改数量；quantity <= 0 时视为移除 */
export function updateQuantity(key, quantity) {
  const item = state.items.find((entry) => entry.key === key);
  if (!item) return false;
  const next = Math.round(Number(quantity));
  if (!Number.isFinite(next) || next <= 0) {
    return removeFromCart(key);
  }
  item.quantity = Math.min(MAX_QUANTITY, Math.max(1, next));
  persist();
  notify();
  return true;
}

export function removeFromCart(key) {
  const before = state.items.length;
  state.items = state.items.filter((item) => item.key !== key);
  if (state.items.length === before) return false;
  persist();
  notify();
  return true;
}

export function clearCart() {
  state.items = [];
  persist();
  notify();
}

/** 给其他标签页同步 */
function onStorage(event) {
  if (event.key !== CART_KEY) return;
  state = load();
  notify();
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', onStorage);
}
