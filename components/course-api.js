// Calls to the Lehrgangsverwaltung (/api/app/). The session lives in an HttpOnly cookie;
// the custom header is what the server checks against cross-site requests.
export class ApiError extends Error {
  constructor (status, message) {
    super(message)
    this.status = status
  }
}

export async function api (method, path, body) {
  const options = {
    method,
    credentials: 'same-origin',
    headers: { 'x-requested-with': 'big5' }
  }
  if (body !== undefined) {
    options.headers['content-type'] = 'application/json'
    options.body = JSON.stringify(body)
  }
  let response
  try {
    response = await window.fetch(`/api/app${path}`, options)
  } catch (error) {
    throw new ApiError(0, 'Keine Verbindung zum Server. Bitte Internetverbindung prüfen.')
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new ApiError(response.status, data.error || `Fehler ${response.status}`)
  }
  return data
}

export function inviteLink (token) {
  return `${window.location.origin}/test?t=${encodeURIComponent(token)}`
}
