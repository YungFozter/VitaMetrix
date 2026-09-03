// ============================================================
// VITAMETRIX - MÓDULO 07: HISTORIAL CLÍNICO Y EVALUACIONES BIA
// Archivo: frontend/static/js/modules/evaluaciones.js
// ============================================================

let allEvaluationsData = [];
let selectedEvaluationData = null;
let selectedEvalIds = new Set();
let evalCurrentPage = 1;
let evalPageSize = 25;
let evalsDataLoaded = false;

function initEvaluaciones() {
    const searchInput = document.getElementById('eval-search-input');
    const filterStatus = document.getElementById('eval-filter-status');
    const pageSizeSelect = document.getElementById('eval-page-size');
    const btnRefresh = document.getElementById('btn-refresh-evals');

    if (searchInput) searchInput.addEventListener('input', () => { evalCurrentPage = 1; filterAndRenderEvaluaciones(); });
    if (filterStatus) filterStatus.addEventListener('change', () => { evalCurrentPage = 1; filterAndRenderEvaluaciones(); });
    if (pageSizeSelect) {
        pageSizeSelect.addEventListener('change', (e) => {
            evalPageSize = e.target.value === 'all' ? 999999 : parseInt(e.target.value);
            evalCurrentPage = 1;
            filterAndRenderEvaluaciones();
        });
    }

    if (btnRefresh) {
        btnRefresh.addEventListener('click', () => fetchEvaluaciones(true));
    }

    const selectAllCb = document.getElementById('eval-select-all');
    if (selectAllCb) {
        selectAllCb.addEventListener('change', () => {
            const isChecked = selectAllCb.checked;
            const cbs = document.querySelectorAll('.eval-row-cb');
            cbs.forEach(cb => {
                cb.checked = isChecked;
                if (isChecked) selectedEvalIds.add(cb.dataset.id);
                else selectedEvalIds.delete(cb.dataset.id);
            });
            updateBulkActionsBar();
        });
    }

    const btnBulkDeselect = document.getElementById('btn-eval-bulk-deselect');
    if (btnBulkDeselect) {
        btnBulkDeselect.addEventListener('click', () => {
            selectedEvalIds.clear();
            if (selectAllCb) selectAllCb.checked = false;
            document.querySelectorAll('.eval-row-cb').forEach(cb => cb.checked = false);
            updateBulkActionsBar();
        });
    }

    const btnBulkDelete = document.getElementById('btn-eval-bulk-delete');
    if (btnBulkDelete) {
        btnBulkDelete.addEventListener('click', handleBulkDeleteEvaluations);
    }

    // Modal de Detalle
    const modalClose = document.getElementById('eval-modal-close');
    const modal = document.getElementById('eval-detail-modal');
    if (modalClose && modal) {
        modalClose.addEventListener('click', () => modal.classList.add('hidden'));
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.add('hidden');
        });
    }

    const btnReloadCalc = document.getElementById('btn-modal-open-calc');
    if (btnReloadCalc) {
        btnReloadCalc.addEventListener('click', () => {
            if (!selectedEvaluationData) return;
            if (modal) modal.classList.add('hidden');
            if (typeof loadEvaluationToCalculator === 'function') {
                loadEvaluationToCalculator(selectedEvaluationData.id || selectedEvaluationData.code);
            }
        });
    }

    fetchEvaluaciones();
}

async function fetchEvaluaciones(force = false) {
    if (evalsDataLoaded && !force) return;

    const tbody = document.getElementById('evaluaciones-tbody');
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
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center py-5 text-danger">Error al cargar historial clínico.</td></tr>';
        }
    }
}

function filterAndRenderEvaluaciones() {
    const tbody = document.getElementById('evaluaciones-tbody');
    if (!tbody) return;

    const search = (document.getElementById('eval-search-input')?.value || '').toLowerCase().trim();
    const statusFilter = document.getElementById('eval-filter-status')?.value || 'all';

    let filtered = [...allEvaluationsData];

    if (search) {
        filtered = filtered.filter(e => 
            (e.patient_name || e.name || '').toLowerCase().includes(search) ||
            (e.patient_idp || e.idp || '').toLowerCase().includes(search) ||
            (e.code || '').toLowerCase().includes(search)
        );
    }

    if (statusFilter !== 'all') {
        filtered = filtered.filter(e => {
            const report = e.report || {};
            const biva = report.biva || {};
            const cellStatus = (e.cell_status || biva.cell_status || '').toLowerCase();
            const pha = parseFloat(e.phase_angle || biva.phase_angle || 0);

            if (statusFilter === 'Óptimo') return pha > 6.0 || cellStatus.includes('óptimo') || cellStatus.includes('excelente');
            if (statusFilter === 'Límite') return (pha >= 5.0 && pha <= 6.0) || cellStatus.includes('buena') || cellStatus.includes('límite');
            if (statusFilter === 'Bajo') return pha < 5.0 || cellStatus.includes('bajo') || cellStatus.includes('monitorear');
            return true;
        });
    }

    const totalFiltered = filtered.length;
    const startIndex = (evalCurrentPage - 1) * evalPageSize;
    const paginated = filtered.slice(startIndex, startIndex + evalPageSize);

    renderEvaluationsTable(paginated, startIndex, totalFiltered);
    renderEvaluationsPagination(totalFiltered);
    updateBulkActionsBar();
}

