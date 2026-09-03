# 📘 VITAMETRIX - GUÍA MAESTRA DE ARQUITECTURA, PANTALLAS, ENDPOINTS Y BASE DE DATOS

Este documento constituye la **norma técnica y arquitectónica obligatoria** para la estructura de código, organización de archivos, comportamiento de pantallas, esquema de base de datos y contrato de la API REST del sistema **VitaMetrix**.

---

## 📂 1. NORMAS DE UBICACIÓN Y ESTRUCTURA DE ARCHIVOS

### 1.1 Regla Estricta de Modularidad
1. **Un Módulo por Sección**: Cada sección o pantalla del sistema posee su propio módulo frontend JavaScript en `frontend/static/js/modules/`, su plantilla parcial HTML en `frontend/templates/partials/`, sus estilos CSS en `frontend/static/css/modules/` o archivos CSS modulares dedicados (`auth.css`, `superadmin.css`, `bioimpedancia.css`, etc.) importados en `style.css` y su correspondiente Blueprint en Python Flask (`backend/blueprints/`).
2. **Nombres Coincidentes por Relación**: Los archivos relacionados con una misma funcionalidad deben conservar el mismo nombre base.
   - *Ejemplo Stock*: `stock.html`, `stock.js`, `stock.css`, `backend/blueprints/stock.py`.
   - *Ejemplo Bioimpedancia*: `bioimpedancia.html`, `bioimpedancia.js`, `bioimpedancia.css`, `backend/blueprints/evaluations.py`.

### 1.2 Estructura Actualizada del Proyecto

```text
VitaMetrix/
├── SYSTEM_GUIDE.md                   <-- Guía maestra de arquitectura (ESTE ARCHIVO)
├── DATABASE_GUIDE.md                 <-- Guía DDL y consultas de Base de Datos Supabase SQL
├── backend/
│   ├── app.py                        <-- Factoría Flask, CORS, registro de blueprints y manejo global de errores
│   ├── services/
│   │   ├── helpers.py                <-- Métodos auxiliares de BD, autenticación y persistencia híbrida
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
│       │   ├── style.css             <-- Manifiesto CSS principal (Imports modulares)
│       │   ├── base.css              <-- Variables globales y reseteo
│       │   ├── layout.css            <-- Enrutamiento visual SPA y barra lateral
│       │   ├── components.css        <-- Componentes reutilizables (Modales, Toasters, Cards)
│       │   ├── auth.css              <-- Módulo CSS de inicio de sesión Stitch
│       │   ├── superadmin.css        <-- Módulo CSS de gestión SuperAdmin
│       │   ├── dashboard.css         <-- Estilos de métricas Dashboard
│       │   ├── bioimpedancia.css     <-- Formulario BIA, BIVA 2D, Matriz BCC y PAL
│       │   ├── evaluaciones.css      <-- Historial clínico y modales de detalle
│       │   ├── citas.css             <-- Calendario y citas
│       │   ├── configuracion.css     <-- Perfil profesional y mapa GPS
│       │   └── stock.css             <-- Catálogo de productos y Kardex
│       └── js/
│           ├── app.js                <-- Orquestador principal ultraligero (~54 líneas)
│           ├── ui-enhancements.js    <-- Animaciones y componentes visuales
│           └── modules/              <-- MÓDULOS DE LÓGICA DE NEGOCIO
│               ├── utils.js          <-- Sanitización XSS, toasters, alertas y reloj
│               ├── auth.js           <-- JWT, sesiones y control de acceso
│               ├── navigation.js     <-- Enrutador SPA, pestañas y sidebar
│               ├── dashboard.js      <-- Métricas reactivas Dashboard y recientes
│               ├── bioimpedancia.js  <-- Formulario BIA, gráficos BIVA/PAL/BCC y PDF
│               ├── pacientes.js     <-- Directorio de pacientes y mensajería
│               ├── evaluaciones.js   <-- Historial clínico y modal de detalle
│               ├── citas.js          <-- Agenda clínica y citas
│               ├── stock.js          <-- Catálogo de productos y kardex
│               ├── ventas.js         <-- Terminal POS y recibos digitales
│               ├── configuracion.js  <-- Perfil profesional y mapa GPS
│               ├── subscriptions.js  <-- Estado de licencias y PINs
│               └── superadmin.js     <-- Panel maestro SuperAdmin
├── data/
│   ├── schema.sql                    <-- Script DDL oficial de PostgreSQL / Supabase
│   ├── reference_tables.json         <-- Tablas de referencia bioeléctrica y percentiles
│   └── users.json                    <-- Almacenamiento local persistente
└── Tests/
    └── test_e2e_api.py               <-- Suite completa de pruebas de integración E2E (14/14 OK)
```

