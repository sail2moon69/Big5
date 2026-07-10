function triggerUpload (e) {
  e.preventDefault()
  const fileField = e.target.previousSibling
  fileField.click()
}

export default ({ handler, buttonTitle }) => (
  <>
    <input type='file' accept='.json' onChange={handler} />
    <button className='rdsim-btn rdsim-btn-secondary' onClick={triggerUpload}>{buttonTitle}</button>
    <style jsx>
      {`
        input {
          display: none;
          visibility: hidden;
        }
      `}
    </style>
  </>
)
