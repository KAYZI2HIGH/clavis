<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/Clavis-%231a1a18?style=for-the-badge">
    <img alt="Clavis" src="https://img.shields.io/badge/Clavis-%231a1a18?style=for-the-badge">
  </picture>
</p>

<p align="center"><strong>A multi-signatory business vault for Nigerian business partners, built on Nomba.</strong></p>

<p align="center">
  <a href="https://clavis-navy.vercel.app">clavis-navy.vercel.app</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js_16-000?logo=next.js&logoColor=fff" alt="Next.js 16">
  <img src="https://img.shields.io/badge/TypeScript_5-3178C6?logo=typescript&logoColor=fff" alt="TypeScript">
  <img src="https://img.shields.io/badge/Supabase-3FCF8E?logo=supabase&logoColor=fff" alt="Supabase">
  <img src="https://img.shields.io/badge/Nomba-1a1a18?logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyNCIgY3k9IjI0IiByPSIyNCIgZmlsbD0iI0ZGRiIvPjwvc3ZnPg==&label=Nomba" alt="Nomba">
  <img src="https://img.shields.io/badge/Vercel-000?logo=vercel&logoColor=fff" alt="Vercel">
</p>

---

## What is Clavis?

Clavis is a shared investment vault that gives Nigerian investors real-time visibility and programmable financial control over the businesses they fund, built on Monnify's payment infrastructure.

### The Problem
When Nigerians invest in a friend's or partner's business, they send money and hope. There is no visibility into how funds are spent, no guarantee that revenue is being declared honestly, no mechanism to enforce returns, and no protection if the founders decide to stop paying. The investor has a WhatsApp group and nothing else. This is not a fringe problem — informal business investment is one of the primary ways capital moves in the Nigerian economy, and it happens almost entirely on trust with zero infrastructure.

### The Solution
Clavis gives every investment deal its own dedicated vault powered by two Monnify Reserved Accounts — one for investor capital, one for business revenue. Because customer payments land in a designated revenue account rather than a founder's personal account, the system automatically separates revenue from capital at the point of entry with no manual tagging required.

Investors set their terms upfront — profit share percentage, fixed return, or a hybrid cap — and define Standing Orders that let operators run the business freely within agreed boundaries. Routine payments like payroll execute automatically when they match a Standing Order. Anything outside those boundaries requires the investor's explicit approval before Monnify moves a single naira.

At the end of every month, the investor's share of net revenue is calculated from verified vault data and disbursed automatically to their bank account via Monnify. Founders cannot delay, withhold, or manipulate the settlement — the math is public, the transfers are automatic, and the audit trail is permanent.

### What Makes Clavis Unique
Every other business finance tool in Nigeria is built for the operator — the person running the business. Clavis is built for the investor — the person whose money is at risk.

The two-account architecture is the core innovation. By routing revenue and capital through separate Monnify Reserved Accounts, Clavis makes revenue integrity automatic rather than trust-based. No other product on Nigerian payment rails does this.

Combined with programmable Standing Orders, automatic monthly settlement, and real-time transaction visibility, Clavis turns an informal handshake investment into a structured, enforceable financial relationship — without requiring lawyers, contracts, or a formal company structure.

---

## Features

### Vault Management
- Create shared vaults with 2–5 partners
- Configurable quorum threshold (e.g., 2 of 3 partners must approve any payout)
- Real-time balance updates across all connected partners via Supabase Realtime
- Nightly reconciliation against Nomba transaction history (Vercel Cron)

### Multi-Signatory Approvals
- Any member can request a payout to a Nigerian bank account
- Funds are locked until the quorum threshold is reached
- Every approval is logged immutably with the signer's identity and timestamp
- Decliners must provide a reason — full audit trail preserved
- Sealed payouts are executed automatically via Nomba's transfer API

### Nomba Integration
- Dedicated Virtual Account (real NUBAN) per vault
- Recipient name verification via Nomba's bank lookup API before every transfer
- HMAC-SHA256 webhook verification using a colon-separated signed string
- Idempotent event processing via `requestId` deduplication in a Supabase table
- Atomic balance updates via Supabase RPC
- Token caching with 55-minute TTL (never re-authenticates per request)

