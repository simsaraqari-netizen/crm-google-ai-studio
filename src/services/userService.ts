import { supabase } from '../lib/supabaseClient';
import { UserProfile } from '../types';
import { unifyAbuName } from '../utils';

export const userService = {
  async getUsers(isSuperAdmin: boolean, selectedCompanyId: string | null, userCompanyId: string | undefined): Promise<UserProfile[]> {
    let query = supabase.from('profiles').select('*');
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

  async updateUser(uid: string, updates: Partial<UserProfile>): Promise<void> {
    const unifiedUpdates = { ...updates };
    if (unifiedUpdates.name) unifiedUpdates.name = unifyAbuName(unifiedUpdates.name);
    if (unifiedUpdates.full_name) unifiedUpdates.full_name = unifyAbuName(unifiedUpdates.full_name);
    
    const { error } = await supabase.from('profiles').update(unifiedUpdates).eq('id', uid);
    if (error) throw error;
  },

  async deleteUser(uid: string): Promise<void> {
    const { error } = await supabase.from('profiles').delete().eq('id', uid);
    if (error) throw error;
  },

  async softDeleteUser(uid: string, deletedAt: string): Promise<void> {
    const { error } = await supabase.from('profiles').update({ is_deleted: true, deleted_at: deletedAt }).eq('id', uid);
    if (error) throw error;
  },

  async restoreUser(uid: string, newName: string, newFullName: string): Promise<void> {
    const { error } = await supabase.from('profiles').update({ 
      is_deleted: false, 
      deleted_at: null,
      name: unifyAbuName(newName), 
      full_name: unifyAbuName(newFullName) 
    }).eq('id', uid);
    if (error) throw error;
  }
};
