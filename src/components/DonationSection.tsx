import React, { useState, useEffect } from 'react';
import { ArrowRight, Check, Gift, Heart, Lock, Mail, Send, X } from 'lucide-react';
import { RecentPublicDonation } from '../types';

interface DonationSectionProps {
  recentDonations: RecentPublicDonation[];
  onSuccessfulInitiation?: (checkoutUrl: string) => void;
}

import { calculateEntitlements, MIN_DONATION_RM, UPDATES_THRESHOLD_RM } from '../../shared/pricing';

// ---- Pricing model (single source of truth) -------------------------------
const FRAGMENT_RM = 50; // 1 coral fragment
const UPDATES_RM = 50; // 12 months of monthly photo updates
const MIN_RM = MIN_DONATION_RM;

const PRESETS = [
  { rm: 50, title: '1 Fragment', note: 'Survival monitoring.' },
  { rm: 100, title: '1 Fragment + Updates', note: 'Monthly photo updates for 12 months.' },
  { rm: 500, title: 'Spider-frame', note: '25 fragments plus monthly photo updates for 12 months.' },
];

const EMAIL_OK = (v: string) => /^\S+@\S+\.\S+$/.test(v.trim());

const getImpact = (rm: number) => {
  const entitlement = calculateEntitlements(rm);
  if (rm < MIN_RM) {
    return {
      corals: 0,
      hasUpdates: false,
      text: `Every RM ${MIN_RM} sponsors one coral fragment. Smaller amounts cannot be matched to a fragment yet.`,
    };
  }
  const isFrame = rm >= 500;
  return {
    corals: entitlement.coralFragmentsCount,
    hasUpdates: entitlement.updatesEligible,
    text: isFrame
      ? `Adopts a full nursery spider-frame (${entitlement.coralFragmentsCount} fragments) tagged by our divers, plus 12 months of monthly photo updates.`
      : entitlement.updatesEligible
      ? `Sponsors ${entitlement.coralFragmentsCount} coral fragment${entitlement.coralFragmentsCount > 1 ? 's' : ''} plus 12 months of monthly photo updates.`
      : `Sponsors ${entitlement.coralFragmentsCount} coral fragment at Pantai Pasir Besar with photogrammetric survival monitoring.`,
  };
};

// ---- Small reusable bits ---------------------------------------------------
const inputCls =
  'w-full px-4 py-2.5 rounded-xl border border-[#123047]/15 bg-white text-sm text-[#123047] placeholder:text-[#123047]/35 focus:outline-none focus:ring-2 focus:ring-[#247BA0] focus:border-transparent';

const Field: React.FC<{
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}> = ({ label, hint, required, children }) => (
  <div>
    <label className="block text-sm font-medium text-[#123047] mb-1.5">
      {label}
      {required && <span className="text-[#FF7F6A]"> *</span>}
    </label>
    {children}
    {hint && <p className="text-xs text-[#123047]/55 mt-1.5">{hint}</p>}
  </div>
);

