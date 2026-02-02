# ChefVoice - Tech Stack

## Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS with custom theme classes
- **State Management**: Zustand + persist middleware
- **Data Fetching**: @tanstack/react-query
- **Notifications**: Sonner (toast)
- **Icons**: Lucide React

## Backend
- **Platform**: Supabase
- **Database**: PostgreSQL
- **Auth**: Email/Password + Google SSO
- **Storage**: delivery-images bucket
- **RLS**: Row Level Security policies for multi-tenancy

## Key Libraries
- `uuid` - UUID generation
- `date-fns` - Date manipulation
- `sonner` - Toast notifications
- `zustand` - State management
- `pdf-lib` - PDF generation (future)

## Coding Standards
- TypeScript strict mode enabled
- Component files aim for <50 lines
- Use `cn()` utility for conditional Tailwind classes
- Services handle all Supabase/API interactions
- Custom hooks for reusable logic
- Small, focused components

## Cooling Policy Constants
```typescript
COOLING_POLICY = {
  SOFT_LIMIT_MINUTES: 90,   // Warning at 90 minutes
  HARD_LIMIT_MINUTES: 120,  // Critical at 120 minutes (2 hours)
}
```

## Demo Mode
When in demo mode (`isDemo = true`), cooling sessions are modified to show a mix of statuses immediately:
- Index 0: Overdue (started 150 minutes ago)
- Index 1: Warning (started 100 minutes ago)
- Index 2+: Active (started within last 30 minutes)
