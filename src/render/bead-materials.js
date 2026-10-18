/**
 * ZHUSHENG / 珠生 — bead & metal material library (renderer v2).
 *
 * Every palette's bead artwork is painted once into <defs> (two deterministic
 * variants A/B) and referenced per bead with <use>, which frees the SVG node
 * budget for material layers instead of duplicated per-bead elements.
 *
 * Material model (unit space, bead radius = 1, key light from upper-left):
 *   body           radial gradient — colour stays saturated through the middle
 *   texture        interior texture, masked so it fades on the lit side
 *   internal glow  light diffusing through translucent stones
 *   transmission   bright bounce at the lower edge (light through the stone)
 *   ambient occlusion / edge saturation (darker, saturated rim)
 *   fresnel rim    thin bright arc on the shadow side (right/bottom)
 *   softbox        large, soft window reflection (low contrast)
 *   point light    small, sharp specular
 *   variant tint   +-3% brightness / hue shift so beads are not clones
 *
 * Imported by src/render/bracelet.js only.
 */

/* ---------------- colour helpers ---------------- */

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

function luminance(c) {
  const [r, g, b] = rgbOf(c).map((v) => v / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const f = (n) => String(Math.round(n * 1000) / 1000);

/* ---------------- defs helpers ---------------- */

function stops(list) {
  return list
    .map(([offset, color, opacity]) => `<stop offset="${offset}" stop-color="${color}"${opacity == null ? '' : ` stop-opacity="${opacity}"`}/>`)
    .join('');
}

const radialGrad = (id, attrs, list) => `<radialGradient id="${id}" ${attrs}>${stops(list)}</radialGradient>`;
const linearGrad = (id, attrs, list) => `<linearGradient id="${id}" ${attrs}>${stops(list)}</linearGradient>`;

/* ---------------- ids ---------------- */

export function beadArtId(prefix, palId, variant) {
  return `${prefix}bead-${palId}-${variant}`;
}

export function spacerArtId(prefix, metal, variant) {
  return `${prefix}spacer-${metal}-${variant}`;
}

/* ---------------- deterministic texture helpers ---------------- */

function rutilatedNeedles(color, count, seedShift, width, opacity, blur) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const t = (i + seedShift * 0.37) / count;
    const deg = 8 + t * 344 + ((i * 37) % 11) * 1.7;
    const a = (deg * Math.PI) / 180;
    const r0 = 0.1 + ((i * 53) % 17) / 100;
    const r1 = 0.9 - ((i * 29) % 15) / 100;
    const bend = ((i % 2 ? 1 : -1) * (0.1 + ((i * 13) % 7) / 60));
    const mid = r0 + (r1 - r0) * 0.55;
    const x0 = Math.cos(a) * r0;
    const y0 = Math.sin(a) * r0;
    const x1 = Math.cos(a + bend * 0.5) * mid;
    const y1 = Math.sin(a + bend * 0.5) * mid;
    const x2 = Math.cos(a + bend) * r1;
    const y2 = Math.sin(a + bend) * r1;
    const w = width * (0.7 + ((i * 23) % 9) / 12);
    const op = opacity * (0.6 + ((i * 19) % 7) / 10);
    out.push(`<path d="M${f(x0)} ${f(y0)} Q${f(x1)} ${f(y1)} ${f(x2)} ${f(y2)}" stroke-width="${f(w)}" opacity="${f(op)}"/>`);
  }
  return `<g fill="none" stroke="${color}" stroke-linecap="round"${blur ? ` filter="url(#${blur})"` : ''}>${out.join('')}</g>`;
}

function inclusionSpecks(color) {
  const pts = [
    [-0.42, -0.3, 0.05],
    [-0.2, -0.52, 0.032],
    [0.28, -0.1, 0.055],
    [0.4, 0.32, 0.038],
    [-0.5, 0.24, 0.032],
    [0.06, 0.42, 0.042],
    [0.14, 0.05, 0.022],
    [-0.68, -0.02, 0.024],
    [0.5, -0.44, 0.02],
  ];
  return pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" opacity=".5"/>`).join('');
}

/* ---------------- texture groups (one per palette, lighting-masked) ---------------- */

