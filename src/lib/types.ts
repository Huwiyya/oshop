
// lib/types.ts
export interface Manager {
  id: string;
  name: string;
  username: string;
  password: string;
  phone?: string;
  permissions?: string[];
}

export interface User {
  id: string;
  name: string;
  username: string;
  password?: string;
  phone: string;
  address?: string; // Added address field
  orderCount: number;
  debt: number;
  walletBalance?: number;
  orderCounter?: number; // Counter for sequential order numbers
}

export interface Representative {
  id: string;
  name: string;
  username: string;
  password: string;
  phone: string;
  assignedOrders: number;
}

export type OrderStatus =
  | 'pending'
  | 'processed'
  | 'ready'
  | 'shipped'
  | 'arrived_misrata' // Replaces old city specific arrivals
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'paid'
  | 'returned';

export interface Order {
  id: string;
  invoiceNumber: string; // The new sequential invoice number per user
  trackingId: string;
  userId: string;
  customerName: string;
  operationDate: string; // ISO String
  sellingPriceLYD: number;
  remainingAmount: number;
  status: OrderStatus;
  images?: string[];
  cartUrl?: string;
  siteId?: string;
  productLinks: string;
  exchangeRate: number; // Exchange rate at the time of order creation (snapshot)
  shippingExchangeRate?: number; // Specific rate for shipping calculations
  managerId?: string; // ID of the manager who created/edited the order
  // Optional detailed fields from form
  purchasePriceUSD?: number;
  downPaymentLYD?: number; // Deposit (Arbun)
  weightKG?: number; // Weight in KG

  // Financial Snapshot Fields (calculated at the time of weight entry/update)
  shippingCostUSD?: number; // Cost of shipping (e.g. 4.5 * weight)
  shippingPriceUSD?: number; // Price of shipping to customer (e.g. 5.0 * weight)
  localShippingPrice?: number; // Local shipping cost (delivery)
  totalAmountLYD?: number; // Total amount in LYD including shipping

  pricePerKilo?: number;
  pricePerKiloCurrency?: 'LYD' | 'USD';
  customerWeightCost?: number;
  customerWeightCostCurrency?: 'LYD' | 'USD';
  companyWeightCost?: number;
  companyWeightCostCurrency?: 'LYD' | 'USD';
  companyWeightCostUSD?: number;
  companyPricePerKilo?: number;
  companyPricePerKiloUSD?: number;
  customerPricePerKilo?: number;
  addedCostUSD?: number;
  addedCostNotes?: string;
  store?: string;
  paymentMethod?: 'cash' | 'card' | 'cash_dollar';
  deliveryDate?: string | null; // ISO String
  itemDescription?: string;
  shippingCostLYD?: number;
  representativeId?: string | null;
  representativeName?: string | null;
  customerAddress?: string;
  customerPhone?: string;
  collectedAmount?: number;
  customerWeightCostUSD?: number;

  // حقول الدفع المفصلة (للبوليصة)
  cashPaymentAmount?: number;      // المبلغ المدفوع نقدي/بطاقة/دولار
  walletPaymentAmount?: number;    // المبلغ المدفوع من المحفظة

  // خيار الشحن المجاني
  isFreeShipping?: boolean;        // هل الشحن مجاني للزبون؟
}


export interface Transaction {
  id: string;
  orderId?: string | null;
  customerId: string;
  customerName: string;
  date: string; // ISO String
  type: 'order' | 'payment';
  status: OrderStatus | 'paid';
  amount: number;
  description: string;
  managerId?: string;
}

export interface SubOrder {
  subOrderId: string;
  trackingId?: string;
  username: string;
  password?: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  purchasePriceUSD: number;
  sellingPriceLYD: number;
  downPaymentLYD: number;
  paymentMethod: string;
  shipmentStatus: OrderStatus;
  selectedStore: string;
  manualStoreName: string;
  productLinks: string;
  operationDate?: string; // ISO String
  deliveryDate?: string; // ISO String
  itemDescription: string;
  weightKG: number;
  pricePerKiloUSD: number;
  remainingAmount: number;
  representativeId?: string | null;
  representativeName?: string | null;
  invoiceName?: string; // For providing context in rep dashboard
}

export interface TempOrder {
  id: string;
  invoiceName: string;
  totalAmount: number;
  remainingAmount: number;
  status: OrderStatus;
  subOrders: SubOrder[];
  createdAt: string; // ISO String of when it was created
  assignedUserId?: string | null;
  assignedUserName?: string | null;
  parentInvoiceId?: string | null; // The ID of the main order it's converted to
}

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'support';
  timestamp: string; // ISO string
}

