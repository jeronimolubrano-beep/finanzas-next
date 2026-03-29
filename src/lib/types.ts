// Tipos principales de la aplicacion

export interface Transaction {
  id: number
  date: string
  description: string
  amount: number
  type: 'income' | 'expense'
  category_id: number | null
  account_id: number | null
  business_id: number
  notes: string | null
  currency: 'ARS' | 'USD'
  exchange_rate: number | null
  expense_type: 'ordinario' | 'extraordinario' | null
  status: 'percibido' | 'devengado'
  due_date: string | null
  paid_date: string | null
  created_at: string
}

export interface TransactionWithRelations extends Transaction {
  categories: { name: string } | null
  accounts: { name: string } | null
  businesses: { name: string } | null
}

export interface Category {
  id: number
  name: string
  type: 'income' | 'expense'
}

export interface Business {
  id: number
  name: string
}

export interface Account {
  id: number
  name: string
  account_type: 'bank' | 'cash' | 'credit'
}

export interface KPIData {
  income: number
  expense: number
  net: number
  savingsRate: number
  ctasCobrar: number
  ctasPagar: number
  topExpenseCat: string
  topExpenseTotal: number
  ytdNet: number
}
