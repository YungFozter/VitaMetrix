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
        return jsonify({"total_patients": 0, "total_evaluations": 0})
        
    try:
        # Get count of unique patients
        response = supabase.table('evaluations').select('patient_idp').execute()
        evaluations = response.data
        
        total_evaluations = len(evaluations)
        unique_patients = len(set(e.get('patient_idp') for e in evaluations if e.get('patient_idp')))
        
        return jsonify({
            "total_patients": unique_patients,
            "total_evaluations": total_evaluations
        })
    except Exception as e:
        print(f"Error fetching stats: {e}")
        return jsonify({"total_patients": 0, "total_evaluations": 0}), 500

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

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)