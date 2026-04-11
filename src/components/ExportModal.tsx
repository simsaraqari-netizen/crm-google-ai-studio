import React, { useState } from 'react';
import { X, Download, FileText, Table, FileJson, Loader2, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { formatDateTime, getPropertyCode } from '../utils';

interface ExportModalProps {
  onClose: () => void;
  selectedCompanyId: string | null;
}

type Format = 'xlsx' | 'csv' | 'json' | 'html';

const FORMATS: { id: Format; label: string; ext: string; icon: React.ReactNode; color: string }[] = [
  { id: 'xlsx',  label: 'Excel',    ext: '.xlsx', icon: <Table size={22} />,    color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  { id: 'csv',   label: 'CSV',      ext: '.csv',  icon: <FileText size={22} />, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { id: 'json',  label: 'JSON',     ext: '.json', icon: <FileJson size={22} />, color: 'text-purple-600 bg-purple-50 border-purple-200' },
  { id: 'html',  label: 'طباعة / PDF', ext: '.html', icon: <Download size={22} />, color: 'text-rose-600 bg-rose-50 border-rose-200' },
];

// ── helpers ─────────────────────────────────────────────────────────

function downloadBlob(content: BlobPart, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function buildPropertyRow(p: any, comments: any[]) {
  const propComments = comments.filter(c => c.property_id === p.id);
  const commentTexts  = propComments.map(c => c.text).join(' | ');
  const commentNames  = propComments.map(c => c.user_name || '—').join(' | ');
  const commentDates  = propComments.map(c => formatDateTime(c.created_at)).join(' | ');

  return {
    'كود العقار':          getPropertyCode(p),
    'اسم العميل':          p.name || '',
    'المحافظة':            p.governorate || '',
    'المنطقة':             p.area || '',
    'النوع':               p.type || '',
    'الغرض':               p.purpose || '',
    'الموقع':              p.location || '',
    'السعر':               p.price || '',
    'هاتف العميل':         p.phone || '',
    'هاتف ثانوي':          p.phone_2 || '',
    'القطعة':              p.block || '',
    'القسيمة':             p.plot_number || '',
    'الشارع':              p.street || '',
    'الجادة':              p.avenue || '',
    'المنزل':              p.house_number || '',
    'التوزيعة':            p.distribution || '',
    'التفاصيل':            p.details || '',
    'ملاحظة 2':            p.comments_2 || '',
    'ملاحظة 3':            p.comments_3 || '',
    'الوسم':               p.status_label || '',
    'الحالة':              p.status || '',
    'مباع':                p.is_sold ? 'نعم' : 'لا',
    'موظف الإدخال':        p.assigned_employee_name || '',
    'هاتف الموظف':         p.assigned_employee_phone || '',
    'تاريخ الإضافة':       formatDateTime(p.created_at),
    'آخر تعليق':           p.last_comment || '',
    'تاريخ آخر تعليق':     p.last_comment_at ? formatDateTime(p.last_comment_at) : '',
    'عدد التعليقات':        propComments.length,
    'نصوص التعليقات':      commentTexts,
    'أصحاب التعليقات':     commentNames,
    'تواريخ التعليقات':    commentDates,
  };
}

function buildCommentRow(c: any, p: any) {
  return {
    'كود العقار':      p ? getPropertyCode(p) : '',
    'اسم العقار':     p?.name || '',
    'المحافظة':        p?.governorate || '',
    'المنطقة':         p?.area || '',
    'صاحب التعليق':    c.user_name || '',
    'هاتف صاحب التعليق': c.user_phone || '',
    'نص التعليق':      c.text || '',
    'تاريخ التعليق':   formatDateTime(c.created_at),
  };
}

// ── HTML template ────────────────────────────────────────────────────
function buildHTMLReport(rows: ReturnType<typeof buildPropertyRow>[], commentRows: ReturnType<typeof buildCommentRow>[]) {
  const headers = Object.keys(rows[0] || {});
  const commentHeaders = Object.keys(commentRows[0] || {});
  const now = new Date().toLocaleString('ar-KW', { calendar: 'gregory' });

  const tableRows = rows.map(r =>
    `<tr>${headers.map(h => `<td>${(r as any)[h] ?? ''}</td>`).join('')}</tr>`
  ).join('');

  const commentTableRows = commentRows.map(r =>
    `<tr>${commentHeaders.map(h => `<td>${(r as any)[h] ?? ''}</td>`).join('')}</tr>`
  ).join('');

  return `<!DOCTYPE html><html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>تقرير العقارات</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1c1c1c; margin: 20px; }
  h1 { color: #065f46; font-size: 18px; margin-bottom: 4px; }
  h2 { color: #374151; font-size: 14px; margin: 24px 0 8px; border-bottom: 2px solid #d1fae5; padding-bottom: 4px; }
  p.meta { color: #6b7280; font-size: 10px; margin-bottom: 16px; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 32px; }
  th { background: #065f46; color: white; padding: 6px 8px; text-align: right; white-space: nowrap; font-size: 10px; }
  td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  tr:nth-child(even) td { background: #f0fdf4; }
  @media print { body { margin: 0; } button { display: none; } }
</style>
</head>
<body>
<button onclick="window.print()" style="background:#065f46;color:white;padding:8px 20px;border:none;border-radius:8px;cursor:pointer;font-size:13px;margin-bottom:16px;">طباعة / حفظ PDF</button>
<h1>تقرير شامل للعقارات</h1>
<p class="meta">تاريخ التصدير: ${now} — إجمالي العقارات: ${rows.length} — إجمالي التعليقات: ${commentRows.length}</p>
<h2>بيانات العقارات</h2>
<table>
  <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
  <tbody>${tableRows}</tbody>
</table>
<h2>التعليقات والملاحظات</h2>
<table>
  <thead><tr>${commentHeaders.map(h => `<th>${h}</th>`).join('')}</tr></thead>
  <tbody>${commentTableRows}</tbody>
</table>
</body></html>`;
}

// ── Component ─────────────────────────────────────────────────────────

export function ExportModal({ onClose, selectedCompanyId }: ExportModalProps) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<Format | null>(null);

  const fetchData = async () => {
    // Fetch all properties (no pagination)
    let query = supabase.from('properties').select('*').neq('status', 'deleted').order('created_at', { ascending: false });
    if (selectedCompanyId) query = query.eq('company_id', selectedCompanyId);
    const { data: properties, error: pErr } = await query;
    if (pErr) throw pErr;

    const ids = (properties || []).map(p => p.id);

    // Fetch all comments for these properties
    let comments: any[] = [];
    if (ids.length > 0) {
      // Batch in chunks of 200 to avoid large IN clauses
      const CHUNK = 200;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        const { data: cData, error: cErr } = await supabase
          .from('comments')
          .select('*')
          .in('property_id', chunk)
          .eq('is_deleted', false)
          .order('created_at', { ascending: true });
        if (cErr) throw cErr;
        comments = comments.concat(cData || []);
      }
    }

    return { properties: properties || [], comments };
  };

  const handleExport = async (format: Format) => {
    setLoading(true);
    setDone(null);
    try {
      const { properties, comments } = await fetchData();
      const rows = properties.map(p => buildPropertyRow(p, comments));
      const commentRows = comments.map(c => buildCommentRow(c, properties.find(p => p.id === c.property_id)));
      const filename = `عقارات_${new Date().toISOString().slice(0, 10)}`;

      if (format === 'xlsx') {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows),        'العقارات');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(commentRows), 'التعليقات');
        XLSX.writeFile(wb, `${filename}.xlsx`);

      } else if (format === 'csv') {
        const ws = XLSX.utils.json_to_sheet(rows);
        const csv = XLSX.utils.sheet_to_csv(ws);
        downloadBlob('\uFEFF' + csv, `${filename}_عقارات.csv`, 'text/csv;charset=utf-8');
        const wsc = XLSX.utils.json_to_sheet(commentRows);
        const csvC = XLSX.utils.sheet_to_csv(wsc);
        downloadBlob('\uFEFF' + csvC, `${filename}_تعليقات.csv`, 'text/csv;charset=utf-8');

      } else if (format === 'json') {
        const payload = JSON.stringify({ properties: rows, comments: commentRows }, null, 2);
        downloadBlob(payload, `${filename}.json`, 'application/json');

      } else if (format === 'html') {
        const html = buildHTMLReport(rows, commentRows);
        const win = window.open('', '_blank');
        if (win) { win.document.write(html); win.document.close(); }
        else downloadBlob(html, `${filename}.html`, 'text/html;charset=utf-8');
      }

      setDone(format);
      toast.success('تم التصدير بنجاح');
    } catch (err: any) {
      toast.error('حدث خطأ: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-sm shadow-2xl"
        dir="rtl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-stone-100">
          <div>
            <h2 className="text-base font-black text-stone-900">تصدير البيانات</h2>
            <p className="text-[11px] text-stone-400 mt-0.5">جميع العقارات والتعليقات وبيانات الموظفين</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-lg transition-colors">
            <X size={18} className="text-stone-500" />
          </button>
        </div>

        {/* Format buttons */}
        <div className="p-4 space-y-2">
          {FORMATS.map(f => (
            <button
              key={f.id}
              onClick={() => handleExport(f.id)}
              disabled={loading}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all disabled:opacity-50 ${f.color}`}
            >
              <div className="flex items-center gap-3">
                {loading && done === null ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : done === f.id ? (
                  <CheckCircle size={20} className="text-emerald-600" />
                ) : (
                  f.icon
                )}
                <div className="text-right">
                  <p className="text-sm font-black">{f.label}</p>
                  <p className="text-[10px] opacity-70">{f.ext}</p>
                </div>
              </div>
              <Download size={16} className="opacity-50" />
            </button>
          ))}
        </div>

        <p className="text-center text-[10px] text-stone-400 pb-4">
          يشمل التصدير: العقارات، التعليقات، أسماء الموظفين، وجميع البيانات المتاحة
        </p>
      </div>
    </div>
  );
}
