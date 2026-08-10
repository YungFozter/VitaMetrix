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
        const btn = form.querySelector('button[type="submit"]');
        const originalText = btn.textContent;
        btn.textContent = 'Calculando...';
        btn.disabled = true;

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
            const response = await fetch('/api/calculate', {
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
            btn.textContent = originalText;
            btn.disabled = false;
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

function updateBioUI(data, inputs) {
    // 1. Valores numéricos
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

    // 2. Barras de progreso (Muscle y Fat)
    document.querySelector('.muscle-bar').style.width = `${data.muscle_score}%`;
    document.querySelector('.fat-bar').style.width = `${data.fat_score}%`;

    // 3b. Hallazgos clínicos (motor de reglas) + hidratación/visceral
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

    // 4. Dibujar el gráfico BIVA en Canvas
    drawBIVAVector(inputs.resistance, inputs.reactance);
}

function drawBIVAVector(R, Xc) {
    const canvas = document.getElementById('bivaCanvas');
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
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

    // Etiquetas de ejes
    ctx.fillStyle = '#5a6a82';
    ctx.font = '10px Inter';
    ctx.fillText('R', w - 15, centerY - 5);
    ctx.fillText('Xc', centerX + 5, 20);

    // --- Escalar los datos para que quepan en el canvas ---
    // Simulamos un rango donde el centro (centerX, centerY) es (400, 40)
    const scaleR = (R - 400) / 400; // Si R=600 -> 0.5
    const scaleXc = (Xc - 40) / 40; // Si Xc=60 -> 0.5

    const pixelX = centerX + (scaleR * (w / 2 - 20));
    const pixelY = centerY - (scaleXc * (h / 2 - 20)); // Invertido porque Y va hacia abajo

    // --- Dibujar el punto vectorial ---
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(pixelX, pixelY);
    ctx.strokeStyle = '#1A2A4A';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Círculo en el punto
    ctx.beginPath();
    ctx.arc(pixelX, pixelY, 8, 0, 2 * Math.PI);
    ctx.fillStyle = '#b94a4a';
    ctx.shadowColor = 'rgba(185, 74, 74, 0.4)';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Zonas de referencia (Elipses BIVA simplificadas)
    ctx.strokeStyle = 'rgba(26, 42, 74, 0.1)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 6]);
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, 70, 50, 0, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, 100, 70, 0, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.setLineDash([]);
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