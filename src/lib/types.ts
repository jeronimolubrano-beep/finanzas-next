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
  iva_rate: number | null
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

// Balance Sheet types
export interface BalanceSheetItem {
  name: string
  amount: number
}

export interface BalanceSheetCategory {
  name: string
  items: BalanceSheetItem[]
  subtotal: number
}

export interface BalanceSheet {
  period: string // "2024-12"
  businessId: number
  businessName: string

  assets: {
    current: {
      cash: number
      receivables: number
      subtotal: number
    }
    fixed: {
      ppe: number
      depreciation: number
      subtotal: number
    }
    total: number
  }

  liabilities: {
    current: {
      payables: number
      taxesPayable: number
      subtotal: number
    }
    longTerm: {
      debt: number
      subtotal: number
    }
    total: number
  }

  equity: {
    capital: number
    retainedEarnings: number
    total: number
  }

  totalLiabilitiesEquity: number
  isBalanced: boolean
  balanceDifference: number
}

export interface BalanceRatios {
  currentRatio: number // activos corrientes / pasivos corrientes
  debtToEquity: number // pasivos totales / patrimonio
  roe: number // net income / patrimonio
  debtRatio: number // pasivos totales / activos totales
  status: 'healthy' | 'caution' | 'risk'
}
