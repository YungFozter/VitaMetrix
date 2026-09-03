import os
import json
import logging
import uuid
import re
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify

from services.helpers import (
    supabase,
    _clean_str,
    _get_current_user,
    _is_subscription_active,
    _invalidate_dashboard_cache,
    _load_persisted_clients,
    _save_persisted_clients,
    _now_bolivia
)

clients_bp = Blueprint('clients_bp', __name__)

_LOCAL_CLIENTS = _load_persisted_clients()
if not isinstance(_LOCAL_CLIENTS, list):
    _LOCAL_CLIENTS = []

def _get_next_client_code(clients_list):
    existing_codes = set()
    for c in clients_list:
        if not isinstance(c, dict):
            continue
        c_code = c.get('code')
        if c_code is not None:
            try:
                num = int(c_code)
                if num > 0:
                    existing_codes.add(num)
            except (ValueError, TypeError):
                pass
        c_idp = str(c.get('patient_idp') or c.get('idp') or '')
        match = re.search(r'IDP-?(\d+)', c_idp, re.IGNORECASE)
        if match:
            try:
                num = int(match.group(1))
                if num > 0:
                    existing_codes.add(num)
            except ValueError:
                pass

    next_num = 1
    while next_num in existing_codes:
        next_num += 1
    return next_num

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

    if not isinstance(clients, list):
        clients = []

    user_email = (current_user.get('email') or '').strip().lower() if current_user else ''
    user_name = (current_user.get('full_name') or current_user.get('name') or '').strip().lower() if current_user else ''

    cleaned_clients = []
    for c in clients:
        if not isinstance(c, dict):
            continue
        c_email = (c.get('email') or '').strip().lower()
        c_name = (c.get('name') or '').strip().lower()

        # Filtro de protección: Ignorar si coincide exactamente el correo del médico logueado
        if user_email and c_email and c_email == user_email:
            continue
        if user_name and c_name and c_name == user_name and user_email and c_email == user_email:
            continue

        if not c.get('idp') and c.get('patient_idp'):
            c['idp'] = c['patient_idp']
        elif not c.get('patient_idp') and c.get('idp'):
            c['patient_idp'] = c['idp']

        cleaned_clients.append(c)

    if current_uid and current_user.get('role') != 'admin':
        filtered = []
        for c in cleaned_clients:
            c_uid = c.get('user_id')
            if not c_uid or c_uid in ('usr-doctor-001', 'None', 'null', ''):
                c['user_id'] = current_uid
                c_uid = current_uid
            if c_uid == current_uid:
                filtered.append(c)
        return jsonify(filtered)

    return jsonify(cleaned_clients)

@clients_bp.route('/api/clients', methods=['POST'])
def create_client():
    current_user = _get_current_user()
    if not current_user:
        return jsonify({"error": "No autorizado", "success": False}), 401
    if not _is_subscription_active(current_user):
        return jsonify({
            "error": "Tu suscripción ha vencido. Canjea un PIN para guardar pacientes.",
            "subscription_expired": True,
            "success": False
        }), 403

    current_uid = current_user.get('id')
    data = request.json or {}

    name = _clean_str(data.get('name') or data.get('patient_name'), max_len=100)
    if not name:
        return jsonify({"error": "El nombre del paciente es obligatorio", "success": False}), 400

    email = _clean_str(data.get('email'), max_len=100)
    user_email = (current_user.get('email') or '').strip().lower()
    if email and user_email and email.lower().strip() == user_email:
        return jsonify({"error": "No puedes registrarte a ti mismo como paciente usando tu correo de usuario médico", "success": False}), 400

    phone = _clean_str(data.get('phone'), max_len=30)
    idp_input = _clean_str(data.get('idp') or data.get('patient_idp'), max_len=50)
    gender = _clean_str(data.get('gender'), max_len=10) or "male"
    age = int(data.get('age') or 0)
    weight = float(data.get('weight') or 0)
    height = float(data.get('height') or 0)
    notes = _clean_str(data.get('notes'), max_len=500)

    global _LOCAL_CLIENTS
    if not isinstance(_LOCAL_CLIENTS, list):
        _LOCAL_CLIENTS = _load_persisted_clients()

    next_code = _get_next_client_code(_LOCAL_CLIENTS)
    final_idp = idp_input if idp_input else f"IDP-{next_code:04d}"

    client_id = str(uuid.uuid4())
    new_client = {
        "id": client_id,
        "user_id": current_uid,
        "code": next_code,
        "patient_idp": final_idp,
        "idp": final_idp,
        "name": name,
        "phone": phone,
        "email": email,
        "gender": gender,
        "age": age,
        "weight": weight,
        "height": height,
        "notes": notes,
        "created_at": _now_bolivia().isoformat()
    }

    _LOCAL_CLIENTS.insert(0, new_client)
    _save_persisted_clients(_LOCAL_CLIENTS)

    if supabase:
        try:
            supabase.table('clients').insert({
                "id": client_id,
                "user_id": current_uid,
                "code": next_code,
                "patient_idp": final_idp,
                "name": name,
                "phone": phone,
                "email": email,
                "gender": gender,
                "age": age,
                "weight": weight,
                "height": height,
                "notes": notes,
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
        return jsonify({"error": "No autorizado", "success": False}), 401

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
        idp_val = _clean_str(data.get('patient_idp') or data.get('idp'), max_len=50)
        updated['patient_idp'] = idp_val
        updated['idp'] = idp_val
    if 'gender' in data:
        updated['gender'] = _clean_str(data.get('gender'), max_len=10)
    if 'age' in data:
        try:
            updated['age'] = int(data.get('age') or 0)
        except (ValueError, TypeError):
            pass
    if 'weight' in data:
        try:
            updated['weight'] = float(data.get('weight') or 0)
        except (ValueError, TypeError):
            pass
    if 'height' in data:
        try:
            updated['height'] = float(data.get('height') or 0)
        except (ValueError, TypeError):
            pass
    if 'notes' in data:
        updated['notes'] = _clean_str(data.get('notes'), max_len=500)

    global _LOCAL_CLIENTS
    target = None
    for c in _LOCAL_CLIENTS:
        if str(c.get('id')) == str(client_id):
            c.update(updated)
            target = c
            break
    _save_persisted_clients(_LOCAL_CLIENTS)

    if supabase:
        try:
            supa_update = {k: v for k, v in updated.items() if k != 'idp'}
            supabase.table('clients').update(supa_update).eq('id', str(client_id)).execute()
        except Exception as e:
            logging.warning("No se pudo actualizar cliente en Supabase: %s", e)

    return jsonify({"success": True, "client": target, "message": "Paciente actualizado correctamente."})

@clients_bp.route('/api/clients/<client_id>', methods=['DELETE'])
def delete_client(client_id):
    current_user = _get_current_user()
    if not current_user:
        return jsonify({"error": "No autorizado", "success": False}), 401

    global _LOCAL_CLIENTS
    _LOCAL_CLIENTS = [c for c in _LOCAL_CLIENTS if str(c.get('id')) != str(client_id)]
    _save_persisted_clients(_LOCAL_CLIENTS)

    if supabase:
        try:
            supabase.table('clients').delete().eq('id', str(client_id)).execute()
        except Exception as e:
            logging.warning("No se pudo borrar cliente en Supabase: %s", e)

    _invalidate_dashboard_cache()
    return jsonify({"success": True, "message": "Paciente eliminado correctamente."})
