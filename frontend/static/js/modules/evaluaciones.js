// ============================================================
// VITAMETRIX - MÓDULO 07: HISTORIAL CLÍNICO Y EVALUACIONES BIA
// Archivo: frontend/static/js/modules/evaluaciones.js
// ============================================================

let allEvaluationsData = [];
let selectedEvaluationData = null;

function initEvaluaciones() {
    const searchInput = document.getElementById('search-evaluaciones');
    const filterStatus = document.getElementById('filter-evaluaciones-status');

    if (searchInput) searchInput.addEventListener('input', () => filterAndRenderEvaluaciones());
    if (filterStatus) filterStatus.addEventListener('change', () => filterAndRenderEvaluaciones());

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
            const bioNav = document.querySelector('[data-target="bio-view"]');
            if (bioNav) bioNav.click();

            const data = selectedEvaluationData;
            const inp = data.raw_inputs || {};

            if (document.getElementById('input-name')) document.getElementById('input-name').value = data.patient_name || data.name || '';
            if (document.getElementById('input-idp')) document.getElementById('input-idp').value = data.patient_idp || data.idp || '';
            if (document.getElementById('input-weight')) document.getElementById('input-weight').value = inp.weight && inp.weight !== '--' ? inp.weight : '';
            if (document.getElementById('input-height')) document.getElementById('input-height').value = inp.height && inp.height !== '--' ? inp.height : '';
            if (document.getElementById('input-age')) document.getElementById('input-age').value = inp.age && inp.age !== '--' ? inp.age : '';
            if (document.getElementById('input-gender')) document.getElementById('input-gender').value = inp.gender || 'male';
            if (document.getElementById('input-r')) document.getElementById('input-r').value = inp.resistance && inp.resistance !== '--' ? inp.resistance : '';
            if (document.getElementById('input-xc')) document.getElementById('input-xc').value = inp.reactance && inp.reactance !== '--' ? inp.reactance : '';
            if (document.getElementById('input-pal')) document.getElementById('input-pal').value = inp.pal || '1.55';
            if (document.getElementById('input-smm')) document.getElementById('input-smm').value = inp.smm && inp.smm !== '--' ? inp.smm : '';
            if (document.getElementById('input-fat-mass')) document.getElementById('input-fat-mass').value = inp.fat_mass && inp.fat_mass !== '--' ? inp.fat_mass : '';
            if (document.getElementById('input-visceral')) document.getElementById('input-visceral').value = inp.visceral_fat && inp.visceral_fat !== '--' ? inp.visceral_fat : '';

            showToast(`⚡ Ficha de ${data.patient_name || 'Paciente'} cargada en la calculadora`, 'info');
        });
    }

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
        const createdStr = formatLocalDateTime(e.created_at);
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
                        <i class="bi bi-eye-fill"></i> Abrir
                    </button>
                    <button type="button" class="btn btn-light btn-xs border text-danger" onclick="deleteEvaluation('${e.id}')" title="Eliminar">
                        <i class="bi bi-trash-fill"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

