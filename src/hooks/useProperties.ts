import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { Property, FilterOptions } from '../types';
import { useState, useCallback, useMemo } from 'react';

export const useProperties = (user: any, isSuperAdmin: boolean, selectedCompanyId: string | null, filters: FilterOptions, debouncedSearchQuery: string, view: string) => {
  const [visibleCount, setVisibleCount] = useState(20);
  const [hasMore, setHasMore] = useState(true);
  const queryClient = useQueryClient();

  const { data: queryProperties, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['properties', user?.uid, isSuperAdmin, selectedCompanyId, filters, debouncedSearchQuery, view, visibleCount],
    queryFn: async () => {
      if (!user) return [];
      
      let query = supabase.from('properties').select('*', { count: 'exact' });
      
      if (isSuperAdmin) {
        if (selectedCompanyId) {
          query = query.eq('companyId', selectedCompanyId);
        }
      } else if (user.companyId) {
        query = query.eq('companyId', user.companyId);
      } else {
        return [];
      }

      // Server-side filtering
      if (view === 'my-listings') query = query.eq('createdBy', user.uid);
      if (view === 'pending-properties') query = query.eq('status', 'pending');
      if (view === 'trash') {
        query = query.or('status.eq.deleted,isDeleted.eq.true');
      } else {
        query = query.neq('status', 'deleted').eq('isDeleted', false);
      }

      if (filters.status === 'sold') query = query.eq('isSold', true);
      if (filters.status === 'available') query = query.eq('isSold', false);
      if (filters.governorate) query = query.eq('governorate', filters.governorate);
      if (filters.type) query = query.eq('type', filters.type);
      if (filters.purpose) query = query.eq('purpose', filters.purpose);

      if (debouncedSearchQuery) {
        const search = debouncedSearchQuery.trim();
        query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,area.ilike.%${search}%`);
      }
      
      const { data, error, count } = await query.order('createdAt', { ascending: false }).range(0, visibleCount - 1);
      if (error) throw error;
      
      if (count !== null) {
        setHasMore(data.length < count);
      }
      
      const formatted = (data || []).map(p => ({
        ...p,
        location: p.location === 'شارع واحد | سد' ? 'شارع واحد' : p.location
      })) as Property[];
      
      return formatted;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  const loadMore = useCallback(() => {
    setVisibleCount(prev => prev + 20);
  }, []);

  return {
    properties: queryProperties || [],
    isLoading,
    isFetching,
    refetch,
    hasMore,
    loadMore,
    visibleCount,
    setVisibleCount
  };
};

export function useDeletedProperties(isAdmin: boolean, companyId?: string | null) {
  return useQuery({
    queryKey: ['deletedProperties', companyId],
    queryFn: async () => {
      let query = supabase.from('properties').select('*').eq('isDeleted', true);
      if (companyId) {
        query = query.eq('companyId', companyId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as Property[];
    },
    enabled: isAdmin,
    staleTime: 1000 * 60 * 5,
  });
}
