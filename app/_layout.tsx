import React, { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, Text } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useSegments } from 'expo-router';
import {
  Home, FileText, BookOpen, Users, History, PieChart, Percent, ShieldCheck, MessageSquare, Settings,
} from 'lucide-react-native';
import * as api from '../services/api';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        setLoading(false);
        if (segments[0] !== 'auth') {
          router.replace('/auth/login');
        }
        return;
      }
      try {
        const user = await api.getUser();
        if (user) {
          setIsAuthenticated(true);
        } else {
          await AsyncStorage.removeItem('auth_token');
          if (segments[0] !== 'auth') {
            router.replace('/auth/login');
          }
        }
      } catch {
        await AsyncStorage.removeItem('auth_token');
        if (segments[0] !== 'auth') {
          router.replace('/auth/login');
        }
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, []);

  if (loading) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <View className="w-20 h-20 bg-blue-600 rounded-2xl items-center justify-center mb-4">
          <Text className="text-white text-2xl font-bold">IS</Text>
        </View>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text className="text-slate-500 mt-4 text-sm">Loading...</Text>
      </View>
    );
  }

  if (!isAuthenticated && segments[0] !== 'auth') {
    return null;
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        <StatusBar style="auto" />
        <AuthGuard>
          <Tabs screenOptions={{ headerShown: true, tabBarActiveTintColor: '#2563eb' }}>
            <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarIcon: ({ color }) => <Home size={20} color={color} /> }} />
            <Tabs.Screen name="create" options={{ title: 'Invoice', tabBarIcon: ({ color }) => <FileText size={20} color={color} /> }} />
            <Tabs.Screen name="ledger" options={{ title: 'Ledger', tabBarIcon: ({ color }) => <BookOpen size={20} color={color} /> }} />
            <Tabs.Screen name="clients" options={{ title: 'Clients', tabBarIcon: ({ color }) => <Users size={20} color={color} /> }} />
            <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: ({ color }) => <History size={20} color={color} /> }} />
            <Tabs.Screen name="reports" options={{ title: 'Reports', tabBarIcon: ({ color }) => <PieChart size={20} color={color} /> }} />
            <Tabs.Screen name="taxes" options={{ title: 'Taxes', tabBarIcon: ({ color }) => <Percent size={20} color={color} /> }} />
            <Tabs.Screen name="audit" options={{ title: 'Audit', tabBarIcon: ({ color }) => <ShieldCheck size={20} color={color} /> }} />
            <Tabs.Screen name="ai" options={{ title: 'AI', tabBarIcon: ({ color }) => <MessageSquare size={20} color={color} /> }} />
            <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color }) => <Settings size={20} color={color} /> }} />
          </Tabs>
        </AuthGuard>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
