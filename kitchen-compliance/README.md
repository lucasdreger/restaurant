# ChefKiosk - Kitchen Cooling Compliance System

<div align="center">
  <img src="https://img.shields.io/badge/FSAI-SC3%20Compliant-green?style=for-the-badge" alt="FSAI SC3 Compliant" />
  <img src="https://img.shields.io/badge/Voice-Enabled-purple?style=for-the-badge" alt="Voice Enabled" />
  <img src="https://img.shields.io/badge/Offline-First-blue?style=for-the-badge" alt="Offline First" />
  <img src="https://img.shields.io/badge/PWA-Ready-orange?style=for-the-badge" alt="PWA Ready" />
</div>

## Overview

**ChefKiosk** is a real-time cooling workflow management system designed for professional kitchens in Ireland. Unlike traditional record-based compliance systems, ChefKiosk provides **proactive timer-based tracking** with voice alerts - ensuring food safety compliance before problems occur.

### Key Differentiators

| Feature | Traditional Systems | ChefKiosk |
|---------|---------------------|-----------|
| **Workflow** | Log after the fact | Track in real-time |
| **Alerts** | None | 90min warning, 120min deadline |
| **Input** | Typing on forms | Tap presets or voice commands |
| **Visibility** | Check reports | Dashboard shows all active items |
| **Offline** | Requires internet | Works without WiFi |

## Features

### 🎯 Core Workflow
- **Start Cooling**: Tap a food preset or say "Start cooling [item]"
- **Live Timer**: Visual countdown with status progression (Green → Amber → Red)
- **Voice Alerts**: TTS notifications at warning and deadline thresholds
- **Quick Actions**: "In Fridge" or "Discard" with single tap or voice

### 🗣️ Voice Commands
| Command | Action |
|---------|--------|
| "Start cooling [item]" | Begin tracking a new item |
| "In fridge" / "Done" | Close the most recent session |
| "Discard" | Discard and log the most recent session |

### 📊 Compliance Features
- **FSAI SC3 Labeled**: Clear compliance references in UI
- **Audit Trail**: Every action timestamped and logged
- **History Screen**: Filter by date, status, export to CSV
- **Offline Sync**: Records preserved when internet unavailable

### 🎨 Kiosk-First Design
- **Dark Theme**: Optimized for kitchen glare
- **80px+ Touch Targets**: Works with gloved hands
- **5-Second Rule**: Any action completes in under 5 seconds
- **Badge Counts**: At-a-glance status in header

## Quick Start

### Prerequisites
- Node.js 18+
- npm or pnpm

### Installation

```bash
# Clone or navigate to project
cd kitchen-compliance

# Install dependencies
npm install

# Start development server
npm run dev
```

### Open in Browser
Navigate to `http://localhost:5173`

