import { Component } from 'react'
import Head from 'next/head'
import Page from '../components/Page'
import Resume from '../components/Resume'
import AddResults from '../components/AddResults'
import LoadFile from '../components/LoadFile'
import generatePdfReport, { generatePdfReportDataUri } from '../components/pdf-report'
const { unpack } = require('jcb64')
const calculateScore = require('@alheimsins/bigfive-calculate-score')
const getResult = require('@alheimsins/b5-result-text')
const { getInfo } = require('@alheimsins/b5-result-text')
const FileSaver = require('file-saver')

export default class Result extends Component {
  constructor (props) {
    super(props)
    this.state = {
      b64: false,
      scores: false,
      resume: false,
      results: false,
      language: 'en',
      viewLanguage: 'en',
      chartWidth: 600,
      isGeneratingPdf: false,
      recipientEmail: '',
      isSendingReport: false,
      sendReportStatus: false
    }
    this.addResults = this.addResults.bind(this)
    this.getWidth = this.getWidth.bind(this)
    this.loadResults = this.loadResults.bind(this)
    this.handleSaveResults = this.handleSaveResults.bind(this)
    this.handleDownloadPdf = this.handleDownloadPdf.bind(this)
    this.handleSendReport = this.handleSendReport.bind(this)
    this.handleTranslateResume = this.handleTranslateResume.bind(this)
  }

  async componentDidMount () {
    const params = new URLSearchParams(window.location.search.replace('?', ''))
    const queryId = params.get('id')
    if (queryId) {
      const b64 = queryId
      const results = unpack(b64)
      const scores = calculateScore({ answers: results.answers })
      const info = getInfo()
      let language = this.state.language
      if (info.languages.map(lang => lang.id).includes(results.language)) {
        language = results.language
      }
      const resume = getResult({ scores: scores, lang: language })
      this.setState({
        b64: b64,
        scores: scores,
        resume: resume,
        language: results.language,
        viewLanguage: language,
        results: results,
        recipientEmail: results.email || ''
      })
    }
    document.addEventListener('DOMContentLoaded', this.getWidth(), false)
    window.addEventListener('resize', this.getWidth.bind(this))
  }

  getWidth () {
    const width = document.documentElement.clientWidth * 0.9
    this.setState({ chartWidth: width >= 500 ? width : 500 })
  }

  addResults (e) {
    e.preventDefault()
    let b64 = false
    const compressedDataField = document.getElementById('resultData')
    if (compressedDataField.value.startsWith('http')) {
      const url = new URL(compressedDataField.value)
      const params = new URLSearchParams(url.search.replace('?', ''))
      b64 = params.get('id')
    } else {
      b64 = compressedDataField.value
    }
    const results = unpack(b64)
    const scores = calculateScore({ answers: results.answers })
    const info = getInfo()
    let language = this.state.language
    if (info.languages.map(lang => lang.id).includes(results.language)) {
      language = results.language
    }
    const resume = getResult({ scores: scores, lang: language })
    this.setState({
      b64: b64,
      scores: scores,
      resume: resume,
      language: results.language,
      viewLanguage: language,
      results: results,
      recipientEmail: results.email || ''
    })
    compressedDataField.value = ''
  }

  loadResults (e) {
    e.preventDefault()
    const reader = new window.FileReader()
    const files = e.target.files
    reader.onload = () => {
      const text = reader.result
      const results = JSON.parse(text)
      const scores = calculateScore({ answers: results.answers })
      const info = getInfo()
      let language = this.state.language
      if (info.languages.map(lang => lang.id).includes(results.language)) {
        language = results.language
      }
      const resume = getResult({ scores: scores, lang: language })
      this.setState({
        scores: scores,
        resume: resume,
        language: results.language,
        viewLanguage: language,
        results: results,
        recipientEmail: results.email || ''
      })
    }
    if (files.length === 1) {
      reader.readAsText(files[0])
    }
  }

  handleSaveResults (e) {
    e.preventDefault()
    const results = this.state.results
    const file = new window.File([JSON.stringify(results, null, 2)], 'b5-results.json', { type: 'text/json;charset=utf-8' })
    FileSaver.saveAs(file)
  }

  async handleDownloadPdf (e) {
    e.preventDefault()
    if (this.state.resume === false || this.state.isGeneratingPdf) {
      return
    }
    this.setState({ isGeneratingPdf: true })
    const participantName = this.state.results && this.state.results.name
    await generatePdfReport({ resume: this.state.resume, viewLanguage: this.state.viewLanguage, participantName })
    this.setState({ isGeneratingPdf: false })
  }

