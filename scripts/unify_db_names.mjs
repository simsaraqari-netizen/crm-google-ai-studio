import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env manually to be safe
const envPath = join(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    env[key.trim()] = value.replace(/["']/g, '').trim();
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// --- Normalization Logic (Copied from utils.ts) ---

function normalizeDigits(text) {
  if (!text) return "";
  const arabicDigits = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
    '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
    '۵': '5', '۶': '6', '٧': '7', '۸': '8', '۹': '9'
  };
  return text.replace(/[٠-٩۰-۹]/g, (d) => arabicDigits[d] || d);
}

function normalizeArabic(text) {
  if (!text) return "";
  let normalized = normalizeDigits(text);
  normalized = normalized
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[\u064B-\u0652]/g, ""); // strip diacritics
  return normalized;
}

function unifyAbuName(name) {
  if (!name) return "";
  const normalized = normalizeArabic(name.trim());
  return normalized.replace(/^ابو\s+/g, "ابو");
}

// --- Migration Core ---

async function runMigration() {
  console.log("🚀 Starting Name Unification Migration...");

  // 1. Normalize Profiles
  console.log("Checking profiles...");
  const { data: profiles } = await supabase.from('profiles').select('id, name, full_name');
  let profileUpdates = 0;
  for (const p of profiles || []) {
    const newName = unifyAbuName(p.name);
    const newFullName = p.full_name ? unifyAbuName(p.full_name) : null;
    if (newName !== p.name || (newFullName && newFullName !== p.full_name)) {
      const { error } = await supabase.from('profiles').update({ name: newName, full_name: newFullName }).eq('id', p.id);
      if (!error) profileUpdates++;
    }
  }
  console.log(`✅ Profiles updated: ${profileUpdates}`);

  // 2. Normalize Properties
  console.log("Checking properties...");
  const { data: props } = await supabase.from('properties').select('id, name, created_by_name, assigned_employee_name, assignedEmployeeName');
  let propertyUpdates = 0;
  for (const p of props || []) {
    const updates = {};
    const newName = p.name ? unifyAbuName(p.name) : null;
    const newCreatedBy = p.created_by_name ? unifyAbuName(p.created_by_name) : null;
    const newAssignedSnake = p.assigned_employee_name ? unifyAbuName(p.assigned_employee_name) : null;
    const newAssignedCamel = p.assignedEmployeeName ? unifyAbuName(p.assignedEmployeeName) : null;

    if (newName && newName !== p.name) updates.name = newName;
    if (newCreatedBy && newCreatedBy !== p.created_by_name) updates.created_by_name = newCreatedBy;
    if (newAssignedSnake && newAssignedSnake !== p.assigned_employee_name) updates.assigned_employee_name = newAssignedSnake;
    if (newAssignedCamel && newAssignedCamel !== p.assignedEmployeeName) updates.assignedEmployeeName = newAssignedCamel;

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase.from('properties').update(updates).eq('id', p.id);
      if (!error) propertyUpdates++;
    }
  }
  console.log(`✅ Properties updated: ${propertyUpdates}`);

  // 3. Normalize Comments
  console.log("Checking comments...");
  const { data: comments } = await supabase.from('comments').select('id, user_name, userName');
  let commentUpdates = 0;
  for (const c of comments || []) {
    const updates = {};
    const newSnake = c.user_name ? unifyAbuName(c.user_name) : null;
    const newCamel = c.userName ? unifyAbuName(c.userName) : null;

    if (newSnake && newSnake !== c.user_name) updates.user_name = newSnake;
    if (newCamel && newCamel !== c.userName) updates.userName = newCamel;

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase.from('comments').update(updates).eq('id', c.id);
      if (!error) commentUpdates++;
    }
  }
  console.log(`✅ Comments updated: ${commentUpdates}`);

  console.log("🎉 Migration Finished Successfully!");
}

runMigration().catch(console.error);
