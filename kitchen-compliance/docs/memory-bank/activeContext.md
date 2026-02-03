# Active Context

## What Was Done

### 2025-02-02: Fixed Demo Mode Cooling Session Status (v2)
**Problem**: When opening the demo restaurant, cooling events showed as "active" (blue) and took real time (2+ hours) to become "overdue" (red/critical). Sometimes no cooling sessions appeared at all if the database fetch failed.

**Root Cause (v1)**: Demo cooling sessions were fetched from Supabase with their original timestamps. The `getCoolingStatus()` function calculates status based on elapsed time since `started_at`, so sessions started as "active" and only became "overdue" after real time passed.

**Root Cause (v2)**: The v1 fix relied on sessions existing in the database. If the database fetch failed or returned empty, no demo data was shown.

**Solution (v2)**: Modified `App.tsx` in the `handleDemoStart()` function to create hardcoded demo cooling sessions directly in the frontend (not fetched from DB):
1. **Overdue session (RED)** - "Chicken Curry", started 150 min ago, status='overdue'
2. **Warning session (AMBER)** - "Beef Stew", started 100 min ago, status='warning'  
3. **Active session 1 (BLUE)** - "Tomato Sauce", started 15 min ago, status='active'
4. **Active session 2 (BLUE)** - "Bolognese", started 5 min ago, status='active'

All sessions have proper timestamps set backward in time so they immediately show the correct status when the demo loads.

**Files Modified**:
- `src/App.tsx` - Replaced DB fetch with hardcoded demo session creation using `createCoolingSession()`

### 2025-02-02: Optimized Voice Recognition Response Time
**Problem**: Voice recognition was slow - took a while to recognize speech and ask the next question in conversation flows.

**Root Cause**: Multiple delays in the voice pipeline:
- Silence detection: 800ms after user stops speaking
- TTS to listen delay: 500ms after question spoken before mic turns on
- Dashboard trigger delay: 300ms before starting to listen
- Wake word gap: 500ms between wake word and recording start
- Command silence threshold: 1500ms before processing

**Solution**: Reduced timing delays for faster response, then tuned for natural flow:
| Setting | Before | After (v1) | After (v2 - balanced) | After (v3 - adaptive) |
|---------|--------|------------|----------------------|----------------------|
| Silence detection - normal | 800ms | 400ms | 600ms | **700ms** |
| Silence detection - quick* | - | - | - | **400ms** |
| TTS to listen delay | 500ms | 200ms | **200ms** | **200ms** |
| Dashboard trigger delay | 300ms | 100ms | **100ms** | **100ms** |
| Wake word to command gap | 500ms | 200ms | **200ms** | **200ms** |
| Command silence threshold | 1500ms | 800ms | **900ms** | **1200ms** |
| Auto-stop - normal | 10000ms | 10000ms | **10000ms** | **10000ms** |
| Auto-stop - quick* | - | - | - | **5000ms** |

\* Quick mode: Used for staff code and temperature questions (fast answers)

**Adaptive Timing System**:
- After "ok luma": More time (700ms silence detection) to think about command
- Staff code/temperature questions: Less time (400ms silence detection) - just say the number
- Implemented via `quickResponseMode` prop through component chain

**Files Modified**:
- `src/lib/voiceConfig.ts` - Added COMMAND_SILENCE_THRESHOLD_QUICK constant
- `src/services/whisperService.ts` - Dynamic silence timeout based on quickResponseMode
- `src/hooks/useWhisperVoice.ts` - Accept and pass quickResponseMode
- `src/components/voice/VoiceButton.tsx` - Accept and pass quickResponseMode  
- `src/hooks/useVoiceCloseFlow.ts` - Expose `isQuickResponseStep` for staff/temp steps
- `src/components/screens/Dashboard.tsx` - Pass quickResponseMode to VoiceButton

### 2025-02-02: Fixed "Finish Cooling #2" Command Not Working
**Problem**: Saying "ok luma, finish cooling #2" or "finish cooling 2" didn't resolve to item #2.

**Root Cause**: The wake word detection was filtering out short commands. The `extractCommandAfterWakeWord` function required commands to be > 2 characters, and the immediate command detection required > 3 characters. This filtered out single digits like "2".

