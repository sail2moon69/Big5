export default ({ choice, item, answers, setAnswer }) => (
  <div>
    <button
      key={`${item.id}-${choice.score}`}
      data-qid={item.id}
      data-num={item.num}
      data-domain={item.domain}
      data-facet={item.facet}
      data-score={choice.score}
      onClick={setAnswer}
      className={`rdsim-btn rdsim-btn-secondary${Object.keys(answers).includes(item.id) && answers[item.id].score === choice.score.toString() ? ' isActive' : ''}`}
    >{choice.text}
    </button>
    <style jsx>
      {`
        @media screen and (max-width: 700px) {
          :global(.rdsim-btn) {
            width: 300px;
            margin-bottom: 5px;
          }
        }
      `}
    </style>
  </div>
)
