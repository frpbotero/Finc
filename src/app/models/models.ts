export interface Account {
  id: string;
  name: string;
  type: 'fixed' | 'card' | 'loan' | 'installment' | 'income';
  category?: string;
  due_day?: number;
  active: boolean;
}

export interface Transaction {
  id: string;
  account_id: string;
  month: string;
  amount: number;
  status: 'paid' | 'pending';
  kind: 'income' | 'expense';
  notes?: string;
  account_name?: string;
}

export interface Debt {
  id: string;
  account_id: string;
  original_amount: number;
  current_balance: number;
  installment_amount: number;
  remaining_installments: number;
  interest_rate: number;
  start_month: string;
  end_month: string;
  account_name?: string;
}

export interface Income {
  id: string;
  month: string;
  description: string;
  amount: number;
  recurring: boolean;
}
