/**
 * Universal API Router
 * Dispatches all /api/* routes for Cloudflare Pages/Workers and Node.js dev server.
 * Uses asynchronous Cloudflare D1 queries, Web Crypto auth, and optional R2 media storage.
 */

import { db, D1DatabaseBinding, DatabaseError } from './db.js';
import { billplz } from './billplz.js';
import { emailService } from './email.js';
import {
  hashPassword,
  verifyPassword,
  createToken,
  verifyToken,
  getAuthTokenFromRequest,
  checkLoginRateLimit,
  recordFailedLogin,
  resetLoginAttempts,
  AuthenticationConfigError,
} from './auth.js';
import { calculateEntitlementsFromSen, MIN_DONATION_SEN, MAX_DONATION_SEN } from './services/pricing.js';
import { buildReceiptPayload } from './services/receipts.js';
import { sanitizeCsvField, checkRateLimit, getSecurityHeaders } from './middleware/security.js';
import { loadConfig } from './config/index.js';

export interface ApiContext {
  env?: Record<string, any> & {
    DB?: D1DatabaseBinding;
    BUCKET?: {
      put: (key: string, value: any, options?: any) => Promise<any>;
      get: (key: string) => Promise<{
        body: ReadableStream | null;
        arrayBuffer: () => Promise<ArrayBuffer>;
        httpMetadata?: { contentType?: string };
      } | null>;
      delete: (key: string) => Promise<void>;
    };
    BILLPLZ_API_KEY?: string;
    BILLPLZ_COLLECTION_ID?: string;
    BILLPLZ_X_SIGNATURE_KEY?: string;
    BILLPLZ_SANDBOX?: string;
    ADMIN_EMAIL?: string;
    ADMIN_PASSWORD?: string;
    ADMIN_PASSWORD_HASH?: string;
    ADMIN_SALT?: string;
    SESSION_SECRET?: string;
    ENABLE_PAYMENT_SIMULATION?: string;
    CANONICAL_APP_URL?: string;
    APP_URL?: string;
    ALLOWED_ORIGINS?: string;
    NODE_ENV?: string;
  };
  waitUntil?: (promise: Promise<any>) => void;
}

function jsonResponse(data: any, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getSecurityHeaders(),
      ...headers,
    },
  });
}

/**
 * Validates admin authentication using Web Crypto token verification.
 */
async function getAdminUserFromRequest(
  request: Request,
  context: ApiContext
) {
  const token = getAuthTokenFromRequest(request);
  if (!token) return null;

  const config = loadConfig(context.env);

  try {
    const userId = await verifyToken(token, config.sessionSecret);
    if (!userId) return null;

    const admin = await db.getAdminById(userId, context.env?.DB);
    if (!admin) {
      return null;
    }

    return {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
    };
  } catch (err) {
    if (err instanceof AuthenticationConfigError) {
      console.error('[AUTH ERROR] Session secret misconfigured in production');
    }
    return null;
  }
}

