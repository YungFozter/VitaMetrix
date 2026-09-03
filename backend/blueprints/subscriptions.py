import logging
from datetime import datetime, timezone, timedelta
from flask import Blueprint, request, jsonify

from services.helpers import (
    _clean_str,
    _get_current_user,
    _user_to_public_dict,
    _load_users,
    _save_users,
    _load_licenses,
    _save_licenses,
    _is_subscription_active,
    _now_bolivia,
    BOLIVIA_TZ
)

subscriptions_bp = Blueprint('subscriptions_bp', __name__)

def _calculate_days_left(expires_at_str, now_dt):
    if not expires_at_str:
        return 0
    try:
        clean_exp = expires_at_str[:-1] + '+00:00' if expires_at_str.endswith('Z') else expires_at_str
        exp_dt = datetime.fromisoformat(clean_exp)
        if exp_dt.tzinfo is None:
            exp_dt = exp_dt.replace(tzinfo=BOLIVIA_TZ)
        else:
            exp_dt = exp_dt.astimezone(BOLIVIA_TZ)
        delta = (exp_dt - now_dt).total_seconds()
        if delta <= 0:
            return 0
        return int(delta // 86400) + (1 if (delta % 86400) > 0 else 0)
    except Exception as e:
        logging.warning("Error calculando días restantes de suscripción: %s", e)
        return 0

@subscriptions_bp.route('/api/subscription/status', methods=['GET'])
@subscriptions_bp.route('/api/subscriptions/status', methods=['GET'])
def get_subscription_status():
    current_user = _get_current_user()
    if not current_user:
        return jsonify({"error": "No autorizado", "success": False}), 401

    is_active = _is_subscription_active(current_user)
    status = current_user.get("subscription_status", "active")
    plan = current_user.get("subscription_plan", "Plan Pro")
    expires_at = current_user.get("subscription_expires_at")
    now_dt = _now_bolivia()
    days_left = _calculate_days_left(expires_at, now_dt)

    if status == 'lifetime' or current_user.get('role') == 'admin':
        days_left = 9999
        is_active = True

    user_dict = _user_to_public_dict(current_user)

    return jsonify({
        "success": True,
        "is_active": is_active,
        "status": status,
        "plan": plan,
        "expires_at": expires_at,
        "days_left": days_left,
        "user": user_dict,
        "subscription": {
            "status": status,
            "plan_name": plan,
            "expires_at": expires_at,
            "days_left": days_left,
            "is_active": is_active
        },
        "whatsapp": {
            "phone_e164": "59172125280",
            "message_text": f"Hola Soporte VitaMetrix, solicito asistencia con mi suscripción para la cuenta {current_user.get('email')}."
        }
    }), 200

@subscriptions_bp.route('/api/subscription/redeem', methods=['POST'])
@subscriptions_bp.route('/api/subscription/redeem-pin', methods=['POST'])
@subscriptions_bp.route('/api/subscriptions/redeem', methods=['POST'])
@subscriptions_bp.route('/api/subscriptions/redeem-pin', methods=['POST'])
def redeem_subscription_pin():
    current_user = _get_current_user()
    if not current_user:
        return jsonify({"error": "No autorizado", "success": False}), 401

    data = request.json or {}
    raw_pin = str(
        data.get('license_key') or 
        data.get('pin') or 
        data.get('pin_code') or 
        data.get('key') or ''
    ).strip().upper()

    if not raw_pin:
        return jsonify({"error": "Debes ingresar un código PIN de activación válido.", "success": False}), 400

    licenses = _load_licenses()
    found_license = None

    for lic in licenses:
        l_key = str(lic.get('license_key') or lic.get('pin_code') or '').strip().upper()
        if l_key == raw_pin:
            found_license = lic
            break

    if not found_license:
        return jsonify({"error": "El código PIN ingresado es inválido o no existe en el sistema.", "success": False}), 404

    if found_license.get('is_used'):
        used_date = str(found_license.get('used_at') or 'fecha desconocida')[:10]
        return jsonify({
            "error": f"Este PIN ya fue canjeado previamente el {used_date}.",
            "success": False
        }), 400

    duration_days = int(found_license.get('duration_days', 30))
    plan_name = found_license.get('plan_name') or f'Plan Pro ({duration_days} días)'

    now_bolivia = _now_bolivia()
    curr_expires = current_user.get('subscription_expires_at')

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
        except Exception as e:
            logging.warning("Error parseando fecha actual de vencimiento: %s", e)

    new_expires = start_base + timedelta(days=duration_days)

    users = _load_users()
    for u in users:
        if u.get('id') == current_user.get('id'):
            u['subscription_status'] = 'active'
            u['subscription_plan'] = plan_name
            u['subscription_expires_at'] = new_expires.isoformat()
            u['updated_at'] = now_bolivia.isoformat()
            break
    _save_users(users)

    found_license['is_used'] = True
    found_license['used_by_user_id'] = current_user.get('id')
    found_license['used_by_email'] = current_user.get('email')
    found_license['used_at'] = now_bolivia.isoformat()
    _save_licenses(licenses)

    updated_user = _get_current_user()
    return jsonify({
        "success": True,
        "message": f"¡Licencia activada con éxito! Se han sumado {duration_days} días a tu cuenta.",
        "user": _user_to_public_dict(updated_user)
    }), 200

@subscriptions_bp.route('/api/subscription/licenses', methods=['GET'])
@subscriptions_bp.route('/api/subscriptions/licenses', methods=['GET'])
def list_subscription_licenses():
    current_user = _get_current_user()
    if not current_user or current_user.get('role') != 'admin':
        return jsonify({"error": "Acceso restringido a administradores", "success": False}), 403
    return jsonify(_load_licenses()), 200
