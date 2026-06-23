import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ActionSheetController, AlertController, ToastController } from '@ionic/angular';
import { CdkDragEnd } from '@angular/cdk/drag-drop';
import { FinancialService } from '../../services/financial.service';
import { Account, FinancialAccount, Income, Transaction } from '../../models/models';

export interface IncomeRow {
  id: string;
  description: string;
  amount: number;
  source: 'manual' | 'recurring';
  status?: 'paid' | 'pending';
  transaction?: Transaction;
}

interface RecurringFormData {
  name?: string;
  default_amount?: string | number;
  due_day?: string | number;
  category?: string;
}

@Component({
  selector: 'app-finances',
  templateUrl: './finances.page.html',
  styleUrls: ['./finances.page.scss'],
})
export class FinancesPage {
  currentMonth = '';
  summary = { totalIncome: 0, totalExpenses: 0, totalPaid: 0, totalPending: 0, balance: 0 };
  incomes: IncomeRow[] = [];
  expenses: Transaction[] = [];
  private financialAccounts: FinancialAccount[] = [];

  readonly SWIPE_THRESHOLD = 70;

  constructor(
    private fin: FinancialService,
    private alert: AlertController,
    private actionSheet: ActionSheetController,
    private toast: ToastController,
    private router: Router,
  ) {}

  ionViewWillEnter() {
    if (!this.currentMonth) this.currentMonth = this.fin.getCurrentMonth();
    this.load();
  }

