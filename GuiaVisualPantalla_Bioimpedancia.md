# 🎨 Especificación de Diseño UI - Pantallas Principales de VitaMetrix

**Versión:** 1.0  
**Propósito:** Este documento describe en detalle el diseño visual, la disposición de los elementos, los comportamientos interactivos y la paleta de colores para las **tres secciones principales** del dashboard de VitaMetrix, basadas en las imágenes iniciales proporcionadas.

---

## 1. FILOSOFÍA GENERAL DE DISEÑO

- **Formato:** Dashboard web de escritorio (responsivo) con estructura en **Bento Grid**.
- **Estilo Visual:** **Glassmorphism sutil** (fondos traslúcidos con desenfoque) combinado con tarjetas de fondo sólido y sombras suaves para garantizar la máxima legibilidad de los datos clínicos.
- **Paleta de Colores:**
  - **Fondo General:** `#F4F7FC` (gris azulado muy claro).
  - **Tarjetas:** Blanco con transparencia (`rgba(255, 255, 255, 0.70)`) y `backdrop-filter: blur(12px)`.
  - **Color Principal (Confianza):** `#1A2A4A` (Azul Marino) para textos principales y acentos.
  - **Color de Acento (Rango):** `#CD7F32` (Oro/Bronce) y `#B94A4A` (Rojo cereza para alertas).
  - **Colores de Estado:** 🟢 Verde (`#2D7A4A`) para óptimo, 🟡 Amarillo (`#E6A100`) para atención.
- **Tipografía:** **Inter** (sans-serif) en toda la interfaz. Jerarquía clara: números grandes en `700` (bold), etiquetas en `500` y textos auxiliares en `400`.

---

## 2. SECCIÓN 1: ANÁLISIS DE LA BIOIMPEDANCIA VECTORIAL (BIVA)

**Objetivo:** Mostrar la "salud celular" y la distribución del agua mediante un gráfico vectorial interactivo, acompañado de los valores crudos de Resistencia (R) y Reactancia (Xc).

### Disposición en la Pantalla
- **Tamaño de la Tarjeta:** Ocupa un espacio **grande** dentro del Bento Grid (span 2 de ancho y 2 de alto) para que el gráfico sea amplio y legible.

### Elementos y Comportamiento

#### A) Encabezado (Card Header)
- Texto: `⚕️ Análisis Vectorial (BIVA)` en minúsculas, espaciado (`letter-spacing: 0.8px`), en color gris profesional (`#5A6F8C`).
- Al lado derecho, un pequeño indicador de "En Vivo" o "Calculado" en verde.

#### B) Área del Gráfico (Canvas) - Zona Principal
- Ubicado a la **izquierda** de la tarjeta, ocupando aproximadamente el **65% del ancho**.
- **Fondo del gráfico:** Blanco con una ligera malla de puntos (efecto papel milimetrado) y bordes redondeados de 12px.
- **Ejes y Leyendas:**
  - **Eje X (Horizontal):** Etiquetado como `Z(R/H)` -> Resistencia.
    - Flecha hacia la **derecha** con la etiqueta: **"Porcentaje de agua decreciente"** (más resistencia = menos agua).
    - Flecha hacia la **izquierda** con la etiqueta: **"Porcentaje de agua creciente"**.
  - **Eje Y (Vertical):** Etiquetado como `Z(Xc/H)` -> Reactancia.
    - Flecha hacia **arriba** con la etiqueta: **"Masa de somatocitos creciente"** (más reactancia = más músculo/células).
    - Flecha hacia **abajo** con la etiqueta: **"Masa de somatocitos decreciente"**.
- **Elipses de Referencia:** Se dibujan dos elipses concéntricas superpuestas (población general y atletas) en color gris muy claro (`#D0D8E4`) con línea discontinua.
- **Vector del Paciente:** Línea gruesa de color **Azul Marino (`#1A2A4A`)** que parte desde el centro `(0,0)` hasta el punto de datos.
- **Punto de Datos:** Círculo grande (radio 8px) de color **Rojo cereza (`#B94A4A`)** en el extremo del vector, con un sutil resplandor (sombra difusa). Una etiqueta flotante mostrará `(R, Xc)`.

#### C) Panel de Datos Numéricos (Lateral Derecho)
- Ubicado a la **derecha** del gráfico, ocupando el 35% restante. Organizado en bloques verticales.
- **Resistencia (R):**
  - Valor enorme en `#1A2A4A` (ej. `575.6`).
  - Unidad `Ω` en gris debajo.
  - Semáforo 🟢 indicando "Hidratación adecuada".
- **Reactancia (Xc):**
  - Valor enorme en `#1A2A4A` (ej. `59`).
  - Unidad `Ω` en gris.
  - Semáforo 🟢 indicando "Membranas saludables".
- **Ángulo de Fase (calculado):**
  - Caja destacada con fondo `#E2F0E8` y texto en verde oscuro.
  - Muestra: `Ángulo de Fase: 5.86°`.
  - Incluye una mini barra visual que va del 0 al 10, con el marcador en la posición correspondiente.

### Mejora sobre la Imagen Original
La imagen original solo mostraba 4 flechas y dos números. Aquí añadimos **contexto visual** (elipses de referencia), **semáforos** de estado y el **Ángulo de Fase**, que es el marcador estrella de salud celular.

---

