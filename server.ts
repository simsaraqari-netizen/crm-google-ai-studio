import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from '@supabase/supabase-js';
import { readSheet, writeToSheet, createSheet } from "./src/services/googleSheetsService.ts";
import { initializeCronJobs } from "./src/services/cronService.ts";
import { syncSupabaseWithSheets } from "./src/services/syncService.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize background automated tasks
  initializeCronJobs();

  app.use(express.json());

  // API routes
  app.get("/api/property/:id", async (req, res) => {
    try {
      const { data: property, error } = await supabaseAdmin.from('properties').select('*').eq('id', req.params.id).maybeSingle();
      if (error || !property) {
        return res.status(404).send('Property not found');
      }
      
      const title = escapeHtml(property?.name || 'عقار مميز');
      const description = escapeHtml(property?.details || 'تفاصيل العقار');
      const image = escapeHtml(typeof property?.images?.[0] === 'string' ? property.images[0] : property?.images?.[0]?.url || 'https://via.placeholder.com/600x400');

      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta property="og:title" content="${title}" />
            <meta property="og:description" content="${description}" />
            <meta property="og:image" content="${image}" />
            <meta property="og:type" content="website" />
            <meta http-equiv="refresh" content="0;url=/?propertyId=${req.params.id}" />
          </head>
          <body>
            <script>window.location.href = '/?propertyId=${req.params.id}';</script>
          </body>
        </html>
      `);
    } catch (e) {
      res.status(500).send('Error');
    }
  });

  app.get("/api/admin/normalize-sheet", async (req, res) => {
    try {
      console.log('[ADMIN] Triggering manual normalization and sync...');
      await syncSupabaseWithSheets();
      res.send('<h1>Success</h1><p>Arabic digits have been normalized and the sheet has been synchronized.</p>');
    } catch (e: any) {
      res.status(500).send(`Error: ${e.message}`);
    }
  });

  app.post("/api/sync/auto", async (req, res) => {
    const { idToken } = req.body;
    try {
      const { data: { user: caller } } = await supabaseAdmin.auth.getUser(idToken);
      if (!caller) return res.status(401).send('Unauthorized');

      const { data: userDoc } = await supabaseAdmin.from('user_profiles').select('role').eq('id', caller.id).maybeSingle();
      const isAdminEmail = ["simsaraqari@gmail.com", "mostafasoliman550@gmail.com"].includes(caller.email!);
      
      if (userDoc?.role !== 'admin' && !isAdminEmail) {
        return res.status(403).send('Unauthorized');
      }

      await syncSupabaseWithSheets();
      res.send('Auto-sync completed successfully');
    } catch (e: any) {
      console.error('Auto-sync error:', e);
      res.status(500).send(e.message || 'Error during auto-sync');
    }
  });

  app.post("/api/sync", async (req, res) => {
    const { idToken, spreadsheetId, range, data } = req.body;
    console.log(`Sync request received for spreadsheet: ${spreadsheetId}, range: ${range}`);
    try {
      const { data: { user: caller } } = await supabaseAdmin.auth.getUser(idToken);
      if (!caller) return res.status(401).send('Unauthorized');

      const { data: userDoc } = await supabaseAdmin.from('user_profiles').select('role').eq('id', caller.id).maybeSingle();
      const isAdminEmail = ["simsaraqari@gmail.com", "mostafasoliman550@gmail.com"].includes(caller.email!);
      
      if (userDoc?.role !== 'admin' && !isAdminEmail) {
        console.warn(`Unauthorized sync attempt by user: ${caller.id} (${caller.email})`);
        return res.status(403).send('Unauthorized: You must be an admin to sync.');
      }
      
      if (!process.env.GOOGLE_SHEETS_CREDENTIALS) {
        return res.status(500).send('Google Sheets credentials are not configured in the server.');
      }

      if (data) {
        console.log(`Writing ${data.length} rows to sheet...`);
        await writeToSheet(spreadsheetId, range, data);
        res.send('Sync successful');
      } else {
        console.log(`Reading from sheet...`);
        const sheetData = await readSheet(spreadsheetId, range);
        console.log(`Read ${sheetData?.length || 0} rows.`);
        res.json(sheetData);
      }
    } catch (e: any) {
      console.error('Sync error:', e);
      res.status(500).send(e.message || 'Internal server error during sync');
    }
  });

  app.post("/api/create-sheet", async (req, res) => {
    const { idToken, title } = req.body;
    try {
      const { data: { user: caller } } = await supabaseAdmin.auth.getUser(idToken);
      if (!caller) return res.status(401).send('Unauthorized');

      const { data: userDoc } = await supabaseAdmin.from('user_profiles').select('role').eq('id', caller.id).maybeSingle();
      const isAdminEmail = ["simsaraqari@gmail.com", "mostafasoliman550@gmail.com"].includes(caller.email!);
      
      if (userDoc?.role !== 'admin' && !isAdminEmail) {
        return res.status(403).send('Unauthorized');
      }

      if (!process.env.GOOGLE_SHEETS_CREDENTIALS) {
        return res.status(500).send('Google Sheets credentials are not configured.');
      }

      const spreadsheetId = await createSheet(title);
      res.json({ spreadsheetId });
    } catch (e: any) {
      console.error(e);
      res.status(500).send(e.message || 'Error creating sheet');
    }
  });

  app.post("/api/create-user", async (req, res) => {
    const { email, password, full_name, company_id, phone, role } = req.body;
    const token = req.headers.authorization?.replace('Bearer ', '');
    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token!);
    if (!caller) return res.status(401).json({ error: 'Unauthorized' });
    
    const { data: newUser, error } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name }
    });
    if (error) return res.status(500).json({ error: error.message });
    
    await supabaseAdmin.from('user_profiles').insert({
      id: newUser.user.id, email, full_name,
      role: role || 'employee', company_id: company_id,
      phone: phone || '', created_at: new Date().toISOString()
    });
    
    res.json({ success: true, id: newUser.user.id });
  });

  app.post("/api/update-user-password", async (req, res) => {
    const { targetUid, newPassword } = req.body;
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Missing token' });
    
    try {
      const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token);
      if (!caller) return res.status(401).json({ error: 'Unauthorized' });

      // Admin check
      const { data: userDoc } = await supabaseAdmin.from('user_profiles').select('role').eq('id', caller.id).maybeSingle();
      const isAdminEmail = ["simsaraqari@gmail.com", "mostafasoliman550@gmail.com"].includes(caller.email!);
      
      if (userDoc?.role !== 'admin' && !isAdminEmail) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const { error } = await supabaseAdmin.auth.admin.updateUserById(targetUid, { password: newPassword });
      if (error) throw error;
      
      res.json({ success: true });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message || 'Error updating password' });
    }
  });

  app.post("/api/delete-user", async (req, res) => {
    const { targetUid } = req.body;
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Missing token' });
    
    try {
      const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token);
      if (!caller) return res.status(401).json({ error: 'Unauthorized' });

      // Admin check
      const { data: userDoc } = await supabaseAdmin.from('user_profiles').select('role').eq('id', caller.id).maybeSingle();
      const isAdminEmail = ["simsaraqari@gmail.com", "mostafasoliman550@gmail.com"].includes(caller.email!);
      
      if (userDoc?.role !== 'admin' && !isAdminEmail) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const { error } = await supabaseAdmin.auth.admin.deleteUser(targetUid);
      if (error) throw error;
      
      res.json({ success: true });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message || 'Error deleting user' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
