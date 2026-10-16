/**
 * Le Royal Tavern — Serveur de la plateforme de commande en ligne
 * Node.js + Express, stockage JSON (aucune base de données à installer).
 *
 * Démarrage :  node server.js   (ou npm start)
 * Vitrine      :  http://localhost:3000
 * Administration :  http://localhost:3000/admin
 */
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const MENU_FILE = path.join(DATA_DIR, 'menu.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const SEED_DIR = path.join(ROOT, 'seed');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CLIENT_SESSIONS_FILE = path.join(DATA_DIR, 'client-sessions.json');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const SALT = 'royal-tavern::v1';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

/* ------------------------------------------------------------------ */
/* Petite couche de stockage JSON (lecture/écriture atomique)          */
/* ------------------------------------------------------------------ */
function readJSONSync(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return fallback;
  }
}

let writeQueue = Promise.resolve();
function writeJSON(file, data) {
  // Écriture sérialisée + atomique pour éviter toute corruption de fichier.
  writeQueue = writeQueue.then(async () => {
    const tmp = `${file}.${process.pid}.tmp`;
    await fsp.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
    await fsp.rename(tmp, file);
  }).catch((e) => console.error('[write]', e));
  return writeQueue;
}

/**
 * Prépare le dossier de données au démarrage.
 * Sur un hébergeur comme Render, un disque de stockage neuf est vide : on y recopie
 * alors le menu et les paramètres de référence (dossier « seed »), pour que le site
 * s'affiche correctement dès le premier lancement.
 */
function ensureDataFiles() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const pairs = [
      ['menu.json', path.join(DATA_DIR, 'menu.json'), path.join(SEED_DIR, 'menu.json')],
      ['settings.json', path.join(DATA_DIR, 'settings.json'), path.join(SEED_DIR, 'settings.json')]
    ];
    for (const [label, target, source] of pairs) {
      const exists = fs.existsSync(target);
      const empty = exists ? fs.statSync(target).size < 10 : true;
      if ((!exists || empty) && fs.existsSync(source)) {
        fs.copyFileSync(source, target);
        console.log(`   ↳ ${label} initialisé depuis les données de référence`);
      }
    }
    for (const [label, file, def] of [['orders.json', ORDERS_FILE, '[]'], ['users.json', USERS_FILE, '[]']]) {
      if (!fs.existsSync(file) || fs.statSync(file).size < 2) {
        fs.writeFileSync(file, def, 'utf8');
      }
    }
    for (const file of [SESSIONS_FILE, CLIENT_SESSIONS_FILE]) {
      if (!fs.existsSync(file) || fs.statSync(file).size < 2) fs.writeFileSync(file, '{}', 'utf8');
    }
  } catch (e) {
    console.error('[data] initialisation impossible :', e.message);
  }
}

/** Écrit une sauvegarde du menu/paramètres courants dans le dossier de référence. */
function backupToSeed() {
  try {
    fs.copyFileSync(MENU_FILE, path.join(SEED_DIR, 'menu.json'));
    fs.copyFileSync(SETTINGS_FILE, path.join(SEED_DIR, 'settings.json'));
  } catch (e) { /* sans conséquence */ }
}

function getMenu() {
  return readJSONSync(MENU_FILE, { categories: [], dishes: [], specials: [] });
}
function getSettings() {
  return readJSONSync(SETTINGS_FILE, {});
}
function getOrders() {
  const o = readJSONSync(ORDERS_FILE, []);
  return Array.isArray(o) ? o : [];
}

function getUsers() {
  const u = readJSONSync(USERS_FILE, []);
  return Array.isArray(u) ? u : [];
}

function publicUser(u) {
  if (!u) return null;
  return { id: u.id, name: u.name, phone: u.phone, address: u.address || '', landmark: u.landmark || '', createdAt: u.createdAt };
}

function normalizePhoneKey(phone) {
  return String(phone || '').replace(/\D/g, '');
}

