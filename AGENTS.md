<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Clavis — Agent Guide

## Stack
- **Next.js 16.2.9** — App Router only, React 19.2, TypeScript strict (`"strict": true`)
- **React Query** v5 (`@tanstack/react-query` ^5.101.2) — staleTime 60s, retry 1, refetchOnWindowFocus off
- **shadcn/ui** style variant `"radix-nova"` (check `components.json`)
- **Tailwind v4** — `@import "tailwindcss"` (no tailwind.config), `@import "shadcn/tailwind.css"`, `@theme inline` for custom tokens
- **Forms**: react-hook-form v7 + zod v4 + @hookform/resolvers v5

## Commands
- `npm run dev` — dev server at localhost:3000
- `npm run build` — production build
- `npm run lint` — ESLint (flat config, `eslint-config-next/core-web-vitals` + typescript)
- `npx tsc --noEmit` — type check (must pass before PR)
- **No test runner or test files exist** — do not look for tests

## CRITICAL: Monetary rule
All amounts are in **kobo** (Nigerian currency subunit, 100 kobo = ₦1).
Display only via `formatNGN()` in `lib/format.ts`.
Never send Naira to Nomba (`initiateTransfer` divides by 100 for the API).
Never use dollars, cents, or USD anywhere.

## Middleware: `proxy.ts` (NOT `middleware.ts`)
`proxy.ts` is the middleware file (Next.js convention matches files named `middleware` but this file works via `auth()` wrapping).
- Logged in + `/sign-in`, `/sign-up`, or `/` → redirect to `/home`
- Logged out + `/home`, `/vault/*`, `/join-vault` → redirect to `/sign-in`
- Matcher: everything except `api|_next/static|_next/image|favicon.ico`

## Route groups & URLs
| Group | Pages |
|-------|-------|
| `(auth)` | `/sign-in`, `/sign-up` |
| `(authenticated)` | `/home`, `/vault/[vaultId]`, `/vault/create/*` |
| `(marketing)` | `/` landing page |
| (root) | `/join-vault?token=` |

Vault creation flow: `/vault/create/name` → `/vault/create/[vaultId]/invite` → `/vault/create/[vaultId]/quorum` → `/vault/create/[vaultId]/review`

## Auth conventions
- Use `auth()` from root `auth.ts` in server components & API routes — never `getServerSession()`
- Use `signIn`/`signOut` from `next-auth/react` in client components only
- Session has `user.id` + `user.phone` extended via JWT callback (see `types/next-auth.d.ts`)
- PIN: 4-digit numeric, bcrypt hashed in DB, validated via zod in `lib/schemas.ts`
- Custom sign-in page at `/sign-in`

## Supabase clients — never mix them
- **`lib/supabase/client.ts`** — browser client (anon key), Realtime subscriptions only. Never use in API routes.
- **`lib/supabase/service.ts`** — service role client (bypasses RLS), used in ALL API routes, auth.ts, webhooks, and cron. Never use in browser components.
- All server writes use service role. Anon key is SELECT-only on realtime tables, blocked from writes.

## React Query conventions
- All query keys in `lib/query-keys.ts` — never hardcode strings
- All mutations handle `onMutate` (optimistic), `onError` (rollback), `onSettled` (invalidate)
- `useVaultQuery(vaultId)` / `useVaultsQuery()` for data; `useVaultRealtime(vaultId)` for sync
- No context state for vault data — URL + React Query only

## API routes
| Route | Purpose |
|-------|---------|
| `auth/[...nextauth]` | next-auth handlers |
| `auth/register` | Create user + sign-up |
| `auth/session` | GET current session |
| `vaults/` | List, create vaults |
| `vaults/[vaultId]/*` | Single vault CRUD, stakeholders, transactions, approval/reject, fund, found, draft, reconciliation |
| `transfers/` | Initiate payout |
| `transfers/lookup` | Lookup recipient |
| `webhooks/nomba` | Nomba webhook receiver |
| `reconcile` | Vercel Cron (daily midnight, protected by `CRON_SECRET` bearer) |
| `vaults/cleanup` | Stale draft cleanup |
| `invitations` | Link invitations |
| `health` | Health check |

## Nomba integration
- **Auth endpoint**: `POST /v1/auth/token/issue` (NOT `/grant`)
- **Token caching**: auto-cached in memory for 55 min — do not call `getAccessToken()` per request
- **Headers**: every API call needs `Authorization: Bearer` + `accountId` header
- **Recipient lookup**: always call `lookupRecipient()` before `initiateTransfer()`
- **`initiateTransfer`**: amount in kobo, but sends `amount/100` to Nomba (Nomba expects Naira)
- **Webhook signature**: HMAC-SHA256 of a **colon-separated formatted string** — NOT the raw body. Format: `{event_type}:{requestId}:{userId}:{walletId}:{transactionId}:{type}:{time}:{responseCode}:{timestamp}`
- **Webhook events** (in `lib/nomba/webhook-types.ts`): `payment_success`, `payout_success`, `payout_failed` — these exact names only
- **Idempotency**: dedup via `webhook_events` table (unique `request_id`)
- Always return 200 immediately via `after()` from `next/server` — never make Nomba wait for processing
- `merchantTxRef` must be tagged in every log entry

## Custom CSS classes
Defined in `app/globals.css` (`@layer components`): `.mono`, `.serif`, `.engraved`, `.btn-mech` (and `-primary`, `-ghost`, `-danger`), `.hairline`, `.hairline-strong`, `.grain`, `.key-slot`, `.key`, `.seal-stamp`
Defined via `<style>` tag in `components/shared/input-styles.tsx`: `.input-mech`
CSS color tokens: `--ink`, `--ink-muted`, `--ink-faint`, `--brass`, `--paper`, `--secondary`, `--crimson`, `--rule`, `--rule-strong`, `--brass-deep`, `--brass-soft`, `--card`

## Logging
Use `log()` from `lib/logger.ts` for ALL server-side logging (API routes, webhooks, Nomba, cron). Never `console.log`. Always include `merchantTxRef` and `vaultId` where available.

## RLS policy approach
- All server writes use service role client (bypasses RLS)
- Anon key: SELECT only on realtime tables (`vaults`, `transactions`, `transaction_approvals`, `stakeholders`, `reconciliation_logs`). Blocked from all writes. Blocked from `users`, `webhook_events`, `invitations`.

## Reconciliation job
`GET /api/reconcile` — Vercel Cron daily at midnight (`0 0 * * *` in `vercel.json`). Protected by `Authorization: Bearer CRON_SECRET`. Compares Nomba `/transactions/accounts` against local ledger. Writes results to `reconciliation_logs`.

## Common agent mistakes
- Using `getServerSession()` instead of `auth()` from root `auth.ts`
- Using the browser Supabase client in an API route (use service client)
- Sending Naira to Nomba instead of kobo (or rounding kobo carelessly — always integer before send)
- Parsing the raw webhook body for signature verification (Nomba signs a colon-separated string, not the body)
- Using wrong Nomba event type names (`virtual_account.funded`, `transfer.success`, `transfer.failed` are wrong)
- Calling `getAccessToken()` on every Nomba request (cached for 55 min)
- Using `console.log` instead of `log()` from `lib/logger.ts`
- Hardcoding credentials or secrets