# Health Simulator — ICU Critical Care Training Tool

A high-fidelity, web-based critical care simulator designed for training junior doctors. Features real-time waveform generation, dynamic vital signs, a drug library with interactions, an ABG interpreter, scenario timelines, and a professional ICU monitor interface.

Ships as a **fully static site** (GitHub Pages ready, no backend needed) with an optional **Node.js/Express backend**.

## Features

- **Real-time Waveforms**: ECG (12-lead equivalent), Plethysmography, Capnography, and Arterial Line waveforms rendered via HTML5 Canvas.
- **Vital Signs Simulation**: Heart Rate, SpO₂, NIBP, Temperature, Respiratory Rate, EtCO₂, GCS, Pain Score — with natural physiological drift.
- **Drug Library**: 15 drugs with dose-response (Low/Std/High), drug-drug interaction warnings, and active infusion tracking.
- **ABG Interpreter**: Automatic acid-base classification with Winter's formula, hypoxemia assessment, and lactate evaluation.
- **Scenario Timelines**: Pre-built scenarios (Sepsis, STEMI, Anaphylaxis, Hemorrhage, COPD, Cardiac Arrest, Hypovolemia) with time-triggered vital changes and clinical narratives.
- **View Modes**: ECG Focus, SpO₂ Focus, BP Focus, and Records overview — one-tap switching from the bottom nav.
- **Alarm System**: Multi-level alarms (advisory/warning/crisis) with configurable thresholds, silence, and suspend.
- **Quiz Mode**: Hides rhythm interpretation — ideal for teaching.
- **Scoring**: MEWS, qSOFA, NEWS2 with per-component hover breakdowns.
- **Clinical References**: Built-in modals for ECG intervals, heart rate zones, BP classification, SpO₂ thresholds, temperature ranges, capnography, and arterial line waveforms.
- **Event Log**: Auto-captures drug administrations and rhythm changes for debriefing.
- **Nurse Call**: Visual + banner alert system.

## Tech Stack

- **Frontend**: HTML5, CSS3 (Flexbox/Grid), Vanilla JS (ES6+), Canvas API
- **Backend** (optional): Node.js + Express.js
- **Deployment**: GitHub Pages (`/docs` folder) or Render.com

## Getting Started

### GitHub Pages (Static — No Backend)
1. Push to GitHub.
2. Go to **Settings > Pages**, select branch `main` and folder `/docs`.
3. Site live at `https://<username>.github.io/Health-Simulator/`.

### Local Development (Node.js Backend)
```bash
git clone <repo-url>
cd "Health Monitor Simulator"
npm install
npm start
# Open http://localhost:3000
```

## Project Structure
- `docs/` — Fully self-contained static site (`index.html`, `style.css`, `script.js`, `data.json`, `logo.png`)
- `server.js` — Optional Express.js server
- `render.yaml` — Render.com deployment config

## Attribution

Designed and Developed by [Kallol Chakraborty](https://github.com/kallolchakraborty).

*Disclaimer: This is a simulation tool for educational purposes only. Not for actual medical diagnosis or treatment.*
