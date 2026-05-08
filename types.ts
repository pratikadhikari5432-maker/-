export interface PlanRequest {
  id?: string;
  userId: string;
  userEmail: string;
  businessName: string;
  planId: string;
  planName: string;
  amount: number;
  paymentDetails: {
    method: 'upi' | 'bank_transfer';
    transactionId?: string;
    accountHolder?: string;
    accountNumber?: string;
    ifsc?: string;
    upiId?: string;
  };
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt?: string;
}

export interface RevenueRecord {
  id?: string;
  amount: number;
  userId: string;
  planId: string;
  type: 'subscription';
  createdAt: string;
}

export interface WithdrawalRequest {
  id?: string;
  adminEmail: string;
  amount: number;
  paymentDetails: {
    method: 'upi' | 'bank_transfer';
    upiId?: string;
    accountNumber?: string;
    ifsc?: string;
    accountHolder?: string;
  };
  status: 'pending' | 'completed';
  createdAt: string;
}

export interface UserProfile {
  uid: string;
  businessName: string;
  email: string;
  logo?: string;
  gstin?: string;
  role?: 'admin' | 'user';
  plan?: 'free' | 'pro' | 'enterprise';
  shopPhotoUrl?: string;
  address?: string;
  phone?: string;
  pinCode?: string;
  latitude?: number;
  longitude?: number;
  currency: string;
  storageUsed?: number; // in bytes
  storageLimit?: number; // in bytes
  bankDetails?: {
    accountHolder: string;
    accountNumber: string;
    ifsc: string;
    bankName: string;
    upiId?: string;
  };
  billingTerms?: string;
  createdAt: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: string;
  amount: number;
  period?: string;
  description: string;
  features: string[];
  icon: string;
  color: string;
  popular?: boolean;
}

export interface InvoiceItem {
  id: string;
  productId?: string;
  description: string;
  hsnCode?: string;
  quantity: number;
  price: number;
  purchasePrice?: number;
  discount?: number;
  gstPercent?: number;
  total?: number;
}

export interface Invoice {
  id?: string;
  invoiceNumber: string;
  customerId?: string;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  items: InvoiceItem[];
  subTotal: number;
  taxAmount: number;
  discountAmount: number;
  roundOff: number;
  totalAmount: number;
  amountPaid: number;
  dueAmount: number;
  pdfUrl?: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  paymentStatus: 'pending' | 'partial' | 'paid';
  dueDate: string;
  createdAt: string;
  userId: string;
}

export interface Customer {
  id?: string;
  userId: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  totalPurchaseValue: number;
  totalDue: number;
  createdAt: string;
  updatedAt?: string;
}

export interface StaffAccount {
  id?: string;
  name: string;
  username: string;
  role: 'sales' | 'inventory' | 'billing';
  userId: string; // Owner's UID
  createdAt: string;
}

export interface ActivityLog {
  id?: string;
  userId: string; // Owner's UID
  subjectId: string; // Staff ID or Owner ID
  subjectName: string;
  action: 'login' | 'logout' | 'create_invoice' | 'update_inventory';
  details: string;
  timestamp: string;
  deviceInfo?: string;
}

export interface Notification {
  id?: string;
  userId: string; // Owner's UID
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success';
  read: boolean;
  createdAt: string;
}

export interface AdCopy {
  id?: string;
  title: string;
  content: string;
  platform: 'Facebook' | 'Instagram' | 'Google' | 'WhatsApp';
  userId: string;
  createdAt: string;
}

export interface Product {
  id?: string;
  userId: string;
  name: string;
  description: string;
  price: number;
  purchasePrice?: number;
  stock: number;
  lowStockThreshold?: number;
  sku?: string;
  hsnCode?: string;
  gstPercent?: number;
  barcode?: string;
  createdAt: string;
}

export interface WhatsAppConfig {
  id?: string;
  userId: string;
  keyword: string;
  replyMessage: string;
  enabled: boolean;
  createdAt: string;
}

export interface LogoDesign {
  id?: string;
  userId: string;
  imageUrl: string;
  name: string;
  createdAt: string;
}

export interface ContactRequest {
  id?: string;
  userId: string;
  userName: string;
  userEmail: string;
  subject: string;
  message: string;
  status: 'pending' | 'resolved';
  createdAt: any;
}
