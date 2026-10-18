// 珠生 ZHUSHENG — Core 门面（UI / 渲染器只依赖本文件）
// 纯静态、零依赖、离线可用。所有生成函数确定性：同输入 → 同设计。

import {
  CRYSTALS,
  CRYSTAL_BY_ID,
  WISHES,
  ELEMENTS,
  CHARMS
} from "../data/crystals.js";
import { computeBazi } from "./bazi.js";
import { crystalOptionsFor, recommendCrystals } from "./recommend.js";
import {
  LAYOUT_STYLES,
  normalizeInput,
  buildDesignFromState,
  deriveSeed,
  beadCountFor
} from "./compose.js";
import { encodeDesign, decodeDesign, designShortId, parseToken } from "./share.js";
import { priceDesign, formatPrice, shippingFor } from "./pricing.js";
import { WISH_ZH, ROLE_ZH } from "./copy.js";

export const MIN_YEAR = 1900;
export const MAX_YEAR = 2100;
export const GENDERS = ["f", "m", "x"];
export const BUDGETS = ["low", "mid", "high"];
export const DEFAULT_WRIST = { f: 15.5, m: 17, x: 16 };
export const DEFAULT_OPTIONS = {
  wrist: 16,
  beadDiameter: 8,
  metal: "silver",
  charm: "lotus"
};

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{1,2}):(\d{2})$/;

function todayLocal() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  return { year, month, day };
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function validCalendarDate(year, month, day) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const probe = new Date(Date.UTC(year, month - 1, day));
  return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
}

function normalizeDateValue(value) {
  if (typeof value === "string") {
    // 兼容浏览器 date input 与手填的 "1990-5-15"
    const loose = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(value.trim());
    if (loose) return `${loose[1]}-${pad2(loose[2])}-${pad2(loose[3])}`;
    return value;
  }
  if (value && typeof value === "object" && value.year && value.month && value.day) {
    return `${String(value.year).padStart(4, "0")}-${pad2(value.month)}-${pad2(value.day)}`;
  }
  return "";
}

