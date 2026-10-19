import React from 'react';
import { ArrowDownRight, Anchor, Heart, Sparkles } from 'lucide-react';
import { CampaignData } from '../types';

interface HeroCollageProps {
  campaign: CampaignData;
  onDonateClick: () => void;
  onImpactClick: () => void;
}

export const HeroCollage: React.FC<HeroCollageProps> = ({
  campaign,
  onDonateClick,
  onImpactClick,
}) => {
  return (
    <section className="relative overflow-hidden pt-8 pb-16 md:pt-12 md:pb-24 bg-[#FFFDF7]">
      {/* Decorative organic paper backdrop elements */}
      <div className="absolute top-12 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-[#B8E0D2]/25 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute -top-10 -right-20 w-80 h-80 bg-[#FF7F6A]/10 rounded-full blur-2xl pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Editorial Eyebrow & Scrapbook Stamp */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3 text-xs tracking-wider uppercase font-semibold text-[#247BA0]">
            <span>Leo-Lion Club of KL Solaris</span>
            <span aria-hidden="true">·</span>
            <span>Coralku Scientific Partnership</span>
            <span aria-hidden="true">·</span>
            <span>Pulau Lang Tengah Sanctuary</span>
          </div>

          {/* Scrapbook Stamp / Washi Tape Accent */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#F4E9D8] border border-[#123047]/15 rounded-md text-xs font-serif font-medium text-[#123047] rotate-1 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-[#FF7F6A]" />
            <span>Resilience-Based Coral Nursery</span>
          </div>
        </div>

        {/* Asymmetrical Grid: 2-Column Editorial Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Left Column: Bold Typographic Narrative & CTAs (7 cols) */}
          <div className="lg:col-span-7 flex flex-col items-start">
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold text-[#123047] leading-[1.08] tracking-tight max-w-2xl text-balance">
              A Little Coral. <br />
              <span className="italic font-normal text-[#247BA0]">A Living Ocean.</span>
            </h1>

            <p className="mt-6 text-base sm:text-lg text-[#123047]/80 leading-relaxed max-w-xl font-normal">
              Rising sea temperatures and bleaching have severely impacted Malaysia’s tropical reefs. 
              The <strong className="font-semibold text-[#123047]">Leo-Lion Club of KL Solaris</strong> partners with <strong className="font-semibold text-[#247BA0]">Coralku</strong> marine researchers to cultivate heat-resilient super-corals, deploy eco-friendly Coral Clips, and monitor natural multi-species spawning along Pulau Lang Tengah.
            </p>

            {/* CTAs */}
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                onClick={onDonateClick}
                className="px-6 py-3.5 text-base font-semibold text-white bg-[#FF7F6A] hover:bg-[#E66652] active:scale-[0.98] rounded-xl shadow-md transition-all flex items-center gap-2 group cursor-pointer"
              >
                <Heart className="w-5 h-5 fill-white/30" />
                <span>Donate to the Campaign</span>
              </button>

              <button
                onClick={onImpactClick}
                className="px-6 py-3.5 text-base font-semibold text-[#123047] bg-[#F4E9D8] hover:bg-[#E8D9C2] border border-[#123047]/15 active:scale-[0.98] rounded-xl transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>Track Our Impact</span>
                <ArrowDownRight className="w-4 h-4 text-[#247BA0]" />
              </button>
            </div>

            {/* Quick Proof Metrics Strip */}
            <div className="mt-10 pt-6 border-t border-[#123047]/10 w-full grid grid-cols-3 gap-4 max-w-xl">
              <div>
                <p className="text-2xl sm:text-3xl font-serif font-bold text-[#123047] tabular-nums">
                  {campaign.verifiedCoralPlantingCount.toLocaleString()}
                </p>
                <p className="text-xs text-[#123047]/65 mt-0.5">Fragments Planted</p>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-serif font-bold text-[#247BA0] tabular-nums">
                  {campaign.volunteerCount}
                </p>
                <p className="text-xs text-[#123047]/65 mt-0.5">Certified Divers</p>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-serif font-bold text-[#426B50] tabular-nums">
                  {campaign.percentAchieved}%
                </p>
                <p className="text-xs text-[#123047]/65 mt-0.5">Goal Funded</p>
              </div>
            </div>

          </div>

          {/* Right Column: Tactile Collage Showcase (5 cols) */}
          <div className="lg:col-span-5 relative">
            
            {/* Scrapbook Tape Top */}
            <div className="absolute -top-3 left-12 w-28 h-6 bg-[#F4E9D8]/90 border-t border-b border-[#123047]/10 -rotate-3 z-20 shadow-xs pointer-events-none" />

            {/* Main Primary Image Container */}
            <div className="relative rounded-2xl overflow-hidden shadow-xl border-4 border-white bg-white rotate-1 transition-transform hover:rotate-0 duration-300">
              <img
                src="/src/assets/images/hero_coral_reef_1792397670201.jpg"
                alt="Flourishing coral reef sanctuary restored by Solaris Reef divers"
                className="w-full h-80 sm:h-96 object-cover"
                loading="eager"
                referrerPolicy="no-referrer"
              />
              <div className="p-4 bg-white">
                <div className="flex items-center justify-between text-xs text-[#123047]/70">
                  <span className="font-serif italic">Sector 4 Marine Nursery</span>
                  <span>Tioman Marine Park</span>
                </div>
              </div>
            </div>

            {/* Overlapping Floating Polaroid Card: Live Progress */}
            <div className="absolute -bottom-8 -left-6 sm:-left-8 bg-[#FFFDF7] p-4 sm:p-5 rounded-xl border border-[#123047]/15 shadow-xl -rotate-2 max-w-[280px] sm:max-w-xs z-20">
              {/* Paper Pin */}
              <div className="w-3 h-3 rounded-full bg-[#FF7F6A] mx-auto mb-2.5 scrapbook-pin" />
              
              <div className="flex items-center justify-between text-xs font-semibold text-[#123047] mb-1">
                <span>Fundraising Progress</span>
                <span className="font-serif text-[#FF7F6A] font-bold text-sm">
                  {campaign.percentAchieved}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2.5 bg-[#F4E9D8] rounded-full overflow-hidden my-2">
                <div
                  className="h-full bg-gradient-to-r from-[#247BA0] to-[#FF7F6A] transition-all duration-1000 ease-out"
                  style={{ width: `${Math.min(100, campaign.percentAchieved)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs pt-1 text-[#123047]/80">
                <span className="font-semibold text-[#123047] tabular-nums">
                  RM {campaign.totalRaisedRm.toLocaleString('en-MY', { minimumFractionDigits: 0 })}
                </span>
                <span className="text-[#123047]/60 tabular-nums">
                  Goal: RM {campaign.fundraisingTargetRm.toLocaleString('en-MY')}
                </span>
              </div>

              <div className="mt-3 pt-2 border-t border-[#123047]/10 flex items-center gap-1.5 text-[11px] text-[#426B50] font-medium">
                <Anchor className="w-3 h-3 text-[#247BA0]" />
                <span>Next Nursery Spider Grid at RM 30,000</span>
              </div>
            </div>

            {/* Scrapbook Sticker: Every Fragment Matters */}
            <div className="absolute -top-4 -right-2 sm:-right-4 bg-[#B8E0D2] border border-[#123047]/20 text-[#123047] font-serif font-bold text-xs px-3 py-1.5 rounded-full rotate-6 shadow-sm z-30">
              Every Fragment Matters 🪸
            </div>

          </div>

        </div>

      </div>
    </section>
  );
};
