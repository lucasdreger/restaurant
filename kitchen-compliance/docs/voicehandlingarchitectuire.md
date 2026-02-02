# ChefVoice - Sistema de Voz Conversacional
## Documento de Arquitetura Completo para Desenvolvedores

**Versão:** 1.0  
**Data:** Fevereiro 2026  
**Autor:** ChefVoice Engineering Team

---

## 📋 Índice

1. [Visão Geral do Problema](#1-visão-geral-do-problema)
2. [Análise do Sistema Atual](#2-análise-do-sistema-atual)
3. [Arquitetura Proposta](#3-arquitetura-proposta)
4. [Máquina de Estados Conversacional](#4-máquina-de-estados-conversacional)
5. [Estratégias de Fallback](#5-estratégias-de-fallback)
6. [Guia de Implementação](#6-guia-de-implementação)
7. [Test Cases Automatizados](#7-test-cases-automatizados)
8. [Troubleshooting Guide](#8-troubleshooting-guide)

---

## 1. Visão Geral do Problema

### 1.1 Contexto do Negócio

O ChefVoice é uma plataforma de compliance HACCP para cozinhas comerciais na Irlanda. O principal diferencial é permitir que chefs e funcionários de cozinha registrem logs de segurança alimentar **usando apenas a voz**, mantendo as mãos livres para o trabalho.

### 1.2 Problemas Identificados no Sistema Atual

#### Problema 1: Timeout Excessivo após Wake Word
- **Sintoma:** Depois de dizer "Hey Luma", o usuário tem apenas 1-2 segundos para falar o comando completo
- **Causa raiz:** O reconhecimento de voz para de escutar rapidamente após detectar silêncio
- **Impacto:** Chefs precisam falar muito rápido, o que é difícil em ambiente barulhento

#### Problema 2: Falta de Fluxo Conversacional Completo
- **Sintoma:** Ao dizer "finish cooling one", o sistema não pergunta dados adicionais
- **Esperado:** Sistema deveria iniciar uma "entrevista" pedindo: staff code, temperatura final, confirmação
- **Impacto:** Dados incompletos nos registros HACCP

#### Problema 3: Experiência Não Natural
- **Sintoma:** Interações são robóticas e requerem fraseamento exato
- **Esperado:** Conversação fluida como "dois... cinco graus... confirmar"
- **Impacto:** Frustração do usuário, abandono do sistema de voz

### 1.3 Requisitos do Sistema Ideal

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUXO CONVERSACIONAL IDEAL                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  👨‍🍳 Chef: "Hey Luma"                                          │
│  🤖 Sistema: *beep* (feedback sonoro)                           │
│                                                                 │
│  👨‍🍳 Chef: "finish cooling one"                                │
│  🤖 Sistema: "Closing Pasta Bolognese. What is your staff code?"│
│                                                                 │
│  👨‍🍳 Chef: "two"                                               │
│  🤖 Sistema: "Got it, Marco. What's the final temperature?"     │
│                                                                 │
│  👨‍🍳 Chef: "five degrees"                                      │
│  🤖 Sistema: "5 degrees. Say confirm to save, or cancel."       │
│                                                                 │
│  👨‍🍳 Chef: "confirm"                                           │
│  🤖 Sistema: "Done! Pasta Bolognese logged at 5°C by Marco."    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Análise do Sistema Atual

### 2.1 Arquitetura de Arquivos Existentes

```
src/
├── hooks/
│   ├── useWakeWord.ts          # Detecção de wake words ("Hey Luma")
│   ├── useVoiceRecognition.ts  # Speech-to-text (Browser API)
│   ├── useWhisperVoice.ts      # Speech-to-text (OpenAI/OpenRouter)
│   └── useVoiceCloseFlow.ts    # Máquina de estados para fechar cooling
│
├── components/
│   └── voice/
│       └── VoiceButton.tsx     # Componente UI do microfone
│
├── lib/
│   └── voiceCommands.ts        # Parser de comandos de voz
│
├── services/
│   └── whisperService.ts       # Cliente para APIs de transcrição
│
└── components/screens/
    └── KioskHome.tsx           # Tela principal que integra tudo
```

### 2.2 Fluxo de Dados Atual

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         FLUXO ATUAL (SIMPLIFICADO)                        │
└──────────────────────────────────────────────────────────────────────────┘

  [useWakeWord]                    [VoiceButton]                [KioskHome]
       │                                │                            │
       │  1. Detecta "Hey Luma"         │                            │
       ├───────────────────────────────►│                            │
       │                                │  2. Inicia gravação        │
       │                                ├───────────────────────────►│
       │                                │                            │
       │                    [whisperService]                         │
       │                          │                                  │
       │                          │  3. Transcreve áudio             │
       │                          │                                  │
       │                    [voiceCommands.ts]                       │
       │                          │                                  │
       │                          │  4. Parseia comando              │
       │                          │     "finish cooling one"         │
       │                          │     → { type: 'stop_cooling',    │
       │                          │        item: 'one' }             │
       │                          │                                  │
       │                                                             │
       │                                      5. handleVoiceCommand()│
       │                                      └──────────────────────┤
       │                                                             │
       │                    [useVoiceCloseFlow]                      │
       │                          │                                  │
       │                          │  6. Inicia fluxo conversacional  │
       │                          │     startFlow('one')             │
       │                          │                                  │
```

### 2.3 Análise Detalhada dos Hooks

#### useWakeWord.ts - Funcionamento Atual

**Localização:** `src/hooks/useWakeWord.ts`

**O que faz:**
- Escuta continuamente por wake words configuráveis ("Hey Luma", "Luma", etc.)
- Usa Web Speech API em modo `continuous: true` com `interimResults: true`
- Ao detectar wake word, emite callback e para de escutar

**Problema identificado:**
```typescript
// Linha ~95-100 no código atual
recognition.onresult = (event) => {
  // Detecta wake word em resultado FINAL
  if (isFinal) {
    recognition.stop()  // ← PROBLEMA: Para imediatamente
    onWakeWordDetectedRef.current()
  }
}
```

**Por que é um problema:**
1. Ao parar o recognition, há um "gap" de ~500ms até o VoiceButton iniciar nova gravação
2. Nesse gap, qualquer fala do usuário é perdida
3. Se o usuário falar "Hey Luma, finish cooling one" tudo junto, "finish cooling one" pode ser cortado

---

#### useVoiceCloseFlow.ts - Máquina de Estados Atual

**Localização:** `src/hooks/useVoiceCloseFlow.ts`

**Estados existentes:**
```typescript
type VoiceCloseStep = 
  | 'idle'                    // Aguardando comando
  | 'awaiting_staff'          // Perguntou staff code
  | 'awaiting_temperature'    // Perguntou temperatura
  | 'awaiting_confirmation'   // Pediu confirmação final
```

**Pontos positivos:**
- ✅ Já possui estrutura de máquina de estados
- ✅ Já parseia números falados ("two" → 2)
- ✅ Já tem fallback para "skip" temperatura
- ✅ Integra com Text-to-Speech para feedback

**Pontos a melhorar:**
- ❌ Não há tratamento de timeout (usuário demora para responder)
- ❌ Não há re-prompt automático se não entendeu
- ❌ Não volta a escutar automaticamente após falar
- ❌ A função `handleTranscript` não é chamada automaticamente

---

## 3. Arquitetura Proposta

### 3.1 Visão Geral da Nova Arquitetura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      NOVA ARQUITETURA CONVERSACIONAL                         │
└─────────────────────────────────────────────────────────────────────────────┘

                           ┌─────────────────────┐
                           │   VoiceOrchestrator │  ◄─── NOVO: Coordena tudo
                           │        (hook)       │
                           └──────────┬──────────┘
                                      │
           ┌──────────────────────────┼──────────────────────────┐
           │                          │                          │
           ▼                          ▼                          ▼
  ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
  │  useWakeWord    │      │ useConversation │      │ useVoiceEngine  │
  │   (melhorado)   │      │    (NOVO)       │      │   (melhorado)   │
  └─────────────────┘      └─────────────────┘      └─────────────────┘
           │                        │                        │
           │                        │                        │
           │               ┌────────┴────────┐              │
           │               │                 │              │
           │               ▼                 ▼              │
           │    ┌──────────────┐  ┌──────────────┐         │
           │    │ FlowRegistry │  │ ConversationContext│   │
           │    │   (NOVO)     │  │     (NOVO)   │         │
           │    └──────────────┘  └──────────────┘         │
           │                                                │
           └────────────────────┬───────────────────────────┘
                                │
                                ▼
                    ┌─────────────────────┐
                    │   whisperService    │
                    │   (existente)       │
                    └─────────────────────┘
```

### 3.2 Novos Componentes Propostos

#### 3.2.1 VoiceOrchestrator (Hook Principal)

```typescript
// src/hooks/useVoiceOrchestrator.ts

interface VoiceOrchestratorOptions {
  onCommandComplete: (result: CommandResult) => void
  onError: (error: VoiceError) => void
}

interface VoiceOrchestratorReturn {
  // Estado
  isListening: boolean
  isProcessing: boolean
  currentFlow: ConversationFlow | null
  currentStep: ConversationStep | null
  
  // Ações
  startWakeWordDetection: () => void
  stopAllListening: () => void
  cancelCurrentFlow: () => void
  
  // Feedback
  lastTranscript: string
  lastSystemResponse: string
}

export function useVoiceOrchestrator(options: VoiceOrchestratorOptions): VoiceOrchestratorReturn
```

**Responsabilidades:**
1. Coordenar ciclo listen → process → speak → listen
2. Gerenciar transições entre wake word mode e conversation mode
3. Aplicar timeouts e re-prompts
4. Selecionar engine de voz correta (Browser vs Whisper)

---

#### 3.2.2 ConversationFlow (Definição de Fluxos)

```typescript
// src/lib/conversationFlows.ts

interface ConversationStep {
  id: string
  prompt: string | ((context: FlowContext) => string)
  expectation: 'number' | 'text' | 'confirmation' | 'selection'
  validation?: (input: string, context: FlowContext) => ValidationResult
  onSuccess: (input: string, context: FlowContext) => FlowContext
  onFailure?: (input: string, context: FlowContext) => string  // Re-prompt message
  maxRetries?: number
  timeoutMs?: number
}

interface ConversationFlow {
  id: string
  name: string
  triggerCommands: string[]  // Comandos que iniciam este fluxo
  steps: ConversationStep[]
  onComplete: (context: FlowContext) => Promise<void>
  onCancel?: (context: FlowContext) => void
}
```

**Exemplo: Fluxo de Fechar Cooling**

```typescript
export const closeCoolingFlow: ConversationFlow = {
  id: 'close_cooling',
  name: 'Close Cooling Session',
  triggerCommands: ['stop_cooling', 'finish_cooling', 'done', 'in_fridge'],
  
  steps: [
    {
      id: 'staff_code',
      prompt: (ctx) => `Closing ${ctx.sessionName}. What is your staff code?`,
      expectation: 'number',
      validation: (input, ctx) => {
        const staffCode = parseNumber(input)
        const staff = ctx.staffMembers.find(s => s.staff_code === staffCode?.toString())
        if (!staff) return { valid: false, message: `No staff with code ${staffCode}` }
        return { valid: true, data: staff }
      },
      onSuccess: (input, ctx) => ({ ...ctx, staffId: ctx.validationData.id, staffName: ctx.validationData.name }),
      onFailure: () => "I didn't catch that. Please say your staff number.",
      maxRetries: 3,
      timeoutMs: 10000,
    },
    {
      id: 'temperature',
      prompt: (ctx) => `Got it, ${ctx.staffName}. What's the final temperature?`,
      expectation: 'number',
      validation: (input) => {
        if (input.toLowerCase().includes('skip')) return { valid: true, data: null }
        const temp = parseNumber(input)
        if (temp === null || temp < -30 || temp > 100) {
          return { valid: false, message: 'Temperature should be between -30 and 100 degrees' }
        }
        return { valid: true, data: temp }
      },
      onSuccess: (input, ctx) => ({ ...ctx, temperature: ctx.validationData }),
      onFailure: () => "Please say the temperature in degrees, or say skip.",
      maxRetries: 2,
      timeoutMs: 8000,
    },
    {
      id: 'confirmation',
      prompt: (ctx) => {
        const tempText = ctx.temperature !== null ? `${ctx.temperature} degrees` : 'no temperature'
        return `Summary: ${ctx.sessionName} by ${ctx.staffName} at ${tempText}. Say confirm to save, or cancel.`
      },
      expectation: 'confirmation',
      validation: (input) => {
        const lower = input.toLowerCase()
        if (lower.includes('confirm') || lower.includes('yes') || lower.includes('save')) {
          return { valid: true, data: 'confirmed' }
        }
        if (lower.includes('cancel') || lower.includes('no') || lower.includes('stop')) {
          return { valid: true, data: 'cancelled' }
        }
        return { valid: false, message: 'Say confirm or cancel' }
      },
      onSuccess: (input, ctx) => ({ ...ctx, confirmed: ctx.validationData === 'confirmed' }),
      maxRetries: 2,
      timeoutMs: 10000,
    }
  ],
  
  onComplete: async (ctx) => {
    if (ctx.confirmed) {
      await closeCoolingSession(ctx.sessionId, {
        staffId: ctx.staffId,
        staffName: ctx.staffName,
        temperature: ctx.temperature,
      })
    }
  },
}
```

---

#### 3.2.3 useConversation (Executor de Fluxos)

```typescript
// src/hooks/useConversation.ts

interface UseConversationOptions {
  speak: (text: string) => void
  startListening: () => void
  flows: ConversationFlow[]
}

interface UseConversationReturn {
  currentFlow: ConversationFlow | null
  currentStep: ConversationStep | null
  context: FlowContext
  
  startFlow: (flowId: string, initialContext: Partial<FlowContext>) => void
  handleTranscript: (transcript: string) => void
  cancelFlow: () => void
  
  isWaitingForInput: boolean
  retryCount: number
}
```

**Lógica interna:**

```typescript
export function useConversation(options: UseConversationOptions): UseConversationReturn {
  const [state, dispatch] = useReducer(conversationReducer, initialState)
  
  // Auto-escuta após TTS terminar de falar
  const handleTTSComplete = useCallback(() => {
    if (state.isWaitingForInput) {
      // Pequeno delay para evitar capturar eco do TTS
      setTimeout(() => {
        options.startListening()
      }, 300)
    }
  }, [state.isWaitingForInput, options.startListening])
  
  // Timeout handler
  useEffect(() => {
    if (!state.isWaitingForInput || !state.currentStep) return
    
    const timeout = state.currentStep.timeoutMs || 8000
    const timer = setTimeout(() => {
      if (state.retryCount < (state.currentStep.maxRetries || 2)) {
        // Re-prompt
        const reprompt = state.currentStep.onFailure?.('', state.context) || 
                         "I didn't hear anything. Please try again."
        options.speak(reprompt)
        dispatch({ type: 'INCREMENT_RETRY' })
      } else {
        // Max retries - cancel or fallback
        options.speak("Let me open the form for you to fill manually.")
        dispatch({ type: 'CANCEL_FLOW', reason: 'timeout' })
      }
    }, timeout)
    
    return () => clearTimeout(timer)
  }, [state.isWaitingForInput, state.currentStep, state.retryCount])
  
  // ... resto da implementação
}
```

---

## 4. Máquina de Estados Conversacional

### 4.1 Diagrama de Estados Completo

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    MÁQUINA DE ESTADOS - VOICE ORCHESTRATOR                       │
└─────────────────────────────────────────────────────────────────────────────────┘

                                    ┌─────────────┐
                                    │    IDLE     │
                                    │  (inicial)  │
                                    └──────┬──────┘
                                           │
                    settings.wakeWordEnabled = true
                                           │
                                           ▼
                              ┌────────────────────────┐
                              │   WAKE_WORD_LISTENING  │◄──────────────────┐
                              │                        │                   │
                              │  • Browser Speech API  │                   │
                              │  • continuous: true    │                   │
                              │  • interimResults: true│                   │
                              └───────────┬────────────┘                   │
                                          │                                │
                           Detectou wake word                              │
                           (interim ou final)                              │
                                          │                                │
                                          ▼                                │
                              ┌────────────────────────┐                   │
                              │   WAKE_WORD_DETECTED   │                   │
                              │                        │                   │
                              │  • playWakeSound()     │                   │
                              │  • Aguarda comando     │                   │
                              │    imediato (500ms)    │                   │
                              └───────────┬────────────┘                   │
                                          │                                │
                  ┌───────────────────────┼───────────────────────┐        │
                  │                       │                       │        │
           Comando junto           Sem comando              Timeout        │
           "finish cooling 1"      (silêncio)               (2s)           │
                  │                       │                       │        │
                  ▼                       ▼                       │        │
      ┌────────────────────┐  ┌────────────────────┐             │        │
      │  PROCESSING_CMD    │  │ COMMAND_LISTENING  │             │        │
      │                    │  │                    │             │        │
      │  • parseVoiceCmd() │  │  • Whisper/Browser │             │        │
      │  • Identifica flow │  │  • timeoutMs: 5000 │             │        │
      └─────────┬──────────┘  └─────────┬──────────┘             │        │
                │                       │                        │        │
                │    ┌──────────────────┘                        │        │
                │    │                                           │        │
                ▼    ▼                                           │        │
      ┌────────────────────────┐                                 │        │
      │    FLOW_ACTIVE         │                                 │        │
      │                        │                                 │        │
      │  currentFlow != null   │                                 │        │
      │  currentStepIndex >= 0 │                                 │        │
      └───────────┬────────────┘                                 │        │
                  │                                              │        │
          ┌───────┴───────┐                                      │        │
          │               │                                      │        │
          ▼               ▼                                      │        │
  ┌──────────────┐ ┌──────────────┐                              │        │
  │   SPEAKING   │ │  LISTENING   │◄─────────────────────┐       │        │
  │              │ │   (in flow)  │                      │       │        │
  │ • TTS ativo  │ │              │                      │       │        │
  │ • UI: 🔊     │ │ • Recording  │                      │       │        │
  └──────┬───────┘ │ • UI: 🎤     │                      │       │        │
         │         └──────┬───────┘                      │       │        │
         │                │                              │       │        │
   TTS terminou     Transcript recebido                  │       │        │
         │                │                              │       │        │
         │                ▼                              │       │        │
         │      ┌──────────────────┐                     │       │        │
         │      │   VALIDATING     │                     │       │        │
         │      │                  │                     │       │        │
         │      │ • step.validate()│                     │       │        │
         │      └────────┬─────────┘                     │       │        │
         │               │                               │       │        │
         │      ┌────────┴────────┐                      │       │        │
         │      │                 │                      │       │        │
         │   Válido           Inválido                   │       │        │
         │      │                 │                      │       │        │
         │      ▼                 ▼                      │       │        │
         │  ┌────────┐    ┌────────────────┐             │       │        │
         │  │ NEXT   │    │   REPROMPT     │─────────────┘       │        │
         │  │ STEP   │    │                │                     │        │
         │  └───┬────┘    │ retries < max  │                     │        │
         │      │         └────────────────┘                     │        │
         │      │                 │                              │        │
         │      │          retries >= max                        │        │
         │      │                 │                              │        │
         │      │                 ▼                              │        │
         │      │      ┌────────────────────┐                    │        │
         │      │      │  FALLBACK_MANUAL   │                    │        │
         │      │      │                    │                    │        │
         │      │      │ • Abre modal       │                    │        │
         │      │      │ • Pre-fill dados   │                    │        │
         │      │      └────────────────────┘                    │        │
         │      │                                                │        │
         │      │  Último step?                                  │        │
         │      │      │                                         │        │
         │      │  ┌───┴───┐                                     │        │
         │      │  │       │                                     │        │
         │      │ Não     Sim                                    │        │
         │      │  │       │                                     │        │
         │      │  │       ▼                                     │        │
         │      │  │  ┌────────────────┐                         │        │
         │      │  │  │ FLOW_COMPLETE  │                         │        │
         │      │  │  │                │                         │        │
         │      │  │  │ • onComplete() │                         │        │
         │      │  │  │ • save()       │                         │        │
         │      │  │  └───────┬────────┘                         │        │
         │      │  │          │                                  │        │
         └──────┴──┴──────────┴──────────────────────────────────┘        │
                                                                          │
                              user.cancelled                               │
                                    │                                      │
                                    └──────────────────────────────────────┘
```

### 4.2 Transições de Estado Detalhadas

```typescript
// src/lib/voiceStateMachine.ts

type VoiceState =
  | 'idle'
  | 'wake_word_listening'
  | 'wake_word_detected'
  | 'command_listening'
  | 'processing_command'
  | 'flow_active'
  | 'flow_speaking'
  | 'flow_listening'
  | 'flow_validating'
  | 'flow_complete'
  | 'fallback_manual'
  | 'error'

type VoiceEvent =
  | { type: 'ENABLE_WAKE_WORD' }
  | { type: 'DISABLE_WAKE_WORD' }
  | { type: 'WAKE_WORD_HEARD' }                    // Interim detection
  | { type: 'WAKE_WORD_CONFIRMED' }               // Final detection
  | { type: 'IMMEDIATE_COMMAND'; command: string }
  | { type: 'COMMAND_TIMEOUT' }
  | { type: 'TRANSCRIPT_RECEIVED'; text: string }
  | { type: 'COMMAND_PARSED'; command: VoiceCommand }
  | { type: 'FLOW_STARTED'; flowId: string }
  | { type: 'TTS_STARTED' }
  | { type: 'TTS_COMPLETED' }
  | { type: 'VALIDATION_SUCCESS'; data: unknown }
  | { type: 'VALIDATION_FAILED'; message: string }
  | { type: 'NEXT_STEP' }
  | { type: 'FLOW_FINISHED' }
  | { type: 'MAX_RETRIES_REACHED' }
  | { type: 'USER_CANCELLED' }
  | { type: 'ERROR'; error: string }

interface VoiceContext {
  wakeWordEnabled: boolean
  currentFlow: ConversationFlow | null
  currentStepIndex: number
  flowContext: FlowContext
  retryCount: number
  lastTranscript: string
  lastError: string | null
}

// Transitions table
const transitions: Record<VoiceState, Partial<Record<VoiceEvent['type'], VoiceState>>> = {
  idle: {
    ENABLE_WAKE_WORD: 'wake_word_listening',
  },
  wake_word_listening: {
    DISABLE_WAKE_WORD: 'idle',
    WAKE_WORD_HEARD: 'wake_word_detected',
    WAKE_WORD_CONFIRMED: 'wake_word_detected',
  },
  wake_word_detected: {
    IMMEDIATE_COMMAND: 'processing_command',
    COMMAND_TIMEOUT: 'command_listening',
    TRANSCRIPT_RECEIVED: 'processing_command',
  },
  command_listening: {
    TRANSCRIPT_RECEIVED: 'processing_command',
    COMMAND_TIMEOUT: 'wake_word_listening',
    USER_CANCELLED: 'wake_word_listening',
  },
  processing_command: {
    FLOW_STARTED: 'flow_active',
    ERROR: 'error',
  },
  flow_active: {
    TTS_STARTED: 'flow_speaking',
  },
  flow_speaking: {
    TTS_COMPLETED: 'flow_listening',
    USER_CANCELLED: 'wake_word_listening',
  },
  flow_listening: {
    TRANSCRIPT_RECEIVED: 'flow_validating',
    COMMAND_TIMEOUT: 'flow_speaking',  // Re-prompt
    USER_CANCELLED: 'wake_word_listening',
  },
  flow_validating: {
    VALIDATION_SUCCESS: 'flow_active',  // Next step or complete
    VALIDATION_FAILED: 'flow_speaking', // Re-prompt
    MAX_RETRIES_REACHED: 'fallback_manual',
    FLOW_FINISHED: 'flow_complete',
  },
  flow_complete: {
    // Auto-transition back
    ENABLE_WAKE_WORD: 'wake_word_listening',
  },
  fallback_manual: {
    USER_CANCELLED: 'wake_word_listening',
    FLOW_FINISHED: 'flow_complete',
  },
  error: {
    ENABLE_WAKE_WORD: 'wake_word_listening',
  },
}
```

### 4.3 Timing e Delays Críticos

```typescript
// src/lib/voiceConfig.ts

export const VOICE_TIMING = {
  // Wake Word Detection
  WAKE_WORD_INTERIM_BEEP_DELAY: 0,          // Beep imediato ao detectar interim
  WAKE_WORD_TO_COMMAND_GAP: 500,             // Tempo entre wake word e início de gravação
  IMMEDIATE_COMMAND_WINDOW: 2000,            // Janela para comando junto com wake word
  
  // Command Listening
  COMMAND_SILENCE_THRESHOLD: 1500,           // Silêncio antes de processar
  COMMAND_MAX_DURATION: 10000,               // Máximo de gravação de comando
  COMMAND_MIN_AUDIO_SIZE: 1000,              // Bytes mínimos para processar
  
  // Flow Conversation
  TTS_TO_LISTEN_DELAY: 300,                  // Delay após TTS para evitar eco
  FLOW_STEP_TIMEOUT: 8000,                   // Timeout padrão por step
  FLOW_STEP_TIMEOUT_STAFF: 10000,            // Timeout para staff code (mais tempo)
  FLOW_STEP_TIMEOUT_CONFIRM: 10000,          // Timeout para confirmação
  
  // Retries
  RETRY_DELAY: 500,                          // Delay antes de re-prompt
  SILENCE_BEFORE_REPROMPT: 3000,             // Silêncio antes de repetir pergunta
  
  // Audio
  SILENCE_DETECTION_THRESHOLD: 5,            // Volume threshold para silêncio
  SILENCE_DURATION_FOR_STOP: 1500,           // Duração de silêncio para auto-stop
}

export const VOICE_LIMITS = {
  MAX_RETRIES_PER_STEP: 3,
  MAX_TOTAL_RETRIES_PER_FLOW: 5,
  MAX_FLOW_DURATION: 60000,                  // 1 minuto máximo por fluxo
}
```

---

## 5. Estratégias de Fallback

### 5.1 Hierarquia de Fallbacks

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           PIRÂMIDE DE FALLBACKS                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────────┐
                              │   NÍVEL 1       │
                              │   Re-prompt     │
                              │   Inteligente   │
                              └────────┬────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                                      │
                    ▼                                      ▼
           ┌─────────────────┐                   ┌─────────────────┐
           │   NÍVEL 2A      │                   │   NÍVEL 2B      │
           │   Simplificar   │                   │   Alternativa   │
           │   Pergunta      │                   │   de Input      │
           └────────┬────────┘                   └────────┬────────┘
                    │                                      │
                    └──────────────────┬───────────────────┘
                                       │
                              ┌────────▼────────┐
                              │   NÍVEL 3       │
                              │   Modal Manual  │
                              │   Pre-preenchido│
                              └────────┬────────┘
                                       │
                              ┌────────▼────────┐
                              │   NÍVEL 4       │
                              │   Skip/Default  │
                              │   Opcional      │
                              └─────────────────┘
```

### 5.2 Implementação de Cada Nível

#### Nível 1: Re-prompt Inteligente

```typescript
// Varia a mensagem baseado no erro
function getRepromptMessage(step: ConversationStep, failureReason: string, attempt: number): string {
  const messages = {
    staff_code: {
      1: "I didn't catch that. What's your staff number?",
      2: "Please say just the number. For example, say 'two' or 'five'.",
      3: "One more try. What number are you?",
    },
    temperature: {
      1: "I didn't hear the temperature. What is it in degrees?",
      2: "Just say the number, like 'five' or 'minus two'.",
      3: "Last try for temperature, or say 'skip' to continue without it.",
    },
    confirmation: {
      1: "I didn't understand. Say 'confirm' to save, or 'cancel' to discard.",
      2: "Just say 'yes' to save or 'no' to cancel.",
    },
  }
  
  return messages[step.id]?.[attempt] || step.onFailure?.(failureReason, {}) || "Please try again."
}
```

#### Nível 2A: Simplificar Pergunta

```typescript
// Após 2 falhas, simplificar a pergunta
function getSimplifiedPrompt(step: ConversationStep): string {
  const simplified = {
    staff_code: "Just say a number.",
    temperature: "Say the temperature. Or skip.",
    confirmation: "Yes or no?",
  }
  return simplified[step.id] || "Try again."
}
```

#### Nível 2B: Oferecer Alternativa

```typescript
// Após detectar dificuldade, oferecer botões
function shouldOfferButtons(step: ConversationStep, retryCount: number): boolean {
  // Para confirmação, sempre mostrar botões como backup
  if (step.expectation === 'confirmation') return true
  
  // Para outros, após 2 tentativas
  return retryCount >= 2
}

// UI mostra botões inline junto com voice
// "Say your answer, or tap a button below:"
// [1] [2] [3] [4] [5]  ← Para staff code
// [Skip] [Enter Manually]  ← Para temperatura
```

#### Nível 3: Modal Manual Pre-preenchido

```typescript
interface FallbackModalData {
  sessionId: string
  sessionName: string
  prefilledStaffId?: string    // Se conseguiu capturar
  prefilledTemperature?: number // Se conseguiu capturar
  highlightField: 'staff' | 'temperature' | 'all'
}

function openFallbackModal(flowContext: FlowContext, failedStep: ConversationStep): void {
  const data: FallbackModalData = {
    sessionId: flowContext.sessionId,
    sessionName: flowContext.sessionName,
    prefilledStaffId: flowContext.staffId,
    prefilledTemperature: flowContext.temperature,
    highlightField: failedStep.id as 'staff' | 'temperature',
  }
  
  // Feedback de voz antes de abrir
  speak("Let me open the form for you. The field you need is highlighted.")
  
  // Abre modal com scroll automático para o campo
  openCloseCoolingModal(data)
}
```

#### Nível 4: Skip/Default com Nota

```typescript
// Para campos opcionais, permitir skip com nota automática
function applySkipDefault(step: ConversationStep, context: FlowContext): FlowContext {
  if (step.id === 'temperature') {
    return {
      ...context,
      temperature: null,
      notes: (context.notes || '') + '[Temperature skipped - voice input failed]',
    }
  }
  
  // Staff code não pode ser skipped - obrigatório
  if (step.id === 'staff_code') {
    throw new Error('Staff code is required')
  }
  
  return context
}
```

### 5.3 Fallback para Diferentes Cenários de Erro

```typescript
// src/lib/voiceErrorHandling.ts

type VoiceErrorType =
  | 'no_speech'           // Usuário não falou nada
  | 'not_understood'      // Transcrição não parseada
  | 'invalid_value'       // Valor fora do range esperado
  | 'network_error'       // Whisper API falhou
  | 'mic_error'           // Problema com microfone
  | 'browser_not_supported'

interface ErrorHandler {
  message: string
  action: 'reprompt' | 'offer_buttons' | 'try_browser_fallback' | 'open_modal' | 'show_error'
  speak: boolean
}

const errorHandlers: Record<VoiceErrorType, ErrorHandler> = {
  no_speech: {
    message: "I didn't hear anything. Please speak up.",
    action: 'reprompt',
    speak: true,
  },
  not_understood: {
    message: "I didn't understand. Let me show you some options.",
    action: 'offer_buttons',
    speak: true,
  },
  invalid_value: {
    message: "That value doesn't seem right.",
    action: 'reprompt',
    speak: true,
  },
  network_error: {
    message: "Connection issue. Let me try another way.",
    action: 'try_browser_fallback',
    speak: false,
  },
  mic_error: {
    message: "Microphone issue. Please use the form instead.",
    action: 'open_modal',
    speak: false,
  },
  browser_not_supported: {
    message: "Voice not supported in this browser.",
    action: 'show_error',
    speak: false,
  },
}

// Fallback de engine: Whisper → Browser Speech API
async function tryTranscriptionWithFallback(audioBlob: Blob): Promise<string> {
  try {
    // Tenta Whisper primeiro (mais preciso)
    return await whisperService.transcribe(audioBlob)
  } catch (whisperError) {
    console.warn('[Voice] Whisper failed, trying browser fallback:', whisperError)
    
    // Fallback para Browser Speech API
    // Nota: Isso requer re-gravar, então mostramos feedback
    return new Promise((resolve, reject) => {
      const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)()
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = 'en-IE'
      
      recognition.onresult = (event) => {
        resolve(event.results[0][0].transcript)
      }
      recognition.onerror = reject
      recognition.start()
      
      // Timeout
      setTimeout(() => {
        recognition.stop()
        reject(new Error('Browser recognition timeout'))
      }, 5000)
    })
  }
}
```

### 5.4 Visual Feedback Durante Fallbacks

```typescript
// Componente de status visual
interface VoiceStatusProps {
  state: VoiceState
  retryCount: number
  currentPrompt: string
  showButtons: boolean
  buttonOptions?: string[]
}

function VoiceStatusIndicator({ state, retryCount, currentPrompt, showButtons, buttonOptions }: VoiceStatusProps) {
  return (
    <div className="voice-status">
      {/* Indicador de estado */}
      <div className={cn('status-ring', {
        'animate-pulse bg-green-500': state === 'flow_listening',
        'animate-spin bg-purple-500': state === 'flow_validating',
        'bg-amber-500': retryCount > 0,
        'bg-red-500': retryCount >= 2,
      })} />
      
      {/* Prompt atual */}
      <p className="text-lg font-medium">{currentPrompt}</p>
      
      {/* Indicador de tentativas */}
      {retryCount > 0 && (
        <p className="text-sm text-amber-400">
          Attempt {retryCount + 1} of 3
        </p>
      )}
      
      {/* Botões de fallback */}
      {showButtons && buttonOptions && (
        <div className="flex gap-2 mt-4">
          {buttonOptions.map(option => (
            <Button key={option} variant="secondary" onClick={() => handleButtonInput(option)}>
              {option}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
```

---

## 6. Guia de Implementação

### 6.1 Ordem de Implementação Recomendada

```
FASE 1: Fundação (Semana 1-2)
├── 1.1 Criar voiceConfig.ts com constantes de timing
├── 1.2 Criar voiceStateMachine.ts com types e transitions
├── 1.3 Criar tipos TypeScript compartilhados
└── 1.4 Configurar testes unitários

FASE 2: Core Engine (Semana 3-4)
├── 2.1 Melhorar useWakeWord com buffer de comando
├── 2.2 Criar useVoiceEngine (abstrai Whisper/Browser)
├── 2.3 Criar ConversationFlow types e validation helpers
└── 2.4 Criar useConversation hook

FASE 3: Integração (Semana 5-6)
├── 3.1 Criar useVoiceOrchestrator
├── 3.2 Integrar no KioskHome.tsx
├── 3.3 Criar VoiceStatusIndicator component
└── 3.4 Implementar fallback visual (botões)

FASE 4: Polish (Semana 7-8)
├── 4.1 Tuning de timing baseado em testes reais
├── 4.2 Adicionar mais fluxos (fridge temp, etc.)
├── 4.3 Testes E2E completos
└── 4.4 Documentação final
```

### 6.2 Passo a Passo: Melhorar useWakeWord

**Problema atual:** Wake word para de escutar muito rápido após detecção.

**Solução:** Manter escuta ativa por mais tempo para capturar comando imediato.

```typescript
// src/hooks/useWakeWord.ts - MODIFICAÇÕES

// ANTES
recognition.onresult = (event: SpeechRecognitionEvent) => {
  // ...
  if (isFinal) {
    recognition.stop()  // Para imediatamente
    onWakeWordDetectedRef.current()
  }
}

// DEPOIS
recognition.onresult = (event: SpeechRecognitionEvent) => {
  for (let i = event.resultIndex; i < event.results.length; i++) {
    const result = event.results[i]
    const transcript = result[0].transcript
    const isFinal = result.isFinal
    
    if (containsWakeWord(transcript, wakeWordsRef.current)) {
      // INTERIM: Feedback imediato (beep)
      if (!isInCommandModeRef.current) {
        onWakeWordHeardRef.current?.()
        isInCommandModeRef.current = true
      }
      
      // FINAL: Verificar se tem comando junto
      if (isFinal) {
        const immediateCommand = extractCommandAfterWakeWord(transcript, wakeWordsRef.current)
        
        if (immediateCommand && immediateCommand.length > 3) {
          // Comando veio junto com wake word!
          console.log('[WakeWord] Comando imediato detectado:', immediateCommand)
          pendingCommandRef.current = immediateCommand
          recognition.stop()
        } else {
          // Sem comando - manter escuta por mais 2 segundos
          console.log('[WakeWord] Aguardando comando por mais 2s...')
          
          // NÃO para recognition ainda - espera mais um pouco
          delayedStopRef.current = setTimeout(() => {
            if (recognitionRef.current) {
              pendingDetectionRef.current = true
              recognitionRef.current.stop()
            }
          }, VOICE_TIMING.IMMEDIATE_COMMAND_WINDOW)
        }
      }
    } else if (isInCommandModeRef.current && isFinal) {
      // Usuário falou algo APÓS wake word
      // Cancela o timeout e usa esse transcript como comando
      if (delayedStopRef.current) {
        clearTimeout(delayedStopRef.current)
        delayedStopRef.current = null
      }
      
      console.log('[WakeWord] Comando após wake word:', transcript)
      pendingCommandRef.current = transcript
      recognition.stop()
    }
  }
}
```

### 6.3 Passo a Passo: Criar useConversation

```typescript
// src/hooks/useConversation.ts - IMPLEMENTAÇÃO COMPLETA

import { useCallback, useEffect, useReducer, useRef } from 'react'
import type { ConversationFlow, ConversationStep, FlowContext, ValidationResult } from '@/lib/conversationFlows'
import { VOICE_TIMING, VOICE_LIMITS } from '@/lib/voiceConfig'

// Estado do reducer
interface ConversationState {
  flow: ConversationFlow | null
  stepIndex: number
  context: FlowContext
  isWaitingForInput: boolean
  retryCount: number
  totalRetries: number
  startTime: number | null
}

// Ações do reducer
type ConversationAction =
  | { type: 'START_FLOW'; flow: ConversationFlow; initialContext: Partial<FlowContext> }
  | { type: 'TRANSCRIPT_RECEIVED'; transcript: string }
  | { type: 'VALIDATION_SUCCESS'; data: unknown; newContext: FlowContext }
  | { type: 'VALIDATION_FAILED' }
  | { type: 'NEXT_STEP' }
  | { type: 'FLOW_COMPLETE' }
  | { type: 'CANCEL_FLOW'; reason?: string }
  | { type: 'SET_WAITING'; waiting: boolean }
  | { type: 'INCREMENT_RETRY' }

const initialState: ConversationState = {
  flow: null,
  stepIndex: -1,
  context: {} as FlowContext,
  isWaitingForInput: false,
  retryCount: 0,
  totalRetries: 0,
  startTime: null,
}

function conversationReducer(state: ConversationState, action: ConversationAction): ConversationState {
  switch (action.type) {
    case 'START_FLOW':
      return {
        ...state,
        flow: action.flow,
        stepIndex: 0,
        context: { ...action.initialContext } as FlowContext,
        isWaitingForInput: false,
        retryCount: 0,
        totalRetries: 0,
        startTime: Date.now(),
      }
    
    case 'VALIDATION_SUCCESS':
      return {
        ...state,
        context: action.newContext,
        retryCount: 0,
      }
    
    case 'VALIDATION_FAILED':
      return {
        ...state,
        retryCount: state.retryCount + 1,
        totalRetries: state.totalRetries + 1,
      }
    
    case 'NEXT_STEP':
      return {
        ...state,
        stepIndex: state.stepIndex + 1,
        retryCount: 0,
        isWaitingForInput: false,
      }
    
    case 'FLOW_COMPLETE':
    case 'CANCEL_FLOW':
      return initialState
    
    case 'SET_WAITING':
      return {
        ...state,
        isWaitingForInput: action.waiting,
      }
    
    case 'INCREMENT_RETRY':
      return {
        ...state,
        retryCount: state.retryCount + 1,
        totalRetries: state.totalRetries + 1,
      }
    
    default:
      return state
  }
}

// Options para o hook
interface UseConversationOptions {
  speak: (text: string, onComplete?: () => void) => void
  startListening: () => void
  stopListening: () => void
  flows: ConversationFlow[]
  onFlowComplete?: (flowId: string, context: FlowContext) => void
  onFallbackRequired?: (flowId: string, context: FlowContext, step: ConversationStep) => void
}

export function useConversation(options: UseConversationOptions) {
  const { speak, startListening, flows, onFlowComplete, onFallbackRequired } = options
  
  const [state, dispatch] = useReducer(conversationReducer, initialState)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Helper para obter step atual
  const currentStep = state.flow?.steps[state.stepIndex] ?? null
  
  // Limpar timeout ao desmontar
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])
  
  // Executar step atual
  useEffect(() => {
    if (!state.flow || state.stepIndex < 0 || !currentStep) return
    
    // Verificar se é o fim do fluxo
    if (state.stepIndex >= state.flow.steps.length) {
      dispatch({ type: 'FLOW_COMPLETE' })
      state.flow.onComplete(state.context)
      onFlowComplete?.(state.flow.id, state.context)
      return
    }
    
    // Falar o prompt do step atual
    const prompt = typeof currentStep.prompt === 'function'
      ? currentStep.prompt(state.context)
      : currentStep.prompt
    
    speak(prompt, () => {
      // Após TTS, iniciar escuta
      dispatch({ type: 'SET_WAITING', waiting: true })
      
      setTimeout(() => {
        startListening()
      }, VOICE_TIMING.TTS_TO_LISTEN_DELAY)
    })
  }, [state.flow, state.stepIndex])
  
  // Timeout handler
  useEffect(() => {
    if (!state.isWaitingForInput || !currentStep) return
    
    const timeout = currentStep.timeoutMs || VOICE_TIMING.FLOW_STEP_TIMEOUT
    
    timeoutRef.current = setTimeout(() => {
      console.log('[Conversation] Timeout no step:', currentStep.id)
      
      if (state.retryCount < (currentStep.maxRetries || VOICE_LIMITS.MAX_RETRIES_PER_STEP)) {
        // Re-prompt
        const reprompt = currentStep.onFailure?.('timeout', state.context) ||
          "I didn't hear anything. Please try again."
        
        speak(reprompt, () => {
          dispatch({ type: 'INCREMENT_RETRY' })
          setTimeout(() => startListening(), VOICE_TIMING.TTS_TO_LISTEN_DELAY)
        })
      } else {
        // Max retries - fallback
        console.log('[Conversation] Max retries reached, triggering fallback')
        dispatch({ type: 'CANCEL_FLOW', reason: 'max_retries' })
        onFallbackRequired?.(state.flow!.id, state.context, currentStep)
      }
    }, timeout)
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [state.isWaitingForInput, currentStep, state.retryCount])
  
  // Iniciar um fluxo
  const startFlow = useCallback((flowId: string, initialContext: Partial<FlowContext>) => {
    const flow = flows.find(f => f.id === flowId)
    if (!flow) {
      console.error('[Conversation] Flow not found:', flowId)
      return
    }
    
    console.log('[Conversation] Starting flow:', flowId)
    dispatch({ type: 'START_FLOW', flow, initialContext })
  }, [flows])
  
  // Processar transcript recebido
  const handleTranscript = useCallback((transcript: string) => {
    if (!state.flow || !currentStep || !state.isWaitingForInput) {
      console.log('[Conversation] Ignoring transcript - not waiting for input')
      return
    }
    
    // Limpar timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    
    dispatch({ type: 'SET_WAITING', waiting: false })
    
    console.log('[Conversation] Processing transcript:', transcript, 'for step:', currentStep.id)
    
    // Verificar cancelamento global
    const lower = transcript.toLowerCase()
    if (lower.includes('cancel') || lower.includes('stop') || lower.includes('exit')) {
      speak('Cancelled.')
      dispatch({ type: 'CANCEL_FLOW', reason: 'user_cancelled' })
      return
    }
    
    // Validar input
    const validation = currentStep.validation
      ? currentStep.validation(transcript, state.context)
      : { valid: true, data: transcript }
    
    if (validation.valid) {
      // Sucesso - atualizar contexto e avançar
      const newContext = currentStep.onSuccess(transcript, {
        ...state.context,
        validationData: validation.data,
      })
      
      dispatch({ type: 'VALIDATION_SUCCESS', data: validation.data, newContext })
      
      // Verificar se é o último step
      if (state.stepIndex + 1 >= state.flow.steps.length) {
        // Fluxo completo
        speak('Done! Record saved.', () => {
          state.flow!.onComplete(newContext)
          onFlowComplete?.(state.flow!.id, newContext)
          dispatch({ type: 'FLOW_COMPLETE' })
        })
      } else {
        // Próximo step
        dispatch({ type: 'NEXT_STEP' })
      }
    } else {
      // Falha na validação
      dispatch({ type: 'VALIDATION_FAILED' })
      
      if (state.retryCount + 1 >= (currentStep.maxRetries || VOICE_LIMITS.MAX_RETRIES_PER_STEP)) {
        // Max retries
        onFallbackRequired?.(state.flow.id, state.context, currentStep)
        dispatch({ type: 'CANCEL_FLOW', reason: 'validation_failed' })
      } else {
        // Re-prompt
        const reprompt = currentStep.onFailure?.(validation.message || 'Invalid input', state.context) ||
          validation.message ||
          "I didn't understand. Please try again."
        
        speak(reprompt, () => {
          dispatch({ type: 'SET_WAITING', waiting: true })
          setTimeout(() => startListening(), VOICE_TIMING.TTS_TO_LISTEN_DELAY)
        })
      }
    }
  }, [state.flow, currentStep, state.isWaitingForInput, state.context, state.stepIndex, state.retryCount])
  
  // Cancelar fluxo
  const cancelFlow = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    dispatch({ type: 'CANCEL_FLOW', reason: 'manual' })
  }, [])
  
  return {
    // Estado
    currentFlow: state.flow,
    currentStep,
    context: state.context,
    isWaitingForInput: state.isWaitingForInput,
    retryCount: state.retryCount,
    stepIndex: state.stepIndex,
    
    // Ações
    startFlow,
    handleTranscript,
    cancelFlow,
    
    // Computed
    isActive: state.flow !== null,
    progress: state.flow ? (state.stepIndex + 1) / state.flow.steps.length : 0,
  }
}
```

### 6.4 Definição dos Fluxos de Conversação

```typescript
// src/lib/conversationFlows.ts

import type { StaffMember, CoolingSession } from '@/types'

// Types base
export interface FlowContext {
  // Dados de sessão
  sessionId: string
  sessionName: string
  
  // Dados coletados
  staffId?: string
  staffName?: string
  temperature?: number | null
  confirmed?: boolean
  
  // Dados auxiliares
  staffMembers: StaffMember[]
  validationData?: unknown
  notes?: string
}

export interface ValidationResult {
  valid: boolean
  data?: unknown
  message?: string
}

// Helper para parsear números
export function parseSpokenNumber(text: string): number | null {
  const lower = text.toLowerCase().trim()
  
  const TEXT_NUMBERS: Record<string, number> = {
    'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4,
    'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9,
    'ten': 10, 'eleven': 11, 'twelve': 12,
    'minus': -1, 'negative': -1,
  }
  
  // Tentar número direto
  const directMatch = lower.match(/-?\d+(?:\.\d+)?/)
  if (directMatch) return Number(directMatch[0])
  
  // Tentar texto
  for (const [word, val] of Object.entries(TEXT_NUMBERS)) {
    if (lower.includes(word)) {
      // Verificar se é negativo
      if (lower.includes('minus') || lower.includes('negative')) {
        const numPart = lower.replace(/minus|negative/g, '').trim()
        const numVal = parseSpokenNumber(numPart)
        return numVal !== null ? -Math.abs(numVal) : null
      }
      return val
    }
  }
  
  return null
}

// Flow: Fechar Cooling
export const closeCoolingFlow: ConversationFlow = {
  id: 'close_cooling',
  name: 'Close Cooling Session',
  triggerCommands: ['stop_cooling', 'finish_cooling', 'done', 'in_fridge'],
  
  steps: [
    {
      id: 'staff_code',
      prompt: (ctx) => `Closing ${ctx.sessionName}. What is your staff code?`,
      expectation: 'number',
      timeoutMs: 10000,
      maxRetries: 3,
      
      validation: (input, ctx) => {
        const staffCode = parseSpokenNumber(input)
        if (staffCode === null) {
          return { valid: false, message: "I didn't hear a number." }
        }
        
        const staff = ctx.staffMembers.find(
          s => s.staff_code === staffCode.toString() ||
               parseInt(s.staff_code || '', 10) === staffCode
        )
        
        if (!staff) {
          return { 
            valid: false, 
            message: `No staff member with code ${staffCode}. Try again.` 
          }
        }
        
        return { valid: true, data: staff }
      },
      
      onSuccess: (_input, ctx) => ({
        ...ctx,
        staffId: (ctx.validationData as StaffMember).id,
        staffName: (ctx.validationData as StaffMember).name,
      }),
      
      onFailure: (_reason, _ctx) => "Please say your staff number. For example, 'two' or 'five'.",
    },
    
    {
      id: 'temperature',
      prompt: (ctx) => `Got it, ${ctx.staffName}. What's the final temperature?`,
      expectation: 'number',
      timeoutMs: 8000,
      maxRetries: 2,
      
      validation: (input) => {
        const lower = input.toLowerCase()
        
        // Permitir skip
        if (lower.includes('skip') || lower.includes('no temp')) {
          return { valid: true, data: null }
        }
        
        const temp = parseSpokenNumber(input)
        if (temp === null) {
          return { valid: false, message: "Please say a number, or say 'skip'." }
        }
        
        // Range check (reasonable fridge temperatures)
        if (temp < -30 || temp > 50) {
          return { 
            valid: false, 
            message: `${temp} degrees seems unusual. Please try again or say 'skip'.` 
          }
        }
        
        return { valid: true, data: temp }
      },
      
      onSuccess: (_input, ctx) => ({
        ...ctx,
        temperature: ctx.validationData as number | null,
      }),
      
      onFailure: () => "Say the temperature in degrees, like 'five' or 'minus two'. Or say 'skip'.",
    },
    
    {
      id: 'confirmation',
      prompt: (ctx) => {
        const tempText = ctx.temperature !== null 
          ? `${ctx.temperature} degrees` 
          : 'temperature skipped'
        return `Summary: ${ctx.sessionName}, recorded by ${ctx.staffName}, ${tempText}. Say confirm to save.`
      },
      expectation: 'confirmation',
      timeoutMs: 10000,
      maxRetries: 2,
      
      validation: (input) => {
        const lower = input.toLowerCase()
        
        const confirmWords = ['confirm', 'yes', 'save', 'ok', 'okay', 'correct', 'right', 'yep', 'yeah']
        const cancelWords = ['cancel', 'no', 'stop', 'wrong', 'nope', 'back', 'restart']
        
        if (confirmWords.some(w => lower.includes(w))) {
          return { valid: true, data: 'confirmed' }
        }
        
        if (cancelWords.some(w => lower.includes(w))) {
          return { valid: true, data: 'cancelled' }
        }
        
        return { valid: false, message: "Say 'confirm' to save or 'cancel' to discard." }
      },
      
      onSuccess: (_input, ctx) => ({
        ...ctx,
        confirmed: ctx.validationData === 'confirmed',
      }),
    },
  ],
  
  onComplete: async (ctx) => {
    if (!ctx.confirmed) {
      console.log('[CloseCooling] Cancelled by user')
      return
    }
    
    console.log('[CloseCooling] Saving...', {
      sessionId: ctx.sessionId,
      staffId: ctx.staffId,
      temperature: ctx.temperature,
    })
    
    // A chamada real ao service será feita pelo componente que usa o hook
  },
  
  onCancel: (ctx) => {
    console.log('[CloseCooling] Flow cancelled', ctx)
  },
}

// Flow: Log Temperatura Geladeira
export const fridgeTempFlow: ConversationFlow = {
  id: 'fridge_temp',
  name: 'Log Fridge Temperature',
  triggerCommands: ['fridge_temp', 'log_fridge', 'check_fridge', 'fridge'],
  
  steps: [
    {
      id: 'fridge_select',
      prompt: 'Which fridge? Say the number or name.',
      expectation: 'selection',
      timeoutMs: 8000,
      maxRetries: 2,
      
      validation: (input, ctx) => {
        // Lógica para selecionar geladeira
        // Será implementada quando tivermos lista de geladeiras
        return { valid: true, data: { id: '1', name: 'Main Fridge' } }
      },
      
      onSuccess: (_input, ctx) => ({
        ...ctx,
        fridgeId: (ctx.validationData as { id: string }).id,
        fridgeName: (ctx.validationData as { name: string }).name,
      }),
    },
    
    {
      id: 'temperature',
      prompt: (ctx) => `What's the temperature of ${ctx.fridgeName}?`,
      expectation: 'number',
      timeoutMs: 8000,
      maxRetries: 2,
      
      validation: (input) => {
        const temp = parseSpokenNumber(input)
        if (temp === null) {
          return { valid: false, message: 'Please say the temperature.' }
        }
        return { valid: true, data: temp }
      },
      
      onSuccess: (_input, ctx) => ({
        ...ctx,
        temperature: ctx.validationData as number,
      }),
    },
    
    {
      id: 'staff_code',
      prompt: 'Your staff code?',
      expectation: 'number',
      timeoutMs: 8000,
      maxRetries: 2,
      
      validation: (input, ctx) => {
        const staffCode = parseSpokenNumber(input)
        const staff = ctx.staffMembers.find(s => s.staff_code === staffCode?.toString())
        if (!staff) return { valid: false, message: 'Staff not found.' }
        return { valid: true, data: staff }
      },
      
      onSuccess: (_input, ctx) => ({
        ...ctx,
        staffId: (ctx.validationData as StaffMember).id,
        staffName: (ctx.validationData as StaffMember).name,
      }),
    },
  ],
  
  onComplete: async (ctx) => {
    console.log('[FridgeTemp] Logging:', ctx)
  },
}

// Registry de todos os fluxos
export const conversationFlows: ConversationFlow[] = [
  closeCoolingFlow,
  fridgeTempFlow,
]

// Helper para encontrar fluxo por comando
export function findFlowByCommand(commandType: string): ConversationFlow | undefined {
  return conversationFlows.find(flow => 
    flow.triggerCommands.includes(commandType)
  )
}
```

---

## 7. Test Cases Automatizados

### 7.1 Estrutura de Testes

```
__tests__/
├── unit/
│   ├── voiceCommands.test.ts      # Parser de comandos
│   ├── conversationFlows.test.ts  # Validações de fluxos
│   ├── parseSpokenNumber.test.ts  # Números falados → números
│   └── voiceStateMachine.test.ts  # Transições de estado
│
├── integration/
│   ├── useConversation.test.tsx   # Hook com mocks
│   ├── useWakeWord.test.tsx       # Wake word detection
│   └── voiceOrchestrator.test.tsx # Fluxo completo
│
└── e2e/
    ├── closeCooling.spec.ts       # Playwright E2E
    ├── fridgeTemp.spec.ts         # Playwright E2E
    └── voiceFallback.spec.ts      # Testa fallbacks
```

### 7.2 Testes Unitários

#### 7.2.1 Testes do Parser de Números Falados

```typescript
// __tests__/unit/parseSpokenNumber.test.ts

import { parseSpokenNumber } from '@/lib/conversationFlows'

describe('parseSpokenNumber', () => {
  describe('números diretos', () => {
    test('parseia "5" → 5', () => {
      expect(parseSpokenNumber('5')).toBe(5)
    })
    
    test('parseia "42" → 42', () => {
      expect(parseSpokenNumber('42')).toBe(42)
    })
    
    test('parseia "-3" → -3', () => {
      expect(parseSpokenNumber('-3')).toBe(-3)
    })
    
    test('parseia "3.5" → 3.5', () => {
      expect(parseSpokenNumber('3.5')).toBe(3.5)
    })
  })
  
  describe('números por extenso (inglês)', () => {
    test.each([
      ['zero', 0],
      ['one', 1],
      ['two', 2],
      ['three', 3],
      ['four', 4],
      ['five', 5],
      ['six', 6],
      ['seven', 7],
      ['eight', 8],
      ['nine', 9],
      ['ten', 10],
    ])('parseia "%s" → %d', (text, expected) => {
      expect(parseSpokenNumber(text)).toBe(expected)
    })
  })
  
  describe('variações de fala', () => {
    test('parseia "it\'s five degrees" → 5', () => {
      expect(parseSpokenNumber("it's five degrees")).toBe(5)
    })
    
    test('parseia "about 3" → 3', () => {
      expect(parseSpokenNumber('about 3')).toBe(3)
    })
    
    test('parseia "minus two" → -2', () => {
      expect(parseSpokenNumber('minus two')).toBe(-2)
    })
    
    test('parseia "negative 5" → -5', () => {
      expect(parseSpokenNumber('negative 5')).toBe(-5)
    })
  })
  
  describe('casos de falha', () => {
    test('retorna null para texto sem número', () => {
      expect(parseSpokenNumber('hello world')).toBeNull()
    })
    
    test('retorna null para string vazia', () => {
      expect(parseSpokenNumber('')).toBeNull()
    })
  })
})
```

#### 7.2.2 Testes do Parser de Comandos de Voz

```typescript
// __tests__/unit/voiceCommands.test.ts

import { parseVoiceCommand } from '@/lib/voiceCommands'

describe('parseVoiceCommand', () => {
  describe('comandos de início de cooling', () => {
    test.each([
      ['start cooling chicken', { type: 'start_cooling', item: 'chicken' }],
      ['start cooling', { type: 'start_cooling', item: undefined }],
      ['begin cooling pasta', { type: 'start_cooling', item: 'pasta' }],
      ['cool the rice', { type: 'start_cooling', item: 'the rice' }],
      ['cooling soup', { type: 'start_cooling', item: 'soup' }],
    ])('parseia "%s"', (input, expected) => {
      const result = parseVoiceCommand(input)
      expect(result.type).toBe(expected.type)
      if (expected.item) {
        expect(result.item?.toLowerCase()).toContain(expected.item.toLowerCase())
      }
    })
  })
  
  describe('comandos de parar cooling', () => {
    test.each([
      ['finish cooling one', { type: 'stop_cooling', item: 'one' }],
      ['done', { type: 'stop_cooling' }],
      ['stop cooling pasta', { type: 'stop_cooling', item: 'pasta' }],
      ['in fridge', { type: 'stop_cooling' }],
      ['move to fridge', { type: 'stop_cooling' }],
      ['chicken done', { type: 'stop_cooling', item: 'chicken' }],
      ['pasta finished', { type: 'stop_cooling', item: 'pasta' }],
    ])('parseia "%s"', (input, expected) => {
      const result = parseVoiceCommand(input)
      expect(result.type).toBe(expected.type)
    })
  })
  
  describe('comandos de descarte', () => {
    test.each([
      ['discard', { type: 'discard' }],
      ['throw away', { type: 'discard' }],
      ['bin it', { type: 'discard' }],
      ['trash', { type: 'discard' }],
    ])('parseia "%s"', (input, expected) => {
      expect(parseVoiceCommand(input).type).toBe(expected.type)
    })
  })
  
  describe('comandos não reconhecidos', () => {
    test.each([
      ['hello',],
      ['what time is it'],
      ['blah blah blah'],
    ])('retorna unknown para "%s"', (input) => {
      expect(parseVoiceCommand(input).type).toBe('unknown')
    })
  })
})
```

#### 7.2.3 Testes de Validação de Fluxos

```typescript
// __tests__/unit/conversationFlows.test.ts

import { closeCoolingFlow, fridgeTempFlow } from '@/lib/conversationFlows'

describe('closeCoolingFlow', () => {
  const mockStaffMembers = [
    { id: '1', name: 'Marco', staff_code: '1' },
    { id: '2', name: 'Ana', staff_code: '2' },
    { id: '3', name: 'Carlos', staff_code: '3' },
  ]
  
  describe('step: staff_code', () => {
    const step = closeCoolingFlow.steps.find(s => s.id === 'staff_code')!
    
    test('valida código de staff existente', () => {
      const result = step.validation!('two', { staffMembers: mockStaffMembers } as any)
      expect(result.valid).toBe(true)
      expect((result.data as any).name).toBe('Ana')
    })
    
    test('rejeita código de staff inexistente', () => {
      const result = step.validation!('99', { staffMembers: mockStaffMembers } as any)
      expect(result.valid).toBe(false)
    })
    
    test('rejeita input não-numérico', () => {
      const result = step.validation!('hello', { staffMembers: mockStaffMembers } as any)
      expect(result.valid).toBe(false)
    })
  })
  
  describe('step: temperature', () => {
    const step = closeCoolingFlow.steps.find(s => s.id === 'temperature')!
    
    test('valida temperatura normal', () => {
      expect(step.validation!('5', {} as any).valid).toBe(true)
      expect(step.validation!('five degrees', {} as any).valid).toBe(true)
    })
    
    test('valida temperatura negativa', () => {
      const result = step.validation!('minus two', {} as any)
      expect(result.valid).toBe(true)
      expect(result.data).toBe(-2)
    })
    
    test('permite skip', () => {
      expect(step.validation!('skip', {} as any).valid).toBe(true)
      expect(step.validation!('skip', {} as any).data).toBeNull()
    })
    
    test('rejeita temperatura fora do range', () => {
      expect(step.validation!('100', {} as any).valid).toBe(false)
      expect(step.validation!('-50', {} as any).valid).toBe(false)
    })
  })
  
  describe('step: confirmation', () => {
    const step = closeCoolingFlow.steps.find(s => s.id === 'confirmation')!
    
    test.each([
      ['confirm', 'confirmed'],
      ['yes', 'confirmed'],
      ['save', 'confirmed'],
      ['okay', 'confirmed'],
      ['yep', 'confirmed'],
    ])('"%s" é aceito como confirmação', (input, expected) => {
      const result = step.validation!(input, {} as any)
      expect(result.valid).toBe(true)
      expect(result.data).toBe(expected)
    })
    
    test.each([
      ['cancel', 'cancelled'],
      ['no', 'cancelled'],
      ['stop', 'cancelled'],
    ])('"%s" é aceito como cancelamento', (input, expected) => {
      const result = step.validation!(input, {} as any)
      expect(result.valid).toBe(true)
      expect(result.data).toBe(expected)
    })
    
    test('rejeita input ambíguo', () => {
      expect(step.validation!('maybe', {} as any).valid).toBe(false)
    })
  })
})
```

### 7.3 Testes de Integração

#### 7.3.1 Teste do Hook useConversation

```typescript
// __tests__/integration/useConversation.test.tsx

import { renderHook, act } from '@testing-library/react-hooks'
import { useConversation } from '@/hooks/useConversation'
import { closeCoolingFlow } from '@/lib/conversationFlows'

describe('useConversation', () => {
  const mockSpeak = jest.fn()
  const mockStartListening = jest.fn()
  const mockStopListening = jest.fn()
  const mockOnFlowComplete = jest.fn()
  const mockOnFallbackRequired = jest.fn()
  
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })
  
  afterEach(() => {
    jest.useRealTimers()
  })
  
  const renderConversationHook = () => {
    return renderHook(() => useConversation({
      speak: mockSpeak,
      startListening: mockStartListening,
      stopListening: mockStopListening,
      flows: [closeCoolingFlow],
      onFlowComplete: mockOnFlowComplete,
      onFallbackRequired: mockOnFallbackRequired,
    }))
  }
  
  test('inicia fluxo corretamente', () => {
    const { result } = renderConversationHook()
    
    act(() => {
      result.current.startFlow('close_cooling', {
        sessionId: '123',
        sessionName: 'Pasta',
        staffMembers: [],
      })
    })
    
    expect(result.current.isActive).toBe(true)
    expect(result.current.currentFlow?.id).toBe('close_cooling')
    expect(result.current.currentStep?.id).toBe('staff_code')
  })
  
  test('fala o prompt do primeiro step', () => {
    const { result } = renderConversationHook()
    
    act(() => {
      result.current.startFlow('close_cooling', {
        sessionId: '123',
        sessionName: 'Pasta',
        staffMembers: [],
      })
    })
    
    expect(mockSpeak).toHaveBeenCalledWith(
      expect.stringContaining('Pasta'),
      expect.any(Function)
    )
  })
  
  test('processa transcript válido e avança para próximo step', () => {
    const { result } = renderConversationHook()
    const mockStaff = { id: '1', name: 'Marco', staff_code: '1' }
    
    act(() => {
      result.current.startFlow('close_cooling', {
        sessionId: '123',
        sessionName: 'Pasta',
        staffMembers: [mockStaff],
      })
    })
    
    // Simula TTS complete → listening
    act(() => {
      mockSpeak.mock.calls[0][1]?.() // Chama callback do speak
    })
    
    // Simula transcript recebido
    act(() => {
      result.current.handleTranscript('one')
    })
    
    // Deve ter avançado para step de temperatura
    expect(result.current.currentStep?.id).toBe('temperature')
    expect(result.current.context.staffName).toBe('Marco')
  })
  
  test('faz re-prompt após validação falhar', () => {
    const { result } = renderConversationHook()
    
    act(() => {
      result.current.startFlow('close_cooling', {
        sessionId: '123',
        sessionName: 'Pasta',
        staffMembers: [],
      })
    })
    
    // Simula TTS complete
    act(() => {
      mockSpeak.mock.calls[0][1]?.()
    })
    
    // Limpa mocks
    mockSpeak.mockClear()
    
    // Simula transcript inválido (staff code não existe)
    act(() => {
      result.current.handleTranscript('99')
    })
    
    // Deve ter falado re-prompt
    expect(mockSpeak).toHaveBeenCalledWith(
      expect.stringContaining("staff"),
      expect.any(Function)
    )
    expect(result.current.retryCount).toBe(1)
  })
  
  test('cancela fluxo quando usuário diz "cancel"', () => {
    const { result } = renderConversationHook()
    
    act(() => {
      result.current.startFlow('close_cooling', {
        sessionId: '123',
        sessionName: 'Pasta',
        staffMembers: [],
      })
    })
    
    act(() => {
      mockSpeak.mock.calls[0][1]?.()
    })
    
    act(() => {
      result.current.handleTranscript('cancel')
    })
    
    expect(result.current.isActive).toBe(false)
    expect(mockSpeak).toHaveBeenCalledWith('Cancelled.')
  })
  
  test('chama fallback após max retries', () => {
    const { result } = renderConversationHook()
    
    act(() => {
      result.current.startFlow('close_cooling', {
        sessionId: '123',
        sessionName: 'Pasta',
        staffMembers: [],
      })
    })
    
    // Simula múltiplas falhas de validação
    for (let i = 0; i < 4; i++) {
      act(() => {
        mockSpeak.mock.calls[mockSpeak.mock.calls.length - 1]?.[1]?.()
      })
      act(() => {
        result.current.handleTranscript('invalid')
      })
    }
    
    expect(mockOnFallbackRequired).toHaveBeenCalled()
  })
})
```

### 7.4 Testes End-to-End (E2E)

#### 7.4.1 Configuração do Playwright

```typescript
// playwright.config.ts

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:5173/restaurant/',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
```

#### 7.4.2 Teste E2E: Fechar Cooling com Voz

```typescript
// e2e/closeCooling.spec.ts

import { test, expect } from '@playwright/test'

test.describe('Close Cooling Voice Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Setup: criar uma sessão de cooling ativa
    await page.goto('/')
    await page.click('button:has-text("Start Cooling")')
    await page.fill('input[placeholder="Item name"]', 'Test Pasta')
    await page.click('button:has-text("Start")')
    await expect(page.locator('text=Test Pasta')).toBeVisible()
  })
  
  test('completa fluxo de fechamento via botões (fallback)', async ({ page }) => {
    // Click no card de cooling
    await page.click('[data-testid="cooling-card"]:first-child button:has-text("Close")')
    
    // Modal deve abrir
    await expect(page.locator('[data-testid="close-cooling-modal"]')).toBeVisible()
    
    // Selecionar staff
    await page.click('[data-testid="staff-select"] >> text=Marco')
    
    // Inserir temperatura
    await page.fill('input[placeholder*="temperature"]', '5')
    
    // Confirmar
    await page.click('button:has-text("Confirm")')
    
    // Modal deve fechar e sessão não deve mais existir
    await expect(page.locator('[data-testid="close-cooling-modal"]')).not.toBeVisible()
    await expect(page.locator('text=Test Pasta')).not.toBeVisible()
  })
  
  test('mostra indicador de voz ativa quando wake word está ligado', async ({ page }) => {
    // Ir para settings e ativar wake word
    await page.click('[data-testid="settings-button"]')
    await page.click('[data-testid="wake-word-toggle"]')
    await page.click('button:has-text("Back")')
    
    // Deve mostrar indicador de "Listening for Hey Luma"
    await expect(page.locator('text=Hey Luma')).toBeVisible()
  })
  
  test('botão de microfone abre em estado de gravação', async ({ page }) => {
    // Click no botão de microfone
    await page.click('[data-testid="voice-button"]')
    
    // Deve mostrar estado de listening
    await expect(page.locator('[data-testid="voice-button"].voice-listening')).toBeVisible()
  })
})
```

#### 7.4.3 Teste E2E: Fallback Manual

```typescript
// e2e/voiceFallback.spec.ts

import { test, expect } from '@playwright/test'

test.describe('Voice Fallback Behavior', () => {
  test('mostra botões de opção após tentativas de voz', async ({ page }) => {
    await page.goto('/')
    
    // Simular situação de fallback
    // (Em produção isso seria testado com mocks de audio)
    
    // Setup: criar cooling e abrir modal de close
    await page.click('button:has-text("Start Cooling")')
    await page.fill('input', 'Test Item')
    await page.click('button:has-text("Start")')
    await page.click('[data-testid="cooling-card"] button:has-text("Close")')
    
    // Verificar que modal tem opção manual
    await expect(page.locator('button:has-text("Use Form")')).toBeVisible()
    
    // Click em "Use Form" deve mostrar inputs tradicionais
    await page.click('button:has-text("Use Form")')
    await expect(page.locator('select, input')).toBeVisible()
  })
  
  test('pre-preenche dados já coletados quando vai para fallback', async ({ page }) => {
    // Este teste verificaria que se o staff já foi capturado,
    // o campo está pre-selecionado no modal manual
    // Implementação depende de estado específico do fluxo
  })
})
```

### 7.5 Script de CI/CD para Rodar Testes

```yaml
# .github/workflows/voice-tests.yml

name: Voice System Tests

on:
  push:
    paths:
      - 'src/hooks/use*Voice*.ts'
      - 'src/hooks/use*Wake*.ts'
      - 'src/hooks/use*Conversation*.ts'
      - 'src/lib/voiceCommands.ts'
      - 'src/lib/conversationFlows.ts'
      - 'src/services/whisperService.ts'
      - '__tests__/**'
  pull_request:
    branches: [main, develop]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm run test:unit -- --coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          flags: unit

  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - run: npm ci
      - run: npm run test:integration

  e2e-tests:
    runs-on: ubuntu-latest
    needs: integration-tests
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - run: npm ci
      - run: npx playwright install --with-deps
      
      - name: Build app
        run: npm run build
      
      - name: Run E2E tests
        run: npm run test:e2e
      
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

---

## 8. Troubleshooting Guide

### 8.1 Problemas Comuns e Soluções

#### Problema: Wake word não detecta

**Sintomas:**
- Dizer "Hey Luma" não ativa o sistema
- Botão de microfone não muda de estado

**Diagnóstico:**
```typescript
// Abra o console e verifique:
console.log('[WakeWord] isActive:', isWakeWordActive)
console.log('[WakeWord] isSupported:', isSupported)
console.log('[WakeWord] lastHeard:', lastHeard)
```

**Soluções:**
1. Verificar se microfone está permitido no browser
2. Verificar se wake word está habilitado nas settings
3. Verificar se não está em modo HTTPS (necesário para Speech API)
4. Tentar outros wake words ("Luma", "Hi Luma")

---

#### Problema: Transcrição incorreta ou vazia

**Sintomas:**
- Sistema não entende o que foi dito
- Transcrição aparece errada
- "Heard: [vazio]"

**Diagnóstico:**
```typescript
// Verificar provider em uso
console.log('[VoiceButton] Provider:', providerLabel)
console.log('[Whisper] isConfigured:', isConfigured)

// Verificar audio
// O blob deve ter tamanho > 1000 bytes
console.log('[VoiceService] Audio blob size:', audioBlob.size)
```

**Soluções:**
1. Se usando Whisper, verificar API key nas settings
2. Aumentar volume de fala
3. Reduzir ruído ambiente
4. Tentar falar mais devagar
5. Mudar de provider (OpenAI → Browser ou vice-versa)

---

#### Problema: Fluxo conversacional não avança

**Sintomas:**
- Sistema pergunta mas não espera resposta
- Transcrição recebida mas não processada
- Não avança para próximo step

**Diagnóstico:**
```typescript
// Em useConversation
console.log('[Conversation] State:', {
  step: currentStep?.id,
  isWaiting: isWaitingForInput,
  retryCount,
})
```

**Soluções:**
1. Verificar se `handleTranscript` está sendo chamado corretamente
2. Verificar se TTS terminou antes de iniciar gravação
3. Aumentar timeout do step
4. Verificar logs de validação

---

#### Problema: Timeout muito rápido

**Sintomas:**
- Sistema diz "I didn't hear anything" muito rápido
- Não dá tempo de falar

**Soluções:**
```typescript
// Ajustar em voiceConfig.ts
export const VOICE_TIMING = {
  // Aumentar estes valores
  FLOW_STEP_TIMEOUT: 12000,      // Era 8000
  SILENCE_DURATION_FOR_STOP: 2500, // Era 1500
}
```

---

#### Problema: Eco do TTS é capturado

**Sintomas:**
- Sistema captura sua própria voz
- Transcrições incluem parte do prompt

**Soluções:**
```typescript
// Aumentar delay após TTS
export const VOICE_TIMING = {
  TTS_TO_LISTEN_DELAY: 500,  // Era 300
}

// Ou usar headphones
// Ou ajustar volume do TTS
speak(text, { rate: 1.2, volume: 0.7 })
```

---

### 8.2 Debug Mode

```typescript
// Adicionar em voiceConfig.ts para desenvolvimento
export const VOICE_DEBUG = {
  enabled: import.meta.env.DEV,
  logTransitions: true,
  logTranscripts: true,
  logTimings: true,
  simulateRecognition: false, // Para testes sem mic
}

// Uso no código
if (VOICE_DEBUG.enabled && VOICE_DEBUG.logTransitions) {
  console.log(`[Voice] ${prevState} → ${newState}`, event)
}
```

### 8.3 Checklist de Deploy

Antes de cada deploy, verificar:

- [ ] Testes unitários passando (`npm run test:unit`)
- [ ] Testes de integração passando (`npm run test:integration`)
- [ ] Build sem erros (`npm run build`)
- [ ] API keys válidas para Whisper (se usando)
- [ ] Wake word funciona em device real
- [ ] Fluxo completo de close cooling funciona
- [ ] Fallback para modal funciona
- [ ] TTS está funcionando
- [ ] Feedback visual correto (cores, animações)

### 8.4 Métricas a Monitorar

```typescript
// Métricas para analytics
interface VoiceMetrics {
  // Sucesso
  wakeWordDetectionRate: number      // % de wake words detectados
  commandRecognitionRate: number     // % de comandos parseados corretamente
  flowCompletionRate: number         // % de fluxos finalizados com sucesso
  
  // Performance
  avgTranscriptionTime: number       // Tempo médio Whisper
  avgFlowDuration: number            // Tempo médio por fluxo completo
  
  // Fallback
  fallbackRate: number               // % de vezes que foi para modal manual
  avgRetriesPerFlow: number          // Média de retries por fluxo
  
  // Erros
  errorRate: number                  // % de erros críticos
  micPermissionDeniedRate: number    // % de negação de mic
}
```

---

## Apêndice A: Glossário

| Termo | Definição |
|-------|-----------|
| **Wake Word** | Palavra ou frase que ativa o sistema de voz ("Hey Luma") |
| **Flow** | Sequência de steps conversacionais para completar uma ação |
| **Step** | Uma pergunta individual dentro de um fluxo |
| **TTS** | Text-to-Speech - sistema que fala as respostas |
| **STT** | Speech-to-Text - sistema que transcreve a fala |
| **Whisper** | API da OpenAI para transcrição de áudio |
| **Re-prompt** | Repetir a pergunta quando usuário não respondeu corretamente |
| **Fallback** | Alternativa manual quando voz falha |

---

## Apêndice B: Referências

1. Web Speech API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API
2. OpenAI Whisper: https://platform.openai.com/docs/guides/speech-to-text
3. XState (State Machines): https://xstate.js.org/docs/
4. React Testing Library: https://testing-library.com/docs/react-testing-library
5. Playwright: https://playwright.dev/docs/intro

---

**Última atualização:** Fevereiro 2026  
**Próxima revisão:** Abril 2026
