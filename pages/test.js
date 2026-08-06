import { useState, useEffect } from 'react'
import Head from 'next/head'
import Page from '../components/Page'
import Item from '../components/Item'
const { getItems, getInfo } = require('@alheimsins/b5-johnson-120-ipip-neo-pi-r')
const { pack, unpack } = require('jcb64')

function getStorageKey (inviteCode) {
  return `big5-test-progress-${inviteCode || 'anonymous'}`
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
  const [storageKey, setStorageKey] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(false)

  const loadLanguage = (language, key) => {
    const loadedItems = getItems(language, true)
    loadedItems.reverse()
    setSelectedLanguage(language)
    setItems(loadedItems)

    const saved = loadSavedProgress(key)
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
    if (!storageKey || revealedCount === false) {
      return
    }
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ answers, revealedCount }))
    } catch (error) {
      // localStorage unavailable (e.g. private browsing quota) - progress just won't survive a reload
    }
  }, [answers, revealedCount, storageKey])

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

  const handleSubmit = event => {
    if (isSubmitting) {
      return
    }
    setIsSubmitting(true)
    setSubmitError(false)
    try {
      const choices = Object.keys(answers).reduce((prev, current) => {
        const choice = answers[current]
        prev.push({
          id: choice.id,
          domain: choice.domain,
          facet: choice.facet,
          score: choice.score
        })
        return prev
      }, [])
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
      if (participantSealed) {
        result.sealed = true
        result.trainerEmail = trainerEmail
      }
      // Pack and confirm the navigation target BEFORE touching saved progress - if anything
      // above throws, the participant's answers stay safely in localStorage for a retry.
      const b64 = pack(result)
      const target = `/result?id=${b64}`
      if (storageKey) {
        try {
          window.localStorage.removeItem(storageKey)
        } catch (error) {
          // ignore - nothing to clean up if storage isn't available
        }
      }
      window.location = target
    } catch (error) {
      setIsSubmitting(false)
      setSubmitError('Beim Absenden ist ein Fehler aufgetreten. Ihre Antworten sind gespeichert - bitte versuchen Sie es erneut.')
    }
  }

  const answeredCount = Object.keys(answers).length
  const totalCount = items !== false ? items.length : 120
  const progressPercent = totalCount ? Math.round((answeredCount / totalCount) * 100) : 0
  const visibleItems = items !== false && revealedCount !== false
    ? items.slice(Math.max(items.length - revealedCount, 0))
    : []

  return (
    <>
      <Head>
        <title>Big Five Persönlichkeitstest</title>
      </Head>
      <Page>
        <div className='rdsim-eyebrow'>Persönlichkeitstest</div>
        <h1 className='rdsim-title'>Big Five<span className='dot'>.</span></h1>
        {participantName ? <p className='greeting'>Hallo, <strong>{participantName}</strong>!</p> : null}

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
              <button className='rdsim-btn rdsim-btn-primary' onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? 'Wird gesendet…' : 'Absenden'}
              </button>
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
