'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function upsertBudget(
  businessId: number | null,
  categoryId: number,
  year: number,
  month: number,
  amountArs: number,
) {
  const supabase = await createClient()
  await supabase.from('budgets').upsert(
    {
      business_id: businessId,
      category_id: categoryId,
      year,
      month,
      amount_ars: amountArs,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'business_id,category_id,year,month' },
  )
  revalidatePath('/budgets')
}

export async function upsertTemplate(
  businessId: number | null,
  categoryId: number,
  amountArs: number,
) {
  const supabase = await createClient()
  await supabase.from('budget_templates').upsert(
    {
      business_id: businessId,
      category_id: categoryId,
      amount_ars: amountArs,
      active: true,
    },
    { onConflict: 'business_id,category_id' },
  )
  revalidatePath('/budgets')
}

export async function generateFromTemplate(
  businessId: number | null,
  year: number,
  month: number,
) {
  const supabase = await createClient()

  // Fetch active templates for this business
  let tplQuery = supabase
    .from('budget_templates')
    .select('category_id, amount_ars')
    .eq('active', true)

  if (businessId !== null) {
    tplQuery = tplQuery.eq('business_id', businessId)
  } else {
    tplQuery = tplQuery.is('business_id', null)
  }

  const { data: templates } = await tplQuery
  if (!templates || templates.length === 0) return

  // Fetch existing budget rows for this month to avoid overwriting
  let existingQuery = supabase
    .from('budgets')
    .select('category_id')
    .eq('year', year)
    .eq('month', month)

  if (businessId !== null) {
    existingQuery = existingQuery.eq('business_id', businessId)
  } else {
    existingQuery = existingQuery.is('business_id', null)
  }

  const { data: existing } = await existingQuery
  const existingCatIds = new Set((existing ?? []).map(r => r.category_id))

  // Only insert rows for categories not already budgeted
  const toInsert = templates
    .filter(t => !existingCatIds.has(t.category_id))
    .map(t => ({
      business_id: businessId,
      category_id: t.category_id,
      year,
      month,
      amount_ars: t.amount_ars,
    }))

  if (toInsert.length > 0) {
    await supabase.from('budgets').insert(toInsert)
  }

  revalidatePath('/budgets')
}
