import time
import logging
from flask import Blueprint, jsonify

from services.helpers import (
    supabase,
    _get_current_user,
    _cell_bucket,
    _EMPTY_DASHBOARD,
    _DASHBOARD_CACHE,
    _load_persisted_clients,
    _load_persisted_evaluations
)

dashboard_bp = Blueprint('dashboard_bp', __name__)

@dashboard_bp.route('/api/dashboard/stats', methods=['GET'])
@dashboard_bp.route('/api/dashboard-stats', methods=['GET'])
@dashboard_bp.route('/api/dashboard-data', methods=['GET'])
def dashboard_stats():
    current_user = _get_current_user()
    current_uid = current_user.get('id') if current_user else None

    now = time.time()

    total_clients = 0
    total_evals = 0
    scores = []
    recent_evals = []
    cell_buckets = {"Óptimo": 0, "Límite": 0, "Bajo": 0}

    evals_data = []
    clients_data = []

    if supabase:
        try:
            res_c = supabase.table('clients').select('id, user_id', count='exact').execute()
            if res_c and res_c.data is not None:
                clients_data = res_c.data

            res_e = supabase.table('evaluations').select('*').order('created_at', desc=True).limit(50).execute()
            if res_e and res_e.data is not None:
                evals_data = res_e.data
        except Exception as e:
            logging.warning("Error al calcular dashboard desde Supabase: %s", e)

    if not clients_data:
        clients_data = _load_persisted_clients()
    if not evals_data:
        evals_data = _load_persisted_evaluations()

    if current_uid and current_user.get('role') != 'admin':
        filtered_c = []
        for c in clients_data:
            if not isinstance(c, dict):
                continue
            c_uid = c.get('user_id')
            if not c_uid or c_uid in ('usr-doctor-001', 'None', 'null', ''):
                c_uid = current_uid
            if c_uid == current_uid:
                filtered_c.append(c)
        clients_data = filtered_c

        filtered_e = []
        for e in evals_data:
            if not isinstance(e, dict):
                continue
            e_uid = e.get('user_id')
            if not e_uid or e_uid in ('usr-doctor-001', 'None', 'null', ''):
                e_uid = current_uid
            if e_uid == current_uid:
                filtered_e.append(e)
        evals_data = filtered_e

    total_clients = len(clients_data)
    total_evals = len(evals_data)

    for ev in evals_data:
        report = ev.get('report') or {}
        scores_dict = report.get('scores') or {}
        biva_dict = report.get('biva') or {}

        sc = ev.get('global_score')
        if sc is None:
            sc = scores_dict.get('global_score')
        if sc is not None:
            try:
                scores.append(float(sc))
            except (ValueError, TypeError):
                pass

        pa = ev.get('phase_angle')
        if pa is None:
            pa = biva_dict.get('phase_angle')
        valid = biva_dict.get('valid', True)
        b = _cell_bucket(pa, valid)
        cell_buckets[b] += 1

    for ev in evals_data[:5]:
        report = ev.get('report') or {}
        scores_dict = report.get('scores') or {}
        biva_dict = report.get('biva') or {}

        p_name = ev.get('patient_name') or ev.get('name') or "Paciente sin registrar"
        p_idp = ev.get('patient_idp') or ev.get('idp') or "N/A"

        sc_val = ev.get('global_score')
        if sc_val is None:
            sc_val = scores_dict.get('global_score', 0)

        pa_val = ev.get('phase_angle')
        if pa_val is None:
            pa_val = biva_dict.get('phase_angle', 0)

        recent_evals.append({
            "id": ev.get('id'),
            "name": p_name,
            "patient_name": p_name,
            "idp": p_idp,
            "patient_idp": p_idp,
            "code": ev.get('code', 'N/A'),
            "date": (ev.get('created_at') or '')[:10],
            "score": float(sc_val or 0),
            "global_score": float(sc_val or 0),
            "phase_angle": float(pa_val or 0)
        })

    avg_score = round(sum(scores) / len(scores), 1) if scores else 0

    stats = {
        "total_clients": total_clients,
        "total_evaluations": total_evals,
        "avg_score": avg_score,
        "recent": recent_evals,
        "population": cell_buckets
    }

    _DASHBOARD_CACHE["timestamp"] = now
    _DASHBOARD_CACHE["data"] = stats

    return jsonify(stats)

@dashboard_bp.route('/api/dashboard/cell-distribution', methods=['GET'])
def cell_distribution():
    res = dashboard_stats()
    stats = res.get_json() or {}
    return jsonify(stats.get('population', {"Óptimo": 0, "Límite": 0, "Bajo": 0}))
