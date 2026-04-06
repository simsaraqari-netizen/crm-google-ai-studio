import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { Property } from '../types';

export const useProperties = (companyId?: string | null) => {
  return useQuery({
    queryKey: ['properties', companyId],
    queryFn: async () => {
      let allData: any[] = [];
      let from = 0;
      const step = 1000;
      let fetchMore = true;

      while (fetchMore) {
        let query = supabase.from('properties').select('*');
        
        if (companyId) {
          query = query.eq('company_id', companyId);
        }

        const { data, error } = await query
          .order('created_at', { ascending: false })
          .range(from, from + step - 1);
        
        if (error) throw error;

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          if (data.length < step) {
            fetchMore = false;
          } else {
            from += step;
          }
        } else {
          fetchMore = false;
        }
      }

      return allData.map(p => ({
        ...p,
        location: p.location === 'شارع واحد | سد' ? 'شارع واحد' : p.location
      })) as Property[];
    },
    enabled: true, // Always fetch if possible, or filter by companyId
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};
