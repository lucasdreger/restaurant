-- Atualização do Schema para Suporte a Compliance e Licenciamento

-- 1. Adicionar Tier de Assinatura aos Restaurantes
ALTER TABLE sites 
ADD COLUMN IF NOT EXISTS subscription_tier text DEFAULT 'basic' CHECK (subscription_tier IN ('basic', 'pro', 'enterprise'));

-- 2. Tabela de Logs de Compliance (HACCP)
-- Projetada para receber dados de App, Voz ou Sensores IoT
CREATE TABLE IF NOT EXISTS compliance_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    site_id uuid REFERENCES sites(id) ON DELETE CASCADE,
    schema_id text NOT NULL, -- ex: 'fsai_fridge_temp_v1'
    data jsonb NOT NULL, -- O payload flexível: { "temperature": 4.5, "unit_name": "Fridge 1" }
    status text DEFAULT 'pending' CHECK (status IN ('pass', 'fail', 'rectified', 'pending')),
    source text DEFAULT 'app' CHECK (source IN ('app', 'voice', 'iot_sensor', 'manager_audit')),
    created_at timestamptz DEFAULT now(),
    user_id uuid REFERENCES auth.users(id) -- Pode ser nulo se for um sensor IoT automático
);

-- Index para buscas rápidas de histórico
CREATE INDEX IF NOT EXISTS idx_compliance_logs_site_date ON compliance_logs(site_id, created_at);
CREATE INDEX IF NOT EXISTS idx_compliance_logs_schema ON compliance_logs(schema_id);

-- Exemplo de Policy (RLS) - Simples para desenvolvimento
ALTER TABLE compliance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read/write for authenticated users based on site" ON compliance_logs
    USING (auth.uid() IN (
        SELECT user_id FROM sites_users WHERE site_id = compliance_logs.site_id
    ))
    WITH CHECK (auth.uid() IN (
        SELECT user_id FROM sites_users WHERE site_id = compliance_logs.site_id
    ));
