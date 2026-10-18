/**
 * ZHUSHENG / 珠生 — hand-written SVG bracelet renderer.
 *
 *   import { renderBracelet } from './render/bracelet.js';
 *   const bz = renderBracelet({
 *     container, design, view: 'circle', interactive: true,
 *     onBeadHover(info | null), onBeadClick(info),
 *   });
 *   bz.update(design); bz.setView('flat'); bz.destroy();
 *
 * Contract (docs/architecture.md §7):
 *   - pure SVG, viewBox 0 0 640 640, zero dependencies, no <image>/external refs
 *   - views: circle (frontal ring with depth), flat (beads laid in a row), wrist
 *   - every gradient/filter/symbol id is namespaced with a unique instance prefix
 *   - each bead: radial sphere gradient + top gloss + bottom inner shadow + rim +
 *     texture layer driven by the layout item's hex / hex2 / hex3 / texture
 *   - metal spacers, a silver charm (lotus / peace / pixiu), cord, paper tray
 *   - hover highlight + callbacks, click callbacks, keyboard focus + Enter
 *   - node budget < 400
 *
 * The `design` object is whatever src/core/compose.js produced; only
 * composition.layout is required (it already embeds hex/hex2/hex3/texture).
 * A reasonable fallback layout is generated when it is missing.
 */

import { beadMarkup, spacerMarkup, beadTransform } from './bead-markup.js';
import { buildBeadMaterialDefs, spacerMaterialDefs, spriteOverlayDefs } from './bead-materials.js';

const TAU = Math.PI * 2;
const DEG = 180 / Math.PI;
const VB = 640;

/* circle-view ring geometry (viewBox units) */
const RING = { cx: 320, cy: 312, rx: 221, ry: 150 };


/* the "unit bead" radius the charm art is drawn for */
const CHARM_UNIT_R = 17.5;

let INSTANCE_SEQ = 0;

/* =========================================================================
 * colour helpers
 * ========================================================================= */

