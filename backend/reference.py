"""
Módulo de referencia poblacional para VitaMetrix.
Carga data/reference_tables.json y expone funciones de consulta:
  - percentil por edad (interpolación lineal entre brackets)
  - rangos segmentales con semáforos
  - índices de composición (IMC/FMI/FFMI/FM%/SMI) con semáforos
"""
import os
import json
import math
from functools import lru_cache

# Ruta al JSON de referencia (raíz del proyecto / data/)
_BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_TABLES_PATH = os.path.join(_BASE, "data", "reference_tables.json")


@lru_cache(maxsize=1)
def load_tables():
    try:
        with open(_TABLES_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error cargando reference_tables.json: {e}")
        return {}


def _clamp_age(age):
    return max(20, min(80, age or 20))


def _interpolate(curves, age, key):
    """Interpola linealmente 'key' (p5/p25/p50/p75/p95) en la curva por edad."""
    age = _clamp_age(age)
    pts = sorted(curves, key=lambda c: c["age"])
    if age <= pts[0]["age"]:
        return pts[0][key]
    if age >= pts[-1]["age"]:
        return pts[-1][key]
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        if a["age"] <= age <= b["age"]:
            t = (age - a["age"]) / (b["age"] - a["age"])
            return round(a[key] + t * (b[key] - a[key]), 2)
    return pts[-1][key]


def get_phase_angle_percentile(phase_angle, age, gender="male"):
    """Devuelve el percentil aproximado del Ángulo de Fase para la edad/sexo."""
    tables = load_tables()
    curves = tables.get("phase_angle_percentiles", {}).get(gender, [])
    if not curves:
        return None
    p5 = _interpolate(curves, age, "p5")
    p50 = _interpolate(curves, age, "p50")
    p95 = _interpolate(curves, age, "p95")
    if phase_angle <= p5:
        pct = 5 * (phase_angle / p5) if p5 else 5
    elif phase_angle <= p50:
        pct = 5 + 45 * (phase_angle - p5) / (p50 - p5) if (p50 - p5) else 50
    elif phase_angle <= p95:
        pct = 50 + 45 * (phase_angle - p50) / (p95 - p50) if (p95 - p50) else 95
    else:
        pct = 95 + 5 * (phase_angle - p95) / (p95 or 1)
    return max(1, min(99, round(pct)))


def get_smm_percentile(smm, age, gender="male"):
    """Percentil de Masa Muscular Esquelética (SMM) vs edad/sexo."""
    tables = load_tables()
    curves = tables.get("smm_age_percentiles", {}).get(gender, [])
    if not curves or not smm:
        return None
    p5 = _interpolate(curves, age, "p5")
    p25 = _interpolate(curves, age, "p25")
    p50 = _interpolate(curves, age, "p50")
    p75 = _interpolate(curves, age, "p75")
    p95 = _interpolate(curves, age, "p95")
    if smm <= p5:
        pct = 5 * (smm / p5) if p5 else 5
    elif smm <= p25:
        pct = 5 + 20 * (smm - p5) / (p25 - p5) if (p25 - p5) else 25
    elif smm <= p50:
        pct = 25 + 25 * (smm - p25) / (p50 - p25) if (p50 - p25) else 50
    elif smm <= p75:
        pct = 50 + 25 * (smm - p50) / (p75 - p50) if (p75 - p50) else 75
    elif smm <= p95:
        pct = 75 + 20 * (smm - p75) / (p95 - p75) if (p95 - p75) else 95
    else:
        pct = 95 + 5 * (smm - p95) / (p95 or 1)
    return max(1, min(99, round(pct)))


def analyze_segmental(segments, gender="male"):
    """
    segments: dict con llaves arm_right, arm_left, torso, leg_right, leg_left (kg).
    Devuelve por cada segmento: valor, rango (min/avg/max), semáforo, y
    alerta de asimetría entre lados homólogos (>10% diferencia).
    """
    tables = load_tables()
    ranges = tables.get("segmental_muscle_ranges", {}).get(gender, {})
    result = {}
    asymmetries = []

    for seg, val in segments.items():
        r = ranges.get(seg)
        if val is None or not r:
            result[seg] = {"value": val, "available": False}
            continue
        if val < r["min"]:
            status = "Déficit"
            light = "red"
        elif val > r["max"]:
            status = "Atención (hipertrofia)"
            light = "yellow"
        else:
            status = "Normal"
            light = "green"
        result[seg] = {
            "value": val,
            "available": True,
            "min": r["min"], "avg": r["avg"], "max": r["max"],
            "status": status, "light": light
        }

    # Asimetría: brazos y piernas
    pairs = [("arm_right", "arm_left"), ("leg_right", "leg_left")]
    for a, b in pairs:
        va, vb = segments.get(a), segments.get(b)
        if va and vb and min(va, vb) > 0:
            diff = abs(va - vb) / min(va, vb)
            if diff > 0.10:
                asymmetries.append({
                    "segment": f"{a}/{b}",
                    "diff_pct": round(diff * 100, 1),
                    "message": f"Asimetría clínica detectada ({round(diff*100,1)}% entre {a} y {b})"
                })
    return {"segments": result, "asymmetries": asymmetries}


def get_smm_age_curves(gender="male"):
    """
    Devuelve las curvas de referencia de SMM por edad para graficar
    (Módulo 6 del manual: líneas P5/25/50/75/95 y punto del paciente).
    Retorna {"ages": [...], "p5": [...], "p25": [...], "p50": [...],
             "p75": [...], "p95": [...]} listas alineadas por edad.
    """
    tables = load_tables()
    curves = tables.get("smm_age_percentiles", {}).get(gender, [])
    if not curves:
        return None
    pts = sorted(curves, key=lambda c: c["age"])
    return {
        "ages": [c["age"] for c in pts],
        "p5": [c["p5"] for c in pts],
        "p25": [c["p25"] for c in pts],
        "p50": [c["p50"] for c in pts],
        "p75": [c["p75"] for c in pts],
        "p95": [c["p95"] for c in pts],
    }

def get_pha_age_curves(gender="male"):
    tables = load_tables()
    curves = tables.get("phase_angle_percentiles", {}).get(gender, [])
    if not curves:
        return None
    pts = sorted(curves, key=lambda c: c["age"])
    return {
        "ages": [c["age"] for c in pts],
        "p5": [c["p5"] for c in pts],
        "p25": [c.get("p25", round((c["p5"] + c["p50"]) / 2, 2)) for c in pts],
        "p50": [c["p50"] for c in pts],
        "p75": [c.get("p75", round((c["p50"] + c["p95"]) / 2, 2)) for c in pts],
        "p95": [c["p95"] for c in pts],
    }


def analyze_composition_indices(weight, height, fat_mass, smm, gender="male"):
    """
    Calcula IMC, FMI, FFMI, FM%, SMI y sus semáforos.
    Requiere weight (kg), height (cm), fat_mass (kg), smm (kg).
    """
    tables = load_tables()
    h_m = (height or 0) / 100.0
    if not weight or not h_m:
        return {"available": False}

    imc = weight / (h_m ** 2)
    lean = weight - (fat_mass or 0)
    fmi = (fat_mass or 0) / (h_m ** 2) if fat_mass else None
    ffmi = lean / (h_m ** 2)
    fm_pct = (fat_mass / weight * 100) if fat_mass and weight else None
    smi = smm / (h_m ** 2) if smm else None

    def _status_imc(v):
        r = tables.get("bmi_normal_ranges", {}).get(gender, {})
        if v < r.get("low", 18.5): return "Bajo peso", "yellow"
        if v <= r.get("normal_max", 24.9): return "Normal", "green"
        if v <= r.get("overweight_max", 29.9): return "Sobrepeso", "yellow"
        return "Obesidad", "red"

    def _status_high(v, key):
        r = tables.get(key, {}).get(gender, {})
        return ("Normal", "green") if (v is not None and v <= r.get("normal_max", 999)) else ("Alto", "red")

    def _status_low(v, key):
        r = tables.get(key, {}).get(gender, {})
        return ("Normal", "green") if (v is not None and v >= r.get("normal_min", 0)) else ("Bajo", "yellow")

    return {
        "available": True,
        "imc": round(imc, 1),
        "imc_status": _status_imc(imc),
        "fmi": round(fmi, 1) if fmi else None,
        "fmi_status": _status_high(fmi, "fmi_normal_ranges") if fmi else None,
        "ffmi": round(ffmi, 1),
        "ffmi_status": _status_low(ffmi, "ffmi_normal_ranges"),
        "fm_pct": round(fm_pct, 1) if fm_pct else None,
        "fm_pct_status": _status_high(fm_pct, "fm_percent_ranges") if fm_pct else None,
        "smi": round(smi, 1) if smi else None,
        "smi_status": _status_low(smi, "smi_normal_ranges") if smi else None
    }
