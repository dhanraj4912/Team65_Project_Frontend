import axios from 'axios'

const apiBaseURL = import.meta.env.VITE_API_BASE_URL || "https://voicecare.shop"
const api = axios.create({
  baseURL: `${apiBaseURL}/api`,
  timeout: 10000,
  withCredentials: true,
})

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

export const patientAPI = {
  list: () => api.get('/patients/'),
  search: (q) => api.get(`/patients/search?q=${q}`),
  get: (id) => api.get(`/patients/${id}`),
  create: (data) => api.post('/patients/', data),
  delete: (id) => api.delete(`/patients/${id}`)
}

export const doctorAPI = {
  list: () => api.get('/doctors/'),
  bySpecialization: (s) => api.get(`/doctors/specialization/${s}`)
}

export const appointmentAPI = {
  list: () => api.get('/appointments/'),
  byPatient: (pid) => api.get(`/appointments/patient/${pid}`),
  book: (data) => api.post('/appointments/', data),
  slots: (data) => api.post('/appointments/available-slots', data),
  update: (id, data) => api.patch(`/appointments/${id}`, data),
  patientApprove: (id, action) => api.patch(`/appointments/patient-approve/${id}?action=${action}`)
}

export const insuranceAPI = {
  byPatient: (pid) => api.get(`/insurance/patient/${pid}`),
  add: (data) => api.post('/insurance/', data),
  verify: (data) => api.post('/insurance/verify', data)
}

export const voiceAPI = {
  startSession: (patientId = null) => {
    const url = patientId 
      ? `/voice/session/start?patient_id=${patientId}` 
      : '/voice/session/start'
    return api.post(url)
  },
  chat: (data) => api.post('/voice/chat', data),
  voiceChat: (sessionId, audioBlob) => {
    const form = new FormData()
    form.append('audio', audioBlob, 'recording.webm')
    return api.post(`/voice/voice-chat?session_id=${sessionId}`, form, {
      responseType: 'blob',
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  endSession: (sid) => api.delete(`/voice/session/${sid}`)
}

export const adminAPI = {
  getStats: () => api.get('/admin/stats'),
  getPatients: () => api.get('/admin/patients'),
  createPatient: (data) => api.post('/admin/patients', data),
  getPendingInsurance: () => api.get('/admin/insurance/pending'),
  reviewInsurance: (recordId, action, reason = '') => api.patch(`/admin/insurance/${recordId}/review`, { action, reason })
}

export default api