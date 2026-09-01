// ============================================================
// VITAMETRIX - MÓDULO 02: GESTIÓN DE SUSCRIPCIONES Y LICENCIAS SAAS
// Archivo: frontend/static/js/modules/subscriptions.js
// ============================================================

async function fetchSubscriptionStatus() {
    try {
        const res = await fetch('/api/subscription/status', { headers: getAuthHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        if (!data.success) return;

        const sub = data.subscription;
        const user = data.user;
        const wa = data.whatsapp;

        const headerBadge = document.getElementById('sub-header-badge');
        const statusPill = document.getElementById('sub-status-pill');
        const statusDot = document.getElementById('sub-status-dot');
        const statusPillText = document.getElementById('sub-status-pill-text');
        const planTitle = document.getElementById('sub-plan-title');
        const planDesc = document.getElementById('sub-plan-desc');
        const daysText = document.getElementById('sub-days-text');
        const progressBar = document.getElementById('sub-progress-bar');
        const expiryDate = document.getElementById('sub-expiry-date');
        const userId = document.getElementById('sub-user-id');
        const userName = document.getElementById('sub-user-name');
        const userEmail = document.getElementById('sub-user-email');
        const clinicBadge = document.getElementById('sub-clinic-badge');
        const waBtn = document.getElementById('btn-whatsapp-sub-contact');
        const watermarkIcon = document.getElementById('sub-watermark-icon');
        const alertBanner = document.getElementById('sub-renewal-alert-banner');
        const alertMsg = document.getElementById('sub-renewal-alert-msg');

        if (user.role === 'admin') {
            if (planTitle) planTitle.textContent = 'Acceso Total SuperAdmin / Incaducable ⭐';
            if (planDesc) planDesc.textContent = 'Privilegios maestros de administración central, incaducable y sin límites de uso.';
            if (daysText) daysText.innerHTML = '<span class="text-primary fw-bold">Incaducable / Permanente</span>';
            if (expiryDate) expiryDate.textContent = 'Sin Vencimiento (Acceso Master)';
            if (watermarkIcon) {
                watermarkIcon.className = 'bi bi-shield-shaded';
                watermarkIcon.style.color = '#8b5cf6';
            }
            if (progressBar) {
                progressBar.style.width = '100%';
                progressBar.style.background = 'linear-gradient(90deg, #8b5cf6 0%, #6366f1 100%)';
                progressBar.className = 'progress-bar';
            }
            if (statusPill) {
                statusPill.className = 'badge px-3 py-1.5 rounded-pill fs-7 fw-bold d-inline-flex align-items-center gap-1.5 shadow-2xs bg-purple text-white';
                if (statusDot) statusDot.style.background = '#e9d5ff';
                if (statusPillText) statusPillText.textContent = '👑 SuperAdmin Master';
            }
            if (headerBadge) {
                headerBadge.innerHTML = `<i class="bi bi-shield-lock-fill text-primary me-1"></i> Cuenta Master: <strong>Acceso Total e Incaducable</strong>`;
            }
            if (alertBanner) alertBanner.classList.add('d-none');
        } else {
            const isLifetime = sub.status === 'lifetime';
            const isNeverSubscribed = sub.status === 'no_subscription' || (!sub.expires_at && !isLifetime) || sub.plan_name === 'Sin Suscripción Anterior';
            const isTrial = sub.status === 'trial' && !isNeverSubscribed;
            const isExpired = (sub.status === 'expired' || (sub.days_left || 0) <= 0) && !isNeverSubscribed;
            const daysLeft = sub.days_left || 0;

            if (planTitle) {
                if (isLifetime) planTitle.textContent = 'Plan Vitalicio / Lifetime ⭐';
                else if (isNeverSubscribed) planTitle.textContent = 'Sin Suscripción Anterior';
                else if (isExpired) planTitle.textContent = 'Plan Vencido';
                else if (isTrial) planTitle.textContent = 'Plan de Prueba Gratuito (7 Días)';
                else planTitle.textContent = sub.plan_name || 'Plan Pro Mensual';
            }

            if (planDesc) {
                if (isNeverSubscribed) {
                    planDesc.textContent = 'Esta cuenta aún no ha activado una suscripción. Ingresa tu clave de activación (PIN) o comunícate por WhatsApp para habilitar todos los módulos clínicos de VitaMetrix.';
                } else if (isExpired) {
                    planDesc.textContent = 'Tu suscripción ha caducado. Renueva tu licencia o canjea un PIN para continuar disfrutando de todas las herramientas clínicas.';
                } else if (isTrial) {
                    planDesc.textContent = 'Disfruta de acceso completo a los módulos clínicos, stock y reportes de VitaMetrix durante tus 7 días de cortesía.';
                } else {
                    planDesc.textContent = 'Acceso completo a todos los módulos clínicos, cálculo bioeléctrico BIA, inventario de insumos e informes médicos de VitaMetrix.';
                }
            }

            if (daysText) {
                if (isLifetime) {
                    daysText.innerHTML = '<span class="text-success fw-bold">Ilimitado</span>';
                } else if (isNeverSubscribed) {
                    daysText.innerHTML = '<span class="text-secondary fw-bold">0 días (Sin Suscripción Anterior)</span>';
                } else if (isExpired) {
                    daysText.innerHTML = '<span class="text-danger fw-extrabold">0 días (Suscripción Vencida)</span>';
                } else if (isTrial) {
                    daysText.innerHTML = `<span class="text-warning-emphasis fw-bold">${daysLeft} día${daysLeft === 1 ? '' : 's'} de prueba</span>`;
                } else {
                    daysText.innerHTML = `<span class="text-navy fw-bold">${daysLeft} día${daysLeft === 1 ? '' : 's'}</span>`;
                }
            }

            if (expiryDate) {
                if (isLifetime) {
                    expiryDate.textContent = 'Sin Vencimiento';
                } else if (isNeverSubscribed) {
                    expiryDate.textContent = 'Sin Suscripción Anterior';
                } else if (sub.expires_at) {
                    try {
                        const d = new Date(sub.expires_at);
                        expiryDate.textContent = d.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
                    } catch (e) {
                        expiryDate.textContent = sub.expires_at;
                    }
                } else {
                    expiryDate.textContent = 'Sin Suscripción Anterior';
                }
            }

            if (progressBar) {
                let percent = 0;
                if (isLifetime) {
                    percent = 100;
                    progressBar.style.width = '100%';
                    progressBar.style.background = 'linear-gradient(90deg, #10b981 0%, #059669 100%)';
                } else if (isNeverSubscribed || isExpired || daysLeft <= 0) {
                    percent = 0;
                    progressBar.style.width = '0%';
                    progressBar.style.background = '#ef4444';
                } else if (isTrial) {
                    percent = Math.min(100, Math.max(0, Math.round((daysLeft / 7) * 100)));
                    progressBar.style.width = `${percent}%`;
                    progressBar.style.background = 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)';
                } else {
                    percent = Math.min(100, Math.max(0, Math.round((daysLeft / 30) * 100)));
                    progressBar.style.width = `${percent}%`;
                    progressBar.style.background = daysLeft <= 5 
                        ? 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)' 
                        : 'linear-gradient(90deg, #00b4d8 0%, #0077b6 100%)';
                }
                progressBar.className = 'progress-bar';
            }

            if (statusPill) {
                if (isLifetime) {
                    statusPill.className = 'badge px-3 py-1.5 rounded-pill fs-7 fw-bold d-inline-flex align-items-center gap-1.5 shadow-2xs bg-success text-white';
                    if (statusDot) statusDot.style.background = '#86efac';
                    if (statusPillText) statusPillText.textContent = '⭐ Activo Ilimitado';
                } else if (isNeverSubscribed) {
                    statusPill.className = 'badge px-3 py-1.5 rounded-pill fs-7 fw-bold d-inline-flex align-items-center gap-1.5 shadow-2xs bg-secondary text-white';
                    if (statusDot) statusDot.style.background = '#cbd5e1';
                    if (statusPillText) statusPillText.textContent = '⚪ Sin Suscripción Anterior';
                } else if (isExpired) {
                    statusPill.className = 'badge px-3 py-1.5 rounded-pill fs-7 fw-bold d-inline-flex align-items-center gap-1.5 shadow-2xs bg-danger text-white';
                    if (statusDot) statusDot.style.background = '#fca5a5';
                    if (statusPillText) statusPillText.textContent = '🔴 Suscripción Vencida';
                } else if (isTrial) {
                    statusPill.className = 'badge px-3 py-1.5 rounded-pill fs-7 fw-bold d-inline-flex align-items-center gap-1.5 shadow-2xs bg-warning text-dark';
                    if (statusDot) statusDot.style.background = '#b45309';
                    if (statusPillText) statusPillText.textContent = `🟡 Prueba Gratis (${daysLeft}d)`;
                } else {
                    statusPill.className = 'badge px-3 py-1.5 rounded-pill fs-7 fw-bold d-inline-flex align-items-center gap-1.5 shadow-2xs bg-success text-white';
                    if (statusDot) statusDot.style.background = '#86efac';
                    if (statusPillText) statusPillText.textContent = `🟢 Activo (${daysLeft}d)`;
                }
            }

            if (watermarkIcon) {
                if (isLifetime) {
                    watermarkIcon.className = 'bi bi-stars';
                    watermarkIcon.style.color = '#10b981';
                } else if (isNeverSubscribed) {
                    watermarkIcon.className = 'bi bi-shield-x';
                    watermarkIcon.style.color = '#94a3b8';
                } else if (isExpired) {
                    watermarkIcon.className = 'bi bi-shield-x';
                    watermarkIcon.style.color = '#ef4444';
                } else if (isTrial) {
                    watermarkIcon.className = 'bi bi-hourglass-split';
                    watermarkIcon.style.color = '#f59e0b';
                } else {
                    watermarkIcon.className = 'bi bi-shield-check';
                    watermarkIcon.style.color = '#0284c7';
                }
            }

            if (alertBanner) {
                if (isNeverSubscribed) {
                    alertBanner.className = 'alert alert-secondary border py-2 px-3 mb-3 rounded-3 d-flex align-items-center justify-content-between gap-2 text-xs bg-light';
                    if (alertMsg) alertMsg.innerHTML = '<strong>Primera vez en VitaMetrix:</strong> Ingresa un PIN de activación o canjea tu clave para comenzar.';
                } else if (isExpired) {
                    alertBanner.className = 'alert alert-danger py-2 px-3 mb-3 rounded-3 d-flex align-items-center justify-content-between gap-2 text-xs';
                    if (alertMsg) alertMsg.innerHTML = '<strong>Suscripción Vencida:</strong> Renueva tu licencia o canjea un PIN para desbloquear el acceso.';
                } else if (isTrial && daysLeft <= 2) {
                    alertBanner.className = 'alert alert-warning py-2 px-3 mb-3 rounded-3 d-flex align-items-center justify-content-between gap-2 text-xs';
                    if (alertMsg) alertMsg.innerHTML = `<strong>Prueba por finalizar:</strong> Te quedan ${daysLeft} día(s). Adquiere tu plan Pro oficial para mantener tu historial.`;
                } else if (!isTrial && !isLifetime && daysLeft <= 3) {
                    alertBanner.className = 'alert alert-warning py-2 px-3 mb-3 rounded-3 d-flex align-items-center justify-content-between gap-2 text-xs';
                    if (alertMsg) alertMsg.innerHTML = `<strong>Renovación cercana:</strong> Tu plan vencerá en ${daysLeft} día(s).`;
                } else {
                    alertBanner.className = 'alert alert-danger py-2 px-3 mb-3 rounded-3 d-none align-items-center justify-content-between gap-2 text-xs';
                }
            }

            if (headerBadge) {
                if (isNeverSubscribed) {
                    headerBadge.innerHTML = `<i class="bi bi-info-circle text-secondary me-1"></i> Estado: <strong class="text-secondary">Sin Suscripción Anterior</strong>`;
                } else if (isExpired) {
                    headerBadge.innerHTML = `<i class="bi bi-exclamation-octagon-fill text-danger me-1"></i> Estado: <strong class="text-danger">Vencido (0 días)</strong>`;
                } else if (isLifetime) {
                    headerBadge.innerHTML = `<i class="bi bi-stars text-success me-1"></i> Vigencia: <strong>Vitalicia</strong>`;
                } else {
                    headerBadge.innerHTML = `<i class="bi bi-shield-check text-success me-1"></i> Vigencia: <strong>${daysLeft} días</strong>`;
                }
            }
        }

        if (userId) userId.textContent = user.id || '---';
        if (userName) userName.textContent = user.full_name || 'Profesional';
        if (userEmail) userEmail.textContent = user.email || '';
        if (clinicBadge) clinicBadge.textContent = user.clinic_name || 'Consultorio Médico';

        if (waBtn && wa) {
            const encodedText = encodeURIComponent(wa.message_text);
            waBtn.href = `https://wa.me/${wa.phone_e164}?text=${encodedText}`;
        }

        updateUIWithUserData(user);
    } catch (e) {
        console.warn('Error al cargar estado de suscripción:', e);
    }
}

