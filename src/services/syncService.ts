import { createClient } from '@supabase/supabase-js';
import { readSheet, writeToSheet } from './googleSheetsService.ts';
import { cleanAreaName, inferGovernorate, inferPurpose, inferType, cleanNameText, cleanNameWithContext, normalizeDigits, extractDetailsFromName } from '../utils.ts';

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

        if (!name || name.trim() === '') continue;

        const cleanVal = (val: string) => {
          if (!val) return '';
          let v = normalizeDigits(val); // Always convert digits first
          v = v.replace(/resedintal|residental|residential/gi, '').trim();
          // Standardize standalone "م" contextually
          v = v.replace(/\bم\s+(\d+)/g, 'منزل $1');
          return v;
        };

        const cPurpose = cleanVal(purpose);
        const cType = cleanVal(type);
        const cName = cleanVal(name);
        const cArea = cleanAreaName(cleanVal(area));

        let newPurpose = cPurpose;
        let newType = cType;

        if (!newPurpose || !inferPurpose(newPurpose)) {
          newPurpose = inferPurpose(cPurpose) || inferPurpose(cType) || inferPurpose(cName);
        }
        
        if (!newType || !inferType(newType)) {
          newType = inferType(cType) || inferType(cPurpose) || inferType(cName);
        }

        const newGov = inferGovernorate(cArea, cleanVal(governorate));

        // Deduplicate name using contextual metadata
        let finalName = cleanNameWithContext(cName, cArea, newPurpose, newType);
        finalName = cleanNameText(finalName);

        const propertyData: any = {
          name: finalName,
          governorate: newGov,
          area: cArea,
          type: newType,
          purpose: newPurpose,
          phone: cleanVal(phone),
          assigned_employee_id: assigned_employee_id || null,
          assigned_employee_name: assigned_employee_name || '',
          images: imagesStr ? imagesStr.split(',').filter(Boolean).map(url => ({ 
            url, 
            type: (url.includes('.mp4') || url.includes('.mov') || url.includes('video')) ? 'video' : 'image',
            comment: '' 
          })) : [],
          links: linksStr ? linksStr.split(',').filter(Boolean) : [],
          location_link: location_link || '',
          is_sold: is_soldStr === 'TRUE' || is_soldStr === 'نعم' || is_soldStr === 'مباع',
          sector: cleanVal(sector) || extractDetailsFromName(cName).sector || '',
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

        if (id) {
          const { error: updateError } = await supabaseAdmin.from('properties').update(propertyData).eq('id', id);
          if (updateError) {
            await supabaseAdmin.from('properties').insert({ ...propertyData, id });
          }
        } else {
          await supabaseAdmin.from('properties').insert({ ...propertyData });
        }
      }
      console.log('[SYNC] Successfully imported data from Sheets.');
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

    await writeToSheet(spreadsheetId, range, writeData);
    console.log('[SYNC] Sync process completed successfully!');
  } catch (e: any) {
    console.error('[SYNC] Error during synchronization:', e);
  }
};
