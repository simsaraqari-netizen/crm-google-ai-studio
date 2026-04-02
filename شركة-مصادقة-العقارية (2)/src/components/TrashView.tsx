import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, RefreshCw, Building2, Users, MessageSquare, Home } from 'lucide-react';
import { Property, Company, UserProfile, Comment } from '../types';
import { PropertyCard } from './PropertyCard';

interface TrashViewProps {
  deletedProperties: Property[];
  deletedCompanies: Company[];
  deletedUsers: UserProfile[];
  deletedComments: Comment[];
  restoreProperty: (id: string) => void;
  permanentDeleteProperty: (id: string) => void;
  restoreCompany: (id: string) => void;
  permanentDeleteCompany: (id: string) => void;
  restoreUser: (id: string) => void;
  permanentDeleteUser: (id: string) => void;
  restoreComment: (id: string) => void;
  permanentDeleteComment: (id: string) => void;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  user: any;
  favorites: string[];
  toggleFavorite: (id: string) => void;
  setSelectedProperty: (p: Property) => void;
  setPrevView: (v: any) => void;
  setView: (v: any) => void;
  setPreviewImages: (images: string[]) => void;
  setPreviewIndex: (index: number) => void;
}

export function TrashView({
  deletedProperties,
  deletedCompanies,
  deletedUsers,
  deletedComments,
  restoreProperty,
  permanentDeleteProperty,
  restoreCompany,
  permanentDeleteCompany,
  restoreUser,
  permanentDeleteUser,
  restoreComment,
  permanentDeleteComment,
  isAdmin,
  isSuperAdmin,
  user,
  favorites,
  toggleFavorite,
  setSelectedProperty,
  setPrevView,
  setView,
  setPreviewImages,
  setPreviewIndex
}: TrashViewProps) {
  const [activeTab, setActiveTab] = useState<'properties' | 'companies' | 'users' | 'comments'>('properties');

  const handlePropertyClick = React.useCallback((property: Property) => {
    setSelectedProperty(property);
    setPrevView('trash');
    setView('details');
  }, [setSelectedProperty, setPrevView, setView]);

  const handleImageClick = React.useCallback((images: string[], index: number) => {
    setPreviewImages(images);
    setPreviewIndex(index);
  }, [setPreviewImages, setPreviewIndex]);

  const noop = React.useCallback(() => {}, []);

  const tabs = [
    { id: 'properties', label: 'العقارات', icon: Home, count: deletedProperties.length },
    { id: 'companies', label: 'الشركات', icon: Building2, count: deletedCompanies.length, hidden: !isSuperAdmin },
    { id: 'users', label: 'المستخدمين', icon: Users, count: deletedUsers.length },
    { id: 'comments', label: 'التعليقات', icon: MessageSquare, count: deletedComments.length },
  ];

  return (
    <div className="space-y-6 w-full px-4 py-8">
      <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-6">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-red-50 text-red-600 rounded-xl">
            <Trash2 size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">سلة المحذوفات</h2>
            <p className="text-sm text-stone-500 mt-1">
              العناصر المحذوفة ستبقى هنا لمدة 30 يوماً قبل حذفها نهائياً
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-stone-100 pb-4">
          {tabs.filter(t => !t.hidden).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === tab.id 
                  ? 'bg-red-50 text-red-700 font-bold' 
                  : 'hover:bg-stone-50 text-stone-600'
              }`}
            >
              <tab.icon size={18} />
              <span>{tab.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === tab.id ? 'bg-red-100 text-red-700' : 'bg-stone-100 text-stone-500'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-6">
          <AnimatePresence mode="wait">
            {activeTab === 'properties' && (
              <motion.div
                key="properties"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
              >
                {deletedProperties.length === 0 ? (
                  <div className="col-span-full text-center py-12 text-stone-500">
                    لا توجد عقارات في سلة المحذوفات
                  </div>
                ) : (
                  deletedProperties.map(property => (
                    <PropertyCard
                      key={property.id}
                      property={property}
                      isFavorite={favorites.includes(property.id)}
                      onFavorite={toggleFavorite}
                      onClick={handlePropertyClick}
                      onImageClick={handleImageClick}
                      isAdmin={isAdmin}
                      user={user}
                      view="trash"
                      onRestore={restoreProperty}
                      onPermanentDelete={permanentDeleteProperty}
                      onDeleteComment={noop}
                      onUserClick={noop}
                      onFilter={noop}
                    />
                  ))
                )}
              </motion.div>
            )}

            {activeTab === 'companies' && isSuperAdmin && (
              <motion.div
                key="companies"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {deletedCompanies.length === 0 ? (
                  <div className="text-center py-12 text-stone-500">
                    لا توجد شركات في سلة المحذوفات
                  </div>
                ) : (
                  deletedCompanies.map(company => (
                    <div key={company.id} className="flex items-center justify-between p-4 bg-stone-50 rounded-xl border border-stone-100">
                      <div>
                        <h3 className="font-bold text-lg">{company.name}</h3>
                        <p className="text-sm text-stone-500">كود الشركة: {company.companyId}</p>
                        {company.deletedAt && (
                          <p className="text-xs text-red-500 mt-1">
                            تاريخ الحذف: {new Date(company.deletedAt).toLocaleDateString('ar-EG')}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => restoreCompany(company.id)}
                          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="استعادة"
                        >
                          <RefreshCw size={20} />
                        </button>
                        <button
                          onClick={() => permanentDeleteCompany(company.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="حذف نهائي"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </motion.div>
            )}

            {activeTab === 'users' && (
              <motion.div
                key="users"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {deletedUsers.length === 0 ? (
                  <div className="text-center py-12 text-stone-500">
                    لا يوجد مستخدمين في سلة المحذوفات
                  </div>
                ) : (
                  deletedUsers.map(u => (
                    <div key={u.uid} className="flex items-center justify-between p-4 bg-stone-50 rounded-xl border border-stone-100">
                      <div>
                        <h3 className="font-bold text-lg">{u.full_name || 'مستخدم بدون اسم'}</h3>
                        <p className="text-sm text-stone-500">{u.email}</p>
                        {u.deletedAt && (
                          <p className="text-xs text-red-500 mt-1">
                            تاريخ الحذف: {new Date(u.deletedAt).toLocaleDateString('ar-EG')}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => restoreUser(u.uid)}
                          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="استعادة"
                        >
                          <RefreshCw size={20} />
                        </button>
                        <button
                          onClick={() => permanentDeleteUser(u.uid)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="حذف نهائي"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </motion.div>
            )}

            {activeTab === 'comments' && (
              <motion.div
                key="comments"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {deletedComments.length === 0 ? (
                  <div className="text-center py-12 text-stone-500">
                    لا توجد تعليقات في سلة المحذوفات
                  </div>
                ) : (
                  deletedComments.map(comment => (
                    <div key={comment.id} className="flex items-center justify-between p-4 bg-stone-50 rounded-xl border border-stone-100">
                      <div>
                        <p className="text-stone-800">{comment.text}</p>
                        <p className="text-sm text-stone-500 mt-1">بواسطة: {comment.userName}</p>
                        {comment.deletedAt && (
                          <p className="text-xs text-red-500 mt-1">
                            تاريخ الحذف: {new Date(comment.deletedAt).toLocaleDateString('ar-EG')}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => restoreComment(comment.id)}
                          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="استعادة"
                        >
                          <RefreshCw size={20} />
                        </button>
                        <button
                          onClick={() => permanentDeleteComment(comment.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="حذف نهائي"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
