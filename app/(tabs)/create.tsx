import React, { useCallback, useMemo, useState } from 'react';
import {
  ScrollView, View, Text, TextInput, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform, Modal, FlatList,
} from 'react-native';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import {
  Plus, Trash2, Save, Share, Sparkles, ArrowUp, ArrowDown, Send,
  CheckCircle2, ChevronDown, X,
} from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import * as api from '../../services/api';
import type {
  Client, InvoiceFull, InvoiceInput, InvoiceStatus, TaxRule,
} from '../../types';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { ErrorToast } from '../../components/ErrorToast';
import { StatusBadge } from '../../components/StatusBadge';
import { ClientPicker } from '../../components/ClientPicker';
import { fmtMoney, toNum, fmtPercent } from '../../lib/format';

// Local UI shape. Mirrors InvoiceInput but uses strings everywhere
// (TextInput's source of truth is text). Money + rate columns are
// parsed via toNum() at save / total-calc time.
interface LineItemForm {
  id: string;
  description: string;
  quantity: string;
  unit_price: string;
}

interface FormState {
  invoice_id: string | null;
  client_id: string | null;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  notes: string;
  terms: string;
  tax_rate: string;
  discount_rate: string;
  retention_rate: string;
  cis_rate: string;
  line_items: LineItemForm[];
  status: InvoiceStatus;
}

const TODAY = (): string => new Date().toISOString().slice(0, 10);
const ADD_30 = (): string => {
  const d = new Date(); d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
};

const newLine = (): LineItemForm => ({
  id: Date.now().toString(36) + Math.random().toString(36).slice(2),
  description: '',
  quantity: '1',
  unit_price: '0',
});

const emptyForm = (): FormState => ({
  invoice_id: null,
  client_id: null,
  invoice_number: 'INV-0001',
  issue_date: TODAY(),
  due_date: ADD_30(),
  notes: '',
  terms: 'Payment due within 30 days.',
  tax_rate: '20',
  discount_rate: '0',
  retention_rate: '0',
  cis_rate: '0',
  line_items: [newLine()],
  status: 'draft',
});

