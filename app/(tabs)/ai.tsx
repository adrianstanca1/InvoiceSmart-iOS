import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Sparkles, Send, TrendingUp, DollarSign, Receipt } from 'lucide-react-native';
import { chatWithAI, getInvoices, getTransactions, getClients } from '../../services/api';
import { Invoice, Transaction, Client } from '../../types';

interface Message { role: 'user' | 'ai'; text: string; }

export default function AIScreen() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: 'Hello! I am your AI Accountant. Ask me anything about your finances.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [ctxLoading, setCtxLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const [context, setContext] = useState({ totalInvoices: 0, totalClients: 0, totalTransactions: 0, totalOwed: 0, totalRevenue: 0 });

  const loadContext = useCallback(async () => {
    setCtxLoading(true);
    try {
      const [invRes, clientsRes, txRes] = await Promise.all([
        getInvoices(),
        getClients(),
        getTransactions(),
      ]);
      const inv = invRes.data || [];
      const clients = (clientsRes as any).data || [];
      const tx = (txRes as any).data || [];
      const totalRevenue = inv.reduce((s: number, i: Invoice) => s + (i.lineItems || []).reduce((a: number, li: any) => a + (li.quantity || 0) * (li.rate || 0), 0), 0);
      const totalOwed = inv
        .filter((i: Invoice) => i.status !== 'Paid')
        .reduce((s: number, i: Invoice) => s + (i.lineItems || []).reduce((a: number, li: any) => a + (li.quantity || 0) * (li.rate || 0), 0), 0);
      setContext({
        totalInvoices: inv.length,
        totalClients: clients.length,
        totalTransactions: tx.length,
        totalOwed,
        totalRevenue,
      });
    } catch (e: any) {
      // silent
    } finally {
      setCtxLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadContext(); }, [loadContext]));

  async function send(textOverride?: string) {
    const userText = textOverride !== undefined ? textOverride : input;
    if (!userText.trim()) return;
    const nextMessages: Message[] = [...messages, { role: 'user' as const, text: userText }];
    if (!textOverride) setInput('');
    setMessages(nextMessages);
    setLoading(true);
    try {
      const prompt = `Context: ${JSON.stringify(context)}\n\nUser messages: ${nextMessages.map(m => m.role + ': ' + m.text).join('\n')}\nRespond as an accountant.`;
      const reply = await chatWithAI(prompt);
      setMessages((prev: Message[]) => [...prev, { role: 'ai' as const, text: reply }]);
    } catch (e: any) {
      setMessages((prev: Message[]) => [...prev, { role: 'ai' as const, text: 'Sorry, AI service unavailable. Please check connection or try again later.' }]);
    } finally {
      setLoading(false);
    }
  }

  const quickActions = [
    { label: 'Summarize my P&L', icon: <TrendingUp size={14} color="#2563eb" />, prompt: 'Summarize my profit and loss based on the current invoice and transaction data.' },
    { label: 'Who owes me money?', icon: <DollarSign size={14} color="#2563eb" />, prompt: 'Which clients have unpaid invoices and how much is owed in total?' },
    { label: 'Tax advice', icon: <Receipt size={14} color="#2563eb" />, prompt: 'What tax considerations should I be aware of based on my current revenue and expenses?' },
  ];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
      <View className="flex-1 bg-slate-50">
        <View className="flex-row items-center p-4 bg-white border-b border-slate-200">
          <Sparkles size={20} color="#2563eb" />
          <Text className="ml-2 font-bold text-slate-800">AI Accountant</Text>
          {ctxLoading && <ActivityIndicator size="small" color="#2563eb" className="ml-2" />}
        </View>

        <ScrollView ref={scrollRef} className="flex-1 p-4" onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
          <View className="flex-row flex-wrap gap-2 mb-4">
            {quickActions.map(a => (
              <TouchableOpacity key={a.label} onPress={() => send(a.prompt)} className="bg-blue-50 border border-blue-100 rounded-full px-3 py-2 flex-row items-center">
                {a.icon}
                <Text className="text-blue-700 text-xs font-medium ml-1">{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {messages.map((m, idx) => (
            <View key={idx} className={`mb-3 p-3 rounded-xl max-w-[85%] ${m.role === 'user' ? 'bg-blue-600 self-end' : 'bg-white self-start border border-slate-200'}`}>
              <Text className={m.role === 'user' ? 'text-white' : 'text-slate-800'}>{m.text}</Text>
            </View>
          ))}

          {loading && (
            <View className="self-start mb-2 flex-row items-center">
              <ActivityIndicator size="small" color="#2563eb" />
              <Text className="text-slate-400 ml-2">AI is thinking...</Text>
            </View>
          )}
        </ScrollView>

        <View className="flex-row p-4 bg-white border-t border-slate-200 gap-2">
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask about your finances..."
            multiline
            className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-slate-800"
          />
          <TouchableOpacity onPress={() => send()} disabled={loading} className="bg-blue-600 rounded-lg px-4 items-center justify-center">
            <Send size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
