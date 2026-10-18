// 珠生 ZHUSHENG — 分享 token
// token = "1." + base64url(compact JSON)，无 padding、URL 安全、目标 < 900 字符。
// 只编码可还原字段（input / options / picks / seed / edited），解码后重算八字、文案与价格。
// 兼容浏览器与 Node：不依赖 Buffer，自带 UTF-8 + base64url 编解码。

import { DESIGN_VERSION, coreState, coreShortId, buildDesignFromState } from "./compose.js";
import { CRYSTAL_BY_ID } from "../data/crystals.js";
import { ROLE_KEYS } from "./compose.js";

export const TOKEN_VERSION = "1";
export const TOKEN_PREFIX = `${TOKEN_VERSION}.`;
export const MAX_TOKEN_LENGTH = 900;

const BASE64URL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const BASE64URL_LOOKUP = (() => {
  const lookup = new Int16Array(128).fill(-1);
  for (let i = 0; i < BASE64URL_ALPHABET.length; i += 1) {
    lookup[BASE64URL_ALPHABET.charCodeAt(i)] = i;
  }
  return lookup;
})();

// ---------------------------------------------------------------- UTF-8
export function utf8Encode(text) {
  const bytes = [];
  for (let i = 0; i < text.length; i += 1) {
    let code = text.codePointAt(i);
    if (code > 0xffff) i += 1;
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    }
  }
  return bytes;
}

export function utf8Decode(bytes) {
  let text = "";
  for (let i = 0; i < bytes.length; i += 1) {
    const byte = bytes[i];
    let code;
    if (byte < 0x80) {
      code = byte;
    } else if (byte < 0xe0) {
      code = ((byte & 0x1f) << 6) | (bytes[i + 1] & 0x3f);
      i += 1;
    } else if (byte < 0xf0) {
      code = ((byte & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f);
      i += 2;
    } else {
      code = ((byte & 0x07) << 18) | ((bytes[i + 1] & 0x3f) << 12) |
        ((bytes[i + 2] & 0x3f) << 6) | (bytes[i + 3] & 0x3f);
      i += 3;
    }
    text += String.fromCodePoint(code);
  }
  return text;
}

// ---------------------------------------------------------------- base64url
export function base64UrlEncode(text) {
  const bytes = utf8Encode(String(text));
  let output = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const byte1 = bytes[i];
    const byte2 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const byte3 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    output += BASE64URL_ALPHABET[byte1 >> 2];
    output += BASE64URL_ALPHABET[((byte1 & 0x03) << 4) | (byte2 >> 4)];
    if (i + 1 < bytes.length) output += BASE64URL_ALPHABET[((byte2 & 0x0f) << 2) | (byte3 >> 6)];
    if (i + 2 < bytes.length) output += BASE64URL_ALPHABET[byte3 & 0x3f];
  }
  return output;
}

export function base64UrlDecode(text) {
  const clean = String(text).replace(/=+$/, "");
  if (/[^A-Za-z0-9_-]/.test(clean)) throw new Error("非法 base64url 字符");
  const bytes = [];
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < clean.length; i += 1) {
    const value = BASE64URL_LOOKUP[clean.charCodeAt(i)];
    if (value < 0) throw new Error("非法 base64url 字符");
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return utf8Decode(bytes);
}

// ---------------------------------------------------------------- token
function encodeState(state) {
  return TOKEN_PREFIX + base64UrlEncode(JSON.stringify(state));
}

