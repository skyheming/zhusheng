// 珠生 ZHUSHENG — 中文文案模板
// 语气：东方编辑感、具体、有画面；不夸大功效，不做医疗宣称。
// 纯函数：输入命理/珠子数据，输出可直接渲染的字符串。

import { ELEMENT_ZH, ZH_ELEMENT, elementZh } from "./wuxing.js";

export const WISH_ZH = {
  love: "爱情",
  career: "事业",
  wealth: "财富",
  health: "健康",
  family: "家庭",
  emotion: "情绪平衡"
};

export const ROLE_ZH = { main: "主珠", support: "辅珠", accent: "点缀" };

// 色系 → 手串名里的「颜色意象」（东方传统色名）。
const COLOR_MOOD = {
  白: "月白", 银: "霜银", 紫: "藕荷", 粉: "藕粉", 红: "朱砂", 橙: "琥珀",
  黄: "藤黄", 绿: "松绿", 青: "天青", 蓝: "黛蓝", 黑: "墨曜", 金: "鎏金", 彩: "霓彩"
};

// 五行 → 取用动词
const USE_VERB_STRONG = {
  wood: "泄其秀",
  fire: "发其明",
  earth: "厚其载",
  metal: "收其锋",
  water: "润其燥"
};
const USE_VERB_WEAK = {
  wood: "扶其根",
  fire: "暖其气",
  earth: "培其基",
  metal: "固其骨",
  water: "养其源"
};

const WISH_REASON = {
  love: "与「爱情」的心愿相应，寓意亲近与温柔",
  career: "与「事业」的心愿相应，寓意专注与向上",
  wealth: "与「财富」的心愿相应，寓意丰盛与积累",
  health: "与「健康」的心愿相应，寓意身体与心气都安稳",
  family: "与「家庭」的心愿相应，寓意守护与团圆",
  emotion: "与「情绪平衡」的心愿相应，寓意安顿与松弛"
};

const POLARITY_TEXT = { yang: "阳", yin: "阴" };

function wishText(wishIds) {
  const list = (wishIds || []).map((id) => WISH_ZH[id]).filter(Boolean);
  if (!list.length) return "";
  return list.join("、");
}

/** 手串名：日主 + 颜色意象，如「庚金 · 月白」。 */
export function themeName(bazi, picks) {
  const dm = bazi.dayMaster;
  const main = picks && picks[0];
  const color = main && main.colorFamily ? main.colorFamily : "白";
  const mood = COLOR_MOOD[color] || "月白";
  return `${dm.stem}${ELEMENT_ZH[dm.element]} · ${mood}`;
}

/** 一句话设计理念。 */
export function tagline(bazi, picks, input = {}) {
  const dm = bazi.dayMaster;
  const favorable = bazi.favorable;
  const strength = bazi.strength.label;
  const main = picks && picks[0];
  const wish = wishText(input.wish);

  if (strength === "身弱" || strength === "偏弱") {
    return `${dm.stem}${ELEMENT_ZH[dm.element]}略薄，正好用一点${elementZh(favorable.primary)}${favorable.secondary ? `与${elementZh(favorable.secondary)}` : ""}把底气养回来。`;
  }
  if (strength === "身强" || strength === "偏强") {
    return `${dm.stem}${ELEMENT_ZH[dm.element]}气偏盛，让${elementZh(favorable.primary)}把用不完的力气引出去。`;
  }
  if (wish) {
    return `不急不缓的一串，替你收着「${wish}」这件事。`;
  }
  if (main) {
    return `${main.zh}定调，配${picks[1] ? picks[1].zh : "两味辅色"}，是一串安静的平衡。`;
  }
  return `${dm.stem}${ELEMENT_ZH[dm.element]}居中调和，取一串恰好的平衡。`;
}

/** 八字解读正文（2–3 句，具体、克制）。 */
export function reading(bazi, input = {}) {
  const dm = bazi.dayMaster;
  const favorable = bazi.favorable;
  const strength = bazi.strength;
  const monthBranch = bazi.pillars.month.branch;
  const vigor = strength.monthState || "";
  const wish = wishText(input.wish);
  const missing = (bazi.missing || []).map((key) => ELEMENT_ZH[key]).join("、");

  const lines = [];
  lines.push(`你的日主是${POLARITY_TEXT[dm.polarity]}${dm.stem}${ELEMENT_ZH[dm.element]}，生于${monthBranch}月，月令${vigor}，整体判为${strength.label}。`);

  const primary = elementZh(favorable.primary);
  const secondary = favorable.secondary ? elementZh(favorable.secondary) : "";
  const avoid = (favorable.avoid || []).map((key) => ELEMENT_ZH[key]).join("、");
  let use = `用神取${primary}${secondary ? `，次取${secondary}` : ""}`;
  if (avoid) use += `，${avoid}气已足，不必再添`;
  lines.push(`${use}。`);

  if (missing) {
    lines.push(`八字里${missing}最单薄——缺的那一角，往往也是人最想补的地方。`);
  }
  if (favorable.tiaohou) {
    lines.push(favorable.tiaohou === "water" ? "夏月出生，燥气偏重，用水调候会舒服一些。" : "冬月出生，寒气偏重，用火暖一暖更松快。");
  }
  if (wish) {
    lines.push(`这次你选了「${wish}」作心愿，选珠会在这个方向上再偏一点。`);
  }
  lines.push("这些是传统命理与民俗里的说法，当作一次自我关照的仪式就好。");
  return lines.join("");
}

