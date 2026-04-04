import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { UserProfile } from '../types';
import { SUPER_ADMIN_EMAILS, SUPER_ADMIN_PHONES } from '../constants';

export const useAuth = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  useEffect(() => {
    const initAuth = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const supabaseUser = session.user;
          const { data: userDoc, error } = await supabase.from('user_profiles').select('*').eq('id', supabaseUser.id).maybeSingle();
          
          let userData: UserProfile;
          if (userDoc) {
            userData = userDoc as UserProfile;
            if (userData.is_deleted) {
              setAuthError('هذا الحساب تم حذفه من قبل الإدارة.');
              await supabase.auth.signOut();
              return;
            }
            if (userData.force_sign_out) {
              await supabase.from('user_profiles').update({ force_sign_out: false }).eq('id', supabaseUser.id);
              setAuthError('تم تسجيل خروجك من قبل المسؤول.');
              await supabase.auth.signOut();
              return;
            }
            if (userData.role === 'rejected') {
              setAuthError('تم رفض حسابك من قبل الإدارة.');
              await supabase.auth.signOut();
              return;
            }
            const isSuper = (supabaseUser.email && SUPER_ADMIN_EMAILS.includes(supabaseUser.email)) || 
                          (userData.phone && SUPER_ADMIN_PHONES.includes(userData.phone));
            if (isSuper && userData.role !== 'super_admin') {
              userData.role = 'super_admin';
              await supabase.from('user_profiles').update({ role: 'super_admin' }).eq('id', supabaseUser.id);
            }
          } else {
            const { data: userByEmail } = await supabase.from('user_profiles').select('*').eq('email', supabaseUser.email).maybeSingle();
            if (userByEmail) {
              userData = { ...userByEmail } as UserProfile;
            } else {
              const isSuper = (supabaseUser.email && SUPER_ADMIN_EMAILS.includes(supabaseUser.email)) || 
                            (supabaseUser.user_metadata?.phone && SUPER_ADMIN_PHONES.includes(supabaseUser.user_metadata.phone));
              const role = isSuper ? 'super_admin' : 'pending';
              userData = {
                id: supabaseUser.id,
                email: supabaseUser.email || '',
                display_name: supabaseUser.user_metadata?.full_name || 'User',
                full_name: supabaseUser.user_metadata?.full_name || 'User',
                role: role,
                created_at: new Date().toISOString()
              };
              const { data: insertedData } = await supabase.from('user_profiles').insert(userData).select().single();
              if (insertedData) userData = insertedData as UserProfile;
            }
          }
          setUser(userData);
          if (userData.company_id) setSelectedCompanyId(userData.company_id);
        }
      } catch (error: any) {
        console.error("Auth initialization error:", error);
        setAuthError(`خطأ في الوصول لقاعدة البيانات: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) {
        setUser(null);
        setSelectedCompanyId(null);
        setLoading(false);
        return;
      }
      // Re-init if session changes
      initAuth();
    });

    return () => subscription.unsubscribe();
  }, []);

  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = user?.role === 'admin' || isSuperAdmin;
  const isPending = user?.role === 'pending';

  return {
    user,
    setUser,
    loading,
    setLoading,
    authError,
    setAuthError,
    selectedCompanyId,
    setSelectedCompanyId,
    isSuperAdmin,
    isAdmin,
    isPending
  };
};
