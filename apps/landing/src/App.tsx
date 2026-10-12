import { useEffect } from 'react'
import { Calculator } from './components/Calculator'
import { Hero } from './components/Hero'
import { PanelTour } from './components/PanelTour'
import { Plans } from './components/Plans'
import { Faq, FinalCta, Footer, HowToStart, Marquee, Problems } from './components/Sections'

/** Aparición suave de las secciones al scrollear. */
function useReveal() {
  useEffect(() => {
    const items = document.querySelectorAll('.reveal:not(.is-visible)')
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
          }
        }
      },
      { rootMargin: '0px 0px -10% 0px' },
    )
    items.forEach((item) => observer.observe(item))
    return () => observer.disconnect()
  }, [])
}

function Nav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4">
      <nav className="mx-auto flex max-w-6xl items-center justify-between rounded-full bg-crema/80 px-5 py-3 ring-1 ring-noche/10 backdrop-blur-xl">
        <a href="#" className="font-display text-2xl font-extrabold tracking-tight">
          neriva<span className="text-terracota">.</span>
        </a>
        <div className="flex items-center gap-1 text-sm font-semibold">
          <a href="#panel" className="hidden rounded-full px-4 py-2 hover:bg-noche/5 sm:block">
            Cómo funciona
          </a>
          <a href="#planes" className="hidden rounded-full px-4 py-2 hover:bg-noche/5 sm:block">
            Planes
          </a>
          <a href="https://panel.neriva.net" className="rounded-full px-4 py-2 hover:bg-noche/5">
            Entrar
          </a>
          <a
            href="#planes"
            className="rounded-full bg-noche px-4 py-2 text-crema hover:bg-terracota"
          >
            Empezar
          </a>
        </div>
      </nav>
    </header>
  )
}

export function App() {
  useReveal()
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Marquee />
        <Problems />
        <PanelTour />
        <Calculator />
        <Plans />
        <HowToStart />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </>
  )
}
