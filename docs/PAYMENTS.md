# Payment Architecture & Billplz Gateway Integration

## 1. Gateway Status & Readiness

> **IMPORTANT**: Live payments are **NOT active** out-of-the-box. The application is completely wired and ready for Billplz, but live transactions remain safely disabled until production credentials and webhook secrets are configured.

### Environment Modes
1. **Sandbox Simulation Mode (Local Development & Testing)**:
   - Enabled when `ENABLE_PAYMENT_SIMULATION=true` (strictly disabled if `NODE_ENV=production`).
   - Uses simulated bill endpoints (`/billplz-simulation/:billId`) to test success, cancellation, and failure states without external network dependencies.
2. **Billplz Sandbox Mode (Pre-production Testing)**:
   - Configured with `BILLPLZ_SANDBOX=true` and sandbox API credentials from `https://www.billplz-sandbox.com`.
   - Uses real Billplz Sandbox bills, redirects, and webhooks.
3. **Billplz Live Production Mode**:
   - Configured with `BILLPLZ_SANDBOX=false` and production API credentials from `https://www.billplz.com`.

---

## 2. Billplz X-Signature Verification Algorithm

To prevent unauthorized webhook spoofing and payload tampering, callbacks received on `POST /api/webhooks/billplz` must verify the Billplz `x_signature`:

1. **Extract Parameters**: Collect all key-value pairs from the webhook payload excluding `x_signature`.
2. **Alphabetical Sorting**: Sort parameter keys alphabetically.
3. **Pipe Concatenation**: Concatenate the string values of sorted keys joined by the pipe `|` character:
   ```
   dataString = sortedKeys.map(k => String(params[k])).join('|')
   ```
4. **HMAC-SHA256**: Compute HMAC-SHA256 of `dataString` using the `BILLPLZ_X_SIGNATURE_KEY` secret.
5. **Timing-Safe Comparison**: Compare the resulting hex digest with the received `x_signature` using constant-time comparison (`timingSafeEqual`).

---

## 3. Authoritative Payment State Machine

```
                  +-----------+
                  |  Created  |
                  +-----+-----+
                        |
                        v
                  +-----------+
      +---------->|  Pending  |<----------+
      |           +-----+-----+           |
      |                 |                 |
      |   Valid Payment |                 |
      |   (Callback/Sig)|                 |
      |                 v                 |
      |           +-----------+           |
      |           |   Paid    |           |
      |           +-----+-----+           |
      |                 |                 |
      |                 | (Terminal)      |
      |                 v                 |
      |          +-------------+          |
      |          | Paid State  |          |
      |          | Immutable   |          |
      |          +-------------+          |
      |                                   |
      | Gateway Failure   Gateway Cancel  |
      v (Callback)        v (Callback)    |
+-----------+       +-----------+         |
|  Failed   |       | Cancelled |---------+
+-----------+       +-----------+
```

### State Transition Rules
- **`pending` -> `paid`**: Validated webhook callback with `paid: true`. Emits receipt.
- **`pending` -> `failed`**: Gateway reports payment declined or timed out.
- **`pending` -> `cancelled`**: User cancels before payment authorization.
- **`paid` -> `paid`**: Idempotent duplicate callback. Returns 200 without duplicated fundraising increments or duplicate receipts.
- **`paid` -> `failed` / `cancelled` (REVERT FORBIDDEN)**: A late callback from a cancelled window or expired tab will NOT revert a confirmed paid donation.

---

## 4. Production Activation Checklist

Before going live with real donor payments:

1. [ ] Create a merchant account on [Billplz.com](https://www.billplz.com).
2. [ ] Complete Bank Negara Malaysia (BNM) merchant verification and link your official Leo-Lion Club bank account.
3. [ ] Generate an API Key under **Settings > General**.
4. [ ] Create a Collection titled `Solaris Reef Coral Restoration Initiative` and note the `Collection ID`.
5. [ ] Generate an **X-Signature Key** under **Settings > General** and keep it strictly confidential.
6. [ ] Set the following secrets in Cloudflare Pages dashboard (**Settings > Variables and secrets**):
   - `BILLPLZ_API_KEY`: `<Your Production Billplz API Key>`
   - `BILLPLZ_COLLECTION_ID`: `<Your Production Collection ID>`
   - `BILLPLZ_X_SIGNATURE_KEY`: `<Your Production X-Signature Key>`
   - `BILLPLZ_SANDBOX`: `false`
   - `ENABLE_PAYMENT_SIMULATION`: `false`
   - `CANONICAL_APP_URL`: `https://solaris-reef.pages.dev`
7. [ ] Run a test payment of RM 50.00 using a live FPX account to verify that webhook callbacks, receipts, and database persistence execute smoothly.
