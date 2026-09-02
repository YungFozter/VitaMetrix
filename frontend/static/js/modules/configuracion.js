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

    // Listener para subir archivo de logo de clínica (PNG, JPG, WebP)
    const logoFileInput = document.getElementById('cfg-logo-file-input');
    if (logoFileInput) {
        logoFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (!file.type.startsWith('image/')) {
                showToast('⚠️ Por favor selecciona un archivo de imagen válido (PNG, JPG, WebP).', 'warning');
                return;
            }

            if (file.size > 5 * 1024 * 1024) {
                showToast('⚠️ La imagen de logo no debe superar los 5 MB de tamaño.', 'warning');
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                const dataUrl = event.target.result;
                const cfgLogoUrl = document.getElementById('cfg-pdf-logo-url');
                const cfgLogoPreview = document.getElementById('cfg-logo-preview');

                if (cfgLogoUrl) cfgLogoUrl.value = dataUrl;
                if (cfgLogoPreview) cfgLogoPreview.src = dataUrl;

                showToast('🖼️ Imagen de logo cargada. Haz clic en "Guardar Cambios" para confirmar.', 'success');
            };
            reader.onerror = () => {
                showToast('🔴 Error al procesar el archivo de imagen.', 'error');
            };
            reader.readAsDataURL(file);
        });
    }

    // Listener para cambio en vivo de URL de logo al escribir
    const cfgLogoUrlInput = document.getElementById('cfg-pdf-logo-url');
    if (cfgLogoUrlInput) {
        cfgLogoUrlInput.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            const cfgLogoPreview = document.getElementById('cfg-logo-preview');
            if (cfgLogoPreview) {
                cfgLogoPreview.src = val || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentAuthUser?.clinic_name || 'VitaMetrix')}&background=00b4d8&color=fff`;
            }
        });
    }

    // Listener para importar respaldo JSON
    const jsonFileInput = document.getElementById('cfg-json-file-input');
    if (jsonFileInput) {
        jsonFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const parsed = JSON.parse(event.target.result);
                    showToast('📦 Respaldo JSON decodificado. Procesando actualización...', 'info');
                } catch (err) {
                    showToast('🔴 El archivo seleccionado no es un JSON de respaldo válido.', 'error');
                }
            };
            reader.readAsText(file);
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

    const clinicAddress = user.clinic_address || localStorage.getItem(`vm_clinic_address_physical_${userId}`) || '';
    const clinicLat = user.clinic_lat || localStorage.getItem(`vm_clinic_lat_${userId}`) || '-17.7833';
    const clinicLng = user.clinic_lng || localStorage.getItem(`vm_clinic_lng_${userId}`) || '-63.1821';

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
    const cfgClinicAddressInput = document.getElementById('cfg-clinic-address');
    const cfgClinicLatInput = document.getElementById('cfg-clinic-lat');
    const cfgClinicLngInput = document.getElementById('cfg-clinic-lng');

    if (cfgName) cfgName.value = name;
    if (cfgTitle) cfgTitle.value = title;
    if (cfgClinic) cfgClinic.value = clinic;
    if (cfgMp) cfgMp.value = mp;
    if (cfgPhone) cfgPhone.value = phone;
    let displayLogoInputUrl = logoUrl || '';
    if (displayLogoInputUrl.includes('ui-avatars.com')) {
        displayLogoInputUrl = '';
    }
    if (cfgLogoUrl) cfgLogoUrl.value = displayLogoInputUrl;
    if (cfgLogoPreview) cfgLogoPreview.src = logoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(clinic || 'VitaMetrix')}&background=00b4d8&color=fff`;
    if (cfgFooterAddress) cfgFooterAddress.value = footerAddress;
    if (cfgDisclaimer) cfgDisclaimer.value = disclaimer;
    if (cfgUnitWeight) cfgUnitWeight.value = unitWeight;
    if (cfgPhaOptimal) cfgPhaOptimal.value = phaOptimal;

    if (cfgClinicAddressInput) cfgClinicAddressInput.value = clinicAddress;
    if (cfgClinicLatInput) cfgClinicLatInput.value = clinicLat;
    if (cfgClinicLngInput) cfgClinicLngInput.value = clinicLng;

    updateUserProfileUI();
    setTimeout(() => {
        initClinicMap();
    }, 150);
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
    const clinicAddress = (document.getElementById('cfg-clinic-address')?.value || '').trim();
    const clinicLat = (document.getElementById('cfg-clinic-lat')?.value || '').trim();
    const clinicLng = (document.getElementById('cfg-clinic-lng')?.value || '').trim();

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
        pdf_footer_address: footerAddress || clinicAddress,
        clinic_address: clinicAddress || footerAddress,
        clinic_lat: clinicLat,
        clinic_lng: clinicLng,
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
            localStorage.setItem(`vm_clinic_address_${userId}`, clinicAddress || footerAddress);
            localStorage.setItem(`vm_clinic_address_physical_${userId}`, clinicAddress);
            localStorage.setItem(`vm_clinic_lat_${userId}`, clinicLat);
            localStorage.setItem(`vm_clinic_lng_${userId}`, clinicLng);
            localStorage.setItem(`vm_pdf_disclaimer_${userId}`, disclaimer);

            updateUserProfileUI();
            showToast('✅ Perfil Profesional, Ubicación GPS y Configuración guardados correctamente.', 'success');
        } else {
            showToast(`⚠️ ${data.error || 'No se pudo guardar la configuración'}`, 'error');
        }
    } catch (err) {
        showToast('🔴 Error de conexión al guardar configuración.', 'error');
    } finally {
        if (btnSave) btnSave.disabled = false;
    }
}

