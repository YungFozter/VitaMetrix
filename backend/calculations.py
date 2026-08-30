import math


# ---------------------------------------------------------------------------
# MÓDULO 1: Ángulo de Fase y Vector BIVA
# ---------------------------------------------------------------------------

def calculate_phase_angle(resistance, reactance):
    """
    Calcula el Ángulo de Fase en grados.
    Formula: atan2(Reactancia, Resistencia) * (180 / PI)
    """
    if resistance is None or reactance is None or resistance <= 0 or reactance <= 0:
        return 0.0
    angle_rad = math.atan2(reactance, resistance)
    angle_deg = angle_rad * (180 / math.pi)
    return round(angle_deg, 2)


def get_biva_interpretation(resistance, reactance):
    """
    Interpreta los valores BIVA basado en el Ángulo de Fase y la Resistencia.
    Umbrales según Pagina2 Analyzer.md (Módulo 1).
    """
    if not resistance or not reactance or resistance <= 0 or reactance <= 0:
        return {
            "phase_angle": 0.0,
            "cell_status": "Datos incompletos",
            "hydration": "Datos incompletos",
            "valid": False
        }

    phase_angle = calculate_phase_angle(resistance, reactance)

    # Interpretación semántica (Umbrales del manual)
    if phase_angle > 6.0:
        cell_status = "Excelente salud celular (sobrepromedio)"
    elif phase_angle >= 5.0:
        cell_status = "Buena salud celular (rango óptimo)"
    else:
        cell_status = "Masa celular a monitorear (posible inflamación o sarcopenia)"

    # Hidratación (basado en la resistencia, manual Módulo 1)
    if 500 <= resistance <= 650:
        hydration = "Hidratación adecuada"
    elif resistance < 500:
        hydration = "Posible exceso de agua / edema"
    else:
        hydration = "Posible deshidratación"

    return {
        "phase_angle": phase_angle,
        "cell_status": cell_status,
        "hydration": hydration,
        "valid": True
    }


# ---------------------------------------------------------------------------
# MÓDULO 2: Puntuación Global TRU Body Score (Muscle / Fat)
# ---------------------------------------------------------------------------

def _estimate_scores_from_phase_bmi(weight, height, phase_angle):
    """Estimación de respaldo cuando no se dispone de SMM/grasa del dispositivo."""
    height_m = (height or 0) / 100.0
    bmi = (weight / (height_m ** 2)) if (height_m > 0 and weight and weight > 0) else 22.0
    pa = phase_angle or 5.5
    muscle_score = min(max(int(pa * 10), 10), 100)
    fat_score = min(max(int(bmi * 1.5), 5), 100)
    return muscle_score, fat_score


def calculate_scores(weight, height, phase_angle, smm=None, fat_mass=None, gender='male'):
    """
    Puntuación TRU Body Score.
    """
    if smm is not None and fat_mass is not None and weight and weight > 0:
        lean_pct = (smm / weight) * 100
        fat_pct = (fat_mass / weight) * 100
        muscle_score = min(max(int(lean_pct * 1.6), 10), 100)
        fat_score = min(max(int(fat_pct * 1.4), 5), 100)
    else:
        muscle_score, fat_score = _estimate_scores_from_phase_bmi(weight, height, phase_angle)

    base_score = 40
    global_score = min(max(int(base_score + (muscle_score * 0.7) - (fat_score * 0.3)), 10), 99)

    if global_score >= 95:
        rank = "ORO"
    elif global_score >= 90:
        rank = "PLATA"
    elif global_score >= 80:
        rank = "BRONCE"
    else:
        rank = "HIERRO"

    return {
        "score": global_score,
        "muscle_score": muscle_score,
        "fat_score": fat_score,
        "rank": rank
    }


# ---------------------------------------------------------------------------
# MÓDULO 4: Análisis Hídrico (TBW / ECW / Relación)
# ---------------------------------------------------------------------------