function initSubscriptionView() {
    const formRedeem = document.getElementById('form-redeem-license');
    const btnRedeem = document.getElementById('btn-redeem-license');

    const handleRedeem = async (e) => {
        if (e) e.preventDefault();
        const currentInput = document.getElementById('sub-license-input') || document.getElementById('input-license-key');
        const key = currentInput ? currentInput.value.trim() : '';

        if (!key) {
            showToast('Por favor ingresa un PIN de activación válido', 'warning');
            if (currentInput) currentInput.focus();
            return;
        }

        if (btnRedeem) {
            btnRedeem.disabled = true;
            btnRedeem.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span> Validando PIN...';
        }

        try {
            const res = await fetch('/api/subscription/redeem', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ license_key: key })
            });
            const data = await res.json();

            if (!res.ok || !data.success) {
                showToast(data.error || 'Error al canjear el PIN de activación', 'error');
                return;
            }

            showToast(`🎉 ${data.message || '¡PIN de activación canjeado con éxito!'}`, 'success');
            if (currentInput) currentInput.value = '';
            
            await fetchSubscriptionStatus();
            if (typeof fetchCurrentUser === 'function') {
                await fetchCurrentUser();
            }
        } catch (err) {
            console.error('Error al canjear PIN:', err);
            showToast('Error de conexión al canjear el PIN', 'error');
        } finally {
            if (btnRedeem) {
                btnRedeem.disabled = false;
                btnRedeem.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i> Canjear y Activar Licencia';
            }
        }
    };

    if (formRedeem) {
        formRedeem.addEventListener('submit', handleRedeem);
    } else if (btnRedeem) {
        btnRedeem.addEventListener('click', handleRedeem);
    }

    fetchSubscriptionStatus();
}
