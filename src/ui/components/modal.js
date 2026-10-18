// src/ui/components/modal.js — 原生 <dialog> 浮层 / 确认框
// 无障碍：原生 dialog 提供焦点陷阱与 ESC 关闭；作用域内 aria-labelledby 关联标题。

let openCount = 0;

function lockScroll(lock) {
  if (typeof document === 'undefined') return;
  openCount = Math.max(0, openCount + (lock ? 1 : -1));
  document.documentElement.classList.toggle('is-modal-open', openCount > 0);
}

function makeButton({ label, value, tone = 'ghost', primary = false, onSelect, closeOnClick = true }) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `zs-btn ${primary ? 'zs-btn--primary' : tone === 'text' ? 'zs-btn--text' : 'zs-btn--ghost'}`;
  btn.textContent = label;
  btn.addEventListener('click', () => {
    if (closeOnClick) onSelect?.(value);
    else onSelect?.(value);
  });
  return btn;
}

/**
 * 打开浮层。
 * @param {Object} options
 * @param {string} options.title
 * @param {string} [options.description]
 * @param {Node|string} [options.content]
 * @param {Array<{label:string,value?:any,primary?:boolean,tone?:string,close?:boolean}>} [options.actions]
 * @param {'sm'|'md'} [options.size]
 * @param {(value:any)=>void} [options.onClose]
 * @returns {{el:HTMLDialogElement, close:(value?:any)=>void, result:Promise<any>}}
 */
export function openModal({
  title,
  description = '',
  content = null,
  actions = [],
  size = 'md',
  onClose,
} = {}) {
  let resolveResult;
  const result = new Promise((resolve) => { resolveResult = resolve; });

  const dialog = document.createElement('dialog');
  dialog.className = `zs-modal zs-modal--${size}`;
  const titleId = `zs-modal-title-${Math.random().toString(36).slice(2, 8)}`;
  dialog.setAttribute('aria-labelledby', titleId);

  const inner = document.createElement('div');
  inner.className = 'zs-modal__inner';

  const head = document.createElement('div');
  head.className = 'zs-modal__head';
  const heading = document.createElement('h2');
  heading.className = 'zs-modal__title';
  heading.id = titleId;
  heading.textContent = title;
  head.appendChild(heading);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'zs-modal__close';
  closeBtn.setAttribute('aria-label', '关闭');
  closeBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M4 4l10 10M14 4L4 14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
  closeBtn.addEventListener('click', () => close(null));
  head.appendChild(closeBtn);
  inner.appendChild(head);

  const body = document.createElement('div');
  body.className = 'zs-modal__body';
  if (description) {
    const p = document.createElement('p');
    p.className = 'zs-modal__desc';
    p.textContent = description;
    body.appendChild(p);
  }
  if (content) {
    if (typeof content === 'string') {
      const p = document.createElement('p');
      p.className = 'zs-modal__desc';
      p.textContent = content;
      body.appendChild(p);
    } else {
      body.appendChild(content);
    }
  }
  inner.appendChild(body);

  if (actions.length) {
    const footer = document.createElement('div');
    footer.className = 'zs-modal__actions';
    for (const action of actions) {
      const btn = makeButton({
        ...action,
        onSelect: (value) => {
          if (action.close !== false) close(value);
          else action.onSelect?.(value);
        },
      });
      footer.appendChild(btn);
    }
    inner.appendChild(footer);
  }

  dialog.appendChild(inner);
  document.body.appendChild(dialog);

  let settled = false;
  function close(value = null) {
    if (settled) return;
    settled = true;
    lockScroll(false);
    try { dialog.close(); } catch { /* ignore */ }
    dialog.remove();
    resolveResult(value);
    onClose?.(value);
  }

  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close(null);
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close(null);
  });

  lockScroll(true);
  dialog.showModal();
  const focusTarget = dialog.querySelector('.zs-btn--primary') || closeBtn;
  window.setTimeout(() => focusTarget?.focus(), 30);

  return { el: dialog, close, result };
}

/**
 * 确认框，返回 Promise<boolean>。
 */
export function confirmModal({
  title,
  description = '',
  confirmLabel = '确认',
  cancelLabel = '取消',
  tone = 'primary',
} = {}) {
  const modal = openModal({
    title,
    description,
    size: 'sm',
    actions: [
      { label: cancelLabel, value: false, tone: 'text', close: true },
      { label: confirmLabel, value: true, primary: tone === 'primary' },
    ],
  });
  return modal.result.then((value) => value === true);
}
