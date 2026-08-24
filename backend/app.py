import os
import sys
import logging
import time
from datetime import datetime

# Configurar logging seguro
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from typing import Optional

from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
from supabase import create_client, Client
from calculations import (
    get_biva_interpretation,
    calculate_energy,
    calculate_scores,
    analyze_hydration,
    analyze_visceral_fat,
    build_clinical_report,
)
from reference import (
    get_phase_angle_percentile,
    get_smm_percentile,
    get_smm_age_curves,
    get_pha_age_curves,
    analyze_segmental,
    analyze_composition_indices,
    load_tables,
)

load_dotenv()

app = Flask(
    __name__,
    template_folder='../frontend/templates',
    static_folder='../frontend/static'
)

app.config['MAX_CONTENT_LENGTH'] = 2 * 1024 * 1024  # Limitar tamaño de payload a 2 MB

@app.after_request
def set_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    response.headers['Content-Security-Policy'] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com https://cdn.tailwindcss.com; "
        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com https://unpkg.com; "
        "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net; "
        "img-src 'self' data: blob: https:; "
        "connect-src 'self' https: https://nominatim.openstreetmap.org; "
        "frame-src 'self' https://maps.google.com https://www.google.com https://*.google.com;"
    )
    return response

import html

def _clean_str(val, max_len=150):
    if not val:
        return ""
    return html.escape(str(val).strip()[:max_len])

# Inicializar Supabase
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        logging.error("Error al inicializar cliente de Supabase: %s", e)
else:
    logging.warning("Supabase credentials not found in environment variables.")

_EMPTY_DASHBOARD = {
    "total_clients": 0,
    "total_evaluations": 0,
    "avg_score": 0,
    "recent": [],
    "population": {"Óptimo": 0, "Límite": 0, "Bajo": 0},
}


def _cell_bucket(phase_angle, valid=True):
    """Clasifica estado celular para el gráfico del dashboard (Óptimo / Límite / Bajo)."""
    if not valid or phase_angle is None:
        return "Límite"
    if phase_angle > 6.0:
        return "Óptimo"
    if phase_angle >= 5.0:
        return "Límite"
    return "Bajo"


def _normalize_gender(value):
    raw = (value or "male").strip().lower()
    if raw in ("f", "female", "mujer", "femenino"):
        return "female"
    return "male"

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/dashboard-stats', methods=['GET'])
def dashboard_stats():
    if not supabase:
        return jsonify(_EMPTY_DASHBOARD)
        
    try:
        # Contar clientes
        clients_res = supabase.table('clients').select('id', count='exact').execute()
        total_clients = clients_res.count if clients_res.count is not None else 0
        
        # Obtener evaluaciones recientes
        evals_res = supabase.table('evaluations').select('*').order('created_at', desc=True).limit(100).execute()
        evaluations = evals_res.data or []
        
        total_evaluations = len(evaluations)
        
        # Calcular promedio de TRU Score
        valid_scores = [float(e['global_score']) for e in evaluations if e.get('global_score') is not None]
        avg_score = round(sum(valid_scores) / len(valid_scores), 1) if valid_scores else 0
        
        # Estadísticas poblacionales (Estado celular)
        cell_status_counts = {"Óptimo": 0, "Límite": 0, "Bajo": 0}
        
        recent = []
        for e in evaluations:
            r = float(e.get('resistance', 0) or 0)
            xc = float(e.get('reactance', 0) or 0)
            biva_info = get_biva_interpretation(r, xc)
            bucket = _cell_bucket(biva_info.get('phase_angle', 0), biva_info.get('valid', True))
            cell_status_counts[bucket] += 1
            
            if len(recent) < 5:
                recent.append({
                    "name": e.get('patient_name', 'Unknown'),
                    "date": (e.get('created_at') or '').split('T')[0],
                    "score": e.get('global_score', 0),
                    "phase_angle": biva_info.get('phase_angle', 0)
                })
        
        return jsonify({
            "total_clients": total_clients,
            "total_evaluations": total_evaluations,
            "avg_score": avg_score,
            "recent": recent,
            "population": cell_status_counts
        })
    except Exception as e:
        logging.error("Error al obtener estadísticas del dashboard: %s", e, exc_info=True)
        return jsonify(_EMPTY_DASHBOARD), 500

