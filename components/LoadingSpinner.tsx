import React from 'react';
import { View, ActivityIndicator } from 'react-native';

export function LoadingSpinner({ className = '' }: { className?: string }) {
  return (
    <View className={`flex-1 justify-center items-center bg-slate-50 ${className}`}>
      <ActivityIndicator size="large" color="#2563eb" />
    </View>
  );
}
