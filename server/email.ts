```typescript
/**
 * Email Service for Solaris Reef Citizen Restoration Programme
 *
 * Handles:
 * - Donation receipt emails to donors.
 * - Contact inquiry notifications to administrators.
 *
 * Integrates with Resend API.
 *
 * Email dispatch failures are logged cleanly without affecting
 * payment confirmation state.
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

/**
 * Supported environment variables.
 *
 * Cloudflare Workers:
 * Pass env bindings into the email service methods.
 *
 * Node.js:
 * Falls back to process.env.
 */
interface EmailEnvironment {
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  INQUIRY_EMAIL?: string;
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  simulated: boolean;
  error?: string;
}

/**
 * Retrieves environment variables.
 */
function getEnvironmentValue(
  key: keyof EmailEnvironment,
  env?: EmailEnvironment
): string {
  const envValue = env?.[key];

  if (envValue) {
    return envValue;
  }

  if (typeof process !== 'undefined' && process.env?.[key]) {
    return process.env[key] || '';
  }

  return '';
}

/**
 * Checks whether Resend is configured.
 */
function getResendApiKey(env?: EmailEnvironment): string {
  const key = getEnvironmentValue('RESEND_API_KEY', env);

  if (!key || key === 'your_resend_api_key_here') {
    return '';
  }

  return key;
}

/**
 * Sends an email using Resend.
 */
async function sendViaResend(
  apiKey: string,
  payload: Record<string, any>
): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',

      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },

      body: JSON.stringify(payload),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error(
        `[EMAIL] Resend API error (${response.status}): ${responseText}`
      );

      return {
        success: false,
        error: `Resend API returned HTTP ${response.status}: ${responseText}`,
      };
    }

    let result: { id?: string };

    try {
      result = JSON.parse(responseText);
    } catch {
      console.error('[EMAIL] Resend returned an invalid JSON response.');

      return {
        success: false,
        error: 'Invalid response received from Resend.',
      };
    }

    if (!result.id) {
      console.error('[EMAIL] Resend response did not contain an email ID.');

      return {
        success: false,
        error: 'Resend did not return an email ID.',
      };
    }

    return {
      success: true,
      messageId: result.id,
    };
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : String(err);

    console.error('[EMAIL] Network error:', errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

export class EmailService {

  /**
   * Sends an official donation receipt to the donor.
   *
   * Recipient:
   * data.donorEmail
   *
   * This method does not modify payment confirmation state.
   */
  public async sendDonationReceipt(
    data: ReceiptPayload,
    env?: EmailEnvironment
  ): Promise<EmailResult> {

    const resendApiKey = getResendApiKey(env);

    const emailFrom =
      getEnvironmentValue('EMAIL_FROM', env) ||
      'Solaris Reef Campaign <receipts@solaris-reef.org>';

    const html = generateReceiptEmailHtml(data);

    const subject =
      `Official Receipt #${data.internalReference} — ` +
      `Solaris Reef Coral Sponsorship (RM ${data.amountRm.toFixed(2)})`;

    // Simulation mode when Resend credentials are unavailable.
    if (!resendApiKey) {
      console.info(
        `[EMAIL SIMULATION] Donation receipt generated for ` +
        `${data.donorEmail} | Reference: ${data.internalReference} | ` +
        `Amount: RM ${data.amountRm.toFixed(2)}`
      );

      return {
        success: true,
        messageId: `sim_${Date.now()}`,
        simulated: true,
      };
    }

    const result = await sendViaResend(resendApiKey, {
      from: emailFrom,
      to: [data.donorEmail],
      subject,
      html,
    });

    if (!result.success) {
      console.error(
        `[EMAIL] Failed to send donation receipt ${data.internalReference}:`,
        result.error
      );

      return {
        success: false,
        simulated: false,
        error: result.error,
      };
    }

    console.info(
      `[EMAIL] Donation receipt ${data.internalReference} submitted to Resend. ` +
      `Message ID: ${result.messageId}`
    );

    return {
      success: true,
      messageId: result.messageId,
      simulated: false,
    };
  }

  /**
   * Sends contact inquiry notifications to the administrator.
   *
   * Recipient:
   * INQUIRY_EMAIL environment variable, or
   * siteConfig.contact.email as fallback.
   *
   * Reply-To:
   * The original inquiry sender.
   */
  public async sendContactInquiry(
    inquiry: ContactInquiryEmailData,
    env?: EmailEnvironment
  ): Promise<EmailResult> {

    const resendApiKey = getResendApiKey(env);

    const targetEmail =
      getEnvironmentValue('INQUIRY_EMAIL', env) ||
      siteConfig.contact.email;

    const emailFrom =
      getEnvironmentValue('EMAIL_FROM', env) ||
      'Solaris Reef Campaign <inquiries@solaris-reef.org>';

    // Escape all user-submitted content before inserting into HTML.
    const safeName = escapeHtml(inquiry.name);
    const safeEmail = escapeHtml(inquiry.email);
    const safePhone = escapeHtml(inquiry.phone || 'Not provided');
    const safeOrg = escapeHtml(inquiry.organisation || 'Individual');
    const safeMsg = escapeHtml(inquiry.message).replace(/\n/g, '<br>');

    const html = `
      <!DOCTYPE html>
      <html>
        <body>
          <h2>New Solaris Reef Inquiry</h2>

          <p>
            <strong>Name:</strong> ${safeName}
          </p>

          <p>
            <strong>Email:</strong> ${safeEmail}
          </p>

          <p>
            <strong>Phone:</strong> ${safePhone}
          </p>

          <p>
            <strong>Organisation:</strong> ${safeOrg}
          </p>

          <hr>

          <p><strong>Message:</strong></p>

          <div>${safeMsg}</div>

        </body>
      </html>
    `;

    const subject =
      `Solaris Reef Contact: ${inquiry.name} (${inquiry.organisation || 'Individual'})`;

    // Simulation mode when Resend credentials are unavailable.
    if (!resendApiKey) {
      console.info(
        `[EMAIL SIMULATION] Contact inquiry received from ` +
        `${inquiry.name} <${inquiry.email}>. ` +
        `Admin recipient: ${targetEmail}`
      );

      return {
        success: true,
        messageId: `sim_${Date.now()}`,
        simulated: true,
      };
    }

    const result = await sendViaResend(resendApiKey, {
      from: emailFrom,
      to: [targetEmail],
      reply_to: inquiry.email,
      subject,
      html,
    });

    if (!result.success) {
      console.error(
        '[EMAIL] Failed to deliver contact inquiry:',
        result.error
      );

      return {
        success: false,
        simulated: false,
        error: result.error,
      };
    }

    console.info(
      `[EMAIL] Contact inquiry submitted to Resend. ` +
      `Admin: ${targetEmail} | Message ID: ${result.messageId}`
    );

    return {
      success: true,
      messageId: result.messageId,
      simulated: false,
    };
  }
}

/**
 * Shared email service instance.
 */
export const emailService = new EmailService();
```
