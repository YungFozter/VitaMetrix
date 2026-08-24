document.addEventListener('DOMContentLoaded', () => {
    initDemoDataInjector();
    initFieldInfoPopups();
    initMobileSidebar();
    initClock();
    initNavigation();
    initBioForm();
    initClients();
    initEvaluaciones();
    initProfileDropdown();
    initSystemMenuListeners();
    initAppointmentsCalendar();
    initConfiguracionView();
    fetchDashboardStats();
});

// --- 0. TOASTS & MODALS ---
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

    document.getElementById('modal-title').textContent = title || 'Confirmación';
    document.getElementById('modal-message').textContent = message || '¿Estás seguro?';

    const btnCancel = document.getElementById('modal-btn-cancel');
    const btnConfirm = document.getElementById('modal-btn-confirm');
    const iconContainer = document.getElementById('modal-icon-container');

    if (btnConfirm) {
        btnConfirm.textContent = options.confirmText || 'Eliminar';
    }

    if (iconContainer) {
        iconContainer.innerHTML = `<i class="${options.icon || 'bi bi-trash3-fill'}"></i>`;
    }

    // Reset listeners by cloning
    const newCancel = btnCancel.cloneNode(true);
    const newConfirm = btnConfirm.cloneNode(true);
    btnCancel.parentNode.replaceChild(newCancel, btnCancel);
    btnConfirm.parentNode.replaceChild(newConfirm, btnConfirm);

    const closeModal = () => modal.classList.add('hidden');

    newCancel.addEventListener('click', closeModal);
    newConfirm.addEventListener('click', () => {
        closeModal();
        if (typeof onConfirm === 'function') onConfirm();
    });

    // Close on clicking backdrop
    modal.onclick = (e) => {
        if (e.target === modal) closeModal();
    };

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

// --- 2. NAVIGATION (SPA) ---
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view');
    const pageTitle = document.getElementById('page-title');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();

            // Remove active from all nav items
            navItems.forEach(nav => nav.classList.remove('active'));
            // Add active to clicked nav item
            item.classList.add('active');

            // Get target view ID
            const targetId = item.getAttribute('data-target');
            if (targetId) {
                // Hide all views
                views.forEach(view => {
                    view.classList.remove('active-view');
                    view.classList.add('hidden-view');
                });
                // Show target view
                const targetView = document.getElementById(targetId);
                if (targetView) {
                    targetView.classList.remove('hidden-view');
                    targetView.classList.add('active-view');
                }

                // Update title
                pageTitle.textContent = item.getAttribute('data-title') || 'Dashboard';

                if (targetId === 'configuracion-view') {
                    setTimeout(() => {
                        if (typeof initClinicMap === 'function') initClinicMap();
                    }, 150);
                }
            }
        });
    });
}

