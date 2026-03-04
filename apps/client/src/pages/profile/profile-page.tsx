import { useNavigate } from 'react-router-dom';
import { User as UserIcon, Gift, ChevronRight, CreditCard, Settings, LogOut, ShieldAlert } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useSessionStore } from '@/features/auth/store';
import { useProfile, useDeleteAccount } from '@/features/profile/api/use-profile';
import { useLoyalty } from '@/features/profile/api/use-loyalty';
import { useConfirmation } from '@/components/ui/confirmation';
import { Button } from '@/components/ui/button';

export default function ProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, clearSession } = useSessionStore();
  const { confirm } = useConfirmation();

  const { data: profile, isLoading } = useProfile();
  const { data: loyaltyData } = useLoyalty();
  const loyalty = loyaltyData?.data;
  const deleteAccount = useDeleteAccount();

  const handleDeleteAccount = async () => {
    const ok = await confirm({
      title: 'Delete Your Account?',
      description: 'This action is permanent and cannot be undone. All your data will be anonymized and your account deactivated.',
      confirmLabel: 'Delete Account',
      cancelLabel: 'Keep Account',
      variant: 'danger',
    });
    if (!ok) return;
    deleteAccount.mutate(undefined, {
      onSuccess: () => navigate('/login'),
      onError: (err: Error) => alert(err.message || 'Failed to delete account'),
    });
  };

  const handleLogout = () => {
    clearSession();
    queryClient.clear();
    navigate('/login');
  };

  if (!user) {
    return (
      <div className="flex flex-col min-h-full bg-slate-50 pt-20 px-6 pb-6 text-center">
        <div className="w-20 h-20 bg-slate-200 rounded-full mx-auto mb-6 flex items-center justify-center">
          <UserIcon className="w-10 h-10 text-slate-400" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Your Profile</h1>
        <p className="text-slate-500 mt-2">Sign in to manage your account, view history, and collect loyalty points.</p>
        <Button className="mt-8 rounded-xl h-12 text-md font-semibold" onClick={() => navigate('/login')}>
          Sign In / Register
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full bg-slate-50 pb-24">
      
      {/* Header Profile Tag */}
      <div className="bg-primary px-6 pt-16 pb-8 shadow-md rounded-b-[40px] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="relative z-10 flex items-center gap-5">
          <div className="w-20 h-20 bg-white/20 rounded-full border-2 border-primary-foreground/30 flex items-center justify-center text-primary-foreground shrink-0 backdrop-blur-sm">
            <span className="text-3xl font-bold uppercase">
              {profile ? profile.firstName[0] : <UserIcon className="w-8 h-8" />}
            </span>
          </div>
          <div className="flex-1 text-primary-foreground">
            {isLoading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-6 w-32 bg-white/20 rounded"></div>
                <div className="h-4 w-48 bg-white/20 rounded"></div>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold tracking-tight">{profile?.firstName} {profile?.lastName}</h1>
                <p className="text-primary-foreground/80 text-sm mt-0.5">{profile?.email}</p>
                <div className="inline-flex mt-2 bg-white/20 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-widest uppercase">
                  {loyalty?.tier ?? "Member"} Tier
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Profile Settings Options */}
      <div className="flex-1 p-6 space-y-6 -mt-4 relative z-20">
        
        {/* Loyalty Quick Box */}
        <button
          onClick={() => navigate('/loyalty')}
          className="w-full bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-center justify-between hover:bg-slate-50 transition-colors text-left"
        >
          <div>
            <div className="flex items-center gap-2 text-slate-500 text-sm font-semibold mb-1">
              <Gift className="w-4 h-4 text-amber-500" /> Loyalty Points
            </div>
            <div className="text-2xl font-black text-slate-900">{loyalty?.pointsBalance?.toLocaleString() ?? "—"} <span className="text-sm font-medium text-slate-400">pts</span></div>
          </div>
          <div className="rounded-xl h-10 w-10 p-0 flex items-center justify-center">
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </div>
        </button>

        {/* Action Menu List */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-100">
          <button 
            onClick={() => navigate('/profile/edit')}
            className="w-full flex items-center p-4 hover:bg-slate-50 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
              <UserIcon className="w-5 h-5" />
            </div>
            <div className="flex-1 px-4 font-semibold text-slate-700">Personal Details</div>
            <ChevronRight className="w-5 h-5 text-slate-300" />
          </button>
          <div className="w-full flex items-center p-4 opacity-60 cursor-default">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
              <CreditCard className="w-5 h-5" />
            </div>
            <div className="flex-1 px-4">
              <span className="font-semibold text-slate-500">Payment Methods</span>
              <span className="ml-2 text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded">Coming Soon</span>
            </div>
          </div>
          <button 
            onClick={() => navigate('/settings/notifications')}
            className="w-full flex items-center p-4 hover:bg-slate-50 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
              <Settings className="w-5 h-5" />
            </div>
            <div className="flex-1 px-4 font-semibold text-slate-700">Notification Settings</div>
            <ChevronRight className="w-5 h-5 text-slate-300" />
          </button>
        </div>

        {/* Danger Zone */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-100">
          <button onClick={handleLogout} className="w-full flex items-center p-4 hover:bg-slate-50 transition-colors text-left">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500 shrink-0">
              <LogOut className="w-5 h-5" />
            </div>
            <div className="flex-1 px-4 font-semibold text-red-600">Sign Out</div>
          </button>
          
          <button
            type="button"
            onClick={handleDeleteAccount}
            disabled={deleteAccount.isPending}
            className="w-full flex items-center p-4 hover:bg-slate-50 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="flex-1 px-4 font-semibold text-slate-500">
              {deleteAccount.isPending ? 'Deleting…' : 'Delete Account'}
            </div>
            <ChevronRight className="w-5 h-5 text-slate-300" />
          </button>
        </div>

      </div>
    </div>
  );
}
