import {
  Component, OnInit, AfterViewInit, ViewChild, ElementRef, OnDestroy
} from '@angular/core';
import { Router } from '@angular/router';
import { FinancialService } from '../../services/financial.service';
import { UserService } from '../../services/user.service';
import { Transaction } from '../../models/models';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
})
export class DashboardPage implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('flowChart') flowChartRef!: ElementRef;

  currentMonth = '';
  summary = { totalIncome: 0, totalExpenses: 0, totalPaid: 0, totalPending: 0, balance: 0 };
  debtPercentage = 0;
  pendingItems: Transaction[] = [];
  private chart: Chart | null = null;

  constructor(
    private fin: FinancialService,
    private user: UserService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.currentMonth = this.fin.getCurrentMonth();
    this.loadData();
  }

  ngAfterViewInit() {
    setTimeout(() => this.buildChart(), 400);
  }

  ngOnDestroy() {
    this.chart?.destroy();
  }

  ionViewWillEnter() {
    this.loadData();
    if (this.chart) this.buildChart();
  }

  loadData() {
    this.fin.ensureMonthlyRecurringTransactions(this.currentMonth);
    this.summary = this.fin.getMonthlySummary(this.currentMonth);
    this.debtPercentage = this.summary.totalIncome > 0
      ? Math.min(100, Math.round((this.summary.totalExpenses / this.summary.totalIncome) * 100))
      : 0;
    this.pendingItems = this.fin.getTransactions(this.currentMonth)
      .filter(t => t.status === 'pending' && t.kind === 'expense')
      .slice(0, 5);
  }

  buildChart() {
    const el = this.flowChartRef?.nativeElement;
    if (!el) return;
    const months = this.getLast6Months();
    const incomes  = months.map(m => this.fin.getMonthlySummary(m).totalIncome);
    const expenses = months.map(m => this.fin.getMonthlySummary(m).totalExpenses);
    this.chart?.destroy();
    this.chart = new Chart(el, {
      type: 'bar',
      data: {
        labels: months.map(m => this.fin.formatMonth(m)),
        datasets: [
          { label: 'Receita',  data: incomes,  backgroundColor: '#40916c88' },
          { label: 'Despesa', data: expenses, backgroundColor: '#e6394666' },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: true, position: 'bottom' } },
        scales: { y: { beginAtZero: true, ticks: { callback: (v) => 'R$' + v } } },
      },
    });
  }

  getLast6Months(): string[] {
    const months: string[] = [];
    const d = new Date();
    for (let i = 5; i >= 0; i--) {
      const date = new Date(d.getFullYear(), d.getMonth() - i, 1);
      months.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    }
    return months;
  }

  openAssistant() {
    this.router.navigate(['/tabs/assistant']);
  }

  get greeting() {
    const name = this.user.prefs.name;
    return name ? `Olá, ${name}!` : 'Meu Cenário Financeiro';
  }

  get formattedMonth() { return this.fin.formatMonth(this.currentMonth); }
  fmt(v: number) { return this.fin.formatCurrency(v); }
}
