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
    case 'unknown':
      return "Sorry, I didn't understand that"
    default:
      return null
  }
}