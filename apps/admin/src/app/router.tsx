import { createBrowserRouter } from 'react-router'
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage'
import { PublicOnly, RequireAuth } from '../features/auth/guards'
import { LoginPage } from '../features/auth/LoginPage'
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage'
import { SignupPage } from '../features/auth/SignupPage'
import { BusinessLayout } from '../features/business/BusinessLayout'
import { HomeRedirect } from '../features/business/HomeRedirect'
import { OnboardingPage } from '../features/business/OnboardingPage'
import { moduleManifests } from '../modules/registry'
import { RequireModule } from '../modules/RequireModule'
import { HomePage } from '../pages/HomePage'
import { NotFoundPage } from '../pages/NotFoundPage'

const moduleRoutes = moduleManifests.flatMap((manifest) =>
  manifest.routes.map((route) => ({
    ...route,
    element: <RequireModule id={manifest.id}>{route.element}</RequireModule>,
  })),
)

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <PublicOnly>
        <LoginPage />
      </PublicOnly>
    ),
  },
  {
    path: '/signup',
    element: (
      <PublicOnly>
        <SignupPage />
      </PublicOnly>
    ),
  },
  {
    path: '/forgot-password',
    element: (
      <PublicOnly>
        <ForgotPasswordPage />
      </PublicOnly>
    ),
  },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  {
    path: '/onboarding',
    element: (
      <RequireAuth>
        <OnboardingPage />
      </RequireAuth>
    ),
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <HomeRedirect />
      </RequireAuth>
    ),
  },
  {
    path: '/b/:slug',
    element: (
      <RequireAuth>
        <BusinessLayout />
      </RequireAuth>
    ),
    children: [{ index: true, element: <HomePage /> }, ...moduleRoutes],
  },
  { path: '*', element: <NotFoundPage /> },
])
