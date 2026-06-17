import { Component } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { FinancialService } from '../../services/financial.service';
import { Transaction } from '../../models/models';

interface IncomeRow {
  id: string;
  description: string;
  amount: number;
  source: 'manual' | 'recurring';
}

@Component({
  selector: 'app-monthly-flow',
  templateUrl: './monthly-flow.page.html',
  styleUrls: ['./monthly-flow.page.scss'],
})
export class MonthlyFlowPage {
  currentMonth = '';
  summary = { totalIncome: 0, totalExpenses: 0, totalPaid: 0, totalPending: 0, balance: 0 };
  incomes: IncomeRow[] = [];
  expenses: Transaction[] = [];

  constructor(private fin: FinancialService, private alert: AlertController) {}

  ionViewWillEnter() {
    if (!this.currentMonth) this.currentMonth = this.fin.getCurrentMonth();
    this.load();
  }

  load() {
    this.fin.ensureMonthlyRecurringTransactions(this.currentMonth);
    this.summary = this.fin.getMonthlySummary(this.currentMonth);
    const manualIncomes = this.fin.getIncomes(this.currentMonth).map(i => ({
      id: i.id,
      description: i.description,
      amount: i.amount,
      source: 'manual' as const,
    }));
    const recurringIncomes = this.fin.getTransactions(this.currentMonth)
      .filter(t => t.kind === 'income')
      .map(t => ({
        id: t.id,
        description: t.account_name || 'Receita recorrente',
        amount: t.amount,
        source: 'recurring' as const,
      }));

    this.incomes = [...manualIncomes, ...recurringIncomes];
    this.expenses = this.fin.getTransactions(this.currentMonth).filter(t => t.kind === 'expense');
  }

  shift(delta: number) {
    const [y, m] = this.currentMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    this.currentMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    this.load();
  }

  toggleStatus(t: Transaction) {
    this.fin.updateTransaction({ ...t, status: t.status === 'paid' ? 'pending' : 'paid' });
    this.load();
  }

  async addIncome() {
    const a = await this.alert.create({
      header: 'Nova Receita',
      inputs: [
        { name: 'description', type: 'text',   placeholder: 'Descrição' },
        { name: 'amount',      type: 'number', placeholder: 'Valor (R$)' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Salvar',
          handler: (d) => {
            if (!d.amount) return false;
            this.fin.saveIncome({ description: d.description || 'Receita', amount: +d.amount, month: this.currentMonth, recurring: false });
            this.load();
            return true;
          },
        },
      ],
    });
    await a.present();
  }

  deleteIncome(income: IncomeRow) {
    if (income.source !== 'manual') return;
    this.fin.deleteIncome(income.id);
    this.load();
  }

  get formattedMonth() { return this.fin.formatMonth(this.currentMonth); }
  fmt(v: number) { return this.fin.formatCurrency(v); }
}
