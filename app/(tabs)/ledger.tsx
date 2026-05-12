import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Plus, Trash2, Save } from 'lucide-react-native';
import * as Storage from '../../lib/storage';
import { Transaction, Invoice } from '../../types';

export default function LedgerScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Transaction>>({ date: new Date().toISOString().split('T')[0], description:'', amount:0, type:'Expense', category:'' });

  useFocusEffect(useCallback(() => { load(); }, []));
  async function load() { const t = await Storage.getTransactions(); setTransactions(t); }

  async function saveTx() {
    if (!form.description) { Alert.alert('Error','Description required'); return; }
    const list = await Storage.getTransactions();
    list.unshift({ ...form, id: Date.now().toString(36), amount: Number(form.amount)||0 } as Transaction);
    await Storage.saveTransactions(list); setEditing(false); load();
  }

  async function deleteTx(id: string) {
    const list = (await Storage.getTransactions()).filter(t=>t.id !== id);
    await Storage.saveTransactions(list); load();
  }

  const totalIncome = transactions.filter(t=>t.type==='Income').reduce((s,t)=>s+t.amount,0);
  const totalExpense = transactions.filter(t=>t.type==='Expense').reduce((s,t)=>s+t.amount,0);

  return (
    <ScrollView className="flex-1 bg-slate-50 p-4">
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-2xl font-bold text-slate-800">Ledger</Text>
        <TouchableOpacity onPress={() => { setForm({ date:new Date().toISOString().split('T')[0], description:'', amount:0, type:'Expense', category:'' }); setEditing(true); }} className="bg-blue-600 rounded-lg p-2"><Plus size={20} color="#fff" /></TouchableOpacity>
      </View>
      <View className="flex-row justify-between bg-white rounded-xl p-4 shadow-sm mb-4">
        <View><Text className="text-slate-500 text-sm">Income</Text><Text className="text-green-600 font-bold text-lg">${totalIncome.toFixed(2)}</Text></View>
        <View><Text className="text-slate-500 text-sm">Expenses</Text><Text className="text-red-600 font-bold text-lg">${totalExpense.toFixed(2)}</Text></View>
        <View><Text className="text-slate-500 text-sm">Net</Text><Text className="font-bold text-lg text-slate-800">${(totalIncome - totalExpense).toFixed(2)}</Text></View>
      </View>
      {editing && (
        <View className="bg-white rounded-xl p-4 shadow-sm mb-3">
          <TextInput placeholder="Description" value={form.description} onChangeText={t=>setForm({...form,description:t})} className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" />
          <View className="flex-row gap-2 mb-2">
            <TextInput placeholder="Amount" value={String(form.amount)} onChangeText={t=>setForm({...form,amount:parseFloat(t)||0})} keyboardType="numeric" className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-slate-800" />
            <TouchableOpacity onPress={()=>setForm({...form,type:form.type==='Income'?'Expense':'Income'})} className="px-3 py-2 bg-slate-100 rounded-lg"><Text className="font-medium">{form.type}</Text></TouchableOpacity>
          </View>
          <TextInput placeholder="Category" value={form.category} onChangeText={t=>setForm({...form,category:t})} className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-800" />
          <View className="flex-row gap-2">
            <TouchableOpacity onPress={saveTx} className="flex-1 bg-blue-600 rounded-lg p-3 items-center"><Text className="text-white font-medium">Save</Text></TouchableOpacity>
            <TouchableOpacity onPress={()=>setEditing(false)} className="flex-1 bg-slate-200 rounded-lg p-3 items-center"><Text className="text-slate-700">Cancel</Text></TouchableOpacity>
          </View>
        </View>
      )}
      {transactions.map(tx=>(
        <View key={tx.id} className="bg-white rounded-xl p-4 shadow-sm mb-3 flex-row justify-between items-center">
          <View className="flex-1">
            <Text className="font-bold text-slate-800">{tx.description}</Text>
            <Text className="text-slate-500 text-sm">{tx.date} | {tx.category}</Text>
          </View>
          <View className="items-end">
            <Text className={`font-bold ${tx.type==='Income'?'text-green-600':'text-red-600'}`}>{tx.type==='Income'?'+':'-'}${tx.amount.toFixed(2)}</Text>
            <TouchableOpacity onPress={()=>deleteTx(tx.id)} className="mt-1"><Trash2 size={16} color="#dc2626" /></TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
