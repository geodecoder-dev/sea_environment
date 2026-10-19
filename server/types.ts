export interface Campaign {
  id: string;
  title: string;
  slug: string;
  description: string;
  fundraisingTargetSen: number; // in sen (e.g. RM 50,000 = 5,000,000 sen)
  coralPlantingTarget: number;  // fragments (e.g. 1500)
  verifiedCoralPlantingCount: number; // verified planted (e.g. 640)
  volunteerCount: number;       // active volunteers
  campaignStatus: 'active' | 'completed' | 'paused';
  location: string;
  milestones: Array<{
    id: string;
    title: string;
    targetSen: number;
    coralCount: number;
    description: string;
    achieved: boolean;
  }>;
  createdAt: string;
  updatedAt: string;
}

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'cancelled';
export type AttributionPreference = 'public' | 'anonymous';

export interface Donation {
  id: string;
  internalReference: string; // e.g. SOL-202610-4A9B
  campaignId: string;
  donorName: string;
  donorEmail: string;
  amountSen: number;         // in sen
  currency: 'MYR';
  attributionPreference: AttributionPreference;
  message?: string;
  billplzBillId: string;
  billplzUrl?: string;
  paymentStatus: PaymentStatus;
  paidAt?: string;
  callbackReceivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignUpdate {
  id: string;
  title: string;
  slug: string;
  description: string;
  imageUrl?: string;
  category: 'milestone' | 'volunteer' | 'biodiversity' | 'community';
  publicationStatus: 'published' | 'draft' | 'archived';
  publicationDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  salt: string;
  role: 'superadmin' | 'admin';
  createdAt: string;
  updatedAt: string;
}

export interface AdminActivity {
  id: string;
  adminId: string;
  adminName: string;
  action: string;
  entityType: 'campaign' | 'donation' | 'update' | 'payment_test' | 'auth';
  entityReference?: string;
  details: string;
  timestamp: string;
}

export interface WebhookLog {
  id: string;
  billId: string;
  internalRef: string;
  status: 'valid' | 'invalid_signature' | 'duplicate_ignored' | 'error';
  signatureVerified: boolean;
  payloadSummary: string;
  timestamp: string;
}

export interface DatabaseSchema {
  campaign: Campaign;
  donations: Donation[];
  updates: CampaignUpdate[];
  admins: AdminUser[];
  activities: AdminActivity[];
  webhookLogs: WebhookLog[];
}
