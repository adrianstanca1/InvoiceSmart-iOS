import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
// Expo SDK 55 moved the simple `cacheDirectory`/`writeAsStringAsync`
// API into `expo-file-system/legacy`; the top-level export is the new
// modular API (Paths.cache, File.create()) we don't yet use.
import * as FileSystem from 'expo-file-system/legacy';
import { Download, FileText } from 'lucide-react-native';
import { getAuditLogs } from '../../services/api';
import type { AuditLog } from '../../types';
import { fmtDate } from '../../lib/format';

// Backend audit log uses snake_case + the only stable fields are
// entity_type, action, created_at, and the user_id. The entity name is
// NOT stored on the row — derive a label from old_values/new_values
// when possible, otherwise just show the entity_id.
const BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  create: { bg: 'bg-green-100', text: 'text-green-700' },
  created: { bg: 'bg-green-100', text: 'text-green-700' },
  update: { bg: 'bg-blue-100', text: 'text-blue-700' },
  updated: { bg: 'bg-blue-100', text: 'text-blue-700' },
  delete: { bg: 'bg-red-100', text: 'text-red-700' },
  deleted: { bg: 'bg-red-100', text: 'text-red-700' },
};

function badgeFor(action: string) {
  return BADGE_COLORS[action.toLowerCase()] || { bg: 'bg-slate-100', text: 'text-slate-700' };
}

function entityLabel(log: AuditLog): string {
  // Try to derive a human-friendly label from the JSONB payloads.
  const pickName = (obj: Record<string, unknown> | null) => {
    if (!obj) return null;
    const candidate = ['name', 'invoice_number', 'description', 'email'].find((k) => typeof obj[k] === 'string' && obj[k]);
    return candidate ? String(obj[candidate]) : null;
  };
  return pickName(log.new_values) || pickName(log.old_values) || log.entity_id;
}

export default function AuditScreen() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [entityType, setEntityType] = useState<string>('');
  const [action, setAction] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAuditLogs();
      setLogs(Array.isArray(data) ? data : []);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Filters happen client-side — the /api/audit-logs endpoint returns
  // an unfiltered list (LIMIT 1000), so we apply entity_type/action
  // restrictions here.
  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (entityType && l.entity_type !== entityType) return false;
      if (action && l.action !== action) return false;
      return true;
    });
  }, [logs, entityType, action]);

  const entityTypes = useMemo(
    () => Array.from(new Set(logs.map((l) => l.entity_type))).filter(Boolean),
    [logs]
  );
  const actions = useMemo(
    () => Array.from(new Set(logs.map((l) => l.action))).filter(Boolean),
    [logs]
  );

  async function handleExport(format: 'json' | 'csv') {
    try {
      const payload = format === 'json'
        ? JSON.stringify(filtered, null, 2)
        : ['created_at,entity_type,action,entity_id', ...filtered.map((l) => `${l.created_at},${l.entity_type},${l.action},${l.entity_id}`)].join('\n');
      const tmpPath = `${FileSystem.cacheDirectory ?? ''}audit_log.${format}`;
      await FileSystem.writeAsStringAsync(tmpPath, payload);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(tmpPath, { mimeType: format === 'json' ? 'application/json' : 'text/csv' });
      } else {
        Alert.alert('Export ready', `Saved to ${tmpPath}`);
      }
    } catch (e: any) {
      Alert.alert('Export failed', e.message || 'Export failed');
    }
  }

  if (loading && logs.length === 0) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#2563eb" />
        <Text className="text-slate-400 mt-3">Loading audit trail...</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-slate-50 p-4">
      <Text className="text-2xl font-bold text-slate-800 mb-3">Audit Trail</Text>

      {(entityTypes.length > 0 || actions.length > 0) && (
        <View className="bg-white rounded-xl p-4 shadow-sm mb-3">
          <Text className="font-bold text-slate-800 mb-2">Filters</Text>
          {entityTypes.length > 0 && (
            <View className="flex-row flex-wrap gap-2 mb-2">
              <FilterChip label="All" active={!entityType} onPress={() => setEntityType('')} />
              {entityTypes.map((t) => (
                <FilterChip key={t} label={t} active={entityType === t} onPress={() => setEntityType(t)} />
              ))}
            </View>
          )}
          {actions.length > 0 && (
            <View className="flex-row flex-wrap gap-2 mb-2">
              <FilterChip label="All actions" active={!action} onPress={() => setAction('')} />
              {actions.map((a) => (
                <FilterChip key={a} label={a} active={action === a} onPress={() => setAction(a)} />
              ))}
            </View>
          )}
        </View>
      )}

      <View className="bg-white rounded-xl p-4 shadow-sm mb-4">
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

      {filtered.length === 0 && !loading ? (
        <View className="items-center py-12">
          <FileText size={48} color="#94a3b8" />
          <Text className="text-slate-400 mt-4">No audit events yet.</Text>
          <Text className="text-slate-400 text-xs mt-1">Audit logging is server-side; events appear here once recorded.</Text>
        </View>
      ) : (
        filtered.map((log) => {
          const badge = badgeFor(log.action);
          return (
            <View key={log.id} className="bg-white rounded-xl p-4 shadow-sm mb-3">
              <View className="flex-row justify-between items-center mb-1">
                <View className="flex-row items-center gap-2">
                  <View className={`px-2 py-1 rounded-full ${badge.bg}`}>
                    <Text className={`text-xs font-medium ${badge.text}`}>{log.action}</Text>
                  </View>
                  <Text className="text-xs text-slate-400">{log.entity_type}</Text>
                </View>
                <Text className="text-xs text-slate-400">{fmtDate(log.created_at)}</Text>
              </View>
              <Text className="font-bold text-slate-800">{entityLabel(log)}</Text>
              {log.ip_address ? (
                <Text className="text-slate-400 text-xs mt-1">From {log.ip_address}</Text>
              ) : null}
            </View>
          );
        })
      )}

      {loading && filtered.length > 0 && (
        <View className="py-4 items-center">
          <ActivityIndicator size="small" color="#2563eb" />
          <Text className="text-slate-400 text-xs mt-1">Refreshing...</Text>
        </View>
      )}
    </ScrollView>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`rounded-full px-3 py-1 border ${active ? 'bg-slate-800 border-slate-800' : 'bg-white border-slate-200'}`}
    >
      <Text className={`text-xs ${active ? 'text-white' : 'text-slate-700'}`}>{label}</Text>
    </TouchableOpacity>
  );
}
