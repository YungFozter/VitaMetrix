import os
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
from supabase import create_client, Client
from calculations import get_biva_interpretation, calculate_energy, calculate_scores

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

@app.route('/api/calculate', methods=['POST'])
def calculate():
    data = request.json
    
    # Datos paciente
    patient_idp = data.get('patient_idp', '000000')
    patient_name = data.get('patient_name', 'Unknown')
    
    # Datos fisicos
    r = data.get('resistance', 0)
    xc = data.get('reactance', 0)
    weight = data.get('weight', 0)
    height = data.get('height', 0)
    age = data.get('age', 0)
    gender = data.get('gender', 'male')
    pal = data.get('pal', 1.2)
    
    # Cálculos
    biva_info = get_biva_interpretation(r, xc)
    energy_info = calculate_energy(weight, height, age, gender, pal)
    scores = calculate_scores(weight, height, biva_info['phase_angle'])
    
    # Guardar en Supabase
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
                "fat_score": scores['fat_score']
            }).execute()
        except Exception as e:
            print(f"Error saving to supabase: {e}")
    
    # Respuesta
    response = {
        "score": scores['score'],
        "rank": scores['rank'],
        "muscle_score": scores['muscle_score'],
        "fat_score": scores['fat_score'],
        "phase_angle": biva_info['phase_angle'],
        "cell_status": biva_info['cell_status'],
        "hydration_status": biva_info['hydration'],
        "ree_kcal": energy_info['ree_kcal'],
        "tee_kcal": energy_info['tee_kcal']
    }
    
    return jsonify(response)

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

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)