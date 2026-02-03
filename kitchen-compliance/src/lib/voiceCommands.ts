import type { VoiceCommand } from '@/types'
import { FOOD_ITEM_PRESETS } from '@/types'

export function parseVoiceCommand(transcript: string): VoiceCommand {
  const lower = transcript.toLowerCase().trim()

  // Start cooling commands
  const startPatterns = [
    /^(start|begin|new)\s*(cooling|cool)?\s*(.*)$/i,
    /^(cool|cooling)\s*(.*)$/i,
  ]

  for (const pattern of startPatterns) {
    const match = lower.match(pattern)
    if (match) {
      const itemName = match[match.length - 1]?.trim()
      const normalizedItem = itemName?.toLowerCase()
      const hasItem = Boolean(normalizedItem && normalizedItem.length > 1)
      const preset = hasItem
        ? FOOD_ITEM_PRESETS.find(
          (presetItem) =>
            presetItem.name.toLowerCase().includes(normalizedItem!) ||
            presetItem.id.includes(normalizedItem!) ||
            normalizedItem!.includes(presetItem.name.toLowerCase())
        )
        : undefined
      return {
        type: 'start_cooling',
        item: preset?.name || (hasItem ? itemName : undefined),
      }
    }
  }

  // Stop/Close cooling commands
  const stopPatterns = [
    /^(?<item>.*)\s+(?<action>done|finished|complete|finish)$/i,
    /^(?<action>stop|done|close|finish|finished|complete|in\s*fridge|fridge|move\s*to\s*fridge)\s*(cooling)?\s*(?<item>.*)$/i,
    /^(cooling)\s*(done|finished|complete|finish)\s*(?<item>.*)$/i,
    /^(?<action>then|done|finish)\s*(?<item>.*)$/i,
  ]

  for (const pattern of stopPatterns) {
    const match = lower.match(pattern)
    if (match) {
      const itemName = match.groups?.item?.trim()
      return { type: 'stop_cooling', item: itemName || undefined }
    }
  }

  // Discard commands
  const discardPatterns = [
    /^(discard|throw|bin|trash|waste)/i,
    /^(throw|toss)\s*(it)?\s*(away|out)?/i,
  ]

  for (const pattern of discardPatterns) {
    if (pattern.test(lower)) {
      return { type: 'discard' }
    }
  }

  // Fridge temperature commands
  // Support: "log fridge 1", "log fridge", "fridge temperature", etc.
  const fridgePatterns = [
    // "log fridge 1", "record fridge 2", "check fridge 3"
    /^(log|record|check)\s+(?:fridge|refrigerator|freezer)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)/i,
    // "fridge 1 temperature", "fridge 2 temp"
    /^(?:fridge|refrigerator|freezer)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:temp|temperature)/i,
    // Generic patterns without number
    /^(log|record|check)\s+(fridge|refrigerator|freezer)\s+(temp|temperature)/i,
    /^(fridge|refrigerator|freezer)\s+(temp|temperature)/i,
    /^(temp|temperature)\s+(fridge|refrigerator|freezer)/i,
  ]

  for (const pattern of fridgePatterns) {
    const match = lower.match(pattern)
    if (match) {
      // Check if a fridge number was specified
      const numberWords: Record<string, string> = {
        'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5',
        'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10'
      }
      
      let fridgeNumber: string | undefined
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

  return { type: 'unknown' }
}

export function getVoiceFeedback(command: VoiceCommand): string | null {
  switch (command.type) {
    case 'start_cooling':
      return `Starting cooling${command.item ? ` for ${command.item}` : ''}`
    case 'stop_cooling':
      return 'Okay, closing cooling now.'
    case 'discard':
      return 'Item discarded'
    case 'log_fridge_temp':
      return 'Opening fridge temperature logger'
    case 'unknown':
      return "Sorry, I didn't understand that"
    default:
      return null
  }
}
