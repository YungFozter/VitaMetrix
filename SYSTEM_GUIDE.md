# 📘 VITAMETRIX - GUÍA MAESTRA DE ARQUITECTURA, PANTALLAS Y ENPOINTS API

Este documento constituye la **norma técnica y arquitectónica obligatoria** para la estructura de código, organización de archivos, comportamiento de pantallas y contrato de la API REST del sistema **VitaMetrix**.

---

## 📂 1. NORMAS DE UBICACIÓN Y ESTRUCTURA DE ARCHIVOS

### 1.1 Regla Estricta de Modularidad
1. **Un Módulo por Sección**: Cada sección o pantalla del sistema posee su propio módulo frontend JavaScript en `frontend/static/js/modules/`, su plantilla parcial HTML en `frontend/templates/partials/`, sus estilos CSS en `frontend/static/css/modules/` (o estilos compartidos en `styles.css`) y su correspondiente Blueprint en Python Flask (`backend/blueprints/`).
2. **Nombres Coincidentes por Relación**: Los archivos relacionados con una misma funcionalidad deben conservar el mismo nombre base.
   - *Ejemplo Stock*: `stock.html`, `stock.js`, `stock.css`, `backend/blueprints/stock.py`.
   - *Ejemplo Bioimpedancia*: `bioimpedancia.html`, `bioimpedancia.js`, `backend/blueprints/evaluations.py`.

### 1.2 Estructura del Proyecto

```text
VitaMetrix/
├── SYSTEM_GUIDE.md                   <-- Guía maestra y contrato de arquitectura (ESTE ARCHIVO)
├── backend/
│   ├── app.py                        <-- Factoría Flask, CORS, registro de blueprints y manejo global de errores
│   ├── services/
│   │   ├── supabase_service.py       <-- Cliente y consultas Supabase (PostgreSQL)
│   │   ├── bia_engine.py             <-- Algoritmos bioeléctricos, BIVA, TRU Score y somatotipos
│   │   └── pdf_service.py            <-- Generación de reportes clínicos PDF
│   └── blueprints/
│       ├── auth.py                   <-- Autenticación JWT y registro
│       ├── evaluations.py            <-- Evaluaciones BIA e historial clínico
│       ├── clients.py                <-- Directorio de pacientes
│       ├── appointments.py           <-- Agenda y citas médicas
│       ├── stock.py                  <-- Inventario de insumos y kardex
│       ├── sales.py                  <-- Terminal POS y ventas
│       ├── subscriptions.py          <-- Suscripciones y canje de PINs
│       └── superadmin.py             <-- Gestor maestro SuperAdmin
├── frontend/
│   ├── templates/
│   │   ├── index.html                <-- Maqueta SPA principal u orquestadora
│   │   └── partials/                 <-- Vistas parciales e inyectables HTML
│   │       ├── bioimpedancia.html
│   │       ├── pacientes.html
│   │       ├── evaluaciones.html
│   │       ├── citas.html
│   │       ├── stock.html
│   │       ├── ventas.html
│   │       ├── configuracion.html
│   │       ├── superadmin.html
│   │       └── stock_modals.html
│   └── static/
│       ├── css/
│       │   ├── styles.css            <-- Estilos globales y variables CSS
│       │   └── modules/              <-- Estilos específicos por sección
│       └── js/
│           ├── app.js                <-- Orquestador principal ultraligero (~50 líneas)
│           ├── ui-enhancements.js    <-- Animaciones y componentes de UI
│           └── modules/              <-- MÓDULOS DE LÓGICA DE NEGOCIO
│               ├── utils.js          <-- Sanitización XSS, toasters, alertas y reloj
│               ├── auth.js           <-- JWT, sesiones y control de acceso
│               ├── navigation.js     <-- Enrutador SPA, pestañas y sidebar
│               ├── bioimpedancia.js  <-- Formulario BIA, gráficos BIVA/PAL/BCC y PDF
│               ├── pacientes.js     <-- Directorio de pacientes y mensajería
│               ├── evaluaciones.js   <-- Historial clínico y modal de detalle
│               ├── citas.js          <-- Agenda clínica y citas
│               ├── stock.js          <-- Catálogo de productos y kardex
│               ├── ventas.js         <-- Terminal POS y recibos digitales
│               ├── configuracion.js  <-- Perfil profesional y mapa GPS
│               ├── subscriptions.js  <-- Estado de licencias y PINs
│               └── superadmin.js     <-- Panel maestro SuperAdmin
└── Tests/
    └── test_e2e_api.py               <-- Suite completa de pruebas de integración E2E
```

