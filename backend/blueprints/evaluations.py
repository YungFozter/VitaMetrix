import os
import json
import logging
import uuid
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify

from services.helpers import (
    supabase,
    _clean_str,
    _normalize_gender,
    _get_current_user,
    _is_subscription_active,
    _invalidate_dashboard_cache,
    _load_persisted_evaluations,
    _save_persisted_evaluations
)

_LOCAL_EVALUATIONS = _load_persisted_evaluations()

@evaluations_bp.route('/api/evaluations', methods=['GET'])
def list_evaluations():
    current_user = _get_current_user()
    current_uid = current_user.get('id') if current_user else None

    evals = []
    if supabase:
        try:
            res = supabase.table('evaluations').select('*').order('created_at', desc=True).execute()
            if res.data is not None:
                evals = res.data
        except Exception as e:
            logging.warning("No se pudo obtener evaluaciones desde Supabase: %s", e)

    if not evals:
        evals = _load_persisted_evaluations()

    if current_uid and current_user.get('role') != 'admin':
        filtered = []
        for e in evals:
            e_uid = e.get('user_id')
            if not e_uid or e_uid in ('usr-doctor-001', 'None', 'null', ''):
                e['user_id'] = current_uid
                e_uid = current_uid
            if e_uid == current_uid:
                filtered.append(e)
        return jsonify(filtered)

    return jsonify(evals)

@evaluations_bp.route('/api/evaluations', methods=['POST'])
def create_evaluation():
    current_user = _get_current_user()
    if not current_user:
        return jsonify({"error": "No autorizado"}), 401
    if not _is_subscription_active(current_user):
        return jsonify({
            "error": "Tu suscripción ha vencido. Canjea un PIN para guardar evaluaciones clínicas.",
            "subscription_expired": True
        }), 403

    current_uid = current_user.get('id')
    data = request.json or {}

    r = float(data.get('resistance') or 0)
    xc = float(data.get('reactance') or 0)
    w = float(data.get('weight') or 0)
    h = float(data.get('height') or 0)
    age = int(data.get('age') or 0)
    gender = _normalize_gender(data.get('gender'))

    if r <= 0 or xc <= 0 or w <= 0 or h <= 0 or age <= 0:
        return jsonify({"error": "Parámetros de bioimpedancia inválidos"}), 400

    report = build_clinical_report(r, xc, h, w, age, gender)
    eval_id = str(uuid.uuid4())

    new_eval = {
        "id": eval_id,
        "user_id": current_uid,
        "code": f"EVAL-{int(datetime.now().timestamp())}",
        "patient_name": _clean_str(data.get('patient_name'), max_len=100) or "Paciente sin registrar",
        "patient_idp": _clean_str(data.get('patient_idp'), max_len=50),
        "resistance": r,
        "reactance": xc,
        "weight": w,
        "height": h,
        "age": age,
        "gender": gender,
        "report": report,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    _LOCAL_EVALUATIONS.insert(0, new_eval)
    _save_persisted_evaluations(_LOCAL_EVALUATIONS)

    if supabase:
        try:
            supabase.table('evaluations').insert({
                "id": eval_id,
                "user_id": current_uid,
                "code": new_eval['code'],
                "patient_name": new_eval['patient_name'],
                "patient_idp": new_eval['patient_idp'],
                "resistance": r,
                "reactance": xc,
                "weight": w,
                "height": h,
                "age": age,
                "gender": gender,
                "created_at": new_eval['created_at']
            }).execute()
        except Exception as e:
            logging.warning("No se pudo registrar evaluación en Supabase: %s", e)

    _invalidate_dashboard_cache()
    return jsonify({"success": True, "evaluation": new_eval}), 201

@evaluations_bp.route('/api/evaluations/<eval_id>', methods=['DELETE'])
def delete_evaluation(eval_id):
    current_user = _get_current_user()
    if not current_user:
        return jsonify({"error": "No autorizado"}), 401

    current_uid = current_user.get('id')
    global _LOCAL_EVALUATIONS
    _LOCAL_EVALUATIONS = [e for e in _LOCAL_EVALUATIONS if str(e.get('id')) != str(eval_id)]
    _save_persisted_evaluations(_LOCAL_EVALUATIONS)

    if supabase:
        try:
            supabase.table('evaluations').delete().eq('id', str(eval_id)).execute()
        except Exception as e:
            logging.warning("No se pudo borrar evaluación en Supabase: %s", e)

    _invalidate_dashboard_cache()
    return jsonify({"success": True, "message": "Evaluación eliminada correctamente."})

@evaluations_bp.route('/api/bia/calculate', methods=['POST'])
def calculate_bia_api():
    data = request.json or {}
    try:
        r = float(data.get('resistance') or 0)
        xc = float(data.get('reactance') or 0)
        w = float(data.get('weight') or 0)
        h = float(data.get('height') or 0)
        age = int(data.get('age') or 0)
        gender = _normalize_gender(data.get('gender'))
    except (ValueError, TypeError):
        return jsonify({"error": "Datos numéricos inválidos"}), 400

    if r <= 0 or xc <= 0 or w <= 0 or h <= 0 or age <= 0:
        return jsonify({"error": "Resistencia, Reactancia, Peso, Talla y Edad deben ser mayores a 0"}), 400

    report = build_clinical_report(r, xc, h, w, age, gender)
    return jsonify({"success": True, "report": report})
