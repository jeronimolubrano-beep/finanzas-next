// Auto-categorización de transacciones por concepto
// Basado en las reglas de ESPECIFICACION_FINANZAS_FAMILIARES.md §7.2

export interface CategoryMatch {
  categoryName: string
  expenseType: 'ordinario' | 'extraordinario'
}

// Reglas de categorización para EGRESOS
const expenseRules: { keywords: string[]; categoryName: string; expenseType?: 'extraordinario' }[] = [
  // Sueldos y Cargas Sociales
  { keywords: ['SUELDO', 'SUELDOS'], categoryName: 'Sueldos y Cargas Sociales' },
  { keywords: ['CARGAS', '931'], categoryName: 'Sueldos y Cargas Sociales' },
  { keywords: ['OSDE', 'SWISS MEDICAL'], categoryName: 'Sueldos y Cargas Sociales' },
  { keywords: ['AUTONOMO', 'AUTONOMOS'], categoryName: 'Sueldos y Cargas Sociales' },
  { keywords: ['SINDICATO', 'UOCRA', 'UECARA', 'UATRE', 'IERIC'], categoryName: 'Sueldos y Cargas Sociales' },
  { keywords: ['AGUINALDO'], categoryName: 'Sueldos y Cargas Sociales' },
  { keywords: ['VACACIONES'], categoryName: 'Sueldos y Cargas Sociales' },
  { keywords: ['FONDO DESEMPLEO'], categoryName: 'Sueldos y Cargas Sociales' },
  { keywords: ['CTA PARTICULAR', 'CUENTA PARTICULAR'], categoryName: 'Sueldos y Cargas Sociales' },

  // Servicios
  { keywords: ['EXPENSAS', 'CONSORCIO'], categoryName: 'Servicios' },
  { keywords: ['ABL'], categoryName: 'Servicios' },
  { keywords: ['AYSA'], categoryName: 'Servicios' },
  { keywords: ['EDESUR', 'EDENOR'], categoryName: 'Servicios' },
  { keywords: ['METROGAS'], categoryName: 'Servicios' },
  { keywords: ['FLOW', 'FIBERTEL', 'IPLAN', 'TELECOM', 'MOVISTAR'], categoryName: 'Servicios' },
  { keywords: ['COLEGIO', 'SAN ANDRES', 'ACEESA'], categoryName: 'Servicios' },
  { keywords: ['DIRECT TV', 'DIRECTV'], categoryName: 'Servicios' },
  { keywords: ['TRANSPORTE ESCOLAR'], categoryName: 'Servicios' },

  // Planes Financiación
  { keywords: ['PLAN ARCA', 'PLAN AFIP', 'PLAN PP', 'PLAN 931'], categoryName: 'Planes Financiación' },

  // Impuestos
  { keywords: ['VEP'], categoryName: 'Impuestos' },
  { keywords: ['IVA'], categoryName: 'Impuestos' },
  { keywords: ['IIBB'], categoryName: 'Impuestos' },
  { keywords: ['GANANCIAS'], categoryName: 'Impuestos' },
  { keywords: ['SICORE'], categoryName: 'Impuestos' },
  { keywords: ['ARBA'], categoryName: 'Impuestos' },
  { keywords: ['PATENTE'], categoryName: 'Impuestos' },

  // Seguros
  { keywords: ['SEGURO', 'CHUBB', 'ALLIANZ', 'SANCOR', 'SURA'], categoryName: 'Seguros' },

  // Proveedores
  { keywords: ['CERVETTI'], categoryName: 'Proveedores' },
  { keywords: ['FLORES'], categoryName: 'Proveedores' },
  { keywords: ['MAZZUCCHELLI'], categoryName: 'Proveedores' },
  { keywords: ['MARIANI'], categoryName: 'Proveedores' },
  { keywords: ['GRUSCKA'], categoryName: 'Proveedores' },
  { keywords: ['RAMAGNANO'], categoryName: 'Proveedores' },
  { keywords: ['CAMARDELLA'], categoryName: 'Proveedores' },
  { keywords: ['HONORARIOS'], categoryName: 'Proveedores' },

  // Varios
  { keywords: ['GASTOS BANCARIOS'], categoryName: 'Varios' },
  { keywords: ['INTERESES'], categoryName: 'Varios' },
  { keywords: ['CAJA SEGURIDAD'], categoryName: 'Varios' },
  { keywords: ['COMBUSTIBLE', 'ECHANDI'], categoryName: 'Varios' },
  { keywords: ['VISA', 'AMEX', 'MASTER'], categoryName: 'Varios' },
  { keywords: ['SUPERMERCADO'], categoryName: 'Varios' },
  { keywords: ['LIBRERIA'], categoryName: 'Varios' },
  { keywords: ['MENSAJERIA'], categoryName: 'Varios' },
  { keywords: ['REFRIGERIOS'], categoryName: 'Varios' },
  { keywords: ['PEAJE'], categoryName: 'Varios' },
  { keywords: ['MOVILIDAD'], categoryName: 'Varios' },
]

