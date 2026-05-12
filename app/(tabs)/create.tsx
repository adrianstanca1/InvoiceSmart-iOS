import React, { useState, useCallback } from 'react';
import { ScrollView, View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { Plus, Trash2, Save, Share, Sparkles } from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as Storage from '../../lib/storage';
import { Invoice, LineItem } from '../../types';
import { ModernTemplate } from '../../components/InvoiceTemplates';
import { generateInvoiceFromPrompt } from '../../services/aiService';

const EmptyInvoice = (): Invoice => ({
  id: '', invoiceNumber: 'INV-001', date: new Date().toISOString().split('T')[0], dueDate: '',
  fromName: '', fromEmail: '', fromAddress: '', toName: '', toEmail: '', toAddress: '',
  lineItems: [{ id: '1', description: 'Labor Services', quantity: 1, rate: 0 }],
  notes: '', terms: 'Payment due within 30 days.', currency: 'GBP', taxRate: 20, discountRate: 0,
  status: 'Draft', reverseCharge: false, retentionRate: 0, cisRate: 0, template: 'modern',
  paymentGateway: 'none', showNotes: true, showTerms: true,
});

export default function InvoiceBuilderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [invoice, setInvoice] = useState<Invoice>(EmptyInvoice());
  const [saving, setSaving] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useFocusEffect(useCallback(() => { load(); }, []));

  async function load() {
    if (params.id) {
      const invs = await Storage.getInvoices();
      const found = invs.find(i => i.id === params.id as string);
      if (found) setInvoice(found);
    } else {
      const invs = await Storage.getInvoices();
      const num = await Storage.getNextInvoiceNumber(invs);
      setInvoice({ ...EmptyInvoice(), id: Date.now().toString(36), invoiceNumber: num });
    }
  }

  const calc = React.useMemo(() => {
    const subtotal = invoice.lineItems.reduce((a, i) => a + i.quantity * i.rate, 0);
    const tax = invoice.reverseCharge ? 0 : subtotal * (invoice.taxRate / 100);
    const discount = subtotal * (invoice.discountRate / 100);
    const total = subtotal + tax - discount;
    const retention = subtotal * (invoice.retentionRate / 100);
    const labor = invoice.lineItems.filter(i => i.isLabor).reduce((a, i) => a + i.quantity * i.rate, 0);
    const cis = labor * (invoice.cisRate / 100);
    const amountDue = total - retention - cis;
    return { subtotal, tax, discount, total, retention, cis, amountDue };
  }, [invoice]);

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
    setInvoice(prev => ({ ...prev, lineItems: [...prev.lineItems, { id: Date.now().toString(36) + Math.random().toString(36).slice(2), description: '', quantity: 1, rate: 0 }] }));
  }
  function removeLine(index: number) {
    setInvoice(prev => ({ ...prev, lineItems: prev.lineItems.filter((_, i) => i !== index) }));
  }

  async function saveInvoice() {
    if (!invoice.toName) { Alert.alert('Error', 'Client name is required'); return; }
    setSaving(true);
    const invs = await Storage.getInvoices();
    const idx = invs.findIndex(i => i.id === invoice.id);
    if (idx >= 0) invs[idx] = invoice; else invs.push(invoice);
    await Storage.saveInvoices(invs);
    await Storage.logAction('Created', 'Invoice', invoice.id, invoice.invoiceNumber, 'Created from mobile app');
    setSaving(false);
    Alert.alert('Saved', `Invoice ${invoice.invoiceNumber} saved.`);
    router.replace('/history');
  }

  async function generatePDF() {
    const html = ModernTemplate(invoice, calc);
    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
  }

  async function runAI() {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const data = await generateInvoiceFromPrompt(aiPrompt);
      setInvoice(prev => ({
        ...prev,
        ...data,
        lineItems: Array.isArray(data.lineItems) ? data.lineItems.map((li: any, idx: number) => ({ id: String(idx + 1), description: li.description || '', quantity: Number(li.quantity) || 1, rate: Number(li.rate) || 0 })) : prev.lineItems,
      }));
    } catch (e) { Alert.alert('AI Error', String(e)); }
    setAiLoading(false);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
      <ScrollView className="flex-1 bg-slate-50 p-4">
        <Text className="text-2xl font-bold text-slate-800 mb-3">New Invoice</Text>
        <View className="bg-white rounded-xl p-4 shadow-sm mb-3">
          <Text className="font-bold text-slate-800 mb-2">AI Assist</Text>
          <TextInput value={aiPrompt} onChangeText={setAiPrompt} placeholder="Describe the work..." className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" />
          <TouchableOpacity onPress={runAI} disabled={aiLoading} className="bg-indigo-600 rounded-lg p-3 items-center flex-row justify-center gap-2">
            <Sparkles size={16} color="#fff" /><Text className="text-white font-medium">{aiLoading ? 'Generating...' : 'Generate with AI'}</Text>
          </TouchableOpacity>
        </View>
        <View className="bg-white rounded-xl p-4 shadow-sm mb-3">
          <Text className="font-bold text-slate-800 mb-2">Invoice Details</Text>
          <Text className="text-xs text-slate-500 mb-1">Invoice #</Text>
          <TextInput value={invoice.invoiceNumber} onChangeText={v => updateField('invoiceNumber', v)} className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" />
          <Text className="text-xs text-slate-500 mb-1">From Name</Text>
          <TextInput value={invoice.fromName} onChangeText={v => updateField('fromName', v)} className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" />
          <Text className="text-xs text-slate-500 mb-1">To Name</Text>
          <TextInput value={invoice.toName} onChangeText={v => updateField('toName', v)} className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" />
          <Text className="text-xs text-slate-500 mb-1">To Address</Text>
          <TextInput value={invoice.toAddress} onChangeText={v => updateField('toAddress', v)} multiline className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800 h-16" />
          <Text className="text-xs text-slate-500 mb-1">Date</Text>
          <TextInput value={invoice.date} onChangeText={v => updateField('date', v)} className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" />
          <Text className="text-xs text-slate-500 mb-1">Due Date</Text>
          <TextInput value={invoice.dueDate} onChangeText={v => updateField('dueDate', v)} className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" />
        </View>
        <View className="bg-white rounded-xl p-4 shadow-sm mb-3">
          <Text className="font-bold text-slate-800 mb-2">Line Items</Text>
          {invoice.lineItems.map((item, idx) => (
            <View key={item.id} className="border border-slate-200 rounded-lg p-3 mb-2">
              <TextInput value={item.description} onChangeText={v => updateLine(idx, 'description', v)} placeholder="Description" className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" />
              <View className="flex-row gap-2">
                <TextInput value={String(item.quantity)} onChangeText={v => updateLine(idx, 'quantity', parseFloat(v) || 0)} keyboardType="numeric" placeholder="Qty" className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-slate-800" />
                <TextInput value={String(item.rate)} onChangeText={v => updateLine(idx, 'rate', parseFloat(v) || 0)} keyboardType="numeric" placeholder="Rate" className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-slate-800" />
                <TouchableOpacity onPress={() => removeLine(idx)} className="px-3 py-2"><Trash2 size={20} color="#dc2626" /></TouchableOpacity>
              </View>
            </View>
          ))}
          <TouchableOpacity onPress={addLine} className="bg-slate-100 rounded-lg p-3 items-center flex-row justify-center gap-2">
            <Plus size={16} color="#334155" /><Text className="text-slate-700 font-medium">Add Line Item</Text>
          </TouchableOpacity>
        </View>
        <View className="bg-white rounded-xl p-4 shadow-sm mb-3">
          <Text className="font-bold text-slate-800 mb-2">Tax & Totals</Text>
          <View className="flex-row justify-between mb-1"><Text className="text-slate-600">Subtotal:</Text><Text className="font-medium text-slate-800">${calc.subtotal.toFixed(2)}</Text></View>
          <View className="flex-row justify-between mb-1"><Text className="text-slate-600">VAT ({invoice.taxRate}%):</Text><Text className="font-medium text-slate-800">${calc.tax.toFixed(2)}</Text></View>
          <View className="flex-row justify-between mb-1"><Text className="text-slate-600">Discount:</Text><Text className="font-medium text-slate-800">-${calc.discount.toFixed(2)}</Text></View>
          <View className="flex-row justify-between mb-1"><Text className="text-slate-600">Retention:</Text><Text className="font-medium text-slate-800">-${calc.retention.toFixed(2)}</Text></View>
          <View className="flex-row justify-between mb-1"><Text className="text-slate-600">CIS:</Text><Text className="font-medium text-slate-800">-${calc.cis.toFixed(2)}</Text></View>
          <View className="border-t border-slate-200 mt-2 pt-2 flex-row justify-between">
            <Text className="font-bold text-slate-800 text-lg">Total Due:</Text>
            <Text className="font-bold text-blue-600 text-lg">${calc.amountDue.toFixed(2)}</Text>
          </View>
        </View>
        <View className="bg-white rounded-xl p-4 shadow-sm mb-3">
          <Text className="font-bold text-slate-800 mb-2">Settings</Text>
          <Text className="text-xs text-slate-500 mb-1">Tax Rate (%)</Text>
          <TextInput value={String(invoice.taxRate)} onChangeText={v => updateField('taxRate', parseFloat(v) || 0)} keyboardType="numeric" className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" />
          <Text className="text-xs text-slate-500 mb-1">CIS Rate (%)</Text>
          <TextInput value={String(invoice.cisRate)} onChangeText={v => updateField('cisRate', parseFloat(v) || 0)} keyboardType="numeric" className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" />
          <Text className="text-xs text-slate-500 mb-1">Retention Rate (%)</Text>
          <TextInput value={String(invoice.retentionRate)} onChangeText={v => updateField('retentionRate', parseFloat(v) || 0)} keyboardType="numeric" className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" />
          <Text className="text-xs text-slate-500 mb-1">Discount Rate (%)</Text>
          <TextInput value={String(invoice.discountRate)} onChangeText={v => updateField('discountRate', parseFloat(v) || 0)} keyboardType="numeric" className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" />
        </View>
        <View className="bg-white rounded-xl p-4 shadow-sm mb-6">
          <Text className="font-bold text-slate-800 mb-2">Actions</Text>
          <View className="flex-row gap-2">
            <TouchableOpacity onPress={saveInvoice} disabled={saving} className="flex-1 bg-blue-600 rounded-lg p-3 items-center flex-row justify-center gap-2">
              <Save size={16} color="#fff" /><Text className="text-white font-medium">{saving ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={generatePDF} className="flex-1 bg-slate-800 rounded-lg p-3 items-center flex-row justify-center gap-2">
              <Share size={16} color="#fff" /><Text className="text-white font-medium">Share PDF</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
