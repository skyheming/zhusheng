// 珠生 ZHUSHENG — 手串排版与设计装配
// 颗数 = round((wrist + 1) * 10 / beadDiameter)，夹在 14–30；隔珠每 4–6 颗；
// 挂饰居中（总数为偶数时右移一位）；布局 symmetry / gradient / interval 由 seed 决定。
// layout 每项内嵌已解析的视觉字段，渲染器零依赖读取。
// 同一 seed 必须完全确定（createdAt 使用固定构建时间戳，避免 Date.now）。

import { CHARMS, CRYSTAL_BY_ID } from "../data/crystals.js";
import { ELEMENT_ZH } from "./wuxing.js";
import { priceDesign } from "./pricing.js";
import { themeName, tagline, reading, designStory, pickReasons, narrative as buildNarrative } from "./copy.js";
import { computeBazi } from "./bazi.js";
import { recommendCrystals, scoreCrystal, hashString } from "./recommend.js";

export const DESIGN_VERSION = 1;
// 设计必须是确定性的，因此不使用 Date.now；此时间戳为 v1 构建基准时间。
export const DESIGN_EPOCH = "2026-10-18T08:00:00+08:00";
export const LAYOUT_STYLES = ["symmetry", "gradient", "interval"];
export const ROLE_KEYS = ["main", "support", "accent"];

const DEFAULT_WRIST = { f: 15.5, m: 17, x: 16 };
const SPACER_SIZE = { 6: 4, 8: 6, 10: 6 };
const GOLD_TONE = "#C8AE7C";
const MAX_BEADS = 30;
const MIN_BEADS = 14;

