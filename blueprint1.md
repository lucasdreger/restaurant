# Digital Restaurant Compliance & Management Platform (Ireland)

## Purpose
This document defines a **complete blueprint** for a digital restaurant management platform focused on **legal compliance, automation, and operational excellence** in the Republic of Ireland. The primary goal is to **fully digitise and automate food safety and operational requirements** defined by Irish law and the Food Safety Authority of Ireland (FSAI), while remaining usable by **small cafés, large restaurants, new chefs, and experienced professionals**.

The platform is designed to be:
- **Legally defensible** (inspection-ready)
- **Highly automated** (IoT + AI-first)
- **Low cognitive load** for kitchen staff
- **Commercially scalable** (multi-site, SaaS)

---

## Legal & Regulatory Foundation (Ireland)

### Mandatory Legal Framework
Any food business in Ireland must comply with:
- EU Regulation (EC) No 852/2004 (Food Hygiene)
- Irish Food Safety Authority (FSAI) guidance
- HACCP-based food safety management

The **Safe Catering Pack** is the officially accepted practical implementation of these laws for catering businesses. Your platform **must fully replicate and enhance this system**, not replace or reinterpret it.

---

## PART 1 — Core Compliance Engine (Mandatory)

This layer ensures **legal compliance** and must be inspection-proof.

### 1. Digital Safe Catering Plan (HACCP Wizard)

**Goal:** Guide any restaurant through HACCP without prior expertise.

Capabilities:
- Wizard-based onboarding
- Stage-by-stage food flow:
  - Delivery
  - Storage (chilled, frozen, dry)
  - Preparation
  - Cooking
  - Cooling
  - Reheating
  - Hot holding
  - Service / delivery
- For each stage:
  - Hazard identification (biological, chemical, physical)
  - Control measures
  - Critical limits
  - Corrective actions

Outputs:
- Fully structured HACCP plan
- Stored, versioned, timestamped

---

### 2. Digital Safe Catering Records (SC Forms)

Each official record becomes a **data object**, not a PDF.

| Area | Records |
|----|----|
| Deliveries | Supplier, temperature, condition, rejection logic |
| Temperature Control | Fridges, freezers, hot holding, cooking |
| Cleaning | Daily / weekly / monthly schedules |
| Staff Training | Food safety training, refresh dates |
| Fitness to Work | Illness declaration |
| Allergen Control | Dish-level allergen mapping |
| Transport / Delivery | Temperature & time compliance |

Features:
- Mandatory fields enforced
- Digital signatures
- Automatic timestamps
- Immutable audit logs

---

### 3. Declaration of Completion & Review (Legal Proof)

- Auto-generated declaration
- Required:
  - Initial completion
  - Annual review
  - Menu change
  - Process change
- Digitally signed by manager
- Exportable as PDF for inspectors

---

## PART 2 — Kitchen Operations & Automation

### 4. Smart Temperature Monitoring (IoT)

**Objective:** Eliminate manual temperature checks.

Features:
- Smart probes for:
  - Fridges
  - Freezers
  - Walk-ins
- Reporting:
  - Every 15–60 minutes
- Threshold logic:
  - Legal limits enforced
- Automatic corrective workflows:
  - Notify manager
  - Log incident
  - Trigger action checklist

Example:
> Freezer > -12°C → Alert → Investigate → Move food → Service call logged

---

### 5. Manual Fallback (Legal Safety Net)

- Manual entry always available
- Required if sensor offline
- System flags repeated manual overrides

---

### 6. Cleaning & Hygiene Automation

- Task engine:
  - Daily / weekly / monthly
- QR codes on equipment
- Scan → checklist opens
- Photo proof option
- Missed tasks escalate

---

## PART 3 — Allergen & Menu Intelligence

### 7. Dynamic Allergen Engine

- Ingredient-based allergen mapping
- Menu-level exposure analysis
- Auto-update when:
  - Ingredient changes
  - Supplier changes
- Customer-facing outputs:
  - Printable allergen matrix
  - Digital menu export

---

### 8. AI Menu Interpretation (Vibe Coding)

Chef writes:
> "Chicken curry with cream, peanuts, soy sauce"

System outputs:
- Allergens: milk, peanuts, soy
- HACCP risks
- Storage & prep controls

---

## PART 4 — Staff, Training & Human Factors

### 9. Role-Based UX

| Role | Interface |
|----|----|
| Chef | Voice, quick actions, alerts |
| Manager | Dashboard, reports |
| Owner | Compliance & risk |

---

### 10. Training & Certification

- Training records per employee
- Expiry tracking
- Micro-learning prompts
- Inspector-ready evidence

---

### 11. Fitness-to-Work Automation

- Daily health declaration
- Illness lockout
- Return-to-work checklist

---

## PART 5 — AI Compliance Assistant

### 12. Embedded Legal AI (Ireland-only)

Capabilities:
- Trained only on:
  - FSAI guidance
  - Irish food law
- Context-aware:
  - Uses restaurant's own HACCP plan

Example:
> "Fridge is 8°C, what do I do?"

AI response:
- Exact corrective action
- Logs decision

---

### 13. Inspector Simulation Mode

- Simulates EHO inspection
- Flags missing or weak areas
- Pre-inspection readiness score

---

## PART 6 — Inventory, Waste & Sustainability

### 14. Smart Inventory

- Delivery intake via camera or scan
- Expiry tracking
- FIFO enforcement

---

### 15. Waste Analytics

- Waste reason tagging
- Legal vs operational waste
- Cost & sustainability insights

---

## PART 7 — Platform Architecture (Technical)

### Core Stack (Example)
- Frontend: Web + Tablet-first
- Backend: Event-driven
- Database: Immutable logs + relational
- IoT: Zigbee / LoRaWAN / MQTT
- AI: RAG-based (no hallucination)

