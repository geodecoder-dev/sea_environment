import React, { useState } from 'react';
import { ShieldCheck, Heart, ArrowRight, Lock, Check } from 'lucide-react';
import { RecentPublicDonation } from '../types';

interface DonationSectionProps {
  recentDonations: RecentPublicDonation[];
  onSuccessfulInitiation?: (checkoutUrl: string) => void;
}

const PRESET_AMOUNTS = [

  { rm: 50, label: 'RM 50', fragments: '1 fragment', impact: 'Funds 1 fragment plus benthic health monitoring.' },
  { rm: 100, label: 'RM100', fragments: '1 fragment + Updates', impact: 'Funds 1 fragment plus monthly updates for 12 months.'},
  { rm: 500, label: 'RM 500', fragments: '10 fragments', impact: 'Adopt a full spider-frame (10 fragments) tagged by our divers and monthly updates for 12 months.' },
];

export const DonationSection: React.FC<DonationSectionProps> = ({
  recentDonations,
  onSuccessfulInitiation,
}) => {
  const [selectedRm, setSelectedRm] = useState<number>(50);
  const [customRm, setCustomRm] = useState<string>('');
  const [donorName, setDonorName] = useState<string>('');
  const [donorEmail, setDonorEmail] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [attribution, setAttribution] = useState<'public' | 'anonymous'>('public');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const effectiveAmountRm = customRm ? parseFloat(customRm) || 0 : selectedRm;
  const effectiveAmountSen = Math.round(effectiveAmountRm * 100);

  const handleSelectPreset = (rm: number) => {
    setSelectedRm(rm);
    setCustomRm('');
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    setCustomRm(val);
  };

  const getImpactDescription = (rm: number) => {
  
    if (rm <= 50) return 'Cultivates 1 fragment with photogrammetric survival monitoring.';
    if (rm <= 100) return 'Cultivates 1 fragment with photogrammetric survival monitoring and monthly updates for 12 months.';
    if (rm <= 500) return 'Adopts 10 coral fragments onto an anchor frame and monthly updates for 12 months.';
    const frags = Math.floor(rm / 8);
    return `Powers an estimated ${frags} coral fragments and community diver missions!`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (effectiveAmountRm < 5) {
      setErrorMessage('Minimum contribution is RM 5.00.');
      return;
    }

    if (!donorEmail || !donorEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address to receive your payment receipt and regular updates.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/donations/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountSen: effectiveAmountSen,
          donorName: donorName.trim() || 'Reef Supporter',
          donorEmail: donorEmail.trim(),
          attributionPreference: attribution,
          message: message.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Payment gateway failed to initialize.');
      }

      if (data.checkoutUrl) {
        if (onSuccessfulInitiation) {
          onSuccessfulInitiation(data.checkoutUrl);
        } else {
          window.location.href = data.checkoutUrl;
        }
      } else {
        throw new Error('No checkout URL received from gateway.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section id="donate" className="py-20 bg-[#F4E9D8]/35 border-t border-[#123047]/10 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="text-xs uppercase tracking-widest font-semibold text-[#FF7F6A] mb-2">
            Make A Direct Impact
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#123047]">
            Support Solaris Reef Today
          </h2>
          <p className="mt-3 text-base text-[#123047]/75">
            100% of donations are channelled into underwater nursery structures, fragment propagation, and scientific dive expeditions.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          
          {/* Main Donation Form (7 cols) */}
          <div className="lg:col-span-7 bg-[#FFFDF7] p-6 sm:p-10 rounded-3xl border border-[#123047]/15 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Step 1: Select Amount */}
              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-[#123047]/80 mb-3">
                  1. Choose Donation Amount (MYR)
                </label>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {PRESET_AMOUNTS.map((preset) => {
                    const isSelected = !customRm && selectedRm === preset.rm;
                    return (
                      <button
                        key={preset.rm}
                        type="button"
                        onClick={() => handleSelectPreset(preset.rm)}
                        className={`py-3.5 px-3 rounded-xl border text-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#123047] text-white border-[#123047] shadow-sm'
                            : 'bg-white text-[#123047] border-[#123047]/15 hover:border-[#247BA0]'
                        }`}
                      >
                        <div className="font-serif font-bold text-lg leading-none">
                          {preset.label}
                        </div>
                        <div className={`text-[11px] mt-1 ${isSelected ? 'text-[#B8E0D2]' : 'text-[#123047]/60'}`}>
                          {preset.fragments}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Amount */}
                <div className="mt-3">
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#123047]/60">
                      RM
                    </span>
                    <input
                      type="text"
                      placeholder="Or enter a custom amount (e.g. 150)"
                      value={customRm}
                      onChange={handleCustomChange}
                      className="w-full pl-12 pr-4 py-3 rounded-xl border border-[#123047]/15 bg-white text-[#123047] text-sm focus:outline-none focus:ring-2 focus:ring-[#247BA0] focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Selected Amount Impact Box */}
                <div className="mt-4 p-4 rounded-xl bg-[#E8F5F1] border border-[#B8E0D2] flex items-start gap-3">
                  <div className="p-1 rounded-full bg-[#426B50] text-white mt-0.5">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[#426B50] uppercase tracking-wide">
                      Your Impact (RM {effectiveAmountRm || 0})
                    </div>
                    <div className="text-xs sm:text-sm text-[#123047]/85 mt-0.5">
                      {getImpactDescription(effectiveAmountRm)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2: Donor Details */}
              <div className="pt-2 border-t border-[#123047]/10">
                <label className="block text-xs uppercase tracking-wider font-semibold text-[#123047]/80 mb-3">
                  2. Donor Information
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-[#123047]/70 mb-1 font-medium">
                      Your Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Alex Tan"
                      value={donorName}
                      onChange={(e) => setDonorName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-[#123047]/15 bg-white text-sm text-[#123047] focus:outline-none focus:ring-2 focus:ring-[#247BA0]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-[#123047]/70 mb-1 font-medium">
                      Email Address <span className="text-[#FF7F6A]">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. alex@example.com"
                      value={donorEmail}
                      onChange={(e) => setDonorEmail(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-[#123047]/15 bg-white text-sm text-[#123047] focus:outline-none focus:ring-2 focus:ring-[#247BA0]"
                    />
                  </div>
                </div>

                {/* Optional Message */}
                <div className="mt-3">
                  <label className="block text-xs text-[#123047]/70 mb-1 font-medium">
                    Encouraging Note for Our Divers (Optional)
                  </label>
                  <input
                    type="text"
                    maxLength={150}
                    placeholder="e.g. Keep up the wonderful work restoring our oceans!"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-[#123047]/15 bg-white text-sm text-[#123047] focus:outline-none focus:ring-2 focus:ring-[#247BA0]"
                  />
                </div>

                {/* Attribution Preference */}
                <div className="mt-4 flex items-center gap-6">
                  <label className="flex items-center gap-2 text-xs font-medium text-[#123047] cursor-pointer">
                    <input
                      type="radio"
                      name="attribution"
                      checked={attribution === 'public'}
                      onChange={() => setAttribution('public')}
                      className="text-[#247BA0] focus:ring-[#247BA0]"
                    />
                    <span>Display my name on public donor wall</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-medium text-[#123047] cursor-pointer">
                    <input
                      type="radio"
                      name="attribution"
                      checked={attribution === 'anonymous'}
                      onChange={() => setAttribution('anonymous')}
                      className="text-[#247BA0] focus:ring-[#247BA0]"
                    />
                    <span>Donate anonymously</span>
                  </label>
                </div>
              </div>

              {/* Error Display */}
              {errorMessage && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                  {errorMessage}
                </div>
              )}

              {/* Checkout Summary & Action */}
              <div className="pt-4 border-t border-[#123047]/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-left w-full sm:w-auto">
                  <span className="text-xs text-[#123047]/60 block">Total to Pay</span>
                  <span className="font-serif text-2xl font-bold text-[#123047] tabular-nums">
                    RM {effectiveAmountRm.toFixed(2)}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || effectiveAmountRm < 5}
                  className="w-full sm:w-auto px-8 py-3.5 bg-[#FF7F6A] hover:bg-[#E66652] active:scale-[0.98] disabled:opacity-50 text-white font-semibold text-base rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLoading ? (
                    <span>Connecting Gateway...</span>
                  ) : (
                    <>
                      <span>Continue to Payment</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              {/* Billplz Security Guarantee */}
              <div className="flex items-center justify-center gap-2 text-xs text-[#123047]/60 pt-2">
                <Lock className="w-3.5 h-3.5 text-[#426B50]" />
                <span>Secure Ringgit checkout powered by Billplz. Card details are never stored.</span>
              </div>

            </form>
          </div>

          {/* Right Column: Public Donors & Club Integrity (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Club Integrity Card */}
            <div className="p-6 rounded-3xl bg-[#FFFDF7] border border-[#123047]/15 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-full bg-[#123047] text-[#FFFDF7] flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-[#B8E0D2]" />
                </div>
                <div>
                  <h4 className="font-serif font-bold text-[#123047] text-base">
                    Leo-Lion Club of KL Solaris
                  </h4>
                  <p className="text-xs text-[#123047]/60">
                    Registered Environmental & Community NGO
                  </p>
                </div>
              </div>

              <p className="text-xs text-[#123047]/75 leading-relaxed">
                As a chartered Lions International youth and volunteer affiliate, our club finances and project activities undergo regular community audit. Every donor receives an official Billplz digital payment receipt.
              </p>
            </div>

            {/* Live Donors Wall */}
            <div className="p-6 rounded-3xl bg-[#FFFDF7] border border-[#123047]/15 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-serif font-bold text-[#123047] text-base flex items-center gap-2">
                  <Heart className="w-4 h-4 text-[#FF7F6A]" />
                  <span>Recent Supporters</span>
                </h4>
                <span className="text-xs text-[#426B50] font-medium">Verified Payments</span>
              </div>

              <div className="space-y-3">
                {recentDonations.length === 0 ? (
                  <p className="text-xs text-[#123047]/50 italic">
                    Be the first supporter to plant a fragment today!
                  </p>
                ) : (
                  recentDonations.map((d) => (
                    <div
                      key={d.id}
                      className="p-3 rounded-xl bg-[#F4E9D8]/40 border border-[#123047]/10 flex items-start justify-between gap-3"
                    >
                      <div>
                        <div className="text-xs font-semibold text-[#123047]">
                          {d.donorName}
                        </div>
                        {d.message && (
                          <div className="text-[11px] text-[#123047]/70 italic mt-0.5 line-clamp-1">
                            "{d.message}"
                          </div>
                        )}
                        <div className="text-[10px] text-[#123047]/50 mt-1">
                          {new Date(d.paidAt).toLocaleDateString('en-MY', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                      </div>

                      <div className="font-serif font-bold text-sm text-[#247BA0] tabular-nums shrink-0">
                        RM {d.amountRm.toLocaleString('en-MY')}
                      </div>
                    </div>
                  ))
                )}
              </div>

            </div>

          </div>

        </div>

      </div>
    </section>
  );
};
