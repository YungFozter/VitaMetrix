# 🗄️ VITAMETRIX - GUÍA DE MIGRACIÓN Y BASE DE DATOS SUPABASE

Este documento contiene la **especificación técnica completa del esquema de base de datos PostgreSQL en Supabase Cloud**, así como los scripts DDL de creación de tablas, índices de rendimiento, políticas RLS y usuario semilla SuperAdmin.

---

## 📋 1. MIGRACIÓN SQL COMPLETA SUPABASE

Para inicializar o sincronizar la estructura de la base de datos en Supabase Dashboard:
1. Entra a **Supabase Dashboard** $\rightarrow$ tu proyecto VitaMetrix.
2. Ve a la pestaña **SQL Editor** $\rightarrow$ **New Query**.
3. Copia, pega y ejecuta el siguiente script DDL:

```sql
-- ============================================================================
-- SCRIPT COMPLETO DE ESTRUCTURA Y CONEXIONES BASE DE DATOS SUPABASE - VITAMETRIX
-- ============================================================================

-- 1. Habilitar extensión UUID para identificadores únicos
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLA DE USUARIOS Y PROFESIONALES (DOCTORES Y ADMINS)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(180) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    professional_title VARCHAR(100) DEFAULT 'Nutricionista / Especialista BIA',
    clinic_name VARCHAR(150) DEFAULT 'Mi Consultorio VitaMetrix',
    phone VARCHAR(30),
    role VARCHAR(20) DEFAULT 'user', -- 'admin', 'user'
    subscription_status VARCHAR(20) DEFAULT 'trial', -- 'trial', 'active', 'expired', 'lifetime'
    subscription_plan VARCHAR(50) DEFAULT 'Plan de Prueba (7 días)',
    subscription_expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    trial_started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABLA DE LICENCIAS Y CÓDIGOS DE ACTIVACIÓN PIN SAAS
CREATE TABLE IF NOT EXISTS public.subscription_licenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pin_code VARCHAR(50) UNIQUE NOT NULL,
    license_key VARCHAR(50),
    duration_days INT NOT NULL DEFAULT 30,
    plan_name VARCHAR(50) DEFAULT 'Plan Pro Mensual (30 días)',
    is_used BOOLEAN DEFAULT FALSE,
    used_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    used_by_email VARCHAR(180),
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. TABLA DE CLIENTES / PACIENTES
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    code INT UNIQUE,
    patient_idp VARCHAR(50),
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(30),
    email VARCHAR(100),
    gender VARCHAR(10) DEFAULT 'male',
    age INT,
    weight NUMERIC(5, 2),
    height NUMERIC(5, 2),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. TABLA DE EVALUACIONES CLÍNICAS BIA
CREATE TABLE IF NOT EXISTS public.evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    code VARCHAR(20),
    patient_idp VARCHAR(50),
    patient_name VARCHAR(100) DEFAULT 'Paciente sin registrar',
    resistance NUMERIC(6, 2) NOT NULL,
    reactance NUMERIC(6, 2) NOT NULL,
    weight NUMERIC(5, 2) NOT NULL,
    height NUMERIC(5, 2) NOT NULL,
    age INT NOT NULL,
    gender VARCHAR(10) NOT NULL,
    pal NUMERIC(3, 2) DEFAULT 1.2,
    global_score INT,
    muscle_score INT,
    fat_score INT,
    smm NUMERIC(5, 2),
    tbw NUMERIC(5, 2),
    ecw NUMERIC(5, 2),
    fat_mass NUMERIC(5, 2),
    visceral_fat NUMERIC(5, 2),
    waist NUMERIC(5, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. TABLA DE CITAS Y AGENDA CLÍNICA
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    patient_name VARCHAR(100) NOT NULL,
    patient_phone VARCHAR(30),
    patient_idp VARCHAR(50),
    date DATE NOT NULL,
    time TIME NOT NULL,
    type VARCHAR(50) DEFAULT 'Evaluación Inicial BIA',
    status VARCHAR(20) DEFAULT 'confirmed',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. TABLA DE ARTÍCULOS DE STOCK / INVENTARIO CLÍNICO
CREATE TABLE IF NOT EXISTS public.stock_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(80) DEFAULT 'Otros',
    unit VARCHAR(50) DEFAULT 'Unidad (u)',
    stock_quantity NUMERIC(10, 2) DEFAULT 0,
    min_stock NUMERIC(10, 2) DEFAULT 5,
    cost_price NUMERIC(10, 2) DEFAULT 0,
    sale_price NUMERIC(10, 2) DEFAULT 0,
    supplier VARCHAR(150),
    location VARCHAR(150),
    batch_number VARCHAR(100),
    expiry_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. TABLA DE KARDEX / MOVIMIENTOS DE STOCK
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    stock_item_id VARCHAR(100) NOT NULL,
    item_name VARCHAR(150) NOT NULL,
    type VARCHAR(20) NOT NULL, -- IN, OUT, ADJUST, SALE, SALE_CANCEL
    quantity NUMERIC(10, 2) NOT NULL,
    previous_quantity NUMERIC(10, 2) NOT NULL,
    new_quantity NUMERIC(10, 2) NOT NULL,
    reason TEXT,
    reference_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. TABLA DE VENTAS / RECIBOS POS
CREATE TABLE IF NOT EXISTS public.sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    receipt_number VARCHAR(50) NOT NULL,
    patient_name VARCHAR(100) NOT NULL,
    patient_idp VARCHAR(50),
    patient_phone VARCHAR(30),
    subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0,
    discount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    total NUMERIC(10, 2) NOT NULL DEFAULT 0,
    total_cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
    profit NUMERIC(10, 2) NOT NULL DEFAULT 0,
    payment_method VARCHAR(50) DEFAULT 'Efectivo',
    amount_received NUMERIC(10, 2) DEFAULT 0,
    change_given NUMERIC(10, 2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'COMPLETED',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. TABLA DE ÍTEMS DETALLE DE VENTA
CREATE TABLE IF NOT EXISTS public.sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE,
    stock_item_id VARCHAR(100) NOT NULL,
    code VARCHAR(50),
    name VARCHAR(150) NOT NULL,
    unit VARCHAR(50),
    quantity NUMERIC(10, 2) NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL,
    cost_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    subtotal NUMERIC(10, 2) NOT NULL
);

-- 11. ÍNDICES DE RENDIMIENTO PARA OPTIMIZAR BÚSQUEDAS
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_evaluations_created_at ON public.evaluations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evaluations_patient_idp ON public.evaluations(patient_idp);
CREATE INDEX IF NOT EXISTS idx_clients_code ON public.clients(code);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON public.appointments(date);
CREATE INDEX IF NOT EXISTS idx_stock_items_code ON public.stock_items(code);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON public.stock_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales(created_at DESC);

-- 12. HABILITAR SEGURIDAD RLS (Row Level Security)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso para API Backend
DROP POLICY IF EXISTS "Permitir acceso a users" ON public.users;
DROP POLICY IF EXISTS "Permitir acceso a subscription_licenses" ON public.subscription_licenses;
DROP POLICY IF EXISTS "Permitir acceso a clientes" ON public.clients;
DROP POLICY IF EXISTS "Permitir acceso a evaluaciones" ON public.evaluations;
DROP POLICY IF EXISTS "Permitir acceso a citas" ON public.appointments;
DROP POLICY IF EXISTS "Permitir acceso a stock_items" ON public.stock_items;
DROP POLICY IF EXISTS "Permitir acceso a stock_movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Permitir acceso a sales" ON public.sales;
DROP POLICY IF EXISTS "Permitir acceso a sale_items" ON public.sale_items;

CREATE POLICY "Permitir acceso a users" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso a subscription_licenses" ON public.subscription_licenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso a clientes" ON public.clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso a evaluaciones" ON public.evaluations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso a citas" ON public.appointments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso a stock_items" ON public.stock_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso a stock_movements" ON public.stock_movements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso a sales" ON public.sales FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso a sale_items" ON public.sale_items FOR ALL USING (true) WITH CHECK (true);

-- 13. REGISTRAR USUARIO SUPERADMIN INICIAL
INSERT INTO public.users (
    id, email, password_hash, full_name, professional_title, clinic_name, phone, role, subscription_status, subscription_plan, subscription_expires_at, trial_started_at, created_at
) VALUES (
    'a1b2c3d4-e5f6-7890-abcd-1234567890ab',
    'admin@vitametrix.com',
    'scrypt:32768:8:1$bzpjSyc951JPHK3B$f3c20af484775f2df2612cf620c2e406d46a708cda8ebf739d69d51abde2b08a46ee3dc3ed7178c5ef5bed182635d14ee5573374e2a29e3780d176044a44330a',
    'Administrador General',
    'Director / Administrador de Plataforma',
    'Sede Central VitaMetrix',
    '+59172125280',
    'admin',
    'lifetime',
    'Plan Ilimitado / Administrador',
    '2099-12-31 23:59:59+00',
    NOW(),
    NOW()
) ON CONFLICT (email) DO NOTHING;
```

---

## 🛠️ 2. RESUMEN DE TABLAS Y RELACIONES

1. **`users`**: Médicos y Administradores de la plataforma.
2. **`subscription_licenses`**: PINs de suscripción comercial (Clave foránea `used_by_user_id` $\rightarrow$ `users.id`).
3. **`clients`**: Directorio de pacientes (Clave foránea `user_id` $\rightarrow$ `users.id`).
4. **`evaluations`**: Estudios BIA e historial clínico (Clave foránea `user_id` $\rightarrow$ `users.id`).
5. **`appointments`**: Agenda clínica de citas (Clave foránea `user_id` $\rightarrow$ `users.id`).
6. **`stock_items`**: Inventario de productos e insumos (Clave foránea `user_id` $\rightarrow$ `users.id`).
7. **`stock_movements`**: Kardex de entradas/salidas de stock (Clave foránea `user_id` $\rightarrow$ `users.id`).
8. **`sales`**: Recibos y transacciones POS (Clave foránea `user_id` $\rightarrow$ `users.id`).
9. **`sale_items`**: Detalle de productos por venta (Clave foránea `sale_id` $\rightarrow$ `sales.id`).
