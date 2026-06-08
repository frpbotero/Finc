import { Component } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { FinancialService } from '../../services/financial.service';
import { Income, Transaction } from '../../models/models';

@Component({
  selector: 'app-monthly-flow',
  templateUrl: './monthly-flow.page.html',
  styleUrls: ['./monthly-flow.page.scss'],
})
export class MonthlyFlowPage {
  currentMonth = '';
  summary = { totalIncome: 0, totalExpenses: 0, totalPaid: 0, totalPending: 0, balance: 0 };
  incomes: Income[] = [];
  expenses: any[] = [];

  constructor(private fin: FinancialService, private alert: AlertController) {}

  ionViewWillEnter() {
    if (!this.currentMonth) this.currentMonth = this.fin.getCurrentMonth();
    this.load();
  }

  load() {
    this.summary = this.fin.getMonthlySummary(this.currentMonth);
    this.incomes = this.fin.getIncomes(this.currentMonth);
    const accounts = this.fin.getAccounts();
    this.expenses = this.fin.getTransactions(this.currentMonth)
      .filter(t => t.kind === 'expense')
      .map(t => ({ ...t, account_name: accounts.find(a => a.id === t.account_id)?.name ?? '' }));
  }

  shift(delta: number) {
    const [y, m] = this.currentMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    this.currentMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    this.load();
  }

  toggleStatus(t: Transaction & { account_name: string }) {
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

  deleteIncome(id: string) { this.fin.deleteIncome(id); this.load(); }

  get formattedMonth() { return this.fin.formatMonth(this.currentMonth); }
  fmt(v: number) { return this.fin.formatCurrency(v); }
}