function validateWishList(wish, errors) {
  if (wish === undefined || wish === null) return [];
  const list = Array.isArray(wish) ? wish : [wish];
  const ids = new Set(WISHES.map((item) => item.id));
  const out = [];
  for (const id of list) {
    if (typeof id !== "string" || !ids.has(id)) {
      errors.wish = "心愿取值不合法";
      continue;
    }
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

function validateOptions(options, errors) {
  if (options === undefined || options === null) return {};
  if (typeof options !== "object") {
    errors.options = "选项必须是对象";
    return {};
  }
  const out = {};
  if (options.wrist !== undefined) {
    const wrist = Number(options.wrist);
    if (!Number.isFinite(wrist) || wrist < 13 || wrist > 21) errors.wrist = "手围应在 13–21cm";
    else out.wrist = Math.round(wrist * 10) / 10;
  }
  if (options.beadDiameter !== undefined) {
    const diameter = Number(options.beadDiameter);
    if (![6, 8, 10].includes(diameter)) errors.beadDiameter = "珠径仅支持 6 / 8 / 10mm";
    else out.beadDiameter = diameter;
  }
  if (options.metal !== undefined) {
    if (!["silver", "gold"].includes(options.metal)) errors.metal = "金属仅支持 silver / gold";
    else out.metal = options.metal;
  }
  if (options.charm !== undefined) {
    if (!CHARMS.some((item) => item.id === options.charm)) errors.charm = "挂饰取值不合法";
    else out.charm = options.charm;
  }
  if (options.layout !== undefined && options.layout !== null) {
    if (!LAYOUT_STYLES.includes(options.layout)) errors.layout = "布局仅支持 symmetry / gradient / interval";
    else out.layout = options.layout;
  }
  if (options.spacerInterval !== undefined && options.spacerInterval !== null) {
    const interval = Number(options.spacerInterval);
    if (![0, 4, 5, 6].includes(interval)) errors.spacerInterval = "隔珠密度仅支持 0（无）/ 4 / 5 / 6";
    else out.spacerInterval = interval;
  }
  if (options.special !== undefined && options.special !== null) {
    const special = options.special;
    if (typeof special !== "object") errors.special = "special 必须是对象";
    else {
      out.special = {
        main: !!special.main,
        support: !!special.support,
        accent: !!special.accent
      };
    }
  }
  return out;
}

/**
 * 输入校验（UI 表单与门面共用）。
 * @returns {{ok:boolean, errors:object, input:object, options:object, budget:string}}
 */
export function validateInput(input = {}) {
  const errors = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: { form: "参数必须是对象" }, input: null, options: {}, budget: "mid" };
  }

  const dateText = normalizeDateValue(input.date);
  const match = DATE_RE.exec(dateText);
  let date = dateText;
  if (!match) {
    errors.date = "请选择生日（格式 YYYY-MM-DD）";
  } else {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (year < MIN_YEAR || year > MAX_YEAR) errors.date = `仅支持 ${MIN_YEAR}–${MAX_YEAR} 年`;
    else if (!validCalendarDate(year, month, day)) errors.date = "这个日期不存在";
    else {
      const today = todayLocal();
      const todayNumber = today.year * 10000 + today.month * 100 + today.day;
      const dateNumber = year * 10000 + month * 100 + day;
      if (dateNumber > todayNumber) errors.date = "生日不能晚于今天";
    }
  }

  let time = null;
  if (input.time !== undefined && input.time !== null && input.time !== "") {
    const timeMatch = TIME_RE.exec(String(input.time));
    if (!timeMatch) errors.time = "时间格式应为 HH:MM";
    else {
      const hour = Number(timeMatch[1]);
      const minute = Number(timeMatch[2]);
      if (hour > 23 || minute > 59) errors.time = "时间不合法";
      else time = `${pad2(hour)}:${pad2(minute)}`;
    }
  } else if (input.time === "") {
    time = null;
  }

  let gender = "x";
  if (input.gender !== undefined && input.gender !== null) {
    if (!GENDERS.includes(input.gender)) errors.gender = "性别取值应为 f / m / x";
    else gender = input.gender;
  }

  const wish = validateWishList(input.wish, errors);
  let budget = "mid";
  if (input.budget !== undefined) {
    if (!BUDGETS.includes(input.budget)) errors.budget = "预算档位不合法";
    else budget = input.budget;
  }

  const options = validateOptions(input.options, errors);
  const normalizedInput = {
    date,
    time,
    gender,
    wish,
    locale: input.locale === "en" ? "en" : "zh"
  };

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    input: normalizedInput,
    options,
    budget,
    seed: input.seed !== undefined ? Number(input.seed) : undefined
  };
}

function assertValidInput(input) {
  const result = validateInput(input);
  if (!result.ok) {
    const error = new Error(Object.values(result.errors).join("；") || "输入不合法");
    error.code = "INVALID_INPUT";
    error.errors = result.errors;
    throw error;
  }
  return result;
}

function resolveSeed(result, input) {
  if (Number.isFinite(result.seed) && result.seed >= 0) return result.seed >>> 0;
  return deriveSeed(result.input);
}

/**
 * 生成设计。
 * @param {{date:string,time?:string|null,gender?:"f"|"m"|"x",wish?:string[],
 *          options?:object,budget?:"low"|"mid"|"high",seed?:number,locale?:"zh"|"en"}} input
 */
export function generateDesign(input = {}) {
  const result = assertValidInput(input);
  const seed = resolveSeed(result, input);
  return buildDesignFromState({
    input: result.input,
    options: result.options,
    seed,
    budget: result.budget,
    edited: false
  });
}

/** 同输入换 seed（「换一批看看」）。 */
export function generateVariation(design) {
  if (!design || !design.input) throw new Error("generateVariation 需要设计对象");
  const meta = design.meta || {};
  const seed = ((Number(meta.seed) || 0) + 1) >>> 0;
  const options = { ...(design.options || {}) };
  if (!meta.layoutExplicit) delete options.layout;
  if (!meta.spacerExplicit) delete options.spacerInterval;
  return buildDesignFromState({
    input: design.input,
    options,
    seed,
    budget: meta.budget || "mid",
    edited: !!meta.edited
  });
}

/** token → 设计；损坏返回 null。 */
export function rebuildDesign(token) {
  return decodeDesign(token);
}

function roleIndex(picks, role) {
  return (picks || []).findIndex((pick) => pick.role === role);
}

