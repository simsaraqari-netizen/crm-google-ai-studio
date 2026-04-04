const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = 'import "dotenv/config";\n' + code;
code = code.replace(/supabaseAdmin\.from\('users'\)/g, "supabaseAdmin.from('user_profiles')");
code = code.replace(/companyId/g, "company_id");
fs.writeFileSync('server.ts', code);
