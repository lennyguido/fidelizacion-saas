import { Header } from './Header'
import { Care, Contact, Footer, Hero, Journey, Plans, Products } from './Sections'

export function App() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Products />
        <Journey />
        <Plans />
        <Care />
        <Contact />
      </main>
      <Footer />
    </>
  )
}