// ============================================================
// LÓGICA DE MAPAS OPENSTREETMAP, LEAFLET Y GPS GEOLOCALIZACIÓN
// ============================================================
let clinicMap = null;
let clinicMarker = null;

function initClinicMap() {
    const mapContainer = document.getElementById('clinic-map');
    if (!mapContainer) return;

    if (typeof L === 'undefined') {
        console.warn('Leaflet JS no está cargado todavía.');
        return;
    }

    const latInput = document.getElementById('cfg-clinic-lat');
    const lngInput = document.getElementById('cfg-clinic-lng');
    const addressInput = document.getElementById('cfg-clinic-address');

    let initialLat = parseFloat(latInput?.value) || -17.7833;
    let initialLng = parseFloat(lngInput?.value) || -63.1821;

    if (clinicMap) {
        clinicMap.invalidateSize();
        clinicMap.setView([initialLat, initialLng], clinicMap.getZoom() || 16);
        if (clinicMarker) {
            clinicMarker.setLatLng([initialLat, initialLng]);
        }
        updateGoogleMapsBtn(initialLat, initialLng);
        return;
    }

    try {
        clinicMap = L.map('clinic-map', {
            zoomControl: true,
            scrollWheelZoom: true
        }).setView([initialLat, initialLng], 16);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'
        }).addTo(clinicMap);

        clinicMarker = L.marker([initialLat, initialLng], {
            draggable: true,
            title: 'Arrastra para ajustar la ubicación exacta del consultorio'
        }).addTo(clinicMap);

        clinicMarker.bindPopup('<b>Ubicación del Consultorio</b><br>Arrastra este marcador o haz clic en el mapa para marcar tu consultorio.').openPopup();

        clinicMarker.on('dragend', function (e) {
            const pos = clinicMarker.getLatLng();
            updateMapCoordinatesInputs(pos.lat, pos.lng);
            reverseGeocode(pos.lat, pos.lng);
        });

        clinicMap.on('click', function (e) {
            clinicMarker.setLatLng(e.latlng);
            updateMapCoordinatesInputs(e.latlng.lat, e.latlng.lng);
            reverseGeocode(e.latlng.lat, e.latlng.lng);
        });

        if (latInput) latInput.addEventListener('change', syncMapFromInputs);
        if (lngInput) lngInput.addEventListener('change', syncMapFromInputs);

        const btnLocate = document.getElementById('btn-locate-me');
        if (btnLocate) {
            btnLocate.onclick = (e) => {
                e.preventDefault();
                getUserGPSLocation();
            };
        }

        const btnSearch = document.getElementById('btn-search-address');
        if (btnSearch) {
            btnSearch.onclick = (e) => {
                e.preventDefault();
                searchAddressOnMap();
            };
        }
        if (addressInput) {
            addressInput.onkeypress = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    searchAddressOnMap();
                }
            };
        }

        const btnLeaflet = document.getElementById('btn-map-type-leaflet');
        const btnGoogle = document.getElementById('btn-map-type-google');
        const googleIframe = document.getElementById('google-map-iframe');

        if (btnLeaflet && btnGoogle && googleIframe) {
            btnLeaflet.onclick = (e) => {
                e.preventDefault();
                btnLeaflet.classList.add('active');
                btnGoogle.classList.remove('active');
                mapContainer.classList.remove('d-none');
                googleIframe.classList.add('d-none');
                if (clinicMap) clinicMap.invalidateSize();
            };

            btnGoogle.onclick = (e) => {
                e.preventDefault();
                btnGoogle.classList.add('active');
                btnLeaflet.classList.remove('active');
                mapContainer.classList.add('d-none');
                googleIframe.classList.remove('d-none');
                const curLat = latInput?.value || -17.7833;
                const curLng = lngInput?.value || -63.1821;
                googleIframe.src = `https://maps.google.com/maps?q=${curLat},${curLng}&z=16&output=embed`;
            };
        }

        updateGoogleMapsBtn(initialLat, initialLng);
        setTimeout(() => {
            if (clinicMap) clinicMap.invalidateSize();
        }, 300);

    } catch (err) {
        console.error('Error inicializando OpenStreetMap Leaflet:', err);
    }
}