---

## PART 8 — Commercialisation Strategy

### Target Customers
- Small cafés (compliance-driven)
- Multi-site chains
- Contract caterers

### Pricing Logic
- Per location
- Hardware add-ons
- AI support tier

---

## PART 9 — Competitive Differentiation

| Area | Typical Apps | This Platform |
|----|----|----|
| HACCP | Static | Self-updating |
| Logs | Manual | Sensor-driven |
| Support | Tickets | AI legal expert |
| Compliance | User risk | System-guaranteed |
| Operations | Fragmented | Unified core |
| Hardware | None / custom | Certified plug-and-play |

---

## PART 10 — Restaurant Operations (Beyond Compliance)

This section covers **standard restaurant software domains** often outside food-safety apps, but expected by operators.

### 16. POS & Sales (Optional Integration)
- Integrations (not replacement):
  - Square
  - Lightspeed
  - Toast
- Use cases:
  - Correlate sales volume vs cleaning frequency
  - Predict food safety risk during peak hours

---

### 17. Reservations & Capacity Awareness
- Sync reservations
- Risk-based alerts:
  - Understaffed shifts
  - Over-capacity kitchens

---

### 18. Staff Scheduling & Labour
- Shift scheduling
- Skill-based rostering (trained vs untrained)
- Legal proof of trained staff per shift

---

### 19. Supplier & Traceability Management
- Approved supplier list
- Batch / lot tracking
- Recall simulation ("which dishes used this batch?")

---

### 20. Equipment Asset Management
- Fridges, freezers, ovens, probes
- Maintenance logs
- Breakdown history

---

## PART 11 — Hardware Strategy (Critical)

### 21. Hardware Philosophy

Goals:
- Zero technician visits
- Chef-installable
- Legally defensible

Principles:
- You certify *models*, not vendors
- You control firmware expectations
- Hardware is optional but strongly recommended

---

### 22. Temperature Sensors (Freezers, Fridges)

**Recommended characteristics**:
- Battery-powered (1–3 years)
- No calibration drift
- External probe option

**Connectivity options**:

| Tech | Pros | Cons |
|----|----|----|
| Zigbee | Cheap, low power | Needs hub |
| LoRaWAN | Long range | Network dependency |
| Wi-Fi | Simple | Battery drain |

**Strong recommendation**:
- Zigbee sensors + your own gateway

---

### 23. Approved Hardware Program

You publish a list:
- "Approved for Compliance" devices

Onboarding flow:
1. Chef scans QR code on sensor
2. App auto-detects model
3. Calibration check wizard
4. Legal acceptance logged

No pairing screens. No tech jargon.

---

### 24. Selling Hardware (Business Model)

Options:
- Hardware resale (margin 20–40%)
- Hardware-as-a-Service (monthly)
- BYOD (approved list only)

**Strong opinion**:
- Offer hardware bundles during onboarding
- Include 1–2 sensors free in annual plan

---

### 25. Avoiding Technician Visits

Strategies:
- Pre-paired gateways
- NFC / QR provisioning
- Auto firmware checks
- Remote diagnostics

---

## PART 12 — Onboarding Experience (Chef-First)

### 26. Zero-Setup Onboarding

First 30 minutes:
- Upload menu
- Confirm equipment
- Place sensors
- Done

No manuals. No installers.

---

### 27. Progressive Disclosure

- Day 1: Legal essentials
- Week 1: Automation
- Month 1: Optimisation

---

## PART 13 — AI-Driven Support & Autonomy

### 28. AI as First-Line Support

- Voice questions from kitchen
- Context-aware answers
- Auto-log incidents

---

### 29. Self-Healing Compliance

- Detect gaps
- Generate corrective actions
- Close loops automatically

---

## PART 14 — Risks & Mitigations

| Risk | Mitigation |
|----|----|
| Sensor failure | Manual fallback + alert |
| Inspector distrust | Transparent logs |
| AI hallucination | RAG-only + citations |
| Chef resistance | Minimal UI |

---

## PART 15 — Roadmap Recommendation

### MVP (90 days)
- Digital Safe Catering Pack
- Manual logs
- AI support

### V1
- IoT temperatures
- Allergen engine

### V2
- Inventory
- Waste
- POS signals

---

## Final Opinion (Blunt)

Most restaurant software **optimises revenue**.

This platform **eliminates existential legal risk**.

That makes it budgetable, defensible, and sticky.


---

## PART 16 — Review & Consolidation of External Blueprint (Grok)

This section **integrates, filters, and rationalises** the external Grok blueprint against our existing strategy. The goal is to **keep what strengthens compliance, automation, and commercial viability**, and **remove or downgrade what adds risk, noise, or unnecessary scope**.

### What We KEEP (Aligned & Valuable)

**Strong alignment with our vision:**

1. **Wizard-based HACCP / Safe Catering digitisation**  
   ✔ Fully aligned. Core of the product.

2. **Corrective actions tied to temperature thresholds**  
   ✔ Mandatory. Critical for inspections and legal defensibility.

3. **AI assistant trained on FSAI + user-specific plan**  
   ✔ Keep. This is a key differentiator.

4. **IoT temperature monitoring (hourly or better)**  
   ✔ Keep. Central to automation and risk reduction.

5. **POS integration (read-only)**  
   ✔ Keep, but *strictly optional* and secondary.

6. **Role-based UX (new vs experienced chefs)**  
   ✔ Keep. Essential for adoption.

7. **Subscription SaaS model with tiers**  
   ✔ Keep. Matches market expectations.

8. **Offline-first / PWA support**  
   ✔ Keep. Irish kitchens often have weak connectivity.

9. **Annual review & declaration automation**  
   ✔ Keep. Strong legal value.

