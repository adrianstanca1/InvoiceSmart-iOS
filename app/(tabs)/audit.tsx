import React, { useCallback } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ShieldCheck } from 'lucide-react-native';
import * as Storage from '../../lib/storage';
import { AuditLog } from '../../types';

export default function AuditScreen() {
  const [logs, setLogs] = React.useState<AuditLog[]>([]);
  useFocusEffect(useCallback(() => { load(); }, []));
  async function load() { const l = await Storage.getAuditLogs(); setLogs(l.slice(0,100)); }

  return (
    <ScrollView className="flex-1 bg-slate-50 p-4">
      <Text className="text-2xl font-bold text-slate-800 mb-3">Audit Trail</Text>
      {logs.length === 0 && <View className="items-center mt-8"><ShieldCheck size={48} color="#94a3b8" /><Text className="text-slate-400 mt-2">No audit events yet.</Text></View>}
      {logs.map(log=>(
        <View key={log.id} className="bg-white rounded-xl p-4 shadow-sm mb-3">
          <View className="flex-row justify-between">
            <Text className="font-bold text-slate-800">{log.action} {log.entityType}</Text>
            <Text className="text-slate-400 text-xs">{new Date(log.timestamp).toLocaleString()}</Text>
          </View>
          <Text className="text-slate-600 mt-1">{log.entityName} — {log.details}</Text>
        </View>
      ))}
    </ScrollView>
  );
}
