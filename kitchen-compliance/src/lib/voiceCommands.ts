import type { VoiceCommand } from '@/types'
import { FOOD_ITEM_PRESETS } from '@/types'
// COMMANDS ARE NOW CONFIGURED IN: src/config/voicePhrases.ts
import { VOICE_PHRASES } from '@/config/voicePhrases'

export function getVoiceFeedback(command: VoiceCommand): string | null {
  switch (command.type) {
    case 'start_cooling':
      return command.item ? `Starting cooling for ${command.item}` : 'Starting cooling'
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
  const lower = transcript.toLowerCase().trim()

  // ========================================
  // STRICT COMMAND WHITELIST
  // ========================================
  // Dynamically generate strict prefixes from the config file.
  // We check if the transcript starts with any of the configured phrases.
  // Optional preamble "hey luma" is handled by regex flexibility.

  const allPhrases = [
    ...VOICE_PHRASES.startCooling,
    ...VOICE_PHRASES.stopCooling,
    ...VOICE_PHRASES.logFridge,
    ...VOICE_PHRASES.discard
  ]

  // Escape special regex characters in phrases just in case
  const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  // Create a giant regex OR pattern from all allowed phrases
  // Matches: optional "hey luma" + any allowable phrase
  const phrasePattern = allPhrases.map(p => escapeRegExp(p)).join('|')
  const strictRegex = new RegExp(`^(?:hey\\s+)?(?:luma\\s+)?(?:${phrasePattern})`, 'i')

  if (!strictRegex.test(lower)) {
    // STRICT MODE: If it doesn't match any allowed phrase prefix, classify as noise.
    return { type: 'noise' }
  }

  // ========================================
  // START COOLING COMMANDS
  // ========================================
  // We still need specific patterns to extract the ITEM name
  const startPatterns = [
    /^(?:hey\s+)?(?:luma\s+)?(?:start|begin|new)\s*(?:cooling|cool)?\s*(.*)$/i,
    /^(?:hey\s+)?(?:luma\s+)?(?:cool|cooling)\s*(.*)$/i,
  ]

  for (const pattern of startPatterns) {
    const match = lower.match(pattern)
    if (match) {
      const itemName = match[match.length - 1]?.trim()
      const normalizedItem = itemName?.toLowerCase()

      // Filter out "cooling" if captured as the item name erroneously
      if (normalizedItem === 'cooling' || !normalizedItem) {
        continue;
      }

      // Check against specific start phrases to be sure (double check)
      // This helps avoid misinterpreting "cooling done" as "cooling [done]" item
      const isStartCommand = VOICE_PHRASES.startCooling.some(p => lower.includes(p))
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
    /^(?:hey\s+)?(?:luma\s+)?(?<action>stop|done|close|finish|finished|complete)\s*(?:cooling)?\s*(?<item>.*)$/i,
    /^(?:hey\s+)?(?:luma\s+)?(?:cooling)\s*(?:done|finished|complete|finish)\s*(?<item>.*)$/i,
    /^(?:hey\s+)?(?:luma\s+)?(?<item>.*)\s+(?:done|finished|complete|finish)$/i,
  ]

  for (const pattern of stopPatterns) {
    const match = lower.match(pattern)
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
    if (pattern.test(lower)) {
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
  ]

  for (const pattern of fridgePatterns) {
    const match = lower.match(pattern)
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
  // FALLBACK NOISE
  // ========================================
  // If we passed the whitelist check but failed specific parsing (rare), treat as noise.
  return { type: 'noise' }
}
