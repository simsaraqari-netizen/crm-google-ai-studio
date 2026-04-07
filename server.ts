import 'dotenv/config';
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from '@supabase/supabase-js';
import { readSheet, writeToSheet, createSheet } from "./src/services/googleSheetsService.ts";
import { syncAppToSheets, syncSupabaseWithSheets, getSyncHistory, rollbackSyncSnapshot } from "./src/services/syncService.ts";
import { initializeCronJobs } from "./src/services/cronService.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const requireAdmin = async (idToken?: string) => {
    if (!idToken) return { ok: false as const, status: 401, message: 'Unauthorized', userId: '' };

    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(idToken);
    if (!caller) return { ok: false as const, status: 401, message: 'Unauthorized', userId: '' };

    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', caller.id)
      .maybeSingle();

    const isAdminEmail = ["simsaraqari@gmail.com", "mostafasoliman550@gmail.com"].includes(caller.email || '');
    const isAdminRole = ['admin', 'super_admin'].includes(profile?.role || '');
    if (!isAdminRole && !isAdminEmail) {
      return { ok: false as const, status: 403, message: 'Unauthorized: admin only', userId: caller.id };
    }

    return { ok: true as const, status: 200, message: 'OK', userId: caller.id };
  };

  // API routes
  app.get("/api/property/:id", async (req, res) => {
    try {
      const { data: property, error } = await supabaseAdmin.from('properties').select('*').eq('id', req.params.id).maybeSingle();
      if (error || !property) {
        return res.status(404).send('Property not found');
      }
      
      const title = property?.name || 'عقار مميز';
      const description = property?.details || 'تفاصيل العقار';
      const image = property?.images?.[0] || 'https://via.placeholder.com/600x400';

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

  app.post("/api/sync", async (req, res) => {
    const { idToken, spreadsheetId, range, data } = req.body;
    console.log(`Sync request received for spreadsheet: ${spreadsheetId}, range: ${range}`);
    try {
      const authCheck = await requireAdmin(idToken);
      if (!authCheck.ok) {
        return res.status(authCheck.status).send(authCheck.message);
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

  app.post("/api/sync/auto", async (req, res) => {
    const { idToken } = req.body || {};
    try {
      const authCheck = await requireAdmin(idToken);
      if (!authCheck.ok) {
        return res.status(authCheck.status).send(authCheck.message);
      }
      if (!process.env.GOOGLE_SHEETS_CREDENTIALS) {
        return res.status(500).send('Google Sheets credentials are not configured in the server.');
      }
      await syncSupabaseWithSheets();
      return res.json({ success: true, direction: 'sheet_to_app' });
    } catch (e: any) {
      console.error('[SYNC] /api/sync/auto error:', e);
      return res.status(500).send(e.message || 'Internal sync error');
    }
  });

  app.post("/api/sync/push", async (req, res) => {
    const { idToken } = req.body || {};
    try {
      const authCheck = await requireAdmin(idToken);
      if (!authCheck.ok) {
        return res.status(authCheck.status).send(authCheck.message);
      }
      if (!process.env.GOOGLE_SHEETS_CREDENTIALS) {
        return res.status(500).send('Google Sheets credentials are not configured in the server.');
      }
      await syncAppToSheets({ triggeredBy: authCheck.userId, note: 'manual-app-to-sheet' });
      return res.json({ success: true, direction: 'app_to_sheet' });
    } catch (e: any) {
      console.error('[SYNC] /api/sync/push error:', e);
      return res.status(500).send(e.message || 'Internal sync error');
    }
  });

  app.get("/api/sync/history", async (req, res) => {
    const bearer = req.headers.authorization?.replace('Bearer ', '');
    try {
      const authCheck = await requireAdmin(bearer);
      if (!authCheck.ok) {
        return res.status(authCheck.status).send(authCheck.message);
      }
      const limit = Number(req.query.limit || 20);
      const history = await getSyncHistory(limit);
      return res.json({ success: true, data: history });
    } catch (e: any) {
      console.error('[SYNC] /api/sync/history error:', e);
      return res.status(500).send(e.message || 'Failed to read sync history');
    }
  });

  app.post("/api/sync/rollback", async (req, res) => {
    const { idToken, snapshotId } = req.body || {};
    if (!snapshotId) return res.status(400).send('snapshotId is required');
    try {
      const authCheck = await requireAdmin(idToken);
      if (!authCheck.ok) {
        return res.status(authCheck.status).send(authCheck.message);
      }
      if (!process.env.GOOGLE_SHEETS_CREDENTIALS) {
        return res.status(500).send('Google Sheets credentials are not configured in the server.');
      }
      await rollbackSyncSnapshot(snapshotId, authCheck.userId);
      return res.json({ success: true, snapshotId });
    } catch (e: any) {
      console.error('[SYNC] /api/sync/rollback error:', e);
      return res.status(500).send(e.message || 'Rollback failed');
    }
  });

  app.post("/api/create-sheet", async (req, res) => {
    const { idToken, title } = req.body;
    try {
      const authCheck = await requireAdmin(idToken);
      if (!authCheck.ok) {
        return res.status(authCheck.status).send(authCheck.message);
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
    const { email, password, full_name, companyId, phone, role } = req.body;
    const token = req.headers.authorization?.replace('Bearer ', '');
    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token!);
    if (!caller) return res.status(401).json({ error: 'Unauthorized' });
    
    const { data: newUser, error } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name }
    });
    if (error) return res.status(500).json({ error: error.message });
    
    await supabaseAdmin.from('users').insert({
      uid: newUser.user.id, email, full_name,
      role: role || 'employee', companyId,
      phone: phone || '', createdAt: new Date().toISOString()
    });
    
    res.json({ success: true, uid: newUser.user.id });
  });

  app.post("/api/delete-user", async (req, res) => {
    const { targetUid } = req.body;
    const { error } = await supabaseAdmin.auth.admin.deleteUser(targetUid);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
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

  initializeCronJobs();
  console.log('[CRON] Daily app->sheet sync initialized');
}

startServer();
