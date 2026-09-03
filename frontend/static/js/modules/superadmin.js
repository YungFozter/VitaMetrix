// ============================================================
// VITAMETRIX - MÓDULO 03: GESTIÓN CENTRAL SUPERADMIN (USUARIOS, PINS Y LICENCIAS)
// Archivo: frontend/static/js/modules/superadmin.js
// ============================================================

let allAdminUsersData = [];
let allAdminPinsData = [];
let selectedAdminUserIds = new Set();
let currentAdminTab = 'users';

function switchAdminTab(tabName) {
    currentAdminTab = tabName;
    try {
        localStorage.setItem('vm_admin_active_tab', tabName);
    } catch (e) {}

    const btnUsers = document.getElementById('tab-btn-admin-users');
    const btnPins = document.getElementById('tab-btn-admin-pins');
    const paneUsers = document.getElementById('admin-tab-pane-users');
    const panePins = document.getElementById('admin-tab-pane-pins');

    if (tabName === 'pins') {
        if (btnUsers) {
            btnUsers.classList.remove('active', 'btn-primary');
            btnUsers.classList.add('text-secondary');
        }
        if (btnPins) {
            btnPins.classList.add('active', 'btn-warning', 'text-dark');
            btnPins.classList.remove('text-secondary');
        }
        if (paneUsers) paneUsers.classList.add('d-none');
        if (panePins) panePins.classList.remove('d-none');
        fetchAdminPins();
    } else {
        if (btnUsers) {
            btnUsers.classList.add('active', 'btn-primary');
            btnUsers.classList.remove('text-secondary');
        }
        if (btnPins) {
            btnPins.classList.remove('active', 'btn-warning', 'text-dark');
            btnPins.classList.add('text-secondary');
        }
        if (paneUsers) paneUsers.classList.remove('d-none');
        if (panePins) panePins.classList.add('d-none');
        fetchAdminUsers();
    }
}

