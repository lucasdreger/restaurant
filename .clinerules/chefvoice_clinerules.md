# ChefVoice Kitchen Compliance - AI Development Guidelines

## 🎯 Project Overview

**ChefVoice Kitchen Compliance** is a SaaS platform for FSAI (Food Safety Authority of Ireland) HACCP compliance in commercial kitchens. It enables food businesses to digitize their food safety records with features like:

- Voice-enabled logging with wake word detection ("Hey Chef")
- Automated temperature monitoring & compliance tracking
- Goods receipt management with OCR scanning
- Protein traceability label capture
- Multi-venue management
- PDF report generation for audits

### Target Users
- Restaurant managers, chefs, and kitchen staff
- Food safety officers and auditors
- Multi-site food service operations

---

## 🏗️ Architecture Overview

### Frontend Stack
```
React 18 + TypeScript + Vite
├── UI: Tailwind CSS (custom theming with day/night modes)
├── State: Zustand (with localStorage persistence)
├── Data Fetching: @tanstack/react-query
├── Forms: React Hook Form (when needed)
├── Notifications: Sonner (toast)
├── Icons: Lucide React
└── File Processing: PDF.js, Tesseract.js (local OCR)
```

### Backend Stack (Supabase)
```
Supabase (PostgreSQL + Edge Functions + Auth + Storage)
├── Database: PostgreSQL with RLS policies
├── Auth: Email/Password + Google SSO
├── Storage: delivery-images bucket (compressed uploads)
├── Edge Functions: For server-side processing (when needed)
└── Realtime: For live dashboard updates (future)
```

### MCP Servers (CRITICAL)
- **Use `mcp-supabase-chefvoice`** for all Supabase operations
- This is the project-specific connection with proper credentials
- NEVER use `mcp-supabase-sentia` - that's for a different project

---

## 📁 Project Structure

```
kitchen-compliance/
├── src/
│   ├── components/           # React components
│   │   ├── cooling/          # Cooling log components
│   │   ├── fridge/           # Fridge temperature components
│   │   ├── haccp/            # HACCP schema system
│   │   │   ├── schemas/      # Form schema definitions
│   │   │   └── schema_renderer/ # Dynamic form renderer
│   │   ├── landing/          # Auth & landing pages
│   │   ├── layout/           # Layout components (Sidebar, Header)
│   │   ├── menu/             # Menu engineering feature
│   │   ├── onboarding/       # User onboarding flow
│   │   ├── receipt/          # Goods receipt/delivery
│   │   ├── screens/          # Main app screens
│   │   ├── ui/               # Reusable UI components
│   │   └── voice/            # Voice input components
│   │
│   ├── hooks/                # Custom React hooks
│   │   ├── useVoiceRecognition.ts
│   │   ├── useWakeWord.ts
│   │   └── useWhisperVoice.ts
│   │
│   ├── lib/                  # Utility libraries
│   │   ├── supabase.ts       # Supabase client config
│   │   ├── imageCompression.ts # Client-side image compression
│   │   └── utils.ts          # General utilities (cn, etc.)
│   │
│   ├── services/             # Business logic & API calls
│   │   ├── complianceService.ts  # Compliance records
│   │   ├── coolingService.ts     # Cooling logs
│   │   ├── deliveryService.ts    # Goods receipts & images
│   │   ├── fridgeService.ts      # Fridge temperatures
│   │   ├── ocrService.ts         # OCR processing
│   │   ├── settingsService.ts    # App settings
│   │   └── whisperService.ts     # Voice transcription
│   │
│   ├── store/                # Zustand state management
│   │   └── useAppStore.ts    # Global app state
│   │
│   ├── types/                # TypeScript types
│   │   ├── database.types.ts # Supabase generated types
│   │   └── index.ts          # Shared app types
│   │
│   ├── App.tsx               # Main app component
│   ├── main.tsx              # Entry point
│   └── index.css             # Global styles
│
├── supabase/
│   └── migrations/           # SQL migrations (versioned)
│
├── docs/                     # Documentation
│   ├── ARCHITECTURE.md
│   ├── TECHNICAL_COMPLIANCE_SPEC.md
│   └── userstories.md
│
└── public/                   # Static assets
```

