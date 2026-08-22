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

-- 5. ÍNDICES DE RENDIMIENTO DE BÚSQUEDA Y FILTRADO
CREATE INDEX IF NOT EXISTS idx_evaluations_created_at ON public.evaluations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evaluations_patient_idp ON public.evaluations(patient_idp);
CREATE INDEX IF NOT EXISTS idx_evaluations_code ON public.evaluations(code);
CREATE INDEX IF NOT EXISTS idx_clients_code ON public.clients(code);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON public.appointments(date);

-- 6. SEGURIDAD Y POLÍTICAS RLS (Row Level Security)
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso anónimo/servicio para API backend
CREATE POLICY "Permitir acceso anonimo a clientes" ON public.clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso anonimo a evaluaciones" ON public.evaluations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso anonimo a citas" ON public.appointments FOR ALL USING (true) WITH CHECK (true);
