# 👑 Le Royal Tavern — Plateforme de commande en ligne

Plateforme complète pour le restaurant **Le Royal Tavern** (Charbonnage, derrière la Chapelle des Vainqueurs — Libreville, Gabon) :

| Élément | Description |
|---|---|
| 🌐 **Vitrine web** | Carte complète, menus du jour, avis clients, itinéraire, réservation de commande |
| 🛒 **Commande en ligne** | Panier, livraison / à emporter / sur place, paiement espèces, Airtel Money ou Moov Money |
| 💬 **Envoi WhatsApp** | Chaque commande part automatiquement sur le WhatsApp du restaurant, avec numéro de suivi |
| 👤 **Comptes clients** | Inscription / connexion, adresse enregistrée, historique et suivi des commandes, « commander à nouveau » |
| 🧾 **Espace restaurant** | Tableau de bord (CA du jour, commandes, plats les plus vendus), suivi des statuts, impression de tickets, export CSV |
| 🍽️ **Gestion du menu** | Le restaurant modifie lui-même ses plats, prix, badges, plats épuisés et menus du jour |
| 📲 **Application mobile** | PWA installable (Android/iOS) + projet Android complet générant un **APK** (mode hors ligne inclus) |
| 🔗 **QR code & affiche** | QR code du menu à imprimer pour les tables, la vitrine et les flyers |

---

> 🌍 **Vous voulez mettre le site en ligne sur internet ?**
> Suivez le guide pas-à-pas : **[DEPLOIEMENT-RENDER.md](DEPLOIEMENT-RENDER.md)** (≈ 15 minutes, sans compétence technique).

## 🖥️ Comment ouvrir le site (à lire en premier)

