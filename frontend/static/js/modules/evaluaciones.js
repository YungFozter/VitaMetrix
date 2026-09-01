// ============================================================
// VITAMETRIX - MÓDULO 07: HISTORIAL CLÍNICO Y EVALUACIONES BIA
// Archivo: frontend/static/js/modules/evaluaciones.js
// ============================================================

let allEvaluationsData = [];

function initEvaluaciones() {
    const searchInput = document.getElementById('search-evaluaciones');
    const filterStatus = document.getElementById('filter-evaluaciones-status');

    if (searchInput) searchInput.addEventListener('input', () => filterAndRenderEvaluaciones());
    if (filterStatus) filterStatus.addEventListener('change', () => filterAndRenderEvaluaciones());

    fetchEvaluaciones();
}

async function fetchEvaluaciones() {
    try {
        const res = await fetch('/api/evaluations', { headers: getAuthHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        allEvaluationsData = Array.isArray(data) ? data : (data.evaluations || []);
        
        allEvaluationsData.forEach(e => {
            if (!e.id && e.code) e.id = e.code;
        });

        evalsDataLoaded = true;
        filterAndRenderEvaluaciones();
    } catch (e) {
        console.warn('Error al cargar historial de evaluaciones:', e);
    }
}

function filterAndRenderEvaluaciones() {
    const tbody = document.getElementById('tbody-evaluaciones');
    if (!tbody) return;

    const search = (document.getElementById('search-evaluaciones')?.value || '').toLowerCase().trim();

    let filtered = [...allEvaluationsData];

    if (search) {
        filtered = filtered.filter(e => 
            (e.patient_name || '').toLowerCase().includes(search) ||
            (e.patient_idp || '').toLowerCase().includes(search) ||
            (e.code || '').toLowerCase().includes(search)
        );
    }

    renderEvaluacionesTable(filtered);
}

function renderEvaluacionesTable(evals) {
    const tbody = document.getElementById('tbody-evaluaciones');
    const countEl = document.getElementById('evals-total-count');
    if (!tbody) return;

    if (countEl) countEl.textContent = evals.length;

    if (evals.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-5 text-muted">
                    <i class="bi bi-journal-medical fs-2 d-block mb-2 text-secondary opacity-50"></i>
                    No se encontraron evaluaciones registradas.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = evals.map(e => {
        const createdStr = e.created_at ? new Date(e.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '---';
        return `
            <tr>
                <td class="ps-3 py-3 font-monospace fw-bold text-primary">${escapeHtml(e.code || 'EVA-001')}</td>
                <td>
                    <div class="fw-bold text-navy">${escapeHtml(e.patient_name || 'Paciente')}</div>
                    <div class="text-muted text-xs">IDP: ${escapeHtml(e.patient_idp || 'N/A')}</div>
                </td>
                <td>${e.weight ? `${e.weight} kg` : '--'}</td>
                <td>${e.height ? `${e.height} cm` : '--'}</td>
                <td>
                    <span class="badge bg-info-subtle text-info border border-info border-opacity-25 px-2.5 py-1 rounded-pill fw-bold text-xs">
                        📊 Completado
                    </span>
                </td>
                <td>${createdStr}</td>
                <td class="text-end pe-3">
                    <button type="button" class="btn btn-light btn-xs border text-primary me-1" onclick="openEvaluationDetailModal('${e.id}')" title="Ver Detalle">
                        <i class="bi bi-eye-fill"></i>
                    </button>
                    <button type="button" class="btn btn-light btn-xs border text-danger" onclick="deleteEvaluation('${e.id}')" title="Eliminar">
                        <i class="bi bi-trash-fill"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function openEvaluationDetailModal(id) {
    showToast('Abriendo evaluación ' + id, 'info');
}

function deleteEvaluation(id) {
    showConfirm(
        'Eliminar Evaluación',
        '¿Deseas eliminar permanentemente esta evaluación del historial clínico?',
        async () => {
            try {
                const res = await fetch(`/api/evaluations/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
                if (res.ok) {
                    showToast('Evaluación eliminada.', 'info');
                    fetchEvaluaciones();
                }
            } catch (e) {}
        }
    );
}

function initPatientHistoryModal() {}
