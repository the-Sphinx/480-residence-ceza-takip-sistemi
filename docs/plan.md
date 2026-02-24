# 480-Ceza: Apartment Complex Fine Management System

## Overview
A client-side web application for managing tenant fines in an apartment complex with 10 blocks (A-J), ~400 units. Replaces the existing Google Sheets-based tracking system with a modern, user-friendly interface.

## Current State Analysis
The existing spreadsheet has 3 tabs:
1. **Resident/Fine Assignment (matrix view)**: Rows are residents (Blok-No, Blok, No, Daire Sakini), columns are 48 "Ceza" types each with 5 sub-columns. An "X" mark indicates a fine was assigned. ~400+ resident entries across 10 blocks (A-J).
2. **Fine Ledger**: A flat list of all fines issued to all residents.
3. **Fine Definitions**: Fine type names, descriptions, and monetary amounts (TRY).

### Migration Decision: Starting Clean
The existing spreadsheet data will **not** be migrated. All historical fines are old and the management is okay starting fresh. Resident and fine type data will be entered through the webapp's own management UI. The old spreadsheet can remain as an archive for reference but will not be connected to the new system.

## Architecture Decisions

### Frontend Framework: React + TypeScript + Vite
- **Why React**: Largest ecosystem, best tooling, strong TypeScript support
- **Why Vite**: Fast dev server, simple config, modern build tooling

### UI Library: Tailwind CSS + shadcn/ui
- Rapid development with consistent design
- shadcn/ui provides accessible, well-designed components (tables, dialogs, forms, search)
- No heavy component library dependency — components are copied into the project

### Data Storage: Google Sheets API (primary) + localStorage (cache)
- **Google Sheets API**: Meets the requirement of "no backend" while keeping data in the cloud. A **new, dedicated spreadsheet** is created by the app and used exclusively as a data store — it is not shared for manual editing.
- **No manual edits to the data sheet**: The spreadsheet is treated as a database, not a user-facing document. All reads and writes go through the webapp. This eliminates the need for conflict resolution or sync logic between manual edits and app state.
- **localStorage**: Acts as a read cache for faster page loads. All writes go to Sheets first, then update localStorage on success. Maximum cache size is monitored — only the last 12 months of fines are cached locally; older data is fetched from Sheets on demand.
- **Alternative considered**: Firebase Realtime DB — more complex setup, overkill for this use case. Supabase — requires account setup and is essentially a backend. Google Sheets fits because they already use it.

### Authentication & Access Control
- **Google OAuth 2.0** is used for Sheets API access. The app will run in Google's "Testing" mode (suitable for <100 users — the management team is ~5 people).
- **Access control**: Only users with edit access to the Google Sheet can use the app. The OAuth consent screen acts as the login gate — no additional auth layer needed.
- **The app is management-only** — tenants do not have access. This is enforced by the Google Sheet's sharing settings.
- **Fallback**: If OAuth proves too complex for the team, a simpler approach using a Google API key with a pre-shared spreadsheet ID can be used (read/write via API key + service account proxy is not possible client-side, so OAuth is the primary path).

### Data Integrity
Since the Google Sheet is app-managed only (no manual edits), the architecture is simple:
- **Google Sheets is the single source of truth** — the app reads from and writes to Sheets directly.
- **localStorage is a read cache** — populated on page load from Sheets, used to avoid redundant API calls during a session.
- **No conflict resolution needed** — there are no competing writers. The spreadsheet is a private data store that only the webapp touches.
- **No offline writes**: If Sheets is unreachable, the app shows a connection error. Users can view cached data but cannot create or modify records until connectivity is restored.

### Data Model

