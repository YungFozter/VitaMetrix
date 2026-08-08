import math

def calculate_phase_angle(resistance, reactance):
    """
    Calcula el Ángulo de Fase en grados.
    Formula: atan2(Reactancia, Resistencia) * (180 / PI)
    """
    if resistance == 0:
        return 0
    angle_rad = math.atan2(reactance, resistance)
    angle_deg = angle_rad * (180 / math.pi)
    return round(angle_deg, 2)

def get_biva_interpretation(resistance, reactance):
    """
    Interpreta los valores basado en la imagen 1.
    """
    # Datos duros del usuario
    phase_angle = calculate_phase_angle(resistance, reactance)
    
    # Interpretación semántica
    if phase_angle > 6.0:
        cell_status = "Excelente salud celular"
    elif phase_angle > 5.0:
        cell_status = "Buena salud celular"
    else:
        cell_status = "Masa celular a monitorear"
    
    # Hidratación (basado en la resistencia)
    if 500 <= resistance <= 650:
        hydration = "Hidratación adecuada"
    elif resistance < 500:
        hydration = "Posible exceso de agua/edema"
    else:
        hydration = "Posible deshidratación"

    return {
        "phase_angle": phase_angle,
        "cell_status": cell_status,
        "hydration": hydration
    }

def calculate_energy(weight, height, age, gender, pal):
    """
    Calcula REE usando Mifflin-St Jeor y TEE multiplicando por PAL.
    """
    if gender == 'male':
        ree = 10 * weight + 6.25 * height - 5 * age + 5
    else:
        ree = 10 * weight + 6.25 * height - 5 * age - 161
        
    tee = ree * pal
    return {
        "ree_kcal": int(ree),
        "tee_kcal": int(tee)
    }

def calculate_scores(weight, height, phase_angle):
    """
    Estimación (mock) de scores basada en IMC y Ángulo de fase.
    """
    height_m = height / 100.0
    bmi = weight / (height_m ** 2) if height_m > 0 else 0
    
    # Muscle Score aproximado por ángulo de fase (5 a 8 -> 50 a 80)
    muscle_score = min(max(int(phase_angle * 10), 10), 100)
    
    # Fat Score aproximado por IMC (22 IMC -> 33 score)
    fat_score = min(max(int(bmi * 1.5), 5), 100)
    
    # Global score
    base_score = 40
    global_score = min(max(int(base_score + (muscle_score * 0.7) - (fat_score * 0.3)), 10), 99)
    
    if global_score >= 90:
        rank = "DIAMOND"
    elif global_score >= 80:
        rank = "PLATINUM"
    elif global_score >= 70:
        rank = "GOLD"
    elif global_score >= 60:
        rank = "SILVER"
    else:
        rank = "BRONZE"
        
    return {
        "score": global_score,
        "muscle_score": muscle_score,
        "fat_score": fat_score,
        "rank": rank
    }