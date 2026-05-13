import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import {
  ApiResponse, User, Invoice, InvoiceFilters, Client, Transaction,
  TransactionFilters, TaxRule, FinancialReport, DashboardStats, RevenueTrendPoint,
  TopExpense, TaxEstimate, AuditLog, AuditLogFilters, AIChatMessage, AppSettings,
  ReceiptUploadResponse, ReportExportResponse, InvoiceAuditResult, FinancialInsight,
} from '../types';

const API_BASE_URL = process.env.API_BASE_URL || 'http://127.0.0.1:3002';

const api: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach Bearer token
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('auth_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResponse<any>>) => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('auth_token');
      router.replace('/auth/login');
    }
    return Promise.reject(error);
  }
);

// Offline fallback helpers
async function offlineFallback<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  try {
    const result = await fetcher();
    await AsyncStorage.setItem(`offline_${key}`, JSON.stringify(result));
    return result;
  } catch (error) {
    const cached = await AsyncStorage.getItem(`offline_${key}`);
    if (cached) {
      return JSON.parse(cached) as T;
    }
    throw error;
  }
}

async function queueOfflineAction(key: string, payload: any) {
  const existing = await AsyncStorage.getItem('offline_queue');
  const queue = existing ? JSON.parse(existing) : [];
  queue.push({ key, payload, timestamp: new Date().toISOString() });
  await AsyncStorage.setItem('offline_queue', JSON.stringify(queue.slice(-100)));
}

// Generic request wrappers with fallback support
async function get<T>(url: string, config?: AxiosRequestConfig, fallbackKey?: string): Promise<T> {
  const fetcher = () => api.get<ApiResponse<T>>(url, config).then((r) => r.data.data);
  if (fallbackKey) {
    return offlineFallback(fallbackKey, fetcher);
  }
  return fetcher();
}

async function post<T>(url: string, data?: any, config?: AxiosRequestConfig, fallbackKey?: string): Promise<T> {
  const fetcher = () => api.post<ApiResponse<T>>(url, data, config).then((r) => r.data.data);
  if (fallbackKey) {
    return offlineFallback(fallbackKey, fetcher);
  }
  return fetcher();
}

async function put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
  return api.put<ApiResponse<T>>(url, data, config).then((r) => r.data.data);
}

async function patchReq<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
  return api.patch<ApiResponse<T>>(url, data, config).then((r) => r.data.data);
}

async function del<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  return api.delete<ApiResponse<T>>(url, config).then((r) => r.data.data);
}

// ─── Auth ───
export async function login(email: string, password: string): Promise<{ token: string; user: User }> {
  const res = await api.post<ApiResponse<{ token: string; user: User }>>('/auth/login', { email, password });
  const { token, user } = res.data.data;
  await AsyncStorage.setItem('auth_token', token);
  await AsyncStorage.setItem('user', JSON.stringify(user));
  return { token, user };
}

export async function register(email: string, password: string, name: string): Promise<{ token: string; user: User }> {
  const res = await api.post<ApiResponse<{ token: string; user: User }>>('/auth/register', { email, password, name });
  const { token, user } = res.data.data;
  await AsyncStorage.setItem('auth_token', token);
  await AsyncStorage.setItem('user', JSON.stringify(user));
  return { token, user };
}

