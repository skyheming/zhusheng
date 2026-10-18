// 珠生 ZHUSHENG — 选珠规则引擎
// 规则打分：用神 +35 / 次喜 +22 / 忌神 -25 / 心愿 +18 / 性别色谱 +6 /
// 生辰石·生肖 +4 / 价格带 +3；三珠须覆盖 ≥2 五行、≥2 色系。
// 全程确定性（固定 seed 抖动仅影响同分排序，不改变展示分数）。

import { CRYSTALS } from "../data/crystals.js";
import { ELEMENT_ZH, ZH_ELEMENT, elementZh } from "./wuxing.js";
import { pickReasons, narrative } from "./copy.js";

const ROLES = ["main", "support", "accent"];

const GENDER_COLORS = {
  f: ["粉", "紫", "红", "白", "银", "青"],
  m: ["蓝", "黑", "绿", "金", "黄", "橙"],
  x: ["白", "银", "青", "蓝", "绿", "彩"]
};

// 预算档位 → 目标单颗成本（用于价格带 +3 与超预算收敛）。
const TARGET_UNIT_COST = { low: 2.5, mid: 6, high: 40 };

// 西方星座 → 星象（用于知识库 zodiac 匹配）
const ZODIAC_GROUPS = [
  { month: 1, day: 20, group: "风象" }, { month: 2, day: 19, group: "水象" },
  { month: 3, day: 21, group: "火象" }, { month: 4, day: 20, group: "土象" },
  { month: 5, day: 21, group: "风象" }, { month: 6, day: 22, group: "水象" },
  { month: 7, day: 23, group: "火象" }, { month: 8, day: 23, group: "土象" },
  { month: 9, day: 23, group: "风象" }, { month: 10, day: 24, group: "水象" },
  { month: 11, day: 23, group: "火象" }, { month: 12, day: 22, group: "土象" }
];

function zodiacGroupOf(date) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ""));
  if (!match) return null;
  const month = Number(match[2]);
  const day = Number(match[3]);
  const point = ZODIAC_GROUPS.find((item) => item.month === month);
  if (!point) return null;
  if (day >= point.day) return point.group;
  const previous = ZODIAC_GROUPS[(ZODIAC_GROUPS.indexOf(point) + ZODIAC_GROUPS.length - 1) % ZODIAC_GROUPS.length];
  return previous.group; // 上一个星座
}

function birthMonthOf(date) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ""));
  return match ? `${Number(match[2])}月` : "";
}

