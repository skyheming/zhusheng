// src/ui/components/toast.js — 底部居中轻提示（aria-live=polite）
import { t } from '../i18n.js';

const MAX_TOASTS = 3;
let root = null;

function ensureRoot() {
  if (root && document.body.contains(root)) return root;
  root = document.getElementById('toast-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'toast-root';
    document.body.appendChild(root);
  }
  root.className = 'zs-toast-root';
  root.setAttribute('role', 'status');
  root.setAttribute('aria-live', 'polite');
  root.setAttribute('aria-atomic', 'false');
  return root;
}

/**
 * 显示一条 toast。
 * @param {string} message
 * @param {{duration?:number, tone?:'ink'|'danger'|'gold'}} [options]
 */
export function toast(message, { duration = 3200, tone = 'ink' } = {}) {
  if (!message) return null;
  const host = ensureRoot();
  while (host.children.length >= MAX_TOASTS) host.firstElementChild?.remove();

  const el = document.createElement('div');
  el.className = `zs-toast zs-toast--${tone}`;
  el.setAttribute('role', 'status');
  el.textContent = message;
  host.appendChild(el);

  requestAnimationFrame(() => el.classList.add('is-in'));

  const timer = window.setTimeout(() => dismiss(), duration);

  function dismiss() {
    window.clearTimeout(timer);
    el.classList.remove('is-in');
    const remove = () => el.remove();
    el.addEventListener('transitionend', remove, { once: true });
    window.setTimeout(remove, 400);
  }

  el.addEventListener('click', dismiss);
  return { el, dismiss };
}

export function toastError(message) {
  return toast(message, { tone: 'danger', duration: 4200 });
}

export function toastInfo(message) {
  return toast(message, { tone: 'ink' });
}

/** 语言切换后的通用提示 */
export function toastLang() {
  return toast(t('toast.langSwitched'));
}
