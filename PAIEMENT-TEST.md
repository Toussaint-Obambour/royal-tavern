# 💳 PAIEMENT EN LIGNE — MODE TEST
### Le Royal Tavern · Mode d'emploi du simulateur

---

## 🎯 À QUOI ÇA SERT

Vous n'avez pas encore de compte marchand PVit / Moov. Ce simulateur vous permet **dès maintenant** de :

- tester **tout le parcours client** (choisir un plat → commander → payer → recevoir la confirmation) ;
- **former l'équipe** à la caisse sans risquer un vrai franc ;
- **montrer le service au client** dans une démo, avant même l'ouverture du compte marchand ;
- vérifier que la **comptabilité** (journal des paiements, export CSV) fonctionne.

> ⚠️ **Aucun argent réel ne circule.** Le mode est indiqué partout par un bandeau jaune « Mode test ».
> Le jour où votre compte PVit ou Moov sera ouvert, il suffira de brancher les clés : **l'interface ne changera pas**.

---

## 🚀 LES 3 PORTES D'ENTRÉE

| Adresse | Pour qui | À quoi ça sert |
|---|---|---|
| **`/paiement.html`** | Le client | Page de paiement Mobile Money (Airtel / Moov) |
| **`/terminal.html`** | La caisse | Créer une demande de paiement à la main (montant libre) |
| **`/admin` → onglet 💳 Paiements** | Le gérant | Voir, valider, rembourser, exporter |

---

## 🧪 SCÉNARIO DE TEST EN 2 MINUTES

### Option A — depuis le site (parcours client complet)

