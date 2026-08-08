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
        cell_status = "Excelente salud celular (Sobrepromedio)"
    elif phase_angle > 5.0:
        cell_status = "Buena salud celular (Rango óptimo)"
    else:
        cell_status = "Masa celular a monitorear"
    
    # Hidratación (basado en la resistencia)
    if 500 <= resistance <= 650:
        hydration = "Hidratación adecuada (Balance hídrico óptimo)"
    elif resistance < 500:
        hydration = "Posible exceso de agua/edema"
    else:
        hydration = "Posible deshidratación o alta grasa corporal"

    return {
        "phase_angle": phase_angle,
        "cell_status": cell_status,
        "hydration": hydration
    }