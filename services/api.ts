// REST client for the InvoiceSmart backend.
//
// Contract: every response shape mirrors `InvoiceSmart-backend/src/openapi.yaml`.
//   - Entity routes return either a bare object or `{ data, pagination }`.
//   - Auth returns `{ token, user: { id, email } }`.
//   - Reports/AI return computed camelCase payloads.
//
// We DO NOT unwrap `response.data.data` — the backend never used the
// `{success,data}` envelope. The interceptor only handles 401 redirect.
import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import type {
  AuthResponse, UserProfile,
  Client, ClientInput,
  Invoice, InvoiceFull, InvoiceInput, InvoiceFilters,
  Transaction, TransactionInput, TransactionFilters,
  TaxRule, TaxRuleInput,
  AuditLog, AuditLogFilters,
  AppSettings,
  DashboardStats, RevenueTrendPoint, ProfitLossReport,
  TopExpense, TaxEstimate, RevenueByClient, ReportsSummary,
  AiConfig, AiChatResponse, AiGeneratedInvoice,
  FinancialInsight, TaxAdvice, InvoiceAuditResult, WhoOwesMeResponse,
  HealthResponse, ReceiptUploadResponse, ReportExportResponse,
  Paginated,
} from '../types';

// Resolution order:
//   1. EXPO_PUBLIC_API_URL (Expo only loads EXPO_PUBLIC_* env vars into
//      the JS bundle — anything else in .env is invisible at runtime).
//   2. Production default — the real backend host.
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  'https://api.invoicesmart.cortexbuildpro.com';

const api: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('auth_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('auth_token');
      router.replace('/auth/login');
    }
    return Promise.reject(error);
  }
);

// ─────────────── Offline cache (best-effort) ──────────────────

async function offlineFallback<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  try {
    const result = await fetcher();
    await AsyncStorage.setItem(`offline_${key}`, JSON.stringify(result));
    return result;
  } catch (err) {
    const cached = await AsyncStorage.getItem(`offline_${key}`);
    if (cached) return JSON.parse(cached) as T;
    throw err;
  }
}

async function queueOfflineAction(key: string, payload: unknown): Promise<void> {
  const existing = await AsyncStorage.getItem('offline_queue');
  const queue = existing ? (JSON.parse(existing) as unknown[]) : [];
  queue.push({ key, payload, timestamp: new Date().toISOString() });
  // Cap queue at the most recent 100 entries
  await AsyncStorage.setItem('offline_queue', JSON.stringify(queue.slice(-100)));
}

// ──────────────────── Bare HTTP helpers ────────────────────

async function getRaw<T>(url: string, config?: AxiosRequestConfig, fallbackKey?: string): Promise<T> {
  const fetcher = () => api.get<T>(url, config).then((r) => r.data);
  return fallbackKey ? offlineFallback(fallbackKey, fetcher) : fetcher();
}

async function postRaw<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  return api.post<T>(url, data, config).then((r) => r.data);
}

async function putRaw<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  return api.put<T>(url, data, config).then((r) => r.data);
}

async function patchRaw<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  return api.patch<T>(url, data, config).then((r) => r.data);
}

async function delRaw<T = void>(url: string, config?: AxiosRequestConfig): Promise<T> {
  return api.delete<T>(url, config).then((r) => r.data);
}

// ──────────────────────────── Health ────────────────────────────

export function getHealth(): Promise<HealthResponse> {
  // Health is mounted under /api/health (and a top-level /health alias).
  return getRaw<HealthResponse>('/health');
}

// ───────────────────────────── Auth ─────────────────────────────

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await postRaw<AuthResponse>('/auth/login', { email, password });
  await AsyncStorage.setItem('auth_token', res.token);
  await AsyncStorage.setItem('user', JSON.stringify(res.user));
  return res;
}

export interface RegisterPayload {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  vat_number?: string;
  phone?: string;
}

export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  const res = await postRaw<AuthResponse>('/auth/register', payload);
  await AsyncStorage.setItem('auth_token', res.token);
  await AsyncStorage.setItem('user', JSON.stringify(res.user));
  return res;
}

