# Health Monitor Simulator

A professional-grade, web-based Medical Vital Signs Simulator designed for clinical training, UI/UX prototyping, and physiological monitoring demonstrations. Now converted to a **Production-Ready Node.js application** with **Render.com** deployment support and persistent visitor analytics.

## 🏥 Overview

The **Health Simulator** provides a high-fidelity representation of a modern medical workstation. It features real-time procedural generation of waveforms, dynamic patient condition assessment, and a comprehensive clinical interface with realistic physiological behavior.

## ✨ Features

-   **High-Fidelity Waveforms**: Real-time rendering of 12-lead equivalent ECG and Plethysmography (SpO₂) using HTML5 Canvas with procedural generation.
-   **Persistent Analytics**: Live tracking of visitor count, likes, and dislikes, securely stored using fail-safe JSON file persistence (`likes_data.json`).
-   **Dynamic Vital Signs**: Realistic simulation of Heart Rate (BPM), Pulse Oximetry (%), and Non-Invasive Blood Pressure (NIBP), including natural physiological drift.
-   **Professional Medical UI**: High-contrast, dark-mode 'Monitor' aesthetic utilizing the **Inter Tight** and **IBM Plex Mono** font families for premium clinical legibility and alignment.
-   **Fail-Proof Backend**: Hardened Express.js server that gracefully handles missing files, prevents crashes, and blocks unauthorized access to backend logic (e.g., `server.js`, `package.json`) with strict 403 Forbidden security headers.
-   **Interactive Controls**: Real-time adjustment of all physiological parameters and measurement sites via a slide-out control panel.

## 🛠 Tech Stack & Dependencies

The project is built using a modern Node.js backend for secure hosting and a "Vanilla Plus" frontend for maximum rendering performance:

-   **Backend**: 
    -   **Node.js**: Runtime environment.
    -   **Express.js**: Web server handling dynamic route protection, visitor tracking middleware, and RESTful API endpoints.
-   **Frontend**:
    -   **HTML5 & Canvas API**: Waveform rendering.
    -   **CSS3**: High-performance flexbox layouts, CSS variables, and clinical animations.
    -   **Vanilla JavaScript (ES6+)**: Core simulation engine and asynchronous state synchronization.
-   **Deployment**:
    -   **Render.com**: Automated deployment target configured via `render.yaml`.

## 🚀 Getting Started

### Local Setup
1.  Clone the repository:
    ```bash
    git clone <your-repo-url>
    cd "Health Monitor Simulator"
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the simulator in production mode:
    ```bash
    npm start
    ```
4.  Open your browser at `http://localhost:3000`.

### Render Deployment
This project includes a `render.yaml` Blueprint for 1-click deployment.
1. Push this repository to GitHub/GitLab.
2. In your Render Dashboard, click **New > Blueprint**.
3. Connect the repository. Render will automatically provision the Node Web Service, install dependencies, and start the application. 
*(Note: To keep likes/visitors across re-deploys on Render's free tier, an external database should be used. Render Disks are supported on paid tiers).*

## 👨‍💻 Developer Guide

### Project Structure
-   `/public`: Contains the frontend static assets (`index.html`, `script.js`, `style.css`, `data.json`).
-   `server.js`: The hardened Express.js entry point containing API routes and security middleware.
-   `likes_data.json`: Local persistence file (git-ignored) for storing interaction analytics.
-   `render.yaml`: Standardized declarative environment manifest for Render.com.

### Advanced Core Logic (`public/script.js`)
-   **`animate(timestamp)`**: High-Frequency `requestAnimationFrame` loop acting as the engine's cardiac pacemaker.
-   **`updateStatsUI()`**: Robust synchronization loop validating network JSON responses against the backend API to prevent UI lockups during server stress.
-   **`getEcgSignal(t_ms)`**: Procedural logic for Lead II Gaussian Summation (Synthesizes P, QRS, T, and U waves).

## 👨‍🎓 Attribution

Designed and Developed with ❤️ by [Kallol Chakraborty](https://github.com/kallolchakraborty).

---
*Disclaimer: This is a simulation tool for educational and design purposes only. It is not intended for actual medical diagnosis or treatment.*