def _run_analysis(data):
    """
    FASE 5: Núcleo de cálculo unificado.
    Recibe el payload del formulario, ejecuta los Módulos 1-7 y devuelve UN diccionario completo.
    """
    # Campos opcionales del dispositivo
    smm = data.get('smm')
    tbw = data.get('tbw')
    ecw = data.get('ecw')
    fat_mass = data.get('fat_mass')
    visceral_fat = data.get('visceral_fat')
    waist = data.get('waist')
    phase_angle_dev = data.get('phase_angle_dev')
    seg_arm_r = data.get('seg_arm_r')
    seg_arm_l = data.get('seg_arm_l')
    seg_torso = data.get('seg_torso')
    seg_leg_r = data.get('seg_leg_r')
    seg_leg_l = data.get('seg_leg_l')
    
    # Índices directos del dispositivo (si se proporcionan)
    dev_imc = data.get('imc')
    dev_fmi = data.get('fmi')
    dev_ffmi = data.get('ffmi')
    dev_fm_pct = data.get('fm_pct')
    dev_smi = data.get('smi')

    # Validar numéricos opcionales
    def _num(v):
        try:
            return float(v) if v not in (None, "") else None
        except (ValueError, TypeError):
            return None

    smm = _num(smm)
    tbw = _num(tbw)
    ecw = _num(ecw)
    fat_mass = _num(fat_mass)
    visceral_fat = _num(visceral_fat)
    waist = _num(waist)
    phase_angle_dev = _num(phase_angle_dev)
    seg_arm_r = _num(seg_arm_r)
    seg_arm_l = _num(seg_arm_l)
    seg_torso = _num(seg_torso)
    seg_leg_r = _num(seg_leg_r)
    seg_leg_l = _num(seg_leg_l)
    dev_imc = _num(dev_imc)
    dev_fmi = _num(dev_fmi)
    dev_ffmi = _num(dev_ffmi)
    dev_fm_pct = _num(dev_fm_pct)
    dev_smi = _num(dev_smi)

    # Datos paciente sanitizados
    patient_idp = _clean_str(data.get('patient_idp', ''), max_len=50) or ''
    patient_name = _clean_str(data.get('patient_name', 'Paciente sin registrar'), max_len=100) or 'Paciente sin registrar'

    # Datos físicos sanitizados y acotados a rangos clínicos válidos
    r = max(0.0, min(_num(data.get('resistance', 0)) or 0.0, 2000.0))
    xc = max(0.0, min(_num(data.get('reactance', 0)) or 0.0, 500.0))
    weight = max(10.0, min(_num(data.get('weight', 0)) or 70.0, 350.0))
    height = max(40.0, min(_num(data.get('height', 0)) or 170.0, 250.0))
    raw_age = int(_num(data.get('age', 30)) or 30)
    age = max(1, min(raw_age, 120))
    gender = _normalize_gender(data.get('gender', 'male'))
    pal = max(1.0, min(_num(data.get('pal', 1.2)) or 1.2, 3.0))

    # Cálculos - Módulos Base
    biva_info = get_biva_interpretation(r, xc)
    energy_info = calculate_energy(weight, height, age, gender, pal, smm=smm, fat_mass=fat_mass)
    scores = calculate_scores(weight, height, biva_info['phase_angle'],
                              smm=smm, fat_mass=fat_mass, gender=gender)
    hydration_info = analyze_hydration(tbw=tbw, ecw=ecw, weight=weight)
    visceral_info = analyze_visceral_fat(waist_cm=waist, visceral_fat_l=visceral_fat, gender=gender)
    clinical_findings = build_clinical_report(
        biva_info, hydration_info, visceral_info, scores,
        biva_info['phase_angle'],
        ecw_tbw_ratio=hydration_info.get('ecw_tbw_ratio')
    )

    # Percentiles y Curvas Poblacionales
    phase_for_percentile = phase_angle_dev if phase_angle_dev else biva_info['phase_angle']
    phase_percentile = get_phase_angle_percentile(phase_for_percentile, age, gender)
    pha_curves = get_pha_age_curves(gender)
    smm_percentile = get_smm_percentile(smm, age, gender) if smm else None
    smm_curves = get_smm_age_curves(gender) if smm else None

    # Músculo Segmental
    segments = {
        'arm_right': seg_arm_r, 'arm_left': seg_arm_l,
        'torso': seg_torso, 'leg_right': seg_leg_r, 'leg_left': seg_leg_l
    }
    has_segments = any(v is not None for v in segments.values())
    segmental_info = analyze_segmental(segments, gender) if has_segments else {"segments": {}, "asymmetries": []}

    # [CLI-01 FIX] Índices de Composición: cálculo integral con override granular
    calculated_indices = analyze_composition_indices(weight, height, fat_mass, smm, gender)
    tables = load_tables()

    def _eval_imc_status(v):
        r_tab = tables.get("bmi_normal_ranges", {}).get(gender, {})
        if v < r_tab.get("low", 18.5): return "Bajo peso", "yellow"
        if v <= r_tab.get("normal_max", 24.9): return "Normal", "green"
        if v <= r_tab.get("overweight_max", 29.9): return "Sobrepeso", "yellow"
        return "Obesidad", "red"

    def _eval_high_status(v, key):
        r_tab = tables.get(key, {}).get(gender, {})
        return ("Normal", "green") if (v is not None and v <= r_tab.get("normal_max", 999)) else ("Alto", "red")

    def _eval_low_status(v, key):
        r_tab = tables.get(key, {}).get(gender, {})
        return ("Normal", "green") if (v is not None and v >= r_tab.get("normal_min", 0)) else ("Bajo", "yellow")

    final_imc = dev_imc if dev_imc is not None else calculated_indices.get("imc")
    final_fmi = dev_fmi if dev_fmi is not None else calculated_indices.get("fmi")
    final_ffmi = dev_ffmi if dev_ffmi is not None else calculated_indices.get("ffmi")
    final_fm_pct = dev_fm_pct if dev_fm_pct is not None else calculated_indices.get("fm_pct")
    final_smi = dev_smi if dev_smi is not None else calculated_indices.get("smi")

    composition_indices = {
        "available": any(x is not None for x in (final_imc, final_fmi, final_ffmi, final_fm_pct, final_smi)),
        "imc": final_imc,
        "imc_status": _eval_imc_status(final_imc) if final_imc is not None else None,
        "fmi": final_fmi,
        "fmi_status": _eval_high_status(final_fmi, "fmi_normal_ranges") if final_fmi is not None else None,
        "ffmi": final_ffmi,
        "ffmi_status": _eval_low_status(final_ffmi, "ffmi_normal_ranges") if final_ffmi is not None else None,
        "fm_pct": final_fm_pct,
        "fm_pct_status": _eval_high_status(final_fm_pct, "fm_percent_ranges") if final_fm_pct is not None else None,
        "smi": final_smi,
        "smi_status": _eval_low_status(final_smi, "smi_normal_ranges") if final_smi is not None else None,
        "from_device": any(x is not None for x in (dev_imc, dev_fmi, dev_ffmi, dev_fm_pct, dev_smi))
    }

    # BCC (gráfico grasa vs músculo)
    bcc = {"available": False}
    if fat_mass and smm and weight:
        bcc = {
            "available": True,
            "fat_pct": round(fat_mass / weight * 100, 1),
            "muscle_pct": round(smm / weight * 100, 1)
        }

    # Guardar en Supabase con reciclaje seguro de códigos EVA-XXX
    saved = False
    assigned_code = None
    if supabase:
        try:
            existing_codes = []
            try:
                evals_res = supabase.table('evaluations').select('code').execute()
                for row in (evals_res.data or []):
                    raw_c = row.get('code')
                    if raw_c and str(raw_c).startswith('EVA-'):
                        try:
                            existing_codes.append(int(raw_c.replace('EVA-', '')))
                        except ValueError:
                            pass
            except Exception:
                pass
            existing_codes.sort()

            next_num = 1
            for num in existing_codes:
                if num == next_num:
                    next_num += 1
                elif num > next_num:
                    break

            assigned_code = f"EVA-{next_num:03d}"

            insert_payload = {
                "patient_idp": patient_idp,
                "patient_name": patient_name,
                "resistance": r,
                "reactance": xc,
                "weight": weight,
                "height": height,
                "age": age,
                "gender": gender,
                "pal": pal,
                "global_score": scores['score'],
                "muscle_score": scores['muscle_score'],
                "fat_score": scores['fat_score'],
                "smm": smm,
                "tbw": tbw,
                "ecw": ecw,
                "fat_mass": fat_mass,
                "visceral_fat": visceral_fat,
                "waist": waist,
                "code": assigned_code
            }

            try:
                supabase.table('evaluations').insert(insert_payload).execute()
            except Exception:
                # Fallback si la columna 'code' aún no existe en el esquema de la BD
                insert_payload.pop('code', None)
                supabase.table('evaluations').insert(insert_payload).execute()

            saved = True
        except Exception as e:
            logging.error("Error al guardar evaluación en Supabase: %s", e)

    return {
        "score": scores['score'],
        "rank": scores['rank'],
        "muscle_score": scores['muscle_score'],
        "fat_score": scores['fat_score'],
        "phase_angle": biva_info['phase_angle'],
        "cell_status": biva_info['cell_status'],
        "hydration_status": biva_info['hydration'],
        "ree_kcal": energy_info['ree_kcal'],
        "tee_kcal": energy_info['tee_kcal'],
        "hydration": hydration_info,
        "visceral": visceral_info,
        "clinical_findings": clinical_findings,
        "phase_percentile": phase_percentile,
        "pha_curves": pha_curves,
        "smm_percentile": smm_percentile,
        "smm_curves": smm_curves,
        "segmental": segmental_info,
        "composition_indices": composition_indices,
        "bcc": bcc,
        "saved": saved,
        "inputs_echo": {
            "height": height,
            "gender": gender,
            "age": age
        }
    }