export async function getCurrentUser(): Promise<UserProfile | null> {
  try {
    return await getRaw<UserProfile>('/auth/me');
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  await AsyncStorage.removeItem('auth_token');
  await AsyncStorage.removeItem('user');
  router.replace('/auth/login');
}

// ─────────────────────────── Invoices ───────────────────────────

export function getInvoices(params?: InvoiceFilters): Promise<Paginated<Invoice>> {
  return getRaw<Paginated<Invoice>>('/invoices', { params }, 'invoices');
}

export function getInvoice(id: string): Promise<InvoiceFull> {
  return getRaw<InvoiceFull>(`/invoices/${id}`, undefined, `invoice_${id}`);
}

export function getNextInvoiceNumber(prefix?: string): Promise<{ invoiceNumber: string }> {
  return getRaw<{ invoiceNumber: string }>('/invoices/next/number', { params: { prefix } });
}

export async function createInvoice(data: InvoiceInput): Promise<Invoice> {
  try {
    return await postRaw<Invoice>('/invoices', data);
  } catch (e) {
    await queueOfflineAction('create_invoice', data);
    throw e;
  }
}

export async function updateInvoice(id: string, data: InvoiceInput): Promise<Invoice> {
  try {
    return await putRaw<Invoice>(`/invoices/${id}`, data);
  } catch (e) {
    await queueOfflineAction('update_invoice', { id, data });
    throw e;
  }
}

export async function deleteInvoice(id: string): Promise<void> {
  try {
    await delRaw(`/invoices/${id}`);
  } catch (e) {
    await queueOfflineAction('delete_invoice', { id });
    throw e;
  }
}

export function sendInvoice(id: string): Promise<{ success: boolean; status: 'sent' }> {
  return postRaw(`/invoices/${id}/send`, {});
}

export function markInvoicePaid(id: string): Promise<Invoice> {
  return patchRaw<Invoice>(`/invoices/${id}/paid`, {});
}

export interface PaymentInput {
  amount: number;
  payment_method?: string;
  reference?: string;
  notes?: string;
}

export function recordPayment(id: string, payload: PaymentInput): Promise<{ success: boolean }> {
  return postRaw(`/invoices/${id}/payments`, payload);
}

export function getInvoicePdfUrl(id: string): Promise<{ url: string }> {
  return getRaw<{ url: string }>(`/invoices/${id}/pdf`);
}

// ─────────────────────────── Clients ───────────────────────────

export function getClients(): Promise<Paginated<Client>> {
  return getRaw<Paginated<Client>>('/clients', undefined, 'clients');
}

export function getClient(id: string): Promise<Client> {
  return getRaw<Client>(`/clients/${id}`, undefined, `client_${id}`);
}

export async function createClient(data: ClientInput): Promise<Client> {
  try {
    return await postRaw<Client>('/clients', data);
  } catch (e) {
    await queueOfflineAction('create_client', data);
    throw e;
  }
}

export async function updateClient(id: string, data: ClientInput): Promise<Client> {
  try {
    return await putRaw<Client>(`/clients/${id}`, data);
  } catch (e) {
    await queueOfflineAction('update_client', { id, data });
    throw e;
  }
}

export async function deleteClient(id: string): Promise<void> {
  try {
    await delRaw(`/clients/${id}`);
  } catch (e) {
    await queueOfflineAction('delete_client', { id });
    throw e;
  }
}

// ───────────────────────── Transactions ─────────────────────────

export function getTransactions(params?: TransactionFilters): Promise<Paginated<Transaction>> {
  return getRaw<Paginated<Transaction>>('/transactions', { params }, 'transactions');
}

export function getTransactionsForInvoice(invoiceId: string): Promise<Transaction[]> {
  return getRaw<Transaction[]>(`/transactions/invoice/${invoiceId}`);
}

export async function createTransaction(data: TransactionInput): Promise<Transaction> {
  try {
    return await postRaw<Transaction>('/transactions', data);
  } catch (e) {
    await queueOfflineAction('create_transaction', data);
    throw e;
  }
}

export async function deleteTransaction(id: string): Promise<void> {
  try {
    await delRaw(`/transactions/${id}`);
  } catch (e) {
    await queueOfflineAction('delete_transaction', { id });
    throw e;
  }
}

// ─────────────────────────── Tax Rules ───────────────────────────

export function getTaxRules(): Promise<Paginated<TaxRule>> {
  return getRaw<Paginated<TaxRule>>('/tax-rules', undefined, 'tax_rules');
}

export function createTaxRule(data: TaxRuleInput): Promise<TaxRule> {
  return postRaw<TaxRule>('/tax-rules', data);
}

export function updateTaxRule(id: string, data: TaxRuleInput): Promise<TaxRule> {
  return putRaw<TaxRule>(`/tax-rules/${id}`, data);
}

export function deleteTaxRule(id: string): Promise<void> {
  return delRaw(`/tax-rules/${id}`);
}

// ───────────────────────── Audit Logs ─────────────────────────

export function getAuditLogs(_params?: AuditLogFilters): Promise<AuditLog[]> {
  // The backend currently returns a bare array (max 1000 rows).
  return getRaw<AuditLog[]>('/audit-logs', undefined, 'audit_logs');
}

// ───────────────────────────── Reports ─────────────────────────────

export function getDashboard(): Promise<DashboardStats> {
  return getRaw<DashboardStats>('/reports/dashboard', undefined, 'dashboard');
}

export function getRevenueTrend(start?: string, end?: string): Promise<RevenueTrendPoint[]> {
  return getRaw<RevenueTrendPoint[]>('/reports/revenue-trend', { params: { start, end } }, 'revenue_trend');
}

export function getProfitLoss(start?: string, end?: string): Promise<ProfitLossReport> {
  return getRaw<ProfitLossReport>('/reports/profit-loss', { params: { start, end } }, 'profit_loss');
}

export function getTopExpenses(start?: string, end?: string): Promise<TopExpense[]> {
  return getRaw<TopExpense[]>('/reports/top-expenses', { params: { start, end } }, 'top_expenses');
}

export function getTaxEstimate(start?: string, end?: string): Promise<TaxEstimate> {
  return getRaw<TaxEstimate>('/reports/tax-estimate', { params: { start, end } }, 'tax_estimate');
}

export function getRevenueByClient(start?: string, end?: string): Promise<RevenueByClient[]> {
  return getRaw<RevenueByClient[]>('/reports/revenue-by-client', { params: { start, end } }, 'revenue_by_client');
}

export function getReportsSummary(): Promise<ReportsSummary> {
  return getRaw<ReportsSummary>('/reports/summary');
}

// Export returns a CSV body with `Content-Disposition: attachment`.
// We expose the raw text so callers can share/save it.
export async function exportReport(
  type: 'profit-loss' | 'revenue' | 'expenses',
  start?: string,
  end?: string
): Promise<ReportExportResponse & { csv: string }> {
  const r = await api.get<string>('/reports/export', {
    params: { type, start, end },
    responseType: 'text',
    transformResponse: (data) => data,
  });
  const filename = `${type}_${start || 'all'}_${end || 'now'}.csv`;
  return { csv: r.data, filename, format: 'csv' };
}

// Legacy alias used by some screens
export const getReportsProfitLoss = getProfitLoss;

// ────────────────────────────── AI ──────────────────────────────

export function getAiConfig(): Promise<AiConfig> {
  return getRaw<AiConfig>('/ai/config');
}

export function updateAiConfig(payload: {
  provider?: string;
  model?: string;
  endpoint?: string;
  apiKey?: string;
}): Promise<AiConfig> {
  return putRaw<AiConfig>('/ai/config', payload);
}

export function aiHealthCheck(): Promise<{ ok: boolean; provider: string; model: string; response: string }> {
  return postRaw('/ai/test', {});
}

export function listAiModels(): Promise<{ provider: string; endpoint: string; models: string[] }> {
  return getRaw('/ai/models');
}

export async function chatWithAI(message: string): Promise<string> {
  const r = await postRaw<AiChatResponse>('/ai/chat', { message });
  return r.response;
}

export function generateInvoiceDraft(description: string): Promise<AiGeneratedInvoice> {
  return postRaw<AiGeneratedInvoice>('/ai/generate-invoice', { description });
}

export function summarizePL(): Promise<FinancialInsight> {
  return getRaw<FinancialInsight>('/ai/summarize-pl');
}

export function whoOwesMe(): Promise<WhoOwesMeResponse> {
  return getRaw<WhoOwesMeResponse>('/ai/who-owes-me');
}

export function taxAdvice(): Promise<TaxAdvice> {
  return getRaw<TaxAdvice>('/ai/tax-advice');
}

export function auditInvoice(id: string): Promise<InvoiceAuditResult> {
  return getRaw<InvoiceAuditResult>(`/ai/audit-invoice/${id}`);
}

// ──────────────────────────── Settings ────────────────────────────

export function getSettings(): Promise<AppSettings> {
  return getRaw<AppSettings>('/settings', undefined, 'settings');
}

export async function updateSettings(data: Partial<AppSettings>): Promise<AppSettings> {
  try {
    return await putRaw<AppSettings>('/settings', data);
  } catch (e) {
    await queueOfflineAction('update_settings', data);
    throw e;
  }
}

export function uploadReceipt(base64: string): Promise<ReceiptUploadResponse> {
  return postRaw<ReceiptUploadResponse>('/settings/upload-receipt', { image: base64 });
}

// ───────────────────────── Legacy aliases ─────────────────────────
// Used by older screens; safe to remove once those screens are updated.

export const getUser = getCurrentUser;
export const markPaid = markInvoicePaid;
export const generatePdf = getInvoicePdfUrl;

export { api };
