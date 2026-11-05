import React, { useCallback, useEffect, useState } from 'react';
import { HeroCollage } from '../components/HeroCollage';
import { CampaignOverview } from '../components/CampaignOverview';
import { CampaignProgress } from '../components/CampaignProgress';
import { DonationSection } from '../components/DonationSection';
import { CampaignData, RecentPublicDonation } from '../types';

interface HomePageProps {
  onNavigate: (path: string) => void;
}

const CAMPAIGN_REFRESH_INTERVAL_MS = 30_000;

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [recentDonations, setRecentDonations] = useState<RecentPublicDonation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCampaignData = useCallback(async (signal?: AbortSignal, initialLoad = false) => {
    try {
      const response = await fetch('/api/campaign', {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to load campaign data (HTTP ${response.status})`);
      }

      const payload = await response.json();
      if (!payload?.campaign) {
        throw new Error('Campaign data is missing from the server response');
      }

      setCampaign(payload.campaign as CampaignData);
      setRecentDonations(Array.isArray(payload.recentDonations) ? payload.recentDonations : []);
      setError(null);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const message = err instanceof Error ? err.message : 'Unable to connect to Solaris Reef server';
      // Keep the last successfully loaded campaign visible if a background refresh fails.
      if (initialLoad) setError(message);
    } finally {
      if (initialLoad) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchCampaignData(controller.signal, true);

    const refresh = () => {
      if (document.visibilityState === 'visible') {
        void fetchCampaignData(undefined, false);
      }
    };

    const intervalId = window.setInterval(refresh, CAMPAIGN_REFRESH_INTERVAL_MS);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);

    return () => {
      controller.abort();
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [fetchCampaignData]);

  const scrollToDonate = () => {
    document.getElementById('donate')?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToImpact = () => {
    document.getElementById('impact')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCheckoutInitiated = (checkoutUrl: string) => {
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
        <p className="font-serif text-lg font-bold text-[#123047]">Connecting to Solaris Reef...</p>
        <p className="text-xs text-[#123047]/60 mt-1">Loading live marine conservation data</p>
      </div>
    );
