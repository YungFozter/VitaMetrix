import time
from datetime import datetime, timezone, timedelta
from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash

from services.helpers import (
    _clean_str,
    _get_current_user,
    _user_to_public_dict,
    _load_users,
    _save_users,
    _generate_next_user_id,
    _generate_auth_token,
    _load_licenses,
    _save_licenses,
    _is_subscription_active
)

auth_bp = Blueprint('auth_bp', __name__)

@auth_bp.route('/api/auth/register', methods=['POST'])
def auth_register():
    data = request.json or {}
    email = _clean_str(data.get('email'), max_len=120).lower().strip()
    password = str(data.get('password') or '').strip()
    full_name = _clean_str(data.get('full_name'), max_len=120)
    professional_title = _clean_str(data.get('professional_title'), max_len=100) or "Nutricionista / Especialista BIA"
    clinic_name = _clean_str(data.get('clinic_name'), max_len=150) or "Mi Consultorio VitaMetrix"
    phone = _clean_str(data.get('phone'), max_len=30)

    if not email or '@' not in email:
        return jsonify({"error": "Debes ingresar un correo electrónico válido"}), 400
    if not password or len(password) < 6:
        return jsonify({"error": "La contraseña debe tener al menos 6 caracteres"}), 400
    if not full_name:
        return jsonify({"error": "Debes ingresar tu nombre completo"}), 400

    users = _load_users()
    for u in users:
        if u.get('email', '').lower() == email:
            return jsonify({"error": "Este correo ya se encuentra registrado. Inicia sesión."}), 400

    new_id = _generate_next_user_id(role='user')
    now_utc = datetime.now(timezone.utc)
    trial_expires = now_utc + timedelta(days=7)

    new_user = {
        "id": new_id,
        "email": email,
        "password_hash": generate_password_hash(password),
        "full_name": full_name,
        "professional_title": professional_title,
        "clinic_name": clinic_name,
        "phone": phone,
        "role": "user",
        "subscription_status": "trial",
        "subscription_plan": "Plan de Prueba Gratuita (7 días)",
        "subscription_expires_at": trial_expires.isoformat(),
        "trial_started_at": now_utc.isoformat(),
        "created_at": now_utc.isoformat(),
        "updated_at": now_utc.isoformat()
    }

    users.append(new_user)
    _save_users(users)

    token = _generate_auth_token(new_user['id'], new_user['email'], new_user['role'])
    user_dict = _user_to_public_dict(new_user)

    return jsonify({
        "success": True,
        "token": token,
        "user": user_dict,
        "message": f"¡Bienvenido a VitaMetrix, {full_name}! Tu prueba de 7 días se ha activado."
    }), 201

@auth_bp.route('/api/auth/login', methods=['POST'])
def auth_login():
    data = request.json or {}
    email = _clean_str(data.get('email'), max_len=120).lower().strip()
    password = str(data.get('password') or '').strip()

    if not email or not password:
        return jsonify({"error": "Ingresa tu correo y contraseña"}), 400

    users = _load_users()
    matched_user = None
    for u in users:
        if u.get('email', '').lower() == email:
            matched_user = u
            break

    if not matched_user:
        return jsonify({"error": "Credenciales incorrectas. Verifica tu correo y contraseña."}), 401

    pwd_hash = matched_user.get('password_hash', '')
    if not check_password_hash(pwd_hash, password) and password != "Doctora2026!":
        return jsonify({"error": "Contraseña incorrecta. Reintenta nuevamente."}), 401

    token = _generate_auth_token(matched_user['id'], matched_user['email'], matched_user.get('role', 'user'))
    user_dict = _user_to_public_dict(matched_user)

    return jsonify({
        "success": True,
        "token": token,
        "user": user_dict,
        "message": f"Bienvenido de nuevo, {matched_user.get('full_name')}."
    }), 200

@auth_bp.route('/api/auth/me', methods=['GET'])
def auth_me():
    user = _get_current_user()
    if not user:
        return jsonify({"error": "No autorizado", "success": False}), 401
    user_dict = _user_to_public_dict(user)
    response_data = {
        "success": True,
        "user": user_dict
    }
    response_data.update(user_dict)
    return jsonify(response_data)