@app.route('/api/calculate', methods=['POST'])
def calculate():
    """Endpoint legacy (compatibilidad). Delega en el núcleo unificado."""
    data = request.json or {}
    return jsonify(_run_analysis(data))


@app.route('/api/dashboard-data', methods=['POST'])
def dashboard_data():
    """Endpoint canónico del manual (Pagina2 Analyzer.md)."""
    data = request.json or {}
    return jsonify(_run_analysis(data))

# --- RUTAS DE EVALUACIONES ---

@app.route('/api/evaluations', methods=['GET'])
def get_evaluations():
    if not supabase:
        return jsonify([]), 200
    try:
        res = supabase.table('evaluations').select('*').order('created_at', desc=False).execute()
        evals_asc = res.data or []
        
        for idx, e in enumerate(evals_asc, start=1):
            if not e.get('code'):
                e['code'] = f"EVA-{idx:03d}"
            r = float(e.get('resistance') or 0)
            xc = float(e.get('reactance') or 0)
            biva_info = get_biva_interpretation(r, xc)
            e['phase_angle'] = biva_info['phase_angle']
            e['cell_status'] = biva_info['cell_status']
            e['hydration_status'] = biva_info['hydration']
            
        evals_asc.reverse()
        return jsonify(evals_asc)
    except Exception as e:
        logging.error("Error al obtener evaluaciones: %s", e, exc_info=True)
        return jsonify({"error": "No se pudieron obtener las evaluaciones"}), 500

