import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock, XCircle, AlertCircle, ArrowLeft, Printer, Share2, Waves, RefreshCw, Mail } from 'lucide-react';

interface DonationResultProps {
  onNavigate: (path: string) => void;
}

interface VerifiedDonation {
  internalReference: string;
  amountSen: number;
  amountRm: number;
  currency: string;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'cancelled';
  donorName: string;
  attributionPreference: string;
  paidAt?: string;
  createdAt: string;
  billplzBillId: string;
}

export const DonationResultPage: React.FC<DonationResultProps> = ({ onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [verifiedData, setVerifiedData] = useState<VerifiedDonation | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const [isSendingReceipt, setIsSendingReceipt] = useState(false);
  const [receiptSentMessage, setReceiptSentMessage] = useState<string | null>(null);

  // Read reference from URL search params
  const searchParams = new URLSearchParams(window.location.search);
  const reference = searchParams.get('ref') || searchParams.get('billplz[id]');

  const fetchStatus = async () => {
    if (!reference) {
      setErrorMessage('No payment reference specified.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/donations/verify/${encodeURIComponent(reference)}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Transaction reference not found on server.');
        }
        throw new Error('Server verification failed.');
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
  }, [reference]);

  // Polling for pending states (e.g. if webhook takes a couple of seconds to arrive)
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
        body: JSON.stringify({ reference: verifiedData.internalReference }),
      });
      const data = await res.json();
      if (res.ok) {
        setReceiptSentMessage(`Receipt dispatched to ${data.email || 'your registered email address'}.`);
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
          Verifying Payment with Billplz...
        </h2>
        <p className="text-xs text-[#123047]/60 mt-1">
          Querying official server records. Please do not close this window.
        </p>
      </div>
    );
  }

  // Error / Invalid Reference State
  if (errorMessage || !verifiedData) {
    return (
      <div className="min-h-[75vh] max-w-2xl mx-auto px-4 py-16 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-6">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h1 className="font-serif text-3xl font-bold text-[#123047] mb-3">
          Unable to Verify Transaction
        </h1>
        <p className="text-sm text-[#123047]/75 max-w-md mb-8">
          {errorMessage || 'The payment reference could not be verified by the server.'} If your funds were deducted, please contact our support team with your bank statement.
        </p>
        <button
          onClick={() => onNavigate('/')}
          className="px-6 py-3 bg-[#123047] hover:bg-[#247BA0] text-white font-medium text-sm rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Campaign Homepage</span>
        </button>
      </div>
    );
  }

  const status = verifiedData.paymentStatus;

  return (
    <div className="min-h-[85vh] py-16 px-4 sm:px-6 lg:px-8 bg-[#FFFDF7]">
      <div className="max-w-2xl mx-auto">
        
        {/* State 1: SUCCESSFUL PAYMENT */}
        {status === 'paid' && (
          <div className="bg-white rounded-3xl border border-[#123047]/15 shadow-xl overflow-hidden">
            {/* Header Ribbon */}
            <div className="bg-[#426B50] text-white p-8 text-center relative">
              <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-8 h-8 text-white" />
              </div>
              <h1 className="font-serif text-3xl font-bold tracking-tight">
                Thank You for Your Support!
              </h1>
              <p className="text-xs sm:text-sm text-[#B8E0D2] mt-1">
                Your contribution has been verified by the Billplz payment gateway.
              </p>
            </div>

            {/* Receipt Details Card */}
            <div className="p-6 sm:p-8 space-y-6">
              
              <div className="p-4 rounded-2xl bg-[#F4E9D8]/50 border border-[#123047]/10 flex items-center justify-between">
                <div>
                  <span className="text-xs uppercase tracking-wider text-[#123047]/60 block font-medium">
                    Total Amount Donated
                  </span>
                  <span className="font-serif text-3xl font-bold text-[#123047] tabular-nums">
                    RM {verifiedData.amountRm.toFixed(2)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold text-[#426B50] bg-[#E8F5F1] px-2.5 py-1 rounded-md">
                    Payment Verified
                  </span>
                  <div className="text-[11px] text-[#123047]/60 mt-1">
                    Billplz FPX / Card
                  </div>
                </div>
              </div>

              {/* Data Table */}
              <div className="space-y-3 text-xs sm:text-sm border-t border-b border-[#123047]/10 py-4">
                <div className="flex justify-between py-1">
                  <span className="text-[#123047]/65">Internal Reference</span>
                  <span className="font-mono font-medium text-[#123047] tabular-nums">
                    {verifiedData.internalReference}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#123047]/65">Billplz Transaction ID</span>
                  <span className="font-mono text-[#123047]/80">
                    {verifiedData.billplzBillId}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#123047]/65">Donor Attribution</span>
                  <span className="font-medium text-[#123047]">
                    {verifiedData.donorName}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#123047]/65">Transaction Date</span>
                  <span className="text-[#123047]">
                    {verifiedData.paidAt
                      ? new Date(verifiedData.paidAt).toLocaleString('en-MY', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })
                      : 'Just now'}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#123047]/65">Designation</span>
                  <span className="font-medium text-[#247BA0]">
                    Citizen Restoration Programme (CRP) — Coralku & Leo-Lion Solaris
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#123047]/65">Update Service</span>
                  <span className="font-medium text-[#426B50]">
                    {verifiedData.amountRm >= 100
                      ? '1-Year Regular Photogrammetric Updates Included'
                      : 'Single Coral Fragment Sponsorship'}
                  </span>
                </div>
              </div>

              {/* Conservation Certificate & Email Dispatch Note */}
              <div className="p-4 rounded-xl bg-[#E8F5F1] border border-[#B8E0D2] flex items-center gap-3">
                <Waves className="w-5 h-5 text-[#247BA0] shrink-0" />
                <p className="text-xs text-[#123047]/85 leading-relaxed">
                  Your official donation receipt has been dispatched to your email. Your support directly funds spring-steel Coral Clips, nursery spider frames, and scientific monitoring at Pantai Pasir Besar, Pulau Lang Tengah (Terengganu) in scientific partnership with Coralku.
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleResendReceipt}
                    disabled={isSendingReceipt}
                    className="px-4 py-2 text-xs font-semibold text-[#123047] bg-[#B8E0D2] hover:bg-[#A3D4C4] rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>{isSendingReceipt ? 'Sending...' : 'Email Receipt'}</span>
                  </button>
                  <button
                    onClick={handlePrint}
                    className="px-4 py-2 text-xs font-semibold text-[#123047] bg-[#F4E9D8] hover:bg-[#E8D9C2] rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Receipt</span>
                  </button>
                  <button
                    onClick={handleShare}
                    className="px-4 py-2 text-xs font-semibold text-[#123047] bg-[#F4E9D8] hover:bg-[#E8D9C2] rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share Hub</span>
                  </button>
                </div>

                <button
                  onClick={() => onNavigate('/')}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-[#123047] hover:bg-[#247BA0] rounded-xl transition-colors cursor-pointer"
                >
                  Back to Campaign Hub
                </button>
              </div>

              {receiptSentMessage && (
                <div className="p-3 bg-[#E8F5F1] border border-[#B8E0D2] rounded-xl text-xs text-[#123047] flex items-center justify-between">
                  <span>{receiptSentMessage}</span>
                  <button
                    onClick={() => setReceiptSentMessage(null)}
                    className="text-[#123047]/60 hover:text-[#123047] font-semibold text-xs ml-2 cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              )}

            </div>
          </div>
        )}

        {/* State 2: PENDING PAYMENT */}
        {status === 'pending' && (
          <div className="bg-white rounded-3xl border border-[#123047]/15 shadow-xl p-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
              <Clock className="w-8 h-8 animate-pulse" />
            </div>
            <div>
              <h1 className="font-serif text-3xl font-bold text-[#123047]">
                Payment Processing
              </h1>
              <p className="text-sm text-[#123047]/75 mt-2 max-w-md mx-auto">
                We are awaiting the verified callback from your bank or Billplz. This usually takes just a few seconds.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#F4E9D8]/50 max-w-sm mx-auto text-xs text-[#123047]/75 space-y-1">
              <div>Reference: <strong className="font-mono text-[#123047]">{verifiedData.internalReference}</strong></div>
              <div>Amount: <strong className="font-serif text-[#123047]">RM {verifiedData.amountRm.toFixed(2)}</strong></div>
            </div>

            <div className="flex items-center justify-center gap-4">
              <button
                onClick={fetchStatus}
                className="px-5 py-2.5 bg-[#247BA0] text-white text-xs font-semibold rounded-xl hover:bg-[#123047] transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Check Status Again</span>
              </button>
              <button
                onClick={() => onNavigate('/')}
                className="px-5 py-2.5 bg-[#F4E9D8] text-[#123047] text-xs font-semibold rounded-xl hover:bg-[#E8D9C2] transition-colors cursor-pointer"
              >
                Return to Campaign
              </button>
            </div>
          </div>
        )}

        {/* State 3: FAILED OR CANCELLED */}
        {(status === 'failed' || status === 'cancelled') && (
          <div className="bg-white rounded-3xl border border-[#123047]/15 shadow-xl p-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <XCircle className="w-8 h-8" />
            </div>
            <div>
              <h1 className="font-serif text-3xl font-bold text-[#123047]">
                {status === 'cancelled' ? 'Payment Cancelled' : 'Payment Unsuccessful'}
              </h1>
              <p className="text-sm text-[#123047]/75 mt-2 max-w-md mx-auto">
                {status === 'cancelled'
                  ? 'The transaction was cancelled before checkout completion.'
                  : 'Your payment was declined or timed out by the gateway. No funds were debited.'}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#F4E9D8]/50 max-w-sm mx-auto text-xs text-[#123047]/75 space-y-1">
              <div>Reference: <strong className="font-mono text-[#123047]">{verifiedData.internalReference}</strong></div>
              <div>Amount: <strong className="font-serif text-[#123047]">RM {verifiedData.amountRm.toFixed(2)}</strong></div>
            </div>

            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => onNavigate('/')}
                className="px-6 py-3 bg-[#FF7F6A] text-white text-xs font-semibold rounded-xl hover:bg-[#E66652] transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>Try Donating Again</span>
              </button>
              <button
                onClick={() => onNavigate('/')}
                className="px-5 py-3 bg-[#F4E9D8] text-[#123047] text-xs font-semibold rounded-xl hover:bg-[#E8D9C2] transition-colors cursor-pointer"
              >
                Back to Campaign
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