```typescript
interface Block {
  id: string;           // "A", "B", ... "J"
  name: string;         // "A Blok"
  unitCount: number;
}

interface Tenant {
  id: string;           // UUID
  blockId: string;      // "A"
  unitNo: number;       // 1-40
  fullName: string;     // "AZİZ DEMİR"
  isVacant: boolean;    // true for "BOŞDAİRE"
}

interface InfractionType {
  id: string;           // UUID
  name: string;         // e.g. "Gürültü Şikayeti" (Noise Complaint)
  description: string;
  fineAmount: number;   // in TRY
  category?: string;    // optional grouping for 48+ types
  isActive: boolean;
}

interface Fine {
  id: string;           // UUID
  tenantId: string;
  infractionTypeId: string;
  date: string;         // ISO date
  amount: number;       // snapshot of fine amount at time of issue
  notes: string;
  isPaid: boolean;
  paidDate?: string;
  isDeleted: boolean;   // soft delete for erroneous fines (preserves audit trail)
}
```

### Sheets Structure (new dedicated spreadsheet)
The app creates a new spreadsheet with normalized sheets (not the old spreadsheet):
- **Sheet 1 — Tenants**: id, blockId, unitNo, fullName, isVacant
- **Sheet 2 — InfractionTypes**: id, name, description, fineAmount, category, isActive
- **Sheet 3 — Fines**: id, tenantId, infractionTypeId, date, amount, notes, isPaid, paidDate, isDeleted

## Features & Pages

### 1. Dashboard (Ana Sayfa)
- Summary cards: total active fines, total amount owed, tenants with unpaid fines
- Recent fines list (last 10)
- Quick search bar (search by name, block, unit number)
- Block-level overview (which blocks have the most fines)

### 2. Tenant Management (Daire Sakinleri)
- Table view of all tenants, sortable by block/unit/name
- Filter by block
- Search by name or unit
- Add / edit / remove tenants
- View tenant detail with full fine history

### 3. Tenant Detail Page (Sakin Detayı)
- Tenant info (block, unit, name)
- Fine history table with date, infraction type, amount, status (paid/unpaid)
- Total owed vs. total paid summary
- Actions:
  - **Ceza Ekle (Add Fine)**: add a new fine to this tenant
  - **Ödendi Olarak İşaretle (Mark as Paid)**: set isPaid=true on selected unpaid fines
  - **Tümünü Ödendi İşaretle (Mark All Paid)**: batch mark all unpaid fines as paid
  - **Ceza Sil (Delete Fine)**: soft-delete an erroneous fine (sets isDeleted=true, preserves audit trail, requires confirmation dialog)
- Print/export report for this tenant

### 4. Infraction Type Management (Ceza Türleri)
- List of all infraction types with fine amounts, searchable and filterable by category
- Add / edit / deactivate infraction types
- Optional category grouping (useful when managing 48+ types)
- Changing an amount only affects future fines (historical fines keep their snapshot amount)

### 5. Add Fine Flow (Ceza Ekle)
- Select tenant (searchable dropdown) or navigate from tenant detail
- Select infraction type
- Date picker (defaults to today)
- Optional notes field
- Confirm and save

### 6. Reports (Raporlar)
- **Per-tenant report**: breakdown of all fines, totals, payment status
- **Per-block report**: aggregate fines by block
- **Per-infraction report**: which infractions occur most frequently
- **Date range filter**: view fines within a specific period
- **Export to CSV/PDF**: for printing or sharing

### 7. Settings (Ayarlar)
- Google Sheets connection setup (OAuth sign-in, auto-create dedicated spreadsheet)
- Connection status indicator
- Data export/backup (CSV download)
- Note: Google Sheets version history serves as the primary backup mechanism

## Implementation Plan

### Phase 1: Project Setup & Core Infrastructure
- [x] Initialize Vite + React + TypeScript project
- [x] Install and configure Tailwind CSS + shadcn/ui
- [x] Set up React Router for page navigation
- [x] Create project folder structure
- [x] Define TypeScript interfaces for the data model
- [x] Implement localStorage service (CRUD for tenants, fines, infraction types)
- [x] Set up Zustand stores (tenantsStore, finesStore, infractionsStore)
- [x] Seed localStorage with sample data for development

