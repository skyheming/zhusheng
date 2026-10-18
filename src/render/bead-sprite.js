/**
 * ZHUSHENG / 珠生 — procedural bead sprite generator (renderer v3, tuned).
 *
 * Canvas 2D renders each palette's bead once into a cached 384px sprite:
 *   - faithful stone colour (hex2 lit centre -> hex body -> hex3 saturated rim)
 *   - additive studio reflections only in the reflection term (never greys the
 *     body): warm-white softbox window, thin environment band, table bounce
 *   - internal structures (cotton / rutile needles / phantom layers /
 *     cat's-eye band / adularescence / inclusions), visible on the lit side
 *   - soft ambient occlusion so the SVG overlay can own crisp highlights
 *
 * Crisp highlight shapes, Fresnel rim and the outer edge are drawn as SVG
 * vectors on top (see spriteOverlayDefs in bead-materials.js), so 2x output
 * stays sharp even though the body texture is 384px.
 *
 * Geometry / environment tables are precomputed per sprite size, and the
 * per-pixel loop is scalar (no allocations), so a sprite renders in a few ms.
 * Sprites are cached per palette+size and shared by every bead.
 */

const SIZE = 256;
const CACHE = new Map();
const STATS = { generated: 0, lastMs: 0, totalMs: 0, size: SIZE };

/* ---------------- utils ---------------- */

const HEX_RE = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function rgbOf(value) {
  const m = HEX_RE.exec(String(value == null ? '' : value));
  if (!m) return [205, 194, 178];
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function mix(a, b, t) {
  const A = rgbOf(a);
  const B = rgbOf(b);
  return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t];
}

const lighten = (c, t) => mix(c, [255, 255, 255], t);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (a, b, v) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mixRGB = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const norm3 = (x, y, z) => {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
};

