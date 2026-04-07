import cron from 'node-cron';
import { createClient } from '@supabase/supabase-js';
import { readSheet, writeToSheet } from './googleSheetsService.ts';
import { cleanAreaName, inferGovernorate, inferPurpose, inferType } from '../utils.ts';
import { syncSupabaseWithSheets } from './syncService.ts';
import { AREAS } from '../constants.ts';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export const initializeCronJobs = () => {
  // Run daily at 03:00 server time.
  cron.schedule('0 3 * * *', async () => {
    try {
      await syncSupabaseWithSheets();
    } catch (e: any) {
      console.error('[CRON] Error during synchronization:', e);
    }
  });

  // ---------------------------------------------------------
  // 30-DAY PROPERTY CLEANUP JOB
  // Runs daily at 2:00 AM '0 2 * * *'
  // ---------------------------------------------------------
  cron.schedule('0 2 * * *', async () => {
    console.log('[CRON] Starting 30-day deleted property cleanup...');
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    try {
      // 1. Fetch properties marked as deleted more than 30 days ago
      const { data: propertiesToDelete, error: fetchError } = await supabaseAdmin
        .from('properties')
        .select('id, images')
        .eq('status', 'deleted')
        .lt('deleted_at', thirtyDaysAgo);

      if (fetchError) throw fetchError;

      if (propertiesToDelete && propertiesToDelete.length > 0) {
        console.log(`[CRON] Found ${propertiesToDelete.length} properties to permanently delete.`);

        for (const prop of propertiesToDelete) {
          // A. Delete images from storage if they exist
          if (prop.images && prop.images.length > 0) {
            const imagePaths = prop.images
              .map((url: string) => {
                const parts = url.split('/storage/v1/object/public/properties_media/');
                return parts.length > 1 ? parts[1] : null;
              })
              .filter(Boolean) as string[];

            if (imagePaths.length > 0) {
              const { error: storageError } = await supabaseAdmin.storage
                .from('properties_media')
                .remove(imagePaths);
              
              if (storageError) {
                console.error(`[CRON] Error deleting images for property ${prop.id}:`, storageError);
              }
            }
          }

          // B. Delete from database
          const { error: deleteError } = await supabaseAdmin
            .from('properties')
            .delete()
            .eq('id', prop.id);

          if (deleteError) {
            console.error(`[CRON] Error deleting property ${prop.id} from DB:`, deleteError);
          } else {
            console.log(`[CRON] Successfully deleted property ${prop.id} permanently.`);
          }
        }
      } else {
        console.log('[CRON] No properties found for cleanup.');
      }
    } catch (err) {
      console.error('[CRON] Critical error during 30-day cleanup:', err);
    }
  });
};
