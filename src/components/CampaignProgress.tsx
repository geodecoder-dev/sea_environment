import React from 'react';
import { Trophy } from 'lucide-react';
import { CampaignData } from '../types';

interface CampaignProgressProps {
  campaign: CampaignData;
}

export const CampaignProgress: React.FC<CampaignProgressProps> = ({ campaign }) => {
  return (
    <section id="impact" className="py-20 bg-[#FFFDF7] border-t border-[#123047]/10 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="text-xs uppercase tracking-widest font-semibold text-[#247BA0] mb-2">
            Live Campaign Progress
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#123047]">
            Real-Time Conservation Impact
          </h2>
          <p className="mt-3 text-base text-[#123047]/75">
            Transparent metrics verified through Billplz transactions and periodic marine dive surveys.
          </p>
        </div>

        {/* 4 Primary KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          
          {/* KPI 1: Funds Raised */}
          <div className="p-6 rounded-2xl bg-[#FFFDF7] border border-[#123047]/15 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs uppercase tracking-wider font-semibold text-[#247BA0]">
                Verified Funds
              </span>
              <Trophy className="w-5 h-5 text-[#FF7F6A]" />
            </div>
            <div className="text-3xl font-serif font-bold text-[#123047] tabular-nums">
              RM {campaign.totalRaisedRm.toLocaleString('en-MY', { minimumFractionDigits: 0 })}
            </div>
            <div className="mt-2 text-xs text-[#123047]/65 flex items-center justify-between">
              <span>Goal: RM {campaign.fundraisingTargetRm.toLocaleString('en-MY')}</span>
              <span className="font-semibold text-[#426B50]">{campaign.percentAchieved}%</span>
            </div>
            {/* Progress bar */}
            <div className="w-full h-2 bg-[#F4E9D8] rounded-full overflow-hidden mt-3">
              <div
                className="h-full bg-[#FF7F6A] transition-all duration-700 ease-out"
                style={{ width: `${Math.min(100, campaign.percentAchieved)}%` }}
              />
            </div>
          </div>

          {/* KPI 2: Coral Fragments */}
          <div className="p-6 rounded-2xl bg-[#FFFDF7] border border-[#123047]/15 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs uppercase tracking-wider font-semibold text-[#426B50]">
                Fragments Planted
              </span>
              <span className="text-lg">🪸</span>
            </div>
            <div className="text-3xl font-serif font-bold text-[#123047] tabular-nums">
              {campaign.verifiedCoralPlantingCount.toLocaleString()}
            </div>
            <div className="mt-2 text-xs text-[#123047]/65 flex items-center justify-between">
              <span>Target: {campaign.coralPlantingTarget.toLocaleString()} frags</span>
              <span className="font-semibold text-[#426B50]">
                {Math.round((campaign.verifiedCoralPlantingCount / campaign.coralPlantingTarget) * 100)}%
              </span>
            </div>
            <div className="w-full h-2 bg-[#F4E9D8] rounded-full overflow-hidden mt-3">
              <div
                className="h-full bg-[#426B50] transition-all duration-700 ease-out"
                style={{
                  width: `${Math.min(100, Math.round((campaign.verifiedCoralPlantingCount / campaign.coralPlantingTarget) * 100))}%`,
                }}
              />
            </div>
          </div>

          {/* KPI 3: Volunteers */}
          <div className="p-6 rounded-2xl bg-[#FFFDF7] border border-[#123047]/15 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs uppercase tracking-wider font-semibold text-[#247BA0]">
                Youth Volunteers
              </span>
              <span className="text-lg">🤿</span>
            </div>
            <div className="text-3xl font-serif font-bold text-[#123047] tabular-nums">
              {campaign.volunteerCount}
            </div>
            <div className="mt-2 text-xs text-[#123047]/65">
              Trained divers & shore survey team
            </div>
            <div className="mt-4 text-xs font-medium text-[#247BA0]">
              +12 joined this month
            </div>
          </div>

          {/* KPI 4: Successful Donors */}
          <div className="p-6 rounded-2xl bg-[#FFFDF7] border border-[#123047]/15 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs uppercase tracking-wider font-semibold text-[#FF7F6A]">
                Public Donors
              </span>
              <span className="text-lg">🤝</span>
            </div>
            <div className="text-3xl font-serif font-bold text-[#123047] tabular-nums">
              {campaign.successfulDonationsCount}
            </div>
            <div className="mt-2 text-xs text-[#123047]/65">
              Verified Billplz contributions
            </div>
            <div className="mt-4 text-xs font-medium text-[#426B50]">
              100% directly allocated to reef beds
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