/* ---------------------- Sessions des clients ---------------------- */
function loadClientSessions() {
  const s = readJSONSync(CLIENT_SESSIONS_FILE, {});
  return typeof s === 'object' && s ? s : {};
}
function createClientSession(userId) {
  const token = crypto.randomBytes(24).toString('hex');
  const sessions = loadClientSessions();
  const now = Date.now();
  for (const [k, v] of Object.entries(sessions)) {
    if (!v || now - (v.createdAt || 0) > 30 * 24 * 3600 * 1000) delete sessions[k];
  }
  sessions[token] = { userId, createdAt: now };
  writeJSON(CLIENT_SESSIONS_FILE, sessions);
  return token;
}
function currentClient(req) {
  const token = req.get('x-client-token') || (req.body && req.body.clientToken) || req.query.token;
  if (!token) return null;
  const sessions = loadClientSessions();
  const s = sessions[token];
  if (!s) return null;
  if (Date.now() - (s.createdAt || 0) > 30 * 24 * 3600 * 1000) return null;
  const user = getUsers().find((u) => u.id === s.userId);
  return user || null;
}

function sha256(value, salt = SALT) {
  return crypto.createHash('sha256').update(`${salt}::${value}`).digest('hex');
}

/* ------------------------------------------------------------------ */
/* Helpers métier                                                      */
/* ------------------------------------------------------------------ */
const DELIVERY_STATUSES = ['nouvelle', 'confirmee', 'en_preparation', 'en_livraison', 'livree', 'annulee'];
const STATUS_LABELS = {
  nouvelle: 'Nouvelle commande',
  confirmee: 'Confirmée',
  en_preparation: 'En préparation',
  en_livraison: 'En livraison',
  livree: 'Livrée / Récupérée',
  annulee: 'Annulée'
};

function sanitizeSettings(s) {
  const copy = { ...s };
  delete copy.adminPasswordHash;
  return copy;
}

function publicPayload() {
  const settings = getSettings();
  const menu = getMenu();
  return {
    settings: sanitizeSettings(settings),
    categories: menu.categories || [],
    dishes: (menu.dishes || []).map((d) => ({
      id: d.id,
      cat: d.cat,
      name: d.name,
      desc: d.desc || '',
      price: Number(d.price) || 0,
      img: d.img || '',
      badge: d.badge || '',
      available: d.available !== false,
      popular: !!d.popular
    })),
    specials: menu.specials || [],
    statuses: DELIVERY_STATUSES,
    statusLabels: STATUS_LABELS,
    serverTime: new Date().toISOString()
  };
}

function nextOrderNumber(orders) {
  const d = new Date();
  const stamp = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const prefix = `RT-${stamp}-`;
  const today = orders.filter((o) => String(o.number || '').startsWith(prefix));
  const next = today.length + 1;
  return `${prefix}${String(next).padStart(3, '0')}`;
}

function normalizePhone(p) {
  return String(p || '').replace(/[^0-9+]/g, '').trim();
}

