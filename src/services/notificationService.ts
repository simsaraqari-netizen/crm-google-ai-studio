import { supabase } from '../lib/supabaseClient';
import { generatePropertyTitle } from '../utils';

// Fire-and-forget — never blocks the form save
export function notifyFavoriteUsers(propertyId: string, property: any, data: any) {
  const priceChanged = property.price !== data.price;
  const statusChanged = property.is_sold !== data.is_sold || property.status_label !== data.status_label;

  if (!priceChanged && !statusChanged) return;

  // Run async without blocking
  (async () => {
    try {
      const { data: favorites } = await supabase
        .from('favorites')
        .select('user_id')
        .eq('property_id', propertyId);

      if (!favorites?.length) return;

      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id;

      let type: 'price-change' | 'status-change' = priceChanged ? 'price-change' : 'status-change';
      let message = priceChanged
        ? `تغير السعر إلى ${data.price} للعقار: ${generatePropertyTitle(property)}`
        : `تغيرت حالة العقار: ${generatePropertyTitle(property)}`;

      const inserts = favorites
        .filter(f => f.user_id !== currentUserId)
        .map(f => ({
          type,
          title: 'تحديث في عقار يهمك',
          message,
          recipient_id: f.user_id,
          user_id: currentUserId,
          property_id: propertyId,
          read: false,
          created_at: new Date().toISOString()
        }));

      if (inserts.length) await supabase.from('notifications').insert(inserts);
    } catch (err) {
      console.error('notifyFavoriteUsers error:', err);
    }
  })();
}
