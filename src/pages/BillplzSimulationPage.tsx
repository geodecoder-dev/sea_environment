import React, { useEffect, useState } from 'react';
import { ShieldCheck, CheckCircle2, XCircle, ArrowLeft, Building2, Lock } from 'lucide-react';

interface BillplzSimulationPageProps {
  onNavigate: (path: string) => void;
}

export const BillplzSimulationPage: React.FC<BillplzSimulationPageProps> = ({ onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [billData, setBillData] = useState<any>(null);
  const [selectedBank, setSelectedBank] = useState<string>('MBB0227');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Extract bill ID from pathname: /billplz-simulation/:billId
  const billId = window.location.pathname.split('/billplz-simulation/')[1]?.split('?')[0];

  useEffect(() => {
    if (!billId) {
      setErrorMessage('No Bill ID provided in simulation request.');
      setLoading(false);
      return;
    }

    fetch(`/api/billplz-simulation/${billId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Bill not found in simulation store');
        return res.json();
      })
      .then((data) => {
        setBillData(data);
        setLoading(false);
      })
      .catch((err) => {
        setErrorMessage(err.message);
        setLoading(false);
      });
  }, [billId]);

  const handleSimulateAction = async (action: 'pay_success' | 'cancel' | 'fail') => {
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/billplz-simulation/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billId,
          action,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Simulation processing failed');
      }

      // Redirect to the server-verified result page!
      onNavigate(data.redirectResultUrl);
    } catch (err: any) {
      setErrorMessage(err.message);
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6 bg-slate-50">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-[#247BA0]/20 border-t-[#247BA0] rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500 font-mono">Loading Billplz Sandbox Gateway...</p>
        </div>
      </div>
    );
  }

  if (errorMessage || !billData) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center bg-slate-50">
        <h2 className="font-serif text-2xl font-bold text-slate-900 mb-2">Simulation Bill Not Found</h2>
        <p className="text-xs text-slate-600 mb-6">{errorMessage || 'Invalid simulation bill session.'}</p>
        <button
          onClick={() => onNavigate('/')}
          className="px-5 py-2.5 bg-[#123047] text-white text-xs font-semibold rounded-lg"
        >
          Return to Hub
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 py-12 px-4 sm:px-6">
      <div className="max-w-xl mx-auto">
        
        {/* Sandbox Simulation Header Banner */}
        <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-900 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold uppercase tracking-wider text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded">
              Billplz Sandbox
            </span>
            <span>Developer Test Simulator Environment</span>
          </div>
          <span className="text-[11px] font-mono text-amber-800">MYR Checkout</span>
        </div>

        {/* Billplz-Branded Mock Checkout Container */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          
          {/* Billplz Top Bar */}
          <div className="bg-[#0055A5] text-white p-5 flex items-center justify-between">
            <div>
              <div className="font-bold text-lg tracking-tight">billplz</div>
              <div className="text-[11px] text-blue-100">Secure FPX Payment Portal</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-blue-100 uppercase tracking-wider">Amount Due</div>
              <div className="text-2xl font-bold font-mono">RM {billData.amountRm.toFixed(2)}</div>
            </div>
          </div>

          {/* Transaction Metadata */}
          <div className="p-6 border-b border-slate-100 bg-slate-50/70 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500">Payee:</span>
              <span className="font-semibold text-slate-800">Leo-Lion Club of KL Solaris</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Bill Description:</span>
              <span className="text-slate-800">Solaris Reef Coral Restoration — {billData.internalReference}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Payer Name:</span>
              <span className="text-slate-800">{billData.donorName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Payer Email:</span>
              <span className="text-slate-800">{billData.donorEmail}</span>
            </div>
          </div>

          {/* Payment Method / Bank Selector */}
          <div className="p-6 space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-3">
                Select Malaysian FPX Bank (Test Sandbox)
              </label>

              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { code: 'MBB0227', name: 'Maybank2u' },
                  { code: 'BCBB0235', name: 'CIMB Clicks' },
                  { code: 'PBB0233', name: 'Public Bank' },
                  { code: 'RHB0218', name: 'RHB Now' },
                  { code: 'HLB0224', name: 'Hong Leong Connect' },
                  { code: 'BIMB0340', name: 'Bank Islam' },
                ].map((bank) => (
                  <button
                    key={bank.code}
                    type="button"
                    onClick={() => setSelectedBank(bank.code)}
                    className={`p-3 rounded-xl border text-left text-xs font-medium flex items-center gap-2.5 transition-all cursor-pointer ${
                      selectedBank === bank.code
                        ? 'border-[#0055A5] bg-blue-50/60 text-[#0055A5] font-semibold'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <Building2 className="w-4 h-4 text-slate-400" />
                    <span>{bank.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Simulation Triggers */}
            <div className="pt-4 border-t border-slate-200 space-y-3">
              <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Simulate Payment Result:
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleSimulateAction('pay_success')}
                  className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simulate Successful FPX Payment</span>
                </button>

                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleSimulateAction('cancel')}
                  className="py-3 px-4 bg-slate-200 hover:bg-slate-300 active:scale-[0.98] text-slate-700 font-medium text-xs rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleSimulateAction('fail')}
                  className="py-3 px-4 bg-red-100 hover:bg-red-200 active:scale-[0.98] text-red-700 font-medium text-xs rounded-xl transition-all cursor-pointer"
                >
                  Fail Payment
                </button>
              </div>

              <div className="text-[11px] text-slate-500 text-center flex items-center justify-center gap-1.5 pt-1">
                <Lock className="w-3 h-3 text-emerald-600" />
                <span>Simulates full official Billplz callback with verified HMAC-SHA256 X-Signature.</span>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
