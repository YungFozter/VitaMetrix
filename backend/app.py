from flask import Flask, render_template, jsonify
from calculations import calculate_phase_angle, get_biva_interpretation
import json
import os

app = Flask(
    __name__,
    template_folder='../frontend/templates',
    static_folder='../frontend/static'
)

# Ruta para cargar los datos del archivo JSON (simulando base de datos)
def load_patient_data():
    data_path = os.path.join(os.path.dirname(__file__), '../data/sample_data.json')
    with open(data_path, 'r') as file:
        return json.load(file)

# Ruta principal: Sirve el HTML
@app.route('/')
def index():
    return render_template('index.html')

# Ruta de la API: Entrega los datos en formato JSON para que JS los consuma
@app.route('/api/dashboard-data')
def dashboard_data():
    raw_data = load_patient_data()
    
    # Extraemos los valores crudos
    r = raw_data['resistance']
    xc = raw_data['reactance']
    
    # Calculamos el ángulo de fase y la interpretación
    biva_info = get_biva_interpretation(r, xc)
    
    # Construimos la respuesta completa uniendo todo
    response = {
        "score": raw_data['score'],
        "rank": raw_data['rank'],
        "muscle_score": raw_data['muscle_score'],
        "fat_score": raw_data['fat_score'],
        "resistance": r,
        "reactance": xc,
        "phase_angle": biva_info['phase_angle'],
        "cell_status": biva_info['cell_status'],
        "hydration_status": biva_info['hydration'],
        "ree_kcal": raw_data['ree_kcal'],
        "tee_kcal": raw_data['tee_kcal'],
        "pal": raw_data['pal']
    }
    return jsonify(response)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)