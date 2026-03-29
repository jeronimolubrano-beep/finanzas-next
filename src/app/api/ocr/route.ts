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

    // Llamar a la API de Anthropic directamente con fetch (sin SDK)
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
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
                text: `Analiza esta imagen de un ticket, factura o recibo.
Extrae la siguiente informacion y devolvela SOLO como JSON valido (sin markdown, sin explicaciones):

{
  "date": "YYYY-MM-DD",
  "description": "descripcion breve del gasto o ingreso",
  "amount": "1234.56",
  "type": "expense"
}

Notas:
- date: si no se puede leer la fecha, usa la fecha de hoy
- amount: numero positivo sin signo de moneda
- type: "expense" para gastos/compras, "income" para ingresos/cobros
- description: maximo 100 caracteres, en espanol`,
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
    })
  } catch (error) {
    console.error('OCR error:', error)
    return NextResponse.json(
      { error: 'Error al procesar la imagen: ' + (error as Error).message },
      { status: 500 }
    )
  }
}