function round1(value) {
  return Math.round(value * 10) / 10;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toSeed(seed) {
  const value = Number(seed);
  return Number.isFinite(value) ? (value >>> 0) : 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function normalizeInput(input = {}) {
  const wish = Array.isArray(input.wish)
    ? input.wish.filter((id) => typeof id === "string" && id.length > 0)
    : [];
  return {
    date: input.date,
    time: input.time === undefined || input.time === "" ? null : input.time,
    gender: input.gender || "x",
    wish: Array.from(new Set(wish)).sort(),
    locale: input.locale === "en" ? "en" : "zh"
  };
}

export function normalizeOptions(options = {}, input = {}) {
  const gender = input.gender || options.gender || "x";
  const rawWrist = Number(options.wrist);
  const wrist = round1(clamp(Number.isFinite(rawWrist) && rawWrist > 0 ? rawWrist : DEFAULT_WRIST[gender] || 16, 13, 21));
  const rawDiameter = Number(options.beadDiameter);
  const beadDiameter = [6, 8, 10].includes(rawDiameter) ? rawDiameter : 8;
  const metal = options.metal === "gold" ? "gold" : "silver";
  const charm = CHARMS.some((item) => item.id === options.charm) ? options.charm : "none";
  const layout = LAYOUT_STYLES.includes(options.layout) ? options.layout : null;
  const rawInterval = Number(options.spacerInterval);
  const spacerInterval = [0, 4, 5, 6].includes(rawInterval) ? rawInterval : 0;
  const special = options.special || {};
  return {
    wrist,
    beadDiameter,
    metal,
    charm,
    layout,
    spacerInterval,
    special: {
      main: !!special.main,
      support: !!special.support,
      accent: !!special.accent
    }
  };
}

/** 核心状态：token / id 只由这些字段决定（八字、文案、价格解码后重算）。 */
export function coreState({ input, options, picks, seed, edited, budget }) {
  const normalizedInput = normalizeInput(input);
  const normalizedOptions = normalizeOptions(options, normalizedInput);
  const budgetValue = ["low", "mid", "high"].includes(budget) ? budget : "mid";
  return {
    i: [
      normalizedInput.date,
      normalizedInput.time,
      normalizedInput.gender,
      normalizedInput.wish.slice().sort(),
      normalizedInput.locale
    ],
    o: [
      normalizedOptions.wrist,
      normalizedOptions.beadDiameter,
      normalizedOptions.metal,
      normalizedOptions.charm,
      normalizedOptions.layout,
      normalizedOptions.spacerInterval,
      normalizedOptions.special.main,
      normalizedOptions.special.support,
      normalizedOptions.special.accent
    ],
    p: (picks || []).map((pick) => [pick.crystalId, pick.role]),
    s: toSeed(seed),
    e: edited ? 1 : 0,
    b: budgetValue
  };
}

const SHORT_ID_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/** 设计编号 ZS-XXXX（由核心状态哈希生成，稳定、仅展示用）。 */
export function coreShortId(state) {
  const text = JSON.stringify(state);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  let value = hash;
  let suffix = "";
  for (let i = 0; i < 4; i += 1) {
    suffix += SHORT_ID_ALPHABET[value & 31];
    value >>>= 5;
  }
  return `ZS-${suffix}`;
}

export function beadCountFor(wrist, beadDiameter) {
  const raw = Math.round(((Number(wrist) + 1.0) * 10) / Number(beadDiameter));
  return clamp(Number.isFinite(raw) ? raw : 18, MIN_BEADS, MAX_BEADS);
}

function roleCounts(beadCount) {
  let main = Math.max(3, Math.round(beadCount * 0.45));
  let support = Math.max(3, Math.round(beadCount * 0.33));
  let accent = beadCount - main - support;
  let guard = 0;
  while (accent < 2 && guard < 20) {
    if (main >= support && main > 3) main -= 1;
    else if (support > 3) support -= 1;
    else break;
    accent = beadCount - main - support;
    guard += 1;
  }
  if (main < support) [main, support] = [support, main];
  return { main, support, accent };
}

function distanceOrder(n) {
  const center = (n - 1) / 2;
  return Array.from({ length: n }, (_, index) => index)
    .sort((a, b) => (Math.abs(a - center) - Math.abs(b - center)) || (a - b));
}

function weightedSpread(counts) {
  const n = counts.main + counts.support + counts.accent;
  const remain = { ...counts };
  const sequence = [];
  for (let i = 0; i < n; i += 1) {
    let best = null;
    let bestRatio = -1;
    for (const role of ROLE_KEYS) {
      if (remain[role] <= 0) continue;
      const ratio = remain[role] / counts[role];
      if (ratio > bestRatio) {
        bestRatio = ratio;
        best = role;
      }
    }
    sequence.push(best);
    remain[best] -= 1;
  }
  return sequence;
}

/** 生成角色序列（长度 = beadCount）。 */
export function buildRoleSequence(beadCount, style) {
  const counts = roleCounts(beadCount);
  const n = beadCount;
  const sequence = new Array(n);

  if (style === "gradient") {
    // 主珠占 45% 弧段，顺次过渡到辅珠、点缀。
    let index = 0;
    for (const role of ROLE_KEYS) {
      for (let k = 0; k < counts[role]; k += 1) sequence[index++] = role;
    }
    return sequence;
  }
  if (style === "interval") {
    return weightedSpread(counts);
  }
  // symmetry：主珠居中，向两侧依次为辅珠、点缀。
  const order = distanceOrder(n);
  let cursor = 0;
  for (const role of ROLE_KEYS) {
    for (let k = 0; k < counts[role]; k += 1) sequence[order[cursor++]] = role;
  }
  return sequence;
}

function spacerBoundaries(beadCount, interval) {
  if (!interval || interval <= 0) return [];
  const boundaries = [];
  for (let position = interval; position < beadCount; position += interval) boundaries.push(position);
  if (boundaries.length === 0 && beadCount > 4) boundaries.push(Math.floor(beadCount / 2));
  return boundaries;
}

function ensurePicks(picks) {
  if (!Array.isArray(picks) || picks.length !== 3) {
    throw new Error("composeDesign 需要恰好 3 颗珠子");
  }
  const seen = new Set();
  const byRole = {};
  for (const pick of picks) {
    const crystal = CRYSTAL_BY_ID[pick.crystalId];
    if (!crystal) throw new Error(`未知水晶: ${pick.crystalId}`);
    if (seen.has(pick.crystalId)) throw new Error("三颗珠子不能重复");
    seen.add(pick.crystalId);
    if (!ROLE_KEYS.includes(pick.role)) throw new Error(`未知角色: ${pick.role}`);
    byRole[pick.role] = crystal;
  }
  for (const role of ROLE_KEYS) {
    if (!byRole[role]) throw new Error(`缺少 ${role} 角色`);
  }
  return byRole;
}

/**
 * 装配完整设计。
 * @param {{bazi:object, picks:Array, input:object, options:object, seed:number, edited?:boolean}} params
 */
export function composeDesign({ bazi, picks, input, options, seed, edited = false, budget = "mid" }) {
  const seedValue = toSeed(seed);
  const normalizedInput = normalizeInput(input);
  const resolved = normalizeOptions(options, normalizedInput);
  const byRole = ensurePicks(picks);

  const random = mulberry32(seedValue);
  const r1 = random();
  const r2 = random();
  const explicitLayout = !!resolved.layout;
  const explicitSpacer = resolved.spacerInterval !== 0;
  const layoutStyle = resolved.layout || LAYOUT_STYLES[Math.floor(r1 * LAYOUT_STYLES.length) % LAYOUT_STYLES.length];
  // 0 = 无隔珠（默认）。用户未主动添加配件时，保持整串同尺寸晶石珠。
  const spacerInterval = resolved.spacerInterval;
  // 把 seed 决定的值写回 options，编辑器可显示当前布局，token 往返也保持稳定。
  const stateOptions = { ...resolved, layout: layoutStyle, spacerInterval };

  const beadDiameter = resolved.beadDiameter;
  const beadCount = beadCountFor(resolved.wrist, beadDiameter);
  const sequence = buildRoleSequence(beadCount, layoutStyle);
  const spacerSize = SPACER_SIZE[beadDiameter] || 6;
  const boundaries = new Set(spacerBoundaries(beadCount, spacerInterval));

  const layout = [];
  for (let i = 0; i < beadCount; i += 1) {
    if (i > 0 && boundaries.has(i)) {
      layout.push({ kind: "spacer", metal: resolved.metal, size: spacerSize, pos: 0 });
    }
    const role = sequence[i];
    const crystal = byRole[role];
    layout.push({
      kind: "bead",
      crystalId: crystal.id,
      zh: crystal.zh,
      en: crystal.en,
      size: beadDiameter,
      role,
      pos: 0,
      hex: crystal.hex,
      hex2: crystal.hex2,
      hex3: crystal.hex3,
      texture: crystal.texture,
      element: crystal.element
    });
  }

  const charmDef = CHARMS.find((item) => item.id === resolved.charm) || CHARMS[0];
  if (charmDef.id !== "none") {
    const totalWithCharm = layout.length + 1;
    const charmIndex = totalWithCharm % 2 === 1
      ? (totalWithCharm - 1) / 2
      : totalWithCharm / 2;
    layout.splice(charmIndex, 0, {
      kind: "charm",
      charmId: charmDef.id,
      zh: charmDef.zh,
      pos: 0
    });
  }
  layout.forEach((item, index) => { item.pos = index; });

  const composition = {
    wrist: resolved.wrist,
    beadDiameter,
    beadCount,
    metal: resolved.metal,
    charm: { id: charmDef.id, zh: charmDef.zh, price: charmDef.price },
    layout,
    layoutStyle,
    spacerInterval
  };

  const crystals = ROLE_KEYS.map((role) => byRole[role]);
  const theme = {
    name: themeName(bazi, picks),
    palette: [crystals[0].hex, crystals[1].hex, crystals[2].hex, GOLD_TONE]
  };
  const copy = {
    headline: theme.name,
    tagline: tagline(bazi, picks, normalizedInput),
    reading: reading(bazi, normalizedInput),
    designStory: designStory(bazi, picks, { layoutStyle, metal: resolved.metal })
  };

  // 未显式指定的布局不进 token / id（由 seed 决定，解码后可等价重算）。
  const idOptions = {
    ...stateOptions,
    layout: explicitLayout ? layoutStyle : null,
    spacerInterval: explicitSpacer ? spacerInterval : null
  };
  const state = coreState({ input: normalizedInput, options: idOptions, picks, seed: seedValue, edited, budget });
  const design = {
    version: DESIGN_VERSION,
    id: coreShortId(state),
    createdAt: DESIGN_EPOCH,
    input: normalizedInput,
    bazi,
    theme,
    picks,
    composition,
    copy,
    options: stateOptions,
    meta: {
      seed: seedValue,
      edited: !!edited,
      budget: ["low", "mid", "high"].includes(budget) ? budget : "mid",
      layoutExplicit: explicitLayout,
      spacerExplicit: explicitSpacer
    }
  };
  design.pricing = priceDesign(design);
  return design;
}

/** 由核心状态（token 解码 / 换 seed）重新生成完整设计。 */
export function buildDesignFromState(state = {}) {
  const input = normalizeInput(state.input || {});
  const bazi = computeBazi({
    date: input.date,
    time: input.time,
    gender: input.gender
  });
  const seed = toSeed(state.seed);
  const ctx = {
    wish: input.wish,
    gender: input.gender,
    budget: state.budget || "mid",
    seed
  };
  const recommendation = recommendCrystals(bazi, ctx);
  let picks = recommendation.picks;
  if (Array.isArray(state.picks) && state.picks.length === 3) {
    const used = new Set();
    picks = state.picks.map((entry) => {
      const crystalId = Array.isArray(entry) ? entry[0] : entry.crystalId;
      const role = Array.isArray(entry) ? entry[1] : entry.role;
      const crystal = CRYSTAL_BY_ID[crystalId];
      if (!crystal || used.has(crystalId) || !ROLE_KEYS.includes(role)) {
        throw new Error("token 内的选珠不合法");
      }
      used.add(crystalId);
      const scored = scoreCrystal(crystal, bazi, ctx);
      return {
        crystalId,
        role,
        score: scored.score,
        elementNeed: scored.elementNeed,
        reasons: pickReasons(crystal, bazi, role, ctx),
        zh: crystal.zh,
        en: crystal.en,
        colorFamily: crystal.colorFamily,
        hex: crystal.hex
      };
    });
    // 角色必须齐全
    if (new Set(picks.map((pick) => pick.role)).size !== 3) throw new Error("token 内的角色不合法");
  }
  picks.sort((a, b) => ROLE_KEYS.indexOf(a.role) - ROLE_KEYS.indexOf(b.role));

  const design = composeDesign({
    bazi,
    picks,
    input,
    options: state.options,
    seed,
    edited: !!state.edited,
    budget: ctx.budget
  });
  design.narrative = buildNarrative(bazi, picks);
  design.alternatives = recommendation.alternatives;
  return design;
}

/** 由设计派生 seed：同生辰 + 性别 + 心愿 → 同 seed。 */
export function deriveSeed(input = {}) {
  const normalized = normalizeInput(input);
  const key = [
    normalized.date,
    normalized.time || "",
    normalized.gender,
    normalized.wish.slice().sort().join(",")
  ].join("|");
  const dateNumber = Number(String(normalized.date || "").replace(/-/g, "")) || 0;
  return ((dateNumber * 100) + (hashString(key) % 100)) >>> 0;
}

export { ELEMENT_ZH };