### Optional: Supabase Setup
Create a `.env` file:
```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Without Supabase configured, the app works fully offline with localStorage.

## Usage Guide

### Starting a Cooling Session

**Option 1: Tap Preset**
1. Tap "Start Cooling" button
2. Select food category (Sauces, Soups, Meats, etc.)
3. Tap the item name
4. Timer starts immediately

**Option 2: Voice Command**
1. Tap the microphone button
2. Say "Start cooling Bolognese" (or any item name)
3. Timer starts automatically

### During Cooling

The cooling card shows:
- **Item name** and start time
- **Live timer** counting up
- **Progress bar** filling toward 120-minute deadline
- **Status indicators**:
  - 🟢 Green (0-90 min): On track
  - 🟡 Amber (90-120 min): Warning - check progress
  - 🔴 Red (>120 min): Overdue - action required

### Closing a Session

**Option 1: Tap Button**
- Tap "In Fridge" when item reaches safe temperature
- Tap "Discard" if item must be thrown away

**Option 2: Voice Command**
- Say "In fridge" or "Done" to close most recent item
- Say "Discard" to discard most recent item

### Viewing History

1. Tap "History" in bottom bar
2. Filter by date range (Today, Week, Month, All)
3. Filter by status (Completed, Overdue, Discarded)
4. View statistics dashboard
5. Export to CSV for compliance records

## FSAI Compliance

ChefKiosk implements **FSAI Safe Catering Pack SC3** (Cook, Cool & Reheat) guidelines:

### Cooling Requirements
- Hot food must cool from **63°C to 8°C within 2 hours**
- If not achieved, food must be discarded or manager exception logged
- All records must be retained for inspection

### Timeline
| Time | Status | Action |
|------|--------|--------|
| 0-90 min | ✅ Active | Normal cooling |
| 90-120 min | ⚠️ Warning | Check temperature progress |
| >120 min | 🚨 Overdue | Move to fridge or discard |

### Audit Trail
Every session records:
- Start timestamp
- Close timestamp
- Close action (in_fridge / discarded / exception)
- Duration in minutes
- Sync status

## Technical Architecture

### Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS v4
- **State**: Zustand with localStorage persistence
- **Voice**: Web Speech API (free, no external AI)
- **Backend**: Supabase (optional)
- **PWA**: vite-plugin-pwa

### Project Structure
```
kitchen-compliance/
├── src/
│   ├── components/
│   │   ├── cooling/          # Cooling workflow components
│   │   │   ├── CoolingCard.tsx
│   │   │   └── StartCoolingModal.tsx
│   │   ├── layout/           # Layout components
│   │   │   └── StatusHeader.tsx
│   │   ├── screens/          # Screen components
│   │   │   ├── KioskHome.tsx
│   │   │   └── HistoryScreen.tsx
│   │   ├── ui/               # Reusable UI components
│   │   │   └── Button.tsx
│   │   └── voice/            # Voice components
│   │       └── VoiceButton.tsx
│   ├── hooks/                # Custom React hooks
│   │   └── useVoiceRecognition.ts
│   ├── lib/                  # Utilities
│   │   ├── supabase.ts
│   │   └── utils.ts
│   ├── services/             # Business logic
│   │   └── coolingService.ts
│   ├── store/                # State management
│   │   └── useAppStore.ts
│   └── types/                # TypeScript types
│       └── index.ts
├── docs/                     # Documentation
│   ├── ARCHITECTURE.md
│   └── GAP_ANALYSIS.md
└── README.md
```

### Key Files
| File | Purpose |
|------|---------|
| `coolingService.ts` | Cooling workflow business logic |
| `useAppStore.ts` | Zustand store with persistence |
| `useVoiceRecognition.ts` | Web Speech API hooks |
| `CoolingCard.tsx` | Timer display and actions |
| `KioskHome.tsx` | Main kiosk interface |

## Configuration

### Environment Variables
```env
# Supabase (optional)
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...

# Voice (future)
VITE_USE_WHISPER=false
VITE_OPENAI_API_KEY=sk-xxx
```

### Cooling Policy
Located in `src/lib/utils.ts`:
```typescript
export const COOLING_POLICY = {
  SOFT_LIMIT_MINUTES: 90,   // Warning threshold
  HARD_LIMIT_MINUTES: 120,  // Deadline threshold
}
```

## Deployment

### Build for Production
```bash
npm run build
```

### Deploy Options
- **Vercel**: Connect GitHub repo, auto-deploy
- **Netlify**: Drag-and-drop `dist` folder
- **Docker**: Use provided Dockerfile (coming soon)
- **PWA**: Install on tablet home screen

### Kiosk Hardware Recommendations
- **Tablet**: 10"+ screen, rugged case
- **Mounting**: Wall-mounted, splash-proof enclosure
- **Power**: Always-on charging dock
- **Network**: 2.4GHz WiFi for better penetration

## Roadmap

### Phase 1: Current ✅
- [x] Timer-based cooling workflow
- [x] Voice commands (Web Speech API)
- [x] Food item presets
- [x] History and export
- [x] Offline-first architecture
- [x] FSAI SC3 compliance labeling

### Phase 2: MVP
- [ ] Temperature input when closing
- [ ] Staff name tracking
- [ ] PDF export
- [ ] Settings page
- [ ] Manager PIN for exceptions

### Phase 3: Expansion
- [ ] Refrigeration monitoring (SC2)
- [ ] Hot holding tracking (SC4)
- [ ] OpenAI Whisper integration
- [ ] Multi-site management

### Phase 4: Enterprise
- [ ] User authentication
- [ ] Role-based access
- [ ] Automated reports
- [ ] Temperature probe integration

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit a pull request

## License

Proprietary - All rights reserved.

## Support

For questions or issues:
- Check `docs/` folder for detailed documentation
- Review `GAP_ANALYSIS.md` for feature comparisons
- Open an issue on GitHub

---

<div align="center">
  <p><strong>Built for Irish kitchens with ❤️</strong></p>
  <p><em>Compliant with FSAI Safe Catering Pack</em></p>
</div>