**1. Depuis votre espace de travail (le plus simple)**
Dans le panneau de droite, cliquez sur l'aperçu nommé **« Le Royal Tavern — site & accès client »**
(c'est le site réel, avec le serveur). Vous verrez d'abord l'**écran d'accès**.

**2. Aperçus instantanés (sans serveur, pour regarder)**
Deux fichiers s'ouvrent d'un simple clic, même sans lancer le serveur :
* `apercu-1-connexion.html` → l'écran de connexion / création de compte
* `apercu-2-site-menu.html` → l'accueil du restaurant avec le menu complet

**3. Sur votre ordinateur (Windows / Mac / Linux)**
```bash
npm install      # une seule fois
npm start        # démarre la plateforme
```
Puis ouvrez **http://localhost:3000** dans votre navigateur (Chrome, Edge, Firefox…).

> ⚠️ N'ouvrez **pas** directement `public/index.html` dans le navigateur : ce fichier a besoin
> du serveur pour afficher le menu et enregistrer les commandes. Utilisez `npm start`
> (ou les aperçus instantanés ci-dessus).

---

## 🔐 Le parcours d'accès (comme demandé)

```
Ouverture du site
      │
      ▼
Écran d'accès  ──►  « Se connecter »  (numéro + mot de passe)
      │        ──►  « Créer un compte » (nom, téléphone, mot de passe)
      │
      ▼
Accueil du restaurant : carte complète, panier, commande WhatsApp
      │
      ▼
« Mon compte » : mes informations, mon historique, suivi, recommander
```

* Un **compte client** est créé par le client lui-même (2 minutes, aucun frais).
* Le **numéro de téléphone** sert d'identifiant de connexion.
* L'historique des commandes, l'adresse de livraison et le suivi sont enregistrés dans son compte.
* Un lien discret **« Continuer sans compte (invité) »** permet aussi de commander sans s'inscrire —
  dites-moi si vous préférez le supprimer pour rendre le compte obligatoire.
* ⚠️ Ne confondez pas : l'**espace restaurant** (`/admin`, mot de passe `royal2026`) est réservé à l'équipe
  et n'a rien à voir avec les comptes clients.

---

## 🚀 Démarrage rapide (30 secondes)

```bash
cd royal-tavern
npm install          # une seule fois
npm start            # démarre la plateforme
```

Puis ouvrez :

* **Vitrine client** → http://localhost:3000
* **Espace restaurant (admin)** → http://localhost:3000/admin — mot de passe par défaut : **`royal2026`**
* **Compte client** → http://localhost:3000/compte
* **Suivi de commande client** → http://localhost:3000/suivi
* **Affiche + QR code à imprimer** → http://localhost:3000/affiche

> ⚠️ **Première chose à faire :** dans l'admin → *Paramètres*, remplacez le **numéro WhatsApp** (`24100000000`) par le vrai numéro du restaurant, puis changez le mot de passe.

---

## 📁 Structure du projet

```
royal-tavern/
├── server.js                  # Serveur web + API (commandes, admin, QR)
├── package.json
├── DEPLOIEMENT-RENDER.md      # 🌍 Mise en ligne sur internet, pas à pas (à lire pour publier)
├── render.yaml                # Configuration de déploiement automatique (Render)
├── data/                      # Données du restaurant (faciles à sauvegarder)
│   ├── menu.json              # Carte : catégories, plats, prix, menus du jour
│   ├── settings.json          # Coordonnées, livraison, paiements, avis
│   ├── users.json             # Comptes clients (mots de passe hachés)
│   └── orders.json            # Commandes reçues
├── seed/                      # Copies de référence : réinstallées automatiquement
│                              # si le dossier data/ est vide (disque neuf sur Render)
├── public/                    # Le site (vitrine client)
│   ├── index.html             # Page d'accueil + menu + commande
│   ├── admin.html             # Espace restaurant
│   ├── suivi.html             # Suivi de commande pour le client
│   ├── affiche.html           # Affiche A4 avec QR code (imprimable)
│   ├── css/style.css          # Thème « royal » bleu nuit & or
│   ├── js/app.js              # Panier, commande WhatsApp, mode hors ligne
│   ├── icons/                 # Icônes de l'application (PWA / Android)
│   └── img/                   # Photos des plats
├── mobile/                    # Application Android (APK)
│   ├── app/src/main/java/...  # MainActivity (WebView + ouverture WhatsApp)
│   ├── app/src/main/assets/www# Copie hors ligne du site
│   ├── gradlew                # Script de compilation
│   └── apk/                   # APK compilé (royal-tavern-debug.apk)
└── scripts/                   # Générateurs (icônes, données embarquées, synchro)
```

---

## 🔧 Configuration du restaurant

Tout se règle **depuis l'espace d'administration** (http://localhost:3000/admin) :

1. **Paramètres** → nom, adresse, téléphone, **numéro WhatsApp**, horaires, réseaux sociaux
2. **Zones de livraison** → quartiers desservis et frais (ex. Charbonnage 1 000 F, centre-ville 1 500 F)
3. **Paiements** → numéros Airtel Money / Moov Money du restaurant
4. **Menu & prix** → ajouter/modifier/supprimer des plats, cocher « Épuisé », changer les menus du jour
5. **Sécurité** → nouveau mot de passe administrateur

Les modifications sont visibles **immédiatement** sur le site, sans redémarrage.

---

## 📱 APK Android

L'APK est déjà compilé : **`mobile/apk/royal-tavern-debug.apk`** — installez-le directement sur un téléphone Android (activer « Sources inconnues »).

Pour recompiler après une modification du site :

```bash
bash scripts/sync-mobile-assets.sh     # copie le site dans l'application
cd mobile && ./gradlew assembleDebug   # produit app/build/outputs/apk/debug/app-debug.apk
```

➡️ Tous les détails (adresse du site, signature, Play Store) : **[GUIDE-INSTALLATION.md](GUIDE-INSTALLATION.md)**

---

## 🌍 Mise en ligne sur internet

Le guide pas-à-pas (hébergement gratuit puis nom de domaine) est dans **[GUIDE-INSTALLATION.md](GUIDE-INSTALLATION.md)**, section « Publier la plateforme ».

Résumé : la plateforme est un simple serveur Node.js, elle se déploie en un clic sur **Render**, **Railway**, **Netlify** (avec fonctions) ou tout VPS, et le domaine `royaltavern.ga` peut pointer dessus.

---

## 🧰 Technologies

* **Node.js + Express** — serveur et API
* **HTML / CSS / JavaScript vanilla** — aucune dépendance front, chargement ultra-rapide sur mobile
* **PWA** — installable, service worker (mode hors ligne pour la carte et les images)
* **Android (Java + WebView)** — application APK avec ouverture native de WhatsApp, du téléphone et de Google Maps
* **Stockage JSON** — aucune base de données à installer ; sauvegarde = copier le dossier `data/`

---

## 🔐 Sécurité

* Le mot de passe admin est stocké **haché** (SHA-256 + sel), jamais en clair
* Sessions admin par jeton, valables 7 jours, révocables
* Le calcul des prix et des frais de livraison est fait **côté serveur** (impossible de falsifier une commande depuis le navigateur)
* Protection anti-spam (champ piège) sur le formulaire de commande
* Le champ « mot de passe » n'est jamais envoyé au navigateur des clients

---

## 💾 Sauvegardes

```bash
# Sauvegarde manuelle : copiez le dossier data/
cp -r data/ sauvegardes/data-$(date +%F)/

# Export des commandes au format tableur (Excel/LibreOffice)
# → bouton « Export CSV » dans l'admin, ou :
curl -H "x-admin-token: VOTRE_JETON" http://localhost:3000/api/admin/export.csv -o commandes.csv
```

---

© Le Royal Tavern — Charbonnage, derrière la Chapelle des Vainqueurs, Libreville (Gabon).
