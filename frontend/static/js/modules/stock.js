/* ============================================================================
   VITAMETRIX - MÓDULO DE CONTROL DE INVENTARIO Y STOCK (stock.js)
   ============================================================================ */

let allStockItems = [];
let stockFilteredItems = [];
let stockCurrentPage = 1;
let stockPageSize = 15;
let stockSelectedIds = new Set();
let stockTaxonomiesData = { categories: [], units: [] };

function formatCleanExpiryDate(rawDate) {
    if (!rawDate) return '';
    let str = String(rawDate).trim();
    if (str.includes(' ')) str = str.split(' ')[0];
    if (str.includes('T')) str = str.split('T')[0];
    if (str.toLowerCase() in { 'none': 1, 'null': 1, 'nan': 1, '--': 1, '': 1 }) return '';
    return str;
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
        if (typeof renderPosProductGrid === 'function') renderPosProductGrid();
    } catch (err) {
        console.error('Error al cargar inventario:', err);
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-danger">Error al cargar inventario. Reintenta en unos instantes.</td></tr>';
    }
}

async function fetchStockTaxonomies() {
    try {
        const res = await fetch('/api/stock/taxonomies', { headers: getAuthHeaders() });
        if (!res.ok) return;
        stockTaxonomiesData = await res.json();
        updateStockTaxonomyDropdowns();
        renderTaxonomyModalLists();
    } catch (err) {
        console.error('Error al cargar taxonomías:', err);
    }
}

function updateStockTaxonomyDropdowns() {
    const catSelect = document.getElementById('stock-category');
    const unitSelect = document.getElementById('stock-unit');

    if (catSelect && stockTaxonomiesData.categories) {
        const currentVal = catSelect.value;
        catSelect.innerHTML = '<option value="" disabled selected>Selecciona categoría...</option>';
        stockTaxonomiesData.categories.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.name;
            opt.textContent = `${c.icon || '🏷️'} ${c.name}`;
            catSelect.appendChild(opt);
        });
        if (currentVal && Array.from(catSelect.options).some(o => o.value === currentVal)) {
            catSelect.value = currentVal;
        }
    }

    if (unitSelect && stockTaxonomiesData.units) {
        const currentVal = unitSelect.value;
        unitSelect.innerHTML = '<option value="" disabled selected>Selecciona unidad...</option>';
        stockTaxonomiesData.units.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.name;
            opt.textContent = u.name;
            unitSelect.appendChild(opt);
        });
        if (currentVal && Array.from(unitSelect.options).some(o => o.value === currentVal)) {
            unitSelect.value = currentVal;
        }
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

    const catalogList = document.getElementById('stock-filter-category-list');
    const catalogLabel = document.getElementById('stock-filter-category-label');

    if (catalogList) {
        let html = `
            <li>
                <a class="dropdown-item stock-cat-option active" href="#" data-value="all">
                    <span class="stock-cat-icon">📁</span>
                    <span class="stock-cat-name">Todas las Categorías</span>
                    <span class="stock-cat-count">${counts.all}</span>
                </a>
            </li>
            <li><hr class="dropdown-divider my-1"></li>
        `;

        uniqueCats.forEach(cat => {
            if (cat === 'all') return;
            const count = counts[cat] || 0;
            let icon = '🏷️';
            if (cat.includes('BIA')) icon = '🩺';
            else if (cat.includes('Suplementos')) icon = '💊';
            else if (cat.includes('Material') || cat.includes('Higiene')) icon = '🧼';
            else if (cat.includes('Medicamentos') || cat.includes('Fármacos')) icon = '💉';
            else if (cat.includes('Accesorios') || cat.includes('Equipos')) icon = '📦';
            else if (cat.includes('Oficina')) icon = '📝';

            html += `
                <li>
                    <a class="dropdown-item stock-cat-option" href="#" data-value="${cat}">
                        <span class="stock-cat-icon">${icon}</span>
                        <span class="stock-cat-name">${cat}</span>
                        <span class="stock-cat-count">${count}</span>
                    </a>
                </li>
            `;
        });

        catalogList.innerHTML = html;
    }
}

