import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Dashboard from './pages/Dashboard'
import VoiceAgent from './pages/VoiceAgent'
import Patients from './pages/Patients'
import Appointments from './pages/Appointments'
import Insurance from './pages/Insurance'
import AdminRequests from './pages/AdminRequests'
import Login from './pages/Login'
import Register from './pages/Register'
import PatientDashboard from './pages/PatientDashboard'

// ── Admin Sidebar Layout ──────────────────────────────────────────────────
function AdminLayout({ children }) {
  const { user, logout } = useAuth()

  // Not logged in → go to login
  if (!user) return <Navigate to="/login" replace />

  // Logged in as patient → go to patient portal
  if (user.role === 'patient') return <Navigate to="/patient" replace />

  const NAV = [
    { to: '/',            label: 'Dashboard',    icon: '📊' },
    { to: '/voice',       label: 'Voice AI',     icon: '🎤' },
    { to: '/patients',    label: 'Patients',     icon: '👥' },
    { to: '/appointments',label: 'Appointments', icon: '📅' },
    { to: '/insurance',   label: 'Insurance',    icon: '🛡️' },
    { to: '/requests',    label: 'Requests',     icon: '🔔' },
  ]

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-label="VoiceCare">
            <circle cx="14" cy="14" r="13" stroke="#0891b2" strokeWidth="2"/>
            <path d="M10 14 Q10 8 14 8 Q18 8 18 14" stroke="#0891b2" strokeWidth="2" fill="none" strokeLinecap="round"/>
            <circle cx="14" cy="14" r="2.5" fill="#0891b2"/>
          </svg>
          <span>VoiceCare Admin</span>
        </div>
        <nav className="sidebar-nav">
          {NAV.map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) => isActive ? 'active' : ''}
            >
              <span>{n.icon}</span>
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div style={{ marginTop: 'auto', padding: '12px' }}>
          <button
            onClick={logout}
            style={{ width: '100%', padding: '8px', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, background: 'transparent', cursor: 'pointer', fontSize: '0.85rem', color: '#6b7280' }}
          >
            Logout
          </button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  )
}

// ── Patient Route Guard ───────────────────────────────────────────────────
function PatientRoute() {
  const { user } = useAuth()

  // Not logged in
  if (!user) return <Navigate to="/login" replace />

  // Logged in as admin → redirect to admin dashboard
  if (user.role === 'admin') return <Navigate to="/" replace />

  return <PatientDashboard />
}

// ── Root redirect: send logged-in users to right place ────────────────────
function RootRedirect() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'patient') return <Navigate to="/patient" replace />
  return <AdminLayout><Dashboard /></AdminLayout>
}

// ── All Routes ────────────────────────────────────────────────────────────
function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login"    element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Patient portal */}
      <Route path="/patient" element={<PatientRoute />} />

      {/* Root: smart redirect based on role */}
      <Route path="/" element={<RootRedirect />} />

      {/* Admin pages */}
      <Route path="/voice"        element={<AdminLayout><VoiceAgent /></AdminLayout>} />
      <Route path="/patients"     element={<AdminLayout><Patients /></AdminLayout>} />
      <Route path="/appointments" element={<AdminLayout><Appointments /></AdminLayout>} />
      <Route path="/insurance"    element={<AdminLayout><Insurance /></AdminLayout>} />
      <Route path="/requests"     element={<AdminLayout><AdminRequests /></AdminLayout>} />

      {/* Catch-all → login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}


// ── App Root ──────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}













































