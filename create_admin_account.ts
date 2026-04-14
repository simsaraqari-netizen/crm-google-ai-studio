import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const newUserData = {
  email: 'admin@musadaqa.com',
  password: 'Musadaqa@2026',
  email_confirm: true,
  user_metadata: {
    full_name: 'System Admin',
    role: 'admin'
  }
};

async function createAdmin() {
  console.log('--- Creating Admin User ---');
  
  // 1. Create the user in Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser(newUserData);

  if (authError) {
    if (authError.message.includes('already registered')) {
      console.log('User already exists in Auth. Updating profile...');
      // Get existing user ID
      const { data: users } = await supabase.auth.admin.listUsers();
      const existingUser = users.users.find(u => u.email === newUserData.email);
      if (existingUser) {
        await updateProfile(existingUser.id);
      }
    } else {
      console.error('Error creating auth user:', authError.message);
    }
    return;
  }

  console.log('Auth user created successfully:', authData.user.id);

  // 2. Insert into profiles table
  await updateProfile(authData.user.id);
}

async function updateProfile(userId: string) {
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      email: newUserData.email,
      full_name: 'System Admin',
      name: 'System Admin',
      role: 'admin',
      created_at: new Date().toISOString()
    });

  if (profileError) {
    console.error('Error updating profile:', profileError.message);
  } else {
    console.log('Profile updated/created with admin role.');
    console.log('\n--- SUCCESS ---');
    console.log(`Email: ${newUserData.email}`);
    console.log(`Password: ${newUserData.password}`);
  }
}

createAdmin();
