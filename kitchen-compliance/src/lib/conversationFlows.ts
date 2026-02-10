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
 * Comprehensive spoken number parser
 * Handles: 0-100+, negatives, decimals, ordinals, with units
 */
export function parseSpokenNumber(text: string): number | null {
  const lower = text.toLowerCase().trim();

  // Text number mappings
  const UNITS: Record<string, number> = {
    'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4,
    'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9,
    'ten': 10, 'eleven': 11, 'twelve': 12, 'thirteen': 13,
    'fourteen': 14, 'fifteen': 15, 'sixteen': 16, 'seventeen': 17,
    'eighteen': 18, 'nineteen': 19,
  };

  const TENS: Record<string, number> = {
    'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50,
    'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90,
  };

  const ORDINALS: Record<string, number> = {
    'first': 1, 'second': 2, 'third': 3, 'fourth': 4, 'fifth': 5,
    'sixth': 6, 'seventh': 7, 'eighth': 8, 'ninth': 9, 'tenth': 10,
  };

  // Check for negative prefix
  const isNegative = lower.includes('minus') || lower.includes('negative');
  const cleanedText = lower
    .replace(/minus|negative/g, '')
    .replace(/degrees?|celsius|fahrenheit|°c|°f/g, '')
    .trim();

  // Try direct numeric match first (handles decimals like 3.5 or -18)
  const directMatch = cleanedText.match(/-?\d+(?:\.\d+)?/);
  if (directMatch) {
    const num = Number(directMatch[0]);
    return isNegative && num > 0 ? -num : num;
  }

  // Try "point" decimal format: "three point five" → 3.5
  const pointMatch = cleanedText.match(/(\w+)\s+point\s+(\w+)/);
  if (pointMatch) {
    const whole = UNITS[pointMatch[1]] ?? null;
    const decimal = UNITS[pointMatch[2]] ?? null;
    if (whole !== null && decimal !== null) {
      const result = whole + decimal / 10;
      return isNegative ? -result : result;
    }
  }

  // Try compound tens: "seventy-three", "eighty five" → 73, 85
  for (const [tensWord, tensVal] of Object.entries(TENS)) {
    const compoundPattern = new RegExp(`${tensWord}[\\s-]*(\\w+)?`);
    const match = cleanedText.match(compoundPattern);
    if (match) {
      const unitsWord = match[1]?.trim();
      const unitsVal = unitsWord ? (UNITS[unitsWord] ?? 0) : 0;
      const result = tensVal + unitsVal;
      return isNegative ? -result : result;
    }
  }

  // Try "hundred" format: "one hundred", "a hundred" → 100
  if (cleanedText.includes('hundred')) {
    const hundredMatch = cleanedText.match(/(\w+)?\s*hundred\s*(?:and\s*)?(\w+)?/);
    if (hundredMatch) {
      const multiplier = hundredMatch[1] === 'a' || !hundredMatch[1] ? 1 : (UNITS[hundredMatch[1]] ?? 1);
      const remainder = hundredMatch[2] ? (UNITS[hundredMatch[2]] ?? TENS[hundredMatch[2]] ?? 0) : 0;
      const result = multiplier * 100 + remainder;
      return isNegative ? -result : result;
    }
  }

  // Try ordinals
  for (const [word, val] of Object.entries(ORDINALS)) {
    if (cleanedText.includes(word)) {
      return isNegative ? -val : val;
    }
  }

  // Try single units (must be after compound checks)
  for (const [word, val] of Object.entries(UNITS)) {
    const regex = new RegExp(`\\b${word}\\b`);
    if (regex.test(cleanedText)) {
      return isNegative ? -val : val;
    }
  }

  // Try tens alone (twenty, thirty, etc.)
  for (const [word, val] of Object.entries(TENS)) {
    if (cleanedText.includes(word)) {
      return isNegative ? -val : val;
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

// Fridge temperature logging flow
export const logFridgeTempFlow: ConversationFlow = {
  id: 'log_fridge_temp',
  name: 'Log Fridge Temperature',
  triggerCommands: ['log_fridge_temp'],

  steps: [
    {
      id: 'fridge_selection',
      prompt: () => 'Which fridge? Say the fridge name or number.',
      expectation: 'text',
      timeoutMs: 12000,

      validation: (input) => {
        const fridgeName = input.trim();
        if (!fridgeName || fridgeName.length < 1) {
          return { valid: false, message: "Please say a fridge name or number." };
        }
        return { valid: true, data: fridgeName };
      },

      onSuccess: (_input, ctx) => ({
        ...ctx,
        fridgeName: ctx.validationData,
      }),

      onFailure: () => "I didn't understand. Please say the fridge name.",
    },
    {
      id: 'staff_code',
      prompt: () => 'What is your staff code?',
      expectation: 'number',
      timeoutMs: 10000,

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

      onFailure: () => "Please say your staff number.",
    },
    {
      id: 'temperature',
      prompt: (ctx) => `Got it, ${ctx.staffName}. What's the temperature in Celsius?`,
      expectation: 'number',
      timeoutMs: 10000,

      validation: (input) => {
        const temp = parseSpokenNumber(input);
        if (temp === null) return { valid: false, message: "Please say a number." };

        if (temp < -30 || temp > 60) {
          return { valid: false, message: `${temp} degrees? That doesn't seem right for a fridge.` };
        }

        return { valid: true, data: temp };
      },

      onSuccess: (_input, ctx) => ({
        ...ctx,
        temperature: ctx.validationData,
      }),

      onFailure: () => "Say the temperature in degrees Celsius.",
    },
    {
      id: 'confirmation',
      prompt: (ctx) => {
        const temp = ctx.temperature ?? 0;
        const compliance = temp >= 0 && temp <= 5 ? '✓ Compliant' : '⚠ Out of range (0-5°C)';
        return `Log ${temp}°C for ${ctx.fridgeName} by ${ctx.staffName}. ${compliance}. Say confirm to save.`;
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
    console.log('[Flow] log_fridge_temp completed', ctx);
  },
};

// ========================================
// LOG COOKING FLOW
// ========================================
export const logCookingFlow: ConversationFlow = {
  id: 'log_cooking',
  name: 'Log Cooking Temperature',
  triggerCommands: ['log_cooking', 'cooking', 'record_cooking'],

  steps: [
    {
      id: 'staff_code',
      prompt: () => 'Logging cooking. What is your chef number?',
      expectation: 'number',
      timeoutMs: 12000,

      validation: (input, ctx) => {
        const staffCode = parseSpokenNumber(input);
        if (staffCode === null) return { valid: false, message: "I didn't catch a number." };

        const staff = ctx.staffMembers.find(
          s => s.staff_code === staffCode.toString() ||
            parseInt(s.staff_code || '', 10) === staffCode
        );

        if (!staff) return { valid: false, message: `No chef with code ${staffCode}.` };

        return { valid: true, data: staff };
      },

      onSuccess: (_input, ctx) => ({
        ...ctx,
        staffId: ctx.validationData.id,
        staffName: ctx.validationData.name,
      }),

      onFailure: () => "Please say your chef number.",
    },
    {
      id: 'food_name',
      prompt: (ctx) => `Got it, ${ctx.staffName}. What food are you cooking?`,
      expectation: 'text',
      timeoutMs: 12000,

      validation: (input) => {
        const foodName = input.trim();
        if (!foodName || foodName.length < 2) {
          return { valid: false, message: "Please say the food name." };
        }
        return { valid: true, data: foodName };
      },

      onSuccess: (_input, ctx) => ({
        ...ctx,
        foodName: ctx.validationData,
      }),

      onFailure: () => "What food is being cooked?",
    },
    {
      id: 'temperature',
      prompt: () => "What's the core temperature?",
      expectation: 'number',
      timeoutMs: 10000,

      validation: (input) => {
        const temp = parseSpokenNumber(input);
        if (temp === null) return { valid: false, message: "Please say the temperature." };

        return { valid: true, data: temp };
      },

      onSuccess: (_input, ctx) => ({
        ...ctx,
        temperature: ctx.validationData,
        isCompliant: ctx.validationData >= 75,
      }),

      onFailure: () => "Say the core temperature in degrees.",
    },
    {
      id: 'confirmation',
      prompt: (ctx) => {
        const compliance = (ctx.temperature ?? 0) >= 75 ? '✓ Compliant' : '⚠ Below 75°C';
        return `Cooking ${ctx.foodName} at ${ctx.temperature}°C by ${ctx.staffName}. ${compliance}. Confirm?`;
      },
      expectation: 'confirmation',

      validation: (input) => {
        const lower = input.toLowerCase();
        const confirmWords = ['confirm', 'yes', 'save', 'ok', 'okay', 'correct', 'right'];
        const cancelWords = ['cancel', 'no', 'stop', 'wrong', 'nope', 'back'];

        if (confirmWords.some(w => lower.includes(w))) return { valid: true, data: 'confirmed' };
        if (cancelWords.some(w => lower.includes(w))) return { valid: true, data: 'cancelled' };

        return { valid: false, message: "Say 'confirm' or 'cancel'." };
      },

      onSuccess: (_input, ctx) => ({
        ...ctx,
        confirmed: ctx.validationData === 'confirmed',
      }),
    },
  ],

  onComplete: async (ctx) => {
    console.log('[Flow] log_cooking completed', ctx);
  },
};

// ========================================
// START COOLING FLOW
// ========================================
export const startCoolingFlow: ConversationFlow = {
  id: 'start_cooling',
  name: 'Start Cooling Session',
  triggerCommands: ['start_cooling', 'begin_cooling', 'cool'],

  steps: [
    {
      id: 'staff_code',
      prompt: () => 'Starting cooling. Chef number?',
      expectation: 'number',
      timeoutMs: 12000,

      validation: (input, ctx) => {
        const staffCode = parseSpokenNumber(input);
        if (staffCode === null) return { valid: false, message: "I didn't catch a number." };

        const staff = ctx.staffMembers.find(
          s => s.staff_code === staffCode.toString() ||
            parseInt(s.staff_code || '', 10) === staffCode
        );

        if (!staff) return { valid: false, message: `No chef with code ${staffCode}.` };

        return { valid: true, data: staff };
      },

      onSuccess: (_input, ctx) => ({
        ...ctx,
        staffId: ctx.validationData.id,
        staffName: ctx.validationData.name,
      }),

      onFailure: () => "Please say your chef number.",
    },
    {
      id: 'food_name',
      prompt: (ctx) => `${ctx.staffName}, what food is being cooled?`,
      expectation: 'text',
      timeoutMs: 12000,

      validation: (input) => {
        const foodName = input.trim();
        if (!foodName || foodName.length < 2) {
          return { valid: false, message: "Please say the food name." };
        }
        return { valid: true, data: foodName };
      },

      onSuccess: (_input, ctx) => ({
        ...ctx,
        foodName: ctx.validationData,
      }),

      onFailure: () => "What food is being cooled?",
    },
    {
      id: 'cooked_today',
      prompt: () => "Was this food cooked today?",
      expectation: 'confirmation',
      timeoutMs: 8000,

      validation: (input) => {
        const lower = input.toLowerCase();
        const yesWords = ['yes', 'yeah', 'yep', 'correct', 'right', 'today'];
        const noWords = ['no', 'nope', 'yesterday', 'before', 'leftover'];

        if (yesWords.some(w => lower.includes(w))) return { valid: true, data: true };
        if (noWords.some(w => lower.includes(w))) return { valid: true, data: false };

        return { valid: false, message: "Say yes or no." };
      },

      onSuccess: (_input, ctx) => ({
        ...ctx,
        cookedToday: ctx.validationData,
      }),
    },
    {
      id: 'initial_temp',
      prompt: () => "Initial temperature?",
      expectation: 'number',
      timeoutMs: 10000,

      validation: (input) => {
        const temp = parseSpokenNumber(input);
        if (temp === null) return { valid: false, message: "Please say a number." };
        return { valid: true, data: temp };
      },

      onSuccess: (_input, ctx) => ({
        ...ctx,
        initialTemp: ctx.validationData,
      }),

      onFailure: () => "Say the starting temperature.",
    },
    {
      id: 'confirmation',
      prompt: (ctx) => {
        const leftoverNote = ctx.cookedToday ? '' : ' (leftover)';
        return `Cooling ${ctx.foodName}${leftoverNote} at ${ctx.initialTemp}°C. Confirm?`;
      },
      expectation: 'confirmation',

      validation: (input) => {
        const lower = input.toLowerCase();
        const confirmWords = ['confirm', 'yes', 'save', 'ok', 'start', 'go'];
        const cancelWords = ['cancel', 'no', 'stop', 'wrong'];

        if (confirmWords.some(w => lower.includes(w))) return { valid: true, data: 'confirmed' };
        if (cancelWords.some(w => lower.includes(w))) return { valid: true, data: 'cancelled' };

        return { valid: false, message: "Say 'confirm' or 'cancel'." };
      },

      onSuccess: (_input, ctx) => ({
        ...ctx,
        confirmed: ctx.validationData === 'confirmed',
      }),
    },
  ],

  onComplete: async (ctx) => {
    console.log('[Flow] start_cooling completed', ctx);
  },
};

// ========================================
// REHEATING FLOW
// ========================================
export const logReheatingFlow: ConversationFlow = {
  id: 'log_reheating',
  name: 'Log Reheating',
  triggerCommands: ['log_reheating', 'reheating', 'reheat'],

  steps: [
    {
      id: 'staff_code',
      prompt: () => 'Logging reheating. Chef number?',
      expectation: 'number',
      timeoutMs: 12000,

      validation: (input, ctx) => {
        const staffCode = parseSpokenNumber(input);
        if (staffCode === null) return { valid: false, message: "I didn't catch a number." };

        const staff = ctx.staffMembers.find(
          s => s.staff_code === staffCode.toString() ||
            parseInt(s.staff_code || '', 10) === staffCode
        );

        if (!staff) return { valid: false, message: `No chef with code ${staffCode}.` };

        return { valid: true, data: staff };
      },

      onSuccess: (_input, ctx) => ({
        ...ctx,
        staffId: ctx.validationData.id,
        staffName: ctx.validationData.name,
      }),

      onFailure: () => "Please say your chef number.",
    },
    {
      id: 'food_name',
      prompt: (ctx) => `${ctx.staffName}, what food is being reheated?`,
      expectation: 'text',
      timeoutMs: 12000,

      validation: (input) => {
        const foodName = input.trim();
        if (!foodName || foodName.length < 2) {
          return { valid: false, message: "Please say the food name." };
        }
        return { valid: true, data: foodName };
      },

      onSuccess: (_input, ctx) => ({
        ...ctx,
        foodName: ctx.validationData,
      }),

      onFailure: () => "What food is being reheated?",
    },
    {
      id: 'temperature',
      prompt: () => "Core temperature?",
      expectation: 'number',
      timeoutMs: 10000,

      validation: (input) => {
        const temp = parseSpokenNumber(input);
        if (temp === null) return { valid: false, message: "Please say a number." };
        return { valid: true, data: temp };
      },

      onSuccess: (_input, ctx) => ({
        ...ctx,
        temperature: ctx.validationData,
        isCompliant: ctx.validationData >= 75,
      }),

      onFailure: () => "Say the temperature.",
    },
    {
      id: 'confirmation',
      prompt: (ctx) => {
        const compliance = (ctx.temperature ?? 0) >= 75 ? '✓ Compliant' : '⚠ Below 75°C';
        return `Reheating ${ctx.foodName} at ${ctx.temperature ?? 0}°C. ${compliance}. Confirm?`;
      },
      expectation: 'confirmation',

      validation: (input) => {
        const lower = input.toLowerCase();
        if (['confirm', 'yes', 'save', 'ok'].some(w => lower.includes(w)))
          return { valid: true, data: 'confirmed' };
        if (['cancel', 'no', 'stop'].some(w => lower.includes(w)))
          return { valid: true, data: 'cancelled' };
        return { valid: false, message: "Say 'confirm' or 'cancel'." };
      },

      onSuccess: (_input, ctx) => ({ ...ctx, confirmed: ctx.validationData === 'confirmed' }),
    },
  ],

  onComplete: async (ctx) => {
    console.log('[Flow] log_reheating completed', ctx);
  },
};

// ========================================
// HOT HOLD FLOW
// ========================================
export const logHotHoldFlow: ConversationFlow = {
  id: 'log_hot_hold',
  name: 'Log Hot Hold',
  triggerCommands: ['log_hot_hold', 'hot_hold', 'holding'],

  steps: [
    {
      id: 'staff_code',
      prompt: () => 'Hot hold. Chef number?',
      expectation: 'number',
      timeoutMs: 12000,

      validation: (input, ctx) => {
        const staffCode = parseSpokenNumber(input);
        if (staffCode === null) return { valid: false, message: "I didn't catch a number." };

        const staff = ctx.staffMembers.find(
          s => s.staff_code === staffCode.toString() ||
            parseInt(s.staff_code || '', 10) === staffCode
        );

        if (!staff) return { valid: false, message: `No chef with code ${staffCode}.` };

        return { valid: true, data: staff };
      },

      onSuccess: (_input, ctx) => ({
        ...ctx,
        staffId: ctx.validationData.id,
        staffName: ctx.validationData.name,
      }),

      onFailure: () => "Chef number?",
    },
    {
      id: 'food_name',
      prompt: (ctx) => `${ctx.staffName}, what food?`,
      expectation: 'text',
      timeoutMs: 12000,

      validation: (input) => {
        const foodName = input.trim();
        if (!foodName || foodName.length < 2) return { valid: false, message: "Food name?" };
        return { valid: true, data: foodName };
      },

      onSuccess: (_input, ctx) => ({ ...ctx, foodName: ctx.validationData }),
      onFailure: () => "What food is being hot held?",
    },
    {
      id: 'temperature',
      prompt: () => "Holding temperature?",
      expectation: 'number',
      timeoutMs: 10000,

      validation: (input) => {
        const temp = parseSpokenNumber(input);
        if (temp === null) return { valid: false, message: "Please say a number." };
        return { valid: true, data: temp };
      },

      onSuccess: (_input, ctx) => ({
        ...ctx,
        temperature: ctx.validationData,
        isCompliant: ctx.validationData >= 63,
      }),

      onFailure: () => "Say the temperature.",
    },
    {
      id: 'confirmation',
      prompt: (ctx) => {
        const compliance = (ctx.temperature ?? 0) >= 63 ? '✓ OK' : '⚠ Below 63°C';
        return `Hot hold ${ctx.foodName} at ${ctx.temperature ?? 0}°C. ${compliance}. Next check 90 min. Confirm?`;
      },
      expectation: 'confirmation',

      validation: (input) => {
        const lower = input.toLowerCase();
        if (['confirm', 'yes', 'ok', 'start'].some(w => lower.includes(w)))
          return { valid: true, data: 'confirmed' };
        if (['cancel', 'no', 'stop'].some(w => lower.includes(w)))
          return { valid: true, data: 'cancelled' };
        return { valid: false, message: "Say 'confirm' or 'cancel'." };
      },

      onSuccess: (_input, ctx) => ({
        ...ctx,
        confirmed: ctx.validationData === 'confirmed',
        nextCheckMinutes: 90,
      }),
    },
  ],

  onComplete: async (ctx) => {
    console.log('[Flow] log_hot_hold completed', ctx);
  },
};

// ========================================
// HYGIENE INSPECTION FLOW
// ========================================
export const hygieneInspectionFlow: ConversationFlow = {
  id: 'hygiene_inspection',
  name: 'Hygiene Inspection',
  triggerCommands: ['hygiene_inspection', 'hygiene', 'inspection'],

  steps: [
    {
      id: 'staff_code',
      prompt: () => 'Hygiene inspection. Staff number?',
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
        inspectionItems: [],
      }),

      onFailure: () => "Staff number?",
    },
    {
      id: 'batch_items',
      prompt: (ctx) => `${ctx.staffName}, say area and status. Say 'done' when finished.`,
      expectation: 'text',
      timeoutMs: 30000,
      maxRetries: 20,

      validation: (input, ctx) => {
        const lower = input.toLowerCase().trim();

        if (['done', 'finish', 'finished', 'complete'].includes(lower)) {
          if (!ctx.inspectionItems?.length) {
            return { valid: false, message: "No items yet. Say area and status." };
          }
          return { valid: true, data: { done: true } };
        }

        const statusWords = ['clean', 'dirty', 'needs attention', 'ok', 'good', 'bad'];
        let status = 'clean';
        let area = lower;

        for (const s of statusWords) {
          if (lower.includes(s)) {
            status = s === 'good' || s === 'ok' ? 'clean' : s === 'bad' ? 'dirty' : s;
            area = lower.replace(s, '').replace(',', '').trim();
            break;
          }
        }

        if (area.length < 2) return { valid: false, message: "Say area and status." };

        return {
          valid: true,
          data: { done: false, area, status, isCompliant: status === 'clean' }
        };
      },

      onSuccess: (_input, ctx) => {
        if (ctx.validationData.done) return { ...ctx, batchComplete: true };

        const items = [...(ctx.inspectionItems || []), {
          area: ctx.validationData.area,
          status: ctx.validationData.status,
          isCompliant: ctx.validationData.isCompliant,
        }];

        return { ...ctx, inspectionItems: items, batchComplete: false };
      },

      onFailure: () => "Say area and status, like 'prep bench clean'.",
    },
    {
      id: 'summary',
      prompt: (ctx) => {
        const items = ctx.inspectionItems || [];
        const issues = items.filter((i: any) => !i.isCompliant).length;
        return `${items.length} areas checked. ${issues ? `${issues} issues.` : 'All clean.'} Confirm?`;
      },
      expectation: 'confirmation',

      validation: (input) => {
        const lower = input.toLowerCase();
        if (['confirm', 'yes', 'save', 'ok'].some(w => lower.includes(w)))
          return { valid: true, data: 'confirmed' };
        if (['cancel', 'no', 'stop'].some(w => lower.includes(w)))
          return { valid: true, data: 'cancelled' };
        return { valid: false, message: "Say 'confirm' or 'cancel'." };
      },

      onSuccess: (_input, ctx) => ({ ...ctx, confirmed: ctx.validationData === 'confirmed' }),
    },
  ],

  onComplete: async (ctx) => {
    console.log('[Flow] hygiene_inspection completed', ctx);
  },
};

// ========================================
// EXPORT ALL FLOWS
// ========================================
export const conversationFlows: ConversationFlow[] = [
  closeCoolingFlow,
  logFridgeTempFlow,
  logCookingFlow,
  startCoolingFlow,
  logReheatingFlow,
  logHotHoldFlow,
  hygieneInspectionFlow,
];

export function findFlowByCommand(commandType: string): ConversationFlow | undefined {
  return conversationFlows.find(flow =>
    flow.triggerCommands.includes(commandType)
  );
}

