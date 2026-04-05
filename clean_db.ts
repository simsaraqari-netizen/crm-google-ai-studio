import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { normalizeArabic, cleanAreaName, normalizeDigits } from './src/utils';
import { GOVERNORATES, AREAS, PROPERTY_TYPES, PURPOSES } from './src/constants';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

function inferPurpose(text) {
  if (!text) return '';
  const t = normalizeArabic(text);
  if (t.includes('بدل') || t.includes('بدا') || t.includes('بيدل') || t.includes('يدل')) return 'بدل';
  if (t.includes('شرا') || t.includes('مشتري') || t.includes('يبي') || t.includes('مطلوب')) return 'شراء';
  if (t.includes('ايجار') || t.includes('مستاجر') || t.includes('تأجير') || t.includes('يبحث عن ايجار')) return 'ايجار';
  if (t.includes('بيع') || t.includes('للبيع')) return 'بيع';
  return '';
}

function inferType(text) {
  if (!text) return '';
  const t = normalizeArabic(text);
  if (t.includes('طلب')) return 'طلب';
  if (t.includes('ارض')) return 'ارض';
  if (t.includes('قسيمه') || t.includes('قسيمة') || t.includes('مبنيه')) return 'قسيمة مبنية';
  if (t.includes('بيت') || t.includes('حكومي') || t.includes('حكومى')) return 'بيت حكومي';
  if (t.includes('شقه') || t.includes('شقة')) return 'شقة';
  if (t.includes('عماره') || t.includes('عمارة')) return 'عمارة';
  if (t.includes('استثماري') || t.includes('استثمار')) return 'استثماري';
  if (t.includes('تجاري') || t.includes('تجار')) return 'تجاري';
  if (t.includes('صناعي') || t.includes('صناعيه') || t.includes('حرفي')) return 'صناعي';
  if (t.includes('مخزن') || t.includes('مخازن')) return 'مخازن';
  if (t.includes('مزرعه') || t.includes('مزرعة')) return 'مزرعة';
  if (t.includes('شاليه') || t.includes('شالية')) return 'شالية';
  return '';
}

function inferGovernorate(govStr, areaStr) {
  const g = normalizeArabic(govStr);
  const a = cleanAreaName(areaStr);
  
  if (a) {
    for (const gov of Object.keys(AREAS)) {
      if (AREAS[gov].some(x => normalizeArabic(x).includes(a) || a.includes(normalizeArabic(x)))) {
         return gov;
      }
    }
  }

  if (g.includes('عاصمه') || g.includes('عاصمة')) return 'محافظة العاصمة';
  if (g.includes('حولي')) return 'محافظة حولي';
  if (g.includes('فروانيه') || g.includes('فروانية') || g.includes('رابعه') || g.includes('رابعة')) return 'محافظة الفروانية';
  if (g.includes('مبارك')) return 'محافظة مبارك الكبير';
  if (g.includes('احمدي') || g.includes('عاشره') || g.includes('عاشرة')) return 'محافظة الأحمدي';
  if (g.includes('جهراء')) return 'محافظة الجهراء';
  
  return 'محافظة غير محددة';
}

async function run() {
  console.log('Fetching properties...');
  let { data: properties, error } = await supabase.from('properties').select('*');
  if (error) throw error;
  console.log('Found', properties.length, 'properties');

  for (let p of properties) {
    let newPurpose = inferPurpose(p.purpose) || inferPurpose(p.type) || inferPurpose(p.name);
    let newType = inferType(p.type) || inferType(p.purpose) || inferType(p.name);
    let newGov = inferGovernorate(p.governorate, p.area);
    let newArea = cleanAreaName(p.area);

    let needsUpdate = false;
    let updates = {};

    if (newPurpose !== p.purpose) { updates.purpose = newPurpose; needsUpdate = true; }
    if (newType !== p.type) { updates.type = newType; needsUpdate = true; }
    if (newGov !== p.governorate) { updates.governorate = newGov; needsUpdate = true; }
    if (newArea !== p.area) { updates.area = newArea; needsUpdate = true; }

    if (needsUpdate) {
      console.log(`Updating ${p.id} (${p.name}): Gov=${updates.governorate || p.governorate}, Type=${updates.type || p.type}, Purpose=${updates.purpose || p.purpose}`);
      await supabase.from('properties').update(updates).eq('id', p.id);
    }
  }
  
  console.log('Cleanup finished!');
}

run();
