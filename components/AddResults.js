export default ({ addResults }) => (
  <form onSubmit={addResults}>
    <input className='rdsim-input' type='text' id='resultData' placeholder='URL or id for result' required />
    <br />
    <button className='rdsim-btn rdsim-btn-primary' type='submit'>Add</button>
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
      `}
    </style>
  </form>
)