export default function InvoiceBuilderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const editingId = typeof params.id === 'string' ? params.id : null;

  const [form, setForm] = useState<FormState>(emptyForm());
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState('');
  const [taxRules, setTaxRules] = useState<TaxRule[]>([]);
  const [showTaxPicker, setShowTaxPicker] = useState(false);

  const calc = useMemo(() => {
    // Mirrors backend src/utils.ts:calculateInvoiceTotals exactly.
    const subtotal = form.line_items.reduce(
      (s, l) => s + toNum(l.quantity) * toNum(l.unit_price), 0
    );
    const discount = subtotal * (toNum(form.discount_rate) / 100);
    const taxable = subtotal - discount;
    const tax = taxable * (toNum(form.tax_rate) / 100);
    const retention = taxable * (toNum(form.retention_rate) / 100);
    const cis = taxable * (toNum(form.cis_rate) / 100);
    const total = taxable + tax - retention - cis;
    return { subtotal, discount, taxable, tax, retention, cis, total };
  }, [form]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [rulesRes] = await Promise.all([
        api.getTaxRules(),
        (async () => {
          if (editingId) {
            const inv: InvoiceFull = await api.getInvoice(editingId);
            setForm(invoiceToForm(inv));
            // Refresh the bound client so the picker shows the right name.
            if (inv.client_id) {
              try {
                const c = await api.getClient(inv.client_id);
                setClient(c);
              } catch { /* swallow — client may have been deleted */ }
            }
          } else {
            const numRes = await api.getNextInvoiceNumber();
            setForm((f) => ({ ...f, invoice_number: numRes.invoiceNumber || 'INV-0001' }));
          }
        })(),
      ]);
      setTaxRules(rulesRes.data || []);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [editingId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }
  function updateLine(index: number, field: keyof LineItemForm, value: string) {
    setForm((prev) => {
      const items = [...prev.line_items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, line_items: items };
    });
  }
  function addLine() {
    setForm((prev) => ({ ...prev, line_items: [...prev.line_items, newLine()] }));
  }
  function removeLine(index: number) {
    if (form.line_items.length <= 1) {
      Alert.alert('Cannot remove', 'At least one line item is required.');
      return;
    }
    setForm((prev) => ({ ...prev, line_items: prev.line_items.filter((_, i) => i !== index) }));
  }
  function moveLine(index: number, dir: -1 | 1) {
    setForm((prev) => {
      const items = [...prev.line_items];
      const target = index + dir;
      if (target < 0 || target >= items.length) return prev;
      [items[index], items[target]] = [items[target], items[index]];
      return { ...prev, line_items: items };
    });
  }

  function toPayload(): InvoiceInput {
    return {
      client_id: form.client_id || undefined,
      status: form.status,
      issue_date: form.issue_date || undefined,
      due_date: form.due_date || undefined,
      tax_rate: toNum(form.tax_rate),
      discount_rate: toNum(form.discount_rate),
      retention_rate: toNum(form.retention_rate),
      cis_rate: toNum(form.cis_rate),
      notes: form.notes || undefined,
      terms: form.terms || undefined,
      line_items: form.line_items
        .filter((l) => l.description.trim().length > 0)
        .map((l) => ({
          description: l.description,
          quantity: toNum(l.quantity),
          unit_price: toNum(l.unit_price),
        })),
      // Send the prefix only when creating — back end uses it to compute
      // the next number. Editing keeps the existing invoice_number.
      invoice_prefix: editingId ? undefined : (form.invoice_number.split('-')[0] || 'INV'),
      auto_increment: !editingId,
    };
  }

  function validate(): string | null {
    if (form.line_items.every((l) => !l.description.trim())) {
      return 'Add at least one line item with a description.';
    }
    return null;
  }

  async function saveDraft() {
    const err = validate();
    if (err) { Alert.alert('Cannot save', err); return; }
    setSaving(true); setError('');
    try {
      const payload = { ...toPayload(), status: 'draft' as InvoiceStatus };
      const saved = editingId
        ? await api.updateInvoice(editingId, payload)
        : await api.createInvoice(payload);
      Alert.alert('Saved', `Invoice ${saved.invoice_number} saved as Draft.`);
      router.replace('/history');
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  async function sendInvoice() {
    const err = validate();
    if (err) { Alert.alert('Cannot send', err); return; }
    setSaving(true); setError('');
    try {
      const payload = toPayload();
      const saved = editingId
        ? await api.updateInvoice(editingId, payload)
        : await api.createInvoice(payload);
      // Distinct endpoint that flips status to 'sent' + records sent_at.
      await api.sendInvoice(saved.id);
      Alert.alert('Sent', `Invoice ${saved.invoice_number} marked as Sent.`);
      router.replace('/history');
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  async function markPaid() {
    if (!editingId) return;
    setSaving(true); setError('');
    try {
      const saved = await api.markInvoicePaid(editingId);
      setForm((f) => ({ ...f, status: saved.status }));
      Alert.alert('Updated', `Invoice ${saved.invoice_number} marked as Paid.`);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  async function generatePDF() {
    setPdfLoading(true); setError('');
    try {
      const html = renderInvoiceHtml(form, calc, client);
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { UTI: 'com.adobe.pdf', mimeType: 'application/pdf' });
      } else {
        Alert.alert('PDF ready', `Saved to ${uri}`);
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setPdfLoading(false);
    }
  }

  async function runAI() {
    if (!aiPrompt.trim()) return;
    setAiLoading(true); setError('');
    try {
      const draft = await api.generateInvoiceDraft(aiPrompt);
      const items = Array.isArray(draft.invoice?.items) ? draft.invoice.items : [];
      setForm((prev) => ({
        ...prev,
        tax_rate: typeof draft.invoice?.taxRate === 'number'
          ? String(draft.invoice.taxRate)
          : prev.tax_rate,
        notes: draft.invoice?.notes || prev.notes,
        issue_date: draft.invoice?.issueDate || prev.issue_date,
        due_date: draft.invoice?.dueDate || prev.due_date,
        line_items: items.length > 0
          ? items.map((li) => ({
              id: Date.now().toString(36) + Math.random().toString(36).slice(2),
              description: li.description || '',
              quantity: String(li.quantity ?? 1),
              unit_price: String(li.unitPrice ?? 0),
            }))
          : prev.line_items,
      }));
    } catch (e: any) {
      setError(`AI Error: ${e?.message || String(e)}`);
    } finally {
      setAiLoading(false);
    }
  }

  if (loading) return <LoadingSpinner />;

  const selectedTaxName = (() => {
    const target = toNum(form.tax_rate);
    const match = taxRules.find((r) => Math.abs(toNum(r.rate) - target) < 0.001);
    return match ? match.name : 'Custom';
  })();

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
      <ScrollView className="flex-1 bg-slate-50 p-4">
        <Text className="text-2xl font-bold text-slate-800 mb-3">
          {editingId ? 'Edit Invoice' : 'New Invoice'}
        </Text>

        {error ? <ErrorToast message={error} /> : null}

        {/* Status row */}
        <View className="bg-white rounded-xl p-4 shadow-sm mb-3">
          <Text className="font-bold text-slate-800 mb-2">Status</Text>
          <View className="flex-row items-center justify-between">
            <StatusBadge status={form.status} />
            {editingId && form.status !== 'paid' && (
              <TouchableOpacity onPress={markPaid} className="bg-green-600 rounded-lg px-3 py-2 flex-row items-center gap-2">
                <CheckCircle2 size={14} color="#fff" />
                <Text className="text-white text-sm font-medium">Mark Paid</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* AI assist */}
        <View className="bg-white rounded-xl p-4 shadow-sm mb-3">
          <Text className="font-bold text-slate-800 mb-2">AI Assist</Text>
          <TextInput
            value={aiPrompt}
            onChangeText={setAiPrompt}
            placeholder="Describe the work..."
            multiline
            className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800 h-20"
          />
          <TouchableOpacity onPress={runAI} disabled={aiLoading} className="bg-indigo-600 rounded-lg p-3 items-center flex-row justify-center gap-2">
            <Sparkles size={16} color="#fff" />
            <Text className="text-white font-medium">{aiLoading ? 'Generating...' : 'Generate with AI'}</Text>
          </TouchableOpacity>
        </View>

        {/* Header */}
        <View className="bg-white rounded-xl p-4 shadow-sm mb-3">
          <Text className="font-bold text-slate-800 mb-2">Invoice Details</Text>

          <Label text="Invoice #" />
          <TextInput
            value={form.invoice_number}
            onChangeText={(v) => updateField('invoice_number', v)}
            editable={!editingId}
            className={`border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800 ${editingId ? 'bg-slate-50' : ''}`}
          />

          <Label text="Issue Date (YYYY-MM-DD)" />
          <TextInput value={form.issue_date} onChangeText={(v) => updateField('issue_date', v)} className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" />

          <Label text="Due Date (YYYY-MM-DD)" />
          <TextInput value={form.due_date} onChangeText={(v) => updateField('due_date', v)} className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" />

          <Label text="Client" />
          <ClientPicker
            selectedId={form.client_id || undefined}
            onSelect={(c: Client) => {
              setClient(c);
              updateField('client_id', c.id);
            }}
          />
          {client && (
            <Text className="text-xs text-slate-500 mt-2">
              {client.email || client.phone || '—'}
              {client.vat_number ? ` · VAT ${client.vat_number}` : ''}
            </Text>
          )}
        </View>

        {/* Line items */}
        <View className="bg-white rounded-xl p-4 shadow-sm mb-3">
          <Text className="font-bold text-slate-800 mb-2">Line Items</Text>
          {form.line_items.map((item, idx) => (
            <View key={item.id} className="border border-slate-200 rounded-lg p-3 mb-2">
              <TextInput
                value={item.description}
                onChangeText={(v) => updateLine(idx, 'description', v)}
                placeholder="Description"
                className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800"
              />
              <View className="flex-row gap-2 mb-2">
                <TextInput value={item.quantity} onChangeText={(v) => updateLine(idx, 'quantity', v)} keyboardType="numeric" placeholder="Qty" className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-slate-800" />
                <TextInput value={item.unit_price} onChangeText={(v) => updateLine(idx, 'unit_price', v)} keyboardType="numeric" placeholder="Unit price" className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-slate-800" />
                <View className="flex-row items-center">
                  <TouchableOpacity onPress={() => moveLine(idx, -1)} className="p-2"><ArrowUp size={18} color="#64748b" /></TouchableOpacity>
                  <TouchableOpacity onPress={() => moveLine(idx, 1)} className="p-2"><ArrowDown size={18} color="#64748b" /></TouchableOpacity>
                  <TouchableOpacity onPress={() => removeLine(idx)} className="p-2"><Trash2 size={18} color="#dc2626" /></TouchableOpacity>
                </View>
              </View>
              <Text className="text-xs text-slate-400 text-right">
                Line total: {fmtMoney(toNum(item.quantity) * toNum(item.unit_price))}
              </Text>
            </View>
          ))}
          <TouchableOpacity onPress={addLine} className="bg-slate-100 rounded-lg p-3 items-center flex-row justify-center gap-2">
            <Plus size={16} color="#334155" />
            <Text className="text-slate-700 font-medium">Add Line Item</Text>
          </TouchableOpacity>
        </View>

        {/* Tax & discount */}
        <View className="bg-white rounded-xl p-4 shadow-sm mb-3">
          <Text className="font-bold text-slate-800 mb-2">Tax & Adjustments</Text>

          <Label text="Tax Rule" />
          <TouchableOpacity
            onPress={() => setShowTaxPicker(true)}
            className="border border-slate-200 rounded-lg px-3 py-2.5 flex-row justify-between items-center bg-white mb-2"
          >
            <Text className="text-slate-800 text-sm">
              {selectedTaxName} ({fmtPercent(form.tax_rate)})
            </Text>
            <ChevronDown size={16} color="#64748b" />
          </TouchableOpacity>

          <Label text="Tax Rate (%)" />
          <TextInput value={form.tax_rate} onChangeText={(v) => updateField('tax_rate', v)} keyboardType="numeric" className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" />

          <Label text="Discount Rate (%)" />
          <TextInput value={form.discount_rate} onChangeText={(v) => updateField('discount_rate', v)} keyboardType="numeric" className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" />

          <Label text="Retention Rate (%)" />
          <TextInput value={form.retention_rate} onChangeText={(v) => updateField('retention_rate', v)} keyboardType="numeric" className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" />

          <Label text="CIS Rate (%)" />
          <TextInput value={form.cis_rate} onChangeText={(v) => updateField('cis_rate', v)} keyboardType="numeric" className="border border-slate-200 rounded-lg px-3 py-2 mb-1 text-slate-800" />
        </View>

        {/* Summary — live totals */}
        <View className="bg-white rounded-xl p-4 shadow-sm mb-3">
          <Text className="font-bold text-slate-800 mb-2">Summary</Text>
          <Row label="Subtotal" value={fmtMoney(calc.subtotal)} />
          <Row label="Discount" value={`−${fmtMoney(calc.discount)}`} />
          <Row label="Tax" value={fmtMoney(calc.tax)} />
          <Row label="Retention" value={`−${fmtMoney(calc.retention)}`} />
          <Row label="CIS" value={`−${fmtMoney(calc.cis)}`} />
          <View className="border-t border-slate-200 mt-2 pt-2 flex-row justify-between">
            <Text className="font-bold text-slate-800 text-lg">Total Due</Text>
            <Text className="font-bold text-blue-600 text-lg">{fmtMoney(calc.total)}</Text>
          </View>
          <Text className="text-xs text-slate-400 mt-1">
            Totals are recomputed server-side on save (DECIMAL(12,2)). UI preview uses the same formula.
          </Text>
        </View>

        {/* Notes & terms */}
        <View className="bg-white rounded-xl p-4 shadow-sm mb-3">
          <Text className="font-bold text-slate-800 mb-2">Notes & Terms</Text>
          <Label text="Notes" />
          <TextInput value={form.notes} onChangeText={(v) => updateField('notes', v)} multiline className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800 h-20" />
          <Label text="Terms" />
          <TextInput value={form.terms} onChangeText={(v) => updateField('terms', v)} multiline className="border border-slate-200 rounded-lg px-3 py-2 mb-1 text-slate-800 h-20" />
        </View>

        {/* Actions */}
        <View className="bg-white rounded-xl p-4 shadow-sm mb-6">
          <Text className="font-bold text-slate-800 mb-2">Actions</Text>
          <View className="flex-row gap-2 mb-2">
            <TouchableOpacity onPress={saveDraft} disabled={saving} className="flex-1 bg-slate-700 rounded-lg p-3 items-center flex-row justify-center gap-2">
              <Save size={16} color="#fff" />
              <Text className="text-white font-medium">{saving ? 'Saving...' : 'Save Draft'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={sendInvoice} disabled={saving} className="flex-1 bg-blue-600 rounded-lg p-3 items-center flex-row justify-center gap-2">
              <Send size={16} color="#fff" />
              <Text className="text-white font-medium">{saving ? 'Saving...' : 'Send Invoice'}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={generatePDF} disabled={pdfLoading} className="bg-slate-800 rounded-lg p-3 items-center flex-row justify-center gap-2">
            <Share size={16} color="#fff" />
            <Text className="text-white font-medium">{pdfLoading ? 'Creating PDF...' : 'Share PDF'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Tax rule picker */}
      <Modal visible={showTaxPicker} animationType="slide" transparent>
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-xl h-[60%] p-4">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-lg font-bold text-slate-800">Select Tax Rule</Text>
              <TouchableOpacity onPress={() => setShowTaxPicker(false)}><X size={20} color="#334155" /></TouchableOpacity>
            </View>
            <FlatList
              data={taxRules}
              keyExtractor={(r) => r.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => { updateField('tax_rate', item.rate); setShowTaxPicker(false); }}
                  className="py-3 border-b border-slate-100 flex-row justify-between"
                >
                  <Text className="text-slate-800 font-medium">
                    {item.name} ({fmtPercent(item.rate)})
                  </Text>
                  <Text className="text-slate-500 text-xs">
                    {item.type}{item.country ? ` · ${item.country}` : ''}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text className="text-slate-400 text-center mt-8">
                  No tax rules — add one from the Taxes tab.
                </Text>
              }
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function Label({ text }: { text: string }) {
  return <Text className="text-xs text-slate-500 mb-1 mt-1">{text}</Text>;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between mb-1">
      <Text className="text-slate-600">{label}</Text>
      <Text className="font-medium text-slate-800">{value}</Text>
    </View>
  );
}

// ───── helpers ─────

function invoiceToForm(inv: InvoiceFull): FormState {
  return {
    invoice_id: inv.id,
    client_id: inv.client_id,
    invoice_number: inv.invoice_number,
    issue_date: inv.issue_date || TODAY(),
    due_date: inv.due_date || ADD_30(),
    notes: inv.notes || '',
    terms: inv.terms || 'Payment due within 30 days.',
    tax_rate: inv.tax_rate,
    discount_rate: inv.discount_rate,
    retention_rate: inv.retention_rate,
    cis_rate: inv.cis_rate,
    status: inv.status,
    line_items: (inv.line_items || []).length > 0
      ? inv.line_items.map((li) => ({
          id: li.id,
          description: li.description,
          quantity: li.quantity,
          unit_price: li.unit_price,
        }))
      : [newLine()],
  };
}

interface CalcSnapshot {
  subtotal: number;
  discount: number;
  taxable: number;
  tax: number;
  retention: number;
  cis: number;
  total: number;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInvoiceHtml(form: FormState, calc: CalcSnapshot, client: Client | null): string {
  const rows = form.line_items
    .filter((l) => l.description.trim())
    .map((l) => {
      const qty = toNum(l.quantity);
      const price = toNum(l.unit_price);
      return `<tr>
        <td>${escapeHtml(l.description)}</td>
        <td style="text-align:right">${qty}</td>
        <td style="text-align:right">${fmtMoney(price)}</td>
        <td style="text-align:right">${fmtMoney(qty * price)}</td>
      </tr>`;
    })
    .join('');

  const clientBlock = client
    ? `<h3>${escapeHtml(client.name)}</h3>
       ${client.email ? `<p>${escapeHtml(client.email)}</p>` : ''}
       ${client.vat_number ? `<p>VAT: ${escapeHtml(client.vat_number)}</p>` : ''}`
    : '<h3>(No client selected)</h3>';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { font-family: -apple-system, system-ui, sans-serif; color: #1e293b; padding: 32px; }
    h1 { font-size: 2em; color: #2563eb; margin: 0; }
    .header { display: flex; justify-content: space-between; margin-bottom: 32px; }
    .meta { text-align: right; color: #475569; font-size: 0.9em; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e2e8f0; }
    th { background: #f1f5f9; font-weight: 600; }
    .totals { width: 280px; margin-left: auto; }
    .totals td { padding: 6px 10px; border: none; }
    .total { font-weight: bold; font-size: 1.2em; color: #2563eb; border-top: 1px solid #cbd5e1; }
    .footer { margin-top: 32px; color: #64748b; font-size: 0.9em; }
  </style></head><body>
    <div class="header">
      <div>
        <h1>INVOICE</h1>
        <p>#${escapeHtml(form.invoice_number)}</p>
      </div>
      <div class="meta">
        <p>Issued: ${escapeHtml(form.issue_date)}</p>
        <p>Due: ${escapeHtml(form.due_date)}</p>
      </div>
    </div>

    <h4>Bill to</h4>
    ${clientBlock}

    <table>
      <thead>
        <tr><th>Description</th><th style="text-align:right">Qty</th><th style="text-align:right">Unit</th><th style="text-align:right">Amount</th></tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="4">No line items</td></tr>'}</tbody>
    </table>

    <table class="totals">
      <tr><td>Subtotal</td><td style="text-align:right">${fmtMoney(calc.subtotal)}</td></tr>
      <tr><td>Discount</td><td style="text-align:right">−${fmtMoney(calc.discount)}</td></tr>
      <tr><td>Tax</td><td style="text-align:right">${fmtMoney(calc.tax)}</td></tr>
      ${calc.retention > 0 ? `<tr><td>Retention</td><td style="text-align:right">−${fmtMoney(calc.retention)}</td></tr>` : ''}
      ${calc.cis > 0 ? `<tr><td>CIS</td><td style="text-align:right">−${fmtMoney(calc.cis)}</td></tr>` : ''}
      <tr class="total"><td>Total Due</td><td style="text-align:right">${fmtMoney(calc.total)}</td></tr>
    </table>

    ${form.notes ? `<div class="footer"><strong>Notes:</strong><br/>${escapeHtml(form.notes).replace(/\n/g, '<br/>')}</div>` : ''}
    ${form.terms ? `<div class="footer"><strong>Terms:</strong><br/>${escapeHtml(form.terms).replace(/\n/g, '<br/>')}</div>` : ''}
  </body></html>`;
}
