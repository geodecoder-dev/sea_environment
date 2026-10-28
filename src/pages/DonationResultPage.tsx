import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  ArrowLeft,
  Printer,
  Share2,
  RefreshCw,
  Mail,
  ShieldCheck,
  Gift,
  Heart,
} from 'lucide-react';

interface DonationResultProps {
  onNavigate: (path: string) => void;
}

interface VerifiedDonation {
  internalReference: string;
  verificationToken?: string;
  amountSen: number;
  amountRm: number;
  currency: string;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'cancelled';
  donorName: string;
  attributionPreference: string;
  referral?: string;
  coralName?: string;
  isGift?: boolean;
  recipientName?: string;
  paidAt?: string;
  createdAt: string;
  billplzBillId: string;
  entitlements?: {
    fragments: number;
    updatesEligible: boolean;
    updatesDurationMonths: number;
    title: string;
  };
}

export const DonationResultPage: React.FC<DonationResultProps> = ({ onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [verifiedData, setVerifiedData] = useState<VerifiedDonation | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const [isSendingReceipt, setIsSendingReceipt] = useState(false);
  const [receiptSentMessage, setReceiptSentMessage] = useState<string | null>(null);

  // Read reference or secure token from URL search params
  const searchParams = new URLSearchParams(window.location.search);
  const token = searchParams.get('token');
  const ref = searchParams.get('ref') || searchParams.get('billplz[id]') || searchParams.get('bill_id');

  const fetchStatus = async () => {
    if (!token && !ref) {
      setErrorMessage('No payment verification token or reference specified.');
      setLoading(false);
      return;
    }

    try {
      const query = window.location.search && window.location.search.length > 1
        ? window.location.search.slice(1)
        : (token ? `token=${encodeURIComponent(token)}` : `ref=${encodeURIComponent(ref!)}`);
      const res = await fetch(`/api/donations/lookup?${query}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Transaction record not found on the official server.');
        }
        throw new Error('Server verification encountered a temporary error.');
      }
      const data = await res.json();
      setVerifiedData(data);
      setErrorMessage(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to verify payment status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [token, ref]);

  // Polling for pending states (bounded up to 5 attempts spaced 3s apart)
  useEffect(() => {
    if (verifiedData?.paymentStatus === 'pending' && pollCount < 5) {
      const timer = setTimeout(() => {
        setPollCount((prev) => prev + 1);
        fetchStatus();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [verifiedData, pollCount]);

  const handlePrint = () => {
    window.print();
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'I supported Solaris Reef!',
        text: 'I just contributed to coral reef restoration in Malaysia with Leo-Lion Club of KL Solaris & Coralku. Join us in reviving our oceans!',
        url: window.location.origin,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.origin);
      alert('Campaign link copied to clipboard!');
    }
  };

  const handleResendReceipt = async () => {
    if (!verifiedData?.internalReference) return;
    setIsSendingReceipt(true);
    setReceiptSentMessage(null);
    try {
      const res = await fetch('/api/donations/send-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: verifiedData.verificationToken,
          reference: verifiedData.internalReference,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setReceiptSentMessage(data.message || 'Official receipt dispatched to your registered email.');
      } else {
        setReceiptSentMessage(data.error || 'Failed to dispatch email receipt.');
      }
    } catch {
      setReceiptSentMessage('Network error dispatching email receipt.');
    } finally {
      setIsSendingReceipt(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 bg-[#FFFDF7]">
        <div className="w-12 h-12 rounded-full border-3 border-[#247BA0]/20 border-t-[#247BA0] animate-spin mb-4" />
        <h2 className="font-serif text-xl font-bold text-[#123047]">
          Verifying Authoritative Payment Status...
        </h2>
        <p className="text-xs text-[#123047]/60 mt-1">
          Querying secure server records. Please do not close this window.
        </p>
      </div>
    );
  }

  // Error / Invalid Reference State
  if (errorMessage || !verifiedData) {
    return (
      <div className="min-h-[75vh] max-w-2xl mx-auto px-4 py-16 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-6 shadow-sm">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h1 className="font-serif text-3xl font-bold text-[#123047] mb-3">
          Unable to Verify Transaction
        </h1>
        <p className="text-sm text-[#123047]/75 max-w-md mb-8">
          {errorMessage || 'The payment reference could not be verified by the server.'} If your funds were deducted, please contact our support team with your bank statement.
        </p>
        <button
          onClick={() => onNavigate('home')}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#123047] text-white text-sm font-semibold hover:bg-[#247BA0] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Campaign Overview</span>
        </button>
      </div>
    );
  }

  const { paymentStatus } = verifiedData;
  const isPaid = paymentStatus === 'paid';
  const isPending = paymentStatus === 'pending';
  const isFailed = paymentStatus === 'failed';
  const isCancelled = paymentStatus === 'cancelled';

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-[#FFFDF7]">
      <div className="max-w-2xl mx-auto">
        
        {/* Navigation Back */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => onNavigate('home')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#123047]/70 hover:text-[#123047] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Campaign Overview</span>
          </button>
          
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#B8E0D2]/40 text-[#123047]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#247BA0]" />
              <span>Verified Server Record</span>
            </span>
          </div>
        </div>

        {/* Main Status Card */}
        <div className="bg-white rounded-3xl border border-[#123047]/15 shadow-xl overflow-hidden print:border-none print:shadow-none">
          
          {/* Card Header Banner */}
          <div className={`p-8 sm:p-10 text-center ${
            isPaid
              ? 'bg-[#123047] text-white'
              : isPending
              ? 'bg-amber-500 text-white'
              : isCancelled
              ? 'bg-slate-700 text-white'
              : 'bg-red-600 text-white'
          }`}>
            <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4 bg-white/10 backdrop-blur-xs">
              {isPaid && <CheckCircle2 className="w-10 h-10 text-[#B8E0D2]" />}
              {isPending && <Clock className="w-10 h-10 text-white animate-pulse" />}
              {isFailed && <XCircle className="w-10 h-10 text-white" />}
              {isCancelled && <AlertCircle className="w-10 h-10 text-white" />}
            </div>

            <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight mb-2">
              {isPaid && 'Thank You for Your Conservation Support!'}
              {isPending && 'Payment Verification Pending'}
              {isFailed && 'Payment Could Not Be Processed'}
              {isCancelled && 'Transaction Cancelled'}
            </h1>

            <p className="text-sm max-w-lg mx-auto opacity-90 leading-relaxed">
              {isPaid &&
                'Your payment has been verified and recorded on the live conservation ledger. Your contribution directly sponsors scientific micro-fragment outplanting at Pulau Lang Tengah.'}
              {isPending &&
                'We are awaiting confirmation from the payment gateway. If you completed payment via FPX or card, this page will update automatically.'}
              {isFailed &&
                'The payment gateway reported that this transaction was not completed. No funds have been accepted for this attempt.'}
              {isCancelled &&
                'You cancelled this transaction before payment authorization was finalized.'}
            </p>
          </div>

          {/* Pending Polling Alert */}
          {isPending && (
            <div className="bg-amber-50 border-b border-amber-200 px-6 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-xs text-amber-900">
                <RefreshCw className="w-4 h-4 text-amber-700 animate-spin shrink-0" />
                <span>Checking gateway confirmation (Attempt {pollCount + 1} of 5)...</span>
              </div>
              <button
                onClick={fetchStatus}
                className="px-3 py-1 rounded-lg bg-amber-200 text-amber-900 text-xs font-semibold hover:bg-amber-300 transition-colors"
              >
                Refresh Now
              </button>
            </div>
          )}

          {/* Details Section */}
          <div className="p-6 sm:p-8 space-y-6">
            
            {/* Amount Banner */}
            <div className="p-5 rounded-2xl bg-[#FFFDF7] border border-[#123047]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs uppercase font-semibold tracking-wider text-[#123047]/60 block mb-0.5">
                  Sponsorship Amount
                </span>
                <span className="font-serif text-3xl font-bold text-[#123047]">
                  RM {verifiedData.amountRm.toFixed(2)}
                </span>
                <span className="text-xs text-[#123047]/50 ml-2">MYR</span>
              </div>

              <div className="sm:text-right">
                <span className="text-xs uppercase font-semibold tracking-wider text-[#123047]/60 block mb-0.5">
                  Official Reference
                </span>
                <span className="font-mono text-sm font-bold text-[#247BA0]">
                  {verifiedData.internalReference}
                </span>
              </div>
            </div>

            {/* Impact & Entitlements Box */}
            {verifiedData.entitlements && (
              <div className="p-5 rounded-2xl bg-[#B8E0D2]/25 border border-[#B8E0D2]/50">
                <div className="flex items-center gap-2 mb-2">
                  <Heart className="w-4 h-4 text-[#247BA0]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-[#123047]">
                    Sponsorship Entitlement: {verifiedData.entitlements.title}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[#123047]">
                  <div>
                    <span className="text-[#123047]/65">Coral Fragments Outplanted:</span>{' '}
                    <strong className="font-semibold">{verifiedData.entitlements.fragments} fragment{verifiedData.entitlements.fragments > 1 ? 's' : ''}</strong>
                  </div>
                  <div>
                    <span className="text-[#123047]/65">12-Month Monitoring Updates:</span>{' '}
                    <strong className="font-semibold">
                      {verifiedData.entitlements.updatesEligible ? 'Active (Quarterly Photo Reports)' : 'Standard Monitoring Only'}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            {/* Gift Dedication Banner */}
            {verifiedData.isGift && verifiedData.recipientName && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-3 text-xs text-amber-900">
                <Gift className="w-5 h-5 text-amber-700 shrink-0" />
                <div>
                  <strong>Coral Gift Dedication:</strong> This coral adoption has been dedicated to{' '}
                  <span className="font-bold underline">{verifiedData.recipientName}</span>.
                </div>
              </div>
            )}

            {/* Coral Name */}
            {verifiedData.coralName && (
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-center justify-between">
                <span>Adopted Coral Name:</span>
                <strong className="font-serif text-sm">"{verifiedData.coralName}"</strong>
              </div>
            )}

            {/* Metadata Table */}
            <div className="divide-y divide-[#123047]/10 text-xs">
              <div className="py-2.5 flex justify-between">
                <span className="text-[#123047]/60">Donor Name:</span>
                <span className="font-medium text-[#123047]">{verifiedData.donorName}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-[#123047]/60">Attribution:</span>
                <span className="font-medium capitalize text-[#123047]">
                  {verifiedData.attributionPreference}
                </span>
              </div>
              {verifiedData.referral && (
                <div className="py-2.5 flex justify-between">
                  <span className="text-[#123047]/60">Referral Attribution:</span>
                  <span className="font-mono font-medium text-[#247BA0]">
                    {verifiedData.referral}
                  </span>
                </div>
              )}
              <div className="py-2.5 flex justify-between">
                <span className="text-[#123047]/60">Transaction Date:</span>
                <span className="font-medium text-[#123047]">
                  {new Date(verifiedData.paidAt || verifiedData.createdAt).toLocaleDateString('en-MY', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-[#123047]/60">Payment Gateway ID:</span>
                <span className="font-mono text-slate-500">{verifiedData.billplzBillId}</span>
              </div>
            </div>

            {/* Receipt Resend Notification */}
            {receiptSentMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{receiptSentMessage}</span>
              </div>
            )}

            {/* Actions for Paid State */}
            {isPaid && (
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-3 print:hidden">
                <button
                  onClick={handleResendReceipt}
                  disabled={isSendingReceipt}
                  className="w-full sm:flex-1 py-3 px-4 rounded-xl border border-[#123047]/20 text-xs font-semibold text-[#123047] hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Mail className="w-4 h-4 text-[#247BA0]" />
                  <span>{isSendingReceipt ? 'Dispatching Receipt...' : 'Resend Email Receipt'}</span>
                </button>

                <button
                  onClick={handlePrint}
                  className="w-full sm:w-auto py-3 px-4 rounded-xl border border-[#123047]/20 text-xs font-semibold text-[#123047] hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-slate-600" />
                  <span>Print Receipt</span>
                </button>

                <button
                  onClick={handleShare}
                  className="w-full sm:w-auto py-3 px-4 rounded-xl bg-[#247BA0] text-white text-xs font-semibold hover:bg-[#123047] transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share</span>
                </button>
              </div>
            )}

            {/* Action for Non-Paid States */}
            {!isPaid && (
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-3 print:hidden">
                <button
                  onClick={() => onNavigate('home')}
                  className="w-full py-3 px-4 rounded-xl bg-[#123047] text-white text-xs font-semibold hover:bg-[#247BA0] transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Return & Try Again</span>
                </button>
              </div>
            )}

          </div>

          {/* Footer note */}
          <div className="bg-[#FAF7F0] p-4 text-center text-[11px] text-[#123047]/60 border-t border-[#123047]/10">
            Official Citizen Restoration Programme Receipt · Leo-Lion Club of KL Solaris & Coralku Scientific Initiative
          </div>

        </div>

      </div>
    </div>
  );
};
