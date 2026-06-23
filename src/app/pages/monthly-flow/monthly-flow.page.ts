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

  // ---- Swipe state ----
  private swStartX = 0;
  private swStartY = 0;
  private swId = '';
  private swDx: Record<string, number> = {};
  private swAnim: Record<string, boolean> = {};
  private swDirH: boolean | null = null;
  private swWasGesture = false;
  private readonly SW_THRESHOLD = 72;

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

  // ---- Swipe handlers ----

  swipeStart(ev: TouchEvent, id: string) {
    this.swStartX = ev.touches[0].clientX;
    this.swStartY = ev.touches[0].clientY;
    this.swId = id;
    this.swDirH = null;
    this.swWasGesture = false;
    this.swAnim[id] = false;
  }

  swipeMove(ev: TouchEvent) {
    const id = this.swId;
    if (!id) return;
    const dx = ev.touches[0].clientX - this.swStartX;
    const dy = ev.touches[0].clientY - this.swStartY;
    if (this.swDirH === null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      this.swDirH = Math.abs(dx) > Math.abs(dy);
    }
    if (!this.swDirH) return;
    this.swDx[id] = Math.max(-100, Math.min(100, dx));
    if (Math.abs(this.swDx[id]) > 10) this.swWasGesture = true;
  }

  swipeEnd(id: string, item: IncomeRow | Transaction, type: 'income' | 'expense') {
    const dx = this.swDx[id] || 0;
    this.swAnim[id] = true;
    this.swDx[id] = 0;
    this.swId = '';

    if (dx > this.SW_THRESHOLD) {
      setTimeout(() => {
        this.swAnim[id] = false;
        type === 'income'
          ? this.editIncome(item as IncomeRow)
          : this.editExpense(item as Transaction);
      }, 150);
    } else if (dx < -this.SW_THRESHOLD) {
      setTimeout(() => {
        this.swAnim[id] = false;
        type === 'income'
          ? this.deleteIncome(item as IncomeRow)
          : this.deleteExpense(item as Transaction);
      }, 150);
    } else {
      setTimeout(() => { this.swAnim[id] = false; }, 250);
    }
  }

  swipeX(id: string): number { return this.swDx[id] || 0; }

  swipeTrans(id: string): string {
    return this.swAnim[id] ? 'transform 0.2s ease' : 'none';
  }

  // ---- Expense click (marcar pago) — bloqueado após gesto ----

  onExpenseClick(t: Transaction) {
    if (this.swWasGesture) {
      this.swWasGesture = false;
      return;
    }
    this.toggleStatus(t);
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

  async editIncome(income: IncomeRow) {
    if (income.source !== 'manual') return;
    const a = await this.alert.create({
      header: 'Editar Receita',
      inputs: [
        { name: 'description', type: 'text',   placeholder: 'Descrição', value: income.description },
        { name: 'amount',      type: 'number', placeholder: 'Valor (R$)', value: income.amount },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Salvar',
          handler: (d) => {
            if (!d.amount) return false;
            const existing = this.fin.getIncomes().find(i => i.id === income.id);
            if (existing) {
              this.fin.updateIncome({ ...existing, description: d.description || existing.description, amount: +d.amount });
            }
            this.load();
            return true;
          },
        },
      ],
    });
    await a.present();
  }

  async deleteIncome(income: IncomeRow) {
    if (income.source !== 'manual') return;
    const a = await this.alert.create({
      header: 'Excluir Receita',
      message: `Deseja excluir "${income.description}"?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Excluir',
          role: 'destructive',
          handler: () => {
            this.fin.deleteIncome(income.id);
            this.load();
          },
        },
      ],
    });
    await a.present();
  }

  async editExpense(t: Transaction) {
    const a = await this.alert.create({
      header: 'Editar Despesa',
      inputs: [
        { name: 'amount', type: 'number', placeholder: 'Valor (R$)', value: t.amount },
        { name: 'notes',  type: 'text',   placeholder: 'Observação', value: t.notes || '' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Salvar',
          handler: (d) => {
            if (!d.amount) return false;
            this.fin.updateTransaction({ ...t, amount: +d.amount, notes: d.notes || undefined });
            this.load();
            return true;
          },
        },
      ],
    });
    await a.present();
  }

  async deleteExpense(t: Transaction) {
    const a = await this.alert.create({
      header: 'Excluir Despesa',
      message: `Deseja excluir "${t.account_name}"?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Excluir',
          role: 'destructive',
          handler: () => {
            this.fin.deleteTransaction(t.id);
            this.load();
          },
        },
      ],
    });
    await a.present();
  }

  get formattedMonth() { return this.fin.formatMonth(this.currentMonth); }
  fmt(v: number) { return this.fin.formatCurrency(v); }
}
