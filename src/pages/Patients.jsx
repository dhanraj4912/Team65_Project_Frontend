import { useState, useEffect } from 'react'
import { patientAPI } from '../services/api'

const EMPTY = { full_name:'', date_of_birth:'', phone:'', email:'', blood_group:'', address:'', medical_history:'', allergies:'' }

export default function Patients() {
  const [patients, setPatients] = useState([])
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  const load = async (q = '') => {
    const res = q ? await patientAPI.search(q) : await patientAPI.list()
    setPatients(res.data)
  }

  useEffect(() => { load() }, [])
  useEffect(() => { const t = setTimeout(() => load(search), 350); return () => clearTimeout(t) }, [search])

  const save = async e => {
    e.preventDefault()
    setSaving(true)
    try {
      await patientAPI.create(form)
      setShowModal(false)
      setForm(EMPTY)
      load(search)
    } catch(err) {
      alert(err.response?.data?.detail || 'Error saving patient')
    }
    setSaving(false)
  }

  const del = async (id, name) => {
    if (!confirm(`Delete ${name}?`)) return
    await patientAPI.delete(id)
    load(search)
  }

  return (
    <div>
      <h1 className="page-title">Patients</h1>
      <p className="page-subtitle">Manage patient records</p>

      <div className="search-row">
        <input className="search-input" placeholder="Search by name, phone, or ID..." value={search} onChange={e => setSearch(e.target.value)} />
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Patient</button>
      </div>

      <div className="table-wrapper">
        <table>
          <thead><tr><th>Patient ID</th><th>Name</th><th>DOB</th><th>Phone</th><th>Blood</th><th>Address</th><th></th></tr></thead>
          <tbody>
            {patients.length === 0 && <tr><td colSpan="7"><div className="empty-state"><p>No patients found.</p></div></td></tr>}
            {patients.map(p => (
              <tr key={p.id}>
                <td><code style={{fontSize:'0.8rem',color:'#6b7280'}}>{p.patient_id}</code></td>
                <td style={{fontWeight:600}}>{p.full_name}</td>
                <td>{p.date_of_birth}</td>
                <td>{p.phone}</td>
                <td><span className="badge badge-confirmed">{p.blood_group || '—'}</span></td>
                <td style={{color:'var(--color-text-muted)',fontSize:'0.85rem'}}>{p.address || '—'}</td>
                <td><button className="btn btn-danger btn-sm" onClick={() => del(p.id, p.full_name)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2>Add New Patient</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={save}>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input className="form-input" required value={form.full_name} onChange={e => setForm({...form,full_name:e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Date of Birth *</label>
                  <input type="date" className="form-input" required value={form.date_of_birth} onChange={e => setForm({...form,date_of_birth:e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone *</label>
                  <input className="form-input" required value={form.phone} onChange={e => setForm({...form,phone:e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input type="email" className="form-input" value={form.email} onChange={e => setForm({...form,email:e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Blood Group</label>
                  <select className="form-select" value={form.blood_group} onChange={e => setForm({...form,blood_group:e.target.value})}>
                    <option value="">Select</option>
                    {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(b => <option key={b}>{b}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Address</label>
                  <input className="form-input" value={form.address} onChange={e => setForm({...form,address:e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Medical History</label>
                <textarea className="form-textarea" rows="2" value={form.medical_history} onChange={e => setForm({...form,medical_history:e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Allergies</label>
                <input className="form-input" value={form.allergies} onChange={e => setForm({...form,allergies:e.target.value})} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Add Patient'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}