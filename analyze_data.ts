import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function analyzeData() {
  const { data, error } = await supabase
    .from('properties')
    .select('governorate, area')
    .limit(5000);

  if (error) {
    console.error(error);
    return;
  }

  const govCounts: Record<string, number> = {};
  const areaCounts: Record<string, number> = {};
  const govAreaPairs: Record<string, Set<string>> = {};

  data.forEach(p => {
    const g = p.governorate || '(NULL)';
    const a = p.area || '(NULL)';
    
    govCounts[g] = (govCounts[g] || 0) + 1;
    areaCounts[a] = (areaCounts[a] || 0) + 1;
    
    if (!govAreaPairs[g]) govAreaPairs[g] = new Set();
    govAreaPairs[g].add(a);
  });

  console.log('Governorate Counts:');
  console.log(JSON.stringify(govCounts, null, 2));

  console.log('\nTop 20 Areas:');
  const topAreas = Object.entries(areaCounts).sort((a, b) => b[1] - a[1]).slice(0, 20);
  console.log(JSON.stringify(topAreas, null, 2));

  console.log('\nAreas with (NULL) Governorate:');
  const nullGovAreas = Array.from(govAreaPairs['(NULL)'] || []);
  console.log(JSON.stringify(nullGovAreas, null, 2));
}

analyzeData();
