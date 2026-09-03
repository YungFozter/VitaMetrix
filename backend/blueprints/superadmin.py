import uuid
import logging
from datetime import datetime, timezone, timedelta
from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash

from services.helpers import (
    _clean_str,
    _get_current_user,
    _user_to_public_dict,
    _load_users,
    _save_users,
    _generate_next_user_id,
    _load_licenses,
    _save_licenses,
    _now_bolivia,
    BOLIVIA_TZ
)

superadmin_bp = Blueprint('superadmin_bp', __name__)

def _require_admin():
    current_user = _get_current_user()
    if not current_user or current_user.get('role') != 'admin':
        return None
    return current_user

# ============================================================================
# GESTIÓN DE USUARIOS / MÉDICOS (SUPERADMIN)
# ============================================================================

@superadmin_bp.route('/api/admin/users', methods=['GET'])
def admin_list_users():
    if not _require_admin():
        return jsonify({"error": "Acceso restringido a administradores", "success": False}), 403

    users = _load_users()
    return jsonify([_user_to_public_dict(u) for u in users]), 200

@superadmin_bp.route('/api/admin/users/create', methods=['POST'])
def admin_create_user():
    if not _require_admin():
        return jsonify({"error": "Acceso restringido a administradores", "success": False}), 403

    data = request.json or {}
    email = _clean_str(data.get('email'), max_len=100)
    password = str(data.get('password') or '').strip()
    name = _clean_str(data.get('name') or data.get('full_name'), max_len=100)
    role = _clean_str(data.get('role'), max_len=20) or 'user'
    plan = _clean_str(data.get('plan') or data.get('subscription_plan'), max_len=50) or 'Plan Pro Mensual'
    duration_days = int(data.get('duration_days') or 30)

    if not email or not password or not name:
        return jsonify({"error": "Nombre, correo y contraseña son obligatorios.", "success": False}), 400

    users = _load_users()
    if any(u.get('email', '').lower() == email.lower() for u in users):
        return jsonify({"error": "El correo electrónico ya se encuentra registrado.", "success": False}), 400

    now_bolivia = _now_bolivia()
    expires_at = (now_bolivia + timedelta(days=duration_days)).isoformat() if duration_days < 90000 else None

    new_user = {
        "id": _generate_next_user_id(role=role),
        "email": email.lower(),
        "password_hash": generate_password_hash(password),
        "full_name": name,
        "professional_title": _clean_str(data.get('title') or data.get('professional_title'), max_len=100) or "Especialista Nutricional",
        "clinic_name": _clean_str(data.get('clinic') or data.get('clinic_name'), max_len=100) or "Mi Consultorio VitaMetrix",
        "phone": _clean_str(data.get('phone'), max_len=30),
        "role": role,
        "subscription_status": "active" if duration_days > 0 else "expired",
        "subscription_plan": plan,
        "subscription_expires_at": expires_at,
        "created_at": now_bolivia.isoformat(),
        "updated_at": now_bolivia.isoformat()
    }

    users.append(new_user)
    _save_users(users)
    return jsonify({"success": True, "user": _user_to_public_dict(new_user), "message": "Usuario creado correctamente."}), 201

@superadmin_bp.route('/api/admin/users/batch-delete', methods=['POST'])
def admin_batch_delete_users():
    if not _require_admin():
        return jsonify({"error": "Acceso restringido a administradores", "success": False}), 403

    data = request.json or {}
    user_ids = data.get('user_ids', [])
    if not isinstance(user_ids, list) or not user_ids:
        return jsonify({"error": "No se especificaron usuarios a eliminar.", "success": False}), 400

    users = _load_users()
    deleted_count = 0
    remaining_users = []
    for u in users:
        if u.get('id') in user_ids and u.get('role') != 'admin':
            deleted_count += 1
        else:
            remaining_users.append(u)

    _save_users(remaining_users)
    return jsonify({"success": True, "message": f"{deleted_count} usuario(s) eliminado(s) correctamente."}), 200

@superadmin_bp.route('/api/admin/users/<user_id>/status', methods=['POST', 'PUT'])
def admin_update_user_status(user_id):
    if not _require_admin():
        return jsonify({"error": "Acceso restringido a administradores", "success": False}), 403

    data = request.json or {}
    users = _load_users()
    target_user = None

    for u in users:
        if str(u.get('id')) == str(user_id):
            target_user = u
            break

    if not target_user:
        return jsonify({"error": "Usuario no encontrado.", "success": False}), 404

    if 'status' in data:
        target_user['subscription_status'] = _clean_str(data['status'], max_len=20)
    if 'plan' in data:
        target_user['subscription_plan'] = _clean_str(data['plan'], max_len=50)
    if 'expires_at' in data:
        target_user['subscription_expires_at'] = data['expires_at']

    target_user['updated_at'] = _now_bolivia().isoformat()
    _save_users(users)

    return jsonify({"success": True, "user": _user_to_public_dict(target_user), "message": "Estado de usuario actualizado con éxito."}), 200

