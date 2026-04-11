import 'dotenv/config';
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { readSheet, writeToSheet, createSheet } from '../services/googleSheetsService';
import { syncAppToSheets, syncSupabaseWithSheets, getSyncHistory, rollbackSyncSnapshot } from '../services/syncService';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const app = express();

// CORS
app.use((req, res, next) => {
  const origin = req.headers.origin || '';
  const allowed =
    origin === 'https://simsaraqari-netizen.github.io' ||
    origin.endsWith('.vercel.app') ||
    origin.startsWith('http://localhost');
  if (allowed) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json());

// ── Auth helper ──
const requireAdmin = async (idToken?: string) => {
  if (!idToken) return { ok: false as const, status: 401, message: 'Unauthorized', userId: '' };
  const { data: { user: caller } } = await supabaseAdmin.auth.getUser(idToken);
  if (!caller) return { ok: false as const, status: 401, message: 'Unauthorized', userId: '' };
  const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', caller.id).maybeSingle();
  const isAdminEmail = ['simsaraqari@gmail.com', 'mostafasoliman550@gmail.com'].includes(caller.email || '');
  const isAdminRole = ['admin', 'super_admin'].includes(profile?.role || '');
  if (!isAdminRole && !isAdminEmail) return { ok: false as const, status: 403, message: 'Unauthorized: admin only', userId: caller.id };
  return { ok: true as const, status: 200, message: 'OK', userId: caller.id };
};

// ── Routes ──

app.get('/api/property/:id', async (req, res) => {
  try {
    const { data: property, error } = await supabaseAdmin.from('properties').select('*').eq('id', req.params.id).maybeSingle();
    if (error || !property) return res.status(404).send('Property not found');
    const title = property?.name || 'عقار مميز';
    const description = property?.details || 'تفاصيل العقار';
    const firstImage = property?.images?.[0];
    const imageUrl = (typeof firstImage === 'string' ? firstImage : (firstImage?.url || '')) || 'https://via.placeholder.com/600x400';
    res.send(`<!DOCTYPE html><html><head>
      <meta property="og:title" content="${title}" />
      <meta property="og:description" content="${description}" />
      <meta property="og:image" content="${imageUrl}" />
      <meta property="og:type" content="website" />
      <meta http-equiv="refresh" content="0;url=/?propertyId=${req.params.id}" />
    </head><body><script>window.location.href='/?propertyId=${req.params.id}';</script></body></html>`);
  } catch (e) { res.status(500).send('Error'); }
});

app.post('/api/sync', async (req, res) => {
  const { idToken, spreadsheetId, range, data } = req.body;
  try {
    const auth = await requireAdmin(idToken);
    if (!auth.ok) return res.status(auth.status).send(auth.message);
    if (!process.env.GOOGLE_SHEETS_CREDENTIALS) return res.status(500).send('Google Sheets credentials not configured.');
    if (data) { await writeToSheet(spreadsheetId, range, data); res.send('Sync successful'); }
    else { const sheetData = await readSheet(spreadsheetId, range); res.json(sheetData); }
  } catch (e: any) { res.status(500).send(e.message || 'Sync error'); }
});

app.post('/api/sync/auto', async (req, res) => {
  const { idToken } = req.body || {};
  try {
    const auth = await requireAdmin(idToken);
    if (!auth.ok) return res.status(auth.status).send(auth.message);
    if (!process.env.GOOGLE_SHEETS_CREDENTIALS) return res.status(500).send('Google Sheets credentials not configured.');
    await syncSupabaseWithSheets();
    res.json({ success: true, direction: 'sheet_to_app' });
  } catch (e: any) { res.status(500).send(e.message || 'Sync error'); }
});

app.post('/api/sync/push', async (req, res) => {
  const { idToken } = req.body || {};
  try {
    const auth = await requireAdmin(idToken);
    if (!auth.ok) return res.status(auth.status).send(auth.message);
    if (!process.env.GOOGLE_SHEETS_CREDENTIALS) return res.status(500).send('Google Sheets credentials not configured.');
    await syncAppToSheets({ triggeredBy: auth.userId, note: 'manual-app-to-sheet' });
    res.json({ success: true, direction: 'app_to_sheet' });
  } catch (e: any) { res.status(500).send(e.message || 'Sync error'); }
});

app.get('/api/sync/history', async (req, res) => {
  const bearer = req.headers.authorization?.replace('Bearer ', '');
  try {
    const auth = await requireAdmin(bearer);
    if (!auth.ok) return res.status(auth.status).send(auth.message);
    const history = await getSyncHistory(Number(req.query.limit || 20));
    res.json({ success: true, data: history });
  } catch (e: any) { res.status(500).send(e.message || 'Failed to read sync history'); }
});

app.post('/api/sync/rollback', async (req, res) => {
  const { idToken, snapshotId } = req.body || {};
  if (!snapshotId) return res.status(400).send('snapshotId is required');
  try {
    const auth = await requireAdmin(idToken);
    if (!auth.ok) return res.status(auth.status).send(auth.message);
    if (!process.env.GOOGLE_SHEETS_CREDENTIALS) return res.status(500).send('Google Sheets credentials not configured.');
    await rollbackSyncSnapshot(snapshotId, auth.userId);
    res.json({ success: true, snapshotId });
  } catch (e: any) { res.status(500).send(e.message || 'Rollback failed'); }
});

app.post('/api/create-sheet', async (req, res) => {
  const { idToken, title } = req.body;
  try {
    const auth = await requireAdmin(idToken);
    if (!auth.ok) return res.status(auth.status).send(auth.message);
    if (!process.env.GOOGLE_SHEETS_CREDENTIALS) return res.status(500).send('Google Sheets credentials not configured.');
    const spreadsheetId = await createSheet(title);
    res.json({ spreadsheetId });
  } catch (e: any) { res.status(500).send(e.message || 'Error creating sheet'); }
});

// /api/admin/create-user — matches what App.tsx sends
app.post('/api/admin/create-user', async (req, res) => {
  const { email, password, username, idToken } = req.body;
  try {
    const auth = await requireAdmin(idToken);
    if (!auth.ok) return res.status(auth.status).json({ message: auth.message });
    const { data: newUser, error } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name: username }
    });
    if (error) return res.status(500).json({ message: error.message });
    res.json({ success: true, user: { id: newUser.user.id } });
  } catch (e: any) { res.status(500).json({ message: e.message || 'Error creating user' }); }
});

// /api/create-user — legacy route kept for compatibility
app.post('/api/create-user', async (req, res) => {
  const { email, password, full_name, companyId, phone, role } = req.body;
  const token = req.headers.authorization?.replace('Bearer ', '');
  const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token!);
  if (!caller) return res.status(401).json({ error: 'Unauthorized' });
  const { data: newUser, error } = await supabaseAdmin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name }
  });
  if (error) return res.status(500).json({ error: error.message });
  await supabaseAdmin.from('profiles').insert({
    id: newUser.user.id, email, full_name, name: full_name,
    role: role || 'employee', company_id: companyId,
    phone: phone || '', created_at: new Date().toISOString()
  });
  res.json({ success: true, uid: newUser.user.id });
});

app.post('/api/delete-user', async (req, res) => {
  const { targetUid } = req.body;
  const { error } = await supabaseAdmin.auth.admin.deleteUser(targetUid);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

export default app;
