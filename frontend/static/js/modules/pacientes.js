// ============================================================
// VITAMETRIX - MÓDULO 06: PACIENTES / CLIENTES Y MENSAJERÍA
// Archivo: frontend/static/js/modules/pacientes.js
// ============================================================

let allClientsData = [];
let currentPatientForHistory = null;

function initClients() {
    const btnNew = document.getElementById('btn-new-client');
    const searchInput = document.getElementById('search-clients');
    const filterGender = document.getElementById('filter-gender');

    if (btnNew) {
        btnNew.addEventListener('click', () => openCreateClientModal());
    }

    if (searchInput) searchInput.addEventListener('input', () => filterAndRenderClients());
    if (filterGender) filterGender.addEventListener('change', () => filterAndRenderClients());

    fetchClients();
}

async function fetchClients() {
    try {
        const res = await fetch('/api/clients', { headers: getAuthHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        allClientsData = Array.isArray(data) ? data : (data.clients || []);
        clientsDataLoaded = true;
        filterAndRenderClients();
        if (typeof window.updateBioDatalists === 'function') window.updateBioDatalists();
    } catch (e) {
        console.warn('Error al cargar directorio de pacientes:', e);
    }
}

function filterAndRenderClients() {
    const tbody = document.getElementById('tbody-clients');
    if (!tbody) return;

    const search = (document.getElementById('search-clients')?.value || '').toLowerCase().trim();
    const gender = document.getElementById('filter-gender')?.value || '';

    let filtered = [...allClientsData];

    if (search) {
        filtered = filtered.filter(c => 
            (c.name || '').toLowerCase().includes(search) ||
            (c.idp || '').toLowerCase().includes(search) ||
            (c.phone || '').toLowerCase().includes(search) ||
            (c.email || '').toLowerCase().includes(search)
        );
    }

    if (gender) {
        filtered = filtered.filter(c => {
            const g = (c.gender || '').toLowerCase();
            if (gender === 'male') return g === 'masculino' || g === 'male';
            if (gender === 'female') return g === 'femenino' || g === 'female';
            return true;
        });
    }

    renderClientsTable(filtered);
}

function renderClientsTable(clients) {
    const tbody = document.getElementById('tbody-clients');
    const countEl = document.getElementById('clients-total-count');
    if (!tbody) return;

    if (countEl) countEl.textContent = clients.length;

    if (clients.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-5 text-muted">
                    <i class="bi bi-people fs-2 d-block mb-2 text-secondary opacity-50"></i>
                    No se encontraron pacientes registrados.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = clients.map(c => `
        <tr>
            <td class="ps-3 py-3 fw-bold text-primary font-monospace">${escapeHtml(c.idp || c.code || 'IDP-0001')}</td>
            <td>
                <div class="fw-bold text-navy">${escapeHtml(c.name || 'Paciente')}</div>
                <div class="text-muted text-xs">${escapeHtml(c.email || 'Sin correo')}</div>
            </td>
            <td>${c.age ? `${c.age} años` : '--'}</td>
            <td>${escapeHtml(c.gender || 'Masculino')}</td>
            <td>${escapeHtml(c.phone || 'Sin teléfono')}</td>
            <td>
                <span class="badge bg-success-subtle text-success border border-success border-opacity-25 px-2.5 py-1 rounded-pill fw-bold text-xs">
                    🟢 Activo
                </span>
            </td>
            <td class="text-end pe-3">
                <button type="button" class="btn btn-light btn-xs border text-secondary me-1" onclick="openEditClientModal('${c.id}')" title="Editar Paciente">
                    <i class="bi bi-pencil-fill"></i>
                </button>
                <button type="button" class="btn btn-light btn-xs border text-danger" onclick="deleteClient('${c.id}', '${escapeHtml(c.name)}')" title="Eliminar Paciente">
                    <i class="bi bi-trash-fill"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function openCreateClientModal() {
    showToast('Crear nuevo paciente...', 'info');
}

function openEditClientModal(id) {
    showToast('Editar paciente ' + id, 'info');
}

function deleteClient(id, name) {
    showConfirm(
        'Eliminar Paciente',
        `¿Deseas eliminar permanentemente a <strong>${name}</strong> del directorio?`,
        async () => {
            try {
                const res = await fetch(`/api/clients/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
                if (res.ok) {
                    showToast('Paciente eliminado.', 'info');
                    fetchClients();
                }
            } catch (e) {}
        }
    );
}

function initPatientMessaging() {}