def analyze_hydration(tbw=None, ecw=None, weight=None):
    """
    Relación ECW/TBW = (ECW / TBW) * 100
    ICW = TBW - ECW (Agua Intracelular)
    """
    if tbw is None or ecw is None or tbw <= 0:
        return {
            "available": False,
            "tbw": tbw,
            "ecw": ecw,
            "icw": None,
            "ecw_tbw_ratio": None,
            "status": "No disponible",
            "alert": False
        }

    ratio = round((ecw / tbw) * 100, 1)
    icw = round(max(tbw - ecw, 0.0), 1)

    if ratio < 39:
        status = "Hidratación intracelular óptima"
        alert = False
    elif ratio <= 42:
        status = "Rango saludable normal"
        alert = False
    elif ratio <= 45:
        status = "Leve sobrecarga hídrica extracelular"
        alert = True
    else:
        status = "Edema subclínico / Inflamación sistémica"
        alert = True

    return {
        "available": True,
        "tbw": round(tbw, 1),
        "ecw": round(ecw, 1),
        "icw": icw,
        "ecw_tbw_ratio": ratio,
        "status": status,
        "alert": alert
    }


# ---------------------------------------------------------------------------
# MÓDULO 5: Grasa Visceral y Circunferencia de Cintura (IDF)
# ---------------------------------------------------------------------------

def analyze_visceral_fat(waist_cm=None, visceral_fat_l=None, gender='male'):
    result = {
        "available": False,
        "waist_risk": None,
        "visceral_alert": False,
        "status": "No disponible"
    }

    if waist_cm is None and visceral_fat_l is None:
        return result

    result["available"] = True

    if waist_cm is not None:
        threshold = 88 if gender == 'female' else 102
        if waist_cm >= threshold:
            result["waist_risk"] = "Alto"
            result["status"] = "Riesgo cardiovascular alto (cintura)"
        else:
            result["waist_risk"] = "Normal"
            result["status"] = "Cintura en rango normal"

    if visceral_fat_l is not None:
        v_threshold = 1.5 if gender == 'female' else 2.5
        if visceral_fat_l > v_threshold:
            result["visceral_alert"] = True
            result["status"] = "Alerta de riesgo cardiovascular (grasa visceral)"

    return result


# ---------------------------------------------------------------------------
# MÓDULO 7: Gasto Energético (REE / TEE / PAL)
# ---------------------------------------------------------------------------

def calculate_energy(weight, height, age, gender, pal, smm=None, fat_mass=None):
    """
    Calcula REE (Gasto Energético en Reposo) y TEE (Gasto Total).
    """
    w = weight or 70.0
    h = height or 170.0
    a = age or 30
    p = pal or 1.2

    lbm = None
    if fat_mass is not None and fat_mass > 0 and w > fat_mass:
        lbm = w - fat_mass
    elif smm is not None and smm > 0:
        lbm = min(w * 0.9, smm / 0.55)

    if lbm is not None and lbm > 15:
        ree = 500 + (22 * lbm)
    else:
        if gender == 'male':
            ree = (10 * w) + (6.25 * h) - (5 * a) + 5
        else:
            ree = (10 * w) + (6.25 * h) - (5 * a) - 161

    ree_kcal = int(round(max(800, ree)))
    tee_kcal = int(round(ree_kcal * p))
    return {
        "ree_kcal": ree_kcal,
        "tee_kcal": tee_kcal
    }


# ---------------------------------------------------------------------------
# MOTOR DE REGLAS CLÍNICO
# ---------------------------------------------------------------------------

def build_clinical_report(biva, hydration, visceral, scores, phase_angle, ecw_tbw_ratio=None):
    findings = []

    if phase_angle is not None and phase_angle < 5.0 and phase_angle > 0:
        findings.append(
            "Integridad de membranas celulares comprometida. "
            "Descartar inflamación crónica o desnutrición proteica."
        )

    if hydration.get("available") and hydration.get("alert") and ecw_tbw_ratio is not None and ecw_tbw_ratio > 45:
        if visceral.get("available") and visceral.get("visceral_alert"):
            findings.append(
                "Paciente con perfil inflamatorio sistémico. Evaluar síndrome metabólico."
            )
        else:
            findings.append(
                "Sobrecarga hídrica extracelular. Vigilar función renal y estado inflamatorio."
            )

    if visceral.get("available") and visceral.get("waist_risk") == "Alto":
        findings.append(
            "Circunferencia de cintura elevada (riesgo IDF). Priorizar intervención "
            "nutricional y actividad física estructurada."
        )

    if scores.get("score", 100) < 80:
        findings.append(
            "Composición corporal por debajo del rango óptimo (Bronce/Hierro). "
            "Reevaluar plan de entrenamiento y nutrición."
        )

    if not findings:
        findings.append(
            "Composición corporal dentro de rangos saludables. Mantener hábitos actuales "
            "y repetición de la evaluación en 3 meses."
        )

    return findings
