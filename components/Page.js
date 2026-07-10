import Layout from './Layout'
import Navbar from './Navbar'
import Main from './Main'
import Footer from './Footer'

export default ({ username, children }) => (
  <Layout>
    <Navbar />
    <Main>
      {children}
    </Main>
    <Footer />
  </Layout>
)
