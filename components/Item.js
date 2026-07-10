import Choices from './Choices'

export default ({ data, answers, setAnswer }) => (
  <div className='item-wrapper rdsim-card'>
    <div className='text'>{data.num}. {data.text}</div>
    {data ? <Choices data={data} answers={answers} setAnswer={setAnswer} /> : null}
    <style jsx>
      {`
        .text {
          margin-bottom: 10px;
          font-size: large;
          color: var(--rdsim-text);
        }
      `}
    </style>
  </div>
)