function computeOrder(body) {
  const menu = getMenu();
  const settings = getSettings();
  const dishes = new Map((menu.dishes || []).map((d) => [d.id, d]));

  const incoming = Array.isArray(body.items) ? body.items : [];
  const items = [];
  for (const raw of incoming) {
    const dish = dishes.get(String(raw.id || ''));
    if (!dish || dish.available === false) continue;
    const qty = Math.max(1, Math.min(50, parseInt(raw.qty, 10) || 1));
    const extras = Array.isArray(raw.extras) ? raw.extras.slice(0, 20).map(String) : [];
    items.push({
      id: dish.id,
      name: dish.name,
      price: Number(dish.price) || 0,
      qty,
      extras,
      lineTotal: (Number(dish.price) || 0) * qty
    });
  }
  if (!items.length) return { error: 'Votre panier est vide ou les plats ne sont plus disponibles.' };

  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);

  const mode = ['livraison', 'emporter', 'surplace'].includes(body.mode) ? body.mode : 'livraison';
  let zone = null;
  let deliveryFee = 0;
  if (mode === 'livraison') {
    const zones = Array.isArray(settings.deliveryZones) ? settings.deliveryZones : [];
    zone = zones.find((z) => z.name === body.zone) || zones[0] || { name: 'Zone', fee: Number(settings.deliveryFee) || 0 };
    deliveryFee = Number(zone.fee) || 0;
    const freeFrom = Number(settings.freeDeliveryFrom) || 0;
    if (freeFrom > 0 && subtotal >= freeFrom) deliveryFee = 0;
  }

  const minOrder = Number(settings.minOrder) || 0;
  if (minOrder > 0 && subtotal < minOrder) {
    return { error: `Le minimum de commande est de ${minOrder.toLocaleString('fr-FR')} FCFA.` };
  }

  const payment = ['cash', 'airtel', 'moov'].includes(body.payment) ? body.payment : 'cash';

  const customer = {
    name: String(body.name || '').trim().slice(0, 80),
    phone: normalizePhone(body.phone).slice(0, 20),
    address: String(body.address || '').trim().slice(0, 250),
    landmark: String(body.landmark || '').trim().slice(0, 150)
  };
  if (customer.name.length < 2) return { error: 'Merci d’indiquer votre nom.' };
  if (customer.phone.replace(/\D/g, '').length < 6) return { error: 'Merci d’indiquer un numéro de téléphone valide.' };
  if (mode === 'livraison' && customer.address.length < 3) return { error: 'Merci d’indiquer votre adresse de livraison.' };

  return {
    order: {
      id: crypto.randomBytes(6).toString('hex'),
      number: '',
      createdAt: new Date().toISOString(),
      status: 'nouvelle',
      mode,
      zone: zone ? zone.name : '',
      customer,
      when: body.when === 'scheduled' ? 'scheduled' : 'asap',
      scheduledFor: body.scheduledFor ? String(body.scheduledFor).slice(0, 60) : '',
      payment,
      notes: String(body.notes || '').slice(0, 400),
      items,
      subtotal,
      deliveryFee,
      total: subtotal + deliveryFee,
      source: 'web'
    }
  };
}

function orderToWhatsAppText(order, settings) {
  const fcfa = (n) => `${Number(n).toLocaleString('fr-FR')} FCFA`;
  const modeLabel = { livraison: '🛵 Livraison', emporter: '🥡 À emporter', surplace: '🪑 Sur place' }[order.mode] || order.mode;
  const payLabel = {
    cash: 'Espèces à la réception',
    airtel: `Airtel Money (${(settings.payments?.airtel?.number) || ''})`,
    moov: `Moov Money (${(settings.payments?.moov?.number) || ''})`
  }[order.payment] || order.payment;

  const lines = order.items.map((i) => `• ${i.qty} × ${i.name} = ${fcfa(i.lineTotal)}`);
  const parts = [
    `*NOUVELLE COMMANDE ${order.number}*`,
    `📍 ${settings.name || 'Le Royal Tavern'}`,
    '',
    '*🛒 Ma commande :*',
    ...lines,
    '',
    `Sous-total : ${fcfa(order.subtotal)}`,
    order.mode === 'livraison' ? `Livraison${order.zone ? ` (${order.zone})` : ''} : ${order.deliveryFee > 0 ? fcfa(order.deliveryFee) : 'Offerte 🎉'}` : '',
    `*TOTAL : ${fcfa(order.total)}*`,
    '',
    `*👤 Client :* ${order.customer.name}`,
    `*📞 Téléphone :* ${order.customer.phone}`,
    `${modeLabel}`,
    order.mode === 'livraison' ? `*🏠 Adresse :* ${order.customer.address}` : '',
    order.customer.landmark ? `*🧭 Repère :* ${order.customer.landmark}` : '',
    `*💳 Paiement :* ${payLabel}`,
    order.when === 'scheduled' && order.scheduledFor ? `*⏰ Souhaité :* ${order.scheduledFor}` : `*⏰ Dès que possible*`,
    order.notes ? `*📝 Note :* ${order.notes}` : '',
    '',
    'Merci de confirmer la disponibilité et le temps de préparation. 🙏'
  ].filter((l) => l !== '');
  return parts.join('\n');
}

