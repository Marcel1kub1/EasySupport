import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const cacheDir = path.join(root, 'data', 'art');
const emojiCacheDir = path.join(root, 'data', 'emoji');
const localEmojiDir = path.join(root, 'assets', 'emoji');
const fontDir = path.join(root, 'assets', 'fonts');
fs.mkdirSync(cacheDir, { recursive: true });
fs.mkdirSync(emojiCacheDir, { recursive: true });

const ART_VERSION = 3; // bump to invalidate cached art after design changes
const TICKET_W = 1024;
const TICKET_H = 320;
const PANEL_CELL_H = 240;
const TWEMOJI_CDN = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg';

/* ------------------------------------------------------------------ seeding */

function seedOf(text) {
  const h = crypto.createHash('sha1').update(text).digest();
  let s = 0;
  for (let i = 0; i < 4; i++) s = (s * 256 + h[i]) >>> 0;
  return s;
}

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hsl2rgb(h, s, l) {
  h = ((h % 1) + 1) % 1;
  const f = (n) => {
    const k = (n + h * 12) % 12;
    return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

function paletteOf(rng) {
  const base = rng();
  const scheme = rng();
  const stops = [];
  const n = 4;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    let h;
    if (scheme < 0.4) h = base + t * 0.12;
    else if (scheme < 0.7) h = base + 0.5 * (rng() < 0.5 ? 1 : -1) * t * 0.5 + t * 0.05;
    else h = base + 0.33 * t + (rng() - 0.5) * 0.08;
    stops.push(hsl2rgb(h, 0.55 + rng() * 0.25, 0.32 + t * 0.34));
  }
  return stops;
}

function motifLayers(rng) {
  const layers = {
    glow: { x: 0.2 + rng() * 0.6, y: 0.15 + rng() * 0.5, k: 2 + rng() * 3, strength: 0.22 + rng() * 0.2, color: null },
    rings: rng() < 0.75
      ? { x: 0.15 + rng() * 0.7, y: 0.2 + rng() * 0.6, freq: 3 + rng() * 7, phase: rng() * 6.28, power: 3 + rng() * 5, strength: 0.1 + rng() * 0.12 }
      : null,
    ribbons: rng() < 0.7
      ? { freq: 1.5 + rng() * 2.5, phase: rng() * 6.28, power: 4 + rng() * 5, strength: 0.1 + rng() * 0.1 }
      : null,
    facets: rng() < 0.6
      ? { freq: 4 + rng() * 8, phase: rng() * 6.28, strength: 0.05 + rng() * 0.06 }
      : null,
    orbs: [],
  };
  const orbCount = 1 + Math.floor(rng() * 3);
  for (let i = 0; i < orbCount; i++) {
    layers.orbs.push({ x: rng(), y: rng(), r: 0.08 + rng() * 0.22, strength: 0.08 + rng() * 0.1 });
  }
  layers.glow.color = hsl2rgb(rng(), 0.6 + rng() * 0.3, 0.62);
  if (layers.rings) layers.rings.color = hsl2rgb(rng(), 0.5 + rng() * 0.3, 0.6);
  if (layers.ribbons) layers.ribbons.color = hsl2rgb(rng(), 0.45 + rng() * 0.35, 0.66);
  if (layers.facets) layers.facets.color = hsl2rgb(rng(), 0.3 + rng() * 0.3, 0.75);
  layers.orbs = layers.orbs.map((o) => ({ ...o, color: hsl2rgb(rng(), 0.5 + rng() * 0.3, 0.65) }));
  return layers;
}

/* ------------------------------------------------------- resvg (SVG -> PNG) */

let ResvgClass;
let resvgTried = false;

async function loadResvg() {
  if (resvgTried) return ResvgClass;
  resvgTried = true;
  try {
    ResvgClass = (await import('@resvg/resvg-js')).Resvg;
  } catch (err) {
    console.warn(`[art] @resvg/resvg-js unavailable (${err.message}) — using procedural art fallback.`);
  }
  return ResvgClass;
}

function fontOptions() {
  return {
    fontFiles: [path.join(fontDir, 'Inter-Regular.ttf'), path.join(fontDir, 'Inter-Bold.ttf')],
    loadSystemFonts: false,
    defaultFontFamily: 'Inter',
    sansSerifFamily: 'Inter',
  };
}

async function renderSvg(svg, width) {
  const R = await loadResvg();
  if (!R) return null;
  const rendered = new R(svg, { font: fontOptions(), fitTo: { mode: 'width', value: width }, logLevel: 'error' });
  return rendered.render().asPng();
}

const textSizeCache = new Map();

async function measureText(text, size, weight) {
  const key = `${weight}|${size}|${text}`;
  if (textSizeCache.has(key)) return textSizeCache.get(key);
  const R = await loadResvg();
  let width = text.length * size * 0.52;
  if (R) {
    try {
      const probe = `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="${size * 2}"><text x="0" y="${size}" font-family="Inter" font-size="${size}" font-weight="${weight}">${escXml(text)}</text></svg>`;
      const bbox = new R(probe, { font: fontOptions(), logLevel: 'off' }).getBBox();
      if (bbox && bbox.width > 0) width = bbox.width;
    } catch {
      /* keep the estimate */
    }
  }
  textSizeCache.set(key, width);
  return width;
}

async function fitText(text, startSize, maxWidth, weight) {
  let size = startSize;
  while (size > 20 && (await measureText(text, size, weight)) > maxWidth) size -= 2;
  return size;
}

/* -------------------------------------------------------------------- emoji */

function emojiCode(emoji) {
  if (!emoji) return null;
  const points = [...emoji].map((ch) => ch.codePointAt(0).toString(16)).filter((cp) => cp !== 'fe0f');
  return points.length ? points.join('-') : null;
}

async function resolveEmojiSvg(code) {
  const local = path.join(localEmojiDir, `${code}.svg`);
  if (fs.existsSync(local)) return fs.readFileSync(local, 'utf8');
  const cached = path.join(emojiCacheDir, `${code}.svg`);
  if (fs.existsSync(cached)) return fs.readFileSync(cached, 'utf8');
  try {
    const res = await fetch(`${TWEMOJI_CDN}/${code}.svg`);
    if (!res.ok) return null;
    const text = await res.text();
    fs.writeFileSync(cached, text);
    return text;
  } catch {
    return null; // offline: art renders without the emoji
  }
}

function emojiInner(svgText) {
  return svgText.replace(/<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
}

/* -------------------------------------------------------------- svg helpers */

function escXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;

/** Gradient + motif background for one card region; returns { defs, body }. */
function cardFragment(palette, layers, x, y, w, h, idp) {
  const defs = [];
  const body = [];

  defs.push(`<linearGradient id="${idp}-base" x1="0" y1="0" x2="1" y2="1">`);
  palette.forEach((c, i) => defs.push(`<stop offset="${i / (palette.length - 1)}" stop-color="${rgb(c)}"/>`));
  defs.push('</linearGradient>');
  body.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${idp}-base)"/>`);

  defs.push(
    `<radialGradient id="${idp}-glow" cx="50%" cy="50%" r="50%">` +
      `<stop offset="0" stop-color="${rgb(layers.glow.color)}" stop-opacity="${layers.glow.strength.toFixed(3)}"/>` +
      `<stop offset="1" stop-color="${rgb(layers.glow.color)}" stop-opacity="0"/></radialGradient>`
  );
  body.push(
    `<circle cx="${x + layers.glow.x * w}" cy="${y + layers.glow.y * h}" r="${Math.max(w, h) * 0.6}" fill="url(#${idp}-glow)"/>`
  );

  if (layers.rings) {
    const rl = layers.rings;
    const cx = x + rl.x * w;
    const cy = y + rl.y * h;
    for (let i = 1; i <= 5; i++) {
      body.push(
        `<circle cx="${cx}" cy="${cy}" r="${(i / 5) * Math.max(w, h) * 0.72}" fill="none" stroke="${rgb(rl.color)}" stroke-width="2" opacity="${(rl.strength * 1.3).toFixed(3)}"/>`
      );
    }
  }

  if (layers.ribbons) {
    const rb = layers.ribbons;
    const amp = h * 0.07;
    for (let k = 0; k < 3; k++) {
      const top = [];
      const bottom = [];
      const steps = 24;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const sx = x + t * w;
        const sy = y + h * (0.28 + 0.2 * k) + Math.sin(t * rb.freq * Math.PI * 2 + rb.phase + k * 1.7) * amp;
        top.push(`${sx.toFixed(1)},${sy.toFixed(1)}`);
        bottom.unshift(`${sx.toFixed(1)},${(sy + h * 0.045).toFixed(1)}`);
      }
      body.push(`<polygon points="${top.concat(bottom).join(' ')}" fill="${rgb(rb.color)}" opacity="${rb.strength.toFixed(3)}"/>`);
    }
  }

  if (layers.facets) {
    const fc = layers.facets;
    for (let k = 0; k < 5; k++) {
      const off = k * (w / 2.6) + fc.phase * 30;
      body.push(
        `<polygon points="${x + off},${y} ${x + off + w * 0.16},${y} ${x + off + w * 0.16 - h},${y + h} ${x + off - h},${y + h}" fill="${rgb(fc.color)}" opacity="${fc.strength.toFixed(3)}"/>`
      );
    }
  }

  layers.orbs.forEach((o, i) => {
    defs.push(
      `<radialGradient id="${idp}-orb${i}" cx="50%" cy="50%" r="50%">` +
        `<stop offset="0" stop-color="${rgb(o.color)}" stop-opacity="${o.strength.toFixed(3)}"/>` +
        `<stop offset="1" stop-color="${rgb(o.color)}" stop-opacity="0"/></radialGradient>`
    );
    body.push(
      `<circle cx="${x + o.x * w}" cy="${y + o.y * h}" r="${o.r * Math.max(w, h)}" fill="url(#${idp}-orb${i})"/>`
    );
  });

  defs.push(
    `<radialGradient id="${idp}-vig" cx="50%" cy="50%" r="75%">` +
      `<stop offset="0.5" stop-color="#000000" stop-opacity="0"/>` +
      `<stop offset="1" stop-color="#000000" stop-opacity="0.22"/></radialGradient>`
  );
  body.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${idp}-vig)"/>`);

  return { defs: defs.join(''), body: body.join('') };
}

