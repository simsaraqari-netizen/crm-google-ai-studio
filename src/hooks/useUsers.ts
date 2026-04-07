import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { UserProfile } from '../types';

export const useUsers = (isSuperAdmin: boolean, selectedCompanyId: string | null) => {
  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: ['users', isSuperAdmin, selectedCompanyId],
    queryFn: async () => {
      if (!isSuperAdmin) return [];
      let query = supabase.from('users').select('*');
      if (selectedCompanyId) {
        query = query.eq('companyId', selectedCompanyId);
      }
      const { data, error } = await query.order('createdAt', { ascending: false });
      if (error) throw error;
      return data as UserProfile[];
    },
    enabled: isSuperAdmin,
    staleTime: 1000 * 60 * 5,
  });

  const activeUsers = users.filter(u => !u.isDeleted);
  const deletedUsers = users.filter(u => u.isDeleted);

  return {
    users,
    activeUsers,
    deletedUsers,
    isLoading,
    refetch
  };
};
