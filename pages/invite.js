import { useState } from 'react'
import Head from 'next/head'
import Page from '../components/Page'
import generateInvitePdf from '../components/invite-pdf'
const { getInfo } = require('@alheimsins/b5-johnson-120-ipip-neo-pi-r')
const { pack } = require('jcb64')

async function buildInvite (name, email, language) {
  const code = pack({ name, language })
  const link = `${window.location.origin}/test?invite=${code}`
  const QRCode = (await import('qrcode')).default
  const qrDataUrl = await QRCode.toDataURL(link, {
    margin: 1,
    width: 320,
    color: { dark: '#0a0e1a', light: '#ffffff' }
  })
  return { name, email, link, qrDataUrl }
}

function parseBulkLine (line) {
  const [namePart, emailPart] = line.split(';')
  const name = (namePart || '').trim()
  const email = (emailPart || '').trim()
  return { name, email: email || false }
}

const Invite = () => {
  const { languages } = getInfo()
  const [mode, setMode] = useState('single')

  // single-invite mode
  const [name, setName] = useState('')
  const [language, setLanguage] = useState('de')
  const [invite, setInvite] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  // group mode
  const [bulkText, setBulkText] = useState('')
  const [groupLanguage, setGroupLanguage] = useState('de')
  const [ccEmail, setCcEmail] = useState('')
  const [groupInvites, setGroupInvites] = useState(false)
  const [isGeneratingGroup, setIsGeneratingGroup] = useState(false)
  const [isSendingEmails, setIsSendingEmails] = useState(false)
  const [sendSummary, setSendSummary] = useState(false)

  const generateInvite = async event => {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName || isGenerating) {
      return
    }
    setIsGenerating(true)
    const result = await buildInvite(trimmedName, false, language)
    setInvite(result)
    setIsGenerating(false)
  }

  const resetInvite = event => {
    event.preventDefault()
    setInvite(false)
    setName('')
    setCopied(false)
  }

  const copyLink = event => {
    event.preventDefault()
    window.navigator.clipboard.writeText(invite.link)
    setCopied(true)
  }

  const generateGroupInvites = async event => {
    event.preventDefault()
    if (isGeneratingGroup) {
      return
    }
    const entries = bulkText
      .split('\n')
      .map(parseBulkLine)
      .filter(entry => entry.name)
      .slice(0, 200)
    if (entries.length === 0) {
      return
    }
    setIsGeneratingGroup(true)
    setSendSummary(false)
    const results = []
    for (const entry of entries) {
      results.push(await buildInvite(entry.name, entry.email, groupLanguage))
    }
    setGroupInvites(results)
    setIsGeneratingGroup(false)
  }

  const resetGroup = event => {
    event.preventDefault()
    setGroupInvites(false)
    setBulkText('')
    setSendSummary(false)
  }

  const downloadGroupPdf = async event => {
    event.preventDefault()
    await generateInvitePdf(groupInvites)
  }

  const sendGroupEmails = async event => {
    event.preventDefault()
    if (isSendingEmails) {
      return
    }
    const recipients = groupInvites
      .filter(item => item.email)
      .map(item => ({ name: item.name, email: item.email, link: item.link }))
    if (recipients.length === 0) {
      setSendSummary({ error: 'Keine E-Mail-Adressen in der Liste gefunden.' })
      return
    }
    setIsSendingEmails(true)
    setSendSummary(false)
    try {
      const response = await window.fetch('/api/send-invites', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ recipients, ccEmail: ccEmail.trim() || undefined })
      })
      const data = await response.json()
      if (!response.ok) {
        setSendSummary({ error: data.error || 'Versand fehlgeschlagen.' })
      } else {
        setSendSummary({ results: data.results })
      }
    } catch (error) {
      setSendSummary({ error: 'Versand fehlgeschlagen: ' + error.message })
    }
    setIsSendingEmails(false)
  }

  return (
    <>
      <Head>
        <title>Einladung erstellen | Big Five Test</title>
      </Head>
      <Page>
        <div className='rdsim-eyebrow'>Für Übungsleitung</div>
        <h1 className='rdsim-title'>Einladung<span className='dot'>.</span></h1>

        <div>
          <button className={`rdsim-btn rdsim-btn-secondary${mode === 'single' ? ' isActive' : ''}`} onClick={() => setMode('single')}>Einzel</button>
          <button className={`rdsim-btn rdsim-btn-secondary${mode === 'group' ? ' isActive' : ''}`} onClick={() => setMode('group')}>Gruppe</button>
        </div>

        {mode === 'single'
          ? (
            <div className='rdsim-card'>
              <p>
                Erstellen Sie einen persönlichen Test-Link für eine teilnehmende Person. Der Name wird ausschließlich im
                Link bzw. QR-Code selbst codiert – es gibt keine Speicherung auf einem Server.
              </p>

              {!invite
                ? (
                  <form onSubmit={generateInvite}>
                    <input
                      className='rdsim-input'
                      type='text'
                      placeholder='Name der teilnehmenden Person'
                      value={name}
                      onChange={event => setName(event.target.value)}
                      required
                    />
                    <select className='rdsim-select' value={language} onChange={event => setLanguage(event.target.value)}>
                      {languages.map(lang => (
                        <option value={lang.id} key={lang.id}>{lang.text}</option>
                      ))}
                    </select>
                    <div>
                      <button className='rdsim-btn rdsim-btn-primary' type='submit' disabled={isGenerating}>
                        {isGenerating ? 'Erstelle…' : 'Einladung erstellen'}
                      </button>
                    </div>
                  </form>
                  )
                : (
                  <div>
                    <p><strong>Link für {invite.name}:</strong></p>
                    <input
                      className='rdsim-input link-field'
                      type='text'
                      readOnly
                      value={invite.link}
                      onFocus={event => event.target.select()}
                    />
                    <div>
                      <button className='rdsim-btn rdsim-btn-secondary' onClick={copyLink}>
                        {copied ? 'Kopiert!' : 'Link kopieren'}
                      </button>
                    </div>
                    <img className='qr-image' src={invite.qrDataUrl} alt={`QR-Code für ${invite.name}`} />
                    <div>
                      <button className='rdsim-btn rdsim-btn-secondary' onClick={resetInvite}>Neue Einladung erstellen</button>
                    </div>
                  </div>
                  )}
            </div>
            )
          : (
            <div className='rdsim-card'>
              <p>
                Fügen Sie eine Person pro Zeile ein, im Format <code>Name;E-Mail</code> (die E-Mail-Adresse ist optional
                – ohne sie erhalten Sie nur Link und QR-Code, aber können diese Person nicht per E-Mail einladen).
                Auch hier gilt: nichts wird auf einem Server gespeichert, außer für den Moment des E-Mail-Versands.
              </p>

              {!groupInvites
                ? (
                  <form onSubmit={generateGroupInvites}>
                    <textarea
                      className='rdsim-input bulk-field'
                      placeholder={'Anna Schmidt;anna@example.com\nMax Mustermann;max@example.com\nJulia Beispiel'}
                      value={bulkText}
                      onChange={event => setBulkText(event.target.value)}
                      rows={8}
                      required
                    />
                    <select className='rdsim-select' value={groupLanguage} onChange={event => setGroupLanguage(event.target.value)}>
                      {languages.map(lang => (
                        <option value={lang.id} key={lang.id}>{lang.text}</option>
                      ))}
                    </select>
                    <input
                      className='rdsim-input'
                      type='email'
                      placeholder='Ihre E-Mail (für Kopie/CC, optional)'
                      value={ccEmail}
                      onChange={event => setCcEmail(event.target.value)}
                    />
                    <div>
                      <button className='rdsim-btn rdsim-btn-primary' type='submit' disabled={isGeneratingGroup}>
                        {isGeneratingGroup ? 'Erstelle…' : 'Einladungen erstellen'}
                      </button>
                    </div>
                  </form>
                  )
                : (
                  <div>
                    <table className='invite-table'>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>E-Mail</th>
                          <th>Link</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupInvites.map((item, index) => {
                          const result = sendSummary && sendSummary.results
                            ? sendSummary.results.find(entry => entry.email === item.email && entry.name === item.name)
                            : false
                          return (
                            <tr key={index}>
                              <td>{item.name}</td>
                              <td>{item.email || '–'}</td>
                              <td className='link-cell'>{item.link}</td>
                              <td>{result ? result.status : ''}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>

                    {sendSummary && sendSummary.error ? <p className='error-text'>{sendSummary.error}</p> : null}

                    <div>
                      <button className='rdsim-btn rdsim-btn-primary' onClick={downloadGroupPdf}>Als PDF herunterladen</button>
                      <button className='rdsim-btn rdsim-btn-primary' onClick={sendGroupEmails} disabled={isSendingEmails}>
                        {isSendingEmails ? 'Versende…' : 'Einladungen per E-Mail versenden'}
                      </button>
                      <button className='rdsim-btn rdsim-btn-secondary' onClick={resetGroup}>Neue Gruppe erstellen</button>
                    </div>
                  </div>
                  )}
            </div>
            )}

        <style jsx>
          {`
            select {
              margin-top: 10px;
            }
            .link-field {
              width: 100%;
              margin-top: 8px;
            }
            .qr-image {
              display: block;
              margin: 20px auto;
              width: 240px;
              height: 240px;
              background: #fff;
              padding: 12px;
            }
            .bulk-field {
              width: 100%;
              font-family: monospace;
              resize: vertical;
            }
            .invite-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
              font-size: 13px;
            }
            .invite-table th, .invite-table td {
              text-align: left;
              padding: 6px 8px;
              border-bottom: 1px solid var(--rdsim-border);
            }
            .link-cell {
              max-width: 260px;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
              color: var(--rdsim-muted);
            }
            .error-text {
              color: var(--rdsim-red);
            }
          `}
        </style>
      </Page>
    </>
  )
}

export default Invite
