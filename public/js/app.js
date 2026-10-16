/* ==========================================================================
   Le Royal Tavern — application de commande en ligne (côté client)
   ========================================================================== */
(function () {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const FC = (n) => `${Number(n || 0).toLocaleString('fr-FR')} FCFA`;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  /* Accès sécurisé au stockage local (certains navigateurs/aperçus le bloquent) */
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    remove(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  const CART_KEY = 'rt_cart_v1';
  const CUSTOMER_KEY = 'rt_customer_v1';

  const state = {
    settings: {},
    categories: [],
    dishes: [],
    specials: [],
    cart: [],
    filter: 'all',
    search: '',
    activeDish: null,
    dishQty: 1,
    dishOptions: new Set(),
    mode: 'livraison',
    payment: 'cash',
    lastOrder: null,
    deferredPrompt: null,
    offline: false,
    user: null,
    clientToken: ''
  };

  const CLIENT_TOKEN_KEY = 'rt_client_token';

  /* ------------------------------------------------------------------ */
  /* Utilitaires                                                         */
  /* ------------------------------------------------------------------ */
  function toast(message, type = '') {
    const wrap = $('#toastWrap');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${type === 'ok' ? '✅' : type === 'err' ? '⚠️' : '👑'}</span><span>${esc(message)}</span>`;
    wrap.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .3s, transform .3s';
      el.style.opacity = '0';
      el.style.transform = 'translateY(8px)';
      setTimeout(() => el.remove(), 320);
    }, 3200);
  }

  function waLink(text) {
    const num = String(state.settings.whatsapp || '').replace(/\D/g, '');
    const base = num ? `https://wa.me/${num}` : 'https://wa.me/';
    return `${base}?text=${encodeURIComponent(text)}`;
  }

  function saveCart() {
    store.set(CART_KEY, JSON.stringify(state.cart));
  }
  function loadCart() {
    try {
      const raw = JSON.parse(store.get(CART_KEY) || '[]');
      state.cart = Array.isArray(raw) ? raw : [];
    } catch (e) { state.cart = []; }
  }

  function cartTotals() {
    const subtotal = state.cart.reduce((s, i) => s + i.price * i.qty, 0);
    let delivery = 0;
    if (state.mode === 'livraison') {
      const zone = currentZone();
      delivery = Number(zone?.fee || state.settings.deliveryFee || 0);
      const freeFrom = Number(state.settings.freeDeliveryFrom || 0);
      if (freeFrom > 0 && subtotal >= freeFrom) delivery = 0;
    }
    return { subtotal, delivery, total: subtotal + delivery };
  }

  function currentZone() {
    const zones = state.settings.deliveryZones || [];
    const sel = $('#ckZone');
    const wanted = sel && sel.value ? sel.value : (zones[0] && zones[0].name);
    return zones.find((z) => z.name === wanted) || zones[0] || null;
  }

  function isOpenNow() {
    const { openHour = 10, closeHour = 23 } = state.settings;
    const h = new Date().getHours() + new Date().getMinutes() / 60;
    return h >= openHour && h < closeHour;
  }


  /* ------------------------------------------------------------------ */
  /* Mode hors ligne : message WhatsApp construit localement             */
  /* ------------------------------------------------------------------ */
  function buildLocalWhatsAppText(order) {
    const modeLabel = { livraison: '🛵 Livraison', emporter: '🥡 À emporter', surplace: '🪑 Sur place' }[order.mode] || order.mode;
    const payLabel = {
      cash: 'Espèces à la réception',
      airtel: `Airtel Money (${state.settings.payments?.airtel?.number || ''})`,
      moov: `Moov Money (${state.settings.payments?.moov?.number || ''})`
    }[order.payment] || order.payment;
    const lines = order.items.map((i) => `• ${i.qty} × ${i.name} = ${FC(i.lineTotal || i.price * i.qty)}`);
    return [
      `*NOUVELLE COMMANDE ${order.number}*`,
      `📍 ${state.settings.name || 'Le Royal Tavern'}`,
      '',
      '*🛒 Ma commande :*',
      ...lines,
      '',
      `Sous-total : ${FC(order.subtotal)}`,
      order.mode === 'livraison' ? `Livraison${order.zone ? ` (${order.zone})` : ''} : ${order.deliveryFee > 0 ? FC(order.deliveryFee) : 'Offerte 🎉'}` : '',
      `*TOTAL : ${FC(order.total)}*`,
      '',
      `*👤 Client :* ${order.customer.name}`,
      `*📞 Téléphone :* ${order.customer.phone}`,
      modeLabel,
      order.mode === 'livraison' ? `*🏠 Adresse :* ${order.customer.address}` : '',
      order.customer.landmark ? `*🧭 Repère :* ${order.customer.landmark}` : '',
      `*💳 Paiement :* ${payLabel}`,
      order.when === 'scheduled' && order.scheduledFor ? `*⏰ Souhaité :* ${order.scheduledFor}` : '*⏰ Dès que possible*',
      order.notes ? `*📝 Note :* ${order.notes}` : '',
      '',
      'Merci de confirmer la disponibilité et le temps de préparation. 🙏'
    ].filter((l) => l !== '').join('\n');
  }

  function localOrderFromPayload(payload) {
    const { subtotal, delivery } = cartTotals();
    const items = state.cart.map((i) => ({
      id: i.id, name: i.name, price: i.price, qty: i.qty, extras: i.extras, lineTotal: i.price * i.qty
    }));
    const stamp = new Date();
    const num = `RT-${String(stamp.getFullYear()).slice(2)}${String(stamp.getMonth() + 1).padStart(2, '0')}${String(stamp.getDate()).padStart(2, '0')}-LOCAL`;
    return {
      number: num,
      mode: payload.mode,
      zone: payload.zone,
      customer: { name: payload.name, phone: payload.phone, address: payload.address, landmark: payload.landmark },
      when: payload.when,
      scheduledFor: payload.scheduledFor,
      payment: payload.payment,
      notes: payload.notes,
      items,
      subtotal,
      deliveryFee: payload.mode === 'livraison' ? delivery : 0,
      total: subtotal + (payload.mode === 'livraison' ? delivery : 0)
    };
  }

  /* ------------------------------------------------------------------ */
  /* Rendu vitrine                                                       */
  /* ------------------------------------------------------------------ */
  function renderAccount() {
    // En mode hors ligne (application embarquée), l'espace client n'est pas disponible :
    // on masque les liens pour éviter les pages vides.
    if (state.offline) {
      const chipEl = $('#accountChip');
      if (chipEl) chipEl.hidden = true;
      const tab = $('#tabAccount');
      if (tab) tab.hidden = true;
      return;
    }
    const chip = $('#accountName');
    if (!chip) return;
    if (state.user) {
      const first = String(state.user.name || '').split(' ')[0];
      chip.textContent = first || 'Mon compte';
      const el = $('#accountChip');
      if (el) el.title = `Mon compte (${state.user.phone})`;
    } else if (store.get('rt_guest') === '1') {
      chip.textContent = 'Se connecter';
    } else {
      chip.textContent = 'Mon compte';
    }
  }

  function renderHeaderAndFooter() {
    const s = state.settings;
    document.title = `${s.name || 'Le Royal Tavern'} — Grillades & plats à commander en ligne | Libreville`;

    if (s.announcement && s.announcementActive !== false) {
      $('#announceText').textContent = s.announcement;
      $('#announceBar').hidden = false;
    } else {
      $('#announceBar').hidden = true;
    }

    $('#heroTagline').textContent = s.tagline || '';
    $('#heroAddress').textContent = s.address || '';
    $('#heroHours').textContent = s.hoursText || '';
    const freeFrom = Number(s.freeDeliveryFrom || 0);
    $('#heroDelivery').textContent = s.deliveryFee != null
      ? `À partir de ${FC(s.deliveryFee)}${freeFrom ? ` · offerte dès ${FC(freeFrom)}` : ''}`
      : '';

    const open = isOpenNow();
    const pill = $('#heroStatus');
    pill.classList.toggle('closed', !open);
    $('#heroStatusText').textContent = open
      ? `Ouvert maintenant · ${s.hoursText || ''}`
      : `Fermé actuellement · ${s.hoursText || 'ouvre bientôt'}`;

    const waDefault = waLink(`Bonjour ${s.name || ''}, je souhaite passer une commande. 🍽️`);
    ['#heroWhatsapp', '#aboutWhatsapp', '#footerWhatsapp', '#contactWhatsapp'].forEach((sel) => {
      const el = $(sel); if (el) el.href = waDefault;
    });
    $('#reviewWhatsapp').href = waLink(`Bonjour ${s.name || ''}, je souhaite laisser un avis sur votre restaurant : `);

    const tel = String(s.phone || '').replace(/\s/g, '');
    ['#contactPhone', '#footerPhone', '#phoneTop'].forEach((sel) => {
      const el = $(sel);
      if (el) { el.href = `tel:${tel}`; if (el.tagName === 'A' && sel === '#contactPhone') el.textContent = s.phone || '—'; }
    });
    $('#footerPhone').textContent = s.phone || 'Téléphone';
    $('#confirmCall').href = `tel:${tel}`;

    $('#aboutText').textContent = s.about || '';
    $('#contactAddress').textContent = s.address || '';
    $('#contactHours').textContent = s.hoursText || '';
    const zonesTxt = (s.deliveryZones || []).map((z) => `${z.name} (${FC(z.fee)})`).join(' · ');
    $('#contactZones').textContent = zonesTxt || '—';
    const pays = ['Espèces'];
    if (s.payments?.airtel?.enabled) pays.push('Airtel Money');
    if (s.payments?.moov?.enabled) pays.push('Moov Money');
    $('#contactPayments').textContent = pays.join(' · ');
    $('#footerAddress').textContent = s.address || '';
    $('#footerHours').textContent = s.hoursText || '';
    $('#year').textContent = new Date().getFullYear();

    const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.mapsQuery || s.address || '')}`;
    $('#mapsBtn').href = maps; $('#mapsBtn2').href = maps; $('#footerMaps').href = maps;

    const social = s.social || {};
    const icons = { facebook: '📘', instagram: '📸', tiktok: '🎵' };
    const row = $('#socialRow');
    row.innerHTML = Object.entries(social)
      .filter(([, url]) => !!url)
      .map(([k, url]) => `<a href="${esc(url)}" target="_blank" rel="noopener" title="${esc(k)}">${icons[k] || '🔗'}</a>`)
      .join('');

    // Réseaux : désactiver les paiements non activés
    $$('#paySeg button').forEach((b) => {
      const v = b.dataset.value;
      const ok = v === 'cash' || s.payments?.[v]?.enabled;
      b.hidden = !ok;
    });
  }

  function renderCategories() {
    const chips = $('#categoryChips');
    const all = [{ id: 'all', name: 'Tout le menu', icon: '👑' }, ...state.categories];
    chips.innerHTML = all.map((c) => (
      `<button class="chip ${state.filter === c.id ? 'active' : ''}" data-cat="${esc(c.id)}" role="tab">
        <span>${esc(c.icon || '')}</span>${esc(c.name)}
      </button>`
    )).join('');
    $$('.chip', chips).forEach((b) => b.addEventListener('click', () => {
      state.filter = b.dataset.cat;
      renderCategories(); renderDishes();
    }));
  }

  function dishCard(d) {
    const inCart = state.cart.find((i) => i.id === d.id);
    const cat = state.categories.find((c) => c.id === d.cat);
    const media = d.img
      ? `<img src="${esc(d.img)}" alt="${esc(d.name)}" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'fallback',textContent:'${esc(cat?.icon || '🍽️')}'}))" />`
      : `<span class="fallback">${esc(cat?.icon || '🍽️')}</span>`;
    return `
      <article class="dish ${inCart ? 'in-cart' : ''}" data-id="${esc(d.id)}" tabindex="0" role="button"
               aria-label="Voir ${esc(d.name)}">
        <div class="dish-media">
          ${media}
          ${d.badge ? `<span class="badge">${esc(d.badge)}</span>` : ''}
          ${d.available === false ? '<span class="dish-out">Épuisé</span>' : ''}
          ${inCart ? `<span class="dish-qty">×${inCart.qty} au panier</span>` : ''}
        </div>
        <div class="dish-body">
          <h3 class="dish-name">${esc(d.name)}</h3>
          <p class="dish-desc">${esc(d.desc)}</p>
          <div class="dish-foot">
            <span class="dish-price">${FC(d.price)}</span>
            <button class="add-btn" data-add="${esc(d.id)}" aria-label="Ajouter ${esc(d.name)} au panier"
              ${d.available === false ? 'disabled style="opacity:.4;cursor:not-allowed"' : ''}>+</button>
          </div>
        </div>
      </article>`;
  }

  function renderDishes() {
    const q = state.search.trim().toLowerCase();
    const list = state.dishes.filter((d) => {
      const okCat = state.filter === 'all' || d.cat === state.filter;
      const okQ = !q || d.name.toLowerCase().includes(q) || (d.desc || '').toLowerCase().includes(q);
      return okCat && okQ;
    });
    const grid = $('#dishGrid');
    grid.innerHTML = list.map(dishCard).join('');
    $('#menuEmpty').hidden = list.length > 0;

    $$('.dish', grid).forEach((card) => {
      const id = card.dataset.id;
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-add]')) return;
        openDish(id);
      });
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDish(id); } });
    });
    $$('[data-add]', grid).forEach((btn) => btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const d = state.dishes.find((x) => x.id === btn.dataset.add);
      if (!d || d.available === false) return;
      addToCart(d, 1, []);
      toast(`${d.name} ajouté au panier`, 'ok');
    }));
  }

  function renderSpecials() {
    const today = new Date().getDay();
    const order = [1, 2, 3, 4, 5, 6, 0];
    const days = { 1: 'Lundi', 2: 'Mardi', 3: 'Mercredi', 4: 'Jeudi', 5: 'Vendredi', 6: 'Samedi', 0: 'Dimanche' };
    const list = [...(state.specials || [])].sort((a, b) => order.indexOf(a.day) - order.indexOf(b.day));
    $('#specialsGrid').innerHTML = list.map((s) => `
      <article class="special ${s.day === today ? 'today' : ''}">
        <span class="special-day">${esc(days[s.day] || '')} ${s.day === today ? '<span class="today-tag">AUJOURD’HUI</span>' : ''}</span>
        <h3>${esc(s.name)}</h3>
        <p>${esc(s.desc || '')}</p>
        <div class="special-price">${FC(s.price)}</div>
      </article>`).join('');
  }

  function renderReviews() {
    const list = state.settings.reviews || [];
    $('#reviewsGrid').innerHTML = list.map((r) => `
      <article class="review">
        <div class="stars">${'★'.repeat(Math.max(1, Math.min(5, r.stars || 5)))}${'☆'.repeat(5 - Math.max(1, Math.min(5, r.stars || 5)))}</div>
        <p>« ${esc(r.text)} »</p>
        <footer><b>${esc(r.name)}</b><span>${esc(r.city || '')}</span></footer>
      </article>`).join('');
  }

  /* ------------------------------------------------------------------ */
  /* Panier                                                              */
  /* ------------------------------------------------------------------ */
  function addToCart(dish, qty, extras) {
    const key = `${dish.id}|${extras.slice().sort().join(',')}`;
    const found = state.cart.find((i) => i.key === key);
    if (found) found.qty = Math.min(50, found.qty + qty);
    else state.cart.push({
      key, id: dish.id, name: dish.name, price: Number(dish.price) || 0,
      qty, extras, img: dish.img || ''
    });
    saveCart(); syncCart();
  }

  function syncCart() {
    const count = state.cart.reduce((s, i) => s + i.qty, 0);
    const { subtotal, delivery, total } = cartTotals();
    $$('.cart-count').forEach((el) => { el.textContent = count; });
    $('#cartCountTab').textContent = count;
    const floating = $('#floatingCart');
    floating.hidden = count === 0;
    $('#floatingCount').textContent = count;
    $('#floatingTotal').textContent = FC(subtotal);
    renderCartDrawer();
    renderDishes();
    if (!$('#checkoutModal').hidden) renderCheckoutSummary();
  }

  function renderCartDrawer() {
    const body = $('#cartItems');
    const { subtotal, delivery, total } = cartTotals();
    if (!state.cart.length) {
      body.innerHTML = `<div class="cart-empty"><span class="big">🛒</span>
        <p>Votre panier est vide.<br>Parcourez le menu et ajoutez vos plats préférés.</p>
        <button class="btn btn-dark" id="cartGoMenu">Voir le menu</button></div>`;
      $('#cartGoMenu')?.addEventListener('click', () => { closeDrawer(); location.hash = '#menu'; });
    } else {
      body.innerHTML = state.cart.map((i) => `
        <div class="cart-item" data-key="${esc(i.key)}">
          <div class="thumb">${i.img ? `<img src="${esc(i.img)}" alt="">` : '🍽️'}</div>
          <div>
            <h4>${esc(i.name)}</h4>
            ${i.extras?.length ? `<p class="opts">${esc(i.extras.join(' · '))}</p>` : ''}
            <p class="unit">${FC(i.price)} l'unité</p>
            <div class="qty-row">
              <button class="qty-btn" data-dec>−</button>
              <input type="number" value="${i.qty}" min="1" max="50" data-qty inputmode="numeric" />
              <button class="qty-btn" data-inc>+</button>
              <button class="remove" data-remove>Retirer</button>
            </div>
          </div>
          <span class="line-total">${FC(i.price * i.qty)}</span>
        </div>`).join('');
    }

    $('#cartSubtotal').textContent = FC(subtotal);
    const row = $('#cartDeliveryRow');
    if (state.mode === 'livraison' && state.cart.length) {
      row.hidden = false;
      $('#cartDelivery').textContent = delivery === 0 ? 'Offerte 🎉' : FC(delivery);
    } else row.hidden = true;
    $('#cartTotal').textContent = FC(total);
    $('#checkoutBtn').disabled = !state.cart.length;
    $('#cartClearBtn').hidden = !state.cart.length;

    const freeFrom = Number(state.settings.freeDeliveryFrom || 0);
    $('#cartHint').textContent = state.cart.length && freeFrom && subtotal < freeFrom && state.mode === 'livraison'
      ? `Plus que ${FC(freeFrom - subtotal)} pour la livraison offerte 🛵`
      : (state.settings.minOrder ? `Commande minimum : ${FC(state.settings.minOrder)}` : '');

    $$('.cart-item', body).forEach((item) => {
      const key = item.dataset.key;
      const entry = state.cart.find((i) => i.key === key);
      if (!entry) return;
      $('[data-inc]', item).addEventListener('click', () => { entry.qty = Math.min(50, entry.qty + 1); saveCart(); syncCart(); });
      $('[data-dec]', item).addEventListener('click', () => {
        entry.qty -= 1;
        if (entry.qty <= 0) state.cart = state.cart.filter((i) => i.key !== key);
        saveCart(); syncCart();
      });
      $('[data-qty]', item).addEventListener('change', (e) => {
        entry.qty = Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 1));
        saveCart(); syncCart();
      });
      $('[data-remove]', item).addEventListener('click', () => {
        state.cart = state.cart.filter((i) => i.key !== key);
        saveCart(); syncCart(); toast('Plat retiré du panier');
      });
    });
  }

  /** Ouvre une fenêtre et ferme automatiquement toutes les autres. */
  function openModal(sel) {
    closeAllModals();
    const m = typeof sel === 'string' ? $(sel) : sel;
    if (m) {
      m.hidden = false;
      document.body.classList.add('no-scroll');
    }
  }

  function openDrawer() {
    $('#cartDrawer').classList.add('open');
    $('#cartDrawer').setAttribute('aria-hidden', 'false');
    $('#drawerOverlay').hidden = false;
    document.body.classList.add('no-scroll');
  }
  function closeDrawer() {
    $('#cartDrawer').classList.remove('open');
    $('#cartDrawer').setAttribute('aria-hidden', 'true');
    $('#drawerOverlay').hidden = true;
    document.body.classList.remove('no-scroll');
  }

  /* ------------------------------------------------------------------ */
  /* Modale plat                                                         */
  /* ------------------------------------------------------------------ */
  const DISH_OPTIONS = [
    'Bien épicé 🌶️', 'Peu de piment', 'Sans piment',
    'Sauce à part', 'Bien cuit', 'Accompagnement : frites', 'Accompagnement : plantain', 'Accompagnement : riz'
  ];

  function openDish(id) {
    const d = state.dishes.find((x) => x.id === id);
    if (!d) return;
    if (d.available === false) { toast('Ce plat est momentanément épuisé.', 'err'); return; }
    state.activeDish = d;
    state.dishQty = 1;
    state.dishOptions = new Set();
    $('#dishModalTitle').textContent = d.name;
    $('#dmDesc').textContent = d.desc || '';
    $('#dmPrice').textContent = FC(d.price);
    $('#dmQty').value = 1;
    const badge = $('#dmBadge');
    badge.hidden = !d.badge; badge.textContent = d.badge || '';
    const img = $('#dmImg');
    img.src = d.img || 'img/hero.jpg';
    img.alt = d.name;
    $('#dmOptions').innerHTML = DISH_OPTIONS.map((o) => `<button type="button" class="opt" data-opt="${esc(o)}">${esc(o)}</button>`).join('');
    $$('#dmOptions .opt').forEach((b) => b.addEventListener('click', () => {
      const v = b.dataset.opt;
      if (state.dishOptions.has(v)) { state.dishOptions.delete(v); b.classList.remove('active'); }
      else { state.dishOptions.add(v); b.classList.add('active'); }
    }));
    openModal('#dishModal');
  }

  /* ------------------------------------------------------------------ */
  /* Commande                                                            */
  /* ------------------------------------------------------------------ */
  function fillZones() {
    const zones = state.settings.deliveryZones || [];
    $('#ckZone').innerHTML = zones.map((z) => `<option value="${esc(z.name)}">${esc(z.name)} — ${FC(z.fee)}</option>`).join('');
  }

  function renderCheckoutSummary() {
    const { subtotal, delivery, total } = cartTotals();
    const lines = state.cart.map((i) => `<div class="row"><span>${i.qty} × ${esc(i.name)}</span><span>${FC(i.price * i.qty)}</span></div>`).join('');
    $('#ckSummary').innerHTML = `
      ${lines}
      <div class="row"><span>Sous-total</span><span>${FC(subtotal)}</span></div>
      ${state.mode === 'livraison' ? `<div class="row"><span>Livraison ${esc(currentZone()?.name || '')}</span><span>${delivery === 0 ? 'Offerte 🎉' : FC(delivery)}</span></div>` : ''}
      <div class="row total"><span>Total à payer</span><span>${FC(total)}</span></div>`;
  }

  function updateModeUI() {
    const isDelivery = state.mode === 'livraison';
    ['#zoneField', '#addressField', '#landmarkField'].forEach((sel) => { $(sel).hidden = !isDelivery; });
    $('#ckAddress').required = isDelivery;
    const labels = {
      livraison: `Adresse de livraison *`,
      emporter: `Point de retrait`,
      surplace: `Service sur place`
    };
    renderCheckoutSummary();
  }

  function updatePaymentHint() {
    const s = state.settings;
    const hints = {
      cash: 'Payez en espèces à la livraison ou au retrait, sans frais supplémentaires.',
      airtel: `Envoyez le montant au ${s.payments?.airtel?.number || 'numéro du restaurant'} (Airtel Money, nom : ${s.payments?.airtel?.name || s.name}) puis confirmez — joignez la capture du transfert sur WhatsApp.`,
      moov: `Envoyez le montant au ${s.payments?.moov?.number || 'numéro du restaurant'} (Moov Money, nom : ${s.payments?.moov?.name || s.name}) puis confirmez — joignez la capture du transfert sur WhatsApp.`
    };
    $('#payHint').textContent = hints[state.payment] || '';
  }

  function openCheckout() {
    if (!state.cart.length) return;
    closeDrawer();
    let saved = {};
    try { saved = JSON.parse(store.get(CUSTOMER_KEY) || '{}'); } catch (e) {}
    if (state.user) {
      $('#ckName').value = state.user.name || '';
      $('#ckPhone').value = state.user.phone || '';
      $('#ckAddress').value = state.user.address || '';
      $('#ckLandmark').value = state.user.landmark || '';
    }
    if (!state.user && saved.name) $('#ckName').value = saved.name;
    if (!state.user && saved.phone) $('#ckPhone').value = saved.phone;
    if (!state.user && saved.address) $('#ckAddress').value = saved.address;
    fillZones();
    updateModeUI();
    updatePaymentHint();
    openModal('#checkoutModal');
  }

  async function submitOrder(e) {
    e.preventDefault();
    const btn = $('#ckSubmit');
    btn.disabled = true; btn.textContent = 'Envoi en cours…';

    const payload = {
      name: $('#ckName').value,
      phone: $('#ckPhone').value,
      mode: state.mode,
      zone: state.mode === 'livraison' ? $('#ckZone').value : '',
      address: $('#ckAddress').value,
      landmark: $('#ckLandmark').value,
      when: $('#ckWhen').value,
      scheduledFor: $('#ckWhen').value === 'scheduled' ? $('#ckScheduled').value : '',
      payment: state.payment,
      notes: $('#ckNotes').value,
      website: $('#ckWebsite').value,
      items: state.cart.map((i) => ({ id: i.id, qty: i.qty, extras: i.extras }))
    };

    try {
      let data;
      if (state.offline) {
        // Pas de connexion au serveur : on prépare la commande localement (envoi WhatsApp).
        const local = localOrderFromPayload(payload);
        data = { order: local, whatsappUrl: waLink(buildLocalWhatsAppText(local)), whatsappText: buildLocalWhatsAppText(local) };
      } else {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(state.clientToken ? { 'x-client-token': state.clientToken } : {})
          },
          body: JSON.stringify(payload)
        });
        data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || 'Erreur lors de l’enregistrement.');
      }

      state.lastOrder = data.order;
      store.set(CUSTOMER_KEY, JSON.stringify({ name: payload.name, phone: payload.phone, address: payload.address }));
      store.set('rt_last_order', data.order.number);

      $('#checkoutModal').hidden = true;
      $('#confirmNumber').textContent = data.order.number;
      $('#confirmWhatsapp').href = data.whatsappUrl || waLink(data.whatsappText || '');
      $('#confirmText').textContent =
        `Commande n° ${data.order.number} enregistrée — total ${FC(data.order.total)}. ` +
        `Un message WhatsApp pré-rempli va s'ouvrir pour l'envoyer au restaurant. ` +
        `Gardez ce numéro pour suivre votre commande.`;
      openModal('#confirmModal');

      state.cart = []; saveCart(); syncCart();

      // Tentative d'ouverture automatique de WhatsApp
      try { window.open($('#confirmWhatsapp').href, '_blank'); } catch (err) {}
      toast('Commande enregistrée !', 'ok');
    } catch (err) {
      toast(err.message || 'Impossible d’envoyer la commande.', 'err');
    } finally {
      btn.disabled = false; btn.textContent = '✅ Envoyer la commande sur WhatsApp';
    }
  }

  /* ------------------------------------------------------------------ */
  /* Suivi de commande                                                   */
  /* ------------------------------------------------------------------ */
  function openTrack(prefill) {
    const last = state.lastOrder;
    const num = prefill || (last && last.number) || store.get('rt_last_order') || '';
    if (num) $('#trackNumber').value = num;
    const phone = (last && last.customer && last.customer.phone) || '';
    if (phone) $('#trackPhone').value = String(phone).replace(/\D/g, '').slice(-6);
    openModal('#trackModal');
  }

  async function doTrack() {
    const number = $('#trackNumber').value.trim();
    const phone = $('#trackPhone').value.trim();
    const box = $('#trackResult');
    if (!number) { toast('Entrez votre numéro de commande.', 'err'); return; }
    box.hidden = false;
    if (state.offline) { box.innerHTML = '<span style="color:var(--danger)">Le suivi de commande nécessite une connexion internet.</span>'; return; }
    box.innerHTML = 'Recherche en cours…';
    try {
      const res = await fetch(`/api/track?number=${encodeURIComponent(number)}&phone=${encodeURIComponent(phone)}`);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Commande introuvable.');
      const o = data.order;
      const flow = ['nouvelle', 'confirmee', 'en_preparation', 'en_livraison', 'livree'];
      const labels = {
        nouvelle: 'Commande reçue', confirmee: 'Commande confirmée', en_preparation: 'En préparation',
        en_livraison: 'En livraison', livree: 'Livrée / Récupérée'
      };
      const idx = flow.indexOf(o.status);
      box.innerHTML = `
        <div><b>${esc(o.number)}</b> — ${esc(o.statusLabel)}</div>
        <div style="color:var(--ink-soft);font-size:.84rem">Commandé le ${new Date(o.createdAt).toLocaleString('fr-FR')}</div>
        <ul class="track-steps">
          ${flow.map((f, i) => `<li class="${idx >= i ? 'done' : ''}">${idx >= i ? '✔' : '○'} ${labels[f]}</li>`).join('')}
        </ul>
        <div style="margin-top:.6rem;font-weight:800">Total : ${FC(o.total)}</div>`;
    } catch (err) {
      box.innerHTML = `<span style="color:var(--danger)">${esc(err.message)}</span>`;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Installation de l'application (PWA)                                 */
  /* ------------------------------------------------------------------ */
  function setupPWA() {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const dismissed = store.get('rt_install_dismissed') === '1';

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      state.deferredPrompt = e;
      $('#installBtn').hidden = false;
      if (!isStandalone && !dismissed) setTimeout(() => { $('#installBanner').hidden = false; }, 6000);
    });

    if (isIOS && !isStandalone && !dismissed) {
      $('#installBtn').hidden = false;
      setTimeout(() => {
        $('#installBanner').hidden = false;
        $('#installBanner').querySelector('span').textContent = 'Sur iPhone : Partager ⬆️ puis « Sur l’écran d’accueil ».';
        $('#installBannerBtn').hidden = true;
      }, 7000);
    }

    const doInstall = async () => {
      if (state.deferredPrompt) {
        state.deferredPrompt.prompt();
        const { outcome } = await state.deferredPrompt.userChoice;
        if (outcome === 'accepted') toast('Application installée 🎉', 'ok');
        state.deferredPrompt = null;
      } else {
        toast('Utilisez le menu de votre navigateur → « Installer l’application »');
      }
      $('#installBanner').hidden = true;
    };
    $('#installBtn').addEventListener('click', doInstall);
    $('#installBannerBtn').addEventListener('click', doInstall);
    const b2 = $('#installBtn2'); if (b2) b2.addEventListener('click', doInstall);
    $('#installBannerClose').addEventListener('click', () => {
      $('#installBanner').hidden = true;
      store.set('rt_install_dismissed', '1');
    });

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => {});
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Événements                                                          */
  /* ------------------------------------------------------------------ */
  function bindEvents() {
    $('#cartOpenBtn').addEventListener('click', openDrawer);
    $('#tabCart').addEventListener('click', openDrawer);
    $('#floatingCart').addEventListener('click', openDrawer);
    $('#cartCloseBtn').addEventListener('click', closeDrawer);
    $('#drawerOverlay').addEventListener('click', closeDrawer);
    $('#cartClearBtn').addEventListener('click', () => {
      state.cart = []; saveCart(); syncCart(); toast('Panier vidé');
    });
    $('#checkoutBtn').addEventListener('click', openCheckout);
    $('#checkoutForm').addEventListener('submit', submitOrder);

    $('#menuSearch').addEventListener('input', (e) => { state.search = e.target.value; renderDishes(); });

    // Fermeture des fenêtres : ✕, clic sur le fond sombre, ou touche Échap.
    // Délégué au document pour fonctionner dans tous les cas.
    document.addEventListener('click', (e) => {
      const closer = e.target.closest('[data-close-modal]');
      if (closer) { e.preventDefault(); e.stopPropagation(); closeAllModals(); return; }
      if (e.target.classList && e.target.classList.contains('modal')) closeAllModals();
    }, true);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeAllModals(); closeDrawer(); }
    });

    // Après une commande : bouton « Suivre ma commande » dans la fenêtre de confirmation
    const confirmTrackBtn = $('#confirmTrack');
    if (confirmTrackBtn) confirmTrackBtn.addEventListener('click', () => openTrack());

    // Modale plat
    $('#dmMinus').addEventListener('click', () => { state.dishQty = Math.max(1, state.dishQty - 1); $('#dmQty').value = state.dishQty; });
    $('#dmPlus').addEventListener('click', () => { state.dishQty = Math.min(50, state.dishQty + 1); $('#dmQty').value = state.dishQty; });
    $('#dmQty').addEventListener('change', (e) => { state.dishQty = Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 1)); e.target.value = state.dishQty; });
    $('#dmAddBtn').addEventListener('click', () => {
      if (!state.activeDish) return;
      addToCart(state.activeDish, state.dishQty, Array.from(state.dishOptions));
      toast(`${state.activeDish.name} × ${state.dishQty} ajouté au panier`, 'ok');
      closeAllModals();
      openDrawer();
    });

    // Segments mode / paiement
    $$('#modeSeg button').forEach((b) => b.addEventListener('click', () => {
      state.mode = b.dataset.value;
      $$('#modeSeg button').forEach((x) => x.classList.toggle('active', x === b));
      updateModeUI();
    }));
    $$('#paySeg button').forEach((b) => b.addEventListener('click', () => {
      state.payment = b.dataset.value;
      $$('#paySeg button').forEach((x) => x.classList.toggle('active', x === b));
      updatePaymentHint();
    }));
    $('#ckZone').addEventListener('change', () => { syncCart(); });
    $('#ckWhen').addEventListener('change', (e) => { $('#scheduledField').hidden = e.target.value !== 'scheduled'; });

    // Confirmation
    $('#confirmClose').addEventListener('click', () => { $('#confirmModal').hidden = true; document.body.classList.remove('no-scroll'); });

    // Suivi
    $('#trackOpenBtn').addEventListener('click', () => openTrack());
    $('#footerTrack').addEventListener('click', (e) => { e.preventDefault(); openTrack(); });
    $('#trackBtn').addEventListener('click', doTrack);

    // Ancres rapides
    $('#heroOrderBtn').addEventListener('click', () => { location.hash = '#menu'; });
    $('#ctaOrderBtn').addEventListener('click', () => { location.hash = '#menu'; });

    // Barre mobile active
    const tabs = $$('.mobile-tabbar .tab');
    const sections = ['accueil', 'menu', 'contact'].map((id) => document.getElementById(id)).filter(Boolean);
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          tabs.forEach((t) => t.classList.toggle('active', t.getAttribute('href') === `#${en.target.id}`));
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      sections.forEach((s) => io.observe(s));
    }
  }

  function closeAllModals() {
    $$('.modal').forEach((m) => { m.hidden = true; });
    const drawer = $('#cartDrawer');
    if (!drawer || !drawer.classList.contains('open')) document.body.classList.remove('no-scroll');
  }

  /* ------------------------------------------------------------------ */
  /* Démarrage                                                           */
  /* ------------------------------------------------------------------ */
  /* ------------------------------------------------------------------ */
  /* Contrôle d'accès : connexion / création de compte obligatoire       */
  /* ------------------------------------------------------------------ */
  async function checkAccess() {
    state.clientToken = store.get(CLIENT_TOKEN_KEY) || '';
    const guest = store.get('rt_guest') === '1';

    if (state.offline) {
      // Application/hors ligne : le site embarqué reste consultable, pas de redirection.
      try { state.user = JSON.parse(store.get('rt_client') || 'null'); } catch (e) {}
      return true;
    }

    if (state.clientToken) {
      try {
        const res = await fetch('/api/auth/me', { headers: { 'x-client-token': state.clientToken } });
        const data = await res.json();
        if (data.ok) {
          state.user = data.user;
          store.set('rt_client', JSON.stringify(data.user));
          return true;
        }
        store.remove(CLIENT_TOKEN_KEY);
        state.clientToken = '';
      } catch (e) { /* serveur injoignable : on laisse passer */ return true; }
    }

    if (guest) {
      try { state.user = JSON.parse(store.get('rt_client') || 'null'); } catch (e) {}
      return true;
    }

    // Pas de compte : direction la page d'accès (connexion / inscription)
    const next = encodeURIComponent(location.pathname + location.search + location.hash);
    location.replace('connexion.html?next=' + next);
    return false;
  }

  async function init() {
    loadCart();
    closeAllModals();          // aucune fenêtre ne doit s'ouvrir toute seule
    document.body.classList.remove('no-scroll');
    let online = false;
    try {
      const res = await fetch('/api/public');
      if (!res.ok) throw new Error('api');
      const data = await res.json();
      state.settings = data.settings || {};
      state.categories = data.categories || [];
      state.dishes = data.dishes || [];
      state.specials = data.specials || [];
      online = true;
    } catch (e) {
      online = false;
    }
    if (!online) {
      const fb = window.RT_FALLBACK;
      if (fb) {
        state.offline = true;
        state.settings = fb.settings || {};
        state.categories = fb.categories || [];
        state.dishes = fb.dishes || [];
        state.specials = fb.specials || [];
        const banner = document.createElement('div');
        banner.className = 'announce';
        banner.style.background = 'linear-gradient(90deg,#a9761f,#d9a83c)';
        banner.innerHTML = '<span>📴 Mode hors ligne — la carte s’affiche, les commandes sont envoyées par WhatsApp. Le suivi en ligne nécessite une connexion.</span>';
        document.body.insertBefore(banner, document.body.firstChild);
      } else {
        toast('Connexion au restaurant impossible. Vérifiez votre réseau.', 'err');
      }
    }
    const access = await checkAccess();
    if (!access) return;

    renderHeaderAndFooter();
    renderAccount();
    renderCategories();
    renderDishes();
    renderSpecials();
    renderReviews();
    syncCart();
    bindEvents();
    setupPWA();
    // Pré-remplissage du suivi si une commande vient d'être passée
    // Suivi automatique : on propose le dernier numéro de commande connu
    const lastNum = store.get('rt_last_order');
    if (lastNum) $('#trackNumber').value = lastNum;

    // Petite animation d'entrée douce
    document.body.style.opacity = '0';
    requestAnimationFrame(() => {
      document.body.style.transition = 'opacity .35s ease';
      document.body.style.opacity = '1';
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
