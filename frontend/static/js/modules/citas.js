// ============================================================
// VITAMETRIX - MÓDULO 08: AGENDA Y CITAS MÉDICAS
// Archivo: frontend/static/js/modules/citas.js
// ============================================================

let clinicAppointments = [];
let currentCalendarMonth = new Date().getMonth(); // 0-11
let currentCalendarYear = new Date().getFullYear();
let selectedCalendarDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
let editingAppointmentId = null;

const MONTH_NAMES_ES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function initAppointmentsCalendar() {
    setupCalendarNav();
    setupAppointmentModal();
    fetchAppointments();
}

async function fetchAppointments() {
    try {
        const res = await fetch('/api/appointments', { headers: getAuthHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        clinicAppointments = Array.isArray(data) ? data : (data.appointments || []);

        renderCalendarView();
        renderDayAppointments();
    } catch (e) {
        console.warn('Error al cargar agenda de citas:', e);
    }
}

// ============================================================
// 1. CALENDARIO DINÁMICO
// ============================================================

function setupCalendarNav() {
    const btnPrev = document.getElementById('cal-prev-month');
    const btnNext = document.getElementById('cal-next-month');
    const btnOpenModal = document.getElementById('btn-open-appointment-modal');

    if (btnPrev) {
        btnPrev.addEventListener('click', () => {
            currentCalendarMonth--;
            if (currentCalendarMonth < 0) {
                currentCalendarMonth = 11;
                currentCalendarYear--;
            }
            renderCalendarView();
        });
    }

    if (btnNext) {
        btnNext.addEventListener('click', () => {
            currentCalendarMonth++;
            if (currentCalendarMonth > 11) {
                currentCalendarMonth = 0;
                currentCalendarYear++;
            }
            renderCalendarView();
        });
    }

    if (btnOpenModal) {
        btnOpenModal.addEventListener('click', () => {
            openAppointmentModal(null, selectedCalendarDate);
        });
    }
}

function renderCalendarView() {
    const label = document.getElementById('cal-month-label');
    const grid = document.getElementById('calendar-days-grid');
    if (!grid) return;

    if (label) {
        label.textContent = `${MONTH_NAMES_ES[currentCalendarMonth]} ${currentCalendarYear}`;
    }

    // Primer día del mes y total de días
    const firstDayIndex = new Date(currentCalendarYear, currentCalendarMonth, 1).getDay(); // 0 = Domingo
    // Ajustar para que la semana empiece en Lunes (0=Lu, 6=Do)
    const startOffset = (firstDayIndex === 0 ? 6 : firstDayIndex - 1);
    const totalDays = new Date(currentCalendarYear, currentCalendarMonth + 1, 0).getDate();

    const todayStr = new Date().toISOString().split('T')[0];

    // Conteo de citas por día en este mes
    const monthPrefix = `${currentCalendarYear}-${String(currentCalendarMonth + 1).padStart(2, '0')}`;
    const appointmentsCountByDay = {};
    clinicAppointments.forEach(a => {
        if (a.date && a.date.startsWith(monthPrefix)) {
            appointmentsCountByDay[a.date] = (appointmentsCountByDay[a.date] || 0) + 1;
        }
    });

    let cellsHtml = '';

    // Días en blanco de relleno al inicio
    for (let i = 0; i < startOffset; i++) {
        cellsHtml += `<div class="cal-day-cell empty p-1"></div>`;
    }

    // Días del mes
    for (let day = 1; day <= totalDays; day++) {
        const dateStr = `${monthPrefix}-${String(day).padStart(2, '0')}`;
        const isToday = dateStr === todayStr;
        const isSelected = dateStr === selectedCalendarDate;
        const count = appointmentsCountByDay[dateStr] || 0;

        let cellClasses = 'cal-day-btn text-center p-1.5 rounded-3 cursor-pointer transition position-relative d-flex flex-column align-items-center justify-content-center';
        let dayStyle = 'min-height: 32px; font-size: 0.8rem; font-weight: 600;';

        if (isSelected) {
            cellClasses += ' bg-primary text-white shadow-2xs fw-bold';
        } else if (isToday) {
            cellClasses += ' bg-primary-subtle text-primary border border-primary fw-bold';
        } else {
            cellClasses += ' text-navy hover-bg-light';
        }

        cellsHtml += `
            <div class="${cellClasses}" style="${dayStyle}" onclick="selectCalendarDate('${dateStr}')" role="button" tabindex="0">
                <span>${day}</span>
                ${count > 0 ? `<span class="badge rounded-pill ${isSelected ? 'bg-white text-primary' : 'bg-primary text-white'}" style="font-size: 0.6rem; padding: 1px 4px; line-height: 1;">${count}</span>` : ''}
            </div>
        `;
    }

    grid.innerHTML = cellsHtml;
}

function selectCalendarDate(dateStr) {
    selectedCalendarDate = dateStr;
    renderCalendarView();
    renderDayAppointments();
}

// ============================================================
// 2. LISTA DE CITAS DEL DÍA
// ============================================================

function renderDayAppointments() {
    const titleEl = document.getElementById('day-appointments-title');
    const countEl = document.getElementById('day-appointments-count');
    const listEl = document.getElementById('day-appointments-list');
    if (!listEl) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const isToday = selectedCalendarDate === todayStr;

    if (titleEl) {
        if (isToday) {
            titleEl.textContent = 'Citas de hoy';
        } else {
            const parts = selectedCalendarDate.split('-');
            titleEl.textContent = `Citas del ${parts[2]}/${parts[1]}/${parts[0]}`;
        }
    }

    const dayApps = clinicAppointments.filter(a => a.date === selectedCalendarDate);
    dayApps.sort((a, b) => (a.time || '').localeCompare(b.time || ''));

    if (countEl) {
        countEl.textContent = `${dayApps.length} cita${dayApps.length === 1 ? '' : 's'}`;
    }

    if (dayApps.length === 0) {
        listEl.innerHTML = `
            <div class="text-center py-4 text-muted small bg-light rounded-3 border">
                <i class="bi bi-calendar-x fs-3 d-block mb-1 text-secondary opacity-50"></i>
                Sin citas agendadas para este día.<br>
                <button type="button" class="btn btn-xs btn-outline-primary mt-2 rounded-pill px-3" onclick="openAppointmentModal(null, '${selectedCalendarDate}')">
                    <i class="bi bi-plus me-0.5"></i> Agendar Turno
                </button>
            </div>
        `;
        return;
    }

    listEl.innerHTML = dayApps.map(a => {
        const name = escapeHtml(a.patient_name || 'Paciente');
        const time = escapeHtml(a.time || '09:00');
        const type = escapeHtml(a.type || 'Evaluación BIA');
        const phone = escapeHtml(a.patient_phone || '');
        const status = a.status || 'confirmed';

        let statusBadge = '<span class="badge bg-success-subtle text-success border border-success-subtle">🟢 Confirmada</span>';
        if (status === 'pending') statusBadge = '<span class="badge bg-warning-subtle text-warning border border-warning-subtle">🟡 Pendiente</span>';
        else if (status === 'attended') statusBadge = '<span class="badge bg-primary-subtle text-primary border border-primary-subtle">🔵 Atendida</span>';
        else if (status === 'cancelled') statusBadge = '<span class="badge bg-danger-subtle text-danger border border-danger-subtle">🔴 Cancelada</span>';

        const cleanPhone = phone.replace(/[^0-9]/g, '');
        const waMsg = encodeURIComponent(`Hola ${name}, le recordamos su cita de ${type} en VitaMetrix programada para las ${time} hrs. ¿Confirma su asistencia?`);
        const waLink = cleanPhone ? `https://wa.me/${cleanPhone}?text=${waMsg}` : null;

        return `
            <div class="appointment-item p-2.5 rounded-3 border bg-white shadow-2xs d-flex align-items-center justify-content-between gap-2">
                <div class="d-flex align-items-center gap-2.5">
                    <div class="bg-light rounded-3 text-center p-1.5 font-monospace fw-bold text-navy text-xs border" style="min-width: 48px;">
                        ${time}
                    </div>
                    <div>
                        <div class="fw-bold text-navy text-xs mb-0.5">${name}</div>
                        <div class="text-muted small d-flex align-items-center gap-1.5" style="font-size: 0.72rem;">
                            <span>${type}</span>
                            ${waLink ? `
                                <span>•</span>
                                <a href="${waLink}" target="_blank" class="text-success text-decoration-none" title="Enviar recordatorio por WhatsApp">
                                    <i class="bi bi-whatsapp"></i>
                                </a>
                            ` : ''}
                        </div>
                    </div>
                </div>
                <div class="d-flex align-items-center gap-1.5">
                    ${statusBadge}
                    <button type="button" class="btn btn-light btn-xs border text-secondary" onclick="openAppointmentModal('${a.id}')" title="Editar o gestionar turno">
                        <i class="bi bi-pencil-fill"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================================
// 3. MODAL DE AGENDAMIENTO & CRUD
// ============================================================

function setupAppointmentModal() {
    const modal = document.getElementById('modal-appointment');
    const closeBtn = document.getElementById('btn-close-appointment-modal');
    const cancelBtn = document.getElementById('btn-cancel-appointment');
    const form = document.getElementById('form-appointment');
    const btnDelete = document.getElementById('btn-delete-appointment');

    const closeModal = () => {
        if (modal) {
            modal.classList.add('hidden', 'd-none');
            modal.style.display = 'none';
        }
        editingAppointmentId = null;
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }

    if (form) {
        form.addEventListener('submit', handleAppointmentFormSubmit);
    }

    if (btnDelete) {
        btnDelete.addEventListener('click', () => {
            if (editingAppointmentId) deleteAppointmentConfirm(editingAppointmentId);
        });
    }

    setupAppointmentPatientAutocomplete();
}

function setupAppointmentPatientAutocomplete() {
    const input = document.getElementById('app-patient-name');
    const hiddenIdp = document.getElementById('app-patient-idp');
    const phoneInput = document.getElementById('app-patient-phone');
    const dropdown = document.getElementById('app-patient-dropdown');

    if (input && dropdown) {
        input.addEventListener('input', () => {
            const query = input.value.trim().toLowerCase();
            if (!query) {
                dropdown.innerHTML = '';
                return;
            }

            const clients = typeof allClientsData !== 'undefined' ? allClientsData : [];
            const matches = clients.filter(c => 
                (c.name || '').toLowerCase().includes(query) ||
                (c.patient_idp || c.idp || '').toLowerCase().includes(query)
            ).slice(0, 5);

            if (matches.length === 0) {
                dropdown.innerHTML = '';
                return;
            }

            dropdown.innerHTML = matches.map(c => `
                <div class="p-2 border-bottom stock-dropdown-item cursor-pointer" onclick="selectAppPatient('${c.name}', '${c.patient_idp || c.idp || ''}', '${c.phone || ''}')">
                    <div class="fw-bold text-navy text-xs">${escapeHtml(c.name)}</div>
                    <div class="text-muted font-monospace" style="font-size: 0.72rem;">${escapeHtml(c.patient_idp || c.idp || '')} • ${escapeHtml(c.phone || 'Sin teléfono')}</div>
                </div>
            `).join('');
        });

        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target) && e.target !== input) {
                dropdown.innerHTML = '';
            }
        });
    }
}

function selectAppPatient(name, idp, phone) {
    const nameInput = document.getElementById('app-patient-name');
    const hiddenIdp = document.getElementById('app-patient-idp');
    const phoneInput = document.getElementById('app-patient-phone');
    const dropdown = document.getElementById('app-patient-dropdown');

    if (nameInput) nameInput.value = name;
    if (hiddenIdp) hiddenIdp.value = idp;
    if (phoneInput && phone) phoneInput.value = phone;
    if (dropdown) dropdown.innerHTML = '';
}

function openAppointmentModal(appId = null, prefillDate = null) {
    const modal = document.getElementById('modal-appointment');
    const form = document.getElementById('form-appointment');
    const titleEl = document.getElementById('appointment-modal-title');
    const btnSaveText = document.getElementById('btn-save-app-text');
    const btnDelete = document.getElementById('btn-delete-appointment');

    if (!modal || !form) return;

    form.reset();
    editingAppointmentId = appId;

    if (appId) {
        const app = clinicAppointments.find(a => String(a.id) === String(appId));
        if (!app) return;

        if (titleEl) titleEl.textContent = 'Editar Cita Médica';
        if (btnSaveText) btnSaveText.textContent = 'Actualizar Cita';
        if (btnDelete) btnDelete.classList.remove('d-none');

        document.getElementById('app-id').value = app.id;
        document.getElementById('app-patient-name').value = app.patient_name || '';
        document.getElementById('app-patient-idp').value = app.patient_idp || '';
        document.getElementById('app-patient-phone').value = app.patient_phone || '';
        document.getElementById('app-date').value = app.date || '';
        document.getElementById('app-time').value = app.time || '09:00';
        document.getElementById('app-type').value = app.type || 'Evaluación Inicial BIA';
        document.getElementById('app-status').value = app.status || 'confirmed';
        document.getElementById('app-notes').value = app.notes || '';
    } else {
        if (titleEl) titleEl.textContent = 'Agendar Cita Médica';
        if (btnSaveText) btnSaveText.textContent = 'Guardar Cita';
        if (btnDelete) btnDelete.classList.add('d-none');

        document.getElementById('app-id').value = '';
        document.getElementById('app-date').value = prefillDate || selectedCalendarDate || new Date().toISOString().split('T')[0];
        document.getElementById('app-time').value = '09:00';
        document.getElementById('app-status').value = 'confirmed';
    }

    modal.classList.remove('hidden', 'd-none');
    modal.style.display = 'flex';
}

async function handleAppointmentFormSubmit(e) {
    e.preventDefault();

    const btn = document.getElementById('btn-save-appointment');
    const patientName = document.getElementById('app-patient-name')?.value.trim();
    const patientPhone = document.getElementById('app-patient-phone')?.value.trim();
    const patientIdp = document.getElementById('app-patient-idp')?.value.trim();
    const date = document.getElementById('app-date')?.value;
    const time = document.getElementById('app-time')?.value;
    const type = document.getElementById('app-type')?.value;
    const status = document.getElementById('app-status')?.value;
    const notes = document.getElementById('app-notes')?.value.trim();

    if (!patientName || !date || !time) {
        showToast('Paciente, fecha y hora son obligatorios', 'warning');
        return;
    }

    const payload = {
        patient_name: patientName,
        patient_phone: patientPhone,
        patient_idp: patientIdp,
        date: date,
        time: time,
        type: type,
        status: status,
        notes: notes
    };

    if (btn) btn.disabled = true;

    try {
        const url = editingAppointmentId ? `/api/appointments/${editingAppointmentId}` : '/api/appointments';
        const method = editingAppointmentId ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
            throw new Error(data.error || 'Error al guardar cita');
        }

        showToast(editingAppointmentId ? '✅ Cita médica actualizada' : '🎉 Cita agendada exitosamente', 'success');

        // Cerrar modal
        const modal = document.getElementById('modal-appointment');
        if (modal) {
            modal.classList.add('hidden', 'd-none');
            modal.style.display = 'none';
        }
        editingAppointmentId = null;

        selectedCalendarDate = date;
        await fetchAppointments();

    } catch (err) {
        console.error('Error al guardar cita:', err);
        showToast(err.message || 'Error de conexión', 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

function deleteAppointmentConfirm(appId) {
    showConfirm(
        'Eliminar Cita',
        '¿Deseas cancelar y eliminar esta cita médica de la agenda?',
        async () => {
            try {
                const res = await fetch(`/api/appointments/${appId}`, {
                    method: 'DELETE',
                    headers: getAuthHeaders()
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    showToast('Cita médica eliminada', 'info');
                    const modal = document.getElementById('modal-appointment');
                    if (modal) {
                        modal.classList.add('hidden', 'd-none');
                        modal.style.display = 'none';
                    }
                    editingAppointmentId = null;
                    await fetchAppointments();
                } else {
                    showToast(data.error || 'No se pudo eliminar la cita', 'error');
                }
            } catch (e) {
                showToast('Error de conexión al eliminar cita', 'error');
            }
        }
    );
}

// Exportación global
window.initAppointmentsCalendar = initAppointmentsCalendar;
window.fetchAppointments = fetchAppointments;
window.selectCalendarDate = selectCalendarDate;
window.openAppointmentModal = openAppointmentModal;
window.selectAppPatient = selectAppPatient;
