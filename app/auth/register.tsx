/// <reference types="../nativewind.d.ts" />
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, Mail, Lock, UserPlus } from 'lucide-react-native';
import * as api from '../../services/api';

export default function RegisterScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleRegister() {
    if (!name || !email || !password) {
      setError('Please fill in all fields');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.register(email, password, name);
      router.replace('/');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView contentContainerClassName="flex-grow justify-center px-6 py-8">
          <View className="items-center mb-8">
            <View className="w-16 h-16 bg-green-600 rounded-2xl items-center justify-center mb-4">
              <UserPlus size={32} color="#fff" />
            </View>
            <Text className="text-3xl font-bold text-slate-800">InvoiceSmart</Text>
            <Text className="text-slate-500 mt-1">Create your account</Text>
          </View>

          {error ? (
            <View className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <Text className="text-red-600 text-sm">{error}</Text>
            </View>
          ) : null}

          <View className="bg-white rounded-2xl shadow-sm p-4 mb-4">
            <View className="flex-row items-center bg-slate-50 rounded-lg px-3 mb-3">
              <User size={18} color="#64748b" />
              <TextInput
                className="flex-1 py-3 px-2 text-slate-800"
                placeholder="Full name"
                placeholderTextColor="#94a3b8"
                autoCapitalize="words"
                value={name}
                onChangeText={setName}
              />
            </View>
            <View className="flex-row items-center bg-slate-50 rounded-lg px-3 mb-3">
              <Mail size={18} color="#64748b" />
              <TextInput
                className="flex-1 py-3 px-2 text-slate-800"
                placeholder="Email address"
                placeholderTextColor="#94a3b8"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>
            <View className="flex-row items-center bg-slate-50 rounded-lg px-3">
              <Lock size={18} color="#64748b" />
              <TextInput
                className="flex-1 py-3 px-2 text-slate-800"
                placeholder="Password"
                placeholderTextColor="#94a3b8"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>
          </View>

          <TouchableOpacity
            onPress={handleRegister}
            disabled={loading}
            className="bg-green-600 rounded-xl py-4 items-center shadow-sm active:bg-green-700"
          >
            <Text className="text-white font-semibold text-base">
              {loading ? 'Creating account...' : 'Create Account'}
            </Text>
          </TouchableOpacity>

          <View className="flex-row justify-center mt-6">
            <Text className="text-slate-500">Already have an account? </Text>
            <TouchableOpacity onPress={() => router.replace('/auth/login')}>
              <Text className="text-blue-600 font-semibold">Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
