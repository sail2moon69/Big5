import Head from 'next/head'
import Page from '../components/Page'
import Hero from '../components/Hero'
import Intro from '../components/Intro'

const Index = props => {
  return (
    <>
      <Head>
        <title>Big Five Test | rd-sim.de</title>
      </Head>
      <Page>
        <Hero eyebrow='Persönlichkeitstest' title='Big Five' slogan='Kenne dich selbst. Führe mit Klarheit.' />
        <Intro />
      </Page>
    </>
  )
}

export default Index
