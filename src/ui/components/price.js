// src/ui/components/price.js — 价格格式化与数字滚动
import { t, getLang } from '../i18n.js';

const reduceMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

export function formatPrice(value) {
  const n = Math.round(Number(value) || 0);
  const locale = getLang() === 'en' ? 'en-US' : 'zh-CN';
  return `¥${n.toLocaleString(locale)}`;
}

/** 数字滚动：从 from 到 to，最多 300ms；尊重 prefers-reduced-motion */
export function animateNumber(el, from, to, { duration = 300, format = formatPrice } = {}) {
  if (!el) return;
  const end = Math.round(Number(to) || 0);
  const start = Math.round(Number(from) || 0);
  if (reduceMotion() || start === end) {
    el.textContent = format(end);
    return;
  }
  const t0 = performance.now();
  cancelAnimationFrame(el.__zsRaf || 0);
  const step = (now) => {
    const p = Math.min(1, (now - t0) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    const value = Math.round(start + (end - start) * eased);
    el.textContent = format(value);
    if (p < 1) el.__zsRaf = requestAnimationFrame(step);
    else el.textContent = format(end);
  };
  el.__zsRaf = requestAnimationFrame(step);
}

/**
 * 创建价格块（现价 + 参考价）。
 * @returns {{el:HTMLElement,set:(pricing:{retail?:number,compareAt?:number}, animate?:boolean)=>void,nowEl:HTMLElement}}
 */
export function createPriceBlock({ retail = 0, compareAt = 0, size = 'lg', showReference = true } = {}) {
  const el = document.createElement('div');
  el.className = `zs-price zs-price--${size}`;

  const now = document.createElement('span');
  now.className = 'zs-price__now';
  now.textContent = formatPrice(retail);

  const compare = document.createElement('span');
  compare.className = 'zs-price__compare';
  const label = document.createElement('span');
  label.className = 'zs-price__label';
  label.textContent = t('design.reference');
  const compareValue = document.createElement('s');
  compareValue.className = 'zs-price__compare-value';
  compareValue.textContent = formatPrice(compareAt);
  compare.append(label, compareValue);

  el.append(now);
  if (showReference) el.append(compare);

  let currentRetail = retail;
  let currentCompare = compareAt;

  function set(pricing = {}, animate = false) {
    const nextRetail = Number(pricing.retail) || 0;
    const nextCompare = Number(pricing.compareAt) || 0;
    if (animate && nextRetail !== currentRetail) animateNumber(now, currentRetail, nextRetail);
    else now.textContent = formatPrice(nextRetail);
    currentRetail = nextRetail;
    currentCompare = nextCompare;
    compareValue.textContent = formatPrice(nextCompare);
    compare.hidden = !(showReference && nextCompare > 0);
  }

  set({ retail, compareAt });

  return { el, set, nowEl: now, get retail() { return currentRetail; }, get compareAt() { return currentCompare; } };
}

/** 迷你价格标签，如 ¥429 */
export function priceTag(value) {
  const span = document.createElement('span');
  span.className = 'zs-price-tag';
  span.textContent = formatPrice(value);
  return span;
}
