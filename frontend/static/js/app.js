// ============================================================
// VITAMETRIX - CLIENTE PRINCIPAL JAVASCRIPT (Orquestador Inicializador)
// Archivo: frontend/static/js/app.js
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. Inicialización de utilidades, reloj y barra lateral
    if (typeof initDemoDataInjector === 'function') initDemoDataInjector();
    if (typeof initFieldInfoPopups === 'function') initFieldInfoPopups();
    if (typeof initMobileSidebar === 'function') initMobileSidebar();
    if (typeof initClock === 'function') initClock();

    // 2. Inicialización de enrutador SPA y navegación
    if (typeof initNavigation === 'function') initNavigation();

    // 3. Inicialización del sistema de autenticación y sesiones
    if (typeof initAuthSystem === 'function') initAuthSystem();

    // 4. Inicialización de módulos clínicos y de negocio
    if (typeof initDashboard === 'function') initDashboard();
    if (typeof initSubscriptionView === 'function') initSubscriptionView();
    if (typeof initSuperAdminView === 'function') initSuperAdminView();
    if (typeof initBioForm === 'function') initBioForm();
    if (typeof initBioClientAutocomplete === 'function') initBioClientAutocomplete();
    if (typeof initClients === 'function') initClients();
    if (typeof initPatientMessaging === 'function') initPatientMessaging();
    if (typeof initPatientHistoryModal === 'function') initPatientHistoryModal();
    if (typeof initEvaluaciones === 'function') initEvaluaciones();
    if (typeof initProfileDropdown === 'function') initProfileDropdown();
    if (typeof initSystemMenuListeners === 'function') initSystemMenuListeners();
    if (typeof initAppointmentsCalendar === 'function') initAppointmentsCalendar();
    if (typeof initConfiguracionView === 'function') initConfiguracionView();
    if (typeof initStockModule === 'function') initStockModule();
    if (typeof initPOS === 'function') initPOS();

    // 5. Carga diferida en segundo plano para optimizar rendimiento del hilo principal
    const scheduleIdleTasks = () => {
        const activeView = localStorage.getItem('vita_active_view') || 'dashboard-view';
        if (activeView !== 'dashboard-view' && typeof fetchDashboardStats === 'function') fetchDashboardStats();
        if (typeof clientsDataLoaded !== 'undefined' && !clientsDataLoaded && activeView !== 'clientes-view' && typeof fetchClients === 'function') fetchClients();
        if (typeof evalsDataLoaded !== 'undefined' && !evalsDataLoaded && activeView !== 'evaluaciones-view' && typeof fetchEvaluaciones === 'function') fetchEvaluaciones();
        if (typeof stockDataLoaded !== 'undefined' && !stockDataLoaded && activeView !== 'stock-view') {
            if (typeof fetchStockItems === 'function') fetchStockItems();
            if (typeof fetchStockTaxonomies === 'function') fetchStockTaxonomies();
        }
    };

    if ('requestIdleCallback' in window) {
        requestIdleCallback(scheduleIdleTasks, { timeout: 1600 });
    } else {
        setTimeout(scheduleIdleTasks, 1000);
    }
});