---

## 🖥️ 2. GUÍA DE PANTALLAS DEL SISTEMA, CONTENIDO Y FUNCIONES

### 2.1 Dashboard Principal (`dashboard-view`)
- **Contenido**:
  - Resumen KPI en tiempo real: Pacientes Registrados, Evaluaciones BIA Realizadas, Citas Programadas para Hoy, Productos en Alerta de Stock.
  - Acceso directo rápido a Calculadora BIA, Nuevo Paciente y Registro de Cita.
  - Gráfico interactivo de tendencia mensual de estudios realizados.
- **Funciones**:
  - Carga diferida de métricas para optimizar el tiempo de respuesta inicial.
  - Navegación directa hacia cualquier sección con un clic.

### 2.2 Calculadora de Bioimpedancia (`bio-view`)
- **Contenido**:
  - **Parámetros Físicos Básicos**: Peso (kg), Altura (cm), Edad (años), Género (Masculino/Femenino), Resistencia ($R$ en $\Omega$), Reactancia ($Xc$ en $\Omega$), PAL (Nivel de actividad física).
  - **Parámetros Avanzados del Dispositivo** (desplegable opcional): SMM (Masa muscular esquelética), TBW (Agua corporal total), ECW (Agua extracelular), Masa Grasa, Grasa Visceral, Perímetro de Cintura, Ángulo de Fase.
  - **Panel de Resultados Visuales**:
    - **Global TRU Score (0-100)**: Puntuación de salud celular con insignia de clasificación (*Especial, Normal, Bronce, Plata, Oro, Platino, Diamante*).
    - **Ángulo de Fase ($\phi$)**: Cálculo $\arctan(Xc/R) \times (180/\pi)$ e indicador de estado de integridad celular (*Óptimo, Robusto, Moderado, Crítico*).
    - **Gasto Calórico (TEE / REE)**: Tasa metabólica basal y gasto energético total en kcal/día y Mj/día.
    - **Gráfico BIVA Vectorial (Canvas 2D)**: Plano cartesiano $Z(R/H)$ vs $Z(Xc/H)$ con elipses de tolerancia del 50%, 75% y 95%.
    - **Matriz BCC (Balance Grasa vs Músculo)**: somatotipos (*I. Atlético, II. Equilibrado, III. Predominio Adiposo, IV. Riesgo Sarcopénico*).
    - **Velocímetro PAL**: Indicador gráfico del nivel de actividad física.
    - **Diagnóstico y Hallazgos Clínicos**: Generador de texto médico orientativo.
    - **Informe PDF Clínico**: Generación e impresión de informe médico de 2 páginas A4 perfectamente balanceadas con membrete y firma profesional.
- **Funciones**:
  - **Botonera de Acción**: *Analizar Composición* (cálculo en memoria), *Guardar Análisis* (persistencia explícita en BD Supabase), *Imprimir Informe* (PDF).
  - **Autocompletado de Pacientes**: Al ingresar el nombre de un paciente existente, el sistema completa automáticamente su edad, género, altura e IDP.

### 2.3 Historial de Evaluaciones Clínicas (`evaluaciones-view`)
- **Contenido**:
  - Tabla de evaluaciones registradas con código auto-incrementado (`EVA-001`, `EVA-002`, ...), paciente, IDP, parámetros y fecha.
  - Filtro de búsqueda en tiempo real por nombre, IDP o código de evaluación.
- **Funciones**:
  - **Vista Previa de Detalle (`openEvaluationDetailModal`)**: Abre modal con el desglose clínico completo (TRU Score, Ángulo de fase, TEE, diagnóstico y tabla de valores).
  - **Reciclaje Secuencial de Código**: Si se elimina la evaluación `EVA-007` de una lista de 15, la siguiente evaluación guardada ocupará automáticamente el código vacante `EVA-007`.
  - **Recargar en Calculadora**: Carga una evaluación guardada directamente en los campos del formulario BIA para re-analizar o comparar.
  - **Eliminación Individual y Masiva**.

