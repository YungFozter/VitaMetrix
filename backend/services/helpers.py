import os
import sys
import json
import logging
import time
import math
import uuid
import re
import hmac
import hashlib
import base64
import html
from typing import Optional
from datetime import datetime, timezone, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
from flask import request
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

# Inicialización de Supabase Client
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        logging.error("Error al inicializar cliente de Supabase: %s", e)
else:
    logging.warning("Supabase credentials not found in environment variables.")

# Rutas de Persistencia
_USERS_PATH = os.path.join(os.path.dirname(_BACKEND_DIR), "data", "users.json")
_LICENSES_PATH = os.path.join(os.path.dirname(_BACKEND_DIR), "data", "subscription_licenses.json")
_STOCK_ITEMS_PATH = os.path.join(os.path.dirname(_BACKEND_DIR), "data", "stock_items.json")
_STOCK_MOVEMENTS_PATH = os.path.join(os.path.dirname(_BACKEND_DIR), "data", "stock_movements.json")
_STOCK_TAXONOMIES_PATH = os.path.join(os.path.dirname(_BACKEND_DIR), "data", "stock_taxonomies.json")
_CLIENTS_USERS_PATH = os.path.join(os.path.dirname(_BACKEND_DIR), "data", "clients_users.json")
_EVALUATIONS_USERS_PATH = os.path.join(os.path.dirname(_BACKEND_DIR), "data", "evaluations_users.json")
_APPOINTMENTS_PATH = os.path.join(os.path.dirname(_BACKEND_DIR), "data", "appointments.json")
_SALES_PATH = os.path.join(os.path.dirname(_BACKEND_DIR), "data", "sales.json")
_JWT_SECRET = os.environ.get("JWT_SECRET", "vitametrix_master_security_jwt_secret_2026_super_key_bolivia")

