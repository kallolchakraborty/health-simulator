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

The core logic of the simulator is contained within `script.js`. This section provides an exhaustive technical breakdown of every functional component.

### 🛡 Core Engine & Lifecycle
- **`loadData()`**: 
  - *Type*: Async
  - *Purpose*: Fetches `data.json` to initialize the session. 
  - *Logic*: Populates patient metadata (Name, ID, Room) via DOM manipulation. It loads the longitudinal `timelineData` array and sets the initial state derived from the first timeline point or `baseVitals`.
- **`animate(timestamp)`**: 
  - *Type*: High-Frequency Loop (`requestAnimationFrame`)
  - *Purpose*: The engine's cardiac pacemaker.
  - *Timeline Logic*: Maps `elapsedMinutes` to indices in `timelineData` (samples every 5 seconds) to automatically drive vitals over time.
  - *Cardiac Timing*: Calculates `beatDuration` (60000 / HR). Triggers at the exact millisecond a new beat should occur to synchronize physical "thumping" effects and data fluctuations.
  - *Coordinate Sweep*: Manages the horizontal `ecgX` variable, handling "wrap-around" logic and clearing a "scan bar" ahead of the waveform to simulate an analog phosphor monitor.
- **`resizeCanvases()`**: 
  - *Type*: Layout Listener
  - *Purpose*: Event-driven function (attached to `window.resize`) that recalibrates canvas pixel density. It ensures clinical waveforms remain sharp and correctly scaled when the browser window or the dashboard layout changes.

### 🧬 Physiological Modeling (Waveform Synthesis)
- **`getEcgSignal(t_ms)`**: 
  - *Model*: Lead II Gaussian Summation
  - *Details*: Synthesizes a complex voltage-time curve.
    - **P-Wave**: $0.15 \times \exp(-(t-80)^2 / 2(40/3)^2)$
    - **QRS**: Sharp negative Q, sharp positive R ($1.0 \times$ Gain), and negative S.
    - **T-Wave**: Broad positive curve representing repolarization.
    - **U-Wave**: Subtle late curve.
  - *Dynamic Inputs*: Responds to `ecgPR`, `ecgQRS`, `ecgST` (elevation/depression), and `ecgAmp` gain.
- **`getPlethSignal(phase)`**: 
  - *Model*: Dicrotic Sine-Exponential Hybrid
  - *Details*: Simulates infrared light absorption in tissue.
    - **Systolic Phase (0-0.2)**: Rapid sine-wave upstroke.
    - **Diastolic Phase (0.2-1.0)**: Exponential decay with a Gaussian bump at phase 0.3 to simulate the dicrotic notch (aortic valve closure).

### 🏥 Clinical Logic & Interaction
- **`checkAlarms()`**: 
  - *Type*: Diagnostic Parser
  - *Logic*: Evaluates current `hr`, `spo2`, `bp`, and `temp` against standard ACLS/ACCP thresholds. 
  - *Statuses*:
    - `CRITICAL`: Triggered by extreme values (e.g., HR < 40 or SpO₂ < 85%). Activates `status-critical` blinking.
    - `UNSTABLE`: Triggered by out-of-range but non-life-threatening values.
    - `GOOD`: All parameters within safe margins.
- **`updateUIFromState()`**: 
  - *Type*: Synchronizer
  - *Details*: One-way data binding from the internal `state` object to the UI labels, slider positions, and unit displays. This is called during initialization and unit toggle events to ensure the interface reflects internal math.

### 📈 Clinical Reference Suite (Modal Rendering)
Each function below utilizes the Canvas 2D API to render a baseline clinical "Gold Standard" for comparison:
- **`drawReferenceModal()`**: Draws the annotated ECG complex with PR/QRS interval brackets and P/R/T peak labels.
- **`drawPlethReference()`**: Renders the Pleth pulse curve with "Upstroke", "Ejection", and "Diastolic Decay" zone annotations.
- **`drawSpo2Reference()`**: Generates a color-coded saturation bar (Normal/Hypoxemia zones) with a live needle tracking the patient's current oxygenation.
- **`drawHrReference()`**: Renders a frequency-based scale (Brady/Normal/Tachy) with age-adjusted exercise zone brackets.
- **`drawBpReference()`**: Creates a 2D coordinate plot (Systolic vs Diastolic) mapping the current BP point onto AHA/ACC classification rectangles (Normal/Elevated/HTN Stage 1/2).

### ⚙️ UI Utilities & Effects
- **`setActiveView(viewClass, btnId)`**: 
  - *Engine*: Grid Orchestrator
  - *Details*: Toggles CSS classes on the `.dashboard-grid` to trigger smooth layout transitions. It includes a dual-stage `setTimeout` to ensure canvases are resized and cleared *after* the DOM has settled into its new configuration.
- **`formatTemp(c)` / `formatRange(str)`**: 
  - *Logic*: Unit Translation
  - *Math*: $(C \times 9/5) + 32$ for Fahrenheit conversion. Ensures clinical ranges stay numerically accurate when switching display units.
- **Nurse Call Effect**: 
  - *Details*: An inline logic block within the `btn-call` listener that procedurally generates "snowflake" elements with randomized horizontal drift, falling speeds, and font sizes to simulate an emergency alert "frost" over the UI.

## 👨‍🎓 Attribution

## 👨‍🎓 Attribution

Designed and Developed with ❤️ by [Kallol Chakraborty](https://www.linkedin.com/in/kallol-chakraborty-9728a699/).

---
*Disclaimer: This is a simulation tool for educational and design purposes only. It is not intended for actual medical diagnosis or treatment.*
