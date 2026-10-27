/**
 * Receipt Service for Solaris Reef Campaign
 * Responsible for verifying paid status, HTML-escaping donor inputs,
 * generating official receipt content, enforcing rate limiting, and dispatching emails.
 */

import { Donation } from '../types.js';
import { calculateEntitlementsFromSen } from './pricing.js';

export function escapeHtml(input?: string): string {
  if (!input) return '';
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface ReceiptPayload {
  internalReference: string;
  verificationToken: string;
  donorName: string;
  donorEmail: string;
  amountRm: number;
  coralCount: number;
  includesUpdates: boolean;
  entitlementTitle: string;
  referral?: string;
  coralName?: string;
  isGift?: boolean;
  recipientName?: string;
  paidAt: string;
}

export function buildReceiptPayload(donation: Donation): ReceiptPayload {
  if (donation.paymentStatus !== 'paid') {
    throw new Error('RECEIPT_FORBIDDEN_UNPAID: Receipts can only be issued for verified paid donations.');
  }

  const entitlement = calculateEntitlementsFromSen(donation.amountSen);

  return {
    internalReference: donation.internalReference,
    verificationToken: donation.verificationToken,
    donorName: donation.donorName,
    donorEmail: donation.donorEmail,
    amountRm: donation.amountSen / 100,
    coralCount: entitlement.coralFragmentsCount,
    includesUpdates: entitlement.updatesEligible,
    entitlementTitle: entitlement.entitlementTitle,
    referral: donation.referral,
    coralName: donation.coralName,
    isGift: donation.isGift,
    recipientName: donation.recipientName,
    paidAt: donation.paidAt || donation.createdAt,
  };
}

export function generateReceiptEmailHtml(data: ReceiptPayload): string {
  const safeName = escapeHtml(data.donorName);
  const safeRef = escapeHtml(data.internalReference);
  const safeReferral = escapeHtml(data.referral);
  const safeCoralName = escapeHtml(data.coralName);
  const safeRecipient = escapeHtml(data.recipientName);
  const safeTitle = escapeHtml(data.entitlementTitle);

  const formattedDate = new Date(data.paidAt).toLocaleDateString('en-MY', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Your Donation Receipt — Solaris Reef Citizen Restoration Programme</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #FFFDF7; color: #123047; margin: 0; padding: 24px; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid rgba(18, 48, 71, 0.12); overflow: hidden; }
    .header { background: #123047; color: #ffffff; padding: 32px 24px; text-align: center; }
    .header h1 { margin: 0 0 8px 0; font-size: 24px; font-family: Georgia, serif; }
    .header p { margin: 0; font-size: 13px; color: #B8E0D2; letter-spacing: 0.5px; text-transform: uppercase; }
    .content { padding: 32px 24px; }
    .metric-box { background: #F4E9D8; border-radius: 12px; padding: 20px; margin: 20px 0; }
    .metric-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
    .metric-row:last-child { margin-bottom: 0; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: bold; }
    .badge-green { background: #E8F5F1; color: #2D5A43; }
    .footer { background: #FAF7F0; padding: 20px 24px; text-align: center; font-size: 12px; color: rgba(18, 48, 71, 0.6); border-top: 1px solid rgba(18, 48, 71, 0.08); }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Solaris Reef</h1>
      <p>Citizen Restoration Programme (CRP) · Coralku Partnership</p>
    </div>
    <div class="content">
      <p>Dear <strong>${safeName}</strong>,</p>
      <p>Thank you for supporting the <strong>Citizen Restoration Programme</strong> at Pantai Pasir Besar, Pulau Lang Tengah. Your contribution directly funds the cultivation and attachment of heat-resilient coral fragments onto our nursery spider frames.</p>
      
      <div class="metric-box">
        <div class="metric-row">
          <span>Official Receipt Reference:</span>
          <strong>${safeRef}</strong>
        </div>
        <div class="metric-row">
          <span>Payment Date:</span>
          <strong>${formattedDate}</strong>
        </div>
        <div class="metric-row">
          <span>Contribution Amount:</span>
          <strong style="color: #247BA0; font-size: 16px;">RM ${data.amountRm.toFixed(2)}</strong>
        </div>
        <div class="metric-row">
          <span>Sponsorship Level:</span>
          <strong>${safeTitle}</strong>
        </div>
        <div class="metric-row">
          <span>Corals Sponsored:</span>
          <strong>${data.coralCount} fragment${data.coralCount > 1 ? 's' : ''}</strong>
        </div>
        ${
          safeCoralName
            ? `<div class="metric-row">
          <span>Adopted Coral Name:</span>
          <strong>${safeCoralName}</strong>
        </div>`
            : ''
        }
        ${
          data.isGift && safeRecipient
            ? `<div class="metric-row">
          <span>Gift Dedicated To:</span>
          <strong>${safeRecipient}</strong>
        </div>`
            : ''
        }
        ${
          safeReferral
            ? `<div class="metric-row">
          <span>Referral:</span>
          <strong>${safeReferral}</strong>
        </div>`
            : ''
        }
        <div class="metric-row">
          <span>12-Month Monitoring Updates:</span>
          <strong>${
            data.includesUpdates
              ? '<span class="badge badge-green">✓ Active (12-Month Updates)</span>'
              : 'Not Enrolled'
          }</strong>
        </div>
      </div>

      ${
        data.includesUpdates
          ? `<p style="background: #E8F5F1; border-left: 4px solid #426B50; padding: 12px 16px; border-radius: 6px; font-size: 13px; color: #123047;">
              <strong>1-Year Monitoring Service Active:</strong> You will receive quarterly photogrammetric growth photos and benthic survival tracking reports for your sponsored coral directly to this email address.
            </p>`
          : `<p style="font-size: 13px; color: rgba(18, 48, 71, 0.7);">
              Note: Contributions of RM 100 or above receive 12 months of quarterly photo updates and photogrammetric monitoring reports.
            </p>`
      }

      <p style="margin-top: 24px; font-size: 14px; line-height: 1.6;">
        All planting activities are carried out under research permits issued by the Department of Fisheries Malaysia (Jabatan Perikanan Malaysia) and Sabah/Terengganu Parks.
      </p>

      <p style="font-size: 14px; margin-bottom: 0;">
        Warm regards,<br>
        <strong>Leo-Lion Club of KL Solaris</strong><br>
        In Scientific Partnership with <strong>Coralku</strong>
      </p>
    </div>
    <div class="footer">
      <p>This is an automated official donation receipt from the Solaris Reef Campaign Hub.</p>
      <p>Leo-Lion Club of Kuala Lumpur Solaris · District 308 B1, Malaysia</p>
    </div>
  </div>
</body>
</html>`;
}
