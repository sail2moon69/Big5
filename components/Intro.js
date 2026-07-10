import { useState } from 'react'
import { useRouter } from 'next/router'
const { getInfo } = require('@alheimsins/b5-johnson-120-ipip-neo-pi-r')

const Intro = () => {
  const router = useRouter()
  const [language, setLanguage] = useState('en')
  const { languages } = getInfo()
  return (
    <div className='intro-wrapper rdsim-card'>
      <p>This is a test for the five factor model of personality based on work from <a href='https://github.com/kholia/IPIP-NEO-PI' target='blank'>IPIP-NEO-PI</a>.</p>
      <p>Tests and evaluation is gathered from <a href='http://ipip.ori.org/' target='_blank' rel='noopener noreferrer'>ipip.ori.org</a>.</p>
      <p>Inventories are from Johnson's (2014) 120-item IPIP NEO-PI-R</p>
      <ul>
        <li>Answer honestly, even if you don't like the answer.</li>
        <li>Describe yourself as you generally are now, not as you wish to be in the future.</li>
        <li>Your spontaneous answer is usually the most accurate.</li>
      </ul>
      <p><strong>Select test language</strong></p>
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
        <button className='rdsim-btn rdsim-btn-primary' onClick={() => router.push(`/test?language=${language}`)}>Start test</button>
      </div>
      <style jsx>
        {`
          ul {
            list-style-type: none;
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