/* ------------------------------------------------------------------ */
/* Sessions admin                                                      */
/* ------------------------------------------------------------------ */
function loadSessions() {
  const s = readJSONSync(SESSIONS_FILE, {});
  return typeof s === 'object' && s ? s : {};
}
function saveSessions(sessions) {
  return writeJSON(SESSIONS_FILE, sessions);
}
function createSession() {
  const token = crypto.randomBytes(24).toString('hex');
  const sessions = loadSessions();
  // purge des sessions de plus de 7 jours
  const now = Date.now();
  for (const [k, v] of Object.entries(sessions)) {
    if (!v || now - (v.createdAt || 0) > 7 * 24 * 3600 * 1000) delete sessions[k];
  }
  sessions[token] = { createdAt: now };
  saveSessions(sessions);
  return token;
}
function isAdmin(req) {
  const token = req.get('x-admin-token') || req.query.token || (req.body && req.body.token);
  if (!token) return false;
  const sessions = loadSessions();
  const s = sessions[token];
  if (!s) return false;
  if (Date.now() - (s.createdAt || 0) > 7 * 24 * 3600 * 1000) return false;
  return true;
}
function requireAdmin(req, res, next) {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Session expirée, reconnectez-vous.' });
  next();
}

/* ------------------------------------------------------------------ */
/* Routes publiques                                                    */
/* ------------------------------------------------------------------ */
app.get('/api/health', (req, res) => {
  const menu = getMenu();
  res.json({
    ok: true,
    name: 'Le Royal Tavern',
    time: new Date().toISOString(),
    dishes: (menu.dishes || []).length,
    orders: getOrders().length,
    storage: fs.existsSync(DATA_DIR) ? 'ok' : 'absent'
  });
});

app.get('/api/public', (req, res) => res.json(publicPayload()));

app.post('/api/orders', async (req, res) => {
  try {
    const body = req.body || {};
    if (String(body.website || '').trim() !== '') {
      return res.json({ ok: true, honeypot: true }); // piège anti-spam
    }
    const result = computeOrder(body);
    if (result.error) return res.status(400).json({ error: result.error });

    const order = result.order;
    const client = currentClient(req);
    if (client) {
      order.clientId = client.id;
      if (!order.customer.name) order.customer.name = client.name;
      if (!order.customer.phone) order.customer.phone = client.phone;
      if (!order.customer.address) order.customer.address = client.address || '';
    }
    const orders = getOrders();
    order.number = nextOrderNumber(orders);
    orders.unshift(order);
    await writeJSON(ORDERS_FILE, orders.slice(0, 2000));

    const settings = getSettings();
    const waText = orderToWhatsAppText(order, settings);
    const waNumber = String(settings.whatsapp || '').replace(/\D/g, '');
    const waUrl = waNumber ? `https://wa.me/${waNumber}?text=${encodeURIComponent(waText)}` : '';

    // Notification best-effort vers un webhook (n8n / Zapier / Make) si configuré
    const hook = process.env.ORDER_WEBHOOK_URL;
    if (hook) {
      fetch(hook, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ event: 'order.created', order, waText })
      }).catch(() => {});
    }

    res.json({ ok: true, order, whatsappUrl: waUrl, whatsappText: waText });
  } catch (e) {
    console.error('[order]', e);
    res.status(500).json({ error: 'Erreur serveur, merci de réessayer ou d’appeler le restaurant.' });
  }
});

app.get('/api/track', (req, res) => {
  // Un utilisateur connecté peut consulter le détail d'une de ses propres commandes
  const client = currentClient(req);
  const number = String(req.query.number || '').trim().toUpperCase();
  const phone = String(req.query.phone || '').replace(/\D/g, '').slice(-6);
  if (!number) return res.status(400).json({ error: 'Numéro de commande manquant.' });
  const order = getOrders().find((o) => String(o.number || '').toUpperCase() === number);
  if (!order) return res.status(404).json({ error: 'Commande introuvable. Vérifiez le numéro.' });
  if (client && order.clientId === client.id) {
    // accès direct au suivi de ses propres commandes
  }
  if (phone && !String(order.customer?.phone || '').replace(/\D/g, '').endsWith(phone)) {
    return res.status(403).json({ error: 'Téléphone ne correspondant pas à cette commande.' });
  }
  res.json({
    ok: true,
    order: {
      number: order.number,
      status: order.status,
      statusLabel: STATUS_LABELS[order.status] || order.status,
      createdAt: order.createdAt,
      mode: order.mode,
      total: order.total,
      items: order.items
    }
  });
});


