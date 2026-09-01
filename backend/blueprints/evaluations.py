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
    _normalize_gender,
    _get_current_user,
    _is_subscription_active,
    _invalidate_dashboard_cache,
    _load_persisted_evaluations,
    _save_persisted_evaluations
)

from calculations import (
    calculate_phase_angle,
    get_biva_interpretation,
    calculate_scores,
    analyze_hydration,
    analyze_visceral_fat,
    calculate_energy,
    build_clinical_report
)

evaluations_bp = Blueprint('evaluations_bp', __name__)

_LOCAL_EVALUATIONS = _load_persisted_evaluations()

def _get_next_available_eval_code(user_id=None):
    """
    Obtiene el próximo código reciclado secuencial de evaluación 'EVA-XXX' libre para el usuario/doctor.
    Si existen EVA-001..EVA-015 y la #7 fue eliminada, retornará 'EVA-007'.
    Si no hay huecos, retornará el siguiente secuencial 'EVA-016'.
    """
    evals = []
    if supabase:
        try:
            query = supabase.table('evaluations').select('code, user_id')
            if user_id:
                query = query.eq('user_id', user_id)
            res = query.execute()
            if res and res.data:
                evals = res.data
        except Exception as e:
            logging.warning("Error consultando códigos de evaluación en Supabase: %s", e)

    if not evals:
        local_evals = _load_persisted_evaluations()
        if user_id:
            evals = [e for e in local_evals if isinstance(e, dict) and (e.get('user_id') == user_id or not e.get('user_id'))]
        else:
            evals = local_evals

    used_numbers = set()
    for e in evals:
        if not isinstance(e, dict):
            continue
        code = str(e.get('code') or '')
        match = re.search(r'EVA-?(\d+)', code, re.IGNORECASE)
        if match:
            try:
                num = int(match.group(1))
                if num > 0:
                    used_numbers.add(num)
            except ValueError:
                pass

    next_num = 1
    while next_num in used_numbers:
        next_num += 1

    return f"EVA-{next_num:03d}"

