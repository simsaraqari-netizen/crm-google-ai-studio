import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { Notification } from '../types';
import { useEffect, useState } from 'react';

export const useNotifications = (user: any, isSuperAdmin: boolean) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const fetchNotifications = async () => {
    if (!user?.id) return;
    let query = supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50);
    if (!isSuperAdmin) {
      if (user.role === 'admin') {
        query = query.eq('company_id', user.company_id);
      } else {
        query = query.eq('recipient_id', user.id);
      }
    }
    const { data, error } = await query;
    if (data) setNotifications(data as Notification[]);
  };

  useEffect(() => {
    if (!user?.id) return;
    fetchNotifications();
    
    const channel = supabase.channel(`notifications-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}` }, () => {
        fetchNotifications();
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, isSuperAdmin]);

  return {
    notifications,
    refetch: fetchNotifications
  };
};
