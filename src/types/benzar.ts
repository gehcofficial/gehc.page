export interface Product {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  buyPrice?: number | null;
  stock: number;
  images: ProductImage[];
  category: 'MERCHANDISE' | 'FUNDRAISING' | 'DONATION';
  subCategory?: string | null;
  fundraisingType?: 'SERVICE' | 'PRODUCT' | null;
  isActive: boolean;
  isOnSale?: boolean;
  isPreorder?: boolean;
  fulfillmentOptions?: { dineIn?: boolean; takeaway?: boolean; delivery?: boolean; deliveryFee?: number } | null;
  cogs?: number | null;
  operatingCost?: number | null;
  yieldQty?: number | null;
  eventId?: string | null;
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

export interface OrderTimelineEntry {
  status: OrderStatus;
  at: string;
  by?: string | null;
  note?: string | null;
}

export interface Order {
  id: string;
  orderCode: string;
  userId?: string | null;
  guestName?: string | null;
  guestPhone?: string | null;
  guestEmail?: string | null;
  items: OrderItem[];
  subtotal?: number;
  discountTotal?: number;
  deliveryFee?: number;
  promoCode?: string | null;
  total: number;
  status: OrderStatus;
  shipping: ShippingMethod;
  fulfillment?: string | null;
  shippingAddr?: { name: string; phone: string; address: string } | null;
  notes?: string | null;
  cancelReason?: string | null;
  timeline?: OrderTimelineEntry[] | null;
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
export type Fulfillment = 'PICKUP' | 'DELIVERY' | 'DINE_IN' | 'TAKEAWAY';

export interface QRISInfo {
  imageUrl: string;
  merchantName: string;
  merchantId: string;
  bankName: string;
  accountNumber: string;
  whatsapp: string;
  instructions: string;
  picPhones?: Array<{ name: string; phone: string }>;
  deliveryFee?: number;
  waGroupUrl?: string | null;
}

export interface Promo {
  id: string;
  code: string;
  name: string;
  type: 'PERCENT' | 'AMOUNT';
  value: number;
  audience: 'INTERNAL' | 'GUEST' | 'ALL';
  minSpend: number;
  isActive: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  eventId?: string | null;
}

export interface Campaign {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  imageFileId?: string | null;
  target: number;
  eventId?: string | null;
  isActive: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  grandTotal?: number;
  donorCount?: number;
}

export interface CampaignDonation {
  id: string;
  donorName: string;
  amount: number;
  message?: string | null;
  status: 'PENDING' | 'PAID' | 'VERIFIED' | 'CANCELLED';
  createdAt: string;
}

export interface SalesShiftAssignment {
  id: string;
  shiftId: string;
  userId?: string | null;
  name: string;
  role: string;
  status: 'INVITED' | 'CONFIRMED' | 'DECLINED';
}

export interface SalesShift {
  id: string;
  eventId?: string | null;
  date: string;
  title: string;
  startTime: string;
  endTime: string;
  roles?: Array<{ role: string; qty: number }> | null;
  notes?: string | null;
  assignments?: SalesShiftAssignment[];
}

export interface BzpSettings {
  id: string;
  picPhones?: Array<{ name: string; phone: string }> | null;
  deliveryFee: number;
  qris?: Partial<QRISInfo> | null;
  waGroupUrl?: string | null;
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

export const FULFILLMENT_LABELS: Record<Fulfillment, string> = {
  PICKUP: 'Ambil di tempat',
  DELIVERY: 'Antar (ongkir)',
  DINE_IN: 'Dine-in',
  TAKEAWAY: 'Takeaway',
};

export const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'Menunggu Bayar',
  PAID: 'Sudah Bayar',
  VERIFIED: 'Terverifikasi',
  PROCESSING: 'Diproses',
  READY: 'Siap',
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
