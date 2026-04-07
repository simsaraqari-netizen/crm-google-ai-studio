import { createClient } from '@supabase/supabase-js';
import { readSheet, writeToSheet } from './googleSheetsService.ts';
import { cleanAreaName, inferGovernorate, inferPurpose, inferType, cleanNameText, cleanNameWithContext, normalizeDigits } from '../utils.ts';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export const syncSupabaseWithSheets = async () => {
  console.log('[SYNC] Starting Google Sheets Sync at', new Date().toISOString());

  try {
    // 1. Get the target spreadsheet ID
    const { data: settings, error: settingsError } = await supabaseAdmin.from('settings').select('spreadsheet_id').eq('id', 1).single();
    
    if (settingsError || !settings?.spreadsheet_id) {
      console.log('[SYNC] No spreadsheet_id found in settings. Skipping sync.');
      return;
    }
    
    const spreadsheetId = settings.spreadsheet_id;
    const range = 'Sheet1!A1:Z5000'; // Default range

    // ============================================
    // STEP A: SYNC FROM SHEET TO SUPABASE
    // ============================================
    console.log('[SYNC] Reading sheet data...');
    const sheetData = await readSheet(spreadsheetId, range);
    
    if (sheetData && Array.isArray(sheetData)) {
      const headerRow = sheetData[0];
      const startIdx = (headerRow && headerRow[0] === 'ID') ? 1 : 0;
      
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

        // Fetch existing record to preserve fields if sheet is empty
        let existing: any = null;
        if (id) {
          const { data } = await supabaseAdmin.from('properties').select('*').eq('id', id).single();
          existing = data;
        }

        const cleanStr = (val: any) => {
          if (val === undefined || val === null || val === '') return '';
          return normalizeDigits(String(val)).trim();
        };

        // PRIORITY LOGIC: Use sheet if not empty, otherwise keep existing
        const getVal = (sheetVal: any, dbKey: string) => {
          const s = cleanStr(sheetVal);
          if (s) return s;
          return existing ? existing[dbKey] : '';
        };

        // Multi-value handling for Area and Governorate
        const rawArea = cleanStr(area);
        let finalArea = existing?.area || '';
        let finalGov = existing?.governorate || '';

        if (rawArea) {
          const areas = splitMultiValue(rawArea).map(cleanAreaName);
          finalArea = Array.from(new Set(areas)).join(', ');
          finalGov = inferGovernorate(finalArea, cleanStr(governorate));
        } else if (cleanStr(governorate)) {
          finalGov = cleanStr(governorate);
        }

        // Multi-employee handling
        const rawEmployeeName = cleanStr(assigned_employee_name);
        let finalEmployeeName = existing?.assigned_employee_name || '';
        if (rawEmployeeName) {
          const names = splitMultiValue(rawEmployeeName);
          finalEmployeeName = Array.from(new Set(names)).join(', ');
        }

        const cName = getVal(name, 'name');
        const cPurpose = getVal(purpose, 'purpose');
        const cType = getVal(type, 'type');

        // Infer missing purpose/type if needed
        let newPurpose = cPurpose;
        let newType = cType;
        if (!newPurpose || !inferPurpose(newPurpose)) {
          newPurpose = inferPurpose(cPurpose) || inferPurpose(cType) || inferPurpose(cName);
        }
        if (!newType || !inferType(newType)) {
          newType = inferType(cType) || inferType(cPurpose) || inferType(cName);
        }

        const propertyData: any = {
          name: cleanNameText(cName),
          governorate: finalGov,
          area: finalArea,
          type: newType || cType,
          purpose: newPurpose || cPurpose,
          phone: getVal(phone, 'phone'),
          assigned_employee_id: assigned_employee_id || (existing?.assigned_employee_id || null),
          assigned_employee_name: finalEmployeeName,
          location_link: getVal(location_link, 'location_link'),
          is_sold: is_soldStr ? (is_soldStr === 'TRUE' || is_soldStr === 'نعم' || is_soldStr === 'مباع') : (existing?.is_sold || false),
          sector: getVal(sector, 'sector'),
          block: getVal(block, 'block'),
          street: getVal(street, 'street'),
          avenue: getVal(avenue, 'avenue'),
          plot_number: getVal(plot_number, 'plot_number'),
          house_number: getVal(house_number, 'house_number'),
          location: getVal(location, 'location'),
          details: getVal(details, 'details'),
          status_label: getVal(status_label, 'status_label'),
          updated_at: new Date().toISOString()
        };

        // Handle JSON fields (Images/Links)
        if (imagesStr) {
          propertyData.images = splitMultiValue(imagesStr).map(url => ({ 
            url, 
            type: (url.includes('.mp4') || url.includes('.mov') || url.includes('video')) ? 'video' : 'image',
            comment: '' 
          }));
        }
        if (linksStr) {
          propertyData.links = splitMultiValue(linksStr);
        }

        if (last_comment) propertyData.last_comment = cleanStr(last_comment);
        if (created_by) propertyData.created_by = created_by;
        if (created_atStr) propertyData.created_at = new Date(created_atStr).toISOString();

        if (id) {
          const { error: updateError } = await supabaseAdmin.from('properties').update(propertyData).eq('id', id);
          if (updateError) {
             // Handle case where ID might not exist yet but was provided
            await supabaseAdmin.from('properties').insert({ ...propertyData, id });
          }
        } else {
          await supabaseAdmin.from('properties').insert({ ...propertyData });
        }
      }
      console.log('[SYNC] Successfully imported data from Sheets with Priority logic.');
    }

    // ============================================
    // STEP B: SYNC FROM SUPABASE TO SHEET
    // ============================================
    console.log('[SYNC] Overwriting sheet with latest Supabase data...');
    
    let allProps: any[] = [];
    let from = 0;
    let step = 1000;
    let fetchMore = true;

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

    if (allProps.length === 0) {
      console.log('[SYNC] No properties found in Supabase. Skipping sheet overwrite to prevent data loss.');
      return;
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
        normalizeDigits(p.name || ''),
        normalizeDigits(p.governorate || ''),
        normalizeDigits(p.area || ''),
        normalizeDigits(p.type || ''),
        normalizeDigits(p.purpose || ''),
        normalizeDigits(p.phone || ''),
        p.assigned_employee_id || '',
        normalizeDigits(p.assigned_employee_name || ''),
        (p.images || []).map((img: any) => typeof img === 'string' ? img : (img.url || '')).filter(Boolean).join(','),
        (p.links || []).join(','),
        p.location_link || '',
        p.is_sold ? "مباع" : "متاح",
        normalizeDigits(p.sector || ''),
        normalizeDigits(p.block || ''),
        normalizeDigits(p.street || ''),
        normalizeDigits(p.avenue || ''),
        normalizeDigits(p.plot_number || ''),
        normalizeDigits(p.house_number || ''),
        normalizeDigits(p.location || ''),
        normalizeDigits(p.details || ''),
        normalizeDigits(p.last_comment || ''),
        normalizeDigits(p.status_label || ''),
        normalizeDigits(p.created_by || ''),
        new Date(p.created_at).toLocaleString('ar-KW')
      ])
    ];

    console.log(`[SYNC] Writing ${allProps.length} properties to sheet...`);
    await writeToSheet(spreadsheetId, range, writeData);
    console.log('[SYNC] Sync process completed successfully!');
  } catch (e: any) {
    console.error('[SYNC] Error during synchronization:', e);
  }
};
