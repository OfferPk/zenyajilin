# ZenYajilin (ヤジリン)

> **Calm, meditative Japanese Yajilin (Yajirin / Arrow Ring) loop logic puzzle with procedural acoustics.**

[![CI](https://github.com/OfferPk/zenyajilin/actions/workflows/ci.yml/badge.svg)](https://github.com/OfferPk/zenyajilin/actions/workflows/ci.yml)
[![Pages](https://github.com/OfferPk/zenyajilin/actions/workflows/pages.yml/badge.svg)](https://github.com/OfferPk/zenyajilin/actions/workflows/pages.yml)
[![Android](https://github.com/OfferPk/zenyajilin/actions/workflows/android.yml/badge.svg)](https://github.com/OfferPk/zenyajilin/actions/workflows/android.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 🎮 Play Live
- **Web App / PWA**: [https://offerpk.github.io/zenyajilin/](https://offerpk.github.io/zenyajilin/)
- **Android APK**: Download `zenyajilin-apk` from [GitHub Actions Artifacts](https://github.com/OfferPk/zenyajilin/actions/workflows/android.yml) or latest [Releases](https://github.com/OfferPk/zenyajilin/releases).

---

## 📸 Screenshots

| Arrow Clues & Black Stones | Fluid Loop Drawing | Grand Garden Layouts |
|:---:|:---:|:---:|
| *(Tactile stone & dot placement)* | *(Drag to weave unbroken loop segments)* | *(50 levels across 5 difficulty packs)* |

---

## 🌸 About the Game

ZenYajilin is inspired by the classic Japanese pencil-and-paper puzzle **Yajilin** (ヤジリン / *Yajirin*, meaning "Arrow Ring"), popularized by Nikoli.

You discover the hidden positions of dark stones while connecting open cells into a single continuous loop:
1. **Arrow Clues**: Numbered arrow tiles (e.g., `1 →`, `2 ↓`) show exactly how many black stones lie along that directional ray to the edge of the grid. Clue tiles are fixed obstacles and are never part of the loop.
2. **No Adjacent Stones**: Black stones can never touch orthogonally (sharing an edge). Diagonal touching is allowed.
3. **Single Continuous Loop**: Every non-clue, unshaded cell must be visited by exactly one continuous closed loop that never branches or self-intersects.

---

## ✨ Features

- **50 Handcrafted Levels**: 5 difficulty tiers (Morning Garden 6×6, Bamboo Grove 7×7, Stone Sanctuary 8×8, Torii Gate 9×9, Imperial Pavilion 10×10).
- **100% Unique Solutions**: All 50 levels verified by constraint engine.
- **Procedural Japanese Web Audio**:
  - Gentle shakuhachi bamboo flute breath tones when extending loop segments.
  - Crisp pebble clicks when placing black stones.
  - Soft bamboo ticks when marking confirmed open path dots.
  - Harmonic koto chords when an arrow clue is satisfied.
  - Wooden block warning chime on conflicting adjacent stones.
  - Resonant Japanese Buddhist temple victory bell (*Bonshō* 梵鐘) tuned to the sacred 108 Hz fundamental upon level completion.
- **Fluid Controls**:
  - Drag or swipe between cells to draw or remove loop segments.
  - Dedicated tool modes: Loop (➰), Stone (●), and Dot (·).
  - Real-time clue validation glowing tranquil green when matched.
- **Deductive Hint Engine**: Step-by-step logic guidance highlighting forced black stones, forced loop paths, and dead-end turns.
- **Unlimited Undo & Reset**: Experiment freely with full state history.
- **Offline & Private**: Built as a zero-dependency Progressive Web App (PWA) with Service Worker and Capacitor Android packaging. Zero ads, zero trackers, no permissions needed.

---

## 🛠️ Development & Build

### Prerequisites
- Node.js (v20+ recommended)
- npm

### Run Locally
```bash
# Clone the repository
git clone https://github.com/OfferPk/zenyajilin.git
cd zenyajilin

# Run unit tests
npm test

# Build static assets to www/
npm run build
```

To run a local web server:
```bash
npx serve www
```

### Android APK Build
The project uses Capacitor to package the web assets into a native Android application:
```bash
# Add or sync Android platform
npx cap add android
npx cap sync android

# Build debug APK via Gradle
cd android
./gradlew assembleDebug
```
The resulting debug APK will be generated at `android/app/build/outputs/apk/debug/app-debug.apk`.

---

## 📄 License
This project is open-source under the [MIT License](LICENSE).
