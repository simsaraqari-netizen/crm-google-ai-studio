import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { Company } from '../types';

export const useCompanies = () => {
  return useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as Company[];
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });
};
