// ============================================================
// VITAMETRIX - MÓDULO 00: UTILIDADES, TOASTS, DIÁLOGOS Y ESCAPING
// Archivo: frontend/static/js/modules/utils.js
// ============================================================

// --- GUARD CONTRA ERRORES DE EXTENSIONES DEL NAVEGADOR ---
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

// --- BANDERAS GLOBALES DE CARGA DIFERIDA ---
let clientsDataLoaded = false;
let evalsDataLoaded = false;
let stockDataLoaded = false;

// --- SANITIZACIÓN Y ESCAPING HTML ---
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function normalizeText(str) {
    if (!str) return '';
    return String(str)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

// --- NOTIFICACIONES TOAST ---
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// --- DIÁLOGOS DE CONFIRMACIÓN MODAL ---
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

    modal.onclick = (e) => {
        if (e.target === modal) closeModal();
    };

    modal.classList.remove('closing');
    modal.classList.remove('hidden');
}

// --- RELOJ Y MENÚ DE PERFIL EN CABECERA ---
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

function initProfileDropdown() {
    const profileBtn = document.getElementById('user-profile-btn');
    const dropdown = document.getElementById('profile-dropdown');

    if (profileBtn && dropdown) {
        profileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('hidden');
        });

        document.addEventListener('click', (e) => {
            if (!profileBtn.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });
    }
}
