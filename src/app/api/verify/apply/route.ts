/**
 * /api/verify/apply
 * Ejecuta los fixes seleccionados por el usuario contra Supabase.
 * Soporta: insert, delete, update_amount, update_business, none.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface FixInsert {
  op: 'insert'
  date: string
  description: string
  amount: number
  type: 'income' | 'expense'
  business_id: number
  currency: string
  status: string
  expense_type: string
  category_id?: number | null
  notes?: string | null
}

interface FixDelete {
  op: 'delete'
  ids: number[]
}

interface FixUpdateAmount {
  op: 'update_amount'
  id: number
  amount: number
}

interface FixUpdateBusiness {
  op: 'update_business'
  ids: number[]
  business_id: number
}

interface FixNone {
  op: 'none'
  reason: string
}

type SuggestedFix = FixInsert | FixDelete | FixUpdateAmount | FixUpdateBusiness | FixNone

interface ApplyRequest {
  fixes: SuggestedFix[]
  month: string
}

interface FixResult {
  index: number
  op: string
  ok: boolean
  message: string
  inserted_id?: number
}

export async function POST(request: NextRequest) {
  try {
    const body: ApplyRequest = await request.json()
    const { fixes, month } = body

    if (!Array.isArray(fixes) || fixes.length === 0) {
      return NextResponse.json({ error: 'No se enviaron fixes' }, { status: 400 })
    }

    const supabase = await createClient()
    const results: FixResult[] = []

    for (let i = 0; i < fixes.length; i++) {
      const fix = fixes[i]

      if (fix.op === 'none') {
        results.push({ index: i, op: 'none', ok: true, message: 'Sin cambios requeridos' })
        continue
      }

      if (fix.op === 'insert') {
        const { data, error } = await supabase
          .from('transactions')
          .insert({
            date: fix.date,
            description: fix.description,
            amount: fix.amount,
            type: fix.type,
            business_id: fix.business_id,
            currency: fix.currency ?? 'ARS',
            status: fix.status ?? 'percibido',
            expense_type: fix.expense_type ?? 'ordinario',
            category_id: fix.category_id ?? null,
            notes: fix.notes ?? null,
          })
          .select('id')
          .single()

        if (error) {
          results.push({ index: i, op: 'insert', ok: false, message: error.message })
        } else {
          results.push({ index: i, op: 'insert', ok: true, message: `Transacción creada (ID ${data.id})`, inserted_id: data.id })
        }
        continue
      }

      if (fix.op === 'delete') {
        if (!fix.ids?.length) {
          results.push({ index: i, op: 'delete', ok: false, message: 'No se especificaron IDs a eliminar' })
          continue
        }
        const { error } = await supabase
          .from('transactions')
          .delete()
          .in('id', fix.ids)

        if (error) {
          results.push({ index: i, op: 'delete', ok: false, message: error.message })
        } else {
          results.push({ index: i, op: 'delete', ok: true, message: `Eliminada(s): ID(s) ${fix.ids.join(', ')}` })
        }
        continue
      }

      if (fix.op === 'update_amount') {
        const { error } = await supabase
          .from('transactions')
          .update({ amount: fix.amount })
          .eq('id', fix.id)

        if (error) {
          results.push({ index: i, op: 'update_amount', ok: false, message: error.message })
        } else {
          results.push({ index: i, op: 'update_amount', ok: true, message: `Monto actualizado a $${fix.amount.toLocaleString('es-AR')} (ID ${fix.id})` })
        }
        continue
      }

      if (fix.op === 'update_business') {
        if (!fix.ids?.length) {
          results.push({ index: i, op: 'update_business', ok: false, message: 'No se especificaron IDs' })
          continue
        }
        const { error } = await supabase
          .from('transactions')
          .update({ business_id: fix.business_id })
          .in('id', fix.ids)

        if (error) {
          results.push({ index: i, op: 'update_business', ok: false, message: error.message })
        } else {
          results.push({ index: i, op: 'update_business', ok: true, message: `Empresa actualizada (ID(s) ${fix.ids.join(', ')})` })
        }
        continue
      }

      results.push({ index: i, op: (fix as { op: string }).op, ok: false, message: 'Operación no reconocida' })
    }

    const appliedCount = results.filter(r => r.ok).length
    const failedCount = results.filter(r => !r.ok).length

    return NextResponse.json({
      results,
      summary: { applied: appliedCount, failed: failedCount, total: fixes.length, month },
    })
  } catch (error) {
    console.error('[verify/apply] Error:', error)
    return NextResponse.json({ error: 'Error inesperado: ' + (error as Error).message }, { status: 500 })
  }
}