function textureGroup(p, pal) {
  const id = `${p}tex-${pal.id}`;
  const clip = `url(#${p}matclip)`;
  const mask = `url(#${p}texmask)`;
  const soft = `url(#${p}matsoft)`;
  const blur = `${p}matblur`;
  const white = `url(#${p}matwhite)`;
  const cloud = `url(#${p}matcloud)`;
  const cat = `url(#${p}matcat)`;
  const iriA = `url(#${p}matiriA)`;
  const iriB = `url(#${p}matiriB)`;

  const open = `<g id="${id}" clip-path="${clip}" mask="${mask}" filter="${soft}">`;
  const close = '</g>';

  switch (pal.texture) {
    case 'vein':
      return `${open}
        <ellipse cx="-0.18" cy="-0.05" rx="0.74" ry="0.52" fill="${cloud}" opacity=".8" transform="rotate(-18)"/>
        <ellipse cx="0.32" cy="0.3" rx="0.48" ry="0.3" fill="${cloud}" opacity=".55" transform="rotate(12)"/>
        <ellipse cx="-0.4" cy="0.36" rx="0.34" ry="0.2" fill="${cloud}" opacity=".4" transform="rotate(-6)"/>
        <g fill="none" stroke="#ffffff" stroke-linecap="round">
          <path d="M-0.88 -0.28 C -0.6 -0.4, -0.38 -0.22, -0.14 -0.14 C 0.12 -0.05, 0.4 0.04, 0.68 0.32" stroke-width="0.06" opacity=".4"/>
          <path d="M-0.6 0.52 C -0.32 0.42, -0.04 0.46, 0.22 0.64" stroke-width="0.045" opacity=".24"/>
          <path d="M0.2 -0.52 C 0.36 -0.3, 0.54 -0.22, 0.78 -0.2" stroke-width="0.04" opacity=".22"/>
        </g>
        <g fill="none" stroke="${pal.hex3}" stroke-linecap="round">
          <path d="M-0.9 0.14 C -0.66 0.08, -0.5 0.16, -0.34 0.3" stroke-width="0.03" opacity=".22"/>
          <path d="M-0.2 0.64 C 0.12 0.55, 0.34 0.62, 0.52 0.78" stroke-width="0.026" opacity=".2"/>
          <path d="M0.36 -0.66 C 0.5 -0.44, 0.66 -0.34, 0.86 -0.32" stroke-width="0.022" opacity=".18"/>
        </g>
      ${close}`;

    case 'rutilated':
      return `${open}
        <ellipse cx="0.22" cy="0.28" rx="0.44" ry="0.26" fill="${cloud}" opacity=".32"/>
        ${rutilatedNeedles('#B08A4F', 10, 2, 0.08, 0.5, blur)}
        ${rutilatedNeedles('#E8CC8C', 20, 5, 0.032, 0.9, null)}
        ${rutilatedNeedles('#FBF0CB', 10, 9, 0.016, 0.75, null)}
        ${rutilatedNeedles('#79592F', 6, 13, 0.02, 0.4, null)}
      ${close}`;

    case 'phantom':
      return `${open}
        <ellipse cx="-0.06" cy="-0.18" rx="0.7" ry="0.48" fill="${cloud}" opacity=".72" transform="rotate(-12)"/>
        <path d="M-0.62 0.16 L-0.2 -0.42 L0.26 -0.06 L0.66 0.42 L0.18 0.7 L-0.4 0.6 Z" fill="${pal.hex3}" opacity=".3" filter="url(#${blur})"/>
        <path d="M-0.44 0.1 L-0.16 -0.3 L0.14 0.0 L0.4 0.3 L0.1 0.48 L-0.26 0.4 Z" fill="${lighten(pal.hex2, 0.1)}" opacity=".3" filter="url(#${blur})"/>
        <ellipse cx="0.24" cy="0.3" rx="0.42" ry="0.2" fill="${cloud}" opacity=".4"/>
        <path d="M-0.16 -0.62 L0.02 -0.8 L0.14 -0.44 Z" fill="#ffffff" opacity=".18"/>
      ${close}`;

    case 'catseye':
      return `${open}
        <ellipse cx="0" cy="-0.08" rx="0.92" ry="0.3" fill="${cat}" transform="rotate(-24)" opacity=".7"/>
        <ellipse cx="0" cy="-0.04" rx="0.8" ry="0.11" fill="${cat}" transform="rotate(-24)"/>
        <ellipse cx="0" cy="-0.02" rx="0.56" ry="0.038" fill="#ffffff" opacity=".85" transform="rotate(-24)"/>
        <ellipse cx="0.12" cy="0.3" rx="0.58" ry="0.08" fill="${cat}" transform="rotate(-24)" opacity=".3"/>
      ${close}`;

    case 'iridescent':
      return `${open}
        <g style="mix-blend-mode:screen">
          <ellipse cx="-0.1" cy="-0.18" rx="0.86" ry="0.23" fill="${iriA}" transform="rotate(-28)" opacity=".6"/>
          <ellipse cx="0.04" cy="0.04" rx="0.78" ry="0.13" fill="${iriA}" transform="rotate(-28)" opacity=".44"/>
          <ellipse cx="-0.12" cy="0.32" rx="0.62" ry="0.15" fill="${iriB}" transform="rotate(-24)" opacity=".42"/>
        </g>
      ${close}`;

    case 'inclusion':
      return `${open}
        <ellipse cx="0.08" cy="0.18" rx="0.52" ry="0.36" fill="${cloud}" opacity=".42"/>
        ${inclusionSpecks(pal.hex3)}
      ${close}`;

    default:
      return '';
  }
}