function initSuperAdminView() {
    const refreshBtn = document.getElementById('btn-admin-refresh-users');
    const searchInput = document.getElementById('admin-user-search');
    const filterStatus = document.getElementById('admin-user-filter-status');
    const sortSelect = document.getElementById('admin-user-sort');

    const openCreateBtn = document.getElementById('btn-admin-open-create-user');
    const closeCreateBtn = document.getElementById('btn-close-admin-create-user');
    const cancelCreateBtn = document.getElementById('btn-cancel-admin-create-user');
    const modalCreate = document.getElementById('modal-admin-create-user');
    const formCreate = document.getElementById('form-admin-create-user');
    const createError = document.getElementById('admin-create-error');

    const closeManageBtn = document.getElementById('btn-close-admin-manage-user');
    const cancelManageBtn = document.getElementById('btn-cancel-admin-manage-user');
    const modalManage = document.getElementById('modal-admin-manage-user');
    const formManage = document.getElementById('form-admin-manage-user');
    const manageError = document.getElementById('admin-manage-error');

    const openCreatePinBtn = document.getElementById('btn-admin-open-create-pin');
    const closeCreatePinBtn = document.getElementById('btn-close-admin-create-pin');
    const cancelCreatePinBtn = document.getElementById('btn-cancel-admin-create-pin');
    const modalCreatePin = document.getElementById('modal-admin-create-pin');
    const formCreatePin = document.getElementById('form-admin-create-pin');
    const pinError = document.getElementById('admin-pin-error');
    const pinsSearchInput = document.getElementById('admin-pins-search');
    const pinsFilterStatus = document.getElementById('admin-pins-filter-status');

    const selectAllCheckbox = document.getElementById('admin-select-all-users');
    const clearSelectionBtn = document.getElementById('btn-admin-clear-selection');
    const deleteSelectedBtn = document.getElementById('btn-admin-delete-selected');

    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            if (currentAdminTab === 'pins') {
                fetchAdminPins(true);
            } else {
                fetchAdminUsers(true);
            }
        });
    }
    if (searchInput) searchInput.addEventListener('input', () => renderAdminUsers());
    if (filterStatus) filterStatus.addEventListener('change', () => renderAdminUsers());
    if (sortSelect) sortSelect.addEventListener('change', () => renderAdminUsers());

    if (pinsSearchInput) pinsSearchInput.addEventListener('input', () => renderAdminPins());
    if (pinsFilterStatus) pinsFilterStatus.addEventListener('change', () => renderAdminPins());

    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', () => {
            const isChecked = selectAllCheckbox.checked;
            const checkboxes = document.querySelectorAll('.admin-user-checkbox:not(:disabled)');
            checkboxes.forEach(cb => {
                cb.checked = isChecked;
                const row = cb.closest('tr');
                if (isChecked) {
                    selectedAdminUserIds.add(cb.value);
                    if (row) row.classList.add('table-active');
                } else {
                    selectedAdminUserIds.delete(cb.value);
                    if (row) row.classList.remove('table-active');
                }
            });
            updateAdminBulkActionBar();
        });
    }

    if (clearSelectionBtn) {
        clearSelectionBtn.addEventListener('click', () => {
            selectedAdminUserIds.clear();
            const selectAll = document.getElementById('admin-select-all-users');
            if (selectAll) {
                selectAll.checked = false;
                selectAll.indeterminate = false;
            }
            document.querySelectorAll('.admin-user-checkbox').forEach(cb => {
                cb.checked = false;
                const row = cb.closest('tr');
                if (row) row.classList.remove('table-active');
            });
            updateAdminBulkActionBar();
        });
    }

    if (deleteSelectedBtn) {
        deleteSelectedBtn.addEventListener('click', () => {
            const count = selectedAdminUserIds.size;
            if (count === 0) return;

            showConfirm(
                'Eliminar Usuarios de la Base de Datos',
                `¿Estás seguro de eliminar permanentemente los <strong>${count} usuario(s) seleccionado(s)</strong> del sistema y la base de datos?<br><span class="text-danger small">Esta acción no se puede deshacer.</span>`,
                async () => {
                    try {
                        const res = await fetch('/api/admin/users/batch-delete', {
                            method: 'POST',
                            headers: getAuthHeaders(),
                            body: JSON.stringify({ user_ids: Array.from(selectedAdminUserIds) })
                        });
                        const data = await res.json();
                        if (!res.ok || !data.success) {
                            showToast(data.error || 'Error al eliminar los usuarios seleccionados', 'error');
                            return;
                        }

                        showToast(`🗑️ ${data.message}`, 'info');
                        selectedAdminUserIds.clear();
                        updateAdminBulkActionBar();
                        fetchAdminUsers(false);
                    } catch (e) {
                        showToast('Error de conexión al eliminar usuarios', 'error');
                    }
                },
                { confirmText: `Eliminar (${count})`, type: 'danger', icon: 'bi bi-trash-fill' }
            );
        });
    }

    if (openCreateBtn && modalCreate) {
        openCreateBtn.addEventListener('click', () => {
            if (formCreate) formCreate.reset();
            if (createError) createError.classList.add('d-none');
            modalCreate.classList.remove('hidden', 'd-none');
            modalCreate.style.display = 'flex';
        });
    }
    if (closeCreateBtn && modalCreate) {
        closeCreateBtn.addEventListener('click', () => {
            modalCreate.classList.add('hidden', 'd-none');
            modalCreate.style.display = 'none';
        });
    }
    if (cancelCreateBtn && modalCreate) {
        cancelCreateBtn.addEventListener('click', () => {
            modalCreate.classList.add('hidden', 'd-none');
            modalCreate.style.display = 'none';
        });
    }

    if (formCreate) {
        formCreate.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnSubmit = document.getElementById('btn-submit-admin-create-user');
            const fullName = document.getElementById('admin-new-name').value.trim();
            const email = document.getElementById('admin-new-email').value.trim();
            const password = document.getElementById('admin-new-password').value;
            const title = document.getElementById('admin-new-title').value.trim();
            const clinic = document.getElementById('admin-new-clinic').value.trim();
            const phone = document.getElementById('admin-new-phone').value.trim();
            const role = document.getElementById('admin-new-role').value;
            const plan = document.getElementById('admin-new-plan').value;
            const duration = parseInt(document.getElementById('admin-new-duration').value || 30);

            if (createError) createError.classList.add('d-none');
            if (btnSubmit) btnSubmit.disabled = true;

            try {
                const res = await fetch('/api/admin/users/create', {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        full_name: fullName,
                        email: email,
                        password: password,
                        professional_title: title,
                        clinic_name: clinic,
                        phone: phone,
                        role: role,
                        subscription_plan: plan,
                        duration_days: duration
                    })
                });
                const data = await res.json();

                if (!res.ok || !data.success) {
                    if (createError) {
                        createError.textContent = data.error || 'Error al crear el usuario';
                        createError.classList.remove('d-none');
                    }
                    return;
                }

                showToast(`🎉 ${data.message}`, 'success');
                modalCreate.classList.add('hidden', 'd-none');
                modalCreate.style.display = 'none';
                fetchAdminUsers(false);
            } catch (err) {
                if (createError) {
                    createError.textContent = 'Error de conexión con el servidor.';
                    createError.classList.remove('d-none');
                }
            } finally {
                if (btnSubmit) btnSubmit.disabled = false;
            }
        });
    }

    if (closeManageBtn && modalManage) {
        closeManageBtn.addEventListener('click', () => {
            modalManage.classList.add('hidden', 'd-none');
            modalManage.style.display = 'none';
        });
    }
    if (cancelManageBtn && modalManage) {
        cancelManageBtn.addEventListener('click', () => {
            modalManage.classList.add('hidden', 'd-none');
            modalManage.style.display = 'none';
        });
    }

    if (formManage) {
        formManage.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnSubmit = document.getElementById('btn-submit-admin-manage-user');
            const userId = document.getElementById('admin-manage-user-id').value;
            const status = document.getElementById('admin-manage-status-select').value;
            const role = document.getElementById('admin-manage-role-select').value;
            const planName = document.getElementById('admin-manage-plan-name').value.trim();

            if (!userId) return;
            if (manageError) manageError.classList.add('d-none');
            if (btnSubmit) btnSubmit.disabled = true;

            try {
                const res = await fetch(`/api/admin/users/${userId}/status`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        status: status,
                        role: role,
                        plan_name: planName
                    })
                });
                const data = await res.json();

                if (!res.ok || !data.success) {
                    if (manageError) {
                        manageError.textContent = data.error || 'Error al actualizar usuario';
                        manageError.classList.remove('d-none');
                    }
                    return;
                }

                showToast('✅ Cambios de usuario guardados correctamente.', 'success');
                modalManage.classList.add('hidden', 'd-none');
                modalManage.style.display = 'none';
                fetchAdminUsers(false);
            } catch (err) {
                if (manageError) {
                    manageError.textContent = 'Error de conexión con el servidor.';
                    manageError.classList.remove('d-none');
                }
            } finally {
                if (btnSubmit) btnSubmit.disabled = false;
            }
        });
    }

    if (openCreatePinBtn && modalCreatePin) {
        openCreatePinBtn.addEventListener('click', () => {
            if (formCreatePin) formCreatePin.reset();
            if (pinError) pinError.classList.add('d-none');
            modalCreatePin.classList.remove('hidden', 'd-none');
            modalCreatePin.style.display = 'flex';
        });
    }
    if (closeCreatePinBtn && modalCreatePin) {
        closeCreatePinBtn.addEventListener('click', () => {
            modalCreatePin.classList.add('hidden', 'd-none');
            modalCreatePin.style.display = 'none';
        });
    }
    if (cancelCreatePinBtn && modalCreatePin) {
        cancelCreatePinBtn.addEventListener('click', () => {
            modalCreatePin.classList.add('hidden', 'd-none');
            modalCreatePin.style.display = 'none';
        });
    }

    if (formCreatePin) {
        formCreatePin.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnSubmit = document.getElementById('btn-submit-admin-create-pin');
            const durationDays = parseInt(document.getElementById('admin-pin-duration').value || 30);
            const count = parseInt(document.getElementById('admin-pin-count').value || 1);
            const customPin = document.getElementById('admin-pin-custom').value.trim();
            const note = document.getElementById('admin-pin-note').value.trim();

            if (pinError) pinError.classList.add('d-none');
            if (btnSubmit) btnSubmit.disabled = true;

            try {
                const res = await fetch('/api/admin/pins/create', {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        duration_days: durationDays,
                        count: count,
                        custom_pin: customPin,
                        note: note
                    })
                });
                const data = await res.json();

                if (!res.ok || !data.success) {
                    if (pinError) {
                        pinError.textContent = data.error || 'Error al generar el PIN';
                        pinError.classList.remove('d-none');
                    }
                    return;
                }

                showToast(`🔑 ${data.message}`, 'success');
                modalCreatePin.classList.add('hidden', 'd-none');
                modalCreatePin.style.display = 'none';

                if (Array.isArray(data.created_pins) && data.created_pins.length > 0) {
                    const existingKeys = new Set(allAdminPinsData.map(p => p.license_key));
                    const newUnique = data.created_pins.filter(p => !existingKeys.has(p.license_key));
                    allAdminPinsData = [...newUnique, ...allAdminPinsData];
                    try {
                        localStorage.setItem('vm_admin_pins_cache', JSON.stringify(allAdminPinsData));
                    } catch (e) {}
                    renderAdminPins();
                }

                fetchAdminPins(false);
            } catch (err) {
                if (pinError) {
                    pinError.textContent = 'Error de conexión con el servidor.';
                    pinError.classList.remove('d-none');
                }
            } finally {
                if (btnSubmit) btnSubmit.disabled = false;
            }
        });
    }

    // Modal de Reseteo de Contraseña
    const closeResetPassBtn = document.getElementById('btn-close-admin-reset-pass');
    const cancelResetPassBtn = document.getElementById('btn-cancel-admin-reset-pass');
    const formResetPass = document.getElementById('form-admin-reset-password');
    const resetPassError = document.getElementById('admin-reset-pass-error');

    if (closeResetPassBtn) closeResetPassBtn.addEventListener('click', closeAdminResetPasswordModal);
    if (cancelResetPassBtn) cancelResetPassBtn.addEventListener('click', closeAdminResetPasswordModal);

    if (formResetPass) {
        formResetPass.addEventListener('submit', async (e) => {
            e.preventDefault();
            const userId = document.getElementById('admin-reset-user-id')?.value;
            const newPassword = document.getElementById('admin-reset-new-pass')?.value?.trim();
            const btnSubmit = document.getElementById('btn-submit-admin-reset-pass');

            if (!userId || !newPassword || newPassword.length < 6) {
                if (resetPassError) {
                    resetPassError.textContent = 'La nueva contraseña debe tener un mínimo de 6 caracteres.';
                    resetPassError.classList.remove('d-none');
                }
                return;
            }

            if (resetPassError) resetPassError.classList.add('d-none');
            if (btnSubmit) btnSubmit.disabled = true;

            try {
                const res = await fetch(`/api/admin/users/${userId}/reset-password`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeaders()
                    },
                    body: JSON.stringify({ password: newPassword })
                });
                const data = await res.json();

                if (!res.ok || !data.success) {
                    if (resetPassError) {
                        resetPassError.textContent = data.error || 'Error al actualizar contraseña.';
                        resetPassError.classList.remove('d-none');
                    }
                    return;
                }

                closeAdminResetPasswordModal();
                showToast(data.message || 'Contraseña actualizada con éxito.', 'success');
            } catch (err) {
                if (resetPassError) {
                    resetPassError.textContent = 'Error de conexión con el servidor.';
                    resetPassError.classList.remove('d-none');
                }
            } finally {
                if (btnSubmit) btnSubmit.disabled = false;
            }
        });
    }

    const savedAdminTab = localStorage.getItem('vm_admin_active_tab');
    if (savedAdminTab === 'pins') {
        switchAdminTab('pins');
    }
}