## 3. SECCIÓN 2: PUNTUACIÓN CORPORAL (TRU BODY SCORE)

**Objetivo:** Mostrar de un vistazo la calificación global ("nota" del paciente) y el equilibrio entre su musculatura y su grasa corporal.

### Disposición en la Pantalla
- **Tamaño de la Tarjeta:** Tarjeta **ancha** (span 2 de ancho, 1 de alto). El diseño se divide en dos mitades visuales (izquierda y derecha).

### Elementos y Comportamiento

#### A) Puntuación Global (Mitad Izquierda)
- El número (ej. `92`) en tipografía **gigante** (tamaño `4.8rem` / ~77px), en color `#1A2A4A`.
- Debajo, la palabra `PUNTOS` en gris y tamaño pequeño.
- **Badge de Rango:** A la derecha del número, una etiqueta grande con el rango (ej. **"BRONCE"**). 
  - *Estilo:* Fondo degradado en tonos cobrizos (`#CD7F32` con amarillo) y texto en blanco o dorado oscuro. El borde de la sección tiene un sutil glow del color del rango.

#### B) Barras de Puntuación (Mitad Derecha)
- Dos métricas alineadas verticalmente.
- **Muscle Score:**
  - Icono 💪 al lado del texto.
  - Valor `68` en negrita y grande.
  - **Barra de progreso:** Rellena al 68% en color Verde Menta (`#2D7A4A`). Fondo gris claro (`#E8EDF5`). Extremos redondeados.
  - Leyenda inferior: *"Percentil excelente"*.
- **Fat Score:**
  - Icono ⚡ al lado del texto.
  - Valor `24` en negrita.
  - **Barra de progreso INVERTIDA:** Rellena al 24% en color Rojo Suave (`#B94A4A`), ya que a menor grasa, mejor.
  - Leyenda inferior: *"Percentil bajo (saludable)"*.

### Mejora sobre la Imagen Original
La imagen original mostraba solo dos números sueltos (68 y 24) sin contexto. Aquí añadimos **barras de progreso** para entender visualmente la proporción y un **badge de rango** mucho más llamativo y gamificado para el paciente.

---

## 4. SECCIÓN 3: CONSUMO DE ENERGÍA (REE / TEE / PAL)

**Objetivo:** Traducir la composición corporal a números prácticos: cuántas calorías quema el paciente en reposo y en total, y cómo influye su nivel de actividad.

### Disposición en la Pantalla
- **Tamaño de la Tarjeta:** Tamaño estándar (span 1 de ancho, 1.5 de alto). Organizado en forma de "termo" o "combustible" energético.

### Elementos y Comportamiento

#### A) Encabezado
- Texto: `🔥 Consumo Energético (REE / TEE)`.

#### B) Primera Fila (En Reposo - REE)
- Icono de "persona sentada" o "💤" dentro de un círculo pequeño.
- Texto: `En reposo (REE)` en gris claro.
- Valor: **`1,338 kcal`** en gran tamaño y color `#1A2A4A`.
- Subtexto (conversión): `= 5.6 MJ/día` en gris y tamaño pequeño.

#### C) Segunda Fila (Actividad Total - TEE)
- Icono de "persona corriendo" o "🏃" dentro de un círculo.
- Texto: `Actividad Total (TEE)`.
- Valor: **`1,873 kcal`** en gran tamaño.
- Subtexto: `= 7.84 MJ/día`.
- **Efecto visual:** Una flecha curva o línea ascendente conecta visualmente el REE con el TEE para mostrar el gasto extra por actividad.

#### D) Indicador de Nivel de Actividad (PAL)
- Ubicado en la parte inferior de la tarjeta, en una caja con fondo `#E8EDF5` (gris azulado claro).
- Texto a la izquierda: `Nivel de Actividad Física (PAL)`.
- **Medidor tipo velocímetro:** Barra horizontal con un marcador en la posición del valor (ej. `1.4`).
- **Etiqueta de estado:** Debajo del medidor, aparece la clasificación textual (ej. `Sedentario / Baja actividad`) en color amarillo/naranja (`#E6A100`) si es un punto de mejora.

### Mejora sobre la Imagen Original
La imagen original mostraba solo el dato numérico plano. Aquí integramos **iconos intuitivos** (reposo vs actividad), un **medidor visual de PAL** para que el paciente sepa en qué nivel está, y mantenemos la doble unidad (kcal y MJ) de forma elegante.

---

## 5. RESUMEN DE LA EXPERIENCIA DE USUARIO (UX) EN LAS 3 PANTALLAS

1.  **Mirada inicial (2 segundos):** El médico ve el **92 en GRANDE** (sabe que el paciente está bien) y el **PAL 1.4** en amarillo (sabe que ahí hay un problema).
2.  **Segunda mirada (5 segundos):** Observa el **gráfico vectorial (BIVA)** para ver visualmente dónde está el punto del paciente (dentro de las elipses) y confirma la **Resistencia y Reactancia**.
3.  **Análisis detallado (10 segundos):** Revisa las **barras de músculo/grasa** para ver el equilibrio y los **gastos calóricos** para ajustar la dieta.

La interfaz mantiene **los mismos colores, tipografía y redondeces** en las tres tarjetas, creando un ecosistema visual sólido, confiable y muy superior a la interfaz "plana" y sin contexto de las imágenes originales.

---
*VitaMetrix · Diseño centrado en la claridad clínica.*