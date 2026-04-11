import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { UserProfile } from '../types';

export const useUsers = (isSuperAdmin: boolean, selectedCompanyId: string | null) => {
  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: ['users', isSuperAdmin, selectedCompanyId],
    queryFn: async () => {
      if (!isSuperAdmin) return [];
      let query = supabase.from('profiles').select('*');
      if (selectedCompanyId) {
        query = query.eq('company_id', selectedCompanyId);
      }
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return data as UserProfile[];
    },
    enabled: isSuperAdmin,
    staleTime: 1000 * 60 * 5,
  });

  const activeUsers = users.filter(u => !u.is_deleted && !u.isDeleted);
  const deletedUsers = users.filter(u => u.is_deleted || u.isDeleted);

  return {
    users,
    activeUsers,
    deletedUsers,
    isLoading,
    refetch
  };
};
