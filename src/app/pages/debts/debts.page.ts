import { Component } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { FinancialService } from '../../services/financial.service';
import { Debt } from '../../models/models';

@Component({
  selector: 'app-debts',
  templateUrl: './debts.page.html',
  styleUrls: ['./debts.page.scss'],
})
export class DebtsPage {
  debts: Debt[] = [];

  constructor(private fin: FinancialService, private alert: AlertController) {}

  ionViewWillEnter() { this.load(); }

  load() { this.debts = this.fin.getDebts(); }

  progress(d: Debt): number {
    if (!d.original_amount) return 0;
    return Math.min(100, (1 - d.current_balance / d.original_amount) * 100);
  }

  get totalDebt()        { return this.debts.reduce((s, d) => s + d.current_balance, 0); }
  get totalInstallment() { return this.debts.reduce((s, d) => s + d.installment_amount, 0); }

  fmt(v: number) { return this.fin.formatCurrency(v); }

  async addDebt() {
    const accounts = this.fin.getAccounts()
      .filter(a => ['loan', 'installment', 'card'].includes(a.type));

    if (!accounts.length) {
      const a = await this.alert.create({
        header: 'Sem contas',
        message: 'Cadastre uma conta do tipo Empréstimo, Parcelamento ou Cartão primeiro.',
        buttons: ['OK'],
      });
      return a.present();
    }

    const inputs: any[] = accounts.map((ac, i) => ({
      type: 'radio', label: ac.name, value: ac.id, checked: i === 0,
    }));

    const selectAlert = await this.alert.create({
      header: 'Selecionar conta',
      inputs,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Próximo',
          handler: (accountId: string) => this.debtForm(accountId),
        },
      ],
    });
    await selectAlert.present();
  }

  async debtForm(accountId: string) {
    const a = await this.alert.create({
      header: 'Nova Dívida',
      inputs: [
        { name: 'original',    type: 'number', placeholder: 'Valor original' },
        { name: 'balance',     type: 'number', placeholder: 'Saldo atual' },
        { name: 'installment', type: 'number', placeholder: 'Valor da parcela' },
        { name: 'remaining',   type: 'number', placeholder: 'Parcelas restantes' },
        { name: 'rate',        type: 'number', placeholder: 'Juros % a.m. (0 = nenhum)' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Salvar',
          handler: (d) => {
            if (!d.original || !d.balance) return false;
            const now = this.fin.getCurrentMonth();
            const remaining = +d.remaining || 1;
            this.fin.saveDebt({
              account_id: accountId,
              original_amount: +d.original,
              current_balance: +d.balance,
              installment_amount: +d.installment || 0,
              remaining_installments: remaining,
              interest_rate: +d.rate || 0,
              start_month: now,
              end_month: this.fin.addEndMonths(now, remaining),
            });
            this.load();
            return true;
          },
        },
      ],
    });
    await a.present();
  }

  async deleteDebt(debt: Debt) {
    const a = await this.alert.create({
      header: 'Remover dívida',
      message: `Remover dívida de "${debt.account_name}"?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Remover', role: 'destructive', handler: () => { this.fin.deleteDebt(debt.id); this.load(); } },
      ],
    });
    await a.present();
  }
}
