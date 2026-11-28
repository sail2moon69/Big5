import { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import Page from '../components/Page'
import { api, inviteLink } from '../components/course-api'
import { BRAND_OPTIONS, DEFAULT_BRAND } from '../components/report-brands'
const { getInfo } = require('@alheimsins/b5-johnson-120-ipip-neo-pi-r')

const STATUS_LABELS = {
  created: 'angelegt',
  invited: 'eingeladen',
  started: 'begonnen',
  completed: 'abgeschlossen'
}

function formatDate (value) {
  if (!value) return '–'
  const [year, month, day] = String(value).slice(0, 10).split('-')
  return `${day}.${month}.${year}`
}

function formatDateTime (value) {
  if (!value) return '–'
  return new Date(value).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function parseParticipantLines (text) {
  return text
    .split('\n')
    .map(line => {
      const [namePart, emailPart] = line.split(';')
      return { name: (namePart || '').trim(), email: (emailPart || '').trim() }
    })
    .filter(entry => entry.name)
}

function emptyCourseForm () {
  return { name: '', startsOn: '', endsOn: '', brand: DEFAULT_BRAND, language: 'de', retentionDays: 30, showResult: false, trainerId: '' }
}

// ---------- login ----------

function LoginForm ({ onLoggedIn }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async event => {
    event.preventDefault()
    setBusy(true)
    setError(false)
    try {
      await api('POST', '/auth/login', { email: email.trim(), password })
      onLoggedIn()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form className='rdsim-card narrow' onSubmit={submit}>
      <h2>Anmeldung Lehrgangsleitung</h2>
      <label className='field'>
        <span>E-Mail-Adresse</span>
        <input className='rdsim-input' type='email' autoComplete='username' value={email} onChange={e => setEmail(e.target.value)} required />
      </label>
      <label className='field'>
        <span>Passwort</span>
        <input className='rdsim-input' type='password' autoComplete='current-password' value={password} onChange={e => setPassword(e.target.value)} required />
      </label>
      <button className='rdsim-btn rdsim-btn-primary' type='submit' disabled={busy}>{busy ? 'Anmelden…' : 'Anmelden'}</button>
      {error ? <p className='error'>{error}</p> : null}
    </form>
  )
}

// ---------- course form (create + edit) ----------

function CourseForm ({ initial, trainers, onSubmit, onCancel, submitLabel }) {
  const [form, setForm] = useState(initial)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  const { languages } = getInfo()
  const set = (key, value) => setForm(Object.assign({}, form, { [key]: value }))

  const submit = async event => {
    event.preventDefault()
    setBusy(true)
    setError(false)
    try {
      await onSubmit(Object.assign({}, form, {
        startsOn: form.startsOn || null,
        retentionDays: Number(form.retentionDays),
        trainerId: form.trainerId ? Number(form.trainerId) : undefined
      }))
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form className='course-form' onSubmit={submit}>
      <label className='field wide'>
        <span>Name des Lehrgangs</span>
        <input className='rdsim-input' value={form.name} onChange={e => set('name', e.target.value)} placeholder='z. B. OrgL-Lehrgang 1/2027' required />
      </label>
      <label className='field'>
        <span>Beginn</span>
        <input className='rdsim-input' type='date' value={form.startsOn || ''} onChange={e => set('startsOn', e.target.value)} />
      </label>
      <label className='field'>
        <span>Ende *</span>
        <input className='rdsim-input' type='date' value={form.endsOn || ''} onChange={e => set('endsOn', e.target.value)} required />
      </label>
      <label className='field'>
        <span>Löschen nach Ende (Tage)</span>
        <input className='rdsim-input' type='number' min='1' max='365' value={form.retentionDays} onChange={e => set('retentionDays', e.target.value)} required />
      </label>
      <label className='field'>
        <span>PDF-Layout</span>
        <select className='rdsim-select' value={form.brand} onChange={e => set('brand', e.target.value)}>
          {BRAND_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
      </label>
      <label className='field'>
        <span>Testsprache</span>
        <select className='rdsim-select' value={form.language} onChange={e => set('language', e.target.value)}>
          {languages.map(lang => <option key={lang.id} value={lang.id}>{lang.text}</option>)}
        </select>
      </label>
      {trainers
        ? (
          <label className='field'>
            <span>Lehrgangsleitung</span>
            <select className='rdsim-select' value={form.trainerId} onChange={e => set('trainerId', e.target.value)}>
              <option value=''>ich selbst</option>
              {trainers.filter(t => !t.disabled).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          )
        : null}
      <label className='check wide'>
        <input type='checkbox' checked={form.showResult} onChange={e => set('showResult', e.target.checked)} />
        <span>Teilnehmende sehen ihr Ergebnis direkt nach dem Test (sonst nur die Lehrgangsleitung)</span>
      </label>
      <div className='wide actions'>
        <button className='rdsim-btn rdsim-btn-primary' type='submit' disabled={busy}>{busy ? 'Speichern…' : submitLabel}</button>
        {onCancel ? <button className='rdsim-btn rdsim-btn-secondary' type='button' onClick={onCancel}>Abbrechen</button> : null}
      </div>
      {error ? <p className='error wide'>{error}</p> : null}
    </form>
  )
}

// ---------- course list ----------

function CourseList ({ me, onOpen, onError }) {
  const [courses, setCourses] = useState(false)
  const [trainers, setTrainers] = useState(false)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await api('GET', '/courses')
      setCourses(data.courses)
    } catch (err) {
      onError(err)
    }
  }, [onError])

  useEffect(() => {
    load()
    if (me.role === 'admin') {
      api('GET', '/trainers').then(data => setTrainers(data.trainers)).catch(onError)
    }
  }, [load, me.role, onError])

  const create = async form => {
    const data = await api('POST', '/courses', form)
    setCreating(false)
    onOpen(data.id)
  }

  return (
    <div className='rdsim-card'>
      <div className='card-head'>
        <h2>Lehrgänge</h2>
        {!creating ? <button className='rdsim-btn rdsim-btn-primary' onClick={() => setCreating(true)}>Neuer Lehrgang</button> : null}
      </div>
      {creating
        ? <CourseForm initial={emptyCourseForm()} trainers={trainers} onSubmit={create} onCancel={() => setCreating(false)} submitLabel='Lehrgang anlegen' />
        : null}
      {courses === false ? <p>Wird geladen…</p> : null}
      {courses && courses.length === 0 && !creating ? <p>Noch keine Lehrgänge angelegt.</p> : null}
      {courses && courses.length > 0
        ? (
          <div className='table-wrap'>
            <table>
              <thead>
                <tr>
                  <th>Lehrgang</th>
                  <th>Zeitraum</th>
                  {me.role === 'admin' ? <th>Leitung</th> : null}
                  <th>Teilnehmende</th>
                  <th>Abgeschlossen</th>
                  <th>Löschung am</th>
                </tr>
              </thead>
              <tbody>
                {courses.map(course => (
                  <tr key={course.id} className='clickable' onClick={() => onOpen(course.id)}>
                    <td><a href='#' onClick={e => { e.preventDefault(); onOpen(course.id) }}>{course.name}</a></td>
                    <td>{course.startsOn ? `${formatDate(course.startsOn)} – ` : ''}{formatDate(course.endsOn)}</td>
                    {me.role === 'admin' ? <td>{course.trainerName}</td> : null}
                    <td>{course.participantCount}</td>
                    <td>
                      <span className='progress-mini'><span style={{ width: `${course.participantCount ? Math.round(course.completedCount / course.participantCount * 100) : 0}%` }} /></span>
                      {course.completedCount} / {course.participantCount}
                    </td>
                    <td>{formatDate(course.deleteOn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )
        : null}
    </div>
  )
}

// ---------- course detail ----------

function CourseDetail ({ courseId, me, onBack, onError }) {
  const [data, setData] = useState(false)
  const [selected, setSelected] = useState([])
  const [editing, setEditing] = useState(false)
  const [newLines, setNewLines] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(false)
  const [copiedId, setCopiedId] = useState(false)

  const load = useCallback(async () => {
    try {
      const response = await api('GET', `/courses/${courseId}`)
      setData(response)
      setSelected(previous => previous.filter(id => response.participants.some(p => p.id === id)))
    } catch (err) {
      onError(err)
    }
  }, [courseId, onError])

  useEffect(() => {
    load()
    // keep the status column current while the course is taking the test
    const timer = setInterval(() => {
      if (window.document.visibilityState === 'visible') load()
    }, 30000)
    return () => clearInterval(timer)
  }, [load])

  if (!data) {
    return <div className='rdsim-card'><p>Wird geladen…</p></div>
  }

  const { course, participants } = data
  const completed = participants.filter(p => p.status === 'completed')
  const selectedParticipants = participants.filter(p => selected.includes(p.id))
  const allSelected = participants.length > 0 && selected.length === participants.length
  const toggle = id => setSelected(selected.includes(id) ? selected.filter(x => x !== id) : selected.concat(id))
  const toggleAll = () => setSelected(allSelected ? [] : participants.map(p => p.id))

  const run = async (label, work) => {
    setBusy(label)
    setMessage(false)
    try {
      const result = await work()
      if (result) setMessage({ ok: result })
    } catch (err) {
      if (err.status === 401) {
        onError(err)
        return
      }
      setMessage({ error: err.message })
    }
    setBusy(false)
  }

  const addParticipants = event => {
    event.preventDefault()
    const entries = parseParticipantLines(newLines)
    if (!entries.length) return
    run('add', async () => {
      const result = await api('POST', `/courses/${course.id}/participants`, { entries })
      setNewLines('')
      await load()
      return `${result.added} Teilnehmende hinzugefügt.`
    })
  }

  const handouts = () => run('handout', async () => {
    const { downloadHandouts } = await import('../components/course-pdfs')
    const targets = selectedParticipants.length ? selectedParticipants : participants.filter(p => p.status !== 'completed')
    if (!targets.length) return 'Keine Teilnehmenden ohne abgeschlossenen Test.'
    await downloadHandouts(course, targets)
    await api('POST', `/courses/${course.id}/mark-invited`, { participantIds: targets.map(p => p.id) })
    await load()
    return `Handout für ${targets.length} Person(en) erstellt.`
  })

  const sendMails = () => run('mail', async () => {
    const targets = selectedParticipants.filter(p => p.email && p.status !== 'completed')
    if (!targets.length) return 'In der Auswahl ist niemand mit E-Mail-Adresse und offenem Test.'
    if (!window.confirm(`Einladung per E-Mail an ${targets.length} Person(en) senden?`)) return false
    const result = await api('POST', `/courses/${course.id}/send-invites`, { participantIds: targets.map(p => p.id) })
    await load()
    const sent = result.results.filter(r => r.status === 'sent').length
    const failed = result.results.filter(r => r.status === 'failed')
    if (failed.length) throw new Error(`${sent} gesendet, ${failed.length} fehlgeschlagen: ${failed.map(f => f.name).join(', ')}`)
    return `${sent} Einladung(en) gesendet.`
  })

  const downloadOne = participant => run(`result-${participant.id}`, async () => {
    const { downloadResult } = await import('../components/course-pdfs')
    const response = await api('GET', `/courses/${course.id}/results?participant=${participant.id}`)
    await downloadResult(course, response.results[0])
    return false
  })

  const downloadAll = () => run('zip', async () => {
    const { downloadResultsZip } = await import('../components/course-pdfs')
    const response = await api('GET', `/courses/${course.id}/results`)
    if (!response.results.length) return 'Noch keine abgeschlossenen Tests.'
    await downloadResultsZip(course, response.results, (done, total) => setBusy(`zip ${done}/${total}`))
    return `${response.results.length} Bericht(e) als ZIP heruntergeladen.`
  })

  const removeParticipant = participant => {
    const warning = participant.status === 'completed'
      ? `${participant.name} entfernen? Das gespeicherte Ergebnis wird dabei endgültig gelöscht (z. B. bei Widerruf der Einwilligung).`
      : `${participant.name} entfernen? Der Einladungslink wird damit ungültig.`
    if (!window.confirm(warning)) return
    run(`remove-${participant.id}`, async () => {
      await api('DELETE', `/courses/${course.id}/participants/${participant.id}`)
      await load()
      return `${participant.name} wurde entfernt.`
    })
  }

  const deleteCourse = () => {
    const answer = window.prompt(`Lehrgang „${course.name}“ mit allen Teilnehmenden und Ergebnissen endgültig löschen?\n\nZur Bestätigung den Namen des Lehrgangs eingeben:`)
    if (answer === null) return
    if (answer.trim() !== course.name) {
      setMessage({ error: 'Der Name stimmt nicht überein – nichts gelöscht.' })
      return
    }
    run('delete', async () => {
      await api('DELETE', `/courses/${course.id}`)
      onBack()
      return false
    })
  }

  const copyLink = async participant => {
    try {
      await window.navigator.clipboard.writeText(inviteLink(participant.token))
      setCopiedId(participant.id)
      setTimeout(() => setCopiedId(false), 2000)
    } catch (err) {
      window.prompt('Link kopieren:', inviteLink(participant.token))
    }
  }

  const saveSettings = async form => {
    await api('PATCH', `/courses/${course.id}`, form)
    setEditing(false)
    await load()
  }

  const counts = Object.keys(STATUS_LABELS).reduce((acc, key) => {
    acc[key] = participants.filter(p => p.status === key).length
    return acc
  }, {})

  return (
    <>
      <div className='rdsim-card'>
        <a href='#' className='back' onClick={e => { e.preventDefault(); onBack() }}>← Alle Lehrgänge</a>
        <div className='card-head'>
          <h2>{course.name}</h2>
          {!editing ? <button className='rdsim-btn rdsim-btn-secondary' onClick={() => setEditing(true)}>Einstellungen</button> : null}
        </div>
        {editing
          ? (
            <CourseForm
              initial={{
                name: course.name,
                startsOn: course.startsOn || '',
                endsOn: course.endsOn,
                brand: course.brand,
                language: course.language,
                retentionDays: course.retentionDays,
                showResult: course.showResult
              }}
              onSubmit={saveSettings}
              onCancel={() => setEditing(false)}
              submitLabel='Speichern'
            />
            )
          : (
            <dl className='facts'>
              <div><dt>Zeitraum</dt><dd>{course.startsOn ? `${formatDate(course.startsOn)} – ` : ''}{formatDate(course.endsOn)}</dd></div>
              {me.role === 'admin' ? <div><dt>Leitung</dt><dd>{course.trainerName}</dd></div> : null}
              <div><dt>Layout</dt><dd>{(BRAND_OPTIONS.find(b => b.id === course.brand) || {}).label}</dd></div>
              <div><dt>Ergebnis für Teilnehmende</dt><dd>{course.showResult ? 'sichtbar' : 'nur Lehrgangsleitung'}</dd></div>
              <div><dt>Automatische Löschung</dt><dd>{formatDate(course.deleteOn)}</dd></div>
            </dl>
            )}
        <div className='status-row'>
          {Object.keys(STATUS_LABELS).map(key => (
            <div key={key} className={`status-box ${key}`}>
              <strong>{counts[key]}</strong>
              <span>{STATUS_LABELS[key]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className='rdsim-card'>
        <div className='card-head'>
          <h2>Teilnehmende ({participants.length})</h2>
          <button className='rdsim-btn rdsim-btn-secondary' onClick={load}>Aktualisieren</button>
        </div>
        <div className='toolbar'>
          <button className='rdsim-btn rdsim-btn-primary' onClick={handouts} disabled={Boolean(busy) || !participants.length}>
            {busy === 'handout' ? 'PDF wird erstellt…' : selected.length ? `Handout-PDF (${selected.length})` : 'Handout-PDF (alle offenen)'}
          </button>
          <button className='rdsim-btn rdsim-btn-secondary' onClick={sendMails} disabled={Boolean(busy) || !selected.length}>
            {busy === 'mail' ? 'Wird gesendet…' : `Per E-Mail einladen${selected.length ? ` (${selected.length})` : ''}`}
          </button>
          <button className='rdsim-btn rdsim-btn-secondary' onClick={downloadAll} disabled={Boolean(busy) || !completed.length}>
            {String(busy).startsWith('zip') ? `ZIP wird erstellt… ${busy.slice(4)}` : `Alle Ergebnisse als ZIP (${completed.length})`}
          </button>
        </div>
        {message && message.ok ? <p className='ok'>{message.ok}</p> : null}
        {message && message.error ? <p className='error'>{message.error}</p> : null}
        {participants.length
          ? (
            <div className='table-wrap'>
              <table>
                <thead>
                  <tr>
                    <th><input type='checkbox' checked={allSelected} onChange={toggleAll} aria-label='Alle auswählen' /></th>
                    <th>Name</th>
                    <th>E-Mail</th>
                    <th>Status</th>
                    <th>Zuletzt</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {participants.map(p => (
                    <tr key={p.id}>
                      <td><input type='checkbox' checked={selected.includes(p.id)} onChange={() => toggle(p.id)} aria-label={`${p.name} auswählen`} /></td>
                      <td>{p.name}</td>
                      <td className='muted'>{p.email || '–'}</td>
                      <td><span className={`badge ${p.status}`}>{STATUS_LABELS[p.status]}</span></td>
                      <td className='muted'>{formatDateTime(p.completedAt || p.startedAt || p.invitedAt)}</td>
                      <td className='row-actions'>
                        {p.status === 'completed'
                          ? <button className='link-btn' onClick={() => downloadOne(p)} disabled={Boolean(busy)}>{busy === `result-${p.id}` ? 'PDF…' : 'Ergebnis-PDF'}</button>
                          : <button className='link-btn' onClick={() => copyLink(p)}>{copiedId === p.id ? 'Kopiert!' : 'Link kopieren'}</button>}
                        <button className='link-btn danger' onClick={() => removeParticipant(p)} disabled={Boolean(busy)}>Entfernen</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )
          : <p>Noch keine Teilnehmenden. Fügen Sie unten die Liste ein.</p>}

        <form className='add-form' onSubmit={addParticipants}>
          <label className='field wide'>
            <span>Teilnehmende hinzufügen – eine Person pro Zeile, <code>Name;E-Mail</code> (E-Mail optional)</span>
            <textarea className='rdsim-input' rows='5' value={newLines} onChange={e => setNewLines(e.target.value)} placeholder={'Max Mustermann;max@beispiel.de\nErika Musterfrau'} />
          </label>
          <button className='rdsim-btn rdsim-btn-primary' type='submit' disabled={Boolean(busy) || !newLines.trim()}>
            {busy === 'add' ? 'Wird hinzugefügt…' : `Hinzufügen${parseParticipantLines(newLines).length ? ` (${parseParticipantLines(newLines).length})` : ''}`}
          </button>
        </form>
      </div>

      <div className='rdsim-card danger-zone'>
        <h2>Lehrgang löschen</h2>
        <p>Löscht den Lehrgang mit allen Teilnehmenden und Ergebnissen sofort und endgültig. Ohne Ihr Zutun geschieht das automatisch am {formatDate(course.deleteOn)}.</p>
        <button className='rdsim-btn rdsim-btn-secondary danger' onClick={deleteCourse} disabled={Boolean(busy)}>Lehrgang jetzt löschen</button>
      </div>
    </>
  )
}

// ---------- trainer accounts (admin) ----------

function TrainerAdmin ({ me, onError }) {
  const [trainers, setTrainers] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', role: 'trainer' })
  const [notice, setNotice] = useState(false)

  const load = useCallback(() => {
    api('GET', '/trainers').then(data => setTrainers(data.trainers)).catch(onError)
  }, [onError])
  useEffect(load, [load])

  const create = async event => {
    event.preventDefault()
    setNotice(false)
    try {
      const result = await api('POST', '/trainers', form)
      setNotice({ ok: `Konto für ${form.email} angelegt. Erstes Passwort: ${result.initialPassword}`, password: true })
      setForm({ name: '', email: '', role: 'trainer' })
      load()
    } catch (err) {
      setNotice({ error: err.message })
    }
  }

  const resetPassword = async trainer => {
    if (!window.confirm(`Neues Passwort für ${trainer.name} erzeugen? Das alte Passwort gilt dann nicht mehr.`)) return
    try {
      const result = await api('POST', `/trainers/${trainer.id}/reset-password`, {})
      setNotice({ ok: `Neues Passwort für ${trainer.email}: ${result.initialPassword}`, password: true })
    } catch (err) {
      setNotice({ error: err.message })
    }
  }

  const toggleDisabled = async trainer => {
    try {
      await api('POST', `/trainers/${trainer.id}/disabled`, { disabled: !trainer.disabled })
      load()
    } catch (err) {
      setNotice({ error: err.message })
    }
  }

  return (
    <div className='rdsim-card'>
      <h2>Konten der Lehrgangsleitungen</h2>
      {notice && notice.ok
        ? <p className='ok'>{notice.ok}{notice.password ? <><br /><small>Das Passwort wird nur jetzt angezeigt. Bitte sicher weitergeben (nicht per unverschlüsselter E-Mail zusammen mit der Adresse).</small></> : null}</p>
        : null}
      {notice && notice.error ? <p className='error'>{notice.error}</p> : null}
      {trainers
        ? (
          <div className='table-wrap'>
            <table>
              <thead><tr><th>Name</th><th>E-Mail</th><th>Rolle</th><th>Lehrgänge</th><th /></tr></thead>
              <tbody>
                {trainers.map(t => (
                  <tr key={t.id} className={t.disabled ? 'disabled' : ''}>
                    <td>{t.name}</td>
                    <td className='muted'>{t.email}</td>
                    <td>{t.role === 'admin' ? 'Admin' : 'Lehrgangsleitung'}{t.disabled ? ' (gesperrt)' : ''}</td>
                    <td>{t.course_count}</td>
                    <td className='row-actions'>
                      <button className='link-btn' onClick={() => resetPassword(t)}>Passwort zurücksetzen</button>
                      {t.id !== me.id ? <button className='link-btn danger' onClick={() => toggleDisabled(t)}>{t.disabled ? 'Entsperren' : 'Sperren'}</button> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )
        : <p>Wird geladen…</p>}
      <form className='course-form' onSubmit={create}>
        <label className='field'>
          <span>Name</span>
          <input className='rdsim-input' value={form.name} onChange={e => setForm(Object.assign({}, form, { name: e.target.value }))} required />
        </label>
        <label className='field'>
          <span>E-Mail-Adresse</span>
          <input className='rdsim-input' type='email' value={form.email} onChange={e => setForm(Object.assign({}, form, { email: e.target.value }))} required />
        </label>
        <label className='field'>
          <span>Rolle</span>
          <select className='rdsim-select' value={form.role} onChange={e => setForm(Object.assign({}, form, { role: e.target.value }))}>
            <option value='trainer'>Lehrgangsleitung (sieht nur eigene Lehrgänge)</option>
            <option value='admin'>Admin (sieht alles)</option>
          </select>
        </label>
        <div className='wide actions'>
          <button className='rdsim-btn rdsim-btn-primary' type='submit'>Konto anlegen</button>
        </div>
      </form>
    </div>
  )
}

// ---------- own password ----------

function PasswordForm ({ onDone }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState(false)

  const submit = async event => {
    event.preventDefault()
    if (next !== repeat) {
      setError('Die beiden neuen Passwörter stimmen nicht überein.')
      return
    }
    try {
      await api('POST', '/auth/password', { currentPassword: current, newPassword: next })
      onDone('Passwort geändert. Andere Sitzungen wurden abgemeldet.')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <form className='rdsim-card narrow' onSubmit={submit}>
      <h2>Passwort ändern</h2>
      <label className='field'><span>Aktuelles Passwort</span><input className='rdsim-input' type='password' autoComplete='current-password' value={current} onChange={e => setCurrent(e.target.value)} required /></label>
      <label className='field'><span>Neues Passwort (mind. 10 Zeichen)</span><input className='rdsim-input' type='password' autoComplete='new-password' minLength='10' value={next} onChange={e => setNext(e.target.value)} required /></label>
      <label className='field'><span>Neues Passwort wiederholen</span><input className='rdsim-input' type='password' autoComplete='new-password' value={repeat} onChange={e => setRepeat(e.target.value)} required /></label>
      <div className='actions'>
        <button className='rdsim-btn rdsim-btn-primary' type='submit'>Speichern</button>
        <button className='rdsim-btn rdsim-btn-secondary' type='button' onClick={() => onDone(false)}>Abbrechen</button>
      </div>
      {error ? <p className='error'>{error}</p> : null}
    </form>
  )
}

// ---------- page ----------

const Dashboard = () => {
  const [me, setMe] = useState(false)
  const [state, setState] = useState('loading') // loading | login | ready | unavailable
  const [view, setView] = useState({ name: 'courses' })
  const [flash, setFlash] = useState(false)

  const loadMe = useCallback(async () => {
    try {
      setMe(await api('GET', '/auth/me'))
      setState('ready')
    } catch (err) {
      if (err.status === 401) setState('login')
      else if (err.status === 503) setState('unavailable')
      else {
        setFlash(err.message)
        setState('login')
      }
    }
  }, [])

  useEffect(() => { loadMe() }, [loadMe])

  // any 401 on the way (session expired) brings the login back
  const handleError = useCallback(err => {
    if (err.status === 401) {
      setMe(false)
      setState('login')
      setFlash('Ihre Sitzung ist abgelaufen. Bitte erneut anmelden.')
      return
    }
    setFlash(err.message)
  }, [])

  const logout = async () => {
    await api('POST', '/auth/logout', {}).catch(() => {})
    setMe(false)
    setView({ name: 'courses' })
    setState('login')
  }

  return (
    <>
      <Head>
        <title>Lehrgangsverwaltung | Big Five</title>
        <meta name='robots' content='noindex' />
      </Head>
      <Page>
        <div className='rdsim-eyebrow'>Lehrgangsverwaltung</div>
        <h1 className='rdsim-title'>Dashboard<span className='dot'>.</span></h1>
        <div className='dashboard'>
          {state === 'ready' && me
            ? (
              <div className='userbar'>
                <span>Angemeldet als <strong>{me.name}</strong>{me.role === 'admin' ? ' (Admin)' : ''}</span>
                <span className='userbar-actions'>
                  <button className='link-btn' onClick={() => setView({ name: 'courses' })}>Lehrgänge</button>
                  {me.role === 'admin' ? <button className='link-btn' onClick={() => setView({ name: 'trainers' })}>Konten</button> : null}
                  <button className='link-btn' onClick={() => setView({ name: 'password' })}>Passwort ändern</button>
                  <button className='link-btn' onClick={logout}>Abmelden</button>
                </span>
              </div>
              )
            : null}
          {flash ? <p className='flash' role='status'>{flash} <button className='link-btn' onClick={() => setFlash(false)}>×</button></p> : null}

          {state === 'loading' ? <p>Wird geladen…</p> : null}
          {state === 'unavailable'
            ? <div className='rdsim-card narrow'><p>Die Lehrgangsverwaltung ist auf diesem Server noch nicht eingerichtet.</p></div>
            : null}
          {state === 'login' ? <LoginForm onLoggedIn={() => { setFlash(false); loadMe() }} /> : null}
          {state === 'ready' && view.name === 'courses'
            ? <CourseList me={me} onOpen={id => setView({ name: 'course', id })} onError={handleError} />
            : null}
          {state === 'ready' && view.name === 'course'
            ? <CourseDetail courseId={view.id} me={me} onBack={() => setView({ name: 'courses' })} onError={handleError} />
            : null}
          {state === 'ready' && view.name === 'trainers' ? <TrainerAdmin me={me} onError={handleError} /> : null}
          {state === 'ready' && view.name === 'password'
            ? <PasswordForm onDone={text => { setView({ name: 'courses' }); setFlash(text) }} />
            : null}
        </div>
        <style jsx global>
          {`
            .dashboard {
              max-width: 1040px;
              margin: 0 auto 60px;
              text-align: left;
            }
            .dashboard .rdsim-card {
              margin-bottom: 20px;
            }
            .dashboard .narrow {
              max-width: 440px;
              margin-left: auto;
              margin-right: auto;
            }
            .dashboard h2 {
              margin: 0 0 14px;
              font-size: 1.15rem;
            }
            .card-head {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 12px;
              flex-wrap: wrap;
              margin-bottom: 8px;
            }
            .card-head h2 {
              margin: 0;
            }
            .userbar {
              display: flex;
              justify-content: space-between;
              flex-wrap: wrap;
              gap: 8px;
              font-size: 14px;
              margin-bottom: 16px;
              color: var(--rdsim-muted);
            }
            .userbar-actions {
              display: flex;
              gap: 14px;
              flex-wrap: wrap;
            }
            .link-btn {
              background: none;
              border: none;
              color: var(--rdsim-orange);
              cursor: pointer;
              font: inherit;
              font-size: 14px;
              padding: 0;
            }
            .link-btn:hover {
              text-decoration: underline;
            }
            .link-btn:disabled {
              opacity: 0.5;
              cursor: default;
            }
            .link-btn.danger {
              color: var(--rdsim-red);
            }
            .field {
              display: flex;
              flex-direction: column;
              gap: 6px;
              margin-bottom: 14px;
              font-size: 13px;
              color: var(--rdsim-muted);
            }
            .field .rdsim-input, .field .rdsim-select {
              width: 100%;
              box-sizing: border-box;
            }
            .field textarea {
              font-family: inherit;
              resize: vertical;
            }
            .check {
              display: flex;
              gap: 10px;
              align-items: flex-start;
              font-size: 14px;
              margin: 4px 0 14px;
              cursor: pointer;
            }
            .check input {
              margin-top: 3px;
            }
            .course-form {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
              column-gap: 16px;
              margin: 12px 0 20px;
              padding-bottom: 8px;
              border-bottom: 1px solid var(--rdsim-border);
            }
            .course-form .wide {
              grid-column: 1 / -1;
            }
            .actions {
              display: flex;
              gap: 10px;
              flex-wrap: wrap;
            }
            .actions .rdsim-btn, .toolbar .rdsim-btn {
              margin: 0;
            }
            .table-wrap {
              overflow-x: auto;
              margin: 8px 0 16px;
            }
            .dashboard table {
              width: 100%;
              border-collapse: collapse;
              font-size: 14px;
            }
            .dashboard th {
              text-align: left;
              font-size: 11px;
              letter-spacing: 0.08em;
              text-transform: uppercase;
              color: var(--rdsim-muted);
              font-weight: 700;
              padding: 8px 10px;
              border-bottom: 1px solid var(--rdsim-border);
              white-space: nowrap;
            }
            .dashboard td {
              padding: 10px;
              border-bottom: 1px solid var(--rdsim-border);
              vertical-align: middle;
            }
            .dashboard tr.clickable {
              cursor: pointer;
            }
            .dashboard tr.clickable:hover td {
              background: rgba(255, 255, 255, 0.03);
            }
            .dashboard tr.disabled td {
              opacity: 0.5;
            }
            .muted {
              color: var(--rdsim-muted);
            }
            .row-actions {
              white-space: nowrap;
              text-align: right;
            }
            .row-actions .link-btn + .link-btn {
              margin-left: 14px;
            }
            .badge {
              display: inline-block;
              font-size: 11px;
              font-weight: 700;
              letter-spacing: 0.04em;
              text-transform: uppercase;
              padding: 3px 8px;
              border-radius: 999px;
              border: 1px solid var(--rdsim-border);
              color: var(--rdsim-muted);
              white-space: nowrap;
            }
            .badge.invited {
              color: #8fb3d9;
              border-color: rgba(143, 179, 217, 0.4);
            }
            .badge.started {
              color: var(--rdsim-orange);
              border-color: rgba(244, 160, 28, 0.45);
            }
            .badge.completed {
              color: #5fd39a;
              border-color: rgba(95, 211, 154, 0.45);
            }
            .facts {
              display: flex;
              flex-wrap: wrap;
              gap: 10px 32px;
              margin: 6px 0 18px;
            }
            .facts dt {
              font-size: 11px;
              letter-spacing: 0.08em;
              text-transform: uppercase;
              color: var(--rdsim-muted);
            }
            .facts dd {
              margin: 2px 0 0;
              font-size: 15px;
            }
            .status-row {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 10px;
            }
            .status-box {
              border: 1px solid var(--rdsim-border);
              padding: 10px 12px;
              display: flex;
              flex-direction: column;
            }
            .status-box strong {
              font-size: 1.6rem;
              line-height: 1.1;
            }
            .status-box span {
              font-size: 12px;
              color: var(--rdsim-muted);
              text-transform: uppercase;
              letter-spacing: 0.06em;
            }
            .status-box.completed strong {
              color: #5fd39a;
            }
            .status-box.started strong {
              color: var(--rdsim-orange);
            }
            .toolbar {
              display: flex;
              gap: 10px;
              flex-wrap: wrap;
              margin: 8px 0 6px;
            }
            .progress-mini {
              display: inline-block;
              width: 60px;
              height: 6px;
              background: rgba(255, 255, 255, 0.08);
              margin-right: 8px;
              vertical-align: middle;
            }
            .progress-mini span {
              display: block;
              height: 100%;
              background: #5fd39a;
            }
            .add-form {
              margin-top: 18px;
            }
            .back {
              display: inline-block;
              font-size: 14px;
              margin-bottom: 10px;
            }
            .ok {
              color: #5fd39a;
              overflow-wrap: anywhere;
            }
            .error {
              color: var(--rdsim-red);
            }
            .flash {
              border-left: 3px solid var(--rdsim-orange);
              padding: 8px 12px;
              background: rgba(244, 160, 28, 0.08);
              font-size: 14px;
            }
            .danger-zone p {
              font-size: 14px;
            }
            .rdsim-btn.danger {
              border-color: var(--rdsim-red);
              color: var(--rdsim-red);
            }
            @media (max-width: 640px) {
              .status-row {
                grid-template-columns: repeat(2, 1fr);
              }
            }
          `}
        </style>
      </Page>
    </>
  )
}

export default Dashboard
