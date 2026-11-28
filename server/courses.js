// Lehrgangsverwaltung: trainer logins, courses, participants and stored results.
// Mounted at /app; nginx forwards /api/app/ here WITHOUT basic auth, because participants
// call the /t/ routes from their own browser. Everything else checks the session cookie.
const express = require('express')
const db = require('./db')
const security = require('./security')

const SESSION_COOKIE = 'big5_session'
const SESSION_HOURS = 12
const MAX_PARTICIPANTS_PER_REQUEST = 200
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const BRANDS = ['rdsim', 'sina']
const DOMAINS = ['N', 'E', 'O', 'A', 'C']
const ITEM_COUNT = 120
const MIN_PASSWORD_LENGTH = 10
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000

class HttpError extends Error {
  constructor (status, message) {
    super(message)
    this.status = status
  }
}

function isValidEmail (value) {
  return typeof value === 'string' && value.length <= 254 && EMAIL_PATTERN.test(value.trim())
}

function cleanText (value, maxLength) {
  if (typeof value !== 'string') {
    return ''
  }
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maxLength) // eslint-disable-line no-control-regex
}

function isValidDate (value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    return false
  }
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function parseCookies (header) {
  const cookies = {}
  String(header || '').split(';').forEach(part => {
    const index = part.indexOf('=')
    if (index > 0) {
      cookies[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim())
    }
  })
  return cookies
}

// A small in-memory brake on password guessing; nginx limits the request rate on top.
function createLoginLimiter ({ maxFailures = 10, windowMs = 15 * 60 * 1000 } = {}) {
  const failures = new Map()
  function key (ip, email) {
    return `${ip}|${String(email || '').toLowerCase()}`
  }
  function prune (now) {
    for (const [entryKey, entry] of failures) {
      if (now - entry.first > windowMs) failures.delete(entryKey)
    }
  }
  return {
    isBlocked (ip, email) {
      const now = Date.now()
      prune(now)
      const entry = failures.get(key(ip, email))
      return Boolean(entry && entry.count >= maxFailures)
    },
    fail (ip, email) {
      const now = Date.now()
      const entryKey = key(ip, email)
      const entry = failures.get(entryKey)
      if (entry) entry.count++
      else failures.set(entryKey, { count: 1, first: now })
    },
    succeed (ip, email) {
      failures.delete(key(ip, email))
    }
  }
}

function validateAnswers (answers) {
  if (!Array.isArray(answers) || answers.length !== ITEM_COUNT) {
    return false
  }
  const seen = new Set()
  for (const answer of answers) {
    if (!answer || typeof answer !== 'object') return false
    const id = answer.id
    const score = Number(answer.score)
    const facet = Number(answer.facet)
    if (typeof id !== 'string' || id.length === 0 || id.length > 64 || seen.has(id)) return false
    if (!DOMAINS.includes(answer.domain)) return false
    if (!Number.isInteger(facet) || facet < 1 || facet > 6) return false
    if (!Number.isInteger(score) || score < 1 || score > 5) return false
    seen.add(id)
  }
  return true
}

function participantStatus (row) {
  if (row.completed_at) return 'completed'
  if (row.consent_at) return 'started'
  if (row.invited_at) return 'invited'
  return 'created'
}