---

## 🗄️ 2. BASE DE DATOS Y PERSISTENCIA HÍBRIDA

VitaMetrix opera bajo un esquema **Dual Persistence System**:
1. **Supabase Cloud (PostgreSQL)**: Tablas públicas relacionales (`users`, `subscription_licenses`, `clients`, `evaluations`, `appointments`, `stock_items`, `stock_movements`, `sales`, `sale_items`).
2. **Local Disk Backup & System Store**: Almacenamiento local seguro en `data/*.json` y respaldos en bloques `__SYS_XXXX_STORE__` para garantizar tolerancia total a fallos.
3. Para la creación y migración DDL completa de la base de datos Supabase, consultar la guía dedicada **[DATABASE_GUIDE.md](file:///e:/Proyectos/VitaMetrix/DATABASE_GUIDE.md)** o ejecutar `data/schema.sql`.

---

## 🖥️ 3. GUÍA DE PANTALLAS DEL SISTEMA, CONTENIDO Y FUNCIONES

### 3.1 Dashboard Principal (`dashboard-view`)
- **Contenido**: KPIs en tiempo real (Pacientes, Evaluaciones BIA, Citas de hoy, Alertas de Stock) y gráfico interactivo de tendencia mensual.
- **Funciones**: Carga diferida en segundo plano (`requestIdleCallback`) para optimizar el hilo principal.

### 3.2 Calculadora de Bioimpedancia (`bio-view`)
- **Contenido**:
  - Parámetros básicos ($R, Xc$, Peso, Altura, Edad, Género, PAL).
  - Parámetros del dispositivo (SMM, TBW, ECW, Masa Grasa, Grasa Visceral, Cintura, Ángulo de Fase).
  - Panel Visual: **Global TRU Score (0-100)**, **Ángulo de Fase ($\phi$)**, **Gasto Calórico TEE/REE**, **BIVA Vectorial 2D**, **Matriz BCC (Grasa vs Músculo)**, **Velocímetro PAL** y **Diagnóstico Clínico**.
- **Funciones**:
  - *Analizar Composición*: Cálculo dinámico en memoria (cliente/servidor).
  - *Guardar Análisis*: Persistencia explícita en BD con asignación reciclada de código `EVA-XXX`.
  - *Imprimir Informe*: Generador PDF clínico A4 de 2 páginas balanceadas.
  - *Autocompletado de Pacientes*: Autocompleta datos del paciente seleccionado por nombre.

### 3.3 Historial de Evaluaciones Clínicas (`evaluaciones-view`)
- **Contenido**: Tabla de evaluaciones registradas con código secuencial (`EVA-001`, `EVA-002`, ...), paciente, IDP, parámetros y fecha.
- **Funciones**:
  - *Modal de Detalle (`openEvaluationDetailModal`)*: Recálculo dinámico de BIA en tiempo real y formato de fecha/hora en zona horaria local.
  - *Recargar en Calculadora*: Rellena el formulario BIA con una evaluación guardada.
  - *Reciclaje de IDs*: Al borrar `EVA-007`, la siguiente evaluación guardada reutilizará el código libre `EVA-007`.

### 3.4 Directorio de Pacientes (`clientes-view`)
- **Contenido**: Pacientes registrados con código `IDP-0001` auto-incrementado, historial cruzado y mensajería rápida (WhatsApp/Email).

### 3.5 Agenda y Citas Médicas (`citas-view`)
- **Contenido**: Calendario y lista cronológica de citas clínicas con control de estado (*Confirmada, Pendiente, Atendida, Cancelada*).

### 3.6 Inventario de Insumos / Stock (`stock-view`)
- **Contenido**: Catálogo de insumos médicos/nutricionales, alertas por stock mínimo y ajuste rápido (Entrada/Salida) con registro en Kardex.

### 3.7 Terminal POS y Ventas (`ventas-view`)
- **Contenido**: Carrito de compras de productos/servicios, emisión de recibos digitales y descuento automático en el inventario de stock.

### 3.8 Configuración y Perfil Profesional (`configuracion-view`)
- **Contenido**: Credencial digital del médico (Nombre, Título, Matrícula MP, Clínica, Logo), disclaimer PDF y mapa GPS del consultorio (Leaflet JS).

### 3.9 Panel SuperAdmin (`superadmin-view`)
- **Contenido**: Control de médicos registrados, generación/revocación de PINs de suscripción y extensión directa de días de licencia.

---

## 📡 4. INFORME DE ENDPOINTS REST Y SISTEMA CRUD

| Blueprint | Método | Endpoint Path | Función / Operación CRUD |
| :--- | :--- | :--- | :--- |
| **Auth** | `POST` | `/api/auth/login` | Autentica usuario y retorna token JWT. |
| **Auth** | `POST` | `/api/auth/register` | Registra médico validando código PIN de licencia. |
| **Auth** | `GET` | `/api/auth/me` | Retorna los datos del perfil del usuario autenticado. |
| **Evaluations**| `POST` | `/api/dashboard-data` | Procesa parámetros BIA. Si `save=false` calcula en memoria; si `save=true` persiste en BD. |
| **Evaluations**| `GET` | `/api/evaluations` | Retorna el historial de evaluaciones del médico activo. |
| **Evaluations**| `GET` | `/api/evaluations/<eval_id>` | Retorna detalle de evaluación. Si faltan métricas, las re-calcula dinámicamente. |
| **Evaluations**| `DELETE`| `/api/evaluations/<eval_id>` | Elimina la evaluación y libera su código `EVA-XXX` para reciclaje. |
| **Evaluations**| `POST` | `/api/evaluations/batch-delete` | Elimina múltiples evaluaciones en una sola transacción. |
| **Clients** | `GET` | `/api/clients` | Retorna el directorio de pacientes. |
| **Clients** | `POST` | `/api/clients` | Registra un nuevo paciente asignando `IDP-XXXX` auto-incrementado. |
| **Clients** | `PUT` | `/api/clients/<client_id>` | Actualiza los datos demográficos del paciente. |
| **Clients** | `DELETE`| `/api/clients/<client_id>` | Elimina al paciente del directorio. |
| **Appointments**| `GET` | `/api/appointments` | Retorna las citas agendadas. |
| **Appointments**| `POST` | `/api/appointments` | Agenda una nueva cita médica. |
| **Appointments**| `PUT` | `/api/appointments/<app_id>` | Modifica fecha, hora o estado de la cita. |
| **Appointments**| `DELETE`| `/api/appointments/<app_id>` | Cancela/Elimina la cita. |
| **Stock** | `GET` | `/api/stock` | Retorna el catálogo de productos e insumos. |
| **Stock** | `POST` | `/api/stock` | Crea un nuevo ítem en el inventario. |
| **Stock** | `PUT` | `/api/stock/<item_id>` | Actualiza producto (nombre, precio, stock mínimo). |
| **Stock** | `POST` | `/api/stock/<item_id>/adjust` | Incrementa/decrementa stock y registra movimiento en Kardex. |
| **Stock** | `DELETE`| `/api/stock/<item_id>` | Elimina el producto del inventario. |
| **Stock** | `GET` | `/api/stock/taxonomies` | Retorna lista de categorías y unidades de medida. |
| **Sales** | `GET` | `/api/sales` | Retorna el historial de ventas registradas en el POS. |
| **Sales** | `POST` | `/api/sales` | Procesa venta, genera recibo y descuenta stock automáticamente. |
| **Subscriptions**| `GET` | `/api/subscriptions/status` | Retorna días restantes de licencia y estado de activación. |
| **Subscriptions**| `POST` | `/api/subscriptions/redeem-pin` | Canjea un código PIN para extender la suscripción. |
| **SuperAdmin** | `GET` | `/api/admin/users` | Retorna lista global de médicos registrados. |
| **SuperAdmin** | `POST` | `/api/admin/users/<id>/extend` | Extiende directamente la vigencia de un usuario. |
| **SuperAdmin** | `DELETE`| `/api/admin/users/<id>` | Elimina o revoca acceso a un usuario. |
| **SuperAdmin** | `GET` | `/api/admin/pins` | Retorna el listado de PINs generados. |
| **SuperAdmin** | `POST` | `/api/admin/pins` | Genera nuevos PINs de suscripción. |
| **SuperAdmin** | `DELETE`| `/api/admin/pins/<pin_id>` | Revoca un PIN disponible. |

---

## 🎯 5. MANTENIMIENTO Y CONTROL DE CAMBIOS OBLIGATORIO

Para mantener la integridad arquitectónica del proyecto VitaMetrix:
1. **Actualización Continua**: Cada vez que se agregue un nuevo módulo, se elimine un archivo o se modifique un endpoint, **este archivo (`SYSTEM_GUIDE.md`) y `DATABASE_GUIDE.md` deben ser actualizados inmediatamente**.
2. **Validación E2E**: Tras cualquier refactorización, ejecutar la suite de pruebas automatizadas:
   ```bash
   python Tests/test_e2e_api.py
   ```
