import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', 'admin@musadaqa.com')
    .single();
  
  if (error) {
    console.error('Error fetching profile:', error.message);
  } else {
    console.log('Profile found:', JSON.stringify(data, null, 2));
  }
}

check();