function updateAdminBulkActionBar() {
    const bar = document.getElementById('admin-bulk-actions-bar');
    const textEl = document.getElementById('admin-selected-count-text');
    const deleteBtn = document.getElementById('btn-admin-delete-selected');
    const selectAllCheckbox = document.getElementById('admin-select-all-users');

    const count = selectedAdminUserIds.size;
    if (bar) {
        if (count > 0) {
            bar.classList.remove('d-none');
        } else {
            bar.classList.add('d-none');
        }
    }

    if (textEl) {
        textEl.textContent = `${count} usuario${count === 1 ? '' : 's'} seleccionado${count === 1 ? '' : 's'}`;
    }

    if (deleteBtn) {
        deleteBtn.innerHTML = `<i class="bi bi-trash-fill me-1"></i> Eliminar Seleccionados (${count})`;
    }

    const checkboxes = document.querySelectorAll('.admin-user-checkbox:not(:disabled)');
    if (selectAllCheckbox && checkboxes.length > 0) {
        const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
        if (checkedCount === 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        } else if (checkedCount === checkboxes.length) {
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
        } else {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = true;
        }
    }
}

async function fetchAdminUsers(showToastFeedback = false) {
    const tbody = document.getElementById('tbody-admin-users');
    if (!tbody) return;

    if (showToastFeedback) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center py-5 text-muted">
                    <div class="spinner-border text-primary spinner-border-sm me-2" role="status"></div>
                    Actualizando lista de usuarios...
                </td>
            </tr>
        `;
    }

    try {
        const res = await fetch('/api/admin/users', { headers: getAuthHeaders() });
        if (!res.ok) {
            if (res.status === 403) {
                showToast('Acceso denegado: se requieren permisos de SuperAdmin', 'error');
            }
            return;
        }

        const data = await res.json();
        if (!data.success) return;

        allAdminUsersData = data.users || [];

        const stats = data.stats || {};
        const kpiTotal = document.getElementById('kpi-admin-total-users');
        const kpiActive = document.getElementById('kpi-admin-active-users');
        const kpiTrial = document.getElementById('kpi-admin-trial-users');
        const kpiExpired = document.getElementById('kpi-admin-expired-users');

        if (kpiTotal) kpiTotal.textContent = stats.total_users || allAdminUsersData.length;
        if (kpiActive) kpiActive.textContent = stats.active_users || 0;
        if (kpiTrial) kpiTrial.textContent = stats.trial_users || 0;
        if (kpiExpired) kpiExpired.textContent = stats.expired_users || 0;

        renderAdminUsers();

        if (showToastFeedback) {
            showToast('Usuarios actualizados correctamente.', 'success');
        }
    } catch (e) {
        console.error('Error al obtener usuarios de SuperAdmin:', e);
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center py-4 text-danger">
                        <i class="bi bi-exclamation-triangle-fill me-1"></i> Error de conexión al cargar usuarios.
                    </td>
                </tr>
            `;
        }
    }
}

