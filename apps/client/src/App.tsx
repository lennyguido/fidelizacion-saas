import { useEffect, useState } from 'react'
import { card, selfSignup } from '@plataforma/sdk'
import { CardPage } from '@/card/CardPage'
import { NoCard } from '@/card/NoCard'
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
    if (!token) return
    saveToken(token)
    // Saca el código de la barra de direcciones (no queda en el historial ni en capturas).
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [token])

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
