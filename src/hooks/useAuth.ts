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
          const { data: userDoc, error } = await supabase.from('users').select('*').eq('uid', supabaseUser.id).maybeSingle();
          
          let userData: UserProfile;
          if (userDoc) {
            userData = userDoc as UserProfile;
            if (userData.isDeleted) {
              setAuthError('هذا الحساب تم حذفه من قبل الإدارة.');
              await supabase.auth.signOut();
              return;
            }
            if (userData.forceSignOut) {
              await supabase.from('users').update({ forceSignOut: false }).eq('uid', supabaseUser.id);
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
              await supabase.from('users').update({ role: 'super_admin' }).eq('uid', supabaseUser.id);
            }
          } else {
            const { data: userByEmail } = await supabase.from('users').select('*').eq('email', supabaseUser.email).maybeSingle();
            if (userByEmail) {
              await supabase.from('users').update({ uid: supabaseUser.id }).eq('id', userByEmail.id);
              userData = { ...userByEmail, uid: supabaseUser.id } as UserProfile;
            } else {
              const isSuper = (supabaseUser.email && SUPER_ADMIN_EMAILS.includes(supabaseUser.email)) || 
                            (supabaseUser.user_metadata?.phone && SUPER_ADMIN_PHONES.includes(supabaseUser.user_metadata.phone));
              const role = isSuper ? 'super_admin' : 'pending';
              userData = {
                uid: supabaseUser.id,
                email: supabaseUser.email || '',
                full_name: supabaseUser.user_metadata?.full_name || 'User',
                role: role,
                createdAt: new Date().toISOString()
              };
              const { data: insertedData } = await supabase.from('users').insert(userData).select().single();
              if (insertedData) userData = insertedData as UserProfile;
            }
          }
          setUser(userData);
          if (userData.companyId) setSelectedCompanyId(userData.companyId);
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
