import React from 'react';
import { View, Text } from 'react-native';
import type { InvoiceStatus } from '../types';
import { statusLabel } from '../lib/format';

// Status colour mapping mirrors lib/format.ts:STATUS_CLASSES but is kept
// here so the badge can also accept a derived UI status (e.g. 'overdue')
// that the backend doesn't track natively.
const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  draft: { bg: 'bg-slate-100', text: 'text-slate-600' },
  sent: { bg: 'bg-blue-100', text: 'text-blue-700' },
  partial: { bg: 'bg-amber-100', text: 'text-amber-700' },
  paid: { bg: 'bg-green-100', text: 'text-green-700' },
  overdue: { bg: 'bg-red-100', text: 'text-red-700' },
};

export function StatusBadge({ status }: { status: InvoiceStatus | string }) {
  const styles = STATUS_STYLES[status] || STATUS_STYLES.draft;
  return (
    <View className={`rounded-full px-2.5 py-1 ${styles.bg}`}>
      <Text className={`text-xs font-medium ${styles.text}`}>
        {statusLabel(status)}
      </Text>
    </View>
  );
}
