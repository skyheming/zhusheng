// 珠生 ZHUSHENG — 五行引擎
// 藏干权重、月令旺相休囚死、生克关系、日主强弱（得令/得地/得势）、喜用神。
// 纯函数、无 DOM、无 Date.now；bazi.js 依赖本模块，本模块不依赖其它 core 模块。

export const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
export const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

export const ELEMENT_KEYS = ["wood", "fire", "earth", "metal", "water"];

export const ELEMENT_ZH = { wood: "木", fire: "火", earth: "土", metal: "金", water: "水" };
export const ZH_ELEMENT = { 木: "wood", 火: "fire", 土: "earth", 金: "metal", 水: "water" };

// 相生：木→火→土→金→水→木
export const GENERATES = { wood: "fire", fire: "earth", earth: "metal", metal: "water", water: "wood" };
// 相克：木克土、土克水、水克火、火克金、金克木
export const CONTROLS = { wood: "earth", earth: "water", water: "fire", fire: "metal", metal: "wood" };

export const STEM_ELEMENTS = ["wood", "wood", "fire", "fire", "earth", "earth", "metal", "metal", "water", "water"];
export const STEM_POLARITY = ["yang", "yin", "yang", "yin", "yang", "yin", "yang", "yin", "yang", "yin"];
export const BRANCH_ELEMENTS = ["water", "earth", "wood", "wood", "earth", "fire", "fire", "earth", "metal", "metal", "earth", "water"];

// 地支藏干：[天干, 权重]，本气 / 中气 / 余气。
export const HIDDEN_STEMS = {
  子: [["癸", 1]],
  丑: [["己", 0.6], ["癸", 0.3], ["辛", 0.1]],
  寅: [["甲", 0.6], ["丙", 0.3], ["戊", 0.1]],
  卯: [["乙", 1]],
  辰: [["戊", 0.6], ["乙", 0.3], ["癸", 0.1]],
  巳: [["丙", 0.6], ["戊", 0.3], ["庚", 0.1]],
  午: [["丁", 0.7], ["己", 0.3]],
  未: [["己", 0.6], ["丁", 0.3], ["乙", 0.1]],
  申: [["庚", 0.6], ["壬", 0.3], ["戊", 0.1]],
  酉: [["辛", 1]],
  戌: [["戊", 0.6], ["辛", 0.3], ["丁", 0.1]],
  亥: [["壬", 0.7], ["甲", 0.3]]
};

export const PILLAR_KEYS = ["year", "month", "day", "hour"];

// 天干权重（月干得令，略重）；地支藏干权重（月令最重，日支次之）。
const STEM_WEIGHT = { year: 0.8, month: 1.2, day: 1.0, hour: 1.0 };
const BRANCH_WEIGHT = { year: 1.0, month: 1.6, day: 1.2, hour: 1.0 };

export function isElement(value) {
  return Object.prototype.hasOwnProperty.call(ELEMENT_ZH, value);
}

export function elementZh(key) {
  return ELEMENT_ZH[key] || "";
}

export function elementKey(zh) {
  return ZH_ELEMENT[zh] || null;
}

/** 生我者（印）。 */
export function generatorOf(element) {
  return Object.keys(GENERATES).find((key) => GENERATES[key] === element) || null;
}

/** 我生者（食伤）。 */
export function childOf(element) {
  return GENERATES[element] || null;
}

/** 我克者（财）。 */
export function wealthOf(element) {
  return CONTROLS[element] || null;
}

/** 克我者（官杀）。 */
export function controllerOf(element) {
  return Object.keys(CONTROLS).find((key) => CONTROLS[key] === element) || null;
}

export function stemInfo(stem) {
  const idx = STEMS.indexOf(stem);
  if (idx < 0) return null;
  return { stem, idx, element: STEM_ELEMENTS[idx], elementZh: ELEMENT_ZH[STEM_ELEMENTS[idx]], polarity: STEM_POLARITY[idx] };
}

export function branchElement(branch) {
  const idx = BRANCHES.indexOf(branch);
  return idx < 0 ? null : BRANCH_ELEMENTS[idx];
}

/** 地支藏干明细（含五行与权重）。 */
export function hiddenStems(branch) {
  const list = HIDDEN_STEMS[branch];
  if (!list) return [];
  return list.map(([stem, weight]) => ({ stem, weight, element: STEM_ELEMENTS[STEMS.indexOf(stem)] }));
}

export function hiddenStemNames(branch) {
  return (HIDDEN_STEMS[branch] || []).map(([stem]) => stem);
}

/**
 * 月令旺相休囚死。
 * 旺=同我（当令）、相=生我、休=我生、囚=我克、死=克我。
 */
