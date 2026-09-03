// ============================================================
// VITAMETRIX - MÓDULO 09: TERMINAL DE VENTAS (POS) Y RECIBOS DIGITALES
// Archivo: frontend/static/js/modules/ventas.js
// ============================================================

let currentPosCart = [];
let salesHistoryData = [];
let posSelectedPaymentMethod = 'Efectivo';
let posIsOccasionalClient = false;
let posCategoryFilter = 'all';

function initPOS() {
    setupPosCatalogFilters();
    setupPosCartEvents();
    setupPosPaymentMethods();
    setupPosPatientSelector();
    setupReceiptModalEvents();
    setupSalesHistoryFilters();

    fetchSalesHistory();
    fetchSalesKPIs();
}

// ============================================================
// 1. CATÁLOGO DE PRODUCTOS POS
// ============================================================

function renderPosProductGrid() {
    const grid = document.getElementById('pos-product-grid');
    const availableCountEl = document.getElementById('pos-catalog-available-count');
    if (!grid) return;

    const items = typeof allStockItems !== 'undefined' ? allStockItems : [];
    const search = (document.getElementById('pos-search-input')?.value || '').toLowerCase().trim();

    let filtered = items.filter(it => {
        const qty = parseFloat(it.stock_quantity || 0);
        return qty > 0; // Solo productos con stock disponible
    });

    if (availableCountEl) availableCountEl.textContent = filtered.length;

    if (posCategoryFilter && posCategoryFilter !== 'all') {
        filtered = filtered.filter(it => (it.category || 'Otros') === posCategoryFilter);
    }

    if (search) {
        filtered = filtered.filter(it => 
            (it.name || '').toLowerCase().includes(search) ||
            (it.code || '').toLowerCase().includes(search)
        );
    }

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="col-12 text-center py-5 text-muted">
                <i class="bi bi-box-seam fs-2 d-block mb-2 text-secondary opacity-50"></i>
                No se encontraron productos disponibles en el inventario.
            </div>
        `;
        return;
    }

    grid.innerHTML = filtered.map(it => {
        const price = parseFloat(it.sale_price || 0).toFixed(2);
        const qty = parseFloat(it.stock_quantity || 0);
        const unit = escapeHtml(it.unit || 'u');
        const cat = escapeHtml(it.category || 'Insumo');
        const name = escapeHtml(it.name || 'Producto');
        const code = escapeHtml(it.code || 'SKU');

        let catIcon = '🏷️';
        if (cat.includes('BIA') || cat.includes('Electrodos')) catIcon = '⚡';
        else if (cat.includes('Suplemento') || cat.includes('Proteína')) catIcon = '🥤';
        else if (cat.includes('Clínico') || cat.includes('Higiene')) catIcon = '🧤';
        else if (cat.includes('Equipo') || cat.includes('Accesorio')) catIcon = '📦';

        return `
            <div class="pos-product-card p-3 rounded-3 border bg-white shadow-2xs d-flex flex-column justify-content-between cursor-pointer"
                onclick="addPosItemToCart('${it.id}')" role="button" tabindex="0">
                <div class="d-flex align-items-start justify-content-between gap-2 mb-2">
                    <div class="bg-light rounded-3 p-2 text-center flex-shrink-0" style="width: 38px; height: 38px; font-size: 1.1rem;">
                        ${catIcon}
                    </div>
                    <span class="badge bg-light text-secondary border font-monospace text-xs">${code}</span>
                </div>
                <div>
                    <h6 class="fw-bold text-navy mb-1 text-truncate" title="${name}">${name}</h6>
                    <span class="text-muted text-xs d-block mb-2">${cat} • Disp: <strong>${qty} ${unit}</strong></span>
                </div>
                <div class="d-flex align-items-center justify-content-between pt-2 border-top mt-auto">
                    <span class="fw-extrabold text-primary font-monospace fs-6">Bs. ${price}</span>
                    <button type="button" class="btn btn-sm btn-primary rounded-pill px-2.5 py-1 text-xs fw-bold">
                        <i class="bi bi-plus-lg me-0.5"></i> Agregar
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function setupPosCatalogFilters() {
    const searchInput = document.getElementById('pos-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', () => renderPosProductGrid());
    }

    const catBtn = document.getElementById('pos-cat-filter-btn');
    const catMenu = document.getElementById('pos-cat-filter-menu');
    const catSearch = document.getElementById('pos-cat-filter-search');

    if (catBtn && catMenu) {
        catBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            catMenu.classList.toggle('show');
            if (catMenu.classList.contains('show') && catSearch) {
                catSearch.focus();
                populatePosCatFilterList();
            }
        });

        document.addEventListener('click', (e) => {
            if (!catMenu.contains(e.target) && e.target !== catBtn) {
                catMenu.classList.remove('show');
            }
        });
    }

    if (catSearch) {
        catSearch.addEventListener('input', () => populatePosCatFilterList(catSearch.value));
    }
}