1. Ouvrir le site → se connecter ou entrer en invité.
2. Ajouter un plat au panier → **Commander**.
3. Remplir nom, téléphone, adresse.
4. Choisir **Airtel Money** ou **Moov Money** comme moyen de paiement.
5. Valider → la fenêtre de confirmation propose **« 💳 Payer X FCFA par Airtel Money »**.
6. Saisir un numéro Mobile Money (n'importe lequel, 8 chiffres minimum).
7. Sur l'écran suivant, taper le **code secret de test : `1234`**.
8. ✅ Écran vert, reçu avec la référence de transaction.
9. Aller dans **Admin → Paiements** : la transaction apparaît en « Payé ».
10. Dans **Admin → Commandes**, la pastille **💳 Payé** s'affiche sous le montant.

### Option B — depuis le terminal (encaissement au comptoir)

1. Ouvrir **`/terminal.html`**.
2. Cliquer sur **+10 000** (ou plusieurs boutons pour additionner).
3. Choisir Airtel ou Moov, saisir le numéro du client.
4. **Créer la demande de paiement** → la page de paiement s'ouvre.
5. Taper **`1234`** → paiement validé, visible dans le tableau du terminal.

---

## 🔐 LE CODE DE TEST

| Paramètre | Valeur par défaut | Modifiable par |
|---|---|---|
| Code secret | **`1234`** | variable `TEST_PIN` |
| Durée de validité | **5 minutes** | variable `PAYMENT_TTL` (en secondes) |
| Tentatives autorisées | **3** | — |
| Montant minimum | 150 FCFA | — (règle du réseau) |
| Montant maximum | 500 000 FCFA | — (règle du réseau) |

**Les 3 issues possibles :**

| Ce que vous faites | Ce qui se passe |
|---|---|
| Bon code `1234` | ✅ Paiement réussi, commande marquée payée |
| Mauvais code 1 ou 2 fois | ❌ Message « Code incorrect, X tentative(s) restante(s) » |
| 3 mauvais codes | ⛔ Paiement « Échoué », il faut recommencer |
| Aucune saisie pendant 5 min | ⏱️ Paiement « Expiré », bouton « Réessayer » |
| Bouton « Annuler » | ✖️ Paiement « Annulé » |

---

## 📊 CE QUE VOIT LE GÉRANT (onglet Paiements)

- **Encaissé (total)** — somme des paiements réussis
- **Paiements réussis** / **En attente** / **Taux de réussite**
- Le **journal complet** : référence, commande, opérateur, numéro masqué, montant, statut, heure
- **Valider** un paiement manuellement (si l'argent est arrivé hors ligne)
- **Rembourser** un paiement
- **Export CSV** de tous les paiements (compatible Excel)

> 🔒 **Le numéro du client est masqué** dans l'admin (`06 •• •• 67`) et dans l'export. Le nom du client n'apparaît jamais sur la page de paiement publique.

---

## 🔄 DU TEST AU RÉEL : CE QUI CHANGERA

Le simulateur reproduit exactement le fonctionnement d'un agrégateur (PVit, Moov) :

| Étape | En test | En réel |
|---|---|---|
| Création de la demande | Notre serveur | Requête à l'API PVit |
| Validation client | Code saisi dans le simulateur | Notification réelle sur le téléphone du client |
| Confirmation | Bouton / API | **Webhook** envoyé par l'agrégateur |
| Reversement | Aucun | Sous 24 à 72 h sur votre compte |

**Ce qu'il faudra faire le jour J :**

1. Recevoir vos clés API (PVit ou Moov Money Online).
2. Les enregistrer dans les variables d'environnement Render :
   - `PAYMENT_MODE=live`
   - `PVIT_API_KEY=…` et `PVIT_SITE_ID=…` (ou les clés Moov)
   - `WEBHOOK_SECRET=…` (une phrase secrète de votre choix)
3. Je branche les appels réels dans `server.js` (le reste du site ne bouge pas).

**Le mode test reste accessible** même après le passage au réel : il suffit de garder `/terminal.html` pour les démonstrations.

---

## 🧰 POUR LE DÉVELOPPEUR (mémo technique)

### Endpoints

| Méthode | Route | Rôle |
|---|---|---|
| `GET` | `/api/payments/config` | Mode, opérateurs actifs, code de test, plafonds |
| `POST` | `/api/payments/init` | Crée une demande (`orderNumber` ou montant libre en test) |
| `GET` | `/api/payments/:ref` | État d'un paiement (sans le code) |
| `POST` | `/api/payments/:ref/confirm` | Valide avec le code secret |
| `POST` | `/api/payments/:ref/cancel` | Annule |
| `POST` | `/api/payments/:ref/resend` | Relance et remet le compteur à zéro |
| `POST` | `/api/payments/webhook` | Callback agrégateur — en-tête `x-webhook-secret` |
| `GET` | `/api/payments/recent` | Historique court (mode test uniquement) |
| `POST` | `/api/admin/payments/:ref/validate` | Validation manuelle |
| `POST` | `/api/admin/payments/:ref/refund` | Remboursement |
| `GET` | `/api/admin/payments.csv` | Export comptable |

### Exemple cURL

```bash
# 1. Créer une demande de 12 000 FCFA
curl -X POST http://localhost:3400/api/payments/init \
  -H 'content-type: application/json' \
  -d '{"amount":12000,"operator":"airtel","phone":"061234567","label":"Test caisse"}'

# 2. Confirmer avec le code de test
curl -X POST http://localhost:3400/api/payments/PAY-261017-ABCD/confirm \
  -H 'content-type: application/json' -d '{"code":"1234"}'

# 3. Simuler un webhook d'agrégateur
curl -X POST http://localhost:3400/api/payments/webhook \
  -H 'content-type: application/json' -H 'x-webhook-secret: rt-test-secret' \
  -d '{"ref":"PAY-261017-ABCD","status":"reussi","providerRef":"PVIT-123"}'
```

### Fichiers concernés

| Fichier | Rôle |
|---|---|
| `server.js` (section « Passerelle de paiement ») | Moteur, statuts, webhook |
| `public/paiement.html` | Parcours client (3 écrans, autonome) |
| `public/terminal.html` | Caisse de test |
| `public/admin.html` (onglet Paiements) | Suivi et actions |
| `data/payments.json` | Journal des transactions |
| `scripts/test-paiement.py` | Test automatique du parcours |
| `scripts/test-commande-paiement.py` | Test site → commande → paiement |

### Cycle de vie d'un paiement

```
en_attente ──(code correct)──► reussi ──(admin)──► rembourse
     │
     ├──(3 codes faux)──► echoue
     ├──(client annule)─► annule
     └──(5 min écoulées)► expire
```

### Les 3 statuts de paiement d'une commande

`en_attente` → `reussi` → `rembourse` (ou `echoue` / `annule` / `expire`).
Ils sont **indépendants du statut cuisine** (nouvelle → confirmée → en préparation → en livraison → livrée), pour que le restaurant puisse cuisiner même si le paiement traîne.

---

## ✅ À FAIRE AVANT D'ANNONCER LE SERVICE AUX CLIENTS

- ☐ Vérifier que `PAYMENT_MODE` n'est **pas** `live` tant que les clés ne sont pas branchées
- ☐ Tester un paiement complet depuis un vrai téléphone (site déployé sur Render)
- ☐ Former la personne à la caisse sur `/terminal.html`
- ☐ Vérifier que l'export CSV s'ouvre bien dans Excel
- ☐ Faire 2 ou 3 paiements de test avec l'équipe, puis **vider** le journal avant l'ouverture

---

*Document préparé pour Le Royal Tavern — Charbonnages, Libreville*
*Simulateur développé le 17 octobre 2026 · Version 1.0*
