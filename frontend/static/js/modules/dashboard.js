// ============================================================
// VITAMETRIX - MÓDULO 04: DASHBOARD CLÍNICO & ANALÍTICA
// Archivo: frontend/static/js/modules/dashboard.js
// ============================================================

let dashboardStatsLoaded = false;
let dashboardStatsData = null;

async function fetchDashboardStats(forceRefresh = false) {
    if (dashboardStatsLoaded && !forceRefresh) return;

    const elClients = document.getElementById('dash-total-clients');
    const elEvals = document.getElementById('dash-total-evals');
    const elScore = document.getElementById('dash-avg-score');
    const tbodyRecent = document.getElementById('dash-recent-tbody');

    try {
        const res = await fetch('/api/dashboard/stats', { headers: getAuthHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        dashboardStatsData = data;
        dashboardStatsLoaded = true;

        const totalClients = data.total_clients || 0;
        const totalEvals = data.total_evaluations || 0;
        const avgScore = data.avg_score || 0;

        if (elClients) {
            if (typeof animateNumber === 'function') animateNumber(elClients, totalClients);
            else elClients.textContent = totalClients;
        }

        if (elEvals) {
            if (typeof animateNumber === 'function') animateNumber(elEvals, totalEvals);
            else elEvals.textContent = totalEvals;
        }

        if (elScore) {
            if (typeof animateNumber === 'function') animateNumber(elScore, avgScore);
            else elScore.textContent = avgScore;
        }

        renderRecentEvaluations(data.recent || []);

        // Actualizar datos cruzados en el perfil de configuración si existe
        const statPatients = document.getElementById('prof-stat-patients');
        const statEvals = document.getElementById('prof-stat-evals');
        if (statPatients && totalClients > 0) statPatients.textContent = totalClients;
        if (statEvals && totalEvals > 0) statEvals.textContent = totalEvals;

    } catch (e) {
        console.warn('Error al cargar analítica de Dashboard:', e);
        if (tbodyRecent) {
            tbodyRecent.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No fue posible conectar con el servidor.</td></tr>';
        }
    }
}

function renderRecentEvaluations(evals) {
    const tbody = document.getElementById('dash-recent-tbody');
    if (!tbody) return;

    if (!Array.isArray(evals) || evals.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-5 text-muted">
                    <i class="bi bi-activity fs-2 d-block mb-2 text-secondary opacity-50"></i>
                    No hay evaluaciones clínicas registradas aún.<br>
                    <button type="button" class="btn btn-sm btn-outline-primary mt-2 rounded-3" onclick="document.querySelector('[data-target=\\'bio-view\\']').click()">
                        <i class="bi bi-lightning-charge-fill me-1"></i> Realizar Primera Evaluación
                    </button>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = evals.map(ev => {
        const pName = escapeHtml(ev.patient_name || ev.name || 'Paciente sin registrar');
        const pIdp = escapeHtml(ev.patient_idp || ev.idp || ev.code || 'IDP-0001');
        const dateStr = (ev.date || ev.created_at || '').substring(0, 10);
        const score = Math.round(parseFloat(ev.score || ev.global_score || 0));
        const pha = parseFloat(ev.phase_angle || 0).toFixed(2);

        let statusBadge = '<span class="badge bg-success-subtle text-success border border-success-subtle px-2 py-1 rounded-pill">🟢 Óptimo</span>';
        if (pha < 5.0) {
            statusBadge = '<span class="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1 rounded-pill">🔴 Bajo</span>';
        } else if (pha <= 6.0) {
            statusBadge = '<span class="badge bg-warning-subtle text-warning border border-warning-subtle px-2 py-1 rounded-pill">🟡 Límite</span>';
        }

        return `
            <tr>
                <td class="ps-3 py-3">
                    <div class="fw-bold text-navy">${pName}</div>
                    <div class="text-muted text-xs font-monospace">${pIdp}</div>
                </td>
                <td class="text-muted small">${dateStr || '--'}</td>
                <td>
                    <span class="badge bg-primary-subtle text-primary fw-bold font-monospace px-2.5 py-1">
                        ${score} pts
                    </span>
                </td>
                <td>
                    <span class="fw-bold text-navy font-monospace">${pha}°</span>
                </td>
                <td>${statusBadge}</td>
                <td class="text-end pe-3">
                    <button type="button" class="btn btn-light btn-xs border text-primary fw-semibold px-2.5 py-1 rounded-2" 
                        onclick="loadEvaluationToCalculator('${ev.id || ev.code}')" title="Ver en Analizador">
                        <i class="bi bi-box-arrow-up-right me-1"></i> Ver
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

async function loadEvaluationToCalculator(evalId) {
    try {
        const res = await fetch(`/api/evaluations/${evalId}`, { headers: getAuthHeaders() });
        if (!res.ok) {
            // Intentar navegar directo a la vista
            const nav = document.querySelector('[data-target="evaluaciones-view"]');
            if (nav) nav.click();
            return;
        }
        const data = await res.json();
        
        // Cambiar a la vista de bioimpedancia
        const bioNav = document.querySelector('[data-target="bio-view"]');
        if (bioNav) bioNav.click();

        const inp = data.raw_inputs || data;

        if (document.getElementById('input-name')) document.getElementById('input-name').value = data.patient_name || data.name || '';
        if (document.getElementById('input-idp')) document.getElementById('input-idp').value = data.patient_idp || data.idp || '';
        if (document.getElementById('input-weight')) document.getElementById('input-weight').value = inp.weight || '';
        if (document.getElementById('input-height')) document.getElementById('input-height').value = inp.height || '';
        if (document.getElementById('input-age')) document.getElementById('input-age').value = inp.age || '';
        if (document.getElementById('input-gender')) document.getElementById('input-gender').value = inp.gender || 'male';
        if (document.getElementById('input-r')) document.getElementById('input-r').value = inp.resistance || '';
        if (document.getElementById('input-xc')) document.getElementById('input-xc').value = inp.reactance || '';
        if (document.getElementById('input-pal')) document.getElementById('input-pal').value = inp.pal || '1.4';
        if (document.getElementById('input-smm')) document.getElementById('input-smm').value = inp.smm || '';
        if (document.getElementById('input-fat-mass')) document.getElementById('input-fat-mass').value = inp.fat_mass || '';
        if (document.getElementById('input-visceral')) document.getElementById('input-visceral').value = inp.visceral_fat || '';

        if (typeof showToast === 'function') {
            showToast(`⚡ Ficha de ${data.patient_name || 'Paciente'} cargada en la calculadora`, 'info');
        }
    } catch (e) {
        console.error('Error al cargar estudio en calculadora:', e);
    }
}

function initDashboard() {
    fetchDashboardStats(true);
}

// Exportación global
window.fetchDashboardStats = fetchDashboardStats;
window.initDashboard = initDashboard;
window.loadEvaluationToCalculator = loadEvaluationToCalculator;