/** Centered label group (optional emoji + name); returns svg fragment. */
async function labelFragment(cx, cy, label, emojiSvg, maxWidth, { plate = true, startSize = 72 } = {}) {
  const code = emojiCode(emojiSvg);
  const emoji = code ? await resolveEmojiSvg(code) : null;
  const emojiSize = 0;
  const hasEmoji = Boolean(emoji);
  const maxTextWidth = maxWidth - (hasEmoji ? startSize * 1.35 : 0);
  const size = await fitText(label, startSize, maxTextWidth, '700');
  const textWidth = await measureText(label, size, '700');
  const emojiBox = hasEmoji ? size * 1.15 + 28 : 0;
  const groupWidth = textWidth + emojiBox;
  const startX = cx - groupWidth / 2;

  const parts = [];
  if (plate) {
    const plateW = groupWidth + 80;
    const plateH = Math.max(size * 1.3, size * 1.15) + 56;
    parts.push(
      `<rect x="${(cx - plateW / 2).toFixed(1)}" y="${(cy - plateH / 2).toFixed(1)}" width="${plateW.toFixed(1)}" height="${plateH.toFixed(1)}" rx="22" fill="#0b0d12" opacity="0.34"/>`
    );
  }
  let tx = startX;
  if (emoji) {
    const emSize = size * 1.15;
    const scale = emSize / 36;
    parts.push(`<g transform="translate(${tx.toFixed(1)},${(cy - emSize / 2).toFixed(1)}) scale(${scale.toFixed(4)})">${emojiInner(emoji)}</g>`);
    tx += emojiBox;
  }
  parts.push(
    `<text x="${tx.toFixed(1)}" y="${(cy + size * 0.36).toFixed(1)}" font-family="Inter" font-size="${size}" font-weight="700" fill="#ffffff">${escXml(label)}</text>`
  );
  return { parts: parts.join(''), emojiSize };
}

