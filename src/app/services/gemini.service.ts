import { Injectable } from '@angular/core';
import { FinancialService } from './financial.service';
import { UserService } from './user.service';

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

interface UsageRecord {
  date: string;
  daily: number;
  minuteTs: number[];
}

export const DAILY_LIMIT = 1500;
export const MINUTE_LIMIT = 15;

const MODEL = 'gemini-3.1-flash-lite';
const USAGE_KEY = 'mcf_gemini_usage';

@Injectable({ providedIn: 'root' })
export class GeminiService {
  private apiHistory: Array<{ role: string; parts: Array<{ text: string }> }> = [];

  constructor(
    private fin: FinancialService,
    private user: UserService,
  ) {}

  get token(): string { return this.user.prefs.geminiToken ?? ''; }
  get hasToken(): boolean { return !!this.token.trim(); }

  getUsage() {
    const rec = this.loadUsage();
    const now = Date.now();
    const minuteUsed = rec.minuteTs.filter(t => t > now - 60_000).length;
    return {
      dailyUsed: rec.daily,
      dailyRemaining: Math.max(0, DAILY_LIMIT - rec.daily),
      minuteUsed,
      minuteRemaining: Math.max(0, MINUTE_LIMIT - minuteUsed),
    };
  }

  private loadUsage(): UsageRecord {
    const today = new Date().toISOString().slice(0, 10);
    try {
      const raw = localStorage.getItem(USAGE_KEY);
      if (raw) {
        const rec: UsageRecord = JSON.parse(raw);
        if (rec.date === today) return rec;
      }
    } catch {}
    return { date: today, daily: 0, minuteTs: [] };
  }

  private recordRequest(): void {
    const rec = this.loadUsage();
    rec.daily += 1;
    const now = Date.now();
    rec.minuteTs = [...rec.minuteTs.filter(t => t > now - 60_000), now];
    try { localStorage.setItem(USAGE_KEY, JSON.stringify(rec)); } catch {}
  }

  buildFinancialContext(): string {
    const month = this.fin.getCurrentMonth();
    const summary = this.fin.getMonthlySummary(month);
    const accounts = this.fin.getAccounts();
    const debts = this.fin.getDebts();
    const incomes = this.fin.getIncomes();
    const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

    const parts: string[] = [
      `=== Cenário financeiro: ${this.fin.formatMonth(month)} ===`,
      `Receita: ${fmt(summary.totalIncome)} | Despesas: ${fmt(summary.totalExpenses)} | Saldo: ${fmt(summary.balance)}`,
      `Pago: ${fmt(summary.totalPaid)} | Pendente: ${fmt(summary.totalPending)}`,
    ];

    if (accounts.length) {
      parts.push(`\nDespesas/contas (${accounts.length}):`);
      accounts.slice(0, 12).forEach(a =>
        parts.push(`  - ${a.name}: ${a.default_amount ? fmt(a.default_amount) : 'valor variável'}${a.category ? ` [${a.category}]` : ''}`));
    }

    if (debts.length) {
      parts.push(`\nDívidas (${debts.length}):`);
      debts.slice(0, 6).forEach(d =>
        parts.push(`  - ${d.account_name ?? d.account_id}: saldo ${fmt(d.current_balance)}, parcela ${fmt(d.installment_amount)}, ${d.remaining_installments} restantes`));
    }

    if (incomes.length) {
      parts.push(`\nReceitas recorrentes (${incomes.length}):`);
      incomes.slice(0, 5).forEach(i =>
        parts.push(`  - ${i.description}: ${fmt(i.amount)}`));
    }

    return parts.join('\n');
  }

  async sendMessage(userText: string): Promise<string> {
    if (!this.hasToken) throw new Error('Token não configurado');

    const usage = this.getUsage();
    if (usage.dailyRemaining === 0)
      throw new Error('Limite diário atingido (1.500 req/dia no plano gratuito).');
    if (usage.minuteRemaining === 0)
      throw new Error('Muitas requisições! Aguarde alguns segundos e tente novamente.');

    const systemPrompt = `Você é "Finn", assistente financeiro pessoal do usuário. Responda SEMPRE em português do Brasil. Seja objetivo, empático e prático. Use os dados financeiros abaixo para dar conselhos personalizados. Não invente números que não estão no contexto.\n\n${this.buildFinancialContext()}`;

    this.apiHistory.push({ role: 'user', parts: [{ text: userText }] });

    const body = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: this.apiHistory,
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${this.token}`;

    let resp: Response;
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      this.apiHistory.pop();
      throw new Error('Sem conexão com a internet. Verifique sua rede.');
    }

    if (!resp.ok) {
      this.apiHistory.pop();
      const err = await resp.json().catch(() => ({}));
      if (resp.status === 400) throw new Error('Token inválido. Verifique o token no Perfil.');
      if (resp.status === 403) throw new Error('Sem permissão. Verifique se a API Generative Language está ativada.');
      if (resp.status === 429) throw new Error('Quota esgotada na API do Google. Tente novamente em breve.');
      throw new Error(err?.error?.message ?? `Erro ${resp.status}`);
    }

    const data = await resp.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '(sem resposta)';
    this.apiHistory.push({ role: 'model', parts: [{ text }] });
    this.recordRequest();
    return text;
  }

  clearHistory(): void {
    this.apiHistory = [];
  }
}
