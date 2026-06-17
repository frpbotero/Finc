import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FinancialService } from '../../services/financial.service';

@Component({
  selector: 'app-finances',
  templateUrl: './finances.page.html',
  styleUrls: ['./finances.page.scss'],
})
export class FinancesPage {
  currentMonth = '';
  summary = { totalIncome: 0, totalExpenses: 0, totalPaid: 0, totalPending: 0, balance: 0 };
  accountsCount = 0;
  debtsCount = 0;
  incomesCount = 0;

  constructor(private fin: FinancialService, private router: Router) {}

  ionViewWillEnter() {
    this.currentMonth = this.fin.getCurrentMonth();
    this.summary = this.fin.getMonthlySummary(this.currentMonth);
    this.accountsCount = this.fin.getAccounts().length;
    this.debtsCount = this.fin.getDebts().length;
    this.incomesCount = this.fin.getIncomes().length;
  }

  go(section: string) {
    this.router.navigate(['/tabs/' + section]);
  }

  fmt(v: number) { return this.fin.formatCurrency(v); }
  get formattedMonth() { return this.fin.formatMonth(this.currentMonth); }
}
