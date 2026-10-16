# 📘 Guide d'installation — Le Royal Tavern

Ce guide vous accompagne de A à Z : tester la plateforme, la mettre en ligne sur internet,
la personnaliser et distribuer l'application Android (APK).

---

## 1. Tester la plateforme sur votre ordinateur

### Ce qu'il vous faut
* **Node.js 18 ou plus récent** — téléchargez-le sur <https://nodejs.org> (bouton « LTS »).

### Les commandes
Ouvrez un terminal dans le dossier `royal-tavern` et tapez :

```bash
npm install      # à faire une seule fois (installe le serveur web)
npm start        # à répéter à chaque utilisation
```

Ouvrez ensuite dans votre navigateur :

| Page | Adresse | Mot de passe |
|---|---|---|
| 🛍️ Vitrine client | http://localhost:3000 | — |
| 🧾 Espace restaurant | http://localhost:3000/admin | `royal2026` |
| 📦 Suivi de commande | http://localhost:3000/suivi | — |
| 🖨️ Affiche + QR code | http://localhost:3000/affiche | — |

### Tester depuis un téléphone (même Wi-Fi)
1. Sur l'ordinateur, trouvez votre adresse locale : `ipconfig` (Windows) ou `ifconfig` / `ip a` (Mac/Linux) → ex. `192.168.1.25`.
2. Sur le téléphone, ouvrez `http://192.168.1.25:3000`.
3. Le bouton **« Installer l'app »** apparaît : l'application s'ajoute à l'écran d'accueil du téléphone.

---

## 1 bis. Que voient vos clients ? (parcours d'accès)

1. Le client ouvre le site → **écran d'accès** : « Se connecter » s'il a déjà un compte,
   sinon « Créer un compte » (nom, téléphone, mot de passe).
2. Il est **redirigé vers l'accueil du restaurant** : la carte complète s'affiche.
3. Il remplit son panier, valide : la commande part **sur votre WhatsApp** avec son numéro de suivi.
4. Dans **« Mon compte »** il retrouve ses informations, l'historique de ses commandes,
   le suivi en direct et le bouton **« Commander à nouveau »**.