def compute_full_bia_analysis(data):
    try:
        r = float(data.get('resistance') or 0)
        xc = float(data.get('reactance') or 0)
        w = float(data.get('weight') or 0)
        h = float(data.get('height') or 0)
        age = int(data.get('age') or 0)
        gender = _normalize_gender(data.get('gender'))
    except (ValueError, TypeError):
        r, xc, w, h, age, gender = 0, 0, 0, 0, 0, 'male'

    pal = float(data.get('pal') or 1.55)
    waist = float(data.get('waist') or 0) if data.get('waist') else None
    smm = float(data.get('smm') or 0) if data.get('smm') else None
    fat_mass = float(data.get('fat_mass') or 0) if data.get('fat_mass') else None
    tbw = float(data.get('tbw') or 0) if data.get('tbw') else None
    ecw = float(data.get('ecw') or 0) if data.get('ecw') else None
    visceral_fat = float(data.get('visceral_fat') or 0) if data.get('visceral_fat') else None

    phase_angle = calculate_phase_angle(r, xc)
    biva = get_biva_interpretation(r, xc)
    scores = calculate_scores(w, h, phase_angle, smm, fat_mass, gender)
    hydration = analyze_hydration(tbw, ecw, w)
    visceral = analyze_visceral_fat(waist, visceral_fat, gender)
    energy = calculate_energy(w, h, age, gender, pal, smm, fat_mass)
    ecw_ratio = hydration.get('ecw_tbw_ratio')
    findings = build_clinical_report(biva, hydration, visceral, scores, phase_angle, ecw_ratio)

    g_score = scores.get('score', 0)
    m_score = scores.get('muscle_score', 0)
    f_score = scores.get('fat_score', 0)
    rank_str = scores.get('rank', 'HIERRO')

    # Módulo BCC Matrix (Balance Grasa vs Músculo)
    if smm is not None and smm > 0 and w > 0:
        m_pct = round((smm / w) * 100.0, 1)
    else:
        m_pct = round(min(max(phase_angle * 7.0 + (5.0 if gender == 'male' else 0.0), 20.0), 55.0), 1)

    if fat_mass is not None and fat_mass > 0 and w > 0:
        f_pct = round((fat_mass / w) * 100.0, 1)
    else:
        h_m = (h / 100.0) if h > 0 else 1.70
        bmi_val = (w / (h_m ** 2)) if h_m > 0 else 22.0
        f_pct = round(min(max((bmi_val - 12.0) * (1.1 if gender == 'female' else 0.9), 5.0), 45.0), 1)

    bcc_data = {
        "available": True,
        "muscle_pct": m_pct,
        "fat_pct": f_pct,
        "smm_kg": smm if smm else round(w * (m_pct / 100.0), 1),
        "fat_kg": fat_mass if fat_mass else round(w * (f_pct / 100.0), 1)
    }

    return {
        "score": g_score,
        "global_score": g_score,
        "muscle_score": m_score,
        "fat_score": f_score,
        "rank": rank_str,
        "ree_kcal": energy.get('ree_kcal', 1500),
        "tee_kcal": energy.get('tee_kcal', 2000),
        "phase_angle": phase_angle,
        "cell_status": biva.get('cell_status', 'Normal'),
        "biva": biva,
        "scores": scores,
        "hydration": hydration,
        "visceral": visceral,
        "energy": energy,
        "bcc": bcc_data,
        "clinical_findings": findings,
        "body_comp": {
            "smm_kg": smm or 0,
            "fat_kg": fat_mass or 0,
            "tbw_l": tbw or 0,
            "ecw_l": ecw or 0,
            "visceral_level": visceral_fat or 0
        },
        "inputs": {
            "resistance": r,
            "reactance": xc,
            "weight": w,
            "height": h,
            "age": age,
            "gender": gender,
            "pal": pal,
            "waist": waist
        }
    }

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
        "code": _get_next_available_eval_code(current_uid),
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

@evaluations_bp.route('/api/evaluations/batch-delete', methods=['POST'])
@evaluations_bp.route('/api/evaluations/batch', methods=['DELETE', 'POST'])
def batch_delete_evaluations():
    current_user = _get_current_user()
    if not current_user:
        return jsonify({"error": "No autorizado", "success": False}), 401

    data = request.json or {}
    ids_to_delete = data.get('ids') or []
    if isinstance(ids_to_delete, str):
        ids_to_delete = [ids_to_delete]

    str_ids = [str(i) for i in ids_to_delete if i and str(i) != 'undefined']

    if not str_ids:
        return jsonify({"error": "No se especificaron evaluaciones válidas para eliminar", "success": False}), 400

    global _LOCAL_EVALUATIONS
    _LOCAL_EVALUATIONS = _load_persisted_evaluations()

    initial_count = len(_LOCAL_EVALUATIONS)
    _LOCAL_EVALUATIONS = [
        e for e in _LOCAL_EVALUATIONS
        if isinstance(e, dict) and str(e.get('id')) not in str_ids and str(e.get('code')) not in str_ids
    ]
    deleted_count = initial_count - len(_LOCAL_EVALUATIONS)
    _save_persisted_evaluations(_LOCAL_EVALUATIONS)

    if supabase:
        try:
            for eval_id in str_ids:
                supabase.table('evaluations').delete().eq('id', eval_id).execute()
                supabase.table('evaluations').delete().eq('code', eval_id).execute()
        except Exception as e:
            logging.warning("No se pudieron eliminar evaluaciones en lote de Supabase: %s", e)

    _invalidate_dashboard_cache()
    return jsonify({
        "success": True,
        "message": f"Se eliminaron {deleted_count or len(str_ids)} evaluaciones correctamente.",
        "deleted_count": deleted_count or len(str_ids)
    }), 200

