# Health Monitor Simulator

A professional-grade, web-based Medical Vital Signs Simulator designed for clinical training, UI/UX prototyping, and physiological monitoring demonstrations. Ships as a **fully static site** (GitHub Pages ready, no backend needed) with an optional **Node.js/Express backend** for server-side persistence.

## 🏥 Overview

The **Health Simulator** provides a high-fidelity representation of a modern medical workstation. It features real-time procedural generation of waveforms, dynamic patient condition assessment, and a comprehensive clinical interface with realistic physiological behavior.

## ✨ Features

-   **High-Fidelity Waveforms**: Real-time rendering of 12-lead equivalent ECG and Plethysmography (SpO₂) using HTML5 Canvas with procedural generation.
-   **Static-First Architecture**: Deploy to **GitHub Pages** with zero configuration — `docs/` folder is fully self-contained. No server required.
-   **Persistent Analytics (Static)**: Likes, dislikes, and visitor counts persist via `localStorage` — survives page reloads with no backend.
-   **Persistent Analytics (Server)**: When running the Node.js backend, data persists via JSON file (`likes_data.json`) across all users.
-   **Dynamic Vital Signs**: Realistic simulation of Heart Rate (BPM), Pulse Oximetry (%), Non-Invasive Blood Pressure (NIBP), and Body Temperature including natural physiological drift.
-   **Professional Medical UI**: High-contrast, dark-mode 'Monitor' aesthetic utilizing the **Inter Tight** and **IBM Plex Mono** font families for premium clinical legibility and alignment.
-   **Fail-Proof Backend (optional)**: Hardened Express.js server that gracefully handles missing files, prevents crashes, and blocks unauthorized access to backend logic with strict 403 Forbidden security headers.
-   **Interactive Controls**: Real-time adjustment of all physiological parameters, ECG intervals (PR, QRS, ST), and measurement sites via a slide-out control panel.
-   **Clinical Reference Modals**: Built-in reference tables for ECG intervals, heart rate zones, blood pressure classification, SpO₂ thresholds, temperature ranges, and plethysmography indices — ideal for bedside teaching.

## 🛠 Tech Stack & Dependencies

The project is built using a modern Node.js backend for secure hosting and a "Vanilla Plus" frontend for maximum rendering performance:

-   **Deployment**:
    -   **GitHub Pages** (default): Static site from `/docs` folder — no server, zero cost.
    -   **Render.com** (optional): Node.js backend deployment via `render.yaml`.
-   **Frontend**:
    -   **HTML5 & Canvas API**: Waveform rendering.
    -   **CSS3**: High-performance flexbox layouts, CSS variables, and clinical animations.
    -   **Vanilla JavaScript (ES6+)**: Core simulation engine, localStorage persistence, and asynchronous state synchronization.
-   **Backend** (optional): 
    -   **Node.js + Express.js**: Web server for server-side persistence, visitor tracking, and route protection.

## 🚀 Getting Started

### 🌐 GitHub Pages (Static — No Backend Needed)
1. Push this repository to GitHub.
2. In your GitHub repo, go to **Settings > Pages**.
3. Under "Build and deployment", select **Deploy from a branch**.
4. Choose branch `main` and folder `/docs`.
5. Click **Save**. Your site will be live at `https://<your-username>.github.io/Health-Simulator/`.

The `docs/` folder contains a fully self-contained static build — no server required. Likes/dislikes use `localStorage` for persistence.

### 💻 Local Development (Node.js Backend)
1.  Clone the repository:
    ```bash
    git clone <your-repo-url>
    cd "Health Monitor Simulator"
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the simulator:
    ```bash
    npm start
    ```
4.  Open your browser at `http://localhost:3000`.

    > **Note:** The Node.js backend enables server-side visitor tracking and persistent likes across users via JSON files. For local or single-user use, the static `docs/` build works identically.

### Render Deployment
This project includes a `render.yaml` Blueprint for 1-click deployment.
1. Push this repository to GitHub/GitLab.
2. In your Render Dashboard, click **New > Blueprint**.
3. Connect the repository. Render will automatically provision the Node Web Service, install dependencies, and start the application. 
*(Note: To keep likes/visitors across re-deploys on Render's free tier, an external database should be used. Render Disks are supported on paid tiers).*

## 👨‍💻 Developer Guide

### Project Structure
-   `/docs`: Frontend assets (`index.html`, `script.js`, `style.css`, `data.json`, `logo.png`). Single source of truth for both GitHub Pages and local Express server.
-   `server.js`: Optional hardened Express.js entry point (for Render.com or local server with persistent visitor tracking).
-   `likes_data.json`: Local persistence file (git-ignored) for server-side interaction analytics.
-   `render.yaml`: Declarative environment manifest for Render.com deployment.
-   `PHASES.md`: Roadmap of planned teaching-focused improvements.

### Advanced Core Logic (`docs/script.js`)
-   **`animate(timestamp)`**: High-Frequency `requestAnimationFrame` loop acting as the engine's cardiac pacemaker.
-   **`updateStatsUI()`**: Robust synchronization loop validating network JSON responses against the backend API to prevent UI lockups during server stress.
-   **`getEcgSignal(t_ms)`**: Procedural logic for Lead II Gaussian Summation (Synthesizes P, QRS, T, and U waves).

## 👨‍🎓 Attribution

Designed and Developed with ❤️ by [Kallol Chakraborty](https://github.com/kallolchakraborty).

---
*Disclaimer: This is a simulation tool for educational and design purposes only. It is not intended for actual medical diagnosis or treatment.*
