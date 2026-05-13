# CLAUDE.md — InvoiceSmart-iOS

Expo + React Native companion app for the InvoiceSmart backend
(`/root/InvoiceSmart-backend/`). Pulled into the workspace on 2026-05-13;
not yet integrated into the macos-15 TestFlight pipeline that
BuildTrack-iOS uses.

## Stack

- **Runtime**: React Native 0.81.5, React 19, Expo SDK 55
- **UI**: NativeWind 2.0 (Tailwind 3.3 for RN), `lucide-react-native` icons, `react-native-chart-kit` for reports
- **Routing**: `expo-router` 55 with file-based routes under `app/`
- **Auth**: JWT in `@react-native-async-storage/async-storage` (see `services/api.ts`)
- **Networking**: axios, base URL from `EXPO_PUBLIC_API_BASE_URL` / `.env.production`'s `API_BASE_URL`
- **TS strict**: yes (per `tsconfig.json`)

## How to run

```bash
# from /root/InvoiceSmart-iOS
npm install                  # one-off
npm start                    # expo start
npm run ios                  # expo run:ios — requires a Mac for full build
npm run web                  # expo start --web — local dev only
```

The iOS native build is **EAS-quota-blocked** (see commit `7e59f0c ci(eas): disable push trigger — EAS credits depleted`). To ship to TestFlight, port to the same `macos-15` GHA + manual signing pattern that BuildTrack-iOS uses — see `/root/.claude/projects/-root/memory/reference_ios_stack_playbook.md`.

## Screen layout (Expo Router)

| Path | File | Backend dependency |
|------|------|--------------------|
| `/auth/login`, `/auth/register` | `app/auth/*.tsx` | `POST /api/auth/{login,register}` |
| `/(tabs)/index` (Home) | `app/(tabs)/index.tsx` | `GET /api/reports/dashboard` |
| `/(tabs)/create` (New invoice) | `app/(tabs)/create.tsx` | `POST /api/invoices`, `GET /api/clients`, `GET /api/invoices/next/number` |
| `/(tabs)/history` | `app/(tabs)/history.tsx` | `GET /api/invoices`, `PATCH /api/invoices/:id/paid` |
| `/(tabs)/clients` | `app/(tabs)/clients.tsx` | `clients` CRUD |
| `/(tabs)/ledger` | `app/(tabs)/ledger.tsx` | `transactions` CRUD |
| `/(tabs)/taxes` | `app/(tabs)/taxes.tsx` | `GET /api/reports/tax-estimate`, `tax-rules` CRUD |
| `/(tabs)/reports` | `app/(tabs)/reports.tsx` | `/api/reports/*` |
| `/(tabs)/audit` | `app/(tabs)/audit.tsx` | `GET /api/ai/audit-invoice/:id` |
| `/(tabs)/ai` (Assistant) | `app/(tabs)/ai.tsx` | `POST /api/ai/{chat,generate-invoice}` |
| `/(tabs)/settings` | `app/(tabs)/settings.tsx` | `settings` get/put |

## API contract

The base URL is determined at app start:

- `dev`: `http://127.0.0.1:3008` (when running Metro on the same machine)
- `prod`: `https://api.invoicesmart.cortexbuildpro.com` (per `.env.production`)

Every authenticated request must set `Authorization: Bearer <jwt>`. The token comes from `auth/login` or `auth/register` response and is persisted via `lib/storage.ts`.

**Money strings**: the backend returns `DECIMAL(12,2)` as JSON strings. Always `parseFloat` before arithmetic. The shape is mirrored in `types.ts`.

**Rates are percentages**: `tax_rate: 20` means 20%, not 0.20.

## Build pipeline status

Recent commits show the team wrestling Expo SDK 55 + Xcode 16 + Swift strict concurrency:

- `7e59f0c ci(eas): disable push trigger — EAS credits depleted; keep manual dispatch only`
- `e6c86a0 ci(xcode): switch to macos-14 runner to fix Swift concurrency errors with Xcode 15`
- `ad3aab2 ci(xcode): re-add SWIFT_STRICT_CONCURRENCY=minimal to suppress expo-modules-core strict concurrency errors on Xcode 16`
- `ae3d177 fix(app): disable newArchEnabled to fix Xcode 16 + expo-modules-core Swift concurrency errors`

**Until EAS credits return or the macos-15 native pipeline lands, treat this repo as web/Metro-only.**

## Editing guidance

- **Touching `services/api.ts`** — confirm the route name matches `/root/InvoiceSmart-backend/src/openapi.yaml`. The backend's `/api/openapi.json` is the source of truth; generate a client from it if drift becomes painful.
- **Adding a new screen** — `expo-router` auto-routes any new `app/**/*.tsx`. Wrap navigation in the `(tabs)` group only if the screen should appear in the bottom tab bar.
- **Alert / Toast** — use `components/ErrorToast.tsx` (cross-platform) rather than `Alert.alert`, because per memory `Alert.alert` is a no-op on RN Web.
- **NativeWind classes** — `tailwind.config.js` is intentionally minimal; extend `theme.extend` rather than adding a separate stylesheet.

## Known issues

- Empty UI on web export — Expo Router's static export emits an empty `<title>` placeholder that wins (per memory `feedback_expo_static_title_strip`). If/when this repo ships a `--web` build to nginx, add the `sed`-strip step to the deploy workflow.
- `expo lint` is silent — per `cortexbuild-field`'s lint memo, `expo lint` hides warnings; if you want everything, run `eslint .` directly.

## Cross-references

- Backend: `/root/InvoiceSmart-backend/CLAUDE.md` — routes, env, deployment, money model.
- Workspace overview: `/root/CLAUDE.md` "Subprojects" table.
- iOS playbook: `/root/.claude/projects/-root/memory/reference_ios_stack_playbook.md` — when to touch which repo, TestFlight failure decoder, manual signing on macos-15.
