export interface PropertyImage {
  url: string;
  type: 'image' | 'video';
  comment?: string;
}

export interface Property {
  id: string;
  name: string;
  governorate: string;
  area: string;
  type: string;
  purpose: string;
  phone: string;
  company_id: string;
  assigned_employee_id?: string;
  assigned_employee_name?: string;
  assigned_employee_phone?: string;
  assigned_employee?: { phone: string };
  images: (string | PropertyImage)[];
  location_link?: string;
  is_sold?: boolean;
  sector?: string;
  block?: string;
  street?: string;
  avenue?: string;
  plot_number?: string;
  house_number?: string;
  location: string;
  price?: string;
  details?: string;
  last_comment?: string;
  status_label?: string;
  status: 'pending' | 'approved' | 'rejected' | 'deleted';
  is_deleted?: boolean;
  deleted_at?: any;
  created_by: string;
  created_at: any;
}

export interface Company {
  id: string;
  name: string;
  company_id?: string;
  phone?: string;
  address?: string;
  created_at: any;
  is_deleted?: boolean;
  deleted_at?: any;
}

export interface Comment {
  id: string;
  property_id: string;
  user_id: string;
  user_name: string;
  text: string;
  images?: PropertyImage[];
  image_url?: string;
  user_phone?: string;
  created_at: any;
  is_deleted?: boolean;
  deleted_at?: any;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  display_name?: string;
  role: 'super_admin' | 'admin' | 'employee' | 'pending' | 'rejected';
  company_id?: string;
  created_at?: string;
  force_sign_out?: boolean;
  phone?: string;
  employee_id?: string;
  is_deleted?: boolean;
  deleted_at?: any;
}

export interface Notification {
  id: string;
  type: 'new-user' | 'property-update' | 'price-change' | 'status-change' | 'new-comment';
  title: string;
  message: string;
  user_id?: string; // Triggering user
  recipient_id?: string; // Target user (if null, it's for admins)
  property_id?: string;
  read: boolean;
  created_at: any;
}

export interface FilterOptions {
  governorate: string;
  area: string;
  type: string;
  purpose: string;
  location: string;
  marketer: string;
  status: string;
}
