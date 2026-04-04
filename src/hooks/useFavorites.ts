import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useEffect, useState } from 'react';

export const useFavorites = (user: any) => {
  const [favorites, setFavorites] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const fetchFavorites = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase.from('favorites').select('property_id').eq('user_id', user.id);
      if (data) setFavorites(data.map(d => d.property_id));
    } catch (error) {
      console.error("Favorites fetch error:", error);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    fetchFavorites();
  }, [user?.id]);

  const toggleFavorite = async (property_id: string) => {
    if (!user?.id) return;
    const isFavorite = favorites.includes(property_id);
    if (isFavorite) {
      const { error } = await supabase.from('favorites').delete().eq('user_id', user.id).eq('property_id', property_id);
      if (!error) setFavorites(prev => prev.filter(id => id !== property_id));
    } else {
      const { error } = await supabase.from('favorites').insert({ user_id: user.id, property_id: property_id });
      if (!error) setFavorites(prev => [...prev, property_id]);
    }
  };

  return {
    favorites,
    toggleFavorite,
    refetch: fetchFavorites
  };
};
