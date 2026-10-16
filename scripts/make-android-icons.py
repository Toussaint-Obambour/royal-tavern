#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Génère les icônes de l'application Android (legacy + adaptive) pour Le Royal Tavern."""
import os
from PIL import Image, ImageDraw

BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'mobile', 'app', 'src', 'main', 'res')
NAVY = (11, 17, 32, 255)
GOLD = (217, 168, 60, 255)
GOLD_L = (240, 208, 138, 255)
GOLD_D = (169, 118, 31, 255)

# Coordonnées de la couronne dans un carré de 512 (identiques au logo web)
CROWN = [(100, 208), (186, 264), (256, 138), (326, 264), (412, 208), (412, 332), (100, 332)]
PEARLS = [(100, 200, 15), (256, 130, 17), (412, 200, 15)]
BAND = (118, 350, 394, 384)


def scaled(points, size, scale=1.0):
    """Adapte les coordonnées 512 → size, avec facteur d'échelle (pour les marges)."""
    k = size / 512.0 * scale
    ox = size / 2 - (256 * k)
    oy = size / 2 - (256 * k)
    return [((x * k) + ox, (y * k) + oy) for (x, y) in points], k, ox, oy


def draw_crown(size, scale=1.0, crown=GOLD, band=GOLD_D):
    """Dessine la couronne sur une image transparente, anti-aliasée (sur-échantillonnage x4)."""
    SS = 4
    img = Image.new('RGBA', (size * SS, size * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pts, k, ox, oy = scaled(CROWN, size * SS, scale)
    d.polygon(pts, fill=crown)
    x0, y0, x1, y1 = BAND
    d.rounded_rectangle(
        [(x0 * k) + ox, (y0 * k) + oy, (x1 * k) + ox, (y1 * k) + oy],
        radius=10 * k, fill=band)
    for (cx, cy, r) in PEARLS:
        d.ellipse([((cx - r) * k) + ox, ((cy - r) * k) + oy, ((cx + r) * k) + ox, ((cy + r) * k) + oy],
                  fill=GOLD_L)
    return img.resize((size, size), Image.LANCZOS)


def legacy_icon(size, round_shape=False):
    SS = 4
    img = Image.new('RGBA', (size * SS, size * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = int(size * SS * 0.22)
    if round_shape:
        d.ellipse([0, 0, size * SS - 1, size * SS - 1], fill=NAVY)
    else:
        d.rounded_rectangle([0, 0, size * SS - 1, size * SS - 1], radius=r, fill=NAVY)
    # léger dégradé vertical
    grad = Image.new('L', (1, size * SS))
    for y in range(size * SS):
        grad.putpixel((0, y), int(24 * (1 - y / (size * SS))))
    overlay = Image.new('RGBA', (size * SS, size * SS), (255, 255, 255, 0))
    overlay.putalpha(grad.resize((size * SS, size * SS)))
    img = Image.alpha_composite(img, overlay)
    crown = draw_crown(size * SS, scale=0.62)
    img.alpha_composite(crown, (int(size * SS * 0.19), int(size * SS * 0.19)))
    if round_shape:
        mask = Image.new('L', (size * SS, size * SS), 0)
        ImageDraw.Draw(mask).ellipse([0, 0, size * SS - 1, size * SS - 1], fill=255)
        img.putalpha(mask)
    return img.resize((size, size), Image.LANCZOS)


def foreground(size):
    """Calque avant de l'icône adaptative : couronne seule, zone sûre ~62 %."""
    return draw_crown(size, scale=0.52)


DENSITIES = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
LEGACY = 48
FOREGROUND = 108

for name, factor in DENSITIES.items():
    folder = os.path.join(BASE, f'mipmap-{name}')
    os.makedirs(folder, exist_ok=True)
    ls = int(LEGACY * factor)
    legacy_icon(ls).save(os.path.join(folder, 'ic_launcher.png'))
    legacy_icon(ls, round_shape=True).save(os.path.join(folder, 'ic_launcher_round.png'))
    fg = int(FOREGROUND * factor)
    foreground(fg).save(os.path.join(folder, 'ic_launcher_foreground.png'))
    print(f'✓ mipmap-{name}: {ls}px + avant-plan {fg}px')

# Icône adaptative (Android 8+)
anydpi = os.path.join(BASE, 'mipmap-anydpi-v26')
os.makedirs(anydpi, exist_ok=True)
adaptive = '''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
  <background android:drawable="@color/rt_launcher_background" />
  <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
'''
open(os.path.join(anydpi, 'ic_launcher.xml'), 'w', encoding='utf-8').write(adaptive)
open(os.path.join(anydpi, 'ic_launcher_round.xml'), 'w', encoding='utf-8').write(adaptive)

# Couleur de fond de l'icône adaptative
colors = os.path.join(BASE, 'values', 'colors.xml')
content = open(colors, encoding='utf-8').read()
if 'rt_launcher_background' not in content:
    content = content.replace('</resources>', '  <color name="rt_launcher_background">#0B1120</color>\n</resources>')
    open(colors, 'w', encoding='utf-8').write(content)

print('✓ icône adaptative + couleur de fond créées')
