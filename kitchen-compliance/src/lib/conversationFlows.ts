// src/lib/conversationFlows.ts

import type { StaffMember } from '@/types';

export interface FlowContext {
  // Session IDs
  sessionId: string;
  sessionName: string;
  
  // Collected Data
  staffId?: string;
  staffName?: string;
  temperature?: number | null;
  confirmed?: boolean;
  
  // App State
  staffMembers: StaffMember[];
  
  // Custom Data for validation/logic
  validationData?: any;
  notes?: string;
  [key: string]: any;
}

export interface ValidationResult {
  valid: boolean;
  data?: any;
  message?: string;
}

export interface ConversationStep {
  id: string;
  prompt: string | ((context: FlowContext) => string);
  expectation: 'number' | 'text' | 'confirmation' | 'selection';
  validation?: (input: string, context: FlowContext) => ValidationResult;
  onSuccess: (input: string, context: FlowContext) => FlowContext;
  onFailure?: (reason: string, context: FlowContext) => string;
  maxRetries?: number;
  timeoutMs?: number;
}

export interface ConversationFlow {
  id: string;
  name: string;
  triggerCommands: string[];
  steps: ConversationStep[];
  onComplete: (context: FlowContext) => Promise<void>;
  onCancel?: (context: FlowContext) => void;
}

/**
 * Helper to parse numbers from spoken text
 */
export function parseSpokenNumber(text: string): number | null {
  const lower = text.toLowerCase().trim();
  
  const TEXT_NUMBERS: Record<string, number> = {
    'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4,
    'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9,
    'ten': 10, 'eleven': 11, 'twelve': 12,
    'minus': -1, 'negative': -1,
  };
  
  // Try direct number match
  const directMatch = lower.match(/-?\d+(?:\.\d+)?/);
  if (directMatch) return Number(directMatch[0]);
  
  // Try word match
  for (const [word, val] of Object.entries(TEXT_NUMBERS)) {
    if (lower.includes(word)) {
      if (lower.includes('minus') || lower.includes('negative')) {
        const numPart = lower.replace(/minus|negative/g, '').trim();
        const numVal = parseSpokenNumber(numPart);
        return numVal !== null ? -Math.abs(numVal) : null;
      }
      return val;
    }
  }
  
  return null;
}

/**
 * Flow Definitions
 */

export const closeCoolingFlow: ConversationFlow = {
  id: 'close_cooling',
  name: 'Close Cooling Session',
  triggerCommands: ['stop_cooling', 'finish_cooling', 'done', 'in_fridge', 'closing'],
  
  steps: [
    {
      id: 'staff_code',
      prompt: (ctx) => `Closing ${ctx.sessionName}. What is your staff code?`,
      expectation: 'number',
      timeoutMs: 12000,
      
      validation: (input, ctx) => {
        const staffCode = parseSpokenNumber(input);
        if (staffCode === null) return { valid: false, message: "I didn't catch a number." };
        
        const staff = ctx.staffMembers.find(
          s => s.staff_code === staffCode.toString() ||
               parseInt(s.staff_code || '', 10) === staffCode
        );
        
        if (!staff) return { valid: false, message: `No staff with code ${staffCode}.` };
        
        return { valid: true, data: staff };
      },
      
      onSuccess: (_input, ctx) => ({
        ...ctx,
        staffId: ctx.validationData.id,
        staffName: ctx.validationData.name,
      }),
      
      onFailure: () => "I didn't understand. Please say your staff number.",
    },
    {
      id: 'temperature',
      prompt: (ctx) => `Got it, ${ctx.staffName}. What's the final temperature?`,
      expectation: 'number',
      
      validation: (input) => {
        const lower = input.toLowerCase();
        if (lower.includes('skip')) return { valid: true, data: null };
        
        const temp = parseSpokenNumber(input);
        if (temp === null) return { valid: false, message: "Please say a number or 'skip'." };
        
        if (temp < -30 || temp > 60) return { valid: false, message: `${temp} degrees? That seems wrong.` };
        
        return { valid: true, data: temp };
      },
      
      onSuccess: (_input, ctx) => ({
        ...ctx,
        temperature: ctx.validationData,
      }),
      
      onFailure: () => "Say the temperature in degrees, or say skip.",
    },
    {
      id: 'confirmation',
      prompt: (ctx) => {
        const tempText = ctx.temperature !== null ? `${ctx.temperature} degrees` : 'no temperature';
        return `Summary: ${ctx.sessionName} by ${ctx.staffName} at ${tempText}. Say confirm to save.`;
      },
      expectation: 'confirmation',
      
      validation: (input) => {
        const lower = input.toLowerCase();
        const confirmWords = ['confirm', 'yes', 'save', 'ok', 'okay', 'correct', 'right', 'yep', 'yeah'];
        const cancelWords = ['cancel', 'no', 'stop', 'wrong', 'nope', 'back'];
        
        if (confirmWords.some(w => lower.includes(w))) return { valid: true, data: 'confirmed' };
        if (cancelWords.some(w => lower.includes(w))) return { valid: true, data: 'cancelled' };
        
        return { valid: false, message: "Say 'confirm' to save or 'cancel' to discard." };
      },
      
      onSuccess: (_input, ctx) => ({
        ...ctx,
        confirmed: ctx.validationData === 'confirmed',
      }),
    },
  ],
  
  onComplete: async (ctx) => {
    // Component will handle the actual service call based on this context
    console.log('[Flow] close_cooling completed', ctx);
  },
};

export const conversationFlows: ConversationFlow[] = [
  closeCoolingFlow,
];

export function findFlowByCommand(commandType: string): ConversationFlow | undefined {
  return conversationFlows.find(flow => 
    flow.triggerCommands.includes(commandType)
  );
}
