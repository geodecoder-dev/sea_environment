/**
 * Email Service for Solaris Reef Citizen Restoration Programme
 * Dispatches donation receipts, update notifications, and contact inquiries.
 * Integrates Resend API when RESEND_API_KEY is configured.
 * Email dispatch failures are logged cleanly without affecting payment confirmation state.
 */

import { siteConfig } from '../src/config/site.js';
import {
  ReceiptPayload,
  generateReceiptEmailHtml,
  escapeHtml,
} from './services/receipts.js';

export { escapeHtml, generateReceiptEmailHtml };
export type { ReceiptPayload };

export interface ContactInquiryEmailData {
  name: string;
  email: string;
  phone?: string;
  organisation?: string;
  message: string;
}

export class EmailService {
  /**
   * Dispatches an official donation receipt to the donor.
   */
  public async sendDonationReceipt(
    data: ReceiptPayload,
    env?: Record<string, any>
  ): Promise<{ success: boolean; messageId?: string; simulated: boolean; error?: string }> {
    const resendApiKey = env?.RESEND_API_KEY || (typeof process !== 'undefined' ? process.env?.RESEND_API_KEY : '');
    const emailFrom = env?.EMAIL_FROM || (typeof process !== 'undefined' ? process.env?.EMAIL_FROM : '') || 'Solaris Reef Campaign <receipts@solaris-reef.org>';

    const html = generateReceiptEmailHtml(data);

    if (resendApiKey && resendApiKey !== 'your_resend_api_key_here') {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: emailFrom,
            to: [data.donorEmail],
            subject: `Official Receipt #${data.internalReference} — Solaris Reef Coral Sponsorship (RM ${data.amountRm.toFixed(2)})`,
            html,
          }),
        });

        if (response.ok) {
          const result = (await response.json()) as any;
          console.info(`[EMAIL] Sent official receipt ${data.internalReference} via Resend (${result.id})`);
          return { success: true, messageId: result.id, simulated: false };
        } else {
          const errText = await response.text();
          console.warn(`[EMAIL] Resend API error (${response.status}): ${errText}`);
          return { success: false, simulated: false, error: errText };
        }
      } catch (err: any) {
        console.warn(`[EMAIL] Network error sending receipt via Resend:`, err.message);
        return { success: false, simulated: false, error: err.message };
      }
    }

    // Fallback simulation / audit mode (in dev/sandbox without Resend credentials)
    console.info(
      `[EMAIL SIMULATION] Official receipt ${data.internalReference} generated for ${data.donorEmail} (RM ${data.amountRm.toFixed(2)})`
    );
    return {
      success: true,
      messageId: `sim_${Date.now()}`,
      simulated: true,
    };
  }

  /**
   * Handles contact form inquiries.
   */
  public async sendContactInquiry(
    inquiry: ContactInquiryEmailData,
    env?: Record<string, any>
  ): Promise<{ success: boolean; simulated: boolean }> {
    const resendApiKey = env?.RESEND_API_KEY || (typeof process !== 'undefined' ? process.env?.RESEND_API_KEY : '');
    const targetEmail = siteConfig.contact.email;

    const safeName = escapeHtml(inquiry.name);
    const safeEmail = escapeHtml(inquiry.email);
    const safePhone = escapeHtml(inquiry.phone || 'Not provided');
    const safeOrg = escapeHtml(inquiry.organisation || 'Individual');
    const safeMsg = escapeHtml(inquiry.message).replace(/\n/g, '<br>');

    const html = `
      <h3>New Solaris Reef Inquiry</h3>
      <p><strong>Name:</strong> ${safeName}</p>
      <p><strong>Email:</strong> ${safeEmail}</p>
      <p><strong>Phone:</strong> ${safePhone}</p>
      <p><strong>Organisation:</strong> ${safeOrg}</p>
      <hr>
      <p><strong>Message:</strong></p>
      <div>${safeMsg}</div>
    `;

    if (resendApiKey && resendApiKey !== 'your_resend_api_key_here') {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Solaris Reef Inquiries <inquiries@solaris-reef.org>',
            to: [targetEmail],
            reply_to: inquiry.email,
            subject: `Solaris Reef Contact: ${safeName} (${safeOrg})`,
            html,
          }),
        });
        return { success: true, simulated: false };
      } catch (err) {
        console.warn('[EMAIL] Failed to send contact inquiry via Resend:', err);
      }
    }

    console.info(`[EMAIL SIMULATION] Inquiry received from ${inquiry.name} <${inquiry.email}>`);
    return { success: true, simulated: true };
  }
}

export const emailService = new EmailService();
