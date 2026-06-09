import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Account, Transaction, Debt, Income, FinancialAccount } from '../models/models';

@Injectable({ providedIn: 'root' })
export class FinancialService {
  private readonly ACCOUNTS_KEY = 'mcf_accounts';
  private readonly FINANCIAL_ACCOUNTS_KEY = 'mcf_financial_accounts';
  private readonly TRANSACTIONS_KEY = 'mcf_transactions';
  private readonly DEBTS_KEY = 'mcf_debts';
  private readonly INCOMES_KEY = 'mcf_incomes';

  private accountsSubject = new BehaviorSubject<Account[]>([]);
  accounts$ = this.accountsSubject.asObservable();

  constructor() {
    this.accountsSubject.next(this.getAll<Account>(this.ACCOUNTS_KEY));
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  }

  private getAll<T>(key: string): T[] {
    try {
      const data = localStorage.getItem(key);
      const parsed: unknown = data ? JSON.parse(data) : [];
      return Array.isArray(parsed) ? parsed as T[] : [];
    } catch {
      return [];
    }
  }

  private saveAll<T>(key: string, items: T[]) {
    localStorage.setItem(key, JSON.stringify(items));
  }

  private removeViewFieldsFromDebt(debt: Debt): Omit<Debt, 'account_name'> {
    const { account_name: _accountName, ...cleanDebt } = debt;
    return cleanDebt;
  }

  private removeViewFieldsFromTransaction(t: Transaction): Omit<Transaction, 'account_name' | 'financial_account_name'> {
    const {
      account_name: _accountName,
      financial_account_name: _financialAccountName,
      ...cleanTransaction
    } = t;
    return cleanTransaction;
  }

  private resolveFinancialAccountName(financialAccounts: FinancialAccount[], id?: string): string | undefined {
    if (!id) return undefined;
    return financialAccounts.find(a => a.id === id)?.name || 'Conta removida';
  }

  // ---- Accounts ----

  getAccounts(): Account[] {
    return this.getAll<Account>(this.ACCOUNTS_KEY);
  }

  saveAccount(account: Omit<Account, 'id'>): Account {
    const accounts = this.getAccounts();
    const newAccount: Account = { ...account, id: this.generateId() };
    accounts.push(newAccount);
    this.saveAll(this.ACCOUNTS_KEY, accounts);
    this.accountsSubject.next(accounts);
    return newAccount;
  }

  updateAccount(account: Account) {
    const accounts = this.getAccounts().map(a => a.id === account.id ? account : a);
    this.saveAll(this.ACCOUNTS_KEY, accounts);
    this.accountsSubject.next(accounts);
  }

  deleteAccount(id: string) {
    const accounts = this.getAccounts().filter(a => a.id !== id);
    const transactions = this.getAll<Transaction>(this.TRANSACTIONS_KEY).filter(t => t.account_id !== id);
    const debts = this.getAll<Debt>(this.DEBTS_KEY).filter(d => d.account_id !== id);

    this.saveAll(this.ACCOUNTS_KEY, accounts);
    this.saveAll(this.TRANSACTIONS_KEY, transactions);
    this.saveAll(this.DEBTS_KEY, debts);
    this.accountsSubject.next(accounts);
  }

  // ---- Financial Accounts ----

  getFinancialAccounts(): FinancialAccount[] {
    return this.getAll<FinancialAccount>(this.FINANCIAL_ACCOUNTS_KEY);
  }

  saveFinancialAccount(account: Omit<FinancialAccount, 'id'>): FinancialAccount {
    const accounts = this.getFinancialAccounts();
    const newAccount: FinancialAccount = { ...account, id: this.generateId() };
    accounts.push(newAccount);
    this.saveAll(this.FINANCIAL_ACCOUNTS_KEY, accounts);
    return newAccount;
  }

  updateFinancialAccount(account: FinancialAccount) {
    const accounts = this.getFinancialAccounts().map(a => a.id === account.id ? account : a);
    this.saveAll(this.FINANCIAL_ACCOUNTS_KEY, accounts);
  }

  deleteFinancialAccount(id: string) {
    const accounts = this.getFinancialAccounts().filter(a => a.id !== id);
    const transactions = this.getAll<Transaction>(this.TRANSACTIONS_KEY).map(t =>
      t.financial_account_id === id ? { ...t, financial_account_id: undefined } : t
    );
    const recurringAccounts = this.getAccounts().map(a =>
      a.financial_account_id === id ? { ...a, financial_account_id: undefined } : a
    );

    this.saveAll(this.FINANCIAL_ACCOUNTS_KEY, accounts);
    this.saveAll(this.TRANSACTIONS_KEY, transactions);
    this.saveAll(this.ACCOUNTS_KEY, recurringAccounts);
    this.accountsSubject.next(recurringAccounts);
  }

  // ---- Transactions ----

  getTransactions(month?: string): Transaction[] {
    const all = this.getAll<Transaction>(this.TRANSACTIONS_KEY);
    const accounts = this.getAccounts();
    const financialAccounts = this.getFinancialAccounts();
    const withNames = all.map(t => ({
      ...t,
      account_name: accounts.find(a => a.id === t.account_id)?.name || 'Conta removida',
      financial_account_name: this.resolveFinancialAccountName(financialAccounts, t.financial_account_id),
    }));
    return month ? withNames.filter(t => t.month === month) : withNames;
  }