@app.route('/api/evaluations/<string:eval_id>', methods=['GET'])
def get_evaluation_by_id(eval_id):
    if not supabase:
        return jsonify({"error": "Base de datos no configurada"}), 503
    try:
        res = supabase.table('evaluations').select('*').eq('id', eval_id).execute()
        if not res.data:
            return jsonify({"error": "Evaluación no encontrada"}), 404
        
        raw_eval = res.data[0]
        payload = {
            "patient_idp": raw_eval.get('patient_idp'),
            "patient_name": raw_eval.get('patient_name'),
            "resistance": raw_eval.get('resistance'),
            "reactance": raw_eval.get('reactance'),
            "weight": raw_eval.get('weight'),
            "height": raw_eval.get('height'),
            "age": raw_eval.get('age'),
            "gender": raw_eval.get('gender'),
            "pal": raw_eval.get('pal'),
            "smm": raw_eval.get('smm'),
            "tbw": raw_eval.get('tbw'),
            "ecw": raw_eval.get('ecw'),
            "fat_mass": raw_eval.get('fat_mass'),
            "visceral_fat": raw_eval.get('visceral_fat'),
            "waist": raw_eval.get('waist')
        }
        full_analysis = _run_analysis(payload)
        full_analysis["id"] = raw_eval.get("id")
        full_analysis["code"] = raw_eval.get("code")
        full_analysis["created_at"] = raw_eval.get("created_at")
        full_analysis["patient_idp"] = raw_eval.get("patient_idp")
        full_analysis["patient_name"] = raw_eval.get("patient_name")
        full_analysis["raw_inputs"] = payload
        return jsonify(full_analysis)
    except Exception as e:
        logging.error("Error al obtener detalle de evaluación: %s", e, exc_info=True)
        return jsonify({"error": "Error interno al recuperar la evaluación"}), 500

