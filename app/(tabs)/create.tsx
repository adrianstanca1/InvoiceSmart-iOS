import React, { useCallback, useMemo, useState } from 'react';
import {
  ScrollView, View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform,
  Switch, Modal, FlatList,
} from 'react-native';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import {
  Plus, Trash2, Save, Share, Sparkles, ArrowUp, ArrowDown, Send, CheckCircle2,
  CreditCard, Palette, Layout, Receipt, Building2, ChevronDown, X,
} from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import * as api from '../../services/api';
import { Invoice, LineItem, Client, TaxRule } from '../../types';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { ErrorToast } from '../../components/ErrorToast';
import { StatusBadge } from '../../components/StatusBadge';
import { ClientPicker } from '../../components/ClientPicker';
import { ModernTemplate } from '../../components/InvoiceTemplates';
import { generateInvoiceFromPrompt } from '../../services/aiService';

const EmptyInvoice = (): Invoice => ({
  id: '', invoiceNumber: 'INV-001', date: new Date().toISOString().split('T')[0], dueDate: '',
  fromName: '', fromEmail: '', fromAddress: '', toName: '', toEmail: '', toAddress: '',
  lineItems: [{ id: '1', description: '', quantity: 1, rate: 0, taxRate: 20 }],
  notes: '', terms: 'Payment due within 30 days.', currency: 'GBP', taxRate: 20, discountRate: 0,
  status: 'Draft', reverseCharge: false, retentionRate: 0, cisRate: 0, template: 'modern',
  paymentGateway: 'none', showNotes: true, showTerms: true, brandColor: '#2563eb',
});

const COLOR_OPTIONS = ['#2563eb', '#16a34a', '#9333ea', '#dc2626', '#0f172a', '#0ea5e9'];
const TEMPLATES: Invoice['template'][] = ['modern', 'classic', 'minimal'];
const GATEWAYS: ('none' | 'stripe' | 'paypal')[] = ['none', 'stripe', 'paypal'];

