import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Navbar } from '@/components/Navbar'
import { Toaster } from 'react-hot-toast'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Grupo Lubrano',
  description: 'Sistema de gestion financiera familiar',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className={`${inter.className} min-h-screen`} style={{ background: '#1a1f4e' }}>
        <Navbar />
        <main className="container mx-auto px-4 py-6 max-w-7xl">
          {children}
        </main>
        <Toaster position="top-right" />
      </body>
    </html>
  )
}