---

### What We DOWNGRADE (Optional / Phase 2+)

These add value but are **not essential for product-market fit**:

- Weight sensors for shelves  
- Waste bin image recognition  
- Sustainability / carbon reporting  
- Customer feedback loops tied to compliance  

➡️ Keep in roadmap, not MVP.

---

### What We REMOVE (Too Risky or Distracting)

**Explicit removals or constraints:**

1. ❌ **Voice assistants like Alexa/Google in kitchen**  
   Reason: unreliable in noisy kitchens, privacy issues, low inspector trust.

2. ❌ **Replacing POS / payroll / full financial suite**  
   Reason: crowded market, not compliance-critical.

3. ❌ **Environmental sensors (CO2/humidity) as compliance signals**  
   Reason: not explicitly required by FSAI; high false positives.

4. ❌ **Claiming FSAI endorsement**  
   Reason: legal risk. Position as *facilitator*, not authority.

---

## PART 17 — Final Hardware Strategy (Authoritative)

### Hardware Position (Strong Opinion)

- Hardware is **not optional** for serious compliance
- But must be **plug-and-play**, chef-installed

### Approved Hardware Program (AHP)

You maintain an internal certification:

> “Approved for Compliance – Ireland”

Criteria:
- Battery-powered
- Stable calibration
- Encrypted comms
- Proven MTBF

You certify **models**, not brands.

---

### Recommended Connectivity (Ireland)

| Tech | Verdict |
|----|----|
| Zigbee | ✅ Primary |
| LoRaWAN | ⚠ Situational |
| Wi-Fi | ❌ Avoid |
| Bluetooth-only | ❌ Avoid |

**Default:** Zigbee sensors + pre-paired gateway shipped to site.

---

### Sensor Onboarding (No Technician)

1. Gateway arrives pre-configured
2. Chef plugs in
3. Sensor QR scanned
4. Sensor assigned to asset (Freezer 1)
5. Compliance logging starts

Target time: **<5 minutes per sensor**

---

### Hardware Commercial Model

Recommended:
- Hardware bundles included in annual plans
- Replacement sensors sold separately
- Optional Hardware-as-a-Service

Rationale:
- Reduces churn
- Increases LTV
- Locks in compliance quality

---

## PART 18 — Technical Architecture (Concrete)

### High-Level Architecture

- Frontend: Web + Tablet (PWA)
- Backend: Event-driven (Node.js or Python)
- DB:
  - Relational (Postgres) for state
  - Append-only log store for audits
- IoT:
  - MQTT broker
  - Device shadowing
- AI:
  - RAG-only LLM
  - No free-text decision making

---

### AI Safety Model

- All answers:
  - Source-cited
  - Plan-aware
  - Logged

No hallucinations tolerated.

---

## PART 19 — GDPR & Legal Safeguards (Ireland/EU)

Key principles:
- Staff data minimisation
- Explicit consent
- Right to export/delete

Sensitive exclusions:
- No biometrics
- No health diagnostics

Audit logs immutable, staff-editable data limited.

---

## PART 20 — Unified Development Roadmap

### Phase 0 (Validation)
- Interviews with EHOs
- 3–5 pilot kitchens

### Phase 1 (MVP – 90 days)
- Digital Safe Catering Pack
- Manual logs
- AI compliance assistant

### Phase 2
- IoT temperatures
- Approved hardware program

### Phase 3
- Inventory & supplier traceability
- Waste analytics

### Phase 4
- Multi-country expansion (UK first)

---

## FINAL STRATEGIC POSITION

This product is **not restaurant software**.

It is **compliance infrastructure**.

If the system says “compliant”, the operator sleeps at night.

That is the value proposition.


---

## PART 21 — End‑to‑End Business Process (From Onboarding to Inspection)

### End‑to‑End Flow (Real World)

1. Restaurant signs up
2. Guided onboarding (30–45 min)
3. Digital Safe Catering Plan generated
4. Hardware (optional but recommended) installed by staff
5. Daily operation (mostly automated)
6. Incident occurs → system reacts
7. Continuous compliance score maintained
8. Inspection day → one‑click export

The system’s goal: **zero surprises on inspection day**.

---

## PART 22 — User Personas

### Persona A — Owner / Operator
- Cares about legal risk, fines, closure
- Wants dashboard + peace of mind

### Persona B — Head Chef
- Busy, practical
- Needs clear instructions, not theory

### Persona C — Kitchen Staff
- Minimal interaction
- Checklists, confirmations only

### Persona D — Inspector (Indirect User)
- Wants clear, trustworthy records
- No gimmicks, no missing data

---

## PART 23 — Core User Stories (End‑to‑End)

### Onboarding

**US‑01**  
_As an owner, I want to describe my restaurant in simple terms so that a compliant Safe Catering Plan is created automatically._

Acceptance:
- Wizard completes
- HACCP plan generated
- Editable but locked by defaults

---

### Daily Operations

**US‑02**  
_As a chef, I want temperature monitoring to happen automatically so I don’t need to remember manual checks._

Acceptance:
- Sensor data logged
- No daily prompts if sensors active

---

**US‑03**  
_As staff, I want cleaning tasks to be quick to confirm so I can focus on service._

Acceptance:
- QR scan → checklist
- <30 seconds per task

---

### Incident Handling

**US‑04**  
_As a manager, I want to be alerted immediately when something goes wrong so I can act before food becomes unsafe._

Acceptance:
- Alert sent
- Corrective action logged
- Incident closed

---

### Inspection

**US‑05**  
_As an inspector, I want clear, timestamped records so I can quickly verify compliance._

Acceptance:
- Export works offline
- Logs immutable

---

## PART 24 — Sensor Strategy (What Actually Matters)

### Sensors That Matter (High ROI)