// Reglas de categorización para INGRESOS
const incomeRules: { keywords: string[]; categoryName: string }[] = [
  { keywords: ['MINISTERIO'], categoryName: 'Alquiler Ministerio' },
  { keywords: ['TOYOTA'], categoryName: 'Alquiler Güemes/Toyota' },
  { keywords: ['CGS'], categoryName: 'Alquiler Alem/CGS' },
  { keywords: ['ANTENA'], categoryName: 'Alquiler Antena Caboto' },
  { keywords: ['ALVARINAS', 'GASTOS PDA', 'RECUPERO'], categoryName: 'Recupero Gastos PDA' },
  { keywords: ['FCI', 'RENTABILIDAD'], categoryName: 'Rentabilidad FCI' },
  { keywords: ['BONO', 'INTERESES BONO'], categoryName: 'Intereses Bonos' },
  { keywords: ['LIQUIDACION', 'HACIENDA', 'VENTA ÑANCUL'], categoryName: 'Liquidación Venta Ñancul' },
  { keywords: ['COCHERA'], categoryName: 'Alquileres Güemes Cocheras' },
  { keywords: ['DEPTO', 'DEPARTAMENTO', 'UNIDAD'], categoryName: 'Alquileres Güemes Deptos' },
]

/**
 * Intenta auto-categorizar una transacción por su concepto
 */
export function categorizeByDescription(
  description: string,
  type: 'income' | 'expense'
): CategoryMatch | null {
  const upper = description.toUpperCase()

  if (type === 'expense') {
    for (const rule of expenseRules) {
      if (rule.keywords.some(kw => upper.includes(kw))) {
        return {
          categoryName: rule.categoryName,
          expenseType: rule.expenseType || 'ordinario',
        }
      }
    }
  } else {
    for (const rule of incomeRules) {
      if (rule.keywords.some(kw => upper.includes(kw))) {
        return {
          categoryName: rule.categoryName,
          expenseType: 'ordinario',
        }
      }
    }
  }

  return null
}

/**
 * Detecta si una transacción en columnas SADIA corresponde a sub-entidad GUEMES o PDA
 * Nota: En esta app, GUEMES y PDA van todo a SADIA (business_id=1)
 * Pero esta función se puede usar si en el futuro se quiere desglosar
 */
export function detectSubEntity(concept: string): 'sadia' | 'guemes' | 'pda' {
  const upper = concept.toUpperCase()
  if (upper.includes('GUEMES') || upper.includes('GÜEMES') || upper.includes('COCHERA') || upper.includes('BAULERA') || upper.includes('PH GUEMES')) {
    return 'guemes'
  }
  if (upper.includes('PDA') || upper.includes('ALVARINAS') || upper.includes('FUMIRAPTOR')) {
    return 'pda'
  }
  return 'sadia'
}

// Filas especiales que NO deben importarse como transacciones
const SKIP_PATTERNS = [
  'POSICION BANCOS USD',
  'POSICION CAJA SEG USD',
  'FCI SALDO',
  'ACUERDO DESCUBIERTO',
  'SUBTOTAL',
  'TRANSFERENCIA E/CUENTAS',
]

export function shouldSkipRow(concept: string): boolean {
  if (!concept || concept.trim() === '') return true
  const upper = concept.toUpperCase().trim()
  return SKIP_PATTERNS.some(pattern => upper.includes(pattern))
}
