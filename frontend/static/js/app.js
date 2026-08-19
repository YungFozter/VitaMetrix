document.addEventListener('DOMContentLoaded', () => {
    initDemoDataInjector();
    initFieldInfoPopups();
    initMobileSidebar();
    initClock();
    initNavigation();
    initBioForm();
    initClients();
    initProfileDropdown();
    fetchDashboardStats();
});

// --- 0. TOASTS & MODALS ---
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if(!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Icon
    let icon = 'ℹ️';
    if(type === 'success') icon = '✅';
    if(type === 'error') icon = '❌';
    
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

function showConfirm(title, message, onConfirm) {
    const modal = document.getElementById('custom-modal');
    if(!modal) return;
    
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-message').textContent = message;
    
    const btnCancel = document.getElementById('modal-btn-cancel');
    const btnConfirm = document.getElementById('modal-btn-confirm');
    
    // Reset listeners by cloning
    const newCancel = btnCancel.cloneNode(true);
    const newConfirm = btnConfirm.cloneNode(true);
    btnCancel.parentNode.replaceChild(newCancel, btnCancel);
    btnConfirm.parentNode.replaceChild(newConfirm, btnConfirm);
    
    const closeModal = () => modal.classList.add('hidden');
    
    newCancel.addEventListener('click', closeModal);
    newConfirm.addEventListener('click', () => {
        closeModal();
        onConfirm();
    });
    
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
    
    if(profileBtn && dropdown) {
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
                    td.colSpan = 4;
                    td.style.textAlign = 'center';
                    td.style.padding = '2rem';
                    td.textContent = 'No hay evaluaciones recientes.';
                    tr.appendChild(td);
                    tbody.appendChild(tr);
                } else {
                    recent.forEach(e => {
                        const tr = document.createElement('tr');
                        const tdName = document.createElement('td');
                        tdName.style.fontWeight = '600';
                        tdName.textContent = e.name || 'Unknown';
                        const tdDate = document.createElement('td');
                        tdDate.textContent = e.date || '';
                        const tdScore = document.createElement('td');
                        const badge = document.createElement('span');
                        badge.className = 'code-badge';
                        badge.style.background = 'rgba(45,122,74,0.1)';
                        badge.style.color = '#2d7a4a';
                        badge.textContent = `${e.score ?? 0} pts`;
                        tdScore.appendChild(badge);
                        const tdPhase = document.createElement('td');
                        tdPhase.textContent = `${e.phase_angle ?? '--'}°`;
                        tr.append(tdName, tdDate, tdScore, tdPhase);
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
    // 1. Valores numéricos base
    document.getElementById('global-score').textContent = data.score;
    document.getElementById('rank-badge').textContent = data.rank;
    
    // Circular Gauges for Muscle and Fat
    const muscleGauge = document.getElementById('muscle-gauge');
    const fatGauge = document.getElementById('fat-gauge');
    if (muscleGauge) {
        muscleGauge.style.setProperty('--muscle-pct', `${data.muscle_score}%`);
        document.getElementById('muscle-score').textContent = data.muscle_score;
    }
    if (fatGauge) {
        fatGauge.style.setProperty('--fat-pct', `${data.fat_score}%`);
        document.getElementById('fat-score').textContent = data.fat_score;
    }

    document.getElementById('res-value').textContent = inputs.resistance;
    document.getElementById('xc-value').textContent = inputs.reactance;
    document.getElementById('phase-value').textContent = data.phase_angle;

    document.getElementById('ree-value').textContent = data.ree_kcal;
    document.getElementById('tee-value').textContent = data.tee_kcal;
    
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
        { key: 'p5',  color: 'rgba(185,74,74,0.5)' },
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
        { from: 1.2, to: 1.4,  color: '#E65555' }, // Sedentario (Rojo vibrante)
        { from: 1.4, to: 1.6,  color: '#F2994A' }, // Ligero (Naranja vibrante)
        { from: 1.6, to: 1.9,  color: '#27AE60' }, // Moderado (Verde vibrante)
        { from: 1.9, to: 2.5,  color: '#5A6F8C' }  // Intenso (Azul pizarra)
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
        if(h3) h3.textContent = 'Registrar Cliente';
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
        } catch(err) {
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
    if(!tbody) return;
    
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
            const btnEdit = document.createElement('button');
            btnEdit.className = 'btn-edit';
            btnEdit.textContent = 'Editar';
            btnEdit.addEventListener('click', () => editClient(c.id, c.name || '', c.phone || '', c.email || ''));
            const btnDel = document.createElement('button');
            btnDel.className = 'btn-danger';
            btnDel.textContent = 'Eliminar';
            btnDel.addEventListener('click', () => deleteClient(c.id));
            tdActions.append(btnEdit, btnDel);

            tr.append(tdCode, tdName, tdContact, tdActions);
            tbody.appendChild(tr);
        });
    } catch(err) {
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
                if(result.success) {
                    showToast('Cliente eliminado correctamente', 'success');
                    fetchClients();
                } else {
                    showToast('Error al eliminar: ' + result.error, 'error');
                }
            } catch(err) {
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
    if(h3) h3.textContent = 'Editar Cliente';
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
        { key: 'p5',  color: 'rgba(185,74,74,0.5)' },
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