/** 设计结构描述（版式/颜色/隔珠）。 */
export function designStory(bazi, picks, composition = {}) {
  const main = picks[0];
  const support = picks[1];
  const accent = picks[2];
  const style = composition.layoutStyle || "symmetry";
  const layoutText = {
    symmetry: "主珠居上弧、两侧对称收束，像一枚端端正正的印",
    gradient: "从主珠到点缀由暖入冷，颜色一路渐变过去",
    interval: "主珠与点缀一段一段交替，节奏清楚"
  }[style] || "三段珠子顺势排开";

  const parts = [];
  parts.push(`${main.zh}作主珠，${layoutText}。`);
  if (support) {
    parts.push(`${support.zh}在旁承接，${support.colorFamily}色与主珠形成冷暖对照。`);
  }
  if (accent) {
    parts.push(`${accent.zh}只在点缀处出现，收住整串的光。`);
  }
  if (composition.metal) {
    parts.push(`${composition.metal === "gold" ? "古金" : "银"}隔珠每隔几颗落下，让每一段都有呼吸。`);
  }
  parts.push("天然晶石的颜色与纹理不会完全一致，这串只属于你。");
  return parts.join("");
}

/**
 * 单颗珠子的推荐理由（2–3 句）。
 * @param {object} crystal
 * @param {object} bazi
 * @param {"main"|"support"|"accent"} role
 * @param {{wish?:string[], gender?:string}} ctx
 */
export function pickReasons(crystal, bazi, role, ctx = {}) {
  const favorable = bazi.favorable;
  const rawElements = crystal.elements && crystal.elements.length ? crystal.elements : [crystal.element];
  const elements = rawElements.map((value) => ZH_ELEMENT[value] || value);
  const primary = favorable.primary;
  const secondary = favorable.secondary;
  const reasons = [];

  if (elements.includes(primary)) {
    reasons.push(`${crystal.zh}五行属${rawElements.join("、")}，正对你的用神${elementZh(primary)}。`);
  } else if (secondary && elements.includes(secondary)) {
    reasons.push(`${crystal.zh}五行属${rawElements.join("、")}，呼应次喜${elementZh(secondary)}，让用神更稳。`);
  } else {
    reasons.push(`${crystal.zh}五行属${rawElements.join("、")}，用来补足整串的层次。`);
  }

  const wishHits = (ctx.wish || []).filter((id) => crystal.wishTags.includes(id));
  if (wishHits.length) {
    reasons.push(WISH_REASON[wishHits[0]] + "。");
  } else if (crystal.effectText) {
    reasons.push(`传统上取它「${crystal.effectText.split("、").slice(0, 2).join("、")}」的寓意。`);
  }

  if (role === "main") {
    reasons.push(`作为主珠，${crystal.colorFamily}色负责整串的定调，${crystal.texture === "none" ? "通透的珠体" : "内部的纹理"}最耐看。`);
  } else if (role === "support") {
    reasons.push(`作为辅珠，${crystal.zh}承上启下，与主珠的冷暖对比让整串不单调。`);
  } else {
    reasons.push(`作为点缀，${crystal.zh}只占少数几颗，却把层次提亮了。`);
  }
  return reasons;
}

/** 选珠叙事：headline + paragraph。 */
export function narrative(bazi, picks) {
  const dm = bazi.dayMaster;
  const favorable = bazi.favorable;
  const strength = bazi.strength;
  const weak = strength.score < 43;
  const verb = (weak ? USE_VERB_WEAK : USE_VERB_STRONG)[favorable.primary] || "为助";
  const headline = `${ELEMENT_ZH[dm.element]}${weak ? "弱" : "旺"}，以${elementZh(favorable.primary)}${verb.replace("其", "")}`;

  const roleText = ["主", "辅", "点"].map((label, index) => {
    const pick = picks[index];
    return pick ? `${label}·${pick.zh}` : null;
  }).filter(Boolean).join("，");

  const paragraph = [
    `${strength.label}之局，${favorable.primary ? `取${elementZh(favorable.primary)}为用` : ""}${favorable.secondary ? `、${elementZh(favorable.secondary)}为助` : ""}。`,
    `三颗珠子按${roleText}分工：${picks[0] ? picks[0].zh : ""}镇住主位，${picks[1] ? picks[1].zh : "辅珠"}补足色温，${picks[2] ? picks[2].zh : "点缀"}收尾。`,
    "不是许愿，是把想要的状态先戴在手上。"
  ].join("");
  return { headline, paragraph };
}

/** 三颗珠子的简写（订单/摘要用）。 */
export function picksSummary(picks) {
  return (picks || []).map((pick) => pick.zh).join(" · ");
}
