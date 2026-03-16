import type { VoiceCommand } from '@/types'
import { FOOD_ITEM_PRESETS } from '@/types'
// COMMANDS ARE NOW CONFIGURED IN: src/config/voicePhrases.ts
import { VOICE_PHRASES } from '@/config/voicePhrases'
import { isLike } from '@/lib/stringUtils'

const START_INTENT_WORDS = ['start', 'begin', 'new']
const STOP_INTENT_WORDS = [
  'stop',
  'done',
  'close',
  'finish',
  'finished',
  'complete',
  'completed',
  'closing',
  'pull',
  'pulling',
  'pulled',
  'move',
  'moved',
  'fridge',
  'finis',
]
const COOLING_VARIANTS = ['cooling', 'coolin', 'kulin', 'culing', 'kooling', 'culling', 'comi', 'cool', 'pulling']
const COOKING_VARIANTS = ['cooking', 'cook', 'cookingg']
const REHEATING_VARIANTS = ['reheating', 'reheat', 'heated']
const HOT_HOLD_VARIANTS = ['hot hold', 'hot-hold', 'holding', 'hold']
const IGNORE_STOP_TOKENS = new Set([
  'hey',
  'hi',
  'luma',
  'please',
  'can',
  'you',
  'could',
  'would',
  'to',
  'in',
  'the',
  'a',
  'an',
  'my',
  'for',
  'on',
  'at',
  'number',
  ...START_INTENT_WORDS,
  ...STOP_INTENT_WORDS,
  ...COOLING_VARIANTS,
])