function populatePosCatFilterList(filterText = '') {
    const listEl = document.getElementById('pos-cat-filter-list');
    if (!listEl) return;

    const items = typeof allStockItems !== 'undefined' ? allStockItems : [];
    const categoriesSet = new Set(['all']);
    items.forEach(it => { if (it.category) categoriesSet.add(it.category); });

    let cats = Array.from(categoriesSet);
    if (filterText) {
        cats = cats.filter(c => c === 'all' || c.toLowerCase().includes(filterText.toLowerCase()));
    }

    listEl.innerHTML = cats.map(c => {
        const isAll = c === 'all';
        const label = isAll ? 'Todas las Categorías' : c;
        const icon = isAll ? '📁' : '🏷️';
        const isActive = posCategoryFilter === c;

        return `
            <div class="stock-select-option p-2 px-3 d-flex align-items-center justify-content-between cursor-pointer ${isActive ? 'bg-primary-subtle text-primary fw-bold' : ''}"
                onclick="selectPosCategoryFilter('${c}', '${label}')">
                <span>${icon} ${label}</span>
                ${isActive ? '<i class="bi bi-check2 text-primary"></i>' : ''}
            </div>
        `;
    }).join('');
}

function selectPosCategoryFilter(catValue, catLabel) {
    posCategoryFilter = catValue;
    const labelEl = document.getElementById('pos-cat-filter-current-label');
    const hiddenInput = document.getElementById('pos-filter-category');
    const catMenu = document.getElementById('pos-cat-filter-menu');

    if (labelEl) {
        labelEl.innerHTML = `<span>${catValue === 'all' ? '📁' : '🏷️'}</span><span class="fw-semibold text-navy text-truncate">${catLabel}</span>`;
    }
    if (hiddenInput) hiddenInput.value = catValue;
    if (catMenu) catMenu.classList.remove('show');

    renderPosProductGrid();
}

// ============================================================
// 2. CARRITO Y PASARELA DE COBRO POS
// ============================================================

function addPosItemToCart(itemId) {
    const stockItems = typeof allStockItems !== 'undefined' ? allStockItems : [];
    const item = stockItems.find(it => String(it.id) === String(itemId));
    if (!item) return;

    const available = parseFloat(item.stock_quantity || 0);
    const existing = currentPosCart.find(c => String(c.id) === String(itemId));

    if (existing) {
        if (existing.quantity + 1 > available) {
            showToast(`Stock máximo alcanzado para ${item.name} (${available} disp.)`, 'warning');
            return;
        }
        existing.quantity += 1;
    } else {
        if (available < 1) {
            showToast(`Sin existencias disponibles para ${item.name}`, 'warning');
            return;
        }
        currentPosCart.push({
            id: item.id,
            code: item.code,
            name: item.name,
            unit: item.unit || 'u',
            price: parseFloat(item.sale_price || 0),
            cost_price: parseFloat(item.cost_price || 0),
            quantity: 1,
            max_stock: available
        });
    }

    renderPosCart();
}

function updatePosCartItemQuantity(itemId, newQty) {
    const item = currentPosCart.find(c => String(c.id) === String(itemId));
    if (!item) return;

    newQty = parseFloat(newQty);
    if (isNaN(newQty) || newQty <= 0) {
        removePosCartItem(itemId);
        return;
    }

    if (newQty > item.max_stock) {
        showToast(`Stock máximo alcanzado (${item.max_stock} disp.)`, 'warning');
        item.quantity = item.max_stock;
    } else {
        item.quantity = newQty;
    }

    renderPosCart();
}

function removePosCartItem(itemId) {
    currentPosCart = currentPosCart.filter(c => String(c.id) !== String(itemId));
    renderPosCart();
}

function clearPosCart() {
    currentPosCart = [];
    const discountInput = document.getElementById('pos-input-discount');
    const cashInput = document.getElementById('pos-cash-received');
    if (discountInput) discountInput.value = '0.00';
    if (cashInput) cashInput.value = '';
    renderPosCart();
}

