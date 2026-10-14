import { APP_NAME } from './brand'
const store = {
  get(k) { try { return localStorage.getItem(k) } catch { return null } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v) } catch { /* storage blocked */ } },
}
export { store }

export const getToken = () => store.get('cr_token')
export const getStaff = () => { try { return JSON.parse(store.get('cr_staff')) } catch { return null } }
export function setSession(token, staff) {
  store.set('cr_token', token)
  store.set('cr_staff', staff ? JSON.stringify(staff) : null)
}

export class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status }
}

export async function api(path, { method, body } = {}) {
  const headers = { Accept: 'application/json' }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const citizen = getCitizen()
  if (citizen) headers['X-Citizen-Token'] = citizen.token
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  let res
  try {
    res = await fetch(path, { method: method || (body !== undefined ? 'POST' : 'GET'), headers, body: body !== undefined ? JSON.stringify(body) : undefined })
  } catch {
    throw new ApiError(`Cannot reach the ${APP_NAME} server. Check your connection and try again.`, 0)
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    let msg = data?.detail
    if (Array.isArray(msg)) msg = msg.map(d => d.msg || JSON.stringify(d)).join('; ')
    if (res.status === 401 && citizen && /^\/api\/reports/.test(path) && /citizen/i.test(msg || '')) setCitizen(null)  // citizen session expired
    else if (res.status === 401 && token && !path.startsWith('/api/auth')) setSession(null)
    throw new ApiError(msg || `Request failed (${res.status})`, res.status)
  }
  return data
}

/* Demo citizen session (simulated identity — no Aadhaar data is stored). */
// Only a session carrying a server-issued token counts; older browser-only sessions are ignored.
export const getCitizen = () => { try { const c = JSON.parse(store.get('cr_citizen')); return c?.token ? c : null } catch { return null } }
export const setCitizen = c => store.set('cr_citizen', c ? JSON.stringify(c) : null)
