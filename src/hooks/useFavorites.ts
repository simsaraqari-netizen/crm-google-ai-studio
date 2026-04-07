import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useEffect, useState } from 'react';

export const useFavorites = (user: any) => {
  const [favorites, setFavorites] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const fetchFavorites = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.from('favorites').select('propertyId').eq('userId', user.uid);
      if (data) setFavorites(data.map(d => d.propertyId));
    } catch (error) {
      console.error("Favorites fetch error:", error);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchFavorites();
  }, [user]);

  const toggleFavorite = async (propertyId: string) => {
    if (!user) return;
    const isFavorite = favorites.includes(propertyId);
    if (isFavorite) {
      const { error } = await supabase.from('favorites').delete().eq('userId', user.uid).eq('propertyId', propertyId);
      if (!error) setFavorites(prev => prev.filter(id => id !== propertyId));
    } else {
      const { error } = await supabase.from('favorites').insert({ userId: user.uid, propertyId });
      if (!error) setFavorites(prev => [...prev, propertyId]);
    }
  };

  return {
    favorites,
    toggleFavorite,
    refetch: fetchFavorites
  };
};