function renderAdminUsers() {
    const tbody = document.getElementById('tbody-admin-users');
    const searchInput = document.getElementById('admin-user-search');
    const filterStatus = document.getElementById('admin-user-filter-status');
    const sortSelect = document.getElementById('admin-user-sort');
    const showingCount = document.getElementById('admin-showing-count');
    const totalCount = document.getElementById('admin-total-count');

    if (!tbody) return;

    let filtered = [...allAdminUsersData];
    if (totalCount) totalCount.textContent = allAdminUsersData.length;

    const query = (searchInput ? searchInput.value : '').toLowerCase().trim();
    if (query) {
        filtered = filtered.filter(u => 
            (u.full_name || '').toLowerCase().includes(query) ||
            (u.email || '').toLowerCase().includes(query) ||
            (u.clinic_name || '').toLowerCase().includes(query) ||
            (u.professional_title || '').toLowerCase().includes(query) ||
            (u.phone || '').includes(query)
        );
    }

    const statusVal = filterStatus ? filterStatus.value : 'all';
    if (statusVal !== 'all') {
        if (statusVal === 'active') {
            filtered = filtered.filter(u => u.subscription_status === 'active' || u.subscription_status === 'lifetime');
        } else if (statusVal === 'trial') {
            filtered = filtered.filter(u => u.subscription_status === 'trial');
        } else if (statusVal === 'expired') {
            filtered = filtered.filter(u => u.subscription_status === 'expired');
        } else if (statusVal === 'admin') {
            filtered = filtered.filter(u => u.role === 'admin');
        }
    }

    const sortVal = sortSelect ? sortSelect.value : 'newest';
    if (sortVal === 'name_asc') {
        filtered.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
    } else if (sortVal === 'days_asc') {
        filtered.sort((a, b) => (a.days_left || 0) - (b.days_left || 0));
    } else {
        filtered.sort((a, b) => {
            if (a.role === 'admin' && b.role !== 'admin') return -1;
            if (b.role === 'admin' && a.role !== 'admin') return 1;
            return (b.created_at || '').localeCompare(a.created_at || '');
        });
    }

    if (showingCount) showingCount.textContent = filtered.length;

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center py-5 text-muted">
                    <i class="bi bi-people fs-2 d-block mb-2 text-secondary opacity-50"></i>
                    No se encontraron usuarios con los filtros seleccionados.
                </td>
            </tr>
        `;
        updateAdminBulkActionBar();
        return;
    }

    tbody.innerHTML = filtered.map(u => {
        const isAdmin = u.role === 'admin';
        const isLifetime = u.subscription_status === 'lifetime';
        const isNeverSubscribed = u.subscription_status === 'no_subscription' || (!u.subscription_expires_at && !isAdmin && !isLifetime);
        const isActive = u.subscription_status === 'active' && !isNeverSubscribed;
        const isTrial = u.subscription_status === 'trial' && !isNeverSubscribed;
        const isExpired = (u.subscription_status === 'expired' || (u.days_left || 0) <= 0) && !isNeverSubscribed;

        let badgeClass = 'bg-secondary text-white';
        let badgeLabel = '⚪ Sin Suscripción';
        let progressClass = 'bg-secondary';

        if (isAdmin || isLifetime) {
            badgeClass = 'bg-purple text-white';
            badgeLabel = isAdmin ? '👑 SuperAdmin' : '⭐ Lifetime';
            progressClass = 'bg-purple';
        } else if (isNeverSubscribed) {
            badgeClass = 'bg-secondary text-white';
            badgeLabel = '⚪ Sin Suscripción';
            progressClass = 'bg-secondary';
        } else if (isActive) {
            badgeClass = 'bg-success text-white';
            badgeLabel = '🟢 Activo';
            progressClass = 'bg-success';
        } else if (isTrial) {
            badgeClass = 'bg-warning text-dark';
            badgeLabel = '🟡 Prueba (7d)';
            progressClass = 'bg-warning';
        } else {
            badgeClass = 'bg-danger text-white';
            badgeLabel = '🔴 Expirado';
            progressClass = 'bg-danger';
        }

        const days = u.days_left || 0;
        const percent = (isAdmin || isLifetime) ? 100 : (days <= 0 || isExpired || isNeverSubscribed) ? 0 : Math.min(100, Math.max(0, Math.round((days / 30) * 100)));
        const daysLabel = (isAdmin || isLifetime) ? 'Ilimitado' : isNeverSubscribed ? '<span class="text-secondary fw-semibold">Sin Suscripción</span>' : (days > 0 ? `${days} día${days === 1 ? '' : 's'}` : '<span class="text-danger fw-bold">Vencido</span>');

        let createdStr = '---';
        if (u.created_at) {
            try {
                createdStr = new Date(u.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
            } catch (e) {}
        }

        let expStr = isNeverSubscribed ? 'Sin Suscripción Anterior' : 'Sin Vencimiento';
        if (u.subscription_expires_at && !isAdmin && !isLifetime && !isNeverSubscribed) {
            try {
                expStr = new Date(u.subscription_expires_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
            } catch (e) {}
        }

        const cleanPhone = (u.phone || '').replace(/[^0-9]/g, '');
        const waLink = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hola ${u.full_name}, te escribimos desde el soporte de VitaMetrix para ayudarte con tu suscripción clínica.`)}` : '';

        const isChecked = selectedAdminUserIds.has(u.id);

        return `
            <tr class="${isChecked ? 'table-active' : ''}">
                <td class="ps-3 py-3 text-center">
                    <input type="checkbox" class="form-check-input admin-user-checkbox" value="${u.id}" 
                           ${isAdmin ? 'disabled title="SuperAdmin protegido contra borrado"' : (isChecked ? 'checked' : '')}>
                </td>
                <td>
                    <div class="d-flex align-items-center gap-2.5">
                        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(u.full_name || 'Dr')}&background=${isAdmin ? '6366f1' : (isActive ? '005bbf' : '64748b')}&color=fff" 
                             alt="Avatar" class="rounded-circle shadow-2xs flex-shrink-0" style="width: 38px; height: 38px;">
                        <div class="overflow-hidden">
                            <div class="fw-bold text-navy text-truncate" style="max-width: 170px;">${escapeHtml(u.full_name)}</div>
                            <div class="text-muted text-xs text-truncate" style="max-width: 170px;">${escapeHtml(u.email)}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="fw-semibold text-secondary text-xs text-truncate" style="max-width: 170px;">${escapeHtml(u.professional_title || 'Nutricionista BIA')}</div>
                    <div class="text-muted text-xs text-truncate" style="max-width: 170px;"><i class="bi bi-hospital me-1"></i>${escapeHtml(u.clinic_name || 'Mi Consultorio')}</div>
                </td>
                <td>
                    ${cleanPhone ? `
                        <a href="${waLink}" target="_blank" class="btn btn-xs btn-outline-success d-inline-flex align-items-center gap-1 rounded-pill px-2.5 py-1" title="Chatear por WhatsApp">
                            <i class="bi bi-whatsapp"></i>
                            <span style="font-size: 0.72rem;">${escapeHtml(u.phone)}</span>
                        </a>
                    ` : `<span class="text-muted text-xs">Sin teléfono</span>`}
                </td>
                <td>
                    <span class="badge ${isAdmin ? 'bg-primary-subtle text-primary border border-primary border-opacity-30' : 'bg-light text-secondary border'} px-2.5 py-1 fw-bold text-xs rounded-pill">
                        ${isAdmin ? '👑 SuperAdmin' : '👨‍⚕️ Doctor'}
                    </span>
                </td>
                <td>
                    <span class="badge ${badgeClass} px-2.5 py-1 rounded-pill text-xs fw-bold mb-1 d-inline-block">
                        ${badgeLabel}
                    </span>
                    <div class="text-muted text-xs text-truncate" style="max-width: 150px;">
                        ${escapeHtml(u.subscription_plan || 'Plan Pro')}
                    </div>
                </td>
                <td>
                    <div class="d-flex align-items-center justify-content-between text-xs mb-1">
                        <span class="fw-bold">${daysLabel}</span>
                        <span class="text-muted" style="font-size: 0.7rem;">${percent.toFixed(0)}%</span>
                    </div>
                    <div class="progress" style="height: 6px; border-radius: 9999px; background-color: #f1f5f9;">
                        <div class="progress-bar ${progressClass}" role="progressbar" style="width: ${percent}%; border-radius: 9999px;"></div>
                    </div>
                </td>
                <td>
                    <div class="text-xs text-secondary mb-0.5">📅 Alta: <strong>${createdStr}</strong></div>
                    <div class="text-xs text-muted">⏳ Vence: <strong class="${isExpired ? 'text-danger' : 'text-navy'}">${expStr}</strong></div>
                </td>
                <td class="text-end pe-3">
                    <div class="btn-group btn-group-sm">
                        <button type="button" class="btn btn-outline-primary btn-xs py-1 px-2 fw-semibold" onclick="quickExtendUserDirect('${u.id}', 30)" title="Extender +30 días de suscripción">+30d</button>
                        <button type="button" class="btn btn-light btn-xs border py-1 px-2 text-secondary" onclick="openAdminManageUserModal('${u.id}')" title="Gestionar cuenta">
                            <i class="bi bi-gear-fill"></i>
                        </button>
                        <button type="button" class="btn btn-light btn-xs border py-1 px-2 text-primary" onclick="openAdminResetPasswordModal('${u.id}', '${escapeHtml(u.email)}')" title="Restablecer Contraseña">
                            <i class="bi bi-key-fill"></i>
                        </button>
                        ${!isAdmin ? `
                            <button type="button" class="btn btn-light btn-xs border py-1 px-2 text-warning" onclick="deactivateUserSubscriptionDirect('${u.id}', '${escapeHtml(u.full_name)}')" title="Desactivar Suscripción (0 días / Vencida)">
                                <i class="bi bi-pause-circle-fill"></i>
                            </button>
                            <button type="button" class="btn btn-light btn-xs border py-1 px-2 text-danger" onclick="removeUserSubscriptionDirect('${u.id}', '${escapeHtml(u.full_name)}')" title="Eliminar Suscripción (Restablecer a 'Sin Suscripción Anterior')">
                                <i class="bi bi-slash-circle-fill"></i>
                            </button>
                            <button type="button" class="btn btn-light btn-xs border py-1 px-2 text-danger" onclick="deleteAdminUser('${u.id}', '${escapeHtml(u.full_name)}')" title="Eliminar usuario permanentemente de la base de datos">
                                <i class="bi bi-trash"></i>
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    document.querySelectorAll('.admin-user-checkbox:not(:disabled)').forEach(cb => {
        cb.addEventListener('change', () => {
            if (cb.checked) {
                selectedAdminUserIds.add(cb.value);
                const row = cb.closest('tr');
                if (row) row.classList.add('table-active');
            } else {
                selectedAdminUserIds.delete(cb.value);
                const row = cb.closest('tr');
                if (row) row.classList.remove('table-active');
            }
            updateAdminBulkActionBar();
        });
    });

    updateAdminBulkActionBar();
}

async function fetchAdminPins(showToastFeedback = false) {
    const tbody = document.getElementById('tbody-admin-pins');
    if (!tbody) return;

    if (showToastFeedback && allAdminPinsData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-5 text-muted">
                    <div class="spinner-border text-warning spinner-border-sm me-2" role="status"></div>
                    Actualizando lista de PINs de activación...
                </td>
            </tr>
        `;
    }

    try {
        const res = await fetch('/api/admin/pins', { headers: getAuthHeaders() });
        if (!res.ok) return;

        const data = await res.json();
        if (!data.success) return;

        const serverPins = Array.isArray(data.pins) ? data.pins : [];
        allAdminPinsData = serverPins;
        try {
            localStorage.setItem('vm_admin_pins_cache', JSON.stringify(allAdminPinsData));
        } catch (e) {}

        const stats = data.stats || {};
        const kpiTotal = document.getElementById('kpi-admin-total-pins');
        const kpiAvailable = document.getElementById('kpi-admin-available-pins');
        const kpiUsed = document.getElementById('kpi-admin-used-pins');

        const totalCount = stats.total_pins ?? allAdminPinsData.length;
        const availableCount = stats.available_pins ?? allAdminPinsData.filter(p => !p.is_used).length;
        const usedCount = stats.used_pins ?? allAdminPinsData.filter(p => p.is_used).length;

        if (kpiTotal) kpiTotal.textContent = totalCount;
        if (kpiAvailable) kpiAvailable.textContent = availableCount;
        if (kpiUsed) kpiUsed.textContent = usedCount;

        renderAdminPins();

        if (showToastFeedback) {
            showToast('PINs de activación actualizados correctamente.', 'success');
        }
    } catch (e) {
        console.error('Error al cargar PINs de SuperAdmin:', e);
        if (allAdminPinsData.length > 0) {
            renderAdminPins();
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4 text-danger">
                        <i class="bi bi-exclamation-triangle-fill me-1"></i> Error de conexión al cargar PINs.
                    </td>
                </tr>
            `;
        }
    }
}

function renderAdminPins() {
    const tbody = document.getElementById('tbody-admin-pins');
    const searchInput = document.getElementById('admin-pins-search');
    const filterStatus = document.getElementById('admin-pins-filter-status');
    const showingCount = document.getElementById('admin-pins-showing-count');
    const totalCount = document.getElementById('admin-pins-total-count');

    if (!tbody) return;

    let filtered = [...allAdminPinsData];
    if (totalCount) totalCount.textContent = allAdminPinsData.length;

    const query = (searchInput ? searchInput.value : '').toLowerCase().trim();
    if (query) {
        filtered = filtered.filter(p => 
            (p.license_key || '').toLowerCase().includes(query) ||
            (p.plan_name || '').toLowerCase().includes(query) ||
            (p.note || '').toLowerCase().includes(query) ||
            (p.used_by_name || '').toLowerCase().includes(query) ||
            (p.used_by_email || '').toLowerCase().includes(query)
        );
    }

    const statusVal = filterStatus ? filterStatus.value : 'all';
    if (statusVal !== 'all') {
        if (statusVal === 'available') {
            filtered = filtered.filter(p => !p.is_used);
        } else if (statusVal === 'used') {
            filtered = filtered.filter(p => p.is_used);
        }
    }

    if (showingCount) showingCount.textContent = filtered.length;

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-5 text-muted">
                    <i class="bi bi-key fs-2 d-block mb-2 text-warning opacity-50"></i>
                    No se encontraron PINs con los filtros seleccionados.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtered.map(p => {
        const isUsed = Boolean(p.is_used);
        const pinKey = escapeHtml(p.license_key || '');
        const planName = escapeHtml(p.plan_name || 'Plan Pro Mensual');
        const note = escapeHtml(p.note || '—');

        let createdStr = '---';
        if (p.created_at) {
            try {
                createdStr = new Date(p.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
            } catch (e) {}
        }

        let usedInfo = '<span class="badge bg-success-subtle text-success border border-success border-opacity-25 px-2.5 py-1 rounded-pill fw-bold text-xs">✨ Disponible (Listo para entregar)</span>';
        if (isUsed) {
            let usedDateStr = '';
            if (p.used_at) {
                try {
                    usedDateStr = new Date(p.used_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
                } catch (e) {}
            }
            usedInfo = `
                <div>
                    <strong class="text-navy text-xs d-block">${escapeHtml(p.used_by_name || 'Doctor')}</strong>
                    <span class="text-muted text-xs d-block">${escapeHtml(p.used_by_email || '')}</span>
                    <span class="text-secondary text-xs" style="font-size: 0.7rem;">📅 Canjeado: ${usedDateStr}</span>
                </div>
            `;
        }

        return `
            <tr>
                <td class="ps-3 py-3">
                    <div class="d-flex align-items-center gap-2">
                        <span class="badge bg-light text-navy border px-2.5 py-1.5 font-monospace fw-bold fs-7 shadow-2xs">
                            ${pinKey}
                        </span>
                        <button type="button" class="btn btn-outline-secondary btn-xs py-1 px-2 rounded-2" onclick="copyPinToClipboard('${pinKey}')" title="Copiar PIN al portapapeles">
                            <i class="bi bi-clipboard"></i>
                        </button>
                    </div>
                </td>
                <td>
                    <span class="badge ${p.duration_days >= 9999 ? 'bg-purple text-white' : 'bg-primary-subtle text-primary'} px-2.5 py-1 rounded-pill text-xs fw-bold mb-0.5 d-inline-block">
                        ${p.duration_days >= 9999 ? '⭐ Lifetime' : `${p.duration_days} días`}
                    </span>
                    <div class="text-muted text-xs text-truncate" style="max-width: 170px;">${planName}</div>
                </td>
                <td>
                    <span class="badge ${isUsed ? 'bg-secondary text-white' : 'bg-success text-white'} px-2.5 py-1 rounded-pill text-xs fw-bold">
                        ${isUsed ? '⚪ USADO' : '🟢 DISPONIBLE'}
                    </span>
                </td>
                <td>
                    ${usedInfo}
                </td>
                <td>
                    <span class="text-secondary text-xs text-truncate d-block" style="max-width: 170px;">${note}</span>
                </td>
                <td>
                    <span class="text-muted text-xs">${createdStr}</span>
                </td>
                <td class="text-end pe-3">
                    <div class="btn-group btn-group-sm">
                        <button type="button" class="btn btn-outline-success btn-xs py-1 px-2" onclick="sharePinWhatsApp('${pinKey}', '${planName}', '${note}')" title="Compartir PIN por WhatsApp">
                            <i class="bi bi-whatsapp"></i>
                        </button>
                        <button type="button" class="btn btn-light btn-xs border py-1 px-2 text-danger" onclick="deleteAdminPin('${p.id}', '${pinKey}')" title="Eliminar PIN de la base de datos">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function copyPinToClipboard(pinKey) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(pinKey).then(() => {
            showToast(`📋 PIN copiado: ${pinKey}`, 'success');
        }).catch(() => {
            showToast(`PIN: ${pinKey}`, 'info');
        });
    } else {
        showToast(`PIN: ${pinKey}`, 'info');
    }
}