/* ---------------- bead artwork (3 deterministic variants per palette) ---------------- */

function variantSpec(variant) {
  if (variant === 'b') {
    return { wx: -0.68, wy: -0.6, ww: 0.5, wh: 0.32, wrot: -16, px: -0.36, py: -0.44, pw: 0.075, ph: 0.038, prot: -24, lift: 0.03, tint: [255, 238, 218], tintAmt: 0.05 };
  }
  if (variant === 'c') {
    return { wx: -0.72, wy: -0.64, ww: 0.42, wh: 0.27, wrot: -26, px: -0.42, py: -0.46, pw: 0.068, ph: 0.034, prot: -34, lift: -0.025, tint: [226, 236, 255], tintAmt: 0.045 };
  }
  return { wx: -0.74, wy: -0.64, ww: 0.54, wh: 0.35, wrot: -25, px: -0.4, py: -0.46, pw: 0.085, ph: 0.042, prot: -29, lift: 0, tint: [255, 255, 255], tintAmt: 0 };
}

function beadVariant(p, pal, variant) {
  const id = beadArtId(p, pal.id, variant);
  const spec = variantSpec(variant);
  const lum = luminance(pal.hex);
  const glassy = lum < 0.3;
  const deep = lum < 0.46;
  const tex = pal.texture && pal.texture !== 'none' ? `<use href="#${p}tex-${pal.id}" xlink:href="#${p}tex-${pal.id}"/>` : '';

  // window-shaped softbox reflection: small rounded rect ~12-15% of the bead face
  const win = `<rect x="${spec.wx}" y="${spec.wy}" width="${spec.ww}" height="${spec.wh}" rx="0.1" fill="url(#${p}matwin)" transform="rotate(${spec.wrot})" filter="url(#${p}matsoft)"/>`;
  // clean 1-2px catchlight (single crisp glint keeps the SVG node budget)
  const point = `<ellipse cx="${f(spec.px + spec.pw / 2)}" cy="${f(spec.py + spec.ph / 2)}" rx="${f(spec.pw * 0.72)}" ry="${f(spec.ph * 0.9)}" fill="url(#${p}matpoint)" transform="rotate(${spec.prot} ${f(spec.px + spec.pw / 2)} ${f(spec.py + spec.ph / 2)})"/>`;
  // short Fresnel edge light, lower-right only
  const fresnel = `<path d="M 0.965 0.25 A 0.985 0.985 0 0 1 0.5 0.85" fill="none" stroke="url(#${p}matfres)" stroke-width="0.05" opacity=".85"/>`;
  const contact = `<path d="M -0.62 0.72 A 0.96 0.96 0 0 0 0.62 0.72" fill="none" stroke="rgba(26,18,12,.2)" stroke-width="0.1" filter="url(#${p}matsoft)"/>`;
  // saturated (not lightened) rim
  const satEdge = `<circle r="0.984" fill="none" stroke="${pal.hex3}" stroke-opacity=".3" stroke-width="0.045"/>`;

  const inner = glassy
    ? `<ellipse cx="0.08" cy="0.62" rx="0.88" ry="0.3" fill="url(#${p}matglass)"/>`
    : `<ellipse cx="0.08" cy="0.14" rx="0.64" ry="0.52" fill="url(#${p}matglow)" opacity=".6"/>
       <ellipse cx="0.12" cy="0.6" rx="0.54" ry="0.3" fill="url(#${p}matglow)" opacity=".5"/>`;

  const fire = deep && !glassy
    ? `<g filter="url(#${p}matsoft)" opacity=".8">
         <ellipse cx="-0.16" cy="0.16" rx="0.13" ry="0.07" fill="#FFD9A0" opacity=".32" transform="rotate(-24)"/>
         <ellipse cx="0.2" cy="0.34" rx="0.09" ry="0.05" fill="#FFE6BE" opacity=".26" transform="rotate(18)"/>
       </g>`
    : '';

  const lift = Math.abs(spec.lift) > 0.001
    ? `<circle r="1" fill="${spec.lift > 0 ? '#ffffff' : '#000000'}" opacity="${Math.abs(spec.lift).toFixed(3)}"/>`
    : '';
  const tint = spec.tintAmt
    ? `<circle r="1" fill="${hexOf(spec.tint[0], spec.tint[1], spec.tint[2])}" opacity="${spec.tintAmt}"/>`
    : '';

  return `<g id="${id}">
    <circle r="1" fill="url(#${p}body-${pal.id})"/>
    ${tex}
    ${inner}
    ${fire}
    <circle r="1" fill="url(#${p}matao)"/>
    ${satEdge}
    ${contact}
    <use href="#${p}matrefl" xlink:href="#${p}matrefl"/>
    ${fresnel}
    ${win}
    ${point}
    ${lift}
    ${tint}
  </g>`;
}

