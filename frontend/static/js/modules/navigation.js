// ============================================================
// VITAMETRIX - MÓDULO 04: ENRUTADOR SPA, PESTAÑAS Y CONTROLES DE MENÚ
// Archivo: frontend/static/js/modules/navigation.js
// ============================================================

function navigateToView(targetId, updateHistory = true) {
    if (!targetId) return;

    let cleanId = targetId.replace(/^#/, '').trim();

    const userRole = currentAuthUser?.role || (typeof currentAuthUser !== 'undefined' && currentAuthUser ? currentAuthUser.role : null);
    if (cleanId === 'superadmin-view' && userRole !== 'admin') {
        cleanId = 'dashboard-view';
    }

    const targetView = document.getElementById(cleanId);
    if (!targetView || !targetView.classList.contains('view')) return;

    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view');
    const pageTitle = document.getElementById('page-title');

    navItems.forEach(nav => nav.classList.remove('active'));
    views.forEach(view => {
        view.classList.remove('active-view');
        view.classList.add('hidden-view');
    });

    targetView.classList.remove('hidden-view');
    targetView.classList.add('active-view');

    const activeNav = document.querySelector(`.nav-item[data-target="${cleanId}"]`) ||
                      document.querySelector(`.nav-item[href="#${cleanId}"]`);
    if (activeNav) {
        activeNav.classList.add('active');
        if (pageTitle) {
            pageTitle.textContent = activeNav.getAttribute('data-title') || 'Dashboard';
        }
    }

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

    if (cleanId === 'dashboard-view') {
        if (typeof fetchDashboardStats === 'function') fetchDashboardStats();
    } else if (cleanId === 'clientes-view') {
        if ((!clientsDataLoaded || (typeof allClientsData !== 'undefined' && allClientsData.length === 0)) && typeof fetchClients === 'function') fetchClients();
    } else if (cleanId === 'evaluaciones-view') {
        if (typeof fetchEvaluaciones === 'function') fetchEvaluaciones(true);
    } else if (cleanId === 'stock-view') {
        if ((!stockDataLoaded || (typeof allStockItems !== 'undefined' && allStockItems.length === 0))) {
            if (typeof fetchStockItems === 'function') fetchStockItems();
            if (typeof fetchStockTaxonomies === 'function') fetchStockTaxonomies();
        }
    } else if (cleanId === 'configuracion-view') {
        if (typeof window.loadAllSettings === 'function') window.loadAllSettings();
        setTimeout(() => {
            if (typeof initClinicMap === 'function') initClinicMap();
        }, 120);
    } else if (cleanId === 'subscription-view') {
        if (typeof fetchSubscriptionStatus === 'function') fetchSubscriptionStatus();
    } else if (cleanId === 'superadmin-view') {
        const savedTab = localStorage.getItem('vm_admin_active_tab') || 'users';
        if (typeof switchAdminTab === 'function') switchAdminTab(savedTab);
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

    window.addEventListener('popstate', () => {
        const hashId = (window.location.hash || '').replace(/^#/, '').trim();
        if (hashId && document.getElementById(hashId) && document.getElementById(hashId).classList.contains('view')) {
            navigateToView(hashId, false);
        }
    });

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

function initMobileSidebar() {
    const toggleBtn = document.getElementById('sidebar-toggle-btn') || document.getElementById('mobile-menu-btn');
    const closeBtn = document.getElementById('sidebar-close-btn');
    const appLayout = document.querySelector('.app-layout');
    const sidebar = document.querySelector('.sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    const navItems = document.querySelectorAll('.sidebar .nav-item');

    if (!sidebar) return;

    const savedCollapsed = localStorage.getItem('sidebar_collapsed');
    if (savedCollapsed === 'true' && window.innerWidth > 992 && appLayout) {
        appLayout.classList.add('sidebar-collapsed');
    }

    const toggleSidebar = () => {
        if (window.innerWidth <= 992) {
            const isOpen = sidebar.classList.contains('mobile-open');
            if (isOpen) {
                closeMobileDrawer();
            } else {
                openMobileDrawer();
            }
        } else {
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

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            if (window.innerWidth <= 992) {
                closeMobileDrawer();
            }
        });
    });

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

    if (goBtn) {
        goBtn.addEventListener('click', () => {
            const reqLabel = reqEl ? reqEl.textContent : 'el dato';
            const targetId = currentTargetInputId;
            closeModal();

            const bioNav = document.querySelector('[data-target="bio-view"]');
            if (bioNav) bioNav.click();

            const details = document.querySelector('details.device-data');
            if (details) details.open = true;

            const formSection = document.querySelector('.bio-form-horizontal') || document.querySelector('.bio-form-panel');
            if (formSection) {
                formSection.classList.remove('form-focus-pulse');
                void formSection.offsetWidth;
                formSection.classList.add('form-focus-pulse');
            }

            const mainContent = document.querySelector('.main-content');
            if (mainContent) {
                mainContent.scrollTo({ top: 0, behavior: 'smooth' });
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });

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