async function openEvaluationDetailModal(evalId) {
    const modal = document.getElementById('eval-detail-modal');
    if (!modal) return;

    showToast('Cargando expediente de evaluación...', 'info');

    try {
        const res = await fetch(`/api/evaluations/${evalId}`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error('No se pudo obtener la evaluación');
        const data = await res.json();
        selectedEvaluationData = data;

        const nameEl = document.getElementById('eval-modal-name');
        const metaEl = document.getElementById('eval-modal-meta');
        const scoreEl = document.getElementById('eval-modal-score');
        const rankEl = document.getElementById('eval-modal-rank');
        const phaseEl = document.getElementById('eval-modal-phase');
        const cellEl = document.getElementById('eval-modal-cell');
        const teeEl = document.getElementById('eval-modal-tee');

        if (nameEl) nameEl.textContent = data.patient_name || data.name || 'Paciente';
        const evalCodeStr = data.code ? ` | Código: ${data.code}` : '';
        const formattedDate = formatLocalDateTime(data.created_at);
        if (metaEl) metaEl.textContent = `IDP: ${data.patient_idp || data.idp || '--'}${evalCodeStr} | Fecha: ${formattedDate}`;

        const scoreVal = Math.round(data.global_score ?? data.score ?? 0);
        if (scoreEl) scoreEl.textContent = scoreVal;
        if (rankEl) rankEl.textContent = data.rank || 'Normal';

        const phaseVal = (data.phase_angle !== undefined && data.phase_angle !== null) ? Number(data.phase_angle).toFixed(1) : '0.0';
        if (phaseEl) phaseEl.textContent = `${phaseVal}°`;
        if (cellEl) cellEl.textContent = data.cell_status || 'Óptimo';

        if (teeEl) teeEl.textContent = Math.round(data.tee_kcal ?? 2000);

        const inputsGrid = document.getElementById('eval-modal-inputs-grid');
        if (inputsGrid && data.raw_inputs) {
            const inp = data.raw_inputs;
            const genderStr = (inp.gender === 'female' || inp.gender === 'Femenino') ? 'Femenino' : 'Masculino';
            inputsGrid.innerHTML = `
                <div class="p-2 rounded-3 bg-white border d-flex justify-content-between align-items-center shadow-2xs"><span class="text-muted">Peso:</span><strong class="text-navy">${inp.weight || '--'} kg</strong></div>
                <div class="p-2 rounded-3 bg-white border d-flex justify-content-between align-items-center shadow-2xs"><span class="text-muted">Altura:</span><strong class="text-navy">${inp.height || '--'} cm</strong></div>
                <div class="p-2 rounded-3 bg-white border d-flex justify-content-between align-items-center shadow-2xs"><span class="text-muted">Edad:</span><strong class="text-navy">${inp.age || '--'} años</strong></div>
                <div class="p-2 rounded-3 bg-white border d-flex justify-content-between align-items-center shadow-2xs"><span class="text-muted">Género:</span><strong class="text-navy">${genderStr}</strong></div>
                <div class="p-2 rounded-3 bg-white border d-flex justify-content-between align-items-center shadow-2xs"><span class="text-muted">Resistencia (R):</span><strong class="text-navy">${inp.resistance || '--'} Ω</strong></div>
                <div class="p-2 rounded-3 bg-white border d-flex justify-content-between align-items-center shadow-2xs"><span class="text-muted">Reactancia (Xc):</span><strong class="text-navy">${inp.reactance || '--'} Ω</strong></div>
                <div class="p-2 rounded-3 bg-white border d-flex justify-content-between align-items-center shadow-2xs"><span class="text-muted">Masa Muscular:</span><strong class="text-success">${inp.smm && inp.smm !== '--' ? inp.smm + ' kg' : '-- kg'}</strong></div>
                <div class="p-2 rounded-3 bg-white border d-flex justify-content-between align-items-center shadow-2xs"><span class="text-muted">Masa Grasa:</span><strong class="text-danger">${inp.fat_mass && inp.fat_mass !== '--' ? inp.fat_mass + ' kg' : '-- kg'}</strong></div>
                <div class="p-2 rounded-3 bg-white border d-flex justify-content-between align-items-center shadow-2xs"><span class="text-muted">Grasa Visceral:</span><strong class="text-navy">${inp.visceral_fat && inp.visceral_fat !== '--' ? inp.visceral_fat + ' L' : '-- L'}</strong></div>
                <div class="p-2 rounded-3 bg-white border d-flex justify-content-between align-items-center shadow-2xs"><span class="text-muted">PAL (Actividad):</span><strong class="text-navy">${inp.pal || '1.55'}</strong></div>
            `;
        }

        const clinicalBox = document.getElementById('eval-modal-clinical');
        if (clinicalBox) {
            let html = `<p style="margin-top: 0;"><strong>Diagnóstico general:</strong> El paciente presenta un estado celular <strong>${(data.cell_status || 'Óptimo').toLowerCase()}</strong> con un TRU Score de <strong>${scoreVal}/100</strong>.</p>`;
            if (data.clinical_findings && data.clinical_findings.length > 0) {
                html += `<ul style="margin: 0.5rem 0 0 1.2rem; padding: 0;">`;
                data.clinical_findings.forEach(f => {
                    html += `<li style="margin-bottom: 0.3rem;">${escapeHtml(f)}</li>`;
                });
                html += `</ul>`;
            }
            clinicalBox.innerHTML = html;
        }

        modal.classList.remove('hidden');
    } catch (err) {
        console.error('Error al abrir evaluación:', err);
        showToast('Error al obtener la evaluación del servidor.', 'error');
    }
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
