# 🚀 Mettre Le Royal Tavern en ligne sur Render — pas à pas

**Durée : environ 15 minutes. Aucun logiciel de programmation à installer.**
À la fin, votre site sera accessible à une adresse du type **https://royal-tavern.onrender.com**
que vous pourrez partager à vos clients (et plus tard remplacer par `royaltavern.ga`).

---

## 📦 Avant de commencer

Vous avez besoin de deux comptes gratuits :

| Compte | À quoi ça sert | Où le créer |
|---|---|---|
| **GitHub** | Stocker le projet (c'est « le coffre » de vos fichiers) | <https://github.com/signup> |
| **Render** | Faire tourner le site en ligne | <https://dashboard.render.com/register> (bouton *Sign up with GitHub*) |

> 💡 Render vous connectera avec votre compte GitHub : c'est le plus rapide, un seul mot de passe.

---

## 🗂️ Étape 1 — Déposer le projet sur GitHub (≈ 5 min)

### Ce qu'il vous faut d'abord
1. Dans votre espace de travail, **téléchargez le fichier `royal-tavern-plateforme.zip`**.
2. **Décompressez-le** (clic droit → *Extraire tout*). Vous obtenez un dossier `royal-tavern`.
3. Installez **GitHub Desktop** (gratuit, simple à utiliser) : <https://desktop.github.com>

### Avec GitHub Desktop (recommandé)

| # | Ce que vous faites | Ce que vous voyez |
|---|---|---|
| 1 | Ouvrez GitHub Desktop et connectez-vous avec votre compte GitHub | *Sign in to GitHub.com* |
| 2 | Menu **File → Add local repository** | une fenêtre s'ouvre |
| 3 | Choisissez le dossier **`royal-tavern`** décompressé | *Add repository* |
| 4 | GitHub Desktop vous dit « ce dossier n'est pas un dépôt » → cliquez **create a repository** | — |
| 5 | Laissez le nom **royal-tavern**, décochez *Initialize with README* → **Create repository** | — |
| 6 | Cliquez en haut sur **Publish repository** | une fenêtre s'ouvre |
| 7 | **Décochez** « Keep this code private » si vous voulez que ce soit public (ou gardez privé, ça marche aussi) → **Publish repository** | les fichiers s'envoient (≈ 1 min) |

✅ Votre projet est maintenant sur GitHub.

> **Pas envie d'installer GitHub Desktop ?** Vous pouvez aussi créer un dépôt vide sur github.com,
> puis utiliser la page *Add file → Upload files* et glisser le contenu du dossier.
> ⚠️ Ne déposez jamais le dossier `node_modules` (il n'est pas dans le ZIP, c'est normal).

---

## ☁️ Étape 2 — Créer le site sur Render (≈ 3 min)

| # | Ce que vous faites | Valeur exacte à mettre |
|---|---|---|
| 1 | Sur <https://dashboard.render.com> cliquez **New +** | — |
| 2 | Choisissez **Web Service** | — |
| 3 | Autorisez Render à voir vos dépôts GitHub, puis cliquez sur **royal-tavern → Connect** | — |
| 4 | Champ **Name** | `royal-tavern` |
| 5 | Champ **Region** | **Frankfurt (EU Central)** — le plus rapide depuis le Gabon |
| 6 | Champ **Branch** | `main` |
| 7 | **Runtime / Language** | `Node` |
| 8 | **Build Command** | `npm install` |
| 9 | **Start Command** | `npm start` |
| 10 | **Instance Type** | **Free** (pour commencer) |
| 11 | Cliquez **Create Web Service** | — |

Render affiche des lignes de journal qui défilent : c'est la construction du site.
**Patientez 2 à 3 minutes**, jusqu'à voir `👑 Le Royal Tavern — plateforme en ligne`.

En haut de la page, Render affiche votre adresse, par exemple :
```
https://royal-tavern.onrender.com
```
👉 **Cliquez dessus : votre site s'ouvre !** Vous verrez d'abord l'écran de connexion / création de compte.

---

## ✅ Étape 3 — Vérifier que tout fonctionne (≈ 2 min)

1. **Ouvrez votre adresse Render** → l'écran d'accès s'affiche.
2. Cliquez sur **Créer un compte**, remplissez (nom, téléphone, mot de passe) → vous arrivez sur l'accueil avec les menus. 🎉
3. Ajoutez 2 plats au panier → **Valider la commande** → remplissez vos infos → **Envoyer**.
4. La commande s'ouvre dans WhatsApp (dirigée vers le numéro `24100000000` **par défaut** — on le corrige à l'étape suivante).
5. Test technique : ouvrez `https://VOTRE-ADRESSE.onrender.com/api/health` → vous devez voir
   `{"ok":true, ...,"dishes":38, ...}` (38 plats = le menu est bien installé).

