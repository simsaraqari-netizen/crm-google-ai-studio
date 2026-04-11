export interface Property {
  id: string;
  name: string;
  title?: string;
  governorate: string;
  area: string;
  type: string;
  purpose: string;
  phone: string;
  phone_2?: string;
  companyId: string;
  assignedEmployeeId?: string;
  assignedEmployeeName?: string;
  images: any[]; // Changed to any[] to support object-based media if needed
  locationLink?: string;
  location_link?: string; // Support both naming conventions
  isSold?: boolean;
  sector?: string;
  distribution?: string;
  block?: string;
  street?: string;
  avenue?: string;
  plotNumber?: string;
  plot_number?: string;
  houseNumber?: string;
  house_number?: string;
  location: string;
  price?: string;
  details?: string;
  lastComment?: string;
  comments_2?: string;
  comments_3?: string;
  statusLabel?: string;
  status_label?: string;
  status: 'pending' | 'approved' | 'rejected' | 'deleted';
  isDeleted?: boolean;
  deletedAt?: any;
  createdBy: string;
  created_by?: string;
  created_by_name?: string;
  createdAt: any;
}

export interface Company {
  id: string;
  name: string;
  companyId?: string;
  phone?: string;
  address?: string;
  createdAt: any;
  isDeleted?: boolean;
  deletedAt?: any;
}

export interface Comment {
  id: string;
  property_id?: string;
  propertyId?: string;
  user_id?: string;
  userId?: string;
  user_name?: string;
  userName?: string;
  text: string;
  images?: any[];
  image_url?: string;
  imageUrl?: string;
  user_phone?: string;
  userPhone?: string;
  created_at?: any;
  createdAt?: any;
  is_deleted?: boolean;
  isDeleted?: boolean;
  deletedAt?: any;
}

export interface UserProfile {
  id: string; // The primary ID (mapped from uid)
  uid?: string; // Legacy support
  email: string;
  name: string;
  full_name?: string;
  role: 'super_admin' | 'admin' | 'employee' | 'pending' | 'rejected' | 'rejected';
  companyId?: string; // Legacy support
  company_id?: string;
  createdAt?: string; // Legacy support
  created_at?: string;
  forceSignOut?: boolean; // Legacy support
  force_sign_out?: boolean;
  phone?: string;
  employeeId?: string;
  isDeleted?: boolean; // Legacy support
  is_deleted?: boolean;
  deletedAt?: any; // Legacy support
  deleted_at?: any;
}

export interface Notification {
  id: string;
  type: 'new-user' | 'property-update' | 'price-change' | 'status-change' | 'new-comment';
  title: string;
  message: string;
  userId?: string; // Triggering user
  recipientId?: string; // Target user (if null, it's for admins)
  propertyId?: string;
  read: boolean;
  createdAt: any;
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
