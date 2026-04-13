import * as React from 'react';
import { createContext, useContext, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './AuthContext';
import { Property } from '../types';

interface PropertiesContextType {
  refreshProperties: (companyId?: string | null) => Promise<void>;
}

const PropertiesContext = createContext<PropertiesContextType | null>(null);

export function PropertiesProvider({ children }: { children: React.ReactNode }) {
  const { user, selectedCompanyId, isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();

  // Optimized Real-time - Updates only the changed item instead of refetching all
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('properties_optimized')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'properties' 
      }, (payload) => {
        const newProp = payload.new as Property;
        // Only update if it belongs to the user's company or if superadmin
        if (isSuperAdmin || newProp.companyId === (selectedCompanyId || user.companyId)) {
          queryClient.setQueryData(['properties'], (old: Property[] | undefined) => {
            if (!old) return [newProp];
            // Avoid duplicates
            if (old.some(p => p.id === newProp.id)) return old;
            return [newProp, ...old];
          });
        }
      })
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'properties' 
      }, (payload) => {
        const updatedProp = payload.new as Property;
        queryClient.setQueryData(['properties'], (old: Property[] | undefined) => {
          if (!old) return old;
          return old.map(p => p.id === updatedProp.id ? { ...p, ...updatedProp } : p);
        });
        
        // Also update individual property details if cached elsewhere
        queryClient.invalidateQueries({ queryKey: ['property', updatedProp.id] });
      })
      .on('postgres_changes', { 
        event: 'DELETE', 
        schema: 'public', 
        table: 'properties' 
      }, (payload) => {
        const deletedId = payload.old.id;
        queryClient.setQueryData(['properties'], (old: Property[] | undefined) => {
          if (!old) return old;
          return old.filter(p => p.id !== deletedId);
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, selectedCompanyId, isSuperAdmin, queryClient]);

  const refreshProperties = async (companyId?: string | null) => {
    const cid = companyId !== undefined ? companyId : (selectedCompanyId || user?.companyId);
    await queryClient.invalidateQueries({ queryKey: ['properties'] });
  };

  return (
    <PropertiesContext.Provider value={{ refreshProperties }}>
      {children}
    </PropertiesContext.Provider>
  );
}

export const usePropertiesSync = () => {
  const ctx = useContext(PropertiesContext);
  if (!ctx) throw new Error('usePropertiesSync must be used within PropertiesProvider');
  return ctx;
};
