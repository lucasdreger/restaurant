# Kitchen Compliance - User Stories & Requirements

> **Version**: 1.0.0  
> **Last Updated**: January 2026  
> **Document Type**: Product Requirements & User Stories  
> **HACCP Framework**: FSAI Ireland (Food Safety Authority of Ireland)

---

## Table of Contents

1. [Personas](#personas)
2. [Epic Overview](#epic-overview)
3. [EP01: Authentication & Onboarding](#ep01-authentication--onboarding)
4. [EP02: Cooling Process Management (FSAI SC3)](#ep02-cooling-process-management-fsai-sc3)
5. [EP03: Temperature Monitoring (FSAI SC2)](#ep03-temperature-monitoring-fsai-sc2)
6. [EP04: Goods Receipt & Delivery (FSAI SC1)](#ep04-goods-receipt--delivery-fsai-sc1)
7. [EP05: Cleaning & Sanitation (FSAI SC5)](#ep05-cleaning--sanitation-fsai-sc5)
8. [EP06: Staff Training Records (FSAI SC7)](#ep06-staff-training-records-fsai-sc7)
9. [EP07: Hot Holding (FSAI SC4)](#ep07-hot-holding-fsai-sc4)
10. [EP08: Compliance Dashboard & Reports](#ep08-compliance-dashboard--reports)
11. [EP09: Voice-First Interface](#ep09-voice-first-interface)
12. [EP10: Multi-Venue Management](#ep10-multi-venue-management)
13. [EP11: Menu Engineering & Food Costing](#ep11-menu-engineering--food-costing)
14. [EP12: Offline-First Architecture](#ep12-offline-first-architecture)
15. [EP13: Settings & Configuration](#ep13-settings--configuration)
16. [EP14: Audit Trail & Data Integrity](#ep14-audit-trail--data-integrity)
17. [Appendix A: FSAI Compliance Requirements](#appendix-a-fsai-compliance-requirements)
18. [Appendix B: Temperature Standards](#appendix-b-temperature-standards)
19. [Appendix C: Glossary](#appendix-c-glossary)

---

## Personas

### 👨‍🍳 Staff (Kitchen Porter / Line Cook)
**Profile**: Entry-level kitchen worker, often non-native English speaker, works with gloves, limited tech familiarity.

| Attribute | Description |
|-----------|-------------|
| **Primary Goals** | Complete tasks quickly, avoid mistakes, pass compliance checks |
| **Pain Points** | Complex forms, small touch targets, remembering procedures |
| **Technical Comfort** | Low - prefers visual/audio guidance over text |
| **Access Level** | Basic logging, cannot override or delete records |
| **Typical Tasks** | Log cooling, record temperatures, mark cleaning complete |
| **Device Usage** | Shared kiosk tablet, often with wet/gloved hands |
| **Language** | May require multi-language support (Irish, Polish, Spanish) |

### 👨‍🍳 Chef (Head Chef / Sous Chef)
**Profile**: Experienced culinary professional, manages kitchen operations, responsible for food quality and safety.

| Attribute | Description |
|-----------|-------------|
| **Primary Goals** | Maintain food safety, optimize kitchen efficiency, train staff |
| **Pain Points** | Paperwork burden, staff compliance gaps, equipment failures |
| **Technical Comfort** | Medium - comfortable with tablets, prefers efficiency |
| **Access Level** | Full logging, can start/close sessions, approve exceptions |
| **Typical Tasks** | Monitor active cooling, handle corrective actions, review daily logs |
| **Device Usage** | Personal tablet or shared kiosk |
| **Responsibilities** | Sign off on compliance, manage food prep schedules |

### 📊 Manager (General Manager / Operations Manager)
**Profile**: Business-focused role, responsible for compliance, costs, and multi-venue operations.

| Attribute | Description |
|-----------|-------------|
| **Primary Goals** | Ensure audit-readiness, minimize waste, control costs |
| **Pain Points** | Lack of visibility, inconsistent compliance, report generation |
| **Technical Comfort** | High - uses multiple software systems daily |
| **Access Level** | Full system access, reporting, settings, user management |
| **Typical Tasks** | Review compliance scores, generate reports, manage venues |
| **Device Usage** | Desktop, laptop, mobile phone |
| **Responsibilities** | HACCP plan owner, inspector liaison, staff scheduling |

### 🔍 Inspector (EHO / FSAI Auditor)
**Profile**: External regulatory official conducting food safety inspections.

| Attribute | Description |
|-----------|-------------|
| **Primary Goals** | Verify compliance, identify risks, enforce regulations |
| **Pain Points** | Incomplete records, illegible handwriting, missing timestamps |
| **Technical Comfort** | Variable - some prefer paper, others digital |
| **Access Level** | Read-only access to compliance records and audit trail |
| **Typical Tasks** | Review historical logs, verify corrective actions, check calibration |
| **Device Usage** | Own tablet/clipboard, may request printed reports |
| **Requirements** | Immutable records, clear timestamps, staff identification |

---

## Epic Overview

| Epic | Description | Status | Priority |
|------|-------------|--------|----------|
| EP01 | Authentication & Onboarding | 🚧 Partial | P1 |
| EP02 | Cooling Process Management (SC3) | ✅ Implemented | P1 |
| EP03 | Temperature Monitoring (SC2) | 🚧 Partial | P1 |
| EP04 | Goods Receipt & Delivery (SC1) | ✅ Implemented | P1 |
| EP05 | Cleaning & Sanitation (SC5) | 🚧 Partial | P2 |
| EP06 | Staff Training Records (SC7) | 🚧 Partial | P2 |
| EP07 | Hot Holding (SC4) | ❌ Not Started | P2 |
| EP08 | Compliance Dashboard & Reports | ✅ Implemented | P1 |
| EP09 | Voice-First Interface | 🚧 Partial | P2 |
| EP10 | Multi-Venue Management | 🚧 Partial | P3 |
| EP11 | Menu Engineering & Food Costing | ✅ Implemented | P3 |
| EP12 | Offline-First Architecture | ✅ Implemented | P1 |
| EP13 | Settings & Configuration | ✅ Implemented | P2 |
| EP14 | Audit Trail & Data Integrity | 🚧 Partial | P1 |

**Legend**:
- ✅ Implemented - Feature is complete and functional
- 🚧 Partial - Feature exists but needs enhancement
- ❌ Not Started - Feature is planned but not yet built

---

## EP01: Authentication & Onboarding

### US-01.01: User Registration with Google SSO ✅
**As a** Manager  
**I want to** register using my Google account  
**So that** I can quickly set up my account without creating new credentials

**Status**: ✅ Implemented

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | User can click "Sign Up with Google" button on landing page | ✅ |
| 2 | Google OAuth popup appears and allows account selection | ✅ |
| 3 | After Google auth, user is redirected to onboarding questionnaire | ✅ |
| 4 | A `profiles` record is created in Supabase with `auth.uid()` | ✅ |
| 5 | User's Google display name and email are pre-populated | ✅ |
| 6 | If user already exists, redirect to dashboard instead of onboarding | ✅ |
| 7 | OAuth tokens are stored securely (not in localStorage) | ✅ |
| 8 | Error handling shows user-friendly message if Google auth fails | ✅ |
| 9 | Analytics event fired: `user_registered` with method=`google` | ❌ |
| 10 | GDPR consent checkbox required before registration completes | ❌ |

**Technical Notes**:
- Uses Supabase Auth with Google OAuth provider
- Redirect URL must be whitelisted in Google Cloud Console
- Profile created via database trigger `handle_new_user()`

---

### US-01.02: Email/Password Registration ✅
**As a** Manager  
**I want to** register using email and password  
**So that** I have an alternative to social login

**Status**: ✅ Implemented

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | User can enter email and password on sign-up form | ✅ |
| 2 | Password must be minimum 8 characters with 1 number | ✅ |
| 3 | Email validation prevents invalid formats | ✅ |
| 4 | Confirmation email sent to verify email address | ✅ |
| 5 | User cannot access app until email is verified | ✅ |
| 6 | "Resend verification" option available | ❌ |
| 7 | Password strength indicator shown during input | ❌ |
| 8 | Rate limiting prevents brute force registration | ✅ |
| 9 | Duplicate email shows "Account already exists" message | ✅ |
| 10 | Terms of Service and Privacy Policy links displayed | ❌ |

---

### US-01.03: Onboarding Questionnaire ✅
**As a** new Manager  
**I want to** complete a setup questionnaire  
**So that** the system is configured for my venue type

**Status**: ✅ Implemented

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | Questionnaire appears after first login | ✅ |
| 2 | Step 1: Collect venue name (required, 2-100 characters) | ✅ |
| 3 | Step 2: Select venue type (Restaurant, Café, Hotel, Hospital, School, Other) | ✅ |
| 4 | Step 3: Select primary region/country (IE, UK, US, DE, etc.) | ✅ |
| 5 | Step 4: Estimated daily covers (Small <50, Medium 50-150, Large 150+) | ✅ |
| 6 | Step 5: Which features are most important (multi-select: Cooling, Temps, Cleaning, Training, OCR) | ❌ |
| 7 | Progress indicator shows current step (e.g., "Step 2 of 5") | ✅ |
| 8 | "Back" button allows editing previous answers | ✅ |
| 9 | "Skip for now" option available (with warning about limited features) | ❌ |
| 10 | On completion, create `sites` record with collected data | ✅ |
| 11 | On completion, create default `staff_members` with current user as Manager | ❌ |
| 12 | On completion, create default `food_item_presets` for venue type | ❌ |
| 13 | On completion, redirect to Dashboard with welcome message | ✅ |
| 14 | If user exits mid-flow, resume from last step on next login | ❌ |
| 15 | Data saved to `profiles.onboarding_data` JSONB field | ✅ |

**Technical Notes**:
- Region selection determines which HACCP schemas to load (IE → FSAI, UK → FSA)
- Venue type influences default presets and compliance requirements

---

### US-01.04: User Sign-In ✅
**As a** returning user  
**I want to** sign in to my account  
**So that** I can access my compliance data

**Status**: ✅ Implemented

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | User can sign in with Google SSO | ✅ |
| 2 | User can sign in with email/password | ✅ |
| 3 | "Remember me" checkbox keeps session for 30 days | ❌ |
| 4 | "Forgot password" link sends reset email | ✅ |
| 5 | After 5 failed attempts, show CAPTCHA | ❌ |
| 6 | After 10 failed attempts, lock account for 30 minutes | ❌ |
| 7 | Session persists across page refreshes | ✅ |
| 8 | Session expires after 24 hours of inactivity | ✅ |
| 9 | Multiple simultaneous sessions allowed (up to 5 devices) | ✅ |
| 10 | "Sign out" button clears session and redirects to landing | ✅ |
| 11 | If user has no completed onboarding, redirect to questionnaire | ✅ |
| 12 | Last login timestamp updated in profile | ❌ |

---

### US-01.05: Staff PIN Login (Kiosk Mode) ❌
**As a** Staff member  
**I want to** log in with a quick PIN code  
**So that** I can identify myself without typing credentials

**Status**: ❌ Not Started

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | Kiosk mode shows numeric PIN pad (4-6 digits) | ❌ |
| 2 | PIN is unique per staff member within a site | ❌ |
| 3 | PIN entry accepts touch input on large buttons (100px+) | ❌ |
| 4 | Correct PIN identifies staff member for session | ❌ |
| 5 | Incorrect PIN shows error and allows retry | ❌ |
| 6 | After 3 incorrect attempts, lock PIN for 5 minutes | ❌ |
| 7 | Staff name and avatar shown after successful PIN entry | ❌ |
| 8 | PIN session timeout after 5 minutes of inactivity | ❌ |
| 9 | Manager can reset any staff PIN from settings | ❌ |
| 10 | PIN is stored as bcrypt hash in database | ❌ |
| 11 | Analytics event: `staff_login` with `staff_id` | ❌ |
| 12 | Optional: Allow fingerprint/Face ID instead of PIN | ❌ |

**HACCP Requirement**: Staff identification is required for audit trail (FSAI Guidance Note 1, Section 4.2)

---

### US-01.06: Password Reset Flow ✅
**As a** user who forgot their password  
**I want to** reset my password via email  
**So that** I can regain access to my account

**Status**: ✅ Implemented (via Supabase)

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | "Forgot Password" link on sign-in page | ✅ |
| 2 | User enters email address | ✅ |
| 3 | If email exists, send reset link (valid for 1 hour) | ✅ |
| 4 | If email doesn't exist, show same "email sent" message (security) | ✅ |
| 5 | Reset link leads to password change form | ✅ |
| 6 | New password must meet complexity requirements | ✅ |
| 7 | Cannot reuse last 5 passwords | ❌ |
| 8 | All other sessions invalidated after password change | ❌ |
| 9 | Confirmation email sent after successful reset | ❌ |
| 10 | Rate limit: Max 3 reset requests per hour | ✅ |

---

## EP02: Cooling Process Management (FSAI SC3)

> **FSAI Reference**: Schedule C, Section 3 - Cooling of Cooked Foods  
> **Requirement**: Hot food must be cooled from 63°C to 10°C within 2 hours maximum, with critical checkpoint at 90 minutes.

### US-02.01: Start Cooling Session ✅
**As a** Chef  
**I want to** start a cooling timer for cooked food  
**So that** I can track compliance with the 2-hour cooling rule

**Status**: ✅ Implemented

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | "Start Cooling" button visible on dashboard/kiosk home | ✅ |
| 2 | Modal opens with food item selection | ✅ |
| 3 | Food items organized by category (Sauce, Soup, Meat, Vegetable, Other) | ✅ |
| 4 | Common items shown as large, touch-friendly preset buttons | ✅ |
| 5 | "Custom Item" option for unlisted items | ✅ |
| 6 | Custom item allows voice or text input | 🚧 |
| 7 | Optional: Enter start temperature (default: 63°C) | ❌ |
| 8 | Optional: Select staff member from list | 🚧 |
| 9 | Optional: Add batch ID or production notes | ❌ |
| 10 | "Start Timer" button creates cooling session | ✅ |
| 11 | Session record created with `status: 'active'` | ✅ |
| 12 | `started_at` timestamp captured in UTC | ✅ |
| 13 | `soft_due_at` calculated as started_at + 90 minutes | ✅ |
| 14 | `hard_due_at` calculated as started_at + 120 minutes | ✅ |
| 15 | Audio confirmation: "Cooling started for [item name]" | ✅ |
| 16 | Visual confirmation toast notification | ✅ |
| 17 | Session immediately appears in active cooling list | ✅ |
| 18 | Dashboard badge count increments | ✅ |
| 19 | Session synced to cloud if online | ✅ |
| 20 | Session stored in localStorage if offline | ✅ |

**FSAI Compliance**:
- Food must start at 63°C or above (hot holding temperature)
- Time-temperature logging required for HACCP Plan Verification

**Technical Notes**:
```typescript
// Cooling session structure
interface CoolingSession {
  id: string;
  item_name: string;
  item_category: 'sauce' | 'soup' | 'meat' | 'vegetable' | 'other';
  started_at: string; // ISO timestamp
  soft_due_at: string; // +90 minutes
  hard_due_at: string; // +120 minutes
  closed_at?: string;
  status: 'active' | 'completed' | 'discarded' | 'exception';
  start_temperature?: number; // in °C
  end_temperature?: number;
  started_by_id?: string;
  staff_name?: string;
  site_id: string;
  synced: boolean;
}
```

---

### US-02.02: View Active Cooling Sessions ✅
**As a** Staff member  
**I want to** see all items currently cooling  
**So that** I know what needs attention

**Status**: ✅ Implemented

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | Active sessions displayed as cards on dashboard | ✅ |
| 2 | Each card shows: item name, category icon, elapsed time | ✅ |
| 3 | Live countdown timer updates every second | ✅ |
| 4 | Progress bar shows percentage of 90-minute soft limit | ✅ |
| 5 | Card color changes based on status: | ✅ |
| 5a | - Green (0-60 min): Safe zone | ✅ |
| 5b | - Amber (60-90 min): Warning zone | ✅ |
| 5c | - Red (90+ min): Critical zone | ✅ |
| 6 | Pulsing animation on cards approaching soft due | ✅ |
| 7 | Cards sorted by urgency (most urgent first) | ✅ |
| 8 | "Started by: [Name]" shown if staff identified | 🚧 |
| 9 | Batch ID shown if provided | ❌ |
| 10 | Touch/click card to expand details | ❌ |
| 11 | Empty state shows "No active cooling sessions" | ✅ |
| 12 | Badge on navigation shows count of active sessions | ✅ |
| 13 | Sessions persist after page refresh (localStorage) | ✅ |
| 14 | Sessions sync from cloud on reconnection | ✅ |

**Visual Requirements**:
- Card minimum height: 100px (touch-friendly)
- Touch target: Entire card clickable
- Font size: Item name 18px, timer 24px bold
- Status indicators must be visible from 1 meter distance

---

### US-02.03: Soft Due Warning (90 Minutes) ✅
**As a** Chef  
**I want to** receive a warning at 90 minutes  
**So that** I can take action before the hard limit

**Status**: ✅ Implemented

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | At 90 minutes, card changes to amber/warning state | ✅ |
| 2 | Audio alert plays: "Warning: [Item] has been cooling for 90 minutes" | ✅ |
| 3 | Alert plays even if app is in background (if permitted) | ❌ |
| 4 | Toast notification appears with action buttons | ✅ |
| 5 | Action buttons: "Move to Fridge" / "Discard" / "Acknowledge" | 🚧 |
| 6 | If not acknowledged within 5 minutes, repeat alert | ❌ |
| 7 | Acknowledgment logged with timestamp and staff ID | ❌ |
| 8 | Visual pulsing animation on card intensifies | ✅ |
| 9 | Dashboard header shows warning indicator | ✅ |
| 10 | Push notification sent to manager's phone (if configured) | ❌ |

**FSAI Compliance**:
- 90-minute checkpoint is a critical control point (CCP)
- Corrective action must be documented if exceeded

---

### US-02.04: Hard Due Alert (120 Minutes) ✅
**As a** Chef  
**I want to** receive an urgent alert at 120 minutes  
**So that** I know food must be discarded or justified

**Status**: ✅ Implemented

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | At 120 minutes, card changes to red/critical state | ✅ |
| 2 | Urgent audio alert: "CRITICAL: [Item] has exceeded 2-hour cooling limit" | ✅ |
| 3 | Alert repeats every 30 seconds until action taken | ❌ |
| 4 | Full-screen overlay modal appears requiring action | ❌ |
| 5 | Action options: "Discard" / "Request Exception" | 🚧 |
| 6 | "Discard" requires confirmation: "Confirm disposal of [Item]?" | ✅ |
| 7 | "Request Exception" requires manager PIN | ❌ |
| 8 | Exception requires written justification (min 20 characters) | 🚧 |
| 9 | All actions logged with timestamp | ✅ |
| 10 | Compliance score affected if hard due exceeded | ❌ |
| 11 | Email notification sent to manager | ❌ |
| 12 | Item flagged in compliance report | ❌ |

**FSAI Compliance**:
- Food cooled >2 hours is a HACCP deviation
- Must be documented with corrective action
- Repeated violations require HACCP plan review

---

### US-02.05: Close Cooling Session - Move to Fridge ✅
**As a** Staff member  
**I want to** mark an item as moved to refrigeration  
**So that** the cooling record is complete

**Status**: ✅ Implemented

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | "Move to Fridge" action visible on cooling card | ✅ |
| 2 | Action button large enough for gloved finger (80px+) | ✅ |
| 3 | Confirmation modal shows: item name, cooling duration | ✅ |
| 4 | Required: Select destination fridge/chiller | 🚧 |
| 5 | Required: Enter end temperature (if enabled in settings) | ❌ |
| 6 | End temperature must be ≤10°C for compliance | ❌ |
| 7 | If temp >10°C, show warning and request justification | ❌ |
| 8 | Optional: Enter staff name/initials | 🚧 |
| 9 | "Confirm" button closes session | ✅ |
| 10 | Session status updated to `completed` | ✅ |
| 11 | `closed_at` timestamp recorded | ✅ |
| 12 | `end_temperature` recorded if provided | ❌ |
| 13 | `close_action` set to `refrigerated` | ✅ |
| 14 | Total cooling duration calculated and stored | ✅ |
| 15 | Audio confirmation: "Cooling complete. [Item] moved to refrigeration" | ✅ |
| 16 | Success toast notification | ✅ |
| 17 | Card removed from active list | ✅ |
| 18 | Session moved to history | ✅ |
| 19 | Compliance score updated (if within time) | ❌ |
| 20 | Sync to cloud immediately | ✅ |

**FSAI Compliance**:
- End temperature must be recorded for audit trail
- Destination storage location should be documented

---

### US-02.06: Close Cooling Session - Discard ✅
**As a** Staff member  
**I want to** mark an item as discarded  
**So that** food safety is maintained and waste is documented

**Status**: ✅ Implemented

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | "Discard" action visible on cooling card | ✅ |
| 2 | Confirmation modal shows: item name, cooling duration | ✅ |
| 3 | Required: Select reason for discard | ✅ |
| 3a | - Exceeded time limit | ✅ |
| 3b | - Temperature not reached | ✅ |
| 3c | - Quality issue | ✅ |
| 3d | - Contamination suspected | ✅ |
| 3e | - Other (requires note) | ✅ |
| 4 | If "Other" selected, free text field required (min 10 chars) | 🚧 |
| 5 | Required: Estimated quantity wasted (kg or portions) | ❌ |
| 6 | Required: Staff confirmation checkbox | ❌ |
| 7 | "Confirm Discard" button styled as destructive (red) | ✅ |
| 8 | Session status updated to `discarded` | ✅ |
| 9 | `close_action` set to `discarded` | ✅ |
| 10 | `discard_reason` stored | ✅ |
| 11 | Waste value calculated if food cost known | ❌ |
| 12 | Audio confirmation: "Item discarded. Record saved." | ✅ |
| 13 | Card removed from active list | ✅ |
| 14 | Session flagged in waste report | ❌ |
| 15 | Manager notified if high-value item | ❌ |

**FSAI Compliance**:
- All food waste must be documented
- Reason for disposal is audit requirement

---

### US-02.07: Exception Request with Manager Override ❌
**As a** Chef  
**I want to** request an exception for a late cooling  
**So that** I can document why food was kept beyond limits

**Status**: ❌ Not Started

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | "Request Exception" button available after hard due | ❌ |
| 2 | Exception form requires: reason, justification, manager approval | ❌ |
| 3 | Reason options: "Blast chiller used", "Ice bath applied", "Customer request", "Other" | ❌ |
| 4 | Justification text field required (min 30 characters) | ❌ |
| 5 | Manager PIN required to approve | ❌ |
| 6 | Alternatively, manager can approve via phone notification | ❌ |
| 7 | If approved, session status set to `exception` | ❌ |
| 8 | Exception reason and approver stored in record | ❌ |
| 9 | Exception clearly marked in audit report | ❌ |
| 10 | Exception count tracked per site per month | ❌ |
| 11 | If >5 exceptions/month, trigger HACCP review alert | ❌ |
| 12 | Photo evidence option for supporting documentation | ❌ |

**FSAI Compliance**:
- Exceptions must be documented with justification
- Pattern of exceptions requires HACCP plan revision

---

### US-02.08: View Cooling History ✅
**As a** Manager  
**I want to** review past cooling records  
**So that** I can prepare for inspections

**Status**: ✅ Implemented

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | History screen accessible from navigation | ✅ |
| 2 | List shows all completed/discarded sessions | ✅ |
| 3 | Each record shows: item, date/time, duration, status, staff | ✅ |
| 4 | Status badges: ✅ Compliant, ⚠️ Warning, ❌ Non-Compliant | ✅ |
| 5 | Filter by date range | ✅ |
| 6 | Filter by status (all, compliant, non-compliant) | 🚧 |
| 7 | Filter by item category | ❌ |
| 8 | Filter by staff member | ❌ |
| 9 | Search by item name | ❌ |
| 10 | Sort by date (newest/oldest) | ✅ |
| 11 | Sort by duration (shortest/longest) | ❌ |
| 12 | Click record to view full details | ❌ |
| 13 | Detail view shows: all timestamps, temperature data, staff, notes | ❌ |
| 14 | Records cannot be edited or deleted (immutable) | ✅ |
| 15 | Export history to CSV | ✅ |
| 16 | Export history to PDF with branding | 🚧 |
| 17 | Pagination for large datasets (50 records per page) | ❌ |
| 18 | Load time <3 seconds for 1000 records | ❌ |

---

### US-02.09: Food Item Presets ✅
**As a** Manager  
**I want to** configure common food items  
**So that** staff can quickly select them

**Status**: ✅ Implemented (default presets)

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | Default presets created on site setup | ✅ |
| 2 | Presets organized by category | ✅ |
| 3 | Each preset has: name, icon, category, default temp | 🚧 |
| 4 | Manager can add custom presets | ❌ |
| 5 | Manager can edit preset names | ❌ |
| 6 | Manager can delete presets (soft delete) | ❌ |
| 7 | Manager can reorder presets (drag-and-drop) | ❌ |
| 8 | Presets support custom icons/emojis | ❌ |
| 9 | Presets can be site-specific or shared across venues | ❌ |
| 10 | Maximum 50 presets per category | ❌ |
| 11 | Preset usage analytics (most/least used) | ❌ |
| 12 | Import presets from CSV | ❌ |
| 13 | Export presets to CSV | ❌ |

**Default Presets**:
| Category | Items |
|----------|-------|
| Sauces | Bolognese, Curry, Gravy, Tomato, Cream, Cheese |
| Soups | Vegetable, Tomato, Chicken, Seafood, Minestrone |
| Meats | Chicken, Beef, Lamb, Pork, Turkey, Fish |
| Vegetables | Rice, Pasta, Potatoes, Mixed Veg, Beans |
| Other | Stock, Custard, Rice Pudding |

---

### US-02.10: Cooling Metrics Dashboard ✅
**As a** Manager  
**I want to** see cooling performance metrics  
**So that** I can identify trends and issues

**Status**: ✅ Implemented

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | Dashboard shows total sessions this week/month | ✅ |
| 2 | Compliance rate percentage displayed prominently | ✅ |
| 3 | Average cooling time displayed | ✅ |
| 4 | Trend indicator (up/down) compared to previous period | ✅ |
| 5 | Bar chart showing sessions by day of week | ✅ |
| 6 | Pie chart showing distribution by category | ✅ |
| 7 | List of non-compliant sessions for review | 🚧 |
| 8 | Waste value calculation (if food costs entered) | ❌ |
| 9 | Best/worst performing staff (if identified) | ❌ |
| 10 | Peak hours analysis | ❌ |
| 11 | Date range selector (7/30/90 days, custom) | 🚧 |
| 12 | Data refreshes automatically every 5 minutes | ❌ |
| 13 | "Drill down" to individual records | ❌ |

---

## EP03: Temperature Monitoring (FSAI SC2)

> **FSAI Reference**: Schedule C, Section 2 - Cold Holding  
> **Requirement**: Chilled food must be stored at 5°C or below. Frozen food at -18°C or below.

### US-03.01: Record Fridge Temperature ✅
**As a** Staff member  
**I want to** log the temperature of refrigeration units  
**So that** we maintain cold chain compliance

**Status**: ✅ Implemented

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | "Log Temperature" action on compliance screen | ✅ |
| 2 | Select refrigeration unit from list | ✅ |
| 3 | Units defined in settings (Fridge 1, Walk-in Chiller, etc.) | ❌ |
| 4 | Enter temperature reading (numeric input) | ✅ |
| 5 | Temperature input supports decimal (e.g., 3.5°C) | ✅ |
| 6 | Unit defaults to °C, option for °F | ❌ |
| 7 | Time of check auto-populated (editable) | ✅ |
| 8 | Staff name/initials field | ✅ |
| 9 | "Unit clean & organized?" checkbox | ✅ |
| 10 | Visual indicator if temp out of range: | ✅ |
| 10a | - Green: 0-5°C (compliant) | ✅ |
| 10b | - Amber: 5-8°C (warning) | ✅ |
| 10c | - Red: >8°C (critical) | ✅ |
| 11 | If >5°C, corrective action prompt appears | 🚧 |
| 12 | Corrective actions: "Check door seal", "Move food", "Call maintenance" | ✅ |
| 13 | Save button creates `fridge_temp_logs` record | ✅ |
| 14 | Record includes: unit_id, temperature, timestamp, staff, actions | ✅ |
| 15 | Success confirmation and auto-close | ✅ |

**FSAI Compliance**:
- Temperature logs must be taken at least twice daily
- Out-of-range readings require documented corrective action

---

### US-03.02: Refrigeration Unit Configuration ❌
**As a** Manager  
**I want to** define refrigeration units  
**So that** staff can log temperatures correctly

**Status**: ❌ Not Started

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | Settings page has "Refrigeration Units" section | ❌ |
| 2 | Add new unit: name, type (fridge/freezer/chiller), target temp | ❌ |
| 3 | Unit types determine acceptable range: | ❌ |
| 3a | - Fridge: 0-5°C | ❌ |
| 3b | - Freezer: ≤-18°C | ❌ |
| 3c | - Blast Chiller: -18 to -40°C | ❌ |
| 3d | - Display Fridge: 0-5°C | ❌ |
| 4 | Custom acceptable range override | ❌ |
| 5 | Unit location field (Kitchen, Storage, Front of House) | ❌ |
| 6 | Asset ID / serial number field | ❌ |
| 7 | Last calibration date field | ❌ |
| 8 | Calibration reminder (every 3/6/12 months) | ❌ |
| 9 | Unit status: Active / Inactive / Maintenance | ❌ |
| 10 | Delete unit (soft delete, preserves historical logs) | ❌ |
| 11 | Maximum 20 units per site | ❌ |

---

### US-03.03: Temperature Logging Schedule ❌
**As a** Manager  
**I want to** define when temperatures should be logged  
**So that** compliance is consistent

**Status**: ❌ Not Started

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | Define logging frequency per unit (e.g., every 4 hours) | ❌ |
| 2 | Define specific times (e.g., 8am, 12pm, 6pm, 10pm) | ❌ |
| 3 | Different schedules for weekdays vs weekends | ❌ |
| 4 | Grace period before overdue (e.g., +30 minutes) | ❌ |
| 5 | Dashboard shows "due now" indicator when log needed | ❌ |
| 6 | Alert if scheduled log not completed | ❌ |
| 7 | Report shows compliance rate by schedule | ❌ |
| 8 | FSAI recommends minimum 2 checks per day | ❌ |

---

### US-03.04: Temperature Alert Threshold Breaches ❌
**As a** Chef  
**I want to** be alerted when fridge temperature is out of range  
**So that** I can take corrective action

**Status**: ❌ Not Started

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | If logged temp >5°C (fridge), immediate alert | ❌ |
| 2 | If logged temp >-15°C (freezer), immediate alert | ❌ |
| 3 | Alert includes: unit name, temperature, suggested actions | ❌ |
| 4 | Corrective action must be selected before dismissing | ❌ |
| 5 | Photo evidence option for supporting documentation | ❌ |
| 6 | Follow-up check reminder in 1 hour | ❌ |
| 7 | Manager notification if critical (>8°C) | ❌ |
| 8 | If not resolved in 2 hours, escalate alert | ❌ |
| 9 | All alerts logged in `corrective_actions` table | ❌ |
| 10 | Historical alert analysis in reports | ❌ |

**FSAI Compliance**:
- Food stored >8°C for >2 hours may need to be discarded
- Corrective actions are audit requirements

---

### US-03.05: Bluetooth Probe Integration ❌
**As a** Chef  
**I want to** read temperature from a Bluetooth probe  
**So that** I get accurate readings without manual entry

**Status**: ❌ Not Started (Future Feature)

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | Settings page has "Pair Bluetooth Probe" option | ❌ |
| 2 | Scan for nearby Bluetooth thermometers | ❌ |
| 3 | Support for ThermoWorks, Meater, and generic BLE probes | ❌ |
| 4 | Paired probe shows in unit selection | ❌ |
| 5 | "Read from probe" button fetches current temperature | ❌ |
| 6 | Temperature auto-populates in form | ❌ |
| 7 | Manual override still available | ❌ |
| 8 | Connection status indicator | ❌ |
| 9 | Calibration offset setting per probe | ❌ |
| 10 | Battery level indicator | ❌ |

**Technical Notes**:
- Use Web Bluetooth API (Chrome/Edge only)
- Fallback to manual entry on unsupported browsers

---

### US-03.06: View Temperature History ❌
**As a** Inspector  
**I want to** review temperature logs for all units  
**So that** I can verify cold chain compliance

**Status**: ❌ Not Started

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | Temperature history accessible from Compliance screen | ❌ |
| 2 | Filter by refrigeration unit | ❌ |
| 3 | Filter by date range | ❌ |
| 4 | Filter by status (all, in-range, out-of-range) | ❌ |
| 5 | Line chart showing temperature over time | ❌ |
| 6 | Chart shows acceptable range as highlighted zone | ❌ |
| 7 | Out-of-range readings highlighted in red | ❌ |
| 8 | Hover/tap on point shows full details | ❌ |
| 9 | Export to CSV with all fields | ❌ |
| 10 | Export to PDF formatted for FSAI submission | ❌ |
| 11 | Calculate compliance percentage per unit | ❌ |
| 12 | Show average temperature per unit | ❌ |

---

## EP04: Goods Receipt & Delivery (FSAI SC1)

> **FSAI Reference**: Schedule C, Section 1 - Receipt of Goods  
> **Requirement**: All deliveries must be inspected for temperature, quality, and documentation.

### US-04.01: Log Delivery Note via OCR ✅
**As a** Staff member  
**I want to** scan a delivery note with my camera  
**So that** I can quickly capture supplier information

**Status**: ✅ Implemented

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | "Goods Receipt" section accessible from navigation | ✅ |
| 2 | "Scan Delivery Note" button opens camera | ✅ |
| 3 | Camera viewfinder with document alignment guide | 🚧 |
| 4 | Capture button takes photo | ✅ |
| 5 | Preview shows captured image | ✅ |
| 6 | "Scan Another Page" option for multi-page documents | ✅ |
| 7 | Multi-page support: up to 10 pages per delivery | ✅ |
| 8 | Each page thumbnail shown in review | ✅ |
| 9 | Remove individual pages before processing | ✅ |
| 10 | "Process All Pages" sends to OCR | ✅ |
| 11 | OCR extracts: supplier name, delivery date, items, PO number | ✅ |
| 12 | Extracted data populates form fields | ✅ |
| 13 | Confidence indicator per field (high/medium/low) | ❌ |
| 14 | Manual correction allowed for all fields | ✅ |
| 15 | Original image stored with record | ✅ |
| 16 | Processing time <5 seconds per page | 🚧 |
| 17 | Offline mode: save image, process when online | ❌ |

**Technical Notes**:
- OCR via OpenAI GPT-4 Vision or Google Vision API
- Provider configurable in settings
- Cost: ~$0.01-0.03 per image

---

### US-04.02: Delivery Item Temperature Check ✅
**As a** Staff member  
**I want to** record temperatures of delivered items  
**So that** I verify cold chain was maintained

**Status**: ✅ Implemented

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | Delivery form has "Add Item" section | ✅ |
| 2 | Enter item description (free text) | ✅ |
| 3 | Select temperature category: | ✅ |
| 3a | - Ambient (≤25°C) | ✅ |
| 3b | - Chilled (0-5°C) | ✅ |
| 3c | - Frozen (≤-18°C) | ✅ |
| 4 | Enter measured temperature | ✅ |
| 5 | Temperature validated against category limits | ✅ |
| 6 | Group temperature input for multiple items in same category | ✅ |
| 7 | Visual indicator if temp out of range | ✅ |
| 8 | If out of range, require action: Accept with note / Reject / Contact supplier | ✅ |
| 9 | Rejection requires reason (quality, temperature, damage, quantity) | ✅ |
| 10 | Photo evidence option for rejections | ❌ |
| 11 | All items required before completing delivery record | ✅ |

**FSAI Temperature Standards**:
| Category | Acceptable Range | Action Required |
|----------|------------------|-----------------|
| Ambient | ≤25°C | None |
| Chilled | 0-5°C | Reject if >8°C |
| Frozen | ≤-18°C | Reject if >-15°C |

---

### US-04.03: Supplier Management ❌
**As a** Manager  
**I want to** maintain a list of approved suppliers  
**So that** staff can quickly select them during delivery

**Status**: ❌ Not Started

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | Supplier list in Settings | ❌ |
| 2 | Add supplier: name, contact, email, phone | ❌ |
| 3 | Supplier certification documents upload | ❌ |
| 4 | Certification expiry tracking | ❌ |
| 5 | Alert when certification expires | ❌ |
| 6 | Supplier rating based on delivery history | ❌ |
| 7 | Delivery history per supplier | ❌ |
| 8 | Block/unblock supplier | ❌ |
| 9 | Import suppliers from CSV | ❌ |
| 10 | Autocomplete supplier name during delivery | ❌ |

**FSAI Requirement**: Approved supplier list must be maintained

---

### US-04.04: Delivery Quality Assessment ❌
**As a** Staff member  
**I want to** record quality observations  
**So that** issues are documented

**Status**: ❌ Not Started

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | Quality checklist per delivery | ❌ |
| 2 | Check: Packaging intact | ❌ |
| 3 | Check: Vehicle clean | ❌ |
| 4 | Check: Labels clear/readable | ❌ |
| 5 | Check: Use-by dates acceptable | ❌ |
| 6 | Check: Quantity matches order | ❌ |
| 7 | Overall quality rating (1-5 stars) | ❌ |
| 8 | Notes field for observations | ❌ |
| 9 | Photo evidence for issues | ❌ |
| 10 | Auto-flag suppliers with repeated issues | ❌ |

---

### US-04.05: View Delivery History ❌
**As a** Manager  
**I want to** review past deliveries  
**So that** I can identify supplier issues

**Status**: ❌ Not Started

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | Delivery history list view | ❌ |
| 2 | Filter by date range | ❌ |
| 3 | Filter by supplier | ❌ |
| 4 | Filter by status (accepted, partial, rejected) | ❌ |
| 5 | Search by PO number | ❌ |
| 6 | View full delivery details | ❌ |
| 7 | View attached images | ❌ |
| 8 | Export to CSV/PDF | ❌ |
| 9 | Supplier performance report | ❌ |

---

## EP05: Cleaning & Sanitation (FSAI SC5)

> **FSAI Reference**: Schedule C, Section 5 - Cleaning & Disinfection  
> **Requirement**: Written cleaning schedules must be maintained with verification records.

### US-05.01: Daily Cleaning Schedule ✅
**As a** Staff member  
**I want to** view today's cleaning tasks  
**So that** I know what needs to be cleaned

**Status**: 🚧 Partial (Schema exists, no schedule UI)

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | Cleaning Schedule accessible from navigation | ❌ |
| 2 | Daily view shows all tasks for today | ❌ |
| 3 | Tasks organized by time (AM, PM, Close) | ❌ |
| 4 | Each task shows: area, method, chemicals, frequency | ❌ |
| 5 | Checkbox to mark task complete | ❌ |
| 6 | Completion requires: time, staff initials | ❌ |
| 7 | Optional manager verification checkbox | ✅ |
| 8 | Progress indicator (e.g., "8/12 tasks complete") | ❌ |
| 9 | Overdue tasks highlighted | ❌ |
| 10 | Alert if critical task not completed by deadline | ❌ |

---

### US-05.02: Log Cleaning Task Completion ✅
**As a** Staff member  
**I want to** record that I've cleaned an area  
**So that** there's a compliance record

**Status**: ✅ Implemented (via SchemaRenderer)

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | Select area/equipment from predefined list | ✅ |
| 2 | Areas include: Prep Surfaces, Sinks, Floors, Walk-in Fridge, Cookline, Dishwasher | ✅ |
| 3 | Select chemicals used from list | ✅ |
| 4 | Chemical list: Sanitizer D10, Degreaser, Floor Cleaner, Hot Soapy Water | ✅ |
| 5 | Cleaning method field (default: "Clean, Rinse, Sanitize, Air Dry") | ✅ |
| 6 | Time completed (auto-populated, editable) | ✅ |
| 7 | Staff name/initials | ✅ |
| 8 | Manager verification checkbox | ✅ |
| 9 | If not verified, corrective actions shown | ✅ |
| 10 | Corrective actions: "Reclean area immediately", "Retrain staff" | ✅ |
| 11 | Save creates compliance log record | ✅ |
| 12 | Record stored in `compliance_logs` with schema_id | ✅ |

---

### US-05.03: Cleaning Schedule Configuration ❌
**As a** Manager  
**I want to** define cleaning schedules  
**So that** tasks are appropriate for our venue

**Status**: ❌ Not Started

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | Settings page has "Cleaning Schedule" configuration | ❌ |
| 2 | Add cleaning task: area, frequency, method, chemicals | ❌ |
| 3 | Frequency options: Daily, Weekly, Monthly, After Each Use | ❌ |
| 4 | Assign tasks to specific times or shifts | ❌ |
| 5 | Assign responsible role (any staff, chef, manager) | ❌ |
| 6 | Set criticality level (required, recommended) | ❌ |
| 7 | Import FSAI template schedule | ❌ |
| 8 | Duplicate schedule to other venues | ❌ |
| 9 | Version history for schedule changes | ❌ |
| 10 | Export schedule to PDF | ❌ |

---

### US-05.04: Cleaning Chemical Inventory ❌
**As a** Manager  
**I want to** track cleaning chemical stock  
**So that** we never run out

**Status**: ❌ Not Started

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | Chemical inventory list | ❌ |
| 2 | Track: name, quantity, unit, supplier | ❌ |
| 3 | Safety data sheet (SDS) upload per chemical | ❌ |
| 4 | Low stock alert threshold | ❌ |
| 5 | Usage tracking from cleaning logs | ❌ |
| 6 | Reorder suggestions | ❌ |
| 7 | Expiry date tracking | ❌ |
| 8 | COSHH compliance documentation | ❌ |

---

### US-05.05: Deep Clean Scheduling ❌
**As a** Manager  
**I want to** schedule periodic deep cleans  
**So that** we maintain hygiene standards

**Status**: ❌ Not Started

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | Deep clean schedule separate from daily | ❌ |
| 2 | Set recurring frequency (weekly, monthly, quarterly) | ❌ |
| 3 | Assign to specific dates | ❌ |
| 4 | Checklist of deep clean tasks | ❌ |
| 5 | Photo evidence required for completion | ❌ |
| 6 | Manager sign-off required | ❌ |
| 7 | Reminder notifications before due date | ❌ |
| 8 | Historical deep clean records | ❌ |

---

## EP06: Staff Training Records (FSAI SC7)

> **FSAI Reference**: Schedule C, Section 7 - Training  
> **Requirement**: All food handlers must receive appropriate training, with records maintained.

### US-06.01: Record Training Completion ✅
**As a** Manager  
**I want to** log when staff complete training  
**So that** we have compliance records

**Status**: ✅ Implemented (via SchemaRenderer)

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | Training record form on Compliance screen | ✅ |
| 2 | Select employee from staff list | ✅ |
| 3 | Select training module from list | ✅ |
| 4 | Training modules include: | ✅ |
| 4a | - Level 1 Food Safety (Induction) | ✅ |
| 4b | - Level 2 Food Safety | ✅ |
| 4c | - Allergen Management Awareness | ✅ |
| 4d | - HACCP Principles | ✅ |
| 4e | - Personal Hygiene | ✅ |
| 4f | - Cross Contamination Prevention | ✅ |
| 5 | Trainer/supervisor name | ✅ |
| 6 | Date completed | ✅ |
| 7 | Assessment passed checkbox | ✅ |
| 8 | If not passed, corrective actions shown | ✅ |
| 9 | Corrective actions: "Schedule re-training", "Limit duties" | ✅ |
| 10 | Save creates training record | ✅ |
| 11 | Record linked to staff member | ❌ |

---

### US-06.02: Staff Training Matrix ❌
**As a** Manager  
**I want to** see training status for all staff  
**So that** I can identify gaps

**Status**: ❌ Not Started

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | Training matrix view showing staff vs modules | ❌ |
| 2 | Cell color: green (complete), amber (expiring), red (missing) | ❌ |
| 3 | Click cell to view/add training record | ❌ |
| 4 | Filter by role (all, chef, staff) | ❌ |
| 5 | Filter by training status (all, complete, incomplete) | ❌ |
| 6 | Training expiry tracking (e.g., Level 2 expires after 3 years) | ❌ |
| 7 | Alert when training expiring within 30 days | ❌ |
| 8 | Export matrix to PDF | ❌ |
| 9 | Bulk training entry (multiple staff, same module) | ❌ |

---

### US-06.03: Staff Member Management ❌
**As a** Manager  
**I want to** manage staff profiles  
**So that** training and compliance can be tracked per person

**Status**: ❌ Not Started

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | Staff list in Settings | ❌ |
| 2 | Add staff: name, initials, role, start date | ❌ |
| 3 | Role options: Manager, Chef, Staff | ❌ |
| 4 | Contact details: email, phone | ❌ |
| 5 | Profile photo upload | ❌ |
| 6 | Set kiosk PIN for staff login | ❌ |
| 7 | Active/inactive status | ❌ |
| 8 | View staff training history | ❌ |
| 9 | View staff compliance activity | ❌ |
| 10 | Export staff list to CSV | ❌ |
| 11 | GDPR-compliant data handling | ❌ |

---

### US-06.04: Training Certificate Upload ❌
**As a** Manager  
**I want to** upload training certificates  
**So that** we have proof of completion

**Status**: ❌ Not Started

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | Upload PDF/image of certificate | ❌ |
| 2 | Link certificate to training record | ❌ |
| 3 | Certificate preview in app | ❌ |
| 4 | Download certificate | ❌ |
| 5 | Certificate expiry date field | ❌ |
| 6 | Alert when certificate expiring | ❌ |
| 7 | OCR extraction of certificate details | ❌ |
| 8 | Verify certificate authenticity (if provider supports) | ❌ |

---

## EP07: Hot Holding (FSAI SC4)

> **FSAI Reference**: Schedule C, Section 4 - Hot Holding  
> **Requirement**: Hot food must be maintained at 63°C or above.

### US-07.01: Log Hot Holding Temperature ❌
**As a** Staff member  
**I want to** record temperatures of hot held food  
**So that** we maintain food safety

**Status**: ❌ Not Started

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | Hot Holding section on Compliance screen | ❌ |
| 2 | Select food item from list or custom entry | ❌ |
| 3 | Select hot holding unit (Bain Marie, Heat Lamp, Hot Pass, etc.) | ❌ |
| 4 | Enter measured temperature | ❌ |
| 5 | Visual indicator: | ❌ |
| 5a | - Green: ≥63°C (compliant) | ❌ |
| 5b | - Amber: 55-63°C (warning) | ❌ |
| 5c | - Red: <55°C (critical) | ❌ |
| 6 | If <63°C, corrective action required | ❌ |
| 7 | Corrective actions: "Reheat to 75°C", "Discard", "Reduce holding time" | ❌ |
| 8 | Time of check auto-populated | ❌ |
| 9 | Staff name/initials | ❌ |
| 10 | Save creates compliance record | ❌ |

---

### US-07.02: Hot Holding Duration Tracking ❌
**As a** Chef  
**I want to** track how long food has been hot held  
**So that** we don't exceed safe limits

**Status**: ❌ Not Started

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | Start timer when item placed on hot hold | ❌ |
| 2 | Timer shows elapsed time | ❌ |
| 3 | Maximum hot hold time configurable (default: 2 hours) | ❌ |
| 4 | Warning at 1.5 hours | ❌ |
| 5 | Alert at 2 hours | ❌ |
| 6 | Action required: Sell, Reheat (once only), or Discard | ❌ |
| 7 | Reheat option disabled if already reheated once | ❌ |
| 8 | All actions logged with timestamp | ❌ |
| 9 | Visual card similar to cooling module | ❌ |

---

### US-07.03: Hot Holding Equipment Configuration ❌
**As a** Manager  
**I want to** define hot holding equipment  
**So that** staff can select the correct unit

**Status**: ❌ Not Started

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | Equipment list in Settings | ❌ |
| 2 | Add unit: name, type, location | ❌ |
| 3 | Type options: Bain Marie, Heat Lamp, Hot Pass, Holding Cabinet | ❌ |
| 4 | Target temperature field | ❌ |
| 5 | Active/inactive status | ❌ |
| 6 | Last service date | ❌ |
| 7 | Service reminder | ❌ |

---

## EP08: Compliance Dashboard & Reports

### US-08.01: Overall Compliance Score ✅
**As a** Manager  
**I want to** see an overall compliance score  
**So that** I can quickly assess our status

**Status**: ✅ Implemented

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | Dashboard shows overall compliance percentage | ✅ |
| 2 | Score calculated from all compliance activities | ✅ |
| 3 | Breakdown by category: Cooling, Temperature, Cleaning, Training | ✅ |
| 4 | Score color coding: | ✅ |
| 4a | - Green: ≥95% | ✅ |
| 4b | - Amber: 80-95% | ✅ |
| 4c | - Red: <80% | ✅ |
| 5 | Trend indicator vs previous period | ✅ |
| 6 | Score history chart (7/30/90 days) | ❌ |
| 7 | Click score to see breakdown details | ❌ |
| 8 | Score updates in real-time as logs added | ❌ |

---

### US-08.02: Daily Self-Check Report ❌
**As a** Manager  
**I want to** generate a daily compliance report  
**So that** I can review end-of-day status

**Status**: ❌ Not Started

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | "Generate Daily Report" button | ❌ |
| 2 | Report shows all activities for selected date | ❌ |
| 3 | Section: Cooling sessions (count, compliance rate) | ❌ |
| 4 | Section: Temperature logs (count, any out of range) | ❌ |
| 5 | Section: Cleaning tasks (completed vs scheduled) | ❌ |
| 6 | Section: Deliveries received | ❌ |
| 7 | Section: Any corrective actions taken | ❌ |
| 8 | Section: Staff on duty | ❌ |
| 9 | Manager sign-off field | ❌ |
| 10 | Export to PDF with branding | ❌ |
| 11 | Auto-generate at end of day (configurable time) | ❌ |
| 12 | Email report to manager | ❌ |

---

### US-08.03: Audit-Ready Report Pack ✅
**As a** Manager  
**I want to** generate a report pack for inspectors  
**So that** I'm prepared for audits

**Status**: 🚧 Partial

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | "Export Report Pack" button on Compliance screen | ✅ |
| 2 | Date range selector | ❌ |
| 3 | Report includes: | 🚧 |
| 3a | - Compliance summary | ✅ |
| 3b | - Cooling log records | ❌ |
| 3c | - Temperature log records | ❌ |
| 3d | - Cleaning records | ❌ |
| 3e | - Training records | ❌ |
| 3f | - Corrective action log | ✅ |
| 3g | - Equipment calibration records | ❌ |
| 4 | PDF format with professional layout | ✅ |
| 5 | FSAI-compliant terminology | ✅ |
| 6 | Includes digital signature/timestamp | ❌ |
| 7 | Include site/venue details | ✅ |
| 8 | Watermark for authenticity | ❌ |
| 9 | File size <10MB for easy sharing | ❌ |

---

### US-08.04: Analytics Dashboard ✅
**As a** Manager  
**I want to** see performance analytics  
**So that** I can identify trends

**Status**: ✅ Implemented

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | Reports screen accessible from navigation | ✅ |
| 2 | Total sessions metric with trend | ✅ |
| 3 | Average cooling time metric | ✅ |
| 4 | Compliance rate percentage | ✅ |
| 5 | Waste value/quantity tracking | 🚧 |
| 6 | Weekly sessions bar chart | ✅ |
| 7 | Category breakdown pie chart | ✅ |
| 8 | Top items list | ✅ |
| 9 | Performance metrics grid | ✅ |
| 10 | Date range filter | 🚧 |
| 11 | Compare to previous period | ✅ |
| 12 | Export analytics to PDF | 🚧 |

---

### US-08.05: Non-Compliance Alert Review ❌
**As a** Manager  
**I want to** review all non-compliance incidents  
**So that** I can take corrective action

**Status**: ❌ Not Started

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | Non-compliance list view | ❌ |
| 2 | Filter by type (cooling, temperature, cleaning) | ❌ |
| 3 | Filter by severity (warning, critical) | ❌ |
| 4 | Filter by date range | ❌ |
| 5 | Each incident shows: type, date, details, staff, current status | ❌ |
| 6 | Status options: Open, In Progress, Resolved | ❌ |
| 7 | Add corrective action notes | ❌ |
| 8 | Mark as resolved with timestamp | ❌ |
| 9 | Root cause analysis field | ❌ |
| 10 | Recurring issue detection | ❌ |
| 11 | Export to CSV | ❌ |

---

## EP09: Voice-First Interface

### US-09.01: Voice Command for Cooling ✅
**As a** Staff member  
**I want to** start cooling with voice command  
**So that** I don't need to touch the screen

**Status**: 🚧 Partial

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | Voice button visible on dashboard | ✅ |
| 2 | Tap button to activate listening | ✅ |
| 3 | Visual indicator when listening (animation) | ✅ |
| 4 | Recognize command: "Start cooling [item name]" | ✅ |
| 5 | Item name matched to presets or custom created | 🚧 |
| 6 | Audio confirmation: "Starting cooling for [item]" | ✅ |
| 7 | Recognize command: "Stop cooling [item name]" | 🚧 |
| 8 | Recognize command: "What's cooling?" | ❌ |
| 9 | Error handling: "Sorry, I didn't understand" | ✅ |
| 10 | Works in noisy kitchen environment | 🚧 |
| 11 | Accent support (Irish, UK, various) | 🚧 |
| 12 | Voice hints shown: "Try saying: 'Start cooling chicken stock'" | ✅ |

---

### US-09.02: Wake Word Activation ✅
**As a** Staff member  
**I want to** activate voice with a wake word  
**So that** I don't need to touch anything

**Status**: ✅ Implemented

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | Settings option to enable wake word | ✅ |
| 2 | Default wake word: "Hey Chef" | ✅ |
| 3 | Wake word triggers listening mode | ✅ |
| 4 | Audio chime confirms wake word detected | ✅ |
| 5 | 5-second listening window after wake word | ✅ |
| 6 | If no command, return to idle | ✅ |
| 7 | Privacy indicator when listening | ✅ |
| 8 | Option to customize wake word | ❌ |
| 9 | Works while app in background (if permitted) | ❌ |
| 10 | Battery/CPU impact acceptable | ✅ |

---

### US-09.03: Voice Provider Selection ✅
**As a** Manager  
**I want to** choose between voice recognition providers  
**So that** I can balance cost and accuracy

**Status**: ✅ Implemented

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | Settings page has Voice Provider selection | ✅ |
| 2 | Option 1: Web Speech API (free, browser-based) | ✅ |
| 3 | Option 2: OpenAI Whisper (paid, high accuracy) | ✅ |
| 4 | Whisper requires API key entry | ✅ |
| 5 | Test voice button to verify provider works | ✅ |
| 6 | Usage tracking for paid provider | ❌ |
| 7 | Fallback to free provider if paid fails | ❌ |
| 8 | Cost estimate displayed (~$0.006/min for Whisper) | ❌ |

---

### US-09.04: Voice-Guided Form Completion ❌
**As a** Staff member  
**I want to** complete forms entirely by voice  
**So that** I keep my hands free

**Status**: ❌ Not Started

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | Form fields read out sequentially | ❌ |
| 2 | "What is the temperature?" prompt | ❌ |
| 3 | User speaks value, system confirms | ❌ |
| 4 | "You said 3 degrees. Is that correct?" | ❌ |
| 5 | User can say "Yes", "No", or "Repeat" | ❌ |
| 6 | If no, re-prompt for field | ❌ |
| 7 | Skip field: "Skip" command | ❌ |
| 8 | Cancel form: "Cancel" command | ❌ |
| 9 | Summary before save: "Saving temp log for Fridge 1 at 3 degrees" | ❌ |
| 10 | Confirmation: "Confirm" to save | ❌ |

---

### US-09.05: Voice Feedback & Announcements ✅
**As a** Staff member  
**I want to** hear spoken alerts  
**So that** I'm notified without looking at the screen

**Status**: ✅ Implemented

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | TTS (Text-to-Speech) for alerts | ✅ |
| 2 | Alert at 90 minutes: "[Item] warning" | ✅ |
| 3 | Alert at 120 minutes: "[Item] critical" | ✅ |
| 4 | Confirmation of actions: "Cooling started" | ✅ |
| 5 | Volume control in settings | ❌ |
| 6 | Voice on/off toggle | ❌ |
| 7 | Different voice options (male/female) | ❌ |
| 8 | Works with device on mute via vibration fallback | ❌ |

---

## EP10: Multi-Venue Management

### US-10.01: Create Additional Venues ❌
**As a** Manager  
**I want to** add multiple venues to my account  
**So that** I can manage all locations

**Status**: ❌ Not Started

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | "Add Venue" button on Venues screen | ❌ |
| 2 | Enter venue name (required) | ❌ |
| 3 | Enter address | ❌ |
| 4 | Select venue type | ❌ |
| 5 | Copy settings from existing venue option | ❌ |
| 6 | New venue created with unique site_id | ❌ |
| 7 | Default staff/presets created | ❌ |
| 8 | Maximum venues based on license tier | ❌ |
| 9 | Pro license: Up to 10 venues | ❌ |
| 10 | Enterprise license: Unlimited venues | ❌ |

---

### US-10.02: Switch Between Venues ✅
**As a** Manager  
**I want to** switch between my venues  
**So that** I can view data for each location

**Status**: ✅ Implemented

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | Venue selector in header/sidebar | ✅ |
| 2 | Dropdown shows all user's venues | ✅ |
| 3 | Current venue name displayed | ✅ |
| 4 | Click venue to switch context | ✅ |
| 5 | All data filters to selected venue | ✅ |
| 6 | Venue switch persists across sessions | ✅ |
| 7 | Badge shows active sessions per venue | ❌ |
| 8 | Quick-switch keyboard shortcut | ❌ |

---

### US-10.03: Cross-Venue Reporting ❌
**As a** Manager  
**I want to** compare performance across venues  
**So that** I can identify best practices

**Status**: ❌ Not Started

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | Multi-venue report option | ❌ |
| 2 | Side-by-side compliance comparison | ❌ |
| 3 | Benchmark against all venues | ❌ |
| 4 | Identify top/bottom performing venue | ❌ |
| 5 | Aggregate statistics across all venues | ❌ |
| 6 | Export combined report | ❌ |
| 7 | Pro feature badge | ✅ |

---

### US-10.04: Venue-Specific Settings ❌
**As a** Manager  
**I want to** configure settings per venue  
**So that** each location is customized

**Status**: ❌ Not Started

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | Settings page scoped to current venue | ❌ |
| 2 | Food presets per venue | ❌ |
| 3 | Refrigeration units per venue | ❌ |
| 4 | Cleaning schedule per venue | ❌ |
| 5 | Staff list per venue | ❌ |
| 6 | Option to share settings across venues | ❌ |

---

## EP11: Menu Engineering & Food Costing

### US-11.01: Menu Item Management ✅
**As a** Manager  
**I want to** manage menu items and costs  
**So that** I can optimize profitability

**Status**: ✅ Implemented

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | Menu Engineering screen accessible from navigation | ✅ |
| 2 | List of menu items | ✅ |
| 3 | Each item shows: name, category, price, food cost, GP% | ✅ |
| 4 | Add new menu item | ✅ |
| 5 | Edit menu item | ✅ |
| 6 | Delete menu item | ✅ |
| 7 | Category filter | ✅ |
| 8 | Search by name | ✅ |
| 9 | Sort by profitability | ✅ |

---

### US-11.02: Menu Profitability Matrix ✅
**As a** Manager  
**I want to** see menu items in a profitability matrix  
**So that** I can make data-driven menu decisions

**Status**: ✅ Implemented

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | 2x2 matrix view (Stars, Plowhorses, Puzzles, Dogs) | ✅ |
| 2 | X-axis: Profitability (GP%) | ✅ |
| 3 | Y-axis: Popularity (sales volume) | ✅ |
| 4 | Items plotted as points/cards | ✅ |
| 5 | Color coding by quadrant | ✅ |
| 6 | Click item for details | ✅ |
| 7 | Recommendations per quadrant | ✅ |
| 8 | Filter by category | ✅ |
| 9 | Time period selector | ❌ |

---

### US-11.03: Recipe Costing ❌
**As a** Chef  
**I want to** calculate recipe costs  
**So that** I know the food cost of each dish

**Status**: ❌ Not Started

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | Recipe builder with ingredient list | ❌ |
| 2 | Ingredient library with unit costs | ❌ |
| 3 | Auto-calculate recipe cost | ❌ |
| 4 | Portion size configuration | ❌ |
| 5 | Cost per portion calculated | ❌ |
| 6 | GP% calculation based on selling price | ❌ |
| 7 | Waste factor per ingredient | ❌ |
| 8 | Supplier price updates | ❌ |
| 9 | Recipe cost history | ❌ |

---

## EP12: Offline-First Architecture

### US-12.01: Offline Data Storage ✅
**As a** Staff member  
**I want to** use the app without internet  
**So that** I can work in cold rooms and basements

**Status**: ✅ Implemented

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | All app features work offline | ✅ |
| 2 | Data stored in localStorage | ✅ |
| 3 | Cooling sessions persist offline | ✅ |
| 4 | Timers continue running offline | ✅ |
| 5 | Alerts trigger offline | ✅ |
| 6 | Voice feedback works offline | ✅ |
| 7 | OCR requires internet (with message) | ✅ |
| 8 | Whisper voice requires internet (fallback to Web Speech) | ✅ |
| 9 | Offline indicator shown in UI | ❌ |
| 10 | Data integrity maintained across sessions | ✅ |

---

### US-12.02: Background Sync ✅
**As a** Manager  
**I want to** data synced when internet returns  
**So that** cloud records are up to date

**Status**: ✅ Implemented

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | Sync triggered when internet reconnects | ✅ |
| 2 | Pending changes queued for sync | ✅ |
| 3 | Sync status indicator | ❌ |
| 4 | "Sync Now" manual trigger option | ❌ |
| 5 | Conflict resolution for simultaneous edits | ❌ |
| 6 | Sync errors logged and retried | 🚧 |
| 7 | Notification when sync complete | ❌ |
| 8 | Data compression for large syncs | ❌ |

---

### US-12.03: PWA Installation ❌
**As a** Manager  
**I want to** install the app on my device  
**So that** it works like a native app

**Status**: ❌ Not Started

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | "Install App" prompt shown on first visit | ❌ |
| 2 | App installable on iOS (Add to Home Screen) | ❌ |
| 3 | App installable on Android (PWA) | ❌ |
| 4 | App icon on home screen | ❌ |
| 5 | Splash screen on launch | ❌ |
| 6 | Full-screen mode without browser chrome | ❌ |
| 7 | Works offline after installation | ❌ |
| 8 | Automatic updates when online | ❌ |
| 9 | Push notifications (if permitted) | ❌ |

---

## EP13: Settings & Configuration

### US-13.01: General Settings ✅
**As a** Manager  
**I want to** configure app settings  
**So that** it works for my venue

**Status**: ✅ Implemented

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | Settings screen accessible from navigation | ✅ |
| 2 | Theme toggle (dark/light) | ✅ |
| 3 | Temperature unit toggle (°C/°F) | ❌ |
| 4 | Language selection | ❌ |
| 5 | Time format (12h/24h) | ❌ |
| 6 | Notification preferences | ❌ |
| 7 | Sound on/off | ❌ |
| 8 | Haptic feedback on/off | ❌ |

---

### US-13.02: OCR Provider Configuration ✅
**As a** Manager  
**I want to** choose OCR provider  
**So that** I can control costs

**Status**: ✅ Implemented

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | OCR Provider selection in Settings | ✅ |
| 2 | Option: OpenAI GPT-4 Vision | ✅ |
| 3 | Option: Google Vision API | ✅ |
| 4 | API key entry for selected provider | ✅ |
| 5 | Test OCR button with sample image | ✅ |
| 6 | Cost estimate per scan displayed | ❌ |
| 7 | Usage tracking (scans this month) | ❌ |

---

### US-13.03: Cooling Configuration ❌
**As a** Manager  
**I want to** configure cooling time limits  
**So that** they match our HACCP plan

**Status**: ❌ Not Started

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | Soft due time configurable (default: 90 min) | ❌ |
| 2 | Hard due time configurable (default: 120 min) | ❌ |
| 3 | Start temperature configurable (default: 63°C) | ❌ |
| 4 | End temperature target configurable (default: 10°C) | ❌ |
| 5 | Warning: "Non-standard times may affect FSAI compliance" | ❌ |
| 6 | Reset to defaults button | ❌ |
| 7 | Changes logged for audit trail | ❌ |

---

### US-13.04: Compliance Schema Selection ❌
**As a** Manager  
**I want to** select which compliance schemas to use  
**So that** forms match my region

**Status**: ❌ Not Started

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | Region/country selection | ❌ |
| 2 | Auto-load appropriate schemas for region | ❌ |
| 3 | IE: FSAI schemas | ❌ |
| 4 | UK: FSA schemas | ❌ |
| 5 | US: FDA schemas | ❌ |
| 6 | Preview schema before enabling | ❌ |
| 7 | Enable/disable specific schemas | ❌ |
| 8 | Schema version information | ❌ |
| 9 | "Update available" notification for new schema versions | ❌ |

---

### US-13.05: Data Export & Backup ❌
**As a** Manager  
**I want to** export all my data  
**So that** I have a backup

**Status**: ❌ Not Started

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | "Export All Data" button in Settings | ❌ |
| 2 | Export format: JSON or CSV | ❌ |
| 3 | Include: cooling sessions, temp logs, cleaning, training | ❌ |
| 4 | Date range selector | ❌ |
| 5 | Download as single file or zip | ❌ |
| 6 | GDPR data export compliance | ❌ |
| 7 | Scheduled automatic backups | ❌ |
| 8 | Backup to cloud storage (Google Drive, Dropbox) | ❌ |

---

## EP14: Audit Trail & Data Integrity

### US-14.01: Immutable Record Creation ✅
**As an** Inspector  
**I want to** trust that records haven't been altered  
**So that** I can rely on them for compliance verification

**Status**: ✅ Implemented (by design)

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | Records cannot be deleted by any user | ✅ |
| 2 | Records cannot be edited after creation | ✅ |
| 3 | Database has `created_at` timestamp (auto-populated, immutable) | ✅ |
| 4 | Database has `created_by` user reference | 🚧 |
| 5 | All records have unique UUID | ✅ |
| 6 | RLS policies prevent UPDATE/DELETE | ✅ |
| 7 | Only INSERT and SELECT allowed | ✅ |
| 8 | Soft delete via `status` field where needed | ✅ |

---

### US-14.02: Rectification Process ❌
**As a** Manager  
**I want to** correct incorrect records properly  
**So that** audit trail is maintained

**Status**: ❌ Not Started

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | "Rectify Record" action (not edit/delete) | ❌ |
| 2 | Original record marked as `rectified` | ❌ |
| 3 | New corrected record created | ❌ |
| 4 | Link between original and rectification | ❌ |
| 5 | Rectification requires: reason, approver | ❌ |
| 6 | Both records visible in audit view | ❌ |
| 7 | Only Manager role can rectify | ❌ |
| 8 | Rate limit on rectifications (max 3/day) | ❌ |

---

### US-14.03: Audit Log Viewer ❌
**As an** Inspector  
**I want to** view a complete audit trail  
**So that** I can verify data integrity

**Status**: ❌ Not Started

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | Audit log accessible to Manager and Inspector roles | ❌ |
| 2 | Shows all record creation events | ❌ |
| 3 | Shows all rectifications | ❌ |
| 4 | Shows user logins | ❌ |
| 5 | Shows settings changes | ❌ |
| 6 | Filter by date range | ❌ |
| 7 | Filter by record type | ❌ |
| 8 | Filter by user | ❌ |
| 9 | Export audit log to PDF | ❌ |
| 10 | Cryptographic verification of log integrity | ❌ |

---

### US-14.04: Data Retention Policy ❌
**As a** Manager  
**I want to** configure data retention  
**So that** we comply with regulations

**Status**: ❌ Not Started

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | Retention period configurable (default: 2 years) | ❌ |
| 2 | FSAI requires minimum 2 years retention | ❌ |
| 3 | Archived data accessible but read-only | ❌ |
| 4 | Data archival process (move to cold storage) | ❌ |
| 5 | Data deletion after retention period (optional) | ❌ |
| 6 | GDPR right-to-deletion support | ❌ |
| 7 | Warning before permanent deletion | ❌ |

---

## Appendix A: FSAI Compliance Requirements

### FSAI Schedule C - Food Safety Management

| Code | Section | Description | System Coverage |
|------|---------|-------------|-----------------|
| SC1 | Receipt of Goods | Checking deliveries | ✅ EP04 |
| SC2 | Cold Holding | Refrigeration monitoring | 🚧 EP03 |
| SC3 | Cooling | Hot to cold process | ✅ EP02 |
| SC4 | Hot Holding | Maintaining hot food | ❌ EP07 |
| SC5 | Cleaning | Sanitation records | 🚧 EP05 |
| SC6 | Cross-Contamination | Allergen management | ❌ Future |
| SC7 | Training | Staff records | 🚧 EP06 |

### Key FSAI Time-Temperature Requirements

| Process | Requirement | System Implementation |
|---------|-------------|----------------------|
| Cooling | 63°C → 10°C within 2 hours | 90min soft, 120min hard alerts |
| Cold Storage | ≤5°C | Visual warning >5°C, critical >8°C |
| Frozen Storage | ≤-18°C | Visual warning >-15°C |
| Hot Holding | ≥63°C | Warning <63°C, critical <55°C |
| Cooking | Core temp ≥75°C | Future feature |
| Reheating | Core temp ≥75°C | Future feature |

### Documentation Requirements

| Requirement | System Feature |
|-------------|----------------|
| Timestamped records | Automatic UTC timestamps |
| Staff identification | Staff name/initials field |
| Corrective actions | Required when out of compliance |
| Manager verification | Verification checkbox |
| Immutable records | INSERT-only database policy |
| 2-year retention | Data retention configuration |

---

## Appendix B: Temperature Standards

### Storage Temperature Categories

| Category | Acceptable Range | Examples |
|----------|------------------|----------|
| Ambient | 10-25°C | Dry goods, bread, produce |
| Chilled | 0-5°C | Dairy, fresh meat, prepared foods |
| Frozen | ≤-18°C | Frozen meat, ice cream, frozen veg |

### Critical Temperature Points

| Temperature | Significance |
|-------------|--------------|
| 75°C+ | Safe cooking/reheating temperature |
| 63°C | Minimum hot holding temperature |
| 10°C | Maximum end-of-cooling temperature |
| 8°C | Chilled storage danger zone start |
| 5°C | Maximum chilled storage temperature |
| 0°C | Freezing point |
| -15°C | Frozen storage danger zone start |
| -18°C | Maximum frozen storage temperature |

### Temperature Danger Zone

**5°C to 63°C** - Bacteria multiply rapidly in this range. Food should not remain in this zone for more than 2 hours total.

---

## Appendix C: Glossary

| Term | Definition |
|------|------------|
| **CCP** | Critical Control Point - a step where control can be applied to prevent/eliminate a food safety hazard |
| **FSAI** | Food Safety Authority of Ireland |
| **FSA** | Food Standards Agency (UK) |
| **HACCP** | Hazard Analysis and Critical Control Points - systematic food safety approach |
| **EHO** | Environmental Health Officer - local authority inspector |
| **RLS** | Row Level Security - database access control |
| **PWA** | Progressive Web App - web app installable like native app |
| **OCR** | Optical Character Recognition - extracting text from images |
| **TTS** | Text-to-Speech - converting text to spoken audio |
| **STT** | Speech-to-Text - converting spoken audio to text |
| **COSHH** | Control of Substances Hazardous to Health |
| **SDS** | Safety Data Sheet |
| **GP%** | Gross Profit Percentage |
| **Blast Chiller** | Rapid cooling equipment that can reduce temperature quickly |
| **Soft Due** | Warning threshold (90 minutes for cooling) |
| **Hard Due** | Critical threshold (120 minutes for cooling) |
| **Rectification** | Correcting a record while maintaining audit trail |
| **Immutable** | Cannot be changed once created |

---

## Document Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | Jan 2026 | System | Initial comprehensive user stories |

---

*End of Document*