**Solution**: 
- Changed `extractCommandAfterWakeWord` to accept commands with length >= 1 (was > 2)
- Changed immediate command detection to accept commands with length >= 1 (was > 3)

**Files Modified**:
- `src/hooks/useWakeWord.ts` - Fixed command length checks in two places

## Current Challenges
- None - all requested features implemented

### 2025-02-03: Fixed Mobile OCR Processing Hanging Forever (v2 - OpenRouter Gemini Support)
**Problem**: When using the mobile camera to scan delivery notes, the app got stuck on "Processing delivery note" forever and never completed. User had OpenRouter with Gemini 2.0 configured, but it was still hanging.

**Root Cause (v1)**: Mobile camera images are very high resolution (several MB). Tesseract.js (the free OCR engine) was trying to process these huge images directly, which could take minutes or hang indefinitely on mobile devices.

**Root Cause (v2)**: Wrong OpenRouter model ID for Gemini 2.0 Flash. The model ID `'google/gemini-2.0-flash-001'` was invalid; OpenRouter requires `'google/gemini-2.0-flash-exp:free'`.

**Solution (v2)**:
1. **Fixed OpenRouter model ID** (`src/services/ocrService.ts`):
   - Changed `'google/gemini-2.0-flash'` mapping from `'google/gemini-2.0-flash-001'` to `'google/gemini-2.0-flash-exp:free'`

2. **Added 60-second timeouts for API calls** (`src/services/ocrService.ts`):
   - Added `AbortController` with 60-second timeout for OpenAI API calls
   - Added `AbortController` with 60-second timeout for OpenRouter API calls
   - Prevents infinite hanging on network issues

3. **Image compression before OCR** (from v1):
   - Compress images to max 2048x2048 pixels at 80% quality
   - Reduces file size from several MB to ~200-500KB

4. **Removed redundant "Take Photo" card** (`src/components/receipt/GoodsReceiptScreen.tsx`):
   - Mobile users now tap "Upload File(s)" which prompts for camera or gallery
   - Simpler UI, single button works for both desktop and mobile

**Files Modified**:
- `src/services/ocrService.ts` - Fixed model ID, added 60s timeouts for OpenAI/OpenRouter, kept 30s timeout for Tesseract
- `src/components/receipt/GoodsReceiptScreen.tsx` - Removed "Take Photo" card, kept only "Upload File(s)" button

### 2025-02-03: Optimized Mobile OCR - Skip Compression for Cloud APIs (v3)
**Problem**: Mobile camera scanning was still taking too long even with OpenRouter/Gemini 2.0 configured. The same API worked fast when tested directly in the browser.

**Root Cause**: The app was **compressing images before sending to the API**, even for cloud-based OCR services (OpenAI, OpenRouter). Cloud vision APIs are optimized to handle large images natively - the canvas-based compression was actually the bottleneck on mobile devices, not the API itself.

**Solution (v3)**: Modified `processPage()` in `GoodsReceiptScreen.tsx` to skip compression for cloud APIs:
- **Cloud APIs** (OpenAI, OpenRouter): Send original image directly - no compression
- **Local OCR** (Tesseract.js): Keep compression to prevent browser crashes on large images

```typescript
const isCloudApi = ocrProvider === 'openai' || ocrProvider === 'openrouter'
if (!isCloudApi) {
  // Only compress for Tesseract (local processing)
  const compressed = await compressImage(file, COMPRESSION_PRESETS.deliveryNote)
  fileToProcess = new File([compressed.blob], file.name, { type: compressed.blob.type })
} else {
  // Skip compression for cloud APIs - send original file directly
  console.log(`☁️ Using cloud API (${ocrProvider}) - skipping compression`)
}
```

**Result**: Mobile camera scanning with OpenRouter/Gemini should now be as fast as testing the API directly in the browser.

**Files Modified**:
- `src/components/receipt/GoodsReceiptScreen.tsx` - Added conditional compression logic in `processPage()`

### 2025-02-03: Fixed Mobile Menu Navigation (Full Screen Support)
**Problem**: Mobile menu wasn't showing the hamburger menu drawer when navigating to non-home screens (Goods Receipt, Receipt History, Settings, etc.). Users could only see the 4-item bottom nav and couldn't access the full menu.

