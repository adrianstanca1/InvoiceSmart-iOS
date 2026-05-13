import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { BarChart, PieChart } from 'react-native-chart-kit';
import * as Sharing from 'expo-sharing';
import { Download, FileText } from 'lucide-react-native';
import { DateRangePicker } from '../../components/DateRangePicker';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { getReportsProfitLoss, getTopExpenses, getTaxEstimate, getRevenueByClient, exportReport } from '../../services/api';

const screenWidth = 380;
const COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#9333ea', '#0ea5e9'];

export default function ReportsScreen() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [pnl, setPnl] = useState<any>(null);
  const [revenueByClient, setRevenueByClient] = useState<{ clientName: string; revenue: number }[]>([]);
  const [topExpenses, setTopExpenses] = useState<{ category: string; amount: number }[]>([]);
  const [taxEst, setTaxEst] = useState<{ vatDue: number; corporationTax: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pnlRes, rev, exp, tax] = await Promise.all([
        getReportsProfitLoss(startDate || '2020-01-01', endDate || '2030-12-31'),
        getRevenueByClient(startDate || '2020-01-01', endDate || '2030-12-31'),
        getTopExpenses(startDate || '2020-01-01', endDate || '2030-12-31'),
        getTaxEstimate(startDate || '2020-01-01', endDate || '2030-12-31'),
      ]);
      setPnl((pnlRes as any) || null);
      setRevenueByClient(rev);
      setTopExpenses(exp);
      setTaxEst(tax);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to fetch reports');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const monthlyRevenue = useMemo(() => {
    return [...revenueByClient].sort((a, b) => b.revenue - a.revenue);
  }, [revenueByClient]);

  async function handleExport(format: 'json' | 'csv') {
    try {
      const blob = await exportReport('profit-loss', startDate || '2020-01-01', endDate || '2030-12-31');
      if (blob && blob.downloadUrl) {
        Alert.alert('Export ready', `Download from ${blob.downloadUrl}`);
      } else {
        Alert.alert('Export', 'CSV export generated on server.');
      }
    } catch (e: any) {
      Alert.alert('Export failed', e.message || 'Export failed');
    }
  }

  if (loading && !pnl) return <View className="flex-1 justify-center items-center"><ActivityIndicator size="large" color="#2563eb" /><Text className="text-slate-400 mt-3">Loading reports...</Text></View>;

  return (
    <ScrollView className="flex-1 bg-slate-50 p-4">
      <Text className="text-2xl font-bold text-slate-800 mb-3">Reports</Text>

      <DateRangePicker startDate={startDate} endDate={endDate} onChangeStart={setStartDate} onChangeEnd={setEndDate} />

      <TouchableOpacity onPress={load} className="bg-blue-600 rounded-lg py-2 items-center mb-4">
        <Text className="text-white font-medium">Refresh Reports</Text>
      </TouchableOpacity>

      {pnl && (
        <View className="bg-white rounded-xl p-4 shadow-sm mb-4">
          <Text className="font-bold text-slate-800 mb-2">Profit & Loss</Text>
          <View className="flex-row justify-between mb-1"><Text className="text-slate-600">Revenue</Text><Text className="font-medium text-slate-800">${pnl.revenue.toFixed(2)}</Text></View>
          <View className="flex-row justify-between mb-1"><Text className="text-slate-600">Cost of Sales</Text><Text className="font-medium text-slate-800">${pnl.costOfSales.toFixed(2)}</Text></View>
          <View className="flex-row justify-between mb-1"><Text className="text-slate-600">Gross Profit</Text><Text className="font-medium text-slate-800">${pnl.grossProfit.toFixed(2)}</Text></View>
          <View className="flex-row justify-between mb-1"><Text className="text-slate-600">Total Expenses</Text><Text className="font-medium text-slate-800">${pnl.totalExpenses.toFixed(2)}</Text></View>
          <View className="flex-row justify-between mt-2 border-t border-slate-100 pt-2">
            <Text className="font-bold text-slate-800">Net Profit</Text>
            <Text className={`font-bold ${pnl.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>${pnl.netProfit.toFixed(2)}</Text>
          </View>
        </View>
      )}

      {monthlyRevenue.length > 0 && (
        <View className="bg-white rounded-xl p-4 shadow-sm mb-4">
          <Text className="font-bold text-slate-800 mb-2">Revenue by Client</Text>
          <BarChart
            data={{
              labels: monthlyRevenue.map((r) => r.clientName.slice(0, 8)),
              datasets: [{ data: monthlyRevenue.map((r) => r.revenue) }],
            } as any}
            width={screenWidth}
            height={220}
            yAxisLabel="$"
            yAxisSuffix=""
            chartConfig={{
              backgroundColor: '#fff',
              backgroundGradientFrom: '#fff',
              backgroundGradientTo: '#fff',
              decimalPlaces: 0,
              color: (o = 1) => `rgba(37,99,235,${o})`,
              labelColor: () => '#64748b',
            } as any}
            style={{ borderRadius: 12 }}
          />
        </View>
      )}

      {revenueByClient.length > 0 && monthlyRevenue.length === 0 && (
        <View className="bg-white rounded-xl p-4 shadow-sm mb-4">
          <Text className="font-bold text-slate-800 mb-2">Revenue by Client</Text>
          {revenueByClient.map((r) => (
            <View key={r.clientName} className="flex-row justify-between mb-1">
              <Text className="text-slate-600">{r.clientName}</Text>
              <Text className="font-medium text-slate-800">${r.revenue.toFixed(2)}</Text>
            </View>
          ))}
        </View>
      )}

      {topExpenses.length > 0 && (
        <View className="bg-white rounded-xl p-4 shadow-sm mb-4">
          <Text className="font-bold text-slate-800 mb-2">Top Expenses</Text>
          {topExpenses.map((e) => (
            <View key={e.category} className="flex-row justify-between mb-1">
              <Text className="text-slate-600">{e.category}</Text>
              <Text className="font-medium text-slate-800">${e.amount.toFixed(2)}</Text>
            </View>
          ))}
        </View>
      )}

      {taxEst && (
        <View className="bg-white rounded-xl p-4 shadow-sm mb-4">
          <Text className="font-bold text-slate-800 mb-2">Tax Liability Estimate</Text>
          <View className="flex-row justify-between mb-1"><Text className="text-slate-600">VAT Due</Text><Text className="font-medium text-slate-800">${taxEst.vatDue.toFixed(2)}</Text></View>
          <View className="flex-row justify-between"><Text className="text-slate-600">Corp Tax</Text><Text className="font-medium text-slate-800">${taxEst.corporationTax.toFixed(2)}</Text></View>
        </View>
      )}

      <View className="bg-white rounded-xl p-4 shadow-sm mb-6">
        <Text className="font-bold text-slate-800 mb-2">Export</Text>
        <View className="flex-row gap-2">
          <TouchableOpacity onPress={() => handleExport('csv')} className="flex-1 bg-slate-800 rounded-lg p-3 items-center flex-row justify-center">
            <Download size={16} color="#fff" /><Text className="text-white font-medium ml-2">CSV</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleExport('json')} className="flex-1 bg-slate-800 rounded-lg p-3 items-center flex-row justify-center">
            <FileText size={16} color="#fff" /><Text className="text-white font-medium ml-2">JSON</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading && <View className="py-4 items-center"><ActivityIndicator size="small" color="#2563eb" /><Text className="text-slate-400 text-xs mt-1">Refreshing...</Text></View>}
    </ScrollView>
  );
}
