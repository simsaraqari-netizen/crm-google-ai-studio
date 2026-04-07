import { createClient } from '@supabase/supabase-js';
import { readSheet } from './googleSheetsService.ts';
import { cleanAreaName, inferGovernorate, inferPurpose, inferType, cleanNameText, cleanNameWithContext, normalizeDigits, splitMultiValue } from '../utils.ts';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export const syncSupabaseWithSheets = async () => {
  console.log('[SYNC] Starting Google Sheets Sync at', new Date().toISOString());

  try {
    // 1. Get the target spreadsheet ID
    const { data: settingsRows, error: settingsError } = await supabaseAdmin
      .from('settings')
      .select('id,spreadsheet_id')
      .in('id', ['sync', '1']);
    const settings = settingsRows && settingsRows.length > 0
      ? (settingsRows.find((row: any) => row.id === 'sync') || settingsRows.find((row: any) => row.id === '1') || settingsRows[0])
      : null;

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
      const headerRow = (sheetData[0] || []).map((h: any) => String(h || '').trim());
      const startIdx = headerRow.length > 0 ? 1 : 0;
      const headerMap = new Map<string, number>();
      headerRow.forEach((h: string, i: number) => headerMap.set(h, i));

      const readCell = (row: any[], aliases: string[], fallbackIndex: number) => {
        for (const alias of aliases) {
          const idx = headerMap.get(alias);
          if (idx !== undefined) return row[idx];
        }
        return row[fallbackIndex];
      };
      
      for (let i = startIdx; i < sheetData.length; i++) {
        const row = sheetData[i];
        if (!row || row.length < 2) continue;
        
        const id = readCell(row, ['ID', 'Id', 'id'], 0);
        const name = readCell(row, ['الاسم', 'اسم العميل', 'name'], 1);
        const governorate = readCell(row, ['المحافظة', 'governorate'], 2);
        const area = readCell(row, ['المنطقة', 'area'], 3);
        const type = readCell(row, ['النوع', 'type'], 4);
        const purpose = readCell(row, ['الغرض', 'الغرض من العملية', 'purpose'], 5);
        const phone = readCell(row, ['الهاتف', 'تليفون', 'phone'], 6);
        const assigned_employee_id = readCell(row, ['ID الموظف', 'المسؤول الرقمي', 'assigned_employee_id'], 7);
        const assigned_employee_name = readCell(row, ['اسم الموظف', 'المسؤول', 'assigned_employee_name'], 8);
        const imagesStr = readCell(row, ['الصور', 'images'], 9);
        const linksStr = readCell(row, ['الروابط', 'links'], 10);
        const location_link = readCell(row, ['رابط الموقع', 'location_link'], 11);
        const is_soldStr = readCell(row, ['مباع', 'مباع؟', 'is_sold'], 12);
        const sector = readCell(row, ['القطاع', 'sector'], 13);
        const block = readCell(row, ['القطعة', 'block'], 14);
        const street = readCell(row, ['الشارع', 'street'], 15);
        const avenue = readCell(row, ['الجادة', 'avenue'], 16);
        const plot_number = readCell(row, ['القسيمة', 'plot_number'], 17);
        const house_number = readCell(row, ['المنزل', 'house_number'], 18);
        const location = readCell(row, ['الموقع الوصفي', 'الموقع', 'location'], 19);
        const details = readCell(row, ['التفاصيل', 'details'], 20);
        const last_comment = readCell(row, ['آخر تعليق', 'last_comment'], 21);
        const status_label = readCell(row, ['ملصق الحالة', 'حالة الحجز', 'status_label'], 22);
        const created_by = readCell(row, ['أنشئ بواسطة', 'بواسطة', 'created_by'], 23);
        const created_atStr = readCell(row, ['تاريخ الإنشاء', 'تاريخ الإضافة', 'created_at'], 24);

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
          status_label: getVal(status_label, 'status_label')
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
    console.log('[SYNC] Sync process completed successfully (Sheet -> Supabase only).');
  } catch (e: any) {
    console.error('[SYNC] Error during synchronization:', e);
  }
};
