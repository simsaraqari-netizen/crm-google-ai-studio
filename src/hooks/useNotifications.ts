import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { Notification } from '../types';
import { useEffect, useState } from 'react';

export const useNotifications = (user: any, isSuperAdmin: boolean) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const fetchNotifications = async () => {
    if (!user) return;
    let query = supabase.from('notifications').select('*').order('createdAt', { ascending: false }).limit(50);
    if (!isSuperAdmin) {
      if (user.role === 'admin') {
        query = query.eq('companyId', user.companyId);
      } else {
        query = query.eq('recipientId', user.uid);
      }
    }
    const { data, error } = await query;
    if (data) setNotifications(data as Notification[]);
  };

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    
    const channel = supabase.channel(`notifications-${user?.uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `recipientId=eq.${user?.uid}` }, () => {
        fetchNotifications();
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isSuperAdmin]);

  return {
    notifications,
    refetch: fetchNotifications
  };
};
