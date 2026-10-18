// src/ui/components/quantity.js — 数量步进器（触控 ≥44px）
import { t } from '../i18n.js';

/**
 * @param {{value?:number,min?:number,max?:number,onChange?:(v:number)=>void,label?:string,compact?:boolean}} options
 * @returns {{el:HTMLElement,get:()=>number,set:(v:number)=>void,destroy:()=>void}}
 */
export function createQuantity({
  value = 1,
  min = 1,
  max = 9,
  onChange,
  label = '',
  compact = false,
} = {}) {
  const el = document.createElement('div');
  el.className = `zs-qty${compact ? ' zs-qty--compact' : ''}`;
  el.setAttribute('role', 'group');
  if (label) el.setAttribute('aria-label', label);

  const dec = document.createElement('button');
  dec.type = 'button';
  dec.className = 'zs-qty__btn';
  dec.setAttribute('aria-label', t('qty.decrease'));
  dec.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2.5 7h9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';

  const input = document.createElement('input');
  input.type = 'text';
  input.inputMode = 'numeric';
  input.className = 'zs-qty__input';
  input.setAttribute('aria-label', label || t('cart.item.qty'));
  input.autocomplete = 'off';

  const inc = document.createElement('button');
  inc.type = 'button';
  inc.className = 'zs-qty__btn';
  inc.setAttribute('aria-label', t('qty.increase'));
  inc.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M7 2.5v9M2.5 7h9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';

  let current = clamp(value);

  function clamp(v) {
    const n = Math.round(Number(v) || min);
    return Math.min(max, Math.max(min, n));
  }

  function render() {
    input.value = String(current);
    dec.disabled = current <= min;
    inc.disabled = current >= max;
  }

  function commit(next, { emit = true } = {}) {
    const clamped = clamp(next);
    const changed = clamped !== current;
    current = clamped;
    render();
    if (changed && emit) onChange?.(current);
  }

  dec.addEventListener('click', () => commit(current - 1));
  inc.addEventListener('click', () => commit(current + 1));
  input.addEventListener('change', () => commit(input.value));
  input.addEventListener('blur', () => { input.value = String(current); });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowUp') { event.preventDefault(); commit(current + 1); }
    if (event.key === 'ArrowDown') { event.preventDefault(); commit(current - 1); }
  });

  el.append(dec, input, inc);
  render();

  return {
    el,
    get: () => current,
    set: (v) => commit(v, { emit: false }),
    destroy: () => el.remove(),
  };
}
