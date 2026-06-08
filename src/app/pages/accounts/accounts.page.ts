import { Component } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { FinancialService } from '../../services/financial.service';
import { Account, Transaction } from '../../models/models';

@Component({
  selector: 'app-accounts',
  templateUrl: './accounts.page.html',
  styleUrls: ['./accounts.page.scss'],
})
export class AccountsPage {
  currentMonth = '';
  groupedAccounts: { label: string; type: string; icon: string; items: Account[] }[] = [];
  transactions: Transaction[] = [];

  private readonly GROUPS = [
    { label: 'Receitas',      type: 'income',      icon: 'cash-outline' },
    { label: 'Contas Fixas', type: 'fixed',       icon: 'home-outline' },
    { label: 'Cartões',      type: 'card',        icon: 'card-outline' },
    { label: 'Empréstimos',  type: 'loan',        icon: 'wallet-outline' },
    { label: 'Parcelamentos',type: 'installment', icon: 'pricetag-outline' },
  ];

  constructor(private fin: FinancialService, private alert: AlertController) {}

  ionViewWillEnter() {
    this.currentMonth = this.fin.getCurrentMonth();
    this.load();
  }

  load() {
    const accounts = this.fin.getAccounts();
    this.transactions = this.fin.getTransactions(this.currentMonth);
    this.groupedAccounts = this.GROUPS
      .map(g => ({ ...g, items: accounts.filter(a => a.type === g.type && a.active) }))
      .filter(g => g.items.length > 0);
  }

  getTx(accountId: string): Transaction | undefined {
    return this.transactions.find(t => t.account_id === accountId && t.kind === 'expense');
  }

  getAmount(accountId: string): number { return this.getTx(accountId)?.amount ?? 0; }
  getStatus(accountId: string): string { return this.getTx(accountId)?.status ?? ''; }

  fmt(v: number) { return this.fin.formatCurrency(v); }

  async addAccount() {
    const a = await this.alert.create({
      header: 'Nova Conta',
      inputs: [
        { name: 'name', type: 'text', placeholder: 'Nome' },
        { name: 'due_day', type: 'number', placeholder: 'Dia de vencimento (opcional)' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Tipo',
          handler: () => { this.pickType(); return false; }
        },
      ],
    });
    await a.present();
  }

  async pickType(name?: string, dueDay?: number) {
    const a = await this.alert.create({
      header: 'Tipo de conta',
      inputs: [
        { type: 'radio', label: 'Conta Fixa',    value: 'fixed',       checked: true },
        { type: 'radio', label: 'Cartão',        value: 'card' },
        { type: 'radio', label: 'Empréstimo',    value: 'loan' },
        { type: 'radio', label: 'Parcelamento',  value: 'installment' },
        { type: 'radio', label: 'Receita',       value: 'income' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Próximo',
          handler: (type: Account['type']) => {
            this.confirmNewAccount(name, dueDay, type);
          }
        },
      ],
    });
    await a.present();
  }

  async confirmNewAccount(name?: string, dueDay?: number, type?: Account['type']) {
    const a = await this.alert.create({
      header: 'Confirmar conta',
      inputs: [
        { name: 'name',    type: 'text',   placeholder: 'Nome da conta', value: name ?? '' },
        { name: 'due_day', type: 'number', placeholder: 'Dia venc. (0 = nenhum)', value: dueDay?.toString() ?? '' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Salvar',
          handler: (d) => {
            if (!d.name) return false;
            this.fin.saveAccount({
              name: d.name,
              type: type ?? 'fixed',
              due_day: d.due_day ? +d.due_day : undefined,
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

  async editTx(account: Account) {
    const existing = this.getTx(account.id);
    const a = await this.alert.create({
      header: account.name,
      inputs: [
        { name: 'amount', type: 'number', placeholder: 'Valor (R$)', value: existing?.amount?.toString() ?? '' },
        { name: 'notes',  type: 'text',   placeholder: 'Observação', value: existing?.notes ?? '' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Salvar',
          handler: (d) => {
            if (!d.amount) return false;
            if (existing) {
              this.fin.updateTransaction({ ...existing, amount: +d.amount, notes: d.notes });
            } else {
              this.fin.saveTransaction({
                account_id: account.id,
                month: this.currentMonth,
                amount: +d.amount,
                status: 'pending',
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
      header: 'Remover conta',
      message: `Remover "${account.name}"?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Remover', role: 'destructive', handler: () => { this.fin.deleteAccount(account.id); this.load(); } },
      ],
    });
    await a.present();
  }
}