@app.route('/api/evaluations/<string:eval_id>', methods=['DELETE'])
def delete_evaluation(eval_id):
    if not supabase:
        return jsonify({"error": "Base de datos no configurada"}), 503
    try:
        supabase.table('evaluations').delete().eq('id', eval_id).execute()
        return jsonify({"success": True})
    except Exception as e:
        logging.error("Error al eliminar evaluación: %s", e, exc_info=True)
        return jsonify({"error": "Error al eliminar la evaluación"}), 500

# --- RUTAS DE CLIENTES ---

@app.route('/api/clients', methods=['GET'])
def get_clients():
    if not supabase:
        return jsonify([]), 200
    try:
        res = supabase.table('clients').select('*').order('code').execute()
        return jsonify(res.data or [])
    except Exception as e:
        logging.error("Error al obtener clientes: %s", e, exc_info=True)
        return jsonify({"error": "Error al obtener clientes"}), 500

@app.route('/api/clients', methods=['POST'])
def add_client():
    if not supabase:
        return jsonify({"error": "Base de datos no configurada"}), 503
    data = request.json or {}
    name = _clean_str(data.get('name'), max_len=100)
    phone = _clean_str(data.get('phone'), max_len=30)
    email = _clean_str(data.get('email'), max_len=100)
    
    if not name:
        return jsonify({"error": "El nombre es obligatorio"}), 400
        
    try:
        # Lógica de reciclaje de códigos
        res = supabase.table('clients').select('code').execute()
        codes = [row['code'] for row in (res.data or []) if row.get('code') is not None]
        codes.sort()
        
        new_code = 1
        for code in codes:
            if code == new_code:
                new_code += 1
            elif code > new_code:
                break
                
        new_client = {
            "code": new_code,
            "name": name,
            "phone": phone,
            "email": email
        }
        res_insert = supabase.table('clients').insert(new_client).execute()
        
        return jsonify({"success": True, "data": res_insert.data[0] if res_insert.data else {}})
    except Exception as e:
        logging.error("Error al registrar cliente: %s", e, exc_info=True)
        return jsonify({"error": "Error al guardar cliente"}), 500

