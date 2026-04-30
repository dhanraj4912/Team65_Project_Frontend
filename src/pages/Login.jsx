import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const submit = async e => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/auth/login', form)
      login(res.data.user, res.data.token)
      if (res.data.user.role === 'admin') navigate('/')
      else navigate('/patient')
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed')
    }
    setLoading(false)
  }

  return (
    <div style={styles.page}>
          <div style={styles.card}>
              <div style={styles.logo}>
                  <svg width="40" height="40" viewBox="0 0 28 28" fill="none">
                      <path d="M10 14 Q10 8 14 8 Q18 8 18 14" stroke="#0891b2" strokeWidth="2" fill="none" strokeLinecap="round" />
                  </svg>
                  <h1 style={styles.title}>VoiceCare AI</h1>
              </div>
              <h2 style={styles.subtitle}>Sign in to your account</h2>

              {error && <div style={styles.error}>{error}</div>}

      <form onSubmit={submit}>
          <div style={styles.group}>
              <label style={styles.label}>Email</label>
              <input style={styles.input} type="email" required value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })} placeholder="you@email.com" />
          </div>
          <div style={styles.group}>
              <label style={styles.label}>Password</label>
              <input style={styles.input} type="password" required value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
          </div>
          <button style={styles.btn} type="submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
          </button>
      </form>

        <div style={styles.hint}>
          Don't have an account? <Link to="/register" style={{color:'#0891b2'}}>Register</Link>
        </div>
        <div style={styles.hint} className="admin-hint">
          <small style={{color:'#9ca3af'}}>Admin: admin@voicecare.com / admin123</small>
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: { minHeight:'100vh', background:'#f4f6f9', display:'flex', alignItems:'center', justifyContent:'center', padding:20 },
  card: { background:'#fff', borderRadius:16, padding:36, width:'100%', maxWidth:420, boxShadow:'0 4px 24px rgba(0,0,0,0.08)' },
  logo: { display:'flex', alignItems:'center', gap:12, marginBottom:24 },
  title: { fontSize:'1.3rem', fontWeight:700, color:'#0891b2' },
  subtitle: { fontSize:'1.1rem', fontWeight:600, marginBottom:24, color:'#1a1d23' },
  group: { marginBottom:16 },
  label: { display:'block', fontSize:'0.8rem', fontWeight:600, color:'#6b7280', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.04em' },
  input: { width:'100%', padding:'10px 14px', border:'1px solid rgba(0,0,0,0.1)', borderRadius:8, fontSize:'0.9rem', outline:'none', fontFamily:'inherit', boxSizing:'border-box' },
  btn: { width:'100%', padding:'11px', background:'#0891b2', color:'#fff', border:'none', borderRadius:8, fontSize:'0.9rem', fontWeight:600, cursor:'pointer', marginTop:8 },
  error: { background:'#fee2e2', color:'#dc2626', padding:'10px 14px', borderRadius:8, marginBottom:16, fontSize:'0.875rem' },
  hint: { textAlign:'center', marginTop:16, fontSize:'0.875rem', color:'#6b7280' }
}