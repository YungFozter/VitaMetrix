# 📘 VITAMETRIX - GUÍA MAESTRA DE ARQUITECTURA, PANTALLAS Y ENDPOINTS API

Reglas obligatorias para el agente al modificar o ampliar la arquitectura de VitaMetrix:
- Consultar siempre `SYSTEM_GUIDE.md` ([SYSTEM_GUIDE.md](file:///e:/Proyectos/VitaMetrix/SYSTEM_GUIDE.md)) en la raíz del proyecto.
- Mantener la separación de código por módulos en `frontend/static/js/modules/`, `frontend/templates/partials/` y `backend/blueprints/`.
- Mantener `app.js` como un orquestador ultraligero de inicialización.
- Probar siempre con `python Tests/test_e2e_api.py` tras cualquier modificación.
