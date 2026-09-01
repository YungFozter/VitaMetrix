// ============================================================
// VITAMETRIX - MÓDULO 05: CALCULADORA BIA, GRÁFICOS Y REPORTE PDF
// Archivo: frontend/static/js/modules/bioimpedancia.js
// ============================================================

function getBioFormPayload() {
    return {
        patient_idp: document.getElementById('input-idp').value,
        patient_name: document.getElementById('input-name').value,
        resistance: parseFloat(document.getElementById('input-r').value),
        reactance: parseFloat(document.getElementById('input-xc').value),
        weight: parseFloat(document.getElementById('input-weight').value),
        height: parseFloat(document.getElementById('input-height').value),
        age: parseInt(document.getElementById('input-age').value),
        gender: document.getElementById('input-gender').value,
        pal: parseFloat(document.getElementById('input-pal').value),
        smm: document.getElementById('input-smm').value || null,
        tbw: document.getElementById('input-tbw').value || null,
        ecw: document.getElementById('input-ecw').value || null,
        fat_mass: document.getElementById('input-fat-mass').value || null,
        visceral_fat: document.getElementById('input-visceral').value || null,
        waist: document.getElementById('input-waist').value || null,
        phase_angle_dev: document.getElementById('input-phase-dev').value || null,
        seg_arm_r: document.getElementById('input-seg-arm-r').value || null,
        seg_arm_l: document.getElementById('input-seg-arm-l').value || null,
        seg_torso: document.getElementById('input-seg-torso').value || null,
        seg_leg_r: document.getElementById('input-seg-leg-r').value || null,
        seg_leg_l: document.getElementById('input-seg-leg-l').value || null,
        doctor_notes: document.getElementById('doctor-notes-input') ? document.getElementById('doctor-notes-input').value.trim() : ''
    };
}

function validateBioPayload(payload) {
    if (isNaN(payload.resistance) || payload.resistance < 100 || payload.resistance > 1500) {
        showToast('Resistencia (R) fuera de rango válido (100 - 1500 Ω)', 'error');
        return false;
    }
    if (isNaN(payload.reactance) || payload.reactance < 10 || payload.reactance > 200) {
        showToast('Reactancia (Xc) fuera de rango válido (10 - 200 Ω)', 'error');
        return false;
    }
    if (isNaN(payload.weight) || payload.weight < 20 || payload.weight > 350) {
        showToast('Peso fuera de rango válido (20 - 350 kg)', 'error');
        return false;
    }
    if (isNaN(payload.height) || payload.height < 50 || payload.height > 250) {
        showToast('Altura fuera de rango válido (50 - 250 cm)', 'error');
        return false;
    }
    if (isNaN(payload.age) || payload.age < 1 || payload.age > 120) {
        showToast('Edad fuera de rango válido (1 - 120 años)', 'error');
        return false;
    }
    return true;
}

function initBioForm() {
    const form = document.getElementById('bio-form');
    if (!form) return;

    const docNotesInput = document.getElementById('doctor-notes-input');
    if (docNotesInput) {
        docNotesInput.addEventListener('input', () => {
            docNotesInput.dataset.autoFilled = 'false';
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const btn = document.getElementById('btn-analyze-submit') || form.querySelector('button[type="submit"]');
        let originalText = btn ? btn.innerHTML : 'Analizar Composición';
        if (btn) {
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span> Calculando...';
            btn.disabled = true;
        }

        const payload = getBioFormPayload();
        payload.save = false;

        if (!validateBioPayload(payload)) {
            if (btn) { btn.innerHTML = originalText; btn.disabled = false; }
            return;
        }

        try {
            const response = await fetch('/api/dashboard-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Error en el análisis');
            }

            updateBioUI(data, payload);
            showToast("⚡ Análisis completado. Puedes revisarlo o hacer clic en 'Guardar Análisis'.", "info");

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

    const btnSave = document.getElementById('btn-save-evaluation');
    if (btnSave) {
        btnSave.addEventListener('click', async () => {
            const originalHtml = btnSave.innerHTML;
            btnSave.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span> Guardando...';
            btnSave.disabled = true;

            const payload = getBioFormPayload();
            payload.save = true;

            if (!validateBioPayload(payload)) {
                btnSave.innerHTML = originalHtml;
                btnSave.disabled = false;
                return;
            }

            try {
                const response = await fetch('/api/dashboard-data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                    body: JSON.stringify(payload)
                });

                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || 'Error al guardar la evaluación');
                }

                updateBioUI(data, payload);
                if (data.saved) {
                    showToast("💾 Evaluación guardada en el historial clínico con éxito.", "success");
                    if (typeof fetchDashboardStats === 'function') fetchDashboardStats();
                    if (typeof fetchEvaluaciones === 'function') fetchEvaluaciones();
                    if (typeof fetchClients === 'function') fetchClients();
                } else {
                    showToast("Análisis listo, pero no se pudo persistir en la nube.", "warning");
                }

            } catch (error) {
                console.error('Error saving evaluation:', error);
                showToast('Error al guardar en el servidor.', 'error');
            } finally {
                btnSave.innerHTML = originalHtml;
                btnSave.disabled = false;
            }
        });
    }

    const btnPrintReport = document.getElementById('btn-print-report');
    if (btnPrintReport) {
        btnPrintReport.addEventListener('click', printBIAReport);
    }
}

