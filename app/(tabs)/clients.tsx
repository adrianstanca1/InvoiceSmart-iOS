import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Plus, Trash2, Save, Users } from 'lucide-react-native';
import * as Storage from '../../lib/storage';
import { Client } from '../../types';

export default function ClientsScreen() {
  const [clients, setClients] = useState<Client[]>([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Client>({ id: '', name: '', email: '', phone: '', address: '' });

  useFocusEffect(useCallback(() => { load(); }, []));
  async function load() { const c = await Storage.getClients(); setClients(c); }

  async function saveClient() {
    if (!form.name) { Alert.alert('Error', 'Name required'); return; }
    const list = await Storage.getClients();
    const idx = list.findIndex(c => c.id === form.id);
    if (idx >= 0) list[idx] = form; else list.push({ ...form, id: Date.now().toString(36) });
    await Storage.saveClients(list);
    await Storage.logAction('Created', 'Client', form.id, form.name, 'Saved from mobile');
    setEditing(false); setForm({ id: '', name: '', email: '', phone: '', address: '' }); load();
  }

  async function deleteClient(id: string) {
    const list = (await Storage.getClients()).filter(c => c.id !== id);
    await Storage.saveClients(list); load();
  }

  return (
    <ScrollView className="flex-1 bg-slate-50 p-4">
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-2xl font-bold text-slate-800">Clients</Text>
        <TouchableOpacity onPress={() => { setForm({ id: '', name: '', email: '', phone: '', address: '' }); setEditing(true); }} className="bg-blue-600 rounded-lg p-2">
          <Plus size={20} color="#fff" />
        </TouchableOpacity>
      </View>
      {editing && (
        <View className="bg-white rounded-xl p-4 shadow-sm mb-3">
          <TextInput placeholder="Name" value={form.name} onChangeText={t => setForm({ ...form, name: t })} className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" />
          <TextInput placeholder="Email" value={form.email} onChangeText={t => setForm({ ...form, email: t })} className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" keyboardType="email-address" />
          <TextInput placeholder="Phone" value={form.phone} onChangeText={t => setForm({ ...form, phone: t })} className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" />
          <TextInput placeholder="Address" value={form.address} onChangeText={t => setForm({ ...form, address: t })} multiline className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800 h-16" />
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
      {clients.length === 0 && <Text className="text-slate-400 text-center mt-8">No clients yet. Add one above.</Text>}
      {clients.map(c => (
        <View key={c.id} className="bg-white rounded-xl p-4 shadow-sm mb-3 flex-row justify-between items-center">
          <View>
            <Text className="font-bold text-slate-800">{c.name}</Text>
            <Text className="text-slate-500 text-sm">{c.email || c.phone}</Text>
          </View>
          <View className="flex-row gap-2">
            <TouchableOpacity onPress={() => { setForm(c); setEditing(true); }} className="p-2"><Text className="text-blue-600">Edit</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => deleteClient(c.id)} className="p-2"><Trash2 size={18} color="#dc2626" /></TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
