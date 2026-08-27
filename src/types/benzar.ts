export interface Product {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  stock: number;
  images: ProductImage[];
  category: 'MERCHANDISE' | 'FUNDRAISING' | 'DONATION';
  isActive: boolean;
  sortOrder: number;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductImage {
  driveFileId?: string;
  url: string;
  caption?: string;
}

export interface Order {
  id: string;
  orderCode: string;
  userId: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  shipping: ShippingMethod;
  shippingAddr?: { name: string; phone: string; address: string } | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; name: string; email: string };
}

export interface OrderItem {
  productId: string;
  qty: number;
  price: number;
  name: string;
}

export type OrderStatus = 'PENDING' | 'PAID' | 'VERIFIED' | 'PROCESSING' | 'READY' | 'COMPLETED' | 'CANCELLED';
export type ShippingMethod = 'PICKUP' | 'DELIVERY';
export type ProductCategory = 'MERCHANDISE' | 'FUNDRAISING' | 'DONATION';

export interface QRISInfo {
  imageUrl: string;
  merchantName: string;
  merchantId: string;
  bankName: string;
  accountNumber: string;
  instructions: string;
}

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  MERCHANDISE: 'Merchandise',
  FUNDRAISING: 'Fundraising',
  DONATION: 'Donation',
};

export const CATEGORY_COLORS: Record<ProductCategory, string> = {
  MERCHANDISE: '#F59E0B',
  FUNDRAISING: '#10B981',
  DONATION: '#6366F1',
};

export const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'Menunggu Bayar',
  PAID: 'Sudah Bayar',
  VERIFIED: 'Terverifikasi',
  PROCESSING: 'Diproses',
  READY: 'Siap Diambil',
  COMPLETED: 'Selesai',
  CANCELLED: 'Dibatalkan',
};

export const STATUS_COLORS: Record<OrderStatus, { bg: string; text: string }> = {
  PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  PAID: { bg: 'bg-blue-100', text: 'text-blue-800' },
  VERIFIED: { bg: 'bg-indigo-100', text: 'text-indigo-800' },
  PROCESSING: { bg: 'bg-purple-100', text: 'text-purple-800' },
  READY: { bg: 'bg-emerald-100', text: 'text-emerald-800' },
  COMPLETED: { bg: 'bg-green-100', text: 'text-green-800' },
  CANCELLED: { bg: 'bg-red-100', text: 'text-red-800' },
};
