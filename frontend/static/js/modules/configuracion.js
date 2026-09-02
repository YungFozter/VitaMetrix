// ============================================================
// VITAMETRIX - MÓDULO 11: CONFIGURACIÓN DEL PERFIL Y LA CLÍNICA
// Archivo: frontend/static/js/modules/configuracion.js
// ============================================================

function updateUserProfileUI() {
    const user = currentAuthUser || {};
    const isAdmin = user.role === 'admin';

    const userId = user.id || 'guest';
    const name = user.full_name || localStorage.getItem(`vm_user_name_${userId}`) || (isAdmin ? 'Administrador General' : '');
    const title = user.professional_title || localStorage.getItem(`vm_user_title_${userId}`) || (isAdmin ? 'Director / Administrador de Plataforma' : '');
    const clinic = user.clinic_name || localStorage.getItem(`vm_clinic_name_${userId}`) || (isAdmin ? 'Sede Central VitaMetrix' : '');
    const phone = (user.phone !== undefined && user.phone !== null) ? user.phone : (localStorage.getItem(`vm_pdf_phone_${userId}`) || '');
    const mp = (user.professional_license !== undefined && user.professional_license !== null) ? user.professional_license : (localStorage.getItem(`vm_pdf_mp_${userId}`) || '');

    const topName = document.getElementById('topbar-user-name');
    const topTitle = document.getElementById('topbar-user-title');
    const topAvatar = document.getElementById('topbar-user-avatar');
    if (topName) topName.textContent = name;
    if (topTitle) topTitle.textContent = title;
    if (topAvatar) {
        topAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${isAdmin ? '6366f1' : '00b4d8'}&color=fff`;
    }

    const modalHeader = document.getElementById('profile-modal-header');
    const modalName = document.getElementById('profile-modal-name');
    const modalRoleBadge = document.getElementById('profile-modal-role-badge');
    const modalTitle = document.getElementById('profile-modal-title');
    const modalAvatar = document.getElementById('profile-modal-avatar');

    const card1Label = document.getElementById('profile-modal-card1-label');
    const card1IconBox = document.getElementById('profile-modal-card1-icon-box');
    const card1Icon = document.getElementById('profile-modal-card1-icon');
    const modalMp = document.getElementById('profile-modal-mp');

    const card2Label = document.getElementById('profile-modal-card2-label');
    const card2IconBox = document.getElementById('profile-modal-card2-icon-box');
    const card2Icon = document.getElementById('profile-modal-card2-icon');
    const modalClinic = document.getElementById('profile-modal-clinic');

    const card3Label = document.getElementById('profile-modal-card3-label');
    const card3IconBox = document.getElementById('profile-modal-card3-icon-box');
    const card3Icon = document.getElementById('profile-modal-card3-icon');
    const modalPhone = document.getElementById('profile-modal-phone');

    const card4Label = document.getElementById('profile-modal-card4-label');
    const card4IconBox = document.getElementById('profile-modal-card4-icon-box');
    const card4Icon = document.getElementById('profile-modal-card4-icon');
    const card4Content = document.getElementById('profile-modal-card4-content');

    const statsTitle = document.getElementById('profile-modal-stats-title');
    const stat1Label = document.getElementById('profile-modal-stat1-label');
    const statPatients = document.getElementById('profile-modal-stat-patients');
    const stat2Label = document.getElementById('profile-modal-stat2-label');
    const statEvals = document.getElementById('profile-modal-stat-evals');
    const stat3Label = document.getElementById('profile-modal-stat3-label');
    const statAppts = document.getElementById('profile-modal-stat-appts');

    const btnEdit = document.getElementById('profile-modal-btn-edit');

    if (modalName) modalName.textContent = name;
    if (modalTitle) modalTitle.textContent = title;

    if (isAdmin) {
        if (modalHeader) {
            modalHeader.style.background = 'linear-gradient(135deg, #091e3a 0%, #1e1b4b 45%, #4338ca 100%)';
        }
        if (modalAvatar) {
            modalAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4338ca&color=ffffff&size=128`;
        }
        if (modalRoleBadge) {
            modalRoleBadge.classList.remove('d-none');
            modalRoleBadge.textContent = '👑 SuperAdmin Master';
        }

        if (card1Label) card1Label.textContent = 'Rol en la Plataforma';
        if (card1IconBox) { card1IconBox.style.backgroundColor = '#ede9fe'; card1IconBox.style.color = '#6d28d9'; }
        if (card1Icon) card1Icon.className = 'bi bi-shield-lock-fill fs-5';
        if (modalMp) modalMp.innerHTML = '<span class="text-primary fw-bold">SuperAdmin (Control Total)</span>';

        if (card2Label) card2Label.textContent = 'Sede de Administración';
        if (card2IconBox) { card2IconBox.style.backgroundColor = '#e0e7ff'; card2IconBox.style.color = '#4338ca'; }
        if (card2Icon) card2Icon.className = 'bi bi-building-fill fs-5';
        if (modalClinic) modalClinic.textContent = clinic || 'Sede Central VitaMetrix';

        if (card3Label) card3Label.textContent = 'Teléfono / Soporte Oficial';
        if (card3IconBox) { card3IconBox.style.backgroundColor = '#dcfce7'; card3IconBox.style.color = '#15803d'; }
        if (card3Icon) card3Icon.className = 'bi bi-telephone-fill fs-5';
        if (modalPhone) modalPhone.textContent = phone || '+591 72125280';

        if (card4Label) card4Label.textContent = 'Estado de Suscripción';
        if (card4IconBox) { card4IconBox.style.backgroundColor = '#fef3c7'; card4IconBox.style.color = '#b45309'; }
        if (card4Icon) card4Icon.className = 'bi bi-infinity fs-5';
        if (card4Content) {
            card4Content.innerHTML = `
                <span class="badge bg-warning bg-opacity-15 text-dark border border-warning rounded-pill px-3 py-1 fw-bold" style="font-size: 0.8rem;">
                    <i class="bi bi-award-fill text-warning me-1"></i>Acceso Total Incaducible
                </span>
            `;
        }

        if (statsTitle) statsTitle.textContent = 'Métricas Globales de Plataforma';
        if (stat1Label) stat1Label.textContent = 'Médicos Registrados';
        if (stat2Label) stat2Label.textContent = 'PINs Creados';
        if (stat3Label) stat3Label.textContent = 'PINs Disponibles';

        const totalUsers = typeof allAdminUsersData !== 'undefined' ? allAdminUsersData.length : 2;
        const totalPins = typeof allAdminPinsData !== 'undefined' ? allAdminPinsData.length : 0;
        const availablePins = typeof allAdminPinsData !== 'undefined' ? allAdminPinsData.filter(p => !p.is_used).length : 0;

        if (statPatients) statPatients.textContent = totalUsers;
        if (statEvals) statEvals.textContent = totalPins;
        if (statAppts) statAppts.textContent = availablePins;

        if (btnEdit) {
            btnEdit.className = 'btn btn-warning text-dark px-4 py-2.5 fw-bold d-inline-flex align-items-center gap-2 rounded-3 shadow-md';
            btnEdit.innerHTML = '<i class="bi bi-shield-lock-fill fs-5"></i><span>Ir al Panel SuperAdmin</span>';
        }
    } else {
        if (modalHeader) {
            modalHeader.style.background = 'linear-gradient(135deg, #091e3a 0%, #0f2b4c 50%, #0284c7 100%)';
        }
        if (modalAvatar) {
            modalAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=ffffff&color=0284c7&size=128`;
        }
        if (modalRoleBadge) {
            modalRoleBadge.classList.add('d-none');
        }

        if (card1Label) card1Label.textContent = 'Matrícula Profesional';
        if (card1IconBox) { card1IconBox.style.backgroundColor = '#e0f2fe'; card1IconBox.style.color = '#0284c7'; }
        if (card1Icon) card1Icon.className = 'bi bi-award-fill fs-5';
        if (modalMp) modalMp.textContent = mp || 'Sin matrícula registrada';

        if (card2Label) card2Label.textContent = 'Centro Clínico Asignado';
        if (card2IconBox) { card2IconBox.style.backgroundColor = '#e0e7ff'; card2IconBox.style.color = '#4338ca'; }
        if (card2Icon) card2Icon.className = 'bi bi-hospital-fill fs-5';
        if (modalClinic) modalClinic.textContent = clinic || 'Centro Médico VitaMetrix';

        if (card3Label) card3Label.textContent = 'Contacto / Teléfono';
        if (card3IconBox) { card3IconBox.style.backgroundColor = '#dcfce7'; card3IconBox.style.color = '#15803d'; }
        if (card3Icon) card3Icon.className = 'bi bi-telephone-fill fs-5';
        if (modalPhone) modalPhone.textContent = phone || 'Sin teléfono';

        if (card4Label) card4Label.textContent = 'Modo de Estación';
        if (card4IconBox) { card4IconBox.style.backgroundColor = '#fef3c7'; card4IconBox.style.color = '#b45309'; }
        if (card4Icon) card4Icon.className = 'bi bi-shield-lock-fill fs-5';
        if (card4Content) {
            card4Content.innerHTML = `
                <span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-3 py-1 fw-bold" style="font-size: 0.8rem;">
                    <i class="bi bi-check-circle-fill me-1"></i>Estación Local Activa
                </span>
            `;
        }

        if (statsTitle) statsTitle.textContent = 'Resumen de Actividad';
        if (stat1Label) stat1Label.textContent = 'Pacientes';
        if (stat2Label) stat2Label.textContent = 'Estudios BIA';
        if (stat3Label) stat3Label.textContent = 'Citas de Hoy';

        if (statPatients) {
            const clientsTotalEl = document.getElementById('clients-total-count');
            const dashPatientsEl = document.getElementById('dash-total-patients');
            statPatients.textContent = (clientsTotalEl && clientsTotalEl.textContent !== '0') ? clientsTotalEl.textContent : (dashPatientsEl ? dashPatientsEl.textContent : (typeof allClientsData !== 'undefined' ? allClientsData.length : '0'));
        }
        if (statEvals) {
            const dashEvalsEl = document.getElementById('dash-total-evals');
            statEvals.textContent = (typeof allEvaluationsData !== 'undefined' && allEvaluationsData.length > 0) ? allEvaluationsData.length : (dashEvalsEl ? dashEvalsEl.textContent : '0');
        }
        if (statAppts) {
            const todayStr = new Date().toISOString().split('T')[0];
            const todayCount = (typeof clinicAppointments !== 'undefined') ? clinicAppointments.filter(a => a.date === todayStr).length : 0;
            statAppts.textContent = todayCount;
        }

        if (btnEdit) {
            btnEdit.className = 'btn btn-primary px-4 py-2.5 fw-bold d-inline-flex align-items-center gap-2 rounded-3 shadow-md';
            btnEdit.innerHTML = '<i class="bi bi-gear-fill fs-5"></i><span>Editar en Configuración</span>';
        }
    }
}

function initSystemMenuListeners() {
    const dropSettingsBtn = document.getElementById('dropdown-settings-btn');
    if (dropSettingsBtn) {
        dropSettingsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const dropdown = document.getElementById('profile-dropdown');
            if (dropdown) dropdown.classList.add('hidden');
            const configNav = document.getElementById('nav-settings-btn');
            if (configNav) configNav.click();
        });
    }

    const dropProfileBtn = document.getElementById('dropdown-profile-btn');
    const profileModal = document.getElementById('profile-card-modal');
    const profileModalClose = document.getElementById('profile-modal-close');
    const profileModalBtnClose = document.getElementById('profile-modal-btn-close');
    const profileModalBtnEdit = document.getElementById('profile-modal-btn-edit');
    const profileModalBtnSwitch = document.getElementById('profile-modal-btn-switch');

    const openProfileModal = () => {
        const dropdown = document.getElementById('profile-dropdown');
        if (dropdown) dropdown.classList.add('hidden');
        updateUserProfileUI();
        if (profileModal) profileModal.classList.remove('hidden');
    };

    const closeProfileModal = () => {
        if (profileModal) profileModal.classList.add('hidden');
    };

    if (dropProfileBtn) {
        dropProfileBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openProfileModal();
        });
    }

    if (profileModalClose) profileModalClose.addEventListener('click', closeProfileModal);
    if (profileModalBtnClose) profileModalBtnClose.addEventListener('click', closeProfileModal);

    if (profileModal) {
        profileModal.addEventListener('click', (e) => {
            if (e.target === profileModal) closeProfileModal();
        });
    }

    if (profileModalBtnEdit) {
        profileModalBtnEdit.addEventListener('click', () => {
            closeProfileModal();
            if (currentAuthUser && currentAuthUser.role === 'admin') {
                if (typeof navigateToView === 'function') navigateToView('superadmin-view', true);
            } else {
                const configNav = document.getElementById('nav-settings-btn');
                if (configNav) {
                    configNav.click();
                    setTimeout(() => {
                        const cfgCard = document.querySelector('#configuracion-view .card');
                        const userNameInput = document.getElementById('cfg-user-name');
                        if (cfgCard) {
                            cfgCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            cfgCard.classList.remove('highlight-pulse');
                            void cfgCard.offsetWidth;
                            cfgCard.classList.add('highlight-pulse');
                        }
                        if (userNameInput) userNameInput.focus();
                    }, 250);
                }
            }
        });
    }

    const switchModal = document.getElementById('switch-user-modal');
    const switchModalClose = document.getElementById('switch-user-modal-close');
    const switchModalBtnCancel = document.getElementById('switch-user-btn-cancel');
    const switchForm = document.getElementById('switch-user-form');

    const openSwitchModal = () => {
        const dropdown = document.getElementById('profile-dropdown');
        if (dropdown) dropdown.classList.add('hidden');
        closeProfileModal();

        const curName = localStorage.getItem('vm_user_name') || 'Dra. Audrey';
        const curTitle = localStorage.getItem('vm_user_title') || 'Manager / Especialista BIA';

        const inputName = document.getElementById('switch-user-name');
        const inputTitle = document.getElementById('switch-user-title');
        if (inputName) inputName.value = curName;
        if (inputTitle) inputTitle.value = curTitle;

        if (switchModal) switchModal.classList.remove('hidden');
    };

    const closeSwitchModal = () => {
        if (switchModal) switchModal.classList.add('hidden');
    };

    if (profileModalBtnSwitch) profileModalBtnSwitch.addEventListener('click', openSwitchModal);

    if (switchModalClose) switchModalClose.addEventListener('click', closeSwitchModal);
    if (switchModalBtnCancel) switchModalBtnCancel.addEventListener('click', closeSwitchModal);
    if (switchModal) {
        switchModal.addEventListener('click', (e) => {
            if (e.target === switchModal) closeSwitchModal();
        });
    }

    if (switchForm) {
        switchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const newName = (document.getElementById('switch-user-name')?.value || '').trim() || 'Dra. Audrey';
            const newTitle = (document.getElementById('switch-user-title')?.value || '').trim() || 'Especialista BIA';

            localStorage.setItem('vm_user_name', newName);
            localStorage.setItem('vm_user_title', newTitle);

            const cfgName = document.getElementById('cfg-user-name');
            const cfgTitle = document.getElementById('cfg-user-title');
            if (cfgName) cfgName.value = newName;
            if (cfgTitle) cfgTitle.value = newTitle;

            updateUserProfileUI();
            closeSwitchModal();
            showToast(`👨‍⚕️ Turno activo para ${newName} (${newTitle})`, 'success');
        });
    }

    const btnSaveAll = document.getElementById('btn-save-all-settings');
    if (btnSaveAll) {
        btnSaveAll.addEventListener('click', (e) => {
            e.preventDefault();
            saveAllSettings();
        });
    }

    loadAllSettings();
}

function loadAllSettings() {
    const user = currentAuthUser || {};
    const userId = user.id || 'guest';
    const isAdmin = user.role === 'admin';

    const name = user.full_name || localStorage.getItem(`vm_user_name_${userId}`) || (isAdmin ? 'Administrador General' : '');
    const title = user.professional_title || localStorage.getItem(`vm_user_title_${userId}`) || (isAdmin ? 'Director / Administrador' : 'Especialista BIA');
    const clinic = user.clinic_name || localStorage.getItem(`vm_clinic_name_${userId}`) || (isAdmin ? 'Sede Central VitaMetrix' : 'Mi Consultorio VitaMetrix');
    const phone = (user.phone !== undefined && user.phone !== null) ? user.phone : (localStorage.getItem(`vm_pdf_phone_${userId}`) || '');
    const mp = (user.professional_license !== undefined && user.professional_license !== null) ? user.professional_license : (localStorage.getItem(`vm_pdf_mp_${userId}`) || '');
    const logoUrl = user.clinic_logo_url || localStorage.getItem(`vm_pdf_logo_url_${userId}`) || '';
    const footerAddress = user.pdf_footer_address || user.clinic_address || localStorage.getItem(`vm_clinic_address_${userId}`) || '';
    const disclaimer = user.pdf_disclaimer || localStorage.getItem(`vm_pdf_disclaimer_${userId}`) || '';
    const unitWeight = user.unit_weight || 'kg';
    const phaOptimal = user.pha_optimal || '6.0';

    const cfgName = document.getElementById('cfg-user-name');
    const cfgTitle = document.getElementById('cfg-user-title');
    const cfgClinic = document.getElementById('cfg-clinic-name');
    const cfgMp = document.getElementById('cfg-pdf-mp');
    const cfgPhone = document.getElementById('cfg-pdf-phone');
    const cfgLogoUrl = document.getElementById('cfg-pdf-logo-url');
    const cfgLogoPreview = document.getElementById('cfg-logo-preview');
    const cfgFooterAddress = document.getElementById('cfg-pdf-footer-address');
    const cfgDisclaimer = document.getElementById('cfg-pdf-disclaimer');
    const cfgUnitWeight = document.getElementById('cfg-unit-weight');
    const cfgPhaOptimal = document.getElementById('cfg-pha-optimal');

    if (cfgName) cfgName.value = name;
    if (cfgTitle) cfgTitle.value = title;
    if (cfgClinic) cfgClinic.value = clinic;
    if (cfgMp) cfgMp.value = mp;
    if (cfgPhone) cfgPhone.value = phone;
    if (cfgLogoUrl) cfgLogoUrl.value = logoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(clinic || 'VitaMetrix')}&background=00b4d8&color=fff`;
    if (cfgLogoPreview) cfgLogoPreview.src = cfgLogoUrl ? cfgLogoUrl : `https://ui-avatars.com/api/?name=${encodeURIComponent(clinic || 'VitaMetrix')}&background=00b4d8&color=fff`;
    if (cfgFooterAddress) cfgFooterAddress.value = footerAddress;
    if (cfgDisclaimer) cfgDisclaimer.value = disclaimer;
    if (cfgUnitWeight) cfgUnitWeight.value = unitWeight;
    if (cfgPhaOptimal) cfgPhaOptimal.value = phaOptimal;

    updateUserProfileUI();
}

async function saveAllSettings() {
    const btnSave = document.getElementById('btn-save-all-settings');
    if (btnSave) btnSave.disabled = true;

    const name = (document.getElementById('cfg-user-name')?.value || '').trim();
    const title = (document.getElementById('cfg-user-title')?.value || '').trim();
    const clinic = (document.getElementById('cfg-clinic-name')?.value || '').trim();
    const mp = (document.getElementById('cfg-pdf-mp')?.value || '').trim();
    const phone = (document.getElementById('cfg-pdf-phone')?.value || '').trim();
    const logoUrl = (document.getElementById('cfg-pdf-logo-url')?.value || '').trim();
    const footerAddress = (document.getElementById('cfg-pdf-footer-address')?.value || '').trim();
    const disclaimer = (document.getElementById('cfg-pdf-disclaimer')?.value || '').trim();
    const unitWeight = document.getElementById('cfg-unit-weight')?.value || 'kg';
    const phaOptimal = document.getElementById('cfg-pha-optimal')?.value || '6.0';

    if (!name) {
        showToast('⚠️ El Nombre del Profesional es obligatorio.', 'warning');
        if (btnSave) btnSave.disabled = false;
        return;
    }

    const payload = {
        full_name: name,
        professional_title: title,
        clinic_name: clinic,
        professional_license: mp,
        phone: phone,
        clinic_logo_url: logoUrl,
        pdf_footer_address: footerAddress,
        clinic_address: footerAddress,
        pdf_disclaimer: disclaimer,
        unit_weight: unitWeight,
        pha_optimal: phaOptimal
    };

    try {
        const res = await fetch('/api/users/profile', {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (res.ok && data.success && data.user) {
            currentAuthUser = { ...currentAuthUser, ...data.user };
            const userId = currentAuthUser.id || 'guest';
            localStorage.setItem(`vm_user_name_${userId}`, name);
            localStorage.setItem(`vm_user_title_${userId}`, title);
            localStorage.setItem(`vm_clinic_name_${userId}`, clinic);
            localStorage.setItem(`vm_pdf_phone_${userId}`, phone);
            localStorage.setItem(`vm_pdf_mp_${userId}`, mp);
            localStorage.setItem(`vm_pdf_logo_url_${userId}`, logoUrl);
            localStorage.setItem(`vm_clinic_address_${userId}`, footerAddress);
            localStorage.setItem(`vm_pdf_disclaimer_${userId}`, disclaimer);

            updateUserProfileUI();
            showToast('✅ Perfil Profesional y Preferencias Clínicas guardados correctamente.', 'success');
        } else {
            showToast(`⚠️ ${data.error || 'No se pudo guardar la configuración'}`, 'error');
        }
    } catch (err) {
        showToast('🔴 Error de conexión al guardar configuración.', 'error');
    } finally {
        if (btnSave) btnSave.disabled = false;
    }
}

window.loadAllSettings = loadAllSettings;
window.saveAllSettings = saveAllSettings;

function initConfiguracionView() {
    loadAllSettings();
}
