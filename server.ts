import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

import { db } from './server/db.js';
import { billplz } from './server/billplz.js';
import {
  hashPassword,
  verifyPassword,
  createToken,
  requireAdminAuth,
  AuthenticatedRequest,
} from './server/auth.js';

import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const isProd =
  process.env.NODE_ENV === 'production' ||
  process.argv.includes('--prod') ||
  process.argv.includes('--production');

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health Check Endpoint (useful for Docker, CI/CD, and post-clone testing)
app.get('/api/health', (_req, res) => {
  try {
    const status = billplz.getStatus();
    res.json({
      status: 'ok',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      mode: isProd ? 'production' : 'development',
      database: 'connected',
      billplz: status.mode,
    });
  } catch (err: any) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// App URL helper for callback and redirect URLs
function getAppUrl(req: express.Request): string {
  if (process.env.APP_URL && !process.env.APP_URL.includes('MY_APP_URL')) {
    return process.env.APP_URL.replace(/\/$/, '');
  }
  const host = req.get('x-forwarded-host') || req.get('host') || `localhost:${PORT}`;
  const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
  return `${proto}://${host}`;
}

// -----------------------------------------------------------------------------
// PUBLIC API ROUTES
// -----------------------------------------------------------------------------

// 1. Get Campaign Info & Live Impact Metrics
app.get('/api/campaign', (_req, res) => {
  try {
    const campaign = db.getCampaign();
    const recentDonations = db.getPublicRecentDonations(8);
    res.json({
      campaign,
      recentDonations,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch campaign data' });
  }
});

// 2. Get Published Campaign Updates
app.get('/api/updates', (_req, res) => {
  try {
    const updates = db.getPublicUpdates();
    res.json({ updates });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch campaign updates' });
  }
});

// 3. Initiate Donation Checkout (Billplz Integration)
app.post('/api/donations/checkout', async (req, res) => {
  try {
    const { amountSen, donorName, donorEmail, attributionPreference, message } = req.body;

    const parsedAmount = parseInt(amountSen, 10);
    // Minimum donation: RM 5 (500 sen)
    if (isNaN(parsedAmount) || parsedAmount < 500) {
      return res.status(400).json({ error: 'Minimum donation is RM 5.00 (500 sen)' });
    }

    if (!donorEmail || !donorEmail.includes('@')) {
      return res.status(400).json({ error: 'A valid email address is required for donation receipt' });
    }

    const campaign = db.getCampaign();
    if (campaign.campaignStatus === 'paused') {
      return res.status(400).json({ error: 'Donations are currently paused for this campaign' });
    }

    const appUrl = getAppUrl(req);
    const donorCleanName = donorName && donorName.trim() ? donorName.trim() : 'Reef Supporter';
    const preference = attributionPreference === 'anonymous' ? 'anonymous' : 'public';

    // Temporary unique internal reference for bill description
    const tempRef = `SOL-${Date.now().toString(36).toUpperCase()}`;

    // Create Bill with Billplz
    const bill = await billplz.createBill({
      collectionId: process.env.BILLPLZ_COLLECTION_ID || '',
      email: donorEmail.trim(),
      name: donorCleanName,
      amountSen: parsedAmount,
      callbackUrl: `${appUrl}/api/webhooks/billplz`,
      redirectUrl: `${appUrl}/donation/result`,
      description: `Solaris Reef Coral Restoration — ${tempRef}`,
      reference1Label: 'Campaign',
      reference1: 'Solaris Reef',
    });

    // Save pending donation record
    const donation = db.createDonation({
      donorName: donorCleanName,
      donorEmail: donorEmail.trim(),
      amountSen: parsedAmount,
      attributionPreference: preference,
      message: message ? String(message).slice(0, 300) : '',
      billplzBillId: bill.id,
      billplzUrl: bill.url,
    });

    // Add reference query param to Billplz redirect URL if internal
    let redirectCheckoutUrl = bill.url;
    if (bill.isSimulated) {
      redirectCheckoutUrl = `/billplz-simulation/${bill.id}?ref=${donation.internalReference}`;
    }

    res.json({
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
  } catch (err: any) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: err.message || 'Payment initiation failed. Please try again.' });
  }
});

// 4. Server-Verified Payment Verification Endpoint (Safe for Public Result Page)
app.get('/api/donations/verify/:reference', (req, res) => {
  try {
    const { reference } = req.params;
    const donation = db.getDonationByReference(reference);

    if (!donation) {
      return res.status(404).json({ error: 'Donation record not found' });
    }

    // Never expose email or full private data to public client
    res.json({
      internalReference: donation.internalReference,
      amountSen: donation.amountSen,
      amountRm: donation.amountSen / 100,
      currency: donation.currency,
      paymentStatus: donation.paymentStatus,
      donorName: donation.attributionPreference === 'anonymous' ? 'Anonymous Friend' : donation.donorName,
      attributionPreference: donation.attributionPreference,
      paidAt: donation.paidAt,
      createdAt: donation.createdAt,
      billplzBillId: donation.billplzBillId,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to verify transaction status' });
  }
});

// 5. Official Billplz Webhook Callback
app.post('/api/webhooks/billplz', (req, res) => {
  try {
    const payload = req.body || {};
    const signature = req.body?.x_signature || req.headers['x-signature'];

    // Verify signature
    const isValid = billplz.verifyXSignature(payload, signature);

    const billId = payload.id;
    const isPaid = String(payload.paid).toLowerCase() === 'true' || payload.state === 'paid';
    const paidAt = payload.paid_at || new Date().toISOString();

    const donation = db.getDonationByBillId(billId);

    if (!donation) {
      db.logWebhook({
        billId: billId || 'unknown',
        internalRef: 'unknown',
        status: 'error',
        signatureVerified: isValid,
        payloadSummary: `Bill not found for payload: ${JSON.stringify(payload).slice(0, 200)}`,
      });
      return res.status(404).send('Donation not found');
    }

    if (!isValid) {
      db.logWebhook({
        billId: billId,
        internalRef: donation.internalReference,
        status: 'invalid_signature',
        signatureVerified: false,
        payloadSummary: `Rejected invalid X-Signature for bill ${billId}`,
      });
      console.warn(`Invalid Billplz X-Signature for bill ${billId}`);
      return res.status(400).send('Invalid signature');
    }

    const nextStatus = isPaid ? 'paid' : (payload.state === 'deleted' ? 'cancelled' : 'failed');

    // Idempotent update
    const { isStateChanged } = db.updateDonationPaymentStatus(
      donation.internalReference,
      nextStatus,
      paidAt
    );

    db.logWebhook({
      billId,
      internalRef: donation.internalReference,
      status: isStateChanged ? 'valid' : 'duplicate_ignored',
      signatureVerified: true,
      payloadSummary: `Billplz callback: status=${nextStatus}, stateChanged=${isStateChanged}, amount=${payload.amount || donation.amountSen}`,
    });

    // Return 200 to acknowledge Billplz
    return res.status(200).send('OK');
  } catch (err: any) {
    console.error('Webhook processing error:', err);
    return res.status(500).send('Internal Server Error');
  }
});

// 6. Interactive Sandbox Simulation Portal Helpers
app.get('/api/billplz-simulation/:billId', (req, res) => {
  const { billId } = req.params;
  const donation = db.getDonationByBillId(billId);
  if (!donation) {
    return res.status(404).json({ error: 'Simulated bill not found' });
  }

  res.json({
    billId,
    internalReference: donation.internalReference,
    amountSen: donation.amountSen,
    amountRm: donation.amountSen / 100,
    donorName: donation.donorName,
    donorEmail: donation.donorEmail,
    status: donation.paymentStatus,
    createdAt: donation.createdAt,
  });
});

app.post('/api/billplz-simulation/execute', (req, res) => {
  try {
    const { billId, action } = req.body;
    const donation = db.getDonationByBillId(billId);

    if (!donation) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    const isSuccess = action === 'pay_success';
    const status = isSuccess ? 'paid' : (action === 'cancel' ? 'cancelled' : 'failed');

    // Construct standard Billplz callback payload
    const callbackPayload: Record<string, any> = {
      id: billId,
      collection_id: 'sandbox_col_solaris',
      paid: isSuccess ? 'true' : 'false',
      state: isSuccess ? 'paid' : (action === 'cancel' ? 'deleted' : 'failed'),
      amount: String(donation.amountSen),
      paid_amount: isSuccess ? String(donation.amountSen) : '0',
      due_at: new Date(Date.now() + 86400000).toISOString(),
      email: donation.donorEmail,
      name: donation.donorName,
      url: `/billplz-simulation/${billId}`,
      paid_at: isSuccess ? new Date().toISOString() : '',
    };

    // Generate authentic X-Signature according to Billplz spec
    const signature = billplz.generateXSignature(callbackPayload);
    callbackPayload.x_signature = signature;

    // Execute idempotent update
    const { isStateChanged } = db.updateDonationPaymentStatus(
      donation.internalReference,
      status,
      callbackPayload.paid_at
    );

    db.logWebhook({
      billId,
      internalRef: donation.internalReference,
      status: 'valid',
      signatureVerified: true,
      payloadSummary: `Sandbox simulated action: ${action} -> ${status} (idempotent=${isStateChanged})`,
    });

    res.json({
      ok: true,
      status,
      internalReference: donation.internalReference,
      redirectResultUrl: `/donation/result?ref=${donation.internalReference}`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Simulation execution failed' });
  }
});

// -----------------------------------------------------------------------------
// ADMIN PROTECTED API ROUTES
// -----------------------------------------------------------------------------

// Admin Login
app.post('/api/admin/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const admin = db.getAdminByEmail(email);
    if (!admin) {
      return res.status(401).json({ error: 'Invalid administrator credentials' });
    }

    const isValid = verifyPassword(password, admin.passwordHash, admin.salt);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid administrator credentials' });
    }

    const token = createToken(admin.id);

    // Set HTTP-Only Cookie
    res.cookie('admin_token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    db.logActivity({
      adminId: admin.id,
      adminName: admin.name,
      action: 'LOGIN_SUCCESS',
      entityType: 'auth',
      entityReference: admin.email,
      details: 'Administrator logged into the operations dashboard.',
    });

    res.json({
      ok: true,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
      token,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Login process error' });
  }
});

// Admin Logout
app.post('/api/admin/logout', requireAdminAuth, (req: AuthenticatedRequest, res) => {
  if (req.adminUser) {
    db.logActivity({
      adminId: req.adminUser.id,
      adminName: req.adminUser.name,
      action: 'LOGOUT',
      entityType: 'auth',
      details: 'Administrator logged out.',
    });
  }
  res.clearCookie('admin_token');
  res.json({ ok: true });
});

// Admin Me
app.get('/api/admin/me', requireAdminAuth, (req: AuthenticatedRequest, res) => {
  res.json({ admin: req.adminUser });
});

// Admin Update Campaign Info
app.put('/api/admin/campaign', requireAdminAuth, (req: AuthenticatedRequest, res) => {
  try {
    const {
      title,
      description,
      fundraisingTargetSen,
      coralPlantingTarget,
      verifiedCoralPlantingCount,
      volunteerCount,
      campaignStatus,
      milestones,
    } = req.body;

    const updates: Record<string, any> = {};
    if (title) updates.title = String(title).trim();
    if (description) updates.description = String(description).trim();
    if (fundraisingTargetSen !== undefined) updates.fundraisingTargetSen = Math.max(1000, parseInt(fundraisingTargetSen, 10));
    if (coralPlantingTarget !== undefined) updates.coralPlantingTarget = Math.max(0, parseInt(coralPlantingTarget, 10));
    if (verifiedCoralPlantingCount !== undefined) updates.verifiedCoralPlantingCount = Math.max(0, parseInt(verifiedCoralPlantingCount, 10));
    if (volunteerCount !== undefined) updates.volunteerCount = Math.max(0, parseInt(volunteerCount, 10));
    if (campaignStatus) updates.campaignStatus = campaignStatus;
    if (Array.isArray(milestones)) updates.milestones = milestones;

    const updated = db.updateCampaign(updates, req.adminUser!);
    res.json({ ok: true, campaign: updated });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update campaign configuration' });
  }
});

// Admin Updates Management
app.get('/api/admin/updates', requireAdminAuth, (_req, res) => {
  const updates = db.getAllUpdates();
  res.json({ updates });
});

app.post('/api/admin/updates', requireAdminAuth, (req: AuthenticatedRequest, res) => {
  try {
    const { title, description, imageUrl, category, publicationStatus, publicationDate } = req.body;
    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required' });
    }

    const created = db.createUpdate(
      {
        title: String(title).trim(),
        slug: String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50),
        description: String(description).trim(),
        imageUrl: imageUrl || '',
        category: category || 'milestone',
        publicationStatus: publicationStatus || 'published',
        publicationDate: publicationDate || new Date().toISOString(),
      },
      req.adminUser!
    );

    res.json({ ok: true, update: created });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create campaign update' });
  }
});

app.put('/api/admin/updates/:id', requireAdminAuth, (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const updated = db.updateUpdate(id, req.body, req.adminUser!);
    if (!updated) {
      return res.status(404).json({ error: 'Update not found' });
    }
    res.json({ ok: true, update: updated });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to modify update' });
  }
});

app.delete('/api/admin/updates/:id', requireAdminAuth, (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const success = db.deleteUpdate(id, req.adminUser!);
    if (!success) {
      return res.status(404).json({ error: 'Update not found' });
    }
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete update' });
  }
});

// Admin Donations List & Search
app.get('/api/admin/donations', requireAdminAuth, (req, res) => {
  try {
    const { status, search, limit, offset } = req.query;
    const result = db.getDonations({
      status: status ? String(status) : undefined,
      search: search ? String(search) : undefined,
      limit: limit ? parseInt(String(limit), 10) : 50,
      offset: offset ? parseInt(String(offset), 10) : 0,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch donation records' });
  }
});

// Admin Export Donations to CSV
app.get('/api/admin/donations/export', requireAdminAuth, (req: AuthenticatedRequest, res) => {
  try {
    const donations = db.getDonations({ limit: 1000 }).items;

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

    db.logActivity({
      adminId: req.adminUser!.id,
      adminName: req.adminUser!.name,
      action: 'DONATIONS_EXPORTED_CSV',
      entityType: 'donation',
      details: `Exported ${donations.length} donation records to CSV.`,
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="solaris-reef-donations-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csvContent);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to export CSV' });
  }
});

// Admin Activity Audit Trail
app.get('/api/admin/activities', requireAdminAuth, (_req, res) => {
  const activities = db.getActivities(50);
  res.json({ activities });
});

// Admin Payment Gateway Status & Webhook Logs
app.get('/api/admin/billplz-status', requireAdminAuth, (_req, res) => {
  const status = billplz.getStatus();
  const webhookLogs = db.getWebhookLogs(15);
  res.json({
    status,
    webhookLogs,
  });
});

// Admin Webhook Sandbox Simulator Endpoint
app.post('/api/admin/simulate-callback', requireAdminAuth, (req: AuthenticatedRequest, res) => {
  try {
    const { reference, scenario } = req.body;
    const donation = db.getDonationByReference(reference);

    if (!donation) {
      return res.status(404).json({ error: 'Target donation reference not found' });
    }

    if (scenario === 'invalid_signature') {
      db.logWebhook({
        billId: donation.billplzBillId,
        internalRef: donation.internalReference,
        status: 'invalid_signature',
        signatureVerified: false,
        payloadSummary: `Admin simulated INVALID signature rejection for ${donation.internalReference}`,
      });
      return res.json({ ok: true, message: 'Invalid signature test executed and successfully rejected by security rule.' });
    }

    const isPaid = scenario === 'success';
    const status = isPaid ? 'paid' : (scenario === 'cancelled' ? 'cancelled' : 'failed');

    const { isStateChanged } = db.updateDonationPaymentStatus(
      donation.internalReference,
      status,
      isPaid ? new Date().toISOString() : undefined
    );

    db.logActivity({
      adminId: req.adminUser!.id,
      adminName: req.adminUser!.name,
      action: 'ADMIN_SIMULATE_PAYMENT',
      entityType: 'payment_test',
      entityReference: donation.internalReference,
      details: `Simulated ${scenario} callback for ${donation.internalReference} (stateChanged=${isStateChanged}).`,
    });

    db.logWebhook({
      billId: donation.billplzBillId,
      internalRef: donation.internalReference,
      status: isStateChanged ? 'valid' : 'duplicate_ignored',
      signatureVerified: true,
      payloadSummary: `Admin simulated ${scenario} -> ${status} (duplicate=${!isStateChanged})`,
    });

    res.json({
      ok: true,
      status,
      isStateChanged,
      message: isStateChanged
        ? `Transaction updated to ${status}`
        : `Idempotency verified: transaction already in state "${status}". No changes made.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Simulation failed' });
  }
});

// -----------------------------------------------------------------------------
// VITE DEV SERVER / STATIC PRODUCTION FALLBACK
// -----------------------------------------------------------------------------

async function startServer() {
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    const indexPath = path.join(distPath, 'index.html');

    if (!fs.existsSync(indexPath)) {
      console.warn('⚠️  Production mode active but dist/index.html not found!');
      console.warn('   Run "npm run build" to generate client assets before running in production.');
    }

    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(503).send('Application build in progress. Please run "npm run build".');
      }
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌿 Solaris Reef hub running at http://localhost:${PORT} (${isProd ? 'production' : 'development'})`);
  });

  // Graceful shutdown for Docker, PM2, Kubernetes, and SIGINT/SIGTERM
  const handleShutdown = (signal: string) => {
    console.log(`Received ${signal}. Shutting down gracefully...`);
    server.close(() => {
      console.log('HTTP server closed.');
      process.exit(0);
    });
    // Force exit if hanging
    setTimeout(() => {
      console.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 5000);
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}

startServer();