export function monthVigor(monthBranch, dayMasterElement) {
  const monthElement = branchElement(monthBranch);
  if (!monthElement || !dayMasterElement) return { state: "休", element: null };
  let state;
  if (monthElement === dayMasterElement) state = "旺";
  else if (GENERATES[monthElement] === dayMasterElement) state = "相";
  else if (GENERATES[dayMasterElement] === monthElement) state = "休";
  else if (CONTROLS[dayMasterElement] === monthElement) state = "囚";
  else state = "死";
  return { state, element: monthElement };
}

const VIGOR_SCORE = { 旺: 24, 相: 18, 休: -2, 囚: -14, 死: -20 };

/** 五行原始分数（未归一化），四柱天干 + 地支藏干加权。 */
export function rawElementScores(pillars) {
  const raw = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  for (const key of PILLAR_KEYS) {
    const pillar = pillars[key];
    if (!pillar) continue;
    const stemIdx = STEMS.indexOf(pillar.stem);
    if (stemIdx < 0) continue;
    raw[STEM_ELEMENTS[stemIdx]] += STEM_WEIGHT[key];
    for (const hidden of hiddenStems(pillar.branch)) {
      raw[hidden.element] += BRANCH_WEIGHT[key] * hidden.weight;
    }
  }
  return raw;
}

/** 归一化到 100（保留 1 位小数，最大余数法保证合计恰好 100）。 */
export function normalizeScores(raw) {
  const keys = ELEMENT_KEYS;
  const total = keys.reduce((sum, key) => sum + raw[key], 0);
  if (total <= 0) return { wood: 20, fire: 20, earth: 20, metal: 20, water: 20 };
  const tenths = keys.map((key) => (raw[key] / total) * 1000);
  const base = tenths.map((value) => Math.floor(value));
  let remainder = 1000 - base.reduce((sum, value) => sum + value, 0);
  const order = tenths
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let i = 0; i < remainder; i += 1) base[order[i % order.length].index] += 1;
  const out = {};
  keys.forEach((key, index) => { out[key] = Number((base[index] / 10).toFixed(1)); });
  return out;
}

export function dayMasterInfo(dayStem) {
  const info = stemInfo(dayStem);
  if (!info) return null;
  return {
    stem: info.stem,
    element: info.element,
    elementZh: info.elementZh,
    polarity: info.polarity
  };
}

/**
 * 日主强弱：得令（月令旺相）、得地（地支藏干有根）、得势（同党占比）。
 * 返回 score 0-100 与可解释的 detail。
 */
export function evaluateStrength(pillars) {
  const dayStemIdx = STEMS.indexOf(pillars.day.stem);
  const dayMasterElement = STEM_ELEMENTS[dayStemIdx];
  const vigor = monthVigor(pillars.month.branch, dayMasterElement);
  const supportElements = [dayMasterElement, generatorOf(dayMasterElement)];

  let supportRaw = 0;
  let totalRaw = 0;
  const raw = rawElementScores(pillars);
  for (const key of ELEMENT_KEYS) {
    totalRaw += raw[key];
    if (supportElements.includes(key)) supportRaw += raw[key];
  }
  const ratio = totalRaw > 0 ? supportRaw / totalRaw : 0.5;

  const roots = [];
  for (const key of PILLAR_KEYS) {
    const pillar = pillars[key];
    if (!pillar) continue;
    const rooted = hiddenStems(pillar.branch).some((hidden) => hidden.element === dayMasterElement);
    if (rooted) roots.push(key);
  }
  const dayBranchRooted = roots.includes("day");
  const deLing = vigor.state === "旺" || vigor.state === "相";
  const deDi = roots.length > 0;
  const deShi = ratio >= 0.42;

  let score = 50;
  score += VIGOR_SCORE[vigor.state];
  if (deDi) score += dayBranchRooted ? 8 : 5;
  score += Math.min(3, Math.max(0, roots.length - 1) * 3);
  score += deShi ? 5 : -5;
  score += (ratio - 0.45) * 30;
  score = Math.max(2, Math.min(98, Math.round(score * 10) / 10));

  let label;
  if (score < 35) label = "身弱";
  else if (score < 43) label = "偏弱";
  else if (score < 57) label = "中和";
  else if (score < 65) label = "偏强";
  else label = "身强";

  return {
    score,
    label,
    detail: { deLing, deDi, deShi },
    monthState: vigor.state,
    supportRatio: Math.round(ratio * 1000) / 1000
  };
}

