# ChefVoice Kitchen Compliance - Project Brief

## Project Overview
ChefVoice Kitchen Compliance is a SaaS platform for FSAI (Food Safety Authority of Ireland) HACCP compliance in commercial kitchens. It enables food businesses to digitize their food safety records.

## Core Features
- Voice-enabled logging with wake word detection ("Hey Chef")
- Automated temperature monitoring & compliance tracking
- Goods receipt management with OCR scanning
- Protein traceability label capture
- Multi-venue management
- PDF report generation for audits

## Tech Stack
- Frontend: React 18 + TypeScript + Vite + Tailwind CSS
- State Management: Zustand (with localStorage persistence)
- Data Fetching: @tanstack/react-query
- Backend: Supabase (PostgreSQL + Edge Functions + Auth + Storage)
- UI Components: Custom components + shadcn/ui patterns

## Target Users
- Restaurant managers, chefs, and kitchen staff
- Food safety officers and auditors
- Multi-site food service operations

## Demo Mode
- Fixed demo site ID: `b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12`
- Demo user: demo@chefvoice.app / demo123!@#
- Demo data includes staff, cooling sessions, and settings
