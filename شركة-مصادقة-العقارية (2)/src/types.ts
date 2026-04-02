export interface Property {
  id: string;
  name: string;
  governorate: string;
  area: string;
  type: string;
  purpose: string;
  phone: string;
  companyId: string;
  assignedEmployeeId?: string;
  assignedEmployeeName?: string;
  images: string[];
  locationLink?: string;
  isSold?: boolean;
  sector?: string;
  block?: string;
  street?: string;
  avenue?: string;
  plotNumber?: string;
  houseNumber?: string;
  location: string;
  price?: string;
  details?: string;
  lastComment?: string;
  statusLabel?: string;
  status: 'pending' | 'approved' | 'rejected' | 'deleted';
  isDeleted?: boolean;
  deletedAt?: any;
  createdBy: string;
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
  propertyId: string;
  userId: string;
  userName: string;
  text: string;
  images?: string[];
  imageUrl?: string;
  userPhone?: string;
  createdAt: any;
  isDeleted?: boolean;
  deletedAt?: any;
}

export interface UserProfile {
  uid: string;
  id?: string;
  email: string;
  full_name: string;
  role: 'super_admin' | 'admin' | 'employee' | 'pending' | 'rejected';
  companyId?: string;
  createdAt?: string;
  forceSignOut?: boolean;
  phone?: string;
  employeeId?: string;
  isDeleted?: boolean;
  deletedAt?: any;
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
