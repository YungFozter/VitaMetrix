import os
import sys

# Asegurar que el directorio del módulo (backend/) esté en sys.path para que
# `import calculations` / `import reference` funcione tanto con
# `python backend/app.py` como con `flask --app backend.app` o `gunicorn backend.app:app`.
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

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
    analyze_segmental,
    analyze_composition_indices,
)

load_dotenv()

app = Flask(
    __name__,
    template_folder='../frontend/templates',
    static_folder='../frontend/static'
)

# Inicializar Supabase
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

supabase: Client = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
else:
    print("WARNING: Supabase credentials not found in .env")

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/dashboard-stats', methods=['GET'])
def dashboard_stats():
    if not supabase:
        return jsonify({"total_patients": 0, "total_evaluations": 0, "avg_score": 0, "recent": [], "population": {}})
        
    try:
        # Get count of unique clients from 'clients' table
        clients_res = supabase.table('clients').select('id', count='exact').execute()
        total_clients = clients_res.count if clients_res.count is not None else 0
        
        # Get all evaluations
        evals_res = supabase.table('evaluations').select('*').order('created_at', desc=True).execute()
        evaluations = evals_res.data
        
        total_evaluations = len(evaluations)
        
        # Calculate Average Score
        valid_scores = [float(e['global_score']) for e in evaluations if e.get('global_score') is not None]
        avg_score = round(sum(valid_scores) / len(valid_scores), 1) if valid_scores else 0
        
        # Population stats (Cell Status)
        cell_status_counts = {"Óptimo": 0, "Límite": 0, "Bajo": 0}
        
        # Format recent and calculate status
        recent = []
        for e in evaluations:
            # Re-calculate phase angle / cell status since it's not in DB
            biva_info = get_biva_interpretation(float(e.get('resistance', 0)), float(e.get('reactance', 0)))
            c_status = biva_info['cell_status']
            
            # Count for population
            if "Óptimo" in c_status: cell_status_counts["Óptimo"] += 1
            elif "Bajo" in c_status: cell_status_counts["Bajo"] += 1
            else: cell_status_counts["Límite"] += 1
            
            # Save top 5 recent
            if len(recent) < 5:
                recent.append({
                    "name": e.get('patient_name', 'Unknown'),
                    "date": e.get('created_at', '').split('T')[0],
                    "score": e.get('global_score', 0),
                    "phase_angle": biva_info['phase_angle']
                })
        
        return jsonify({
            "total_clients": total_clients,
            "total_evaluations": total_evaluations,
            "avg_score": avg_score,
            "recent": recent,
            "population": cell_status_counts
        })
    except Exception as e:
        print(f"Error fetching stats: {e}")
        return jsonify({"total_patients": 0, "total_evaluations": 0, "avg_score": 0, "recent": [], "population": {}}), 500

