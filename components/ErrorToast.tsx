import React from 'react';
import { View, Text } from 'react-native';
import { AlertCircle } from 'lucide-react-native';

export function ErrorToast({ message }: { message: string }) {
  if (!message) return null;
  return (
    <View className="bg-red-50 border border-red-200 rounded-lg p-3 flex-row items-center gap-2 mx-4 mb-3">
      <AlertCircle size={18} color="#dc2626" />
      <Text className="text-red-700 text-sm flex-1">{message}</Text>
    </View>
  );
}
