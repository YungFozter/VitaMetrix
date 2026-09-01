// ============================================================
// VITAMETRIX - MÓDULO 01: AUTENTICACIÓN Y GESTIÓN DE SESIONES
// Archivo: frontend/static/js/modules/auth.js
// ============================================================

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

    const dropProfileText = document.getElementById('dropdown-profile-text');
    const dropProfileIcon = document.getElementById('dropdown-profile-icon');
    if (dropProfileText) {
        dropProfileText.textContent = isAdmin ? '👑 Mi Perfil SuperAdmin' : 'Mi Perfil Clínico';
    }
    if (dropProfileIcon) {
        dropProfileIcon.className = isAdmin ? 'bi bi-shield-check text-warning fs-6' : 'bi bi-person-badge text-primary fs-6';
    }

    if (typeof updateUserProfileUI === 'function') updateUserProfileUI();
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

                if (typeof navigateToView === 'function') navigateToView('dashboard-view', true);

                clientsDataLoaded = false;
                evalsDataLoaded = false;
                stockDataLoaded = false;
                if (typeof allEvaluationsData !== 'undefined') allEvaluationsData = [];
                if (typeof allClientsData !== 'undefined') allClientsData = [];

                if (data.user.role === 'admin') {
                    if (typeof fetchAdminUsers === 'function') fetchAdminUsers(false);
                } else {
                    if (localStorage.getItem('vita_active_view') === 'superadmin-view') {
                        localStorage.setItem('vita_active_view', 'dashboard-view');
                    }
                }

                if (typeof fetchClients === 'function') fetchClients();
                if (typeof fetchEvaluaciones === 'function') fetchEvaluaciones();
                if (typeof fetchStockItems === 'function') fetchStockItems();
                if (typeof fetchDashboardStats === 'function') fetchDashboardStats();
                if (typeof fetchSubscriptionStatus === 'function') fetchSubscriptionStatus();
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

    let regErrorTimer = null;
    function hideRegisterError() {
        if (regError) {
            regError.classList.add('d-none');
            regError.classList.remove('d-flex');
        }
        if (regErrorTimer) {
            clearTimeout(regErrorTimer);
            regErrorTimer = null;
        }
    }

    function showRegisterError(msg) {
        if (!regError) return;
        const textEl = document.getElementById('register-error-text');
        if (textEl) {
            textEl.textContent = msg;
        } else {
            regError.textContent = msg;
        }
        regError.classList.remove('d-none');
        regError.classList.add('d-flex');

        if (regErrorTimer) clearTimeout(regErrorTimer);
        regErrorTimer = setTimeout(() => {
            hideRegisterError();
        }, 5000);
    }

    const btnCloseRegAlert = document.getElementById('btn-close-register-alert');
    if (btnCloseRegAlert) {
        btnCloseRegAlert.addEventListener('click', () => {
            hideRegisterError();
        });
    }

    if (formRegister) {
        formRegister.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fullName = document.getElementById('reg-full-name').value.trim();
            const email = document.getElementById('reg-email').value.trim();
            const password = document.getElementById('reg-password').value;
            const title = document.getElementById('reg-title').value.trim();
            const clinic = document.getElementById('reg-clinic').value.trim();
            const btnSubmit = document.getElementById('btn-submit-register');

            hideRegisterError();
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
                    showRegisterError(data.error || 'Error al registrar cuenta');
                    return;
                }

                formRegister.reset();
                showLoginTab();

                const loginEmailInput = document.getElementById('login-email');
                if (loginEmailInput) loginEmailInput.value = email;
                const loginPassInput = document.getElementById('login-password');
                if (loginPassInput) {
                    loginPassInput.value = '';
                    loginPassInput.focus();
                }

                showToast('🎉 ¡Cuenta creada con éxito! Ingresa tu contraseña para iniciar sesión.', 'success');
            } catch (err) {
                showRegisterError('Error de conexión al registrar.');
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
                    if (typeof allEvaluationsData !== 'undefined') allEvaluationsData = [];
                    if (typeof allClientsData !== 'undefined') allClientsData = [];
                    if (typeof filterAndRenderEvaluaciones === 'function') filterAndRenderEvaluaciones();
                    if (typeof renderClientsTable === 'function') renderClientsTable();
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

    fetchAuthMe();
}

async function fetchAuthMe() {
    const token = localStorage.getItem('vm_auth_token') || sessionStorage.getItem('vm_auth_token');

    if (!token) {
        showAuthModal(true);
        return;
    }

    try {
        const res = await fetch('/api/auth/me', { headers: getAuthHeaders() });
        if (res.ok) {
            const data = await res.json();
            const userObj = data.user || (data.id ? data : null);
            if (userObj && data.success !== false) {
                updateUIWithUserData(userObj);
                hideAuthModal();

                const activeView = localStorage.getItem('vita_active_view') || window.location.hash.replace(/^#/, '');
                if (userObj.role !== 'admin' && (activeView === 'superadmin-view' || window.location.hash === '#superadmin-view')) {
                    localStorage.setItem('vita_active_view', 'dashboard-view');
                    if (typeof navigateToView === 'function') navigateToView('dashboard-view', true);
                }
                return;
            }
        }

        if (res.status === 401) {
            localStorage.removeItem('vm_auth_token');
            sessionStorage.removeItem('vm_auth_token');
            showAuthModal(true);
        }
    } catch (e) {
        console.warn('Error de red al verificar sesión en despliegue:', e);
    }
}
