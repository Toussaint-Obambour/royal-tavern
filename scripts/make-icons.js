#!/usr/bin/env node
/**
 * Génère les icônes PNG de l'application (PWA / Android) à partir du logo,
 * sans dépendance externe.
 *
 *   node scripts/make-icons.js
 *
 * Produit dans public/icons/ : favicon.svg, icon-192.png, icon-512.png,
 * icon-maskable-512.png, icon-1024.png, playstore-512.png
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(OUT, { recursive: true });

const NAVY = [11, 17, 32];
const NAVY2 = [22, 35, 61];
const GOLD = [217, 168, 60];
const GOLD_L = [240, 208, 138];
const GOLD_D = [169, 118, 31];

/* ------------------------- Logo vectoriel (SVG) -------------------------- */
const logoSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#16233d"/><stop offset="100%" stop-color="#0b1120"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f6dc9c"/><stop offset="55%" stop-color="#d9a83c"/><stop offset="100%" stop-color="#a9761f"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <circle cx="256" cy="256" r="196" fill="none" stroke="#d9a83c" stroke-opacity=".28" stroke-width="6"/>
  <path fill="url(#gold)" d="M96 206l52 46 46-80 62 80 62-80 46 80 52-46-24 128H120L96 206z"/>
  <rect x="120" y="348" width="272" height="30" rx="10" fill="url(#gold)"/>
  <circle cx="256" cy="168" r="20" fill="#f6dc9c"/>
  <text x="256" y="450" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="54" fill="#f0d08a" letter-spacing="6">TAVERN</text>
</svg>`;

const faviconSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#0b1120"/>
  <path fill="#d9a83c" d="M8 24l8 8 7-13 9 13 9-13 7 13 8-8-4 24H12L8 24z"/>
  <rect x="12" y="52" width="40" height="5" rx="2" fill="#d9a83c"/>
</svg>`;

fs.writeFileSync(path.join(OUT, 'favicon.svg'), faviconSVG);
fs.writeFileSync(path.join(OUT, 'logo.svg'), logoSVG);

/* --------------------------- Rendu PNG maison ---------------------------- */
function lerp(a, b, t) { return Math.round(a + (b - a) * t); }

function insideRoundedRect(x, y, w, h, r) {
  if (x < 0 || y < 0 || x > w || y > h) return false;
  const cx = Math.min(Math.max(x, r), w - r);
  const cy = Math.min(Math.max(y, r), h - r);
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= r * r || (x >= r && x <= w - r) || (y >= r && y <= h - r);
}

/** Distance d'un point au segment (a->b), pour tracer les traits du logo. */
function distSeg(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay;
  const wx = px - ax, wy = py - ay;
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / (vx * vx + vy * vy || 1)));
  const dx = px - (ax + t * vx), dy = py - (ay + t * vy);
  return Math.sqrt(dx * dx + dy * dy);
}
function inTriangle(px, py, a, b, c) {
  const sign = (p1, p2, p3) => (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1]);
  const d1 = sign([px, py], a, b), d2 = sign([px, py], b, c), d3 = sign([px, py], c, a);
  const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

