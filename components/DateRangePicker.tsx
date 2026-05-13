import React from 'react';
import { View, TextInput, Text } from 'react-native';

export function DateRangePicker({
  startDate,
  endDate,
  onChangeStart,
  onChangeEnd,
}: {
  startDate: string;
  endDate: string;
  onChangeStart: (v: string) => void;
  onChangeEnd: (v: string) => void;
}) {
  return (
    <View className="mb-3">
      <Text className="text-xs text-slate-500 mb-1">Date Range Filter</Text>
      <View className="flex-row gap-2">
        <TextInput value={startDate} onChangeText={onChangeStart} placeholder="YYYY-MM-DD" className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm" />
        <TextInput value={endDate} onChangeText={onChangeEnd} placeholder="YYYY-MM-DD" className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm" />
      </View>
    </View>
  );
}
