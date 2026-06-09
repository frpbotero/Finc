import { Component } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { FinancialService } from '../../services/financial.service';
import { Account, FinancialAccount, Transaction } from '../../models/models';

interface AccountGroup {
  label: string;
  type: Account['type'];
  icon: string;
  items: Account[];
}

interface RecurringFormData {
  name?: string;
  amount?: string | number;
  default_amount?: string | number;
  due_day?: string | number;
  category?: string;
  notes?: string;
}

interface FinancialAccountFormData {
  name?: string;
  opening_balance?: string | number;
}

@Component({
  selector: 'app-accounts',
  templateUrl: './accounts.page.html',
  styleUrls: ['./accounts.page.scss'],
})
export class AccountsPage {
  currentMonth = '';
  financialAccounts: FinancialAccount[] = [];
  groupedAccounts: AccountGroup[] = [];
  transactions: Transaction[] = [];

  private readonly GROUPS: Omit<AccountGroup, 'items'>[] = [
    { label: 'Receitas recorrentes', type: 'income', icon: 'cash-outline' },
    { label: 'Despesas fixas', type: 'fixed', icon: 'home-outline' },
    { label: 'Cartões', type: 'card', icon: 'card-outline' },
    { label: 'Empréstimos', type: 'loan', icon: 'wallet-outline' },
    { label: 'Parcelamentos', type: 'installment', icon: 'pricetag-outline' },
  ];

  constructor(private fin: FinancialService, private alert: AlertController) {}

  ionViewWillEnter() {
    this.currentMonth = this.fin.getCurrentMonth();
    this.load();
  }

  load() {
    this.fin.ensureMonthlyRecurringTransactions(this.currentMonth);
    const accounts = this.fin.getAccounts();
    this.financialAccounts = this.fin.getFinancialAccounts().filter(a => a.active);
    this.transactions = this.fin.getTransactions(this.currentMonth);
    this.groupedAccounts = this.GROUPS
      .map(g => ({ ...g, items: accounts.filter(a => a.type === g.type && a.active) }))
      .filter(g => g.items.length > 0);
  }

  getTx(accountId: string): Transaction | undefined {
    return this.transactions.find(t => t.account_id === accountId);
  }

  getAmount(accountId: string): number { return this.getTx(accountId)?.amount ?? 0; }
  getStatus(accountId: string): string { return this.getTx(accountId)?.status ?? ''; }
  getFinancialAccountName(accountId?: string): string {
    if (!accountId) return 'Sem conta vinculada';
    return this.financialAccounts.find(a => a.id === accountId)?.name || 'Conta removida';
  }

  fmt(v: number) { return this.fin.formatCurrency(v); }

  async addFinancialAccount(type: FinancialAccount['type'] = 'checking') {
    const a = await this.alert.create({
      header: 'Nova conta financeira',
      inputs: [
        { name: 'name', type: 'text', placeholder: 'Nome: Nubank, Inter, Dinheiro' },
        { name: 'opening_balance', type: 'number', placeholder: 'Saldo inicial (opcional)' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Salvar',
          handler: (d: FinancialAccountFormData) => {
            if (!d.name?.trim()) return false;
            this.fin.saveFinancialAccount({
              name: d.name.trim(),
              type,
              opening_balance: Number(d.opening_balance || 0),
              active: true,
            });
            this.load();
            return true;
          },
        },
      ],
    });
    await a.present();
  }

  async pickFinancialAccountType() {
    const a = await this.alert.create({
      header: 'Tipo de conta financeira',
      inputs: [
        { type: 'radio', label: 'Conta corrente', value: 'checking', checked: true },
        { type: 'radio', label: 'Poupança', value: 'savings' },
        { type: 'radio', label: 'Carteira digital', value: 'wallet' },
        { type: 'radio', label: 'Dinheiro', value: 'cash' },
        { type: 'radio', label: 'Investimento', value: 'investment' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Próximo',
          handler: (type: FinancialAccount['type']) => {
            void this.addFinancialAccount(type);
          },
        },
      ],
    });
    await a.present();
  }