---

## 🍽️ Étape 4 — Configurer le restaurant (≈ 5 min) — **à faire avant de partager le lien**

Allez sur **`https://VOTRE-ADRESSE.onrender.com/admin`** — mot de passe : **`royal2026`**

| Ordre | Où | Ce que vous faites |
|---|---|---|
| 1 | **Paramètres** | **Numéro WhatsApp** : mettez le vrai numéro du restaurant au format international **sans espace ni +** — ex. `24174000000`. C'est sur ce numéro que tomberont toutes les commandes. |
| 2 | **Paramètres** | Téléphone affiché, e-mail, adresse (déjà pré-remplie : Charbonnage, derrière la Chapelle des Vainqueurs) |
| 3 | **Paramètres** | **Zones de livraison** : ajustez les quartiers et les frais |
| 4 | **Paramètres** | **Paiements** : vos numéros **Airtel Money** et **Moov Money** |
| 5 | **Paramètres → Sécurité** | **Changez le mot de passe administrateur** (obligatoire) |
| 6 | **Menu & prix** | Remplacez les plats d'exemple par vos vrais plats et prix → **💾 Enregistrer le menu** |
| 7 | **Paramètres** | Message d'annonce en haut du site (ex. « Livraison offerte dès 25 000 F ») |

Chaque enregistrement est **immédiatement visible** par vos clients.

---

## 💾 Étape 5 — Que deviennent vos données ? (à lire, c'est important)

