document.addEventListener('DOMContentLoaded', () => {
    initClock();
    initNavigation();
    initBioForm();
    initClients();
    fetchDashboardStats();
});

// --- 1. CLOCK ---
function initClock() {
    const timeElement = document.getElementById('current-time');
    setInterval(() => {
        const now = new Date();
        timeElement.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }, 1000);
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
            pal: parseFloat(document.getElementById('input-pal').value)
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
            alert("Evaluación guardada en la nube con éxito.");
            
            // Refrescar stats del dashboard
            fetchDashboardStats();

        } catch (error) {
            console.error('Error calculating:', error);
            alert('Error al conectar con el servidor.');
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    });
}

async function fetchDashboardStats() {
    try {
        const response = await fetch('/api/dashboard-stats');
        if (response.ok) {
            const data = await response.json();
            // Actualizar tarjetas del dashboard (asumiendo orden en el DOM)
            const values = document.querySelectorAll('.dash-value');
            if(values.length >= 2) {
                values[0].textContent = data.total_patients;
                values[1].textContent = data.total_evaluations;
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

    // 3. Interpretación Clínica
    const clinicalText = document.getElementById('clinical-text');
    clinicalText.innerHTML = `
        <strong>Análisis integral:</strong> La puntuación global es de ${data.score}/100. 
        El ángulo de fase en ${data.phase_angle}° indica ${data.cell_status.toLowerCase()}. 
        Puntuación de masa muscular: ${data.muscle_score} pts. 
        Puntuación de masa grasa: ${data.fat_score} pts.
    `;
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
function initClients() {
    const form = document.getElementById('client-form');
    if (!form) return;

    // Cargar tabla inicial
    fetchClients();

    // Guardar nuevo cliente
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = form.querySelector('button');
        const originalText = btn.textContent;
        btn.textContent = 'Guardando...';
        btn.disabled = true;

        const payload = {
            name: document.getElementById('new-client-name').value,
            phone: document.getElementById('new-client-phone').value,
            email: document.getElementById('new-client-email').value
        };

        try {
            const res = await fetch('/api/clients', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await res.json();
            if(result.success) {
                form.reset();
                fetchClients(); // recargar tabla
                alert('Cliente guardado exitosamente con el código ' + result.data.code);
            } else {
                alert('Error al guardar: ' + result.error);
            }
        } catch(err) {
            console.error(err);
            alert('Error de conexión.');
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
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

async function deleteClient(id) {
    if(!confirm('¿Estás seguro de que deseas eliminar este cliente? Su código será reasignado al próximo cliente nuevo.')) return;
    
    try {
        const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' });
        const result = await res.json();
        if(result.success) {
            fetchClients();
        } else {
            alert('Error al eliminar: ' + result.error);
        }
    } catch(err) {
        console.error(err);
    }
}