import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, TextInput } from 'react-native';
import { ChevronDown, X } from 'lucide-react-native';
import { Client } from '../types';
import * as api from '../services/api';

export function ClientPicker({
  selectedId,
  onSelect,
}: {
  selectedId?: string;
  onSelect: (client: Client) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (visible) {
      setLoading(true);
      api.getClients().then(setClients).finally(() => setLoading(false));
    }
  }, [visible]);

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(query.toLowerCase()) ||
    c.email.toLowerCase().includes(query.toLowerCase())
  );

  const selected = clients.find(c => c.id === selectedId);

  return (
    <View>
      <TouchableOpacity onPress={() => setVisible(true)} className="border border-slate-200 rounded-lg px-3 py-2.5 flex-row justify-between items-center bg-white">
        <Text className={`text-sm ${selected ? 'text-slate-800 font-medium' : 'text-slate-400'}`}>{selected ? selected.name : 'Select client...'}</Text>
        <ChevronDown size={16} color="#64748b" />
      </TouchableOpacity>
      <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-xl h-[70%] p-4">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-lg font-bold text-slate-800">Select Client</Text>
              <TouchableOpacity onPress={() => setVisible(false)}><X size={20} color="#334155" /></TouchableOpacity>
            </View>
            <TextInput value={query} onChangeText={setQuery} placeholder="Search clients..." className="border border-slate-200 rounded-lg px-3 py-2 mb-3 text-slate-800" />
            <FlatList
              data={filtered}
              keyExtractor={item => item.id}
              ListEmptyComponent={<Text className="text-slate-400 text-center mt-8">{loading ? 'Loading...' : 'No clients found'}</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => { onSelect(item); setVisible(false); setQuery(''); }} className="py-3 border-b border-slate-100">
                  <Text className="text-slate-800 font-medium">{item.name}</Text>
                  <Text className="text-slate-500 text-xs">{item.email}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
