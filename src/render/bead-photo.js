/**
 * 实拍珠子素材解析与 SVG 渲染（未来接入）
 *
 * 优先级：photoMap / BEAD_PHOTOS 中登记的实拍图 → 实验性 Canvas sprite →
 * 当前 SVG 材质渲染。未配置实拍图时完全走原有路径，视觉与性能不变。
 */

import { BEAD_PHOTO_BASE, BEAD_PHOTOS } from '../data/bead-photos.js';

function escAttr(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

function joinBase(src) {
  if (!src) return null;
  if (/^(https?:|data:|\.{1,2}\/|\/)/.test(src)) return src;
  return `${BEAD_PHOTO_BASE}${src}`;
}

/**
 * @param {object} item layout item (kind === 'bead')
 * @param {object} inst renderer state (may carry photoMap override for tests)
 * @returns {{src:string, dx:number, dy:number, scale:number}|null}
 */
export function resolveBeadPhoto(item, inst = {}) {
  if (inst.photos === false) return null;
  if (!item || item.kind !== 'bead' || !item.crystalId) return null;
  const map = inst.photoMap || BEAD_PHOTOS;
  const entry = map[item.crystalId];
  if (!entry) return null;
  if (typeof entry === 'string') {
    return { src: joinBase(entry), dx: 0, dy: 0, scale: 1 };
  }
  const src = joinBase(entry.src);
  if (!src) return null;
  return {
    src,
    dx: Number(entry.dx) || 0,
    dy: Number(entry.dy) || 0,
    scale: Number(entry.scale) || 1,
  };
}

/**
 * 实拍珠子在 unit space（r = 1）里的图形：正方形图片缩放铺满珠子，
 * 外加一圈极细的暗边帮助与纸面背景分离。投影仍由场景层统一绘制，
 * 因此拍摄时不要带投影。
 */
export function photoArtMarkup(inst, item, photo) {
  if (!photo) return '';
  const { dx, dy, scale } = photo;
  const transform = dx || dy || scale !== 1 ? ` transform="translate(${dx} ${dy}) scale(${scale})"` : '';
  return `<g class="bz-bead-art bz-bead-art--photo">
    <g${transform}>
      <image x="-1" y="-1" width="2" height="2" preserveAspectRatio="xMidYMid meet" href="${escAttr(photo.src)}" xlink:href="${escAttr(photo.src)}"/>
      <circle r="0.995" fill="none" stroke="rgba(26,18,12,.14)" stroke-width="0.008"/>
    </g>
  </g>`;
}
