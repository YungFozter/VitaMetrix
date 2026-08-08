# ⚙️ VitaMetrix - Manual de Lógica de Procesamiento y Cálculo

**Versión:** 1.0  
**Propósito:** Este documento describe el flujo de datos, las fórmulas matemáticas, las tablas de referencia poblacional y los umbrales de riesgo que el sistema VitaMetrix utiliza para transformar los valores crudos de bioimpedancia en un informe clínico interactivo y visual.

---

## 1. ESTRUCTURA DE DATOS DE ENTRADA (INPUTS)

Para que el sistema funcione, debe recibir un conjunto mínimo de datos. Estos provienen de un dispositivo de bioimpedancia (BIA) y de una medición antropométrica manual.

| Categoría | Campo | Tipo | Unidad | Obligatorio |
| :--- | :--- | :--- | :--- | :--- |
| **Paciente** | Nombre y Apellidos | Texto | - | Sí |
| | ID / Historia Clínica | Texto | - | Sí |
| | Sexo | Selector (M/F) | - | Sí |
| | Edad | Número | Años | Sí |
| | Fecha de prueba | Fecha | - | Sí |
| **BIA Crudo** | Resistencia (R) | Número | Ω (Ohmios) | Sí |
| | Reactancia (Xc) | Número | Ω (Ohmios) | Sí |
| | Ángulo de Fase (opcional) | Número | Grados | No (se calcula) |
| **Antropometría** | Circunferencia de cintura | Número | cm | Sí |
| **Derivados (opcionales)** | SMM Total (Músculo) | Número | kg | No (se obtiene del dispositivo) |
| | TBW (Agua total) | Número | Litros | No (se obtiene del dispositivo) |
| | ECW (Agua extracelular) | Número | Litros | No (se obtiene del dispositivo) |
| | Músculo segmental | Número | kg (por segmento) | No (se obtiene del dispositivo) |

---

## 2. FLUJO DE PROCESAMIENTO Y CÁLCULO (Backend Logic)

### Módulo 1: Cálculo del Ángulo de Fase y Vector BIVA
- **Entrada:** `Resistencia (R)` y `Reactancia (Xc)`.
- **Fórmula:**
  \[
  \text{Ángulo de Fase (°)} = \text{atan2}(Xc, R) \times \left(\frac{180}{\pi}\right)
  \]
- **Salida:** Valor en grados con 2 decimales.
- **Interpretación Semántica (Umbrales):**
  - Si `Ángulo > 6.0°` → *Excelente salud celular (Sobrepromedio)*.
  - Si `Ángulo entre 5.0° y 6.0°` → *Buena salud celular (Rango óptimo)*.
  - Si `Ángulo < 5.0°` → *Masa celular a monitorear (Posible inflamación o sarcopenia)*.
- **Gráfico Vectorial (Canvas):**
  - El sistema dibuja un plano cartesiano donde el Eje X es Resistencia (R) y el Eje Y es Reactancia (Xc).
  - El punto se ubica mediante una transformación lineal que normaliza los rangos (R entre 200-800 Ω, Xc entre 10-100 Ω).
  - Se dibujan dos elipses de referencia: una para población normal y otra para atletas.

---

### Módulo 2: Puntuación Global TRU Body Score (Muscle / Fat)
- **Entrada:** Masa Muscular (SMM) y Masa Grasa (FM) estimada por el dispositivo.
- **Lógica de Cálculo (Procesamiento por Deciles):**
  1. El sistema compara la SMM y la FM del paciente con una base de datos poblacional ajustada por sexo y edad.
  2. Asigna una puntuación de 0 a 100 para Músculo: a mayor SMM vs promedio, mayor puntuación.
  3. Asigna una puntuación de 0 a 100 para Grasa: **inversamente proporcional** (a menor grasa, mayor puntuación).
  4. El **Global Score** es un promedio ponderado de ambas puntuaciones.
- **Categoría (Rango):**
  - Oro: 95 – 100 pts
  - Plata: 90 – 94 pts
  - **Bronce: 80 – 89 pts** (donde suele caer la mayoría de la población saludable)
  - Hierro: < 80 pts

---