| Sensor | Mandatory? | Why |
|----|----|----|
| Fridge temp | ✅ | Core FSAI control |
| Freezer temp | ✅ | Critical limit |
| Probe thermometer | ⚠ | Cooking verification |
| Door open sensor | ⚠ | Explains temp drift |
| Power outage | ⚠ | Food loss proof |

### Sensors to Avoid (Low ROI)

- Humidity
- CO₂
- Noise
- Cameras (privacy + GDPR risk)

---

## PART 25 — Device & Platform Support

### Supported Client Devices

Principle: **device‑agnostic**.

- Web (Chrome, Safari, Edge)
- iPad (very common in kitchens)
- Android tablets
- Laptop (Mac / Windows)

Implementation:
- PWA (offline‑first)
- No native apps initially

---

## PART 26 — System Management Model

### Multi‑Tenant Architecture

- One logical platform
- Tenant isolation at DB level
- Role‑based access

### Data Types

- Operational (mutable)
- Compliance logs (append‑only)
- Sensor telemetry (time‑series)

---

## PART 27 — Supabase: Is It Enough?

### Short Answer

✅ **Yes for MVP and early scale**  
⚠ **Needs evolution later**

### Why Supabase Works Initially

- Auth + RLS built‑in
- Postgres = inspectors love exports
- Fast iteration

### Where Supabase Breaks

- Very high sensor volume
- Advanced analytics
- Cross‑region expansion

### Migration Strategy

- Start Supabase
- Abstract data access layer
- Split later:
  - Core DB
  - Time‑series DB (e.g. Timescale)

---

## PART 28 — What Can Go Wrong (And Mitigations)

### 1. Sensor Failure
Mitigation:
- Manual fallback
- Alert if sensor silent

---

### 2. Chef Resistance
Mitigation:
- Automation first
- No “busy work”

---

### 3. Inspector Distrust of Digital Logs
Mitigation:
- Immutable audit trail
- Plain exports
- No black boxes

---

### 4. AI Hallucination Risk
Mitigation:
- RAG only
- Source‑cited answers
- No creative freedom

---

### 5. Scope Creep
Mitigation:
- Compliance > features
- Roadmap discipline

---

## PART 29 — Final Reality Check

If this product fails, it will **not** be because:
- Tech is hard
- Hardware is expensive

It will fail if:
- UX disrespects kitchen reality
- Compliance trust is broken

If you protect those two things, this is viable.


---

## PART 30 — Comprehensive User Stories (Prioritised, End-to-End)

The stories below define the complete product surface required to deliver **inspection-proof compliance** with high automation, while also covering the operational areas expected by restaurants.

### Conventions
- Priority: P0 (must), P1 (should), P2 (later)
- Roles: Owner, Manager, Head Chef, Chef, Staff, Auditor/Inspector (indirect)

---

### EPIC A — Account, Sites, Roles, Access Control

**US-001 (P0)** — As an owner, I want to create a location (site) so that each restaurant’s data is isolated and reportable.

**US-002 (P0)** — As an owner, I want to invite staff and assign roles (owner/manager/chef/staff) so that permissions match responsibilities.

**US-003 (P0)** — As a manager, I want role-based screens so that staff only see what they must do.

**US-004 (P0)** — As an owner, I want to revoke access immediately so that ex-employees cannot see compliance records.

---

### EPIC B — Guided Compliance Onboarding (Safe Catering Plan Wizard)

**US-005 (P0)** — As an owner, I want a wizard that asks simple operational questions so the system can generate a Safe Catering Plan.

**US-006 (P0)** — As a head chef, I want advanced mode controls so I can adjust hazards/controls for complex operations.

**US-007 (P0)** — As a manager, I want the plan to be versioned so that changes are traceable.

**US-008 (P0)** — As an owner, I want a declaration of completion so I can show I have a system in place.

**US-009 (P0)** — As a manager, I want the system to force a review when menu/process changes occur.

---

### EPIC C — Deliveries, Receiving, Approved Suppliers

**US-010 (P0)** — As a chef, I want a delivery intake flow (scan + checklist) so I can log supplier, batch, condition, and temperature fast.

**US-011 (P0)** — As a manager, I want an approved supplier list so I can block risky suppliers.

**US-012 (P1)** — As a manager, I want to record delivery rejections so I can show corrective action.

**US-013 (P1)** — As a manager, I want batch/lot capture so I can trace ingredients to dishes.

---

### EPIC D — Storage: Chilled, Frozen, Dry

**US-014 (P0)** — As staff, I want a daily cold storage check (manual fallback) so that compliance continues if sensors fail.

**US-015 (P0)** — As a manager, I want the system to flag unsafe fridge/freezer readings so corrective actions start immediately.

**US-016 (P1)** — As a chef, I want FIFO and expiry reminders so that waste and risk decrease.

**US-017 (P1)** — As a manager, I want evidence of fridge setpoints and trend history so that anomalies are explainable.

---

### EPIC E — Cooking, Hot Holding, Service

**US-018 (P0)** — As a chef, I want to log cooking core temperature quickly so that high-risk foods are proven safe.

**US-019 (P0)** — As staff, I want hot-holding monitoring prompts so food is kept outside the danger zone.

**US-020 (P1)** — As a head chef, I want batch separation guidance so that mixing old/new batches in hot holding is avoided.

---

### EPIC F — Cooling Down Cooked Food (Critical Real-World Workflow)

This covers the scenario described by the chef: **cooked sauces/foods not used immediately**.

**US-021 (P0)** — As a chef, when I cook sauce/food for later use, I want a “cool-down workflow” so I can cool it safely and legally.

Acceptance requirements:
- Captures “time finished cooking”
- Guides cooling method (shallow containers / blast chill / ice bath)
- Enforces “place in fridge within 2 hours” target
- Logs completion automatically

