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

async function mergeWafraExpansion() {
  console.log('Searching for "Wafra Expansion" properties...');
  
  // Search for variants
  const variants = ['توسعه الوفره', 'توسعة الوفرة', 'توسعه الوفرة', 'توسعة الوفره'];
  
  let totalUpdated = 0;

  const { data, error } = await supabase
    .from('properties')
    .select('id, area')
    .or('area.ilike.%توسعه الوفره%,area.ilike.%توسعة الوفرة%');

  if (error) {
    console.error(error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('No properties found with "Wafra Expansion".');
    return;
  }

  console.log(`Found ${data.length} properties to update.`);

  for (const p of data) {
    // Basic replacement for simple matching
    // If it's a multi-value like "الوفرة, توسعة الوفرة", we want it to become "الوفرة"
    let newArea = p.area;
    variants.forEach(v => {
      newArea = newArea.replace(new RegExp(v, 'g'), 'الوفرة');
    });

    // Deduplicate if needed (e.g. "الوفرة, الوفرة")
    const areas = [...new Set(newArea.split(/[,\n،;|/]+/g).map(a => a.trim()).filter(Boolean))];
    const finalArea = areas.join(', ');

    if (finalArea !== p.area) {
      const { error: updateError } = await supabase
        .from('properties')
        .update({ area: finalArea })
        .eq('id', p.id);
      
      if (!updateError) {
        totalUpdated++;
        console.log(`Updated ID ${p.id}: "${p.area}" -> "${finalArea}"`);
      }
    }
  }

  console.log(`Migration complete. Total updated: ${totalUpdated}`);
}

mergeWafraExpansion().catch(console.error);
