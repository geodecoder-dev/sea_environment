import React, { useEffect, useState } from 'react';
import { HeroCollage } from '../components/HeroCollage';
import { CampaignOverview } from '../components/CampaignOverview';
import { CampaignProgress } from '../components/CampaignProgress';
import { DonationSection } from '../components/DonationSection';
import { CampaignData, RecentPublicDonation } from '../types';

interface HomePageProps {
  onNavigate: (path: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [recentDonations, setRecentDonations] = useState<RecentPublicDonation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const campRes = await fetch('/api/campaign');

      if (!campRes.ok) {
        throw new Error('Failed to load campaign data');
      }

      const campData = await campRes.json();

      setCampaign(campData.campaign);
      setRecentDonations(campData.recentDonations || []);
    } catch (err: any) {
      setError(err.message || 'Unable to connect to Solaris Reef server');
    } finally {
      setLoading(false);
    }
  };

  const scrollToDonate = () => {
    const el = document.getElementById('donate');
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToImpact = () => {
    const el = document.getElementById('impact');
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCheckoutInitiated = (checkoutUrl: string) => {
    // If internal simulated checkout or external Billplz url:
    if (checkoutUrl.startsWith('/')) {
      onNavigate(checkoutUrl);
    } else {
      window.location.href = checkoutUrl;
    }
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 bg-[#FFFDF7]">
        <div className="w-12 h-12 rounded-full border-3 border-[#247BA0]/20 border-t-[#247BA0] animate-spin mb-4" />
        <p className="font-serif text-lg font-bold text-[#123047]">
          Connecting to Solaris Reef...
        </p>
        <p className="text-xs text-[#123047]/60 mt-1">
          Loading live marine conservation data
        </p>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center bg-[#FFFDF7]">
        <p className="font-serif text-xl font-bold text-red-600 mb-2">Unable to Load Campaign</p>
        <p className="text-xs text-[#123047]/70 mb-4">{error}</p>
        <button
          onClick={fetchInitialData}
          className="px-5 py-2.5 bg-[#123047] text-white text-xs font-semibold rounded-xl hover:bg-[#247BA0] transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#FFFDF7]">
      {/* Editorial Collage Hero Section */}
      <HeroCollage
        campaign={campaign}
        onDonateClick={scrollToDonate}
        onImpactClick={scrollToImpact}
      />

      {/* Campaign Overview & Ecological Mission */}
      <CampaignOverview />

      {/* Live Campaign Progress Dashboard & Milestones */}
      <CampaignProgress campaign={campaign} />

      {/* Interactive Donation Section (Billplz Integration) */}
      <DonationSection
        recentDonations={recentDonations}
        onSuccessfulInitiation={handleCheckoutInitiated}
      />
    </div>
  );
};
