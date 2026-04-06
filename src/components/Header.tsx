import React from 'react';
import { Menu, Building2, User } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useAuth } from '../contexts/AuthContext';
import { useCompanies } from '../hooks/useCompanies';

export const Header: React.FC = () => {
  const { setSidebarOpen } = useStore();
  const { user, isSuperAdmin, selectedCompanyId, setSelectedCompanyId } = useAuth();
  const { data: companies = [] } = useCompanies();

  const selectedCompany = companies.find(c => c.id === selectedCompanyId);

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-stone-200/50 px-6 py-4 flex items-center justify-between shadow-sm shadow-stone-100/50">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => setSidebarOpen(true)}
          className="p-2.5 hover:bg-stone-100 rounded-xl lg:hidden transition-all active:scale-95"
        >
          <Menu size={22} className="text-stone-600" />
        </button>
        <div className="flex flex-col">
          <h1 className="text-lg font-black tracking-tight text-stone-900 leading-none mb-1">
            {selectedCompany?.name || 'شركة مصادقة'}
          </h1>
          <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">نظام إدارة العقارات</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {isSuperAdmin && (
          <div className="relative group hidden sm:block">
            <select
              value={selectedCompanyId || ''}
              onChange={(e) => setSelectedCompanyId(e.target.value || null)}
              className="appearance-none bg-stone-50 border border-stone-200 text-stone-700 text-xs font-bold rounded-xl px-4 py-2.5 pr-10 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all cursor-pointer hover:bg-stone-100"
            >
              <option value="">كل الشركات</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" size={16} />
          </div>
        )}
        
        <div className="flex items-center gap-3 bg-stone-50 p-1.5 pr-4 rounded-2xl border border-stone-200/50 hover:bg-stone-100 transition-colors cursor-default group">
          <div className="flex flex-col items-end">
            <span className="text-xs font-black text-stone-900 leading-none mb-1 group-hover:text-emerald-700 transition-colors">
              {user?.full_name || 'موظف'}
            </span>
            <p className="text-[10px] text-stone-500 font-bold">
              {user?.role === 'admin' ? 'مدير النظام' : user?.role === 'pending' ? 'قيد المراجعة' : 'موظف'}
            </p>
          </div>
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-stone-200 group-hover:border-emerald-200 transition-colors">
            <User className="text-stone-400 group-hover:text-emerald-500 transition-colors" size={20} />
          </div>
        </div>
      </div>
    </header>
  );
};
