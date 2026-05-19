-- ============================================================
--  REGIOBIZ — Schema completo de Supabase
--  Ejecuta este script en el SQL Editor de tu proyecto Supabase
-- ============================================================

-- ─── 1. EMPRESAS (TENANTS) ───────────────────────────────────────────────────
-- Guarda cada empresa registrada por el Super Master
CREATE TABLE IF NOT EXISTS public.tenants (
  id            TEXT PRIMARY KEY,            -- ej: "t_1716123456789"
  name          TEXT NOT NULL,               -- nombre de la empresa
  rif           TEXT NOT NULL,               -- RIF venezolano
  admin_email   TEXT NOT NULL UNIQUE,        -- correo del admin de la empresa
  admin_pass    TEXT NOT NULL,               -- contraseña (texto plano por ahora)
  plan          TEXT NOT NULL DEFAULT 'silver', -- bronze | silver | gold | enterprise
  status        TEXT NOT NULL DEFAULT 'active', -- active | suspended | trial
  cost          NUMERIC(10,2) DEFAULT 59.00,
  joined_date   TEXT NOT NULL,               -- ISO date string
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS pero permitir acceso con anon key (la app maneja su propia auth)
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON public.tenants
  FOR ALL USING (true) WITH CHECK (true);


-- ─── 2. TASA BCV ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bcv_rate (
  id         INT PRIMARY KEY DEFAULT 1,
  rate       NUMERIC(10,4) NOT NULL DEFAULT 36.45,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.bcv_rate ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON public.bcv_rate
  FOR ALL USING (true) WITH CHECK (true);

-- Insertar fila inicial si no existe
INSERT INTO public.bcv_rate (id, rate) VALUES (1, 36.45)
ON CONFLICT (id) DO NOTHING;


-- ─── 3. PRODUCTOS / INVENTARIO ───────────────────────────────────────────────
-- La clave primaria incluye el prefijo del tenant para aislamiento total
CREATE TABLE IF NOT EXISTS public.products (
  id           TEXT PRIMARY KEY,            -- formato: "{tenantId}_{código}"
  code         TEXT NOT NULL,
  name         TEXT NOT NULL,
  category     TEXT DEFAULT 'General',
  cost_usd     NUMERIC(10,4) DEFAULT 0,
  price_usd    NUMERIC(10,4) DEFAULT 0,
  stock        INT DEFAULT 0,
  tax_category TEXT DEFAULT 'exempt',       -- exempt | iva_16
  tenant_id    TEXT NOT NULL,               -- FK lógico a tenants.id
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON public.products
  FOR ALL USING (true) WITH CHECK (true);


-- ─── 4. CUENTAS FINANCIERAS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.financial_accounts (
  id          TEXT PRIMARY KEY,             -- formato: "{tenantId}_{accId}"
  name        TEXT NOT NULL,
  bank        TEXT DEFAULT '',
  balance_usd NUMERIC(12,4) DEFAULT 0,
  balance_bs  NUMERIC(14,4) DEFAULT 0,
  currency    TEXT DEFAULT 'USD',           -- USD | VES
  tenant_id   TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON public.financial_accounts
  FOR ALL USING (true) WITH CHECK (true);


-- ─── 5. SUB-USUARIOS POR EMPRESA ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sub_users (
  id          TEXT PRIMARY KEY,             -- formato: "sub_{timestamp}"
  tenant_id   TEXT NOT NULL,               -- FK lógico a tenants.id
  name        TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  password    TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'vendedor', -- vendedor | marketing
  permissions JSONB,                        -- la matriz de permisos individualizada
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.sub_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON public.sub_users
  FOR ALL USING (true) WITH CHECK (true);


-- ─── 6. HISTORIAL DE VENTAS ──────────────────────────────────────────────────
-- Registra cada transacción completada en el POS.
-- Requerida por: /dashboard/ventas, /dashboard/historial-ventas,
--                /dashboard/finanzas, /dashboard/page (métricas)
CREATE TABLE IF NOT EXISTS public.sales_history (
  id              TEXT PRIMARY KEY,           -- formato: "TKT-XXXXX"
  tenant_id       TEXT NOT NULL,             -- FK lógico a tenants.id
  control_number  TEXT,                      -- número de control fiscal CTRL-XXXXXXXX-XXXXX
  date            TEXT NOT NULL,             -- fecha legible en español (toLocaleString)
  created_at      TIMESTAMPTZ DEFAULT NOW(), -- para ordenar y filtrar por fecha real

  -- Cliente (puede ser nulo = Consumidor Final)
  client_doc      TEXT,                      -- RIF o Cédula
  client_name     TEXT,                      -- Razón Social
  client_address  TEXT,
  client_phone    TEXT,

  -- Totales bimonetarios
  subtotal_usd    NUMERIC(12,4) DEFAULT 0,
  tax_usd         NUMERIC(12,4) DEFAULT 0,   -- IVA 16%
  igtf_usd        NUMERIC(12,4) DEFAULT 0,   -- IGTF 3% sobre efectivo USD
  total_usd       NUMERIC(12,4) NOT NULL,
  total_bs        NUMERIC(14,4) NOT NULL,
  exchange_rate   NUMERIC(10,4) NOT NULL,    -- tasa BCV del momento de la venta

  -- Desglose de métodos de pago
  pay_cash_usd    NUMERIC(12,4) DEFAULT 0,
  pay_zelle       NUMERIC(12,4) DEFAULT 0,
  pay_cash_bs     NUMERIC(14,4) DEFAULT 0,
  pay_pago_movil  NUMERIC(14,4) DEFAULT 0,
  pay_pos_bs      NUMERIC(14,4) DEFAULT 0,

  -- Campo de texto descriptivo del método (ej. "Zelle + Pago Móvil")
  payment_method  TEXT DEFAULT '',

  -- Ítems de la venta (array JSON para no normalizar en exceso)
  -- Formato: [{ code, name, quantity, price_usd, tax_category }]
  items           JSONB NOT NULL DEFAULT '[]',

  -- Impresora Fiscal
  fiscal_serial   TEXT,                      -- S/N de impresora SENIAT (si fue factura fiscal)
  is_fiscal       BOOLEAN DEFAULT FALSE,

  -- Datos del vendedor
  seller_id       TEXT,                      -- user id del cajero
  seller_name     TEXT
);

ALTER TABLE public.sales_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON public.sales_history
  FOR ALL USING (true) WITH CHECK (true);

-- Índices para acelerar los filtros más frecuentes del historial
CREATE INDEX IF NOT EXISTS idx_sales_history_tenant ON public.sales_history (tenant_id);
CREATE INDEX IF NOT EXISTS idx_sales_history_created ON public.sales_history (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_history_tenant_created ON public.sales_history (tenant_id, created_at DESC);


-- ─── FIN DEL SCHEMA ──────────────────────────────────────────────────────────
-- Tras ejecutar esto en Supabase:
-- 1. Ve a Settings > API en Supabase y copia tu URL y anon key
-- 2. En Vercel: Settings > Environment Variables, añade:
--    NEXT_PUBLIC_SUPABASE_URL  = tu URL
--    NEXT_PUBLIC_SUPABASE_ANON_KEY = tu anon key
-- 3. Redeploy en Vercel para aplicar las variables
--
-- ⚠️  IMPORTANTE — Para ejecutar en una BD existente sin recrear tablas:
--     Solo ejecuta el bloque de "sales_history" de arriba si ya tienes
--     las demás tablas creadas. El CREATE TABLE IF NOT EXISTS es seguro.

