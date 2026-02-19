# Health Simulator

A professional-grade, web-based Medical Vital Signs Simulator designed for clinical training, UI/UX prototyping, and physiological monitoring demonstrations. Now converted to a **Node.js application** with **SAP BTP (Business Technology Platform)** readiness.

## 🏥 Overview

The **Health Simulator** provides a high-fidelity representation of a modern medical workstation. It features real-time procedural generation of waveforms, dynamic patient condition assessment, and a comprehensive clinical interface with realistic physiological behavior.

## ✨ Features

-   **High-Fidelity Waveforms**: Real-time rendering of 12-lead equivalent ECG and Plethysmography (SpO₂) using HTML5 Canvas with procedural generation.
-   **Dynamic Vital Signs**: Realistic simulation of Heart Rate (BPM), Pulse Oximetry (%), and Non-Invasive Blood Pressure (NIBP), including natural physiological drift.
-   **Body Temperature Monitoring**: Advanced thermal monitoring supporting **Celsius (°C)** and **Fahrenheit (°F)** with site-specific offsets (Oral, Rectal, Axillary, Tympanic, Temporal).
-   **Physiological State Logic**: Automatic patient condition assessment (GOOD, UNSTABLE, CRITICAL) based on clinical thresholds for all vitals, including fever classification.
-   **Professional Medical UI**: High-contrast, dark-mode 'Monitor' aesthetic utilizing the **Outfit** and **Inter** font families for premium clinical legibility.
-   **Interactive Controls**: Real-time adjustment of all physiological parameters and measurement sites via a slide-out control panel.
-   **Clinical Reference Modals**: Integrated interactive charts and tables for ECG rhythms, Blood Pressure categories, and Fever Classification protocols.
-   **Cloud-Ready Architecture**: Packaged as a Node.js application with an `mta.yaml` manifest for seamless deployment to SAP BTP.

## 🛠 Tech Stack & Dependencies

The project is built using a modern Node.js backend for hosting and a "Vanilla Plus" frontend for performance:

-   **Backend**: 
    -   **Node.js**: Runtime environment.
    -   **Express.js**: Lightweight web server for hosting static assets and handling routing.
-   **Frontend**:
    -   **HTML5 & Canvas API**: Waveform rendering and structural foundation.
    -   **CSS3**: Grid/Flexbox layouts and clinical animations.
    -   **Vanilla JavaScript (ES6+)**: Core simulation engine and state management.
-   **Cloud Infrastructure**:
    -   **SAP BTP Cloud Foundry**: Deployment target via `mta.yaml`.

## 🚀 Getting Started

### Local Setup
1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the simulator:
    ```bash
    npm start
    ```
4.  Open your browser at `http://localhost:3000`.

### SAP BTP Deployment
This project is configured as a Multi-Target Application (MTA).
1.  Ensure the **Cloud MTA Build Tool (MBT)** and **CF CLI** are installed.
2.  Build the project:
    ```bash
    mbt build
    ```
3.  Deploy to your subaccount:
    ```bash
    cf deploy mta_archives/health-monitor_0.0.1.mtar
    ```

## 👨‍💻 Developer Guide

### Project Structure
-   `/public`: Contains the frontend static assets (`index.html`, `script.js`, `style.css`, `data.json`).
-   `server.js`: The Express.js entry point that initializes the web server.
-   `mta.yaml`: Manifest for SAP BTP, defining the Node.js module and required resources.
-   `package.json`: Manages scripts and dependencies (`express`).

### Simulation Logic
-   **State Object**: Centralized source of truth for all simulation variables.
-   **Waveform Engine**: Procedural logic for ECG (P-QRS-T complex) and SpO₂ pulse peaks.
-   **Animation Loop**: High-frequency `requestAnimationFrame` loop handling waveform drawing and natural vitals drift.

## 🛠 Technical Function Reference

The core logic of the simulator is contained within `public/script.js`.

### 🛡 Core Engine & Lifecycle
- **`loadData()`**: 
  - *Type*: Async
  - *Purpose*: Fetches `data.json` to initialize the session. 
  - *Logic*: Populates patient metadata (Name, ID, Room) via DOM manipulation. It loads the longitudinal `timelineData` array and sets the initial state.
- **`animate(timestamp)`**: 
  - *Type*: High-Frequency Loop (`requestAnimationFrame`)
  - *Purpose*: The engine's cardiac pacemaker.
  - *Logic*: Handles timeline sequencing, cardiac timing, and horizontal sweep coordinate management.
- **`resizeCanvases()`**: 
  - *Type*: Layout Listener
  - *Purpose*: Event-driven function that recalibrates canvas pixel density to maintain waveform sharpness.

### 🧬 Physiological Modeling (Waveform Synthesis)
- **`getEcgSignal(t_ms)`**: 
  - *Model*: Lead II Gaussian Summation. Synthesizes P, QRS, T, and U waves.
- **`getPlethSignal(phase)`**: 
  - *Model*: Dicrotic Sine-Exponential Hybrid. Simulates infrared light absorption in tissue.

### 🏥 Clinical Logic & Interaction
- **`checkAlarms()`**: 
  - *Type*: Diagnostic Parser. Evaluates vitals against clinical thresholds to update patient status (`GOOD`, `UNSTABLE`, `CRITICAL`).
- **`updateUIFromState()`**: 
  - *Type*: Synchronizer. One-way data binding from the internal `state` object to the UI components.

### ⚙️ UI Utilities & Effects
- **`setActiveView(viewClass, btnId)`**: 
  - *Engine*: Grid Orchestrator. Toggles CSS layouts for focused monitoring (e.g., dedicated ECG view).
- **Nurse Call Effect**: Procedurally generates "snowflake" elements to simulate an emergency alert "frost" over the UI.

## 👨‍🎓 Attribution

Designed and Developed with ❤️ by [Kallol Chakraborty](https://www.linkedin.com/in/kallol-chakraborty-9728a699/).

---
*Disclaimer: This is a simulation tool for educational and design purposes only. It is not intended for actual medical diagnosis or treatment.*