**Root Cause**: `MainLayout` component only included `MobileNav` (bottom bar) but NOT `MobileHeader` with the hamburger menu that opens the full navigation drawer. The Dashboard screen had these components imported separately, but other screens using `MainLayout` didn't have the full mobile menu.

**Solution**: Updated `MainLayout` to include complete mobile navigation:
- Added `MobileHeader` with hamburger button that triggers the drawer
- Added `MobileMenuDrawer` with all 9 navigation items
- Added state management for `mobileMenuOpen`
- Added `pt-16` padding for mobile to account for header height

**Files Modified**:
- `src/components/layout/MainLayout.tsx` - Added MobileHeader, MobileMenuDrawer, and state management

### 2025-02-03: Mobile Menu, Voice Commands & Timing Improvements
**User Requests**:
1. Mobile menu missing Goods Receipt (GR) and Receipt History
2. Fridge voice commands should support specific fridge numbers
3. Voice timing delay too long

**Solutions Implemented**:

**1. Mobile Navigation Updated** (`src/components/layout/Sidebar.tsx`):
- Added "GR" (Goods Receipt) to mobile bottom nav
- Added "GR History" (Receipt History) to mobile bottom nav
- Reorganized: Home → GR → GR History → Settings

**2. Fridge Voice Commands with Numbers** (`src/lib/voiceCommands.ts`, `src/types/index.ts`, `src/components/screens/Dashboard.tsx`, `src/components/fridge/FridgeTempModal.tsx`):
- Updated `VoiceCommand` type to include `fridgeNumber?: string`
- Added regex patterns to recognize:
  - "log fridge 1", "record fridge 2", "check fridge 3"
  - "fridge one temperature", "fridge two temp" (word numbers)
  - "fridge 1 temp", "fridge 2 temperature"
- Dashboard now parses fridge number and preselects the correct fridge in the modal
- FridgeTempModal accepts `preselectedFridgeIndex` prop
- Voice feedback: "Opening fridge 1 temperature logger"

**3. Voice Timing Reduced** (`src/lib/voiceConfig.ts`):
- `COMMAND_SILENCE_THRESHOLD`: 1200ms → 700ms (500ms faster)
- `COMMAND_SILENCE_THRESHOLD_QUICK`: 500ms → 400ms
- `SILENCE_DURATION_FOR_STOP`: 1200ms → 700ms (500ms faster)
- System now responds ~500ms faster after user stops speaking

**Files Modified**:
- `src/components/layout/Sidebar.tsx` - Mobile nav items
- `src/lib/voiceConfig.ts` - Timing reductions
- `src/lib/voiceCommands.ts` - Fridge number parsing
- `src/types/index.ts` - VoiceCommand type updated
- `src/components/screens/Dashboard.tsx` - Handle fridge number in voice commands
- `src/components/fridge/FridgeTempModal.tsx` - Accept preselected fridge index

### 2025-02-03: Fixed Cooling Sessions Not Persisting (LocalStorage Preservation)
**Problem**: User reported that cooling logs were not being persisted. When refreshing the page, created cooling sessions would disappear.

**Root Cause**: In `App.tsx`, when the site loaded, it would fetch cooling sessions from the database and **always** call `setCoolingSessions(sessions)` - even when the DB returned an empty array (due to RLS errors, network issues, etc.). This overwrote the localStorage-persisted sessions with an empty array.

**Solution**: Modified the `loadStaffAndCooling` function in `App.tsx` to:
1. Only overwrite localStorage if the database returned valid data (`sessions.length > 0`)
2. If DB returns empty, preserve existing localStorage sessions
3. Added console logging to track where sessions are loaded from

**Files Modified**:
- `src/App.tsx` - Added check to prevent empty DB results from wiping localStorage sessions

### 2025-02-03: Fixed Demo Cooling Sessions Stale Timestamp Issue
**Problem**: When opening the demo restaurant, cooling sessions would sometimes not show the correct status (overdue/warning/active). The red markers for overdue items would take time to appear or not appear at all because the timestamps were stale from previous demo runs.

