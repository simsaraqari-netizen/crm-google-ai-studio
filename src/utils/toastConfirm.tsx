import React from 'react';
import { toast } from 'react-hot-toast';

export const toastConfirm = (message: string, onConfirm: () => void) => {
  toast((t) => (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-bold text-stone-800">{message}</p>
      <div className="flex gap-2 justify-end">
        <button
          onClick={() => {
            onConfirm();
            toast.dismiss(t.id);
          }}
          className="bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-600 transition-colors"
        >
          تأكيد
        </button>
        <button
          onClick={() => toast.dismiss(t.id)}
          className="bg-stone-100 text-stone-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-stone-200 transition-colors"
        >
          إلغاء
        </button>
      </div>
    </div>
  ), {
    duration: 5000,
    position: 'top-center',
    style: {
      borderRadius: '16px',
      background: '#fff',
      color: '#333',
      border: '1px solid #e5e7eb',
      padding: '16px',
      minWidth: '300px'
    }
  });
};