/**
 * 编辑设计（不可变，返回新设计）。
 * patch: { wrist?, beadDiameter?, metal?, charm?, layout?, spacerInterval?,
 *          special?:{main?,support?,accent?}, replace?:{main?:id,support?:id,accent?:id}, wish? }
 */
export function applyEdit(design, patch = {}) {
  if (!design || !design.input || !design.composition) throw new Error("applyEdit 需要设计对象");
  const errors = {};
  const input = normalizeInput(design.input);
  if (patch.wish !== undefined) {
    input.wish = validateWishList(patch.wish, errors);
  }
  const options = validateOptions({ ...(design.options || {}), ...(patch.options || {}) }, errors);
  // patch 顶层也接受尺寸字段（与契约一致）
  for (const key of ["wrist", "beadDiameter", "metal", "charm", "layout", "spacerInterval"]) {
    if (patch[key] !== undefined) {
      const single = validateOptions({ [key]: patch[key] }, errors);
      if (single[key] !== undefined) options[key] = single[key];
    }
  }
  if (patch.special !== undefined) {
    if (patch.special === null || typeof patch.special !== "object") {
      errors.special = "special 必须是对象";
    } else {
      const merged = { ...((design.options || {}).special || {}) };
      for (const role of ["main", "support", "accent"]) {
        if (patch.special[role] !== undefined) merged[role] = !!patch.special[role];
      }
      options.special = merged;
    }
  }
  if (Object.keys(errors).length > 0) {
    const error = new Error(Object.values(errors).join("；"));
    error.code = "INVALID_PATCH";
    error.errors = errors;
    throw error;
  }

  const meta = design.meta || {};
  const seed = (Number(meta.seed) || 0) >>> 0;
  const budget = meta.budget || "mid";
  let picks = (design.picks || []).map((pick) => ({ crystalId: pick.crystalId, role: pick.role }));

  // 心愿变化 → 重新推荐（保留用户后续的换珠）
  if (patch.wish !== undefined) {
    const bazi = computeBazi({ date: input.date, time: input.time, gender: input.gender });
    const recommendation = recomputeRecommendation(bazi, input, seed, budget);
    picks = recommendation.map((pick) => ({ crystalId: pick.crystalId, role: pick.role }));
  }

  if (patch.replace) {
    for (const role of ["main", "support", "accent"]) {
      const crystalId = patch.replace[role];
      if (!crystalId) continue;
      if (!CRYSTAL_BY_ID[crystalId]) {
        const error = new Error(`未知水晶: ${crystalId}`);
        error.code = "INVALID_PATCH";
        throw error;
      }
      const index = roleIndex(picks, role);
      if (index < 0) throw new Error(`缺少角色: ${role}`);
      picks[index] = { crystalId, role };
    }
    const ids = picks.map((pick) => pick.crystalId);
    if (new Set(ids).size !== ids.length) {
      const error = new Error("三颗珠子不能重复");
      error.code = "INVALID_PATCH";
      throw error;
    }
  }

  if (patch.layout !== undefined && patch.layout !== null) options.layout = patch.layout;

  const next = buildDesignFromState({
    input,
    options,
    picks,
    seed,
    budget,
    edited: true
  });
  return next;
}

function recomputeRecommendation(bazi, input, seed, budget) {
  return recommendCrystals(bazi, {
    wish: input.wish,
    gender: input.gender,
    budget,
    seed
  }).picks;
}

/** 编辑器候选（按角色适配度排序，附带一句 why）。 */
export function optionsFor(role, bazi, options = {}) {
  if (!["main", "support", "accent"].includes(role)) throw new Error(`未知角色: ${role}`);
  if (!bazi || !bazi.favorable) throw new Error("optionsFor 需要八字数据");
  return crystalOptionsFor(role, bazi, options);
}

export function getCrystal(id) {
  return CRYSTAL_BY_ID[id] || null;
}

export function defaultWristFor(gender) {
  return DEFAULT_WRIST[gender] || DEFAULT_WRIST.x;
}

export { CRYSTALS, CRYSTAL_BY_ID, WISHES, ELEMENTS, CHARMS };
export { computeBazi, beadCountFor };
export { encodeDesign, decodeDesign, designShortId, parseToken };
export { priceDesign, formatPrice, shippingFor };
export { LAYOUT_STYLES };
export { WISH_ZH, ROLE_ZH };
