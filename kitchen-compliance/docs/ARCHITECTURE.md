# ChefKiosk Architecture & Design Documentation

## Executive Summary

ChefKiosk is a **kiosk-first, voice-enabled HACCP compliance system** focused on the cooling workflow for professional kitchens. Unlike traditional form-based compliance systems, ChefKiosk provides **real-time timer-based tracking** with proactive alerts - designed for the high-stress, fast-paced reality of commercial kitchens.

## Design Philosophy

### Why Timer-Based (Not Just Record-Based)?

**Problem with Record-Based Systems:**
- Staff "forget" to log until after the fact
- No proactive reminders during the cooling window
- Compliance becomes retroactive documentation, not real-time management
- No visibility into what's currently cooling

**ChefKiosk's Timer-Based Approach:**
- Start timer when hot food begins cooling
- Visual countdown with status progression (Green → Amber → Red)
- Voice alerts at 90-minute warning and 120-minute hard deadline
- Forces real-time action, not retroactive logging
- Dashboard shows ALL active cooling items at a glance

### Kiosk-First Design Principles

1. **5-Second Rule**: Any action must complete in under 5 seconds
2. **Gloved Hands**: Large touch targets (≥80px), minimal typing
3. **Noisy Environment**: Visual + audio feedback, high contrast
4. **Multi-Staff**: No login required for basic logging (shift-based auth)
5. **Offline-First**: Works without internet, syncs when available

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER                       │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Kiosk Mode   │  │ Manager Mode │  │ Reports Mode │       │
│  │ (Touch/Voice)│  │ (Desktop)    │  │ (Export/Print)│      │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
├─────────────────────────────────────────────────────────────┤
│                     INPUT METHODS                            │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │  Touch   │  │  Voice   │  │   OCR    │  │  Barcode │     │
│  │  (Tap)   │  │  (STT)   │  │  (Photo) │  │  (Scan)  │     │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
├─────────────────────────────────────────────────────────────┤
│                     BUSINESS LOGIC                           │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Cooling Workflow Engine                  │   │
│  │  • Timer Management (start/pause/close)              │   │
│  │  • Status Calculation (active/warning/overdue)       │   │
│  │  • Alert Generation (90min soft, 120min hard)        │   │
│  │  • Exception Handling (manager override)             │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Compliance Rules Engine                  │   │
│  │  • FSAI Safe Catering Pack rules                     │   │
│  │  • Temperature thresholds per category               │   │
│  │  • Audit trail generation                            │   │
│  │  • Report formatting (SC1-SC7)                       │   │
│  └──────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                     STATE MANAGEMENT                         │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Zustand Store (Persistent)               │   │
│  │  • coolingSessions[]  - Active and historical        │   │
│  │  • coolingEvents[]    - Audit log                    │   │
│  │  • alerts[]           - Pending notifications        │   │
│  │  • offlineQueue[]     - Pending sync operations      │   │
│  │  • currentSite        - Selected kitchen/location    │   │
│  └──────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                     DATA PERSISTENCE                         │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  LocalStorage │  │   IndexedDB  │  │   Supabase   │       │
│  │  (Fallback)   │  │   (Primary)  │  │   (Cloud)    │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                         ↓                    ↓               │
│              Offline-First Sync Strategy                    │
└─────────────────────────────────────────────────────────────┘
```

## Data Model

### Core Entities

```typescript
// Cooling Session - The primary workflow entity
interface CoolingSession {
  id: string;                    // UUID
  item_name: string;             // "Bolognese Sauce"
  item_category: ItemCategory;   // "sauces" | "soups" | "meats" | etc
  started_at: ISO8601;           // When cooling began
  soft_due_at: ISO8601;          // 90 minutes after start
  hard_due_at: ISO8601;          // 120 minutes after start
  closed_at?: ISO8601;           // When moved to fridge/discarded
  status: SessionStatus;         // "active" | "warning" | "overdue" | "closed" | "discarded"
  close_action?: CloseAction;    // "in_fridge" | "discarded" | "exception"
  exception_reason?: string;     // Manager-approved exception reason
  exception_approved_by?: string;// Manager name
  created_by?: string;           // Staff name (optional in kiosk mode)
  site_id: string;               // Kitchen/location identifier
  synced: boolean;               // Cloud sync status
}

// Cooling Event - Audit trail
interface CoolingEvent {
  id: string;
  session_id: string;
  site_id: string;
  event_type: EventType;         // "started" | "warning_triggered" | "overdue_triggered" | "closed" | "discarded" | "exception_added"
  timestamp: ISO8601;
  payload: Record<string, any>;  // Event-specific data
  synced: boolean;
}

