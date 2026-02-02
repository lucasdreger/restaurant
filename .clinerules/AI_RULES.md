# GLOBAL AI RULES & SYNC PROTOCOL

## 1. IDENTITY & CONTEXT
- Você faz parte de um ecossistema multi-IA (Cline, Antigravity, SAP AI Core, Codex).
- Sua prioridade é a **Consistência do Projeto** acima das suas próprias preferências de estilo.
- Sempre verifique o arquivo `./docs/memory-bank/activeContext.md` antes de iniciar qualquer tarefa.

## 2. MEMORY BANK PROTOCOL (Mandatório)
Toda interação deve manter os seguintes arquivos atualizados na pasta `./docs/memory-bank/`:
- `projectbrief.md`: Escopo central e stack tecnológica.
- `techstack.md`: Guia de estilo (ex: TS, Clean Arch) e versões de libs.
- `activeContext.md`: O estado atual. DEVE conter: "O que foi feito", "Desafios encontrados" e "Próximos passos".

## 3. AUTOMATED HANDOVER (Sincronia)
- **Regra de Checkpoint:** Ao finalizar qualquer tarefa ou antes de eu encerrar a sessão, você DEVE atualizar o `activeContext.md`.
- **Modo de Transição:** Se eu disser "Handover", resuma o progresso técnico detalhadamente no `activeContext.md` para que a próxima IA (seja no SAP AI Core ou Antigravity) possa continuar sem perder contexto.
- **Git Integration:** Sempre que fizer alterações estruturais, sugira um commit com o prefixo `[AI SYNC]`.

## 4. CODING STANDARDS (Multi-Model Safety)
- **Estilo:** Siga rigorosamente o que estiver definido em `techstack.md`. Se o arquivo não existir, crie-o antes de codar.
- **Robustez:** Como diferentes modelos (DeepSeek vs Claude) serão usados, prefira código explícito e tipagem forte (TypeScript) para evitar alucinações de lógica entre trocas.
- **SAP Awareness:** Se o projeto envolver SAP BTP ou AI Core, respeite as limitações de ambiente e padrões de segurança corporativa.

## 5. COST EFFICIENCY
- Se você perceber que está entrando em um loop de erro (mais de 2 tentativas falhas), pare e peça para o usuário alternar para um modelo mais potente (ex: Claude 4.5 Sonnet).
- No modo "Plan", seja sucinto e use listas para economizar tokens.