import { Invoice, InvoiceAuditResult, FinancialInsight, FinancialReport } from '../types';

const OLLAMA_URL = 'http://127.0.0.1:11434/api/generate';

async function ollamaGenerate(prompt: string, model: string = 'qwen2.5:7b'): Promise<string> {
  const res = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false }),
  });
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
  const data = await res.json();
  return data.response || '';
}

function cleanJson(text: string): string {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : text;
}

export async function generateInvoiceFromPrompt(prompt: string, model?: string): Promise<Partial<Invoice>> {
  const systemPrompt = `You are InvoiceBot. Given a user prompt describing work or services, generate a JSON object with keys: fromName (string), toName (string), toAddress (string), lineItems (array of {description, quantity, rate}), notes (string), terms (string). Output ONLY JSON.`;
  const response = await ollamaGenerate(`${systemPrompt}\n\nPrompt: ${prompt}\n\nJSON:`, model);
  try {
    const parsed = JSON.parse(cleanJson(response));
    return parsed;
  } catch {
    return { fromName: '', toName: '', notes: 'AI generation failed', lineItems: [] };
  }
}

export async function auditInvoice(invoice: Invoice, model?: string): Promise<InvoiceAuditResult> {
  const prompt = `Audit this invoice and return JSON with arrays: taxCompliance (strings), cisVatImplications (strings), lineItemSuggestions (array of {id, issue, suggestedDescription}), generalFeedback (strings).\n\nInvoice: ${JSON.stringify(invoice)}`;
  try {
    const res = await ollamaGenerate(prompt, model);
    return JSON.parse(cleanJson(res));
  } catch {
    return { taxCompliance: [], cisVatImplications: [], lineItemSuggestions: [], generalFeedback: ['Audit unavailable'] };
  }
}

export async function parseReceiptFromImage(base64Image: string, model?: string): Promise<Partial<Invoice> & { rawText?: string }> {
  const prompt = `Extract receipt details from the provided image. Return JSON with keys: fromName, toName, date, lineItems (array of {description, quantity, rate}), total, rawText (transcribed text). Output ONLY JSON.`;
  const res = await ollamaGenerate(`${prompt}\n\n[Image data omitted for brevity - in real implementation use vision model]`, model);
  try {
    const parsed = JSON.parse(cleanJson(res));
    return parsed;
  } catch {
    return { rawText: res };
  }
}

export async function generateFinancialInsights(invoices: Invoice[], transactions: any[], taxRules: any[], model?: string): Promise<FinancialInsight> {
  const prompt = `Analyze these invoices and transactions. Return JSON with: summary (string), recommendations (array of {type, title, description, actionableStep}), riskAssessment (string).\nInvoices: ${JSON.stringify(invoices.slice(0, 10))}\nTransactions: ${JSON.stringify(transactions.slice(0, 10))}`;
  try {
    const res = await ollamaGenerate(prompt, model);
    return JSON.parse(cleanJson(res));
  } catch {
    return { summary: 'Analysis unavailable', recommendations: [], riskAssessment: 'Unknown' };
  }
}

export async function chatWithAccountant(messages: { role: 'user' | 'ai'; text: string }[], context: any, model?: string): Promise<string> {
  const history = messages.map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.text}`).join('\n');
  const prompt = `You are an expert accountant assistant for UK contractors. Context: ${JSON.stringify(context)}\n\n${history}\n\nAI:`;
  return await ollamaGenerate(prompt, model);
}

export async function generateDetailedReport(transactions: any[], invoices: any[], model?: string): Promise<FinancialReport> {
  const prompt = `Generate a financial P&L report from this data. Return JSON with: generatedDate, period, profitAndLoss (revenue, costOfSales, grossProfit, expenses array, totalExpenses, netProfit), insights (string array).\nData: ${JSON.stringify({ transactions: transactions.slice(0, 20), invoices: invoices.slice(0, 20) })}`;
  try {
    const res = await ollamaGenerate(prompt, model);
    return JSON.parse(cleanJson(res));
  } catch {
    return {
      generatedDate: new Date().toISOString(),
      period: 'Current',
      profitAndLoss: { revenue: 0, costOfSales: 0, grossProfit: 0, expenses: [], totalExpenses: 0, netProfit: 0 },
      insights: ['Report generation failed'],
    };
  }
}

export async function generateAIChatResponse(input: string, context: any, model?: string): Promise<string> {
  const prompt = `You are an AI Accountant. Given this context about invoices, clients and transactions: ${JSON.stringify(context)}\n\nUser asks: ${input}\n\nAnswer concisely with actionable financial advice where possible.`;
  return await ollamaGenerate(prompt, model);
}
