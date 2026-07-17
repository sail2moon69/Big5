import { useState, useEffect } from 'react'
import Head from 'next/head'
import Page from '../components/Page'
import Item from '../components/Item'
const { getItems } = require('@alheimsins/b5-johnson-120-ipip-neo-pi-r')
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
  const [nowShowing, setNowShowing] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState('de')
  const [participantName, setParticipantName] = useState(false)
  const [participantEmail, setParticipantEmail] = useState(false)
  const [participantSealed, setParticipantSealed] = useState(false)
  const [trainerEmail, setTrainerEmail] = useState(false)
  const [storageKey, setStorageKey] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search.replace('?', ''))
    const inviteCode = params.get('invite')
    let language = params.get('language') || 'de'
    if (inviteCode) {
      try {
        const invite = unpack(inviteCode)
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
    const key = getStorageKey(inviteCode)
    setStorageKey(key)
    const items = getItems(language, true)
    setSelectedLanguage(language)
    items.reverse()
    setItems(items)

    const saved = loadSavedProgress(key)
    if (saved && saved.answers && typeof saved.nowShowing === 'number') {
      setAnswers(saved.answers)
      setNowShowing(saved.nowShowing)
    } else {
      setNowShowing(0)
    }
  }, [])

  useEffect(() => {
    if (!storageKey || nowShowing === false) {
      return
    }
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ answers, nowShowing }))
    } catch (error) {
      // localStorage unavailable (e.g. private browsing quota) - progress just won't survive a reload
    }
  }, [answers, nowShowing, storageKey])

  const setAnswer = event => {
    event.preventDefault()
    const nextShowing = parseInt(event.target.dataset.num, 10)
    if (nextShowing > nowShowing) {
      setNowShowing(nextShowing)
    }

    setAnswers(previousAnswers => ({
      ...previousAnswers,
      [event.target.dataset.qid]: {
        id: event.target.dataset.qid,
        domain: event.target.dataset.domain,
        facet: event.target.dataset.facet,
        score: event.target.dataset.score
      }
    }))
  }

  const handleSubmit = event => {
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
    if (storageKey) {
      try {
        window.localStorage.removeItem(storageKey)
      } catch (error) {
        // ignore - nothing to clean up if storage isn't available
      }
    }
    const b64 = pack(result)
    window.location = `/result?id=${b64}`
  }

  return (
    <>
      <Head>
        <title>Big Five Persönlichkeitstest</title>
      </Head>
      <Page>
        <div className='rdsim-eyebrow'>Persönlichkeitstest</div>
        <h1 className='rdsim-title'>Big Five<span className='dot'>.</span></h1>
        {participantName ? <p className='greeting'>Hallo, <strong>{participantName}</strong>!</p> : null}
        {items !== false && nowShowing === items.length
          ? <button className='rdsim-btn rdsim-btn-primary' onClick={handleSubmit}>Absenden</button>
          : null}
        {items !== false
          ? items.map(item => parseInt(item.num, 10) <= nowShowing + 1 ? <Item data={item} answers={answers} setAnswer={setAnswer} key={item.id} /> : null)
          : null}
        <style jsx>
          {`
            .greeting {
              text-align: center;
              color: var(--rdsim-text);
              margin-bottom: 10px;
            }
          `}
        </style>
      </Page>
    </>
  )
}

export default Test
