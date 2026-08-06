import { BarChart } from 'react-easy-chart'

const margin = { top: 20, right: 40, bottom: 40, left: 40 }

// react-easy-chart doesn't wrap or rotate axis labels, so long category names (German domain/facet
// names run long) overlap on narrow mobile charts - truncate to roughly what each bar's column can fit
function prepareData (data, chartWidth) {
  const plotWidth = Math.max(chartWidth - margin.left - margin.right, 40)
  const perBar = plotWidth / data.length
  const maxChars = Math.max(Math.floor(perBar / 5.2), 4)
  return data.map(item => {
    const title = item.title
    const label = title.length > maxChars ? title.slice(0, Math.max(maxChars - 1, 3)) + '…' : title
    return Object.assign({ x: label, y: item.score })
  })
}

export default ({ title, data, yDomainRange, chartWidth }) => (
  <div className='summary-wrapper rdsim-card-light'>
    {title ? <h1>{title}</h1> : null}
    {data
      ? (
        <div className='chart-scroll'>
          <BarChart data={prepareData(data, chartWidth)} colorBars axes grid height={400} width={chartWidth} yDomainRange={yDomainRange} margin={margin} />
        </div>
        )
      : null}
    <style jsx>
      {`
        span {
          margin-right: 10px;
        }
        .summary-wrapper {
          text-align: center;
        }
        .chart-scroll {
          overflow-x: auto;
        }
        @media screen and (max-width: 1000px) {
          .summary-wrapper {
            flex-direction: column;
          }
        }
      `}
    </style>
  </div>
)
