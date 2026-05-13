// Domain types for the InvoiceSmart iOS app.
//
// These mirror the OpenAPI 3 spec at
// `InvoiceSmart-backend/src/openapi.yaml` exactly. The backend uses a
// mixed naming convention by route group:
//   - Entity routes (clients, invoices, transactions, tax-rules,
//     audit-logs): snake_case (matches raw DB column names)
//   - Computed reports + dashboard + AI: camelCase
//   - Auth response: token + minimal user
//
// Money + rates are returned as `DECIMAL(12,2)` stringified ("1500.00").
// Always `parseFloat`/`toNum()` before arithmetic — see `lib/format.ts`.
// Rates are *percentages* — `tax_rate: "20.00"` means 20%, not 0.20.

// ───────────────────────────── Common ─────────────────────────────

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  pagination: Pagination;
}

// ─────────────────────────────── Auth ───────────────────────────────

export interface AuthResponse {
  token: string;
  user: { id: string; email: string };
}

export interface UserProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  vat_number: string | null;
  phone: string | null;
  address: Record<string, unknown> | null;
}

// Back-compat alias — screens used to import `User`. Keep until renamed.
export type User = UserProfile;

// ───────────────────────────── Clients ─────────────────────────────

export interface Client {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  company_name: string | null;
  vat_number: string | null;
  phone: string | null;
  address: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface ClientInput {
  name: string;
  email?: string | null;
  company_name?: string | null;
  vat_number?: string | null;
  phone?: string | null;
  address?: Record<string, unknown> | null;
}

// ───────────────────────────── Invoices ─────────────────────────────

export type InvoiceStatus = 'draft' | 'sent' | 'partial' | 'paid';

export interface LineItem {
  id: string;
  invoice_id: string;
  description: string;
  // DECIMAL stringified
  quantity: string;
  unit_price: string;
  amount: string;
  sort_order: number;
  created_at: string;
}

export interface LineItemInput {
  description: string;
  quantity: number;
  unit_price: number;
}

export interface Invoice {
  id: string;
  user_id: string;
  client_id: string | null;
  invoice_number: string;
  status: InvoiceStatus;
  issue_date: string | null;
  due_date: string | null;
  sent_at: string | null;
  paid_at: string | null;
  subtotal: string;
  tax_rate: string;
  tax_amount: string;
  discount_rate: string;
  discount_amount: string;
  retention_rate: string;
  retention_amount: string;
  cis_rate: string;
  cis_amount: string;
  total_amount: string;
  amount_paid: string;
  amount_due: string;
  notes: string | null;
  terms: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceFull extends Invoice {
  line_items: LineItem[];
  transactions: Transaction[];
}

export interface InvoiceInput {
  client_id?: string | null;
  status?: InvoiceStatus;
  issue_date?: string | null;
  due_date?: string | null;
  tax_rate?: number;
  discount_rate?: number;
  retention_rate?: number;
  cis_rate?: number;
  invoice_prefix?: string;
  auto_increment?: boolean;
  notes?: string | null;
  terms?: string | null;
  line_items?: LineItemInput[];
}

export interface InvoiceFilters {
  status?: InvoiceStatus;
  page?: number;
  limit?: number;
}

// ─────────────────────────── Transactions ───────────────────────────

export type TransactionType = 'expense' | 'payment';

export interface Transaction {
  id: string;
  user_id: string;
  invoice_id: string | null;
  type: TransactionType;
  amount: string;
  transaction_date: string; // YYYY-MM-DD
  category: string | null;
  description: string | null;
  payment_method: string | null;
  reference: string | null;
  notes: string | null;
  created_at: string;
}

export interface TransactionInput {
  invoice_id?: string | null;
  type: TransactionType;
  amount: number;
  transaction_date?: string;
  category?: string | null;
  description?: string | null;
  reference?: string | null;
}

export interface TransactionFilters {
  type?: TransactionType;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

// ───────────────────────────── Tax Rules ─────────────────────────────

export interface TaxRule {
  id: string;
  user_id: string;
  name: string;
  rate: string;
  type: string;
  country: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaxRuleInput {
  name: string;
  rate: number;
  type?: string;
  country?: string | null;
  is_default?: boolean;
}

// ───────────────────────────── Audit Logs ─────────────────────────────

export interface AuditLog {
  id: string;
  user_id: string | null;
  entity_type: string;
  entity_id: string;
  action: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface AuditLogFilters {
  page?: number;
  limit?: number;
}

// ───────────────────────────── Settings ─────────────────────────────

export type AiProvider = 'ollama' | 'openai' | 'openai-compatible' | 'openrouter';
export type Theme = 'system' | 'light' | 'dark';
export type PaymentGateway = 'stripe' | 'paypal' | 'none';

// Backend masks aiApiKey as ******** on read.
export interface AppSettings {
  aiProvider: AiProvider;
  aiModel: string;
  aiEndpoint: string;
  aiApiKey?: string;
  invoicePrefix: string;
  autoIncrement: boolean;
  defaultCurrency: string;
  defaultTaxRate: number;
  defaultTerms: string;
  defaultPaymentGateway: PaymentGateway | string;
  theme: Theme;
  notificationsEnabled: boolean;
  emailNotifications: boolean;
  // receipt_* keys + future allowlist additions
  [key: string]: unknown;
}

// ───────────────────────────── Reports ─────────────────────────────

export interface DashboardStats {
  totalRevenue: number;
  totalInvoiced: number;
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

export interface ProfitLossReport {
  generatedDate: string;
  period: string;
  profitAndLoss: {
    revenue: number;
    costOfSales: number;
    grossProfit: number;
    expenses: Array<{ category: string; amount: number }>;
    totalExpenses: number;
    netProfit: number;
  };
  insights: string[];
}

// Legacy alias — old screens used `FinancialReport`. Will rename in screens.
export type FinancialReport = ProfitLossReport;

export interface TopExpense {
  category: string;
  amount: number;
}

export interface TaxEstimate {
  vatDue: number;
  corporationTax: number;
  effectiveRate: number;
  period: string;
}

export interface RevenueByClient {
  clientName: string;
  revenue: number;
}

export interface ReportsSummary {
  invoices: { total: number; revenue: string | null };
  clients: { total: number };
  totalPaid: string | number;
}

// ──────────────────────────────── AI ────────────────────────────────

export interface AiSource {
  source: 'llm' | 'fallback';
  provider?: string;
  model?: string;
  error?: string;
}

export interface AiProviderInfo {
  provider: string;
  requiresApiKey: boolean;
  defaultEndpoint: string;
}

export interface AiConfig {
  provider: string;
  model: string;
  endpoint: string;
  hasApiKey: boolean;
  providers: AiProviderInfo[];
}

export interface AiChatResponse {
  response: string;
  provider: string;
  model: string;
}

export interface AiGeneratedInvoice {
  invoice: {
    clientName?: string;
    items?: Array<{ description: string; quantity: number; unitPrice: number }>;
    issueDate?: string;
    dueDate?: string;
    taxRate?: number;
    notes?: string;
  };
  provider: string;
  model: string;
}

export interface FinancialInsight {
  summary: string;
  recommendations: Array<{
    type: 'overdue' | 'optimization' | 'general' | 'tax';
    title: string;
    description: string;
    actionableStep: string;
  }>;
  riskAssessment: string;
  metrics?: {
    revenue: number;
    expenses: number;
    profit: number;
    categories: Array<{ category: string; amount: number }>;
  };
  ai?: AiSource;
}

export interface TaxAdvice {
  tips: string[];
  risks: string[];
  opportunities: string[];
  metrics?: { vatDue: number; paidRevenue: number; expenses: number };
  ai?: AiSource;
}

export interface InvoiceAuditResult {
  taxCompliance: string[];
  cisVatImplications: string[];
  lineItemSuggestions: Array<{ id: string; issue: string; suggestedDescription: string }>;
  generalFeedback: string[];
  ai?: AiSource;
}

export interface WhoOwesMeInvoiceRow {
  id: string;
  total_amount: string;
  amount_due: string;
  status: InvoiceStatus;
  due_date: string | null;
}

export interface WhoOwesMeClient {
  clientId: string;
  clientName: string;
  email: string | null;
  amount: number;
  invoices: WhoOwesMeInvoiceRow[];
}

export interface WhoOwesMeResponse {
  clients: WhoOwesMeClient[];
}

// ────────────────────────────── Health ──────────────────────────────

export interface HealthResponse {
  status: 'ok' | 'degraded';
  service: string;
  version: string;
  db: { connected: boolean; latencyMs?: number; error?: string };
  uptimeSec: number;
}

// ─────────────────── Receipt upload (current stub) ───────────────────

export interface ReceiptUploadResponse {
  id: string;
  url: string;
  rawText?: string;
  error?: string | null;
}

// ────── AI chat message envelope used by the iOS chat screen ─────────

export interface AIChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

// ─────────────── Report export response (CSV download URL) ────────────

export interface ReportExportResponse {
  // The backend currently returns CSV text directly with
  // Content-Disposition: attachment. iOS treats the response.text body
  // as `downloadUrl` for the UI prompt — see services/api.ts.
  downloadUrl?: string;
  filename?: string;
  format?: 'csv';
}