/* ------------------------------------------------------- resvg compositions */

async function ticketBannerSvg(key, label, emoji) {
  const rng = mulberry32(seedOf(`easy-support-category:${key}:${label}`));
  const palette = paletteOf(rng);
  const layers = motifLayers(rng);
  const idp = `t${seedOf(key + label) % 100000}`;
  const bg = cardFragment(palette, layers, 0, 0, TICKET_W, TICKET_H, idp);
  const labelPart = await labelFragment(TICKET_W / 2, TICKET_H / 2, label, emoji, TICKET_W - 120, {
    plate: true,
    startSize: 76,
  });
  const wordmark = `<text x="${TICKET_W - 40}" y="${TICKET_H - 28}" font-family="Inter" font-size="30" font-weight="400" fill="#ffffff" opacity="0.72" text-anchor="end">EasySupport</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${TICKET_W}" height="${TICKET_H}" viewBox="0 0 ${TICKET_W} ${TICKET_H}"><defs>${bg.defs}</defs>${bg.body}${labelPart.parts}${wordmark}</svg>`;
}

async function panelBannerSvg(categories) {
  const cols = categories.length <= 1 ? 1 : 2;
  const rows = Math.ceil(categories.length / cols);
  const cellW = TICKET_W / cols;
  const width = TICKET_W;
  const height = rows * PANEL_CELL_H;

  let defs = '';
  let body = '';
  for (const [i, cat] of categories.entries()) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * cellW;
    const y = row * PANEL_CELL_H;
    const rng = mulberry32(seedOf(`easy-support-panel:${cat.key}:${i}`));
    const palette = paletteOf(rng);
    const layers = motifLayers(rng);
    const bg = cardFragment(palette, layers, x, y, cellW, PANEL_CELL_H, `p${i}`);
    defs += bg.defs;
    body += bg.body;
    const labelPart = await labelFragment(x + cellW / 2, y + PANEL_CELL_H / 2, cat.label, cat.emoji, cellW - 64, {
      plate: true,
      startSize: 48,
    });
    body += labelPart.parts;
  }

  for (let c = 1; c < cols; c++) {
    body += `<rect x="${c * cellW - 2}" y="0" width="4" height="${height}" fill="#0b0d12" opacity="0.45"/>`;
  }
  for (let r = 1; r < rows; r++) {
    body += `<rect x="0" y="${r * PANEL_CELL_H - 2}" width="${width}" height="4" fill="#0b0d12" opacity="0.45"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs>${defs}</defs>${body}</svg>`;
}

