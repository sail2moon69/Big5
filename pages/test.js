import { useState, useEffect } from 'react'
import Head from 'next/head'
import Page from '../components/Page'
import Item from '../components/Item'
import { api } from '../components/course-api'
import { CONSENT_VERSION, CONSENT_CHECKBOX_TEXT, getConsentSections } from '../components/course-consent'
const { getItems, getInfo } = require('@alheimsins/b5-johnson-120-ipip-neo-pi-r')
const { pack, unpack } = require('jcb64')

function getStorageKey (inviteCode) {
  return `big5-test-progress-${inviteCode || 'anonymous'}`
}

// getItems shuffles on every call. Without remembering the order, a reload shows a different
// set of questions while the answers stay stored - answered questions seem to vanish.
function applySavedOrder (items, order) {
  if (!Array.isArray(order) || order.length !== items.length) {
    return items
  }
  const byId = {}
  items.forEach(item => { byId[item.id] = item })
  if (!order.every(id => byId[id])) {
    return items
  }
  return order.map(id => byId[id])
}

function loadSavedProgress (storageKey) {
  try {
    const raw = window.localStorage.getItem(storageKey)
    return raw ? JSON.parse(raw) : false
  } catch (error) {
    return false
  }
}

const Test = props => {
  const [answers, setAnswers] = useState({})
  const [items, setItems] = useState(false)
  const [revealedCount, setRevealedCount] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState('de')
  const [participantName, setParticipantName] = useState(false)
  const [participantEmail, setParticipantEmail] = useState(false)
  const [participantSealed, setParticipantSealed] = useState(false)
  const [trainerEmail, setTrainerEmail] = useState(false)
  const [brand, setBrand] = useState(false)
  const [storageKey, setStorageKey] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(false)
  // Lehrgangsverwaltung: the link carries only a token (?t=), everything else comes from the server
  const [courseToken, setCourseToken] = useState(false)
  const [courseInfo, setCourseInfo] = useState(false)
  const [courseError, setCourseError] = useState(false)
  const [consentChecked, setConsentChecked] = useState(false)
  const [consentSaving, setConsentSaving] = useState(false)
  const [consentError, setConsentError] = useState(false)
  const [courseDone, setCourseDone] = useState(false)

  const loadLanguage = (language, key) => {
    const saved = loadSavedProgress(key)
    // item ids are the same in every language, so the saved order also survives a language switch
    const shuffledItems = getItems(language, true)
    shuffledItems.reverse()
    const loadedItems = applySavedOrder(shuffledItems, saved && saved.order)
    setSelectedLanguage(language)
    setItems(loadedItems)

    if (saved && saved.answers && typeof saved.revealedCount === 'number') {
      setAnswers(saved.answers)
      setRevealedCount(saved.revealedCount)
    } else {
      setAnswers({})
      setRevealedCount(1)
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search.replace('?', ''))
    const token = params.get('t')
    if (token) {
      setCourseToken(token)
      api('GET', `/t/${encodeURIComponent(token)}`)
        .then(info => {
          setCourseInfo(info)
          setParticipantName(info.name)
          setBrand(info.brand || false)
          const key = getStorageKey(`t-${token}`)
          setStorageKey(key)
          loadLanguage(info.language || 'de', key)
        })
        .catch(error => setCourseError(error.message))
      return
    }
    const code = params.get('invite')
    let language = params.get('language') || 'de'
    if (code) {
      try {
        const invite = unpack(code)
        language = invite.language || language
        setParticipantName(invite.name)
        setParticipantEmail(invite.email || false)
        setParticipantSealed(Boolean(invite.sealed && invite.trainerEmail))
        setTrainerEmail(invite.trainerEmail || false)
        setBrand(invite.brand || false)
      } catch (error) {
        setParticipantName(false)
        setParticipantEmail(false)
        setParticipantSealed(false)
        setTrainerEmail(false)
      }
    }
    const key = getStorageKey(code)
    setStorageKey(key)
    loadLanguage(language, key)
  }, [])

  useEffect(() => {
    if (!storageKey || revealedCount === false || items === false) {
      return
    }
    try {
      const order = items.map(item => item.id)
      window.localStorage.setItem(storageKey, JSON.stringify({ answers, revealedCount, order }))
    } catch (error) {
      // localStorage unavailable (e.g. private browsing quota) - progress just won't survive a reload
    }
  }, [answers, revealedCount, storageKey, items])

  const handleLanguageChange = event => {
    loadLanguage(event.target.value, storageKey)
  }

  const setAnswer = event => {
    event.preventDefault()
    const qid = event.target.dataset.qid
    const isFirstAnswer = !(qid in answers)

    setAnswers(previousAnswers => ({
      ...previousAnswers,
      [qid]: {
        id: qid,
        domain: event.target.dataset.domain,
        facet: event.target.dataset.facet,
        score: event.target.dataset.score
      }
    }))

    if (isFirstAnswer) {
      setRevealedCount(previousCount => Math.min(previousCount + 1, items.length))
    }
  }

  const giveConsent = async event => {
    event.preventDefault()
    if (!consentChecked || consentSaving) {
      return
    }
    setConsentSaving(true)
    setConsentError(false)
    try {
      await api('POST', `/t/${encodeURIComponent(courseToken)}/consent`, { consentVersion: CONSENT_VERSION })
      setCourseInfo(Object.assign({}, courseInfo, { consentGiven: true }))
    } catch (error) {
      setConsentError(error.message)
    }
    setConsentSaving(false)
  }

  const collectChoices = () => Object.keys(answers).map(key => {
    const choice = answers[key]
    return { id: choice.id, domain: choice.domain, facet: choice.facet, score: choice.score }
  })

  const clearProgress = () => {
    if (storageKey) {
      try {
        window.localStorage.removeItem(storageKey)
      } catch (error) {
        // ignore - nothing to clean up if storage isn't available
      }
    }
  }

  const submitToCourse = async () => {
    const choices = collectChoices()
    try {
      const response = await api('POST', `/t/${encodeURIComponent(courseToken)}/submit`, { language: selectedLanguage, answers: choices })
      clearProgress()
      if (response.showResult) {
        // shown from the answers in the browser, like any other result link
        const result = { language: selectedLanguage, answers: choices, name: participantName }
        if (brand) {
          result.brand = brand
        }
        window.location = `/result?id=${pack(result)}`
        return
      }
      setCourseDone(true)
      window.scrollTo(0, 0)
    } catch (error) {
      setIsSubmitting(false)
      if (error.status === 409) {
        clearProgress()
        setCourseInfo(Object.assign({}, courseInfo, { completed: true }))
        return
      }
      setSubmitError(`${error.message} Ihre Antworten sind in diesem Browser gespeichert – bitte versuchen Sie es erneut.`)
    }
  }

  const handleSubmit = event => {
    if (isSubmitting) {
      return
    }
    if (items !== false && Object.keys(answers).length < items.length) {
      setSubmitError('Bitte beantworten Sie alle Fragen, bevor Sie den Test absenden.')
      return
    }
    setIsSubmitting(true)
    setSubmitError(false)
    if (courseToken) {
      submitToCourse()
      return
    }
    try {
      const choices = collectChoices()
      const result = {
        language: selectedLanguage,
        answers: choices
      }
      if (participantName) {
        result.name = participantName
      }
      if (participantEmail) {
        result.email = participantEmail
      }
      if (brand) {
        result.brand = brand
      }
      if (participantSealed) {
        result.sealed = true
        result.trainerEmail = trainerEmail
      }
      // Pack and confirm the navigation target BEFORE touching saved progress - if anything
      // above throws, the participant's answers stay safely in localStorage for a retry.
      const b64 = pack(result)
      const target = `/result?id=${b64}`
      clearProgress()
      window.location = target
    } catch (error) {
      setIsSubmitting(false)
      setSubmitError('Beim Absenden ist ein Fehler aufgetreten. Ihre Antworten sind gespeichert - bitte versuchen Sie es erneut.')
    }
  }

  const answeredCount = Object.keys(answers).length
  const totalCount = items !== false ? items.length : 120
  // an unanswered item quietly skews the facet it belongs to, so the test has to be complete
  const unansweredItems = items !== false ? items.filter(item => !(item.id in answers)) : []
  const isComplete = items !== false && unansweredItems.length === 0

  const scrollToFirstUnanswered = event => {
    event.preventDefault()
    const first = unansweredItems[0]
    if (!first) {
      return
    }
    const element = window.document.getElementById(`frage-${first.id}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }
  const progressPercent = totalCount ? Math.round((answeredCount / totalCount) * 100) : 0
  const visibleItems = items !== false && revealedCount !== false
    ? items.slice(Math.max(items.length - revealedCount, 0))
    : []

  if (courseToken) {
    let notice = null
    if (courseError) {
      notice = <p className='course-message error'>{courseError}</p>
    } else if (!courseInfo) {
      notice = <p className='course-message'>Einladung wird geladen…</p>
    } else if (courseDone) {
      notice = (
        <>
          <h2 className='course-heading'>Vielen Dank<span className='dot'>.</span></h2>
          <p className='course-message'>Ihre Antworten wurden gespeichert und stehen Ihrer Lehrgangsleitung zur Verfügung. Ihr Ergebnis wird im Lehrgang mit Ihnen besprochen. Sie können diese Seite jetzt schließen.</p>
        </>
      )
    } else if (courseInfo.completed) {
      notice = <p className='course-message'>Sie haben den Test mit diesem Link bereits abgeschlossen. Ihre Antworten liegen Ihrer Lehrgangsleitung vor.</p>
    } else if (!courseInfo.consentGiven) {
      notice = (
        <form className='consent' onSubmit={giveConsent}>
          <p className='course-message'>Hallo <strong>{courseInfo.name}</strong>, bevor Sie beginnen, lesen Sie bitte die folgenden Hinweise.</p>
          {getConsentSections(courseInfo).map(section => (
            <div className='consent-section' key={section.heading}>
              <h3>{section.heading}</h3>
              <p>{section.text}</p>
            </div>
          ))}
          <label className='consent-check'>
            <input type='checkbox' checked={consentChecked} onChange={event => setConsentChecked(event.target.checked)} />
            <span>{CONSENT_CHECKBOX_TEXT}</span>
          </label>
          <button className='rdsim-btn rdsim-btn-primary' type='submit' disabled={!consentChecked || consentSaving}>
            {consentSaving ? 'Wird gespeichert…' : 'Einwilligen und Test starten'}
          </button>
          {consentError ? <p className='course-message error'>{consentError}</p> : null}
          <p className='consent-small'>Wenn Sie nicht teilnehmen möchten, schließen Sie diese Seite einfach. Es wird nichts gespeichert.</p>
        </form>
      )
    }
    if (notice) {
      return (
        <>
          <Head>
            <title>Big Five Persönlichkeitstest</title>
          </Head>
          <Page>
            <div className='rdsim-eyebrow'>{courseInfo ? courseInfo.courseName : 'Persönlichkeitstest'}</div>
            <h1 className='rdsim-title'>Big Five<span className='dot'>.</span></h1>
            {notice}
            <style jsx global>
              {`
                .course-heading {
                  color: var(--rdsim-text);
                }
                .course-message {
                  color: var(--rdsim-text);
                  max-width: 560px;
                  margin: 16px auto;
                }
                .course-message.error {
                  color: var(--rdsim-red);
                }
                .consent {
                  max-width: 640px;
                  margin: 0 auto 40px;
                  text-align: left;
                }
                .consent .course-message {
                  text-align: center;
                }
                .consent-section {
                  border-left: 3px solid var(--rdsim-orange);
                  padding: 2px 0 2px 14px;
                  margin: 16px 0;
                }
                .consent-section h3 {
                  font-size: 13px;
                  letter-spacing: 0.06em;
                  text-transform: uppercase;
                  margin: 0 0 4px;
                  color: var(--rdsim-text);
                }
                .consent-section p {
                  margin: 0;
                  font-size: 14px;
                  line-height: 1.55;
                  color: var(--rdsim-text);
                }
                .consent-check {
                  display: flex;
                  gap: 10px;
                  align-items: flex-start;
                  margin: 24px 0 18px;
                  font-size: 14px;
                  line-height: 1.5;
                  cursor: pointer;
                }
                .consent-check input {
                  margin-top: 4px;
                  width: 18px;
                  height: 18px;
                  flex-shrink: 0;
                }
                .consent button {
                  display: block;
                  margin: 0 auto;
                }
                .consent-small {
                  font-size: 13px;
                  color: var(--rdsim-muted);
                  text-align: center;
                  margin-top: 14px;
                }
              `}
            </style>
          </Page>
        </>
      )
    }
  }

  return (
    <>
      <Head>
        <title>Big Five Persönlichkeitstest</title>
      </Head>
      <Page>
        <div className='rdsim-eyebrow'>{courseInfo ? courseInfo.courseName : 'Persönlichkeitstest'}</div>
        <h1 className='rdsim-title'>Big Five<span className='dot'>.</span></h1>
        {participantName ? <p className='greeting'>Hallo, <strong>{participantName}</strong>!</p> : null}
        {participantSealed
          ? (
            <p className='sealed-note'>
              <strong>Lehrgangsmodus:</strong> Ihr Ergebnis wird Ihnen nicht angezeigt. Nach dem Absenden geht Ihr
              Ergebnisbericht einmalig per E-Mail an Ihre Lehrgangsleitung ({trainerEmail}) und wird im Lehrgang mit
              Ihnen besprochen.
            </p>
            )
          : null}

        {items !== false
          ? (
            <div className='progress-wrapper'>
              <div className='progress-label'>{answeredCount} von {totalCount} Fragen beantwortet</div>
              <div className='progress-track'>
                <div className='progress-fill' style={{ width: `${progressPercent}%` }} />
              </div>
              <p className='progress-hint'>
                Ihr Fortschritt wird automatisch in Ihrem Browser gespeichert. Sie können den Test jederzeit
                unterbrechen und später über denselben Link fortsetzen.
              </p>
            </div>
            )
          : null}

        {items !== false && answeredCount === 0
          ? (
            <div className='language-wrapper'>
              <label htmlFor='testLanguage'>Testsprache</label>
              <select id='testLanguage' className='rdsim-select' value={selectedLanguage} onChange={handleLanguageChange}>
                {getInfo().languages.map(lang => (
                  <option value={lang.id} key={lang.id}>{lang.text}</option>
                ))}
              </select>
            </div>
            )
          : null}

        {items !== false && revealedCount === items.length
          ? (
            <div className='submit-wrapper'>
              <button className='rdsim-btn rdsim-btn-primary' onClick={handleSubmit} disabled={isSubmitting || !isComplete}>
                {isSubmitting ? 'Wird gesendet…' : 'Absenden'}
              </button>
              {!isComplete
                ? (
                  <p className='submit-hint'>
                    Noch {unansweredItems.length} {unansweredItems.length === 1 ? 'Frage ist' : 'Fragen sind'} unbeantwortet.{' '}
                    <a href='#' onClick={scrollToFirstUnanswered}>Zur ersten offenen Frage</a>
                  </p>
                  )
                : null}
              {submitError ? <p className='submit-error'>{submitError}</p> : null}
            </div>
            )
          : null}
        {visibleItems.map(item => <Item data={item} answers={answers} setAnswer={setAnswer} key={item.id} />)}
        <style jsx>
          {`
            .greeting {
              text-align: center;
              color: var(--rdsim-text);
              margin-bottom: 10px;
            }
            .sealed-note {
              text-align: center;
              color: var(--rdsim-text);
              font-size: 14px;
              max-width: 560px;
              margin: 0 auto 16px;
              overflow-wrap: anywhere;
            }
            .progress-wrapper {
              max-width: 480px;
              margin: 0 auto 20px;
              text-align: center;
            }
            .progress-label {
              color: var(--rdsim-text);
              font-size: 13px;
              font-weight: 700;
              letter-spacing: 0.04em;
              text-transform: uppercase;
              margin-bottom: 6px;
            }
            .progress-track {
              background: rgba(255, 255, 255, 0.08);
              border: 1px solid var(--rdsim-border);
              height: 8px;
              overflow: hidden;
            }
            .progress-fill {
              background: linear-gradient(135deg, var(--rdsim-red) 0%, var(--rdsim-orange) 100%);
              height: 100%;
              transition: width 0.3s ease;
            }
            .progress-hint {
              color: var(--rdsim-muted);
              font-size: 13px;
              margin-top: 10px;
            }
            .language-wrapper {
              max-width: 320px;
              margin: 0 auto 20px;
              text-align: center;
            }
            .language-wrapper label {
              display: block;
              color: var(--rdsim-muted);
              font-size: 12px;
              font-weight: 700;
              letter-spacing: 0.04em;
              text-transform: uppercase;
              margin-bottom: 6px;
            }
            .language-wrapper select {
              width: 100%;
            }
            .submit-wrapper {
              text-align: center;
            }
            .submit-hint {
              color: var(--rdsim-text);
              font-size: 14px;
              max-width: 480px;
              margin: 12px auto 0;
            }
            .submit-hint a {
              color: var(--rdsim-red);
            }
            .submit-error {
              color: var(--rdsim-red);
              max-width: 480px;
              margin: 8px auto 0;
            }
          `}
        </style>
      </Page>
    </>
  )
}

export default Test
