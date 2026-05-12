import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Dimensions } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { BarChart, PieChart } from 'react-native-chart-kit';
import * as Storage from '../../lib/storage';
import { Invoice } from '../../types';

const screenWidth = Dimensions.get('window').width - 32;
const COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#9333ea', '#0ea5e9'];

export default function ReportsScreen() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  useFocusEffect(useCallback(() => { load(); }, []));
  async function load() { const i = await Storage.getInvoices(); setInvoices(i); }

  const monthly = React.useMemo(() => {
    const map = new Map<string, number>();
    invoices.forEach(inv => {
      const d = new Date(inv.date);
      const k = d.toLocaleString('default', { month: 'short', year: '2-digit' });
      const amt = inv.lineItems.reduce((a,i)=>a+i.quantity*i.rate,0);
      map.set(k, (map.get(k)||0)+amt);
    });
    return Array.from(map.entries()).map(([name, revenue]) => ({ name, revenue }));
  }, [invoices]);

  const statusData = React.useMemo(() => {
    const counts: any = { Paid:0, Sent:0, Draft:0, Overdue:0 };
    invoices.forEach(i => { if (counts[i.status] !== undefined) counts[i.status]++; });
    return Object.entries(counts).filter(([,v])=>v).map(([name, value]) => ({ name, value, color: name==='Paid' ? '#16a34a' : name==='Sent' ? '#2563eb' : name==='Overdue' ? '#dc2626' : '#64748b' }));
  }, [invoices]);

  const totalRevenue = invoices.reduce((s,inv)=> s + inv.lineItems.reduce((a,i)=>a+i.quantity*i.rate,0), 0);
  const paid = invoices.filter(i=>i.status==='Paid').reduce((s,inv)=> s + inv.lineItems.reduce((a,i)=>a+i.quantity*i.rate,0),0);

  return (
    <ScrollView className="flex-1 bg-slate-50 p-4">
      <Text className="text-2xl font-bold text-slate-800 mb-3">Reports</Text>
      <View className="bg-white rounded-xl p-4 shadow-sm mb-4">
        <Text className="font-bold text-slate-800 mb-2">Overview</Text>
        <View className="flex-row justify-between">
          <View><Text className="text-slate-500 text-sm">Total Revenue</Text><Text className="text-xl font-bold text-slate-800">${totalRevenue.toFixed(2)}</Text></View>
          <View><Text className="text-slate-500 text-sm">Collected</Text><Text className="text-xl font-bold text-green-600">${paid.toFixed(2)}</Text></View>
        </View>
      </View>
      {monthly.length > 0 && (
        <View className="bg-white rounded-xl p-4 shadow-sm mb-4">
          <Text className="font-bold text-slate-800 mb-2">Monthly Revenue</Text>
          <BarChart data={{ labels: monthly.map(m=>m.name), datasets:[{data:monthly.map(m=>m.revenue)}] }} width={screenWidth} height={220}
            chartConfig={{ backgroundColor:'#fff', backgroundGradientFrom:'#fff', backgroundGradientTo:'#fff', decimalPlaces:0, color:(o=1)=>`rgba(37,99,235,${o})`, labelColor:()=>'#64748b' }} style={{ borderRadius:12 }} />
        </View>
      )}
      {statusData.length > 0 && (
        <View className="bg-white rounded-xl p-4 shadow-sm mb-6">
          <Text className="font-bold text-slate-800 mb-2">Status Breakdown</Text>
          <PieChart data={statusData} width={screenWidth} height={200} accessor="value" backgroundColor="transparent" paddingLeft="0"
            chartConfig={{ color:(o=1)=>`rgba(0,0,0,${o})` }} />
        </View>
      )}
    </ScrollView>
  );
}
