export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  pagination?: Pagination;
}

export interface User {
  id: string;
  email: string;
  name: string;
  companyName?: string;
  vatNumber?: string;
  address?: string;
  phone?: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaxRule {
  id: string;
  name: string;
  rate: number;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  vatNumber?: string;
  notes?: string;
  defaultTerms?: string;
  industry?: string;
  defaultTaxRate?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  isLabor?: boolean;
  taxRate?: number;
  taxRuleId?: string;
}

export type InvoiceStatus = 'Draft' | 'Sent' | 'Paid' | 'Overdue' | 'Cancelled';
export type RecurringFrequency = 'weekly' | 'monthly' | 'yearly';
export type PaymentGateway = 'stripe' | 'paypal' | 'none';
export type InvoiceTemplate = 'modern' | 'classic' | 'minimal';

export interface Invoice {
  id: string;
  clientId?: string;
  client?: Client;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  fromName: string;
  fromEmail: string;
  fromAddress: string;
  toName: string;
  toEmail: string;
  toAddress: string;
  clientVatNumber?: string;
  lineItems: LineItem[];
  notes: string;
  terms: string;
  currency: string;
  taxRate: number;
  discountRate: number;
  logo?: string;
  brandColor?: string;
  status: InvoiceStatus;
  paymentGateway?: PaymentGateway;
  paymentLinkId?: string;
  reverseCharge: boolean;
  retentionRate: number;
  cisRate: number;
  template: InvoiceTemplate;
  isRecurring?: boolean;
  recurringFrequency?: RecurringFrequency;
  recurringEndDate?: string;
  lastGeneratedDate?: string;
  parentInvoiceId?: string;
  showNotes?: boolean;
  showTerms?: boolean;
  subtotal?: number;
  taxAmount?: number;
  discountAmount?: number;
  total?: number;
  amountPaid?: number;
  amountDue?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface InvoiceFilters {
  status?: InvoiceStatus;
  clientId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  isRecurring?: boolean;
  page?: number;
  limit?: number;
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'Income' | 'Expense';
  category: string;
  invoiceId?: string;
  invoice?: Invoice;
  referenceId?: string;
  receiptUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TransactionFilters {
  type?: 'Income' | 'Expense';
  category?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface FinancialReport {
  generatedDate: string;
  period: string;
  profitAndLoss: {
    revenue: number;
    costOfSales: number;
    grossProfit: number;
    expenses: { category: string; amount: number }[];
    totalExpenses: number;
    netProfit: number;
  };
  balanceSheet?: {
    assets: number;
    liabilities: number;
    equity: number;
  };
  taxEstimates?: {
    vatDue: number;
    corporationTax: number;
  };
  insights: string[];
}

export interface DashboardStats {
  totalRevenue: number;
  totalPaid: number;
  totalExpenses: number;
  netProfit: number;
  invoiceCount: number;
  clientCount: number;
  overdueCount: number;
  outstandingAmount: number;
}

export interface RevenueTrendPoint {
  date: string;
  revenue: number;
  expenses: number;
}

export interface TopExpense {
  category: string;
  amount: number;
  percentage: number;
}

export interface TaxEstimate {
  vatDue: number;
  corporationTax: number;
  effectiveRate: number;
  period: string;
}

export interface LineItemSuggestion {
  id: string;
  issue: string;
  suggestedDescription: string;
}

export interface InvoiceAuditResult {
  taxCompliance: string[];
  cisVatImplications: string[];
  lineItemSuggestions: LineItemSuggestion[];
  generalFeedback: string[];
}

export interface FinancialInsight {
  summary: string;
  recommendations: {
    type: 'overdue' | 'optimization' | 'general' | 'tax';
    title: string;
    description: string;
    actionableStep: string;
  }[];
  riskAssessment: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  action: 'Created' | 'Updated' | 'Deleted' | 'Generated';
  entityType: 'Invoice' | 'Client' | 'Transaction' | 'TaxRule';
  entityId: string;
  entityName: string;
  details: string;
}

export interface AuditLogFilters {
  action?: AuditLog['action'];
  entityType?: AuditLog['entityType'];
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface AIProviderConfig {
  provider: 'gemini' | 'ollama';
  model: string;
  apiKey?: string;
  endpoint?: string;
}

export interface AIChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface AppSettings {
  aiProvider: string;
  aiModel: string;
  aiEndpoint: string;
  invoicePrefix: string;
  autoIncrement: boolean;
  defaultCurrency: string;
  defaultTaxRate: number;
  defaultTerms: string;
  defaultPaymentGateway: PaymentGateway;
  companyName?: string;
  companyEmail?: string;
  companyAddress?: string;
  companyVatNumber?: string;
  companyPhone?: string;
  companyLogo?: string;
  theme: 'light' | 'dark' | 'system';
  notificationsEnabled: boolean;
  emailNotifications: boolean;
}

export interface ReceiptUploadResponse {
  id: string;
  url: string;
  amount?: number;
  date?: string;
  vendor?: string;
  category?: string;
  extractedText?: string;
}

export interface ReportExportResponse {
  downloadUrl: string;
  filename: string;
  format: 'pdf' | 'csv' | 'xlsx';
}