/* ------------------------------------------- procedural fallback (pixels) */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])));
  return Buffer.concat([len, Buffer.from(type, 'ascii'), data, crc]);
}

function encodePNG(width, height, rgbPixels) {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgbPixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

const SS = 2; // supersampling factor for anti-aliased edges

function proceduralBanner(width, height, segmentSpecs) {
  const segments = segmentSpecs.map((spec) => {
    const rng = mulberry32(seedOf(spec.seed));
    return {
      x0: spec.x0,
      w: spec.w,
      seed: seedOf(spec.seed) % 9973,
      palette: paletteOf(rng),
      layers: motifLayers(rng),
    };
  });

  const W = width * SS;
  const H = height * SS;
  const out = Buffer.alloc(W * H * 3);

  for (let py = 0; py < H; py++) {
    const y = py / H;
    for (let px = 0; px < W; px++) {
      const x = px / W;
      const seg = segments[Math.min(segments.length - 1, Math.floor(x * segments.length))];
      const { palette, layers } = seg;
      const lx = (x - seg.x0) / seg.w;

      const t = lx * 0.72 + (1 - y) * 0.28;
      const scaled = Math.max(0, Math.min(1, t)) * (palette.length - 1);
      const i = Math.min(Math.floor(scaled), palette.length - 2);
      const f = scaled - i;
      const a = palette[i];
      const b = palette[i + 1];
      let r = a[0] + (b[0] - a[0]) * f;
      let g = a[1] + (b[1] - a[1]) * f;
      let bl = a[2] + (b[2] - a[2]) * f;

      const add = (color, intensity) => {
        r += color[0] * intensity * (1 - r / 255);
        g += color[1] * intensity * (1 - g / 255);
        bl += color[2] * intensity * (1 - bl / 255);
      };

      const gdx = (lx - layers.glow.x) * 1.2;
      const gdy = (y - layers.glow.y) * 0.75;
      add(layers.glow.color, Math.exp(-(gdx * gdx + gdy * gdy) * layers.glow.k * 4) * layers.glow.strength);

      if (layers.rings) {
        const rl = layers.rings;
        const dx = (lx - rl.x) * 1.2;
        const dy = (y - rl.y) * 0.75;
        const band = 0.5 + 0.5 * Math.sin(Math.sqrt(dx * dx + dy * dy) * rl.freq * 6.283 - rl.phase);
        add(rl.color, Math.pow(band, rl.power) * rl.strength);
      }
      if (layers.ribbons) {
        const rb = layers.ribbons;
        const band = 0.5 + 0.5 * Math.sin((y * rb.freq + lx * 0.8) * 6.283 - rb.phase);
        add(rb.color, Math.pow(band, rb.power) * rb.strength);
      }
      if (layers.facets) {
        const fc = layers.facets;
        const s = ((lx * 1.3 + (1 - y) * 0.7) * fc.freq + fc.phase) % 1;
        const edge = Math.min(s, 1 - s);
        add(fc.color, Math.max(0, 1 - edge / 0.06) * fc.strength);
      }
      for (const orb of layers.orbs) {
        const dx = (lx - orb.x) * 1.2;
        const dy = (y - orb.y) * 0.75;
        add(orb.color, Math.exp(-(dx * dx + dy * dy) / (orb.r * orb.r)) * orb.strength);
      }

      const vig = 1 - 0.16 * ((x * 2 - 1) * (x * 2 - 1) + (y * 2 - 1) * (y * 2 - 1));
      const grain = (((px * 73856093) ^ (py * 19349663) ^ seg.seed) & 255) / 255 - 0.5;
      const o = (py * W + px) * 3;
      out[o] = Math.max(0, Math.min(255, (r * vig + grain * 7) | 0));
      out[o + 1] = Math.max(0, Math.min(255, (g * vig + grain * 7) | 0));
      out[o + 2] = Math.max(0, Math.min(255, (bl * vig + grain * 7) | 0));
    }
  }

  const pixels = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const o = ((y * SS + sy) * W + (x * SS + sx)) * 3;
          r += out[o];
          g += out[o + 1];
          b += out[o + 2];
        }
      }
      const o = (y * width + x) * 3;
      const n = SS * SS;
      pixels[o] = (r / n) | 0;
      pixels[o + 1] = (g / n) | 0;
      pixels[o + 2] = (b / n) | 0;
    }
  }
  return encodePNG(width, height, pixels);
}

