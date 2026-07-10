import Facet from './Facet'
import Summary from './Summary'

export default ({ data, chartWidth }) => (
  <div className='domain-wrapper rdsim-card-light'>
    <h1>{data.title}</h1>
    <p><em>{data.shortDescription}</em></p>
    <p>Score: {data.score}/120 - {data.scoreText}</p>
    <p><strong>{data.text}</strong></p>
    {data.description.split(/<br\s*\/?>/gi).map(paragraph => paragraph.trim()).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
    {data && data.facets
      ? <Summary data={data.facets} yDomainRange={[0, 20]} chartWidth={chartWidth} />
      : null}
    {data && data.facets
      ? data.facets.map((facet, index) => <Facet data={facet} key={index} />)
      : null}
  </div>
)
