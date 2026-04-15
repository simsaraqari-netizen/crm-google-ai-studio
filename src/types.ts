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
  companyId?: string;
  company_id?: string;
  assignedEmployeeId?: string;
  assigned_employee_id?: string;
  assignedEmployeeName?: string;
  assigned_employee_name?: string;
  assigned_employee_phone?: string;
  images: any[];
  locationLink?: string;
  location_link?: string;
  isSold?: boolean;
  is_sold?: boolean;
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
  last_comment?: string;
  last_comment_at?: string;
  comments_2?: string;
  comments_3?: string;
  statusLabel?: string;
  status_label?: string;
  status: 'pending' | 'approved' | 'rejected' | 'deleted';
  isDeleted?: boolean;
  is_deleted?: boolean;
  deletedAt?: any;
  deleted_at?: any;
  createdBy?: string;
  created_by?: string;
  created_by_name?: string;
  createdAt?: any;
  created_at?: any;
  property_code?: string | number;
  propertyCode?: string | number;
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
  id: string; 
  uid?: string;
  email: string;
  name: string;
  full_name?: string;
  role: 'super_admin' | 'admin' | 'employee' | 'pending' | 'rejected';
  companyId?: string;
  company_id?: string;
  createdAt?: string;
  created_at?: string;
  forceSignOut?: boolean;
  force_sign_out?: boolean;
  phone?: string;
  employeeId?: string;
  isDeleted?: boolean;
  is_deleted?: boolean;
  deletedAt?: any;
  deleted_at?: any;
}

export interface Notification {
  id: string;
  type: 'new-user' | 'property-update' | 'price-change' | 'status-change' | 'new-comment';
  title: string;
  message: string;
  userId?: string;
  recipientId?: string;
  propertyId?: string;
  read: boolean;
  createdAt: any;
  created_at?: any;
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

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface SupabaseErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      name: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export type ViewType = 'list' | 'search-results' | 'my-listings' | 'my-favorites' | 'manage-marketers' | 'user-listings' | 'pending-properties' | 'manage-companies' | 'notifications' | 'details' | 'add' | 'edit' | 'company-details' | 'general-notifications' | 'trash' | 'admin-dashboard';
