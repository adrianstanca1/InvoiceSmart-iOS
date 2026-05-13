import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Plus, Trash2, Save } from 'lucide-react-native';
import * as api from '../../services/api';
import type { Client, ClientInput } from '../../types';

interface FormState {
  id: string;        // empty string when creating
  name: string;
  email: string;
  phone: string;
  address: string;   // free-text — stored as { line1: string } JSON on save
}

const EMPTY_FORM: FormState = { id: '', name: '', email: '', phone: '', address: '' };

export default function ClientsScreen() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.getClients();
      setClients(result.data || []);
    } catch {
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function saveClient() {
    if (!form.name) { Alert.alert('Error', 'Name required'); return; }
    const payload: ClientInput = {
      name: form.name,
      email: form.email || null,
      phone: form.phone || null,
      address: form.address ? { line1: form.address } : null,
    };
    try {
      if (form.id) {
        await api.updateClient(form.id, payload);
      } else {
        await api.createClient(payload);
      }
      setEditing(false);
      setForm(EMPTY_FORM);
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save client');
    }
  }

  async function deleteClient(id: string) {
    Alert.alert('Delete client?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try { await api.deleteClient(id); load(); }
          catch (e: any) { Alert.alert('Error', e.message || 'Failed to delete'); }
        },
      },
    ]);
  }

  function startEdit(c: Client) {
    setForm({
      id: c.id,
      name: c.name,
      email: c.email || '',
      phone: c.phone || '',
      address: typeof c.address === 'object' && c.address && 'line1' in c.address
        ? String((c.address as any).line1 ?? '')
        : '',
    });
    setEditing(true);
  }

  return (
    <ScrollView className="flex-1 bg-slate-50 p-4">
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-2xl font-bold text-slate-800">Clients</Text>
        <TouchableOpacity
          onPress={() => { setForm(EMPTY_FORM); setEditing(true); }}
          className="bg-blue-600 rounded-lg p-2"
        >
          <Plus size={20} color="#fff" />
        </TouchableOpacity>
      </View>
      {editing && (
        <View className="bg-white rounded-xl p-4 shadow-sm mb-3">
          <TextInput placeholder="Name" value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" />
          <TextInput placeholder="Email" value={form.email} onChangeText={(t) => setForm({ ...form, email: t })} className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" keyboardType="email-address" autoCapitalize="none" />
          <TextInput placeholder="Phone" value={form.phone} onChangeText={(t) => setForm({ ...form, phone: t })} className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" keyboardType="phone-pad" />
          <TextInput placeholder="Address" value={form.address} onChangeText={(t) => setForm({ ...form, address: t })} multiline className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800 h-16" />
          <View className="flex-row gap-2 mt-2">
            <TouchableOpacity onPress={saveClient} className="flex-1 bg-blue-600 rounded-lg p-3 items-center flex-row justify-center gap-2">
              <Save size={16} color="#fff" /><Text className="text-white font-medium">Save</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setEditing(false)} className="flex-1 bg-slate-200 rounded-lg p-3 items-center">
              <Text className="text-slate-700 font-medium">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {clients.length === 0 && !loading && (
        <Text className="text-slate-400 text-center mt-8">No clients yet. Add one above.</Text>
      )}
      {clients.map((c) => (
        <View key={c.id} className="bg-white rounded-xl p-4 shadow-sm mb-3 flex-row justify-between items-center">
          <View className="flex-1 pr-3">
            <Text className="font-bold text-slate-800">{c.name}</Text>
            <Text className="text-slate-500 text-sm">{c.email || c.phone || '—'}</Text>
          </View>
          <View className="flex-row gap-2">
            <TouchableOpacity onPress={() => startEdit(c)} className="p-2">
              <Text className="text-blue-600">Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => deleteClient(c.id)} className="p-2">
              <Trash2 size={18} color="#dc2626" />
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
