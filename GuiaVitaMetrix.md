# ⚕️ VitaMetrix · Medical Body Composition Analyzer

**VitaMetrix** es un sistema web profesional de análisis de composición corporal basado en **Bioimpedancia Eléctrica (BIA)** y diseñado para entornos clínicos, consultas de nutrición y deportología.

El sistema procesa datos crudos de bioimpedancia (Resistencia y Reactancia) y los traduce en un dashboard visual, intuitivo y clínicamente útil, mostrando puntuaciones de grasa, músculo, gasto energético y salud celular a través de un elegante panel de control con gráficos vectoriales (BIVA).

---

## 🎯 ¿Qué hace?

- **Análisis Vectorial BIVA:** Dibuja en un canvas el vector de bioimpedancia (R / Xc) para evaluar visualmente la hidratación y la masa celular.
- **Cálculo del Ángulo de Fase:** Calcula automáticamente el ángulo de fase (marcador de salud e integridad de las membranas celulares) a partir de la resistencia y reactancia.
- **Puntuación Corporal (TRU Body Score):** Muestra una calificación global (sobre 100) junto con puntuaciones específicas de músculo y grasa.
- **Gasto Energético (REE / TEE):** Calcula y muestra el gasto calórico en reposo y total, además del nivel de actividad física (PAL).
- **Interpretación Clínica:** Genera un resumen textual automático con el estado de hidratación y la calidad de la masa celular del paciente.

---

## 🧱 Estructura del Proyecto

El proyecto sigue una arquitectura limpia y separada por responsabilidades (Backend, Frontend y Datos):
