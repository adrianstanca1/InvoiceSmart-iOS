# CLAUDE.md — InvoiceSmart-iOS

Expo + React Native client for `/root/InvoiceSmart-backend/`. Pulled
into the workspace 2026-05-13; native build is currently
EAS-quota-blocked. The web/Metro dev experience and the API contract
work end-to-end against the live backend
(`api.invoicesmart.cortexbuildpro.com`).

## Stack

- **Runtime**: React Native 0.81, React 19, Expo SDK 55
- **UI**: NativeWind (Tailwind for RN). Hermes has an in-flight v2→v4 migration — see *Known issues* below.
- **Routing**: `expo-router` 55, file-based routes under `app/`
- **State**: per-screen local state (no Redux/Zustand)
- **Auth**: JWT in `@react-native-async-storage/async-storage`
- **Networking**: axios → `services/api.ts`, base URL via `EXPO_PUBLIC_API_URL` env (or production default in code)
- **PDF**: `expo-print` + inline HTML template (no external template files)

## Project layout

```
app/
  _layout.tsx                # root navigator
  auth/{login,register}.tsx  # bearer-token flow
  (tabs)/                    # 10 tabs after login
    index.tsx                # Dashboard (reports/dashboard)
    history.tsx              # Invoice list + filter + delete
    create.tsx               # Build / edit / send / mark-paid / PDF
    clients.tsx              # Client CRUD
    ledger.tsx               # Transactions (income/expense)
    taxes.tsx                # Tax-rule CRUD
    reports.tsx              # P&L + revenue-by-client + CSV export
    audit.tsx                # Audit log viewer
    ai.tsx                   # AI Accountant chat
    settings.tsx             # AI provider + invoice prefix + sign-out
components/                  # ClientPicker, StatusBadge, ErrorToast, ...
services/api.ts              # ALL backend calls. See "API contract" below.
lib/format.ts                # toNum, fmtMoney, fmtDate, statusLabel, ...
types.ts                     # Mirrors InvoiceSmart-backend/src/openapi.yaml
scripts/contract-smoke.sh    # Empirical contract validation (61 assertions)
.env.production              # Holds API_BASE_URL (legacy — see Known issues)
```

## API contract

`services/api.ts` is the single source of truth on the client side.
**Do not reinvent the wheel** — every screen imports from there. The
backend's authoritative spec is at
`/root/InvoiceSmart-backend/src/openapi.yaml`, served live at
`https://api.invoicesmart.cortexbuildpro.com/api/docs`.

Conventions (mirroring the backend):

- **Entity rows are snake_case**: `invoice_number`, `due_date`, `client_id`, `is_default`, etc. Use `lib/format.ts` to map these to UI strings — never assume camelCase.
- **Money + rates are DECIMAL strings**: `total_amount: "5400.00"`, `tax_rate: "20.00"` (a *percentage* — 20 means 20%, not 0.20). ALWAYS pass through `toNum()` before arithmetic.
- **Status enums are lowercase**: `'draft' | 'sent' | 'partial' | 'paid'`. Display labels come from `statusLabel()`.
- **List endpoints return `{ data: T[], pagination }`** (e.g. `getInvoices`, `getClients`, `getTransactions`, `getTaxRules`).
- **Single-entity endpoints return the bare row** (`getClient`, `getInvoice`, `createClient`, ...).
- **Auth endpoints return `{ token, user: { id, email } }`** — the minimal user. Use `getCurrentUser()` for the full profile via `/api/auth/me`.
- **Reports + AI routes use camelCase** (`totalRevenue`, `profitAndLoss.netProfit`, `summary`, `recommendations`).

`register()` takes `{ email, password, first_name?, last_name?, company_name?, vat_number?, phone? }` — NOT a single `name` string. Screens that collect a single "Full name" must split on first whitespace (`auth/register.tsx` does this).

## How to run

```bash
# from /root/InvoiceSmart-iOS
npm install                  # one-off
npx tsc --noEmit             # contract typecheck (must exit 0 before push)
npm start                    # expo start — runs Metro
npm run web                  # web preview (Alert.alert is no-op on web)
npm run ios                  # native build — REQUIRES a Mac
```

To smoke-test the live contract end-to-end:

```bash
./scripts/contract-smoke.sh
# or against production:
API=https://api.invoicesmart.cortexbuildpro.com ./scripts/contract-smoke.sh
```

The script creates a fresh test user, exercises every shape `services/api.ts` produces, and asserts the response shapes match `types.ts`. **61 assertions; all must pass before considering the contract sound.** Failures mean iOS and backend have drifted — fix the side that's wrong, not the test.

## Screens → endpoints