function inPolygon(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if (((yi > py) !== (yj > py)) && (px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
function distToPoly(px, py, poly) {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    best = Math.min(best, distSeg(px, py, a[0], a[1], b[0], b[1]));
  }
  return best;
}
/** Couverture anti-aliasée d'un polygone (0 → 1) */
function polyCoverage(px, py, poly, soft = 2.2) {
  const inside = inPolygon(px, py, poly);
  const d = distToPoly(px, py, poly);
  if (inside) return 1;
  return Math.max(0, 1 - d / soft);
}
function rectCoverage(px, py, x0, y0, x1, y1, soft = 2.2) {
  const dx = Math.max(x0 - px, px - x1, 0);
  const dy = Math.max(y0 - py, py - y1, 0);
  const d = Math.sqrt(dx * dx + dy * dy);
  return Math.max(0, Math.min(1, 1 - d / soft));
}

const CROWN = [
  [100, 208], [186, 264], [256, 138], [326, 264], [412, 208],
  [412, 332], [100, 332]
];
const BAND = [118, 350, 394, 384];

function renderIcon(size, { maskable = false } = {}) {
  const S = size;
  const px = Buffer.alloc(S * S * 4);
  const baseScale = S / 512;
  const shrink = maskable ? 0.78 : 1;
  const toLogo = (X) => 256 + (X - 256) / shrink;
  const toLogoY = (Y) => 256 + (Y - 256) / shrink;

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const X = (x + 0.5) / baseScale, Y = (y + 0.5) / baseScale;
      if (!maskable && !insideRoundedRect(X, Y, 512, 512, 112)) { px[(y * S + x) * 4 + 3] = 0; continue; }

      const t = Y / 512;
      let r = lerp(NAVY2[0], NAVY[0], t);
      let g = lerp(NAVY2[1], NAVY[1], t);
      let b = lerp(NAVY2[2], NAVY[2], t);

      // Cercle doré discret
      const dc = Math.sqrt((X - 256) ** 2 + (Y - 256) ** 2);
      const ring = Math.max(0, 1 - Math.abs(dc - 198) / 3);
      if (ring > 0) { r = lerp(r, GOLD[0], .3 * ring); g = lerp(g, GOLD[1], .3 * ring); b = lerp(b, GOLD[2], .3 * ring); }

      // Couronne + socle (dans l'espace logo)
      const lx = toLogo(X), ly = toLogoY(Y);
      let k = Math.max(polyCoverage(lx, ly, CROWN), rectCoverage(lx, ly, BAND[0], BAND[1], BAND[2], BAND[3]));
      if (k > 0) {
        const tt = Math.max(0, Math.min(1, (ly - 130) / 250));
        const gr = tt < .55 ? lerp(GOLD_L[0], GOLD[0], tt / .55) : lerp(GOLD[0], GOLD_D[0], (tt - .55) / .45);
        const gg = tt < .55 ? lerp(GOLD_L[1], GOLD[1], tt / .55) : lerp(GOLD[1], GOLD_D[1], (tt - .55) / .45);
        const gb = tt < .55 ? lerp(GOLD_L[2], GOLD[2], tt / .55) : lerp(GOLD[2], GOLD_D[2], (tt - .55) / .45);
        k = Math.min(1, k);
        r = lerp(r, gr, k); g = lerp(g, gg, k); b = lerp(b, gb, k);
      }

      // Trois perles sur les pointes
      const pearls = [[100, 200, 15], [256, 130, 17], [412, 200, 15]];
      for (const [cx, cy, rad] of pearls) {
        const d = Math.sqrt((lx - cx) ** 2 + (ly - cy) ** 2);
        const cov = Math.max(0, Math.min(1, (rad - d) / 2.2));
        if (cov > 0) { r = lerp(r, GOLD_L[0], cov); g = lerp(g, GOLD_L[1], cov); b = lerp(b, GOLD_L[2], cov); }
      }

      const idx = (y * S + x) * 4;
      px[idx] = r; px[idx + 1] = g; px[idx + 2] = b; px[idx + 3] = 255;
    }
  }
  return px;
}

/* -------------------------- Écriture PNG (zlib) -------------------------- */
function crc32(buf) {
  let c, crc = 0xFFFFFFFF;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xFF;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    crc = c ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}
function writePNG(file, width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
  fs.writeFileSync(file, png);
  return png.length;
}

const jobs = [
  ['icon-192.png', 192, {}],
  ['icon-256.png', 256, {}],
  ['icon-512.png', 512, {}],
  ['icon-1024.png', 1024, {}],
  ['icon-maskable-512.png', 512, { maskable: true }],
  ['playstore-512.png', 512, {}]
];

for (const [name, size, opts] of jobs) {
  const bytes = writePNG(path.join(OUT, name), size, size, renderIcon(size, opts));
  console.log(`✓ ${name} (${size}×${size}, ${(bytes / 1024).toFixed(1)} Ko)`);
}
console.log(`\nIcônes générées dans ${OUT}`);