function renderPosCart() {
    const container = document.getElementById('pos-cart-items-container');
    const subtotalEl = document.getElementById('pos-summary-subtotal');
    const totalEl = document.getElementById('pos-summary-total');
    const discountInput = document.getElementById('pos-input-discount');
    const btnCheckout = document.getElementById('pos-btn-checkout');

    if (!container) return;

    if (currentPosCart.length === 0) {
        container.innerHTML = `
            <div class="text-center py-4 text-muted small">
                <i class="bi bi-cart-x fs-2 d-block mb-1 text-secondary opacity-50"></i>
                El carrito está vacío.<br>Haz clic en un producto para agregarlo.
            </div>
        `;
        if (subtotalEl) subtotalEl.textContent = 'Bs. 0.00';
        if (totalEl) totalEl.textContent = 'Bs. 0.00';
        if (btnCheckout) btnCheckout.disabled = true;
        updatePosChangeCalculation(0);
        return;
    }

    let subtotal = 0;
    container.innerHTML = currentPosCart.map(it => {
        const lineTotal = it.quantity * it.price;
        subtotal += lineTotal;

        return `
            <div class="pos-cart-item p-2 mb-2 rounded-3 border bg-white shadow-2xs d-flex align-items-center justify-content-between gap-2">
                <div class="flex-grow-1 text-truncate">
                    <div class="fw-bold text-navy text-xs text-truncate">${escapeHtml(it.name)}</div>
                    <div class="text-muted font-monospace" style="font-size: 0.72rem;">Bs. ${it.price.toFixed(2)} x ${it.quantity}</div>
                </div>
                <div class="d-flex align-items-center gap-1">
                    <button type="button" class="btn btn-xs btn-light border px-1.5 py-0.5 text-muted" onclick="updatePosCartItemQuantity('${it.id}', ${it.quantity - 1})">-</button>
                    <span class="font-monospace fw-bold text-navy px-1 small">${it.quantity}</span>
                    <button type="button" class="btn btn-xs btn-light border px-1.5 py-0.5 text-muted" onclick="updatePosCartItemQuantity('${it.id}', ${it.quantity + 1})">+</button>
                </div>
                <div class="text-end ps-1">
                    <div class="fw-bold text-primary font-monospace text-xs">Bs. ${lineTotal.toFixed(2)}</div>
                    <button type="button" class="btn btn-link btn-xs text-danger p-0 text-decoration-none" onclick="removePosCartItem('${it.id}')" title="Quitar ítem">
                        <i class="bi bi-x"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    const discount = parseFloat(discountInput ? discountInput.value : 0) || 0;
    const finalTotal = Math.max(0, subtotal - discount);

    if (subtotalEl) subtotalEl.textContent = `Bs. ${subtotal.toFixed(2)}`;
    if (totalEl) totalEl.textContent = `Bs. ${finalTotal.toFixed(2)}`;
    if (btnCheckout) btnCheckout.disabled = false;

    updatePosChangeCalculation(finalTotal);
}

function updatePosChangeCalculation(finalTotal) {
    const cashInput = document.getElementById('pos-cash-received');
    const changeEl = document.getElementById('pos-cash-change');
    if (!changeEl) return;

    if (posSelectedPaymentMethod !== 'Efectivo') {
        changeEl.textContent = 'Bs. 0.00';
        return;
    }

    const received = parseFloat(cashInput ? cashInput.value : 0) || 0;
    if (received >= finalTotal && finalTotal > 0) {
        const change = received - finalTotal;
        changeEl.textContent = `Bs. ${change.toFixed(2)}`;
        changeEl.className = 'form-control form-control-sm font-monospace bg-light fw-bold text-success';
    } else if (received > 0 && received < finalTotal) {
        const missing = finalTotal - received;
        changeEl.textContent = `Faltan Bs. ${missing.toFixed(2)}`;
        changeEl.className = 'form-control form-control-sm font-monospace bg-light fw-bold text-danger';
    } else {
        changeEl.textContent = 'Bs. 0.00';
        changeEl.className = 'form-control form-control-sm font-monospace bg-light fw-bold text-muted';
    }
}

function setupPosCartEvents() {
    const btnClear = document.getElementById('pos-btn-clear-cart');
    if (btnClear) btnClear.addEventListener('click', clearPosCart);

    const discountInput = document.getElementById('pos-input-discount');
    if (discountInput) {
        discountInput.addEventListener('input', () => renderPosCart());
    }

    const cashInput = document.getElementById('pos-cash-received');
    if (cashInput) {
        cashInput.addEventListener('input', () => {
            const subtotal = currentPosCart.reduce((sum, it) => sum + (it.quantity * it.price), 0);
            const discount = parseFloat(discountInput ? discountInput.value : 0) || 0;
            updatePosChangeCalculation(Math.max(0, subtotal - discount));
        });
    }

    const btnCheckout = document.getElementById('pos-btn-checkout');
    if (btnCheckout) {
        btnCheckout.addEventListener('click', handlePosCheckout);
    }
}

function setupPosPaymentMethods() {
    const payBtns = document.querySelectorAll('.pos-pay-btn');
    const cashPanel = document.getElementById('pos-cash-change-panel');

    payBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            payBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            posSelectedPaymentMethod = btn.getAttribute('data-method') || 'Efectivo';

            if (cashPanel) {
                if (posSelectedPaymentMethod === 'Efectivo') cashPanel.classList.remove('d-none');
                else cashPanel.classList.add('d-none');
            }
            renderPosCart();
        });
    });
}

function setupPosPatientSelector() {
    const input = document.getElementById('pos-patient-input');
    const dropdown = document.getElementById('pos-patient-dropdown');
    const hiddenIdp = document.getElementById('pos-patient-idp-hidden');
    const hiddenPhone = document.getElementById('pos-patient-phone-hidden');
    const toggleModeBtn = document.getElementById('pos-btn-toggle-client-mode');

    if (toggleModeBtn) {
        toggleModeBtn.addEventListener('click', () => {
            posIsOccasionalClient = !posIsOccasionalClient;
            if (posIsOccasionalClient) {
                toggleModeBtn.textContent = 'Seleccionar Paciente';
                if (input) {
                    input.value = 'Cliente Ocasional / Venta de Mostrador';
                    input.readOnly = true;
                }
                if (hiddenIdp) hiddenIdp.value = 'IDP-POS-000';
                if (hiddenPhone) hiddenPhone.value = '';
                if (dropdown) dropdown.innerHTML = '';
            } else {
                toggleModeBtn.textContent = 'Cliente Ocasional';
                if (input) {
                    input.value = '';
                    input.readOnly = false;
                    input.placeholder = 'Buscar paciente registrado...';
                    input.focus();
                }
                if (hiddenIdp) hiddenIdp.value = '';
                if (hiddenPhone) hiddenPhone.value = '';
            }
        });
    }

    if (input && dropdown) {
        input.addEventListener('input', () => {
            if (posIsOccasionalClient) return;
            const query = input.value.trim().toLowerCase();
            if (!query) {
                dropdown.innerHTML = '';
                return;
            }

            const clients = typeof allClientsData !== 'undefined' ? allClientsData : [];
            const matches = clients.filter(c => 
                (c.name || '').toLowerCase().includes(query) ||
                (c.patient_idp || c.idp || '').toLowerCase().includes(query)
            ).slice(0, 5);

            if (matches.length === 0) {
                dropdown.innerHTML = `<div class="p-2 text-muted small">No coincide con ningún paciente registrado.</div>`;
                return;
            }

            dropdown.innerHTML = matches.map(c => `
                <div class="p-2 border-bottom stock-dropdown-item cursor-pointer" onclick="selectPosPatient('${c.id}')">
                    <div class="fw-bold text-navy text-xs">${escapeHtml(c.name)}</div>
                    <div class="text-muted font-monospace" style="font-size: 0.72rem;">${escapeHtml(c.patient_idp || c.idp || 'IDP-0001')} • ${escapeHtml(c.phone || 'Sin teléfono')}</div>
                </div>
            `).join('');
        });

        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target) && e.target !== input) {
                dropdown.innerHTML = '';
            }
        });
    }
}

function selectPosPatient(clientId) {
    const clients = typeof allClientsData !== 'undefined' ? allClientsData : [];
    const client = clients.find(c => String(c.id) === String(clientId));
    if (!client) return;

    const input = document.getElementById('pos-patient-input');
    const hiddenIdp = document.getElementById('pos-patient-idp-hidden');
    const hiddenPhone = document.getElementById('pos-patient-phone-hidden');
    const dropdown = document.getElementById('pos-patient-dropdown');

    if (input) input.value = client.name;
    if (hiddenIdp) hiddenIdp.value = client.patient_idp || client.idp || '';
    if (hiddenPhone) hiddenPhone.value = client.phone || '';
    if (dropdown) dropdown.innerHTML = '';
}

// ============================================================
// 3. FINALIZACIÓN DE VENTA & RECEIP MODAL
// ============================================================

async function handlePosCheckout() {
    if (currentPosCart.length === 0) {
        showToast('El carrito está vacío', 'warning');
        return;
    }

    const btn = document.getElementById('pos-btn-checkout');
    const patientInput = document.getElementById('pos-patient-input');
    const hiddenIdp = document.getElementById('pos-patient-idp-hidden');
    const hiddenPhone = document.getElementById('pos-patient-phone-hidden');
    const discountInput = document.getElementById('pos-input-discount');
    const cashInput = document.getElementById('pos-cash-received');

    const patientName = patientInput ? patientInput.value.trim() : 'Cliente General';
    const patientIdp = hiddenIdp ? hiddenIdp.value.trim() : 'IDP-0001';
    const patientPhone = hiddenPhone ? hiddenPhone.value.trim() : '';
    const discount = parseFloat(discountInput ? discountInput.value : 0) || 0;
    const amountReceived = parseFloat(cashInput ? cashInput.value : 0) || 0;

    const itemsPayload = currentPosCart.map(it => ({
        stock_item_id: it.id,
        quantity: it.quantity,
        unit_price: it.price
    }));

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Procesando Venta...';
    }

    try {
        const payload = {
            patient_name: patientName,
            patient_idp: patientIdp,
            patient_phone: patientPhone,
            payment_method: posSelectedPaymentMethod,
            discount: discount,
            amount_received: amountReceived,
            items: itemsPayload
        };

        const res = await fetch('/api/sales', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
            throw new Error(data.error || 'Error al completar la venta');
        }

        showToast(`🎉 ¡Venta completada con éxito! Comprobante: ${data.sale?.receipt_number}`, 'success');

        // Mostrar recibo digital en modal
        openDigitalReceiptModal(data.sale);

        // Limpiar carrito y refrescar stock
        clearPosCart();
        if (typeof fetchStockItems === 'function') fetchStockItems();
        await fetchSalesHistory(true);
        await fetchSalesKPIs();

    } catch (err) {
        console.error('Error al procesar venta POS:', err);
        showToast(err.message || 'Error de conexión con el servidor', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-check2-circle fs-5"></i><span>Completar Venta & Recibo</span>';
        }
    }
}

function openDigitalReceiptModal(sale) {
    const modal = document.getElementById('modal-digital-receipt');
    if (!modal || !sale) return;

    const numEl = document.getElementById('receipt-modal-number');
    const pName = document.getElementById('receipt-patient-name');
    const pIdp = document.getElementById('receipt-patient-idp');
    const dtEl = document.getElementById('receipt-datetime');
    const pmEl = document.getElementById('receipt-payment-method-badge');
    const tbody = document.getElementById('receipt-items-tbody');
    const subtotalEl = document.getElementById('receipt-subtotal-val');
    const discountRow = document.getElementById('receipt-discount-row');
    const discountVal = document.getElementById('receipt-discount-val');
    const totalEl = document.getElementById('receipt-total-val');
    const cashBox = document.getElementById('receipt-cash-breakdown');
    const receivedEl = document.getElementById('receipt-amount-received');
    const changeEl = document.getElementById('receipt-change-given');
    const waBtn = document.getElementById('btn-receipt-whatsapp');

    if (numEl) numEl.textContent = sale.receipt_number || 'REC-2026';
    if (pName) pName.textContent = sale.patient_name || 'Cliente';
    if (pIdp) pIdp.textContent = `IDP: ${sale.patient_idp || 'N/A'}`;
    if (dtEl) dtEl.textContent = (sale.created_at || '').substring(0, 16).replace('T', ' ');
    if (pmEl) pmEl.textContent = `Método: ${sale.payment_method || 'Efectivo'}`;

    const items = sale.items || sale.sale_items || [];
    if (tbody) {
        tbody.innerHTML = items.map(it => `
            <tr>
                <td class="ps-3 py-2 fw-semibold text-navy">${escapeHtml(it.name || it.item_name)}</td>
                <td class="text-center py-2 font-monospace">${it.quantity}</td>
                <td class="text-end py-2 font-monospace">Bs. ${parseFloat(it.unit_price || 0).toFixed(2)}</td>
                <td class="text-end pe-3 py-2 font-monospace fw-bold text-primary">Bs. ${parseFloat(it.subtotal || 0).toFixed(2)}</td>
            </tr>
        `).join('');
    }

    if (subtotalEl) subtotalEl.textContent = `Bs. ${parseFloat(sale.subtotal || 0).toFixed(2)}`;
    
    const disc = parseFloat(sale.discount || 0);
    if (discountRow) {
        if (disc > 0) {
            discountRow.classList.remove('d-none');
            if (discountVal) discountVal.textContent = `-Bs. ${disc.toFixed(2)}`;
        } else {
            discountRow.classList.add('d-none');
        }
    }

    if (totalEl) totalEl.textContent = `Bs. ${parseFloat(sale.total || 0).toFixed(2)}`;

    if (cashBox) {
        if (sale.payment_method === 'Efectivo' && parseFloat(sale.amount_received || 0) > 0) {
            cashBox.classList.remove('d-none');
            if (receivedEl) receivedEl.textContent = `Bs. ${parseFloat(sale.amount_received).toFixed(2)}`;
            if (changeEl) changeEl.textContent = `Bs. ${parseFloat(sale.change_given || 0).toFixed(2)}`;
        } else {
            cashBox.classList.add('d-none');
        }
    }

    if (waBtn && sale.patient_phone) {
        const cleanPhone = sale.patient_phone.replace(/[^0-9]/g, '');
        const msg = encodeURIComponent(`Hola ${sale.patient_name}, adjuntamos su comprobante de compra ${sale.receipt_number} por un total de Bs. ${sale.total}. Gracias por su preferencia en VitaMetrix.`);
        waBtn.onclick = () => window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank');
        waBtn.style.display = 'inline-flex';
    } else if (waBtn) {
        waBtn.style.display = 'none';
    }

    modal.classList.remove('hidden', 'd-none');
    modal.style.display = 'flex';
}

function setupReceiptModalEvents() {
    const modal = document.getElementById('modal-digital-receipt');
    const closeBtn1 = document.getElementById('btn-close-receipt-modal');
    const closeBtn2 = document.getElementById('btn-footer-close-receipt');
    const printBtn = document.getElementById('btn-receipt-print');

    const closeModal = () => {
        if (modal) {
            modal.classList.add('hidden', 'd-none');
            modal.style.display = 'none';
        }
    };

    if (closeBtn1) closeBtn1.addEventListener('click', closeModal);
    if (closeBtn2) closeBtn2.addEventListener('click', closeModal);

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }

    if (printBtn) {
        printBtn.addEventListener('click', () => {
            window.print();
        });
    }
}

// ============================================================
// 4. HISTORIAL DE VENTAS Y KPIS
// ============================================================

async function fetchSalesHistory(force = false) {
    try {
        const res = await fetch('/api/sales', { headers: getAuthHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        salesHistoryData = Array.isArray(data) ? data : (data.sales || []);
        renderSalesHistoryTable();
    } catch (e) {
        console.warn('Error al cargar ventas:', e);
    }
}

async function fetchSalesKPIs() {
    try {
        const res = await fetch('/api/sales/stats', { headers: getAuthHeaders() });
        if (!res.ok) return;
        const data = await res.json();

        const kpiTotal = document.getElementById('sales-kpi-total-amount');
        const kpiProfit = document.getElementById('sales-kpi-total-profit');
        const kpiTodayAmount = document.getElementById('sales-kpi-today-amount');
        const kpiTodayCount = document.getElementById('sales-kpi-today-count');
        const kpiAvg = document.getElementById('sales-kpi-avg-ticket');

        if (kpiTotal) kpiTotal.textContent = `Bs. ${parseFloat(data.total_sales_amount || 0).toFixed(2)}`;
        if (kpiProfit) kpiProfit.textContent = `Bs. ${parseFloat(data.total_profit || 0).toFixed(2)}`;
        if (kpiTodayAmount) kpiTodayAmount.textContent = `Bs. ${parseFloat(data.today_sales_amount || 0).toFixed(2)}`;
        if (kpiTodayCount) kpiTodayCount.textContent = data.today_sales_count || 0;
        if (kpiAvg) kpiAvg.textContent = `Bs. ${parseFloat(data.average_ticket || 0).toFixed(2)}`;

    } catch (e) {
        console.warn('Error al cargar KPIs de ventas:', e);
    }
}

function setupSalesHistoryFilters() {
    const searchInput = document.getElementById('sales-search-input');
    const filterPayment = document.getElementById('sales-filter-payment');
    const filterStatus = document.getElementById('sales-filter-status');

    if (searchInput) searchInput.addEventListener('input', () => renderSalesHistoryTable());
    if (filterPayment) filterPayment.addEventListener('change', () => renderSalesHistoryTable());
    if (filterStatus) filterStatus.addEventListener('change', () => renderSalesHistoryTable());
}

function renderSalesHistoryTable() {
    const tbody = document.getElementById('sales-tbody');
    const totalCountEl = document.getElementById('sales-total-count');
    if (!tbody) return;

    const search = (document.getElementById('sales-search-input')?.value || '').toLowerCase().trim();
    const payFilter = document.getElementById('sales-filter-payment')?.value || 'all';
    const statusFilter = document.getElementById('sales-filter-status')?.value || 'all';

    let filtered = [...salesHistoryData];

    if (search) {
        filtered = filtered.filter(s => 
            (s.receipt_number || '').toLowerCase().includes(search) ||
            (s.patient_name || '').toLowerCase().includes(search)
        );
    }

    if (payFilter !== 'all') {
        filtered = filtered.filter(s => (s.payment_method || '') === payFilter);
    }

    if (statusFilter !== 'all') {
        filtered = filtered.filter(s => (s.status || 'COMPLETED') === statusFilter);
    }

    if (totalCountEl) totalCountEl.textContent = filtered.length;

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-5 text-muted">
                    <i class="bi bi-receipt fs-2 d-block mb-2 text-secondary opacity-50"></i>
                    No se encontraron comprobantes de venta registrados.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtered.map(s => {
        const isCancelled = s.status === 'CANCELLED';
        const dateStr = (s.created_at || '').substring(0, 16).replace('T', ' ');
        const items = s.items || s.sale_items || [];
        const itemsSummary = items.map(it => `${it.quantity}x ${it.name || it.item_name}`).join(', ') || 'Productos';

        return `
            <tr class="${isCancelled ? 'opacity-50 text-decoration-line-through' : ''}">
                <td class="ps-3 py-3 fw-bold font-monospace text-primary">${escapeHtml(s.receipt_number || 'REC-0000')}</td>
                <td class="text-muted small">${dateStr}</td>
                <td>
                    <div class="fw-bold text-navy">${escapeHtml(s.patient_name || 'Cliente')}</div>
                    <div class="text-muted text-xs font-monospace">${escapeHtml(s.patient_idp || 'IDP-0001')}</div>
                </td>
                <td class="small text-muted text-truncate" style="max-width: 200px;" title="${escapeHtml(itemsSummary)}">
                    ${escapeHtml(itemsSummary)}
                </td>
                <td><span class="badge bg-light text-secondary border">${escapeHtml(s.payment_method || 'Efectivo')}</span></td>
                <td class="fw-bold font-monospace text-primary">Bs. ${parseFloat(s.total || 0).toFixed(2)}</td>
                <td>
                    ${isCancelled ? 
                        '<span class="badge bg-danger-subtle text-danger border border-danger-subtle">🚫 Anulada</span>' : 
                        '<span class="badge bg-success-subtle text-success border border-success-subtle">✅ Completada</span>'
                    }
                </td>
                <td class="text-end pe-3">
                    <button type="button" class="btn btn-light btn-xs border text-primary" onclick="viewSaleReceipt('${s.id}')" title="Ver Recibo Digital">
                        <i class="bi bi-receipt"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function viewSaleReceipt(saleId) {
    const sale = salesHistoryData.find(s => String(s.id) === String(saleId));
    if (sale) openDigitalReceiptModal(sale);
}

// Exportación global
window.renderPosProductGrid = renderPosProductGrid;
window.addPosItemToCart = addPosItemToCart;
window.updatePosCartItemQuantity = updatePosCartItemQuantity;
window.removePosCartItem = removePosCartItem;
window.clearPosCart = clearPosCart;
window.selectPosCategoryFilter = selectPosCategoryFilter;
window.selectPosPatient = selectPosPatient;
window.viewSaleReceipt = viewSaleReceipt;
window.openDigitalReceiptModal = openDigitalReceiptModal;
window.initPOS = initPOS;
