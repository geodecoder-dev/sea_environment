# Architecture & System Design — Solaris Reef Campaign Hub

## 1. Overview & Dual Execution Model

The Solaris Reef Campaign Hub is engineered to run seamlessly across two target execution environments while executing identical, authoritative business logic:

1. **Cloudflare Edge (Pages Functions & Workers)**:
   - Primary production environment.
   - Database: Cloudflare D1 (distributed SQL database based on SQLite).
   - Storage: Cloudflare R2 object storage for campaign media and dive photos.
   - Runtime: V8 isolates with native Web APIs (`crypto.subtle`, `fetch`, `Headers`, `Request`, `Response`).
   - Entrypoint: `functions/api/[[route]].ts`.

2. **Self-Hosted / Node.js Runtime (Express Adapter)**:
   - Development server and containerized deployments.
   - Entrypoint: `server.ts`.
   - Mounts Vite middlewares in dev mode, serves static assets in production, and translates Express requests into standard Web `Request`/`Response` instances to invoke `handleUniversalApiRequest`.

```
           +-----------------------------+
           |     HTTP Client / Browser   |
           +--------------+--------------+
                          |
              +-----------+-----------+
              |                       |
              v                       v
    +--------------------+  +--------------------+
    | Cloudflare Pages   |  | Node.js / Express  |
    | Functions Adapter  |  | Server Adapter     |
    | ([[route]].ts)     |  | (server.ts)        |
    +---------+----------+  +---------+----------+
              |                       |
              +-----------+-----------+
                          |
                          v
        +-----------------------------------+
        |  Universal API Router             |
        |  (server/api-router.ts)           |
        +-----------------+-----------------+
                          |
      +-------------------+-------------------+
      |                   |                   |
      v                   v                   v
+-------------+     +-------------+     +-------------+
| Payment Svc |     | Auth Svc    |     | Receipt Svc |
| (Billplz /  |     | (Web Crypto |     | (HTML Escape|
| Simulator)  |     | PBKDF2/HMAC)|     | & Resend)   |
+------+------+     +------+------+     +------+------+
       |                   |                   |
       +-------------------+-------------------+
                           |
                           v
              +-------------------------+
              | Database Layer          |
              | (server/db.ts)          |
              +------------+------------+
                           |
            +--------------+--------------+
            |                             |
            v                             v
  +--------------------+       +--------------------+
  | Cloudflare D1 SQL  |       | In-Memory Store    |
  | (Durable Prod)     |       | (Isolated Testing) |
  +--------------------+       +--------------------+
```

---

## 2. Directory & Module Boundaries

- **`shared/pricing.ts`**: Single source of truth for pricing constants, entitlements, and benefit tier calculations shared between frontend React components and backend services.
- **`server/config/index.ts`**: Centralized environment variable parser and validator with strict production guardrails.
- **`server/auth/index.ts`**: Web Crypto PBKDF2 password derivation, constant-time verification (`timingSafeEqual`), signed HMAC-SHA256 session tokens, and login rate limiting.
- **`server/payments/provider.ts`**: Unified `PaymentProvider` interface.
- **`server/payments/billplz.ts`**: Billplz gateway implementation with RFC-compliant X-Signature generation, sandbox/live URL isolation, and webhook decoding.
- **`server/services/receipts.ts`**: Authoritative paid status gating, HTML escaping, and official receipt template rendering.
- **`server/services/pricing.ts`**: Entitlement calculations for presets (RM 50, RM 100, RM 500) and custom amounts.
- **`server/middleware/security.ts`**: CORS allowlist management, CSV formula injection neutralization, rate limiting, and defensive security headers.
- **`server/db.ts`**: Cloudflare D1 adapter with durable error propagation (never silently swallowing write errors into ephemeral memory) and atomic payment state machine.

---

## 3. Request Flow & Trust Boundaries

1. **Client Submission (`DonationSection.tsx`)**:
   - Submits donation options to `POST /api/donations/checkout`.
   - Server validates amounts (strictly parsed integer, RM 50 minimum, RM 100,000 maximum).
   - Generates friendly reference (`SOL-YYYYMM-XXXX`) and 128-bit cryptographically secure `verificationToken`.
   - Creates bill via Billplz or simulator.
   - Durably inserts record with `payment_status = 'pending'`. If D1 fails, the request fails with 503 (no phantom donations).

2. **Payment Callback (`POST /api/webhooks/billplz`)**:
   - Webhook callback is received directly from Billplz.
   - Computes HMAC-SHA256 of sorted pipe-separated payload parameters using `BILLPLZ_X_SIGNATURE_KEY`.
   - Compares signatures using timing-safe comparison.
   - Transitions state atomically: `pending -> paid`.
   - If payment status is already `paid`, the callback is idempotent (duplicate ignored).
   - Late failure or cancellation callbacks are rejected from reverting paid transactions.
   - Emits official receipt asynchronously via email.

3. **Public Verification (`/donation/result?token=...`)**:
   - Client queries `/api/donations/lookup` using the secure 128-bit `verificationToken`.
   - Returns sanitized record with calculated entitlements.
   - Sensitive donor email addresses are never disclosed.
