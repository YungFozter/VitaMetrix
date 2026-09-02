# 📘 VITAMETRIX - GUÍA MAESTRA DE ARQUITECTURA, PANTALLAS Y ENDPOINTS API

Reglas obligatorias para el agente al modificar o ampliar la arquitectura de VitaMetrix:
- Consultar siempre los documentos de referencia en `Markdown/`:
  * `Markdown/SYSTEM_GUIDE.md` ([SYSTEM_GUIDE.md](file:///e:/Proyectos/VitaMetrix/Markdown/SYSTEM_GUIDE.md)): Arquitectura del sistema y mapa de 30 endpoints API.
  * `Markdown/DATABASE_GUIDE.md` ([DATABASE_GUIDE.md](file:///e:/Proyectos/VitaMetrix/Markdown/DATABASE_GUIDE.md)): Esquema DDL de Supabase PostgreSQL, UUIDs, tablas e índices.
  * `Markdown/GuiaVisualPantalla_Bioimpedancia.md` ([GuiaVisualPantalla_Bioimpedancia.md](file:///e:/Proyectos/VitaMetrix/Markdown/GuiaVisualPantalla_Bioimpedancia.md)): Especificaciones del Calculador BIA, Ángulo de Fase y TRU Score.
  * `Markdown/Pagina2 Analyzer.md` ([Pagina2 Analyzer.md](file:///e:/Proyectos/VitaMetrix/Markdown/Pagina2%20Analyzer.md)): Diseño y maquetación del Reporte PDF impreso de 2 páginas.
  * `Markdown/GuiaVitaMetrix.md` ([GuiaVitaMetrix.md](file:///e:/Proyectos/VitaMetrix/Markdown/GuiaVitaMetrix.md)): Guía de negocio y alcance del ecosistema.
- Mantener la separación de código por módulos en `frontend/static/js/modules/`, `frontend/templates/partials/` y `backend/blueprints/`.
- Mantener `app.js` como un orquestador ultraligero de inicialización (~54 líneas).
- Manejar siempre las fechas en la **Zona Horaria Oficial de Bolivia (UTC-04:00)** usando `_now_bolivia()`.
- Probar siempre con `python Tests/test_e2e_api.py` tras cualquier modificación.