function updateMapCoordinatesInputs(lat, lng) {
    const latInput = document.getElementById('cfg-clinic-lat');
    const lngInput = document.getElementById('cfg-clinic-lng');
    if (latInput) latInput.value = Number(lat).toFixed(6);
    if (lngInput) lngInput.value = Number(lng).toFixed(6);
    updateGoogleMapsBtn(lat, lng);
}

function updateGoogleMapsBtn(lat, lng) {
    const btnGmaps = document.getElementById('btn-open-google-maps');
    if (btnGmaps) {
        btnGmaps.href = `https://www.google.com/maps?q=${lat},${lng}`;
    }
}

function syncMapFromInputs() {
    const latInput = document.getElementById('cfg-clinic-lat');
    const lngInput = document.getElementById('cfg-clinic-lng');
    const lat = parseFloat(latInput?.value);
    const lng = parseFloat(lngInput?.value);

    if (!isNaN(lat) && !isNaN(lng) && clinicMap && clinicMarker) {
        clinicMap.setView([lat, lng], clinicMap.getZoom() || 16);
        clinicMarker.setLatLng([lat, lng]);
        updateGoogleMapsBtn(lat, lng);
    }
}

function getUserGPSLocation() {
    if (!navigator.geolocation) {
        showToast('⚠️ Tu navegador no soporta la geolocalización GPS.', 'warning');
        return;
    }

    showToast('📡 Obteniendo tu posición GPS precisa...', 'info');

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;

            updateMapCoordinatesInputs(lat, lng);
            if (clinicMap && clinicMarker) {
                clinicMap.setView([lat, lng], 17);
                clinicMarker.setLatLng([lat, lng]);
                clinicMarker.bindPopup('<b>📍 Tu Ubicación GPS Actual</b><br>Obtenida por hardware GPS del dispositivo.').openPopup();
            }

            reverseGeocode(lat, lng);
            showToast('📍 ¡Ubicación GPS obtenida con éxito!', 'success');
        },
        (error) => {
            let errorMsg = 'No se pudo obtener la ubicación GPS.';
            if (error.code === error.PERMISSION_DENIED) {
                errorMsg = 'Permiso de ubicación denegado en el navegador.';
            } else if (error.code === error.POSITION_UNAVAILABLE) {
                errorMsg = 'Señal GPS no disponible temporalmente.';
            } else if (error.code === error.TIMEOUT) {
                errorMsg = 'Tiempo de espera agotado al buscar señal GPS.';
            }
            showToast(`⚠️ ${errorMsg} Ingresa tu dirección manualmente o busca en el mapa.`, 'warning');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}

async function reverseGeocode(lat, lng) {
    const addressInput = document.getElementById('cfg-clinic-address');
    if (!addressInput) return;

    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
            headers: { 'Accept-Language': 'es' }
        });
        const data = await res.json();
        if (data && data.display_name) {
            addressInput.value = data.display_name;
        }
    } catch (e) {
        console.warn('Geocodificación inversa Nominatim fallida:', e);
    }
}

async function searchAddressOnMap() {
    const addressInput = document.getElementById('cfg-clinic-address');
    const query = (addressInput?.value || '').trim();
    if (!query) {
        showToast('⚠️ Ingresa una dirección para buscar.', 'warning');
        return;
    }

    showToast('🔍 Buscando dirección en el mapa...', 'info');

    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`, {
            headers: { 'Accept-Language': 'es' }
        });
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
            const result = data[0];
            const lat = parseFloat(result.lat);
            const lng = parseFloat(result.lon);

            updateMapCoordinatesInputs(lat, lng);
            if (clinicMap && clinicMarker) {
                clinicMap.setView([lat, lng], 16);
                clinicMarker.setLatLng([lat, lng]);
                clinicMarker.bindPopup(`<b>${result.display_name.split(',')[0]}</b><br>${result.display_name}`).openPopup();
            }
            showToast('📍 Dirección encontrada en el mapa.', 'success');
        } else {
            showToast('⚠️ No se encontró la dirección. Intenta agregar tu ciudad (ej: Santa Cruz, Bolivia).', 'warning');
        }
    } catch (e) {
        showToast('🔴 Error al buscar dirección.', 'error');
    }
}

window.loadAllSettings = loadAllSettings;
window.saveAllSettings = saveAllSettings;
window.initClinicMap = initClinicMap;

function initConfiguracionView() {
    loadAllSettings();
}
