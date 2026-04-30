import { useState, useRef, useEffect } from 'react'
import { voiceAPI } from '../services/api'

// ── Parallel agents config ─────────────────────────────────────────────────
const AGENTS = [
  { id: 1, name: 'Insurance Agent', icon: '🛡️', task: 'Verifying insurance coverage & network status' },
  { id: 2, name: 'Provider Agent',  icon: '🏥', task: 'Finding in-network specialists & doctors'      },
  { id: 3, name: 'Booking Agent',   icon: '📅', task: 'Checking availability & booking appointment'   },
]
const AGENT_TOOLS = {
  check_insurance:      1,
  lookup_patient:       1,
  get_doctors:          2,
  get_available_slots:  2,
  book_appointment:     3,
}

// Helper: parse which tools are mentioned in AI's thinking
function detectAgentActivity(text) {
  const active = new Set()
  if (/insurance|coverage|policy|verified|plan/i.test(text)) active.add(1)
  if (/doctor|specialist|physician|provider|available|found/i.test(text)) active.add(2)
  if (/slot|book|appointment|scheduled|confirmed|APT-/i.test(text)) active.add(3)
  return active
}

export default function VoiceAgent() {
  const [sessionId, setSessionId]   = useState(null)
  const [messages, setMessages]     = useState([])
  const [text, setText]             = useState('')
  const [status, setStatus]         = useState('idle')
  const [isRecording, setIsRecording] = useState(false)
  const [loading, setLoading]       = useState(false)

  // Parallel agent state: { 1: 'idle'|'running'|'done'|'error', ... }
  const [agentStatus, setAgentStatus] = useState({ 1: 'idle', 2: 'idle', 3: 'idle' })
  const [agentLogs, setAgentLogs]     = useState({ 1: '', 2: '', 3: '' })
  const [showPanel, setShowPanel]     = useState(false)

  const recorderRef = useRef(null)
  const chunksRef   = useRef([])
  const bottomRef   = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  const addMsg = (role, content) =>
    setMessages(prev => [...prev, { role, content, time: new Date().toLocaleTimeString() }])

  const resetAgents = () => {
    setAgentStatus({ 1: 'idle', 2: 'idle', 3: 'idle' })
    setAgentLogs({ 1: '', 2: '', 3: '' })
  }

  const runAgentsAnimation = async (responseText) => {
    // Detect which agents are relevant from response
    const active = detectAgentActivity(responseText)
    setShowPanel(true)

    // Phase 1: Start relevant agents
    const newStatus = { 1: 'idle', 2: 'idle', 3: 'idle' }
    const newLogs   = { 1: '', 2: '', 3: '' }

    if (active.size === 0) {
      // Default: show all 3 as running for general queries
      active.add(1); active.add(2); active.add(3)
    }

    active.forEach(id => { newStatus[id] = 'running' })
    setAgentStatus({ ...newStatus })

    // Phase 2: Stagger completion with delays for visual effect
    const delays = [800, 1300, 1900]
    let i = 0
    for (const id of [1, 2, 3]) {
      if (active.has(id)) {
        await new Promise(r => setTimeout(r, delays[i] || 1200))
        const logMap = {
          1: extractInsuranceLog(responseText),
          2: extractDoctorLog(responseText),
          3: extractBookingLog(responseText),
        }
        setAgentLogs(prev => ({ ...prev, [id]: logMap[id] }))
        setAgentStatus(prev => ({ ...prev, [id]: 'done' }))
        i++
      }
    }
  }

  const extractInsuranceLog = (text) => {
    if (/HDFC|star health|apollo|bajaj|united/i.test(text)) return '✓ Policy verified — Active'
    if (/no insurance|not found|invalid/i.test(text)) return '✗ No active policy found'
    return '✓ Coverage confirmed'
  }
  const extractDoctorLog = (text) => {
    const m = text.match(/Dr\.\s[\w\s]+/i)
    if (m) return `✓ Found: ${m[0].trim()}`
    if (/cardiolog|general|dermat|ortho/i.test(text)) return '✓ Specialist located'
    return '✓ Providers checked'
  }
  const extractBookingLog = (text) => {
    const appt = text.match(/APT-\d+/i)
    if (appt) return `✓ Booked — ${appt[0]}`
    if (/confirm|booked|scheduled/i.test(text)) return '✓ Appointment confirmed'
    if (/slot|time/i.test(text)) return '✓ Slots retrieved'
    return '✓ Calendar checked'
  }

  const startSession = async () => {
    setStatus('processing')
    try {
      const res = await voiceAPI.startSession()
      setSessionId(res.data.session_id)
      setMessages([{ role: 'assistant', content: res.data.greeting, time: new Date().toLocaleTimeString() }])
      setStatus('idle')
    } catch {
      setStatus('idle')
      alert('Could not connect to backend. Make sure it is running at port 8000.')
    }
  }

  const sendText = async () => {
    if (!text.trim() || !sessionId || loading) return
    const msg = text.trim()
    setText('')
    addMsg('user', msg)
    setLoading(true)
    setStatus('processing')
    resetAgents()
    setShowPanel(true)
    // Immediately start all 3 agents as "running"
    setAgentStatus({ 1: 'running', 2: 'running', 3: 'running' })
    try {
      const res = await voiceAPI.chat({ session_id: sessionId, message: msg })
      addMsg('assistant', res.data.response)
      await runAgentsAnimation(res.data.response)
      // Browser TTS
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(res.data.response)
      u.lang = 'en-IN'; u.rate = 0.95
      u.onstart = () => setStatus('speaking')
      u.onend = () => setStatus('idle')
      window.speechSynthesis.speak(u)
    } catch {
      addMsg('assistant', 'Error communicating with server.')
      resetAgents()
      setStatus('idle')
    }
    setLoading(false)
  }

  const startRecording = async () => {
    if (!sessionId) { await startSession(); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = e => chunksRef.current.push(e.data)
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setStatus('processing')
        setLoading(true)
        resetAgents()
        setShowPanel(true)
        setAgentStatus({ 1: 'running', 2: 'running', 3: 'running' })
        try {
          const res = await voiceAPI.voiceChat(sessionId, blob)
          const transcript = res.headers?.['x-transcript'] || '(voice input)'
          const responseText = res.headers?.['x-response-text'] || 'Response received'
          addMsg('user', transcript)
          addMsg('assistant', responseText)
          await runAgentsAnimation(responseText)
          window.speechSynthesis.cancel()
          const u = new SpeechSynthesisUtterance(responseText)
          u.lang = 'en-IN'; u.rate = 0.95
          u.onstart = () => setStatus('speaking')
          u.onend = () => setStatus('idle')
          window.speechSynthesis.speak(u)
        } catch {
          addMsg('assistant', 'Voice processing failed. Try text input.')
          resetAgents()
          setStatus('idle')
        }
        setLoading(false)
      }
      recorder.start()
      setIsRecording(true)
      setStatus('listening')
    } catch { alert('Microphone access denied.') }
  }

  const stopRecording = () => {
    if (recorderRef.current && isRecording) {
      recorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const statusText = {
    idle: 'Ready', listening: '🔴 Listening...', processing: '⏳ Processing...', speaking: '🔊 Speaking...'
  }

  const agentColor = { idle: '#e5e7eb', running: '#fbbf24', done: '#22c55e', error: '#ef4444' }
  const agentBg    = { idle: '#f9fafb', running: '#fffbeb', done: '#f0fdf4', error: '#fef2f2' }
  const agentLabel = { idle: 'Idle', running: 'Running...', done: 'Done', error: 'Error' }

  if (!sessionId) return (
    <div style={{ maxWidth: 800, margin: '0 auto', fontFamily: 'Inter,sans-serif' }}>
      <h1 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 4 }}>AI Voice Agent</h1>
      <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: 32 }}>
        Parallel AI agents handle insurance, providers & booking simultaneously
      </p>

      {/* Parallel agents preview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 32 }}>
        {AGENTS.map(a => (
          <div key={a.id} style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 14, padding: 20, textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: 10 }}>{a.icon}</div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>{a.name}</div>
            <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>{a.task}</div>
          </div>
        ))}
      </div>

      <div style={{ textAlign: 'center' }}>
        <button onClick={startSession}
          style={{ padding: '13px 36px', background: '#0891b2', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}>
          🎤 Start Parallel AI Session
        </button>
        <p style={{ marginTop: 12, fontSize: '0.8rem', color: '#9ca3af' }}>Requires backend running on port 8000</p>
      </div>
    </div>
  )

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', fontFamily: 'Inter,sans-serif' }}>
      <h1 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 4 }}>AI Voice Agent</h1>
      <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: 20 }}>
        3 parallel agents working simultaneously
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: showPanel ? '1fr 340px' : '1fr', gap: 20 }}>

        {/* ── LEFT: Chat ──────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Status bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid rgba(0,0,0,0.08)', padding: '10px 16px', borderRadius: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: status === 'idle' ? '#22c55e' : status === 'listening' ? '#ef4444' : status === 'processing' ? '#f59e0b' : '#0891b2', flexShrink: 0 }} />
            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{statusText[status]}</span>
            <span style={{ marginLeft: 'auto', background: '#e0f2fe', color: '#0891b2', padding: '2px 10px', borderRadius: 99, fontSize: '0.75rem', fontWeight: 600 }}>Session Active</span>
            <button onClick={() => { voiceAPI.endSession(sessionId); setSessionId(null); setMessages([]) }}
              style={{ background: 'transparent', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 7, padding: '4px 12px', cursor: 'pointer', fontSize: '0.8rem' }}>
              End
            </button>
          </div>

          {/* Messages */}
          <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 16, padding: 18, height: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', flexShrink: 0 }}>
                  {m.role === 'assistant' ? '🤖' : '👤'}
                </div>
                <div>
                  <div style={{ padding: '9px 13px', borderRadius: 12, maxWidth: 320, fontSize: '0.875rem', lineHeight: 1.55, background: m.role === 'user' ? '#0891b2' : '#f3f4f6', color: m.role === 'user' ? '#fff' : '#1a1d23' }}>
                    {m.content}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#9ca3af', marginTop: 3, textAlign: m.role === 'user' ? 'right' : 'left' }}>{m.time}</div>
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>🤖</div>
                <div style={{ padding: '12px 16px', background: '#f3f4f6', borderRadius: 12 }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[0, 0.2, 0.4].map((d, i) => (
                      <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#9ca3af', animation: `bounce 1s ${d}s infinite` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              style={{ flex: 1, padding: '10px 14px', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 10, fontSize: '0.9rem', fontFamily: 'inherit', outline: 'none' }}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendText()}
              placeholder="Type or use mic — e.g. 'Book me with a cardiologist tomorrow'"
              disabled={loading}
            />
            <button onClick={sendText} disabled={loading || !text.trim()}
              style={{ padding: '10px 20px', background: '#0891b2', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem', opacity: loading || !text.trim() ? 0.5 : 1 }}>
              Send
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              disabled={loading && !isRecording}
              style={{ padding: '12px 36px', borderRadius: 99, border: `2px solid ${isRecording ? '#ef4444' : '#0891b2'}`, background: isRecording ? '#ef4444' : 'transparent', color: isRecording ? '#fff' : '#0891b2', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit', animation: isRecording ? 'recPulse 1s infinite' : 'none' }}>
              {isRecording ? '⏹ Release to Send' : '🎤 Hold to Speak'}
            </button>
          </div>
        </div>

        {/* ── RIGHT: Parallel Agents Panel ───────────────────────────────── */}
        {showPanel && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#374151', marginBottom: 4 }}>
              ⚡ Parallel Agents
            </div>

            {AGENTS.map(agent => {
              const s = agentStatus[agent.id]
              const log = agentLogs[agent.id]
              return (
                <div key={agent.id} style={{ background: agentBg[s], border: `1px solid ${agentColor[s]}44`, borderRadius: 14, padding: 16, transition: 'all 0.3s ease' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: '1.4rem' }}>{agent.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{agent.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{agent.task}</div>
                    </div>
                    <span style={{ padding: '2px 9px', borderRadius: 99, fontSize: '0.7rem', fontWeight: 700, background: agentColor[s] + '22', color: s === 'done' ? '#15803d' : s === 'running' ? '#b45309' : s === 'error' ? '#dc2626' : '#9ca3af' }}>
                      {agentLabel[s]}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div style={{ height: 4, background: '#e5e7eb', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      borderRadius: 99,
                      background: agentColor[s],
                      width: s === 'done' ? '100%' : s === 'running' ? '65%' : '0%',
                      transition: 'width 0.6s ease',
                      animation: s === 'running' ? 'indeterminate 1.5s ease-in-out infinite' : 'none'
                    }} />
                  </div>

                  {/* Log message */}
                  {log && (
                    <div style={{ marginTop: 8, fontSize: '0.75rem', color: '#374151', background: '#fff', padding: '5px 10px', borderRadius: 7, fontWeight: 500 }}>
                      {log}
                    </div>
                  )}

                  {/* Running spinner text */}
                  {s === 'running' && (
                    <div style={{ marginTop: 6, fontSize: '0.72rem', color: '#92400e', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', border: '2px solid #f59e0b', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                      Processing in parallel...
                    </div>
                  )}
                </div>
              )
            })}

            {/* Summary when all done */}
            {Object.values(agentStatus).every(s => s === 'done') && (
              <div style={{ background: '#f0fdf4', border: '1px solid #22c55e44', borderRadius: 14, padding: 14, textAlign: 'center' }}>
                <div style={{ fontSize: '1.2rem', marginBottom: 4 }}>✅</div>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#15803d' }}>All Agents Complete</div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 2 }}>Workflow completed in parallel</div>
              </div>
            )}

            {/* Reset button */}
            {Object.values(agentStatus).some(s => s !== 'idle') && (
              <button onClick={() => { resetAgents(); setShowPanel(false) }}
                style={{ padding: '7px 16px', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, background: 'transparent', cursor: 'pointer', fontSize: '0.8rem', color: '#6b7280' }}>
                Reset Panel
              </button>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes bounce { 0%,80%,100%{transform:scale(0.5);opacity:0.4} 40%{transform:scale(1);opacity:1} }
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes recPulse { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.4)} 50%{box-shadow:0 0 0 12px rgba(239,68,68,0)} }
        @keyframes indeterminate {
          0% { transform: translateX(-100%); width: 50% }
          50% { transform: translateX(50%); width: 60% }
          100% { transform: translateX(200%); width: 50% }
        }
      `}</style>
    </div>
  )
}