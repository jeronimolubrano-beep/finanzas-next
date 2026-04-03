'use client'

import { useState, useRef, useEffect } from 'react'
import { Sparkles, Send, Loader2, Trash2, TrendingUp, DollarSign, BarChart3, HelpCircle } from 'lucide-react'

type Message = {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const EXAMPLE_QUERIES = [
  {
    icon: DollarSign,
    label: 'Gastos del mes',
    query: '¿Cuánto gasté este mes y en qué categorías?',
  },
  {
    icon: TrendingUp,
    label: 'Resultado neto',
    query: '¿Cuál es mi resultado neto de los últimos 3 meses?',
  },
  {
    icon: BarChart3,
    label: 'Top categorías',
    query: '¿Cuáles son mis categorías de gasto más altas?',
  },
  {
    icon: HelpCircle,
    label: 'Pagos pendientes',
    query: '¿Cuántos pagos pendientes tengo y cuáles son?',
  },
  {
    icon: DollarSign,
    label: 'Comparar meses',
    query: 'Compará mis ingresos y gastos de los últimos meses',
  },
  {
    icon: TrendingUp,
    label: 'Análisis empresa',
    query: '¿Cuál es la empresa con más movimiento?',
  },
]

export default function AIPage() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  async function handleSend(text?: string) {
    const query = (text ?? input).trim()
    if (!query || loading) return

    setInput('')
    setError(null)

    const userMsg: Message = { role: 'user', content: query, timestamp: new Date() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setLoading(true)

    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Error al consultar el asistente')
        setLoading(false)
        return
      }

      setMessages([
        ...newMessages,
        { role: 'assistant', content: data.message, timestamp: new Date() },
      ])
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function clearChat() {
    setMessages([])
    setError(null)
  }

  const hasMessages = messages.length > 0

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #6439ff 0%, #8b5cf6 100%)' }}
          >
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#06083f' }}>
              Consultas IA
            </h1>
            <p className="text-sm" style={{ color: '#8b8ec0' }}>
              Preguntá sobre tus datos financieros en lenguaje natural
            </p>
          </div>
        </div>
      </div>

      {/* Search input (always visible at top) */}
      <div
        className="rounded-2xl border p-4 mb-6 sticky top-2 z-10"
        style={{ background: 'white', borderColor: '#e0e0ef', boxShadow: '0 4px 20px rgba(6,8,63,0.06)' }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSend()
          }}
          className="flex gap-3"
        >
          <div className="flex-1 relative">
            <Sparkles
              className="absolute left-3.5 top-3 w-4 h-4"
              style={{ color: '#8b8ec0' }}
            />
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="¿Cuánto gasté en marzo? ¿Cuál es mi categoría más cara? ..."
              disabled={loading}
              className="w-full rounded-xl pl-10 pr-4 py-2.5 text-sm border outline-none transition resize-none focus:border-[#6439ff] focus:ring-1 focus:ring-[#6439ff]/20"
              style={{ borderColor: '#e0e0ef', color: '#06083f', minHeight: '42px' }}
            />
          </div>
          <div className="flex items-start gap-2">
            {hasMessages && (
              <button
                type="button"
                onClick={clearChat}
                className="h-[42px] px-3 rounded-xl border transition hover:bg-gray-50 flex items-center"
                style={{ borderColor: '#e0e0ef' }}
                title="Limpiar conversación"
              >
                <Trash2 className="w-4 h-4" style={{ color: '#8b8ec0' }} />
              </button>
            )}
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="h-[42px] px-5 rounded-xl flex items-center gap-2 text-white text-sm font-medium transition-all disabled:opacity-40 hover:opacity-90"
              style={{ background: '#6439ff' }}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Consultar
            </button>
          </div>
        </form>
      </div>

      {/* Empty state: Example queries */}
      {!hasMessages && !loading && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: '#8b8ec0' }}>
            Consultas sugeridas
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {EXAMPLE_QUERIES.map((eq) => (
              <button
                key={eq.label}
                onClick={() => handleSend(eq.query)}
                className="rounded-xl border p-4 text-left hover:border-[#6439ff] hover:shadow-sm transition group"
                style={{ background: 'white', borderColor: '#e8e8f0' }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <eq.icon
                    className="w-4 h-4 transition group-hover:text-[#6439ff]"
                    style={{ color: '#8b8ec0' }}
                  />
                  <span className="text-sm font-medium group-hover:text-[#6439ff]" style={{ color: '#06083f' }}>
                    {eq.label}
                  </span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: '#8b8ec0' }}>
                  {eq.query}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Conversation */}
      {hasMessages && (
        <div ref={scrollRef} className="space-y-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.role === 'assistant' && (
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-1"
                  style={{ background: 'rgba(100,57,255,0.1)' }}
                >
                  <Sparkles className="w-4 h-4" style={{ color: '#6439ff' }} />
                </div>
              )}
              <div
                className={`rounded-2xl px-4 py-3 text-sm max-w-[80%] whitespace-pre-wrap leading-relaxed ${
                  m.role === 'user' ? 'text-white' : ''
                }`}
                style={
                  m.role === 'user'
                    ? {
                        background: 'linear-gradient(135deg, #6439ff 0%, #7c4dff 100%)',
                        borderBottomRightRadius: '6px',
                      }
                    : {
                        background: 'white',
                        color: '#06083f',
                        border: '1px solid #e8e8f0',
                        borderBottomLeftRadius: '6px',
                      }
                }
              >
                {m.content}
              </div>
              {m.role === 'user' && (
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-1 text-xs font-bold text-white"
                  style={{ background: '#06083f' }}
                >
                  Vos
                </div>
              )}
            </div>
          ))}

          {/* Loading */}
          {loading && (
            <div className="flex gap-3 justify-start">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-1"
                style={{ background: 'rgba(100,57,255,0.1)' }}
              >
                <Sparkles className="w-4 h-4" style={{ color: '#6439ff' }} />
              </div>
              <div
                className="rounded-2xl px-4 py-3 text-sm flex items-center gap-2"
                style={{ background: 'white', border: '1px solid #e8e8f0' }}
              >
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#6439ff' }} />
                <span style={{ color: '#8b8ec0' }}>Analizando tus datos...</span>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div
              className="rounded-xl px-4 py-3 text-sm"
              style={{ background: 'rgba(254,73,98,0.06)', color: '#fe4962', border: '1px solid rgba(254,73,98,0.15)' }}
            >
              ⚠️ {error}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
