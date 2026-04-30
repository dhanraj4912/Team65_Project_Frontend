import { useState, useEffect } from 'react'
import { appointmentAPI, patientAPI, doctorAPI } from '../services/api'
import AddDoctorModal from './AddDoctorModal'

export default function Appointments() {
  const [appointments, setAppointments] = useState([])
  const [patients, setPatients] = useState([])
  const [doctors, setDoctors] = useState([])
  const [slots, setSlots] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [showAddDoctor, setShowAddDoctor] = useState(false)  // ← added
  const [form, setForm] = useState({ patient_id:'', doctor_id:'', appointment_date:'', appointment_time:'', reason:'', insurance_used:'' })
  const [saving, setSaving] = useState(false)

  const fetchAll = async () => {
    appointmentAPI.list().then(r => setAppointments(r.data)).catch(()=>{})
    patientAPI.list().then(r => setPatients(r.data)).catch(()=>{})
    doctorAPI.list().then(r => setDoctors(r.data)).catch(()=>{})
  }

  useEffect(() => { fetchAll() }, [])

  const fetchSlots = async () => {
    if (form.doctor_id && form.appointment_date) {
      try {
        const r = await appointmentAPI.slots({ doctor_id: Number(form.doctor_id), appointment_date: form.appointment_date })
        setSlots(r.data.slots || r.data.available_slots || [])
      } catch { setSlots([]) }
    }
  }

  useEffect(() => { fetchSlots() }, [form.doctor_id, form.appointment_date])

  const save = async e => {
    e.preventDefault()
    setSaving(true)
    try {
      await appointmentAPI.book({ ...form, patient_id: Number(form.patient_id), doctor_id: Number(form.doctor_id) })
      setShowModal(false)
      setForm({ patient_id:'', doctor_id:'', appointment_date:'', appointment_time:'', reason:'', insurance_used:'' })
      const r = await appointmentAPI.list()
      setAppointments(r.data)
    } catch(err) {
      alert(err.response?.data?.detail || 'Booking failed')
    }
    setSaving(false)
  }

  const cancel = async (id) => {
    if (!confirm('Cancel this appointment?')) return
    await appointmentAPI.update(id, { status: 'cancelled' })
    const r = await appointmentAPI.list()
    setAppointments(r.data)
  }

  const patientName = id => patients.find(p => p.id === id)?.full_name || `#${id}`
  const doctorName = id => doctors.find(d => d.id === id)?.full_name || `#${id}`
  const statusClass = s => s === 'confirmed' ? 'confirmed' : s === 'cancelled' ? 'cancelled' : s === 'completed' ? 'completed' : 'pending'

  return (
    <div>
      <h1 className="page-title">Appointments</h1>
      <p className="page-subtitle">View and manage all doctor appointments</p>

      {/* Action Buttons Row */}
      <div style={{ display:'flex', gap:12, marginBottom:20 }}>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Book Appointment
        </button>
        <button
          className="btn btn-outline"
          onClick={() => setShowAddDoctor(true)}
          style={{ borderColor:'#0891b2', color:'#0891b2' }}
        >
          + Add Doctor
        </button>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>ID</th><th>Patient</th><th>Doctor</th><th>Date</th>
              <th>Time</th><th>Reason</th><th>Insurance</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {appointments.length === 0 && (
              <tr><td colSpan="9">
                <div className="empty-state"><p>No appointments booked yet.</p></div>
              </td></tr>
            )}
            {appointments.map(a => (
              <tr key={a.id}>
                <td><code style={{fontSize:'0.8rem',color:'#6b7280'}}>{a.appointment_id}</code></td>
                <td style={{fontWeight:500}}>{patientName(a.patient_id)}</td>
                <td>{doctorName(a.doctor_id)}</td>
                <td>{a.appointment_date}</td>
                <td style={{fontWeight:600}}>{a.appointment_time}</td>
                <td style={{color:'var(--color-text-muted)',fontSize:'0.85rem'}}>{a.reason || '—'}</td>
                <td style={{fontSize:'0.82rem'}}>{a.insurance_used || '—'}</td>
                <td><span className={`badge badge-${statusClass(a.status)}`}>{a.status}</span></td>
                <td>
                  {a.status === 'confirmed' &&
                    <button className="btn btn-outline btn-sm" onClick={() => cancel(a.id)}>Cancel</button>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Book Appointment Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2>Book Appointment</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={save}>
              <div className="form-group">
                <label className="form-label">Patient *</label>
                <select className="form-select" required value={form.patient_id}
                  onChange={e => setForm({...form, patient_id:e.target.value})}>
                  <option value="">Select patient</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.full_name} ({p.patient_id})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Doctor *</label>
                <select className="form-select" required value={form.doctor_id}
                  onChange={e => setForm({...form, doctor_id:e.target.value, appointment_time:''})}>
                  <option value="">Select doctor</option>
                  {doctors.map(d => <option key={d.id} value={d.id}>{d.full_name} — {d.specialization}</option>)}
                </select>
              </div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Date *</label>
                  <input type="date" className="form-input" required value={form.appointment_date}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={e => setForm({...form, appointment_date:e.target.value, appointment_time:''})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Time Slot *</label>
                  <select className="form-select" required value={form.appointment_time}
                    onChange={e => setForm({...form, appointment_time:e.target.value})}>
                    <option value="">Select slot</option>
                    {slots.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {form.doctor_id && form.appointment_date && slots.length === 0 &&
                    <div style={{fontSize:'0.78rem', color:'var(--color-error)', marginTop:4}}>
                      No slots available for this day
                    </div>
                  }
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Reason</label>
                <input className="form-input" placeholder="e.g. Follow-up, General checkup"
                  value={form.reason} onChange={e => setForm({...form, reason:e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Insurance Policy (optional)</label>
                <input className="form-input" placeholder="e.g. HDFC-POL-123456"
                  value={form.insurance_used} onChange={e => setForm({...form, insurance_used:e.target.value})} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Booking...' : 'Confirm Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Doctor Modal */}
      {showAddDoctor && (
        <AddDoctorModal
          onClose={() => setShowAddDoctor(false)}
          onSuccess={() => {
            setShowAddDoctor(false)
            doctorAPI.list().then(r => setDoctors(r.data)).catch(()=>{})  // refresh doctor list
          }}
        />
      )}
    </div>
  )
}