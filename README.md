# Solaris Reef — Coral Restoration Campaign Hub
### Leo-Lion Club of KL Solaris (Non-Governmental Organisation)

A modern, interactive, responsive web application built for the **Leo-Lion Club of KL Solaris** to rally community support and fundraise for the **Solaris Reef Coral Restoration & Marine Nursery** flagship initiative in Malaysian waters (Pulau Tioman Marine Park Sanctuary).

---

## 1. Visual & Architectural Design

- **Digital Scrapbook & Curatorial Editorial Aesthetics:**
  - Nature-inspired palette: Warm Off-White (`#FFFDF7`), Sand Beige (`#F4E9D8`), Deep Ocean Navy (`#123047`), Ocean Blue (`#247BA0`), Coral Pink (`#FF7F6A`), Seafoam Green (`#B8E0D2`), and Seaweed Green (`#426B50`).
  - Organic shapes, polaroid-style photography, washi tape accents, and campaign stamps ("Every Fragment Matters", "Protect Our Reefs").
  - High-contrast typography pairing: **Fraunces** (expressive editorial display serif) and **Plus Jakarta Sans** (humanist body sans-serif), with tabular figures for numbers.
  - Zero-pill metadata discipline and strict adherence to anti-slop guidelines.

- **3-Page Architecture:**
  1. `/` — **Public Campaign Homepage**:
     - 3-zone top navigation bar.
     - Striking editorial collage hero with verified metrics.
     - Campaign overview: Why coral reefs matter, the environmental challenge, micro-propagation science, and community divers.
     - Live progress dashboard with dynamic statistics and milestone roadmap.
     - Interactive donation form with presets (RM10, RM25, RM50, RM100) and custom amount, live impact calculation, and Billplz gateway checkout.
     - Field updates feed with category filtering and photography highlights.
     - Transparent NGO footer with contact details and environmental pledge.
  2. `/admin` — **Operations Dashboard (Protected)**:
     - PBKDF2 hashed administrator authentication and secure session tokens.
     - Live overview metrics and audit trail.
     - Campaign settings: Update title, description, targets, and milestones.
     - Field updates management: Create, edit, publish, and delete updates.
     - Donations ledger: Search, filter by status, and export to CSV.
     - Billplz Gateway Diagnostics & Webhook Simulator: Test live callbacks, duplicate callback idempotency, and cryptographic signature rejection.
  3. `/donation/result` — **Payment Outcome & Receipt**:
     - Server-verified transaction verification via `/api/donations/verify/:reference`.
     - Handles Paid, Pending, Cancelled, and Failed states without trusting client-side claims.
     - Receipt print and share options.

---

## 2. Billplz Payment Gateway Integration

The application integrates with the official **Billplz API v3** for Malaysian Ringgit (MYR) donations:

### Payment Lifecycle:
1. **Initiation**: Donor submits contribution on the homepage (`POST /api/donations/checkout`).
2. **Server-Side Validation**: Backend validates donation (minimum RM 5.00), calculates sen integer amount, generates a unique internal reference (e.g. `SOL-202610-A9F4`), and creates a pending donation in the database.
3. **Bill Creation**: Backend connects to `https://www.billplz-sandbox.com/api/v3/bills` (or production) with basic auth. If keys are in local sandbox mode, the smart adapter serves an interactive checkout simulation.
4. **Webhook Callback**: Billplz sends a POST request to `/api/webhooks/billplz`.
5. **Cryptographic Verification**: The backend sorts payload keys alphabetically (excluding `x_signature`), joins with `|`, and computes HMAC-SHA256 with the `BILLPLZ_X_SIGNATURE_KEY`.
6. **Idempotent Update**: Donation status updates to `paid` (or `cancelled`/`failed`). Repeated or duplicate webhooks are acknowledged without inflating totals.
7. **Verified Campaign Total**: Only confirmed `paid` transactions contribute to the fundraising tally.

---

## 3. Environment Variables Configuration

Copy `.env.example` to `.env`:

```bash
# Gemini API (Server side)
GEMINI_API_KEY="your_api_key_here"

# Application URL (for callback and redirect links)
APP_URL="http://localhost:3000"

# Billplz Gateway Configuration
BILLPLZ_SANDBOX="true"
BILLPLZ_API_KEY="your_billplz_api_key_here"
BILLPLZ_COLLECTION_ID="your_billplz_collection_id_here"
BILLPLZ_X_SIGNATURE_KEY="your_billplz_x_signature_key_here"

# Admin Authentication
ADMIN_EMAIL="admin@leolion-solaris.org"
ADMIN_PASSWORD="SolarisReef2026!"
SESSION_SECRET="solaris_reef_secure_session_token_key_change_in_production"
```

