document.addEventListener('DOMContentLoaded', () => {
    fetchDataAndRender();
});

async function fetchDataAndRender() {
    try {
        const response = await fetch('/api/dashboard-data');
        const data = await response.json();

        // 1. Actualizar valores numéricos en el DOM
        document.getElementById('global-score').textContent = data.score;
        document.getElementById('rank-badge').textContent = data.rank;
        document.getElementById('muscle-score').textContent = data.muscle_score;
        document.getElementById('fat-score').textContent = data.fat_score;
        document.getElementById('res-value').textContent = data.resistance;
        document.getElementById('xc-value').textContent = data.reactance;
        document.getElementById('phase-value').textContent = data.phase_angle;
        document.getElementById('ree-value').innerHTML = `${data.ree_kcal} <small>kcal</small>`;
        document.getElementById('tee-value').innerHTML = `${data.tee_kcal} <small>kcal</small>`;
        document.getElementById('pal-value').textContent = data.pal;

        // 2. Actualizar barras de progreso (Muscle y Fat)
        document.querySelector('.muscle-bar').style.width = `${data.muscle_score}%`;
        document.querySelector('.fat-bar').style.width = `${data.fat_score}%`;

        // 3. Interpretación Clínica
        const clinicalText = document.getElementById('clinical-text');
        clinicalText.innerHTML = `
            <strong>Análisis integral:</strong> Composición corporal excelente (${data.score}/100). 
            Ángulo de fase en ${data.phase_angle}° indica ${data.cell_status}. 
            Grasa baja (${data.fat_score} pts) y Músculo alto (${data.muscle_score} pts).
        `;
        document.getElementById('hydration-tag').textContent = `💧 ${data.hydration_status}`;

        // 4. Dibujar el gráfico BIVA en Canvas
        drawBIVAVector(data.resistance, data.reactance);

    } catch (error) {
        console.error('Error cargando datos:', error);
        document.body.innerHTML = '<h2 style="color:red;">Error de conexión con el servidor. ¿Flask está corriendo?</h2>';
    }
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
    ctx.fillText('R (Resistencia)', w - 70, centerY - 10);
    ctx.fillText('Xc (Reactancia)', centerX + 10, 20);

    // --- Escalar los datos para que quepan en el canvas (R normalizado entre 300 y 800) ---
    // Usamos un factor de escala. Asumimos Rango R: 200 a 800, Xc: 10 a 100.
    const scaleR = (R - 200) / 600; // 0 a 1
    const scaleXc = (Xc - 10) / 90; // 0 a 1

    // Posición en píxeles (invertimos Y porque Canvas Y va hacia abajo)
    const pixelX = 40 + scaleR * (w - 80);
    const pixelY = (h - 40) - scaleXc * (h - 80); // Invertido

    // --- Dibujar el punto vectorial ---
    // Línea desde el centro (0,0) hasta el punto
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

    // Etiqueta del punto
    ctx.fillStyle = '#1A2A4A';
    ctx.font = 'bold 11px Inter';
    ctx.fillText(`(${R}, ${Xc})`, pixelX + 12, pixelY - 8);

    // Zonas de referencia (Elipses BIVA simplificadas)
    ctx.strokeStyle = 'rgba(26, 42, 74, 0.1)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 6]);
    // Elipse 1 (Normal)
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, 70, 50, 0, 0, 2 * Math.PI);
    ctx.stroke();
    // Elipse 2 (Atleta)
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, 100, 70, 0, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.setLineDash([]);
}