'use client'

import { useState, useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { MessageCircle, X, Send, Sparkles, Loader2 } from 'lucide-react'

type Message = {
  role: 'user' | 'assistant'
  content: string
}

export function AIChat() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Hide on auth pages
  const authPages = ['/login', '/signup', '/forgot-password', '/reset-password']
  if (authPages.includes(pathname)) return null

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  // Focus input when opening
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
    }
  }, [open])

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return

    setInput('')
    setError(null)

    const userMsg: Message = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setLoading(true)

    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Error al consultar el asistente')
        setLoading(false)
        return
      }

      setMessages([...newMessages, { role: 'assistant', content: data.message }])
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  const suggestions = [
    '¿Cuánto gasté este mes?',
    '¿Cuál es mi resultado neto?',
    '¿Tengo pagos pendientes?',
    '¿Cómo agrego una transacción?',
  ]

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        style={{
          background: 'linear-gradient(135deg, #6439ff 0%, #8b5cf6 100%)',
          boxShadow: '0 4px 20px rgba(100, 57, 255, 0.4)',
        }}
        title="Asistente IA"
      >
        {open ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <Sparkles className="w-6 h-6 text-white" />
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-24 right-5 z-50 w-[380px] max-w-[calc(100vw-2.5rem)] rounded-2xl shadow-2xl border flex flex-col overflow-hidden"
          style={{
            height: 'min(520px, calc(100vh - 140px))',
            background: '#ffffff',
            borderColor: '#e0e0ef',
            boxShadow: '0 8px 40px rgba(6, 8, 63, 0.15)',
          }}
        >
          {/* Header */}
          <div
            className="px-4 py-3 flex items-center gap-3 shrink-0"
            style={{
              background: 'linear-gradient(135deg, #06083f 0%, #1a1c5c 100%)',
            }}
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(100,57,255,0.3)' }}>
              <Sparkles className="w-4 h-4 text-purple-300" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">Asistente IA</p>
              <p className="text-xs text-purple-300">Preguntame sobre tus finanzas</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white transition">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ background: '#f8f8fc' }}>
            {/* Welcome message */}
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="rounded-xl px-3.5 py-2.5 text-sm max-w-[85%]" style={{ background: 'white', color: '#06083f', border: '1px solid #e8e8f0' }}>
                  👋 ¡Hola! Soy tu asistente financiero. Puedo ayudarte con datos, KPIs y dudas sobre la app. ¿Qué necesitás?
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setInput(s)
                        setTimeout(() => {
                          setInput('')
                          const userMsg: Message = { role: 'user', content: s }
                          const newMsgs = [userMsg]
                          setMessages(newMsgs)
                          setLoading(true)
                          fetch('/api/ai-chat', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ messages: newMsgs }),
                          })
                            .then(r => r.json())
                            .then(data => {
                              if (data.message) setMessages([...newMsgs, { role: 'assistant', content: data.message }])
                              else setError(data.error || 'Error')
                            })
                            .catch(() => setError('Error de conexión'))
                            .finally(() => setLoading(false))
                        }, 0)
                      }}
                      className="text-xs px-2.5 py-1.5 rounded-full border transition hover:border-[#6439ff] hover:text-[#6439ff]"
                      style={{ borderColor: '#e0e0ef', color: '#8b8ec0', background: 'white' }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message bubbles */}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`rounded-xl px-3.5 py-2.5 text-sm max-w-[85%] whitespace-pre-wrap leading-relaxed ${
                    m.role === 'user'
                      ? 'text-white'
                      : ''
                  }`}
                  style={
                    m.role === 'user'
                      ? { background: '#6439ff' }
                      : { background: 'white', color: '#06083f', border: '1px solid #e8e8f0' }
                  }
                >
                  {m.content}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-xl px-3.5 py-2.5 text-sm flex items-center gap-2" style={{ background: 'white', border: '1px solid #e8e8f0' }}>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: '#6439ff' }} />
                  <span style={{ color: '#8b8ec0' }}>Pensando...</span>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="rounded-xl px-3.5 py-2.5 text-xs" style={{ background: 'rgba(254,73,98,0.08)', color: '#fe4962' }}>
                ⚠️ {error}
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="px-3 py-3 border-t shrink-0" style={{ borderColor: '#e8e8f0', background: 'white' }}>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSend()
              }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Preguntá algo..."
                disabled={loading}
                className="flex-1 rounded-xl px-3.5 py-2 text-sm border outline-none transition focus:border-[#6439ff]"
                style={{ borderColor: '#e0e0ef', color: '#06083f' }}
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-40 hover:opacity-90"
                style={{ background: '#6439ff' }}
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
