# Implementation Plan: Teaching-Focused Improvements

## Phase 0 — GitHub Pages Deployment (✓ Done)
- Convert to fully static site (`docs/` directory)
- Replace backend API calls with localStorage fallback
- Single `index.html` entry point, zero server dependencies

## Phase 1 — Arrhythmia Presets & Multi-Lead ECG
**Teaching value:** Recognize lethal vs. benign rhythms; understand ECG intervals.

### 1.1 Arrhythmia Engine
- Add rhythm types to `state`:
  - `NSR` (sinus rhythm — current default)
  - `Atrial Fibrillation` (irregular R-R, no P waves, fibrillatory baseline)
  - `Atrial Flutter` (sawtooth baseline)
  - `Ventricular Tachycardia` (wide QRS, fast rate, no P)
  - `Ventricular Fibrillation` (chaotic, no discernible complexes)
  - `1st Degree AV Block` (PR > 200ms)
  - `2nd Degree AV Block Type I (Wenckebach)` (PR lengthens then dropped QRS)
  - `2nd Degree AV Block Type II` (fixed PR, intermittent dropped QRS)
  - `3rd Degree AV Block` (P and QRS dissociated)
  - `STEMI` (ST elevation > 1mm in contiguous leads)
  - `Hyperkalemia` (tented T waves, wide QRS)
  - `PVC Bigeminy/Trigeminy`
- Dropdown in settings panel to switch rhythm
- `getEcgSignal()` dispatches to rhythm-specific generator

### 1.2 Multi-Lead View
- Add lead selector (I, II, III, aVR, aVL, aVF, V1–V6)
- Mathematical transformation from Lead II to approximate other axes
- Or show 3-lead / 6-lead grid in ECG panel

## Phase 2 — Missing Vital Signs
**Teaching value:** Complete patient assessment; connect vitals to physiology.

### 2.1 Respiratory Rate (RR)
- New panel in dashboard grid
- Range: 8–40 breaths/min
- Resting normal: 12–20
- Waveform: impedance-based or capnogram-style
- Alarm: < 8 or > 24

### 2.2 GCS (Glasgow Coma Scale)
- Eye/Verbal/Motor subscores → total 3–15
- Dropdown or slider controls
- Display in status bar
- Alarm threshold: < 9 (severe), 9–12 (moderate)

### 2.3 Pain Score (0–10)
- Standard numerical rating scale
- Displayed on dashboard
- Trend tracking

### 2.4 Hemodynamics (Advanced)
- Cardiac Output (CO: 4–8 L/min)
- Central Venous Pressure (CVP: 2–8 mmHg)
- Systemic Vascular Resistance (SVR: 800–1200 dyn·s·cm⁻⁵)
- Pulse Pressure Variation (PPV) for fluid responsiveness

## Phase 3 — Pre-Built Clinical Scenarios
**Teaching value:** See how vitals evolve in real diseases; practice recognition.

### 3.1 Scenario Engine
- Dropdown to select scenario
- Each scenario is a JSON script:
  ```json
  {
    "name": "Sepsis",
    "duration": 30,
    "patient": { "age": 65, "pmh": "DM, HTN" },
    "events": [
      { "time": 0, "action": "set_vitals", "hr": 90, "bp": 110/70, ... },
      { "time": 5, "action": "set_vitals", "hr": 110, "bp": 95/60, ... },
      { "time": 10, "action": "narrative", "text": "Patient becomes confused" },
      { "time": 12, "action": "set_vitals", "hr": 130, "bp": 80/50, ... },
      { "time": 15, "action": "alert", "text": "MEWS score: 5 — escalate care" }
    ]
  }
  ```

### 3.2 Recommended Scenarios
| Scenario | Key Teaching Points |
|---|---|
| Sepsis (warm → cold) | SIRS criteria, fluid responsiveness, lactate |
| Acute STEMI | ECG evolution, chest pain, arrhythmia transition |
| Anaphylaxis | BP crash, wheeze, urticaria, epinephrine response |
| Hemorrhagic Shock | Tachycardia, narrowed PP, delayed cap refill |
| COPD Exacerbation | Hypercapnia, O₂ therapy titration, BiPAP |
| Cardiac Arrest (VT/VF → Asystole) | ACLS algorithm, defibrillation timing |
| Hypovolemia / Dehydration | Orthostatic vitals, low CVP, high BUN/Cr |
| Thyrotoxicosis | Tachy, AFib, wide pulse pressure, tremor |

## Phase 4 — Clinical Scoring Systems
**Teaching value:** Bridge between vital signs and clinical action thresholds.

### 4.1 Scores to Implement
- **MEWS** (Modified Early Warning Score): HR, RR, SYS BP, Temp, GCS
- **qSOFA**: RR ≥ 22, GCS < 15, SYS BP ≤ 100
- **NEWS2** (National Early Warning Score 2): HR, RR, SYS BP, SpO₂, Temp, GCS, O₂ therapy
- **SOFA** (Sequential Organ Failure Assessment): PaO₂/FiO₂, GCS, MAP, creatinine, bilirubin, platelets
- **APACHE II** (simplified): Age, temp, MAP, pH, HR, RR, Na, K, Cr, Hct, WBC, GCS

### 4.2 UI
- Score badge near patient status (e.g., "MEWS: 3")
- Color-coded: 0–2 green, 3–4 yellow, ≥5 red
- Clicking shows score breakdown

## Phase 5 — Lab Value Integration
**Teaching value:** Connect vitals to underlying pathophysiology.

### 5.1 Lab Panel (settings modal)
- ABG: pH (7.35–7.45), pCO₂ (35–45), pO₂, HCO₃, BE, lactate
- Electrolytes: Na⁺, K⁺, Ca²⁺, Mg²⁺
- Renal: Creatinine, BUN
- Hematology: Hb, WBC, Platelets
- Cardiac: Troponin, NT-proBNP

