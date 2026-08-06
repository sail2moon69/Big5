export default ({ addComparison }) => (
  <form onSubmit={addComparison} className='no-print'>
    <input className='rdsim-input' type='text' id='comparisonName' placeholder='Name für den Vergleich' required />
    <input className='rdsim-input' type='text' id='comparisonData' placeholder='URL oder ID für den Vergleich' required />
    <br />
    <button className='rdsim-btn rdsim-btn-primary' type='submit'>Hinzufügen</button>
    <style jsx>
      {`
        input {
          width: 80%;
          height: 40px;
          margin: 10px;
        }
        @media screen and (max-width: 700px) {
          :global(.rdsim-btn) {
            width: 300px;
            margin-bottom: 5px;
          }
        }
        @media print {
          :global(.no-print), :global(.no-print) * {
            display: none !important;
          }
        }
      `}
    </style>
  </form>
)
