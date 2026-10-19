export interface Milestone {
  id: string;
  title: string;
  targetSen: number;
  coralCount: number;
  description: string;
  achieved: boolean;
}

export interface CampaignData {
  id: string;
  title: string;
  slug: string;
  description: string;
  fundraisingTargetSen: number;
  fundraisingTargetRm: number;
  totalRaisedSen: number;
  totalRaisedRm: number;
  percentAchieved: number;
  successfulDonationsCount: number;
  coralPlantingTarget: number;
  verifiedCoralPlantingCount: number;
  volunteerCount: number;
  campaignStatus: 'active' | 'completed' | 'paused';
  location: string;
  milestones: Milestone[];
  createdAt: string;
  updatedAt: string;
}

export interface RecentPublicDonation {
  id: string;
  donorName: string;
  amountSen: number;
  amountRm: number;
  message?: string;
  paidAt: string;
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

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'cancelled';
export type AttributionPreference = 'public' | 'anonymous';

export interface DonationRecord {
  id: string;
  internalReference: string;
  campaignId: string;
  donorName: string;
  donorEmail: string;
  amountSen: number;
  currency: 'MYR';
  attributionPreference: AttributionPreference;
  message?: string;
  billplzBillId: string;
  billplzUrl?: string;
  paymentStatus: PaymentStatus;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'superadmin' | 'admin';
}

export interface AdminActivity {
  id: string;
  adminId: string;
  adminName: string;
  action: string;
  entityType: string;
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