Vous trouverez la liste des comptes clients créés dans le fichier `data/users.json`
(les mots de passe y sont hachés — illisibles, c'est voulu).

---

## 2. Première configuration (5 minutes, sans technique)

Connectez-vous à l'espace restaurant (`/admin`, mot de passe `royal2026`) puis :

1. **Paramètres → Numéro WhatsApp** : saisissez le numéro du restaurant au **format international sans espace**.
   > Exemple pour Libreville : `24174000000` (241 = Gabon, puis le numéro sans le 0 initial).
   C'est sur ce numéro que tomberont **toutes les commandes en ligne**.
2. **Paramètres → Téléphone affiché, adresse, horaires** : vérifiez qu'ils sont exacts.
3. **Paramètres → Zones de livraison** : ajustez les quartiers et les frais (par défaut 1 000 / 1 500 / 2 000 F).
4. **Paramètres → Paiements** : saisissez les numéros **Airtel Money** et **Moov Money** du restaurant.
   Les clients recevront ces numéros pour payer.
5. **Menu & prix** : remplacez les plats d'exemple par vos vrais plats, prix et descriptions.
   Cochez « Disponible » / décochez pour un plat épuisé. Enregistrez.
6. **Paramètres → Sécurité** : changez le mot de passe administrateur (6 caractères minimum).

> 💡 Astuce : dans **Paramètres → Bandeau d'annonce**, indiquez une promotion du jour
> (« Livraison offerte dès 25 000 F ») — elle s'affiche en haut du site.

---

## 3. Publier la plateforme sur internet

La plateforme est un serveur Node.js : elle fonctionne partout où Node.js fonctionne.
Voici les trois options les plus simples, de la plus rapide à la plus professionnelle.

### Option A — Render (recommandée, gratuite pour commencer)

1. Créez un compte gratuit sur <https://render.com>.
2. Mettez le dossier `royal-tavern` sur GitHub (créez un dépôt privé puis envoyez les fichiers).
3. Dans Render : **New → Web Service**, connectez le dépôt, puis renseignez :
   * **Build Command** : `npm install`
   * **Start Command** : `npm start`
   * **Instance Type** : Free
4. Cliquez sur **Create** : au bout de 2 minutes, Render vous donne une adresse du type
   `https://royal-tavern.onrender.com` → c'est votre site public. 🎉
5. **Important** : dans Render, ajoutez un **disque persistant** (Persistent Disk) monté sur `/opt/render/project/src/data`
   afin que le menu et les commandes ne soient pas effacés à chaque redéploiement.
   *(Plan gratuit : le disque n'est pas disponible — passez au plan « Starter » à ~7 $/mois
   ou exportez/vérifiez les commandes via l'admin. Le menu, lui, est dans le dossier `data/` du dépôt,
   il suffit donc de le commander aussi via l'admin et de garder une copie locale.)*

### Option B — Railway ou Fly.io (similaire, quelques dollars par mois)
Mêmes étapes que Render : dépôt GitHub, `npm install` / `npm start`, disque persistant sur `/app/data`.

### Option C — VPS (OVH, Contabo, DigitalOcean… le plus fiable)
Sur un serveur Linux (Ubuntu), en SSH :

```bash
sudo apt update && sudo apt install -y nodejs npm nginx
sudo npm install -g pm2
# copier le dossier royal-tavern sur le serveur, puis :
cd royal-tavern && npm install
pm2 start server.js --name royal-tavern
pm2 save && pm2 startup     # démarre automatiquement au rebond du serveur
```

Puis configurez Nginx pour rediriger votre domaine vers le port 3000
(et activez HTTPS avec `sudo certbot --nginx -d royaltavern.ga -d www.royaltavern.ga`).

### Ensuite : votre nom de domaine
Un nom de domaine comme **`royaltavern.ga`** coûte environ 10 000 à 25 000 FCFA/an
(NIC.GA, Namecheap, OVH…). Dans le tableau de bord du fournisseur, pointez
l'enregistrement `A` (ou `CNAME`) vers l'adresse fournie par votre hébergeur.

### Où saisir votre adresse définitive dans l'application ?
Une fois le site en ligne, ouvrez `mobile/app/build.gradle` et remplacez :

```gradle
buildConfigField "String", "SITE_URL", "\"https://royal-tavern.exemple.ga\""
```

par votre véritable adresse (ex. `"https://royaltavern.ga"`), puis recompilez l'APK (section 4).

---

## 4. Application Android (APK)

### A. Installer l'APK déjà compilé (le plus simple)

Le fichier est prêt dans le dossier **`mobile/apk/`** :

| Fichier | Usage |
|---|---|
| `royal-tavern-release.apk` | Version signée — **à installer sur les téléphones** |
| `royal-tavern-debug.apk` | Version de test (peut cohabiter avec la version finale) |

**Installation sur un téléphone :**
1. Envoyez le fichier par WhatsApp, Bluetooth, câble USB ou Google Drive.
2. Ouvrez-le ; Android demande d'autoriser « **l'installation d'applications inconnues** » → acceptez.
3. L'icône **Royal Tavern** (couronne dorée) apparaît dans les applications. 🎉

> L'application fonctionne **même sans internet** : la carte complète est embarquée.
> Les commandes sont alors envoyées par WhatsApp depuis le téléphone du client.

### B. Recompiler l'APK après une modification du site

```bash
bash scripts/sync-mobile-assets.sh        # recopie le site (menu, images) dans l'application
cd mobile
./gradlew assembleRelease                 # produit app/build/outputs/apk/release/royal-tavern-v1.0.apk
```

### C. Prérequis pour compiler soi-même (Android Studio)

* **Android Studio** (gratuit) : <https://developer.android.com/studio>
* Ouvrez le dossier `mobile/`, puis menu **Build → Generate Signed Bundle / APK**
* Ou en ligne de commande : `./gradlew assembleRelease` (Java 17 minimum requis)

### D. Publier sur le Google Play Store (optionnel, 25 $ une seule fois)

1. Créez un compte développeur : <https://play.google.com/console>.
2. Produisez un fichier **.aab** au lieu de l'APK :
   `./gradlew bundleRelease` → `mobile/app/build/outputs/bundle/release/app-release.aab`
3. Créez la fiche de l'application (nom « Le Royal Tavern », description, les images de `public/img/`,
   icône de 512 px : `public/icons/playstore-512.png`).
4. Téléversez le `.aab`, remplissez le formulaire et publiez.

> 🔑 **TRÈS IMPORTANT :** le fichier `mobile/keystore/royal-tavern.jks` et `mobile/keystore.properties`
> sont la clé de signature de votre application. **Faites-en une copie de sauvegarde** (clé USB, e-mail à vous-même).
> Sans eux, vous ne pourrez plus publier de mise à jour. Ne les partagez avec personne.

---

## 5. Utilisation quotidienne au restaurant

| Ce que vous faites | Où |
|---|---|
| Voir les commandes du jour et le chiffre d'affaires | **Admin → Tableau de bord** |
| Faire avancer une commande (Confirmer → En préparation → En livraison → Livrée) | **Admin → Commandes → « Avancer ▸ »** |
| Imprimer un ticket de préparation | **Admin → Commandes → 🖨️** |
| Marquer un plat épuisé en une seconde | **Admin → Menu & prix → décocher « Disponible »** |
| Changer un prix | **Admin → Menu & prix → champ Prix → Enregistrer** |
| Répondre au client / confirmer | Sur **WhatsApp**, message reçu automatiquement |
| Vérifier l'avancement pour un client | **Suivi** : le client consulte `/suivi` avec son numéro `RT-…` |
| Exporter les ventes (Excel) | **Admin → Commandes → ⬇️ Export CSV** |

La page du tableau de bord **se met à jour toute seule toutes les 30 secondes** et affiche une alerte
lorsqu'une nouvelle commande arrive (cliquez sur « 🔔 Alertes » pour autoriser les notifications).

---

## 6. Sauvegardes et sécurité

* **Sauvegarde** = copier le dossier `data/`. Il contient tout : `menu.json` (carte),
  `settings.json` (paramètres), `orders.json` (commandes). À faire chaque semaine.
* Tous les prix sont recalculés **côté serveur** : un client ne peut pas modifier le montant d'une commande.
* Le mot de passe administrateur est stocké **haché** : personne ne peut le lire, même dans les fichiers.
* Pensez à changer le mot de passe par défaut avant la mise en ligne.

---

## 7. Questions fréquentes

**Les commandes n'arrivent pas sur WhatsApp ?**
→ Vérifiez que le numéro WhatsApp est bien au format international sans espaces, sans `+`, sans `00`
(ex. `24174000000`), et que le téléphone du restaurant est bien connecté à internet dans WhatsApp.

**Puis-je utiliser deux numéros WhatsApp (caisse et cuisine) ?**
→ Oui : ouvrez le site dans le navigateur de la caisse, connectez l'admin sur un appareil,
et faites suivre le message WhatsApp vers la cuisine depuis l'application WhatsApp
(elle permet le transfert vers un autre contact ou un groupe).

**Comment changer les photos des plats ?**
→ Remplacez les fichiers du dossier `public/img/` par vos photos (mêmes noms), ou indiquez
le chemin de l'image dans le champ « img » via `data/menu.json`.

**Le client peut-il payer par Mobile Money directement sur le site ?**
→ Le site affiche le numéro Airtel Money / Moov Money du restaurant et le client envoie le montant,
puis confirme par WhatsApp (capture du transfert). Une intégration automatique de paiement
(Airtel Money API / Moov Money API) peut être ajoutée ensuite sur demande.

**Puis-je imprimer un menu papier ?**
→ Oui : la page `/affiche` est prête pour l'impression A4 avec le QR code. Pour un menu papier complet,
imprimez la page d'accueil du site depuis le navigateur (Ctrl+P), le menu entier s'imprime proprement.

---

👑 **Le Royal Tavern** — Charbonnage, derrière la Chapelle des Vainqueurs, Libreville (Gabon).
