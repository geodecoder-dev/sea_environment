
/**
 * Email Service for Solaris Reef Citizen Restoration Programme
 *
 * Email responsibilities:
 *
 * 1. Donation thank-you emails:
 *    - Sent to donors after successful Billplz payment confirmation.
 *    - NOT an official payment receipt.
 *    - Billplz remains responsible for payment receipts.
 *
 * 2. Contact inquiry notifications:
 *    - Sent to the Solaris Reef administrator.
 *    - Includes visitor contact information and message.
 *    - Reply-To points to the original visitor.
 *
 * Integrates with Resend API.
 *
 * Email failures must never affect payment confirmation state.
 */

import { siteConfig } from '../src/config/site.js';

import {
  ReceiptPayload,
  generateReceiptEmailHtml,
  escapeHtml,
} from './services/receipts.js';

// Retain existing exports for compatibility with other modules.
export { escapeHtml, generateReceiptEmailHtml };
export type { ReceiptPayload };


/* ============================================================
   TYPES
============================================================ */

export interface ContactInquiryEmailData {
  name: string;
  email: string;
  phone?: string;
  organisation?: string;
  message: string;
}

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

interface ResendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}


/* ============================================================
   ENVIRONMENT CONFIGURATION
============================================================ */

/**
 * Retrieve environment variables.
 *
 * Supports:
 * - Cloudflare Workers environment bindings.
 * - Node.js process.env.
 */
function getEnvironmentValue(
  key: keyof EmailEnvironment,
  env?: EmailEnvironment
): string {

  const bindingValue = env?.[key];

  if (bindingValue) {
    return bindingValue;
  }

  if (
    typeof process !== 'undefined' &&
    process.env?.[key]
  ) {
    return process.env[key] || '';
  }

  return '';
}


/**
 * Retrieve Resend API key.
 */
function getResendApiKey(
  env?: EmailEnvironment
): string {

  const key = getEnvironmentValue('RESEND_API_KEY', env);

  if (
    !key ||
    key === 'your_resend_api_key_here'
  ) {
    return '';
  }

  return key;
}


/**
 * Default sender address.
 *
 * Configure EMAIL_FROM in Cloudflare.
 */
function getSenderAddress(
  env?: EmailEnvironment
): string {

  return (
    getEnvironmentValue('EMAIL_FROM', env) ||
    'Solaris Reef <hello@llcsolariskl.com>'
  );
}


/* ============================================================
   RESEND API
============================================================ */

/**
 * Centralised Resend email dispatcher.
 *
 * Validates HTTP responses and Resend message IDs.
 */
async function sendViaResend(
  apiKey: string,
  payload: Record<string, unknown>
): Promise<ResendResult> {

  try {

    const response = await fetch(
      'https://api.resend.com/emails',
      {
        method: 'POST',

        headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },

        body: JSON.stringify(payload),
      }
    );

    const responseText = await response.text();

    // Detect Resend API errors.
    if (!response.ok) {

      console.error(
        `[EMAIL] Resend API error (${response.status}):`,
        responseText
      );

      return {
        success: false,
        error: `Resend API returned HTTP ${response.status}: ${responseText}`,
      };
    }

    // Parse successful response.
    let result: { id?: string };

    try {

      result = JSON.parse(responseText);

    } catch {

      console.error(
        '[EMAIL] Invalid JSON response from Resend.'
      );

      return {
        success: false,
        error: 'Invalid response received from Resend.',
      };
    }

    if (!result.id) {

      console.error(
        '[EMAIL] Resend response did not contain a message ID.'
      );

      return {
        success: false,
        error: 'Resend did not return an email message ID.',
      };
    }

    return {
      success: true,
      messageId: result.id,
    };

  } catch (err: unknown) {

    const errorMessage =
      err instanceof Error
        ? err.message
        : String(err);

    console.error(
      '[EMAIL] Network error:',
      errorMessage
    );

    return {
      success: false,
      error: errorMessage,
    };
  }
}


