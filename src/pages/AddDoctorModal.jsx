import { useState } from 'react'
import axios from 'axios'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DEFAULT_SLOTS = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00']

export default function AddDoctorModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    specialization: '',
    consultation_fee: '',
    available_days: [],
    available_slots: [],
    rating: 5.0
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const toggleDay = (day) => {
    setForm(f => ({
      ...f,
      available_days: f.available_days.includes(day)
        ? f.available_days.filter(d => d !== day)
        : [...f.available_days, day]
    }))
  }

  const toggleSlot = (slot) => {
    setForm(f => ({
      ...f,
      available_slots: f.available_slots.includes(slot)
        ? f.available_slots.filter(s => s !== slot)
        : [...f.available_slots, slot]
    }))
  }

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await axios.post('/api/admin/doctors/add', {
        ...form,
        consultation_fee: parseFloat(form.consultation_fee)
      })
      onSuccess()
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add doctor')
    }
    setLoading(false)
  }

  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        <div style={s.header}>
          <h2 style={s.title}>Add New Doctor</h2>
          <button onClick={onClose} style={s.closeBtn}>✕</button>
        </div>

        {error && <div style={s.error}>{error}</div>}

        <form onSubmit={submit} style={s.form}>
          {/* Basic Info */}
          <div style={s.row}>
            <div style={s.group}>
              <label style={s.label}>Full Name</label>
              <input style={s.input} required value={form.full_name}
                onChange={e => setForm({...form, full_name: e.target.value})}
                placeholder="Dr. John Smith" />
            </div>
            <div style={s.group}>
              <label style={s.label}>Specialization</label>
              <input style={s.input} required value={form.specialization}
                onChange={e => setForm({...form, specialization: e.target.value})}
                placeholder="Cardiologist" />
            </div>
          </div>

          <div style={s.row}>
            <div style={s.group}>
              <label style={s.label}>Email</label>
              <input style={s.input} type="email" required value={form.email}
                onChange={e => setForm({...form, email: e.target.value})}
                placeholder="doctor@voicecare.com" />
            </div>
          </div>

          <div style={s.group}>
            <label style={s.label}>Consultation Fee (₹)</label>
            <input style={{...s.input, maxWidth: 200}} type="number" required value={form.consultation_fee}
              onChange={e => setForm({...form, consultation_fee: e.target.value})}
              placeholder="500" />
          </div>

          {/* Available Days */}
          <div style={s.group}>
            <label style={s.label}>Available Days</label>
            <div style={s.chipRow}>
              {DAYS.map(day => (
                <button key={day} type="button"
                  onClick={() => toggleDay(day)}
                  style={{
                    ...s.chip,
                    background: form.available_days.includes(day) ? '#0891b2' : '#f3f4f6',
                    color: form.available_days.includes(day) ? '#fff' : '#374151',
                  }}>
                  {day.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          {/* Available Slots */}
          <div style={s.group}>
            <label style={s.label}>Available Time Slots</label>
            <div style={s.chipRow}>
              {DEFAULT_SLOTS.map(slot => (
                <button key={slot} type="button"
                  onClick={() => toggleSlot(slot)}
                  style={{
                    ...s.chip,
                    background: form.available_slots.includes(slot) ? '#0891b2' : '#f3f4f6',
                    color: form.available_slots.includes(slot) ? '#fff' : '#374151',
                  }}>
                  {slot}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" disabled={loading} style={s.btn}>
            {loading ? 'Adding...' : 'Add Doctor'}
          </button>
        </form>
      </div>
    </div>
  )
}

const s = {
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 },
  modal: { background:'#fff', borderRadius:16, padding:32, width:'100%', maxWidth:600, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' },
  header: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 },
  title: { fontSize:'1.25rem', fontWeight:700, color:'#111827' },
  closeBtn: { background:'none', border:'none', fontSize:'1.2rem', cursor:'pointer', color:'#6b7280' },
  form: { display:'flex', flexDirection:'column', gap:16 },
  row: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 },
  group: { display:'flex', flexDirection:'column', gap:6 },
  label: { fontSize:'0.8rem', fontWeight:600, color:'#374151', textTransform:'uppercase', letterSpacing:'0.04em' },
  input: { padding:'10px 14px', border:'1.5px solid #e5e7eb', borderRadius:8, fontSize:'0.9rem', outline:'none', fontFamily:'inherit', width:'100%', boxSizing:'border-box' },
  chipRow: { display:'flex', flexWrap:'wrap', gap:8 },
  chip: { padding:'6px 14px', borderRadius:99, fontSize:'0.8rem', fontWeight:600, border:'none', cursor:'pointer', transition:'all 0.15s' },
  btn: { padding:'12px', background:'#0891b2', color:'#fff', border:'none', borderRadius:8, fontSize:'0.95rem', fontWeight:600, cursor:'pointer', marginTop:8 },
  error: { background:'#fef2f2', color:'#dc2626', border:'1px solid #fecaca', padding:'10px 14px', borderRadius:8, fontSize:'0.875rem', marginBottom:8 }
}