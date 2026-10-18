/**
 * 实拍珠子素材清单（未来接入）
 *
 * 每颗珠子的实拍图放在 `assets/beads/`，这里登记 crystalId -> 文件。
 * 未登记的珠子继续使用 SVG 材质渲染（自动回退，不影响当前页面）。
 *
 * 支持两种写法：
 *   'rose-quartz': 'rose-quartz.png'
 *   'rose-quartz': { src: 'rose-quartz.png', scale: 1.02, dx: 0, dy: 0 }
 *
 * 素材规范见 docs/bead-photo-pipeline.md 与 assets/beads/README.md：
 * 1024×1024 PNG、透明背景、珠子居中占画面约 82%、俯视正圆、
 * 柔和棚拍光（左上主光）、不带投影/道具/文字、色彩校准到实物。
 *
 * 建议先用 8mm 实物拍摄；6mm/10mm 复用同一张图（渲染器按比例缩放），
 * 若不同珠径的纹理/色泽差异明显，可在对象里增加 `bySize: { 6: '...', 10: '...' }`（待接入）。
 */
export const BEAD_PHOTO_BASE = './assets/beads/';

export const BEAD_PHOTOS = {
  // 实拍照片到位后按此格式登记（文件名与 crystalId 一致）：
  // 'rose-quartz': 'rose-quartz.png',
  // 'silver-obsidian': { src: 'silver-obsidian.png', scale: 1.02 },
};