function normalizeVoiceText(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasApproxIntent(text: string, words: string[], threshold = 1): boolean {
  if (!text) return false
  const tokens = text.split(/\s+/).filter(Boolean)
  return words.some((word) => {
    if (text.includes(word)) return true
    return tokens.some((token) => isLike(token, word, threshold))
  })
}

function extractItemFromNoisyStop(text: string): string | undefined {
  const tokens = text.split(/\s+/).filter(Boolean)
  const itemTokens = tokens.filter((token) => {
    if (!token || token.length < 2) return false
    if (/^\d+$/.test(token)) return false
    return !IGNORE_STOP_TOKENS.has(token)
  })

  if (itemTokens.length === 0) return undefined
  return itemTokens
    .join(' ')
    .replace(/\b(?:degrees?|celsius|temp|temperature)\b/gi, '')
    .trim() || undefined
}

function toDisplayItem(item: string | undefined): string | undefined {
  if (!item) return undefined
  const normalizedItem = item.trim().toLowerCase()
  if (!normalizedItem) return undefined

  const preset = FOOD_ITEM_PRESETS.find(
    (presetItem) =>
      presetItem.name.toLowerCase() === normalizedItem ||
      presetItem.name.toLowerCase().includes(normalizedItem) ||
      presetItem.id === normalizedItem
  )

  if (preset) return preset.name

  return normalizedItem
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ')
}

function parseTemperature(text: string): number | undefined {
  const match = text.match(/-?\d+(?:\.\d+)?/)
  if (match) return Number(match[0])

  const words = text.split(/\s+/).filter(Boolean)
  const units: Record<string, number> = {
    zero: 0,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    thirteen: 13,
    fourteen: 14,
    fifteen: 15,
    sixteen: 16,
    seventeen: 17,
    eighteen: 18,
    nineteen: 19,
    twenty: 20,
    thirty: 30,
    forty: 40,
    fifty: 50,
    sixty: 60,
    seventy: 70,
    eighty: 80,
    ninety: 90,
  }

  let result: number | undefined
  for (const word of words) {
    if (word in units) {
      result = (result ?? 0) + units[word]
    }
  }

  return result
}

export function getVoiceFeedback(command: VoiceCommand): string | null {
  switch (command.type) {
    case 'start_cooling':
      return null // We rely on the component (e.g. KioskHome) to speak "Cooling started for X" to avoid duplicate TTS delays
    case 'start_cooking':
    case 'start_reheating':
    case 'start_hot_hold':
      return null
    case 'stop_cooling':
      return command.item ? `Finishing cooling for ${command.item}` : 'Finishing cooling'
    case 'discard':
      return 'Discarding item'
    case 'log_fridge_temp':
      return command.fridgeNumber ? `Logging temperature for fridge ${command.fridgeNumber}` : 'Logging fridge temperature'
    default:
      return null
  }
}

export function parseVoiceCommand(transcript: string): VoiceCommand {
  const lower = normalizeVoiceText(transcript)
  const cleaned = lower
    .replace(/\s+/g, ' ')
    .replace(/^(?:hey|hi|okay|ok)\s+luma\s*/i, '')
    .replace(/^luma\s+/i, '')
    .replace(/^(?:please|can you|could you|would you)\s+/i, '')
    .trim()

  // ========================================
  // STRICT COMMAND WHITELIST
  // ========================================
  // Dynamically generate strict prefixes from the config file.
  // We check if the transcript starts with any of the configured phrases.
  // Optional preamble "hey luma" is handled by regex flexibility.

  if (cleaned.length < 2) {
    return { type: 'noise' }
  }

  const cookingPatternStr = COOKING_VARIANTS.join('|')
  const reheatingPatternStr = REHEATING_VARIANTS.join('|')
  const hotHoldPatternStr = HOT_HOLD_VARIANTS.join('|')

  // ========================================
  // HOT HOLD COMMANDS
  // ========================================
  const hotHoldStartMatch = cleaned.match(new RegExp(`^(?:start|begin)\\s+(?:${hotHoldPatternStr})\\s+(?:for\\s+)?(.+)$`, 'i'))
  if (hotHoldStartMatch) {
    return {
      type: 'start_hot_hold',
      item: toDisplayItem(hotHoldStartMatch[1]),
    }
  }

  const hotHoldCheckMatch = cleaned.match(/^(.+?)\s+(?:is\s+at|at)\s+(.+?)\s*(?:degrees?|celsius)?$/i)
  if (hotHoldCheckMatch && !/(cool|fridge|reheat|cook)/i.test(cleaned)) {
    const temperature = parseTemperature(hotHoldCheckMatch[2])
    if (typeof temperature === 'number') {
      return {
        type: 'log_hot_hold_check',
        item: hotHoldCheckMatch[1].trim().toLowerCase(),
        temperature,
      }
    }
  }

  // ========================================
  // COOKING / REHEATING COMMANDS
  // ========================================
  const cookingStartMatch = cleaned.match(new RegExp(`^(?:start|begin)\\s+(?:${cookingPatternStr})\\s+(.+)$`, 'i'))
  if (cookingStartMatch) {
    return {
      type: 'start_cooking',
      item: toDisplayItem(cookingStartMatch[1]),
    }
  }

  const cookingFinishMatch = cleaned.match(
    new RegExp(`^(?:finish|complete|done)\\s+(?:the\\s+)?(?:${cookingPatternStr})\\s+(.+?)(?:\\s+at\\s+(.+?))?\\s*(?:degrees?|celsius)?$`, 'i'),
  )
  if (cookingFinishMatch) {
    return {
      type: 'complete_cooking',
      item: toDisplayItem(cookingFinishMatch[1]),
      temperature: cookingFinishMatch[2] ? parseTemperature(cookingFinishMatch[2]) : undefined,
    }
  }

  const cookingCompleteMatch = cleaned.match(new RegExp(`^(?:${cookingPatternStr})\\s+(?:complete|completed|done)(?:\\s+at\\s+(.+?))?\\s*(?:degrees?|celsius)?$`, 'i'))
  if (cookingCompleteMatch) {
    return {
      type: 'complete_cooking',
      temperature: cookingCompleteMatch[1] ? parseTemperature(cookingCompleteMatch[1]) : undefined,
    }
  }

  const reheatingStartMatch = cleaned.match(new RegExp(`^(?:start\\s+)?(?:${reheatingPatternStr})\\s+(?:the\\s+)?(.+)$`, 'i'))
  if (reheatingStartMatch && !/(?:complete|completed|done)\b/i.test(cleaned)) {
    return {
      type: 'start_reheating',
      item: toDisplayItem(reheatingStartMatch[1].replace(/\s+(?:from\s+the\s+fridge.*|from\s+fridge.*)$/i, '')),
    }
  }

  const reheatingFinishMatch = cleaned.match(
    new RegExp(`^(?:finish|complete|done)\\s+(?:the\\s+)?(?:${reheatingPatternStr})\\s+(.+?)(?:\\s+at\\s+(.+?))?\\s*(?:degrees?|celsius)?$`, 'i'),
  )
  if (reheatingFinishMatch) {
    return {
      type: 'complete_reheating',
      item: toDisplayItem(reheatingFinishMatch[1]),
      temperature: reheatingFinishMatch[2] ? parseTemperature(reheatingFinishMatch[2]) : undefined,
    }
  }

  const reheatingCompleteMatch = cleaned.match(new RegExp(`^(?:${reheatingPatternStr})\\s+(?:complete|completed|done)(?:\\s+at\\s+(.+?))?\\s*(?:degrees?|celsius)?$`, 'i'))
  if (reheatingCompleteMatch) {
    return {
      type: 'complete_reheating',
      temperature: reheatingCompleteMatch[1] ? parseTemperature(reheatingCompleteMatch[1]) : undefined,
    }
  }

  // ========================================
  // START COOLING COMMANDS
  // ========================================
  const coolingPatternStr = COOLING_VARIANTS.join('|')
  const startPatterns = [
    new RegExp(`^(?:hey\\s+)?(?:luma\\s+)?(?:start|begin|new)\\s*(?:${coolingPatternStr})?\\s*(.*)$`, 'i'),
    new RegExp(`^(?:hey\\s+)?(?:luma\\s+)?(?:${coolingPatternStr})\\s*(.*)$`, 'i'),
    new RegExp(`^(?:please\\s+)?(?:can you\\s+)?(?:could you\\s+)?(?:would you\\s+)?(?:start|begin|new)\\s*(?:${coolingPatternStr})?\\s*(.*)$`, 'i'),
    new RegExp(`^(?:please\\s+)?(?:can you\\s+)?(?:could you\\s+)?(?:would you\\s+)?(?:${coolingPatternStr})\\s*(.*)$`, 'i'),
    // Aggressive fallback for words joined together by ASR (e.g. "startkulling")
    /^(?:hey\s+)?(?:luma\s+)?start[a-z]*\s+(.*)$/i,
  ]

  for (const pattern of startPatterns) {
    const match = cleaned.match(pattern)
    if (match) {
      const itemName = match[match.length - 1]?.trim()
      const normalizedItem = itemName?.toLowerCase()

      // Filter out "cooling" if captured as the item name erroneously
      if (!normalizedItem || COOLING_VARIANTS.includes(normalizedItem)) {
        continue;
      }

      // Check against specific start phrases to be sure (double check)
      // If it has explicit "start/begin/new", we trust it. Otherwise must be in VOICE_PHRASES.
      const hasExplicitStart = /^(?:hey\s+)?(?:luma\s+)?(?:start|begin|new|start[a-z]*)\b/i.test(cleaned)
      const isStartCommand = hasExplicitStart || VOICE_PHRASES.startCooling.some(p => cleaned.includes(p)) || COOLING_VARIANTS.some(v => cleaned.includes(v))
      if (!isStartCommand) continue

      const hasItem = Boolean(normalizedItem && normalizedItem.length > 1)
      const preset = hasItem
        ? FOOD_ITEM_PRESETS.find(
          (presetItem) =>
            presetItem.name.toLowerCase().includes(normalizedItem!) ||
            presetItem.id.includes(normalizedItem!) ||
            normalizedItem!.includes(presetItem.name.toLowerCase())
        )
        : undefined

      // Capitalize for display
      const displayItem = preset?.name || (hasItem ? (itemName!.charAt(0).toUpperCase() + itemName!.slice(1)) : undefined)

      return {
        type: 'start_cooling',
        item: displayItem,
      }
    }
  }

  // ========================================
  // STOP/CLOSE COOLING COMMANDS
  // ========================================
  const stopPatterns = [
    new RegExp(`^(?:hey\\s+)?(?:luma\\s+)?(?<action>stop|done|close|finish|finished|complete|pull|pulling|pulled)\\s*(?:${coolingPatternStr})?\\s*(?<item>.*)$`, 'i'),
    new RegExp(`^(?:hey\\s+)?(?:luma\\s+)?(?:${coolingPatternStr})\\s*(?:done|finished|complete|finish)\\s*(?<item>.*)$`, 'i'),
    /^(?:hey\s+)?(?:luma\s+)?(?<item>.*)\s+(?:done|finished|complete|finish)$/i,
    new RegExp(`^(?:please\\s+)?(?:can you\\s+)?(?:could you\\s+)?(?:would you\\s+)?(?<action>stop|done|close|finish|finished|complete|pull|pulling|pulled)\\s*(?:${coolingPatternStr})?\\s*(?<item>.*)$`, 'i'),
    /^(?:please\s+)?(?:can you\s+)?(?:could you\s+)?(?:would you\s+)?(?:move to fridge|in fridge)\s*(?<item>.*)$/i,
  ]

  for (const pattern of stopPatterns) {
    const match = cleaned.match(pattern)
    if (match) {
      const itemName = match.groups?.item?.trim()
      return { type: 'stop_cooling', item: itemName || undefined }
    }
  }

  // ========================================
  // DISCARD COMMANDS
  // ========================================
  const discardPatterns = [
    /^(?:hey\s+)?(?:luma\s+)?(?:discard|throw|bin|trash|waste)/i,
  ]

  for (const pattern of discardPatterns) {
    if (pattern.test(cleaned)) {
      return { type: 'discard' }
    }
  }

  // ========================================
  // FRIDGE TEMPERATURE COMMANDS
  // ========================================
  const fridgePatterns = [
    /^(?:hey\s+)?(?:luma\s+)?(?:log|record|check)\s+(?:fridge|refrigerator|freezer)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)/i,
    /^(?:hey\s+)?(?:luma\s+)?(?:fridge|refrigerator|freezer)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:temp|temperature)/i,
    /^(?:hey\s+)?(?:luma\s+)?(?:log|record|check)\s+(?:fridge|refrigerator|freezer)/i, // Generic capture
    /^(?:please\s+)?(?:can you\s+)?(?:could you\s+)?(?:would you\s+)?(?:log|record|check)\s+(?:fridge|refrigerator|freezer)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)/i,
    /^(?:please\s+)?(?:can you\s+)?(?:could you\s+)?(?:would you\s+)?(?:fridge|refrigerator|freezer)\s*(?:temp|temperature)?/i,
  ]

  for (const pattern of fridgePatterns) {
    const match = cleaned.match(pattern)
    if (match) {
      const numberWords: Record<string, string> = {
        'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5',
        'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10'
      }

      let fridgeNumber: string | undefined
      // Check capture groups safely
      if (match[1] && /^\d+$/.test(match[1])) {
        fridgeNumber = match[1]
      } else if (match[1] && numberWords[match[1]]) {
        fridgeNumber = numberWords[match[1]]
      } else if (match[2] && /^\d+$/.test(match[2])) {
        fridgeNumber = match[2]
      } else if (match[2] && numberWords[match[2]]) {
        fridgeNumber = numberWords[match[2]]
      }

      return { type: 'log_fridge_temp', fridgeNumber }
    }
  }

  // ========================================
  // RESILIENT FALLBACKS FOR NOISY KITCHENS
  // ========================================
  // If ASR drops function words, still infer core intent.
  if (/(finish|done|close|stop|completed?|in fridge)/i.test(cleaned) && /(cool|cooling)/i.test(cleaned)) {
    const itemGuess = cleaned
      .replace(/.*(?:cool|cooling)\s*/i, '')
      .trim()
    return { type: 'stop_cooling', item: itemGuess || undefined }
  }

  if (/(log|record|check)/i.test(cleaned) && /(fridge|refrigerator|freezer)/i.test(cleaned)) {
    const numberMatch = cleaned.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b/i)
    const numberWords: Record<string, string> = {
      'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5',
      'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10'
    }
    const raw = numberMatch?.[1]?.toLowerCase()
    const fridgeNumber = raw ? (numberWords[raw] ?? raw) : undefined
    return { type: 'log_fridge_temp', fridgeNumber }
  }

  // Fuzzy stop-intent fallback:
  // Handles transcripts like "pulling lasanha", "finiš kulin lasagna", etc.
  const hasStartIntent = hasApproxIntent(cleaned, START_INTENT_WORDS, 1)
  const hasStopIntent = hasApproxIntent(cleaned, STOP_INTENT_WORDS, 2)
  const hasCoolingSignal = hasApproxIntent(cleaned, COOLING_VARIANTS, 2)
  if (!hasStartIntent && hasStopIntent && (hasCoolingSignal || cleaned.split(/\s+/).length <= 4)) {
    const itemGuess = extractItemFromNoisyStop(cleaned)
    return { type: 'stop_cooling', item: itemGuess }
  }

  // ========================================
  // FALLBACK NOISE
  // ========================================
  // If we passed the whitelist check but failed specific parsing (rare), treat as noise.
  return { type: 'noise' }
}
