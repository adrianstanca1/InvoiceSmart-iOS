import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Plus, Trash2, Save, Check } from 'lucide-react-native';
import {
  getTaxRules, createTaxRule, updateTaxRule, deleteTaxRule,
} from '../../services/api';
import type { TaxRule, TaxRuleInput } from '../../types';
import { EmptyState } from '../../components/EmptyState';
import { fmtPercent, toNum } from '../../lib/format';

interface FormState {
  id: string;
  name: string;
  rate: string;     // text input for the percent
  type: string;
  country: string;
  is_default: boolean;
}

const EMPTY_FORM: FormState = {
  id: '', name: '', rate: '20', type: 'vat', country: 'GB', is_default: false,
};

export default function TaxManagerScreen() {
  const [rules, setRules] = useState<TaxRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await getTaxRules();
      setRules(r.data || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load tax rules');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function openNew() {
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(rule: TaxRule) {
    setForm({
      id: rule.id,
      name: rule.name,
      rate: rule.rate,
      type: rule.type || 'vat',
      country: rule.country || 'GB',
      is_default: rule.is_default,
    });
    setShowForm(true);
  }

  async function saveRule() {
    if (!form.name) { Alert.alert('Error', 'Name is required'); return; }
    const rate = parseFloat(form.rate);
    if (!Number.isFinite(rate) || rate < 0) { Alert.alert('Error', 'Rate must be a non-negative number'); return; }
    setSaving(true);
    const payload: TaxRuleInput = {
      name: form.name,
      rate,
      type: form.type || 'vat',
      country: form.country || null,
      is_default: form.is_default,
    };
    try {
      if (form.id) {
        await updateTaxRule(form.id, payload);
      } else {
        await createTaxRule(payload);
      }
      setShowForm(false);
      setForm(EMPTY_FORM);
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

  if (loading && rules.length === 0) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#2563eb" />
        <Text className="text-slate-400 mt-3">Loading tax rules...</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-slate-50 p-4">
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-2xl font-bold text-slate-800">Tax Rules</Text>
        <TouchableOpacity onPress={openNew} className="bg-blue-600 rounded-lg p-2"><Plus size={20} color="#fff" /></TouchableOpacity>
      </View>

      {error ? <Text className="text-red-600 mb-3">{error}</Text> : null}

      {showForm && (
        <View className="bg-white rounded-xl p-4 shadow-sm mb-3">
          <Text className="font-bold text-slate-800 mb-2">{form.id ? 'Edit Tax Rule' : 'Add Tax Rule'}</Text>
          <TextInput placeholder="Name" value={form.name} onChangeText={(t) => setForm((f) => ({ ...f, name: t }))} className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" />
          <TextInput placeholder="Rate %" value={form.rate} onChangeText={(t) => setForm((f) => ({ ...f, rate: t }))} keyboardType="numeric" className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" />
          <TextInput placeholder="Type (vat, sales, withholding...)" value={form.type} onChangeText={(t) => setForm((f) => ({ ...f, type: t }))} className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" autoCapitalize="none" />
          <TextInput placeholder="Country (e.g. GB)" value={form.country} onChangeText={(t) => setForm((f) => ({ ...f, country: t.toUpperCase() }))} className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" autoCapitalize="characters" maxLength={2} />
          <View className="flex-row items-center mb-3">
            <TouchableOpacity onPress={() => setForm((f) => ({ ...f, is_default: !f.is_default }))} className="flex-row items-center">
              <View className={`w-5 h-5 rounded border mr-2 items-center justify-center ${form.is_default ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                {form.is_default && <Check size={14} color="#fff" />}
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

      {rules.map((rule) => (
        <View key={rule.id} className="bg-white rounded-xl p-4 shadow-sm mb-3">
          <View className="flex-row justify-between items-center">
            <View className="flex-1 pr-2">
              <Text className="font-bold text-slate-800">{rule.name}</Text>
              <Text className="text-slate-500 text-sm">
                {fmtPercent(rule.rate)}
                {rule.type ? ` · ${rule.type}` : ''}
                {rule.country ? ` · ${rule.country}` : ''}
              </Text>
            </View>
            <View className="flex-row items-center gap-3">
              {rule.is_default && (
                <Text className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">Default</Text>
              )}
              <TouchableOpacity onPress={() => openEdit(rule)}><Text className="text-blue-600 text-sm">Edit</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(rule.id)}><Trash2 size={16} color="#dc2626" /></TouchableOpacity>
            </View>
          </View>
        </View>
      ))}

      {loading && rules.length > 0 && (
        <View className="py-4 items-center"><ActivityIndicator size="small" color="#2563eb" /><Text className="text-slate-400 text-xs mt-1">Refreshing...</Text></View>
      )}
    </ScrollView>
  );
}
