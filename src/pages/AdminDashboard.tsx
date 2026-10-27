import React, { useState, useEffect } from 'react';
import {
  Shield,
  LogOut,
  TrendingUp,
  Heart,
  Calendar,
  Settings,
  Database,
  Download,
  Search,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Eye,
  Check,
  Waves,
  Activity,
  Key,
} from 'lucide-react';
import {
  CampaignData,
  CampaignUpdate,
  DonationRecord,
  AdminActivity,
  AdminUser,
  WebhookLog,
} from '../types';

interface AdminDashboardProps {
  onNavigate: (path: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  // Auth state
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [emailInput, setEmailInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Active tab in admin panel
  const [activeTab, setActiveTab] = useState<'overview' | 'campaign' | 'updates' | 'donations' | 'gateway'>('overview');

  // Campaign State
  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [campaignForm, setCampaignForm] = useState<any>(null);
  const [campaignSaving, setCampaignSaving] = useState<boolean>(false);
  const [campaignMsg, setCampaignMsg] = useState<string | null>(null);

  // Updates State
  const [updates, setUpdates] = useState<CampaignUpdate[]>([]);
  const [isEditingUpdate, setIsEditingUpdate] = useState<boolean>(false);
  const [updateFormData, setUpdateFormData] = useState<any>({
    title: '',
    description: '',
    category: 'milestone',
    publicationStatus: 'published',
    imageUrl: '',
  });
  const [editingUpdateId, setEditingUpdateId] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleImageFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/admin/uploads', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setUpdateFormData((prev: any) => ({ ...prev, imageUrl: data.url }));
    } catch (err: any) {
      setUploadError(err.message || 'Media upload failed');
    } finally {
      setUploadingImage(false);
    }
  };

  // Donations State
  const [donations, setDonations] = useState<DonationRecord[]>([]);
  const [donationFilter, setDonationFilter] = useState<string>('all');
  const [donationSearch, setDonationSearch] = useState<string>('');
  const [donationsLoading, setDonationsLoading] = useState<boolean>(false);