@app.route('/api/clients/<string:client_id>', methods=['PUT'])
def update_client(client_id):
    if not supabase:
        return jsonify({"error": "Base de datos no configurada"}), 503
    data = request.json or {}
    name = _clean_str(data.get('name'), max_len=100)
    phone = _clean_str(data.get('phone'), max_len=30)
    email = _clean_str(data.get('email'), max_len=100)
    
    if not name:
        return jsonify({"error": "El nombre es obligatorio"}), 400
        
    try:
        updated_data = {
            "name": name,
            "phone": phone,
            "email": email
        }
        res = supabase.table('clients').update(updated_data).eq('id', client_id).execute()
        return jsonify({"success": True, "data": res.data[0] if res.data else {}})
    except Exception as e:
        logging.error("Error al actualizar cliente: %s", e, exc_info=True)
        return jsonify({"error": "Error al actualizar cliente"}), 500

@app.route('/api/clients/<string:client_id>', methods=['DELETE'])
def delete_client(client_id):
    if not supabase:
        return jsonify({"error": "Base de datos no configurada"}), 503
    try:
        supabase.table('clients').delete().eq('id', client_id).execute()
        return jsonify({"success": True})
    except Exception as e:
        logging.error("Error al eliminar cliente: %s", e, exc_info=True)
        return jsonify({"error": "Error al eliminar cliente"}), 500

# --- RUTAS DE CITAS Y AGENDA CLÍNICA ---

_LOCAL_APPOINTMENTS = []

@app.route('/api/appointments', methods=['GET'])
def get_appointments():
    date_filter = request.args.get('date')
    if not supabase:
        results = _LOCAL_APPOINTMENTS
        if date_filter:
            results = [a for a in results if a.get('date') == date_filter]
        return jsonify(results), 200

    try:
        query = supabase.table('appointments').select('*').order('date').order('time')
        if date_filter:
            query = query.eq('date', date_filter)
        res = query.execute()
        return jsonify(res.data or []), 200
    except Exception as e:
        logging.warning("Tabla appointments no disponible en Supabase, usando almacenamiento local: %s", e)
        results = _LOCAL_APPOINTMENTS
        if date_filter:
            results = [a for a in results if a.get('date') == date_filter]
        return jsonify(results), 200

@app.route('/api/appointments', methods=['POST'])
def create_appointment():
    data = request.json or {}
    patient_name = _clean_str(data.get('patient_name'), max_len=100)
    patient_phone = _clean_str(data.get('patient_phone'), max_len=30)
    patient_idp = _clean_str(data.get('patient_idp'), max_len=50)
    appt_date = _clean_str(data.get('date'), max_len=20)
    appt_time = _clean_str(data.get('time'), max_len=10)
    appt_type = _clean_str(data.get('type') or 'Evaluación Inicial BIA', max_len=50)
    appt_status = _clean_str(data.get('status') or 'confirmed', max_len=20)
    notes = _clean_str(data.get('notes'), max_len=250)

    if not patient_name or not appt_date or not appt_time:
        return jsonify({"error": "Paciente, fecha y hora son obligatorios"}), 400

    new_appt = {
        "id": f"apt_{len(_LOCAL_APPOINTMENTS) + 1}_{int(time.time() if 'time' in globals() else 1000)}",
        "patient_name": patient_name,
        "patient_phone": patient_phone,
        "patient_idp": patient_idp,
        "date": appt_date,
        "time": appt_time,
        "type": appt_type,
        "status": appt_status,
        "notes": notes,
        "created_at": datetime.now().isoformat() if 'datetime' in globals() else "2026-08-22T00:00:00"
    }

    if supabase:
        try:
            res = supabase.table('appointments').insert({
                "patient_name": patient_name,
                "patient_phone": patient_phone,
                "patient_idp": patient_idp,
                "date": appt_date,
                "time": appt_time,
                "type": appt_type,
                "status": appt_status,
                "notes": notes
            }).execute()
            if res.data:
                return jsonify({"success": True, "data": res.data[0]}), 201
        except Exception as e:
            logging.warning("No se pudo insertar en Supabase appointments, usando fallback local: %s", e)

    _LOCAL_APPOINTMENTS.append(new_appt)
    return jsonify({"success": True, "data": new_appt}), 201