export default function InvoiceBuilderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [invoice, setInvoice] = useState<Invoice>(EmptyInvoice());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState('');
  const [taxRules, setTaxRules] = useState<TaxRule[]>([]);
  const [showTaxPicker, setShowTaxPicker] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showGatewayPicker, setShowGatewayPicker] = useState(false);

  const calc = useMemo(() => {
    const subtotal = invoice.lineItems.reduce((s, i) => s + i.quantity * i.rate, 0);
    let tax = 0;
    if (!invoice.reverseCharge) {
      tax = invoice.lineItems.reduce((s, i) => {
        const tr = i.taxRate || invoice.taxRate || 0;
        return s + i.quantity * i.rate * (tr / 100);
      }, 0);
    }
    const discount = subtotal * (invoice.discountRate / 100);
    const total = subtotal + tax - discount;
    const retention = subtotal * (invoice.retentionRate / 100);
    const labor = invoice.lineItems.filter(i => i.isLabor).reduce((a, i) => a + i.quantity * i.rate, 0);
    const cis = labor * (invoice.cisRate / 100);
    const amountDue = total - retention - cis;
    return { subtotal, tax, discount, total, retention, cis, amountDue };
  }, [invoice]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [rules] = await Promise.all([
        api.getTaxRules(),
        (async () => {
          if (params.id) {
            const found = await api.getInvoice(params.id as string);
            if (found) {
              const normalized: Invoice = {
                id: found.id,
                clientId: (found as any).client_id,
                invoiceNumber: (found as any).invoice_number || 'INV-001',
                date: (found as any).issue_date || new Date().toISOString().split('T')[0],
                dueDate: (found as any).due_date || '',
                fromName: (found as any).from_name || '',
                fromEmail: (found as any).from_email || '',
                fromAddress: typeof (found as any).from_address === 'object' ? JSON.stringify((found as any).from_address) : ((found as any).from_address || ''),
                toName: (found as any).to_name || '',
                toEmail: (found as any).to_email || '',
                toAddress: typeof (found as any).to_address === 'object' ? JSON.stringify((found as any).to_address) : ((found as any).to_address || ''),
                clientVatNumber: (found as any).client_vat_number || '',
                lineItems: ((found as any).line_items || []).map((li: any, idx: number) => ({
                  id: li.id || String(idx + 1),
                  description: li.description || '',
                  quantity: li.quantity || 1,
                  rate: li.unit_price || li.rate || 0,
                  isLabor: li.is_labor || false,
                  taxRate: li.tax_rate,
                })),
                notes: found.notes || '',
                terms: found.terms || 'Payment due within 30 days.',
                currency: found.currency || 'GBP',
                taxRate: (found as any).tax_rate || 20,
                discountRate: (found as any).discount_rate || 0,
                retentionRate: (found as any).retention_rate || 0,
                cisRate: (found as any).cis_rate || 0,
                status: ((found.status || 'Draft').replace(/^\w/, (c: string) => c.toUpperCase())) as any,
                template: (found.template || 'modern') as any,
                brandColor: (found as any).brand_color || '#2563eb',
                reverseCharge: (found as any).reverse_charge || false,
                paymentGateway: ((found as any).payment_gateway || 'none') as any,
                showNotes: (found as any).show_notes !== false,
                showTerms: (found as any).show_terms !== false,
              };
              setInvoice(normalized);
            }
          } else {
            const num = await api.getNextInvoiceNumber();
            setInvoice((inv: any) => ({ ...inv, id: Date.now().toString(36), invoiceNumber: num }));
          }
        })(),
      ]);
      setTaxRules(rules);
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function updateField(field: keyof Invoice, value: any) {
    setInvoice(prev => ({ ...prev, [field]: value }));
  }
  function updateLine(index: number, field: keyof LineItem, value: any) {
    setInvoice(prev => {
      const items = [...prev.lineItems];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, lineItems: items };
    });
  }
  function addLine() {
    setInvoice(prev => ({
      ...prev,
      lineItems: [
        ...prev.lineItems,
        {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2),
          description: '',
          quantity: 1,
          rate: 0,
          taxRate: prev.taxRate || 20,
        },
      ],
    }));
  }
  function removeLine(index: number) {
    if (invoice.lineItems.length <= 1) { Alert.alert('Error', 'At least one line item required'); return; }
    setInvoice(prev => ({ ...prev, lineItems: prev.lineItems.filter((_, i) => i !== index) }));
  }
  function moveLine(index: number, dir: number) {
    setInvoice(prev => {
      const items = [...prev.lineItems];
      const newIndex = index + dir;
      if (newIndex < 0 || newIndex >= items.length) return prev;
      [items[index], items[newIndex]] = [items[newIndex], items[index]];
      return { ...prev, lineItems: items };
    });
  }

  function toBackendPayload(inv: Invoice, statusOverride?: Invoice['status']) {
    return {
      client_id: inv.clientId,
      status: (statusOverride || inv.status).toLowerCase(),
      issue_date: inv.date,
      due_date: inv.dueDate,
      notes: inv.notes,
      terms: inv.terms,
      tax_rate: inv.taxRate,
      discount_rate: inv.discountRate,
      retention_rate: inv.retentionRate,
      cis_rate: inv.cisRate,
      line_items: inv.lineItems.map(li => ({
        description: li.description,
        quantity: li.quantity,
        unit_price: li.rate,
      })),
      invoice_prefix: (inv.invoiceNumber || 'INV').split('-')[0],
      auto_increment: true,
    };
  }

  async function persist(statusOverride?: Invoice['status']) {
    if (!invoice.toName) { Alert.alert('Error', 'Client name is required'); return null; }
    const payload = toBackendPayload(invoice, statusOverride);
    if (params.id) {
      return api.updateInvoice(params.id as string, payload as any);
    }
    return api.createInvoice(payload as any);
  }

  async function saveDraft() {
    setSaving(true);
    setError('');
    try {
      const saved = await persist('Draft');
      if (saved) {
        Alert.alert('Saved', `Invoice ${saved.invoiceNumber} saved as Draft.`);
        router.replace('/history');
      }
    } catch (e: any) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function sendInvoice() {
    setSaving(true);
    setError('');
    try {
      const saved = await persist('Sent');
      if (saved) {
        Alert.alert('Sent', `Invoice ${saved.invoiceNumber} marked as Sent.`);
        router.replace('/history');
      }
    } catch (e: any) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function markPaid() {
    if (!invoice.id) return;
    setSaving(true);
    setError('');
    try {
      const saved = await api.markPaid(invoice.id);
      if (saved) {
        setInvoice(saved);
        Alert.alert('Updated', `Invoice ${saved.invoiceNumber} marked as Paid.`);
      }
    } catch (e: any) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function generatePDF() {
    setPdfLoading(true);
    setError('');
    try {
      const html = ModernTemplate(invoice, calc);
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (e: any) {
      setError(String(e));
    } finally {
      setPdfLoading(false);
    }
  }

  async function runAI() {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setError('');
    try {
      const data = await generateInvoiceFromPrompt(aiPrompt);
      setInvoice(prev => ({
        ...prev,
        ...data,
        lineItems: Array.isArray(data.lineItems)
          ? data.lineItems.map((li: any, idx: number) => ({
              id: String(idx + 1),
              description: li.description || '',
              quantity: Number(li.quantity) || 1,
              rate: Number(li.rate) || 0,
              taxRate: li.taxRate ?? prev.taxRate,
            }))
          : prev.lineItems,
      }));
    } catch (e: any) {
      setError(`AI Error: ${String(e)}`);
    }
    setAiLoading(false);
  }

  const selectedTaxName = useMemo(() => {
    // Simple mapping: use invoice taxRate to pick a name from rules if exact match, else Custom
    const rule = taxRules.find(r => r.rate === invoice.taxRate);
    return rule ? rule.name : `${invoice.taxRate}%`;
  }, [taxRules, invoice.taxRate]);

  if (loading) return <LoadingSpinner />;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
      <ScrollView className="flex-1 bg-slate-50 p-4">
        <Text className="text-2xl font-bold text-slate-800 mb-3">{params.id ? 'Edit Invoice' : 'New Invoice'}</Text>

        {error ? <ErrorToast message={error} /> : null}

        <View className="bg-white rounded-xl p-4 shadow-sm mb-3">
          <Text className="font-bold text-slate-800 mb-2">Status</Text>
          <View className="flex-row items-center justify-between">
            <StatusBadge status={invoice.status} />
            {params.id && invoice.status !== 'Paid' && (
              <TouchableOpacity onPress={markPaid} className="bg-green-600 rounded-lg px-3 py-2 flex-row items-center gap-2">
                <CheckCircle2 size={14} color="#fff" />
                <Text className="text-white text-sm font-medium">Mark Paid</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View className="bg-white rounded-xl p-4 shadow-sm mb-3">
          <Text className="font-bold text-slate-800 mb-2">AI Assist</Text>
          <TextInput value={aiPrompt} onChangeText={setAiPrompt} placeholder="Describe the work..." multiline className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800 h-20"
          />
          <TouchableOpacity onPress={runAI} disabled={aiLoading} className="bg-indigo-600 rounded-lg p-3 items-center flex-row justify-center gap-2">
            <Sparkles size={16} color="#fff" />
            <Text className="text-white font-medium">{aiLoading ? 'Generating...' : 'Generate with AI'}</Text>
          </TouchableOpacity>
        </View>

        <View className="bg-white rounded-xl p-4 shadow-sm mb-3">
          <Text className="font-bold text-slate-800 mb-2">Invoice Details</Text>
          <Label text="Invoice #" />
          <TextInput value={invoice.invoiceNumber} onChangeText={v => updateField('invoiceNumber', v)} className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" />
          <Label text="Date" />
          <TextInput value={invoice.date} onChangeText={v => updateField('date', v)} className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" />
          <Label text="Due Date" />
          <TextInput value={invoice.dueDate} onChangeText={v => updateField('dueDate', v)} placeholder="YYYY-MM-DD" className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" />
          <Label text="From Name" />
          <TextInput value={invoice.fromName} onChangeText={v => updateField('fromName', v)} className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" />
          <Label text="From Email" />
          <TextInput value={invoice.fromEmail} onChangeText={v => updateField('fromEmail', v)} keyboardType="email-address" className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" />
          <Label text="From Address" />
          <TextInput value={invoice.fromAddress} onChangeText={v => updateField('fromAddress', v)} multiline className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800 h-16" />
          <Label text="Client" />
          <ClientPicker selectedId={invoice.clientId} onSelect={(c: Client) => {
            updateField('clientId', c.id);
            updateField('toName', c.name);
            updateField('toEmail', c.email);
            updateField('toAddress', c.address || '');
            if (c.vatNumber) updateField('clientVatNumber', c.vatNumber);
            if (c.defaultTerms) updateField('terms', c.defaultTerms);
            if (typeof c.defaultTaxRate === 'number') updateField('taxRate', c.defaultTaxRate);
          }} />
          <Label text="To Name" />
          <TextInput value={invoice.toName} onChangeText={v => updateField('toName', v)} className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800 mt-1" />
          <Label text="To Email" />
          <TextInput value={invoice.toEmail} onChangeText={v => updateField('toEmail', v)} keyboardType="email-address" className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" />
          <Label text="To Address" />
          <TextInput value={invoice.toAddress} onChangeText={v => updateField('toAddress', v)} multiline className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800 h-16" />
          <Label text="Client VAT Number" />
          <TextInput value={invoice.clientVatNumber || ''} onChangeText={v => updateField('clientVatNumber', v)} className="border border-slate-200 rounded-lg px-3 py-2 mb-1 text-slate-800" />
        </View>

        <View className="bg-white rounded-xl p-4 shadow-sm mb-3">
          <Text className="font-bold text-slate-800 mb-2">Line Items</Text>
          {invoice.lineItems.map((item, idx) => (
            <View key={item.id} className="border border-slate-200 rounded-lg p-3 mb-2">
              <TextInput value={item.description} onChangeText={v => updateLine(idx, 'description', v)} placeholder="Description" className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" />
              <View className="flex-row gap-2 mb-2">
                <TextInput value={String(item.quantity)} onChangeText={v => updateLine(idx, 'quantity', parseFloat(v) || 0)} keyboardType="numeric" placeholder="Qty" className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-slate-800" />
                <TextInput value={String(item.rate)} onChangeText={v => updateLine(idx, 'rate', parseFloat(v) || 0)} keyboardType="numeric" placeholder="Rate" className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-slate-800" />
                <View className="flex-row items-center">
                  <TouchableOpacity onPress={() => moveLine(idx, -1)} className="p-2"><ArrowUp size={18} color="#64748b" /></TouchableOpacity>
                  <TouchableOpacity onPress={() => moveLine(idx, 1)} className="p-2"><ArrowDown size={18} color="#64748b" /></TouchableOpacity>
                  <TouchableOpacity onPress={() => removeLine(idx)} className="p-2"><Trash2 size={18} color="#dc2626" /></TouchableOpacity>
                </View>
              </View>
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <Text className="text-xs text-slate-500">Labor</Text>
                  <Switch value={!!item.isLabor} onValueChange={v => updateLine(idx, 'isLabor', v)} />
                </View>
                <Text className="text-xs text-slate-500">Line tax: {item.taxRate ?? invoice.taxRate}%</Text>
              </View>
            </View>
          ))}
          <TouchableOpacity onPress={addLine} className="bg-slate-100 rounded-lg p-3 items-center flex-row justify-center gap-2">
            <Plus size={16} color="#334155" />
            <Text className="text-slate-700 font-medium">Add Line Item</Text>
          </TouchableOpacity>
        </View>

        <View className="bg-white rounded-xl p-4 shadow-sm mb-3">
          <Text className="font-bold text-slate-800 mb-2">Tax & Discounts</Text>
          <Label text="Tax Rule" />
          <TouchableOpacity onPress={() => setShowTaxPicker(true)} className="border border-slate-200 rounded-lg px-3 py-2.5 flex-row justify-between items-center bg-white mb-2">
            <Text className="text-slate-800 text-sm">{selectedTaxName} ({invoice.taxRate}%)</Text>
            <ChevronDown size={16} color="#64748b" />
          </TouchableOpacity>
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-sm text-slate-700">Reverse Charge</Text>
            <Switch value={invoice.reverseCharge} onValueChange={v => updateField('reverseCharge', v)} />
          </View>
          <Label text="Discount Rate (%)" />
          <TextInput value={String(invoice.discountRate)} onChangeText={v => updateField('discountRate', parseFloat(v) || 0)} keyboardType="numeric" className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" />
          <Label text="Retention Rate (%)" />
          <TextInput value={String(invoice.retentionRate)} onChangeText={v => updateField('retentionRate', parseFloat(v) || 0)} keyboardType="numeric" className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" />
          <Label text="CIS Rate (%)" />
          <TextInput value={String(invoice.cisRate)} onChangeText={v => updateField('cisRate', parseFloat(v) || 0)} keyboardType="numeric" className="border border-slate-200 rounded-lg px-3 py-2 mb-1 text-slate-800" />
        </View>

        <View className="bg-white rounded-xl p-4 shadow-sm mb-3">
          <Text className="font-bold text-slate-800 mb-2">Summary</Text>
          <View className="flex-row justify-between mb-1">
            <Text className="text-slate-600">Subtotal:</Text>
            <Text className="font-medium text-slate-800">£{calc.subtotal.toFixed(2)}</Text>
          </View>
          <View className="flex-row justify-between mb-1">
            <Text className="text-slate-600">Total Tax:</Text>
            <Text className="font-medium text-slate-800">£{calc.tax.toFixed(2)}</Text>
          </View>
          <View className="flex-row justify-between mb-1">
            <Text className="text-slate-600">Discount:</Text>
            <Text className="font-medium text-slate-800">-£{calc.discount.toFixed(2)}</Text>
          </View>
          <View className="flex-row justify-between mb-1">
            <Text className="text-slate-600">Retention:</Text>
            <Text className="font-medium text-slate-800">-£{calc.retention.toFixed(2)}</Text>
          </View>
          <View className="flex-row justify-between mb-1">
            <Text className="text-slate-600">CIS:</Text>
            <Text className="font-medium text-slate-800">-£{calc.cis.toFixed(2)}</Text>
          </View>
          <View className="border-t border-slate-200 mt-2 pt-2 flex-row justify-between">
            <Text className="font-bold text-slate-800 text-lg">Total Due:</Text>
            <Text className="font-bold text-blue-600 text-lg">£{calc.amountDue.toFixed(2)}</Text>
          </View>
        </View>

        <View className="bg-white rounded-xl p-4 shadow-sm mb-3">
          <Text className="font-bold text-slate-800 mb-2 flex-row items-center gap-2">
            <Palette size={16} color="#334155" /> Brand & Template</Text>
          <View className="flex-row gap-2 mb-3">
            {COLOR_OPTIONS.map(c => (
              <TouchableOpacity key={c} onPress={() => updateField('brandColor', c)} className={`w-8 h-8 rounded-full border-2 ${invoice.brandColor === c ? 'border-slate-800' : 'border-transparent'}`} style={{ backgroundColor: c }} />
            ))}
          </View>
          <Label text="Template" />
          <TouchableOpacity onPress={() => setShowTemplatePicker(true)} className="border border-slate-200 rounded-lg px-3 py-2.5 flex-row justify-between items-center bg-white mb-2">
            <Text className="text-slate-800 text-sm capitalize">{invoice.template}</Text>
            <ChevronDown size={16} color="#64748b" />
          </TouchableOpacity>
        </View>

        <View className="bg-white rounded-xl p-4 shadow-sm mb-3">
          <Text className="font-bold text-slate-800 mb-2 flex-row items-center gap-2">
            <CreditCard size={16} color="#334155" /> Payment Gateway</Text>
          <TouchableOpacity onPress={() => setShowGatewayPicker(true)} className="border border-slate-200 rounded-lg px-3 py-2.5 flex-row justify-between items-center bg-white">
            <Text className="text-slate-800 text-sm capitalize">{invoice.paymentGateway}</Text>
            <ChevronDown size={16} color="#64748b" />
          </TouchableOpacity>
        </View>

        <View className="bg-white rounded-xl p-4 shadow-sm mb-3">
          <Text className="font-bold text-slate-800 mb-2">Notes & Terms</Text>
          <Label text="Notes" />
          <TextInput value={invoice.notes} onChangeText={v => updateField('notes', v)} multiline className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800 h-20" />
          <Label text="Terms" />
          <TextInput value={invoice.terms} onChangeText={v => updateField('terms', v)} multiline className="border border-slate-200 rounded-lg px-3 py-2 mb-1 text-slate-800 h-20" />
        </View>

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

      {/* Tax Rule Picker Modal */}
      <Modal visible={showTaxPicker} animationType="slide" transparent>
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-xl h-[60%] p-4">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-lg font-bold text-slate-800">Select Tax Rule</Text>
              <TouchableOpacity onPress={() => setShowTaxPicker(false)}><X size={20} color="#334155" /></TouchableOpacity>
            </View>
            <FlatList
              data={taxRules}
              keyExtractor={r => r.id}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => { updateField('taxRate', item.rate); setShowTaxPicker(false); }} className="py-3 border-b border-slate-100 flex-row justify-between">
                  <Text className="text-slate-800 font-medium">{item.name} ({item.rate}%)</Text>
                  <Text className="text-slate-500 text-xs">{item.description}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text className="text-slate-400 text-center mt-8">No tax rules available</Text>}
            />
          </View>
        </View>
      </Modal>

      {/* Template Picker Modal */}
      <Modal visible={showTemplatePicker} animationType="slide" transparent>
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-xl h-[40%] p-4">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-lg font-bold text-slate-800">Select Template</Text>
              <TouchableOpacity onPress={() => setShowTemplatePicker(false)}><X size={20} color="#334155" /></TouchableOpacity>
            </View>
            {TEMPLATES.map(t => (
              <TouchableOpacity key={t} onPress={() => { updateField('template', t); setShowTemplatePicker(false); }} className="py-3 border-b border-slate-100 flex-row items-center gap-2">
                <Layout size={16} color="#64748b" />
                <Text className="text-slate-800 font-medium capitalize">{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Gateway Picker Modal */}
      <Modal visible={showGatewayPicker} animationType="slide" transparent>
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-xl h-[40%] p-4">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-lg font-bold text-slate-800">Select Payment Gateway</Text>
              <TouchableOpacity onPress={() => setShowGatewayPicker(false)}><X size={20} color="#334155" /></TouchableOpacity>
            </View>
            {GATEWAYS.map(g => (
              <TouchableOpacity key={g} onPress={() => { updateField('paymentGateway', g); setShowGatewayPicker(false); }} className="py-3 border-b border-slate-100 flex-row items-center gap-2">
                <CreditCard size={16} color="#64748b" />
                <Text className="text-slate-800 font-medium capitalize">{g}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function Label({ text }: { text: string }) {
  return (
    <Text className="text-xs text-slate-500 mb-1 mt-1">{text}</Text>
  );
}