@evaluations_bp.route('/api/evaluations/<eval_id>', methods=['DELETE'])
def delete_evaluation(eval_id):
    current_user = _get_current_user()
    if not current_user:
        return jsonify({"error": "No autorizado"}), 401

    current_uid = current_user.get('id')
    target_str = str(eval_id)

    global _LOCAL_EVALUATIONS
    _LOCAL_EVALUATIONS = _load_persisted_evaluations()

    _LOCAL_EVALUATIONS = [
        e for e in _LOCAL_EVALUATIONS
        if isinstance(e, dict) and str(e.get('id')) != target_str and str(e.get('code')) != target_str
    ]
    _save_persisted_evaluations(_LOCAL_EVALUATIONS)

    if supabase:
        try:
            supabase.table('evaluations').delete().eq('id', target_str).execute()
            supabase.table('evaluations').delete().eq('code', target_str).execute()
        except Exception as e:
            logging.warning("No se pudo borrar evaluación en Supabase: %s", e)

    _invalidate_dashboard_cache()
    return jsonify({"success": True, "message": "Evaluación eliminada correctamente."})

@evaluations_bp.route('/api/dashboard-data', methods=['POST'])
@evaluations_bp.route('/api/bia/calculate', methods=['POST'])
def calculate_bia_api():
    current_user = _get_current_user()
    current_uid = current_user.get('id') if current_user else None

    data = request.json or {}
    report = compute_full_bia_analysis(data)

    should_save = data.get('save') is True

    if should_save:
        if not current_user:
            return jsonify({"error": "No autorizado para guardar evaluación"}), 401
        if not _is_subscription_active(current_user):
            return jsonify({
                "error": "Tu suscripción ha vencido. Canjea un PIN para guardar evaluaciones clínicas.",
                "subscription_expired": True
            }), 403

        eval_id = str(uuid.uuid4())
        p_name = _clean_str(data.get('patient_name') or data.get('name'), max_len=100) or "Paciente sin registrar"
        p_idp = _clean_str(data.get('patient_idp') or data.get('idp'), max_len=50)

        new_eval = {
            "id": eval_id,
            "user_id": current_uid,
            "code": _get_next_available_eval_code(current_uid),
            "patient_name": p_name,
            "patient_idp": p_idp,
            "resistance": float(data.get('resistance') or 0),
            "reactance": float(data.get('reactance') or 0),
            "weight": float(data.get('weight') or 0),
            "height": float(data.get('height') or 0),
            "age": int(data.get('age') or 0),
            "gender": _normalize_gender(data.get('gender')),
            "report": report,
            "created_at": datetime.now(timezone.utc).isoformat()
        }

        global _LOCAL_EVALUATIONS
        if not isinstance(_LOCAL_EVALUATIONS, list):
            _LOCAL_EVALUATIONS = []
        _LOCAL_EVALUATIONS.insert(0, new_eval)
        _save_persisted_evaluations(_LOCAL_EVALUATIONS)

        if supabase:
            try:
                supabase.table('evaluations').insert({
                    "id": eval_id,
                    "user_id": current_uid,
                    "code": new_eval['code'],
                    "patient_name": p_name,
                    "patient_idp": p_idp,
                    "resistance": new_eval['resistance'],
                    "reactance": new_eval['reactance'],
                    "weight": new_eval['weight'],
                    "height": new_eval['height'],
                    "age": new_eval['age'],
                    "gender": new_eval['gender'],
                    "created_at": new_eval['created_at']
                }).execute()
            except Exception as e:
                logging.warning("No se pudo registrar evaluación en Supabase: %s", e)

        _invalidate_dashboard_cache()
        response_dict = {
            "success": True,
            "saved": True,
            "evaluation": new_eval
        }
        response_dict.update(report)
        return jsonify(response_dict), 201

    response_dict = {
        "success": True,
        "saved": False
    }
    response_dict.update(report)
    return jsonify(response_dict), 200
