import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { normalizeArabic } from '../utils.js'; // Note: In ESM we might need .js or helper

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing environment variables VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Redefining unifyAbuName here to avoid complex imports in a standalone script
function normalize(text) {
  if (!text) return "";
  // Simple Arabic normalization logic (matches src/utils.ts)
  return text
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[\u064B-\u0652]/g, "") // remove Harakat
    .trim();
}

function unifyName(name) {
  if (!name) return "";
  const normalized = normalize(name);
  return normalized.replace(/ابو\s+/g, "ابو");
}

async function unifyProfiles() {
  console.log("--- Unifying Profiles ---");
  const { data: profiles, error } = await supabase.from('profiles').select('id, name, full_name');
  if (error) {
    console.error("Error fetching profiles:", error);
    return;
  }

  let updatedCount = 0;
  for (const profile of profiles) {
    const newName = unifyName(profile.name);
    const newFullName = profile.full_name ? unifyName(profile.full_name) : null;

    if (newName !== profile.name || (newFullName && newFullName !== profile.full_name)) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ name: newName, full_name: newFullName })
        .eq('id', profile.id);
      
      if (updateError) {
        console.error(`Error updating profile ${profile.id}:`, updateError);
      } else {
        console.log(`Updated profile ${profile.id}: "${profile.name}" -> "${newName}"`);
        updatedCount++;
      }
    }
  }
  console.log(`Successfully updated ${updatedCount} profiles.`);
}

async function unifyProperties() {
  console.log("\n--- Unifying Properties (Assigned Employee Name) ---");
  const { data: properties, error } = await supabase.from('properties').select('id, assigned_employee_name');
  if (error) {
    console.error("Error fetching properties:", error);
    return;
  }

  let updatedCount = 0;
  for (const property of properties) {
    if (!property.assigned_employee_name) continue;

    const newName = unifyName(property.assigned_employee_name);
    if (newName !== property.assigned_employee_name) {
      const { error: updateError } = await supabase
        .from('properties')
        .update({ assigned_employee_name: newName })
        .eq('id', property.id);
      
      if (updateError) {
        console.error(`Error updating property ${property.id}:`, updateError);
      } else {
        console.log(`Updated property ${property.id}: "${property.assigned_employee_name}" -> "${newName}"`);
        updatedCount++;
      }
    }
  }
  console.log(`Successfully updated ${updatedCount} properties.`);
}

async function main() {
  try {
    await unifyProfiles();
    await unifyProperties();
    console.log("\nMaintenance completed successfully.");
  } catch (err) {
    console.error("Unexpected error:", err);
  }
}

main();
