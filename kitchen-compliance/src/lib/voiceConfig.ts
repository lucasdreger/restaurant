// src/lib/voiceConfig.ts

/**
 * Configuration for the ChefVoice Conversational System
 */

export const VOICE_TIMING = {
  // Wake Word Detection
  WAKE_WORD_INTERIM_BEEP_DELAY: 0,          // Immediate beep on interim detection
  WAKE_WORD_TO_COMMAND_GAP: 500,             // Delay between wake word and recording start
  IMMEDIATE_COMMAND_WINDOW: 300,             // Window for command spoken together with wake word (reduced for instant response)
  
  // Command Listening
  COMMAND_SILENCE_THRESHOLD: 1500,           // Silence before processing (ms)
  COMMAND_MAX_DURATION: 10000,               // Max command recording duration
  COMMAND_MIN_AUDIO_SIZE: 1000,              // Min bytes for audio processing
  
  // Flow Conversation
  TTS_TO_LISTEN_DELAY: 500,                  // Increased from 300 to avoid echo
  FLOW_STEP_TIMEOUT: 10000,                  // Default timeout per step
  FLOW_STEP_TIMEOUT_STAFF: 12000,            // More time for staff code
  FLOW_STEP_TIMEOUT_CONFIRM: 10000,          // Timeout for confirmation
  
  // Retries & Feedback
  RETRY_DELAY: 500,                          // Delay before re-prompt
  SILENCE_BEFORE_REPROMPT: 3000,             // Silence before auto-repeating question
  
  // Audio Analysis
  SILENCE_DETECTION_THRESHOLD: 5,            // Volume threshold for silence (0-100)
  SILENCE_DURATION_FOR_STOP: 2000,           // Silence duration for auto-stop (ms)
};

export const VOICE_LIMITS = {
  MAX_RETRIES_PER_STEP: 3,
  MAX_TOTAL_RETRIES_PER_FLOW: 5,
  MAX_FLOW_DURATION: 60000,                  // 1 minute max for complete dialog
  STICKY_STAFF_TIMEOUT_MS: 300000,           // 5 minutes remember staff identity
};

export const VOICE_DEBUG = {
  enabled: import.meta.env.DEV,
  logTransitions: true,
  logTranscripts: true,
  logTimings: true,
  simulateRecognition: false,
};

export const AUDIO_ASSETS = {
  WAKE_WORD_BEEP: '/sounds/wake_detected.mp3',
  SUCCESS_BEEP: '/sounds/success.mp3',
  ERROR_BEEP: '/sounds/error.mp3',
};
