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

evaluations_bp = Blueprint('evaluations_bp', __name__)

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

@evaluations_bp.route('/api/evaluations/<eval_id>', methods=['GET'])
def get_evaluation_detail(eval_id):
    current_user = _get_current_user()
    if not current_user:
        return jsonify({"error": "No autorizado"}), 401

    target_eval = None
    if supabase:
        try:
            res = supabase.table('evaluations').select('*').eq('id', str(eval_id)).execute()
            if res and res.data:
                target_eval = res.data[0]
        except Exception as e:
            logging.warning("Error consultando evaluación en Supabase: %s", e)

    if not target_eval:
        local_evals = _load_persisted_evaluations()
        for e in local_evals:
            if isinstance(e, dict) and str(e.get('id')) == str(eval_id):
                target_eval = e
                break

    if not target_eval:
        return jsonify({"error": "Evaluación clínica no encontrada"}), 404

    report = target_eval.get('report') or {}
    scores_dict = report.get('scores') or {}
    biva_dict = report.get('biva') or {}
    body_dict = report.get('body_comp') or {}
    meta_dict = report.get('meta') or {}

    g_score = target_eval.get('global_score')
    if g_score is None:
        g_score = scores_dict.get('global_score', 0)

    p_angle = target_eval.get('phase_angle')
    if p_angle is None:
        p_angle = biva_dict.get('phase_angle', 0)

    cell_status = biva_dict.get('cell_status') or biva_dict.get('status') or "Óptimo"
    rank_str = scores_dict.get('rank') or "Especial"
    tee_val = meta_dict.get('tee_kcal') or report.get('tee_kcal') or 2000

    raw_inputs = {
        "weight": target_eval.get('weight') or report.get('inputs', {}).get('weight', '--'),
        "height": target_eval.get('height') or report.get('inputs', {}).get('height', '--'),
        "age": target_eval.get('age') or report.get('inputs', {}).get('age', '--'),
        "gender": target_eval.get('gender') or report.get('inputs', {}).get('gender', 'male'),
        "resistance": target_eval.get('resistance') or report.get('inputs', {}).get('resistance', '--'),
        "reactance": target_eval.get('reactance') or report.get('inputs', {}).get('reactance', '--'),
        "smm": body_dict.get('smm_kg') or report.get('smm_kg', '--'),
        "fat_mass": body_dict.get('fat_kg') or report.get('fat_kg', '--'),
        "visceral_fat": body_dict.get('visceral_level') or report.get('visceral_level', '--'),
        "pal": report.get('pal') or 1.55
    }

    clinical_findings = report.get('clinical_findings') or [
        f"Ángulo de fase: {p_angle}°",
        f"Diagnóstico celular: {cell_status}",
        f"Calificación TRU Score: {g_score} pts"
    ]

    response_data = {
        "id": target_eval.get('id'),
        "patient_name": target_eval.get('patient_name') or target_eval.get('name') or "Paciente",
        "name": target_eval.get('patient_name') or target_eval.get('name') or "Paciente",
        "patient_idp": target_eval.get('patient_idp') or target_eval.get('idp') or "--",
        "idp": target_eval.get('patient_idp') or target_eval.get('idp') or "--",
        "code": target_eval.get('code') or "EVAL",
        "created_at": target_eval.get('created_at') or "",
        "score": float(g_score or 0),
        "global_score": float(g_score or 0),
        "phase_angle": float(p_angle or 0),
        "rank": rank_str,
        "cell_status": cell_status,
        "tee_kcal": tee_val,
        "raw_inputs": raw_inputs,
        "clinical_findings": clinical_findings,
        "report": report
    }

    return jsonify(response_data)

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