---

## 🧪 Test-Driven Development (TDD) Guidelines

### TDD Workflow
1. **Red**: Write a failing test first
2. **Green**: Write minimal code to pass the test
3. **Refactor**: Improve code while keeping tests green

### Testing Strategy
```typescript
// Unit Tests: For services and utilities
// Location: __tests__/services/*.test.ts
describe('createGoodsReceipt', () => {
  it('should create a receipt with valid data', async () => {
    const input = { siteId: 'uuid', supplierName: 'Test Supplier', ... }
    const result = await createGoodsReceipt(input, [])
    expect(result).toBeDefined()
    expect(result?.receipt.supplierName).toBe('Test Supplier')
  })
  
  it('should return null if site ID is missing', async () => {
    const result = await createGoodsReceipt({ siteId: '', ... }, [])
    expect(result).toBeNull()
  })
})

// Integration Tests: For full workflows
// Test the complete flow from UI to database

// E2E Tests: For critical user journeys
// - Onboarding flow
// - Recording a compliance log
// - Generating an audit report
```

### Test File Naming
- Unit tests: `*.test.ts` or `*.test.tsx`
- Integration tests: `*.integration.test.ts`
- E2E tests: `e2e/*.spec.ts` (Playwright)

### What to Test
- ✅ Service functions (business logic)
- ✅ Utility functions (imageCompression, etc.)
- ✅ Custom hooks (useVoiceRecognition, etc.)
- ✅ Critical user flows (E2E)
- ⚠️ Simple components (only if complex logic)
- ❌ Styling/layout (visual regression if needed)

---

## 🗄️ Database Schema Design

### Core Tables (PostgreSQL via Supabase)

```sql
-- Multi-tenant: All tables reference site_id for venue isolation
-- RLS: Row Level Security enforces tenant isolation

-- Core entities
profiles          -- User profiles (linked to auth.users)
venues            -- Restaurant venues (multi-site support)
sites             -- Alias for venues (legacy compatibility)
staff_members     -- Staff within a venue

-- Compliance records
compliance_records    -- HACCP log entries (fridge temps, cleaning, etc.)
cooling_logs          -- Cooling process tracking
fridge_temp_logs      -- Fridge temperature recordings

-- Goods receipt
goods_receipts        -- Delivery receipt headers
goods_receipt_items   -- Line items for each receipt
delivery_images       -- Compressed images (DN scans, protein labels)

-- Configuration
haccp_templates       -- Configurable HACCP form schemas
settings              -- Venue-level settings
```

### Key Patterns

1. **Multi-tenancy via `site_id`**
   ```sql
   -- Every table has site_id for tenant isolation
   ALTER TABLE goods_receipts ADD COLUMN site_id UUID REFERENCES sites(id);
   
   -- RLS policy pattern
   CREATE POLICY "Users can view own site data" ON goods_receipts
     FOR SELECT USING (site_id IN (
       SELECT id FROM sites WHERE created_by = auth.uid()
     ));
   ```

2. **Foreign Keys with NULL fallback**
   ```sql
   -- Staff might not exist in DB yet (local-first)
   received_by_staff_id UUID REFERENCES staff_members(id) NULL,
   received_by_name TEXT NOT NULL  -- Always store the name
   ```

3. **Enum types via CHECK constraints**
   ```sql
   status TEXT DEFAULT 'completed' CHECK (status IN ('draft', 'completed', 'flagged', 'voided'))
   ```

4. **Timestamps with auto-update**
   ```sql
   created_at TIMESTAMPTZ DEFAULT NOW(),
   updated_at TIMESTAMPTZ DEFAULT NOW()
   
   -- Trigger for updated_at
   CREATE TRIGGER set_updated_at BEFORE UPDATE ON goods_receipts
     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
   ```

### Demo Site Pattern
```sql
-- A special demo site exists for unauthenticated demo mode
INSERT INTO sites (id, name, address) VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',  -- Fixed UUID
  'Demo Kitchen',
  '123 Restaurant Street'
);

-- RLS policies allow public access to demo site
CREATE POLICY "Allow demo site access" ON goods_receipts
  FOR ALL USING (site_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
```

---

## 📝 Coding Standards

