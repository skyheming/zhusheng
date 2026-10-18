/**
 * ZHUSHENG / 珠生 — per-bead SVG markup (renderer v2).
 *
 * The bead artwork itself lives in <defs> (see bead-materials.js); every bead
 * is a <use> of one of two deterministic material variants, plus a haze disc
 * used for aerial perspective on the far half of the ring.
 *
 * Per-bead variation is baked into the transform (art rotation + tiny radius
 * jitter) so it costs no extra nodes:
 *   - item._variant : 'a' | 'b' (different highlight placement, tint)
 *   - item._artRot  : +-4.5deg highlight/texture rotation
 *   - item._artScale: +-1% radius
 */

import { beadArtId, spacerArtId } from './bead-materials.js';
import { beadSpriteUrl } from './bead-sprite.js';
import { resolveBeadPhoto, photoArtMarkup } from './bead-photo.js';

const METAL_ZH = { silver: '银', gold: '古金' };

function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

const f = (n) => String(Math.round(n * 1000) / 1000);

/** Shared transform for beads and spacers (used by the live circle layout too). */
export function beadTransform(item, x, y, radius, extraRotation = 0) {
  const rot = (item._artRot || 0) + extraRotation;
  const scale = radius * (item._artScale || 1);
  return `translate(${f(x)} ${f(y)})${rot ? ` rotate(${f(rot)})` : ''} scale(${f(scale)})`;
}

export function beadMarkup(inst, item, x, y, radius, opts = {}) {
  const { p } = inst;
  const artId = beadArtId(p, item._pal, item._variant || 'a');
  const label = `${item.zh}${item.element ? ` · ${item.element}` : ''} · ${item.size}mm`;
  const sprite = inst.sprites && item._palette ? beadSpriteUrl(item._palette) : null;
  const photo = resolveBeadPhoto(item, inst);
  const h = (salt) => {
    const v = Math.sin((item._i + 1) * 12.9898 + salt * 78.233) * 43758.5453;
    return v - Math.floor(v);
  };
  const ovx = (h(5) - 0.5) * 0.05;
  const ovy = (h(6) - 0.5) * 0.04;
  const ovr = (h(7) - 0.5) * 12;
  const art = photo
    ? photoArtMarkup(inst, item, photo)
    : sprite
    ? `<g class="bz-bead-art">
        <image x="-1" y="-1" width="2" height="2" preserveAspectRatio="none" href="${sprite}" xlink:href="${sprite}"/>
        <g clip-path="url(#${p}ovclip)" transform="translate(${f(ovx)} ${f(ovy)}) rotate(${f(ovr)})" aria-hidden="true">
          <rect x="-0.7" y="-0.62" width="0.44" height="0.28" rx="0.11" fill="url(#${p}ovwin)" transform="rotate(-20)" filter="url(#${p}ovblur)"/>
          <rect x="-0.53" y="-0.56" width="0.1" height="0.058" rx="0.026" fill="url(#${p}ovpt)" transform="rotate(-26)"/>
          <path d="M 0.93 0.37 A 0.99 0.99 0 0 1 0.19 0.963" fill="none" stroke="url(#${p}ovfres)" stroke-width="0.045"/>
        </g>
        <circle r="0.996" fill="none" stroke="rgba(26,18,12,.13)" stroke-width="0.012"/>
      </g>`
    : `<use class="bz-bead-art" href="#${artId}" xlink:href="#${artId}"/>`;
  return `<g class="bz-bead" data-kind="bead" data-i="${item._i}"${inst.interactive ? ' tabindex="0" role="button"' : ''} aria-label="${esc(label)}" transform="${beadTransform(item, x, y, radius, opts.rotation || 0)}" style="--bz-i:${item._i}">
    ${art}
    <circle class="bz-bead-haze" r="1.02" fill="#F1EADC" opacity="0"/>
  </g>`;
}

export function spacerMarkup(inst, item, x, y, radius, opts = {}) {
  const { p } = inst;
  const metal = item.metal || inst.metal;
  const artId = spacerArtId(p, metal, item._variant || 'a');
  const label = `${METAL_ZH[metal] || '金属'}隔珠 · ${item.size}mm`;
  const rotation = (opts.rotation || 0) + (item._artRot || 0) * 0.35;
  return `<g class="bz-bead bz-spacer" data-kind="spacer" data-i="${item._i}"${inst.interactive ? ' tabindex="0" role="button"' : ''} aria-label="${esc(label)}" transform="${beadTransform(item, x, y, radius, rotation)}" style="--bz-i:${item._i}">
    <use class="bz-bead-art" href="#${artId}" xlink:href="#${artId}"/>
    <circle class="bz-bead-haze" r="1.02" fill="#F1EADC" opacity="0"/>
  </g>`;
}
