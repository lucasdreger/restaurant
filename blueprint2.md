# Blueprint Addendum – Parts 55+ (POC Cooling, Voice, Monetisation, Gateway)

This addendum continues the main blueprint from **Part 55 onwards** and focuses on:
- A realistic **POC** for an always-rush kitchen
- **Voice-first** cooling workflow
- Where AI/chat belongs (and where it doesn’t)
- Monetisation strategy for Irish customers of different sizes
- A pragmatic Zigbee gateway strategy (when hardware becomes worth it)
- A **functional app description** and a ready-to-use **vibe-coding AI build brief**

---

## PART 55 — Vibe Coding AI Instructions (Full Platform Build Agent Prompt)

### Product Goal
Build a tablet-first PWA + backend for an Irish restaurant compliance platform that:
- Digitises key Safe Catering Pack workflows
- Minimises kitchen data entry (one-tap, QR)
- Produces inspection-grade exports
- Adds automation (hardware) only when it truly reduces risk and workload

### UX Non-Negotiables
- No typing in kitchen flows
- <10 seconds per task in kitchen
- Offline-first (kiosk must not die when internet drops)
- Kiosk mode supported
- Exceptions and overrides are manager-only

### Core Modules (Full Platform)
1. Multi-tenant core (tenant/site isolation)
2. Kiosk screens (K-01..K-08)
3. Manager screens (M-01..M-06)
4. Compliance log engine (append-only)
5. Incident engine (thresholds → alerts → closeout)
6. Hardware management UI
7. Gateway ingestion API (later)
8. Export generator (inspector pack)
9. Recipes + allergens engine

### Implementation Constraints
- Use Postgres with strict tenant isolation
- Append-only logs for compliance evidence
- Idempotent ingestion and event processing
- Offline sync with conflict handling

### Deliverables
- Architecture diagram (text)
- API endpoints list
- Database schema/migrations
- PWA routes and components
- Test plan

---

## PART 56 — Critical POC Definition: Cooling (Always-Rush Kitchen)

### Why Cooling First
Cooling cooked food for later use is a frequent failure mode. The POC must:
- Prevent “danger-zone” time overruns
- Create inspection-grade evidence with near-zero effort

### POC Success Metrics
- Start interaction: <5 seconds
- Close interaction: <5 seconds
- % of cool-downs closed within policy window
- Missed closeouts trend down

### POC Scope (Build First)
- Kiosk mode screens:
  - K-01 Home
  - K-02 Cool Start
  - K-03 Cool Close / Critical decision
- Timer engine (90/120 minute reminders)
- Notifications:
  - kiosk alerts
  - designated phone alerts
- Export: “Cooling Evidence Report”
- Minimal admin:
  - site name
  - alert recipients
  - optional kiosk PIN

### POC Exclusions (Deliberate)
- Full HACCP plan generation
- IoT fridge/freezer telemetry
- Full allergen engine

The POC proves a single workflow is loved, then expands.

---

## PART 57 — Voice-First Interaction (What Works in Rush)

### Voice Strategy: Commands, Not Conversation
Voice is used for:
- Start cooling
- Close cooling

Voice is NOT used for:
- Free-form advice
- Legal explanations during service

### Voice UX Pattern
- Push-to-talk (big button on kiosk)
- Short command set
- Immediate audible confirmation

Example commands:
- “Start cooling: bolognese sauce”
- “Cooling done”
- “Discard it” (manager-only)

### Evidence Captured (With Voice)
- Start timestamp
- Close timestamp
- Item label (optional)
- Actor (device identity + optional PIN)

---

## PART 58 — Where AI & Chat Fit (Without Legal Risk)

### AI in the POC (Allowed)
1. Speech → structured intent (command parsing)
2. Item label normalisation (“bol” → “bolognese”)

### AI NOT in the POC
- “What should I do legally?” responses
- Open-ended kitchen chat

### Chat/AI Later (Manager Context Only)
Later, add chat for manager workflows:
- “What’s the corrective action for overdue cooling?”
- “Show last 30 days incidents”

Rules for future chat:
- Must be source-grounded
- Must be policy-aware (per restaurant)
- Must log the guidance shown

---

## PART 59 — TTS/ASR Technical Options (Pragmatic)

### Constraints
- Noise
- Privacy
- Low latency
- Must work on iPad/Android

### Option 1: Browser Speech APIs (Fastest Prototype)
- Pros: zero install, PWA friendly
- Cons: accuracy varies by device/browser, noise sensitivity

Use: POC only.

### Option 2: Cloud ASR + TTS (Production Candidate)
- Pros: better accuracy and tuning
- Cons: recurring cost, depends on connectivity

Mitigation:
- one-tap fallback
- local buffering and delayed sync

### Option 3: On-Device ASR (Later)
- Pros: privacy, offline
- Cons: high complexity and platform variance

Recommendation: start Option 1 for POC, plan Option 2 for production.

---

## PART 60 — Monetisation Strategy (Ireland, Different Customer Sizes)

### Core Market Reality
Small restaurants will not pay for “features”. They pay for:
- Less risk
- Less stress
- Less chance of being blamed

### Segments

#### Segment S1 — Micro (Owner = chef = manager)
- Very low admin tolerance
- Price sensitive
- Higher churn

