import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Plus, Trash2, Save } from 'lucide-react-native';
import * as Storage from '../../lib/storage';
import { TaxRule } from '../../types';

export default function TaxManagerScreen() {
  const [rules, setRules] = useState<TaxRule[]>([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<TaxRule>({ id: '', name: '', rate: 20, description: '' });

  useFocusEffect(useCallback(() => { load(); }, []));
  async function load() { const r = await Storage.getTaxRules(); setRules(r); }

  async function saveRule() {
    const list = await Storage.getTaxRules();
    const idx = list.findIndex(r => r.id === form.id);
    if (idx >= 0) list[idx] = form; else list.push({ ...form, id: Date.now().toString(36) });
    await Storage.saveTaxRules(list); setEditing(false); setForm({ id:'', name:'', rate:20, description:'' }); load();
  }

  return (
    <ScrollView className="flex-1 bg-slate-50 p-4">
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-2xl font-bold text-slate-800">Tax Rules</Text>
        <TouchableOpacity onPress={() => { setForm({ id:'', name:'', rate:20, description:'' }); setEditing(true); }} className="bg-blue-600 rounded-lg p-2">
          <Plus size={20} color="#fff" />
        </TouchableOpacity>
      </View>
      {editing && (
        <View className="bg-white rounded-xl p-4 shadow-sm mb-3">
          <TextInput placeholder="Name" value={form.name} onChangeText={t => setForm({...form, name:t})} className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" />
          <TextInput placeholder="Rate %" value={String(form.rate)} onChangeText={t => setForm({...form, rate:parseFloat(t)||0})} keyboardType="numeric" className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" />
          <TextInput placeholder="Description" value={form.description} onChangeText={t => setForm({...form, description:t})} className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" />
          <View className="flex-row gap-2">
            <TouchableOpacity onPress={saveRule} className="flex-1 bg-blue-600 rounded-lg p-3 items-center"><Text className="text-white font-medium">Save</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setEditing(false)} className="flex-1 bg-slate-200 rounded-lg p-3 items-center"><Text className="text-slate-700">Cancel</Text></TouchableOpacity>
          </View>
        </View>
      )}
      {rules.map(r => (
        <View key={r.id} className="bg-white rounded-xl p-4 shadow-sm mb-3 flex-row justify-between items-center">
          <View>
            <Text className="font-bold text-slate-800">{r.name}</Text>
            <Text className="text-slate-500 text-sm">{r.rate}% — {r.description}</Text>
          </View>
          <View className="flex-row gap-2">
            <TouchableOpacity onPress={() => { setForm(r); setEditing(true); }} className="p-2"><Text className="text-blue-600">Edit</Text></TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
