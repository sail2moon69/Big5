import Facet from './Facet'
import Summary from './Summary'

export default ({ data, chartWidth }) => (
  <div className='domain-wrapper rdsim-card-light'>
    <h1>{data.title}</h1>
    <p><em>{data.shortDescription}</em></p>
    <p>Score: {data.score}/120 - {data.scoreText}</p>
    <p><strong>{data.text}</strong></p>
    {data.description.split(/<br\s*\/?>/gi).map(paragraph => paragraph.trim()).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
    {data.leadershipNote
      ? (
        <div className='leadership-note'>
          <span className='label'>Für Führung im Rettungsdienst</span>
          <p>{data.leadershipNote}</p>
        </div>
        )
      : null}
    {data && data.facets
      ? <Summary data={data.facets} yDomainRange={[0, 20]} chartWidth={chartWidth} />
      : null}
    {data && data.facets
      ? data.facets.map((facet, index) => <Facet data={facet} key={index} />)
      : null}
    <style jsx>
      {`
        .leadership-note {
          background: rgba(244, 160, 28, 0.08);
          border: 1px solid rgba(244, 160, 28, 0.35);
          border-left: 4px solid var(--rdsim-orange);
          padding: 1rem 1.25rem;
          margin: 1.2rem 0;
          text-align: left;
        }
        .leadership-note .label {
          display: block;
          font-size: 0.75rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--rdsim-orange);
          margin-bottom: 0.4rem;
        }
        .leadership-note p {
          margin: 0;
          color: #444;
        }
      `}
    </style>
  </div>
)
