import React, { useState, useEffect, memo, useMemo } from 'react';
import { 
  Edit, 
  Plus, 
  Building2, 
  User as UserIcon, 
  Tag, 
  Image as ImageIcon, 
  Trash2, 
  Upload, 
  X, 
  Info 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabaseClient';
import { compressImage } from '../utils';
import { notifyFavoriteUsers } from '../services/notificationService';
import { SearchableFilter } from './SearchableFilter';
import { LoadingSpinner } from './LoadingSpinner';
import { 
  GOVERNORATES, 
  AREAS, 
  PROPERTY_TYPES, 
  PURPOSES, 
  LOCATIONS,
  SUPER_ADMIN_EMAILS,
  SUPER_ADMIN_PHONES
} from '../constants';
import { UserProfile } from '../types';

export const PropertyForm = memo(function PropertyForm({ property, isAdmin, user, selectedCompanyId, companies, onCancel, onSave }: any) {
  const isSuperAdmin = React.useMemo(() =>
    user?.role === 'super_admin' ||
    (user?.email && SUPER_ADMIN_EMAILS.includes(user.email)) ||
    (user?.phone && SUPER_ADMIN_PHONES.includes(user.phone)),
    [user?.role, user?.email, user?.phone]
  );
    
  const [formData, setFormData] = useState({
    name: property?.name || '',
    governorate: property?.governorate || '',
    area: property?.area || '',
    phone: property?.phone || '',
    phone_2: property?.phone_2 || '',
    type: property?.type || '',
    purpose: property?.purpose || '',
    assigned_employee_id: property?.assigned_employee_id || '',
    assigned_employee_name: property?.assigned_employee_name || '',
    assigned_employee_phone: property?.assigned_employee_phone || '',
    images: (property?.images && Array.isArray(property.images) ? property.images : []).map((img: any) => 
      typeof img === 'string' ? { url: img, type: img.includes('.mp4') || img.includes('.mov') ? 'video' : 'image' } : img
    ),
    location_link: property?.location_link || '',
    is_sold: property?.is_sold || false,
    sector: property?.sector || '',
    distribution: property?.distribution || '',
    block: property?.block || '',
    street: property?.street || '',
    avenue: property?.avenue || '',
    plot_number: property?.plot_number || '',
    house_number: property?.house_number || '',
    location: property?.location || '',
    price: property?.price || '',
    details: property?.details || '',
    last_comment: property?.last_comment || '',
    comments_2: property?.comments_2 || '',
    comments_3: property?.comments_3 || '',
    status_label: property?.status_label || '',
    company_id: property?.company_id || (isSuperAdmin ? selectedCompanyId : user?.companyId)
  });

  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!user) return;
    
    const fetchEmployees = async () => {
      try {
        let employeesData: UserProfile[] = [];
        const targetCompanyId = isSuperAdmin ? (formData.company_id || selectedCompanyId) : user?.companyId;
        
        if (targetCompanyId) {
          const { data } = await supabase.from('profiles').select('*').eq('company_id', targetCompanyId);
          employeesData = (data || []) as any;
        } else if (isSuperAdmin) {
          const { data } = await supabase.from('profiles').select('*');
          employeesData = (data || []) as any;
        }

        setEmployees(employeesData);
      } catch (error) {
        console.error("PropertyForm employees fetch error:", error);
      }
    };
    
    fetchEmployees();
  }, [isSuperAdmin, selectedCompanyId, user?.companyId, formData.company_id]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (!files.length) return;

    if ((formData.images || []).length + files.length > 30) {
      toast.error('لا يمكن رفع أكثر من 30 ملفاً');
      if (e.target) e.target.value = '';
      return;
    }

    setIsUploading(true);
    try {
      const newImages = [...(formData.images || [])];
      for (const file of files) {
        let fileToUpload: Blob;
        let contentType: string;

        if (file.type.startsWith('image/')) {
          fileToUpload = await compressImage(file);
          contentType = 'image/jpeg';
        } else {
          fileToUpload = file;
          contentType = file.type || 'video/mp4';
        }

        const ext = file.type.startsWith('image/') ? 'jpg' : (file.name.split('.').pop() || 'mp4');
        const safeFileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${ext}`;
        const filePath = `properties/${safeFileName}`;

        const { error } = await supabase.storage
          .from('properties_media')
          .upload(filePath, fileToUpload, { contentType });
        if (error) throw error;

        const { data: publicUrlData } = supabase.storage.from('properties_media').getPublicUrl(filePath);
        newImages.push({ 
          url: publicUrlData.publicUrl, 
          type: file.type.startsWith('video/') ? 'video' : 'image' 
        });
      }
      setFormData(prevData => ({ ...prevData, images: newImages }));
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("حدث خطأ أثناء رفع الملفات");
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const removeImage = (index: number) => {
    const newImages = formData.images.filter((_: any, i: number) => i !== index);
    setFormData({ ...formData, images: newImages });
  };

  const [isSaving, setIsSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [missingFieldsList, setMissingFieldsList] = useState<string[]>([]);

  const handleSubmit = async (e: React.FormEvent, force: boolean = false) => {
    if (e) e.preventDefault();
    
    if (!force) {
      const missing: string[] = [];
      if (!formData.name) missing.push('اسم العميل');
      if (!formData.governorate) missing.push('المحافظة');
      if (!formData.area) missing.push('المنطقة');
      if (!formData.type) missing.push('نوع العقار');
      if (!formData.purpose) missing.push('الغرض');
      if (!formData.location) missing.push('الموقع');
      
      if (missing.length > 0) {
        setMissingFieldsList(missing);
        setShowConfirm(true);
        return;
      }
    }

    setIsSaving(true);
    setShowConfirm(false);
    
    try {
      const formattedImages = (formData.images || []).map((img: any) => 
        typeof img === 'string' ? img : (img?.url || '')
      ).filter(Boolean);

      let empId = formData.assigned_employee_id;
      let empName = formData.assigned_employee_name;

      // Handle marketer logic similar to App.tsx
      if (empName && !empId) {
        const { data: matchedEmp } = await supabase
          .from('profiles')
          .select('id')
          .eq('full_name', empName)
          .maybeSingle();
        
        if (matchedEmp) {
          empId = matchedEmp.id;
        }
      }

      const data = {
        ...formData,
        company_id: (isSuperAdmin && formData.company_id) ? formData.company_id : (user?.companyId || user?.company_id),
        assigned_employee_id: empId || null,
        assigned_employee_name: empName,
        images: formattedImages,
        price: formData.price || null,
        status: isAdmin ? (property?.status || 'approved') : 'pending'
      };

      let savedProperty: any = null;

      if (property) {
        const { data: updated, error } = await supabase
          .from('properties')
          .update(data)
          .eq('id', property.id)
          .select()
          .single();
        if (error) throw error;
        savedProperty = updated;
        await notifyFavoriteUsers(property.id, property, data);
      } else {
        const { data: inserted, error } = await supabase
          .from('properties')
          .insert({
            ...data,
            created_at: new Date().toISOString(),
            created_by: user?.uid || user?.id,
          })
          .select()
          .single();
        if (error) throw error;
        savedProperty = inserted;
      }

      toast.success(property ? 'تم تحديث العقار بنجاح' : 'تمت إضافة العقار بنجاح');
      onSave(savedProperty);
    } catch (error: any) {
      console.error("Error saving property:", error);
      toast.error(`حدث خطأ أثناء حفظ البيانات: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full ios-card overflow-hidden"
    >
      <div className="bg-emerald-500 p-6 text-white">
        <h2 className="text-2xl font-bold flex items-center gap-3 justify-center">
          {property ? <Edit size={24} /> : <Plus size={24} />}
          {property ? 'تعديل بيانات العقار' : 'إضافة عقار جديد للنظام'}
        </h2>
        <p className="text-emerald-50 mt-2 opacity-80 text-center text-sm">يرجى ملء البيانات بدقة لضمان أفضل تجربة للمستخدمين</p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Company Selection */}
        <div className="space-y-2">
          <label className="text-sm font-bold text-stone-700">الشركة</label>
          {isSuperAdmin ? (
            <SearchableFilter
              placeholder="اختر الشركة..."
              options={companies.map((c: any) => c.name)}
              value={companies.find((c: any) => c.id === (formData as any).company_id)?.name || ''}
              onChange={(val) => {
                const company = companies.find((c: any) => c.name === val);
                setFormData({
                  ...formData,
                  company_id: company ? company.id : ''
                });
              }}
            />
          ) : (
            <div className="p-4 bg-stone-50 rounded-lg border border-stone-200">
              <p className="text-sm font-bold text-stone-900">
                {companies.find((c: any) => c.id === (user?.company_id))?.name || 'غير محدد'}
              </p>
            </div>
          )}
        </div>

        {/* Section 1: Client Info */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="relative">
              <input 
                type="text"
                autoComplete="off"
                placeholder="اسم العميل"
                className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none text-sm"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>
              <input 
                type="tel"
                placeholder="هاتف المالك / العقار ١"
                className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                value={(formData as any).phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
              />
            <div className="relative">
              <input 
                type="tel"
                placeholder="هاتف المالك / العقار ٢"
                className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                value={(formData as any).phone_2}
                onChange={(e) => setFormData({...formData, phone_2: e.target.value})}
              />
            </div>
            <SearchableFilter 
              placeholder="نوع العقار"
              options={PROPERTY_TYPES}
              value={formData.type}
              onChange={(val) => setFormData({...formData, type: val})}
            />
            <SearchableFilter 
              placeholder="الغرض من العملية"
              options={PURPOSES}
              value={formData.purpose}
              onChange={(val) => setFormData({...formData, purpose: val})}
            />
          </div>
        </div>

        {/* Section 2: Location Info */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <SearchableFilter 
              placeholder="المحافظة"
              options={GOVERNORATES}
              value={formData.governorate}
              onChange={(val) => setFormData({...formData, governorate: val, area: ''})}
            />
            <SearchableFilter 
              placeholder="المنطقة"
              options={formData.governorate ? AREAS[formData.governorate] : Array.from(new Set(Object.values(AREAS).flat())).sort()}
              value={formData.area}
              onChange={(val) => setFormData({...formData, area: val})}
            />
            <SearchableFilter 
              placeholder="الموقع"
              options={LOCATIONS}
              value={formData.location}
              onChange={(val) => setFormData({...formData, location: val})}
            />
            <div className="relative">
              <input 
                placeholder="السعر (مثال: 250,000 د.ك)"
                className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none text-sm"
                value={formData.price}
                onChange={(e) => setFormData({...formData, price: e.target.value})}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input 
              type="url"
              placeholder="رابط العنوان (مثال: رابط خرائط جوجل)"
              className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
              value={formData.location_link}
              onChange={(e) => setFormData({...formData, location_link: e.target.value})}
              dir="ltr"
            />
            {isAdmin && property && (
              <div className="flex flex-col md:flex-row gap-4 w-full">
                <label className="flex-1 flex items-center gap-3 p-3 bg-stone-50 border border-stone-100 rounded-xl cursor-pointer hover:bg-stone-100 transition-colors">
                  <input 
                    type="checkbox"
                    className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500 border-stone-300"
                    checked={formData.is_sold}
                    onChange={(e) => setFormData({...formData, is_sold: e.target.checked})}
                  />
                  <span className="text-sm font-bold text-stone-700">تم بيع العقار (مباع)</span>
                </label>
                <div className="flex-1">
                  <SearchableFilter 
                    label="ملصق الحالة (يظهر على الصورة)"
                    options={['هام', 'جاد', 'مستعجل']}
                    value={formData.status_label}
                    onChange={(val) => setFormData({...formData, status_label: val})}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {[
              { id: 'sector', label: 'القطاع' },
              { id: 'block', label: 'القطعة' },
              { id: 'street', label: 'الشارع' },
              { id: 'avenue', label: 'الجادة' },
              { id: 'plot_number', label: 'القسيمة' },
              { id: 'house_number', label: 'المنزل' }
            ].map((field) => (
              <input 
                key={field.id}
                placeholder={field.label}
                className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm text-center"
                value={(formData as any)[field.id]}
                onChange={(e) => setFormData({...formData, [field.id]: e.target.value})}
              />
            ))}
            <input 
              placeholder="التوزيعة"
              className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm text-center"
              value={(formData as any).distribution}
              onChange={(e) => setFormData({...formData, distribution: e.target.value})}
            />
          </div>
        </div>

        {/* Section 3: Property Details */}
        <div className="space-y-6">
          <textarea 
            rows={3}
            placeholder="تعليقات ١ (وصف إضافي وتفاصيل العقار...)"
            className="w-full p-3 bg-stone-50 border border-stone-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm resize-none"
            value={formData.details || (formData as any).last_comment}
            onChange={(e) => setFormData({...formData, details: e.target.value})}
          />
          <textarea 
            rows={2}
            placeholder="تعليقات ٢"
            className="w-full p-3 bg-stone-50 border border-stone-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm resize-none"
            value={(formData as any).comments_2}
            onChange={(e) => setFormData({...formData, comments_2: e.target.value})}
          />
          <textarea 
            rows={2}
            placeholder="تعليقات ٣"
            className="w-full p-3 bg-stone-50 border border-stone-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm resize-none"
            value={(formData as any).comments_3}
            onChange={(e) => setFormData({...formData, comments_3: e.target.value})}
          />
        </div>

        {/* Section 4: Company and Marketer */}
        <div className="space-y-6">
          <SearchableFilter 
            placeholder="المستخدم / الموظف المسؤول"
            options={employees.map(emp => emp.name)}
            value={formData.assigned_employee_name}
            creatable={true}
            onChange={(val) => {
              const emp = employees.find(e => e.name === val);
              setFormData({
                ...formData,
                assigned_employee_id: emp ? emp.uid : '',
                assigned_employee_name: val
              });
            }}
          />
          
          <button
            type="button"
            onClick={() => {
              setFormData({
                ...formData,
                assigned_employee_id: user?.uid || '',
                assigned_employee_name: user?.name || ''
              });
            }}
            className="text-xs text-emerald-600 hover:underline mt-1"
          >
            تعيين نفسي كمسؤول عن الإدخال
          </button>

          <input 
            type="tel"
            placeholder="رقم هاتف الموظف المسؤول..."
            className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm mt-2 font-bold text-emerald-700"
            value={formData.assigned_employee_phone || ''}
            onChange={(e) => setFormData({...formData, assigned_employee_phone: e.target.value})}
          />
        </div>

        {/* Section 5: Media */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-emerald-600 border-b border-emerald-100 pb-2">
            <ImageIcon size={20} />
            <h3 className="font-bold text-lg text-center">إضافة صور أو فيديو</h3>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {formData.images.map((img: { url: string, type: 'image' | 'video' }, index: number) => (
              <motion.div 
                key={index} 
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative aspect-square rounded-2xl overflow-hidden border border-stone-200 group shadow-sm"
              >
                {img.type === 'video' ? (
                  <video src={img.url} className="w-full h-full object-cover" />
                ) : (
                  <img loading="lazy" src={img.url} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button 
                    type="button"
                    onClick={() => removeImage(index)}
                    className="bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transform hover:scale-110 transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </motion.div>
            ))}
            
            {formData.images.length < 20 && (
              <label htmlFor="image-upload" className={`aspect-square rounded-2xl border-2 border-dashed border-stone-300 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50 transition-all group ${isUploading ? 'opacity-50 cursor-wait' : ''}`}>
                <input
                  id="image-upload"
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={handleImageUpload}
                  disabled={isUploading}
                />
                <div className="bg-stone-100 p-3 rounded-full group-hover:bg-emerald-100 transition-colors">
                  <Upload className="text-stone-400 group-hover:text-emerald-600" size={24} />
                </div>
                <span className="text-xs font-bold text-stone-500 mt-2 flex items-center gap-2">
                  {isUploading ? (
                    <>
                      <LoadingSpinner size={16} className="border-emerald-600" />
                      جاري الرفع...
                    </>
                  ) : 'إضافة صور أو فيديو'}
                </span>
                <span className="text-[10px] text-stone-400 mt-1">{formData.images.length}/20</span>
              </label>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-stone-100">
          <button 
            type="submit"
            disabled={isSaving || isUploading}
            className={`flex-[2] bg-emerald-600 text-white py-4 rounded-lg font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-xl shadow-emerald-100 transform active:scale-95 ${(isSaving || isUploading) ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {isSaving ? (
              <>
                <LoadingSpinner size={20} className="border-white" />
                جاري الحفظ...
              </>
            ) : isUploading ? (
              <>
                <LoadingSpinner size={20} className="border-white" />
                جاري رفع الملفات...
              </>
            ) : (
              <>
                <Tag size={20} />
                {property ? 'تحديث البيانات' : 'حفظ العقار الجديد'}
              </>
            )}
          </button>
          <button 
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="flex-1 bg-stone-100 text-stone-600 py-4 rounded-lg font-bold hover:bg-stone-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <X size={20} />
            إلغاء
          </button>
        </div>
      </form>

      <AnimatePresence>
        {showConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3 text-amber-600">
                <Info size={24} />
                <h3 className="text-lg font-bold text-center">تنبيه: حقول ناقصة</h3>
              </div>
              <p className="text-stone-600 text-sm leading-relaxed">
                الحقول التالية لم يتم ملؤها:
                <br />
                <span className="font-bold text-stone-900">{missingFieldsList.join('، ')}</span>
                <br />
                هل أنت متأكد من رغبتك في حفظ العقار بدون هذه البيانات؟
              </p>
              <div className="flex gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => handleSubmit(null as any, true)}
                  className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all"
                >
                  نعم، احفظ الآن
                </button>
                <button 
                  type="button"
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 bg-stone-100 text-stone-600 py-3 rounded-xl font-bold hover:bg-stone-200 transition-all"
                >
                  تراجع للإكمال
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});