Sur le **plan gratuit**, Render redémarre votre site après 15 minutes sans visite
(le premier visiteur attend ~30 s, c'est normal) — et à chaque redémarrage, **les fichiers
`orders.json` et `users.json` reviennent à zéro**.

**Ce que cela signifie concrètement :**

| Donnée | Sur le plan gratuit | Sur le plan payant avec disque |
|---|---|---|
| 🍽️ Le menu et les paramètres | ✅ Conservés : le serveur les réinstalle automatiquement au démarrage depuis le dossier `seed` (testé ✔) | ✅ Conservés |
| 🧾 Les commandes passées | ⚠️ Conservées seulement jusqu'au redémarrage — **mais elles restent toutes sur votre WhatsApp**, qui reste votre référence | ✅ Conservées dans l'historique de l'admin |
| 👤 Les comptes clients | ⚠️ Ils devront se réinscrire après un redémarrage | ✅ Conservés |

### 👉 Ma recommandation
* **Cette semaine** : restez sur le **plan gratuit** pour tester tranquillement avec votre équipe.
* **Avant le lancement auprès des clients** : passez au **plan Starter** (7 $/mois environ)
  et ajoutez un disque de 1 Go (0,25 $/mois) :

  1. Render → votre service → onglet **Settings** → *Instance Type* → **Starter** → *Save*
  2. Onglet **Disks** → **Add Disk** → renseignez :
     * **Name** : `royal-tavern-data`
     * **Mount Path** : `/opt/render/project/src/data`  ← à recopier exactement
     * **Size** : `1 GB`
  3. Cliquez **Create Disk** → le site redémarre seul (1 min).

Le réglage est déjà préparé dans le fichier `render.yaml` du projet (lignes commentées) : vous pouvez
aussi faire tout le déploiement d'un coup depuis **New + → Blueprint** et Render lira ce fichier.

---

## 🛠️ Étape 6 — Mettre à jour le site plus tard

**Modifier les plats, les prix, les horaires** → dans l'**admin**, aucune manipulation technique.
*(Sur le plan gratuit, pensez à refaire ces réglages si le serveur redémarre — le menu revient à la version enregistrée dans `seed/`.)*

**Modifier les textes, les photos, le code** → dans GitHub Desktop :
1. Modifiez vos fichiers (dans `royal-tavern/public/…` ou `royal-tavern/data/…`)
2. GitHub Desktop → écrivez un résumé (ex. « nouveaux prix ») → **Commit to main**
3. Cliquez **Push origin** → Render reconstruit automatiquement en 2 minutes.

---

## 🌍 Étape 7 (optionnel) — Votre nom de domaine `royaltavern.ga`

1. Achetez le domaine (ex. chez <https://www.nic.ga>, Namecheap ou OVH — 10 000 à 25 000 FCFA/an).
2. Dans Render : votre service → **Settings → Custom Domains → Add Custom Domain** → tapez `royaltavern.ga`.
3. Render vous donne des valeurs DNS à recopier chez votre fournisseur de domaine :
   * un **CNAME** : `www` → `royal-tavern.onrender.com`
   * un **ALIAS/A CNAME** : `@` → `royal-tavern.onrender.com`
4. Attendez 15 min à 2 h (propagation), puis cochez « HTTPS » dans Render (certificat gratuit automatique).

Puis, pour que l'application Android ouvre aussi votre domaine :
ouvrez `mobile/app/build.gradle`, remplacez l'adresse dans
`buildConfigField "String", "SITE_URL", "…"` par `"https://royaltavern.ga"`, et recompilez
(voir **GUIDE-INSTALLATION.md**, section 4).

---

## 📱 Étape 8 — Le lien à partager avec vos clients

| Où | Quoi afficher |
|---|---|
| WhatsApp / Facebook / Instagram | `https://royal-tavern.onrender.com` |
| Affiche sur les tables | page **`/affiche`** du site → bouton **🖨️ Imprimer** (le QR code est généré tout seul) |
| Statut WhatsApp Business | « Commandez en ligne 👑 royal-tavern.onrender.com » |

---

## 🆘 Dépannage express

| Problème | Cause | Solution |
|---|---|---|
| « Application failed to respond » | Mauvaise commande de démarrage | Settings → **Start Command** = `npm start` |
| Le site met 30 s à s'ouvrir la première fois | Plan gratuit : le serveur « dort » après 15 min | Normal. Passez au plan Starter pour un démarrage instantané |
| Le menu est vide | Le disque a été monté vide et `seed/` est absent | Vérifiez que le dossier **`seed/`** (avec `menu.json`) est bien sur GitHub, puis *Manual Deploy → Deploy latest commit* |
| Les commandes n'arrivent pas sur WhatsApp | Numéro WhatsApp non configuré | Admin → Paramètres → **Numéro WhatsApp** au format `241XXXXXXXX` |
| Mon dépôt n'apparaît pas dans Render | Render n'a pas l'autorisation | Render → *Account Settings → GitHub* → autorisez le dépôt `royal-tavern` |
| `npm install` échoue pendant la construction | Version de Node trop ancienne | Render → Environment → ajoutez `NODE_VERSION` = `20` |
| Erreur 502 après un changement | Déploiement en cours ou planté | Render → onglet **Logs**, lisez les dernières lignes, puis *Manual Deploy* |

---

## ✅ Checklist finale

- [ ] Projet déposé sur GitHub
- [ ] Service Web créé sur Render (`npm install` / `npm start`)
- [ ] Site ouvert, compte de test créé, commande test passée
- [ ] **Numéro WhatsApp réel** saisi dans l'admin
- [ ] Numéros **Airtel Money / Moov Money** saisis
- [ ] **Mot de passe admin changé**
- [ ] Menu réel saisi (plats + prix)
- [ ] Zones de livraison et frais ajustés
- [ ] Affiche + QR code imprimés pour le restaurant
- [ ] Lien partagé sur WhatsApp / réseaux sociaux
- [ ] (Avant lancement client) Plan Starter + disque 1 Go ajouté

---

👑 **Le Royal Tavern** — Charbonnage, derrière la Chapelle des Vainqueurs, Libreville (Gabon)
Besoin d'aide sur une étape ? Revenez me voir avec le message d'erreur exact affiché par Render
(onglet **Logs**) et je corrige.
