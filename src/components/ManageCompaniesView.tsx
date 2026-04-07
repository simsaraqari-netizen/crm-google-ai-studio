import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronRight, Building2, UserPlus, Plus, List, Eye, Edit, Trash2, X, 
  User, Mail, Lock, EyeOff, ShieldCheck, UserCheck, UserX, AlertCircle 
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabaseClient';
import { Company, UserProfile } from '../types';

interface ManageCompaniesViewProps {
  isSuperAdmin: boolean;
  companies: Company[];
  fetchCompanies: () => void;
  setSelectedCompanyId: (id: string | null) => void;
  setView: (view: any) => void;
  setCompanyActionConfirm: (confirm: any) => void;
  setEditingCompany: (company: Company | null) => void;
  editingCompany: Company | null;
  isEditingCompany: boolean;
  setIsEditingCompany: (isEditing: boolean) => void;
  isAddingUserToCompany: boolean;
  setIsAddingUserToCompany: (isAdding: boolean) => void;
  targetCompanyForUser: Company | null;
  setTargetCompanyForUser: (company: Company | null) => void;
}

export const ManageCompaniesView: React.FC<ManageCompaniesViewProps> = ({
  isSuperAdmin,
  companies,
  fetchCompanies,
  setSelectedCompanyId,
  setView,
  setCompanyActionConfirm,
  setEditingCompany,
  editingCompany,
  isEditingCompany,
  setIsEditingCompany,
  isAddingUserToCompany,
  setIsAddingUserToCompany,
  targetCompanyForUser,
  setTargetCompanyForUser,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);

  if (!isSuperAdmin) return null;

  const handleAddCompany = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const name = (form.elements.namedItem('companyName') as HTMLInputElement).value.trim();
    const companyId = (form.elements.namedItem('companyId') as HTMLInputElement).value.trim();
    const address = (form.elements.namedItem('companyAddress') as HTMLInputElement).value.trim();
    const phone = (form.elements.namedItem('companyPhone') as HTMLInputElement).value.trim();
    
    if (!/^[0-9]{4}$/.test(companyId)) {
      toast.error('يجب أن يكون كود الشركة مكوناً من 4 أرقام');
      return;
    }

    try {
      const { error } = await supabase.from('companies').insert({
        name,
        companyId,
        address,
        phone,
        createdAt: new Date().toISOString()
      });
      
      if (error) {
        if (error.message.includes('companyId') || error.message.includes('company id') || error.message.includes('column')) {
          throw new Error('عمود companyId غير موجود في جدول companies في Supabase. يرجى إضافته كعمود من نوع text.');
        }
        throw error;
      }
      
      toast.success('تمت إضافة الشركة بنجاح');
      form.reset();
      fetchCompanies();
    } catch (err: any) {
      toast.error('حدث خطأ: ' + err.message, { duration: 5000 });
    }
  };

  const handleUpdateCompany = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingCompany) return;

    const form = e.currentTarget;
    const name = (form.elements.namedItem('name') as HTMLInputElement).value.trim();
    const companyId = (form.elements.namedItem('companyId') as HTMLInputElement).value.trim();
    
    if (!/^[0-9]{4}$/.test(companyId)) {
      toast.error('يجب أن يكون كود الشركة مكوناً من 4 أرقام');
      return;
    }

    try {
      const { error } = await supabase.from('companies').update({
        name,
        companyId
      }).eq('id', editingCompany.id);
      
      if (error) {
        if (error.message.includes('companyId') || error.message.includes('company id') || error.message.includes('column')) {
          throw new Error('عمود companyId غير موجود في جدول companies في Supabase. يرجى إضافته كعمود من نوع text.');
        }
        throw error;
      }
      
      toast.success('تم تحديث بيانات الشركة بنجاح');
      setIsEditingCompany(false);
      fetchCompanies();
    } catch (err: any) {
      toast.error('حدث خطأ: ' + err.message, { duration: 5000 });
    }
  };

  const handleAddUserToCompany = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!targetCompanyForUser) return;

    setIsSubmittingUser(true);
    const form = e.currentTarget;
    const fullName = (form.elements.namedItem('fullName') as HTMLInputElement).value;
    const username = (form.elements.namedItem('username') as HTMLInputElement).value;
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;
    const role = (form.elements.namedItem('role') as HTMLSelectElement).value;

    try {
      const response = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          username,
          password,
          role,
          companyId: targetCompanyForUser.id,
          companyName: targetCompanyForUser.name
        })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to create user');

      toast.success('تم إنشاء المستخدم بنجاح');
      setIsAddingUserToCompany(false);
      setTargetCompanyForUser(null);
    } catch (err: any) {
      toast.error('حدث خطأ: ' + err.message);
    } finally {
      setIsSubmittingUser(false);
    }
  };

  return (
    <motion.div 
      key="manage-companies-view"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4 w-full px-4 py-6"
    >
      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-5">
        <div className="flex items-center gap-4 mb-6">
          <button 
            onClick={() => setView('list')}
            className="p-2 hover:bg-stone-100/50 rounded-full transition-all text-stone-500 ios-glass"
          >
            <ChevronRight size={24} />
          </button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">إدارة الشركات</h2>
            <p className="text-sm text-stone-500">إضافة وإدارة الشركات المشتركة في النظام</p>
          </div>
        </div>

        <div className="ios-glass p-5 rounded-2xl mb-6 border border-white/20 shadow-sm">
          <h3 className="font-bold text-stone-900 mb-5 flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center">
              <Building2 size={18} />
            </div>
            إضافة شركة جديدة
          </h3>
          <form onSubmit={handleAddCompany} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider px-1">اسم الشركة</label>
              <input name="companyName" placeholder="مثال: شركة العقارات المتحدة" className="w-full p-2.5 rounded-xl bg-stone-50/50 border border-stone-200 outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm" required />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider px-1">كود الشركة (4 أرقام)</label>
              <input name="companyId" placeholder="مثال: 1234" maxLength={4} minLength={4} pattern="[0-9]{4}" inputMode="numeric" title="يجب أن يتكون من 4 أرقام" className="w-full p-2.5 rounded-xl bg-stone-50/50 border border-stone-200 outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm font-mono" required />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider px-1">رقم الهاتف (اختياري)</label>
              <input name="companyPhone" placeholder="99xxxxxx" className="w-full p-2.5 rounded-xl bg-stone-50/50 border border-stone-200 outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm" />
            </div>
            <div className="space-y-1 md:col-span-1">
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider px-1">العنوان</label>
              <input name="companyAddress" placeholder="العنوان بالتفصيل" className="w-full p-2.5 rounded-xl bg-stone-50/50 border border-stone-200 outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm" />
            </div>
            <button type="submit" className="md:col-span-2 ios-button-primary py-2.5 mt-1">إضافة الشركة</button>
          </form>
        </div>

        <div className="space-y-3">
          <h3 className="font-bold text-stone-900 px-2">قائمة الشركات ({companies.length})</h3>
          <div className="grid grid-cols-1 gap-2">
            {companies.map(company => (
              <div key={company.id} className="ios-glass p-3 rounded-2xl border border-white/20 flex flex-col gap-2 shadow-sm group hover:shadow-md transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-stone-100 rounded-xl flex items-center justify-center text-stone-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors shrink-0">
                    <Building2 size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-stone-800 truncate">{company.name}</h3>
                    <p className="text-xs text-stone-500 truncate mt-0.5">
                      {company.phone} • {company.address || 'بدون عنوان'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 py-3 border-t border-stone-100 mt-2">
                  <button 
                    onClick={() => {
                      setTargetCompanyForUser(company);
                      setIsAddingUserToCompany(true);
                    }}
                    className="w-full px-4 py-3 bg-blue-50 text-blue-600 text-sm font-bold rounded-xl hover:bg-blue-100 transition-all flex items-center justify-center gap-2"
                  >
                    <UserPlus size={18} />
                    إضافة مستخدم
                  </button>
                  
                  <button 
                    onClick={() => {
                      setSelectedCompanyId(company.id);
                      setView('add');
                      toast(`إضافة عقار لشركة: ${company.name}`);
                    }}
                    className="w-full px-4 py-3 bg-amber-50 text-amber-600 text-sm font-bold rounded-xl hover:bg-amber-100 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus size={18} />
                    إضافة عقار
                  </button>

                  <button 
                    onClick={() => {
                      setSelectedCompanyId(company.id);
                      setView('list');
                      toast(`تم الانتقال لعرض عقارات: ${company.name}`);
                    }}
                    className="w-full px-4 py-3 bg-indigo-50 text-indigo-600 text-sm font-bold rounded-xl hover:bg-indigo-100 transition-all flex items-center justify-center gap-2"
                  >
                    <List size={18} />
                    عرض العقارات
                  </button>

                  <button 
                    onClick={() => {
                      setSelectedCompanyId(company.id);
                      setView('company-details');
                      toast(`تم الانتقال لعرض بيانات: ${company.name}`);
                    }}
                    className="w-full px-4 py-3 bg-emerald-50 text-emerald-600 text-sm font-bold rounded-xl hover:bg-emerald-100 transition-all flex items-center justify-center gap-2"
                  >
                    <Eye size={18} />
                    عرض البيانات
                  </button>
                  
                  <div className="flex items-center gap-2 pt-1">
                    <button 
                      onClick={() => {
                        if (confirm(`هل أنت متأكد من تعديل بيانات شركة ${company.name}؟`)) {
                          setEditingCompany(company);
                          setIsEditingCompany(true);
                        }
                      }}
                      className="flex-1 px-4 py-3 bg-stone-50 text-stone-600 text-sm font-bold hover:bg-stone-100 rounded-xl transition-all flex items-center justify-center gap-2"
                      title="تعديل"
                    >
                      <Edit size={18} />
                      تعديل
                    </button>
                    <button 
                      onClick={() => {
                        setCompanyActionConfirm({
                          isOpen: true,
                          companyId: company.id,
                          companyName: company.name
                        });
                      }}
                      className="flex-1 px-4 py-3 bg-red-50 text-red-600 text-sm font-bold hover:bg-red-100 rounded-xl transition-all flex items-center justify-center gap-2"
                      title="حذف"
                    >
                      <Trash2 size={18} />
                      حذف
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isEditingCompany && editingCompany && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto no-scrollbar border border-stone-100">
              <div className="flex items-center justify-between sticky top-0 bg-white pb-4 z-10 border-b border-stone-50">
                <h3 className="text-xl font-bold text-stone-900 flex items-center gap-2">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                    <Edit size={20} className="text-blue-600" />
                  </div>
                  تعديل بيانات الشركة
                </h3>
                <button onClick={() => setIsEditingCompany(false)} className="p-2 hover:bg-stone-100 rounded-full transition-colors text-stone-400">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleUpdateCompany} className="space-y-5 py-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-500 mr-1">اسم الشركة</label>
                  <input name="name" defaultValue={editingCompany.name} placeholder="اسم الشركة" className="w-full p-3.5 rounded-xl bg-stone-50 border border-stone-200 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm" required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-500 mr-1">كود الشركة (ID)</label>
                  <input name="companyId" defaultValue={editingCompany.companyId || editingCompany.id.substring(0, 4)} placeholder="كود الشركة (4 أرقام)" maxLength={4} minLength={4} pattern="[0-9]{4}" inputMode="numeric" title="يجب أن يتكون من 4 أرقام" className="w-full p-3.5 rounded-xl bg-stone-50 border border-stone-200 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-mono" required />
                </div>
                <div className="flex gap-3 pt-4 sticky bottom-0 bg-white pb-2">
                  <button type="button" onClick={() => setIsEditingCompany(false)} className="flex-1 py-3.5 rounded-xl border border-stone-200 text-stone-600 font-bold hover:bg-stone-50 transition-all active:scale-[0.98]">إلغاء</button>
                  <button type="submit" className="flex-1 bg-blue-600 text-white py-3.5 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all active:scale-[0.98]">حفظ التعديلات</button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAddingUserToCompany && targetCompanyForUser && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto no-scrollbar border border-stone-100">
              <div className="flex items-center justify-between sticky top-0 bg-white pb-4 z-10 border-b border-stone-50">
                <h3 className="text-xl font-bold text-stone-900 flex items-center gap-2">
                  <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                    <UserPlus size={20} className="text-emerald-600" />
                  </div>
                  إضافة مستخدم لشركة {targetCompanyForUser.name}
                </h3>
                <button onClick={() => setIsAddingUserToCompany(false)} className="p-2 hover:bg-stone-100 rounded-full transition-colors text-stone-400">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddUserToCompany} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-500 mr-1">الاسم الكامل</label>
                  <div className="relative">
                    <User className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                    <input name="fullName" placeholder="الاسم الكامل" className="w-full pr-10 pl-4 py-3 rounded-xl bg-stone-50 border border-stone-200 outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm" required />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-500 mr-1">اسم المستخدم</label>
                  <div className="relative">
                    <Mail className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                    <input name="username" placeholder="اسم المستخدم (سيستخدم لتسجيل الدخول)" className="w-full pr-10 pl-4 py-3 rounded-xl bg-stone-50 border border-stone-200 outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm" required />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-500 mr-1">كلمة المرور</label>
                  <div className="relative">
                    <Lock className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                    <input 
                      name="password" 
                      type={showPassword ? "text" : "password"} 
                      placeholder="كلمة المرور" 
                      className="w-full pr-10 pl-12 py-3 rounded-xl bg-stone-50 border border-stone-200 outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm" 
                      required 
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-500 mr-1">الصلاحية</label>
                  <div className="relative">
                    <ShieldCheck className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                    <select name="role" className="w-full pr-10 pl-4 py-3 rounded-xl bg-stone-50 border border-stone-200 outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm appearance-none" required>
                      <option value="employee">موظف (مسوق)</option>
                      <option value="admin">مدير شركة</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setIsAddingUserToCompany(false)} className="flex-1 py-3 rounded-xl border border-stone-200 text-stone-600 font-bold hover:bg-stone-50 transition-all">إلغاء</button>
                  <button 
                    type="submit" 
                    disabled={isSubmittingUser}
                    className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all disabled:opacity-50"
                  >
                    {isSubmittingUser ? 'جاري الإنشاء...' : 'إنشاء المستخدم'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