/* ============================================================
   EMAIL SERVICE
============================================================ */

export class EmailService {

  /**
   * Sends a personalised donation thank-you email.
   *
   * IMPORTANT:
   * This is NOT an official payment receipt.
   *
   * Billplz handles payment receipts separately.
   *
   * Recipient:
   * data.donorEmail
   *
   * Trigger:
   * Only after successful Billplz payment confirmation.
   */
  public async sendDonationThankYou(
    data: ReceiptPayload,
    env?: EmailEnvironment
  ): Promise<EmailResult> {

    const resendApiKey = getResendApiKey(env);

    const emailFrom = getSenderAddress(env);

    // Escape user-controlled values.
    const safeReference = escapeHtml(
      String(data.internalReference)
    );

    const safeAmount = escapeHtml(
      data.amountRm.toFixed(2)
    );

    const html = `
      <!DOCTYPE html>
      <html lang="en">

        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Thank You for Supporting Solaris Reef</title>
        </head>

        <body style="
          margin: 0;
          padding: 24px;
          background-color: #f4f7f6;
          font-family: Arial, Helvetica, sans-serif;
          color: #263238;
        ">

          <div style="
            max-width: 600px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 12px;
            overflow: hidden;
          ">

            <div style="
              background: #073b3a;
              padding: 32px 24px;
              text-align: center;
              color: #ffffff;
            ">

              <h1 style="
                margin: 0;
                font-size: 26px;
              ">
                Thank You for Supporting Solaris Reef!
              </h1>

              <p style="
                margin: 12px 0 0;
                color: #d0e9e3;
                font-size: 15px;
              ">
                Every contribution helps restore our marine ecosystems.
              </p>

            </div>

            <div style="
              padding: 32px 28px;
              line-height: 1.7;
            ">

              <p>Hello,</p>

              <p>
                Thank you for contributing to the
                <strong>Solaris Reef Citizen Restoration Programme</strong>.
              </p>

              <p>
                Your support helps make coral restoration possible
                through hands-on conservation activities and
                long-term marine ecosystem rehabilitation.
              </p>

              <h3 style="color: #087f72;">
                Your Contribution
              </h3>

              <div style="
                background: #f0f7f5;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
              ">

                <p style="margin: 5px 0;">
                  <strong>Contribution Amount:</strong>
                  RM ${safeAmount}
                </p>

                <p style="margin: 5px 0;">
                  <strong>Donation Reference:</strong>
                  ${safeReference}
                </p>

              </div>

              <h3 style="color: #087f72;">
                Where Your Support Goes
              </h3>

              <p>
                Every ringgit makes a tangible difference,
                directly supporting Coralku's coral restoration
                initiatives, including:
              </p>

              <ul>
                <li>
                  Construction and maintenance of physical
                  coral nursery spider frames.
                </li>

                <li>
                  Coral collection and preparation for restoration.
                </li>

                <li>
                  Shoreline coral planting setups.
                </li>

                <li>
                  Equipment, resources and ongoing marine
                  conservation activities.
                </li>
              </ul>

              <p>
                Your contribution helps support the people,
                equipment and conservation efforts needed to
                restore and protect our marine ecosystems.
              </p>

              <p>
                We sincerely appreciate your support in making
                coral restoration a collective effort.
              </p>

              <p>
                Thank you for being part of the restoration journey.
              </p>

              <p style="margin-top: 28px;">
                Regards,<br>
                <strong>Solaris Reef Campaign Team</strong>
              </p>

            </div>

            <div style="
              background: #f4f7f6;
              padding: 20px;
              text-align: center;
              font-size: 12px;
              color: #64748b;
            ">

              <p>
                Solaris Reef Citizen Restoration Programme
              </p>

              <p>
                This email acknowledges your contribution.
                Your official payment receipt is provided separately
                by Billplz.
              </p>

            </div>

          </div>

        </body>
      </html>
    `;

    // Simulation mode if Resend is not configured.
    if (!resendApiKey) {

      console.info(
        `[EMAIL SIMULATION] Donation thank-you email generated for ` +
        `${data.donorEmail} | Reference: ${data.internalReference} | ` +
        `Amount: RM ${data.amountRm.toFixed(2)}`
      );

      return {
        success: true,
        messageId: `sim_${Date.now()}`,
        simulated: true,
      };
    }

    // Send thank-you email to donor.
    const result = await sendViaResend(
      resendApiKey,
      {
        from: emailFrom,
        to: [data.donorEmail],

        subject:
          'Thank You for Supporting Solaris Reef Coral Restoration!',

        html,
      }
    );

    if (!result.success) {

      console.error(
        '[EMAIL] Failed to send donor thank-you email:',
        result.error
      );

      return {
        success: false,
        simulated: false,
        error: result.error,
      };
    }

    console.info(
      `[EMAIL] Donor thank-you email submitted to Resend. ` +
      `Recipient: ${data.donorEmail} | ` +
      `Message ID: ${result.messageId}`
    );

    return {
      success: true,
      messageId: result.messageId,
      simulated: false,
    };
  }