### Security
- 4-digit PIN authentication with bcrypt hashing (12 rounds)
- Row-level security on all Supabase tables
- Anon key blocked from all writes; only the service role key can mutate data
- JWT session strategy with extended `id` and `phone` fields
- Webhook endpoints protected by HMAC signature verification
- Cron job endpoint protected by bearer token (`CRON_SECRET`)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 16.2.9](https://nextjs.org) (App Router) |
| Language | [TypeScript 5](https://www.typescriptlang.org) (strict mode) |
| Auth | [NextAuth v5 beta](https://next-auth.js.org) (Credentials provider, JWT) |
| Database | [Supabase](https://supabase.com) (PostgreSQL + RLS + Realtime) |
| Payments | [Nomba API](https://nomba.com) (Virtual Accounts, Transfers, Webhooks) |
| Realtime | [Supabase Realtime](https://supabase.com/docs/guides/realtime) |
| UI | [shadcn/ui](https://ui.shadcn.com) (radix-nova style) + [Tailwind CSS v4](https://tailwindcss.com) |
| Forms | [React Hook Form](https://react-hook-form.com) + [Zod](https://zod.dev) + [@hookform/resolvers](https://github.com/react-hook-form/resolvers) |
| Data Fetching | [TanStack Query v5](https://tanstack.com/query/latest) |
| Deployment | [Vercel](https://vercel.com) (with Vercel Cron) |

---

## Architecture Overview

- **URL-based routing**: `proxy.ts` (not `middleware.ts`) wraps `auth()` from NextAuth. Logged-in users on public pages are redirected to `/home`; unauthenticated users on protected pages go to `/sign-in`.
- **No client context**: Vault data is driven entirely by URL parameters + React Query. No global context providers for vault state.
- **Optimistic updates**: All mutations update the React Query cache immediately, then roll back on API failure.
- **Realtime sync**: `useVaultRealtime` subscribes to Supabase Realtime on the vault's `vaults`, `transactions`, and `stakeholders` channels, invalidating the React Query cache on DB changes.
- **Webhook handler**: The Nomba webhook endpoint at `/api/webhooks/nomba` verifies an HMAC-SHA256 signature over a **colon-separated formatted string** (not the raw body), deduplicates by `requestId` in the `webhook_events` table, and responds immediately with a `200` via Next.js `after()`. Actual processing happens asynchronously.
- **Reconciliation**: A Vercel Cron job runs nightly at midnight (`0 0 * * *`) comparing Nomba's `/transactions/accounts` endpoint against the local ledger. Discrepancies are resolved automatically (orphan credits credited, failed transfers refunded, stuck settlements finalized) and logged to `reconciliation_logs`.

---

## Prerequisites

- **Node.js 18+**
- **npm**
- **Supabase account** — [supabase.com](https://supabase.com)
- **Nomba developer account** — [nomba.com](https://nomba.com)
- **Vercel account** (recommended for deployment + cron)

---

## Local Setup

### 1. Clone the repo

```bash
git clone https://github.com/[your-username]/clavis.git
cd clavis
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

```bash
cp .env.local.example .env.local
```

Fill in all values. See the [Environment Variables](#environment-variables) section below.

### 4. Set up Supabase

1. Create a new Supabase project.
2. Run the database migrations against your Supabase project (see [Database Setup](#database-setup)).
3. Enable **Realtime** on these tables in the Supabase dashboard:
   - `vaults`
   - `transactions`
   - `transaction_approvals`
   - `stakeholders`
   - `reconciliation_logs`
4. Copy your project URL, anon key, and service role key from the Supabase dashboard settings into `.env.local`.

### 5. Generate AUTH_SECRET

```bash
npx auth secret
```

Paste the output into `AUTH_SECRET` in `.env.local`.

### 6. Start the dev server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000). Create an account with a 4-digit PIN and start a vault.

---

## Database Setup

The project expects the following Supabase tables. Run these migrations via the Supabase dashboard SQL editor or your preferred migration tool.

**Tables:**

- `users` — application users (id, full_name, email, phone, pin_hash, created_at)
- `vaults` — shared vaults (id, name, quorum, founder_id, status, balance_kobo, funding_account, nomba_virtual_account_number, nomba_virtual_account_bank, created_at, updated_at)
- `stakeholders` — vault membership (id, vault_id, name, email, phone, initials, is_founder, created_at)
- `transactions` — payout requests and settlements (id, vault_id, recipient_name, recipient_account, recipient_bank_code, recipient_bank_name, amount_kobo, memo, narration, status, requested_by, requested_at, required_quorum, approvals, sealed_at, settled_at, declined_by, decline_reason, nomba_tx_ref)
- `transaction_approvals` — individual key turns (id, transaction_id, stakeholder_id, created_at)
- `vault_invites` — vault invitations
- `link_invitations` — token-based invite links (id, vault_id, token, placeholder, invited_by, status, created_at)
- `email_invites` — email-based invitations (id, vault_id, name, email, initials, invited_by, status, created_at)
- `pending_joins` — join requests from invite links (id, vault_id, name, initials, via_token, requested_at)
- `webhook_events` — idempotency tracking for Nomba webhooks (id, request_id, event_type, created_at)
- `reconciliation_logs` — nightly reconciliation results (id, vault_id, run_at, total_checked, discrepancies_found, resolved, orphans_credited, critical, status)

All tables have RLS enabled. Server-side code uses the **service role key** (bypasses RLS). The anon key has `SELECT` access only on the realtime-enabled tables listed above.

---

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `NEXTAUTH_URL` | Your application URL (`http://localhost:3000` for local dev) | Yes |
| `AUTH_SECRET` | NextAuth encryption secret (generate with `npx auth secret`) | Yes |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous (public) key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (DO NOT expose to the browser) | Yes |
| `NOMBA_CLIENT_ID` | Nomba OAuth client ID | Yes |
| `NOMBA_CLIENT_SECRET` | Nomba OAuth client secret | Yes |
| `NOMBA_ACCOUNT_ID` | Nomba parent account ID | Yes |
| `NOMBA_SUBACCOUNT_ID` | Nomba sub-account ID for transfers | Yes |
| `NOMBA_WEBHOOK_SECRET` | Nomba webhook HMAC signing key | Yes |
| `NOMBA_ENV` | Nomba environment — `live` or `test` | Yes |
| `CRON_SECRET` | Bearer token protecting the Vercel Cron `/api/reconcile` endpoint | Yes |

### Important notes on Nomba environment variables

- Use **test credentials** during local development (`NOMBA_ENV=test`). The sandbox base URL is `https://sandbox.nomba.com/v1`.
- The Nomba **auth endpoint** is `POST /v1/auth/token/issue` (not `/grant`).
- Every API call requires both `Authorization: Bearer <token>` and `accountId` headers.
- The Nomba webhook signature uses **HMAC-SHA256 of a colon-separated formatted string**, not the raw webhook body. The format is `{event_type}:{requestId}:{userId}:{walletId}:{transactionId}:{type}:{time}:{responseCode}:{timestamp}`.

---

## Webhook Setup

1. Register your webhook URL with Nomba:
   ```
   https://your-app.vercel.app/api/webhooks/nomba
   ```
2. Nomba sends events with these event types (use these exact names):
   - `payment_success` — virtual account credited
   - `payout_success` — transfer completed
   - `payout_failed` — transfer failed (balance auto-refunded)
3. Set your `NOMBA_WEBHOOK_SECRET` environment variable to the signing key Nomba provides.
4. The webhook handler verifies the `nomba-signature` header against the colon-separated payload format described above, then returns `200` immediately and processes the event asynchronously via `after()`.

---

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Next.js dev server at `localhost:3000` |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint (flat config, core-web-vitals + TypeScript rules) |
| `npx tsc --noEmit` | Type check the entire project (must pass before any PR) |

There are **no test files** in this repository.

---

## Deployment

Deploy to Vercel (recommended):

1. Push your repo to GitHub.
2. Connect the repository in the Vercel dashboard.
3. Add all environment variables from `.env.local` to the Vercel project.
4. Vercel Cron is configured automatically via `vercel.json` — the reconciliation job runs nightly at midnight (WAT).
5. Deploy.

### Health Check

Visit `/api/health` (or `/api/health` with `Accept: text/html` for a browser-friendly page) to confirm:

- Supabase connection status
- Nomba authentication status
- Current environment (test/live)

---

## Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/your-feature`.
3. Make your changes.
4. Run `npm run lint` and `npx tsc --noEmit`.
5. Open a pull request.

---

## License

[MIT](./LICENSE)

---

<p align="center">Built with ❖ for Nigerian business partners.</p>