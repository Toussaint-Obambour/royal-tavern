#!/usr/bin/env node
/**
 * Génère des aperçus autonomes (tout est intégré dans un seul fichier .html) :
 *   - apercu-1-connexion.html  → l'écran de connexion / création de compte
 *   - apercu-2-site.html       → l'accueil du restaurant avec le menu complet
 *
 * Ces fichiers s'ouvrent en double-cliquant dessus (aucun serveur ni internet requis),
 * ce qui permet de voir à quoi ressemble la plateforme.
 *
 *   node scripts/make-standalone-preview.js
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const OUT_DIR = process.argv[2] || '/home/user';

/* ---------- Réduction des images (via Python/PIL) et conversion data URI ---------- */
function buildImageMap() {
  const dir = path.join(PUB, 'img');
  const tmp = path.join(require('os').tmpdir(), 'rt-preview-img');
  fs.mkdirSync(tmp, { recursive: true });
  const py = `
import os, sys, base64, json
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
out = {}
for name in sorted(os.listdir(src)):
    if not name.lower().endswith(('.jpg', '.jpeg', '.png')):
        continue
    p = os.path.join(src, name)
    im = Image.open(p).convert('RGB')
    large = im.width >= 1000
    target = 1100 if large else 700
    if im.width > target:
        im = im.resize((target, int(im.height * target / im.width)), Image.LANCZOS)
    q = 68 if large else 70
    f = os.path.join(dst, os.path.splitext(name)[0] + '.jpg')
    im.save(f, 'JPEG', quality=q, optimize=True, progressive=True)
    with open(f, 'rb') as fh:
        out[name] = 'data:image/jpeg;base64,' + base64.b64encode(fh.read()).decode()
print(json.dumps(out))
`;
  const json = execFileSync('python3', ['-c', py, dir, tmp], { maxBuffer: 1024 * 1024 * 200 }).toString();
  const map = JSON.parse(json);
  let total = 0;
  for (const v of Object.values(map)) total += v.length;
  console.log(`✓ ${Object.keys(map).length} images intégrées (${(total / 1024 / 1024).toFixed(1)} Mo en base64)`);
  return map;
}

const IMAGES = buildImageMap();

function inlineImages(text) {
  let out = text;
  for (const [name, uri] of Object.entries(IMAGES)) {
    // toutes les formes de référence : img/x.jpg, ../img/x.jpg, url("img/x.jpg")
    const re = new RegExp('(?:\\.\\.\\/)?img\\/' + name.replace('.', '\\.'), 'g');
    out = out.replace(re, uri);
    // version sans extension (icônes)
    const re2 = new RegExp('(?:\\.\\.\\/)?img\\/' + name.replace(/\.\w+$/, '') + '(?=["\')])', 'g');
    out = out.replace(re2, uri);
  }
  return out;
}

function inlineAssets(htmlFile, opts = {}) {
  let html = fs.readFileSync(path.join(PUB, htmlFile), 'utf8');

  // 1) Feuille de style
  const css = fs.readFileSync(path.join(PUB, 'css', 'style.css'), 'utf8');
  html = html.replace(/<link rel="stylesheet" href="css\/style\.css" \/>/,
    `<style>\n${inlineImages(css)}\n</style>`);

  // 2) Scripts
  const embedded = fs.readFileSync(path.join(PUB, 'js', 'embedded-data.js'), 'utf8');
  html = html.replace(/<script src="js\/embedded-data\.js"><\/script>/,
    `<script>\n${inlineImages(embedded)}\n</script>`);

  const app = fs.readFileSync(path.join(PUB, 'js', 'app.js'), 'utf8');
  html = html.replace(/<script src="js\/app\.js"><\/script>/,
    `<script>\n${app}\n</script>`);

  // 3) Images du corps de page
  html = inlineImages(html);

  // 4) Références externes retirées (favicon, manifeste, service worker) : inutiles en aperçu local
  html = html.replace(/<link rel="manifest"[^>]*>/g, '')
             .replace(/<link rel="apple-touch-icon"[^>]*>/g, '')
             .replace(/<link rel="icon"[^>]*>/g, '')
             .replace(/<link rel="modulepreload"[^>]*>/g, '');

  if (opts.banner) {
    const note = `
<div style="position:fixed;bottom:0;left:0;right:0;z-index:9999;background:#0b1120;color:#f0d08a;
  font:600 12px/1.4 system-ui,sans-serif;padding:7px 12px;text-align:center;border-top:1px solid #d9a83c">
  Aperçu hors serveur — la carte et les commandes WhatsApp sont visibles ; le suivi et l'enregistrement
  des commandes fonctionnent sur la version en ligne (aperçu live / votre site).
</div>`;
    html = html.replace('</body>', note + '\n</body>');
  }

  return html;
}

const files = [
  ['connexion.html', 'apercu-1-connexion.html', { banner: false }],
  ['index.html', 'apercu-2-site-menu.html', { banner: true }]
];

for (const [src, dest, opts] of files) {
  const html = inlineAssets(src, opts);
  const target = path.join(OUT_DIR, dest);
  fs.writeFileSync(target, html, 'utf8');
  console.log(`✓ ${target} (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(1)} Mo)`);
}
