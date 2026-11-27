import { Component } from 'react'
import Head from 'next/head'
import Page from '../components/Page'
import AddComparison from '../components/AddComparison'
import Comparisons from '../components/Comparisons'
import LoadFile from '../components/LoadFile'
import repackResults from '../components/repack-results'
const { unpack } = require('jcb64')
const { getInfo } = require('@alheimsins/b5-result-text')
const FileSaver = require('file-saver')
const { languages } = getInfo()

const ITEM_COUNT = 120

// null if data is a complete result, otherwise a message for the user
function describeResultProblem (data) {
  if (!data || !Array.isArray(data.answers)) {
    return 'Das ist kein gültiges Testergebnis. Erwartet wird ein Ergebnis-Link, eine Ergebnis-ID oder eine mit „Ergebnisse speichern“ erzeugte Datei.'
  }
  if (data.answers.length < ITEM_COUNT) {
    return `Dieses Ergebnis ist unvollständig (${data.answers.length} von ${ITEM_COUNT} Antworten) und würde den Vergleich verfälschen.`
  }
  return null
}

export default class Compare extends Component {
  constructor (props) {
    super(props)
    this.state = {
      comparisons: [],
      scores: false,
      language: 'de',
      viewLanguage: 'de',
      loadError: false
    }
    this.addComparison = this.addComparison.bind(this)
    this.getWidth = this.getWidth.bind(this)
    this.handleTranslate = this.handleTranslate.bind(this)
    this.loadComparison = this.loadComparison.bind(this)
    this.loadResult = this.loadResult.bind(this)
    this.handleSaveComparison = this.handleSaveComparison.bind(this)
    this.updateScores = this.updateScores.bind(this)
  }

  async componentDidMount () {
    document.addEventListener('DOMContentLoaded', this.getWidth(), false)
    window.addEventListener('resize', this.getWidth.bind(this))
  }

  addComparison (e) {
    e.preventDefault()
    const nameField = document.getElementById('comparisonName')
    const compressedDataField = document.getElementById('comparisonData')
    let data
    try {
      const value = compressedDataField.value.trim()
      const id = value.startsWith('http') ? new URL(value).searchParams.get('id') : value
      data = unpack(id)
    } catch (error) {
      this.setState({ loadError: 'Der Link bzw. die ID konnte nicht gelesen werden. Bitte prüfen Sie, ob sie vollständig kopiert wurde.' })
      return
    }
    if (this.updateScores({ name: nameField.value, data: data })) {
      nameField.value = ''
      compressedDataField.value = ''
    }
  }

  // Adds one result. Returns false (and shows why) if it isn't a complete, readable result.
  updateScores (entry) {
    const problem = describeResultProblem(entry.data)
    if (problem) {
      this.setState({ loadError: problem })
      return false
    }
    const comparisons = this.state.comparisons.concat([entry])
    let scores
    try {
      scores = repackResults(comparisons, this.state.viewLanguage)
    } catch (error) {
      this.setState({ loadError: 'Das Ergebnis konnte nicht ausgewertet werden. Bitte prüfen Sie die Daten.' })
      return false
    }
    this.setState({
      comparisons: comparisons,
      scores: scores,
      loadError: false
    })
    return true
  }

  loadResult (e) {
    e.preventDefault()
    const reader = new window.FileReader()
    const files = e.target.files
    const fileField = e.target
    const nameField = document.getElementById('comparisonName')
    reader.onload = () => {
      let data
      try {
        data = JSON.parse(reader.result)
      } catch (error) {
        this.setState({ loadError: 'Die Datei konnte nicht gelesen werden. Erwartet wird eine mit „Ergebnisse speichern“ erzeugte JSON-Datei.' })
        fileField.value = ''
        return
      }
      if (this.updateScores({ name: nameField.value, data: data })) {
        nameField.value = ''
      }
      fileField.value = ''
    }
    if (files.length === 1) {
      reader.readAsText(files[0])
    }
  }

  handleSaveComparison (e) {
    e.preventDefault()
    const comparisons = this.state.comparisons
    const file = new window.File([JSON.stringify(comparisons, null, 2)], 'b5-comparison.json', { type: 'text/json;charset=utf-8' })
    FileSaver.saveAs(file)
  }

  loadComparison (e) {
    e.preventDefault()
    const reader = new window.FileReader()
    const files = e.target.files
    const fileField = e.target
    reader.onload = () => {
      const fail = () => {
        this.setState({ loadError: 'Die Datei konnte nicht als Vergleich gelesen werden. Erwartet wird eine mit „Vergleich speichern“ erzeugte JSON-Datei.' })
        fileField.value = ''
      }
      let json
      try {
        json = JSON.parse(reader.result)
      } catch (error) {
        return fail()
      }
      if (!Array.isArray(json) || json.length === 0 || json.some(entry => !entry || describeResultProblem(entry.data))) {
        return fail()
      }
      let scores
      try {
        scores = repackResults(json, this.state.viewLanguage)
      } catch (error) {
        return fail()
      }
      this.setState({
        comparisons: json,
        scores: scores,
        loadError: false
      })
      fileField.value = ''
    }
    if (files.length === 1) {
      reader.readAsText(files[0])
    }
  }

  handleTranslate (e) {
    e.preventDefault()
    const language = e.target.dataset.language
    const comparisons = this.state.comparisons
    const scores = repackResults(comparisons, language)
    this.setState({
      scores: scores,
      viewLanguage: language
    })
  }

  getWidth () {
    // subtract the grid gutters + card padding around the chart so it fits its actual container, not the full viewport
    const width = document.documentElement.clientWidth - 80
    this.setState({ chartWidth: Math.max(width, 260) })
  }

  render () {
    return (
      <>
        <Head>
          <title>Vergleich | Big Five Persönlichkeitstest</title>
        </Head>
        <Page>
          <div className='rdsim-eyebrow no-print'>Persönlichkeitstest</div>
          <h1 className='rdsim-title no-print'>Vergleich<span className='dot'>.</span></h1>
          {languages.map((lang, index) => <button data-language={lang.id} onClick={this.handleTranslate} className={`rdsim-btn rdsim-btn-secondary no-print${lang.id === this.state.viewLanguage ? ' isActive' : ''}`} key={index}>{lang.text}</button>)}
          <AddComparison addComparison={this.addComparison} />
          <LoadFile handler={this.loadResult} buttonTitle='Ergebnis laden' />
          {this.state.loadError ? <p className='load-error no-print' role='alert'>{this.state.loadError}</p> : null}
          {this.state.scores ? <Comparisons data={this.state.scores} chartWidth={this.state.chartWidth} /> : null}
          {this.state.comparisons.length > 0 ? <button className='rdsim-btn rdsim-btn-primary' onClick={this.handleSaveComparison}>Vergleich speichern</button> : null}
          {this.state.comparisons.length === 0 ? <LoadFile handler={this.loadComparison} buttonTitle='Vergleich laden' /> : null}
          <style jsx>
            {`
              .load-error {
                color: var(--rdsim-red);
                max-width: 560px;
                margin: 12px auto;
              }
              @media print {
                .no-print, .no-print * {
                  display: none !important;
                }
              }
            `}
          </style>
        </Page>
      </>
    )
  }
}
