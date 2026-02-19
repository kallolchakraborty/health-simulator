import json
import random
import math

def generate_simulation():
    # Configuration
    duration_minutes = 60
    samples_per_minute = 12 # Every 5 seconds
    total_samples = duration_minutes * samples_per_minute

    # Initial Vitals
    hr = 72.0
    spo2 = 98.0
    sys = 120.0
    dia = 80.0

    timeline = []

    # Physiological State Machine
    # We define target states for different times
    # (StartTime, EndTime, TargetHR, TargetSys, TargetDia, TargetSpO2, VariabilityFactor)
    phases = [
        (0, 5, 72, 120, 80, 98, 1.0),    # Baseline
        (5, 15, 95, 135, 85, 97, 2.0),   # Mild Activity / Stress
        (15, 25, 75, 122, 81, 98, 1.0),  # Recovery
        (25, 28, 110, 150, 95, 96, 3.0), # Transient Event (Anxiety/Pain)
        (28, 40, 65, 110, 70, 97, 0.8),  # Settling / Sleep onset
        (40, 55, 58, 105, 65, 95, 0.5),  # Deep Sleep (Low variability)
        (55, 60, 75, 125, 78, 98, 1.5),  # Waking Up
    ]

    current_hr = hr
    current_sys = sys
    current_dia = dia
    current_spo2 = spo2

    # Smooth noise accumulators
    noise_hr = 0
    noise_sys = 0
    noise_dia = 0

    for i in range(total_samples):
        t_min = i / samples_per_minute
        
        # 1. Determine Target State based on Phase
        target_hr, target_sys, target_dia, target_spo2, var_factor = (72, 120, 80, 98, 1.0) # Default
        
        for p in phases:
            if p[0] <= t_min < p[1]:
                target_hr, target_sys, target_dia, target_spo2, var_factor = p[2:]
                break
        
        # 2. Physics / Physiology Simulation (Approach Target)
        # Use simple feedback loop (PID-like proportional)
        # HR responds fast, BP responds slower
        
        # Random physiologic noise (Brownian motion)
        noise_hr += (random.random() - 0.5) * 2.0 * var_factor
        noise_sys += (random.random() - 0.5) * 1.5 * var_factor
        noise_dia += (random.random() - 0.5) * 1.0 * var_factor
        
        # Pull noise back to 0 (params can't drift forever)
        noise_hr *= 0.9
        noise_sys *= 0.9
        noise_dia *= 0.9

        # Move current values towards target
        current_hr += (target_hr - current_hr) * 0.05
        current_sys += (target_sys - current_sys) * 0.03
        current_dia += (target_dia - current_dia) * 0.03
        
        # SpO2 is different: it stays high unless forced down, and recovers slowly
        if current_spo2 > target_spo2:
            current_spo2 -= 0.05 # Fast drop (desat)
        else:
            current_spo2 += 0.02 # Slow recovery
            
        # Add random "glitch" or measurement noise
        final_hr = current_hr + noise_hr + (random.random() - 0.5)
        final_sys = current_sys + noise_sys + (random.random() - 0.5)
        final_dia = current_dia + noise_dia + (random.random() - 0.5)
        
        # SpO2 fluctuations (Sleep apnea dips if in deep sleep phase)
        final_spo2 = current_spo2
        if 40 <= t_min < 55 and random.random() < 0.02: # Occasional dip in sleep
             final_spo2 -= random.uniform(1, 3)

        # Pulse Pressure constraints (Sys must be > Dia + 20)
        if final_sys < final_dia + 20: 
            final_sys = final_dia + 20
            
        # Rounding
        point = {
            "time": round(t_min, 2),
            "hr": int(round(final_hr)),
            "sys": int(round(final_sys)),
            "dia": int(round(final_dia)),
            "spo2": int(round(min(100, final_spo2)))
        }
        timeline.append(point)

    output = {
        "patient": {
            "firstName": "Kallol",
            "lastName": "Chakraborty",
            "id": "007",
            "gender": "Male",
            "attending": "Dr. Proloy Dasgupta",
            "dob": "1987-01-01",
            "height": "172cm",
            "weight": "65kg",
            "room": "Room 007",
            "condition": "GOOD"
        },
        "simulation": {
            "description": "Realistic 60-min physiological simulation",
            "durationMinutes": 60,
            "baseVitals": {"hr": 72, "spo2": 98, "sys": 120, "dia": 80}, 
            "timeline": timeline
        },
        "medications": [
            "Midodrine 2.5 3x daily",
            "Midodrine 2.5 3x daily",
            "Midodrine 2.5 3x daily"
        ],
        "diagnoses": [
            "001",
            "002",
            "003"
        ]
    }

    with open('data.json', 'w') as f:
        json.dump(output, f, indent=4)
        
if __name__ == "__main__":
    generate_simulation()
    print("Realistic simulation data generated.")
