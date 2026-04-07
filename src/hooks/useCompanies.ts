import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { Company } from '../types';

export const useCompanies = (isSuperAdmin: boolean) => {
  const { data: companies = [], isLoading, refetch } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      if (!isSuperAdmin) return [];
      const { data, error } = await supabase.from('companies').select('*');
      if (error) throw error;
      return data as Company[];
    },
    enabled: isSuperAdmin,
    staleTime: 1000 * 60 * 10,
  });

  const activeCompanies = companies.filter(c => !c.isDeleted);
  const deletedCompanies = companies.filter(c => c.isDeleted);

  return {
    companies,
    activeCompanies,
    deletedCompanies,
    isLoading,
    refetch
  };
};
