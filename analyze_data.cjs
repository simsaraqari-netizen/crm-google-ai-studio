const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function analyzeData() {
  console.log('Fetching properties...');
  const { data, error } = await supabase
    .from('properties')
    .select('governorate, area')
    .order('created_at', { ascending: false })
    .limit(5000);

  if (error) {
    console.error('Supabase Error:', error);
    return;
  }

  console.log(`Total properties fetched: ${data.length}`);

  const govCounts = {};
  const areaCounts = {};
  const govAreaPairs = {};

  data.forEach(p => {
    const g = p.governorate || '(NULL)';
    const a = p.area || '(NULL)';
    
    govCounts[g] = (govCounts[g] || 0) + 1;
    
    // Split multi-value areas
    const areas = a.split(/[,\n،;|/]+/).map(item => item.trim()).filter(Boolean);
    if (areas.length === 0) {
      areaCounts['(NULL)'] = (areaCounts['(NULL)'] || 0) + 1;
      if (!govAreaPairs[g]) govAreaPairs[g] = new Set();
      govAreaPairs[g].add('(NULL)');
    } else {
      areas.forEach(item => {
        areaCounts[item] = (areaCounts[item] || 0) + 1;
        if (!govAreaPairs[g]) govAreaPairs[g] = new Set();
        govAreaPairs[g].add(item);
      });
    }
  });

  console.log('\nGovernorate Counts:');
  console.log(JSON.stringify(govCounts, null, 2));

  console.log('\nTop 30 Areas (Normalized by splitting multi-values):');
  const topAreas = Object.entries(areaCounts).sort((a, b) => b[1] - a[1]).slice(0, 30);
  console.log(JSON.stringify(topAreas, null, 2));

  console.log('\nAreas with (NULL) Governorate:');
  const nullGovAreas = Array.from(govAreaPairs['(NULL)'] || []);
  console.log(JSON.stringify(nullGovAreas, null, 2));
  
  // Check for specific area mentioned by user in the past or likely problematic
  const searchFor = ['صباح الاحمد', 'جابر الاحمد', 'جنوب صباح الاحمد'];
  console.log('\nTarget Area Checks:');
  searchFor.forEach(target => {
    const matched = Object.keys(areaCounts).filter(a => a.includes(target));
    console.log(`- "${target}":`, matched.map(m => `${m} (${areaCounts[m]})`).join(', ') || 'NOT FOUND');
  });
}

analyzeData().catch(err => console.error('Unexpected Error:', err));