### Phase 2: Tenant Management UI (localStorage-only MVP)
- [x] Build app layout (navbar, sidebar, responsive shell)
- [x] Build tenant list page with table (sortable, filterable)
- [x] Implement block filter and search
- [x] Create add/edit tenant dialog
- [x] Build tenant detail page with fine history
- [x] Add "mark as vacant" functionality

### Phase 3: Infraction & Fine Management UI
- [x] Build infraction types management page with category grouping
- [x] Create add/edit infraction type dialog
- [x] Implement "add fine" flow (select tenant, infraction, date, notes)
- [x] Build fine list with filtering and sorting
- [x] Implement "mark as paid" action (single and batch)
- [x] Implement "delete fine" action (soft delete with confirmation)

### Phase 4: Dashboard & Reports
- [x] Build dashboard with summary cards and charts (Recharts)
- [x] Implement per-tenant report generation
- [x] Implement per-block and per-infraction aggregate reports
- [x] Add date range filtering for reports
- [x] Implement CSV export (Papa Parse)
- [x] Implement print-friendly report view (CSS print styles)

### Phase 5: Google Sheets Integration
- [ ] Set up Google Cloud project with Sheets API enabled
- [x] Implement Google OAuth 2.0 sign-in flow
- [x] Build Sheets API service layer (create spreadsheet, read/write/update rows)
- [x] Auto-create dedicated data spreadsheet on first sign-in (3 sheets: Tenants, InfractionTypes, Fines)
- [x] Wire up Zustand stores to read from Sheets on load, write to Sheets on mutation
- [x] Add connection status indicator and error banner when Sheets is unreachable
- [x] Migrate localStorage-only data to Sheets on first connection (one-time transfer of data entered during Phases 2-4 development)

### Phase 6: Polish & Testing
- [ ] Add loading states and error handling throughout
- [ ] Implement responsive design for mobile/tablet
- [ ] Write unit tests for stores, services, and utilities (Vitest)
- [ ] Write integration tests for key flows (React Testing Library)
- [ ] Cross-browser testing
- [ ] Performance optimization (lazy loading pages, memoization)
- [ ] Deploy to Vercel/Netlify, configure OAuth redirect URIs

## Deployment
- **Hosting**: Vercel or Netlify (free tier, supports static SPA)
- **Custom domain**: Optional, configured via hosting provider
- **OAuth redirect URIs**: Must be added to Google Cloud Console matching the deployment URL
- **CI/CD**: Automatic deploys on push to main branch via Vercel/Netlify git integration

## File Structure
```
480-ceza/
  docs/
    plan.md
  src/
    components/
      ui/                     # shadcn/ui components
      layout/
        Navbar.tsx
        Sidebar.tsx
        Layout.tsx
      tenants/
        TenantTable.tsx
        TenantForm.tsx
        TenantDetail.tsx
        TenantSearch.tsx
      fines/
        FineTable.tsx
        FineForm.tsx
        FineActions.tsx
      infractions/
        InfractionTable.tsx
        InfractionForm.tsx
      reports/
        TenantReport.tsx
        BlockReport.tsx
        InfractionReport.tsx
      dashboard/
        SummaryCards.tsx
        RecentFines.tsx
        BlockOverview.tsx
    pages/
      DashboardPage.tsx
      TenantsPage.tsx
      TenantDetailPage.tsx
      InfractionsPage.tsx
      ReportsPage.tsx
      SettingsPage.tsx
    stores/
      tenantsStore.ts
      finesStore.ts
      infractionsStore.ts
      syncStore.ts
    services/
      localStorage.ts
      googleSheets.ts
    hooks/
      useGoogleAuth.ts
    types/
      index.ts
    utils/
      formatters.ts
      calculations.ts
      validators.ts
    App.tsx
    main.tsx
  index.html
  package.json
  tsconfig.json
  tailwind.config.ts
  vite.config.ts
```

## Tech Stack Summary
| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build Tool | Vite |
| Styling | Tailwind CSS |
| Components | shadcn/ui |
| Routing | React Router v6 |
| State | Zustand (separate stores per domain) |
| Storage | Google Sheets API + localStorage (read cache) |
| Auth | Google OAuth 2.0 (Testing mode) |
| Charts | Recharts |
| Export | jsPDF + Papa Parse (CSV) |
| Testing | Vitest + React Testing Library |
| Hosting | Vercel or Netlify |

