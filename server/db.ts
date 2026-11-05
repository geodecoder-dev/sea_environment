    d1?: D1DatabaseBinding
  ) {
    const id = `act-${generateRandomHex(4)}`;
    const timestamp = new Date().toISOString();
    const entry: AdminActivity = {
      ...activity,
      id,
      timestamp,
    };

    if (d1) {
      try {
        await d1
          .prepare(
            `INSERT INTO admin_activities (id, admin_id, admin_name, action, entity_type, entity_reference, details, timestamp)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            id,
            entry.adminId,
            entry.adminName,
            entry.action,
            entry.entityType,
            entry.entityReference || null,
            entry.details,
            timestamp
          )
          .run();
      } catch (err) {
        console.error('[DB] D1 logActivity error:', err);
      }
    }

    this.memData.activities.unshift(entry);
    if (this.memData.activities.length > 200) {
      this.memData.activities = this.memData.activities.slice(0, 200);
    }
  }

  public async getActivities(limit: number = 50, d1?: D1DatabaseBinding): Promise<AdminActivity[]> {
    if (d1) {
      try {
        const res = await d1
          .prepare('SELECT * FROM admin_activities ORDER BY timestamp DESC LIMIT ?')
          .bind(limit)
          .all<any>();

        if (res?.results && Array.isArray(res.results)) {
          return res.results.map((r) => ({
            id: r.id,
            adminId: r.admin_id,
            adminName: r.admin_name,
            action: r.action,
            entityType: r.entity_type,
            entityReference: r.entity_reference,
            details: r.details,
            timestamp: r.timestamp,
          }));
        }
      } catch (err) {
        console.error('[DB] D1 getActivities error:', err);
        throw new DatabaseError('Failed to fetch admin activities', err);
      }
    }

    return this.memData.activities.slice(0, limit);
  }

  public async logWebhook(
    entry: Omit<WebhookLog, 'id' | 'timestamp'>,
    d1?: D1DatabaseBinding
  ) {
    const id = `whk-${generateRandomHex(4)}`;
    const timestamp = new Date().toISOString();
    const log: WebhookLog = {
      ...entry,
      id,
      timestamp,
    };

    if (d1) {
      try {
        await d1
          .prepare(
            `INSERT INTO webhook_logs (id, bill_id, internal_ref, status, signature_verified, payload_summary, timestamp)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            id,
            log.billId,
            log.internalRef,
            log.status,
            log.signatureVerified ? 1 : 0,
            log.payloadSummary,
            timestamp
          )
          .run();
      } catch (err) {
        console.error('[DB] D1 logWebhook error:', err);
      }
    }

    this.memData.webhookLogs.unshift(log);
    if (this.memData.webhookLogs.length > 100) {
      this.memData.webhookLogs = this.memData.webhookLogs.slice(0, 100);
    }
  }

  public async getWebhookLogs(limit: number = 20, d1?: D1DatabaseBinding): Promise<WebhookLog[]> {
    if (d1) {
      try {
        const res = await d1
          .prepare('SELECT * FROM webhook_logs ORDER BY timestamp DESC LIMIT ?')
          .bind(limit)
          .all<any>();

        if (res?.results && Array.isArray(res.results)) {
          return res.results.map((r) => ({
            id: r.id,
            billId: r.bill_id,
            internalRef: r.internal_ref,
            status: r.status,
            signatureVerified: Boolean(r.signature_verified),
            payloadSummary: r.payload_summary,
            timestamp: r.timestamp,
          }));
        }
      } catch (err) {
        console.error('[DB] D1 getWebhookLogs error:', err);
        throw new DatabaseError('Failed to fetch webhook logs', err);
      }
    }

    return this.memData.webhookLogs.slice(0, limit);
  }

  private mapDonationRow(row: any): Donation {
    return {
      id: row.id,
      internalReference: row.internal_reference,
      verificationToken: row.verification_token || '',
      campaignId: row.campaign_id,
      donorName: row.donor_name,
      donorEmail: row.donor_email,
      amountSen: Number(row.amount_sen),
      currency: row.currency,
      attributionPreference: row.attribution_preference,
      message: row.message || '',
      referral: row.referral || '',
      coralName: row.coral_name || undefined,
      isGift: Boolean(row.is_gift),
      recipientName: row.recipient_name || undefined,
      recipientEmail: row.recipient_email || undefined,
      billplzBillId: row.billplz_bill_id,
      billplzUrl: row.billplz_url,
      paymentStatus: row.payment_status,
      paidAt: row.paid_at,
      callbackReceivedAt: row.callback_received_at,
      receiptSentAt: row.receipt_sent_at,
      receiptCount: Number(row.receipt_count || 0),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const db = new Database();
