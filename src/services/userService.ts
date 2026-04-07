import { supabase } from '../lib/supabaseClient';
import { UserProfile } from '../types';

export const userService = {
  async getUsers(isSuperAdmin: boolean, selectedCompanyId: string | null, userCompanyId: string | undefined): Promise<UserProfile[]> {
    let query = supabase.from('users').select('*');
    if (isSuperAdmin) {
      if (selectedCompanyId) {
        query = query.eq('companyId', selectedCompanyId);
      }
    } else {
      query = query.eq('companyId', userCompanyId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async updateUser(uid: string, updates: Partial<UserProfile>): Promise<void> {
    const { error } = await supabase.from('users').update(updates).eq('uid', uid);
    if (error) throw error;
  },

  async deleteUser(uid: string): Promise<void> {
    const { error } = await supabase.from('users').delete().eq('uid', uid);
    if (error) throw error;
  },

  async softDeleteUser(uid: string, deletedAt: string): Promise<void> {
    const { error } = await supabase.from('users').update({ isDeleted: true, deletedAt }).eq('uid', uid);
    if (error) throw error;
  },

  async restoreUser(uid: string): Promise<void> {
    const { error } = await supabase.from('users').update({ isDeleted: false, deletedAt: null }).eq('uid', uid);
    if (error) throw error;
  }
};