### 2.4 Directorio de Pacientes (`clientes-view`)
- **Contenido**:
  - Ficha clínica del paciente con asignación de código `IDP-0001` auto-incrementado.
  - Datos de contacto: Nombre completo, Teléfono, Correo, Edad, Género.
  - Desplegable de evaluaciones asociadas al historial del paciente.
- **Funciones**:
  - Registro de nuevo paciente, edición de ficha y eliminación.
  - Botón directo para iniciar evaluación BIA pre-cargada.
  - Botón de mensajería instantánea por WhatsApp o Correo electrónico.

### 2.5 Agenda y Citas Médicas (`citas-view`)
- **Contenido**:
  - Calendario y lista cronológica de citas programadas.
  - Estado de la cita (*Confirmada, Pendiente, Atendida, Cancelada*).
- **Funciones**:
  - Agendamiento de nueva cita asociada al directorio de pacientes.
  - Modificación de fecha/hora y cancelación.

### 2.6 Inventario de Insumos / Stock (`stock-view`)
- **Contenido**:
  - Tabla de productos e insumos médicos y nutricionales (Código, Nombre, Categoría, Unidad, Stock Actual, Mínimo de Alerta, Precio Unitario).
  - Indicadores de alerta de desabastecimiento.
- **Funciones**:
  - Registro de productos, edición y eliminación.
  - **Ajuste Rápido de Stock**: Movimientos de Entrada/Salida con actualización del Kardex histórico.
  - Importación/Exportación de inventario en Excel.

### 2.7 Terminal POS y Ventas (`ventas-view`)
- **Contenido**:
  - Catálogo interactivo de productos seleccionables para carrito de compras.
  - Resumen de venta, cálculo de total, IVA/Descuento y método de pago.
- **Funciones**:
  - Checkout de venta con emisión de recibo digital imprimible.
  - Descuento automático en tiempo real del inventario en Stock y registro de movimiento.

### 2.8 Configuración y Perfil Profesional (`configuracion-view`)
- **Contenido**:
  - Credencial digital del especialista: Nombre, Título profesional, Matrícula médica, Centro clínico, Teléfono y Logo de la clínica.
  - Personalización de cláusula de responsabilidad (disclaimer) en los reportes PDF.
  - Mapa interactivo GPS del consultorio (integrado con Leaflet JS).
- **Funciones**:
  - Guardado de preferencias en perfil Supabase y sincronización en memoria local.

### 2.9 Panel SuperAdmin (`superadmin-view`)
- **Contenido**:
  - Tabla de Médicos Registrados en la plataforma.
  - Gestor de PINs de suscripción (*PIN, Duración en días, Estado de uso, Fecha de creación*).
  - Métricas globales de la plataforma SaaS.
- **Funciones**:
  - Generación de nuevos PINs de suscripción.
  - Extensión directa de días de licencia a cualquier médico.
  - Desactivación y eliminación de cuentas.

---

## 📡 3. INFORME DE ENDPOINTS REST Y SISTEMA CRUD

Todas las solicitudes API requieren el encabezado `Authorization: Bearer <token_jwt>` (excepto `/api/auth/login` y `/api/auth/register`).

