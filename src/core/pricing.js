// 珠生 ZHUSHENG — 定价规则（product-spec §7）
// 成本 = Σ珠子成本（含收藏级 special）+ 隔珠（银 3.5 / 金 6）+ 挂饰 18
//        + 手工 28 + 包装/证书 12
// 珠径系数：6mm ×0.85，8mm ×1.0，10mm ×1.25
// 零售 = 成本 × 2.6，向上取整到 ¥8/¥9 结尾，最低 ¥299
// 划线参考价 = 零售 × 1.25，向上取整到 ¥9 结尾

import { CHARMS, CRYSTAL_BY_ID } from "../data/crystals.js";

export const CURRENCY = "CNY";
export const MARKUP = 2.6;
export const MIN_RETAIL = 299;
export const CRAFT_COST = 28;
export const PACKAGING_COST = 12;
export const CHARM_COST = 18;
export const SPACER_COST = { silver: 3.5, gold: 6 };
export const DIAMETER_FACTOR = { 6: 0.85, 8: 1, 10: 1.25 };
export const FREE_SHIPPING_THRESHOLD = 399;
export const SHIPPING_FEE = 12;

export function round2(value) {
  return Math.round(value * 100) / 100;
}

/** 单颗珠子成本（含珠径系数与收藏级特殊款）。 */
export function beadUnitCost(crystal, beadDiameter, useSpecial = false) {
  if (!crystal) return 0;
  const base = useSpecial && crystal.special ? crystal.special.unitCost : crystal.unitCost;
  const factor = DIAMETER_FACTOR[beadDiameter] || 1;
  return round2(base * factor);
}

/** 向上取整到 ¥8/¥9 结尾。 */
export function roundUpTo89(value) {
  const base = Math.floor(value / 10) * 10;
  for (const candidate of [base + 8, base + 9]) {
    if (candidate >= value) return candidate;
  }
  return base + 18;
}

/** 向上取整到 ¥9 结尾（用于划线参考价）。 */
export function roundUpTo9(value) {
  const base = Math.floor(value / 10) * 10 + 9;
  return base >= value ? base : base + 10;
}

/**
 * 价格计算。
 * @param {{composition:object, options?:object}} design
 */
export function priceDesign(design) {
  const composition = (design && design.composition) || {};
  const layout = composition.layout || [];
  const beadDiameter = composition.beadDiameter || 8;
  const metal = composition.metal === "gold" ? "gold" : "silver";
  const specialFlags = (design && design.options && design.options.special) || {};

  const beads = layout.filter((item) => item.kind === "bead");
  const spacers = layout.filter((item) => item.kind === "spacer");
  const charmItem = layout.find((item) => item.kind === "charm");

  let gemCost = 0;
  for (const bead of beads) {
    const crystal = CRYSTAL_BY_ID[bead.crystalId];
    const useSpecial = !!(specialFlags[bead.role] && crystal && crystal.special);
    gemCost += beadUnitCost(crystal, beadDiameter, useSpecial);
  }
  gemCost = round2(gemCost);

  const spacerMetal = metal;
  const spacerCost = round2(spacers.length * (SPACER_COST[spacerMetal] || SPACER_COST.silver));
  const charmDef = charmItem ? CHARMS.find((charm) => charm.id === charmItem.charmId) : null;
  const charmCost = charmDef && charmDef.id !== "none" ? charmDef.price : 0;

  const breakdown = [
    { label: `天然晶石（${beads.length} 颗）`, amount: gemCost },
    {
      label: `${metal === "gold" ? "古金" : "S925 银"}隔珠（${spacers.length} 颗）`,
      amount: spacerCost
    }
  ];
  if (charmCost > 0) {
    breakdown.push({ label: `挂饰 · ${charmDef.zh}`, amount: charmCost });
  }
  breakdown.push({ label: "手工串制", amount: CRAFT_COST });
  breakdown.push({ label: "包装与收藏卡", amount: PACKAGING_COST });

  const unitCost = round2(breakdown.reduce((sum, item) => sum + item.amount, 0));
  const rawRetail = unitCost * MARKUP;
  const retail = Math.max(MIN_RETAIL, roundUpTo89(rawRetail));
  const compareAt = Math.max(retail + 10, roundUpTo9(retail * 1.25));

  return {
    currency: CURRENCY,
    retail,
    compareAt,
    unitCost,
    breakdown
  };
}

/** 购物袋运费：满 ¥399 包邮，否则 ¥12。 */
export function shippingFor(subtotal) {
  return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
}

export function formatPrice(value, currency = CURRENCY) {
  const amount = Math.round(Number(value) || 0);
  return currency === "CNY" ? `¥${amount}` : `${currency} ${amount}`;
}
