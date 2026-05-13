import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Alert,
  ActivityIndicator, Platform,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Plus, Trash2, Save, Camera, ChevronDown, ChevronUp, Search } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  getTransactions, createTransaction, updateTransaction, deleteTransaction, uploadReceipt,
} from '../../services/api';
import { Transaction } from '../../types';
import DateRangePicker from '../../components/DateRangePicker';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';

export default function LedgerScreen() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'All' | 'Income' | 'Expense'>('All');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [form, setForm] = useState<Partial<Transaction>>({
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: 0,
    type: 'Expense',
    category: '',
    referenceId: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTransactions({
        type: typeFilter === 'All' ? undefined : typeFilter,
        category: categoryFilter || undefined,
        startDate: dateRange.startDate || undefined,
        endDate: dateRange.endDate || undefined,
      });
      setTransactions(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
  }, [typeFilter, categoryFilter, dateRange]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const runningBalance = useMemo(() => {
    let bal = 0;
    const copy = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    copy.forEach((t) => {
      bal += t.type === 'Income' ? t.amount : -t.amount;
    });
    return bal;
  }, [transactions]);

  const income = useMemo(() => transactions.filter(t => t.type === 'Income').reduce((s, t) => s + t.amount, 0), [transactions]);
  const expense = useMemo(() => transactions.filter(t => t.type === 'Expense').reduce((s, t) => s + t.amount, 0), [transactions]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach(t => { if (t.category) set.add(t.category); });
    return Array.from(set);
  }, [transactions]);

  function openNew() {
    setForm({
      date: new Date().toISOString().split('T')[0],
      description: '',
      amount: 0,
      type: 'Expense',
      category: '',
      referenceId: '',
    });
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(tx: Transaction) {
    setForm({ ...tx });
    setEditingId(tx.id);
    setShowForm(true);
  }

  async function saveTx() {
    if (!form.description) {
      Alert.alert('Error', 'Description is required');
      return;
    }
    const payload: Partial<Transaction> = {
      ...form,
      amount: Number(form.amount) || 0,
      type: form.type || 'Expense',
      date: form.date || new Date().toISOString().split('T')[0],
    };
    try {
      if (editingId) {
        await updateTransaction(editingId, payload);
      } else {
        await createTransaction(payload);
      }
      setShowForm(false);
      setEditingId(null);
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
          try {
            await deleteTransaction(id);
            load();
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to delete');
          }
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
    const asset = result.assets[0];
    const b64 = asset.base64 || '';
    if (!b64) {
      Alert.alert('Error', 'Could not read image as base64');
      return;
    }
    setUploadingReceipt(true);
    try {
      const res = await uploadReceipt(b64);
      if (res.error) {
        Alert.alert('Upload failed', res.error);
      } else {
        setForm(prev => ({
          ...prev,
          description: res.rawText ? `Receipt: ${res.rawText.slice(0, 80)}` : prev.description,
        }));
        Alert.alert('Uploaded', 'Receipt processed.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Upload failed');
    } finally {
      setUploadingReceipt(false);
    }
  }

  if (loading && transactions.length === 0) {
    return <LoadingSpinner message="Loading ledger..." />;
  }

  return (
    <ScrollView className="flex-1 bg-slate-50 p-4">
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-2xl font-bold text-slate-800">Ledger</Text>
        <TouchableOpacity onPress={openNew} className="bg-blue-600 rounded-lg p-2">
          <Plus size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <View className="bg-white rounded-xl p-4 shadow-sm mb-4">
        <Text className="text-slate-500 text-sm">Running Balance</Text>
        <Text className={`text-2xl font-bold ${runningBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          ${runningBalance.toFixed(2)}
        </Text>
        <View className="flex-row justify-between mt-3">
          <View><Text className="text-slate-500 text-sm">Income</Text><Text className="text-green-600 font-bold text-lg">${income.toFixed(2)}</Text></View>
          <View><Text className="text-slate-500 text-sm">Expenses</Text><Text className="text-red-600 font-bold text-lg">${expense.toFixed(2)}</Text></View>
          <View><Text className="text-slate-500 text-sm">Net</Text><Text className="font-bold text-lg text-slate-800">${(income - expense).toFixed(2)}</Text></View>
        </View>
      </View>

      <View className="bg-white rounded-xl p-4 shadow-sm mb-3">
        <Text className="font-bold text-slate-800 mb-2">Filters</Text>
        <View className="flex-row mb-2">
          {(['All', 'Income', 'Expense'] as const).map(t => (
            <TouchableOpacity key={t} onPress={() => setTypeFilter(t)} className={`flex-1 rounded-lg py-2 items-center mr-1 ${typeFilter === t ? 'bg-blue-600' : 'bg-slate-100'}`}>
              <Text className={`text-sm font-medium ${typeFilter === t ? 'text-white' : 'text-slate-700'}`}>{t}</Text>
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
        <DateRangePicker startDate={dateRange.startDate} endDate={dateRange.endDate} onChange={setDateRange} />
        <TouchableOpacity onPress={load} className="bg-blue-600 rounded-lg py-2 items-center">
          <Text className="text-white font-medium">Apply Filters</Text>
        </TouchableOpacity>
      </View>

      {categories.length > 0 && (
        <View className="bg-white rounded-xl p-4 shadow-sm mb-3">
          <Text className="font-bold text-slate-800 mb-2">Expense Categories</Text>
          <View className="flex-row flex-wrap gap-2">
            {categories.map(c => (
              <TouchableOpacity key={c} onPress={() => { setCategoryFilter(c); load(); }} className="bg-slate-100 rounded-full px-3 py-1">
                <Text className="text-xs text-slate-700">{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {showForm && (
        <View className="bg-white rounded-xl p-4 shadow-sm mb-3">
          <Text className="font-bold text-slate-800 mb-2">{editingId ? 'Edit Transaction' : 'Add Transaction'}</Text>
          <TextInput placeholder="Date (YYYY-MM-DD)" value={form.date} onChangeText={t => setForm(f => ({ ...f, date: t }))} className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" />
          <TextInput placeholder="Description" value={form.description} onChangeText={t => setForm(f => ({ ...f, description: t }))} className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" />
          <View className="flex-row gap-2 mb-2">
            <TextInput placeholder="Amount" value={String(form.amount ?? '')} onChangeText={t => setForm(f => ({ ...f, amount: parseFloat(t) || 0 }))} keyboardType="numeric" className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-slate-800" />
            <TouchableOpacity onPress={() => setForm(f => ({ ...f, type: f.type === 'Income' ? 'Expense' : 'Income' }))} className="px-3 py-2 bg-slate-100 rounded-lg justify-center items-center">
              <Text className="font-medium text-slate-800">{form.type}</Text>
            </TouchableOpacity>
          </View>
          <TextInput placeholder="Category" value={form.category} onChangeText={t => setForm(f => ({ ...f, category: t }))} className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" />
          <TextInput placeholder="Reference ID" value={form.referenceId} onChangeText={t => setForm(f => ({ ...f, referenceId: t }))} className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" />
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
        transactions.map(tx => (
          <TouchableOpacity key={tx.id} onPress={() => openEdit(tx)} activeOpacity={0.8}>
            <View className="bg-white rounded-xl p-4 shadow-sm mb-3 flex-row justify-between items-center">
              <View className="flex-1 pr-3">
                <Text className="font-bold text-slate-800">{tx.description}</Text>
                <Text className="text-slate-500 text-sm">{tx.date} {tx.category ? `· ${tx.category}` : ''} {tx.referenceId ? `· Ref: ${tx.referenceId}` : ''}</Text>
              </View>
              <View className="items-end">
                <Text className={`font-bold ${tx.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}>{tx.type === 'Income' ? '+' : '-'}${tx.amount.toFixed(2)}</Text>
                <TouchableOpacity onPress={() => handleDelete(tx.id)} className="mt-1"><Trash2 size={16} color="#dc2626" /></TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        ))
      )}

      {loading && transactions.length > 0 && (
        <View className="py-4 items-center"><ActivityIndicator size="small" color="#2563eb" /><Text className="text-slate-400 text-xs mt-1">Refreshing...</Text></View>
      )}
    </ScrollView>
  );
}
