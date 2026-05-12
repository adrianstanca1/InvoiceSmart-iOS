import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Trash2, FileText, Search } from 'lucide-react-native';
import * as Storage from '../../lib/storage';
import { Invoice } from '../../types';

export default function HistoryScreen() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filter, setFilter] = useState<string>('All');
  const [search, setSearch] = useState('');

  useFocusEffect(useCallback(() => { load(); }, []));
  async function load() { const invs = await Storage.getInvoices(); setInvoices(invs); }

  async function deleteInvoice(id: string) {
    const invs = (await Storage.getInvoices()).filter(i => i.id !== id);
    await Storage.saveInvoices(invs); load();
  }

  const filtered = invoices
    .filter(inv => filter === 'All' || inv.status === filter)
    .filter(inv => (inv.toName || '').toLowerCase().includes(search.toLowerCase()) || inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const statusColor: any = { Draft: 'text-slate-500', Sent: 'text-blue-600', Paid: 'text-green-600', Overdue: 'text-red-600' };

  return (
    <ScrollView className="flex-1 bg-slate-50 p-4">
      <Text className="text-2xl font-bold text-slate-800 mb-3">Invoice History</Text>
      <View className="flex-row gap-2 mb-3">
        <TextInput value={search} onChangeText={setSearch} placeholder="Search..." className="flex-1 border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-800" />
      </View>
      <ScrollView horizontal className="mb-3">
        {['All','Draft','Sent','Paid','Overdue'].map(s => (
          <TouchableOpacity key={s} onPress={() => setFilter(s)} className={`px-3 py-1.5 rounded-full mr-2 ${filter===s ? 'bg-blue-600' : 'bg-white border border-slate-200'}`}>
            <Text className={filter===s ? 'text-white font-medium' : 'text-slate-700'}>{s}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {filtered.map(inv => (
        <TouchableOpacity key={inv.id} onPress={() => router.push({ pathname: '/create', params: { id: inv.id } })} className="bg-white rounded-xl p-4 shadow-sm mb-3">
          <View className="flex-row justify-between items-start">
            <View>
              <Text className="font-bold text-slate-800">{inv.invoiceNumber}</Text>
              <Text className="text-slate-500 text-sm">{inv.toName || 'No client'}</Text>
              <Text className="text-slate-400 text-xs">{inv.date} | Due: {inv.dueDate}</Text>
            </View>
            <View className="items-end">
              <Text className={statusColor[inv.status] || 'text-slate-500'}>{inv.status}</Text>
              <Text className="text-slate-800 font-bold">${inv.lineItems.reduce((a,i)=>a+i.quantity*i.rate,0).toFixed(2)}</Text>
            </View>
          </View>
        </TouchableOpacity>
      ))}
      {filtered.length === 0 && <Text className="text-slate-400 text-center mt-8">No invoices found.</Text>}
    </ScrollView>
  );
}
