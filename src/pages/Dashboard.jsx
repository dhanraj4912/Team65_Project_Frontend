import { useEffect, useState } from 'react'
import { patientAPI, appointmentAPI, doctorAPI } from '../services/api'

export default function Dashboard() {
  const [stats, setStats] = useState({ patients: 0, appointments: 0, doctors: 0, confirmed: 0 })
  const [appointments, setAppointments] = useState([])

  useEffect(() => {
    Promise.all([patientAPI.list(), appointmentAPI.list(), doctorAPI.list()])
      .then(([p, a, d]) => {
        const appts = a.data
        setStats({
          patients: p.data.length,
          appointments: appts.length,
          doctors: d.data.length,
          confirmed: appts.filter(x => x.status === 'confirmed').length
        })
        setAppointments(appts.slice(0, 8))
      }).catch(() => {})
  }, [])

  const statusClass = s => s === 'confirmed' ? 'confirmed' : s === 'cancelled' ? 'cancelled' : s === 'completed' ? 'completed' : 'pending'

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>
      <p className="page-subtitle">Overview of VoiceCare AI system</p>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total Patients</div>
          <div className="kpi-value" style={{color:'#0891b2'}}>{stats.patients}</div>
          <div className="kpi-sub">Registered patients</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Appointments</div>
          <div className="kpi-value" style={{color:'#7c3aed'}}>{stats.appointments}</div>
          <div className="kpi-sub">{stats.confirmed} confirmed</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Doctors</div>
          <div className="kpi-value" style={{color:'#16a34a'}}>{stats.doctors}</div>
          <div className="kpi-sub">Available specialists</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Confirmed Today</div>
          <div className="kpi-value" style={{color:'#d97706'}}>{stats.confirmed}</div>
          <div className="kpi-sub">Awaiting visits</div>
        </div>
      </div>

      <div className="table-wrapper">
        <div className="table-header">
          <h3>Recent Appointments</h3>
        </div>
        {appointments.length === 0 ? (
          <div className="empty-state"><p>No appointments yet. Use Voice AI to book.</p></div>
        ) : (
          <table>
            <thead><tr><th>ID</th><th>Patient</th><th>Doctor</th><th>Date</th><th>Time</th><th>Status</th></tr></thead>
            <tbody>
              {appointments.map(a => (
                <tr key={a.id}>
                  <td><code style={{fontSize:'0.8rem',color:'#6b7280'}}>{a.appointment_id}</code></td>
                  <td>Patient #{a.patient_id}</td>
                  <td>Doctor #{a.doctor_id}</td>
                  <td>{a.appointment_date}</td>
                  <td>{a.appointment_time}</td>
                  <td><span className={`badge badge-${statusClass(a.status)}`}>{a.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}