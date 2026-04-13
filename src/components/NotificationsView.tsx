import React from 'react';
import { motion } from 'motion';
import { ChevronRight, Bell, UserPlus, Tag, LayoutList, MessageSquare } from 'lucide-react';
import { formatRelativeDate } from '../utils';
import { Notification, Property } from '../types';
import { supabase } from '../lib/supabaseClient';

interface NotificationsViewProps {
  notifications: Notification[];
  properties: Property[];
  setView: (view: any) => void;
  setSelectedProperty: (property: Property | null) => void;
  isAdmin: boolean;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  notifications,
  properties,
  setView,
  setSelectedProperty,
  isAdmin,
}) => {
  if (!isAdmin) return null;

  const markAllAsRead = async () => {
    const unread = (notifications || []).filter(n => !n.read);
    for (const n of unread) {
      await supabase.from('notifications').update({ read: true }).eq('id', n.id);
    }
  };

  const handleNotificationClick = async (n: Notification) => {
    if (!n.read) {
      await supabase.from('notifications').update({ read: true }).eq('id', n.id);
    }
    
    if (n.type === 'new-user') {
      setView('manage-marketers');
    } else if (n.propertyId) {
      const prop = properties.find(p => p.id === n.propertyId);
      if (prop) {
        setSelectedProperty(prop);
        setView('details');
      }
    }
  };

  return (
    <motion.div 
      key="notifications-view"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6 w-full"
    >
      <div className="bg-white p-6 border-b border-stone-200 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setView('list')}
              className="p-2 hover:bg-stone-100/50 rounded-full transition-all text-stone-500 ios-glass"
            >
              <ChevronRight size={24} />
            </button>
            <h2 className="text-2xl font-bold tracking-tight">الإشعارات</h2>
          </div>
          <button 
            onClick={markAllAsRead}
            className="text-sm text-emerald-600 font-bold hover:underline"
          >
            تحديد الكل كمقروء
          </button>
        </div>

        <div className="space-y-2">
          {notifications.length > 0 ? (
            notifications.map(n => (
              <div 
                key={n.id} 
                className={`p-4 rounded-xl border border-stone-100 hover:bg-stone-50 transition-colors cursor-pointer ${!n.read ? 'bg-emerald-50/30' : ''}`}
                onClick={() => handleNotificationClick(n)}
              >
                <div className="flex gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    n.type === 'new-user' ? 'bg-blue-100 text-blue-600' : 
                    n.type === 'price-change' ? 'bg-amber-100 text-amber-600' :
                    n.type === 'status-change' ? 'bg-purple-100 text-purple-600' :
                    n.type === 'new-comment' ? 'bg-emerald-100 text-emerald-600' :
                    'bg-stone-100 text-stone-600'
                  }`}>
                    {n.type === 'new-user' ? <UserPlus size={20} /> : 
                     n.type === 'price-change' ? <Tag size={20} /> :
                     n.type === 'status-change' ? <LayoutList size={20} /> :
                     n.type === 'new-comment' ? <MessageSquare size={20} /> :
                     <Bell size={20} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-stone-900">{n.title}</p>
                    <p className="text-sm text-stone-500 mt-1">{n.message}</p>
                    <p className="text-xs text-stone-500 mt-2">{formatRelativeDate(n.createdAt)}</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-12 text-center text-stone-500">
              <Bell size={48} className="mx-auto mb-4 opacity-20" />
              <p>لا توجد إشعارات حالياً</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
