/**
 * Shopify 购物车适配器（骨架）。
 *
 * 当前静态站使用本地购物袋（src/ui/state.js）。接入 Shopify 时，
 * 在结账动作中改为调用本模块；设计状态通过 line item properties 传递。
 *
 * 配置示例（由 Liquid 注入 window.ZHUSHENG_CONFIG）：
 *   {
 *     shop: "your-shop.myshopify.com",
 *     currency: "CNY",
 *     locale: "zh-CN",
 *     variants: {
 *       "6|silver|standard": 11111111111,
 *       "8|silver|standard": 22222222222,
 *       ...
 *     }
 *   }
 */

export function getConfig() {
  return (typeof window !== 'undefined' && window.ZHUSHENG_CONFIG) || {
    shop: null,
    currency: 'CNY',
    locale: 'zh-CN',
    variants: {},
  };
}

/** 设计 → 购物车行属性（Shopify line item properties，字符串值） */
export function designToProperties(design) {
  const p = design?.bazi?.pillars || {};
  const pickText = (design?.picks || []).map((x) => x.zh || x.crystalId).join(' / ');
  const comp = design?.composition || {};
  return {
    设计编号: design?.id || '',
    生辰: `${design?.input?.date || ''}${design?.input?.time ? ` ${design.input.time}` : ''} / ${
      design?.input?.gender === 'f' ? '女' : design?.input?.gender === 'm' ? '男' : '不透露'
    }`,
    八字: [p.year, p.month, p.day, p.hour]
      .filter(Boolean)
      .map((x) => `${x.stem}${x.branch}`)
      .join(' '),
    三珠: pickText,
    手围: `${comp.wrist || ''}cm / ${comp.beadCount || ''} 颗`,
    珠径: `${comp.beadDiameter || ''}mm`,
    金属: comp.metal === 'gold' ? '古金' : 'S925 银',
    挂饰: comp.charm?.zh || '无',
    设计链接: typeof location !== 'undefined' ? `${location.origin}${location.pathname}#/design/${encodeURIComponent(design?.meta?.token || '')}` : '',
    设计状态: design?.meta?.token || '',
  };
}

/** 选 variant key：`${beadDiameter}|${metal}|${tier}` */
export function variantKeyFor(design) {
  const tier = design?.meta?.specialPicked ? 'special' : 'standard';
  return `${design?.composition?.beadDiameter || 8}|${design?.composition?.metal || 'silver'}|${tier}`;
}

export function variantIdFor(design) {
  const cfg = getConfig();
  return cfg.variants?.[variantKeyFor(design)] ?? null;
}

/** POST /cart/add.js —— 加购（需在 Shopify 店铺域内运行） */
export async function addDesignToCart(design, { quantity = 1, variantId = null } = {}) {
  const id = variantId || variantIdFor(design);
  if (!id) {
    return { ok: false, reason: 'NO_VARIANT', message: '尚未配置 Shopify 变体映射' };
  }
  const res = await fetch('/cart/add.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [{ id, quantity, properties: designToProperties(design) }],
    }),
  });
  if (!res.ok) return { ok: false, reason: 'HTTP_' + res.status, message: await res.text() };
  return { ok: true, item: await res.json() };
}

/** 无 JS 兜底：/cart/<variantId>:<qty>?properties[...]=... */
export function buildCheckoutPermalink(design, { quantity = 1, variantId = null } = {}) {
  const id = variantId || variantIdFor(design);
  if (!id) return null;
  const props = new URLSearchParams();
  for (const [k, v] of Object.entries(designToProperties(design))) {
    props.set(`properties[${k}]`, v);
  }
  return `/cart/${id}:${quantity}?${props.toString()}`;
}

/** 记录设计 token 到 cart attributes（可选） */
export async function saveDesignAttribute(token) {
  try {
    await fetch('/cart/update.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attributes: { zhusheng_last_design: token } }),
    });
    return true;
  } catch {
    return false;
  }
}
