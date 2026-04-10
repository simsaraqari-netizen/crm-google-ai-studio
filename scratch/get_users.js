const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function getUsers() {
  const { data, error } = await supabase.from('profiles').select('*').limit(5);
  if (error) {
    console.error("Error fetching users:", error);
    return;
  }
  console.log("Users:", JSON.stringify(data, null, 2));
}

getUsers();
