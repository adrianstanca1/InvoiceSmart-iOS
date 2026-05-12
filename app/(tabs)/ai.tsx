import React, { useState, useCallback, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Sparkles, Send } from 'lucide-react-native';
import { generateAIChatResponse } from '../../services/aiService';
import * as Storage from '../../lib/storage';

interface Message { role: 'user' | 'ai'; text: string; }

export default function AIScreen() {
  const [messages, setMessages] = useState<Message[]>([{ role:'ai', text:'Hello! I am your AI Accountant. Ask me anything about your finances.' }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  async function send() {
    if (!input.trim()) return;
    const userText = input;
    setMessages(prev=>[...prev, { role:'user', text:userText }]);
    setInput(''); setLoading(true);
    try {
      const [inv, clients, tx] = await Promise.all([Storage.getInvoices(), Storage.getClients(), Storage.getTransactions()]);
      const context = { totalInvoices: inv.length, totalClients: clients.length, totalTransactions: tx.length };
      const reply = await generateAIChatResponse(userText, context);
      setMessages(prev=>[...prev, { role:'ai', text: reply }]);
    } catch(e) {
      setMessages(prev=>[...prev, { role:'ai', text: 'Sorry, AI service unavailable.' }]);
    }
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS==='ios' ? 'padding' : 'height'} className="flex-1">
      <View className="flex-1 bg-slate-50">
        <View className="flex-row items-center p-4 bg-white border-b border-slate-200">
          <Sparkles size={20} color="#2563eb" /><Text className="ml-2 font-bold text-slate-800">AI Accountant</Text>
        </View>
        <ScrollView ref={scrollRef} className="flex-1 p-4" onContentSizeChange={()=>scrollRef.current?.scrollToEnd({animated:true})}>
          {messages.map((m, idx)=>(
            <View key={idx} className={`mb-3 p-3 rounded-xl max-w-[85%] ${m.role==='user' ? 'bg-blue-600 self-end' : 'bg-white self-start border border-slate-200'}`}>
              <Text className={m.role==='user' ? 'text-white' : 'text-slate-800'}>{m.text}</Text>
            </View>
          ))}
          {loading && <Text className="text-slate-400 self-start mb-2">Thinking...</Text>}
        </ScrollView>
        <View className="flex-row p-4 bg-white border-t border-slate-200 gap-2">
          <TextInput value={input} onChangeText={setInput} placeholder="Ask about your finances..." multiline className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-slate-800" />
          <TouchableOpacity onPress={send} disabled={loading} className="bg-blue-600 rounded-lg px-4 items-center justify-center">
            <Send size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
