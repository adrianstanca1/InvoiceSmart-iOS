import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, TextInput } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { ShieldCheck, Download, FileText, Search } from 'lucide-react-native';
import DateRangePicker from '../../components/DateRangePicker';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { getAuditLogs } from '../../services/api';
import { AuditLog } from '../../types';

const ENTITY_TYPES: AuditLog['entityType'][] = ['Invoice', 'Client', 'Transaction', 'TaxRule'];
const ACTIONS: AuditLog['action'][] = ['Created', 'Updated', 'Deleted', 'Generated'];

const BADGE_COLORS: Record<AuditLog['action'], string> = {
  Created: 'bg-green-100 text-green-700',
  Updated: 'bg-blue-100 text-blue-700',
  Deleted: 'bg-red-100 text-red-700',
  Generated: 'bg-purple-100 text-purple-700',
};

export default function AuditScreen() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [entityType, setEntityType] = useState<AuditLog['entityType'] | ''>('');
  const [action, setAction] = useState<AuditLog['action'] | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAuditLogs({
        entityType: entityType || undefined,
        action: action || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setLogs(data);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  }, [entityType, action, startDate, endDate]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleExport(format: 'json' | 'csv') {
    try {
      const payload = format === 'json'
        ? JSON.stringify(logs, null, 2)
        : logs.map(l => [l.timestamp, l.user, l.action, l.entityType, l.entityName, l.details].join(',')).join('\n');
      const fileUri = `data:${format === 'json' ? 'application/json' : 'text/csv'};base64,${payload}`;
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: format === 'json' ? 'application/json' : 'text/csv', UTI: format });
      } else {
        Alert.alert('Sharing not available', 'Copy exported content manually.');
      }
    } catch (e: any) {
      Alert.alert('Export failed', e.message || 'Export failed');
    }
  }

  if (loading && logs.length === 0) return <LoadingSpinner message="Loading audit trail..." />;

  return (
    <ScrollView className="flex-1 bg-slate-50 p-4">
      <Text className="text-2xl font-bold text-slate-800 mb-3">Audit Trail</Text>

      <View className="bg-white rounded-xl p-4 shadow-sm mb-3">
        <Text className="font-bold text-slate-800 mb-2">Filters</Text>
        <View className="flex-row flex-wrap gap-2 mb-2">
          <TouchableOpacity onPress={() => setEntityType('')} className={`rounded-full px-3 py-1 border ${!entityType ? 'bg-slate-800 border-slate-800' : 'bg-white border-slate-200'}`}><Text className={`text-xs ${!entityType ? 'text-white' : 'text-slate-700'}`}>All</Text></TouchableOpacity>
          {ENTITY_TYPES.map(t => (
            <TouchableOpacity key={t} onPress={() => setEntityType(t)} className={`rounded-full px-3 py-1 border ${entityType === t ? 'bg-slate-800 border-slate-800' : 'bg-white border-slate-200'}`}><Text className={`text-xs ${entityType === t ? 'text-white' : 'text-slate-700'}`}>{t}</Text></TouchableOpacity>
          ))}
        </View>
        <View className="flex-row flex-wrap gap-2 mb-2">
          <TouchableOpacity onPress={() => setAction('')} className={`rounded-full px-3 py-1 border ${!action ? 'bg-slate-800 border-slate-800' : 'bg-white border-slate-200'}`}><Text className={`text-xs ${!action ? 'text-white' : 'text-slate-700'}`}>All</Text></TouchableOpacity>
          {ACTIONS.map(a => (
            <TouchableOpacity key={a} onPress={() => setAction(a)} className={`rounded-full px-3 py-1 border ${action === a ? 'bg-slate-800 border-slate-800' : 'bg-white border-slate-200'}`}><Text className={`text-xs ${action === a ? 'text-white' : 'text-slate-700'}`}>{a}</Text></TouchableOpacity>
          ))}
        </View>
        <DateRangePicker startDate={startDate} endDate={endDate} onChange={({ startDate: sd, endDate: ed }) => { setStartDate(sd); setEndDate(ed); }} />
        <TouchableOpacity onPress={load} className="bg-blue-600 rounded-lg py-2 items-center"><Text className="text-white font-medium">Apply Filters</Text></TouchableOpacity>
      </View>

      <View className="bg-white rounded-xl p-4 shadow-sm mb-4">
        <Text className="font-bold text-slate-800 mb-2">Export</Text>
        <View className="flex-row gap-2">
          <TouchableOpacity onPress={() => handleExport('csv')} className="flex-1 bg-slate-800 rounded-lg p-3 items-center flex-row justify-center"><Download size={16} color="#fff" /><Text className="text-white font-medium ml-2">CSV</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => handleExport('json')} className="flex-1 bg-slate-800 rounded-lg p-3 items-center flex-row justify-center"><FileText size={16} color="#fff" /><Text className="text-white font-medium ml-2">JSON</Text></TouchableOpacity>
        </View>
      </View>

      {logs.length === 0 && !loading ? (
        <EmptyState message="No audit events yet." />
      ) : (
        logs.map(log => (
          <View key={log.id} className="bg-white rounded-xl p-4 shadow-sm mb-3">
            <View className="flex-row justify-between items-center mb-1">
              <View className="flex-row items-center gap-2">
                <View className={`px-2 py-1 rounded-full ${BADGE_COLORS[log.action].split(' ')[0]}`}>
                  <Text className={`text-xs font-medium ${BADGE_COLORS[log.action].split(' ')[1]}`}>{log.action}</Text>
                </View>
                <Text className="text-xs text-slate-400">{log.entityType}</Text>
              </View>
              <Text className="text-xs text-slate-400">{new Date(log.timestamp).toLocaleString()}</Text>
            </View>
            <Text className="font-bold text-slate-800">{log.entityName}</Text>
            <Text className="text-slate-500 text-sm mt-1">{log.details}</Text>
            <Text className="text-slate-400 text-xs mt-1">By {log.user}</Text>
          </View>
        ))
      )}

      {loading && <View className="py-4 items-center"><ActivityIndicator size="small" color="#2563eb" /><Text className="text-slate-400 text-xs mt-1">Refreshing...</Text></View>}
    </ScrollView>
  );
}