### Módulo 3: Composición Segmentaria (Músculo por Zonas)
- **Entrada:** Valores en kg para Brazo D, Brazo I, Torso, Pierna D, Pierna I.
- **Procesamiento:**
  1. El sistema carga **tablas normativas internas** (estratificadas por sexo y edad) que contienen 4 valores para cada segmento: *Mínimo*, *Promedio*, *Máximo*.
  2. Compara el valor ingresado del paciente con estos 3 umbrales.
- **Salida (Semáforos):**
  - 🟢 **Normal**: Valor > Mínimo y < Máximo.
  - 🟡 **Atención**: Valor > Máximo (hipertrofia excesiva, posible sobrecarga).
  - 🔴 **Déficit**: Valor < Mínimo (pérdida de masa o atrofia).
- **Simetría:** El sistema calcula la diferencia absoluta entre brazo derecho e izquierdo (y piernas). Si la diferencia supera el 10% del valor del lado menor, se emite una alerta de **Asimetría Clínica**.

---

### Módulo 4: Análisis Hídrico (TBW / ECW / Relación)
- **Entrada:** TBW (L), ECW (L) y Peso (kg) – opcional para porcentajes.
- **Cálculo principal:**
  \[
  \text{Relación ECW/TBW} = \left( \frac{ECW}{TBW} \right) \times 100
  \]
- **Umbrales de Riesgo (Clasificación):**
  - **< 39 %:** Estado de hidratación intracelular óptimo (Atleta).
  - **39 % – 42 %:** Rango saludable normal.
  - **42 % – 45 %:** Leve sobrecarga hídrica extracelular (Atención).
  - **> 45 %:** Edema subclínico / Inflamación sistémica. Alerta Roja.
- **Interpretación Automática:** Si la relación es > 45%, el sistema cruza este dato con la grasa visceral. Si ambos están elevados, el informe sugerirá "Síndrome metabólico inflamatorio".

---

### Módulo 5: Grasa Visceral y Circunferencia de Cintura
- **Entrada:** Cintura (cm) y Valor estimado de grasa visceral (Litros - si el dispositivo lo entrega).
- **Algoritmo de Riesgo (Basado en IDF - Federación Internacional de Diabetes):**
  - **Mujeres:** Si `Cintura ≥ 88 cm` → Riesgo Alto.
  - **Hombres:** Si `Cintura ≥ 102 cm` → Riesgo Alto.
  - Si `Grasa Visceral > 1.5 L` (mujeres) o `> 2.5 L` (hombres) → Alerta de riesgo cardiovascular.
- **Salida:** El sistema etiqueta la sección con un fondo degradado (verde/amarillo/rojo) y genera una advertencia textual automática.

---

### Módulo 6: Percentil de Masa Muscular (SMM vs Edad)
- **Entrada:** SMM Total (kg), Edad, Sexo.
- **Procesamiento:**
  1. El sistema consulta una **curva de regresión poblacional** (ej. basada en estudios NHANES o datos del fabricante).
  2. Ubica el SMM del paciente en la curva de edad correspondiente.
  3. Calcula en qué percentil se encuentra (ej. si su valor es mayor al 89% de la población de su misma edad, se reporta "Percentil 89").
- **Salida Gráfica:**
  - Se dibuja un gráfico de líneas con la edad en el eje X y el SMM en el eje Y.
  - Se dibujan 4 curvas de referencia: Percentil 5, 25, 50, 75, 95.
  - Se marca el punto exacto del paciente sobre la gráfica.

---

### Módulo 7: Gasto Energético (REE / TEE / PAL)
- **Entrada:** Edad, Sexo, Peso, Altura, SMM (Masa Magra) – o directamente el REE estimado por el dispositivo.
- **Cálculo (Si el dispositivo no lo entrega, el sistema lo estima):**
  - *Opción A (Fórmula de Cunningham - basada en masa magra):* 
    \[
    REE = 500 + (22 \times \text{Masa Magra en kg})
    \]
  - *Opción B (Harris-Benedict - basada en peso, altura, edad y sexo):* Se usa si no se dispone de SMM.