| Blueprint | Método HTTP | Endpoint Path | Descripción / Acción CRUD |
| :--- | :--- | :--- | :--- |
| **Auth** | `POST` | `/api/auth/login` | Autentica usuario y retorna JWT + rol. |
| **Auth** | `POST` | `/api/auth/register` | Registra médico validando código PIN de licencia. |
| **Auth** | `GET` | `/api/auth/me` | Retorna los datos del perfil del usuario autenticado. |
| **Evaluations**| `POST` | `/api/dashboard-data` | **Carga/Cálculo BIA**: Procesa parámetros BIA. Si `save=false` calcula en memoria; si `save=true` persiste en BD. |
| **Evaluations**| `GET` | `/api/evaluations` | **Read All**: Retorna el historial de evaluaciones del médico activo. |
| **Evaluations**| `GET` | `/api/evaluations/<eval_id>` | **Read One**: Retorna el detalle clínico de una evaluación. Si faltan métricas, las re-calcula dinámicamente. |
| **Evaluations**| `DELETE`| `/api/evaluations/<eval_id>` | **Delete**: Elimina la evaluación y libera su código `EVA-XXX` para reciclaje. |
| **Evaluations**| `POST` | `/api/evaluations/batch-delete` | **Delete Batch**: Elimina múltiples evaluaciones en una sola transacción. |
| **Clients** | `GET` | `/api/clients` | **Read All**: Retorna los pacientes del médico activo. |
| **Clients** | `POST` | `/api/clients` | **Create**: Registra un nuevo paciente asignando `IDP-XXXX` auto-incrementado. |
| **Clients** | `PUT` | `/api/clients/<client_id>` | **Update**: Actualiza los datos demográficos del paciente. |
| **Clients** | `DELETE`| `/api/clients/<client_id>` | **Delete**: Elimina al paciente del directorio. |
| **Appointments**| `GET` | `/api/appointments` | **Read All**: Retorna las citas agendadas. |
| **Appointments**| `POST` | `/api/appointments` | **Create**: Agenda una nueva cita médica. |
| **Appointments**| `PUT` | `/api/appointments/<app_id>` | **Update**: Modifica fecha, hora o estado de la cita. |
| **Appointments**| `DELETE`| `/api/appointments/<app_id>` | **Delete**: Cancela/Elimina la cita. |
| **Stock** | `GET` | `/api/stock` | **Read All**: Retorna el catálogo de productos e insumos. |
| **Stock** | `POST` | `/api/stock` | **Create**: Crea un nuevo ítem en el inventario. |
| **Stock** | `PUT` | `/api/stock/<item_id>` | **Update**: Actualiza producto (nombre, precio, stock mínimo). |
| **Stock** | `POST` | `/api/stock/<item_id>/adjust` | **Adjust**: Incrementa/decrementa stock y registra movimiento en Kardex. |
| **Stock** | `DELETE`| `/api/stock/<item_id>` | **Delete**: Elimina el producto del inventario. |
| **Stock** | `GET` | `/api/stock/taxonomies` | **Read Taxonomies**: Retorna lista de categorías y unidades de medida. |
| **Sales** | `GET` | `/api/sales` | **Read All**: Retorna el historial de ventas registradas en el POS. |
| **Sales** | `POST` | `/api/sales` | **Create / Checkout**: Procesa venta, genera recibo y descuenta stock automáticamente. |
| **Subscriptions**| `GET` | `/api/subscriptions/status` | **Read**: Retorna días restantes de licencia y estado de activación. |
| **Subscriptions**| `POST` | `/api/subscriptions/redeem-pin` | **Redeem**: Canjea un código PIN de licencia para extender la suscripción. |
| **SuperAdmin** | `GET` | `/api/admin/users` | **Read Users**: Retorna lista global de médicos registrados. |
| **SuperAdmin** | `POST` | `/api/admin/users/<id>/extend` | **Update User**: Extiende directamente la vigencia de un usuario. |
| **SuperAdmin** | `DELETE`| `/api/admin/users/<id>` | **Delete User**: Elimina o revoca acceso a un usuario. |
| **SuperAdmin** | `GET` | `/api/admin/pins` | **Read PINs**: Retorna el listado de PINs generados. |
| **SuperAdmin** | `POST` | `/api/admin/pins` | **Create PIN**: Genera nuevos PINs de suscripción. |
| **SuperAdmin** | `DELETE`| `/api/admin/pins/<pin_id>` | **Delete PIN**: Revoca un PIN disponible. |

---

## 🎯 4. PRINCIPIOS DE DESARROLLO Y COMPROMISO DE CALIDAD

1. **Persistencia e Integridad**: Toda modificación en la interfaz debe estar respaldada por un endpoint backend documentado. Prohibido manipular datos globales fuera de sus módulos o usar fallbacks falsos.
2. **Escalabilidad y Limpieza**: Ningún archivo JS cliente debe exceder responsabilidades ajenas a su módulo. El archivo `app.js` se mantendrá como un orquestador ligero de inicialización (<100 líneas).
3. **Manejo de Errores e Inspección de Logs**: Ante cualquier fallo de runtime, la primera acción siempre será revisar los tracebacks completos de los logs antes de formular diagnósticos.
4. **Verificación Automatizada**: Tras cualquier refactorización o cambio en el código, se ejecutará la suite de pruebas `python Tests/test_e2e_api.py` para garantizar 100% de pasabilidad.
