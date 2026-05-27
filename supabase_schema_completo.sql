-- ============================================================
--  REGIOBIZ ERP — Schema COMPLETO para Supabase
--  Versión: 2.0 — Incluye TODAS las tablas y columnas del sistema
--
--  INSTRUCCIONES:
--  1. Ve a tu proyecto en supabase.com
--  2. Abre el menú lateral → "SQL Editor"
--  3. Pega TODO este script y haz clic en "Run"
--  4. Si ya tienes tablas creadas, el script es seguro (usa IF NOT EXISTS)
-- ============================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. EMPRESAS (TENANTS)
--    Guarda cada empresa registrada por el Super Master (Carlos)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tenants (
  id            TEXT PRIMARY KEY,            -- ej: "t_1716123456789"
  name          TEXT NOT NULL,               -- nombre de la empresa
  rif           TEXT NOT NULL,               -- RIF venezolano  ej: J-12345678-9
  admin_email   TEXT NOT NULL UNIQUE,        -- correo del administrador/directora
  admin_pass    TEXT NOT NULL,               -- contraseña (texto plano por ahora)
  plan          TEXT NOT NULL DEFAULT 'silver', -- bronze | silver | gold | enterprise
  status        TEXT NOT NULL DEFAULT 'active', -- active | suspended | trial
  cost          NUMERIC(10,2) DEFAULT 59.00, -- costo mensual del plan
  joined_date   TEXT NOT NULL,               -- fecha de registro (ISO string)
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "tenants_allow_all" ON public.tenants
  FOR ALL USING (true) WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. TASA DE CAMBIO BCV
--    Almacena la tasa oficial del Banco Central de Venezuela (Bs/USD)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bcv_rate (
  id         INT PRIMARY KEY DEFAULT 1,      -- siempre es el registro 1 (fila única)
  rate       NUMERIC(10,4) NOT NULL DEFAULT 36.45,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.bcv_rate ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "bcv_allow_all" ON public.bcv_rate
  FOR ALL USING (true) WITH CHECK (true);

-- Fila inicial de tasa (solo se inserta si no existe)
INSERT INTO public.bcv_rate (id, rate)
VALUES (1, 36.45)
ON CONFLICT (id) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. PRODUCTOS / INVENTARIO
--    Tabla central. Cada fila es un producto de una empresa específica.
--
--    COLUMNAS PARA EL MÓDULO DE INVENTARIO:
--      cost_usd   → Costo unitario (USD)
--      stock      → Existencia actual
--      (Valor de inventario = cost_usd × stock, se calcula en el frontend)
--
--    COLUMNAS PARA EL MÓDULO POS:
--      price_usd  → Precio de venta SIN IVA (USD)
--      tax_category → Si aplica IVA: precio CON IVA = price_usd × 1.16
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.products (
  id           TEXT PRIMARY KEY,            -- formato: "{tenantId}_{código_de_barras}"
  tenant_id    TEXT NOT NULL,               -- FK lógico → tenants.id
  code         TEXT NOT NULL,               -- código de barras / SKU
  name         TEXT NOT NULL,               -- nombre comercial del producto
  category     TEXT DEFAULT 'General',      -- categoría (Alimentos, Bebidas, etc.)

  -- ── INVENTARIO ─────────────────────────────────────────────────────────
  cost_usd     NUMERIC(10,4) DEFAULT 0,     -- costo de compra/proveedor en USD
  stock        INT DEFAULT 0,               -- cantidad en existencia

  -- ── PRECIOS DE VENTA (POS) ────────────────────────────────────────────
  price_usd    NUMERIC(10,4) DEFAULT 0,     -- precio de venta SIN IVA en USD
                                            -- precio CON IVA = price_usd * 1.16 (si iva_16)
  tax_category TEXT DEFAULT 'exempt'        -- exempt = exento | iva_16 = IVA 16%
    CHECK (tax_category IN ('exempt', 'iva_16')),

  -- ── METADATOS ─────────────────────────────────────────────────────────
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "products_allow_all" ON public.products
  FOR ALL USING (true) WITH CHECK (true);

-- Índices para acelerar búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_products_tenant    ON public.products (tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_code      ON public.products (code);
CREATE INDEX IF NOT EXISTS idx_products_category  ON public.products (tenant_id, category);


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. CUENTAS FINANCIERAS
--    Usadas en el módulo de Finanzas para registrar saldos bimonetarios
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.financial_accounts (
  id          TEXT PRIMARY KEY,             -- formato: "{tenantId}_{accId}"
  tenant_id   TEXT,                         -- FK lógico → tenants.id
  name        TEXT NOT NULL,               -- nombre de la cuenta (ej: "Caja Principal")
  bank        TEXT DEFAULT '',             -- banco o entidad financiera
  balance_usd NUMERIC(12,4) DEFAULT 0,    -- saldo en dólares
  balance_bs  NUMERIC(14,4) DEFAULT 0,    -- saldo en bolívares
  currency    TEXT DEFAULT 'USD'           -- moneda principal: USD | VES
    CHECK (currency IN ('USD', 'VES')),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "financial_accounts_allow_all" ON public.financial_accounts
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_financial_accounts_tenant ON public.financial_accounts (tenant_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. SUB-USUARIOS POR EMPRESA
--    Vendedoras, marketing y otros roles que acceden con credenciales propias
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sub_users (
  id          TEXT PRIMARY KEY,             -- formato: "sub_{timestamp}"
  tenant_id   TEXT NOT NULL,               -- FK lógico → tenants.id
  name        TEXT NOT NULL,               -- nombre completo
  email       TEXT NOT NULL UNIQUE,        -- correo de acceso (único global)
  password    TEXT NOT NULL,               -- contraseña (texto plano por ahora)
  role        TEXT NOT NULL DEFAULT 'vendedor'  -- vendedor | marketing
    CHECK (role IN ('vendedor', 'marketing')),
  permissions JSONB,                        -- matriz de permisos personalizada (opcional)
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sub_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "sub_users_allow_all" ON public.sub_users
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_sub_users_tenant ON public.sub_users (tenant_id);
CREATE INDEX IF NOT EXISTS idx_sub_users_email  ON public.sub_users (email);


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. HISTORIAL DE VENTAS (POS)
--    Cada fila = 1 transacción completada en el Punto de Venta
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sales_history (
  id              TEXT PRIMARY KEY,           -- formato: "TKT-XXXXX"
  tenant_id       TEXT NOT NULL,             -- FK lógico → tenants.id
  control_number  TEXT,                      -- número de control fiscal: CTRL-XXXXXXXX-XXXXX
  date            TEXT NOT NULL,             -- fecha legible (toLocaleString)
  created_at      TIMESTAMPTZ DEFAULT NOW(), -- para ordenar y filtrar por fecha real

  -- ── DATOS DEL CLIENTE (puede ser nulo = Consumidor Final) ────────────
  client_doc      TEXT,                      -- RIF o Cédula
  client_name     TEXT,                      -- Razón Social o nombre
  client_address  TEXT,                      -- Dirección fiscal
  client_phone    TEXT,                      -- Teléfono de contacto

  -- ── TOTALES BIMONETARIOS ────────────────────────────────────────────
  subtotal_usd    NUMERIC(12,4) DEFAULT 0,  -- subtotal antes de impuestos
  tax_usd         NUMERIC(12,4) DEFAULT 0,  -- IVA 16% calculado
  igtf_usd        NUMERIC(12,4) DEFAULT 0,  -- IGTF 3% sobre efectivo USD
  total_usd       NUMERIC(12,4) NOT NULL,   -- total final en dólares
  total_bs        NUMERIC(14,4) NOT NULL,   -- total final en bolívares
  exchange_rate   NUMERIC(10,4) NOT NULL,   -- tasa BCV del momento de la venta

  -- ── DESGLOSE DE MÉTODOS DE PAGO (Bimonetario) ───────────────────────
  pay_cash_usd    NUMERIC(12,4) DEFAULT 0,  -- efectivo dólares
  pay_zelle       NUMERIC(12,4) DEFAULT 0,  -- Zelle / transferencia USD
  pay_cash_bs     NUMERIC(14,4) DEFAULT 0,  -- efectivo bolívares
  pay_pago_movil  NUMERIC(14,4) DEFAULT 0,  -- pago móvil (bolívares)
  pay_pos_bs      NUMERIC(14,4) DEFAULT 0,  -- punto de venta tarjeta (bolívares)
  payment_method  TEXT DEFAULT '',          -- texto descriptivo: "Zelle + Pago Móvil"

  -- ── ÍTEMS DE LA VENTA ───────────────────────────────────────────────
  -- Array JSON: [{ code, name, quantity, price_usd, tax_category }]
  items           JSONB NOT NULL DEFAULT '[]',

  -- ── IMPRESORA FISCAL SENIAT ──────────────────────────────────────────
  fiscal_serial   TEXT,                     -- S/N de impresora fiscal (solo si es fiscal)
  is_fiscal       BOOLEAN DEFAULT FALSE,    -- true = factura fiscal SENIAT

  -- ── VENDEDOR ────────────────────────────────────────────────────────
  seller_id       TEXT,                     -- ID del cajero/vendedor
  seller_name     TEXT                      -- nombre del cajero/vendedor
);

ALTER TABLE public.sales_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "sales_history_allow_all" ON public.sales_history
  FOR ALL USING (true) WITH CHECK (true);

-- Índices para acelerar reportes y filtros del historial
CREATE INDEX IF NOT EXISTS idx_sales_tenant         ON public.sales_history (tenant_id);
CREATE INDEX IF NOT EXISTS idx_sales_created        ON public.sales_history (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_tenant_created ON public.sales_history (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_is_fiscal      ON public.sales_history (tenant_id, is_fiscal);


-- ─────────────────────────────────────────────────────────────────────────────
-- FIN DEL SCHEMA — REGIOBIZ ERP v2.0
-- ─────────────────────────────────────────────────────────────────────────────
--
--  RESUMEN DE TABLAS:
--  ┌─────────────────────┬──────────────────────────────────────────────────┐
--  │ Tabla               │ Uso en el sistema                                │
--  ├─────────────────────┼──────────────────────────────────────────────────┤
--  │ tenants             │ Empresas registradas en el SaaS                  │
--  │ bcv_rate            │ Tasa de cambio BCV (fila única, id=1)            │
--  │ products            │ Inventario: cost+stock | POS: price_usd+tax      │
--  │ financial_accounts  │ Cuentas del módulo de finanzas                   │
--  │ sub_users           │ Vendedoras y marketing de cada empresa           │
--  │ sales_history       │ Historial de ventas del POS                      │
--  └─────────────────────┴──────────────────────────────────────────────────┘
--
--  PRÓXIMOS PASOS DESPUÉS DE EJECUTAR:
--  1. Ve a Supabase → Settings → API
--  2. Copia "Project URL" y "anon public key"
--  3. Crea (o edita) el archivo .env.local en la raíz del proyecto:
--       NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
--       NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
--  4. Reinicia el servidor: npm run dev
-- ─────────────────────────────────────────────────────────────────────────────