- **Nivel de Actividad (PAL):**
  - El sistema pide al usuario (médico) que seleccione el nivel de actividad del paciente:
    - Sedentario: PAL = 1.2 – 1.4
    - Ligero: PAL = 1.4 – 1.6
    - Moderado: PAL = 1.6 – 1.9
    - Intenso: PAL = 1.9 – 2.5
  - **Cálculo del TEE:** `TEE = REE × PAL`.

---

## 3. LÓGICA DE GENERACIÓN DEL INFORME CLÍNICO (Interpretación Textual)

El sistema dispone de un **motor de reglas** que combina los resultados de todos los módulos anteriores para redactar un párrafo coherente y personalizado.

### Ejemplo de Reglas de Composición:
1. **Si** (Grasa Visceral es Alta) **Y** (ECW/TBW > 45%) **ENTONCES** → *"Paciente con perfil inflamatorio sistémico. Evaluar síndrome metabólico."*
2. **Si** (Percentil SMM > 75) **Y** (Existe asimetría en piernas) **ENTONCES** → *"Excelente masa muscular global. ATENCIÓN: Déficit focal detectado en [Segmento]. Evaluar posible lesión o sobrecarga."*
3. **Si** (Cintura > umbral) **Y** (SMM > percentil 50) **ENTONCES** → *"Sarcopenia oculta enmascarada por obesidad. Priorizar déficit calórico con alto aporte proteico."*
4. **Si** (Ángulo de Fase < 5°) **ENTONCES** → *"Integridad de membranas celulares comprometida. Descartar inflamación crónica o desnutrición proteica."*

El sistema concatena todas las reglas que se disparan para formar el apartado de "Interpretación Clínica" del dashboard.

---

## 4. BASE DE DATOS DE REFERENCIA (Poblacional)

Para que los percentiles, los rangos de normalidad (mín/prom/máx) y los semáforos funcionen, el sistema debe tener cargadas **tablas lookup** internas. Estas tablas están estratificadas por:

1. **Sexo** (Masculino / Femenino).
2. **Edad** (en intervalos de 5 años: 20-24, 25-29, ..., 80+).
3. **Altura** (estratificada en rangos bajos, medios, altos, para ajustar la masa muscular segmental).

Estas tablas contienen los valores de referencia para:
- SMM total (kg)
- TBW y ECW (Litros)
- Músculo por segmento (kg)
- Masa grasa (%)

*Nota técnica:* En una implementación real, estas tablas se almacenan en un archivo JSON, SQLite o directamente en la lógica de `calculations.py`.

---

## 5. FLUJO DE TRABAJO DEL USUARIO (Médico / Nutricionista)

1. **Ingreso de Datos:** El profesional introduce los datos del paciente y los valores crudos (R, Xc, cintura, etc.) en el formulario frontal.
2. **Ejecución Backend:** Al hacer clic en "Analizar", el frontend envía los datos a la API `/api/dashboard-data` (o similar).
3. **Procesamiento:** `app.py` recibe los datos, los pasa al módulo `calculations.py`, que ejecuta **todos** los cálculos descritos en este manual (Módulo 1 al 7).
4. **Respuesta API:** Se devuelve un único objeto JSON que contiene todos los resultados procesados (puntuaciones, ángulo, percentil, interpretaciones, flags de riesgo).
5. **Renderizado Frontend:** `app.js` consume este JSON, actualiza los números en el HTML, dibuja los gráficos en Canvas (BIVA y BCC) y cambia los colores de las tarjetas según los semáforos.

---

## 6. CONSIDERACIONES PARA EL DESARROLLADOR

- **Validación de Datos:** El backend debe validar que R y Xc no sean 0 (daría error en el arcotangente). Si faltan datos segmentarios, el sistema omite esa sección o muestra "No disponible".
- **Internacionalización:** Los rangos (cm, kg, Litros) deben permitir cambios entre sistema métrico e imperial si se requiere.
- **Escalabilidad:** Para futuras versiones, la base de datos poblacional debe poder actualizarse vía CSV sin tocar el código fuente.
- **Precisión:** Todos los cálculos deben redondearse a 1 o 2 decimales para no dar falsa sensación de precisión absoluta.

---
*VitaMetrix · Ciencia de datos aplicada a la salud.*