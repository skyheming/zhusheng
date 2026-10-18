// src/ui/views/cart.js — 购物袋：数量 / 删除 / 合计 / 运费规则 / Shopify 占位结账
import { t, getLang } from '../i18n.js';
import { formatPrice } from '../components/price.js';
import { createQuantity } from '../components/quantity.js';
import { openModal } from '../components/modal.js';
import { buildShareUrl } from '../components/share-card.js';
import {
  getCart, subscribe, updateQuantity, removeFromCart, FREE_SHIPPING_THRESHOLD, SHIPPING_FEE,
} from '../state.js';

const BEAD_DOT_COLORS = ['#E9B7B4', '#E8E4D8', '#B79ACB', '#C8AE7C'];

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

function metalLabel(metal) {
  return metal === 'gold' ? t('design.spec.metal.gold') : t('design.spec.metal.silver');
}

function charmLabel(id) {
  return id && id !== 'none' ? t(`editor.charm.${id}`) : t('editor.charm.none');
}

/** Shopify 占位 payload（接入时可直接映射为 line items / draft order） */
function buildCheckoutPayload(cart) {
  return {
    note: 'ZHUSHENG custom bracelet order',
    currency: 'CNY',
    line_items: cart.items.map((item) => ({
      title: item.name,
      quantity: item.quantity,
      price: item.retail,
      properties: {
        design_id: item.id,
        design_token: item.token,
        design_url: buildShareUrl(item.token),
        wrist_cm: item.wrist,
        bead_diameter_mm: item.beadDiameter,
        metal: item.metal,
        charm: item.charm,
      },
    })),
    shipping_line: cart.shipping > 0
      ? { title: 'Standard shipping', price: cart.shipping }
      : { title: 'Free shipping', price: 0 },
    subtotal: cart.subtotal,
    total: cart.total,
  };
}

function showCheckoutModal(cart) {
  const payload = buildCheckoutPayload(cart);
  // Shopify 未接入：仅打印可对接数据，不跳转外链
  console.log('[ZHUSHENG] checkout payload (Shopify-ready):', payload);
  const body = h('div', 'checkout-modal');
  body.appendChild(h('p', 'zs-modal__desc', t('cart.modal.body')));
  const note = h('p', 'checkout-modal__note', t('cart.modal.note'));
  body.appendChild(note);

  const summary = h('dl', 'checkout-modal__summary');
  const rows = [
    [t('cart.subtotal'), formatPrice(cart.subtotal)],
    [t('cart.shipping'), cart.shipping === 0 ? t('cart.free') : formatPrice(cart.shipping)],
    [t('cart.total'), formatPrice(cart.total)],
  ];
  rows.forEach(([label, value]) => {
    const row = h('div', 'checkout-modal__row');
    row.append(h('dt', '', label), h('dd', '', value));
    summary.appendChild(row);
  });
  body.appendChild(summary);

  openModal({
    title: t('cart.modal.title'),
    content: body,
    size: 'sm',
    actions: [{ label: t('cart.modal.cta'), value: true, primary: true }],
  });
}

/**
 * @param {{navigate:(path:string, opts?:object)=>void, toast:Function, route:object}} ctx
 */
