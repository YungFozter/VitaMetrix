/* ============================================================
   UI Enhancements — VitaMetrix Motion & Interaction JS
   Staggered entrance, view transitions, number counting,
   gauge sweep, micro-interaction helpers.
   ============================================================ */

(function () {
  'use strict';

  // ==========================================
  // STAGGERED ENTRANCE
  // Aplica entrada escalonada a elementos con .vm-enter-stagger
  // ==========================================
  function initStaggeredEntrance() {
    const elements = document.querySelectorAll('.vm-enter-stagger');
    if (!elements.length) return;

    // Determinar delay por índice (máximo 12)
    elements.forEach((el, i) => {
      const delayClass = 'vm-enter-delay-' + Math.min(i + 1, 12);
      el.classList.add(delayClass);

      // Usar IntersectionObserver para activar al entrar en viewport
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            el.classList.add('vm-entered');
            observer.unobserve(el);
          }
        });
      }, { threshold: 0.08, rootMargin: '0px 0px -20px 0px' });

      observer.observe(el);
    });
  }

  // ==========================================
  // VIEW TRANSITIONS (SPA)
  // Al navegar entre vistas, animar la nueva vista
  // ==========================================
  function initViewTransitions() {
    const navItems = document.querySelectorAll('.nav-item[data-target]');
    if (!navItems.length) return;

    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        const targetId = item.getAttribute('data-target');
        const targetView = document.getElementById(targetId);
        if (!targetView) return;

        // Reiniciar animación de entrada
        targetView.classList.remove('vm-view-enter');
        // Forzar reflow para re-trigger animation
        void targetView.offsetWidth;
        targetView.classList.add('vm-view-enter');
      });
    });
  }

  // ==========================================
  // NUMBER COUNTING ANIMATION
  // Anima un número desde su valor actual hasta el target
  // easing: ease-out cubic
  // ==========================================
  function animateNumber(el, target, suffix = '', duration = 800) {
    if (!el) return;
    const start = parseFloat(el.textContent) || 0;
    const startTime = performance.now();

    // Si el target es string (ej "pts", "Ω"), solo reemplazar
    if (typeof target === 'string' || isNaN(target)) {
      el.textContent = target + suffix;
      return;
    }

    function frame(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (target - start) * eased;

      if (Number.isInteger(target)) {
        el.textContent = Math.round(current) + suffix;
      } else {
        el.textContent = current.toFixed(1) + suffix;
      }

      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        // Valor final exacto
        if (Number.isInteger(target)) {
          el.textContent = target + suffix;
        } else {
          el.textContent = target.toFixed(1) + suffix;
        }
        // Flash de highlight
        el.classList.remove('vm-highlight-flash');
        void el.offsetWidth;
        el.classList.add('vm-highlight-flash');
      }
    }

    requestAnimationFrame(frame);
  }

  // ==========================================
  // GAUGE SWEEP ANIMATION
  // Anima un conic-gradient desde 0 hasta el target %
  // ==========================================
  function animateGauge(el, targetPct, color, duration = 1000) {
    if (!el) return;
    const start = 0;
    const startTime = performance.now();

    function frame(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (targetPct - start) * eased;

      el.style.setProperty('--gauge-pct', current + '%');
      el.style.background = 'conic-gradient(' + color + ' ' + current + '%, #e2e8f0 0)';

      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        el.style.setProperty('--gauge-pct', targetPct + '%');
        el.style.background = 'conic-gradient(' + color + ' ' + targetPct + '%, #e2e8f0 0)';
      }
    }

    requestAnimationFrame(frame);
  }

  // ==========================================
  // STATE PULSE (para chips, dots que cambian de estado)
  // Anima un breve pulse al cambiar de color/estado
  // ==========================================
  function pulseState(el) {
    if (!el) return;
    el.classList.remove('vm-state-pulse');
    void el.offsetWidth;
    el.classList.add('vm-state-pulse');
  }

  // ==========================================
  // INIT — ejecutar al cargar DOM
  // ==========================================
  document.addEventListener('DOMContentLoaded', () => {
    initStaggeredEntrance();
    initViewTransitions();
  });

  // Exportar funciones para uso externo (app.js, etc.)
  window.vmAnimate = {
    number: animateNumber,
    gauge: animateGauge,
    pulse: pulseState
  };
})();
