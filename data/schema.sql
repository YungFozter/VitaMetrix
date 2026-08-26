-- ============================================================================
-- SCRIPT DE MIGRACIÓN Y ESQUEMA DE BASE DE DATOS SUPABASE - VITAMETRIX
-- ============================================================================

-- 1. Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLA DE CLIENTES / PACIENTES
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code INT UNIQUE,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(30),
    email VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABLA DE EVALUACIONES CLÍNICAS (BIVA & COMPOSICIÓN CORPORAL)
CREATE TABLE IF NOT EXISTS public.evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- Asegurar columna 'code' en caso de tabla existente previamente
ALTER TABLE public.evaluations ADD COLUMN IF NOT EXISTS code VARCHAR(20);
ALTER TABLE public.evaluations ADD COLUMN IF NOT EXISTS patient_idp VARCHAR(50);
ALTER TABLE public.evaluations ADD COLUMN IF NOT EXISTS patient_name VARCHAR(100) DEFAULT 'Paciente sin registrar';

-- 4. TABLA DE CITAS Y AGENDA CLÍNICA
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- 5. TABLA DE ARTÍCULOS DE STOCK / INVENTARIO CLÍNICO
CREATE TABLE IF NOT EXISTS public.stock_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
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

-- 6. TABLA DE KARDEX / MOVIMIENTOS DE STOCK
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- 7. TABLA DE VENTAS / RECIBOS DE CAJA
CREATE TABLE IF NOT EXISTS public.sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receipt_number VARCHAR(50) UNIQUE NOT NULL,
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
    status VARCHAR(20) DEFAULT 'COMPLETED', -- COMPLETED, CANCELLED
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. TABLA DE ÍTEMS DE VENTA
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

-- 9. ÍNDICES DE RENDIMIENTO DE BÚSQUEDA Y FILTRADO
CREATE INDEX IF NOT EXISTS idx_evaluations_created_at ON public.evaluations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evaluations_patient_idp ON public.evaluations(patient_idp);
CREATE INDEX IF NOT EXISTS idx_evaluations_code ON public.evaluations(code);
CREATE INDEX IF NOT EXISTS idx_clients_code ON public.clients(code);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON public.appointments(date);
CREATE INDEX IF NOT EXISTS idx_stock_items_code ON public.stock_items(code);
CREATE INDEX IF NOT EXISTS idx_stock_items_category ON public.stock_items(category);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON public.stock_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_item_id ON public.stock_movements(stock_item_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_receipt ON public.sales(receipt_number);

-- 10. SEGURIDAD Y POLÍTICAS RLS (Row Level Security)
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso anónimo/servicio para API backend
CREATE POLICY "Permitir acceso anonimo a clientes" ON public.clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso anonimo a evaluaciones" ON public.evaluations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso anonimo a citas" ON public.appointments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso anonimo a stock_items" ON public.stock_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso anonimo a stock_movements" ON public.stock_movements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso anonimo a sales" ON public.sales FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso anonimo a sale_items" ON public.sale_items FOR ALL USING (true) WITH CHECK (true);