**Root Cause**: Demo cooling sessions were persisted to the database with fixed timestamps (e.g., "started 150 minutes ago"). When demo mode started again days later, those old sessions were fetched from the database. Since the status is calculated dynamically based on elapsed time since `started_at`, the timestamps were now days old instead of minutes old, causing incorrect status calculations.

**Solution**: Modified `App.tsx` in the `handleDemoStart()` function to:
1. **Delete all existing cooling sessions** for the demo site before creating new ones
2. **Create fresh demo sessions** with current-relative timestamps every time demo mode starts
3. **Sync the new sessions** to the database for persistence during the demo session

This ensures the demo always shows the intended state:
- **Overdue (RED)** - "Chicken Curry", started 150 min ago → immediately shows red
- **Warning (AMBER)** - "Beef Stew", started 100 min ago → immediately shows amber  
- **Active 1 (BLUE)** - "Tomato Sauce", started 15 min ago → shows blue
- **Active 2 (BLUE)** - "Bolognese", started 5 min ago → shows blue

**Files Modified**:
- `src/App.tsx` - Added deletion of old sessions before creating fresh demo sessions with current timestamps

### 2025-02-02: Implemented PDF Export for Goods Receipt Reports
**Problem**: The "Gerar Relatório PDF" button showed "Funcionalidade de Relatório em desenvolvimento" toast instead of generating actual PDFs.

**Solution**: Implemented comprehensive PDF report generation using jsPDF and jspdf-autotable:

**Features**:
- **Detailed Report**: Multi-page report with cover page + individual receipt pages
  - Cover: Summary stats (total receipts, compliant/non-compliant counts, items, images)
  - Per receipt: Full details, items table with temperature compliance, image references
  - Audit-safe formatting with timestamps and site info
- **Summary Report**: Single-page landscape overview with all receipts in table format
  - Quick overview for management review
  - Color-coded compliance status

**UI Components**:
- "Relatório PDF" button in header (replaced the non-functional button)
- Report type selection dialog (detailed vs summary)
- Filter display showing what's included
- Loading states with spinner
- Individual PDF download from receipt detail modal

**Files Created**:
- `src/services/pdfReportService.ts` - PDF generation logic with jsPDF
- `src/components/ui/Card.tsx` - Card UI component
- `src/components/ui/Separator.tsx` - Separator UI component  
- `src/components/ui/Select.tsx` - Select dropdown component
- `src/components/ui/Dialog.tsx` - Dialog/modal component
- `src/components/ui/ScrollArea.tsx` - Scrollable area component
- `src/components/ui/Switch.tsx` - Toggle switch component

**Files Modified**:
- `src/components/receipt/ReceiptHistoryScreen.tsx` - Complete rewrite with:
  - Removed react-router-dom dependency (uses onNavigate prop)
  - Fixed TypeScript type imports
  - Added ReportDialog component
  - Added PDF generation handlers
  - Improved UI with loading states

**Dependencies Added**:
- `@radix-ui/react-separator`
- `@radix-ui/react-dialog`
- `@radix-ui/react-scroll-area`
- `@radix-ui/react-switch`

### 2025-02-02: Fixed GitHub Actions TypeScript Build Errors
**Problem**: GitHub Actions build was failing due to TypeScript compilation errors preventing deployment to GitHub Pages.

**Errors Fixed**:
1. **Type imports** - `voiceStateMachine.ts`: Changed `import { ConversationFlow }` to `import type { ConversationFlow }` for verbatimModuleSyntax compliance
2. **Unused imports** - Removed:
   - `useAppStore` from `useVoiceRecognition.ts`
   - `VOICE_TIMING` from `useWakeWord.ts`
   - `FileText` from `KioskHome.tsx`
3. **Unused props** - Removed `onNavigateToReports` from `KioskHomeProps` interface
4. **Unused method** - Removed `transcribeWithWhisperEndpoint()` from `whisperService.ts` (was commented as unused)
5. **Unused parameters** - Removed `ctx` parameter from `logFridgeTempFlow` validation function in `conversationFlows.ts`

**Build Result**: ✅ TypeScript compilation successful, Vite production build completed

