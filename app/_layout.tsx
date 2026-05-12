import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Home, FileText, BookOpen, Users, History, PieChart, Percent, ShieldCheck, MessageSquare, Settings } from 'lucide-react-native';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
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
    </>
  );
}