/* ---------------- public: full material defs ---------------- */

export function buildBeadMaterialDefs(prefix, palettes) {
  const p = prefix;
  const out = [];

  out.push(`<clipPath id="${p}matclip"><circle cx="0" cy="0" r="1"/></clipPath>`);
  out.push(`<filter id="${p}matsoft" x="-40%" y="-40%" width="180%" height="180%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="0.032"/></filter>`);
  out.push(`<filter id="${p}matblur" x="-45%" y="-45%" width="190%" height="190%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="0.14"/></filter>`);
  out.push(`<mask id="${p}texmask" maskUnits="userSpaceOnUse" x="-1.2" y="-1.2" width="2.4" height="2.4"><rect x="-1.2" y="-1.2" width="2.4" height="2.4" fill="url(#${p}matmaskg)"/></mask>`);
  out.push(
    linearGrad(`${p}matmaskg`, 'x1="0" y1="0" x2="0.85" y2="1"', [
      ['0', '#FFFFFF'],
      ['0.34', '#F0F0F0'],
      ['0.68', '#8A8A8A'],
      ['1', '#1E1E1E'],
    ]),
  );
  out.push(radialGrad(`${p}matwhite`, 'cx="50%" cy="50%" r="50%"', [['0', '#ffffff', 0.55], ['0.55', '#ffffff', 0.22], ['1', '#ffffff', 0]]));
  out.push(radialGrad(`${p}matcloud`, 'cx="50%" cy="50%" r="50%"', [['0', '#ffffff', 0.6], ['0.55', '#ffffff', 0.24], ['1', '#ffffff', 0]]));
  out.push(
    linearGrad(`${p}matwin`, 'x1="0.05" y1="0" x2="0.8" y2="0.9"', [
      ['0', '#FFFFFF', 0.82],
      ['0.55', '#FFFDF7', 0.64],
      ['1', '#FFF9EC', 0.38],
    ]),
  );
  out.push(`<filter id="${p}matpt" x="-80%" y="-80%" width="260%" height="260%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="0.008"/></filter>`);
  out.push(radialGrad(`${p}matpoint`, 'cx="50%" cy="50%" r="50%"', [['0', '#ffffff', 1], ['0.34', '#ffffff', 0.96], ['0.68', '#ffffff', 0.4], ['1', '#ffffff', 0]]));
  out.push(radialGrad(`${p}matglow`, 'cx="50%" cy="50%" r="50%"', [['0', '#ffffff', 0.3], ['0.55', '#ffffff', 0.12], ['1', '#ffffff', 0]]));
  out.push(linearGrad(`${p}matglass`, 'x1="0" y1="0" x2="0.15" y2="1"', [['0', '#ffffff', 0], ['0.55', '#ffffff', 0.02], ['1', '#ffffff', 0.16]]));
  out.push(linearGrad(`${p}matao`, 'x1="0" y1="0" x2="0.12" y2="1"', [['0', 'rgba(18,12,8,0)'], ['0.58', 'rgba(18,12,8,0)'], ['0.86', 'rgba(18,12,8,0.16)'], ['1', 'rgba(18,12,8,0.4)']]));
  out.push(linearGrad(`${p}matfres`, 'x1="0.12" y1="0" x2="0.88" y2="1"', [['0', '#ffffff', 0], ['0.55', '#ffffff', 0], ['0.8', '#ffffff', 0.22], ['1', '#ffffff', 0.62]]));
  // studio reflected environment: dark floor/ceiling zone + warm bounce from the paper tray
  out.push(radialGrad(`${p}matdark`, 'cx="50%" cy="50%" r="58%"', [['0', '#1A120C', 0.34], ['0.55', '#1A120C', 0.18], ['1', '#1A120C', 0]]));
  out.push(radialGrad(`${p}matbounce`, 'cx="50%" cy="50%" r="55%"', [['0', '#FFF7E6', 0.32], ['0.6', '#FFF7E6', 0.12], ['1', '#FFF7E6', 0]]));
  out.push(`<g id="${p}matrefl" clip-path="url(#${p}matclip)" aria-hidden="true">
    <ellipse cx="0.46" cy="0.3" rx="0.66" ry="0.62" fill="url(#${p}matdark)" transform="rotate(-34 0.46 0.3)"/>
    <ellipse cx="0.02" cy="0.88" rx="0.82" ry="0.2" fill="url(#${p}matbounce)"/>
  </g>`);

  const usesCat = palettes.some((pal) => pal.texture === 'catseye');
  const usesIri = palettes.some((pal) => pal.texture === 'iridescent');
  if (usesCat) {
    out.push(linearGrad(`${p}matcat`, 'x1="0" y1="0" x2="0" y2="1"', [['0', '#ffffff', 0], ['0.4', '#ffffff', 0.5], ['0.54', '#ffffff', 0.85], ['1', '#ffffff', 0]]));
  }
  if (usesIri) {
    out.push(
      linearGrad(`${p}matiriA`, 'x1="0" y1="0" x2="1" y2="1"', [
        ['0', '#A9C8F0', 0],
        ['0.26', '#A9C8F0', 0.5],
        ['0.54', '#F3C6DC', 0.42],
        ['0.8', '#BFE8D2', 0.34],
        ['1', '#A9C8F0', 0],
      ]),
    );
    out.push(
      linearGrad(`${p}matiriB`, 'x1="1" y1="0" x2="0" y2="1"', [
        ['0', '#F6D6C0', 0],
        ['0.34', '#F6D6C0', 0.32],
        ['0.62', '#C9D8F2', 0.34],
        ['0.86', '#D9F0DA', 0.24],
        ['1', '#F6D6C0', 0],
      ]),
    );
  }

  for (const pal of palettes) {
    const id = pal.id;
    const mid = mix(pal.hex, pal.hex2, 0.55);
    out.push(
      radialGrad(
        `${p}body-${id}`,
        'cx="30%" cy="23%" r="76%"',
        [
          ['0', lighten(pal.hex2, 0.12)],
          ['0.08', pal.hex2],
          ['0.3', mix(pal.hex, pal.hex2, 0.42)],
          ['0.56', pal.hex],
          ['0.78', pal.hex3],
          ['0.9', darken(pal.hex3, 0.2)],
          ['1', darken(pal.hex3, 0.55)],
        ],
      ),
    );
    out.push(textureGroup(p, pal));
    out.push(beadVariant(p, pal, 'a'));
    out.push(beadVariant(p, pal, 'b'));
  }

  return out.join('');
}