@app.route('/api/appointments/<string:appt_id>', methods=['PUT'])
def update_appointment(appt_id):
    data = request.json or {}
    updated = {
        "patient_name": _clean_str(data.get('patient_name')),
        "patient_phone": _clean_str(data.get('patient_phone')),
        "patient_idp": _clean_str(data.get('patient_idp')),
        "date": _clean_str(data.get('date')),
        "time": _clean_str(data.get('time')),
        "type": _clean_str(data.get('type')),
        "status": _clean_str(data.get('status')),
        "notes": _clean_str(data.get('notes'))
    }
    # Remover campos vacíos
    updated = {k: v for k, v in updated.items() if v}

    if supabase:
        try:
            res = supabase.table('appointments').update(updated).eq('id', appt_id).execute()
            if res.data:
                return jsonify({"success": True, "data": res.data[0]})
        except Exception as e:
            logging.warning("Error al actualizar en Supabase appointments: %s", e)

    for item in _LOCAL_APPOINTMENTS:
        if item.get('id') == appt_id:
            item.update(updated)
            return jsonify({"success": True, "data": item})

    return jsonify({"success": True, "message": "Actualizado"})

@app.route('/api/appointments/<string:appt_id>', methods=['DELETE'])
def delete_appointment(appt_id):
    if supabase:
        try:
            supabase.table('appointments').delete().eq('id', appt_id).execute()
            return jsonify({"success": True})
        except Exception as e:
            logging.warning("Error al eliminar en Supabase appointments: %s", e)

    global _LOCAL_APPOINTMENTS
    _LOCAL_APPOINTMENTS = [a for a in _LOCAL_APPOINTMENTS if a.get('id') != appt_id]
    return jsonify({"success": True})

# --- CHATBOT WEBHOOK (WhatsApp / Telegram Automation) ---

