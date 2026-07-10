import Head from 'next/head'
import Page from '../components/Page'
import Intro from '../components/Intro'

const Index = props => {
  return (
    <>
      <Head>
        <title>Big five webapp</title>
      </Head>
      <Page>
        <div className='rdsim-eyebrow'>Persönlichkeitstest</div>
        <h1 className='rdsim-title'>Big Five<span className='dot'>.</span></h1>
        <Intro />
      </Page>
    </>
  )
}

export default Index
