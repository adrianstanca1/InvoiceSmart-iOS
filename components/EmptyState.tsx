import React from 'react';
import { View, Text } from 'react-native';
import { ClipboardList } from 'lucide-react-native';

export function EmptyState({ message = 'No data found' }: { message?: string }) {
  return (
    <View className="flex-1 justify-center items-center p-6">
      <ClipboardList size={40} color="#94a3b8" />
      <Text className="text-slate-400 mt-3 text-sm">{message}</Text>
    </View>
  );
}