  async addRecurringAccount(type: Account['type']) {
    const header = type === 'income' ? 'Receita recorrente' : 'Novo lançamento recorrente';
    const a = await this.alert.create({
      header,
      inputs: [
        { name: 'name', type: 'text', placeholder: type === 'income' ? 'Ex: Salário' : 'Ex: Aluguel, energia, internet' },
        { name: 'default_amount', type: 'number', placeholder: 'Valor padrão (R$)' },
        { name: 'due_day', type: 'number', placeholder: 'Dia de vencimento (opcional)' },
        { name: 'category', type: 'text', placeholder: 'Categoria (opcional)' },
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

  async pickDebtType() {
    const a = await this.alert.create({
      header: 'Cartão ou dívida',
      inputs: [
        { type: 'radio', label: 'Cartão', value: 'card', checked: true },
        { type: 'radio', label: 'Empréstimo', value: 'loan' },
        { type: 'radio', label: 'Parcelamento', value: 'installment' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Próximo',
          handler: (type: Account['type']) => {
            void this.addRecurringAccount(type);
          },
        },
      ],
    });
    await a.present();
  }

  async pickFinancialAccountForRecurring(account: Account) {
    const financialAccounts = this.fin.getFinancialAccounts().filter(a => a.active);
    if (!financialAccounts.length) return;

    const a = await this.alert.create({
      header: 'Conta vinculada',
      message: `Onde "${account.name}" normalmente entra ou sai?`,
      inputs: [
        { type: 'radio', label: 'Nenhuma', value: '', checked: !account.financial_account_id },
        ...financialAccounts.map(fa => ({
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
            this.fin.updateAccount({
              ...account,
              financial_account_id: financialAccountId || undefined,
            });
            const existing = this.getTx(account.id);
            if (existing) {
              this.fin.updateTransaction({
                ...existing,
                financial_account_id: financialAccountId || undefined,
              });
            }
            this.load();
          },
        },
      ],
    });
    await a.present();
  }

  async editTx(account: Account) {
    const existing = this.getTx(account.id);
    const a = await this.alert.create({
      header: account.name,
      inputs: [
        { name: 'amount', type: 'number', placeholder: 'Valor (R$)', value: existing?.amount?.toString() ?? account.default_amount?.toString() ?? '' },
        { name: 'notes', type: 'text', placeholder: 'Observação', value: existing?.notes ?? '' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Salvar',
          handler: (d: RecurringFormData) => {
            if (!Number(d.amount || 0)) return false;
            if (existing) {
              this.fin.updateTransaction({ ...existing, amount: Number(d.amount || 0), notes: d.notes });
            } else {
              this.fin.saveTransaction({
                account_id: account.id,
                financial_account_id: account.financial_account_id,
                month: this.currentMonth,
                amount: Number(d.amount || 0),
                status: account.type === 'income' ? 'paid' : 'pending',
                kind: account.type === 'income' ? 'income' : 'expense',
                notes: d.notes,
              });
            }
            this.load();
            return true;
          },
        },
      ],
    });
    await a.present();
  }

  togglePaid(account: Account) {
    const t = this.getTx(account.id);
    if (!t) return;
    this.fin.updateTransaction({ ...t, status: t.status === 'paid' ? 'pending' : 'paid' });
    this.load();
  }

  async deleteAccount(account: Account) {
    const a = await this.alert.create({
      header: 'Remover recorrência',
      message: `Remover "${account.name}" e seus lançamentos?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Remover', role: 'destructive', handler: () => { this.fin.deleteAccount(account.id); this.load(); } },
      ],
    });
    await a.present();
  }

  async deleteFinancialAccount(account: FinancialAccount) {
    const a = await this.alert.create({
      header: 'Remover conta financeira',
      message: `Remover "${account.name}"? Os lançamentos ficam salvos, apenas sem vínculo.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Remover', role: 'destructive', handler: () => { this.fin.deleteFinancialAccount(account.id); this.load(); } },
      ],
    });
    await a.present();
  }
}
