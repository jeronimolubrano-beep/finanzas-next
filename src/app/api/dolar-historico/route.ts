import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface BluelyticsHistorical {
  oficial: { value_buy: number; value_sell: number }
  blue:    { value_buy: number; value_sell: number }
  last_update: string
}

export async function GET(request: NextRequest) {
  const day = request.nextUrl.searchParams.get('day')

  // Validar formato YYYY-MM-DD
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return NextResponse.json(
      { error: 'Parámetro day requerido en formato YYYY-MM-DD' },
      { status: 400 }
    )
  }

  // No permitir fechas futuras
  const today = new Date().toISOString().slice(0, 10)
  if (day > today) {
    return NextResponse.json(
      { error: 'No se pueden consultar fechas futuras' },
      { status: 400 }
    )
  }

  try {
    const res = await fetch(
      `https://api.bluelytics.com.ar/v2/historical?day=${day}`,
      { next: { revalidate: 3600 } } // cache 1 hora — el TC histórico no cambia
    )

    // Bluelytics devuelve 404 para fines de semana y feriados bancarios
    if (res.status === 404) {
      return NextResponse.json(
        { error: 'Sin datos para esa fecha (feriado o fin de semana)' },
        { status: 404 }
      )
    }

    if (!res.ok) {
      throw new Error(`Bluelytics HTTP ${res.status}`)
    }

    const data: BluelyticsHistorical = await res.json()

    return NextResponse.json({
      day,
      oficial_venta: data.oficial.value_sell,
      oficial_compra: data.oficial.value_buy,
      blue_venta: data.blue.value_sell,
      blue_compra: data.blue.value_buy,
    })
  } catch (err) {
    console.error('[dolar-historico]', err)
    return NextResponse.json(
      { error: 'Error al consultar TC histórico' },
      { status: 500 }
    )
  }
}
