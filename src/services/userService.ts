import { supabase } from '../lib/supabaseClient';
import { UserProfile } from '../types';

export const userService = {
  async getUsers(isSuperAdmin: boolean, selectedCompanyId: string | null, userCompanyId: string | undefined): Promise<UserProfile[]> {
    let query = supabase.from('user_profiles').select('*');
    if (isSuperAdmin) {
      if (selectedCompanyId) {
        query = query.eq('company_id', selectedCompanyId);
      }
    } else {
      query = query.eq('company_id', userCompanyId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async updateUser(id: string, updates: Partial<UserProfile>): Promise<void> {
    const { error } = await supabase.from('user_profiles').update(updates).eq('id', id);
    if (error) throw error;
  },

  async deleteUser(id: string): Promise<void> {
    const { error } = await supabase.from('user_profiles').delete().eq('id', id);
    if (error) throw error;
  },

  async softDeleteUser(id: string, deleted_at: string): Promise<void> {
    const { error } = await supabase.from('user_profiles').update({ is_deleted: true, deleted_at }).eq('id', id);
    if (error) throw error;
  },

  async restoreUser(id: string): Promise<void> {
    const { error } = await supabase.from('user_profiles').update({ is_deleted: false, deleted_at: null }).eq('id', id);
    if (error) throw error;
  }
};
