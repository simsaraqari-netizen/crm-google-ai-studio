import cron from 'node-cron';
import { createClient } from '@supabase/supabase-js';
import { readSheet, writeToSheet } from './googleSheetsService.ts';
import { cleanAreaName, inferGovernorate, inferPurpose, inferType } from '../utils.ts';
import { AREAS } from '../constants.ts';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export const initializeCronJobs = () => {
  // Run daily at midnight '0 0 * * *'
  // Run every 5 minutes for auto-sync '*/5 * * * *'
  cron.schedule('*/5 * * * *', async () => {
    console.log('[CRON] Starting daily Google Sheets Sync at', new Date().toISOString());

    try {
      // 1. Get the target spreadsheet ID
      const { data: settings, error: settingsError } = await supabaseAdmin.from('settings').select('spreadsheet_id').eq('id', 1).single();
      
      if (settingsError || !settings?.spreadsheet_id) {
        console.log('[CRON] No spreadsheet_id found in settings. Skipping sync.');
        return;
      }
      
      const spreadsheetId = settings.spreadsheet_id;
      const range = 'Sheet1!A1:Z5000'; // Default range

      // ============================================
      // STEP A: SYNC FROM SHEET TO SUPABASE
      // ============================================
      console.log('[CRON] Reading sheet data...');
      const sheetData = await readSheet(spreadsheetId, range);
      
      if (sheetData && Array.isArray(sheetData)) {
        const startIdx = (sheetData[0] && sheetData[0][0] === 'ID') ? 1 : 0;
        
        for (let i = startIdx; i < sheetData.length; i++) {
          const row = sheetData[i];
          if (!row || row.length < 2) continue;
          
          const [
            id, name, governorate, area, type, purpose, phone, 
            assigned_employee_id, assigned_employee_name, imagesStr, linksStr, 
            location_link, is_soldStr, sector, block, street, avenue, 
            plot_number, house_number, location, details, last_comment, 
            status_label, created_by, created_atStr
          ] = row;

          const cleanVal = (val: string) => {
            if (!val) return '';
            let v = val.replace(/resedintal|residental|residential/gi, '').trim();
            // Standardize standalone "م" contextually
            v = v.replace(/\bم\s+(\d+|[٠-٩]+)/g, 'منزل $1');
            return v;
          };

          const cPurpose = cleanVal(purpose);
          const cType = cleanVal(type);
          const cName = cleanVal(name);
          const cArea = cleanAreaName(cleanVal(area));

          // Smart inference: only use inference if the current value is empty or invalid
          let newPurpose = cPurpose;
          let newType = cType;

          // If the values are swapped or missing, try to infer
          if (!newPurpose || !inferPurpose(newPurpose)) {
            newPurpose = inferPurpose(cPurpose) || inferPurpose(cType) || inferPurpose(cName);
          }
          
          if (!newType || !inferType(newType)) {
            newType = inferType(cType) || inferType(cPurpose) || inferType(cName);
          }

          const newGov = inferGovernorate(cArea, cleanVal(governorate));

          const propertyData: any = {
            name: cName,
            governorate: newGov,
            area: cArea,
            type: newType,
            purpose: newPurpose,
            phone: cleanVal(phone),
            assigned_employee_id: assigned_employee_id || null,
            assigned_employee_name: assigned_employee_name || '',
            images: imagesStr ? imagesStr.split(',').filter(Boolean) : [],
            links: linksStr ? linksStr.split(',').filter(Boolean) : [],
            location_link: location_link || '',
            is_sold: is_soldStr === 'TRUE' || is_soldStr === 'نعم' || is_soldStr === 'مباع',
            sector: cleanVal(sector),
            block: cleanVal(block),
            street: cleanVal(street),
            avenue: cleanVal(avenue),
            plot_number: cleanVal(plot_number),
            house_number: cleanVal(house_number),
            location: cleanVal(location),
            details: cleanVal(details),
            status_label: cleanVal(status_label),
            updated_at: new Date().toISOString()
          };

          if (last_comment) propertyData.last_comment = cleanVal(last_comment);
          if (created_by) propertyData.created_by = created_by;
          if (created_atStr) propertyData.created_at = new Date(created_atStr).toISOString();

          // Upsert logic
          if (id) {
            const { error: updateError } = await supabaseAdmin.from('properties').update(propertyData).eq('id', id);
            if (updateError) {
              await supabaseAdmin.from('properties').insert({ ...propertyData, id });
            }
          } else {
            await supabaseAdmin.from('properties').insert({ ...propertyData });
          }
        }
        console.log('[CRON] Successfully imported data from Sheets.');
      }


      // ============================================
      // STEP B: SYNC FROM SUPABASE TO SHEET
      // ============================================
      console.log('[CRON] Overwriting sheet with latest Supabase data...');
      
      let allProps: any[] = [];
      let from = 0;
      let step = 1000;
      let fetchMore = true;

      // Extract all active properties from Supabase bypassing the 1000 limit
      while (fetchMore) {
        const { data: dbData, error: dbError } = await supabaseAdmin
          .from('properties')
          .select('*')
          .eq('is_deleted', false)
          .neq('status', 'deleted')
          .order('created_at', { ascending: false })
          .range(from, from + step - 1);
          
        if (dbError) throw dbError;
        if (dbData && dbData.length > 0) {
          allProps = [...allProps, ...dbData];
          from += step;
          if (dbData.length < step) fetchMore = false;
        } else {
          fetchMore = false;
        }
      }

      const header = [
        "ID", "الاسم", "المحافظة", "المنطقة", "النوع", "الغرض", "تليفون",
        "المسؤول الرقمي", "المسؤول", "الصور", "الروابط", 
        "رابط الموقع", "مباع؟", "القطاع", "القطعة", "الشارع", "الجادة", 
        "القسيمة", "المنزل", "الموقع", "التفاصيل", "آخر تعليق", 
        "حالة الحجز", "بواسطة", "تاريخ الإضافة"
      ];

      const writeData = [
        header,
        ...allProps.map(p => [
          p.id,
          p.name || '',
          p.governorate || '',
          p.area || '',
          p.type || '',
          p.purpose || '',
          p.phone || '',
          p.assigned_employee_id || '',
          p.assigned_employee_name || '',
          (p.images || []).join(','),
          (p.links || []).join(','),
          p.location_link || '',
          p.is_sold ? "مباع" : "متاح",
          p.sector || '',
          p.block || '',
          p.street || '',
          p.avenue || '',
          p.plot_number || '',
          p.house_number || '',
          p.location || '',
          p.details || '',
          p.last_comment || '',
          p.status_label || '',
          p.created_by || '',
          new Date(p.created_at).toLocaleString('ar-KW')
        ])
      ];

      await writeToSheet(spreadsheetId, range, writeData);
      console.log('[CRON] Sync process completed successfully!');
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
