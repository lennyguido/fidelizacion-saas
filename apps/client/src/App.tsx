import { useEffect, useState } from 'react'
import { card, selfSignup } from '@plataforma/sdk'
import { CardPage } from '@/card/CardPage'
import { NoCard } from '@/card/NoCard'
import { isInstalledApp } from '@/install/useInstallPrompt'
import { forgetToken, readSavedToken, saveToken } from '@/savedToken'
import { SignupPage } from '@/signup/SignupPage'

function initialToken(): string | null {
  return card.tokenFromHash(window.location.hash) ?? readSavedToken()
}

export function App() {
  const [token, setToken] = useState<string | null>(initialToken)
  const [signupCode, setSignupCode] = useState(() =>
    selfSignup.codeFromPath(window.location.pathname),
  )

  useEffect(() => {
    if (!token || signupCode) return
    saveToken(token)
    // El ícono de "Poner en mi pantalla de inicio" guarda la dirección que se ve en
    // ese momento, y en iPhone la app instalada no ve lo guardado en Safari: por eso,
    // en el navegador, el link de la tarjeta queda en la dirección. Ya instalada, se saca.
    const target = isInstalledApp() ? '/' : card.cardPath(token)
    if (window.location.pathname + window.location.hash !== target) {
      window.history.replaceState(null, '', target)
    }
  }, [token, signupCode])

  useEffect(() => {
    const onHash = () => {
      const fromHash = card.tokenFromHash(window.location.hash)
      if (fromHash) setToken(fromHash)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (signupCode) {
    return (
      <SignupPage
        code={signupCode}
        onCreated={(newToken) => {
          window.history.replaceState(null, '', '/')
          setSignupCode(null)
          setToken(newToken)
        }}
      />
    )
  }
  if (!token) return <NoCard />
  return (
    <CardPage
      token={token}
      onForget={() => {
        forgetToken()
        setToken(null)
      }}
    />
  )
}
