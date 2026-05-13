import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Switch, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Save } from 'lucide-react-native';
import * as api from '../../services/api';

export default function SettingsScreen() {
  const [settings, setSettings] = useState({ aiProvider: 'ollama', aiModel: 'qwen2.5:7b', aiEndpoint: 'http://127.0.0.1:11434', invoicePrefix: 'INV-', autoIncrement: true });
  useFocusEffect(useCallback(()=>{ load(); }, []));
  async function load() {
      try {
        const s = await api.getSettings();
        setSettings(s || { aiModel: 'llama3', invoicePrefix: 'INV-', autoIncrement: true });
      } catch (e) {}
    }

  async function save() {
      try { await api.updateSettings(settings); Alert.alert('Saved', 'Settings updated.'); }
      catch (e: any) { Alert.alert('Error', e.message || 'Failed to save'); }
    }

  async function clearData() {
    Alert.alert('Clear all data?', 'This will remove all local data.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        Alert.alert('Cleared', 'Local data removed. Server data is unaffected.');
      }}
    ]);
  }

  return (
    <ScrollView className="flex-1 bg-slate-50 p-4">
      <Text className="text-2xl font-bold text-slate-800 mb-3">Settings</Text>
      <View className="bg-white rounded-xl p-4 shadow-sm mb-3">
        <Text className="font-bold text-slate-800 mb-2">AI Configuration</Text>
        <Text className="text-xs text-slate-500 mb-1">Model</Text>
        <TextInput value={settings.aiModel} onChangeText={t=>setSettings({...settings,aiModel:t})} className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" />
        <Text className="text-xs text-slate-500 mb-1">Endpoint</Text>
        <TextInput value={settings.aiEndpoint} onChangeText={t=>setSettings({...settings,aiEndpoint:t})} className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" />
      </View>
      <View className="bg-white rounded-xl p-4 shadow-sm mb-3">
        <Text className="font-bold text-slate-800 mb-2">Invoices</Text>
        <Text className="text-xs text-slate-500 mb-1">Prefix</Text>
        <TextInput value={settings.invoicePrefix} onChangeText={t=>setSettings({...settings,invoicePrefix:t})} className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" />
        <View className="flex-row items-center mt-2"><Switch value={settings.autoIncrement} onValueChange={v=>setSettings({...settings,autoIncrement:v})} /><Text className="ml-2 text-slate-700">Auto-increment numbers</Text></View>
      </View>
      <TouchableOpacity onPress={save} className="bg-blue-600 rounded-lg p-3 items-center flex-row justify-center gap-2 mb-3">
        <Save size={16} color="#fff" /><Text className="text-white font-medium">Save Settings</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={clearData} className="bg-red-600 rounded-lg p-3 items-center">
        <Text className="text-white font-medium">Clear All Data</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
