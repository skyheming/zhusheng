// 珠生 ZHUSHENG — 八字引擎
// 东八区、不做真太阳时。立春交节分年、按「节」分月、日柱以 1949-10-01 甲子日为锚、
// 23:00 起算次日（早子时）、时柱五鼠遁。
// 节气用太阳视黄经（VSOP87 截断 + 章动 + 光行差 + ΔT），二分法求 15° 整倍数。
// 纯函数、无 DOM、无 Date.now。

import {
  STEMS,
  BRANCHES,
  STEM_ELEMENTS,
  BRANCH_ELEMENTS,
  ELEMENT_ZH,
  elementZh,
  hiddenStemNames,
  monthVigor,
  computeWuxing
} from "./wuxing.js";

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

// 1949-10-01 = 甲子日（契约锚点）。
const DAY_ANCHOR_YEAR = 1949;
const DAY_ANCHOR_MONTH = 10;
const DAY_ANCHOR_DAY = 1;

export const DAY_ANCHOR = "1949-10-01";

/** 公历日期 → 儒略日数（JDN，整数，正午对齐）。 */
export function gregorianToJDN(year, month, day) {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return day + Math.floor((153 * m + 2) / 5) + 365 * y +
    Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}

/** JDN → 公历日期。 */
export function jdnToGregorian(jdn) {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor(146097 * b / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor(1461 * d / 4);
  const m = Math.floor((5 * e + 2) / 153);
  const day = e - Math.floor((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * Math.floor(m / 10);
  const year = 100 * b + d - 4800 + Math.floor(m / 10);
  return { year, month, day };
}

// ---------------------------------------------------------------- VSOP87 (Earth L)
// Meeus《Astronomical Algorithms》Appendix III 截断表；A 单位 1e-8 rad，t 为儒略千年。
// 每组三个数：A, B, C，项为 A·cos(B + C·t)。
const EARTH_L0 = [
  175347046, 0, 0, 3341656, 4.6692568, 6283.07585, 34894, 4.6261, 12566.1517,
  3497, 2.7441, 5753.3849, 3418, 2.8289, 3.5231, 3136, 3.6277, 77713.7715,
  2676, 4.4181, 7860.4194, 2343, 6.1352, 3930.2097, 1324, 0.7425, 11506.7698,
  1273, 2.0371, 529.691, 1199, 1.1096, 1577.3435, 990, 5.233, 5884.927,
  902, 2.045, 26.298, 857, 3.508, 398.149, 780, 1.179, 5223.694,
  753, 2.533, 5507.553, 505, 4.583, 18849.228, 492, 4.205, 775.523,
  357, 2.92, 0.067, 317, 5.849, 11790.629, 284, 1.899, 796.298,
  271, 0.315, 10977.079, 243, 0.345, 5486.778, 206, 4.806, 2544.314,
  205, 1.869, 5573.143, 202, 2.458, 6069.777, 156, 0.833, 213.299,
  132, 3.411, 2942.463, 126, 1.083, 20.775, 115, 0.645, 0.98,
  103, 0.636, 4694.003, 102, 0.976, 15720.839, 102, 4.267, 7.114,
  99, 6.21, 2146.17, 98, 0.68, 155.42, 86, 5.98, 161000.69,
  85, 1.3, 6275.96, 85, 3.67, 71430.7, 80, 1.81, 17260.15,
  79, 3.04, 12036.46, 75, 1.76, 5088.63, 74, 3.5, 3154.69,
  74, 4.68, 801.82, 70, 0.83, 9437.76, 62, 3.98, 8827.39,
  61, 1.82, 7084.9, 57, 2.78, 6286.6, 56, 4.39, 14143.5,
  56, 3.47, 6279.55, 52, 0.19, 12139.55, 52, 1.33, 1748.02,
  51, 0.28, 5856.48, 49, 0.49, 1194.45, 41, 5.37, 8429.24,
  41, 2.4, 19651.05, 39, 6.17, 10447.39, 37, 6.04, 10213.29,
  37, 2.57, 1059.38, 36, 1.71, 2352.87, 36, 1.78, 6812.77,
  33, 0.59, 17789.85, 30, 0.44, 83996.85, 30, 2.74, 1349.87,
  25, 3.16, 4690.48
];
const EARTH_L1 = [
  628331966747, 0, 0, 206059, 2.678235, 6283.07585, 4303, 2.6351, 12566.1517,
  425, 1.59, 3.523, 119, 5.796, 26.298, 109, 2.966, 1577.344,
  93, 2.59, 18849.23, 72, 1.14, 529.69, 68, 1.87, 398.15,
  67, 4.41, 5507.55, 59, 2.89, 5223.69, 56, 2.17, 155.42,
  45, 0.4, 796.3, 36, 0.47, 775.52, 29, 2.65, 7.11,
  21, 5.34, 0.98, 19, 1.85, 5486.78, 19, 4.97, 213.3,
  17, 2.99, 6275.96, 16, 0.03, 2544.31, 16, 1.43, 2146.17,
  15, 1.21, 10977.08, 12, 2.83, 1748.02, 12, 3.26, 5088.63,
  12, 5.27, 1194.45, 12, 2.08, 4694, 11, 0.77, 553.57,
  10, 1.3, 6286.6, 10, 4.24, 1349.87, 9, 2.7, 242.73,
  9, 5.64, 951.72, 8, 5.3, 2352.87, 6, 2.65, 9437.76,
  6, 4.67, 4690.48
];
const EARTH_L2 = [
  52919, 0, 0, 8720, 1.0721, 6283.0758, 309, 0.867, 12566.152,
  27, 0.05, 3.52, 16, 5.19, 26.3, 16, 3.68, 155.42,
  10, 0.76, 18849.23, 9, 2.06, 77713.77, 7, 0.83, 775.52,
  7, 4.66, 1577.34, 6, 1.03, 7.11, 6, 2.44, 5573.14,
  5, 1.87, 796.3, 5, 4.39, 5507.55, 4, 1.16, 5223.69,
  4, 3.16, 529.69, 3, 1.02, 398.15, 3, 2.62, 553.57,
  3, 4.76, 5856.48, 3, 0.59, 242.73, 3, 2.6, 10977.08,
  2, 1.03, 20.78, 2, 2.11, 11790.63
];
const EARTH_L3 = [
  289, 5.844, 6283.076, 35, 0, 0, 7, 3.14, 12566.15,
  4, 4.0, 3.52, 4, 0.65, 155.42, 3, 1.64, 18849.23,
  3, 0.22, 77713.77
];
const EARTH_L4 = [114, 3.142, 0, 8, 4.13, 6283.08, 1, 3.84, 12566.15];
const EARTH_L5 = [1, 3.14, 0];
const EARTH_SERIES = [EARTH_L0, EARTH_L1, EARTH_L2, EARTH_L3, EARTH_L4, EARTH_L5];

function seriesSum(terms, t) {
  let sum = 0;
  for (let i = 0; i < terms.length; i += 3) {
    sum += terms[i] * Math.cos(terms[i + 1] + terms[i + 2] * t);
  }
  return sum;
}

/**
 * ΔT = TT - UT（秒）。Espenak & Meeus 多项式，覆盖 1900–2150。
 */
export function deltaTSeconds(jdUT) {
  const year = 2000 + (jdUT - 2451545.0) / 365.25;
  let t;
  if (year < 1900) {
    t = (year - 1900) / 100;
    return -2.79 + 149.4119 * t - 598.939 * t * t + 19.7866 * t * t * t;
  }
  if (year < 1920) {
    t = year - 1900;
    return -2.79 + 1.494119 * t - 0.0598939 * t * t + 0.0061966 * t * t * t - 0.000197 * t * t * t * t;
  }
  if (year < 1941) {
    t = year - 1920;
    return 21.2 + 0.84493 * t - 0.0761 * t * t + 0.0020936 * t * t * t;
  }
  if (year < 1961) {
    t = year - 1950;
    return 29.07 + 0.407 * t - (t * t) / 233 + (t * t * t) / 2547;
  }
  if (year < 1986) {
    t = year - 1975;
    return 45.45 + 1.067 * t - (t * t) / 260 - (t * t * t) / 718;
  }
  if (year < 2005) {
    t = year - 2000;
    return 63.86 + 0.3345 * t - 0.060374 * t * t + 0.0017275 * t * t * t +
      0.000651814 * Math.pow(t, 4) + 0.00002373599 * Math.pow(t, 5);
  }
  if (year < 2050) {
    t = year - 2000;
    return 62.92 + 0.32217 * t + 0.005589 * t * t;
  }
  if (year < 2150) {
    return -20 + 32 * Math.pow((year - 1820) / 100, 2) - 0.5628 * (2150 - year);
  }
  return -20 + 32 * Math.pow((year - 1820) / 100, 2);
}

function norm360(value) {
  return ((value % 360) + 360) % 360;
}

/** 太阳视黄经（度，0–360，地心，当日平春分点）。 */
export function sunApparentLongitude(jdUT) {
  const jdTT = jdUT + deltaTSeconds(jdUT) / 86400;
  const T = (jdTT - 2451545.0) / 36525;
  const t = (jdTT - 2451545.0) / 365250;

  let longitude = 0;
  let power = 1;
  for (const series of EARTH_SERIES) {
    longitude += seriesSum(series, t) * power;
    power *= t;
  }
  // 地球日心黄经 → 太阳地心黄经；再叠加章动与光行差。
  const geometric = longitude * 1e-8 * DEG + 180;

  const omega = (125.04452 - 1934.136261 * T + 0.0020708 * T * T - (T * T * T) / 450000) * RAD;
  const ls = (280.4665 + 36000.7698 * T) * RAD;
  const lm = (218.3165 + 481267.8813 * T) * RAD;
  const nutation = (-17.2 * Math.sin(omega) - 1.32 * Math.sin(2 * ls) -
    0.23 * Math.sin(2 * omega) + 0.21 * Math.sin(2 * lm)) / 3600;
  const aberration = -20.4898 / 3600;
  return norm360(geometric + nutation + aberration);
}

// ---------------------------------------------------------------- 节气
// 24 节气：黄经 = 15 × index。
export const SOLAR_TERMS = [
  "春分", "清明", "谷雨", "立夏", "小满", "芒种",
  "夏至", "小暑", "大暑", "立秋", "处暑", "白露",
  "秋分", "寒露", "霜降", "立冬", "小雪", "大雪",
  "冬至", "小寒", "大寒", "立春", "雨水", "惊蛰"
];

// 12 「节」：立春起每 30°，分月依据（非中气）。
export const JIE_TERMS = ["立春", "惊蛰", "清明", "立夏", "芒种", "小暑",
  "立秋", "白露", "寒露", "立冬", "大雪", "小寒"];

function termLongitude(termName) {
  const index = SOLAR_TERMS.indexOf(termName);
  if (index < 0) throw new Error(`未知节气: ${termName}`);
  return index * 15;
}

// 本地（东八区）日期时间 → 儒略日（UT）。
function jdFromLocalParts(year, month, day, hour = 12, minute = 0) {
  const jdn = gregorianToJDN(year, month, day);
  return jdn - 0.5 + (hour * 60 + minute) / 1440 - 8 / 24;
}

function jdToLocalParts(jdUT) {
  const jdLocal = jdUT + 8 / 24;
  let jdn = Math.floor(jdLocal + 0.5);
  const fraction = jdLocal + 0.5 - jdn;
  let totalSeconds = Math.round(fraction * 86400);
  if (totalSeconds >= 86400) {
    totalSeconds -= 86400;
    jdn += 1;
  }
  const { year, month, day } = jdnToGregorian(jdn);
  const hour = Math.floor(totalSeconds / 3600);
  const minute = Math.floor((totalSeconds % 3600) / 60);
  const second = totalSeconds % 60;
  return { year, month, day, hour, minute, second };
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

/** ISO 8601（+08:00）。 */
export function formatLocalISO(parts) {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}T` +
    `${pad2(parts.hour)}:${pad2(parts.minute)}:${pad2(parts.second)}+08:00`;
}

// 在 [lo, hi] 内二分求黄经 = target 的交节时刻（UT 儒略日）。
function solveLongitudeCrossing(target, lo, hi) {
  const f = (jd) => ((sunApparentLongitude(jd) - target + 180) % 360 + 360) % 360 - 180;
  let low = lo;
  let high = hi;
  let fLow = f(low);
  let fHigh = f(high);
  if (fLow > 0 || fHigh < 0) {
    // 放宽窗口兜底（正常不会触发）
    for (let expand = 1; expand <= 8 && (fLow > 0 || fHigh < 0); expand += 1) {
      low = lo - expand * 4;
      high = hi + expand * 4;
      fLow = f(low);
      fHigh = f(high);
    }
  }
  for (let i = 0; i < 72; i += 1) {
    const mid = (low + high) / 2;
    const fMid = f(mid);
    if (fMid < 0) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

// 各节气的大致公历日期（用于定位某年该节气的交节时刻）。
const TERM_GUESS = {
  春分: [3, 20], 清明: [4, 4], 谷雨: [4, 20], 立夏: [5, 5], 小满: [5, 21], 芒种: [6, 5],
  夏至: [6, 21], 小暑: [7, 7], 大暑: [7, 22], 立秋: [8, 7], 处暑: [8, 23], 白露: [9, 7],
  秋分: [9, 23], 寒露: [10, 8], 霜降: [10, 23], 立冬: [11, 7], 小雪: [11, 22], 大雪: [12, 7],
  冬至: [12, 21], 小寒: [1, 5], 大寒: [1, 20], 立春: [2, 4], 雨水: [2, 19], 惊蛰: [3, 5]
};

/** 指定年份某节气的时刻（返回 { at: ISO+08:00, jd: UT 儒略日 }）。 */
export function solarTermMoment(year, termName) {
  const target = termLongitude(termName);
  const [guessMonth, guessDay] = TERM_GUESS[termName];
  const jdGuess = jdFromLocalParts(year, guessMonth, guessDay, 12);
  const jd = solveLongitudeCrossing(target, jdGuess - 8, jdGuess + 8);
  return { at: formatLocalISO(jdToLocalParts(jd)), jd };
}

/** 便捷导出：节气时刻 ISO 字符串。 */
export function solarTermTime(year, termName) {
  return solarTermMoment(year, termName).at;
}

function findTermCrossingNear(jd, target, direction) {
  if (direction < 0) {
    return solveLongitudeCrossing(target, jd - 16, jd + 0.1);
  }
  return solveLongitudeCrossing(target, jd - 0.1, jd + 16);
}

// ---------------------------------------------------------------- 输入解析
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{1,2}):(\d{2})$/;

function parseDate(date) {
  const match = DATE_RE.exec(String(date || ""));
  if (!match) throw invalidInput("日期格式应为 YYYY-MM-DD");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < MIN_YEAR || year > MAX_YEAR) {
    throw invalidInput(`仅支持 ${MIN_YEAR}–${MAX_YEAR} 年`);
  }
  if (month < 1 || month > 12) throw invalidInput("月份不合法");
  const jdn = gregorianToJDN(year, month, day);
  const back = jdnToGregorian(jdn);
  if (back.year !== year || back.month !== month || back.day !== day) {
    throw invalidInput("日期不存在");
  }
  return { year, month, day, jdn };
}

function parseTime(time) {
  if (time === null || time === undefined || time === "") return null;
  const match = TIME_RE.exec(String(time));
  if (!match) throw invalidInput("时间格式应为 HH:MM");
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) throw invalidInput("时间不合法");
  return { hour, minute };
}

function invalidInput(message) {
  const error = new Error(message);
  error.code = "INVALID_INPUT";
  return error;
}

function mod(value, base) {
  return ((value % base) + base) % base;
}

function pillar(stemIdx, branchIdx) {
  return {
    stem: STEMS[stemIdx],
    branch: BRANCHES[branchIdx],
    stemIdx,
    branchIdx
  };
}

const ELEMENT_IMAGE = {
  wood: "曲直",
  fire: "炎上",
  earth: "稼穑",
  metal: "从革",
  water: "润下"
};

const MONTH_STATE_TEXT = {
  旺: "当令而旺",
  相: "得令相生",
  休: "泄气而休",
  囚: "受制而囚",
  死: "克身而死"
};

/**
 * 计算八字与五行。
 * @param {{date:string,time?:string|null,gender?:"f"|"m"|"x",tz?:string}} input
 */
export function computeBazi(input = {}) {
  const parsedDate = parseDate(input.date);
  const parsedTime = parseTime(input.time);
  const gender = input.gender || "x";
  if (!["f", "m", "x"].includes(gender)) throw invalidInput("性别取值应为 f / m / x");

  const { year, month, day, jdn } = parsedDate;
  const hour = parsedTime ? parsedTime.hour : null;
  const minute = parsedTime ? parsedTime.minute : 0;
  // 未提供时间时，以正午作为节气/月令判定的中性时刻（节气日边界会有歧义）。
  const jdMoment = jdFromLocalParts(year, month, day, hour === null ? 12 : hour, minute);

  // ---- 年柱：以立春交节时刻分年
  const lichun = solarTermMoment(year, "立春");
  const baziYear = jdMoment < lichun.jd ? year - 1 : year;
  const yearStemIdx = mod(baziYear - 4, 10);
  const yearBranchIdx = mod(baziYear - 4, 12);
  const yearPillar = pillar(yearStemIdx, yearBranchIdx);

  // ---- 月柱：按「节」分月（立春为寅月起点，每 30° 一个月）
  const lambda = sunApparentLongitude(jdMoment);
  const monthOrdinal = Math.floor(norm360(lambda - 315) / 30); // 0 = 寅
  const monthBranchIdx = (2 + monthOrdinal) % 12;
  const monthStemIdx = mod(yearStemIdx * 2 + 2 + monthOrdinal, 10);
  const monthPillar = pillar(monthStemIdx, monthBranchIdx);

  // ---- 日柱：1949-10-01 甲子，JDN 连续；23:00 起算次日（早子时）
  const anchorJdn = gregorianToJDN(DAY_ANCHOR_YEAR, DAY_ANCHOR_MONTH, DAY_ANCHOR_DAY);
  let dayCycle = mod(jdn - anchorJdn, 60);
  if (hour !== null && hour >= 23) dayCycle = mod(dayCycle + 1, 60);
  const dayPillar = pillar(dayCycle % 10, dayCycle % 12);

  // ---- 时柱：五鼠遁
  let hourPillar = null;
  if (hour !== null) {
    const hourBranchIdx = Math.floor(((hour + 1) % 24) / 2);
    const hourStemIdx = mod(dayPillar.stemIdx * 2 + hourBranchIdx, 10);
    hourPillar = pillar(hourStemIdx, hourBranchIdx);
  }

  const pillars = { year: yearPillar, month: monthPillar, day: dayPillar, hour: hourPillar };

  // ---- 五行与喜用
  const wuxing = computeWuxing(pillars);
  const dayMasterElement = STEM_ELEMENTS[dayPillar.stemIdx];
  const vigor = monthVigor(monthPillar.branch, dayMasterElement);

  // ---- 前后节气
  const currentLambda = lambda;
  const prevIndex = Math.floor(norm360(currentLambda) / 15);
  const nextIndex = (prevIndex + 1) % 24;
  const prevName = SOLAR_TERMS[prevIndex];
  const nextName = SOLAR_TERMS[nextIndex];
  const prevJd = findTermCrossingNear(jdMoment, prevIndex * 15, -1);
  const nextJd = findTermCrossingNear(jdMoment, nextIndex * 15, 1);

  const jieqi = {
    prev: prevName,
    prevAt: formatLocalISO(jdToLocalParts(prevJd)),
    next: nextName,
    nextAt: formatLocalISO(jdToLocalParts(nextJd)),
    longitude: Math.round(norm360(currentLambda) * 100) / 100
  };

  const summary = buildSummary(wuxing, monthPillar.branch, vigor);

  return {
    input: { date: input.date, time: parsedTime ? input.time : null, gender },
    pillars,
    dayMaster: {
      stem: wuxing.dayMaster.stem,
      element: wuxing.dayMaster.element,
      elementZh: ELEMENT_ZH[wuxing.dayMaster.element],
      polarity: wuxing.dayMaster.polarity
    },
    hidden: wuxing.hidden,
    elements: wuxing.elements,
    strength: wuxing.strength,
    favorable: wuxing.favorable,
    missing: wuxing.missing,
    jieqi,
    summary
  };
}

function buildSummary(wuxing, monthBranch, vigor) {
  const dm = wuxing.dayMaster;
  const strength = wuxing.strength;
  const favorable = wuxing.favorable;
  const title = `${dm.stem}${ELEMENT_ZH[dm.element]} · ${ELEMENT_IMAGE[dm.element]}`;
  const monthState = MONTH_STATE_TEXT[vigor.state] || vigor.state;
  const supportText = favorable.primary
    ? `宜以${elementZh(favorable.primary)}${favorable.secondary ? `、${elementZh(favorable.secondary)}` : ""}为助，忌${favorable.avoid.map((key) => elementZh(key)).join("、")}再盛。`
    : "";
  const tiaohouText = favorable.tiaohou
    ? `生于${monthBranch}月，${favorable.tiaohou === "water" ? "燥气偏重，调候用水" : "寒气偏重，调候用火"}。`
    : "";
  const body = `日主${dm.stem}${ELEMENT_ZH[dm.element]}，生于${monthBranch}月，${monthState}，判为${strength.label}。${supportText}${tiaohouText}`;
  return { title, body };
}

export { RAD, DEG };
