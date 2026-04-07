import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { extractSpreadsheetId } from '../utils';
import { toast } from 'react-hot-toast';

export function SyncModal({ isOpen, onClose, onSyncFrom, onSyncTo }: any) {
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [range, setRange] = useState('Sheet1!A1:Z5000');
  
  useEffect(() => {
    if (isOpen) {
      supabase.from('settings').select('*').in('id', ['sync', '1']).then(({ data }) => {
        if (data && data.length > 0) {
          const preferred = data.find((row: any) => row.id === 'sync') || data.find((row: any) => row.id === '1') || data[0];
          setSpreadsheetId(preferred?.spreadsheet_id || preferred?.spreadsheetId || '');
        }
      });
    }
  }, [isOpen]);

  const handleSyncFrom = async (id: string, rng: string) => {
    const extractedId = extractSpreadsheetId(id);
    try {
      await supabase.from('settings').upsert({ id: 'sync', spreadsheet_id: extractedId });
    } catch (err) {
      console.error(err);
    }
    onSyncFrom(extractedId, rng);
  };

  const handleSyncTo = async (id: string, rng: string) => {
    const extractedId = extractSpreadsheetId(id);
    try {
      await supabase.from('settings').upsert({ id: 'sync', spreadsheet_id: extractedId });
    } catch (err) {
      console.error(err);
    }
    onSyncTo(extractedId, rng);
  };
  
  const handleCreateSheet = async () => {
    const title = prompt('أدخل اسم الملف الجديد:');
    if (!title) return;
    
    const session = (await supabase.auth.getSession()).data.session;
    const idToken = session?.access_token;
    if (!idToken) return;
    
    try {
      const response = await fetch('/api/create-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, title })
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to create sheet');
      }
      const { spreadsheetId } = await response.json();
      setSpreadsheetId(spreadsheetId);
      try {
        await supabase.from('settings').upsert({ id: 'sync', spreadsheet_id: spreadsheetId });
      } catch (err) {
        console.error(err);
      }
      toast.success('تم إنشاء الملف بنجاح');
    } catch (e: any) {
      console.error(e);
      toast.error(`حدث خطأ أثناء إنشاء الملف: ${e.message}`);
    }
  };

  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl border border-stone-200">
        <h3 className="text-xl font-bold mb-4 text-stone-900 text-center">مزامنة Google Sheets</h3>
        
        <div className="mb-4 p-3 bg-amber-50 border border-amber-100 rounded-lg text-[11px] text-amber-800 leading-relaxed">
          <p className="font-bold mb-1">الخطوات المطلوبة:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>قم بإنشاء ملف Google Sheet جديد.</li>
            <li>اضغط على "Share" في الملف.</li>
            <li>أضف البريد الخاص بـ Service Account (الموجود في ملف JSON الخاص بك) كـ Editor:</li>
            <li className="font-mono bg-white p-1 rounded border border-amber-200 break-all select-all text-[9px]">
              {/* This will be replaced by the user with their own service account email */}
              يمكنك العثور على البريد في ملف الـ JSON (حقل client_email)
            </li>
            <li>انسخ رابط الملف أو الـ ID الخاص به وضعه بالأسفل.</li>
          </ol>
        </div>

        <input 
          type="text" 
          placeholder="Spreadsheet ID أو رابط الملف" 
          className="w-full p-3 bg-stone-50 border border-stone-200 rounded-lg mb-3"
          value={spreadsheetId}
          onChange={(e) => setSpreadsheetId(e.target.value)}
        />
        <button 
          onClick={handleCreateSheet}
          className="w-full mb-4 text-emerald-600 text-sm font-bold hover:underline"
        >
          أو إنشاء ملف جديد
        </button>
        <input 
          type="text" 
          placeholder="Range (e.g., Sheet1!A1:Z100)" 
          className="w-full p-3 bg-stone-50 border border-stone-200 rounded-lg mb-6"
          value={range}
          onChange={(e) => setRange(e.target.value)}
        />
        <div className="flex gap-3 mb-3">
          <button 
            onClick={() => handleSyncFrom(spreadsheetId, range)}
            className="flex-1 bg-emerald-600 text-white py-3 rounded-full font-bold hover:bg-emerald-700 transition-all"
          >
            مزامنة من الشيت
          </button>
          <button 
            onClick={() => handleSyncTo(spreadsheetId, range)}
            className="flex-1 bg-stone-600 text-white py-3 rounded-full font-bold hover:bg-stone-700 transition-all"
          >
            مزامنة إلى الشيت
          </button>
        </div>
        <button 
          onClick={onClose}
          className="w-full bg-stone-100 text-stone-600 py-3 rounded-full font-bold hover:bg-stone-200 transition-all"
        >
          إلغاء
        </button>
      </div>
    </div>
  );
}
