'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { formatMoney0 } from '@/lib/utils'
import { upsertBudget, upsertTemplate, generateFromTemplate } from './actions'
import { Target, LayoutTemplate, RefreshCw } from 'lucide-react'

type Category = { id: number; name: string; type: string }
type Actuals = Record<number, { income: number; expense: number }>

interface Props {
  categories: Category[]
  budgetMap: Record<number, number>
  templateMap: Record<number, number>
  actuals: Actuals
  businessId: number | null
  year: number
  month: number
}

const fmt = (n: number) => `$${formatMoney0(Math.abs(n))}`

function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.min(pct, 100)
  const color =
    pct > 100 ? '#fe4962' :
    pct > 80  ? '#f59e0b' :
                '#2edbc1'
  return (
    <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${clamped}%`, background: color }}
      />
    </div>
  )
}

function InlineInput({
  initialValue,
  onSave,
}: {
  initialValue: number
  onSave: (val: number) => Promise<void>
}) {
  const [val, setVal] = useState(initialValue === 0 ? '' : String(initialValue))
  const [saving, setSaving] = useState(false)

  async function commit() {
    const num = parseFloat(val.replace(/,/g, '')) || 0
    setSaving(true)
    await onSave(num)
    setSaving(false)
  }

  return (
    <input
      autoFocus
      type="text"
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') { e.preventDefault(); commit() }
        if (e.key === 'Escape') { setVal(String(initialValue)) }
      }}
      disabled={saving}
      className="w-full text-right text-sm font-semibold px-2 py-1 rounded border outline-none focus:ring-2 disabled:opacity-50"
      style={{
        borderColor: '#6439ff',
        color: 'var(--navy)',
        minWidth: '90px',
        boxSizing: 'border-box',
      }}
    />
  )
}

export function BudgetTable({
  categories,
  budgetMap,
  templateMap,
  actuals,
  businessId,
  year,
  month,
}: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'mensual' | 'plantillas'>('mensual')
  const [editingBudget, setEditingBudget] = useState<number | null>(null)
  const [editingTemplate, setEditingTemplate] = useState<number | null>(null)
  const [localBudgets, setLocalBudgets] = useState<Record<number, number>>(budgetMap)
  const [localTemplates, setLocalTemplates] = useState<Record<number, number>>(templateMap)
  const [isGenerating, startGenerating] = useTransition()

  const incomeCategories = categories.filter(c => c.type === 'income')
  const expenseCategories = categories.filter(c => c.type === 'expense')

  // Totals for mensual tab
  let totalBudgetIncome = 0, totalBudgetExpense = 0
  let totalActualIncome = 0, totalActualExpense = 0

  for (const cat of incomeCategories) {
    totalBudgetIncome += localBudgets[cat.id] ?? 0
    totalActualIncome += actuals[cat.id]?.income ?? 0
  }
  for (const cat of expenseCategories) {
    totalBudgetExpense += localBudgets[cat.id] ?? 0
    totalActualExpense += actuals[cat.id]?.expense ?? 0
  }

  const totalBudgetNet = totalBudgetIncome - totalBudgetExpense
  const totalActualNet = totalActualIncome - totalActualExpense

  async function handleBudgetSave(catId: number, val: number) {
    await upsertBudget(businessId, catId, year, month, val)
    setLocalBudgets(prev => ({ ...prev, [catId]: val }))
    setEditingBudget(null)
  }

  async function handleTemplateSave(catId: number, val: number) {
    await upsertTemplate(businessId, catId, val)
    setLocalTemplates(prev => ({ ...prev, [catId]: val }))
    setEditingTemplate(null)
  }

  function handleGenerate() {
    startGenerating(async () => {
      await generateFromTemplate(businessId, year, month)
      router.refresh()
    })
  }

  const tabBtnStyle = (active: boolean) =>
    active
      ? { background: '#6439ff', color: '#fff', borderColor: '#6439ff' }
      : { color: '#8b8ec0', borderColor: '#e8e8f0', background: 'transparent' }

  // ── Mensual tab row renderer ──
  function BudgetRow({ cat }: { cat: Category }) {
    const budgeted = localBudgets[cat.id] ?? 0
    const isIncome = cat.type === 'income'
    const actual = isIncome
      ? (actuals[cat.id]?.income ?? 0)
      : (actuals[cat.id]?.expense ?? 0)
    const diff = budgeted - actual
    const pct = budgeted > 0 ? (actual / budgeted) * 100 : actual > 0 ? 999 : 0

    const isEditing = editingBudget === cat.id

    const diffColor = isIncome
      ? diff >= 0 ? '#8b8ec0' : '#fe4962'
      : diff >= 0 ? '#2edbc1' : '#fe4962'

    return (
      <tr
        className="hover:bg-[#f9f9ff] transition"
        style={{ borderTop: '1px solid #f0f0f8' }}
      >
        <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--navy)' }}>
          {cat.name}
        </td>

        {/* Presupuestado — click to edit */}
        <td className="px-4 py-3 text-right w-36">
          {isEditing ? (
            <InlineInput
              initialValue={budgeted}
              onSave={val => handleBudgetSave(cat.id, val)}
            />
          ) : (
            <button
              onClick={() => setEditingBudget(cat.id)}
              className="w-full text-right text-sm font-semibold tabular-nums px-2 py-1 rounded hover:bg-blue-50 transition cursor-text"
              style={{ color: budgeted === 0 ? '#c4c4d8' : 'var(--navy)' }}
              title="Clic para editar"
            >
              {budgeted === 0 ? '—' : fmt(budgeted)}
            </button>
          )}
        </td>

        {/* Real */}
        <td className="px-4 py-3 text-right text-sm tabular-nums font-medium"
            style={{ color: actual === 0 ? '#c4c4d8' : 'var(--navy)' }}>
          {actual === 0 ? '—' : fmt(actual)}
        </td>

        {/* Diferencia */}
        <td className="px-4 py-3 text-right text-sm tabular-nums font-semibold"
            style={{ color: diffColor }}>
          {budgeted === 0 && actual === 0
            ? '—'
            : (diff >= 0 ? '' : '-') + fmt(Math.abs(diff))}
        </td>

        {/* % Ejecutado */}
        <td className="px-4 py-3 w-36">
          {budgeted === 0 ? (
            <span className="text-xs" style={{ color: '#c4c4d8' }}>sin presupuesto</span>
          ) : (
            <div className="space-y-1">
              <div className="text-xs text-right tabular-nums font-medium"
                   style={{ color: pct > 100 ? '#fe4962' : pct > 80 ? '#f59e0b' : '#8b8ec0' }}>
                {pct > 999 ? '>999' : pct.toFixed(0)}%
              </div>
              <ProgressBar pct={pct} />
            </div>
          )}
        </td>
      </tr>
    )
  }

  // ── Template tab row renderer ──
  function TemplateRow({ cat }: { cat: Category }) {
    const amount = localTemplates[cat.id] ?? 0
    const isEditing = editingTemplate === cat.id

    return (
      <tr
        className="hover:bg-[#f9f9ff] transition"
        style={{ borderTop: '1px solid #f0f0f8' }}
      >
        <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--navy)' }}>
          {cat.name}
        </td>
        <td className="px-4 py-3 text-right w-36">
          {isEditing ? (
            <InlineInput
              initialValue={amount}
              onSave={val => handleTemplateSave(cat.id, val)}
            />
          ) : (
            <button
              onClick={() => setEditingTemplate(cat.id)}
              className="w-full text-right text-sm font-semibold tabular-nums px-2 py-1 rounded hover:bg-blue-50 transition cursor-text"
              style={{ color: amount === 0 ? '#c4c4d8' : 'var(--navy)' }}
              title="Clic para editar"
            >
              {amount === 0 ? '—' : fmt(amount)}
            </button>
          )}
        </td>
      </tr>
    )
  }

  const sectionHeader = (label: string) => (
    <tr style={{ background: '#f4f4ff' }}>
      <td colSpan={activeTab === 'mensual' ? 5 : 2}
          className="px-4 py-2 text-xs font-bold uppercase tracking-wider"
          style={{ color: '#6439ff' }}>
        {label}
      </td>
    </tr>
  )

  const totalRow = (
    label: string,
    budget: number,
    actual: number,
    colSpan: number = 5,
  ) => {
    const diff = budget - actual
    const pct = budget > 0 ? (actual / budget) * 100 : 0
    return (
      <tr style={{ background: '#f9f9ff', borderTop: '2px solid #e0e0ef' }}>
        <td className="px-4 py-3 text-sm font-bold" style={{ color: 'var(--navy)' }}>{label}</td>
        <td className="px-4 py-3 text-right text-sm font-bold tabular-nums" style={{ color: 'var(--navy)' }}>
          {budget === 0 ? '—' : fmt(budget)}
        </td>
        <td className="px-4 py-3 text-right text-sm font-bold tabular-nums" style={{ color: 'var(--navy)' }}>
          {actual === 0 ? '—' : fmt(actual)}
        </td>
        <td className="px-4 py-3 text-right text-sm font-bold tabular-nums"
            style={{ color: diff >= 0 ? '#2edbc1' : '#fe4962' }}>
          {budget === 0 && actual === 0 ? '—' : (diff >= 0 ? '' : '-') + fmt(Math.abs(diff))}
        </td>
        <td className="px-4 py-3 w-36">
          {budget > 0 ? (
            <div className="space-y-1">
              <div className="text-xs text-right tabular-nums font-medium"
                   style={{ color: pct > 100 ? '#fe4962' : pct > 80 ? '#f59e0b' : '#8b8ec0' }}>
                {pct.toFixed(0)}%
              </div>
              <ProgressBar pct={pct} />
            </div>
          ) : null}
        </td>
      </tr>
    )
  }

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--card-bg)', borderColor: '#e8e8f0' }}>
      {/* Tab bar + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b"
           style={{ borderColor: '#e8e8f0', background: '#f9f9ff' }}>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('mensual')}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium transition"
            style={tabBtnStyle(activeTab === 'mensual')}
          >
            <Target className="w-3.5 h-3.5" />
            Presupuesto mensual
          </button>
          <button
            onClick={() => setActiveTab('plantillas')}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium transition"
            style={tabBtnStyle(activeTab === 'plantillas')}
          >
            <LayoutTemplate className="w-3.5 h-3.5" />
            Plantillas
          </button>
        </div>

        {activeTab === 'mensual' && (
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium transition hover:opacity-80 disabled:opacity-50"
            style={{ borderColor: '#6439ff', color: '#6439ff' }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
            {isGenerating ? 'Generando...' : 'Generar desde plantilla'}
          </button>
        )}
      </div>

      {/* Tip */}
      <div className="px-5 py-2 border-b text-xs" style={{ borderColor: '#f0f0f8', color: '#a0a0c0', background: '#fdfdff' }}>
        {activeTab === 'mensual'
          ? 'Clic en cualquier celda de presupuesto para editar · Enter o blur para guardar'
          : 'Clic en el monto para editar la plantilla · Los montos se copian al presupuesto mensual al generar'}
      </div>

      <div className="overflow-x-auto">
        {activeTab === 'mensual' ? (
          <table className="w-full text-sm">
            <thead style={{ background: '#f4f4ff' }}>
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase"
                    style={{ color: '#8b8ec0' }}>Categoría</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase"
                    style={{ color: '#8b8ec0' }}>Presupuestado</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase"
                    style={{ color: '#8b8ec0' }}>Real</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase"
                    style={{ color: '#8b8ec0' }}>Diferencia</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase"
                    style={{ color: '#8b8ec0' }}>% Ejecutado</th>
              </tr>
            </thead>
            <tbody>
              {/* Ingresos */}
              {sectionHeader('Ingresos')}
              {incomeCategories.map(cat => <BudgetRow key={cat.id} cat={cat} />)}
              {totalRow('Total Ingresos', totalBudgetIncome, totalActualIncome)}

              {/* Gastos */}
              {sectionHeader('Gastos')}
              {expenseCategories.map(cat => <BudgetRow key={cat.id} cat={cat} />)}
              {totalRow('Total Gastos', totalBudgetExpense, totalActualExpense)}

              {/* Resultado neto */}
              <tr style={{ background: '#f0f0ff', borderTop: '2px solid #d0d0ef' }}>
                <td className="px-4 py-3.5 text-sm font-bold" style={{ color: 'var(--navy)' }}>
                  Resultado Neto
                </td>
                <td className="px-4 py-3.5 text-right text-sm font-bold tabular-nums"
                    style={{ color: totalBudgetNet >= 0 ? '#2edbc1' : '#fe4962' }}>
                  {fmt(totalBudgetNet)}
                </td>
                <td className="px-4 py-3.5 text-right text-sm font-bold tabular-nums"
                    style={{ color: totalActualNet >= 0 ? '#2edbc1' : '#fe4962' }}>
                  {fmt(totalActualNet)}
                </td>
                <td className="px-4 py-3.5 text-right text-sm font-bold tabular-nums"
                    style={{ color: (totalBudgetNet - totalActualNet) >= 0 ? '#2edbc1' : '#fe4962' }}>
                  {fmt(totalBudgetNet - totalActualNet)}
                </td>
                <td className="px-4 py-3.5" />
              </tr>
            </tbody>
          </table>
        ) : (
          /* ── Plantillas tab ── */
          <table className="w-full text-sm">
            <thead style={{ background: '#f4f4ff' }}>
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase"
                    style={{ color: '#8b8ec0' }}>Categoría</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase"
                    style={{ color: '#8b8ec0' }}>Monto plantilla</th>
              </tr>
            </thead>
            <tbody>
              {sectionHeader('Ingresos')}
              {incomeCategories.map(cat => <TemplateRow key={cat.id} cat={cat} />)}
              {sectionHeader('Gastos')}
              {expenseCategories.map(cat => <TemplateRow key={cat.id} cat={cat} />)}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
