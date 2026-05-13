import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Plus, Trash2, Save, Check, ChevronDown, ChevronUp } from 'lucide-react-native';
import {
  getTaxRules, createTaxRule, updateTaxRule, deleteTaxRule, getInvoices,
} from '../../services/api';
import { TaxRule, Invoice } from '../../types';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { EmptyState } from '../../components/EmptyState';

export default function TaxManagerScreen() {
  const [rules, setRules] = useState<TaxRule[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<TaxRule>>({ name: '', rate: 20, description: '' });
  const [isDefault, setIsDefault] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [r, inv] = await Promise.all([getTaxRules(), getInvoices()]);
      setRules(r);
      setInvoices(inv);
    } catch (e: any) {
      setError(e.message || 'Failed to load tax rules');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function openNew() {
    setForm({ name: '', rate: 20, description: '' });
    setIsDefault(false);
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(rule: TaxRule) {
    setForm({ ...rule });
    setIsDefault(false);
    setEditingId(rule.id);
    setShowForm(true);
  }

  async function saveRule() {
    if (!form.name) { Alert.alert('Error', 'Name is required'); return; }
    setSaving(true);
    try {
      if (editingId) {
        await updateTaxRule(editingId, { ...form, isDefault });
      } else {
        await createTaxRule({ name: form.name, rate: Number(form.rate) || 0, description: form.description || '' });
      }
      setShowForm(false);
      setEditingId(null);
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save tax rule');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    Alert.alert('Delete tax rule?', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try { await deleteTaxRule(id); load(); }
          catch (e: any) { Alert.alert('Error', e.message || 'Failed to delete'); }
        },
      },
    ]);
  }

  const invoicesForRule = (ruleId?: string) => {
    if (!ruleId) return [];
    return invoices.filter(inv => (inv as any).taxRuleId === ruleId || inv.taxRate === rules.find(r => r.id === ruleId)?.rate);
  };

  if (loading && rules.length === 0) return <LoadingSpinner message="Loading tax rules..." />;

  return (
    <ScrollView className="flex-1 bg-slate-50 p-4">
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-2xl font-bold text-slate-800">Tax Rules</Text>
        <TouchableOpacity onPress={openNew} className="bg-blue-600 rounded-lg p-2"><Plus size={20} color="#fff" /></TouchableOpacity>
      </View>

      {error ? <Text className="text-red-600 mb-3">{error}</Text> : null}

      {showForm && (
        <View className="bg-white rounded-xl p-4 shadow-sm mb-3">
          <Text className="font-bold text-slate-800 mb-2">{editingId ? 'Edit Tax Rule' : 'Add Tax Rule'}</Text>
          <TextInput placeholder="Name" value={form.name} onChangeText={t => setForm(f => ({ ...f, name: t }))} className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" />
          <TextInput placeholder="Rate %" value={String(form.rate ?? '')} onChangeText={t => setForm(f => ({ ...f, rate: parseFloat(t) || 0 }))} keyboardType="numeric" className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" />
          <TextInput placeholder="Description" value={form.description} onChangeText={t => setForm(f => ({ ...f, description: t }))} className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" />
          <View className="flex-row items-center mb-3">
            <TouchableOpacity onPress={() => setIsDefault(v => !v)} className="flex-row items-center">
              <View className={`w-5 h-5 rounded border mr-2 items-center justify-center ${isDefault ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                {isDefault && <Check size={14} color="#fff" />}
              </View>
              <Text className="text-slate-700">Default rate</Text>
            </TouchableOpacity>
          </View>
          <View className="flex-row gap-2">
            <TouchableOpacity onPress={saveRule} disabled={saving} className="flex-1 bg-blue-600 rounded-lg p-3 items-center flex-row justify-center">
              <Save size={16} color="#fff" /><Text className="text-white font-medium ml-2">{saving ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowForm(false)} className="flex-1 bg-slate-200 rounded-lg p-3 items-center"><Text className="text-slate-700">Cancel</Text></TouchableOpacity>
          </View>
        </View>
      )}

      {rules.length === 0 && !loading ? <EmptyState message="No tax rules yet." /> : null}

      {rules.map(rule => {
        const invs = invoicesForRule(rule.id);
        const expanded = expandedId === rule.id;
        return (
          <View key={rule.id} className="bg-white rounded-xl p-4 shadow-sm mb-3">
            <View className="flex-row justify-between items-center">
              <View className="flex-1 pr-2">
                <Text className="font-bold text-slate-800">{rule.name}</Text>
                <Text className="text-slate-500 text-sm">{rule.rate}% — {rule.description}</Text>
              </View>
              <View className="flex-row items-center gap-3">
                {rule.id === '1' && <Text className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">Default</Text>}
                {invs.length > 0 && (
                  <TouchableOpacity onPress={() => setExpandedId(expanded ? null : rule.id)} className="flex-row items-center">
                    <Text className="text-xs text-slate-500 mr-1">{invs.length} invoices</Text>
                    {expanded ? <ChevronUp size={14} color="#64748b" /> : <ChevronDown size={14} color="#64748b" />}
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => openEdit(rule)}><Text className="text-blue-600 text-sm">Edit</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(rule.id)}><Trash2 size={16} color="#dc2626" /></TouchableOpacity>
              </View>
            </View>
            {expanded && invs.length > 0 && (
              <View className="mt-3 border-t border-slate-100 pt-2">
                <Text className="text-xs font-medium text-slate-500 mb-1">Applied to invoices:</Text>
                {invs.map(inv => (
                  <Text key={inv.id} className="text-slate-700 text-sm">#{inv.invoiceNumber} — {inv.toName}</Text>
                ))}
              </View>
            )}
          </View>
        );
      })}

      {loading && <View className="py-4 items-center"><ActivityIndicator size="small" color="#2563eb" /><Text className="text-slate-400 text-xs mt-1">Refreshing...</Text></View>}
    </ScrollView>
  );
}
