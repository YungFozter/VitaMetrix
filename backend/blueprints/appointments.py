import os
import json
import logging
import uuid
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify

from services.helpers import (
    supabase,
    _clean_str,
    _get_current_user,
    _is_subscription_active
)

appointments_bp = Blueprint('appointments_bp', __name__)

_APPOINTMENTS_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "appointments.json")

def _load_persisted_appointments():
    if os.path.exists(_APPOINTMENTS_PATH):
        try:
            with open(_APPOINTMENTS_PATH, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logging.warning("Error al leer appointments.json: %s", e)
    return []

def _save_persisted_appointments(apps):
    try:
        os.makedirs(os.path.dirname(_APPOINTMENTS_PATH), exist_ok=True)
        with open(_APPOINTMENTS_PATH, 'w', encoding='utf-8') as f:
            json.dump(apps, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        logging.error("Error al guardar appointments.json: %s", e)
        return False

_LOCAL_APPOINTMENTS = _load_persisted_appointments()

@appointments_bp.route('/api/appointments', methods=['GET'])
def list_appointments():
    current_user = _get_current_user()
    current_uid = current_user.get('id') if current_user else None

    apps = []
    if supabase:
        try:
            res = supabase.table('appointments').select('*').order('date', desc=False).execute()
            if res.data is not None:
                apps = res.data
        except Exception as e:
            logging.warning("No se pudo obtener citas desde Supabase: %s", e)

    if not apps:
        apps = _load_persisted_appointments()

    if current_uid and current_user.get('role') != 'admin':
        filtered = []
        for a in apps:
            a_uid = a.get('user_id')
            if not a_uid or a_uid in ('usr-doctor-001', 'None', 'null', ''):
                a['user_id'] = current_uid
                a_uid = current_uid
            if a_uid == current_uid:
                filtered.append(a)
        return jsonify(filtered)

    return jsonify(apps)

@appointments_bp.route('/api/appointments', methods=['POST'])
def create_appointment():
    current_user = _get_current_user()
    if not current_user:
        return jsonify({"error": "No autorizado"}), 401
    if not _is_subscription_active(current_user):
        return jsonify({
            "error": "Tu suscripción ha vencido. Canjea un PIN para agendar citas.",
            "subscription_expired": True
        }), 403

    current_uid = current_user.get('id')
    data = request.json or {}

    patient_name = _clean_str(data.get('patient_name'), max_len=100)
    if not patient_name:
        return jsonify({"error": "El nombre del paciente es obligatorio"}), 400

    app_date = _clean_str(data.get('date'), max_len=20)
    app_time = _clean_str(data.get('time'), max_len=20)
    if not app_date or not app_time:
        return jsonify({"error": "La fecha y hora de la cita son obligatorias"}), 400

    app_id = str(uuid.uuid4())
    new_app = {
        "id": app_id,
        "user_id": current_uid,
        "patient_name": patient_name,
        "patient_phone": _clean_str(data.get('patient_phone'), max_len=30),
        "patient_idp": _clean_str(data.get('patient_idp'), max_len=50),
        "date": app_date,
        "time": app_time,
        "type": _clean_str(data.get('type'), max_len=50) or "Evaluación Inicial BIA",
        "status": _clean_str(data.get('status'), max_len=20) or "confirmed",
        "notes": _clean_str(data.get('notes'), max_len=500),
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    _LOCAL_APPOINTMENTS.append(new_app)
    _save_persisted_appointments(_LOCAL_APPOINTMENTS)

    if supabase:
        try:
            supabase.table('appointments').insert({
                "id": app_id,
                "user_id": current_uid,
                "patient_name": patient_name,
                "patient_phone": new_app['patient_phone'],
                "patient_idp": new_app['patient_idp'],
                "date": app_date,
                "time": app_time,
                "type": new_app['type'],
                "status": new_app['status'],
                "notes": new_app['notes'],
                "created_at": new_app['created_at']
            }).execute()
        except Exception as e:
            logging.warning("No se pudo insertar cita en Supabase: %s", e)

    return jsonify({"success": True, "appointment": new_app}), 201

@appointments_bp.route('/api/appointments/<app_id>', methods=['PUT'])
def update_appointment(app_id):
    current_user = _get_current_user()
    if not current_user:
        return jsonify({"error": "No autorizado"}), 401

    data = request.json or {}
    updated = {}

    if 'status' in data:
        updated['status'] = _clean_str(data.get('status'), max_len=20)
    if 'notes' in data:
        updated['notes'] = _clean_str(data.get('notes'), max_len=500)
    if 'date' in data:
        updated['date'] = _clean_str(data.get('date'), max_len=20)
    if 'time' in data:
        updated['time'] = _clean_str(data.get('time'), max_len=20)

    for a in _LOCAL_APPOINTMENTS:
        if str(a.get('id')) == str(app_id):
            a.update(updated)
            break
    _save_persisted_appointments(_LOCAL_APPOINTMENTS)

    if supabase:
        try:
            supabase.table('appointments').update(updated).eq('id', str(app_id)).execute()
        except Exception as e:
            logging.warning("No se pudo actualizar cita en Supabase: %s", e)

    return jsonify({"success": True, "message": "Cita actualizada correctamente."})

@appointments_bp.route('/api/appointments/<app_id>', methods=['DELETE'])
def delete_appointment(app_id):
    current_user = _get_current_user()
    if not current_user:
        return jsonify({"error": "No autorizado"}), 401

    global _LOCAL_APPOINTMENTS
    _LOCAL_APPOINTMENTS = [a for a in _LOCAL_APPOINTMENTS if str(a.get('id')) != str(app_id)]
    _save_persisted_appointments(_LOCAL_APPOINTMENTS)

    if supabase:
        try:
            supabase.table('appointments').delete().eq('id', str(app_id)).execute()
        except Exception as e:
            logging.warning("No se pudo borrar cita en Supabase: %s", e)

    return jsonify({"success": True, "message": "Cita eliminada correctamente."})