  async handleSendReport (e) {
    e.preventDefault()
    if (this.state.resume === false || this.state.isSendingReport) {
      return
    }
    const email = this.state.recipientEmail.trim()
    if (!email) {
      this.setState({ sendReportStatus: { error: 'Bitte E-Mail-Adresse eingeben.' } })
      return
    }
    this.setState({ isSendingReport: true, sendReportStatus: false })
    try {
      const participantName = (this.state.results && this.state.results.name) || 'Teilnehmer:in'
      const { dataUri } = await generatePdfReportDataUri({
        resume: this.state.resume,
        viewLanguage: this.state.viewLanguage,
        participantName: this.state.results && this.state.results.name
      })
      const response = await window.fetch('/api/send-report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: participantName, email, pdfBase64: dataUri })
      })
      const data = await response.json()
      if (!response.ok) {
        this.setState({ sendReportStatus: { error: data.error || 'Versand fehlgeschlagen.' } })
      } else {
        this.setState({ sendReportStatus: { ok: true } })
      }
    } catch (error) {
      this.setState({ sendReportStatus: { error: 'Versand fehlgeschlagen: ' + error.message } })
    }
    this.setState({ isSendingReport: false })
  }

  handleTranslateResume (e) {
    e.preventDefault()
    const language = e.target.dataset.language
    const scores = this.state.scores
    const resume = getResult({ scores: scores, lang: language })
    this.setState({
      resume: resume,
      viewLanguage: language
    })
  }

  render () {
    return (
      <>
        <Head>
          <title>Ergebnis | Big Five Persönlichkeitstest</title>
        </Head>
        <Page>
          <div className='rdsim-eyebrow'>Persönlichkeitstest</div>
          <h1 className='rdsim-title'>Ergebnis<span className='dot'>.</span></h1>
          {this.state.results && this.state.results.name ? <p className='greeting'>für <strong>{this.state.results.name}</strong></p> : null}
          {getInfo().languages.map((lang, index) => <button data-language={lang.id} onClick={this.handleTranslateResume} className={`rdsim-btn rdsim-btn-secondary${lang.id === this.state.viewLanguage ? ' isActive' : ''}`} key={index}>{lang.text}</button>)}
          {this.state.resume === false ? <AddResults addResults={this.addResults} /> : null}
          {this.state.resume === false ? <LoadFile handler={this.loadResults} buttonTitle='Hochladen' /> : null}
          {this.state.resume !== false
            ? <Resume data={this.state.resume} width={this.state.chartWidth} />
            : null}
          {this.state.resume !== false ? <button className='rdsim-btn rdsim-btn-secondary' onClick={this.handleSaveResults}>Ergebnisse speichern</button> : null}
          {this.state.resume !== false
            ? <button className='rdsim-btn rdsim-btn-primary' onClick={this.handleDownloadPdf} disabled={this.state.isGeneratingPdf}>{this.state.isGeneratingPdf ? 'PDF wird erstellt…' : 'PDF herunterladen'}</button>
            : null}
          {this.state.resume !== false
            ? (
              <div className='send-report'>
                <input
                  className='rdsim-input'
                  type='email'
                  placeholder='E-Mail-Adresse des Empfängers'
                  value={this.state.recipientEmail}
                  onChange={event => this.setState({ recipientEmail: event.target.value })}
                />
                <button className='rdsim-btn rdsim-btn-secondary' onClick={this.handleSendReport} disabled={this.state.isSendingReport}>
                  {this.state.isSendingReport ? 'Sende…' : 'Bericht per E-Mail senden'}
                </button>
                {this.state.sendReportStatus && this.state.sendReportStatus.ok ? <p className='send-status ok'>Bericht wurde per E-Mail versendet.</p> : null}
                {this.state.sendReportStatus && this.state.sendReportStatus.error ? <p className='send-status error'>{this.state.sendReportStatus.error}</p> : null}
              </div>
              )
            : null}
          <style jsx>
            {`
              .greeting {
                text-align: center;
                color: var(--rdsim-text);
                margin-bottom: 10px;
              }
              .send-report {
                margin-top: 14px;
              }
              .send-status {
                margin-top: 8px;
              }
              .send-status.ok {
                color: var(--rdsim-text);
              }
              .send-status.error {
                color: var(--rdsim-red);
              }
            `}
          </style>
        </Page>
      </>
    )
  }
}
