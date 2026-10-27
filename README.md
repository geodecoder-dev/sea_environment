# Solaris Reef Campaign Hub

**Citizen Restoration Programme (CRP) · Coralku Partnership**  
**Leo-Lion Club of Kuala Lumpur Solaris (District 308 B1, Malaysia)**

A full-stack, security-hardened coral restoration campaign platform featuring real-time fundraising metrics, verified scientific impact tracking, secure Billplz payment integration, and administrative controls.

---

## Key Features

- **Authoritative Conservation State**: Financial metrics (total raised, donor counts) are strictly computed from verified, persisted `paid` transactions.
- **Harmonized Pricing Model**: Single source of truth across frontend and backend for donation tiers:
  - **RM 50**: 1 coral micro-fragment outplanted onto nursery frames.
  - **RM 100**: 1 coral micro-fragment + 12 months of quarterly photo updates & growth reports.
  - **RM 500**: Complete 25-fragment Spider Frame restoration + 12 months of updates.
  - **Custom Contributions**: Predictable, transparent fragment attribution and update qualification for amounts $\ge$ RM 100.
- **Gift Adoptions & Referrals**: Full support for `coralName`, `isGift`, `recipientName`, `recipientEmail`, and affiliate `referral` attribution.
- **128-Bit Secure Donation Lookups**: Cryptographically random verification tokens protect public lookup endpoints from enumeration attacks.
- **Authoritative Paid Receipts**: Official receipts are generated exclusively for confirmed `paid` transactions with full HTML entity escaping and rate-limited resends.
- **Billplz Gateway Preparation**: Clean `PaymentProvider` interface with RFC-compliant HMAC-SHA256 `X-Signature` verification, timing-safe checks, and idempotent webhook callbacks.
- **Dual Runtime Support**: Cloudflare Pages Functions (Edge SQL D1 + R2) and standalone Node.js Express server.

---

## Documentation

Detailed technical documentation is available in the [`docs/`](./docs) directory:

- [**System Architecture** (`docs/ARCHITECTURE.md`)](./docs/ARCHITECTURE.md) — Dual execution model, module boundaries, and request flow.
- [**Security Remediations** (`docs/SECURITY.md`)](./docs/SECURITY.md) — Authentication, cryptography, CSRF, CSV formula defense, and threat model.
- [**Payment Integration** (`docs/PAYMENTS.md`)](./docs/PAYMENTS.md) — State machine, Billplz X-Signature verification, and production activation checklist.
- [**Database Schema** (`docs/DATABASE.md`)](./docs/DATABASE.md) — Cloudflare D1 schema, tables, indexes, and migrations.
- [**Deployment Guide** (`docs/DEPLOYMENT.md`)](./docs/DEPLOYMENT.md) — Cloudflare Pages configuration, secrets, and rollback procedures.

---

## Getting Started

### 1. Prerequisites
- Node.js 18+ or Bun
- npm or bun

### 2. Installation
```bash
git clone <repo-url>
cd solaris-reef
npm install
```

### 3. Environment Setup
```bash
cp .env.example .env
```
Edit `.env` to configure your local development parameters.

### 4. Running the Automated Test Suite
```bash
npm run test
```
Runs 35+ unit and integration tests across pricing, cryptography, Billplz signatures, donation state machine, and receipt security.

### 5. Running Type Checks
```bash
npm run lint
```

### 6. Starting Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the campaign hub.

---

## Production Build

```bash
# Build React application with Vite
npm run build

# Cloudflare Pages build
npm run pages:build
```

---

## License & Compliance

Developed for Leo-Lion Club of KL Solaris in partnership with Coralku. All coral propagation is carried out under scientific research permits issued by the Department of Fisheries Malaysia (*Jabatan Perikanan Malaysia*).
