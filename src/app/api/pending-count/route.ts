import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data } = await supabase
    .from('transactions')
    .select('id, due_date, description, type, amount')
    .eq('status', 'devengado')
    .not('due_date', 'is', null)
    .lte('due_date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
    .order('due_date', { ascending: true })

  const items = data ?? []
  const overdue = items.filter(t => t.due_date! < today)
  const dueToday = items.filter(t => t.due_date === today)
  const urgentCount = overdue.length + dueToday.length

  return NextResponse.json({
    urgentCount,
    items: items.slice(0, 5).map(t => ({
      id: t.id,
      description: t.description,
      amount: t.amount,
      type: t.type,
      due_date: t.due_date,
      overdue: t.due_date! < today,
    })),
  })
}