export interface Conversation {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  lastMessage: string;
  lastMessageTime: string; // ISO string
  unreadCount: number;
  messages: Message[];
}

export interface Notification {
  id: string;
  message: string;
  target: 'all' | 'specific';
  userId: string | null;
  timestamp: string;
  isRead: boolean;
}

export interface AppSettings {
  exchangeRate: number;
  shippingExchangeRate?: number; // Added
  pricePerKiloLYD: number;
  pricePerKiloUSD: number;
  customerPricePerKiloUSD?: number;
}

export interface SystemSettings {
  id: string; // Singleton ID usually
  exchangeRate: number;
  shippingExchangeRate?: number; // Added
  shippingCostUSD: number; // Cost for the company (e.g. 4.5)
  shippingPriceUSD: number; // Price for the customer (e.g. 5.0)
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  date: string; // ISO String
  managerId?: string;
  journalId?: string; // V2 Link
}

export type DepositStatus = 'pending' | 'collected' | 'cancelled';

export interface Deposit {
  id: string;
  receiptNumber: string;
  customerName: string;
  customerPhone: string;
  userId?: string;
  amount: number;
  date: string; // ISO String
  description: string;
  status: DepositStatus;
  representativeId: string | null;
  representativeName: string | null;
  collectedBy: 'admin' | 'representative';
  collectedDate: string | null;
}

export type ExternalDebtStatus = 'pending' | 'paid' | 'payment';

export interface ExternalDebt {
  id: string;
  creditorId: string;
  creditorName: string;
  amount: number;
  date: string; // ISO String
  status: ExternalDebtStatus;
  notes: string;
}

export interface Creditor {
  id: string;
  name: string;
  type: 'company' | 'person';
  currency: 'LYD' | 'USD';
  totalDebt: number;
  contactInfo?: string;
}


export interface ManualShippingLabel {
  id: string;
  invoiceNumber: string;
  operationDate: string; // ISO String
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  itemDescription: string;
  trackingId: string;
  sellingPriceLYD: number;
  remainingAmount: number;
}

export interface InstantSale {
  id: string;
  productName: string;
  costUSD: number;
  costExchangeRate: number;
  totalCostLYD: number;
  salePriceMode: 'LYD' | 'USD';
  salePriceLYD: number;
  salePriceUSD: number;
  saleExchangeRate: number;
  finalSalePriceLYD: number;
  netProfit: number;
  createdAt: string; // ISO String
}

export interface Product {
  id: string;
  name: string;
  sku?: string;
  quantity: number;
  minStockLevel: number;
  costPriceUSD: number;
  sellingPriceLYD: number;
  sellingPriceUSD?: number; // Optional secondary price
  description?: string;
  category?: string;
  createdAt?: string; // ISO String
  updatedAt?: string; // ISO String
}

export interface GlobalSite {
  id: string;
  name: string;
  url: string;
  logo?: string;
}

export interface SheinCard {
  id: string;
  code: string;
  value: number;
  currency: 'USD'; // Usually USD for Shein cards
  status: 'available' | 'used' | 'expired';
  purchaseDate: string; // ISO
  expiryDate?: string; // ISO
  usedAt?: string; // ISO
  usedForOrderId?: string;
  notes?: string;
  remainingValue?: number; // For partial usage
}

export interface TreasuryCard {
  id: string;
  name: string; // "كاش ليبي", "مصرف", "دولار كاش"
  type: 'cash_libyan' | 'bank' | 'cash_dollar' | 'usdt_treasury';
  balance: number; // in LYD for first two, USD for last one
  currency: 'LYD' | 'USD';
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export interface SheinTransaction {
  id: string;
  cardId: string;
  amount: number;
  orderId: string;
  createdAt: string; // ISO
  // Joined Fields
  orderNumber?: string;
  customerName?: string;
  customerPhone?: string;
}

export interface TreasuryTransaction {
  id: string;
  amount: number;
  type: 'deposit' | 'withdrawal';
  channel?: 'cash' | 'bank'; // Added channel
  cardId?: string; // Linked Treasury Card ID
  description: string;
  relatedOrderId?: string;
  createdAt: string; // ISO
  // Joined Fields (Optional)
  orderNumber?: string;
  customerName?: string;
  customerPhone?: string;
}

export interface WalletTransaction {
  id: string;
  userId: string;
  amount: number;
  type: 'deposit' | 'withdrawal';
  paymentMethod?: 'cash' | 'bank' | 'other'; // Added paymentMethod
  description: string;
  relatedOrderId?: string;
  createdAt: string; // ISO
  managerId?: string;
}
