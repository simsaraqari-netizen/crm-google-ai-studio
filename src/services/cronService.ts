import cron from 'node-cron';
import { createClient } from '@supabase/supabase-js';
import { readSheet, writeToSheet } from './googleSheetsService.ts';
import { cleanAreaName } from '../utils.ts';
import { AREAS } from '../constants.ts';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export const initializeCronJobs = () => {
  // Run daily at midnight '0 0 * * *'
  cron.schedule('0 0 * * *', async () => {
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

          const cleanVal = (val: string) => val ? val.replace(/resedintal|residental|residential/gi, '').trim() : '';
          
          const normalizeGovernorate = (gov: string, areaName: string) => {
            let g = cleanVal(gov);
            if (!g) return '';
            
            if (g.includes('الرابعة') || g.includes('الرابعه')) return 'محافظة الفروانية (المنطقة الرابعة)';

            if (g.includes('العاشرة') || g.includes('العاشره')) {
               let a = cleanAreaName(cleanVal(areaName));
               if (a && AREAS['محافظة مبارك الكبير']?.some(x => a.includes(x) || x.includes(a))) {
                 return 'محافظة مبارك الكبير';
               }
               return 'محافظة الأحمدي (المنطقة العاشرة)';
            }
            
            if (!g.startsWith('محافظة')) g = 'محافظة ' + g;
            return g;
          };

          const propertyData: any = {
            name: cleanVal(name),
            governorate: normalizeGovernorate(governorate, area),
            area: cleanAreaName(cleanVal(area)),
            type: cleanVal(type),
            purpose: cleanVal(purpose),
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
        "Assigned Employee ID", "Assigned Employee Name", "Images", "Links", 
        "Location Link", "Is Sold", "Sector", "Block", "Street", "Avenue", 
        "Plot Number", "House Number", "Location", "Details", "Last Comment", 
        "Status Label", "Created By", "Created At"
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
};