function sharePinWhatsApp(pinKey, planName, note) {
    const noteText = (note && note !== '—' && note.trim() !== '') ? `\n• *Detalle / Referencia:* ${note.trim()}` : '';
    
    let message = `Estimado(a) Dr(a).,\n\n`;
    message += `¡Muchas gracias por confiar en *VitaMetrix* y adquirir su suscripción médica! Es un placer acompañarle en la evaluación y seguimiento clínico nutricional de sus pacientes.\n\n`;
    message += `A continuación, le hacemos entrega de su PIN de activación oficial:\n\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `• *PIN de Licencia:* ${pinKey}\n`;
    message += `• *Plan Adquirido:* ${planName}${noteText}\n`;
    message += `• *Estado:* Listo para activación inmediata\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `*Pasos sencillos para activar su cuenta:*\n`;
    message += `1. Inicie sesión en su plataforma: https://vitametrix.onrender.com\n`;
    message += `2. Diríjase a la sección *"Mi Plan"* en el menú lateral.\n`;
    message += `3. En *"Canjear Clave de Licencia"*, ingrese su código PIN y presione *"Canjear"*.\n\n`;
    message += `Su acceso a todas las herramientas avanzadas quedará habilitado al instante.\n\n`;
    message += `Si requiere asistencia personalizada o soporte técnico, estamos a su total disposición.\n\n`;
    message += `Atentamente,\n`;
    message += `*Equipo de Soporte & Dirección Clínica VitaMetrix*`;

    const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
}