**US-022 (P0)** — As a manager, I want the system to alert if cool-down is overdue so food is not kept in the danger zone.

**US-023 (P1)** — As a chef, I want portioning guidance (container depth/size) so cooling happens fast.

**US-024 (P1)** — As a manager, I want to link cooled items to labelled storage containers so traceability exists.

---

### EPIC G — Reheating & Leftovers

**US-025 (P0)** — As a chef, I want reheating checks with required temperatures so that reheated food is safe.

**US-026 (P0)** — As a manager, I want a rule that leftovers are reheated only once so unsafe repeated reheats are prevented.

**US-027 (P1)** — As a manager, I want leftover storage duration reminders so food isn’t kept too long.

---

### EPIC H — Cleaning, Hygiene, and Verification

**US-028 (P0)** — As staff, I want daily/weekly/monthly cleaning schedules so tasks are clear and confirmable.

**US-029 (P0)** — As a manager, I want escalation for missed cleaning tasks so compliance gaps are closed.

**US-030 (P1)** — As a manager, I want optional photo proof for high-risk cleaning tasks.

**US-031 (P1)** — As a manager, I want verification checks (“supervisor sign-off”) so records are trustworthy.

---

### EPIC I — Personal Hygiene & Fitness to Work

**US-032 (P0)** — As staff, I want a simple fitness-to-work declaration so illness risk is controlled.

**US-033 (P1)** — As a manager, I want the system to restrict scheduling for ill staff until cleared.

---

### EPIC J — Allergens & Customer Information

**US-034 (P0)** — As a manager, I want a structured allergen matrix for every dish so I can answer customers correctly.

**US-035 (P0)** — As a chef, I want recipe-level allergen computation so changes update automatically.

**US-036 (P1)** — As a manager, I want printable/exportable allergen outputs for menus and counter displays.

**US-037 (P1)** — As staff, I want a quick “allergen question” screen so I can answer within 10 seconds.

---

### EPIC K — Staff Training & Competency

**US-038 (P0)** — As a manager, I want training records per employee so I can show staff are competent.

**US-039 (P1)** — As a manager, I want expiry reminders for training refreshers.

**US-040 (P1)** — As a head chef, I want micro-learning prompts tied to recent incidents.

---

### EPIC L — Pest Control, Maintenance, and Equipment

**US-041 (P1)** — As a manager, I want pest sightings and actions logged so issues are documented.

**US-042 (P1)** — As a manager, I want asset maintenance logs so fridge/freezer servicing is provable.

**US-043 (P1)** — As a manager, I want an incident-to-maintenance link so root cause is tracked.

---

### EPIC M — IoT Hardware, Provisioning, Reliability

**US-044 (P0)** — As a manager, I want to install sensors with QR scan and no technical setup.

**US-045 (P0)** — As a manager, I want alerts when a sensor stops reporting so I can switch to manual checks.

**US-046 (P1)** — As a manager, I want trend analysis so I can predict failing equipment before it breaks.

**US-047 (P2)** — As a manager, I want door-open correlation so I can explain temperature excursions.

---

### EPIC N — Inspector Mode & Evidence Exports

**US-048 (P0)** — As a manager, I want a one-click inspection pack export (PDF/CSV) so I can provide evidence fast.

**US-049 (P0)** — As a manager, I want immutable audit trails so records cannot be falsified post-hoc.

**US-050 (P1)** — As a manager, I want a readiness score so gaps are fixed before inspection.

---

### EPIC O — Offline-first & Data Integrity

**US-051 (P0)** — As kitchen staff, I want the app to work offline so I can record checks without internet.

**US-052 (P0)** — As a manager, I want automatic sync with conflict handling so data remains consistent.

---

### EPIC P — Integrations (Optional, Controlled)

**US-053 (P2)** — As an owner, I want POS read-only integration so analytics are better without replacing POS.

**US-054 (P2)** — As a manager, I want supplier system integration so deliveries ingest automatically.

---

### EPIC Q — Billing, Plans, Hardware Bundles

**US-055 (P0)** — As an owner, I want subscription billing and invoice history so procurement is simple.

**US-056 (P1)** — As an owner, I want to add hardware bundles during onboarding so adoption is frictionless.

---

## PART 31 — Cooling Workflow Specification (Cooked Food Not Used Immediately)

### Business Reality
Kitchens frequently batch-cook sauces, soups, stews, stocks, braises, etc. If not served immediately, the risk is **bacterial growth while cooling**.

### Digital Flow
1. Chef selects “Cool for later”
2. System starts a timer at “finished cooking”
3. Chef selects cooling method:
   - Shallow containers
   - Blast chiller
   - Ice bath
   - Divide into smaller portions
4. System enforces deadline: “must be in fridge within 2 hours”
5. System asks for final confirmation: “in fridge now”
6. Record is locked (append-only) and included in inspection export

### UX Constraints
- Must be completable in <20 seconds
- Must work with gloves
- Must work on tablet

---

## PART 32 — Hardware Catalogue (Practical, Profitable)

### Core Hardware SKUs (Start Small)

1. Zigbee temperature sensor (fridge)
2. Zigbee temperature sensor (freezer)
3. Gateway (Ethernet preferred)
4. Optional probe thermometer (Bluetooth docking)

### Onboarding Principles
- Pre-paired gateways
- QR provisioning
- No Wi-Fi setup

### Support Principles
- Remote diagnostics dashboard
- “Sensor silent” alerting
- Battery level monitoring

---

## PART 33 — Expanded Risk Register (What You Still Might Miss)

### Operational Risks
- Staff bypass behaviour (checkbox fatigue)
- Night shifts ignoring alerts
- Incorrect allergen inputs