// Alert - Notification queue
interface Alert {
  id: string;
  session_id: string;
  type: "warning" | "overdue";
  message: string;
  triggered_at: ISO8601;
  acknowledged: boolean;
  acknowledged_at?: ISO8601;
  acknowledged_by?: string;
}
```

### Food Item Categories (FSAI-Aligned)

```typescript
const FOOD_CATEGORIES = {
  sauces: {
    label: "Sauces",
    emoji: "🍝",
    examples: ["Bolognese", "Tomato", "Béchamel", "Curry", "Gravy"],
    defaultCoolingTarget: 5, // °C
  },
  soups_stews: {
    label: "Soups & Stews",
    emoji: "🍲",
    examples: ["Soup", "Stew", "Stock", "Chili"],
    defaultCoolingTarget: 5,
  },
  meats: {
    label: "Meats",
    emoji: "🥩",
    examples: ["Roast Beef", "Chicken", "Pork", "Lamb"],
    defaultCoolingTarget: 5,
  },
  rice_pasta: {
    label: "Rice & Pasta",
    emoji: "🍚",
    examples: ["Rice", "Pasta", "Risotto", "Noodles"],
    defaultCoolingTarget: 5,
  },
  vegetables: {
    label: "Vegetables",
    emoji: "🥗",
    examples: ["Cooked Veg", "Gratin", "Baked Potato"],
    defaultCoolingTarget: 5,
  },
  desserts: {
    label: "Desserts",
    emoji: "🍮",
    examples: ["Custard", "Rice Pudding", "Mousse"],
    defaultCoolingTarget: 5,
  },
};
```

## Cooling Workflow States

```
           ┌────────────────┐
           │    START       │
           │  (User taps)   │
           └───────┬────────┘
                   │
                   ▼
           ┌────────────────┐
           │    ACTIVE      │ ← Green status
           │  Timer: 0-90m  │   Normal operation
           └───────┬────────┘
                   │ 90 minutes
                   ▼
           ┌────────────────┐
           │    WARNING     │ ← Amber status
           │  Timer: 90-120m│   Voice: "Check cooling progress"
           └───────┬────────┘
                   │ 120 minutes
                   ▼
           ┌────────────────┐
           │    OVERDUE     │ ← Red status (pulsing)
           │  Timer: >120m  │   Voice: "ACTION REQUIRED NOW"
           └───────┬────────┘
                   │
         ┌─────────┴─────────┐
         │                   │
         ▼                   ▼
┌────────────────┐   ┌────────────────┐
│   IN_FRIDGE    │   │   DISCARDED    │
│  (Compliance)  │   │  (Exception)   │
└────────────────┘   └────────────────┘
```

## Kitchen Reality Scenarios

### Scenario 1: Busy Friday Night Service
- 10+ items cooling simultaneously
- Staff rotating between stations
- Noise levels high, visibility critical
- **Solution**: Compact card view, badge counts, voice alerts

### Scenario 2: Power Outage / WiFi Down
- Must continue logging without internet
- Data cannot be lost
- **Solution**: Offline-first with localStorage, sync queue

### Scenario 3: Health Inspector Visit
- Need immediate access to records
- Export to PDF/CSV for compliance
- **Solution**: History screen with filters, one-click export

### Scenario 4: Item Overdue - Manager Decision
- Chef forgot about cooling soup
- Manager must decide: fridge or discard?
- **Solution**: Exception workflow with manager PIN

### Scenario 5: Multiple Locations
- Restaurant group with 5 kitchens
- Central compliance dashboard
- **Solution**: Multi-tenant site_id, cloud sync

## Voice Command Grammar

```
START COMMANDS:
- "Start cooling [item]"      → Creates session with item name
- "Cooling [item]"            → Alias for above
- "[item] cooling"            → Flexible word order

CLOSE COMMANDS:
- "In fridge"                 → Close most recent session
- "Done"                      → Alias for above
- "Fridge"                    → Alias for above
- "[item] in fridge"          → Close specific item

DISCARD COMMANDS:
- "Discard"                   → Discard most recent session
- "Throw away"                → Alias
- "Bin it"                    → Alias
- "Discard [item]"            → Discard specific item

QUERY COMMANDS (Future):
- "What's cooling?"           → List active items
- "How long for [item]?"      → Time remaining
- "Status"                    → Summary of all items
```

## Security Model

### Kiosk Mode (Default)
- No login required
- Actions logged to session
- Device-based identification
- Suitable for shared kitchen tablet

### Staff Mode (Optional)
- PIN-based quick auth (4 digits)
- Name attached to records
- No password management

### Manager Mode
- Full authentication required
- Access to exception workflow
- Can override/edit records
- Export capabilities

## Integration Points

### Supabase (Cloud Backend)
```typescript
// Tables
cooling_sessions
cooling_events
sites
users (optional)

// Row Level Security
- Sessions filtered by site_id
- Manager role can view all
```

### Future Integrations
- **Temperature Probes**: Bluetooth LE sensors
- **Printers**: Receipt/label printing for compliance
- **POS Systems**: Sync with order data
- **ERP**: Export to inventory management

## Performance Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| First Paint | <1s | Instant kiosk startup |
| Time to Interactive | <2s | Ready for input immediately |
| Action Response | <200ms | Feel instantaneous |
| Timer Update | 1s | Real-time countdown |
| Offline Capability | 100% | Must work without internet |
| Data Sync | <5s | When connection restored |

## Testing Strategy

### Unit Tests
- Cooling status calculation
- Timer formatting
- Voice command parsing

### Integration Tests
- Supabase sync flow
- Offline queue processing
- Session lifecycle

### E2E Tests
- Full cooling workflow
- Voice command flow
- Export functionality

### Real-World Testing
- Kitchen environment (heat, humidity)
- Gloved hand interaction
- Noise level tolerance
- Multi-user simultaneous access

## Deployment Considerations

### Hardware
- **Recommended**: 10"+ tablet in rugged case
- **Mounting**: Wall-mounted, splash-proof enclosure
- **Power**: Always-on charging dock

### Environment
- **Temperature**: Kitchen ambient (may be hot)
- **Humidity**: Steam-resistant display
- **Cleaning**: Touchscreen compatible with sanitizer

### Network
- **WiFi**: 2.4GHz for better penetration
- **Fallback**: Works offline
- **Sync**: Background when available

---

*Document Version: 2.0*
*Last Updated: January 2026*
*Author: ChefKiosk Development Team*
