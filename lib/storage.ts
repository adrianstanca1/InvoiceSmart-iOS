import AsyncStorage from '@react-native-async-storage/async-storage';
import { Invoice, Client, Transaction, TaxRule, AuditLog } from '../types';

const KEYS = {
  invoices: 'is_invoices',
  clients: 'is_clients',
  transactions: 'is_transactions',
  auditLogs: 'is_auditLogs',
  taxRules: 'is_taxRules',
  appSettings: 'is_appSettings',
};

export async function getInvoices(): Promise<Invoice[]> {
  const raw = await AsyncStorage.getItem(KEYS.invoices);
  return raw ? JSON.parse(raw) : [];
}
export async function saveInvoices(data: Invoice[]) {
  await AsyncStorage.setItem(KEYS.invoices, JSON.stringify(data));
}
export async function getClients(): Promise<Client[]> {
  const raw = await AsyncStorage.getItem(KEYS.clients);
  return raw ? JSON.parse(raw) : [];
}
export async function saveClients(data: Client[]) {
  await AsyncStorage.setItem(KEYS.clients, JSON.stringify(data));
}
export async function getTransactions(): Promise<Transaction[]> {
  const raw = await AsyncStorage.getItem(KEYS.transactions);
  return raw ? JSON.parse(raw) : [];
}
export async function saveTransactions(data: Transaction[]) {
  await AsyncStorage.setItem(KEYS.transactions, JSON.stringify(data));
}
export async function getAuditLogs(): Promise<AuditLog[]> {
  const raw = await AsyncStorage.getItem(KEYS.auditLogs);
  return raw ? JSON.parse(raw) : [];
}
export async function saveAuditLogs(data: AuditLog[]) {
  await AsyncStorage.setItem(KEYS.auditLogs, JSON.stringify(data));
}
export async function getTaxRules(): Promise<TaxRule[]> {
  const raw = await AsyncStorage.getItem(KEYS.taxRules);
  if (raw) return JSON.parse(raw);
  const defaults: TaxRule[] = [
    { id: '1', name: 'Standard VAT', rate: 20, description: 'Standard UK VAT rate' },
    { id: '2', name: 'Reduced Rate', rate: 5, description: 'Reduced rate for energy, etc.' },
    { id: '3', name: 'Zero Rate', rate: 0, description: 'Zero rated goods' },
  ];
  await AsyncStorage.setItem(KEYS.taxRules, JSON.stringify(defaults));
  return defaults;
}
export async function saveTaxRules(data: TaxRule[]) {
  await AsyncStorage.setItem(KEYS.taxRules, JSON.stringify(data));
}
export async function getAppSettings(): Promise<any> {
  const raw = await AsyncStorage.getItem(KEYS.appSettings);
  return raw ? JSON.parse(raw) : {
    aiProvider: 'ollama',
    aiModel: 'qwen2.5:7b',
    aiEndpoint: 'http://127.0.0.1:11434',
    invoicePrefix: 'INV-',
    autoIncrement: true,
  };
}
export async function saveAppSettings(data: any) {
  await AsyncStorage.setItem(KEYS.appSettings, JSON.stringify(data));
}

export async function logAction(
  action: AuditLog['action'],
  entityType: AuditLog['entityType'],
  entityId: string,
  entityName: string,
  details: string
) {
  const logs = await getAuditLogs();
  logs.unshift({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    timestamp: new Date().toISOString(),
    user: 'Current User',
    action,
    entityType,
    entityId,
    entityName,
    details,
  });
  await saveAuditLogs(logs.slice(0, 1000));
}

export async function getNextInvoiceNumber(invoices: Invoice[]): Promise<string> {
  const settings = await getAppSettings();
  const prefix = settings.invoicePrefix || 'INV-';
  if (settings.autoIncrement === false) return prefix;
  if (invoices.length === 0) return `${prefix}001`;
  const last = invoices[invoices.length - 1].invoiceNumber;
  const match = last.match(/(\d+)$/);
  const nextNum = match ? parseInt(match[1], 10) + 1 : invoices.length + 1;
  const padLen = Math.max(3, String(nextNum).length);
  return `${prefix}${String(nextNum).padStart(padLen, '0')}`;
}