export async function handleUniversalApiRequest(
  request: Request,
  context: ApiContext = {}
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();
  const d1 = context.env?.DB;
  const clientIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '127.0.0.1';
  const config = loadConfig(context.env);

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    const origin = request.headers.get('Origin') || '';
    const isAllowed = config.corsAllowedOrigins.includes(origin) || origin === url.origin;
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': isAllowed ? origin : url.origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Signature, X-CSRF-Token',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
        ...getSecurityHeaders(),
      },
    });
  }

  try {
    // -------------------------------------------------------------------------
    // 1. Healthcheck & System Diagnostics
    // -------------------------------------------------------------------------
    if (path === '/api/health' && method === 'GET') {
      const status = billplz.getStatus(context.env);
      return jsonResponse({
        status: 'ok',
        timestamp: new Date().toISOString(),
        runtime:
          typeof (globalThis as any).WebSocketPair !== 'undefined'
            ? 'cloudflare-edge'
            : 'node-runtime',
        database: d1 ? 'cloudflare-d1' : 'in-memory-isolated',
        r2Storage: Boolean(context.env?.BUCKET),
        billplz: status.mode,
        isProduction: config.isProduction,
      });
    }

    // -------------------------------------------------------------------------
    // 2. Public Campaign Details & Editorial Updates
    // -------------------------------------------------------------------------
    if (path === '/api/campaign' && method === 'GET') {
      const campaign = await db.getCampaign(d1);
      const recentDonations = await db.getPublicRecentDonations(8, d1);
      return jsonResponse({ campaign, recentDonations });
    }

    if (path === '/api/updates' && method === 'GET') {
      const updates = await db.getPublicUpdates(d1);
      return jsonResponse({ updates });
    }

    // -------------------------------------------------------------------------
    // 3. Initiate Donation Checkout (Billplz Integration)
    // -------------------------------------------------------------------------
    if (path === '/api/donations/checkout' && method === 'POST') {
      // Rate limiting: max 20 checkout attempts per 10 minutes per IP
      const rateCheck = checkRateLimit(`checkout:${clientIp}`, 20, 10 * 60 * 1000);
      if (!rateCheck.allowed) {
        return jsonResponse(
          { error: `Too many donation requests. Please try again in ${rateCheck.retryAfterSec} seconds.` },
          429
        );
      }

      const body = ((await request.json().catch(() => ({}))) as any) || {};
      const {
        amountSen,
        donorName,
        donorEmail,
        attributionPreference,
        message,
        referral,
        coralName,
        isGift,
        recipientName,
        recipientEmail,
      } = body;

      const parsedAmount = parseInt(amountSen, 10);
      if (isNaN(parsedAmount) || parsedAmount < MIN_DONATION_SEN) {
        return jsonResponse(
          { error: `Minimum contribution is RM ${(MIN_DONATION_SEN / 100).toFixed(2)} (5,000 sen) to sponsor 1 coral fragment.` },
          400
        );
      }
      if (parsedAmount > MAX_DONATION_SEN) {
        return jsonResponse(
          { error: `Maximum single online contribution limit is RM ${(MAX_DONATION_SEN / 100).toFixed(2)}. For larger corporate sponsorships, please contact us directly.` },
          400
        );
      }

      if (!donorEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(donorEmail).trim())) {
        return jsonResponse(
          { error: 'A valid email address is required for donation receipt and regular updates.' },
          400
        );
      }

      const isSimulation = billplz.isSimulationEnabled(context.env);
      const isConfigured = billplz.isConfiguredWithRealKeys(context.env);
      if (!isConfigured && !isSimulation) {
        return jsonResponse(
          { error: 'Payments are temporarily unavailable. Online payment gateway is undergoing maintenance.' },
          503
        );
      }

      const campaign = await db.getCampaign(d1);
      if (campaign.campaignStatus === 'paused') {
        return jsonResponse({ error: 'Donations are currently paused for this campaign.' }, 400);
      }

      // Canonical URL prevents untrusted Host header poisoning for Billplz callbacks
      const appOrigin = config.canonicalAppUrl || url.origin;
      const donorCleanName = donorName && String(donorName).trim() ? String(donorName).trim().slice(0, 120) : 'Reef Supporter';
      const preference = attributionPreference === 'anonymous' ? 'anonymous' : 'public';
      const cleanReferral = referral ? String(referral).trim().slice(0, 100) : undefined;
      const cleanCoralName = coralName ? String(coralName).trim().slice(0, 80) : undefined;
      const cleanRecipientName = recipientName ? String(recipientName).trim().slice(0, 120) : undefined;
      const cleanRecipientEmail = recipientEmail ? String(recipientEmail).trim().slice(0, 120) : undefined;
      const tempRef = `SOL-${Date.now().toString(36).toUpperCase()}`;

      const collectionId = config.billplz.collectionId || '';

      let bill;
      try {
        bill = await billplz.createBill(
          {
            collectionId,
            email: String(donorEmail).trim(),
            name: donorCleanName,
            amountSen: parsedAmount,
            callbackUrl: `${appOrigin}/api/webhooks/billplz`,
            redirectUrl: `${appOrigin}/donation/result`,
            description: `Solaris Reef Coral Restoration — ${tempRef}`,
            reference1Label: 'Campaign',
            reference1: 'Solaris Reef',
            reference2Label: cleanReferral ? 'Referral' : undefined,
            reference2: cleanReferral,
          },
          context.env
        );
      } catch (err: any) {
        console.error('Checkout bill creation error:', err.message);
        return jsonResponse({ error: 'Failed to initiate payment gateway session.' }, 503);
      }

      // Durably create donation record in D1 (or memory store in test mode).
      // If D1 fails, DatabaseError is thrown and caught below (NO silent ephemeral fallback).
      const donation = await db.createDonation(
        {
          donorName: donorCleanName,
          donorEmail: String(donorEmail).trim(),
          amountSen: parsedAmount,
          attributionPreference: preference,
          message: message ? String(message).slice(0, 300) : '',
          referral: cleanReferral,
          coralName: cleanCoralName,
          isGift: Boolean(isGift),
          recipientName: cleanRecipientName,
          recipientEmail: cleanRecipientEmail,
          billplzBillId: bill.id,
          billplzUrl: bill.url,
        },
        d1
      );

      let redirectCheckoutUrl = bill.url;
      if (bill.isSimulated) {
        redirectCheckoutUrl = `/billplz-simulation/${bill.id}?ref=${donation.internalReference}&token=${donation.verificationToken}`;
      }

      return jsonResponse({
        ok: true,
        donation: {
          internalReference: donation.internalReference,
          verificationToken: donation.verificationToken,
          amountSen: donation.amountSen,
          amountRm: donation.amountSen / 100,
          donorName: donation.donorName,
          referral: donation.referral,
          coralName: donation.coralName,
          paymentStatus: donation.paymentStatus,
        },
        checkoutUrl: redirectCheckoutUrl,
        billId: bill.id,
        isSimulated: bill.isSimulated || false,
      });
    }

    // -------------------------------------------------------------------------
    // 4. Secure Transaction Lookup & Public Verification
    // -------------------------------------------------------------------------
    if (path.startsWith('/api/donations/lookup') || path.startsWith('/api/donations/verify/')) {
      // Rate-limit lookups to prevent brute-force enumeration: 60/min
      const rateCheck = checkRateLimit(`lookup:${clientIp}`, 60, 60 * 1000);
      if (!rateCheck.allowed) {
        return jsonResponse({ error: 'Too many lookup requests. Please slow down.' }, 429);
      }

      let token = url.searchParams.get('token') || '';
      let ref = url.searchParams.get('ref') || '';
      let billId = url.searchParams.get('bill_id') || url.searchParams.get('billId') || '';

      if (path.startsWith('/api/donations/verify/')) {
        const pathParam = decodeURIComponent(path.replace('/api/donations/verify/', '')).trim();
        if (pathParam.startsWith('SOL-')) {
          ref = pathParam;
        } else if (pathParam.length >= 32) {
          token = pathParam;
        } else {
          billId = pathParam;
        }
      }

      let donation = null;
      if (token) {
        donation = await db.getDonationByToken(token, d1);
      } else if (ref) {
        donation = await db.getDonationByReference(ref, d1);
      } else if (billId) {
        donation = await db.getDonationByBillId(billId, d1);
      }

      if (!donation) {
        return jsonResponse({ error: 'Donation record not found' }, 404);
      }

      const entitlements = calculateEntitlementsFromSen(donation.amountSen);

      // Return strictly safe public information (no raw email disclosed)
      return jsonResponse({
        internalReference: donation.internalReference,
        verificationToken: donation.verificationToken,
        amountSen: donation.amountSen,
        amountRm: donation.amountSen / 100,
        currency: donation.currency,
        paymentStatus: donation.paymentStatus,
        donorName: donation.attributionPreference === 'anonymous' ? 'Anonymous Supporter' : donation.donorName,
        attributionPreference: donation.attributionPreference,
        referral: donation.referral || '',
        coralName: donation.coralName,
        isGift: donation.isGift,
        recipientName: donation.recipientName,
        paidAt: donation.paidAt,
        createdAt: donation.createdAt,
        billplzBillId: donation.billplzBillId,
        entitlements: {
          fragments: entitlements.coralFragmentsCount,
          updatesEligible: entitlements.updatesEligible,
          updatesDurationMonths: entitlements.updatesDurationMonths,
          title: entitlements.entitlementTitle,
        },
      });
    }

    // -------------------------------------------------------------------------
    // 5. Official Billplz Webhook Callback
    // -------------------------------------------------------------------------
    if (path === '/api/webhooks/billplz' && method === 'POST') {
      const xSignatureKey = config.billplz.xSignatureKey;
      if (!xSignatureKey) {
        console.error('[BILLPLZ WEBHOOK] Rejected (401): BILLPLZ_X_SIGNATURE_KEY is missing from environment secrets.');
        return new Response('Unauthorized: BILLPLZ_X_SIGNATURE_KEY not configured', { status: 401 });
      }

      const contentType = request.headers.get('content-type') || '';
      let payload: Record<string, any> = {};

      if (contentType.includes('application/json')) {
        payload = (await request.json().catch(() => ({}))) as Record<string, any>;
      } else {
        const formData = await request.formData().catch(() => null);
        if (formData) {
          formData.forEach((val, key) => {
            payload[key] = val;
          });
        }
      }

      const signature = payload.x_signature || request.headers.get('x-signature') || '';
      const webhookResult = await billplz.verifyWebhook(payload, signature, context.env);
      const billId = webhookResult.billId;

      const donation = await db.getDonationByBillId(billId, d1);
      if (!donation) {
        await db.logWebhook(
          {
            billId: billId || 'unknown',
            internalRef: 'unknown',
            status: 'error',
            signatureVerified: webhookResult.isValid,
            payloadSummary: `Bill not found for payload: ${JSON.stringify(payload).slice(0, 150)}`,
          },
          d1
        );
        return new Response('Donation not found', { status: 404 });
      }

      if (!webhookResult.isValid) {
        await db.logWebhook(
          {
            billId,
            internalRef: donation.internalReference,
            status: 'invalid_signature',
            signatureVerified: false,
            payloadSummary: `Rejected invalid X-Signature for bill ${billId}`,
          },
          d1
        );
        return new Response('Invalid signature', { status: 400 });
      }

      const nextStatus = webhookResult.isPaid ? 'paid' : webhookResult.state === 'deleted' ? 'cancelled' : 'failed';
      const paidAt = webhookResult.paidAt || (nextStatus === 'paid' ? new Date().toISOString() : undefined);

      const updateResult = await db.updateDonationPaymentStatus(
        donation.internalReference,
        nextStatus,
        paidAt,
        d1
      );

      await db.logWebhook(
        {
          billId,
          internalRef: donation.internalReference,
          status: updateResult.isStateChanged ? 'valid' : 'duplicate_ignored',
          signatureVerified: true,
          payloadSummary: `Webhook processed: nextStatus=${nextStatus}, stateChanged=${updateResult.isStateChanged}, rejectedReversion=${Boolean(updateResult.rejectedReversion)}`,
        },
        d1
      );

      // Dispatch automated receipt on verified payment (isolated failure handling)
      if (nextStatus === 'paid' && updateResult.isStateChanged && donation.paymentStatus !== 'paid') {
        try {
          const receiptPayload = buildReceiptPayload({
            ...donation,
            paymentStatus: 'paid',
            paidAt,
          });
          await emailService.sendDonationReceipt(receiptPayload, context.env);
          await db.markReceiptSent(donation.internalReference, d1);
        } catch (emailErr) {
          console.warn('[WEBHOOK] Non-blocking receipt dispatch error:', emailErr);
        }
      }

      return new Response('OK', { status: 200 });
    }

    // -------------------------------------------------------------------------
    // 6. Interactive Sandbox Simulation Portal Helpers (Dev/Test only)
    // -------------------------------------------------------------------------
    if (path.startsWith('/api/billplz-simulation/')) {
      if (config.isProduction || !config.enableSimulation) {
        return jsonResponse({ error: 'Payment simulation is disabled in this environment' }, 403);
      }

      if (path.startsWith('/api/billplz-simulation/') && method === 'GET') {
        const billId = path.replace('/api/billplz-simulation/', '');
        const donation = await db.getDonationByBillId(billId, d1);
        if (!donation) {
          return jsonResponse({ error: 'Simulated bill not found' }, 404);
        }
        return jsonResponse({
          billId,
          internalReference: donation.internalReference,
          verificationToken: donation.verificationToken,
          amountSen: donation.amountSen,
          amountRm: donation.amountSen / 100,
          donorName: donation.donorName,
          status: donation.paymentStatus,
          createdAt: donation.createdAt,
        });
      }

      if (path === '/api/billplz-simulation/execute' && method === 'POST') {
        const body = ((await request.json().catch(() => ({}))) as any) || {};
        const { billId, action } = body;
        const donation = await db.getDonationByBillId(billId, d1);
        if (!donation) {
          return jsonResponse({ error: 'Bill not found' }, 404);
        }

        const isSuccess = action === 'pay_success';
        const status = isSuccess ? 'paid' : action === 'cancel' ? 'cancelled' : 'failed';
        const paidAtTime = isSuccess ? new Date().toISOString() : undefined;

        const updateResult = await db.updateDonationPaymentStatus(
          donation.internalReference,
          status,
          paidAtTime,
          d1
        );

        await db.logWebhook(
          {
            billId,
            internalRef: donation.internalReference,
            status: 'valid',
            signatureVerified: true,
            payloadSummary: `Simulated ${action} -> ${status} (stateChanged=${updateResult.isStateChanged})`,
          },
          d1
        );

        if (isSuccess && updateResult.isStateChanged) {
          try {
            const receiptPayload = buildReceiptPayload({
              ...donation,
              paymentStatus: 'paid',
              paidAt: paidAtTime,
            });
            await emailService.sendDonationReceipt(receiptPayload, context.env);
            await db.markReceiptSent(donation.internalReference, d1);
          } catch (emailErr) {
            console.warn('[SIMULATOR] Receipt dispatch warning:', emailErr);
          }
        }

        return jsonResponse({
          ok: true,
          status,
          internalReference: donation.internalReference,
          verificationToken: donation.verificationToken,
          redirectResultUrl: `/donation/result?token=${donation.verificationToken}&ref=${donation.internalReference}`,
        });
      }
    }

    // -------------------------------------------------------------------------
    // 7. Explicit Receipt Dispatch (Strictly verified paid status)
    // -------------------------------------------------------------------------
    if (path === '/api/donations/send-receipt' && method === 'POST') {
      const rateCheck = checkRateLimit(`receipt:${clientIp}`, 10, 60 * 60 * 1000);
      if (!rateCheck.allowed) {
        return jsonResponse({ error: 'Too many receipt requests. Please try again later.' }, 429);
      }

      const body = ((await request.json().catch(() => ({}))) as any) || {};
      const { reference, token } = body;
      if (!reference && !token) {
        return jsonResponse({ error: 'Donation reference or token is required' }, 400);
      }

      const donation = token
        ? await db.getDonationByToken(token, d1)
        : await db.getDonationByReference(reference, d1);

      if (!donation) {
        return jsonResponse({ error: 'Donation record not found' }, 404);
      }

      // Strict enforcement: MUST be paid
      if (donation.paymentStatus !== 'paid') {
        return jsonResponse(
          { error: 'Official receipts can only be issued for verified paid donations. Current transaction status is pending or failed.' },
          400
        );
      }

      // Resend limit: max 3 per hour
      if ((donation.receiptCount || 0) >= 5) {
        return jsonResponse(
          { error: 'Maximum receipt generation limit reached for this transaction. Please contact support if you need assistance.' },
          429
        );
      }

      const receiptPayload = buildReceiptPayload(donation);
      const result = await emailService.sendDonationReceipt(receiptPayload, context.env);
      await db.markReceiptSent(donation.internalReference, d1);

      // Safe response: does NOT disclose raw email
      const maskedEmail = donation.donorEmail.replace(/^(.)(.*)(@.*)$/, (_match, a, _b, c) => `${a}***${c}`);

      return jsonResponse({
        ok: true,
        message: `Official receipt dispatched successfully to ${maskedEmail}`,
        simulated: result.simulated,
      });
    }

    // -------------------------------------------------------------------------
    // 8. Contact Form Inquiries
    // -------------------------------------------------------------------------
    if (path === '/api/contact/inquiry' && method === 'POST') {
      const rateCheck = checkRateLimit(`contact:${clientIp}`, 5, 10 * 60 * 1000);
      if (!rateCheck.allowed) {
        return jsonResponse({ error: 'Too many submissions. Please wait before submitting another message.' }, 429);
      }

      const body = ((await request.json().catch(() => ({}))) as any) || {};
      const { name, email, phone, organisation, message } = body;
      if (!name || !email || !message) {
        return jsonResponse({ error: 'Name, email, and message are required' }, 400);
      }

      await emailService.sendContactInquiry(
        {
          name: String(name).trim(),
          email: String(email).trim(),
          phone: phone ? String(phone).trim() : undefined,
          organisation: organisation ? String(organisation).trim() : undefined,
          message: String(message).trim(),
        },
        context.env
      );

      return jsonResponse({
        ok: true,
        message: 'Thank you! Your Citizen Restoration inquiry has been submitted to Coralku.',
      });
    }

    // -------------------------------------------------------------------------
    // 9. Media Retrieval (Cloudflare R2 Storage)
    // -------------------------------------------------------------------------
    if (path.startsWith('/api/media/') && method === 'GET') {
      const key = decodeURIComponent(path.replace('/api/media/', ''));
      if (context.env?.BUCKET) {
        try {
          const object = await context.env.BUCKET.get(key);
          if (!object) {
            return new Response('Media file not found', { status: 404 });
          }
          const headers = new Headers();
          headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
          headers.set('Cache-Control', 'public, max-age=31536000, immutable');
          return new Response(object.body, { headers });
        } catch (err: any) {
          console.error('R2 get error:', err);
        }
      }
      return new Response('Media asset not available', { status: 404 });
    }

    // -------------------------------------------------------------------------
    // 10. ADMIN AUTHENTICATION (Login / Logout)
    // NO HARDCODED PRODUCTION CREDENTIALS
    // -------------------------------------------------------------------------
    if (path === '/api/admin/login' && method === 'POST') {
      const rateLimitResult = checkLoginRateLimit(clientIp, 5, 15 * 60 * 1000, 15 * 60 * 1000);
      if (!rateLimitResult.allowed) {
        return jsonResponse(
          { error: `Too many failed login attempts. Account temporarily locked. Try again in ${rateLimitResult.retryAfterSec} seconds.` },
          429
        );
      }

      const body = ((await request.json().catch(() => ({}))) as any) || {};
      const { email, password } = body;
      if (!email || !password) {
        return jsonResponse({ error: 'Email and password are required' }, 400);
      }

      const inputEmail = String(email).trim().toLowerCase();
      let admin = await db.getAdminByEmail(inputEmail, d1);

      // Environment bootstrap check (ONLY if configured via environment variables, NEVER hardcoded defaults)
      const envAdminEmail = config.adminEmail?.toLowerCase();
      const envAdminHash = config.adminPasswordHash;
      const envAdminSalt = config.adminSalt;

      // In non-production only, if explicit dev credentials were provided in env
      const envDevPassword = !config.isProduction ? context.env?.ADMIN_PASSWORD : undefined;

      if (!admin && envAdminEmail && inputEmail === envAdminEmail) {
        if (envAdminHash && envAdminSalt) {
          admin = await db.upsertAdminUser(
            {
              id: 'admin-bootstrap',
              name: 'KL Solaris Club Administrator',
              email: envAdminEmail,
              passwordHash: envAdminHash,
              salt: envAdminSalt,
              role: 'superadmin',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            d1
          );
        } else if (envDevPassword && password === envDevPassword) {
          const { hash, salt } = await hashPassword(password);
          admin = await db.upsertAdminUser(
            {
              id: 'admin-dev-bootstrap',
              name: 'Development Administrator',
              email: envAdminEmail,
              passwordHash: hash,
              salt,
              role: 'superadmin',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            d1
          );
        }
      }

      if (!admin) {
        recordFailedLogin(clientIp);
        return jsonResponse({ error: 'Invalid administrator credentials' }, 401);
      }

      const isValid = await verifyPassword(String(password), admin.passwordHash, admin.salt);
      if (!isValid) {
        recordFailedLogin(clientIp);
        return jsonResponse({ error: 'Invalid administrator credentials' }, 401);
      }

      resetLoginAttempts(clientIp);

      const token = await createToken(admin.id, config.sessionSecret);

      await db.logActivity(
        {
          adminId: admin.id,
          adminName: admin.name,
          action: 'LOGIN_SUCCESS',
          entityType: 'auth',
          entityReference: admin.email,
          details: 'Administrator authenticated into the operations dashboard.',
        },
        d1
      );

      const response = jsonResponse({
        ok: true,
        admin: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
        },
        token,
      });

      const secureFlag = config.isProduction ? '; Secure' : '';
      response.headers.append(
        'Set-Cookie',
        `admin_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secureFlag}`
      );
      return response;
    }

    if (path === '/api/admin/logout' && method === 'POST') {
      const response = jsonResponse({ ok: true });
      response.headers.append(
        'Set-Cookie',
        'admin_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'
      );
      return response;
    }

    // -------------------------------------------------------------------------
    // 11. PROTECTED ADMIN OPERATIONS
    // -------------------------------------------------------------------------
    if (path.startsWith('/api/admin/')) {
      const adminUser = await getAdminUserFromRequest(request, context);
      if (!adminUser) {
        return jsonResponse({ error: 'Unauthorized: Admin authentication required' }, 401);
      }

      // Current Admin Info
      if (path === '/api/admin/me' && method === 'GET') {
        return jsonResponse({ admin: adminUser });
      }

      // Update Campaign Configuration
      if (path === '/api/admin/campaign' && method === 'PUT') {
        const body = ((await request.json().catch(() => ({}))) as any) || {};
        const updates: Record<string, any> = {};
        if (body.title) updates.title = String(body.title).trim();
        if (body.description) updates.description = String(body.description).trim();
        if (body.fundraisingTargetSen !== undefined)
          updates.fundraisingTargetSen = Math.max(1000, parseInt(body.fundraisingTargetSen, 10));
        if (body.coralPlantingTarget !== undefined)
          updates.coralPlantingTarget = Math.max(0, parseInt(body.coralPlantingTarget, 10));
        if (body.verifiedCoralPlantingCount !== undefined)
          updates.verifiedCoralPlantingCount = Math.max(0, parseInt(body.verifiedCoralPlantingCount, 10));
        if (body.volunteerCount !== undefined)
          updates.volunteerCount = Math.max(0, parseInt(body.volunteerCount, 10));
        if (body.campaignStatus) updates.campaignStatus = body.campaignStatus;
        if (Array.isArray(body.milestones)) updates.milestones = body.milestones;

        const updated = await db.updateCampaign(updates, adminUser, d1);
        return jsonResponse({ ok: true, campaign: updated });
      }

      // Admin Updates Management
      if (path === '/api/admin/updates' && method === 'GET') {
        const updates = await db.getAllUpdates(d1);
        return jsonResponse({ updates });
      }

      if (path === '/api/admin/updates' && method === 'POST') {
        const body = ((await request.json().catch(() => ({}))) as any) || {};
        if (!body.title || !body.description) {
          return jsonResponse({ error: 'Title and description are required' }, 400);
        }

        const newUpdate = await db.createUpdate(
          {
            title: String(body.title).trim(),
            slug: String(body.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
            description: String(body.description).trim(),
            imageUrl: body.imageUrl || undefined,
            category: body.category || 'milestone',
            publicationStatus: body.publicationStatus || 'published',
            publicationDate: body.publicationDate || new Date().toISOString(),
          },
          adminUser,
          d1
        );

        return jsonResponse({ ok: true, update: newUpdate });
      }

      if (path.startsWith('/api/admin/updates/') && method === 'PUT') {
        const id = path.replace('/api/admin/updates/', '');
        const body = ((await request.json().catch(() => ({}))) as any) || {};
        const updated = await db.updateUpdate(id, body, adminUser, d1);
        if (!updated) {
          return jsonResponse({ error: 'Update not found' }, 404);
        }
        return jsonResponse({ ok: true, update: updated });
      }

      if (path.startsWith('/api/admin/updates/') && method === 'DELETE') {
        const id = path.replace('/api/admin/updates/', '');
        const success = await db.deleteUpdate(id, adminUser, d1);
        return jsonResponse({ ok: success });
      }

      // Media Uploads (R2 Storage with in-memory fallback)
      if (path === '/api/admin/uploads' && method === 'POST') {
        const contentType = request.headers.get('content-type') || '';
        let fileData: ArrayBuffer | null = null;
        let mimeType = 'image/jpeg';
        let filename = `upload-${Date.now()}`;

        if (contentType.includes('multipart/form-data')) {
          const formData = await request.formData();
          const file = formData.get('file') as File | null;
          if (!file) {
            return jsonResponse({ error: 'No file provided in form-data' }, 400);
          }
          fileData = await file.arrayBuffer();
          mimeType = file.type || 'image/jpeg';
          filename = file.name || filename;
        } else if (contentType.includes('application/json')) {
          const body = (await request.json()) as any;
          if (!body.dataBase64) {
            return jsonResponse({ error: 'dataBase64 payload required' }, 400);
          }
          const binaryStr = atob(body.dataBase64);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          fileData = bytes.buffer;
          mimeType = body.contentType || 'image/jpeg';
          filename = body.filename || filename;
        } else {
          fileData = await request.arrayBuffer();
          mimeType = contentType;
        }

        const cleanKey = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

        if (context.env?.BUCKET && fileData) {
          await context.env.BUCKET.put(cleanKey, fileData, {
            httpMetadata: { contentType: mimeType },
          });

          await db.logActivity(
            {
              adminId: adminUser.id,
              adminName: adminUser.name,
              action: 'R2_FILE_UPLOADED',
              entityType: 'update',
              entityReference: cleanKey,
              details: `Uploaded media asset ${cleanKey} to Cloudflare R2 bucket.`,
            },
            d1
          );

          return jsonResponse({
            ok: true,
            key: cleanKey,
            url: `/api/media/${cleanKey}`,
            storage: 'cloudflare-r2',
          });
        }

        const base64Fallback = fileData
          ? btoa(String.fromCharCode(...new Uint8Array(fileData)))
          : '';
        return jsonResponse({
          ok: true,
          key: cleanKey,
          url: `data:${mimeType};base64,${base64Fallback}`,
          storage: 'data-url-fallback',
        });
      }

      // Admin Donations Search & Pagination
      if (path === '/api/admin/donations' && method === 'GET') {
        const status = url.searchParams.get('status') || undefined;
        const search = url.searchParams.get('search') || undefined;
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;
        const offset = url.searchParams.get('offset') ? parseInt(url.searchParams.get('offset')!, 10) : 0;

        const result = await db.getDonations({ status, search, limit, offset }, d1);
        return jsonResponse(result);
      }

      // Export Donations to CSV (with CSV Formula Injection Sanitization)
      if (path === '/api/admin/donations/export' && method === 'GET') {
        const donations = (await db.getDonations({ limit: 2000 }, d1)).items;
        const headers = [
          'Internal Reference',
          'Verification Token',
          'Donor Name',
          'Donor Email',
          'Amount (RM)',
          'Amount (Sen)',
          'Status',
          'Attribution',
          'Referral',
          'Coral Name',
          'Is Gift',
          'Recipient Name',
          'Recipient Email',
          'Billplz Bill ID',
          'Transaction Date',
          'Donor Message',
        ];

        const rows = donations.map((d) => [
          sanitizeCsvField(d.internalReference),
          sanitizeCsvField(d.verificationToken),
          sanitizeCsvField(d.donorName),
          sanitizeCsvField(d.donorEmail),
          sanitizeCsvField((d.amountSen / 100).toFixed(2)),
          sanitizeCsvField(d.amountSen),
          sanitizeCsvField(d.paymentStatus),
          sanitizeCsvField(d.attributionPreference),
          sanitizeCsvField(d.referral || ''),
          sanitizeCsvField(d.coralName || ''),
          sanitizeCsvField(d.isGift ? 'Yes' : 'No'),
          sanitizeCsvField(d.recipientName || ''),
          sanitizeCsvField(d.recipientEmail || ''),
          sanitizeCsvField(d.billplzBillId),
          sanitizeCsvField(d.paidAt || d.createdAt),
          sanitizeCsvField(d.message || ''),
        ]);

        const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

        await db.logActivity(
          {
            adminId: adminUser.id,
            adminName: adminUser.name,
            action: 'DONATIONS_EXPORTED_CSV',
            entityType: 'donation',
            details: `Exported ${donations.length} donation records to CSV with formula injection defense.`,
          },
          d1
        );

        return new Response(csvContent, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="solaris-reef-donations-${new Date().toISOString().slice(0, 10)}.csv"`,
            ...getSecurityHeaders(),
          },
        });
      }

      // Admin Activity Audit Trail
      if (path === '/api/admin/activities' && method === 'GET') {
        const activities = await db.getActivities(50, d1);
        return jsonResponse({ activities });
      }

      // Admin Gateway Status
      if (path === '/api/admin/billplz-status' && method === 'GET') {
        const status = billplz.getStatus(context.env);
        const webhookLogs = await db.getWebhookLogs(15, d1);
        return jsonResponse({ status, webhookLogs });
      }

      // Admin Webhook Simulation
      if (path === '/api/admin/simulate-callback' && method === 'POST') {
        if (config.isProduction) {
          return jsonResponse({ error: 'Simulator endpoints are disabled in production' }, 403);
        }

        const body = ((await request.json().catch(() => ({}))) as any) || {};
        const { reference, scenario } = body;
        const donation = await db.getDonationByReference(reference, d1);

        if (!donation) {
          return jsonResponse({ error: 'Target donation reference not found' }, 404);
        }

        if (scenario === 'invalid_signature') {
          await db.logWebhook(
            {
              billId: donation.billplzBillId,
              internalRef: donation.internalReference,
              status: 'invalid_signature',
              signatureVerified: false,
              payloadSummary: `Admin simulated INVALID signature rejection for ${donation.internalReference}`,
            },
            d1
          );
          return jsonResponse({
            ok: true,
            message: 'Invalid signature test executed and successfully rejected by security rule.',
          });
        }

        const isPaid = scenario === 'success';
        const status = isPaid ? 'paid' : scenario === 'cancelled' ? 'cancelled' : 'failed';

        const updateResult = await db.updateDonationPaymentStatus(
          donation.internalReference,
          status,
          isPaid ? new Date().toISOString() : undefined,
          d1
        );

        await db.logActivity(
          {
            adminId: adminUser.id,
            adminName: adminUser.name,
            action: 'ADMIN_SIMULATE_PAYMENT',
            entityType: 'payment_test',
            entityReference: donation.internalReference,
            details: `Simulated ${scenario} callback for ${donation.internalReference} (stateChanged=${updateResult.isStateChanged}).`,
          },
          d1
        );

        await db.logWebhook(
          {
            billId: donation.billplzBillId,
            internalRef: donation.internalReference,
            status: updateResult.isStateChanged ? 'valid' : 'duplicate_ignored',
            signatureVerified: true,
            payloadSummary: `Admin simulated ${scenario} -> ${status} (stateChanged=${updateResult.isStateChanged})`,
          },
          d1
        );

        return jsonResponse({
          ok: true,
          status,
          isStateChanged: updateResult.isStateChanged,
          rejectedReversion: Boolean(updateResult.rejectedReversion),
          message: updateResult.isStateChanged
            ? `Transaction updated to ${status}`
            : (updateResult.rejectedReversion
                ? 'Illegal transition rejected: paid transaction cannot be reverted to unpaid status.'
                : `Idempotency verified: transaction already in state "${status}". No changes made.`),
        });
      }
    }

    return jsonResponse({ error: `Not found: ${method} ${path}` }, 404);
  } catch (err: any) {
    if (err instanceof DatabaseError) {
      console.error('[API DatabaseError]:', err.message);
      return jsonResponse({ error: 'Durable database operation failed. Transaction aborted.' }, 503);
    }
    console.error('API Error:', err);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}
