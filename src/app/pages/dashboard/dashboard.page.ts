import {
  Component, OnInit, AfterViewInit, ViewChild, ElementRef, OnDestroy
} from '@angular/core';
import { FinancialService } from '../../services/financial.service';
import { UserService } from '../../services/user.service';
import { Transaction } from '../../models/models';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

const PIE_COLORS = ['#40916c','#e63946','#457b9d','#f4a261','#9b5de5','#f15bb5','#00bbf9','#fee440'];

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
})
export class DashboardPage implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('flowChart') flowChartRef!: ElementRef;
  @ViewChild('pieChart') pieChartRef!: ElementRef;

  currentMonth = '';
  summary = { totalIncome: 0, totalExpenses: 0, totalPaid: 0, totalPending: 0, balance: 0 };
  debtPercentage = 0;
  pendingItems: Transaction[] = [];
  selectedView: '6months' | 'categories' = '6months';
  pieEmpty = false;

  private chart: Chart | null = null;
  private pieChart: Chart | null = null;

  constructor(
    private fin: FinancialService,
    private user: UserService,
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
    this.pieChart?.destroy();
  }

  ionViewWillEnter() {
    this.loadData();
    if (this.chart || this.pieChart) {
      setTimeout(() => this.selectedView === '6months' ? this.buildChart() : this.buildPieChart(), 50);
    }
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

  switchView() {
    setTimeout(() => this.selectedView === '6months' ? this.buildChart() : this.buildPieChart(), 50);
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

  buildPieChart() {
    const el = this.pieChartRef?.nativeElement;
    if (!el) return;

    const accounts = this.fin.getAccounts();
    const txs = this.fin.getTransactions(this.currentMonth).filter(t => t.kind === 'expense');

    const totals = new Map<string, number>();
    for (const tx of txs) {
      const acc = accounts.find(a => a.id === tx.account_id);
      const cat = acc?.category?.trim() || 'Sem categoria';
      totals.set(cat, (totals.get(cat) ?? 0) + tx.amount);
    }

    if (totals.size === 0) {
      this.pieEmpty = true;
      this.pieChart?.destroy();
      this.pieChart = null;
      return;
    }
    this.pieEmpty = false;

    const labels = [...totals.keys()];
    const data   = labels.map(l => totals.get(l)!);
    const colors = labels.map((_, i) => PIE_COLORS[i % PIE_COLORS.length]);

    this.pieChart?.destroy();
    this.pieChart = new Chart(el, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data, backgroundColor: colors, borderWidth: 2 }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: true, position: 'bottom' },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${this.fin.formatCurrency(ctx.parsed)}`,
            },
          },
        },
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

  get greeting() {
    const name = this.user.prefs.name;
    return name ? `Olá, ${name}!` : 'Meu Cenário Financeiro';
  }

  get formattedMonth() { return this.fin.formatMonth(this.currentMonth); }
  fmt(v: number) { return this.fin.formatCurrency(v); }
}
