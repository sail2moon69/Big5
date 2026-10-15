import { Component, createRef } from 'react'
import Head from 'next/head'
import Page from '../components/Page'
import Resume from '../components/Resume'
import AddResults from '../components/AddResults'
import LoadFile from '../components/LoadFile'
import generatePdfReport, { generatePdfReportDataUri } from '../components/pdf-report'
import { getLeadershipNote, getReflectionQuestions } from '../components/result-leadership-notes'
import { translateScoreText } from '../components/score-text'
const { unpack } = require('jcb64')
const calculateScore = require('@alheimsins/bigfive-calculate-score')
const getResult = require('@alheimsins/b5-result-text')
const { getInfo } = require('@alheimsins/b5-result-text')
const FileSaver = require('file-saver')

function decorateResume (resume, language) {
  return resume.map(domain => {
    // look up leadership notes/reflection questions by the library's raw (always-English) scoreText,
    // before it gets translated for display below
    const leadershipNote = getLeadershipNote(domain.domain, domain.scoreText, language)
    const reflectionQuestions = getReflectionQuestions(domain.domain, language)
    const facets = domain.facets
      ? domain.facets.map(facet => Object.assign({}, facet, { scoreText: translateScoreText(facet.scoreText, language) }))
      : domain.facets
    return Object.assign({}, domain, {
      scoreText: translateScoreText(domain.scoreText, language),
      leadershipNote,
      reflectionQuestions,
      facets
    })
  })
}

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
      sendReportStatus: false,
      sealedSendStatus: false,
      sealedPayload: false,
      sealedLink: false,
      sealedCopyStatus: false,
      loadError: false
    }
    this.sealedLinkRef = createRef()
    this.addResults = this.addResults.bind(this)
    this.getWidth = this.getWidth.bind(this)
    this.loadResults = this.loadResults.bind(this)
    this.handleSaveResults = this.handleSaveResults.bind(this)
    this.handleDownloadPdf = this.handleDownloadPdf.bind(this)
    this.handleSendReport = this.handleSendReport.bind(this)
    this.handleTranslateResume = this.handleTranslateResume.bind(this)
    this.handleRetrySealedSend = this.handleRetrySealedSend.bind(this)
    this.handleCopySealedLink = this.handleCopySealedLink.bind(this)
    this.handleBeforeUnload = this.handleBeforeUnload.bind(this)
  }

  handleBeforeUnload (event) {
    // while the sealed send is unresolved the result only exists in this URL - don't let it
    // disappear with a closed tab
    if (this.state.sealedSendStatus !== 'error' && this.state.sealedSendStatus !== 'sending') {
      return undefined
    }
    event.preventDefault()
    event.returnValue = ''
    return ''
  }

  async maybeSendSealedReport (results, resume, b64, language) {
    if (!results || !results.sealed || !results.trainerEmail) {
      return
    }
    // keep everything the send needs so the participant can retry without re-taking the test,
    // and keep the result link so it can be handed to the course lead if the send keeps failing
    this.setState({
      sealedPayload: { results, resume, b64, language },
      sealedLink: b64 ? `${window.location.origin}/result?id=${b64}` : false
    })
    await this.sendSealedReport({ results, resume, b64, language })
  }

  async sendSealedReport ({ results, resume, b64, language }) {
    const sentKey = 'big5-sealed-sent-' + (b64 || '')
    try {
      if (window.localStorage.getItem(sentKey)) {
        this.setState({ sealedSendStatus: 'sent' })
        return
      }
    } catch (error) {
      // storage unavailable (e.g. private browsing) - just send again, a duplicate mail beats a lost result
    }
    this.setState({ sealedSendStatus: 'sending', sealedCopyStatus: false })
    try {
      const participantName = results.name || 'Teilnehmer:in'
      const { dataUri } = await generatePdfReportDataUri({ resume, viewLanguage: language, participantName: results.name })
      const response = await window.fetch('/api/send-report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: participantName, email: results.trainerEmail, pdfBase64: dataUri, sealed: true })
      })
      if (response.ok) {
        try {
          window.localStorage.setItem(sentKey, '1')
        } catch (error) {
          // ignore - the send succeeded, only the "already sent" marker is missing
        }
        this.setState({ sealedSendStatus: 'sent' })
      } else {
        this.setState({ sealedSendStatus: 'error' })
      }
    } catch (error) {
      this.setState({ sealedSendStatus: 'error' })
    }
  }

  async handleRetrySealedSend (e) {
    e.preventDefault()
    const payload = this.state.sealedPayload
    if (!payload || this.state.sealedSendStatus === 'sending') {
      return
    }
    try {
      window.localStorage.removeItem('big5-sealed-sent-' + (payload.b64 || ''))
    } catch (error) {
      // ignore - nothing to clear if storage isn't available
    }
    await this.sendSealedReport(payload)
  }

  async handleCopySealedLink (e) {
    e.preventDefault()
    const link = this.state.sealedLink
    if (!link) {
      return
    }
    try {
      if (window.navigator.clipboard && window.navigator.clipboard.writeText) {
        await window.navigator.clipboard.writeText(link)
        this.setState({ sealedCopyStatus: 'copied' })
        return
      }
      const field = this.sealedLinkRef.current
      field.focus()
      field.select()
      const copied = window.document.execCommand('copy')
      this.setState({ sealedCopyStatus: copied ? 'copied' : 'failed' })
    } catch (error) {
      this.setState({ sealedCopyStatus: 'failed' })
    }
  }

  resultsToState (results) {
    const scores = calculateScore({ answers: results.answers })
    const info = getInfo()
    let language = this.state.language
    if (info.languages.map(lang => lang.id).includes(results.language)) {
      language = results.language
    }
    const resume = decorateResume(getResult({ scores: scores, lang: language }), language)
    return {
      scores: scores,
      resume: resume,
      language: results.language,
      viewLanguage: language,
      results: results,
      recipientEmail: results.email || '',
      loadError: false
    }
  }

  async componentDidMount () {
    const params = new URLSearchParams(window.location.search.replace('?', ''))
    const queryId = params.get('id')
    if (queryId) {
      try {
        const b64 = queryId
        const results = unpack(b64)
        const stateUpdate = this.resultsToState(results)
        this.setState(Object.assign({ b64: b64 }, stateUpdate))
        this.maybeSendSealedReport(results, stateUpdate.resume, b64, stateUpdate.viewLanguage)
      } catch (error) {
        this.setState({ loadError: 'Der Link scheint beschädigt oder unvollständig zu sein. Bitte prüfen Sie den Link oder wenden Sie sich an Ihre Lehrgangsleitung.' })
      }
    }
    document.addEventListener('DOMContentLoaded', this.getWidth(), false)
    window.addEventListener('resize', this.getWidth.bind(this))
    window.addEventListener('beforeunload', this.handleBeforeUnload)
  }

  componentWillUnmount () {
    window.removeEventListener('beforeunload', this.handleBeforeUnload)
  }

  getWidth () {
    // subtract the grid gutters + card padding around the chart so it fits its actual container, not the full viewport
    const width = document.documentElement.clientWidth - 80
    this.setState({ chartWidth: Math.max(width, 260) })
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
    try {
      const results = unpack(b64)
      const stateUpdate = this.resultsToState(results)
      this.setState(Object.assign({ b64: b64 }, stateUpdate))
      this.maybeSendSealedReport(results, stateUpdate.resume, b64, stateUpdate.viewLanguage)
      compressedDataField.value = ''
    } catch (error) {
      this.setState({ loadError: 'Die eingefügten Daten konnten nicht gelesen werden. Bitte prüfen Sie den Link bzw. die ID.' })
    }
  }

  loadResults (e) {
    e.preventDefault()
    const reader = new window.FileReader()
    const files = e.target.files
    reader.onload = () => {
      try {
        const text = reader.result
        const results = JSON.parse(text)
        const stateUpdate = this.resultsToState(results)
        this.setState(stateUpdate)
        this.maybeSendSealedReport(results, stateUpdate.resume, false, stateUpdate.viewLanguage)
      } catch (error) {
        this.setState({ loadError: 'Die Datei konnte nicht gelesen werden. Bitte prüfen Sie das Dateiformat.' })
      }
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
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        this.setState({ sendReportStatus: { error: data.error || 'Versand fehlgeschlagen. Bitte versuchen Sie es später erneut.' } })
      } else {
        this.setState({ sendReportStatus: { ok: true } })
      }
    } catch (error) {
      this.setState({ sendReportStatus: { error: 'Versand fehlgeschlagen. Bitte prüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.' } })
    }
    this.setState({ isSendingReport: false })
  }

  handleTranslateResume (e) {
    e.preventDefault()
    const language = e.target.dataset.language
    const scores = this.state.scores
    const resume = decorateResume(getResult({ scores: scores, lang: language }), language)
    this.setState({
      resume: resume,
      viewLanguage: language
    })
  }

  render () {
    if (this.state.results && this.state.results.sealed) {
      return (
        <>
          <Head>
            <title>Vielen Dank | Big Five Persönlichkeitstest</title>
          </Head>
          <Page>
            <div className='rdsim-eyebrow'>Persönlichkeitstest</div>
            <h1 className='rdsim-title'>Vielen Dank<span className='dot'>.</span></h1>
            <p className='sealed-message'>Sie erhalten Ihr Ergebnis in einem versiegelten Umschlag beim Lehrgang.</p>
            {this.state.sealedSendStatus === 'sending'
              ? <p className='send-status pending' role='status' aria-live='polite'>Ihr Ergebnis wird an die Lehrgangsleitung übermittelt…</p>
              : null}
            {this.state.sealedSendStatus === 'sent'
              ? <p className='send-status ok' role='status' aria-live='polite'>Ihr Ergebnis wurde an die Lehrgangsleitung übermittelt.</p>
              : null}
            {this.state.sealedSendStatus === 'error'
              ? (
                <div className='send-failed' role='status' aria-live='polite'>
                  <p className='send-status error'>Beim Versand ist ein technisches Problem aufgetreten.</p>
                  <p className='sealed-hint'><strong>Ihr Ergebnis ist nicht verloren.</strong> Schließen Sie diese Seite bitte noch nicht und versuchen Sie es erneut.</p>
                  <button className='rdsim-btn rdsim-btn-primary' onClick={this.handleRetrySealedSend}>Erneut versuchen</button>
                  {this.state.sealedLink
                    ? (
                      <div className='sealed-rescue'>
                        <p className='sealed-hint'>Klappt es weiterhin nicht, geben Sie diesen Link an Ihre Lehrgangsleitung weiter – darin ist Ihr Ergebnis gespeichert:</p>
                        <input
                          className='rdsim-input sealed-link'
                          type='text'
                          readOnly
                          value={this.state.sealedLink}
                          ref={this.sealedLinkRef}
                          onFocus={event => event.target.select()}
                          aria-label='Link zu Ihrem Ergebnis'
                        />
                        <button className='rdsim-btn rdsim-btn-secondary' onClick={this.handleCopySealedLink}>Link kopieren</button>
                        {this.state.sealedCopyStatus === 'copied' ? <span className='copy-status ok'>Link kopiert.</span> : null}
                        {this.state.sealedCopyStatus === 'failed' ? <span className='copy-status error'>Kopieren nicht möglich – bitte ins Feld klicken und mit Strg+A und Strg+C kopieren.</span> : null}
                        <p className='sealed-hint small'>Der Link enthält Ihre Antworten. Geben Sie ihn ausschließlich an Ihre Lehrgangsleitung weiter.</p>
                      </div>
                      )
                    : <p className='sealed-hint'>Klappt es weiterhin nicht, wenden Sie sich bitte an Ihre Lehrgangsleitung.</p>}
                </div>
                )
              : null}
            <style jsx>
              {`
                .sealed-message {
                  text-align: center;
                  color: var(--rdsim-text);
                  margin: 20px auto;
                  max-width: 480px;
                }
                .send-status {
                  text-align: center;
                  margin: 12px auto;
                  max-width: 480px;
                }
                .send-status.error {
                  color: var(--rdsim-red);
                }
                .send-status.pending,
                .send-status.ok {
                  color: var(--rdsim-text);
                }
                .send-failed {
                  text-align: center;
                  margin: 0 auto;
                  max-width: 520px;
                }
                .sealed-hint {
                  color: var(--rdsim-text);
                  margin: 12px auto;
                  max-width: 480px;
                }
                .sealed-hint.small {
                  font-size: 13px;
                  opacity: 0.8;
                }
                .sealed-rescue {
                  margin-top: 28px;
                }
                .sealed-link {
                  box-sizing: border-box;
                  width: 100%;
                  max-width: 480px;
                  margin: 0 auto 12px;
                  display: block;
                  font-size: 13px;
                }
                .copy-status {
                  display: block;
                  margin-top: 8px;
                  font-size: 13px;
                }
                .copy-status.ok {
                  color: var(--rdsim-text);
                }
                .copy-status.error {
                  color: var(--rdsim-red);
                }
              `}
            </style>
          </Page>
        </>
      )
    }
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
          {this.state.loadError ? <p className='load-error'>{this.state.loadError}</p> : null}
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
              .load-error {
                text-align: center;
                color: var(--rdsim-red);
                max-width: 480px;
                margin: 10px auto;
              }
            `}
          </style>
        </Page>
      </>
    )
  }
}