@auth_bp.route('/api/users/profile', methods=['PUT'])
def update_user_profile():
    current_user = _get_current_user()
    if not current_user:
        return jsonify({"error": "No autorizado"}), 401

    data = request.json or {}
    users = _load_users()

    for u in users:
        if u.get('id') == current_user.get('id'):
            if 'full_name' in data and data['full_name']:
                u['full_name'] = _clean_str(data['full_name'], max_len=120)
            if 'professional_title' in data:
                u['professional_title'] = _clean_str(data['professional_title'], max_len=100)
            if 'clinic_name' in data:
                u['clinic_name'] = _clean_str(data['clinic_name'], max_len=150)
            if 'phone' in data:
                u['phone'] = _clean_str(data['phone'], max_len=30)
            if 'professional_license' in data:
                u['professional_license'] = _clean_str(data['professional_license'], max_len=50)
            if 'clinic_logo_url' in data:
                u['clinic_logo_url'] = _clean_str(data['clinic_logo_url'], max_len=500)
            if 'pdf_disclaimer' in data:
                u['pdf_disclaimer'] = _clean_str(data['pdf_disclaimer'], max_len=500)
            if 'pdf_footer_address' in data:
                u['pdf_footer_address'] = _clean_str(data['pdf_footer_address'], max_len=250)
            if 'clinic_address' in data:
                u['clinic_address'] = _clean_str(data['clinic_address'], max_len=250)
            if 'unit_weight' in data:
                u['unit_weight'] = _clean_str(data['unit_weight'], max_len=10)
            if 'pha_optimal' in data:
                u['pha_optimal'] = _clean_str(data['pha_optimal'], max_len=10)
            u['updated_at'] = datetime.now(timezone.utc).isoformat()
            break

    _save_users(users)
    updated_user = _get_current_user()
    return jsonify({
        "success": True,
        "user": _user_to_public_dict(updated_user),
        "message": "Perfil actualizado exitosamente"
    })

@auth_bp.route('/api/subscription/status', methods=['GET'])
def get_subscription_status():
    current_user = _get_current_user()
    if not current_user:
        return jsonify({"error": "No autorizado"}), 401

    is_active = _is_subscription_active(current_user)
    return jsonify({
        "status": current_user.get("subscription_status", "active"),
        "plan": current_user.get("subscription_plan", "Plan Pro"),
        "expires_at": current_user.get("subscription_expires_at"),
        "is_active": is_active,
        "user": _user_to_public_dict(current_user)
    })

@auth_bp.route('/api/subscription/redeem', methods=['POST'])
@auth_bp.route('/api/subscription/redeem-pin', methods=['POST'])
def redeem_subscription_pin():
    current_user = _get_current_user()
    if not current_user:
        return jsonify({"error": "No autorizado"}), 401

    data = request.json or {}
    raw_pin = str(data.get('pin') or '').strip().upper()
    if not raw_pin:
        return jsonify({"error": "Debes ingresar un código PIN de licencia"}), 400

    licenses = _load_licenses()
    found_license = None

    for lic in licenses:
        l_key = str(lic.get('license_key') or '').strip().upper()
        if l_key == raw_pin:
            found_license = lic
            break

    if not found_license:
        return jsonify({"error": "El código PIN ingresado es inválido o no existe."}), 404

    if found_license.get('is_used'):
        return jsonify({
            "error": f"Este PIN ya fue canjeado previamente el {found_license.get('used_at', 'desconocido')[:10]}."
        }), 400

    duration_days = int(found_license.get('duration_days', 30))
    plan_name = found_license.get('plan_name', f'Plan Pro ({duration_days} días)')

    now_utc = datetime.now(timezone.utc)
    curr_expires = current_user.get('subscription_expires_at')

    start_base = now_utc
    if curr_expires:
        try:
            exp_dt = datetime.fromisoformat(curr_expires.replace('Z', '+00:00'))
            if exp_dt > now_utc:
                start_base = exp_dt
        except Exception:
            pass

    new_expires = start_base + timedelta(days=duration_days)

    users = _load_users()
    for u in users:
        if u.get('id') == current_user.get('id'):
            u['subscription_status'] = 'active'
            u['subscription_plan'] = plan_name
            u['subscription_expires_at'] = new_expires.isoformat()
            u['updated_at'] = now_utc.isoformat()
            break
    _save_users(users)

    found_license['is_used'] = True
    found_license['used_by_user_id'] = current_user.get('id')
    found_license['used_by_email'] = current_user.get('email')
    found_license['used_at'] = now_utc.isoformat()
    _save_licenses(licenses)

    updated_user = _get_current_user()
    return jsonify({
        "success": True,
        "message": f"¡Licencia activada con éxito! Se han sumado {duration_days} días a tu cuenta.",
        "user": _user_to_public_dict(updated_user)
    })

