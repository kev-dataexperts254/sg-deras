export type DeliveryMethod = 'whatsapp_standard' | 'golink_nairobi';

export type OrderStatus = 'Pending' | 'Confirmed' | 'Dispatched' | 'Delivered' | 'Cancelled';

export type StoreFilter = 'all' | 'new_arrivals' | 'sale' | 'best_sellers' | 'wishlist';

export interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  salePrice: number;
  stock: number;
  images: string[];
  variants: string[];
  isNewArrival: boolean;
  isBestSeller: boolean;
  active: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CategoryItem {
  id: string;
  name: string;
  description: string;
  image: string;
  sortOrder: number;
  active: boolean;
  updatedAt?: unknown;
}

export interface CartEntry {
  productId: string;
  variant: string;
  quantity: number;
}

export interface ResolvedCartItem {
  product: Product;
  variant: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface OrderItemSnapshot {
  productId: string;
  name: string;
  category: string;
  variant: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface CustomerDetails {
  name: string;
  phone: string;
  location: string;
  notes: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  deliveryLocation: string;
  notes: string;
  deliveryMethod: DeliveryMethod;
  status: OrderStatus;
  items: OrderItemSnapshot[];
  totalAmount: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}