/* ---------------- turned-metal spacer artwork ---------------- */

export function spacerMaterialDefs(prefix, metals) {
  const p = prefix;
  const out = [];
  const palette = {
    silver: { light: '#FFFFFF', soft: '#F4F6F6', mid: '#C7CBCD', dark: '#9AA0A3', deep: '#6E7478', warm: '#DCE0DF' },
    gold: { light: '#FFF8E8', soft: '#F4E7C8', mid: '#D2B988', dark: '#A9864B', deep: '#7A5F33', warm: '#E8D6A8' },
  };

  for (const metal of metals) {
    const m = palette[metal] || palette.silver;
    out.push(
      radialGrad(
        `${p}sbody-${metal}`,
        'cx="34%" cy="24%" r="78%"',
        [
          ['0', m.light],
          ['0.16', m.soft],
          ['0.42', m.mid],
          ['0.68', m.dark],
          ['0.88', m.deep],
          ['1', darken(m.deep, 0.18)],
        ],
      ),
    );
    out.push(
      linearGrad(`${p}sgrain-${metal}`, 'x1="0" y1="0" x2="1" y2="0.2"', [
        ['0', m.deep, 0.5],
        ['0.16', m.light, 0.85],
        ['0.42', m.mid, 0.2],
        ['0.62', m.light, 0.55],
        ['0.9', m.deep, 0.45],
        ['1', darken(m.deep, 0.2), 0.6],
      ]),
    );
    out.push(
      radialGrad(`${p}sgloss-${metal}`, 'cx="50%" cy="50%" r="50%"', [
        ['0', '#ffffff', 0.95],
        ['0.5', '#ffffff', 0.4],
        ['1', '#ffffff', 0],
      ]),
    );
    out.push(
      linearGrad(`${p}srim-${metal}`, 'x1="0.05" y1="0" x2="0.85" y2="1"', [
        ['0', m.light, 0.9],
        ['0.3', m.mid, 0.3],
        ['0.7', m.dark, 0.45],
        ['1', m.deep, 0.85],
      ]),
    );
    const deep = m.deep;

    for (const variant of ['a', 'b']) {
      const id = spacerArtId(p, metal, variant);
      const A = variant === 'a';
      const gx = A ? -0.22 : -0.16;
      const gy = A ? -0.24 : -0.18;
      out.push(`<g id="${id}">
        <ellipse rx="0.82" ry="1.02" fill="url(#${p}sbody-${metal})" stroke="url(#${p}srim-${metal})" stroke-width="0.045"/>
        <ellipse rx="0.54" ry="0.98" fill="url(#${p}sgrain-${metal})" opacity=".32"/>
        <path d="M-0.44 -0.78 C -0.1 -0.92, 0.1 -0.92, 0.44 -0.78" stroke="${alpha(deep, 0.5)}" stroke-width="0.045" fill="none"/>
        <path d="M-0.44 0.78 C -0.1 0.92, 0.1 0.92, 0.44 0.78" stroke="${alpha(deep, 0.45)}" stroke-width="0.045" fill="none"/>
        <path d="M-0.58 -0.7 C -0.74 -0.26, -0.74 0.26, -0.58 0.7" stroke="rgba(255,255,255,.55)" stroke-width="0.075" fill="none" stroke-linecap="round"/>
        <ellipse cx="${gx}" cy="${gy}" rx="0.15" ry="${A ? 0.5 : 0.42}" fill="url(#${p}sgloss-${metal})" opacity=".9"/>
        <ellipse cx="0.24" cy="0.5" rx="0.42" ry="0.3" fill="${alpha(deep, 0.35)}"/>
        ${A ? '' : `<ellipse cx="0.18" cy="-0.46" rx="0.12" ry="0.22" fill="url(#${p}sgloss-${metal})" opacity=".5"/>`}
        <ellipse rx="0.82" ry="1.02" fill="none" stroke="${alpha(deep, 0.35)}" stroke-width="0.02"/>
      </g>`);
    }
  }

  return out.join('');
}

