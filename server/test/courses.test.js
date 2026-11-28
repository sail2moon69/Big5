/* global fetch */
// Integration test against a real PostgreSQL. Runs only when PGDATABASE is set, e.g.
//   PGHOST=127.0.0.1 PGPORT=55432 PGUSER=postgres PGDATABASE=big5test npm test
// The database is wiped first - never point it at a production database.
const { test, before, after } = require('node:test')
const assert = require('node:assert')
const crypto = require('crypto')
const express = require('express')

const skip = !process.env.PGDATABASE && 'PGDATABASE not set'

const db = require('../db')
const security = require('../security')
const { createCourseRouter, runCleanup, validateAnswers } = require('../courses')

const DATA_KEY = crypto.randomBytes(32)
const sentMails = []
let server
let baseUrl

function makeAnswers () {
  const answers = []
  const domains = ['N', 'E', 'O', 'A', 'C']
  for (let i = 0; i < 120; i++) {
    answers.push({ id: `item-${i}`, domain: domains[i % 5], facet: (i % 6) + 1, score: (i % 5) + 1 })
  }
  return answers
}

function client () {
  let cookie = ''
  return async function call (method, path, body) {
    const headers = { 'x-requested-with': 'big5' }
    if (body !== undefined) headers['content-type'] = 'application/json'
    if (cookie) headers.cookie = cookie
    const response = await fetch(baseUrl + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
    const setCookie = response.headers.get('set-cookie')
    if (setCookie) cookie = setCookie.split(';')[0]
    const data = await response.json().catch(() => ({}))
    return { status: response.status, data }
  }
}

before(async () => {
  if (skip) return
  await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public')
  await db.migrate()
  await db.migrate() // second run must be a no-op
  const app = express()
  app.use('/app', express.json(), createCourseRouter({
    dataKey: DATA_KEY,
    buildLink: token => `https://example.test/test?t=${token}`,
    sendInvite: async mail => { sentMails.push(mail) },
    secureCookies: false,
    logger: { log () {}, warn () {}, error () {} }
  }))
  await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve) })
  baseUrl = `http://127.0.0.1:${server.address().port}/app`
  await db.query(
    "INSERT INTO trainers (email, name, password_hash, role) VALUES ('admin@example.test', 'Admin', $1, 'admin')",
    [await security.hashPassword('admin-passwort-1')]
  )
})

after(async () => {
  if (server) server.close()
  await db.close()
})

test('encryption binds the value to its context', () => {
  const value = security.encrypt(DATA_KEY, 'geheim', 'result:1')
  assert.strictEqual(security.decrypt(DATA_KEY, value, 'result:1'), 'geheim')
  assert.throws(() => security.decrypt(DATA_KEY, value, 'result:2'))
})

test('answer validation', () => {
  assert.ok(validateAnswers(makeAnswers()))
  assert.ok(!validateAnswers(makeAnswers().slice(1)))
  const duplicate = makeAnswers()
  duplicate[1].id = duplicate[0].id
  assert.ok(!validateAnswers(duplicate))
  const badScore = makeAnswers()
  badScore[0].score = 9
  assert.ok(!validateAnswers(badScore))
})

