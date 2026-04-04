import React from 'react';
import { motion } from 'framer-motion';

export function ConfirmModal({ isOpen, onConfirm, onCancel, title, message, confirmText = "تأكيد الحذف", confirmColor = "bg-red-600 hover:bg-red-700" }: any) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl border border-stone-200"
      >
        <h3 className="text-xl font-bold mb-2 text-stone-900 text-center">{title}</h3>
        <p className="text-stone-600 mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button 
            onClick={onConfirm}
            className={`flex-1 ${confirmColor} text-white py-3 rounded-xl font-bold transition-all`}
          >
            {confirmText}
          </button>
          <button 
            onClick={onCancel}
            className="flex-1 bg-stone-100 text-stone-600 py-3 rounded-xl font-bold hover:bg-stone-200 transition-all"
          >
            إلغاء
          </button>
        </div>
      </motion.div>
    </div>
  );
}
