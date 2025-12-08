-- Migração: Separar Work Orders por Cliente
-- Data: 2025-11-09

-- Step 1: Criar tabela customer_counters
CREATE TABLE IF NOT EXISTS customer_counters (
  id VARCHAR PRIMARY KEY,
  customer_id VARCHAR NOT NULL REFERENCES customers(id),
  key VARCHAR NOT NULL,
  next_number INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(customer_id, key)
);

-- Step 2: Preencher customer_id nas work_orders existentes baseado na zona
UPDATE work_orders wo
SET customer_id = z.customer_id
FROM zones z
WHERE wo.zone_id = z.id
  AND wo.customer_id IS NULL;

-- Step 3: Dropar a constraint antiga (company_id, number)
DROP INDEX IF EXISTS work_orders_company_number_unique;

-- Step 4: Criar nova constraint (customer_id, number)
CREATE UNIQUE INDEX IF NOT EXISTS work_orders_customer_number_unique 
  ON work_orders(customer_id, number);

-- Step 5: Criar counters por cliente baseado nos counters de company
-- Para cada customer, criar um counter de work_order com o próximo número baseado no máximo atual
INSERT INTO customer_counters (id, customer_id, key, next_number, updated_at)
SELECT 
  'cc-' || gen_random_uuid(),
  c.id,
  'work_order',
  COALESCE(
    (SELECT MAX(wo.number) + 1 
     FROM work_orders wo 
     WHERE wo.customer_id = c.id), 
    1
  ),
  NOW()
FROM customers c
ON CONFLICT (customer_id, key) DO NOTHING;

-- Step 6: Log da migração
INSERT INTO audit_logs (id, company_id, user_id, entity_type, entity_id, action, changes, timestamp, created_at)
VALUES (
  'audit-migration-customer-counters-' || gen_random_uuid(),
  'company-admin-default',
  'user-admin-opus',
  'system',
  'migration-002',
  'customer_counters_migration',
  jsonb_build_object(
    'migration', '002_customer_counters',
    'description', 'Migrated work order numbering from company-based to customer-based',
    'timestamp', NOW()
  ),
  NOW(),
  NOW()
);