function createCourseRouter ({ dataKey, sendInvite, buildLink, secureCookies = true, logger = console }) {
  if (!dataKey) {
    throw new Error('createCourseRouter needs a data key')
  }
  const router = express.Router()
  const loginLimiter = createLoginLimiter()

  const asyncRoute = handler => (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next)
  }

  function audit (trainerId, action, courseId = null, participantId = null) {
    return db.query(
      'INSERT INTO audit_log (trainer_id, action, course_id, participant_id) VALUES ($1, $2, $3, $4)',
      [trainerId, action, courseId, participantId]
    )
  }

  function setSessionCookie (res, token, maxAgeSeconds) {
    const parts = [
      `${SESSION_COOKIE}=${token}`,
      'Path=/api/app',
      'HttpOnly',
      'SameSite=Strict',
      `Max-Age=${maxAgeSeconds}`
    ]
    if (secureCookies) parts.push('Secure')
    res.setHeader('Set-Cookie', parts.join('; '))
  }

  // ---------- participant routes (no login, the token is the credential) ----------

  async function loadParticipantByToken (token) {
    if (typeof token !== 'string' || token.length < 20 || token.length > 64) {
      return null
    }
    const { rows } = await db.query(
      `SELECT p.id, p.name, p.consent_at, p.completed_at, c.id AS course_id, c.name AS course_name,
              c.brand, c.language, c.show_result, c.ends_on, (c.ends_on + c.retention_days) AS delete_on,
              t.name AS trainer_name
         FROM participants p JOIN courses c ON c.id = p.course_id JOIN trainers t ON t.id = c.trainer_id
        WHERE p.token_hash = $1`,
      [security.sha256(token)]
    )
    return rows[0] || null
  }

  router.get('/t/:token', asyncRoute(async (req, res) => {
    const participant = await loadParticipantByToken(req.params.token)
    if (!participant) {
      throw new HttpError(404, 'Dieser Einladungslink ist ungültig oder der Lehrgang wurde bereits gelöscht.')
    }
    res.json({
      name: participant.name,
      courseName: participant.course_name,
      trainerName: participant.trainer_name,
      deleteOn: participant.delete_on,
      brand: participant.brand,
      language: participant.language,
      showResult: participant.show_result,
      consentGiven: Boolean(participant.consent_at),
      completed: Boolean(participant.completed_at)
    })
  }))

  router.post('/t/:token/consent', asyncRoute(async (req, res) => {
    const { consentVersion } = req.body || {}
    const version = cleanText(consentVersion, 40)
    if (!version) {
      throw new HttpError(400, 'consentVersion fehlt.')
    }
    const participant = await loadParticipantByToken(req.params.token)
    if (!participant) {
      throw new HttpError(404, 'Dieser Einladungslink ist ungültig oder der Lehrgang wurde bereits gelöscht.')
    }
    if (participant.completed_at) {
      throw new HttpError(409, 'Der Test wurde mit diesem Link bereits abgeschlossen.')
    }
    await db.query(
      'UPDATE participants SET consent_at = coalesce(consent_at, now()), consent_version = coalesce(consent_version, $2) WHERE id = $1',
      [participant.id, version]
    )
    res.json({ ok: true })
  }))

  router.post('/t/:token/submit', asyncRoute(async (req, res) => {
    const { language, answers } = req.body || {}
    if (!validateAnswers(answers)) {
      throw new HttpError(400, 'Die Antworten sind unvollständig oder ungültig.')
    }
    const participant = await loadParticipantByToken(req.params.token)
    if (!participant) {
      throw new HttpError(404, 'Dieser Einladungslink ist ungültig oder der Lehrgang wurde bereits gelöscht.')
    }
    if (!participant.consent_at) {
      throw new HttpError(409, 'Bitte bestätigen Sie zuerst die Einwilligung.')
    }
    const payload = JSON.stringify({
      language: cleanText(language, 10) || participant.language,
      answers: answers.map(({ id, domain, facet, score }) => ({ id, domain, facet: Number(facet), score: Number(score) }))
    })
    const stored = await db.withTransaction(async client => {
      const insert = await client.query(
        'INSERT INTO results (participant_id, payload_enc) VALUES ($1, $2) ON CONFLICT (participant_id) DO NOTHING',
        [participant.id, security.encrypt(dataKey, payload, `result:${participant.id}`)]
      )
      if (insert.rowCount === 0) {
        return false
      }
      await client.query('UPDATE participants SET completed_at = now() WHERE id = $1', [participant.id])
      return true
    })
    if (!stored) {
      throw new HttpError(409, 'Der Test wurde mit diesem Link bereits abgeschlossen.')
    }
    res.json({ ok: true, showResult: participant.show_result })
  }))

  // ---------- trainer login ----------

  router.post('/auth/login', asyncRoute(async (req, res) => {
    const { email, password } = req.body || {}
    if (!isValidEmail(email) || typeof password !== 'string' || password.length === 0 || password.length > 200) {
      throw new HttpError(400, 'Bitte E-Mail-Adresse und Passwort angeben.')
    }
    const normalized = email.trim().toLowerCase()
    if (loginLimiter.isBlocked(req.ip, normalized)) {
      throw new HttpError(429, 'Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen.')
    }
    const { rows } = await db.query('SELECT id, password_hash, disabled FROM trainers WHERE email = $1', [normalized])
    const trainer = rows[0]
    const valid = trainer
      ? await security.verifyPassword(password, trainer.password_hash)
      : await security.verifyDummy(password)
    if (!valid || trainer.disabled) {
      loginLimiter.fail(req.ip, normalized)
      throw new HttpError(401, 'E-Mail-Adresse oder Passwort ist falsch.')
    }
    loginLimiter.succeed(req.ip, normalized)
    const token = security.randomToken(32)
    await db.query(
      `INSERT INTO sessions (token_hash, trainer_id, expires_at) VALUES ($1, $2, now() + interval '${SESSION_HOURS} hours')`,
      [security.sha256(token), trainer.id]
    )
    setSessionCookie(res, token, SESSION_HOURS * 3600)
    await audit(trainer.id, 'login')
    res.json({ ok: true })
  }))

  // Everything below needs a session. State-changing requests also need the custom header:
  // a cross-site form can't send it, and a cross-site fetch with it fails the CORS preflight.
  router.use(asyncRoute(async (req, res, next) => {
    if (req.method !== 'GET' && req.get('x-requested-with') !== 'big5') {
      throw new HttpError(403, 'Anfrage abgelehnt.')
    }
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE]
    if (!token) {
      throw new HttpError(401, 'Bitte melden Sie sich an.')
    }
    const { rows } = await db.query(
      `SELECT t.id, t.email, t.name, t.role
         FROM sessions s JOIN trainers t ON t.id = s.trainer_id
        WHERE s.token_hash = $1 AND s.expires_at > now() AND NOT t.disabled`,
      [security.sha256(token)]
    )
    if (!rows[0]) {
      throw new HttpError(401, 'Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.')
    }
    req.trainer = rows[0]
    req.sessionTokenHash = security.sha256(token)
    next()
  }))

  function requireAdmin (req) {
    if (req.trainer.role !== 'admin') {
      throw new HttpError(403, 'Nur für Administratoren.')
    }
  }

  router.get('/auth/me', (req, res) => {
    const { id, email, name, role } = req.trainer
    res.json({ id, email, name, role })
  })

  router.post('/auth/logout', asyncRoute(async (req, res) => {
    await db.query('DELETE FROM sessions WHERE token_hash = $1', [req.sessionTokenHash])
    setSessionCookie(res, '', 0)
    res.json({ ok: true })
  }))

  router.post('/auth/password', asyncRoute(async (req, res) => {
    const { currentPassword, newPassword } = req.body || {}
    if (typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD_LENGTH || newPassword.length > 200) {
      throw new HttpError(400, `Das neue Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein.`)
    }
    const { rows } = await db.query('SELECT password_hash FROM trainers WHERE id = $1', [req.trainer.id])
    if (typeof currentPassword !== 'string' || !(await security.verifyPassword(currentPassword, rows[0].password_hash))) {
      throw new HttpError(400, 'Das aktuelle Passwort ist falsch.')
    }
    await db.query('UPDATE trainers SET password_hash = $2 WHERE id = $1', [req.trainer.id, await security.hashPassword(newPassword)])
    // end every other session of this account
    await db.query('DELETE FROM sessions WHERE trainer_id = $1 AND token_hash <> $2', [req.trainer.id, req.sessionTokenHash])
    await audit(req.trainer.id, 'change_password')
    res.json({ ok: true })
  }))

  // ---------- trainer accounts (admin) ----------

  router.get('/trainers', asyncRoute(async (req, res) => {
    requireAdmin(req)
    const { rows } = await db.query(
      `SELECT t.id, t.email, t.name, t.role, t.disabled, t.created_at,
              (SELECT count(*)::int FROM courses c WHERE c.trainer_id = t.id) AS course_count
         FROM trainers t ORDER BY t.name`
    )
    res.json({ trainers: rows })
  }))

  router.post('/trainers', asyncRoute(async (req, res) => {
    requireAdmin(req)
    const { email, name, role } = req.body || {}
    const cleanName = cleanText(name, 200)
    if (!isValidEmail(email) || !cleanName) {
      throw new HttpError(400, 'Name und gültige E-Mail-Adresse sind Pflichtfelder.')
    }
    const cleanRole = role === 'admin' ? 'admin' : 'trainer'
    const password = security.generatePassword()
    try {
      const { rows } = await db.query(
        'INSERT INTO trainers (email, name, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
        [email.trim().toLowerCase(), cleanName, await security.hashPassword(password), cleanRole]
      )
      await audit(req.trainer.id, 'create_trainer')
      res.json({ id: rows[0].id, initialPassword: password })
    } catch (error) {
      if (error.code === '23505') {
        throw new HttpError(409, 'Für diese E-Mail-Adresse gibt es bereits ein Konto.')
      }
      throw error
    }
  }))

  router.post('/trainers/:id/reset-password', asyncRoute(async (req, res) => {
    requireAdmin(req)
    const password = security.generatePassword()
    const { rowCount } = await db.query('UPDATE trainers SET password_hash = $2 WHERE id = $1', [Number(req.params.id), await security.hashPassword(password)])
    if (!rowCount) {
      throw new HttpError(404, 'Konto nicht gefunden.')
    }
    await db.query('DELETE FROM sessions WHERE trainer_id = $1', [Number(req.params.id)])
    await audit(req.trainer.id, 'reset_password')
    res.json({ initialPassword: password })
  }))

  router.post('/trainers/:id/disabled', asyncRoute(async (req, res) => {
    requireAdmin(req)
    const id = Number(req.params.id)
    if (id === req.trainer.id) {
      throw new HttpError(400, 'Das eigene Konto kann nicht gesperrt werden.')
    }
    const disabled = Boolean((req.body || {}).disabled)
    const { rowCount } = await db.query('UPDATE trainers SET disabled = $2 WHERE id = $1', [id, disabled])
    if (!rowCount) {
      throw new HttpError(404, 'Konto nicht gefunden.')
    }
    if (disabled) {
      await db.query('DELETE FROM sessions WHERE trainer_id = $1', [id])
    }
    await audit(req.trainer.id, disabled ? 'disable_trainer' : 'enable_trainer')
    res.json({ ok: true })
  }))

  // ---------- courses ----------

  async function loadCourse (req, id) {
    const courseId = Number(id)
    if (!Number.isInteger(courseId) || courseId <= 0) {
      throw new HttpError(404, 'Lehrgang nicht gefunden.')
    }
    const { rows } = await db.query(
      `SELECT c.*, t.name AS trainer_name, t.email AS trainer_email,
              (c.ends_on + c.retention_days) AS delete_on
         FROM courses c JOIN trainers t ON t.id = c.trainer_id WHERE c.id = $1`,
      [courseId]
    )
    const course = rows[0]
    // a course of another trainer answers exactly like a missing one
    if (!course || (req.trainer.role !== 'admin' && course.trainer_id !== req.trainer.id)) {
      throw new HttpError(404, 'Lehrgang nicht gefunden.')
    }
    return course
  }

  function readCourseInput (body, existing = {}) {
    const input = body || {}
    const course = {
      name: input.name !== undefined ? cleanText(input.name, 200) : existing.name,
      startsOn: input.startsOn !== undefined ? (input.startsOn || null) : (existing.startsOn || null),
      endsOn: input.endsOn !== undefined ? input.endsOn : existing.endsOn,
      brand: input.brand !== undefined ? input.brand : (existing.brand || 'rdsim'),
      language: input.language !== undefined ? cleanText(input.language, 10) : (existing.language || 'de'),
      retentionDays: input.retentionDays !== undefined ? Number(input.retentionDays) : (existing.retentionDays || 30),
      showResult: input.showResult !== undefined ? Boolean(input.showResult) : Boolean(existing.showResult)
    }
    if (!course.name) throw new HttpError(400, 'Bitte einen Namen für den Lehrgang angeben.')
    if (!isValidDate(course.endsOn)) throw new HttpError(400, 'Bitte ein gültiges Enddatum angeben.')
    if (course.startsOn !== null && !isValidDate(course.startsOn)) throw new HttpError(400, 'Das Startdatum ist ungültig.')
    if (course.startsOn && course.startsOn > course.endsOn) throw new HttpError(400, 'Das Startdatum liegt nach dem Enddatum.')
    if (!BRANDS.includes(course.brand)) throw new HttpError(400, 'Unbekanntes Layout.')
    if (!/^[a-z]{2}(-[a-z]{2,4})?$/i.test(course.language)) throw new HttpError(400, 'Unbekannte Sprache.')
    if (!Number.isInteger(course.retentionDays) || course.retentionDays < 1 || course.retentionDays > 365) {
      throw new HttpError(400, 'Die Löschfrist muss zwischen 1 und 365 Tagen liegen.')
    }
    return course
  }

  function formatCourse (row) {
    return {
      id: row.id,
      name: row.name,
      startsOn: row.starts_on,
      endsOn: row.ends_on,
      brand: row.brand,
      language: row.language,
      retentionDays: row.retention_days,
      showResult: row.show_result,
      deleteOn: row.delete_on,
      trainerId: row.trainer_id,
      trainerName: row.trainer_name,
      trainerEmail: row.trainer_email,
      createdAt: row.created_at
    }
  }

  router.get('/courses', asyncRoute(async (req, res) => {
    const isAdmin = req.trainer.role === 'admin'
    const { rows } = await db.query(
      `SELECT c.*, t.name AS trainer_name, t.email AS trainer_email,
              (c.ends_on + c.retention_days) AS delete_on,
              count(p.id)::int AS participant_count,
              count(p.consent_at)::int AS started_count,
              count(p.completed_at)::int AS completed_count
         FROM courses c
         JOIN trainers t ON t.id = c.trainer_id
         LEFT JOIN participants p ON p.course_id = c.id
        WHERE $1 OR c.trainer_id = $2
        GROUP BY c.id, t.name, t.email
        ORDER BY c.ends_on DESC, c.id DESC`,
      [isAdmin, req.trainer.id]
    )
    res.json({
      courses: rows.map(row => Object.assign(formatCourse(row), {
        participantCount: row.participant_count,
        startedCount: row.started_count,
        completedCount: row.completed_count
      }))
    })
  }))

  router.post('/courses', asyncRoute(async (req, res) => {
    const course = readCourseInput(req.body)
    // an admin may set up a course for someone else
    let trainerId = req.trainer.id
    if (req.trainer.role === 'admin' && req.body && req.body.trainerId) {
      trainerId = Number(req.body.trainerId)
      const { rows } = await db.query('SELECT id FROM trainers WHERE id = $1 AND NOT disabled', [trainerId])
      if (!rows[0]) throw new HttpError(400, 'Lehrgangsleitung nicht gefunden.')
    }
    const { rows } = await db.query(
      `INSERT INTO courses (trainer_id, name, starts_on, ends_on, brand, language, retention_days, show_result)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [trainerId, course.name, course.startsOn, course.endsOn, course.brand, course.language, course.retentionDays, course.showResult]
    )
    await audit(req.trainer.id, 'create_course', rows[0].id)
    res.json({ id: rows[0].id })
  }))

  router.patch('/courses/:id', asyncRoute(async (req, res) => {
    const existing = formatCourse(await loadCourse(req, req.params.id))
    const course = readCourseInput(req.body, existing)
    await db.query(
      `UPDATE courses SET name = $2, starts_on = $3, ends_on = $4, brand = $5, language = $6,
              retention_days = $7, show_result = $8 WHERE id = $1`,
      [existing.id, course.name, course.startsOn, course.endsOn, course.brand, course.language, course.retentionDays, course.showResult]
    )
    await audit(req.trainer.id, 'update_course', existing.id)
    res.json({ ok: true })
  }))

  router.delete('/courses/:id', asyncRoute(async (req, res) => {
    const course = await loadCourse(req, req.params.id)
    await db.query('DELETE FROM courses WHERE id = $1', [course.id])
    await audit(req.trainer.id, 'delete_course', course.id)
    res.json({ ok: true })
  }))

  router.get('/courses/:id', asyncRoute(async (req, res) => {
    const course = await loadCourse(req, req.params.id)
    const { rows } = await db.query(
      `SELECT id, name, email, token_hash, token_enc, invited_at, consent_at, completed_at, created_at
         FROM participants WHERE course_id = $1 ORDER BY name, id`,
      [course.id]
    )
    res.json({
      course: formatCourse(course),
      participants: rows.map(row => ({
        id: row.id,
        name: row.name,
        email: row.email,
        token: security.decrypt(dataKey, row.token_enc, `token:${row.token_hash}`),
        status: participantStatus(row),
        invitedAt: row.invited_at,
        startedAt: row.consent_at,
        completedAt: row.completed_at
      }))
    })
  }))

  router.post('/courses/:id/participants', asyncRoute(async (req, res) => {
    const course = await loadCourse(req, req.params.id)
    const entries = (req.body || {}).entries
    if (!Array.isArray(entries) || entries.length === 0) {
      throw new HttpError(400, 'Keine Teilnehmenden übergeben.')
    }
    if (entries.length > MAX_PARTICIPANTS_PER_REQUEST) {
      throw new HttpError(400, `Höchstens ${MAX_PARTICIPANTS_PER_REQUEST} Teilnehmende auf einmal.`)
    }
    const cleaned = entries.map(entry => {
      const name = cleanText(entry && entry.name, 200)
      const email = entry && entry.email ? String(entry.email).trim() : ''
      if (!name) throw new HttpError(400, 'Jede Zeile braucht einen Namen.')
      if (email && !isValidEmail(email)) throw new HttpError(400, `Ungültige E-Mail-Adresse bei ${name}.`)
      return { name, email: email || null }
    })
    await db.withTransaction(async client => {
      for (const entry of cleaned) {
        const token = security.randomToken()
        const tokenHash = security.sha256(token)
        await client.query(
          'INSERT INTO participants (course_id, name, email, token_hash, token_enc) VALUES ($1, $2, $3, $4, $5)',
          [course.id, entry.name, entry.email, tokenHash, security.encrypt(dataKey, token, `token:${tokenHash}`)]
        )
      }
    })
    await audit(req.trainer.id, 'add_participants', course.id)
    res.json({ added: cleaned.length })
  }))

  router.delete('/courses/:id/participants/:pid', asyncRoute(async (req, res) => {
    const course = await loadCourse(req, req.params.id)
    const { rowCount } = await db.query('DELETE FROM participants WHERE id = $1 AND course_id = $2', [Number(req.params.pid), course.id])
    if (!rowCount) throw new HttpError(404, 'Teilnehmende Person nicht gefunden.')
    await audit(req.trainer.id, 'delete_participant', course.id, Number(req.params.pid))
    res.json({ ok: true })
  }))

  function readParticipantIds (body) {
    const ids = (body || {}).participantIds
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 1000 || !ids.every(id => Number.isInteger(id) && id > 0)) {
      throw new HttpError(400, 'Keine Teilnehmenden ausgewählt.')
    }
    return ids
  }

  // the handout PDF was printed for these participants
  router.post('/courses/:id/mark-invited', asyncRoute(async (req, res) => {
    const course = await loadCourse(req, req.params.id)
    const ids = readParticipantIds(req.body)
    await db.query(
      'UPDATE participants SET invited_at = coalesce(invited_at, now()) WHERE course_id = $1 AND id = ANY($2::int[])',
      [course.id, ids]
    )
    res.json({ ok: true })
  }))

  router.post('/courses/:id/send-invites', asyncRoute(async (req, res) => {
    const course = await loadCourse(req, req.params.id)
    const ids = readParticipantIds(req.body)
    const { rows } = await db.query(
      'SELECT id, name, email, token_hash, token_enc FROM participants WHERE course_id = $1 AND id = ANY($2::int[]) ORDER BY id',
      [course.id, ids]
    )
    const results = []
    for (const row of rows) {
      if (!row.email) {
        results.push({ id: row.id, name: row.name, status: 'skipped', reason: 'keine E-Mail-Adresse' })
        continue
      }
      const token = security.decrypt(dataKey, row.token_enc, `token:${row.token_hash}`)
      try {
        await sendInvite({
          name: row.name,
          email: row.email,
          link: buildLink(token),
          courseName: course.name,
          trainerName: course.trainer_name,
          showResult: course.show_result
        })
        await db.query('UPDATE participants SET invited_at = now() WHERE id = $1', [row.id])
        results.push({ id: row.id, name: row.name, status: 'sent' })
      } catch (error) {
        logger.warn('course invite failed:', error.message)
        results.push({ id: row.id, name: row.name, status: 'failed', reason: error.message })
      }
    }
    await audit(req.trainer.id, 'send_invites', course.id)
    res.json({ results })
  }))

  // Decrypted answers of completed participants; the browser builds the PDFs from them.
  // ?participant=ID narrows it to one person.
  router.get('/courses/:id/results', asyncRoute(async (req, res) => {
    const course = await loadCourse(req, req.params.id)
    const participantId = req.query.participant ? Number(req.query.participant) : null
    const { rows } = await db.query(
      `SELECT p.id, p.name, p.completed_at, r.payload_enc
         FROM results r JOIN participants p ON p.id = r.participant_id
        WHERE p.course_id = $1 AND ($2::int IS NULL OR p.id = $2)
        ORDER BY p.name, p.id`,
      [course.id, participantId]
    )
    if (participantId && !rows[0]) {
      throw new HttpError(404, 'Für diese Person liegt noch kein Ergebnis vor.')
    }
    const results = rows.map(row => ({
      participantId: row.id,
      name: row.name,
      completedAt: row.completed_at,
      result: JSON.parse(security.decrypt(dataKey, row.payload_enc, `result:${row.id}`))
    }))
    for (const row of rows) {
      await audit(req.trainer.id, 'download_result', course.id, row.id)
    }
    res.json({ course: { id: course.id, name: course.name, brand: course.brand }, results })
  }))

  router.use((req, res) => {
    res.status(404).json({ error: 'Nicht gefunden.' })
  })

  // eslint-disable-next-line no-unused-vars
  router.use((error, req, res, next) => {
    if (error instanceof HttpError) {
      res.status(error.status).json({ error: error.message })
      return
    }
    if (error.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'Ungültige Anfrage.' })
      return
    }
    logger.error('course api error:', error.message)
    res.status(500).json({ error: 'Interner Fehler. Bitte später erneut versuchen.' })
  })

  return router
}

// Deletes courses whose retention has run out, expired sessions and old audit entries.
async function runCleanup (logger = console) {
  const courses = await db.query('DELETE FROM courses WHERE ends_on + retention_days < current_date RETURNING id')
  await db.query('DELETE FROM sessions WHERE expires_at < now()')
  await db.query("DELETE FROM audit_log WHERE at < now() - interval '365 days'")
  for (const row of courses.rows) {
    await db.query("INSERT INTO audit_log (action, course_id) VALUES ('auto_delete_course', $1)", [row.id])
  }
  if (courses.rowCount) {
    logger.log(`cleanup: deleted ${courses.rowCount} expired course(s)`)
  }
  return courses.rowCount
}

function scheduleCleanup (logger = console) {
  const run = () => runCleanup(logger).catch(error => logger.error('cleanup failed:', error.message))
  run()
  const timer = setInterval(run, CLEANUP_INTERVAL_MS)
  timer.unref()
  return timer
}

module.exports = { createCourseRouter, runCleanup, scheduleCleanup, validateAnswers }
