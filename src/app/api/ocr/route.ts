import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('image') as File

    if (!file) {
      return NextResponse.json({ error: 'No se envio imagen' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    const mediaType = file.type || 'image/jpeg'

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY no configurada' }, { status: 500 })
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64,
                },
              },
              {
                type: 'text',
                text: `Analiza esta imagen de un ticket, factura o recibo de un negocio familiar argentino.
Extrae la informacion y clasifica inteligentemente. Devolvela SOLO como JSON valido (sin markdown):

{
  "date": "YYYY-MM-DD",
  "description": "descripcion breve en espanol (max 100 chars)",
  "amount": "1234.56",
  "type": "expense o income",
  "category": "nombre de categoria sugerida",
  "expense_type": "ordinario o extraordinario",
  "account": "nombre de cuenta sugerida"
}

CATEGORIAS DISPONIBLES (elegir la mas apropiada):
Ingresos: Sueldo, Freelance, Inversiones, Regalo, Otros ingresos
Gastos: Alquiler/Hipoteca, Supermercado, Servicios, Transporte, Salud, Educacion, Entretenimiento, Otros gastos

CUENTAS DISPONIBLES: Cuenta corriente, Caja de ahorro, Efectivo

REGLAS DE CLASIFICACION:
- Combustible, peajes, estacionamiento, taller mecanico, seguro auto → categoria "Transporte"
- Supermercados, almacenes, verdulerias, carniceria → categoria "Supermercado"
- Luz, gas, agua, telefono, internet, cable → categoria "Servicios"
- Farmacias, clinicas, estudios medicos, prepagas → categoria "Salud"
- Restaurantes, cine, streaming, salidas → categoria "Entretenimiento"
- Colegios, universidades, cursos, libros → categoria "Educacion"
- Alquileres, expensas, inmobiliaria → categoria "Alquiler/Hipoteca"

TIPO DE GASTO (expense_type):
- "ordinario": gastos recurrentes mensuales (supermercado, servicios, combustible habitual, sueldo empleados)
- "extraordinario": gastos puntuales no recurrentes (reparaciones, compras grandes, emergencias, multas)

CUENTA:
- Si se pago con tarjeta de debito/credito o transferencia → "Cuenta corriente"
- Si se pago en efectivo → "Efectivo"
- Si no se puede determinar → "Cuenta corriente" (default)

Notas:
- date: si no se puede leer la fecha, usa la de hoy
- amount: numero positivo sin signo de moneda, sin puntos de miles (solo punto decimal)
- type: "expense" para gastos/compras, "income" para cobros/ventas`,
              },
            ],
          },
        ],
      }),
    })

    if (!response.ok) {
      const errBody = await response.text()
      return NextResponse.json(
        { error: `Error de API Anthropic (${response.status}): ${errBody}` },
        { status: 500 }
      )
    }

    const data = await response.json()

    const textBlock = data.content?.find((b: { type: string }) => b.type === 'text')
    if (!textBlock) {
      return NextResponse.json({ error: 'No se obtuvo respuesta del modelo' }, { status: 500 })
    }

    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'No se pudo extraer datos de la imagen' }, { status: 500 })
    }

    const ocrData = JSON.parse(jsonMatch[0])

    return NextResponse.json({
      date: ocrData.date || new Date().toISOString().slice(0, 10),
      description: ocrData.description || 'Sin descripcion',
      amount: ocrData.amount || '0',
      type: ocrData.type || 'expense',
      category: ocrData.category || null,
      expense_type: ocrData.expense_type || 'ordinario',
      account: ocrData.account || null,
    })
  } catch (error) {
    console.error('OCR error:', error)
    return NextResponse.json(
      { error: 'Error al procesar la imagen: ' + (error as Error).message },
      { status: 500 }
    )
  }
}
