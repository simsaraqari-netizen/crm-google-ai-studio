import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { Comment } from '../types';

export const useDeletedComments = (isAdmin: boolean) => {
  const { data: deletedComments = [], isLoading, refetch } = useQuery({
    queryKey: ['deletedComments'],
    queryFn: async () => {
      if (!isAdmin) return [];
      const { data, error } = await supabase.from('comments').select('*').eq('isDeleted', true);
      if (error) throw error;
      return data as Comment[];
    },
    enabled: isAdmin,
    staleTime: 1000 * 60 * 5,
  });

  return {
    deletedComments,
    isLoading,
    refetch
  };
};
