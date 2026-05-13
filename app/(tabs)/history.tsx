import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import * as api from '../../services/api';
import type { Invoice, Client, InvoiceStatus } from '../../types';
import { StatusBadge } from '../../components/StatusBadge';
import { fmtMoney, fmtDate, statusLabel } from '../../lib/format';

const STATUS_FILTERS: Array<'All' | InvoiceStatus> = ['All', 'draft', 'sent', 'partial', 'paid'];

export default function HistoryScreen() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clientsById, setClientsById] = useState<Record<string, Client>>({});
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'All' | InvoiceStatus>('All');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Invoice list doesn't include client_name — pull clients in parallel.
      const [invRes, clientRes] = await Promise.all([api.getInvoices(), api.getClients()]);
      setInvoices(invRes.data || []);
      const map: Record<string, Client> = {};
      for (const c of clientRes.data || []) map[c.id] = c;
      setClientsById(map);
    } catch {
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function deleteInvoice(id: string) {
    Alert.alert('Delete invoice?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try { await api.deleteInvoice(id); load(); } catch { /* swallow */ }
        },
      },
    ]);
  }

  const clientName = (inv: Invoice): string => {
    if (!inv.client_id) return 'No client';
    const c = clientsById[inv.client_id];
    return c?.name || 'Unknown client';
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return invoices
      .filter((inv) => filter === 'All' || inv.status === filter)
      .filter((inv) => {
        const cn = clientName(inv).toLowerCase();
        return cn.includes(q) || inv.invoice_number.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        const ad = a.issue_date ? new Date(a.issue_date).getTime() : 0;
        const bd = b.issue_date ? new Date(b.issue_date).getTime() : 0;
        return bd - ad;
      });
  }, [invoices, filter, search, clientsById]);

  return (
    <ScrollView className="flex-1 bg-slate-50 p-4">
      <Text className="text-2xl font-bold text-slate-800 mb-3">Invoice History</Text>
      <View className="flex-row gap-2 mb-3">
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search..."
          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-800"
        />
      </View>
      <ScrollView horizontal className="mb-3">
        {STATUS_FILTERS.map((s) => (
          <TouchableOpacity
            key={s}
            onPress={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full mr-2 ${filter === s ? 'bg-blue-600' : 'bg-white border border-slate-200'}`}
          >
            <Text className={filter === s ? 'text-white font-medium' : 'text-slate-700'}>
              {s === 'All' ? 'All' : statusLabel(s)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {filtered.map((inv) => (
        <TouchableOpacity
          key={inv.id}
          onPress={() => router.push({ pathname: '/create', params: { id: inv.id } })}
          className="bg-white rounded-xl p-4 shadow-sm mb-3"
        >
          <View className="flex-row justify-between items-start">
            <View className="flex-1 pr-3">
              <Text className="font-bold text-slate-800">{inv.invoice_number}</Text>
              <Text className="text-slate-500 text-sm">{clientName(inv)}</Text>
              <Text className="text-slate-400 text-xs">
                {fmtDate(inv.issue_date)} · Due: {fmtDate(inv.due_date)}
              </Text>
            </View>
            <View className="items-end">
              <StatusBadge status={inv.status} />
              <Text className="text-slate-800 font-bold mt-1">
                {fmtMoney(inv.total_amount)}
              </Text>
              <TouchableOpacity onPress={() => deleteInvoice(inv.id)} className="mt-1">
                <Trash2 size={16} color="#dc2626" />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      ))}
      {filtered.length === 0 && !loading ? (
        <Text className="text-slate-400 text-center mt-8">No invoices found.</Text>
      ) : null}
    </ScrollView>
  );
}
