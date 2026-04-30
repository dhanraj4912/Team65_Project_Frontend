import { useState, useEffect } from 'react'
import { insuranceAPI, patientAPI, adminAPI } from '../services/api'

export default function Insurance() {
  const [patients, setPatients] = useState([])
  const [selectedPid, setSelectedPid] = useState('')
  const [records, setRecords] = useState([])
  const [pendingRecords, setPendingRecords] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ patient_id:'', provider_name:'', policy_number:'', plan_name:'', sum_insured:'', premium_amount:'', coverage_start:'', coverage_end:'', covers_hospitalization:true, covers_outpatient:false })
  const [saving, setSaving] = useState(false)
  const [verifyResult, setVerifyResult] = useState(null)
  const [reviewBusyId, setReviewBusyId] = useState(null)

  useEffect(() => { patientAPI.list().then(r => setPatients(r.data)).catch(()=>{}) }, [])

  const loadPending = async () => {
    try {
      const r = await adminAPI.getPendingInsurance()
      setPendingRecords(r.data)
    } catch {
      setPendingRecords([])
    }
  }

  const loadInsurance = async (pid) => {
    if (!pid) { setRecords([]); return }
    try {
      const r = await insuranceAPI.byPatient(pid)
      setRecords(r.data)
    } catch { setRecords([]) }
  }

  useEffect(() => {
    loadInsurance(selectedPid)
    loadPending()
  }, [selectedPid])

  const save = async e => {
    e.preventDefault()
    setSaving(true)
    try {
      await insuranceAPI.add({ ...form, patient_id: Number(form.patient_id), sum_insured: Number(form.sum_insured), premium_amount: Number(form.premium_amount) })
      setShowModal(false)
      loadInsurance(selectedPid)
    } catch(err) {
      alert(err.response?.data?.detail || 'Error adding insurance')
    }
    setSaving(false)
  }

  const verify = async (pid, policy) => {
    try {
      const r = await insuranceAPI.verify({ patient_id: pid, policy_number: policy })
      setVerifyResult(r.data)
    } catch { setVerifyResult({ valid: false, message: 'Verification failed' }) }
  }

  const reviewInsurance = async (recordId, action, reason = '') => {
    setReviewBusyId(recordId)
    try {
      await adminAPI.reviewInsurance(recordId, action, reason)
      await loadPending()
      if (selectedPid) await loadInsurance(selectedPid)
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update insurance request')
    }
    setReviewBusyId(null)
  }

  return (
    <div>
      <h1 className="page-title">Insurance</h1>
      <p className="page-subtitle">View and verify patient insurance policies</p>

      <div className="search-row">
        <select className="form-select" style={{maxWidth:320}} value={selectedPid} onChange={e => setSelectedPid(e.target.value)}>
          <option value="">— Select patient to view insurance —</option>
          {patients.map(p => <option key={p.id} value={p.id}>{p.full_name} ({p.patient_id})</option>)}
        </select>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Insurance</button>
      </div>

      {verifyResult && (
        <div style={{marginBottom:20, padding:'14px 18px', borderRadius:'var(--radius-lg)', background: verifyResult.valid ? 'var(--color-success-light)' : 'var(--color-error-light)', border: `1px solid ${verifyResult.valid ? 'var(--color-success)' : 'var(--color-error)'}22`}}>
          {verifyResult.valid ? (
            <div>
              <strong style={{color:'var(--color-success)'}}>✓ Insurance Valid</strong>
              <div style={{marginTop:6,fontSize:'0.875rem'}}>Provider: {verifyResult.provider} | Plan: {verifyResult.plan} | Sum Insured: ₹{verifyResult.sum_insured?.toLocaleString()} | Expires: {verifyResult.expiry}</div>
            </div>
          ) : (
            <div><strong style={{color:'var(--color-error)'}}>✗ {verifyResult.message}</strong></div>
          )}
          <button className="btn btn-outline btn-sm" style={{marginTop:8}} onClick={() => setVerifyResult(null)}>Dismiss</button>
        </div>
      )}

      <div style={{marginBottom:24, padding:20, border:'1px solid rgba(0,0,0,0.08)', borderRadius:'var(--radius-lg)', background:'#fff'}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
          <h2 style={{margin:0, fontSize:'1.05rem'}}>Pending Insurance Requests</h2>
          <span style={{fontSize:'0.85rem', color:'var(--color-text-muted)'}}>{pendingRecords.length} waiting review</span>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Patient</th><th>Provider</th><th>Policy No.</th><th>Plan</th><th>Sum Insured</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {pendingRecords.length === 0 && (
                <tr><td colSpan="7"><div className="empty-state"><p>No pending insurance requests.</p></div></td></tr>
              )}
              {pendingRecords.map(r => (
                <tr key={r.id}>
                  <td style={{fontWeight:600}}>{r.patient_name || `#${r.patient_id}`}</td>
                  <td>{r.provider}</td>
                  <td>{r.policy_number}</td>
                  <td>{r.plan || '—'}</td>
                  <td>₹{Number(r.sum_insured).toLocaleString()}</td>
                  <td><span className="badge badge-pending">Pending</span></td>
                  <td style={{display:'flex', gap:8, flexWrap:'wrap'}}>
                    <button className="btn btn-primary btn-sm" disabled={reviewBusyId === r.id} onClick={() => reviewInsurance(r.id, 'approve')}>
                      {reviewBusyId === r.id ? 'Saving...' : 'Approve'}
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      disabled={reviewBusyId === r.id}
                      onClick={() => {
                        const reason = prompt('Enter rejection reason')
                        if (reason === null) return
                        reviewInsurance(r.id, 'reject', reason)
                      }}
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead><tr><th>Insurance ID</th><th>Provider</th><th>Policy No.</th><th>Plan</th><th>Sum Insured</th><th>Valid Until</th><th>Outpatient</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {records.length === 0 && <tr><td colSpan="9"><div className="empty-state"><p>{selectedPid ? 'No insurance records for this patient.' : 'Select a patient to view insurance.'}</p></div></td></tr>}
            {records.map(r => {
              const today = new Date()
              const expiry = new Date(r.coverage_end)
              const valid = r.is_active && expiry >= today
              return (
                <tr key={r.id}>
                  <td><code style={{fontSize:'0.8rem',color:'#6b7280'}}>{r.insurance_id}</code></td>
                  <td style={{fontWeight:600}}>{r.provider_name}</td>
                  <td>{r.policy_number}</td>
                  <td>{r.plan_name || '—'}</td>
                  <td>₹{Number(r.sum_insured).toLocaleString()}</td>
                  <td>{r.coverage_end}</td>
                  <td><span className={`badge badge-${r.covers_outpatient ? 'confirmed' : 'pending'}`}>{r.covers_outpatient ? 'Yes' : 'No'}</span></td>
                  <td><span className={`badge badge-${valid ? 'confirmed' : 'cancelled'}`}>{valid ? 'Active' : 'Expired'}</span></td>
                  <td><button className="btn btn-outline btn-sm" onClick={() => verify(r.patient_id, r.policy_number)}>Verify</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2>Add Insurance Policy</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={save}>
              <div className="form-group">
                <label className="form-label">Patient *</label>
                <select className="form-select" required value={form.patient_id} onChange={e => setForm({...form,patient_id:e.target.value})}>
                  <option value="">Select patient</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Provider *</label>
                  <input className="form-input" required placeholder="e.g. HDFC ERGO" value={form.provider_name} onChange={e => setForm({...form,provider_name:e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Policy Number *</label>
                  <input className="form-input" required value={form.policy_number} onChange={e => setForm({...form,policy_number:e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Plan Name</label>
                  <input className="form-input" value={form.plan_name} onChange={e => setForm({...form,plan_name:e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Sum Insured (₹) *</label>
                  <input type="number" className="form-input" required value={form.sum_insured} onChange={e => setForm({...form,sum_insured:e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Coverage Start *</label>
                  <input type="date" className="form-input" required value={form.coverage_start} onChange={e => setForm({...form,coverage_start:e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Coverage End *</label>
                  <input type="date" className="form-input" required value={form.coverage_end} onChange={e => setForm({...form,coverage_end:e.target.value})} />
                </div>
              </div>
              <div style={{display:'flex',gap:20,marginBottom:16}}>
                <label style={{display:'flex',alignItems:'center',gap:6,fontSize:'0.875rem',cursor:'pointer'}}>
                  <input type="checkbox" checked={form.covers_hospitalization} onChange={e => setForm({...form,covers_hospitalization:e.target.checked})} />
                  Covers Hospitalization
                </label>
                <label style={{display:'flex',alignItems:'center',gap:6,fontSize:'0.875rem',cursor:'pointer'}}>
                  <input type="checkbox" checked={form.covers_outpatient} onChange={e => setForm({...form,covers_outpatient:e.target.checked})} />
                  Covers Outpatient
                </label>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Add Policy'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}