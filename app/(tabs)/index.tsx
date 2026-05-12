import React, { useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { LineChart } from 'react-native-chart-kit';
import { FileText, Users, TrendingUp, AlertCircle, Plus } from 'lucide-react-native';
import { Invoice, Transaction } from '../../types';
import * as Storage from '../../lib/storage';

const screenWidth = Dimensions.get('window').width - 32;

export default function DashboardScreen() {
  const router = useRouter();
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);

  useFocusEffect(useCallback(() => { loadData(); }, []));

  async function loadData() {
    const [inv, tx] = await Promise.all([Storage.getInvoices(), Storage.getTransactions()]);
    setInvoices(inv);
    setTransactions(tx);
  }

  const stats = React.useMemo(() => {
    const totalRev = invoices.reduce((s, inv) => s + inv.lineItems.reduce((a, i) => a + i.quantity * i.rate, 0), 0);
    const paid = invoices.filter(i => i.status === 'Paid');
    const paidAmt = paid.reduce((s, inv) => s + inv.lineItems.reduce((a, i) => a + i.quantity * i.rate, 0), 0);
    const expenses = transactions.filter(t => t.type === 'Expense').reduce((s, t) => s + t.amount, 0);
    const overdue = invoices.filter(i => i.status === 'Overdue' || (i.status !== 'Paid' && new Date(i.dueDate) < new Date())).length;
    return { totalRev, paidAmt, expenses, netProfit: paidAmt - expenses, count: invoices.length, clients: Array.from(new Set(invoices.map(i => i.clientId).filter(Boolean))).length, overdue };
  }, [invoices, transactions]);

  const chartData = React.useMemo(() => {
    const map = new Map<string, number>();
    invoices.forEach(inv => {
      const d = new Date(inv.date);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const amt = inv.lineItems.reduce((a, i) => a + i.quantity * i.rate, 0);
      map.set(k, (map.get(k) || 0) + amt);
    });
    const sorted = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(-6);
    return { labels: sorted.map(([k]) => k.slice(5)), datasets: [{ data: sorted.map(([, v]) => v) }] };
  }, [invoices]);

  return (
    <ScrollView className="flex-1 bg-slate-50 p-4">
      <Text className="text-2xl font-bold text-slate-800 mb-4">Dashboard</Text>
      <View className="flex-row flex-wrap justify-between mb-4">
        <StatCard icon={<TrendingUp size={20} color="#2563eb" />} label="Revenue" value={`$${stats.totalRev.toFixed(2)}`} />
        <StatCard icon={<FileText size={20} color="#16a34a" />} label="Invoices" value={String(stats.count)} />
        <StatCard icon={<Users size={20} color="#9333ea" />} label="Clients" value={String(stats.clients)} />
        <StatCard icon={<AlertCircle size={20} color="#dc2626" />} label="Overdue" value={String(stats.overdue)} />
      </View>

      {chartData.labels.length > 0 && (
        <View className="bg-white rounded-xl p-4 shadow-sm mb-4">
          <Text className="font-bold text-slate-800 mb-2">Revenue Trend</Text>
          <LineChart data={chartData} width={screenWidth} height={180}
            chartConfig={{ backgroundColor: '#fff', backgroundGradientFrom: '#fff', backgroundGradientTo: '#fff', decimalPlaces: 0, color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`, labelColor: () => '#64748b' }}
            bezier style={{ borderRadius: 12 }} />
        </View>
      )}

      <View className="bg-white rounded-xl p-4 shadow-sm mb-4">
        <Text className="font-bold text-slate-800 mb-2">Quick Actions</Text>
        <View className="flex-row gap-3">
          <TouchableOpacity onPress={() => router.push('/create')} className="flex-1 bg-blue-600 rounded-lg p-3 items-center">
            <Plus size={20} color="#fff" />
            <Text className="text-white font-medium mt-1">New Invoice</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/clients')} className="flex-1 bg-slate-800 rounded-lg p-3 items-center">
            <Users size={20} color="#fff" />
            <Text className="text-white font-medium mt-1">Add Client</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View className="bg-white rounded-xl p-4 shadow-sm mb-6">
        <Text className="font-bold text-slate-800 mb-1">Net Profit</Text>
        <Text className={`text-xl font-bold ${stats.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>${stats.netProfit.toFixed(2)}</Text>
        <Text className="text-slate-500 text-xs mt-1">Paid revenue minus expenses</Text>
      </View>
    </ScrollView>
  );
}

function StatCard({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View className="w-[48%] bg-white rounded-xl p-3 shadow-sm mb-3">
      <View className="flex-row items-center gap-2 mb-1">{icon}<Text className="text-slate-500 text-xs font-medium uppercase">{label}</Text></View>
      <Text className="text-lg font-bold text-slate-800">{value}</Text>
    </View>
  );
}
