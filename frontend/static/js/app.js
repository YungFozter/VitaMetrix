document.addEventListener('DOMContentLoaded', () => {
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
    setInterval(() => {
        const now = new Date();
        timeElement.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }, 1000);
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
            
            // Update UI
            updateBioUI(data, payload);
            showToast("Evaluación guardada en la nube con éxito.", "success");
            
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
            document.getElementById('dash-total-clients').textContent = data.total_clients;
            document.getElementById('dash-total-evals').textContent = data.total_evaluations;
            document.getElementById('dash-avg-score').textContent = data.avg_score;
            
            // 2. Update Recent Table
            const tbody = document.getElementById('dash-recent-tbody');
            if (tbody) {
                if (data.recent.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 2rem;">No hay evaluaciones recientes.</td></tr>';
                } else {
                    tbody.innerHTML = '';
                    data.recent.forEach(e => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td style="font-weight: 600;">${e.name}</td>
                            <td>${e.date}</td>
                            <td><span class="code-badge" style="background: rgba(45,122,74,0.1); color: #2d7a4a;">${e.score} pts</span></td>
                            <td>${e.phase_angle}°</td>
                        `;
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
    document.getElementById('muscle-score').textContent = data.muscle_score;
    document.getElementById('fat-score').textContent = data.fat_score;

    document.getElementById('res-value').textContent = inputs.resistance;
    document.getElementById('xc-value').textContent = inputs.reactance;
    document.getElementById('phase-value').textContent = data.phase_angle;

    document.getElementById('ree-value').innerHTML = `${data.ree_kcal} <small>kcal</small>`;
    document.getElementById('tee-value').innerHTML = `${data.tee_kcal} <small>kcal</small>`;
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
        palZoneEl.style.color = (p >= 1.9) ? '#1A2A4A' : (p >= 1.6 ? '#2d7a4a' : (p >= 1.4 ? '#cd7f32' : '#b94a4a'));
    }

    // 2. Barras de progreso (Muscle y Fat)
    document.querySelector('.muscle-bar').style.width = `${data.muscle_score}%`;
    document.querySelector('.fat-bar').style.width = `${data.fat_score}%`;

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

    // --- Dibujar ejes ---
    ctx.strokeStyle = '#c0c8d8';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    // Eje X (Resistencia)
    ctx.beginPath();
    ctx.moveTo(20, centerY);
    ctx.lineTo(w - 20, centerY);
    ctx.stroke();
    // Eje Y (Reactancia)
    ctx.beginPath();
    ctx.moveTo(centerX, 20);
    ctx.lineTo(centerX, h - 20);
    ctx.stroke();
    ctx.setLineDash([]);

    // --- Normalización por altura (manual Módulo 1) ---
    const hM = (height || 170) / 100.0;
    const rH = R / hM;
    const xcH = Xc / hM;
    const MIN_RH = 200, MAX_RH = 600;   // eje horizontal (Ohm/m)
    const MIN_XCH = 20,  MAX_XCH = 100; // eje vertical (Ohm/m)
    const pad = 18;
    const plotW = w - 2 * pad;
    const plotH = h - 2 * pad;
    const toX = (val) => pad + ((val - MIN_RH) / (MAX_RH - MIN_RH)) * plotW;
    const toY = (val) => (h - pad) - ((val - MIN_XCH) / (MAX_XCH - MIN_XCH)) * plotH;

    // Etiquetas de ejes (después de definir pad/center para no romper el render)
    ctx.fillStyle = '#5a6a82';
    ctx.font = '10px Inter';
    ctx.fillText('R/H →', w - 42, centerY - 5);
    ctx.fillText('↑ Xc/H', centerX + 5, pad + 8);

    function ellipse(cx, cy, rxRh, ryXcH, color) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 5]);
        ctx.beginPath();
        ctx.ellipse(
            toX(cx), toY(cy),
            (rxRh / (MAX_RH - MIN_RH)) * plotW,
            (ryXcH / (MAX_XCH - MIN_XCH)) * plotH,
            0, 0, 2 * Math.PI
        );
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }
    ellipse(380, 55, 90, 22, 'rgba(45,122,74,0.55)');  // Población normal
    ellipse(300, 72, 70, 18, 'rgba(205,127,50,0.6)');  // Atletas

    // --- Punto vectorial del paciente ---
    const px = toX(rH);
    const py = toY(xcH);
    ctx.beginPath();
    ctx.moveTo(pad, h - pad);
    ctx.lineTo(px, py);
    ctx.strokeStyle = '#1A2A4A';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(px, py, 8, 0, 2 * Math.PI);
    ctx.fillStyle = '#b94a4a';
    ctx.shadowColor = 'rgba(185, 74, 74, 0.4)';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
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

    const cx = w / 2, cy = h - 12;
    const radius = Math.min(w / 2, h) - 14;
    const START = Math.PI * 0.85;   // arranque del arco
    const END = Math.PI * 2.15;     // fin del arco (semicírculo sesgado)
    const ANG = END - START;

    const PAL_MIN = 1.2, PAL_MAX = 2.5;
    const clamp = (v) => Math.max(PAL_MIN, Math.min(PAL_MAX, v || PAL_MIN));
    const angOf = (v) => START + ((clamp(v) - PAL_MIN) / (PAL_MAX - PAL_MIN)) * ANG;

    // Zonas de color (Sedentario / Ligero / Moderado / Intenso)
    const zones = [
        { from: 1.2, to: 1.4,  color: 'rgba(185,74,74,0.35)' },
        { from: 1.4, to: 1.6,  color: 'rgba(205,127,50,0.4)' },
        { from: 1.6, to: 1.9,  color: 'rgba(45,122,74,0.4)' },
        { from: 1.9, to: 2.5,  color: 'rgba(26,42,74,0.45)' }
    ];
    zones.forEach(z => {
        ctx.beginPath();
        ctx.arc(cx, cy, radius, angOf(z.from), angOf(z.to));
        ctx.strokeStyle = z.color;
        ctx.lineWidth = 12;
        ctx.stroke();
    });

    // Arco base tenue
    ctx.beginPath();
    ctx.arc(cx, cy, radius, START, END);
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 12;
    ctx.stroke();

    // Aguja
    const ang = angOf(pal);
    const nx = cx + Math.cos(ang) * (radius - 6);
    const ny = cy + Math.sin(ang) * (radius - 6);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(nx, ny);
    ctx.strokeStyle = '#1A2A4A';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, 2 * Math.PI);
    ctx.fillStyle = '#1A2A4A';
    ctx.fill();

    // Etiqueta de valor
    ctx.fillStyle = '#1A2A4A';
    ctx.font = 'bold 16px Inter';
    ctx.textAlign = 'center';
    ctx.fillText((pal || '--').toString(), cx, cy - 8);
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
            if(result.success) {
                btnCancel.click(); // Resetear formulario y modo
                fetchClients(); // recargar tabla
                showToast(editingClientId ? 'Cliente actualizado exitosamente' : 'Cliente guardado con el código ' + result.data.code, 'success');
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
        
        if(!clients || clients.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 2rem; color: #7a8aa0;">No hay clientes registrados.</td></tr>';
            return;
        }
        
        tbody.innerHTML = '';
        clients.forEach(c => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span class="code-badge">ID-${c.code.toString().padStart(4, '0')}</span></td>
                <td style="font-weight: 600;">${c.name}</td>
                <td>
                    ${c.phone ? '📞 ' + c.phone + '<br>' : ''}
                    ${c.email ? '📧 ' + c.email : ''}
                </td>
                <td>
                    <button class="btn-edit" onclick="editClient('${c.id}', '${c.name.replace(/'/g, "\\'")}', '${(c.phone||'').replace(/'/g, "\\'")}', '${(c.email||'').replace(/'/g, "\\'")}')">Editar</button>
                    <button class="btn-danger" onclick="deleteClient('${c.id}')">Eliminar</button>
                </td>
            `;
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
    if (!canvas || window.bccChartInstance) {
        if(window.bccChartInstance) window.bccChartInstance.destroy();
    }
    if (!canvas) return;

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
            },
            // Añadir una línea diagonal base dibujada como plugin
            plugins: [{
                id: 'bccDiagonal',
                beforeDraw: (chart) => {
                    const ctx = chart.ctx;
                    const xAxis = chart.scales.x;
                    const yAxis = chart.scales.y;
                    ctx.save();
                    ctx.strokeStyle = '#cd7f32'; // Línea bronce/dorada
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    // Diagonal simple cruzando desde el mínimo de X y maximo de Y, hasta maximo de X y mínimo de Y
                    ctx.moveTo(xAxis.getPixelForValue(xAxis.min), yAxis.getPixelForValue(yAxis.max));
                    ctx.lineTo(xAxis.getPixelForValue(xAxis.max), yAxis.getPixelForValue(yAxis.min));
                    ctx.stroke();
                    ctx.restore();
                }
            }]
        }
    });
}