function deleteAdminPin(pinId, pinKey) {
    showConfirm(
        'Eliminar PIN de Activación',
        `¿Estás seguro de eliminar permanentemente el PIN <strong>${pinKey}</strong> de la base de datos?<br><span class="text-danger small">Si ya fue entregado a un médico, no podrá ser canjeado.</span>`,
        async () => {
            try {
                const res = await fetch(`/api/admin/pins/${pinId}`, {
                    method: 'DELETE',
                    headers: getAuthHeaders()
                });
                const data = await res.json();
                if (!res.ok || !data.success) {
                    showToast(data.error || 'Error al eliminar PIN', 'error');
                    return;
                }
                showToast(`🗑️ ${data.message}`, 'info');
                allAdminPinsData = allAdminPinsData.filter(p => p.id !== pinId && p.license_key !== pinId && p.license_key !== pinKey);
                try {
                    localStorage.setItem('vm_admin_pins_cache', JSON.stringify(allAdminPinsData));
                } catch (e) {}
                renderAdminPins();
                fetchAdminPins(false);
            } catch (e) {
                showToast('Error de conexión al eliminar PIN', 'error');
            }
        },
        { confirmText: 'Eliminar PIN', type: 'danger', icon: 'bi bi-trash-fill' }
    );
}

async function quickExtendUserDirect(userId, days = 30) {
    try {
        const res = await fetch(`/api/admin/users/${userId}/extend`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ days: days })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            showToast(data.error || 'Error al extender suscripción', 'error');
            return;
        }
        showToast(`⚡ ${data.message}`, 'success');
        fetchAdminUsers(false);
    } catch (e) {
        showToast('Error de conexión al extender suscripción', 'error');
    }
}