  saveTransaction(t: Omit<Transaction, 'id' | 'account_name' | 'financial_account_name'>): Transaction {
    const transactions = this.getAll<Transaction>(this.TRANSACTIONS_KEY);
    const newT: Transaction = { ...t, id: this.generateId() };
    transactions.push(newT);
    this.saveAll(this.TRANSACTIONS_KEY, transactions);
    return newT;
  }

  updateTransaction(t: Transaction) {
    const cleanTransaction = this.removeViewFieldsFromTransaction(t);
    const all = this.getAll<Transaction>(this.TRANSACTIONS_KEY);
    const updated = all.map(x => x.id === t.id ? { ...cleanTransaction } : x);
    this.saveAll(this.TRANSACTIONS_KEY, updated);
  }

  deleteTransaction(id: string) {
    const all = this.getAll<Transaction>(this.TRANSACTIONS_KEY).filter(t => t.id !== id);
    this.saveAll(this.TRANSACTIONS_KEY, all);
  }

  ensureMonthlyRecurringTransactions(month: string): Transaction[] {
    const accounts = this.getAccounts().filter(a => a.active && Number(a.default_amount || 0) > 0);
    const transactions = this.getAll<Transaction>(this.TRANSACTIONS_KEY);
    const generated: Transaction[] = [];

    for (const account of accounts) {
      const exists = transactions.some(t => t.month === month && t.account_id === account.id);
      if (exists) continue;

      const isIncome = account.type === 'income';
      const transaction: Transaction = {
        id: this.generateId(),
        account_id: account.id,
        financial_account_id: account.financial_account_id,
        month,
        amount: Number(account.default_amount || 0),
        status: isIncome ? 'paid' : 'pending',
        kind: isIncome ? 'income' : 'expense',
        notes: isIncome ? 'Receita recorrente' : 'Despesa fixa recorrente',
        generated_from_recurring: true,
      };

      transactions.push(transaction);
      generated.push(transaction);
    }

    if (generated.length) this.saveAll(this.TRANSACTIONS_KEY, transactions);
    return generated;
  }

  // ---- Debts ----

  getDebts(): Debt[] {
    const debts = this.getAll<Debt>(this.DEBTS_KEY);
    const accounts = this.getAccounts();
    return debts.map(d => ({
      ...d,
      account_name: accounts.find(a => a.id === d.account_id)?.name || 'Conta removida'
    }));
  }

  saveDebt(d: Omit<Debt, 'id' | 'account_name'>): Debt {
    const debts = this.getAll<Debt>(this.DEBTS_KEY);
    const newD: Debt = { ...d, id: this.generateId() };
    debts.push(newD);
    this.saveAll(this.DEBTS_KEY, debts);
    return newD;
  }

  updateDebt(d: Debt) {
    const cleanDebt = this.removeViewFieldsFromDebt(d);
    const all = this.getAll<Debt>(this.DEBTS_KEY).map(x => x.id === d.id ? cleanDebt : x);
    this.saveAll(this.DEBTS_KEY, all);
  }

  deleteDebt(id: string) {
    const all = this.getAll<Debt>(this.DEBTS_KEY).filter(d => d.id !== id);
    this.saveAll(this.DEBTS_KEY, all);
  }

  // ---- Incomes ----

  getIncomes(month?: string): Income[] {
    const all = this.getAll<Income>(this.INCOMES_KEY);
    return month ? all.filter(i => i.month === month) : all;
  }

  saveIncome(income: Omit<Income, 'id'>): Income {
    const incomes = this.getAll<Income>(this.INCOMES_KEY);
    const newI: Income = { ...income, id: this.generateId() };
    incomes.push(newI);
    this.saveAll(this.INCOMES_KEY, incomes);
    return newI;
  }

  updateIncome(income: Income) {
    const all = this.getAll<Income>(this.INCOMES_KEY);
    const updated = all.map(i => i.id === income.id ? income : i);
    this.saveAll(this.INCOMES_KEY, updated);
  }

  deleteIncome(id: string) {
    const all = this.getAll<Income>(this.INCOMES_KEY).filter(i => i.id !== id);
    this.saveAll(this.INCOMES_KEY, all);
  }

  // ---- Helpers ----

  getMonthlySummary(month: string) {
    const transactions = this.getTransactions(month);
    const incomes = this.getIncomes(month);

    const totalIncome =
      incomes.reduce((s, i) => s + Number(i.amount || 0), 0) +
      transactions.filter(t => t.kind === 'income').reduce((s, t) => s + Number(t.amount || 0), 0);

    const totalExpenses = transactions
      .filter(t => t.kind === 'expense')
      .reduce((s, t) => s + Number(t.amount || 0), 0);

    const totalPaid = transactions
      .filter(t => t.kind === 'expense' && t.status === 'paid')
      .reduce((s, t) => s + Number(t.amount || 0), 0);

    const totalPending = transactions
      .filter(t => t.kind === 'expense' && t.status === 'pending')
      .reduce((s, t) => s + Number(t.amount || 0), 0);

    return { totalIncome, totalExpenses, totalPaid, totalPending, balance: totalIncome - totalExpenses };
  }

  getCurrentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  formatMonth(month: string): string {
    const [year, m] = month.split('-');
    const monthIndex = Number(m) - 1;
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    if (!year || monthIndex < 0 || monthIndex > 11) return month;
    return `${months[monthIndex]}/${year}`;
  }

  formatCurrency(value: number): string {
    return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  addEndMonths(fromMonth: string, count: number): string {
    const [y, m] = fromMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + count, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
}
