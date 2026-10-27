# Deployment & Environment Configuration Guide

## 1. Cloudflare Pages Deployment

### Prerequisites
- Cloudflare account with access to Cloudflare Pages.
- Wrangler CLI installed (`npm install -g wrangler` or `npx wrangler`).

### 1. Provision D1 Database and R2 Bucket
```bash
# 1. Create D1 database
wrangler d1 create solaris-reef-db

# 2. Bind database in wrangler.toml with the returned database_id
# 3. Create R2 bucket for photo storage
wrangler r2 bucket create solaris-reef-media

# 4. Apply schema
wrangler d1 execute solaris-reef-db --file=./schema.sql
```

### 2. Configure Production Secrets
In the Cloudflare Dashboard under **Pages > Your Project > Settings > Environment variables**:

| Variable Name | Required | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | Yes | Set to `production` |
| `SESSION_SECRET` | Yes | Cryptographically random string ($\ge 32$ chars) for signing session tokens |
| `CANONICAL_APP_URL` | Yes | Canonical production origin (e.g. `https://solaris-reef.pages.dev`) |
| `ADMIN_EMAIL` | Yes | Administrator login email address |
| `ADMIN_PASSWORD_HASH` | Optional | Pre-hashed PBKDF2 password |
| `ADMIN_SALT` | Optional | Salt used for `ADMIN_PASSWORD_HASH` |
| `BILLPLZ_API_KEY` | When live | Production Billplz API Key |
| `BILLPLZ_COLLECTION_ID` | When live | Production Billplz Collection ID |
| `BILLPLZ_X_SIGNATURE_KEY` | When live | Production Billplz X-Signature Key |
| `BILLPLZ_SANDBOX` | Yes | Set to `false` for live payments |
| `ENABLE_PAYMENT_SIMULATION` | Yes | Set to `false` in production |
| `RESEND_API_KEY` | Optional | Resend API key for automated receipt dispatch |
| `EMAIL_FROM` | Optional | E.g. `Solaris Reef <receipts@solaris-reef.org>` |

### 3. Deploy
```bash
npm run pages:build
npm run pages:deploy
```

---

## 2. Local Development & Testing

### Running the App Locally
```bash
# 1. Install dependencies
npm install

# 2. Run local tests
npm run test

# 3. Run type check
npm run lint

# 4. Start local development server
npm run dev
```

Visit `http://localhost:3000` to interact with the campaign hub.

---

## 3. Rollback Procedure

In the event of a deployment failure:
1. Navigate to **Cloudflare Dashboard > Workers & Pages > Pages > Your Project > Deployments**.
2. Identify the last known stable deployment.
3. Click the three dots `...` next to the deployment and select **Rollback to this deployment**.
4. Cloudflare Pages instantly restores the previous edge build and serverless functions in $< 2$ seconds.
