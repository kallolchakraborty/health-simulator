document.addEventListener('DOMContentLoaded', () => {
    /**
     * Simulation State Engine
     * Central source of truth for all physiological parameters.
     * All values are modified via UI controls or timeline data and then
     * synchronized to the UI and waveform generators.
     */
    const state = {
        hrTarget: 72,        // Target beats per minute
        hrCurrent: 72,       // Currently displayed BPM (with natural drift)
        spo2Target: 98,      // Target oxygen saturation percentage
        spo2Current: 98,     // Currently displayed SpO2 %
        sys: 118,            // Systolic Blood Pressure (mmHg)
        dia: 76,             // Diastolic Blood Pressure (mmHg)
        rrTarget: 16,        // Respiratory rate (breaths/min)
        rrCurrent: 16,
        gcsEye: 4,           // GCS Eye (1-4)
        gcsVerbal: 5,        // GCS Verbal (1-5)
        gcsMotor: 6,         // GCS Motor (1-6)
        gcsTotal: 15,        // GCS Total (3-15)
        painScore: 0,        // Pain Score (0-10)
    onOxygen: false,     // For NEWS2: on supplemental O2?
    etco2Target: 35,     // Target EtCO₂ (mmHg)
    etco2Current: 35,
    etco2Phase: 0,       // Capnography waveform phase (0-1 per respiratory cycle)
    ventSettings: {
        mode: 'CMV',
        fio2: 40,
        peep: 5,
        tv: 500,
        rr: 12
    },
    tempTarget: 36.8,    // Target Body Temperature (stored in Celsius)
        tempCurrent: 36.8,   // Current Temperature (with drift)
        tempSite: 'Oral',    // Measurement site designation
        tempUnit: 'C',       // Active unit ('C' or 'F')
        ecgSpeed: 3,         // Waveform sweep speed (pixels per frame)
        lastFluctuation: 0,  // Timestamp of last natural vital drift
        isManualMode: false, // If true, ignore timeline data
        ecgRhythm: 'NSR',    // Current cardiac rhythm
        ecgLead: 'II',       // Current ECG lead
        beatCounter: 0,      // Beat counter for pattern rhythms
        droppedBeats: 0,     // Consecutive dropped beats for AV block
        scenarioTimer: 0,    // Scenario event timer
        activeScenario: null, // Currently running scenario
        vitalHistory: [],     // Trend data: [{ time, hr, spo2, sys, dia, rr, temp, gcs, pain }]
        alarmHistory: [],     // { time, level, vital, value, threshold, msg }
        alarmLevel: 'none',   // 'none' | 'advisory' | 'warning' | 'crisis'
        alarmSilencedUntil: 0, // timestamp until alarm silence
        alarmSuspendedUntil: 0, // timestamp until alarm suspension
        alarmThresholds: {
            hrHigh: { advisory: 100, warning: 120, crisis: 140 },
            hrLow: { advisory: 60, warning: 50, crisis: 40 },
            spo2Low: { advisory: 92, warning: 88, crisis: 85 },
            rrHigh: { advisory: 24, warning: 30, crisis: 36 },
            rrLow: { advisory: 8, warning: 6, crisis: 4 },
            sysHigh: { advisory: 130, warning: 160, crisis: 200 },
            sysLow: { advisory: 90, warning: 80, crisis: 70 },
            diaHigh: { advisory: 90, warning: 100, crisis: 120 },
            diaLow: { advisory: 60, warning: 50, crisis: 40 },
            tempHigh: { advisory: 38.0, warning: 39.0, crisis: 40.0 },
            tempLow: { advisory: 35.0, warning: 34.5, crisis: 34.0 },
            gcsLow: { advisory: 14, warning: 12, crisis: 9 },
            painHigh: { advisory: 6, warning: 8, crisis: 10 }
        },
        // Drug simulation state
        activeDrugs: [], // { drugKey, dose, timeAdministered }
        // Teaching tools state
        isFrozen: false,
        showCalipers: false,
        showLabels: false,
        quizMode: false,
        caliperPos: [0.3, 0.55], // fractional x positions on canvas
        // Lab values (Phase 5)
        labs: {
            // ABG
            pH: 7.40,
            pCO2: 40,
            pO2: 95,
            HCO3: 24,
            BE: 0,
            lactate: 1.0,
            // Electrolytes
            sodium: 140,
            potassium: 4.2,
            calcium: 2.2,
            magnesium: 0.85,
            // Renal
            creatinine: 0.9,
            BUN: 14,
            // Hematology
            hemoglobin: 14.0,
            WBC: 7.5,
            platelets: 250,
            // Cardiac
            troponin: 0.01,
            NTproBNP: 100
        }
    };

    const siteRanges = {
        'Oral': '36.1-37.9',
        'Rectal': '36.6-38.4',
        'Axillary': '35.6-37.4',
        'Tympanic': '36.1-37.9',
        'Temporal': '36.1-37.5'
    };

    // --- Drug Library (Phase 8) ---
    const DRUG_LIB = {
        epinephrine: {
            name: 'Epinephrine', onset: 90, duration: 600,
            effects: { hr: 25, sys: 30, dia: 15 },
            sideEffects: { arrhythmiaRisk: 0.3 },
            description: 'HR ↑↑, BP ↑↑, 1-2 min onset'
        },
        norepinephrine: {
            name: 'Norepinephrine', onset: 30, duration: 300,
            effects: { hr: 5, sys: 35, dia: 20 },
            sideEffects: {},
            description: 'BP ↑↑ (SVR), minimal HR change'
        },
        metoprolol: {
            name: 'Metoprolol', onset: 300, duration: 21600,
            effects: { hr: -20, sys: -12, dia: -8 },
            sideEffects: { bradycardiaRisk: 0.2 },
            description: 'HR ↓, BP ↓, β-blockade'
        },
        furosemide: {
            name: 'Furosemide', onset: 600, duration: 7200,
            effects: { hr: 5, sys: -15, dia: -10 },
            sideEffects: { hypokalemiaRisk: 0.3 },
            description: 'BP ↓, diuresis, K⁺ loss'
        },
        amiodarone: {
            name: 'Amiodarone', onset: 600, duration: 43200,
            effects: { hr: -10, sys: -5, dia: -5 },
            sideEffects: { bradycardiaRisk: 0.4 },
            description: 'Antiarrhythmic, rhythm control'
        },
        morphine: {
            name: 'Morphine', onset: 120, duration: 7200,
            effects: { hr: -5, sys: -8, dia: -5, pain: -4, rr: -4 },
            sideEffects: { respDepression: 0.5 },
            description: 'Pain ↓, RR ↓, vasodilation'
        }
    };

    function getDrugEffect(drugKey, elapsed) {
        const drug = DRUG_LIB[drugKey];
        if (!drug) return {};
        let multiplier = 0;
        if (elapsed < drug.onset) {
            multiplier = elapsed / drug.onset; // linear ramp up
        } else if (elapsed < drug.duration) {
            multiplier = 1; // plateau
        } else {
            const decay = (elapsed - drug.duration) / drug.duration;
            multiplier = Math.max(0, 1 - decay); // linear decay
        }
        const result = {};
        for (const [key, val] of Object.entries(drug.effects)) {
            result[key] = val * multiplier;
        }
        return result;
    }

    function computeCumulativeDrugEffects() {
        const now = Date.now();
        const totals = { hr: 0, sys: 0, dia: 0, rr: 0, pain: 0, spo2: 0 };
        state.activeDrugs = state.activeDrugs.filter(ad => {
            const elapsed = (now - ad.timeAdministered) / 1000;
            const effect = getDrugEffect(ad.drugKey, elapsed);
            // Remove if fully decayed
            const drug = DRUG_LIB[ad.drugKey];
            if (drug && elapsed > drug.duration * 2) return false;
            // Accumulate
            for (const [k, v] of Object.entries(effect)) {
                if (totals[k] !== undefined) totals[k] += v;
            }
            return true;
        });
        return totals;
    }

    // --- Timeline Simulation Logic ---
    let timelineData = [];
    let startTime = 0;
    let lastBeatTime = 0;

    // --- Teaching Scenarios ---
    const scenarios = {
        SEPSIS: {
            name: 'Sepsis Progression',
            duration: 300,
            events: [
                { time: 0, hr: 95, sys: 110, dia: 65, spo2: 96, temp: 38.2, rhythm: 'NSR', rr: 22, gcs: 15, pain: 2, labs: { lactate: 1.5, WBC: 12.0, creatinine: 0.9, pH: 7.38, pCO2: 35 } },
                { time: 60, hr: 110, sys: 95, dia: 55, spo2: 94, temp: 38.8, rhythm: 'SINUS_ARRHYTHMIA', rr: 28, gcs: 14, pain: 4, narrative: 'Worsening hypotension — fluid resuscitation needed', labs: { lactate: 2.8, WBC: 14.5, creatinine: 1.1, pH: 7.35, pCO2: 32 } },
                { time: 120, hr: 125, sys: 85, dia: 45, spo2: 91, temp: 39.2, rhythm: 'SINUS_ARRHYTHMIA', rr: 32, gcs: 12, pain: 5, narrative: 'Severe sepsis — pressors considered', labs: { lactate: 4.2, WBC: 18.0, creatinine: 1.5, pH: 7.32, pCO2: 30 } },
                { time: 180, hr: 135, sys: 75, dia: 40, spo2: 88, temp: 39.5, rhythm: 'AFIB', rr: 36, gcs: 10, pain: 6, narrative: 'Septic shock — new-onset AFib', labs: { lactate: 6.5, WBC: 22.0, creatinine: 2.1, pH: 7.28, pCO2: 28 } },
                { time: 240, hr: 145, sys: 65, dia: 35, spo2: 84, temp: 39.9, rhythm: 'AFIB', rr: 40, gcs: 8, pain: 7, narrative: 'Critical: organ failure risk, lactate rising', labs: { lactate: 9.0, WBC: 25.0, creatinine: 3.0, pH: 7.22, pCO2: 25 } },
                { time: 300, hr: 150, sys: 60, dia: 30, spo2: 80, temp: 40.1, rhythm: 'VTACH', rr: 42, gcs: 6, pain: 8, narrative: 'IMPENDING ARREST — immediate intervention required', labs: { lactate: 12.0, WBC: 28.0, creatinine: 3.8, pH: 7.15, pCO2: 22 } }
            ]
        },
        MI: {
            name: 'Acute STEMI',
            duration: 360,
            events: [
                { time: 0, hr: 85, sys: 135, dia: 85, spo2: 97, temp: 36.8, rhythm: 'NSR', gcs: 15, pain: 7, narrative: 'Chest pain started 30 min ago', labs: { troponin: 0.02, NTproBNP: 85, potassium: 4.1 } },
                { time: 30, hr: 90, sys: 140, dia: 88, spo2: 96, temp: 36.8, rhythm: 'STEMI', gcs: 15, pain: 8, narrative: 'ST elevation in II, III, aVF — Inferior STEMI', labs: { troponin: 0.5, NTproBNP: 120, potassium: 4.0 } },
                { time: 90, hr: 95, sys: 130, dia: 80, spo2: 96, temp: 36.9, rhythm: 'STEMI', gcs: 15, pain: 8, narrative: 'Pain persistent, ST elevation continues', labs: { troponin: 2.5, NTproBNP: 200, potassium: 3.9 } },
                { time: 150, hr: 100, sys: 120, dia: 75, spo2: 95, temp: 37.0, rhythm: 'PVC_BIGEMINY', gcs: 15, pain: 6, narrative: 'PVCs present — monitor for VTach', labs: { troponin: 8.0, NTproBNP: 450, potassium: 3.8 } },
                { time: 210, hr: 105, sys: 115, dia: 70, spo2: 94, temp: 37.0, rhythm: 'PVC_BIGEMINY', gcs: 14, pain: 7, narrative: 'Reperfusion therapy indicated', labs: { troponin: 15.0, NTproBNP: 800, potassium: 3.7 } },
                { time: 270, hr: 90, sys: 125, dia: 78, spo2: 96, temp: 36.9, rhythm: 'NSR', gcs: 15, pain: 3, narrative: 'Post-intervention, ST resolution', labs: { troponin: 12.0, NTproBNP: 600, potassium: 4.0 } },
                { time: 360, hr: 82, sys: 128, dia: 80, spo2: 97, temp: 36.8, rhythm: 'NSR', gcs: 15, pain: 1, narrative: 'Stabilized — monitoring in CCU', labs: { troponin: 8.0, NTproBNP: 350, potassium: 4.2 } }
            ]
        },
        ANAPHYLAXIS: {
            name: 'Anaphylaxis',
            duration: 300,
            events: [
                { time: 0, hr: 90, sys: 125, dia: 80, spo2: 98, temp: 36.8, rhythm: 'NSR', gcs: 15, pain: 0, narrative: 'Patient received antibiotic' },
                { time: 30, hr: 105, sys: 110, dia: 65, spo2: 95, temp: 36.9, rhythm: 'NSR', gcs: 15, pain: 2, narrative: 'Urticaria, wheezing — anaphylaxis suspected' },
                { time: 60, hr: 120, sys: 95, dia: 55, spo2: 91, temp: 37.0, rhythm: 'NSR', gcs: 14, pain: 3, narrative: 'Hypotension, bronchospasm — give epinephrine' },
                { time: 90, hr: 115, sys: 100, dia: 60, spo2: 93, temp: 37.0, rhythm: 'NSR', gcs: 15, pain: 2, narrative: 'Post-epinephrine: slight improvement' },
                { time: 150, hr: 100, sys: 115, dia: 70, spo2: 96, temp: 36.9, rhythm: 'NSR', gcs: 15, pain: 1, narrative: 'Resolving — steroids and antihistamines given' },
                { time: 300, hr: 88, sys: 120, dia: 78, spo2: 98, temp: 36.8, rhythm: 'NSR', gcs: 15, pain: 0, narrative: 'Recovered — observation period continues' }
            ]
        },
        HEMORRHAGE: {
            name: 'Hemorrhagic Shock',
            duration: 300,
            events: [
                { time: 0, hr: 95, sys: 115, dia: 75, spo2: 98, temp: 36.7, rhythm: 'NSR', gcs: 15, pain: 5, narrative: 'Trauma patient, suspected internal bleeding', labs: { hemoglobin: 13.5, lactate: 1.2, pH: 7.40 } },
                { time: 30, hr: 110, sys: 100, dia: 65, spo2: 97, temp: 36.6, rhythm: 'NSR', gcs: 14, pain: 6, narrative: 'HR rising, BP falling — Class II hemorrhage', labs: { hemoglobin: 11.0, lactate: 2.5, pH: 7.38 } },
                { time: 60, hr: 125, sys: 90, dia: 55, spo2: 96, temp: 36.5, rhythm: 'NSR', gcs: 13, pain: 7, narrative: 'Class III: tachycardia, narrowed pulse pressure', labs: { hemoglobin: 9.0, lactate: 4.5, pH: 7.35 } },
                { time: 90, hr: 135, sys: 80, dia: 48, spo2: 94, temp: 36.4, rhythm: 'SINUS_ARRHYTHMIA', gcs: 11, pain: 8, narrative: 'Class IV: massive transfusion protocol activated', labs: { hemoglobin: 7.0, lactate: 7.0, pH: 7.30 } },
                { time: 120, hr: 140, sys: 75, dia: 42, spo2: 92, temp: 36.3, rhythm: 'VTACH', gcs: 8, pain: 9, narrative: 'EXSANGUINATION — extreme emergency', labs: { hemoglobin: 5.5, lactate: 9.5, pH: 7.25 } },
                { time: 180, hr: 110, sys: 95, dia: 60, spo2: 96, temp: 36.5, rhythm: 'NSR', gcs: 12, pain: 6, narrative: 'Post-transfusion: stabilizing', labs: { hemoglobin: 8.5, lactate: 5.0, pH: 7.35 } },
                { time: 300, hr: 88, sys: 110, dia: 70, spo2: 98, temp: 36.7, rhythm: 'NSR', gcs: 15, pain: 3, narrative: 'Hemodynamically stable', labs: { hemoglobin: 11.0, lactate: 1.5, pH: 7.40 } }
            ]
        },
        COPD: {
            name: 'COPD Exacerbation',
            duration: 300,
            events: [
                { time: 0, hr: 88, sys: 135, dia: 85, spo2: 92, temp: 37.1, rhythm: 'NSR', gcs: 15, pain: 2, narrative: 'SOB, productive cough, wheeze', labs: { pH: 7.38, pCO2: 48, pO2: 68, HCO3: 28 } },
                { time: 60, hr: 95, sys: 140, dia: 88, spo2: 89, temp: 37.3, rhythm: 'SINUS_ARRHYTHMIA', gcs: 15, pain: 3, onO2: true, narrative: 'Hypoxemic — start supplemental O₂', labs: { pH: 7.35, pCO2: 52, pO2: 60, HCO3: 29 } },
                { time: 120, hr: 100, sys: 138, dia: 86, spo2: 91, temp: 37.4, rhythm: 'SINUS_ARRHYTHMIA', gcs: 15, pain: 2, onO2: true, narrative: 'On 2L O₂, mild improvement', labs: { pH: 7.36, pCO2: 50, pO2: 72, HCO3: 29 } },
                { time: 180, hr: 92, sys: 135, dia: 84, spo2: 93, temp: 37.2, rhythm: 'NSR', gcs: 15, pain: 1, onO2: true, narrative: 'Nebulizers given, breathing easier', labs: { pH: 7.37, pCO2: 48, pO2: 78, HCO3: 28 } },
                { time: 240, hr: 88, sys: 132, dia: 82, spo2: 94, temp: 37.1, rhythm: 'NSR', gcs: 15, pain: 1, onO2: true, narrative: 'Steroids + bronchodilators working', labs: { pH: 7.38, pCO2: 45, pO2: 82, HCO3: 27 } },
                { time: 300, hr: 84, sys: 130, dia: 82, spo2: 95, temp: 37.0, rhythm: 'NSR', gcs: 15, pain: 0, narrative: 'Stable for step-down', labs: { pH: 7.39, pCO2: 42, pO2: 88, HCO3: 26 } }
            ]
        },
        CARDIAC_ARREST: {
            name: 'Cardiac Arrest (VT → VF → Asystole)',
            duration: 180,
            events: [
                { time: 0, hr: 100, sys: 130, dia: 80, spo2: 97, temp: 36.8, rhythm: 'NSR', gcs: 15, pain: 0, narrative: 'Stable, monitoring in CCU' },
                { time: 15, hr: 130, sys: 110, dia: 65, spo2: 95, temp: 36.8, rhythm: 'PVC_BIGEMINY', gcs: 15, pain: 1, narrative: 'Frequent PVCs — electrolyte check' },
                { time: 30, hr: 160, sys: 90, dia: 50, spo2: 92, temp: 36.8, rhythm: 'VTACH', gcs: 14, pain: 3, narrative: 'VTACH — pulse present, prepare cardioversion' },
                { time: 45, hr: 180, sys: 70, dia: 40, spo2: 88, temp: 36.8, rhythm: 'VTACH', gcs: 12, pain: 5, narrative: 'VTACH — hypotensive, synchronized cardioversion' },
                { time: 55, hr: 0, sys: 50, dia: 20, spo2: 70, temp: 36.8, rhythm: 'VFIB', gcs: 8, pain: 0, narrative: 'DETERIORATED TO VFIB — DEFIBRILLATE IMMEDIATELY' },
                { time: 70, hr: 0, sys: 40, dia: 15, spo2: 60, temp: 36.8, rhythm: 'VFIB', gcs: 5, pain: 0, narrative: 'CPR in progress, 2nd defibrillation' },
                { time: 85, hr: 0, sys: 30, dia: 10, spo2: 50, temp: 36.8, rhythm: 'VFIB', gcs: 4, pain: 0, narrative: 'Epinephrine given, continue CPR' },
                { time: 100, hr: 0, sys: 25, dia: 8, spo2: 45, temp: 36.8, rhythm: 'VFIB', gcs: 3, pain: 0, narrative: 'No ROSC — consider reversible causes' },
                { time: 115, hr: 0, sys: 20, dia: 5, spo2: 40, temp: 36.8, rhythm: 'VFIB', gcs: 3, pain: 0, narrative: '3rd defibrillation, amiodarone given' },
                { time: 130, hr: 0, sys: 15, dia: 0, spo2: 35, temp: 36.8, rhythm: 'VFIB', gcs: 3, pain: 0, narrative: 'P waves absent, wide — PEA?' },
                { time: 150, hr: 0, sys: 10, dia: 0, spo2: 30, temp: 36.8, rhythm: 'VFIB', gcs: 3, pain: 0, narrative: 'TERMINAL RHYTHM — ongoing resuscitation' },
                { time: 180, hr: 0, sys: 0, dia: 0, spo2: 0, temp: 36.7, rhythm: 'VFIB', gcs: 3, pain: 0, narrative: 'Time of death called' }
            ]
        },
        HYPOVOLEMIA: {
            name: 'Hypovolemia / Dehydration',
            duration: 300,
            events: [
                { time: 0, hr: 85, sys: 115, dia: 75, spo2: 98, temp: 37.0, rhythm: 'NSR', gcs: 15, pain: 1, narrative: 'Mild dehydration, poor skin turgor' },
                { time: 60, hr: 95, sys: 110, dia: 70, spo2: 97, temp: 37.2, rhythm: 'NSR', gcs: 15, pain: 2, narrative: 'Orthostatic hypotension: 20mmHg drop on standing' },
                { time: 120, hr: 105, sys: 105, dia: 65, spo2: 97, temp: 37.4, rhythm: 'NSR', gcs: 15, pain: 3, narrative: 'Fluid challenge started' },
                { time: 180, hr: 95, sys: 112, dia: 72, spo2: 98, temp: 37.3, rhythm: 'NSR', gcs: 15, pain: 2, narrative: 'Improving after 1L crystalloid' },
                { time: 240, hr: 88, sys: 118, dia: 76, spo2: 98, temp: 37.1, rhythm: 'NSR', gcs: 15, pain: 1, narrative: 'Hemodynamics normalized' },
                { time: 300, hr: 82, sys: 120, dia: 78, spo2: 98, temp: 37.0, rhythm: 'NSR', gcs: 15, pain: 0, narrative: 'Resolved — encourage oral intake' }
            ]
        }
    };

    let scenarioStartTime = 0;
    let scenarioNarrativeEl = null;

    // --- Clinical Scoring Functions ---
    function computeMEWS(hr, rr, sysBP, temp, gcs) {
        let score = 0;

        if (hr <= 40 || hr >= 130) score += 3;
        else if (hr <= 50 || hr >= 110) score += 2;
        else if (hr <= 60 || hr >= 100) score += 1;

        if (rr <= 8 || rr >= 30) score += 3;
        else if (rr <= 11 || rr >= 21) score += 1;

        if (sysBP <= 70 || sysBP >= 200) score += 3;
        else if (sysBP <= 80 || sysBP >= 180) score += 2;
        else if (sysBP <= 100) score += 1;

        if (temp < 35.0 || temp >= 38.5) score += 2;
        else if (temp >= 38.0) score += 1;

        if (gcs < 9) score += 3;
        else if (gcs <= 12) score += 2;
        else if (gcs <= 14) score += 1;

        return Math.min(score, 15);
    }

    function computeQSOFA(rr, gcs, sysBP) {
        let score = 0;
        if (rr >= 22) score++;
        if (gcs < 15) score++;
        if (sysBP <= 100) score++;
        return score;
    }

    function computeNEWS2(hr, rr, sysBP, spo2, temp, gcs, onO2) {
        let score = 0;

        if (hr <= 40 || hr >= 131) score += 3;
        else if (hr <= 50 || hr >= 111) score += 2;
        else if (hr <= 60 || hr >= 91) score += 1;

        if (rr <= 8) score += 3;
        else if (rr >= 25) score += 3;
        else if (rr >= 21) score += 2;
        else if (rr >= 12) score += 1; else if (rr >= 9) score += 0;

        if (spo2 <= 83) score += 3;
        else if (spo2 <= 85) score += 2;
        else if (spo2 <= 87) score += 1; else if (spo2 >= 96) score += 0;
        else if (spo2 <= 91) score += 3;
        else if (spo2 <= 93) score += 2;
        else if (spo2 <= 95) score += 1;

        if (sysBP <= 70 || sysBP >= 220) score += 3;
        else if (sysBP <= 80 || sysBP >= 200) score += 2;
        else if (sysBP <= 90) score += 1;
        else if (sysBP >= 111) score += 0; else if (sysBP >= 101) score += 1;

        if (temp < 35.0) score += 3;
        else if (temp <= 35.9) score += 1;
        else if (temp >= 39.0) score += 2;
        else if (temp >= 38.0) score += 1;

        if (gcs < 9) score += 3;
        else if (gcs <= 12) score += 2;
        else if (gcs <= 14) score += 1;

        if (onO2) score += 2;

        return Math.min(score, 20);
    }

    function updateScoreDisplay() {
        const hr = state.hrCurrent || state.hrTarget;
        const rr = state.rrCurrent || state.rrTarget;
        const sysBP = parseInt(document.getElementById('bp-sys')?.innerText) || state.sys;
        const spo2 = state.spo2Current || state.spo2Target;
        const temp = state.tempCurrent || state.tempTarget;
        const gcs = state.gcsTotal;
        const onO2 = state.onOxygen;

        const mews = computeMEWS(hr, rr, sysBP, temp, gcs);
        const qsofa = computeQSOFA(rr, gcs, sysBP);
        const news2 = computeNEWS2(hr, rr, sysBP, spo2, temp, gcs, onO2);

        const mewsEl = document.getElementById('mews-score');
        const qsofaEl = document.getElementById('qsofa-score');
        const news2El = document.getElementById('news2-score');

        const colorForScore = (val, low, mid) => {
            if (val >= mid) return '#ef4444';
            if (val >= low) return '#fbbf24';
            return '#22c55e';
        };

        if (mewsEl) {
            mewsEl.textContent = mews;
            mewsEl.style.color = colorForScore(mews, 3, 5);
        }
        if (qsofaEl) {
            qsofaEl.textContent = qsofa;
            qsofaEl.style.color = colorForScore(qsofa, 1, 2);
        }
        if (news2El) {
            news2El.textContent = news2;
            news2El.style.color = colorForScore(news2, 5, 7);
        }

        // Update GCS display
        const gcsEl = document.getElementById('gcs-display');
        if (gcsEl) {
            gcsEl.textContent = state.gcsTotal + ' (E' + state.gcsEye + ' V' + state.gcsVerbal + ' M' + state.gcsMotor + ')';
        }
        // Sync sub-score displays
        const gcsEyeDisp = document.getElementById('gcs-eye-display');
        const gcsVerbalDisp = document.getElementById('gcs-verbal-display');
        const gcsMotorDisp = document.getElementById('gcs-motor-display');
        const gcsTotalDisp = document.getElementById('gcs-total-display');
        if (gcsEyeDisp) gcsEyeDisp.innerText = state.gcsEye;
        if (gcsVerbalDisp) gcsVerbalDisp.innerText = state.gcsVerbal;
        if (gcsMotorDisp) gcsMotorDisp.innerText = state.gcsMotor;
        if (gcsTotalDisp) gcsTotalDisp.innerText = state.gcsTotal;

        const painEl = document.getElementById('pain-display-value');
        if (painEl) painEl.textContent = state.painScore;
        const painScoreDisp = document.getElementById('pain-score-display');
        if (painScoreDisp) painScoreDisp.innerText = state.painScore;
    }

    // --- Trend Graphs (Phase 6) ---
    function drawTrends() {
        const data = state.vitalHistory;
        if (data.length < 2) return;

        const trendMap = {
            'trend-hr': { key: 'hr', color: '#22c55e', min: 40, max: 160 },
            'trend-bp': { key: 'sys', color: '#ef4444', min: 50, max: 220 },
            'trend-spo2': { key: 'spo2', color: '#00d2ff', min: 70, max: 100 },
            'trend-temp': { key: 'temp', color: '#f59e0b', min: 34, max: 42 }
        };

        for (const [id, cfg] of Object.entries(trendMap)) {
            const canvas = document.getElementById(id);
            if (!canvas) continue;
            const ctx = canvas.getContext('2d');
            const W = canvas.width = canvas.parentElement.clientWidth - 16;
            const H = 20;
            ctx.clearRect(0, 0, W, H);

            const points = data.map(d => d[cfg.key]).filter(v => v !== undefined);
            if (points.length < 2) continue;

            // Take last ~60 points (2 min window) but show all if less
            const window = points.slice(-80);

            const range = cfg.max - cfg.min;
            const stepX = W / Math.max(window.length - 1, 1);

            ctx.beginPath();
            ctx.strokeStyle = cfg.color;
            ctx.lineWidth = 1.5;
            for (let i = 0; i < window.length; i++) {
                const x = i * stepX;
                const y = H - ((window[i] - cfg.min) / range) * H;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();

            // Show current value at right end
            ctx.fillStyle = cfg.color;
            ctx.font = '8px monospace';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';
            const lastVal = window[window.length - 1];
            ctx.fillText(lastVal, W - 2, H - 1);
        }
    }

    // Trend Modal
    function openTrendModal(vital) {
        const modal = document.getElementById('trend-modal');
        if (!modal) return;
        modal.classList.remove('hidden');
        const canvas = document.getElementById('trend-full-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const W = canvas.width = canvas.parentElement.clientWidth - 32;
        const H = canvas.height = 300;

        const data = state.vitalHistory;
        const configs = {
            hr: { key: 'hr', label: 'Heart Rate (bpm)', color: '#22c55e', min: 40, max: 160 },
            spo2: { key: 'spo2', label: 'SpO₂ (%)', color: '#00d2ff', min: 70, max: 100 },
            bp: { key: 'sys', label: 'SYS BP (mmHg)', color: '#ef4444', min: 50, max: 220 },
            temp: { key: 'temp', label: 'Temp (°C)', color: '#f59e0b', min: 34, max: 42 }
        };

        const cfg = configs[vital] || configs.hr;
        ctx.clearRect(0, 0, W, H);

        // Background
        ctx.fillStyle = '#0a1620';
        ctx.fillRect(0, 0, W, H);

        // Title
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(cfg.label, 10, 20);

        const points = data.map(d => d[cfg.key]).filter(v => v !== undefined);
        if (points.length < 2) {
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Insufficient data', W / 2, H / 2);
            return;
        }

        const margin = { top: 30, bottom: 20, left: 40, right: 20 };
        const pw = W - margin.left - margin.right;
        const ph = H - margin.top - margin.bottom;
        const range = cfg.max - cfg.min;

        // Grid lines
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 0.5;
        for (let i = 0; i <= 4; i++) {
            const y = margin.top + (ph / 4) * i;
            ctx.beginPath(); ctx.moveTo(margin.left, y); ctx.lineTo(W - margin.right, y); ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.font = '9px monospace';
            ctx.textAlign = 'right';
            ctx.fillText(Math.round(cfg.max - (range / 4) * i), margin.left - 4, y + 3);
        }

        // Data line
        const stepX = pw / Math.max(points.length - 1, 1);
        ctx.beginPath();
        ctx.strokeStyle = cfg.color;
        ctx.lineWidth = 2;
        for (let i = 0; i < points.length; i++) {
            const x = margin.left + i * stepX;
            const y = margin.top + ph - ((points[i] - cfg.min) / range) * ph;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Time axis (show timestamps every ~10 points)
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        const interval = Math.max(1, Math.floor(points.length / 6));
        for (let i = 0; i < points.length; i += interval) {
            if (data[i]) {
                const t = new Date(data[i].time);
                const label = t.getHours().toString().padStart(2,'0') + ':' + t.getMinutes().toString().padStart(2,'0') + ':' + t.getSeconds().toString().padStart(2,'0');
                const x = margin.left + i * stepX;
                ctx.fillText(label, x, H - 4);
            }
        }
    }

    // --- Teaching Tools (Phase 9) ---
    function drawTeachingOverlays() {
        if (!state.showCalipers && !state.isFrozen) return;
        const W = ecgCanvas.width;
        const H = ecgCanvas.height;

        ecgCtx.save();

        // Semi-transparent overlay when frozen
        if (state.isFrozen) {
            ecgCtx.fillStyle = 'rgba(0,0,0,0.3)';
            ecgCtx.fillRect(0, 0, W, 20);
            ecgCtx.fillStyle = '#fbbf24';
            ecgCtx.font = 'bold 10px sans-serif';
            ecgCtx.textAlign = 'left';
            ecgCtx.fillText('❄ FROZEN', 6, 14);
        }

        // Calipers: two vertical lines with readout
        if (state.showCalipers) {
            const cpx1 = state.caliperPos[0] * W;
            const cpx2 = state.caliperPos[1] * W;

            // Lines
            ecgCtx.strokeStyle = '#fbbf24';
            ecgCtx.lineWidth = 1.5;
            ecgCtx.setLineDash([4, 3]);
            ecgCtx.beginPath(); ecgCtx.moveTo(cpx1, 0); ecgCtx.lineTo(cpx1, H); ecgCtx.stroke();
            ecgCtx.beginPath(); ecgCtx.moveTo(cpx2, 0); ecgCtx.lineTo(cpx2, H); ecgCtx.stroke();
            ecgCtx.setLineDash([]);

            // Handles (draggable circles)
            ecgCtx.fillStyle = '#fbbf24';
            ecgCtx.beginPath(); ecgCtx.arc(cpx1, H / 2, 5, 0, Math.PI * 2); ecgCtx.fill();
            ecgCtx.beginPath(); ecgCtx.arc(cpx2, H / 2, 5, 0, Math.PI * 2); ecgCtx.fill();

            // Distance readout
            const pixelDist = Math.abs(cpx2 - cpx1);
            const msDist = Math.round(pixelDist * 10); // ~10ms per pixel at default speed
            const readoutEl = document.getElementById('caliper-readout');
            if (readoutEl) {
                readoutEl.textContent = `◀── ${msDist} ms ──▶ (${pixelDist.toFixed(0)} px)`;
                readoutEl.style.display = 'block';
            }
        }

        ecgCtx.restore();
    }

    // Caliper drag state
    let caliperDragIdx = -1;
    let isDraggingCaliper = false;

    function setupCaliperDrag() {
        ecgCanvas.addEventListener('mousedown', (e) => {
            if (!state.showCalipers) return;
            const rect = ecgCanvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const W = ecgCanvas.width;
            const fracX = mx / W;
            for (let i = 0; i < state.caliperPos.length; i++) {
                if (Math.abs(fracX - state.caliperPos[i]) < 0.03) {
                    caliperDragIdx = i;
                    isDraggingCaliper = true;
                    break;
                }
            }
        });
        ecgCanvas.addEventListener('mousemove', (e) => {
            if (!isDraggingCaliper || caliperDragIdx < 0) return;
            const rect = ecgCanvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            state.caliperPos[caliperDragIdx] = Math.max(0.02, Math.min(0.98, mx / ecgCanvas.width));
        });
        window.addEventListener('mouseup', () => {
            isDraggingCaliper = false;
            caliperDragIdx = -1;
        });
    }

    function exportCanvasAsPNG() {
        // Create a combined canvas with ECG + vitals summary
        const exportCanvas = document.createElement('canvas');
        const W = ecgCanvas.width;
        const H = ecgCanvas.height + 80;
        exportCanvas.width = W;
        exportCanvas.height = H;
        const ctx = exportCanvas.getContext('2d');

        // Background
        ctx.fillStyle = '#0a1620';
        ctx.fillRect(0, 0, W, H);

        // Draw ECG strip
        ctx.drawImage(ecgCanvas, 0, 0);

        // Vitals footer
        ctx.fillStyle = '#22c55e';
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'left';
        const hr = state.hrCurrent || state.hrTarget;
        const spo2 = state.spo2Current || state.spo2Target;
        ctx.fillText(`HR: ${hr} bpm  SpO₂: ${spo2}%  Rhythm: ${state.ecgRhythm}  Lead: ${state.ecgLead}`, 10, ecgCanvas.height + 20);

        // Timestamp
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(new Date().toLocaleString(), W - 10, ecgCanvas.height + 20);

        // Strip label
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Health Simulator — Teaching Strip', W / 2, ecgCanvas.height + 50);

        // Download
        const link = document.createElement('a');
        link.download = `ecg-strip-${Date.now()}.png`;
        link.href = exportCanvas.toDataURL('image/png');
        link.click();
    }

    // --- Graph Draw State ---
    let ecgX = 0;
    let lastEcgY = 0;
    let lastPlethY = 0;
    let lastCo2Y = 0;
    let lastAlineY = 0;
    let noiseOffset = 0;

    // DOM Elements
    const hrValue = document.getElementById('hr-value');
    const spo2Value = document.getElementById('spo2-value');
    const sysValue = document.getElementById('bp-sys');
    const diaValue = document.getElementById('bp-dia');

    // Control Panel Elements
    const settingsBtn = document.getElementById('toggle-controls');
    const settingsModal = document.getElementById('settings-modal');
    const controlsPanel = document.getElementById('controls-panel');
    const closeControlsBtn = document.getElementById('close-controls');
    const closeControlsTop = document.getElementById('close-controls-top');

    const hrControl = document.getElementById('hr-control');
    const sysControl = document.getElementById('sys-control');
    const diaControl = document.getElementById('dia-control');
    const spo2Control = document.getElementById('spo2-control');

    const hrDisplay = document.getElementById('hr-display');
    const sysDisplay = document.getElementById('sys-display');
    const diaDisplay = document.getElementById('dia-display');
    const spo2Display = document.getElementById('spo2-display');
    const tempDisplay = document.getElementById('temp-display');

    const rrControl = document.getElementById('rr-control');
    const rrDisplay = document.getElementById('rr-display');

    const tempControl = document.getElementById('temp-control');
    const tempSiteControl = document.getElementById('temp-site-control');
    const tempUnitControl = document.getElementById('temp-unit-control');

    const tempValue = document.getElementById('temp-value');
    const tempUnitLabel = document.getElementById('temp-unit');
    const tempSiteValue = document.querySelector('.temp-meta .site');
    const tempRangeValue = document.getElementById('temp-range');

    /**
     * Data Initialization
     * Fetches patient metadata and longitudinal simulation data (timeline).
     */
    async function loadData() {
        try {
            const response = await fetch('data.json');
            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

            const data = await response.json();
            if (!data || !data.patient) throw new Error('Malformed data structure');

            // 1. Update Patient Information Header
            const nameEl = document.querySelector('.name');
            const initialsEl = document.getElementById('patient-initials');
            if (nameEl) {
                const fName = (data.patient.firstName || 'Unknown').toUpperCase();
                const lName = (data.patient.lastName || 'Patient').toUpperCase();
                const gender = data.patient.gender || 'N/A';
                nameEl.textContent = `${lName}, ${fName} (${gender})`;
            }

            if (initialsEl) {
                const fInitial = (data.patient.firstName || 'P').charAt(0).toUpperCase();
                const lInitial = (data.patient.lastName || 'X').charAt(0).toUpperCase();
                initialsEl.textContent = `${fInitial}${lInitial}`;
            }

            const idValEl = document.querySelector('.id .val');
            if (idValEl) {
                idValEl.textContent = data.patient.id || '---';
            }

            const roomEl = document.querySelector('.room');
            if (roomEl) {
                const roomNum = data.patient.room || '000';
                roomEl.textContent = roomNum.toString().startsWith('Room') ? roomNum : `Room ${roomNum}`;
            }

            // 2. Load Simulation Timeline
            if (data.simulation && data.simulation.timeline) {
                timelineData = data.simulation.timeline;
            }

            // 3. Set Initial State
            const baseVitals = (data.simulation && data.simulation.baseVitals) ? data.simulation.baseVitals : {};
            const initial = (timelineData && timelineData.length > 0) ? timelineData[0] : baseVitals;

            if (initial && (initial.hr || initial.spo2)) {
                state.hrTarget = initial.hr || state.hrTarget;
                state.spo2Target = initial.spo2 || state.spo2Target;
                state.sys = initial.sys || state.sys;
                state.dia = initial.dia || state.dia;

                // Sync UI immediately
                updateUIFromState();
            }

        } catch (error) {
            console.error('[Fail-Safe] Simulation data load failed:', error.message);
            // Dashboard stays at defaults defined in the 'state' object
            updateUIFromState();
        }
    }

    function formatTemp(celsius) {
        if (state.tempUnit === 'F') {
            return (celsius * 9 / 5 + 32).toFixed(1);
        }
        return celsius.toFixed(1);
    }

    function formatRange(rangeStr) {
        if (state.tempUnit === 'C') return rangeStr;
        const [low, high] = rangeStr.split('-').map(parseFloat);
        const lowF = (low * 9 / 5 + 32).toFixed(1);
        const highF = (high * 9 / 5 + 32).toFixed(1);
        return `${lowF}-${highF}`;
    }

    function updateUIFromState() {
        if (!hrControl) return;
        hrControl.value = state.hrTarget;
        spo2Control.value = state.spo2Target;
        sysControl.value = state.sys;
        diaControl.value = state.dia;
        if (tempControl) {
            if (state.tempUnit === 'F') {
                tempControl.min = 93.2; // 34C
                tempControl.max = 107.6; // 42C
                tempControl.value = (state.tempTarget * 9 / 5 + 32).toFixed(1);
            } else {
                tempControl.min = 34;
                tempControl.max = 42;
                tempControl.value = state.tempTarget;
            }
        }

        hrDisplay.innerText = state.hrTarget;
        sysDisplay.innerText = state.sys;
        diaDisplay.innerText = state.dia;
        spo2Display.innerText = state.spo2Target;
        if (tempDisplay) tempDisplay.innerText = formatTemp(state.tempTarget);
        if (rrControl) rrControl.value = state.rrTarget;
        if (rrDisplay) rrDisplay.innerText = state.rrTarget;

        state.hrCurrent = state.hrTarget;
        state.spo2Current = state.spo2Target;
        state.rrCurrent = state.rrTarget;
        state.tempCurrent = state.tempTarget;

        hrValue.innerText = state.hrTarget;
        spo2Value.innerText = state.spo2Target;
        sysValue.innerText = state.sys;
        diaValue.innerText = state.dia;
        const rrValueEl = document.getElementById('rr-value');
        if (rrValueEl) rrValueEl.innerText = state.rrTarget;

        if (tempValue) tempValue.innerText = formatTemp(state.tempTarget);
        if (tempUnitLabel) tempUnitLabel.innerText = `°${state.tempUnit}`;
        if (tempRangeValue) tempRangeValue.innerText = formatRange(siteRanges[state.tempSite]);

        // GCS & Pain sync
        const gcsEyeCtrl = document.getElementById('gcs-eye-control');
        const gcsVerbalCtrl = document.getElementById('gcs-verbal-control');
        const gcsMotorCtrl = document.getElementById('gcs-motor-control');
        const painCtrl = document.getElementById('pain-control');
        const oxygenCb = document.getElementById('oxygen-checkbox');
        if (gcsEyeCtrl) gcsEyeCtrl.value = state.gcsEye;
        if (gcsVerbalCtrl) gcsVerbalCtrl.value = state.gcsVerbal;
        if (gcsMotorCtrl) gcsMotorCtrl.value = state.gcsMotor;
        if (painCtrl) painCtrl.value = state.painScore;
        if (oxygenCb) oxygenCb.checked = state.onOxygen;
        updateScoreDisplay();
    }

    loadData();

    // --- Canvas Setup ---
    const ecgCanvas = document.getElementById('ecgCanvas');
    const plethCanvas = document.getElementById('plethCanvas');
    const co2Canvas = document.getElementById('co2Canvas');
    const alineCanvas = document.getElementById('alineCanvas');
    const ecgCtx = ecgCanvas.getContext('2d');
    const plethCtx = plethCanvas.getContext('2d');
    const co2Ctx = co2Canvas?.getContext('2d');
    const alineCtx = alineCanvas?.getContext('2d');

    // ICU Board canvases
    const icuEcgCanvas = document.getElementById('icu-ecg-canvas');
    const icuPlethCanvas = document.getElementById('icu-pleth-canvas');
    const icuCo2Canvas = document.getElementById('icu-co2-canvas');
    const icuAlineCanvas = document.getElementById('icu-aline-canvas');
    const icuEcgCtx = icuEcgCanvas?.getContext('2d');
    const icuPlethCtx = icuPlethCanvas?.getContext('2d');
    const icuCo2Ctx = icuCo2Canvas?.getContext('2d');
    const icuAlineCtx = icuAlineCanvas?.getContext('2d');
    let lastIcuEcgY = 0, lastIcuPlethY = 0, lastIcuCo2Y = 0, lastIcuAlineY = 0;

    function resizeCanvases() {
        const ecgParent = ecgCanvas.parentElement;
        const plethParent = plethCanvas.parentElement;
        const co2Parent = co2Canvas?.parentElement;
        const alineParent = alineCanvas?.parentElement;

        if (ecgParent && ecgParent.clientWidth > 0 && ecgParent.clientHeight > 0) {
            ecgCanvas.width = ecgParent.clientWidth;
            ecgCanvas.height = ecgParent.clientHeight;
            lastEcgY = ecgCanvas.height / 2; // Initialize vertical start to center
        }
        if (plethParent && plethParent.clientWidth > 0 && plethParent.clientHeight > 0) {
            plethCanvas.width = plethParent.clientWidth;
            plethCanvas.height = plethParent.clientHeight;
            lastPlethY = plethCanvas.height * 0.85; // Initialize vertical start to base
        }
        if (co2Parent && co2Parent.clientWidth > 0 && co2Parent.clientHeight > 0) {
            co2Canvas.width = co2Parent.clientWidth;
            co2Canvas.height = co2Parent.clientHeight;
        }
        if (alineParent && alineParent.clientWidth > 0 && alineParent.clientHeight > 0) {
            alineCanvas.width = alineParent.clientWidth;
            alineCanvas.height = alineParent.clientHeight;
        }
        // ICU canvases (set size when modal is open)
        if (icuEcgCanvas) { icuEcgCanvas.width = icuEcgCanvas.clientWidth || 400; icuEcgCanvas.height = icuEcgCanvas.clientHeight || 80; }
        if (icuPlethCanvas) { icuPlethCanvas.width = icuPlethCanvas.clientWidth || 400; icuPlethCanvas.height = icuPlethCanvas.clientHeight || 60; }
        if (icuCo2Canvas) { icuCo2Canvas.width = icuCo2Canvas.clientWidth || 400; icuCo2Canvas.height = icuCo2Canvas.clientHeight || 60; }
        if (icuAlineCanvas) { icuAlineCanvas.width = icuAlineCanvas.clientWidth || 400; icuAlineCanvas.height = icuAlineCanvas.clientHeight || 60; }
    }

    window.addEventListener('resize', resizeCanvases);
    resizeCanvases();

    /**
     * Normal Sinus Rhythm Generator (Lead II)
     * Sum-of-Gaussians model for P, QRS, T, U waves.
     */
    function getNsrSignal(t_ms) {
        const amp = state.ecgAmp || 1.0;
        const p_amp = 0.15, p_width = 40, p_center = 80;
        const pr_val = state.ecgPR || 160;
        const qrs_val = state.ecgQRS || 80;
        const q_center = pr_val + 20;
        const r_center = q_center + (qrs_val * 0.4);
        const s_center = q_center + (qrs_val * 0.8);
        const q_amp = -0.15 * amp, r_amp = 1.0 * amp, s_amp = -0.25 * amp;
        const t_center = q_center + 280;
        const t_amp = (0.3 + (state.ecgST || 0)) * amp;
        const u_center = t_center + 150, u_amp = 0.05 * amp;

        let signal = 0;
        signal += p_amp * Math.exp(-Math.pow(t_ms - p_center, 2) / (2 * Math.pow(p_width / 3, 2)));
        signal += q_amp * Math.exp(-Math.pow(t_ms - q_center, 2) / (2 * Math.pow(qrs_val / 10, 2)));
        signal += r_amp * Math.exp(-Math.pow(t_ms - r_center, 2) / (2 * Math.pow(qrs_val / 10, 2)));
        signal += s_amp * Math.exp(-Math.pow(t_ms - s_center, 2) / (2 * Math.pow(qrs_val / 10, 2)));
        if (t_ms > s_center && t_ms < t_center) {
            const st_dur = t_center - s_center;
            signal += (state.ecgST || 0) * amp * Math.exp(-Math.pow(t_ms - (s_center + t_center) / 2, 2) / (2 * Math.pow(st_dur / 2, 2)));
        }
        signal += t_amp * Math.exp(-Math.pow(t_ms - t_center, 2) / (2 * Math.pow(60, 2)));
        signal += u_amp * Math.exp(-Math.pow(t_ms - u_center, 2) / (2 * Math.pow(30, 2)));
        return signal * -80;
    }

    /**
     * Atrial Fibrillation — no P waves, irregularly irregular, fibrillatory baseline.
     */
    function getAfibSignal(t_ms) {
        const amp = state.ecgAmp || 1.0;
        const qrs_val = state.ecgQRS || 80;
        const r_center = 40 + (qrs_val * 0.4);
        const s_center = 40 + (qrs_val * 0.8);
        const r_amp = 1.0 * amp, s_amp = -0.2 * amp;
        const t_center = s_center + 260;
        const t_amp = (0.25 + (state.ecgST || 0)) * amp;

        let signal = 0;
        signal += r_amp * Math.exp(-Math.pow(t_ms - r_center, 2) / (2 * Math.pow(qrs_val / 10, 2)));
        signal += s_amp * Math.exp(-Math.pow(t_ms - s_center, 2) / (2 * Math.pow(qrs_val / 10, 2)));
        signal += t_amp * Math.exp(-Math.pow(t_ms - t_center, 2) / (2 * Math.pow(60, 2)));

        // Fibrillatory baseline oscillation (no P waves)
        signal += 0.08 * amp * Math.sin(t_ms * 0.08);
        signal += 0.04 * amp * Math.sin(t_ms * 0.15 + 1);
        signal += 0.03 * amp * Math.sin(t_ms * 0.23 + 2);
        return signal * -80;
    }

    /**
     * Atrial Flutter — sawtooth flutter waves.
     */
    function getAflutterSignal(t_ms) {
        const amp = state.ecgAmp || 1.0;
        const qrs_val = state.ecgQRS || 80;
        const r_center = 40 + (qrs_val * 0.4);
        const s_center = 40 + (qrs_val * 0.8);
        const r_amp = 1.0 * amp, s_amp = -0.2 * amp;
        const t_center = s_center + 260;
        const t_amp = 0.2 * amp;

        let signal = 0;
        signal += r_amp * Math.exp(-Math.pow(t_ms - r_center, 2) / (2 * Math.pow(qrs_val / 10, 2)));
        signal += s_amp * Math.exp(-Math.pow(t_ms - s_center, 2) / (2 * Math.pow(qrs_val / 10, 2)));
        if (t_ms < 40 || t_ms > 350) {
            // Sawtooth flutter waves (approx 300/min)
            const flutterPhase = (t_ms * 0.03) % 1;
            signal += 0.12 * amp * (flutterPhase < 0.5 ? -1 + flutterPhase * 4 : 3 - flutterPhase * 4);
        }
        signal += t_amp * Math.exp(-Math.pow(t_ms - t_center, 2) / (2 * Math.pow(60, 2)));
        return signal * -80;
    }

    /**
     * Ventricular Tachycardia — wide QRS, fast, no P waves.
     */
    function getVtachSignal(t_ms) {
        const amp = state.ecgAmp || 1.0;
        const qrs_val = (state.ecgQRS || 80) * 1.8; // Wide QRS
        const r_center = 20 + (qrs_val * 0.4);
        const s_center = 20 + (qrs_val * 0.6);
        const r_amp = 1.2 * amp, s_amp = -0.6 * amp;
        const t_center = s_center + 280;
        const t_amp = 0.35 * amp;

        let signal = 0;
        signal += r_amp * Math.exp(-Math.pow(t_ms - r_center, 2) / (2 * Math.pow(qrs_val / 8, 2)));
        signal += s_amp * Math.exp(-Math.pow(t_ms - s_center, 2) / (2 * Math.pow(qrs_val / 8, 2)));
        signal += t_amp * Math.exp(-Math.pow(t_ms - t_center, 2) / (2 * Math.pow(70, 2)));
        return signal * -80;
    }

    /**
     * Ventricular Fibrillation — chaotic, no discernible QRS.
     */
    function getVfibSignal(t_ms) {
        const amp = (state.ecgAmp || 1.0) * 0.6;
        let signal = 0;
        signal += 0.8 * Math.sin(t_ms * 0.12 + Math.sin(t_ms * 0.03) * 2);
        signal += 0.4 * Math.sin(t_ms * 0.25 + 1);
        signal += 0.3 * Math.sin(t_ms * 0.07 + 3);
        signal += 0.2 * Math.sin(t_ms * 0.4 + Math.sin(t_ms * 0.09) * 3);
        signal *= amp;
        return signal * -80;
    }

    /**
     * AV Block signal — modified by beat counter for Wenckebach pattern.
     */
    function getAvBlockSignal(t_ms) {
        const amp = state.ecgAmp || 1.0;
        const qrs_val = state.ecgQRS || 80;

        if (state.ecgRhythm === 'AVB1') {
            // 1st Degree: PR > 200ms, otherwise normal
            return getNsrSignal(t_ms + 60); // Shift by ~60ms to simulate prolonged PR
        }

        if (state.ecgRhythm === 'AVB3') {
            // 3rd Degree: P and QRS independent rates
            // Generate P wave at ~60/min independent of QRS
            const pPhase = (t_ms * 0.1) % 1;
            let sig = 0;
            if (pPhase < 0.08) {
                sig += 0.15 * Math.sin((pPhase / 0.08) * Math.PI);
            }
            // QRS at ~40/min (ventricular escape)
            const qrsPhase = (t_ms * 0.04) % 1;
            if (qrsPhase < 0.12) {
                const qrs_t = (qrsPhase / 0.12) * qrs_val;
                sig += 1.0 * amp * Math.exp(-Math.pow(qrs_t - 30, 2) / (2 * Math.pow(qrs_val / 10, 2)));
                sig += -0.25 * amp * Math.exp(-Math.pow(qrs_t - 60, 2) / (2 * Math.pow(qrs_val / 10, 2)));
            }
            sig += 0.3 * amp * Math.sin(t_ms * 0.006 + 0.5); // slow T wave
            return sig * -80;
        }

        // AVB2 (Wenckebach) — handled via beat duration in animation loop
        return getNsrSignal(t_ms);
    }

    /**
     * STEMI — NSR with persistent ST elevation.
     */
    function getStemiSignal(t_ms) {
        const oldST = state.ecgST;
        state.ecgST = 0.3;
        const sig = getNsrSignal(t_ms);
        state.ecgST = oldST;
        return sig;
    }

    /**
     * Hyperkalemia — tall tented T waves, wide QRS, flattened P.
     */
    function getHyperkalemiaSignal(t_ms) {
        const amp = state.ecgAmp || 1.0;
        const qrs_val = (state.ecgQRS || 80) * 1.3;
        const p_amp = 0.06, p_center = 80;
        const pr_val = (state.ecgPR || 160) * 1.2;
        const q_center = pr_val + 20;
        const r_center = q_center + (qrs_val * 0.4);
        const s_center = q_center + (qrs_val * 0.8);
        const q_amp = -0.15 * amp, r_amp = 0.9 * amp, s_amp = -0.25 * amp;
        const t_center = r_center + 200;
        const t_amp = 0.7 * amp; // Tall tented T

        let signal = 0;
        signal += p_amp * Math.exp(-Math.pow(t_ms - p_center, 2) / (2 * Math.pow(30, 2)));
        signal += q_amp * Math.exp(-Math.pow(t_ms - q_center, 2) / (2 * Math.pow(qrs_val / 12, 2)));
        signal += r_amp * Math.exp(-Math.pow(t_ms - r_center, 2) / (2 * Math.pow(qrs_val / 12, 2)));
        signal += s_amp * Math.exp(-Math.pow(t_ms - s_center, 2) / (2 * Math.pow(qrs_val / 12, 2)));
        signal += t_amp * Math.exp(-Math.pow(t_ms - t_center, 2) / (2 * Math.pow(40, 2)));
        return signal * -80;
    }

    /**
     * PVC — wide, bizarre QRS complex.
     */
    function getPvcSignal(t_ms) {
        const amp = (state.ecgAmp || 1.0) * 1.3;
        const qrs_val = (state.ecgQRS || 80) * 1.6;
        const r_center = 10 + (qrs_val * 0.3);
        const s_center = 10 + (qrs_val * 0.7);
        const r_amp = 1.5 * amp, s_amp = -0.8 * amp;
        const t_center = s_center + 300;
        const t_amp = -0.4 * amp; // Inverted T wave

        let signal = 0;
        signal += r_amp * Math.exp(-Math.pow(t_ms - r_center, 2) / (2 * Math.pow(qrs_val / 8, 2)));
        signal += s_amp * Math.exp(-Math.pow(t_ms - s_center, 2) / (2 * Math.pow(qrs_val / 8, 2)));
        signal += t_amp * Math.exp(-Math.pow(t_ms - t_center, 2) / (2 * Math.pow(70, 2)));
        return signal * -80;
    }

    /**
     * Lead transformation factors relative to Lead II.
     * Approximate amplitude scaling for each standard lead.
     */
    function applyLeadTransform(signal) {
        const factors = {
            'I': 0.5, 'II': 1.0, 'III': 0.6,
            'aVR': -0.75, 'aVL': -0.4, 'aVF': 0.8,
            'V1': 0.3, 'V2': 0.5, 'V3': 0.7,
            'V4': 0.9, 'V5': 0.8, 'V6': 0.5
        };
        return signal * (factors[state.ecgLead] || 1.0);
    }

    /**
     * ECG Waveform Dispatcher
     * Routes to the correct rhythm generator and applies lead transformation.
     */
    function getEcgSignal(t_ms) {
        let signal;
        switch (state.ecgRhythm) {
            case 'AFIB': signal = getAfibSignal(t_ms); break;
            case 'AFLUTTER': signal = getAflutterSignal(t_ms); break;
            case 'VTACH': signal = getVtachSignal(t_ms); break;
            case 'VFIB': signal = getVfibSignal(t_ms); break;
            case 'AVB1': case 'AVB2': case 'AVB3':
                signal = getAvBlockSignal(t_ms); break;
            case 'STEMI': signal = getStemiSignal(t_ms); break;
            case 'HYPERK': signal = getHyperkalemiaSignal(t_ms); break;
            case 'PVC_BIGEMINY':
                signal = (state.beatCounter % 2 === 0) ? getNsrSignal(t_ms) : getPvcSignal(t_ms);
                break;
            default: signal = getNsrSignal(t_ms);
        }
        return applyLeadTransform(signal);
    }

    /**
     * Returns beat duration considering rhythm irregularity.
     */
    function getBeatDuration() {
        const baseDuration = 60000 / state.hrTarget;
        if (state.ecgRhythm === 'AFIB') {
            return baseDuration * (0.6 + Math.random() * 0.8); // 60-140% of base
        }
        if (state.ecgRhythm === 'VFIB') {
            return baseDuration * 0.3; // Very fast chaotic
        }
        if (state.ecgRhythm === 'AVB2') {
            // Wenckebach: PR lengthens over 4 beats, then dropped QRS on 5th
            const beatInCycle = state.beatCounter % 5;
            if (beatInCycle === 4) {
                return baseDuration * 0.5; // Short beat, then dropped QRS in next
            }
            return baseDuration;
        }
        if (state.ecgRhythm === 'PVC_BIGEMINY') {
            // Compensatory pause after PVC
            return (state.beatCounter % 2 === 1) ? baseDuration * 1.4 : baseDuration;
        }
        return baseDuration;
    }

    /**
     * SpO2 Phlethysmography Generator (IR Absorption curve)
     * Generates a realistic pulse oximetry waveform with a dicrotic notch.
     * @param {number} p - Phase of the beat (0.0 to 1.0).
     */
    function getPlethSignal(p) {
        if (p < 0 || p > 1) return 0;
        let y = 0;
        if (p < 0.2) {
            // Systolic upstroke
            y = Math.sin((p / 0.2) * (Math.PI / 2));
        } else {
            // Diastolic decay with dicrotic notch
            const tDecay = (p - 0.2) / 0.8;
            const decay = Math.pow(1 - tDecay, 2);
            const bump = 0.15 * Math.exp(-Math.pow((tDecay - 0.3) * 10, 2));
            y = decay + bump;
        }
        return y;
    }

    function getCapnographySignal(p) {
        // Capnography phases I-IV
        // p: normalized position within respiratory cycle (0-1)
        if (p < 0 || p > 1) return 0;
        // Phase I: inspiratory baseline
        if (p < 0.05) return 0;
        // Phase II: expiratory upstroke
        if (p < 0.25) {
            const t = (p - 0.05) / 0.2;
            return t * t * (3 - 2 * t); // smoothstep
        }
        // Phase III: expiratory plateau (alveolar)
        if (p < 0.80) {
            const t = (p - 0.25) / 0.55;
            return 1 + 0.03 * Math.sin(t * Math.PI * 2); // slight wobble
        }
        // Phase IV: inspiratory downstroke (rapid)
        if (p < 0.95) {
            const t = (p - 0.80) / 0.15;
            return 1 - t * t * (3 - 2 * t);
        }
        return 0;
    }

    function getArterialLineSignal(p) {
        // A-line waveform with dicrotic notch
        // p: normalized position within cardiac cycle (0-1)
        if (p < 0 || p > 1) return 0;
        // Systolic upstroke
        if (p < 0.12) {
            const t = p / 0.12;
            return Math.sin(t * Math.PI / 2) * 0.95;
        }
        // Systolic peak to dicrotic notch
        if (p < 0.35) {
            const t = (p - 0.12) / 0.23;
            const decay = Math.pow(1 - t, 1.5);
            return 0.95 * decay + 0.05;
        }
        // Dicrotic notch (brief dip and rebound)
        if (p < 0.40) {
            const t = (p - 0.35) / 0.05;
            const notch = 1 - 0.6 * Math.sin(t * Math.PI);
            return 0.40 * notch + 0.05;
        }
        // Diastolic decay
        const t = (p - 0.40) / 0.60;
        const decay = Math.pow(1 - t, 1.8);
        return 0.50 * decay + 0.02;
    }

    // --- ECG Reference Modal ---
    function drawReferenceModal() {
        const canvas = document.getElementById('refCanvas');
        if (!canvas) return;

        // Size canvas to its display size
        canvas.width = canvas.offsetWidth || 600;
        canvas.height = canvas.offsetHeight || 220;

        const ctx = canvas.getContext('2d');
        const W = canvas.width;
        const H = canvas.height;
        const cy = H * 0.42; // baseline sits slightly above center to give room for brackets

        // Dark background
        ctx.fillStyle = '#0d1b2a';
        ctx.fillRect(0, 0, W, H);

        // Grid lines
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        for (let gx = 0; gx < W; gx += 40) {
            ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
        }
        for (let gy = 0; gy < H; gy += 30) {
            ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
        }

        // Feature timings in ms
        const pr_val = state.ecgPR || 160;
        const qrs_val = state.ecgQRS || 80;
        const P_START = 40;
        const P_PEAK = 80;
        const P_END = 120;
        const Q_START = pr_val;
        const R_PEAK = Q_START + qrs_val * 0.4;
        const S_END = Q_START + qrs_val;
        const T_PEAK = Q_START + 280;
        const T_END = Q_START + 340;
        const U_PEAK = T_PEAK + 150;
        const U_END = U_PEAK + 60;
        const QTC_END = T_END;
        const BEAT_END = U_END + 80;

        // Scale: fit the beat into canvas width with margins
        const margin = 32;
        const scale = (W - margin * 2) / BEAT_END;
        const msToX = ms => margin + ms * scale;

        // Isoelectric baseline
        ctx.setLineDash([4, 6]);
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(margin, cy);
        ctx.lineTo(W - margin, cy);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw the ECG waveform for one beat
        ctx.beginPath();
        ctx.strokeStyle = '#00e676';
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        let first = true;
        for (let t = 0; t <= BEAT_END; t += 2) {
            const sig = getEcgSignal(t);
            const px = msToX(t);
            const py = cy + sig * 0.9; // slight scale down to give label room
            if (first) { ctx.moveTo(px, py); first = false; }
            else ctx.lineTo(px, py);
        }
        ctx.stroke();

        // ── Helper: vertical dashed line + pill label at wave peak ──
        function drawPeak(ms, label, color) {
            const px = msToX(ms);
            const waveY = cy + getEcgSignal(ms) * 0.9;
            const above = waveY < cy; // label above or below?

            // Dashed vertical guide
            ctx.save();
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 4]);
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.moveTo(px, above ? 0 : H);
            ctx.lineTo(px, waveY);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;

            // Pill badge — clamped so it never overflows canvas edges
            ctx.font = 'bold 13px Inter';
            const tw = ctx.measureText(label).width + 10;
            const bh = 17;
            const by = above ? waveY - 22 : waveY + 6;
            const bx = Math.max(2, Math.min(W - tw - 2, px - tw / 2));
            const lcx = bx + tw / 2; // label center follows clamped badge
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.roundRect(bx, by, tw, bh, 4);
            ctx.fill();
            ctx.fillStyle = '#000';
            ctx.textAlign = 'center';
            ctx.fillText(label, lcx, by + 12);
            ctx.restore();
        }

        // ── Helper: horizontal bracket below baseline ──
        function drawBracket(ms1, ms2, label, color, row) {
            const x1 = msToX(ms1);
            const x2 = msToX(ms2);
            const by = cy + 32 + row * 22;

            ctx.save();
            ctx.strokeStyle = color;
            ctx.fillStyle = color;
            ctx.lineWidth = 1.5;
            ctx.globalAlpha = 0.9;

            // Line
            ctx.beginPath();
            ctx.moveTo(x1, by);
            ctx.lineTo(x2, by);
            ctx.stroke();

            // End ticks
            [x1, x2].forEach(xp => {
                ctx.beginPath(); ctx.moveTo(xp, by - 5); ctx.lineTo(xp, by + 5); ctx.stroke();
            });

            // Label pill — clamped to canvas bounds
            const mx = (x1 + x2) / 2;
            ctx.font = 'bold 11px Inter';
            const tw = ctx.measureText(label).width + 8;
            const lbx = Math.max(2, Math.min(W - tw - 2, mx - tw / 2));
            const lcx = lbx + tw / 2;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.roundRect(lbx, by - 17, tw, 13, 3);
            ctx.fill();
            ctx.fillStyle = '#000';
            ctx.textAlign = 'center';
            ctx.fillText(label, lcx, by - 7);
            ctx.restore();
        }

        // ── Peak markers ──
        drawPeak(P_PEAK, 'P', '#61dafb');
        drawPeak(R_PEAK, 'R', '#ff4d4d');
        drawPeak(T_PEAK, 'T', '#ffd700');
        drawPeak(U_PEAK, 'U', '#c084fc');

        // ── Interval brackets (7 rows, staggered) ──
        drawBracket(P_START, P_END, 'P wave', '#61dafb', 0);
        drawBracket(P_START, Q_START, `PR: ${pr_val}ms`, '#87c4ff', 1);
        drawBracket(Q_START, S_END, `QRS: ${qrs_val}ms`, '#ff4d4d', 2);
        drawBracket(S_END, T_PEAK, 'ST seg', '#fbbf24', 3);
        drawBracket(T_PEAK - 50, T_END, 'T wave', '#ffd700', 4);
        drawBracket(Q_START, QTC_END, 'QTc < 440ms', '#4ade80', 5);
        drawBracket(U_PEAK - 25, U_END, 'U wave', '#c084fc', 6);
    }

    // --- Pleth Reference Modal ---
    function drawPlethReference() {
        const canvas = document.getElementById('plethRefCanvas');
        if (!canvas) return;

        canvas.width = canvas.offsetWidth || 600;
        canvas.height = canvas.offsetHeight || 180;

        const ctx = canvas.getContext('2d');
        const W = canvas.width;
        const H = canvas.height;

        // Dark background + grid
        ctx.fillStyle = '#0d1b2a';
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        for (let gx = 0; gx < W; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
        for (let gy = 0; gy < H; gy += 30) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }

        // Waveform key points (normalized 0-1 in phase, 0-1 in amplitude)
        // Matches getPlethSignal: upstroke 0-0.2, then decay + dicrotic notch
        const margin = 40;
        const usableW = W - margin * 2;
        const baseline = H * 0.82;
        const amp = H * 0.55;

        // Sample one full beat using getPlethSignal
        ctx.beginPath();
        ctx.strokeStyle = '#e6ac00';
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        for (let i = 0; i <= 200; i++) {
            const p = i / 200;
            const px = margin + p * usableW;
            const py = baseline - getPlethSignal(p) * amp;
            i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.stroke();

        // DC baseline (dashed)
        ctx.setLineDash([4, 6]);
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(margin, baseline); ctx.lineTo(W - margin, baseline); ctx.stroke();
        ctx.setLineDash([]);

        // ── Key phase positions ──
        const xOf = p => margin + p * usableW;
        const yOf = p => baseline - getPlethSignal(p) * amp;

        const phases = {
            start: 0,
            peak: 0.18,   // systolic peak
            notch: 0.36,   // dicrotic notch (approx)
            end: 1.0,
        };

        // ── Helper: vertical dashed guide + pill badge ──
        function markPoint(phase, label, color, forceAbove) {
            const px = xOf(phase);
            const py = yOf(phase);
            const above = forceAbove !== undefined ? forceAbove : py < baseline - amp * 0.3;

            ctx.save();
            ctx.strokeStyle = color; ctx.lineWidth = 1;
            ctx.setLineDash([3, 4]); ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.moveTo(px, above ? 4 : H - 4);
            ctx.lineTo(px, py);
            ctx.stroke();
            ctx.setLineDash([]); ctx.globalAlpha = 1;

            ctx.font = 'bold 12px Inter';
            const tw = ctx.measureText(label).width + 10;
            const bh = 16;
            const by = above ? py - 22 : py + 5;
            const bx = Math.max(2, Math.min(W - tw - 2, px - tw / 2));
            const lcx = bx + tw / 2;
            ctx.fillStyle = color;
            ctx.beginPath(); ctx.roundRect(bx, by, tw, bh, 4); ctx.fill();
            ctx.fillStyle = '#000';
            ctx.textAlign = 'center';
            ctx.fillText(label, lcx, by + 11);
            ctx.restore();
        }

        // ── Helper: horizontal bracket at given y row below baseline ──
        function drawBracket(p1, p2, label, color, row) {
            const x1 = xOf(p1), x2 = xOf(p2);
            const by = baseline + 12 + row * 20;
            if (by > H - 4) return;

            ctx.save();
            ctx.strokeStyle = color; ctx.fillStyle = color;
            ctx.lineWidth = 1.5; ctx.globalAlpha = 0.9;

            ctx.beginPath(); ctx.moveTo(x1, by); ctx.lineTo(x2, by); ctx.stroke();
            [x1, x2].forEach(xp => {
                ctx.beginPath(); ctx.moveTo(xp, by - 5); ctx.lineTo(xp, by + 5); ctx.stroke();
            });

            const mx = (x1 + x2) / 2;
            ctx.font = 'bold 11px Inter';
            const tw = ctx.measureText(label).width + 8;
            const lbx = Math.max(2, Math.min(W - tw - 2, mx - tw / 2));
            const lcx = lbx + tw / 2;
            ctx.globalAlpha = 0.92;
            ctx.beginPath(); ctx.roundRect(lbx, by - 17, tw, 13, 3); ctx.fill();
            ctx.fillStyle = '#000'; ctx.textAlign = 'center';
            ctx.fillText(label, lcx, by - 7);
            ctx.restore();
        }

        // ── Double-arrow for AC amplitude (DC to peak) ──
        const peakX = xOf(phases.peak);
        const peakY = yOf(phases.peak);
        ctx.save();
        ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(peakX + 14, baseline); ctx.lineTo(peakX + 14, peakY); ctx.stroke();
        ctx.setLineDash([]);
        // arrowheads
        [[peakX + 14, baseline, 1], [peakX + 14, peakY, -1]].forEach(([ax, ay, dir]) => {
            ctx.beginPath();
            ctx.moveTo(ax, ay); ctx.lineTo(ax - 4, ay + dir * 6); ctx.lineTo(ax + 4, ay + dir * 6); ctx.closePath();
            ctx.fillStyle = '#4ade80'; ctx.fill();
        });
        ctx.fillStyle = '#4ade80'; ctx.font = 'bold 9px Inter'; ctx.textAlign = 'left';
        ctx.fillText('AC amp', peakX + 18, (baseline + peakY) / 2 + 4);
        ctx.restore();

        // ── Mark key points ──
        markPoint(phases.peak, 'Peak (Systolic)', '#ffd700', true);
        markPoint(phases.notch, 'Dicrotic Notch', '#61dafb', false);

        // ── Brackets below baseline ──
        drawBracket(phases.start, phases.peak, 'Upstroke', '#ff4d4d', 0);
        drawBracket(phases.peak, phases.notch, 'Ejection', '#fbbf24', 1);
        drawBracket(phases.notch, phases.end, 'Diastolic Decay', '#87c4ff', 2);
    }

    // --- SpO2 Reference Modal ---
    function drawSpo2Reference() {
        const canvas = document.getElementById('spo2RefCanvas');
        if (!canvas) return;

        canvas.width = canvas.offsetWidth || 600;
        canvas.height = canvas.offsetHeight || 180;

        const ctx = canvas.getContext('2d');
        const W = canvas.width;
        const H = canvas.height;

        // Background + grid
        ctx.fillStyle = '#0d1b2a';
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 1;
        for (let gx = 0; gx < W; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
        for (let gy = 0; gy < H; gy += 30) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }

        // SpO2 scale: 80% – 100%
        const MIN_SPO2 = 80, MAX_SPO2 = 100;
        const margin = 48;
        const barTop = H * 0.26;
        const barH = 38;
        const barW = W - margin * 2;
        const spToX = v => margin + ((v - MIN_SPO2) / (MAX_SPO2 - MIN_SPO2)) * barW;

        // Clinical zones (right-to-left = worst-to-best)
        const zones = [
            { lo: 80, hi: 85, color: '#b71c1c', label: 'Severe\n<85%' },
            { lo: 85, hi: 90, color: '#e53935', label: 'Moderate\n85–89%' },
            { lo: 90, hi: 92, color: '#fb8c00', label: 'Mild\n90–91%' },
            { lo: 92, hi: 95, color: '#fdd835', label: 'Acceptable\n92–94%' },
            { lo: 95, hi: 100, color: '#43a047', label: 'Normal\n95–100%' },
        ];

        // Draw gradient bar zone by zone
        zones.forEach(z => {
            const x1 = spToX(z.lo);
            const x2 = spToX(z.hi);
            const grad = ctx.createLinearGradient(x1, 0, x2, 0);
            grad.addColorStop(0, z.color + 'cc');
            grad.addColorStop(1, z.color);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.roundRect(x1, barTop, x2 - x1, barH, 0);
            ctx.fill();

            // Thin separator
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            ctx.fillRect(x2 - 1, barTop, 2, barH);
        });

        // Bar border
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(spToX(MIN_SPO2), barTop, barW, barH, 4);
        ctx.stroke();

        // Tick marks + % labels every 2%
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = '10px Inter';
        ctx.textAlign = 'center';
        for (let v = MIN_SPO2; v <= MAX_SPO2; v += 2) {
            const tx = spToX(v);
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.fillRect(tx - 0.5, barTop + barH, 1, 6);
            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            ctx.fillText(v + '%', tx, barTop + barH + 17);
        }

        // Zone labels inside / above bar
        zones.forEach(z => {
            const cx = spToX((z.lo + z.hi) / 2);
            const lines = z.label.split('\n');
            ctx.save();
            ctx.fillStyle = 'rgba(255,255,255,0.92)';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(0,0,0,0.7)';
            ctx.shadowBlur = 3;
            lines.forEach((line, i) => ctx.fillText(line, cx, barTop + 14 + i * 14));
            ctx.restore();
        });

        // ── Live needle for current SpO2 ──
        const currentSpo2 = parseInt(document.getElementById('spo2-value')?.innerText) || 93;
        const clampedSpo2 = Math.max(MIN_SPO2, Math.min(MAX_SPO2, currentSpo2));
        const nx = spToX(clampedSpo2);

        // Needle line
        ctx.save();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 6;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(nx, barTop - 28);
        ctx.lineTo(nx, barTop + barH + 4);
        ctx.stroke();
        ctx.setLineDash([]);

        // Needle triangle above bar
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(nx, barTop - 4);
        ctx.lineTo(nx - 7, barTop - 22);
        ctx.lineTo(nx + 7, barTop - 22);
        ctx.closePath();
        ctx.fill();

        // Value badge above needle
        const badge = `${currentSpo2}%`;
        ctx.font = 'bold 13px Inter';
        const bw = ctx.measureText(badge).width + 12;
        const bx = Math.max(2, Math.min(W - bw - 2, nx - bw / 2));
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(bx, barTop - 48, bw, 20, 4);
        ctx.fill();
        ctx.fillStyle = '#0d1b2a';
        ctx.textAlign = 'center';
        ctx.fillText(badge, bx + bw / 2, barTop - 33);
        ctx.restore();

        // Title label
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('SpO₂ Saturation Scale', margin, barTop - 56);
    }

    // --- HR Reference Modal ---
    function drawHrReference() {
        const canvas = document.getElementById('hrRefCanvas');
        if (!canvas) return;

        canvas.width = canvas.offsetWidth || 600;
        canvas.height = canvas.offsetHeight || 180;

        const ctx = canvas.getContext('2d');
        const W = canvas.width;
        const H = canvas.height;

        // Background + grid
        ctx.fillStyle = '#0d1b2a';
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 1;
        for (let gx = 0; gx < W; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
        for (let gy = 0; gy < H; gy += 30) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }

        // Scale: 30 – 180 bpm
        const MIN_HR = 30, MAX_HR = 180;
        const margin = 48;
        const barTop = H * 0.30;
        const barH = 36;
        const barW = W - margin * 2;
        const bpmToX = v => margin + ((v - MIN_HR) / (MAX_HR - MIN_HR)) * barW;

        // Clinical zones
        const zones = [
            { lo: 30, hi: 40, color: '#1565c0', label: 'Severe\nBrady' },
            { lo: 40, hi: 60, color: '#1e88e5', label: 'Athletes\n40–60' },
            { lo: 60, hi: 100, color: '#43a047', label: 'Normal\n60–100' },
            { lo: 100, hi: 130, color: '#fb8c00', label: 'Tachy\n100–130' },
            { lo: 130, hi: 180, color: '#c62828', label: 'Severe\nTachy' },
        ];

        zones.forEach(z => {
            const x1 = bpmToX(z.lo), x2 = bpmToX(z.hi);
            const grad = ctx.createLinearGradient(x1, 0, x2, 0);
            grad.addColorStop(0, z.color + 'bb');
            grad.addColorStop(1, z.color);
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.roundRect(x1, barTop, x2 - x1, barH, 0); ctx.fill();
            // separator
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            ctx.fillRect(x2 - 1, barTop, 2, barH);
        });

        // Bar border
        ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(bpmToX(MIN_HR), barTop, barW, barH, 4); ctx.stroke();

        // Tick + label every 10 bpm
        for (let v = MIN_HR; v <= MAX_HR; v += 10) {
            const tx = bpmToX(v);
            ctx.fillStyle = 'rgba(255,255,255,0.25)';
            ctx.fillRect(tx - 0.5, barTop + barH, 1, 5);
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = '9px Inter'; ctx.textAlign = 'center';
            ctx.fillText(v, tx, barTop + barH + 15);
        }
        // "bpm" axis label
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.font = '9px sans-serif'; ctx.textAlign = 'left';
        ctx.fillText('bpm', margin + barW + 4, barTop + barH + 15);

        // Zone labels inside bar
        zones.forEach(z => {
            const cx = bpmToX((z.lo + z.hi) / 2);
            const lines = z.label.split('\n');
            ctx.save();
            ctx.fillStyle = 'rgba(255,255,255,0.92)';
            ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 3;
            lines.forEach((line, i) => ctx.fillText(line, cx, barTop + 13 + i * 13));
            ctx.restore();
        });

        // ── Exercise zone brackets above bar ──
        const exZones = [
            { lo: 90, hi: 126, label: 'Moderate (age 40)', color: '#80cbc4' },
            { lo: 126, hi: 153, label: 'Target (age 40)', color: '#ff8a65' },
        ];
        exZones.forEach((ez, i) => {
            const x1 = bpmToX(ez.lo), x2 = bpmToX(ez.hi);
            const by = barTop - 14 - i * 18;
            ctx.save();
            ctx.strokeStyle = ez.color; ctx.fillStyle = ez.color;
            ctx.lineWidth = 1.5; ctx.globalAlpha = 0.85;
            ctx.beginPath(); ctx.moveTo(x1, by); ctx.lineTo(x2, by); ctx.stroke();
            [x1, x2].forEach(xp => { ctx.beginPath(); ctx.moveTo(xp, by - 4); ctx.lineTo(xp, by + 4); ctx.stroke(); });
            ctx.font = 'bold 9px Inter';
            const tw = ctx.measureText(ez.label).width + 8;
            const lbx = Math.max(2, Math.min(W - tw - 2, (x1 + x2) / 2 - tw / 2));
            ctx.beginPath(); ctx.roundRect(lbx, by - 14, tw, 12, 3); ctx.fill();
            ctx.fillStyle = '#000'; ctx.textAlign = 'center';
            ctx.fillText(ez.label, lbx + tw / 2, by - 5);
            ctx.restore();
        });

        // ── Live needle for current HR ──
        const currentHr = parseInt(document.getElementById('hr-value')?.innerText) || 75;
        const clampedHr = Math.max(MIN_HR, Math.min(MAX_HR, currentHr));
        const nx = bpmToX(clampedHr);

        ctx.save();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5;
        ctx.shadowColor = '#fff'; ctx.shadowBlur = 6;
        ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.moveTo(nx, barTop - 30); ctx.lineTo(nx, barTop + barH + 4); ctx.stroke();
        ctx.setLineDash([]);
        // Triangle
        ctx.fillStyle = '#ffffff'; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.moveTo(nx, barTop - 4); ctx.lineTo(nx - 7, barTop - 22); ctx.lineTo(nx + 7, barTop - 22); ctx.closePath(); ctx.fill();
        // Badge
        const badge = `${currentHr} bpm`;
        ctx.font = 'bold 12px Inter';
        const bw = ctx.measureText(badge).width + 12;
        const bx = Math.max(2, Math.min(W - bw - 2, nx - bw / 2));
        ctx.shadowBlur = 0; ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.roundRect(bx, barTop - 50, bw, 20, 4); ctx.fill();
        ctx.fillStyle = '#0d1b2a'; ctx.textAlign = 'center';
        ctx.fillText(badge, bx + bw / 2, barTop - 35);
        ctx.restore();

        // Title
        ctx.fillStyle = 'rgba(255,255,255,0.38)';
        ctx.font = '11px sans-serif'; ctx.textAlign = 'left';
        ctx.fillText('Heart Rate Scale', margin, barTop - 58);
    }

    // --- BP Reference Modal ---
    function drawBpReference() {
        const canvas = document.getElementById('bpRefCanvas');
        if (!canvas) return;

        canvas.width = canvas.offsetWidth || 600;
        canvas.height = canvas.offsetHeight || 280;

        const ctx = canvas.getContext('2d');
        const W = canvas.width;
        const H = canvas.height;

        ctx.fillStyle = '#0d1b2a';
        ctx.fillRect(0, 0, W, H);

        // Chart margins
        const ml = 54, mr = 20, mt = 30, mb = 46;
        const cW = W - ml - mr;
        const cH = H - mt - mb;

        // SYS X-axis: 70 → 190   DIA Y-axis: 40 → 120 (top=high)
        const SYS_MIN = 70, SYS_MAX = 190;
        const DIA_MIN = 40, DIA_MAX = 120;
        const sysToX = s => ml + ((s - SYS_MIN) / (SYS_MAX - SYS_MIN)) * cW;
        const diaToY = d => mt + cH - ((d - DIA_MIN) / (DIA_MAX - DIA_MIN)) * cH;

        // ── Zone rectangles ──
        // Each zone is defined by sys range and dia range
        const zones = [
            { sx1: 70, sx2: 90, dy1: 40, dy2: 60, color: '#1565c0', alpha: 0.55, label: 'Hypotension' },
            { sx1: 70, sx2: 120, dy1: 40, dy2: 80, color: '#2e7d32', alpha: 0.50, label: 'Normal' },
            { sx1: 120, sx2: 130, dy1: 40, dy2: 80, color: '#f9a825', alpha: 0.55, label: 'Elevated' },
            { sx1: 130, sx2: 140, dy1: 80, dy2: 120, color: '#e65100', alpha: 0.55, label: 'HTN 1' },
            { sx1: 140, sx2: 190, dy1: 90, dy2: 120, color: '#b71c1c', alpha: 0.60, label: 'HTN 2' },
        ];

        zones.forEach(z => {
            const x1 = sysToX(z.sx1), x2 = sysToX(z.sx2);
            const y1 = diaToY(z.dy2), y2 = diaToY(z.dy1); // flipped: high DIA = low y
            ctx.save();
            ctx.globalAlpha = z.alpha;
            ctx.fillStyle = z.color;
            ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
            ctx.globalAlpha = 1;

            // Zone label badge
            const cx = (x1 + x2) / 2;
            const cy = (y1 + y2) / 2;
            ctx.font = 'bold 10px sans-serif';
            const tw = ctx.measureText(z.label).width + 8;
            const bx = Math.max(ml + 2, Math.min(W - mr - tw - 2, cx - tw / 2));
            ctx.fillStyle = z.color;
            ctx.beginPath(); ctx.roundRect(bx, cy - 8, tw, 15, 3); ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 3;
            ctx.textAlign = 'center';
            ctx.fillText(z.label, bx + tw / 2, cy + 3);
            ctx.shadowBlur = 0;
            ctx.restore();
        });

        // ── Chart border ──
        ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1;
        ctx.strokeRect(ml, mt, cW, cH);

        // ── Grid lines ──
        ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
        for (let s = SYS_MIN; s <= SYS_MAX; s += 10) {
            const x = sysToX(s);
            ctx.beginPath(); ctx.moveTo(x, mt); ctx.lineTo(x, mt + cH); ctx.stroke();
        }
        for (let d = DIA_MIN; d <= DIA_MAX; d += 10) {
            const y = diaToY(d);
            ctx.beginPath(); ctx.moveTo(ml, y); ctx.lineTo(ml + cW, y); ctx.stroke();
        }

        // ── X-axis ticks + labels (SYS) ──
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '9px Inter'; ctx.textAlign = 'center';
        for (let s = SYS_MIN; s <= SYS_MAX; s += 20) {
            const x = sysToX(s);
            ctx.fillRect(x - 0.5, mt + cH, 1, 4);
            ctx.fillText(s, x, mt + cH + 13);
        }
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('Systolic (mmHg)', ml + cW / 2, H - 4);

        // ── Y-axis ticks + labels (DIA) ──
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '9px Inter'; ctx.textAlign = 'right';
        for (let d = DIA_MIN; d <= DIA_MAX; d += 10) {
            const y = diaToY(d);
            ctx.fillRect(ml - 4, y - 0.5, 4, 1);
            ctx.fillText(d, ml - 6, y + 3);
        }
        // Rotated Y-axis label
        ctx.save();
        ctx.translate(12, mt + cH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('Diastolic (mmHg)', 0, 0);
        ctx.restore();

        // ── Live crosshair for current BP ──
        const currentSys = parseInt(document.getElementById('bp-sys')?.innerText) || 120;
        const currentDia = parseInt(document.getElementById('bp-dia')?.innerText) || 80;
        const clampSys = Math.max(SYS_MIN, Math.min(SYS_MAX, currentSys));
        const clampDia = Math.max(DIA_MIN, Math.min(DIA_MAX, currentDia));
        const px = sysToX(clampSys);
        const py = diaToY(clampDia);

        // Crosshair lines
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(ml, py); ctx.lineTo(px, py); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(px, mt + cH); ctx.lineTo(px, py); ctx.stroke();
        ctx.setLineDash([]);

        // Dot
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#fff'; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;

        // Value badge
        const badge = `${currentSys}/${currentDia}`;
        ctx.font = 'bold 12px Inter';
        const bw = ctx.measureText(badge).width + 12;
        const bx = Math.max(ml + 2, Math.min(W - mr - bw - 2, px - bw / 2));
        const by = py - 30;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.roundRect(bx, by, bw, 20, 4); ctx.fill();
        ctx.fillStyle = '#0d1b2a'; ctx.textAlign = 'center';
        ctx.fillText(badge, bx + bw / 2, by + 14);
        ctx.restore();

        // Title
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.font = '10px sans-serif'; ctx.textAlign = 'left';
        ctx.fillText('SYS / DIA Classification (AHA/ACC)', ml, mt - 10);
    }

    /**
     * Principal Animation & Simulation Loop
     * Synchronized to the display refresh rate (usually 60Hz).
     */
    function animate(timestamp) {
        // Start timeline on first frame
        if (!startTime && timelineData.length > 0) startTime = timestamp;
        if (!lastBeatTime) lastBeatTime = timestamp;

        // 1. Update Simulation State from Time-based sequences
        if (state.activeScenario && !state.isManualMode) {
            // Process scenario events
            const elapsedSec = (timestamp - scenarioStartTime) / 1000;
            const scenario = scenarios[state.activeScenario];
            if (scenario && scenario.events) {
                let activeEvent = null;
                for (let i = scenario.events.length - 1; i >= 0; i--) {
                    if (elapsedSec >= scenario.events[i].time) {
                        activeEvent = scenario.events[i];
                        break;
                    }
                }
                if (activeEvent) {
                    state.hrTarget = activeEvent.hr || state.hrTarget;
                    state.spo2Target = activeEvent.spo2 || state.spo2Target;
                    state.sys = activeEvent.sys || state.sys;
                    state.dia = activeEvent.dia || state.dia;
                    state.tempTarget = activeEvent.temp || state.tempTarget;
                    state.ecgRhythm = activeEvent.rhythm || state.ecgRhythm;
                    if (activeEvent.rr) state.rrTarget = activeEvent.rr;

                    // GCS: if gcs provided, distribute across E/V/M
                    if (activeEvent.gcs !== undefined) {
                        state.gcsTotal = activeEvent.gcs;
                        // Distribute total across sub-scores for slider sync
                        let remainder = state.gcsTotal;
                        state.gcsMotor = Math.min(6, Math.max(1, Math.floor(remainder / 3)));
                        remainder -= state.gcsMotor;
                        state.gcsVerbal = Math.min(5, Math.max(1, Math.floor(remainder / 2)));
                        remainder -= state.gcsVerbal;
                        state.gcsEye = Math.min(4, Math.max(1, remainder));
                    }
                    if (activeEvent.pain !== undefined) {
                        state.painScore = activeEvent.pain;
                    }
                    if (activeEvent.onO2 !== undefined) {
                        state.onOxygen = activeEvent.onO2;
                    }
                    // Lab values from scenarios
                    if (activeEvent.labs) {
                        Object.keys(activeEvent.labs).forEach(key => {
                            if (state.labs[key] !== undefined) {
                                state.labs[key] = activeEvent.labs[key];
                            }
                        });
                        // Sync lab slider displays
                        Object.keys(labSliders).forEach(sliderId => {
                            const slider = document.getElementById(sliderId);
                            if (slider) {
                                const evt = new Event('input');
                                slider.dispatchEvent(evt);
                            }
                        });
                    }

                    if (document.activeElement !== hrControl) hrControl.value = state.hrTarget;
                    if (document.activeElement !== spo2Control) spo2Control.value = state.spo2Target;
                    if (document.activeElement !== sysControl) sysControl.value = state.sys;
                    if (document.activeElement !== diaControl) diaControl.value = state.dia;

                    if (activeEvent.narrative) {
                        const narrativeEl = document.getElementById('scenario-narrative');
                        const narrativeItem = document.getElementById('scenario-narrative-item');
                        if (narrativeEl) narrativeEl.textContent = activeEvent.narrative;
                        if (narrativeItem) narrativeItem.style.display = '';
                    }
                }
                // Check if scenario ended
                if (elapsedSec > scenario.duration) {
                    state.activeScenario = null;
                    const narrativeItem = document.getElementById('scenario-narrative-item');
                    if (narrativeItem) narrativeItem.style.display = 'none';
                    const sel = document.getElementById('scenario-control');
                    if (sel) sel.value = '';
                }
            }
        } else if (timelineData.length > 0 && !state.isManualMode) {
            const elapsedMinutes = (timestamp - startTime) / 60000;
            let idx = Math.floor(elapsedMinutes * 12);

            if (idx >= 0 && idx < timelineData.length) {
                const point = timelineData[idx];
                state.hrTarget = point.hr;
                state.spo2Target = point.spo2;
                state.sys = point.sys;
                state.dia = point.dia;

                if (document.activeElement !== hrControl) hrControl.value = state.hrTarget;
                if (document.activeElement !== spo2Control) spo2Control.value = state.spo2Target;
                if (document.activeElement !== sysControl) sysControl.value = state.sys;
                if (document.activeElement !== diaControl) diaControl.value = state.dia;
            } else if (idx >= timelineData.length) {
                startTime = timestamp;
            }
        }

        // 2. Cardiac Beat Timing & Natural Fluctuation
        const beatDuration = getBeatDuration();
        let timeSinceBeat = timestamp - lastBeatTime;

        // For VFIB, reset beat timer more frequently
        if (state.ecgRhythm === 'VFIB' && timeSinceBeat > beatDuration) {
            lastBeatTime = timestamp;
        } else if (timeSinceBeat > beatDuration) {
            lastBeatTime = timestamp - (timeSinceBeat % beatDuration);
            state.beatCounter++;

            // AVB2 (Wenckebach): on the 5th beat (index 4), skip QRS
            if (state.ecgRhythm === 'AVB2') {
                const beatInCycle = state.beatCounter % 5;
                if (beatInCycle === 4) {
                    state.droppedBeats++;
                }
            }

            // Introduce subtle physiological drift every 2 seconds
            if (timestamp - state.lastFluctuation > 2000) {
                state.lastFluctuation = timestamp;

                // HR Fluctuation
                const hrDrift = Math.floor(Math.random() * 5) - 2;
                state.hrCurrent = Math.max(20, state.hrTarget + hrDrift);
                hrValue.innerText = state.hrCurrent;

                // RR Fluctuation
                const rrDrift = Math.floor(Math.random() * 3) - 1;
                state.rrCurrent = Math.max(4, Math.min(50, state.rrTarget + rrDrift));
                const rrValueEl = document.getElementById('rr-value');
                if (rrValueEl) rrValueEl.innerText = state.rrCurrent;

                // SpO2 Fluctuation
                const spo2Drift = Math.random() > 0.8 ? -1 : (Math.random() > 0.5 ? 1 : 0);
                state.spo2Current = Math.min(100, state.spo2Target + spo2Drift);
                spo2Value.innerText = state.spo2Current;

                // EtCO₂ Fluctuation (inversely linked to RR)
                const etco2Drift = Math.floor(Math.random() * 3) - 1;
                state.etco2Current = Math.max(15, Math.min(60, state.etco2Target + etco2Drift + (state.rrCurrent < 10 ? 5 : state.rrCurrent > 30 ? -5 : 0)));
                const etco2Val = document.getElementById('etco2-value');
                if (etco2Val) etco2Val.innerText = Math.round(state.etco2Current);

                // BP natural fluctuation with Pulse Pressure safety
                const sysDrift = Math.floor(Math.random() * 5) - 2;
                const diaDrift = Math.floor(Math.random() * 3) - 1;
                let simulatedSys = state.sys + sysDrift;
                let simulatedDia = state.dia + diaDrift;
                if (simulatedSys < simulatedDia + 20) simulatedSys = simulatedDia + 20;

                sysValue.innerText = simulatedSys;
                diaValue.innerText = simulatedDia;
                const mapEl = document.getElementById('bp-map');
                if (mapEl) mapEl.textContent = Math.round(simulatedDia * 2/3 + simulatedSys * 1/3);

                // Temperature physiological drift
                const tempDrift = (Math.random() * 0.2) - 0.1;
                state.tempCurrent = state.tempTarget + tempDrift;
                if (tempValue) tempValue.innerText = formatTemp(state.tempCurrent);

                // GCS & Pain drift (rarely change spontaneously)
                if (Math.random() > 0.97) {
                    state.gcsEye = Math.max(1, Math.min(4, state.gcsEye + (Math.random() > 0.5 ? 1 : -1)));
                    state.gcsVerbal = Math.max(1, Math.min(5, state.gcsVerbal + (Math.random() > 0.5 ? 1 : -1)));
                    state.gcsMotor = Math.max(1, Math.min(6, state.gcsMotor + (Math.random() > 0.5 ? 1 : -1)));
                    state.gcsTotal = state.gcsEye + state.gcsVerbal + state.gcsMotor;
                }
                if (Math.random() > 0.98) {
                    state.painScore = Math.max(0, Math.min(10, state.painScore + (Math.random() > 0.5 ? 1 : -1)));
                }

                // Apply drug effects on vitals
                if (state.activeDrugs.length > 0) {
                    const drugFx = computeCumulativeDrugEffects();
                    state.hrCurrent = Math.max(20, Math.min(250, state.hrCurrent + drugFx.hr));
                    simulatedSys = Math.max(40, Math.min(250, simulatedSys + drugFx.sys));
                    simulatedDia = Math.max(20, Math.min(150, simulatedDia + drugFx.dia));
                    if (drugFx.pain) state.painScore = Math.max(0, Math.min(10, state.painScore + drugFx.pain));
                    if (drugFx.rr) state.rrCurrent = Math.max(4, Math.min(50, state.rrCurrent + drugFx.rr));
                    hrValue.innerText = state.hrCurrent;
                    sysValue.innerText = simulatedSys;
                    diaValue.innerText = simulatedDia;
                    const rrValueEl2 = document.getElementById('rr-value');
                    if (rrValueEl2) rrValueEl2.innerText = state.rrCurrent;

                    // Side effects
                    state.activeDrugs.forEach(ad => {
                        const drug = DRUG_LIB[ad.drugKey];
                        const elapsed = (Date.now() - ad.timeAdministered) / 1000;
                        if (!drug || elapsed < drug.onset) return;
                        // Epinephrine → arrhythmia risk
                        if (drug.sideEffects.arrhythmiaRisk && Math.random() < 0.02 && state.ecgRhythm === 'NSR') {
                            state.ecgRhythm = 'PVC_BIGEMINY';
                            state.beatCounter = 0;
                        }
                        // Furosemide → hypokalemia (K+ drops)
                        if (drug.sideEffects.hypokalemiaRisk && Math.random() < 0.01) {
                            state.labs.potassium = Math.max(2.5, state.labs.potassium - 0.1);
                            const kDisplay = document.getElementById('lab-potassium');
                            if (kDisplay) kDisplay.innerText = state.labs.potassium.toFixed(1);
                        }
                        // Morphine → respiratory depression
                        if (drug.sideEffects.respDepression && Math.random() < 0.02) {
                            state.rrCurrent = Math.max(6, state.rrCurrent - 1);
                            const rv = document.getElementById('rr-value');
                            if (rv) rv.innerText = state.rrCurrent;
                        }
                    });
                }

                // Record trend data point
                state.vitalHistory.push({
                    time: Date.now(),
                    hr: state.hrCurrent,
                    spo2: state.spo2Current,
                    sys: simulatedSys,
                    dia: simulatedDia,
                    rr: state.rrCurrent,
                    temp: state.tempCurrent,
                    gcs: state.gcsTotal,
                    pain: state.painScore,
                    etco2: state.etco2Current
                });
                // Keep last 5 minutes of data (150 samples at 2s interval)
                if (state.vitalHistory.length > 150) state.vitalHistory.shift();

                updateScoreDisplay();
                checkAlarms();
                drawTrends();
            }
        } else if (state.ecgRhythm === 'VFIB') {
            // Always increment time for chaotic signal
        }

        // 3. Coordinate-Based Waveform Rendering (skip when frozen)
        if (!state.isFrozen) {
            const speed = state.ecgSpeed;
            ecgCtx.strokeStyle = '#22c55e'; // Vibrant Medical Green
            ecgCtx.lineWidth = 3;
            plethCtx.strokeStyle = '#fbbf24'; // Vibrant Medical Amber
            plethCtx.lineWidth = 3;

            const prevX = ecgX;
            ecgX += speed;

            let wrapped = false;
            if (ecgX > ecgCanvas.width) {
                ecgX = 0;
                wrapped = true;
            }

            // Oscilloscope style: Clear ahead of the sweep
            const scanBarWidth = 20;
            ecgCtx.clearRect(ecgX, 0, scanBarWidth, ecgCanvas.height);
            plethCtx.clearRect(ecgX, 0, scanBarWidth, plethCanvas.height);
            if (co2Ctx && co2Canvas) co2Ctx.clearRect(ecgX, 0, scanBarWidth, co2Canvas.height);
            if (alineCtx && alineCanvas) alineCtx.clearRect(ecgX, 0, scanBarWidth, alineCanvas.height);

            // Map mathematical signals to Canvas pixel coordinates
            const ecgCenter = ecgCanvas.height / 2;
            const noiseLevel = (state.ecgNoise !== undefined) ? state.ecgNoise : 2;
            noiseOffset = (Math.random() - 0.5) * noiseLevel;

            const currentEcgY = ecgCenter + getEcgSignal(timeSinceBeat) + noiseOffset;

            // Don't render pleth for VFIB (no cardiac output)
            if (state.ecgRhythm === 'VFIB') {
                plethCtx.clearRect(0, 0, plethCanvas.width, plethCanvas.height);
                plethCtx.fillStyle = '#fbbf24';
                plethCtx.font = 'bold 14px Inter';
                plethCtx.textAlign = 'center';
                plethCtx.fillText('NO OUTPUT', plethCanvas.width / 2, plethCanvas.height / 2);
            } else {
                const plethPhase = timeSinceBeat / beatDuration;
                const plethBase = plethCanvas.height * 0.85;
                const plethAmp = plethCanvas.height * 0.5;
                const currentPlethY = plethBase - (getPlethSignal(plethPhase) * plethAmp);

                plethCtx.beginPath();
                if (wrapped) plethCtx.moveTo(0, currentPlethY);
                else { plethCtx.moveTo(prevX, lastPlethY); plethCtx.lineTo(ecgX, currentPlethY); }
                plethCtx.stroke();
                lastPlethY = currentPlethY;

                // Draw pleth labels at wrap
                if (wrapped && state.showLabels) {
                    plethCtx.fillStyle = 'rgba(251,191,36,0.3)';
                    plethCtx.font = '7px sans-serif';
                    plethCtx.textAlign = 'left';
                    plethCtx.fillText('SpO₂ Wave', 2, 10);
                }
            }

            // Capnography waveform (CO₂)
            if (co2Ctx && co2Canvas) {
                co2Ctx.strokeStyle = '#22c55e';
                co2Ctx.lineWidth = 2;
                // CO2 phase advances with respiratory rate (slower than cardiac)
                const co2Period = (60000 / Math.max(4, state.rrCurrent || state.rrTarget)) / (1000 / 16.67); // frames per breath
                state.etco2Phase = (state.etco2Phase + 1) % co2Period;
                const co2Phase = state.etco2Phase / co2Period;
                const co2Base = co2Canvas.height * 0.9;
                const co2Amp = co2Canvas.height * 0.7;
                const etco2Normalized = (state.etco2Current || state.etco2Target) / 60;
                const currentCo2Y = co2Base - (getCapnographySignal(co2Phase) * co2Amp * Math.min(1, etco2Normalized * 1.2));
                co2Ctx.beginPath();
                if (wrapped) co2Ctx.moveTo(0, currentCo2Y);
                else { co2Ctx.moveTo(prevX, lastCo2Y); co2Ctx.lineTo(ecgX, currentCo2Y); }
                co2Ctx.stroke();
                lastCo2Y = currentCo2Y;
            }

            // Arterial Line waveform
            if (alineCtx && alineCanvas) {
                alineCtx.strokeStyle = '#ef4444';
                alineCtx.lineWidth = 2;
                const alinePhase = timeSinceBeat / beatDuration;
                const alineBase = alineCanvas.height * 0.9;
                const alineAmp = alineCanvas.height * 0.65;
                const currentAlineY = alineBase - (getArterialLineSignal(alinePhase) * alineAmp);
                alineCtx.beginPath();
                if (wrapped) alineCtx.moveTo(0, currentAlineY);
                else { alineCtx.moveTo(prevX, lastAlineY); alineCtx.lineTo(ecgX, currentAlineY); }
                alineCtx.stroke();
                lastAlineY = currentAlineY;
            }

            // Wave labels for teaching overlay
            if (state.showLabels && state.ecgRhythm !== 'VFIB') {
                ecgCtx.save();
                ecgCtx.font = '8px sans-serif';
                ecgCtx.textBaseline = 'bottom';
                // P wave label (first quarter of beat)
                const pWaveX = ecgX - 30;
                if (pWaveX > 0 && pWaveX < ecgCanvas.width) {
                    ecgCtx.fillStyle = '#60a5fa';
                    ecgCtx.fillText('P', pWaveX, currentEcgY - 30);
                }
                // QRS label (middle of beat)
                const qrsX = ecgX - 10;
                if (qrsX > 0 && qrsX < ecgCanvas.width) {
                    ecgCtx.fillStyle = '#fbbf24';
                    ecgCtx.fillText('QRS', qrsX, currentEcgY - 40);
                }
                // T wave label (last quarter)
                const tWaveX = ecgX + 15;
                if (tWaveX > 0 && tWaveX < ecgCanvas.width) {
                    ecgCtx.fillStyle = '#f87171';
                    ecgCtx.fillText('T', tWaveX, currentEcgY - 25);
                }
                ecgCtx.restore();
            }

            ecgCtx.beginPath();
            if (wrapped) ecgCtx.moveTo(0, currentEcgY);
            else { ecgCtx.moveTo(prevX, lastEcgY); ecgCtx.lineTo(ecgX, currentEcgY); }
            ecgCtx.stroke();
            lastEcgY = currentEcgY;
        }

        // ICU Board live waveforms (draw only when modal is visible)
        if (icuboardModal && !icuboardModal.classList.contains('hidden') && !state.isFrozen) {
            const icuW = icuEcgCanvas?.width || 400;
            const icuSpeed = state.ecgSpeed * (icuW / (ecgCanvas.width || 400));
            // Track ICU sweep independently (proportional scroll)
            if (typeof window._icuX === 'undefined') { window._icuX = 0; }
            window._icuX += icuSpeed;
            if (window._icuX > icuW) { window._icuX = 0; }
            const icuPrevX = window._icuX - icuSpeed;

            if (icuEcgCtx && icuEcgCanvas) {
                icuEcgCtx.clearRect(0, 0, icuEcgCanvas.width, icuEcgCanvas.height);
                if (state.ecgRhythm !== 'VFIB') {
                    const icuCenter = icuEcgCanvas.height / 2;
                    const icuY = icuCenter + getEcgSignal(timeSinceBeat);
                    icuEcgCtx.strokeStyle = '#22c55e'; icuEcgCtx.lineWidth = 2;
                    icuEcgCtx.beginPath();
                    icuEcgCtx.moveTo(window._icuX === 0 ? 0 : icuPrevX, window._icuX === 0 ? icuY : lastIcuEcgY);
                    icuEcgCtx.lineTo(window._icuX, icuY);
                    icuEcgCtx.stroke();
                    lastIcuEcgY = icuY;
                }
            }
            if (icuPlethCtx && icuPlethCanvas && state.ecgRhythm !== 'VFIB') {
                icuPlethCtx.clearRect(0, 0, icuPlethCanvas.width, icuPlethCanvas.height);
                const icuBase = icuPlethCanvas.height * 0.85;
                const icuAmp = icuPlethCanvas.height * 0.5;
                const pPhase = timeSinceBeat / beatDuration;
                const pY = icuBase - (getPlethSignal(pPhase) * icuAmp);
                icuPlethCtx.strokeStyle = '#fbbf24'; icuPlethCtx.lineWidth = 2;
                icuPlethCtx.beginPath();
                icuPlethCtx.moveTo(window._icuX === 0 ? 0 : icuPrevX, window._icuX === 0 ? pY : lastIcuPlethY);
                icuPlethCtx.lineTo(window._icuX, pY);
                icuPlethCtx.stroke();
                lastIcuPlethY = pY;
            }
            if (icuCo2Ctx && icuCo2Canvas) {
                icuCo2Ctx.clearRect(0, 0, icuCo2Canvas.width, icuCo2Canvas.height);
                const co2Period = (60000 / Math.max(4, state.rrCurrent || state.rrTarget)) / (1000 / 16.67);
                const co2Phase = (state.etco2Phase || 0) / co2Period;
                const co2Base = icuCo2Canvas.height * 0.9;
                const co2Amp = icuCo2Canvas.height * 0.7;
                const etco2Norm = (state.etco2Current || 35) / 60;
                const cY = co2Base - (getCapnographySignal(co2Phase) * co2Amp * Math.min(1, etco2Norm * 1.2));
                icuCo2Ctx.strokeStyle = '#22c55e'; icuCo2Ctx.lineWidth = 2;
                icuCo2Ctx.beginPath();
                icuCo2Ctx.moveTo(window._icuX === 0 ? 0 : icuPrevX, window._icuX === 0 ? cY : lastIcuCo2Y);
                icuCo2Ctx.lineTo(window._icuX, cY);
                icuCo2Ctx.stroke();
                lastIcuCo2Y = cY;
            }
            if (icuAlineCtx && icuAlineCanvas && state.ecgRhythm !== 'VFIB') {
                icuAlineCtx.clearRect(0, 0, icuAlineCanvas.width, icuAlineCanvas.height);
                const aBase = icuAlineCanvas.height * 0.9;
                const aAmp = icuAlineCanvas.height * 0.65;
                const aPhase = timeSinceBeat / beatDuration;
                const aY = aBase - (getArterialLineSignal(aPhase) * aAmp);
                icuAlineCtx.strokeStyle = '#ef4444'; icuAlineCtx.lineWidth = 2;
                icuAlineCtx.beginPath();
                icuAlineCtx.moveTo(window._icuX === 0 ? 0 : icuPrevX, window._icuX === 0 ? aY : lastIcuAlineY);
                icuAlineCtx.lineTo(window._icuX, aY);
                icuAlineCtx.stroke();
                lastIcuAlineY = aY;
            }
        }

        // Draw teaching overlays (calipers) when frozen or calipers active
        if (state.showCalipers || state.isFrozen) {
            drawTeachingOverlays();
        }

        requestAnimationFrame(animate);
    }

    // Start Animation
    requestAnimationFrame(animate);

    // --- UI Controls ---
    const openSettings = (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        if (settingsModal) {
            settingsModal.classList.remove('hidden');
            console.log("Settings opened");
        }
    };

    const closeSettings = (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        if (settingsModal) settingsModal.classList.add('hidden');
    };

    // Re-verify selectors in case of dynamic DOM changes
    const actualSettingsBtn = document.getElementById('toggle-controls') || document.querySelector('.settings-btn');
    if (actualSettingsBtn) {
        actualSettingsBtn.removeEventListener('click', openSettings); // Prevent duplicates
        actualSettingsBtn.addEventListener('click', openSettings);
    }

    // Modal Close Buttons
    if (closeControlsBtn) closeControlsBtn.addEventListener('click', closeSettings);
    if (closeControlsTop) closeControlsTop.addEventListener('click', closeSettings);

    // Click outside to close (Modal Backdrop)
    if (settingsModal) {
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) closeSettings(e);
        });
    }

    // ECG ℹ️ → open ECG reference modal
    const showInfoBtn = document.getElementById('show-info-btn');
    const infoModal = document.getElementById('info-modal');
    const closeEcgModal = infoModal ? infoModal.querySelector('.close-modal') : null;

    if (showInfoBtn && infoModal) {
        showInfoBtn.addEventListener('click', () => {
            infoModal.classList.remove('hidden');
            drawReferenceModal();
        });
    }
    if (closeEcgModal) {
        closeEcgModal.addEventListener('click', () => infoModal.classList.add('hidden'));
        infoModal.addEventListener('click', (e) => { if (e.target === infoModal) infoModal.classList.add('hidden'); });
    }

    // Pleth ℹ️ → open Pleth reference modal
    const showPlethBtn = document.getElementById('show-pleth-info-btn');
    const plethModal = document.getElementById('pleth-modal');
    const closePlethBtn = document.getElementById('close-pleth-modal');

    if (showPlethBtn && plethModal) {
        showPlethBtn.addEventListener('click', () => {
            plethModal.classList.remove('hidden');
            drawPlethReference();
        });
    }
    if (closePlethBtn && plethModal) {
        closePlethBtn.addEventListener('click', () => plethModal.classList.add('hidden'));
        plethModal.addEventListener('click', (e) => { if (e.target === plethModal) plethModal.classList.add('hidden'); });
    }

    // SpO2 ℹ️ → open SpO2 reference modal
    const showSpo2Btn = document.getElementById('show-spo2-info-btn');
    const spo2Modal = document.getElementById('spo2-modal');
    const closeSpo2Btn = document.getElementById('close-spo2-modal');

    if (showSpo2Btn && spo2Modal) {
        showSpo2Btn.addEventListener('click', () => {
            spo2Modal.classList.remove('hidden');
            drawSpo2Reference();
        });
    }
    if (closeSpo2Btn && spo2Modal) {
        closeSpo2Btn.addEventListener('click', () => spo2Modal.classList.add('hidden'));
        spo2Modal.addEventListener('click', (e) => { if (e.target === spo2Modal) spo2Modal.classList.add('hidden'); });
    }

    // HR ℹ️ → open HR reference modal
    const showHrBtn = document.getElementById('show-hr-info-btn');
    const hrModal = document.getElementById('hr-modal');
    const closeHrBtn = document.getElementById('close-hr-modal');

    if (showHrBtn && hrModal) {
        showHrBtn.addEventListener('click', () => {
            hrModal.classList.remove('hidden');
            drawHrReference();
        });
    }
    if (closeHrBtn && hrModal) {
        closeHrBtn.addEventListener('click', () => hrModal.classList.add('hidden'));
        hrModal.addEventListener('click', (e) => { if (e.target === hrModal) hrModal.classList.add('hidden'); });
    }

    // BP ℹ️ → open BP reference modal
    const showBpBtn = document.getElementById('show-bp-info-btn');
    const bpModal = document.getElementById('bp-modal');
    const closeBpBtn = document.getElementById('close-bp-modal');

    if (showBpBtn && bpModal) {
        showBpBtn.addEventListener('click', () => {
            bpModal.classList.remove('hidden');
            drawBpReference();
        });
    }
    if (closeBpBtn && bpModal) {
        closeBpBtn.addEventListener('click', () => bpModal.classList.add('hidden'));
        bpModal.addEventListener('click', (e) => { if (e.target === bpModal) bpModal.classList.add('hidden'); });
    }

    // Temperature ℹ️ → open Temperature reference modal
    const showTempBtn = document.getElementById('show-temp-info-btn');
    const tempModal = document.getElementById('temp-modal');
    const closeTempBtn = document.getElementById('close-temp-modal');

    if (showTempBtn && tempModal) {
        showTempBtn.addEventListener('click', () => {
            tempModal.classList.remove('hidden');
        });
    }
    if (closeTempBtn && tempModal) {
        closeTempBtn.addEventListener('click', () => tempModal.classList.add('hidden'));
        tempModal.addEventListener('click', (e) => { if (e.target === tempModal) tempModal.classList.add('hidden'); });
    }

    // --- Tiered Alarm System (Phase 7) ---
    const alarmsBtn = document.getElementById('btn-alarms');
    const alarmModal = document.getElementById('alarm-modal');
    const alarmLogEl = document.getElementById('alarm-log');
    const silenceBtn = document.getElementById('alarm-silence-btn');
    const suspendBtn = document.getElementById('alarm-suspend-btn');
    const alarmLevelIndicator = document.getElementById('alarm-level-indicator');
    let lastAlarmHash = ''; // dedup hash to avoid log spam

    function getAlarmLevel() {
        const T = state.alarmThresholds;
        const hr = state.hrCurrent || state.hrTarget;
        const spo2 = state.spo2Current || state.spo2Target;
        const sys = parseInt(sysValue.innerText) || state.sys;
        const dia = parseInt(diaValue.innerText) || state.dia;
        const rr = state.rrCurrent || state.rrTarget;
        const temp = state.tempCurrent || state.tempTarget;
        const gcs = state.gcsTotal;
        const pain = state.painScore;

        let maxLevel = 'none';

        const checks = [
            { vital: 'HR', val: hr, high: T.hrHigh, low: T.hrLow },
            { vital: 'SpO₂', val: spo2, low: T.spo2Low },
            { vital: 'RR', val: rr, high: T.rrHigh, low: T.rrLow },
            { vital: 'SYS', val: sys, high: T.sysHigh, low: T.sysLow },
            { vital: 'DIA', val: dia, high: T.diaHigh, low: T.diaLow },
            { vital: 'Temp', val: temp, high: T.tempHigh, low: T.tempLow },
            { vital: 'GCS', val: gcs, low: T.gcsLow },
            { vital: 'Pain', val: pain, high: T.painHigh }
        ];

        for (const c of checks) {
            if (c.high && c.val > c.high.crisis) { maxLevel = 'crisis'; continue; }
            if (c.high && c.val > c.high.warning && maxLevel !== 'crisis') { maxLevel = 'warning'; continue; }
            if (c.high && c.val > c.high.advisory && maxLevel === 'none') { maxLevel = 'advisory'; continue; }

            if (c.low && c.val !== undefined && c.val < c.low.crisis) { maxLevel = 'crisis'; continue; }
            if (c.low && c.val !== undefined && c.val < c.low.warning && maxLevel !== 'crisis') { maxLevel = 'warning'; continue; }
            if (c.low && c.val !== undefined && c.val < c.low.advisory && maxLevel === 'none') { maxLevel = 'advisory'; continue; }
        }

        return maxLevel;
    }

    function addAlarmLogEntry(level, vital, value, threshold) {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const entry = { time: timeStr, level, vital, value, threshold, msg: `${vital} ${value} (threshold: ${threshold})` };
        state.alarmHistory.unshift(entry);
        if (state.alarmHistory.length > 50) state.alarmHistory.length = 50;
        renderAlarmLog();
    }

    function renderAlarmLog() {
        if (!alarmLogEl) return;
        alarmLogEl.innerHTML = state.alarmHistory.map(e => `
            <div class="alarm-log-entry alarm-log-${e.level}">
                <span class="alarm-log-time">${e.time}</span>
                <span class="alarm-log-level">${e.level.toUpperCase()}</span>
                <span class="alarm-log-msg">${e.msg}</span>
            </div>
        `).join('');
    }

    function updateAlarmUI(level) {
        if (!alarmsBtn) return;

        // Remove existing level classes
        alarmsBtn.classList.remove('alarm-crisis', 'alarm-warning', 'alarm-advisory', 'alarm-active');

        const now = Date.now();
        if (state.alarmSuspendedUntil > now) return; // fully suspended
        if (state.alarmSilencedUntil > now) {
            // Visual only — no pulsing
            if (level !== 'none') alarmsBtn.classList.add('alarm-active');
            return;
        }

        if (level === 'crisis') {
            alarmsBtn.classList.add('alarm-crisis', 'alarm-active');
        } else if (level === 'warning') {
            alarmsBtn.classList.add('alarm-warning', 'alarm-active');
        } else if (level === 'advisory') {
            alarmsBtn.classList.add('alarm-advisory', 'alarm-active');
        }

        // Update level indicator badge
        if (alarmLevelIndicator) {
            alarmLevelIndicator.textContent = level.toUpperCase();
            alarmLevelIndicator.className = 'alarm-level-' + level;
        }
    }

    function checkAlarms() {
        const now = Date.now();
        if (state.alarmSuspendedUntil > now) return;
        if (state.alarmSilencedUntil > now) {
            updateAlarmUI(state.alarmLevel);
            return;
        }

        const level = getAlarmLevel();
        state.alarmLevel = level;

        // Dedup: log only if level changed or is new alarm
        const hash = level + Object.values(state.alarmThresholds).map(t => t.crisis || t.advisory).join(',');
        if (hash !== lastAlarmHash && level !== 'none') {
            lastAlarmHash = hash;
            const hr = state.hrCurrent || state.hrTarget;
            const spo2 = state.spo2Current || state.spo2Target;
            const sys = parseInt(sysValue.innerText) || state.sys;
            const rr = state.rrCurrent || state.rrTarget;
            const gcs = state.gcsTotal;
            addAlarmLogEntry(level, 'Multi-vital', level === 'crisis' ? 'Critical' : level === 'warning' ? 'Warning' : 'Advisory', '');
        }

        updateAlarmUI(level);

        // --- Dynamic Condition Logic ---
        const statusEl = document.getElementById('patient-status');
        if (statusEl) {
            let status = 'GOOD';
            let statusClass = 'status-good';

            if (level === 'crisis') {
                status = 'CRITICAL';
                statusClass = 'status-critical';
            } else if (level === 'warning') {
                status = 'UNSTABLE';
                statusClass = 'status-warning';
            } else if (level === 'advisory') {
                status = 'GUARDED';
                statusClass = 'status-guarded';
            }

            statusEl.textContent = status;
            statusEl.className = statusClass;
        }
    }

    // Alarm button click: show modal
    alarmsBtn?.addEventListener('click', () => {
        if (alarmModal) {
            alarmModal.classList.remove('hidden');
            renderAlarmLog();
        }
    });

    // Silence (2 min)
    silenceBtn?.addEventListener('click', () => {
        state.alarmSilencedUntil = Date.now() + 120000;
        alarmsBtn.classList.remove('alarm-crisis', 'alarm-warning', 'alarm-advisory', 'alarm-active');
        if (alarmLevelIndicator) {
            alarmLevelIndicator.textContent = 'SILENCED';
            alarmLevelIndicator.className = 'alarm-level-silenced';
        }
    });

    // Suspend (30 min)
    suspendBtn?.addEventListener('click', () => {
        state.alarmSuspendedUntil = Date.now() + 1800000;
        alarmsBtn.classList.remove('alarm-crisis', 'alarm-warning', 'alarm-advisory', 'alarm-active');
        if (alarmLevelIndicator) {
            alarmLevelIndicator.textContent = 'SUSPENDED';
            alarmLevelIndicator.className = 'alarm-level-suspended';
        }
    });

    // Close alarm modal
    const alarmModalClose = document.getElementById('close-alarm-modal');
    alarmModalClose?.addEventListener('click', () => alarmModal?.classList.add('hidden'));
    alarmModal?.addEventListener('click', (e) => { if (e.target === alarmModal) alarmModal.classList.add('hidden'); });

    // Trend modal: open when clicking panels with trend data
    const trendPanels = document.querySelectorAll('[data-trend]');
    trendPanels.forEach(panel => {
        panel.addEventListener('click', () => {
            const vital = panel.dataset.trend;
            openTrendModal(vital);
        });
    });

    // Close trend modal
    const trendModalClose = document.getElementById('close-trend-modal');
    trendModalClose?.addEventListener('click', () => {
        const modal = document.getElementById('trend-modal');
        if (modal) modal.classList.add('hidden');
    });
    document.getElementById('trend-modal')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) e.target.classList.add('hidden');
    });

    // Initial trend draw (will update on next fluctuation)
    drawTrends();

    // --- Teaching Tools (Phase 9) ---

    // Freeze button
    const freezeBtn = document.getElementById('btn-freeze');
    freezeBtn?.addEventListener('click', () => {
        state.isFrozen = !state.isFrozen;
        freezeBtn.classList.toggle('active', state.isFrozen);
        if (!state.isFrozen) {
            // Re-enable normal rendering
            ecgCtx.clearRect(0, 0, ecgCanvas.width, ecgCanvas.height);
            plethCtx.clearRect(0, 0, plethCanvas.width, plethCanvas.height);
            ecgX = 0;
            lastBeatTime = 0;
        }
    });

    // Calipers toggle
    const calipersBtn = document.getElementById('btn-calipers');
    calipersBtn?.addEventListener('click', () => {
        state.showCalipers = !state.showCalipers;
        calipersBtn.classList.toggle('active', state.showCalipers);
        if (!state.showCalipers) {
            const readoutEl = document.getElementById('caliper-readout');
            if (readoutEl) readoutEl.style.display = 'none';
        }
    });

    // Labels toggle
    const labelsBtn = document.getElementById('btn-labels');
    labelsBtn?.addEventListener('click', () => {
        state.showLabels = !state.showLabels;
        labelsBtn.classList.toggle('active', state.showLabels);
    });

    // Export button
    const exportBtn = document.getElementById('btn-export');
    exportBtn?.addEventListener('click', exportCanvasAsPNG);

    // Caliper drag setup
    setupCaliperDrag();

    // Quiz mode toggle
    const quizToggle = document.getElementById('quiz-mode-toggle');
    const revealBtn = document.getElementById('btn-reveal-rhythm');
    const rhythmSelect = document.getElementById('rhythm-control');
    quizToggle?.addEventListener('change', (e) => {
        state.quizMode = e.target.checked;
        if (state.quizMode) {
            if (rhythmSelect) {
                rhythmSelect.disabled = true;
            }
            if (revealBtn) revealBtn.style.display = '';
        } else {
            if (rhythmSelect) {
                rhythmSelect.disabled = false;
            }
            if (revealBtn) revealBtn.style.display = 'none';
        }
    });

    revealBtn?.addEventListener('click', () => {
        const currentRhythm = state.ecgRhythm;
        const nameMap = {
            'NSR': 'Normal Sinus Rhythm',
            'SINUS_ARRHYTHMIA': 'Sinus Arrhythmia',
            'AFIB': 'Atrial Fibrillation',
            'AFLUTTER': 'Atrial Flutter',
            'VTACH': 'Ventricular Tachycardia',
            'VFIB': 'Ventricular Fibrillation',
            'AVB1': '1st Degree AV Block',
            'AVB2': '2nd Degree AV Block (Wenckebach)',
            'AVB3': '3rd Degree AV Block',
            'PVC_BIGEMINY': 'PVC Bigeminy',
            'STEMI': 'STEMI',
            'HYPERK': 'Hyperkalemia'
        };
        revealBtn.textContent = '→ ' + (nameMap[currentRhythm] || currentRhythm) + ' ←';
        revealBtn.style.background = '#22c55e';
        setTimeout(() => {
            revealBtn.textContent = 'Reveal Rhythm';
            revealBtn.style.background = '#22c55e';
        }, 5000);
    });

    // --- Lab Values (Phase 5) ---
    const labBtn = document.getElementById('btn-labs');
    const labModal = document.getElementById('lab-modal');
    labBtn?.addEventListener('click', () => {
        labModal?.classList.remove('hidden');
    });
    document.getElementById('close-lab-modal')?.addEventListener('click', () => labModal?.classList.add('hidden'));
    labModal?.addEventListener('click', (e) => { if (e.target === labModal) labModal.classList.add('hidden'); });

    // Lab slider wiring: each slider id -> state key -> display id
    const labSliders = {
        'lab-ph-ctrl': 'pH',
        'lab-pco2-ctrl': 'pCO2',
        'lab-po2-ctrl': 'pO2',
        'lab-hco3-ctrl': 'HCO3',
        'lab-be-ctrl': 'BE',
        'lab-lactate-ctrl': 'lactate',
        'lab-sodium-ctrl': 'sodium',
        'lab-potassium-ctrl': 'potassium',
        'lab-calcium-ctrl': 'calcium',
        'lab-magnesium-ctrl': 'magnesium',
        'lab-creatinine-ctrl': 'creatinine',
        'lab-bun-ctrl': 'BUN',
        'lab-hemoglobin-ctrl': 'hemoglobin',
        'lab-wbc-ctrl': 'WBC',
        'lab-platelets-ctrl': 'platelets',
        'lab-troponin-ctrl': 'troponin',
        'lab-ntprobnp-ctrl': 'NTproBNP'
    };

    function updateLabDisplay(key, val) {
        const displayId = 'lab-' + key.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
        const el = document.getElementById(displayId);
        if (el) el.innerText = val;
    }

    Object.entries(labSliders).forEach(([sliderId, stateKey]) => {
        const slider = document.getElementById(sliderId);
        if (!slider) return;
        slider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            state.labs[stateKey] = val;
            updateLabDisplay(stateKey, val);

            // K+ link to ECG rhythm
            if (stateKey === 'potassium') {
                if (val >= 6.0 && state.ecgRhythm !== 'HYPERK') {
                    state.ecgRhythm = 'HYPERK';
                    const rhythmSel = document.getElementById('rhythm-control');
                    if (rhythmSel) rhythmSel.value = 'HYPERK';
                    state.beatCounter = 0;
                } else if (val < 5.5 && state.ecgRhythm === 'HYPERK') {
                    state.ecgRhythm = 'NSR';
                    const rhythmSel = document.getElementById('rhythm-control');
                    if (rhythmSel) rhythmSel.value = 'NSR';
                    state.beatCounter = 0;
                }
            }
        });
    });

    // Sync initial lab display
    Object.keys(labSliders).forEach(sliderId => {
        const slider = document.getElementById(sliderId);
        if (slider) {
            // Trigger input event to sync display
            const evt = new Event('input');
            slider.dispatchEvent(evt);
        }
    });

    // --- CO2 & A-line Info Buttons ---
    const showCo2Btn = document.getElementById('show-co2-info-btn');
    const co2Modal = document.getElementById('co2-modal');
    const closeCo2Btn = document.getElementById('close-co2-modal');
    showCo2Btn?.addEventListener('click', () => co2Modal?.classList.remove('hidden'));
    closeCo2Btn?.addEventListener('click', () => co2Modal?.classList.add('hidden'));
    co2Modal?.addEventListener('click', (e) => { if (e.target === co2Modal) co2Modal.classList.add('hidden'); });

    const showAlineBtn = document.getElementById('show-aline-info-btn');
    const alineModal = document.getElementById('aline-modal');
    const closeAlineBtn = document.getElementById('close-aline-modal');
    showAlineBtn?.addEventListener('click', () => alineModal?.classList.remove('hidden'));
    closeAlineBtn?.addEventListener('click', () => alineModal?.classList.add('hidden'));
    alineModal?.addEventListener('click', (e) => { if (e.target === alineModal) alineModal.classList.add('hidden'); });

    // --- Drug Administration (Phase 8) ---
    const drugBtn = document.getElementById('btn-drugs');
    const drugModal = document.getElementById('drug-modal');
    drugBtn?.addEventListener('click', () => {
        drugModal?.classList.remove('hidden');
        updateActiveDrugsDisplay();
        updateDrugDescription();
    });
    document.getElementById('close-drug-modal')?.addEventListener('click', () => drugModal?.classList.add('hidden'));
    drugModal?.addEventListener('click', (e) => { if (e.target === drugModal) drugModal.classList.add('hidden'); });

    const drugSelect = document.getElementById('drug-select');
    const drugDose = document.getElementById('drug-dose');
    const drugDesc = document.getElementById('drug-description');

    function updateDrugDescription() {
        const key = drugSelect?.value;
        const drug = DRUG_LIB[key];
        if (drugDesc && drug) {
            drugDesc.textContent = drug.description + '. Onset: ' + drug.onset + 's, Duration: ' + (drug.duration / 60).toFixed(0) + 'min';
        }
    }
    drugSelect?.addEventListener('change', updateDrugDescription);
    updateDrugDescription();

    function updateActiveDrugsDisplay() {
        const list = document.getElementById('active-drugs-list');
        if (!list) return;
        if (state.activeDrugs.length === 0) {
            list.innerHTML = '<span style="color:var(--page-text-muted);">None</span>';
            return;
        }
        const now = Date.now();
        list.innerHTML = state.activeDrugs.map(ad => {
            const drug = DRUG_LIB[ad.drugKey];
            if (!drug) return '';
            const elapsed = ((now - ad.timeAdministered) / 1000 / 60).toFixed(1);
            return `<div style="display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                <span style="color:#22c55e;">${drug.name}</span>
                <span style="color:var(--page-text-muted);">${elapsed}min ago</span>
            </div>`;
        }).join('');
    }

    document.getElementById('btn-administer-drug')?.addEventListener('click', () => {
        const key = drugSelect?.value;
        const dose = parseFloat(drugDose?.value || '1');
        if (!key || !DRUG_LIB[key]) return;

        state.activeDrugs.push({
            drugKey: key,
            dose: dose,
            timeAdministered: Date.now()
        });

        updateActiveDrugsDisplay();
        // Close modal
        drugModal?.classList.add('hidden');
    });

    // Update active drugs display every 5 seconds
    setInterval(updateActiveDrugsDisplay, 5000);

    // --- Nurse Call Snowflake Effect ---
    const callBtn = document.getElementById('btn-call');
    callBtn?.addEventListener('click', () => {
        const duration = 5000;
        const end = Date.now() + duration;
        const snowflakes = ['❄', '❅', '❆', '•'];

        const interval = setInterval(() => {
            if (Date.now() > end) {
                clearInterval(interval);
                return;
            }

            const snow = document.createElement('div');
            snow.className = 'snowflake';
            snow.innerHTML = snowflakes[Math.floor(Math.random() * snowflakes.length)];

            // Random horizontal position and size
            snow.style.left = Math.random() * 100 + 'vw';
            snow.style.fontSize = (0.5 + Math.random() * 1.5) + 'rem';
            snow.style.opacity = 0.5 + Math.random() * 0.5;

            // Random duration and horizontal drift
            const fallDuration = 3 + Math.random() * 4;
            snow.style.animationDuration = fallDuration + 's';

            document.body.appendChild(snow);

            // Clean up
            setTimeout(() => snow.remove(), fallDuration * 1000);
        }, 50);
    });

    // Run once on page load so blink starts immediately if vitals are already abnormal
    checkAlarms();

    // --- View Switching Logic ---
    const dashboard = document.querySelector('.dashboard-grid');
    const navBtns = document.querySelectorAll('.bottom-nav .nav-btn');

    function setActiveView(viewClass, btnId) {
        // Reset Grid
        dashboard.className = 'dashboard-grid'; // Remove all view-* classes
        if (viewClass) dashboard.classList.add(viewClass);

        // Reset Buttons
        navBtns.forEach(btn => btn.classList.remove('active'));
        if (btnId) document.getElementById(btnId).classList.add('active');

        // First resize: let CSS layout settle
        setTimeout(resizeCanvases, 50);

        // Second resize + waveform reset: catches newly-visible panels (e.g. Pleth in SpO2 view)
        setTimeout(() => {
            resizeCanvases();
            // Clear both canvases and reset draw state so waveforms restart cleanly
            ecgCtx.clearRect(0, 0, ecgCanvas.width, ecgCanvas.height);
            plethCtx.clearRect(0, 0, plethCanvas.width, plethCanvas.height);
            ecgX = 0;
            lastEcgY = ecgCanvas.height / 2;
            lastPlethY = plethCanvas.height * 0.85;
        }, 150);
    }

    document.getElementById('btn-home').addEventListener('click', () => setActiveView(null, 'btn-home'));
    document.getElementById('btn-ecg').addEventListener('click', () => setActiveView('view-ecg', 'btn-ecg'));
    document.getElementById('btn-spo2').addEventListener('click', () => setActiveView('view-spo2', 'btn-spo2'));
    document.getElementById('btn-bp').addEventListener('click', () => setActiveView('view-bp', 'btn-bp'));
    document.getElementById('btn-records').addEventListener('click', () => setActiveView('view-records', 'btn-records'));

    // --- Ventilator controls ---
    const ventModal = document.getElementById('vent-modal');
    document.getElementById('btn-vent')?.addEventListener('click', () => ventModal?.classList.remove('hidden'));
    document.getElementById('btn-open-vent')?.addEventListener('click', () => ventModal?.classList.remove('hidden'));
    document.getElementById('close-vent-modal')?.addEventListener('click', () => ventModal?.classList.add('hidden'));
    document.getElementById('close-vent')?.addEventListener('click', () => ventModal?.classList.add('hidden'));
    ventModal?.addEventListener('click', (e) => { if (e.target === ventModal) ventModal.classList.add('hidden'); });

    function updateVentDisplay() {
        const v = state.ventSettings;
        const modeEl = document.getElementById('vent-mode-display');
        const fio2El = document.getElementById('vent-fio2-display');
        const peepEl = document.getElementById('vent-peep-display');
        const tvEl = document.getElementById('vent-tv-display');
        const rrEl = document.getElementById('vent-rr-display');
        if (modeEl) modeEl.textContent = v.mode;
        if (fio2El) fio2El.textContent = v.fio2 + '%';
        if (peepEl) peepEl.textContent = v.peep;
        if (tvEl) tvEl.textContent = v.tv;
        if (rrEl) rrEl.textContent = v.rr;
    }

    // Vent sliders
    ['fio2','peep','tv'].forEach(key => {
        const ctrl = document.getElementById('vent-' + key + '-ctrl');
        const display = document.getElementById('vent-' + key);
        ctrl?.addEventListener('input', () => {
            const val = key === 'fio2' ? parseInt(ctrl.value) : parseFloat(ctrl.value);
            state.ventSettings[key] = val;
            if (display) display.textContent = val + (key === 'fio2' ? '%' : '');
            updateVentDisplay();
        });
    });
    // Vent RR slider (uses vent-rr-setting display)
    const ventRRCtrl = document.getElementById('vent-rr-ctrl');
    const ventRRDisplay = document.getElementById('vent-rr-setting');
    ventRRCtrl?.addEventListener('input', () => {
        state.ventSettings.rr = parseFloat(ventRRCtrl.value);
        if (ventRRDisplay) ventRRDisplay.textContent = ventRRCtrl.value;
        updateVentDisplay();
    });
    // Vent mode select
    const modeCtrl = document.getElementById('vent-mode-ctrl');
    modeCtrl?.addEventListener('change', () => {
        state.ventSettings.mode = modeCtrl.value;
        updateVentDisplay();
    });

    // --- ICU Board modal ---
    const icuboardModal = document.getElementById('icuboard-modal');
    document.getElementById('btn-icuboard')?.addEventListener('click', () => {
        icuboardModal?.classList.remove('hidden');
        resizeCanvases();
        updateICUBoard();
    });
    document.getElementById('close-icuboard-modal')?.addEventListener('click', () => icuboardModal?.classList.add('hidden'));
    icuboardModal?.addEventListener('click', (e) => { if (e.target === icuboardModal) icuboardModal.classList.add('hidden'); });

    function updateICUBoard() {
        const ids = { 'icu-hr': state.hrCurrent, 'icu-bp': parseInt(sysValue.innerText) + '/' + parseInt(diaValue.innerText),
            'icu-map': Math.round(parseInt(diaValue.innerText) * 2/3 + parseInt(sysValue.innerText) * 1/3),
            'icu-spo2': state.spo2Current, 'icu-etco2': Math.round(state.etco2Current), 'icu-rr': state.rrCurrent,
            'icu-temp': formatTemp(state.tempCurrent) };
        for (const [id, val] of Object.entries(ids)) {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        }
    }
    setInterval(updateICUBoard, 2000);

    function triggerManualOverride() {
        if (!state.isManualMode) {
            state.isManualMode = true;
            const modeSelect = document.getElementById('sim-mode');
            if (modeSelect) modeSelect.value = 'manual';
            console.log("Manual Override activated via user input.");
        }
    }

    hrControl.addEventListener('input', (e) => {
        triggerManualOverride();
        const val = parseInt(e.target.value);
        state.hrTarget = val;
        hrDisplay.innerText = val;
        hrValue.innerText = val;
        checkAlarms();
    });

    spo2Control.addEventListener('input', (e) => {
        triggerManualOverride();
        const val = parseInt(e.target.value);
        state.spo2Target = val;
        spo2Display.innerText = val;
        spo2Value.innerText = val;
        checkAlarms();
    });

    rrControl?.addEventListener('input', (e) => {
        triggerManualOverride();
        const val = parseInt(e.target.value);
        state.rrTarget = val;
        state.rrCurrent = val;
        if (rrDisplay) rrDisplay.innerText = val;
        const rrValueEl = document.getElementById('rr-value');
        if (rrValueEl) rrValueEl.innerText = val;
        checkAlarms();
    });

    sysControl.addEventListener('input', (e) => {
        triggerManualOverride();
        state.sys = parseInt(e.target.value);
        sysDisplay.innerText = state.sys;
        sysValue.innerText = state.sys;
        checkAlarms();
    });

    diaControl.addEventListener('input', (e) => {
        triggerManualOverride();
        state.dia = parseInt(e.target.value);
        diaDisplay.innerText = state.dia;
        diaValue.innerText = state.dia;
        checkAlarms();
    });

    // ECG Controls
    const prControl = document.getElementById('pr-control');
    const prDisplay = document.getElementById('pr-display');
    prControl.addEventListener('input', (e) => {
        state.ecgPR = parseInt(e.target.value);
        prDisplay.innerText = state.ecgPR;
    });

    const qrsControl = document.getElementById('qrs-control');
    const qrsDisplay = document.getElementById('qrs-display');
    qrsControl.addEventListener('input', (e) => {
        state.ecgQRS = parseInt(e.target.value);
        qrsDisplay.innerText = state.ecgQRS;
    });

    const stControl = document.getElementById('st-control');
    const stDisplay = document.getElementById('st-display');
    stControl.addEventListener('input', (e) => {
        state.ecgST = parseFloat(e.target.value);
        stDisplay.innerText = state.ecgST.toFixed(2);
    });

    const ampControl = document.getElementById('amp-control');
    const ampDisplay = document.getElementById('amp-display');
    ampControl.addEventListener('input', (e) => {
        state.ecgAmp = parseFloat(e.target.value);
        ampDisplay.innerText = state.ecgAmp.toFixed(1);
    });

    const noiseControl = document.getElementById('noise-control');
    const noiseDisplay = document.getElementById('noise-display');
    noiseControl.addEventListener('input', (e) => {
        state.ecgNoise = parseInt(e.target.value);
        noiseDisplay.innerText = state.ecgNoise > 10 ? 'High' : 'Low';
    });

    // Temperature Controls
    tempControl?.addEventListener('input', (e) => {
        triggerManualOverride();
        const val = parseFloat(e.target.value);
        if (state.tempUnit === 'F') {
            state.tempTarget = (val - 32) * 5 / 9;
        } else {
            state.tempTarget = val;
        }
        tempDisplay.innerText = val.toFixed(1);
        tempValue.innerText = val.toFixed(1);
        alarmsAcknowledged = false;
        checkAlarms();
    });

    tempUnitControl?.addEventListener('change', (e) => {
        state.tempUnit = e.target.value;
        updateUIFromState();
    });

    tempSiteControl?.addEventListener('change', (e) => {
        const site = e.target.value;
        state.tempSite = site;
        if (tempSiteValue) tempSiteValue.innerText = site.toUpperCase();
        if (tempRangeValue) tempRangeValue.innerText = formatRange(siteRanges[site]);
    });

    // GCS Controls
    const gcsEyeControl = document.getElementById('gcs-eye-control');
    const gcsVerbalControl = document.getElementById('gcs-verbal-control');
    const gcsMotorControl = document.getElementById('gcs-motor-control');
    const gcsEyeDisplay = document.getElementById('gcs-eye-display');
    const gcsVerbalDisplay = document.getElementById('gcs-verbal-display');
    const gcsMotorDisplay = document.getElementById('gcs-motor-display');
    const gcsTotalDisplay = document.getElementById('gcs-total-display');

    function updateGCS() {
        state.gcsEye = parseInt(gcsEyeControl?.value) || 4;
        state.gcsVerbal = parseInt(gcsVerbalControl?.value) || 5;
        state.gcsMotor = parseInt(gcsMotorControl?.value) || 6;
        state.gcsTotal = state.gcsEye + state.gcsVerbal + state.gcsMotor;
        if (gcsEyeDisplay) gcsEyeDisplay.innerText = state.gcsEye;
        if (gcsVerbalDisplay) gcsVerbalDisplay.innerText = state.gcsVerbal;
        if (gcsMotorDisplay) gcsMotorDisplay.innerText = state.gcsMotor;
        if (gcsTotalDisplay) gcsTotalDisplay.innerText = state.gcsTotal;
        updateScoreDisplay();
        checkAlarms();
    }

    gcsEyeControl?.addEventListener('input', (e) => { triggerManualOverride(); updateGCS(); });
    gcsVerbalControl?.addEventListener('input', (e) => { triggerManualOverride(); updateGCS(); });
    gcsMotorControl?.addEventListener('input', (e) => { triggerManualOverride(); updateGCS(); });

    // Pain Control
    const painControl = document.getElementById('pain-control');
    const painScoreDisplay = document.getElementById('pain-score-display');
    painControl?.addEventListener('input', (e) => {
        triggerManualOverride();
        state.painScore = parseInt(e.target.value);
        if (painScoreDisplay) painScoreDisplay.innerText = state.painScore;
        updateScoreDisplay();
        checkAlarms();
    });

    // Oxygen Checkbox (for NEWS2)
    const oxygenCheckbox = document.getElementById('oxygen-checkbox');
    oxygenCheckbox?.addEventListener('change', (e) => {
        state.onOxygen = e.target.checked;
        updateScoreDisplay();
    });

    // Rhythm Selector
    const rhythmControl = document.getElementById('rhythm-control');
    rhythmControl?.addEventListener('change', (e) => {
        triggerManualOverride();
        state.ecgRhythm = e.target.value;
        state.beatCounter = 0;
        state.droppedBeats = 0;
        // Reset ECG canvas for clean transition
        ecgCtx.clearRect(0, 0, ecgCanvas.width, ecgCanvas.height);
        plethCtx.clearRect(0, 0, plethCanvas.width, plethCanvas.height);
        ecgX = 0;
        lastBeatTime = 0;
    });

    // Lead Selector
    const leadControl = document.getElementById('lead-control');
    leadControl?.addEventListener('change', (e) => {
        state.ecgLead = e.target.value;
        const leadLabel = document.getElementById('ecg-lead-label');
        if (leadLabel) leadLabel.textContent = 'LEAD ' + e.target.value;
        ecgCtx.clearRect(0, 0, ecgCanvas.width, ecgCanvas.height);
        ecgX = 0;
    });

    // Scenario Selector
    const scenarioControl = document.getElementById('scenario-control');
    scenarioControl?.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val && scenarios[val]) {
            state.activeScenario = val;
            state.isManualMode = false;
            const modeSelect = document.getElementById('sim-mode');
            if (modeSelect) modeSelect.value = 'timeline';
            scenarioStartTime = performance.now();
            // Apply initial event immediately
            if (scenarios[val].events && scenarios[val].events.length > 0) {
                const initEvt = scenarios[val].events[0];
                state.hrTarget = initEvt.hr || state.hrTarget;
                state.spo2Target = initEvt.spo2 || state.spo2Target;
                state.sys = initEvt.sys || state.sys;
                state.dia = initEvt.dia || state.dia;
                state.tempTarget = initEvt.temp || state.tempTarget;
                state.ecgRhythm = initEvt.rhythm || 'NSR';
                if (initEvt.rr) state.rrTarget = initEvt.rr;
                if (initEvt.gcs !== undefined) {
                    state.gcsTotal = initEvt.gcs;
                    let remainder = state.gcsTotal;
                    state.gcsMotor = Math.min(6, Math.max(1, Math.floor(remainder / 3)));
                    remainder -= state.gcsMotor;
                    state.gcsVerbal = Math.min(5, Math.max(1, Math.floor(remainder / 2)));
                    remainder -= state.gcsVerbal;
                    state.gcsEye = Math.min(4, Math.max(1, remainder));
                }
                if (initEvt.pain !== undefined) state.painScore = initEvt.pain;
                if (initEvt.onO2 !== undefined) state.onOxygen = initEvt.onO2;
                // Apply initial lab values
                if (initEvt.labs) {
                    Object.keys(initEvt.labs).forEach(key => {
                        if (state.labs[key] !== undefined) state.labs[key] = initEvt.labs[key];
                    });
                }
                updateUIFromState();
                if (initEvt.narrative) {
                    const narrativeEl = document.getElementById('scenario-narrative');
                    const narrativeItem = document.getElementById('scenario-narrative-item');
                    if (narrativeEl) narrativeEl.textContent = initEvt.narrative;
                    if (narrativeItem) narrativeItem.style.display = '';
                }
            }
            // Reset canvases
            ecgCtx.clearRect(0, 0, ecgCanvas.width, ecgCanvas.height);
            plethCtx.clearRect(0, 0, plethCanvas.width, plethCanvas.height);
            ecgX = 0;
            lastBeatTime = 0;
            startTime = performance.now();
        } else {
            state.activeScenario = null;
            const narrativeItem = document.getElementById('scenario-narrative-item');
            if (narrativeItem) narrativeItem.style.display = 'none';
        }
    });

    // Mode Selector Logic
    const simModeSelect = document.getElementById('sim-mode');
    simModeSelect?.addEventListener('change', (e) => {
        state.isManualMode = (e.target.value === 'manual');
        if (!state.isManualMode) {
            // Reset start time so timeline resumes smoothly or restarts
            startTime = performance.now();
        }
    });

    // --- Accordion Logic (Exclusive Behavior) ---
    const accHeaders = document.querySelectorAll('.accordion-header');
    accHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const isActive = header.classList.contains('active');

            // 1. Close all first
            accHeaders.forEach(h => {
                h.classList.remove('active');
                h.nextElementSibling.classList.remove('active');
            });

            // 2. If it wasn't active, open it now
            if (!isActive) {
                header.classList.add('active');
                header.nextElementSibling.classList.add('active');
            }
        });
    });

    // --- Alarm Threshold Sliders ---
    function initThresholdSlider(id, stateKey, subKey) {
        const el = document.getElementById(id);
        const display = document.getElementById(id.replace('-ctrl', ''));
        el?.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            state.alarmThresholds[stateKey][subKey] = val;
            if (display) display.innerText = val;
            checkAlarms();
        });
    }
    initThresholdSlider('th-hr-low-crisis-ctrl', 'hrLow', 'crisis');
    initThresholdSlider('th-hr-high-crisis-ctrl', 'hrHigh', 'crisis');
    initThresholdSlider('th-spo2-low-crisis-ctrl', 'spo2Low', 'crisis');
    initThresholdSlider('th-rr-low-crisis-ctrl', 'rrLow', 'crisis');
    initThresholdSlider('th-rr-high-crisis-ctrl', 'rrHigh', 'crisis');
    initThresholdSlider('th-sys-high-crisis-ctrl', 'sysHigh', 'crisis');
    initThresholdSlider('th-sys-low-crisis-ctrl', 'sysLow', 'crisis');
    initThresholdSlider('th-gcs-low-crisis-ctrl', 'gcsLow', 'crisis');

    // --- Professional Scale Physics ---
    /**
     * Calibrates the visual "ruler" background for each clinical parameter.
     * Calculates the exact percentage spacing for 5-unit (major) and 1-unit (minor) ticks
     * based on the specific range (min/max) of each control.
     */
    function setupClinicalScales() {
        const controls = document.querySelectorAll('.control-group input[type="range"]');
        controls.forEach(control => {
            const min = parseFloat(control.min);
            const max = parseFloat(control.max);
            const range = max - min;

            if (range > 0) {
                // Major ticks every 5 units
                const majorTickPercent = (5 / range) * 100;
                // Minor ticks every 1 unit
                const minorTickPercent = (1 / range) * 100;

                control.style.setProperty('--major-tick', `${majorTickPercent}%`);
                control.style.setProperty('--minor-tick', `${minorTickPercent}%`);
            }
        });
    }

    // Initialize scales on load
    setupClinicalScales();

    // --- Social Interactions & Stats Logic (localStorage persistence) ---
    const likeBtn = document.getElementById('btn-like');
    const dislikeBtn = document.getElementById('btn-dislike');
    const likeCountEl = document.getElementById('like-count');
    const dislikeCountEl = document.getElementById('dislike-count');
    const visitorEl = document.getElementById('visitor-count');

    function getLocalStats() {
        try {
            const raw = localStorage.getItem('healthsim_stats');
            if (raw) return JSON.parse(raw);
        } catch (_) { }
        return { likes: 0, dislikes: 0, visitorCount: 1248 };
    }

    function saveLocalStats(data) {
        try { localStorage.setItem('healthsim_stats', JSON.stringify(data)); } catch (_) { }
    }

    function updateStatsUI() {
        const data = getLocalStats();
        if (likeCountEl) likeCountEl.textContent = (data.likes || 0).toLocaleString();
        if (dislikeCountEl) dislikeCountEl.textContent = (data.dislikes || 0).toLocaleString();
        if (visitorEl) visitorEl.textContent = (data.visitorCount || 0).toLocaleString();

        // visitor count drift
        let count = data.visitorCount;
        setInterval(() => {
            if (Math.random() > 0.85) {
                count += Math.floor(Math.random() * 2);
                const d = getLocalStats();
                d.visitorCount = count;
                saveLocalStats(d);
                if (visitorEl) visitorEl.textContent = count.toLocaleString();
            }
        }, 25000);
    }

    function handleAction(action) {
        const data = getLocalStats();
        if (action === 'like') data.likes++;
        else if (action === 'dislike') data.dislikes++;
        saveLocalStats(data);
        if (likeCountEl) likeCountEl.textContent = (data.likes || 0).toLocaleString();
        if (dislikeCountEl) dislikeCountEl.textContent = (data.dislikes || 0).toLocaleString();
    }

    likeBtn?.addEventListener('click', () => handleAction('like'));
    dislikeBtn?.addEventListener('click', () => handleAction('dislike'));

    updateStatsUI();
});
