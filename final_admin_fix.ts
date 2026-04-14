import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function setAdmin() {
  const email = 'admin@musadaqa.com';
  console.log(`Setting admin role for: ${email}`);

  // 1. Find user ID
  const { data: users, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error('Error listing users:', listError.message);
    return;
  }

  const user = users.users.find(u => u.email === email);
  if (!user) {
    console.error(`User ${email} not found. Please create it in the Auth tab first.`);
    return;
  }

  // 2. Update profile
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: user.id,
      email: email,
      role: 'admin',
      full_name: 'System Admin',
      name: 'System Admin',
      updated_at: new Date().toISOString()
    });

  if (profileError) {
    console.error('Error updating profile:', profileError.message);
  } else {
    console.log('SUCCESS: User is now an Admin.');
  }
}

setAdmin();
