// Helpers de formateo y utilidades

export function formatMoney(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatMoney0(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

export function getCurrentYear(): string {
  return new Date().getFullYear().toString()
}

export function getToday(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Devuelve el label de estado segun tipo de transaccion:
 * - devengado → "Pendiente"
 * - percibido + income → "Cobrado"
 * - percibido + expense → "Pagado"
 */
/**
 * Formatea una fecha ISO (YYYY-MM-DD) al formato argentino DD/MM/YYYY
 */
export function formatDateAR(isoDate: string): string {
  if (!isoDate || isoDate.length < 10) return isoDate || ''
  const [y, m, d] = isoDate.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

/**
 * Formatea una fecha ISO (YYYY-MM-DD) al formato corto DD/MM
 */
export function formatDateShort(isoDate: string): string {
  if (!isoDate || isoDate.length < 10) return isoDate || ''
  const [, m, d] = isoDate.slice(0, 10).split('-')
  return `${d}/${m}`
}

export function statusLabel(status: string, type: string): string {
  if (status === 'devengado') return 'Pendiente'
  return type === 'income' ? 'Cobrado' : 'Pagado'
}

/**
 * Calcula la urgencia de un vencimiento.
 * Retorna: 'overdue' | 'soon' | 'ok' | 'none'
 */
export function dueDateUrgency(dueDate: string | null): 'overdue' | 'soon' | 'ok' | 'none' {
  if (!dueDate) return 'none'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate + 'T00:00:00')
  const diffMs = due.getTime() - today.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'overdue'
  if (diffDays <= 7) return 'soon'
  return 'ok'
}

export function daysUntilDue(dueDate: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate + 'T00:00:00')
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

/**
 * Filtra transacciones pendientes que vencen hoy o mañana.
 * Útil para mostrar alertas modales al cargar el dashboard.
 */
export function getPaymentsDueToday(transactions: any[]): any[] {
  const today = new Date().toISOString().slice(0, 10)
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)

  return transactions.filter(t => t.due_date && (t.due_date === today || t.due_date === tomorrow))
}