@app.route('/api/bot/webhook', methods=['POST', 'GET'])
def bot_webhook():
    """
    Webhook inteligente para Evolution API, Baileys, Telegram y Webhooks directos.
    Permite agendamiento automatizado, consulta de disponibilidad y preparación clínica.
    """
    if request.method == 'GET':
        # Verificación de webhook (Meta / Evolution)
        challenge = request.args.get('hub.challenge')
        return challenge if challenge else jsonify({"status": "active", "service": "VitaMetrix Chatbot Engine"}), 200

    payload = request.json or {}
    sender = ""
    incoming_text = ""

    # 1. Parsear formato Evolution API / Baileys
    if "data" in payload and isinstance(payload.get("data"), dict) and "message" in payload.get("data", {}):
        msg_data = payload["data"]
        sender = msg_data.get("key", {}).get("remoteJid", "").split('@')[0]
        msg = msg_data.get("message", {})
        incoming_text = msg.get("conversation") or msg.get("extendedTextMessage", {}).get("text", "")
    # 2. Parsear formato Telegram
    elif "message" in payload and isinstance(payload.get("message"), dict):
        tele_msg = payload.get("message", {})
        sender_info = tele_msg.get("from")
        sender = sender_info.get("first_name", "Paciente") if isinstance(sender_info, dict) else "Paciente"
        incoming_text = tele_msg.get("text", "")
    # 3. Formato directo / REST
    else:
        sender = str(payload.get("sender") or "Paciente")
        incoming_text = str(payload.get("message") or "")

    text_clean = incoming_text.lower().strip()
    response_msg = ""
    action_taken = "none"

    if any(k in text_clean for k in ["agendar", "cita", "turno", "reservar", "1"]):
        action_taken = "booking_flow"
        response_msg = (
            f"¡Hola {sender}! 👋 Te ayudo a agendar tu Evaluación de Bioimpedancia (BIA) en VitaMetrix.\n\n"
            "📅 *Horarios Disponibles para esta semana:*\n"
            "• Mañanas: 09:00 AM, 10:30 AM, 11:45 AM\n"
            "• Tardes: 03:30 PM, 04:45 PM, 06:00 PM\n\n"
            "Por favor responde con tu *Nombre completo* y la *Fecha y Hora deseada* (ej: 'Marta Díaz, Mañana a las 10:30 AM')."
        )
    elif any(k in text_clean for k in ["precio", "costo", "tarifa", "cuanto", "2"]):
        action_taken = "pricing_info"
        response_msg = (
            "📊 *Evaluación Integral de Bioimpedancia y Salud Celular (VitaMetrix)*\n\n"
            "El estudio incluye:\n"
            "✅ Análisis Vectorial BIVA (Agua Celular & Membranas)\n"
            "✅ Puntuación TRU Body Score (Músculo vs Grasa)\n"
            "✅ Gasto Energético Metabólico (REE / TEE)\n"
            "✅ Músculo Segmental y Grasa Visceral (Riesgo IDF)\n"
            "✅ Informe Clínico Digital en PDF\n\n"
            "Responde *1* si deseas reservar tu turno."
        )
    elif any(k in text_clean for k in ["preparacion", "ayuno", "indicacion", "requisito", "3"]):
        action_taken = "prep_instructions"
        response_msg = (
            "📋 *Indicaciones previas para tu prueba de Bioimpedancia:*\n\n"
            "1. Ayuno de alimentos y líquidos de al menos 2 horas.\n"
            "2. No realizar actividad física intensa 12 horas antes.\n"
            "3. Evitar cafeína o diuréticos previo al examen.\n"
            "4. Asistir con ropa cómoda y sin joyas/metales en tobillos y muñecas.\n\n"
            "¡Te esperamos!"
        )
    elif any(k in text_clean for k in ["doctor", "humano", "especialista", "4"]):
        action_taken = "human_escalation"
        response_msg = (
            "👨‍⚕️ He notificado a nuestro equipo médico. Un especialista se comunicará contigo a la brevedad.\n"
            "Horario de atención: Lunes a Viernes de 08:30 a 19:00."
        )
    else:
        action_taken = "menu"
        response_msg = (
            f"¡Hola {sender}! 👋 Bienvenido/a al servicio de atención de *VitaMetrix*.\n\n"
            "¿En qué podemos ayudarte hoy?\n\n"
            "1️⃣ Agendar una Evaluación de Bioimpedancia\n"
            "2️⃣ Conocer qué incluye el análisis y tarifas\n"
            "3️⃣ Indicaciones previas a la prueba (ayuno/preparación)\n"
            "4️⃣ Hablar con un especialista"
        )

    return jsonify({
        "success": True,
        "sender": sender,
        "received": incoming_text,
        "response": response_msg,
        "action": action_taken,
        "human_delay_seconds": 2.5
    }), 200

@app.route('/api/health', methods=['GET'])
def health():
    """Health check para Render y monitores de uptime."""
    db_status = "connected" if supabase else "no-credentials"
    return jsonify({"status": "ok", "supabase": db_status}), 200

if __name__ == '__main__':
    debug_mode = os.environ.get("FLASK_DEBUG", "0") == "1"
    app.run(debug=debug_mode, host='0.0.0.0', port=int(os.environ.get("PORT", 5000)))