import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { BarChart } from 'react-native-chart-kit';
import * as Sharing from 'expo-sharing';
// Expo SDK 55 moved cacheDirectory + writeAsStringAsync to /legacy.
import * as FileSystem from 'expo-file-system/legacy';
import { Download, FileText } from 'lucide-react-native';
import { DateRangePicker } from '../../components/DateRangePicker';
import {
  getProfitLoss, getTopExpenses, getTaxEstimate, getRevenueByClient, exportReport,
} from '../../services/api';
import type {
  ProfitLossReport, TopExpense, TaxEstimate, RevenueByClient,
} from '../../types';
import { fmtMoney } from '../../lib/format';

const SCREEN_WIDTH = 380;

export default function ReportsScreen() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [pnl, setPnl] = useState<ProfitLossReport | null>(null);
  const [revenueByClient, setRevenueByClient] = useState<RevenueByClient[]>([]);
  const [topExpenses, setTopExpenses] = useState<TopExpense[]>([]);
  const [taxEst, setTaxEst] = useState<TaxEstimate | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pnlRes, rev, exp, tax] = await Promise.all([
        getProfitLoss(startDate || undefined, endDate || undefined),
        getRevenueByClient(startDate || undefined, endDate || undefined),
        getTopExpenses(startDate || undefined, endDate || undefined),
        getTaxEstimate(startDate || undefined, endDate || undefined),
      ]);
      setPnl(pnlRes);
      setRevenueByClient(rev || []);
      setTopExpenses(exp || []);
      setTaxEst(tax);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to fetch reports');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const sortedRevenue = useMemo(
    () => [...revenueByClient].sort((a, b) => b.revenue - a.revenue),
    [revenueByClient]
  );

  async function handleExport(type: 'profit-loss' | 'revenue' | 'expenses') {
    try {
      const r = await exportReport(type, startDate || undefined, endDate || undefined);
      // Write CSV to a tmp file and offer the share sheet (iOS-friendly).
      const tmpPath = `${FileSystem.cacheDirectory ?? ''}${r.filename ?? `${type}.csv`}`;
      await FileSystem.writeAsStringAsync(tmpPath, r.csv);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(tmpPath, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' });
      } else {
        Alert.alert('Export ready', `Saved to ${tmpPath}`);
      }
    } catch (e: any) {
      Alert.alert('Export failed', e.message || 'Export failed');
    }
  }

  if (loading && !pnl) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#2563eb" />
        <Text className="text-slate-400 mt-3">Loading reports...</Text>
      </View>
    );
  }

  const pAndL = pnl?.profitAndLoss;

  return (
    <ScrollView className="flex-1 bg-slate-50 p-4">
      <Text className="text-2xl font-bold text-slate-800 mb-3">Reports</Text>

      <DateRangePicker startDate={startDate} endDate={endDate} onChangeStart={setStartDate} onChangeEnd={setEndDate} />

      <TouchableOpacity onPress={load} className="bg-blue-600 rounded-lg py-2 items-center mb-4">
        <Text className="text-white font-medium">Refresh Reports</Text>
      </TouchableOpacity>

      {pAndL && (
        <View className="bg-white rounded-xl p-4 shadow-sm mb-4">
          <Text className="font-bold text-slate-800 mb-2">Profit & Loss</Text>
          <Row label="Revenue" value={fmtMoney(pAndL.revenue)} />
          <Row label="Cost of Sales" value={fmtMoney(pAndL.costOfSales)} />
          <Row label="Gross Profit" value={fmtMoney(pAndL.grossProfit)} />
          <Row label="Total Expenses" value={fmtMoney(pAndL.totalExpenses)} />
          <View className="flex-row justify-between mt-2 border-t border-slate-100 pt-2">
            <Text className="font-bold text-slate-800">Net Profit</Text>
            <Text className={`font-bold ${pAndL.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {fmtMoney(pAndL.netProfit)}
            </Text>
          </View>
        </View>
      )}

      {sortedRevenue.length > 0 && (
        <View className="bg-white rounded-xl p-4 shadow-sm mb-4">
          <Text className="font-bold text-slate-800 mb-2">Revenue by Client</Text>
          <BarChart
            data={{
              labels: sortedRevenue.map((r) => r.clientName.slice(0, 8)),
              datasets: [{ data: sortedRevenue.map((r) => r.revenue) }],
            }}
            width={SCREEN_WIDTH}
            height={220}
            yAxisLabel="£"
            yAxisSuffix=""
            chartConfig={{
              backgroundColor: '#fff',
              backgroundGradientFrom: '#fff',
              backgroundGradientTo: '#fff',
              decimalPlaces: 0,
              color: (o = 1) => `rgba(37,99,235,${o})`,
              labelColor: () => '#64748b',
            }}
            style={{ borderRadius: 12 }}
          />
        </View>
      )}

      {topExpenses.length > 0 && (
        <View className="bg-white rounded-xl p-4 shadow-sm mb-4">
          <Text className="font-bold text-slate-800 mb-2">Top Expenses</Text>
          {topExpenses.map((e) => (
            <Row key={e.category} label={e.category || 'Uncategorised'} value={fmtMoney(e.amount)} />
          ))}
        </View>
      )}

      {taxEst && (
        <View className="bg-white rounded-xl p-4 shadow-sm mb-4">
          <Text className="font-bold text-slate-800 mb-2">Tax Liability Estimate</Text>
          <Row label="VAT Due" value={fmtMoney(taxEst.vatDue)} />
          <Row label="Corporation Tax" value={fmtMoney(taxEst.corporationTax)} />
        </View>
      )}

      <View className="bg-white rounded-xl p-4 shadow-sm mb-6">
        <Text className="font-bold text-slate-800 mb-2">Export CSV</Text>
        <View className="flex-row gap-2 flex-wrap">
          <TouchableOpacity onPress={() => handleExport('profit-loss')} className="flex-1 bg-slate-800 rounded-lg p-3 items-center flex-row justify-center">
            <Download size={16} color="#fff" /><Text className="text-white font-medium ml-2">P&L</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleExport('revenue')} className="flex-1 bg-slate-800 rounded-lg p-3 items-center flex-row justify-center">
            <FileText size={16} color="#fff" /><Text className="text-white font-medium ml-2">Revenue</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleExport('expenses')} className="flex-1 bg-slate-800 rounded-lg p-3 items-center flex-row justify-center">
            <FileText size={16} color="#fff" /><Text className="text-white font-medium ml-2">Expenses</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading && (
        <View className="py-4 items-center">
          <ActivityIndicator size="small" color="#2563eb" />
          <Text className="text-slate-400 text-xs mt-1">Refreshing...</Text>
        </View>
      )}
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between mb-1">
      <Text className="text-slate-600">{label}</Text>
      <Text className="font-medium text-slate-800">{value}</Text>
    </View>
  );
}
