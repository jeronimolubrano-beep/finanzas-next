'use server'

import { createClient } from '@/lib/supabase/server'
import { BalanceSheet, BalanceRatios } from '@/lib/types'

type TxRow = {
  date: string
  type: string
  amount: number | string
  status: string
  expense_type?: string | null
  businesses: { name: string } | null
}

/**
 * Calcular el balance sheet para una empresa en un período específico
 * @param businessId - ID de la empresa (1=SADIA+GUEMES+PDA consolidado, 2=ÑANCUL, 4=EML, 3=IBC)
 * @param period - Período en formato YYYY-MM (ej: "2024-12")
 * @returns BalanceSheet calculado
 */
export async function getBalanceSheet(
  businessId: number,
  period: string
): Promise<BalanceSheet | null> {
  const supabase = await createClient()

  // Convertir período a fecha de fin de mes
  const [year, month] = period.split('-')
  const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate()
  const periodEnd = `${year}-${month}-${String(lastDay).padStart(2, '0')}`

  // Query todas las transacciones hasta el fin del período
  let query = supabase
    .from('transactions')
    .select('date, type, amount, status, expense_type, businesses(name)')
    .lte('date', periodEnd)
    .order('date')

  if (businessId > 0) {
    query = query.eq('business_id', businessId)
  }

  const { data: transactions, error } = await query

  if (error || !transactions) {
    console.error('[Balance Sheet] Error fetching transactions:', error)
    return null
  }

  const txs = transactions as unknown as TxRow[]

  // Calcular caja (transacciones percibidas, cumulative)
  const cash = txs
    .filter(t => t.status === 'percibido')
    .reduce((sum, t) => {
      const amt = Number(t.amount)
      return t.type === 'income' ? sum + amt : sum - amt
    }, 0)

  // Calcular CxC (Cuentas por cobrar) - transacciones devengadas income
  const receivables = txs
    .filter(t => t.status === 'devengado' && t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount), 0)

  // Calcular Proveedores - transacciones devengadas expense ordinarias
  const payables = txs
    .filter(
      t => t.status === 'devengado' && t.type === 'expense' && (!t.expense_type || t.expense_type === 'ordinario')
    )
    .reduce((sum, t) => sum + Number(t.amount), 0)

  // Calcular Ganancias Retenidas (sumar net income de todos los períodos)
  const monthlyNets = new Map<string, { income: number; expense: number }>()
  for (const t of txs) {
    const txMonth = t.date.slice(0, 7) // "2024-01"
    if (!monthlyNets.has(txMonth)) {
      monthlyNets.set(txMonth, { income: 0, expense: 0 })
    }
    const month = monthlyNets.get(txMonth)!
    if (t.type === 'income') {
      month.income += Number(t.amount)
    } else {
      month.expense += Number(t.amount)
    }
  }

  let retainedEarnings = 0
  for (const { income, expense } of monthlyNets.values()) {
    retainedEarnings += income - expense
  }

  // Asignar capital (TBD: leer de settings si existe, por ahora 0)
  const capital = 0

  // Construir Balance Sheet
  const assetsTotal = cash + receivables
  const liabilitiesTotal = payables
  const equityTotal = capital + retainedEarnings
  const totalLiabilitiesEquity = liabilitiesTotal + equityTotal

  const balanceDifference = Math.abs(assetsTotal - totalLiabilitiesEquity)
  const isBalanced = balanceDifference < 0.01 // tolerance 0.01 ARS

  // Obtener nombre de empresa
  const businessName =
    businessId === 1 ? 'SADIA (GUEMES+PDA)' :
    businessId === 2 ? 'ÑANCUL' :
    businessId === 3 ? 'IBC' :
    businessId === 4 ? 'EML' :
    'Consolidado'

  const balanceSheet: BalanceSheet = {
    period,
    businessId,
    businessName,
    assets: {
      current: {
        cash: Math.max(cash, 0), // no negativos
        receivables: Math.max(receivables, 0),
        subtotal: Math.max(cash + receivables, 0),
      },
      fixed: {
        ppe: 0, // MVP no incluye
        depreciation: 0,
        subtotal: 0,
      },
      total: Math.max(assetsTotal, 0),
    },
    liabilities: {
      current: {
        payables: Math.max(payables, 0),
        taxesPayable: 0, // MVP no calcula
        subtotal: Math.max(payables, 0),
      },
      longTerm: {
        debt: 0, // MVP no incluye
        subtotal: 0,
      },
      total: Math.max(liabilitiesTotal, 0),
    },
    equity: {
      capital,
      retainedEarnings,
      total: capital + retainedEarnings,
    },
    totalLiabilitiesEquity,
    isBalanced,
    balanceDifference,
  }

  return balanceSheet
}

/**
 * Obtener balance sheet consolidado (SADIA + GUEMES + PDA)
 */
export async function getConsolidatedBalanceSheet(period: string): Promise<BalanceSheet | null> {
  return getBalanceSheet(1, period) // business_id=1 es SADIA consolidado
}

/**
 * Calcular ratios financieros del balance sheet
 */
export async function calculateBalanceRatios(balance: BalanceSheet): Promise<BalanceRatios> {
  const { assets, liabilities, equity } = balance

  // Current Ratio = Activos Corrientes / Pasivos Corrientes
  const currentRatio =
    liabilities.current.subtotal > 0 ? assets.current.subtotal / liabilities.current.subtotal : 0

  // Debt-to-Equity = Pasivos Totales / Patrimonio
  const debtToEquity = equity.total !== 0 ? liabilities.total / equity.total : 0

  // ROE = Net Income (ganancias retenidas del período) / Patrimonio
  // Para MVP, usamos el cambio en ganancias retenidas como proxy de net income
  const roe = equity.total !== 0 ? equity.retainedEarnings / equity.total : 0

  // Debt Ratio = Pasivos Totales / Activos Totales
  const debtRatio = assets.total > 0 ? liabilities.total / assets.total : 0

  // Determinar status basado en ratios
  let status: 'healthy' | 'caution' | 'risk'

  if (currentRatio < 1 || debtToEquity > 2 || debtRatio > 0.7) {
    status = 'risk'
  } else if (currentRatio < 1.5 || debtToEquity > 1 || debtRatio > 0.5) {
    status = 'caution'
  } else {
    status = 'healthy'
  }

  return {
    currentRatio,
    debtToEquity,
    roe,
    debtRatio,
    status,
  }
}
