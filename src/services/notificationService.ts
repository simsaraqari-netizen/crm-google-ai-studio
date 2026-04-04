import { supabase } from '../lib/supabaseClient';
import { generatePropertyTitle } from '../utils';

export async function notifyFavoriteUsers(property_id: string, property: any, data: any) {
  const priceChanged = property.price !== data.price;
  const statusChanged = property.is_sold !== data.is_sold || property.statusLabel !== data.statusLabel;
  
  if (priceChanged || statusChanged) {
    // Find all users who favorited this property
    const { data: favorites, error: favError } = await supabase
      .from('favorites')
      .select('user_id')
      .eq('property_id', property_id);

    if (favError) {
      console.error("Error fetching favorites:", favError);
      return;
    }
    
    const { data: { user } } = await supabase.auth.getUser();
    const currentUserId = user?.id;

    const interestedUserIds = (favorites || []).map(f => f.user_id);
    
    for (const recipient_id of interestedUserIds) {
      if (recipient_id === currentUserId) continue; // Don't notify the updater
      
      let title = 'تحديث في عقار يهمك';
      let message = `تم تحديث بيانات العقار: ${generatePropertyTitle(property)}`;
      let type: 'price-change' | 'status-change' = 'status-change';
      
      if (priceChanged && statusChanged) {
        message = `تم تغيير السعر والحالة للعقار: ${generatePropertyTitle(property)}`;
      } else if (priceChanged) {
        type = 'price-change';
        message = `تغير السعر إلى ${data.price} للعقار: ${generatePropertyTitle(property)}`;
      } else if (statusChanged) {
        type = 'status-change';
        message = `تغيرت حالة العقار: ${generatePropertyTitle(property)}`;
      }

      await supabase.from('notifications').insert({
        type,
        title,
        message,
        recipient_id,
        user_id: currentUserId,
        property_id: property_id,
        read: false,
        createdAt: new Date().toISOString()
      });
    }
  }
}
