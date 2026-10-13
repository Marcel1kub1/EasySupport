import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cacheDir = path.join(__dirname, '..', 'data', 'art');
fs.mkdirSync(cacheDir, { recursive: true });

/* ---------------------------------------------------------------- PNG output */

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

function encodePNG(width, height, rgb) {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
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

/* ----------------------------------------------------------------- palettes */

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
    stops.push(
      hsl2rgb(h, 0.55 + rng() * 0.25, 0.32 + t * 0.34)
    );
  }
  return stops;
}

function ramp(stops, t) {
  t = Math.max(0, Math.min(1, t));
  const scaled = t * (stops.length - 1);
  const i = Math.min(Math.floor(scaled), stops.length - 2);
  const f = scaled - i;
  const a = stops[i];
  const b = stops[i + 1];
  return [
    a[0] + (b[0] - a[0]) * f,
    a[1] + (b[1] - a[1]) * f,
    a[2] + (b[2] - a[2]) * f,
  ];
}

/* -------------------------------------------------------------------- motifs */

function motifLayers(rng) {
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
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
    accent: null,
  };
  const orbCount = 1 + Math.floor(rng() * 3);
  for (let i = 0; i < orbCount; i++) {
    layers.orbs.push({
      x: rng(),
      y: rng(),
      r: 0.08 + rng() * 0.22,
      strength: 0.08 + rng() * 0.1,
    });
  }
  layers.glow.color = hsl2rgb(rng(), 0.6 + rng() * 0.3, 0.62);
  if (layers.rings) layers.rings.color = hsl2rgb(rng(), 0.5 + rng() * 0.3, 0.6);
  if (layers.ribbons) layers.ribbons.color = hsl2rgb(rng(), 0.45 + rng() * 0.35, 0.66);
  if (layers.facets) layers.facets.color = hsl2rgb(rng(), 0.3 + rng() * 0.3, 0.75);
  layers.orbs = layers.orbs.map((o) => ({ ...o, color: hsl2rgb(rng(), 0.5 + rng() * 0.3, 0.65) }));
  return layers;
}

/* ------------------------------------------------------------------ renderer */

const SS = 2; // supersampling factor for anti-aliased edges

function renderSegments(width, height, segments) {
  const W = width * SS;
  const H = height * SS;
  const out = Buffer.alloc(W * H * 3);
  const multi = segments.length > 1;
  const sepW = 3 / width; // separator band around each segment boundary

  for (let py = 0; py < H; py++) {
    const y = py / H;
    for (let px = 0; px < W; px++) {
      const x = px / W;
      const seg = segments[Math.min(segments.length - 1, Math.floor(x * segments.length))];
      const { palette, layers } = seg;
      const lx = (x - seg.x0) / seg.w;

      // diagonal base gradient inside the segment
      const t = lx * 0.72 + (1 - y) * 0.28;
      const base = ramp(palette, t);
      let r = base[0], g = base[1], b = base[2];

      // headroom-weighted additive layer: never clips to white, keeps the hue
      const add = (color, intensity) => {
        r += color[0] * intensity * (1 - r / 255);
        g += color[1] * intensity * (1 - g / 255);
        b += color[2] * intensity * (1 - b / 255);
      };

      // soft radial glow
      const gdx = (lx - layers.glow.x) * 1.2;
      const gdy = (y - layers.glow.y) * 0.75;
      const gd = gdx * gdx + gdy * gdy;
      add(layers.glow.color, Math.exp(-gd * layers.glow.k * 4) * layers.glow.strength);

      // concentric rings
      if (layers.rings) {
        const rl = layers.rings;
        const dx = (lx - rl.x) * 1.2;
        const dy = (y - rl.y) * 0.75;
        const d = Math.sqrt(dx * dx + dy * dy);
        const band = 0.5 + 0.5 * Math.sin(d * rl.freq * 6.283 - rl.phase);
        add(rl.color, Math.pow(band, rl.power) * rl.strength);
      }

      // sine ribbons
      if (layers.ribbons) {
        const rb = layers.ribbons;
        const band = 0.5 + 0.5 * Math.sin((y * rb.freq + lx * 0.8) * 6.283 - rb.phase);
        add(rb.color, Math.pow(band, rb.power) * rb.strength);
      }

      // diagonal facets
      if (layers.facets) {
        const fc = layers.facets;
        const s = ((lx * 1.3 + (1 - y) * 0.7) * fc.freq + fc.phase) % 1;
        const edge = Math.min(s, 1 - s);
        add(fc.color, Math.max(0, 1 - edge / 0.06) * fc.strength);
      }

      // soft orbs
      for (const orb of layers.orbs) {
        const dx = (lx - orb.x) * 1.2;
        const dy = (y - orb.y) * 0.75;
        add(orb.color, Math.exp(-(dx * dx + dy * dy) / (orb.r * orb.r)) * orb.strength);
      }

      // segment separator + vignette + grain
      const toEdge = Math.min(lx, 1 - lx);
      const vig = 1 - 0.16 * ((x * 2 - 1) * (x * 2 - 1) + (y * 2 - 1) * (y * 2 - 1));
      const sep = multi && toEdge < sepW ? toEdge / sepW : 1;
      const grain = (((px * 73856093) ^ (py * 19349663) ^ seg.seed) & 255) / 255 - 0.5;
      const shade = vig * sep;

      const o = (py * W + px) * 3;
      out[o] = Math.max(0, Math.min(255, ((r * shade + grain * 7) | 0)));
      out[o + 1] = Math.max(0, Math.min(255, ((g * shade + grain * 7) | 0)));
      out[o + 2] = Math.max(0, Math.min(255, ((b * shade + grain * 7) | 0)));
    }
  }

  // box-filter downsample (anti-aliasing)
  const rgb = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const o = ((y * SS + sy) * W + (x * SS + sx)) * 3;
          r += out[o]; g += out[o + 1]; b += out[o + 2];
        }
      }
      const o = (y * width + x) * 3;
      const n = SS * SS;
      rgb[o] = (r / n) | 0;
      rgb[o + 1] = (g / n) | 0;
      rgb[o + 2] = (b / n) | 0;
    }
  }
  return rgb;
}

function buildArt(width, height, segmentSpecs) {
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
  return encodePNG(width, height, renderSegments(width, height, segments));
}

/* ------------------------------------------------------------------- public */

const memoryCache = new Map();

function cached(name, build) {
  if (memoryCache.has(name)) return memoryCache.get(name);
  const file = path.join(cacheDir, `${name}.png`);
  let png;
  if (fs.existsSync(file)) {
    png = fs.readFileSync(file);
  } else {
    png = build();
    fs.writeFileSync(file, png);
  }
  memoryCache.set(name, png);
  return png;
}

/** Generated banner for one ticket category — deterministic per category key. */
export function categoryArt(key, label = key) {
  return cached(`category-${key}-${seedOf(key + label).toString(36)}`, () =>
    buildArt(1024, 320, [{ seed: `easy-support-category:${key}:${label}`, x0: 0, w: 1 }])
  );
}

/** Generated banner covering every category — used on the /panel message. */
export function panelArt(categories) {
  const list = categories.length ? categories : [{ key: 'default', label: 'default' }];
  return cached(`panel-${seedOf(list.map((c) => c.key).join('|')).toString(36)}`, () => {
    const w = 1 / list.length;
    return buildArt(
      1024,
      320,
      list.map((c, i) => ({ seed: `easy-support-panel:${c.key}:${i}`, x0: i * w, w }))
    );
  });
}
