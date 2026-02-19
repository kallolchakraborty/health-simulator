# Health Simulator

A professional-grade, web-based Medical Vital Signs Simulator designed for clinical training, UI/UX prototyping, and physiological monitoring demonstrations.

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

##  Tech Stack & Dependencies

The project is built using a modern, zero-dependency "Vanilla Plus" approach for maximum performance and portability:

-   **HTML5**: Semantic structure and Canvas API.
-   **CSS3**: Advanced layouts using Grid and Flexbox, custom animations, and responsive design systems.
-   **Vanilla JavaScript (ES6+)**: Core simulation logic, waveform engine, and state management.
-   **Google Fonts**: 
    -   `Outfit`: Geometric sans for branding and high-impact headers.
    -   `Inter`: Precision-engineered sans for clinical data legibility.

*No external libraries or frameworks (like React or jQuery) are required.*

## 🚀 Getting Started

1.  Clone the repository or download the source files.
2.  Open `index.html` in any modern web browser.
3.  Use the **SETTINGS** button in the top right to open the Control Panel and adjust simulation parameters.
4.  Click the `ℹ️` icons on each panel to view clinical reference data and guidance.

## 👨‍💻 Developer Guide

### Project Structure
-   `index.html`: Main UI structure and clinical modal definitions.
-   `style.css`: Medical design system, workstation aesthetics, and animations.
-   `script.js`: 
    -   **State Object**: Centralized source of truth for all simulation variables.
    -   **Waveform Engine**: Procedural logic for ECG (P-QRS-T complex) and SpO₂ pulse peaks.
    -   **Animation Loop**: High-frequency `requestAnimationFrame` loop handling waveform drawing and natural vitals drift.

### How to Scale or Expand

#### 1. Adding New Vital Signs (e.g., Resp Rate, EtCO₂)
-   **HTML**: Add a new `.panel` in the `.dashboard-grid` section of `index.html`.
-   **CSS**: Update the grid template in `style.css` if the layout needs adjustment.
-   **JS**: Add the new parameter to the `state` object and create a drawing or update function.

#### 2. Enhancing Physiological Logic
-   Modify the `checkAlarms` function in `script.js` to implement more complex multi-parameter diagnostic logic (e.g., calculating Shock Index).

#### 3. Customizing the Medical Theme
-   Global design tokens are managed in `style.css`. Update the `.app-container` and `.panel` selectors to change the monitor's visual styling.

## 🛠 Technical Function Reference

The core logic of the simulator is contained within `script.js`. This section provides a detailed technical breakdown of every major functional component.

### 🛡 Core Engine & Lifecycle
- **`loadData()`**: 
  - *Type*: Async
  - *Purpose*: Fetches `data.json` to initialize the session. Populates patient metadata (Name, ID, Room) and loads the longitudinal `timelineData` array which dictates vital sign changes over hours or minutes.
- **`animate(timestamp)`**: 
  - *Type*: Animation Loop (`requestAnimationFrame`)
  - *Purpose*: The heart of the simulation. Synchronized to the display refresh rate (60Hz), it handles:
    - **Timeline Sequencing**: Mapping elapsed time to specific vital sign targets.
    - **Physiological Drift**: Injecting natural, beat-driven fluctuations into vitals for realism.
    - **Waveform Scanning**: Calculating the precise pixel coordinates for the ECG and Pleth sweeps.
- **`resizeCanvases()`**: 
  - *Type*: Window Resident
  - *Purpose*: Calculates the exact width and height of canvas elements based on their parent grid containers. Crucial for maintaining waveform resolution and prevents image stretching during browser resizing.

### 🧬 Physiological Modeling (Waveform Synthesis)
- **`getEcgSignal(t_ms)`**: 
  - *Model*: Composite Gaussian Synthesis
  - *Details*: Calculates the Y-offset for a cardiac cycle at a given millisecond. It adds multiple Gaussian waves to create the P-wave, Q-Complex, R-Peak, S-Complex, and T-wave. Responds dynamically to HR and user-defined PR/QRS intervals.
- **`getPlethSignal(phase)`**: 
  - *Model*: Sine-Decay with Dicrotic Notch
  - *Details*: Represents Infrared absorption in the finger. Uses a rapid sine upstroke for systole and an exponential decay for diastole, with a small Gaussian 'bump' to represent the aortic valve closure (dicrotic notch).

### 🏥 Clinical Logic & State Management
- **`checkAlarms()`**: 
  - *Logic*: Threshold Evaluation
  - *Details*: Continuously evaluates current vitals against clinical safety ranges. It triggers visual alerts (blinking) and updates the patient status (`GOOD`, `UNSTABLE`, `CRITICAL`) based on parameters like SpO₂ < 92% or BP > 140/90.
- **`updateUIFromState()`**: 
  - *Role*: Synchronization Layer
  - *Details*: Standardizes the UI state. When parameters change (via timeline or user slider), this function updates all labels, displays, and control settings throughout the app to maintain data integrity.
- **`formatTemp(celsius)` / `formatRange(rangeStr)`**: 
  - *Role*: Unit Conversion Utility
  - *Details*: Handles mathematical conversion (C ↔ F) and string formatting. Ensures that regardless of the display unit, the underlying clinical logic remains grounded in precise Celsius values.

### 📊 Visualization & Reference Rendering
- **`draw[Vital]Reference()`**: 
  - *Category*: Canvas Drawing Suite
  - *Functions*: `drawReferenceModal` (ECG), `drawHrReference`, `drawBpReference`, etc.
  - *Details*: Uses Canvas `roundRect`, `stroke`, and `fillText` APIs to render detailed clinical maps. These functions draw categorized medical "danger zones" (e.g., Hypertension stages or Hypoxemia levels) and place a live needle indicating where the patient currently falls on that scale.

### 🧭 Navigation & Interaction
- **`setActiveView(viewClass, btnId)`**: 
  - *Logic*: Grid Orchestrator
  - *Details*: Manages transitions between "Home" dashboard and "Focused" single-vital views. It toggles CSS layout classes and ensures canvases are cleared and waveforms are reset to coordinate `(0, y)` to avoid visual artifacts during transitions.
- **Accordion & Modal Listeners**: 
  - *Role*: UI Interaction
  - *Details*: Standardized listeners that handle the state of slide-out settings and clinical information overlays using CSS classes for hardware-accelerated animations.

## 👨‍🎓 Attribution

Designed and Developed with ❤️ by [Kallol Chakraborty](https://www.linkedin.com/in/kallol-chakraborty-9728a699/).

---
*Disclaimer: This is a simulation tool for educational and design purposes only. It is not intended for actual medical diagnosis or treatment.*