  // Activities & Gateway
  const [activities, setActivities] = useState<AdminActivity[]>([]);
  const [gatewayStatus, setGatewayStatus] = useState<any>(null);
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [simReference, setSimReference] = useState<string>('');
  const [simScenario, setSimScenario] = useState<string>('success');
  const [simResultMsg, setSimResultMsg] = useState<string | null>(null);

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/admin/me');
      if (res.ok) {
        const data = await res.json();
        setAdminUser(data.admin);
        fetchDashboardData();
      } else {
        setAdminUser(null);
      }
    } catch {
      setAdminUser(null);
    } finally {
      setAuthLoading(false);
    }
  };

  const fetchDashboardData = async () => {
    try {
      // 1. Campaign
      const campRes = await fetch('/api/campaign');
      if (campRes.ok) {
        const campData = await campRes.json();
        setCampaign(campData.campaign);
        setCampaignForm({
          title: campData.campaign.title,
          description: campData.campaign.description,
          fundraisingTargetRm: campData.campaign.fundraisingTargetRm,
          coralPlantingTarget: campData.campaign.coralPlantingTarget,
          verifiedCoralPlantingCount: campData.campaign.verifiedCoralPlantingCount,
          volunteerCount: campData.campaign.volunteerCount,
          campaignStatus: campData.campaign.campaignStatus,
          milestones: campData.campaign.milestones,
        });
      }

      // 2. All Updates (admin view)
      const updRes = await fetch('/api/admin/updates');
      if (updRes.ok) {
        const updData = await updRes.json();
        setUpdates(updData.updates);
      }

      // 3. Donations
      fetchDonations();

      // 4. Activities
      const actRes = await fetch('/api/admin/activities');
      if (actRes.ok) {
        const actData = await actRes.json();
        setActivities(actData.activities);
      }

      // 5. Gateway Status
      const gwRes = await fetch('/api/admin/billplz-status');
      if (gwRes.ok) {
        const gwData = await gwRes.json();
        setGatewayStatus(gwData.status);
        setWebhookLogs(gwData.webhookLogs);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    }
  };

  const fetchDonations = async (status?: string, search?: string) => {
    setDonationsLoading(true);
    try {
      const st = status !== undefined ? status : donationFilter;
      const sr = search !== undefined ? search : donationSearch;
      const res = await fetch(`/api/admin/donations?status=${encodeURIComponent(st)}&search=${encodeURIComponent(sr)}`);
      if (res.ok) {
        const data = await res.json();
        setDonations(data.items);
        if (data.items.length > 0 && !simReference) {
          setSimReference(data.items[0].internalReference);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDonationsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput, password: passwordInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }
      setAdminUser(data.admin);
      fetchDashboardData();
    } catch (err: any) {
      setLoginError(err.message);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } finally {
      setAdminUser(null);
    }
  };

  // Campaign Save
  const handleSaveCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setCampaignSaving(true);
    setCampaignMsg(null);
    try {
      const res = await fetch('/api/admin/campaign', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: campaignForm.title,
          description: campaignForm.description,
          fundraisingTargetSen: Math.round(Number(campaignForm.fundraisingTargetRm) * 100),
          coralPlantingTarget: Number(campaignForm.coralPlantingTarget),
          verifiedCoralPlantingCount: Number(campaignForm.verifiedCoralPlantingCount),
          volunteerCount: Number(campaignForm.volunteerCount),
          campaignStatus: campaignForm.campaignStatus,
          milestones: campaignForm.milestones,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update campaign');

      setCampaign(data.campaign);
      setCampaignMsg('Campaign configuration successfully updated and verified.');
      // Refresh activities
      const actRes = await fetch('/api/admin/activities');
      if (actRes.ok) {
        const actData = await actRes.json();
        setActivities(actData.activities);
      }
    } catch (err: any) {
      setCampaignMsg(`Error: ${err.message}`);
    } finally {
      setCampaignSaving(false);
    }
  };

  // Updates Save
  const handleSaveUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingUpdateId ? 'PUT' : 'POST';
      const endpoint = editingUpdateId ? `/api/admin/updates/${editingUpdateId}` : '/api/admin/updates';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateFormData),
      });

      if (!res.ok) throw new Error('Failed to save update');

      setIsEditingUpdate(false);
      setEditingUpdateId(null);
      setUpdateFormData({
        title: '',
        description: '',
        category: 'milestone',
        publicationStatus: 'published',
        imageUrl: '',
      });

      // Refresh updates
      const updRes = await fetch('/api/admin/updates');
      if (updRes.ok) {
        const updData = await updRes.json();
        setUpdates(updData.updates);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteUpdate = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this campaign update?')) return;
    try {
      const res = await fetch(`/api/admin/updates/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setUpdates(updates.filter((u) => u.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Webhook Sandbox Simulator
  const handleSimulateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setSimResultMsg(null);
    try {
      const res = await fetch('/api/admin/simulate-callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference: simReference,
          scenario: simScenario,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSimResultMsg(data.message);
      // Refresh donations & campaign & logs
      fetchDonations();
      fetchDashboardData();
    } catch (err: any) {
      setSimResultMsg(`Error: ${err.message}`);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFFDF7]">
        <div className="w-10 h-10 border-3 border-[#247BA0]/20 border-t-[#247BA0] rounded-full animate-spin" />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // LOGIN SCREEN (If not authenticated)
  // ---------------------------------------------------------------------------
  if (!adminUser) {
    return (
      <div className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[#FFFDF7]">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="w-12 h-12 rounded-2xl bg-[#123047] text-white flex items-center justify-center mx-auto mb-3 shadow-md">
            <Shield className="w-6 h-6 text-[#B8E0D2]" />
          </div>
          <h2 className="text-center font-serif text-3xl font-bold tracking-tight text-[#123047]">
            Staff Operations Login
          </h2>
          <p className="mt-2 text-center text-xs text-[#123047]/65">
            Leo-Lion Club of KL Solaris · Solaris Reef Campaign Control
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-6 shadow-xl rounded-3xl border border-[#123047]/15 sm:px-10">
            <form onSubmit={handleLogin} className="space-y-5">
              
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#123047]/80">
                  Administrator Email
                </label>
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="mt-1.5 w-full px-4 py-2.5 rounded-xl border border-[#123047]/20 text-sm focus:outline-none focus:ring-2 focus:ring-[#247BA0]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#123047]/80">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="mt-1.5 w-full px-4 py-2.5 rounded-xl border border-[#123047]/20 text-sm focus:outline-none focus:ring-2 focus:ring-[#247BA0]"
                />
              </div>

              {loginError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 px-4 bg-[#123047] hover:bg-[#247BA0] text-white text-sm font-semibold rounded-xl transition-all shadow-md active:scale-[0.98] cursor-pointer"
              >
                Sign In to Dashboard
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => onNavigate('/')}
                  className="text-xs text-[#123047]/65 hover:text-[#123047] underline"
                >
                  Return to Public Campaign
                </button>
              </div>

            </form>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // AUTHENTICATED ADMIN DASHBOARD
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#FFFDF7] flex flex-col">
      
      {/* Admin Top Bar */}
      <header className="bg-[#123047] text-white sticky top-0 z-30 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-serif text-lg font-bold tracking-tight text-white">
              Solaris Reef Admin
            </span>
            <span className="text-xs bg-[#247BA0] text-white px-2 py-0.5 rounded font-mono">
              {adminUser.role.toUpperCase()}
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <span className="hidden sm:inline text-white/70">
              {adminUser.name} ({adminUser.email})
            </span>
            <button
              onClick={() => onNavigate('/')}
              className="text-[#B8E0D2] hover:text-white px-2.5 py-1.5 rounded hover:bg-white/5 transition-colors cursor-pointer"
            >
              Public Site
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 text-red-200 hover:bg-red-500 hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Admin Navigation Tabs */}
      <div className="border-b border-[#123047]/10 bg-white/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-6 overflow-x-auto py-3">
            {[
              { id: 'overview', label: 'Overview & Metrics', icon: TrendingUp },
              { id: 'campaign', label: 'Campaign Settings', icon: Settings },
              { id: 'updates', label: 'Field Updates', icon: Calendar },
              { id: 'donations', label: 'Donations Audit', icon: Heart },
              { id: 'gateway', label: 'Billplz Gateway & Webhooks', icon: Key },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 text-xs font-semibold whitespace-nowrap px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#123047] text-white shadow-xs'
                      : 'text-[#123047]/70 hover:text-[#123047] hover:bg-[#123047]/5'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* =================================================================== */}
        {/* TAB 1: OVERVIEW & ANALYTICS */}
        {/* =================================================================== */}
        {activeTab === 'overview' && campaign && (
          <div className="space-y-8">
            <div>
              <h2 className="font-serif text-2xl font-bold text-[#123047]">
                Operational Campaign Overview
              </h2>
              <p className="text-xs text-[#123047]/65 mt-0.5">
                Real-time metrics calculated strictly from verified paid Billplz transactions.
              </p>
            </div>

            {/* Metric KPI cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="p-5 bg-white rounded-2xl border border-[#123047]/15 shadow-xs">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#247BA0]">
                  Verified Funds Raised
                </span>
                <div className="font-serif text-2xl font-bold text-[#123047] mt-1 tabular-nums">
                  RM {campaign.totalRaisedRm.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] text-[#123047]/60 mt-1">
                  Goal: RM {campaign.fundraisingTargetRm.toLocaleString('en-MY')} ({campaign.percentAchieved}%)
                </div>
              </div>

              <div className="p-5 bg-white rounded-2xl border border-[#123047]/15 shadow-xs">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#426B50]">
                  Verified Donations
                </span>
                <div className="font-serif text-2xl font-bold text-[#123047] mt-1 tabular-nums">
                  {campaign.successfulDonationsCount}
                </div>
                <div className="text-[11px] text-[#123047]/60 mt-1">
                  Paid transactions
                </div>
              </div>

              <div className="p-5 bg-white rounded-2xl border border-[#123047]/15 shadow-xs">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#FF7F6A]">
                  Coral Fragments Funded
                </span>
                <div className="font-serif text-2xl font-bold text-[#123047] mt-1 tabular-nums">
                  {campaign.verifiedCoralPlantingCount}
                </div>
                <div className="text-[11px] text-[#123047]/60 mt-1">
                  Target: {campaign.coralPlantingTarget} frags
                </div>
              </div>

              <div className="p-5 bg-white rounded-2xl border border-[#123047]/15 shadow-xs">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#247BA0]">
                  Volunteer Divers
                </span>
                <div className="font-serif text-2xl font-bold text-[#123047] mt-1 tabular-nums">
                  {campaign.volunteerCount}
                </div>
                <div className="text-[11px] text-[#123047]/60 mt-1">
                  KL Solaris Youth Squad
                </div>
              </div>

              <div className="p-5 bg-white rounded-2xl border border-[#123047]/15 shadow-xs">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#123047]/70">
                  Status
                </span>
                <div className="font-serif text-2xl font-bold text-[#426B50] capitalize mt-1">
                  {campaign.campaignStatus}
                </div>
                <div className="text-[11px] text-[#123047]/60 mt-1">
                  Accepting Billplz donations
                </div>
              </div>
            </div>

            {/* Visual Progress Bar & Milestone Progress */}
            <div className="bg-white p-6 rounded-2xl border border-[#123047]/15 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-[#123047]">
                  Fundraising Progress vs. Goal
                </span>
                <span className="font-serif font-bold text-sm text-[#FF7F6A]">
                  {campaign.percentAchieved}% Completed
                </span>
              </div>
              <div className="w-full h-3 bg-[#F4E9D8] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#247BA0] to-[#FF7F6A] transition-all duration-700"
                  style={{ width: `${Math.min(100, campaign.percentAchieved)}%` }}
                />
              </div>
            </div>

            {/* Recent Audit Activities Stream */}
            <div className="bg-white p-6 rounded-2xl border border-[#123047]/15 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-serif text-base font-bold text-[#123047] flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#247BA0]" />
                  <span>Administrative Audit Trail</span>
                </h3>
                <span className="text-xs text-[#123047]/50 font-mono">Immutable Log</span>
              </div>

              <div className="divide-y divide-[#123047]/10 max-h-72 overflow-y-auto pr-2">
                {activities.map((act) => (
                  <div key={act.id} className="py-2.5 text-xs flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold text-[#123047]">
                        {act.adminName} · <span className="font-mono text-[#247BA0]">{act.action}</span>
                      </div>
                      <div className="text-[#123047]/75 mt-0.5">{act.details}</div>
                    </div>
                    <span className="text-[10px] text-[#123047]/50 shrink-0 font-mono">
                      {new Date(act.timestamp).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 2: CAMPAIGN CONFIGURATION */}
        {/* =================================================================== */}
        {activeTab === 'campaign' && campaignForm && (
          <div className="max-w-3xl bg-white p-8 rounded-3xl border border-[#123047]/15 shadow-xs">
            <h2 className="font-serif text-2xl font-bold text-[#123047] mb-1">
              Campaign Parameters & Targets
            </h2>
            <p className="text-xs text-[#123047]/65 mb-6">
              Adjust fundraising objectives, planting quotas, and active campaign state.
            </p>

            <form onSubmit={handleSaveCampaign} className="space-y-6">
              
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#123047]/80 mb-1">
                  Campaign Title
                </label>
                <input
                  type="text"
                  required
                  value={campaignForm.title}
                  onChange={(e) => setCampaignForm({ ...campaignForm, title: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#123047]/20 text-sm focus:ring-2 focus:ring-[#247BA0]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#123047]/80 mb-1">
                  Description / Ecological Mission
                </label>
                <textarea
                  rows={3}
                  required
                  value={campaignForm.description}
                  onChange={(e) => setCampaignForm({ ...campaignForm, description: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#123047]/20 text-sm focus:ring-2 focus:ring-[#247BA0]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#123047]/80 mb-1">
                    Fundraising Target (RM)
                  </label>
                  <input
                    type="number"
                    min="100"
                    step="100"
                    required
                    value={campaignForm.fundraisingTargetRm}
                    onChange={(e) => setCampaignForm({ ...campaignForm, fundraisingTargetRm: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-[#123047]/20 text-sm focus:ring-2 focus:ring-[#247BA0]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#123047]/80 mb-1">
                    Coral Fragment Target
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={campaignForm.coralPlantingTarget}
                    onChange={(e) => setCampaignForm({ ...campaignForm, coralPlantingTarget: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-[#123047]/20 text-sm focus:ring-2 focus:ring-[#247BA0]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#123047]/80 mb-1">
                    Verified Coral Planted
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={campaignForm.verifiedCoralPlantingCount}
                    onChange={(e) => setCampaignForm({ ...campaignForm, verifiedCoralPlantingCount: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-[#123047]/20 text-sm focus:ring-2 focus:ring-[#247BA0]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#123047]/80 mb-1">
                    Volunteers Enrolled
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={campaignForm.volunteerCount}
                    onChange={(e) => setCampaignForm({ ...campaignForm, volunteerCount: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-[#123047]/20 text-sm focus:ring-2 focus:ring-[#247BA0]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#123047]/80 mb-1">
                    Campaign Status
                  </label>
                  <select
                    value={campaignForm.campaignStatus}
                    onChange={(e) => setCampaignForm({ ...campaignForm, campaignStatus: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-[#123047]/20 text-sm focus:ring-2 focus:ring-[#247BA0]"
                  >
                    <option value="active">Active (Accepting Donations)</option>
                    <option value="paused">Paused</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              {campaignMsg && (
                <div
                  className={`p-3 rounded-xl text-xs ${
                    campaignMsg.startsWith('Error')
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  {campaignMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={campaignSaving}
                className="px-6 py-2.5 bg-[#123047] hover:bg-[#247BA0] active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition-all cursor-pointer"
              >
                {campaignSaving ? 'Saving Changes...' : 'Save Campaign Settings'}
              </button>

            </form>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 3: FIELD UPDATES MANAGEMENT */}
        {/* =================================================================== */}
        {activeTab === 'updates' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif text-2xl font-bold text-[#123047]">
                  Field Updates & Restoration Logs
                </h2>
                <p className="text-xs text-[#123047]/65">
                  Publish expedition updates, milestone achievements, and marine survey findings.
                </p>
              </div>

              {!isEditingUpdate && (
                <button
                  onClick={() => {
                    setIsEditingUpdate(true);
                    setEditingUpdateId(null);
                    setUpdateFormData({
                      title: '',
                      description: '',
                      category: 'milestone',
                      publicationStatus: 'published',
                      imageUrl: '/images/volunteer_divers_restoration_1792397671746.jpg',
                    });
                  }}
                  className="px-4 py-2 bg-[#FF7F6A] hover:bg-[#E66652] text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create New Update</span>
                </button>
              )}
            </div>

            {/* Update Create / Edit Form */}
            {isEditingUpdate && (
              <div className="p-6 bg-white rounded-3xl border border-[#123047]/20 shadow-md">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-serif text-lg font-bold text-[#123047]">
                    {editingUpdateId ? 'Edit Campaign Update' : 'New Campaign Update'}
                  </h3>
                  <button
                    onClick={() => setIsEditingUpdate(false)}
                    className="text-xs text-[#123047]/60 hover:text-[#123047]"
                  >
                    Cancel
                  </button>
                </div>

                <form onSubmit={handleSaveUpdate} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#123047] mb-1">Title</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 50 New Acropora Fragments Anchored at Pulau Coral"
                      value={updateFormData.title}
                      onChange={(e) => setUpdateFormData({ ...updateFormData, title: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl border border-[#123047]/20 text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#123047] mb-1">Category</label>
                      <select
                        value={updateFormData.category}
                        onChange={(e) => setUpdateFormData({ ...updateFormData, category: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-[#123047]/20 text-xs"
                      >
                        <option value="milestone">Milestone</option>
                        <option value="volunteer">Volunteer Dive</option>
                        <option value="biodiversity">Marine Biodiversity</option>
                        <option value="community">Community</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#123047] mb-1">Status</label>
                      <select
                        value={updateFormData.publicationStatus}
                        onChange={(e) => setUpdateFormData({ ...updateFormData, publicationStatus: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-[#123047]/20 text-xs"
                      >
                        <option value="published">Published</option>
                        <option value="draft">Draft (Hidden)</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-[#123047]">Image Asset / R2 Media</label>
                        <label className="text-[10px] text-[#247BA0] hover:underline cursor-pointer font-medium">
                          {uploadingImage ? 'Uploading...' : 'Upload File (R2)'}
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={handleImageFileUpload}
                            disabled={uploadingImage}
                            className="hidden"
                          />
                        </label>
                      </div>
                      <input
                        type="text"
                        placeholder="/images/... or /api/media/..."
                        value={updateFormData.imageUrl}
                        onChange={(e) => setUpdateFormData({ ...updateFormData, imageUrl: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-[#123047]/20 text-xs"
                      />
                      {uploadError && (
                        <p className="text-[10px] text-red-600 mt-1">{uploadError}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#123047] mb-1">Description</label>
                    <textarea
                      rows={3}
                      required
                      placeholder="Details of the activity, team members involved, and scientific observations..."
                      value={updateFormData.description}
                      onChange={(e) => setUpdateFormData({ ...updateFormData, description: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl border border-[#123047]/20 text-xs"
                    />
                  </div>

                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-[#123047] text-white text-xs font-semibold rounded-xl hover:bg-[#247BA0] transition-colors cursor-pointer"
                  >
                    Save & Publish Update
                  </button>
                </form>
              </div>
            )}

            {/* Updates List Table */}
            <div className="bg-white rounded-2xl border border-[#123047]/15 overflow-hidden shadow-xs">
              <div className="divide-y divide-[#123047]/10">
                {updates.map((upd) => (
                  <div key={upd.id} className="p-4 sm:p-5 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      {upd.imageUrl && (
                        <img
                          src={upd.imageUrl}
                          alt={upd.title}
                          className="w-16 h-16 rounded-xl object-cover shrink-0 border border-[#123047]/10"
                        />
                      )}
                      <div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-semibold capitalize text-[#247BA0]">{upd.category}</span>
                          <span aria-hidden="true">·</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                            upd.publicationStatus === 'published'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {upd.publicationStatus}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="text-[#123047]/50">
                            {new Date(upd.publicationDate).toLocaleDateString('en-MY')}
                          </span>
                        </div>
                        <h4 className="font-serif font-bold text-base text-[#123047] mt-1">
                          {upd.title}
                        </h4>
                        <p className="text-xs text-[#123047]/75 mt-1 line-clamp-2">
                          {upd.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          setEditingUpdateId(upd.id);
                          setUpdateFormData({
                            title: upd.title,
                            description: upd.description,
                            category: upd.category,
                            publicationStatus: upd.publicationStatus,
                            imageUrl: upd.imageUrl || '',
                          });
                          setIsEditingUpdate(true);
                        }}
                        className="p-2 text-[#123047]/70 hover:text-[#123047] hover:bg-slate-100 rounded-lg cursor-pointer"
                        title="Edit Update"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteUpdate(upd.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                        title="Delete Update"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 4: DONATIONS MANAGEMENT */}
        {/* =================================================================== */}
        {activeTab === 'donations' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-serif text-2xl font-bold text-[#123047]">
                  Donations Audit Table
                </h2>
                <p className="text-xs text-[#123047]/65">
                  Complete ledger of contributions. Note: Private donor emails are strictly confidential.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <a
                  href="/api/admin/donations/export"
                  download
                  className="px-4 py-2 bg-[#123047] hover:bg-[#247BA0] text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Export to CSV</span>
                </a>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by Reference, Donor Name, Email, or Referral..."
                  value={donationSearch}
                  onChange={(e) => {
                    setDonationSearch(e.target.value);
                    fetchDonations(donationFilter, e.target.value);
                  }}
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-[#123047]/20 text-xs bg-white focus:ring-2 focus:ring-[#247BA0]"
                />
              </div>

              <select
                value={donationFilter}
                onChange={(e) => {
                  setDonationFilter(e.target.value);
                  fetchDonations(e.target.value, donationSearch);
                }}
                className="w-full sm:w-auto px-4 py-2 rounded-xl border border-[#123047]/20 text-xs bg-white"
              >
                <option value="all">All Payment Statuses</option>
                <option value="paid">Paid (Verified)</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-[#123047]/15 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Reference</th>
                      <th className="py-3 px-4 font-semibold">Donor</th>
                      <th className="py-3 px-4 font-semibold">Donor Email</th>
                      <th className="py-3 px-4 font-semibold text-right">Amount (RM)</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold">Referral</th>
                      <th className="py-3 px-4 font-semibold">Billplz ID</th>
                      <th className="py-3 px-4 font-semibold">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {donations.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400 italic">
                          No matching donation records found.
                        </td>
                      </tr>
                    ) : (
                      donations.map((d) => (
                        <tr key={d.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 font-mono font-medium text-[#123047]">
                            {d.internalReference}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900">{d.donorName}</div>
                            <div className="text-[10px] text-slate-500 capitalize">
                              {d.attributionPreference} attribution
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                            {d.donorEmail}
                          </td>
                          <td className="py-3 px-4 text-right font-serif font-bold text-slate-900 tabular-nums">
                            RM {(d.amountSen / 100).toFixed(2)}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                                d.paymentStatus === 'paid'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : d.paymentStatus === 'pending'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {d.paymentStatus}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {d.referral ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[#247BA0]/10 text-[#247BA0]">
                                {d.referral}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono text-[10px] text-slate-500">
                            {d.billplzBillId}
                          </td>
                          <td className="py-3 px-4 text-slate-500">
                            {new Date(d.paidAt || d.createdAt).toLocaleDateString('en-MY')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 5: BILLPLZ GATEWAY & WEBHOOK SIMULATOR */}
        {/* =================================================================== */}
        {activeTab === 'gateway' && gatewayStatus && (
          <div className="space-y-8 max-w-4xl">
            <div>
              <h2 className="font-serif text-2xl font-bold text-[#123047]">
                Billplz Payment Gateway & Webhook Diagnostics
              </h2>
              <p className="text-xs text-[#123047]/65">
                Monitor API credential states, inspect webhook payloads, and test cryptographic signature verification.
              </p>
            </div>

            {/* Gateway Status Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 bg-white rounded-2xl border border-[#123047]/15">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#247BA0]">
                  Operating Mode
                </span>
                <div className="font-serif text-lg font-bold text-[#123047] mt-1">
                  {gatewayStatus.mode}
                </div>
                <div className="text-[11px] text-[#123047]/60 mt-1 font-mono">
                  {gatewayStatus.baseUrl}
                </div>
              </div>

              <div className="p-5 bg-white rounded-2xl border border-[#123047]/15">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#426B50]">
                  Collection ID
                </span>
                <div className="font-mono text-base font-bold text-[#123047] mt-1">
                  {gatewayStatus.collectionIdMasked}
                </div>
                <div className="text-[11px] text-[#123047]/60 mt-1">
                  Target Ringgit Account
                </div>
              </div>

              <div className="p-5 bg-white rounded-2xl border border-[#123047]/15">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#FF7F6A]">
                  X-Signature Key
                </span>
                <div className="font-mono text-xs font-bold text-emerald-700 mt-1">
                  HMAC-SHA256 Active
                </div>
                <div className="text-[11px] text-[#123047]/60 mt-1">
                  Strict Webhook Verification
                </div>
              </div>
            </div>

            {/* Interactive Webhook Simulator Console */}
            <div className="p-6 bg-white rounded-3xl border border-[#123047]/15 shadow-xs">
              <div className="flex items-center gap-2 mb-2">
                <Key className="w-5 h-5 text-[#247BA0]" />
                <h3 className="font-serif text-lg font-bold text-[#123047]">
                  Billplz Webhook & Idempotency Test Console
                </h3>
              </div>
              <p className="text-xs text-[#123047]/70 mb-5">
                Execute authenticated simulation scenarios against transactions to verify idempotent database updates and signature validation.
              </p>

              <form onSubmit={handleSimulateWebhook} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#123047] mb-1">
                      Target Donation Reference
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. SOL-202610-A9F4"
                      value={simReference}
                      onChange={(e) => setSimReference(e.target.value)}
                      className="w-full px-4 py-2 rounded-xl border border-[#123047]/20 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#123047] mb-1">
                      Simulation Scenario
                    </label>
                    <select
                      value={simScenario}
                      onChange={(e) => setSimScenario(e.target.value)}
                      className="w-full px-4 py-2 rounded-xl border border-[#123047]/20 text-xs"
                    >
                      <option value="success">Successful Payment (paid=true, state=paid)</option>
                      <option value="cancelled">Cancelled by User (state=deleted)</option>
                      <option value="failed">Declined / Failed (paid=false)</option>
                      <option value="invalid_signature">Invalid X-Signature Test (Tampered Key)</option>
                    </select>
                  </div>
                </div>

                {simResultMsg && (
                  <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-xs font-mono text-[#123047]">
                    {simResultMsg}
                  </div>
                )}

                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#123047] hover:bg-[#247BA0] active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Fire Simulated Webhook
                </button>
              </form>
            </div>

            {/* Recent Webhook Audit Logs */}
            <div className="bg-white rounded-2xl border border-[#123047]/15 p-6 shadow-xs">
              <h3 className="font-serif text-base font-bold text-[#123047] mb-4">
                Incoming Webhook Logs
              </h3>

              <div className="space-y-2">
                {webhookLogs.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No incoming webhooks recorded yet.</p>
                ) : (
                  webhookLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-start justify-between gap-3 font-mono"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                              log.status === 'valid'
                                ? 'bg-emerald-100 text-emerald-800'
                                : log.status === 'duplicate_ignored'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {log.status}
                          </span>
                          <span className="font-semibold text-slate-800">
                            Bill: {log.billId} ({log.internalRef})
                          </span>
                        </div>
                        <div className="text-slate-600 mt-1 text-[11px] truncate max-w-xl">
                          {log.payloadSummary}
                        </div>
                      </div>

                      <div className="text-[10px] text-slate-400 shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString('en-MY')}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )}

      </main>

    </div>
  );
};
