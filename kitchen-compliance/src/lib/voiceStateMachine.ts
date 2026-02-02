// src/lib/voiceStateMachine.ts

import { ConversationFlow, FlowContext } from './conversationFlows';

export type VoiceState =
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
  | 'error';

export type VoiceEvent =
  | { type: 'ENABLE_WAKE_WORD' }
  | { type: 'DISABLE_WAKE_WORD' }
  | { type: 'WAKE_WORD_HEARD' }
  | { type: 'WAKE_WORD_CONFIRMED' }
  | { type: 'IMMEDIATE_COMMAND'; command: string }
  | { type: 'COMMAND_TIMEOUT' }
  | { type: 'TRANSCRIPT_RECEIVED'; text: string }
  | { type: 'COMMAND_PARSED'; flowId: string }
  | { type: 'FLOW_STARTED'; flowId: string }
  | { type: 'TTS_STARTED' }
  | { type: 'TTS_COMPLETED' }
  | { type: 'VALIDATION_SUCCESS'; data: any }
  | { type: 'VALIDATION_FAILED'; message: string }
  | { type: 'NEXT_STEP' }
  | { type: 'FLOW_FINISHED' }
  | { type: 'MAX_RETRIES_REACHED' }
  | { type: 'USER_CANCELLED' }
  | { type: 'ERROR'; error: string };

export interface VoiceContextState {
  wakeWordEnabled: boolean;
  currentFlow: ConversationFlow | null;
  currentStepIndex: number;
  flowContext: FlowContext;
  retryCount: number;
  lastTranscript: string;
  lastError: string | null;
}

export const VoiceTransitions: Record<VoiceState, Partial<Record<VoiceEvent['type'], VoiceState>>> = {
  idle: {
    ENABLE_WAKE_WORD: 'wake_word_listening',
  },
  wake_word_listening: {
    DISABLE_WAKE_WORD: 'idle',
    WAKE_WORD_HEARD: 'wake_word_detected',
    WAKE_WORD_CONFIRMED: 'wake_word_detected',
    USER_CANCELLED: 'wake_word_listening',
  },
  wake_word_detected: {
    IMMEDIATE_COMMAND: 'processing_command',
    COMMAND_TIMEOUT: 'command_listening',
    TRANSCRIPT_RECEIVED: 'processing_command',
    USER_CANCELLED: 'wake_word_listening',
  },
  command_listening: {
    TRANSCRIPT_RECEIVED: 'processing_command',
    COMMAND_TIMEOUT: 'wake_word_listening',
    USER_CANCELLED: 'wake_word_listening',
  },
  processing_command: {
    FLOW_STARTED: 'flow_active',
    ERROR: 'error',
    USER_CANCELLED: 'wake_word_listening',
  },
  flow_active: {
    TTS_STARTED: 'flow_speaking',
    FLOW_FINISHED: 'flow_complete',
    USER_CANCELLED: 'wake_word_listening',
  },
  flow_speaking: {
    TTS_COMPLETED: 'flow_listening',
    USER_CANCELLED: 'wake_word_listening',
  },
  flow_listening: {
    TRANSCRIPT_RECEIVED: 'flow_validating',
    COMMAND_TIMEOUT: 'flow_speaking',
    USER_CANCELLED: 'wake_word_listening',
  },
  flow_validating: {
    VALIDATION_SUCCESS: 'flow_active',
    VALIDATION_FAILED: 'flow_speaking',
    MAX_RETRIES_REACHED: 'fallback_manual',
    FLOW_FINISHED: 'flow_complete',
    USER_CANCELLED: 'wake_word_listening',
  },
  flow_complete: {
    ENABLE_WAKE_WORD: 'wake_word_listening',
    NEXT_STEP: 'wake_word_listening',
  },
  fallback_manual: {
    USER_CANCELLED: 'wake_word_listening',
    FLOW_FINISHED: 'flow_complete',
  },
  error: {
    ENABLE_WAKE_WORD: 'wake_word_listening',
  },
};
