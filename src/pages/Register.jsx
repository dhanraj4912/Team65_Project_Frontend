import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'

export default function Register() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
    date_of_birth: '',
    blood_group: '',
    address: '',
  })

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const nextStep = (e) => {
    e.preventDefault()
    if (form.password !== form.confirm_password) {
      setError('Passwords do not match')
      return
    }
    setError('')
    setStep(2)
  }

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { confirm_password, ...payload } = form
      await axios.post('/api/auth/register', payload)
      setSuccess(true)
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed. Please try again.')
    }
    setLoading(false)
  }

  // ── Styles ──────────────────────────────────────────────────────────────────
  const page = {
    minHeight: '100vh',
    background: '#f4f6f9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    fontFamily: 'Inter, sans-serif',
  }
  const card = {
    background: '#fff',
    borderRadius: 16,
    padding: '36px 40px',
    width: '100%',
    maxWidth: 520,
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
  }
  const lbl = {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#6b7280',
    marginBottom: 5,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  }
  const inp = {
    width: '100%',
    padding: '10px 13px',
    border: '1px solid rgba(0,0,0,0.12)',
    borderRadius: 8,
    fontSize: '0.9rem',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    outline: 'none',
    color: '#1a1d23',
  }
  const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }
  const btnPrimary = {
    width: '100%',
    padding: '11px',
    background: '#0891b2',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontWeight: 700,
    fontSize: '0.95rem',
    cursor: 'pointer',
    marginTop: 20,
    fontFamily: 'inherit',
  }
  const btnSecondary = {
    ...btnPrimary,
    background: 'transparent',
    border: '1px solid rgba(0,0,0,0.12)',
    color: '#374151',
    marginTop: 0,
    width: 'auto',
    padding: '10px 20px',
  }

  // ── Success Screen ───────────────────────────────────────────────────────────
  if (success) return (
    <div style={page}>
      <div style={{ ...card, textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>✅</div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 10 }}>
          Registration Successful!
        </h2>
        <p style={{ color: '#6b7280', marginBottom: 28, lineHeight: 1.6 }}>
          Your account has been created. You can now log in with your email and password.
        </p>
        <button
          onClick={() => navigate('/login')}
          style={{ ...btnPrimary, marginTop: 0 }}
        >
          Go to Login
        </button>
      </div>
    </div>
  )

  return (
    <div style={page}>
      <div style={card}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 4, color: '#1a1d23' }}>
            Create Account
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
            Step {step} of 2 — {step === 1 ? 'Account Details' : 'Personal Info'}
          </p>

          {/* Progress Bar */}
          <div style={{ height: 4, background: '#e5e7eb', borderRadius: 99, marginTop: 12 }}>
            <div style={{ height: '100%', width: step === 1 ? '50%' : '100%', background: '#0891b2', borderRadius: 99, transition: 'width 0.3s ease' }} />
          </div>
        </div>

        {/* ── Error Banner ── */}
        {error && (
          <div style={{ background: '#fee2e2', color: '#dc2626', padding: '10px 14px', borderRadius: 8, marginBottom: 18, fontSize: '0.875rem', fontWeight: 500 }}>
            {error}
          </div>
        )}

        {/* ══ STEP 1 — Account Details ══════════════════════════════════════════ */}
        {step === 1 && (
          <form onSubmit={nextStep}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              <div>
                <label style={lbl}>Full Name *</label>
                <input
                  required
                  type="text"
                  style={inp}
                  placeholder="e.g. Rahul Singh"
                  value={form.full_name}
                  onChange={set('full_name')}
                />
              </div>

              <div style={grid2}>
                <div>
                  <label style={lbl}>Email *</label>
                  <input
                    required
                    type="email"
                    style={inp}
                    placeholder="you@email.com"
                    value={form.email}
                    onChange={set('email')}
                  />
                </div>
                <div>
                  <label style={lbl}>Phone *</label>
                  <input
                    required
                    type="tel"
                    style={inp}
                    placeholder="9900001111"
                    value={form.phone}
                    onChange={set('phone')}
                  />
                </div>
              </div>

              <div>
                <label style={lbl}>Password *</label>
                <input
                  required
                  type="password"
                  style={inp}
                  placeholder="Min 6 characters"
                  minLength={6}
                  value={form.password}
                  onChange={set('password')}
                />
              </div>

              <div>
                <label style={lbl}>Confirm Password *</label>
                <input
                  required
                  type="password"
                  style={inp}
                  placeholder="Re-enter password"
                  value={form.confirm_password}
                  onChange={set('confirm_password')}
                />
              </div>

            </div>

            <button type="submit" style={btnPrimary}>
              Continue →
            </button>
          </form>
        )}

        {/* ══ STEP 2 — Personal Info ════════════════════════════════════════════ */}
        {step === 2 && (
          <form onSubmit={submit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              <div style={grid2}>
                <div>
                  <label style={lbl}>Date of Birth *</label>
                  <input
                    required
                    type="date"
                    style={inp}
                    value={form.date_of_birth}
                    onChange={set('date_of_birth')}
                  />
                </div>
                <div>
                  <label style={lbl}>Blood Group</label>
                  <select
                    style={inp}
                    value={form.blood_group}
                    onChange={set('blood_group')}
                  >
                    <option value="">Select</option>
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={lbl}>Address</label>
                <input
                  type="text"
                  style={inp}
                  placeholder="City, State"
                  value={form.address}
                  onChange={set('address')}
                />
              </div>

            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button
                type="button"
                style={btnSecondary}
                onClick={() => setStep(1)}
              >
                ← Back
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{ ...btnPrimary, flex: 1, marginTop: 0 }}
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>
            </div>
          </form>
        )}

        {/* ── Footer Link ── */}
        <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.875rem', color: '#6b7280' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#0891b2', fontWeight: 600, textDecoration: 'none' }}>
            Sign in
          </Link>
        </p>

      </div>
    </div>
  )
}