import React from 'react';
import { Trophy } from 'lucide-react';
import { CampaignData } from '../types';
import { siteConfig } from '../config/site';

interface CampaignProgressProps {
  campaign: CampaignData;
}

export const CampaignProgress: React.FC<CampaignProgressProps> = ({ campaign }) => {
  const percentFunded = Math.max(0, Number(campaign.percentAchieved) || 0);
  const fundedFragments = Math.max(0, Number(campaign.fundedCoralFragmentCount) || 0);
  const fragmentTarget = Math.max(0, Number(campaign.coralPlantingTarget) || 0);
  const verifiedFragments = Math.max(0, Number(campaign.verifiedCoralPlantingCount) || 0);
  const volunteerCount = Math.max(0, Number(campaign.volunteerCount) || 0);
  const donorCount = Math.max(0, Number(campaign.successfulDonationsCount) || 0);
  const fundedPercentage = fragmentTarget > 0
    ? Math.round((fundedFragments / fragmentTarget) * 100)
    : 0;

  return (
    <section id="impact" className="py-20 bg-[#FFFDF7] border-t border-[#123047]/10 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="text-xs uppercase tracking-widest font-semibold text-[#247BA0] mb-2">
            Live Campaign Progress
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#123047]">
            Real-Time Conservation Impact
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <div className="p-6 rounded-2xl bg-[#FFFDF7] border border-[#123047]/15 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs uppercase tracking-wider font-semibold text-[#247BA0]">Verified Funds</span>
              <Trophy className="w-5 h-5 text-[#FF7F6A]" />
            </div>
            <div className="text-3xl font-serif font-bold text-[#123047] tabular-nums">
              RM {(Number(campaign.totalRaisedRm) || 0).toLocaleString('en-MY', { minimumFractionDigits: 0 })}
            </div>
            <div className="mt-2 text-xs text-[#123047]/65 flex items-center justify-between">
              <span>Goal: RM {(Number(campaign.fundraisingTargetRm) || 0).toLocaleString('en-MY')}</span>
              <span className="font-semibold text-[#426B50]">{percentFunded}%</span>
            </div>
            <div className="w-full h-2 bg-[#F4E9D8] rounded-full overflow-hidden mt-3">
              <div
                className="h-full bg-[#FF7F6A] transition-all duration-700 ease-out"
                style={{ width: `${Math.min(100, percentFunded)}%` }}
              />
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-[#FFFDF7] border border-[#123047]/15 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs uppercase tracking-wider font-semibold text-[#426B50]">Fragments Funded</span>
              <span className="text-lg" aria-hidden="true">🪸</span>
            </div>
            <div className="text-3xl font-serif font-bold text-[#123047] tabular-nums">
              {fundedFragments.toLocaleString('en-MY')}
            </div>
            <div className="mt-2 text-xs text-[#123047]/65 flex items-center justify-between">
              <span>Target: {fragmentTarget.toLocaleString('en-MY')} frags</span>
              <span className="font-semibold text-[#426B50]">{fundedPercentage}%</span>
            </div>
            <div className="w-full h-2 bg-[#F4E9D8] rounded-full overflow-hidden mt-3">
              <div
                className="h-full bg-[#426B50] transition-all duration-700 ease-out"
                style={{ width: `${Math.min(100, fundedPercentage)}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-[#123047]/60">
              {verifiedFragments.toLocaleString('en-MY')} fragments physically planted and verified
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#FFFDF7] border border-[#123047]/15 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs uppercase tracking-wider font-semibold text-[#247BA0]">Divers & Volunteers</span>
              <span className="text-lg" aria-hidden="true">🤿</span>
            </div>
            <div className="text-3xl font-serif font-bold text-[#123047] tabular-nums">
              {volunteerCount.toLocaleString('en-MY')}
            </div>
            <div className="mt-2 text-xs text-[#123047]/65">
              Registered campaign divers and shore survey volunteers
            </div>
            <div className="mt-4 text-xs font-medium text-[#247BA0]">
              Active community conservation
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-[#FFFDF7] border border-[#123047]/15 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs uppercase tracking-wider font-semibold text-[#FF7F6A]">Public Donors</span>
              <span className="text-lg" aria-hidden="true">🤝</span>
            </div>
            <div className="text-3xl font-serif font-bold text-[#123047] tabular-nums">
              {donorCount.toLocaleString('en-MY')}
            </div>
            <div className="mt-4 text-xs font-medium text-[#426B50]">
              {siteConfig.claims.directAllocationBadge}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
