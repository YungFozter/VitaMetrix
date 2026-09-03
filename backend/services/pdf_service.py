"""
VitaMetrix PDF & Clinical Report Formatting Service
Provee utilidades para la maquetación, formato de fechas en hora local, normalización de unidades
y estructura de datos requerida para el Reporte Clínico A4 de 2 Páginas de VitaMetrix.
"""

from datetime import datetime
from services.helpers import _now_bolivia, BOLIVIA_TZ

def format_report_date(date_str=None):
    if not date_str:
        return _now_bolivia().strftime("%d/%m/%Y %H:%M")
    try:
        clean = date_str[:-1] + '+00:00' if date_str.endswith('Z') else date_str
        dt = datetime.fromisoformat(clean)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=BOLIVIA_TZ)
        else:
            dt = dt.astimezone(BOLIVIA_TZ)
        return dt.strftime("%d/%m/%Y %H:%M")
    except Exception:
        return str(date_str)[:16].replace('T', ' ')

def prepare_bia_report_context(evaluation_data, doctor_user=None):
    """
    Construye el contexto de datos estandarizado para la renderización del informe clínico impreso.
    """
    doctor = doctor_user or {}
    report = evaluation_data.get('report') or {}
    biva = report.get('biva') or {}
    scores = report.get('scores') or {}
    energy = report.get('energy') or {}
    hydration = report.get('hydration') or {}
    visceral = report.get('visceral') or {}

    return {
        "report_id": evaluation_data.get('code') or evaluation_data.get('id', 'EVA-001'),
        "created_at_formatted": format_report_date(evaluation_data.get('created_at')),
        "doctor": {
            "name": doctor.get('full_name') or doctor.get('name', 'Especialista en Nutrición'),
            "title": doctor.get('professional_title', 'Nutricionista / Especialista BIA'),
            "license": doctor.get('professional_license', ''),
            "clinic": doctor.get('clinic_name', 'Consultorio VitaMetrix'),
            "phone": doctor.get('phone', ''),
            "logo_url": doctor.get('clinic_logo_url', ''),
            "disclaimer": doctor.get('pdf_disclaimer', 'Consulte con su profesional de la salud antes de iniciar cualquier plan nutricional o de entrenamiento.'),
            "footer_address": doctor.get('pdf_footer_address') or doctor.get('clinic_address', 'Bolivia')
        },
        "patient": {
            "name": evaluation_data.get('patient_name') or evaluation_data.get('name', 'Paciente'),
            "idp": evaluation_data.get('patient_idp') or evaluation_data.get('idp', 'IDP-0001'),
            "age": evaluation_data.get('age', '--'),
            "gender": "Femenino" if str(evaluation_data.get('gender')).lower() in ('f', 'female', 'femenino') else "Masculino",
            "weight": evaluation_data.get('weight', '--'),
            "height": evaluation_data.get('height', '--')
        },
        "metrics": {
            "resistance": evaluation_data.get('resistance', 0.0),
            "reactance": evaluation_data.get('reactance', 0.0),
            "phase_angle": evaluation_data.get('phase_angle') or biva.get('phase_angle', 0.0),
            "global_score": evaluation_data.get('global_score') or scores.get('global_score', 0),
            "muscle_score": evaluation_data.get('muscle_score') or scores.get('muscle_score', 0),
            "fat_score": evaluation_data.get('fat_score') or scores.get('fat_score', 0),
            "rank": scores.get('rank', 'BRONCE'),
            "cell_status": biva.get('cell_status', 'Adecuada'),
            "hydration": hydration.get('status', 'Adecuada'),
            "ree_kcal": energy.get('ree_kcal', 0),
            "tee_kcal": energy.get('tee_kcal', 0),
            "pal": energy.get('pal', 1.4),
            "visceral_risk": visceral.get('risk_level', 'Normal'),
            "clinical_text": report.get('clinical_interpretation') or "Evaluación clínica de bioimpedancia vectorial completada con éxito."
        }
    }