/* -------------------------------------------------------------------- public */

const memoryCache = new Map();

async function cachedAsync(name, build) {
  if (memoryCache.has(name)) return memoryCache.get(name);
  const file = path.join(cacheDir, `${name}.png`);
  if (fs.existsSync(file)) {
    const png = fs.readFileSync(file);
    memoryCache.set(name, png);
    return png;
  }
  const png = await build();
  fs.writeFileSync(file, png);
  memoryCache.set(name, png);
  return png;
}

/** Generated banner for one ticket category — deterministic per category key. */
export async function categoryArt(key, label = key, emoji = null) {
  const renderer = (await loadResvg()) ? 'svg' : 'px';
  const name = `category-${key}-${seedOf(`${ART_VERSION}:${renderer}:${key}:${label}:${emoji ?? ''}`).toString(36)}`;
  return cachedAsync(name, async () => {
    if (renderer === 'svg') {
      const svg = await ticketBannerSvg(key, label, emoji);
      const png = await renderSvg(svg, TICKET_W);
      if (png) return png;
    }
    return proceduralBanner(TICKET_W, TICKET_H, [{ seed: `easy-support-category:${key}:${label}`, x0: 0, w: 1 }]);
  });
}

/** Generated banner covering every category — used on the /panel message. */
export async function panelArt(categories) {
  const list = categories.length ? categories : [{ key: 'default', label: 'EasySupport', emoji: null }];
  const renderer = (await loadResvg()) ? 'svg' : 'px';
  const name = `panel-${seedOf(`${ART_VERSION}:${renderer}:${list.map((c) => `${c.key}:${c.label}:${c.emoji ?? ''}`).join('|')}`).toString(36)}`;
  return cachedAsync(name, async () => {
    if (renderer === 'svg') {
      const svg = await panelBannerSvg(list);
      const png = await renderSvg(svg, TICKET_W);
      if (png) return png;
    }
    const w = 1 / list.length;
    return proceduralBanner(TICKET_W, TICKET_H, list.map((c, i) => ({ seed: `easy-support-panel:${c.key}:${i}`, x0: i * w, w })));
  });
}