@superadmin_bp.route('/api/admin/users/<user_id>/extend', methods=['POST'])
def admin_extend_user_subscription(user_id):
    if not _require_admin():
        return jsonify({"error": "Acceso restringido a administradores", "success": False}), 403

    data = request.json or {}
    days = int(data.get('days') or 30)

    users = _load_users()
    target_user = None

    for u in users:
        if str(u.get('id')) == str(user_id):
            target_user = u
            break

    if not target_user:
        return jsonify({"error": "Usuario no encontrado.", "success": False}), 404

    now_bolivia = _now_bolivia()
    curr_expires = target_user.get('subscription_expires_at')
    start_base = now_bolivia

    if curr_expires:
        try:
            exp_clean = curr_expires[:-1] + '+00:00' if curr_expires.endswith('Z') else curr_expires
            exp_dt = datetime.fromisoformat(exp_clean)
            if exp_dt.tzinfo is None:
                exp_dt = exp_dt.replace(tzinfo=BOLIVIA_TZ)
            else:
                exp_dt = exp_dt.astimezone(BOLIVIA_TZ)
            if exp_dt > now_bolivia:
                start_base = exp_dt
        except Exception:
            pass

    new_expires = start_base + timedelta(days=days)
    target_user['subscription_status'] = 'active'
    target_user['subscription_expires_at'] = new_expires.isoformat()
    target_user['updated_at'] = now_bolivia.isoformat()

    _save_users(users)
    return jsonify({
        "success": True,
        "message": f"Suscripción extendida por {days} días con éxito.",
        "user": _user_to_public_dict(target_user)
    }), 200

@superadmin_bp.route('/api/admin/users/<user_id>/deactivate-subscription', methods=['POST'])
def admin_deactivate_subscription(user_id):
    if not _require_admin():
        return jsonify({"error": "Acceso restringido a administradores", "success": False}), 403

    users = _load_users()
    target_user = None

    for u in users:
        if str(u.get('id')) == str(user_id):
            target_user = u
            break

    if not target_user:
        return jsonify({"error": "Usuario no encontrado.", "success": False}), 404

    target_user['subscription_status'] = 'expired'
    target_user['updated_at'] = _now_bolivia().isoformat()

    _save_users(users)
    return jsonify({"success": True, "message": "Suscripción desactivada.", "user": _user_to_public_dict(target_user)}), 200

@superadmin_bp.route('/api/admin/users/<user_id>/remove-subscription', methods=['POST'])
def admin_remove_subscription(user_id):
    if not _require_admin():
        return jsonify({"error": "Acceso restringido a administradores", "success": False}), 403

    users = _load_users()
    target_user = None

    for u in users:
        if str(u.get('id')) == str(user_id):
            target_user = u
            break

    if not target_user:
        return jsonify({"error": "Usuario no encontrado.", "success": False}), 404

    target_user['subscription_status'] = 'no_subscription'
    target_user['subscription_plan'] = 'Sin Suscripción Anterior'
    target_user['subscription_expires_at'] = None
    target_user['updated_at'] = _now_bolivia().isoformat()

    _save_users(users)
    return jsonify({"success": True, "message": "Suscripción eliminada de la cuenta.", "user": _user_to_public_dict(target_user)}), 200

@superadmin_bp.route('/api/admin/users/<user_id>', methods=['DELETE'])
def admin_delete_user(user_id):
    if not _require_admin():
        return jsonify({"error": "Acceso restringido a administradores", "success": False}), 403

    users = _load_users()
    initial_len = len(users)
    users = [u for u in users if str(u.get('id')) != str(user_id) or u.get('role') == 'admin']

    if len(users) == initial_len:
        return jsonify({"error": "No se pudo eliminar el usuario o es un administrador protegido.", "success": False}), 400

    _save_users(users)
    return jsonify({"success": True, "message": "Usuario eliminado permanentemente."}), 200

# ============================================================================
# GESTIÓN DE LICENCIAS / PINS (SUPERADMIN)
# ============================================================================

@superadmin_bp.route('/api/admin/pins', methods=['GET'])
def admin_list_pins():
    if not _require_admin():
        return jsonify({"error": "Acceso restringido a administradores", "success": False}), 403

    return jsonify(_load_licenses()), 200

@superadmin_bp.route('/api/admin/pins', methods=['POST'])
@superadmin_bp.route('/api/admin/pins/create', methods=['POST'])
def admin_create_pin():
    if not _require_admin():
        return jsonify({"error": "Acceso restringido a administradores", "success": False}), 403

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
            "pin_code": pin_code,
            "duration_days": duration_days,
            "plan_name": f"Plan Pro ({duration_days} días)",
            "is_used": False,
            "note": note,
            "created_at": _now_bolivia().isoformat()
        }
        licenses.append(lic)
        created_pins.append(lic)

    _save_licenses(licenses)
    return jsonify({"success": True, "pins": created_pins, "message": f"{len(created_pins)} PIN(s) generado(s) exitosamente."}), 201

@superadmin_bp.route('/api/admin/pins/<pin_id>', methods=['DELETE'])
def admin_delete_pin(pin_id):
    if not _require_admin():
        return jsonify({"error": "Acceso restringido a administradores", "success": False}), 403

    licenses = _load_licenses()
    initial_len = len(licenses)
    licenses = [l for l in licenses if str(l.get('id')) != str(pin_id) and str(l.get('license_key')) != str(pin_id)]

    if len(licenses) == initial_len:
        return jsonify({"error": "PIN no encontrado.", "success": False}), 404

    _save_licenses(licenses)
    return jsonify({"success": True, "message": "PIN revocado/eliminado exitosamente."}), 200
