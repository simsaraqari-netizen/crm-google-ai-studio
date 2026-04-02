import React from 'react';
import { 
  LayoutGrid, 
  PlusCircle, 
  Heart, 
  Bell, 
  Building2, 
  Users, 
  Trash2, 
  LogOut,
  ShieldCheck,
  ChevronRight,
  Menu,
  X,
  RefreshCw
} from 'lucide-react';
import { UserProfile, Company } from '../types';

type ViewType = 'list' | 'search-results' | 'my-listings' | 'my-favorites' | 'manage-marketers' | 'user-listings' | 'pending-properties' | 'manage-companies' | 'notifications' | 'details' | 'add' | 'edit' | 'company-details' | 'general-notifications' | 'trash';

interface SidebarProps {
  view: ViewType;
  setView: (view: ViewType) => void;
  user: UserProfile | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  company: Company | null;
  unreadCount: number;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  handleLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  view,
  setView,
  user,
  isAdmin,
  isSuperAdmin,
  company,
  unreadCount,
  isSidebarOpen,
  setIsSidebarOpen,
  handleLogout
}) => {
  const menuItems: { id: ViewType; label: string; icon: any; show: boolean; badge?: number }[] = [
    { id: 'list', label: 'كل العقارات', icon: LayoutGrid, show: true },
    { id: 'add', label: 'إضافة عقار', icon: PlusCircle, show: user?.role !== 'pending' },
    { id: 'my-listings', label: 'إعلاناتي', icon: LayoutGrid, show: user?.role !== 'pending' },
    { id: 'my-favorites', label: 'المفضلة', icon: Heart, show: true },
    { id: 'notifications', label: 'التنبيهات', icon: Bell, show: true, badge: unreadCount },
    { id: 'pending-properties', label: 'طلبات المراجعة', icon: ShieldCheck, show: isAdmin },
    { id: 'manage-companies', label: 'إدارة الشركات', icon: Building2, show: isSuperAdmin },
    { id: 'manage-marketers', label: 'إدارة المستخدمين', icon: Users, show: isAdmin },
    { id: 'trash', label: 'سلة المحذوفات', icon: Trash2, show: isAdmin },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-stone-900/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 right-0 h-full bg-white border-l border-stone-200 z-50 transition-all duration-300 ease-out ${isSidebarOpen ? 'w-72' : 'w-0 lg:w-20'} overflow-hidden flex flex-col shadow-2xl lg:shadow-none`}>
        <div className="p-6 flex items-center justify-between border-b border-stone-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200 shrink-0">
              <Building2 className="text-white" size={24} />
            </div>
            <span className={`font-black text-xl tracking-tight text-stone-900 whitespace-nowrap transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 lg:hidden'}`}>
              {company?.name || 'عقاراتي'}
            </span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 hover:bg-stone-100 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {menuItems.filter(item => item.show).map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setView(item.id);
                if (window.innerWidth < 1024) setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-4 p-3.5 rounded-xl transition-all duration-200 group relative ${
                view === item.id 
                  ? 'bg-emerald-50 text-emerald-700 shadow-sm shadow-emerald-100' 
                  : 'text-stone-500 hover:bg-stone-50 hover:text-stone-900'
              }`}
            >
              <item.icon size={22} className={`shrink-0 transition-transform duration-300 ${view === item.id ? 'scale-110' : 'group-hover:scale-110'}`} />
              <span className={`font-bold text-sm whitespace-nowrap transition-all duration-300 ${isSidebarOpen ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 lg:hidden'}`}>
                {item.label}
              </span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className={`absolute ${isSidebarOpen ? 'left-4' : 'top-2 right-2'} bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-sm`}>
                  {item.badge}
                </span>
              )}
              {view === item.id && isSidebarOpen && (
                <ChevronRight size={16} className="absolute left-4 opacity-50" />
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-stone-100 bg-stone-50/50 shrink-0 flex flex-col gap-2">
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-4 p-3.5 rounded-xl text-red-500 hover:bg-red-50 transition-all duration-200 group ${!isSidebarOpen && 'justify-center'}`}
          >
            <LogOut size={22} className="shrink-0 group-hover:scale-110 transition-transform" />
            <span className={`font-bold text-sm whitespace-nowrap transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 lg:hidden'}`}>
              تسجيل الخروج
            </span>
          </button>

          <button
            onClick={() => {
              if (window.confirm('هل أنت متأكد من رغبتك في مسح البيانات المؤقتة؟ سيؤدي هذا إلى تسجيل خروجك وإعادة تحميل التطبيق.')) {
                localStorage.clear();
                sessionStorage.clear();
                window.location.reload();
              }
            }}
            className={`w-full flex items-center gap-4 p-3.5 rounded-xl text-stone-500 hover:bg-stone-100 hover:text-stone-800 transition-all duration-200 group ${!isSidebarOpen && 'justify-center'}`}
            title="مسح البيانات وحل المشاكل"
          >
            <RefreshCw size={22} className="shrink-0 group-hover:rotate-180 transition-transform duration-500" />
            <span className={`font-bold text-xs whitespace-nowrap transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 lg:hidden'}`}>
              مسح البيانات (Clear Cache)
            </span>
          </button>
        </div>
      </aside>
    </>
  );
};