function printBIAReport() {
    window.print();
}

function initBioClientAutocomplete() {
    const inputName = document.getElementById('input-name');
    const inputIdp = document.getElementById('input-idp');

    function populateDatalists() {
        const datalistName = document.getElementById('clients-name-datalist');
        const datalistAppt = document.getElementById('clients-datalist');

        if (datalistName) datalistName.innerHTML = '';
        if (datalistAppt) datalistAppt.innerHTML = '';

        if (typeof allClientsData !== 'undefined') {
            allClientsData.forEach(c => {
                if (c.name) {
                    if (datalistName) {
                        const opt = document.createElement('option');
                        opt.value = c.name;
                        opt.textContent = `${c.name} ${c.idp ? '(IDP: ' + c.idp + ')' : ''}`;
                        datalistName.appendChild(opt);
                    }
                    if (datalistAppt) {
                        const opt = document.createElement('option');
                        opt.value = c.name;
                        datalistAppt.appendChild(opt);
                    }
                }
            });
        }

        updateBioIDPField();
    }

    function updateBioIDPField() {
        if (!inputIdp) return;
        const currentName = (inputName ? inputName.value.trim().toLowerCase() : '');
        if (!currentName) {
            inputIdp.value = getNextAvailableIDP();
            return;
        }
        const match = typeof allClientsData !== 'undefined' ? allClientsData.find(c => (c.name || '').toLowerCase() === currentName) : null;
        if (match) {
            inputIdp.value = match.idp || ('IDP-' + String(match.code || 1).padStart(4, '0'));
        } else {
            inputIdp.value = getNextAvailableIDP();
        }
    }

    if (inputName) {
        inputName.addEventListener('input', () => {
            updateBioIDPField();
        });

        inputName.addEventListener('change', () => {
            const val = inputName.value.trim().toLowerCase();
            if (!val) {
                if (inputIdp) inputIdp.value = getNextAvailableIDP();
                return;
            }
            const match = typeof allClientsData !== 'undefined' ? allClientsData.find(c => (c.name || '').toLowerCase() === val) : null;
            if (match) {
                fillBioFormFromClient(match);
                showToast(`Datos de ${match.name} completados automáticamente (${match.idp || 'IDP auto'})`, 'info');
            } else {
                updateBioIDPField();
            }
        });
    }

    updateBioIDPField();

    window.updateBioDatalists = populateDatalists;
    window.getNextAvailableIDP = getNextAvailableIDP;
}

function getNextAvailableIDP() {
    if (typeof allClientsData === 'undefined' || !allClientsData || allClientsData.length === 0) {
        return 'IDP-0001';
    }
    const existingCodes = allClientsData
        .map(c => {
            if (c.code) return parseInt(c.code);
            if (c.idp && c.idp.startsWith('IDP-')) return parseInt(c.idp.replace('IDP-', ''));
            return null;
        })
        .filter(n => typeof n === 'number' && !isNaN(n) && n > 0)
        .sort((a, b) => a - b);

    let nextCode = 1;
    for (const code of existingCodes) {
        if (code === nextCode) {
            nextCode++;
        } else if (code > nextCode) {
            break;
        }
    }
    return `IDP-${String(nextCode).padStart(4, '0')}`;
}

function fillBioFormFromClient(c) {
    const nextIdp = c.idp || ('IDP-' + String(c.code || 1).padStart(4, '0'));
    if (document.getElementById('input-idp')) document.getElementById('input-idp').value = nextIdp;
    if (c.name && document.getElementById('input-name')) document.getElementById('input-name').value = c.name;
    if (c.age && document.getElementById('input-age')) document.getElementById('input-age').value = c.age;
    if (c.gender && document.getElementById('input-gender')) {
        const gVal = (c.gender === 'Femenino' || c.gender === 'female') ? 'female' : 'male';
        document.getElementById('input-gender').value = gVal;
    }
    if (c.height && document.getElementById('input-height')) document.getElementById('input-height').value = c.height;
}
