# Voice Architecture Solution - Dual Provider Strategy

## Problem Statement

The OpenRouter audio transcription service (gpt-audio-mini) was hallucinating responses instead of transcribing audio during conversation flows:

- **Expected**: User says "1234" (staff code)
- **Actual**: API returns "Sure, please go ahead and play the audio you'd like me to transcribe."

This made conversation flows (asking for staff codes, temperatures, etc.) completely non-functional.

## Root Cause

OpenRouter's chat completion endpoint with audio input was treating the audio as a conversation turn rather than pure transcription. The model was responding conversationally instead of transcribing the spoken content.

## Solution: Dual Provider Strategy

We implemented a **dual provider approach** that uses different speech recognition engines based on context:

### 1. Wake Word Detection & Commands
**Provider**: OpenRouter/OpenAI Whisper (API-based)
- **Use Case**: Initial wake word detection ("Hey Luma") and command parsing
- **Why**: Better accuracy for longer phrases and complex commands
- **When**: Default mode when not in conversation

### 2. Conversation Flow Responses  
**Provider**: Browser Speech Recognition (Web Speech API)
- **Use Case**: Short responses during conversation (staff codes, temperatures, yes/no)
- **Why**: Real-time, reliable transcription without hallucination
- **When**: Automatically activated when `conversationMode={true}`

## Implementation Details

### Architecture Components

```typescript
// 1. Browser Speech Service
kitchen-compliance/src/services/browserSpeechService.ts
- Wrapper around Web Speech API
- Real-time transcription
- Supports interim results for immediate feedback

// 2. Browser Speech Hook
kitchen-compliance/src/hooks/useBrowserSpeech.ts
- React hook for browser speech
- Manages state and callbacks
- Language-aware configuration

// 3. Voice Button Enhancement
kitchen-compliance/src/components/voice/VoiceButton.tsx
- New prop: conversationMode?: boolean
- Automatically switches providers based on mode
- Transparent to parent components

// 4. Integration Point
kitchen-compliance/src/components/screens/KioskHome.tsx
- Detects conversation flow state
- Passes conversationMode={voiceCloseFlow.step !== null}
```

### Flow Diagram

```
User Action Flow:
├─ Wake Word ("Hey Luma")
│  └─ Provider: OpenRouter/OpenAI Whisper
│     └─ Accurate wake word detection
│
├─ Voice Command ("Finish cooling 1")
│  └─ Provider: OpenRouter/OpenAI Whisper
│     └─ Parse complex multi-word commands
│
└─ Conversation Response
   ├─ System: "What is your staff code?"
   ├─ User: "1234"
   └─ Provider: Browser Speech Recognition ✅
      └─ Direct transcription without hallucination
```

### Code Example

```typescript
// KioskHome.tsx - Automatic mode switching
<VoiceButton
  ref={voiceButtonRef}
  onCommand={handleVoiceCommand}
  onTranscript={voiceCloseFlow.handleTranscript}
  conversationMode={voiceCloseFlow.step !== null} // ← Activates browser speech
  wakeWordActive={isWakeWordActive}
/>

// VoiceButton.tsx - Provider selection logic
const useWhisper = !conversationMode && ( // ← Conversation mode forces browser
  (settings.voiceProvider === 'openai' && settings.openaiApiKey) ||
  (settings.voiceProvider === 'openrouter' && settings.openrouterApiKey)
)

const voice = useWhisper ? whisperVoice : browserVoice
```

## Benefits

### ✅ Reliability
- No more hallucinated responses
- Direct browser-to-text transcription for conversations
- Fallback to browser speech always available

### ✅ Performance
- Instant feedback with browser speech (no API latency)
- Interim results for real-time UX
- No API costs for conversation turns

### ✅ User Experience
- Seamless transition between providers
- Same UI/UX regardless of provider
- Auto-start listening after TTS completes

### ✅ Flexibility
- Users can still choose OpenRouter/OpenAI for commands
- Browser speech works offline
- No API key required for basic functionality

## Browser Compatibility

Web Speech API is supported in:
- ✅ Chrome/Edge (desktop & mobile)
- ✅ Safari (desktop & iOS)
- ⚠️ Firefox (limited/experimental)

For Firefox users, the system gracefully falls back to manual input.

## Recent Critical Fixes (2026-02-02)

### Fix 1: Wake Word Instant Response

**Problem**: 2-second delay between saying "Hey Luma" and the system starting to capture audio.

**Root Cause**: `useWakeWord.ts` had a `setTimeout()` that waited for potential "immediate commands" (e.g., "Hey Luma start cooling chicken") before triggering command mode.

**Solution**: Removed the timeout entirely. Now the flow is:
1. Wake word detected (interim) → beep plays IMMEDIATELY
2. Wake word confirmed (final) → STOP recognition INSTANTLY → trigger `onWakeWordDetected`
3. `KioskHome` handles callback → `VoiceButton.triggerVoice()` → start command recording