Offer:
- “Cooling Safety” plan (single workflow)
- Low monthly price
- No hardware requirement

Upsells:
- inspection export add-on
- additional workflows (reheat, hot holding)

#### Segment S2 — Independent (1–2 locations)
- Will pay for peace of mind

Offer:
- “Compliance Core” plan
- cooling + logs + exports
- optional sensor bundle later

#### Segment S3 — Multi-site chain
- Budget and need for standardisation

Offer:
- Annual contract
- central dashboard
- standard hardware kit
- SLA

### Packaging Rule
Sell outcomes:
- “No scrambling on inspection day”
- “Incidents handled with proof”

---

## PART 61 — Hardware Cost Reality & Strategy

### Blunt Truth
Restaurants won’t pay a hardware bill to “save a few clicks”.
Hardware must be positioned as:
- risk reduction
- evidence quality
- insurance-like value

### Practical Strategy

**Strategy 1 (Recommended): start without Zigbee**
- POC uses voice + timers only
- Hardware comes after value is proven

**Strategy 2: minimal sensor bundle (later)**
- only 2 sensors: fridge + freezer
- simple pricing: financed monthly

**Strategy 3: BYOD allowed, but certified**
- only approved models supported

Pricing psychology:
- “€120 upfront” feels expensive
- “€9/month hardware included” feels manageable

---

## PART 62 — Go-To-Market (Ireland)

### Positioning
You are not generic restaurant management.
You are:
- “Cooling + compliance, built for Irish inspections”

### Channels
- Direct outreach to independents
- Partnerships:
  - food safety consultants
  - training providers
  - equipment maintenance companies

### Sales Motion
- demo in 5 minutes
- show one thing: cooling prevention + export

---

## PART 63 — Investment Reality

### Phase 1: Software-only POC
Costs are mainly:
- hosting
- auth/db
- speech/AI API (if cloud)

### Phase 2: Compliance core
Costs rise for:
- export quality
- multi-tenant hardening
- support

### Phase 3: Hardware + fleet management
The real jump:
- provisioning
- OTA updates
- logistics and replacements

Rule:
Do not invest heavily in hardware until you see repeatable adoption.

---

## PART 64 — Functional App Description (POC: Cooling Safety)

### What the app is
A **tablet-first PWA** used in a kitchen that is always in rush. The app exists to:
- Start and track cooling of cooked items intended for later use
- Remind at 90 minutes
- Force a decision at 120 minutes
- Record minimal audit evidence (start/stop timestamps and outcome)
- Generate a simple “Cooling Evidence Report”

### What the app is not (in the POC)
- Not a full HACCP platform
- Not POS
- Not inventory
- Not a chatbot for legal advice

### Users
- Primary: chef/staff using a wall tablet (kiosk)
- Secondary: manager receiving alerts and closing exceptions

### Inputs
- Voice commands (push-to-talk): start/stop
- One-tap buttons as fallback
- Optional: item label selection (preset)

### Outputs
- Timers per cooling item
- Alerts (kiosk + phone)
- Append-only event log
- Export report for a date range

### Core Business Rules (POC)
- Every cooling event has:
  - started_at
  - due_soft_at (start + 90 min)
  - due_hard_at (start + 120 min)
  - status: active / closed / overdue / discarded
- At soft due: notify
- At hard due: show critical screen; require close action
- Only manager can add “exception reason”

---

## PART 65 — Vibe Coding AI Build Brief (POC Implementation)

Copy/paste this to your coding AI.

### Build Objective
Implement the “Cooling Safety” PWA + backend.

### Frontend
- PWA, tablet-first
- Kiosk Mode:
  - K-01 Today (list active coolings + big action buttons)
  - K-02 Start Cooling (voice start + one-tap presets)
  - K-03 Close Cooling (voice close + forced decision when overdue)
- Minimal Manager Mode:
  - M-01 Alerts and Closeouts
  - M-02 Cooling Evidence Report export

### UX Requirements
- Start/close in <5 seconds
- No typing required in kitchen
- Works offline; sync later
- Push-to-talk voice (do not listen continuously)
- Big touch targets, readable at distance

### Backend
- Postgres
- Append-only events table
- Derived “cooling_sessions” view/table for current state
- Idempotent write API (safe retries)

### APIs
- POST /events  (append-only)
- GET /cooling/active
- POST /cooling/{id}/close
- GET /reports/cooling?from=&to=

### Offline/Synchronisation
- Local queue of events in IndexedDB
- Background sync when online
- Conflict rule: append-only events win; state is derived

### Alerts
- Local kiosk alerts at 90/120 minutes
- Optional: send alert to manager phone via email/SMS provider later

### Testing
- Simulate 20 simultaneous cooling sessions
- Simulate offline for 2 hours then sync
- Verify overdue forced decision triggers

### Deliverables
- Database schema
- API implementation
- PWA routes and components
- Minimal deployment instructions

---

## PART 66 — Gateway Add-On (Later: When Hardware Is Worth It)

When expanding beyond POC:
- Add Zigbee gateway option
- Focus on fridge/freezer telemetry
- Do not force hardware at first

Hardware path:
- Minimal Linux gateway + Zigbee2MQTT + MQTT + gateway-agent
- QR provisioning
- Fleet management required for scale
