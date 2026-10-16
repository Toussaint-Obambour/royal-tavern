#!/usr/bin/env node
/**
 * Génère public/js/embedded-data.js : la carte et les paramètres du restaurant
 * embarqués dans l'application. Cela permet à l'application Android (et à la
 * PWA) d'afficher le menu même sans connexion internet.
 *
 *   node scripts/build-embedded-data.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const menu = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'menu.json'), 'utf8'));
const settings = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'settings.json'), 'utf8'));

// On ne diffuse jamais le mot de passe dans le fichier embarqué côté client.
delete settings.adminPasswordHash;

const payload = {
  generatedAt: new Date().toISOString(),
  settings,
  categories: menu.categories || [],
  dishes: (menu.dishes || []).map((d) => ({
    id: d.id, cat: d.cat, name: d.name, desc: d.desc || '',
    price: Number(d.price) || 0, img: d.img || '', badge: d.badge || '',
    available: d.available !== false, popular: !!d.popular
  })),
  specials: menu.specials || []
};

const out = `/* Généré automatiquement le ${payload.generatedAt} — ne pas modifier à la main.
   Source : data/menu.json + data/settings.json  (npm run build:data) */
window.RT_FALLBACK = ${JSON.stringify(payload, null, 1)};
`;

const target = path.join(ROOT, 'public', 'js', 'embedded-data.js');
fs.writeFileSync(target, out, 'utf8');
console.log(`✓ ${path.relative(ROOT, target)} (${payload.dishes.length} plats embarqués)`);