export function render(ctx) {
  const root = h('div', 'view view--cart');
  const wrap = h('div', 'cart section-wrap');

  const head = h('header', 'cart__head');
  const eyebrow = h('p', 'eyebrow');
  const line = h('span', 'eyebrow__line');
  line.setAttribute('aria-hidden', 'true');
  eyebrow.append(line, h('span', 'eyebrow__text', t('cart.kicker')));
  const title = h('h1', 'cart__title', t('cart.title'));
  const lead = h('p', 'cart__lead', t('cart.lead'));
  add(head, eyebrow, title, lead);

  const layout = h('div', 'cart__layout');
  const listCol = h('div', 'cart__list');
  const summaryCol = h('aside', 'cart__summary');
  summaryCol.setAttribute('aria-label', t('cart.summary'));
  add(layout, listCol, summaryCol);
  add(wrap, head, layout);
  root.appendChild(wrap);

  let lastKeys = '';
  let itemRefs = [];
  let summaryRefs = null;

  renderAll(getCart());
  const unsubscribe = subscribe((snap) => renderAll(snap));

  function renderAll(cart) {
    if (cart.items.length === 0) {
      listCol.replaceChildren(buildEmpty());
      summaryCol.hidden = true;
      lastKeys = '';
      return;
    }
    summaryCol.hidden = false;
    const keys = cart.items.map((item) => item.key).join('|');
    if (keys !== lastKeys) {
      lastKeys = keys;
      buildList(cart);
      buildSummary(cart);
    } else {
      refresh(cart);
    }
  }

  function buildList(cart) {
    listCol.replaceChildren();
    const list = h('ul', 'cart-items');
    itemRefs = [];
    for (const item of cart.items) {
      const li = h('li', 'cart-item');

      const thumb = h('div', 'cart-item__thumb');
      thumb.setAttribute('aria-hidden', 'true');
      const palette = item.palette && item.palette.length ? item.palette.slice(0, 4) : BEAD_DOT_COLORS;
      palette.forEach((color, index) => {
        const dot = h('span', 'cart-item__bead');
        dot.style.setProperty('--c', color);
        dot.style.setProperty('--i', String(index));
        thumb.appendChild(dot);
      });

      const info = h('div', 'cart-item__info');
      const nameLink = h('a', 'cart-item__name');
      nameLink.href = `#/design/${item.token}`;
      nameLink.textContent = item.name || item.id;
      const idLine = h('p', 'cart-item__id', item.id);
      const meta = h('p', 'cart-item__meta', [
        `${item.wrist} cm`,
        `${item.beadDiameter} mm`,
        metalLabel(item.metal),
        charmLabel(item.charm),
      ].join(' · '));
      add(info, nameLink, idLine, meta);

      const lineTotal = h('span', 'cart-item__total', formatPrice(item.retail * item.quantity));
      const unit = h('span', 'cart-item__unit', getLang() === 'en' ? `${formatPrice(item.retail)} each` : `单价 ${formatPrice(item.retail)}`);

      const side = h('div', 'cart-item__side');
      const qty = createQuantity({
        value: item.quantity,
        min: 1,
        max: 9,
        label: `${t('cart.item.qty')} · ${item.name}`,
        compact: true,
        onChange: (value) => updateQuantity(item.key, value),
      });
      const remove = h('button', 'cart-item__remove', t('cart.item.remove'));
      remove.type = 'button';
      remove.addEventListener('click', () => {
        removeFromCart(item.key);
        ctx.toast?.(t('cart.removedToast'));
      });
      add(side, qty.el, remove);

      const money = h('div', 'cart-item__money');
      add(money, lineTotal, unit);
      add(li, thumb, info, money, side);
      list.appendChild(li);
      itemRefs.push({ li, item, lineTotal, qty });
    }
    listCol.appendChild(list);

    const foot = h('div', 'cart__continue');
    const keep = h('button', 'zs-btn zs-btn--text', t('cta.keepBrowsing'));
    keep.type = 'button';
    keep.addEventListener('click', () => ctx.navigate('/'));
    foot.appendChild(keep);
    listCol.appendChild(foot);
  }

  function buildSummary(cart) {
    summaryCol.replaceChildren();
    summaryCol.appendChild(h('h2', 'cart-summary__title', t('cart.summary')));

    const rows = h('dl', 'cart-summary__rows');
    const subtotalRow = summaryRow(t('cart.subtotal'), formatPrice(cart.subtotal), 'subtotal');
    const shippingRow = summaryRow(t('cart.shipping'), cart.shipping === 0 ? t('cart.free') : formatPrice(cart.shipping), 'shipping');
    add(rows, subtotalRow.el, shippingRow.el);
    summaryCol.appendChild(rows);

    const totalRow = h('div', 'cart-summary__total');
    totalRow.append(h('span', '', t('cart.total')), h('strong', '', formatPrice(cart.total)));
    totalRow.classList.add('is-total');
    const totalValue = totalRow.querySelector('strong');
    summaryCol.appendChild(totalRow);

    const shippingNote = h('p', 'cart-summary__note');
    if (cart.freeShipping) shippingNote.textContent = `${t('cart.freeRule')} · ${t('cart.free')}`;
    else if (cart.remainingForFreeShipping > 0) shippingNote.textContent = t('cart.freeShippingProgress', { amount: cart.remainingForFreeShipping });
    else shippingNote.textContent = t('cart.freeRule');
    summaryCol.appendChild(shippingNote);

    const checkout = h('button', 'zs-btn zs-btn--primary cart-summary__checkout', t('cta.checkout'));
    checkout.type = 'button';
    checkout.addEventListener('click', () => showCheckoutModal(getCart()));
    summaryCol.appendChild(checkout);

    const secure = h('p', 'cart-summary__secure', t('cart.secure'));
    summaryCol.appendChild(secure);

    const note = h('p', 'cart-summary__checkout-note', t('cart.checkoutNote'));
    summaryCol.appendChild(note);

    summaryRefs = {
      subtotal: subtotalRow.value,
      shipping: shippingRow.value,
      total: totalValue,
      shippingNote,
      shippingRow,
      checkoutNote: note,
    };
  }

  function summaryRow(label, value, key) {
    const row = h('div', 'cart-summary__row');
    const dt = h('dt', '', label);
    const dd = h('dd', '', value);
    add(row, dt, dd);
    return { el: row, value: dd, key };
  }

  function refresh(cart) {
    for (const ref of itemRefs) {
      const item = cart.items.find((entry) => entry.key === ref.item.key);
      if (!item) continue;
      ref.item = item;
      ref.qty.set(item.quantity);
      ref.lineTotal.textContent = formatPrice(item.retail * item.quantity);
    }
    if (summaryRefs) {
      summaryRefs.subtotal.textContent = formatPrice(cart.subtotal);
      summaryRefs.shipping.textContent = cart.shipping === 0 ? t('cart.free') : formatPrice(cart.shipping);
      summaryRefs.total.textContent = formatPrice(cart.total);
      if (cart.freeShipping) summaryRefs.shippingNote.textContent = `${t('cart.freeRule')} · ${t('cart.free')}`;
      else if (cart.remainingForFreeShipping > 0) summaryRefs.shippingNote.textContent = t('cart.freeShippingProgress', { amount: cart.remainingForFreeShipping });
    }
  }

  function buildEmpty() {
    const box = h('div', 'cart-empty');
    const seal = h('span', 'cart-empty__seal');
    seal.setAttribute('aria-hidden', 'true');
    seal.textContent = '空';
    const title = h('h2', 'cart-empty__title', t('cart.empty.title'));
    const lead = h('p', 'cart-empty__lead', t('cart.empty.lead'));
    const btn = h('button', 'zs-btn zs-btn--primary', t('cta.generate'));
    btn.type = 'button';
    btn.addEventListener('click', () => ctx.navigate('/', { section: 'generator' }));
    const stories = h('button', 'zs-btn zs-btn--text', t('cta.stories'));
    stories.type = 'button';
    stories.addEventListener('click', () => ctx.navigate('/', { section: 'stories' }));
    const actions = h('div', 'cart-empty__actions');
    add(actions, btn, stories);
    add(box, seal, title, lead, actions);
    return box;
  }

  function destroy() {
    unsubscribe();
    root.remove();
  }

  return { el: root, destroy };
}
