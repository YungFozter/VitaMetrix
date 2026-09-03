// ============================================================
// VITAMETRIX - MÓDULO 06: PACIENTES / CLIENTES Y MENSAJERÍA
// Archivo: frontend/static/js/modules/pacientes.js
// ============================================================

let allClientsData = [];
let clientsDataLoaded = false;
let editingClientId = null;

function initClients() {
    const form = document.getElementById('client-form');
    const searchInput = document.getElementById('clients-search-input');
    const btnCancel = document.getElementById('btn-cancel-client');

    if (form) {
        form.addEventListener('submit', handleClientFormSubmit);
    }

    if (btnCancel) {
        btnCancel.addEventListener('click', cancelClientEditMode);
    }

    if (searchInput) {
        searchInput.addEventListener('input', () => filterAndRenderClients());
    }

    fetchClients();
}

async function fetchClients(force = false) {
    if (clientsDataLoaded && !force) return;

    try {
        const res = await fetch('/api/clients', { headers: getAuthHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        allClientsData = Array.isArray(data) ? data : (data.clients || []);
        clientsDataLoaded = true;

        filterAndRenderClients();
        updateClientFormNextIDP();

        if (typeof window.updateBioDatalists === 'function') {
            window.updateBioDatalists();
        }
    } catch (e) {
        console.warn('Error al cargar directorio de pacientes:', e);
    }
}

function updateClientFormNextIDP() {
    const idpInput = document.getElementById('new-client-idp');
    if (!idpInput || editingClientId) return;

    if (typeof window.getNextAvailableIDP === 'function') {
        idpInput.value = window.getNextAvailableIDP();
    } else {
        const nextNum = (allClientsData ? allClientsData.length : 0) + 1;
        idpInput.value = `IDP-${String(nextNum).padStart(4, '0')}`;
    }
}

function filterAndRenderClients() {
    const tbody = document.getElementById('clients-tbody');
    const countEl = document.getElementById('clients-total-count');
    if (!tbody) return;

    const search = (document.getElementById('clients-search-input')?.value || '').toLowerCase().trim();

    let filtered = [...allClientsData];

    if (search) {
        filtered = filtered.filter(c => 
            (c.name || '').toLowerCase().includes(search) ||
            (c.patient_idp || c.idp || '').toLowerCase().includes(search) ||
            (c.phone || '').toLowerCase().includes(search) ||
            (c.email || '').toLowerCase().includes(search)
        );
    }

    if (countEl) countEl.textContent = filtered.length;
    renderClientsTable(filtered);
}

function renderClientsTable(clients) {
    const tbody = document.getElementById('clients-tbody');
    if (!tbody) return;

    if (clients.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-5 text-muted">
                    <i class="bi bi-people fs-2 d-block mb-2 text-secondary opacity-50"></i>
                    No se encontraron pacientes registrados en el directorio.<br>
                    <small>Completa el formulario superior para registrar el primer paciente.</small>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = clients.map(c => {
        const idp = escapeHtml(c.patient_idp || c.idp || ('IDP-' + String(c.code || 1).padStart(4, '0')));
        const name = escapeHtml(c.name || 'Paciente');
        const phone = escapeHtml(c.phone || '');
        const email = escapeHtml(c.email || '');
        const age = c.age ? `${c.age} años` : '--';
        const gender = (c.gender === 'Femenino' || c.gender === 'female') ? 'Femenino' : 'Masculino';
        const height = c.height ? `${c.height} cm` : '--';

        const cleanPhone = phone.replace(/[^0-9+]/g, '');
        const waLink = cleanPhone ? `https://wa.me/${cleanPhone.replace('+', '')}?text=${encodeURIComponent(`Hola ${c.name}, le saludamos de su consultorio de nutrición VitaMetrix.`)}` : null;

        return `
            <tr>
                <td class="ps-3 py-3">
                    <span class="fw-bold text-primary font-monospace fs-6">${idp}</span>
                    <div class="text-muted text-xs">Registro Clínico</div>
                </td>
                <td>
                    <div class="fw-bold text-navy fs-6">${name}</div>
                    <div class="text-muted text-xs d-flex gap-2">
                        <span>🎂 ${age}</span>
                        <span>•</span>
                        <span>⚧ ${gender}</span>
                        <span>•</span>
                        <span>📏 ${height}</span>
                    </div>
                </td>
                <td>
                    ${phone ? `
                        <div class="d-flex align-items-center gap-1.5 font-monospace text-xs mb-0.5">
                            <i class="bi bi-telephone-fill text-muted"></i>
                            <span>${phone}</span>
                            ${waLink ? `
                                <a href="${waLink}" target="_blank" class="btn btn-xs btn-outline-success border-0 p-0 ps-1" title="Chatear por WhatsApp">
                                    <i class="bi bi-whatsapp"></i>
                                </a>
                            ` : ''}
                        </div>
                    ` : '<div class="text-muted text-xs">Sin teléfono</div>'}
                    ${email ? `<div class="text-muted text-xs text-truncate" style="max-width: 180px;"><i class="bi bi-envelope me-1"></i>${email}</div>` : ''}
                </td>
                <td>
                    <button type="button" class="btn btn-light btn-xs border text-navy fw-semibold px-2.5 py-1 rounded-2"
                        onclick="loadPatientToBioForm('${c.id}')" title="Crear nueva evaluación para este paciente">
                        <i class="bi bi-lightning-charge-fill text-warning me-1"></i> Nueva Evaluación
                    </button>
                </td>
                <td class="text-end pe-3">
                    <button type="button" class="btn btn-light btn-xs border text-secondary me-1" onclick="startEditClient('${c.id}')" title="Editar datos del paciente">
                        <i class="bi bi-pencil-fill"></i>
                    </button>
                    <button type="button" class="btn btn-light btn-xs border text-danger" onclick="deleteClientConfirm('${c.id}', '${name}')" title="Eliminar paciente">
                        <i class="bi bi-trash-fill"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

async function handleClientFormSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save-client');
    const btnText = document.getElementById('btn-save-client-text');
    const nameInput = document.getElementById('new-client-name');
    const ageInput = document.getElementById('new-client-age');
    const genderSelect = document.getElementById('new-client-gender');
    const heightInput = document.getElementById('new-client-height');
    const phoneInput = document.getElementById('new-client-phone');
    const emailInput = document.getElementById('new-client-email');
    const idpInput = document.getElementById('new-client-idp');

    const name = nameInput ? nameInput.value.trim() : '';
    if (!name) {
        showToast('El nombre del paciente es obligatorio', 'warning');
        if (nameInput) nameInput.focus();
        return;
    }

    const payload = {
        name: name,
        idp: idpInput ? idpInput.value.trim() : '',
        age: ageInput ? parseInt(ageInput.value || 0) : null,
        gender: genderSelect ? genderSelect.value : 'Masculino',
        height: heightInput ? parseFloat(heightInput.value || 0) : null,
        phone: phoneInput ? phoneInput.value.trim() : '',
        email: emailInput ? emailInput.value.trim() : ''
    };

    if (btn) btn.disabled = true;
    if (btnText) btnText.textContent = editingClientId ? 'Actualizando...' : 'Guardando...';

    try {
        const url = editingClientId ? `/api/clients/${editingClientId}` : '/api/clients';
        const method = editingClientId ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
            throw new Error(data.error || 'Error al guardar paciente');
        }

        showToast(editingClientId ? '✅ Paciente actualizado exitosamente' : '🎉 Paciente registrado correctamente', 'success');

        cancelClientEditMode();
        await fetchClients(true);

        // Actualizar estadísticas del dashboard si corresponde
        if (typeof fetchDashboardStats === 'function') fetchDashboardStats(true);

    } catch (err) {
        console.error('Error al guardar paciente:', err);
        showToast(err.message || 'Error al conectar con el servidor', 'error');
    } finally {
        if (btn) btn.disabled = false;
        if (btnText) btnText.textContent = editingClientId ? 'Actualizar Paciente' : 'Guardar Paciente';
    }
}

function startEditClient(clientId) {
    const client = allClientsData.find(c => String(c.id) === String(clientId));
    if (!client) return;

    editingClientId = clientId;

    const titleEl = document.getElementById('client-form-title');
    const badgeEl = document.getElementById('client-editing-badge');
    const btnCancel = document.getElementById('btn-cancel-client');
    const btnSaveText = document.getElementById('btn-save-client-text');

    if (titleEl) titleEl.textContent = 'Editar Ficha de Paciente';
    if (badgeEl) badgeEl.style.display = 'inline-block';
    if (btnCancel) btnCancel.classList.remove('hidden-view');
    if (btnSaveText) btnSaveText.textContent = 'Actualizar Paciente';

    if (document.getElementById('new-client-name')) document.getElementById('new-client-name').value = client.name || '';
    if (document.getElementById('new-client-idp')) document.getElementById('new-client-idp').value = client.patient_idp || client.idp || '';
    if (document.getElementById('new-client-age')) document.getElementById('new-client-age').value = client.age || '';
    if (document.getElementById('new-client-gender')) document.getElementById('new-client-gender').value = (client.gender === 'Femenino' || client.gender === 'female') ? 'Femenino' : 'Masculino';
    if (document.getElementById('new-client-height')) document.getElementById('new-client-height').value = client.height || '';
    if (document.getElementById('new-client-phone')) document.getElementById('new-client-phone').value = client.phone || '+591 ';
    if (document.getElementById('new-client-email')) document.getElementById('new-client-email').value = client.email || '';

    // Scroll suave al formulario
    const formCard = document.getElementById('client-form');
    if (formCard) formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cancelClientEditMode() {
    editingClientId = null;

    const form = document.getElementById('client-form');
    if (form) form.reset();

    const titleEl = document.getElementById('client-form-title');
    const badgeEl = document.getElementById('client-editing-badge');
    const btnCancel = document.getElementById('btn-cancel-client');
    const btnSaveText = document.getElementById('btn-save-client-text');

    if (titleEl) titleEl.textContent = 'Registrar Paciente';
    if (badgeEl) badgeEl.style.display = 'none';
    if (btnCancel) btnCancel.classList.add('hidden-view');
    if (btnSaveText) btnSaveText.textContent = 'Guardar Paciente';

    updateClientFormNextIDP();
}

function deleteClientConfirm(id, name) {
    showConfirm(
        'Eliminar Paciente',
        `¿Estás seguro de que deseas eliminar permanentemente al paciente <strong>${name}</strong>? Se conservarán sus evaluaciones históricas asociadas.`,
        async () => {
            try {
                const res = await fetch(`/api/clients/${id}`, {
                    method: 'DELETE',
                    headers: getAuthHeaders()
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    showToast('Paciente eliminado del directorio', 'info');
                    await fetchClients(true);
                    if (typeof fetchDashboardStats === 'function') fetchDashboardStats(true);
                } else {
                    showToast(data.error || 'No se pudo eliminar el paciente', 'error');
                }
            } catch (e) {
                showToast('Error de red al intentar eliminar paciente', 'error');
            }
        }
    );
}

function loadPatientToBioForm(clientId) {
    const client = allClientsData.find(c => String(c.id) === String(clientId));
    if (!client) return;

    const bioNav = document.querySelector('[data-target="bio-view"]');
    if (bioNav) bioNav.click();

    if (typeof fillBioFormFromClient === 'function') {
        fillBioFormFromClient(client);
    } else {
        const idp = client.patient_idp || client.idp || ('IDP-' + String(client.code || 1).padStart(4, '0'));
        if (document.getElementById('input-idp')) document.getElementById('input-idp').value = idp;
        if (document.getElementById('input-name')) document.getElementById('input-name').value = client.name || '';
        if (document.getElementById('input-age')) document.getElementById('input-age').value = client.age || '';
        if (document.getElementById('input-height')) document.getElementById('input-height').value = client.height || '';
        if (document.getElementById('input-gender')) {
            document.getElementById('input-gender').value = (client.gender === 'Femenino' || client.gender === 'female') ? 'female' : 'male';
        }
    }
    showToast(`⚡ Ficha de ${client.name} cargada para análisis BIA`, 'info');
}

// Exportación global
window.allClientsData = allClientsData;
window.fetchClients = fetchClients;
window.initClients = initClients;
window.startEditClient = startEditClient;
window.deleteClientConfirm = deleteClientConfirm;
window.loadPatientToBioForm = loadPatientToBioForm;