Mitigations
- Automation-first
- Mandatory critical controls only
- Audit sampling and supervisor sign-off

### Legal Risks
- Overclaiming compliance guarantees
- Misstating temperature/time limits

Mitigations
- Clear disclaimers
- Source-based plan generation
- Export transparency

### Technical Risks
- Time-series data explosion
- Offline sync corruption

Mitigations
- Separate telemetry store
- Idempotent event processing
- Append-only log strategy

### Commercial Risks
- Restaurants resist paying for “another app”
- Hardware logistics headaches

Mitigations
- Position as legal-risk platform
- Bundled starter kit
- Replace sensors fast

---

## PART 34 — Scale Strategy (If It Works)

### Data Layer Evolution
- Phase 1: Postgres (Supabase) for operational + compliance
- Phase 2: Add time-series DB for telemetry
- Phase 3: Multi-region deployment

### Tenant Isolation
- Strict RLS
- Per-tenant encryption keys (later)
- Audit exports per location

---


---

## PART 35 — Kitchen-First Interaction Design (Zero Bureaucracy)

This section revalidates the plan against **real kitchen conditions**:
- Wet/dirty hands
- Gloves
- Noise
- Rush periods
- Low patience for “admin work”

### Non-Negotiable Product Principles

1. **Automation > data entry**
2. **One-tap confirmations only** (no typing during service)
3. **Evidence must be captured as a by-product of work**
4. **No duplicated work** (if it exists elsewhere, integrate or infer)
5. **Fallback paths must be faster than failure**

---

## PART 36 — Input Methods Matrix (How People Actually Use It)

### Primary Interaction Modes (in priority order)

1. **Passive capture (IoT)**
   - Fridge/freezer temps
   - Uptime/sensor health
   - Battery state

2. **Tap-to-confirm (tablet mounted on wall)**
   - Cleaning done
   - Cool-down item moved to fridge
   - Delivery accepted/rejected

3. **Scan-to-open (QR/NFC on assets)**
   - “Freezer 2” QR opens the right screen instantly
   - No navigation

4. **Voice-to-text (limited, optional)**
   - Only for non-critical notes
   - Not used as primary evidence

5. **Back-office entry (laptop/phone)**
   - Owner/manager tasks: suppliers, menu, training records

### What We Avoid
- Multi-step forms during rush
- Free-text typing for critical controls
- Anything requiring glove removal

---

## PART 37 — Task Design Patterns (Make Compliance Invisible)

### Pattern A: “Autolog + Exception Only”
- Normal state: everything logs automatically
- Human action required only when:
  - sensor fails
  - threshold exceeded
  - inspection export requested

### Pattern B: “Two-step micro-flow”
- Step 1: trigger (scan QR / tap button)
- Step 2: confirm (Done / Not done)

Target: **<10 seconds** per compliance interaction.

### Pattern C: “Timers not forms”
- For cooling, reheating, hot holding
- Start timer with one tap
- End timer with one tap
- System enforces rules automatically

---

## PART 38 — Revalidated UX for Critical Workflows (Realistic)

### 38.1 Cooling Workflow (Sauce/Food for Later)

Kitchen reality: chef cannot type, cannot read long text.

**UI design**
- Big buttons
- One-handed
- Minimal text

**Trigger options**
- Tap “Cool for later” on a wall tablet
- OR scan QR on container label roll (preferred)

**Flow**
1. Tap: “Cool for later”
2. Select item type (Sauce / Soup / Meat / Other) — optional defaults
3. Timer starts automatically
4. App shows one instruction line:
   - “Split shallow / ice bath / blast chill”
5. At 90 minutes: push alert to manager
6. At 120 minutes: forced decision screen
   - “In fridge now”
   - “Discard”
   - “Explain exception” (manager-only)

**Evidence captured**
- Timestamp start
- Timestamp completion
- Method selected (optional)
- Responsible role

This is legally meaningful evidence without bureaucracy.

---

### 38.2 Cooking Core Temperature (Probe)

Kitchen reality: probe reading is the evidence; typing is waste.

**Preferred**
- Bluetooth probe sends temperature to app
- Chef taps “Accept”

**Fallback**
- Tap preset temperature buttons (e.g. 75°C / 82°C)
- Or manual numeric entry (manager-only)

---

### 38.3 Delivery Intake

Kitchen reality: deliveries are time-pressured.

**Flow**
1. Scan supplier QR (or select last supplier)
2. Quick checklist (3 toggles):
   - Packaging OK
   - Use-by OK
   - Temp OK
3. If temp needed:
   - probe → auto-capture
   - else choose “no temp measured” (logged + flagged)
4. Accept / Reject

---

### 38.4 Cleaning

Kitchen reality: cleaning already happens; logging is the problem.

**Flow**
- QR on station → opens tasks for that station
- Tap “Done”
- Supervisor sees “verify needed” queue

**Anti-fraud**
- Random sampling: 1–2 tasks/day require supervisor sign-off
- Not everything needs proof

---

## PART 39 — “Minimum Viable Evidence” (Stop Over-Logging)

To avoid bureaucracy, define the minimum evidence an inspector expects:

P0 evidence categories:
- Cold storage temps (automated)
- Corrective actions when out of range
- Cleaning schedule + completion
- Staff training records
- Allergen info accuracy
- Cooling/reheating/hot holding controls

Everything else is optional analytics.

---

## PART 40 — System Behaviours That Reduce Staff Work

### 40.1 Default Suggestions
- Autofill suppliers
- Repeat last delivery profile
- Repeat common cooling items (Sauce base)

### 40.2 Silent Reminders
- Only remind if missing
- Never nag when sensors active

### 40.3 Manager-Only Exceptions
- Any explanation field
- Any override

---

## PART 41 — Hardware to Enable Zero-Touch UX

