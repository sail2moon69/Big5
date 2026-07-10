import { useState } from 'react'
import { useRouter } from 'next/router'
const { getInfo } = require('@alheimsins/b5-johnson-120-ipip-neo-pi-r')

const Intro = () => {
  const router = useRouter()
  const [language, setLanguage] = useState('de')
  const { languages } = getInfo()
  return (
    <div className='intro-wrapper rdsim-card'>
      <h2 className='rdsim-subhead'>Über den Test</h2>
      <p>
        Der Big-Five-Persönlichkeitstest misst fünf zentrale Persönlichkeitsdimensionen: Neurotizismus, Extraversion,
        Offenheit für Erfahrungen, Verträglichkeit und Gewissenhaftigkeit. Er basiert auf dem wissenschaftlich
        etablierten Fünf-Faktoren-Modell und nutzt das 120 Fragen umfassende{' '}
        <a href='https://github.com/kholia/IPIP-NEO-PI' target='_blank' rel='noopener noreferrer'>IPIP-NEO-PI-R</a>
        {' '}-Inventar nach Johnson (2014). Auswertungstexte stammen von{' '}
        <a href='http://ipip.ori.org/' target='_blank' rel='noopener noreferrer'>ipip.ori.org</a>.
      </p>

      <h2 className='rdsim-subhead'>Warum das für Führungskräfte im Rettungsdienst wichtig ist</h2>
      <p>
        In Einsatzlagen mit hohem Zeit- und Handlungsdruck – etwa bei einem Massenanfall von Verletzten (MANV) –
        hängt der Erfolg der Einsatzleitung nicht nur von Fachwissen ab, sondern auch von der eigenen Persönlichkeit.
        Wer die eigenen Reaktionsmuster auf Stress kennt, kann Entscheidungen bewusster treffen, im Team klarer
        kommunizieren und auch unter Druck handlungsfähig bleiben.
      </p>
      <ul>
        <li><strong>Neurotizismus</strong> – Umgang mit Stress und Belastung in Extremsituationen</li>
        <li><strong>Extraversion</strong> – Kommunikation, Delegation und Auftreten gegenüber Einsatzkräften</li>
        <li><strong>Offenheit</strong> – Flexibilität bei unvorhergesehenen Lageentwicklungen</li>
        <li><strong>Verträglichkeit</strong> – Teamführung und Zusammenarbeit mit anderen Organisationen</li>
        <li><strong>Gewissenhaftigkeit</strong> – strukturiertes, systematisches Vorgehen unter Zeitdruck</li>
      </ul>
      <p>
        Selbstreflexion ist deshalb ein wichtiger Baustein der Führungsausbildung – die Grundlage, um eigene Stärken
        gezielt zu nutzen und mit persönlichen Schwächen im Einsatz souverän umzugehen.
      </p>

      <h2 className='rdsim-subhead'>Ablauf &amp; Regeln</h2>
      <p>Der Test besteht aus 120 Aussagen, die Sie auf einer 5-stufigen Skala bewerten. Für ein aussagekräftiges Ergebnis:</p>
      <ul>
        <li>Antworten Sie ehrlich – auch wenn Ihnen eine Antwort nicht gefällt.</li>
        <li>Beschreiben Sie sich so, wie Sie aktuell tatsächlich sind – nicht, wie Sie gerne wären.</li>
        <li>Die erste, spontane Reaktion ist meist die zutreffendste.</li>
        <li>Planen Sie ca. 15–20 Minuten ein und beantworten Sie den Test möglichst am Stück.</li>
      </ul>

      <div className='rdsim-note'>
        <p>
          <strong>Datenschutz:</strong> Der Test läuft vollständig in Ihrem Browser. Es gibt keine
          Serverspeicherung und keine Übermittlung an Dritte – niemand außer Ihnen sieht Ihre Antworten oder Ihr
          Ergebnis. Erst wenn Sie Ihr Ergebnis aktiv speichern, als PDF herunterladen oder den Ergebnis-Link mit
          jemandem teilen, verlassen die Daten Ihr Gerät.
        </p>
      </div>

      <h2 className='rdsim-subhead'>Testsprache wählen</h2>
      <select
        className='rdsim-select'
        value={language}
        onChange={event => setLanguage(event.target.value)}
      >
        <option value='' key='first-option'>Choose language</option>
        {languages.map(lang => (
          <option value={lang.id} key={lang.id}>{lang.text}</option>
        ))}
      </select>
      <div>
        <button className='rdsim-btn rdsim-btn-primary' onClick={() => router.push(`/test?language=${language}`)}>Test starten</button>
      </div>
      <style jsx>
        {`
          ul {
            list-style-type: none;
            padding-left: 0;
          }
          li {
            margin-bottom: 6px;
          }
          .intro-wrapper {
            display: flex;
            flex-direction: column;
          }
        `}
      </style>
    </div>
  )
}

export default Intro
