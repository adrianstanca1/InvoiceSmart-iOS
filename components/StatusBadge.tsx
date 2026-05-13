import React from 'react';
import { View, Text } from 'react-native';
import { Invoice } from '../types';

const statusStyles: Record<Invoice['status'], string> = {
  Draft: 'bg-slate-100 text-slate-600',
  Sent: 'bg-blue-100 text-blue-700',
  Paid: 'bg-green-100 text-green-700',
  Overdue: 'bg-red-100 text-red-700',
};

export function StatusBadge({ status }: { status: Invoice['status'] }) {
  const cls = statusStyles[status] || statusStyles.Draft;
  return (
    <View className={`rounded-full px-2.5 py-1 ${cls.split(' ')[0]}`}>
      <Text className={`text-xs font-medium ${cls.split(' ')[1]}`}>{status}</Text>
    </View>
  );
}
