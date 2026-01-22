# Especificação Técnica: Compliance Engine (Global Ready)

## 1. Visão Geral
Este documento define a arquitetura para o módulo de Compliance. O objetivo é criar um sistema agnóstico a região, onde as regras (FSAI - Irlanda, FDA - EUA, ANVISA - Brasil) sejam injetadas como dados, e não hardcoded no código.

## 2. Princípios de Design "Kitchen-First"
1.  **Offline-first:** A internet cai dentro de câmaras frias. O app deve funcionar 100% offline e sincronizar depois.
2.  **Audit Trail Imutável:** Uma vez salvo, um registro nunca é deletado, apenas retificado (requisito legal).
3.  **Exception Reporting:** O chef só quer saber do que deu errado. Se tudo está verde, o silêncio é ouro.

## 3. Arquitetura de Banco de Dados (Supabase)

A chave para a internacionalização é o uso de **JSONB** para os formulários dinâmicos.

### 3.1 Tabelas Core

#### `compliance_schemas` (As "Regras do Jogo")
Define o que precisa ser checado. Ex: "Temperature Log Standard - Ireland".
- `id`: uuid
- `region`: string ('IE', 'UK', 'US', 'GLOBAL')
- `type`: string ('temp_log', 'cleaning', 'delivery', 'probe_calibration')
- `structure`: jsonb
    - Define os campos, validações (min/max temp), e ações corretivas obrigatórias.

#### `compliance_schedules` (A "Agenda")
Quando as regras se aplicam a este restaurante específico.
- `id`: uuid
- `venue_id`: uuid
- `schema_id`: uuid
- `frequency`: string ('daily', 'opening', 'closing', 'hourly')
- `assigned_role`: string ('chef', 'manager', 'porter')

#### `compliance_logs` (A "Verdade")
Os registros reais.
- `id`: uuid
- `venue_id`: uuid
- `schema_id`: uuid
- `user_id`: uuid
- `data`: jsonb (Os valores reais: { "temp": 4.5, "unit": "C" })
- `status`: string ('pass', 'fail', 'rectified')
- `verified_by`: uuid (Gerente que assinou digitalmente)
- `created_at`: timestamp

#### `corrective_actions` (O "Salva-Vidas")
Se um log falha (ex: Geladeira a 15ºC), uma ação é obrigatória.
- `log_id`: uuid
- `action_taken`: string ("Descartei a comida", "Chamei manutenção")
- `performed_by`: uuid

## 4. Estratégia de Internacionalização (Go-Live Anywhere)

Em vez de criar telas fixas para cada país, o Frontend será um **Renderizador de Schemas**.
1. O App baixa o `compliance_schema` relevante para a região da *Venue*.
2. O UI monta o formulário dinamicamente baseado no JSON.
3. Se a Irlanda mudar a lei amanhã, nós atualizamos o JSON no banco, e o app do cliente atualiza sozinho, sem precisar de update na App Store.

## 5. Diferenciais "Uau" para Implementar

### 5.1 Voice-First HACCP
- **Conceito:** O chef está com as mãos sujas de massa.
- **Implementação:** Web Speech API integrada ao formulário dinâmico.
- **Fluxo:** Chef diz "Fridge 1 temperature 3.5 degrees". App preenche, valida e salva.

### 5.2 Bluetooth Probe Integration
- **Protocolo:** Web Bluetooth API.
- **Uso:** Leitura direta do termômetro para o input do formulário. Elimina fraude de digitação ("Lápis Tombstone").

### 5.3 Timelapse de Limpeza (Opcional, mas Vendedor)
- Exigir uma foto ao finalizar a limpeza noturna. O sistema cria um relatório visual para o gerente ver a cozinha brilhando todo dia.