export const DonationSection: React.FC<DonationSectionProps> = ({
  recentDonations,
  onSuccessfulInitiation,
}) => {
  const [selectedRm, setSelectedRm] = useState<number>(100);
  const [customRm, setCustomRm] = useState<string>('');

  // Gift & personalisation
  const [isGift, setIsGift] = useState<boolean>(false);
  const [coralName, setCoralName] = useState<string>('');
  const [message, setMessage] = useState<string>('');

  // Referral
  const [referral, setReferral] = useState<string>('');

  // Donor
  const [donorName, setDonorName] = useState<string>('');
  const [donorEmail, setDonorEmail] = useState<string>('');
  const [attribution, setAttribution] = useState<'public' | 'anonymous'>('public');

  // Recipient (gift only)
  const [recipientName, setRecipientName] = useState<string>('');
  const [recipientEmail, setRecipientEmail] = useState<string>('');

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const refParam = params.get('referral') || params.get('ref') || params.get('ref_code');
      if (refParam) {
        setReferral(refParam.trim());
      }
    } catch {}
  }, []);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Corporate / group inquiry modal
  const [showInquiryModal, setShowInquiryModal] = useState<boolean>(false);
  const [inquiryName, setInquiryName] = useState<string>('');
  const [inquiryEmail, setInquiryEmail] = useState<string>('');
  const [inquiryPhone, setInquiryPhone] = useState<string>('');
  const [inquiryOrg, setInquiryOrg] = useState<string>('');
  const [inquiryMsg, setInquiryMsg] = useState<string>('');
  const [inquiryLoading, setInquiryLoading] = useState<boolean>(false);
  const [inquiryStatus, setInquiryStatus] = useState<string | null>(null);

  const amountRm = customRm ? parseFloat(customRm) || 0 : selectedRm;
  const amountSen = Math.round(amountRm * 100);
  const impact = getImpact(amountRm);
  const canTopUp = amountRm >= FRAGMENT_RM && amountRm < FRAGMENT_RM + UPDATES_RM;

  const pickPreset = (rm: number) => {
    setSelectedRm(rm);
    setCustomRm('');
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (amountRm < MIN_RM) {
      setErrorMessage(`The minimum donation is RM ${MIN_RM} (1 coral fragment).`);
      return;
    }
    if (!EMAIL_OK(donorEmail)) {
      setErrorMessage('Enter a valid email address for your payment receipt.');
      return;
    }
    if (isGift) {
      if (!recipientName.trim()) {
        setErrorMessage("Enter the recipient's name.");
        return;
      }
      if (!EMAIL_OK(recipientEmail)) {
        setErrorMessage("Enter a valid email address for the recipient.");
        return;
      }
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/donations/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountSen,
          donorName: donorName.trim() || 'Reef Supporter',
          donorEmail: donorEmail.trim(),
          attributionPreference: attribution,
          message: message.trim(),
          coralName: coralName.trim(),
          referral: referral.trim(),
          isGift,
          recipientName: isGift ? recipientName.trim() : '',
          recipientEmail: isGift ? recipientEmail.trim() : '',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment gateway failed to initialize.');
      if (!data.checkoutUrl) throw new Error('No checkout URL received from gateway.');

      if (onSuccessfulInitiation) onSuccessfulInitiation(data.checkoutUrl);
      else window.location.href = data.checkoutUrl;
    } catch (err: any) {
      setErrorMessage(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInquiryLoading(true);
    setInquiryStatus(null);
    try {
      const res = await fetch('/api/contact/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: inquiryName,
          email: inquiryEmail,
          phone: inquiryPhone,
          organisation: inquiryOrg,
          message: inquiryMsg,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      setInquiryStatus('Inquiry sent.');
      setTimeout(() => {
        setShowInquiryModal(false);
        setInquiryStatus(null);
        setInquiryMsg('');
      }, 3000);
    } catch (err: any) {
      setInquiryStatus(`Error: ${err.message}`);
    } finally {
      setInquiryLoading(false);
    }
  };

  const tagFrom = attribution === 'anonymous' ? 'Anonymous' : donorName.trim() || 'a reef supporter';

  return (
    <section id="donate" className="py-20 bg-[#F4E9D8]/35 border-t border-[#123047]/10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="max-w-2xl mx-auto text-center mb-12">
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#123047]">
            Support Our Reef Today
          </h2>
          <p className="mt-4 text-base text-[#123047]/70 leading-relaxed">
            Fund a coral fragment at Pantai Pasir Besar, Pulau Lang Tengah. Name it, add a message to its
            tag, or give it to someone who loves the ocean!
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* ---------------- Left: the form ---------------- */}
          <div className="lg:col-span-7 bg-[#FFFDF7] rounded-3xl border border-[#123047]/12 p-6 sm:p-9 space-y-9">
            {/* Amount */}
            <div>
              <h3 className="font-serif text-xl font-bold text-[#123047]">Choose an amount</h3>
              <p className="text-sm text-[#123047]/60 mt-1">RM {FRAGMENT_RM} sponsors one fragment.</p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                {PRESETS.map((p) => {
                  const active = !customRm && selectedRm === p.rm;
                  return (
                    <button
                      key={p.rm}
                      type="button"
                      onClick={() => pickPreset(p.rm)}
                      aria-pressed={active}
                      className={`text-left rounded-2xl border px-4 py-3.5 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#247BA0] ${
                        active
                          ? 'bg-[#123047] border-[#123047] text-white'
                          : 'bg-white border-[#123047]/15 text-[#123047] hover:border-[#247BA0]'
                      }`}
                    >
                      <div className="font-serif text-xl font-bold leading-none">RM {p.rm}</div>
                      <div className={`text-sm mt-2 font-medium ${active ? 'text-[#B8E0D2]' : 'text-[#247BA0]'}`}>
                        {p.title}
                      </div>
                      <div className={`text-xs mt-0.5 ${active ? 'text-white/65' : 'text-[#123047]/55'}`}>
                        {p.note}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="relative mt-3">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#123047]/55">
                  RM
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label="Custom amount in ringgit"
                  placeholder="Other amount"
                  value={customRm}
                  onChange={(e) => {
                    setCustomRm(e.target.value.replace(/[^0-9]/g, ''));
                    setErrorMessage(null);
                  }}
                  className={`${inputCls} pl-12`}
                />
              </div>

              {canTopUp && (
                <button
                  type="button"
                  onClick={() => pickPreset(FRAGMENT_RM + UPDATES_RM)}
                  className="mt-3 text-sm text-[#247BA0] hover:text-[#123047] font-medium underline underline-offset-4 cursor-pointer"
                >
                  Add RM {UPDATES_RM} to follow this coral for 12 months
                </button>
              )}
            </div>

            {/* Personalise */}
            <div className="pt-8 border-t border-[#123047]/10">
              <h3 className="font-serif text-xl font-bold text-[#123047]">Make it personal</h3>
              <p className="text-sm text-[#123047]/60 mt-1">
                Both are optional. Your note is written on the coral's tag.
              </p>

              <div className="space-y-4 mt-4">
                <Field label="Coral name">
                  <input
                    type="text"
                    maxLength={30}
                    placeholder="e.g. Coral Cooper"
                    value={coralName}
                    onChange={(e) => setCoralName(e.target.value)}
                    className={inputCls}
                  />
                </Field>
                <Field label="Message on the tag">
                  <input
                    type="text"
                    maxLength={150}
                    placeholder="e.g. Happy birthday, Mum. Grow strong!"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className={inputCls}
                  />
                </Field>
              </div>
            </div>

            {/* Who is it for */}
            <div className="pt-8 border-t border-[#123047]/10">
              <h3 className="font-serif text-xl font-bold text-[#123047]">Who is it for?</h3>

              <div
                role="radiogroup"
                aria-label="Who is this donation for"
                className="mt-4 inline-flex p-1 rounded-xl bg-[#123047]/6 border border-[#123047]/10"
              >
                {[
                  { v: false, label: 'Myself' },
                  { v: true, label: 'A gift for someone' },
                ].map((o) => (
                  <button
                    key={o.label}
                    type="button"
                    role="radio"
                    aria-checked={isGift === o.v}
                    onClick={() => {
                      setIsGift(o.v);
                      setErrorMessage(null);
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center gap-2 ${
                      isGift === o.v ? 'bg-white text-[#123047] shadow-sm' : 'text-[#123047]/60 hover:text-[#123047]'
                    }`}
                  >
                    {o.v && <Gift className="w-4 h-4" />}
                    {o.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
                <Field label="Your name">
                  <input
                    type="text"
                    placeholder="e.g. Alex Tan"
                    value={donorName}
                    onChange={(e) => setDonorName(e.target.value)}
                    className={inputCls}
                  />
                </Field>
                <Field
                  label="Your email"
                  required
                  hint={isGift ? 'Your receipt is sent here.' : 'Your receipt and monthly updates are sent here.'}
                >
                  <input
                    type="email"
                    required
                    placeholder="alex@example.com"
                    value={donorEmail}
                    onChange={(e) => setDonorEmail(e.target.value)}
                    className={inputCls}
                  />
                </Field>
              </div>

              {isGift && (
                <div className="mt-5 rounded-2xl bg-[#FF7F6A]/8 border border-[#FF7F6A]/25 p-5">
                  <p className="text-sm text-[#123047]/75 mb-4">
                    We'll email your recipient their coral, your message and, if included, the monthly photo
                    updates.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Recipient's name" required>
                      <input
                        type="text"
                        required={isGift}
                        placeholder="e.g. Jamie Oliver"
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Recipient's email" required>
                      <input
                        type="email"
                        required={isGift}
                        placeholder="jamieoliverg@example.com"
                        value={recipientEmail}
                        onChange={(e) => setRecipientEmail(e.target.value)}
                        className={inputCls}
                      />
                    </Field>
                  </div>
                </div>
              )}

              <fieldset className="mt-5">
                <legend className="text-sm font-medium text-[#123047] mb-2">Public supporter wall</legend>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  {[
                    { v: 'public' as const, label: 'Show my name' },
                    { v: 'anonymous' as const, label: 'Keep me anonymous' },
                  ].map((o) => (
                    <label key={o.v} className="flex items-center gap-2 text-sm text-[#123047] cursor-pointer">
                      <input
                        type="radio"
                        name="attribution"
                        checked={attribution === o.v}
                        onChange={() => setAttribution(o.v)}
                        className="text-[#247BA0] focus:ring-[#247BA0]"
                      />
                      {o.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              {/* Referral Textbox */}
              <div className="mt-5 pt-5 border-t border-[#123047]/10">
                <Field
                  label="Club name"
                  hint="Optional. If a Leo/Lion member, diver, or friend referred you, please enter their club name "
                >
                  <input
                    type="text"
                    maxLength={60}
                    placeholder="e.g. UOWM Leo"
                    value={referral}
                    onChange={(e) => setReferral(e.target.value)}
                    className={inputCls}
                  />
                </Field>
              </div>
            </div>
          </div>

          {/* ---------------- Right: summary ---------------- */}
          <aside className="lg:col-span-5 space-y-6 lg:sticky lg:top-6">
            {/* Coral tag preview + checkout */}
            <div className="rounded-3xl bg-[#FFFDF7] border border-[#123047]/12 p-6 sm:p-7">
              {/* Tag preview */}
              <div className="rounded-2xl bg-[#123047] text-white p-5 relative overflow-hidden">
                <div className="absolute top-4 right-4 w-3 h-3 rounded-full bg-[#FFFDF7]/90" aria-hidden="true" />
                <p className="text-xs text-[#B8E0D2]">Coral tag preview</p>
                <p className="font-serif text-2xl font-bold mt-2 break-words">
                  {coralName.trim() || 'Your coral'}
                </p>
                <p className="text-sm text-white/80 mt-3 italic leading-relaxed break-words">
                  {message.trim() ? `\u201C${message.trim()}\u201D` : 'Your message will appear here.'}
                </p>
                <p className="text-xs text-white/55 mt-4">
                  {isGift
                    ? `For ${recipientName.trim() || 'your recipient'}, from ${tagFrom}`
                    : `Sponsored by ${tagFrom}`}
                  {referral.trim() ? ` · Ref: ${referral.trim()}` : ''}
                </p>
              </div>

              {/* Impact */}
              <div className="flex items-start gap-3 mt-5">
                <div className="p-1 rounded-full bg-[#426B50] text-white mt-0.5 shrink-0">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <p className="text-sm text-[#123047]/80 leading-relaxed">{impact.text}</p>
              </div>

              {/* Total */}
              <div className="mt-6 pt-5 border-t border-[#123047]/10 flex items-baseline justify-between">
                <span className="text-sm text-[#123047]/60">Total</span>
                <span className="font-serif text-3xl font-bold text-[#123047] tabular-nums">
                  RM {amountRm.toFixed(2)}
                </span>
              </div>

              {errorMessage && (
                <div role="alert" className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || amountRm < MIN_RM}
                className="mt-4 w-full px-6 py-3.5 bg-[#FF7F6A] hover:bg-[#E66652] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <span>Opening secure checkout...</span>
                ) : (
                  <>
                    <span>{isGift ? 'Donate' : 'Continue to payment'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <p className="flex items-center justify-center gap-2 text-xs text-[#123047]/55 mt-3">
                <Lock className="w-3.5 h-3.5 text-[#426B50]" />
                Secure checkout by Billplz. Receipt emailed after payment.
              </p>
            </div>

            {/* Recent supporters */}
            <div className="rounded-3xl bg-[#FFFDF7] border border-[#123047]/12 p-6">
              <h4 className="font-serif font-bold text-[#123047] text-base flex items-center gap-2">
                <Heart className="w-4 h-4 text-[#FF7F6A]" />
                Recent supporters
              </h4>

              {recentDonations.length === 0 ? (
                <p className="text-sm text-[#123047]/55 mt-3">Be the first to fund a coral fragment today.</p>
              ) : (
                <ul className="mt-3 divide-y divide-[#123047]/8">
                  {recentDonations.map((d) => (
                    <li key={d.id} className="py-3 flex items-start justify-between gap-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#123047]">{d.donorName}</div>
                        {d.message && (
                          <div className="text-xs text-[#123047]/65 italic mt-0.5 line-clamp-1">
                            {'\u201C'}
                            {d.message}
                            {'\u201D'}
                          </div>
                        )}
                        <div className="text-xs text-[#123047]/45 mt-1">
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
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowInquiryModal(true)}
              className="w-full text-sm text-[#247BA0] hover:text-[#123047] font-medium underline underline-offset-4 cursor-pointer inline-flex items-center justify-center gap-2"
            >
              <Mail className="w-4 h-4" />
              Have any questions? Get in touch!
            </button>
          </aside>
        </form>
      </div>

      {/* Corporate / group inquiry modal */}
      {showInquiryModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="inquiry-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        >
          <div className="bg-[#FFFDF7] rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 border border-[#123047]/20 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setShowInquiryModal(false)}
              aria-label="Close"
              className="absolute top-5 right-5 text-[#123047]/60 hover:text-[#123047] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 id="inquiry-title" className="font-serif text-2xl font-bold text-[#123047] pr-8">
              Get In Touch!
            </h3>
            <p className="text-sm text-[#123047]/70 mt-2 mb-6">
              Interested in getting hands-on with us to plant coral? Fill in your details below, and we’ll contact you with more information.
            </p>

            <form onSubmit={handleInquirySubmit} className="space-y-4">
              <Field label="Contact person" required>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Tan"
                  value={inquiryName}
                  onChange={(e) => setInquiryName(e.target.value)}
                  className={inputCls}
                />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Email" required>
                  <input
                    type="email"
                    required
                    placeholder="contact@company.com"
                    value={inquiryEmail}
                    onChange={(e) => setInquiryEmail(e.target.value)}
                    className={inputCls}
                  />
                </Field>
                <Field label="Phone or WhatsApp">
                  <input
                    type="text"
                    placeholder="+60 12-345 6789"
                    value={inquiryPhone}
                    onChange={(e) => setInquiryPhone(e.target.value)}
                    className={inputCls}
                  />
                </Field>
              </div>

              <Field label="Organisation">
                <input
                  type="text"
                  placeholder="e.g. Solaris Youth & CSR Network"
                  value={inquiryOrg}
                  onChange={(e) => setInquiryOrg(e.target.value)}
                  className={inputCls}
                />
              </Field>

              <Field label="Message" required>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. 20 people, July 2027, staying at Summer Bay Resort"
                  value={inquiryMsg}
                  onChange={(e) => setInquiryMsg(e.target.value)}
                  className={inputCls}
                />
              </Field>

              {inquiryStatus && (
                <div
                  role="status"
                  className={`p-3 rounded-xl text-sm ${
                    inquiryStatus.startsWith('Error')
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  {inquiryStatus}
                </div>
              )}

              <button
                type="submit"
                disabled={inquiryLoading}
                className="w-full py-3 bg-[#123047] hover:bg-[#247BA0] active:scale-[0.99] text-white text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{inquiryLoading ? 'Sending...' : 'Send inquiry to Coralku'}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
