import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from '@supabase/supabase-js';
import { readSheet, writeToSheet, createSheet, getGoogleSheetsServiceAccountEmail } from "./src/services/googleSheetsService.ts";
import { initializeCronJobs } from "./src/services/cronService.ts";
import { syncSupabaseWithSheets, syncAppToSheets, getSyncHistory, rollbackSyncSnapshot } from "./src/services/syncService.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const ADMIN_EMAILS = ["simsaraqari@gmail.com", "mostafasoliman550@gmail.com"];

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

  const requireAdmin = async (idToken?: string) => {
    if (!idToken) return { ok: false, status: 401, message: 'Unauthorized', caller: null as any };
    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(idToken);
    if (!caller) return { ok: false, status: 401, message: 'Unauthorized', caller: null as any };

    const { data: userDoc } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', caller.id)
      .maybeSingle();

    const isAdminEmail = ADMIN_EMAILS.includes(caller.email || '');
    if (userDoc?.role !== 'admin' && !isAdminEmail) {
      return { ok: false, status: 403, message: 'Unauthorized', caller };
    }
    return { ok: true, status: 200, message: 'OK', caller };
  };

  app.get("/api/google-sheets-service-account-email", (_req, res) => {
    const email = getGoogleSheetsServiceAccountEmail();
    res.json({ email });
  });

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

  app.post("/api/sync/auto", async (req, res) => {
    const { idToken } = req.body;
    try {
      const check = await requireAdmin(idToken);
      if (!check.ok) return res.status(check.status).send(check.message);

      await syncSupabaseWithSheets();
      res.send('Auto-sync completed successfully');
    } catch (e: any) {
      console.error('Auto-sync error:', e);
      res.status(500).send(e.message || 'Error during auto-sync');
    }
  });

  app.post("/api/sync/push", async (req, res) => {
    const { idToken } = req.body;
    try {
      const check = await requireAdmin(idToken);
      if (!check.ok) return res.status(check.status).send(check.message);
      await syncAppToSheets({ triggeredBy: check.caller?.id || check.caller?.email || 'admin', note: 'manual-admin-push' });
      res.send('App-to-sheet sync completed successfully');
    } catch (e: any) {
      console.error('Push-sync error:', e);
      res.status(500).send(e.message || 'Error during app-to-sheet sync');
    }
  });

  app.get("/api/sync/history", async (req, res) => {
    const idToken = String(req.headers.authorization || '').replace('Bearer ', '');
    try {
      const check = await requireAdmin(idToken);
      if (!check.ok) return res.status(check.status).send(check.message);
      const limit = Number(req.query.limit || 20);
      const history = await getSyncHistory(limit);
      res.json(history);
    } catch (e: any) {
      console.error('Sync-history error:', e);
      res.status(500).send(e.message || 'Error loading sync history');
    }
  });

  app.post("/api/sync/rollback", async (req, res) => {
    const { idToken, snapshotId } = req.body;
    try {
      const check = await requireAdmin(idToken);
      if (!check.ok) return res.status(check.status).send(check.message);
      if (!snapshotId) return res.status(400).send('snapshotId is required');
      await rollbackSyncSnapshot(snapshotId, check.caller?.id || check.caller?.email || 'admin');
      res.send('Rollback completed successfully');
    } catch (e: any) {
      console.error('Rollback error:', e);
      res.status(500).send(e.message || 'Error during rollback');
    }
  });

  app.post("/api/sync", async (req, res) => {
    const { idToken, spreadsheet_id, spreadsheetId, range, data } = req.body;
    const targetSpreadsheetId = spreadsheet_id || spreadsheetId;
    console.log(`Sync request received for spreadsheet: ${targetSpreadsheetId}, range: ${range}`);
    try {
      const check = await requireAdmin(idToken);
      if (!check.ok) return res.status(check.status).send(check.message);
      
      if (!process.env.GOOGLE_SHEETS_CREDENTIALS) {
        return res.status(500).send('Google Sheets credentials are not configured in the server.');
      }

      if (!targetSpreadsheetId) {
        return res.status(400).send('Spreadsheet ID is required.');
      }

      if (data) {
        console.log(`Writing ${data.length} rows to sheet...`);
        await writeToSheet(targetSpreadsheetId, range, data);
        res.send('Sync successful');
      } else {
        console.log(`Reading from sheet...`);
        const sheetData = await readSheet(targetSpreadsheetId, range);
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
      const check = await requireAdmin(idToken);
      if (!check.ok) return res.status(check.status).send(check.message);

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
