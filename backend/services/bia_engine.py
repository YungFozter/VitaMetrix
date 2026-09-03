"""
VitaMetrix BIA Engine Service
Capa de servicio de dominio para procesamiento y análisis bioeléctrico de bioimpedancia vectorial (BIVA),
puntuaciones TRU Body Score, balance hídrico, semáforos poblacionales y estimación metabólica basal/total.
"""

from calculations import (
    calculate_phase_angle,
    get_biva_interpretation,
    calculate_scores,
    analyze_hydration,
    analyze_visceral_fat,
    calculate_energy,
    build_clinical_report
)

from reference import (
    load_tables,
    get_phase_angle_percentile,
    get_smm_percentile,
    get_segmental_reference,
    get_composition_indices
)

__all__ = [
    'calculate_phase_angle',
    'get_biva_interpretation',
    'calculate_scores',
    'analyze_hydration',
    'analyze_visceral_fat',
    'calculate_energy',
    'build_clinical_report',
    'load_tables',
    'get_phase_angle_percentile',
    'get_smm_percentile',
    'get_segmental_reference',
    'get_composition_indices',
    'compute_complete_clinical_bia'
]

def compute_complete_clinical_bia(raw_data):
    """
    Ejecuta el pipeline clínico completo de análisis bioeléctrico.
    Recibe un diccionario con las entradas del formulario y devuelve el dict de reporte clínico consolidado.
    """
    try:
        r = float(raw_data.get('resistance') or 0)
        xc = float(raw_data.get('reactance') or 0)
        weight = float(raw_data.get('weight') or 0)
        height = float(raw_data.get('height') or 0)
        age = int(raw_data.get('age') or 0)
        gender = str(raw_data.get('gender') or 'male').lower()
    except (ValueError, TypeError):
        r, xc, weight, height, age, gender = 0, 0, 0, 0, 0, 'male'

    pal = float(raw_data.get('pal') or 1.4)
    smm = float(raw_data.get('smm')) if raw_data.get('smm') else None
    fat_mass = float(raw_data.get('fat_mass')) if raw_data.get('fat_mass') else None
    tbw = float(raw_data.get('tbw')) if raw_data.get('tbw') else None
    ecw = float(raw_data.get('ecw')) if raw_data.get('ecw') else None
    visceral_fat = float(raw_data.get('visceral_fat')) if raw_data.get('visceral_fat') else None
    waist = float(raw_data.get('waist')) if raw_data.get('waist') else None

    # Módulo 1: BIVA y Ángulo de Fase
    biva = get_biva_interpretation(r, xc)
    phase_angle = biva.get('phase_angle', 0.0)

    # Módulo 2: Scores TRU
    scores = calculate_scores(smm, fat_mass, weight, gender, age)

    # Módulo 4: Análisis Hídrico
    hydration = analyze_hydration(tbw, ecw, weight)

    # Módulo 5: Grasa Visceral y Cintura
    visceral = analyze_visceral_fat(waist, visceral_fat, gender)

    # Módulo 7: Gasto Energético
    energy = calculate_energy(weight, height, age, gender, smm, pal)

    # Módulo 3: Interpretación textual consolidada
    clinical_report = build_clinical_report(
        biva=biva,
        scores=scores,
        hydration=hydration,
        visceral=visceral,
        energy=energy,
        gender=gender,
        phase_angle=phase_angle
    )

    # Percentiles Poblacionales
    pha_pct = get_phase_angle_percentile(phase_angle, age, gender)
    smm_pct = get_smm_percentile(smm, age, gender) if smm else None

    return {
        "biva": biva,
        "phase_angle": phase_angle,
        "phase_angle_percentile": pha_pct,
        "scores": scores,
        "smm_percentile": smm_pct,
        "hydration": hydration,
        "visceral": visceral,
        "energy": energy,
        "clinical_interpretation": clinical_report
    }
