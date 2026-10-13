// Renders assets/wispbyte-hero.png — README sponsor banner linking to wispbyte.com.
// Uses Wispbyte's real brand mark (downloaded from their og:image) over a dark
// panel with the headline from their landing page.
import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'assets');
const FONTS = [
  path.join(ROOT, 'assets/fonts/Inter-Regular.ttf'),
  path.join(ROOT, 'assets/fonts/Inter-Bold.ttf'),
];
const LOGO = path.join(ROOT, 'assets/wispbyte-logo.png');

const W = 1920;
const H = 640;
const ACCENT = '#3b82f6'; // wispbyte theme color
const BG_TOP = '#0A141D';
const BG_BOTTOM = '#12233A';

const FONT_OPTS = { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: 'Inter' };

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const t = (x, y, s, size, fill, weight = 400, extra = '') =>
  `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-family="Inter" font-size="${size}" font-weight="${weight}" fill="${fill}"${extra}>${esc(s)}</text>`;

let defs =
  `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">` +
  `<stop offset="0" stop-color="${BG_TOP}"/><stop offset="1" stop-color="${BG_BOTTOM}"/></linearGradient>` +
  `<radialGradient id="glow" cx="50%" cy="50%" r="50%">` +
  `<stop offset="0" stop-color="${ACCENT}" stop-opacity="0.22"/><stop offset="1" stop-color="${ACCENT}" stop-opacity="0"/></radialGradient>` +
  `<clipPath id="logoclip"><rect x="0" y="0" width="440" height="440" rx="64"/></clipPath>`;

let body =
  `<rect x="0" y="0" width="${W}" height="${H}" rx="28" fill="url(#bg)"/>` +
  `<ellipse cx="${W * 0.78}" cy="${H * 0.5}" rx="620" ry="420" fill="url(#glow)"/>` +
  // subtle grid, echoing a "localhost" theme
  (() => {
    let g = '';
    for (let x = 0; x < W; x += 96) g += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#ffffff" stroke-opacity="0.025" stroke-width="1"/>`;
    for (let y = 0; y < H; y += 96) g += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#ffffff" stroke-opacity="0.025" stroke-width="1"/>`;
    return g;
  })() +
  // brand mark (their logo)
  `<rect x="${W - 520}" y="${(H - 440) / 2}" width="440" height="440" rx="64" fill="#ffffff" fill-opacity="0.03" stroke="#ffffff" stroke-opacity="0.08" stroke-width="1.5"/>` +
  `<g clip-path="url(#logoclip)"><image href="${LOGO}" x="${W - 520}" y="${(H - 440) / 2}" width="440" height="440"/></g>` +
  // kicker + headline
  t(120, 210, 'A  B Y T E  O F  P O S S I B I L I T Y', 34, '#ffffff', 500, ' opacity="0.55"') +
  t(120, 360, "Host the thing that's been stuck", 104, '#ffffff', 800) +
  t(120, 490, 'on ', 104, '#ffffff', 800) +
  `<text x="${(120 + 118).toFixed(1)}" y="490" font-family="Inter" font-size="104" font-weight="800" fill="${ACCENT}">localhost.</text>` +
  t(120, 570, 'wispbyte.com — free 24/7 hosting', 30, '#ffffff', 400, ' opacity="0.45"');

const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${defs}</defs>${body}</svg>`;

fs.copyFileSync('/tmp/kilo/wisp-hero.png', LOGO);
const png = new Resvg(svg, { font: FONT_OPTS, fitTo: { mode: 'width', value: W * 2 }, logLevel: 'error' })
  .render()
  .asPng();
fs.writeFileSync(path.join(OUT, 'wispbyte-hero.png'), png);
console.log('rendered assets/wispbyte-hero.png', png.length, 'bytes');
