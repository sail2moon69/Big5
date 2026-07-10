import { useState } from 'react'
import Head from 'next/head'
import Page from '../components/Page'
const { getInfo } = require('@alheimsins/b5-johnson-120-ipip-neo-pi-r')
const { pack } = require('jcb64')

const Invite = () => {
  const { languages } = getInfo()
  const [name, setName] = useState('')
  const [language, setLanguage] = useState('de')
  const [invite, setInvite] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  const generateInvite = async event => {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName || isGenerating) {
      return
    }
    setIsGenerating(true)
    const code = pack({ name: trimmedName, language })
    const link = `${window.location.origin}/test?invite=${code}`
    const QRCode = (await import('qrcode')).default
    const qrDataUrl = await QRCode.toDataURL(link, {
      margin: 1,
      width: 320,
      color: { dark: '#0a0e1a', light: '#ffffff' }
    })
    setInvite({ name: trimmedName, link, qrDataUrl })
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

  return (
    <>
      <Head>
        <title>Einladung erstellen | Big Five Test</title>
      </Head>
      <Page>
        <div className='rdsim-eyebrow'>Für Übungsleitung</div>
        <h1 className='rdsim-title'>Einladung<span className='dot'>.</span></h1>
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
          `}
        </style>
      </Page>
    </>
  )
}

export default Invite
