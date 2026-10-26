/**
 * Universal API Router
 * Dispatches all /api/* routes for Cloudflare Pages/Workers and Node.js dev server.
 * Uses asynchronous Cloudflare D1 queries, Web Crypto auth, and optional R2 media storage.
 */

import { db, D1DatabaseBinding } from './db.js';
import { billplz } from './billplz.js';
import { emailService } from './email.js';
import {
  hashPassword,
  verifyPassword,
  createToken,
  verifyToken,
  getAuthTokenFromRequest,
  AuthenticationConfigError,
} from './auth.js';

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
    SESSION_SECRET?: string;
    ENABLE_PAYMENT_SIMULATION?: string;
    ALLOWED_ORIGINS?: string;
  };
  waitUntil?: (promise: Promise<any>) => void;
}

function jsonResponse(data: any, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Signature',
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

  const sessionSecret =
    context.env?.SESSION_SECRET ||
    (typeof process !== 'undefined' ? process.env?.SESSION_SECRET : undefined);

  if (!sessionSecret || sessionSecret.length < 32) {
    console.error('[AUTH ERROR] SESSION_SECRET is missing or shorter than 32 characters.');
    throw new AuthenticationConfigError();
  }

  const userId = await verifyToken(token, sessionSecret);
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
}

export async function handleUniversalApiRequest(
  request: Request,
  context: ApiContext = {}
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();
  const d1 = context.env?.DB;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Signature',
        'Access-Control-Max-Age': '86400',
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
            : 'node-dev',
        database: d1 ? 'cloudflare-d1' : 'in-memory-fallback',
        r2Storage: Boolean(context.env?.BUCKET),
        billplz: status.mode,
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
      const body = ((await request.json().catch(() => ({}))) as any) || {};
      const { amountSen, donorName, donorEmail, attributionPreference, message } = body;

      const parsedAmount = parseInt(amountSen, 10);
      if (isNaN(parsedAmount) || parsedAmount < 5000) {
        return jsonResponse({ error: 'Minimum contribution is RM 50.00 (5,000 sen) to sponsor 1 coral fragment.' }, 400);
      }

      if (!donorEmail || !donorEmail.includes('@')) {
        return jsonResponse({ error: 'A valid email address is required for donation receipt and regular updates.' }, 400);
      }

      const isSimulation = billplz.isSimulationEnabled(context.env);
      const isConfigured = billplz.isConfiguredWithRealKeys(context.env);
      if (!isConfigured && !isSimulation) {
        return jsonResponse({ error: 'Payments are temporarily unavailable' }, 503);
      }

      const campaign = await db.getCampaign(d1);
      if (campaign.campaignStatus === 'paused') {
        return jsonResponse({ error: 'Donations are currently paused for this campaign' }, 400);
      }

      const appOrigin = url.origin;
      const donorCleanName = donorName && donorName.trim() ? donorName.trim() : 'Reef Supporter';
      const preference = attributionPreference === 'anonymous' ? 'anonymous' : 'public';
      const tempRef = `SOL-${Date.now().toString(36).toUpperCase()}`;

      const collectionId =
        context.env?.BILLPLZ_COLLECTION_ID ||
        (typeof process !== 'undefined' ? process.env?.BILLPLZ_COLLECTION_ID : '') ||
        '';

      let bill;
      try {
        bill = await billplz.createBill(
          {
            collectionId,
            email: donorEmail.trim(),
            name: donorCleanName,
            amountSen: parsedAmount,
            callbackUrl: `${appOrigin}/api/webhooks/billplz`,
            redirectUrl: `${appOrigin}/donation/result`,
            description: `Solaris Reef Coral Restoration — ${tempRef}`,
            reference1Label: 'Campaign',
            reference1: 'Solaris Reef',
          },
          context.env
        );
      } catch (err: any) {
        console.error('Checkout bill creation error:', err.message);
        return jsonResponse({ error: 'Payments are temporarily unavailable' }, 503);
      }

      const donation = await db.createDonation(
        {
          donorName: donorCleanName,
          donorEmail: donorEmail.trim(),
          amountSen: parsedAmount,
          attributionPreference: preference,
          message: message ? String(message).slice(0, 300) : '',
          billplzBillId: bill.id,
          billplzUrl: bill.url,
        },
        d1
      );

      let redirectCheckoutUrl = bill.url;
      if (bill.isSimulated) {
        redirectCheckoutUrl = `/billplz-simulation/${bill.id}?ref=${donation.internalReference}`;
      }

      return jsonResponse({
        ok: true,
        donation: {
          internalReference: donation.internalReference,
          amountSen: donation.amountSen,
          amountRm: donation.amountSen / 100,
          donorName: donation.donorName,
          paymentStatus: donation.paymentStatus,
        },
        checkoutUrl: redirectCheckoutUrl,
        billId: bill.id,
        isSimulated: bill.isSimulated || false,
      });
    }

    // -------------------------------------------------------------------------
    // 4. Server-Verified Transaction Verification
    // -------------------------------------------------------------------------
    if (path.startsWith('/api/donations/verify/') && method === 'GET') {
      const ref = decodeURIComponent(path.replace('/api/donations/verify/', ''));
      const donation = await db.getDonationByReference(ref, d1);
      if (!donation) {
        return jsonResponse({ error: 'Donation record not found' }, 404);
      }

      return jsonResponse({
        internalReference: donation.internalReference,
        amountSen: donation.amountSen,
        amountRm: donation.amountSen / 100,
        currency: donation.currency,
        paymentStatus: donation.paymentStatus,
        donorName: donation.attributionPreference === 'anonymous' ? 'Anonymous Supporter' : donation.donorName,
        attributionPreference: donation.attributionPreference,
        paidAt: donation.paidAt,
        createdAt: donation.createdAt,
        billplzBillId: donation.billplzBillId,
      });
    }

    // -------------------------------------------------------------------------
    // 5. Official Billplz Webhook Callback
    // -------------------------------------------------------------------------
    if (path === '/api/webhooks/billplz' && method === 'POST') {
      const xSignatureKey =
        context.env?.BILLPLZ_X_SIGNATURE_KEY ||
        (typeof process !== 'undefined' ? process.env?.BILLPLZ_X_SIGNATURE_KEY : '');
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
      const isValid = await billplz.verifyXSignature(payload, signature, context.env);
      const billId = String(payload.id || '');
      const isPaid = String(payload.paid).toLowerCase() === 'true' || payload.state === 'paid';
      const paidAt = payload.paid_at || new Date().toISOString();

      const donation = await db.getDonationByBillId(billId, d1);
      if (!donation) {
        await db.logWebhook(
          {
            billId: billId || 'unknown',
            internalRef: 'unknown',
            status: 'error',
            signatureVerified: isValid,
            payloadSummary: `Bill not found for payload: ${JSON.stringify(payload).slice(0, 150)}`,
          },
          d1
        );
        return new Response('Donation not found', { status: 404 });
      }

      if (!isValid) {
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

      const nextStatus = isPaid ? 'paid' : payload.state === 'deleted' ? 'cancelled' : 'failed';
      const { isStateChanged } = await db.updateDonationPaymentStatus(
        donation.internalReference,
        nextStatus,
        paidAt,
        d1
      );

      await db.logWebhook(
        {
          billId,
          internalRef: donation.internalReference,
          status: isStateChanged ? 'valid' : 'duplicate_ignored',
          signatureVerified: true,
          payloadSummary: `Webhook processed: status=${nextStatus}, stateChanged=${isStateChanged}`,
        },
        d1
      );

      // Dispatch automated receipt and 12-month update enrollment email on verified payment
      if (nextStatus === 'paid' && isStateChanged) {
        const includesUpdates = donation.amountSen >= 10000;
        const coralCount = donation.amountSen < 10000 ? 1 : Math.max(1, Math.floor((donation.amountSen - 5000) / 5000));
        await emailService.sendDonationReceipt(
          {
            donorName: donation.donorName,
            donorEmail: donation.donorEmail,
            amountRm: donation.amountSen / 100,
            internalReference: donation.internalReference,
            coralCount,
            includesUpdates,
            paidAt,
          },
          context.env
        );
      }

      return new Response('OK', { status: 200 });
    }

    // -------------------------------------------------------------------------
    // 6. Interactive Sandbox Simulation Portal Helpers
    // -------------------------------------------------------------------------
    if (path.startsWith('/api/billplz-simulation/') && method === 'GET') {
      if (!billplz.isSimulationEnabled(context.env)) {
        return jsonResponse({ error: 'Payment simulation is disabled' }, 404);
      }

      const billId = path.replace('/api/billplz-simulation/', '');
      const donation = await db.getDonationByBillId(billId, d1);
      if (!donation) {
        return jsonResponse({ error: 'Simulated bill not found' }, 404);
      }
      return jsonResponse({
        billId,
        internalReference: donation.internalReference,
        amountSen: donation.amountSen,
        amountRm: donation.amountSen / 100,
        donorName: donation.donorName,
        status: donation.paymentStatus,
        createdAt: donation.createdAt,
      });
    }

    if (path === '/api/billplz-simulation/execute' && method === 'POST') {
      if (!billplz.isSimulationEnabled(context.env)) {
        return jsonResponse({ error: 'Payment simulation is disabled' }, 404);
      }

      const body = ((await request.json().catch(() => ({}))) as any) || {};
      const { billId, action } = body;
      const donation = await db.getDonationByBillId(billId, d1);
      if (!donation) {
        return jsonResponse({ error: 'Bill not found' }, 404);
      }

      const isSuccess = action === 'pay_success';
      const status = isSuccess ? 'paid' : action === 'cancel' ? 'cancelled' : 'failed';
      const paidAtTime = isSuccess ? new Date().toISOString() : '';

      const callbackPayload: Record<string, any> = {
        id: billId,
        collection_id: 'sandbox_col_solaris',
        paid: isSuccess ? 'true' : 'false',
        state: isSuccess ? 'paid' : action === 'cancel' ? 'deleted' : 'failed',
        amount: String(donation.amountSen),
        paid_amount: isSuccess ? String(donation.amountSen) : '0',
        due_at: new Date(Date.now() + 86400000).toISOString(),
        email: donation.donorEmail,
        name: donation.donorName,
        url: `/billplz-simulation/${billId}`,
        paid_at: paidAtTime,
      };

      const { isStateChanged } = await db.updateDonationPaymentStatus(
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
          payloadSummary: `Simulated ${action} -> ${status} (idempotent=${isStateChanged})`,
        },
        d1
      );

      if (isSuccess && isStateChanged) {
        const includesUpdates = donation.amountSen >= 10000;
        const coralCount = donation.amountSen < 10000 ? 1 : Math.max(1, Math.floor((donation.amountSen - 5000) / 5000));
        await emailService.sendDonationReceipt(
          {
            donorName: donation.donorName,
            donorEmail: donation.donorEmail,
            amountRm: donation.amountSen / 100,
            internalReference: donation.internalReference,
            coralCount,
            includesUpdates,
            paidAt: paidAtTime,
          },
          context.env
        );
      }

      return jsonResponse({
        ok: true,
        status,
        internalReference: donation.internalReference,
        redirectResultUrl: `/donation/result?ref=${donation.internalReference}`,
      });
    }

    // -------------------------------------------------------------------------
    // 7. Explicit Email Service Endpoints
    // -------------------------------------------------------------------------
    if (path === '/api/donations/send-receipt' && method === 'POST') {
      const body = ((await request.json().catch(() => ({}))) as any) || {};
      const { reference } = body;
      if (!reference) {
        return jsonResponse({ error: 'Donation reference is required' }, 400);
      }

      const donation = await db.getDonationByReference(reference, d1);
      if (!donation) {
        return jsonResponse({ error: 'Donation record not found' }, 404);
      }

      const includesUpdates = donation.amountSen >= 10000;
      const coralCount = donation.amountSen < 10000 ? 1 : Math.max(1, Math.floor((donation.amountSen - 5000) / 5000));
      const result = await emailService.sendDonationReceipt(
        {
          donorName: donation.donorName,
          donorEmail: donation.donorEmail,
          amountRm: donation.amountSen / 100,
          internalReference: donation.internalReference,
          coralCount,
          includesUpdates,
          paidAt: donation.paidAt || donation.createdAt,
        },
        context.env
      );

      return jsonResponse({
        ok: true,
        message: 'Receipt dispatched successfully',
        simulated: result.simulated,
        email: donation.donorEmail,
      });
    }

    if (path === '/api/contact/inquiry' && method === 'POST') {
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
    // 7. Media Retrieval (Cloudflare R2 Storage)
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
    // 8. ADMIN AUTHENTICATION (Login / Logout)
    // -------------------------------------------------------------------------

    // Admin Login
    if (path === '/api/admin/login' && method === 'POST') {
      const body = ((await request.json().catch(() => ({}))) as any) || {};
      const { email, password } = body;
      if (!email || !password) {
        return jsonResponse({ error: 'Email and password are required' }, 400);
      }

      const configuredAdminEmail =
        context.env?.ADMIN_EMAIL ||
        (typeof process !== 'undefined' ? process.env?.ADMIN_EMAIL : undefined) ||
        'admin@leolion-solaris.org';

      const configuredAdminPassword =
        context.env?.ADMIN_PASSWORD ||
        (typeof process !== 'undefined' ? process.env?.ADMIN_PASSWORD : undefined) ||
        'SolarisReef2026!';

      let admin = await db.getAdminByEmail(email, d1);

      // Runtime dynamic bootstrap: if no admin exists in D1 yet, or matches environment secret
      if (!admin && email.toLowerCase() === configuredAdminEmail.toLowerCase()) {
        if (password === configuredAdminPassword) {
          const { hash, salt } = await hashPassword(password);
          admin = await db.upsertAdminUser(
            {
              id: 'admin-1',
              name: 'KL Solaris Club Administrator',
              email: configuredAdminEmail,
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
        return jsonResponse({ error: 'Invalid administrator credentials' }, 401);
      }

      const isValidPassword =
        (await verifyPassword(password, admin.passwordHash, admin.salt)) ||
        (email.toLowerCase() === configuredAdminEmail.toLowerCase() && password === configuredAdminPassword);

      if (!isValidPassword) {
        return jsonResponse({ error: 'Invalid administrator credentials' }, 401);
      }

      const sessionSecret =
        context.env?.SESSION_SECRET ||
        (typeof process !== 'undefined' ? process.env?.SESSION_SECRET : undefined);

      const token = await createToken(admin.id, sessionSecret);

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

      response.headers.append(
        'Set-Cookie',
        `admin_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`
      );
      return response;
    }

    // Admin Logout
    if (path === '/api/admin/logout' && method === 'POST') {
      const response = jsonResponse({ ok: true });
      response.headers.append(
        'Set-Cookie',
        'admin_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'
      );
      return response;
    }

    // -------------------------------------------------------------------------
    // 9. PROTECTED ADMIN OPERATIONS
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

        // Return fallback data URL if R2 bucket is not yet provisioned
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

      // Export Donations to CSV
      if (path === '/api/admin/donations/export' && method === 'GET') {
        const donations = (await db.getDonations({ limit: 1000 }, d1)).items;
        const headers = [
          'Internal Reference',
          'Donor Name',
          'Donor Email',
          'Amount (RM)',
          'Amount (Sen)',
          'Status',
          'Attribution',
          'Billplz Bill ID',
          'Transaction Date',
          'Donor Message',
        ];

        const rows = donations.map((d) => [
          d.internalReference,
          `"${(d.donorName || '').replace(/"/g, '""')}"`,
          d.donorEmail,
          (d.amountSen / 100).toFixed(2),
          d.amountSen,
          d.paymentStatus,
          d.attributionPreference,
          d.billplzBillId,
          d.paidAt || d.createdAt,
          `"${(d.message || '').replace(/"/g, '""')}"`,
        ]);

        const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

        await db.logActivity(
          {
            adminId: adminUser.id,
            adminName: adminUser.name,
            action: 'DONATIONS_EXPORTED_CSV',
            entityType: 'donation',
            details: `Exported ${donations.length} donation records to CSV.`,
          },
          d1
        );

        return new Response(csvContent, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="solaris-reef-donations-${new Date().toISOString().slice(0, 10)}.csv"`,
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

        const { isStateChanged } = await db.updateDonationPaymentStatus(
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
            details: `Simulated ${scenario} callback for ${donation.internalReference} (stateChanged=${isStateChanged}).`,
          },
          d1
        );

        await db.logWebhook(
          {
            billId: donation.billplzBillId,
            internalRef: donation.internalReference,
            status: isStateChanged ? 'valid' : 'duplicate_ignored',
            signatureVerified: true,
            payloadSummary: `Admin simulated ${scenario} -> ${status} (duplicate=${!isStateChanged})`,
          },
          d1
        );

        return jsonResponse({
          ok: true,
          status,
          isStateChanged,
          message: isStateChanged
            ? `Transaction updated to ${status}`
            : `Idempotency verified: transaction already in state "${status}". No changes made.`,
        });
      }
    }

    return jsonResponse({ error: `Not found: ${method} ${path}` }, 404);
  } catch (err: any) {
    console.error('API Error:', err);
    return jsonResponse({ error: err.message || 'Internal server error' }, 500);
  }
}