### Kitchen Hardware “Starter Kit” (Practical)

1. Zigbee fridge sensor
2. Zigbee freezer sensor
3. Gateway (Ethernet preferred)
4. 1 Bluetooth probe thermometer
5. Printable QR label roll (containers + equipment)
6. Optional wall-mount tablet stand

This kit is designed to eliminate typing.

---

## PART 42 — Adoption Playbook (Make Chefs Like It)

### What Chefs Care About
- Not getting blamed
- Not wasting time
- Clear instructions when something goes wrong

### How We Deliver That
- Fewer checks because sensors do it
- “Do this now” incident screens
- One-tap closeouts
- No admin tasks on the line

---

## PART 43 — Revalidation Checklist (Before Building Features)

For every planned feature, ask:
1. Can it be **passively captured**?
2. If not, can it be done in **<10 seconds**?
3. Does it require typing in the kitchen? If yes, redesign.
4. Is it **P0 evidence** or just “nice analytics”?
5. Does it reduce risk or add bureaucracy?

If it fails these checks, it does not ship.


---

## PART 44 — Screen Map & Wireflows (Tablet-First, Kitchen Reality)

This section defines the **actual UI surfaces** we must build so that chefs/managers can comply **without bureaucracy**.

### Screen Modes

1. **Kiosk Mode (Kitchen Wall Tablet)**
   - No login (optional PIN)
   - Big buttons
   - Fast flows

2. **Manager Mode (Phone/Laptop)**
   - Setup, overrides, exports
   - Review queues

3. **Owner/Backoffice Mode (Laptop)**
   - Billing, multi-site, policies

---

## A) Kiosk Mode — Primary Screens

### K-01 Home (Today)

- Big tiles:
  - “Cool for later”
  - “Log cooking temp”
  - “Delivery intake”
  - “Cleaning tasks”
  - “Allergen question”
  - “Incidents” (only if active)

- Status strip:
  - Fridge OK / Freezer OK
  - Sensors online/offline

---

### K-02 Cool for Later (Start)

Flow:
1. Tap “Cool for later”
2. Choose item preset (optional): Sauce / Soup / Meat / Other
3. Confirm container (optional): scan QR label
4. Timer starts

Output:
- Cool-down event created (append-only)

---

### K-03 Cool for Later (Close)

Triggered by timer/alert.

Buttons:
- “In fridge now”
- “Discard”
- “Needs manager” (if unsure)

---

### K-04 Cooking Temp (Probe)

Primary:
- “Waiting for probe…”
- When reading arrives:
  - “Accept”
  - “Retake”

Fallback:
- Preset buttons (75°C, 82°C)
- Manual entry hidden behind manager PIN

---

### K-05 Delivery Intake

Flow:
1. Supplier: tap recent supplier or scan supplier QR
2. Quick toggles:
   - Packaging OK
   - Use-by OK
   - Temp OK
3. Accept / Reject

If temp required:
- probe auto-capture
- or “No temp measured” (logged and flagged)

---

### K-06 Cleaning Tasks

- Choose station (or scan QR)
- List of tasks
- Tap Done
- “Needs verification” queue created (manager sampling)

---

### K-07 Allergen Question

- Search dish by 3 taps (categories)
- Shows 14 allergen list
- Shows “May contain” warnings
- Optional: “Ask manager”

---

### K-08 Incidents (Active)

Shows only active incidents:
- Freezer high temp
- Sensor offline
- Cool-down overdue

Each incident:
- “Do this now” checklist
- “Close incident” button

---

## B) Manager Mode — Core Screens

### M-01 Dashboard

- Compliance score
- Active incidents
- Missing evidence (P0 only)
- Sensors health

---

### M-02 Review Queue

- Items needing verification
- Overrides pending
- Training expiries

---

### M-03 Incident Detail

- Timeline
- Suggested corrective actions
- Close-out with reason
- Maintenance link

---

### M-04 Menu & Allergen Engine

- Recipes
- Ingredients
- Supplier mapping
- Auto allergen matrix output

---

### M-05 Safe Catering Plan Editor (Guardrails)

- Plan stages
- Hazards/controls
- Version history
- “Request plan change” flow (logged)

---

### M-06 Exports (Inspector Pack)

- Date range
- Included evidence list
- Generate:
  - PDF pack
  - CSV logs

---

## C) Owner/Backoffice Screens

### O-01 Sites & Users

- Create site
- Simple mode vs RBAC mode

### O-02 Billing

- Plan
- Hardware bundles

### O-03 Hardware Fleet

- Sensors per site
- Replacement shipments

---

## PART 45 — Role Flexibility (Small Restaurants Reality)

### Simple Mode (No RBAC)
For small restaurants where owner = chef = manager.

- One login or kiosk PIN
- No invitations required
- All actions allowed
- Still logs who did what (device identity + optional initials)

### RBAC Mode (Chains)
- Full roles and permissions

The restaurant chooses during onboarding.

---

## PART 46 — Zigbee in Practice (Device-Agnostic App)

### Key Reality
Zigbee devices do **not** connect to iPad/Android/laptops directly.

They connect to a **Zigbee coordinator/gateway**, which forwards data to our platform.

### Practical Architecture

1. Zigbee Sensors (fridge/freezer)
2. Zigbee Coordinator/Gateway (local)
3. Local bridge service (MQTT)
4. Cloud ingestion API
5. Web/PWA app shows data

### Supported Gateway Strategies

**Strategy A (Recommended): Our pre-configured gateway**
- Customer plugs Ethernet + power
- Sensors join automatically
- Lowest support burden

**Strategy B (Power users): Sonoff + Zigbee2MQTT / HA**
- Sonoff dongle acts as coordinator
- Zigbee2MQTT publishes telemetry
- We ingest via MQTT bridge

