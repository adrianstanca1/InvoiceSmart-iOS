import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Alert,
  ActivityIndicator, Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Plus, Trash2, Save, Camera, Search } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  getTransactions, createTransaction, deleteTransaction, uploadReceipt,
} from '../../services/api';
import type { Transaction, TransactionType } from '../../types';
import { DateRangePicker } from '../../components/DateRangePicker';
import { EmptyState } from '../../components/EmptyState';
import { fmtMoney, toNum, txnLabel } from '../../lib/format';

type TypeFilter = 'All' | TransactionType;

interface FormState {
  transaction_date: string;
  description: string;
  amount: string; // string for the text input; parsed on save
  type: TransactionType;
  category: string;
  reference: string;
}

const EMPTY_FORM: FormState = {
  transaction_date: new Date().toISOString().slice(0, 10),
  description: '',
  amount: '',
  type: 'expense',
  category: '',
  reference: '',
};

export default function LedgerScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('All');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [showForm, setShowForm] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getTransactions({
        type: typeFilter === 'All' ? undefined : typeFilter,
        startDate: dateRange.startDate || undefined,
        endDate: dateRange.endDate || undefined,
      });
      const rows = (res.data || []).sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));
      // Backend filters by type+date — no server-side category filter,
      // so apply it client-side.
      const filtered = categoryFilter
        ? rows.filter((t) => (t.category || '').toLowerCase().includes(categoryFilter.toLowerCase()))
        : rows;
      setTransactions(filtered);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
  }, [typeFilter, categoryFilter, dateRange]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of transactions) {
      const amt = toNum(t.amount);
      if (t.type === 'payment') income += amt;
      else if (t.type === 'expense') expense += amt;
    }
    return { income, expense, net: income - expense };
  }, [transactions]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const t of transactions) { if (t.category) set.add(t.category); }
    return Array.from(set);
  }, [transactions]);

  async function saveTx() {
    if (!form.description) { Alert.alert('Error', 'Description is required'); return; }
    const amountNum = parseFloat(form.amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      Alert.alert('Error', 'Amount must be a positive number'); return;
    }
    try {
      await createTransaction({
        type: form.type,
        amount: amountNum,
        transaction_date: form.transaction_date,
        category: form.category || null,
        description: form.description,
        reference: form.reference || null,
      });
      setShowForm(false);
      setForm(EMPTY_FORM);
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save transaction');
    }
  }

  async function handleDelete(id: string) {
    Alert.alert('Delete transaction?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try { await deleteTransaction(id); load(); }
          catch (e: any) { Alert.alert('Error', e.message || 'Failed to delete'); }
        },
      },
    ]);
  }

  async function pickReceipt() {
    if (Platform.OS === 'web') {
      Alert.alert('Unsupported', 'Receipt upload is not supported on web.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });
    if (result.canceled || !result.assets?.length) return;
    const b64 = result.assets[0].base64 || '';
    if (!b64) { Alert.alert('Error', 'Could not read image as base64'); return; }
    setUploadingReceipt(true);
    try {
      const res = await uploadReceipt(b64);
      if (res.error) { Alert.alert('Upload failed', res.error); return; }
      setForm((prev) => ({
        ...prev,
        description: res.rawText ? `Receipt: ${res.rawText.slice(0, 80)}` : prev.description,
      }));
      Alert.alert('Uploaded', 'Receipt processed.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Upload failed');
    } finally {
      setUploadingReceipt(false);
    }
  }

  if (loading && transactions.length === 0) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#2563eb" />
        <Text className="text-slate-400 mt-3">Loading ledger...</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-slate-50 p-4">
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-2xl font-bold text-slate-800">Ledger</Text>
        <TouchableOpacity
          onPress={() => { setForm(EMPTY_FORM); setShowForm(true); }}
          className="bg-blue-600 rounded-lg p-2"
        >
          <Plus size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <View className="bg-white rounded-xl p-4 shadow-sm mb-4">
        <Text className="text-slate-500 text-sm">Net</Text>
        <Text className={`text-2xl font-bold ${totals.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {fmtMoney(totals.net)}
        </Text>
        <View className="flex-row justify-between mt-3">
          <View><Text className="text-slate-500 text-sm">Income</Text><Text className="text-green-600 font-bold text-lg">{fmtMoney(totals.income)}</Text></View>
          <View><Text className="text-slate-500 text-sm">Expenses</Text><Text className="text-red-600 font-bold text-lg">{fmtMoney(totals.expense)}</Text></View>
        </View>
      </View>

      <View className="bg-white rounded-xl p-4 shadow-sm mb-3">
        <Text className="font-bold text-slate-800 mb-2">Filters</Text>
        <View className="flex-row mb-2">
          {(['All', 'payment', 'expense'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setTypeFilter(t)}
              className={`flex-1 rounded-lg py-2 items-center mr-1 ${typeFilter === t ? 'bg-blue-600' : 'bg-slate-100'}`}
            >
              <Text className={`text-sm font-medium ${typeFilter === t ? 'text-white' : 'text-slate-700'}`}>
                {t === 'All' ? 'All' : txnLabel(t)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View className="flex-row items-center mb-2">
          <Search size={16} color="#94a3b8" />
          <TextInput
            placeholder="Search category"
            value={categoryFilter}
            onChangeText={setCategoryFilter}
            onSubmitEditing={load}
            returnKeyType="search"
            className="flex-1 ml-2 border border-slate-200 rounded-lg px-3 py-2 text-slate-800"
          />
        </View>
        <DateRangePicker
          startDate={dateRange.startDate}
          endDate={dateRange.endDate}
          onChangeStart={(v) => setDateRange((p) => ({ ...p, startDate: v }))}
          onChangeEnd={(v) => setDateRange((p) => ({ ...p, endDate: v }))}
        />
        <TouchableOpacity onPress={load} className="bg-blue-600 rounded-lg py-2 items-center">
          <Text className="text-white font-medium">Apply Filters</Text>
        </TouchableOpacity>
      </View>

      {categories.length > 0 && (
        <View className="bg-white rounded-xl p-4 shadow-sm mb-3">
          <Text className="font-bold text-slate-800 mb-2">Categories</Text>
          <View className="flex-row flex-wrap gap-2">
            {categories.map((c) => (
              <TouchableOpacity key={c} onPress={() => { setCategoryFilter(c); load(); }} className="bg-slate-100 rounded-full px-3 py-1">
                <Text className="text-xs text-slate-700">{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {showForm && (
        <View className="bg-white rounded-xl p-4 shadow-sm mb-3">
          <Text className="font-bold text-slate-800 mb-2">Add Transaction</Text>
          <TextInput placeholder="Date (YYYY-MM-DD)" value={form.transaction_date} onChangeText={(t) => setForm((f) => ({ ...f, transaction_date: t }))} className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" />
          <TextInput placeholder="Description" value={form.description} onChangeText={(t) => setForm((f) => ({ ...f, description: t }))} className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" />
          <View className="flex-row gap-2 mb-2">
            <TextInput placeholder="Amount" value={form.amount} onChangeText={(t) => setForm((f) => ({ ...f, amount: t }))} keyboardType="numeric" className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-slate-800" />
            <TouchableOpacity
              onPress={() => setForm((f) => ({ ...f, type: f.type === 'payment' ? 'expense' : 'payment' }))}
              className="px-3 py-2 bg-slate-100 rounded-lg justify-center items-center"
            >
              <Text className="font-medium text-slate-800">{txnLabel(form.type)}</Text>
            </TouchableOpacity>
          </View>
          <TextInput placeholder="Category" value={form.category} onChangeText={(t) => setForm((f) => ({ ...f, category: t }))} className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" />
          <TextInput placeholder="Reference" value={form.reference} onChangeText={(t) => setForm((f) => ({ ...f, reference: t }))} className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" />
          <TouchableOpacity onPress={pickReceipt} disabled={uploadingReceipt} className="border border-slate-200 rounded-lg px-3 py-2 mb-3 flex-row items-center justify-center">
            <Camera size={18} color="#475569" />
            <Text className="ml-2 text-slate-700">{uploadingReceipt ? 'Uploading receipt...' : 'Attach receipt'}</Text>
          </TouchableOpacity>
          <View className="flex-row gap-2">
            <TouchableOpacity onPress={saveTx} className="flex-1 bg-blue-600 rounded-lg p-3 items-center flex-row justify-center">
              <Save size={16} color="#fff" /><Text className="text-white font-medium ml-2">Save</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowForm(false)} className="flex-1 bg-slate-200 rounded-lg p-3 items-center">
              <Text className="text-slate-700">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {transactions.length === 0 && !loading ? (
        <EmptyState message="No transactions yet. Tap + to add one." />
      ) : (
        transactions.map((tx) => (
          <View key={tx.id} className="bg-white rounded-xl p-4 shadow-sm mb-3 flex-row justify-between items-center">
            <View className="flex-1 pr-3">
              <Text className="font-bold text-slate-800">{tx.description || '—'}</Text>
              <Text className="text-slate-500 text-sm">
                {tx.transaction_date}
                {tx.category ? ` · ${tx.category}` : ''}
                {tx.reference ? ` · ${tx.reference}` : ''}
              </Text>
            </View>
            <View className="items-end">
              <Text className={`font-bold ${tx.type === 'payment' ? 'text-green-600' : 'text-red-600'}`}>
                {tx.type === 'payment' ? '+' : '−'}{fmtMoney(tx.amount)}
              </Text>
              <TouchableOpacity onPress={() => handleDelete(tx.id)} className="mt-1">
                <Trash2 size={16} color="#dc2626" />
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      {loading && transactions.length > 0 && (
        <View className="py-4 items-center">
          <ActivityIndicator size="small" color="#2563eb" />
          <Text className="text-slate-400 text-xs mt-1">Refreshing...</Text>
        </View>
      )}
    </ScrollView>
  );
}