const HEX_RE = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function rgbOf(value) {
  const m = HEX_RE.exec(String(value == null ? '' : value));
  if (!m) return [205, 194, 178];
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function hexOf(r, g, b) {
  const c = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function mix(a, b, t) {
  const A = rgbOf(a);
  const B = rgbOf(b);
  return hexOf(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}

const lighten = (c, t) => mix(c, '#ffffff', t);
const darken = (c, t) => mix(c, '#000000', t);

function alpha(c, a) {
  const [r, g, b] = rgbOf(c);
  return `rgba(${r},${g},${b},${a})`;
}

function safeHex(value, fallback) {
  return HEX_RE.test(String(value == null ? '' : value)) ? (String(value).startsWith('#') ? String(value) : `#${value}`) : fallback;
}

const f = (n) => String(Math.round(n * 1000) / 1000);

function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/* =========================================================================
 * defs helpers
 * ========================================================================= */

function stops(list) {
  return list
    .map(([offset, color, opacity]) => `<stop offset="${offset}" stop-color="${color}"${opacity == null ? '' : ` stop-opacity="${opacity}"`}/>`)
    .join('');
}

function radialGrad(id, attrs, list) {
  return `<radialGradient id="${id}" ${attrs}>${stops(list)}</radialGradient>`;
}

function linearGrad(id, attrs, list) {
  return `<linearGradient id="${id}" ${attrs}>${stops(list)}</linearGradient>`;
}

function blurFilter(id, sd) {
  return `<filter id="${id}" x="-80%" y="-80%" width="260%" height="260%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${sd}"/></filter>`;
}

/* =========================================================================
 * design normalisation
 * ========================================================================= */

const CHARM_ZH = { lotus: '莲蓬', peace: '平安扣', pixiu: '貔貅', none: '无' };
const METAL_ZH = { silver: '银', gold: '古金' };

function charmZh(id) {
  return CHARM_ZH[id] || '挂坠';
}

function normItem(raw, index, comp) {
  const kind = raw.kind === 'spacer' ? 'spacer' : raw.kind === 'charm' ? 'charm' : 'bead';
  const pos = Number.isFinite(Number(raw.pos)) ? Number(raw.pos) : index;
  if (kind === 'spacer') {
    const metal = raw.metal === 'gold' ? 'gold' : raw.metal === 'silver' ? 'silver' : comp.metal === 'gold' ? 'gold' : 'silver';
    return { kind, metal, size: num(raw.size, 6), pos, zh: raw.zh || `${METAL_ZH[metal]}隔珠` };
  }
  if (kind === 'charm') {
    const charmId = raw.charmId || (comp.charm && comp.charm.id) || 'lotus';
    return { kind, charmId, pos, size: num(raw.size, 8), zh: raw.zh || charmZh(charmId) };
  }
  const hex = safeHex(raw.hex, '#D8CDBE');
  const hex2 = safeHex(raw.hex2, lighten(hex, 0.34));
  const hex3 = safeHex(raw.hex3, darken(hex, 0.28));
  const texture = ['vein', 'phantom', 'rutilated', 'catseye', 'iridescent', 'inclusion'].includes(raw.texture) ? raw.texture : 'none';
  return {
    kind,
    crystalId: raw.crystalId || '',
    zh: raw.zh || '晶石',
    en: raw.en || '',
    element: raw.element || '',
    role: raw.role || '',
    size: num(raw.size, 8),
    pos,
    hex,
    hex2,
    hex3,
    texture,
  };
}

function fallbackLayout(design, comp) {
  const picks = Array.isArray(design.picks) ? design.picks : [];
  const sources = picks.length
    ? picks
    : [{ crystalId: 'moonstone', zh: '月光石', en: 'Moonstone', hex: '#E8E4D8', hex2: '#FBF9F1', hex3: '#C9C3B4', texture: 'iridescent', element: '水' }];
  const count = Math.max(14, Math.min(30, Math.round(num(comp.beadCount, 20))));
  const layout = [];
  for (let i = 0; i < count; i += 1) {
    const pick = sources[i % sources.length];
    const isSpacer = i > 0 && i % 5 === 0;
    if (isSpacer) {
      layout.push({ kind: 'spacer', metal: comp.metal === 'gold' ? 'gold' : 'silver', size: 6, pos: layout.length });
      continue;
    }
    layout.push({
      kind: 'bead',
      crystalId: pick.crystalId || '',
      zh: pick.zh || '晶石',
      en: pick.en || '',
      element: pick.element || '',
      role: pick.role || 'main',
      size: 8,
      pos: layout.length,
      hex: pick.hex || '#D8CDBE',
      hex2: pick.hex2 || lighten(pick.hex || '#D8CDBE', 0.34),
      hex3: pick.hex3 || darken(pick.hex || '#D8CDBE', 0.28),
      texture: pick.texture || 'none',
    });
  }
  layout.push({ kind: 'charm', charmId: (comp.charm && comp.charm.id) || 'lotus', pos: layout.length });
  return layout;
}

function normalizeDesign(design) {
  const source = design && typeof design === 'object' ? design : {};
  const comp = source.composition && typeof source.composition === 'object' ? source.composition : {};
  let layout = Array.isArray(comp.layout) && comp.layout.length ? comp.layout.filter(Boolean).map((it, i) => normItem(it, i, comp)) : [];
  if (!layout.length) layout = fallbackLayout(source, comp);
  layout.forEach((it, i) => {
    it._i = i;
  });
  const metal = layout.some((it) => it.kind === 'spacer' && it.metal === 'gold') || comp.metal === 'gold' ? 'gold' : 'silver';
  return { design: source, comp, layout, metal };
}

/* =========================================================================
 * palettes & textures
 * ========================================================================= */

function textureColor(item) {
  switch (item.texture) {
    case 'vein':
      return mix(item.hex2, item.hex3, 0.55);
    case 'phantom':
      return mix(item.hex2, item.hex3, 0.3);
    case 'rutilated':
      return mix(item.hex, '#E7C68C', 0.55);
    case 'catseye':
      return lighten(item.hex2, 0.45);
    case 'iridescent':
      return lighten(item.hex2, 0.18);
    case 'inclusion':
      return darken(item.hex3, 0.18);
    default:
      return lighten(item.hex2, 0.18);
  }
}

function buildPalettes(layout) {
  const list = [];
  const byKey = new Map();
  for (const item of layout) {
    if (item.kind !== 'bead') continue;
    const key = `${item.hex}|${item.hex2}|${item.hex3}|${item.texture}`;
    if (!byKey.has(key)) {
      const pal = { id: list.length, hex: item.hex, hex2: item.hex2, hex3: item.hex3, texture: item.texture };
      byKey.set(key, pal);
      list.push(pal);
    }
    item._pal = byKey.get(key).id;
    item._palette = byKey.get(key);
    item._texColor = textureColor(item);
  }
  return list;
}

const METALS = {
  silver: { light: '#FFFFFF', soft: '#F3F5F5', mid: '#C7CBCD', dark: '#9AA0A3', deep: '#70767A' },
  gold: { light: '#FFF7E4', soft: '#F2E4C2', mid: '#CFB482', dark: '#A9864B', deep: '#7D6136' },
};

function metalDefs(p, metalKey) {
  const m = METALS[metalKey] || METALS.silver;
  return [
    radialGrad(
      `${p}mb-${metalKey}`,
      'cx="32%" cy="24%" r="80%"',
      [
        ['0', m.light],
        ['0.18', m.soft],
        ['0.42', m.mid],
        ['0.7', m.dark],
        ['0.9', m.deep],
        ['1', darken(m.deep, 0.16)],
      ],
    ),
    radialGrad(
      `${p}mg-${metalKey}`,
      'cx="50%" cy="50%" r="50%"',
      [
        ['0', '#ffffff', 0.95],
        ['0.5', '#ffffff', 0.35],
        ['1', '#ffffff', 0],
      ],
    ),
    linearGrad(
      `${p}mr-${metalKey}`,
      'x1="0" y1="0" x2="0.8" y2="1"',
      [
        ['0', m.light, 0.95],
        ['0.4', m.mid, 0.25],
        ['1', m.deep, 0.9],
      ],
    ),
  ].join('');
}

function beadHash(index, salt = 0) {
  const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

/* =========================================================================
 * charms — simplified silver amulets (paths + gradients, no cartoon)
 * ========================================================================= */

function charmShadow(p) {
  return `<ellipse cx="2" cy="45" rx="15" ry="4.2" fill="rgba(70,52,32,.22)" filter="url(#${p}blurMd)"/>`;
}

function lotusArt(p, m) {
  const body = `url(#${p}mb-${m})`;
  const rim = `url(#${p}mr-${m})`;
  const deep = METALS[m].deep;
  const seed = alpha(darken(deep, 0.2), 0.4);
  return `${charmShadow(p)}
  <circle cx="0" cy="4.4" r="3.1" fill="none" stroke="${rim}" stroke-width="1.5"/>
  <path d="M0 7.4 C 1.6 8.8, -1 10.5, 0 12.2" stroke="${rim}" stroke-width="1.4" fill="none" stroke-linecap="round"/>
  <g fill="${alpha(deep, 0.72)}" transform="translate(0 12) scale(0.7)" opacity=".9">
    <path d="M-3.4 30.4 C -10 31.4, -16.6 34.2, -19.4 38.4 C -14 39.2, -7.4 36, -3 33.4 Z"/>
    <path d="M3.4 30.4 C 10 31.4, 16.6 34.2, 19.4 38.4 C 14 39.2, 7.4 36, 3 33.4 Z"/>
    <path d="M0 31.6 C -3.2 35.4, -4.4 40.2, -2.6 43.8 C 0 41.4, 1.2 37, 1 33 Z"/>
  </g>
  <path d="M-17.4 22.4 C -17.4 14.8, -10.2 10.6, 0 10.6 C 10.2 10.6, 17.4 14.8, 17.4 22.4 C 17.4 30, 10.6 34.6, 0 34.6 C -10.6 34.6, -17.4 30, -17.4 22.4 Z" fill="${body}" stroke="${rim}" stroke-width="0.55"/>
  <g fill="${seed}">
    <circle cx="-6.2" cy="18.8" r="1.72"/><circle cx="0" cy="17.9" r="1.72"/><circle cx="6.2" cy="18.8" r="1.72"/>
    <circle cx="-3.2" cy="23.4" r="1.64"/><circle cx="3.2" cy="23.4" r="1.64"/>
  </g>
  <g fill="rgba(255,255,255,.5)">
    <circle cx="-6.8" cy="18.2" r="0.5"/><circle cx="-0.6" cy="17.3" r="0.5"/><circle cx="5.6" cy="18.2" r="0.5"/>
    <circle cx="-3.8" cy="22.9" r="0.45"/><circle cx="2.6" cy="22.9" r="0.45"/>
  </g>
  <path d="M-15.6 16.4 C -13.8 12, -8 10.8, -1 10.7" stroke="rgba(255,255,255,.8)" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  <path d="M-13.2 11.9 C -8.4 10.4, -2.4 10.4, 1.8 11" stroke="rgba(255,255,255,.34)" stroke-width="0.8" fill="none" stroke-linecap="round"/>
  <ellipse cx="-8.4" cy="13.6" rx="2.6" ry="0.9" fill="rgba(255,255,255,.5)" transform="rotate(-28 -8.4 13.6)"/>`;
}

function peaceArt(p, m) {
  const body = `url(#${p}mb-${m})`;
  const rim = `url(#${p}mr-${m})`;
  const deep = METALS[m].deep;
  return `${charmShadow(p)}
  <circle cx="0" cy="4" r="3.6" fill="none" stroke="${rim}" stroke-width="1.7"/>
  <path d="M0 8.4 L0 13" stroke="${rim}" stroke-width="1.6" stroke-linecap="round"/>
  <path fill-rule="evenodd" d="M0 -3 A17.5 17.5 0 1 1 0 32 A17.5 17.5 0 1 1 0 -3 Z M0 4 A10.5 10.5 0 1 0 0 25 A10.5 10.5 0 1 0 0 4 Z" fill="${body}" stroke="${rim}" stroke-width="0.7"/>
  <path d="M-15 -1 C -9.4 -7.4, -1 -7.4, 5 -2.4" stroke="rgba(255,255,255,.62)" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  <path d="M-11.6 28.6 C -5 34.2, 6 33.6, 12.4 27.4" stroke="${alpha(deep, 0.4)}" stroke-width="1" fill="none"/>
  <path d="M-8.4 6.4 A10.8 10.8 0 0 0 -8.4 22.8" stroke="${alpha(deep, 0.3)}" stroke-width="1" fill="none"/>
  <path d="M8.6 9.2 A10.4 10.4 0 0 1 8.6 20.4" stroke="rgba(255,255,255,.4)" stroke-width="1" fill="none"/>
  <ellipse cx="-6.6" cy="2.6" rx="3.4" ry="1.5" fill="rgba(255,255,255,.5)" transform="rotate(-24 -6.6 2.6)"/>`;
}

function pixiuArt(p, m) {
  const body = `url(#${p}mb-${m})`;
  const rim = `url(#${p}mr-${m})`;
  const deep = METALS[m].deep;
  const ink = alpha(darken(deep, 0.25), 0.55);
  const inkLight = 'rgba(255,255,255,.55)';
  return `${charmShadow(p)}
  <circle cx="0" cy="4" r="3.6" fill="none" stroke="${rim}" stroke-width="1.7"/>
  <path d="M0 8.4 L0 11.6" stroke="${rim}" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M-19 8 C -19.6 -5.4, -10.6 -15.4, 0 -15.4 C 10.6 -15.4, 19.6 -5.4, 19 8 C 18.4 21.4, 10.2 31.4, 0 31.4 C -10.2 31.4, -18.4 21.4, -19 8 Z" fill="${body}" stroke="${rim}" stroke-width="0.8"/>
  <path d="M-16.2 6.6 C -16.6 -4, -9 -13, 0 -13 C 9 -13, 16.6 -4, 16.2 6.6" stroke="rgba(255,255,255,.55)" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  <g fill="${ink}" stroke="${ink}" stroke-width="0.7" stroke-linejoin="round">
    <path d="M-10.6 10.2 C -11.4 4.4, -7.4 0.2, -2.6 0.4 C 0.2 -2, 5.2 -1.4, 7.6 1.6 C 11.2 3, 12.6 7.6, 10 10.6 C 8 13, 4.6 12.4, 2.4 10.8 C 1 12.2, -1 12.4, -2.4 10.8 C -5.4 12.6, -9.8 12.8, -10.6 10.2 Z" fill="${alpha(deep, 0.28)}"/>
    <path d="M8.4 3.4 C 11 0.6, 14.2 0.2, 16.4 2.2" fill="none"/>
    <path d="M-2.6 0.4 C -4.8 -3.4, -9.4 -5, -12.6 -3" fill="none"/>
    <path d="M2.6 6.4 C 3.6 8, 3.2 10, 1.6 10.8" fill="none"/>
  </g>
  <circle cx="1.4" cy="5.2" r="1.15" fill="${alpha(deep, 0.75)}"/>
  <path d="M-13.6 18.6 C -10.4 16.4, -7.8 17.2, -6.6 19.6 C -5.2 22.4, -7.6 24.4, -10.4 23.6" stroke="${ink}" stroke-width="1.1" fill="none" stroke-linecap="round"/>
  <path d="M-16.6 4.6 C -14.4 1.4, -12.4 0.2, -10.4 0.4" stroke="${inkLight}" stroke-width="0.9" fill="none" stroke-linecap="round"/>
  <path d="M-15.6 24.4 C -9.4 29.4, 9.4 29.4, 15.6 24.4" stroke="rgba(255,255,255,.35)" stroke-width="1" fill="none"/>`;
}

function charmArt(p, m, charmId) {
  if (charmId === 'peace') return peaceArt(p, m);
  if (charmId === 'pixiu') return pixiuArt(p, m);
  if (charmId === 'none') return '';
  return lotusArt(p, m);
}

function charmMarkup(inst, item, x, y, scale) {
  const { p } = inst;
  const m = inst.metal;
  const label = `${item.zh}挂坠`;
  return `<g class="bz-charm bz-hit" data-kind="charm" data-i="${item._i}"${inst.interactive ? ' tabindex="0" role="button"' : ''} aria-label="${esc(label)}" transform="translate(${f(x)} ${f(y)}) scale(${f(scale * 0.66)})" style="--bz-i:${item._i}">
    <g class="bz-charm-art">${charmArt(p, m, item.charmId)}</g>
  </g>`;
}

/* =========================================================================
 * paper backdrop
 * ========================================================================= */

function paperScene(p, withPlate) {
  const plate = withPlate ? `<circle cx="320" cy="308" r="304" fill="url(#${p}plate)"/>` : '';
  return `<g class="bz-tray" aria-hidden="true">
    <rect width="${VB}" height="${VB}" fill="url(#${p}paper)"/>
    <rect width="${VB}" height="${VB}" fill="url(#${p}vig)"/>
    <rect width="${VB}" height="${VB}" fill="#2A2118" filter="url(#${p}noise)" opacity=".03"/>
    ${plate}
    <rect width="${VB}" height="${VB}" fill="#2A2118" filter="url(#${p}noise)" opacity=".026"/>
  </g>`;
}

function baseDefs(p) {
  return [
    linearGrad(`${p}paper`, 'x1="0" y1="0" x2="0.55" y2="1"', [
      ['0', 'rgba(252,249,242,0.95)'],
      ['0.45', 'rgba(246,240,230,0.9)'],
      ['1', 'rgba(238,228,212,0.78)'],
    ]),
    radialGrad(`${p}vig`, 'cx="50%" cy="44%" r="72%"', [
      ['0.4', 'rgba(118,94,62,0)'],
      ['0.78', 'rgba(118,94,62,0.05)'],
      ['1', 'rgba(104,78,48,0.15)'],
    ]),
    radialGrad(`${p}plate`, 'cx="46%" cy="36%" r="72%"', [
      ['0', 'rgba(255,253,248,0.14)'],
      ['0.55', 'rgba(253,249,241,0.05)'],
      ['1', 'rgba(250,245,235,0)'],
    ]),
    `<filter id="${p}noise" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.82" numOctaves="3" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.62"/></feComponentTransfer>
    </filter>`,
    blurFilter(`${p}blurMd`, 7),
    blurFilter(`${p}blurLg`, 14),
  ].join('');
}

/* =========================================================================
 * circle view
 * ========================================================================= */

function circleDefs(p, palettes) {
  return [
    radialGrad(`${p}hole`, 'cx="50%" cy="52%" r="52%"', [
      ['0.42', 'rgba(72,54,36,0)'],
      ['0.8', 'rgba(72,54,36,0.08)'],
      ['1', 'rgba(72,54,36,0.2)'],
    ]),
    linearGrad(`${p}cord`, 'x1="0" y1="0" x2="0.4" y2="1"', [
      ['0', '#8C755A'],
      ['0.5', '#6C5843'],
      ['1', '#51402C'],
    ]),
  ].join('');
}

function ringPoint(a) {
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const t = (1 - cos) / 2;
  const persp = 1 - 0.065 * t;
  return {
    x: RING.cx + RING.rx * persp * sin,
    y: RING.cy + RING.ry * persp * cos,
    t,
    cos,
    tangent: Math.atan2(-RING.ry * sin, RING.rx * cos) * DEG,
  };
}

/**
 * 按「弧长」而不是「角度」均分珠位：椭圆上等角度不等于等间距，
 * 否则左右两侧会被拉出明显空隙。返回每个珠位对应的基准角度。
 */
function ringAngles(count) {
  const N = 720;
  const steps = [];
  let total = 0;
  let prev = ringPoint(0);
  for (let i = 0; i < N; i += 1) {
    const a = (TAU * i) / N;
    const p = ringPoint(a);
    if (i > 0) total += Math.hypot(p.x - prev.x, p.y - prev.y);
    steps.push({ a, cum: total });
    prev = p;
  }
  const close = Math.hypot(ringPoint(0).x - prev.x, ringPoint(0).y - prev.y);
  total += close;
  const angles = [];
  for (let i = 0; i < count; i += 1) {
    const target = (total * i) / count;
    let lo = 0;
    let hi = steps.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (steps[mid].cum < target) lo = mid + 1;
      else hi = mid;
    }
    angles.push(steps[lo].a);
  }
  return angles;
}

/**
 * Catmull-Rom → 三次贝塞尔，生成穿过每个珠心的串线路径。
 * 珠心轨迹因透视因子并非标准椭圆，所以串线必须按同一组珠心坐标插值，
 * 不能再用固定 rx/ry 的 ellipse（否则线会从珠心偏出去）。
 */
function cordPathThrough(points, closed = true) {
  const n = points.length;
  if (!n) return '';
  if (n === 1) return `M${f(points[0].x)} ${f(points[0].y)}`;
  const at = (i) => points[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
  let d = `M${f(points[0].x)} ${f(points[0].y)}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i += 1) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${f(c1x)} ${f(c1y)}, ${f(c2x)} ${f(c2y)}, ${f(p2.x)} ${f(p2.y)}`;
  }
  return closed ? `${d} Z` : d;
}

function circleScene(inst) {
  const { p, ring } = inst;
  const charm = inst.charmItem;
  const phase = inst.basePhase;
  const baseAngles = inst.baseAngles || ringAngles(ring.length);
  const placed = ring.map((item) => {
    const a = phase + baseAngles[item.ringIdx];
    const point = ringPoint(a);
    // 环视是俯视视角：所有晶石珠保持用户选择的同一珠径，不做前后缩放。
    return { item, point, radius: item._r };
  });
  const beads = placed
    .map(({ item, point, radius }) =>
      item.kind === 'spacer'
        ? spacerMarkup(inst, item, point.x, point.y, radius, { rotation: point.tangent })
        : beadMarkup(inst, item, point.x, point.y, radius),
    )
    .join('');
  const cord = cordPathThrough(placed.map(({ point }) => point), true);
  let charmMarkupStr = '';
  if (charm) {
    const anchorItem = ring[inst.charmRingIdx] || ring[0];
    const anchor = ringPoint(phase + baseAngles[anchorItem ? anchorItem.ringIdx : 0]);
    const radius = (anchorItem ? anchorItem._r : 20);
    charmMarkupStr = charmMarkup(inst, charm, anchor.x, anchor.y + radius * 0.8, radius / CHARM_UNIT_R);
  }
  const shadows = placed
    .map(({ point, radius }) => `<ellipse cx="0" cy="0.68" rx="0.92" ry="0.24" fill="rgba(66,48,30,.17)" transform="translate(${f(point.x)} ${f(point.y)}) scale(${f(radius)})"/>`)
    .join('');
  return ` ${paperScene(p, true)}
  <g class="bz-ground" aria-hidden="true">
    <ellipse cx="${RING.cx + 8}" cy="${RING.cy + 18}" rx="${RING.rx + 18}" ry="${RING.ry + 14}" fill="rgba(74,56,38,.13)" filter="url(#${p}blurLg)"/>
    <ellipse cx="${RING.cx}" cy="${RING.cy + 9}" rx="${RING.rx + 4}" ry="${RING.ry + 3}" fill="none" stroke="rgba(72,54,36,.2)" stroke-width="18" filter="url(#${p}blurMd)"/>
    <ellipse cx="${RING.cx}" cy="${RING.cy}" rx="${RING.rx - 8}" ry="${RING.ry - 8}" fill="url(#${p}hole)"/>
  </g>
  <g class="bz-shadows" filter="url(#${p}blurMd)" aria-hidden="true">${shadows}</g>
  <path class="bz-cord" d="${cord}" fill="none" stroke="url(#${p}cord)" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
  <path class="bz-cord-highlight" d="${cord}" fill="none" stroke="rgba(255,246,230,.28)" stroke-width="0.85" stroke-linecap="round" stroke-linejoin="round"/>
  <g class="bz-beads">${beads}</g>
  <g class="bz-charms">${charmMarkupStr}</g>`;
}

/* =========================================================================
 * flat view
 * ========================================================================= */

function flatScene(inst) {
  const { p, layout } = inst;
  const PX_MM = 3.3;
  const GAP = 1.4;
  const USABLE = 528;
  const sizes = layout.map((item) => (item.kind === 'charm' ? 0 : item.size * PX_MM));
  const raw = sizes.reduce((a, b) => a + b, 0) + GAP * Math.max(0, layout.length - 1);
  const k = Math.min(1, USABLE / raw);
  const total = raw * k;
  const rowY = 300;
  let cursor = 320 - total / 2;
  let beads = '';
  let charms = '';
  let avgR = 12;
  const beadItems = layout.filter((item) => item.kind === 'bead');
  if (beadItems.length) avgR = (beadItems.reduce((s, item) => s + item.size * PX_MM * k, 0) / beadItems.length) / 2;
  const placed = [];
  layout.forEach((item) => {
    const w = sizes[item._i] * k;
    if (item.kind === 'charm') {
      charms += charmMarkup(inst, item, cursor, rowY + avgR * 0.86, avgR / CHARM_UNIT_R);
      cursor += w + GAP * k;
      return;
    }
    const r = w / 2;
    const cx = cursor + r;
    beads += item.kind === 'spacer' ? spacerMarkup(inst, item, cx, rowY, r) : beadMarkup(inst, item, cx, rowY, r);
    placed.push({ cx, r });
    cursor += w + GAP * k;
  });
  const lineStart = 320 - total / 2 - 10;
  const lineEnd = 320 + total / 2 + 10;
  const shadows = placed
    .map(({ cx, r }) => `<ellipse cx="${f(cx)}" cy="${f(rowY + r * 0.66)}" rx="${f(r * 0.9)}" ry="${f(r * 0.23)}" fill="rgba(66,48,30,.17)"/>`)
    .join('');
  return ` ${paperScene(p, false)}
  <g class="bz-ground" aria-hidden="true">
    <rect x="${f(lineStart - 6)}" y="${f(rowY + avgR * 0.8)}" width="${f(lineEnd - lineStart + 12)}" height="10" rx="5" fill="rgba(74,56,38,.1)" filter="url(#${p}blurMd)"/>
  </g>
  <g class="bz-shadows" filter="url(#${p}blurMd)" aria-hidden="true">${shadows}</g>
  <line class="bz-cord" x1="${f(lineStart)}" y1="${rowY}" x2="${f(lineEnd)}" y2="${rowY}" stroke="url(#${p}cordF)" stroke-width="2.8" stroke-linecap="round"/>
  <line class="bz-cord-highlight" x1="${f(lineStart)}" y1="${f(rowY - 0.5)}" x2="${f(lineEnd)}" y2="${f(rowY - 0.5)}" stroke="rgba(255,246,230,.28)" stroke-width="0.85" stroke-linecap="round"/>
  <g class="bz-beads">${beads}</g>
  <g class="bz-charms">${charms}</g>`;
}

function flatDefs(p) {
  return linearGrad(`${p}cordF`, 'x1="0" y1="0" x2="1" y2="0"', [
    ['0', '#8C755A'],
    ['0.5', '#6C5843'],
    ['1', '#51402C'],
  ]);
}

/* =========================================================================
 * wrist view
 * ========================================================================= */

const ARM_PATH =
  'M 224 -10 C 217 120, 226 232, 240 288 C 243 306, 242 330, 246 356 C 252 408, 262 452, 268 512 L 372 512 C 378 452, 388 408, 394 356 C 398 330, 397 306, 400 288 C 414 232, 423 120, 416 -10 Z';

const WRIST = { cx: 320, cy: 296, rx: 90, ry: 30 };

function wristDefs(p) {
  return [
    linearGrad(`${p}skin`, 'x1="0" y1="0" x2="1" y2="0.12"', [
      ['0', '#F7EDE1'],
      ['0.22', '#F1E2D1'],
      ['0.52', '#E8D3BD'],
      ['0.8', '#DBC0A5'],
      ['1', '#C6A687'],
    ]),
    radialGrad(`${p}skinLight`, 'cx="50%" cy="50%" r="50%"', [
      ['0', '#FFFAF2', 0.72],
      ['0.55', '#FFFAF2', 0.22],
      ['1', '#FFFAF2', 0],
    ]),
    linearGrad(`${p}skinEdgeL`, 'x1="0" y1="0" x2="1" y2="0"', [
      ['0', 'rgba(138,102,70,0.2)'],
      ['0.5', 'rgba(138,102,70,0.05)'],
      ['1', 'rgba(138,102,70,0)'],
    ]),
    linearGrad(`${p}skinEdge`, 'x1="0" y1="0" x2="1" y2="0"', [
      ['0.42', 'rgba(120,88,58,0)'],
      ['0.82', 'rgba(120,88,58,0.18)'],
      ['1', 'rgba(108,76,48,0.34)'],
    ]),
    linearGrad(`${p}armFade`, 'x1="0" y1="0" x2="0" y2="1"', [
      ['0', 'rgba(243,236,224,0)'],
      ['0.45', 'rgba(243,236,224,0.8)'],
      ['0.85', 'rgba(243,236,224,1)'],
      ['1', 'rgba(243,236,224,1)'],
    ]),
    `<clipPath id="${p}armClip"><path d="${ARM_PATH}"/></clipPath>`,
    linearGrad(`${p}cord`, 'x1="0" y1="0" x2="0.4" y2="1"', [
      ['0', '#8C755A'],
      ['0.5', '#6C5843'],
      ['1', '#51402C'],
    ]),
  ].join('');
}

function wristScene(inst) {
  const { p, ring } = inst;
  const phase = inst.basePhase;
  const visible = [];
  ring.forEach((item) => {
    const a = phase + (TAU * item.ringIdx) / Math.max(1, ring.length);
    const cos = Math.cos(a);
    if (cos < -0.08) return;
    const sin = Math.sin(a);
    const t = (1 - cos) / 2;
    const persp = 1 - 0.04 * t;
    const x = WRIST.cx + WRIST.rx * persp * sin;
    const y = WRIST.cy + WRIST.ry * persp * cos;
    const radius = (item.size * 3.2 * (1 - 0.07 * t)) / 2;
    const tangent = Math.atan2(-WRIST.ry * sin, WRIST.rx * cos) * DEG;
    visible.push({ item, cos, x, y, radius, tangent });
  });
  visible.sort((a, b) => a.cos - b.cos);
  // 串线沿“珠心”连接（按环序，不按前后遮挡顺序），保证穿过每颗珠中心。
  const cordPoints = visible
    .slice()
    .sort((a, b) => a.item.ringIdx - b.item.ringIdx)
    .map((v) => ({ x: v.x, y: v.y }));
  const cord = cordPathThrough(cordPoints, false);
  let beads = '';
  const shadows = [];
  visible.forEach((v) => {
    beads +=
      v.item.kind === 'spacer'
        ? spacerMarkup(inst, v.item, v.x, v.y, v.radius, { rotation: v.tangent })
        : beadMarkup(inst, v.item, v.x, v.y, v.radius);
    shadows.push(`<ellipse cx="${f(v.x)}" cy="${f(v.y + v.radius * 0.6)}" rx="${f(v.radius * 0.9)}" ry="${f(v.radius * 0.28)}" fill="rgba(90,64,40,.17)"/>`);
  });

  const charm = inst.charmItem;
  let charms = '';
  if (charm) {
    const frontBead = ring.find((item) => item.kind === 'bead' && item.ringIdx === inst.charmRingIdx) || ring.find((item) => item.kind === 'bead');
    const radius = frontBead ? (frontBead.size * 3.2) / 2 : 12;
    charms = charmMarkup(inst, charm, WRIST.cx, WRIST.cy + WRIST.ry + radius * 0.8, radius / CHARM_UNIT_R);
  }

  const wrist = (inst.comp.wrist || 15.5).toFixed(1);
  const dia = num(inst.comp.beadDiameter, 8);
  return ` ${paperScene(p, false)}
  <g class="bz-arm" aria-hidden="true">
    <path d="${ARM_PATH}" fill="url(#${p}skin)"/>
    <g clip-path="url(#${p}armClip)">
      <ellipse cx="298" cy="196" rx="72" ry="280" fill="url(#${p}skinLight)"/>
      <rect x="214" y="0" width="48" height="640" fill="url(#${p}skinEdgeL)"/>
      <rect x="370" y="0" width="56" height="640" fill="url(#${p}skinEdge)"/>
      <path d="M236 348 C 268 358, 372 358, 404 348" stroke="rgba(150,110,76,.1)" stroke-width="3" fill="none"/>
      <path d="M242 372 C 274 382, 366 382, 398 372" stroke="rgba(150,110,76,.07)" stroke-width="2.4" fill="none"/>
      <rect x="196" y="330" width="248" height="182" fill="url(#${p}armFade)"/>
    </g>
  </g>
  <g class="bz-ground" aria-hidden="true">
    <ellipse cx="320" cy="312" rx="100" ry="16" fill="rgba(104,74,46,.2)" filter="url(#${p}blurMd)"/>
  </g>
  <g class="bz-shadows" filter="url(#${p}blurMd)" aria-hidden="true">${shadows.join('')}</g>
  <path class="bz-cord" d="${cord}" fill="none" stroke="url(#${p}cord)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
  <path class="bz-cord-highlight" d="${cord}" fill="none" stroke="rgba(255,246,230,.26)" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"/>
  <g class="bz-beads">${beads}</g>
  <g class="bz-charms">${charms}</g>
  <g class="bz-annot" aria-hidden="true">
    <line x1="214" y1="572" x2="426" y2="572" stroke="#BDB09A" stroke-width="1"/>
    <line x1="214" y1="567" x2="214" y2="577" stroke="#BDB09A" stroke-width="1"/>
    <line x1="426" y1="567" x2="426" y2="577" stroke="#BDB09A" stroke-width="1"/>
    <text class="bz-annot-text" x="320" y="594" text-anchor="middle">内径 ${esc(wrist)} cm · 珠径 ${esc(String(dia))} mm</text>
  </g>`;
}

/* =========================================================================
 * design → scene (shared by the DOM controller and the static exporter)
 * ========================================================================= */

function ellipsePerimeter(a, b) {
  return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
}

/** Mutates a (plain) scene state object so the scene builders can run. */
function applyDesign(state, normalized) {
  state.design = normalized.design;
  state.comp = normalized.comp;
  state.layout = normalized.layout;
  state.metal = normalized.metal;
  state.ring = normalized.layout.filter((item) => item.kind !== "charm");
  state.palettes = buildPalettes(normalized.layout);
  state.baseAngles = ringAngles(state.ring.length);

  const perim = ellipsePerimeter(RING.rx, RING.ry);
  const spacing = perim / Math.max(1, state.ring.length);
  const avgSize = state.ring.reduce((sum, item) => sum + item.size, 0) / Math.max(1, state.ring.length);
  state.ring.forEach((item, index) => {
    item.ringIdx = index;
    item._r = spacing * 0.52 * (item.size / avgSize);
    // deterministic per-bead variation (no extra nodes):
    // variant A/B, tiny art rotation and +-1% radius so no two beads repeat.
    const seed = item._i + item.pos * 0.37;
    item._variant = beadHash(seed, 1) < 0.5 ? 'a' : 'b';
    item._artRot = (beadHash(seed, 2) - 0.5) * 13;
    // 所有晶石珠同径：不做艺术缩放，尺寸只由 composition.beadDiameter 决定。
    item._artScale = 1;
  });

  const charm = normalized.layout.find((item) => item.kind === 'charm') || null;
  state.charmItem = charm;
  state.charmRingIdx = 0;
  if (charm) {
    let best = 0;
    let bestD = Infinity;
    state.ring.forEach((item, index) => {
      if (item.kind !== 'bead') return;
      const d = Math.abs(item.pos - charm.pos);
      if (d < bestD) {
        bestD = d;
        best = index;
      }
    });
    state.charmRingIdx = best;
  }
  state.basePhase = charm ? (-TAU * state.charmRingIdx) / Math.max(1, state.ring.length) : 0;
}

function defsForState(state) {
  const p = state.p;
  const spacerMetals = [];
  for (const item of state.layout) {
    if (item.kind === 'spacer' && spacerMetals.indexOf(item.metal) === -1) spacerMetals.push(item.metal);
  }
  let out = baseDefs(p) + (state.sprites ? spriteOverlayDefs(p) : buildBeadMaterialDefs(p, state.palettes));
  if (spacerMetals.length) out += spacerMaterialDefs(p, spacerMetals);
  if (state.charmItem && state.charmItem.charmId !== 'none') out += metalDefs(p, state.metal);
  if (state.view === 'circle') out += circleDefs(p, state.palettes);
  else if (state.view === 'flat') out += flatDefs(p, state.palettes);
  else out += wristDefs(p);
  return `<defs>${out}</defs>`;
}

function sceneForState(state) {
  return state.view === 'circle' ? circleScene(state) : state.view === 'flat' ? flatScene(state) : wristScene(state);
}

function buildAriaLabel(state) {
  const beads = state.layout.filter((item) => item.kind === 'bead');
  const names = [];
  beads.forEach((item) => {
    if (item.zh && names.indexOf(item.zh) === -1) names.push(item.zh);
  });
  const charm = state.charmItem;
  const viewName = { circle: '环视', flat: '平铺', wrist: '佩戴' }[state.view] || '';
  const title = (state.design && state.design.copy && state.design.copy.headline) || (state.design && state.design.theme && state.design.theme.name) || '定制手串';
  const parts = [`${title}，${viewName}预览。`];
  parts.push(`共 ${beads.length} 颗晶石：${names.join('、') || '晶石'}`);
  if (charm) parts.push(`，${charm.zh}挂坠`);
  parts.push('。');
  if (state.interactive) parts.push('可拖动旋转，Tab 键逐颗浏览，Enter 查看。');
  return parts.join('');
}

function createMarkupState(design, view, interactive, options = {}) {
  const state = {
    p: `bz${(INSTANCE_SEQ += 1)}-`,
    view,
    interactive,
    photos: options.photos !== false,
    photoMap: options.photoMap && typeof options.photoMap === 'object' ? options.photoMap : null,
    design: null,
    comp: {},
    layout: [],
    ring: [],
    palettes: [],
    metal: 'silver',
    charmItem: null,
    charmRingIdx: 0,
    basePhase: 0,
    userRot: 0,
  };
  applyDesign(state, normalizeDesign(design));
  return state;
}

/**
 * Some SVG rasterisers (librsvg 2.40, many PDF/print pipelines) do not accept
 * the CSS `rgba()` function inside presentation attributes; fold those into
 * `<color>` + `*-opacity` pairs for the static export.
 */
function compatPaintAttributes(markup) {
  return markup.replace(/\b(stop-color|fill|stroke)="rgba\(([^)]+)\)"/g, (match, attr, args) => {
    const parts = args.split(',').map((part) => part.trim());
    if (parts.length < 4) return match;
    const hex = hexOf(Number(parts[0]), Number(parts[1]), Number(parts[2]));
    const opacityAttr = attr === 'stop-color' ? 'stop-opacity' : attr === 'fill' ? 'fill-opacity' : 'stroke-opacity';
    return `${attr}="${hex}" ${opacityAttr}="${parts[3]}"`;
  });
}

/**
 * Pure SVG string for a design/view — no DOM required. Useful for static
 * exports, social cards and server-side rasterisation.
 *
 * @param {object} design
 * @param {{view?:'circle'|'flat'|'wrist', interactive?:boolean}} [options]
 * @returns {string} standalone `<svg>` markup (640×640)
 */
export function renderBraceletMarkup(design, options = {}) {
  const view = options.view === 'flat' || options.view === 'wrist' ? options.view : 'circle';
  const state = createMarkupState(design, view, options.interactive === true, options);
  const label = buildAriaLabel(state);
  const markup = `${defsForState(state)}${sceneForState(state)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${VB} ${VB}" width="${VB}" height="${VB}" role="img" aria-label="${esc(label)}" data-view="${view}">${compatPaintAttributes(markup)}</svg>`;
}

/* =========================================================================
 * controller
 * ========================================================================= */

/**
 * @param {object} options
 * @param {HTMLElement} options.container
 * @param {object} options.design
 * @param {'circle'|'flat'|'wrist'} [options.view]
 * @param {boolean} [options.interactive]
 * @param {(info:object|null)=>void} [options.onBeadHover]
 * @param {(info:object)=>void} [options.onBeadClick]
 * @returns {{el:SVGSVGElement, update:Function, destroy:Function, setView:Function, rotateTo:Function, getView:Function, svg:SVGSVGElement}}
 */
export function renderBracelet(options = {}) {
  const container = options.container;
  if (!container || typeof container.appendChild !== 'function') {
    throw new Error('renderBracelet: a container element is required');
  }

  const prefix = `bz${(INSTANCE_SEQ += 1)}-`;
  const reducedQuery = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  const state = {
    p: prefix,
    design: null,
    comp: {},
    layout: [],
    ring: [],
    palettes: [],
    metal: 'silver',
    view: options.view === 'flat' || options.view === 'wrist' ? options.view : 'circle',
    interactive: options.interactive !== false,
    sprites: options.sprites === true && typeof document !== 'undefined',
    photos: options.photos !== false,
    photoMap: options.photoMap && typeof options.photoMap === 'object' ? options.photoMap : null,
    reduced: !!(reducedQuery && reducedQuery.matches),
    charmItem: null,
    charmRingIdx: 0,
    basePhase: 0,
    userRot: 0,
    hovered: null,
    raf: 0,
    inertiaRaf: 0,
    velocity: 0,
    drag: null,
    suppressClick: false,
    hits: [],
    ringEls: [],
    charmEl: null,
    beadsGroup: null,
    alive: true,
    onBeadHover: typeof options.onBeadHover === 'function' ? options.onBeadHover : () => {},
    onBeadClick: typeof options.onBeadClick === 'function' ? options.onBeadClick : () => {},
  };

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'bz-svg');
  svg.setAttribute('viewBox', `0 0 ${VB} ${VB}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('role', 'group');
  svg.setAttribute('data-view', state.view);
  svg.style.setProperty('--bz-prefix', prefix);

  const rootAC = new AbortController();
  const rootSignal = rootAC.signal;
  let sceneAC = null;

  /* ---------------- prepare ---------------- */

  function prepare(normalized) {
    applyDesign(state, normalized);
  }

  /* ---------------- scene build ---------------- */

  function defsFor(view) {
    state.view = view;
    return defsForState(state);
  }

  function buildScene() {
    if (!state.alive) return;
    if (sceneAC) sceneAC.abort();
    sceneAC = new AbortController();
    svg.setAttribute('data-view', state.view);
    svg.innerHTML = defsFor(state.view) + sceneForState(state);
    collect();
    if (state.view === 'circle') layoutCircle();
    updateAria();
  }

  function collect() {
    state.hits = Array.from(svg.querySelectorAll('[data-kind]'));
    state.ring.forEach((item) => {
      item._el = null;
      item._shadow = null;
    });
    state.hits.forEach((el) => {
      const index = Number(el.dataset.i);
      const item = state.layout[index];
      if (!item) return;
      item._el = el;
      el._haze = el.querySelector('.bz-bead-haze');
      bindHit(el);
    });
    Array.from(svg.querySelectorAll('.bz-shadows > ellipse')).forEach((el, index) => {
      if (state.ring[index]) state.ring[index]._shadow = el;
    });
    state.ringEls = state.ring.filter((item) => item._el).map((item) => item._el);
    state.charmEl = svg.querySelector('.bz-charm');
    state.beadsGroup = svg.querySelector('.bz-beads');
    state.hovered = null;
  }

  function bindHit(el) {
    const signal = sceneAC.signal;
    el.addEventListener('pointerenter', () => setHover(el), { signal });
    el.addEventListener('pointerleave', () => {
      if (state.hovered === el) setHover(null);
    }, { signal });
    el.addEventListener('focus', () => setHover(el), { signal });
    el.addEventListener('blur', () => {
      if (state.hovered === el) setHover(null);
    }, { signal });
    el.addEventListener('click', () => {
      if (state.suppressClick) return;
      state.onBeadClick(infoFor(el));
    }, { signal });
  }

  function infoFor(el) {
    const index = Number(el.dataset.i);
    const item = state.layout[index] || {};
    const base = { index, el, node: el };
    if (item.kind === 'spacer') {
      return {
        ...base,
        kind: 'spacer',
        metal: item.metal,
        size: item.size,
        zh: item.zh,
        label: `${METAL_ZH[item.metal] || '金属'}隔珠 · ${item.size}mm`,
      };
    }
    if (item.kind === 'charm') {
      return {
        ...base,
        kind: 'charm',
        charmId: item.charmId,
        zh: item.zh,
        label: `${item.zh}挂坠`,
      };
    }
    return {
      ...base,
      kind: 'bead',
      crystalId: item.crystalId,
      pos: item.pos,
      zh: item.zh,
      en: item.en,
      element: item.element,
      role: item.role,
      size: item.size,
      hex: item.hex,
      hex2: item.hex2,
      hex3: item.hex3,
      texture: item.texture,
      label: `${item.zh}${item.element ? ` · ${item.element}` : ''} · ${item.size}mm`,
    };
  }

  function setHover(el) {
    if (state.hovered && state.hovered !== el) state.hovered.classList.remove('is-hover');
    state.hovered = el || null;
    if (!el) {
      state.onBeadHover(null);
      return;
    }
    el.classList.add('is-hover');
    state.onBeadHover(infoFor(el));
  }

  function updateAria() {
    svg.setAttribute('aria-label', buildAriaLabel(state));
  }

  /* ---------------- circle layout / rotation ---------------- */

  function layoutCircle() {
    const ring = state.ring;
    const phase = state.basePhase + state.userRot;
    const order = [];
    let front = null;
    for (const item of ring) {
      const el = item._el;
      if (!el) continue;
      const a = phase + (state.baseAngles?.[item.ringIdx] ?? (TAU * item.ringIdx) / Math.max(1, ring.length));
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      const t = (1 - cos) / 2;
      const persp = 1 - 0.065 * t;
      const x = RING.cx + RING.rx * persp * sin;
      const y = RING.cy + RING.ry * persp * cos;
      const radius = item._r;
      const extraRotation = item.kind === 'spacer' ? Math.atan2(-RING.ry * sin, RING.rx * cos) * DEG : 0;
      const transform = beadTransform(item, x, y, radius, extraRotation);
      if (el._t !== transform) {
        el.setAttribute('transform', transform);
        el._t = transform;
      }
      if (item._shadow) {
        const shadowTransform = `translate(${f(x)} ${f(y)}) scale(${f(radius)})`;
        if (item._shadow._t !== shadowTransform) {
          item._shadow.setAttribute('transform', shadowTransform);
          item._shadow._t = shadowTransform;
        }
      }
      const haze = t > 0.02 ? Math.min(0.3, 0.03 + 0.27 * t * t) : 0;
      const hazeEl = el._haze;
      if (hazeEl) {
        const v = haze.toFixed(3);
        if (hazeEl._o !== v) {
          hazeEl.setAttribute('opacity', v);
          hazeEl._o = v;
        }
      }
      const isBack = t > 0.42;
      if (el._back !== isBack) {
        el.classList.toggle('bz-bead--back', isBack);
        el._back = isBack;
      }
      order.push({ el, depth: cos });
      if (item.kind === 'bead' && (!front || cos > front.cos)) front = { cos, x, y, r: radius };
    }
    order.sort((a, b) => a.depth - b.depth);
    reorder(state.beadsGroup, order.map((o) => o.el));
    if (state.charmEl && front) {
      state.charmEl.setAttribute('transform', `translate(${f(front.x)} ${f(front.y + front.r * 0.8)}) scale(${f((front.r / CHARM_UNIT_R) * 0.66)})`);
    }
  }

  function reorder(group, elements) {
    if (!group) return;
    if (group.children.length === elements.length) {
      let same = true;
      for (let i = 0; i < elements.length; i += 1) {
        if (group.children[i] !== elements[i]) {
          same = false;
          break;
        }
      }
      if (same) return;
    }
    elements.forEach((el) => group.appendChild(el));
  }

  function scheduleLayout() {
    if (state.raf) return;
    state.raf = requestAnimationFrame(() => {
      state.raf = 0;
      if (state.alive && state.view === 'circle') layoutCircle();
    });
  }

  /* ---------------- pointer / keyboard ---------------- */

  function onPointerDown(event) {
    if (!state.interactive || state.view !== 'circle') return;
    if (event.button != null && event.button !== 0) return;
    stopInertia();
    state.drag = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastT: performance.now(),
      axis: null,
      moved: 0,
    };
    state.velocity = 0;
    try {
      svg.setPointerCapture(event.pointerId);
    } catch (err) {
      /* ignore */
    }
    svg.classList.add('is-dragging');
  }

  function onPointerMove(event) {
    const drag = state.drag;
    if (!drag || drag.id !== event.pointerId) return;
    const now = performance.now();
    const dt = Math.max(12, now - drag.lastT) / 1000;
    if (!drag.axis) {
      const dx = Math.abs(event.clientX - drag.startX);
      const dy = Math.abs(event.clientY - drag.startY);
      if (dx < 5 && dy < 5) return;
      drag.axis = dx >= dy ? 'x' : 'y';
      if (drag.axis !== 'x') {
        if (event.pointerType !== 'mouse') {
          state.drag = null;
          svg.classList.remove('is-dragging');
          return;
        }
      }
    }
    const dx = event.clientX - drag.lastX;
    drag.lastX = event.clientX;
    drag.lastT = now;
    if (drag.axis !== 'x') return;
    const delta = dx * 0.0105;
    state.userRot += delta;
    state.velocity = delta / dt;
    drag.moved += Math.abs(dx);
    scheduleLayout();
  }

  function endDrag(event) {
    const drag = state.drag;
    if (!drag || drag.id !== event.pointerId) return;
    const moved = drag.moved;
    state.drag = null;
    svg.classList.remove('is-dragging');
    try {
      svg.releasePointerCapture(event.pointerId);
    } catch (err) {
      /* ignore */
    }
    if (moved > 8) {
      state.suppressClick = true;
      setTimeout(() => {
        state.suppressClick = false;
      }, 0);
    }
    if (!state.reduced && Math.abs(state.velocity) > 0.55) startInertia();
  }

  function startInertia() {
    stopInertia();
    let last = performance.now();
    const step = (now) => {
      if (!state.alive) return;
      const dt = Math.min(0.05, Math.max(0.008, (now - last) / 1000));
      last = now;
      state.userRot += state.velocity * dt;
      state.velocity *= Math.exp(-5.2 * dt);
      layoutCircle();
      if (Math.abs(state.velocity) > 0.05) {
        state.inertiaRaf = requestAnimationFrame(step);
      } else {
        state.inertiaRaf = 0;
      }
    };
    state.inertiaRaf = requestAnimationFrame(step);
  }

  function stopInertia() {
    if (state.inertiaRaf) {
      cancelAnimationFrame(state.inertiaRaf);
      state.inertiaRaf = 0;
    }
  }

  function onKeyDown(event) {
    if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
    const target = event.target;
    const hit = target && target.closest ? target.closest('[data-kind]') : null;
    if (!hit) return;
    event.preventDefault();
    state.onBeadClick(infoFor(hit));
  }

  svg.addEventListener('pointerdown', onPointerDown, { signal: rootSignal });
  svg.addEventListener('pointermove', onPointerMove, { signal: rootSignal });
  svg.addEventListener('pointerup', endDrag, { signal: rootSignal });
  svg.addEventListener('pointercancel', endDrag, { signal: rootSignal });
  svg.addEventListener('keydown', onKeyDown, { signal: rootSignal });
  svg.addEventListener('dragstart', (event) => event.preventDefault(), { signal: rootSignal });

  if (reducedQuery && reducedQuery.addEventListener) {
    const onReduced = (event) => {
      state.reduced = !!event.matches;
    };
    reducedQuery.addEventListener('change', onReduced, { signal: rootSignal });
  }

  /* ---------------- public api ---------------- */

  function update(design) {
    if (!state.alive) return api;
    prepare(normalizeDesign(design));
    buildScene();
    return api;
  }

  function setView(view) {
    if (!state.alive) return api;
    const next = view === 'flat' || view === 'wrist' ? view : 'circle';
    if (next === state.view) return api;
    state.view = next;
    state.userRot = 0;
    state.velocity = 0;
    stopInertia();
    buildScene();
    return api;
  }

  function rotateTo(degrees) {
    if (!state.alive) return api;
    const deg = Number(degrees);
    if (!Number.isFinite(deg)) return api;
    stopInertia();
    state.velocity = 0;
    state.userRot = (deg * Math.PI) / 180;
    if (state.view === 'circle') layoutCircle();
    return api;
  }

  function getView() {
    return state.view;
  }

  function destroy() {
    if (!state.alive) return;
    state.alive = false;
    stopInertia();
    if (state.raf) cancelAnimationFrame(state.raf);
    if (sceneAC) sceneAC.abort();
    rootAC.abort();
    if (state.hovered) state.hovered.classList.remove('is-hover');
    state.onBeadHover(null);
    if (svg.parentNode) svg.parentNode.removeChild(svg);
    state.layout = [];
    state.hits = [];
  }

  while (container.firstChild) container.removeChild(container.firstChild);
  container.appendChild(svg);
  prepare(normalizeDesign(options.design));
  buildScene();

  const api = {
    el: svg,
    svg,
    update,
    setView,
    getView,
    rotateTo,
    destroy,
    get view() {
      return state.view;
    },
    get nodeCount() {
      return svg.querySelectorAll('*').length;
    },
    get info() {
      return {
        view: state.view,
        beads: state.layout.filter((item) => item.kind === 'bead').length,
        spacers: state.layout.filter((item) => item.kind === 'spacer').length,
        charm: state.charmItem ? state.charmItem.charmId : null,
        metal: state.metal,
      };
    },
  };

  return api;
}

/**
 * Convenience alias kept for callers that only need the raw SVG preview.
 * The richer preview (view switch chrome + tooltip) lives in
 * `src/render/bracelet-preview.js`.
 */
export function renderBraceletPreview(options = {}) {
  return renderBracelet(options);
}

export default renderBracelet;
