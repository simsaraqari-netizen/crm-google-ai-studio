import React from 'react';
import { motion } from 'framer-motion';
import { 
  ChevronRight, 
  UserPlus, 
  Eye, 
  EyeOff, 
  ChevronDown, 
  User as UserIcon, 
  Edit, 
  Trash2 
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabaseClient';
import { 
  toEnglishNumerals, 
  usernameToEmail, 
  formatRelativeDate 
} from '../utils';
import { UserProfile, Company } from '../types';

interface UserManagementProps {
  isAdmin: boolean;
  isSuperAdmin: boolean;
  user: UserProfile | null;
  companies: Company[];
  employees: UserProfile[];
  editingUser: UserProfile | null;
  setEditingUser: (user: UserProfile | null) => void;
  editUserName: string;
  setEditUserName: (name: string) => void;
  editUserPhone: string;
  setEditUserPhone: (phone: string) => void;
  editUserEmail: string;
  setEditUserEmail: (email: string) => void;
  editUserPassword: string;
  setEditUserPassword: (password: string) => void;
  showPassword: boolean;
  setShowPassword: (show: boolean) => void;
  setUserActionConfirm: (config: any) => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({
  isAdmin,
  isSuperAdmin,
  user,
  companies,
  employees,
  editingUser,
  setEditingUser,
  editUserName,
  setEditUserName,
  editUserPhone,
  setEditUserPhone,
  editUserEmail,
  setEditUserEmail,
  editUserPassword,
  setEditUserPassword,
  showPassword,
  setShowPassword,
  setUserActionConfirm,
}) => {
  return (
    <motion.div 
      key="manage-marketers-view"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6 w-full px-4 py-8"
    >
      <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-6">
        <div className="flex items-center gap-4 mb-8">
          <button 
            onClick={() => window.history.back()}
            className="p-2 hover:bg-stone-100/50 rounded-full transition-all text-stone-500 ios-glass"
          >
            <ChevronRight size={24} />
          </button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">إدارة المستخدمين</h2>
            <p className="text-sm text-stone-500">إدارة جميع الحسابات والصلحيات في النظام</p>
          </div>
        </div>

        <div className="ios-glass p-6 rounded-2xl mb-8 border border-white/20 shadow-sm">
          <h3 className="font-bold text-stone-900 mb-6 flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center">
              <UserPlus size={18} />
            </div>
            إضافة حساب جديد
          </h3>
          <form 
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const username = (form.elements.namedItem('username') as HTMLInputElement).value;
              const password = toEnglishNumerals((form.elements.namedItem('password') as HTMLInputElement).value);
              const role = (form.elements.namedItem('role') as HTMLSelectElement).value;
              const phone = toEnglishNumerals((form.elements.namedItem('phone') as HTMLInputElement).value);
              const email = (form.elements.namedItem('email') as HTMLInputElement).value;
              
              try {
                const company_id = isSuperAdmin ? (form.elements.namedItem('company_id') as HTMLSelectElement).value : user?.company_id;
                
                if (isSuperAdmin && !company_id) {
                  toast.error('يرجى اختيار شركة أولاً');
                  return;
                }
                const generatedEmail = email || usernameToEmail(username);
                
                // Check if user already exists
                const { data } = await supabase.from('user_profiles').select('*').eq('email', generatedEmail);
                
                if (data && data.length > 0) {
                  toast.error('هذا الاسم مستخدم بالفعل في النظام (سواء في شركتك، أو شركة أخرى، أو في سلة المحذوفات). الرجاء إضافة رقم أو تغيير الاسم قليلاً.');
                  return;
                }

                // Create user in Supabase Auth via API
                const session = (await supabase.auth.getSession()).data.session;
                const idToken = session?.access_token;
                if (!idToken) throw new Error('No session found');

                const response = await fetch('/api/create-user', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                    idToken, 
                    email: generatedEmail, 
                    password: password,
                    userData: {
                      full_name: username,
                      role: role,
                      company_id: company_id,
                      phone: phone || '',
                      created_at: new Date().toISOString()
                    }
                  })
                });

                if (!response.ok) {
                  const errorText = await response.text();
                  throw new Error(errorText || 'Failed to create user');
                }
                
                toast.success('تمت إضافة المستخدم بنجاح.');
                form.reset();
              } catch (err: any) {
                const errorMessage = err.message || "";
                const status = err.status;
                const code = err.code || "";
                
                if (status === 422 || status === 409 || errorMessage.includes('User already registered') || errorMessage.includes('email_already_exists') || code === 'email_exists' || errorMessage.includes('duplicate key')) {
                  toast.error('هذا الاسم أو رقم الموظف مستخدم بالفعل في النظام (سواء في شركتك، أو شركة أخرى، أو تم استخدامه وحذفه سابقاً). لا يمكن تكرار نفس البيانات، الرجاء تغيير الاسم قليلاً أو استخدام رقم موظف مختلف.');
                } else {
                  toast.error('حدث خطأ: ' + err.message);
                }
              }
            }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {isSuperAdmin && (
              <div className="space-y-1 md:col-span-2">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider px-1">الشركة</label>
                <select name="company_id" className="w-full p-3 rounded-xl bg-stone-50/50 border border-stone-200 outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm appearance-none" required>
                  <option value="">اختر الشركة...</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider px-1">الاسم الكامل</label>
              <input name="username" placeholder="مثال: محمد علي" className="w-full p-3 rounded-xl bg-stone-50/50 border border-stone-200 outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm" required />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider px-1">كلمة المرور</label>
              <div className="relative">
                <input name="password" type={showPassword ? "text" : "password"} placeholder="••••••••" className="w-full p-3 rounded-xl bg-stone-50/50 border border-stone-200 outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm" required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider px-1">رقم الهاتف (اختياري)</label>
              <input name="phone" placeholder="99xxxxxx" className="w-full p-3 rounded-xl bg-stone-50/50 border border-stone-200 outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider px-1">البريد الإلكتروني (اختياري)</label>
              <input name="email" type="email" placeholder="user@example.com" className="w-full p-3 rounded-xl bg-stone-50/50 border border-stone-200 outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider px-1">الصلاحية</label>
              <div className="relative">
                <select name="role" className="w-full p-3 rounded-xl bg-stone-50/50 border border-stone-200 outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm appearance-none" required>
                  <option value="employee">موظف (إضافة وعرض العقارات)</option>
                  <option value="admin">ادمن الشركة (إدارة العقارات والموظفين للشركة)</option>
                </select>
                <ChevronDown size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
              </div>
              <p className="text-[10px] text-stone-400 mt-1 px-1">
                * المدير يمكنه حذف وتعديل العقارات وإدارة حسابات الموظفين التابعين لشركته.
              </p>
            </div>
            <button type="submit" className="md:col-span-2 ios-button-primary py-3 mt-2">إضافة المستخدم</button>
          </form>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="font-bold text-stone-900">قائمة المستخدمين ({employees.length})</h3>
            <button
              onClick={() => {
                setUserActionConfirm({ isOpen: true, user_id: null, action: 'bulk-delete' });
              }}
              className="text-xs text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors font-bold"
            >
              حذف الكل
            </button>
          </div>
          
          <div className="grid grid-cols-1 gap-3">
            {employees.map(emp => (
              <div key={emp.id} className="ios-glass p-4 rounded-2xl border border-white/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm group hover:shadow-md transition-all">
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center text-stone-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors shrink-0">
                    <UserIcon size={20} />
                  </div>
                  
                  {editingUser?.id === emp.id ? (
                    <div className="flex flex-col gap-3 flex-1 bg-white/30 p-3 rounded-xl border border-white/40">
                      <div className="space-y-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-stone-400 px-1">الاسم</label>
                          <input 
                            type="text"
                            value={editUserName}
                            onChange={(e) => setEditUserName(e.target.value)}
                            className="w-full p-2 text-sm border border-stone-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-white/80 shadow-sm"
                            placeholder="الاسم الكامل"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-stone-400 px-1">رقم الهاتف</label>
                          <input 
                            type="text"
                            value={editUserPhone}
                            onChange={(e) => setEditUserPhone(e.target.value)}
                            className="w-full p-2 text-sm border border-stone-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-white/80 shadow-sm"
                            placeholder="رقم الهاتف"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-stone-400 px-1">البريد الإلكتروني</label>
                          <input 
                            type="email"
                            value={editUserEmail}
                            onChange={(e) => setEditUserEmail(e.target.value)}
                            className="w-full p-2 text-sm border border-stone-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-white/80 shadow-sm"
                            placeholder="البريد الإلكتروني"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-stone-400 px-1">كلمة المرور الجديدة (اختياري)</label>
                          <div className="relative">
                            <input 
                              type={showPassword ? "text" : "password"}
                              value={editUserPassword}
                              onChange={(e) => setEditUserPassword(e.target.value)}
                              className="w-full p-2 text-sm border border-stone-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-white/80 shadow-sm"
                              placeholder="اتركها فارغة إذا لم ترد تغييرها"
                            />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button 
                          onClick={async () => {
                            if (!editUserName.trim()) return;
                            try {
                              // Update Firestore data
                              await supabase.from('user_profiles').update({ 
                                full_name: editUserName.trim(),
                                phone: editUserPhone.trim(),
                                email: editUserEmail.trim()
                              }).eq('id', emp.id);

                              // Update Password if provided
                              if (editUserPassword.trim()) {
                                if (editUserPassword.trim().length < 6) {
                                  toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
                                  return;
                                }
                                // Supabase password update for current user only
                                // For other users, it requires admin privileges which are not available in frontend
                                toast('تحديث كلمة المرور للموظفين يتطلب صلاحيات المسؤول من لوحة التحكم');
                              }

                              setEditingUser(null);
                              setEditUserPassword('');
                              toast.success('تم التحديث بنجاح');
                            } catch (err: any) {
                              toast.error('خطأ: ' + err.message);
                            }
                          }}
                          className="flex-1 py-2 bg-emerald-600 text-white text-xs rounded-lg font-bold shadow-sm hover:bg-emerald-700 transition-colors"
                        >
                          حفظ التغييرات
                        </button>
                        <button 
                          onClick={() => setEditingUser(null)}
                          className="px-4 py-2 bg-stone-100 text-stone-600 text-xs rounded-lg font-bold hover:bg-stone-200 transition-colors"
                        >
                          إلغاء
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-stone-800 truncate">{emp.full_name}</h3>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                          emp.role === 'admin' ? 'bg-purple-100 text-purple-600' :
                          emp.role === 'employee' ? 'bg-blue-100 text-blue-600' :
                          'bg-amber-100 text-amber-600'
                        }`}>
                          {emp.role === 'admin' ? 'مدير' : emp.role === 'employee' ? 'موظف' : 'معلق'}
                        </span>
                        {isSuperAdmin && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-stone-100 text-stone-600">
                            {companies.find(c => c.id === emp.company_id)?.name || 'بدون شركة'}
                          </span>
                        )}
                      </div>
                      <p className={`text-stone-500 truncate mt-0.5 ${emp.email?.endsWith('@simsaraqari.com') ? 'text-[7px] leading-tight tracking-tighter' : 'text-[11px]'}`}>
                        {emp.phone || 'بدون هاتف'} • {emp.email} • {formatRelativeDate(emp.created_at)}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 justify-end shrink-0">
                  {emp.role === 'pending' && (
                    <div className="flex items-center gap-1.5">
                      <button 
                        onClick={() => setUserActionConfirm({ isOpen: true, user_id: emp.id, action: 'approve', extraData: { full_name: emp.full_name } })}
                        className="px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-bold rounded-lg hover:bg-emerald-700 transition-all shadow-sm"
                      >
                        موافقة
                      </button>
                      <button 
                        onClick={() => setUserActionConfirm({ isOpen: true, user_id: emp.id, action: 'reject', extraData: { full_name: emp.full_name } })}
                        className="px-3 py-1.5 bg-red-50 text-red-600 text-[10px] font-bold rounded-lg hover:bg-red-100 transition-all"
                      >
                        رفض
                      </button>
                    </div>
                  )}
                  
                  {emp.role !== 'pending' && emp.id !== user?.id && (
                    <div className="relative">
                      <select
                        value={emp.role}
                        onChange={(e) => setUserActionConfirm({ isOpen: true, user_id: emp.id, action: 'change-role', extraData: { newRole: e.target.value, full_name: emp.full_name } })}
                        className="text-[10px] p-1.5 pr-6 rounded-lg border border-stone-200 bg-stone-50/50 outline-none focus:ring-2 focus:ring-emerald-500 appearance-none font-bold text-stone-600"
                      >
                        <option value="employee">موظف (إضافة وعرض العقارات)</option>
                        <option value="admin">ادمن الشركة (إدارة العقارات والموظفين للشركة)</option>
                      </select>
                      <ChevronDown size={10} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                    </div>
                  )}
                </div>
              
              {emp.id !== user?.id && (
                <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-stone-100">
                  <button 
                    onClick={() => {
                      setEditingUser(emp);
                      setEditUserName(emp.full_name);
                      setEditUserPhone(emp.phone || '');
                      setEditUserEmail(emp.email || '');
                      setEditUserPassword('');
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 text-stone-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all text-xs font-bold"
                  >
                    <Edit size={14} />
                    تعديل
                  </button>
                  <button 
                    onClick={() => setUserActionConfirm({ isOpen: true, user_id: emp.id, action: 'delete', extraData: { full_name: emp.full_name } })}
                    className="flex items-center gap-1 px-3 py-1.5 text-stone-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all text-xs font-bold"
                  >
                    <Trash2 size={14} />
                    حذف
                  </button>
                </div>
              )}
            </div>
          ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