/* ------------------------------------------------------------------ */
/* Comptes clients : inscription, connexion, profil, mes commandes     */
/* ------------------------------------------------------------------ */
app.post('/api/auth/signup', async (req, res) => {
  try {
    const body = req.body || {};
    if (String(body.website || '').trim() !== '') return res.json({ ok: true, honeypot: true });

    const name = String(body.name || '').trim().slice(0, 80);
    const phone = String(body.phone || '').trim().slice(0, 20);
    const password = String(body.password || '');
    const phoneKey = normalizePhoneKey(phone);

    if (name.length < 2) return res.status(400).json({ error: 'Merci d’indiquer votre nom complet.' });
    if (phoneKey.length < 6) return res.status(400).json({ error: 'Merci d’indiquer un numéro de téléphone valide.' });
    if (password.length < 4) return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 4 caractères.' });

    const users = getUsers();
    if (users.some((u) => normalizePhoneKey(u.phone) === phoneKey)) {
      return res.status(409).json({ error: 'Un compte existe déjà avec ce numéro. Connectez-vous plutôt.' });
    }

    const user = {
      id: crypto.randomBytes(6).toString('hex'),
      name,
      phone,
      passwordHash: sha256(password),
      address: String(body.address || '').slice(0, 250),
      landmark: String(body.landmark || '').slice(0, 150),
      createdAt: new Date().toISOString()
    };
    users.push(user);
    await writeJSON(USERS_FILE, users);
    const token = createClientSession(user.id);
    res.json({ ok: true, token, user: publicUser(user) });
  } catch (e) {
    console.error('[signup]', e);
    res.status(500).json({ error: 'Création du compte impossible, merci de réessayer.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const body = req.body || {};
  const phoneKey = normalizePhoneKey(body.phone);
  const password = String(body.password || '');
  const user = getUsers().find((u) => normalizePhoneKey(u.phone) === phoneKey);
  const expected = user ? user.passwordHash : sha256('__introuvable__');
  const given = Buffer.from(sha256(password));
  const target = Buffer.from(expected);
  const ok = !!user && given.length === target.length && crypto.timingSafeEqual(given, target);
  if (!ok) return res.status(401).json({ error: 'Numéro ou mot de passe incorrect.' });
  const token = createClientSession(user.id);
  res.json({ ok: true, token, user: publicUser(user) });
});

app.get('/api/auth/me', (req, res) => {
  const user = currentClient(req);
  res.json({ ok: !!user, user: publicUser(user) });
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.get('x-client-token') || (req.body || {}).token;
  const sessions = loadClientSessions();
  if (token && sessions[token]) { delete sessions[token]; writeJSON(CLIENT_SESSIONS_FILE, sessions); }
  res.json({ ok: true });
});

app.put('/api/auth/profile', async (req, res) => {
  const user = currentClient(req);
  if (!user) return res.status(401).json({ error: 'Connectez-vous pour modifier votre profil.' });
  const body = req.body || {};
  const users = getUsers();
  const target = users.find((u) => u.id === user.id);
  if (!target) return res.status(404).json({ error: 'Compte introuvable.' });
  if (body.name !== undefined) {
    const n = String(body.name).trim().slice(0, 80);
    if (n.length < 2) return res.status(400).json({ error: 'Nom trop court.' });
    target.name = n;
  }
  if (body.address !== undefined) target.address = String(body.address).slice(0, 250);
  if (body.landmark !== undefined) target.landmark = String(body.landmark).slice(0, 150);
  if (body.newPassword) {
    const pwd = String(body.newPassword);
    if (pwd.length < 4) return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 4 caractères.' });
    target.passwordHash = sha256(pwd);
  }
  await writeJSON(USERS_FILE, users);
  res.json({ ok: true, user: publicUser(target) });
});

app.get('/api/auth/orders', (req, res) => {
  const user = currentClient(req);
  if (!user) return res.status(401).json({ error: 'Connectez-vous pour voir vos commandes.' });
  const mine = getOrders()
    .filter((o) => o.clientId === user.id)
    .slice(0, 50)
    .map((o) => ({
      number: o.number, createdAt: o.createdAt, status: o.status,
      statusLabel: STATUS_LABELS[o.status] || o.status, mode: o.mode,
      total: o.total, items: o.items
    }));
  res.json({ ok: true, orders: mine });
});

/* ------------------------------------------------------------------ */
/* Routes admin                                                        */
/* ------------------------------------------------------------------ */
app.post('/api/admin/login', (req, res) => {
  const password = String((req.body || {}).password || '');
  const settings = getSettings();
  const stored = settings.adminPasswordHash;
  const DEFAULT_PASSWORD = 'royal2026';
  const expected = stored || sha256(DEFAULT_PASSWORD);

  const given = Buffer.from(sha256(password));
  const target = Buffer.from(expected);
  const ok = password.length > 0 && given.length === target.length && crypto.timingSafeEqual(given, target);
  if (!ok) return res.status(401).json({ error: 'Mot de passe incorrect.' });

  if (!stored) {
    settings.adminPasswordHash = expected;
    writeJSON(SETTINGS_FILE, settings);
  }
  const token = createSession();
  res.json({ ok: true, token, isDefaultPassword: !stored });
});

// Déconnexion : supprime le jeton courant
app.post('/api/admin/logout', (req, res) => {
  const token = req.get('x-admin-token') || (req.body || {}).token;
  const sessions = loadSessions();
  if (token && sessions[token]) {
    delete sessions[token];
    saveSessions(sessions);
  }
  res.json({ ok: true });
});

app.get('/api/admin/session', (req, res) => {
  const settings = getSettings();
  res.json({
    ok: isAdmin(req),
    usingDefaultPassword: !settings.adminPasswordHash
  });
});

app.get('/api/admin/data', requireAdmin, (req, res) => {
  res.json({
    ok: true,
    menu: getMenu(),
    settings: sanitizeSettings(getSettings()),
    orders: getOrders(),
    statuses: DELIVERY_STATUSES,
    statusLabels: STATUS_LABELS
  });
});

app.put('/api/admin/menu', requireAdmin, async (req, res) => {
  const body = req.body || {};
  const current = getMenu();
  const next = {
    categories: Array.isArray(body.categories) ? body.categories : current.categories,
    dishes: Array.isArray(body.dishes) ? body.dishes : current.dishes,
    specials: Array.isArray(body.specials) ? body.specials : current.specials
  };

  // validation minimale
  const ids = new Set();
  for (const d of next.dishes) {
    if (!d || !d.name || typeof d.price !== 'number' || Number.isNaN(d.price)) {
      return res.status(400).json({ error: 'Chaque plat doit avoir un nom et un prix valide.' });
    }
    d.id = String(d.id || crypto.randomBytes(4).toString('hex'));
    if (ids.has(d.id)) d.id = crypto.randomBytes(4).toString('hex');
    ids.add(d.id);
    d.available = d.available !== false;
  }
  next.categories = next.categories.filter((c) => c && c.id && c.name);

  await writeJSON(MENU_FILE, next);
  backupToSeed();
  res.json({ ok: true, menu: next });
});

app.put('/api/admin/settings', requireAdmin, async (req, res) => {
  const body = req.body || {};
  const current = getSettings();
  const allowed = [
    'name', 'tagline', 'slogan', 'about', 'whatsapp', 'phone', 'email', 'address', 'mapsQuery',
    'hoursText', 'openHour', 'closeHour', 'deliveryFee', 'freeDeliveryFrom', 'deliveryZones',
    'payments', 'services', 'social', 'reviews', 'announcement', 'announcementActive', 'minOrder'
  ];
  const next = { ...current };
  for (const key of allowed) {
    if (body[key] !== undefined) next[key] = body[key];
  }
  if (body.newPassword) {
    const pwd = String(body.newPassword);
    if (pwd.length < 6) return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères.' });
    next.adminPasswordHash = sha256(pwd);
  }
  await writeJSON(SETTINGS_FILE, next);
  backupToSeed();
  res.json({ ok: true, settings: sanitizeSettings(next) });
});

app.put('/api/admin/orders/:id', requireAdmin, async (req, res) => {
  const status = String((req.body || {}).status || '');
  if (!DELIVERY_STATUSES.includes(status)) return res.status(400).json({ error: 'Statut inconnu.' });
  const orders = getOrders();
  const order = orders.find((o) => o.id === req.params.id || o.number === req.params.id);
  if (!order) return res.status(404).json({ error: 'Commande introuvable.' });
  order.status = status;
  order.updatedAt = new Date().toISOString();
  await writeJSON(ORDERS_FILE, orders);
  res.json({ ok: true, order });
});

app.delete('/api/admin/orders/:id', requireAdmin, async (req, res) => {
  const orders = getOrders();
  const next = orders.filter((o) => o.id !== req.params.id && o.number !== req.params.id);
  if (next.length === orders.length) return res.status(404).json({ error: 'Commande introuvable.' });
  await writeJSON(ORDERS_FILE, next);
  res.json({ ok: true });
});

app.get('/api/admin/export.csv', requireAdmin, (req, res) => {
  const orders = getOrders();
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [
    ['Numero', 'Date', 'Statut', 'Client', 'Telephone', 'Mode', 'Zone', 'Adresse', 'Paiement', 'Plats', 'Sous_total', 'Livraison', 'Total', 'Note'].join(';')
  ];
  for (const o of orders) {
    rows.push([
      esc(o.number), esc(o.createdAt), esc(STATUS_LABELS[o.status] || o.status), esc(o.customer?.name), esc(o.customer?.phone),
      esc(o.mode), esc(o.zone), esc(o.customer?.address), esc(o.payment),
      esc((o.items || []).map((i) => `${i.qty}x ${i.name}`).join(' | ')),
      esc(o.subtotal), esc(o.deliveryFee), esc(o.total), esc(o.notes)
    ].join(';'));
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="commandes-royal-tavern-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send('\uFEFF' + rows.join('\n'));
});

app.get('/api/admin/qrcode-target', requireAdmin, (req, res) => {
  const proto = req.get('x-forwarded-proto') || req.protocol;
  res.json({ url: `${proto}://${req.get('host')}/` });
});

/* ------------------------------------------------------------------ */
/* QR code du menu en ligne (impression / affiche)                     */
/* ------------------------------------------------------------------ */
let QRCode = null;
try { QRCode = require('qrcode'); } catch (e) { /* dépendance optionnelle */ }

app.get('/api/qr.png', async (req, res) => {
  const data = String(req.query.data || `${req.get('x-forwarded-proto') || req.protocol}://${req.get('host')}/`).slice(0, 600);
  const size = Math.max(128, Math.min(1200, parseInt(req.query.size, 10) || 420));
  if (!QRCode) return res.status(501).json({ error: 'Module qrcode non installé (npm install).' });
  try {
    const buf = await QRCode.toBuffer(data, {
      type: 'png',
      width: size,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#0b1120ff', light: '#ffffffff' }
    });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(buf);
  } catch (e) {
    res.status(500).json({ error: 'Impossible de générer le QR code.' });
  }
});

/* ------------------------------------------------------------------ */
/* Fichiers statiques                                                  */
/* ------------------------------------------------------------------ */
app.use(express.static(PUBLIC_DIR, {
  extensions: ['html'],
  setHeaders(res, filePath) {
    if (filePath.endsWith('sw.js')) {
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Service-Worker-Allowed', '/');
    }
  }
}));

app.get('/admin', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin.html')));
app.get('/suivi', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'suivi.html')));
app.get(['/connexion', '/inscription', '/login'], (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'connexion.html')));
app.get(['/compte', '/mes-commandes'], (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'compte.html')));
app.get('/affiche', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'affiche.html')));

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Route inconnue' });
  res.status(404).sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

ensureDataFiles();

app.listen(PORT, HOST, () => {
  const settings = getSettings();
  console.log(`\n👑  ${settings.name || 'Le Royal Tavern'} — plateforme en ligne`);
  console.log(`    Accueil / connexion : http://localhost:${PORT}`);
  console.log(`    Compte client : http://localhost:${PORT}/compte`);
  console.log(`    Administration : http://localhost:${PORT}/admin`);
  console.log(`    Suivi commande : http://localhost:${PORT}/suivi`);
  console.log(`    WhatsApp restaurant : ${settings.whatsapp || '(à renseigner dans l’admin)'}\n`);
});