function topElements(elements, keys, limit) {
  return keys
    .map((key) => ({ key, value: elements[key] }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
    .map((item) => item.key);
}

/**
 * 喜用神。
 * 身弱取印比，身强取食伤财官；兼顾调候（夏用水、冬用火）与缺失。
 */
export function favorableElements(pillars, elements, strength) {
  const dayMaster = dayMasterInfo(pillars.day.stem);
  const dm = dayMaster.element;
  const yin = generatorOf(dm);
  const bi = dm;
  const shi = childOf(dm);
  const cai = wealthOf(dm);
  const guan = controllerOf(dm);

  const monthBranch = pillars.month.branch;
  const monthIndex = BRANCHES.indexOf(monthBranch);
  const isSummer = monthIndex >= 5 && monthIndex <= 7; // 巳午未
  const isWinter = monthIndex === 11 || monthIndex <= 1; // 亥子丑
  const tiaohou = isSummer ? "water" : isWinter ? "fire" : null;

  const missing = ELEMENT_KEYS.filter((key) => elements[key] < 8);
  const weak = strength.score < 43;
  const strong = strength.score > 57;

  let primary;
  let secondary;
  let avoid;

  if (weak) {
    // 官杀重则用印化杀，财重则用比劫帮身；同类优先补不足。
    if (elements[guan] >= elements[cai]) {
      primary = yin;
      secondary = bi;
    } else {
      primary = bi;
      secondary = yin;
    }
    // 调候：夏生偏弱若水为印/比则优先；冬生偏弱若火为印/比则优先。
    if (tiaohou && (tiaohou === yin || tiaohou === bi)) primary = tiaohou;
    // 兼顾缺失：用神之一仍缺，则把缺失的喜神提到次喜。
    const support = [yin, bi];
    const missingSupport = missing.find((key) => support.includes(key));
    if (missingSupport && missingSupport !== primary) secondary = missingSupport;
    avoid = topElements(elements, [shi, cai, guan], 2);
  } else if (strong) {
    // 身强：食伤泄、财耗、官杀克，取最需要（得分最低）者。
    const candidates = [shi, cai, guan].sort((a, b) => elements[a] - elements[b]);
    primary = candidates[0];
    secondary = candidates[1];
    if (tiaohou && candidates.includes(tiaohou) && elements[tiaohou] < 25) primary = tiaohou;
    const missingNeed = missing.find((key) => [shi, cai, guan].includes(key));
    if (missingNeed && missingNeed !== primary) secondary = missingNeed;
    avoid = topElements(elements, [bi, yin], 2);
  } else {
    // 中和：以最弱者为用，兼顾调候与缺失。
    const sorted = ELEMENT_KEYS.slice().sort((a, b) => elements[a] - elements[b]);
    primary = sorted[0];
    if (tiaohou && elements[tiaohou] < 25) primary = tiaohou;
    secondary = sorted.find((key) => key !== primary) || generatorOf(primary);
    const missingAny = missing.find((key) => key !== primary);
    if (missingAny) secondary = missingAny;
    avoid = topElements(elements, ELEMENT_KEYS, 1);
  }

  if (secondary === primary) {
    secondary = ELEMENT_KEYS.find((key) => key !== primary) || null;
  }
  const avoidList = avoid.filter((key) => key && key !== primary);
  if (avoidList.length === 0) avoidList.push(...topElements(elements, ELEMENT_KEYS, 1));

  const stateText = strength.monthState;
  const reason = [
    `日主${dayMaster.stem}${dayMaster.elementZh}，生于${monthBranch}月，月令${stateText}`,
    `判为${strength.label}`,
    `喜${elementZh(primary)}${secondary ? `与${elementZh(secondary)}` : ""}为助`,
    `忌${avoidList.map((key) => elementZh(key)).join("、")}过旺`
  ].join("，") + "。";

  return {
    primary,
    secondary,
    avoid: avoidList,
    tiaohou,
    missing,
    reason
  };
}

/** 一次算齐五行相关的全部派生数据（bazi.js 调用）。 */
export function computeWuxing(pillars) {
  const dayMaster = dayMasterInfo(pillars.day.stem);
  const raw = rawElementScores(pillars);
  const elements = normalizeScores(raw);
  const strength = { ...evaluateStrength(pillars), dayMasterElement: dayMaster.element };
  const favorable = favorableElements(pillars, elements, strength);
  const hidden = {};
  for (const key of PILLAR_KEYS) {
    hidden[key] = pillars[key] ? hiddenStemNames(pillars[key].branch) : [];
  }
  const missing = ELEMENT_KEYS.filter((key) => elements[key] < 8);
  return { dayMaster, hidden, elements, strength, favorable, missing };
}
