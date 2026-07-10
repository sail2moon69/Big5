import { useState, useEffect } from 'react'
import Head from 'next/head'
import Page from '../components/Page'
import Item from '../components/Item'
const { getItems } = require('@alheimsins/b5-johnson-120-ipip-neo-pi-r')
const { pack } = require('jcb64')

const Test = props => {
  const [answers, setAnswers] = useState({})
  const [items, setItems] = useState(false)
  const [nowShowing, setNowShowing] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState('en')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search.replace('?', ''))
    const language = params.get('language') || 'en'
    const items = getItems(language, true)
    setSelectedLanguage(language)
    items.reverse()
    setItems(items)
    setNowShowing(0)
  }, [])

  const setAnswer = event => {
    event.preventDefault()
    const thisAnswers = answers
    const nextShowing = parseInt(event.target.dataset.num, 10)
    if (nextShowing > nowShowing) {
      setNowShowing(nextShowing)
    }

    thisAnswers[event.target.dataset.qid] = {
      id: event.target.dataset.qid,
      domain: event.target.dataset.domain,
      facet: event.target.dataset.facet,
      score: event.target.dataset.score
    }
    setAnswers(thisAnswers)
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
    const b64 = pack(result)
    window.location = `/result?id=${b64}`
  }

  return (
    <>
      <Head>
        <title>Big five webapp</title>
      </Head>
      <Page>
        <div className='rdsim-eyebrow'>Persönlichkeitstest</div>
        <h1 className='rdsim-title'>Big Five<span className='dot'>.</span></h1>
        {items !== false && nowShowing === items.length
          ? <button className='rdsim-btn rdsim-btn-primary' onClick={handleSubmit}>Submit</button>
          : null}
        {items !== false
          ? items.map(item => parseInt(item.num, 10) <= nowShowing + 1 ? <Item data={item} answers={answers} setAnswer={setAnswer} key={item.id} /> : null)
          : null}
      </Page>
    </>
  )
}

export default Test