| Screen | Backend endpoint(s) |
|--------|---------------------|
| `auth/login` | `POST /api/auth/login` |
| `auth/register` | `POST /api/auth/register` (splits "Full name" → first_name + last_name) |
| `(tabs)/index` | `GET /api/reports/dashboard`, `GET /api/reports/revenue-trend` |
| `(tabs)/history` | `GET /api/invoices`, `GET /api/clients`, `DELETE /api/invoices/:id` |
| `(tabs)/create` | `GET /api/invoices/:id`, `POST /api/invoices`, `PUT /api/invoices/:id`, `POST /api/invoices/:id/send`, `PATCH /api/invoices/:id/paid`, `POST /api/ai/generate-invoice` |
| `(tabs)/clients` | `clients` CRUD |
| `(tabs)/ledger` | `transactions` CRUD + `POST /api/settings/upload-receipt` |
| `(tabs)/taxes` | `tax-rules` CRUD |
| `(tabs)/reports` | `/api/reports/{profit-loss, top-expenses, tax-estimate, revenue-by-client, export}` |
| `(tabs)/audit` | `GET /api/audit-logs` |
| `(tabs)/ai` | `POST /api/ai/chat`, plus aggregate queries (`/invoices`, `/clients`, `/transactions`) for context |
| `(tabs)/settings` | `GET /api/settings`, `PUT /api/settings`, `logout()` |

## Known issues

- **EAS quota depleted** — `eas build` fails until quota refreshes. To ship to TestFlight, port to the same `macos-15 GHA + manual signing` pattern that BuildTrack-iOS uses (see `/root/.claude/projects/-root/memory/reference_ios_stack_playbook.md`).
- **NativeWind v2→v4 migration is mid-flight** (Hermes) — `package.json`, `package-lock.json`, `eas.json` are currently uncommitted and stale. Until that lands, the source compiles but native runtime will use whatever's actually in `node_modules` at install time. Run `git status` before any `npm install` to see what's pending.
- **Dependabot reports 14 vulnerabilities** (12 high, 2 moderate) — pre-existing in the Expo SDK 55 transitive tree, not introduced here. Track via https://github.com/adrianstanca1/InvoiceSmart-iOS/security/dependabot.
- **`.env.production` uses `API_BASE_URL=`** — Expo only injects `EXPO_PUBLIC_*` env vars into the JS bundle, so this var is **silently ignored at runtime**. The hardcoded production fallback in `services/api.ts:35` is what actually runs. To override per environment, set `EXPO_PUBLIC_API_URL`.
- **`Alert.alert` is a no-op on RN Web** — per the shared workspace memory. Use `components/ErrorToast` for anything that needs to be visible on web preview.
- **PDF generation uses an inline template** — `app/(tabs)/create.tsx:renderInvoiceHtml`. Multi-template support was removed during the contract rewrite to keep the screen state simple; add it back as an optional setting if needed.
- **The backend's PDF route is a stub** — `GET /api/invoices/:id/pdf` returns `{url: "https://demo.pdf"}`. The iOS app currently renders the PDF locally via `expo-print` rather than calling this endpoint. If/when the backend gains real PDF generation, switch `create.tsx:generatePDF` over.

## Editing guidance

- **Adding a new endpoint** — add to `services/api.ts` (don't bypass it from a screen), add the response type to `types.ts` (matching `openapi.yaml` field-for-field), add an assertion to `scripts/contract-smoke.sh`. The smoke is your regression gate.
- **Adding a new screen** — `expo-router` auto-routes `app/**/*.tsx`. Wrap in `(tabs)` only if it's a top-level destination.
- **Money math** — never `parseFloat` or `Number()` inline. Use `toNum()` from `lib/format.ts`. UI display: `fmtMoney()`. Both centralise behaviour for null/undefined/empty-string.
- **Status display** — `statusLabel()` + `statusClasses()` from `lib/format.ts`. Don't reproduce the colour map locally.
- **Alerts on form errors** — `Alert.alert('Cannot save', '...')`. Web preview won't show these; use the `ErrorToast` component if you need cross-platform visibility.

## Build pipeline

Recent Podfile/plugin commits (5280648 onward) document the Xcode-16 + Swift-6 + Expo-modules-core wrestling match. The canonical config-plugin lives at `plugins/podfile-swift-concurrency.js` (ported from BuildTrack). Cross-references:
- `reference_ios_stack_playbook.md` — when to touch which iOS repo
- `feedback_expo_swift6_concurrency_podfile_plugin.md` — the canonical fix + the trap of `SWIFT_VERSION='5.0'` breaking `@MainActor`
- `feedback_p12_password_mismatch_signature.md` — TestFlight signing failure decoder

## Cross-references

- Backend: `/root/InvoiceSmart-backend/CLAUDE.md` — routes, money model, multi-tenant invariants
- Backend OpenAPI: `https://api.invoicesmart.cortexbuildpro.com/api/docs` (Swagger UI) or the raw `src/openapi.yaml`
- Session ledger: `/root/.claude/projects/-root/memory/project_session_2026_05_13_invoicesmart_ios_contract.md`
- Workspace overview: `/root/CLAUDE.md` "Subprojects" table
