import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Dimensions, RefreshControl } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { LineChart } from 'react-native-chart-kit';
import { FileText, Users, TrendingUp, AlertCircle, Plus } from 'lucide-react-native';
import * as api from '../../services/api';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { EmptyState } from '../../components/EmptyState';
import { ErrorToast } from '../../components/ErrorToast';
import type { DashboardStats, RevenueTrendPoint } from '../../types';
import { fmtMoney } from '../../lib/format';

const screenWidth = Dimensions.get('window').width - 32;

export default function DashboardScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [dashboard, setDashboard] = useState<DashboardStats | null>(null);
  const [trend, setTrend] = useState<{ labels: string[]; data: number[] }>({ labels: [], data: [] });

  const loadData = useCallback(async () => {
    setError('');
    try {
      const [dash, tr] = await Promise.all([
        api.getDashboard(),
        api.getRevenueTrend('2025-01-01', '2025-12-31'),
      ]);
      setDashboard(dash);
      // Backend returns [{date, revenue, expenses}, ...]. Map to chart shape.
      const points: RevenueTrendPoint[] = Array.isArray(tr) ? tr : [];
      setTrend({
        labels: points.map((p) => new Date(p.date).toLocaleString('en-GB', { month: 'short' })),
        data: points.map((p) => p.revenue),
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData();
    }, [loadData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (loading && !refreshing) return <LoadingSpinner />;

  const stats: DashboardStats = dashboard || {
    totalRevenue: trend.data.reduce((a, b) => a + b, 0),
    totalInvoiced: 0,
    totalPaid: 0,
    totalExpenses: 0,
    netProfit: 0,
    invoiceCount: 0,
    clientCount: 0,
    overdueCount: 0,
    outstandingAmount: 0,
  };

  const chartData = {
    labels: trend.labels.length > 0 ? trend.labels : ['Jan','Feb','Mar','Apr','May','Jun'],
    datasets: [{ data: trend.data.length > 0 ? trend.data : [0,0,0,0,0,0] }],
  };

  return (
    <ScrollView
      className="flex-1 bg-slate-50 p-4"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text className="text-2xl font-bold text-slate-800 mb-4">Dashboard</Text>

      {error ? <ErrorToast message={error} /> : null}

      <View className="flex-row flex-wrap justify-between mb-4">
        <StatCard
          icon={<TrendingUp size={20} color="#2563eb" />}
          label="Revenue"
          value={fmtMoney(stats.totalRevenue)}
        />
        <StatCard
          icon={<FileText size={20} color="#16a34a" />}
          label="Invoices"
          value={String(stats.invoiceCount || 0)}
        />
        <StatCard
          icon={<Users size={20} color="#9333ea" />}
          label="Clients"
          value={String(stats.clientCount || 0)}
        />
        <StatCard
          icon={<AlertCircle size={20} color="#dc2626" />}
          label="Overdue"
          value={String(stats.overdueCount || 0)}
        />
      </View>

      {trend.labels.length > 0 ? (
        <View className="bg-white rounded-xl p-4 shadow-sm mb-4">
          <Text className="font-bold text-slate-800 mb-2">Revenue Trend</Text>
          <LineChart
            data={chartData}
            width={screenWidth}
            height={180}
            chartConfig={{
              backgroundColor: '#fff',
              backgroundGradientFrom: '#fff',
              backgroundGradientTo: '#fff',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
              labelColor: () => '#64748b',
            }}
            bezier
            style={{ borderRadius: 12 }}
          />
        </View>
      ) : (
        <EmptyState message="No revenue trend data available" />
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
        <Text className={`text-xl font-bold ${stats.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {fmtMoney(stats.netProfit)}
        </Text>
        <Text className="text-slate-500 text-xs mt-1">Paid revenue minus expenses</Text>
      </View>
    </ScrollView>
  );
}

function StatCard({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View className="w-[48%] bg-white rounded-xl p-3 shadow-sm mb-3">
      <View className="flex-row items-center gap-2 mb-1">
        {icon}
        <Text className="text-slate-500 text-xs font-medium uppercase">{label}</Text>
      </View>
      <Text className="text-lg font-bold text-slate-800">{value}</Text>
    </View>
  );
}