  /**
   * Sends contact form inquiries to the administrator.
   *
   * Recipient:
   * INQUIRY_EMAIL environment variable.
   *
   * Fallback:
   * siteConfig.contact.email
   *
   * Reply-To:
   * Original visitor email.
   */
  public async sendContactInquiry(
    inquiry: ContactInquiryEmailData,
    env?: EmailEnvironment
  ): Promise<EmailResult> {

    const resendApiKey = getResendApiKey(env);

    const targetEmail =
      getEnvironmentValue('INQUIRY_EMAIL', env) ||
      siteConfig.contact.email;

    const emailFrom = getSenderAddress(env);

    // Escape all user-submitted content.
    const safeName = escapeHtml(inquiry.name);

    const safeEmail = escapeHtml(inquiry.email);

    const safePhone = escapeHtml(
      inquiry.phone || 'Not provided'
    );

    const safeOrg = escapeHtml(
      inquiry.organisation || 'Individual'
    );

    const safeMsg = escapeHtml(
      inquiry.message
    ).replace(/\r\n|\r|\n/g, '<br>');


    const html = `
      <!DOCTYPE html>
      <html lang="en">

        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Solaris Reef Inquiry</title>
        </head>

        <body style="
          margin: 0;
          padding: 24px;
          background-color: #f4f7f6;
          font-family: Arial, Helvetica, sans-serif;
          color: #263238;
        ">

          <div style="
            max-width: 600px;
            margin: 0 auto;
            background: #ffffff;
            padding: 28px;
            border-radius: 12px;
          ">

            <h2 style="color: #073b3a;">
              New Solaris Reef Inquiry
            </h2>

            <p>
              A visitor has submitted a new inquiry through
              the Solaris Reef website.
            </p>

            <hr>

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

            <h3>Message</h3>

            <div style="
              background: #f4f7f6;
              padding: 18px;
              border-radius: 8px;
              line-height: 1.7;
            ">
              ${safeMsg}
            </div>

            <p style="
              margin-top: 24px;
              font-size: 13px;
              color: #64748b;
            ">
              You can reply directly to this email to respond
              to the original inquiry.
            </p>

          </div>

        </body>
      </html>
    `;


    // Simulation mode if Resend is not configured.
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


    // Send notification to administrator.
    const result = await sendViaResend(
      resendApiKey,
      {
        from: emailFrom,

        to: [targetEmail],

        reply_to: inquiry.email,

        subject:
          `Solaris Reef Contact Inquiry: ${inquiry.name}`,

        html,
      }
    );


    if (!result.success) {

      console.error(
        '[EMAIL] Failed to send contact inquiry:',
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
      `Admin: ${targetEmail} | ` +
      `Message ID: ${result.messageId}`
    );

    return {
      success: true,
      messageId: result.messageId,
      simulated: false,
    };
  }

}


/* ============================================================
   SHARED EMAIL SERVICE INSTANCE
============================================================ */

export const emailService = new EmailService();