function luminance(color) {
  const [r, g, b] = rgbOf(color);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function hash2(x, y, seed) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function valueNoise(x, y, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}

function fbm(x, y, seed, octaves = 2) {
  let value = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i += 1) {
    value += valueNoise(x * freq, y * freq, seed + i * 17) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return value / norm;
}

/* ---------------- precomputed geometry + environment ---------------- */

let GEO = null;

function geometry(size) {
  if (GEO && GEO.size === size) return GEO;
  const n = size * size;
  const nx = new Float32Array(n);
  const ny = new Float32Array(n);
  const z = new Float32Array(n);
  const radial = new Float32Array(n);
  const ndl = new Float32Array(n);
  const ndh = new Float32Array(n);
  const fres = new Float32Array(n);
  const shadow = new Float32Array(n);
  const winA = new Float32Array(n);
  const winB = new Float32Array(n);
  const band = new Float32Array(n);
  const horizon = new Float32Array(n);
  const L = norm3(-0.48, -0.55, 0.685);
  const H = norm3(-0.34, -0.42, 0.84);
  const inv = 2 / size;
  for (let py = 0; py < size; py += 1) {
    const y = (py + 0.5) * inv - 1;
    for (let px = 0; px < size; px += 1) {
      const x = (px + 0.5) * inv - 1;
      const i = py * size + px;
      const rr = x * x + y * y;
      if (rr > 1) {
        z[i] = -1;
        continue;
      }
      const zz = Math.sqrt(1 - rr);
      const rx = 2 * zz * x;
      const ry = 2 * zz * y;
      nx[i] = x;
      ny[i] = y;
      z[i] = zz;
      radial[i] = Math.sqrt(rr);
      ndl[i] = Math.max(0, x * L[0] + y * L[1] + zz * L[2]);
      ndh[i] = Math.max(0, x * H[0] + y * H[1] + zz * H[2]);
      fres[i] = Math.pow(1 - zz, 5.2);
      shadow[i] = smoothstep(0.1, 1.0, 0.5 + 0.5 * (x * 0.6 + y * 0.8));

      const wdx = Math.abs(rx + 0.33) - 0.25;
      const wdy = Math.abs(ry + 0.43) - 0.18;
      const outside = Math.hypot(Math.max(wdx, 0), Math.max(wdy, 0)) + Math.min(Math.max(wdx, wdy), 0);
      winA[i] = (1 - smoothstep(-0.06, 0.22, outside)) * (0.1 + 0.07 * clamp01(0.5 - ry * 0.9));
      winB[i] = (1 - smoothstep(-0.01, 0.09, outside)) * (0.2 + 0.1 * clamp01(0.5 - ry * 0.9));
      band[i] = Math.exp(-Math.pow((ry + 0.16) / 0.04, 2)) * smoothstep(0.85, -0.15, rx) * 0.1;
      horizon[i] = Math.exp(-Math.pow((ry - 0.52) / 0.13, 2)) * (0.4 + 0.6 * smoothstep(-0.7, 0.3, rx)) * 0.05;
    }
  }
  GEO = { size, nx, ny, z, radial, ndl, ndh, fres, shadow, winA, winB, band, horizon };
  return GEO;
}

/* ---------------- material profile ---------------- */

function materialOf(pal) {
  const lum = luminance(pal.hex);
  const glassy = lum < 0.3;
  const deep = lum < 0.46;
  return {
    glassy,
    deep,
    translucent: !deep,
    specGain: glassy ? 1.0 : deep ? 0.72 : 0.5,
    rimGain: glassy ? 1.0 : deep ? 0.75 : 0.55,
    windowGain: glassy ? 0.9 : 1.0,
    ambient: glassy ? 0.56 : 0.66,
    diffuse: glassy ? 0.48 : 0.4,
    sat: glassy ? 1.08 : 1.16,
    useWinB: glassy,
  };
}

/* ---------------- internal textures ---------------- */

function makeTexture(pal, seed) {
  const type = pal.texture || 'none';
  const needles = [];
  if (type === 'rutilated') {
    const families = [-0.62, 0.85, 0.18];
    for (let i = 0; i < 13; i += 1) {
      const family = families[i % families.length];
      const ang = family + (hash2(i, 7, seed) - 0.5) * 0.34;
      const off = (hash2(i, 11, seed) - 0.5) * 1.35;
      const width = 0.004 + hash2(i, 13, seed) * 0.0035;
      const bright = 0.4 + hash2(i, 17, seed) * 0.4;
      const depth = hash2(i, 19, seed);
      needles.push({ cs: Math.cos(ang), sn: Math.sin(ang), off, width, bright, depth, invW: 1 / (width * 2.6) });
    }
  }
  return { type, needles, seed };
}

function buildField(pal, tex, fieldSize) {
  const n = fieldSize;
  const alpha = new Float32Array(n * n);
  const tint = new Float32Array(n * n * 3);
  const type = tex.type;
  if (type === 'none' || type === 'rutilated') return { n: 0, alpha, tint };
  const seed = tex.seed;
  const hex = rgbOf(pal.hex);
  const hex2 = rgbOf(pal.hex2);
  const hex3 = rgbOf(pal.hex3);
  const white = lighten(hex2, 0.42);
  const milky = mix(hex2, [255, 252, 246], 0.45);
  for (let j = 0; j < n; j += 1) {
    const y = ((j + 0.5) / n) * 2 - 1;
    for (let i = 0; i < n; i += 1) {
      const x = ((i + 0.5) / n) * 2 - 1;
      const idx = j * n + i;
      let a = 0;
      let c = white;
      switch (type) {
        case 'vein': {
          const cloud = smoothstep(0.42, 0.8, fbm(x * 1.7 + 3.1, y * 1.7 - 1.2, seed, 3));
          const wisp = smoothstep(0.5, 0.86, fbm(x * 4.2 - y * 1.1, y * 4.2 + x * 0.8, seed + 31, 2));
          a = cloud * 0.44 + wisp * 0.22;
          c = milky;
          break;
        }
        case 'phantom': {
          const n1 = fbm(x * 1.5 + 0.3, y * 1.5 - 0.2, seed + 9, 3);
          const ridge = Math.abs(Math.sin((y + n1 * 0.45 + 0.1) * 4.6));
          const layer1 = smoothstep(0.5, 0.86, ridge) * smoothstep(0.6, -0.4, y);
          const n2 = fbm(x * 2.4 - 1.1, y * 2.4 + 0.6, seed + 41, 2);
          const layer2 = smoothstep(0.55, 0.92, Math.abs(Math.sin((y + n2 * 0.5 + 0.35) * 7.4))) * smoothstep(0.15, 0.95, y);
          a = clamp01(layer1 * 0.42 + layer2 * 0.3 + smoothstep(0.4, 0.8, fbm(x * 1.2, y * 1.2, seed + 23, 2)) * 0.26);
          c = mixRGB(lighten(hex2, 0.12), hex, 0.35);
          break;
        }
        case 'catseye': {
          const ang = -0.4;
          const axis = x * Math.cos(ang) + y * Math.sin(ang);
          const bandv = Math.exp(-Math.pow(axis / 0.16, 2));
          const core = Math.exp(-Math.pow(axis / 0.045, 2));
          a = bandv * 0.34 + core * 0.36;
          c = [252, 253, 255];
          break;
        }
        case 'iridescent': {
          const nn = fbm(x * 1.3 + 2.2, y * 1.3, seed + 61, 2);
          const film = 0.5 + 0.5 * Math.sin((x + y) * 3.2 + nn * 5.0);
          const sheen = smoothstep(-0.2, 0.9, 0.45 - 0.5 * (x * 0.5 + y * 0.7));
          a = sheen * 0.3;
          c = mixRGB([158, 196, 238], [247, 205, 226], film);
          break;
        }
        case 'inclusion': {
          const nn = fbm(x * 6.0, y * 6.0, seed + 71, 2);
          a = smoothstep(0.74, 0.9, nn) * 0.5;
          c = hex3;
          break;
        }
        default:
          a = 0;
      }
      alpha[idx] = a;
      tint[idx * 3] = c[0];
      tint[idx * 3 + 1] = c[1];
      tint[idx * 3 + 2] = c[2];
    }
  }
  return { n, alpha, tint };
}

/* ---------------- sprite renderer ---------------- */

function renderSprite(pal, variant, size) {
  const t0 = performance.now();
  const prof = materialOf(pal);
  const seed = (rgbOf(pal.hex)[0] * 13 + rgbOf(pal.hex2)[1] * 7 + rgbOf(pal.hex3)[2] * 3 + (variant === 'a' ? 11 : 97)) | 0;
  const tex = makeTexture(pal, seed);
  const field = buildField(pal, tex, 128);
  const geo = geometry(size);
  const { z, radial, ndl, ndh, fres, shadow, winA, winB, band, horizon } = geo;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;

  const base = rgbOf(pal.hex);
  const base2 = rgbOf(pal.hex2);
  const base3 = rgbOf(pal.hex3);
  const glassy = luminance(pal.hex) < 0.3;
  const body0 = mixRGB(base2, base, glassy ? 0.66 : 0.44);
  const body1 = base;
  const body2 = glassy ? mixRGB(base, base3, 0.4) : mixRGB(base, base3, 0.55);
  const transTint = lighten(pal.hex2, 0.18);
  const translucency = prof.translucent;
  const pointX = -0.45;
  const pointY = -0.5;
  const pointRadius = 0.00016;

  const b0r = body0[0], b0g = body0[1], b0b = body0[2];
  const b1r = body1[0], b1g = body1[1], b1b = body1[2];
  const b2r = body2[0], b2g = body2[1], b2b = body2[2];
  const tr = transTint[0], tg = transTint[1], tb = transTint[2];
  const wgr = prof.windowGain, wgg = prof.windowGain * 0.988, wgb = prof.windowGain * 0.94;
  const crr = 196, crg = 214, crb = 236;
  const fn = field.n;
  const useB = prof.useWinB;
  const inv = 2 / size;
  const sat = prof.sat;

  for (let py = 0; py < size; py += 1) {
    const y = (py + 0.5) * inv - 1;
    for (let px = 0; px < size; px += 1) {
      const i = py * size + px;
      const zz = z[i];
      if (zz < 0) continue;
      const x = (px + 0.5) * inv - 1;
      const rad = radial[i];
      const edgePx = (1 - rad) * (size / 2);
      const alpha = edgePx >= 1 ? 1 : edgePx <= 0 ? 0 : edgePx;
      if (alpha <= 0.001) continue;

      const ndlv = ndl[i];
      const lit = smoothstep(0.0, 0.92, ndlv);

      // --- body colour (faithful stone tone) ---
      const kk = rad < 0.05 ? 0 : rad > 0.6 ? 1 : (rad - 0.05) / 0.55;
      const k = kk * kk * (3 - 2 * kk);
      const tBody = 0.32 + 0.56 * k;
      let rr = b0r + (b1r - b0r) * tBody;
      let gg = b0g + (b1g - b0g) * tBody;
      let bb = b0b + (b1b - b0b) * tBody;
      const ek = rad < 0.76 ? 0 : rad > 1 ? 1 : (rad - 0.76) / 0.24;
      const edge = ek * ek * (3 - 2 * ek) * 0.66;
      rr += (b2r - rr) * edge;
      gg += (b2g - gg) * edge;
      bb += (b2b - bb) * edge;

      const shade = prof.ambient + prof.diffuse * ndlv;
      rr *= shade;
      gg *= shade;
      bb *= shade;

      // --- internal texture (smooth field, bilinear) ---
      if (fn) {
        const gx = (x + 1) * 0.5 * (fn - 1);
        const gy = (y + 1) * 0.5 * (fn - 1);
        const ix = gx | 0;
        const iy = gy | 0;
        const tx = gx - ix;
        const ty = gy - iy;
        const i00 = iy * fn + ix;
        const i10 = i00 + 1;
        const i01 = i00 + fn;
        const i11 = i01 + 1;
        const w00 = (1 - tx) * (1 - ty);
        const w10 = tx * (1 - ty);
        const w01 = (1 - tx) * ty;
        const w11 = tx * ty;
        const a = field.alpha[i00] * w00 + field.alpha[i10] * w10 + field.alpha[i01] * w01 + field.alpha[i11] * w11;
        if (a > 0.002) {
          const aa = a * (0.32 + 0.68 * lit);
          const o0 = i00 * 3;
          const o1 = i10 * 3;
          const o2 = i01 * 3;
          const o3 = i11 * 3;
          const cr = field.tint[o0] * w00 + field.tint[o1] * w10 + field.tint[o2] * w01 + field.tint[o3] * w11;
          const cg = field.tint[o0 + 1] * w00 + field.tint[o1 + 1] * w10 + field.tint[o2 + 1] * w01 + field.tint[o3 + 1] * w11;
          const cb = field.tint[o0 + 2] * w00 + field.tint[o1 + 2] * w10 + field.tint[o2 + 2] * w01 + field.tint[o3 + 2] * w11;
          rr += (cr - rr) * aa;
          gg += (cg - gg) * aa;
          bb += (cb - bb) * aa;
        }
      }

      // --- rutile needles (sharp, layered, lit side) ---
      if (tex.needles.length) {
        let needle = 0;
        let deepNeedle = 0;
        for (let ni = 0; ni < tex.needles.length; ni += 1) {
          const nd = tex.needles[ni];
          const along = nd.cs * x + nd.sn * y;
          const across = -nd.sn * x + nd.cs * y - nd.off;
          const tc = Math.abs(across) * nd.invW;
          if (tc >= 1) continue;
          const aa2 = along < 0 ? -along : along;
          if (aa2 > 1) continue;
          const line = (1 - tc) * (1 - tc);
          const fade = aa2 < 0.55 ? 1 : Math.max(0, 1 - (aa2 - 0.55) / 0.43);
          const gain = line * fade * nd.bright;
          if (nd.depth > 0.45) needle += gain;
          else deepNeedle += gain * 0.35;
        }
        const hair = (needle * (0.35 + 0.65 * lit) + deepNeedle * 0.35) * 0.55;
        if (hair > 0.002) {
          const hh = hair > 1 ? 1 : hair;
          rr += (238 - rr) * hh;
          gg += (206 - gg) * hh;
          bb += (118 - bb) * hh;
        }
      }

      // --- translucency (hue preserving) ---
      if (translucency) {
        const tv = y * 0.55 + 0.45;
        const trans = (tv < 0.05 ? 0 : tv > 1 ? 1 : tv) * (0.35 + 0.4 * zz);
        rr += tr * trans * 0.2;
        gg += tg * trans * 0.2;
        bb += tb * trans * 0.2;
      }

      // --- additive studio reflections (never grey the body) ---
      // environment reflection is drawn as crisp SVG overlay above the sprite

      // --- gentle soft specular (crisp highlight is SVG overlay) ---
      let softT = ndh[i] < 0.8 ? 0 : (ndh[i] > 1 ? 1 : (ndh[i] - 0.8) / 0.2);
      softT = softT * softT;
      const softLobe = softT * softT * prof.specGain * 0.1;
      const pdx = x - pointX;
      const pdy = y - pointY;
      const pd2 = (pdx * pdx + pdy * pdy) / pointRadius;
      const point = pd2 >= 1 ? 0 : (1 - pd2) * (1 - pd2) * (glassy ? 0.3 : 0.16);
      const spec = softLobe + point;
      if (spec > 0.002) {
        rr += 255 * spec;
        gg += 253 * spec;
        bb += 246 * spec;
      }

      // --- thin Fresnel rim on the shadow side ---
      const rim = fres[i] * shadow[i] * prof.rimGain * 0.4;
      if (rim > 0.002) {
        rr += crr * rim;
        gg += crg * rim;
        bb += crb * rim;
      }

      // --- AO + edge contact ---
      const aov = y < 0.2 ? 0 : y > 1.05 ? 1 : (y - 0.2) / 0.85;
      const ao = aov * aov * (3 - 2 * aov) * (0.14 * (1 - zz));
      const ed = rad < 0.9 ? 0 : (rad - 0.9) / 0.1;
      const dim = (1 - ao) * (1 - ed * 0.08);
      rr *= dim;
      gg *= dim;
      bb *= dim;

      // --- saturation keeps the stone colour; grain breaks smoothness ---
      const lum2 = rr * 0.299 + gg * 0.587 + bb * 0.114;
      rr = lum2 + (rr - lum2) * sat;
      gg = lum2 + (gg - lum2) * sat;
      bb = lum2 + (bb - lum2) * sat;
      const grain = (hash2(px, py, 7) - 0.5) * 2.4 + (variant === 'a' ? -0.8 : 1.1);
      rr += grain;
      gg += grain;
      bb += grain;

      const o = i * 4;
      data[o] = rr < 0 ? 0 : rr > 255 ? 255 : rr;
      data[o + 1] = gg < 0 ? 0 : gg > 255 ? 255 : gg;
      data[o + 2] = bb < 0 ? 0 : bb > 255 ? 255 : bb;
      data[o + 3] = (alpha * 255) | 0;
    }
  }

  ctx.putImageData(img, 0, 0);
  const ms = performance.now() - t0;
  STATS.generated += 1;
  STATS.lastMs = ms;
  STATS.totalMs += ms;
  return canvas;
}

/* ---------------- public API ---------------- */

export function paletteKey(pal) {
  return `${pal.hex}|${pal.hex2}|${pal.hex3}|${pal.texture}|${pal.id}`;
}

export function beadSpriteUrl(pal, variant = 'a', size = SIZE) {
  if (typeof document === 'undefined') return null;
  const key = `${paletteKey(pal)}|${size}`;
  if (CACHE.has(key)) return CACHE.get(key);
  let url = null;
  try {
    const canvas = renderSprite(pal, variant, size);
    url = canvas.toDataURL('image/png');
  } catch (err) {
    url = null;
  }
  CACHE.set(key, url);
  return url;
}

export function paintBeadSprite(canvas, pal, variant = 'a', size = SIZE) {
  const sprite = renderSprite(pal, variant, size);
  canvas.width = size;
  canvas.height = size;
  canvas.getContext('2d').drawImage(sprite, 0, 0);
  return canvas;
}

export function spriteStats() {
  return { ...STATS, cached: CACHE.size };
}
