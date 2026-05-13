import React from 'react';
import { View, TextInput } from 'react-native';
import { Search } from 'lucide-react-native';

export function SearchBar({ value, onChangeText, placeholder = 'Search...' }: { value: string; onChangeText: (t: string) => void; placeholder?: string }) {
  return (
    <View className="flex-row items-center bg-white border border-slate-200 rounded-lg px-3 py-2 mb-3 gap-2">
      <Search size={18} color="#94a3b8" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        className="flex-1 text-slate-800 text-sm"
        placeholderTextColor="#94a3b8"
      />
    </View>
  );
}