def _load_persisted_clients():
    if os.path.exists(_CLIENTS_USERS_PATH):
        try:
            with open(_CLIENTS_USERS_PATH, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if isinstance(data, list):
                    return data
                elif isinstance(data, dict):
                    if "clients" in data and isinstance(data["clients"], list):
                        return data["clients"]
                    flattened = []
                    for k, v in data.items():
                        if isinstance(v, list):
                            flattened.extend(v)
                        elif isinstance(v, dict):
                            flattened.append(v)
                    return flattened
        except Exception as e:
            logging.warning("Error al leer clients_users.json: %s", e)
    return []

def _save_persisted_clients(clients):
    try:
        os.makedirs(os.path.dirname(_CLIENTS_USERS_PATH), exist_ok=True)
        if not isinstance(clients, list):
            clients = list(clients) if hasattr(clients, '__iter__') else []
        with open(_CLIENTS_USERS_PATH, 'w', encoding='utf-8') as f:
            json.dump(clients, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        logging.error("Error al guardar clients_users.json: %s", e)
        return False

def _load_persisted_evaluations():
    if os.path.exists(_EVALUATIONS_USERS_PATH):
        try:
            with open(_EVALUATIONS_USERS_PATH, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if isinstance(data, list):
                    return data
                elif isinstance(data, dict):
                    if "evaluations" in data and isinstance(data["evaluations"], list):
                        return data["evaluations"]
                    flattened = []
                    for k, v in data.items():
                        if isinstance(v, list):
                            flattened.extend(v)
                        elif isinstance(v, dict):
                            flattened.append(v)
                    return flattened
        except Exception as e:
            logging.warning("Error al leer evaluations_users.json: %s", e)
    return []

def _save_persisted_evaluations(evals):
    try:
        os.makedirs(os.path.dirname(_EVALUATIONS_USERS_PATH), exist_ok=True)
        with open(_EVALUATIONS_USERS_PATH, 'w', encoding='utf-8') as f:
            json.dump(evals, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        logging.error("Error al guardar evaluations_users.json: %s", e)
        return False

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

def _load_persisted_sales():
    if os.path.exists(_SALES_PATH):
        try:
            with open(_SALES_PATH, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logging.warning("Error al leer sales.json: %s", e)
    return []

def _save_persisted_sales(sales):
    try:
        os.makedirs(os.path.dirname(_SALES_PATH), exist_ok=True)
        with open(_SALES_PATH, 'w', encoding='utf-8') as f:
            json.dump(sales, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        logging.error("Error al guardar sales.json: %s", e)
        return False

_EMPTY_DASHBOARD = {
    "total_clients": 0,
    "total_evaluations": 0,
    "avg_score": 0,
    "recent": [],
    "population": {"Óptimo": 0, "Límite": 0, "Bajo": 0},
}

_DASHBOARD_CACHE = {"timestamp": 0, "data": None}

def _invalidate_dashboard_cache():
    global _DASHBOARD_CACHE
    _DASHBOARD_CACHE = {"timestamp": 0, "data": None}

def _clean_str(val, max_len=150):
    if not val:
        return ""
    return html.escape(str(val).strip()[:max_len])

def _normalize_gender(val):
    if not val:
        return "male"
    v = str(val).strip().lower()
    if v in ("f", "female", "femenino", "mujer", "femenina"):
        return "female"
    return "male"

def _cell_bucket(phase_angle, valid=True):
    if not valid or phase_angle is None:
        return "Límite"
    if phase_angle > 6.0:
        return "Óptimo"
    if phase_angle >= 5.0:
        return "Límite"
    return "Bajo"

# --- PERSISTENCIA DE USUARIOS & SESIONES ---

_DEFAULT_INITIAL_USERS = [
    {
        "id": "usr-admin-001",
        "email": "admin@vitametrix.com",
        "password_hash": generate_password_hash("AdminVita2026!"),
        "full_name": "Administrador General",
        "professional_title": "Director / Administrador de Plataforma",
        "clinic_name": "Sede Central VitaMetrix",
        "phone": "+59172125280",
        "role": "admin",
        "subscription_status": "lifetime",
        "subscription_plan": "Plan Ilimitado / Administrador",
        "subscription_expires_at": "2099-12-31T23:59:59Z",
        "trial_started_at": "2026-01-01T00:00:00Z",
        "created_at": "2026-01-01T00:00:00Z"
    },
    {
        "id": "usr-doctor-001",
        "email": "audrey@vitametrix.com",
        "password_hash": generate_password_hash("Doctora2026!"),
        "full_name": "Dra. Audrey",
        "professional_title": "Manager / Especialista BIA",
        "clinic_name": "Centro Médico VitaMetrix",
        "phone": "+59171234567",
        "role": "user",
        "subscription_status": "no_subscription",
        "subscription_plan": "Sin Suscripción Anterior",
        "subscription_expires_at": None,
        "trial_started_at": None,
        "created_at": "2026-08-28T00:00:00Z"
    }
]

_DEFAULT_INITIAL_LICENSES = []

def _clean_test_users(users):
    if not isinstance(users, list):
        return []
    clean = []
    for u in users:
        email = (u.get('email') or '').lower().strip()
        uid = u.get('id') or ''
        if uid in ('usr-admin-001', 'usr-doctor-001') or email in ('admin@vitametrix.com', 'audrey@vitametrix.com'):
            clean.append(u)
        elif not any(p in email for p in ('dr.lic.', 'dr.a.', 'dr.b.', 'dra.elena.', 'dr.estandar.', 'dr.canje.', 'dra.test.', 'dr.roberto.', 'test.')):
            clean.append(u)
    return clean

def _save_users_disk_only(users):
    try:
        os.makedirs(os.path.dirname(_USERS_PATH), exist_ok=True)
        with open(_USERS_PATH, 'w', encoding='utf-8') as f:
            json.dump(users, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        logging.error("Error al guardar users.json: %s", e)
        return False

def _load_users():
    if supabase:
        try:
            res = supabase.table('users').select('*').execute()
            if res and res.data and len(res.data) > 0:
                clean_res = _clean_test_users(res.data)
                _save_users_disk_only(clean_res)
                return list(clean_res)
        except Exception:
            pass

    if supabase:
        try:
            res = supabase.table('stock_items').select('*').eq('code', '__SYS_USERS_STORE__').execute()
            if res and res.data and len(res.data) > 0:
                notes = res.data[0].get('notes')
                if notes:
                    parsed = json.loads(notes)
                    if isinstance(parsed, list) and len(parsed) > 0:
                        clean_parsed = _clean_test_users(parsed)
                        _save_users_disk_only(clean_parsed)
                        return clean_parsed
        except Exception as e:
            logging.warning("Error al leer respaldo de usuarios en Supabase: %s", e)

    if os.path.exists(_USERS_PATH):
        try:
            with open(_USERS_PATH, 'r', encoding='utf-8') as f:
                users = json.load(f)
                if isinstance(users, list) and len(users) > 0:
                    clean_local = _clean_test_users(users)
                    return clean_local
        except Exception as e:
            logging.warning("Error al leer users.json: %s", e)
    
    _save_users_disk_only(_DEFAULT_INITIAL_USERS)
    return list(_DEFAULT_INITIAL_USERS)

def _save_users(users):
    users = _clean_test_users(users)
    _save_users_disk_only(users)
    if supabase:
        try:
            for u in users:
                supabase.table('users').upsert(u).execute()
        except Exception:
            pass

        try:
            backup_data = {
                "code": "__SYS_USERS_STORE__",
                "name": "System Users Store (Auto-Backup)",
                "category": "__SYSTEM__",
                "unit": "JSON",
                "stock_quantity": len(users),
                "notes": json.dumps(users, ensure_ascii=False)
            }
            check = supabase.table('stock_items').select('id').eq('code', '__SYS_USERS_STORE__').execute()
            if check and check.data and len(check.data) > 0:
                supabase.table('stock_items').update(backup_data).eq('code', '__SYS_USERS_STORE__').execute()
            else:
                supabase.table('stock_items').insert(backup_data).execute()
        except Exception as e:
            logging.warning("Error al sincronizar usuarios en almacén persistente de Supabase: %s", e)
    return True

def _save_licenses_disk_only(licenses):
    try:
        os.makedirs(os.path.dirname(_LICENSES_PATH), exist_ok=True)
        with open(_LICENSES_PATH, 'w', encoding='utf-8') as f:
            json.dump(licenses, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        logging.error("Error al guardar subscription_licenses.json: %s", e)
        return False

def _load_licenses():
    if supabase:
        try:
            res = supabase.table('subscription_licenses').select('*').order('created_at', desc=True).execute()
            if res and res.data and len(res.data) > 0:
                _save_licenses_disk_only(res.data)
                return list(res.data)
        except Exception:
            pass

    if supabase:
        try:
            res = supabase.table('stock_items').select('*').eq('code', '__SYS_LICENSES_STORE__').execute()
            if res and res.data and len(res.data) > 0:
                notes = res.data[0].get('notes')
                if notes:
                    parsed = json.loads(notes)
                    if isinstance(parsed, list):
                        _save_licenses_disk_only(parsed)
                        return parsed
        except Exception as e:
            logging.warning("Error al leer respaldo de licencias en Supabase: %s", e)

    if os.path.exists(_LICENSES_PATH):
        try:
            with open(_LICENSES_PATH, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logging.warning("Error al leer subscription_licenses.json: %s", e)
    _save_licenses_disk_only(_DEFAULT_INITIAL_LICENSES)
    return list(_DEFAULT_INITIAL_LICENSES)

def _save_licenses(licenses):
    _save_licenses_disk_only(licenses)
    if supabase:
        try:
            for l in licenses:
                supabase.table('subscription_licenses').upsert(l).execute()
        except Exception:
            pass

        try:
            backup_data = {
                "code": "__SYS_LICENSES_STORE__",
                "name": "System Licenses Store (Auto-Backup)",
                "category": "__SYSTEM__",
                "unit": "JSON",
                "stock_quantity": len(licenses),
                "notes": json.dumps(licenses, ensure_ascii=False)
            }
            check = supabase.table('stock_items').select('id').eq('code', '__SYS_LICENSES_STORE__').execute()
            if check and check.data and len(check.data) > 0:
                supabase.table('stock_items').update(backup_data).eq('code', '__SYS_LICENSES_STORE__').execute()
            else:
                supabase.table('stock_items').insert(backup_data).execute()
        except Exception as e:
            logging.warning("Error al sincronizar licencias en almacén persistente de Supabase: %s", e)
    return True

def _generate_auth_token(user_id, email, role="user"):
    payload = {
        "user_id": user_id,
        "email": email,
        "role": role,
        "exp": int(time.time()) + (30 * 86400)
    }
    payload_json = json.dumps(payload, separators=(',', ':'))
    b64_payload = base64.urlsafe_b64encode(payload_json.encode()).decode().rstrip('=')
    sig = hmac.new(_JWT_SECRET.encode(), b64_payload.encode(), hashlib.sha256).hexdigest()
    return f"{b64_payload}.{sig}"

def _verify_auth_token(token_str):
    if not token_str or '.' not in token_str:
        return None
    try:
        b64_payload, sig = token_str.split('.', 1)
        expected_sig = hmac.new(_JWT_SECRET.encode(), b64_payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected_sig):
            return None

        padded = b64_payload + '=' * ((4 - len(b64_payload) % 4) % 4)
        payload_bytes = base64.urlsafe_b64decode(padded)
        payload = json.loads(payload_bytes.decode())

        if payload.get('exp', 0) < time.time():
            return None
        return payload
    except Exception as e:
        logging.warning("Error validando token: %s", e)
        return None

def _get_current_user():
    auth_header = request.headers.get('Authorization', '')
    token = None
    if auth_header.startswith('Bearer '):
        token = auth_header.split(' ', 1)[1].strip()
    elif request.cookies.get('vm_auth_token'):
        token = request.cookies.get('vm_auth_token')
    elif request.args.get('token'):
        token = request.args.get('token')

    if token:
        payload = _verify_auth_token(token)
        if payload and payload.get('user_id'):
            user_id = payload['user_id']
            for u in _load_users():
                if u.get('id') == user_id:
                    return u

    users = _load_users()
    for u in users:
        if u.get('role') == 'user':
            return u
    return users[0] if users else None

def _is_subscription_active(user):
    if not user:
        return False
    if user.get('role') == 'admin':
        return True
    
    status = user.get('subscription_status')
    if status == 'lifetime':
        return True

    expires_str = user.get('subscription_expires_at')
    if not expires_str:
        return False

    try:
        if expires_str.endswith('Z'):
            expires_str = expires_str[:-1] + '+00:00'
        expires_dt = datetime.fromisoformat(expires_str)
        now_dt = datetime.now(timezone.utc)
        return expires_dt > now_dt
    except Exception:
        return False

def _user_to_public_dict(user):
    if not user:
        return {}

    now_utc = datetime.now(timezone.utc)
    expires_str = user.get('subscription_expires_at')
    days_left = 0
    expires_at = None

    if expires_str:
        try:
            exp_clean = expires_str[:-1] + '+00:00' if expires_str.endswith('Z') else expires_str
            exp_dt = datetime.fromisoformat(exp_clean)
            expires_at = exp_dt.isoformat()
            delta = exp_dt - now_utc
            days_left = max(0, delta.days)
        except Exception:
            days_left = 0

    role = user.get('role', 'user')
    status = user.get('subscription_status', 'trial')
    if role == 'admin' or status == 'lifetime':
        days_left = 99999
        status = 'lifetime'
        plan_name = "Plan Ilimitado / Administrador"
    elif days_left > 0:
        status = 'active'
        plan_name = user.get('subscription_plan', 'Plan Pro Mensual (30 días)')
    else:
        status = 'expired'
        plan_name = "Suscripción Vencida (0 Días)"

    return {
        "id": user.get('id'),
        "email": user.get('email'),
        "full_name": user.get('full_name'),
        "professional_title": user.get('professional_title', 'Nutricionista / Especialista BIA'),
        "clinic_name": user.get('clinic_name', 'Centro Médico VitaMetrix'),
        "phone": user.get('phone', ''),
        "professional_license": user.get('professional_license', ''),
        "clinic_logo_url": user.get('clinic_logo_url', ''),
        "pdf_disclaimer": user.get('pdf_disclaimer', 'Consulte con su profesional de la salud antes de iniciar cualquier plan nutricional o de entrenamiento.'),
        "pdf_footer_address": user.get('pdf_footer_address', ''),
        "clinic_address": user.get('clinic_address', ''),
        "unit_weight": user.get('unit_weight', 'kg'),
        "pha_optimal": user.get('pha_optimal', '6.0'),
        "role": role,
        "subscription_status": status,
        "subscription_plan": plan_name,
        "subscription": {
            "status": status,
            "days_left": days_left,
            "expires_at": expires_at,
            "plan_name": plan_name,
            "whatsapp_contact": "+591 72125280",
            "whatsapp_phone_clean": "59172125280"
        }
    }

def _generate_next_user_id(role='user'):
    users = _load_users()
    prefix = 'usr-admin-' if role == 'admin' else 'usr-doctor-'
    existing_nums = []
    for u in users:
        uid = str(u.get('id') or '')
        if uid.startswith(prefix):
            try:
                num = int(uid.replace(prefix, ''))
                existing_nums.append(num)
            except ValueError:
                pass
    next_num = 1
    while next_num in existing_nums:
        next_num += 1
    return f"{prefix}{next_num:03d}"

# --- PERSISTENCIA Y MOTOR DE INVENTARIO STOCK ---

_DEFAULT_INITIAL_STOCK_ITEMS = []
_DEFAULT_INITIAL_STOCK_MOVEMENTS = []

def _load_persisted_stock_items():
    if os.path.exists(_STOCK_ITEMS_PATH):
        try:
            with open(_STOCK_ITEMS_PATH, 'r', encoding='utf-8') as f:
                items = json.load(f)
                if isinstance(items, list):
                    return items
        except Exception as e:
            logging.warning("Error al leer stock_items.json: %s", e)
    _save_persisted_stock_items(_DEFAULT_INITIAL_STOCK_ITEMS)
    return list(_DEFAULT_INITIAL_STOCK_ITEMS)

def _save_persisted_stock_items(items):
    try:
        os.makedirs(os.path.dirname(_STOCK_ITEMS_PATH), exist_ok=True)
        with open(_STOCK_ITEMS_PATH, 'w', encoding='utf-8') as f:
            json.dump(items, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        logging.error("Error al guardar stock_items.json: %s", e)
        return False

def _load_persisted_stock_movements():
    if os.path.exists(_STOCK_MOVEMENTS_PATH):
        try:
            with open(_STOCK_MOVEMENTS_PATH, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logging.warning("Error al leer stock_movements.json: %s", e)
    _save_persisted_stock_movements(_DEFAULT_INITIAL_STOCK_MOVEMENTS)
    return list(_DEFAULT_INITIAL_STOCK_MOVEMENTS)

def _save_persisted_stock_movements(movements):
    try:
        os.makedirs(os.path.dirname(_STOCK_MOVEMENTS_PATH), exist_ok=True)
        with open(_STOCK_MOVEMENTS_PATH, 'w', encoding='utf-8') as f:
            json.dump(movements, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        logging.error("Error al guardar stock_movements.json: %s", e)
        return False

def _load_persisted_taxonomies():
    if os.path.exists(_STOCK_TAXONOMIES_PATH):
        try:
            with open(_STOCK_TAXONOMIES_PATH, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return data.get('categories', []), data.get('units', [])
        except Exception as e:
            logging.warning("Error al leer stock_taxonomies.json: %s", e)
    return [], []

def _save_persisted_taxonomies(categories, units):
    try:
        os.makedirs(os.path.dirname(_STOCK_TAXONOMIES_PATH), exist_ok=True)
        with open(_STOCK_TAXONOMIES_PATH, 'w', encoding='utf-8') as f:
            json.dump({"categories": categories, "units": units}, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        logging.error("Error al guardar stock_taxonomies.json: %s", e)
        return False

_LOCAL_STOCK_ITEMS = _load_persisted_stock_items()
_LOCAL_STOCK_MOVEMENTS = _load_persisted_stock_movements()

def _clean_expiry_date(raw_val):
    if not raw_val:
        return None
    val_str = str(raw_val).strip()
    if val_str.lower() in ('none', 'null', 'nan', '', '--'):
        return None
    if ' ' in val_str:
        val_str = val_str.split(' ')[0]
    if 'T' in val_str:
        val_str = val_str.split('T')[0]
    val_clean = _clean_str(val_str, max_len=20)
    return val_clean if val_clean else None

def _safe_stock_float(val, default=0.0, min_val=None):
    if val is None:
        return default
    if isinstance(val, (int, float)):
        if math.isnan(val) or math.isinf(val):
            return default
        f = float(val)
        if min_val is not None:
            f = max(min_val, f)
        return round(f, 2)
    
    s = str(val).strip()
    if not s or s.lower() in ('none', 'null', 'nan'):
        return default
    
    s_clean = re.sub(r'[^0-9.,-]', '', s)
    if not s_clean:
        return default
    
    if ',' in s_clean and '.' in s_clean:
        s_clean = s_clean.replace(',', '')
    elif ',' in s_clean and '.' not in s_clean:
        s_clean = s_clean.replace(',', '.')

    try:
        f = float(s_clean)
        if math.isnan(f) or math.isinf(f):
            return default
        if min_val is not None:
            f = max(min_val, f)
        return round(f, 2)
    except (ValueError, TypeError):
        return default

def _calc_item_status(qty, min_qty):
    qty = _safe_stock_float(qty, 0.0)
    min_qty = _safe_stock_float(min_qty, 0.0)
    if qty <= 0:
        return "out"
    elif qty <= min_qty:
        return "low"
    return "optimal"

def _supabase_insert_stock_item(item_dict):
    if not supabase or not item_dict:
        return False

    clean_dict = dict(item_dict)
    if 'expiry_date' in clean_dict and (not clean_dict['expiry_date'] or str(clean_dict['expiry_date']).lower() in ('none', 'null', 'nan', '', '--')):
        clean_dict['expiry_date'] = None

    try:
        res = supabase.table('stock_items').insert(clean_dict).execute()
        if res and res.data:
            return True
    except Exception as e1:
        logging.warning("Supabase insert tier 1 fallo: %s", e1)

    try:
        t2 = {k: v for k, v in clean_dict.items() if k != 'status'}
        res = supabase.table('stock_items').insert(t2).execute()
        if res and res.data:
            return True
    except Exception as e2:
        logging.warning("Supabase insert tier 2 fallo: %s", e2)

    try:
        t3 = {k: v for k, v in clean_dict.items() if k not in ['status', 'expiry_date', 'batch_number']}
        res = supabase.table('stock_items').insert(t3).execute()
        if res and res.data:
            return True
    except Exception as e3:
        logging.warning("Supabase insert tier 3 fallo: %s", e3)

    try:
        t4 = {k: v for k, v in clean_dict.items() if k in ['id', 'user_id', 'code', 'name', 'category', 'unit', 'stock_quantity', 'min_stock', 'cost_price', 'sale_price', 'created_at']}
        res = supabase.table('stock_items').insert(t4).execute()
        if res and res.data:
            return True
    except Exception as e4:
        logging.error("CRITICAL: Supabase insert tier 4 fallo: %s", e4)
    return False

def _supabase_update_stock_item(item_id, update_payload):
    if not supabase or not item_id or not update_payload:
        return False

    clean_payload = dict(update_payload)
    if 'expiry_date' in clean_payload and (not clean_payload['expiry_date'] or str(clean_payload['expiry_date']).lower() in ('none', 'null', 'nan', '', '--')):
        clean_payload['expiry_date'] = None

    try:
        res = supabase.table('stock_items').update(clean_payload).eq('id', item_id).execute()
        if res and res.data:
            return True
    except Exception as e1:
        logging.warning("Supabase update tier 1 fallo: %s", e1)

    try:
        t2 = {k: v for k, v in clean_payload.items() if k != 'status'}
        res = supabase.table('stock_items').update(t2).eq('id', item_id).execute()
        if res and res.data:
            return True
    except Exception as e2:
        logging.warning("Supabase update tier 2 fallo: %s", e2)

    try:
        t3 = {k: v for k, v in clean_payload.items() if k in ['stock_quantity', 'min_stock', 'cost_price', 'sale_price', 'user_id', 'updated_at']}
        res = supabase.table('stock_items').update(t3).eq('id', item_id).execute()
        if res and res.data:
            return True
    except Exception as e3:
        logging.error("CRITICAL: Supabase update tier 3 fallo: %s", e3)
    return False

def _supabase_insert_stock_movement(m_item):
    if not supabase or not m_item:
        return False
    try:
        res = supabase.table('stock_movements').insert(m_item).execute()
        if res and res.data:
            return True
    except Exception as e1:
        try:
            t2 = {k: v for k, v in m_item.items() if k in ['id', 'user_id', 'item_id', 'type', 'quantity', 'previous_stock', 'new_stock', 'reason', 'created_at']}
            res = supabase.table('stock_movements').insert(t2).execute()
            if res and res.data:
                return True
        except Exception as e2:
            try:
                t3 = {k: v for k, v in m_item.items() if k in ['id', 'item_id', 'type', 'quantity', 'created_at']}
                supabase.table('stock_movements').insert(t3).execute()
                return True
            except Exception:
                pass
    return False

def _find_existing_stock_item(name, code=None, current_uid=None):
    if not name and not code:
        return None
    norm_name = str(name).strip().lower() if name else ''
    norm_code = str(code).strip().upper() if code else ''

    active_items = []
    if supabase:
        try:
            res = supabase.table('stock_items').select('*').execute()
            if res.data:
                active_items = res.data
        except Exception:
            pass

    if not active_items:
        active_items = list(_LOCAL_STOCK_ITEMS)

    if current_uid:
        user_items = [it for it in active_items if it.get('user_id') == current_uid]
    else:
        user_items = active_items

    for item in user_items:
        it_name = str(item.get('name') or '').strip().lower()
        it_code = str(item.get('code') or '').strip().upper()
        if (norm_name and it_name == norm_name) or (norm_code and it_code == norm_code and not norm_code.startswith('SKU-AUTO')):
            return item
    return None

def _generate_next_sku(raw_code=None, current_uid=None):
    prefix = "SKU"
    desired_num = None

    if raw_code and isinstance(raw_code, str):
        c_clean = raw_code.strip().upper()
        m_full = re.match(r'^([A-Z0-9]{1,8})-(\d+)$', c_clean)
        if m_full:
            prefix = m_full.group(1)
            try:
                desired_num = int(m_full.group(2))
            except ValueError:
                pass
        else:
            p_candidate = re.sub(r'[^A-Z0-9]', '', c_clean)
            if 2 <= len(p_candidate) <= 5:
                prefix = p_candidate
            elif len(p_candidate) > 5:
                prefix = p_candidate[:5]
            elif 1 <= len(p_candidate) < 2:
                prefix = (p_candidate + "X")[:2]

    existing_codes = set()
    for it in _load_persisted_stock_items():
        c = it.get('code')
        it_uid = it.get('user_id')
        if c and not str(c).startswith('__SYS_'):
            if not current_uid or not it_uid or it_uid in ('usr-doctor-001', 'None', 'null', '') or it_uid == current_uid:
                existing_codes.add(str(c).upper().strip())
    
    if supabase:
        try:
            res = supabase.table('stock_items').select('code, user_id').execute()
            for r in (res.data or []):
                c = r.get('code')
                it_uid = r.get('user_id')
                if c and not str(c).startswith('__SYS_'):
                    if not current_uid or not it_uid or it_uid in ('usr-doctor-001', 'None', 'null', '') or it_uid == current_uid:
                        existing_codes.add(str(c).upper().strip())
        except Exception:
            pass

    pattern = re.compile(f'^{re.escape(prefix)}-(\\d+)$', re.IGNORECASE)
    used_numbers = set()
    for code in existing_codes:
        m = pattern.match(code)
        if m:
            try:
                used_numbers.add(int(m.group(1)))
            except ValueError:
                pass

    if desired_num is not None and desired_num > 0 and desired_num not in used_numbers:
        return f"{prefix}-{desired_num:03d}"

    next_num = 1
    while next_num in used_numbers:
        next_num += 1

    return f"{prefix}-{next_num:03d}"

def _ensure_category_and_unit_persisted(category_name, unit_name=None):
    if not category_name and not unit_name:
        return
    try:
        cats, units = _load_persisted_taxonomies()
        changed = False
        if category_name and category_name.strip():
            c_clean = category_name.strip()
            if not any(c['name'].lower() == c_clean.lower() for c in cats):
                cats.append({
                    "name": c_clean,
                    "icon": "🏷️" if c_clean == "Sin Categoría" else "📦",
                    "description": "Categoría personalizada"
                })
                changed = True
        if unit_name and unit_name.strip():
            u_clean = unit_name.strip()
            if not any(u['name'].lower() == u_clean.lower() for u in units):
                units.append({
                    "name": u_clean,
                    "description": "Unidad de medida personalizada"
                })
                changed = True
        if changed:
            _save_persisted_taxonomies(cats, units)
    except Exception as e:
        logging.warning("Error al asegurar taxonomías persistidas: %s", e)

def _get_stock_item_by_id(item_id):
    if not item_id:
        return None
    target_str = str(item_id).strip()
    for item in _LOCAL_STOCK_ITEMS:
        if str(item.get('id')).strip() == target_str:
            return item

    if supabase:
        try:
            res = supabase.table('stock_items').select('*').eq('id', target_str).execute()
            if res and res.data:
                return res.data[0]
        except Exception:
            pass

    disk_items = _load_persisted_stock_items()
    for item in disk_items:
        if str(item.get('id')).strip() == target_str:
            return item

    return None