### TypeScript
```typescript
// ✅ DO: Use strict typing
interface GoodsReceiptInput {
  siteId: string
  supplierName: string
  invoiceNumber?: string  // Optional with ?
}

// ❌ DON'T: Use `any` unless absolutely necessary
const data: any = response  // BAD

// ✅ DO: Use type guards
if ('error' in response) {
  handleError(response.error)
}
```

### React Components
```typescript
// ✅ Small, focused components (aim for <50 lines)
// ✅ Extract complex logic into custom hooks
// ✅ Use function components with hooks
// ✅ Memoize expensive computations

// Component structure
export function GoodsReceiptScreen({ onBack, onNavigate }: Props) {
  // 1. State declarations
  const [receipt, setReceipt] = useState<ReceiptData>(INITIAL_RECEIPT)
  
  // 2. Hooks (custom hooks, useEffect, etc.)
  const { staffMembers, currentSite } = useAppStore()
  
  // 3. Event handlers
  const handleSubmit = async () => { ... }
  
  // 4. Render helpers (if needed)
  const renderItems = () => { ... }
  
  // 5. Return JSX
  return (...)
}
```

### Services Pattern
```typescript
// Services handle all Supabase/API interactions
// Located in src/services/

export async function createGoodsReceipt(
  input: GoodsReceiptInput,
  items: ReceiptItemInput[]
): Promise<Result | null> {
  try {
    // 1. Validate inputs
    if (!input.siteId) {
      console.error('❌ Site ID is required')
      throw new Error('Site ID is required')
    }
    
    // 2. Transform data for database
    const receiptData = {
      site_id: input.siteId,
      supplier_name: input.supplierName,
      // ... snake_case for DB columns
    }
    
    // 3. Execute database operation
    const { data, error } = await supabase
      .from('goods_receipts')
      .insert(receiptData)
      .select()
      .single()
    
    // 4. Handle errors with detailed logging
    if (error) {
      console.error('❌ Error:', {
        message: error.message,
        code: error.code,
        details: error.details,
      })
      throw error
    }
    
    // 5. Return mapped result (camelCase for frontend)
    return mapFromDb(data)
    
  } catch (error) {
    console.error('Service error:', error)
    return null
  }
}
```

### Zustand State Management
```typescript
// src/store/useAppStore.ts
interface AppState {
  // State
  currentSite: Site | null
  staffMembers: StaffMember[]
  settings: AppSettings
  
  // Actions
  setCurrentSite: (site: Site | null) => void
  updateSettings: (updates: Partial<AppSettings>) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentSite: null,
      staffMembers: [],
      settings: DEFAULT_SETTINGS,
      
      setCurrentSite: (site) => set({ currentSite: site }),
      updateSettings: (updates) => 
        set((state) => ({ 
          settings: { ...state.settings, ...updates } 
        })),
    }),
    {
      name: 'chef-voice-storage',
      partialize: (state) => ({
        // Only persist what's needed
        settings: state.settings,
        currentSite: state.currentSite,
      }),
    }
  )
)
```

---

## 🎨 UI/UX Guidelines

### Tailwind CSS Theming
```css
/* Theme classes for day/night modes */
.theme-day { /* Light theme variables */ }
.theme-night { /* Dark theme variables */ }

/* Use semantic color classes */
.bg-theme-primary    /* Main background */
.bg-theme-secondary  /* Secondary background */
.bg-theme-card       /* Card backgrounds */
.text-theme-primary  /* Primary text */
.text-theme-muted    /* Muted text */
.border-theme-primary /* Borders */
```

### Component Styling
```typescript
// Use cn() utility for conditional classes
import { cn } from '@/lib/utils'

<button className={cn(
  "px-4 py-2 rounded-xl font-medium transition-colors",
  isActive 
    ? "bg-emerald-500 text-white" 
    : "bg-theme-secondary text-theme-muted"
)}>

// Mobile-first responsive design
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
```

### Toast Notifications
```typescript
import { toast } from 'sonner'

// Success
toast.success('Receipt saved successfully!')

// Error
toast.error('Failed to save receipt')

// With action
toast('Receipt created', {
  action: {
    label: 'View',
    onClick: () => navigate('/receipts')
  }
})
```

