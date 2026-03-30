import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const res = await fetch('https://dolarapi.com/v1/dolares', {
      next: { revalidate: 300 }, // cache 5 minutos
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'Error al consultar DolarAPI' }, { status: 500 })
    }

    const data = await res.json()

    // Filtrar los tipos que nos interesan
    const tipos = ['oficial', 'blue', 'bolsa', 'contadoconliqui', 'tarjeta']
    const filtered = data
      .filter((d: { casa: string }) => tipos.includes(d.casa))
      .map((d: { casa: string; nombre: string; compra: number; venta: number; fechaActualizacion: string }) => ({
        casa: d.casa,
        nombre: d.nombre,
        compra: d.compra,
        venta: d.venta,
        fecha: d.fechaActualizacion,
      }))

    return NextResponse.json(filtered)
  } catch (error) {
    return NextResponse.json(
      { error: 'Error de red: ' + (error as Error).message },
      { status: 500 }
    )
  }
}
