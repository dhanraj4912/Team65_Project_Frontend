import { createContext, useContext, useState, useEffect } from 'react'
import axios from 'axios'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const savedToken = sessionStorage.getItem('vc_token')
    const savedUser = sessionStorage.getItem('vc_user')
    if (savedToken && savedUser) {
      setToken(savedToken)
      setUser(JSON.parse(savedUser))
      axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`
    }
    setLoading(false)
  }, [])

  const login = (userData, tokenData) => {
    setUser(userData)
    setToken(tokenData)
    sessionStorage.setItem('vc_token', tokenData)
    sessionStorage.setItem('vc_user', JSON.stringify(userData))
    axios.defaults.headers.common['Authorization'] = `Bearer ${tokenData}`
  }

  const logout = () => {
    setUser(null)
    setToken(null)
    sessionStorage.removeItem('vc_token')
    sessionStorage.removeItem('vc_user')
    delete axios.defaults.headers.common['Authorization']
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading, isAdmin: user?.role === 'admin', isPatient: user?.role === 'patient' }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)