### 5.2 Scenario-Linked
- Lab values auto-update during scenarios
- ECG changes reflect electrolyte abnormalities (K⁺ ↔ T waves)

## Phase 6 — Trend Graphs & History
**Teaching value:** Deterioration is visible in trends before thresholds are crossed.

- Rolling 5-min, 15-min, 30-min trend lines for each vital
- Small sparkline in each panel header
- Full trend chart in modal or panel expansion
- Annotated events (e.g., "O₂ started → SpO₂ improved")

## Phase 7 — Tiered Alarm System
**Teaching value:** Prioritization; alarm fatigue; appropriate escalation.

### 7.1 Alarm Levels
| Level | Color | Sound | Example | Action |
|---|---|---|---|---|
| Crisis | Red | Continuous | V-Fib, HR < 40, SpO₂ < 85 | Immediate |
| Warning | Yellow | Intermittent | HR 100–120, BP 130–139 SYS | Urgent |
| Advisory | Blue | Once | HR 95, borderline | Monitor |

### 7.2 Alarm Features
- Silence (pause 2 min), Suspend (30 min off)
- Auto-escalation if unacknowledged (warning → crisis)
- History log of all alarms
- Configurable thresholds per vital

## Phase 8 — Drug Response Simulation
**Teaching value:** Pharmacology; how interventions change vitals.

### 8.1 Drug Library
| Drug | Effect | Onset | Duration |
|---|---|---|---|
| Epinephrine | HR ↑, BP ↑ | 1–2 min | 5–10 min |
| Metoprolol | HR ↓, BP ↓ | 5–15 min | 6–12 h |
| Furosemide | BP ↓, UOP ↑ | 30 min | 2–4 h |
| Norepinephrine | BP ↑ (SVR ↑) | Immediate | 1–2 min |
| Amiodarone | Rhythm control | 10–30 min | Hours |
| Morphine | Pain ↓, RR ↓ | 5–10 min | 2–4 h |

### 8.2 UI
- "Administer Drug" button opens drug selector + dose
- Onset curve (gradual rather than step change)
- Side effect simulation (e.g., opioid → RR ↓)

## Phase 9 — Teaching Tools
**Teaching value:** Interactive learning, not just observation.

### 9.1 Teaching Overlays
- Freeze waveform with calipers for PR/QRS/QT measurement
- Click on wave → label it (self-quiz)
- "Identify this rhythm" button → reveal answer

### 9.2 Quiz Mode
- Present a rhythm/vitals scenario
- Student interprets, then reveals answer
- Score tracking per session

### 9.3 Debrief Mode
- Pause simulation at any point
- Rewind last 60 seconds of vitals
- Annotate timeline (instructor notes)
- Export vitals + annotations as PDF

### 9.4 Print / Export
- Save strip (ECG + pleth) as PNG
- Print vitals summary for portfolio
- Export scenario timeline as CSV

## Phase 10 — Advanced Monitoring
**Teaching value:** ICU-level monitoring for senior trainees.

### 10.1 Capnography (ETCO₂)
- Waveform display (A–E phases)
- Normal: 35–45 mmHg
- Abnormal: esophageal intubation, PE (sudden drop), MH (rise)

### 10.2 Arterial Line Waveform
- Realistic upstroke, dicrotic notch, respiratory variation
- Teach damping, zeroing, waveform interpretation

### 10.3 ICU Board View
- 4–6 patient overview grid
- At-a-glance vitals with color-coded status
- Click → drill into full detail

### 10.4 Ventilator Parameters
- Mode (VCV, PCV, PSV, SIMV)
- TV, RR, PEEP, FiO₂, I:E ratio
- Waveforms (pressure, flow, volume)

---

## Implementation Priority Matrix

| Phase | Teaching Impact | Effort | Priority |
|---|---|---|---|
| 1 — Arrhythmia + Multi-Lead | ★★★★★ | Medium | **P0** |
| 3 — Clinical Scenarios | ★★★★★ | Medium | **P0** |
| 2 — Missing Vitals (RR, GCS) | ★★★★☆ | Low | **P1** |
| 4 — Clinical Scores | ★★★★☆ | Medium | **P1** |
| 7 — Tiered Alarms | ★★★☆☆ | Medium | **P2** |
| 6 — Trend Graphs | ★★★★☆ | High | **P2** |
| 9 — Teaching Tools | ★★★★★ | High | **P2** |
| 5 — Lab Integration | ★★★☆☆ | Medium | **P3** |
| 8 — Drug Simulation | ★★★☆☆ | High | **P3** |
| 10 — Advanced Monitoring | ★★★★☆ | Very High | **P4** |

---

## Architecture Notes for Implementers

### Code Organization (current vs. proposed)
```
public/
├── index.html          (main entry)
├── script.js           (1641 lines — needs splitting)
│   └── Proposed:
│       ├── script.js          (init, UI bindings, main loop)
│       ├── ecg-engine.js      (rhythm generators, multi-lead)
│       ├── vitals-engine.js   (state, drift, scenarios)
│       ├── alarms.js          (tiered alarm system)
│       ├── scores.js          (MEWS, qSOFA, SOFA)
│       └── teaching-tools.js  (quiz, annotations, export)
├── style.css           (keep as-is or split)
├── data.json           (scenario definitions)
└── logo.png
```

### State Management
- Central `state` object (already exists) — extend without mutation in sub-modules
- Consider a simple event bus for cross-module communication (Pub/Sub)
- Avoid framework lock-in — vanilla JS keeps it lightweight and educational