function updateStockKPIs(items) {
    if (!Array.isArray(items)) return;

    let totalValuation = 0;
    let totalItems = items.length;
    let lowStockCount = 0;
    let outStockCount = 0;
    let optimalCount = 0;

    items.forEach(item => {
        const qty = parseFloat(item.stock_quantity) || 0;
        const min = parseFloat(item.min_stock) || 5;
        const cost = parseFloat(item.cost_price) || 0;

        totalValuation += (qty * cost);

        if (qty <= 0) {
            outStockCount++;
        } else if (qty <= min) {
            lowStockCount++;
        } else {
            optimalCount++;
        }
    });

    const kpiValuation = document.getElementById('stock-kpi-valuation');
    const kpiTotal = document.getElementById('stock-kpi-total');
    const kpiLow = document.getElementById('stock-kpi-low');
    const kpiOut = document.getElementById('stock-kpi-out');
    const kpiOptimal = document.getElementById('stock-kpi-optimal');

    if (kpiValuation) kpiValuation.textContent = `Bs. ${totalValuation.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (kpiTotal) kpiTotal.textContent = totalItems;
    if (kpiLow) kpiLow.textContent = lowStockCount;
    if (kpiOut) kpiOut.textContent = outStockCount;
    if (kpiOptimal) kpiOptimal.textContent = optimalCount;
}

function filterAndRenderStock(resetPage = true) {
    const tbody = document.getElementById('stock-tbody');
    if (!tbody || !Array.isArray(allStockItems)) return;

    const search = (document.getElementById('stock-search-input')?.value || '').toLowerCase().trim();
    const cat = document.getElementById('stock-filter-category')?.value || 'all';
    const status = document.getElementById('stock-filter-status')?.value || 'all';

    stockFilteredItems = allStockItems.filter(item => {
        const normName = (item.name || '').toLowerCase();
        const normCode = (item.code || '').toLowerCase();
        const normLoc = (item.location || '').toLowerCase();
        const normSupp = (item.supplier || '').toLowerCase();
        const normBatch = (item.batch_number || '').toLowerCase();

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
    const bulkBar = document.getElementById('stock-bulk-actions-bar');
    const selectedCountEl = document.getElementById('stock-selected-count');
    const selectAllChk = document.getElementById('stock-select-all');
    if (!tbody) return;

    const total = stockFilteredItems.length;

    if (bulkBar && selectedCountEl) {
        if (stockSelectedIds.size > 0) {
            bulkBar.classList.remove('d-none');
            selectedCountEl.textContent = stockSelectedIds.size;
        } else {
            bulkBar.classList.add('d-none');
        }
    }

    if (total === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-5 text-muted">
                    <div class="py-3">
                        <i class="bi bi-box-seam fs-1 text-secondary opacity-50 mb-2 d-block"></i>
                        <h6 class="fw-bold text-navy mb-1">No se encontraron insumos</h6>
                        <p class="small mb-0" style="font-size: 0.8rem;">Intenta cambiar los filtros de búsqueda o agrega un nuevo producto al catálogo.</p>
                    </div>
                </td>
            </tr>
        `;
        renderStockPagination(0, 1, stockPageSize);
        if (selectAllChk) selectAllChk.checked = false;
        return;
    }

    const totalPages = Math.ceil(total / stockPageSize);
    if (stockCurrentPage > totalPages) stockCurrentPage = totalPages;
    if (stockCurrentPage < 1) stockCurrentPage = 1;

    const startIdx = (stockCurrentPage - 1) * stockPageSize;
    const endIdx = Math.min(startIdx + stockPageSize, total);
    const pageItems = stockFilteredItems.slice(startIdx, endIdx);

    if (selectAllChk) {
        const allPageSelected = pageItems.length > 0 && pageItems.every(i => stockSelectedIds.has(i.id));
        selectAllChk.checked = allPageSelected;
    }

    let html = '';
    pageItems.forEach(item => {
        const isChecked = stockSelectedIds.has(item.id);
        const qty = parseFloat(item.stock_quantity) || 0;
        const min = parseFloat(item.min_stock) || 5;
        const cost = parseFloat(item.cost_price) || 0;
        const sale = parseFloat(item.sale_price) || 0;

        let statusBadge = '';
        if (qty <= 0) {
            statusBadge = '<span class="badge bg-danger-subtle text-danger border border-danger-subtle fw-semibold px-2.5 py-1 rounded-pill"><i class="bi bi-x-circle me-1"></i> Agotado</span>';
        } else if (qty <= min) {
            statusBadge = '<span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle fw-semibold px-2.5 py-1 rounded-pill"><i class="bi bi-exclamation-triangle me-1"></i> Stock Bajo</span>';
        } else {
            statusBadge = '<span class="badge bg-success-subtle text-success border border-success-subtle fw-semibold px-2.5 py-1 rounded-pill"><i class="bi bi-check-circle me-1"></i> Óptimo</span>';
        }

        const cleanExpiry = formatCleanExpiryDate(item.expiry_date);
        let batchExpiryInfo = '';
        if (item.batch_number || cleanExpiry) {
            batchExpiryInfo = `<div class="small text-muted" style="font-size: 0.73rem;">
                ${item.batch_number ? `<span class="me-1 font-monospace">Lot: ${item.batch_number}</span>` : ''}
                ${cleanExpiry ? `<span>📅 ${cleanExpiry}</span>` : ''}
            </div>`;
        }

        html += `
            <tr class="${isChecked ? 'table-primary bg-opacity-10' : ''}">
                <td class="ps-3">
                    <input type="checkbox" class="form-check-input stock-item-chk shadow-none cursor-pointer" data-id="${item.id}" ${isChecked ? 'checked' : ''}>
                </td>
                <td>
                    <div class="fw-bold text-navy">${item.name}</div>
                    <div class="d-flex align-items-center gap-2 mt-0.5">
                        <span class="badge bg-light text-secondary border font-monospace" style="font-size: 0.72rem;">${item.code || 'SKU-000'}</span>
                        ${item.location ? `<span class="text-muted small" style="font-size: 0.72rem;"><i class="bi bi-geo-alt me-0.5"></i> ${item.location}</span>` : ''}
                    </div>
                    ${batchExpiryInfo}
                </td>
                <td>
                    <span class="badge bg-light text-navy border fw-medium px-2 py-1">${item.category || 'Sin Categoría'}</span>
                </td>
                <td class="text-center font-monospace fw-bold">
                    <span class="fs-6 ${qty <= min ? 'text-danger' : 'text-navy'}">${qty}</span>
                    <small class="text-muted fw-normal d-block" style="font-size: 0.72rem;">${item.unit || 'u'}</small>
                </td>
                <td class="text-end font-monospace">
                    <div>Cost: <span class="fw-semibold">Bs. ${cost.toFixed(2)}</span></div>
                    <div class="text-muted small">PVP: <span class="fw-semibold text-success">Bs. ${sale.toFixed(2)}</span></div>
                </td>
                <td class="text-center">
                    ${statusBadge}
                </td>
                <td class="text-end pe-3">
                    <div class="d-inline-flex gap-1">
                        <button type="button" class="btn btn-sm btn-outline-primary btn-icon shadow-2xs" onclick="openQuickAdjustModal('${item.id}')" title="Ajuste Rápido (+/-)">
                            <i class="bi bi-arrow-left-right"></i>
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-secondary btn-icon shadow-2xs" onclick="openEditStockModal('${item.id}')" title="Editar Producto">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-danger btn-icon shadow-2xs" onclick="deleteStockItem('${item.id}')" title="Eliminar">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
    renderStockPagination(total, stockCurrentPage, stockPageSize);

    // Event Listeners Checkboxes individuales
    tbody.querySelectorAll('.stock-item-chk').forEach(chk => {
        chk.addEventListener('change', (e) => {
            const id = e.target.dataset.id;
            if (e.target.checked) {
                stockSelectedIds.add(id);
            } else {
                stockSelectedIds.delete(id);
            }
            renderStockTable();
        });
    });
}

function renderStockPagination(total, page, pageSize) {
    const pagContainer = document.getElementById('stock-pagination');
    if (!pagContainer) return;

    if (total === 0) {
        pagContainer.innerHTML = '';
        return;
    }

    const totalPages = Math.ceil(total / pageSize);
    const startItem = (page - 1) * pageSize + 1;
    const endItem = Math.min(page * pageSize, total);

    let html = `
        <div class="d-flex flex-column flex-sm-row align-items-center justify-content-between gap-2 w-100 px-3 py-2 bg-light border-top rounded-bottom-4">
            <small class="text-muted">Mostrando <strong>${startItem}-${endItem}</strong> de <strong>${total}</strong> insumos</small>
            <ul class="pagination pagination-sm mb-0">
                <li class="page-item ${page === 1 ? 'disabled' : ''}">
                    <a class="page-link shadow-none" href="#" onclick="changeStockPage(${page - 1}); return false;"><i class="bi bi-chevron-left"></i></a>
                </li>
    `;

    for (let p = 1; p <= totalPages; p++) {
        if (p === 1 || p === totalPages || (p >= page - 1 && p <= page + 1)) {
            html += `<li class="page-item ${p === page ? 'active' : ''}"><a class="page-link shadow-none" href="#" onclick="changeStockPage(${p}); return false;">${p}</a></li>`;
        } else if (p === page - 2 || p === page + 2) {
            html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
        }
    }

    html += `
                <li class="page-item ${page === totalPages ? 'disabled' : ''}">
                    <a class="page-link shadow-none" href="#" onclick="changeStockPage(${page + 1}); return false;"><i class="bi bi-chevron-right"></i></a>
                </li>
            </ul>
        </div>
    `;

    pagContainer.innerHTML = html;
}

function changeStockPage(newPage) {
    stockCurrentPage = newPage;
    renderStockTable();
}

function renderTaxonomyModalLists() {
    const catList = document.getElementById('stock-tax-cat-list');
    const unitList = document.getElementById('stock-tax-unit-list');

    if (catList && stockTaxonomiesData.categories) {
        catList.innerHTML = stockTaxonomiesData.categories.map(c => `
            <div class="d-flex align-items-center justify-content-between p-2.5 bg-white border rounded-3 hover-shadow transition-all">
                <div class="d-flex align-items-center gap-2">
                    <span class="fs-5">${c.icon || '🏷️'}</span>
                    <span class="fw-semibold text-navy small">${c.name}</span>
                </div>
                <button type="button" class="btn btn-sm btn-light border text-danger" onclick="deleteTaxonomyItem('category', '${c.name}')">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `).join('');
    }

    if (unitList && stockTaxonomiesData.units) {
        unitList.innerHTML = stockTaxonomiesData.units.map(u => `
            <div class="d-flex align-items-center justify-content-between p-2.5 bg-white border rounded-3 hover-shadow transition-all">
                <span class="fw-semibold text-navy small">${u.name}</span>
                <button type="button" class="btn btn-sm btn-light border text-danger" onclick="deleteTaxonomyItem('unit', '${u.name}')">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `).join('');
    }
}

// ============================================================================
// NAVEGACIÓN ENTRE SUB-MÓDULOS DE STOCK (CATÁLOGO, POS, VENTAS, KARDEX)
// ============================================================================

let stockMovementsData = [];

function initStockNavigationTabs() {
    const tabBtns = document.querySelectorAll('.stock-main-tab-btn');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const targetPanelId = btn.getAttribute('data-panel');
            if (targetPanelId) {
                switchStockTab(targetPanelId);
            }
        });
    });

    const kardexSearch = document.getElementById('kardex-search-input');
    const kardexFilter = document.getElementById('kardex-filter-type');
    const kardexRefreshBtn = document.getElementById('btn-refresh-kardex');

    if (kardexSearch) kardexSearch.addEventListener('input', () => renderKardexTable());
    if (kardexFilter) kardexFilter.addEventListener('change', () => renderKardexTable());
    if (kardexRefreshBtn) kardexRefreshBtn.addEventListener('click', () => fetchStockMovements(true));

    const savedTab = localStorage.getItem('vm_active_stock_tab') || 'stock-panel-catalog';
    switchStockTab(savedTab);
}

function switchStockTab(targetPanelId) {
    if (!targetPanelId) return;

    const tabBtns = document.querySelectorAll('.stock-main-tab-btn');
    const panels = document.querySelectorAll('.stock-panel-content');

    tabBtns.forEach(btn => {
        if (btn.getAttribute('data-panel') === targetPanelId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    panels.forEach(panel => {
        if (panel.id === targetPanelId) {
            panel.classList.remove('d-none');
        } else {
            panel.classList.add('d-none');
        }
    });

    try {
        localStorage.setItem('vm_active_stock_tab', targetPanelId);
    } catch (e) {}

    // Carga reactiva según la pestaña elegida
    if (targetPanelId === 'stock-panel-catalog') {
        filterAndRenderStock(false);
    } else if (targetPanelId === 'stock-panel-pos') {
        if (typeof renderPosProductGrid === 'function') renderPosProductGrid();
    } else if (targetPanelId === 'stock-panel-sales') {
        if (typeof fetchSalesHistory === 'function') fetchSalesHistory(true);
        if (typeof fetchSalesKPIs === 'function') fetchSalesKPIs();
    } else if (targetPanelId === 'stock-panel-kardex') {
        fetchStockMovements();
    }
}

async function fetchStockMovements(force = false) {
    const tbody = document.getElementById('kardex-tbody');
    if (!tbody) return;

    try {
        const res = await fetch('/api/stock/movements', { headers: getAuthHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        stockMovementsData = Array.isArray(data) ? data : (data.movements || []);
        renderKardexTable();
    } catch (e) {
        console.warn('Error al cargar movimientos de kardex:', e);
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-danger">Error al cargar registros de auditoría Kardex.</td></tr>';
        }
    }
}

function renderKardexTable() {
    const tbody = document.getElementById('kardex-tbody');
    if (!tbody) return;

    const search = (document.getElementById('kardex-search-input')?.value || '').toLowerCase().trim();
    const typeFilter = document.getElementById('kardex-filter-type')?.value || 'all';

    let filtered = [...stockMovementsData];

    if (search) {
        filtered = filtered.filter(m => 
            (m.product_name || m.item_name || '').toLowerCase().includes(search) ||
            (m.reason || '').toLowerCase().includes(search) ||
            (m.reference || m.code || '').toLowerCase().includes(search)
        );
    }

    if (typeFilter !== 'all') {
        filtered = filtered.filter(m => (m.type || '') === typeFilter);
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-5 text-muted">
                    <i class="bi bi-clock-history fs-2 d-block mb-2 text-secondary opacity-50"></i>
                    No se encontraron movimientos registrados en el Kardex.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtered.map(m => {
        const dtStr = (m.created_at || '').substring(0, 16).replace('T', ' ');
        const prodName = escapeHtml(m.product_name || m.item_name || 'Insumo / Producto');
        const mType = m.type || 'IN';
        const qty = parseFloat(m.quantity || 0);
        const prev = parseFloat(m.previous_stock || 0);
        const next = parseFloat(m.new_stock || (prev + (mType === 'IN' ? qty : -qty)));
        const reason = escapeHtml(m.reason || 'Sin observación');

        let typeBadge = '<span class="badge bg-success-subtle text-success border border-success-subtle">📥 Entrada (IN)</span>';
        if (mType === 'OUT') typeBadge = '<span class="badge bg-warning-subtle text-warning border border-warning-subtle">📤 Salida (OUT)</span>';
        else if (mType === 'SALE') typeBadge = '<span class="badge bg-primary-subtle text-primary border border-primary-subtle">🛒 Venta POS</span>';
        else if (mType === 'SALE_CANCEL') typeBadge = '<span class="badge bg-info-subtle text-info border border-info-subtle">↩️ Reversa Venta</span>';
        else if (mType === 'ADJUST') typeBadge = '<span class="badge bg-secondary-subtle text-secondary border">⚡ Ajuste</span>';

        return `
            <tr>
                <td class="small text-muted font-monospace">${dtStr}</td>
                <td class="fw-bold text-navy">${prodName}</td>
                <td>${typeBadge}</td>
                <td class="font-monospace fw-bold ${mType === 'IN' || mType === 'SALE_CANCEL' ? 'text-success' : 'text-danger'}">
                    ${mType === 'IN' || mType === 'SALE_CANCEL' ? '+' : '-'}${qty}
                </td>
                <td class="font-monospace text-muted">${prev}</td>
                <td class="font-monospace fw-bold text-navy">${next}</td>
                <td class="small text-muted text-truncate" style="max-width: 220px;" title="${reason}">${reason}</td>
            </tr>
        `;
    }).join('');
}

// Inicializador del Módulo
function initStockModule() {
    initStockNavigationTabs();

    const searchInput = document.getElementById('stock-search-input');
    const catFilter = document.getElementById('stock-filter-category');
    const statusFilter = document.getElementById('stock-filter-status');

    if (searchInput) searchInput.addEventListener('input', () => filterAndRenderStock());
    if (catFilter) catFilter.addEventListener('change', () => filterAndRenderStock());
    if (statusFilter) statusFilter.addEventListener('change', () => filterAndRenderStock());

    fetchStockItems();
    fetchStockTaxonomies();
}

// Exportación global
window.initStockModule = initStockModule;
window.initStockNavigationTabs = initStockNavigationTabs;
window.switchStockTab = switchStockTab;
window.fetchStockMovements = fetchStockMovements;
window.renderKardexTable = renderKardexTable;

