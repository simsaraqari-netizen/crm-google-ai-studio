import React from 'react';
import { motion } from 'motion';
import { ChevronRight, Users, Shield, User as UserIcon } from 'lucide-react';
import { Company, UserProfile } from '../types';

interface CompanyDetailsViewProps {
  selectedCompanyId: string;
  companies: Company[];
  users: UserProfile[];
  setView: (view: any) => void;
}

export function CompanyDetailsView({
  selectedCompanyId,
  companies,
  users,
  setView
}: CompanyDetailsViewProps) {
  const company = companies.find(c => c.id === selectedCompanyId);
  const companyUsers = users.filter(u => u.companyId === selectedCompanyId);
  const admins = companyUsers.filter(u => u.role === 'admin');
  const employees = companyUsers.filter(u => u.role !== 'admin');

  return (
    <motion.div
      key="company-details-view"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6 w-full px-4 py-8"
    >
      <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-6">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => setView('manage-companies')}
            className="p-2 hover:bg-stone-100/50 rounded-full transition-all text-stone-500 ios-glass"
          >
            <ChevronRight size={24} />
          </button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              {company?.name || 'تفاصيل الشركة'}
            </h2>
            <p className="text-sm text-stone-500 font-mono mt-1">
              كود الشركة: {company?.companyId || selectedCompanyId}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
              <Users size={24} />
            </div>
            <div>
              <p className="text-sm text-blue-600 font-bold">إجمالي المستخدمين</p>
              <p className="text-2xl font-bold text-blue-900">
                {companyUsers.length}
              </p>
            </div>
          </div>
          <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
              <Shield size={24} />
            </div>
            <div>
              <p className="text-sm text-emerald-600 font-bold">المدراء (Admins)</p>
              <p className="text-2xl font-bold text-emerald-900">
                {admins.length}
              </p>
            </div>
          </div>
          <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
              <UserIcon size={24} />
            </div>
            <div>
              <p className="text-sm text-amber-600 font-bold">الموظفين</p>
              <p className="text-2xl font-bold text-amber-900">
                {employees.length}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-bold text-stone-900 text-lg">قائمة المستخدمين</h3>
          <div className="overflow-x-auto bg-stone-50 rounded-2xl border border-stone-100">
            <table className="w-full text-sm text-right">
              <thead className="text-xs text-stone-500 uppercase border-b border-stone-200">
                <tr>
                  <th className="px-6 py-4">الاسم</th>
                  <th className="px-6 py-4">البريد الإلكتروني</th>
                  <th className="px-6 py-4">الدور</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {companyUsers.map(user => (
                  <tr key={user.uid} className="bg-white hover:bg-stone-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-stone-900 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-500">
                        <UserIcon size={14} />
                      </div>
                      {user.full_name}
                    </td>
                    <td className="px-6 py-4 text-stone-600 font-mono text-xs">{user.email}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${user.role === 'admin' ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-700'}`}>
                        {user.role === 'admin' ? 'مدير الشركة' : 'موظف'}
                      </span>
                    </td>
                  </tr>
                ))}
                {companyUsers.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-stone-500">
                      لا يوجد مستخدمين في هذه الشركة حالياً
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
