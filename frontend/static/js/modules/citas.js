// ============================================================
// VITAMETRIX - MÓDULO 08: AGENDA Y CITAS MÉDICAS
// Archivo: frontend/static/js/modules/citas.js
// ============================================================

let clinicAppointments = [];

function initAppointmentsCalendar() {
    fetchAppointments();
}

async function fetchAppointments() {
    try {
        const res = await fetch('/api/appointments', { headers: getAuthHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        clinicAppointments = Array.isArray(data) ? data : (data.appointments || []);
        renderAppointmentsCalendar();
    } catch (e) {
        console.warn('Error al cargar agenda de citas:', e);
    }
}

function renderAppointmentsCalendar() {
    const listEl = document.getElementById('appointments-list');
    if (!listEl) return;

    if (clinicAppointments.length === 0) {
        listEl.innerHTML = '<div class="text-muted p-3 text-center">No hay citas programadas.</div>';
        return;
    }

    listEl.innerHTML = clinicAppointments.map(a => `
        <div class="p-2 border-bottom d-flex align-items-center justify-content-between">
            <div>
                <strong>${escapeHtml(a.patient_name || 'Paciente')}</strong>
                <div class="text-xs text-muted">📅 ${escapeHtml(a.date || '')} - ${escapeHtml(a.time || '')}</div>
            </div>
            <span class="badge bg-primary-subtle text-primary">${escapeHtml(a.status || 'Confirmada')}</span>
        </div>
    `).join('');
}