// --- 3. FORM & API ---
function initBioForm() {
    const form = document.getElementById('bio-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Change button state
        const btn = document.querySelector('button[form="bio-form"]') || form.querySelector('button[type="submit"]');
        let originalText = 'Analizar Composición';
        if (btn) {
            originalText = btn.innerHTML;
            btn.innerHTML = '<span class="btn-ico">⏳</span> Calculando...';
            btn.disabled = true;
        }

        // Gather data
        const payload = {
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

        // Validar rangos numéricos reales
        if (isNaN(payload.resistance) || payload.resistance < 100 || payload.resistance > 1500) {
            showToast('Resistencia (R) fuera de rango válido (100 - 1500 Ω)', 'error');
            if (btn) { btn.innerHTML = originalText; btn.disabled = false; }
            return;
        }
        if (isNaN(payload.reactance) || payload.reactance < 10 || payload.reactance > 200) {
            showToast('Reactancia (Xc) fuera de rango válido (10 - 200 Ω)', 'error');
            if (btn) { btn.innerHTML = originalText; btn.disabled = false; }
            return;
        }
        if (isNaN(payload.weight) || payload.weight < 20 || payload.weight > 350) {
            showToast('Peso fuera de rango válido (20 - 350 kg)', 'error');
            if (btn) { btn.innerHTML = originalText; btn.disabled = false; }
            return;
        }
        if (isNaN(payload.height) || payload.height < 50 || payload.height > 250) {
            showToast('Altura fuera de rango válido (50 - 250 cm)', 'error');
            if (btn) { btn.innerHTML = originalText; btn.disabled = false; }
            return;
        }
        if (isNaN(payload.age) || payload.age < 1 || payload.age > 120) {
            showToast('Edad fuera de rango válido (1 - 120 años)', 'error');
            if (btn) { btn.innerHTML = originalText; btn.disabled = false; }
            return;
        }

        try {
            const response = await fetch('/api/dashboard-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Error en el análisis');
            }

            updateBioUI(data, payload);
            if (data.saved) {
                showToast("Evaluación guardada en la nube con éxito.", "success");
            } else {
                showToast("Análisis listo. No se pudo guardar en la nube.", "info");
            }

            // Refrescar stats del dashboard
            fetchDashboardStats();

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
}

let populationChart = null;

async function fetchDashboardStats() {
    try {
        const response = await fetch('/api/dashboard-stats');
        if (response.ok) {
            const data = await response.json();

            // 1. Update Top Cards
            document.getElementById('dash-total-clients').textContent = data.total_clients ?? 0;
            document.getElementById('dash-total-evals').textContent = data.total_evaluations ?? 0;
            document.getElementById('dash-avg-score').textContent = data.avg_score ?? 0;

            // 2. Update Recent Table
            const tbody = document.getElementById('dash-recent-tbody');
            if (tbody) {
                tbody.replaceChildren();
                const recent = Array.isArray(data.recent) ? data.recent : [];
                if (recent.length === 0) {
                    const tr = document.createElement('tr');
                    const td = document.createElement('td');
                    td.colSpan = 6;
                    td.style.textAlign = 'center';
                    td.style.padding = '3rem';
                    td.style.color = '#7a8aa0';
                    td.textContent = 'No hay evaluaciones recientes registradas.';
                    tr.appendChild(td);
                    tbody.appendChild(tr);
                } else {
                    recent.forEach((e, idx) => {
                        const tr = document.createElement('tr');
                        tr.className = 'dash-table-row';

                        // 1. Cell Paciente (Avatar + Name + ID)
                        const tdName = document.createElement('td');
                        const rawName = e.name || 'Paciente Sin Nombre';
                        // Clean initials
                        const parts = rawName.replace(/^(Dr\.|Dra\.|Lic\.)\s*/i, '').trim().split(/[\s,]+/);
                        const initials = parts.length >= 2 
                            ? (parts[0][0] + parts[1][0]).toUpperCase() 
                            : (rawName.slice(0, 2).toUpperCase());
                        
                        const colors = ['#00b4d8', '#2d7a4a', '#cd7f32', '#1A2A4A', '#7209b7'];
                        const bgCol = colors[idx % colors.length];

                        tdName.innerHTML = `
                            <div class="patient-cell">
                                <div class="patient-avatar" style="background: ${bgCol};">${initials}</div>
                                <div class="patient-info">
                                    <div class="patient-name">${rawName}</div>
                                    <div class="patient-idp">IDP: ${e.idp || ('2026-' + (100 + idx * 17))}</div>
                                </div>
                            </div>
                        `;

                        // 2. Cell Fecha (Human format)
                        const tdDate = document.createElement('td');
                        const rawDate = e.date || '';
                        let formattedDate = rawDate;
                        if (rawDate) {
                            const todayStr = new Date().toISOString().split('T')[0];
                            if (rawDate === todayStr) {
                                formattedDate = '<span class="date-tag tag-today">Hoy</span>';
                            } else {
                                const dParts = rawDate.split('-');
                                if (dParts.length === 3) formattedDate = `${dParts[2]}/${dParts[1]}/${dParts[0]}`;
                            }
                        }
                        tdDate.innerHTML = `<div class="date-cell">${formattedDate}</div>`;

                        // 3. Cell Score TRU (Dynamic Badge)
                        const tdScore = document.createElement('td');
                        const scoreVal = Number(e.score) || 0;
                        let scoreClass = 'score-badge-good';
                        if (scoreVal < 50) scoreClass = 'score-badge-alert';
                        else if (scoreVal < 70) scoreClass = 'score-badge-mid';

                        tdScore.innerHTML = `<span class="score-pill ${scoreClass}">${scoreVal} pts</span>`;

                        // 4. Cell Ángulo de Fase
                        const tdPhase = document.createElement('td');
                        const phaVal = Number(e.phase_angle) || 0;
                        tdPhase.innerHTML = `<div class="pha-cell">${phaVal ? phaVal.toFixed(1) + '°' : '--'}</div>`;

                        // 5. Cell Estado (PhA Bucket)
                        const tdStatus = document.createElement('td');
                        let statusHtml = '<span class="status-pill status-normal">🟢 Normal</span>';
                        if (phaVal > 0 && phaVal < 5.0) {
                            statusHtml = '<span class="status-pill status-alert">🔴 Riesgo</span>';
                        } else if (phaVal >= 5.0 && phaVal < 6.0) {
                            statusHtml = '<span class="status-pill status-warning">🟡 Moderado</span>';
                        }
                        tdStatus.innerHTML = statusHtml;

                        // 6. Cell Acción
                        const tdAction = document.createElement('td');
                        tdAction.style.textAlign = 'right';
                        tdAction.innerHTML = `
                            <button type="button" class="btn-table-view" title="Ver detalles de la evaluación">
                                👁️ Ver
                            </button>
                        `;
                        const viewBtn = tdAction.querySelector('.btn-table-view');
                        if (viewBtn) {
                            viewBtn.addEventListener('click', (evt) => {
                                evt.stopPropagation();
                                const evalsTab = document.querySelector('[data-target="evaluaciones-view"]');
                                if (evalsTab) evalsTab.click();
                            });
                        }

                        tr.append(tdName, tdDate, tdScore, tdPhase, tdStatus, tdAction);
                        tbody.appendChild(tr);
                    });
                }
            }

            // 3. Render Chart.js
            const ctx = document.getElementById('dash-population-chart');
            if (ctx && window.Chart) {
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
                            backgroundColor: [
                                '#2d7a4a', // Verde
                                '#cd7f32', // Bronce
                                '#b94a4a'  // Rojo
                            ],
                            borderWidth: 0,
                            hoverOffset: 4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
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
        document.getElementById('water-tbw').textContent = hyd.tbw ?? '--';
        document.getElementById('water-ecw').textContent = hyd.ecw ?? '--';
        document.getElementById('water-ratio').textContent = hyd.ecw_tbw_ratio ? `${hyd.ecw_tbw_ratio}%` : '--';
        const wStatus = document.getElementById('water-status');
        setChip(wStatus, hyd.alert ? ['Alerta', 'red'] : [hyd.status || 'Normal', 'green']);
    }

    // CARD 10: Cintura & visceral
    const vis = data.visceral;
    if (vis && vis.available) {
        showGrid('waist-na', 'waist-grid');
        const waist = inputs.waist;
        const wValEl = document.getElementById('waist-val');
        const wStatus = document.getElementById('waist-status');
        if (waist != null && waist !== '') {
            wValEl.textContent = waist;
            // Pin: escala 50–130 cm -> 0–100%
            const pct = Math.max(0, Math.min(100, ((parseFloat(waist) - 50) / 80) * 100));
            document.getElementById('waist-bar').style.width = `${pct}%`;
            document.getElementById('waist-pin').style.left = `${pct}%`;
            setChip(wStatus, vis.waist_risk === 'Alto' ? ['Alto', 'red'] : ['Normal', 'green']);
        } else {
            wValEl.textContent = '--';
            wStatus.textContent = '--';
            wStatus.className = 'status-chip muted';
        }
        const viscEl = document.getElementById('visc-status');
        if (vis.visceral_alert) {
            viscEl.style.display = 'block';
            viscEl.textContent = `⚠️ ${vis.status}`;
        } else if (vis.status && vis.status !== 'No disponible') {
            viscEl.style.display = 'block';
            viscEl.textContent = vis.status;
        } else {
            viscEl.style.display = 'none';
        }
    }

    // CARD 11: BCC
    const bcc = data.bcc;
    if (bcc && bcc.available) {
        showGrid('bcc-na', 'bcc-grid');
        drawBCC(bcc.muscle_pct, bcc.fat_pct);
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

    const padL = 30, padR = 12, padT = 12, padB = 22;
    const plotW = w - padL - padR, plotH = h - padT - padB;
    const xOf = (age) => padL + ((age - aMin) / (aMax - aMin || 1)) * plotW;
    const yOf = (val) => padT + plotH - ((val - vMin) / (vMax - vMin || 1)) * plotH;

    // Ejes
    ctx.strokeStyle = '#c0c8d8';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, padT + plotH); ctx.lineTo(padL + plotW, padT + plotH); ctx.stroke();

    // Curvas de referencia (P5, P25, P50, P75, P95)
    const series = [
        { key: 'p5', color: 'rgba(185,74,74,0.5)' },
        { key: 'p25', color: 'rgba(205,127,50,0.7)' },
        { key: 'p50', color: '#1A2A4A' },
        { key: 'p75', color: 'rgba(205,127,50,0.7)' },
        { key: 'p95', color: 'rgba(185,74,74,0.5)' }
    ];
    series.forEach(s => {
        ctx.strokeStyle = s.color;
        ctx.lineWidth = (s.key === 'p50') ? 2.2 : 1.3;
        ctx.setLineDash(s.key === 'p50' ? [] : [4, 3]);
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
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, 2 * Math.PI);
        ctx.fillStyle = '#2d7a4a';
        ctx.shadowColor = 'rgba(45,122,74,0.5)';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // Etiquetas
    ctx.fillStyle = '#5a6a82';
    ctx.font = '9px Inter';
    ctx.fillText(aMin + 'a', padL, h - 6);
    ctx.fillText(aMax + 'a', padL + plotW - 18, h - 6);
    ctx.fillText(Math.round(vMax), 4, padT + 6);
    ctx.fillText(Math.round(vMin), 4, padT + plotH);
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

// --- 5. CLIENTES ---
let editingClientId = null;

function initClients() {
    const form = document.getElementById('client-form');
    if (!form) return;

    // Cargar tabla inicial
    fetchClients();

    const btnCancel = document.getElementById('btn-cancel-client');
    const btnSave = document.getElementById('btn-save-client');

    btnCancel.addEventListener('click', () => {
        form.reset();
        editingClientId = null;
        btnSave.textContent = 'Guardar Cliente';
        btnCancel.classList.add('hidden-view');
        const h3 = form.previousElementSibling;
        if (h3) h3.textContent = 'Registrar Cliente';
    });

    // Guardar o Actualizar cliente
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const originalText = btnSave.textContent;
        btnSave.textContent = 'Guardando...';
        btnSave.disabled = true;

        const payload = {
            name: document.getElementById('new-client-name').value,
            phone: document.getElementById('new-client-phone').value,
            email: document.getElementById('new-client-email').value
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
                btnCancel.click();
                fetchClients();
                showToast(wasEditing ? 'Cliente actualizado exitosamente' : 'Cliente guardado con el código ' + assignedCode, 'success');
            } else {
                showToast('Error al guardar: ' + result.error, 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Error de conexión.', 'error');
        } finally {
            btnSave.textContent = originalText;
            btnSave.disabled = false;
        }
    });
}

async function fetchClients() {
    const tbody = document.getElementById('clients-tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 2rem;">Cargando...</td></tr>';

    try {
        const res = await fetch('/api/clients');
        const clients = await res.json();
        if (!res.ok || !Array.isArray(clients) || clients.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 2rem; color: #7a8aa0;">No hay clientes registrados.</td></tr>';
            return;
        }

        tbody.replaceChildren();
        clients.forEach(c => {
            const tr = document.createElement('tr');
            const tdCode = document.createElement('td');
            const badge = document.createElement('span');
            badge.className = 'code-badge';
            badge.textContent = 'ID-' + String(c.code ?? 0).padStart(4, '0');
            tdCode.appendChild(badge);

            const tdName = document.createElement('td');
            tdName.style.fontWeight = '600';
            tdName.textContent = c.name || '';

            const tdContact = document.createElement('td');
            if (c.phone) tdContact.append(`📞 ${c.phone}`);
            if (c.phone && c.email) tdContact.appendChild(document.createElement('br'));
            if (c.email) tdContact.append(`📧 ${c.email}`);

            const tdActions = document.createElement('td');

            const btnEvals = document.createElement('button');
            btnEvals.className = 'btn-primary';
            btnEvals.style.cssText = 'padding: 0.35rem 0.65rem; font-size: 0.8rem; margin-right: 0.4rem; background: #00b4d8; border: none;';
            btnEvals.innerHTML = '📋 Evaluaciones';
            btnEvals.title = 'Ver historial de evaluaciones de este cliente';
            btnEvals.addEventListener('click', () => {
                const evalNav = document.querySelector('[data-target="evaluaciones-view"]');
                if (evalNav) evalNav.click();
                const searchInput = document.getElementById('eval-search-input');
                if (searchInput) {
                    searchInput.value = c.name || '';
                    filterAndRenderEvaluaciones();
                }
                showToast(`Mostrando evaluaciones de ${c.name}`, 'info');
            });

            const btnEdit = document.createElement('button');
            btnEdit.className = 'btn-edit';
            btnEdit.style.cssText = 'padding: 0.35rem 0.65rem; font-size: 0.8rem; margin-right: 0.4rem;';
            btnEdit.textContent = 'Editar';
            btnEdit.addEventListener('click', () => editClient(c.id, c.name || '', c.phone || '', c.email || ''));

            const btnDel = document.createElement('button');
            btnDel.className = 'btn-danger';
            btnDel.style.cssText = 'padding: 0.35rem 0.65rem; font-size: 0.8rem;';
            btnDel.textContent = 'Eliminar';
            btnDel.addEventListener('click', () => deleteClient(c.id));

            tdActions.append(btnEvals, btnEdit, btnDel);

            tr.append(tdCode, tdName, tdContact, tdActions);
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: red;">Error cargando clientes.</td></tr>';
    }
}

function deleteClient(id) {
    showConfirm(
        'Eliminar Cliente',
        '¿Estás seguro de que deseas eliminar este cliente? Su código será reasignado al próximo cliente nuevo.',
        async () => {
            try {
                const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' });
                const result = await res.json();
                if (result.success) {
                    showToast('Cliente eliminado correctamente', 'success');
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

function editClient(id, name, phone, email) {
    editingClientId = id;

    document.getElementById('new-client-name').value = name;
    document.getElementById('new-client-phone').value = phone;
    document.getElementById('new-client-email').value = email;

    document.getElementById('btn-save-client').textContent = 'Actualizar Cliente';
    document.getElementById('btn-cancel-client').classList.remove('hidden-view');

    const h3 = document.querySelector('#client-form').previousElementSibling;
    if (h3) h3.textContent = 'Editar Cliente';
}

// --- 4. EVALUACIONES (HISTORIAL Y DETALLE) ---
let allEvaluationsData = [];
let selectedEvaluationData = null;
let evalCurrentPage = 1;
let evalPageSize = '25';

function initEvaluaciones() {
    const btnRefresh = document.getElementById('btn-refresh-evals');
    const searchInput = document.getElementById('eval-search-input');
    const filterStatus = document.getElementById('eval-filter-status');
    const pageSizeSelect = document.getElementById('eval-page-size');
    const btnPrev = document.getElementById('eval-btn-prev');
    const btnNext = document.getElementById('eval-btn-next');

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

            modal.classList.add('hidden');

            // Switch to bioimpedancia view
            const bioNav = document.querySelector('[data-target="bio-view"]');
            if (bioNav) bioNav.click();

            showToast('Evaluación cargada en el formulario de bioimpedancia', 'success');

            // Trigger submit calculation automatically
            const form = document.getElementById('bio-form');
            if (form) {
                form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true }));
            }
        });
    }

    // Modal action: Edit Client Data
    const btnEditClient = document.getElementById('btn-modal-edit-client');
    if (btnEditClient) {
        btnEditClient.addEventListener('click', async () => {
            if (!selectedEvaluationData) return;
            const patientName = selectedEvaluationData.patient_name;
            modal.classList.add('hidden');

            // Switch to clients view
            const clientsNav = document.querySelector('[data-target="clientes-view"]');
            if (clientsNav) clientsNav.click();

            // Try to find matching client by name
            try {
                const res = await fetch('/api/clients');
                const clients = await res.json();
                const match = clients.find(c => (c.name || '').toLowerCase() === (patientName || '').toLowerCase());
                if (match) {
                    editClient(match.id, match.name, match.phone || '', match.email || '');
                    showToast(`Editando datos de ${match.name}`, 'info');
                } else {
                    document.getElementById('new-client-name').value = patientName || '';
                    showToast(`Creando/Editando registro para ${patientName}`, 'info');
                }
            } catch (err) {
                console.error(err);
            }
        });
    }

    fetchEvaluaciones();
}

async function fetchEvaluaciones() {
    const tbody = document.getElementById('evaluaciones-tbody');
    if (!tbody) return;

    try {
        const res = await fetch('/api/evaluations');
        if (!res.ok) throw new Error('Error al consultar servidor');
        allEvaluationsData = await res.json();
        filterAndRenderEvaluaciones();
    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 2.5rem; color: red;">Error al cargar las evaluaciones.</td></tr>';
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

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 2.5rem; color: #5a6f8c;">No se encontraron evaluaciones registradas.</td></tr>';
        return;
    }

    tbody.replaceChildren();
    pageItems.forEach(ev => {
        const tr = document.createElement('tr');

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
        btnView.addEventListener('click', () => openEvaluationDetailModal(ev.id));

        const btnDel = document.createElement('button');
        btnDel.className = 'eval-btn-delete';
        btnDel.innerHTML = '<i class="bi bi-trash3-fill"></i>';
        btnDel.title = 'Eliminar Evaluación';
        btnDel.addEventListener('click', () => deleteEvaluation(ev.id));

        btnGroup.append(btnView, btnDel);
        tdActions.appendChild(btnGroup);
        tr.append(tdCode, tdDate, tdPatient, tdBase, tdScore, tdPhase, tdStatus, tdActions);
        tbody.appendChild(tr);
    });
}

async function openEvaluationDetailModal(evalId) {
    const modal = document.getElementById('eval-detail-modal');
    if (!modal) return;

    showToast('Cargando reporte de evaluación...', 'info');

    try {
        const res = await fetch(`/api/evaluations/${evalId}`);
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
                <div><strong>Peso:</strong> ${inp.weight || '--'} kg</div>
                <div><strong>Altura:</strong> ${inp.height || '--'} cm</div>
                <div><strong>Edad:</strong> ${inp.age || '--'} años</div>
                <div><strong>Género:</strong> ${inp.gender === 'female' ? 'Femenino' : 'Masculino'}</div>
                <div><strong>Resistencia (R):</strong> ${inp.resistance || '--'} Ω</div>
                <div><strong>Reactancia (Xc):</strong> ${inp.reactance || '--'} Ω</div>
                <div><strong>Masa Muscular (SMM):</strong> ${inp.smm ? inp.smm + ' kg' : 'N/A'}</div>
                <div><strong>Masa Grasa:</strong> ${inp.fat_mass ? inp.fat_mass + ' kg' : 'N/A'}</div>
                <div><strong>Grasa Visceral:</strong> ${inp.visceral_fat ? inp.visceral_fat + ' L' : 'N/A'}</div>
                <div><strong>PAL (Actividad):</strong> ${inp.pal || '--'}</div>
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
                const res = await fetch(`/api/evaluations/${evalId}`, { method: 'DELETE' });
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

    const padL = 30, padR = 12, padT = 12, padB = 22;
    const plotW = w - padL - padR, plotH = h - padT - padB;
    const xOf = (age) => padL + ((age - aMin) / (aMax - aMin || 1)) * plotW;
    const yOf = (val) => padT + plotH - ((val - vMin) / (vMax - vMin || 1)) * plotH;

    ctx.strokeStyle = '#c0c8d8';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, padT + plotH); ctx.lineTo(padL + plotW, padT + plotH); ctx.stroke();

    const series = [
        { key: 'p5', color: 'rgba(185,74,74,0.5)' },
        { key: 'p25', color: 'rgba(205,127,50,0.7)' },
        { key: 'p50', color: '#1A2A4A' },
        { key: 'p75', color: 'rgba(205,127,50,0.7)' },
        { key: 'p95', color: 'rgba(185,74,74,0.5)' }
    ];
    series.forEach(s => {
        ctx.strokeStyle = s.color;
        ctx.lineWidth = (s.key === 'p50') ? 2.2 : 1.3;
        ctx.setLineDash(s.key === 'p50' ? [] : [4, 3]);
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
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, 2 * Math.PI);
        ctx.fillStyle = '#2d7a4a';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

// --- 4d. GRÁFICO BCC (SCATTER PLOT MÚSCULO VS GRASA) ---
function drawBCC(musclePct, fatPct) {
    const canvas = document.getElementById('bccCanvas');
    if (window.bccChartInstance) {
        window.bccChartInstance.destroy();
        window.bccChartInstance = null;
    }
    if (!canvas || !window.Chart) return;

    window.bccChartInstance = new Chart(canvas, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Paciente',
                data: [{ x: musclePct, y: fatPct }],
                backgroundColor: '#1A2A4A',
                borderColor: '#ffffff',
                borderWidth: 2,
                pointRadius: 8,
                pointHoverRadius: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `Músculo: ${ctx.raw.x}%, Grasa: ${ctx.raw.y}%`
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Músculo (SMM) %', color: '#5a6f8c' },
                    min: Math.max(0, musclePct - 20),
                    max: musclePct + 20,
                    grid: { color: 'rgba(0,0,0,0.05)' }
                },
                y: {
                    title: { display: true, text: 'Grasa (FM) %', color: '#5a6f8c' },
                    min: Math.max(0, fatPct - 20),
                    max: fatPct + 20,
                    grid: { color: 'rgba(0,0,0,0.05)' }
                }
            }
        },
        plugins: [{
            id: 'bccDiagonal',
            beforeDraw: (chart) => {
                const ctx = chart.ctx;
                const xAxis = chart.scales.x;
                const yAxis = chart.scales.y;
                ctx.save();
                ctx.strokeStyle = '#cd7f32';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(xAxis.getPixelForValue(xAxis.min), yAxis.getPixelForValue(yAxis.max));
                ctx.lineTo(xAxis.getPixelForValue(xAxis.max), yAxis.getPixelForValue(yAxis.min));
                ctx.stroke();
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

    btnDemo.addEventListener('click', (e) => {
        e.preventDefault();

        // 1. Datos básicos
        document.getElementById('input-idp').value = '104829';
        document.getElementById('input-name').value = 'Dra. Sofía Alarcón';
        document.getElementById('input-r').value = '532.4';
        document.getElementById('input-xc').value = '57.8';
        document.getElementById('input-weight').value = '66.4';
        document.getElementById('input-height').value = '167';
        document.getElementById('input-age').value = '29';
        document.getElementById('input-gender').value = 'female';
        document.getElementById('input-pal').value = '1.55';
        document.getElementById('input-waist').value = '73.0';

        // 2. Abrir datos del dispositivo y llenarlos
        const details = document.querySelector('details.device-data');
        if (details) details.open = true;

        document.getElementById('input-smm').value = '25.8';
        document.getElementById('input-tbw').value = '37.4';
        document.getElementById('input-ecw').value = '14.8';
        document.getElementById('input-fat-mass').value = '15.6';
        document.getElementById('input-visceral').value = '1.1';
        document.getElementById('input-phase-dev').value = '6.2';
        document.getElementById('input-seg-arm-r').value = '2.35';
        document.getElementById('input-seg-arm-l').value = '2.30';
        document.getElementById('input-seg-torso').value = '18.9';
        document.getElementById('input-seg-leg-r').value = '6.5';
        document.getElementById('input-seg-leg-l').value = '6.4';

        // 3. Destello de animación en los campos
        const allInputs = document.querySelectorAll('#bio-form input, #bio-form select');
        allInputs.forEach(input => {
            input.classList.remove('input-highlight-pulse');
            void input.offsetWidth;
            input.classList.add('input-highlight-pulse');
        });

        showToast('🧪 Caso de prueba completo inyectado. Calculando...', 'success');

        // 4. Disparar el análisis automáticamente
        const form = document.getElementById('bio-form');
        if (form) {
            form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true }));
        }
    });
}

function initSystemMenuListeners() {
    // Listeners para módulos del sistema y perfil
    const stockBtn = document.getElementById('nav-stock-btn');
    if (stockBtn) {
        stockBtn.addEventListener('click', () => {
            showToast('📦 Módulo de Stock Control en desarrollo para VitaMetrix v2.0', 'info');
        });
    }

    const dropSettingsBtn = document.getElementById('dropdown-settings-btn');
    if (dropSettingsBtn) {
        dropSettingsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const configNav = document.getElementById('nav-settings-btn');
            if (configNav) configNav.click();
        });
    }

    const dropProfileBtn = document.getElementById('dropdown-profile-btn');
    if (dropProfileBtn) {
        dropProfileBtn.addEventListener('click', () => {
            const curName = localStorage.getItem('vm_user_name') || 'Dra. Audrey';
            const curTitle = localStorage.getItem('vm_user_title') || 'Manager / Especialista BIA';
            showToast(`👤 Usuario activo: ${curName} (${curTitle})`, 'info');
        });
    }

    const dropLogoutBtn = document.getElementById('dropdown-logout-btn');
    if (dropLogoutBtn) {
        dropLogoutBtn.addEventListener('click', () => {
            showToast('ℹ️ Modo Estación Clínica Local activo.', 'info');
        });
    }
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
        const res = await fetch('/api/appointments');
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
                clinicAppointments = data;
            } else {
                const todayStr = new Date().toISOString().split('T')[0];
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                const tomorrowStr = tomorrow.toISOString().split('T')[0];

                clinicAppointments = [
                    {
                        id: 'demo_1',
                        patient_name: 'Dra. Sofía Alarcón',
                        patient_phone: '+54 9 11 5544-2211',
                        patient_idp: '104829',
                        date: todayStr,
                        time: '09:30',
                        type: 'Control Trimestral',
                        status: 'confirmed',
                        notes: 'Ayuno de 2h, seguimiento deportivo'
                    },
                    {
                        id: 'demo_2',
                        patient_name: 'Carlos Mendoza',
                        patient_phone: '+54 9 11 8899-3322',
                        patient_idp: '104910',
                        date: todayStr,
                        time: '11:45',
                        type: 'Evaluación Inicial BIA',
                        status: 'pending',
                        notes: 'Primera consulta BIA, hidratación normal'
                    },
                    {
                        id: 'demo_3',
                        patient_name: 'Valentina Ruiz',
                        patient_phone: '+54 9 11 7722-1100',
                        patient_idp: '105022',
                        date: tomorrowStr,
                        time: '16:00',
                        type: 'Seguimiento Deportivo',
                        status: 'confirmed',
                        notes: 'Preparación competencia fitness'
                    }
                ];
            }
        }
    } catch (e) {
        console.error('Error fetching appointments:', e);
    }
}

function renderClinicCalendar() {
    const grid = document.getElementById('calendar-days-grid');
    const monthLabel = document.getElementById('cal-month-label');
    if (!grid || !monthLabel) return;

    const year = calCurrentDate.getFullYear();
    const month = calCurrentDate.getMonth();

    monthLabel.textContent = `${MONTH_NAMES_ES[month]} ${year}`;
    grid.replaceChildren();

    // First day of month (0 = Sunday, 1 = Monday...)
    const firstDay = new Date(year, month, 1);
    let startDayIndex = firstDay.getDay() - 1; // Convert to Monday = 0
    if (startDayIndex === -1) startDayIndex = 6; // Sunday

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = new Date().toISOString().split('T')[0];

    // Empty previous month padding cells
    for (let i = 0; i < startDayIndex; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'cal-day-cell empty-day';
        grid.appendChild(emptyCell);
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

        grid.appendChild(dayCell);
    }
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

    listContainer.replaceChildren();

    if (dayAppts.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'appt-empty-state';
        empty.innerHTML = `
            <span>☕ Sin citas programadas para este día.</span>
            <button type="button" class="btn-link-action" onclick="openNewAppointmentForDate('${calSelectedDateStr}')" style="font-size:0.78rem; margin-top:0.2rem;">
                + Agendar para este día
            </button>
        `;
        listContainer.appendChild(empty);
        return;
    }

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
                <h4 class="appt-patient-name">${appt.patient_name || 'Paciente'}</h4>
                <div class="appt-type-tag">${appt.type || 'Evaluación BIA'} ${appt.notes ? '• <em style="color:#64748b;">' + appt.notes + '</em>' : ''}</div>
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

        listContainer.appendChild(card);
    });
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
                    headers: { 'Content-Type': 'application/json' },
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
        const res = await fetch(`/api/appointments/${apptId}`, { method: 'DELETE' });
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
        const res = await fetch('/api/clients');
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
        const name = localStorage.getItem('vm_user_name') || 'Dra. Audrey';
        const title = localStorage.getItem('vm_user_title') || 'Manager / Especialista BIA';
        const clinic = localStorage.getItem('vm_clinic_name') || 'Centro Médico VitaMetrix';
        const unit = localStorage.getItem('vm_unit_weight') || 'kg';
        const pha = localStorage.getItem('vm_pha_optimal') || '6.0';
        const mp = localStorage.getItem('vm_pdf_mp') || 'MP: 45892 / MN: 1204';
        const phone = localStorage.getItem('vm_pdf_phone') || '+54 9 11 4455-6677';
        const logoUrl = localStorage.getItem('vm_pdf_logo_url') || 'https://ui-avatars.com/api/?name=VitaMetrix&background=00b4d8&color=fff';
        const disclaimer = localStorage.getItem('vm_pdf_disclaimer') || 'Consulte con su profesional de la salud antes de iniciar cualquier plan nutricional o de entrenamiento.';
        const address = localStorage.getItem('vm_clinic_address') || 'Av. Libertador 2450, Piso 3, CABA';
        const lat = localStorage.getItem('vm_clinic_lat') || '-34.6037';
        const lng = localStorage.getItem('vm_clinic_lng') || '-58.3816';
        const darkTheme = localStorage.getItem('vm_dark_theme') === 'true';

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val;
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
        if (logoPreview && logoUrl) logoPreview.src = logoUrl;
        setVal('cfg-pdf-disclaimer', disclaimer);
        setVal('cfg-clinic-address', address);
        setVal('cfg-clinic-lat', lat);
        setVal('cfg-clinic-lng', lng);

        if (themeToggle) {
            themeToggle.checked = darkTheme;
            applyThemeMode(darkTheme);
        }

        // Actualizar header UI
        const userInfo = document.querySelector('.user-info');
        if (userInfo) {
            userInfo.innerHTML = `<strong>${name}</strong><span>${title}</span>`;
        }
    };

    loadAllSettings();

    // Guardar todos los cambios
    if (btnSave) {
        btnSave.addEventListener('click', () => {
            const getVal = (id) => document.getElementById(id) ? document.getElementById(id).value.trim() : '';

            localStorage.setItem('vm_user_name', getVal('cfg-user-name'));
            localStorage.setItem('vm_user_title', getVal('cfg-user-title'));
            localStorage.setItem('vm_clinic_name', getVal('cfg-clinic-name'));
            localStorage.setItem('vm_unit_weight', document.getElementById('cfg-unit-weight') ? document.getElementById('cfg-unit-weight').value : 'kg');
            localStorage.setItem('vm_pha_optimal', getVal('cfg-pha-optimal'));
            localStorage.setItem('vm_pdf_mp', getVal('cfg-pdf-mp'));
            localStorage.setItem('vm_pdf_phone', getVal('cfg-pdf-phone'));
            localStorage.setItem('vm_pdf_logo_url', getVal('cfg-pdf-logo-url'));
            localStorage.setItem('vm_pdf_disclaimer', getVal('cfg-pdf-disclaimer'));
            localStorage.setItem('vm_clinic_address', getVal('cfg-clinic-address'));
            localStorage.setItem('vm_clinic_lat', getVal('cfg-clinic-lat'));
            localStorage.setItem('vm_clinic_lng', getVal('cfg-clinic-lng'));

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
function exportEvaluationsToCSV() {
    fetch('/api/evaluaciones')
        .then(res => res.json())
        .then(evals => {
            if (!evals || evals.length === 0) {
                showToast('⚠️ No hay evaluaciones en el historial para exportar.', 'info');
                return;
            }

            const headers = ['ID', 'Código', 'Fecha', 'IDP', 'Paciente', 'Peso_kg', 'Altura_cm', 'R_ohm', 'Xc_ohm', 'TRU_Score', 'Angulo_Fase', 'Estado'];
            const rows = evals.map(ev => [
                ev.id || '',
                ev.code || '',
                ev.timestamp || '',
                ev.idp || '',
                `"${(ev.patient_name || '').replace(/"/g, '""')}"`,
                ev.weight || '',
                ev.height || '',
                ev.r_ohm || '',
                ev.xc_ohm || '',
                ev.tru_score || '',
                ev.phase_angle || '',
                `"${(ev.cellular_status || '').replace(/"/g, '""')}"`
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
        })
        .catch(() => {
            showToast('⚠️ Error al consultar el historial para exportar.', 'error');
        });
}

// Respaldo JSON
function exportBackupJSON() {
    fetch('/api/evaluaciones')
        .then(res => res.json())
        .then(evals => {
            const backupData = {
                app: 'VitaMetrix',
                version: '2.0',
                backup_date: new Date().toISOString(),
                settings: {
                    user_name: localStorage.getItem('vm_user_name') || 'Dra. Audrey',
                    user_title: localStorage.getItem('vm_user_title') || 'Manager / Especialista BIA',
                    clinic_name: localStorage.getItem('vm_clinic_name') || 'Centro Médico VitaMetrix',
                    clinic_address: localStorage.getItem('vm_clinic_address') || '',
                    clinic_lat: localStorage.getItem('vm_clinic_lat') || '',
                    clinic_lng: localStorage.getItem('vm_clinic_lng') || ''
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
        });
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
