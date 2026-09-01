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
    _is_subscription_active,
    _invalidate_dashboard_cache,
    _load_persisted_clients,
    _save_persisted_clients
)

clients_bp = Blueprint('clients_bp', __name__)

_LOCAL_CLIENTS = _load_persisted_clients()

@clients_bp.route('/api/clients', methods=['GET'])
def list_clients():
    current_user = _get_current_user()
    current_uid = current_user.get('id') if current_user else None

    clients = []
    if supabase:
        try:
            res = supabase.table('clients').select('*').order('created_at', desc=True).execute()
            if res.data is not None:
                clients = res.data
        except Exception as e:
            logging.warning("No se pudo obtener clientes desde Supabase: %s", e)

    if not clients:
        clients = _load_persisted_clients()

    if current_uid and current_user.get('role') != 'admin':
        filtered = []
        for c in clients:
            c_uid = c.get('user_id')
            if not c_uid or c_uid in ('usr-doctor-001', 'None', 'null', ''):
                c['user_id'] = current_uid
                c_uid = current_uid
            if c_uid == current_uid:
                filtered.append(c)
        return jsonify(filtered)

    return jsonify(clients)

@clients_bp.route('/api/clients', methods=['POST'])
def create_client():
    current_user = _get_current_user()
    if not current_user:
        return jsonify({"error": "No autorizado"}), 401
    if not _is_subscription_active(current_user):
        return jsonify({
            "error": "Tu suscripción ha vencido. Canjea un PIN para guardar pacientes.",
            "subscription_expired": True
        }), 403

    current_uid = current_user.get('id')
    data = request.json or {}

    name = _clean_str(data.get('name'), max_len=100)
    if not name:
        return jsonify({"error": "El nombre del paciente es obligatorio"}), 400

    phone = _clean_str(data.get('phone'), max_len=30)
    email = _clean_str(data.get('email'), max_len=100)
    idp = _clean_str(data.get('idp') or data.get('patient_idp'), max_len=50)
    gender = _clean_str(data.get('gender'), max_len=10) or "male"
    age = int(data.get('age') or 0)
    weight = float(data.get('weight') or 0)
    height = float(data.get('height') or 0)
    notes = _clean_str(data.get('notes'), max_len=500)

    client_id = str(uuid.uuid4())
    new_client = {
        "id": client_id,
        "user_id": current_uid,
        "name": name,
        "phone": phone,
        "email": email,
        "patient_idp": idp,
        "gender": gender,
        "age": age,
        "weight": weight,
        "height": height,
        "notes": notes,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    _LOCAL_CLIENTS.insert(0, new_client)
    _save_persisted_clients(_LOCAL_CLIENTS)

    if supabase:
        try:
            supabase.table('clients').insert({
                "id": client_id,
                "user_id": current_uid,
                "name": name,
                "phone": phone,
                "email": email,
                "created_at": new_client['created_at']
            }).execute()
        except Exception as e:
            logging.warning("No se pudo insertar cliente en Supabase: %s", e)

    _invalidate_dashboard_cache()
    return jsonify({"success": True, "client": new_client}), 201

@clients_bp.route('/api/clients/<client_id>', methods=['PUT'])
def update_client(client_id):
    current_user = _get_current_user()
    if not current_user:
        return jsonify({"error": "No autorizado"}), 401

    current_uid = current_user.get('id')
    data = request.json or {}
    updated = {}

    if 'name' in data:
        updated['name'] = _clean_str(data.get('name'), max_len=100)
    if 'phone' in data:
        updated['phone'] = _clean_str(data.get('phone'), max_len=30)
    if 'email' in data:
        updated['email'] = _clean_str(data.get('email'), max_len=100)
    if 'patient_idp' in data or 'idp' in data:
        updated['patient_idp'] = _clean_str(data.get('patient_idp') or data.get('idp'), max_len=50)

    for c in _LOCAL_CLIENTS:
        if str(c.get('id')) == str(client_id):
            c.update(updated)
            break
    _save_persisted_clients(_LOCAL_CLIENTS)

    if supabase:
        try:
            supabase.table('clients').update(updated).eq('id', str(client_id)).execute()
        except Exception as e:
            logging.warning("No se pudo actualizar cliente en Supabase: %s", e)

    return jsonify({"success": True, "message": "Paciente actualizado correctamente."})

@clients_bp.route('/api/clients/<client_id>', methods=['DELETE'])
def delete_client(client_id):
    current_user = _get_current_user()
    if not current_user:
        return jsonify({"error": "No autorizado"}), 401

    global _LOCAL_CLIENTS
    _LOCAL_CLIENTS = [c for c in _LOCAL_CLIENTS if str(c.get('id')) != str(client_id)]
    _save_persisted_clients(_LOCAL_CLIENTS)

    if supabase:
        try:
            supabase.table('clients').delete().eq('id', str(client_id)).execute()
        except Exception as e:
            logging.warning("No se pudo borrar cliente en Supabase: %s", e)

    _invalidate_dashboard_cache()
    return jsonify({"success": True, "message": "Paciente eliminado."})