```typescript
// useWakeWord.ts - BEFORE (bad)
if (isFinal) {
  setTimeout(() => {
    pendingDetectionRef.current = true
    recognition.stop()
  }, IMMEDIATE_COMMAND_WINDOW) // Was 2000ms, then 300ms
}

// useWakeWord.ts - AFTER (good)
if (isFinal) {
  console.log('[WakeWord] Wake word only - IMMEDIATELY stopping')
  pendingDetectionRef.current = true
  isAbortingRef.current = true
  recognition.stop() // NO DELAY!
}
```

### Fix 2: Competing Speech Recognition Instances

**Problem**: Multiple Speech Recognition instances competing for the microphone, causing "sorry I didn't understand that" errors during conversation flows.

**Root Cause**: Three separate hooks all created Speech Recognition instances:
- `useVoiceRecognition` (browserCommandVoice)
- `useBrowserSpeech` (browserConversationVoice)  
- `useWhisperVoice` (API-based, but also manages state)

All were initialized and running simultaneously, and `useVoiceRecognition` was using GLOBAL state from `useAppStore`, causing state conflicts.

**Solution** (Two-Part):

**Part A**: Changed `useVoiceRecognition` to use LOCAL state:
```typescript
// useVoiceRecognition.ts - BEFORE (bad)
const { setIsListening } = useAppStore()  // Global state!

// useVoiceRecognition.ts - AFTER (good)
const [isListening, setIsListening] = useState(false)  // Local state
```

**Part B**: Added `disabled` parameter to prevent initialization in conversation mode:
```typescript
// useVoiceRecognition.ts
interface UseVoiceRecognitionOptions {
  disabled?: boolean // Don't initialize if disabled
}

useEffect(() => {
  if (!isSupported || disabled) return  // Skip initialization
  // ... create recognition
}, [isSupported, language, disabled])

// VoiceButton.tsx - Usage
const browserCommandVoice = useVoiceRecognition({
  disabled: conversationMode,  // ← Prevents competing instance!
  onCommand: !conversationMode ? handleCommand : undefined,
})
```

### Fix 3: Command Parsing Disabled in Conversation Mode

**Problem**: Even with browser speech active, commands were still being parsed and triggering "sorry I didn't understand" feedback.

**Solution**: Added guards to skip command parsing when in conversation mode:
```typescript
// VoiceButton.tsx
const handleCommand = useCallback((command: VoiceCommand) => {
  if (conversationMode) {
    console.log('[VoiceButton] Ignoring command in conversation mode')
    return  // ← Don't parse as command during conversation!
  }
  // ... handle command normally
}, [conversationMode])

// useWhisperVoice.ts - Also added disabled parameter
const whisperVoice = useWhisperVoice({
  disabled: conversationMode,
  onCommand: conversationMode ? undefined : handleCommand,
})
```

## Testing Checklist

- [x] Wake word detection works (OpenRouter/OpenAI)
- [x] Wake word triggers IMMEDIATELY (no 2s delay)
- [ ] Command parsing works ("finish cooling 1")
- [ ] Conversation flow activates browser speech
- [ ] NO "sorry I didn't understand" during conversation
- [ ] System asks "What is your staff code?"
- [ ] User can say staff number and it's transcribed
- [ ] System asks "What is the temperature?"
- [ ] User can say temperature and it's transcribed
- [ ] Session closes successfully with logged data
- [ ] Wake word resumes after conversation ends

## Troubleshooting

### Issue: Browser speech not starting
**Solution**: Check microphone permissions in browser settings

### Issue: Poor transcription accuracy
**Solution**: 
1. Ensure quiet environment
2. Speak clearly and at normal pace
3. Check microphone is working properly

### Issue: "Speech Recognition not supported"
**Solution**: Use Chrome/Safari, or enable browser microphone permissions

## Future Enhancements

### Potential Improvements
1. **Hybrid approach**: Use browser speech first, fallback to API if confidence < 70%
2. **Voice training**: Learn user's accent/speech patterns
3. **Multi-language**: Better support for Irish English vs US English
4. **Noise cancellation**: Better filtering for kitchen environments
5. **Custom wake words**: Train on specific restaurant terminology

### Monitoring
- Log transcription confidence scores
- Track hallucination incidents (if any remain)
- Measure user satisfaction with voice features
- A/B test different provider strategies

## References

- [Web Speech API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [OpenRouter Audio Models](https://openrouter.ai/docs/audio)
- [OpenAI Whisper API](https://platform.openai.com/docs/guides/speech-to-text)

---

**Last Updated**: 2026-02-02  
**Author**: Cline AI Assistant  
**Status**: ✅ Implementation Complete, Testing Pending