function openAdminManageUserModal(userId) {
    const user = allAdminUsersData.find(u => u.id === userId);
    if (!user) return;

    const modal = document.getElementById('modal-admin-manage-user');
    const inputId = document.getElementById('admin-manage-user-id');
    const subtitle = document.getElementById('admin-manage-subtitle');
    const emailEl = document.getElementById('admin-manage-email');
    const badgeEl = document.getElementById('admin-manage-current-badge');
    const expEl = document.getElementById('admin-manage-current-exp');
    const daysEl = document.getElementById('admin-manage-current-days');
    const statusSelect = document.getElementById('admin-manage-status-select');
    const roleSelect = document.getElementById('admin-manage-role-select');
    const planNameInput = document.getElementById('admin-manage-plan-name');
    const errorEl = document.getElementById('admin-manage-error');

    if (inputId) inputId.value = user.id;
    if (subtitle) subtitle.textContent = `Doctor: ${user.full_name}`;
    if (emailEl) emailEl.textContent = user.email;
    if (daysEl) daysEl.textContent = user.role === 'admin' ? 'Incaducable (Acceso SuperAdmin)' : `${user.days_left || 0} días restantes`;
    
    if (expEl) {
        if (user.subscription_expires_at && user.role !== 'admin') {
            try {
                expEl.textContent = new Date(user.subscription_expires_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
            } catch (e) {
                expEl.textContent = '---';
            }
        } else {
            expEl.textContent = 'Sin Vencimiento (Permanente)';
        }
    }

    if (badgeEl) {
        if (user.role === 'admin') {
            badgeEl.textContent = '👑 SuperAdmin';
            badgeEl.className = 'badge bg-purple text-white';
        } else if (user.subscription_status === 'lifetime') {
            badgeEl.textContent = '⭐ Lifetime';
            badgeEl.className = 'badge bg-purple text-white';
        } else if (user.subscription_status === 'active') {
            badgeEl.textContent = '🟢 Activo';
            badgeEl.className = 'badge bg-success text-white';
        } else if (user.subscription_status === 'trial') {
            badgeEl.textContent = '🟡 Prueba (7d)';
            badgeEl.className = 'badge bg-warning text-dark';
        } else if (user.subscription_status === 'no_subscription' || !user.subscription_expires_at) {
            badgeEl.textContent = '⚪ Sin Suscripción';
            badgeEl.className = 'badge bg-secondary text-white';
        } else {
            badgeEl.textContent = '🔴 Vencido';
            badgeEl.className = 'badge bg-danger text-white';
        }
    }

    if (statusSelect) statusSelect.value = user.subscription_status || (user.subscription_expires_at ? 'active' : 'no_subscription');
    if (roleSelect) roleSelect.value = user.role || 'user';
    if (planNameInput) planNameInput.value = user.subscription_plan || 'Plan Pro Mensual';
    if (errorEl) errorEl.classList.add('d-none');

    if (modal) {
        modal.classList.remove('hidden', 'd-none');
        modal.style.display = 'flex';
    }
}

function openAdminResetPasswordModal(userId, email) {
    const modal = document.getElementById('modal-admin-reset-password');
    const inputId = document.getElementById('admin-reset-user-id');
    const emailEl = document.getElementById('admin-reset-user-email');
    const passInput = document.getElementById('admin-reset-new-pass');
    const errorEl = document.getElementById('admin-reset-pass-error');

    if (inputId) inputId.value = userId;
    if (emailEl) emailEl.textContent = `Usuario: ${email}`;
    if (passInput) passInput.value = '';
    if (errorEl) errorEl.classList.add('d-none');

    if (modal) {
        modal.classList.remove('hidden', 'd-none');
        modal.style.display = 'flex';
    }
}

function closeAdminResetPasswordModal() {
    const modal = document.getElementById('modal-admin-reset-password');
    if (modal) {
        modal.classList.add('hidden', 'd-none');
        modal.style.display = 'none';
    }
}

async function quickExtendDays(days) {
    const userId = document.getElementById('admin-manage-user-id').value;
    if (!userId) return;
    await quickExtendUserDirect(userId, days);
    const modal = document.getElementById('modal-admin-manage-user');
    if (modal) {
        modal.classList.add('hidden', 'd-none');
        modal.style.display = 'none';
    }
}

function deactivateUserSubscriptionDirect(userId, userName) {
    showConfirm(
        'Desactivar Suscripción',
        `¿Deseas <strong>desactivar la suscripción</strong> de <strong>${escapeHtml(userName)}</strong>?<br><span class="text-muted small">La cuenta quedará inmediatamente en 0 días (vencida). Podrá volver a activarse cuando se le asigne o canjee un nuevo PIN.</span>`,
        async () => {
            try {
                const res = await fetch(`/api/admin/users/${userId}/deactivate-subscription`, {
                    method: 'POST',
                    headers: getAuthHeaders()
                });
                const data = await res.json();
                if (!res.ok || !data.success) {
                    showToast(data.error || 'Error al desactivar suscripción', 'error');
                    return;
                }
                showToast(`⏸️ ${data.message || 'Suscripción desactivada.'}`, 'warning');
                fetchAdminUsers(false);
            } catch (e) {
                showToast('Error de conexión al desactivar suscripción', 'error');
            }
        },
        { confirmText: 'Desactivar Suscripción', type: 'warning', icon: 'bi bi-pause-circle-fill' }
    );
}

function removeUserSubscriptionDirect(userId, userName) {
    showConfirm(
        'Eliminar Suscripción',
        `¿Deseas <strong>eliminar la suscripción</strong> de <strong>${escapeHtml(userName)}</strong>?<br><span class="text-muted small">La cuenta se restablecerá al estado 'Sin Suscripción Anterior' (como cuenta nueva).</span>`,
        async () => {
            try {
                const res = await fetch(`/api/admin/users/${userId}/remove-subscription`, {
                    method: 'POST',
                    headers: getAuthHeaders()
                });
                const data = await res.json();
                if (!res.ok || !data.success) {
                    showToast(data.error || 'Error al eliminar suscripción', 'error');
                    return;
                }
                showToast(`🗑️ ${data.message || 'Suscripción eliminada.'}`, 'info');
                fetchAdminUsers(false);
            } catch (e) {
                showToast('Error de conexión al eliminar suscripción', 'error');
            }
        },
        { confirmText: 'Eliminar Suscripción', type: 'danger', icon: 'bi bi-slash-circle-fill' }
    );
}

function quickDeactivateCurrentModalUser() {
    const userId = document.getElementById('admin-manage-user-id').value;
    const user = allAdminUsersData.find(u => u.id === userId);
    const userName = user ? user.full_name : 'Usuario';
    const modal = document.getElementById('modal-admin-manage-user');
    if (modal) {
        modal.classList.add('hidden', 'd-none');
        modal.style.display = 'none';
    }
    deactivateUserSubscriptionDirect(userId, userName);
}

function quickRemoveCurrentModalUserSubscription() {
    const userId = document.getElementById('admin-manage-user-id').value;
    const user = allAdminUsersData.find(u => u.id === userId);
    const userName = user ? user.full_name : 'Usuario';
    const modal = document.getElementById('modal-admin-manage-user');
    if (modal) {
        modal.classList.add('hidden', 'd-none');
        modal.style.display = 'none';
    }
    removeUserSubscriptionDirect(userId, userName);
}

function deleteAdminUser(userId, userName) {
    showConfirm(
        'Eliminar Usuario',
        `¿Estás seguro de eliminar permanentemente la cuenta del doctor <strong>${userName}</strong> de la base de datos?<br><span class="text-danger small">Esta acción no se puede deshacer.</span>`,
        async () => {
            try {
                const res = await fetch(`/api/admin/users/${userId}`, {
                    method: 'DELETE',
                    headers: getAuthHeaders()
                });
                const data = await res.json();
                if (!res.ok || !data.success) {
                    showToast(data.error || 'Error al eliminar usuario', 'error');
                    return;
                }
                showToast(`🗑️ Usuario ${userName} eliminado exitosamente.`, 'info');
                fetchAdminUsers(false);
            } catch (e) {
                showToast('Error de conexión al eliminar usuario', 'error');
            }
        },
        { confirmText: 'Eliminar Usuario', type: 'danger', icon: 'bi bi-trash-fill' }
    );
}

// Exportación global de funciones SuperAdmin
window.openAdminResetPasswordModal = openAdminResetPasswordModal;
window.closeAdminResetPasswordModal = closeAdminResetPasswordModal;
window.switchAdminTab = switchAdminTab;
window.initSuperAdminView = initSuperAdminView;
window.fetchAdminUsers = fetchAdminUsers;
window.fetchAdminPins = fetchAdminPins;
window.openAdminManageUserModal = openAdminManageUserModal;
window.quickExtendDays = quickExtendDays;
window.quickExtendUserDirect = quickExtendUserDirect;
window.deactivateUserSubscriptionDirect = deactivateUserSubscriptionDirect;
window.removeUserSubscriptionDirect = removeUserSubscriptionDirect;
window.quickDeactivateCurrentModalUser = quickDeactivateCurrentModalUser;
window.quickRemoveCurrentModalUserSubscription = quickRemoveCurrentModalUserSubscription;
window.deleteAdminUser = deleteAdminUser;

