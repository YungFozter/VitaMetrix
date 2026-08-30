// --- GUARD CONTRA ERRORES DE EXTENSIONES DEL NAVEGADOR (Ej. Web Vitals / Chrome Extensions / Translators) ---
window.addEventListener('error', (event) => {
    const msg = event?.message || (typeof event === 'string' ? event : '');
    const src = event?.filename || '';
    if (
        msg.includes('startTime') || 
        msg.includes('reportAllChanges') || 
        msg.includes('ResizeObserver') ||
        src.includes('chrome-extension://') ||
        src.includes('moz-extension://') ||
        src.includes('<anonymous>')
    ) {
        event.stopImmediatePropagation?.();
        event.preventDefault?.();
        return true;
    }
}, true);

window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason?.message || String(event?.reason || '');
    if (reason.includes('startTime') || reason.includes('reportAllChanges')) {
        event.stopImmediatePropagation?.();
        event.preventDefault?.();
    }
});

let clientsDataLoaded = false;
let evalsDataLoaded = false;
let stockDataLoaded = false;

document.addEventListener('DOMContentLoaded', () => {
    initDemoDataInjector();
    initFieldInfoPopups();
    initMobileSidebar();
    initClock();
    initNavigation();
    initAuthSystem();
    initSubscriptionView();
    initSuperAdminView();
    initBioForm();
    initBioClientAutocomplete();
    initClients();
    initPatientMessaging();
    initPatientHistoryModal();
    initEvaluaciones();
    initProfileDropdown();
    initSystemMenuListeners();
    initAppointmentsCalendar();
    initConfiguracionView();
    initStockModule();

    // Carga diferida en segundo plano para módulos secundarios (evita bloqueo del hilo principal)
    const scheduleIdleTasks = () => {
        const activeView = localStorage.getItem('vita_active_view') || 'dashboard-view';
        if (activeView !== 'dashboard-view') fetchDashboardStats();
        if (!clientsDataLoaded && activeView !== 'clientes-view') fetchClients();
        if (!evalsDataLoaded && activeView !== 'evaluaciones-view') fetchEvaluaciones();
        if (!stockDataLoaded && activeView !== 'stock-view') {
            fetchStockItems();
            fetchStockTaxonomies();
        }
    };

    if ('requestIdleCallback' in window) {
        requestIdleCallback(scheduleIdleTasks, { timeout: 1600 });
    } else {
        setTimeout(scheduleIdleTasks, 1000);
    }
});

// --- 0. UTILS & ESCAPING ---
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// --- 0.05 AUTH & MULTI-TENANT SAAS SESSION MANAGEMENT ---
let currentAuthUser = null;

function getAuthHeaders() {
    const token = localStorage.getItem('vm_auth_token') || sessionStorage.getItem('vm_auth_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

function isCurrentSubscriptionActive() {
    if (!currentAuthUser) return true;
    if (currentAuthUser.role === 'admin') return true;
    const sub = currentAuthUser.subscription || {};
    const status = sub.status || currentAuthUser.subscription_status;
    const days = typeof sub.days_left === 'number' ? sub.days_left : 0;
    if (status === 'lifetime') return true;
    if (status === 'active' || status === 'trial') {
        return days > 0;
    }
    return false;
}

function openRedeemPinModal() {
    const subTab = document.querySelector('[data-target="subscription-view"]');
    if (subTab) {
        subTab.click();
    } else if (typeof navigateToView === 'function') {
        navigateToView('subscription-view');
    }
    setTimeout(() => {
        const pinInput = document.getElementById('input-redeem-pin-key') || document.getElementById('input-license-key');
        if (pinInput) {
            pinInput.focus();
            pinInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 200);
}

function requireActiveSubscription(actionName) {
    if (isCurrentSubscriptionActive()) return true;
    const actionText = actionName ? ` para ${actionName}` : '';
    showToast(`⚠️ Tu suscripción ha caducado. Canjea un PIN${actionText}.`, 'warning');
    openRedeemPinModal();
    return false;
}

function updateUIWithUserData(userData) {
    if (!userData) return;
    currentAuthUser = userData;

    const isAdmin = userData && userData.role === 'admin';

    if (isAdmin) {
        document.documentElement.classList.add('is-admin-session');
    } else {
        document.documentElement.classList.remove('is-admin-session');
    }

    // Mostrar / Ocultar elementos exclusivos de SuperAdmin en Sidebar y Dropdown
    const adminElements = document.querySelectorAll('.admin-only-element');
    adminElements.forEach(el => {
        if (!isAdmin) {
            el.style.setProperty('display', 'none', 'important');
            el.classList.add('d-none');
        } else {
            el.style.removeProperty('display');
            el.classList.remove('d-none');
            el.style.display = el.tagName === 'A' || el.classList.contains('d-flex') ? 'flex' : 'block';
        }
    });

    // Actualizar nombre y título en TopBar
    const nameEl = document.getElementById('topbar-user-name');
    const titleEl = document.getElementById('topbar-user-title');
    const avatarEl = document.getElementById('topbar-user-avatar');
    const subTextEl = document.getElementById('topbar-sub-text');
    const subBadgeEl = document.getElementById('topbar-sub-badge');

    if (nameEl) nameEl.textContent = userData.full_name || 'Profesional';
    if (titleEl) titleEl.textContent = userData.professional_title || (isAdmin ? 'Director / SuperAdmin' : 'Especialista BIA');
    if (avatarEl) {
        avatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.full_name || 'Doctor')}&background=${isAdmin ? '6366f1' : '00b4d8'}&color=fff`;
    }

    // Actualizar banner y badge de suscripción en TopBar
    const readOnlyBanner = document.getElementById('read-only-subscription-banner');
    const isActiveSub = isCurrentSubscriptionActive();

    if (readOnlyBanner) {
        if (!isActiveSub && !isAdmin) {
            readOnlyBanner.classList.remove('d-none');
            readOnlyBanner.classList.add('d-flex');
        } else {
            readOnlyBanner.classList.add('d-none');
            readOnlyBanner.classList.remove('d-flex');
        }
    }

    if (userData.subscription) {
        const sub = userData.subscription;
        if (subTextEl) {
            if (sub.status === 'lifetime' || isAdmin) {
                subTextEl.textContent = '👑 SuperAdmin ⭐';
            } else if (sub.status === 'active' && isActiveSub) {
                subTextEl.textContent = `Plan Pro (${sub.days_left}d)`;
            } else if (sub.status === 'trial' && isActiveSub) {
                subTextEl.textContent = `Prueba (${sub.days_left}d)`;
            } else {
                subTextEl.textContent = '🔴 Suscripción Vencida (0d)';
            }
        }
        if (subBadgeEl) {
            subBadgeEl.classList.remove('border-danger', 'border-success', 'border-warning', 'bg-danger-subtle', 'bg-light');
            if (!isActiveSub && !isAdmin) {
                subBadgeEl.classList.add('border-danger', 'bg-danger-subtle');
            } else {
                subBadgeEl.classList.add('border-success-subtle', 'bg-light');
            }
        }
    }

    if (userData && userData.user) {
        const u = userData.user;
        const uId = u.id || 'guest';
        if (typeof u.phone === 'string') localStorage.setItem(`vm_pdf_phone_${uId}`, u.phone);
        if (typeof u.professional_license === 'string') localStorage.setItem(`vm_pdf_mp_${uId}`, u.professional_license);
        if (typeof u.clinic_logo_url === 'string') localStorage.setItem(`vm_pdf_logo_url_${uId}`, u.clinic_logo_url);
        if (typeof u.pdf_disclaimer === 'string') localStorage.setItem(`vm_pdf_disclaimer_${uId}`, u.pdf_disclaimer);
        if (typeof u.clinic_address === 'string') localStorage.setItem(`vm_clinic_address_${uId}`, u.clinic_address);
    }

    // Actualizar nombre y título en Dropdown del perfil
    const dropProfileText = document.getElementById('dropdown-profile-text');
    const dropProfileIcon = document.getElementById('dropdown-profile-icon');
    if (dropProfileText) {
        dropProfileText.textContent = isAdmin ? '👑 Mi Perfil SuperAdmin' : 'Mi Perfil Clínico';
    }
    if (dropProfileIcon) {
        dropProfileIcon.className = isAdmin ? 'bi bi-shield-check text-warning fs-6' : 'bi bi-person-badge text-primary fs-6';
    }

    updateUserProfileUI();
    if (typeof window.loadAllSettings === 'function') {
        window.loadAllSettings();
    }
}

function hideAuthModal() {
    const modal = document.getElementById('modal-auth');
    const btnClose = document.getElementById('btn-close-auth-modal');
    document.documentElement.classList.add('has-auth-token');
    document.documentElement.classList.remove('no-auth-token');
    if (modal) {
        modal.classList.add('hidden', 'd-none');
        modal.setAttribute('hidden', 'true');
        modal.style.setProperty('display', 'none', 'important');
        modal.style.setProperty('visibility', 'hidden', 'important');
        modal.style.setProperty('opacity', '0', 'important');
        modal.style.setProperty('pointer-events', 'none', 'important');
        modal.style.setProperty('z-index', '-100', 'important');
    }
    if (btnClose) btnClose.style.display = '';
}

function showAuthModal(isMandatory = false) {
    const modal = document.getElementById('modal-auth');
    const btnClose = document.getElementById('btn-close-auth-modal');
    if (isMandatory) {
        document.documentElement.classList.remove('has-auth-token');
        document.documentElement.classList.add('no-auth-token');
    }
    if (modal) {
        modal.classList.remove('hidden', 'd-none');
        modal.removeAttribute('hidden');
        modal.style.removeProperty('display');
        modal.style.removeProperty('visibility');
        modal.style.removeProperty('opacity');
        modal.style.removeProperty('pointer-events');
        modal.style.removeProperty('z-index');
        modal.style.display = 'flex';
    }
    if (btnClose) {
        btnClose.style.display = isMandatory ? 'none' : '';
    }
}

function initAuthSystem() {
    const modal = document.getElementById('modal-auth');
    const btnClose = document.getElementById('btn-close-auth-modal');
    const tabLoginBtn = document.getElementById('auth-tab-login-btn');
    const tabRegisterBtn = document.getElementById('auth-tab-register-btn');
    const formLogin = document.getElementById('form-auth-login');
    const formRegister = document.getElementById('form-auth-register');
    const linkSwitchRegister = document.getElementById('link-switch-to-register');
    const linkSwitchLogin = document.getElementById('link-switch-to-login');
    const logoutBtn = document.getElementById('dropdown-logout-btn');
    const loginError = document.getElementById('login-error-alert');
    const regError = document.getElementById('register-error-alert');

    // Cambiar a Tab Login
    const showLoginTab = () => {
        if (tabLoginBtn) {
            tabLoginBtn.classList.add('active');
            tabLoginBtn.classList.remove('text-muted');
        }
        if (tabRegisterBtn) {
            tabRegisterBtn.classList.remove('active');
            tabRegisterBtn.classList.add('text-muted');
        }
        if (formLogin) formLogin.classList.remove('d-none');
        if (formRegister) formRegister.classList.add('d-none');
        if (loginError) loginError.classList.add('d-none');
        if (regError) regError.classList.add('d-none');
    };

    // Cambiar a Tab Registro
    const showRegisterTab = () => {
        if (tabRegisterBtn) {
            tabRegisterBtn.classList.add('active');
            tabRegisterBtn.classList.remove('text-muted');
        }
        if (tabLoginBtn) {
            tabLoginBtn.classList.remove('active');
            tabLoginBtn.classList.add('text-muted');
        }
        if (formRegister) formRegister.classList.remove('d-none');
        if (formLogin) formLogin.classList.add('d-none');
        if (loginError) loginError.classList.add('d-none');
        if (regError) regError.classList.add('d-none');
    };

    if (tabLoginBtn) tabLoginBtn.addEventListener('click', showLoginTab);
    if (tabRegisterBtn) tabRegisterBtn.addEventListener('click', showRegisterTab);
    if (linkSwitchRegister) linkSwitchRegister.addEventListener('click', showRegisterTab);
    if (linkSwitchLogin) linkSwitchLogin.addEventListener('click', showLoginTab);

    // Toggle visibilidad de contraseña en Login
    const toggleLoginPass = document.getElementById('login-toggle-password');
    if (toggleLoginPass) {
        toggleLoginPass.addEventListener('click', () => {
            const passInput = document.getElementById('login-password');
            const icon = toggleLoginPass.querySelector('i');
            if (passInput) {
                if (passInput.type === 'password') {
                    passInput.type = 'text';
                    if (icon) icon.className = 'bi bi-eye-slash';
                } else {
                    passInput.type = 'password';
                    if (icon) icon.className = 'bi bi-eye';
                }
            }
        });
    }

    // Toggle visibilidad de contraseña en Registro
    const toggleRegPass = document.getElementById('reg-toggle-password');
    if (toggleRegPass) {
        toggleRegPass.addEventListener('click', () => {
            const passInput = document.getElementById('reg-password');
            const icon = toggleRegPass.querySelector('i');
            if (passInput) {
                if (passInput.type === 'password') {
                    passInput.type = 'text';
                    if (icon) icon.className = 'bi bi-eye-slash';
                } else {
                    passInput.type = 'password';
                    if (icon) icon.className = 'bi bi-eye';
                }
            }
        });
    }

    if (btnClose) {
        btnClose.addEventListener('click', () => {
            hideAuthModal();
        });
    }

    // Submit Login
    if (formLogin) {
        formLogin.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;
            const btnSubmit = document.getElementById('btn-submit-login');

            if (loginError) loginError.classList.add('d-none');
            if (btnSubmit) btnSubmit.disabled = true;

            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const data = await res.json();

                if (!res.ok || !data.success) {
                    if (loginError) {
                        loginError.textContent = data.error || 'Error al iniciar sesión';
                        loginError.classList.remove('d-none');
                    }
                    return;
                }

                localStorage.setItem('vm_auth_token', data.token);
                sessionStorage.setItem('vm_auth_token', data.token);
                updateUIWithUserData(data.user);
                hideAuthModal();
                showToast(`¡Bienvenido de nuevo, ${data.user.full_name}!`, 'success');

                // Redirigir siempre al Dashboard al iniciar sesión para cualquier usuario
                navigateToView('dashboard-view', true);

                // Resetear memorias intermedias al cambiar de usuario
                clientsDataLoaded = false;
                evalsDataLoaded = false;
                stockDataLoaded = false;
                allEvaluationsData = [];
                allClientsData = [];

                if (data.user.role === 'admin') {
                    fetchAdminUsers(false);
                } else {
                    // Limpiar cualquier residuo de vista admin anterior
                    if (localStorage.getItem('vita_active_view') === 'superadmin-view') {
                        localStorage.setItem('vita_active_view', 'dashboard-view');
                    }
                }

                // Refrescar datos propios del usuario autenticado
                fetchClients();
                fetchEvaluaciones();
                fetchStockItems();
                fetchDashboardStats();
                fetchSubscriptionStatus();
            } catch (err) {
                if (loginError) {
                    loginError.textContent = 'Error de conexión con el servidor.';
                    loginError.classList.remove('d-none');
                }
            } finally {
                if (btnSubmit) btnSubmit.disabled = false;
            }
        });
    }

    // Submit Registro
    if (formRegister) {
        formRegister.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fullName = document.getElementById('reg-full-name').value.trim();
            const email = document.getElementById('reg-email').value.trim();
            const password = document.getElementById('reg-password').value;
            const title = document.getElementById('reg-title').value.trim();
            const clinic = document.getElementById('reg-clinic').value.trim();
            const btnSubmit = document.getElementById('btn-submit-register');

            if (regError) regError.classList.add('d-none');
            if (btnSubmit) btnSubmit.disabled = true;

            try {
                const res = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        full_name: fullName,
                        email: email,
                        password: password,
                        professional_title: title,
                        clinic_name: clinic
                    })
                });
                const data = await res.json();

                if (!res.ok || !data.success) {
                    if (regError) {
                        regError.textContent = data.error || 'Error al registrar cuenta';
                        regError.classList.remove('d-none');
                    }
                    return;
                }

                // Redirigir a la sección de LOGIN
                formRegister.reset();
                showLoginTab();

                // Autocompletar el email recién registrado y enfocar campo de contraseña
                const loginEmailInput = document.getElementById('login-email');
                if (loginEmailInput) {
                    loginEmailInput.value = email;
                }
                const loginPassInput = document.getElementById('login-password');
                if (loginPassInput) {
                    loginPassInput.value = '';
                    loginPassInput.focus();
                }

                showToast('🎉 ¡Cuenta creada con éxito! Ingresa tu contraseña para iniciar sesión.', 'success');
            } catch (err) {
                if (regError) {
                    regError.textContent = 'Error de conexión al registrar.';
                    regError.classList.remove('d-none');
                }
            } finally {
                if (btnSubmit) btnSubmit.disabled = false;
            }
        });
    }

    const switchAccountBtn = document.getElementById('dropdown-switch-account-btn');
    if (switchAccountBtn) {
        switchAccountBtn.addEventListener('click', () => {
            showLoginTab();
            showAuthModal(false);
        });
    }

    // Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            showConfirm(
                'Cerrar Sesión',
                '¿Deseas cerrar tu sesión actual de VitaMetrix?',
                async () => {
                    try {
                        await fetch('/api/auth/logout', { method: 'POST', headers: getAuthHeaders() });
                    } catch (e) {}
                    localStorage.removeItem('vm_auth_token');
                    sessionStorage.removeItem('vm_auth_token');
                    currentAuthUser = null;
                    clientsDataLoaded = false;
                    evalsDataLoaded = false;
                    stockDataLoaded = false;
                    allEvaluationsData = [];
                    allClientsData = [];
                    filterAndRenderEvaluaciones();
                    renderClientsTable();
                    localStorage.setItem('vita_active_view', 'dashboard-view');
                    sessionStorage.setItem('vita_active_view', 'dashboard-view');
                    if (window.location.hash === '#superadmin-view') {
                        window.history.replaceState({ view: 'dashboard-view' }, '', '#dashboard-view');
                    }
                    document.documentElement.classList.remove('has-auth-token', 'is-admin-session');
                    document.documentElement.classList.add('no-auth-token');
                    showToast('Sesión cerrada. Inicia sesión con tu cuenta.', 'info');
                    showLoginTab();
                    showAuthModal(true);
                },
                { confirmText: 'Cerrar Sesión', type: 'danger', icon: 'bi bi-box-arrow-right' }
            );
        });
    }

    // Verificar sesión existente en arranque (Gating obligatorio)
    fetchAuthMe();
}

async function fetchAuthMe() {
    const token = localStorage.getItem('vm_auth_token') || sessionStorage.getItem('vm_auth_token');

    if (!token) {
        // No hay sesión activa: pantalla de Login obligatoria desde el inicio
        showAuthModal(true);
        return;
    }

    try {
        const res = await fetch('/api/auth/me', { headers: getAuthHeaders() });
        if (res.ok) {
            const data = await res.json();
            if (data.success && data.user) {
                updateUIWithUserData(data.user);
                hideAuthModal();

                // Si el usuario no es admin pero la memoria/hash intentaba abrir superadmin-view, forzar dashboard
                const activeView = localStorage.getItem('vita_active_view') || window.location.hash.replace(/^#/, '');
                if (data.user.role !== 'admin' && (activeView === 'superadmin-view' || window.location.hash === '#superadmin-view')) {
                    localStorage.setItem('vita_active_view', 'dashboard-view');
                    navigateToView('dashboard-view', true);
                }
                return;
            }
        }

        // Token inválido o expirado
        localStorage.removeItem('vm_auth_token');
        sessionStorage.removeItem('vm_auth_token');
        showAuthModal(true);
    } catch (e) {
        console.warn('Sesión no autenticada o local:', e);
        showAuthModal(true);
    }
}

// --- 0.08 GESTIÓN DE SUSCRIPCIONES & CANJE DE LICENCIAS SAAS ---
async function fetchSubscriptionStatus() {
    try {
        const res = await fetch('/api/subscription/status', { headers: getAuthHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        if (!data.success) return;

        const sub = data.subscription;
        const user = data.user;
        const wa = data.whatsapp;

        const headerBadge = document.getElementById('sub-header-badge');
        const statusPill = document.getElementById('sub-status-pill');
        const statusDot = document.getElementById('sub-status-dot');
        const statusPillText = document.getElementById('sub-status-pill-text');
        const planTitle = document.getElementById('sub-plan-title');
        const planDesc = document.getElementById('sub-plan-desc');
        const daysText = document.getElementById('sub-days-text');
        const progressBar = document.getElementById('sub-progress-bar');
        const expiryDate = document.getElementById('sub-expiry-date');
        const userId = document.getElementById('sub-user-id');
        const userName = document.getElementById('sub-user-name');
        const userEmail = document.getElementById('sub-user-email');
        const clinicBadge = document.getElementById('sub-clinic-badge');
        const waBtn = document.getElementById('btn-whatsapp-sub-contact');
        const watermarkIcon = document.getElementById('sub-watermark-icon');
        const alertBanner = document.getElementById('sub-renewal-alert-banner');
        const alertMsg = document.getElementById('sub-renewal-alert-msg');

        if (user.role === 'admin') {
            if (planTitle) planTitle.textContent = 'Acceso Total SuperAdmin / Incaducable ⭐';
            if (planDesc) planDesc.textContent = 'Privilegios maestros de administración central, incaducable y sin límites de uso.';
            if (daysText) daysText.innerHTML = '<span class="text-primary fw-bold">Incaducable / Permanente</span>';
            if (expiryDate) expiryDate.textContent = 'Sin Vencimiento (Acceso Master)';
            if (watermarkIcon) {
                watermarkIcon.className = 'bi bi-shield-shaded';
                watermarkIcon.style.color = '#8b5cf6';
            }
            if (progressBar) {
                progressBar.style.width = '100%';
                progressBar.style.background = 'linear-gradient(90deg, #8b5cf6 0%, #6366f1 100%)';
                progressBar.className = 'progress-bar';
            }
            if (statusPill) {
                statusPill.className = 'badge px-3 py-1.5 rounded-pill fs-7 fw-bold d-inline-flex align-items-center gap-1.5 shadow-2xs bg-purple text-white';
                if (statusDot) statusDot.style.background = '#e9d5ff';
                if (statusPillText) statusPillText.textContent = '👑 SuperAdmin Master';
            }
            if (headerBadge) {
                headerBadge.innerHTML = `<i class="bi bi-shield-lock-fill text-primary me-1"></i> Cuenta Master: <strong>Acceso Total e Incaducable</strong>`;
            }
            if (alertBanner) alertBanner.classList.add('d-none');
        } else {
            const isLifetime = sub.status === 'lifetime';
            const isNeverSubscribed = sub.status === 'no_subscription' || (!sub.expires_at && !isLifetime) || sub.plan_name === 'Sin Suscripción Anterior';
            const isTrial = sub.status === 'trial' && !isNeverSubscribed;
            const isExpired = (sub.status === 'expired' || (sub.days_left || 0) <= 0) && !isNeverSubscribed;
            const daysLeft = sub.days_left || 0;

            if (planTitle) {
                if (isLifetime) planTitle.textContent = 'Plan Vitalicio / Lifetime ⭐';
                else if (isNeverSubscribed) planTitle.textContent = 'Sin Suscripción Anterior';
                else if (isExpired) planTitle.textContent = 'Plan Vencido';
                else if (isTrial) planTitle.textContent = 'Plan de Prueba Gratuito (7 Días)';
                else planTitle.textContent = sub.plan_name || 'Plan Pro Mensual';
            }

            if (planDesc) {
                if (isNeverSubscribed) {
                    planDesc.textContent = 'Esta cuenta aún no ha activado una suscripción. Ingresa tu clave de activación (PIN) o comunícate por WhatsApp para habilitar todos los módulos clínicos de VitaMetrix.';
                } else if (isExpired) {
                    planDesc.textContent = 'Tu suscripción ha caducado. Renueva tu licencia o canjea un PIN para continuar disfrutando de todas las herramientas clínicas.';
                } else if (isTrial) {
                    planDesc.textContent = 'Disfruta de acceso completo a los módulos clínicos, stock y reportes de VitaMetrix durante tus 7 días de cortesía.';
                } else {
                    planDesc.textContent = 'Acceso completo a todos los módulos clínicos, cálculo bioeléctrico BIA, inventario de insumos e informes médicos de VitaMetrix.';
                }
            }

            if (daysText) {
                if (isLifetime) {
                    daysText.innerHTML = '<span class="text-success fw-bold">Ilimitado</span>';
                } else if (isNeverSubscribed) {
                    daysText.innerHTML = '<span class="text-secondary fw-bold">0 días (Sin Suscripción Anterior)</span>';
                } else if (isExpired) {
                    daysText.innerHTML = '<span class="text-danger fw-extrabold">0 días (Suscripción Vencida)</span>';
                } else if (isTrial) {
                    daysText.innerHTML = `<span class="text-warning-emphasis fw-bold">${daysLeft} día${daysLeft === 1 ? '' : 's'} de prueba</span>`;
                } else {
                    daysText.innerHTML = `<span class="text-navy fw-bold">${daysLeft} día${daysLeft === 1 ? '' : 's'}</span>`;
                }
            }

            if (expiryDate) {
                if (isLifetime) {
                    expiryDate.textContent = 'Sin Vencimiento';
                } else if (isNeverSubscribed) {
                    expiryDate.textContent = 'Sin Suscripción Anterior';
                } else if (sub.expires_at) {
                    try {
                        const d = new Date(sub.expires_at);
                        expiryDate.textContent = d.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
                    } catch (e) {
                        expiryDate.textContent = sub.expires_at;
                    }
                } else {
                    expiryDate.textContent = 'Sin Suscripción Anterior';
                }
            }

            // BARRA DE PROGRESO CON CONTROL EXACTO DE 0%
            if (progressBar) {
                let percent = 0;
                if (isLifetime) {
                    percent = 100;
                    progressBar.style.width = '100%';
                    progressBar.style.background = 'linear-gradient(90deg, #10b981 0%, #059669 100%)';
                } else if (isNeverSubscribed || isExpired || daysLeft <= 0) {
                    percent = 0;
                    progressBar.style.width = '0%';
                    progressBar.style.background = '#ef4444';
                } else if (isTrial) {
                    percent = Math.min(100, Math.max(0, Math.round((daysLeft / 7) * 100)));
                    progressBar.style.width = `${percent}%`;
                    progressBar.style.background = 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)';
                } else {
                    percent = Math.min(100, Math.max(0, Math.round((daysLeft / 30) * 100)));
                    progressBar.style.width = `${percent}%`;
                    progressBar.style.background = daysLeft <= 5 
                        ? 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)' 
                        : 'linear-gradient(90deg, #00b4d8 0%, #0077b6 100%)';
                }
                progressBar.className = 'progress-bar';
            }

            // BADGE & STATUS PILL
            if (statusPill) {
                if (isLifetime) {
                    statusPill.className = 'badge px-3 py-1.5 rounded-pill fs-7 fw-bold d-inline-flex align-items-center gap-1.5 shadow-2xs bg-success text-white';
                    if (statusDot) statusDot.style.background = '#86efac';
                    if (statusPillText) statusPillText.textContent = '⭐ Activo Ilimitado';
                } else if (isNeverSubscribed) {
                    statusPill.className = 'badge px-3 py-1.5 rounded-pill fs-7 fw-bold d-inline-flex align-items-center gap-1.5 shadow-2xs bg-secondary text-white';
                    if (statusDot) statusDot.style.background = '#cbd5e1';
                    if (statusPillText) statusPillText.textContent = '⚪ Sin Suscripción Anterior';
                } else if (isExpired) {
                    statusPill.className = 'badge px-3 py-1.5 rounded-pill fs-7 fw-bold d-inline-flex align-items-center gap-1.5 shadow-2xs bg-danger text-white';
                    if (statusDot) statusDot.style.background = '#fca5a5';
                    if (statusPillText) statusPillText.textContent = '🔴 Suscripción Vencida';
                } else if (isTrial) {
                    statusPill.className = 'badge px-3 py-1.5 rounded-pill fs-7 fw-bold d-inline-flex align-items-center gap-1.5 shadow-2xs bg-warning text-dark';
                    if (statusDot) statusDot.style.background = '#b45309';
                    if (statusPillText) statusPillText.textContent = `🟡 Prueba Gratis (${daysLeft}d)`;
                } else {
                    statusPill.className = 'badge px-3 py-1.5 rounded-pill fs-7 fw-bold d-inline-flex align-items-center gap-1.5 shadow-2xs bg-success text-white';
                    if (statusDot) statusDot.style.background = '#86efac';
                    if (statusPillText) statusPillText.textContent = `🟢 Activo (${daysLeft}d)`;
                }
            }

            // ICONO DINÁMICO DE FONDO
            if (watermarkIcon) {
                if (isLifetime) {
                    watermarkIcon.className = 'bi bi-stars';
                    watermarkIcon.style.color = '#10b981';
                } else if (isNeverSubscribed) {
                    watermarkIcon.className = 'bi bi-shield-x';
                    watermarkIcon.style.color = '#94a3b8';
                } else if (isExpired) {
                    watermarkIcon.className = 'bi bi-shield-x';
                    watermarkIcon.style.color = '#ef4444';
                } else if (isTrial) {
                    watermarkIcon.className = 'bi bi-hourglass-split';
                    watermarkIcon.style.color = '#f59e0b';
                } else {
                    watermarkIcon.className = 'bi bi-shield-check';
                    watermarkIcon.style.color = '#0284c7';
                }
            }

            // BANNER DE ALERTA RÁPIDA
            if (alertBanner) {
                if (isNeverSubscribed) {
                    alertBanner.className = 'alert alert-secondary border py-2 px-3 mb-3 rounded-3 d-flex align-items-center justify-content-between gap-2 text-xs bg-light';
                    if (alertMsg) alertMsg.innerHTML = '<strong>Primera vez en VitaMetrix:</strong> Ingresa un PIN de activación o canjea tu clave para comenzar.';
                } else if (isExpired) {
                    alertBanner.className = 'alert alert-danger py-2 px-3 mb-3 rounded-3 d-flex align-items-center justify-content-between gap-2 text-xs';
                    if (alertMsg) alertMsg.innerHTML = '<strong>Suscripción Vencida:</strong> Renueva tu licencia o canjea un PIN para desbloquear el acceso.';
                } else if (isTrial && daysLeft <= 2) {
                    alertBanner.className = 'alert alert-warning py-2 px-3 mb-3 rounded-3 d-flex align-items-center justify-content-between gap-2 text-xs';
                    if (alertMsg) alertMsg.innerHTML = `<strong>Prueba por finalizar:</strong> Te quedan ${daysLeft} día(s). Adquiere tu plan Pro oficial para mantener tu historial.`;
                } else if (!isTrial && !isLifetime && daysLeft <= 3) {
                    alertBanner.className = 'alert alert-warning py-2 px-3 mb-3 rounded-3 d-flex align-items-center justify-content-between gap-2 text-xs';
                    if (alertMsg) alertMsg.innerHTML = `<strong>Renovación cercana:</strong> Tu plan vencerá en ${daysLeft} día(s).`;
                } else {
                    alertBanner.className = 'alert alert-danger py-2 px-3 mb-3 rounded-3 d-none align-items-center justify-content-between gap-2 text-xs';
                }
            }

            if (headerBadge) {
                if (isNeverSubscribed) {
                    headerBadge.innerHTML = `<i class="bi bi-info-circle text-secondary me-1"></i> Estado: <strong class="text-secondary">Sin Suscripción Anterior</strong>`;
                } else if (isExpired) {
                    headerBadge.innerHTML = `<i class="bi bi-exclamation-octagon-fill text-danger me-1"></i> Estado: <strong class="text-danger">Vencido (0 días)</strong>`;
                } else if (isLifetime) {
                    headerBadge.innerHTML = `<i class="bi bi-stars text-success me-1"></i> Vigencia: <strong>Vitalicia</strong>`;
                } else {
                    headerBadge.innerHTML = `<i class="bi bi-shield-check text-success me-1"></i> Vigencia: <strong>${daysLeft} días</strong>`;
                }
            }
        }

        if (userId) userId.textContent = user.id || '---';
        if (userName) userName.textContent = user.full_name || 'Profesional';
        if (userEmail) userEmail.textContent = user.email || '';
        if (clinicBadge) clinicBadge.textContent = user.clinic_name || 'Consultorio Médico';

        // Enlace dinámico de WhatsApp (+591 72125280)
        if (waBtn && wa) {
            const encodedText = encodeURIComponent(wa.message_text);
            waBtn.href = `https://wa.me/${wa.phone_e164}?text=${encodedText}`;
        }

        updateUIWithUserData(user);
    } catch (e) {
        console.warn('Error al cargar estado de suscripción:', e);
    }
}

function initSubscriptionView() {
    const formRedeem = document.getElementById('form-redeem-license');
    const btnRedeem = document.getElementById('btn-redeem-license');

    const handleRedeem = async (e) => {
        if (e) e.preventDefault();
        const currentInput = document.getElementById('sub-license-input') || document.getElementById('input-license-key');
        const key = currentInput ? currentInput.value.trim() : '';

        if (!key) {
            showToast('Por favor ingresa un PIN de activación válido', 'warning');
            if (currentInput) currentInput.focus();
            return;
        }

        if (btnRedeem) {
            btnRedeem.disabled = true;
            btnRedeem.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span> Validando PIN...';
        }

        try {
            const res = await fetch('/api/subscription/redeem', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ license_key: key })
            });
            const data = await res.json();

            if (!res.ok || !data.success) {
                showToast(data.error || 'Error al canjear el PIN de activación', 'error');
                return;
            }

            showToast(`🎉 ${data.message || '¡PIN de activación canjeado con éxito!'}`, 'success');
            if (currentInput) currentInput.value = '';
            
            // Actualizar suscripción y datos del usuario en tiempo real
            await fetchSubscriptionStatus();
            if (typeof fetchCurrentUser === 'function') {
                await fetchCurrentUser();
            }
        } catch (err) {
            console.error('Error al canjear PIN:', err);
            showToast('Error de conexión al canjear el PIN', 'error');
        } finally {
            if (btnRedeem) {
                btnRedeem.disabled = false;
                btnRedeem.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i> Canjear y Activar Licencia';
            }
        }
    };

    if (formRedeem) {
        formRedeem.addEventListener('submit', handleRedeem);
    } else if (btnRedeem) {
        btnRedeem.addEventListener('click', handleRedeem);
    }

    fetchSubscriptionStatus();
}

// --- 0.09 GESTIÓN CENTRAL SUPERADMIN (USUARIOS, PINS Y LICENCIAS) ---
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

    // Modales de Usuario
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

    // Modales de PINs
    const openCreatePinBtn = document.getElementById('btn-admin-open-create-pin');
    const closeCreatePinBtn = document.getElementById('btn-close-admin-create-pin');
    const cancelCreatePinBtn = document.getElementById('btn-cancel-admin-create-pin');
    const modalCreatePin = document.getElementById('modal-admin-create-pin');
    const formCreatePin = document.getElementById('form-admin-create-pin');
    const pinError = document.getElementById('admin-pin-error');
    const pinsSearchInput = document.getElementById('admin-pins-search');
    const pinsFilterStatus = document.getElementById('admin-pins-filter-status');

    // Elementos de Acciones Masivas
    const selectAllCheckbox = document.getElementById('admin-select-all-users');
    const clearSelectionBtn = document.getElementById('btn-admin-clear-selection');
    const deleteSelectedBtn = document.getElementById('btn-admin-delete-selected');

    // Eventos de Usuarios
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            if (currentAdminTab === 'pins') {
                fetchAdminPins(true);
            } else {
                fetchAdminUsers(true);
            }
        });
    }
    if (searchInput) {
        searchInput.addEventListener('input', () => renderAdminUsers());
    }
    if (filterStatus) {
        filterStatus.addEventListener('change', () => renderAdminUsers());
    }
    if (sortSelect) {
        sortSelect.addEventListener('change', () => renderAdminUsers());
    }

    // Eventos de PINs
    if (pinsSearchInput) {
        pinsSearchInput.addEventListener('input', () => renderAdminPins());
    }
    if (pinsFilterStatus) {
        pinsFilterStatus.addEventListener('change', () => renderAdminPins());
    }

    // Seleccionar / Deseleccionar todos
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

    // Limpiar Selección Masiva
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

    // Eliminar Seleccionados (Batch Delete)
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

    // Modal Crear Usuario (Centrado y Reactivo)
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

    // Modal Gestionar Usuario (Centrado y Reactivo)
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

    // Modal Generar PINs (Centrado y Reactivo)
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

    // Restaurar subpestaña activa
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

    // Actualizar estado del checkbox general
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

        // Actualizar KPIs de plataforma
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

    // Filtro por texto
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

    // Filtro por Estado
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

    // Ordenación
    const sortVal = sortSelect ? sortSelect.value : 'newest';
    if (sortVal === 'name_asc') {
        filtered.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
    } else if (sortVal === 'days_asc') {
        filtered.sort((a, b) => (a.days_left || 0) - (b.days_left || 0));
    } else {
        // newest
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

        // Formatear fechas
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

        // WhatsApp direct link
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

    // Conectar eventos de cambio en cada checkbox individual
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

        // Actualizar KPIs de PINs
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

// --- 0.1 TOASTS & MODALS ---
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    // Icon
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    // Animate in
    setTimeout(() => toast.classList.add('show'), 10);

    // Remove after 3s
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showConfirm(title, message, onConfirm, options = {}) {
    const modal = document.getElementById('custom-modal');
    if (!modal) return;

    const titleEl = document.getElementById('modal-title');
    const msgEl = document.getElementById('modal-message');
    const btnCancel = document.getElementById('modal-btn-cancel');
    const btnConfirm = document.getElementById('modal-btn-confirm');
    const btnConfirmText = document.getElementById('modal-btn-confirm-text');
    const iconContainer = document.getElementById('modal-icon-container');

    if (titleEl) titleEl.textContent = title || 'Confirmación';
    if (msgEl) {
        if (typeof message === 'string' && (message.includes('<') || message.includes('"'))) {
            msgEl.innerHTML = message;
        } else {
            msgEl.textContent = message || '¿Estás seguro?';
        }
    }

    if (btnConfirmText) {
        btnConfirmText.textContent = options.confirmText || 'Eliminar';
    } else if (btnConfirm) {
        btnConfirm.textContent = options.confirmText || 'Eliminar';
    }

    if (iconContainer) {
        const type = options.type || 'danger';
        iconContainer.className = `modal-icon-badge ${type}`;
        iconContainer.innerHTML = `<i class="${options.icon || 'bi bi-trash3-fill'}"></i>`;
    }

    // Reset listeners by cloning
    const newCancel = btnCancel.cloneNode(true);
    const newConfirm = btnConfirm.cloneNode(true);
    btnCancel.parentNode.replaceChild(newCancel, btnCancel);
    btnConfirm.parentNode.replaceChild(newConfirm, btnConfirm);

    let isClosing = false;
    const closeModal = () => {
        if (isClosing) return;
        isClosing = true;
        modal.classList.add('closing');
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('closing');
            isClosing = false;
        }, 200);
    };

    newCancel.addEventListener('click', closeModal);
    newConfirm.addEventListener('click', () => {
        closeModal();
        if (typeof onConfirm === 'function') onConfirm();
    });

    // Close on clicking backdrop
    modal.onclick = (e) => {
        if (e.target === modal) closeModal();
    };

    modal.classList.remove('closing');
    modal.classList.remove('hidden');
}

// --- 1. CLOCK ---
function initClock() {
    const timeElement = document.getElementById('current-time');
    if (!timeElement) return;
    const tick = () => {
        const now = new Date();
        timeElement.textContent = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    };
    tick();
    setInterval(tick, 1000);
}

// --- 1.5 PROFILE DROPDOWN ---
function initProfileDropdown() {
    const profileBtn = document.getElementById('user-profile-btn');
    const dropdown = document.getElementById('profile-dropdown');

    if (profileBtn && dropdown) {
        profileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('hidden');
        });

        // Cierra el menú al hacer clic fuera
        document.addEventListener('click', (e) => {
            if (!profileBtn.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });
    }
}

// --- 2. NAVIGATION (SPA) & PERSISTENCIA DE PESTAÑA ACTIVA ---
function navigateToView(targetId, updateHistory = true) {
    if (!targetId) return;

    let cleanId = targetId.replace(/^#/, '').trim();

    // Guardia de Permisos: Si el usuario actual NO es SuperAdmin, bloquear acceso a superadmin-view
    const userRole = currentAuthUser?.role || (typeof currentAuthUser !== 'undefined' && currentAuthUser ? currentAuthUser.role : null);
    if (cleanId === 'superadmin-view' && userRole !== 'admin') {
        cleanId = 'dashboard-view';
    }

    const targetView = document.getElementById(cleanId);
    if (!targetView || !targetView.classList.contains('view')) return;

    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view');
    const pageTitle = document.getElementById('page-title');

    // 1. Desactivar todos los items del menú y ocultar todas las vistas
    navItems.forEach(nav => nav.classList.remove('active'));
    views.forEach(view => {
        view.classList.remove('active-view');
        view.classList.add('hidden-view');
    });

    // 2. Activar la vista solicitada
    targetView.classList.remove('hidden-view');
    targetView.classList.add('active-view');

    // 3. Activar el ítem del menú correspondiente y actualizar título
    const activeNav = document.querySelector(`.nav-item[data-target="${cleanId}"]`) ||
                      document.querySelector(`.nav-item[href="#${cleanId}"]`);
    if (activeNav) {
        activeNav.classList.add('active');
        if (pageTitle) {
            pageTitle.textContent = activeNav.getAttribute('data-title') || 'Dashboard';
        }
    }

    // 4. Persistir estado en URL hash y storage para recuperación al recargar
    try {
        localStorage.setItem('vita_active_view', cleanId);
        sessionStorage.setItem('vita_active_view', cleanId);
        if (updateHistory) {
            if (window.location.hash !== `#${cleanId}`) {
                window.history.replaceState({ view: cleanId }, '', `#${cleanId}`);
            }
        }
    } catch (e) {
        console.warn('Error guardando estado de navegación:', e);
    }

    // 5. Carga optimizada bajo demanda según la pestaña seleccionada
    if (cleanId === 'dashboard-view') {
        fetchDashboardStats();
    } else if (cleanId === 'clientes-view') {
        if (!clientsDataLoaded || allClientsData.length === 0) fetchClients();
    } else if (cleanId === 'evaluaciones-view') {
        if (!evalsDataLoaded || allEvaluationsData.length === 0) fetchEvaluaciones();
    } else if (cleanId === 'stock-view') {
        if (!stockDataLoaded || allStockItems.length === 0) {
            fetchStockItems();
            fetchStockTaxonomies();
        }
    } else if (cleanId === 'configuracion-view') {
        setTimeout(() => {
            if (typeof initClinicMap === 'function') initClinicMap();
        }, 120);
    } else if (cleanId === 'subscription-view') {
        fetchSubscriptionStatus();
    } else if (cleanId === 'superadmin-view') {
        const savedTab = localStorage.getItem('vm_admin_active_tab') || 'users';
        switchAdminTab(savedTab);
    }
}

function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = item.getAttribute('data-target') || (item.getAttribute('href') || '').replace(/^#/, '');
            if (targetId) {
                navigateToView(targetId, true);
            }
        });
    });

    // Escuchar eventos de navegación del navegador (atrás/adelante)
    window.addEventListener('popstate', () => {
        const hashId = (window.location.hash || '').replace(/^#/, '').trim();
        if (hashId && document.getElementById(hashId) && document.getElementById(hashId).classList.contains('view')) {
            navigateToView(hashId, false);
        }
    });

    // Determinar la vista inicial al cargar o recargar la pestaña
    const urlHash = (window.location.hash || '').replace(/^#/, '').trim();
    const storedView = localStorage.getItem('vita_active_view') || sessionStorage.getItem('vita_active_view');

    let initialView = 'dashboard-view';
    if (urlHash && document.getElementById(urlHash) && document.getElementById(urlHash).classList.contains('view')) {
        initialView = urlHash;
    } else if (storedView && document.getElementById(storedView) && document.getElementById(storedView).classList.contains('view')) {
        initialView = storedView;
    }

    navigateToView(initialView, true);
}

// --- 3. FORM & API ---
function getBioFormPayload() {
    return {
        patient_idp: document.getElementById('input-idp').value,
        patient_name: document.getElementById('input-name').value,
        resistance: parseFloat(document.getElementById('input-r').value),
        reactance: parseFloat(document.getElementById('input-xc').value),
        weight: parseFloat(document.getElementById('input-weight').value),
        height: parseFloat(document.getElementById('input-height').value),
        age: parseInt(document.getElementById('input-age').value),
        gender: document.getElementById('input-gender').value,
        pal: parseFloat(document.getElementById('input-pal').value),
        // Campos del dispositivo (opcionales)
        smm: document.getElementById('input-smm').value || null,
        tbw: document.getElementById('input-tbw').value || null,
        ecw: document.getElementById('input-ecw').value || null,
        fat_mass: document.getElementById('input-fat-mass').value || null,
        visceral_fat: document.getElementById('input-visceral').value || null,
        waist: document.getElementById('input-waist').value || null,
        // Fase 3
        phase_angle_dev: document.getElementById('input-phase-dev').value || null,
        seg_arm_r: document.getElementById('input-seg-arm-r').value || null,
        seg_arm_l: document.getElementById('input-seg-arm-l').value || null,
        seg_torso: document.getElementById('input-seg-torso').value || null,
        seg_leg_r: document.getElementById('input-seg-leg-r').value || null,
        seg_leg_l: document.getElementById('input-seg-leg-l').value || null
    };
}

function validateBioPayload(payload) {
    if (isNaN(payload.resistance) || payload.resistance < 100 || payload.resistance > 1500) {
        showToast('Resistencia (R) fuera de rango válido (100 - 1500 Ω)', 'error');
        return false;
    }
    if (isNaN(payload.reactance) || payload.reactance < 10 || payload.reactance > 200) {
        showToast('Reactancia (Xc) fuera de rango válido (10 - 200 Ω)', 'error');
        return false;
    }
    if (isNaN(payload.weight) || payload.weight < 20 || payload.weight > 350) {
        showToast('Peso fuera de rango válido (20 - 350 kg)', 'error');
        return false;
    }
    if (isNaN(payload.height) || payload.height < 50 || payload.height > 250) {
        showToast('Altura fuera de rango válido (50 - 250 cm)', 'error');
        return false;
    }
    if (isNaN(payload.age) || payload.age < 1 || payload.age > 120) {
        showToast('Edad fuera de rango válido (1 - 120 años)', 'error');
        return false;
    }
    return true;
}

function initBioForm() {
    const form = document.getElementById('bio-form');
    if (!form) return;

    // 1. ANALIZAR COMPOSICIÓN (Solo cálculo en memoria / UI, sin persistir en BD)
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const btn = document.getElementById('btn-analyze-submit') || form.querySelector('button[type="submit"]');
        let originalText = btn ? btn.innerHTML : 'Analizar Composición';
        if (btn) {
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span> Calculando...';
            btn.disabled = true;
        }

        const payload = getBioFormPayload();
        payload.save = false; // NO guardar en BD

        if (!validateBioPayload(payload)) {
            if (btn) { btn.innerHTML = originalText; btn.disabled = false; }
            return;
        }

        try {
            const response = await fetch('/api/dashboard-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Error en el análisis');
            }

            updateBioUI(data, payload);
            showToast("⚡ Análisis completado. Puedes revisarlo o hacer clic en 'Guardar Análisis'.", "info");

        } catch (error) {
            console.error('Error calculating:', error);
            showToast('Error al conectar con el servidor.', 'error');
        } finally {
            if (btn) {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        }
    });

    // 2. GUARDAR ANÁLISIS (Cálculo y persistencia explícita en Supabase)
    const btnSave = document.getElementById('btn-save-evaluation');
    if (btnSave) {
        btnSave.addEventListener('click', async () => {
            const originalHtml = btnSave.innerHTML;
            btnSave.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span> Guardando...';
            btnSave.disabled = true;

            const payload = getBioFormPayload();
            payload.save = true; // SÍ guardar en BD

            if (!validateBioPayload(payload)) {
                btnSave.innerHTML = originalHtml;
                btnSave.disabled = false;
                return;
            }

            try {
                const response = await fetch('/api/dashboard-data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                    body: JSON.stringify(payload)
                });

                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || 'Error al guardar la evaluación');
                }

                updateBioUI(data, payload);
                if (data.saved) {
                    showToast("💾 Evaluación guardada en el historial clínico con éxito.", "success");
                    fetchDashboardStats();
                    fetchEvaluaciones();
                    fetchClients();
                } else {
                    showToast("Análisis listo, pero no se pudo persistir en la nube.", "warning");
                }

            } catch (error) {
                console.error('Error saving evaluation:', error);
                showToast('Error al guardar en el servidor.', 'error');
            } finally {
                btnSave.innerHTML = originalHtml;
                btnSave.disabled = false;
            }
        });
    }
}

let populationChart = null;

async function fetchDashboardStats() {
    try {
        const response = await fetch('/api/dashboard-stats', { headers: getAuthHeaders() });
        if (response.ok) {
            const data = await response.json();

            // 1. Actualización fluida con animación de números de las tarjetas KPI
            const clientsEl = document.getElementById('dash-total-clients');
            const evalsEl = document.getElementById('dash-total-evals');
            const scoreEl = document.getElementById('dash-avg-score');

            if (window.vmAnimate && typeof window.vmAnimate.number === 'function') {
                if (clientsEl) window.vmAnimate.number(clientsEl, data.total_clients ?? 0, '', 500);
                if (evalsEl) window.vmAnimate.number(evalsEl, data.total_evaluations ?? 0, '', 500);
                if (scoreEl) window.vmAnimate.number(scoreEl, data.avg_score ?? 0, '', 500);
            } else {
                if (clientsEl) clientsEl.textContent = data.total_clients ?? 0;
                if (evalsEl) evalsEl.textContent = data.total_evaluations ?? 0;
                if (scoreEl) scoreEl.textContent = data.avg_score ?? 0;
            }

            // 2. Renderizado de alto rendimiento de la tabla de evaluaciones recientes (DocumentFragment)
            const tbody = document.getElementById('dash-recent-tbody');
            if (tbody) {
                const recent = Array.isArray(data.recent) ? data.recent : [];
                if (recent.length === 0) {
                    tbody.innerHTML = `
                        <tr>
                            <td colspan="6" class="text-center py-5">
                                <div class="d-flex flex-column align-items-center justify-content-center py-3 text-muted">
                                    <i class="bi bi-activity fs-3 mb-1 text-secondary opacity-50"></i>
                                    <span class="small fw-semibold">No hay evaluaciones recientes registradas</span>
                                </div>
                            </td>
                        </tr>
                    `;
                } else {
                    const frag = document.createDocumentFragment();
                    const colors = ['#00b4d8', '#2d7a4a', '#cd7f32', '#1A2A4A', '#7209b7'];
                    const todayStr = new Date().toISOString().split('T')[0];

                    recent.forEach((e, idx) => {
                        const tr = document.createElement('tr');
                        tr.className = 'dash-table-row';

                        // 1. Paciente (Avatar + Nombre + IDP)
                        const rawName = e.name || 'Paciente Sin Nombre';
                        const parts = rawName.replace(/^(Dr\.|Dra\.|Lic\.)\s*/i, '').trim().split(/[\s,]+/);
                        const initials = parts.length >= 2 
                            ? (parts[0][0] + parts[1][0]).toUpperCase() 
                            : (rawName.slice(0, 2).toUpperCase());
                        const bgCol = colors[idx % colors.length];

                        // 2. Fecha
                        const rawDate = e.date || '';
                        let formattedDate = rawDate;
                        if (rawDate) {
                            if (rawDate === todayStr) {
                                formattedDate = '<span class="date-tag tag-today">Hoy</span>';
                            } else {
                                const dParts = rawDate.split('-');
                                if (dParts.length === 3) formattedDate = `${dParts[2]}/${dParts[1]}/${dParts[0]}`;
                            }
                        }

                        // 3. TRU Score Badge
                        const scoreVal = Number(e.score) || 0;
                        let scoreClass = 'score-badge-good';
                        if (scoreVal < 50) scoreClass = 'score-badge-alert';
                        else if (scoreVal < 70) scoreClass = 'score-badge-mid';

                        // 4. Ángulo de Fase
                        const phaVal = Number(e.phase_angle) || 0;

                        // 5. Estado PhA
                        let statusHtml = '<span class="status-pill status-normal">🟢 Normal</span>';
                        if (phaVal > 0 && phaVal < 5.0) {
                            statusHtml = '<span class="status-pill status-alert">🔴 Riesgo</span>';
                        } else if (phaVal >= 5.0 && phaVal < 6.0) {
                            statusHtml = '<span class="status-pill status-warning">🟡 Moderado</span>';
                        }

                        tr.innerHTML = `
                            <td>
                                <div class="patient-cell">
                                    <div class="patient-avatar" style="background: ${bgCol};">${initials}</div>
                                    <div class="patient-info">
                                        <div class="patient-name">${escapeHtml(rawName)}</div>
                                        <div class="patient-idp">IDP: ${escapeHtml(e.idp || ('2026-' + (100 + idx * 17)))}</div>
                                    </div>
                                </div>
                            </td>
                            <td><div class="date-cell">${formattedDate}</div></td>
                            <td><span class="score-pill ${scoreClass}">${scoreVal} pts</span></td>
                            <td><div class="pha-cell">${phaVal ? phaVal.toFixed(1) + '°' : '--'}</div></td>
                            <td>${statusHtml}</td>
                            <td style="text-align: right;">
                                <button type="button" class="btn-table-view" title="Ver detalles de la evaluación">
                                    👁️ Ver
                                </button>
                            </td>
                        `;

                        const viewBtn = tr.querySelector('.btn-table-view');
                        if (viewBtn) {
                            viewBtn.addEventListener('click', (evt) => {
                                evt.stopPropagation();
                                const evalsTab = document.querySelector('[data-target="evaluaciones-view"]');
                                if (evalsTab) evalsTab.click();
                            });
                        }

                        frag.appendChild(tr);
                    });

                    tbody.replaceChildren(frag);
                }
            }

            // 3. Render Chart.js (optimizado)
            const ctx = document.getElementById('dash-population-chart');
            if (ctx && window.Chart && data.population) {
                if (populationChart) populationChart.destroy();

                populationChart = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: ['Óptimo', 'Límite', 'Bajo'],
                        datasets: [{
                            data: [
                                data.population['Óptimo'] || 0,
                                data.population['Límite'] || 0,
                                data.population['Bajo'] || 0
                            ],
                            backgroundColor: ['#2d7a4a', '#cd7f32', '#b94a4a'],
                            borderWidth: 0,
                            hoverOffset: 4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        animation: { duration: 400 },
                        cutout: '70%',
                        plugins: {
                            legend: { position: 'bottom', labels: { font: { family: 'Inter', size: 12 }, color: '#5a6f8c' } }
                        }
                    }
                });
            }
        }
    } catch (e) {
        console.error("Error fetching stats:", e);
    }
}

// Helpers de semáforo
function setChip(el, statusPair) {
    if (!el) return;
    el.classList.remove('green', 'yellow', 'red', 'muted');
    if (!statusPair || !statusPair[1]) { el.textContent = '--'; el.classList.add('muted'); return; }
    el.textContent = statusPair[0];
    el.classList.add(statusPair[1]);
}

function showGrid(naId, gridId) {
    const na = document.getElementById(naId);
    const grid = document.getElementById(gridId);
    if (na) na.style.display = 'none';
    if (grid) grid.style.display = 'flex';
}

function updateBioUI(data, inputs) {
    // 1. Valores numéricos base con animación de conteo
    if (window.vmAnimate && window.vmAnimate.number) {
        window.vmAnimate.number(document.getElementById('global-score'), data.score);
        window.vmAnimate.number(document.getElementById('muscle-score'), data.muscle_score);
        window.vmAnimate.number(document.getElementById('fat-score'), data.fat_score);
        window.vmAnimate.number(document.getElementById('ree-value'), data.ree_kcal);
        window.vmAnimate.number(document.getElementById('tee-value'), data.tee_kcal);
    } else {
        document.getElementById('global-score').textContent = data.score;
        document.getElementById('muscle-score').textContent = data.muscle_score;
        document.getElementById('fat-score').textContent = data.fat_score;
        document.getElementById('ree-value').textContent = data.ree_kcal;
        document.getElementById('tee-value').textContent = data.tee_kcal;
    }
    
    document.getElementById('rank-badge').textContent = data.rank;

    const gScore = data.score || 0;
    const gRank = data.rank || 'HIERRO';

    // Actualizar Rango y Barra de Progreso TRU Body Score
    const elRank = document.getElementById('rank-badge');
    const elTruStatus = document.getElementById('tru-score-status');
    const elTruNext = document.getElementById('tru-next-rank-text');
    const elTruPctLabel = document.getElementById('tru-pct-label');
    const elTruBar = document.getElementById('tru-progress-bar');
    const elTruDiag = document.getElementById('tru-summary-diag');

    if (elRank) {
        elRank.textContent = gRank;
        if (gRank === 'ORO') {
            elRank.style.background = 'linear-gradient(135deg, #fef08a 0%, #eab308 100%)';
            elRank.style.color = '#713f12';
            elRank.style.boxShadow = '0 4px 12px rgba(234, 179, 8, 0.35)';
        } else if (gRank === 'PLATA') {
            elRank.style.background = 'linear-gradient(135deg, #f1f5f9 0%, #cbd5e1 100%)';
            elRank.style.color = '#334155';
            elRank.style.boxShadow = '0 4px 12px rgba(148, 163, 184, 0.35)';
        } else if (gRank === 'BRONCE') {
            elRank.style.background = 'linear-gradient(135deg, #fed7aa 0%, #ea580c 100%)';
            elRank.style.color = '#7c2d12';
            elRank.style.boxShadow = '0 4px 12px rgba(234, 88, 12, 0.35)';
        } else {
            elRank.style.background = 'linear-gradient(135deg, #e2e8f0 0%, #64748b 100%)';
            elRank.style.color = '#ffffff';
            elRank.style.boxShadow = '0 4px 12px rgba(100, 116, 139, 0.25)';
        }
    }

    if (elTruStatus) {
        if (gScore >= 95) {
            elTruStatus.textContent = 'Nivel Élite / Excelente';
            elTruStatus.style.background = 'rgba(234, 179, 8, 0.15)';
            elTruStatus.style.color = '#a16207';
        } else if (gScore >= 90) {
            elTruStatus.textContent = 'Alto Rendimiento';
            elTruStatus.style.background = 'rgba(148, 163, 184, 0.2)';
            elTruStatus.style.color = '#334155';
        } else if (gScore >= 80) {
            elTruStatus.textContent = 'Buena Condición';
            elTruStatus.style.background = 'rgba(234, 88, 12, 0.15)';
            elTruStatus.style.color = '#c2410c';
        } else {
            elTruStatus.textContent = 'En Optimización';
            elTruStatus.style.background = 'rgba(0, 180, 216, 0.15)';
            elTruStatus.style.color = '#0284c7';
        }
    }

    if (elTruPctLabel) elTruPctLabel.textContent = `${gScore}%`;
    if (elTruBar) elTruBar.style.width = `${Math.min(Math.max(gScore, 5), 100)}%`;

    if (elTruNext) {
        if (gScore >= 95) elTruNext.textContent = '¡Rango Máximo Alcanzado!';
        else if (gScore >= 90) elTruNext.textContent = `A ${95 - gScore} pts de alcanzar ORO`;
        else if (gScore >= 80) elTruNext.textContent = `A ${90 - gScore} pts de alcanzar PLATA`;
        else elTruNext.textContent = `A ${80 - gScore} pts de alcanzar BRONCE`;
    }

    // Pilares
    const elPillarPhase = document.getElementById('tru-pillar-phase');
    const elPillarMuscle = document.getElementById('tru-pillar-muscle');
    const elPillarFat = document.getElementById('tru-pillar-fat');

    if (elPillarPhase) elPillarPhase.textContent = `${data.phase_angle || inputs.phase_angle || '--'}°`;
    if (elPillarMuscle) elPillarMuscle.textContent = `${data.muscle_score || 0} pts`;
    if (elPillarFat) elPillarFat.textContent = `${data.fat_score || 0} pts`;

    if (elTruDiag) {
        if (gScore >= 90) {
            elTruDiag.textContent = 'Integridad celular y reserva magra en niveles óptimos de salud.';
        } else if (gScore >= 80) {
            elTruDiag.textContent = 'Balance bioeléctrico adecuado con buena densidad celular.';
        } else {
            elTruDiag.textContent = 'Oportunidad de progresión muscular y optimización de hidratación celular.';
        }
    }

    // Circular Gauges for Muscle and Fat
    const muscleGauge = document.getElementById('muscle-gauge');
    const fatGauge = document.getElementById('fat-gauge');
    if (muscleGauge) {
        if (window.vmAnimate && window.vmAnimate.gauge) {
            window.vmAnimate.gauge(muscleGauge, data.muscle_score, '#2d7a4a');
        } else {
            muscleGauge.style.setProperty('--muscle-pct', `${data.muscle_score}%`);
            muscleGauge.style.background = `conic-gradient(#2d7a4a ${data.muscle_score}%, #e2e8f0 0)`;
        }
    }
    if (fatGauge) {
        if (window.vmAnimate && window.vmAnimate.gauge) {
            window.vmAnimate.gauge(fatGauge, data.fat_score, '#b94a4a');
        } else {
            fatGauge.style.setProperty('--fat-pct', `${data.fat_score}%`);
            fatGauge.style.background = `conic-gradient(#b94a4a ${data.fat_score}%, #e2e8f0 0)`;
        }
    }

    // Actualizar estados cualitativos y rangos clínicos para Muscle Score & Fat Score
    const mScore = data.muscle_score || 0;
    const fScore = data.fat_score || 0;

    // Muscle Status Badge
    const elMStatus = document.getElementById('muscle-score-status');
    if (elMStatus) {
        if (mScore >= 80) {
            elMStatus.textContent = 'Excelente';
            elMStatus.style.background = 'rgba(16, 185, 129, 0.15)';
            elMStatus.style.color = '#059669';
        } else if (mScore >= 60) {
            elMStatus.textContent = 'Óptimo';
            elMStatus.style.background = 'rgba(45, 122, 74, 0.15)';
            elMStatus.style.color = '#2d7a4a';
        } else if (mScore >= 40) {
            elMStatus.textContent = 'Aceptable';
            elMStatus.style.background = 'rgba(245, 158, 11, 0.15)';
            elMStatus.style.color = '#d97706';
        } else {
            elMStatus.textContent = 'Bajo';
            elMStatus.style.background = 'rgba(239, 68, 68, 0.15)';
            elMStatus.style.color = '#dc2626';
        }
    }

    // Fat Status Badge
    const elFStatus = document.getElementById('fat-score-status');
    if (elFStatus) {
        if (fScore < 20) {
            elFStatus.textContent = 'Bajo';
            elFStatus.style.background = 'rgba(2, 132, 199, 0.15)';
            elFStatus.style.color = '#0284c7';
        } else if (fScore <= 50) {
            elFStatus.textContent = 'Saludable';
            elFStatus.style.background = 'rgba(16, 185, 129, 0.15)';
            elFStatus.style.color = '#059669';
        } else if (fScore <= 70) {
            elFStatus.textContent = 'Elevado';
            elFStatus.style.background = 'rgba(245, 158, 11, 0.15)';
            elFStatus.style.color = '#d97706';
        } else {
            elFStatus.textContent = 'Exceso';
            elFStatus.style.background = 'rgba(239, 68, 68, 0.15)';
            elFStatus.style.color = '#dc2626';
        }
    }

    // Masas Reales (Masa Muscular y Grasa)
    const weightVal = parseFloat(inputs.weight) || 70;
    const smmVal = parseFloat(inputs.smm) || (data.smm ? parseFloat(data.smm) : (weightVal * (mScore / 100) * 0.45));
    const fatVal = parseFloat(inputs.fat_mass) || (data.fat_mass ? parseFloat(data.fat_mass) : (weightVal * (fScore / 100) * 0.28));

    const elMReal = document.getElementById('muscle-mass-real');
    const elMPct = document.getElementById('muscle-pct-real');
    if (elMReal) elMReal.textContent = smmVal > 0 ? `${smmVal.toFixed(1)} kg` : '-- kg';
    if (elMPct) elMPct.textContent = (smmVal > 0 && weightVal > 0) ? `(${(smmVal / weightVal * 100).toFixed(1)}%)` : '';

    const elFReal = document.getElementById('fat-mass-real');
    const elFPct = document.getElementById('fat-pct-real');
    if (elFReal) elFReal.textContent = fatVal > 0 ? `${fatVal.toFixed(1)} kg` : '-- kg';
    if (elFPct) elFPct.textContent = (fatVal > 0 && weightVal > 0) ? `(${(fatVal / weightVal * 100).toFixed(1)}%)` : '';

    // Ratio Músculo / Grasa
    const elRatio = document.getElementById('muscle-fat-ratio');
    const elRatioStatus = document.getElementById('muscle-fat-ratio-status');
    const elBalanceDesc = document.getElementById('body-balance-desc');

    if (smmVal > 0 && fatVal > 0) {
        const ratio = (smmVal / fatVal);
        if (elRatio) elRatio.textContent = ratio.toFixed(2);
        if (elRatioStatus) {
            if (ratio >= 2.0) {
                elRatioStatus.textContent = 'Excelente';
                elRatioStatus.className = 'badge bg-success-subtle text-success border';
            } else if (ratio >= 1.4) {
                elRatioStatus.textContent = 'Favorable';
                elRatioStatus.className = 'badge bg-success-subtle text-success border';
            } else if (ratio >= 1.0) {
                elRatioStatus.textContent = 'Equilibrado';
                elRatioStatus.className = 'badge bg-warning-subtle text-warning border';
            } else {
                elRatioStatus.textContent = 'Predominio Graso';
                elRatioStatus.className = 'badge bg-danger-subtle text-danger border';
            }
        }
        if (elBalanceDesc) {
            if (ratio >= 1.5) {
                elBalanceDesc.textContent = 'Predominio Músculo-Estructural';
                elBalanceDesc.className = 'text-success small fw-semibold';
            } else if (ratio >= 1.0) {
                elBalanceDesc.textContent = 'Balance Normotrófico';
                elBalanceDesc.className = 'text-primary small fw-semibold';
            } else {
                elBalanceDesc.textContent = 'Atención a Balance Adiposo';
                elBalanceDesc.className = 'text-danger small fw-semibold';
            }
        }
    } else {
        if (elRatio) elRatio.textContent = '--';
        if (elRatioStatus) elRatioStatus.textContent = 'Sin datos';
        if (elBalanceDesc) elBalanceDesc.textContent = 'Introduce SMM y Grasa para balance';
    }

    document.getElementById('res-value').textContent = inputs.resistance;
    document.getElementById('xc-value').textContent = inputs.reactance;
    document.getElementById('phase-value').textContent = data.phase_angle;

    // Calcular MJ (MegaJoules) -> 1 kcal = 0.004184 MJ
    const reeMj = (data.ree_kcal * 0.004184).toFixed(1);
    const teeMj = (data.tee_kcal * 0.004184).toFixed(2);
    const elReeMj = document.getElementById('ree-mj');
    const elTeeMj = document.getElementById('tee-mj');
    if (elReeMj) elReeMj.textContent = reeMj;
    if (elTeeMj) elTeeMj.textContent = teeMj;

    document.getElementById('pal-value').textContent = inputs.pal;
    drawPALGauge(inputs.pal);
    // Etiqueta de zona PAL
    const palZoneEl = document.getElementById('pal-zone');
    if (palZoneEl) {
        const p = parseFloat(inputs.pal) || 1.2;
        let zone = 'Sedentario';
        if (p >= 1.9) zone = 'Intenso';
        else if (p >= 1.6) zone = 'Moderado';
        else if (p >= 1.4) zone = 'Ligero';
        palZoneEl.textContent = zone;
        palZoneEl.style.color = (p >= 1.9) ? '#5A6F8C' : (p >= 1.6 ? '#27AE60' : (p >= 1.4 ? '#F2994A' : '#E65555'));
    }


    // 3. Hallazgos clínicos (motor de reglas) + hidratación/visceral
    const clinicalText = document.getElementById('clinical-text');
    let html = `<strong>Análisis integral:</strong> La puntuación global es de ${data.score}/100 (${data.rank}). `;
    html += `El ángulo de fase en ${data.phase_angle}° indica ${data.cell_status.toLowerCase()}. `;
    html += `Puntuación de masa muscular: ${data.muscle_score} pts. Puntuación de masa grasa: ${data.fat_score} pts.`;

    if (data.hydration && data.hydration.available) {
        html += `<br><br>💧 <strong>Hidratación:</strong> ${data.hydration.status}`;
        if (data.hydration.ecw_tbw_ratio) html += ` (ECW/TBW ${data.hydration.ecw_tbw_ratio}%)`;
    }
    if (data.visceral && data.visceral.available) {
        html += `<br>⚠️ <strong>Cintura/Visceral:</strong> ${data.visceral.status}`;
    }

    html += `<br><br><strong>Interpretación clínica:</strong><ul>`;
    (data.clinical_findings || []).forEach(f => { html += `<li>${f}</li>`; });
    html += `</ul>`;

    clinicalText.innerHTML = html;
    document.getElementById('hydration-tag').textContent = `💧 ${data.hydration_status}`;
    document.getElementById('cell-status').textContent = data.cell_status;

    // 4. Dibujar el gráfico BIVA en Canvas (normalizado por altura)
    drawBIVAVector(inputs.resistance, inputs.reactance, inputs.height, inputs.gender);

    // ===== FASE 4: tarjetas nuevas =====

    // CARD 6: Índices de composición
    const ci = data.composition_indices;
    if (ci && ci.available) {
        showGrid('ci-na', 'ci-grid');
        document.getElementById('ci-imc').textContent = ci.imc ?? '--';
        setChip(document.getElementById('ci-imc-status'), ci.imc_status);
        document.getElementById('ci-fmi').textContent = ci.fmi ?? '--';
        setChip(document.getElementById('ci-fmi-status'), ci.fmi_status);
        document.getElementById('ci-ffmi').textContent = ci.ffmi ?? '--';
        setChip(document.getElementById('ci-ffmi-status'), ci.ffmi_status);
        document.getElementById('ci-fm-pct').textContent = ci.fm_pct ?? '--';
        setChip(document.getElementById('ci-fm-pct-status'), ci.fm_pct_status);
        document.getElementById('ci-smi').textContent = ci.smi ?? '--';
        setChip(document.getElementById('ci-smi-status'), ci.smi_status);
    }

    // CARD 7: Músculo segmental
    const seg = data.segmental;
    if (seg && seg.segments && Object.keys(seg.segments).length) {
        showGrid('seg-na', 'seg-grid');
        const map = { arm_right: 'seg-arm-r', arm_left: 'seg-arm-l', torso: 'seg-torso', leg_right: 'seg-leg-r', leg_left: 'seg-leg-l' };
        for (const [key, prefix] of Object.entries(map)) {
            const s = seg.segments[key];
            const valEl = document.getElementById(`${prefix}-val`);
            const dotEl = document.getElementById(`${prefix}-status`);
            if (!valEl || !dotEl) continue;
            if (s && s.available) {
                valEl.textContent = `${s.value} kg`;
                dotEl.className = `status-dot ${s.light}`;
            } else {
                valEl.textContent = '--';
                dotEl.className = 'status-dot';
            }
        }
        const asym = document.getElementById('seg-asym');
        if (seg.asymmetries && seg.asymmetries.length) {
            asym.style.display = 'block';
            asym.innerHTML = seg.asymmetries.map(a => `⚠️ ${a.message}`).join('<br>');
        } else {
            asym.style.display = 'none';
        }
    }

    // CARD 8: Percentiles vs edad
    let pctAvailable = false;
    const pctGrid = document.getElementById('pct-grid');
    const pctNa = document.getElementById('pct-na');
    if (data.phase_percentile) {
        pctAvailable = true;
        document.getElementById('ph-pct-val').textContent = `P${data.phase_percentile}`;
        document.getElementById('ph-pct-bar').style.width = `${data.phase_percentile}%`;
        if (data.pha_curves) drawPhACurve(data.pha_curves, inputs.age, data.phase_angle);
    }
    if (data.smm_percentile) {
        pctAvailable = true;
        document.getElementById('smm-pct-val').textContent = `P${data.smm_percentile}`;
        document.getElementById('smm-pct-bar').style.width = `${data.smm_percentile}%`;
    }
    if (pctAvailable) { pctNa.style.display = 'none'; pctGrid.style.display = 'block'; }
    // Curva SMM × edad (Módulo 6) si hay SMM y curvas disponibles
    if (data.smm_curves && data.smm_curves.ages) {
        drawSMMCurve(data.smm_curves, data.inputs_echo?.age, parseFloat(inputs.smm) || null);
    }

    // CARD 9: Análisis hídrico
    const hyd = data.hydration;
    if (hyd && hyd.available) {
        showGrid('water-na', 'water-grid');
        const tbw = parseFloat(hyd.tbw) || 0;
        const ecw = parseFloat(hyd.ecw) || 0;
        const icwVal = hyd.icw != null ? hyd.icw : (tbw >= ecw && tbw > 0 ? (tbw - ecw).toFixed(1) : '--');

        const elTbw = document.getElementById('water-tbw');
        const elIcw = document.getElementById('water-icw');
        const elEcw = document.getElementById('water-ecw');
        const elRatio = document.getElementById('water-ratio');
        if (elTbw) elTbw.textContent = hyd.tbw ?? '--';
        if (elIcw) elIcw.textContent = icwVal;
        if (elEcw) elEcw.textContent = hyd.ecw ?? '--';

        const ratioVal = hyd.ecw_tbw_ratio != null ? hyd.ecw_tbw_ratio : (tbw > 0 ? ((ecw / tbw) * 100).toFixed(1) : null);
        if (elRatio) elRatio.textContent = ratioVal != null ? `${ratioVal}%` : '--';

        const wStatus = document.getElementById('water-status');
        setChip(wStatus, hyd.alert ? ['Alerta', 'red'] : [hyd.status || 'Normal', 'green']);

        // Actualizar Recuadro de Interpretación Clínica Hídrica
        const diagTitle = document.getElementById('water-diag-title');
        const diagDesc = document.getElementById('water-diag-desc');
        const diagBox = document.getElementById('water-diag-box');

        const ratioNum = ratioVal != null ? parseFloat(ratioVal) : 0;
        if (diagTitle && diagDesc) {
            if (ratioNum < 39.0) {
                diagTitle.innerHTML = `<i class="bi bi-check-circle-fill text-success me-1"></i> <span class="text-success fw-bold">Hidratación Intracelular Óptima</span>`;
                diagDesc.textContent = `Equilibrio hídrico en rango fisiológico ideal. Buen volumen de agua intracelular (ICW: ${icwVal} L) para la función metabólica y celular sin edemas.`;
                if (diagBox) diagBox.className = 'p-2.5 rounded-3 border border-success-subtle bg-success-subtle/10 text-secondary text-xs';
            } else if (ratioNum <= 42.0) {
                diagTitle.innerHTML = `<i class="bi bi-info-circle-fill text-info me-1"></i> <span class="text-info fw-bold">Distribución Hídrica Saludable</span>`;
                diagDesc.textContent = `Distribución de agua dentro de los parámetros esperados (ECW/TBW: ${ratioNum}%). Volemia celular e intersticial estables.`;
                if (diagBox) diagBox.className = 'p-2.5 rounded-3 border border-info-subtle bg-info-subtle/10 text-secondary text-xs';
            } else if (ratioNum <= 45.0) {
                diagTitle.innerHTML = `<i class="bi bi-exclamation-triangle-fill text-warning me-1"></i> <span class="text-warning-emphasis fw-bold">Sobrecarga Extracelular Leve</span>`;
                diagDesc.textContent = `Ligera acumulación de líquido extracelular (ECW: ${hyd.ecw} L). Puede deberse a sobrecarga de sodio, fatiga muscular o retención hídrica transitoria.`;
                if (diagBox) diagBox.className = 'p-2.5 rounded-3 border border-warning-subtle bg-warning-subtle/10 text-secondary text-xs';
            } else {
                diagTitle.innerHTML = `<i class="bi bi-exclamation-octagon-fill text-danger me-1"></i> <span class="text-danger fw-bold">Alerta de Edema / Retención Significativa</span>`;
                diagDesc.textContent = `Proporción de líquido extracelular elevada (${ratioNum}%). Se sugiere evaluar inflamación sistémica, sobrecarga intersticial o edematización.`;
                if (diagBox) diagBox.className = 'p-2.5 rounded-3 border border-danger-subtle bg-danger-subtle/10 text-secondary text-xs';
            }
        }
    }

    // CARD 10: Cintura & Visceral
    const vis = data.visceral;
    const waistInput = inputs.waist;
    const viscInput = inputs.visceral_fat != null ? inputs.visceral_fat : inputs.visceral;
    const gender = (inputs.gender || 'male').toLowerCase();
    const isFemale = gender === 'female';

    if ((vis && vis.available) || (waistInput != null && waistInput !== '') || (viscInput != null && viscInput !== '')) {
        showGrid('waist-na', 'waist-grid');
        
        // 1. Perímetro de Cintura
        const wValEl = document.getElementById('waist-val');
        const wStatus = document.getElementById('waist-status');
        const wRefLabel = document.getElementById('waist-ref-label');
        const overallBadge = document.getElementById('waist-overall-badge');
        
        let hasWaistAlert = false;
        if (waistInput != null && waistInput !== '') {
            const waistNum = parseFloat(waistInput);
            if (wValEl) wValEl.textContent = isNaN(waistNum) ? waistInput : waistNum.toFixed(1);
            
            // Pin: escala 50–130 cm -> 0–100%
            const pct = Math.max(0, Math.min(100, ((waistNum - 50) / 80) * 100));
            const waistPin = document.getElementById('waist-pin');
            if (waistPin) waistPin.style.left = `${pct}%`;

            const cutoffWarn = isFemale ? 80 : 94;
            const cutoffHigh = isFemale ? 88 : 102;
            
            if (wRefLabel) {
                wRefLabel.textContent = isFemale 
                    ? 'Corte OMS: <80 cm (Normal) / ≥88 cm (Riesgo)' 
                    : 'Corte OMS: <94 cm (Normal) / ≥102 cm (Riesgo)';
            }

            if (waistNum >= cutoffHigh) {
                hasWaistAlert = true;
                setChip(wStatus, ['Riesgo Alto', 'red']);
            } else if (waistNum >= cutoffWarn) {
                setChip(wStatus, ['Límite / Alerta', 'yellow']);
            } else {
                setChip(wStatus, ['Rango Normal', 'green']);
            }
        } else {
            if (wValEl) wValEl.textContent = '--';
            if (wStatus) {
                wStatus.textContent = 'No registrado';
                wStatus.className = 'status-chip muted';
            }
            if (wRefLabel) wRefLabel.textContent = 'Sin medición';
        }

        // 2. Grasa Visceral
        const viscValEl = document.getElementById('visc-val');
        const viscBadge = document.getElementById('visc-badge');
        const viscStatusText = document.getElementById('visc-status-text');

        if (viscInput != null && viscInput !== '') {
            const viscNum = parseFloat(viscInput);
            if (viscValEl) viscValEl.textContent = isNaN(viscNum) ? viscInput : viscNum.toFixed(1);
            
            const isViscAlert = vis?.visceral_alert || (viscNum >= (isFemale ? 1.5 : 2.5) || viscNum >= 10);
            
            if (isViscAlert) {
                if (viscBadge) {
                    viscBadge.textContent = 'Nivel Aumentado';
                    viscBadge.className = 'badge rounded-pill text-xs fw-bold px-2 py-0.5 bg-danger-subtle text-danger border border-danger border-opacity-25';
                }
                if (viscStatusText) {
                    viscStatusText.innerHTML = `⚠️ <strong>Alerta Metabólica:</strong> Nivel visceral elevado (${viscNum}). Sugiere infiltración adiposa intraabdominal y mayor riesgo cardiometabólico.`;
                }
                hasWaistAlert = true;
            } else {
                if (viscBadge) {
                    viscBadge.textContent = 'Nivel Saludable';
                    viscBadge.className = 'badge rounded-pill text-xs fw-bold px-2 py-0.5 bg-success-subtle text-success border border-success border-opacity-25';
                }
                if (viscStatusText) {
                    viscStatusText.innerHTML = `✅ <strong>Óptimo:</strong> Grasa visceral en rango fisiológico seguro. Baja carga lipídica periorgánica.`;
                }
            }
        } else {
            if (viscValEl) viscValEl.textContent = '--';
            if (viscBadge) {
                viscBadge.textContent = 'Sin datos';
                viscBadge.className = 'badge rounded-pill text-xs fw-normal px-2 py-0.5 bg-light text-muted border';
            }
            if (viscStatusText) {
                viscStatusText.textContent = 'Introduce el nivel visceral del dispositivo para evaluar el tejido adiposo profundo.';
            }
        }

        // Overall Card Badge
        if (overallBadge) {
            if (hasWaistAlert) {
                overallBadge.textContent = 'Alerta Metabólica';
                overallBadge.className = 'badge rounded-pill text-xs fw-semibold px-2 py-0.5 bg-danger text-white shadow-2xs';
            } else {
                overallBadge.textContent = 'Riesgo Bajo / Óptimo';
                overallBadge.className = 'badge rounded-pill text-xs fw-semibold px-2 py-0.5 bg-success text-white shadow-2xs';
            }
        }
    } else {
        const waistNa = document.getElementById('waist-na');
        const waistGrid = document.getElementById('waist-grid');
        if (waistNa) waistNa.style.display = 'block';
        if (waistGrid) waistGrid.style.display = 'none';
    }

    // CARD 11: BCC
    const bcc = data.bcc;
    if (bcc && bcc.available) {
        showGrid('bcc-na', 'bcc-grid');
        
        const mPct = bcc.muscle_pct || 0;
        const fPct = bcc.fat_pct || 0;
        
        const elM = document.getElementById('bcc-muscle-val');
        const elF = document.getElementById('bcc-fat-val');
        if (elM) elM.textContent = `${mPct.toFixed(1)}%`;
        if (elF) elF.textContent = `${fPct.toFixed(1)}%`;

        // Clasificación de Cuadrante para la explicación médica
        const isMale = (inputs.gender || 'male').toLowerCase() !== 'female';
        const normMuscleMin = isMale ? 37 : 29;
        const normFatMax = isMale ? 22 : 28;

        const summaryBadge = document.getElementById('bcc-summary-badge');
        const diagTitle = document.getElementById('bcc-diagnosis-title');
        const diagDesc = document.getElementById('bcc-diagnosis-desc');

        if (mPct >= normMuscleMin && fPct <= normFatMax) {
            // Cuadrante I: Atlético
            if (summaryBadge) { summaryBadge.textContent = 'I. Atlético / Robusto'; summaryBadge.className = 'badge rounded-pill text-xs fw-semibold px-2 py-0.5 bg-success text-white'; }
            if (diagTitle) diagTitle.textContent = 'Somatotipo I: Atlético / Protección Sarcopénica';
            if (diagDesc) diagDesc.textContent = 'Alta reserva proteica y bajo porcentaje graso. Excelente fuerza muscular, tasa metabólica basal activa y óptima sensibilidad a la insulina.';
        } else if (mPct >= (normMuscleMin - 3) && fPct <= (normFatMax + 3)) {
            // Cuadrante II: Equilibrado
            if (summaryBadge) { summaryBadge.textContent = 'II. Equilibrado / Normal'; summaryBadge.className = 'badge rounded-pill text-xs fw-semibold px-2 py-0.5 bg-primary text-white'; }
            if (diagTitle) diagTitle.textContent = 'Somatotipo II: Composición Corporal Armónica';
            if (diagDesc) diagDesc.textContent = 'Proporción equilibrada entre masa muscular y masa grasa. Cumple con los requerimientos somáticos funcionales para su grupo etario.';
        } else if (fPct > normFatMax && mPct >= (normMuscleMin - 4)) {
            // Cuadrante III: Predominio Adiposo
            if (summaryBadge) { summaryBadge.textContent = 'III. Predominio Adiposo'; summaryBadge.className = 'badge rounded-pill text-xs fw-semibold px-2 py-0.5 bg-warning text-dark'; }
            if (diagTitle) diagTitle.textContent = 'Somatotipo III: Sobrepeso / Adiposidad Aumentada';
            if (diagDesc) diagDesc.textContent = 'Exceso relativo de tejido graso con masa muscular conservada. Se sugiere pauta de déficit energético moderado y estímulo de fuerza.';
        } else {
            // Cuadrante IV: Sarcopénico / Sarcopenia Obesa
            if (summaryBadge) { summaryBadge.textContent = 'IV. Riesgo Sarcopénico'; summaryBadge.className = 'badge rounded-pill text-xs fw-semibold px-2 py-0.5 bg-danger text-white'; }
            if (diagTitle) diagTitle.textContent = 'Somatotipo IV: Déficit Muscular / Riesgo de Sarcopenia';
            if (diagDesc) diagDesc.textContent = 'Masa muscular esquelética por debajo de valores de referencia con relación grasa desfavorable. Priorizar intervención proteica y entrenamiento resistido.';
        }

        drawBCC(mPct, fPct, isMale);
    }
}

function drawBIVAVector(R, Xc, height, gender) {
    const canvas = document.getElementById('bivaCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const centerX = w / 2;
    const centerY = h / 2;

    // Limpiar
    ctx.clearRect(0, 0, w, h);

    // --- Dibujar ejes principales (Cruz) ---
    ctx.strokeStyle = '#9ca3af'; // Gris medio-claro
    ctx.lineWidth = 1;
    // Eje X (Horizontal)
    ctx.beginPath(); ctx.moveTo(20, centerY); ctx.lineTo(w - 20, centerY); ctx.stroke();
    // Eje Y (Vertical)
    ctx.beginPath(); ctx.moveTo(centerX, 20); ctx.lineTo(centerX, h - 20); ctx.stroke();

    // Etiquetas de los ejes
    ctx.fillStyle = '#4b5563'; // Gris oscuro
    ctx.font = '12px Inter';
    ctx.fillText('Z(R/H)', w - 60, centerY - 8);
    ctx.fillText('Z(Xc/H)', centerX - 25, 18);

    // --- Dibujar Ejes Diagonales con flechas ---
    // Helper para flechas
    function drawArrowLine(x1, y1, x2, y2) {
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        const angle = Math.atan2(y2 - y1, x2 - x1);
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - 8 * Math.cos(angle - Math.PI / 6), y2 - 8 * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(x2 - 8 * Math.cos(angle + Math.PI / 6), y2 - 8 * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fillStyle = '#6b7280';
        ctx.fill();
    }

    ctx.strokeStyle = '#6b7280';
    // Diagonal 1 (Agua): De arriba-derecha a abajo-izquierda
    drawArrowLine(centerX + 120, centerY - 120, centerX - 120, centerY + 120);
    // Diagonal 2 (Masa Celular): De abajo-derecha a arriba-izquierda
    drawArrowLine(centerX + 80, centerY + 80, centerX - 110, centerY - 110);

    // Etiquetas de diagonales
    ctx.fillText('agua', centerX - 145, centerY + 125);
    ctx.fillText('Masa Celular', centerX - 130, centerY - 120);
    ctx.fillText('Porcentaje', centerX + 125, centerY - 125);

    // --- Dibujar Elipses (Rotadas ~45 grados) ---
    // Ángulo de rotación típico en BIVA (aprox -45° a -50°)
    const rot = -45 * Math.PI / 180;

    function drawEllipse(rx, ry, fillStyle, strokeStyle) {
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(rot);
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, 2 * Math.PI);
        if (fillStyle) {
            ctx.fillStyle = fillStyle;
            ctx.fill();
        }
        if (strokeStyle) {
            ctx.strokeStyle = strokeStyle;
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        ctx.restore();
    }

    // 1. Elipse Exterior (solo borde)
    drawEllipse(130, 50, null, '#9ca3af');
    // 2. Elipse Media (relleno gris-azulado)
    drawEllipse(100, 38, 'rgba(156, 163, 175, 0.3)', '#9ca3af');
    // 3. Elipse Interior (relleno verde)
    drawEllipse(70, 25, 'rgba(134, 175, 142, 0.6)', '#7a9f82');

    // --- Normalización y Punto del Paciente ---
    const hM = (height || 170) / 100.0;
    const rH = R / hM;
    const xcH = Xc / hM;

    // Mapeo inverso de valores a píxeles (R: 200-600, Xc: 20-100)
    // Para que el centro (centerX, centerY) coincida con los valores medios poblacionales (~400, ~50)
    const px = centerX + ((rH - 400) / 200) * 120;
    const py = centerY - ((xcH - 50) / 40) * 120;

    // Dibujar SOLO el punto oscuro (sin vector/línea)
    ctx.beginPath();
    ctx.arc(px, py, 9, 0, 2 * Math.PI);
    ctx.fillStyle = '#374151'; // Gris muy oscuro / negro suave
    ctx.fill();
    ctx.strokeStyle = '#9ca3af'; // Borde gris claro
    ctx.lineWidth = 2.5;
    ctx.stroke();
}

// --- 4b. CURVA SMM × EDAD (Módulo 6) ---
function drawSMMCurve(curves, patientAge, patientSMM) {
    const canvas = document.getElementById('smmCurveCanvas');
    if (!canvas || !curves) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const ages = curves.ages;
    const aMin = Math.min(...ages), aMax = Math.max(...ages);
    const allVals = [].concat(curves.p5, curves.p25, curves.p50, curves.p75, curves.p95, [patientSMM || 0]);
    const vMin = Math.min(...allVals) - 3, vMax = Math.max(...allVals) + 3;

    const padL = 34, padR = 14, padT = 14, padB = 22;
    const plotW = w - padL - padR, plotH = h - padT - padB;
    const xOf = (age) => padL + ((age - aMin) / (aMax - aMin || 1)) * plotW;
    const yOf = (val) => padT + plotH - ((val - vMin) / (vMax - vMin || 1)) * plotH;

    // Grid suave
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, padT + plotH / 2); ctx.lineTo(padL + plotW, padT + plotH / 2);
    ctx.moveTo(padL + plotW / 2, padT); ctx.lineTo(padL + plotW / 2, padT + plotH);
    ctx.stroke();

    // Ejes
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); 
    ctx.moveTo(padL, padT); 
    ctx.lineTo(padL, padT + plotH); 
    ctx.lineTo(padL + plotW, padT + plotH); 
    ctx.stroke();

    // Curvas de referencia (P5, P25, P50, P75, P95)
    const series = [
        { key: 'p5', color: 'rgba(239, 68, 68, 0.55)', width: 1.2, dash: [3, 3] },
        { key: 'p25', color: 'rgba(245, 158, 11, 0.65)', width: 1.2, dash: [4, 3] },
        { key: 'p50', color: '#1A2A4A', width: 2.2, dash: [] },
        { key: 'p75', color: 'rgba(245, 158, 11, 0.65)', width: 1.2, dash: [4, 3] },
        { key: 'p95', color: 'rgba(239, 68, 68, 0.55)', width: 1.2, dash: [3, 3] }
    ];
    series.forEach(s => {
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.width;
        ctx.setLineDash(s.dash);
        ctx.beginPath();
        ages.forEach((age, i) => {
            const x = xOf(age), y = yOf(curves[s.key][i]);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.setLineDash([]);
    });

    // Punto del paciente
    if (patientSMM && patientAge >= aMin && patientAge <= aMax) {
        const px = xOf(patientAge), py = yOf(patientSMM);
        // Halo
        ctx.beginPath();
        ctx.arc(px, py, 10, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(px, py, 5.5, 0, 2 * Math.PI);
        ctx.fillStyle = '#10b981';
        ctx.shadowColor = 'rgba(16, 185, 129, 0.6)';
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // Etiquetas
    ctx.fillStyle = '#64748b';
    ctx.font = '10px Inter, sans-serif';
    ctx.fillText(aMin + 'a', padL, h - 6);
    ctx.fillText(aMax + 'a', padL + plotW - 20, h - 6);
    ctx.fillText(Math.round(vMax) + 'kg', 4, padT + 6);
    ctx.fillText(Math.round(vMin) + 'kg', 4, padT + plotH);
}

// --- 4c. VELOCÍMETRO PAL (Módulo 7) ---
function drawPALGauge(pal) {
    const canvas = document.getElementById('palGaugeCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // cy y radius perfectamente proporcionados para que el arco y la aguja nunca se recorten
    const cx = w / 2;
    const cy = h - 55;
    const radius = 100;

    const START = Math.PI * 0.85;
    const END = Math.PI * 2.15;
    const ANG = END - START;

    const PAL_MIN = 1.2, PAL_MAX = 2.5;
    const clamp = (v) => Math.max(PAL_MIN, Math.min(PAL_MAX, v || PAL_MIN));
    const angOf = (v) => START + ((clamp(v) - PAL_MIN) / (PAL_MAX - PAL_MIN)) * ANG;

    // Arco base tenue (fondo)
    ctx.beginPath();
    ctx.arc(cx, cy, radius, START, END);
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 14;
    ctx.stroke();

    // Zonas de color más vibrantes
    const zones = [
        { from: 1.2, to: 1.4, color: '#E65555' }, // Sedentario (Rojo vibrante)
        { from: 1.4, to: 1.6, color: '#F2994A' }, // Ligero (Naranja vibrante)
        { from: 1.6, to: 1.9, color: '#27AE60' }, // Moderado (Verde vibrante)
        { from: 1.9, to: 2.5, color: '#5A6F8C' }  // Intenso (Azul pizarra)
    ];

    zones.forEach((z) => {
        ctx.beginPath();
        // Se suma un pelín al ángulo final para evitar brechas de 1px entre colores
        ctx.arc(cx, cy, radius, angOf(z.from), angOf(z.to) + 0.02);
        ctx.strokeStyle = z.color;
        ctx.lineWidth = 14;
        ctx.lineCap = 'butt';
        ctx.stroke();
    });

    // Aguja (Diseño elegante tipo poligonal)
    const ang = angOf(pal);
    const needleLength = radius - 15;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(0, -3.5); // base (izquierda)
    ctx.lineTo(needleLength, 0); // punta
    ctx.lineTo(0, 3.5); // base (derecha)
    ctx.fillStyle = '#1A2A4A';
    ctx.fill();
    ctx.restore();

    // Eje central (pivote con detalle blanco)
    ctx.beginPath();
    ctx.arc(cx, cy, 6.5, 0, 2 * Math.PI);
    ctx.fillStyle = '#1A2A4A';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, 2, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.textAlign = 'left';
}

// --- 3.5 AUTOCOMPLETADO Y ASIGNACIÓN AUTOMÁTICA DE IDP EN BIA Y CLIENTES ---
function getNextAvailableIDP() {
    if (!allClientsData || allClientsData.length === 0) {
        return 'IDP-0001';
    }
    const existingCodes = allClientsData
        .map(c => {
            if (c.code) return parseInt(c.code);
            if (c.idp && c.idp.startsWith('IDP-')) return parseInt(c.idp.replace('IDP-', ''));
            return null;
        })
        .filter(n => typeof n === 'number' && !isNaN(n) && n > 0)
        .sort((a, b) => a - b);

    let nextCode = 1;
    for (const code of existingCodes) {
        if (code === nextCode) {
            nextCode++;
        } else if (code > nextCode) {
            break; // Se encontró un hueco reciclado disponible
        }
    }
    return `IDP-${String(nextCode).padStart(4, '0')}`;
}

function initBioClientAutocomplete() {
    const inputName = document.getElementById('input-name');
    const inputIdp = document.getElementById('input-idp');

    function populateDatalists() {
        const datalistName = document.getElementById('clients-name-datalist');
        const datalistAppt = document.getElementById('clients-datalist');

        if (datalistName) datalistName.innerHTML = '';
        if (datalistAppt) datalistAppt.innerHTML = '';

        allClientsData.forEach(c => {
            if (c.name) {
                if (datalistName) {
                    const opt = document.createElement('option');
                    opt.value = c.name;
                    opt.textContent = `${c.name} ${c.idp ? '(IDP: ' + c.idp + ')' : ''}`;
                    datalistName.appendChild(opt);
                }
                if (datalistAppt) {
                    const opt = document.createElement('option');
                    opt.value = c.name;
                    datalistAppt.appendChild(opt);
                }
            }
        });

        // Actualizar campo IDP inicial en Bioimpedancia
        updateBioIDPField();
    }

    function updateBioIDPField() {
        if (!inputIdp) return;
        const currentName = (inputName ? inputName.value.trim().toLowerCase() : '');
        if (!currentName) {
            inputIdp.value = getNextAvailableIDP();
            return;
        }
        const match = allClientsData.find(c => (c.name || '').toLowerCase() === currentName);
        if (match) {
            inputIdp.value = match.idp || ('IDP-' + String(match.code || 1).padStart(4, '0'));
        } else {
            inputIdp.value = getNextAvailableIDP();
        }
    }

    if (inputName) {
        inputName.addEventListener('input', () => {
            updateBioIDPField();
        });

        inputName.addEventListener('change', () => {
            const val = inputName.value.trim().toLowerCase();
            if (!val) {
                if (inputIdp) inputIdp.value = getNextAvailableIDP();
                return;
            }
            const match = allClientsData.find(c => (c.name || '').toLowerCase() === val);
            if (match) {
                fillBioFormFromClient(match);
                showToast(`Datos de ${match.name} completados automáticamente (${match.idp || 'IDP auto'})`, 'info');
            } else {
                updateBioIDPField();
            }
        });
    }

    // Inicializar al cargar
    updateBioIDPField();

    window.updateBioDatalists = populateDatalists;
    window.getNextAvailableIDP = getNextAvailableIDP;
}

function fillBioFormFromClient(c) {
    const nextIdp = c.idp || ('IDP-' + String(c.code || 1).padStart(4, '0'));
    if (document.getElementById('input-idp')) document.getElementById('input-idp').value = nextIdp;
    if (c.name && document.getElementById('input-name')) document.getElementById('input-name').value = c.name;
    if (c.age && document.getElementById('input-age')) document.getElementById('input-age').value = c.age;
    if (c.gender && document.getElementById('input-gender')) {
        const gVal = (c.gender === 'Femenino' || c.gender === 'female') ? 'female' : 'male';
        document.getElementById('input-gender').value = gVal;
    }
    if (c.height && document.getElementById('input-height')) document.getElementById('input-height').value = c.height;
}

// --- 3.6 MENSAJERÍA DIRECTA AL PACIENTE (WHATSAPP & CORREO) ---
let currentMsgPatient = null;
let currentMsgEval = null;
let currentMsgTemplate = 'results';

function initPatientMessaging() {
    const modal = document.getElementById('patient-message-modal');
    if (!modal) return;

    const btnClose = document.getElementById('msg-modal-close');
    const btnCancel = document.getElementById('msg-btn-cancel');
    const btnWhatsapp = document.getElementById('msg-btn-whatsapp');
    const btnEmail = document.getElementById('msg-btn-email');
    const chkAttach = document.getElementById('msg-attach-eval');
    const textarea = document.getElementById('msg-textarea');

    const closeModal = () => {
        modal.classList.add('hidden');
        modal.style.display = 'none';
        currentMsgPatient = null;
        currentMsgEval = null;
    };

    if (btnClose) btnClose.addEventListener('click', closeModal);
    if (btnCancel) btnCancel.addEventListener('click', closeModal);

    // Click fuera del modal para cerrar
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Selector de plantillas
    document.querySelectorAll('.msg-tpl-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.msg-tpl-btn').forEach(b => {
                b.classList.remove('active', 'btn-outline-primary');
                b.classList.add('btn-outline-secondary');
            });
            btn.classList.add('active', 'btn-outline-primary');
            btn.classList.remove('btn-outline-secondary');
            currentMsgTemplate = btn.dataset.template || 'results';
            updateMessageText();
        });
    });

    // Cambio en toggle de métricas
    if (chkAttach) {
        chkAttach.addEventListener('change', () => {
            updateMessageText();
        });
    }

    // Botón Enviar WhatsApp
    if (btnWhatsapp) {
        btnWhatsapp.addEventListener('click', () => {
            if (!currentMsgPatient) return;
            const text = textarea ? textarea.value.trim() : '';
            if (!text) {
                showToast('El mensaje no puede estar vacío', 'error');
                return;
            }

            let phone = (currentMsgPatient.phone || '').replace(/[^\d+]/g, '');
            if (!phone) {
                // Pedir número si no lo tiene
                const promptPhone = prompt(`Ingresa el número de WhatsApp para ${currentMsgPatient.name} (con código de país, ej: +5491112345678):`);
                if (!promptPhone) return;
                phone = promptPhone.replace(/[^\d+]/g, '');
            }

            // Formatear para WhatsApp API (sin el '+')
            const cleanPhone = phone.replace(/^\+/, '');
            const waUrl = `https://api.whatsapp.com/send?phone=${encodeURIComponent(cleanPhone)}&text=${encodeURIComponent(text)}`;
            window.open(waUrl, '_blank');
            showToast(`Abriendo WhatsApp para ${currentMsgPatient.name}`, 'success');
            closeModal();
        });
    }

    // Botón Enviar Correo
    if (btnEmail) {
        btnEmail.addEventListener('click', () => {
            if (!currentMsgPatient) return;
            const text = textarea ? textarea.value.trim() : '';
            if (!text) {
                showToast('El mensaje no puede estar vacío', 'error');
                return;
            }

            let email = currentMsgPatient.email || '';
            if (!email) {
                const promptEmail = prompt(`Ingresa el correo electrónico para ${currentMsgPatient.name}:`);
                if (!promptEmail) return;
                email = promptEmail.trim();
            }

            const subject = 'Informe de Evaluación de Bioimpedancia - VitaMetrix';
            const mailUrl = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
            window.location.href = mailUrl;
            showToast(`Generando correo para ${currentMsgPatient.name}`, 'info');
            closeModal();
        });
    }
}

function openPatientMessageModal(client, evaluation = null) {
    currentMsgPatient = client;
    currentMsgEval = evaluation;

    const modal = document.getElementById('patient-message-modal');
    if (!modal) return;

    document.getElementById('msg-patient-name').textContent = client.name || 'Paciente';
    
    const phoneEl = document.getElementById('msg-patient-phone');
    if (phoneEl) {
        phoneEl.innerHTML = client.phone ? `<i class="bi bi-whatsapp text-success me-1"></i> ${client.phone}` : '<i class="bi bi-whatsapp text-muted me-1"></i> Sin teléfono';
    }

    const emailEl = document.getElementById('msg-patient-email');
    if (emailEl) {
        emailEl.innerHTML = client.email ? `<i class="bi bi-envelope text-primary me-1"></i> ${client.email}` : '<i class="bi bi-envelope text-muted me-1"></i> Sin correo';
    }

    const badgeEl = document.getElementById('msg-eval-badge');
    if (badgeEl) {
        badgeEl.textContent = evaluation ? `TRU Score: ${evaluation.global_score ?? '--'}/100` : 'Sin evaluación previa';
    }

    currentMsgTemplate = 'results';
    document.querySelectorAll('.msg-tpl-btn').forEach(btn => {
        const isResults = btn.dataset.template === 'results';
        btn.classList.toggle('active', isResults);
        btn.classList.toggle('btn-outline-primary', isResults);
        btn.classList.toggle('btn-outline-secondary', !isResults);
    });

    updateMessageText();

    modal.classList.remove('hidden');
    modal.style.display = 'flex';
}

function updateMessageText() {
    if (!currentMsgPatient) return;
    const p = currentMsgPatient;
    const ev = currentMsgEval;
    const attachEval = document.getElementById('msg-attach-eval') ? document.getElementById('msg-attach-eval').checked : true;
    const clinicName = localStorage.getItem('vm_clinic_name') || 'Centro Médico VitaMetrix';
    const doctorName = localStorage.getItem('vm_user_name') || 'Dra. Audrey';

    let text = '';
    if (currentMsgTemplate === 'results') {
        text += `¡Hola ${p.name}! 👋\n\n`;
        text += `Te compartimos el informe de tu evaluación de composición corporal realizada en *${clinicName}*:\n\n`;
        
        if (ev && attachEval) {
            const dateStr = ev.created_at ? new Date(ev.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Reciente';
            text += `📅 *Fecha de Evaluación:* ${dateStr}\n`;
            if (ev.global_score !== undefined && ev.global_score !== null) {
                text += `📊 *TRU Body Score:* ${ev.global_score}/100\n`;
            }
            if (ev.smm) {
                text += `💪 *Masa Muscular Esquelética (SMM):* ${ev.smm} kg\n`;
            }
            if (ev.fat_mass) {
                text += `⚡ *Masa Grasa:* ${ev.fat_mass} kg\n`;
            }
            if (ev.phase_angle) {
                text += `🔬 *Ángulo de Fase (PhA):* ${ev.phase_angle}°\n`;
            }
            if (ev.cell_status) {
                text += `🩺 *Estado Celular:* ${ev.cell_status}\n`;
            }
            text += `\n`;
        }
        text += `¡Felicitaciones por tu compromiso! Seguimos a tu disposición para cualquier consulta.\n\n`;
        text += `Atentamente,\n*${doctorName}*\n${clinicName}`;
    } else if (currentMsgTemplate === 'reminder') {
        text += `¡Hola ${p.name}! 👋\n\n`;
        text += `Te saludamos desde *${clinicName}*.\n\n`;
        text += `Te recordamos que es momento de agendar tu siguiente *control periódico de bioimpedancia* para evaluar la evolución de tu masa muscular, grasa e hidratación.\n\n`;
        text += `Responde a este mensaje para coordinar el día y horario que mejor te convenga. 📅\n\n`;
        text += `¡Que tengas un excelente día!\n*${doctorName}*`;
    } else {
        text += `¡Hola ${p.name}! 👋\n\n`;
        text += `Te escribimos desde *${clinicName}*.\n\n`;
        if (ev && attachEval && ev.global_score) {
            text += `📊 Tu último TRU Body Score registrado fue de *${ev.global_score}/100*.\n\n`;
        }
        text += `[Escribe tu mensaje personalizado aquí]\n\n`;
        text += `Saludos cordiales,\n*${doctorName}*`;
    }

    const textarea = document.getElementById('msg-textarea');
    if (textarea) textarea.value = text;
}

// --- 3.7 MODAL DE HISTORIAL DE EVALUACIONES DE UN PACIENTE ---
let currentHistPatient = null;

function initPatientHistoryModal() {
    const modal = document.getElementById('patient-history-modal');
    if (!modal) return;

    const btnClose = document.getElementById('hist-modal-close');
    const btnFooterClose = document.getElementById('hist-modal-btn-close');
    const btnNewEval = document.getElementById('hist-btn-new-eval');

    const closeModal = () => {
        modal.classList.add('hidden');
        modal.style.display = 'none';
        currentHistPatient = null;
    };

    if (btnClose) btnClose.addEventListener('click', closeModal);
    if (btnFooterClose) btnFooterClose.addEventListener('click', closeModal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    if (btnNewEval) {
        btnNewEval.addEventListener('click', () => {
            if (!currentHistPatient) return;
            const targetPatient = currentHistPatient;
            closeModal();
            const bioNav = document.querySelector('[data-target="bio-view"]');
            if (bioNav) bioNav.click();
            fillBioFormFromClient(targetPatient);
            document.getElementById('input-r').focus();
            showToast(`Ficha de ${targetPatient.name} cargada en calculadora`, 'info');
        });
    }
}

function openPatientHistoryModal(client) {
    currentHistPatient = client;
    const modal = document.getElementById('patient-history-modal');
    if (!modal) return;

    const nameEl = document.getElementById('hist-modal-patient-name');
    const idpEl = document.getElementById('hist-modal-patient-idp');
    const countEl = document.getElementById('hist-modal-eval-count');
    const listEl = document.getElementById('hist-modal-evals-list');

    if (nameEl) nameEl.textContent = client.name || 'Historial del Paciente';
    if (idpEl) idpEl.textContent = `IDP: ${client.idp || ('ID-' + client.code)}`;

    const normCName = normalizeText(client.name);
    const normCIdp = normalizeText(client.idp);
    const patientEvals = (allEvaluationsData || []).filter(ev => {
        const evName = normalizeText(ev.patient_name);
        const evIdp = normalizeText(ev.patient_idp);
        return (normCIdp && evIdp && evIdp === normCIdp) || (normCName && evName && evName === normCName);
    });

    if (countEl) countEl.textContent = `${patientEvals.length} evaluación${patientEvals.length === 1 ? '' : 'es'}`;

    if (listEl) {
        listEl.innerHTML = '';
        if (patientEvals.length === 0) {
            listEl.innerHTML = `
                <div class="text-center py-4 bg-light rounded-3 border">
                    <i class="bi bi-journal-x text-muted fs-3 mb-1 d-block"></i>
                    <div class="fw-semibold text-navy small">No hay evaluaciones registradas aún</div>
                    <div class="text-muted small mt-0.5">Haz clic en el botón superior para realizar la primera medición.</div>
                </div>
            `;
        } else {
            patientEvals.forEach((ev, idx) => {
                const score = (ev.global_score !== undefined && ev.global_score !== null) ? ev.global_score : (ev.score ?? '--');
                const dateStr = ev.created_at ? new Date(ev.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '--';

                const card = document.createElement('div');
                card.className = 'card border rounded-3 p-3 bg-white hover-shadow-sm transition-all shadow-2xs';
                card.style.borderLeft = '4px solid #00b4d8 !important';
                card.innerHTML = `
                    <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
                        <div>
                            <div class="d-flex align-items-center gap-2">
                                <span class="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 font-monospace fw-bold">${ev.code || ('EVA-' + String(idx + 1).padStart(3, '0'))}</span>
                                <span class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 fw-bold"><i class="bi bi-lightning-charge-fill text-warning"></i> TRU ${score}/100</span>
                                ${ev.phase_angle ? `<span class="badge bg-light text-secondary border small">PhA: ${ev.phase_angle}°</span>` : ''}
                            </div>
                            <div class="text-muted small mt-1.5 d-flex align-items-center gap-3">
                                <span><i class="bi bi-calendar3 me-1"></i> ${dateStr}</span>
                                ${ev.weight ? `<span><i class="bi bi-speedometer2 me-1"></i> ${ev.weight} kg</span>` : ''}
                            </div>
                        </div>
                        <button type="button" class="btn btn-sm btn-light border px-3 py-1.5 text-primary fw-semibold rounded-3 d-inline-flex align-items-center gap-1.5 shadow-2xs btn-open-eval-detail">
                            <i class="bi bi-eye-fill"></i>
                            <span>Abrir Reporte</span>
                        </button>
                    </div>
                `;

                const btnOpen = card.querySelector('.btn-open-eval-detail');
                if (btnOpen) {
                    btnOpen.addEventListener('click', (e) => {
                        e.stopPropagation();
                        modal.classList.add('hidden');
                        modal.style.display = 'none';
                        openEvaluationDetailModal(ev.id);
                    });
                }

                listEl.appendChild(card);
            });
        }
    }

    modal.classList.remove('hidden');
    modal.style.display = 'flex';
}

// --- 5. CLIENTES (DIRECTORIO GENERAL) ---
let allClientsData = [];
let editingClientId = null;

function initClients() {
    const form = document.getElementById('client-form');
    if (!form) return;

    fetchClients();

    const btnCancel = document.getElementById('btn-cancel-client');
    const btnSave = document.getElementById('btn-save-client');
    const searchInput = document.getElementById('clients-search-input');

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = normalizeText(e.target.value);
            if (!query) {
                renderClientsTable(allClientsData);
                return;
            }
            const filtered = allClientsData.filter(c => {
                const name = normalizeText(c.name);
                const idp = normalizeText(c.idp);
                const phone = normalizeText(c.phone);
                const email = normalizeText(c.email);
                const code = 'id-' + String(c.code ?? 0).padStart(4, '0');
                return name.includes(query) || idp.includes(query) || phone.includes(query) || email.includes(query) || code.includes(query);
            });
            renderClientsTable(filtered);
        });
    }

    if (btnCancel) {
        btnCancel.addEventListener('click', () => {
            form.reset();
            const phoneInput = document.getElementById('new-client-phone');
            if (phoneInput) phoneInput.value = '+591 ';
            const idpInput = document.getElementById('new-client-idp');
            if (idpInput) {
                idpInput.value = '';
                idpInput.placeholder = 'Auto-asignado';
            }
            editingClientId = null;
            const btnSaveText = document.getElementById('btn-save-client-text');
            if (btnSaveText) btnSaveText.textContent = 'Guardar Paciente';
            btnCancel.classList.add('hidden-view');
            const titleEl = document.getElementById('client-form-title');
            if (titleEl) titleEl.textContent = 'Registrar Paciente';
            const iconEl = document.getElementById('client-form-icon');
            if (iconEl) iconEl.innerHTML = '<i class="bi bi-person-plus-fill"></i>';
            const badgeEl = document.getElementById('client-editing-badge');
            if (badgeEl) badgeEl.style.display = 'none';
        });
    }

    // Guardar o Actualizar paciente
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btnSaveText = document.getElementById('btn-save-client-text');
        const originalText = btnSaveText ? btnSaveText.textContent : 'Guardar';
        if (btnSave) {
            btnSave.disabled = true;
            if (btnSaveText) btnSaveText.textContent = 'Guardando...';
        }

        const payload = {
            idp: document.getElementById('new-client-idp').value.trim() || null,
            name: document.getElementById('new-client-name').value.trim(),
            age: document.getElementById('new-client-age').value ? parseInt(document.getElementById('new-client-age').value) : null,
            gender: document.getElementById('new-client-gender').value || 'Masculino',
            height: document.getElementById('new-client-height').value ? parseFloat(document.getElementById('new-client-height').value) : null,
            phone: document.getElementById('new-client-phone').value.trim() || null,
            email: document.getElementById('new-client-email').value.trim() || null
        };

        const method = editingClientId ? 'PUT' : 'POST';
        const url = editingClientId ? `/api/clients/${editingClientId}` : '/api/clients';

        try {
            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await res.json();
            if (result.success) {
                const wasEditing = Boolean(editingClientId);
                const assignedCode = result.data && result.data.code;
                if (btnCancel) btnCancel.click();
                fetchClients();
                showToast(wasEditing ? 'Paciente actualizado exitosamente' : `Paciente registrado con el código ID-${String(assignedCode).padStart(4, '0')}`, 'success');
            } else {
                showToast('Error al guardar: ' + result.error, 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Error de conexión con el servidor.', 'error');
        } finally {
            if (btnSave) btnSave.disabled = false;
            if (btnSaveText) btnSaveText.textContent = originalText;
        }
    });
}

async function fetchClients() {
    const tbody = document.getElementById('clients-tbody');
    const totalCountEl = document.getElementById('clients-total-count');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-5 text-muted">Cargando pacientes...</td></tr>';

    try {
        const [resClients, resEvals] = await Promise.all([
            fetch('/api/clients', { headers: getAuthHeaders() }),
            (!allEvaluationsData || allEvaluationsData.length === 0) ? fetch('/api/evaluations', { headers: getAuthHeaders() }) : Promise.resolve(null)
        ]);

        if (resClients && resClients.ok) {
            try {
                allClientsData = await resClients.json();
            } catch (e) {
                allClientsData = [];
            }
        } else {
            allClientsData = [];
        }

        if (resEvals && resEvals.ok) {
            try {
                allEvaluationsData = await resEvals.json();
            } catch (e) {}
        }
        
        const count = Array.isArray(allClientsData) ? allClientsData.length : 0;
        if (totalCountEl) totalCountEl.textContent = count;

        if (!Array.isArray(allClientsData) || allClientsData.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-5">
                        <div class="d-flex flex-column align-items-center justify-content-center py-4">
                            <div class="bg-primary-subtle text-primary rounded-circle p-3 mb-3 d-inline-flex align-items-center justify-content-center" style="width: 58px; height: 58px;">
                                <i class="bi bi-people-fill fs-2"></i>
                            </div>
                            <h5 class="fw-bold text-navy mb-1">No tienes pacientes registrados todavía</h5>
                            <p class="text-muted small mb-0">Completa el formulario superior para registrar a tu primer paciente.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        renderClientsTable(allClientsData);

        // Actualizar datalists de Bioimpedancia y campo IDP
        if (window.updateBioDatalists) {
            window.updateBioDatalists();
        }
        const clientFormIdp = document.getElementById('new-client-idp');
        if (clientFormIdp && !editingClientId) {
            clientFormIdp.value = getNextAvailableIDP();
        }

    } catch (err) {
        console.error(err);
        if (totalCountEl) totalCountEl.textContent = '0';
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-danger">Error al cargar la lista de pacientes.</td></tr>';
    }
}

function renderClientsTable(clientsList) {
    const tbody = document.getElementById('clients-tbody');
    if (!tbody) return;

    if (!clientsList || clientsList.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-5">
                    <div class="d-flex flex-column align-items-center justify-content-center py-4">
                        <div class="bg-primary-subtle text-primary rounded-circle p-3 mb-3 d-inline-flex align-items-center justify-content-center" style="width: 54px; height: 54px;">
                            <i class="bi bi-search fs-3"></i>
                        </div>
                        <h6 class="fw-bold text-navy mb-1">No se encontraron pacientes</h6>
                        <p class="text-muted small mb-0">Modifica el término de búsqueda o registra un paciente nuevo.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.replaceChildren();
    clientsList.forEach(c => {
        const tr = document.createElement('tr');

        // 1. Código & IDP
        const tdCode = document.createElement('td');
        const badge = document.createElement('span');
        badge.className = 'code-badge';
        badge.textContent = 'ID-' + String(c.code ?? 0).padStart(4, '0');
        tdCode.appendChild(badge);
        if (c.idp) {
            const idpSpan = document.createElement('div');
            idpSpan.className = 'text-muted small mt-0.5 font-monospace';
            idpSpan.textContent = `IDP: ${c.idp}`;
            tdCode.appendChild(idpSpan);
        }

        // 2. Paciente (Nombre, edad, genero, altura)
        const tdName = document.createElement('td');
        const nameDiv = document.createElement('div');
        nameDiv.className = 'fw-bold text-navy';
        nameDiv.textContent = c.name || '';
        tdName.appendChild(nameDiv);

        const pillsDiv = document.createElement('div');
        pillsDiv.className = 'd-flex flex-wrap gap-1 mt-1';
        if (c.age) {
            const pill = document.createElement('span');
            pill.className = 'badge bg-light text-secondary border small';
            pill.textContent = `${c.age} años`;
            pillsDiv.appendChild(pill);
        }
        if (c.gender) {
            const pill = document.createElement('span');
            pill.className = 'badge bg-light text-secondary border small';
            pill.textContent = (c.gender === 'male' || c.gender === 'Masculino') ? '♂ Masc.' : '♀ Fem.';
            pillsDiv.appendChild(pill);
        }
        if (c.height) {
            const pill = document.createElement('span');
            pill.className = 'badge bg-light text-secondary border small';
            pill.textContent = `${c.height} cm`;
            pillsDiv.appendChild(pill);
        }
        if (pillsDiv.children.length > 0) tdName.appendChild(pillsDiv);

        // 3. Contacto (Teléfono y Email)
        const tdContact = document.createElement('td');
        const phoneDiv = document.createElement('div');
        phoneDiv.className = 'small d-flex align-items-center gap-1.5';
        if (c.phone) {
            phoneDiv.innerHTML = `<i class="bi bi-whatsapp text-success"></i> <span class="text-secondary fw-semibold font-monospace">${c.phone}</span>`;
        } else {
            phoneDiv.innerHTML = `<i class="bi bi-whatsapp text-muted opacity-50"></i> <span class="badge bg-light text-muted border px-1.5 py-0.5" style="font-size: 0.7rem;">S/A</span>`;
        }
        tdContact.appendChild(phoneDiv);

        const emailDiv = document.createElement('div');
        emailDiv.className = 'small d-flex align-items-center gap-1.5 mt-0.5';
        if (c.email) {
            emailDiv.innerHTML = `<i class="bi bi-envelope text-primary"></i> <span class="text-muted">${c.email}</span>`;
        } else {
            emailDiv.innerHTML = `<i class="bi bi-envelope text-muted opacity-50"></i> <span class="badge bg-light text-muted border px-1.5 py-0.5" style="font-size: 0.7rem;">S/A</span>`;
        }
        tdContact.appendChild(emailDiv);

        // 4. Historial de Evaluaciones con botón directo a Modal de Historial
        const normCName = normalizeText(c.name);
        const normCIdp = normalizeText(c.idp);
        const patientEvals = (allEvaluationsData || []).filter(ev => {
            const evName = normalizeText(ev.patient_name);
            const evIdp = normalizeText(ev.patient_idp);
            return (normCIdp && evIdp && evIdp === normCIdp) || (normCName && evName && evName === normCName);
        });

        const tdLastEval = document.createElement('td');

        if (patientEvals.length === 0) {
            const noEvalWrap = document.createElement('div');
            noEvalWrap.className = 'd-inline-flex align-items-center gap-2';
            noEvalWrap.innerHTML = '<span class="badge bg-light text-muted border small">Sin evaluar</span>';

            const btnEvalZero = document.createElement('button');
            btnEvalZero.type = 'button';
            btnEvalZero.className = 'btn btn-sm btn-light border px-2.5 py-1 text-primary fw-semibold d-inline-flex align-items-center gap-1 shadow-2xs';
            btnEvalZero.innerHTML = '<i class="bi bi-lightning-charge-fill text-warning"></i> Evaluar';
            btnEvalZero.title = 'Realizar primera evaluación de bioimpedancia a este paciente';
            btnEvalZero.addEventListener('click', () => {
                const bioNav = document.querySelector('[data-target="bio-view"]');
                if (bioNav) bioNav.click();
                fillBioFormFromClient(c);
                document.getElementById('input-r').focus();
                showToast(`Ficha de ${c.name} cargada en calculadora`, 'info');
            });
            noEvalWrap.appendChild(btnEvalZero);
            tdLastEval.appendChild(noEvalWrap);
        } else {
            const latest = patientEvals[0];
            const latestScore = (latest.global_score !== undefined && latest.global_score !== null) ? latest.global_score : (latest.score ?? '--');

            const btnHistory = document.createElement('button');
            btnHistory.type = 'button';
            btnHistory.className = 'btn btn-sm btn-outline-primary rounded-pill px-3 py-1 fw-semibold d-inline-flex align-items-center gap-1.5 shadow-2xs';
            btnHistory.title = `Ver historial de ${patientEvals.length} evaluación(es) de ${c.name}`;
            btnHistory.innerHTML = `
                <i class="bi bi-lightning-charge-fill text-warning"></i>
                <span>TRU ${latestScore}/100</span>
                <span class="badge bg-primary text-white rounded-pill ms-1" style="font-size: 0.68rem;">${patientEvals.length} eval${patientEvals.length > 1 ? 's' : ''} ▾</span>
            `;

            btnHistory.addEventListener('click', (e) => {
                e.stopPropagation();
                openPatientHistoryModal(c);
            });

            tdLastEval.appendChild(btnHistory);
        }

        // 5. Acciones
        const tdActions = document.createElement('td');
        tdActions.className = 'text-end';

        const actionsWrap = document.createElement('div');
        actionsWrap.className = 'd-inline-flex align-items-center justify-content-end gap-1.5 flex-wrap';

        // Botón Enviar WhatsApp / Mensaje
        const btnMsg = document.createElement('button');
        btnMsg.type = 'button';
        btnMsg.className = 'btn btn-sm btn-outline-success px-2.5 py-1 fw-semibold d-inline-flex align-items-center gap-1';
        btnMsg.style.borderColor = '#25D366';
        btnMsg.style.color = '#128C7E';
        btnMsg.innerHTML = '<i class="bi bi-whatsapp"></i> Mensaje';
        btnMsg.title = 'Enviar mensaje por WhatsApp o correo';
        btnMsg.addEventListener('click', () => {
            openPatientMessageModal(c, patientEvals[0] || c.last_evaluation);
        });

        // Botón Editar
        const btnEdit = document.createElement('button');
        btnEdit.type = 'button';
        btnEdit.className = 'btn btn-sm btn-action-edit d-inline-flex align-items-center gap-1';
        btnEdit.innerHTML = '<i class="bi bi-pencil"></i>';
        btnEdit.title = 'Editar datos del paciente';
        btnEdit.addEventListener('click', () => editClient(c));

        // Botón Eliminar
        const btnDel = document.createElement('button');
        btnDel.type = 'button';
        btnDel.className = 'btn btn-sm btn-action-delete d-inline-flex align-items-center gap-1';
        btnDel.innerHTML = '<i class="bi bi-trash3"></i>';
        btnDel.title = 'Eliminar paciente';
        btnDel.addEventListener('click', () => deleteClient(c.id));

        actionsWrap.append(btnMsg, btnEdit, btnDel);
        tdActions.appendChild(actionsWrap);

        tr.append(tdCode, tdName, tdContact, tdLastEval, tdActions);
        tbody.appendChild(tr);
    });
}

function deleteClient(id) {
    showConfirm(
        'Eliminar Paciente',
        '¿Estás seguro de que deseas eliminar este paciente del directorio? Su código será reasignado al próximo registro.',
        async () => {
            try {
                const res = await fetch(`/api/clients/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
                const result = await res.json();
                if (result.success) {
                    showToast('Paciente eliminado correctamente', 'success');
                    fetchClients();
                } else {
                    showToast('Error al eliminar: ' + result.error, 'error');
                }
            } catch (err) {
                console.error(err);
                showToast('Error de conexión', 'error');
            }
        }
    );
}

function editClient(client) {
    if (!client) return;
    editingClientId = client.id;

    if (document.getElementById('new-client-idp')) document.getElementById('new-client-idp').value = client.idp || '';
    if (document.getElementById('new-client-name')) document.getElementById('new-client-name').value = client.name || '';
    if (document.getElementById('new-client-age')) document.getElementById('new-client-age').value = client.age || '';
    if (document.getElementById('new-client-gender')) {
        const g = (client.gender === 'Femenino' || client.gender === 'female') ? 'Femenino' : 'Masculino';
        document.getElementById('new-client-gender').value = g;
    }
    if (document.getElementById('new-client-height')) document.getElementById('new-client-height').value = client.height || '';
    if (document.getElementById('new-client-phone')) document.getElementById('new-client-phone').value = client.phone || '+591 ';
    if (document.getElementById('new-client-email')) document.getElementById('new-client-email').value = client.email || '';

    const btnSaveText = document.getElementById('btn-save-client-text');
    if (btnSaveText) btnSaveText.textContent = 'Actualizar Paciente';
    
    const btnCancel = document.getElementById('btn-cancel-client');
    if (btnCancel) btnCancel.classList.remove('hidden-view');

    const titleEl = document.getElementById('client-form-title');
    if (titleEl) titleEl.textContent = `Editar Paciente (${client.name})`;
    
    const iconEl = document.getElementById('client-form-icon');
    if (iconEl) iconEl.innerHTML = '<i class="bi bi-pencil-square"></i>';

    const badgeEl = document.getElementById('client-editing-badge');
    if (badgeEl) badgeEl.style.display = 'inline-block';

    const form = document.getElementById('client-form');
    if (form) {
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const nameInput = document.getElementById('new-client-name');
        if (nameInput) nameInput.focus();
    }
}

// --- 4. EVALUACIONES (HISTORIAL Y DETALLE) ---
let allEvaluationsData = [];
let selectedEvaluationData = null;
let selectedEvaluationIds = new Set();
let currentPageVisibleItems = [];
let evalCurrentPage = 1;
let evalPageSize = '25';

function initEvaluaciones() {
    const btnRefresh = document.getElementById('btn-refresh-evals');
    const searchInput = document.getElementById('eval-search-input');
    const filterStatus = document.getElementById('eval-filter-status');
    const pageSizeSelect = document.getElementById('eval-page-size');
    const btnPrev = document.getElementById('eval-btn-prev');
    const btnNext = document.getElementById('eval-btn-next');
    const masterCheckbox = document.getElementById('eval-select-all');
    const btnBulkDeselect = document.getElementById('btn-eval-bulk-deselect');
    const btnBulkDelete = document.getElementById('btn-eval-bulk-delete');

    if (btnRefresh) {
        btnRefresh.addEventListener('click', () => {
            fetchEvaluaciones();
            showToast('Historial de evaluaciones actualizado', 'info');
        });
    }

    if (pageSizeSelect) {
        pageSizeSelect.addEventListener('change', (e) => {
            evalPageSize = e.target.value;
            evalCurrentPage = 1;
            filterAndRenderEvaluaciones();
        });
    }

    if (btnPrev) {
        btnPrev.addEventListener('click', () => {
            if (evalCurrentPage > 1) {
                evalCurrentPage--;
                filterAndRenderEvaluaciones();
                const scrollContainer = document.querySelector('.evals-table-scroll-container');
                if (scrollContainer) scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    }

    if (btnNext) {
        btnNext.addEventListener('click', () => {
            evalCurrentPage++;
            filterAndRenderEvaluaciones();
            const scrollContainer = document.querySelector('.evals-table-scroll-container');
            if (scrollContainer) scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            evalCurrentPage = 1;
            filterAndRenderEvaluaciones();
        });
    }

    if (filterStatus) {
        filterStatus.addEventListener('change', () => {
            evalCurrentPage = 1;
            filterAndRenderEvaluaciones();
        });
    }

    // Master Checkbox in table header (Selecciona/deselecciona las visibles en esta página)
    if (masterCheckbox) {
        masterCheckbox.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            currentPageVisibleItems.forEach(item => {
                const idStr = String(item.id);
                if (isChecked) {
                    selectedEvaluationIds.add(idStr);
                } else {
                    selectedEvaluationIds.delete(idStr);
                }
            });
            filterAndRenderEvaluaciones();
        });
    }

    // Botón Deseleccionar todas
    if (btnBulkDeselect) {
        btnBulkDeselect.addEventListener('click', () => {
            selectedEvaluationIds.clear();
            filterAndRenderEvaluaciones();
            showToast('Se han desmarcado todas las evaluaciones', 'info');
        });
    }

    // Botón Eliminar Marcadas (Abre el modal con el listado)
    if (btnBulkDelete) {
        btnBulkDelete.addEventListener('click', () => {
            openBatchDeleteModal();
        });
    }

    // Modal de Eliminación Masiva
    const batchModal = document.getElementById('batch-delete-evals-modal');
    const batchCloseBtn = document.getElementById('batch-delete-modal-close');
    const batchCancelBtn = document.getElementById('batch-delete-btn-cancel');
    const batchConfirmBtn = document.getElementById('batch-delete-btn-confirm');

    const closeBatchModal = () => {
        if (batchModal) batchModal.classList.add('hidden');
    };

    if (batchCloseBtn) batchCloseBtn.addEventListener('click', closeBatchModal);
    if (batchCancelBtn) batchCancelBtn.addEventListener('click', closeBatchModal);
    if (batchModal) {
        batchModal.addEventListener('click', (e) => {
            if (e.target === batchModal) closeBatchModal();
        });
    }

    if (batchConfirmBtn) {
        batchConfirmBtn.addEventListener('click', async () => {
            if (selectedEvaluationIds.size === 0) return;
            
            const countToDelete = selectedEvaluationIds.size;
            const originalText = batchConfirmBtn.innerHTML;
            batchConfirmBtn.disabled = true;
            batchConfirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Eliminando...';

            try {
                const res = await fetch('/api/evaluations/batch-delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                    body: JSON.stringify({ ids: Array.from(selectedEvaluationIds) })
                });
                const result = await res.json();
                if (res.ok && result.success) {
                    closeBatchModal();
                    selectedEvaluationIds.clear();
                    showToast(`🗑️ Se eliminaron ${result.deleted_count || countToDelete} evaluaciones correctamente`, 'success');
                    fetchEvaluaciones();
                    fetchDashboardStats();
                    updateUserProfileUI();
                } else {
                    showToast('Error al eliminar evaluaciones: ' + (result.error || 'Error desconocido'), 'error');
                }
            } catch (err) {
                console.error(err);
                showToast('Error de conexión al eliminar evaluaciones', 'error');
            } finally {
                batchConfirmBtn.disabled = false;
                batchConfirmBtn.innerHTML = originalText;
            }
        });
    }

    // Modal detail close triggers
    const modal = document.getElementById('eval-detail-modal');
    const closeBtn = document.getElementById('eval-modal-close');
    if (closeBtn && modal) {
        closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.add('hidden');
        });
    }

    // Modal action: Reload into calculator
    const btnOpenCalc = document.getElementById('btn-modal-open-calc');
    if (btnOpenCalc) {
        btnOpenCalc.addEventListener('click', () => {
            if (!selectedEvaluationData || !selectedEvaluationData.raw_inputs) return;
            const inp = selectedEvaluationData.raw_inputs;

            // Fill basic form
            document.getElementById('input-idp').value = inp.patient_idp || '';
            document.getElementById('input-name').value = inp.patient_name || '';
            document.getElementById('input-r').value = inp.resistance || '';
            document.getElementById('input-xc').value = inp.reactance || '';
            document.getElementById('input-weight').value = inp.weight || '';
            document.getElementById('input-height').value = inp.height || '';
            document.getElementById('input-age').value = inp.age || '';
            if (inp.gender) document.getElementById('input-gender').value = inp.gender;
            if (inp.pal) document.getElementById('input-pal').value = inp.pal;
            if (inp.waist) document.getElementById('input-waist').value = inp.waist;

            // Fill optional device form
            const details = document.querySelector('details.device-data');
            if (details) details.open = true;

            if (inp.smm) document.getElementById('input-smm').value = inp.smm;
            if (inp.tbw) document.getElementById('input-tbw').value = inp.tbw;
            if (inp.ecw) document.getElementById('input-ecw').value = inp.ecw;
            if (inp.fat_mass) document.getElementById('input-fat-mass').value = inp.fat_mass;
            if (inp.visceral_fat) document.getElementById('input-visceral').value = inp.visceral_fat;
            if (inp.phase_angle_dev) document.getElementById('input-phase-dev').value = inp.phase_angle_dev;
            if (inp.seg_arm_r) document.getElementById('input-seg-arm-r').value = inp.seg_arm_r;
            if (inp.seg_arm_l) document.getElementById('input-seg-arm-l').value = inp.seg_arm_l;
            if (inp.seg_torso) document.getElementById('input-seg-torso').value = inp.seg_torso;
            if (inp.seg_leg_r) document.getElementById('input-seg-leg-r').value = inp.seg_leg_r;
            if (inp.seg_leg_l) document.getElementById('input-seg-leg-l').value = inp.seg_leg_l;

            modal.classList.add('hidden');

            // Switch to bioimpedancia view
            const bioNav = document.querySelector('[data-target="bio-view"]');
            if (bioNav) bioNav.click();

            showToast('Datos de la evaluación cargados en el formulario', 'info');
        });
    }

    // Modal action: Edit Client Data
    const btnEditClient = document.getElementById('btn-modal-edit-client');
    if (btnEditClient) {
        btnEditClient.addEventListener('click', async () => {
            if (!selectedEvaluationData) return;
            const patientName = selectedEvaluationData.patient_name;
            const patientIdp = selectedEvaluationData.patient_idp;
            modal.classList.add('hidden');

            // Switch to clients view
            const clientsNav = document.querySelector('[data-target="clientes-view"]');
            if (clientsNav) clientsNav.click();

            // Try to find matching client
            let match = allClientsData.find(c => (patientIdp && c.idp === patientIdp) || (c.name || '').toLowerCase() === (patientName || '').toLowerCase());
            if (match) {
                editClient(match);
                showToast(`Editando ficha de ${match.name}`, 'info');
            } else {
                if (document.getElementById('new-client-name')) document.getElementById('new-client-name').value = patientName || '';
                if (document.getElementById('new-client-idp')) document.getElementById('new-client-idp').value = patientIdp || '';
                showToast(`Creando registro para ${patientName}`, 'info');
            }
        });
    }

    // Modal action: Share WhatsApp / Message
    const btnShareWa = document.getElementById('btn-modal-share-wa');
    if (btnShareWa) {
        btnShareWa.addEventListener('click', () => {
            if (!selectedEvaluationData) return;
            const patientName = selectedEvaluationData.patient_name;
            const patientIdp = selectedEvaluationData.patient_idp;

            let match = allClientsData.find(c => (patientIdp && c.idp === patientIdp) || (c.name || '').toLowerCase() === (patientName || '').toLowerCase());
            if (!match) {
                match = {
                    name: patientName || 'Paciente',
                    idp: patientIdp || null,
                    phone: '',
                    email: ''
                };
            }

            modal.classList.add('hidden');
            openPatientMessageModal(match, selectedEvaluationData);
        });
    }

    fetchEvaluaciones();
}

async function fetchEvaluaciones() {
    const tbody = document.getElementById('evaluaciones-tbody');
    if (!tbody) return;

    try {
        const res = await fetch('/api/evaluations', { headers: getAuthHeaders() });
        if (!res.ok) throw new Error('Error al consultar servidor');
        allEvaluationsData = await res.json();
        evalsDataLoaded = true;
        filterAndRenderEvaluaciones();
    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 2.5rem; color: red;">Error al cargar las evaluaciones.</td></tr>';
    }
}

function normalizeText(str) {
    if (!str) return '';
    return String(str)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function updateBulkActionsToolbar() {
    const bar = document.getElementById('eval-bulk-actions-bar');
    const countText = document.getElementById('eval-bulk-count-text');
    if (!bar) return;

    if (selectedEvaluationIds.size > 0) {
        bar.classList.remove('hidden');
        bar.style.display = 'flex';
        if (countText) {
            countText.textContent = `${selectedEvaluationIds.size} evaluación${selectedEvaluationIds.size > 1 ? 'es' : ''} seleccionada${selectedEvaluationIds.size > 1 ? 's' : ''}`;
        }
    } else {
        bar.classList.add('hidden');
        bar.style.display = 'none';
    }
}

function updateMasterCheckboxState(pageItems) {
    const masterCheckbox = document.getElementById('eval-select-all');
    if (!masterCheckbox) return;

    if (!pageItems || pageItems.length === 0) {
        masterCheckbox.checked = false;
        masterCheckbox.indeterminate = false;
        return;
    }

    const selectedOnCurrentPage = pageItems.filter(item => selectedEvaluationIds.has(String(item.id))).length;

    if (selectedOnCurrentPage === pageItems.length) {
        masterCheckbox.checked = true;
        masterCheckbox.indeterminate = false;
    } else if (selectedOnCurrentPage > 0) {
        masterCheckbox.checked = false;
        masterCheckbox.indeterminate = true;
    } else {
        masterCheckbox.checked = false;
        masterCheckbox.indeterminate = false;
    }
}

function openBatchDeleteModal() {
    if (selectedEvaluationIds.size === 0) {
        showToast('No hay evaluaciones seleccionadas', 'info');
        return;
    }

    const modal = document.getElementById('batch-delete-evals-modal');
    const tbody = document.getElementById('batch-delete-list-tbody');
    const countText = document.getElementById('batch-delete-count-text');
    const btnCount = document.getElementById('batch-delete-btn-count');

    if (!modal || !tbody) return;

    // Filter evaluations matching the selected IDs
    const selectedList = allEvaluationsData.filter(e => selectedEvaluationIds.has(String(e.id)));

    tbody.innerHTML = '';
    selectedList.forEach(ev => {
        const rawName = (ev.patient_name || '').trim();
        const displayPatientName = (!rawName || rawName.toLowerCase() === 'unknown') ? 'Paciente sin registrar' : rawName;
        const displayIdp = (ev.patient_idp && ev.patient_idp !== '000000') ? ev.patient_idp : '--';
        const formattedDate = (ev.created_at || '').replace('T', ' ').substring(0, 16) || '--';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="ps-3"><span class="code-badge" style="background: rgba(0, 180, 216, 0.1); color: #00b4d8; font-weight: 700; font-size: 0.78rem;">${ev.code || 'EVA-000'}</span></td>
            <td><strong>${displayPatientName}</strong> <span class="text-muted small">(${displayIdp})</span></td>
            <td><span class="text-secondary">${formattedDate}</span></td>
            <td><span class="badge bg-success-subtle text-success">${ev.global_score ?? 0} pts</span></td>
            <td class="pe-3 text-end"><strong class="text-info">${ev.phase_angle ?? '--'}°</strong></td>
        `;
        tbody.appendChild(tr);
    });

    if (countText) countText.textContent = `${selectedEvaluationIds.size} evaluación${selectedEvaluationIds.size > 1 ? 'es' : ''}`;
    if (btnCount) btnCount.textContent = selectedEvaluationIds.size;

    modal.classList.remove('hidden');
}

function filterAndRenderEvaluaciones() {
    const tbody = document.getElementById('evaluaciones-tbody');
    if (!tbody) return;

    const searchTerm = normalizeText(document.getElementById('eval-search-input')?.value);
    const statusFilter = document.getElementById('eval-filter-status')?.value || 'all';

    const filtered = allEvaluationsData.filter(item => {
        const normName = normalizeText(item.patient_name);
        const normIdp = normalizeText(item.patient_idp);
        const normWeight = normalizeText(item.weight);
        const normHeight = normalizeText(item.height);

        const nameMatch = !searchTerm ||
            normName.includes(searchTerm) ||
            normIdp.includes(searchTerm) ||
            normWeight.includes(searchTerm) ||
            normHeight.includes(searchTerm);

        const statusMatch = statusFilter === 'all' || (item.cell_status || '').includes(statusFilter);
        return nameMatch && statusMatch;
    });

    const totalItems = filtered.length;
    const isAll = evalPageSize === 'all';
    const limit = isAll ? Math.max(totalItems, 1) : (parseInt(evalPageSize, 10) || 25);
    const totalPages = isAll ? 1 : (Math.ceil(totalItems / limit) || 1);

    if (evalCurrentPage > totalPages) evalCurrentPage = totalPages;
    if (evalCurrentPage < 1) evalCurrentPage = 1;

    const startIndex = (evalCurrentPage - 1) * limit;
    const endIndex = Math.min(startIndex + limit, totalItems);
    const pageItems = isAll ? filtered : filtered.slice(startIndex, endIndex);
    currentPageVisibleItems = pageItems;

    // Update pagination controls in UI
    const infoRange = document.getElementById('eval-info-range');
    const infoTotal = document.getElementById('eval-info-total');
    const pageBadge = document.getElementById('eval-current-page-badge');
    const btnPrev = document.getElementById('eval-btn-prev');
    const btnNext = document.getElementById('eval-btn-next');

    if (infoRange) infoRange.textContent = totalItems > 0 ? `${startIndex + 1}-${endIndex}` : '0-0';
    if (infoTotal) infoTotal.textContent = totalItems;
    if (pageBadge) pageBadge.textContent = `Pág. ${evalCurrentPage} / ${totalPages}`;
    if (btnPrev) btnPrev.disabled = evalCurrentPage <= 1;
    if (btnNext) btnNext.disabled = evalCurrentPage >= totalPages;

    updateMasterCheckboxState(pageItems);
    updateBulkActionsToolbar();

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 2.5rem; color: #5a6f8c;">No se encontraron evaluaciones registradas.</td></tr>';
        return;
    }

    tbody.replaceChildren();
    pageItems.forEach(ev => {
        const idStr = String(ev.id);
        const isSelected = selectedEvaluationIds.has(idStr);

        const tr = document.createElement('tr');
        if (isSelected) tr.classList.add('table-row-selected');

        // Checkbox Column
        const tdCheck = document.createElement('td');
        tdCheck.style.textAlign = 'center';
        tdCheck.style.verticalAlign = 'middle';
        
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.className = 'form-check-input eval-checkbox shadow-none';
        chk.checked = isSelected;
        chk.title = `Marcar evaluación ${ev.code || ''}`;
        
        chk.addEventListener('click', (e) => e.stopPropagation());
        chk.addEventListener('change', (e) => {
            if (e.target.checked) {
                selectedEvaluationIds.add(idStr);
                tr.classList.add('table-row-selected');
            } else {
                selectedEvaluationIds.delete(idStr);
                tr.classList.remove('table-row-selected');
            }
            updateMasterCheckboxState(pageItems);
            updateBulkActionsToolbar();
        });
        tdCheck.appendChild(chk);

        // Code Badge (EVA-XXX)
        const tdCode = document.createElement('td');
        const codeBadge = document.createElement('span');
        codeBadge.className = 'code-badge';
        codeBadge.style.background = 'rgba(0, 180, 216, 0.1)';
        codeBadge.style.color = '#00b4d8';
        codeBadge.style.fontWeight = '700';
        codeBadge.textContent = ev.code || 'EVA-000';
        tdCode.appendChild(codeBadge);

        // Date & Time
        const tdDate = document.createElement('td');
        const rawDate = ev.created_at || '';
        const formattedDate = rawDate ? rawDate.replace('T', ' ').substring(0, 16) : '--';
        tdDate.innerHTML = `<span style="font-weight: 500; font-size: 0.85rem; color: #1A2A4A;">${formattedDate}</span>`;

        // Patient / IDP
        const rawName = (ev.patient_name || '').trim();
        const displayPatientName = (!rawName || rawName.toLowerCase() === 'unknown') ? 'Paciente sin registrar' : rawName;
        const rawIdp = (ev.patient_idp || '').trim();
        const displayPatientIdp = (!rawIdp || rawIdp === '000000') ? '--' : rawIdp;

        const tdPatient = document.createElement('td');
        tdPatient.innerHTML = `<div style="font-weight: 700; color: #1A2A4A;">${displayPatientName}</div>
                               <div style="font-size: 0.78rem; color: #5a6f8c;">IDP: ${displayPatientIdp}</div>`;

        // Base Measurements (Weight, Height, R, Xc)
        const tdBase = document.createElement('td');
        tdBase.innerHTML = `<div style="font-size: 0.82rem; color: #334155;"><strong>${ev.weight || '--'} kg</strong> | ${ev.height || '--'} cm</div>
                            <div style="font-size: 0.75rem; color: #64748b;">R: ${ev.resistance || '--'}Ω / Xc: ${ev.reactance || '--'}Ω</div>`;

        // TRU Score
        const tdScore = document.createElement('td');
        const scoreBadge = document.createElement('span');
        scoreBadge.className = 'code-badge';
        scoreBadge.style.background = 'rgba(45,122,74,0.1)';
        scoreBadge.style.color = '#2d7a4a';
        scoreBadge.style.fontWeight = '700';
        scoreBadge.textContent = `${ev.global_score ?? 0} pts`;
        tdScore.appendChild(scoreBadge);

        // Phase Angle
        const tdPhase = document.createElement('td');
        tdPhase.innerHTML = `<span style="font-weight: 700; color: #00b4d8;">${ev.phase_angle ?? '--'}°</span>`;

        // Cell Status
        const tdStatus = document.createElement('td');
        const statusChip = document.createElement('span');
        const cell = ev.cell_status || 'Normal';
        let chipBg = 'rgba(45,122,74,0.1)';
        let chipColor = '#2d7a4a';
        if (cell.includes('Límite')) { chipBg = 'rgba(205,127,50,0.1)'; chipColor = '#cd7f32'; }
        if (cell.includes('Bajo')) { chipBg = 'rgba(185,74,74,0.1)'; chipColor = '#b94a4a'; }

        statusChip.style.cssText = `background: ${chipBg}; color: ${chipColor}; padding: 0.25rem 0.6rem; border-radius: 6px; font-weight: 600; font-size: 0.78rem; display: inline-block;`;
        statusChip.textContent = cell;
        tdStatus.appendChild(statusChip);

        // Actions
        const tdActions = document.createElement('td');
        tdActions.style.textAlign = 'right';

        const btnGroup = document.createElement('div');
        btnGroup.className = 'eval-btn-group';

        const btnView = document.createElement('button');
        btnView.className = 'eval-btn-open';
        btnView.innerHTML = '<i class="bi bi-eye-fill"></i> Abrir';
        btnView.addEventListener('click', (e) => {
            e.stopPropagation();
            openEvaluationDetailModal(ev.id);
        });

        const btnDel = document.createElement('button');
        btnDel.className = 'eval-btn-delete';
        btnDel.innerHTML = '<i class="bi bi-trash3-fill"></i>';
        btnDel.title = 'Eliminar Evaluación';
        btnDel.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteEvaluation(ev.id);
        });

        btnGroup.append(btnView, btnDel);
        tdActions.appendChild(btnGroup);

        // Row click to toggle selection
        tr.addEventListener('click', (e) => {
            // Ignore if clicked on a button or link
            if (e.target.closest('button') || e.target.closest('a')) return;
            chk.checked = !chk.checked;
            if (chk.checked) {
                selectedEvaluationIds.add(idStr);
                tr.classList.add('table-row-selected');
            } else {
                selectedEvaluationIds.delete(idStr);
                tr.classList.remove('table-row-selected');
            }
            updateMasterCheckboxState(pageItems);
            updateBulkActionsToolbar();
        });

        tr.append(tdCheck, tdCode, tdDate, tdPatient, tdBase, tdScore, tdPhase, tdStatus, tdActions);
        tbody.appendChild(tr);
    });
}

async function openEvaluationDetailModal(evalId) {
    const modal = document.getElementById('eval-detail-modal');
    if (!modal) return;

    showToast('Cargando reporte de evaluación...', 'info');

    try {
        const res = await fetch(`/api/evaluations/${evalId}`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error('No se pudo obtener la evaluación');
        const data = await res.json();
        selectedEvaluationData = data;

        document.getElementById('eval-modal-name').textContent = data.patient_name || 'Paciente';
        const evalCodeStr = data.code ? ` | Código: ${data.code}` : '';
        document.getElementById('eval-modal-meta').textContent = `IDP: ${data.patient_idp || '--'}${evalCodeStr} | Fecha: ${data.created_at ? data.created_at.replace('T', ' ').substring(0, 16) : '--'}`;
        document.getElementById('eval-modal-score').textContent = data.score ?? 0;
        document.getElementById('eval-modal-rank').textContent = data.rank || '';
        document.getElementById('eval-modal-phase').textContent = `${data.phase_angle ?? 0}°`;
        document.getElementById('eval-modal-cell').textContent = data.cell_status || '';
        document.getElementById('eval-modal-tee').textContent = data.tee_kcal ?? '--';

        // Render inputs grid
        const inputsGrid = document.getElementById('eval-modal-inputs-grid');
        if (inputsGrid && data.raw_inputs) {
            const inp = data.raw_inputs;
            inputsGrid.innerHTML = `
                <div class="p-2 rounded-3 bg-white border d-flex justify-content-between align-items-center shadow-2xs"><span class="text-muted">Peso:</span><strong class="text-navy">${inp.weight || '--'} kg</strong></div>
                <div class="p-2 rounded-3 bg-white border d-flex justify-content-between align-items-center shadow-2xs"><span class="text-muted">Altura:</span><strong class="text-navy">${inp.height || '--'} cm</strong></div>
                <div class="p-2 rounded-3 bg-white border d-flex justify-content-between align-items-center shadow-2xs"><span class="text-muted">Edad:</span><strong class="text-navy">${inp.age || '--'} años</strong></div>
                <div class="p-2 rounded-3 bg-white border d-flex justify-content-between align-items-center shadow-2xs"><span class="text-muted">Género:</span><strong class="text-navy">${inp.gender === 'female' ? 'Femenino' : 'Masculino'}</strong></div>
                <div class="p-2 rounded-3 bg-white border d-flex justify-content-between align-items-center shadow-2xs"><span class="text-muted">Resistencia (R):</span><strong class="text-navy">${inp.resistance || '--'} Ω</strong></div>
                <div class="p-2 rounded-3 bg-white border d-flex justify-content-between align-items-center shadow-2xs"><span class="text-muted">Reactancia (Xc):</span><strong class="text-navy">${inp.reactance || '--'} Ω</strong></div>
                <div class="p-2 rounded-3 bg-white border d-flex justify-content-between align-items-center shadow-2xs"><span class="text-muted">Masa Muscular:</span><strong class="text-success">${inp.smm ? inp.smm + ' kg' : 'N/A'}</strong></div>
                <div class="p-2 rounded-3 bg-white border d-flex justify-content-between align-items-center shadow-2xs"><span class="text-muted">Masa Grasa:</span><strong class="text-danger">${inp.fat_mass ? inp.fat_mass + ' kg' : 'N/A'}</strong></div>
                <div class="p-2 rounded-3 bg-white border d-flex justify-content-between align-items-center shadow-2xs"><span class="text-muted">Grasa Visceral:</span><strong class="text-navy">${inp.visceral_fat ? inp.visceral_fat + ' L' : 'N/A'}</strong></div>
                <div class="p-2 rounded-3 bg-white border d-flex justify-content-between align-items-center shadow-2xs"><span class="text-muted">PAL (Actividad):</span><strong class="text-navy">${inp.pal || '--'}</strong></div>
            `;
        }

        // Render clinical findings
        const clinicalBox = document.getElementById('eval-modal-clinical');
        if (clinicalBox) {
            let html = `<p style="margin-top: 0;"><strong>Diagnóstico general:</strong> El paciente presenta un estado celular <strong>${(data.cell_status || '').toLowerCase()}</strong> con un TRU Score de <strong>${data.score}/100</strong>.</p>`;
            if (data.clinical_findings && data.clinical_findings.length > 0) {
                html += `<ul style="margin: 0.5rem 0 0 1.2rem; padding: 0;">`;
                data.clinical_findings.forEach(f => {
                    html += `<li style="margin-bottom: 0.3rem;">${f}</li>`;
                });
                html += `</ul>`;
            }
            clinicalBox.innerHTML = html;
        }

        modal.classList.remove('hidden');
    } catch (err) {
        console.error(err);
        showToast('Error al abrir el detalle de la evaluación', 'error');
    }
}

function deleteEvaluation(evalId) {
    showConfirm(
        'Eliminar Evaluación',
        '¿Estás seguro de que deseas eliminar este registro del historial clínico?',
        async () => {
            try {
                const res = await fetch(`/api/evaluations/${evalId}`, { method: 'DELETE', headers: getAuthHeaders() });
                const result = await res.json();
                if (result.success) {
                    showToast('Evaluación eliminada correctamente', 'success');
                    fetchEvaluaciones();
                    fetchDashboardStats();
                } else {
                    showToast('Error al eliminar: ' + result.error, 'error');
                }
            } catch (err) {
                console.error(err);
                showToast('Error de conexión', 'error');
            }
        }
    );
}

// --- 4c. CURVA PhA × EDAD ---
function drawPhACurve(curves, patientAge, patientPhA) {
    const canvas = document.getElementById('phaCurveCanvas');
    if (!canvas || !curves) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const ages = curves.ages;
    const aMin = Math.min(...ages), aMax = Math.max(...ages);
    const allVals = [].concat(curves.p5, curves.p25, curves.p50, curves.p75, curves.p95, [patientPhA || 0]);
    const vMin = Math.min(...allVals) - 1, vMax = Math.max(...allVals) + 1;

    const padL = 34, padR = 14, padT = 14, padB = 22;
    const plotW = w - padL - padR, plotH = h - padT - padB;
    const xOf = (age) => padL + ((age - aMin) / (aMax - aMin || 1)) * plotW;
    const yOf = (val) => padT + plotH - ((val - vMin) / (vMax - vMin || 1)) * plotH;

    // Grid suave
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, padT + plotH / 2); ctx.lineTo(padL + plotW, padT + plotH / 2);
    ctx.moveTo(padL + plotW / 2, padT); ctx.lineTo(padL + plotW / 2, padT + plotH);
    ctx.stroke();

    // Ejes
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); 
    ctx.moveTo(padL, padT); 
    ctx.lineTo(padL, padT + plotH); 
    ctx.lineTo(padL + plotW, padT + plotH); 
    ctx.stroke();

    const series = [
        { key: 'p5', color: 'rgba(239, 68, 68, 0.55)', width: 1.2, dash: [3, 3] },
        { key: 'p25', color: 'rgba(245, 158, 11, 0.65)', width: 1.2, dash: [4, 3] },
        { key: 'p50', color: '#1A2A4A', width: 2.2, dash: [] },
        { key: 'p75', color: 'rgba(245, 158, 11, 0.65)', width: 1.2, dash: [4, 3] },
        { key: 'p95', color: 'rgba(239, 68, 68, 0.55)', width: 1.2, dash: [3, 3] }
    ];
    series.forEach(s => {
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.width;
        ctx.setLineDash(s.dash);
        ctx.beginPath();
        ages.forEach((age, i) => {
            const x = xOf(age), y = yOf(curves[s.key][i]);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.setLineDash([]);
    });

    if (patientPhA && patientAge >= aMin && patientAge <= aMax) {
        const px = xOf(patientAge), py = yOf(patientPhA);
        // Halo
        ctx.beginPath();
        ctx.arc(px, py, 10, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(0, 180, 216, 0.2)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(px, py, 5.5, 0, 2 * Math.PI);
        ctx.fillStyle = '#00b4d8';
        ctx.shadowColor = 'rgba(0, 180, 216, 0.6)';
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // Etiquetas
    ctx.fillStyle = '#64748b';
    ctx.font = '10px Inter, sans-serif';
    ctx.fillText(aMin + 'a', padL, h - 6);
    ctx.fillText(aMax + 'a', padL + plotW - 20, h - 6);
    ctx.fillText(Math.round(vMax * 10) / 10 + '°', 4, padT + 6);
    ctx.fillText(Math.round(vMin * 10) / 10 + '°', 4, padT + plotH);
}

// --- 4d. GRÁFICO BCC (SCATTER PLOT MÚSCULO VS GRASA) ---
function drawBCC(musclePct, fatPct, isMale = true) {
    const canvas = document.getElementById('bccCanvas');
    if (window.bccChartInstance) {
        window.bccChartInstance.destroy();
        window.bccChartInstance = null;
    }
    if (!canvas || !window.Chart) return;

    const mVal = parseFloat(musclePct) || 0;
    const fVal = parseFloat(fatPct) || 0;

    const minX = Math.max(10, Math.min(18, Math.floor(mVal - 6)));
    const maxX = Math.max(54, Math.ceil(mVal + 6));
    const minY = Math.max(5, Math.min(10, Math.floor(fVal - 6)));
    const maxY = Math.max(48, Math.ceil(fVal + 6));

    const refMuscle = isMale ? 37 : 30;
    const refFat = isMale ? 20 : 26;

    window.bccChartInstance = new Chart(canvas, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Paciente Evaluado',
                data: [{ x: mVal, y: fVal }],
                backgroundColor: '#1A2A4A',
                borderColor: '#00b4d8',
                borderWidth: 3,
                pointRadius: 9,
                pointHoverRadius: 11
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(26, 42, 74, 0.95)',
                    titleFont: { size: 12, weight: 'bold' },
                    bodyFont: { size: 12 },
                    padding: 10,
                    cornerRadius: 8,
                    callbacks: {
                        label: (ctx) => `Paciente: ${ctx.raw.x.toFixed(1)}% Músculo | ${ctx.raw.y.toFixed(1)}% Grasa`
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Masa Muscular Esquelética (SMM) %', color: '#5a6f8c', font: { size: 10.5, weight: '600' } },
                    min: minX,
                    max: maxX,
                    grid: { color: 'rgba(226, 232, 240, 0.6)' },
                    ticks: { callback: v => `${v}%`, font: { size: 9.5 } }
                },
                y: {
                    title: { display: true, text: 'Masa Grasa Corporal (FM) %', color: '#5a6f8c', font: { size: 10.5, weight: '600' } },
                    min: minY,
                    max: maxY,
                    grid: { color: 'rgba(226, 232, 240, 0.6)' },
                    ticks: { callback: v => `${v}%`, font: { size: 9.5 } }
                }
            }
        },
        plugins: [{
            id: 'bccQuadrantOverlay',
            beforeDraw: (chart) => {
                const ctx = chart.ctx;
                const xAxis = chart.scales.x;
                const yAxis = chart.scales.y;

                const midX = xAxis.getPixelForValue(refMuscle);
                const midY = yAxis.getPixelForValue(refFat);

                ctx.save();
                // 1. Líneas divisorias de cuadrantes
                ctx.strokeStyle = 'rgba(90, 111, 140, 0.35)';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([4, 4]);

                // Línea vertical (Músculo referencia)
                ctx.beginPath();
                ctx.moveTo(midX, yAxis.top);
                ctx.lineTo(midX, yAxis.bottom);
                ctx.stroke();

                // Línea horizontal (Grasa referencia)
                ctx.beginPath();
                ctx.moveTo(xAxis.left, midY);
                ctx.lineTo(xAxis.right, midY);
                ctx.stroke();

                // 2. Etiquetas de cuadrantes
                ctx.setLineDash([]);
                ctx.font = 'bold 8.5px Inter, sans-serif';

                ctx.fillStyle = 'rgba(45, 122, 74, 0.85)';
                ctx.fillText('I. ATLÉTICO', xAxis.right - 62, yAxis.bottom - 6);

                ctx.fillStyle = 'rgba(0, 180, 216, 0.85)';
                ctx.fillText('II. EQUILIBRADO', xAxis.left + 6, yAxis.bottom - 6);

                ctx.fillStyle = 'rgba(202, 138, 4, 0.85)';
                ctx.fillText('III. ADIPOSO', xAxis.right - 62, yAxis.top + 12);

                ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
                ctx.fillText('IV. SARCOPÉNICO', xAxis.left + 6, yAxis.top + 12);

                ctx.restore();
            }
        }]
    });
}

// --- SIDEBAR DRAWER & DESKTOP COLLAPSE CONTROLLER ---
function initMobileSidebar() {
    const toggleBtn = document.getElementById('sidebar-toggle-btn') || document.getElementById('mobile-menu-btn');
    const closeBtn = document.getElementById('sidebar-close-btn');
    const appLayout = document.querySelector('.app-layout');
    const sidebar = document.querySelector('.sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    const navItems = document.querySelectorAll('.sidebar .nav-item');

    if (!sidebar) return;

    // Restore desktop preference
    const savedCollapsed = localStorage.getItem('sidebar_collapsed');
    if (savedCollapsed === 'true' && window.innerWidth > 992 && appLayout) {
        appLayout.classList.add('sidebar-collapsed');
    }

    const toggleSidebar = () => {
        if (window.innerWidth <= 992) {
            // Mobile: Toggle Drawer
            const isOpen = sidebar.classList.contains('mobile-open');
            if (isOpen) {
                closeMobileDrawer();
            } else {
                openMobileDrawer();
            }
        } else {
            // Desktop: Toggle Collapse
            if (appLayout) {
                appLayout.classList.toggle('sidebar-collapsed');
                const isCollapsed = appLayout.classList.contains('sidebar-collapsed');
                localStorage.setItem('sidebar_collapsed', isCollapsed);
            }
        }
    };

    const openMobileDrawer = () => {
        sidebar.classList.add('mobile-open');
        if (backdrop) backdrop.classList.add('active');
        document.body.style.overflow = 'hidden';
    };

    const closeMobileDrawer = () => {
        sidebar.classList.remove('mobile-open');
        if (backdrop) backdrop.classList.remove('active');
        document.body.style.overflow = '';
    };

    if (toggleBtn) toggleBtn.addEventListener('click', toggleSidebar);
    if (closeBtn) closeBtn.addEventListener('click', closeMobileDrawer);
    if (backdrop) backdrop.addEventListener('click', closeMobileDrawer);

    // Auto-close drawer on navigation click (mobile)
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            if (window.innerWidth <= 992) {
                closeMobileDrawer();
            }
        });
    });

    // Keyboard shortcuts: ESC to close on mobile, Ctrl+B to toggle on desktop
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebar.classList.contains('mobile-open')) {
            closeMobileDrawer();
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
            e.preventDefault();
            toggleSidebar();
        }
    });
}


// --- FIELD INFO POPUP & AUTO-FOCUS CONTROLLER ---
function initFieldInfoPopups() {
    const modal = document.getElementById('info-modal');
    if (!modal) return;

    const titleEl = document.getElementById('info-modal-title');
    const descEl = document.getElementById('info-modal-desc');
    const reqEl = document.getElementById('info-modal-req');
    const closeBtn = document.getElementById('info-modal-close');
    const cancelBtn = document.getElementById('info-modal-btn-cancel');
    const goBtn = document.getElementById('info-modal-btn-go');

    let currentTargetInputId = null;

    const closeModal = () => {
        modal.classList.add('hidden');
        currentTargetInputId = null;
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Delegate click for all info buttons
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.field-info-btn');
        if (!btn) return;

        e.preventDefault();
        e.stopPropagation();

        const title = btn.getAttribute('data-info-title') || 'Información del Campo';
        const desc = btn.getAttribute('data-info-desc') || 'Este parámetro requiere información adicional del dispositivo.';
        const req = btn.getAttribute('data-info-req') || 'Dato del dispositivo de bioimpedancia';
        currentTargetInputId = btn.getAttribute('data-focus-input');

        if (titleEl) titleEl.textContent = title;
        if (descEl) descEl.textContent = desc;
        if (reqEl) reqEl.textContent = req;

        modal.classList.remove('hidden');
    });

    // Go to form button
    if (goBtn) {
        goBtn.addEventListener('click', () => {
            const reqLabel = reqEl ? reqEl.textContent : 'el dato';
            const targetId = currentTargetInputId;
            closeModal();

            // 1. Asegurar que la vista activa sea Bioimpedancia
            const bioNav = document.querySelector('[data-target="bio-view"]');
            if (bioNav) {
                bioNav.click();
            }

            // 2. Abrir sección de datos del dispositivo inmediatamente
            const details = document.querySelector('details.device-data');
            if (details) {
                details.open = true;
            }

            // 3. Resaltar panel de formulario con animación luminosa
            const formSection = document.querySelector('.bio-form-horizontal') || document.querySelector('.bio-form-panel');
            if (formSection) {
                formSection.classList.remove('form-focus-pulse');
                void formSection.offsetWidth;
                formSection.classList.add('form-focus-pulse');
            }

            // 4. Desplazamiento animado del scroll (.main-content y window)
            const mainContent = document.querySelector('.main-content');
            if (mainContent) {
                mainContent.scrollTo({ top: 0, behavior: 'smooth' });
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });

            // 5. Enfocar y centrar en pantalla el input específico
            setTimeout(() => {
                if (targetId) {
                    const targetInput = document.getElementById(targetId);
                    if (targetInput) {
                        targetInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        targetInput.focus({ preventScroll: true });
                        targetInput.classList.remove('input-highlight-pulse');
                        void targetInput.offsetWidth;
                        targetInput.classList.add('input-highlight-pulse');
                    }
                }
            }, 180);

            showToast('Completa ' + reqLabel + ' en el formulario', 'info');
        });
    }
}

// --- DEMO DATA INJECTOR CONTROLLER ---
function initDemoDataInjector() {
    const btnDemo = document.getElementById('btn-fill-demo');
    if (!btnDemo) return;

    const maleFirstNames = [
        'Carlos', 'Alejandro', 'Mateo', 'Rodrigo', 'Sebastián', 'Gabriel', 'Lucas', 'Joaquín',
        'Daniel', 'Felipe', 'Andrés', 'Diego', 'Nicolás', 'Martín', 'Esteban', 'Ignacio',
        'Bruno', 'Leonardo', 'Mauricio', 'Fernando', 'Álvaro', 'Javier', 'Gonzalo', 'Emilio'
    ];
    const femaleFirstNames = [
        'Sofía', 'Camila', 'Valentina', 'Isabella', 'Lucía', 'Mariana', 'Valeria', 'Elena',
        'Catalina', 'Paula', 'Renata', 'Abril', 'Jimena', 'Victoria', 'Natalia', 'Gabriela',
        'Daniela', 'Carolina', 'Andrea', 'Claudia', 'Florencia', 'Luciana', 'Micaela', 'Julieta'
    ];
    const lastNames = [
        'Morales', 'Mendoza', 'Fernández', 'Vargas', 'Herrera', 'Rojas', 'Benítez', 'Navarro',
        'Castro', 'Ortiz', 'Paredes', 'Salazar', 'Fuentes', 'Silva', 'Aguilar', 'Alarcón',
        'Gómez', 'Ríos', 'Castillo', 'Espinoza', 'Torres', 'Guzmán', 'Ramos', 'Delgado',
        'Medina', 'Romero', 'Miranda', 'Flores', 'Suárez', 'Cáceres', 'Justiniano', 'Mercado'
    ];

    // Perfiles arquetípicos para variar los resultados clínicos del vector BIA
    const clinicalArchetypes = [
        {
            type: 'normopeso',
            desc: 'Eutrófico / Saludable',
            bmiMin: 20.5, bmiMax: 23.8,
            ageMin: 22, ageMax: 45,
            rMale: [490, 560], xcMale: [58, 70],
            rFemale: [530, 610], xcFemale: [55, 68],
            waistRatioMale: 0.44, waistRatioFemale: 0.43,
            smmRatioMale: 0.46, smmRatioFemale: 0.38,
            fatPctMale: 15, fatPctFemale: 23,
            visceralMale: 1.1, visceralFemale: 1.0,
            palList: ['1.55', '1.725']
        },
        {
            type: 'atleta',
            desc: 'Atlético / Alta Masa Muscular',
            bmiMin: 23.0, bmiMax: 26.5,
            ageMin: 20, ageMax: 36,
            rMale: [430, 490], xcMale: [66, 78],
            rFemale: [480, 540], xcFemale: [64, 76],
            waistRatioMale: 0.42, waistRatioFemale: 0.40,
            smmRatioMale: 0.52, smmRatioFemale: 0.44,
            fatPctMale: 11, fatPctFemale: 17,
            visceralMale: 1.0, visceralFemale: 1.0,
            palList: ['1.725', '1.9']
        },
        {
            type: 'sobrepeso',
            desc: 'Sobrepeso / Adiposidad Moderada',
            bmiMin: 26.5, bmiMax: 31.0,
            ageMin: 28, ageMax: 58,
            rMale: [460, 530], xcMale: [46, 56],
            rFemale: [510, 590], xcFemale: [44, 54],
            waistRatioMale: 0.53, waistRatioFemale: 0.52,
            smmRatioMale: 0.39, smmRatioFemale: 0.31,
            fatPctMale: 26, fatPctFemale: 34,
            visceralMale: 1.6, visceralFemale: 1.4,
            palList: ['1.2', '1.375']
        },
        {
            type: 'adulto_mayor',
            desc: 'Adulto Mayor / Sarcopenia Leve',
            bmiMin: 21.0, bmiMax: 25.0,
            ageMin: 60, ageMax: 76,
            rMale: [550, 640], xcMale: [36, 47],
            rFemale: [600, 710], xcFemale: [34, 45],
            waistRatioMale: 0.50, waistRatioFemale: 0.49,
            smmRatioMale: 0.36, smmRatioFemale: 0.28,
            fatPctMale: 24, fatPctFemale: 33,
            visceralMale: 1.4, visceralFemale: 1.3,
            palList: ['1.2', '1.375']
        },
        {
            type: 'joven_activo',
            desc: 'Joven Dinámico / Estudiante',
            bmiMin: 21.5, bmiMax: 24.5,
            ageMin: 19, ageMax: 29,
            rMale: [470, 530], xcMale: [60, 72],
            rFemale: [510, 580], xcFemale: [58, 70],
            waistRatioMale: 0.43, waistRatioFemale: 0.41,
            smmRatioMale: 0.48, smmRatioFemale: 0.40,
            fatPctMale: 14, fatPctFemale: 21,
            visceralMale: 1.0, visceralFemale: 1.0,
            palList: ['1.55', '1.725']
        }
    ];

    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    const randRange = (min, max, decimals = 1) => {
        const val = min + Math.random() * (max - min);
        return Number(val.toFixed(decimals));
    };

    btnDemo.addEventListener('click', (e) => {
        e.preventDefault();

        // 1. Seleccionar género aleatorio
        const isMale = Math.random() > 0.5;
        const gender = isMale ? 'male' : 'female';
        
        // 2. Generar nombre de persona directo (Sin Dr. ni Dra.)
        const firstName = isMale ? pick(maleFirstNames) : pick(femaleFirstNames);
        const lastName1 = pick(lastNames);
        let lastName2 = pick(lastNames);
        while (lastName2 === lastName1) {
            lastName2 = pick(lastNames);
        }
        const fullName = `${firstName} ${lastName1} ${lastName2}`;

        // 3. Seleccionar arquetipo clínico aleatorio
        const arch = pick(clinicalArchetypes);

        // 4. Medidas antropométricas realistas
        const height = isMale ? randRange(166, 187, 0) : randRange(153, 173, 0);
        const targetBmi = randRange(arch.bmiMin, arch.bmiMax, 1);
        const hM = height / 100;
        const weight = Number((targetBmi * (hM * hM)).toFixed(1));
        const age = randRange(arch.ageMin, arch.ageMax, 0);
        const waistRatio = isMale ? arch.waistRatioMale : arch.waistRatioFemale;
        const waist = Number((height * waistRatio + randRange(-2, 2, 1)).toFixed(1));
        const pal = pick(arch.palList);

        // 5. Parámetros Bioeléctricos (R y Xc en 50 kHz)
        const rRange = isMale ? arch.rMale : arch.rFemale;
        const xcRange = isMale ? arch.xcMale : arch.xcFemale;
        const r = randRange(rRange[0], rRange[1], 1);
        const xc = randRange(xcRange[0], xcRange[1], 1);

        // 6. IDP autoincremental o aleatorio
        let idpVal = 'IDP-0001';
        if (typeof getNextAvailableIDP === 'function') {
            idpVal = getNextAvailableIDP();
        } else {
            idpVal = `IDP-${String(randRange(1001, 9999, 0)).padStart(4, '0')}`;
        }

        // Inyectar en campos básicos
        const inputIdp = document.getElementById('input-idp');
        const inputName = document.getElementById('input-name');
        const inputR = document.getElementById('input-r');
        const inputXc = document.getElementById('input-xc');
        const inputWeight = document.getElementById('input-weight');
        const inputHeight = document.getElementById('input-height');
        const inputAge = document.getElementById('input-age');
        const inputGender = document.getElementById('input-gender');
        const inputPal = document.getElementById('input-pal');
        const inputWaist = document.getElementById('input-waist');

        if (inputIdp) inputIdp.value = idpVal;
        if (inputName) inputName.value = fullName;
        if (inputR) inputR.value = r.toFixed(1);
        if (inputXc) inputXc.value = xc.toFixed(1);
        if (inputWeight) inputWeight.value = weight.toFixed(1);
        if (inputHeight) inputHeight.value = height.toString();
        if (inputAge) inputAge.value = age.toString();
        if (inputGender) inputGender.value = gender;
        if (inputPal) inputPal.value = pal;
        if (inputWaist) inputWaist.value = waist.toFixed(1);

        // 7. Parámetros del dispositivo calculados consistentemente
        const details = document.querySelector('details.device-data');
        if (details) details.open = true;

        const smmRatio = isMale ? arch.smmRatioMale : arch.smmRatioFemale;
        const smm = Number((weight * smmRatio + randRange(-0.8, 0.8, 1)).toFixed(1));
        const tbw = Number((weight * (isMale ? 0.58 : 0.51) + randRange(-1.2, 1.2, 1)).toFixed(1));
        const ecw = Number((tbw * 0.39 + randRange(-0.4, 0.4, 1)).toFixed(1));
        const fatPct = isMale ? arch.fatPctMale : arch.fatPctFemale;
        const fatMass = Number((weight * (fatPct / 100) + randRange(-0.7, 0.7, 1)).toFixed(1));
        const visceral = Number((arch.visceralMale + randRange(-0.1, 0.3, 1)).toFixed(1));
        const phaseDev = Number((Math.atan2(xc, r) * (180 / Math.PI)).toFixed(1));

        const segArmR = Number((smm * 0.088).toFixed(2));
        const segArmL = Number((smm * 0.086).toFixed(2));
        const segTorso = Number((smm * 0.54).toFixed(1));
        const segLegR = Number((smm * 0.243).toFixed(1));
        const segLegL = Number((smm * 0.241).toFixed(1));

        const elSmm = document.getElementById('input-smm');
        const elTbw = document.getElementById('input-tbw');
        const elEcw = document.getElementById('input-ecw');
        const elFat = document.getElementById('input-fat-mass');
        const elVisc = document.getElementById('input-visceral');
        const elPhaseDev = document.getElementById('input-phase-dev');
        const elArmR = document.getElementById('input-seg-arm-r');
        const elArmL = document.getElementById('input-seg-arm-l');
        const elTorso = document.getElementById('input-seg-torso');
        const elLegR = document.getElementById('input-seg-leg-r');
        const elLegL = document.getElementById('input-seg-leg-l');

        if (elSmm) elSmm.value = smm.toFixed(1);
        if (elTbw) elTbw.value = tbw.toFixed(1);
        if (elEcw) elEcw.value = ecw.toFixed(1);
        if (elFat) elFat.value = fatMass.toFixed(1);
        if (elVisc) elVisc.value = Math.max(1.0, visceral).toFixed(1);
        if (elPhaseDev) elPhaseDev.value = phaseDev.toFixed(1);
        if (elArmR) elArmR.value = segArmR.toFixed(2);
        if (elArmL) elArmL.value = segArmL.toFixed(2);
        if (elTorso) elTorso.value = segTorso.toFixed(1);
        if (elLegR) elLegR.value = segLegR.toFixed(1);
        if (elLegL) elLegL.value = segLegL.toFixed(1);

        // 8. Destello visual sutil en campos
        const allInputs = document.querySelectorAll('#bio-form input, #bio-form select');
        allInputs.forEach(input => {
            input.classList.remove('input-highlight-pulse');
            void input.offsetWidth;
            input.classList.add('input-highlight-pulse');
        });

        showToast(`🧪 Caso generado: ${fullName} (${arch.desc})`, 'info');
    });
}

// --- PROFILE & WORKSTATION STATE CONTROLLER (OPCIÓN 1) ---
function updateUserProfileUI() {
    const user = currentAuthUser || {};
    const isAdmin = user.role === 'admin';

    const userId = user.id || 'guest';
    const name = user.full_name || localStorage.getItem(`vm_user_name_${userId}`) || (isAdmin ? 'Administrador General' : '');
    const title = user.professional_title || localStorage.getItem(`vm_user_title_${userId}`) || (isAdmin ? 'Director / Administrador de Plataforma' : '');
    const clinic = user.clinic_name || localStorage.getItem(`vm_clinic_name_${userId}`) || (isAdmin ? 'Sede Central VitaMetrix' : '');
    const phone = (user.phone !== undefined && user.phone !== null) ? user.phone : (localStorage.getItem(`vm_pdf_phone_${userId}`) || '');
    const mp = (user.professional_license !== undefined && user.professional_license !== null) ? user.professional_license : (localStorage.getItem(`vm_pdf_mp_${userId}`) || '');
    
    // Topbar update
    const topName = document.getElementById('topbar-user-name');
    const topTitle = document.getElementById('topbar-user-title');
    const topAvatar = document.getElementById('topbar-user-avatar');
    if (topName) topName.textContent = name;
    if (topTitle) topTitle.textContent = title;
    if (topAvatar) {
        topAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${isAdmin ? '6366f1' : '00b4d8'}&color=fff`;
    }

    // Modal Profile Elements
    const modalHeader = document.getElementById('profile-modal-header');
    const modalName = document.getElementById('profile-modal-name');
    const modalRoleBadge = document.getElementById('profile-modal-role-badge');
    const modalTitle = document.getElementById('profile-modal-title');
    const modalAvatar = document.getElementById('profile-modal-avatar');

    // 4 Bento Cards
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

    // Stats Section
    const statsTitle = document.getElementById('profile-modal-stats-title');
    const stat1Label = document.getElementById('profile-modal-stat1-label');
    const statPatients = document.getElementById('profile-modal-stat-patients');
    const stat2Label = document.getElementById('profile-modal-stat2-label');
    const statEvals = document.getElementById('profile-modal-stat-evals');
    const stat3Label = document.getElementById('profile-modal-stat3-label');
    const statAppts = document.getElementById('profile-modal-stat-appts');

    // Action Button
    const btnEdit = document.getElementById('profile-modal-btn-edit');

    if (modalName) modalName.textContent = name;
    if (modalTitle) modalTitle.textContent = title;

    if (isAdmin) {
        // --- VISTA EXCLUSIVA SUPERADMIN ---
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

        // Bento 1: Rol de Plataforma
        if (card1Label) card1Label.textContent = 'Rol en la Plataforma';
        if (card1IconBox) { card1IconBox.style.backgroundColor = '#ede9fe'; card1IconBox.style.color = '#6d28d9'; }
        if (card1Icon) card1Icon.className = 'bi bi-shield-lock-fill fs-5';
        if (modalMp) modalMp.innerHTML = '<span class="text-primary fw-bold">SuperAdmin (Control Total)</span>';

        // Bento 2: Sede de Administración
        if (card2Label) card2Label.textContent = 'Sede de Administración';
        if (card2IconBox) { card2IconBox.style.backgroundColor = '#e0e7ff'; card2IconBox.style.color = '#4338ca'; }
        if (card2Icon) card2Icon.className = 'bi bi-building-fill fs-5';
        if (modalClinic) modalClinic.textContent = clinic || 'Sede Central VitaMetrix';

        // Bento 3: Teléfono Soporte
        if (card3Label) card3Label.textContent = 'Teléfono / Soporte Oficial';
        if (card3IconBox) { card3IconBox.style.backgroundColor = '#dcfce7'; card3IconBox.style.color = '#15803d'; }
        if (card3Icon) card3Icon.className = 'bi bi-telephone-fill fs-5';
        if (modalPhone) modalPhone.textContent = phone || '+591 72125280';

        // Bento 4: Suscripción / Acceso
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

        // Estadísticas de Plataforma Global
        if (statsTitle) statsTitle.textContent = 'Métricas Globales de Plataforma';
        if (stat1Label) stat1Label.textContent = 'Médicos Registrados';
        if (stat2Label) stat2Label.textContent = 'PINs Creados';
        if (stat3Label) stat3Label.textContent = 'PINs Disponibles';

        const totalUsers = allAdminUsersData.length || 2;
        const totalPins = allAdminPinsData.length || 0;
        const availablePins = allAdminPinsData.filter(p => !p.is_used).length || 0;

        if (statPatients) statPatients.textContent = totalUsers;
        if (statEvals) statEvals.textContent = totalPins;
        if (statAppts) statAppts.textContent = availablePins;

        // Botón de Acción para SuperAdmin
        if (btnEdit) {
            btnEdit.className = 'btn btn-warning text-dark px-4 py-2.5 fw-bold d-inline-flex align-items-center gap-2 rounded-3 shadow-md';
            btnEdit.innerHTML = '<i class="bi bi-shield-lock-fill fs-5"></i><span>Ir al Panel SuperAdmin</span>';
        }
    } else {
        // --- VISTA MÉDICO / USUARIO CLÍNICO ---
        if (modalHeader) {
            modalHeader.style.background = 'linear-gradient(135deg, #091e3a 0%, #0f2b4c 50%, #0284c7 100%)';
        }
        if (modalAvatar) {
            modalAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=ffffff&color=0284c7&size=128`;
        }
        if (modalRoleBadge) {
            modalRoleBadge.classList.add('d-none');
        }

        // Bento 1: Matrícula Profesional
        if (card1Label) card1Label.textContent = 'Matrícula Profesional';
        if (card1IconBox) { card1IconBox.style.backgroundColor = '#e0f2fe'; card1IconBox.style.color = '#0284c7'; }
        if (card1Icon) card1Icon.className = 'bi bi-award-fill fs-5';
        if (modalMp) modalMp.textContent = mp || 'Sin matrícula registrada';

        // Bento 2: Centro Clínico
        if (card2Label) card2Label.textContent = 'Centro Clínico Asignado';
        if (card2IconBox) { card2IconBox.style.backgroundColor = '#e0e7ff'; card2IconBox.style.color = '#4338ca'; }
        if (card2Icon) card2Icon.className = 'bi bi-hospital-fill fs-5';
        if (modalClinic) modalClinic.textContent = clinic || 'Centro Médico VitaMetrix';

        // Bento 3: Contacto
        if (card3Label) card3Label.textContent = 'Contacto / Teléfono';
        if (card3IconBox) { card3IconBox.style.backgroundColor = '#dcfce7'; card3IconBox.style.color = '#15803d'; }
        if (card3Icon) card3Icon.className = 'bi bi-telephone-fill fs-5';
        if (modalPhone) modalPhone.textContent = phone || 'Sin teléfono';

        // Bento 4: Estación
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

        // Resumen de Actividad
        if (statsTitle) statsTitle.textContent = 'Resumen de Actividad';
        if (stat1Label) stat1Label.textContent = 'Pacientes';
        if (stat2Label) stat2Label.textContent = 'Estudios BIA';
        if (stat3Label) stat3Label.textContent = 'Citas de Hoy';

        if (statPatients) {
            const clientsTotalEl = document.getElementById('clients-total-count');
            const dashPatientsEl = document.getElementById('dash-total-patients');
            statPatients.textContent = (clientsTotalEl && clientsTotalEl.textContent !== '0') ? clientsTotalEl.textContent : (dashPatientsEl ? dashPatientsEl.textContent : (allClientsData.length || '0'));
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

        // Botón de Acción para Médicos
        if (btnEdit) {
            btnEdit.className = 'btn btn-primary px-4 py-2.5 fw-bold d-inline-flex align-items-center gap-2 rounded-3 shadow-md';
            btnEdit.innerHTML = '<i class="bi bi-gear-fill fs-5"></i><span>Editar en Configuración</span>';
        }
    }
}

function initSystemMenuListeners() {
    // Listeners para módulos del sistema y perfil
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

    // Modal de Perfil Profesional (Opción 1: Credencial Digital y Estado de Sesión)
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

    // Cerrar al hacer clic en el backdrop oscuro
    if (profileModal) {
        profileModal.addEventListener('click', (e) => {
            if (e.target === profileModal) closeProfileModal();
        });
    }

    // Botón de acción dentro del modal de perfil (SuperAdmin vs Doctor)
    if (profileModalBtnEdit) {
        profileModalBtnEdit.addEventListener('click', () => {
            closeProfileModal();
            if (currentAuthUser && currentAuthUser.role === 'admin') {
                navigateToView('superadmin-view', true);
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
                            void cfgCard.offsetWidth; // Trigger reflow
                            cfgCard.classList.add('highlight-pulse');
                        }
                        if (userNameInput) userNameInput.focus();
                    }, 250);
                }
            }
        });
    }

    // Switch User Modal (Cambiar Especialista)
    const switchModal = document.getElementById('switch-user-modal');
    const switchModalClose = document.getElementById('switch-user-modal-close');
    const switchModalBtnCancel = document.getElementById('switch-user-btn-cancel');
    const switchForm = document.getElementById('switch-user-form');
    const dropLogoutBtn = document.getElementById('dropdown-logout-btn');

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

    // Inicializar UI de perfil al cargar
    updateUserProfileUI();
}

// ============================================================
// --- CLINICAL CALENDAR & APPOINTMENTS CONTROLLER ---
// ============================================================
let clinicAppointments = [];
let calCurrentDate = new Date();
let calSelectedDateStr = new Date().toISOString().split('T')[0];

const MONTH_NAMES_ES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

async function initAppointmentsCalendar() {
    initAppointmentModal();
    initCalendarNav();
    await fetchAppointmentsList();
    renderClinicCalendar();
    renderSelectedDayAppointments();
    populateClientsDatalist();
}

function initCalendarNav() {
    const prevBtn = document.getElementById('cal-prev-month');
    const nextBtn = document.getElementById('cal-next-month');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            calCurrentDate.setMonth(calCurrentDate.getMonth() - 1);
            renderClinicCalendar();
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            calCurrentDate.setMonth(calCurrentDate.getMonth() + 1);
            renderClinicCalendar();
        });
    }
}

async function fetchAppointmentsList() {
    try {
        const res = await fetch('/api/appointments', { headers: getAuthHeaders() });
        if (res.ok) {
            const data = await res.json();
            clinicAppointments = Array.isArray(data) ? data : [];
        } else {
            clinicAppointments = [];
        }
    } catch (e) {
        console.error('Error fetching appointments:', e);
        clinicAppointments = [];
    }
}

function renderClinicCalendar() {
    const grid = document.getElementById('calendar-days-grid');
    const monthLabel = document.getElementById('cal-month-label');
    if (!grid || !monthLabel) return;

    const year = calCurrentDate.getFullYear();
    const month = calCurrentDate.getMonth();

    monthLabel.textContent = `${MONTH_NAMES_ES[month]} ${year}`;

    // First day of month (0 = Sunday, 1 = Monday...)
    const firstDay = new Date(year, month, 1);
    let startDayIndex = firstDay.getDay() - 1; // Convert to Monday = 0
    if (startDayIndex === -1) startDayIndex = 6; // Sunday

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = new Date().toISOString().split('T')[0];

    const frag = document.createDocumentFragment();

    // Empty previous month padding cells
    for (let i = 0; i < startDayIndex; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'cal-day-cell empty-day';
        frag.appendChild(emptyCell);
    }

    // Days of current month
    for (let day = 1; day <= daysInMonth; day++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'cal-day-cell';
        dayCell.textContent = day;

        const dayDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        if (dayDateStr === todayStr) {
            dayCell.classList.add('today');
        }
        if (dayDateStr === calSelectedDateStr) {
            dayCell.classList.add('selected');
        }

        // Check if day has appointments
        const dayAppts = clinicAppointments.filter(a => a.date === dayDateStr);
        if (dayAppts.length > 0) {
            const hasPending = dayAppts.some(a => a.status === 'pending');
            const dot = document.createElement('span');
            dot.className = `cal-day-dot ${hasPending ? 'dot-has-pending' : 'dot-has-confirmed'}`;
            dayCell.appendChild(dot);
        }

        dayCell.addEventListener('click', () => {
            calSelectedDateStr = dayDateStr;
            renderClinicCalendar();
            renderSelectedDayAppointments();
        });

        frag.appendChild(dayCell);
    }

    grid.replaceChildren(frag);
}

function renderSelectedDayAppointments() {
    const listContainer = document.getElementById('day-appointments-list');
    const titleEl = document.getElementById('day-appointments-title');
    const countEl = document.getElementById('day-appointments-count');
    if (!listContainer) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const isToday = calSelectedDateStr === todayStr;

    const parts = calSelectedDateStr.split('-');
    const formattedDate = (parts.length === 3) ? `${parts[2]} de ${MONTH_NAMES_ES[parseInt(parts[1]) - 1]}` : calSelectedDateStr;

    if (titleEl) {
        titleEl.textContent = isToday ? 'Citas de hoy' : `Citas: ${formattedDate}`;
    }

    const dayAppts = clinicAppointments.filter(a => a.date === calSelectedDateStr);
    dayAppts.sort((a, b) => (a.time || '').localeCompare(b.time || ''));

    if (countEl) {
        countEl.textContent = `${dayAppts.length} cita${dayAppts.length === 1 ? '' : 's'}`;
    }

    if (dayAppts.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'appt-empty-state';
        empty.innerHTML = `
            <span>☕ Sin citas programadas para este día.</span>
            <button type="button" class="btn-link-action" onclick="openNewAppointmentForDate('${calSelectedDateStr}')" style="font-size:0.78rem; margin-top:0.2rem;">
                + Agendar para este día
            </button>
        `;
        listContainer.replaceChildren(empty);
        return;
    }

    const frag = document.createDocumentFragment();

    dayAppts.forEach(appt => {
        const card = document.createElement('div');
        card.className = 'appt-item-card';

        const isConf = (appt.status || 'confirmed') === 'confirmed';
        const statusBadgeHtml = isConf
            ? '<span class="status-chip green" style="font-size:0.68rem; padding:0.1rem 0.45rem;">🟢 Confirmada</span>'
            : '<span class="status-chip yellow" style="font-size:0.68rem; padding:0.1rem 0.45rem;">🟡 Pendiente</span>';

        card.innerHTML = `
            <div class="appt-top-row">
                <span class="appt-time-badge">🕒 ${appt.time || '09:00'}</span>
                ${statusBadgeHtml}
            </div>
            <div>
                <h4 class="appt-patient-name">${escapeHtml(appt.patient_name || 'Paciente')}</h4>
                <div class="appt-type-tag">${escapeHtml(appt.type || 'Evaluación BIA')} ${appt.notes ? '• <em style="color:#64748b;">' + escapeHtml(appt.notes) + '</em>' : ''}</div>
            </div>
            <div class="appt-actions-row">
                <button type="button" class="btn-start-bia-appt" title="Cargar paciente en el analizador de bioimpedancia">
                    ⚡ Iniciar BIA
                </button>
                <button type="button" class="btn-delete-appt" title="Eliminar cita">
                    🗑️
                </button>
            </div>
        `;

        // Start BIA calculation from appointment
        const startBtn = card.querySelector('.btn-start-bia-appt');
        if (startBtn) {
            startBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                startEvaluationFromAppointment(appt);
            });
        }

        // Delete appointment
        const delBtn = card.querySelector('.btn-delete-appt');
        if (delBtn) {
            delBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                showConfirm('Eliminar Cita', `¿Deseas cancelar la cita de ${appt.patient_name}?`, async () => {
                    await deleteAppointment(appt.id);
                });
            });
        }

        frag.appendChild(card);
    });

    listContainer.replaceChildren(frag);
}

function startEvaluationFromAppointment(appt) {
    // 1. Switch to Bioimpedancia view
    const bioNav = document.querySelector('[data-target="bio-view"]');
    if (bioNav) bioNav.click();

    // 2. Fill basic data
    if (appt.patient_name) document.getElementById('input-name').value = appt.patient_name;
    if (appt.patient_idp) document.getElementById('input-idp').value = appt.patient_idp;

    // 3. Highlight form
    const formPanel = document.querySelector('.bio-form-horizontal') || document.querySelector('.bio-form-panel');
    if (formPanel) {
        formPanel.classList.remove('form-focus-pulse');
        void formPanel.offsetWidth;
        formPanel.classList.add('form-focus-pulse');
    }

    // 4. Scroll smoothly to top
    const mainContent = document.querySelector('.main-content');
    if (mainContent) mainContent.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });

    showToast(`Paciente ${appt.patient_name} cargado/a desde la agenda clínica.`, 'success');
}

function initAppointmentModal() {
    const modal = document.getElementById('appointment-modal');
    const openBtn = document.getElementById('btn-open-appointment-modal');
    const closeBtn = document.getElementById('appt-modal-close');
    const cancelBtn = document.getElementById('appt-btn-cancel');
    const form = document.getElementById('appointment-form');

    const closeModal = () => {
        if (modal) modal.classList.add('hidden');
        if (form) form.reset();
        document.getElementById('appt-edit-id').value = '';
    };

    if (openBtn) {
        openBtn.addEventListener('click', () => {
            const todayStr = new Date().toISOString().split('T')[0];
            document.getElementById('appt-date').value = calSelectedDateStr || todayStr;
            populateClientsDatalist();
            if (modal) modal.classList.remove('hidden');
        });
    }

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnSave = document.getElementById('appt-btn-save');
            const originalText = btnSave ? btnSave.textContent : 'Guardar';
            if (btnSave) { btnSave.textContent = 'Guardando...'; btnSave.disabled = true; }

            const payload = {
                patient_name: document.getElementById('appt-patient-name').value.trim(),
                patient_phone: document.getElementById('appt-patient-phone').value.trim(),
                date: document.getElementById('appt-date').value,
                time: document.getElementById('appt-time').value,
                type: document.getElementById('appt-type').value,
                status: document.getElementById('appt-status').value,
                notes: document.getElementById('appt-notes').value.trim()
            };

            try {
                const res = await fetch('/api/appointments', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                    body: JSON.stringify(payload)
                });
                const result = await res.json();
                if (result.success) {
                    showToast('Cita agendada exitosamente 📅', 'success');
                    closeModal();
                    await fetchAppointmentsList();
                    renderClinicCalendar();
                    renderSelectedDayAppointments();
                } else {
                    showToast('Error al guardar: ' + (result.error || 'Intente nuevamente'), 'error');
                }
            } catch (err) {
                console.error(err);
                showToast('Error de conexión', 'error');
            } finally {
                if (btnSave) { btnSave.textContent = originalText; btnSave.disabled = false; }
            }
        });
    }
}

function openNewAppointmentForDate(dateStr) {
    const modal = document.getElementById('appointment-modal');
    document.getElementById('appt-date').value = dateStr;
    populateClientsDatalist();
    if (modal) modal.classList.remove('hidden');
}

async function deleteAppointment(apptId) {
    try {
        const res = await fetch(`/api/appointments/${apptId}`, { method: 'DELETE', headers: getAuthHeaders() });
        const result = await res.json();
        if (result.success) {
            clinicAppointments = clinicAppointments.filter(a => a.id !== apptId);
            showToast('Cita eliminada correctamente', 'info');
            renderClinicCalendar();
            renderSelectedDayAppointments();
        } else {
            showToast('Error al eliminar cita', 'error');
        }
    } catch (e) {
        console.error(e);
        showToast('Error de conexión', 'error');
    }
}

async function populateClientsDatalist() {
    const datalist = document.getElementById('clients-datalist');
    if (!datalist) return;
    try {
        const res = await fetch('/api/clients', { headers: getAuthHeaders() });
        if (res.ok) {
            const clients = await res.json();
            if (Array.isArray(clients)) {
                datalist.replaceChildren();
                clients.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.name;
                    opt.label = c.phone ? `Tel: ${c.phone}` : '';
                    datalist.appendChild(opt);
                });
            }
        }
    } catch (e) {
        // Silently ignore
    }
}

// ============================================================
// --- CONFIGURACIÓN VIEW, MAPA LEAFLET & EXPORTACIÓN CONTROLLER ---
// ============================================================
let clinicLeafletMap = null;
let clinicMarker = null;

function initConfiguracionView() {
    const btnSave = document.getElementById('btn-save-all-settings');
    const btnLocate = document.getElementById('btn-locate-me');
    const btnExportCsv = document.getElementById('btn-export-csv');
    const btnExportJson = document.getElementById('btn-export-json');
    const inputJsonFile = document.getElementById('cfg-json-file-input');
    const inputLogoFile = document.getElementById('cfg-logo-file-input');
    const themeToggle = document.getElementById('cfg-theme-toggle');

    // Cargar todos los ajustes persistentes
    const loadAllSettings = () => {
        const user = currentAuthUser || {};
        const userId = user.id || 'guest';
        const isAdmin = user.role === 'admin';

        const getProp = (userVal, localKey, defaultVal = '') => {
            if (userVal !== undefined && userVal !== null) return userVal;
            const stored = localStorage.getItem(localKey);
            return (stored !== null && stored !== undefined) ? stored : defaultVal;
        };

        const name = getProp(user.full_name, `vm_user_name_${userId}`);
        const title = getProp(user.professional_title, `vm_user_title_${userId}`);
        const clinic = getProp(user.clinic_name, `vm_clinic_name_${userId}`);
        const unit = getProp(user.unit_weight, `vm_unit_weight_${userId}`, 'kg');
        const pha = getProp(user.pha_optimal, `vm_pha_optimal_${userId}`, '6.0');
        const mp = getProp(user.professional_license, `vm_pdf_mp_${userId}`);
        const phone = getProp(user.phone, `vm_pdf_phone_${userId}`);
        const logoUrl = getProp(user.clinic_logo_url, `vm_pdf_logo_url_${userId}`);
        const disclaimer = getProp(user.pdf_disclaimer, `vm_pdf_disclaimer_${userId}`, 'Consulte con su profesional de la salud antes de iniciar cualquier plan nutricional o de entrenamiento.');
        const address = getProp(user.clinic_address, `vm_clinic_address_${userId}`);
        const lat = localStorage.getItem(`vm_clinic_lat_${userId}`) || localStorage.getItem('vm_clinic_lat') || '-34.6037';
        const lng = localStorage.getItem(`vm_clinic_lng_${userId}`) || localStorage.getItem('vm_clinic_lng') || '-58.3816';
        const darkTheme = localStorage.getItem('vm_dark_theme') === 'true';

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val || '';
        };

        setVal('cfg-user-name', name);
        setVal('cfg-user-title', title);
        setVal('cfg-clinic-name', clinic);
        setVal('cfg-unit-weight', unit);
        setVal('cfg-pha-optimal', pha);
        setVal('cfg-pdf-mp', mp);
        setVal('cfg-pdf-phone', phone);
        setVal('cfg-pdf-logo-url', logoUrl);
        const logoPreview = document.getElementById('cfg-logo-preview');
        const defaultLogo = `https://ui-avatars.com/api/?name=${encodeURIComponent(clinic || name || 'VitaMetrix')}&background=00b4d8&color=fff`;
        if (logoPreview) {
            logoPreview.src = logoUrl || defaultLogo;
            logoPreview.onerror = function() {
                this.onerror = null;
                this.src = defaultLogo;
            };
        }
        setVal('cfg-pdf-disclaimer', disclaimer);
        setVal('cfg-clinic-address', address);
        setVal('cfg-clinic-lat', lat);
        setVal('cfg-clinic-lng', lng);

        if (themeToggle) {
            themeToggle.checked = darkTheme;
            applyThemeMode(darkTheme);
        }

        updateUserProfileUI();
    };

    window.loadAllSettings = loadAllSettings;
    loadAllSettings();

    // Guardar todos los cambios
    if (btnSave) {
        btnSave.addEventListener('click', async () => {
            const getVal = (id) => document.getElementById(id) ? document.getElementById(id).value.trim() : '';
            const user = currentAuthUser || {};
            const userId = user.id || 'guest';

            const name = getVal('cfg-user-name');
            const title = getVal('cfg-user-title');
            const clinic = getVal('cfg-clinic-name');
            const phone = getVal('cfg-pdf-phone');
            const mp = getVal('cfg-pdf-mp');
            const logoUrl = getVal('cfg-pdf-logo-url');
            const disclaimer = getVal('cfg-pdf-disclaimer');
            const address = getVal('cfg-clinic-address');
            const unit = document.getElementById('cfg-unit-weight') ? document.getElementById('cfg-unit-weight').value : 'kg';
            const pha = getVal('cfg-pha-optimal');

            localStorage.setItem(`vm_user_name_${userId}`, name);
            localStorage.setItem(`vm_user_title_${userId}`, title);
            localStorage.setItem(`vm_clinic_name_${userId}`, clinic);
            localStorage.setItem(`vm_pdf_phone_${userId}`, phone);
            localStorage.setItem(`vm_pdf_mp_${userId}`, mp);
            localStorage.setItem(`vm_pdf_logo_url_${userId}`, logoUrl);
            localStorage.setItem(`vm_pdf_disclaimer_${userId}`, disclaimer);
            localStorage.setItem(`vm_clinic_address_${userId}`, address);
            localStorage.setItem(`vm_unit_weight_${userId}`, unit);
            localStorage.setItem(`vm_pha_optimal_${userId}`, pha);

            // Actualizar también en el servidor para que la sesión del usuario persista globalmente
            try {
                const res = await fetch('/api/auth/profile', {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        full_name: name,
                        professional_title: title,
                        clinic_name: clinic,
                        phone: phone,
                        professional_license: mp,
                        clinic_logo_url: logoUrl,
                        pdf_disclaimer: disclaimer,
                        clinic_address: address,
                        unit_weight: unit,
                        pha_optimal: pha
                    })
                });
                const data = await res.json();
                if (res.ok && data.user) {
                    currentAuthUser = data.user;
                }
            } catch (e) {
                console.warn('No se pudo guardar el membrete en el servidor:', e);
            }

            loadAllSettings();
            showToast('💾 Toda la configuración del sistema ha sido guardada correctamente.', 'success');
        });
    }

    // Carga de archivo de logo en base64 y actualización de vista previa
    const updateLogoPreview = (url) => {
        const previewImg = document.getElementById('cfg-logo-preview');
        if (previewImg && url) {
            previewImg.src = url;
        }
    };

    // Abrir modal de vista previa completa (Lightbox) al hacer clic en la miniatura del logo
    const previewBox = document.getElementById('cfg-logo-preview-container');
    const lightboxModal = document.getElementById('logo-lightbox-modal');
    const lightboxImg = document.getElementById('logo-lightbox-img');
    const lightboxCloseBtn = document.getElementById('logo-lightbox-close');
    const lightboxBtnClose = document.getElementById('logo-lightbox-btn-close');

    const closeLogoLightbox = () => {
        if (lightboxModal) lightboxModal.classList.add('hidden');
    };

    if (previewBox) {
        previewBox.addEventListener('click', () => {
            const previewImg = document.getElementById('cfg-logo-preview');
            if (previewImg && lightboxImg && lightboxModal) {
                lightboxImg.src = previewImg.src;
                lightboxModal.classList.remove('hidden');
            }
        });
    }

    if (lightboxCloseBtn) lightboxCloseBtn.addEventListener('click', closeLogoLightbox);
    if (lightboxBtnClose) lightboxBtnClose.addEventListener('click', closeLogoLightbox);
    if (lightboxModal) {
        lightboxModal.addEventListener('click', (e) => {
            if (e.target === lightboxModal) closeLogoLightbox();
        });
    }

    if (inputLogoFile) {
        inputLogoFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    if (logoUrlInput) {
                        logoUrlInput.value = event.target.result;
                        localStorage.setItem('vm_pdf_logo_url', event.target.result);
                        updateLogoPreview(event.target.result);
                        showToast('🖼️ Logo actualizado correctamente.', 'success');
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Exportar CSV
    if (btnExportCsv) {
        btnExportCsv.addEventListener('click', exportEvaluationsToCSV);
    }

    // Exportar JSON
    if (btnExportJson) {
        btnExportJson.addEventListener('click', exportBackupJSON);
    }

    // Restaurar JSON
    if (inputJsonFile) {
        inputJsonFile.addEventListener('change', importBackupJSON);
    }

    // Geolocalización GPS en mapa
    if (btnLocate) {
        btnLocate.addEventListener('click', locateUserGPS);
    }

    // Inicializar mapa Leaflet cuando la vista de configuración sea visible
    initClinicMap();
}

function applyThemeMode(isDark) {
    const label = document.getElementById('theme-status-label');
    if (isDark) {
        document.body.classList.add('vm-dark-mode');
        if (label) label.textContent = 'Modo Vidrio Oscuro (Glass BIA)';
    } else {
        document.body.classList.remove('vm-dark-mode');
        if (label) label.textContent = 'Modo Claro Médico';
    }
}

// Inicialización del Mapa Leaflet con Icono SVG Personalizado y Google Maps Integration
function initClinicMap() {
    const mapContainer = document.getElementById('clinic-map');
    if (!mapContainer || typeof L === 'undefined') return;

    const savedLat = parseFloat(localStorage.getItem('vm_clinic_lat')) || -34.6037;
    const savedLng = parseFloat(localStorage.getItem('vm_clinic_lng')) || -58.3816;

    // Custom Red Pin Icon using Bootstrap Icon SVG
    const clinicCustomPin = L.divIcon({
        className: 'clinic-custom-pin-icon',
        html: `<div style="font-size: 2.2rem; color: #ef4444; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3)); width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;"><i class="bi bi-geo-alt-fill"></i></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32]
    });

    if (!clinicLeafletMap) {
        clinicLeafletMap = L.map('clinic-map').setView([savedLat, savedLng], 17); // Zoom 17x street level precision

        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
            subdomains: 'abcd',
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        }).addTo(clinicLeafletMap);

        clinicMarker = L.marker([savedLat, savedLng], { 
            draggable: true, 
            icon: clinicCustomPin 
        }).addTo(clinicLeafletMap);
        
        clinicMarker.bindPopup("🏥 <b>Consultorio Médico VitaMetrix</b><br>Arrastra para precisar la ubicación exacta.").openPopup();

        clinicMarker.on('dragend', (e) => {
            const pos = e.target.getLatLng();
            updateMapCoordinates(pos.lat, pos.lng, false, true);
        });

        clinicLeafletMap.on('click', (e) => {
            const { lat, lng } = e.latlng;
            clinicMarker.setLatLng([lat, lng]);
            updateMapCoordinates(lat, lng, false, true);
        });

        // Listeners para edición manual de Latitud y Longitud
        const latInput = document.getElementById('cfg-clinic-lat');
        const lngInput = document.getElementById('cfg-clinic-lng');
        const btnSearch = document.getElementById('btn-search-address');
        const addressInput = document.getElementById('cfg-clinic-address');
        const btnMapLeaflet = document.getElementById('btn-map-type-leaflet');
        const btnMapGoogle = document.getElementById('btn-map-type-google');

        const onManualCoordsChange = () => {
            const latVal = parseFloat(latInput ? latInput.value : '');
            const lngVal = parseFloat(lngInput ? lngInput.value : '');
            if (!isNaN(latVal) && !isNaN(lngVal) && latVal >= -90 && latVal <= 90 && lngVal >= -180 && lngVal <= 180) {
                clinicMarker.setLatLng([latVal, lngVal]);
                clinicLeafletMap.panTo([latVal, lngVal]);
                updateMapCoordinates(latVal, lngVal, false, false);
            }
        };

        if (latInput) latInput.addEventListener('change', onManualCoordsChange);
        if (lngInput) lngInput.addEventListener('change', onManualCoordsChange);

        if (btnSearch) {
            btnSearch.addEventListener('click', () => {
                if (addressInput && addressInput.value.trim()) {
                    geocodeAddress(addressInput.value.trim());
                }
            });
        }

        if (addressInput) {
            addressInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (addressInput.value.trim()) geocodeAddress(addressInput.value.trim());
                }
            });
        }

        // Toggle entre OpenStreetMap Leaflet y Google Maps Embed
        if (btnMapLeaflet && btnMapGoogle) {
            btnMapLeaflet.addEventListener('click', () => {
                btnMapLeaflet.classList.add('active');
                btnMapGoogle.classList.remove('active');
                document.getElementById('clinic-map').classList.remove('d-none');
                document.getElementById('google-map-iframe').classList.add('d-none');
                if (clinicLeafletMap) clinicLeafletMap.invalidateSize();
            });

            btnMapGoogle.addEventListener('click', () => {
                btnMapGoogle.classList.add('active');
                btnMapLeaflet.classList.remove('active');
                document.getElementById('clinic-map').classList.add('d-none');
                const gIframe = document.getElementById('google-map-iframe');
                if (gIframe) {
                    const lat = parseFloat(latInput ? latInput.value : savedLat);
                    const lng = parseFloat(lngInput ? lngInput.value : savedLng);
                    gIframe.src = `https://maps.google.com/maps?q=${lat},${lng}&z=17&output=embed`;
                    gIframe.classList.remove('d-none');
                }
            });
        }
    }

    updateMapCoordinates(savedLat, savedLng, false, false);

    setTimeout(() => {
        if (clinicLeafletMap) {
            clinicLeafletMap.invalidateSize();
            clinicLeafletMap.setView([savedLat, savedLng], 17);
        }
    }, 200);
}

function updateMapCoordinates(lat, lng, panTo = true, reverseGeocode = false) {
    const latInput = document.getElementById('cfg-clinic-lat');
    const lngInput = document.getElementById('cfg-clinic-lng');
    const btnGoogleLink = document.getElementById('btn-open-google-maps');
    const googleIframe = document.getElementById('google-map-iframe');

    if (latInput) latInput.value = lat.toFixed(6);
    if (lngInput) lngInput.value = lng.toFixed(6);

    localStorage.setItem('vm_clinic_lat', lat.toFixed(6));
    localStorage.setItem('vm_clinic_lng', lng.toFixed(6));

    if (btnGoogleLink) {
        btnGoogleLink.href = `https://www.google.com/maps?q=${lat},${lng}`;
    }

    if (googleIframe && !googleIframe.classList.contains('d-none')) {
        googleIframe.src = `https://maps.google.com/maps?q=${lat},${lng}&z=17&output=embed`;
    }

    if (panTo && clinicLeafletMap) {
        clinicLeafletMap.panTo([lat, lng]);
    }

    if (reverseGeocode) {
        reverseGeocodeCoords(lat, lng);
    }
}

function reverseGeocodeCoords(lat, lng) {
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`)
        .then(res => res.json())
        .then(data => {
            if (data && data.display_name) {
                const addressInput = document.getElementById('cfg-clinic-address');
                const cleanAddress = data.display_name.split(',').slice(0, 3).join(',').trim();
                if (addressInput) addressInput.value = cleanAddress;
                localStorage.setItem('vm_clinic_address', cleanAddress);
                showToast(`📍 Dirección actualizada: ${cleanAddress}`, 'info');
            }
        })
        .catch(() => {});
}

function geocodeAddress(query) {
    showToast('🔍 Buscando dirección exacta en el mapa...', 'info');
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`)
        .then(res => res.json())
        .then(data => {
            if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lng = parseFloat(data[0].lon);
                if (clinicLeafletMap && clinicMarker) {
                    clinicLeafletMap.setView([lat, lng], 17);
                    clinicMarker.setLatLng([lat, lng]);
                    clinicMarker.bindPopup(`📍 <b>${data[0].display_name.split(',')[0]}</b>`).openPopup();
                    updateMapCoordinates(lat, lng, false, false);
                    showToast('✅ Dirección localizada con precisión en el mapa.', 'success');
                }
            } else {
                showToast('⚠️ No se encontraron coordenadas para esa dirección.', 'error');
            }
        })
        .catch(err => {
            console.error(err);
            showToast('⚠️ Error al buscar la dirección.', 'error');
        });
}

function locateUserGPS() {
    if (!navigator.geolocation) {
        showToast('⚠️ Geolocalización no soportada en este navegador.', 'error');
        return;
    }

    showToast('📡 Obteniendo posición GPS de alta precisión en tiempo real...', 'info');

    navigator.geolocation.getCurrentPosition((pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        if (clinicLeafletMap && clinicMarker) {
            clinicLeafletMap.setView([latitude, longitude], 17);
            clinicMarker.setLatLng([latitude, longitude]);
            clinicMarker.bindPopup(`📍 <b>Ubicación GPS Detectada</b><br>Precisión: ±${Math.round(accuracy)} metros`).openPopup();
            updateMapCoordinates(latitude, longitude, false, true);
            showToast(`✅ Posición GPS detectada con alta precisión (±${Math.round(accuracy)}m).`, 'success');
        }
    }, (err) => {
        showToast('⚠️ No se pudo obtener la posición GPS actual.', 'error');
    }, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
    });
}

// Exportación CSV
async function exportEvaluationsToCSV() {
    try {
        const res = await fetch('/api/evaluations', { headers: getAuthHeaders() });
        if (!res.ok) throw new Error('Error de servidor');
        const evals = await res.json();
        
        if (!Array.isArray(evals) || evals.length === 0) {
            showToast('⚠️ No tienes ninguna evaluación clínica registrada para exportar.', 'info');
            return;
        }

        const headers = [
            'ID', 'Código', 'Fecha', 'IDP / CI', 'Paciente', 'Edad', 'Sexo',
            'Peso (kg)', 'Altura (cm)', 'R (ohm)', 'Xc (ohm)', 'Ángulo de Fase (°)',
            'Puntuación TRU', 'Estado Celular'
        ];

        const rows = evals.map(ev => [
            ev.id || '',
            ev.code || '',
            ev.created_at || ev.timestamp || '',
            ev.idp || ev.client_idp || '',
            `"${(ev.patient_name || ev.client_name || '').replace(/"/g, '""')}"`,
            ev.age || '',
            ev.gender || '',
            ev.weight || '',
            ev.height || '',
            ev.r_ohm || '',
            ev.xc_ohm || '',
            ev.phase_angle || '',
            ev.tru_score || '',
            `"${(ev.cellular_status || ev.status_description || '').replace(/"/g, '""')}"`
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `VitaMetrix_Evaluaciones_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast('📊 Evaluaciones exportadas a CSV correctamente.', 'success');
    } catch (e) {
        showToast('⚠️ Error al consultar el historial para exportar.', 'error');
    }
}

// Respaldo JSON
async function exportBackupJSON() {
    try {
        const res = await fetch('/api/evaluations', { headers: getAuthHeaders() });
        if (!res.ok) throw new Error('Error de servidor');
        const evals = await res.json();

        if (!Array.isArray(evals) || evals.length === 0) {
            showToast('⚠️ No tienes ninguna evaluación clínica registrada para respaldar.', 'info');
            return;
        }

        const user = currentAuthUser || {};
        const backupData = {
            app: 'VitaMetrix',
            version: '2.0',
            backup_date: new Date().toISOString(),
            settings: {
                user_id: user.id || '',
                user_name: user.full_name || '',
                user_title: user.professional_title || '',
                clinic_name: user.clinic_name || ''
            },
            evaluaciones: evals
        };

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `VitaMetrix_Backup_${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();

        showToast('📦 Respaldo JSON descargado con éxito.', 'success');
    } catch (e) {
        showToast('⚠️ Error al generar el respaldo JSON.', 'error');
    }
}

// Restauración JSON
function importBackupJSON(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            if (data.settings) {
                if (data.settings.user_name) localStorage.setItem('vm_user_name', data.settings.user_name);
                if (data.settings.user_title) localStorage.setItem('vm_user_title', data.settings.user_title);
                if (data.settings.clinic_name) localStorage.setItem('vm_clinic_name', data.settings.clinic_name);
                if (data.settings.clinic_address) localStorage.setItem('vm_clinic_address', data.settings.clinic_address);
                if (data.settings.clinic_lat) localStorage.setItem('vm_clinic_lat', data.settings.clinic_lat);
                if (data.settings.clinic_lng) localStorage.setItem('vm_clinic_lng', data.settings.clinic_lng);
            }
            showToast('✅ Copia de seguridad restaurada correctamente.', 'success');
            setTimeout(() => window.location.reload(), 1200);
        } catch (err) {
            showToast('⚠️ El archivo JSON seleccionado no es una copia de seguridad válida de VitaMetrix.', 'error');
        }
    };
    reader.readAsText(file);
}

// --- 7. STOCK CONTROL & INVENTARIO CLÍNICO Y VENTAS (POS) ---
let allStockItems = [];
let allStockMovements = [];
let allSalesHistory = [];
let posCart = [];
let editingStockId = null;
let currentQuickAdjustItem = null;
let currentMovementType = 'IN';
let stockTaxonomiesData = { categories: [], units: [] };
let posSelectedPatient = null;
let posSelectedPaymentMethod = 'Efectivo';
let currentViewedReceipt = null;
let stockCurrentPage = 1;
let stockPageSize = 15;
let stockSelectedIds = new Set();
let stockFilteredItems = [];
let stockMarginCalculationMode = 'cost';

function initStockModule() {
    // 1. Inicializar Sub-pestañas Bento
    initStockSubTabs();

    // 2. Cálculo dinámico de Margen de Ganancia (%)
    initStockMarginCalculator();

    // 3. Formulario de Stock
    initStockForm();

    // 4. Módulo POS (Punto de Venta)
    initPosModule();

    // 5. Módulo de Historial de Ventas
    initSalesModule();

    // 6. Módulo de Kardex
    initKardexModule();

    // 7. Modales de Taxonomías (Opción 1 sin familias), Ajuste Rápido y Recibo
    initStockTaxonomyModal();
    initQuickStockAdjustModal();
    initDigitalReceiptModal();
    initStockFormCustomDropdowns();
    initCustomCategoryFilters();

    // 8. Carga inicial de datos
    fetchStockItems();
    fetchStockTaxonomies();
    fetchSalesHistory();
    fetchKardexMovements();
}

function initCustomCategoryFilters() {
    // 1. Filtro Catálogo
    setupCustomCategoryFilterDropdown({
        containerId: 'stock-cat-filter-container',
        btnId: 'stock-cat-filter-btn',
        menuId: 'stock-cat-filter-menu',
        searchId: 'stock-cat-filter-search',
        listId: 'stock-cat-filter-list',
        hiddenInputId: 'stock-filter-category',
        labelId: 'stock-cat-filter-current-label',
        onSelect: () => filterAndRenderStock()
    });

    // 2. Filtro POS
    setupCustomCategoryFilterDropdown({
        containerId: 'pos-cat-filter-container',
        btnId: 'pos-cat-filter-btn',
        menuId: 'pos-cat-filter-menu',
        searchId: 'pos-cat-filter-search',
        listId: 'pos-cat-filter-list',
        hiddenInputId: 'pos-filter-category',
        labelId: 'pos-cat-filter-current-label',
        onSelect: () => renderPosProductGrid()
    });
}

function setupCustomCategoryFilterDropdown(cfg) {
    const btn = document.getElementById(cfg.btnId);
    const menu = document.getElementById(cfg.menuId);
    const searchInput = document.getElementById(cfg.searchId);
    const list = document.getElementById(cfg.listId);
    if (!btn || !menu) return;

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = menu.classList.contains('show');
        document.querySelectorAll('.stock-custom-select-menu').forEach(m => m.classList.remove('show'));
        document.querySelectorAll('.stock-custom-select-trigger').forEach(t => t.classList.remove('active'));

        if (!isOpen) {
            menu.classList.add('show');
            btn.classList.add('active');
            if (searchInput) {
                searchInput.value = '';
                list?.querySelectorAll('.stock-custom-select-item').forEach(it => it.classList.remove('d-none'));
                setTimeout(() => searchInput.focus(), 60);
            }
        }
    });

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const query = normalizeText(searchInput.value);
            list?.querySelectorAll('.stock-custom-select-item').forEach(it => {
                const catVal = normalizeText(it.dataset.value || '');
                if (!query || catVal.includes(query) || it.dataset.value === 'all') {
                    it.classList.remove('d-none');
                } else {
                    it.classList.add('d-none');
                }
            });
        });
        searchInput.addEventListener('click', (e) => e.stopPropagation());
    }

    document.addEventListener('click', (e) => {
        if (!e.target.closest(`#${cfg.containerId}`)) {
            menu.classList.remove('show');
            btn.classList.remove('active');
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && menu.classList.contains('show')) {
            menu.classList.remove('show');
            btn.classList.remove('active');
        }
    });
}

// --- SUB-PESTAÑAS BENTO (Catálogo / POS / Ventas / Kardex) ---
function initStockSubTabs() {
    const tabBtns = document.querySelectorAll('.stock-main-tab-btn');
    const panels = document.querySelectorAll('.stock-panel-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const targetPanelId = btn.dataset.panel;
            panels.forEach(p => {
                if (p.id === targetPanelId) {
                    p.classList.remove('d-none');
                } else {
                    p.classList.add('d-none');
                }
            });

            try {
                localStorage.setItem('vita_active_stock_tab', targetPanelId);
            } catch (e) {}

            // Acciones al cambiar de pestaña
            if (targetPanelId === 'stock-panel-pos') {
                renderPosProductGrid();
                renderPosCart();
            } else if (targetPanelId === 'stock-panel-sales') {
                fetchSalesHistory();
            } else if (targetPanelId === 'stock-panel-kardex') {
                fetchKardexMovements();
            }
        });
    });

    // Restaurar sub-pestaña de stock activa previa
    const savedStockTab = localStorage.getItem('vita_active_stock_tab');
    if (savedStockTab && document.getElementById(savedStockTab)) {
        switchStockSubTab(savedStockTab);
    }
}

function switchStockSubTab(panelId) {
    const btn = document.querySelector(`.stock-main-tab-btn[data-panel="${panelId}"]`);
    if (btn) btn.click();
}

// --- CÁLCULO DINÁMICO DE MARGEN DE GANANCIA / RENTABILIDAD ---
function initStockMarginCalculator() {
    const inputCost = document.getElementById('stock-cost');
    const inputSale = document.getElementById('stock-sale');
    const badgeMargin = document.getElementById('stock-calculated-margin');
    const btnToggle = document.getElementById('btn-toggle-margin-mode');
    const indicatorEl = document.getElementById('margin-mode-indicator');
    const labelEl = document.getElementById('stock-margin-label');

    if (!inputCost || !inputSale || !badgeMargin) return;

    const updateModeUI = () => {
        if (stockMarginCalculationMode === 'cost') {
            if (indicatorEl) indicatorEl.textContent = 's/ Costo';
            if (labelEl) labelEl.textContent = 'Rentab. s/ Costo';
            if (badgeMargin) badgeMargin.title = 'Modo: Rentabilidad sobre Costo (Markup). Haz clic para cambiar a Margen sobre Venta.';
        } else {
            if (indicatorEl) indicatorEl.textContent = 's/ Venta';
            if (labelEl) labelEl.textContent = 'Margen s/ Venta';
            if (badgeMargin) badgeMargin.title = 'Modo: Margen sobre Venta (Profit Margin). Haz clic para cambiar a Rentabilidad sobre Costo.';
        }
    };

    const calcMargin = () => {
        const cost = parseFloat(inputCost.value) || 0;
        const sale = parseFloat(inputSale.value) || 0;

        if (sale > 0 && cost > 0) {
            const diff = sale - cost;
            let pct = 0;
            if (stockMarginCalculationMode === 'cost') {
                pct = (diff / cost) * 100; // Rentabilidad sobre Costo -> ej: +50.0%
            } else {
                pct = (diff / sale) * 100; // Margen sobre Venta -> ej: +33.3%
            }

            const modeTag = stockMarginCalculationMode === 'cost' ? 'Rentab.' : 'Margen';
            badgeMargin.className = `stock-margin-badge d-flex align-items-center justify-content-center fw-bold py-2 px-2 rounded-3 border small ${pct >= 0 ? 'positive' : 'negative'}`;
            badgeMargin.innerHTML = `<span>${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% <small class="fw-normal opacity-75">(${modeTag}: Bs. ${diff.toFixed(2)})</small></span>`;
        } else if (sale > 0 && cost === 0) {
            badgeMargin.className = 'stock-margin-badge d-flex align-items-center justify-content-center fw-bold py-2 px-2 rounded-3 border small positive';
            badgeMargin.innerHTML = '<span>+100% (Ganancia total)</span>';
        } else {
            badgeMargin.className = 'stock-margin-badge d-flex align-items-center justify-content-center fw-bold py-2 px-2 rounded-3 border bg-light small';
            badgeMargin.innerHTML = '<span class="text-muted">0.0%</span>';
        }
    };

    const toggleMode = () => {
        stockMarginCalculationMode = stockMarginCalculationMode === 'cost' ? 'sale' : 'cost';
        updateModeUI();
        calcMargin();
        showToast(`📊 Modo cambiado a: ${stockMarginCalculationMode === 'cost' ? 'Rentabilidad sobre Costo (Markup)' : 'Margen sobre Venta (Profit Margin)'}`, 'info');
    };

    inputCost.addEventListener('input', calcMargin);
    inputSale.addEventListener('input', calcMargin);
    if (btnToggle) btnToggle.addEventListener('click', toggleMode);
    badgeMargin.addEventListener('click', toggleMode);

    updateModeUI();
}

// --- DESPLAZAMIENTO SUAVE AL DIRECTORIO DE INVENTARIO ---
function scrollToStockInventory() {
    const section = document.getElementById('stock-inventory-section');
    if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
        const input = document.getElementById('stock-search-input');
        if (input) input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// --- FORMULARIO Y TABLA DE CATÁLOGO / STOCK ---
function initStockForm() {
    const form = document.getElementById('stock-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btnSave = document.getElementById('btn-save-stock');
        const originalText = btnSave.innerHTML;
        btnSave.disabled = true;
        btnSave.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Guardando...';

        const payload = {
            code: document.getElementById('stock-code').value.trim().toUpperCase(),
            name: document.getElementById('stock-name').value.trim(),
            category: document.getElementById('stock-category').value.trim() || 'Sin Categoría',
            unit: document.getElementById('stock-unit').value.trim() || 'Unidad (u)',
            stock_quantity: parseFloat(document.getElementById('stock-qty')?.value ?? document.getElementById('stock-quantity')?.value) || 0,
            min_stock: parseFloat(document.getElementById('stock-min').value) || 5,
            cost_price: parseFloat(document.getElementById('stock-cost').value) || 0,
            sale_price: parseFloat(document.getElementById('stock-sale').value) || 0,
            batch_number: document.getElementById('stock-batch')?.value.trim() || '',
            expiry_date: document.getElementById('stock-expiry')?.value || '',
            location: document.getElementById('stock-location').value.trim(),
            supplier: document.getElementById('stock-supplier').value.trim(),
            notes: document.getElementById('stock-notes').value.trim()
        };

        try {
            const url = editingStockId ? `/api/stock/${editingStockId}` : '/api/stock';
            const method = editingStockId ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await res.json();

            if (res.ok && (result.success || result.id)) {
                showToast(editingStockId ? '✅ Producto actualizado correctamente' : '✅ Producto registrado en catálogo', 'success');
                resetStockForm();
                await fetchStockItems();
                await fetchStockTaxonomies();
            } else {
                showToast(result.error || 'Error al guardar producto', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Error de conexión al guardar en inventario', 'error');
        } finally {
            btnSave.disabled = false;
            btnSave.innerHTML = originalText;
        }
    });

    const btnCancel = document.getElementById('btn-cancel-stock');
    if (btnCancel) btnCancel.addEventListener('click', resetStockForm);

    // Formateo en tiempo real del campo CÓDIGO / SKU (Mayúsculas y prefijo 2 a 5 letras/números)
    const codeInput = document.getElementById('stock-code');
    if (codeInput) {
        codeInput.addEventListener('input', () => {
            let val = codeInput.value.toUpperCase().replace(/[^A-Z0-9\-]/g, '');
            // Si el usuario solo está escribiendo el prefijo sin guión, limitar a 5 caracteres
            if (!val.includes('-') && val.length > 5) {
                val = val.slice(0, 5);
            }
            codeInput.value = val;
        });
    }

    // Toggle para colapsar / expandir formulario de stock
    const toggleBtn = document.getElementById('btn-toggle-stock-form');
    const collapseBody = document.getElementById('stock-form-collapse-body');
    const toggleIcon = document.getElementById('stock-form-toggle-icon');
    const toggleText = document.getElementById('stock-form-toggle-text');

    if (toggleBtn && collapseBody) {
        toggleBtn.addEventListener('click', () => {
            const isCollapsed = collapseBody.classList.toggle('collapsed');
            if (isCollapsed) {
                if (toggleIcon) toggleIcon.className = 'bi bi-plus-lg';
                if (toggleText) toggleText.textContent = 'Registrar Insumo';
            } else {
                if (toggleIcon) toggleIcon.className = 'bi bi-chevron-up';
                if (toggleText) toggleText.textContent = 'Ocultar Formulario';
            }
        });
    }

    const searchInput = document.getElementById('stock-search-input');
    const catFilter = document.getElementById('stock-filter-category');
    const statusFilter = document.getElementById('stock-filter-status');

    if (searchInput) searchInput.addEventListener('input', () => filterAndRenderStock(true));
    if (catFilter) catFilter.addEventListener('change', () => filterAndRenderStock(true));
    if (statusFilter) statusFilter.addEventListener('change', () => filterAndRenderStock(true));

    // Listeners para Selección Múltiple y Paginación
    const selectAllChk = document.getElementById('stock-select-all');
    if (selectAllChk) {
        selectAllChk.addEventListener('change', () => {
            const total = stockFilteredItems.length;
            const startIdx = (stockCurrentPage - 1) * stockPageSize;
            const endIdx = Math.min(startIdx + stockPageSize, total);
            const pageItems = stockFilteredItems.slice(startIdx, endIdx);

            pageItems.forEach(item => {
                if (selectAllChk.checked) {
                    stockSelectedIds.add(item.id);
                } else {
                    stockSelectedIds.delete(item.id);
                }
            });
            renderStockTable();
        });
    }

    const pageSizeSelect = document.getElementById('stock-page-size-select');
    if (pageSizeSelect) {
        pageSizeSelect.addEventListener('change', (e) => {
            stockPageSize = parseInt(e.target.value, 10) || 15;
            stockCurrentPage = 1;
            renderStockTable();
        });
    }

    const btnClearSelection = document.getElementById('btn-clear-selection');
    if (btnClearSelection) {
        btnClearSelection.addEventListener('click', () => {
            stockSelectedIds.clear();
            renderStockTable();
            showToast('Selección desmarcada', 'info');
        });
    }

    const btnBulkDelete = document.getElementById('btn-bulk-delete-stock');
    if (btnBulkDelete) {
        btnBulkDelete.addEventListener('click', openBulkDeleteModal);
    }

    // Interacciones Click-to-Filter en Tarjetas KPI
    const cardTotal = document.getElementById('kpi-card-total');
    const cardOptimal = document.getElementById('kpi-card-optimal');
    const cardLow = document.getElementById('kpi-card-low');

    if (cardTotal) {
        cardTotal.addEventListener('click', () => {
            if (statusFilter) statusFilter.value = 'all';
            if (searchInput) searchInput.value = '';
            filterAndRenderStock();
            scrollToStockInventory();
            showToast('📋 Mostrando todos los artículos del catálogo', 'info');
        });
    }

    if (cardOptimal) {
        cardOptimal.addEventListener('click', () => {
            if (statusFilter) statusFilter.value = 'optimal';
            filterAndRenderStock();
            scrollToStockInventory();
            showToast('🟢 Filtrando por artículos con Stock Óptimo', 'info');
        });
    }

    if (cardLow) {
        cardLow.addEventListener('click', () => {
            if (statusFilter) statusFilter.value = 'low';
            filterAndRenderStock();
            scrollToStockInventory();
            showToast('🟡 Filtrando por artículos con Stock Bajo / Reposición', 'warning');
        });
    }
}

async function fetchStockItems() {
    const tbody = document.getElementById('stock-tbody');
    const totalCountEl = document.getElementById('stock-total-count');
    if (!tbody) return;

    try {
        const res = await fetch('/api/stock', { headers: getAuthHeaders() });
        if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
        allStockItems = await res.json();

        if (totalCountEl) totalCountEl.textContent = Array.isArray(allStockItems) ? allStockItems.length : 0;
        updateStockCategoryOptions(allStockItems);
        updateStockKPIs(allStockItems);
        filterAndRenderStock();
        renderPosProductGrid();
    } catch (err) {
        console.error('Error al cargar inventario:', err);
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-danger">Error al cargar inventario. Reintenta en unos instantes.</td></tr>';
    }
}

function updateStockCategoryOptions(items) {
    if (!Array.isArray(items)) return;

    const defaultCats = [
        "Insumos BIA",
        "Suplementos Nutricionales",
        "Material Clínico e Higiene",
        "Accesorios y Equipos",
        "Medicamentos / Fármacos",
        "Material de Oficina",
        "Sin Categoría",
        "Otros"
    ];

    const uniqueCats = new Set(defaultCats);
    if (stockTaxonomiesData?.categories) {
        stockTaxonomiesData.categories.forEach(c => uniqueCats.add(c.name));
    }
    items.forEach(i => {
        if (i.category && i.category.trim()) uniqueCats.add(i.category.trim());
    });

    const counts = { all: items.length };
    uniqueCats.forEach(cat => {
        counts[cat] = items.filter(i => (i.category || '').trim() === cat).length;
    });

    const getIcon = (cat) => {
        if (cat === 'all') return '📁';
        if (cat.includes('BIA')) return '🩺';
        if (cat.includes('Suplementos')) return '💊';
        if (cat.includes('Material') || cat.includes('Higiene')) return '🧼';
        if (cat.includes('Medicamentos') || cat.includes('Fármacos')) return '💉';
        if (cat.includes('Accesorios') || cat.includes('Equipos')) return '📦';
        if (cat.includes('Oficina') || cat.includes('Papel')) return '📝';
        if (cat.includes('Sin') || cat === 'Sin Categoría') return '🏷️';
        return '🏷️';
    };

    const renderDropdownList = (listEl, hiddenInputId, labelEl, onSelect) => {
        if (!listEl) return;
        const currentVal = document.getElementById(hiddenInputId)?.value || 'all';

        listEl.replaceChildren();

        // 1. Opción "Todas las Categorías"
        const allItem = document.createElement('div');
        allItem.className = `stock-custom-select-item ${currentVal === 'all' ? 'selected' : ''}`;
        allItem.dataset.value = 'all';
        allItem.innerHTML = `
            <div class="d-flex align-items-center gap-2 text-truncate me-2">
                <span class="fs-6">📁</span>
                <span class="text-truncate">Todas las Categorías</span>
            </div>
            <div class="d-flex align-items-center gap-1.5">
                <span class="cat-count-badge">${counts['all'] || 0}</span>
                ${currentVal === 'all' ? '<i class="bi bi-check2 text-primary fw-bold"></i>' : ''}
            </div>
        `;
        allItem.addEventListener('click', () => {
            selectCategory('all', '📁', 'Todas las Categorías', hiddenInputId, labelEl, listEl, onSelect);
        });
        listEl.appendChild(allItem);

        // 2. Opciones de Categorías Únicas
        uniqueCats.forEach(cat => {
            const icon = getIcon(cat);
            const isSelected = currentVal === cat;
            const itemEl = document.createElement('div');
            itemEl.className = `stock-custom-select-item ${isSelected ? 'selected' : ''}`;
            itemEl.dataset.value = cat;
            itemEl.innerHTML = `
                <div class="d-flex align-items-center gap-2 text-truncate me-2">
                    <span class="fs-6">${icon}</span>
                    <span class="text-truncate">${escapeHtml(cat)}</span>
                </div>
                <div class="d-flex align-items-center gap-1.5">
                    <span class="cat-count-badge">${counts[cat] || 0}</span>
                    ${isSelected ? '<i class="bi bi-check2 text-primary fw-bold"></i>' : ''}
                </div>
            `;
            itemEl.addEventListener('click', () => {
                selectCategory(cat, icon, cat, hiddenInputId, labelEl, listEl, onSelect);
            });
            listEl.appendChild(itemEl);
        });

        // Actualizar etiqueta activa del botón trigger
        if (labelEl) {
            const activeIcon = getIcon(currentVal);
            const activeName = currentVal === 'all' ? 'Todas las Categorías' : currentVal;
            labelEl.innerHTML = `
                <span class="fs-6">${activeIcon}</span>
                <span class="fw-semibold text-navy text-truncate" style="font-size: 0.85rem;">${escapeHtml(activeName)}</span>
            `;
        }
    };

    const selectCategory = (val, icon, name, hiddenInputId, labelEl, listEl, onSelect) => {
        const hiddenInput = document.getElementById(hiddenInputId);
        if (hiddenInput) hiddenInput.value = val;

        if (labelEl) {
            labelEl.innerHTML = `
                <span class="fs-6">${icon}</span>
                <span class="fw-semibold text-navy text-truncate" style="font-size: 0.85rem;">${escapeHtml(name)}</span>
            `;
        }

        const container = listEl.closest('.position-relative');
        if (container) {
            container.querySelector('.stock-custom-select-menu')?.classList.remove('show');
            container.querySelector('.stock-custom-select-trigger')?.classList.remove('active');
        }

        listEl.querySelectorAll('.stock-custom-select-item').forEach(it => {
            if (it.dataset.value === val) {
                it.classList.add('selected');
                if (!it.querySelector('.bi-check2')) {
                    const badgeWrap = it.querySelector('.d-flex.align-items-center.gap-1.5');
                    if (badgeWrap) badgeWrap.insertAdjacentHTML('beforeend', '<i class="bi bi-check2 text-primary fw-bold"></i>');
                }
            } else {
                it.classList.remove('selected');
                it.querySelector('.bi-check2')?.remove();
            }
        });

        if (typeof onSelect === 'function') onSelect();
    };

    // Renderizar para Catálogo
    const catalogList = document.getElementById('stock-cat-filter-list');
    const catalogLabel = document.getElementById('stock-cat-filter-current-label');
    renderDropdownList(catalogList, 'stock-filter-category', catalogLabel, () => filterAndRenderStock());

    // Renderizar para POS
    const posList = document.getElementById('pos-cat-filter-list');
    const posLabel = document.getElementById('pos-cat-filter-current-label');
    renderDropdownList(posList, 'pos-filter-category', posLabel, () => renderPosProductGrid());
}

async function updateStockKPIs(items) {
    if (!Array.isArray(items)) return;

    const totalEl = document.getElementById('stock-kpi-total');
    const optimalEl = document.getElementById('stock-kpi-optimal');
    const lowEl = document.getElementById('stock-kpi-low');
    const topListEl = document.getElementById('stock-kpi-top-list');

    const totalCount = items.length;
    let optimalCount = 0;
    let lowCount = 0;

    items.forEach(i => {
        const qty = parseFloat(i.stock_quantity) || 0;
        const min = parseFloat(i.min_stock) || 5;
        if (qty > min) {
            optimalCount++;
        } else {
            lowCount++;
        }
    });

    if (totalEl) totalEl.textContent = totalCount;
    if (optimalEl) optimalEl.textContent = optimalCount;
    if (lowEl) lowEl.textContent = lowCount;

    // 4. Calcular Top 3 Más Vendidos
    if (topListEl) {
        try {
            const res = await fetch('/api/sales', { headers: getAuthHeaders() });
            if (res.ok) {
                const sales = await res.json();
                const productSalesMap = {};

                if (Array.isArray(sales)) {
                    sales.forEach(sale => {
                        if (sale.status === 'CANCELLED') return;
                        const sItems = sale.items || sale.sale_items || [];
                        sItems.forEach(it => {
                            const name = it.name || it.item_name || 'Producto';
                            const qty = parseFloat(it.quantity) || 1;
                            const unit = it.unit || 'u';
                            if (!productSalesMap[name]) {
                                productSalesMap[name] = { name, quantity: 0, unit };
                            }
                            productSalesMap[name].quantity += qty;
                        });
                    });
                }

                const sortedTop = Object.values(productSalesMap).sort((a, b) => b.quantity - a.quantity).slice(0, 3);

                if (sortedTop.length === 0) {
                    topListEl.innerHTML = '<span class="text-muted small" style="font-size: 0.75rem;">Sin ventas registradas aún</span>';
                } else {
                    const medals = ['🥇', '🥈', '🥉'];
                    topListEl.replaceChildren();
                    sortedTop.forEach((top, idx) => {
                        const badge = document.createElement('div');
                        badge.className = `stock-top-item-badge rank-${idx + 1}`;
                        badge.title = `Clic para buscar "${top.name}" en la tabla (${top.quantity} unidades vendidas)`;
                        // Unidad compacta para no saturar el badge
                        const unitClean = top.unit && top.unit.length <= 4 ? top.unit : 'u';
                        badge.innerHTML = `
                            <div class="d-flex align-items-center text-truncate flex-grow-1" style="min-width: 0;">
                                <span class="rank me-1 flex-shrink-0">${medals[idx]}</span>
                                <span class="text-truncate fw-semibold" style="font-size: 0.72rem;">${escapeHtml(top.name)}</span>
                            </div>
                            <span class="badge bg-white text-dark border px-1.5 py-0.5 flex-shrink-0 ms-1 shadow-none" style="font-size: 0.68rem; font-weight: 700;">${top.quantity} ${escapeHtml(unitClean)}</span>
                        `;
                        badge.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const searchInput = document.getElementById('stock-search-input');
                            if (searchInput) {
                                searchInput.value = top.name;
                                filterAndRenderStock();
                                scrollToStockInventory();
                                showToast(`🔍 Localizando "${top.name}" en inventario`, 'info');
                            }
                        });
                        topListEl.appendChild(badge);
                    });
                }
            }
        } catch (e) {
            console.warn('No se pudo cargar rotación de ventas:', e);
            topListEl.innerHTML = '<span class="text-muted small" style="font-size: 0.75rem;">Sin rotación registrada</span>';
        }
    }
}

function filterAndRenderStock(resetPage = true) {
    const tbody = document.getElementById('stock-tbody');
    if (!tbody || !Array.isArray(allStockItems)) return;

    const search = normalizeText(document.getElementById('stock-search-input')?.value);
    const cat = document.getElementById('stock-filter-category')?.value || 'all';
    const status = document.getElementById('stock-filter-status')?.value || 'all';

    stockFilteredItems = allStockItems.filter(item => {
        const normName = normalizeText(item.name);
        const normCode = normalizeText(item.code);
        const normLoc = normalizeText(item.location);
        const normSupp = normalizeText(item.supplier);
        const normBatch = normalizeText(item.batch_number);

        const matchSearch = !search || normName.includes(search) || normCode.includes(search) || normLoc.includes(search) || normSupp.includes(search) || normBatch.includes(search);
        const matchCat = cat === 'all' || item.category === cat;

        let itemStatus = item.status;
        if (!itemStatus) {
            const qty = parseFloat(item.stock_quantity) || 0;
            const min = parseFloat(item.min_stock) || 5;
            itemStatus = qty <= 0 ? 'out' : (qty <= min ? 'low' : 'optimal');
        }
        const matchStatus = status === 'all' || itemStatus === status;

        return matchSearch && matchCat && matchStatus;
    });

    if (resetPage) {
        stockCurrentPage = 1;
    }

    renderStockTable();
}

function renderStockTable() {
    const tbody = document.getElementById('stock-tbody');
    if (!tbody) return;

    const total = stockFilteredItems.length;
    const totalPages = Math.max(1, Math.ceil(total / stockPageSize));
    stockCurrentPage = Math.max(1, Math.min(stockCurrentPage, totalPages));

    if (total === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="stock-empty-state-cell">
                    <div class="d-flex flex-column align-items-center justify-content-center py-4 text-center">
                        <div class="bg-primary-subtle text-primary rounded-circle p-3 mb-2 d-inline-flex align-items-center justify-content-center" style="width: 52px; height: 52px;">
                            <i class="bi bi-box-seam fs-3"></i>
                        </div>
                        <h6 class="fw-bold text-navy mb-1">No se encontraron artículos</h6>
                        <p class="text-muted small mb-0">Modifica los términos de búsqueda o registra un nuevo producto.</p>
                    </div>
                </td>
            </tr>
        `;
        updateStockPagination(0, 1, 0, 0);
        updateStockBulkBar();
        updateSelectAllCheckbox([]);
        return;
    }

    const startIdx = (stockCurrentPage - 1) * stockPageSize;
    const endIdx = Math.min(startIdx + stockPageSize, total);
    const pageItems = stockFilteredItems.slice(startIdx, endIdx);

    const frag = document.createDocumentFragment();

    pageItems.forEach(item => {
        const tr = document.createElement('tr');
        const isSelected = stockSelectedIds.has(item.id);
        if (isSelected) tr.classList.add('row-selected');

        const qty = parseFloat(item.stock_quantity) || 0;
        const minQty = parseFloat(item.min_stock) || 5;
        let status = item.status;
        if (!status) {
            status = qty <= 0 ? 'out' : (qty <= minQty ? 'low' : 'optimal');
        }

        // 0. Checkbox de Selección Masiva
        const tdCheck = document.createElement('td');
        tdCheck.style.textAlign = 'center';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'form-check-input stock-item-checkbox shadow-none cursor-pointer';
        checkbox.checked = isSelected;
        checkbox.dataset.id = item.id;
        checkbox.addEventListener('change', (e) => {
            e.stopPropagation();
            if (checkbox.checked) {
                stockSelectedIds.add(item.id);
                tr.classList.add('row-selected');
            } else {
                stockSelectedIds.delete(item.id);
                tr.classList.remove('row-selected');
            }
            updateStockBulkBar();
            updateSelectAllCheckbox(pageItems);
        });
        tdCheck.appendChild(checkbox);

        // 1. SKU / Código
        const tdCode = document.createElement('td');
        tdCode.innerHTML = `<span class="badge bg-light text-secondary border font-monospace fw-bold">${escapeHtml(item.code || 'SKU-000')}</span>`;

        // 2. Producto & U/M
        const tdName = document.createElement('td');
        tdName.innerHTML = `
            <div class="fw-bold text-navy">${escapeHtml(item.name)}</div>
            <div class="d-flex align-items-center gap-1.5 mt-0.5 flex-wrap">
                <span class="badge bg-secondary-subtle text-secondary small" style="font-size: 0.68rem;">${escapeHtml(item.unit || 'Unidad (u)')}</span>
                ${item.location ? `<span class="text-muted" style="font-size: 0.72rem;"><i class="bi bi-geo-alt me-0.5"></i>${escapeHtml(item.location)}</span>` : ''}
            </div>
        `;

        // 3. Categoría
        const tdCat = document.createElement('td');
        tdCat.innerHTML = `<span class="badge bg-light text-dark border fw-normal" style="font-size: 0.78rem;">${escapeHtml(item.category || 'Insumos BIA')}</span>`;

        // 4. Existencia & Nivel
        const tdStock = document.createElement('td');
        let statusBadge = '';
        let barClass = 'optimal';
        let barPercent = Math.min(100, Math.round((qty / (minQty * 2 || 10)) * 100));

        if (status === 'out') {
            statusBadge = '<span class="stock-status-badge out"><i class="bi bi-x-circle-fill"></i> Agotado</span>';
            barClass = 'out';
            barPercent = 0;
        } else if (status === 'low') {
            statusBadge = '<span class="stock-status-badge low"><i class="bi bi-exclamation-circle-fill"></i> Stock Bajo</span>';
            barClass = 'low';
        } else {
            statusBadge = '<span class="stock-status-badge optimal"><i class="bi bi-check-circle-fill"></i> Óptimo</span>';
            barClass = 'optimal';
        }

        tdStock.innerHTML = `
            <div class="d-flex align-items-center gap-2">
                <span class="font-monospace fw-bold fs-6 text-dark">${qty}</span>
                ${statusBadge}
            </div>
            <div class="d-flex align-items-center gap-2 mt-1">
                <div class="stock-bar-wrap">
                    <div class="stock-bar-fill ${barClass}" style="width: ${barPercent}%"></div>
                </div>
                <span class="text-muted" style="font-size: 0.7rem;">Mín: ${minQty}</span>
            </div>
        `;

        // 5. Precios & Margen
        const tdPrices = document.createElement('td');
        const cost = parseFloat(item.cost_price) || 0;
        const sale = parseFloat(item.sale_price) || 0;
        let marginText = '';
        if (sale > 0 && cost > 0) {
            const diff = sale - cost;
            const markup = (diff / cost) * 100;
            marginText = `<span class="badge ${markup >= 0 ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'} small ms-1" style="font-size: 0.65rem;" title="Ganancia neta: Bs. ${diff.toFixed(2)} (+${markup.toFixed(0)}% sobre costo)">${markup >= 0 ? '+' : ''}${markup.toFixed(0)}%</span>`;
        }

        tdPrices.innerHTML = `
            <div class="small text-success fw-bold font-monospace">Venta: Bs. ${sale.toFixed(2)} ${marginText}</div>
            <div class="small text-muted font-monospace" style="font-size: 0.72rem;">Costo: Bs. ${cost.toFixed(2)}</div>
        `;

        // 6. Lote / Vencimiento
        const tdExpiry = document.createElement('td');
        let expiryHtml = '<span class="text-muted small">--</span>';
        if (item.expiry_date) {
            const expDate = new Date(item.expiry_date);
            const today = new Date();
            const daysLeft = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
            let badgeExpClass = 'text-secondary';
            if (daysLeft < 0) badgeExpClass = 'text-danger fw-bold';
            else if (daysLeft <= 30) badgeExpClass = 'text-warning fw-bold';

            expiryHtml = `
                <div class="small ${badgeExpClass}"><i class="bi bi-calendar-event me-1"></i>${item.expiry_date}</div>
                ${item.batch_number ? `<div class="text-muted small font-monospace" style="font-size: 0.7rem;">Lot: ${escapeHtml(item.batch_number)}</div>` : ''}
            `;
        } else if (item.batch_number) {
            expiryHtml = `<span class="badge bg-light text-secondary border font-monospace small">Lot: ${escapeHtml(item.batch_number)}</span>`;
        }
        tdExpiry.innerHTML = expiryHtml;

        // 7. Acciones
        const tdActions = document.createElement('td');
        tdActions.className = 'text-end';

        const actionsWrap = document.createElement('div');
        actionsWrap.className = 'd-inline-flex align-items-center justify-content-end gap-1.5 flex-wrap';

        // Botón Vender Rápido (lleva a POS)
        const btnSell = document.createElement('button');
        btnSell.type = 'button';
        btnSell.className = 'btn btn-sm btn-primary py-1 px-2 fw-semibold d-inline-flex align-items-center gap-1 shadow-2xs';
        btnSell.style.fontSize = '0.76rem';
        btnSell.innerHTML = '<i class="bi bi-cart-plus-fill"></i> Vender';
        btnSell.title = 'Vender este producto en Terminal POS';
        btnSell.addEventListener('click', () => {
            addToPosCart(item);
            switchStockSubTab('stock-panel-pos');
            showToast(`🛒 "${item.name}" añadido a la venta`, 'info');
        });

        // Botón Ajustar Existencia
        const btnAdjust = document.createElement('button');
        btnAdjust.type = 'button';
        btnAdjust.className = 'btn btn-sm btn-light border py-1 px-2 text-dark fw-semibold rounded-2 shadow-2xs';
        btnAdjust.style.fontSize = '0.76rem';
        btnAdjust.innerHTML = '<i class="bi bi-arrow-left-right text-primary"></i> Ajustar';
        btnAdjust.title = 'Registrar entrada o salida en Kardex';
        btnAdjust.addEventListener('click', () => openQuickStockAdjustModal(item));

        // Botón Editar
        const btnEdit = document.createElement('button');
        btnEdit.type = 'button';
        btnEdit.className = 'btn btn-sm btn-action-edit';
        btnEdit.innerHTML = '<i class="bi bi-pencil"></i>';
        btnEdit.title = 'Editar datos del artículo';
        btnEdit.addEventListener('click', () => editStockItem(item));

        // Botón Eliminar
        const btnDel = document.createElement('button');
        btnDel.type = 'button';
        btnDel.className = 'btn btn-sm btn-action-delete';
        btnDel.innerHTML = '<i class="bi bi-trash3"></i>';
        btnDel.title = 'Eliminar artículo';
        btnDel.addEventListener('click', () => deleteStockItem(item.id, item.name));

        actionsWrap.append(btnSell, btnAdjust, btnEdit, btnDel);
        tdActions.appendChild(actionsWrap);

        tr.append(tdCheck, tdCode, tdName, tdCat, tdStock, tdPrices, tdExpiry, tdActions);
        frag.appendChild(tr);
    });

    tbody.replaceChildren(frag);
    updateStockPagination(total, totalPages, startIdx, endIdx);
    updateStockBulkBar();
    updateSelectAllCheckbox(pageItems);
}

function updateStockPagination(total, totalPages, startIdx, endIdx) {
    const infoEl = document.getElementById('stock-pagination-info');
    const controlsEl = document.getElementById('stock-pagination-controls');
    if (!infoEl || !controlsEl) return;

    if (total === 0) {
        infoEl.textContent = 'Mostrando 0–0 de 0 productos';
        controlsEl.innerHTML = '';
        return;
    }

    infoEl.textContent = `Mostrando ${startIdx + 1}–${endIdx} de ${total} productos`;
    controlsEl.replaceChildren();

    // Botón Anterior
    const prevLi = document.createElement('li');
    prevLi.className = `page-item ${stockCurrentPage === 1 ? 'disabled' : ''}`;
    prevLi.innerHTML = `<button class="page-link shadow-none" type="button" aria-label="Anterior"><i class="bi bi-chevron-left"></i></button>`;
    if (stockCurrentPage > 1) {
        prevLi.addEventListener('click', (e) => {
            e.preventDefault();
            stockCurrentPage--;
            renderStockTable();
        });
    }
    controlsEl.appendChild(prevLi);

    // Páginas numéricas
    for (let p = 1; p <= totalPages; p++) {
        if (totalPages > 7) {
            if (p !== 1 && p !== totalPages && Math.abs(p - stockCurrentPage) > 1) {
                if (p === 2 || p === totalPages - 1) {
                    const dotsLi = document.createElement('li');
                    dotsLi.className = 'page-item disabled';
                    dotsLi.innerHTML = `<span class="page-link border-0 bg-transparent text-muted">...</span>`;
                    controlsEl.appendChild(dotsLi);
                }
                continue;
            }
        }

        const pageLi = document.createElement('li');
        pageLi.className = `page-item ${p === stockCurrentPage ? 'active' : ''}`;
        pageLi.innerHTML = `<button class="page-link shadow-none" type="button">${p}</button>`;
        const targetPage = p;
        pageLi.addEventListener('click', (e) => {
            e.preventDefault();
            if (stockCurrentPage !== targetPage) {
                stockCurrentPage = targetPage;
                renderStockTable();
            }
        });
        controlsEl.appendChild(pageLi);
    }

    // Botón Siguiente
    const nextLi = document.createElement('li');
    nextLi.className = `page-item ${stockCurrentPage === totalPages ? 'disabled' : ''}`;
    nextLi.innerHTML = `<button class="page-link shadow-none" type="button" aria-label="Siguiente"><i class="bi bi-chevron-right"></i></button>`;
    if (stockCurrentPage < totalPages) {
        nextLi.addEventListener('click', (e) => {
            e.preventDefault();
            stockCurrentPage++;
            renderStockTable();
        });
    }
    controlsEl.appendChild(nextLi);
}

function updateSelectAllCheckbox(pageItems) {
    const selectAll = document.getElementById('stock-select-all');
    if (!selectAll) return;

    if (!pageItems || pageItems.length === 0) {
        selectAll.checked = false;
        selectAll.indeterminate = false;
        return;
    }

    const selectedOnPage = pageItems.filter(item => stockSelectedIds.has(item.id)).length;
    if (selectedOnPage === 0) {
        selectAll.checked = false;
        selectAll.indeterminate = false;
    } else if (selectedOnPage === pageItems.length) {
        selectAll.checked = true;
        selectAll.indeterminate = false;
    } else {
        selectAll.checked = false;
        selectAll.indeterminate = true;
    }
}

function updateStockBulkBar() {
    const bar = document.getElementById('stock-bulk-bar');
    const badge = document.getElementById('stock-selected-count-badge');
    const countSpan = document.getElementById('stock-bulk-count');
    if (!bar) return;

    const count = stockSelectedIds.size;
    if (count > 0) {
        bar.classList.remove('d-none');
        bar.classList.add('d-flex');
        if (badge) badge.textContent = `${count} seleccionado${count > 1 ? 's' : ''}`;
        if (countSpan) countSpan.textContent = count;
    } else {
        bar.classList.add('d-none');
        bar.classList.remove('d-flex');
    }
}

function openBulkDeleteModal() {
    if (stockSelectedIds.size === 0) {
        showToast('Selecciona al menos un producto para eliminar', 'warning');
        return;
    }

    const modal = document.getElementById('modal-bulk-delete-stock');
    const listEl = document.getElementById('bulk-delete-items-list');
    const badgeEl = document.getElementById('bulk-delete-modal-badge');
    const btnConfirmText = document.getElementById('btn-confirm-bulk-delete-text');
    const btnCancel = document.getElementById('btn-cancel-bulk-delete-modal');
    const btnConfirm = document.getElementById('btn-confirm-bulk-delete-modal');

    if (!modal || !listEl) return;

    const selectedItems = allStockItems.filter(i => stockSelectedIds.has(i.id));
    const count = selectedItems.length;

    if (badgeEl) badgeEl.textContent = `${count} producto${count > 1 ? 's' : ''}`;
    if (btnConfirmText) btnConfirmText.textContent = `Eliminar ${count} Producto${count > 1 ? 's' : ''}`;

    listEl.replaceChildren();
    selectedItems.forEach(item => {
        const row = document.createElement('div');
        row.className = 'bulk-delete-item-row';
        row.innerHTML = `
            <div class="d-flex align-items-center gap-2 text-truncate me-2">
                <span class="badge bg-light text-secondary border font-monospace small px-1.5 py-0.5">${escapeHtml(item.code || 'SKU')}</span>
                <span class="fw-semibold text-navy text-truncate" style="font-size: 0.85rem;">${escapeHtml(item.name)}</span>
            </div>
            <div class="d-flex align-items-center gap-2 flex-shrink-0">
                <span class="badge bg-light text-dark border small" style="font-size: 0.72rem;">${escapeHtml(item.category || 'General')}</span>
                <span class="badge bg-secondary-subtle text-secondary font-monospace small" style="font-size: 0.72rem;">Stock: ${item.stock_quantity || 0}</span>
            </div>
        `;
        listEl.appendChild(row);
    });

    let isClosing = false;
    const closeModal = () => {
        if (isClosing) return;
        isClosing = true;
        modal.classList.add('closing');
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('closing');
            isClosing = false;
        }, 200);
    };

    const newCancel = btnCancel.cloneNode(true);
    const newConfirm = btnConfirm.cloneNode(true);
    btnCancel.parentNode.replaceChild(newCancel, btnCancel);
    btnConfirm.parentNode.replaceChild(newConfirm, btnConfirm);

    newCancel.addEventListener('click', closeModal);
    modal.onclick = (e) => {
        if (e.target === modal) closeModal();
    };

    newConfirm.addEventListener('click', async () => {
        newConfirm.disabled = true;
        newConfirm.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Eliminando...';

        try {
            const res = await fetch('/api/stock/bulk-delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({ ids: Array.from(stockSelectedIds) })
            });
            const result = await res.json();

            if (res.ok && result.success) {
                showToast(`🗑️ ${result.deleted_count || count} productos eliminados del catálogo`, 'success');
                stockSelectedIds.clear();
                closeModal();
                await fetchStockItems();
                await fetchStockTaxonomies();
            } else {
                showToast(result.error || 'Error al eliminar productos seleccionados', 'error');
            }
        } catch (err) {
            console.error('Error en eliminación masiva:', err);
            showToast('Error de conexión al eliminar productos', 'error');
        } finally {
            newConfirm.disabled = false;
            newConfirm.innerHTML = `<i class="bi bi-trash3-fill"></i> <span id="btn-confirm-bulk-delete-text">Eliminar ${count} Productos</span>`;
        }
    });

    modal.classList.remove('closing');
    modal.classList.remove('hidden');
}

function resetStockForm() {
    editingStockId = null;
    const form = document.getElementById('stock-form');
    if (form) form.reset();

    const titleEl = document.getElementById('stock-form-title');
    const iconEl = document.getElementById('stock-form-icon');
    const saveTextEl = document.getElementById('btn-save-stock-text');
    const btnCancel = document.getElementById('btn-cancel-stock');
    const badgeMargin = document.getElementById('stock-calculated-margin');

    if (titleEl) titleEl.textContent = 'Registrar Nuevo Insumo / Producto';
    if (iconEl) iconEl.className = 'bi bi-plus-circle-fill fs-5';
    if (saveTextEl) saveTextEl.textContent = 'Guardar en Catálogo';
    if (btnCancel) btnCancel.classList.add('d-none');
    if (badgeMargin) {
        badgeMargin.className = 'stock-margin-badge d-flex align-items-center justify-content-center fw-bold py-2 px-2 rounded-3 border bg-light small';
        badgeMargin.innerHTML = '<span class="text-muted">0.0%</span>';
    }
}

function editStockItem(item) {
    editingStockId = item.id;

    // Asegurar que el formulario esté expandido si estaba colapsado
    const collapseBody = document.getElementById('stock-form-collapse-body');
    const toggleIcon = document.getElementById('stock-form-toggle-icon');
    const toggleText = document.getElementById('stock-form-toggle-text');
    if (collapseBody && collapseBody.classList.contains('collapsed')) {
        collapseBody.classList.remove('collapsed');
        if (toggleIcon) toggleIcon.className = 'bi bi-chevron-up';
        if (toggleText) toggleText.textContent = 'Ocultar Formulario';
    }

    document.getElementById('stock-code').value = item.code || '';
    document.getElementById('stock-name').value = item.name || '';
    document.getElementById('stock-category').value = item.category || 'Insumos BIA';
    document.getElementById('stock-unit').value = item.unit || 'Unidad (u)';
    document.getElementById('stock-qty').value = item.stock_quantity ?? 0;
    document.getElementById('stock-min').value = item.min_stock ?? 5;
    document.getElementById('stock-cost').value = item.cost_price ?? 0;
    document.getElementById('stock-sale').value = item.sale_price ?? 0;
    if (document.getElementById('stock-batch')) document.getElementById('stock-batch').value = item.batch_number || '';
    if (document.getElementById('stock-expiry')) document.getElementById('stock-expiry').value = item.expiry_date || '';
    document.getElementById('stock-location').value = item.location || '';
    document.getElementById('stock-supplier').value = item.supplier || '';
    document.getElementById('stock-notes').value = item.notes || '';

    // Disparar cálculo de margen
    document.getElementById('stock-sale').dispatchEvent(new Event('input'));

    const titleEl = document.getElementById('stock-form-title');
    const iconEl = document.getElementById('stock-form-icon');
    const saveTextEl = document.getElementById('btn-save-stock-text');
    const btnCancel = document.getElementById('btn-cancel-stock');

    if (titleEl) titleEl.textContent = `Editar: ${item.name}`;
    if (iconEl) iconEl.className = 'bi bi-pencil-square fs-5';
    if (saveTextEl) saveTextEl.textContent = 'Actualizar Cambios en Catálogo';
    if (btnCancel) btnCancel.classList.remove('d-none');

    document.getElementById('stock-form-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function deleteStockItem(id, name) {
    const safeName = escapeHtml(name || 'este artículo');
    showConfirm(
        'Eliminar Insumo / Producto',
        `¿Estás seguro de eliminar <strong>"${safeName}"</strong> del catálogo e inventario?<br><small class="text-muted d-block mt-1">Esta acción removerá el ítem de las existencias y ventas activas.</small>`,
        async () => {
            try {
                const res = await fetch(`/api/stock/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
                if (res.ok) {
                    showToast('🗑️ Artículo eliminado del catálogo', 'success');
                    fetchStockItems();
                } else {
                    showToast('Error al eliminar artículo', 'error');
                }
            } catch (err) {
                console.error(err);
                showToast('Error de conexión', 'error');
            }
        },
        {
            icon: 'bi bi-trash3-fill',
            confirmText: 'Sí, Eliminar',
            type: 'danger'
        }
    );
}

// --- TERMINAL DE VENTAS (POS NUTRICIONAL) ---
function initPosModule() {
    const posSearch = document.getElementById('pos-search-input');
    const posCat = document.getElementById('pos-filter-category');
    const btnClearCart = document.getElementById('pos-btn-clear-cart');
    const inputDiscount = document.getElementById('pos-input-discount');
    const inputCashReceived = document.getElementById('pos-cash-received');
    const btnCheckout = document.getElementById('pos-btn-checkout');

    if (posSearch) posSearch.addEventListener('input', renderPosProductGrid);
    if (posCat) posCat.addEventListener('change', renderPosProductGrid);
    if (btnClearCart) btnClearCart.addEventListener('click', clearPosCart);

    if (inputDiscount) {
        inputDiscount.addEventListener('input', updatePosSummary);
    }

    if (inputCashReceived) {
        inputCashReceived.addEventListener('input', updateCashChangeCalculation);
    }

    // Métodos de pago
    document.querySelectorAll('.pos-pay-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.pos-pay-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            posSelectedPaymentMethod = btn.dataset.method || 'Efectivo';

            const cashPanel = document.getElementById('pos-cash-change-panel');
            if (cashPanel) {
                if (posSelectedPaymentMethod.toLowerCase() === 'efectivo') {
                    cashPanel.classList.remove('d-none');
                } else {
                    cashPanel.classList.add('d-none');
                }
            }
        });
    });

    // Autocomplete de Pacientes en POS
    initPosPatientAutocomplete();

    // Botón Finalizar Venta
    if (btnCheckout) {
        btnCheckout.addEventListener('click', handlePosCheckout);
    }
}

function initPosPatientAutocomplete() {
    const patientInput = document.getElementById('pos-patient-input');
    const dropdown = document.getElementById('pos-patient-dropdown');
    const hiddenIdp = document.getElementById('pos-patient-idp-hidden');
    const hiddenPhone = document.getElementById('pos-patient-phone-hidden');
    const btnToggleMode = document.getElementById('pos-btn-toggle-client-mode');

    if (!patientInput || !dropdown) return;

    if (btnToggleMode) {
        btnToggleMode.addEventListener('click', () => {
            patientInput.value = 'Cliente Ocasional / Mostrador';
            if (hiddenIdp) hiddenIdp.value = '';
            if (hiddenPhone) hiddenPhone.value = '';
            posSelectedPatient = { name: 'Cliente Ocasional / Mostrador', idp: '', phone: '' };
            dropdown.classList.remove('show');
            showToast('👤 Venta asignada a Cliente Ocasional', 'info');
        });
    }

    const renderPatients = (filterText = '') => {
        const norm = normalizeText(filterText);
        dropdown.replaceChildren();

        // Opción predeterminada: Cliente Ocasional
        const optOccasional = document.createElement('div');
        optOccasional.className = 'stock-dropdown-item fw-semibold';
        optOccasional.innerHTML = '<span>👤 Cliente Ocasional / Mostrador</span>';
        optOccasional.addEventListener('mousedown', (e) => {
            e.preventDefault();
            patientInput.value = 'Cliente Ocasional / Mostrador';
            if (hiddenIdp) hiddenIdp.value = '';
            if (hiddenPhone) hiddenPhone.value = '';
            posSelectedPatient = { name: 'Cliente Ocasional / Mostrador', idp: '', phone: '' };
            dropdown.classList.remove('show');
        });
        dropdown.appendChild(optOccasional);

        const clientsList = Array.isArray(allClients) ? allClients : [];
        const filtered = clientsList.filter(c => !norm || normalizeText(c.name).includes(norm) || normalizeText(c.idp || c.code).includes(norm));

        filtered.slice(0, 8).forEach(c => {
            const item = document.createElement('div');
            item.className = 'stock-dropdown-item';
            item.innerHTML = `
                <div>
                    <div class="fw-bold text-navy">${escapeHtml(c.name)}</div>
                    <div class="text-muted small" style="font-size: 0.72rem;">IDP: ${escapeHtml(c.idp || c.code || '--')} ${c.phone ? '• ' + escapeHtml(c.phone) : ''}</div>
                </div>
            `;
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
                patientInput.value = c.name;
                if (hiddenIdp) hiddenIdp.value = c.idp || c.code || '';
                if (hiddenPhone) hiddenPhone.value = c.phone || '';
                posSelectedPatient = { name: c.name, idp: c.idp || c.code || '', phone: c.phone || '' };
                dropdown.classList.remove('show');
            });
            dropdown.appendChild(item);
        });
    };

    patientInput.addEventListener('focus', () => {
        renderPatients(patientInput.value);
        dropdown.classList.add('show');
    });

    patientInput.addEventListener('input', () => {
        renderPatients(patientInput.value);
        dropdown.classList.add('show');
    });

    patientInput.addEventListener('blur', () => {
        setTimeout(() => dropdown.classList.remove('show'), 180);
    });
}

function renderPosProductGrid() {
    const grid = document.getElementById('pos-product-grid');
    const availCountEl = document.getElementById('pos-catalog-available-count');
    if (!grid || !Array.isArray(allStockItems)) return;

    const search = normalizeText(document.getElementById('pos-search-input')?.value);
    const cat = document.getElementById('pos-filter-category')?.value || 'all';

    const filtered = allStockItems.filter(i => {
        const normName = normalizeText(i.name);
        const normCode = normalizeText(i.code);
        const matchSearch = !search || normName.includes(search) || normCode.includes(search);
        const matchCat = cat === 'all' || i.category === cat;
        return matchSearch && matchCat;
    });

    if (availCountEl) availCountEl.textContent = filtered.length;

    if (filtered.length === 0) {
        grid.innerHTML = '<div class="p-4 text-center text-muted small bg-light rounded-3 col-12">No hay productos que coincidan con la búsqueda.</div>';
        return;
    }

    grid.replaceChildren();
    filtered.forEach(item => {
        const card = document.createElement('div');
        const qty = parseFloat(item.stock_quantity) || 0;
        const salePrice = parseFloat(item.sale_price) || 0;
        const isOutOfStock = qty <= 0;

        card.className = `pos-product-card ${isOutOfStock ? 'out-of-stock' : ''}`;

        let icon = '📦';
        if (item.category?.includes('BIA')) icon = '🩺';
        else if (item.category?.includes('Suplementos')) icon = '💊';
        else if (item.category?.includes('Material') || item.category?.includes('Higiene')) icon = '🧼';
        else if (item.category?.includes('Medicamentos')) icon = '💉';

        card.innerHTML = `
            <div>
                <div class="d-flex align-items-center justify-content-between mb-1">
                    <span class="pos-product-icon">${icon}</span>
                    <span class="badge ${isOutOfStock ? 'bg-danger-subtle text-danger' : (qty <= (item.min_stock || 5) ? 'bg-warning-subtle text-warning' : 'bg-success-subtle text-success')} fw-bold small">
                        ${isOutOfStock ? 'Agotado' : `${qty} ${escapeHtml(item.unit || 'u')}`}
                    </span>
                </div>
                <div class="pos-product-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
                <div class="pos-product-meta font-monospace">${escapeHtml(item.code || 'SKU')}</div>
            </div>
            <div class="pos-product-footer">
                <div class="pos-product-price">Bs. ${salePrice.toFixed(2)}</div>
                <button type="button" class="btn btn-sm btn-primary rounded-3 px-2 py-1 shadow-2xs btn-add-to-pos" ${isOutOfStock ? 'disabled' : ''}>
                    <i class="bi bi-plus-lg"></i>
                </button>
            </div>
        `;

        card.addEventListener('click', (e) => {
            if (!isOutOfStock) addToPosCart(item);
        });

        grid.appendChild(card);
    });
}

function addToPosCart(product) {
    const existing = posCart.find(i => i.id === product.id);
    const availStock = parseFloat(product.stock_quantity) || 0;

    if (existing) {
        if (existing.quantity + 1 > availStock) {
            showToast(`⚠️ No hay más existencias disponibles (${availStock} ${product.unit || 'u'})`, 'error');
            return;
        }
        existing.quantity += 1;
    } else {
        if (availStock < 1) {
            showToast(`⚠️ Producto sin stock disponible`, 'error');
            return;
        }
        posCart.push({
            id: product.id,
            code: product.code,
            name: product.name,
            unit: product.unit || 'Unidad (u)',
            unit_price: parseFloat(product.sale_price) || 0,
            cost_price: parseFloat(product.cost_price) || 0,
            max_stock: availStock,
            quantity: 1
        });
    }

    renderPosCart();
}

function updatePosCartQty(productId, delta) {
    const item = posCart.find(i => i.id === productId);
    if (!item) return;

    const newQty = item.quantity + delta;
    if (newQty <= 0) {
        removePosCartItem(productId);
        return;
    }
    if (newQty > item.max_stock) {
        showToast(`⚠️ Existencia máxima alcanzada (${item.max_stock} ${item.unit})`, 'error');
        return;
    }
    item.quantity = newQty;
    renderPosCart();
}

function removePosCartItem(productId) {
    posCart = posCart.filter(i => i.id !== productId);
    renderPosCart();
}

function clearPosCart() {
    posCart = [];
    renderPosCart();
}

function renderPosCart() {
    const container = document.getElementById('pos-cart-items-container');
    const badgeCount = document.getElementById('pos-badge-count');
    const btnCheckout = document.getElementById('pos-btn-checkout');
    if (!container) return;

    const totalQty = posCart.reduce((sum, it) => sum + it.quantity, 0);

    if (badgeCount) {
        if (totalQty > 0) {
            badgeCount.textContent = totalQty;
            badgeCount.classList.remove('d-none');
        } else {
            badgeCount.classList.add('d-none');
        }
    }

    if (btnCheckout) {
        btnCheckout.disabled = posCart.length === 0;
    }

    if (posCart.length === 0) {
        container.innerHTML = `
            <div class="text-center py-4 text-muted small">
                <i class="bi bi-cart-x fs-2 d-block mb-1 text-secondary opacity-50"></i>
                El carrito está vacío.<br>Haz clic en un producto para agregarlo.
            </div>
        `;
        updatePosSummary();
        return;
    }

    container.replaceChildren();
    posCart.forEach(it => {
        const itemRow = document.createElement('div');
        itemRow.className = 'pos-cart-item-row';

        const subtotal = it.quantity * it.unit_price;

        itemRow.innerHTML = `
            <div class="pos-cart-item-info">
                <div class="pos-cart-item-title" title="${escapeHtml(it.name)}">${escapeHtml(it.name)}</div>
                <div class="pos-cart-item-unit-price">Bs. ${it.unit_price.toFixed(2)} / ${escapeHtml(it.unit)}</div>
            </div>
            <div class="pos-cart-qty-controls">
                <button type="button" class="pos-cart-qty-btn btn-qty-minus">-</button>
                <span class="pos-cart-qty-val">${it.quantity}</span>
                <button type="button" class="pos-cart-qty-btn btn-qty-plus">+</button>
            </div>
            <div class="pos-cart-subtotal">Bs. ${subtotal.toFixed(2)}</div>
            <button type="button" class="pos-cart-btn-del" title="Eliminar ítem">&times;</button>
        `;

        itemRow.querySelector('.btn-qty-minus').addEventListener('click', () => updatePosCartQty(it.id, -1));
        itemRow.querySelector('.btn-qty-plus').addEventListener('click', () => updatePosCartQty(it.id, 1));
        itemRow.querySelector('.pos-cart-btn-del').addEventListener('click', () => removePosCartItem(it.id));

        container.appendChild(itemRow);
    });

    updatePosSummary();
}

function updatePosSummary() {
    const subtotalEl = document.getElementById('pos-summary-subtotal');
    const totalEl = document.getElementById('pos-summary-total');
    const discountInput = document.getElementById('pos-input-discount');

    const subtotal = posCart.reduce((sum, it) => sum + (it.quantity * it.unit_price), 0);
    const discount = Math.max(0, parseFloat(discountInput?.value) || 0);
    const total = Math.max(0, subtotal - discount);

    if (subtotalEl) subtotalEl.textContent = `Bs. ${subtotal.toFixed(2)}`;
    if (totalEl) totalEl.textContent = `Bs. ${total.toFixed(2)}`;

    updateCashChangeCalculation();
}

function updateCashChangeCalculation() {
    const totalEl = document.getElementById('pos-summary-total');
    const cashInput = document.getElementById('pos-cash-received');
    const changeEl = document.getElementById('pos-cash-change');
    if (!totalEl || !cashInput || !changeEl) return;

    const subtotal = posCart.reduce((sum, it) => sum + (it.quantity * it.unit_price), 0);
    const discount = Math.max(0, parseFloat(document.getElementById('pos-input-discount')?.value) || 0);
    const total = Math.max(0, subtotal - discount);

    const received = parseFloat(cashInput.value) || 0;
    const change = Math.max(0, received - total);

    changeEl.textContent = `Bs. ${change.toFixed(2)}`;
}

async function handlePosCheckout() {
    if (posCart.length === 0) {
        showToast('El carrito de ventas está vacío', 'error');
        return;
    }

    const patientName = document.getElementById('pos-patient-input')?.value.trim() || 'Cliente Ocasional / Mostrador';
    const patientIdp = document.getElementById('pos-patient-idp-hidden')?.value || '';
    const patientPhone = document.getElementById('pos-patient-phone-hidden')?.value || '';
    const discount = Math.max(0, parseFloat(document.getElementById('pos-input-discount')?.value) || 0);
    const amountReceived = parseFloat(document.getElementById('pos-cash-received')?.value) || 0;

    const btnCheckout = document.getElementById('pos-btn-checkout');
    const originalText = btnCheckout.innerHTML;
    btnCheckout.disabled = true;
    btnCheckout.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Procesando Venta...';

    const payload = {
        patient_name: patientName,
        patient_idp: patientIdp,
        patient_phone: patientPhone,
        items: posCart.map(it => ({
            stock_item_id: it.id,
            quantity: it.quantity,
            unit_price: it.unit_price
        })),
        discount: discount,
        payment_method: posSelectedPaymentMethod,
        amount_received: amountReceived > 0 ? amountReceived : undefined
    };

    try {
        const res = await fetch('/api/sales', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(payload)
        });
        const result = await res.json();

        if (res.ok && result.success && result.sale) {
            showToast(`🎉 ${result.message}`, 'success');
            clearPosCart();
            document.getElementById('pos-patient-input').value = '';
            document.getElementById('pos-input-discount').value = '0.00';
            if (document.getElementById('pos-cash-received')) document.getElementById('pos-cash-received').value = '';

            // Refrescar Stock y abrir recibo digital
            await fetchStockItems();
            await fetchSalesHistory();
            openDigitalReceiptModal(result.sale);
        } else {
            showToast(result.error || 'Error al completar la venta', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Error de conexión al procesar la venta', 'error');
    } finally {
        btnCheckout.disabled = false;
        btnCheckout.innerHTML = originalText;
    }
}

// --- HISTORIAL DE VENTAS & COMPROBANTES ---
function initSalesModule() {
    const searchInput = document.getElementById('sales-search-input');
    const paymentFilter = document.getElementById('sales-filter-payment');
    const statusFilter = document.getElementById('sales-filter-status');

    if (searchInput) searchInput.addEventListener('input', filterAndRenderSales);
    if (paymentFilter) paymentFilter.addEventListener('change', filterAndRenderSales);
    if (statusFilter) statusFilter.addEventListener('change', filterAndRenderSales);
}

async function fetchSalesHistory() {
    const tbody = document.getElementById('sales-tbody');
    const totalCountEl = document.getElementById('sales-total-count');
    if (!tbody) return;

    try {
        const [salesRes, statsRes] = await Promise.all([
            fetch('/api/sales', { headers: getAuthHeaders() }),
            fetch('/api/sales/stats', { headers: getAuthHeaders() })
        ]);

        if (salesRes.ok) {
            allSalesHistory = await salesRes.json();
            if (totalCountEl) totalCountEl.textContent = Array.isArray(allSalesHistory) ? allSalesHistory.length : 0;
            filterAndRenderSales();
        }

        if (statsRes.ok) {
            const stats = await statsRes.json();
            updateSalesKPIs(stats);
        }
    } catch (err) {
        console.error('Error al cargar historial de ventas:', err);
    }
}

function updateSalesKPIs(stats) {
    if (!stats) return;
    const totalAmountEl = document.getElementById('sales-kpi-total-amount');
    const totalProfitEl = document.getElementById('sales-kpi-total-profit');
    const todayAmountEl = document.getElementById('sales-kpi-today-amount');
    const todayCountEl = document.getElementById('sales-kpi-today-count');
    const avgTicketEl = document.getElementById('sales-kpi-avg-ticket');

    if (totalAmountEl) totalAmountEl.textContent = `Bs. ${(stats.total_sales_amount || 0).toFixed(2)}`;
    if (totalProfitEl) totalProfitEl.textContent = `Bs. ${(stats.total_profit || 0).toFixed(2)}`;
    if (todayAmountEl) todayAmountEl.textContent = `Bs. ${(stats.today_sales_amount || 0).toFixed(2)}`;
    if (todayCountEl) todayCountEl.textContent = stats.today_sales_count || 0;
    if (avgTicketEl) avgTicketEl.textContent = `Bs. ${(stats.avg_ticket || 0).toFixed(2)}`;
}

function filterAndRenderSales() {
    const tbody = document.getElementById('sales-tbody');
    if (!tbody || !Array.isArray(allSalesHistory)) return;

    const search = normalizeText(document.getElementById('sales-search-input')?.value);
    const payment = document.getElementById('sales-filter-payment')?.value || 'all';
    const status = document.getElementById('sales-filter-status')?.value || 'all';

    const filtered = allSalesHistory.filter(s => {
        const normNum = normalizeText(s.receipt_number);
        const normPat = normalizeText(s.patient_name);
        const normItems = normalizeText((s.items || []).map(i => i.name).join(' '));

        const matchSearch = !search || normNum.includes(search) || normPat.includes(search) || normItems.includes(search);
        const matchPayment = payment === 'all' || (s.payment_method || '').toLowerCase() === payment.toLowerCase();
        const matchStatus = status === 'all' || s.status === status;

        return matchSearch && matchPayment && matchStatus;
    });

    renderSalesTable(filtered);
}

function renderSalesTable(sales) {
    const tbody = document.getElementById('sales-tbody');
    if (!tbody) return;

    if (!sales || sales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-5 text-muted">No se encontraron ventas registradas.</td></tr>';
        return;
    }

    tbody.replaceChildren();
    sales.forEach(sale => {
        const tr = document.createElement('tr');
        const isCancelled = sale.status === 'CANCELLED';

        const dateStr = sale.created_at ? new Date(sale.created_at).toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '--';
        const itemsSummary = (sale.items || []).map(i => `${i.quantity}x ${escapeHtml(i.name)}`).join(', ');

        tr.innerHTML = `
            <td>
                <span class="badge bg-primary-subtle text-primary font-monospace fw-bold px-2 py-1">${escapeHtml(sale.receipt_number)}</span>
            </td>
            <td><span class="small text-secondary"><i class="bi bi-clock me-1"></i>${dateStr}</span></td>
            <td>
                <div class="fw-bold text-navy">${escapeHtml(sale.patient_name)}</div>
                ${sale.patient_idp ? `<div class="text-muted small" style="font-size: 0.72rem;">IDP: ${escapeHtml(sale.patient_idp)}</div>` : ''}
            </td>
            <td>
                <div class="small text-truncate" style="max-width: 200px;" title="${escapeHtml(itemsSummary)}">${itemsSummary || 'Sin ítems'}</div>
            </td>
            <td>
                <span class="badge bg-light text-secondary border small">${escapeHtml(sale.payment_method || 'Efectivo')}</span>
            </td>
            <td>
                <span class="fw-bold font-monospace ${isCancelled ? 'text-decoration-line-through text-muted' : 'text-success'}">Bs. ${(sale.total || 0).toFixed(2)}</span>
            </td>
            <td>
                <span class="badge ${isCancelled ? 'bg-danger-subtle text-danger' : 'bg-success-subtle text-success'} fw-bold small">
                    ${isCancelled ? '🚫 Anulada' : '✅ Completada'}
                </span>
            </td>
            <td class="text-end">
                <div class="d-inline-flex align-items-center gap-1.5">
                    <button type="button" class="btn btn-sm btn-outline-primary py-1 px-2 fw-semibold btn-view-receipt shadow-2xs" style="font-size: 0.76rem;" title="Ver Comprobante">
                        <i class="bi bi-receipt"></i> Recibo
                    </button>
                    ${!isCancelled ? `
                        <button type="button" class="btn btn-sm btn-outline-danger py-1 px-2 btn-cancel-sale shadow-2xs" style="font-size: 0.76rem;" title="Anular Venta y Devolver Stock">
                            <i class="bi bi-x-circle"></i>
                        </button>
                    ` : ''}
                </div>
            </td>
        `;

        tr.querySelector('.btn-view-receipt').addEventListener('click', () => openDigitalReceiptModal(sale));
        const btnCancel = tr.querySelector('.btn-cancel-sale');
        if (btnCancel) {
            btnCancel.addEventListener('click', () => handleCancelSale(sale));
        }

        tbody.appendChild(tr);
    });
}

function handleCancelSale(sale) {
    showConfirm(
        'Anular Venta & Restituir Stock',
        `¿Estás seguro de anular la venta <strong class="text-navy">${escapeHtml(sale.receipt_number)}</strong> por Bs. ${(sale.total || 0).toFixed(2)}? Las cantidades vendidas retornarán automáticamente al inventario.`,
        async () => {
            try {
                const res = await fetch(`/api/sales/${sale.id}`, { method: 'DELETE', headers: getAuthHeaders() });
                const result = await res.json();
                if (res.ok && result.success) {
                    showToast(`🚫 Venta ${sale.receipt_number} anulada y stock restituido`, 'success');
                    await fetchStockItems();
                    await fetchSalesHistory();
                    await fetchKardexMovements();
                } else {
                    showToast(result.error || 'Error al anular venta', 'error');
                }
            } catch (err) {
                console.error(err);
                showToast('Error de conexión', 'error');
            }
        },
        { confirmText: 'Anular Venta', icon: 'bi bi-x-octagon-fill' }
    );
}

// --- MODAL DE RECIBO DIGITAL CLÍNICO ---
function initDigitalReceiptModal() {
    const modal = document.getElementById('modal-digital-receipt');
    if (!modal) return;

    const btnCloseHeader = document.getElementById('btn-close-receipt-modal');
    const btnCloseFooter = document.getElementById('btn-footer-close-receipt');
    const btnPrint = document.getElementById('btn-receipt-print');
    const btnWhatsApp = document.getElementById('btn-receipt-whatsapp');

    const closeModal = () => {
        modal.classList.add('d-none', 'hidden');
        modal.style.display = 'none';
    };

    if (btnCloseHeader) btnCloseHeader.addEventListener('click', closeModal);
    if (btnCloseFooter) btnCloseFooter.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    if (btnPrint) {
        btnPrint.addEventListener('click', () => window.print());
    }

    if (btnWhatsApp) {
        btnWhatsApp.addEventListener('click', () => {
            if (!currentViewedReceipt) return;
            const r = currentViewedReceipt;
            let msg = `*COMPROBANTE DE PAGO - VITAMETRIX*\n`;
            msg += `📄 *Recibo:* ${r.receipt_number}\n`;
            msg += `👤 *Paciente:* ${r.patient_name}\n`;
            msg += `📅 *Fecha:* ${new Date(r.created_at).toLocaleString('es-ES')}\n\n`;
            msg += `*DETALLE DE PRODUCTOS:*\n`;
            (r.items || []).forEach(it => {
                msg += `• ${it.quantity}x ${it.name} - Bs. ${(it.subtotal || 0).toFixed(2)}\n`;
            });
            msg += `\n💵 *TOTAL CANCELADO: Bs. ${(r.total || 0).toFixed(2)}*\n`;
            msg += `💳 *Método:* ${r.payment_method || 'Efectivo'}\n\n`;
            msg += `_¡Gracias por su confianza en VitaMetrix!_`;

            let phoneClean = (r.patient_phone || '').replace(/[^0-9]/g, '');
            if (phoneClean && phoneClean.length === 8 && (phoneClean.startsWith('6') || phoneClean.startsWith('7'))) {
                phoneClean = '591' + phoneClean;
            }
            const waUrl = phoneClean
                ? `https://wa.me/${phoneClean}?text=${encodeURIComponent(msg)}`
                : `https://wa.me/?text=${encodeURIComponent(msg)}`;

            window.open(waUrl, '_blank');
        });
    }
}

function openDigitalReceiptModal(sale) {
    currentViewedReceipt = sale;
    const modal = document.getElementById('modal-digital-receipt');
    if (!modal) return;

    modal.classList.remove('d-none', 'hidden');
    modal.style.display = 'flex';

    document.getElementById('receipt-modal-number').textContent = sale.receipt_number;
    document.getElementById('receipt-patient-name').textContent = sale.patient_name || 'Cliente Ocasional';
    document.getElementById('receipt-patient-idp').textContent = sale.patient_idp ? `IDP: ${sale.patient_idp}` : '';
    document.getElementById('receipt-datetime').textContent = sale.created_at ? new Date(sale.created_at).toLocaleString('es-ES') : new Date().toLocaleString('es-ES');
    document.getElementById('receipt-payment-method-badge').textContent = `Método: ${sale.payment_method || 'Efectivo'}`;

    const itemsTbody = document.getElementById('receipt-items-tbody');
    itemsTbody.replaceChildren();

    (sale.items || []).forEach(it => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="ps-0">
                <div class="fw-semibold text-dark">${escapeHtml(it.name)}</div>
                <div class="text-muted small" style="font-size: 0.7rem;">${escapeHtml(it.unit || 'u')}</div>
            </td>
            <td class="text-center font-monospace">${it.quantity}</td>
            <td class="text-end font-monospace">Bs. ${(it.unit_price || 0).toFixed(2)}</td>
            <td class="text-end pe-0 font-monospace fw-bold">Bs. ${(it.subtotal || 0).toFixed(2)}</td>
        `;
        itemsTbody.appendChild(tr);
    });

    document.getElementById('receipt-subtotal-val').textContent = `Bs. ${(sale.subtotal || 0).toFixed(2)}`;
    const discountRow = document.getElementById('receipt-discount-row');
    if (sale.discount && sale.discount > 0) {
        discountRow.classList.remove('d-none');
        document.getElementById('receipt-discount-val').textContent = `-Bs. ${(sale.discount).toFixed(2)}`;
    } else {
        discountRow.classList.add('d-none');
    }
    document.getElementById('receipt-total-val').textContent = `Bs. ${(sale.total || 0).toFixed(2)}`;

    const cashBreakdown = document.getElementById('receipt-cash-breakdown');
    if ((sale.payment_method || '').toLowerCase() === 'efectivo' && sale.amount_received) {
        cashBreakdown.classList.remove('d-none');
        document.getElementById('receipt-amount-received').textContent = `Bs. ${(sale.amount_received || 0).toFixed(2)}`;
        document.getElementById('receipt-change-given').textContent = `Bs. ${(sale.change_given || 0).toFixed(2)}`;
    } else {
        cashBreakdown.classList.add('d-none');
    }

    if (sale.notes) {
        document.getElementById('receipt-notes-val').textContent = sale.notes;
    }

    modal.classList.remove('d-none');
}

// --- KARDEX & AUDITORÍA DE MOVIMIENTOS ---
function initKardexModule() {
    const btnRefresh = document.getElementById('btn-refresh-kardex');
    const searchInput = document.getElementById('kardex-search-input');
    const typeFilter = document.getElementById('kardex-filter-type');

    if (btnRefresh) btnRefresh.addEventListener('click', fetchKardexMovements);
    if (searchInput) searchInput.addEventListener('input', filterAndRenderKardex);
    if (typeFilter) typeFilter.addEventListener('change', filterAndRenderKardex);
}

async function fetchKardexMovements() {
    const tbody = document.getElementById('kardex-tbody');
    if (!tbody) return;

    try {
        const res = await fetch('/api/stock/movements', { headers: getAuthHeaders() });
        if (res.ok) {
            allStockMovements = await res.json();
            filterAndRenderKardex();
        }
    } catch (err) {
        console.error('Error al consultar Kardex:', err);
    }
}

function filterAndRenderKardex() {
    const tbody = document.getElementById('kardex-tbody');
    if (!tbody || !Array.isArray(allStockMovements)) return;

    const search = normalizeText(document.getElementById('kardex-search-input')?.value);
    const type = document.getElementById('kardex-filter-type')?.value || 'all';

    const filtered = allStockMovements.filter(m => {
        const normName = normalizeText(m.item_name);
        const normReason = normalizeText(m.reason);
        const matchSearch = !search || normName.includes(search) || normReason.includes(search);
        const matchType = type === 'all' || m.type === type;
        return matchSearch && matchType;
    });

    renderKardexTable(filtered);
}

function renderKardexTable(movements) {
    const tbody = document.getElementById('kardex-tbody');
    if (!tbody) return;

    if (!movements || movements.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-5 text-muted">No hay movimientos registrados en el Kardex.</td></tr>';
        return;
    }

    tbody.replaceChildren();
    movements.forEach(m => {
        const tr = document.createElement('tr');
        const dateStr = m.created_at ? new Date(m.created_at).toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '--';

        let badgeType = '<span class="badge bg-secondary-subtle text-secondary small">AJUSTE</span>';
        let qtyColor = 'text-dark';
        let prefix = '';

        if (m.type === 'IN') {
            badgeType = '<span class="badge bg-success-subtle text-success small">📥 ENTRADA</span>';
            qtyColor = 'text-success';
            prefix = '+';
        } else if (m.type === 'OUT') {
            badgeType = '<span class="badge bg-danger-subtle text-danger small">📤 SALIDA</span>';
            qtyColor = 'text-danger';
            prefix = '-';
        } else if (m.type === 'SALE') {
            badgeType = '<span class="badge bg-primary-subtle text-primary small">🛒 VENTA</span>';
            qtyColor = 'text-primary';
            prefix = '-';
        } else if (m.type === 'SALE_CANCEL') {
            badgeType = '<span class="badge bg-warning-subtle text-warning small">↩️ DEVOLUCIÓN</span>';
            qtyColor = 'text-success';
            prefix = '+';
        }

        tr.innerHTML = `
            <td><span class="small text-secondary font-monospace">${dateStr}</span></td>
            <td><strong class="text-navy">${escapeHtml(m.item_name)}</strong></td>
            <td>${badgeType}</td>
            <td><strong class="font-monospace ${qtyColor}">${prefix}${m.quantity}</strong></td>
            <td><span class="font-monospace text-muted">${m.previous_quantity}</span></td>
            <td><strong class="font-monospace text-dark">${m.new_quantity}</strong></td>
            <td><span class="small text-secondary">${escapeHtml(m.reason || '--')}</span></td>
        `;

        tbody.appendChild(tr);
    });
}

// --- MODAL DE AJUSTE RÁPIDO DE STOCK ---
function initQuickStockAdjustModal() {
    const modal = document.getElementById('modal-quick-stock-adjust');
    if (!modal) return;

    const btnClose = document.getElementById('btn-close-quick-adjust');
    const btnCancel = document.getElementById('btn-cancel-quick-adjust');
    const btnConfirm = document.getElementById('btn-confirm-quick-adjust');

    const closeModal = () => modal.classList.add('d-none');

    if (btnClose) btnClose.addEventListener('click', closeModal);
    if (btnCancel) btnCancel.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    document.querySelectorAll('.adjust-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.adjust-type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentMovementType = btn.dataset.type || 'IN';

            const qtyLabel = document.getElementById('quick-adjust-qty-label');
            if (qtyLabel) {
                if (currentMovementType === 'IN') qtyLabel.textContent = 'Cantidad a Ingresar';
                else if (currentMovementType === 'OUT') qtyLabel.textContent = 'Cantidad a Retirar';
                else qtyLabel.textContent = 'Nuevo Stock Total';
            }
        });
    });

    if (btnConfirm) {
        btnConfirm.addEventListener('click', async () => {
            if (!currentQuickAdjustItem) return;

            const qty = parseFloat(document.getElementById('quick-adjust-quantity').value);
            const reason = document.getElementById('quick-adjust-reason').value.trim();

            if (currentMovementType === 'ADJUST') {
                if (isNaN(qty) || qty < 0) {
                    showToast('Ingresa un valor de stock válido (0 o mayor)', 'error');
                    return;
                }
            } else {
                if (!qty || qty <= 0 || isNaN(qty)) {
                    showToast('Ingresa una cantidad válida mayor a 0', 'error');
                    return;
                }
                if (currentMovementType === 'OUT' && qty > (parseFloat(currentQuickAdjustItem.stock_quantity) || 0)) {
                    showToast(`⚠️ No puedes retirar más del stock disponible (${currentQuickAdjustItem.stock_quantity})`, 'error');
                    return;
                }
            }

            btnConfirm.disabled = true;
            btnConfirm.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Registrando...';

            try {
                const res = await fetch(`/api/stock/${currentQuickAdjustItem.id}/movement`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                    body: JSON.stringify({
                        type: currentMovementType,
                        quantity: qty,
                        reason: reason
                    })
                });
                const result = await res.json();

                if (res.ok && result.success) {
                    showToast('✅ Movimiento de Kardex registrado exitosamente', 'success');
                    closeModal();
                    await fetchStockItems();
                    await fetchKardexMovements();
                } else {
                    showToast(result.error || 'Error al registrar movimiento', 'error');
                }
            } catch (err) {
                console.error(err);
                showToast('Error de conexión', 'error');
            } finally {
                btnConfirm.disabled = false;
                btnConfirm.innerHTML = '<i class="bi bi-check-lg"></i> Registrar Movimiento';
            }
        });
    }
}

function openQuickStockAdjustModal(item) {
    currentQuickAdjustItem = item;
    currentMovementType = 'IN';

    const modal = document.getElementById('modal-quick-stock-adjust');
    if (!modal) return;

    document.getElementById('quick-adjust-item-name').textContent = `${item.name} (${item.code || 'SKU'})`;
    document.getElementById('quick-adjust-current-stock').textContent = `${item.stock_quantity ?? 0} ${item.unit || 'u'}`;
    document.getElementById('quick-adjust-quantity').value = '';
    document.getElementById('quick-adjust-reason').value = '';

    document.querySelectorAll('.adjust-type-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.type === 'IN');
    });
    document.getElementById('quick-adjust-qty-label').textContent = 'Cantidad a Ingresar';

    modal.classList.remove('d-none');
}

// --- MODAL DE GESTIÓN DE TAXONOMÍAS (CATEGORÍAS Y U/M - OPCIÓN 1) ---
function initStockTaxonomyModal() {
    const modal = document.getElementById('stock-taxonomy-modal');
    if (!modal) return;

    const btnOpen = document.getElementById('btn-open-stock-taxonomies');
    const btnClose = document.getElementById('stock-tax-modal-close');
    const btnFooterClose = document.getElementById('stock-tax-btn-close');

    const tabCatsBtn = document.getElementById('tab-tax-cats-btn');
    const tabUnitsBtn = document.getElementById('tab-tax-units-btn');
    const tabCatsContent = document.getElementById('tab-tax-cats-content');
    const tabUnitsContent = document.getElementById('tab-tax-units-content');

    const openModal = () => {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        fetchStockTaxonomies();
    };

    const closeModal = () => {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    };

    if (btnOpen) btnOpen.addEventListener('click', openModal);
    if (btnClose) btnClose.addEventListener('click', closeModal);
    if (btnFooterClose) btnFooterClose.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    const segmentedControl = document.getElementById('stock-tax-segmented-control');
    if (tabCatsBtn && tabUnitsBtn) {
        tabCatsBtn.addEventListener('click', () => {
            tabCatsBtn.classList.add('active');
            tabUnitsBtn.classList.remove('active');
            segmentedControl?.setAttribute('data-active', 'cats');
            tabCatsContent?.classList.remove('d-none');
            tabUnitsContent?.classList.add('d-none');
        });

        tabUnitsBtn.addEventListener('click', () => {
            tabUnitsBtn.classList.add('active');
            tabCatsBtn.classList.remove('active');
            segmentedControl?.setAttribute('data-active', 'units');
            tabUnitsContent?.classList.remove('d-none');
            tabCatsContent?.classList.add('d-none');
        });
    }

    // Agregar Nueva Categoría
    const btnAddCat = document.getElementById('btn-add-cat');
    const inputNewCat = document.getElementById('new-cat-name');
    if (btnAddCat && inputNewCat) {
        btnAddCat.addEventListener('click', async () => {
            const catName = inputNewCat.value.trim();
            if (!catName) {
                showToast('Ingresa un nombre para la categoría', 'error');
                return;
            }
            try {
                const res = await fetch('/api/stock/taxonomies/category', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                    body: JSON.stringify({ name: catName, icon: '📦' })
                });
                const result = await res.json();
                if (res.ok && result.success) {
                    inputNewCat.value = '';
                    showToast(`✅ Categoría "${catName}" guardada en el catálogo`, 'success');
                    await fetchStockTaxonomies();
                    updateStockCategoryOptions(allStockItems);
                } else {
                    showToast(result.error || 'No se pudo guardar la categoría', 'error');
                }
            } catch (err) {
                console.error(err);
                showToast('Error de conexión', 'error');
            }
        });
    }

    // Agregar Nueva Unidad de Medida (Opción 1: Solo Nombre)
    const btnAddUnit = document.getElementById('btn-add-unit');
    const inputNewUnit = document.getElementById('new-unit-name');
    if (btnAddUnit && inputNewUnit) {
        btnAddUnit.addEventListener('click', async () => {
            const unitName = inputNewUnit.value.trim();
            if (!unitName) {
                showToast('Ingresa un nombre para la Unidad de Medida', 'error');
                return;
            }
            try {
                const res = await fetch('/api/stock/taxonomies/unit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                    body: JSON.stringify({ name: unitName })
                });
                const result = await res.json();
                if (res.ok && result.success) {
                    inputNewUnit.value = '';
                    showToast(`✅ Unidad "${unitName}" guardada en el catálogo`, 'success');
                    await fetchStockTaxonomies();
                } else {
                    showToast(result.error || 'No se pudo guardar la unidad', 'error');
                }
            } catch (err) {
                console.error(err);
                showToast('Error de conexión', 'error');
            }
        });
    }

    // Buscadores en tiempo real optimizados con debounce
    let taxCatsDebounceTimer = null;
    const searchTaxCats = document.getElementById('search-tax-cats');
    if (searchTaxCats) {
        searchTaxCats.addEventListener('input', (e) => {
            clearTimeout(taxCatsDebounceTimer);
            taxCatsDebounceTimer = setTimeout(() => renderTaxonomyCategories(e.target.value), 60);
        });
    }

    let taxUnitsDebounceTimer = null;
    const searchTaxUnits = document.getElementById('search-tax-units');
    if (searchTaxUnits) {
        searchTaxUnits.addEventListener('input', (e) => {
            clearTimeout(taxUnitsDebounceTimer);
            taxUnitsDebounceTimer = setTimeout(() => renderTaxonomyUnits(e.target.value), 60);
        });
    }

    // Modales de Renombrar y Editar
    const btnCloseRename = document.getElementById('btn-close-rename-modal');
    const btnCancelRename = document.getElementById('btn-cancel-rename-modal');
    const btnConfirmRename = document.getElementById('btn-confirm-rename-modal');
    if (btnCloseRename) btnCloseRename.addEventListener('click', closeRenameCategoryModal);
    if (btnCancelRename) btnCancelRename.addEventListener('click', closeRenameCategoryModal);
    if (btnConfirmRename) btnConfirmRename.addEventListener('click', handleConfirmRenameCategory);

    const btnCloseEditUnit = document.getElementById('btn-close-edit-unit-modal');
    const btnCancelEditUnit = document.getElementById('btn-cancel-edit-unit-modal');
    const btnConfirmEditUnit = document.getElementById('btn-confirm-edit-unit-modal');
    if (btnCloseEditUnit) btnCloseEditUnit.addEventListener('click', closeEditUnitModal);
    if (btnCancelEditUnit) btnCancelEditUnit.addEventListener('click', closeEditUnitModal);
    if (btnConfirmEditUnit) btnConfirmEditUnit.addEventListener('click', handleConfirmEditUnit);

    const btnCloseDelete = document.getElementById('btn-close-delete-tax-modal');
    const btnCancelDelete = document.getElementById('btn-cancel-delete-tax-modal');
    const btnConfirmDelete = document.getElementById('btn-confirm-delete-tax-modal');
    if (btnCloseDelete) btnCloseDelete.addEventListener('click', closeConfirmDeleteTaxonomyModal);
    if (btnCancelDelete) btnCancelDelete.addEventListener('click', closeConfirmDeleteTaxonomyModal);
    if (btnConfirmDelete) {
        btnConfirmDelete.addEventListener('click', async () => {
            if (typeof pendingDeleteTaxonomyCallback === 'function') {
                const cb = pendingDeleteTaxonomyCallback;
                closeConfirmDeleteTaxonomyModal();
                await cb();
            } else {
                closeConfirmDeleteTaxonomyModal();
            }
        });
    }
}

async function fetchStockTaxonomies() {
    try {
        const res = await fetch('/api/stock/taxonomies', { headers: getAuthHeaders() });
        if (res.ok) {
            try {
                stockTaxonomiesData = await res.json();
            } catch (e) {
                stockTaxonomiesData = { categories: [], units: [] };
            }
            renderTaxonomyCategories();
            renderTaxonomyUnits();
            if (typeof updateStockCategoryOptions === 'function') {
                updateStockCategoryOptions(allStockItems || []);
            }
        }
    } catch (err) {
        console.error('Error al cargar taxonomías de stock:', err);
    }
}

function renderTaxonomyCategories(filterText = '') {
    const listEl = document.getElementById('stock-tax-cat-list');
    if (!listEl || !stockTaxonomiesData?.categories) return;

    const norm = normalizeText(filterText);
    const filtered = stockTaxonomiesData.categories.filter(c => !norm || normalizeText(c.name).includes(norm));

    if (filtered.length === 0) {
        listEl.innerHTML = '<div class="p-3 text-muted small text-center bg-light rounded-3">No se encontraron categorías coincidentes.</div>';
        return;
    }

    const frag = document.createDocumentFragment();

    filtered.forEach(cat => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'd-flex align-items-center justify-content-between p-2.5 bg-white rounded-3 border shadow-2xs gap-2 stock-tax-list-item';

        itemDiv.innerHTML = `
            <div class="d-flex align-items-center gap-2 text-truncate flex-grow-1">
                <span class="fs-5">${cat.icon || '📦'}</span>
                <div class="text-truncate">
                    <div class="fw-bold text-navy text-truncate cat-name-label">${escapeHtml(cat.name)}</div>
                    <div class="text-muted small" style="font-size: 0.72rem;">${cat.count} ${cat.count === 1 ? 'producto' : 'productos'} vinculados</div>
                </div>
            </div>
            <div class="d-inline-flex align-items-center gap-1.5">
                <button type="button" class="btn btn-sm btn-outline-secondary d-inline-flex align-items-center justify-content-center p-0 rounded-circle shadow-2xs text-dark btn-rename-cat" style="width: 30px; height: 30px;" title="Renombrar categoría">
                    <i class="bi bi-pencil-square" style="font-size: 0.85rem;"></i>
                </button>
                <button type="button" class="btn btn-sm btn-outline-danger d-inline-flex align-items-center justify-content-center p-0 rounded-circle shadow-2xs btn-delete-cat" style="width: 30px; height: 30px;" title="Eliminar categoría">
                    <i class="bi bi-trash3" style="font-size: 0.85rem;"></i>
                </button>
            </div>
        `;

        itemDiv.querySelector('.btn-rename-cat').addEventListener('click', () => openRenameCategoryModal(cat.name));
        itemDiv.querySelector('.btn-delete-cat').addEventListener('click', () => {
            const warningText = cat.count > 0 ? `Esta categoría tiene ${cat.count} productos vinculados. Al eliminarla, serán reasignados a "Otros".` : null;
            showConfirmDeleteTaxonomyModal({
                title: 'Eliminar Categoría',
                message: `¿Estás seguro de eliminar la categoría <strong class="text-navy">"${escapeHtml(cat.name)}"</strong>?`,
                warningText: warningText,
                onConfirm: async () => {
                    try {
                        const res = await fetch(`/api/stock/taxonomies/category/${encodeURIComponent(cat.name)}`, { method: 'DELETE' });
                        if (res.ok) {
                            showToast(`🗑️ Categoría "${cat.name}" eliminada`, 'success');
                            await fetchStockTaxonomies();
                            await fetchStockItems();
                        }
                    } catch (err) {
                        console.error(err);
                    }
                }
            });
        });

        frag.appendChild(itemDiv);
    });

    listEl.replaceChildren(frag);
}

function openRenameCategoryModal(oldName) {
    const modal = document.getElementById('modal-rename-category');
    const displayOld = document.getElementById('rename-modal-old-name-display');
    const hiddenOld = document.getElementById('rename-modal-old-name-hidden');
    const inputNew = document.getElementById('rename-modal-input');
    if (!modal || !inputNew) return;

    if (displayOld) displayOld.textContent = `"${oldName}"`;
    if (hiddenOld) hiddenOld.value = oldName;
    inputNew.value = oldName;

    modal.classList.remove('d-none');
    setTimeout(() => {
        inputNew.focus();
        inputNew.select();
    }, 60);
}

function closeRenameCategoryModal() {
    const modal = document.getElementById('modal-rename-category');
    if (modal) modal.classList.add('d-none');
}

async function handleConfirmRenameCategory() {
    const hiddenOld = document.getElementById('rename-modal-old-name-hidden');
    const inputNew = document.getElementById('rename-modal-input');
    if (!hiddenOld || !inputNew) return;

    const oldName = hiddenOld.value.trim();
    const newName = inputNew.value.trim();

    if (!newName) {
        showToast('El nombre de la categoría no puede estar vacío', 'error');
        return;
    }
    if (newName.toLowerCase() === oldName.toLowerCase()) {
        closeRenameCategoryModal();
        return;
    }

    closeRenameCategoryModal();
    try {
        const res = await fetch('/api/stock/categories/rename', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ old_name: oldName, new_name: newName })
        });
        const result = await res.json();
        if (res.ok && result.success) {
            showToast(`✅ Categoría actualizada a "${newName}"`, 'success');
            await fetchStockTaxonomies();
            await fetchStockItems();
        } else {
            showToast(result.error || 'Error al renombrar categoría', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Error de conexión', 'error');
    }
}

// --- RENDERIZADO DE UNIDADES DE MEDIDA (OPCIÓN 1 PLANA OPTIMIZADA) ---
function renderTaxonomyUnits(filterText = '') {
    const listEl = document.getElementById('stock-tax-unit-list');
    if (!listEl || !stockTaxonomiesData?.units) return;

    const norm = normalizeText(filterText);
    const filtered = stockTaxonomiesData.units.filter(u => !norm || normalizeText(u.name).includes(norm));

    if (filtered.length === 0) {
        listEl.innerHTML = '<div class="p-3 text-muted small text-center bg-light rounded-3">No se encontraron unidades registradas.</div>';
        return;
    }

    const frag = document.createDocumentFragment();

    filtered.forEach(unit => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'd-flex align-items-center justify-content-between p-2.5 bg-white rounded-3 border shadow-2xs gap-2 stock-tax-list-item';

        const count = unit.count || 0;

        itemDiv.innerHTML = `
            <div class="d-flex align-items-center gap-2 text-truncate flex-grow-1">
                <span class="fs-5">📏</span>
                <div class="text-truncate">
                    <div class="fw-bold text-navy text-truncate">${escapeHtml(unit.name)}</div>
                    <div class="text-muted small" style="font-size: 0.72rem;">${count} ${count === 1 ? 'producto vinculado' : 'productos vinculados'}</div>
                </div>
            </div>
            <div class="d-inline-flex align-items-center gap-1.5">
                <button type="button" class="btn btn-sm btn-outline-secondary d-inline-flex align-items-center justify-content-center p-0 rounded-circle shadow-2xs text-dark btn-edit-unit-direct" style="width: 30px; height: 30px;" title="Editar nombre de unidad">
                    <i class="bi bi-pencil-square" style="font-size: 0.85rem;"></i>
                </button>
                <button type="button" class="btn btn-sm btn-outline-danger d-inline-flex align-items-center justify-content-center p-0 rounded-circle shadow-2xs btn-delete-unit-direct" style="width: 30px; height: 30px;" title="Eliminar unidad">
                    <i class="bi bi-trash3" style="font-size: 0.85rem;"></i>
                </button>
            </div>
        `;

        itemDiv.querySelector('.btn-edit-unit-direct').addEventListener('click', () => openEditUnitModal(unit.name));
        itemDiv.querySelector('.btn-delete-unit-direct').addEventListener('click', () => {
            showConfirmDeleteTaxonomyModal({
                title: 'Eliminar Unidad de Medida',
                message: `¿Estás seguro de eliminar la unidad <strong class="text-navy">"${escapeHtml(unit.name)}"</strong> del catálogo?`,
                warningText: null,
                onConfirm: async () => {
                    try {
                        const res = await fetch(`/api/stock/taxonomies/unit/${encodeURIComponent(unit.name)}`, { method: 'DELETE' });
                        if (res.ok) {
                            showToast(`🗑️ Unidad "${unit.name}" eliminada`, 'success');
                            await fetchStockTaxonomies();
                            await fetchStockItems();
                        }
                    } catch (err) {
                        console.error(err);
                    }
                }
            });
        });

        frag.appendChild(itemDiv);
    });

    listEl.replaceChildren(frag);
}

function openEditUnitModal(unitName) {
    const modal = document.getElementById('modal-edit-unit');
    const hiddenOld = document.getElementById('edit-unit-modal-old-name-hidden');
    const inputName = document.getElementById('edit-unit-modal-name-input');
    if (!modal || !inputName) return;

    if (hiddenOld) hiddenOld.value = unitName;
    inputName.value = unitName;

    modal.classList.remove('d-none');
    setTimeout(() => {
        inputName.focus();
        inputName.select();
    }, 60);
}

function closeEditUnitModal() {
    const modal = document.getElementById('modal-edit-unit');
    if (modal) modal.classList.add('d-none');
}

async function handleConfirmEditUnit() {
    const hiddenOld = document.getElementById('edit-unit-modal-old-name-hidden');
    const inputName = document.getElementById('edit-unit-modal-name-input');
    if (!hiddenOld || !inputName) return;

    const oldName = hiddenOld.value.trim();
    const newName = inputName.value.trim();

    if (!newName) {
        showToast('El nombre de la unidad no puede estar vacío', 'error');
        return;
    }

    closeEditUnitModal();
    try {
        const res = await fetch('/api/stock/taxonomies/unit', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ old_name: oldName, new_name: newName })
        });
        const result = await res.json();
        if (res.ok && result.success) {
            showToast(`✅ Unidad "${newName}" actualizada`, 'success');
            await fetchStockTaxonomies();
            await fetchStockItems();
        } else {
            showToast(result.error || 'Error al actualizar unidad', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Error de conexión', 'error');
    }
}

let pendingDeleteTaxonomyCallback = null;
function showConfirmDeleteTaxonomyModal({ title, message, warningText, onConfirm }) {
    const modal = document.getElementById('modal-confirm-delete-taxonomy');
    const titleEl = document.getElementById('delete-tax-modal-title');
    const messageEl = document.getElementById('delete-tax-modal-message');
    const warningEl = document.getElementById('delete-tax-modal-warning');
    const warningTextEl = document.getElementById('delete-tax-modal-warning-text');
    if (!modal) return;

    if (titleEl) titleEl.textContent = title || 'Confirmar Eliminación';
    if (messageEl) messageEl.innerHTML = message || '¿Estás seguro de que deseas eliminar este elemento?';

    if (warningText) {
        if (warningTextEl) warningTextEl.textContent = warningText;
        warningEl?.classList.remove('d-none');
    } else {
        warningEl?.classList.add('d-none');
    }

    pendingDeleteTaxonomyCallback = onConfirm;
    modal.classList.remove('d-none');
}

function closeConfirmDeleteTaxonomyModal() {
    const modal = document.getElementById('modal-confirm-delete-taxonomy');
    if (modal) modal.classList.add('d-none');
    pendingDeleteTaxonomyCallback = null;
}

// --- AUTOCOMPLETE ESTILIZADO DE CATEGORÍAS Y U/M (SIN FAMILIAS) ---
function initStockFormCustomDropdowns() {
    const inputCat = document.getElementById('stock-category');
    const dropCat = document.getElementById('stock-category-dropdown');
    const btnClearCat = document.getElementById('btn-clear-category');

    const inputUnit = document.getElementById('stock-unit');
    const dropUnit = document.getElementById('stock-unit-dropdown');
    const btnClearUnit = document.getElementById('btn-clear-unit');

    const setupDropdown = (input, dropdown, btnClear, getItemsFunc) => {
        if (!input || !dropdown) return;

        const updateClearBtnVisibility = () => {
            if (!btnClear) return;
            if (input.value && input.value.trim() !== '') {
                btnClear.classList.remove('d-none');
            } else {
                btnClear.classList.add('d-none');
            }
        };

        if (btnClear) {
            btnClear.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                input.value = '';
                updateClearBtnVisibility();
                input.focus();
                renderItems('');
                dropdown.classList.add('show');
            });
        }

        const renderItems = (filterText = '') => {
            updateClearBtnVisibility();
            const items = getItemsFunc();
            const normFilter = normalizeText(filterText);

            const filtered = normFilter
                ? items.filter(it => normalizeText(it.name || it).includes(normFilter))
                : items;

            dropdown.replaceChildren();

            if (filtered.length === 0) {
                const noResult = document.createElement('div');
                noResult.className = 'p-2 text-muted small text-center';
                noResult.textContent = 'Sin coincidencias. Puedes ingresar tu propio valor.';
                dropdown.appendChild(noResult);
                return;
            }

            filtered.forEach(it => {
                const name = typeof it === 'string' ? it : it.name;
                const icon = it.icon || '📦';

                const div = document.createElement('div');
                div.className = 'stock-dropdown-item';
                div.innerHTML = `
                    <div class="d-flex align-items-center gap-2 text-truncate">
                        <span>${icon}</span>
                        <span class="text-truncate">${escapeHtml(name)}</span>
                    </div>
                `;

                div.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    input.value = name;
                    updateClearBtnVisibility();
                    dropdown.classList.remove('show');
                    // Disparar input event para calcular margen si aplica
                    input.dispatchEvent(new Event('input'));
                });

                dropdown.appendChild(div);
            });
        };

        input.addEventListener('focus', () => {
            renderItems(input.value);
            dropdown.classList.add('show');
        });

        input.addEventListener('input', () => {
            renderItems(input.value);
            dropdown.classList.add('show');
        });

        input.addEventListener('blur', () => {
            setTimeout(() => dropdown.classList.remove('show'), 160);
        });

        updateClearBtnVisibility();
    };

    setupDropdown(inputCat, dropCat, btnClearCat, () => {
        const defaultCats = [
            { name: "Insumos BIA", icon: "🩺" },
            { name: "Suplementos Nutricionales", icon: "💊" },
            { name: "Material Clínico e Higiene", icon: "🧼" },
            { name: "Accesorios y Equipos", icon: "📦" },
            { name: "Medicamentos / Fármacos", icon: "💉" },
            { name: "Material de Oficina", icon: "📝" },
            { name: "Otros", icon: "🏷️" }
        ];
        const knownCats = new Map(defaultCats.map(c => [c.name.toLowerCase(), c]));

        if (stockTaxonomiesData?.categories) {
            stockTaxonomiesData.categories.forEach(c => {
                knownCats.set(c.name.toLowerCase(), { name: c.name, icon: c.icon || "📦" });
            });
        }
        if (Array.isArray(allStockItems)) {
            allStockItems.forEach(i => {
                if (i.category && !knownCats.has(i.category.toLowerCase())) {
                    knownCats.set(i.category.toLowerCase(), { name: i.category, icon: "📦" });
                }
            });
        }
        return Array.from(knownCats.values());
    });

    setupDropdown(inputUnit, dropUnit, btnClearUnit, () => {
        const defaultUnits = [
            { name: "Unidad (u)", icon: "📏" },
            { name: "Frasco / Bote", icon: "🧴" },
            { name: "Caja", icon: "📦" },
            { name: "Pack", icon: "🛍️" },
            { name: "Cápsulas", icon: "💊" },
            { name: "Tabletas", icon: "💊" },
            { name: "Sobres", icon: "✉️" },
            { name: "Ampollas", icon: "💉" },
            { name: "Tubo", icon: "🧪" },
            { name: "Gotero", icon: "💧" },
            { name: "Mililitros (ml)", icon: "🧪" },
            { name: "Litros (L)", icon: "🧃" },
            { name: "Gramos (g)", icon: "⚖️" },
            { name: "Kilogramos (kg)", icon: "⚖️" }
        ];
        const knownUnits = new Map(defaultUnits.map(u => [u.name.toLowerCase(), u]));

        if (stockTaxonomiesData?.units) {
            stockTaxonomiesData.units.forEach(u => {
                if (u.name && !knownUnits.has(u.name.toLowerCase())) {
                    knownUnits.set(u.name.toLowerCase(), { name: u.name, icon: "📏" });
                }
            });
        }
        if (Array.isArray(allStockItems)) {
            allStockItems.forEach(i => {
                if (i.unit && !knownUnits.has(i.unit.toLowerCase())) {
                    knownUnits.set(i.unit.toLowerCase(), { name: i.unit, icon: "📏" });
                }
            });
        }
        return Array.from(knownUnits.values());
    });
}