/** 校验解码后的紧凑状态，失败返回 null。 */
export function parseToken(token) {
  if (typeof token !== "string") return null;
  if (!token.startsWith(TOKEN_PREFIX)) return null;
  const payload = token.slice(TOKEN_PREFIX.length);
  if (!payload || payload.length > MAX_TOKEN_LENGTH) return null;
  let state;
  try {
    state = JSON.parse(base64UrlDecode(payload));
  } catch {
    return null;
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) return null;
  if (!Array.isArray(state.i) || (state.i.length !== 4 && state.i.length !== 5)) return null;
  if (!Array.isArray(state.o) || state.o.length !== 9) return null;
  if (!Array.isArray(state.p) || state.p.length !== 3) return null;

  const [date, time, gender, wish, rawLocale] = state.i;
  const locale = rawLocale === "en" ? "en" : "zh";
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const year = Number(date.slice(0, 4));
  if (year < 1900 || year > 2100) return null;
  if (time !== null && (typeof time !== "string" || !/^\d{1,2}:\d{2}$/.test(time))) return null;
  if (!["f", "m", "x"].includes(gender)) return null;
  if (!Array.isArray(wish) || wish.some((id) => typeof id !== "string")) return null;

  const [wrist, beadDiameter, metal, charm, layout, spacerInterval,
    specialMain, specialSupport, specialAccent] = state.o;
  if (typeof wrist !== "number" || wrist < 13 || wrist > 21) return null;
  if (![6, 8, 10].includes(beadDiameter)) return null;
  if (!["silver", "gold"].includes(metal)) return null;
  if (typeof charm !== "string") return null;
  if (layout !== null && !["symmetry", "gradient", "interval"].includes(layout)) return null;
  if (spacerInterval !== null && ![0, 4, 5, 6].includes(spacerInterval)) return null;

  const seenIds = new Set();
  const roles = new Set();
  const picks = [];
  for (const entry of state.p) {
    if (!Array.isArray(entry) || entry.length !== 2) return null;
    const [crystalId, role] = entry;
    if (typeof crystalId !== "string" || !CRYSTAL_BY_ID[crystalId]) return null;
    if (!ROLE_KEYS.includes(role) || roles.has(role) || seenIds.has(crystalId)) return null;
    roles.add(role);
    seenIds.add(crystalId);
    picks.push({ crystalId, role });
  }
  if (roles.size !== 3) return null;
  if (typeof state.s !== "number" || !Number.isFinite(state.s) || state.s < 0) return null;
  if (state.e !== 0 && state.e !== 1) return null;
  const budget = state.b === undefined ? "mid" : state.b;
  if (!["low", "mid", "high"].includes(budget)) return null;

  return {
    input: { date, time, gender, wish, locale },
    options: {
      wrist,
      beadDiameter,
      metal,
      charm,
      layout,
      spacerInterval,
      special: {
        main: !!specialMain,
        support: !!specialSupport,
        accent: !!specialAccent
      }
    },
    picks,
    seed: state.s >>> 0,
    edited: !!state.e,
    budget
  };
}

/** 设计 → token。 */
export function encodeDesign(design) {
  if (!design || typeof design !== "object") throw new Error("encodeDesign 需要设计对象");
  const meta = design.meta || {};
  const seed = Number.isFinite(meta.seed) ? meta.seed : 0;
  const options = { ...(design.options || {}) };
  // 由 seed 决定的布局不进 token（解码后按同一 seed 等价重算），保持 meta 标记一致。
  if (!meta.layoutExplicit) options.layout = null;
  if (!meta.spacerExplicit) options.spacerInterval = null;
  const state = coreState({
    input: design.input,
    options,
    picks: design.picks || [],
    seed,
    edited: !!meta.edited,
    budget: meta.budget
  });
  const token = encodeState(state);
  if (token.length > MAX_TOKEN_LENGTH) {
    throw new Error(`token 过长（${token.length} > ${MAX_TOKEN_LENGTH}）`);
  }
  return token;
}

/** token → 完整设计（校验失败返回 null）。 */
export function decodeDesign(token) {
  const state = parseToken(token);
  if (!state) return null;
  try {
    const design = buildDesignFromState(state);
    if (!design || design.version !== DESIGN_VERSION) return null;
    return design;
  } catch {
    return null;
  }
}

/** token → 短编号 ZS-XXXX（与 design.id 一致）。 */
export function designShortId(token) {
  const state = parseToken(token);
  if (!state) return null;
  const compact = coreState({
    input: state.input,
    options: state.options,
    picks: state.picks,
    seed: state.seed,
    edited: state.edited,
    budget: state.budget
  });
  return coreShortId(compact);
}

export { coreState, coreShortId };
