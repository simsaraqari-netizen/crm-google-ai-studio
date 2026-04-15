const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function normalizeArabic(text) {
  if (!text) return '';
  let normalized = text.toString().toLowerCase();
  normalized = normalized.replace(/[أإآ]/g, 'ا');
  normalized = normalized.replace(/ة/g, 'ه');
  normalized = normalized.replace(/ى/g, 'ي');
  normalized = normalized.replace(/[\u064B-\u0652]/g, '');
  return normalized.trim();
}

function cleanAreaName(name) {
  if (!name) return '';
  return name.replace(/(مدينة|منطقة|ضاحية)\s+/g, '').trim();
}

async function runMaintenance() {
  console.log('Fetching all properties...');
  let hasMore = true;
  let offset = 0;
  const limit = 1000;
  let totalUpdated = 0;
  let totalProcessed = 0;

  while (hasMore) {
    console.log(`Fetching batch: ${offset} - ${offset + limit}...`);
    const { data, error } = await supabase
      .from('properties')
      .select('id, name, area, governorate')
      .range(offset, offset + limit - 1);

    if (error) {
      console.error(error);
      break;
    }

    if (!data || data.length === 0) {
      hasMore = false;
      break;
    }

    console.log(`Processing batch of ${data.length}...`);
    for (const p of data) {
      totalProcessed++;
      const normName = normalizeArabic(p.name);
      const normArea = normalizeArabic(cleanAreaName(p.area));
      const normGov = normalizeArabic(p.governorate);

      if (normName !== p.name || normArea !== p.area || normGov !== p.governorate) {
        const { error: updateError } = await supabase
          .from('properties')
          .update({
            name: normName,
            area: normArea,
            governorate: normGov
          })
          .eq('id', p.id);
        
        if (!updateError) totalUpdated++;
      }
    }

    offset += limit;
    if (data.length < limit) hasMore = false;
  }

  console.log(`Maintenance complete. Processed ${totalProcessed}, Updated ${totalUpdated} properties.`);
}

runMaintenance().catch(console.error);