---

---

## 4. Git Clone & Setup Workflow

When cloning or pulling this repository to another machine:

### First-Time Clone:
```bash
# 1. Clone the repository
git clone https://github.com/your-org/solaris-reef-hub.git
cd solaris-reef-hub

# 2. Copy the environment configuration template
cp .env.example .env

# 3. Install dependencies
npm install

# 4. Run development server (Hot Module Reloading + Express backend on port 3000)
npm run dev
```

### Git Pull Workflow (Seamless & Conflict-Free):
- **Database Isolation:** Runtime database files (`data/*.json`, `data/*.tmp`) are explicitly ignored in `.gitignore`.
- When you execute `git pull`, local transaction records, new test donations, or admin edits are **never overwritten or conflicted**.
- If a clean seed is ever desired, run:
  ```bash
  npm run db:reset
  ```

---

---

## 5. Production Deployment (Cloudflare Pages)

### Required Pages Secrets
Set these in the Cloudflare Pages Dashboard under **Settings** → **Environment variables** (or via `wrangler secret put <NAME>`):
- `ADMIN_EMAIL` — Primary administrator email for auth bootstrapping.
- `ADMIN_PASSWORD` — Administrator password (minimum 12 characters).
- `SESSION_SECRET` — Cryptographically random secret for HMAC-SHA256 session tokens (minimum 32 characters).
- `BILLPLZ_API_KEY` — Production Billplz Secret Key.
- `BILLPLZ_COLLECTION_ID` — Production Billplz Collection ID.
- `BILLPLZ_X_SIGNATURE_KEY` — Production Billplz X-Signature Key.
- `RESEND_API_KEY` — (Optional) Resend API key for real-time automated receipt and notification email delivery.

### Optional Environment Variables
- `BILLPLZ_SANDBOX` — Set to `false` for live transactions.
- `ALLOWED_ORIGINS` — Comma-separated list of allowed CORS origins in addition to the site's own origin.
- `ENABLE_PAYMENT_SIMULATION` — Set to `"true"` only in non-production environments to allow local/test mock payments (defaults to off in production).

### Live Database Initialization & Deployment Commands
Execute these exact commands in order:

```bash
# 1. Apply core schema and initial neutral campaign row
wrangler d1 execute solaris-reef-db --remote --file=./schema.sql

# 2. Repair any legacy image URLs to public static assets
wrangler d1 execute solaris-reef-db --remote --file=./scripts/fix-image-urls.sql

# 3. Purge seeded demo records from the live database
wrangler d1 execute solaris-reef-db --remote --file=./scripts/clear-demo-data.sql

# 4. Build application and deploy static assets and edge functions
npm run build
```
Then deploy `dist/` to Cloudflare Pages (or let Cloudflare Pages Git build deploy `dist/` automatically).

---

## 6. Local Development & Docker Deployment

### Local Development (AI Studio / Node.js):
```bash
# Start full-stack development server on port 3000
npm run dev
```

### Docker Deployment:
A multi-stage, secure `Dockerfile` is included:
```bash
docker build -t solaris-reef-hub .
docker run -d -p 3000:3000 --name solaris-reef solaris-reef-hub
curl http://localhost:3000/api/health
```

---

## 7. Testing the Billplz Flow (Interactive Sandbox)

1. On the homepage, select **RM 50** and click **Continue to Payment**.
2. In the interactive Sandbox portal, select any Malaysian FPX bank (e.g. *Maybank2u*, *CIMB Clicks*) and click **Simulate Successful FPX Payment**.
3. The server computes the authentic HMAC-SHA256 X-Signature, updates the database idempotently, and redirects to `/donation/result?ref=SOL-XXXXXX`.
4. The result page queries the server and displays the verified receipt.
5. Log into `/admin` (using `admin@leolion-solaris.org` / `SolarisReef2026!`) to observe the new donation in the ledger, download the CSV report, or test webhook edge cases in the Billplz Diagnostics tab.

---

## 8. Items Requiring Production Activation

When deploying live for the Leo-Lion Club of KL Solaris:
- **Billplz Production Credentials**: Create a production collection on [Billplz](https://www.billplz.com), retrieve the Production Secret Key, Collection ID, and X-Signature Key, and set `BILLPLZ_SANDBOX=false`.
- **Custom Domain & HTTPS**: Configure your custom domain in `APP_URL` so Billplz webhooks resolve over HTTPS.
- **Admin Password**: Update `ADMIN_PASSWORD` and `SESSION_SECRET` to production secrets.