**Files Modified**:
- `src/lib/voiceStateMachine.ts` - Fixed type imports
- `src/hooks/useVoiceRecognition.ts` - Removed unused import
- `src/hooks/useWakeWord.ts` - Removed unused import
- `src/components/screens/KioskHome.tsx` - Removed unused import and prop
- `src/services/whisperService.ts` - Removed unused private method
- `src/lib/conversationFlows.ts` - Removed unused parameter

## Next Steps
- Monitor voice recognition accuracy with reduced silence thresholds
- Test PDF generation with large datasets (many receipts)
- Consider adding image embedding in PDFs (currently referenced in tables only)
- Add date range filters to report generation
- Test fridge temperature voice command in demo mode
- Commit changes and push to trigger GitHub Actions deployment

### 2025-02-03: Translated All PDF Reports and UI to English
**Problem**: PDF reports and some UI elements were displaying Portuguese text instead of English.

**Files Translated**:
- `src/components/receipt/ReceiptHistoryScreen.tsx` - All Portuguese UI text translated to English
  - "Gerando relatório PDF" → "Generating PDF report"
  - "Estabelecimento" → "Establishment"
  - "Limpar Filtros" → "Clear Filters"
  - And all other Portuguese strings

- `src/services/pdfReportService.ts` - Complete translation of PDF content
  - "Relatório de Recebimentos" → "Goods Receipt Report"
  - "Página X de Y" → "Page X of Y"
  - "Fornecedor" → "Supplier"
  - "Data de Recebimento" → "Received Date"
  - "Conformidade" → "Compliance"
  - "Não Conforme" → "Non-Compliant"
  - All status labels (Concluído, Rascunho, Sinalizado, Anulado) → English
  - All category labels (Resfriado, Congelado, etc.) → English
  - Changed locale from 'pt-BR' to 'en-IE' for date formatting

- `src/services/complianceService.ts` - Translated comments
  - All Portuguese comments and JSDoc translated to English

**Result**: All PDF reports and UI are now fully in English.

### 2025-02-03: Fixed UI Visibility Issues and Added Refresh Button
**Problems Fixed**:
1. **Delivery summary white text** - Changed from `bg-theme-ghost` with `text-theme-muted` to `bg-theme-secondary` with `text-theme-primary` for proper contrast
2. **PDF filename in Portuguese** - Changed from `relatorio_recebimentos_*.pdf` to `goods_receipt_report_*.pdf`
3. **Missing refresh button** - Added Refresh button to Receipt History header to fetch new receipts after creating one
4. **Report type options invisible** - Fixed styling with explicit `bg-white dark:bg-zinc-800` and `text-zinc-900 dark:text-zinc-100` classes
5. **"All statuses" filter invisible** - Select component now uses proper themed text colors

**Files Modified**:
- `src/components/receipt/GoodsReceiptScreen.tsx` - Fixed delivery summary visibility
- `src/components/receipt/ReceiptHistoryScreen.tsx` - Fixed PDF filename, added refresh button, fixed report dialog styling

### 2025-02-02: Added Voice Command for Fridge Temperature Logging
**Implementation**: Voice-activated fridge temperature logging

**Voice Commands Supported**:
- "Hey Luma, log fridge temperature"
- "Hey Luma, fridge temperature"
- "Hey Luma, temperature fridge"

**Files Modified**:
- `src/lib/voiceCommands.ts` - Added regex patterns for fridge temp commands
- `src/types/index.ts` - Added `log_fridge_temp` to VoiceCommand type
- `src/lib/conversationFlows.ts` - Created `logFridgeTempFlow` conversation flow
- `src/components/screens/Dashboard.tsx` - Added handler to open FridgeTempModal
- `src/components/layout/Sidebar.tsx` - Added "Receipt History" navigation menu
- `src/App.tsx` - Added route for ReceiptHistoryScreen

**Flow**:
1. User says "Hey Luma, log fridge temperature"
2. System opens FridgeTempModal
3. User selects fridge, enters staff code, temperature
4. Data saved to `fridge_temp_logs` table with compliance check

**Data Persisted**:
- site_id, fridge_id, temperature
- recorded_by (staff ID), recorded_by_name
- is_compliant (auto-calculated: true if 0-5°C)
- created_at timestamp
