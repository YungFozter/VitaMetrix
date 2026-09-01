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
def dashboard_stats():
    current_user = _get_current_user()
    current_uid = current_user.get('id') if current_user else None

    now = time.time()

    total_clients = 0
    total_evals = 0
    scores = []
    recent_evals = []
    cell_buckets = {"Óptimo": 0, "Límite": 0, "Bajo": 0}

    if supabase:
        try:
            res_c = supabase.table('clients').select('id, user_id', count='exact').execute()
            if res_c and res_c.data is not None:
                if current_uid and current_user.get('role') != 'admin':
                    total_clients = len([c for c in res_c.data if c.get('user_id') == current_uid or not c.get('user_id')])
                else:
                    total_clients = len(res_c.data)

            res_e = supabase.table('evaluations').select('*').order('created_at', desc=True).limit(50).execute()
            if res_e and res_e.data is not None:
                evals_data = res_e.data
                if current_uid and current_user.get('role') != 'admin':
                    evals_data = [e for e in evals_data if e.get('user_id') == current_uid or not e.get('user_id')]

                total_evals = len(evals_data)
                for ev in evals_data:
                    sc = ev.get('global_score')
                    if sc is not None and isinstance(sc, (int, float)):
                        scores.append(float(sc))

                    report = ev.get('report') or {}
                    biva = report.get('biva') or {}
                    pa = biva.get('phase_angle')
                    valid = biva.get('valid', True)
                    b = _cell_bucket(pa, valid)
                    cell_buckets[b] += 1

                for ev in evals_data[:5]:
                    recent_evals.append({
                        "id": ev.get('id'),
                        "patient_name": ev.get('patient_name', 'Paciente'),
                        "code": ev.get('code', 'N/A'),
                        "date": (ev.get('created_at') or '')[:10],
                        "global_score": ev.get('global_score', 0)
                    })
        except Exception as e:
            logging.warning("Error al calcular dashboard desde Supabase: %s", e)

    if total_evals == 0:
        evals_local = _load_persisted_evaluations()
        clients_local = _load_persisted_clients()

        if current_uid and current_user.get('role') != 'admin':
            evals_local = [e for e in evals_local if e.get('user_id') == current_uid or not e.get('user_id')]
            clients_local = [c for c in clients_local if c.get('user_id') == current_uid or not c.get('user_id')]

        total_clients = len(clients_local)
        total_evals = len(evals_local)

        for ev in evals_local:
            report = ev.get('report') or {}
            scores_dict = report.get('scores') or {}
            sc = scores_dict.get('global_score')
            if sc is not None:
                scores.append(float(sc))

            biva = report.get('biva') or {}
            pa = biva.get('phase_angle')
            valid = biva.get('valid', True)
            b = _cell_bucket(pa, valid)
            cell_buckets[b] += 1

        for ev in evals_local[:5]:
            report = ev.get('report') or {}
            sc_obj = report.get('scores') or {}
            recent_evals.append({
                "id": ev.get('id'),
                "patient_name": ev.get('patient_name', 'Paciente'),
                "code": ev.get('code', 'N/A'),
                "date": (ev.get('created_at') or '')[:10],
                "global_score": sc_obj.get('global_score', 0)
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
