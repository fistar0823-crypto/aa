// FIX: Removed self-import of 'Page' which caused a name collision.
export type Page = 
  | 'dashboard' 
  | 'data-manager' 
  | 'asset-management' 
  | 'cashflow-management' 
  | 'budget-missions' 
  | 'investment-tracking' 
  | 'financial-goals' 
  | 'report-analysis';

export interface NotificationType {
  message: string;
  type: 'success' | 'error' | 'info';
  show: boolean;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export interface Asset {
  id: string;
  code: string;
  accountType: '股票' | 'ETF' | '現金' | '不動產' | '美元資產';
  units: number;
  cost: number;
  currentValue: number;
  currency: 'TWD' | 'USD';
  currentValueTWD?: number;
  costTWD?: number;
  profitLossTWD?: number;
}

export interface AssetAccount {
  id: string;
  name: string;
  assets: Asset[];
}

export interface CashflowRecord {
  id: string;
  date: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  currency: 'TWD' | 'USD';
  description: string;
  accountId: string;
  accountName?: string;
  isRecurring: boolean;
  recurrenceDay?: number;
}

export interface Budget {
  id: string;
  month: string;
  category: string;
  amount: number;
}

export interface Goal {
  id:string;
  name: string;
  targetAmount: number;
  currentAmount?: number; // Made optional for dynamic calculation
  targetDate: string;
  linkedAccountIds: string[];
}

export interface Settings {
  customIncome: string[];
  customExpense: string[];
  manualRate: number | null;
  lastRecurringCheck: string | null;
}