const fs = require('fs');

const filesToUpdate = ['src/App.tsx', 'src/types.ts', 'src/components/PropertyCard.tsx', 'src/components/PropertyForm.tsx'];

const replacements = [
  { from: /supabase\.from\('users'\)/g, to: "supabase.from('user_profiles')" },
  { from: /companyId/g, to: 'company_id' },
  { from: /assignedEmployeeId/g, to: 'assigned_employee_id' },
  { from: /assignedEmployeeName/g, to: 'assigned_employee_name' },
  { from: /assignedEmployeePhone/g, to: 'assigned_employee_phone' },
  { from: /locationLink/g, to: 'location_link' },
  { from: /isSold/g, to: 'is_sold' },
  { from: /plotNumber/g, to: 'plot_number' },
  { from: /houseNumber/g, to: 'house_number' },
  { from: /lastComment/g, to: 'last_comment' },
  { from: /statusLabel/g, to: 'status_label' },
  { from: /createdAt/g, to: 'created_at' },
  { from: /createdBy/g, to: 'created_by' },
  { from: /updatedAt/g, to: 'updated_at' },
  { from: /deletedAt/g, to: 'deleted_at' },
  { from: /isDeleted/g, to: 'is_deleted' },
  { from: /propertyId/g, to: 'property_id' },
  { from: /userId/g, to: 'user_id' },
  { from: /recipientId/g, to: 'recipient_id' },
  { from: /forceSignOut/g, to: 'force_sign_out' },
  { from: /userName/g, to: 'user_name' },
  { from: /userPhone/g, to: 'user_phone' },
  { from: /spreadsheetId/g, to: 'spreadsheet_id' }
];

for (const file of filesToUpdate) {
  if (fs.existsSync(file)) {
    let code = fs.readFileSync(file, 'utf8');
    for (const r of replacements) {
      code = code.replace(r.from, r.to);
    }
    fs.writeFileSync(file, code);
    console.log(`Updated ${file}`);
  }
}