  load() {
    this.fin.ensureMonthlyRecurringTransactions(this.currentMonth);
    this.summary = this.fin.getMonthlySummary(this.currentMonth);
    this.financialAccounts = this.fin.getFinancialAccounts().filter(a => a.active);

    const manualIncomes = this.fin.getIncomes(this.currentMonth).map(i => ({
      id: i.id,
      description: i.description,
      amount: i.amount,
      source: 'manual' as const,
      status: 'paid' as const,
    }));

    const recurringIncomes = this.fin.getTransactions(this.currentMonth)
      .filter(t => t.kind === 'income')
      .map(t => ({
        id: t.id,
        description: t.account_name || 'Receita recorrente',
        amount: t.amount,
        source: 'recurring' as const,
        status: t.status,
        transaction: t,
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

  onIncomeDragEnded(event: CdkDragEnd, income: IncomeRow) {
    const x = event.distance.x;
    event.source.reset();
    if (income.source !== 'manual') return;
    if (x > this.SWIPE_THRESHOLD) void this.editManualIncome(income);
    else if (x < -this.SWIPE_THRESHOLD) this.deleteManualIncome(income);
  }

  onExpenseDragEnded(event: CdkDragEnd, t: Transaction) {
    const x = event.distance.x;
    event.source.reset();
    if (x > this.SWIPE_THRESHOLD) void this.editExpense(t);
    else if (x < -this.SWIPE_THRESHOLD) void this.deleteExpense(t);
  }

  toggleExpense(t: Transaction) {
    this.fin.updateTransaction({ ...t, status: t.status === 'paid' ? 'pending' : 'paid' });
    this.load();
  }

  toggleIncome(row: IncomeRow) {
    if (!row.transaction) return;
    this.fin.updateTransaction({ ...row.transaction, status: row.transaction.status === 'paid' ? 'pending' : 'paid' });
    this.load();
  }

  deleteManualIncome(income: IncomeRow) {
    if (income.source !== 'manual') return;
    this.fin.deleteIncome(income.id);
    this.load();
  }

  async editManualIncome(income: IncomeRow) {
    if (income.source !== 'manual') return;
    const a = await this.alert.create({
      header: 'Editar receita',
      inputs: [
        { name: 'description', type: 'text', placeholder: 'Descrição', value: income.description },
        { name: 'amount', type: 'number', placeholder: 'Valor (R$)', value: income.amount.toString() },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Salvar',
          handler: (d: { description: string; amount: string }) => {
            if (!d.description?.trim() || !Number(d.amount || 0)) return false;
            this.fin.updateIncome({
              id: income.id,
              month: this.currentMonth,
              description: d.description.trim(),
              amount: Number(d.amount),
              recurring: false,
            } as Income);
            this.load();
            return true;
          },
        },
      ],
    });
    await a.present();
  }

  async editExpense(t: Transaction) {
    const a = await this.alert.create({
      header: t.account_name || 'Editar despesa',
      inputs: [
        { name: 'amount', type: 'number', placeholder: 'Valor (R$)', value: t.amount.toString() },
        { name: 'notes', type: 'text', placeholder: 'Observação', value: t.notes ?? '' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Salvar',
          handler: (d: { amount: string; notes: string }) => {
            if (!Number(d.amount || 0)) return false;
            this.fin.updateTransaction({ ...t, amount: Number(d.amount), notes: d.notes || undefined });
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
      header: 'Remover lançamento',
      message: `Remover "${t.account_name}" de ${this.formattedMonth}?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Remover',
          role: 'destructive',
          handler: () => { this.fin.deleteTransaction(t.id); this.load(); },
        },
      ],
    });
    await a.present();
  }

  // ── FAB "+" ────────────────────────────────────────────────

  async openAddMenu() {
    const sheet = await this.actionSheet.create({
      header: 'O que deseja adicionar?',
      buttons: [
        {
          text: 'Receita',
          icon: 'cash-outline',
          handler: () => { void this.addRecurringAccount('income'); },
        },
        {
          text: 'Despesa',
          icon: 'card-outline',
          handler: () => { void this.pickExpenseType(); },
        },
        {
          text: 'Conta recorrente',
          icon: 'albums-outline',
          handler: () => { void this.pickAccountType(); },
        },
        {
          text: 'Cancelar',
          icon: 'close-outline',
          role: 'cancel',
        },
      ],
    });
    await sheet.present();
  }

  async pickExpenseType() {
    const a = await this.alert.create({
      header: 'Tipo de despesa',
      inputs: [
        { type: 'radio', label: 'Despesa fixa',    value: 'fixed',       checked: true },
        { type: 'radio', label: 'Cartão',           value: 'card' },
        { type: 'radio', label: 'Parcelamento',     value: 'installment' },
        { type: 'radio', label: 'Empréstimo',       value: 'loan' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Próximo',
          handler: (type: Account['type']) => { void this.addRecurringAccount(type); },
        },
      ],
    });
    await a.present();
  }

  async pickAccountType() {
    const a = await this.alert.create({
      header: 'Tipo de conta',
      inputs: [
        { type: 'radio', label: 'Receita recorrente', value: 'income',      checked: true },
        { type: 'radio', label: 'Despesa fixa',        value: 'fixed' },
        { type: 'radio', label: 'Cartão',              value: 'card' },
        { type: 'radio', label: 'Parcelamento',        value: 'installment' },
        { type: 'radio', label: 'Empréstimo',          value: 'loan' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Próximo',
          handler: (type: Account['type']) => { void this.addRecurringAccount(type); },
        },
      ],
    });
    await a.present();
  }

  async addRecurringAccount(type: Account['type']) {
    const isIncome = type === 'income';
    const a = await this.alert.create({
      header: isIncome ? 'Nova receita' : 'Nova despesa',
      inputs: [
        {
          name: 'name',
          type: 'text',
          placeholder: isIncome ? 'Ex: Salário, aluguel recebido' : 'Ex: Aluguel, energia, internet',
        },
        { name: 'default_amount', type: 'number', placeholder: 'Valor (R$)' },
        { name: 'due_day',        type: 'number', placeholder: isIncome ? 'Dia de recebimento (opcional)' : 'Dia de vencimento (opcional)' },
        { name: 'category',       type: 'text',   placeholder: 'Categoria (opcional)' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Salvar',
          handler: (d: RecurringFormData) => {
            if (!d.name?.trim() || !Number(d.default_amount || 0)) return false;
            const account = this.fin.saveAccount({
              name: d.name.trim(),
              type,
              default_amount: Number(d.default_amount || 0),
              due_day: d.due_day ? Number(d.due_day) : undefined,
              category: d.category?.trim() || undefined,
              active: true,
            });
            this.fin.ensureMonthlyRecurringTransactions(this.currentMonth);
            this.load();
            if (this.financialAccounts.length) void this.pickFinancialAccountForRecurring(account);
            return true;
          },
        },
      ],
    });
    await a.present();
  }

  async pickFinancialAccountForRecurring(account: Account) {
    if (!this.financialAccounts.length) return;
    const a = await this.alert.create({
      header: 'Conta vinculada',
      message: `Onde "${account.name}" movimenta?`,
      inputs: [
        { type: 'radio', label: 'Nenhuma', value: '', checked: !account.financial_account_id },
        ...this.financialAccounts.map(fa => ({
          type: 'radio' as const,
          label: fa.name,
          value: fa.id,
          checked: account.financial_account_id === fa.id,
        })),
      ],
      buttons: [
        { text: 'Depois', role: 'cancel' },
        {
          text: 'Salvar',
          handler: (financialAccountId: string) => {
            const existing = this.fin.getTransactions(this.currentMonth)
              .find(t => t.account_id === account.id);
            this.fin.updateAccount({ ...account, financial_account_id: financialAccountId || undefined });
            if (existing) {
              this.fin.updateTransaction({ ...existing, financial_account_id: financialAccountId || undefined });
            }
            this.load();
          },
        },
      ],
    });
    await a.present();
  }

  goToAccounts() {
    this.router.navigate(['/tabs/accounts']);
  }

  get formattedMonth() { return this.fin.formatMonth(this.currentMonth); }
  fmt(v: number) { return this.fin.formatCurrency(v); }
}