export async function getUser(): Promise<User | null> {
  try {
    const cached = await AsyncStorage.getItem('user');
    if (cached) {
      const parsed = JSON.parse(cached) as User;
      // Refresh in background
      api.get<ApiResponse<User>>('/auth/me').then((res) => {
        AsyncStorage.setItem('user', JSON.stringify(res.data.data));
      }).catch(() => {});
      return parsed;
    }
    const res = await api.get<ApiResponse<User>>('/auth/me');
    await AsyncStorage.setItem('user', JSON.stringify(res.data.data));
    return res.data.data;
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  await AsyncStorage.removeItem('auth_token');
  await AsyncStorage.removeItem('user');
  router.replace('/auth/login');
}

// ─── Invoices ───
export async function getInvoices(params?: InvoiceFilters): Promise<{ data: Invoice[]; pagination: import('../types').Pagination }> {
  return get('/invoices', { params }, 'invoices');
}

export async function getInvoice(id: string): Promise<Invoice> {
  return get(`/invoices/${id}`, undefined, `invoice_${id}`);
}

export async function createInvoice(data: Partial<Invoice>): Promise<Invoice> {
  try {
    return await post('/invoices', data);
  } catch (e) {
    await queueOfflineAction('create_invoice', data);
    throw e;
  }
}

export async function updateInvoice(id: string, data: Partial<Invoice>): Promise<Invoice> {
  try {
    return await put(`/invoices/${id}`, data);
  } catch (e) {
    await queueOfflineAction('update_invoice', { id, data });
    throw e;
  }
}

export async function deleteInvoice(id: string): Promise<void> {
  try {
    await del(`/invoices/${id}`);
  } catch (e) {
    await queueOfflineAction('delete_invoice', { id });
    throw e;
  }
}

export async function sendInvoice(id: string): Promise<void> {
  return post(`/invoices/${id}/send`, {});
}

export async function markPaid(id: string): Promise<Invoice> {
  return patchReq(`/invoices/${id}/paid`, {});
}

export async function generatePdf(id: string): Promise<{ url: string }> {
  return get(`/invoices/${id}/pdf`);
}

// ─── Clients ───
export async function getClients(params?: { page?: number; limit?: number; search?: string }): Promise<{ data: Client[]; pagination: import('../types').Pagination }> {
  return get('/clients', { params }, 'clients');
}

export async function getClient(id: string): Promise<Client> {
  return get(`/clients/${id}`, undefined, `client_${id}`);
}

export async function createClient(data: Partial<Client>): Promise<Client> {
  try {
    return await post('/clients', data);
  } catch (e) {
    await queueOfflineAction('create_client', data);
    throw e;
  }
}

export async function updateClient(id: string, data: Partial<Client>): Promise<Client> {
  try {
    return await put(`/clients/${id}`, data);
  } catch (e) {
    await queueOfflineAction('update_client', { id, data });
    throw e;
  }
}

export async function deleteClient(id: string): Promise<void> {
  try {
    await del(`/clients/${id}`);
  } catch (e) {
    await queueOfflineAction('delete_client', { id });
    throw e;
  }
}

// ─── Transactions ───
export async function getTransactions(params?: TransactionFilters): Promise<{ data: Transaction[]; pagination: import('../types').Pagination }> {
  return get('/transactions', { params }, 'transactions');
}

export async function createTransaction(data: Partial<Transaction>): Promise<Transaction> {
  try {
    return await post('/transactions', data);
  } catch (e) {
    await queueOfflineAction('create_transaction', data);
    throw e;
  }
}

export async function updateTransaction(id: string, data: Partial<Transaction>): Promise<Transaction> {
  try {
    return await put(`/transactions/${id}`, data);
  } catch (e) {
    await queueOfflineAction('update_transaction', { id, data });
    throw e;
  }
}

export async function deleteTransaction(id: string): Promise<void> {
  try {
    await del(`/transactions/${id}`);
  } catch (e) {
    await queueOfflineAction('delete_transaction', { id });
    throw e;
  }
}

// ─── Tax Rules ───
export async function getTaxRules(): Promise<TaxRule[]> {
  return get('/tax-rules', undefined, 'tax_rules');
}

export async function createTaxRule(data: Partial<TaxRule>): Promise<TaxRule> {
  return post('/tax-rules', data);
}

export async function updateTaxRule(id: string, data: Partial<TaxRule>): Promise<TaxRule> {
  return put(`/tax-rules/${id}`, data);
}

export async function deleteTaxRule(id: string): Promise<void> {
  return del(`/tax-rules/${id}`);
}

// ─── Reports ───
export async function getDashboard(): Promise<DashboardStats> {
  return get('/reports/dashboard', undefined, 'dashboard');
}

export async function getRevenueTrend(start: string, end: string): Promise<RevenueTrendPoint[]> {
  return get('/reports/revenue-trend', { params: { start, end } }, 'revenue_trend');
}

export async function getReportsProfitLoss(start: string, end: string): Promise<FinancialReport> {
  return get('/reports/profit-loss', { params: { start, end } }, 'profit_loss');
}

export async function getTopExpenses(start: string, end: string): Promise<TopExpense[]> {
  return get('/reports/top-expenses', { params: { start, end } }, 'top_expenses');
}

export async function getTaxEstimate(start: string, end: string): Promise<TaxEstimate> {
  return get('/reports/tax-estimate', { params: { start, end } }, 'tax_estimate');
}

export async function exportReport(
  type: 'profit-loss' | 'revenue' | 'expenses' | 'tax',
  start: string,
  end: string
): Promise<ReportExportResponse> {
  return get('/reports/export', { params: { type, start, end } });
}

// ─── Audit ───
export async function getAuditLogs(params?: AuditLogFilters): Promise<{ data: AuditLog[]; pagination: import('../types').Pagination }> {
  return get('/audit-logs', { params }, 'audit_logs');
}

// ─── AI ───
export async function chatWithAI(message: string): Promise<{ response: string; messages: AIChatMessage[] }> {
  return post('/ai/chat', { message });
}

export async function summarizePL(): Promise<FinancialInsight> {
  return get('/ai/summarize-pl');
}

export async function whoOwesMe(): Promise<{ clients: { clientId: string; clientName: string; amount: number; invoices: Invoice[] }[] }> {
  return get('/ai/who-owes-me');
}

export async function taxAdvice(): Promise<{ tips: string[]; risks: string[]; opportunities: string[] }> {
  return get('/ai/tax-advice');
}

export async function auditInvoice(id: string): Promise<InvoiceAuditResult> {
  return get(`/ai/audit-invoice/${id}`);
}

// ─── Settings ───
export async function getSettings(): Promise<AppSettings> {
  return get('/settings', undefined, 'settings');
}

export async function updateSettings(data: Partial<AppSettings>): Promise<AppSettings> {
  try {
    return await put('/settings', data);
  } catch (e) {
    await queueOfflineAction('update_settings', data);
    throw e;
  }
}

export async function uploadReceipt(base64: string): Promise<ReceiptUploadResponse> {
  return post('/settings/upload-receipt', { image: base64 });
}

export { api };
