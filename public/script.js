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
        tempTarget: 36.8,    // Target Body Temperature (stored in Celsius)
        tempCurrent: 36.8,   // Current Temperature (with drift)
        tempSite: 'Oral',    // Measurement site designation
        tempUnit: 'C',       // Active unit ('C' or 'F')
        ecgSpeed: 3,         // Waveform sweep speed (pixels per frame)
        lastFluctuation: 0,  // Timestamp of last natural vital drift
        isManualMode: false  // If true, ignore timeline data
    };

    // --- Timeline Simulation Logic ---
    let timelineData = [];
    let startTime = 0;
    let lastBeatTime = 0;

    // --- Graph Draw State ---
    let ecgX = 0;
    let lastEcgY = 0;
    let lastPlethY = 0;
    let noiseOffset = 0;

    // DOM Elements
    const hrValue = document.getElementById('hr-value');
    const spo2Value = document.getElementById('spo2-value');
    const sysValue = document.getElementById('bp-sys');
    const diaValue = document.getElementById('bp-dia');

    // Control Panel Elements
    const settingsBtn = document.getElementById('toggle-controls');
    const controlsPanel = document.getElementById('controls-panel');
    const closeControlsBtn = document.getElementById('close-controls');

    const hrControl = document.getElementById('hr-control');
    const sysControl = document.getElementById('sys-control');
    const diaControl = document.getElementById('dia-control');
    const spo2Control = document.getElementById('spo2-control');

    const hrDisplay = document.getElementById('hr-display');
    const sysDisplay = document.getElementById('sys-display');
    const diaDisplay = document.getElementById('dia-display');
    const spo2Display = document.getElementById('spo2-display');
    const tempDisplay = document.getElementById('temp-display');

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
            const data = await response.json();

            // 1. Update Patient Information Header
            document.querySelector('.name').innerHTML = `${data.patient.lastName.toUpperCase()}, ${data.patient.firstName.toUpperCase()} <span class="gender">(${data.patient.gender})</span>`;
            document.querySelector('.id').textContent = `Patient ID: ${data.patient.id}`;
            document.querySelector('.room').textContent = data.patient.room;

            // 2. Load Simulation Timeline (Sequential vital sign changes over time)
            if (data.simulation && data.simulation.timeline) {
                timelineData = data.simulation.timeline;
                console.log(`Loaded ${timelineData.length} timeline points.`);
            }

            // 3. Set Initial State
            const initial = timelineData.length > 0 ? timelineData[0] : (data.simulation.baseVitals || {});

            if (initial.hr) {
                state.hrTarget = initial.hr;
                state.spo2Target = initial.spo2;
                state.sys = initial.sys;
                state.dia = initial.dia;

                // Sync UI
                updateUIFromState();
            }

        } catch (error) {
            console.error('Error loading simulation data:', error);
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

        state.hrCurrent = state.hrTarget;
        state.spo2Current = state.spo2Target;
        state.tempCurrent = state.tempTarget;

        hrValue.innerText = state.hrTarget;
        spo2Value.innerText = state.spo2Target;
        sysValue.innerText = state.sys;
        diaValue.innerText = state.dia;

        if (tempValue) tempValue.innerText = formatTemp(state.tempTarget);
        if (tempUnitLabel) tempUnitLabel.innerText = `°${state.tempUnit}`;
        if (tempRangeValue) tempRangeValue.innerText = formatRange(siteRanges[state.tempSite]);
    }

    loadData();

    // --- Canvas Setup ---
    const ecgCanvas = document.getElementById('ecgCanvas');
    const plethCanvas = document.getElementById('plethCanvas');
    const ecgCtx = ecgCanvas.getContext('2d');
    const plethCtx = plethCanvas.getContext('2d');

    function resizeCanvases() {
        const ecgParent = ecgCanvas.parentElement;
        const plethParent = plethCanvas.parentElement;

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
    }

    window.addEventListener('resize', resizeCanvases);
    resizeCanvases();

    /**
     * ECG Waveform Generator (Lead II Equivalent)
     * Synthesizes a cardiac cycle using a sum-of-Gaussians model.
     * @param {number} t_ms - Time in milliseconds since the start of the current beat.
     * @returns {number} Y-offset for the waveform at that time.
     */
    function getEcgSignal(t_ms) {
        // Standard Lead II Parameters (approx)
        const amp = state.ecgAmp || 1.0;

        // P-Wave
        const p_amp = 0.15;
        const p_width = 40;
        const p_center = 80;

        // QRS Complex
        const pr_val = state.ecgPR || 160;
        const qrs_val = state.ecgQRS || 80;

        const q_center = pr_val + 20;
        const r_center = q_center + (qrs_val * 0.4);
        const s_center = q_center + (qrs_val * 0.8);

        const q_amp = -0.15 * amp;
        const r_amp = 1.0 * amp;
        const s_amp = -0.25 * amp;

        // T-Wave
        const t_center = q_center + 280;
        const t_amp = (0.3 + (state.ecgST || 0)) * amp;

        // U-Wave
        const u_center = t_center + 150;
        const u_amp = 0.05 * amp;

        let signal = 0;

        // P
        signal += p_amp * Math.exp(-Math.pow(t_ms - p_center, 2) / (2 * Math.pow(p_width / 3, 2)));

        // Q
        signal += q_amp * Math.exp(-Math.pow(t_ms - q_center, 2) / (2 * Math.pow(qrs_val / 10, 2)));

        // R
        signal += r_amp * Math.exp(-Math.pow(t_ms - r_center, 2) / (2 * Math.pow(qrs_val / 10, 2)));

        // S
        signal += s_amp * Math.exp(-Math.pow(t_ms - s_center, 2) / (2 * Math.pow(qrs_val / 10, 2)));

        // ST Segment Elevation (shift baseline between S and T)
        if (t_ms > s_center && t_ms < t_center) {
            const st_dur = t_center - s_center;
            // Broad Gaussian for ST elevation
            signal += (state.ecgST || 0) * amp * Math.exp(-Math.pow(t_ms - (s_center + t_center) / 2, 2) / (2 * Math.pow(st_dur / 2, 2)));
        }

        // T
        signal += t_amp * Math.exp(-Math.pow(t_ms - t_center, 2) / (2 * Math.pow(60, 2)));

        // U
        signal += u_amp * Math.exp(-Math.pow(t_ms - u_center, 2) / (2 * Math.pow(30, 2)));

        return signal * -80; // Scale for canvas
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
            ctx.font = 'bold 13px monospace';
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
            ctx.font = 'bold 11px monospace';
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

            ctx.font = 'bold 12px monospace';
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
            ctx.font = 'bold 11px monospace';
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
        ctx.fillStyle = '#4ade80'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'left';
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
        ctx.font = '10px monospace';
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
        ctx.font = 'bold 13px monospace';
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
            ctx.font = '9px monospace'; ctx.textAlign = 'center';
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
            ctx.font = 'bold 9px monospace';
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
        ctx.font = 'bold 12px monospace';
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
        ctx.font = '9px monospace'; ctx.textAlign = 'center';
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
        ctx.font = '9px monospace'; ctx.textAlign = 'right';
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
        ctx.font = 'bold 12px monospace';
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
        // 1. Update Targets from Timeline (if enabled)
        if (timelineData.length > 0 && !state.isManualMode) {
            const elapsedMinutes = (timestamp - startTime) / 60000;
            // Map timeline data to 5-second intervals
            let idx = Math.floor(elapsedMinutes * 12);

            if (idx >= 0 && idx < timelineData.length) {
                const point = timelineData[idx];
                state.hrTarget = point.hr;
                state.spo2Target = point.spo2;
                state.sys = point.sys;
                state.dia = point.dia;

                // Sync Target Sliders (if not being manually adjusted)
                if (document.activeElement !== hrControl) hrControl.value = state.hrTarget;
                if (document.activeElement !== spo2Control) spo2Control.value = state.spo2Target;
                if (document.activeElement !== sysControl) sysControl.value = state.sys;
                if (document.activeElement !== diaControl) diaControl.value = state.dia;
            } else if (idx >= timelineData.length) {
                startTime = timestamp; // Loop timeline
            }
        }

        // 2. Cardiac Beat Timing & Natural Fluctuation
        const beatDuration = 60000 / state.hrTarget;
        let timeSinceBeat = timestamp - lastBeatTime;

        if (timeSinceBeat > beatDuration) {
            lastBeatTime = timestamp - (timeSinceBeat % beatDuration);

            // Introduce subtle physiological drift every 2 seconds
            if (timestamp - state.lastFluctuation > 2000) {
                state.lastFluctuation = timestamp;

                // HR Fluctuation
                const hrDrift = Math.floor(Math.random() * 5) - 2;
                state.hrCurrent = state.hrTarget + hrDrift;
                hrValue.innerText = state.hrCurrent;

                // SpO2 Fluctuation
                const spo2Drift = Math.random() > 0.8 ? -1 : (Math.random() > 0.5 ? 1 : 0);
                state.spo2Current = Math.min(100, state.spo2Target + spo2Drift);
                spo2Value.innerText = state.spo2Current;

                // BP natural fluctuation with Pulse Pressure safety
                const sysDrift = Math.floor(Math.random() * 5) - 2;
                const diaDrift = Math.floor(Math.random() * 3) - 1;
                let simulatedSys = state.sys + sysDrift;
                let simulatedDia = state.dia + diaDrift;
                if (simulatedSys < simulatedDia + 20) simulatedSys = simulatedDia + 20;

                sysValue.innerText = simulatedSys;
                diaValue.innerText = simulatedDia;

                // Temperature physiological drift
                const tempDrift = (Math.random() * 0.2) - 0.1;
                state.tempCurrent = state.tempTarget + tempDrift;
                if (tempValue) tempValue.innerText = formatTemp(state.tempCurrent);

                checkAlarms();
            }
        }

        // 3. Coordinate-Based Waveform Rendering
        const speed = state.ecgSpeed;
        ecgCtx.strokeStyle = '#008f5d'; // Medical Green
        ecgCtx.lineWidth = 2;
        plethCtx.strokeStyle = '#e6ac00'; // Medical Amber/Yellow
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

        // Map mathematical signals to Canvas pixel coordinates
        const ecgCenter = ecgCanvas.height / 2;
        const noiseLevel = (state.ecgNoise !== undefined) ? state.ecgNoise : 2;
        noiseOffset = (Math.random() - 0.5) * noiseLevel;

        const currentEcgY = ecgCenter + getEcgSignal(timeSinceBeat) + noiseOffset;

        const plethPhase = timeSinceBeat / beatDuration;
        const plethBase = plethCanvas.height * 0.85;
        const plethAmp = plethCanvas.height * 0.5;
        const currentPlethY = plethBase - (getPlethSignal(plethPhase) * plethAmp);

        // Vector drawing
        ecgCtx.beginPath();
        if (wrapped) ecgCtx.moveTo(0, currentEcgY);
        else { ecgCtx.moveTo(prevX, lastEcgY); ecgCtx.lineTo(ecgX, currentEcgY); }
        ecgCtx.stroke();

        plethCtx.beginPath();
        if (wrapped) plethCtx.moveTo(0, currentPlethY);
        else { plethCtx.moveTo(prevX, lastPlethY); plethCtx.lineTo(ecgX, currentPlethY); }
        plethCtx.stroke();

        lastEcgY = currentEcgY;
        lastPlethY = currentPlethY;

        requestAnimationFrame(animate);
    }

    // Start Animation
    requestAnimationFrame(animate);

    // --- UI Controls ---
    settingsBtn.addEventListener('click', () => {
        controlsPanel.classList.remove('hidden');
    });

    closeControlsBtn.addEventListener('click', () => {
        controlsPanel.classList.add('hidden');
    });

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

    // --- Alarm System ---
    const alarmsBtn = document.getElementById('btn-alarms');
    let alarmsAcknowledged = false;

    function checkAlarms() {
        // Reset per-check so new out-of-range vitals always re-trigger
        if (alarmsAcknowledged) return;

        const hr = state.hrCurrent || state.hrTarget;
        const spo2 = state.spo2Current || state.spo2Target;
        const sys = parseInt(sysValue.innerText) || state.sys;
        const dia = parseInt(diaValue.innerText) || state.dia;
        const temp = state.tempCurrent || state.tempTarget;

        const isAlarming =
            hr > 100 || hr < 60 ||   // HR tachycardia / bradycardia
            spo2 < 92 ||   // SpO2 below acceptable
            sys >= 130 || sys < 90 ||   // BP elevated / hypo
            dia >= 90 || dia < 60 ||    // Diastolic hypertension / hypo
            temp > 38.0 || temp < 35.0; // Fever / Hypothermia

        if (isAlarming) {
            alarmsBtn?.classList.add('alarm-active');
        } else {
            alarmsBtn?.classList.remove('alarm-active');
        }

        // --- Dynamic Condition Logic ---
        const statusEl = document.getElementById('patient-status');
        if (statusEl) {
            let status = 'GOOD';
            let statusClass = 'status-good';

            // Critical thresholds
            const isCritical = hr > 140 || hr < 40 || spo2 < 85 || sys > 180 || sys < 80 || temp > 40.0 || temp < 34.0;
            // Warning thresholds
            const isWarning = isAlarming;

            if (isCritical) {
                status = 'CRITICAL';
                statusClass = 'status-critical';
            } else if (isWarning) {
                status = 'UNSTABLE';
                statusClass = 'status-warning';
            }

            statusEl.textContent = status;
            statusEl.className = statusClass;
        }
    }

    // Clicking the Alarms button acknowledges + silences blinking
    alarmsBtn?.addEventListener('click', () => {
        alarmsBtn.classList.remove('alarm-active');
        alarmsAcknowledged = true;
        // Re-arm after 30 s so persistent abnormals can re-alert
        setTimeout(() => { alarmsAcknowledged = false; checkAlarms(); }, 30000);
    });

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
    const navBtns = document.querySelectorAll('.nav-btn');

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
        alarmsAcknowledged = false; checkAlarms();
    });

    spo2Control.addEventListener('input', (e) => {
        triggerManualOverride();
        const val = parseInt(e.target.value);
        state.spo2Target = val;
        spo2Display.innerText = val;
        spo2Value.innerText = val;
        alarmsAcknowledged = false; checkAlarms();
    });

    sysControl.addEventListener('input', (e) => {
        triggerManualOverride();
        state.sys = parseInt(e.target.value);
        sysDisplay.innerText = state.sys;
        sysValue.innerText = state.sys;
        alarmsAcknowledged = false; checkAlarms();
    });

    diaControl.addEventListener('input', (e) => {
        triggerManualOverride();
        state.dia = parseInt(e.target.value);
        diaDisplay.innerText = state.dia;
        diaValue.innerText = state.dia;
        alarmsAcknowledged = false; checkAlarms();
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
    const siteRanges = {
        'Oral': '36.1-37.9',
        'Rectal': '36.6-38.4',
        'Axillary': '35.6-37.4',
        'Tympanic': '36.1-37.9',
        'Temporal': '36.1-37.5'
    };

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
});
