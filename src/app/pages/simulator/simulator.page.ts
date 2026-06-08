import { Component } from '@angular/core';
import { FinancialService } from '../../services/financial.service';
import { Debt } from '../../models/models';

interface SimResult {
  debtName: string;
  newBalance: number;
  currentEndMonth: string;
  newEndMonth: string;
  installmentsSaved: number;
  totalSaved: number;
  newInstallments: number;
}

@Component({
  selector: 'app-simulator',
  templateUrl: './simulator.page.html',
  styleUrls: ['./simulator.page.scss'],
})
export class SimulatorPage {
  debts: Debt[] = [];
  selectedId = '';
  payoffAmount: number | null = null;
  result: SimResult | null = null;

  constructor(private fin: FinancialService) {}

  ionViewWillEnter() {
    this.debts = this.fin.getDebts();
    if (this.debts.length && !this.selectedId) this.selectedId = this.debts[0].id;
  }

  get selected(): Debt | undefined { return this.debts.find(d => d.id === this.selectedId); }

  simulate() {
    const debt = this.selected;
    if (!debt || !this.payoffAmount || this.payoffAmount <= 0) return;

    const newBalance = Math.max(0, debt.current_balance - this.payoffAmount);
    const rate = debt.interest_rate / 100;
    let newInstallments: number;

    if (rate > 0 && debt.installment_amount > 0 && newBalance > 0) {
      newInstallments = Math.ceil(
        Math.log(debt.installment_amount / (debt.installment_amount - newBalance * rate)) /
        Math.log(1 + rate)
      );
    } else {
      newInstallments = debt.installment_amount > 0
        ? Math.ceil(newBalance / debt.installment_amount)
        : 0;
    }

    const saved = Math.max(0, debt.remaining_installments - newInstallments);
    const now = this.fin.getCurrentMonth();

    this.result = {
      debtName: debt.account_name ?? '',
      newBalance,
      currentEndMonth: debt.end_month,
      newEndMonth: this.fin.addEndMonths(now, newInstallments),
      installmentsSaved: saved,
      totalSaved: saved * debt.installment_amount,
      newInstallments,
    };
  }

  apply() {
    const debt = this.selected;
    if (!debt || !this.result) return;
    this.fin.updateDebt({
      ...debt,
      current_balance: this.result.newBalance,
      remaining_installments: this.result.newInstallments,
      end_month: this.result.newEndMonth,
    });
    this.result = null;
    this.payoffAmount = null;
    this.debts = this.fin.getDebts();
  }

  fmt(v: number) { return this.fin.formatCurrency(v); }
}