## Language
All UI strings are written directly in Turkish. No i18n framework is used — the user base is exclusively Turkish-speaking. If a future need for multi-language support arises, react-i18next can be added at that point.

## Risks & Mitigations
| Risk | Mitigation |
|------|-----------|
| Google Sheets API rate limits (60 req/min) | localStorage read cache; batch writes; debounce rapid mutations |
| OAuth "unverified app" warning | Use Testing mode (suitable for <100 users); document the one-time "Advanced > Continue" click for team |
| Data loss if Sheets is unreachable | Read-only mode with cached data; no offline writes; Google Sheets version history as backup |
| Turkish character handling | UTF-8 throughout; test with actual data |
| localStorage size limits (~5-10MB) | Only cache last 12 months of fines; monitor usage; fetch older data from Sheets on demand |

## Review Notes

### Review 1 — Adversarial review (2026-02-23)
Key changes incorporated:
- Clarified OAuth model (Testing mode for small team) and access control (management-only)
- Swapped phase order: UI built on localStorage first (Phases 2-4), Sheets integration added later (Phase 5)
- Replaced React Context + useReducer with Zustand (avoids re-render issues at scale)
- Separated "mark as paid" and "delete fine" as distinct actions (no ambiguous "reset")
- Removed unnecessary i18n — hardcoded Turkish strings
- Added deployment section (Vercel/Netlify + OAuth redirect URI config)
- Added localStorage cache eviction strategy (12-month window)
- Added category grouping for infraction types (handles 48+ types)
- Added soft delete for fines (audit trail preservation)

### Review 2 — User feedback (2026-02-23)
Key changes incorporated:
- Documented all 3 tabs in the existing spreadsheet (assignment matrix, fine ledger, fine definitions)
- Removed data migration requirement — starting clean, no import wizard needed
- Spreadsheet used by the app is a new, dedicated, app-managed-only sheet (no manual edits)
- Eliminated conflict resolution / sync complexity — no competing writers
- Removed `dataImport.ts`, `dataSync.ts`, and `spreadsheet-mapping.md` from plan
- Simplified Phase 5 to auto-create dedicated spreadsheet and wire up direct reads/writes

### Phase 6 — Feature Additions, Sync & Polish (2026-02-23)
Completed tasks:
- [x] **Clickable tenant rows**: Whole row navigates to detail page, edit button uses stopPropagation
- [x] **Clear Sheets on delete**: "Tüm Verileri Sil" now clears both localStorage and Google Sheets
- [x] **Auto-sync toggle**: New `autoSync` setting in authStore, checkbox in Settings, "Şimdi Senkronize Et" button
- [x] **Escalating fines (Kademeli Ceza)**: `fineAmount` → `fineAmounts[5]` with 5-tier escalation, configurable repeat period, dynamic tier calculation in FineForm, backward-compatible migration
- [x] **Sortable report tables**: All 3 report tabs now have sortable columns with ArrowUpDown icons
- [x] **Logo & favicon**: Custom logo (building + gavel motif), used in LoginPage, Sidebar, favicon (now JPG)
- [x] **Type cleanup**: Removed `spreadsheetId` from `AuthState` interface
- [x] **Sync info note**: Added "Veriler her giriş yapıldığında Google Sheets'ten yüklenir" in Settings

New files:
- `src/utils/fineCalculation.ts` — `calculateFineAmount()`, `getRepeatPeriod()`, `setRepeatPeriod()`
- `public/logo.jpg` — App logo
- `public/favicon.jpg` — Browser tab icon

Key data model change:
- `InfractionType.fineAmount: number` → `InfractionType.fineAmounts: number[]` (5 tiers)
- Google Sheets headers updated: `fineAmount` → `fineAmount1..fineAmount5`
- Backward-compatible: old data with single `fineAmount` is auto-migrated to 5 equal tiers
