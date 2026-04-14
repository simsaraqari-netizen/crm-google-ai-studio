import React from 'react';
import { motion } from 'framer-motion';
import { 
  ShieldCheck, 
  Users, 
  Building2, 
  RefreshCw, 
  Trash2, 
  Cpu, 
  ArrowLeft,
  ChevronLeft,
  Database,
  UserPlus,
  ArrowUpRight
} from 'lucide-react';
import { ViewType } from '../types';

interface AdminDashboardProps {
  isAdmin: boolean;
  isSuperAdmin: boolean;
  stats: {
    pendingCount: number;
    employeeCount: number;
    companyCount: number;
    duplicateCount: number;
  };
  setView: (view: ViewType) => void;
  onRepairCodes: () => void;
  onNormalizeNames: () => void;
  onSyncNow: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  isAdmin,
  isSuperAdmin,
  stats,
  setView,
  onRepairCodes,
  onNormalizeNames,
  onSyncNow
}) => {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  const cards = [
    {
      id: 'pending-properties',
      title: 'طلبات المراجعة',
      desc: 'عرض وقبول أو رفض العقارات الجديدة المقدمة من الموظفين.',
      icon: ShieldCheck,
      color: 'bg-amber-500',
      badge: stats.pendingCount > 0 ? `${stats.pendingCount} بانتظارك` : null,
      show: isAdmin
    },
    {
      id: 'manage-marketers',
      title: 'إدارة الفريق',
      desc: 'إضافة موظفين جدد، تعديل الصلاحيات، ومتابعة النشاط.',
      icon: Users,
      color: 'bg-emerald-500',
      badge: `${stats.employeeCount} موظف`,
      show: isAdmin
    },
    {
      id: 'manage-companies',
      title: 'إدارة الشركات',
      desc: 'التحكم في الشركات المشتركة، إضافة شركات جديدة، وتعديل بياناتها.',
      icon: Building2,
      color: 'bg-blue-500',
      badge: isSuperAdmin ? `${stats.companyCount} شركة` : null,
      show: isSuperAdmin
    },
    {
      id: 'trash',
      title: 'سلة المحذوفات',
      desc: 'استعادة العقارات المحذوفة أو حذفها بشكل نهائي من النظام.',
      icon: Trash2,
      color: 'bg-rose-500',
      show: isAdmin
    },
    {
      id: 'sync-tools',
      title: 'أدوات المزامنة',
      desc: 'مزامنة البيانات يدوياً مع Google Sheets وعرض سجل المزامنة.',
      icon: RefreshCw,
      color: 'bg-purple-500',
      show: isAdmin,
      action: onSyncNow,
      actionLabel: 'مزامنة الآن'
    },
    {
      id: 'maintenance',
      title: 'صيانة البيانات',
      desc: 'إصلاح الأكواد المكررة وتوحيد تنسيق الأسماء تلقائياً.',
      icon: Database,
      color: 'bg-indigo-500',
      badge: stats.duplicateCount > 0 ? `${stats.duplicateCount} تكرار` : null,
      show: isAdmin,
      secondaryActions: [
        { label: 'تأمين الأكواد', onClick: onRepairCodes },
        { label: 'توحيد الأسماء', onClick: onNormalizeNames }
      ]
    }
  ];

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8" dir="rtl">
      <div className="flex flex-col mb-10">
        <h1 className="text-3xl font-black text-stone-900 mb-2">لوحة التحكم</h1>
        <p className="text-stone-500 font-medium">مرحباً بك في مركز الإدارة، اختر أحد الأقسام للمتابعة.</p>
      </div>

      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {cards.filter(card => card.show).map((card) => (
          <motion.div
            key={card.id}
            variants={item}
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
            className="group relative overflow-hidden bg-white/60 backdrop-blur-xl border border-white/40 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:shadow-stone-200/50 transition-all cursor-pointer"
            onClick={() => !card.secondaryActions && setView(card.id as ViewType)}
          >
            {/* Background Accent */}
            <div className={`absolute top-0 right-0 w-32 h-32 ${card.color} opacity-[0.03] blur-3xl group-hover:opacity-[0.08] transition-opacity`} />
            
            <div className="flex flex-col h-full">
              <div className="flex items-start justify-between mb-6">
                <div className={`w-14 h-14 ${card.color} text-white rounded-2xl flex items-center justify-center shadow-lg shadow-${card.color.split('-')[1]}-200/50 group-hover:scale-110 transition-transform`}>
                  <card.icon size={28} />
                </div>
                {card.badge && (
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    card.badge.includes('بانتظارك') || card.badge.includes('تكرار') 
                      ? 'bg-red-100 text-red-600' 
                      : 'bg-emerald-100 text-emerald-600'
                  }`}>
                    {card.badge}
                  </span>
                )}
              </div>

              <div className="flex-1">
                <h3 className="text-xl font-black text-stone-900 mb-2 group-hover:text-emerald-600 transition-colors uppercase tracking-tight">
                  {card.title}
                </h3>
                <p className="text-sm text-stone-500 leading-relaxed font-medium">
                  {card.desc}
                </p>
              </div>

              {card.secondaryActions ? (
                <div className="mt-6 flex gap-2">
                  {card.secondaryActions.map((act, idx) => (
                    <button
                      key={idx}
                      onClick={(e) => {
                        e.stopPropagation();
                        act.onClick();
                      }}
                      className="flex-1 py-2.5 bg-stone-100/50 hover:bg-stone-100 text-stone-700 text-xs font-bold rounded-xl transition-all border border-stone-200/50"
                    >
                      {act.label}
                    </button>
                  ))}
                </div>
              ) : card.action ? (
                 <button
                  onClick={(e) => {
                    e.stopPropagation();
                    card.action?.();
                  }}
                  className="mt-6 w-full py-3 bg-stone-100/50 hover:bg-emerald-600 hover:text-white text-stone-700 text-sm font-bold rounded-xl transition-all border border-stone-200/50 flex items-center justify-center gap-2 group/btn"
                >
                  <card.icon size={16} className="group-hover/btn:rotate-180 transition-transform duration-500" />
                  {card.actionLabel}
                </button>
              ) : (
                <div className="mt-6 flex items-center text-emerald-600 font-black text-xs gap-1 group-hover:gap-2 transition-all">
                  <span>دخول القسم</span>
                  <ArrowUpRight size={14} />
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Quick Summary Footer */}
      <div className="mt-12 p-8 rounded-3xl bg-stone-900 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/20 blur-[100px] pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div>
            <h4 className="text-xl font-black mb-2 italic">نظرة عامة على النظام</h4>
            <div className="flex flex-wrap gap-6 mt-4">
              <div className="flex flex-col">
                <span className="text-stone-400 text-[10px] font-bold uppercase tracking-widest">إجمالي العقارات</span>
                <span className="text-2xl font-black">{stats.pendingCount + 4000}+</span>
              </div>
              <div className="h-10 w-px bg-white/10 hidden md:block" />
              <div className="flex flex-col">
                <span className="text-stone-400 text-[10px] font-bold uppercase tracking-widest">المستخدمين النشطين</span>
                <span className="text-2xl font-black">{stats.employeeCount}</span>
              </div>
              {isSuperAdmin && (
                <>
                  <div className="h-10 w-px bg-white/10 hidden md:block" />
                  <div className="flex flex-col">
                    <span className="text-stone-400 text-[10px] font-bold uppercase tracking-widest">الشركات المسجلة</span>
                    <span className="text-2xl font-black">{stats.companyCount}</span>
                  </div>
                </>
              )}
            </div>
          </div>
          <button 
            onClick={() => setView('list')}
            className="px-8 py-4 bg-white text-stone-900 rounded-2xl font-black hover:bg-emerald-400 hover:text-white transition-all shadow-xl active:scale-[0.98] flex items-center gap-2"
          >
            <span>عرض الموقع العام</span>
            <ArrowUpRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};
