const { version } = require('../package.json')

export default () => (
  <footer className='footer'>
    <div className='row'>
      <div>
        Big Five Test, Version {version} · Teil von{' '}
        <a href='https://rd-sim.de'>rd-sim.de</a> ·{' '}
        <a href={`mailto:info@rd-sim.de?subject=Feedback zum Big Five Test Version ${version}`}>
          Feedback geben
        </a>
      </div>
      <div>
        <a href='https://rd-sim.de/about/privacy'>Datenschutz</a> ·{' '}
        <a href='https://rd-sim.de/about/imprint'>Impressum</a>
      </div>
    </div>
    <style jsx>
      {`
        .footer {
          grid-area: footer;
          background: var(--rdsim-navy);
          border-top: 1px solid var(--rdsim-border);
          color: var(--rdsim-muted);
          font-size: 12px;
          width: 100%;
          padding: 16px 0;
          margin-top: 30px;
          text-align: center;
        }
        .row {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        a {
          color: var(--rdsim-muted);
        }
        a:hover {
          color: var(--rdsim-orange);
        }
      `}
    </style>
  </footer>
)
