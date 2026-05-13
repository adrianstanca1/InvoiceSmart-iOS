import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Switch, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Save, LogOut } from 'lucide-react-native';
import * as api from '../../services/api';
import type { AppSettings, AiProvider } from '../../types';

const DEFAULT_SETTINGS: AppSettings = {
  aiProvider: 'ollama',
  aiModel: 'llama3',
  aiEndpoint: '',
  invoicePrefix: 'INV-',
  autoIncrement: true,
  defaultCurrency: 'GBP',
  defaultTaxRate: 20,
  defaultTerms: 'Payment due within 30 days.',
  defaultPaymentGateway: 'none',
  theme: 'system',
  notificationsEnabled: true,
  emailNotifications: false,
};

const PROVIDERS: AiProvider[] = ['ollama', 'openai', 'openai-compatible', 'openrouter'];

export default function SettingsScreen() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [apiKey, setApiKey] = useState(''); // never pre-populated — backend masks it

  const load = useCallback(async () => {
    try {
      const s = await api.getSettings();
      setSettings({ ...DEFAULT_SETTINGS, ...s });
    } catch {
      // keep defaults
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function save() {
    setSaving(true);
    try {
      // Strip masked key + only include apiKey if the user typed a fresh one.
      const { aiApiKey: _ignored, ...rest } = settings;
      const payload: Partial<AppSettings> = { ...rest };
      if (apiKey.trim()) payload.aiApiKey = apiKey.trim();
      await api.updateSettings(payload);
      setApiKey('');
      Alert.alert('Saved', 'Settings updated.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    Alert.alert('Sign out?', 'You will need to log in again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => api.logout() },
    ]);
  }

  return (
    <ScrollView className="flex-1 bg-slate-50 p-4">
      <Text className="text-2xl font-bold text-slate-800 mb-3">Settings</Text>

      <View className="bg-white rounded-xl p-4 shadow-sm mb-3">
        <Text className="font-bold text-slate-800 mb-2">AI Configuration</Text>

        <Text className="text-xs text-slate-500 mb-1">Provider</Text>
        <View className="flex-row flex-wrap gap-2 mb-3">
          {PROVIDERS.map((p) => (
            <TouchableOpacity
              key={p}
              onPress={() => setSettings((s) => ({ ...s, aiProvider: p }))}
              className={`rounded-full px-3 py-1 border ${settings.aiProvider === p ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-200'}`}
            >
              <Text className={`text-xs ${settings.aiProvider === p ? 'text-white' : 'text-slate-700'}`}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text className="text-xs text-slate-500 mb-1">Model</Text>
        <TextInput
          value={settings.aiModel}
          onChangeText={(t) => setSettings((s) => ({ ...s, aiModel: t }))}
          autoCapitalize="none"
          className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800"
        />

        <Text className="text-xs text-slate-500 mb-1">Endpoint (optional)</Text>
        <TextInput
          value={settings.aiEndpoint}
          onChangeText={(t) => setSettings((s) => ({ ...s, aiEndpoint: t }))}
          placeholder="https://api.openai.com/v1/chat/completions"
          autoCapitalize="none"
          className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800"
        />

        <Text className="text-xs text-slate-500 mb-1">API key</Text>
        <TextInput
          value={apiKey}
          onChangeText={setApiKey}
          placeholder={settings.aiApiKey ? '••••••••  (set; type to replace)' : 'sk-...'}
          autoCapitalize="none"
          secureTextEntry
          className="border border-slate-200 rounded-lg px-3 py-2 text-slate-800"
        />
        <Text className="text-slate-400 text-xs mt-1">
          Leave blank to keep the current key. Only the configured hosts are allowed (SSRF defence).
        </Text>
      </View>

      <View className="bg-white rounded-xl p-4 shadow-sm mb-3">
        <Text className="font-bold text-slate-800 mb-2">Invoices</Text>
        <Text className="text-xs text-slate-500 mb-1">Prefix</Text>
        <TextInput
          value={settings.invoicePrefix}
          onChangeText={(t) => setSettings((s) => ({ ...s, invoicePrefix: t }))}
          className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800"
        />
        <View className="flex-row items-center mt-2">
          <Switch
            value={settings.autoIncrement}
            onValueChange={(v) => setSettings((s) => ({ ...s, autoIncrement: v }))}
          />
          <Text className="ml-2 text-slate-700">Auto-increment invoice numbers</Text>
        </View>
        <Text className="text-xs text-slate-500 mt-3 mb-1">Default currency</Text>
        <TextInput
          value={settings.defaultCurrency}
          onChangeText={(t) => setSettings((s) => ({ ...s, defaultCurrency: t.toUpperCase() }))}
          autoCapitalize="characters"
          maxLength={3}
          className="border border-slate-200 rounded-lg px-3 py-2 text-slate-800"
        />
      </View>

      <TouchableOpacity onPress={save} disabled={saving} className="bg-blue-600 rounded-lg p-3 items-center flex-row justify-center gap-2 mb-3">
        <Save size={16} color="#fff" />
        <Text className="text-white font-medium">{saving ? 'Saving...' : 'Save Settings'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={signOut} className="bg-red-600 rounded-lg p-3 items-center flex-row justify-center gap-2">
        <LogOut size={16} color="#fff" />
        <Text className="text-white font-medium">Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