function renderEvaluationsTable(evals, startIndex, total) {
    const tbody = document.getElementById('evaluaciones-tbody');
    if (!tbody) return;

    if (evals.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center py-5 text-muted">
                    <i class="bi bi-folder2-open fs-2 d-block mb-2 text-secondary opacity-50"></i>
                    No se encontraron evaluaciones con los filtros seleccionados.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = evals.map(ev => {
        const id = ev.id || ev.code;
        const code = escapeHtml(ev.code || 'EVA-001');
        const dateStr = formatLocalDateTime(ev.created_at || ev.date);
        const name = escapeHtml(ev.patient_name || ev.name || 'Paciente');
        const idp = escapeHtml(ev.patient_idp || ev.idp || 'IDP-0001');

        const inp = ev.raw_inputs || ev;
        const r = inp.resistance ? `${parseFloat(inp.resistance).toFixed(1)} Ω` : '--';
        const xc = inp.reactance ? `${parseFloat(inp.reactance).toFixed(1)} Ω` : '--';
        const w = inp.weight ? `${parseFloat(inp.weight).toFixed(1)} kg` : '--';

        const report = ev.report || {};
        const scores = report.scores || {};
        const biva = report.biva || {};

        const truScore = Math.round(parseFloat(ev.global_score || scores.global_score || 0));
        const pha = parseFloat(ev.phase_angle || biva.phase_angle || 0).toFixed(2);

        let statusBadge = '<span class="badge bg-success-subtle text-success border border-success-subtle px-2 py-1 rounded-pill">🟢 Óptimo</span>';
        if (parseFloat(pha) < 5.0) {
            statusBadge = '<span class="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1 rounded-pill">🔴 Bajo</span>';
        } else if (parseFloat(pha) <= 6.0) {
            statusBadge = '<span class="badge bg-warning-subtle text-warning border border-warning-subtle px-2 py-1 rounded-pill">🟡 Límite</span>';
        }

        const isChecked = selectedEvalIds.has(String(id));

        return `
            <tr>
                <td style="text-align: center; vertical-align: middle;">
                    <input type="checkbox" class="form-check-input eval-row-cb shadow-none cursor-pointer" 
                        data-id="${id}" ${isChecked ? 'checked' : ''} onchange="toggleEvalSelection('${id}')">
                </td>
                <td class="fw-bold font-monospace text-primary">${code}</td>
                <td class="text-muted small">${dateStr}</td>
                <td>
                    <div class="fw-bold text-navy">${name}</div>
                    <div class="text-muted text-xs font-monospace">${idp}</div>
                </td>
                <td class="small text-muted font-monospace">
                    <div>R: ${r} • Xc: ${xc}</div>
                    <div>Peso: ${w}</div>
                </td>
                <td>
                    <span class="badge bg-primary-subtle text-primary fw-bold font-monospace px-2.5 py-1">
                        ${truScore} pts
                    </span>
                </td>
                <td>
                    <span class="fw-bold text-navy font-monospace">${pha}°</span>
                </td>
                <td>${statusBadge}</td>
                <td style="text-align: right;" class="pe-3">
                    <button type="button" class="btn btn-light btn-xs border text-primary me-1" onclick="openEvaluationDetail('${id}')" title="Ver análisis completo">
                        <i class="bi bi-eye-fill"></i>
                    </button>
                    <button type="button" class="btn btn-light btn-xs border text-danger" onclick="deleteSingleEvaluation('${id}', '${code}')" title="Eliminar estudio">
                        <i class="bi bi-trash-fill"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function renderEvaluationsPagination(total) {
    const rangeEl = document.getElementById('eval-info-range');
    const totalEl = document.getElementById('eval-info-total');
    const controls = document.getElementById('eval-pagination-controls');
    if (!rangeEl || !totalEl || !controls) return;

    totalEl.textContent = total;
    if (total === 0) {
        rangeEl.textContent = '0-0';
        controls.innerHTML = '';
        return;
    }

    const start = (evalCurrentPage - 1) * evalPageSize + 1;
    const end = Math.min(evalCurrentPage * evalPageSize, total);
    rangeEl.textContent = `${start}-${end}`;

    const totalPages = Math.ceil(total / evalPageSize);
    let html = `
        <button type="button" class="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1 shadow-none" 
            id="eval-btn-prev" ${evalCurrentPage <= 1 ? 'disabled' : ''} onclick="changeEvalPage(${evalCurrentPage - 1})">
            ‹ Anterior
        </button>
        <span class="text-muted small px-2">Pág. ${evalCurrentPage} de ${totalPages}</span>
        <button type="button" class="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1 shadow-none" 
            id="eval-btn-next" ${evalCurrentPage >= totalPages ? 'disabled' : ''} onclick="changeEvalPage(${evalCurrentPage + 1})">
            Siguiente ›
        </button>
    `;
    controls.innerHTML = html;
}

function changeEvalPage(page) {
    if (page < 1) return;
    evalCurrentPage = page;
    filterAndRenderEvaluaciones();
}

function toggleEvalSelection(id) {
    const idStr = String(id);
    if (selectedEvalIds.has(idStr)) selectedEvalIds.delete(idStr);
    else selectedEvalIds.add(idStr);
    updateBulkActionsBar();
}

function updateBulkActionsBar() {
    const bar = document.getElementById('eval-bulk-actions-bar');
    const text = document.getElementById('eval-bulk-count-text');
    if (!bar) return;

    const count = selectedEvalIds.size;
    if (count > 0) {
        bar.classList.remove('hidden');
        bar.style.display = 'flex';
        if (text) text.textContent = `${count} evaluación(es) seleccionada(s)`;
    } else {
        bar.classList.add('hidden');
        bar.style.display = 'none';
    }
}

async function handleBulkDeleteEvaluations() {
    const count = selectedEvalIds.size;
    if (count === 0) return;

    showConfirm(
        'Eliminar Evaluaciones en Lote',
        `¿Confirmas la eliminación permanente de <strong>${count} evaluaciones</strong> seleccionadas? Sus códigos de correlación se liberarán para reciclaje.`,
        async () => {
            try {
                const res = await fetch('/api/evaluations/batch-delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                    body: JSON.stringify({ ids: Array.from(selectedEvalIds) })
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    showToast(`🗑️ ${count} evaluaciones eliminadas correctamente`, 'info');
                    selectedEvalIds.clear();
                    await fetchEvaluaciones(true);
                    if (typeof fetchDashboardStats === 'function') fetchDashboardStats(true);
                } else {
                    showToast(data.error || 'Error al eliminar evaluaciones', 'error');
                }
            } catch (e) {
                showToast('Error de conexión al eliminar en lote', 'error');
            }
        }
    );
}

function deleteSingleEvaluation(id, code) {
    showConfirm(
        'Eliminar Evaluación',
        `¿Deseas eliminar permanentemente el estudio <strong>${code}</strong>? Su código correlativo será liberado para la próxima evaluación guardada.`,
        async () => {
            try {
                const res = await fetch(`/api/evaluations/${id}`, {
                    method: 'DELETE',
                    headers: getAuthHeaders()
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    showToast(`Estudio ${code} eliminado con éxito`, 'info');
                    selectedEvalIds.delete(String(id));
                    await fetchEvaluaciones(true);
                    if (typeof fetchDashboardStats === 'function') fetchDashboardStats(true);
                } else {
                    showToast(data.error || 'Error al eliminar estudio', 'error');
                }
            } catch (e) {
                showToast('Error de red al eliminar evaluación', 'error');
            }
        }
    );
}

async function openEvaluationDetail(id) {
    try {
        const res = await fetch(`/api/evaluations/${id}`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error('No se pudo cargar la evaluación');
        const data = await res.json();
        selectedEvaluationData = data;

        const modal = document.getElementById('eval-detail-modal');
        if (!modal) {
            loadEvaluationToCalculator(id);
            return;
        }

        const titleEl = document.getElementById('modal-eval-code');
        const nameEl = document.getElementById('modal-eval-patient');
        const dateEl = document.getElementById('modal-eval-date');
        const scoreEl = document.getElementById('modal-eval-score');
        const phaEl = document.getElementById('modal-eval-pha');
        const textEl = document.getElementById('modal-eval-text');

        if (titleEl) titleEl.textContent = data.code || 'EVA-001';
        if (nameEl) nameEl.textContent = `${data.patient_name || data.name} (${data.patient_idp || data.idp || 'IDP-0001'})`;
        if (dateEl) dateEl.textContent = formatLocalDateTime(data.created_at || data.date);
        
        const report = data.report || {};
        const scores = report.scores || {};
        const biva = report.biva || {};

        if (scoreEl) scoreEl.textContent = `${Math.round(parseFloat(data.global_score || scores.global_score || 0))} pts`;
        if (phaEl) phaEl.textContent = `${parseFloat(data.phase_angle || biva.phase_angle || 0).toFixed(2)}°`;
        if (textEl) textEl.textContent = report.clinical_interpretation || data.clinical_interpretation || 'Sin observaciones.';

        modal.classList.remove('hidden');
    } catch (e) {
        console.warn('Detalle modal:', e);
        loadEvaluationToCalculator(id);
    }
}

function formatLocalDateTime(isoStr) {
    if (!isoStr) return '--';
    try {
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return isoStr.replace('T', ' ').substring(0, 16);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
    } catch (e) {
        return isoStr.replace('T', ' ').substring(0, 16);
    }
}

// Exportación global
window.allEvaluationsData = allEvaluationsData;
window.fetchEvaluaciones = fetchEvaluaciones;
window.initEvaluaciones = initEvaluaciones;
window.filterAndRenderEvaluaciones = filterAndRenderEvaluaciones;
window.toggleEvalSelection = toggleEvalSelection;
window.deleteSingleEvaluation = deleteSingleEvaluation;
window.openEvaluationDetail = openEvaluationDetail;
window.changeEvalPage = changeEvalPage;
