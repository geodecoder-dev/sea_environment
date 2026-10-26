import React from 'react';
import { ShieldCheck, Compass, Users, Sparkles } from 'lucide-react';
import { siteConfig } from '../config/site';

interface CampaignOverviewProps {
  verifiedCoralPlantingCount?: number;
}

export const CampaignOverview: React.FC<CampaignOverviewProps> = ({
  verifiedCoralPlantingCount = 0,
}) => {
  return (
    <section id="overview" className="py-20 bg-[#FFFDF7] border-t border-[#123047]/10 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-2xl mb-14">
          <div className="text-xs uppercase tracking-widest font-semibold text-[#247BA0] mb-2">
            The Ecological Mission
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#123047] leading-tight">
            Why Our Reefs Need Hands in the Water
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[#123047]/75 leading-relaxed">
            {siteConfig.claims.speciesCountDescription}
          </p>
        </div>

        {/* 3-Column Editorial Grid: The Problem, The Science, The Community */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          
          {/* Card 1: The Critical Stakes */}
          <div className="relative p-7 bg-[#F4E9D8]/60 border border-[#123047]/15 rounded-2xl flex flex-col justify-between">
            <div className="tape-strip absolute -top-3 left-8 w-20 h-5 rotate-1 border-t border-b border-[#123047]/10" />
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#247BA0]/15 text-[#247BA0] flex items-center justify-center mb-5">
                <Compass className="w-5 h-5" />
              </div>
              <h3 className="font-serif text-xl font-bold text-[#123047] mb-3">
                1. Fragile Coastal Keystone
              </h3>
              <p className="text-sm text-[#123047]/80 leading-relaxed">
                {siteConfig.claims.marineLifeKeystoneDescription}
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#123047]/10 text-xs text-[#123047]/70 font-medium">
              {siteConfig.claims.keystoneSource}
            </div>
          </div>

          {/* Card 2: Scientific Micro-propagation & Coral Clips */}
          <div className="relative p-7 bg-[#FFFDF7] border border-[#123047]/20 rounded-2xl shadow-sm flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#FF7F6A]/20 text-[#FF7F6A] flex items-center justify-center mb-5">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="font-serif text-xl font-bold text-[#123047] mb-3">
                2. Coral Clips & Super Corals
              </h3>
              <p className="text-sm text-[#123047]/80 leading-relaxed">
                  We use Coralclip® technology to secure coral fragments to natural reef substrates without chemical adhesives. Through Coralku’s Project ASSIST, heat-stress testing and underwater surveys identify naturally heat-tolerant corals for nursery cultivation, supporting more resilient reef restoration as marine heatwaves intensify.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#123047]/10 text-xs text-[#247BA0] font-medium">
              {verifiedCoralPlantingCount.toLocaleString('en-MY')} corals secured via Coral Clips
            </div>
          </div>

          {/* Card 3: Community Youth Action */}
          <div className="relative p-7 bg-[#B8E0D2]/40 border border-[#123047]/15 rounded-2xl flex flex-col justify-between">
            <div className="tape-strip absolute -top-3 right-8 w-20 h-5 -rotate-2 border-t border-b border-[#123047]/10" />
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#426B50]/20 text-[#426B50] flex items-center justify-center mb-5">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="font-serif text-xl font-bold text-[#123047] mb-3">
                3. Citizen Diver Action
              </h3>
              <p className="text-sm text-[#123047]/80 leading-relaxed">
                Leo-Lion Club of KL Solaris will work alongside Coralku marine scientists at Pulau Lang Tengah. Citizen divers learn non-invasive fragment collection, frame attachment, and photogrammetry monitoring that resulted in documented multi-species natural spawning.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#123047]/10 text-xs text-[#426B50] font-medium">
              Citizen conservation divers & researchers
            </div>
          </div>

        </div>

        {/* Visual Storytelling Collage Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-[#F4E9D8]/40 p-6 sm:p-10 rounded-3xl border border-[#123047]/10">
          
          <div className="lg:col-span-5 relative">
            <div className="rounded-2xl overflow-hidden border-4 border-white shadow-lg rotate-[-1deg]">
              <img
                src="/images/coral_fragment_nursery_1792397670199.jpg"
                alt="Underwater steel nursery spider grid with tagged coral fragments"
                className="w-full h-72 object-cover"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="mt-3 text-xs text-[#123047]/70 font-serif italic text-center">
              Fig. 1 — Acropora fragments tagged on nursery spider-frames at 7m depth
            </div>
          </div>

          <div className="lg:col-span-7 flex flex-col justify-center lg:pl-6">
            <span className="text-xs uppercase tracking-wider font-semibold text-[#FF7F6A] mb-2">
              Transparent Conservation Workflow
            </span>
            <h3 className="font-serif text-2xl sm:text-3xl font-bold text-[#123047] leading-snug">
              Every cent counts!
            </h3>
            
            <p className="mt-4 text-sm sm:text-base text-[#123047]/80 leading-relaxed">
              {siteConfig.claims.zeroOverheadDescription}
            </p>

            <div className="mt-6 flex flex-wrap gap-4 text-xs text-[#123047] font-medium">
              <span className="flex items-center gap-1.5 bg-[#FFFDF7] px-3 py-1.5 rounded-lg border border-[#123047]/15">
                <ShieldCheck className="w-4 h-4 text-[#426B50]" /> Verified by Marine Ecologists
              </span>
              <span className="flex items-center gap-1.5 bg-[#FFFDF7] px-3 py-1.5 rounded-lg border border-[#123047]/15">
                <ShieldCheck className="w-4 h-4 text-[#426B50]" /> Registered NGO Initiative
              </span>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