test('full course flow', { skip }, async () => {
  const admin = client()
  const anonymous = client()

  assert.strictEqual((await anonymous('GET', '/courses')).status, 401)
  assert.strictEqual((await admin('POST', '/auth/login', { email: 'admin@example.test', password: 'falsch' })).status, 401)
  assert.strictEqual((await admin('POST', '/auth/login', { email: 'ADMIN@example.test', password: 'admin-passwort-1' })).status, 200)
  assert.strictEqual((await admin('GET', '/auth/me')).data.role, 'admin')

  // a second trainer who must not see the admin's course
  const created = await admin('POST', '/trainers', { email: 'trainer@example.test', name: 'Trainerin' })
  assert.strictEqual(created.status, 200)
  const trainer = client()
  assert.strictEqual((await trainer('POST', '/auth/login', { email: 'trainer@example.test', password: created.data.initialPassword })).status, 200)
  assert.strictEqual((await trainer('GET', '/trainers')).status, 403)

  assert.strictEqual((await admin('POST', '/courses', { name: 'X', endsOn: '2026-02-30' })).status, 400)
  const course = await admin('POST', '/courses', { name: 'Lehrgang A', startsOn: '2026-12-01', endsOn: '2026-12-05', brand: 'sina', showResult: false })
  assert.strictEqual(course.status, 200)
  const courseId = course.data.id

  assert.strictEqual((await trainer('GET', `/courses/${courseId}`)).status, 404)
  assert.strictEqual((await trainer('GET', '/courses')).data.courses.length, 0)

  // missing custom header is refused (CSRF guard)
  const noHeader = await fetch(`${baseUrl}/courses`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
  assert.strictEqual(noHeader.status, 403)

  const added = await admin('POST', `/courses/${courseId}/participants`, {
    entries: [{ name: 'Anna Muster', email: 'anna@example.test' }, { name: 'Ben Ohne' }]
  })
  assert.strictEqual(added.data.added, 2)

  let detail = (await admin('GET', `/courses/${courseId}`)).data
  assert.strictEqual(detail.participants.length, 2)
  assert.deepStrictEqual(detail.participants.map(p => p.status), ['created', 'created'])
  const anna = detail.participants.find(p => p.name === 'Anna Muster')
  const ben = detail.participants.find(p => p.name === 'Ben Ohne')

  // tokens are not stored in clear text
  const raw = await db.query('SELECT token_enc, token_hash FROM participants WHERE id = $1', [anna.id])
  assert.ok(!raw.rows[0].token_enc.includes(anna.token))

  const send = await admin('POST', `/courses/${courseId}/send-invites`, { participantIds: [anna.id, ben.id] })
  assert.deepStrictEqual(send.data.results.map(r => r.status), ['sent', 'skipped'])
  assert.strictEqual(sentMails[0].link, `https://example.test/test?t=${anna.token}`)
  assert.strictEqual(sentMails[0].courseName, 'Lehrgang A')
  await admin('POST', `/courses/${courseId}/mark-invited`, { participantIds: [ben.id] })

  // participant side
  const info = await anonymous('GET', `/t/${anna.token}`)
  assert.strictEqual(info.data.name, 'Anna Muster')
  assert.strictEqual(info.data.brand, 'sina')
  assert.strictEqual(info.data.consentGiven, false)
  assert.strictEqual((await anonymous('GET', '/t/ungueltiger-token-der-lang-genug-ist')).status, 404)
  assert.strictEqual((await anonymous('POST', `/t/${anna.token}/submit`, { language: 'de', answers: makeAnswers() })).status, 409)
  assert.strictEqual((await anonymous('POST', `/t/${anna.token}/consent`, { consentVersion: '2026-11' })).status, 200)
  assert.strictEqual((await anonymous('POST', `/t/${anna.token}/submit`, { language: 'de', answers: makeAnswers().slice(3) })).status, 400)
  const submitted = await anonymous('POST', `/t/${anna.token}/submit`, { language: 'de', answers: makeAnswers() })
  assert.strictEqual(submitted.status, 200)
  assert.strictEqual(submitted.data.showResult, false)
  assert.strictEqual((await anonymous('POST', `/t/${anna.token}/submit`, { language: 'de', answers: makeAnswers() })).status, 409)

  // stored encrypted
  const stored = await db.query('SELECT payload_enc FROM results WHERE participant_id = $1', [anna.id])
  assert.ok(!stored.rows[0].payload_enc.includes('item-0'))

  detail = (await admin('GET', `/courses/${courseId}`)).data
  assert.strictEqual(detail.participants.find(p => p.id === anna.id).status, 'completed')
  assert.strictEqual(detail.participants.find(p => p.id === ben.id).status, 'invited')

  const list = (await admin('GET', '/courses')).data.courses[0]
  assert.strictEqual(list.completedCount, 1)
  assert.strictEqual(list.deleteOn, '2027-01-04')

  const results = (await admin('GET', `/courses/${courseId}/results`)).data
  assert.strictEqual(results.results.length, 1)
  assert.strictEqual(results.results[0].result.answers.length, 120)
  assert.strictEqual((await admin('GET', `/courses/${courseId}/results?participant=${ben.id}`)).status, 404)

  const audits = await db.query("SELECT count(*)::int AS n FROM audit_log WHERE action = 'download_result'")
  assert.strictEqual(audits.rows[0].n, 1)

  // course in the past -> cleanup removes it with everything in it
  const old = await admin('POST', '/courses', { name: 'Alt', endsOn: '2020-01-01', retentionDays: 30 })
  await admin('POST', `/courses/${old.data.id}/participants`, { entries: [{ name: 'Weg' }] })
  assert.strictEqual(await runCleanup({ log () {} }), 1)
  assert.strictEqual((await admin('GET', `/courses/${old.data.id}`)).status, 404)
  assert.strictEqual((await admin('GET', `/courses/${courseId}`)).status, 200)

  assert.strictEqual((await admin('PATCH', `/courses/${courseId}`, { retentionDays: 90 })).status, 200)
  assert.strictEqual((await admin('GET', `/courses/${courseId}`)).data.course.retentionDays, 90)

  // password change ends the other sessions
  const second = client()
  await second('POST', '/auth/login', { email: 'trainer@example.test', password: created.data.initialPassword })
  assert.strictEqual((await trainer('POST', '/auth/password', { currentPassword: created.data.initialPassword, newPassword: 'neues-passwort-123' })).status, 200)
  assert.strictEqual((await second('GET', '/auth/me')).status, 401)
  assert.strictEqual((await trainer('GET', '/auth/me')).status, 200)

  await admin('DELETE', `/courses/${courseId}`)
  assert.strictEqual((await anonymous('GET', `/t/${anna.token}`)).status, 404)
  assert.strictEqual((await db.query('SELECT count(*)::int AS n FROM results')).rows[0].n, 0)

  assert.strictEqual((await admin('POST', '/auth/logout', {})).status, 200)
  assert.strictEqual((await admin('GET', '/auth/me')).status, 401)
})
