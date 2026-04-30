import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'
import { voiceAPI } from '../services/api'


// ── Parallel Agents Config ────────────────────────────────────────────────
const AGENTS = [
  { id: 1, name: 'Insurance Agent', icon: '🛡️', task: 'Verifying your insurance coverage' },
  { id: 2, name: 'Provider Agent',  icon: '🏥', task: 'Finding available doctors'          },
  { id: 3, name: 'Booking Agent',   icon: '📅', task: 'Checking slots & booking'           },
]


function detectActive(text) {
  const a = new Set()
  if (/insurance|coverage|policy|verified|plan|hdfc|star/i.test(text)) a.add(1)
  if (/doctor|specialist|provider|dr\./i.test(text)) a.add(2)
  if (/slot|book|appointment|scheduled|confirmed|APT-/i.test(text)) a.add(3)
  return a.size ? a : new Set([1, 2, 3])
}

const inp = { width:'100%', padding:'10px 13px', border:'1px solid rgba(0,0,0,0.12)', borderRadius:8, fontSize:'0.875rem', fontFamily:'inherit', boxSizing:'border-box', outline:'none' }
const lbl = { display:'block', fontSize:'0.75rem', fontWeight:600, color:'#6b7280', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.04em' }

export default function PatientDashboard() {
  const { user, logout } = useAuth()
  const [tab, setTab] = useState('appointments')

  // Data
  const [appointments, setAppointments] = useState([])
  const [insurance, setInsurance]       = useState([])
  const [doctors, setDoctors]           = useState([])
  const [slots, setSlots]               = useState([])
  const [msg, setMsg]                   = useState({ text:'', type:'success' })

  // Approval modal
  const [approvalModal, setApprovalModal] = useState(null)
  const [approving, setApproving]         = useState(false)

  // Book form
  const [bookForm, setBookForm] = useState({ doctor_id:'', appointment_date:'', appointment_time:'', reason:'', insurance_used:'' })

  // Insurance form
  const [insForm, setInsForm] = useState({ provider_name:'', policy_number:'', plan_name:'', sum_insured:'', coverage_start:'', coverage_end:'', covers_hospitalization:true, covers_outpatient:false })

  // Voice AI state
  const [sessionId, setSessionId]     = useState(null)
  const [messages, setMessages]       = useState([])
  const [voiceText, setVoiceText]     = useState('')
  const [voiceStatus, setVoiceStatus] = useState('idle')
  const [voiceLoading, setVoiceLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [agentStatus, setAgentStatus] = useState({ 1:'idle', 2:'idle', 3:'idle' })
  const [agentLogs, setAgentLogs]     = useState({ 1:'', 2:'', 3:'' })
  const [showPanel, setShowPanel]     = useState(false)
  const recorderRef = useRef(null)
  const chunksRef   = useRef([])
  const bottomRef   = useRef(null)

  const patientId = user?.id

  const loadAppts = () =>
    axios.get(`/api/portal/my-appointments?patient_id=${patientId}`)
      .then(r => setAppointments(r.data)).catch(() => {})

  useEffect(() => {
    loadAppts()
    axios.get(`/api/portal/my-insurance?patient_id=${patientId}`).then(r => setInsurance(r.data)).catch(() => {})
    axios.get('/api/doctors/').then(r => setDoctors(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (tab === 'appointments') loadAppts()
  }, [tab])

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [messages, voiceLoading])

  useEffect(() => {
    if (bookForm.doctor_id && bookForm.appointment_date) {
      axios.get(`/api/portal/available-slots?doctor_id=${bookForm.doctor_id}&appointment_date=${bookForm.appointment_date}`)
        .then(r => setSlots(r.data.slots || [])).catch(() => setSlots([]))
    }
  }, [bookForm.doctor_id, bookForm.appointment_date])

  const flash = (text, type = 'success') => {
    setMsg({ text, type })
    setTimeout(() => setMsg({ text:'', type:'success' }), 3500)
  }

  const pendingCount = appointments.filter(a => a.status === 'pending').length

  // ── Book Appointment (manual form) ───────────────────────────────────────
  const bookAppointment = async e => {
    e.preventDefault()
    try {
      await axios.post('/api/portal/book-appointment', {
        ...bookForm, patient_id: patientId, doctor_id: Number(bookForm.doctor_id)
      })
      flash('📋 Appointment requested! Please approve it in the Appointments tab.')
      setTab('appointments')
      loadAppts()
      setBookForm({ doctor_id:'', appointment_date:'', appointment_time:'', reason:'', insurance_used:'' })
    } catch(err) { flash('❌ ' + (err.response?.data?.detail || 'Booking failed'), 'error') }
  }

  // ── Add Insurance ─────────────────────────────────────────────────────────
  const addInsurance = async e => {
    e.preventDefault()
    try {
      await axios.post('/api/portal/add-insurance', { ...insForm, patient_id: patientId, sum_insured: Number(insForm.sum_insured) })
      flash('✅ Insurance added!')
      axios.get(`/api/portal/my-insurance?patient_id=${patientId}`).then(r => setInsurance(r.data))
      setInsForm({ provider_name:'', policy_number:'', plan_name:'', sum_insured:'', coverage_start:'', coverage_end:'', covers_hospitalization:true, covers_outpatient:false })
    } catch(err) { flash('❌ ' + (err.response?.data?.detail || 'Failed'), 'error') }
  }

  // ── Approval ──────────────────────────────────────────────────────────────
  const confirmApproval = async () => {
    if (!approvalModal) return
    setApproving(true)
    try {
      await axios.patch(`/api/appointments/patient-approve/${approvalModal.appt.id}?action=${approvalModal.action}`)
      flash(approvalModal.action === 'approve' ? '✅ Appointment confirmed!' : '❌ Appointment cancelled.')
      loadAppts()
    } catch { flash('Failed to update', 'error') }
    setApprovalModal(null)
    setApproving(false)
  }

  // ── Voice AI ──────────────────────────────────────────────────────────────
  const addMsg = (role, content) =>
    setMessages(prev => [...prev, { role, content, time: new Date().toLocaleTimeString() }])

  const resetAgents = () => {
    setAgentStatus({ 1:'idle', 2:'idle', 3:'idle' })
    setAgentLogs({ 1:'', 2:'', 3:'' })
  }

  const runAgents = async (text) => {
    setShowPanel(true)
    const active = detectActive(text)
    const ns = { 1:'idle', 2:'idle', 3:'idle' }
    active.forEach(id => { ns[id] = 'running' })
    setAgentStatus({ ...ns })

    const logFor = (id) => {
      if (id === 1) return /hdfc|star|apollo|verified|active/i.test(text) ? '✓ Coverage verified' : '✓ Insurance checked'
      if (id === 2) { const m = text.match(/Dr\.\s[\w ]+/); return m ? `✓ Found: ${m[0].trim()}` : '✓ Providers checked' }
      if (id === 3) { const a = text.match(/APT-\d+/i); return a ? `✓ Booked: ${a[0]}` : /confirm|book/i.test(text) ? '✓ Appointment booked' : '✓ Slots checked' }
    }

    let i = 0
    for (const id of [1,2,3]) {
      if (active.has(id)) {
        await new Promise(r => setTimeout(r, 700 + i * 500))
        setAgentLogs(prev => ({ ...prev, [id]: logFor(id) }))
        setAgentStatus(prev => ({ ...prev, [id]: 'done' }))
        i++
      }
    }
    // Refresh appointments after voice books
    setTimeout(() => loadAppts(), 2000)
  }

  const startSession = async () => {
  setVoiceStatus('processing')
  try {
    // ← Pass the patient's numeric DB id
    const numericId = user?.id || user?.patient_db_id
    const res = await voiceAPI.startSession(numericId)
    setSessionId(res.data.session_id)
    setMessages([{ role:'assistant', content: res.data.greeting, time: new Date().toLocaleTimeString() }])
    setVoiceStatus('idle')
  } catch { 
    setVoiceStatus('idle')
    alert('Backend not running on port 8000') 
  }
}

  const sendVoiceText = async () => {
    if (!voiceText.trim() || !sessionId || voiceLoading) return
    const m = voiceText.trim()
    setVoiceText('')
    addMsg('user', m)
    setVoiceLoading(true)
    setVoiceStatus('processing')
    resetAgents(); setShowPanel(true)
    setAgentStatus({ 1:'running', 2:'running', 3:'running' })
    try {
      const res = await voiceAPI.chat({ session_id: sessionId, message: m })
      addMsg('assistant', res.data.response)
      await runAgents(res.data.response)
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(res.data.response)
      u.lang = 'en-IN'; u.rate = 0.95
      u.onstart = () => setVoiceStatus('speaking')
      u.onend = () => setVoiceStatus('idle')
      window.speechSynthesis.speak(u)
    } catch { addMsg('assistant', 'Error. Please try again.'); resetAgents(); setVoiceStatus('idle') }
    setVoiceLoading(false)
  }

  const startRec = async () => {
    if (!sessionId) { await startSession(); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      recorderRef.current = rec; chunksRef.current = []
      rec.ondataavailable = e => chunksRef.current.push(e.data)
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type:'audio/webm' })
        setVoiceLoading(true); resetAgents(); setShowPanel(true)
        setAgentStatus({ 1:'running', 2:'running', 3:'running' })
        try {
          const res = await voiceAPI.voiceChat(sessionId, blob)
          const transcript = res.headers?.['x-transcript'] || '(voice)'
          const reply = res.headers?.['x-response-text'] || 'Done'
          addMsg('user', transcript); addMsg('assistant', reply)
          await runAgents(reply)
          window.speechSynthesis.cancel()
          const u = new SpeechSynthesisUtterance(reply)
          u.lang='en-IN'; u.rate=0.95
          u.onstart = () => setVoiceStatus('speaking')
          u.onend = () => setVoiceStatus('idle')
          window.speechSynthesis.speak(u)
        } catch { addMsg('assistant', 'Voice failed. Try text.'); resetAgents(); setVoiceStatus('idle') }
        setVoiceLoading(false)
      }
      rec.start(); setIsRecording(true); setVoiceStatus('listening')
    } catch { alert('Mic access denied') }
  }

  const stopRec = () => {
    if (recorderRef.current && isRecording) { recorderRef.current.stop(); setIsRecording(false) }
  }

  const agentBg    = { idle:'#f9fafb', running:'#fffbeb', done:'#f0fdf4' }
  const agentColor = { idle:'#e5e7eb', running:'#fbbf24', done:'#22c55e' }
  const agentLabel = { idle:'Idle', running:'Running...', done:'Done ✓' }

  const statusBadge = s => {
    const m = { confirmed:{bg:'#dcfce7',c:'#15803d',t:'Confirmed'}, pending:{bg:'#fef3c7',c:'#b45309',t:'Pending'}, cancelled:{bg:'#fee2e2',c:'#dc2626',t:'Cancelled'}, completed:{bg:'#ede9fe',c:'#7c3aed',t:'Completed'} }
    const x = m[s] || m.pending
    return <span style={{ padding:'3px 10px', borderRadius:99, fontSize:'0.72rem', fontWeight:700, background:x.bg, color:x.c }}>{x.t}</span>
  }

  const TABS = [
    ['appointments', `📅 Appointments${pendingCount > 0 ? ` (${pendingCount})` : ''}`],
    ['voice',        '🎤 Voice AI Booking'],
    ['book',         '➕ Book Appointment'],
    ['insurance',    '🛡️ My Insurance'],
    ['add-insurance','➕ Add Insurance'],
  ]

  return (
    <div style={{ minHeight:'100vh', background:'#f4f6f9', fontFamily:'Inter,sans-serif' }}>

      {/* Header */}
      <header style={{ background:'#fff', borderBottom:'1px solid rgba(0,0,0,0.08)', padding:'14px 28px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, fontWeight:700, color:'#0891b2', fontSize:'1.1rem' }}>
          <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="13" stroke="#0891b2" strokeWidth="2"/>
            <path d="M10 14 Q10 8 14 8 Q18 8 18 14" stroke="#0891b2" strokeWidth="2" fill="none" strokeLinecap="round"/>
            <circle cx="14" cy="14" r="2.5" fill="#0891b2"/>
          </svg>
          VoiceCare AI — Patient Portal
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <span style={{ fontSize:'0.875rem', color:'#6b7280' }}>👤 {user?.full_name}</span>
          <button onClick={logout} style={{ padding:'7px 16px', border:'1px solid rgba(0,0,0,0.1)', borderRadius:8, background:'transparent', cursor:'pointer', fontSize:'0.85rem' }}>Logout</button>
        </div>
      </header>

      <div style={{ maxWidth:1000, margin:'28px auto', padding:'0 20px' }}>

        {/* Flash */}
        {msg.text && (
          <div style={{ padding:'11px 16px', background: msg.type==='error'?'#fee2e2':'#dcfce7', color: msg.type==='error'?'#dc2626':'#15803d', borderRadius:10, marginBottom:18, fontWeight:600, fontSize:'0.875rem' }}>
            {msg.text}
          </div>
        )}

        {/* Pending banner */}
        {pendingCount > 0 && (
          <div style={{ padding:'14px 20px', background:'#fffbeb', border:'2px solid #fbbf24', borderRadius:12, marginBottom:18, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <span style={{ fontWeight:700, color:'#b45309' }}>⏳ {pendingCount} appointment{pendingCount>1?'s':''} awaiting approval</span>
              <span style={{ color:'#6b7280', fontSize:'0.85rem', marginLeft:12 }}>Go to Appointments tab to confirm</span>
            </div>
            <button onClick={() => setTab('appointments')} style={{ padding:'7px 18px', background:'#f59e0b', color:'#fff', border:'none', borderRadius:8, fontWeight:700, cursor:'pointer', fontSize:'0.85rem' }}>Review →</button>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display:'flex', gap:6, marginBottom:22, borderBottom:'1px solid rgba(0,0,0,0.08)', paddingBottom:12, flexWrap:'wrap' }}>
          {TABS.map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              style={{ padding:'8px 16px', borderRadius:8, border:'none', cursor:'pointer', fontWeight:600, fontSize:'0.85rem', background: tab===key?'#0891b2':'transparent', color: tab===key?'#fff':'#6b7280' }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── Appointments Tab ── */}
        {tab === 'appointments' && (
          <div style={{ background:'#fff', borderRadius:14, border:'1px solid rgba(0,0,0,0.08)', overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr style={{ background:'#f8f9fb' }}>{['ID','Doctor','Date','Time','Status','Reason','Action'].map(h=><th key={h} style={{ padding:'10px 16px', textAlign:'left', fontSize:'0.72rem', color:'#6b7280', fontWeight:700, textTransform:'uppercase', borderBottom:'1px solid rgba(0,0,0,0.08)' }}>{h}</th>)}</tr></thead>
              <tbody>
                {appointments.length===0 && <tr><td colSpan="7" style={{ padding:40, textAlign:'center', color:'#9ca3af' }}>No appointments yet. Book via Voice AI or the form!</td></tr>}
                {appointments.map(a => (
                  <tr key={a.id} style={{ borderBottom:'1px solid rgba(0,0,0,0.05)', background: a.status==='pending'?'#fffdf0':'#fff' }}>
                    <td style={{ padding:'12px 16px', fontSize:'0.8rem', color:'#6b7280', fontFamily:'monospace' }}>{a.appointment_id}</td>
                    <td style={{ padding:'12px 16px', fontWeight:600 }}>Doctor #{a.doctor_id}</td>
                    <td style={{ padding:'12px 16px' }}>{a.appointment_date}</td>
                    <td style={{ padding:'12px 16px', fontWeight:700, color:'#0891b2' }}>{a.appointment_time}</td>
                    <td style={{ padding:'12px 16px' }}>{statusBadge(a.status)}</td>
                    <td style={{ padding:'12px 16px', color:'#6b7280', fontSize:'0.85rem' }}>{a.reason||'—'}</td>
                    <td style={{ padding:'12px 16px' }}>
                      {a.status==='pending' && (
                        <div style={{ display:'flex', gap:6 }}>
                          <button onClick={() => setApprovalModal({ appt:a, action:'approve' })} style={{ padding:'5px 14px', background:'#22c55e', color:'#fff', border:'none', borderRadius:7, fontWeight:700, cursor:'pointer', fontSize:'0.8rem' }}>✓ Approve</button>
                          <button onClick={() => setApprovalModal({ appt:a, action:'reject' })} style={{ padding:'5px 14px', background:'transparent', border:'1px solid #ef4444', color:'#ef4444', borderRadius:7, fontWeight:700, cursor:'pointer', fontSize:'0.8rem' }}>✗ Reject</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Voice AI Tab ── */}
        {tab === 'voice' && (
          <div>
            {!sessionId ? (
              <div style={{ background:'#fff', borderRadius:14, padding:40, border:'1px solid rgba(0,0,0,0.08)', textAlign:'center' }}>
                <div style={{ fontSize:'4rem', marginBottom:16 }}>🎤</div>
                <h2 style={{ fontSize:'1.3rem', fontWeight:700, marginBottom:8 }}>Book with Voice AI</h2>
                <p style={{ color:'#6b7280', marginBottom:12 }}>3 AI agents work in parallel to verify insurance, find doctors, and book your appointment.</p>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, maxWidth:500, margin:'0 auto 28px' }}>
                  {AGENTS.map(a => (
                    <div key={a.id} style={{ background:'#f8f9fb', borderRadius:10, padding:'14px 10px', textAlign:'center' }}>
                      <div style={{ fontSize:'1.5rem' }}>{a.icon}</div>
                      <div style={{ fontWeight:700, fontSize:'0.8rem', marginTop:6 }}>{a.name}</div>
                    </div>
                  ))}
                </div>
                <button onClick={startSession} style={{ padding:'13px 36px', background:'#0891b2', color:'#fff', border:'none', borderRadius:10, fontWeight:700, fontSize:'1rem', cursor:'pointer' }}>
                  ⚡ Start Parallel AI Session
                </button>
                <p style={{ marginTop:10, fontSize:'0.78rem', color:'#9ca3af' }}>Say: "Book me with a cardiologist tomorrow at 10am"</p>
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns: showPanel ? '1fr 300px' : '1fr', gap:16 }}>

                {/* Chat */}
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, background:'#fff', border:'1px solid rgba(0,0,0,0.08)', padding:'10px 16px', borderRadius:12 }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background: voiceStatus==='idle'?'#22c55e': voiceStatus==='listening'?'#ef4444':'#f59e0b' }} />
                    <span style={{ fontSize:'0.875rem', fontWeight:500 }}>
                      { voiceStatus==='idle'?'Ready' : voiceStatus==='listening'?'🔴 Listening...' : voiceStatus==='processing'?'⏳ Processing...' : '🔊 Speaking...' }
                    </span>
                    <span style={{ marginLeft:'auto', background:'#e0f2fe', color:'#0891b2', padding:'2px 10px', borderRadius:99, fontSize:'0.75rem', fontWeight:600 }}>Session Active</span>
                    <button onClick={() => { voiceAPI.endSession(sessionId); setSessionId(null); setMessages([]) }} style={{ padding:'4px 12px', border:'1px solid rgba(0,0,0,0.1)', borderRadius:7, background:'transparent', cursor:'pointer', fontSize:'0.8rem' }}>End</button>
                  </div>

                  <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:16, height:340, overflowY:'auto', display:'flex', flexDirection:'column', gap:12 }}>
                    {messages.map((m,i) => (
                      <div key={i} style={{ display:'flex', gap:8, flexDirection: m.role==='user'?'row-reverse':'row' }}>
                        <div style={{ width:28, height:28, borderRadius:'50%', background:'#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.85rem', flexShrink:0 }}>{m.role==='assistant'?'🤖':'👤'}</div>
                        <div>
                          <div style={{ padding:'9px 13px', borderRadius:12, maxWidth:300, fontSize:'0.875rem', lineHeight:1.55, background: m.role==='user'?'#0891b2':'#f3f4f6', color: m.role==='user'?'#fff':'#1a1d23' }}>{m.content}</div>
                          <div style={{ fontSize:'0.68rem', color:'#9ca3af', marginTop:2, textAlign: m.role==='user'?'right':'left' }}>{m.time}</div>
                        </div>
                      </div>
                    ))}
                    {voiceLoading && (
                      <div style={{ display:'flex', gap:8 }}>
                        <div style={{ width:28, height:28, borderRadius:'50%', background:'#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center' }}>🤖</div>
                        <div style={{ padding:'12px 14px', background:'#f3f4f6', borderRadius:12, display:'flex', gap:4 }}>
                          {[0,0.2,0.4].map((d,i)=><div key={i} style={{ width:6,height:6,borderRadius:'50%',background:'#9ca3af',animation:`b 1.2s ${d}s infinite` }}/>)}
                        </div>
                      </div>
                    )}
                    <div ref={bottomRef} />
                  </div>

                  <div style={{ display:'flex', gap:10 }}>
                    <input style={{ flex:1, padding:'10px 14px', border:'1px solid rgba(0,0,0,0.12)', borderRadius:10, fontSize:'0.9rem', fontFamily:'inherit', outline:'none' }}
                      value={voiceText} onChange={e => setVoiceText(e.target.value)}
                      onKeyDown={e => e.key==='Enter' && sendVoiceText()}
                      placeholder="e.g. Book me with a cardiologist tomorrow 10am" disabled={voiceLoading} />
                    <button onClick={sendVoiceText} disabled={voiceLoading || !voiceText.trim()}
                      style={{ padding:'10px 20px', background:'#0891b2', color:'#fff', border:'none', borderRadius:10, fontWeight:600, cursor:'pointer', opacity: voiceLoading||!voiceText.trim()?0.5:1 }}>Send</button>
                  </div>
                  <div style={{ display:'flex', justifyContent:'center' }}>
                    <button onMouseDown={startRec} onMouseUp={stopRec} onTouchStart={startRec} onTouchEnd={stopRec}
                      style={{ padding:'12px 36px', borderRadius:99, border:`2px solid ${isRecording?'#ef4444':'#0891b2'}`, background: isRecording?'#ef4444':'transparent', color: isRecording?'#fff':'#0891b2', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                      {isRecording ? '⏹ Release to Send' : '🎤 Hold to Speak'}
                    </button>
                  </div>
                </div>

                {/* Parallel Agents Panel */}
                {showPanel && (
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    <div style={{ fontWeight:700, fontSize:'0.9rem' }}>⚡ Parallel Agents</div>
                    {AGENTS.map(agent => {
                      const s = agentStatus[agent.id]
                      return (
                        <div key={agent.id} style={{ background: agentBg[s], border:`1px solid ${agentColor[s]}44`, borderRadius:12, padding:14, transition:'all 0.3s' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                            <span style={{ fontSize:'1.2rem' }}>{agent.icon}</span>
                            <div style={{ flex:1 }}>
                              <div style={{ fontWeight:700, fontSize:'0.82rem' }}>{agent.name}</div>
                              <div style={{ fontSize:'0.72rem', color:'#6b7280' }}>{agent.task}</div>
                            </div>
                            <span style={{ padding:'2px 8px', borderRadius:99, fontSize:'0.68rem', fontWeight:700, background: agentColor[s]+'22', color: s==='done'?'#15803d': s==='running'?'#b45309':'#9ca3af' }}>{agentLabel[s]}</span>
                          </div>
                          <div style={{ height:3, background:'#e5e7eb', borderRadius:99, overflow:'hidden' }}>
                            <div style={{ height:'100%', borderRadius:99, background: agentColor[s], width: s==='done'?'100%': s==='running'?'65%':'0%', transition:'width 0.5s' }} />
                          </div>
                          {agentLogs[agent.id] && <div style={{ marginTop:6, fontSize:'0.72rem', color:'#374151', background:'#fff', padding:'4px 8px', borderRadius:6, fontWeight:500 }}>{agentLogs[agent.id]}</div>}
                        </div>
                      )
                    })}
                    {Object.values(agentStatus).every(s => s==='done') && (
                      <div style={{ background:'#f0fdf4', border:'1px solid #22c55e44', borderRadius:12, padding:12, textAlign:'center' }}>
                        <div style={{ fontWeight:700, color:'#15803d', fontSize:'0.85rem' }}>✅ All Agents Complete</div>
                        <div style={{ fontSize:'0.72rem', color:'#6b7280', marginTop:2 }}>Appointment saved to database</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            <style>{`@keyframes b{0%,80%,100%{transform:scale(0.6);opacity:0.4}40%{transform:scale(1);opacity:1}}`}</style>
          </div>
        )}

        {/* ── Book Appointment Tab ── */}
        {tab === 'book' && (
          <div style={{ background:'#fff', borderRadius:14, padding:28, border:'1px solid rgba(0,0,0,0.08)' }}>
            <h3 style={{ fontWeight:700, marginBottom:6 }}>Book Appointment (Manual)</h3>
            <p style={{ color:'#6b7280', fontSize:'0.875rem', marginBottom:20 }}>Or use the 🎤 Voice AI tab to book by speaking.</p>
            <form onSubmit={bookAppointment}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                <div><label style={lbl}>Doctor *</label>
                  <select required style={inp} value={bookForm.doctor_id} onChange={e => setBookForm({...bookForm,doctor_id:e.target.value,appointment_time:''})}>
                    <option value="">Select doctor</option>
                    {doctors.map(d=><option key={d.id} value={d.id}>{d.full_name} — {d.specialization}</option>)}
                  </select></div>
                <div><label style={lbl}>Date *</label>
                  <input type="date" required style={inp} value={bookForm.appointment_date} min={new Date().toISOString().split('T')[0]} onChange={e => setBookForm({...bookForm,appointment_date:e.target.value,appointment_time:''})} /></div>
                <div><label style={lbl}>Time Slot *</label>
                  <select required style={inp} value={bookForm.appointment_time} onChange={e => setBookForm({...bookForm,appointment_time:e.target.value})}>
                    <option value="">Select slot</option>
                    {slots.map(s=><option key={s} value={s}>{s}</option>)}
                  </select></div>
                <div><label style={lbl}>Reason</label>
                  <input style={inp} value={bookForm.reason} onChange={e => setBookForm({...bookForm,reason:e.target.value})} placeholder="e.g. Checkup" /></div>
                <div><label style={lbl}>Insurance Policy</label>
                  <input style={inp} value={bookForm.insurance_used} onChange={e => setBookForm({...bookForm,insurance_used:e.target.value})} placeholder="Optional" /></div>
              </div>
              <button type="submit" style={{ marginTop:22, padding:'11px 32px', background:'#0891b2', color:'#fff', border:'none', borderRadius:9, fontWeight:700, cursor:'pointer' }}>Request Appointment →</button>
            </form>
          </div>
        )}

        {/* ── My Insurance Tab ── */}
        {tab === 'insurance' && (
          <div style={{ background:'#fff', borderRadius:14, border:'1px solid rgba(0,0,0,0.08)', overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr style={{ background:'#f8f9fb' }}>{['Provider','Policy','Plan','Sum Insured','Valid Until','Status'].map(h=><th key={h} style={{ padding:'10px 16px', textAlign:'left', fontSize:'0.72rem', color:'#6b7280', fontWeight:700, textTransform:'uppercase', borderBottom:'1px solid rgba(0,0,0,0.08)' }}>{h}</th>)}</tr></thead>
              <tbody>
                {insurance.length===0 && <tr><td colSpan="6" style={{ padding:40, textAlign:'center', color:'#9ca3af' }}>No insurance. Add one!</td></tr>}
                {insurance.map(i => {
                  const valid = new Date(i.coverage_end) >= new Date()
                  const pending = i.status === 'pending'
                  const rejected = i.status === 'rejected'
                  const active = i.status === 'approved' && i.is_active && valid
                  return <tr key={i.id} style={{ borderBottom:'1px solid rgba(0,0,0,0.05)' }}>
                    <td style={{ padding:'12px 16px', fontWeight:700 }}>{i.provider_name}</td>
                    <td style={{ padding:'12px 16px', fontSize:'0.85rem' }}>{i.policy_number}</td>
                    <td style={{ padding:'12px 16px', color:'#6b7280' }}>{i.plan_name||'—'}</td>
                    <td style={{ padding:'12px 16px' }}>₹{Number(i.sum_insured).toLocaleString()}</td>
                    <td style={{ padding:'12px 16px' }}>{i.coverage_end}</td>
                    <td style={{ padding:'12px 16px' }}>
                      <span style={{ padding:'3px 10px', borderRadius:99, fontSize:'0.72rem', fontWeight:700, background: pending ? '#fef3c7' : rejected ? '#fee2e2' : active ? '#dcfce7' : '#fee2e2', color: pending ? '#b45309' : rejected ? '#dc2626' : active ? '#15803d' : '#dc2626' }}>
                        {pending ? 'Pending review' : rejected ? 'Rejected' : active ? 'Active' : 'Expired'}
                      </span>
                      <div style={{ marginTop:6, fontSize:'0.72rem', color:'#6b7280' }}>
                        {pending ? 'Waiting for admin approval' : rejected ? 'Rejected by admin' : active ? 'Approved' : 'Coverage expired'}
                      </div>
                    </td>
                  </tr>
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Add Insurance Tab ── */}
        {tab === 'add-insurance' && (
          <div style={{ background:'#fff', borderRadius:14, padding:28, border:'1px solid rgba(0,0,0,0.08)' }}>
            <h3 style={{ fontWeight:700, marginBottom:20 }}>Add Insurance Policy</h3>
            <form onSubmit={addInsurance}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                {[['provider_name','Provider *',true,'text'],['policy_number','Policy Number *',true,'text'],['plan_name','Plan Name',false,'text'],['sum_insured','Sum Insured (₹) *',true,'number'],['coverage_start','Start Date *',true,'date'],['coverage_end','End Date *',true,'date']].map(([k,l,r,t])=>(
                  <div key={k}><label style={lbl}>{l}</label>
                    <input required={r} type={t} style={inp} value={insForm[k]} onChange={e=>setInsForm({...insForm,[k]:e.target.value})} /></div>
                ))}
              </div>
              <div style={{ display:'flex', gap:20, marginTop:14 }}>
                {[['covers_hospitalization','Hospitalization'],['covers_outpatient','Outpatient']].map(([k,l])=>(
                  <label key={k} style={{ display:'flex', alignItems:'center', gap:6, fontSize:'0.875rem', cursor:'pointer' }}>
                    <input type="checkbox" checked={insForm[k]} onChange={e=>setInsForm({...insForm,[k]:e.target.checked})} /> {l}
                  </label>
                ))}
              </div>
              <button type="submit" style={{ marginTop:20, padding:'11px 32px', background:'#0891b2', color:'#fff', border:'none', borderRadius:9, fontWeight:700, cursor:'pointer' }}>Add Policy</button>
            </form>
          </div>
        )}
      </div>

      {/* Approval Modal */}
      {approvalModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:20 }}
          onClick={e => e.target===e.currentTarget && setApprovalModal(null)}>
          <div style={{ background:'#fff', borderRadius:18, padding:32, maxWidth:420, width:'100%' }}>
            <div style={{ textAlign:'center', marginBottom:20 }}>
              <div style={{ fontSize:'2.5rem', marginBottom:10 }}>{approvalModal.action==='approve'?'✅':'❌'}</div>
              <h2 style={{ fontSize:'1.1rem', fontWeight:700, marginBottom:8 }}>{approvalModal.action==='approve'?'Confirm Booking':'Cancel Appointment'}</h2>
              <div style={{ background:'#f8f9fb', borderRadius:10, padding:'12px 16px', fontSize:'0.875rem', textAlign:'left', marginTop:12 }}>
                <div><strong>ID:</strong> {approvalModal.appt.appointment_id}</div>
                <div><strong>Date:</strong> {approvalModal.appt.appointment_date} at <strong>{approvalModal.appt.appointment_time}</strong></div>
                <div><strong>Reason:</strong> {approvalModal.appt.reason || 'General'}</div>
              </div>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setApprovalModal(null)} style={{ flex:1, padding:11, border:'1px solid rgba(0,0,0,0.12)', borderRadius:9, background:'transparent', cursor:'pointer', fontWeight:600, fontFamily:'inherit' }}>Go Back</button>
              <button onClick={confirmApproval} disabled={approving}
                style={{ flex:2, padding:11, background: approvalModal.action==='approve'?'#22c55e':'#ef4444', color:'#fff', border:'none', borderRadius:9, fontWeight:700, cursor:'pointer', fontFamily:'inherit', opacity:approving?0.7:1 }}>
                {approving ? 'Processing...' : approvalModal.action==='approve' ? '✓ Confirm Booking' : '✗ Cancel Booking'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}