/** FNV-1a 32 位，用于确定性 seed 抖动。 */
export function hashString(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** 纯 ASCII 比较，避免 localeCompare 在不同浏览器/Node 下排序不一致。 */
function compareId(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function normalizeOptions(options = {}) {
  return {
    wish: Array.isArray(options.wish) ? options.wish.filter((id) => typeof id === "string") : [],
    gender: options.gender || "x",
    budget: TARGET_UNIT_COST[options.budget] ? options.budget : "mid",
    seed: Number.isFinite(options.seed) ? options.seed >>> 0 : 0
  };
}

/** 水晶的五行（知识库存中文，统一转成 wood/fire/earth/metal/water）。 */
export function crystalElements(crystal) {
  const raw = crystal.elements && crystal.elements.length ? crystal.elements : [crystal.element];
  return raw.map((value) => ZH_ELEMENT[value] || value);
}

/**
 * 单颗珠子打分（不含 seed 抖动）。
 * @returns {{score:number, wishHits:string[], bandPenalty:number, reasons:object}}
 */
export function scoreCrystal(crystal, bazi, ctx = {}) {
  const options = normalizeOptions(ctx);
  const favorable = bazi.favorable;
  const elements = crystalElements(crystal);
  // 多元素（彩石）按比例折算，避免"全五行"的石头永远胜出。
  const damping = elements.length >= 3 ? 0.55 : 1;
  let score = 40;

  if (favorable.primary && elements.includes(favorable.primary)) score += 35 * damping;
  if (favorable.secondary && elements.includes(favorable.secondary)) score += 22 * damping;

  let avoidHits = 0;
  for (const key of favorable.avoid || []) {
    if (elements.includes(key)) avoidHits += 1;
  }
  score -= Math.min(2, avoidHits) * 25;

  const wishHits = options.wish.filter((id) => crystal.wishTags.includes(id));
  score += Math.min(2, wishHits.length) * 18;

  if ((GENDER_COLORS[options.gender] || GENDER_COLORS.x).includes(crystal.colorFamily)) score += 6;

  const birthMonth = birthMonthOf(bazi.input && bazi.input.date);
  const zodiacGroup = zodiacGroupOf(bazi.input && bazi.input.date);
  if (crystal.birthMonth && birthMonth && crystal.birthMonth === birthMonth) score += 4;
  else if (zodiacGroup && (crystal.zodiac || []).includes(zodiacGroup)) score += 2;

  // 价格带：落在预算目标内 +3；超出目标则按比例收敛（产品保护，避免 mid 档给出千元设计）。
  const targetCost = TARGET_UNIT_COST[options.budget] || TARGET_UNIT_COST.mid;
  let bandPenalty = 0;
  if (crystal.unitCost <= targetCost) {
    score += 3;
  } else {
    bandPenalty = -Math.min(40, (crystal.unitCost - targetCost) * 1.4);
    score += bandPenalty;
  }
  // 成本为估值的珠子（KB 缺成本）不作为默认首选：商业定价优先真实数据。
  if (crystal.costEstimated) score -= 4;

  return {
    crystal,
    score: Math.round(score * 10) / 10,
    wishHits,
    elementNeed: favorable.primary && elements.includes(favorable.primary)
      ? favorable.primary
      : favorable.secondary && elements.includes(favorable.secondary)
        ? favorable.secondary
        : elements[0]
  };
}

function rankCrystals(bazi, ctx) {
  const options = normalizeOptions(ctx);
  return CRYSTALS
    .map((crystal) => {
      const scored = scoreCrystal(crystal, bazi, options);
      // seed 抖动只影响同分附近的排序，不改变展示分数
      const jitter = options.seed ? (hashString(`${options.seed}:${crystal.id}`) % 5) : 0;
      return { ...scored, order: scored.score + jitter };
    })
    .sort((a, b) => b.order - a.order || b.score - a.score || compareId(a.crystal.id, b.crystal.id));
}

function elementsOf(crystal) {
  return crystalElements(crystal);
}

function distinctValues(crystals, pick) {
  return new Set(crystals.map(pick));
}

function coverageOk(trio) {
  const elementCount = distinctValues(trio, (item) => item.crystal.element).size;
  const colorCount = distinctValues(trio, (item) => item.crystal.colorFamily).size;
  return elementCount >= 2 && colorCount >= 2;
}

/** 依 seed 抖动后排序，贪心选出覆盖 ≥2 五行、≥2 色系的三颗。 */
function chooseTrio(ranked, bazi) {
  const avoid = new Set((bazi && bazi.favorable && bazi.favorable.avoid) || []);
  const chosen = [ranked[0]];
  const used = new Set([ranked[0].crystal.id]);
  const hitsAvoid = (item) => elementsOf(item.crystal).every((key) => avoid.has(key));

  const colorDiverse = (item, list) => list.every((other) => other.crystal.colorFamily !== item.crystal.colorFamily);
  const elementDiverse = (item, list) => list.every((other) => !elementsOf(other.crystal).some((key) => elementsOf(item.crystal).includes(key)));

  // 辅珠：优先「新五行 + 新色系」，其次「新色系」，最后顺位。
  let support = ranked.find((item) => !used.has(item.crystal.id) && elementDiverse(item, chosen) && colorDiverse(item, chosen) && !hitsAvoid(item)) ||
    ranked.find((item) => !used.has(item.crystal.id) && colorDiverse(item, chosen) && !hitsAvoid(item)) ||
    ranked.find((item) => !used.has(item.crystal.id) && elementDiverse(item, chosen) && !hitsAvoid(item)) ||
    ranked.find((item) => !used.has(item.crystal.id) && colorDiverse(item, chosen)) ||
    ranked.find((item) => !used.has(item.crystal.id) && elementDiverse(item, chosen));
  if (!support) support = ranked.find((item) => !used.has(item.crystal.id));
  chosen.push(support);
  used.add(support.crystal.id);

  // 点缀：优先新色系且不落在忌神上（覆盖率已由主/辅满足，不必强求第三种五行）。
  let accent = ranked.find((item) => !used.has(item.crystal.id) && colorDiverse(item, chosen) && !hitsAvoid(item)) ||
    ranked.find((item) => !used.has(item.crystal.id) && !hitsAvoid(item)) ||
    ranked.find((item) => !used.has(item.crystal.id) && colorDiverse(item, chosen)) ||
    ranked.find((item) => !used.has(item.crystal.id));
  chosen.push(accent);

  // 覆盖率兜底：若不足 2 色系 / 2 五行，用顺位替换点缀。
  if (!coverageOk(chosen)) {
    for (const item of ranked) {
      if (used.has(item.crystal.id)) continue;
      const trial = [chosen[0], chosen[1], item];
      if (coverageOk(trial)) {
        chosen[2] = item;
        used.add(item.crystal.id);
        break;
      }
    }
  }
  return chosen;
}

function buildAlternatives(ranked, picks, bazi, ctx) {
  const used = new Set(picks.map((pick) => pick.crystalId));
  const alternatives = {};
  for (const role of ROLES) {
    const pool = ranked.filter((item) => !used.has(item.crystal.id));
    let ordered;
    if (role === "main") {
      ordered = pool.slice().sort((a, b) =>
        scoreCrystal(b.crystal, bazi, ctx).score - scoreCrystal(a.crystal, bazi, ctx).score ||
        compareId(a.crystal.id, b.crystal.id));
    } else if (role === "support") {
      ordered = pool.slice().sort((a, b) =>
        (b.score - a.score) ||
        (elementsOf(b.crystal).length - elementsOf(a.crystal).length) ||
        compareId(a.crystal.id, b.crystal.id));
    } else {
      const mainColor = picks[0] && picks[0].colorFamily;
      ordered = pool.slice().sort((a, b) => {
        const aNew = a.crystal.colorFamily !== mainColor ? 1 : 0;
        const bNew = b.crystal.colorFamily !== mainColor ? 1 : 0;
        return (bNew - aNew) || (b.score - a.score) || compareId(a.crystal.id, b.crystal.id);
      });
    }
    alternatives[role] = ordered.slice(0, 6).map((item) => item.crystal.id);
  }
  return alternatives;
}

/**
 * 推荐三颗珠子。
 * @param {object} bazi computeBazi 的返回值
 * @param {{wish?:string[],gender?:string,budget?:"low"|"mid"|"high",seed?:number}} options
 */
export function recommendCrystals(bazi, options = {}) {
  const ctx = normalizeOptions({ ...options, gender: options.gender || (bazi.input && bazi.input.gender) });
  const ranked = rankCrystals(bazi, ctx);
  const chosen = chooseTrio(ranked, bazi);

  // 主珠取分最高：按展示分数从高到低分配角色，保证 main.score 为三者最大。
  chosen.sort((a, b) => b.score - a.score || compareId(a.crystal.id, b.crystal.id));
  const picks = chosen.map((item, index) => {
    const role = ROLES[index];
    return {
      crystalId: item.crystal.id,
      role,
      score: item.score,
      elementNeed: item.elementNeed,
      reasons: pickReasons(item.crystal, bazi, role, ctx),
      // 便捷字段（渲染器可直接用；不影响契约字段）
      zh: item.crystal.zh,
      en: item.crystal.en,
      colorFamily: item.crystal.colorFamily,
      hex: item.crystal.hex
    };
  });

  return {
    picks,
    alternatives: buildAlternatives(ranked, picks, bazi, ctx),
    narrative: narrative(bazi, picks)
  };
}

/** 编辑模式候选：按角色适配度排序，附带一句「为何适合你」。 */
export function crystalOptionsFor(role, bazi, options = {}) {
  const ctx = normalizeOptions(options);
  const picked = options.picked || [];
  return CRYSTALS
    .filter((crystal) => !picked.includes(crystal.id))
    .map((crystal) => ({ crystal, scored: scoreCrystal(crystal, bazi, ctx) }))
    .sort((a, b) => b.scored.score - a.scored.score || compareId(a.crystal.id, b.crystal.id))
    .map(({ crystal, scored }) => Object.assign({}, crystal, {
      why: pickReasons(crystal, bazi, role, ctx)[0] || "",
      score: scored.score
    }));
}

export { ROLES, ELEMENT_ZH, elementZh };
