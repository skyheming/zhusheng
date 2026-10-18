/**
 * Experimental WebGL bracelet preview (Three.js + HDRI).
 * Goal: compare real environment reflections / refraction against the SVG preview.
 * Not wired into the production UI yet.
 */
import * as THREE from '../../assets/vendor/three.module.js';
import { RGBELoader } from '../../assets/vendor/RGBELoader.js';

const HDRI_URL = new URL('../../assets/hdri/monochrome_studio_02_1k.hdr', import.meta.url).href;

const DEG = Math.PI / 180;

function lum(hex) {
  const h = String(hex || '#888888').replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function newCanvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function makeNormalFromHeight(heightCanvas, size, strength) {
  const src = heightCanvas.getContext('2d').getImageData(0, 0, size, size).data;
  const out = newCanvas(size);
  const ctx = out.getContext('2d');
  const img = ctx.createImageData(size, size);
  const hAt = (x, y) => src[((Math.min(size - 1, Math.max(0, y)) * size) + Math.min(size - 1, Math.max(0, x))) * 4] / 255;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (hAt(x + 1, y) - hAt(x - 1, y)) * strength;
      const dy = (hAt(x, y + 1) - hAt(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = (1 / len) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

/** 逐石生成 color / roughness / normal / emissive 四张贴图（确定性）。 */
function makeMaps(item) {
  const S = 512;
  const rnd = rng(hashSeed(`${item.crystalId || item.zh || 'crystal'}`));
  const tex = item.texture || 'none';
  const l = lum(item.hex);
  const dark = l < 0.22;
  const red = /garnet|ruby|red/.test(String(item.crystalId || '')) || (hue(item.hex) > 330 && l < 0.42);
  const milky = !dark && !red && l > 0.38;

  const color = newCanvas(S);
  const cc = color.getContext('2d');
  cc.fillStyle = item.hex || '#cccccc';
  cc.fillRect(0, 0, S, S);
  const height = newCanvas(S);
  const hc = height.getContext('2d');
  hc.fillStyle = '#808080';
  hc.fillRect(0, 0, S, S);
  const rough = newCanvas(S);
  const rc = rough.getContext('2d');
  rc.fillStyle = milky ? '#666666' : red ? '#2c2c2c' : '#1c1c1c';
  rc.fillRect(0, 0, S, S);
  const emit = newCanvas(S);
  const ec = emit.getContext('2d');
  ec.fillStyle = '#000000';
  ec.fillRect(0, 0, S, S);

  const tint = item.hex2 || item.hex;
  const deep = item.hex3 || item.hex;
  for (let i = 0; i < 24; i += 1) {
    const x = rnd() * S;
    const y = rnd() * S;
    const r = 30 + rnd() * 130;
    const g = cc.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `${tint}${milky ? '66' : '33'}`);
    g.addColorStop(1, `${tint}00`);
    cc.fillStyle = g;
    cc.beginPath();
    cc.arc(x, y, r, 0, Math.PI * 2);
    cc.fill();
    // cloud height + roughness variation
    const hg = hc.createRadialGradient(x, y, 0, x, y, r);
    hg.addColorStop(0, `rgba(255,255,255,${0.15 + rnd() * 0.2})`);
    hg.addColorStop(1, 'rgba(255,255,255,0)');
    hc.fillStyle = hg;
    hc.beginPath();
    hc.arc(x, y, r, 0, Math.PI * 2);
    hc.fill();
    const rg = rc.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, milky ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.2)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    rc.fillStyle = rg;
    rc.beginPath();
    rc.arc(x, y, r, 0, Math.PI * 2);
    rc.fill();
  }

  cc.lineCap = hc.lineCap = 'round';
  if (tex === 'rutilated') {
    for (let i = 0; i < 55; i += 1) {
      const a = rnd() * Math.PI * 2;
      const len = 16 + rnd() * 90;
      const x = rnd() * S;
      const y = rnd() * S;
      const x2 = x + Math.cos(a) * len;
      const y2 = y + Math.sin(a) * len;
      cc.strokeStyle = `rgba(236,196,112,${0.2 + rnd() * 0.45})`;
      cc.lineWidth = 0.5 + rnd() * 1.2;
      cc.beginPath();
      cc.moveTo(x, y);
      cc.lineTo(x2, y2);
      cc.stroke();
      hc.strokeStyle = `rgba(255,255,255,${0.3 + rnd() * 0.4})`;
      hc.lineWidth = 0.8 + rnd();
      hc.beginPath();
      hc.moveTo(x, y);
      hc.lineTo(x2, y2);
      hc.stroke();
    }
  } else if (tex === 'vein') {
    for (let i = 0; i < 14; i += 1) {
      const y = rnd() * S;
      cc.strokeStyle = `rgba(255,255,255,${0.05 + rnd() * 0.13})`;
      cc.lineWidth = 1 + rnd() * 5;
      cc.beginPath();
      cc.moveTo(0, y);
      cc.bezierCurveTo(S * 0.3, y + 40, S * 0.6, y - 50, S, y + 20);
      cc.stroke();
      hc.strokeStyle = `rgba(255,255,255,${0.18 + rnd() * 0.2})`;
      hc.lineWidth = 2 + rnd() * 5;
      hc.beginPath();
      hc.moveTo(0, y);
      hc.bezierCurveTo(S * 0.3, y + 40, S * 0.6, y - 50, S, y + 20);
      hc.stroke();
    }
  } else if (tex === 'phantom') {
    for (let i = 0; i < 7; i += 1) {
      const x = rnd() * S;
      const y = rnd() * S;
      const rx = 70 + rnd() * 120;
      const ry = 24 + rnd() * 50;
      cc.fillStyle = `rgba(255,255,255,${0.05 + rnd() * 0.12})`;
      cc.beginPath();
      cc.ellipse(x, y, rx, ry, rnd() * Math.PI, 0, Math.PI * 2);
      cc.fill();
      hc.fillStyle = `rgba(255,255,255,${0.2 + rnd() * 0.2})`;
      hc.beginPath();
      hc.ellipse(x, y, rx, ry, rnd() * Math.PI, 0, Math.PI * 2);
      hc.fill();
    }
  } else if (tex === 'iridescent') {
    const g = cc.createLinearGradient(0, 0, S, S);
    g.addColorStop(0, 'rgba(160,200,255,0)');
    g.addColorStop(0.35, 'rgba(180,205,255,0.16)');
    g.addColorStop(0.55, 'rgba(255,200,225,0.12)');
    g.addColorStop(0.8, 'rgba(190,240,215,0.1)');
    g.addColorStop(1, 'rgba(160,200,255,0)');
    cc.fillStyle = g;
    cc.fillRect(0, 0, S, S);
  } else if (tex === 'catseye') {
    const g = hc.createLinearGradient(0, S * 0.35, 0, S * 0.65);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    hc.fillStyle = g;
    hc.fillRect(0, S * 0.35, S, S * 0.3);
  } else if (tex === 'inclusion') {
    for (let i = 0; i < 50; i += 1) {
      const x = rnd() * S;
      const y = rnd() * S;
      const r = 1 + rnd() * 4;
      cc.fillStyle = `rgba(24,28,26,${0.08 + rnd() * 0.18})`;
      cc.beginPath();
      cc.arc(x, y, r, 0, Math.PI * 2);
      cc.fill();
      hc.fillStyle = `rgba(0,0,0,${0.18 + rnd() * 0.25})`;
      hc.beginPath();
      hc.arc(x, y, r, 0, Math.PI * 2);
      hc.fill();
      rc.fillStyle = 'rgba(255,255,255,.35)';
      rc.beginPath();
      rc.arc(x, y, r * 2, 0, Math.PI * 2);
      rc.fill();
    }
  }

  // garnet internal fire / obsidian warm glow
  if (red) {
    for (let i = 0; i < 40; i += 1) {
      const x = rnd() * S;
      const y = rnd() * S;
      const r = 1 + rnd() * 3;
      const g = ec.createRadialGradient(x, y, 0, x, y, r * 4);
      g.addColorStop(0, `rgba(255,120,70,${0.5 + rnd() * 0.4})`);
      g.addColorStop(1, 'rgba(255,80,40,0)');
      ec.fillStyle = g;
      ec.beginPath();
      ec.arc(x, y, r * 4, 0, Math.PI * 2);
      ec.fill();
    }
  } else if (dark) {
    for (let i = 0; i < 8; i += 1) {
      const x = rnd() * S;
      const y = S * 0.2 + rnd() * S * 0.6;
      const g = ec.createLinearGradient(x - 40, y - 120, x + 40, y + 120);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.5, `rgba(120,72,32,${0.18 + rnd() * 0.18})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ec.strokeStyle = g;
      ec.lineWidth = 3 + rnd() * 9;
      ec.beginPath();
      ec.moveTo(x - 40, y - 120);
      ec.lineTo(x + 40, y + 120);
      ec.stroke();
    }
  }

  const map = new THREE.CanvasTexture(color);
  map.colorSpace = THREE.SRGBColorSpace;
  const roughnessMap = new THREE.CanvasTexture(rough);
  roughnessMap.colorSpace = THREE.NoColorSpace;
  const normalMap = new THREE.CanvasTexture(makeNormalFromHeight(height, S, milky ? 1.1 : 2.2));
  normalMap.colorSpace = THREE.NoColorSpace;
  const emissiveMap = new THREE.CanvasTexture(emit);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  for (const t of [map, roughnessMap, normalMap, emissiveMap]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 1);
    t.anisotropy = 4;
  }
  return { map, roughnessMap, normalMap, emissiveMap, milky, red, dark };
}

let sharedNoise = null;
function noiseTexture() {
  if (sharedNoise) return sharedNoise;
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  let seed = 7;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < size * size; i += 1) {
    const v = 118 + Math.floor(rnd() * 70);
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  // a few larger blotches for natural irregularity
  for (let i = 0; i < 30; i += 1) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = 10 + rnd() * 60;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,.16)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  sharedNoise = new THREE.CanvasTexture(c);
  sharedNoise.wrapS = sharedNoise.wrapT = THREE.RepeatWrapping;
  sharedNoise.repeat.set(3, 2);
  return sharedNoise;
}

function materialFor(item) {
  const id = String(item.crystalId || '');
  const l = lum(item.hex);
  const maps = makeMaps(item);
  const { milky, red, dark } = maps;
  const trans = milky ? 0.35 : red ? 0.1 : 0.03;
  const clearcoat = milky ? 0.18 : red ? 0.35 : 0.7;
  const envI = milky ? 0.55 : red ? 0.65 : 0.85;
  const emissiveOn = false;
  const card = {
    color: new THREE.Color(item.hex),
    map: maps.map,
    roughnessMap: maps.roughnessMap,
    normalMap: maps.normalMap,
    normalScale: new THREE.Vector2(milky ? 0.16 : 0.1, milky ? 0.16 : 0.1),
    metalness: 0,
    roughness: 1,
    clearcoat,
    clearcoatRoughness: 0.1,
    envMapIntensity: envI,
    transmission: trans,
    thickness: milky ? 2.5 : red ? 1.1 : 0.6,
    ior: milky ? 1.54 : 1.62,
    specularIntensity: milky ? 0.32 : 0.55,
    attenuationColor: new THREE.Color(red ? item.hex3 : dark ? 0x3a1d0e : item.hex3 || item.hex),
    attenuationDistance: milky ? 0.55 : red ? 1.0 : dark ? 0.9 : 3,
    iridescence: 0,
    sheen: dark && item.texture === 'iridescent' ? 0.35 : 0,
    sheenRoughness: 0.55,
    sheenColor: new THREE.Color(0xb9c0c8),
    emissive: dark ? new THREE.Color(0x2a1408) : red ? new THREE.Color(0x3a0508) : new THREE.Color(0x000000),
    emissiveMap: null,
    emissiveIntensity: dark ? 0.3 : red ? 0.35 : 0,
  };
  return new THREE.MeshPhysicalMaterial(card);
}

function hue(hex) {
  const h = String(hex || '#888888').replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (!d) return 0;
  let hh;
  if (max === r) hh = ((g - b) / d) % 6;
  else if (max === g) hh = (b - r) / d + 2;
  else hh = (r - g) / d + 4;
  return (hh * 60 + 360) % 360;
}

function makeContactShadowTexture() {
  const s = 256;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, s * 0.12, s / 2, s / 2, s * 0.5);
  g.addColorStop(0, 'rgba(45,32,20,0.45)');
  g.addColorStop(0.55, 'rgba(45,32,20,0.20)');
  g.addColorStop(1, 'rgba(45,32,20,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function supportsWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

/**
 * Mount the WebGL bracelet preview.
 * Returns { update(design), rotate(deg), destroy(), fps }.
 */
export async function mountBracelet(canvas, design, opts = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(canvas.clientWidth || 640, canvas.clientHeight || 640, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = false;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const hdr = await new RGBELoader().loadAsync(opts.hdri || HDRI_URL);
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  const envRT = pmrem.fromEquirectangular(hdr);
  scene.environment = envRT.texture;

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  const key = new THREE.DirectionalLight(0xfff7ea, 0.85);
  key.position.set(-4, 9, 5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xe8f0ff, 0.35);
  fill.position.set(5, 4, -3);
  scene.add(fill);
  scene.add(new THREE.AmbientLight(0xfff4e4, 0.08));

  const root = new THREE.Group();
  scene.add(root);

  const contactTex = makeContactShadowTexture();
  const shadowMat = new THREE.MeshBasicMaterial({ map: contactTex, transparent: true, depthWrite: false });
  const materialCache = new Map();
  const geometryCache = new Map();
  let meshes = [];
  let hovered = null;
  let R = 3.3;
  let beadR = 0.5;

  function clearRoot() {
    while (root.children.length) root.remove(root.children[0]);
    meshes = [];
  }

  function materialKey(item) {
    return `${item.crystalId}|${item.hex}|${item.hex2}|${item.hex3}|${item.texture}`;
  }

  function fitCamera() {
    const span = (R + beadR * 1.9) * 2;
    const dist = (span / (2 * Math.tan((32 * DEG) / 2))) * 1.04;
    camera.position.set(0, dist * 0.9, dist * 0.46);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }

  function build(nextDesign) {
    clearRoot();
    const layout = ((nextDesign.composition && nextDesign.composition.layout) || []).filter((item) => item.kind === 'bead');
    const n = Math.max(1, layout.length);
    const dia = (nextDesign.composition && nextDesign.composition.beadDiameter) || 8;
    beadR = 0.5 * (dia / 8);
    R = (n * beadR * 2) / (Math.PI * 2);
    if (!geometryCache.has(beadR)) geometryCache.set(beadR, new THREE.SphereGeometry(beadR, 48, 32));
    const geometry = geometryCache.get(beadR);
    layout.forEach((item, i) => {
      const a = (i / n) * Math.PI * 2;
      const x = R * Math.sin(a);
      const z = R * Math.cos(a);
      const keyName = materialKey(item);
      if (!materialCache.has(keyName)) materialCache.set(keyName, materialFor(item));
      const mesh = new THREE.Mesh(geometry, materialCache.get(keyName));
      mesh.position.set(x, 0, z);
      mesh.userData.item = item;
      root.add(mesh);
      meshes.push(mesh);

      const sh = new THREE.Mesh(new THREE.PlaneGeometry(beadR * 2.7, beadR * 2.7), shadowMat);
      sh.rotation.x = -Math.PI / 2;
      sh.position.set(x, -beadR * 0.94, z);
      root.add(sh);
    });

    const cord = new THREE.Mesh(
      new THREE.TorusGeometry(R, beadR * 0.075, 10, 240),
      new THREE.MeshStandardMaterial({ color: 0x59432b, roughness: 0.85, metalness: 0.05 }),
    );
    cord.rotation.x = Math.PI / 2;
    cord.position.y = -beadR * 0.08;
    root.add(cord);

    const ringShadow = new THREE.Mesh(
      new THREE.CircleGeometry(R + beadR * 3.1, 96),
      new THREE.MeshBasicMaterial({ map: contactTex, transparent: true, opacity: 0.5, depthWrite: false }),
    );
    ringShadow.rotation.x = -Math.PI / 2;
    ringShadow.position.y = -beadR * 1.06;
    root.add(ringShadow);

    fitCamera();
    canvas.dataset.beads = String(layout.length);
  }

  build(design);

  // pointer: drag to rotate + pick hover/click
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let dragging = false;
  let lastX = 0;
  let downX = 0;
  let downY = 0;
  let moved = 0;
  let rot = 0;

  function pick(event) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(meshes, false)[0];
    return hit && hit.object.userData.item ? hit.object.userData.item : null;
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (event.button > 0) return;
    dragging = true;
    moved = 0;
    lastX = event.clientX;
    downX = event.clientX;
    downY = event.clientY;
    canvas.setPointerCapture && canvas.setPointerCapture(event.pointerId);
    canvas.classList.add('is-dragging');
  });
  canvas.addEventListener('pointermove', (event) => {
    if (dragging) {
      const dx = event.clientX - lastX;
      lastX = event.clientX;
      rot += dx * 0.008;
      root.rotation.y = rot;
      moved = Math.max(moved, Math.hypot(event.clientX - downX, event.clientY - downY));
      return;
    }
    const item = pick(event);
    if (item !== hovered) {
      hovered = item;
      opts.onBeadHover && opts.onBeadHover(item);
    }
  });
  function stopDrag(event) {
    if (!dragging) return;
    dragging = false;
    canvas.classList.remove('is-dragging');
    try { canvas.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
    if (moved < 5) {
      const item = pick(event);
      if (item) opts.onBeadClick && opts.onBeadClick(item);
    }
  }
  canvas.addEventListener('pointerup', stopDrag);
  canvas.addEventListener('pointercancel', stopDrag);
  canvas.addEventListener('pointerleave', () => {
    if (hovered) {
      hovered = null;
      opts.onBeadHover && opts.onBeadHover(null);
    }
  });

  const resize = () => {
    const w = canvas.clientWidth || 640;
    const h = canvas.clientHeight || 640;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  ro && ro.observe(canvas);

  let frames = 0;
  let last = performance.now();
  let fps = 0;
  let alive = true;
  function tick(now) {
    if (!alive) return;
    frames += 1;
    if (now - last > 700) {
      fps = Math.round((frames * 1000) / (now - last));
      frames = 0;
      last = now;
      if (opts.onStats) opts.onStats({ fps, calls: renderer.info.render.calls, tris: renderer.info.render.triangles });
    }
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  return {
    update(nextDesign) {
      build(nextDesign);
    },
    destroy() {
      alive = false;
      ro && ro.disconnect();
      renderer.dispose();
      pmrem.dispose();
      envRT.dispose();
    },
    rotate(deg) {
      rot = deg * DEG;
      root.rotation.y = rot;
    },
    get fps() {
      return fps;
    },
  };
}
