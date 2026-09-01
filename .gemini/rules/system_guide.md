# 📘 VITAMETRIX - GUÍA MAESTRA DE ARQUITECTURA, PANTALLAS Y ENDPOINTS API

Reglas obligatorias para el agente al modificar o ampliar la arquitectura de VitaMetrix:
- Consultar siempre `Markdown/SYSTEM_GUIDE.md` ([SYSTEM_GUIDE.md](file:///e:/Proyectos/VitaMetrix/Markdown/SYSTEM_GUIDE.md)) y `Markdown/DATABASE_GUIDE.md` ([DATABASE_GUIDE.md](file:///e:/Proyectos/VitaMetrix/Markdown/DATABASE_GUIDE.md)).
- Mantener la separación de código por módulos en `frontend/static/js/modules/`, `frontend/templates/partials/` y `backend/blueprints/`.
- Mantener `app.js` como un orquestador ultraligero de inicialización (~54 líneas).
- Probar siempre con `python Tests/test_e2e_api.py` tras cualquier modificación.
