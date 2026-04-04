import { supabase } from '../lib/supabaseClient';
import { Property } from '../types';

export const propertyService = {
  async getProperties(): Promise<Property[]> {
    const { data, error } = await supabase.from('properties').select('*');
    if (error) throw error;
    return data || [];
  },

  async getPropertyById(id: string): Promise<Property | null> {
    const { data, error } = await supabase.from('properties').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  },

  async insertProperty(property: Omit<Property, 'id' | 'createdAt'>): Promise<Property> {
    const { data, error } = await supabase.from('properties').insert(property).select().single();
    if (error) throw error;
    return data;
  },

  async updatePropertyById(id: string, updates: Partial<Property>): Promise<Property> {
    const { data, error } = await supabase.from('properties').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async deleteProperty(id: string): Promise<void> {
    const { error } = await supabase.from('properties').delete().eq('id', id);
    if (error) throw error;
  },

  async getPropertiesByCompanyId(companyId: string): Promise<Property[]> {
    const { data, error } = await supabase.from('properties').select('*').eq('companyId', companyId);
    if (error) throw error;
    return data || [];
  },

  async bulkUpdateProperties(ids: string[], updates: Partial<Property>): Promise<void> {
    const { error } = await supabase.from('properties').update(updates).in('id', ids);
    if (error) throw error;
  },

  async bulkDeleteProperties(ids: string[]): Promise<void> {
    const { error } = await supabase.from('properties').delete().in('id', ids);
    if (error) throw error;
  },

  async softDeleteProperty(id: string): Promise<void> {
    const { error } = await supabase.from('properties').update({ isDeleted: true, deletedAt: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  },

  async uploadImages(files: File[]): Promise<string[]> {
    const urls: string[] = [];
    for (const file of files) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `properties/${fileName}`;

      const { data, error } = await supabase.storage
        .from('images')
        .upload(filePath, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(data.path);

      urls.push(publicUrl);
    }
    return urls;
  }
};