/** Global defs for the crisp SVG highlight overlay drawn above each sprite. */
export function spriteOverlayDefs(prefix) {
  const p = prefix;
  return [
    `<clipPath id="${p}ovclip" clipPathUnits="userSpaceOnUse"><circle cx="0" cy="0" r="1"/></clipPath>`,
    linearGrad(`${p}ovwin`, 'x1="0.1" y1="0" x2="0.7" y2="1"', [
      ['0', '#FFFEF9', 0.88],
      ['0.4', '#FFF8E8', 0.6],
      ['0.74', '#FFEED6', 0.22],
      ['1', '#ffffff', 0],
    ]),
    radialGrad(`${p}ovpt`, 'cx="50%" cy="50%" r="50%"', [
      ['0', '#ffffff', 1],
      ['0.55', '#FFFDF6', 0.85],
      ['1', '#ffffff', 0],
    ]),
    linearGrad(`${p}ovfres`, 'x1="0" y1="0" x2="1" y2="0.6"', [
      ['0', '#ffffff', 0],
      ['0.55', '#DDE8F5', 0.2],
      ['0.85', '#EAF2FA', 0.42],
      ['1', '#ffffff', 0.5],
    ]),
    `<filter id="${p}ovblur" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="0.05"/></filter>`,
  ].join('');
}