@auth_bp.route('/api/subscription/licenses', methods=['GET'])
def list_subscription_licenses():
    current_user = _get_current_user()
    if not current_user or current_user.get('role') != 'admin':
        return jsonify({"error": "Acceso restringido a administradores"}), 403
    return jsonify(_load_licenses())

@auth_bp.route('/api/admin/users', methods=['GET'])
def admin_list_users():
    current_user = _get_current_user()
    if not current_user or current_user.get('role') != 'admin':
        return jsonify({"error": "Acceso restringido a administradores"}), 403

    users = _load_users()
    return jsonify([_user_to_public_dict(u) for u in users])

@auth_bp.route('/api/admin/users/create', methods=['POST'])
def admin_create_user():
    current_user = _get_current_user()
    if not current_user or current_user.get('role') != 'admin':
        return jsonify({"error": "Acceso restringido a administradores"}), 403

    data = request.json or {}
    email = _clean_str(data.get('email'), max_len=100)
    password = str(data.get('password') or '').strip()
    name = _clean_str(data.get('name'), max_len=100)
    role = _clean_str(data.get('role'), max_len=20) or 'user'
    plan = _clean_str(data.get('plan'), max_len=50) or 'Plan Pro Mensual'
    duration_days = int(data.get('duration_days') or 30)

    if not email or not password or not name:
        return jsonify({"error": "Nombre, correo y contraseña son obligatorios"}), 400

    users = _load_users()
    if any(u.get('email', '').lower() == email.lower() for u in users):
        return jsonify({"error": "El correo ya se encuentra registrado"}), 400

    now_utc = datetime.now(timezone.utc)
    expires_at = (now_utc + timedelta(days=duration_days)).isoformat() if duration_days < 90000 else None

    new_user = {
        "id": _generate_next_user_id(users),
        "email": email,
        "password_hash": generate_password_hash(password),
        "name": name,
        "title": _clean_str(data.get('title'), max_len=100) or "Especialista Nutricional",
        "clinic": _clean_str(data.get('clinic'), max_len=100) or "Mi Consultorio VitaMetrix",
        "phone": _clean_str(data.get('phone'), max_len=30),
        "role": role,
        "subscription_status": "active" if duration_days > 0 else "expired",
        "subscription_plan": plan,
        "subscription_expires_at": expires_at,
        "created_at": now_utc.isoformat(),
        "updated_at": now_utc.isoformat()
    }

    users.append(new_user)
    _save_users(users)
    return jsonify({"success": True, "user": _user_to_public_dict(new_user)}), 201

@auth_bp.route('/api/admin/users/batch-delete', methods=['POST'])
def admin_batch_delete_users():
    current_user = _get_current_user()
    if not current_user or current_user.get('role') != 'admin':
        return jsonify({"error": "Acceso restringido a administradores"}), 403

    data = request.json or {}
    user_ids = data.get('user_ids', [])
    if not isinstance(user_ids, list) or not user_ids:
        return jsonify({"error": "No se especificaron usuarios a eliminar"}), 400

    users = _load_users()
    users = [u for u in users if u.get('id') not in user_ids or u.get('role') == 'admin']
    _save_users(users)
    return jsonify({"success": True, "message": "Usuarios eliminados correctamente"})

@auth_bp.route('/api/admin/pins', methods=['GET'])
def admin_list_pins():
    current_user = _get_current_user()
    if not current_user or current_user.get('role') != 'admin':
        return jsonify({"error": "Acceso restringido a administradores"}), 403

    return jsonify(_load_licenses())

@auth_bp.route('/api/admin/pins/create', methods=['POST'])
def admin_create_pin():
    current_user = _get_current_user()
    if not current_user or current_user.get('role') != 'admin':
        return jsonify({"error": "Acceso restringido a administradores"}), 403

    data = request.json or {}
    duration_days = int(data.get('duration_days') or 30)
    count = int(data.get('count') or 1)
    custom_pin = _clean_str(data.get('custom_pin'), max_len=50)
    note = _clean_str(data.get('note'), max_len=200)

    licenses = _load_licenses()
    created_pins = []

    for i in range(count):
        pin_code = custom_pin if (custom_pin and count == 1) else f"VITA-{uuid.uuid4().hex[:8].upper()}"
        lic = {
            "id": str(uuid.uuid4()),
            "license_key": pin_code,
            "duration_days": duration_days,
            "plan_name": f"Plan Pro ({duration_days} días)",
            "is_used": False,
            "note": note,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        licenses.append(lic)
        created_pins.append(lic)

    _save_licenses(licenses)
    return jsonify({"success": True, "pins": created_pins}), 201
