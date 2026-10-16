#!/usr/bin/env bash
# Copie la plateforme web dans l'application Android (mode hors ligne).
#
#   bash scripts/sync-mobile-assets.sh
#
# À relancer chaque fois que le menu, les prix ou les pages du site changent,
# puis reconstruire l'APK : cd mobile && ./gradlew assembleDebug
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/public"
DEST="$ROOT/mobile/app/src/main/assets/www"

echo "→ Génération des données embarquées (carte hors ligne)…"
node "$ROOT/scripts/build-embedded-data.js"

echo "→ Copie des fichiers web vers l'application Android…"
rm -rf "$DEST"
mkdir -p "$DEST"
# On ne copie pas admin.html : l'administration reste sur le site web.
for item in index.html suivi.html affiche.html manifest.webmanifest sw.js css js img icons; do
  cp -r "$SRC/$item" "$DEST/" 2>/dev/null || true
done

# Page d'accueil d'ouverture (mode hors ligne) : l'application sait aussi appeler index.html
echo "✓ Application Android mise à jour : $DEST"
du -sh "$DEST"
