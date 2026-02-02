# Active Context

## What Was Done

### 2025-02-02: Fixed Demo Mode Cooling Session Status
**Problem**: When opening the demo restaurant, cooling events showed as "active" (blue) and took real time (2+ hours) to become "overdue" (red/critical).

**Root Cause**: Demo cooling sessions were fetched from Supabase with their original timestamps. The `getCoolingStatus()` function calculates status based on elapsed time since `started_at`, so sessions started as "active" and only became "overdue" after real time passed.

**Solution**: Modified `App.tsx` in the `handleDemoStart()` function to adjust timestamps after fetching sessions:
- Index 0: Set to overdue (started 150 min ago → red marker immediately)
- Index 1: Set to warning (started 100 min ago → amber marker immediately)
- Index 2+: Set to active (started recently → blue marker)

**Files Modified**:
- `src/App.tsx` - Added demo session timestamp modification logic

### 2025-02-02: Optimized Voice Recognition Response Time
**Problem**: Voice recognition was slow - took a while to recognize speech and ask the next question in conversation flows.

**Root Cause**: Multiple delays in the voice pipeline:
- Silence detection: 800ms after user stops speaking
- TTS to listen delay: 500ms after question spoken before mic turns on
- Dashboard trigger delay: 300ms before starting to listen
- Wake word gap: 500ms between wake word and recording start
- Command silence threshold: 1500ms before processing

**Solution**: Reduced all timing delays for faster response:
| Setting | Before | After |
|---------|--------|-------|
| Silence detection (whisperService.ts) | 800ms | 400ms |
| TTS to listen delay (voiceConfig.ts) | 500ms | 200ms |
| Dashboard trigger delay (Dashboard.tsx) | 300ms | 100ms |
| Wake word to command gap | 500ms | 200ms |
| Command silence threshold | 1500ms | 800ms |
| Silence duration for stop | 2000ms | 1200ms |

**Files Modified**:
- `src/lib/voiceConfig.ts` - Reduced all VOICE_TIMING constants
- `src/services/whisperService.ts` - Reduced silence detection to 400ms
- `src/components/screens/Dashboard.tsx` - Reduced mic trigger delay to 100ms

## Current Challenges
- None - both cooling demo and voice response are now optimized

## Next Steps
- Monitor voice recognition accuracy with reduced silence thresholds
- Consider further optimizations if needed (e.g., parallel processing)
