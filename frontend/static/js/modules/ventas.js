// ============================================================
// VITAMETRIX - MÓDULO 09: TERMINAL DE VENTAS (POS) Y RECIBOS DIGITALES
// Archivo: frontend/static/js/modules/ventas.js
// ============================================================

let currentCart = [];
let salesHistoryData = [];

function initPOS() {
    fetchSalesHistory();
}

async function fetchSalesHistory() {
    try {
        const res = await fetch('/api/sales', { headers: getAuthHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        salesHistoryData = Array.isArray(data) ? data : (data.sales || []);
    } catch (e) {
        console.warn('Error al cargar ventas:', e);
    }
}
