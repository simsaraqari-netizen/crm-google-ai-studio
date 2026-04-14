import * as React from 'react';
import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { SUPER_ADMIN_EMAILS } from '../constants';
import { UserProfile } from '../types';
import { toast } from 'react-hot-toast';
import { unifyAbuName } from '../utils';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  authError: string;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isPending: boolean;
  selectedCompanyId: string | null;
  setSelectedCompanyId: (id: string | null) => void;
  handleLogout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const lastProcessedSessionId = useRef<string | null>(null);

  const isSuperAdmin = user?.role === 'super_admin' || 
    (!!user?.email && SUPER_ADMIN_EMAILS.includes(user.email));
  const isAdmin = user?.role === 'admin' || isSuperAdmin;
  const isPending = user?.role === 'pending';

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data: userData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (error) throw error;
      return userData;
    } catch (err: any) {
      console.error("Error fetching user profile:", err);
      throw err;
    }
  };

  const handleSession = async (session: any) => {
    if (session?.user?.id === lastProcessedSessionId.current && user) {
      setLoading(false);
      return;
    }
    lastProcessedSessionId.current = session?.user?.id || null;

    if (!session) {
      setUser(null);
      setSelectedCompanyId(null);
      setLoading(false);
      return;
    }

    const sbUser = session.user;
    try {
      let userData = await fetchUserProfile(sbUser.id);

      if (userData) {
        if (userData.force_sign_out) {
          await supabase.from('profiles').update({ force_sign_out: false }).eq('id', sbUser.id);
          setAuthError('تم تسجيل خروجك من قبل المسؤول.');
          await supabase.auth.signOut();
          setUser(null);
          return;
        }
        if (userData.role === 'rejected') {
          setAuthError('تم رفض حسابك من قبل الإدارة.');
          await supabase.auth.signOut();
          setUser(null);
          return;
        }
        if (userData.is_deleted) {
          setAuthError('هذا الحساب تم حذفه من قبل الإدارة.');
          await supabase.auth.signOut();
          setUser(null);
          return;
        }

        if (SUPER_ADMIN_EMAILS.includes(sbUser.email || '') && userData.role !== 'super_admin') {
          const updates: any = { role: 'super_admin' };
          
          // Special handling for the main admin account
          if (sbUser.email === 'admin@musadaqa.com') {
            updates.full_name = unifyAbuName('ابو ادم');
            updates.name = unifyAbuName('ابو ادم');
            updates.phone = '65814909';
          }
          
          await supabase.from('profiles').update(updates).eq('id', sbUser.id);
          Object.assign(userData, updates);
          // Ensure details are up to date for this specific user even if already super_admin
          const profileUpdates = { full_name: unifyAbuName('ابو ادم'), name: unifyAbuName('ابو ادم'), phone: '65814909' };
          await supabase.from('profiles').update(profileUpdates).eq('id', sbUser.id);
          Object.assign(userData, profileUpdates);
        }
        setUser(userData as UserProfile);
        if (userData.company_id) setSelectedCompanyId(userData.company_id);
      } else {
        const isSuper = SUPER_ADMIN_EMAILS.includes(sbUser.email || '');
        const isAdminAccount = sbUser.email === 'admin@musadaqa.com';
        
        const newProfile = {
          id: sbUser.id,
          email: sbUser.email || '',
          full_name: isAdminAccount ? unifyAbuName('ابو ادم') : unifyAbuName(sbUser.user_metadata?.full_name || sbUser.email?.split('@')[0] || 'User'),
          name: isAdminAccount ? unifyAbuName('ابو ادم') : unifyAbuName(sbUser.user_metadata?.full_name || sbUser.email?.split('@')[0] || 'User'),
          phone: isAdminAccount ? '65814909' : '',
          role: isSuper ? 'super_admin' : 'pending',
          created_at: new Date().toISOString()
        };
        const { error: insertError } = await supabase.from('profiles').insert(newProfile);
        if (insertError) throw insertError;

        if (!isSuper) {
          await supabase.from('notifications').insert({
            type: 'new-user',
            title: 'طلب انضمام جديد',
            message: `الموظف ${newProfile.name} يطلب الانضمام للنظام`,
            user_id: sbUser.id,
            read: false
          });
        }
        setUser(newProfile as unknown as UserProfile);
      }
    } catch (err: any) {
      setAuthError(`خطأ في الوصول لقاعدة البيانات: ${err.message}`);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) handleSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) handleSession(session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSelectedCompanyId(null);
      lastProcessedSessionId.current = null;
      toast.success('تم تسجيل الخروج بنجاح');
    } catch (err: any) {
      toast.error('حدث خطأ أثناء تسجيل الخروج');
    }
  };

  const refreshUser = async () => {
    if (user?.id) {
      const updatedProfile = await fetchUserProfile(user.id);
      if (updatedProfile) {
        setUser(updatedProfile as UserProfile);
      }
    }
  };

  return (
    <AuthContext.Provider value={{
      user, loading, authError, isSuperAdmin, isAdmin, isPending,
      selectedCompanyId, setSelectedCompanyId, handleLogout, refreshUser
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