---

## 🔧 Development Workflow

### Starting Development
```bash
cd kitchen-compliance
npm install
npm run dev
# App runs at http://localhost:5173/restaurant/
```

### Database Migrations
```bash
# Create new migration
# File: supabase/migrations/YYYYMMDDHHMMSS_description.sql

# Apply via MCP
use_mcp_tool mcp-supabase-chefvoice apply_migration {
  "name": "add_new_feature",
  "query": "CREATE TABLE ..."
}
```

### Before Committing
```bash
npm run lint          # Check for lint errors
npm run build         # Ensure build passes
npm run test          # Run tests (when implemented)
```

### Git Commit Messages
```
feat: add goods receipt image upload
fix: resolve FK constraint error on receipts
refactor: extract image compression to lib
docs: update API documentation
chore: update dependencies
```

---

## 🚨 Common Pitfalls & Solutions

### 1. Foreign Key Constraint Errors
```typescript
// ❌ BAD: Assuming staff_id exists in database
received_by_staff_id: staffId  // May not exist in DB!

// ✅ GOOD: Use null for FK, store name separately
received_by_staff_id: null,
received_by_name: staffName  // Always have the name
```

### 2. Demo Mode Site ID
```typescript
// ❌ BAD: Using fake site ID
setCurrentSite({ id: 'demo-site-123', ... })  // Doesn't exist!

// ✅ GOOD: Use the actual demo site from database
const FALLBACK_DEMO_SITE = {
  id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',  // Real UUID
  name: 'Demo Kitchen',
  ...
}
```

### 3. Stale localStorage
```typescript
// ✅ Add auto-correction in App.tsx
if (authState === 'demo' && currentSite?.id !== DEMO_SITE.id) {
  console.log('🔄 Fixing stale site ID')
  setCurrentSite(DEMO_SITE)
}
```

### 4. Supabase Type Issues
```typescript
// When Supabase types conflict, use type assertion
const db = supabase as any
const { data, error } = await db.from('table').select()
```

### 5. Image Upload Storage
```typescript
// Images must be compressed before upload
const compressed = await compressImage(file, COMPRESSION_PRESETS.deliveryNote)

// Upload to storage bucket
await supabase.storage
  .from('delivery-images')
  .upload(storagePath, compressed.blob)
```

---

## 📚 Key Documentation References

- `docs/ARCHITECTURE.md` - System architecture details
- `docs/TECHNICAL_COMPLIANCE_SPEC.md` - FSAI compliance requirements
- `docs/userstories.md` - Feature user stories
- `GOOGLE_SSO_SETUP.md` - OAuth configuration
- `README.md` - Quick start guide

---

## 🔗 MCP Server Usage

### Supabase Operations (ALWAYS use mcp-supabase-chefvoice)
```typescript
// List tables
use_mcp_tool mcp-supabase-chefvoice list_tables { "schemas": ["public"] }

// Execute SQL (for queries)
use_mcp_tool mcp-supabase-chefvoice execute_sql { "query": "SELECT * FROM goods_receipts LIMIT 5" }

// Apply migration (for DDL)
use_mcp_tool mcp-supabase-chefvoice apply_migration { 
  "name": "add_feature", 
  "query": "CREATE TABLE ..." 
}

// Get logs
use_mcp_tool mcp-supabase-chefvoice get_logs { "service": "postgres" }

// Check security advisors
use_mcp_tool mcp-supabase-chefvoice get_advisors { "type": "security" }
```

---

## ✅ Pre-Implementation Checklist

Before implementing any feature:

- [ ] Read relevant user stories in `docs/userstories.md`
- [ ] Check existing components for reusable patterns
- [ ] Verify database schema supports the feature
- [ ] Plan the service function(s) needed
- [ ] Consider error handling and edge cases
- [ ] Think about offline/demo mode behavior
- [ ] Ensure mobile responsiveness

After implementation:

- [ ] Test in both day and night themes
- [ ] Test in demo mode (unauthenticated)
- [ ] Test in authenticated mode
- [ ] Verify RLS policies work correctly
- [ ] Check console for errors/warnings
- [ ] Ensure toast notifications are appropriate
- [ ] Update types if schema changed