def _run_analysis(data):
    """
    FASE 5: Núcleo de cálculo unificado.
    Recibe el payload del formulario, ejecuta los Módulos 1-7 (BIVA, Scores,
    hidratación, visceral, energético, segmental, percentiles, índices, BCC)
    y devuelve UN diccionario con todo. Lo comparten /api/calculate (compat)
    y /api/dashboard-data (endpoint canónico del manual).
    """
    # NUEVOS CAMPOS DEL DISPOSITIVO (Opción A) — todos opcionales
    smm = data.get('smm')           # Masa muscular esquelética (kg)
    tbw = data.get('tbw')           # Agua total corporal (L)
    ecw = data.get('ecw')           # Agua extracelular (L)
    fat_mass = data.get('fat_mass') # Masa grasa (kg)
    visceral_fat = data.get('visceral_fat')  # Grasa visceral (L)
    waist = data.get('waist')       # Circunferencia de cintura (cm)
    # Campos Fase 3 (opcionales, del dispositivo)
    phase_angle_dev = data.get('phase_angle_dev')  # Ángulo de fase medido por el equipo
    seg_arm_r = data.get('seg_arm_r')
    seg_arm_l = data.get('seg_arm_l')
    seg_torso = data.get('seg_torso')
    seg_leg_r = data.get('seg_leg_r')
    seg_leg_l = data.get('seg_leg_l')
    # Índices ya calculados por el dispositivo (opcionales; si no, los estimamos)
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

    # Datos paciente
    patient_idp = data.get('patient_idp', '000000')
    patient_name = data.get('patient_name', 'Unknown')

    # Datos fisicos
    r = _num(data.get('resistance', 0)) or 0
    xc = _num(data.get('reactance', 0)) or 0
    weight = _num(data.get('weight', 0)) or 0
    height = _num(data.get('height', 0)) or 0
    age = int(_num(data.get('age', 0)) or 0)
    gender = data.get('gender', 'male')
    pal = _num(data.get('pal', 1.2)) or 1.2

    # Cálculos - Módulos
    biva_info = get_biva_interpretation(r, xc)
    energy_info = calculate_energy(weight, height, age, gender, pal, smm=smm)
    scores = calculate_scores(weight, height, biva_info['phase_angle'],
                              smm=smm, fat_mass=fat_mass, gender=gender)
    hydration_info = analyze_hydration(tbw=tbw, ecw=ecw, weight=weight)
    visceral_info = analyze_visceral_fat(waist_cm=waist, visceral_fat_l=visceral_fat, gender=gender)
    clinical_findings = build_clinical_report(
        biva_info, hydration_info, visceral_info, scores,
        biva_info['phase_angle'],
        ecw_tbw_ratio=hydration_info.get('ecw_tbw_ratio')
    )

    # --- FASE 3: Módulos 3, 6 + índices de composición (reference.py) ---
    phase_for_percentile = phase_angle_dev if phase_angle_dev else biva_info['phase_angle']
    phase_percentile = get_phase_angle_percentile(phase_for_percentile, age, gender)
    smm_percentile = get_smm_percentile(smm, age, gender) if smm else None
    smm_curves = get_smm_age_curves(gender) if smm else None

    segments = {
        'arm_right': seg_arm_r, 'arm_left': seg_arm_l,
        'torso': seg_torso, 'leg_right': seg_leg_r, 'leg_left': seg_leg_l
    }
    has_segments = any(v is not None for v in segments.values())
    segmental_info = analyze_segmental(segments, gender) if has_segments else {"segments": {}, "asymmetries": []}

    # Índices: usar los del dispositivo si se dieron, si no estimar
    if dev_imc or dev_fmi or dev_ffmi or dev_fm_pct or dev_smi:
        composition_indices = {
            "available": True,
            "imc": dev_imc, "imc_status": None,
            "fmi": dev_fmi, "fmi_status": None,
            "ffmi": dev_ffmi, "ffmi_status": None,
            "fm_pct": dev_fm_pct, "fm_pct_status": None,
            "smi": dev_smi, "smi_status": None,
            "from_device": True
        }
    else:
        composition_indices = analyze_composition_indices(weight, height, fat_mass, smm, gender)

    # BCC (gráfico grasa vs músculo): posición relativa estimada
    bcc = {"available": False}
    if fat_mass and smm and weight:
        bcc = {
            "available": True,
            "fat_pct": round(fat_mass / weight * 100, 1),
            "muscle_pct": round(smm / weight * 100, 1)
        }

    # Guardar en Supabase (columnas nuevas son opcionales; se ignoran si no existen)
    if supabase:
        try:
            supabase.table('evaluations').insert({
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
                "waist": waist
            }).execute()
        except Exception as e:
            print(f"Error saving to supabase: {e}")

    # Respuesta unificada (Módulos 1-7 + informe clínico)
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
        # Fase 3: módulos 3, 6 + índices
        "phase_percentile": phase_percentile,
        "smm_percentile": smm_percentile,
        "smm_curves": smm_curves,
        "segmental": segmental_info,
        "composition_indices": composition_indices,
        "bcc": bcc,
        # Fase 7: datos para gráficos (BIVA normalizado por altura, curva SMM)
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
    """
    FASE 5: Endpoint unificado según el manual (Pagina2 Analyzer.md).
    El frontend envía los datos del formulario y recibe UN JSON con los
    Módulos 1-7 + el informe clínico concatenado. Sustituye a /api/calculate
    como ruta canónica del flujo de la pantalla de Bioimpedancia.
    """
    data = request.json or {}
    return jsonify(_run_analysis(data))

# --- RUTAS DE CLIENTES ---

@app.route('/api/clients', methods=['GET'])
def get_clients():
    if not supabase: return jsonify([]), 500
    try:
        res = supabase.table('clients').select('*').order('code').execute()
        return jsonify(res.data)
    except Exception as e:
        print("Error fetching clients:", e)
        return jsonify({"error": str(e)}), 500

@app.route('/api/clients', methods=['POST'])
def add_client():
    if not supabase: return jsonify({"error": "No db"}), 500
    data = request.json
    name = data.get('name')
    phone = data.get('phone', '')
    email = data.get('email', '')
    
    if not name:
        return jsonify({"error": "El nombre es obligatorio"}), 400
        
    try:
        # Lógica de reciclaje de códigos
        res = supabase.table('clients').select('code').execute()
        codes = [row['code'] for row in res.data if row.get('code') is not None]
        codes.sort()
        
        new_code = 1
        for code in codes:
            if code == new_code:
                new_code += 1
            elif code > new_code:
                break
                
        # Guardar en Supabase
        new_client = {
            "code": new_code,
            "name": name,
            "phone": phone,
            "email": email
        }
        res_insert = supabase.table('clients').insert(new_client).execute()
        
        return jsonify({"success": True, "data": res_insert.data[0] if res_insert.data else {}})
    except Exception as e:
        print("Error adding client:", e)
        return jsonify({"error": str(e)}), 500

@app.route('/api/clients/<string:client_id>', methods=['PUT'])
def update_client(client_id):
    if not supabase: return jsonify({"error": "No db"}), 500
    data = request.json
    name = data.get('name')
    phone = data.get('phone', '')
    email = data.get('email', '')
    
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
        print("Error updating client:", e)
        return jsonify({"error": str(e)}), 500

@app.route('/api/clients/<string:client_id>', methods=['DELETE'])
def delete_client(client_id):
    if not supabase: return jsonify({"error": "No db"}), 500
    try:
        supabase.table('clients').delete().eq('id', client_id).execute()
        return jsonify({"success": True})
    except Exception as e:
        print("Error deleting client:", e)
        return jsonify({"error": str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health():
    """Health check for Render (and other uptime monitors)."""
    db_status = "connected" if supabase else "no-credentials"
    return jsonify({"status": "ok", "supabase": db_status}), 200

if __name__ == '__main__':
    # Never run with debug=True in production. The flag is opt-in via env var
    # so `python backend/app.py` locally stays safe by default.
    debug_mode = os.environ.get("FLASK_DEBUG", "0") == "1"
    app.run(debug=debug_mode, host='0.0.0.0', port=int(os.environ.get("PORT", 5000)))