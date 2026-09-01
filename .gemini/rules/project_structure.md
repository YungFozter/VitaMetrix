# Regla de Arquitectura y Estructura Modular de VitaMetrix

## Directiva del Proyecto
TODO NUEVO ARCHIVO DEBE ESTAR CORRECTAMENTE UBICADO EN LA ESTRUCTURA MODULAR DEL SISTEMA. Cada sección funcional de la aplicación debe contar con sus archivos dedicados organizados por el mismo nombre de la sección:

### Convención de Nombres por Sección:
Ejemplo para la sección `stock`:
- **HTML (Plantilla / Partial)**: `frontend/templates/partials/stock_modals.html` o `frontend/templates/stock.html`
- **CSS (Estilos dedicados)**: `frontend/static/css/stock.css`
- **JS (Lógica/Módulo dedicado)**: `frontend/static/js/modules/stock.js`
- **Backend Blueprint (Python)**: `backend/blueprints/stock.py`

Ejemplo para la sección `evaluations`:
- `frontend/templates/partials/evaluations_modals.html`
- `frontend/static/css/evaluations.css`
- `frontend/static/js/modules/evaluations.js`
- `backend/blueprints/evaluations.py`

### Principios Fundamentales:
1. **Sin Archivos Monolíticos**: Prohibido acumular código genérico o miles de líneas en `app.py` o `app.js`.
2. **Separación de Responsabilidades**: Lógica de inventario en `stock.*`, clínica en `evaluations.*`, pacientes en `clients.*`, citas en `appointments.*`, ventas en `sales.*`, analítica en `dashboard.*`, autenticación en `auth.*`.
3. **Ubicación Obligatoria**: Todo nuevo archivo debe crearse en su subcarpeta correspondiente (`backend/blueprints/`, `backend/services/`, `frontend/static/js/modules/`, `frontend/static/css/`, `frontend/templates/partials/`, `Tests/`).