We still certify sensor models.

### Approved Models Principle
Not “works with everything”.

We certify:
- Coordinator models
- Sensor models
- Firmware expectations

This avoids support chaos.

---

## PART 47 — Zigbee Devices Beyond Temperature (Useful)

High-value Zigbee add-ons:
- Smart plugs as Zigbee routers (mesh strengthening)
- Door sensors (correlate excursions)
- Leak sensors (dishwasher area)
- Power monitoring plugs (outage detection signals)

All must be on approved list.


---

## PART 48 — Pre-Configured Zigbee Gateway for Sale (How to Productise It)

### Goal
Ship a gateway that a restaurant can install **without technical knowledge**:
- Plug power + Ethernet
- Scan QR
- Sensors join
- Data appears in the app

### Why a Gateway (and not “Zigbee on the tablet”)
Zigbee requires a coordinator and mesh management. Tablets/laptops are only UI clients. The gateway is the “local brain” that:
- Maintains Zigbee network
- Buffers data when internet is down
- Sends telemetry securely to cloud

---

## PART 49 — Should We Use Home Assistant?

### Recommendation
**Do not base the commercial gateway on Home Assistant as the primary runtime.**

Reason:
- HA adds UI, plugins, and complexity you don’t need
- Support burden increases
- Restaurants will break it

### When HA is acceptable
- As an **optional integration** for power users already running HA
- Not as the core product

Your product should ship its own minimal gateway runtime.

---

## PART 50 — Gateway Architecture Options

### Option A (Recommended): Minimal Linux Gateway + Zigbee2MQTT + MQTT Bridge

**Components**
- Hardware: small Linux box (Raspberry Pi / industrial SBC) + Zigbee coordinator dongle
- Zigbee stack: Zigbee2MQTT
- Messaging: local MQTT broker (Mosquitto)
- Bridge service: small agent that:
  - subscribes to MQTT topics
  - normalises data
  - buffers offline
  - posts to cloud ingestion API

**Pros**
- Stable, scalable
- Headless (no UI)
- Easy remote management

**Cons**
- You must own device management (updates, monitoring)

---

### Option B: Vendor Hub (e.g., off-the-shelf bridge)

**Not recommended** for commercial product because:
- You depend on vendor app/cloud
- Firmware changes break you
- Hard to support at scale

---

## PART 51 — “Smooth” App Management (What the App Must Do)

To make the experience smooth, the *app* must hide all Zigbee complexity:

### App Responsibilities
- Show gateway status (online/offline)
- Show sensor health (reporting, battery)
- Pair sensors via QR flow
- Map sensor → asset (Freezer 1)
- Set thresholds from Safe Catering Plan
- Alerting and incident workflows

### What the App Must NOT Do
- Debug Zigbee routing
- Expose technical pairing screens

That stays on the gateway and is handled by your fleet management.

---

## PART 52 — Manufacturing & Provisioning Flow (Zero-Touch)

### Factory / Pre-Config Steps
1. Flash OS image (immutable base)
2. Install gateway stack (Z2M + MQTT + Bridge agent)
3. Embed device certificate + unique device ID
4. Print QR code on gateway (device ID)
5. Optional: pre-pair 1–2 sensors (starter kit)

### Customer Setup
1. Plug power + Ethernet
2. On tablet: “Add Gateway” → scan QR
3. Gateway appears in “Site Hardware”
4. Pair sensors (join mode auto)

---

## PART 53 — Remote Fleet Management (Required for Scale)

Minimum needed:
- OTA updates (signed)
- Heartbeat monitoring
- Remote logs
- Remote restart of services

Without fleet management, hardware becomes unscalable.

---

## PART 54 — Technical Spec Summary (For Build)

### Gateway Software Services
- zigbee2mqtt
- mosquitto
- gateway-agent (your code)

### gateway-agent responsibilities
- Provisioning handshake with cloud
- MQTT subscription + validation
- Offline buffering (disk queue)
- Retry policies + backoff
- Secure TLS connection
- Device health metrics

### Cloud Ingestion
- Device auth via certificate
- Write telemetry to time-series store
- Emit events to compliance engine (incident workflows)

---

## PART 55 — Vibe Coding AI Instructions (Build Agent Prompt)

Use this as the instruction block for an AI coding agent.

### Product Goal
Build a tablet-first PWA + backend for an Irish restaurant compliance platform that:
- Digitises Safe Catering Pack workflows
- Automates temperature logging via a Zigbee gateway
- Minimises kitchen data entry (one-tap, QR)
- Produces inspection-proof exports

### UX Non-Negotiables
- No typing in kitchen flows
- <10 seconds per task
- Offline-first
- Kiosk mode supported

### Core Modules to Implement
1. Multi-tenant core
2. Kiosk screens (K-01..K-08)
3. Manager screens (M-01..M-06)
4. Compliance log engine (append-only)
5. Incident engine
6. Hardware management UI
7. Gateway ingestion API
8. Export generator

### Data Model (High Level)
- tenants
- sites
- assets (freezer/fridge/stations)
- sensors
- telemetry
- compliance_events (append-only)
- incidents
- recipes + ingredients + allergens

### Implementation Constraints
- Use Postgres with strict tenant isolation (RLS)
- Append-only logs for compliance evidence
- Time-series table or extension for telemetry
- Event-driven processing for incidents

### Build Plan
- Start with MVP: manual logs + exports + kiosk
- Add gateway ingestion next
- Add incidents and thresholds
- Add allergens

### Code Quality Requirements
- Type-safe APIs
- Robust error handling
- Idempotent ingestion
- Sync conflict handling

### Deliverables
- Architecture diagram (text)
- API endpoints list
- Database schema migrations
- PWA routes and components
- Test plan

